# DPA Complaint Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/file-dpa-complaint` slash command to the `privacy-scan` skill that turns a scan JSON into a ready-to-submit GDPR complaint dossier (letter + PDF + evidence folder) for a user-chosen DPA.

**Architecture:** New slash command entry point (`scripts/file-dpa-complaint.js`) orchestrates ten small single-responsibility modules under `scripts/complaint/`. Per-DPA adapters are JSON data files (not code) under `references/dpa-adapters/`. Article text (GDPR/ePrivacy) and Handlebars templates live under `references/`. No scanner pipeline changes; the command reads existing scan JSON.

**Tech Stack:** Node.js (CommonJS, already in `package.json`). New runtime dep: `handlebars`. PDF generation reuses Playwright's bundled chromium. Tests use Node's built-in `node:test` runner (zero new deps).

**Source of truth:** [docs/design/specs/2026-04-24-dpa-complaint-builder-design.md](../specs/2026-04-24-dpa-complaint-builder-design.md).

---

## Phase 0 — Prerequisites

### Task 1: Add `schemaVersion` to scanner analysis schema

The complaint builder needs to refuse incompatible scan JSON. The scanner's analysis schema currently has no version field. We add one as a soft prerequisite.

**Files:**
- Modify: `templates/analysis-schema.json`
- Modify: `scripts/scan.js` — emit `meta.schemaVersion: "1"` in produced JSON

- [ ] **Step 1: Add `schemaVersion` to the JSON schema**

In `templates/analysis-schema.json`, inside `properties.meta.properties`, add after the existing `domain` entry:

```json
"schemaVersion": { "type": "string", "description": "Scan schema version. Complaint builder refuses incompatible versions.", "enum": ["1"] },
```

Also add `"schemaVersion"` to `properties.meta.required` array.

- [ ] **Step 2: Emit `schemaVersion` from the scanner**

Find the location in `scripts/scan.js` where the `meta` object is assembled (search for the literal string `domain:` inside a JSON/object builder). Add `schemaVersion: "1",` as the first property of the meta object.

- [ ] **Step 3: Smoke-verify the scanner still runs**

Run: `cd $SKILL_DIR && node scripts/scan.js https://example.com --scout 2>&1 | tail -5`
Expected: valid JSON on stdout containing `"schemaVersion":"1"` in the output. If the scout output doesn't include meta, instead run a light full scan and grep the JSON file for the field.

- [ ] **Step 4: Commit**

```bash
git add templates/analysis-schema.json scripts/scan.js
git commit -m "feat(scan): emit meta.schemaVersion so downstream tools can gate compatibility"
```

---

### Task 2: Set up the test runner and directory skeleton

Standardise on Node's built-in `node:test` for the new code. No new dependency; works out of the box on Node 18+.

**Files:**
- Modify: `package.json` — add `test` script
- Create: `tests/complaint/.gitkeep`
- Create: `tests/e2e/.gitkeep`
- Create: `tests/fixtures/.gitkeep`

- [ ] **Step 1: Update `package.json`**

Replace the existing `scripts.test` line with:

```json
"scripts": {
  "test": "node --test tests/complaint tests/e2e",
  "test:watch": "node --test --watch tests/complaint tests/e2e"
},
```

- [ ] **Step 2: Create test directory skeleton**

```bash
mkdir -p tests/complaint tests/e2e tests/fixtures
touch tests/complaint/.gitkeep tests/e2e/.gitkeep tests/fixtures/.gitkeep
```

- [ ] **Step 3: Verify the runner starts cleanly with no tests**

Run: `npm test`
Expected: exit 0, output "tests 0", no errors. (`node --test` treats zero tests as a pass.)

- [ ] **Step 4: Commit**

```bash
git add package.json tests/
git commit -m "chore(tests): adopt node:test runner for complaint builder test suite"
```

---

### Task 3: Create the minimal scan fixture

Every complaint-builder test reads a scan JSON. Create one small but structurally complete fixture that exercises the scan shape the builder relies on: meta with schemaVersion, one cross-border finding, one pre-consent tracker, one cookie, one legal-pages gap, one dark-pattern finding.

**Files:**
- Create: `tests/fixtures/sample-scan.json`

- [ ] **Step 1: Write the fixture**

Create `tests/fixtures/sample-scan.json` with this content:

```json
{
  "meta": {
    "schemaVersion": "1",
    "domain": "example-tracker.test",
    "scanDate": "2026-04-01T10:00:00Z",
    "url": "https://example-tracker.test",
    "overallScore": 3.8
  },
  "scores": {
    "consent": 2.5,
    "preConsentTracking": 2.0,
    "legalPages": 4.0,
    "crossBorder": 3.0,
    "securityHeaders": 6.0,
    "cookieManagement": 3.5,
    "darkPatterns": 4.0
  },
  "findings": {
    "consent": {
      "bannerDetected": true,
      "rejectSymmetry": "asymmetric",
      "rejectAccessible": false,
      "cmpPlatform": "Custom"
    },
    "darkPatterns": {
      "tilt": "strong-accept",
      "factors": ["reject-button-hidden", "accept-pre-highlighted"]
    },
    "trackers": [
      {
        "domain": "google-analytics.com",
        "category": "analytics",
        "preConsent": true,
        "jurisdiction": "US",
        "dpfCertified": true,
        "purpose": "Site analytics"
      }
    ],
    "cookies": [
      {
        "name": "_ga",
        "domain": ".example-tracker.test",
        "firstParty": true,
        "preConsent": true,
        "durationDays": 730,
        "purpose": "analytics"
      }
    ],
    "thirdPartyDomains": [
      { "domain": "google-analytics.com", "requests": 4, "jurisdiction": "US" }
    ],
    "legalPages": {
      "privacyPolicyFound": true,
      "cookiePolicyFound": false,
      "privacyPolicyArticles": { "art13CoverageScore": 0.4 }
    },
    "crossBorder": {
      "nonEuTransfersDetected": true,
      "dpfReliedUpon": true,
      "otherSafeguards": []
    },
    "controller": {
      "registeredName": "Example Tracker BV",
      "country": "NL",
      "imprintUrl": "https://example-tracker.test/imprint"
    }
  },
  "slides": { "include": [] }
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/fixtures/sample-scan.json
git commit -m "test(complaint): add minimal sample scan fixture"
```

---

## Phase 1 — Adapter infrastructure

### Task 4: Write the DPA adapter JSON schema

The adapter schema is the contract community contributors must satisfy to add a new DPA. Write it before writing any adapters.

**Files:**
- Create: `references/dpa-adapters/_schema.json`
- Create: `tests/complaint/validate-adapter.test.js`

- [ ] **Step 1: Write the schema**

Create `references/dpa-adapters/_schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DPA Adapter",
  "description": "Data file defining one Data Protection Authority the complaint builder can target.",
  "type": "object",
  "required": ["id", "name", "country", "jurisdiction", "languages", "letterLanguage", "submission", "form", "enforcementFocus", "procedural"],
  "additionalProperties": false,
  "properties": {
    "id":            { "type": "string", "pattern": "^[a-z]{2}-[a-z0-9-]+$", "description": "Stable id, e.g. nl-ap, fr-cnil" },
    "name":          { "type": "string", "minLength": 2 },
    "country":       { "type": "string", "pattern": "^[A-Z]{2}$", "description": "ISO 3166-1 alpha-2" },
    "jurisdiction":  { "type": "string" },
    "languages":     { "type": "array", "items": { "type": "string", "pattern": "^[a-z]{2}$" }, "minItems": 1 },
    "letterLanguage":{ "type": "string", "pattern": "^[a-z]{2}$", "description": "Default language for the generated letter" },
    "submission": {
      "type": "object",
      "required": ["portalUrl", "acceptsEmail", "acceptsPost"],
      "additionalProperties": false,
      "properties": {
        "portalUrl":      { "type": "string", "format": "uri" },
        "acceptsEmail":   { "type": "boolean" },
        "email":          { "type": "string", "format": "email" },
        "acceptsPost":    { "type": "boolean" },
        "postalAddress":  { "type": "string" }
      }
    },
    "form": {
      "type": "object",
      "required": ["requiredFields", "fieldMapping", "attachmentsAccepted", "maxTotalAttachmentMB"],
      "additionalProperties": false,
      "properties": {
        "requiredFields":       { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "fieldMapping":         { "type": "object", "additionalProperties": { "type": "string" } },
        "attachmentsAccepted":  { "type": "array", "items": { "type": "string", "enum": ["pdf", "png", "jpg", "jpeg", "txt", "md", "csv", "json", "zip"] } },
        "maxTotalAttachmentMB": { "type": "integer", "minimum": 1 }
      }
    },
    "enforcementFocus": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["article", "weight"],
        "additionalProperties": false,
        "properties": {
          "article": { "type": "string" },
          "weight":  { "type": "string", "enum": ["high", "medium", "low"] }
        }
      }
    },
    "enforcementExamples": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["year", "target", "articles"],
        "additionalProperties": false,
        "properties": {
          "year":     { "type": "integer", "minimum": 2018 },
          "target":   { "type": "string" },
          "fine":     { "type": "string" },
          "articles": { "type": "array", "items": { "type": "string" }, "minItems": 1 }
        }
      }
    },
    "procedural": {
      "type": "object",
      "required": ["responseTimeMonths", "acknowledgementExpected", "canFileInEnglish", "notes"],
      "additionalProperties": false,
      "properties": {
        "responseTimeMonths":       { "type": "integer", "minimum": 1 },
        "acknowledgementExpected":  { "type": "boolean" },
        "canFileInEnglish":         { "type": "boolean" },
        "notes":                    { "type": "string" }
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add references/dpa-adapters/_schema.json
git commit -m "feat(complaint): DPA adapter JSON schema"
```

---

### Task 5: Write the adapter validator module + CLI

Single validator used by both tests and the `validate-adapter.js` CLI.

**Files:**
- Create: `scripts/complaint/validate-adapter-lib.js`
- Create: `scripts/validate-adapter.js`
- Create: `tests/complaint/validate-adapter.test.js`
- Create: `tests/fixtures/sample-adapter.json`
- Create: `tests/fixtures/invalid-adapter.json`

- [ ] **Step 1: Write the fixtures**

`tests/fixtures/sample-adapter.json`:

```json
{
  "id": "xx-test",
  "name": "Test Authority",
  "country": "XX",
  "jurisdiction": "Test",
  "languages": ["en"],
  "letterLanguage": "en",
  "submission": {
    "portalUrl": "https://example.test/complain",
    "acceptsEmail": true,
    "email": "test@example.test",
    "acceptsPost": false
  },
  "form": {
    "requiredFields": ["complainantName", "complainantEmail", "controllerName"],
    "fieldMapping": { "complainantName": "Your name" },
    "attachmentsAccepted": ["pdf", "png"],
    "maxTotalAttachmentMB": 10
  },
  "enforcementFocus": [
    { "article": "Art. 6", "weight": "high" }
  ],
  "procedural": {
    "responseTimeMonths": 3,
    "acknowledgementExpected": true,
    "canFileInEnglish": true,
    "notes": "Test fixture."
  }
}
```

`tests/fixtures/invalid-adapter.json`:

```json
{
  "id": "BAD-ID",
  "name": "X"
}
```

- [ ] **Step 2: Write failing tests**

`tests/complaint/validate-adapter.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { validateAdapter } = require('../../scripts/complaint/validate-adapter-lib');

const fixturesDir = path.join(__dirname, '..', 'fixtures');
const valid = require(path.join(fixturesDir, 'sample-adapter.json'));
const invalid = require(path.join(fixturesDir, 'invalid-adapter.json'));

test('validateAdapter accepts a well-formed adapter', () => {
  const result = validateAdapter(valid);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('validateAdapter rejects an adapter missing required fields', () => {
  const result = validateAdapter(invalid);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 3, 'expected multiple errors');
});

test('validateAdapter rejects an invalid id pattern', () => {
  const bad = { ...valid, id: 'NL_AP' };
  const result = validateAdapter(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.path === '/id'));
});

test('validateAdapter rejects unknown top-level fields', () => {
  const bad = { ...valid, surpriseField: 'nope' };
  const result = validateAdapter(bad);
  assert.equal(result.ok, false);
});
```

- [ ] **Step 3: Run test — expect failure**

Run: `npm test -- --test-name-pattern=validateAdapter`
Expected: all four fail with "Cannot find module '../../scripts/complaint/validate-adapter-lib'".

- [ ] **Step 4: Write the validator module**

`scripts/complaint/validate-adapter-lib.js`:

