const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeEvidence } = require('../../scripts/complaint/render-evidence');

const scan = require(path.join(__dirname, '..', 'fixtures', 'sample-scan.json'));

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-'));
}

test('writeEvidence writes trackers.csv with only selected rows', () => {
  const dir = tmp();
  const selections = [{ kind: 'preConsentTracker', evidencePointers: [{ file: 'trackers.csv', domain: 'google-analytics.com' }], headline: 'h', articles: ['Art. 6'] }];
  writeEvidence(dir, scan, selections);
  const csv = fs.readFileSync(path.join(dir, 'trackers.csv'), 'utf8');
  assert.match(csv, /domain,category,jurisdiction,pre_consent,purpose/);
  assert.match(csv, /google-analytics\.com,analytics,US,true/);
});

test('writeEvidence writes cookies.csv when a cookie is selected', () => {
  const dir = tmp();
  const selections = [{ kind: 'preConsentCookie', evidencePointers: [{ file: 'cookies.csv', name: '_ga' }], headline: 'h', articles: ['Art. 6'] }];
  writeEvidence(dir, scan, selections);
  const csv = fs.readFileSync(path.join(dir, 'cookies.csv'), 'utf8');
  assert.match(csv, /_ga/);
});

test('writeEvidence copies the raw scan JSON', () => {
  const dir = tmp();
  writeEvidence(dir, scan, []);
  const copied = JSON.parse(fs.readFileSync(path.join(dir, 'scan.json'), 'utf8'));
  assert.equal(copied.meta.domain, scan.meta.domain);
});

test('writeEvidence produces a timeline.md with a heading', () => {
  const dir = tmp();
  writeEvidence(dir, scan, []);
  const tl = fs.readFileSync(path.join(dir, 'timeline.md'), 'utf8');
  assert.match(tl, /# Audit trail/);
});

test('writeEvidence renders timeline events using schema field names (time/title/domain/type)', () => {
  // Regression: previous version used e.t/e.kind/e.url which yielded "undefined: undefined"
  // on every line for real scans since the schema uses time/title/domain/type.
  const dir = tmp();
  const scanWithEvents = {
    ...scan,
    findings: {
      ...scan.findings,
      auditTrail: {
        preConsent: [
          { time: 't+0ms',   title: 'Page load begins', domain: 'www.linkedin.com', type: 'essential' },
          { time: 't+320ms', title: 'CDN stylesheet loaded', domain: 'static.licdn.com', type: 'essential' }
        ]
      }
    }
  };
  writeEvidence(dir, scanWithEvents, []);
  const tl = fs.readFileSync(path.join(dir, 'timeline.md'), 'utf8');
  assert.ok(!tl.includes('undefined'), `timeline.md contains "undefined": ${tl}`);
  assert.match(tl, /t\+0ms: Page load begins — www\.linkedin\.com \[essential\]/);
  assert.match(tl, /t\+320ms: CDN stylesheet loaded — static\.licdn\.com \[essential\]/);
});
