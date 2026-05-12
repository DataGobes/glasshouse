const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { extractCandidates, applyUserChoices } = require('../../scripts/complaint/curate-findings');

const scan = require(path.join(__dirname, '..', 'fixtures', 'sample-scan.json'));

test('extractCandidates surfaces pre-consent tracker as actionable', () => {
  const cands = extractCandidates(scan);
  const tracker = cands.find(c => c.kind === 'preConsentTracker');
  assert.ok(tracker, 'pre-consent tracker candidate must exist');
  assert.equal(tracker.actionable, true);
  assert.ok(tracker.articles.includes('Art. 6'));
  assert.ok(tracker.articles.includes('ePrivacy Art. 5(3)'));
});

test('extractCandidates surfaces dark pattern as actionable with EDPB reference', () => {
  const cands = extractCandidates(scan);
  const dp = cands.find(c => c.kind === 'darkPattern');
  assert.ok(dp);
  assert.equal(dp.actionable, true);
  assert.ok(dp.articles.some(a => a.includes('EDPB')));
});

test('extractCandidates includes non-actionable findings flagged false', () => {
  const cands = extractCandidates(scan);
  assert.ok(cands.some(c => c.actionable === false), 'at least one non-actionable candidate expected');
});

test('extractCandidates matches timeline events across cookie dot-prefix syntax', () => {
  // Regression: cookie domain is ".linkedin.com" (leading dot per cookie spec),
  // timeline event hostname is "www.linkedin.com" (no dot). Match should still
  // attach because they share the linkedin.com hierarchy.
  const scan = {
    meta: { domain: 'linkedin.com', schemaVersion: '1' },
    findings: {
      cookies: [{ name: 'bcookie', domain: '.linkedin.com', preConsent: true, purpose: 'tracking', durationDays: 365 }],
      auditTrail: {
        preConsent: [{ time: 't+0ms', title: 'Page load begins', domain: 'www.linkedin.com', type: 'essential' }]
      }
    }
  };
  const cookie = extractCandidates(scan).find(c => c.kind === 'preConsentCookie');
  assert.ok(cookie.evidencePointers.some(p => p.file === 'timeline.md'), 'expected timeline pointer for .linkedin.com cookie');
});

test('extractCandidates attaches matching timeline events as evidence pointers', () => {
  const scanWithTimeline = {
    meta: { domain: 'linkedin.com', schemaVersion: '1' },
    findings: {
      trackers: [
        { name: 'LinkedIn pixel', domain: 'ponf.linkedin.com', category: 'Analytics', preConsent: true, jurisdiction: 'US' }
      ],
      auditTrail: {
        preConsent: [
          { time: 't+0ms',   title: 'Page load begins',           domain: 'www.linkedin.com', type: 'essential' },
          { time: 't+531ms', title: 'Tracking pixel fires pre-consent', domain: 'ponf.linkedin.com', type: 'tracking' }
        ]
      }
    }
  };
  const cands = extractCandidates(scanWithTimeline);
  const tracker = cands.find(c => c.kind === 'preConsentTracker');
  const timelinePointers = tracker.evidencePointers.filter(p => p.file === 'timeline.md');
  assert.equal(timelinePointers.length, 1, 'expected exactly one timeline citation for ponf.linkedin.com');
  assert.equal(timelinePointers[0].time, 't+531ms');
  assert.equal(timelinePointers[0].title, 'Tracking pixel fires pre-consent');
});

test('extractCandidates marks essential/functional pre-consent cookies as non-actionable', () => {
  // Regression: Art. 5(3) exempts strictly-necessary cookies, so an essential
  // cookie set pre-consent should NOT generate an actionable complaint.
  const scanWithEssentialPre = {
    meta: { domain: 'x.test', schemaVersion: '1' },
    findings: {
      cookies: [
        { name: 'JSESSIONID', domain: '.x.test', preConsent: true, purpose: 'essential',  durationDays: 0 },
        { name: 'lang',       domain: '.x.test', preConsent: true, purpose: 'functional', durationDays: 0 },
        { name: 'bcookie',    domain: '.x.test', preConsent: true, purpose: 'tracking',   durationDays: 365 }
      ]
    }
  };
  const cands = extractCandidates(scanWithEssentialPre).filter(c => c.kind === 'preConsentCookie');
  const byName = Object.fromEntries(cands.map(c => [c.detail.match(/Domain: \S+\. Purpose: (\w+)/)[1], c]));
  assert.equal(byName.essential.actionable, false);
  assert.equal(byName.functional.actionable, false);
  assert.equal(byName.tracking.actionable, true);
});

test('extractCandidates surfaces multi-layer reject pattern with CNIL precedent', () => {
  const scanMultiLayer = {
    meta: { domain: 'nu.nl', schemaVersion: '1' },
    findings: {
      consent: {
        detected: true,
        platform: 'DPG Media Privacy Gate',
        multiLayer: true,
        rejectAccessibility: 'layer-2',
        multiLayerMethod: 'layer2-direct-reject'
      }
    }
  };
  const cands = extractCandidates(scanMultiLayer);
  const ml = cands.find(c => c.kind === 'multiLayerReject');
  assert.ok(ml, 'multiLayerReject candidate expected');
  assert.equal(ml.actionable, true);
  assert.ok(ml.detail.includes('CNIL'), 'expected CNIL precedent in detail');
  assert.ok(ml.articles.includes('Art. 7'));
  assert.ok(ml.articles.includes('EDPB Guidelines 03/2022'));
  // Should not double-fire the older rejectInaccessible candidate
  assert.equal(cands.filter(c => c.kind === 'rejectInaccessible').length, 0);
});

test('extractCandidates falls back to rejectInaccessible when layer-2 traversal not attempted', () => {
  const scanNoTraversal = {
    meta: { domain: 'x.test', schemaVersion: '1' },
    findings: {
      consent: { detected: true, platform: 'Custom', rejectAccessible: false }
    }
  };
  const cands = extractCandidates(scanNoTraversal);
  assert.ok(cands.find(c => c.kind === 'rejectInaccessible'), 'fallback candidate expected');
  assert.equal(cands.filter(c => c.kind === 'multiLayerReject').length, 0);
});

test('applyUserChoices returns only candidates whose id is confirmed', () => {
  const cands = extractCandidates(scan);
  const firstId = cands[0].id;
  const confirmed = applyUserChoices(cands, { [firstId]: true });
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].id, firstId);
});
