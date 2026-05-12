const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function run(args = [], { feedStdin } = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-home-')) };
    const child = spawn('node', ['scripts/glasshouse-file.js', ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.on('error', reject);
    if (feedStdin) {
      child.stdin.write(feedStdin);
    }
    child.stdin.end();
  });
}

test('end-to-end: --list-findings → --include builds a dossier non-interactively', async () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-out-'));
  const fixture = path.join(__dirname, '..', 'fixtures', 'sample-scan.json');

  // Step 1: agent calls --list-findings to discover candidates.
  const listResult = await run([fixture, '--list-findings']);
  assert.equal(listResult.code, 0, `--list-findings failed. stderr=${listResult.stderr}`);
  const listed = JSON.parse(listResult.stdout);
  assert.ok(Array.isArray(listed.candidates) && listed.candidates.length > 0, 'should list candidates');
  assert.ok(listed.candidates.every(c => c.id && c.headline), 'every candidate has id + headline');

  // Step 2: agent picks the actionable ones and runs the non-interactive build.
  const ids = listed.candidates.filter(c => c.actionable).map(c => c.id).join(',');
  const buildResult = await run([
    fixture,
    '--yes',
    '--dpa', 'nl-ap',
    '--include', ids,
    '--anonymize',
    '--output-dir', outRoot,
    '--on-collision', 'overwrite'
  ]);
  assert.equal(buildResult.code, 0, `build failed. stdout=${buildResult.stdout}\nstderr=${buildResult.stderr}`);

  const entries = fs.readdirSync(outRoot).filter(n => n.startsWith('dpa-complaint-'));
  assert.equal(entries.length, 1);
  const dir = path.join(outRoot, entries[0]);

  for (const f of ['README.md', 'submission-checklist.md', 'complaint.md', 'facts.md', 'articles-cited.md']) {
    assert.ok(fs.existsSync(path.join(dir, f)), `missing ${f}`);
  }
  for (const f of ['scan.json', 'scan-summary.md', 'trackers.csv', 'cookies.csv', 'timeline.md']) {
    assert.ok(fs.existsSync(path.join(dir, 'evidence', f)), `missing evidence/${f}`);
  }

  const letter = fs.readFileSync(path.join(dir, 'complaint.md'), 'utf8');
  assert.match(letter, /example-tracker\.test/);
  assert.match(letter, /\[COMPLAINANT NAME\]/);
  assert.match(letter, /Art\. 6/);
  assert.match(letter, /ePrivacy Art\. 5\(3\)/);
});

test('e2e: TTY guard refuses to run without --yes when stdin is piped', async () => {
  const fixture = path.join(__dirname, '..', 'fixtures', 'sample-scan.json');
  const result = await run([fixture, '--anonymize', '--dpa', 'nl-ap']);
  assert.equal(result.code, 1, 'should exit non-zero');
  assert.match(result.stderr, /stdin is not a TTY/, 'should mention the TTY guard');
  assert.match(result.stderr, /--list-findings/, 'should suggest the recommended agent flow');
});

test('e2e: --yes without --include errors out instead of building an empty dossier', async () => {
  const fixture = path.join(__dirname, '..', 'fixtures', 'sample-scan.json');
  const result = await run([fixture, '--yes', '--dpa', 'nl-ap', '--anonymize']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /--include <ids> is required/);
});

test('e2e: --include with unknown id fails fast', async () => {
  const fixture = path.join(__dirname, '..', 'fixtures', 'sample-scan.json');
  const result = await run([
    fixture,
    '--yes',
    '--dpa', 'nl-ap',
    '--anonymize',
    '--include', 'notarealid'
  ]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unknown finding id/);
});
