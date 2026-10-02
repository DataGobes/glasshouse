// tests/scan/legal-page-collapsed.test.js
//
// Regression: policies built as accordions (mediamarkt.nl's Privacyverklaring)
// keep every section body display:none until clicked. innerText skips hidden
// content, so only the 3k-char table of contents was captured and every
// section came back "not disclosed". Needs Chromium; skips when it can't launch.
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { chromium } = require('playwright');
const { fetchLegalPageContent } = require('../../scripts/scan.js');

const PAGE = `<html><head><style>.panel{display:none}</style></head><body><main>
<h1>Privacy statement</h1>
<button>Who is the controller?</button><div class="panel"><p>The controller is Example B.V., Main Street 1, Amsterdam.</p></div>
<details><summary>Your rights</summary><p>You may lodge a complaint with the Autoriteit Persoonsgegevens.</p></details>
<script>var secret = "script text must not leak into the policy";</script>
</main></body></html>`;

test('collapsed accordion sections are included in the policy text', async (t) => {
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (e) { t.skip(`Chromium not available in this environment: ${e.message.split('\n')[0]}`); return; }
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(PAGE);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const context = await browser.newContext();
    const url = `http://127.0.0.1:${server.address().port}/privacy`;
    const { privacyPolicy: pp } = await fetchLegalPageContent(context, [{ type: 'privacy', text: 'Privacy statement', url }]);
    assert.ok(pp.text.includes('The controller is Example B.V.'), 'display:none panel is captured');
    assert.ok(pp.text.includes('lodge a complaint'), 'closed <details> body is captured');
    assert.ok(!pp.text.includes('script text'), 'script content stays out');
  } finally {
    server.close();
    await browser.close();
  }
});
