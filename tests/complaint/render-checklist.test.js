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
