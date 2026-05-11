const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = path.join(__dirname, '..', '..', 'references', 'article-text');

const required = [
  'gdpr/art-4-11.md',
  'gdpr/art-6.md',
  'gdpr/art-7.md',
  'gdpr/art-13.md',
  'gdpr/art-14.md',
  'gdpr/art-80.md',
  'gdpr/chapter-v.md',
  'eprivacy/art-5-3.md',
  'edpb/guidelines-03-2022.md'
];

for (const rel of required) {
  test(`article text file exists and is non-trivial: ${rel}`, () => {
    const p = path.join(base, rel);
    assert.ok(fs.existsSync(p), `missing: ${rel}`);
    const content = fs.readFileSync(p, 'utf8');
    assert.ok(content.length > 200, `file too short: ${rel}`);
    assert.ok(/Source:/.test(content), `missing Source line: ${rel}`);
    assert.ok(/Retrieved:/.test(content), `missing Retrieved line: ${rel}`);
  });
}
