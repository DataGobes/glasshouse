#!/usr/bin/env node
/**
 * Extract summary from a privacy scan JSON
 *
 * Produces a lightweight JSON containing only the summary, meta, consent,
 * cookieWall, and screenshots — everything Claude needs for analysis
 * without the raw preConsent/postConsent request logs.
 *
 * Usage: node extract-summary.js <scan.json> [--output <path>]
 *
 * If --output is omitted, writes to /tmp/privacy-summary-{domain}.json
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: node extract-summary.js <scan.json> [--output <path>]");
  process.exit(1);
}

const inputPath = args[0];
const outputIdx = args.indexOf("--output");

const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

const summary = {
  meta: data.meta,
  summary: data.summary,
  consent: data.consent,
  cookieWall: data.cookieWall,
  screenshots: data.screenshots,
  // legalPageContent is captured from the ignore variant and propagated to
  // summary.details — but also include the top-level copy as fallback.
  legalPageContent: data.legalPageContent || null,
  errors: data.errors,
};

const domain = data.meta?.domain || "unknown";
const outputPath = outputIdx !== -1
  ? args[outputIdx + 1]
  : `/tmp/privacy-summary-${domain}.json`;

fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

const originalSize = fs.statSync(inputPath).size;
const summarySize = fs.statSync(outputPath).size;
const savings = ((1 - summarySize / originalSize) * 100).toFixed(0);

console.error(`Extracted summary: ${(summarySize / 1024).toFixed(1)}KB from ${(originalSize / 1024).toFixed(1)}KB (${savings}% smaller)`);
console.log(outputPath);
