const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const { segmentClauses, windowClauses } = require("../../glasshouse-judge/segment");
const { extractPolicy } = require("../../glasshouse-judge/policy-text");
const { resolveConfig, DEFAULT_MODEL } = require("../../glasshouse-judge/config");
const { requestHash, createMemoryCache, cachedSystemOne } = require("../../glasshouse-judge/cache");
const { createClient } = require("../../glasshouse-judge/client");
const { buildWindowRequest, judgePrivacyPolicy, NONE } = require("../../glasshouse-judge/privacy-policy");
const { ELEMENTS } = require("../../glasshouse-judge/checklists/art13");
const { isEnabled, createJudge, judgeScan, applyToAnalysis } = require("../../glasshouse-judge");
const { createFakeClient } = require("./fake-jev");

const FIXTURES = path.join(__dirname, "fixtures", "replay");
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const exampleScan = () => readJson(path.join(FIXTURES, "example-shop.test", "scan.json"));
const fakeJudge = (overrides = {}) => {
  const client = createFakeClient();
  return { client, judge: createJudge({ client, cache: createMemoryCache(), env: {}, ...overrides }) };
};

// ── segmentation and windows ──────────────────────────────────────

test("segmentClauses folds headings into the paragraph they introduce", () => {
  const c = segmentClauses("Retention\nWe keep invoices for 7 years.\n\nYour rights\nYou can ask for access.");
  assert.deepStrictEqual(c.map((x) => x.text), [
    "Retention — We keep invoices for 7 years.",
    "Your rights — You can ask for access.",
  ]);
  assert.deepStrictEqual(c.map((x) => x.id), ["c0001", "c0002"]);
});

test("segmentClauses splits over-long paragraphs on sentence ends", () => {
  const para = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
  const c = segmentClauses(para, { clauseMaxChars: 200 });
  assert.ok(c.length > 1);
  assert.ok(c.every((x) => x.text.length <= 200));
  assert.strictEqual(c.map((x) => x.text).join(" "), para);
});

test("windowClauses keeps every Choice at or under 255 options", () => {
  const clauses = segmentClauses(Array.from({ length: 600 }, (_, i) => `Clause ${i}.`).join("\n"));
  const windows = windowClauses(clauses, { windowMaxChars: 1e9, windowMaxClauses: 254 });
  assert.deepStrictEqual(windows.map((w) => w.length), [254, 254, 92]);
  const req = buildWindowRequest({ model: DEFAULT_MODEL, domain: "x.test", clauses: windows[0] });
  for (const e of ELEMENTS) {
    const opts = Object.keys(req.questions[`pick:${e.id}`].criteria);
    assert.strictEqual(opts.length, 255);
    assert.ok(opts.includes(NONE));
  }
});

test("windowClauses respects the character budget", () => {
  const clauses = segmentClauses(Array.from({ length: 10 }, () => "x".repeat(90) + ".").join("\n"));
  const windows = windowClauses(clauses, { windowMaxChars: 300, windowMaxClauses: 254 });
  assert.deepStrictEqual(windows.map((w) => w.length), [3, 3, 3, 1]);
});

test("buildWindowRequest batches a Noul and a Choice per element over one state", () => {
  const req = buildWindowRequest({ model: DEFAULT_MODEL, domain: "x.test", url: "https://x.test/p", clauses: segmentClauses("A.\nB.") });
  assert.strictEqual(req.model, "jev-1.13.0");
  assert.strictEqual(Object.keys(req.questions).length, ELEMENTS.length * 2);
  assert.deepStrictEqual(req.state.clauses.map((c) => c.id), ["c0001", "c0002"]);
  assert.strictEqual(req.questions["has:retention"].type, "noul");
  assert.strictEqual(req.questions["pick:retention"].type, "choice");
});

test("extractPolicy reads current and older scan layouts", () => {
  assert.match(extractPolicy(exampleScan()).text, /Example Shop/);
  const legacy = readJson(path.join(FIXTURES, "legacy-shop.test", "scan.json"));
  assert.match(extractPolicy(legacy).text, /Example Shop/);
  assert.strictEqual(extractPolicy({ legalPageContent: null }), null);
  assert.strictEqual(extractPolicy(exampleScan()).truncated, false);
  // privacy-scan/2.1 cut at 15000/30000 chars without flagging it.
  assert.strictEqual(extractPolicy(legacy).truncated, true);
  assert.match(extractPolicy(legacy).truncatedReason, /15000/);
  assert.strictEqual(extractPolicy({ legalPageContent: { privacyPolicy: { text: "x".repeat(15001) } } }).truncated, false);
  assert.strictEqual(extractPolicy({ legalPageContent: { privacyPolicy: { text: "short", truncated: true } } }).truncated, true);
});

// ── config, optionality, cache, client ────────────────────────────

