#!/usr/bin/env node
// derive-findings.js — deterministically derive the data-heavy sections of the
// analysis JSON from a RAW scanner output file.
//
// Motivation: the audit trail, request pulse, variant comparison, reject
// scenario, storage analysis and piggybacking chains used to be reconstructed
// by hand during analysis ("always reconstruct manually" in SKILL.md). Every
// count and timestamp in those sections was transcribed rather than computed,
// which is exactly where unjustified claims can enter a report that may end up
// in a DPA complaint. This script computes them from the scan data instead.
// The analysis step merges the output verbatim and adds only prose on top.
//
// Usage: node scripts/derive-findings.js /tmp/glasshouse-<domain>-*.json [--out <path>]
// Output: { _provenance, findings: { auditTrail, requestPulse, variantComparison,
//           rejectScenario, storageAnalysis, piggybackingChains, beforeAfter,
//           methodology } }
// Field shapes follow references/field-contract.md.

const fs = require("node:fs");

// CMP consent-record cookies: storing the visitor's consent decision is not
// tracking, and listing these as "persisting despite rejection" would be a
// false claim. Kept deliberately narrow — only well-known CMP state cookies.
const CONSENT_RECORD_COOKIES = [
  /^OptanonConsent$/i,
  /^OptanonAlertBoxClosed$/i,
  /^euconsent-v2$/i,
  /^CookieConsent$/i,
  /^cookieyes-consent$/i,
  /^didomi_token$/i,
  /^euconsent$/i,
  /^cmplz_/i,
  /^CookieScriptConsent$/i,
  /^cookie_consent/i,
];

function isConsentRecordCookie(name) {
  return CONSENT_RECORD_COOKIES.some((re) => re.test(name || ""));
}

function baseDomainOf(meta) {
  return ((meta && meta.domain) || "").replace(/^www\./, "");
}

