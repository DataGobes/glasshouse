const fs = require('node:fs');

function mdToHtml(md) {
  const lines = md.split('\n');
  const html = [];
  let inList = false;
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);
    if (h) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    } else if (li) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inline(li[1])}</li>`);
    } else if (line.trim() === '') {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push('');
    } else {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inList) html.push('</ul>');
  return html.join('\n');
}

function inline(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

async function renderPdf(markdown, outputPath, { footer } = {}) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (err) {
    return { ok: false, reason: `Playwright not installed: ${err.message}` };
  }
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    return { ok: false, reason: `chromium launch failed: ${err.message}` };
  }
  try {
    const page = await browser.newPage();
    const body = mdToHtml(markdown);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; color: #111; max-width: 720px; margin: 40px auto; padding: 0 16px; }
      h1 { font-size: 18pt; }
      h2 { font-size: 14pt; margin-top: 1.5em; }
      h3 { font-size: 12pt; }
      code { font-family: 'Menlo', 'Consolas', monospace; font-size: 10pt; background: #f4f4f4; padding: 1px 4px; }
      ul { padding-left: 20px; }
      hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
    </style></head><body>${body}</body></html>`;
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
      displayHeaderFooter: !!footer,
      footerTemplate: footer ? `<div style="font-size:8pt;color:#888;width:100%;text-align:center;padding:0 20mm;">${footer}</div>` : '',
      headerTemplate: '<div></div>'
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  } finally {
    await browser.close();
  }
}

module.exports = { renderPdf, mdToHtml };
