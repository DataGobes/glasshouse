const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const { matchElement } = require("../../glasshouse-judge/checklists/art13");
const { excludedByValidation, labelsFromAnalysis, aggregate, kappa } = require("../../glasshouse-judge/replay-compare");
const { createJudge } = require("../../glasshouse-judge");
const { createMemoryCache } = require("../../glasshouse-judge/cache");
const { runReplay, discoverSites, formatReport, formatDisagreements, parseArgs } = require("../../scripts/replay");
const { sweepSpecific, statusAt } = require("../../glasshouse-judge/replay-compare");
const { createFakeClient } = require("./fake-jev");

const FIXTURES = path.join(__dirname, "fixtures", "replay");
const REPO_FIXTURES = path.join(__dirname, "..", "..", "fixtures", "replay");

test("hand-written element names map onto checklist ids", () => {
  assert.strictEqual(matchElement("Controller identity"), "controller");
  assert.strictEqual(matchElement("Lawful basis"), "legalBasis");
  assert.strictEqual(matchElement("Legal basis (incl. legitimate interests)"), "legalBasis");
  assert.strictEqual(matchElement("Legitimate interests"), "legitimateInterests");
  assert.strictEqual(matchElement("Retention period"), "retention");
  assert.strictEqual(matchElement("Right to lodge complaint"), "complaint");
  assert.strictEqual(matchElement("Right to withdraw consent"), "withdrawConsent");
  assert.strictEqual(matchElement("Data subject rights"), "rights");
  assert.strictEqual(matchElement("Third-country transfers"), "transfers");
  assert.strictEqual(matchElement("Cookie wall"), null);
});

test("validation errors exclude the labels they name", () => {
  const ex = excludedByValidation([
    'findings.privacyPolicyAnalysis[3].status: "partial" not allowed',
    "findings.cookies: something else",
  ]);
  assert.strictEqual(ex.all, false);
  assert.deepStrictEqual([...ex.indexes], [3]);
  assert.strictEqual(excludedByValidation(["findings.privacyPolicyAnalysis: wrong key"]).all, true);

  const analysis = { findings: { privacyPolicyAnalysis: [
    { element: "Controller identity", status: "present" },
    { element: "DPO contact", status: "missing" },
    { element: "Lawful basis", status: "present" },
  ] } };
  const { labels, skipped } = labelsFromAnalysis(analysis, { errors: ["findings.privacyPolicyAnalysis[1].status bad"] });
  assert.deepStrictEqual([...labels.keys()], ["controller", "legalBasis"]);
  assert.deepStrictEqual(skipped, ["DPO contact"]);
});

test("aggregate weights items and computes kappa", () => {
  const rows = (pairs) => pairs.map(([id, label, judged]) => ({ id, label, judged, agree: label === judged }));
  const sum = aggregate([
    { site: "a", weight: 1, rows: rows([["controller", "present", "present"], ["retention", "vague", "vague"], ["dpo", "absent", "present"]]) },
    { site: "b", weight: 0.5, rows: rows([["controller", "present", "vague"]]) },
  ]);
  assert.strictEqual(sum.items, 4);
  assert.strictEqual(sum.weight, 3.5);
  assert.strictEqual(sum.agreement, 2 / 3.5);
  assert.strictEqual(sum.presenceAgreement, 2.5 / 3.5);
  assert.strictEqual(sum.perElement.controller.agreement, 1 / 1.5);
  assert.strictEqual(sum.confusion.absent.present, 1);
  assert.strictEqual(kappa({ present: { present: 5, vague: 0, absent: 0 }, vague: { present: 0, vague: 5, absent: 0 }, absent: { present: 0, vague: 0, absent: 5 } }), 1);
});

test("replay scores fixtures, down-weights dirty ones and skips text that is not a policy", async () => {
  const judge = createJudge({ client: createFakeClient(), cache: createMemoryCache(), env: {} });
  const report = await runReplay({ fixturesDir: FIXTURES, judge });

  const by = Object.fromEntries(report.sites.map((s) => [s.site, s]));
  assert.deepStrictEqual(Object.keys(by).sort(), ["example-shop.test", "legacy-shop.test", "login-wall.test", "no-policy.test"]);

  const clean = by["example-shop.test"];
  assert.strictEqual(clean.weight, 1);
  assert.strictEqual(clean.labelled, 9);
  assert.deepStrictEqual(clean.unmatchedLabels, ["Cookie wall"]);
  assert.ok(clean.rows.filter((r) => r.agree != null).every((r) => r.agree));

  const dirty = by["legacy-shop.test"];
  assert.strictEqual(dirty.weight, 0.5);
  assert.strictEqual(dirty.labelled, 8); // DPO label dropped by its validation error
  assert.deepStrictEqual(dirty.rows.filter((r) => r.agree === false).map((r) => r.id), ["recipients"]);
  // Cut-off text: its "absent" for transfers is shown but not scored.
  assert.strictEqual(dirty.rows.find((r) => r.id === "transfers").excluded, "truncated");
  assert.ok(dirty.rows.filter((r) => r.excluded).every((r) => r.judged === "absent" && r.agree === null));
  assert.strictEqual(dirty.policy.truncated, true);

  assert.match(by["no-policy.test"].skipped, /no privacy policy/);
  assert.match(by["login-wall.test"].skipped, /does not look like a privacy policy/);

  assert.strictEqual(report.summary.items, 16);
  assert.strictEqual(report.summary.agreement, 12 / 12.5);
  assert.strictEqual(report.model, "jev-1.13.0");
  const text = formatReport(report);
  assert.match(text, /legacy-shop\.test: 6\/7 labelled items agree \[checklist validation errors: 1, weight 0\.5\]/);
  assert.match(text, /policy: https:\/\/example-shop\.test\/privacy, \d+ chars, P\(policy\)=0\.95\n/);
  assert.match(text, /TRUNCATED \(length is exactly 15000 chars, a scanner cap\)/);
  assert.match(text, /· International transfers .*not scored: truncated/);
});

