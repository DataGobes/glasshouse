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

// Older scanners cut legal pages at a fixed cap without recording it, so a
// text whose length is a round cap (15000, 30000, ...) was almost certainly cut.
const CAP_STEP = 5000;
const CAP_MIN = 10000;

function extractPolicy(scan, key = "privacyPolicy") {
  for (const get of CANDIDATE_PATHS) {
    let lpc;
    try { lpc = get(scan || {}); } catch { lpc = null; }
    const doc = lpc && lpc[key];
    if (doc && typeof doc.text === "string" && doc.text.trim()) {
      const text = doc.text;
      const atCap = text.length >= CAP_MIN && text.length % CAP_STEP === 0;
      return {
        text,
        url: doc.url || null,
        chars: text.length,
        truncated: !!doc.truncated || atCap,
        truncatedReason: doc.truncated ? "scanner flagged truncation" : atCap ? `length is exactly ${text.length} chars, a scanner cap` : null,
      };
    }
  }
  return null;
}

module.exports = { extractPolicy };
