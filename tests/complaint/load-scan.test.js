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