```javascript
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'references', 'dpa-adapters', '_schema.json');
let cachedSchema;

function loadSchema() {
  if (!cachedSchema) cachedSchema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return cachedSchema;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function validateAgainst(schema, value, pathStr, errors) {
  if (schema.type && typeOf(value) !== schema.type) {
    errors.push({ path: pathStr || '/', message: `expected ${schema.type}, got ${typeOf(value)}` });
    return;
  }
  if (schema.type === 'object') {
    const props = schema.properties || {};
    const required = schema.required || [];
    for (const key of required) {
      if (!(key in (value || {}))) errors.push({ path: `${pathStr}/${key}`, message: 'required' });
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value || {})) {
        if (!(key in props)) errors.push({ path: `${pathStr}/${key}`, message: 'unknown property' });
      }
    }
    for (const [key, childSchema] of Object.entries(props)) {
      if (key in (value || {})) validateAgainst(childSchema, value[key], `${pathStr}/${key}`, errors);
    }
  } else if (schema.type === 'array') {
    if (schema.minItems != null && value.length < schema.minItems) {
      errors.push({ path: pathStr, message: `minItems ${schema.minItems}` });
    }
    if (schema.items) {
      value.forEach((item, i) => validateAgainst(schema.items, item, `${pathStr}/${i}`, errors));
    }
  } else if (schema.type === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) {
      errors.push({ path: pathStr, message: `minLength ${schema.minLength}` });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({ path: pathStr, message: `does not match pattern ${schema.pattern}` });
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({ path: pathStr, message: `not one of ${schema.enum.join(',')}` });
    }
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value)) errors.push({ path: pathStr, message: 'not an integer' });
    else if (schema.minimum != null && value < schema.minimum) errors.push({ path: pathStr, message: `minimum ${schema.minimum}` });
  } else if (schema.type === 'boolean') {
    // type check above is sufficient
  }
}

function validateAdapter(adapter) {
  const schema = loadSchema();
  const errors = [];
  validateAgainst(schema, adapter, '', errors);
  return { ok: errors.length === 0, errors };
}

module.exports = { validateAdapter };
```

- [ ] **Step 5: Run tests — expect pass**

Run: `npm test -- --test-name-pattern=validateAdapter`
Expected: all four pass.

- [ ] **Step 6: Write the CLI wrapper**

`scripts/validate-adapter.js`:

```javascript
#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { validateAdapter } = require('./complaint/validate-adapter-lib');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/validate-adapter.js <adapter.json>');
  process.exit(2);
}

let adapter;
try {
  adapter = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`Failed to read/parse ${file}: ${err.message}`);
  process.exit(2);
}

const { ok, errors } = validateAdapter(adapter);
if (ok) {
  console.log(`OK: ${path.basename(file)} is a valid DPA adapter.`);
  process.exit(0);
}
console.error(`INVALID: ${path.basename(file)}`);
for (const e of errors) console.error(`  ${e.path || '/'}: ${e.message}`);
process.exit(1);
```

- [ ] **Step 7: Smoke-test the CLI**

Run: `node scripts/validate-adapter.js tests/fixtures/sample-adapter.json`
Expected: prints `OK: sample-adapter.json is a valid DPA adapter.`, exit 0.

Run: `node scripts/validate-adapter.js tests/fixtures/invalid-adapter.json; echo "exit=$?"`
Expected: prints `INVALID:` followed by error lines, exit 1.

- [ ] **Step 8: Commit**

```bash
git add scripts/complaint/validate-adapter-lib.js scripts/validate-adapter.js tests/complaint/validate-adapter.test.js tests/fixtures/sample-adapter.json tests/fixtures/invalid-adapter.json
git commit -m "feat(complaint): DPA adapter validator library + CLI"
```

---

### Task 6: Write the three seed DPA adapters

Each adapter is a pure JSON file. Fields that need verification against official sources (portal URLs, postal addresses, fine amounts, current policy) must be fetched at author time — do **not** invent them. Use `WebFetch` against the official DPA pages to get current values.

**Files:**
- Create: `references/dpa-adapters/nl-ap.json`
- Create: `references/dpa-adapters/fr-cnil.json`
- Create: `references/dpa-adapters/uk-ico.json`
- Create: `tests/complaint/seed-adapters.test.js`

- [ ] **Step 1: Verify official source values**

For each authority, fetch the current complaint portal and contact details:

- Dutch AP: `https://autoriteitpersoonsgegevens.nl/en/contact-the-dutch-dpa/tip-us-off` (or equivalent English complaint page)
- CNIL: `https://www.cnil.fr/en/plaintes`
- ICO: `https://ico.org.uk/make-a-complaint/`

Record: complaint portal URL, whether the authority accepts email (and which email), postal address, typical response-time commitment, whether complaints can be filed in English.

If any authority has published an up-to-date set of enforcement examples on their site, note 2–3 high-profile cookie/consent fines from 2022–2025 for the `enforcementExamples` array.

- [ ] **Step 2: Write `nl-ap.json`**

Template (replace bracketed placeholders with verified values from Step 1):

```json
{
  "id": "nl-ap",
  "name": "Autoriteit Persoonsgegevens",
  "country": "NL",
  "jurisdiction": "Netherlands",
  "languages": ["nl", "en"],
  "letterLanguage": "en",
  "submission": {
    "portalUrl": "[VERIFIED URL]",
    "acceptsEmail": true,
    "email": "[VERIFIED EMAIL]",
    "acceptsPost": true,
    "postalAddress": "[VERIFIED ADDRESS]"
  },
  "form": {
    "requiredFields": ["complainantName", "complainantAddress", "complainantEmail", "controllerName", "controllerDomain", "factsSummary", "articlesCited"],
    "fieldMapping": {
      "complainantName": "Uw naam",
      "complainantAddress": "Uw adres",
      "complainantEmail": "Uw e-mailadres",
      "controllerName": "Naam van de organisatie",
      "controllerDomain": "Website",
      "factsSummary": "Omschrijving van uw klacht",
      "articlesCited": "Welke regels zijn volgens u overtreden"
    },
    "attachmentsAccepted": ["pdf", "png", "jpg"],
    "maxTotalAttachmentMB": 25
  },
  "enforcementFocus": [
    { "article": "Art. 6",            "weight": "high"   },
    { "article": "Art. 7",            "weight": "high"   },
    { "article": "ePrivacy Art. 5(3)", "weight": "high"   },
    { "article": "Art. 13",           "weight": "medium" },
    { "article": "Ch. V",             "weight": "medium" }
  ],
  "enforcementExamples": [
    { "year": [YEAR], "target": "[VERIFIED CASE]", "fine": "[VERIFIED AMOUNT]", "articles": ["[ARTICLES]"] }
  ],
  "procedural": {
    "responseTimeMonths": 3,
    "acknowledgementExpected": true,
    "canFileInEnglish": true,
    "notes": "[NOTES FROM OFFICIAL PAGE — any quirks like 'Dutch preferred but English accepted', or a statement that the AP is the Dutch one-stop-shop lead for companies HQ'd in NL.]"
  }
}
```

- [ ] **Step 3: Write `fr-cnil.json`**

Same shape as `nl-ap.json`, with values verified from CNIL's official complaint page. Enforcement examples should reference well-known recent cookie/consent fines (e.g., Google, Amazon, Microsoft — CNIL's public decisions are at `https://www.cnil.fr/fr/cnil-direct/la-cnil-sanctionne`). `letterLanguage` remains `"en"` unless the spec is later updated.

- [ ] **Step 4: Write `uk-ico.json`**

Same shape, values verified from ICO's official pages. Note UK GDPR is near-identical to EU GDPR; the adapter's `enforcementFocus` list can reuse the same article ids. ICO's public actions are at `https://ico.org.uk/action-weve-taken/enforcement/`.

- [ ] **Step 5: Write the validation test**

`tests/complaint/seed-adapters.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateAdapter } = require('../../scripts/complaint/validate-adapter-lib');

const adaptersDir = path.join(__dirname, '..', '..', 'references', 'dpa-adapters');
const seedIds = ['nl-ap', 'fr-cnil', 'uk-ico'];

for (const id of seedIds) {
  test(`seed adapter ${id} is valid`, () => {
    const file = path.join(adaptersDir, `${id}.json`);
    const adapter = JSON.parse(fs.readFileSync(file, 'utf8'));
    const { ok, errors } = validateAdapter(adapter);
    assert.equal(ok, true, `Errors: ${JSON.stringify(errors, null, 2)}`);
    assert.equal(adapter.id, id, 'id must match filename');
  });
}
```

- [ ] **Step 6: Run tests — expect pass**

Run: `npm test -- --test-name-pattern="seed adapter"`
Expected: three pass.

- [ ] **Step 7: Commit**

```bash
git add references/dpa-adapters/nl-ap.json references/dpa-adapters/fr-cnil.json references/dpa-adapters/uk-ico.json tests/complaint/seed-adapters.test.js
git commit -m "feat(complaint): seed adapters for Dutch AP, CNIL, and ICO"
```

---

## Phase 2 — Infrastructure modules

### Task 7: `load-scan.js` — read and validate scan JSON

**Files:**
- Create: `scripts/complaint/load-scan.js`
- Create: `tests/complaint/load-scan.test.js`

- [ ] **Step 1: Write failing tests**

`tests/complaint/load-scan.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { loadScan } = require('../../scripts/complaint/load-scan');

const fixture = path.join(__dirname, '..', 'fixtures', 'sample-scan.json');

test('loadScan returns scan JSON for a valid file', () => {
  const result = loadScan(fixture);
  assert.equal(result.meta.domain, 'example-tracker.test');
  assert.equal(result.meta.schemaVersion, '1');
});

test('loadScan throws a descriptive error for a missing file', () => {
  assert.throws(() => loadScan('/tmp/does-not-exist-xyz.json'), /Cannot read scan/);
});

test('loadScan throws for invalid JSON', () => {
  const tmp = path.join(os.tmpdir(), `bad-${Date.now()}.json`);
  fs.writeFileSync(tmp, '{ not json');
  try {
    assert.throws(() => loadScan(tmp), /Invalid JSON/);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('loadScan throws for missing meta.schemaVersion', () => {
  const tmp = path.join(os.tmpdir(), `no-version-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ meta: { domain: 'x.test' }, findings: {} }));
  try {
    assert.throws(() => loadScan(tmp), /schemaVersion/);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('loadScan throws for unsupported schemaVersion', () => {
  const tmp = path.join(os.tmpdir(), `wrong-version-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ meta: { schemaVersion: '99', domain: 'x.test' }, findings: {} }));
  try {
    assert.throws(() => loadScan(tmp), /Unsupported schemaVersion/);
  } finally {
    fs.unlinkSync(tmp);
  }
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- --test-name-pattern=loadScan`
Expected: all five fail with "Cannot find module".

- [ ] **Step 3: Implement**

`scripts/complaint/load-scan.js`:

```javascript
const fs = require('node:fs');

const SUPPORTED_VERSIONS = new Set(['1']);

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
  const version = parsed && parsed.meta && parsed.meta.schemaVersion;
  if (!version) throw new Error(`Missing meta.schemaVersion in ${filePath}`);
  if (!SUPPORTED_VERSIONS.has(version)) {
    throw new Error(`Unsupported schemaVersion "${version}" (supported: ${[...SUPPORTED_VERSIONS].join(', ')})`);
  }
  return parsed;
}

module.exports = { loadScan, SUPPORTED_VERSIONS };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- --test-name-pattern=loadScan`
Expected: all five pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/complaint/load-scan.js tests/complaint/load-scan.test.js
git commit -m "feat(complaint): load-scan module with schema-version gate"
```

---

### Task 8: `draft-state.js` — resumable run state

**Files:**
- Create: `scripts/complaint/draft-state.js`
- Create: `tests/complaint/draft-state.test.js`

- [ ] **Step 1: Write failing tests**

`tests/complaint/draft-state.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readDraft, writeDraft, deleteDraft, draftPath } = require('../../scripts/complaint/draft-state');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'draft-test-'));
}

test('draftPath builds expected filename from slug + output dir', () => {
  const p = draftPath('/tmp/x', 'example-com');
  assert.equal(p, '/tmp/x/.complaint-draft-example-com.json');
});

test('readDraft returns null when no draft file exists', () => {
  const dir = tmpDir();
  assert.equal(readDraft(dir, 'any-slug'), null);
});

test('writeDraft then readDraft round-trips state', () => {
  const dir = tmpDir();
  const state = { step: 'curation', dpaId: 'nl-ap', curated: ['finding-a'] };
  writeDraft(dir, 'example-com', state);
  const loaded = readDraft(dir, 'example-com');
  assert.deepEqual(loaded, state);
});

