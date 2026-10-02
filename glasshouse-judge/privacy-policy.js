/**
 * Art. 13/14 checklist judge: privacy-policy text in, the hand-written
 * analysis's findings.privacyPolicyAnalysis[] shape out.
 *
 * Gate first: one Noul on the opening of the text asks whether it is a
 * privacy policy at all. Scans sometimes capture a login, password-reset or
 * cookie-only page instead; judging those yields 13 confident "absent"s.
 * Below gateThreshold the checklist is skipped, not filled with absents.
 *
 * Then two passes, each batched (all elements ask their questions at once):
 *
 *   1. Per window of clauses, per element:
 *        has:<el>   Noul   does any clause here address the element?
 *        pick:<el>  Choice which clause ID best does (or "none")?
 *      P(disclosed) is the max of has:<el> over windows; the evidence clause
 *      is the pick from the window that scored highest.
 *   2. Per disclosed element, one small request over its best few clauses
 *      (the pick, the clause after it, and the top candidates elsewhere):
 *        specific:<el> Noul  taken together, specific or vague?
 *
 * Status: absent if P(disclosed) < existsThreshold, else present if
 * P(specific) >= specificThreshold, else vague. The excerpt is copied from
 * the policy (selected, never generated).
 *
 * Policy text is untrusted third-party content; the model reads it as state
 * and may be steered by text written to do so. Treat outputs as judgments to
 * review, like the hand-written analysis they replace.
 */

const { ELEMENTS, VERSION } = require("./checklists/art13");
const { segmentClauses, windowClauses } = require("./segment");
const { extractPolicy } = require("./policy-text");

const NONE = "none";
const EXCERPT_MAX = 300;

function choice(instructions, criteria) { return { type: "choice", instructions, criteria }; }
function noul(instructions, criteria) { return { type: "noul", instructions, criteria }; }

function documentLabel(domain, url) {
  return `Privacy policy of ${domain || "a website"}${url ? ` (${url})` : ""}`;
}

const GATE_CHARS = 3000;
const GATE_SAMPLE_CHARS = 1500;

/** Gate request: is this text a privacy policy? */
function buildGateRequest({ model, domain, policy }) {
  return {
    model,
    // Opening plus a sample from the middle: some captures start with cookie
    // banner text before the policy proper.
    state: {
      site: domain || null,
      url: policy.url,
      length_chars: policy.chars,
      opening: policy.text.slice(0, GATE_CHARS),
      middle_sample: policy.chars > GATE_CHARS * 2 ? policy.text.slice(Math.floor(policy.chars / 2), Math.floor(policy.chars / 2) + GATE_SAMPLE_CHARS) : null,
    },
    questions: {
      "is:privacyPolicy": noul(
        "Are `opening` and `middle_sample` taken from the website's privacy policy or privacy statement, the document that explains how the organisation processes personal data?",
        {
          true: "A privacy policy or privacy statement (it may open with a table of contents, a cookie notice summary or contact details).",
          false: "Something else: a login, sign-up or password-reset page, a cookie policy that only covers cookies, terms of service, a consent wall, an error page or a navigation page.",
        }
      ),
    },
  };
}

/** Pass-1 request for one window. Exported so tests can assert its shape. */
function buildWindowRequest({ model, domain, url, clauses }) {
  const criteria = {};
  for (const c of clauses) criteria[c.id] = null;
  criteria[NONE] = "No clause in `clauses` does this.";

  const questions = {};
  for (const e of ELEMENTS) {
    questions[`has:${e.id}`] = noul(
      `Does any clause in \`clauses\` address this GDPR ${e.article} information item: ${e.disclosed}?`,
      {
        true: `At least one clause ${e.disclosed}, even if only briefly or vaguely.`,
        false: "No clause in `clauses` touches on this.",
      }
    );
    questions[`pick:${e.id}`] = choice(
      `Which clause in \`clauses\` best ${e.disclosed} (GDPR ${e.article}, "${e.element}")? Answer with that clause's \`id\`, or "${NONE}" if no clause does.`,
      criteria
    );
  }
  return {
    model,
    state: { document: documentLabel(domain, url), clauses: clauses.map((c) => ({ id: c.id, text: c.text })) },
    questions,
  };
}

/**
 * Pass-2 request for one element: is what the policy says about it, across
 * its best few passages, specific or vague? One element per request keeps
 * the state about that element only (Jev's accuracy drops as unrelated text
 * fills the state).
 */
