#!/usr/bin/env node
/**
 * Generate a condensed analysis brief from a privacy scan JSON.
 *
 * Outputs structured plain text (~3-5K chars) instead of the full summary
 * JSON (~100-200K chars). Contains everything needed to write the analysis
 * JSON without reading the raw scan data in multiple chunk calls.
 *
 * Usage: node analysis-brief.js <scan.json>
 *
 * Reads either a raw scan JSON or an extracted summary JSON.
 * Output goes to stdout.
 */

const fs = require("fs");

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node analysis-brief.js <scan.json>");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

// Handle both raw scan JSON and extracted summary JSON
const meta = raw.meta;
const summary = raw.summary;
const details = summary?.details || {};
const varComp = summary?.variantComparison || {};
const darkPatterns = summary?.darkPatterns || [];

const out = [];
const ln = (s = "") => out.push(s);
const section = (title) => { ln(); ln(`=== ${title} ===`); };

// ── Meta ──
section("META");
ln(`Domain: ${meta.domain}`);
ln(`URL: ${meta.url}`);
ln(`Scanned: ${meta.scannedAt}`);
ln(`Variants: ${meta.variants?.join(", ") || "unknown"}`);

// ── Consent ──
section("CONSENT");
const consent = details.consent || summary?.consent || {};
ln(`Detected: ${consent.detected ?? summary?.consentDetected ?? "unknown"}`);
ln(`Platform: ${consent.platform || summary?.platform || "none"}`);
ln(`Via cookie wall: ${consent.viaCookieWall ?? false}`);

// Reject path — read the *reject* variant for the user-facing assessment.
// On the accept variant (which feeds `details`), rejectAccessibility always
// reflects what the scanner did (accept on layer 1), not what a real user
// rejecting would face. The reject variant is the authoritative signal.
const rejectConsent = raw.variants?.reject?.consent;
if (rejectConsent) {
  ln(`Reject path: ${rejectConsent.rejectAccessibility || "unknown"} (multiLayer=${rejectConsent.multiLayer ?? false})`);
  if (rejectConsent.multiLayer) {
    ln(`  Layer-2 method: ${rejectConsent.multiLayerMethod || "unknown"}`);
    ln(`  NOTE: reject required opening "Manage settings" / layer 2 — flag this as a dark pattern (Hidden Defaults / Multi-Layer Consent, CNIL Bing 2022 precedent).`);
  } else if (rejectConsent.rejectAccessibility === "not-found") {
    ln(`  NOTE: banner detected but no reject path found, even after attempting layer-2 traversal.`);
  }
}

if (details.cookieWall || summary?.cookieWall) {
  const cw = details.cookieWall || summary.cookieWall;
  ln(`Cookie wall: ${cw.detected ? `YES (${cw.type}, ${cw.name})` : "no"}`);
  ln(`  Bypassed: ${cw.bypassed ?? cw.bypassSuccess ?? "unknown"} (${cw.method || "n/a"})`);
  // Wall path multiLayer info lives on the reject variant's cookieWall obj.
  const rejectWall = raw.variants?.reject?.cookieWall;
  if (rejectWall?.multiLayer?.attempted) {
    ln(`  Reject required multi-layer traversal: settings=${rejectWall.multiLayer.settingsFound} method=${rejectWall.multiLayer.layer2Method}`);
  }
}
if (darkPatterns.length) {
  ln(`Dark patterns: ${darkPatterns.map(d => d.type).join(", ")}`);
  darkPatterns.forEach(d => ln(`  - ${d.type}: ${d.description}`));
}

// ── Counts ──
section("COUNTS");
ln(`Pre-consent:  ${details.preConsentTrackerCount ?? "?"} trackers, ${details.preConsentCookieCount ?? "?"} cookies, ${details.preConsentSdkLoadCount ?? "?"} SDK loads, ${details.preConsentConsentModePingCount ?? "?"} consent-mode pings`);
ln(`Post-consent: ${details.postConsentNewTrackerCount ?? "?"} new trackers, ${details.postConsentNewCookieCount ?? "?"} new cookies`);
ln(`Third-party domains: ${details.thirdPartyDomainCount ?? "?"}`);
ln(`Piggybacking chains: ${details.piggybackingCount ?? 0}`);
ln(`Tracking pixels: ${details.trackingPixelCount ?? 0}`);
ln(`Security headers: ${details.securityHeaderScore ?? "?"}`);

