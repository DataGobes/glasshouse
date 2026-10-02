// tests/scan/policy-crossref-variants.test.js
//
// Regression: the legal pages are fetched only on the `ignore` variant, so the
// processor cross-reference used to see only ignore's pre-consent hosts. On a
// site with a working CMP that is the tag manager + the CMP itself; every
// processor that loads after "Accept" was missing from detectedOnSite and
// `undisclosed` came back empty. The summary now cross-references the policy
// against hosts observed in every variant, pre- and post-consent.
const { test } = require('node:test');
const assert = require('node:assert');
const {
  buildOverallDiffSummary,
  collectObservedThirdPartyDomains,
} = require('../../scripts/scan.js');

function variant({ pre = [], post = [], extra = {} } = {}) {
  return {
    consent: { detected: true, platform: 'OneTrust', darkPatterns: [] },
    preConsentTrackerCount: 0,
    postConsentNewTrackerCount: 0,
    preConsentCookieCount: 0,
    postConsentNewCookieCount: 0,
    thirdPartyDomains: pre.map(domain => ({ domain })),
    postConsentThirdPartyDomains: post.map(domain => ({ domain })),
    ...extra,
  };
}

const POLICY = 'We use Google Tag Manager and OneTrust to manage your cookie preferences. ' +
  'You have the right to access your data.';

function scanResult() {
  const ignorePolicyOnly = {
    legalPageContent: { privacyPolicy: { text: POLICY }, cookiePolicy: { text: '' } },
    securityTxt: null,
    // What the old code promoted: computed from ignore's pre-consent hosts only.
    policyAnalysis: { processors: { detectedOnSite: ['Google Tag Manager', 'OneTrust'], undisclosed: [] } },
  };
  return {
    variantSummaries: {
      ignore: variant({ pre: ['www.googletagmanager.com', 'cdn.cookielaw.org', 'geolocation.onetrust.com'], extra: ignorePolicyOnly }),
      accept: variant({
        pre: ['www.googletagmanager.com', 'geolocation.onetrust.com'],
        post: ['bat.bing.com', 'px.ads.linkedin.com', 'ct.pinterest.com', 'connect.facebook.net',
               'logx.optimizely.com', 'api.exponea.com'],
      }),
      reject: variant({ pre: ['www.googletagmanager.com'] }),
    },
  };
}

test('summary cross-references processors seen post-consent in the accept variant', () => {
  const pa = buildOverallDiffSummary(scanResult()).details.policyAnalysis;
  const detected = pa.processors.detectedOnSite;
  for (const name of ['Microsoft Advertising / Bing', 'LinkedIn Insight', 'Pinterest Tag',
                      'Meta Pixel / Facebook', 'Optimizely', 'Bloomreach / Exponea']) {
    assert.ok(detected.includes(name), `${name} detected on site`);
    assert.ok(pa.processors.undisclosed.includes(name), `${name} undisclosed (not named in policy)`);
  }
  // Named in the policy -> detected but not undisclosed
  assert.ok(detected.includes('Google Tag Manager'));
  assert.ok(!pa.processors.undisclosed.includes('Google Tag Manager'));
  assert.ok(!pa.processors.undisclosed.includes('OneTrust'));
  // Meta Pixel joint-controller scenario now fires too
  assert.ok(pa.processors.jointControllerScenarios.some(j => j.processor === 'Meta Pixel / Facebook'));
});

test('policy text and DSAR checks still come from the ignore variant', () => {
  const pa = buildOverallDiffSummary(scanResult()).details.policyAnalysis;
  assert.strictEqual(pa.policyTextAvailable, true);
  assert.strictEqual(pa.dsar.rightToAccessDisclosed, true);
});

test('collectObservedThirdPartyDomains unions and dedupes across variants and phases', () => {
  const hosts = collectObservedThirdPartyDomains(scanResult().variantSummaries).map(d => d.domain);
  // Exact sorted host list: every variant and phase, each host once.
  assert.deepStrictEqual(hosts, [
    'api.exponea.com', 'bat.bing.com', 'cdn.cookielaw.org', 'connect.facebook.net',
    'ct.pinterest.com', 'geolocation.onetrust.com', 'logx.optimizely.com',
    'px.ads.linkedin.com', 'www.googletagmanager.com',
  ]);
});

test('no legal text: processors still detected, all of them undisclosed', () => {
  const r = scanResult();
  r.variantSummaries.ignore.legalPageContent = null;
  const pa = buildOverallDiffSummary(r).details.policyAnalysis;
  assert.strictEqual(pa.policyTextAvailable, false);
  assert.ok(pa.processors.undisclosed.includes('Microsoft Advertising / Bing'));
});
