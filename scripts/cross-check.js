// cross-check.js — semantic validation of an analysis JSON against the RAW
// scanner output it claims to describe.
//
// The schema validator (validate-analysis.js) catches wrong field names; this
// module catches wrong FACTS: trackers the scanner never observed, cookies
// that don't exist in the scan, audit-trail events with no underlying request,
// reject-scenario claims contradicted by the reject variant, and a headline
// score inconsistent with the per-category scores. Every error here is a
// claim the report could not justify from the captured evidence.

// Phase E category weights (references/scoring.md). Dark Patterns raised to
// 15% (deceptive design invalidates consent regardless of the formal
// mechanism — EDPB 03/2022; Opinion 08/2024). Old 7-category fallback for
// analyses produced before the Phase D rebalance.
const WEIGHTS_PHASE_D = {
  consent: 20, preConsentTracking: 18, legalPages: 11, crossBorder: 10,
  securityHeaders: 9, cookieManagement: 7, processorTransparency: 6,
  dsar: 4, darkPatterns: 15,
};
const WEIGHTS_LEGACY = {
  consent: 25, preConsentTracking: 20, legalPages: 15, crossBorder: 15,
  securityHeaders: 10, cookieManagement: 10, darkPatterns: 5,
};

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return null; }
}

function variantPhases(scan) {
  const out = [];
  for (const [variant, v] of Object.entries(scan.variants || {})) {
    if (!v) continue;
    for (const phase of ["preConsent", "postConsent"]) {
      if (v[phase]) out.push({ variant, phase, data: v[phase] });
    }
  }
  return out;
}

// All hostnames the scanner observed any request to, plus tracker/SDK/ping domains.
function observedDomains(scan, { preConsentOnly = false } = {}) {
  const set = new Set();
  for (const { phase, data } of variantPhases(scan)) {
    if (preConsentOnly && phase !== "preConsent") continue;
    for (const r of data.networkRequests || []) {
      const d = hostOf(r.url);
      if (d) set.add(d);
    }
    for (const list of [data.trackers, data.sdkLoads, data.consentModePings, data.trackingPixels]) {
      for (const t of list || []) if (t.domain) set.add(t.domain);
    }
    for (const t of data.thirdPartyDomains || []) if (t.domain) set.add(t.domain);
  }
  return set;
}

function observedCookieNames(scan) {
  const set = new Set();
  for (const { data } of variantPhases(scan)) {
    for (const c of data.cookies || []) set.add(c.name);
  }
  return set;
}

function firstPartyOk(domain, scan) {
  const base = ((scan.meta && scan.meta.domain) || "").replace(/^www\./, "");
  if (!base || !domain) return false;
  return domain === base || domain === `www.${base}` || domain.endsWith(`.${base}`);
}

