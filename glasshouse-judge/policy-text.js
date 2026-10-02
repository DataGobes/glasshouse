/**
 * Finds the privacy-policy text in a raw scan. Current scans (glasshouse/2.2)
 * keep it at the top level; older privacy-scan/2.x scans and extracted
 * summaries keep it under the ignore variant or summary.
 */

const CANDIDATE_PATHS = [
  (s) => s.legalPageContent,
  (s) => s.variants && s.variants.ignore && s.variants.ignore.legalPageContent,
  (s) => s.summary && s.summary.legalPageContent,
  (s) => s.summary && s.summary.details && s.summary.details.legalPageContent,
];

function extractPolicy(scan, key = "privacyPolicy") {
  for (const get of CANDIDATE_PATHS) {
    let lpc;
    try { lpc = get(scan || {}); } catch { lpc = null; }
    const doc = lpc && lpc[key];
    if (doc && typeof doc.text === "string" && doc.text.trim()) {
      return { text: doc.text, url: doc.url || null, truncated: !!doc.truncated };
    }
  }
  return null;
}

module.exports = { extractPolicy };
