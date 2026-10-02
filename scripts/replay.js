#!/usr/bin/env node
/**
 * Replays the optional Jev judge (glasshouse-judge/) over labelled fixtures
 * and reports per-item agreement with the hand-written analysis.
 *
 * Fixtures: fixtures/replay/<site>/{scan.json, analysis.json, meta.json}
 * (see fixtures/replay/README.md). Currently scored: the Art. 13/14
 * checklist, findings.privacyPolicyAnalysis[].
 *
 * Usage:
 *   node scripts/replay.js [--site <name>]... [--fixtures <dir>]
 *                          [--json <report.json>] [--min-agreement <0..1>]
 *
 * Needs TYPESAFE_API_KEY for answers not yet in the judge cache
 * (GLASSHOUSE_JUDGE_CACHE_DIR, default ./.glasshouse-judge-cache). Without a
 * key, cached answers still replay, so re-scoring after a threshold or
 * comparison change costs nothing. Sites that need the API are skipped.
 *
 * Fixture quality: each site line shows the policy URL and length. Text that
 * the judge's gate says is not a privacy policy (a login or cookie page) is
 * skipped; on text that was cut off, "absent" judgments are not scored.
 *
 * --min-agreement turns the run into a gate: exit 1 when weighted exact
 * agreement is below it, or when nothing could be scored.
 */

const fs = require("fs");
const path = require("path");
const { createJudge, judgeScan } = require("../glasshouse-judge");
const { labelsFromAnalysis, compareChecklist, aggregate, DIRTY_WEIGHT } = require("../glasshouse-judge/replay-compare");
const { VERSION } = require("../glasshouse-judge/checklists/art13");

const DEFAULT_FIXTURES = path.join(__dirname, "..", "fixtures", "replay");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function discoverSites(fixturesDir) {
  if (!fs.existsSync(fixturesDir)) return [];
  return fs.readdirSync(fixturesDir)
    .filter((d) => fs.existsSync(path.join(fixturesDir, d, "meta.json")))
    .sort();
}

async function replaySite(dir, judge) {
  const meta = readJson(path.join(dir, "meta.json"));
  const site = meta.site || path.basename(dir);
  const errors = (meta.validation && meta.validation.errors) || [];
  const clean = !meta.validation || meta.validation.exitCode === 0;
  const base = { site, scanner: meta.scan && meta.scan.scanner, weight: clean ? 1 : DIRTY_WEIGHT, validationErrors: errors.length };

  const scan = readJson(path.join(dir, "scan.json"));
  const analysis = readJson(path.join(dir, "analysis.json"));
  const { labels, unmatched, skipped } = labelsFromAnalysis(analysis, { errors });

  let judged;
  try {
    judged = await judgeScan(scan, judge);
  } catch (err) {
    if (err.code === "NO_CLIENT") return { ...base, skipped: "answers not cached; set TYPESAFE_API_KEY" };
    return { ...base, skipped: `judge failed: ${err.message}` };
  }
  const trace = judged.trace.privacyPolicy;
  const policy = { url: trace.policyUrl || null, chars: trace.policyChars || 0, truncated: !!trace.policyTruncated, truncatedReason: trace.truncatedReason || null, pIsPolicy: trace.pIsPolicy };
  if (trace.skipped) return { ...base, policy, skipped: trace.skipped, labelled: labels.size };

  const unverifiable = new Set((trace.items || []).filter((i) => i.unverifiable).map((i) => i.id));
  const rows = compareChecklist(labels, judged.findings.privacyPolicyAnalysis, { unverifiable });
  return { ...base, policy, labelled: labels.size, unmatchedLabels: unmatched, skippedLabels: skipped, rows, judged: judged.findings, trace };
}

async function runReplay({ fixturesDir = DEFAULT_FIXTURES, sites, judge = createJudge() } = {}) {
  const names = sites && sites.length ? sites : discoverSites(fixturesDir);
  const results = [];
  for (const name of names) results.push(await replaySite(path.join(fixturesDir, name), judge));
  const scored = results.filter((r) => r.rows);
  return {
    generatedAt: new Date().toISOString(),
    model: judge.config.model,
    checklist: VERSION,
    thresholds: { exists: judge.config.existsThreshold, specific: judge.config.specificThreshold },
    cache: { ...judge.stats },
    summary: aggregate(scored),
    sites: results,
  };
}

