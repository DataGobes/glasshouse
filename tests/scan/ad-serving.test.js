// tests/scan/ad-serving.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { classifyAdServing } = require('../../scripts/scan.js');

test('advertiser-side measurement is not programmatic publishing', () => {
  const reqs = [
    { url: 'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123/?random=1' },
    { url: 'https://www.google.com/pagead/1p-user-list/123/?gtm=1' },
    { url: 'https://ad.doubleclick.net/activity;cat=rmktng;src=123' },
  ];
  const out = classifyAdServing(reqs);
  assert.strictEqual(out.programmaticPublisher, false);
  assert.ok(out.measurementSignals.length >= 1);
});

test('publisher-side programmatic inventory is detected', () => {
  const reqs = [
    { url: 'https://securepubads.g.doubleclick.net/gampad/ads?foo=1' },
    { url: 'https://cdn.jsdelivr.net/npm/prebid.js' },
    { url: 'https://example-ssp.com/openrtb2/auction' },
  ];
  const out = classifyAdServing(reqs);
  assert.strictEqual(out.programmaticPublisher, true);
  assert.ok(out.publisherSignals.length >= 1);
});
