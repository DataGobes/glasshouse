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