const pct = (x) => (x == null ? "  n/a" : `${(x * 100).toFixed(0).padStart(4)}%`);

function formatReport(report) {
  const out = [];
  out.push(`Replay: ${report.checklist} on ${report.model} (exists ≥ ${report.thresholds.exists}, specific ≥ ${report.thresholds.specific})`);
  out.push(`Cache: ${report.cache.hits} hit(s), ${report.cache.misses} miss(es)`);
  out.push("");
  for (const s of report.sites) {
    const tag = s.weight < 1 ? ` [validation errors: ${s.validationErrors}, weight ${s.weight}]` : "";
    if (s.skipped) { out.push(`- ${s.site}: skipped (${s.skipped})${tag}`); continue; }
    const scored = s.rows.filter((r) => r.agree != null);
    const agree = scored.filter((r) => r.agree).length;
    out.push(`- ${s.site}: ${agree}/${scored.length} labelled items agree${tag}`);
    const p = s.policy;
    out.push(`    policy: ${p.url || "unknown url"}, ${p.chars} chars${p.pIsPolicy != null ? `, P(policy)=${p.pIsPolicy.toFixed(2)}` : ""}${p.truncated ? `, TRUNCATED (${p.truncatedReason}): its "absent"s are not scored` : ""}`);
    for (const r of s.rows) {
      if (r.label == null) continue;
      const mark = r.excluded ? "·" : r.agree ? "✓" : "✗";
      out.push(`    ${mark} ${r.element.padEnd(34)} label=${r.label.padEnd(7)} judge=${r.judged}${r.excluded ? `  (not scored: ${r.excluded})` : ""}`);
    }
    if (s.unmatchedLabels.length) out.push(`    ? unmatched label names: ${s.unmatchedLabels.join(", ")}`);
  }
  const sum = report.summary;
  out.push("");
  out.push(`Overall: ${sum.items} item(s), exact ${pct(sum.agreement)}, addressed-or-not ${pct(sum.presenceAgreement)}, kappa ${sum.kappa == null ? "n/a" : sum.kappa.toFixed(2)}`);
  if (sum.items) {
    out.push("");
    out.push("Per element (weighted exact agreement, n):");
    for (const pe of Object.values(sum.perElement)) {
      if (pe.n) out.push(`  ${pe.element.padEnd(34)} ${pct(pe.agreement)}  n=${pe.n}`);
    }
    out.push("");
    out.push("Confusion (rows = label, cols = judge):");
    out.push(`  ${"".padEnd(8)} ${["present", "vague", "absent"].map((s) => s.padStart(8)).join("")}`);
    for (const [a, row] of Object.entries(sum.confusion)) {
      out.push(`  ${a.padEnd(8)} ${Object.values(row).map((v) => String(+v.toFixed(2)).padStart(8)).join("")}`);
    }
  }
  return out.join("\n");
}

function parseArgs(argv) {
  const args = { sites: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--site") args.sites.push(argv[++i]);
    else if (a === "--fixtures") args.fixturesDir = path.resolve(argv[++i]);
    else if (a === "--json") args.json = argv[++i];
    else if (a === "--min-agreement") args.minAgreement = Number(argv[++i]);
    else if (a === "-h" || a === "--help") args.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
    return 0;
  }
  const judge = createJudge();
  if (!judge.hasClient) console.error("No TYPESAFE_API_KEY: replaying cached answers only.\n");
  const report = await runReplay({ fixturesDir: args.fixturesDir, sites: args.sites, judge });
  console.log(formatReport(report));
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(report, null, 2) + "\n");

  if (args.minAgreement != null) {
    const { agreement, items } = report.summary;
    if (!items || agreement < args.minAgreement) {
      console.error(`\nGate failed: agreement ${items ? pct(agreement).trim() : "n/a (nothing scored)"} < ${pct(args.minAgreement).trim()}`);
      return 1;
    }
    console.error(`\nGate passed: agreement ${pct(agreement).trim()} ≥ ${pct(args.minAgreement).trim()}`);
  }
  return 0;
}

if (require.main === module) {
  main().then((code) => process.exit(code), (err) => { console.error(err.message); process.exit(2); });
}

module.exports = { runReplay, replaySite, discoverSites, formatReport, parseArgs };