test("model is pinned to a version, not an alias, and env can override it", () => {
  assert.strictEqual(DEFAULT_MODEL, "jev-1.13.0");
  assert.strictEqual(resolveConfig({}, {}).model, "jev-1.13.0");
  assert.strictEqual(resolveConfig({}, { GLASSHOUSE_JEV_MODEL: "jev-1.14.0" }).model, "jev-1.14.0");
});

test("judge is disabled without TYPESAFE_API_KEY", () => {
  assert.strictEqual(isEnabled({}), false);
  assert.strictEqual(isEnabled({ TYPESAFE_API_KEY: "  " }), false);
  assert.strictEqual(isEnabled({ TYPESAFE_API_KEY: "ts-test" }), true);
  assert.strictEqual(createJudge({ env: {}, cache: null }).hasClient, false);
});

test("nothing outside the judge layer and replay.js depends on it", () => {
  const scripts = path.join(__dirname, "..", "..", "scripts");
  const offenders = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith(".js") && f.name !== "replay.js" && /glasshouse-judge/.test(fs.readFileSync(p, "utf8"))) offenders.push(p);
    }
  };
  walk(scripts);
  assert.deepStrictEqual(offenders, []);
});

test("requestHash ignores key order and changes with the evidence", () => {
  const a = { model: "m", state: { x: 1, y: 2 }, questions: {} };
  const b = { questions: {}, state: { y: 2, x: 1 }, model: "m" };
  assert.strictEqual(requestHash(a), requestHash(b));
  assert.notStrictEqual(requestHash(a), requestHash({ ...a, state: { x: 1, y: 3 } }));
  assert.notStrictEqual(requestHash(a), requestHash({ ...a, model: "m2" }));
});

test("cache hits skip the client; misses without a client fail clearly", async () => {
  const client = createFakeClient();
  const cache = createMemoryCache();
  const stats = { hits: 0, misses: 0 };
  const body = buildWindowRequest({ model: "m", domain: "x", clauses: segmentClauses("We retain data for 2 years.") });
  const call = cachedSystemOne({ client, cache, stats });
  await call(body);
  await call(body);
  assert.strictEqual(client.calls.length, 1);
  assert.deepStrictEqual(stats, { hits: 1, misses: 1 });

  const offline = cachedSystemOne({ client: null, cache });
  await offline(body); // cached: fine without a key
  await assert.rejects(offline({ ...body, model: "other" }), (e) => e.code === "NO_CLIENT");
});

test("client posts the documented body, retries 429 and gives up on 401", async () => {
  const seen = [];
  const responses = [
    new Response("slow down", { status: 429 }),
    new Response(JSON.stringify({ model: "jev-1.13.0", answers: {}, usage: {} }), { status: 200 }),
  ];
  const client = createClient({
    apiKey: "ts-test", baseURL: "https://api.example/", sleep: async () => {},
    fetchImpl: async (url, init) => { seen.push({ url, init }); return responses.shift(); },
  });
  const res = await client.systemOne({ model: "jev-1.13.0", state: "s", questions: {} });
  assert.strictEqual(res.model, "jev-1.13.0");
  assert.strictEqual(seen.length, 2);
  assert.strictEqual(seen[0].url, "https://api.example/v1/systemone");
  assert.strictEqual(seen[0].init.headers.Authorization, "Bearer ts-test");
  assert.deepStrictEqual(JSON.parse(seen[0].init.body), { model: "jev-1.13.0", state: "s", questions: {} });

  let calls = 0;
  const denied = createClient({ apiKey: "bad", baseURL: "https://api.example", sleep: async () => {},
    fetchImpl: async () => { calls++; return new Response("{}", { status: 401 }); } });
  await assert.rejects(denied.systemOne({}), (e) => e.status === 401);
  assert.strictEqual(calls, 1);
});

// ── the checklist judge ───────────────────────────────────────────

test("judgePrivacyPolicy emits the hand-written checklist shape", async () => {
  const { judge, client } = fakeJudge();
  const scan = exampleScan();
  const { findings, trace } = await judgePrivacyPolicy(scan, judge);
  const items = findings.privacyPolicyAnalysis;

  assert.deepStrictEqual(items.map((i) => i.element), ELEMENTS.map((e) => e.element));
  const status = Object.fromEntries(items.map((i) => [i.element, i.status]));
  assert.strictEqual(status["Controller identity"], "present");
  assert.strictEqual(status["Retention periods"], "vague");
  assert.strictEqual(status["International transfers"], "absent");
  assert.strictEqual(status["DPO contact"], "absent");

  const text = scan.legalPageContent.privacyPolicy.text.replace(/\s+/g, " ");
  for (const i of items) {
    assert.ok(["present", "absent", "vague"].includes(i.status));
    if (i.status === "absent") assert.strictEqual(i.excerpt, undefined);
    // Excerpts are copied from the policy, never generated.
    else assert.ok(text.includes(i.excerpt.split(" — ").pop().replace(/…$/, "")), i.excerpt);
  }
  // Gate, one window, one specific-vs-vague request per disclosed element.
  const disclosed = items.filter((i) => i.status !== "absent").length;
  assert.strictEqual(client.calls.length, 2 + disclosed);
  assert.strictEqual(trace.requests, 2 + disclosed);
  for (const c of client.calls.slice(2)) assert.strictEqual(Object.keys(c.questions).length, 1);
  assert.ok(trace.pIsPolicy > 0.5);
  assert.strictEqual(trace.model, "jev-1.13.0");
});

