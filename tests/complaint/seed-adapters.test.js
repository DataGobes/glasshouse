const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateAdapter } = require('../../scripts/complaint/validate-adapter-lib');

const adaptersDir = path.join(__dirname, '..', '..', 'references', 'dpa-adapters');
const seedIds = ['de-bayern', 'de-berlin', 'de-bfdi', 'de-hamburg', 'de-nrw', 'fr-cnil', 'ie-dpc', 'nl-ap', 'uk-ico'];

for (const id of seedIds) {
  test(`seed adapter ${id} is valid`, () => {
    const file = path.join(adaptersDir, `${id}.json`);
    const adapter = JSON.parse(fs.readFileSync(file, 'utf8'));
    const { ok, errors } = validateAdapter(adapter);
    assert.equal(ok, true, `Errors: ${JSON.stringify(errors, null, 2)}`);
    assert.equal(adapter.id, id, 'id must match filename');
  });
}
