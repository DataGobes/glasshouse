#!/usr/bin/env node
// Author-tooling helper for the DPA adapter authoring workflow.
//
// Some DPA websites (AP, ICO) sit behind Cloudflare bot protection and reject
// plain HTTP fetches with 403, which means the Anthropic WebFetch tool cannot
// read them. This script renders the page in Playwright Firefox — which the
// glasshouse skill already depends on — and prints the body text plus any
// mailto: links to stdout. The output is intended for grepping or piping into
// an LLM prompt, not for programmatic parsing.
//
// Usage:
//   node scripts/fetch-page.js <url>
//
// Not used at runtime by the complaint builder. Adapters are authored by
// reading official pages and filling in the JSON by hand (or with this
// helper to retrieve content); the validator (scripts/validate-adapter.js)
// is the contract.

const { firefox } = require('playwright');

(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error('usage: node scripts/fetch-page.js <url>');
    process.exit(2);
  }
  const browser = await firefox.launch({ headless: true });
  const ctx = await browser.newContext({
    locale: 'en-GB',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:128.0) Gecko/20100101 Firefox/128.0',
  });
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.error(`status=${resp ? resp.status() : 'no response'}`);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const text = await page.textContent('body');
    const mailtoLinks = await page.locator('a[href^="mailto:"]').all();
    const mailtos = [];
    for (const link of mailtoLinks) {
      const href = await link.getAttribute('href');
      if (href) mailtos.push(href);
    }
    console.log(text);
    if (mailtos.length) {
      console.log('\n--- mailto: links ---');
      console.log(mailtos.join('\n'));
    }
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
