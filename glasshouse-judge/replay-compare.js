/**
 * Scoring for scripts/replay.js: lines hand-written checklist labels up with
 * judge output and computes agreement.
 *
 * Labels are not gold (fixtures/replay/README.md). Items named in the
 * fixture's validation.errors are dropped, and fixtures that failed
 * validation count at half weight.
 */

const { ELEMENTS, matchElement } = require("./checklists/art13");

const STATUSES = ["present", "vague", "absent"];
const DIRTY_WEIGHT = 0.5;

/** Which privacyPolicyAnalysis labels validation.errors rules out. */
function excludedByValidation(errors = []) {
  const indexes = new Set();
  let all = false;
  for (const e of errors) {
    if (!/privacyPolicyAnalysis/.test(e)) continue;
    const m = e.match(/privacyPolicyAnalysis\[(\d+)\]/);
    if (m) indexes.add(Number(m[1]));
    else all = true;
  }
  return { all, indexes };
}

function labelsFromAnalysis(analysis, { errors = [] } = {}) {
  const list = (analysis && analysis.findings && analysis.findings.privacyPolicyAnalysis) || [];
  const ex = excludedByValidation(errors);
  const labels = new Map();
  const unmatched = [];
  const skipped = [];
  list.forEach((item, i) => {
    if (ex.all || ex.indexes.has(i)) { skipped.push(item.element); return; }
    const id = matchElement(item.element);
    if (!id) { unmatched.push(item.element); return; }
    if (!STATUSES.includes(item.status)) { skipped.push(item.element); return; }
    if (!labels.has(id)) labels.set(id, { status: item.status, element: item.element });
  });
  return { labels, unmatched, skipped };
}

/**
 * @param unverifiable ids whose judged "absent" can't be trusted (the policy
 *        text was cut off); those rows are shown but not scored.
 */
function compareChecklist(labels, judged, { unverifiable = new Set() } = {}) {
  const byElement = new Map((judged || []).map((j) => [matchElement(j.element), j]));
  const rows = [];
  for (const e of ELEMENTS) {
    const label = labels.get(e.id);
    const j = byElement.get(e.id);
    const excluded = j && j.status === "absent" && unverifiable.has(e.id) ? "truncated" : null;
    rows.push({
      id: e.id,
      element: e.element,
      label: label ? label.status : null,
      judged: j ? j.status : null,
      agree: label && j && !excluded ? label.status === j.status : null,
      excluded,
    });
  }
  return rows;
}

function emptyConfusion() {
  const m = {};
  for (const a of STATUSES) { m[a] = {}; for (const b of STATUSES) m[a][b] = 0; }
  return m;
}

// Cohen's kappa over the (weighted) confusion matrix, rows = label.
function kappa(conf) {
  let total = 0, observed = 0;
  const rowSum = {}, colSum = {};
  for (const a of STATUSES) for (const b of STATUSES) {
    const v = conf[a][b];
    total += v;
    if (a === b) observed += v;
    rowSum[a] = (rowSum[a] || 0) + v;
    colSum[b] = (colSum[b] || 0) + v;
  }
  if (!total) return null;
  const po = observed / total;
  const pe = STATUSES.reduce((s, k) => s + (rowSum[k] / total) * (colSum[k] / total), 0);
  return pe === 1 ? null : (po - pe) / (1 - pe);
}

/**
 * @param sites [{ site, weight, rows }]
 * Exact agreement compares the three statuses; presence agreement only asks
 * whether both sides think the element is addressed at all (present/vague
 * vs absent), which separates "missed it" from "graded it differently".
 */
function aggregate(sites) {
  const perElement = {};
  for (const e of ELEMENTS) perElement[e.id] = { element: e.element, n: 0, weight: 0, agree: 0 };
  const conf = emptyConfusion();
  let weight = 0, agree = 0, presenceAgree = 0, n = 0;

  for (const s of sites) {
    for (const r of s.rows) {
      if (r.agree == null) continue;
      const pe = perElement[r.id];
      pe.n++; pe.weight += s.weight;
      if (r.agree) pe.agree += s.weight;
      conf[r.label][r.judged] += s.weight;
      n++; weight += s.weight;
      if (r.agree) agree += s.weight;
      if ((r.label === "absent") === (r.judged === "absent")) presenceAgree += s.weight;
    }
  }
  for (const pe of Object.values(perElement)) pe.agreement = pe.weight ? pe.agree / pe.weight : null;
  return {
    items: n,
    weight,
    agreement: weight ? agree / weight : null,
    presenceAgreement: weight ? presenceAgree / weight : null,
    kappa: kappa(conf),
    confusion: conf,
    perElement,
  };
}

module.exports = { STATUSES, DIRTY_WEIGHT, excludedByValidation, labelsFromAnalysis, compareChecklist, aggregate, kappa };
