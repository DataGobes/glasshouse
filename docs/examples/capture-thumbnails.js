#!/usr/bin/env node
/**
 * Capture three preview screenshots (title / TL;DR / recommendations slides)
 * of an example deck, for use as thumbnails in the project README.
 *
 * Usage: node docs/examples/capture-thumbnails.js <example-dir>
 *
 * Example: node docs/examples/capture-thumbnails.js datagobes.dev
 *
 * Expects docs/examples/<example-dir>/index.html to exist. Writes
 * slide-title.png, slide-tldr.png, slide-recommendations.png alongside it
 * at 2x device pixel ratio.
 *
 * Why this script: the deck's slides use IntersectionObserver to fade in
 * .reveal elements on scroll. In a headless screenshot context that
 * observer never fires, so a naive page.screenshot() captures opacity:0
 * content. This script forces every slide to .visible before capturing.
 */
const { firefox } = require("playwright");
const path = require("path");
const fs = require("fs");

const exampleDir = process.argv[2];
if (!exampleDir) {
  console.error("Usage: node docs/examples/capture-thumbnails.js <example-dir>");
  process.exit(1);
}

const dir = path.resolve(__dirname, exampleDir);
const html = path.join(dir, "index.html");
if (!fs.existsSync(html)) {
  console.error(`Missing: ${html}`);
  process.exit(1);
}

const TARGETS = [
  { dataTitle: "Title",            file: "slide-title.png" },
  { dataTitle: "TL;DR",            file: "slide-tldr.png" },
  { dataTitle: "Recommendations",  file: "slide-recommendations.png" },
];

(async () => {
  const browser = await firefox.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto("file://" + html, { waitUntil: "networkidle" });

  await page.addStyleTag({
    content: `
      .slide { opacity: 1 !important; }
      .reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
      .slide.visible .reveal { opacity: 1 !important; transform: none !important; }
    `,
  });
  await page.evaluate(() => {
    document.querySelectorAll(".slide").forEach(s => s.classList.add("visible"));
  });
  await page.waitForTimeout(500);

  for (const t of TARGETS) {
    const el = await page.$(`.slide[data-title="${t.dataTitle}"]`);
    if (!el) { console.error(`MISS ${t.dataTitle}`); continue; }
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await el.screenshot({ path: path.join(dir, t.file) });
    console.log(`OK   ${t.dataTitle} → ${t.file}`);
  }
  await browser.close();
})();