test('deleteDraft removes the file; is a no-op when absent', () => {
  const dir = tmpDir();
  writeDraft(dir, 'example-com', { step: 'foo' });
  deleteDraft(dir, 'example-com');
  assert.equal(readDraft(dir, 'example-com'), null);
  assert.doesNotThrow(() => deleteDraft(dir, 'example-com'));
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- --test-name-pattern="draft"`
Expected: all four fail.

- [ ] **Step 3: Implement**

`scripts/complaint/draft-state.js`:

```javascript
const fs = require('node:fs');
const path = require('node:path');

function draftPath(outputDir, slug) {
  return path.join(outputDir, `.complaint-draft-${slug}.json`);
}

function readDraft(outputDir, slug) {
  const p = draftPath(outputDir, slug);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeDraft(outputDir, slug, state) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(draftPath(outputDir, slug), JSON.stringify(state, null, 2));
}

function deleteDraft(outputDir, slug) {
  const p = draftPath(outputDir, slug);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

module.exports = { draftPath, readDraft, writeDraft, deleteDraft };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- --test-name-pattern="draft"`
Expected: all four pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/complaint/draft-state.js tests/complaint/draft-state.test.js
git commit -m "feat(complaint): resumable draft-state module"
```

---

### Task 9: `load-profile.js` — complainant profile I/O

**Files:**
- Create: `scripts/complaint/load-profile.js`
- Create: `tests/complaint/load-profile.test.js`

- [ ] **Step 1: Write failing tests**

`tests/complaint/load-profile.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readProfile, writeProfile, anonymizedProfile } = require('../../scripts/complaint/load-profile');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'profile-home-'));
}

test('readProfile returns null when file is absent', () => {
  const home = tmpHome();
  assert.equal(readProfile(home), null);
});

test('writeProfile then readProfile round-trips and prepends a warning comment', () => {
  const home = tmpHome();
  const profile = { fullName: 'Jane Doe', email: 'j@example.test', postalAddress: { street: '1 Main St', city: 'Town', postalCode: '0000', country: 'NL' }, dataSubjectStatus: 'self' };
  writeProfile(home, profile);
  const raw = fs.readFileSync(path.join(home, '.claude', 'privacy-complaint', 'complainant.json'), 'utf8');
  assert.ok(raw.startsWith('//'), 'file must begin with a warning comment');
  const loaded = readProfile(home);
  assert.equal(loaded.fullName, 'Jane Doe');
  assert.equal(loaded.dataSubjectStatus, 'self');
  assert.ok(loaded.createdAt, 'createdAt must be set by writeProfile');
});

test('anonymizedProfile returns placeholder fields', () => {
  const p = anonymizedProfile();
  assert.equal(p.fullName, '[COMPLAINANT NAME]');
  assert.equal(p.email, '[COMPLAINANT EMAIL]');
  assert.equal(p.dataSubjectStatus, 'self');
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- --test-name-pattern=Profile`
Expected: three fail.

- [ ] **Step 3: Implement**

`scripts/complaint/load-profile.js`:

```javascript
const fs = require('node:fs');
const path = require('node:path');

const WARNING = '// Contains personal data. Do not commit to a public repo.\n// Delete with: rm ~/.claude/privacy-complaint/complainant.json\n';

function profilePath(homeDir) {
  return path.join(homeDir, '.claude', 'privacy-complaint', 'complainant.json');
}

function readProfile(homeDir) {
  const p = profilePath(homeDir);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) throw new Error(`Profile at ${p} has no JSON body`);
  return JSON.parse(raw.slice(jsonStart));
}

function writeProfile(homeDir, profile) {
  const full = { ...profile, createdAt: profile.createdAt || new Date().toISOString() };
  const dir = path.dirname(profilePath(homeDir));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(profilePath(homeDir), WARNING + JSON.stringify(full, null, 2));
}

function anonymizedProfile() {
  return {
    fullName: '[COMPLAINANT NAME]',
    email: '[COMPLAINANT EMAIL]',
    postalAddress: {
      street: '[STREET]',
      city: '[CITY]',
      postalCode: '[POSTAL CODE]',
      country: '[COUNTRY]'
    },
    phone: '[PHONE - IF REQUIRED BY DPA]',
    dataSubjectStatus: 'self'
  };
}

module.exports = { readProfile, writeProfile, anonymizedProfile, profilePath };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- --test-name-pattern=Profile`
Expected: three pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/complaint/load-profile.js tests/complaint/load-profile.test.js
git commit -m "feat(complaint): complainant profile I/O with --anonymize helper"
```

---

## Phase 3 — Interactive layer

**Note on interactivity.** The three modules in this phase (`detect-controller`, `select-dpa`, `curate-findings`) each expose a pure function that takes the scan + user answers and returns a decision object, plus a thin prompt wrapper around Node's `readline/promises`. The pure functions are unit-tested directly; the prompt wrappers are tested via the E2E flow with scripted stdin in Phase 8.

### Task 10: `detect-controller.js`

**Files:**
- Create: `scripts/complaint/detect-controller.js`
- Create: `tests/complaint/detect-controller.test.js`

- [ ] **Step 1: Write failing tests**

`tests/complaint/detect-controller.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { detectController, applyOverrides } = require('../../scripts/complaint/detect-controller');

const scan = require(path.join(__dirname, '..', 'fixtures', 'sample-scan.json'));

test('detectController fills domain, country, and registeredName when present', () => {
  const c = detectController(scan);
  assert.equal(c.domain, 'example-tracker.test');
  assert.equal(c.country, 'NL');
  assert.equal(c.registeredName, 'Example Tracker BV');
});

test('detectController leaves placeholders for fields the scanner cannot fill', () => {
  const c = detectController(scan);
  assert.equal(c.postalAddress, '[TO FILL]');
  assert.equal(c.dpoEmail, '[TO FILL]');
});

test('detectController falls back to meta.domain when controller absent', () => {
  const bare = { meta: { domain: 'bare.test', schemaVersion: '1' }, findings: {} };
  const c = detectController(bare);
  assert.equal(c.domain, 'bare.test');
  assert.equal(c.registeredName, '[TO FILL]');
  assert.equal(c.country, '[TO FILL]');
});

test('applyOverrides merges user edits over detected fields', () => {
  const base = detectController(scan);
  const merged = applyOverrides(base, { postalAddress: '10 Canal St, 1000 AB Amsterdam', dpoEmail: 'dpo@ex.test' });
  assert.equal(merged.postalAddress, '10 Canal St, 1000 AB Amsterdam');
  assert.equal(merged.dpoEmail, 'dpo@ex.test');
  assert.equal(merged.domain, base.domain, 'unrelated fields untouched');
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- --test-name-pattern=detectController`
Expected: four fail.

- [ ] **Step 3: Implement**

`scripts/complaint/detect-controller.js`:

```javascript
const PLACEHOLDER = '[TO FILL]';

function detectController(scan) {
  const fromScan = (scan && scan.findings && scan.findings.controller) || {};
  return {
    domain:         (scan && scan.meta && scan.meta.domain) || PLACEHOLDER,
    registeredName: fromScan.registeredName || PLACEHOLDER,
    country:        fromScan.country        || PLACEHOLDER,
    imprintUrl:     fromScan.imprintUrl     || PLACEHOLDER,
    postalAddress:  fromScan.postalAddress  || PLACEHOLDER,
    dpoEmail:       fromScan.dpoEmail       || PLACEHOLDER
  };
}

function applyOverrides(base, overrides) {
  return { ...base, ...overrides };
}

module.exports = { detectController, applyOverrides, PLACEHOLDER };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- --test-name-pattern=detectController`
Expected: four pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/complaint/detect-controller.js tests/complaint/detect-controller.test.js
git commit -m "feat(complaint): detect-controller module with applyOverrides"
```

---

### Task 11: `select-dpa.js`

**Files:**
- Create: `scripts/complaint/select-dpa.js`
- Create: `tests/complaint/select-dpa.test.js`

- [ ] **Step 1: Write failing tests**

`tests/complaint/select-dpa.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { listAdapters, loadAdapter, inferLeadDpa } = require('../../scripts/complaint/select-dpa');

test('listAdapters returns the three seed adapters', () => {
  const ids = listAdapters().map(a => a.id).sort();
  assert.deepEqual(ids, ['fr-cnil', 'nl-ap', 'uk-ico']);
});

test('loadAdapter returns full adapter data by id', () => {
  const nl = loadAdapter('nl-ap');
  assert.equal(nl.country, 'NL');
  assert.ok(nl.submission.portalUrl.startsWith('http'));
});

test('loadAdapter throws for unknown id', () => {
  assert.throws(() => loadAdapter('zz-unknown'), /Unknown DPA id/);
});

test('inferLeadDpa returns the controller country DPA when available', () => {
  const scan = { findings: { controller: { country: 'NL' } } };
  assert.equal(inferLeadDpa(scan), 'nl-ap');
});

test('inferLeadDpa returns null when controller country is unknown or unsupported', () => {
  assert.equal(inferLeadDpa({ findings: {} }), null);
  assert.equal(inferLeadDpa({ findings: { controller: { country: 'DE' } } }), null);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- --test-name-pattern=DPA`
Expected: five fail.

- [ ] **Step 3: Implement**

`scripts/complaint/select-dpa.js`:

```javascript
const fs = require('node:fs');
const path = require('node:path');

const ADAPTERS_DIR = path.join(__dirname, '..', '..', 'references', 'dpa-adapters');
const COUNTRY_TO_ADAPTER = { NL: 'nl-ap', FR: 'fr-cnil', GB: 'uk-ico', UK: 'uk-ico' };

function listAdapters() {
  return fs.readdirSync(ADAPTERS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => JSON.parse(fs.readFileSync(path.join(ADAPTERS_DIR, f), 'utf8')));
}

function loadAdapter(id) {
  const file = path.join(ADAPTERS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) throw new Error(`Unknown DPA id: ${id}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function inferLeadDpa(scan) {
  const country = scan && scan.findings && scan.findings.controller && scan.findings.controller.country;
  if (!country) return null;
  return COUNTRY_TO_ADAPTER[country] || null;
}

module.exports = { listAdapters, loadAdapter, inferLeadDpa };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- --test-name-pattern=DPA`
Expected: five pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/complaint/select-dpa.js tests/complaint/select-dpa.test.js
git commit -m "feat(complaint): select-dpa module (list/load/inferLead)"
```

---

### Task 12: `curate-findings.js`

This module takes a scan and returns an ordered list of candidate findings, each with an `actionable` flag pre-selected based on article match. Mapping logic stays in one place.

**Files:**
- Create: `scripts/complaint/curate-findings.js`
- Create: `tests/complaint/curate-findings.test.js`

- [ ] **Step 1: Write failing tests**

`tests/complaint/curate-findings.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { extractCandidates, applyUserChoices } = require('../../scripts/complaint/curate-findings');

const scan = require(path.join(__dirname, '..', 'fixtures', 'sample-scan.json'));

test('extractCandidates surfaces pre-consent tracker as actionable', () => {
  const cands = extractCandidates(scan);
  const tracker = cands.find(c => c.kind === 'preConsentTracker');
  assert.ok(tracker, 'pre-consent tracker candidate must exist');
  assert.equal(tracker.actionable, true);
  assert.ok(tracker.articles.includes('Art. 6'));
  assert.ok(tracker.articles.includes('ePrivacy Art. 5(3)'));
});

test('extractCandidates surfaces dark pattern as actionable with EDPB reference', () => {
  const cands = extractCandidates(scan);
  const dp = cands.find(c => c.kind === 'darkPattern');
  assert.ok(dp);
  assert.equal(dp.actionable, true);
  assert.ok(dp.articles.some(a => a.includes('EDPB')));
});

test('extractCandidates includes non-actionable findings flagged false', () => {
  const cands = extractCandidates(scan);
  assert.ok(cands.some(c => c.actionable === false), 'at least one non-actionable candidate expected');
});

test('applyUserChoices returns only candidates whose id is confirmed', () => {
  const cands = extractCandidates(scan);
  const firstId = cands[0].id;
  const confirmed = applyUserChoices(cands, { [firstId]: true });
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].id, firstId);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- --test-name-pattern=curate`
Expected: four fail.

- [ ] **Step 3: Implement**

`scripts/complaint/curate-findings.js`:

```javascript
const crypto = require('node:crypto');

function hashId(parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 10);
}

function extractCandidates(scan) {
  const out = [];
  const f = (scan && scan.findings) || {};

  for (const t of f.trackers || []) {
    if (t.preConsent) {
      out.push({
        id: hashId(['tracker', t.domain]),
        kind: 'preConsentTracker',
        headline: `${t.domain} loaded before consent`,
        detail: `Category: ${t.category || 'unknown'}. Jurisdiction: ${t.jurisdiction || 'unknown'}. Purpose: ${t.purpose || 'not stated'}.`,
        articles: ['Art. 6', 'ePrivacy Art. 5(3)'],
        actionable: true,
        evidencePointers: [{ file: 'trackers.csv', domain: t.domain }]
      });
    }
  }

  for (const c of f.cookies || []) {
    if (c.preConsent) {
      out.push({
        id: hashId(['cookie', c.name, c.domain]),
        kind: 'preConsentCookie',
        headline: `Cookie ${c.name} set before consent`,
        detail: `Domain: ${c.domain}. Purpose: ${c.purpose || 'not stated'}. Duration: ${c.durationDays} days.`,
        articles: ['Art. 6', 'ePrivacy Art. 5(3)'],
        actionable: true,
        evidencePointers: [{ file: 'cookies.csv', name: c.name }]
      });
    }
  }

  if (f.darkPatterns && f.darkPatterns.tilt && f.darkPatterns.tilt !== 'neutral') {
    out.push({
      id: hashId(['darkPattern', f.darkPatterns.tilt]),
      kind: 'darkPattern',
      headline: `Consent banner uses dark patterns (${f.darkPatterns.tilt})`,
      detail: `Factors: ${(f.darkPatterns.factors || []).join(', ') || 'none listed'}.`,
      articles: ['Art. 7', 'EDPB Guidelines 03/2022'],
      actionable: true,
      evidencePointers: [{ file: 'screenshots/banner-viewport.png' }]
    });
  }

  if (f.consent && f.consent.rejectAccessible === false) {
    out.push({
      id: hashId(['rejectInaccessible']),
      kind: 'rejectInaccessible',
      headline: 'Reject option not accessible from the first layer',
      detail: 'The consent banner does not expose a reject control at the same level as accept.',
      articles: ['Art. 7', 'Art. 4(11)'],
      actionable: true,
      evidencePointers: [{ file: 'screenshots/banner-viewport.png' }]
    });
  }

  if (f.crossBorder && f.crossBorder.nonEuTransfersDetected) {
    out.push({
      id: hashId(['crossBorder']),
      kind: 'crossBorderTransfer',
      headline: 'Non-EU data transfers without adequate safeguards',
      detail: `DPF relied upon: ${!!f.crossBorder.dpfReliedUpon}. Other safeguards: ${(f.crossBorder.otherSafeguards || []).join(', ') || 'none'}.`,
      articles: ['Ch. V'],
      actionable: true,
      evidencePointers: [{ file: 'trackers.csv' }]
    });
  }

  if (f.legalPages && f.legalPages.privacyPolicyArticles && f.legalPages.privacyPolicyArticles.art13CoverageScore < 0.7) {
    out.push({
      id: hashId(['art13Gap']),
      kind: 'inadequatePrivacyNotice',
      headline: 'Privacy notice does not cover Art. 13 items adequately',
      detail: `Coverage score: ${f.legalPages.privacyPolicyArticles.art13CoverageScore}. Below 0.7 indicates material gaps.`,
      articles: ['Art. 13'],
      actionable: true,
      evidencePointers: []
    });
  }

  if (f.legalPages && f.legalPages.cookiePolicyFound === false) {
    out.push({
      id: hashId(['noCookiePolicy']),
      kind: 'missingCookiePolicy',
      headline: 'No cookie policy found',
      detail: 'Scanner could not identify a dedicated cookie policy.',
      articles: ['Art. 13'],
      actionable: false,
      evidencePointers: []
    });
  }

  return out;
}

function applyUserChoices(candidates, choiceMap) {
  return candidates.filter(c => choiceMap[c.id] === true);
}

module.exports = { extractCandidates, applyUserChoices };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- --test-name-pattern=curate`
Expected: four pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/complaint/curate-findings.js tests/complaint/curate-findings.test.js
git commit -m "feat(complaint): curate-findings (candidate extraction + user confirmation)"
```

---

## Phase 4 — Article text bundles

### Task 13: Bundle GDPR/ePrivacy article text referenced by the curator

Each cited article needs its verbatim text in a file under `references/article-text/`. Articles referenced by the curator's default mappings: GDPR Art. 4(11), Art. 6, Art. 7, Art. 13, Art. 14, Art. 80, Chapter V (Arts. 44–49), and ePrivacy Directive Art. 5(3). Also include EDPB Guidelines 03/2022 on dark patterns as a single file.

**Files:**
- Create: `references/article-text/gdpr/art-4-11.md`
- Create: `references/article-text/gdpr/art-6.md`
- Create: `references/article-text/gdpr/art-7.md`
- Create: `references/article-text/gdpr/art-13.md`
- Create: `references/article-text/gdpr/art-14.md`
- Create: `references/article-text/gdpr/art-80.md`
- Create: `references/article-text/gdpr/chapter-v.md`
- Create: `references/article-text/eprivacy/art-5-3.md`
- Create: `references/article-text/edpb/guidelines-03-2022.md`
- Create: `tests/complaint/article-text.test.js`

- [ ] **Step 1: Fetch verbatim text from authoritative sources**

For GDPR articles use EUR-Lex Regulation (EU) 2016/679: `https://eur-lex.europa.eu/eli/reg/2016/679/oj`.
For ePrivacy Art. 5(3) use Directive 2002/58/EC as amended: `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A02002L0058-20091219`.
For EDPB Guidelines 03/2022 use the EDPB adopted version: `https://edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-032022-deceptive-design-patterns-social-media_en`.

Per-file format (example for `gdpr/art-6.md`):

```markdown
# GDPR Article 6 — Lawfulness of processing

**Source:** Regulation (EU) 2016/679, Article 6.
**Retrieved:** 2026-04-24 from https://eur-lex.europa.eu/eli/reg/2016/679/oj

---

1. Processing shall be lawful only if and to the extent that at least one of the following applies:

(a) the data subject has given consent to the processing of his or her personal data for one or more specific purposes;

…

[VERBATIM TEXT OF THE ARTICLE]
```

Rules:

- Copy the English authoritative text verbatim. Do not paraphrase.
- Include the source URL and retrieval date at the top of each file (these are public-domain EU legal instruments; verbatim use is fine).
- For `chapter-v.md`, include Arts. 44, 45, 46, 47, 48, 49 verbatim under one file.
- For the EDPB guidelines file, include the title, adoption date, and a 1-paragraph summary above a link to the full PDF; do not paste the full guidelines (they're long). This file is referenced, not quoted wholesale.

- [ ] **Step 2: Write the presence/size test**

`tests/complaint/article-text.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = path.join(__dirname, '..', '..', 'references', 'article-text');

const required = [
  'gdpr/art-4-11.md',
  'gdpr/art-6.md',
  'gdpr/art-7.md',
  'gdpr/art-13.md',
  'gdpr/art-14.md',
  'gdpr/art-80.md',
  'gdpr/chapter-v.md',
  'eprivacy/art-5-3.md',
  'edpb/guidelines-03-2022.md'
];

for (const rel of required) {
  test(`article text file exists and is non-trivial: ${rel}`, () => {
    const p = path.join(base, rel);
    assert.ok(fs.existsSync(p), `missing: ${rel}`);
    const content = fs.readFileSync(p, 'utf8');
    assert.ok(content.length > 200, `file too short: ${rel}`);
    assert.ok(/Source:/.test(content), `missing Source line: ${rel}`);
    assert.ok(/Retrieved:/.test(content), `missing Retrieved line: ${rel}`);
  });
}
```

- [ ] **Step 3: Run tests — expect pass**

Run: `npm test -- --test-name-pattern="article text"`
Expected: nine pass.

- [ ] **Step 4: Commit**

```bash
git add references/article-text tests/complaint/article-text.test.js
git commit -m "feat(complaint): bundle GDPR/ePrivacy/EDPB article text"
```

---

## Phase 5 — Templates & renderers

### Task 14: Install `handlebars` and write templates

**Files:**
- Modify: `package.json` — add dependency
- Create: `references/complaint-templates/letter.md.hbs`
- Create: `references/complaint-templates/facts-section.md.hbs`
- Create: `references/complaint-templates/readme.md.hbs`
- Create: `references/complaint-templates/checklist.md.hbs`

- [ ] **Step 1: Install handlebars**

Run: `cd $SKILL_DIR && npm install handlebars --save`
Expected: `handlebars` added to `dependencies` in `package.json`, lockfile updated.

- [ ] **Step 2: Write `letter.md.hbs`**

`references/complaint-templates/letter.md.hbs`:

```handlebars
# Complaint under Regulation (EU) 2016/679 and Directive 2002/58/EC

**To:** {{dpa.name}}
{{#if dpa.submission.postalAddress}}{{dpa.submission.postalAddress}}{{/if}}

**From:**
{{complainant.fullName}}
{{complainant.postalAddress.street}}
{{complainant.postalAddress.postalCode}} {{complainant.postalAddress.city}}
{{complainant.postalAddress.country}}
Email: {{complainant.email}}
{{#if complainant.phone}}Phone: {{complainant.phone}}{{/if}}

**Concerning:** {{controller.registeredName}} ({{controller.domain}})
{{#if controller.postalAddress}}{{controller.postalAddress}}{{/if}}
{{#if controller.dpoEmail}}DPO contact: {{controller.dpoEmail}}{{/if}}

**Date:** {{scanDate}}

---

## 1. Status of the complainant

I am the data subject whose personal data is processed by {{controller.registeredName}} through the website {{controller.domain}}. I submit this complaint under Article 77 of Regulation (EU) 2016/679.

## 2. Summary

On {{scanDate}}, an automated privacy audit of {{controller.domain}} identified {{violationCount}} infringement{{#if (eq violationCount 1)}}{{else}}s{{/if}} of the General Data Protection Regulation and related ePrivacy provisions. Evidence is attached in the accompanying dossier. The articles I allege are infringed are:

{{#each articleList}}
- {{this}}
{{/each}}

## 3. Facts

See the accompanying `facts.md` for a per-article narrative, and `evidence/` for the raw evidence (scan JSON, screenshots, tracker and cookie tables, timeline).

## 4. Request

I respectfully ask the {{dpa.name}} to investigate whether {{controller.registeredName}} is in compliance with the articles listed above, and to take such corrective measures as appropriate under Article 58 GDPR.

## 5. Evidence

- `complaint.pdf` — this letter as PDF
- `facts.md` — per-article narrative
- `articles-cited.md` — verbatim text of cited provisions
- `evidence/scan.json` — full output of the automated audit
- `evidence/scan-summary.md` — human-readable digest
- `evidence/screenshots/` — banner and page screenshots
- `evidence/trackers.csv` — trackers observed
- `evidence/cookies.csv` — cookies observed
- `evidence/timeline.md` — audit trail of pre- and post-consent events

---

*Generated with privacy-scan DPA complaint builder (open source). Reviewed and signed by the complainant.*
```

- [ ] **Step 3: Write `facts-section.md.hbs`**

`references/complaint-templates/facts-section.md.hbs`:

```handlebars
## {{article}} — {{headline}}

**Scanner finding:** {{detail}}

**Cited article text:** see `articles-cited.md`, section "{{article}}".

{{#if enforcementPrecedent}}
**Enforcement precedent:** {{enforcementPrecedent}}
{{/if}}

{{#if evidencePointers.length}}
**Evidence:**
{{#each evidencePointers}}
- `{{this.file}}`{{#if this.domain}} (row: `{{this.domain}}`){{/if}}{{#if this.name}} (row: `{{this.name}}`){{/if}}
{{/each}}
{{/if}}
```

- [ ] **Step 4: Write `readme.md.hbs`**

`references/complaint-templates/readme.md.hbs`:

```handlebars
# Complaint dossier — {{controller.domain}} → {{dpa.name}}

Generated: {{scanDate}}
Scan source: `evidence/scan.json`

## What is in this folder

- `complaint.md` — the complaint letter (markdown source).
- `complaint.pdf` — the same letter as PDF (what most DPAs want attached).
- `facts.md` — per-article narrative of the violations alleged.
- `articles-cited.md` — verbatim text of every GDPR / ePrivacy provision cited.
- `submission-checklist.md` — **start here** — how to actually submit to {{dpa.name}}.
- `evidence/` — the raw proof: scan JSON, screenshots, tracker / cookie CSVs, timeline.

## Before you submit

1. Read `complaint.md` and `facts.md` end-to-end. You are signing this.
2. If anything is wrong, incomplete, or not something you want to defend to {{dpa.name}}, edit it out. This is your filing.
3. Follow `submission-checklist.md` to upload / email / post.

{{#unless anonymized}}
## Reminder

This folder contains your personal data ({{complainant.fullName}}, {{complainant.email}}, postal address). **Do not commit it to a public repository.** If you are using git in this directory, add `dpa-complaint-*` to `.gitignore`.
{{/unless}}
```

- [ ] **Step 5: Write `checklist.md.hbs`**

`references/complaint-templates/checklist.md.hbs`:

```handlebars
# Submission checklist — {{dpa.name}}

## Where to submit

- **Online portal:** {{dpa.submission.portalUrl}}
{{#if dpa.submission.acceptsEmail}}
- **Email:** {{dpa.submission.email}}
{{/if}}
{{#if dpa.submission.acceptsPost}}
- **Postal:** {{dpa.submission.postalAddress}}
{{/if}}

## Language

{{#if dpa.procedural.canFileInEnglish}}
{{dpa.name}} accepts complaints in English. The letter in `complaint.md` is in English and can be submitted as-is.
{{else}}
{{dpa.name}} prefers complaints in {{dpa.letterLanguage}}. The letter in `complaint.md` is a draft — you may need to translate it.
{{/if}}

## What to paste where (portal form)

{{#each dpa.form.fieldMapping}}
- **{{this}}** → (see `complaint.md`, section "{{@key}}")
{{/each}}

## Attachments

Upload the following files:

- `complaint.pdf`
{{#each evidenceFiles}}
- `evidence/{{this}}`
{{/each}}

Maximum total size: {{dpa.form.maxTotalAttachmentMB}} MB.
Accepted formats: {{join dpa.form.attachmentsAccepted ", "}}.

## After submission

{{#if dpa.procedural.acknowledgementExpected}}
{{dpa.name}} will acknowledge receipt. Typical response time: {{dpa.procedural.responseTimeMonths}} months.
{{else}}
Typical response time: {{dpa.procedural.responseTimeMonths}} months.
{{/if}}

{{#if dpa.procedural.notes}}
**Notes from the {{dpa.name}} official site:** {{dpa.procedural.notes}}
{{/if}}
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json references/complaint-templates/
git commit -m "feat(complaint): handlebars dep + dossier templates"
```

---

### Task 15: `render-complaint-md.js`

Produces `complaint.md`, `facts.md`, and `articles-cited.md` from a curated state object.

**Files:**
- Create: `scripts/complaint/render-complaint-md.js`
- Create: `tests/complaint/render-complaint-md.test.js`

- [ ] **Step 1: Write failing tests**

`tests/complaint/render-complaint-md.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { renderLetter, renderFacts, renderArticlesCited } = require('../../scripts/complaint/render-complaint-md');

const state = {
  scanDate: '2026-04-01',
  dpa: require('../../references/dpa-adapters/nl-ap.json'),
  complainant: { fullName: 'Jane Doe', email: 'j@ex.test', postalAddress: { street: '1 A St', postalCode: '0000', city: 'Town', country: 'NL' } },
  controller: { domain: 'example-tracker.test', registeredName: 'Example Tracker BV', country: 'NL', postalAddress: '10 Canal St' },
  selections: [
    { id: 'x1', kind: 'preConsentTracker', headline: 'google-analytics.com loaded before consent', detail: 'Analytics. US jurisdiction.', articles: ['Art. 6', 'ePrivacy Art. 5(3)'], evidencePointers: [{ file: 'trackers.csv', domain: 'google-analytics.com' }] }
  ],
  anonymized: false
};

test('renderLetter includes complainant, controller, and DPA', () => {
  const md = renderLetter(state);
  assert.match(md, /Jane Doe/);
  assert.match(md, /Example Tracker BV/);
  assert.match(md, /Autoriteit Persoonsgegevens/);
  assert.match(md, /Art\. 6/);
});

test('renderLetter deduplicates cited articles across selections', () => {
  const s = { ...state, selections: [state.selections[0], state.selections[0]] };
  const md = renderLetter(s);
  const occurrences = md.match(/^- Art\. 6$/gm) || [];
  assert.equal(occurrences.length, 1, `expected Art. 6 once, got ${occurrences.length}`);
});

test('renderFacts produces one section per selection and names every article', () => {
  const md = renderFacts(state);
  assert.match(md, /google-analytics\.com/);
  assert.match(md, /## Art\. 6/);
  assert.match(md, /## ePrivacy Art\. 5\(3\)/);
});

test('renderArticlesCited includes the verbatim text for every cited article', () => {
  const md = renderArticlesCited(state);
  assert.match(md, /Article 6/);
  assert.match(md, /Article 5\(3\)/);
  assert.match(md, /Source:/);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- --test-name-pattern=render(Letter|Facts|Articles)`
Expected: four fail.

- [ ] **Step 3: Implement**

`scripts/complaint/render-complaint-md.js`:

```javascript
const fs = require('node:fs');
const path = require('node:path');
const Handlebars = require('handlebars');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'references', 'complaint-templates');
const ARTICLE_TEXT_DIR = path.join(__dirname, '..', '..', 'references', 'article-text');

Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('join', (arr, sep) => (arr || []).join(sep));

function loadTemplate(name) {
  return Handlebars.compile(fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8'));
}

function uniqueArticles(selections) {
  const seen = new Set();
  const out = [];
  for (const s of selections) {
    for (const a of s.articles) {
      if (!seen.has(a)) { seen.add(a); out.push(a); }
    }
  }
  return out;
}

function renderLetter(state) {
  const tpl = loadTemplate('letter.md.hbs');
  return tpl({
    ...state,
    articleList: uniqueArticles(state.selections),
    violationCount: state.selections.length
  });
}

function groupByArticle(selections) {
  const out = {};
  for (const s of selections) {
    for (const a of s.articles) {
      (out[a] = out[a] || []).push(s);
    }
  }
  return out;
}

function renderFacts(state) {
  const tpl = loadTemplate('facts-section.md.hbs');
  const grouped = groupByArticle(state.selections);
  const sections = [];
  for (const [article, items] of Object.entries(grouped)) {
    for (const it of items) {
      sections.push(tpl({
        article,
        headline: it.headline,
        detail: it.detail,
        evidencePointers: it.evidencePointers || []
      }));
    }
  }
  return ['# Facts per cited article', '', ...sections].join('\n\n');
}

function articleFilePath(article) {
  const map = {
    'Art. 4(11)':           'gdpr/art-4-11.md',
    'Art. 6':               'gdpr/art-6.md',
    'Art. 7':               'gdpr/art-7.md',
    'Art. 13':              'gdpr/art-13.md',
    'Art. 14':              'gdpr/art-14.md',
    'Art. 80':              'gdpr/art-80.md',
    'Ch. V':                'gdpr/chapter-v.md',
    'ePrivacy Art. 5(3)':   'eprivacy/art-5-3.md',
    'EDPB Guidelines 03/2022': 'edpb/guidelines-03-2022.md'
  };
  return map[article] ? path.join(ARTICLE_TEXT_DIR, map[article]) : null;
}

function renderArticlesCited(state) {
  const chunks = ['# Cited articles (verbatim)\n'];
  for (const article of uniqueArticles(state.selections)) {
    const p = articleFilePath(article);
    if (p && fs.existsSync(p)) {
      chunks.push(fs.readFileSync(p, 'utf8'));
    } else {
      chunks.push(`## ${article}\n\n_Article text not bundled. See the source in the cited instrument._`);
    }
  }
  return chunks.join('\n\n---\n\n');
}

module.exports = { renderLetter, renderFacts, renderArticlesCited };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- --test-name-pattern=render(Letter|Facts|Articles)`
Expected: four pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/complaint/render-complaint-md.js tests/complaint/render-complaint-md.test.js
git commit -m "feat(complaint): render complaint.md, facts.md, articles-cited.md"
```

---

### Task 16: `render-evidence.js`

Produces `evidence/trackers.csv`, `evidence/cookies.csv`, `evidence/timeline.md`, `evidence/scan.json` (copy), `evidence/scan-summary.md` (via `analysis-brief.js` if available, else a minimal inline fallback), and copies selected screenshots.

**Files:**
- Create: `scripts/complaint/render-evidence.js`
- Create: `tests/complaint/render-evidence.test.js`

- [ ] **Step 1: Write failing tests**

`tests/complaint/render-evidence.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeEvidence } = require('../../scripts/complaint/render-evidence');

const scan = require(path.join(__dirname, '..', 'fixtures', 'sample-scan.json'));

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-'));
}

test('writeEvidence writes trackers.csv with only selected rows', () => {
  const dir = tmp();
  const selections = [{ kind: 'preConsentTracker', evidencePointers: [{ file: 'trackers.csv', domain: 'google-analytics.com' }], headline: 'h', articles: ['Art. 6'] }];
  writeEvidence(dir, scan, selections);
  const csv = fs.readFileSync(path.join(dir, 'trackers.csv'), 'utf8');
  assert.match(csv, /domain,category,jurisdiction,pre_consent,purpose/);
  assert.match(csv, /google-analytics\.com,analytics,US,true/);
});

test('writeEvidence writes cookies.csv when a cookie is selected', () => {
  const dir = tmp();
  const selections = [{ kind: 'preConsentCookie', evidencePointers: [{ file: 'cookies.csv', name: '_ga' }], headline: 'h', articles: ['Art. 6'] }];
  writeEvidence(dir, scan, selections);
  const csv = fs.readFileSync(path.join(dir, 'cookies.csv'), 'utf8');
  assert.match(csv, /_ga/);
});

test('writeEvidence copies the raw scan JSON', () => {
  const dir = tmp();
  writeEvidence(dir, scan, []);
  const copied = JSON.parse(fs.readFileSync(path.join(dir, 'scan.json'), 'utf8'));
  assert.equal(copied.meta.domain, scan.meta.domain);
});

test('writeEvidence produces a timeline.md with a heading', () => {
  const dir = tmp();
  writeEvidence(dir, scan, []);
  const tl = fs.readFileSync(path.join(dir, 'timeline.md'), 'utf8');
  assert.match(tl, /# Audit trail/);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- --test-name-pattern=writeEvidence`
Expected: four fail.

- [ ] **Step 3: Implement**

`scripts/complaint/render-evidence.js`:

```javascript
const fs = require('node:fs');
const path = require('node:path');

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeTrackers(dir, scan, selections) {
  const wanted = new Set(
    selections.filter(s => s.kind === 'preConsentTracker')
              .flatMap(s => (s.evidencePointers || []).map(p => p.domain))
              .filter(Boolean)
  );
  const rows = (scan.findings.trackers || []).filter(t => wanted.has(t.domain));
  const header = 'domain,category,jurisdiction,pre_consent,purpose';
  const body = rows.map(t => [t.domain, t.category, t.jurisdiction, !!t.preConsent, t.purpose].map(csvEscape).join(',')).join('\n');
  fs.writeFileSync(path.join(dir, 'trackers.csv'), body ? `${header}\n${body}\n` : `${header}\n`);
}

function writeCookies(dir, scan, selections) {
  const wanted = new Set(
    selections.filter(s => s.kind === 'preConsentCookie')
              .flatMap(s => (s.evidencePointers || []).map(p => p.name))
              .filter(Boolean)
  );
  const rows = (scan.findings.cookies || []).filter(c => wanted.has(c.name));
  const header = 'name,domain,first_party,pre_consent,duration_days,purpose';
  const body = rows.map(c => [c.name, c.domain, !!c.firstParty, !!c.preConsent, c.durationDays, c.purpose].map(csvEscape).join(',')).join('\n');
  fs.writeFileSync(path.join(dir, 'cookies.csv'), body ? `${header}\n${body}\n` : `${header}\n`);
}

function writeTimeline(dir, scan) {
  const events = (scan.findings.auditTrail && scan.findings.auditTrail.preConsent) || [];
  const lines = events.length
    ? events.map(e => `- ${e.t}: ${e.kind} ${e.url || ''}`.trim())
    : ['_No pre-consent timeline events recorded by the scanner._'];
  fs.writeFileSync(path.join(dir, 'timeline.md'), `# Audit trail (pre-consent)\n\n${lines.join('\n')}\n`);
}

function writeSummary(dir, scan) {
  const meta = scan.meta || {};
  const scores = scan.scores || {};
  const lines = [
    `# Scan summary`,
    ``,
    `Domain: ${meta.domain}`,
    `Scan date: ${meta.scanDate}`,
    `Overall score: ${meta.overallScore}`,
    ``,
    `## Scores`,
    ...Object.entries(scores).map(([k, v]) => `- ${k}: ${v}`)
  ];
  fs.writeFileSync(path.join(dir, 'scan-summary.md'), lines.join('\n') + '\n');
}

function copyRawScan(dir, scan) {
  fs.writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(scan, null, 2));
}

function copyScreenshots(dir, scan) {
  const ss = (scan.screenshots || {});
  const targetDir = path.join(dir, 'screenshots');
  fs.mkdirSync(targetDir, { recursive: true });
  for (const [label, p] of Object.entries(ss)) {
    if (p && fs.existsSync(p)) {
      const name = `${label}.png`;
      fs.copyFileSync(p, path.join(targetDir, name));
    }
  }
}

function writeEvidence(evidenceDir, scan, selections) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  copyRawScan(evidenceDir, scan);
  writeSummary(evidenceDir, scan);
  writeTrackers(evidenceDir, scan, selections);
  writeCookies(evidenceDir, scan, selections);
  writeTimeline(evidenceDir, scan);
  copyScreenshots(evidenceDir, scan);
}

