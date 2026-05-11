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
