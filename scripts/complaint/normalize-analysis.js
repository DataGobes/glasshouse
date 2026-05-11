// Adapter: converts the glasshouse "analysis JSON" shape (what generate.js
// consumes for the HTML deck) into the load-scan-compatible shape that the
// complaint builder's curate-findings.js expects.
//
// The two shapes diverged historically: the analysis JSON encodes pre/post
// consent via tracker.tier ("active" | "gated" | "csp") and cookie.phase
// ("pre" | "post"), and stores legalPages as an array, while the complaint
// builder expects explicit `preConsent` booleans and a single legalPages
// object. This module reconciles them. Idempotent: if the input already
// has the target shape, returns it unchanged.

const COUNTRY_FROM_LOCALE = {
  Ireland: 'IE', Netherlands: 'NL', France: 'FR',
  Germany: 'DE', 'United Kingdom': 'GB', 'United States': 'US',
  Belgium: 'BE', Luxembourg: 'LU', Spain: 'ES', Italy: 'IT'
};

const EMAIL_RE = /([\w.+-]+@[\w-]+\.[\w.-]+)/;

function isAlreadyNormalized(scan) {
  if (!scan || !scan.meta || scan.meta.schemaVersion !== '1') return false;
  const trackers = scan.findings && scan.findings.trackers;
  if (!Array.isArray(trackers) || trackers.length === 0) return true;
  return trackers[0].preConsent !== undefined && typeof trackers[0].domain === 'string';
}

function mapTiltClass(cls) {
  if (!cls || /balanced/.test(cls)) return 'neutral';
  if (/heavy-tilt/.test(cls)) return 'strong-accept';
  if (/heavy-accept|tilted-accept/.test(cls)) return 'strong-accept';
  if (/heavy-reject|tilted-reject/.test(cls)) return 'strong-reject';
  return 'neutral';
}

function normalizeTrackers(trackers) {
  return (trackers || []).map((t) => {
    const firstDomain = typeof t.domains === 'string'
      ? t.domains.split(',')[0].trim()
      : Array.isArray(t.domains) ? t.domains[0] : (t.domain || '');
    return {
      ...t,
      domain: firstDomain,
      preConsent: t.tier === 'active',
      jurisdiction: t.jurisdiction,
      category: t.category,
      purpose: t.purpose || t.name || t.category,
      dpfCertified: t.risk === 'dpf'
    };
  });
}

function normalizeCookies(cookies, targetDomain) {
  const bare = (targetDomain || '').replace(/^www\./, '');
  return (cookies || []).map((c) => ({
    ...c,
    preConsent: c.phase === 'pre',
    firstParty: c.domain ? c.domain.replace(/^\./, '').endsWith(bare) : false
  }));
}

function normalizeDarkPatterns(dp) {
  if (!dp) return undefined;
  const tilt = mapTiltClass(dp.tiltClass);
  const factors = [];
  for (const f of (dp.acceptFactors || []).concat(dp.rejectFactors || [])) {
    if (f && f.status === 'bad') factors.push(`${f.name}: ${f.value}`);
  }
  return { ...dp, tilt, factors };
}

function normalizeConsent(consent) {
  if (!consent) return undefined;
  const hasReject = !!(consent.rejectText && String(consent.rejectText).trim());
  const symmetric = consent.isAsymmetric === false;
  return {
    ...consent,
    bannerDetected: !!consent.detected,
    rejectAccessible: hasReject && symmetric,
    cmpPlatform: consent.platform
  };
}

function normalizeCrossBorder(thirdPartyDomains, existing) {
  if (existing && typeof existing.nonEuTransfersDetected === 'boolean') return existing;
  const list = thirdPartyDomains || [];
  const nonEu = list.some((d) => d.jurisdiction && d.jurisdiction !== 'EU' && d.jurisdiction !== 'EEA');
  const dpf = list.some((d) => d.risk === 'dpf');
  return { nonEuTransfersDetected: nonEu, dpfReliedUpon: dpf, otherSafeguards: [] };
}

function normalizeLegalPages(legalPages, privacyPolicyAnalysis) {
  if (legalPages && !Array.isArray(legalPages)) return legalPages;
  const arr = legalPages || [];
  const titleMatches = (entry, kw) =>
    entry && entry.status === 'present' && entry.title && entry.title.toLowerCase().includes(kw);
  const ppa = privacyPolicyAnalysis || [];
  const present = ppa.filter((e) => e.status === 'present').length;
  return {
    privacyPolicyFound: arr.some((e) => titleMatches(e, 'privacy')),
    cookiePolicyFound: arr.some((e) => titleMatches(e, 'cookie')),
    privacyPolicyArticles: {
      art13CoverageScore: ppa.length ? present / ppa.length : 0
    }
  };
}

function parseControllerExcerpt(excerpt) {
  if (!excerpt) return null;
  const parts = excerpt.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { registeredName: parts[0] || '', country: '' };
  const name = parts[0];
  const country = parts[parts.length - 1];
  const postalAddress = parts.slice(1).join(', ');
  return { registeredName: name, country, postalAddress };
}

function normalizeController(scan) {
  const existing = scan.findings && scan.findings.controller;
  if (existing && existing.registeredName) return existing;

  const ppa = (scan.findings && scan.findings.privacyPolicyAnalysis) || [];
  const ctrl = ppa.find((e) => /controller identity/i.test(e.element || ''));
  const dpo = ppa.find((e) => /dpo/i.test(e.element || ''));
  const legal = scan.findings && scan.findings.legalPages;
  const privacyEntry = Array.isArray(legal)
    ? legal.find((e) => e && e.title && /privacy/i.test(e.title))
    : null;

  const parsed = parseControllerExcerpt(ctrl && ctrl.excerpt);
  if (!parsed) return undefined;
  const countryName = parsed.country;
  const countryCode = COUNTRY_FROM_LOCALE[countryName] || (countryName && countryName.length === 2 ? countryName.toUpperCase() : '');
  const dpoMatch = (dpo && dpo.excerpt && dpo.excerpt.match(EMAIL_RE)) || null;

  return {
    registeredName: parsed.registeredName,
    country: countryCode,
    postalAddress: parsed.postalAddress || '',
    imprintUrl: (privacyEntry && privacyEntry.url) || '',
    dpoEmail: dpoMatch ? dpoMatch[1] : ''
  };
}

function normalizeAnalysis(scan) {
  if (isAlreadyNormalized(scan)) return scan;
  const targetDomain = (scan && scan.meta && scan.meta.domain) || '';
  const f = (scan && scan.findings) || {};
  return {
    ...scan,
    meta: { schemaVersion: '1', ...(scan.meta || {}) },
    findings: {
      ...f,
      trackers: normalizeTrackers(f.trackers),
      cookies: normalizeCookies(f.cookies, targetDomain),
      darkPatterns: normalizeDarkPatterns(f.darkPatterns) || f.darkPatterns,
      consent: normalizeConsent(f.consent) || f.consent,
      crossBorder: normalizeCrossBorder(f.thirdPartyDomains, f.crossBorder),
      legalPages: normalizeLegalPages(f.legalPages, f.privacyPolicyAnalysis),
      controller: normalizeController(scan) || f.controller
    }
  };
}

module.exports = { normalizeAnalysis };
