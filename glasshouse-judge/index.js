/**
 * glasshouse-judge: optional TypeSafe/Jev judgments for the analysis step.
 *
 * Optional by construction: nothing in scripts/ requires this module, and
 * without TYPESAFE_API_KEY isEnabled() is false and the skill keeps its
 * hand-written analysis path. Output uses the analysis JSON schema
 * (templates/analysis-schema.json), so generate.js and the complaint builder
 * consume it unchanged.
 */

const { resolveConfig, ENV, DEFAULT_MODEL } = require("./config");
const { createClient } = require("./client");
const { createFileCache, cachedSystemOne } = require("./cache");
const { judgePrivacyPolicy } = require("./privacy-policy");

function isEnabled(env = process.env) {
  return !!resolveConfig({}, env).apiKey;
}

/**
 * Builds a judge. Pass `client` and/or `cache` to inject fakes; with
 * neither an API key nor a client, only cached answers are available.
 */
function createJudge(overrides = {}) {
  const { client: injected, cache: injectedCache, env, ...rest } = overrides;
  const config = resolveConfig(rest, env);
  const client = injected || (config.apiKey
    ? createClient({ apiKey: config.apiKey, baseURL: config.baseURL, timeoutMs: config.timeoutMs, maxRetries: config.maxRetries })
    : null);
  const cache = injectedCache === undefined ? createFileCache(config.cacheDir) : injectedCache;
  const stats = { hits: 0, misses: 0 };
  return { config, stats, hasClient: !!client, systemOne: cachedSystemOne({ client, cache, stats }) };
}

/** Runs every available checklist over a scan. */
async function judgeScan(scan, judge = createJudge()) {
  const pp = await judgePrivacyPolicy(scan, judge);
  return { findings: { ...pp.findings }, trace: { privacyPolicy: pp.trace, cache: { ...judge.stats } } };
}

/** Copies judged findings into an analysis, leaving everything else as is. */
function applyToAnalysis(analysis, judged) {
  return { ...analysis, findings: { ...(analysis.findings || {}), ...judged.findings } };
}

module.exports = { isEnabled, createJudge, judgeScan, applyToAnalysis, ENV, DEFAULT_MODEL };
