// tests/scan/cmp-vendor-list.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { parseCmpVendorText } = require('../../scripts/scan.js');

test('parses vendor names out of OneTrust pc-sdk text', () => {
  const sample = 'Strictly Necessary Cookies\nSAP CDC / Gigya\nPerformance Cookies\nOptimizely\nMicrosoft\nLinkedIn\nTargeting Cookies\nMeta Platforms';
  const out = parseCmpVendorText(sample, 'onetrust');
  assert.ok(out.vendors.includes('Optimizely'));
  assert.ok(out.vendors.includes('Microsoft'));
  assert.strictEqual(out.source, 'onetrust');
});
