// tests/derive/affiliated.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { classifyParty } = require('../../scripts/generate.js'); // export in Step 3

test('same-owner different-eTLD is affiliated, not third-party', () => {
  const meta = { domain: 'miele.nl', aliasDomains: ['miele.com'] };
  assert.strictEqual(classifyParty('media.miele.com', meta), 'affiliated');
  assert.strictEqual(classifyParty('www.miele.nl', meta), 'first-party');
  assert.strictEqual(classifyParty('bat.bing.com', meta), 'third-party');
});
