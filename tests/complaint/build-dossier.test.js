const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildDossier, slugify } = require('../../scripts/complaint/build-dossier');
const { detectController } = require('../../scripts/complaint/detect-controller');
const { loadAdapter } = require('../../scripts/complaint/select-dpa');
const { extractCandidates, applyUserChoices } = require('../../scripts/complaint/curate-findings');
const { anonymizedProfile } = require('../../scripts/complaint/load-profile');

const scan = require(path.join(__dirname, '..', 'fixtures', 'sample-scan.json'));

test('slugify strips www, .com, dots', () => {
  assert.equal(slugify('www.example.com'), 'example');
  assert.equal(slugify('nu.nl'), 'nu-nl');
  assert.equal(slugify('mediamarkt.nl'), 'mediamarkt-nl');
});

test('buildDossier writes every required file when chromium is unavailable', async () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-'));
  const cands = extractCandidates(scan);
  const choices = Object.fromEntries(cands.map(c => [c.id, c.actionable]));
  const state = {
    scanDate: scan.meta.scanDate,
    slug: slugify(scan.meta.domain),
    dpa: loadAdapter('nl-ap'),
    complainant: anonymizedProfile(),
    controller: detectController(scan),
    selections: applyUserChoices(cands, choices),
    anonymized: true
  };
  const result = await buildDossier({ scan, state, outputRoot: outRoot, renderPdf: async () => ({ ok: false, reason: 'no chromium (test)' }) });
  const dir = result.dossierDir;
  for (const f of ['README.md', 'submission-checklist.md', 'complaint.md', 'facts.md', 'articles-cited.md']) {
    assert.ok(fs.existsSync(path.join(dir, f)), `missing ${f}`);
  }
  for (const f of ['scan.json', 'scan-summary.md', 'trackers.csv', 'cookies.csv', 'timeline.md']) {
    assert.ok(fs.existsSync(path.join(dir, 'evidence', f)), `missing evidence/${f}`);
  }
  assert.equal(result.pdfOk, false);
});

test('buildDossier respects an existing folder by adding a numeric suffix when policy=suffix', async () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-'));
  const state = {
    scanDate: '2026-04-01',
    slug: 'example',
    dpa: loadAdapter('nl-ap'),
    complainant: anonymizedProfile(),
    controller: detectController(scan),
    selections: [],
    anonymized: true
  };
  const first = await buildDossier({ scan, state, outputRoot: outRoot, renderPdf: async () => ({ ok: false, reason: 'x' }), collisionPolicy: 'suffix' });
  const second = await buildDossier({ scan, state, outputRoot: outRoot, renderPdf: async () => ({ ok: false, reason: 'x' }), collisionPolicy: 'suffix' });
  assert.notEqual(first.dossierDir, second.dossierDir);
  assert.match(second.dossierDir, /-2$/);
});

test('buildDossier throws when folder exists and policy=abort', async () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-'));
  const state = {
    scanDate: '2026-04-01',
    slug: 'example',
    dpa: loadAdapter('nl-ap'),
    complainant: anonymizedProfile(),
    controller: detectController(scan),
    selections: [],
    anonymized: true
  };
  await buildDossier({ scan, state, outputRoot: outRoot, renderPdf: async () => ({ ok: false, reason: 'x' }), collisionPolicy: 'abort' });
  await assert.rejects(
    buildDossier({ scan, state, outputRoot: outRoot, renderPdf: async () => ({ ok: false, reason: 'x' }), collisionPolicy: 'abort' }),
    /already exists/
  );
});
