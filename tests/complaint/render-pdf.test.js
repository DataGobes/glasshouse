const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { renderPdf } = require('../../scripts/complaint/render-pdf');

test('renderPdf writes a non-empty PDF from a markdown string', async (t) => {
  // Skip if chromium is not installed — Playwright throws a clear error we catch below.
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-'));
  const md = '# Test complaint\n\nThis is a test.';
  const result = await renderPdf(md, path.join(outDir, 'complaint.pdf'), { footer: 'test footer' });
  if (!result.ok && /chromium|browser|launch/i.test(result.reason || '')) {
    t.skip('Chromium not available in this environment');
    return;
  }
  assert.equal(result.ok, true, `reason: ${result.reason}`);
  const stats = fs.statSync(path.join(outDir, 'complaint.pdf'));
  assert.ok(stats.size > 1000, 'PDF must be non-trivially sized');
});
