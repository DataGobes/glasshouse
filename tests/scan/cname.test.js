// tests/scan/cname.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { detectCnameCloaking } = require('../../scripts/scan.js');

test('first-party subdomain CNAME to a third party is flagged', async () => {
  const fakeResolve = async (h) => h === 'smetrics.example.com' ? ['adobedc.demdex.net'] : [];
  const out = await detectCnameCloaking(['smetrics.example.com', 'www.example.com'], 'example.com', fakeResolve);
  const hit = out.find(o => o.host === 'smetrics.example.com');
  assert.strictEqual(hit.cnameCloaked, true);
  assert.match(hit.cnameTarget, /demdex/);
});