test("replay without a key replays cached answers and skips the rest", async () => {
  const cache = createMemoryCache();
  await runReplay({ fixturesDir: FIXTURES, sites: ["example-shop.test"], judge: createJudge({ client: createFakeClient(), cache, env: {} }) });

  const offline = createJudge({ cache, env: {} });
  assert.strictEqual(offline.hasClient, false);
  const report = await runReplay({ fixturesDir: FIXTURES, sites: ["example-shop.test", "legacy-shop.test"], judge: offline });
  const by = Object.fromEntries(report.sites.map((s) => [s.site, s]));
  assert.ok(by["example-shop.test"].rows, "cached site still scores");
  // Same policy text but another domain in state: a different request, not cached.
  assert.match(by["legacy-shop.test"].skipped, /TYPESAFE_API_KEY/);
  assert.strictEqual(report.cache.misses, 1);
});

test("validation errors outside the checklist don't down-weight a fixture", async () => {
  const fs = require("fs");
  const os = require("os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "replay-"));
  fs.cpSync(path.join(FIXTURES, "example-shop.test"), path.join(dir, "example-shop.test"), { recursive: true });
  const metaFile = path.join(dir, "example-shop.test", "meta.json");
  const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
  meta.validation = { exitCode: 1, errors: ['findings.cookies: "_ga" does not appear in the scan', "findings.trackers[2]: not in scan"], warnings: [] };
  fs.writeFileSync(metaFile, JSON.stringify(meta));

  const judge = createJudge({ client: createFakeClient(), cache: createMemoryCache(), env: {} });
  const [site] = (await runReplay({ fixturesDir: dir, judge })).sites;
  assert.strictEqual(site.weight, 1);
  assert.strictEqual(site.validationErrors, 0);
  assert.strictEqual(site.otherValidationErrors, 2);
});

test("the committed datagobes.dev fixture is discovered", () => {
  assert.ok(discoverSites(REPO_FIXTURES).includes("datagobes.dev"));
});

test("statusAt and the threshold sweep re-score from cached probabilities", () => {
  assert.strictEqual(statusAt({ pExists: 0.2, pSpecific: 0.9 }, { existsThreshold: 0.5, specificThreshold: 0.5 }), "absent");
  assert.strictEqual(statusAt({ pExists: 0.9, pSpecific: 0.3 }, { existsThreshold: 0.5, specificThreshold: 0.5 }), "vague");
  assert.strictEqual(statusAt({ pExists: 0.9, pSpecific: 0.3 }, { existsThreshold: 0.5, specificThreshold: 0.2 }), "present");
  assert.strictEqual(statusAt({ pExists: 0.9, pSpecific: null }, { existsThreshold: 0.5, specificThreshold: 0.2 }), "vague");

  const site = {
    weight: 1,
    rows: [
      { id: "controller", label: "present", judged: "vague", agree: false },
      { id: "retention", label: "vague", judged: "vague", agree: true },
      { id: "dpo", label: null, judged: "absent", agree: null },
    ],
    trace: { items: [
      { id: "controller", pExists: 0.9, pSpecific: 0.35 },
      { id: "retention", pExists: 0.9, pSpecific: 0.1 },
      { id: "dpo", pExists: 0.1, pSpecific: null },
    ] },
  };
  const sweep = sweepSpecific([site], { existsThreshold: 0.5, thresholds: [0.3, 0.5] });
  assert.deepStrictEqual(sweep.map((x) => x.agreement), [1, 0.5]);
});

test("the disagreement sheet lists every scored miss with its excerpt", async () => {
  const judge = createJudge({ client: createFakeClient(), cache: createMemoryCache(), env: {} });
  const report = await runReplay({ fixturesDir: FIXTURES, sites: ["legacy-shop.test"], judge });
  const md = formatDisagreements(report);
  assert.match(md, /## legacy-shop\.test/);
  assert.match(md, /### Recipients: label vague, judge present/);
  assert.match(md, /> .*Mollie B\.V\./);
  assert.doesNotMatch(md, /### Controller identity/);
  assert.match(formatReport(report), /If the specific-vs-vague threshold were/);
});

test("parseArgs reads repeatable sites and the gate", () => {
  const a = parseArgs(["--site", "a", "--site", "b", "--min-agreement", "0.8", "--json", "out.json"]);
  assert.deepStrictEqual(a.sites, ["a", "b"]);
  assert.strictEqual(a.minAgreement, 0.8);
  assert.strictEqual(a.json, "out.json");
  assert.throws(() => parseArgs(["--nope"]));
});