// ── Tracker vs Consent Timing (from raw request timestamps) ──
if (raw.variants?.ignore?.preConsent?.networkRequests?.length) {
  const reqs = raw.variants.ignore.preConsent.networkRequests;
  const t0 = Math.min(...reqs.map(r => r.timestamp).filter(Boolean));
  if (t0 && t0 < Infinity) {
    const trackerNames = new Set((raw.variants.ignore.preConsent.trackers || []).map(t => {
      try { return new URL(t.url).hostname; } catch { return null; }
    }).filter(Boolean));
    const cmpPatterns = /cookielaw|onetrust|consent|didomi|quantcast|usercentrics|trustarc/;

    const trackerHits = reqs.filter(r => {
      try { return trackerNames.has(new URL(r.url).hostname); } catch { return false; }
    });
    const cmpHits = reqs.filter(r => cmpPatterns.test(r.url));

    if (trackerHits.length || cmpHits.length) {
      section("TRACKER vs CONSENT TIMING (verified from raw timestamps)");
      ln("USE THESE TIMESTAMPS in your analysis — do NOT fabricate timing values.");
      ln("");
      if (cmpHits.length) {
        const firstCmp = cmpHits[0];
        ln(`First CMP request: t+${firstCmp.timestamp - t0}ms | ${new URL(firstCmp.url).hostname} | ${firstCmp.resourceType}`);
      } else {
        ln("First CMP request: NOT FOUND");
      }
      if (trackerHits.length) {
        const firstTracker = trackerHits[0];
        ln(`First tracker request: t+${firstTracker.timestamp - t0}ms | ${new URL(firstTracker.url).hostname} | ${firstTracker.resourceType}`);
      }
      ln("");
      const combined = [...trackerHits, ...cmpHits]
        .map(r => ({ ...r, delta: r.timestamp - t0, host: new URL(r.url).hostname }))
        .sort((a, b) => a.delta - b.delta)
        .slice(0, 20);
      for (const r of combined) {
        const label = trackerNames.has(r.host) ? "TRACKER" : "CMP";
        ln(`t+${r.delta}ms | ${label.padEnd(8)} | ${r.resourceType.padEnd(10)} | ${r.host}`);
      }
    }
  }
}

// ── Variant Comparison ──
if (varComp.trackers || varComp.cookies) {
  section("VARIANT COMPARISON");
  const t = varComp.trackers || {};
  const c = varComp.cookies || {};
  ln(`          | Trackers (pre→post) | Cookies (pre→post)`);
  ln(`Ignore:   | ${t.ignorePhase1 ?? "?"}→${t.ignorePhase2 ?? "?"}           | ${c.ignorePhase1 ?? "?"}→${c.ignorePhase2 ?? "?"}`);
  ln(`Accept:   | -→${t.acceptPhase2 ?? "?"}               | -→${c.acceptPhase2 ?? "?"}`);
  ln(`Reject:   | -→${t.rejectPhase2 ?? "?"}               | -→${c.rejectPhase2 ?? "?"}`);
}

// ── Pre-consent Trackers ──
section("PRE-CONSENT TRACKERS");
const preTrackers = details.preConsentTrackers || [];
if (!preTrackers.length) {
  ln("(none)");
} else {
  preTrackers.forEach(t => {
    ln(`${t.name} | ${t.domain} | ${t.count}x ${t.resourceType} | ${t.jurisdiction || "?"} | ${t.transferRisk || "?"} | 4th-party: ${t.is4thParty ? `YES (via ${t.loadedBy || "?"})` : "no"}`);
  });
}

// ── Pre-consent SDK Loads ──
if (details.preConsentSdkLoads?.length) {
  section("PRE-CONSENT SDK LOADS");
  details.preConsentSdkLoads.forEach(s => ln(`${s.name} (${s.category}) | ${s.count}x`));
}

// ── Pre-consent Cookies ──
section(`PRE-CONSENT COOKIES (${details.preConsentCookieCount ?? "?"})`);
(details.preConsentCookies || []).forEach(c => {
  ln(`${c.name} | ${c.domain} | ${c.durationLabel} (${c.durationDays}d) | ${c.purpose} | ${c.secure ? "secure" : "insecure"}`);
});

// ── Post-consent Cookies ──
const postCookies = details.newPostConsentCookies || [];
section(`POST-CONSENT NEW COOKIES (${postCookies.length})`);
postCookies.forEach(c => {
  ln(`${c.name} | ${c.domain} | ${c.durationLabel} (${c.durationDays}d) | ${c.purpose} | ${c.secure ? "secure" : "insecure"}`);
});

