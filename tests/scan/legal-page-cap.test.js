// tests/scan/legal-page-cap.test.js
//
// Regression: fetchLegalPageContent cut policy text at 30,000 chars, so rights
// and complaint sections near the end of long single-page policies (66k+ chars
// is normal for multinationals) were invisible to analyzePolicyText and came
// back as false "not disclosed". Needs Chromium; skips when it can't launch.
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { chromium } = require('playwright');
const { fetchLegalPageContent, analyzePolicyText, LEGAL_PAGE_MAX_CHARS } = require('../../scripts/scan.js');

const FILLER = 'We process personal data for the purposes described in this section. '.repeat(1000); // ~70k chars
const TAIL = 'You have the right to data portability and the right to lodge a complaint with a supervisory authority.';

function serve(body) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html><body><main><p>${body}</p></main></body></html>`);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('long privacy policy is kept past 30k chars and its tail is analysed', async (t) => {
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (e) { t.skip(`Chromium not available in this environment: ${e.message.split('\n')[0]}`); return; }
  const server = await serve(FILLER + TAIL);
  try {
    const context = await browser.newContext();
    const url = `http://127.0.0.1:${server.address().port}/privacy`;
    const lpc = await fetchLegalPageContent(context, [{ type: 'privacy policy', text: 'Privacy', url }]);
    const pp = lpc.privacyPolicy;
    assert.ok(pp.charCount > 30000, `charCount ${pp.charCount} > 30000`);
    assert.ok(pp.text.includes('lodge a complaint'), 'tail of the policy is kept');
    assert.strictEqual(pp.truncated, false);

    const pa = analyzePolicyText(lpc, [], null);
    assert.strictEqual(pa.dsar.portabilityDisclosed, true);
    assert.strictEqual(pa.dsar.complainToDpaDisclosed, true);
  } finally {
    server.close();
    await browser.close();
  }
});

test('cap is a single named constant well above real policy lengths', () => {
  assert.ok(LEGAL_PAGE_MAX_CHARS >= 200000);
});
