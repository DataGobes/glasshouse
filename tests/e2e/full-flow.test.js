const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function run(answers, args = []) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-home-')) };
    const child = spawn('node', ['scripts/glasshouse-file.js', ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.on('error', reject);
    child.stdin.write(answers.join('\n') + '\n');
    child.stdin.end();
  });
}

test('end-to-end: fixture scan → dossier folder with all expected files', async () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-out-'));
  const fixture = path.join(__dirname, '..', 'fixtures', 'sample-scan.json');
  const answers = [
    '1',
    'n',
    'y', 'y', 'y', 'y', 'y', 'y'
  ];
  const { code, stdout, stderr } = await run(answers, [fixture, '--anonymize', '--output-dir', outRoot, '--on-collision', 'overwrite']);
  assert.equal(code, 0, `CLI failed. stdout=${stdout}\nstderr=${stderr}`);

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