function splitDomains(domains) {
  if (Array.isArray(domains)) return domains;
  return String(domains || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function expectedOverallScore(scores) {
  const hasNew = scores.dsar || scores.processorTransparency;
  const weights = hasNew ? WEIGHTS_PHASE_D : WEIGHTS_LEGACY;
  let internal = 0;
  let totalWeight = 0;
  for (const [cat, w] of Object.entries(weights)) {
    const s = scores[cat] && scores[cat].score;
    if (typeof s !== "number") continue;
    internal += ((s - 1) / 9) * 100 * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return null;
  return Math.round(((internal / totalWeight) / 100 * 9 + 1) * 10) / 10;
}

function crossCheck(analysis, scan) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(`  ✗ ${m}`);
  const warn = (m) => warnings.push(`  ⚠ ${m}`);

  const f = (analysis && analysis.findings) || {};
  const allObserved = observedDomains(scan);
  const preObserved = observedDomains(scan, { preConsentOnly: true });

  // ── trackers: every claimed domain must exist in the scan; "active"
  //    (pre-consent) requires pre-consent evidence ─────────────────────
  for (const t of f.trackers || []) {
    for (const d of splitDomains(t.domains || t.domain)) {
      if (!allObserved.has(d) && !firstPartyOk(d, scan)) {
        err(`findings.trackers: "${t.name}" cites domain ${d} — not observed anywhere in the scan (unjustified claim)`);
      } else if (t.tier === "active" && !preObserved.has(d)) {
        err(`findings.trackers: "${t.name}" (${d}) is marked tier "active" but the scanner has no pre-consent request to that domain`);
      }
    }
  }

  // ── cookies: names must exist; durations must match captured expiry ──
  const cookieNames = observedCookieNames(scan);
  const scannedAtMs = Date.parse((scan.meta && scan.meta.scannedAt) || "") || null;
  const scanCookies = new Map();
  for (const { data } of variantPhases(scan)) {
    for (const c of data.cookies || []) if (!scanCookies.has(c.name)) scanCookies.set(c.name, c);
  }
  for (const c of f.cookies || []) {
    if (!cookieNames.has(c.name)) {
      err(`findings.cookies: "${c.name}" does not appear in any scan variant (unjustified claim)`);
      continue;
    }
    const raw = scanCookies.get(c.name);
    if (raw && scannedAtMs && typeof raw.expires === "number" && raw.expires > 0 && Number.isInteger(c.durationDays)) {
      const actualDays = Math.max(0, Math.round((raw.expires * 1000 - scannedAtMs) / 86400000));
      const drift = Math.abs(actualDays - c.durationDays);
      if (drift > 2 && drift > actualDays * 0.1) {
        warn(`findings.cookies: "${c.name}" durationDays=${c.durationDays} but captured expiry implies ~${actualDays} days`);
      }
    }
  }

  // ── requestPulse: counts must track the scanner's per-domain counts ──
  const pulseVariant = (scan.variants && (scan.variants.accept || scan.variants.ignore)) || null;
  if (pulseVariant && Array.isArray(f.requestPulse)) {
    const count = (phase) => {
      const m = new Map();
      for (const r of (phase && phase.networkRequests) || []) {
        const d = hostOf(r.url);
        if (d) m.set(d, (m.get(d) || 0) + 1);
      }
      return m;
    };
    const pre = count(pulseVariant.preConsent);
    const post = count(pulseVariant.postConsent);
    for (const p of f.requestPulse) {
      if (!allObserved.has(p.domain)) {
        err(`findings.requestPulse: domain ${p.domain} not observed in the scan (unjustified claim)`);
        continue;
      }
      const actualPre = pre.get(p.domain) || 0;
      const actualPost = post.get(p.domain) || 0;
      const checkDrift = (label, claimed, actual) => {
        if (!Number.isInteger(claimed)) return;
        const drift = Math.abs(claimed - actual);
        if (drift > 2 && drift > Math.max(1, actual) * 0.5) {
          warn(`findings.requestPulse: ${p.domain} ${label}=${claimed} but scanner counted ${actual}`);
        }
      };
      checkDrift("preConsent", p.preConsent, actualPre);
      checkDrift("postConsent", p.postConsent, actualPost);
    }
  }

  // ── auditTrail: every event domain needs an underlying observation ──
  if (f.auditTrail && typeof f.auditTrail === "object") {
    for (const phase of ["preConsent", "postConsent", "rejectConsent"]) {
      for (const ev of f.auditTrail[phase] || []) {
        if (!ev.domain) continue;
        if (!allObserved.has(ev.domain) && !firstPartyOk(ev.domain, scan)) {
          err(`findings.auditTrail.${phase}: event "${ev.title}" cites domain ${ev.domain} — no request to that domain in the scan`);
        }
      }
    }
  }

  // ── rejectScenario: claims must match the reject variant ─────────────
  const reject = scan.variants && scan.variants.reject;
  if (f.rejectScenario && reject && reject.postConsent) {
    const postRejectDomains = new Set();
    for (const r of reject.postConsent.networkRequests || []) {
      const d = hostOf(r.url);
      if (d) postRejectDomains.add(d);
    }
    for (const t of reject.postConsent.trackers || []) postRejectDomains.add(t.domain);

    for (const t of f.rejectScenario.persistingTrackers || []) {
      for (const d of splitDomains(t.domains || t.domain)) {
        if (!postRejectDomains.has(d)) {
          err(`findings.rejectScenario: persisting tracker "${t.name}" (${d}) has no post-reject request in the scan (unjustified claim)`);
        }
      }
    }
    const solidPostRejectTrackers = (reject.postConsent.trackers || []).length;
    if (f.rejectScenario.rejectHonoured === true && solidPostRejectTrackers > 0) {
      err(`findings.rejectScenario: rejectHonoured=true but the scanner recorded ${solidPostRejectTrackers} tracker fire(s) after rejection`);
    }
    if (f.rejectScenario.rejectHonoured === false && solidPostRejectTrackers === 0) {
      const newCookies = (reject.postConsent.cookies || []).length - ((reject.preConsent && reject.preConsent.cookies) || []).length;
      if (newCookies <= 0) {
        warn(`findings.rejectScenario: rejectHonoured=false but the scanner recorded no tracker fires or new cookies after rejection — verify the basis for this claim`);
      }
    }
  }

  // ── overallScore vs weighted category blend ──────────────────────────
  if (analysis && analysis.scores && analysis.meta && typeof analysis.meta.overallScore === "number") {
    const expected = expectedOverallScore(analysis.scores);
    if (expected != null) {
      const drift = Math.abs(expected - analysis.meta.overallScore);
      if (drift > 1.5) {
        err(`meta.overallScore=${analysis.meta.overallScore} but the weighted category blend gives ${expected} — recheck the calculation (modifiers explain at most ±1.5)`);
      } else if (drift > 0.3) {
        warn(`meta.overallScore=${analysis.meta.overallScore} differs from the weighted category blend (${expected}) by ${drift.toFixed(1)} — acceptable only if score modifiers apply; state them in the report`);
      }
    }
  }

  return { errors, warnings };
}

module.exports = { crossCheck, expectedOverallScore };
