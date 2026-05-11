const test = require('node:test');
const assert = require('node:assert/strict');
const { listAdapters, loadAdapter, inferLeadDpa } = require('../../scripts/complaint/select-dpa');

test('listAdapters returns the seed adapters', () => {
  const ids = listAdapters().map(a => a.id).sort();
  assert.deepEqual(ids, ['de-bayern', 'de-berlin', 'de-bfdi', 'de-hamburg', 'de-nrw', 'fr-cnil', 'ie-dpc', 'nl-ap', 'uk-ico']);
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

test('inferLeadDpa maps IE to the Irish DPC (one-stop-shop for Dublin-HQ controllers)', () => {
  assert.equal(inferLeadDpa({ findings: { controller: { country: 'IE' } } }), 'ie-dpc');
});
