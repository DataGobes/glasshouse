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