// ── Post-consent Trackers ──
const postTrackers = details.postConsentTrackers || [];
section(`POST-CONSENT TRACKERS (${postTrackers.length})`);
postTrackers.forEach(t => {
  ln(`${t.name} | ${t.domain} | ${t.count}x ${t.resourceType} | ${t.jurisdiction || "?"} | ${t.transferRisk || "?"}`);
});

// ── Third-party Domains (pre-consent) ──
const preDomains = details.thirdPartyDomains || [];
section(`PRE-CONSENT THIRD-PARTY DOMAINS (${preDomains.length})`);
preDomains.forEach(d => {
  ln(`${d.domain} | ${d.requests} req | ${d.jurisdiction || "?"} | ${d.transferRisk || "?"} | ${d.company || ""}`);
});

// ── Post-consent Third-party Domains (top 25) ──
const postDomains = details.postConsentThirdPartyDomains || [];
section(`POST-CONSENT THIRD-PARTY DOMAINS (${postDomains.length}, showing top 25)`);
postDomains.slice(0, 25).forEach(d => {
  ln(`${d.domain} | ${d.requests} req | ${d.jurisdiction || "?"} | ${d.transferRisk || "?"} | ${d.company || ""}`);
});
if (postDomains.length > 25) ln(`(+ ${postDomains.length - 25} more)`);

// ── Request Pulse (top 20) ──
const pulse = details.requestPulse || [];
section(`REQUEST PULSE (${pulse.length}, showing top 20)`);
pulse.slice(0, 20).forEach(r => {
  ln(`${r.domain} | pre:${r.preConsent} post:${r.postConsent} total:${r.total}${r.isInfra ? " [infra]" : ""}`);
});
if (pulse.length > 20) ln(`(+ ${pulse.length - 20} more)`);

// ── Security ──
section("SECURITY");
const sh = details.securityHeaders || {};
if (sh.present) {
  ln(`Present: ${sh.present.map(h => `${h.name}: ${h.value}`).join(" | ")}`);
  ln(`Missing: ${(sh.missing || []).join(", ")}`);
}
const si = details.scriptIntegrity || {};
if (si.totalExternal != null) ln(`SRI: ${si.withIntegrity}/${si.totalExternal} (${si.coveragePercent}%)`);
const cors = details.cors || {};
if (cors.allowOrigin) ln(`CORS: origin=${cors.allowOrigin} wildcard=${cors.isWildcard} credWithWild=${cors.hasCredentialsWithWildcard}`);
const tls = details.tls || {};
if (tls.protocol) ln(`TLS: ${tls.protocol} ${tls.cipher} issuer=${tls.issuer} validTo=${tls.validTo}`);

// ── Extended Detection ──
section("EXTENDED DETECTION");
const tcf = details.tcf || {};
ln(`TCF: ${tcf.detected ? "detected" : "not detected"}`);
const gcm = details.googleConsentMode || {};
ln(`Google Consent Mode: ${gcm.detected ? "detected" : "not detected"}`);
const gpc = details.gpc || {};
ln(`GPC: sent=${gpc.signalSent ?? "?"} siteReads=${gpc.siteReadsSignal ?? "?"}`);
const fp = details.fingerprinting || {};
ln(`Fingerprinting: ${fp.detected ? `YES (pre-consent: ${fp.preConsent})` : "not detected"}`);
if (fp.apiCalls?.length) {
  fp.apiCalls.forEach(a => ln(`  ${a.api}.${a.method} | ${a.count}x | caller: ${a.callerUrl?.substring(0, 80) || "?"}`));
}
if (fp.callerDomains?.length) ln(`  Caller domains: ${fp.callerDomains.join(", ")}`);
// ── Fingerprinting (NEW tiered model) ──
if (fp.stackedSignals && fp.stackedSignals.length) {
  ln(`\n--- Fingerprinting (tiered) ---`);
  ln(`Active fingerprinting domains: ${fp.stackedSignals.length}`);
  fp.stackedSignals.forEach(s => {
    const tag = s.preConsent ? " [pre-consent]" : "";
    const sdk = (fp.commercialSdks || []).find(c => (c.domains || []).some(d => s.callerDomain === d || s.callerDomain.endsWith("." + d)));
    const sdkTag = sdk ? ` [commercial SDK: ${sdk.name}]` : "";
    ln(`  ${s.callerDomain}: ${s.tier1Count} Tier-1 + ${s.tier2Count} Tier-2 (${s.verdict})${tag}${sdkTag}`);
    ln(`    APIs: ${(s.apis || []).join(", ")}`);
  });
}
if (fp.tier3Appendix && fp.tier3Appendix.length) {
  ln(`Tier 3 informational signals: ${fp.tier3Appendix.length} (private appendix only)`);
}
if (fp.outOfScopeCaveats && fp.outOfScopeCaveats.length) {
  ln(`Out-of-scope caveats: ${fp.outOfScopeCaveats.length} (TLS/QUIC/CSS-timing not detectable in JS)`);
}
if (fp.stackedSignals?.length || fp.commercialSdks?.length) {
  ln(`\n>>> LLM analyst: fill stackedSignals[*].rationale, .legitimateBasisClaim, and .purposeDisclosed`);
  ln(`>>> by reading the privacy policy. Same for commercialSdks[*].`);
}
const fl = details.formLeakage || {};
ln(`Form leakage: ${fl.leaks?.length ? `YES (${fl.leaks.length} leaks)` : "none"}`);
const cr = details.consentRevocation || {};
ln(`Consent revocation: mechanism=${cr.mechanismFound ?? "?"} type=${cr.mechanismType ?? "?"}`);
if (cr.mechanismFound) {
  ln(`  Accept clicks: ${cr.acceptanceClicks} Revoke clicks: ${cr.revocationClicks}`);
  ln(`  Cookies deleted after revoke: ${cr.trackingCookiesDeleted}`);
}
const cg = details.consentGranularity;
ln(`Consent granularity: ${cg ? JSON.stringify(cg) : "null"}`);

