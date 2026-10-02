// tests/scan/fp-caller-frame.test.js
//
// Regression: callerUrl used to be stack line [2] verbatim. In Chromium the
// stack starts with an "Error" header, so [2] was our own init-script wrapper
// ("<anonymous>"), every fingerprinting call got callerDomain "<unknown>",
// and aggregateFingerprinting demoted all Tier-2 calls to tier3Appendix.
const { test } = require('node:test');
const assert = require('node:assert');
const { pickCallerFrame, aggregateFingerprinting, isKnownAdTracker } = require('../../scripts/scan.js');

// Real stack shapes captured from Chromium (Playwright addInitScript).
const CHROMIUM_SELF = 'Error\n    at <anonymous>:12:40\n    at <anonymous>:200:3';
const CHROMIUM_GETTER = 'Error\n' +
  '    at logFP (<anonymous>:4:52)\n' +
  '    at Screen.get [as colorDepth] (<anonymous>:6:80)\n' +
  '    at https://bat.bing.com/bat.js:1:21';
const CHROMIUM_NESTED = 'Error\n' +
  '    at logFP (<anonymous>:4:52)\n' +
  '    at <anonymous>:310:17\n' +
  '    at Array.forEach (<anonymous>)\n' +
  '    at wrapped (<anonymous>:305:9)\n' +
  '    at fp (https://cdn.example-fp.com/agent.js:3:99)';

// Firefox shape: no header line; init script frames carry their own source.
const FIREFOX_SELF = '@debugger eval code:12:40\n@debugger eval code:200:3';
const FIREFOX_GETTER = 'logFP@debugger eval code:4:52\n' +
  'get@debugger eval code:6:80\n' +
  '@https://bat.bing.com/bat.js:1:21';

test('Chromium: skips the Error header and our own wrapper frame', () => {
  assert.match(pickCallerFrame(CHROMIUM_GETTER, CHROMIUM_SELF), /bat\.bing\.com/);
});

test('Chromium: nested hook frames are skipped too', () => {
  assert.match(pickCallerFrame(CHROMIUM_NESTED, CHROMIUM_SELF), /cdn\.example-fp\.com/);
});

test('Firefox: picks the caller frame', () => {
  assert.match(pickCallerFrame(FIREFOX_GETTER, FIREFOX_SELF), /bat\.bing\.com/);
});

test('without self-stack, falls back to "skip logFP + wrapper" on both engines', () => {
  assert.match(pickCallerFrame(CHROMIUM_GETTER, ''), /bat\.bing\.com/);
  assert.match(pickCallerFrame(FIREFOX_GETTER, ''), /bat\.bing\.com/);
});

test('empty or garbage stack yields empty string', () => {
  assert.strictEqual(pickCallerFrame('', CHROMIUM_SELF), '');
  assert.strictEqual(pickCallerFrame(undefined, undefined), '');
});

test('attributed Tier-2 calls from one caller stack into a published signal', () => {
  const call = (method, count) => ({
    api: method === 'colorDepth' || method === 'availWidth' ? 'Screen' : 'Navigator',
    method, tier: 'tier2', count, callerDomain: 'cdn.example-fp.com', preConsent: true,
  });
  const fp = aggregateFingerprinting({
    apiCalls: [call('colorDepth', 2), call('hardwareConcurrency', 1), call('platform', 1), call('availWidth', 1)],
  });
  assert.strictEqual(fp.detected, true);
  assert.strictEqual(fp.tier2Calls.length, 4);
  assert.strictEqual(fp.stackedSignals[0].verdict, 'probable fingerprinting');
});

// Known-tracker rule (2026-10): an ad/analytics tracker reading ≥2 distinct
// Tier-2 device properties before consent is published as probable
// fingerprinting even below the generic ≥4 calls / ≥3 APIs stacking bar.
const t2 = (callerDomain, api, method, preConsent, count = 1) =>
  ({ api, method, tier: 'tier2', count, callerDomain, preConsent });

test('known tracker reading 2 Tier-2 APIs pre-consent is probable fingerprinting', () => {
  const fp = aggregateFingerprinting({ apiCalls: [
    t2('bat.bing.com', 'Screen', 'colorDepth', true),
    t2('bat.bing.com', 'Navigator', 'maxTouchPoints', true),
  ] });
  assert.strictEqual(fp.detected, true);
  assert.strictEqual(fp.severity, 'medium');
  const sig = fp.stackedSignals[0];
  assert.strictEqual(sig.callerDomain, 'bat.bing.com');
  assert.strictEqual(sig.verdict, 'probable fingerprinting');
  assert.strictEqual(sig.rule, 'known-tracker-pre-consent');
  assert.strictEqual(sig.preConsent, true);
  assert.strictEqual(fp.tier2Calls.length, 2);
});

test('same reads after consent stay in the appendix', () => {
  const fp = aggregateFingerprinting({ apiCalls: [
    t2('bat.bing.com', 'Screen', 'colorDepth', false),
    t2('bat.bing.com', 'Navigator', 'maxTouchPoints', false),
  ] });
  assert.strictEqual(fp.detected, false);
  assert.strictEqual(fp.tier3Appendix.length, 2);
});

test('only the pre-consent reads are published under the known-tracker rule', () => {
  const fp = aggregateFingerprinting({ apiCalls: [
    t2('connect.facebook.net', 'Screen', 'colorDepth', true),
    t2('connect.facebook.net', 'Navigator', 'platform', true),
    t2('connect.facebook.net', 'Navigator', 'hardwareConcurrency', false),
  ] });
  assert.strictEqual(fp.tier2Calls.length, 2);
  assert.ok(fp.tier2Calls.every(c => c.preConsent));
  assert.strictEqual(fp.tier3Appendix.filter(c => c.demotedFrom === 'tier2').length, 1);
  assert.strictEqual(fp.stackedSignals[0].tier2Count, 2);
});

test('non-tracker (CMP) reading the same 2 APIs pre-consent is not flagged', () => {
  const fp = aggregateFingerprinting({ apiCalls: [
    t2('cdn.cookielaw.org', 'Screen', 'colorDepth', true),
    t2('cdn.cookielaw.org', 'Navigator', 'maxTouchPoints', true),
  ] });
  assert.strictEqual(fp.detected, false);
});

test('known tracker with a single Tier-2 API is not flagged', () => {
  const fp = aggregateFingerprinting({ apiCalls: [t2('bat.bing.com', 'Screen', 'colorDepth', true, 5)] });
  assert.strictEqual(fp.detected, false);
});

test('isKnownAdTracker matches subdomains, not lookalike suffixes', () => {
  assert.strictEqual(isKnownAdTracker('bat.bing.com'), true);
  assert.strictEqual(isKnownAdTracker('notbing.com'), false);
  assert.strictEqual(isKnownAdTracker('bing.com.evil.example'), false);
});
