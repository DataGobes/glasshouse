const fs = require('node:fs');
const { normalizeAnalysis } = require('./normalize-analysis');

const SUPPORTED_VERSIONS = new Set(['1']);

// Heuristic: detect legacy analysis JSON (no schemaVersion, but has the
// generate.js-shape signature). Such files are normalized rather than
// rejected.
function looksLikeAnalysisJson(parsed) {
  if (!parsed || !parsed.findings) return false;
  const trackers = parsed.findings.trackers;
  if (Array.isArray(trackers) && trackers.length > 0 && trackers[0].tier && trackers[0].domains !== undefined) return true;
  if (Array.isArray(parsed.findings.legalPages)) return true;
  return false;
}

function loadScan(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read scan at ${filePath}: ${err.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
  }
  if (!(parsed && parsed.meta && parsed.meta.schemaVersion) && looksLikeAnalysisJson(parsed)) {
    parsed = normalizeAnalysis(parsed);
  }
  const version = parsed && parsed.meta && parsed.meta.schemaVersion;
  if (!version) throw new Error(`Missing meta.schemaVersion in ${filePath}`);
  if (!SUPPORTED_VERSIONS.has(version)) {
    throw new Error(`Unsupported schemaVersion "${version}" (supported: ${[...SUPPORTED_VERSIONS].join(', ')})`);
  }
  return parsed;
}

module.exports = { loadScan, SUPPORTED_VERSIONS };
