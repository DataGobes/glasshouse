#!/usr/bin/env node
/**
 * Validates a privacy-analysis JSON against the field contract.
 * Run before generate.js to catch schema issues early.
 *
 * Usage: node scripts/validate-analysis.js /tmp/privacy-analysis-domain.json [--scan-json <raw-scan.json>]
 *
 * With --scan-json, the analysis is also cross-checked against the RAW
 * scanner output (scripts/cross-check.js): tracker/cookie/audit-trail claims
 * must be backed by captured scan data, and the overall score must be
 * consistent with the weighted category scores. Always pass --scan-json when
 * the raw scan is available — it is the only check that catches factually
 * wrong (rather than mis-shaped) analysis content.
 *
 * Exit code 0 = pass (warnings only), 1 = errors found
 */

const fs = require("fs");
const path = require("path");
const { crossCheck } = require("./cross-check.js");

const argv = process.argv.slice(2);
const scanIdx = argv.indexOf("--scan-json");
const scanFile = scanIdx !== -1 ? argv[scanIdx + 1] : null;
const positional = argv.filter((a, i) => !a.startsWith("--") && (scanIdx === -1 || i !== scanIdx + 1));
const file = positional[0];
if (!file) {
  console.error("Usage: node validate-analysis.js <analysis.json> [--scan-json <raw-scan.json>]");
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.error(`ERROR: Cannot parse JSON: ${e.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];

function err(path, msg) { errors.push(`  ✗ ${path}: ${msg}`); }
function warn(path, msg) { warnings.push(`  ⚠ ${path}: ${msg}`); }

function has(obj, key) { return obj != null && obj[key] !== undefined; }
function isStr(v) { return typeof v === "string"; }
function isNum(v) { return typeof v === "number" && !isNaN(v); }
function isInt(v) { return Number.isInteger(v); }
function isBool(v) { return typeof v === "boolean"; }
function isArr(v) { return Array.isArray(v); }
function isObj(v) { return v != null && typeof v === "object" && !Array.isArray(v); }

function checkEnum(path, val, allowed) {
  if (val != null && !allowed.includes(val)) {
    err(path, `"${val}" not in [${allowed.join(", ")}]`);
  }
}

// ── meta ──────────────────────────────────────────────────────────
const meta = data.meta;
if (!isObj(meta)) {
  err("meta", "missing or not an object");
} else {
  if (!isStr(meta.domain)) err("meta.domain", "required string");
  if (!isNum(meta.overallScore)) err("meta.overallScore", "required number (1.0-10.0)");
  else if (meta.overallScore < 1 || meta.overallScore > 10) warn("meta.overallScore", `${meta.overallScore} outside 1.0-10.0 range`);
  if (meta.episode != null && !isInt(meta.episode)) warn("meta.episode", "should be an integer");
  if (meta.aliasDomains != null) {
    if (!isArr(meta.aliasDomains)) err("meta.aliasDomains", "must be array of eTLD+1 strings");
    else meta.aliasDomains.forEach((d, i) => {
      if (!isStr(d)) err(`meta.aliasDomains[${i}]`, "must be string");
    });
  }
}

// ── scores ────────────────────────────────────────────────────────
const SCORE_CATS = ["consent", "preConsentTracking", "legalPages", "crossBorder", "securityHeaders", "cookieManagement", "darkPatterns"];
// Additional categories introduced by Phase D scoring rebalance. Optional during transition;
// new scans should include them. Old persisted scans without these fields still validate.
const NEW_OPTIONAL_SCORE_CATS = ["dsar", "processorTransparency"];
const scores = data.scores;
if (!isObj(scores)) {
  err("scores", "missing or not an object");
} else {
  for (const cat of SCORE_CATS) {
    if (!has(scores, cat)) err(`scores.${cat}`, "missing (all 7 categories required)");
    else if (!isObj(scores[cat]) || !isNum(scores[cat].score)) err(`scores.${cat}.score`, "required number");
    else if (scores[cat].score < 1 || scores[cat].score > 10) warn(`scores.${cat}.score`, `${scores[cat].score} outside 1.0-10.0 range`);
  }
  for (const cat of NEW_OPTIONAL_SCORE_CATS) {
    if (!has(scores, cat)) {
      warn(`scores.${cat}`, "missing — added in Phase D rebalance, expected for new scans");
    } else if (!isObj(scores[cat]) || !isNum(scores[cat].score)) {
      err(`scores.${cat}.score`, "required number when category is present");
    } else if (scores[cat].score < 1 || scores[cat].score > 10) {
      warn(`scores.${cat}.score`, `${scores[cat].score} outside 1.0-10.0 range`);
    }
  }
}

// ── findings ──────────────────────────────────────────────────────
const f = data.findings;
if (!isObj(f)) {
  err("findings", "missing or not an object");
  console.log(formatOutput());
  process.exit(errors.length ? 1 : 0);
}

// ── Anti-pattern detection (wrong field names) ────────────────────
const ANTI_PATTERNS = [
  ["findings.auditTrailPre", "use findings.auditTrail.preConsent instead"],
  ["findings.auditTrailPost", "use findings.auditTrail.postConsent instead"],
];
for (const [key, fix] of ANTI_PATTERNS) {
  const parts = key.split(".");
  let obj = data;
  for (const p of parts.slice(1)) { obj = obj?.[p]; }
  if (obj !== undefined) err(key, `wrong key — ${fix}`);
}

// Check inside beforeAfter for wrong field names
if (isObj(f.beforeAfter)) {
  const ba = f.beforeAfter;
  if (has(ba, "preCookies") && !has(ba, "preCookieCount")) err("findings.beforeAfter.preCookies", "wrong key — use preCookieCount");
  if (has(ba, "postCookies") && !has(ba, "postCookieCount")) err("findings.beforeAfter.postCookies", "wrong key — use postCookieCount");
  if (has(ba, "prePills") && !has(ba, "preBreakdown")) err("findings.beforeAfter.prePills", "wrong key — use preBreakdown");
  if (has(ba, "postPills") && !has(ba, "postBreakdown")) err("findings.beforeAfter.postPills", "wrong key — use postBreakdown");
}

// ── tldr ──────────────────────────────────────────────────────────
if (isArr(f.tldr)) {
  f.tldr.forEach((t, i) => {
    if (!isStr(t.headline)) err(`findings.tldr[${i}].headline`, "required string");
    if (!isStr(t.detail)) err(`findings.tldr[${i}].detail`, "required string");
    checkEnum(`findings.tldr[${i}].sentiment`, t.sentiment, ["positive", "negative", "surprising"]);
  });
}

// ── cookies (persistence bars) ────────────────────────────────────
if (isArr(f.cookies)) {
  const PURPOSE_ENUM = ["essential", "functional", "analytics", "tracking", "marketing", "unknown"];
  f.cookies.forEach((c, i) => {
    const p = `findings.cookies[${i}]`;
    if (!isInt(c.durationDays) && c.durationDays !== 0) err(`${p}.durationDays`, "required integer (session=0) — bars render at 0 width without this");
    if (!isStr(c.duration)) err(`${p}.duration`, 'required string (e.g. "1.1yr", "Session")');
    if (c.purpose != null) checkEnum(`${p}.purpose`, c.purpose, PURPOSE_ENUM);
  });
}

// ── trackers ──────────────────────────────────────────────────────
if (isArr(f.trackers)) {
  const TIER_ENUM = ["active", "gated", "csp"];
  f.trackers.forEach((t, i) => {
    const p = `findings.trackers[${i}]`;
    if (!isStr(t.tier)) err(`${p}.tier`, "required — use 'active'|'gated'|'csp'");
    else checkEnum(`${p}.tier`, t.tier, TIER_ENUM);
    if (!isStr(t.status)) err(`${p}.status`, 'required string (e.g. "Active pre-consent")');
    if (has(t, "firedPreConsent")) err(`${p}.firedPreConsent`, "wrong key — use tier:'active' instead");
    if (t.domains != null && isArr(t.domains)) warn(`${p}.domains`, "should be comma-separated string, not array");
  });
}

// ── thirdPartyDomains (transfer circuit) ──────────────────────────
if (isArr(f.thirdPartyDomains)) {
  f.thirdPartyDomains.forEach((d, i) => {
    const p = `findings.thirdPartyDomains[${i}]`;
    if (has(d, "domain") && !has(d, "domains")) err(`${p}.domain`, "wrong key — use 'domains' (plural)");
    if (!isStr(d.domains)) err(`${p}.domains`, "required string (generator reads d.domains)");
    if (has(d, "requests") && !has(d, "requestCount")) err(`${p}.requests`, "wrong key — use 'requestCount'");
    if (!isInt(d.requestCount)) err(`${p}.requestCount`, "required integer");
    if (has(d, "transferRisk") && !has(d, "risk")) err(`${p}.transferRisk`, "wrong key — use 'risk'");
    checkEnum(`${p}.risk`, d.risk, ["adequate", "dpf", "risk"]);
  });
}

// ── requestPulse ──────────────────────────────────────────────────
if (isArr(f.requestPulse)) {
  if (f.requestPulse.length > 0 && f.requestPulse.length < 3) warn("findings.requestPulse", `only ${f.requestPulse.length} entries — slide requires ≥3 to render`);
  f.requestPulse.forEach((d, i) => {
    const p = `findings.requestPulse[${i}]`;
    if (d.preConsent == null && d.preCount == null) err(`${p}.preConsent`, "required integer (or preCount)");
    if (d.postConsent == null && d.postCount == null) err(`${p}.postConsent`, "required integer (or postCount)");
    if (d.total == null) warn(`${p}.total`, "missing — will be auto-calculated but explicit is better");
    if (has(d, "requests") && d.preConsent == null && d.postConsent == null) err(`${p}.requests`, "wrong key — use preConsent/postConsent split");
  });
}

// ── recommendations ───────────────────────────────────────────────
if (isArr(f.recommendations)) {
  if (f.recommendations.length > 6) err("findings.recommendations", `${f.recommendations.length} items — HARD LIMIT is 6 (page numbering breaks with 7+)`);
  f.recommendations.forEach((r, i) => {
    const p = `findings.recommendations[${i}]`;
    if (has(r, "title") && !has(r, "action")) err(`${p}.title`, "wrong key — use 'action' (generator reads r.action)");
    if (!isStr(r.action)) err(`${p}.action`, "required string");
    checkEnum(`${p}.priority`, r.priority, ["critical", "high", "medium", "low"]);
  });
}

// ── securityHeaders ───────────────────────────────────────────────
if (f.securityHeaders != null) {
  if (!isArr(f.securityHeaders)) err("findings.securityHeaders", "must be flat array — NOT an object with present/missing sub-arrays");
  else {
    f.securityHeaders.forEach((h, i) => {
      checkEnum(`findings.securityHeaders[${i}].status`, h.status, ["present", "missing", "partial"]);
    });
  }
}

// ── auditTrail ────────────────────────────────────────────────────
if (isObj(f.auditTrail)) {
  const TYPE_ENUM = ["essential", "tracking", "adtech", "security", "consent"];
  for (const phase of ["preConsent", "postConsent", "rejectConsent"]) {
    if (isArr(f.auditTrail[phase])) {
      f.auditTrail[phase].forEach((ev, i) => {
        const p = `findings.auditTrail.${phase}[${i}]`;
        if (has(ev, "event") && !has(ev, "title")) err(`${p}.event`, "wrong key — use 'title'");
        if (!isStr(ev.title)) err(`${p}.title`, "required string");
        if (has(ev, "severity") && !has(ev, "type")) err(`${p}.severity`, "wrong key — use 'type'");
        checkEnum(`${p}.type`, ev.type, TYPE_ENUM);
      });
    }
  }
} else if (data.slides?.include?.some(s => s.startsWith("auditTrail"))) {
  warn("findings.auditTrail", "missing but auditTrail slides are in slides.include");
}

// ── darkPatterns (fairness scale) ─────────────────────────────────
if (isObj(f.darkPatterns)) {
  const dp = f.darkPatterns;
  if (has(dp, "verdict") && !has(dp, "verdictText")) err("findings.darkPatterns.verdict", "wrong key — use 'verdictText'");
  if (has(dp, "factors") && !has(dp, "acceptFactors")) err("findings.darkPatterns.factors", "wrong key — use separate 'acceptFactors' and 'rejectFactors' arrays");
  if (isArr(dp.acceptFactors)) {
    dp.acceptFactors.forEach((f, i) => {
      if (has(f, "label") && !has(f, "name")) err(`findings.darkPatterns.acceptFactors[${i}].label`, "wrong key — use 'name'");
      if (has(f, "weight") && !has(f, "value")) err(`findings.darkPatterns.acceptFactors[${i}].weight`, "wrong key — use 'value'");
    });
  }
  if (isArr(dp.rejectFactors)) {
    dp.rejectFactors.forEach((f, i) => {
      if (has(f, "label") && !has(f, "name")) err(`findings.darkPatterns.rejectFactors[${i}].label`, "wrong key — use 'name'");
      if (has(f, "weight") && !has(f, "value")) err(`findings.darkPatterns.rejectFactors[${i}].weight`, "wrong key — use 'value'");
    });
  }
  const TILT_ENUM = ["fs-bar-balanced", "fs-bar-tilted-accept", "fs-bar-tilted-reject", "fs-bar-heavy-accept", "fs-bar-heavy-reject", "fs-bar-heavy-tilt"];
  checkEnum("findings.darkPatterns.tiltClass", dp.tiltClass, TILT_ENUM);
}

// ── consent annotations ───────────────────────────────────────────
if (isObj(f.consent) && isArr(f.consent.annotations)) {
  f.consent.annotations.forEach((a, i) => {
    const p = `findings.consent.annotations[${i}]`;
    if (has(a, "label") && !has(a, "title")) err(`${p}.label`, "wrong key — use 'title'");
    if (!isStr(a.title)) err(`${p}.title`, "required string");
    checkEnum(`${p}.status`, a.status, ["pass", "fail", "partial"]);
  });
}

// ── legalPages ────────────────────────────────────────────────────
if (isArr(f.legalPages)) {
  f.legalPages.forEach((lp, i) => {
    const p = `findings.legalPages[${i}]`;
    if (has(lp, "label") && !has(lp, "title")) err(`${p}.label`, "wrong key — use 'title'");
    if (!isStr(lp.title)) err(`${p}.title`, "required string");
    if (has(lp, "present") && !has(lp, "status")) err(`${p}.present`, "wrong key — use status:'present'|'missing'");
    checkEnum(`${p}.status`, lp.status, ["present", "missing"]);
  });
}

// ── privacyPolicyAnalysis ─────────────────────────────────────────
if (isArr(f.privacyPolicyAnalysis)) {
  f.privacyPolicyAnalysis.forEach((item, i) => {
    const p = `findings.privacyPolicyAnalysis[${i}]`;
    if (has(item, "item") && !has(item, "element")) err(`${p}.item`, "wrong key — use 'element' (generator reads item.element)");
    if (!isStr(item.element)) err(`${p}.element`, "required string");
    checkEnum(`${p}.status`, item.status, ["present", "absent", "vague"]);
  });
}

// ── gdprCompliance ────────────────────────────────────────────────
if (isArr(f.gdprCompliance)) {
  f.gdprCompliance.forEach((g, i) => {
    checkEnum(`findings.gdprCompliance[${i}].status`, g.status, ["pass", "fail", "partial"]);
  });
}

// ── fingerprinting (API heatmap) ──────────────────────────────────
if (isObj(f.fingerprinting) && f.fingerprinting.detected) {
  const fp = f.fingerprinting;
  if (!has(fp, "apiCalls") && !has(fp, "apis")) {
    if (has(fp, "methods")) {
      err("findings.fingerprinting.methods", "wrong key — use 'apiCalls' or 'apis' (generator reads fp.apiCalls || fp.apis, not fp.methods)");
    } else {
      warn("findings.fingerprinting", "missing apiCalls/apis — heatmap bars will be empty");
    }
  }
  checkEnum("findings.fingerprinting.severity", fp.severity, ["none", "low", "medium", "high"]);
  // New tiered model fields (all optional)
  if (fp.stackedSignals != null) {
    if (!isArr(fp.stackedSignals)) err("findings.fingerprinting.stackedSignals", "must be array when present");
    else fp.stackedSignals.forEach((s, i) => {
      const p = `findings.fingerprinting.stackedSignals[${i}]`;
      if (!isStr(s.callerDomain)) err(`${p}.callerDomain`, "required string");
      checkEnum(`${p}.verdict`, s.verdict, ["active fingerprinting", "probable fingerprinting"]);
      if (!isInt(s.tier1Count)) err(`${p}.tier1Count`, "required integer");
      if (!isInt(s.tier2Count)) err(`${p}.tier2Count`, "required integer");
      if (!isArr(s.apis)) err(`${p}.apis`, "required array");
      if (s.preConsent != null && !isBool(s.preConsent)) err(`${p}.preConsent`, "must be boolean");
    });
  }
  if (fp.commercialSdks != null) {
    if (!isArr(fp.commercialSdks)) err("findings.fingerprinting.commercialSdks", "must be array when present");
    else fp.commercialSdks.forEach((s, i) => {
      const p = `findings.fingerprinting.commercialSdks[${i}]`;
      if (!isStr(s.name)) err(`${p}.name`, "required string");
      if (!isArr(s.domains)) err(`${p}.domains`, "required array");
    });
  }
  if (fp.tier1Calls != null && !isArr(fp.tier1Calls)) err("findings.fingerprinting.tier1Calls", "must be array when present");
  if (fp.tier2Calls != null && !isArr(fp.tier2Calls)) err("findings.fingerprinting.tier2Calls", "must be array when present");
  if (fp.tier3Appendix != null && !isArr(fp.tier3Appendix)) err("findings.fingerprinting.tier3Appendix", "must be array when present");
  if (fp.outOfScopeCaveats != null && !isArr(fp.outOfScopeCaveats)) err("findings.fingerprinting.outOfScopeCaveats", "must be array when present");
}

// ── riskSummaryNotes ──────────────────────────────────────────────
if (isArr(f.riskSummaryNotes)) {
  f.riskSummaryNotes.forEach((n, i) => {
    checkEnum(`findings.riskSummaryNotes[${i}].category`, n.category, SCORE_CATS);
    if (!isStr(n.note)) err(`findings.riskSummaryNotes[${i}].note`, "required string");
  });
}

// ── beforeAfter ───────────────────────────────────────────────────
if (isObj(f.beforeAfter)) {
  const ba = f.beforeAfter;
  if (!isInt(ba.preCookieCount) && ba.preCookieCount !== 0) warn("findings.beforeAfter.preCookieCount", "missing or not integer");
  if (!isInt(ba.postCookieCount) && ba.postCookieCount !== 0) warn("findings.beforeAfter.postCookieCount", "missing or not integer");
}

// ── new optional findings checks (DSAR / processors / breach / opt-out) ──
if (isObj(f.dsar)) {
  const d = f.dsar;
  checkEnum("findings.dsar.contactType", d.contactType, ["email", "form", "postal_only", "none"]);
  if (d.responseCommitmentDays != null && !isInt(d.responseCommitmentDays)) {
    err("findings.dsar.responseCommitmentDays", "must be integer or null");
  }
}
if (isObj(f.processors)) {
  const p = f.processors;
  if (p.namedInPolicy != null && !isArr(p.namedInPolicy)) err("findings.processors.namedInPolicy", "must be array");
  if (p.detectedOnSite != null && !isArr(p.detectedOnSite)) err("findings.processors.detectedOnSite", "must be array");
  if (p.undisclosed != null && !isArr(p.undisclosed)) err("findings.processors.undisclosed", "must be array");
  if (isArr(p.jointControllerScenarios)) {
    p.jointControllerScenarios.forEach((jc, i) => {
      if (!isStr(jc.processor)) err(`findings.processors.jointControllerScenarios[${i}].processor`, "required string");
      if (jc.disclosed != null && !isBool(jc.disclosed)) err(`findings.processors.jointControllerScenarios[${i}].disclosed`, "must be boolean");
    });
  }
}
if (isObj(f.breachNotification)) {
  const b = f.breachNotification;
  if (b.securityTxtPresent != null && !isBool(b.securityTxtPresent)) err("findings.breachNotification.securityTxtPresent", "must be boolean");
  if (b.securityTxtExpired != null && !isBool(b.securityTxtExpired)) err("findings.breachNotification.securityTxtExpired", "must be boolean or null");
}
if (isObj(f.optOut)) {
  // all optOut fields are booleans — minimal validation
  const flagFields = ["unsubscribeMentioned", "art21Disclosed", "withdrawAsEasyAsConsent", "legitimateInterestsObjectionContact", "preferenceCenterMentioned"];
  for (const k of flagFields) {
    if (f.optOut[k] != null && !isBool(f.optOut[k])) err(`findings.optOut.${k}`, "must be boolean");
  }
}

// ── slides.include validation ─────────────────────────────────────
const VALID_SLIDES = new Set([
  "title", "tldr", "beforeAfter", "auditTrailPre", "auditTrailPost", "auditTrailReject",
  "consent", "darkPatterns", "rejectScenario", "variantComparison", "trackers", "cookies",
  "cookieParty", "cookiePurposeMatching", "thirdPartyDomains", "piggybackingChains", "requestPulse",
  "storageAnalysis", "securityHeaders", "legalPages", "gdprCompliance", "riskSummary",
  "recommendations", "methodology", "privacyPolicy", "fingerprinting", "consentRevocation",
  "tcfConsentMode", "dataSubjectRights", "formLeakage",
  // new in Phase E
  "dsar", "processorTransparency", "breachNotification",
  // private appendix (2026-04 fingerprinting expansion)
  "fingerprintingTier3Appendix", "outOfScopeCaveats"
]);
const INVALID_SLIDES = { overview: true, privacyPolicyAnalysis: "use 'privacyPolicy'", consentGranularity: "rendered within consent slide" };

if (isObj(data.slides) && isArr(data.slides.include)) {
  for (const s of data.slides.include) {
    if (INVALID_SLIDES[s]) err(`slides.include`, `"${s}" is not a valid slide — ${INVALID_SLIDES[s] === true ? "does not exist" : INVALID_SLIDES[s]}`);
    else if (!VALID_SLIDES.has(s)) warn(`slides.include`, `"${s}" is not a recognized slide key`);
  }
  if (!data.slides.include.includes("riskSummary")) warn("slides.include", "missing 'riskSummary' — should always be included");
}

// ── Cross-check against raw scan (semantic validation) ───────────
if (scanFile) {
  let scanData = null;
  try {
    scanData = JSON.parse(fs.readFileSync(scanFile, "utf8"));
  } catch (e) {
    err("--scan-json", `cannot parse ${scanFile}: ${e.message}`);
  }
  if (scanData && !scanData.variants) {
    err("--scan-json", `${scanFile} has no \`variants\` — pass the RAW scanner output, not another analysis JSON`);
  } else if (scanData) {
    const result = crossCheck(data, scanData);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }
} else {
  warnings.push("  ⚠ no --scan-json given — factual cross-check against the raw scan was skipped; schema-only validation cannot catch unjustified claims");
}

// ── Output ────────────────────────────────────────────────────────
function formatOutput() {
  let out = "";
  if (errors.length) {
    out += `\n❌ ${errors.length} ERROR(S) — these will cause broken/empty slides:\n${errors.join("\n")}\n`;
  }
  if (warnings.length) {
    out += `\n⚠️  ${warnings.length} WARNING(S) — may cause suboptimal rendering:\n${warnings.join("\n")}\n`;
  }
  if (!errors.length && !warnings.length) {
    out += "\n✅ Analysis JSON passed all checks.\n";
  }
  return out;
}

console.log(formatOutput());
process.exit(errors.length ? 1 : 0);
