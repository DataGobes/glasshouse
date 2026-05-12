const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { normalizeAnalysis } = require('../../scripts/complaint/normalize-analysis');

const fixture = require(path.join(__dirname, '..', 'fixtures', 'sample-scan.json'));

test('normalizeAnalysis is a no-op on an already-normalized scan', () => {
  const out = normalizeAnalysis(fixture);
  assert.equal(out.meta.schemaVersion, '1');
  assert.equal(out.findings.trackers[0].preConsent, true);
  assert.equal(out.findings.trackers[0].domain, 'google-analytics.com');
});

test('normalizeAnalysis adds schemaVersion when missing', () => {
  const legacy = { meta: { domain: 'example.test' }, findings: {} };
  const out = normalizeAnalysis(legacy);
  assert.equal(out.meta.schemaVersion, '1');
});

test('normalizeAnalysis maps tracker.tier and splits domains', () => {
  const legacy = {
    meta: { domain: 'x.test' },
    findings: {
      trackers: [
        { name: 'Adobe', tier: 'active', domains: 'dpm.demdex.net, lnkd.demdex.net', category: 'Data Management', jurisdiction: 'US' },
        { name: 'Meta', tier: 'gated', domains: 'www.facebook.com', category: 'Advertising', jurisdiction: 'US' }
      ]
    }
  };
  const out = normalizeAnalysis(legacy);
  assert.equal(out.findings.trackers[0].preConsent, true);
  assert.equal(out.findings.trackers[0].domain, 'dpm.demdex.net');
  assert.equal(out.findings.trackers[1].preConsent, false);
  assert.equal(out.findings.trackers[1].domain, 'www.facebook.com');
});

test('normalizeAnalysis maps cookie.phase to preConsent', () => {
  const legacy = {
    meta: { domain: 'x.test' },
    findings: {
      cookies: [
        { name: 'bcookie', domain: '.linkedin.com', phase: 'pre', purpose: 'tracking', durationDays: 365 },
        { name: 'lang', domain: '.linkedin.com', phase: 'pre', purpose: 'essential', durationDays: 0 }
      ]
    }
  };
  const out = normalizeAnalysis(legacy);
  assert.equal(out.findings.cookies[0].preConsent, true);
  assert.equal(out.findings.cookies[1].preConsent, true);
  assert.equal(out.findings.cookies[0].purpose, 'tracking');
});

test('normalizeAnalysis maps darkPatterns.tiltClass to tilt', () => {
  for (const [cls, expected] of [
    ['fs-bar-balanced', 'neutral'],
    ['fs-bar-tilted-accept', 'strong-accept'],
    ['fs-bar-heavy-accept', 'strong-accept'],
    ['fs-bar-tilted-reject', 'strong-reject'],
    ['fs-bar-heavy-tilt', 'strong-accept']
  ]) {
    const out = normalizeAnalysis({ meta: { domain: 'x.test' }, findings: { darkPatterns: { tiltClass: cls } } });
    assert.equal(out.findings.darkPatterns.tilt, expected, `${cls} should map to ${expected}`);
  }
});

test('normalizeAnalysis derives consent.rejectAccessible from accept/reject buttons', () => {
  const both = normalizeAnalysis({ meta: { domain: 'x.test' }, findings: { consent: { detected: true, acceptText: 'Accept', rejectText: 'Reject', isAsymmetric: false } } });
  assert.equal(both.findings.consent.rejectAccessible, true);

  const noReject = normalizeAnalysis({ meta: { domain: 'x.test' }, findings: { consent: { detected: true, acceptText: 'Accept', rejectText: null } } });
  assert.equal(noReject.findings.consent.rejectAccessible, false);
});

test('normalizeAnalysis derives crossBorder from thirdPartyDomains', () => {
  const legacy = {
    meta: { domain: 'x.test' },
    findings: {
      thirdPartyDomains: [
        { domains: 'google.com', jurisdiction: 'US', risk: 'dpf' },
        { domains: 'trkn.us', jurisdiction: 'US', risk: 'risk' }
      ]
    }
  };
  const out = normalizeAnalysis(legacy);
  assert.equal(out.findings.crossBorder.nonEuTransfersDetected, true);
  assert.equal(out.findings.crossBorder.dpfReliedUpon, true);
});

test('normalizeAnalysis derives legalPages object + art13CoverageScore', () => {
  const legacy = {
    meta: { domain: 'x.test' },
    findings: {
      legalPages: [
        { title: 'Privacy Policy', status: 'present' },
        { title: 'Cookie Policy', status: 'present' }
      ],
      privacyPolicyAnalysis: [
        { element: 'Controller identity', status: 'present' },
        { element: 'DPO contact', status: 'present' },
        { element: 'Processing purposes', status: 'absent' }
      ]
    }
  };
  const out = normalizeAnalysis(legacy);
  assert.equal(out.findings.legalPages.privacyPolicyFound, true);
  assert.equal(out.findings.legalPages.cookiePolicyFound, true);
  assert.equal(out.findings.legalPages.privacyPolicyArticles.art13CoverageScore, 2 / 3);
});

test('normalizeAnalysis derives controller from privacyPolicyAnalysis Controller identity', () => {
  const legacy = {
    meta: { domain: 'linkedin.com' },
    findings: {
      privacyPolicyAnalysis: [
        { element: 'Controller identity', status: 'present', excerpt: 'LinkedIn Ireland Unlimited Company, Wilton Place, Dublin 2, Ireland' }
      ],
      legalPages: [{ title: 'Privacy Policy', status: 'present', url: 'https://www.linkedin.com/legal/privacy-policy' }]
    }
  };
  const out = normalizeAnalysis(legacy);
  assert.equal(out.findings.controller.registeredName, 'LinkedIn Ireland Unlimited Company');
  assert.equal(out.findings.controller.country, 'IE');
  assert.equal(out.findings.controller.imprintUrl, 'https://www.linkedin.com/legal/privacy-policy');
});

test('normalizeAnalysis prefers meta.company over excerpt parsing', () => {
  const scan = {
    meta: { domain: 'nu.nl', company: 'DPG Media Magazines B.V.' },
    findings: {
      privacyPolicyAnalysis: [
        { element: 'Controller identity', status: 'present', excerpt: 'DPG Media, Amsterdam, Netherlands' }
      ],
      legalPages: []
    }
  };
  const out = normalizeAnalysis(scan);
  assert.equal(out.findings.controller.registeredName, 'DPG Media Magazines B.V.');
});

test('normalizeAnalysis rejects descriptive prose as a company name', () => {
  // The bug we are fixing: a multi-sentence analyst note ended up as
  // registeredName because parseControllerExcerpt split on commas and took
  // the first chunk verbatim.
  const scan = {
    meta: { domain: 'nu.nl' },
    findings: {
      privacyPolicyAnalysis: [
        {
          element: 'Controller identity',
          status: 'present',
          excerpt: 'DPG Media named throughout. Policy clarifies CMP ID 411 and use of OneTrust (28).'
        }
      ],
      legalPages: []
    }
  };
  const out = normalizeAnalysis(scan);
  assert.equal(out.findings.controller, undefined, 'descriptive prose must not become a controller name');
});

test('normalizeAnalysis rejects an overlong single-segment excerpt as a name', () => {
  const longName = 'A'.repeat(90);
  const scan = {
    meta: { domain: 'x.test' },
    findings: {
      privacyPolicyAnalysis: [
        { element: 'Controller identity', status: 'present', excerpt: longName }
      ],
      legalPages: []
    }
  };
  const out = normalizeAnalysis(scan);
  assert.equal(out.findings.controller, undefined);
});