module.exports = { writeEvidence };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- --test-name-pattern=writeEvidence`
Expected: four pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/complaint/render-evidence.js tests/complaint/render-evidence.test.js
git commit -m "feat(complaint): render evidence (CSVs, timeline, scan copy, summary)"
```

---

### Task 17: `render-checklist.js`

Produces `submission-checklist.md` from the DPA adapter + list of evidence filenames.

**Files:**
- Create: `scripts/complaint/render-checklist.js`
- Create: `tests/complaint/render-checklist.test.js`

- [ ] **Step 1: Write failing tests**

`tests/complaint/render-checklist.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderChecklist } = require('../../scripts/complaint/render-checklist');

const dpa = require('../../references/dpa-adapters/nl-ap.json');

test('renderChecklist names the DPA and portal URL', () => {
  const md = renderChecklist({ dpa, evidenceFiles: ['trackers.csv', 'cookies.csv'] });
  assert.match(md, new RegExp(dpa.name));
  assert.match(md, new RegExp(dpa.submission.portalUrl.replace(/\//g, '\\/')));
});

test('renderChecklist lists evidence files as attachments', () => {
  const md = renderChecklist({ dpa, evidenceFiles: ['trackers.csv', 'screenshots/banner-viewport.png'] });
  assert.match(md, /trackers\.csv/);
  assert.match(md, /banner-viewport\.png/);
});

test('renderChecklist lists field mapping entries', () => {
  const md = renderChecklist({ dpa, evidenceFiles: [] });
  for (const [key, label] of Object.entries(dpa.form.fieldMapping)) {
    assert.match(md, new RegExp(label));
  }
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- --test-name-pattern=renderChecklist`
Expected: three fail.

