/**
 * Art. 13/14 checklist judge: privacy-policy text in, the hand-written
 * analysis's findings.privacyPolicyAnalysis[] shape out.
 *
 * Two passes, each batched (all elements ask their questions in one request):
 *
 *   1. Per window of clauses, per element:
 *        has:<el>   Noul   does any clause here address the element?
 *        pick:<el>  Choice which clause ID best does (or "none")?
 *      P(disclosed) is the max of has:<el> over windows; the evidence clause
 *      is the pick from the window that scored highest.
 *   2. One request over the picked clauses of every disclosed element:
 *        specific:<el> Noul  is that disclosure specific, or vague?
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

/** Pass-2 request over the evidence picked for each disclosed element. */
function buildSpecificityRequest({ model, domain, url, evidence }) {
  const state = { document: documentLabel(domain, url), evidence: {} };
  const questions = {};
  for (const ev of evidence) {
    const e = ELEMENTS.find((x) => x.id === ev.id);
    state.evidence[e.id] = { item: `${e.element} (GDPR ${e.article})`, passage: ev.passage };
    questions[`specific:${e.id}`] = noul(
      `\`evidence.${e.id}.passage\` is what this privacy policy says about "${e.element}". Is that disclosure specific rather than vague?`,
      e.specific
    );
  }
  return { model, state, questions };
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
  if (answer.choice && answer.choice !== NONE) return { id: answer.choice, pickedNone: false, confidence: answer.confidence };
  const probs = answer.probabilities || {};
  let best = null;
  for (const [id, p] of Object.entries(probs)) {
    if (id === NONE) continue;
    if (!best || p > best.p) best = { id, p };
  }
  return best ? { id: best.id, pickedNone: true, confidence: answer.confidence } : null;
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

  const call = async (body) => {
    trace.requests++;
    const res = await systemOne(body);
    if (res && res.usage) {
      trace.usage.input_tokens += res.usage.input_tokens || 0;
      trace.usage.output_tokens += res.usage.output_tokens || 0;
    }
    return res;
  };

  const clauses = segmentClauses(policy.text, config);
  const windows = windowClauses(clauses, config);
  const byId = new Map(clauses.map((c, i) => [c.id, i]));
  Object.assign(trace, { policyUrl: policy.url, policyTruncated: policy.truncated, clauses: clauses.length, windows: windows.length });

  const pass1 = await mapLimit(windows, config.concurrency, (w) =>
    call(buildWindowRequest({ model: config.model, domain, url: policy.url, clauses: w }))
  );

  const items = ELEMENTS.map((e) => {
    let best = { p: -1, w: -1 };
    pass1.forEach((res, w) => {
      const a = res.answers[`has:${e.id}`];
      const p = a ? a.noul : 0;
      if (p > best.p) best = { p, w };
    });
    const pick = best.w >= 0 ? bestNonNone(pass1[best.w].answers[`pick:${e.id}`]) : null;
    const idx = pick && byId.has(pick.id) ? byId.get(pick.id) : -1;
    return {
      id: e.id,
      element: e.element,
      pExists: Math.max(0, best.p),
      window: best.w,
      clauseId: idx >= 0 ? pick.id : null,
      pickedNone: pick ? pick.pickedNone : true,
      pickConfidence: pick ? pick.confidence : null,
      clause: idx >= 0 ? clauses[idx].text : null,
      // The next clause often finishes the thought ("Retention —" / "24 months").
      passage: idx >= 0 ? [clauses[idx].text, clauses[idx + 1] && clauses[idx + 1].text].filter(Boolean).join("\n") : null,
    };
  });

  const disclosed = items.filter((it) => it.pExists >= config.existsThreshold && it.passage);
  if (disclosed.length) {
    const res = await call(buildSpecificityRequest({ model: config.model, domain, url: policy.url, evidence: disclosed }));
    for (const it of disclosed) {
      const a = res.answers[`specific:${it.id}`];
      it.pSpecific = a ? a.noul : null;
    }
  }

  for (const it of items) {
    if (it.pExists < config.existsThreshold) it.status = "absent";
    else if (it.pSpecific == null) it.status = "vague"; // disclosed but no clause to point at
    else it.status = it.pSpecific >= config.specificThreshold ? "present" : "vague";
  }

  trace.items = items.map(({ clause, passage, ...rest }) => rest);
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

module.exports = { judgePrivacyPolicy, buildWindowRequest, buildSpecificityRequest, NONE };