// ── Storage ──
const preLS = details.preConsentLocalStorage || [];
const postLS = details.postConsentLocalStorage || [];
const preIDB = details.preConsentIndexedDB || [];
const postIDB = details.postConsentIndexedDB || [];
if (preLS.length || postLS.length || preIDB.length || postIDB.length) {
  section("STORAGE");
  if (preLS.length) ln(`Pre-consent localStorage: ${preLS.join(", ")}`);
  if (postLS.length) ln(`Post-consent localStorage: ${postLS.join(", ")}`);
  if (preIDB.length) ln(`Pre-consent IndexedDB: ${preIDB.map(d => d.name).join(", ")}`);
  if (postIDB.length) ln(`Post-consent IndexedDB: ${postIDB.map(d => d.name).join(", ")}`);
}

// ── Legal Pages ──
section("LEGAL PAGES");
(details.legalPages || []).forEach(p => {
  ln(`${p.type} | ${p.text || "(no text)"} | ${p.url}`);
});

// ── Legal Page Content ──
const lpc = details.legalPageContent || {};
if (lpc.privacyPolicy?.text || lpc.cookiePolicy?.text) {
  section("LEGAL PAGE CONTENT");
  if (lpc.privacyPolicy?.text) {
    ln(`Privacy policy (${lpc.privacyPolicy.charCount} chars, from ${lpc.privacyPolicy.url}):`);
    // First 3000 chars — enough for Art. 13 analysis
    ln(lpc.privacyPolicy.text.substring(0, 3000));
    if (lpc.privacyPolicy.text.length > 3000) ln(`... (truncated, ${lpc.privacyPolicy.text.length - 3000} more chars)`);
  }
  if (lpc.cookiePolicy?.text) {
    ln();
    ln(`Cookie policy (${lpc.cookiePolicy.charCount} chars, from ${lpc.cookiePolicy.url}):`);
    ln(lpc.cookiePolicy.text.substring(0, 3000));
    if (lpc.cookiePolicy.text.length > 3000) ln(`... (truncated, ${lpc.cookiePolicy.text.length - 3000} more chars)`);
  }
}

