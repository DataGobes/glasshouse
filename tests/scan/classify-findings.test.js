// Unit tests for scan.js classification logic (requireable exports).
const test = require('node:test');
const assert = require('node:assert');
const { classifyFindings, aggregateFingerprinting, dedupeFpCalls } = require('../../scripts/scan.js');

test('classifyFindings populates loadedBy for 4th-party trackers', () => {
  const phase = {
    networkRequests: [
      {
        url: 'https://ad.doubleclick.net/ddm/activity/src=123',
        method: 'GET',
        resourceType: 'image',
        timestamp: 1000,
        initiatorUrl: 'https://pagead2.googlesyndication.com/tag/js/loader.js',
      },
    ],
  };
  const out = classifyFindings(phase, 'example.com');
  assert.equal(out.trackers.length, 1);
  assert.equal(out.trackers[0].is4thParty, true);
  assert.equal(out.trackers[0].loadedBy, 'pagead2.googlesyndication.com');
});

test('classifyFindings does not mark first-party-initiated trackers as 4th party', () => {
  const phase = {
    networkRequests: [
      {
        url: 'https://ad.doubleclick.net/ddm/activity/src=123',
        method: 'GET',
        resourceType: 'image',
        timestamp: 1000,
        initiatorUrl: 'https://www.example.com/',
      },
    ],
  };
  const out = classifyFindings(phase, 'example.com');
  assert.equal(out.trackers.length, 1);
  assert.equal(out.trackers[0].is4thParty, false);
  assert.equal(out.trackers[0].loadedBy, null);
});

test('aggregateFingerprinting: a lone tier-2 capability probe produces no verdict', () => {
  const raw = {
    detected: true,
    preConsent: true,
    callerDomains: ['cdn.example.com'],
    apiCalls: [
      { api: 'WebGL', method: 'getShaderPrecisionFormat', tier: 'tier2', count: 1, callerDomain: 'cdn.example.com', preConsent: true },
    ],
  };
  const agg = aggregateFingerprinting(raw);
  assert.equal(agg.stackedSignals.length, 0);
  assert.equal(agg.detected, false);
});

test('aggregateFingerprinting: tier-1 unmasked GPU read yields an active verdict', () => {
  const raw = {
    detected: true,
    preConsent: true,
    callerDomains: ['fp.example.net'],
    apiCalls: [
      { api: 'WebGL', method: 'getExtension(WEBGL_debug_renderer_info)', tier: 'tier1', count: 1, callerDomain: 'fp.example.net', preConsent: true },
    ],
  };
  const agg = aggregateFingerprinting(raw);
  assert.equal(agg.detected, true);
  assert.equal(agg.stackedSignals.length, 1);
  assert.equal(agg.stackedSignals[0].verdict, 'active fingerprinting');
  assert.equal(agg.severity, 'high');
});

test('dedupeFpCalls preserves first/last timestamps and counts', () => {
  const calls = [
    { api: 'Canvas', method: 'toDataURL', tier: 'tier1', timestamp: 100, callerUrl: 'at https://fp.example.net/a.js:1:1' },
    { api: 'Canvas', method: 'toDataURL', tier: 'tier1', timestamp: 250, callerUrl: 'at https://fp.example.net/a.js:1:1' },
    { api: 'Canvas', method: 'toDataURL', tier: 'tier1', timestamp: 900, callerUrl: 'at https://fp.example.net/a.js:1:1' },
  ];
  const out = dedupeFpCalls(calls, null);
  assert.equal(out.length, 1);
  assert.equal(out[0].count, 3);
  assert.equal(out[0].firstTimestamp, 100);
  assert.equal(out[0].lastTimestamp, 900);
});

test('dedupeFpCalls splits pre- and post-consent occurrences of the same API', () => {
  const calls = [
    { api: 'Canvas', method: 'toDataURL', tier: 'tier1', timestamp: 100, callerUrl: 'at https://fp.example.net/a.js:1:1' },
    { api: 'Canvas', method: 'toDataURL', tier: 'tier1', timestamp: 900, callerUrl: 'at https://fp.example.net/a.js:1:1' },
  ];
  const out = dedupeFpCalls(calls, 500);
  assert.equal(out.length, 2);
  const pre = out.find(c => c.preConsent);
  const post = out.find(c => !c.preConsent);
  assert.equal(pre.count, 1);
  assert.equal(post.count, 1);
});
