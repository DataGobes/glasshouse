const crypto = require('node:crypto');

function hashId(parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 10);
}

// Strip the leading dot used in cookie domain syntax (.example.com) and
// lowercase so timeline matching works across all of:
//   "ponf.linkedin.com" === "ponf.linkedin.com"
//   ".linkedin.com" ⊃ "www.linkedin.com"   (cookie domain → event hostname)
//   "www.linkedin.com" ⊃ "linkedin.com"    (event hostname → cookie domain)
function normalizeHost(h) {
  return (h || '').replace(/^\./, '').toLowerCase();
}

function timelinePointersFor(scan, domain) {
  if (!domain) return [];
  const events = (scan && scan.findings && scan.findings.auditTrail && scan.findings.auditTrail.preConsent) || [];
  const target = normalizeHost(domain);
  if (!target) return [];
  const out = [];
  for (const e of events) {
    if (!e || !e.domain) continue;
    const ev = normalizeHost(e.domain);
    if (ev === target || ev.endsWith('.' + target) || target.endsWith('.' + ev)) {
      out.push({ file: 'timeline.md', time: e.time, title: e.title, eventDomain: e.domain });
    }
  }
  return out;
}

function extractCandidates(scan) {
  const out = [];
  const f = (scan && scan.findings) || {};

  for (const t of f.trackers || []) {
    if (t.preConsent) {
      out.push({
        id: hashId(['tracker', t.domain]),
        kind: 'preConsentTracker',
        headline: `${t.domain} loaded before consent`,
        detail: `Category: ${t.category || 'unknown'}. Jurisdiction: ${t.jurisdiction || 'unknown'}. Purpose: ${t.purpose || 'not stated'}.`,
        articles: ['Art. 6', 'ePrivacy Art. 5(3)'],
        actionable: true,
        evidencePointers: [
          { file: 'trackers.csv', domain: t.domain },
          ...timelinePointersFor(scan, t.domain)
        ]
      });
    }
  }

  for (const c of f.cookies || []) {
    if (c.preConsent) {
      // ePrivacy Art. 5(3) exempts cookies "strictly necessary" for the
      // service. Treating essential/functional cookies as actionable would
      // produce false-positive complaints.
      const exempt = c.purpose === 'essential' || c.purpose === 'functional';
      out.push({
        id: hashId(['cookie', c.name, c.domain]),
        kind: 'preConsentCookie',
        headline: `Cookie ${c.name} set before consent`,
        detail: `Domain: ${c.domain}. Purpose: ${c.purpose || 'not stated'}. Duration: ${c.durationDays} days.${exempt ? ' (Likely Art. 5(3) exempt — informational only.)' : ''}`,
        articles: ['Art. 6', 'ePrivacy Art. 5(3)'],
        actionable: !exempt,
        evidencePointers: [
          { file: 'cookies.csv', name: c.name },
          ...timelinePointersFor(scan, c.domain)
        ]
      });
    }
  }

  if (f.darkPatterns && f.darkPatterns.tilt && f.darkPatterns.tilt !== 'neutral') {
    out.push({
      id: hashId(['darkPattern', f.darkPatterns.tilt]),
      kind: 'darkPattern',
      headline: `Consent banner uses dark patterns (${f.darkPatterns.tilt})`,
      detail: `Factors: ${(f.darkPatterns.factors || []).join(', ') || 'none listed'}.`,
      articles: ['Art. 7', 'EDPB Guidelines 03/2022'],
      actionable: true,
      evidencePointers: [{ file: 'screenshots/banner-viewport.png' }]
    });
  }

  if (f.consent && f.consent.rejectAccessible === false) {
    out.push({
      id: hashId(['rejectInaccessible']),
      kind: 'rejectInaccessible',
      headline: 'Reject option not accessible from the first layer',
      detail: 'The consent banner does not expose a reject control at the same level as accept.',
      articles: ['Art. 7', 'Art. 4(11)'],
      actionable: true,
      evidencePointers: [{ file: 'screenshots/banner-viewport.png' }]
    });
  }

  if (f.crossBorder && f.crossBorder.nonEuTransfersDetected) {
    out.push({
      id: hashId(['crossBorder']),
      kind: 'crossBorderTransfer',
      headline: 'Non-EU data transfers without adequate safeguards',
      detail: `DPF relied upon: ${!!f.crossBorder.dpfReliedUpon}. Other safeguards: ${(f.crossBorder.otherSafeguards || []).join(', ') || 'none'}.`,
      articles: ['Ch. V'],
      actionable: true,
      evidencePointers: [{ file: 'trackers.csv' }]
    });
  }

  if (f.legalPages && f.legalPages.privacyPolicyArticles && f.legalPages.privacyPolicyArticles.art13CoverageScore < 0.7) {
    out.push({
      id: hashId(['art13Gap']),
      kind: 'inadequatePrivacyNotice',
      headline: 'Privacy notice does not cover Art. 13 items adequately',
      detail: `Coverage score: ${f.legalPages.privacyPolicyArticles.art13CoverageScore}. Below 0.7 indicates material gaps.`,
      articles: ['Art. 13'],
      actionable: true,
      evidencePointers: []
    });
  }

  if (f.legalPages && f.legalPages.cookiePolicyFound === false) {
    out.push({
      id: hashId(['noCookiePolicy']),
      kind: 'missingCookiePolicy',
      headline: 'No cookie policy found',
      detail: 'Scanner could not identify a dedicated cookie policy.',
      articles: ['Art. 13'],
      actionable: false,
      evidencePointers: []
    });
  }

  return out;
}

function applyUserChoices(candidates, choiceMap) {
  return candidates.filter(c => choiceMap[c.id] === true);
}

module.exports = { extractCandidates, applyUserChoices };
