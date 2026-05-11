#!/usr/bin/env node
/**
 * Run the privacy scanner against the local fixture page and assert the
 * fingerprinting output structure. Exit code 0 = pass, 1 = fail.
 *
 * Usage: node tests/fingerprinting/run-fixture.js
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const FIXTURE_DIR = __dirname;
const SCAN_DIR = path.resolve(__dirname, "../..");

function startFixtureServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = path.join(FIXTURE_DIR, "fixture.html");
      const html = fs.readFileSync(file, "utf8");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function runScan(url) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [path.join(SCAN_DIR, "scripts/scan.js"), url], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    let stdout = "";
    proc.stdout.on("data", (chunk) => { stdout += chunk; });
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`scan exited with code ${code}`));
      const lines = stdout.trim().split("\n");
      const jsonPath = lines[lines.length - 1];
      resolve(jsonPath);
    });
  });
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failures++;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

async function main() {
  console.log("Starting fixture server...");
  const { server, port } = await startFixtureServer();
  const url = `http://127.0.0.1:${port}/`;

  try {
    console.log(`Running scan against ${url}...`);
    const jsonPath = await runScan(url);
    const result = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    const fp = result.summary?.details?.fingerprinting ||
               result.variants?.ignore?.fingerprinting;
    if (!fp) {
      console.error("FAIL: no fingerprinting result in scan output");
      process.exit(1);
    }

    // Schema assertions
    assert(Array.isArray(fp.tier1Calls), "tier1Calls is array");
    assert(Array.isArray(fp.tier2Calls), "tier2Calls is array");
    assert(Array.isArray(fp.stackedSignals), "stackedSignals is array");
    assert(Array.isArray(fp.commercialSdks), "commercialSdks is array");
    assert(Array.isArray(fp.tier3Appendix), "tier3Appendix is array");
    assert(Array.isArray(fp.outOfScopeCaveats) && fp.outOfScopeCaveats.length === 3, "outOfScopeCaveats has 3 entries");

    // Vector coverage assertions
    const t1ApiMethods = new Set(fp.tier1Calls.map(c => `${c.api}.${(c.method || "").split(" ")[0]}`));
    const expectedT1 = [
      "Canvas.toDataURL",
      "Canvas.measureText",
      "WebGL.getParameter",
      "WebGL.getExtension(WEBGL_debug_renderer_info)",
      "AudioContext.OfflineAudioContext",
      "OffscreenCanvas.constructor",
      "Worker.postMessage(OffscreenCanvas",
      "WebRTC.RTCPeerConnection",
    ];
    for (const expected of expectedT1) {
      const found = Array.from(t1ApiMethods).some(api => api.startsWith(expected));
      assert(found, `Tier 1 detected: ${expected}`);
    }

    // Tier 2 assertions
    const t2ApiMethods = new Set(fp.tier2Calls.map(c => `${c.api}.${(c.method || "").split(" ")[0]}`));
    const expectedT2 = [
      "Navigator.hardwareConcurrency",
      "Navigator.platform",
      "Screen.colorDepth",
      "CSS.matchMedia",
    ];
    for (const expected of expectedT2) {
      const found = Array.from(t2ApiMethods).some(api => api.startsWith(expected));
      assert(found, `Tier 2 stacked + published: ${expected}`);
    }

    // Tier 3 assertion
    const t3 = fp.tier3Appendix.some(c => c.api === "Navigator" && c.method === "language");
    assert(t3, "Tier 3: navigator.language is in tier3Appendix");
    const noT3InPublished = !fp.tier1Calls.some(c => c.method === "language") &&
                           !fp.tier2Calls.some(c => c.method === "language");
    assert(noT3InPublished, "Tier 3: navigator.language not in published tiers");

    // Stacking
    assert(fp.stackedSignals.length > 0, "stackedSignals has at least one entry");
    if (fp.stackedSignals.length > 0) {
      const verdicts = fp.stackedSignals.map(s => s.verdict);
      assert(verdicts.includes("active fingerprinting"), `at least one 'active fingerprinting' verdict (got: ${verdicts.join(", ")})`);
    }

    if (failures > 0) {
      console.error(`\n${failures} assertion(s) failed.`);
      process.exit(1);
    }
    console.log("\nAll fixture assertions passed.");
  } finally {
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