test("windowing finds elements that only appear in later windows", async () => {
  const { judge, client } = fakeJudge({ windowMaxChars: 200 });
  const { findings, trace } = await judgePrivacyPolicy(exampleScan(), judge);
  assert.ok(trace.windows > 3);
  const disclosed = trace.items.filter((i) => i.status !== "absent").length;
  assert.strictEqual(client.calls.length, 1 + trace.windows + disclosed);
  const status = Object.fromEntries(findings.privacyPolicyAnalysis.map((i) => [i.element, i.status]));
  assert.strictEqual(status["Right to complain"], "present"); // last clause of the policy
  assert.strictEqual(status["Controller identity"], "present"); // first clause
});

test("the vague check sees evidence beyond the first matching clause", async () => {
  const { judge, client } = fakeJudge();
  const text = [
    "Privacy statement. This privacy statement explains how we process personal data.",
    "Retention — We retain your data as long as necessary.",
    "Cookies — We use cookies for analytics.",
    "Newsletter — We send a newsletter when you subscribe.",
    "Invoices — For tax reasons we retain invoices for 7 years.",
  ].join("\n");
  const scan = { meta: { domain: "spread.test" }, legalPageContent: { privacyPolicy: { url: "https://spread.test/p", text } } };
  const { findings, trace } = await judgePrivacyPolicy(scan, judge);
  const retention = trace.items.find((i) => i.id === "retention");
  assert.strictEqual(retention.clauseId, "c0002");
  assert.ok(retention.evidenceClauseIds.includes("c0005"), retention.evidenceClauseIds.join());
  assert.ok(retention.evidenceClauseIds.length <= 4);
  assert.strictEqual(findings.privacyPolicyAnalysis.find((i) => i.element === "Retention periods").status, "present");
  const req = client.calls.find((c) => c.questions["specific:retention"]);
  assert.deepStrictEqual(Object.keys(req.state), ["document", "item", "passages"]);
});

test("the gate skips text that is not a privacy policy", async () => {
  const { judge, client } = fakeJudge();
  const scan = readJson(path.join(FIXTURES, "login-wall.test", "scan.json"));
  const res = await judgePrivacyPolicy(scan, judge);
  assert.deepStrictEqual(res.findings, {});
  assert.match(res.trace.skipped, /does not look like a privacy policy \(p=0\.05, \d+ chars from https:\/\/login-wall\.test\/recover\/initiate\)/);
  assert.strictEqual(client.calls.length, 1);
  assert.deepStrictEqual(Object.keys(client.calls[0].questions), ["is:privacyPolicy"]);
});

test("absents on cut-off text are marked unverifiable", async () => {
  const { judge } = fakeJudge();
  const scan = readJson(path.join(FIXTURES, "legacy-shop.test", "scan.json"));
  const { trace } = await judgePrivacyPolicy(scan, judge);
  assert.strictEqual(trace.policyTruncated, true);
  const transfers = trace.items.find((i) => i.id === "transfers");
  assert.strictEqual(transfers.status, "absent");
  assert.strictEqual(transfers.unverifiable, true);
  assert.ok(trace.items.filter((i) => i.status !== "absent").every((i) => !i.unverifiable));
});

test("a scan without policy text yields no checklist instead of 13 absents", async () => {
  const { judge, client } = fakeJudge();
  const res = await judgePrivacyPolicy({ meta: {}, legalPageContent: null }, judge);
  assert.deepStrictEqual(res.findings, {});
  assert.match(res.trace.skipped, /no privacy policy/);
  assert.strictEqual(client.calls.length, 0);
});

test("judged output passes validate-analysis.js when applied to a real analysis", async () => {
  const { judge } = fakeJudge();
  const judged = await judgeScan(exampleScan(), judge);
  const base = readJson(path.join(__dirname, "..", "..", "docs", "examples", "datagobes.dev", "analysis.json"));
  const merged = applyToAnalysis(base, judged);
  assert.strictEqual(merged.findings.privacyPolicyAnalysis.length, 13);
  assert.deepStrictEqual(merged.scores, base.scores);

  const os = require("os");
  const { spawnSync } = require("child_process");
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "judge-")), "analysis.json");
  fs.writeFileSync(tmp, JSON.stringify(merged));
  const r = spawnSync(process.execPath, [path.join(__dirname, "..", "..", "scripts", "validate-analysis.js"), tmp], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});