- [ ] **Step 3: Implement**

`scripts/complaint/render-checklist.js`:

```javascript
const fs = require('node:fs');
const path = require('node:path');
const Handlebars = require('handlebars');

const TEMPLATE = path.join(__dirname, '..', '..', 'references', 'complaint-templates', 'checklist.md.hbs');

Handlebars.registerHelper('join', (arr, sep) => (arr || []).join(sep));

function renderChecklist({ dpa, evidenceFiles }) {
  const tpl = Handlebars.compile(fs.readFileSync(TEMPLATE, 'utf8'));
  return tpl({ dpa, evidenceFiles });
}

module.exports = { renderChecklist };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- --test-name-pattern=renderChecklist`
Expected: three pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/complaint/render-checklist.js tests/complaint/render-checklist.test.js
git commit -m "feat(complaint): render submission checklist from DPA adapter"
```

---

## Phase 6 — PDF renderer

### Task 18: `render-pdf.js`

Converts `complaint.md` to `complaint.pdf` using Playwright's chromium. If chromium is unavailable or fails, the caller must not crash — return `{ ok: false, reason }`.

**Files:**
- Create: `scripts/complaint/render-pdf.js`
- Create: `tests/complaint/render-pdf.test.js`

- [ ] **Step 1: Write failing test**

`tests/complaint/render-pdf.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { renderPdf } = require('../../scripts/complaint/render-pdf');

