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
  if (kind === "has") {
    const hit = state.clauses.some((c) => KEYWORDS[el].test(c.text));
    return { type: "noul", noul: hit ? 0.9 : 0.1 };
  }
  if (kind === "pick") {
    const c = state.clauses.find((c) => KEYWORDS[el].test(c.text));
    const choice = c ? c.id : "none";
    const probabilities = {};
    for (const k of Object.keys(q.criteria)) probabilities[k] = k === choice ? 0.8 : 0.2 / (Object.keys(q.criteria).length - 1);
    return { type: "choice", choice, confidence: 0.8, probabilities };
  }
  if (kind === "specific") {
    return { type: "noul", noul: SPECIFIC[el].test(state.evidence[el].passage) ? 0.85 : 0.2 };
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
