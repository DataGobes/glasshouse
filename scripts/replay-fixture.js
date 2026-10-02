#!/usr/bin/env node
/**
 * Maintains labelled replay fixtures: one raw scan + the analysis written for
 * it, stored together so analysis-step changes (prompt edits, a Jev-backed
 * analyst, ...) can be replayed and diffed without re-scanning live sites.
 *
 * Layout (see fixtures/replay/README.md):
 *   fixtures/replay/<site>/scan.json      raw scripts/scan.js output
 *   fixtures/replay/<site>/analysis.json  the analysis JSON (the label)
 *   fixtures/replay/<site>/meta.json      provenance + last validation result
 *
 * Usage:
 *   node scripts/replay-fixture.js add <site> --scan <scan.json> --analysis <analysis.json> \
 *        --author <who/what wrote the analysis> [--notes "..."]
 *   node scripts/replay-fixture.js check [<site> ...]   re-validate, refresh meta.validation
 *   node scripts/replay-fixture.js list
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "fixtures", "replay");
const VALIDATOR = path.join(__dirname, "validate-analysis.js");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

function gitCommit() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: __dirname, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

// Runs the validator with the scan cross-check and keeps the error/warning lines.
function validate(dir) {
  const r = spawnSync(
    process.execPath,
    [VALIDATOR, path.join(dir, "analysis.json"), "--scan-json", path.join(dir, "scan.json")],
    { encoding: "utf8" }
  );
  const lines = `${r.stdout}\n${r.stderr}`.split("\n").map((l) => l.trim());
  return {
    checkedAt: new Date().toISOString(),
    validatorCommit: gitCommit(),
    exitCode: r.status,
    errors: lines.filter((l) => l.startsWith("✗")).map((l) => l.slice(1).trim()),
    warnings: lines.filter((l) => l.startsWith("⚠")).map((l) => l.slice(1).trim()),
  };
}

// Provenance only; "~" keeps the home directory out of committed meta files.
function displayPath(file) {
  const abs = path.resolve(file);
  const home = require("os").homedir();
  return abs.startsWith(home) ? "~" + abs.slice(home.length) : abs;
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
}

function add(argv) {
  const site = argv[0];
  const scanFile = arg(argv, "--scan");
  const analysisFile = arg(argv, "--analysis");
  const author = arg(argv, "--author");
  if (!site || !scanFile || !analysisFile || !author) {
    console.error("Usage: replay-fixture.js add <site> --scan <file> --analysis <file> --author <who> [--notes ...]");
    process.exit(1);
  }
  const scan = readJson(scanFile);
  if (!scan.variants) {
    console.error(`${scanFile} has no \`variants\` — pass the RAW scanner output`);
    process.exit(1);
  }
  const dir = path.join(ROOT, site);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(scanFile, path.join(dir, "scan.json"));
  fs.copyFileSync(analysisFile, path.join(dir, "analysis.json"));

  const meta = {
    site,
    scan: {
      url: scan.meta?.url ?? null,
      scannedAt: scan.meta?.scannedAt ?? null,
      scanner: scan.meta?.scanner ?? null,
      engine: scan.meta?.engine ?? scan.meta?.browser ?? null,
      source: displayPath(scanFile),
    },
    analysis: {
      author,
      source: displayPath(analysisFile),
      writtenAt: fs.statSync(analysisFile).mtime.toISOString(),
      notes: arg(argv, "--notes"),
    },
    addedAt: new Date().toISOString(),
    validation: validate(dir),
  };
  writeJson(path.join(dir, "meta.json"), meta);
  report(site, meta.validation);
}

function sites() {
  if (!fs.existsSync(ROOT)) return [];
  return fs
    .readdirSync(ROOT)
    .filter((d) => fs.existsSync(path.join(ROOT, d, "meta.json")))
    .sort();
}

function check(argv) {
  const targets = argv.length ? argv : sites();
  let failed = 0;
  for (const site of targets) {
    const dir = path.join(ROOT, site);
    const metaFile = path.join(dir, "meta.json");
    const meta = readJson(metaFile);
    meta.validation = validate(dir);
    writeJson(metaFile, meta);
    report(site, meta.validation);
    if (meta.validation.exitCode !== 0) failed++;
  }
  process.exit(failed ? 1 : 0);
}

function list() {
  for (const site of sites()) {
    const m = readJson(path.join(ROOT, site, "meta.json"));
    console.log(
      `${site.padEnd(20)} ${m.scan.scanner ?? "?"}  scanned ${String(m.scan.scannedAt).slice(0, 10)}  ` +
        `errors ${m.validation.errors.length}  author: ${m.analysis.author}`
    );
  }
}

function report(site, v) {
  const status = v.exitCode === 0 ? "ok" : "ERRORS";
  console.log(`${site}: ${status} (${v.errors.length} errors, ${v.warnings.length} warnings)`);
  for (const e of v.errors) console.log(`  ✗ ${e}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "add") add(rest);
else if (cmd === "check") check(rest);
else if (cmd === "list") list();
else {
  console.error("Usage: replay-fixture.js <add|check|list> ...");
  process.exit(1);
}