test('renderPdf writes a non-empty PDF from a markdown string', async (t) => {
  // Skip if chromium is not installed — Playwright throws a clear error we catch below.
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-'));
  const md = '# Test complaint\n\nThis is a test.';
  const result = await renderPdf(md, path.join(outDir, 'complaint.pdf'), { footer: 'test footer' });
  if (!result.ok && /chromium|browser|launch/i.test(result.reason || '')) {
    t.skip('Chromium not available in this environment');
    return;
  }
  assert.equal(result.ok, true, `reason: ${result.reason}`);
  const stats = fs.statSync(path.join(outDir, 'complaint.pdf'));
  assert.ok(stats.size > 1000, 'PDF must be non-trivially sized');
});
```

- [ ] **Step 2: Run test — expect failure (module missing)**

Run: `npm test -- --test-name-pattern=renderPdf`
Expected: fail with "Cannot find module".

- [ ] **Step 3: Implement**

`scripts/complaint/render-pdf.js`:

```javascript
const fs = require('node:fs');

function mdToHtml(md) {
  // Lightweight MD → HTML for print. Handles headings, paragraphs, lists, bold, emphasis, inline code.
  const lines = md.split('\n');
  const html = [];
  let inList = false;
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);
    if (h) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    } else if (li) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inline(li[1])}</li>`);
    } else if (line.trim() === '') {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push('');
    } else {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inList) html.push('</ul>');
  return html.join('\n');
}

function inline(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

async function renderPdf(markdown, outputPath, { footer } = {}) {
  let firefox, chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (err) {
    return { ok: false, reason: `Playwright not installed: ${err.message}` };
  }
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    return { ok: false, reason: `chromium launch failed: ${err.message}` };
  }
  try {
    const page = await browser.newPage();
    const body = mdToHtml(markdown);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; color: #111; max-width: 720px; margin: 40px auto; padding: 0 16px; }
      h1 { font-size: 18pt; }
      h2 { font-size: 14pt; margin-top: 1.5em; }
      h3 { font-size: 12pt; }
      code { font-family: 'Menlo', 'Consolas', monospace; font-size: 10pt; background: #f4f4f4; padding: 1px 4px; }
      ul { padding-left: 20px; }
      hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
    </style></head><body>${body}</body></html>`;
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
      displayHeaderFooter: !!footer,
      footerTemplate: footer ? `<div style="font-size:8pt;color:#888;width:100%;text-align:center;padding:0 20mm;">${footer}</div>` : '',
      headerTemplate: '<div></div>'
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  } finally {
    await browser.close();
  }
}

module.exports = { renderPdf, mdToHtml };
```

- [ ] **Step 4: Run test — expect pass (or skip when chromium absent)**

Run: `npm test -- --test-name-pattern=renderPdf`
Expected: pass, OR skipped with "Chromium not available".

- [ ] **Step 5: Commit**

```bash
git add scripts/complaint/render-pdf.js tests/complaint/render-pdf.test.js
git commit -m "feat(complaint): render PDF via Playwright chromium with graceful fallback"
```

---

## Phase 7 — Orchestration

### Task 19: `build-dossier.js` — pure builder

Takes the full curated state + output directory and writes every dossier file. No interactivity. Unit-testable end-to-end.

**Files:**
- Create: `scripts/complaint/build-dossier.js`
- Create: `tests/complaint/build-dossier.test.js`

- [ ] **Step 1: Write failing tests**

`tests/complaint/build-dossier.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildDossier, slugify } = require('../../scripts/complaint/build-dossier');
const { detectController } = require('../../scripts/complaint/detect-controller');
const { loadAdapter } = require('../../scripts/complaint/select-dpa');
const { extractCandidates, applyUserChoices } = require('../../scripts/complaint/curate-findings');
const { anonymizedProfile } = require('../../scripts/complaint/load-profile');

const scan = require(path.join(__dirname, '..', 'fixtures', 'sample-scan.json'));

test('slugify strips www, .com, dots', () => {
  assert.equal(slugify('www.example.com'), 'example');
  assert.equal(slugify('nu.nl'), 'nu-nl');
  assert.equal(slugify('mediamarkt.nl'), 'mediamarkt-nl');
});

test('buildDossier writes every required file when chromium is unavailable', async () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-'));
  const cands = extractCandidates(scan);
  const choices = Object.fromEntries(cands.map(c => [c.id, c.actionable]));
  const state = {
    scanDate: scan.meta.scanDate,
    slug: slugify(scan.meta.domain),
    dpa: loadAdapter('nl-ap'),
    complainant: anonymizedProfile(),
    controller: detectController(scan),
    selections: applyUserChoices(cands, choices),
    anonymized: true
  };
  const result = await buildDossier({ scan, state, outputRoot: outRoot, renderPdf: async () => ({ ok: false, reason: 'no chromium (test)' }) });
  const dir = result.dossierDir;
  for (const f of ['README.md', 'submission-checklist.md', 'complaint.md', 'facts.md', 'articles-cited.md']) {
    assert.ok(fs.existsSync(path.join(dir, f)), `missing ${f}`);
  }
  for (const f of ['scan.json', 'scan-summary.md', 'trackers.csv', 'cookies.csv', 'timeline.md']) {
    assert.ok(fs.existsSync(path.join(dir, 'evidence', f)), `missing evidence/${f}`);
  }
  assert.equal(result.pdfOk, false);
});

test('buildDossier respects an existing folder by adding a numeric suffix when policy=suffix', async () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-'));
  const state = {
    scanDate: '2026-04-01',
    slug: 'example',
    dpa: loadAdapter('nl-ap'),
    complainant: anonymizedProfile(),
    controller: detectController(scan),
    selections: [],
    anonymized: true
  };
  const first = await buildDossier({ scan, state, outputRoot: outRoot, renderPdf: async () => ({ ok: false, reason: 'x' }), collisionPolicy: 'suffix' });
  const second = await buildDossier({ scan, state, outputRoot: outRoot, renderPdf: async () => ({ ok: false, reason: 'x' }), collisionPolicy: 'suffix' });
  assert.notEqual(first.dossierDir, second.dossierDir);
  assert.match(second.dossierDir, /-2$/);
});

