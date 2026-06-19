const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const VALIDATOR = path.join(__dirname, '..', '..', 'scripts', 'validate-analysis.js');

// Run the validator on an analysis object and return its combined output.
// We assert on the specific riskSummaryNotes category error line rather than
// the overall exit code, so the test is robust to other required-field noise.
function validate(analysis) {
  const tmp = path.join(os.tmpdir(), `vrsn-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmp, JSON.stringify(analysis));
  try {
    const res = spawnSync('node', [VALIDATOR, tmp], { encoding: 'utf8' });
    return (res.stdout || '') + (res.stderr || '');
  } finally {
    fs.unlinkSync(tmp);
  }
}

const CATEGORY_ERR = /findings\.riskSummaryNotes\[\d+\]\.category/;

test('riskSummaryNotes accepts the Phase-D categories (dsar, processorTransparency)', () => {
  const out = validate({
    meta: { domain: 'example.com', overallScore: 5 },
    findings: {
      riskSummaryNotes: [
        { category: 'consent', note: 'x' },
        { category: 'processorTransparency', note: 'x' },
        { category: 'dsar', note: 'x' },
      ],
    },
  });
  assert.ok(!CATEGORY_ERR.test(out), `no category error expected for the 9 scoring categories.\n${out}`);
});

test('riskSummaryNotes still rejects an unknown category', () => {
  const out = validate({
    meta: { domain: 'example.com', overallScore: 5 },
    findings: {
      riskSummaryNotes: [{ category: 'frobnicate', note: 'x' }],
    },
  });
  assert.ok(CATEGORY_ERR.test(out), `expected a category error for an unknown category.\n${out}`);
});
