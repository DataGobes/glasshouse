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