test('buildDossier throws when folder exists and policy=abort', async () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-'));
  const state = {
    scanDate: '2026-04-01',
    slug: 'example',
    dpa: loadAdapter('nl-ap'),
    complainant: anonymizedProfile(),
    controller: detectController(scan),
    selections: [],
    anonymized: true
  };
  await buildDossier({ scan, state, outputRoot: outRoot, renderPdf: async () => ({ ok: false, reason: 'x' }), collisionPolicy: 'abort' });
  await assert.rejects(
    buildDossier({ scan, state, outputRoot: outRoot, renderPdf: async () => ({ ok: false, reason: 'x' }), collisionPolicy: 'abort' }),
    /already exists/
  );
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- --test-name-pattern=buildDossier`
Expected: four fail.

- [ ] **Step 3: Implement**

`scripts/complaint/build-dossier.js`:

```javascript
const fs = require('node:fs');
const path = require('node:path');
const Handlebars = require('handlebars');
const { renderLetter, renderFacts, renderArticlesCited } = require('./render-complaint-md');
const { writeEvidence } = require('./render-evidence');
const { renderChecklist } = require('./render-checklist');
const { renderPdf: defaultRenderPdf } = require('./render-pdf');

function slugify(domain) {
  return String(domain).replace(/^www\./, '').replace(/\.com$/, '').replace(/\./g, '-');
}

function folderName(slug, scanDate) {
  const datePart = String(scanDate).slice(0, 10);
  return `dpa-complaint-${slug}-${datePart}`;
}

function resolveFolder(outputRoot, baseName, policy) {
  const first = path.join(outputRoot, baseName);
  if (!fs.existsSync(first)) return first;
  if (policy === 'abort') throw new Error(`Folder already exists: ${first}`);
  if (policy === 'overwrite') {
    fs.rmSync(first, { recursive: true, force: true });
    return first;
  }
  // suffix policy
  let n = 2;
  while (fs.existsSync(path.join(outputRoot, `${baseName}-${n}`))) n += 1;
  return path.join(outputRoot, `${baseName}-${n}`);
}

async function buildDossier({ scan, state, outputRoot, renderPdf = defaultRenderPdf, collisionPolicy = 'abort' }) {
  const base = folderName(state.slug, state.scanDate);
  const dossierDir = resolveFolder(outputRoot, base, collisionPolicy);
  fs.mkdirSync(dossierDir, { recursive: true });
  const evidenceDir = path.join(dossierDir, 'evidence');
  writeEvidence(evidenceDir, scan, state.selections);

  const letter = renderLetter(state);
  fs.writeFileSync(path.join(dossierDir, 'complaint.md'), letter);
  fs.writeFileSync(path.join(dossierDir, 'facts.md'), renderFacts(state));
  fs.writeFileSync(path.join(dossierDir, 'articles-cited.md'), renderArticlesCited(state));

  const evidenceFiles = fs.readdirSync(evidenceDir).map(f => {
    const p = path.join(evidenceDir, f);
    return fs.statSync(p).isDirectory() ? null : f;
  }).filter(Boolean);
  if (fs.existsSync(path.join(evidenceDir, 'screenshots'))) {
    for (const f of fs.readdirSync(path.join(evidenceDir, 'screenshots'))) {
      evidenceFiles.push(path.join('screenshots', f));
    }
  }
  fs.writeFileSync(path.join(dossierDir, 'submission-checklist.md'), renderChecklist({ dpa: state.dpa, evidenceFiles }));

  const readmeTpl = Handlebars.compile(fs.readFileSync(path.join(__dirname, '..', '..', 'references', 'complaint-templates', 'readme.md.hbs'), 'utf8'));
  fs.writeFileSync(path.join(dossierDir, 'README.md'), readmeTpl(state));

  const pdfResult = await renderPdf(letter, path.join(dossierDir, 'complaint.pdf'), {
    footer: 'Generated with privacy-scan DPA complaint builder (open source). Reviewed and signed by the complainant.'
  });

  return { dossierDir, pdfOk: pdfResult.ok, pdfReason: pdfResult.reason };
}

module.exports = { buildDossier, slugify, folderName };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- --test-name-pattern=buildDossier`
Expected: four pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/complaint/build-dossier.js tests/complaint/build-dossier.test.js
git commit -m "feat(complaint): build-dossier orchestrator (pure, PDF-optional)"
```

---

### Task 20: `file-dpa-complaint.js` — entry point with interactive prompts

Wires everything together. Uses `readline/promises` for prompts. No new tests at this layer — the E2E test in Phase 8 exercises it with scripted stdin.

**Files:**
- Create: `scripts/file-dpa-complaint.js`

- [ ] **Step 1: Write the entry point**

`scripts/file-dpa-complaint.js`:

```javascript
#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const { loadScan } = require('./complaint/load-scan');
const { listAdapters, loadAdapter, inferLeadDpa } = require('./complaint/select-dpa');
const { detectController, applyOverrides, PLACEHOLDER } = require('./complaint/detect-controller');
const { readProfile, writeProfile, anonymizedProfile } = require('./complaint/load-profile');
const { extractCandidates, applyUserChoices } = require('./complaint/curate-findings');
const { buildDossier, slugify } = require('./complaint/build-dossier');
const { readDraft, writeDraft, deleteDraft } = require('./complaint/draft-state');

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v != null) out.flags[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) { out.flags[k] = argv[i + 1]; i += 1; }
      else out.flags[k] = true;
    } else {
      out._.push(a);
    }
  }
  return out;
}

function usage() {
  console.error(`Usage: node scripts/file-dpa-complaint.js <scan.json> [options]

Options:
  --dpa <id>            Skip the DPA picker (nl-ap | fr-cnil | uk-ico)
  --anonymize           Use placeholders instead of a stored complainant profile
  --include-all         Include non-actionable findings in curation
  --output-dir <path>   Output directory for the dossier (default: cwd)
  --inline              Produce a single markdown file instead of a folder
  --on-collision <p>    abort (default) | overwrite | suffix
`);
  process.exit(2);
}

async function main() {
  const { _: positional, flags } = parseArgs(process.argv);
  if (!positional[0]) usage();

  const scan = loadScan(positional[0]);
  const slug = slugify(scan.meta.domain);
  const outputRoot = path.resolve(flags['output-dir'] || process.cwd());
  const anonymize = !!flags.anonymize;
  const includeAll = !!flags['include-all'];
  const collisionPolicy = flags['on-collision'] || 'abort';

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const ask = (q) => rl.question(q);

  try {
    // Resume check
    const draft = readDraft(outputRoot, slug);
    if (draft) {
      const resume = (await ask(`Found a previous draft for ${slug}. Resume? [Y/n] `)).trim().toLowerCase();
      if (resume === 'n' || resume === 'no') deleteDraft(outputRoot, slug);
    }

    // DPA selection
    let dpaId = flags.dpa;
    if (!dpaId) {
      const adapters = listAdapters();
      const lead = inferLeadDpa(scan);
      stdout.write(`\nAvailable DPAs:\n`);
      adapters.forEach((a, i) => {
        const isLead = a.id === lead ? ' ← lead (one-stop-shop)' : '';
        stdout.write(`  [${i + 1}] ${a.name} (${a.id})${isLead}\n`);
      });
      const pick = (await ask(`Select [1-${adapters.length}]: `)).trim();
      const idx = parseInt(pick, 10) - 1;
      if (!(idx >= 0 && idx < adapters.length)) throw new Error('Invalid selection');
      dpaId = adapters[idx].id;
    }
    const dpa = loadAdapter(dpaId);

    // Controller detection / confirmation
    let controller = detectController(scan);
    stdout.write(`\nController (from scan):\n`);
    for (const [k, v] of Object.entries(controller)) stdout.write(`  ${k}: ${v}\n`);
    const edit = (await ask(`Edit any field? [y/N] `)).trim().toLowerCase();
    if (edit === 'y' || edit === 'yes') {
      const overrides = {};
      for (const key of Object.keys(controller)) {
        if (controller[key] === PLACEHOLDER) {
          const v = (await ask(`  ${key}: `)).trim();
          if (v) overrides[key] = v;
        }
      }
      controller = applyOverrides(controller, overrides);
    }

    // Complainant profile
    let complainant;
    if (anonymize) {
      complainant = anonymizedProfile();
    } else {
      const existing = readProfile(os.homedir());
      if (existing) {
        const use = (await ask(`Use saved complainant profile (${existing.fullName})? [Y/n] `)).trim().toLowerCase();
        if (use !== 'n' && use !== 'no') complainant = existing;
      }
      if (!complainant) {
        complainant = {
          fullName: (await ask('Full name: ')).trim(),
          email: (await ask('Email: ')).trim(),
          phone: (await ask('Phone (optional, blank to skip): ')).trim() || undefined,
          postalAddress: {
            street: (await ask('Street: ')).trim(),
            postalCode: (await ask('Postal code: ')).trim(),
            city: (await ask('City: ')).trim(),
            country: (await ask('Country (e.g. NL): ')).trim()
          },
          dataSubjectStatus: 'self'
        };
        const save = (await ask('Save this profile for next time? [Y/n] ')).trim().toLowerCase();
        if (save !== 'n' && save !== 'no') writeProfile(os.homedir(), complainant);
      }
    }

    // Curation
    const candidates = extractCandidates(scan);
    const visible = includeAll ? candidates : candidates.filter(c => c.actionable);
    stdout.write(`\nFindings to consider (${visible.length}):\n`);
    const choices = {};
    for (const c of visible) {
      stdout.write(`\n  ${c.headline}\n    ${c.detail}\n    Articles: ${c.articles.join(', ')}\n`);
      const ans = (await ask(`    Include? [Y/n] `)).trim().toLowerCase();
      choices[c.id] = !(ans === 'n' || ans === 'no');
    }
    const selections = applyUserChoices(candidates, choices);
    if (selections.length === 0) throw new Error('No findings selected; nothing to file.');

    const state = {
      scanDate: scan.meta.scanDate,
      slug,
      dpa,
      complainant,
      controller,
      selections,
      anonymized: anonymize
    };

    writeDraft(outputRoot, slug, { step: 'build', dpaId: dpa.id, choices });

    const { dossierDir, pdfOk, pdfReason } = await buildDossier({ scan, state, outputRoot, collisionPolicy });
    deleteDraft(outputRoot, slug);

    stdout.write(`\n✓ Dossier written to: ${dossierDir}\n`);
    stdout.write(`  Start with: ${path.join(dossierDir, 'submission-checklist.md')}\n`);
    if (!pdfOk) stdout.write(`  (PDF not generated: ${pdfReason}. complaint.md is submittable as-is.)\n`);
    if (!anonymize) stdout.write(`\n⚠ This folder contains your personal data. Do not commit it to a public repository.\n`);

  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke-test the CLI usage**

Run: `node scripts/file-dpa-complaint.js 2>&1 | head -20`
Expected: usage message prints, exit 2.

Run: `node scripts/file-dpa-complaint.js /tmp/does-not-exist.json 2>&1 | head`
Expected: `Error: Cannot read scan at /tmp/does-not-exist.json: ...`, exit 1.

- [ ] **Step 3: Commit**

```bash
git add scripts/file-dpa-complaint.js
git commit -m "feat(complaint): /file-dpa-complaint CLI entry point"
```

---

## Phase 8 — End-to-end test

### Task 21: Full-flow E2E test with scripted stdin

**Files:**
- Create: `tests/e2e/full-flow.test.js`

- [ ] **Step 1: Write the E2E test**

`tests/e2e/full-flow.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function run(answers, args = []) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-home-')) };
    const child = spawn('node', ['scripts/file-dpa-complaint.js', ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.on('error', reject);
    child.stdin.write(answers.join('\n') + '\n');
    child.stdin.end();
  });
}

test('end-to-end: fixture scan → dossier folder with all expected files', async () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-out-'));
  const fixture = path.join(__dirname, '..', 'fixtures', 'sample-scan.json');
  // Answers: skip resume prompt implicitly (no draft), pick DPA 1, don't edit controller, then Y for every curated finding.
  // Use --anonymize to skip profile prompting. Use --on-collision=overwrite for idempotence across reruns.
  const answers = [
    '1',      // DPA selection: first adapter (nl-ap after alpha sort? check output)
    'n',      // edit controller? no
    'y', 'y', 'y', 'y', 'y', 'y'  // include each candidate
  ];
  const { code, stdout, stderr } = await run(answers, [fixture, '--anonymize', '--output-dir', outRoot, '--on-collision', 'overwrite']);
  assert.equal(code, 0, `CLI failed. stdout=${stdout}\nstderr=${stderr}`);

  const entries = fs.readdirSync(outRoot).filter(n => n.startsWith('dpa-complaint-'));
  assert.equal(entries.length, 1);
  const dir = path.join(outRoot, entries[0]);

  for (const f of ['README.md', 'submission-checklist.md', 'complaint.md', 'facts.md', 'articles-cited.md']) {
    assert.ok(fs.existsSync(path.join(dir, f)), `missing ${f}`);
  }
  for (const f of ['scan.json', 'scan-summary.md', 'trackers.csv', 'cookies.csv', 'timeline.md']) {
    assert.ok(fs.existsSync(path.join(dir, 'evidence', f)), `missing evidence/${f}`);
  }

  const letter = fs.readFileSync(path.join(dir, 'complaint.md'), 'utf8');
  assert.match(letter, /example-tracker\.test/);
  assert.match(letter, /\[COMPLAINANT NAME\]/);
  assert.match(letter, /Art\. 6/);
  assert.match(letter, /ePrivacy Art\. 5\(3\)/);
});
```

- [ ] **Step 2: Run test — expect pass**

Run: `npm test -- --test-name-pattern="end-to-end"`
Expected: pass. If it fails on DPA selection index (alphabetical vs insertion order), note that `listAdapters()` uses `fs.readdirSync` which sorts alphabetically; adjust the scripted `'1'` answer to match.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/full-flow.test.js
git commit -m "test(e2e): full-flow fixture → dossier smoke test"
```

---

## Phase 8.5 — `--inline` single-file mode

### Task 22: Inline-mode renderer

When invoked with `--inline`, the command produces a single `dpa-complaint-{slug}-{date}.md` file in the output directory instead of a folder. Letter, facts, and articles-cited are concatenated; evidence is reduced to inline markdown tables; no PDF, no screenshots. Intended for users pasting into a DPA portal textarea.

**Files:**
- Create: `scripts/complaint/render-inline.js`
- Create: `tests/complaint/render-inline.test.js`
- Modify: `scripts/file-dpa-complaint.js` — branch on `--inline` after curation

- [ ] **Step 1: Write failing tests**

