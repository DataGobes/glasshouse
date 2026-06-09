const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { crossCheck, expectedOverallScore } = require('../../scripts/cross-check.js');

const scan = require(path.join(__dirname, '..', 'fixtures', 'raw-scan-sample.json'));

function goodAnalysis() {
  return {
    meta: { domain: 'example.com', overallScore: 4.2 },
    scores: {
      consent: { score: 5.0 }, preConsentTracking: { score: 3.0 }, legalPages: { score: 5.0 },
      crossBorder: { score: 4.0 }, securityHeaders: { score: 6.0 }, cookieManagement: { score: 4.0 },
      darkPatterns: { score: 5.0 }, dsar: { score: 5.0 }, processorTransparency: { score: 4.0 },
    },
    findings: {
      trackers: [
        { name: 'DoubleClick Ad', tier: 'active', status: 'Active pre-consent', domains: 'ad.doubleclick.net', category: 'Advertising' },
        { name: 'Google Analytics 4', tier: 'gated', status: 'Gated (post-consent)', domains: 'analytics.google.com', category: 'Analytics' },
      ],
      cookies: [
        { name: '_ga', domain: '.example.com', duration: '1yr', durationDays: 365, purpose: 'analytics' },
      ],
      requestPulse: [
        { domain: 'ad.doubleclick.net', preConsent: 1, postConsent: 0, total: 1 },
        { domain: 'analytics.google.com', preConsent: 0, postConsent: 1, total: 1 },
      ],
      auditTrail: {
        preConsent: [
          { time: 't+0ms', title: 'Page load begins', domain: 'example.com', type: 'essential' },
          { time: 't+530ms', title: 'DoubleClick Ad fired', domain: 'ad.doubleclick.net', type: 'adtech' },
        ],
      },
      rejectScenario: {
        rejectHonoured: false,
        summary: '1 tracker fired after rejection',
        persistingTrackers: [{ name: 'Google Analytics 4 (collect)', domains: 'analytics.google.com', category: 'analytics' }],
        persistingCookies: [{ name: '_ga', domain: '.example.com', purpose: 'unknown' }],
      },
    },
  };
}

test('a faithful analysis passes cross-check without errors', () => {
  const { errors } = crossCheck(goodAnalysis(), scan);
  assert.deepEqual(errors, []);
});

test('a tracker domain never observed by the scanner is an error', () => {
  const a = goodAnalysis();
  a.findings.trackers.push({ name: 'TikTok Pixel', tier: 'active', status: 'Active pre-consent', domains: 'analytics.tiktok.com', category: 'Tracking' });
  const { errors } = crossCheck(a, scan);
  assert.ok(errors.some(e => /analytics\.tiktok\.com.*not observed/.test(e)), errors.join('\n'));
});

test('a tracker claimed active (pre-consent) without pre-consent evidence is an error', () => {
  const a = goodAnalysis();
  // analytics.google.com only fired post-consent in the scan
  a.findings.trackers[1].tier = 'active';
  const { errors } = crossCheck(a, scan);
  assert.ok(errors.some(e => /analytics\.google\.com.*pre-consent/.test(e)), errors.join('\n'));
});

test('a cookie name not present in the scan is an error', () => {
  const a = goodAnalysis();
  a.findings.cookies.push({ name: '_fake_cookie', domain: '.example.com', duration: '1yr', durationDays: 365, purpose: 'tracking' });
  const { errors } = crossCheck(a, scan);
  assert.ok(errors.some(e => e.includes('_fake_cookie')), errors.join('\n'));
});

test('audit-trail event for a domain with no scanner requests is an error', () => {
  const a = goodAnalysis();
  a.findings.auditTrail.preConsent.push({ time: 't+2.0s', title: 'Hotjar fired', domain: 'static.hotjar.com', type: 'tracking' });
  const { errors } = crossCheck(a, scan);
  assert.ok(errors.some(e => /static\.hotjar\.com/.test(e)), errors.join('\n'));
});

test('claiming reject was honoured when trackers fired post-reject is an error', () => {
  const a = goodAnalysis();
  a.findings.rejectScenario.rejectHonoured = true;
  const { errors } = crossCheck(a, scan);
  assert.ok(errors.some(e => e.includes('rejectHonoured')), errors.join('\n'));
});

test('requestPulse counts that drift far from scanner counts produce a warning', () => {
  const a = goodAnalysis();
  a.findings.requestPulse[0].preConsent = 40;
  a.findings.requestPulse[0].total = 40;
  const { warnings } = crossCheck(a, scan);
  assert.ok(warnings.some(w => /ad\.doubleclick\.net/.test(w)), warnings.join('\n'));
});

test('overallScore far from the weighted category blend produces a warning', () => {
  const a = goodAnalysis();
  const expected = expectedOverallScore(a.scores);
  a.meta.overallScore = Math.min(10, expected + 2.5);
  const { errors, warnings } = crossCheck(a, scan);
  assert.ok([...errors, ...warnings].some(m => m.includes('overallScore')), [...errors, ...warnings].join('\n'));
});

test('expectedOverallScore applies the Phase D weights', () => {
  const scores = {
    consent: { score: 10 }, preConsentTracking: { score: 10 }, legalPages: { score: 10 },
    crossBorder: { score: 10 }, securityHeaders: { score: 10 }, cookieManagement: { score: 10 },
    darkPatterns: { score: 10 }, dsar: { score: 10 }, processorTransparency: { score: 10 },
  };
  assert.equal(expectedOverallScore(scores), 10);
});
