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