`tests/complaint/render-inline.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { renderInline } = require('../../scripts/complaint/render-inline');
const { detectController } = require('../../scripts/complaint/detect-controller');
const { loadAdapter } = require('../../scripts/complaint/select-dpa');
const { extractCandidates, applyUserChoices } = require('../../scripts/complaint/curate-findings');
const { anonymizedProfile } = require('../../scripts/complaint/load-profile');

const scan = require(path.join(__dirname, '..', 'fixtures', 'sample-scan.json'));

function makeState() {
  const cands = extractCandidates(scan);
  const choices = Object.fromEntries(cands.map(c => [c.id, c.actionable]));
  return {
    scanDate: scan.meta.scanDate,
    slug: 'example-tracker-test',
    dpa: loadAdapter('nl-ap'),
    complainant: anonymizedProfile(),
    controller: detectController(scan),
    selections: applyUserChoices(cands, choices),
    anonymized: true
  };
}

test('renderInline concatenates letter, facts, articles, and inline evidence tables', () => {
  const md = renderInline(scan, makeState());
  assert.match(md, /# Complaint under Regulation/);
  assert.match(md, /# Facts per cited article/);
  assert.match(md, /# Cited articles/);
  assert.match(md, /\| domain \| category \| jurisdiction \| pre_consent \| purpose \|/);
  assert.match(md, /\[SEE SCAN JSON\]/);
});

test('renderInline includes one tracker row per selected pre-consent tracker', () => {
  const md = renderInline(scan, makeState());
  assert.match(md, /google-analytics\.com/);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- --test-name-pattern=renderInline`
Expected: two fail.

- [ ] **Step 3: Implement**

`scripts/complaint/render-inline.js`:

```javascript
const { renderLetter, renderFacts, renderArticlesCited } = require('./render-complaint-md');

function trackerTable(scan, selections) {
  const wanted = new Set(
    selections.filter(s => s.kind === 'preConsentTracker')
              .flatMap(s => (s.evidencePointers || []).map(p => p.domain))
              .filter(Boolean)
  );
  const rows = (scan.findings.trackers || []).filter(t => wanted.has(t.domain));
  if (rows.length === 0) return '';
  const header = '| domain | category | jurisdiction | pre_consent | purpose |\n|---|---|---|---|---|';
  const body = rows.map(t => `| ${t.domain} | ${t.category || ''} | ${t.jurisdiction || ''} | ${!!t.preConsent} | ${t.purpose || ''} |`).join('\n');
  return `### Trackers (selected rows)\n\n${header}\n${body}\n`;
}

function cookieTable(scan, selections) {
  const wanted = new Set(
    selections.filter(s => s.kind === 'preConsentCookie')
              .flatMap(s => (s.evidencePointers || []).map(p => p.name))
              .filter(Boolean)
  );
  const rows = (scan.findings.cookies || []).filter(c => wanted.has(c.name));
  if (rows.length === 0) return '';
  const header = '| name | domain | first_party | pre_consent | duration_days | purpose |\n|---|---|---|---|---|---|';
  const body = rows.map(c => `| ${c.name} | ${c.domain} | ${!!c.firstParty} | ${!!c.preConsent} | ${c.durationDays} | ${c.purpose || ''} |`).join('\n');
  return `### Cookies (selected rows)\n\n${header}\n${body}\n`;
}

function renderInline(scan, state) {
  const parts = [
    renderLetter(state),
    '\n---\n',
    renderFacts(state),
    '\n---\n',
    renderArticlesCited(state),
    '\n---\n',
    '# Evidence (inline)\n',
    trackerTable(scan, state.selections),
    cookieTable(scan, state.selections),
    '\n_Full scan JSON not inlined. [SEE SCAN JSON] attached separately if the DPA requests raw evidence._\n'
  ];
  return parts.filter(Boolean).join('\n');
}

module.exports = { renderInline };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- --test-name-pattern=renderInline`
Expected: two pass.

- [ ] **Step 5: Wire `--inline` into the entry point**

In `scripts/file-dpa-complaint.js`, add an import at the top:

```javascript
const { renderInline } = require('./complaint/render-inline');
```

Replace the `buildDossier` call and its trailing output block with:

```javascript
    writeDraft(outputRoot, slug, { step: 'build', dpaId: dpa.id, choices });

    if (flags.inline) {
      const md = renderInline(scan, state);
      const outFile = path.join(outputRoot, `dpa-complaint-${slug}-${state.scanDate.slice(0, 10)}.md`);
      fs.writeFileSync(outFile, md);
      deleteDraft(outputRoot, slug);
      stdout.write(`\n✓ Inline dossier written to: ${outFile}\n`);
      if (!anonymize) stdout.write(`\n⚠ This file contains your personal data. Do not commit to a public repository.\n`);
    } else {
      const { dossierDir, pdfOk, pdfReason } = await buildDossier({ scan, state, outputRoot, collisionPolicy });
      deleteDraft(outputRoot, slug);
      stdout.write(`\n✓ Dossier written to: ${dossierDir}\n`);
      stdout.write(`  Start with: ${path.join(dossierDir, 'submission-checklist.md')}\n`);
      if (!pdfOk) stdout.write(`  (PDF not generated: ${pdfReason}. complaint.md is submittable as-is.)\n`);
      if (!anonymize) stdout.write(`\n⚠ This folder contains your personal data. Do not commit it to a public repository.\n`);
    }
```

- [ ] **Step 6: Smoke-test inline mode**

Run:

```bash
printf '1\nn\ny\ny\ny\ny\ny\ny\n' | node scripts/file-dpa-complaint.js tests/fixtures/sample-scan.json --anonymize --inline --output-dir /tmp/cb-inline 2>&1
ls /tmp/cb-inline/
```

Expected: `dpa-complaint-example-tracker-test-2026-04-01.md` exists in `/tmp/cb-inline/`.

- [ ] **Step 7: Commit**

```bash
git add scripts/complaint/render-inline.js scripts/file-dpa-complaint.js tests/complaint/render-inline.test.js
git commit -m "feat(complaint): --inline mode writes a single concatenated markdown file"
```

---

## Phase 9 — Documentation & repo hygiene

### Task 23: `.gitignore` + `package.json` check + `references/README.md`

**Files:**
- Modify: `.gitignore`
- Modify: `references/README.md` (create if absent)

- [ ] **Step 1: Update `.gitignore`**

Append to `.gitignore`:

```
# Complaint builder draft state (resumable-run artifacts)
.complaint-draft-*.json

# Generated complaint dossiers contain personal data — do not commit
dpa-complaint-*/
```

- [ ] **Step 2: Update or create `references/README.md`**

Check if `references/README.md` exists. If it does, append. If not, create:

```markdown
# References

This directory holds reference material used by the scanner, scoring engine, and complaint builder.

## Subdirectories

- `criteria/` — Per-criterion reference cards used by the scanner's analysis phase.
- `dpa-adapters/` — Data files describing each supported Data Protection Authority. One JSON per DPA; must validate against `dpa-adapters/_schema.json`. Add a DPA by copying an existing file, editing values, and running `node scripts/validate-adapter.js references/dpa-adapters/<id>.json`.
- `article-text/` — Verbatim legal text of cited GDPR, ePrivacy, and EDPB provisions, bundled so the complaint builder works offline. Each file includes its source URL and retrieval date.
- `complaint-templates/` — Handlebars templates used by the complaint builder (`letter.md.hbs`, `facts-section.md.hbs`, `readme.md.hbs`, `checklist.md.hbs`).

## Top-level files

- `analysis-guide.md` — How to analyse scan output.
- `enforcement.md` — Catalogue of enforcement precedents cited by the scoring engine and the complaint builder.
- `field-contract.md` — The analysis JSON field contract.
- `gdpr-articles.md` — GDPR article index with per-article commentary.
- `jurisdictions.md` — Jurisdiction mapping for cross-border analysis.
- `scoring.md` — Scoring rubric.
- `trackers.md` — Tracker catalogue.
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore references/README.md
git commit -m "chore(complaint): gitignore drafts + dossiers; document references tree"
```

---

### Task 24: Update `SKILL.md`

Add a new top-level section documenting `/file-dpa-complaint`.

**Files:**
- Modify: `SKILL.md`

- [ ] **Step 1: Add the section**

At the end of `SKILL.md` (after the existing "Notes" section), append:

```markdown
---

## DPA Complaint Builder

`/file-dpa-complaint <scan-json-path>` turns an existing scan JSON into a ready-to-submit GDPR complaint dossier for a user-chosen Data Protection Authority. The command is fully local, fully offline after the scan is loaded, and performs no automated submission — the dossier is for the user to review and file themselves.

### Usage

```bash
cd $SKILL_DIR && node scripts/file-dpa-complaint.js /tmp/privacy-scan-example.com-*.json
```

The command walks the user through: DPA selection (from the seed set — Dutch AP, French CNIL, UK ICO), controller detection (pre-filled from the scan), complainant identity (saved profile at `~/.claude/privacy-complaint/complainant.json` or `--anonymize` for placeholders), and per-finding curation. On completion it writes `dpa-complaint-{slug}-{date}/` to the working directory containing: `complaint.md`, `complaint.pdf`, `facts.md`, `articles-cited.md`, `submission-checklist.md`, `README.md`, and an `evidence/` subfolder with the raw scan JSON, tracker and cookie CSVs, timeline, and screenshots.

### Flags

| Flag | Effect |
|------|--------|
| `--dpa <id>` | Skip the DPA picker (`nl-ap`, `fr-cnil`, `uk-ico`) |
| `--anonymize` | Skip the complainant profile; dossier uses placeholders |
| `--include-all` | Include non-actionable findings in the curation pass |
| `--output-dir <path>` | Override the output root (default: cwd) |
| `--inline` | Produce a single markdown file instead of a folder |
| `--on-collision <p>` | Behaviour when folder exists: `abort` (default) / `overwrite` / `suffix` |

### Adding a DPA

Every DPA is one JSON file in `references/dpa-adapters/`. Copy `nl-ap.json`, edit values, validate:

```bash
cd $SKILL_DIR && node scripts/validate-adapter.js references/dpa-adapters/<new>.json
```

See `references/dpa-adapters/_schema.json` for the required shape.

### Important

The dossier contains the complainant's personal data (name, address, email) unless `--anonymize` is used. **Do not commit dossier folders to public repositories.** The `.gitignore` added by the complaint builder covers `dpa-complaint-*/` by default.

The complaint is the complainant's filing, not the tool's. Review `complaint.md` and `facts.md` before submitting; edit anything you do not want to defend.
```

- [ ] **Step 2: Commit**

```bash
git add SKILL.md
git commit -m "docs(skill): document /file-dpa-complaint command"
```

---

### Task 25: Final verification pass

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass. No tests should fail; PDF test may print "skipped" if chromium is absent.

- [ ] **Step 2: Smoke-test the full pipeline against the fixture**

Run:

```bash
rm -rf /tmp/cb-smoke && mkdir /tmp/cb-smoke
printf '1\nn\ny\ny\ny\ny\ny\ny\n' | node scripts/file-dpa-complaint.js tests/fixtures/sample-scan.json --anonymize --output-dir /tmp/cb-smoke --on-collision overwrite
ls /tmp/cb-smoke/dpa-complaint-example-tracker-test-2026-04-01/
ls /tmp/cb-smoke/dpa-complaint-example-tracker-test-2026-04-01/evidence/
```

Expected: dossier folder exists with `complaint.md`, `facts.md`, `articles-cited.md`, `README.md`, `submission-checklist.md`, and the `evidence/` subfolder populated.

- [ ] **Step 3: Final commit for the feature-complete checkpoint**

If any residual whitespace/lint fixes were applied during verification:

```bash
git status
# if clean, skip. if dirty, commit fixes:
git commit -am "chore(complaint): verification pass cleanup"
```

Otherwise verify with `git status` that the tree is clean and all prior commits are in place.

---

## Self-review notes

This plan was checked against the approved spec for:

- **Spec coverage.** Every spec section has a corresponding task (schema versioning → Task 1; adapter schema + adapters → Tasks 4–6; plumbing → Tasks 7–9; interactive layer → Tasks 10–12; article text → Task 13; templates + renderers → Tasks 14–17; PDF → Task 18; orchestration → Tasks 19–20; E2E → Task 21; inline mode → Task 22; docs + gitignore → Tasks 23–24; verification → Task 25).
- **Placeholder scan.** Concrete code in every step. Where a step involves content that cannot be invented (DPA portal URLs, verbatim legal text), the step names the source URL and the exact schema/file format, which is a lookup instruction — not a placeholder.
- **Type consistency.** Module export names match imports across tasks: `validateAdapter`, `loadScan`, `readDraft`/`writeDraft`/`deleteDraft`, `readProfile`/`writeProfile`/`anonymizedProfile`, `detectController`/`applyOverrides`/`PLACEHOLDER`, `listAdapters`/`loadAdapter`/`inferLeadDpa`, `extractCandidates`/`applyUserChoices`, `renderLetter`/`renderFacts`/`renderArticlesCited`, `writeEvidence`, `renderChecklist`, `renderPdf`, `buildDossier`/`slugify`/`folderName`.
- **Scope.** Single spec → single plan → single implementation. No subsystem decomposition needed.