function buildSpecificityRequest({ model, domain, url, id, passages }) {
  const e = ELEMENTS.find((x) => x.id === id);
  return {
    model,
    state: { document: documentLabel(domain, url), item: `${e.element} (GDPR ${e.article})`, passages },
    questions: {
      [`specific:${e.id}`]: noul(
        `\`passages\` are the parts of this privacy policy that address "${e.element}". Taken together, is the policy's disclosure of this item specific rather than vague?`,
        e.specific
      ),
    },
  };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function bestNonNone(answer) {
  if (!answer) return null;
  const pNone = answer.probabilities ? answer.probabilities[NONE] : undefined;
  if (answer.choice && answer.choice !== NONE) return { id: answer.choice, pickedNone: false, confidence: answer.confidence, pNone };
  const probs = answer.probabilities || {};
  let best = null;
  for (const [id, p] of Object.entries(probs)) {
    if (id === NONE) continue;
    if (!best || p > best.p) best = { id, p };
  }
  return best ? { id: best.id, pickedNone: true, confidence: answer.confidence, pNone: probs[NONE] } : null;
}

function excerptOf(text) {
  return text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX - 1).trimEnd()}…` : text;
}

/**
 * @param scan     raw scripts/scan.js output
 * @param judge    { systemOne(body) => Promise<response>, config }
 * @returns { findings: { privacyPolicyAnalysis? }, trace }
 */
async function judgePrivacyPolicy(scan, { systemOne, config }) {
  const domain = scan && scan.meta && scan.meta.domain;
  const policy = extractPolicy(scan, "privacyPolicy");
  const trace = { checklist: VERSION, model: config.model, requests: 0, usage: { input_tokens: 0, output_tokens: 0 } };
  if (!policy) return { findings: {}, trace: { ...trace, skipped: "scan has no privacy policy text" } };
  Object.assign(trace, { policyUrl: policy.url, policyChars: policy.chars, policyTruncated: policy.truncated, truncatedReason: policy.truncatedReason });

  const call = async (body) => {
    trace.requests++;
    const res = await systemOne(body);
    if (res && res.usage) {
      trace.usage.input_tokens += res.usage.input_tokens || 0;
      trace.usage.output_tokens += res.usage.output_tokens || 0;
    }
    return res;
  };

  const gate = await call(buildGateRequest({ model: config.model, domain, policy }));
  trace.pIsPolicy = gate.answers["is:privacyPolicy"] ? gate.answers["is:privacyPolicy"].noul : null;
  if (trace.pIsPolicy != null && trace.pIsPolicy < config.gateThreshold) {
    return {
      findings: {},
      trace: { ...trace, skipped: `text does not look like a privacy policy (p=${trace.pIsPolicy.toFixed(2)}, ${policy.chars} chars from ${policy.url || "unknown url"})` },
    };
  }

  const clauses = segmentClauses(policy.text, config);
  const windows = windowClauses(clauses, config);
  const byId = new Map(clauses.map((c, i) => [c.id, i]));
  Object.assign(trace, { clauses: clauses.length, windows: windows.length });

  const pass1 = await mapLimit(windows, config.concurrency, (w) =>
    call(buildWindowRequest({ model: config.model, domain, url: policy.url, clauses: w }))
  );

  const items = ELEMENTS.map((e) => {
    let best = { p: -1, w: -1 };
    // Candidate clauses from every window, ranked by
    // P(window addresses the element) x P(this clause is the one).
    const candidates = [];
    pass1.forEach((res, w) => {
      const a = res.answers[`has:${e.id}`];
      const p = a ? a.noul : 0;
      if (p > best.p) best = { p, w };
      const probs = (res.answers[`pick:${e.id}`] || {}).probabilities || {};
      for (const [cid, pc] of Object.entries(probs)) {
        if (cid !== NONE && byId.has(cid)) candidates.push({ id: cid, score: p * pc });
      }
    });
    candidates.sort((a, b) => b.score - a.score);
    const pick = best.w >= 0 ? bestNonNone(pass1[best.w].answers[`pick:${e.id}`]) : null;
    const idx = pick && byId.has(pick.id) ? byId.get(pick.id) : -1;

    // Evidence for pass 2: the picked clause (plus the one after it, which
    // often finishes the thought) and the next-best candidates elsewhere.
    // A disclosure spread over several sections looks vague in any one of them.
    const evidenceIdx = [];
    const add = (i) => { if (i >= 0 && i < clauses.length && !evidenceIdx.includes(i)) evidenceIdx.push(i); };
    if (idx >= 0) { add(idx); add(idx + 1); }
    for (const c of candidates) {
      if (evidenceIdx.length >= config.evidenceClauses) break;
      add(byId.get(c.id));
    }
    evidenceIdx.sort((a, b) => a - b);

    return {
      id: e.id,
      element: e.element,
      pExists: Math.max(0, best.p),
      window: best.w,
      clauseId: idx >= 0 ? pick.id : null,
      pickedNone: pick ? pick.pickedNone : true,
      pickConfidence: pick ? pick.confidence : null,
      // P(none) next to pExists shows where the Noul and the Choice disagree.
      pNone: pick && pick.pNone != null ? pick.pNone : null,
      evidenceClauseIds: evidenceIdx.map((i) => clauses[i].id),
      clause: idx >= 0 ? clauses[idx].text : null,
      passages: evidenceIdx.map((i) => clauses[i].text),
    };
  });

  const disclosed = items.filter((it) => it.pExists >= config.existsThreshold && it.passages.length);
  await mapLimit(disclosed, config.concurrency, async (it) => {
    const res = await call(buildSpecificityRequest({ model: config.model, domain, url: policy.url, id: it.id, passages: it.passages }));
    const a = res.answers[`specific:${it.id}`];
    it.pSpecific = a ? a.noul : null;
  });

  for (const it of items) {
    // On cut-off text an "absent" may just sit past the cut: say so in the
    // trace so a reviewer (and the replay) does not take it at face value.
    if (it.pExists < config.existsThreshold && policy.truncated) it.unverifiable = true;
    if (it.pExists < config.existsThreshold) it.status = "absent";
    else if (it.pSpecific == null) it.status = "vague"; // disclosed but no clause to point at
    else it.status = it.pSpecific >= config.specificThreshold ? "present" : "vague";
  }

  trace.items = items.map(({ clause, passages, ...rest }) => rest);
  return {
    findings: {
      privacyPolicyAnalysis: items.map((it) => {
        const entry = { element: it.element, status: it.status };
        if (it.status !== "absent" && it.clause) entry.excerpt = excerptOf(it.clause);
        return entry;
      }),
    },
    trace,
  };
}

module.exports = { judgePrivacyPolicy, buildGateRequest, buildWindowRequest, buildSpecificityRequest, NONE };
