// Deterministic stand-in for the TypeSafe API: answers by keyword so the
// judge's plumbing (windowing, aggregation, statuses, caching) is testable
// offline. It says nothing about Jev's accuracy; scripts/replay.js does.

const KEYWORDS = {
  controller: /controller|operated by/i,
  dpo: /data protection officer|\bdpo\b/i,
  purposes: /we use your (personal )?data (to|for)|purposes?/i,
  legalBasis: /legal basis|art(icle)?\.? ?6/i,
  legitimateInterests: /legitimate interest/i,
  recipients: /share|recipient|processor/i,
  transfers: /outside the (eu|eea)|transfer/i,
  retention: /retain|retention|keep your/i,
  rights: /right (of|to) (access|erasure)|your rights/i,
  withdrawConsent: /withdraw/i,
  complaint: /supervisory authority|complain/i,
  statutoryRequirement: /required by (law|contract)|mandatory/i,
  automatedDecisions: /automated decision|profiling/i,
};

const SPECIFIC = {
  controller: /\d{4} ?[A-Z]{2}|street|straat|@/i,
  dpo: /@/,
  purposes: /order|newsletter|fraud/i,
  legalBasis: /art(icle)?\.? ?6\(1\)\([a-f]\) for/i,
  legitimateInterests: /namely|such as/i,
  recipients: /[A-Z][a-z]+ (Inc|B\.V\.|Ltd|GmbH)/,
  transfers: /standard contractual clauses|data privacy framework|adequacy/i,
  retention: /\d+ (months|years|days)/i,
  rights: /access.*rectification.*erasure/i,
  withdrawConsent: /cookie settings|unsubscribe|link/i,
  complaint: /autoriteit persoonsgegevens|authority \(/i,
  statutoryRequirement: /if you do not/i,
  automatedDecisions: /do not use automated|logic/i,
};

function answerFor(qid, q, state) {
  const [kind, el] = qid.split(":");
  if (kind === "is") {
    return { type: "noul", noul: /privacy (policy|statement)/i.test(state.opening) && /personal data/i.test(state.opening) ? 0.95 : 0.05 };
  }
  if (kind === "has") {
    const hit = state.clauses.some((c) => KEYWORDS[el].test(c.text));
    return { type: "noul", noul: hit ? 0.9 : 0.1 };
  }
  if (kind === "pick") {
    // Matching clauses get most of the mass, the first one the most.
    const matches = state.clauses.filter((c) => KEYWORDS[el].test(c.text)).map((c) => c.id);
    const labels = Object.keys(q.criteria);
    const rest = labels.filter((k) => !matches.includes(k));
    const probabilities = {};
    for (const k of labels) {
      if (k === matches[0]) probabilities[k] = matches.length > 1 ? 0.6 : 0.9;
      else if (matches.includes(k)) probabilities[k] = 0.3 / (matches.length - 1);
      else probabilities[k] = 0.1 / rest.length;
    }
    if (!matches.length) for (const k of labels) probabilities[k] = k === "none" ? 0.9 : 0.1 / (labels.length - 1);
    return { type: "choice", choice: matches[0] || "none", confidence: 0.8, probabilities };
  }
  if (kind === "specific") {
    return { type: "noul", noul: state.passages.some((t) => SPECIFIC[el].test(t)) ? 0.85 : 0.2 };
  }
  throw new Error(`fake-jev: unexpected question ${qid}`);
}

function createFakeClient() {
  const calls = [];
  return {
    calls,
    async systemOne(body) {
      calls.push(body);
      const answers = {};
      for (const [qid, q] of Object.entries(body.questions)) answers[qid] = answerFor(qid, q, body.state);
      return { model: body.model, answers, usage: { input_tokens: 100, output_tokens: Object.keys(answers).length } };
    },
  };
}

module.exports = { createFakeClient };
