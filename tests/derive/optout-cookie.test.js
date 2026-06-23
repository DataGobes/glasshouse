// tests/derive/optout-cookie.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { isOptOutCookie } = require('../../scripts/generate.js'); // export in Step 2

test('opt-out / consent cookies are recognised', () => {
  assert.ok(isOptOutCookie('OptanonConsent'));
  assert.ok(isOptOutCookie('euconsent-v2'));
  assert.ok(isOptOutCookie('user-optout'));
  assert.ok(!isOptOutCookie('_ga'));
});
