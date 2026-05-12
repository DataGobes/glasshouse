#!/usr/bin/env node
/**
 * Run the scanner against the local multi-layer fixture and assert that the
 * reject variant traverses layer 2 instead of giving up on layer 1.
 *
 * Usage: node tests/multilayer/run-fixture.js
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
      // Serve the fixture for any path; respond 200 to tracker beacons too
      // so the scanner can record them as post-consent activity.
      if (req.url.startsWith("/__tracker__/")) {
        res.writeHead(200, { "Content-Type": "image/gif" });
        // 1x1 transparent gif
        res.end(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
        return;
      }
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
  console.log("Starting multi-layer fixture server...");
  const { server, port } = await startFixtureServer();
  const url = `http://127.0.0.1:${port}/`;

  try {
    console.log(`Running scan against ${url}...`);
    const jsonPath = await runScan(url);
    const result = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    const reject = result.variants?.reject;
    assert(reject, "reject variant present in scan output");
    if (!reject) {
      console.error("\nCannot continue without reject variant.");
      process.exit(1);
    }

    assert(reject.consent?.detected === true, "reject variant: consent banner detected");
    assert(reject.consent?.multiLayer === true, "reject variant: multiLayer === true");
    assert(reject.consent?.rejectAccessibility === "layer-2", `reject variant: rejectAccessibility === "layer-2" (got ${JSON.stringify(reject.consent?.rejectAccessibility)})`);
    assert(
      reject.consent?.multiLayerMethod === "layer2-direct-reject" ||
      reject.consent?.multiLayerMethod === "layer2-toggle-save",
      `reject variant: multiLayerMethod is one of the expected strategies (got ${JSON.stringify(reject.consent?.multiLayerMethod)})`
    );

    // Sanity: the accept variant uses layer 1 and should NOT be marked multi-layer.
    const accept = result.variants?.accept;
    assert(accept?.consent?.multiLayer === false || accept?.consent?.multiLayer === undefined,
      "accept variant: multiLayer is false/undefined (layer-1 accept worked)");

    if (failures > 0) {
      console.error(`\n${failures} assertion(s) failed.`);
      process.exit(1);
    }
    console.log("\nAll multi-layer fixture assertions passed.");
  } finally {
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