// ── Policy Analysis (DSAR / processors / breach / opt-out) ──
const pa = details.policyAnalysis || {};
if (pa.policyTextAvailable) {
  section("POLICY ANALYSIS");
  // DSAR
  const d = pa.dsar || {};
  ln(`DSAR contact: ${d.contactPresent ? `${d.contactType}${d.contactEvidence ? ` (${d.contactEvidence})` : ""}` : "NOT FOUND"}`);
  ln(`Dedicated rights page mentioned: ${d.dedicatedPagePresent}`);
  ln(`30-day response commitment: ${d.responseCommitmentDays === 30 ? "YES" : "no"}`);
  ln(`Rights disclosed: access=${d.rightToAccessDisclosed} erasure=${d.rightToErasureDisclosed} portability=${d.portabilityDisclosed} object(art21)=${d.art21Disclosed} complainDPA=${d.complainToDpaDisclosed}`);
  if (d.disproportionateBurdenFlags?.length) ln(`DSAR burden flags: ${d.disproportionateBurdenFlags.join("; ")}`);
  // Processors
  const p = pa.processors || {};
  ln(`Processors named in policy (${(p.namedInPolicy || []).length}): ${(p.namedInPolicy || []).map(x => `${x.name}[${x.jurisdiction}]`).join(", ") || "none"}`);
  ln(`Processors detected on site (${(p.detectedOnSite || []).length}): ${(p.detectedOnSite || []).join(", ") || "none"}`);
  ln(`Undisclosed processors (detected but not named): ${(p.undisclosed || []).join(", ") || "none"}`);
  ln(`DPA reference in policy: ${p.dpaReferenced} | sub-processors disclosed: ${p.subProcessorsDisclosed}`);
  if (p.jointControllerScenarios?.length) {
    p.jointControllerScenarios.forEach(jc => ln(`Joint controller: ${jc.processor} (${jc.type}) — disclosed: ${jc.disclosed}`));
  }
  // Breach notification
  const b = pa.breach || {};
  ln(`security.txt: ${b.securityTxtPresent ? `present${b.securityTxtExpired === true ? " (EXPIRED)" : b.securityTxtExpired === false ? " (current)" : ""}` : "absent"}`);
  if (b.securityTxtPresent && Object.keys(b.securityTxtFields || {}).length) {
    ln(`  fields: ${Object.keys(b.securityTxtFields).join(", ")}`);
  }
  ln(`72h DPA notification commitment: ${b.dpaNotificationCommitment} | individual notification (Art.34): ${b.individualNotificationCommitment}`);
  if (b.delayTacticLanguage?.length) ln(`Delay-tactic phrases: ${b.delayTacticLanguage.join(" | ")}`);
  // Opt-out
  const oo = pa.optOut || {};
  ln(`Opt-out: unsubscribe=${oo.unsubscribeMentioned} art21=${oo.art21Disclosed} withdrawAsEasy=${oo.withdrawAsEasyAsConsent} legitInterestObjection=${oo.legitimateInterestsObjectionContact} preferenceCenter=${oo.preferenceCenterMentioned}`);
} else if (details.legalPageContent?.privacyPolicy?.text) {
  // Policy text was fetched but analysis didn't run for some reason — surface that
  section("POLICY ANALYSIS");
  ln(`Skipped: ${pa.error || "policyAnalysis missing on summary"}`);
}

// ── Significant Events (timeline) ──
const events = details.significantEvents || [];
const preEvents = events.filter(e => e.phase === "pre");
const postEvents = events.filter(e => e.phase === "post");
section(`TIMELINE: PRE-CONSENT (${preEvents.length} events)`);
preEvents.forEach(e => {
  const flags = [e.isTracker && "TRACKER", e.isPixel && "PIXEL", e.isFirstContact && "first-contact"].filter(Boolean).join(", ");
  ln(`${e.time} | ${e.domain} | ${e.resourceType}${flags ? ` | ${flags}` : ""}`);
});
section(`TIMELINE: POST-CONSENT (${postEvents.length} events, showing first 30)`);
postEvents.slice(0, 30).forEach(e => {
  const flags = [e.isTracker && "TRACKER", e.isPixel && "PIXEL", e.isFirstContact && "first-contact"].filter(Boolean).join(", ");
  ln(`${e.time} | ${e.domain} | ${e.resourceType}${flags ? ` | ${flags}` : ""}`);
});
if (postEvents.length > 30) ln(`(+ ${postEvents.length - 30} more)`);

// ── Tracking Pixels ──
const pixels = details.trackingPixels || [];
if (pixels.length) {
  section(`TRACKING PIXELS (${pixels.length})`);
  pixels.forEach(p => ln(`${p.domain} | ${p.beaconType} | ${p.url.substring(0, 120)}`));
}

// ── Errors ──
const errors = details.errors || summary?.errors || raw.errors;
if (errors?.length) {
  section("ERRORS");
  errors.forEach(e => ln(typeof e === "string" ? e : JSON.stringify(e)));
}

// ── Output ──
const brief = out.join("\n");
process.stdout.write(brief);

// Stats to stderr
const inputSize = fs.statSync(inputPath).size;
process.stderr.write(`\nBrief: ${brief.length} chars from ${(inputSize / 1024).toFixed(0)}KB input (${((1 - brief.length / inputSize) * 100).toFixed(0)}% reduction)\n`);
