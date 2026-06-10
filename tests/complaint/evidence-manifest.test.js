const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeEvidence } = require('../../scripts/complaint/render-evidence');
const { renderLetter, renderFacts } = require('../../scripts/complaint/render-complaint-md');

const scan = require(path.join(__dirname, '..', 'fixtures', 'sample-scan.json'));

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-'));
}

const SELECTIONS = [
  {
    id: 'abc123def0',
    kind: 'preConsentTracker',
    headline: 'google-analytics.com loaded before consent',
    detail: 'Analytics. US jurisdiction.',
    articles: ['Art. 6', 'ePrivacy Art. 5(3)'],
    evidencePointers: [{ file: 'trackers.csv', domain: 'google-analytics.com' }],
  },
];

test('writeEvidence produces a manifest.json with verifiable SHA-256 hashes', () => {
  const dir = tmp();
  writeEvidence(dir, scan, SELECTIONS);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

  assert.ok(Array.isArray(manifest.files) && manifest.files.length >= 4, 'manifest lists evidence files');
  for (const entry of manifest.files) {
    const p = path.join(dir, entry.file);
    assert.ok(fs.existsSync(p), `${entry.file} exists`);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    assert.equal(entry.sha256, digest, `${entry.file} hash matches`);
    assert.equal(entry.bytes, fs.statSync(p).size);
  }
  assert.ok(!manifest.files.some(f => f.file === 'manifest.json'), 'manifest does not list itself');
});

test('manifest.json records scan provenance and the selected findings', () => {
  const dir = tmp();
  writeEvidence(dir, scan, SELECTIONS);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

  assert.equal(manifest.scan.domain, 'example-tracker.test');
  assert.equal(manifest.scan.scanDate, '2026-04-01T10:00:00Z');
  assert.ok(typeof manifest.generatedAt === 'string');
  assert.equal(manifest.findings.length, 1);
  assert.equal(manifest.findings[0].id, 'abc123def0');
  assert.deepEqual(manifest.findings[0].articles, ['Art. 6', 'ePrivacy Art. 5(3)']);
  assert.ok(Array.isArray(manifest.findings[0].evidencePointers));
});

test('scan-summary.md records scan metadata and never prints [object Object]', () => {
  const dir = tmp();
  const withObjScores = { ...scan, scores: { consent: { score: 2.5 }, darkPatterns: 4 } };
  writeEvidence(dir, withObjScores, []);
  const md = fs.readFileSync(path.join(dir, 'scan-summary.md'), 'utf8');
  assert.ok(!md.includes('[object Object]'), md);
  assert.match(md, /consent: 2\.5/);
  assert.match(md, /Scan tool:/);
});

test('timeline.md carries a provenance note about how times were derived', () => {
  const dir = tmp();
  writeEvidence(dir, scan, []);
  const tl = fs.readFileSync(path.join(dir, 'timeline.md'), 'utf8');
  assert.match(tl, /relative to the first observed request/i);
});

const state = {
  scanDate: '2026-04-01',
  dpa: require('../../references/dpa-adapters/nl-ap.json'),
  complainant: { fullName: 'Jane Doe', email: 'j@ex.test', postalAddress: { street: '1 A St', postalCode: '0000', city: 'Town', country: 'NL' } },
  controller: { domain: 'example-tracker.test', registeredName: 'Example Tracker BV', country: 'NL' },
  selections: SELECTIONS,
  anonymized: false,
};

test('renderLetter frames findings as potential infringements, not established ones', () => {
  const md = renderLetter(state);
  assert.match(md, /finding[s]? indicating potential infringement/i);
  assert.ok(!/identified \d+ infringements? of the General Data Protection Regulation/.test(md),
    'letter must not assert infringements as established fact');
});

test('renderLetter includes a methodology-and-limitations section', () => {
  const md = renderLetter({ ...state, scanMeta: { scanner: 'glasshouse/2.2', browser: 'Firefox (Playwright)' } });
  assert.match(md, /Methodology and limitations/i);
  assert.match(md, /point-in-time/i);
  assert.match(md, /glasshouse\/2\.2/);
});

test('renderFacts qualifies every finding with the observation date', () => {
  const md = renderFacts(state);
  assert.match(md, /Observed:.*2026-04-01/);
});
