const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const { matchElement } = require("../../glasshouse-judge/checklists/art13");
const { excludedByValidation, labelsFromAnalysis, aggregate, kappa } = require("../../glasshouse-judge/replay-compare");
const { createJudge } = require("../../glasshouse-judge");
const { createMemoryCache } = require("../../glasshouse-judge/cache");
const { runReplay, discoverSites, formatReport, parseArgs } = require("../../scripts/replay");
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

test("replay scores fixtures, down-weights dirty ones and skips scans without a policy", async () => {
  const judge = createJudge({ client: createFakeClient(), cache: createMemoryCache(), env: {} });
  const report = await runReplay({ fixturesDir: FIXTURES, judge });

  const by = Object.fromEntries(report.sites.map((s) => [s.site, s]));
  assert.deepStrictEqual(Object.keys(by).sort(), ["example-shop.test", "legacy-shop.test", "no-policy.test"]);

  const clean = by["example-shop.test"];
  assert.strictEqual(clean.weight, 1);
  assert.strictEqual(clean.labelled, 9);
  assert.deepStrictEqual(clean.unmatchedLabels, ["Cookie wall"]);
  assert.ok(clean.rows.filter((r) => r.agree != null).every((r) => r.agree));

  const dirty = by["legacy-shop.test"];
  assert.strictEqual(dirty.weight, 0.5);
  assert.strictEqual(dirty.labelled, 8); // DPO label dropped by its validation error
  assert.deepStrictEqual(dirty.rows.filter((r) => r.agree === false).map((r) => r.id), ["recipients"]);

  assert.match(by["no-policy.test"].skipped, /no privacy policy/);

  assert.strictEqual(report.summary.items, 17);
  assert.strictEqual(report.summary.agreement, 12.5 / 13);
  assert.strictEqual(report.model, "jev-1.13.0");
  assert.match(formatReport(report), /legacy-shop\.test: 7\/8 labelled items agree \[validation errors: 1, weight 0\.5\]/);
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

test("the committed datagobes.dev fixture is discovered", () => {
  assert.ok(discoverSites(REPO_FIXTURES).includes("datagobes.dev"));
});

test("parseArgs reads repeatable sites and the gate", () => {
  const a = parseArgs(["--site", "a", "--site", "b", "--min-agreement", "0.8", "--json", "out.json"]);
  assert.deepStrictEqual(a.sites, ["a", "b"]);
  assert.strictEqual(a.minAgreement, 0.8);
  assert.strictEqual(a.json, "out.json");
  assert.throws(() => parseArgs(["--nope"]));
});