function isFirstParty(host, base) {
  if (!host || !base) return false;
  return host === base || host === `www.${base}` || host.endsWith(`.${base}`);
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function relTime(ts, t0) {
  const delta = Math.max(0, ts - t0);
  return delta < 1000 ? `t+${delta}ms` : `t+${(delta / 1000).toFixed(1)}s`;
}

function eventTypeFor(category, isPixel) {
  if (category === "advertising") return "adtech";
  if (isPixel || category) return "tracking";
  return "essential";
}

// Build timeline events for one phase from its raw request log.
// Included events: tracker fires, tracking pixels, first contact with each
// third-party domain. Every event carries the real request timestamp.
function buildPhaseEvents(phase, base) {
  const requests = (phase && phase.networkRequests) || [];
  if (requests.length === 0) return { t0: null, events: [] };
  const sorted = [...requests].sort((a, b) => a.timestamp - b.timestamp);
  const t0 = sorted[0].timestamp;

  const trackerByDomain = new Map();
  for (const t of (phase.trackers || [])) {
    if (!trackerByDomain.has(t.domain)) trackerByDomain.set(t.domain, t);
  }
  const pixelDomains = new Set((phase.trackingPixels || []).map((p) => p.domain));

  const seen = new Set();
  const events = [];
  for (const r of sorted) {
    const d = hostOf(r.url);
    if (!d) continue;
    const thirdParty = !isFirstParty(d, base);
    const tracker = trackerByDomain.get(d) || null;
    const isPixel = pixelDomains.has(d);
    const firstContact = thirdParty && !seen.has(d);
    if (firstContact) seen.add(d);
    if (!tracker && !isPixel && !firstContact) continue;

    let title;
    if (tracker) title = `${tracker.name} fired`;
    else if (isPixel) title = `Tracking pixel: ${d}`;
    else title = `First contact: ${d}`;

    const ev = {
      time: relTime(r.timestamp, t0),
      title,
      domain: d,
      type: eventTypeFor(tracker ? tracker.category : null, isPixel),
    };
    if (r.duringConsentTransition) {
      ev.ambiguousTiming = true;
      ev.title += " (timing ambiguous: fired during consent click)";
    }
    events.push(ev);
  }
  return { t0, events };
}

function buildAuditTrail(scan, base) {
  const out = {};
  const ignore = scan.variants && scan.variants.ignore;
  const accept = scan.variants && scan.variants.accept;
  const reject = scan.variants && scan.variants.reject;

  if (ignore && ignore.preConsent) {
    const { events } = buildPhaseEvents(ignore.preConsent, base);
    out.preConsent = [
      { time: "t+0ms", title: "Page load begins", domain: base, type: "essential" },
      ...events,
    ];
  }
  if (accept && accept.postConsent) {
    const { events } = buildPhaseEvents(accept.postConsent, base);
    out.postConsent = [
      { time: "t+0ms", title: "Consent accepted", domain: base, type: "consent" },
      ...events,
    ];
  }
  if (reject && reject.postConsent) {
    const { events } = buildPhaseEvents(reject.postConsent, base);
    out.rejectConsent = [
      { time: "t+0ms", title: "Consent rejected", domain: base, type: "consent" },
      ...events,
    ];
  }
  return out;
}

// Request pulse from the accept variant (the canonical pre→post user journey).
function buildRequestPulse(scan, base) {
  const variant = (scan.variants && (scan.variants.accept || scan.variants.ignore)) || null;
  if (!variant) return [];
  const count = (phase) => {
    const m = new Map();
    for (const r of (phase && phase.networkRequests) || []) {
      const d = hostOf(r.url);
      if (!d || isFirstParty(d, base)) continue;
      m.set(d, (m.get(d) || 0) + 1);
    }
    return m;
  };
  const pre = count(variant.preConsent);
  const post = count(variant.postConsent);
  // isInfra hints come from the scanner's enriched summary when present.
  const infra = new Map();
  const vs = scan.variantSummaries && (scan.variantSummaries.accept || scan.variantSummaries.ignore);
  for (const p of (vs && vs.requestPulse) || []) infra.set(p.domain, !!p.isInfra);

  const domains = new Set([...pre.keys(), ...post.keys()]);
  return [...domains]
    .map((d) => ({
      domain: d,
      preConsent: pre.get(d) || 0,
      postConsent: post.get(d) || 0,
      total: (pre.get(d) || 0) + (post.get(d) || 0),
      isEssential: infra.get(d) || false,
    }))
    .sort((a, b) => b.total - a.total);
}

function distinctTrackers(variant) {
  const set = new Set();
  for (const phase of [variant.preConsent, variant.postConsent]) {
    for (const t of (phase && phase.trackers) || []) set.add(`${t.name}|${t.domain}`);
  }
  return set.size;
}

function distinctThirdPartyDomains(variant, base) {
  const set = new Set();
  for (const phase of [variant.preConsent, variant.postConsent]) {
    for (const r of (phase && phase.networkRequests) || []) {
      const d = hostOf(r.url);
      if (d && !isFirstParty(d, base)) set.add(d);
    }
  }
  return set.size;
}

function cookiesAtEnd(variant) {
  const post = variant.postConsent && variant.postConsent.cookies;
  if (post) return post;
  return (variant.preConsent && variant.preConsent.cookies) || [];
}

function buildVariantComparison(scan, base) {
  const variants = scan.variants || {};
  const out = {};
  for (const name of ["ignore", "accept", "reject"]) {
    const v = variants[name];
    if (!v) continue;
    out[name] = {
      trackerCount: distinctTrackers(v),
      cookieCount: cookiesAtEnd(v).length,
      thirdPartyDomainCount: distinctThirdPartyDomains(v, base),
    };
  }
  if (out.accept && out.reject) {
    const a = out.accept.trackerCount;
    const r = out.reject.trackerCount;
    if (a > 0 && r < a) {
      const pct = Math.round(((a - r) / a) * 100);
      out.verdict = r === 0
        ? `Rejecting stops all observed tracker fires (0 vs ${a} when accepting)`
        : `Rejecting reduces observed tracker fires by ${pct}% vs accepting (${r} vs ${a}), but ${r} tracker${r === 1 ? "" : "s"} still fired`;
    } else if (a === 0 && r === 0) {
      out.verdict = "No tracker fires observed in either the accept or reject variant";
    } else {
      out.verdict = `Rejecting did not reduce observed tracker fires (${r} after reject vs ${a} after accept)`;
    }
  }
  return Object.keys(out).length ? out : null;
}

function buildRejectScenario(scan) {
  const reject = scan.variants && scan.variants.reject;
  if (!reject || !reject.postConsent) return null;
  const post = reject.postConsent;

  // Domains with at least one unambiguous (non-transition) post-reject request.
  const solidDomains = new Set();
  for (const r of post.networkRequests || []) {
    const d = hostOf(r.url);
    if (d && !r.duringConsentTransition) solidDomains.add(d);
  }

  const seen = new Set();
  const persistingTrackers = [];
  for (const t of post.trackers || []) {
    const key = `${t.name}|${t.domain}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = { name: t.name, domains: t.domain, category: t.category };
    if (!solidDomains.has(t.domain)) entry.ambiguousTiming = true;
    persistingTrackers.push(entry);
  }

  const preNames = new Set(((reject.preConsent && reject.preConsent.cookies) || []).map((c) => c.name));
  const persistingCookies = (post.cookies || [])
    .filter((c) => !isConsentRecordCookie(c.name))
    .map((c) => ({
      name: c.name,
      domain: c.domain,
      purpose: "unknown",
      setBeforeConsent: preNames.has(c.name),
    }));

  const solidTrackers = persistingTrackers.filter((t) => !t.ambiguousTiming);
  const newCookies = persistingCookies.filter((c) => !c.setBeforeConsent);
  const rejectHonoured = solidTrackers.length === 0 && newCookies.length === 0;

  const parts = [];
  if (solidTrackers.length) parts.push(`${solidTrackers.length} tracker${solidTrackers.length === 1 ? "" : "s"} fired after rejection`);
  if (persistingCookies.length) parts.push(`${persistingCookies.length} non-consent cookie${persistingCookies.length === 1 ? "" : "s"} present after rejection`);
  const summary = parts.length ? parts.join("; ") : "No tracker fires or new non-consent cookies observed after rejection";

  return { rejectHonoured, summary, persistingTrackers, persistingCookies };
}

function storageEntries(obj) {
  return Object.keys(obj || {}).map((k) => ({ key: k, name: k }));
}

function buildStorageAnalysis(scan) {
  const variant = (scan.variants && (scan.variants.accept || scan.variants.ignore)) || null;
  if (!variant) return null;
  const pre = variant.preConsent || {};
  const post = variant.postConsent || {};

  const diffKeys = (preObj, postObj) =>
    Object.keys(postObj || {})
      .filter((k) => !(preObj || {})[k])
      .map((k) => ({ key: k, name: k }));

  const preIdb = ((pre.indexedDB && pre.indexedDB.databases) || []).map((db) => ({ name: db.name }));
  const preIdbNames = new Set(preIdb.map((d) => d.name));
  const postIdb = ((post.indexedDB && post.indexedDB.databases) || [])
    .filter((db) => !preIdbNames.has(db.name))
    .map((db) => ({ name: db.name }));

  const out = {
    localStorage: { preConsent: storageEntries(pre.localStorage), postConsent: diffKeys(pre.localStorage, post.localStorage) },
    sessionStorage: { preConsent: storageEntries(pre.sessionStorage), postConsent: diffKeys(pre.sessionStorage, post.sessionStorage) },
    indexedDB: { preConsent: preIdb, postConsent: postIdb },
  };
  const empty = Object.values(out).every((s) => s.preConsent.length === 0 && s.postConsent.length === 0);
  return empty ? null : out;
}

function buildPiggybackingChains(scan) {
  const seen = new Set();
  const chains = [];
  for (const v of Object.values(scan.variants || {})) {
    if (!v) continue;
    for (const phase of [v.preConsent, v.postConsent]) {
      for (const t of (phase && phase.trackers) || []) {
        if (!t.is4thParty || !t.loadedBy) continue;
        const key = `${t.loadedBy}>${t.domain}`;
        if (seen.has(key)) continue;
        seen.add(key);
        chains.push({
          chain: [
            { name: t.loadedBy, domain: t.loadedBy },
            { name: t.name, domain: t.domain },
          ],
          risk: t.category === "advertising" || t.category === "tracking" ? "high" : "medium",
        });
      }
    }
  }
  return chains;
}

function storageMechanisms(phase) {
  const m = [];
  if (((phase && phase.cookies) || []).length) m.push("cookies");
  if (Object.keys((phase && phase.localStorage) || {}).length) m.push("localStorage");
  if (Object.keys((phase && phase.sessionStorage) || {}).length) m.push("sessionStorage");
  if (((phase && phase.indexedDB && phase.indexedDB.databases) || []).length) m.push("indexedDB");
  return m;
}

function buildBeforeAfter(scan, base) {
  const variant = (scan.variants && (scan.variants.accept || scan.variants.ignore)) || null;
  if (!variant || !variant.preConsent) return null;
  const pre = variant.preConsent;
  const post = variant.postConsent || pre;
  const preCookieCount = (pre.cookies || []).length;
  const postCookieCount = (post.cookies || []).length;
  const preTrackerSet = new Set((pre.trackers || []).map((t) => `${t.name}|${t.domain}`));
  const cumulativeTrackerSet = new Set(preTrackerSet);
  for (const t of post.trackers || []) cumulativeTrackerSet.add(`${t.name}|${t.domain}`);
  const thirdParty = (phase) => {
    const s = new Set();
    for (const r of (phase && phase.networkRequests) || []) {
      const d = hostOf(r.url);
      if (d && !isFirstParty(d, base)) s.add(d);
    }
    return s;
  };
  const preTp = thirdParty(pre);
  const cumulativeTp = new Set([...preTp, ...thirdParty(post)]);

  return {
    preCookieCount,
    postCookieCount,
    preTrackerCount: preTrackerSet.size,
    postTrackerCount: cumulativeTrackerSet.size,
    preThirdPartyCount: preTp.size,
    postThirdPartyCount: cumulativeTp.size,
    preStorageMechanisms: storageMechanisms(pre),
    postStorageMechanisms: [...new Set([...storageMechanisms(pre), ...storageMechanisms(post)])],
    newCookiesDelta: postCookieCount - preCookieCount,
  };
}

function buildMethodology(scan, base) {
  const variant = (scan.variants && (scan.variants.accept || scan.variants.ignore)) || null;
  if (!variant) return null;
  const pre = variant.preConsent || {};
  const post = variant.postConsent || {};
  const tpCount = (phase) => {
    const s = new Set();
    for (const r of (phase && phase.networkRequests) || []) {
      const d = hostOf(r.url);
      if (d && !isFirstParty(d, base)) s.add(d);
    }
    return s.size;
  };
  return {
    variants: (scan.meta && scan.meta.variants) || Object.keys(scan.variants || {}),
    preCounts: {
      cookies: (pre.cookies || []).length,
      trackers: (pre.trackers || []).length,
      requests: (pre.networkRequests || []).length,
      thirdPartyDomains: tpCount(pre),
    },
    postCounts: {
      cookies: (post.cookies || []).length,
      trackers: (pre.trackers || []).length + (post.trackers || []).length,
      requests: (post.networkRequests || []).length,
      thirdPartyDomains: tpCount(post),
    },
  };
}

function deriveFindings(scan, sourcePath) {
  const base = baseDomainOf(scan.meta);
  const findings = {
    auditTrail: buildAuditTrail(scan, base),
    requestPulse: buildRequestPulse(scan, base),
    variantComparison: buildVariantComparison(scan, base),
    rejectScenario: buildRejectScenario(scan),
    storageAnalysis: buildStorageAnalysis(scan),
    piggybackingChains: buildPiggybackingChains(scan),
    beforeAfter: buildBeforeAfter(scan, base),
    methodology: buildMethodology(scan, base),
  };
  // Drop empty/null sections so the merge step never overwrites analysis
  // content with nothing.
  for (const [k, v] of Object.entries(findings)) {
    if (v == null || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)) {
      delete findings[k];
    }
  }
  return {
    _provenance: {
      generator: "derive-findings",
      scanner: (scan.meta && scan.meta.scanner) || null,
      scannedAt: (scan.meta && scan.meta.scannedAt) || null,
      url: (scan.meta && scan.meta.url) || null,
      domain: (scan.meta && scan.meta.domain) || null,
      source: sourcePath || null,
      derivedAt: new Date().toISOString(),
    },
    findings,
  };
}

module.exports = { deriveFindings };

if (require.main === module) {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith("--"));
  if (!input) {
    console.error("Usage: node scripts/derive-findings.js <raw-scan.json> [--out <path>]");
    process.exit(1);
  }
  const outIdx = args.indexOf("--out");
  const outPath = outIdx !== -1 ? args[outIdx + 1] : null;
  const scan = JSON.parse(fs.readFileSync(input, "utf8"));
  if (!scan.variants) {
    console.error("Error: input does not look like a RAW scanner JSON (missing `variants`). Pass the scan output, not the analysis JSON.");
    process.exit(1);
  }
  const result = deriveFindings(scan, input);
  const json = JSON.stringify(result, null, 2);
  if (outPath) {
    fs.writeFileSync(outPath, json);
    console.error(`Derived findings written to ${outPath}`);
  } else {
    console.log(json);
  }
}
