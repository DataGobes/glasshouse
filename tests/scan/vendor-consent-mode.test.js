// tests/scan/vendor-consent-mode.test.js
//
// Additive consent-mode coverage for Microsoft UET and Amazon TAM/ats.
// detectConsentModeV2 already covers Google Consent Mode v2; these signals are
// emitted as a separate, optional `vendorConsentModes` field so older persisted
// scans (which lack it) keep rendering. Pure-function tests mirror the
// classifyAdServing / analyzePolicyText pattern — the browser collector hands a
// plain snapshot to detectVendorConsentModes, which is what we exercise here.
const { test } = require('node:test');
const assert = require('node:assert');
const { detectVendorConsentModes, parseUetqConsent } = require('../../scripts/scan.js');

// ─────────────────────────── Microsoft UET ───────────────────────────

test('Microsoft UET consent calls on window.uetq are detected with their states', () => {
  // Realistic shape: window.uetq is a plain array before bat.js initialises, so
  // uetq.push('consent','update',{...}) appends three consecutive elements.
  const snapshot = {
    uetq: [
      'consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied' },
      'consent', 'update', { ad_storage: 'granted' },
    ],
    resourceUrls: ['https://bat.bing.com/bat.js?ti=123'],
  };
  const out = detectVendorConsentModes(snapshot);
  assert.strictEqual(out.microsoft.detected, true);
  assert.strictEqual(out.microsoft.consentMode, true);
  assert.strictEqual(out.microsoft.defaultState.ad_storage, 'denied');
  assert.strictEqual(out.microsoft.updateEvents.length, 1);
  assert.strictEqual(out.microsoft.updateEvents[0].ad_storage, 'granted');
});

test('Microsoft UET tag (bat.bing.com) is detected even without in-page consent calls', () => {
  const out = detectVendorConsentModes({
    resourceUrls: ['https://bat.bing.com/action/0?ti=1&evt=pageLoad'],
  });
  assert.strictEqual(out.microsoft.detected, true);
  assert.strictEqual(out.microsoft.tagPresent, true);
  assert.strictEqual(out.microsoft.consentMode, false);
});

test('a bare \\buet\\b resource flags the Microsoft UET tag', () => {
  const out = detectVendorConsentModes({ resourceUrls: ['https://cdn.example.com/uet/loader.js'] });
  assert.strictEqual(out.microsoft.tagPresent, true);
  assert.strictEqual(out.microsoft.detected, true);
});

// ─────────────────────────── Amazon TAM / ats ───────────────────────────

test('Amazon TAM (window.apstag) global is detected', () => {
  const out = detectVendorConsentModes({ apstag: true });
  assert.strictEqual(out.amazon.detected, true);
  assert.strictEqual(out.amazon.tam, true);
});

test('Amazon ats (Amazon Advertising) global is detected', () => {
  const out = detectVendorConsentModes({ ats: true });
  assert.strictEqual(out.amazon.detected, true);
  assert.strictEqual(out.amazon.ats, true);
});

test('Amazon ad-system tag in loaded resources is detected', () => {
  const out = detectVendorConsentModes({
    resourceUrls: ['https://c.amazon-adsystem.com/aax2/apstag.js'],
  });
  assert.strictEqual(out.amazon.detected, true);
  assert.strictEqual(out.amazon.tagPresent, true);
});

// ─────────────────────────── Robustness / back-compat ───────────────────────────

test('an empty snapshot detects nothing and never throws', () => {
  const out = detectVendorConsentModes({});
  assert.strictEqual(out.microsoft.detected, false);
  assert.strictEqual(out.amazon.detected, false);
});

test('a missing snapshot is treated as empty', () => {
  const out = detectVendorConsentModes();
  assert.strictEqual(out.microsoft.detected, false);
  assert.strictEqual(out.amazon.detected, false);
});

// ─────────────── parseUetqConsent (queue interpreter, tested directly) ───────────────

test('parseUetqConsent extracts default and update states from a flat uetq queue', () => {
  const { defaultState, updateEvents } = parseUetqConsent([
    'consent', 'default', { ad_storage: 'denied' },
    'consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted' },
  ]);
  assert.strictEqual(defaultState.ad_storage, 'denied');
  assert.strictEqual(updateEvents.length, 1);
  assert.strictEqual(updateEvents[0].ad_user_data, 'granted');
});

test('parseUetqConsent also handles nested-array pushes', () => {
  const { updateEvents } = parseUetqConsent([
    ['consent', 'default', { ad_storage: 'denied' }],
    ['consent', 'update', { ad_storage: 'granted' }],
  ]);
  assert.strictEqual(updateEvents.length, 1);
  assert.strictEqual(updateEvents[0].ad_storage, 'granted');
});

test('parseUetqConsent tolerates a non-array (post-init Uet object) without throwing', () => {
  const out = parseUetqConsent({ /* bat.js replaced the array with a Uet instance */ });
  assert.deepStrictEqual(out, { defaultState: {}, updateEvents: [] });
});
