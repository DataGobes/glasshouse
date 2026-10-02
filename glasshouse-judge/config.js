/**
 * Judge-layer configuration. Everything here can be overridden per call; the
 * env vars exist so the skill and scripts/replay.js need no flags.
 */

const path = require("path");

// Pinned, not "jev-latest": thresholds below are tuned against one version
// and an alias can move under us. Bump deliberately and re-run the replay.
const DEFAULT_MODEL = "jev-1.13.0";

const ENV = {
  apiKey: "TYPESAFE_API_KEY",
  baseURL: "TYPESAFE_BASE_URL",
  model: "GLASSHOUSE_JEV_MODEL",
  cacheDir: "GLASSHOUSE_JUDGE_CACHE_DIR",
};

const DEFAULTS = {
  baseURL: "https://api.typesafe.ai",
  // Jev 1.13 allows 32k tokens for state + the longest question. Accuracy
  // drops as state fills with unrelated text, so windows stay well below
  // that: ~16k chars is ~4k tokens.
  windowMaxChars: 16000,
  // A Choice accepts at most 255 options; one is reserved for "none".
  windowMaxClauses: 254,
  // Paragraphs longer than this are split on sentence boundaries.
  clauseMaxChars: 1200,
  // P(text is a privacy policy) below this skips the checklist.
  gateThreshold: 0.5,
  // P(disclosed) at or above this counts as disclosed.
  existsThreshold: 0.5,
  // P(specific) at or above this makes a disclosed element "present",
  // below it "vague".
  specificThreshold: 0.5,
  concurrency: 4,
  timeoutMs: 30000,
  maxRetries: 3,
};

function resolveConfig(overrides = {}, env = process.env) {
  const pick = (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    ...DEFAULTS,
    apiKey: pick(env[ENV.apiKey]),
    baseURL: pick(env[ENV.baseURL]) || DEFAULTS.baseURL,
    model: pick(env[ENV.model]) || DEFAULT_MODEL,
    cacheDir: pick(env[ENV.cacheDir]) || path.join(process.cwd(), ".glasshouse-judge-cache"),
    ...overrides,
  };
}

module.exports = { DEFAULT_MODEL, ENV, DEFAULTS, resolveConfig };
