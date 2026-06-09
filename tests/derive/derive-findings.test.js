const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { deriveFindings } = require('../../scripts/derive-findings.js');

const scan = require(path.join(__dirname, '..', 'fixtures', 'raw-scan-sample.json'));

test('auditTrail.preConsent is derived from the ignore variant with real timestamps', () => {
  const { findings } = deriveFindings(scan);
  const pre = findings.auditTrail.preConsent;
  assert.ok(Array.isArray(pre) && pre.length >= 2);
  assert.equal(pre[0].time, 't+0ms');
  assert.equal(pre[0].title, 'Page load begins');
  assert.equal(pre[0].type, 'essential');
  const trackerEv = pre.find(e => e.domain === 'ad.doubleclick.net');
  assert.ok(trackerEv, 'tracker fire appears in pre-consent trail');
  // doc request at t=1000, tracker at t=1530 → t+530ms
  assert.equal(trackerEv.time, 't+530ms');
  assert.equal(trackerEv.type, 'adtech');
});

test('auditTrail.postConsent starts with a consent event and uses accept variant', () => {
  const { findings } = deriveFindings(scan);
  const post = findings.auditTrail.postConsent;
  assert.equal(post[0].type, 'consent');
  assert.ok(post.some(e => e.domain === 'analytics.google.com'));
  assert.ok(post.some(e => e.domain === 'www.facebook.com'));
});

test('auditTrail.rejectConsent flags click-transition requests as ambiguous', () => {
  const { findings } = deriveFindings(scan);
  const rej = findings.auditTrail.rejectConsent;
  const ambiguous = rej.find(e => e.domain === 'cdn.example.net');
  assert.ok(ambiguous, 'transition request present in reject trail');
  assert.equal(ambiguous.ambiguousTiming, true);
  const ga = rej.find(e => e.domain === 'analytics.google.com');
  assert.ok(ga && !ga.ambiguousTiming);
});

test('requestPulse counts third-party requests per phase, excluding first party', () => {
  const { findings } = deriveFindings(scan);
  const pulse = findings.requestPulse;
  assert.ok(!pulse.some(p => /(^|\.)example\.com$/.test(p.domain)), 'first party excluded');
  const dc = pulse.find(p => p.domain === 'ad.doubleclick.net');
  assert.deepEqual({ pre: dc.preConsent, post: dc.postConsent, total: dc.total }, { pre: 1, post: 0, total: 1 });
  const ga = pulse.find(p => p.domain === 'analytics.google.com');
  assert.deepEqual({ pre: ga.preConsent, post: ga.postConsent, total: ga.total }, { pre: 0, post: 1, total: 1 });
});

test('variantComparison aggregates per-variant counts from raw data', () => {
  const { findings } = deriveFindings(scan);
  const vc = findings.variantComparison;
  assert.equal(vc.ignore.trackerCount, 1);
  assert.equal(vc.accept.trackerCount, 3);
  assert.equal(vc.reject.trackerCount, 1);
  assert.equal(vc.accept.cookieCount, 2);
  assert.equal(typeof vc.verdict, 'string');
});

test('rejectScenario lists post-reject trackers and excludes consent-record cookies', () => {
  const { findings } = deriveFindings(scan);
  const rs = findings.rejectScenario;
  assert.equal(rs.rejectHonoured, false, 'GA fired after reject → not honoured');
  assert.ok(rs.persistingTrackers.some(t => t.domains.split(', ').includes('analytics.google.com')));
  const names = rs.persistingCookies.map(c => c.name);
  assert.ok(!names.includes('OptanonConsent'), 'CMP consent-record cookie must not be claimed as tracking persistence');
});

test('piggybackingChains derive from loadedBy attribution', () => {
  const { findings } = deriveFindings(scan);
  const chains = findings.piggybackingChains;
  assert.ok(chains.length >= 1);
  const chain = chains[0].chain;
  assert.equal(chain[0].domain, 'pagead2.googlesyndication.com');
  assert.equal(chain[chain.length - 1].domain, 'ad.doubleclick.net');
});

test('storageAnalysis consolidates accept-variant storage', () => {
  const { findings } = deriveFindings(scan);
  const sa = findings.storageAnalysis;
  assert.ok(sa.localStorage.preConsent.some(i => i.key === 'ab_test_group'));
  assert.ok(sa.localStorage.postConsent.some(i => i.key === 'user_prefs'));
  assert.ok(sa.indexedDB.postConsent.some(i => i.name === 'firebaseLocalStorage'));
});

test('beforeAfter counts come from the accept variant', () => {
  const { findings } = deriveFindings(scan);
  const ba = findings.beforeAfter;
  assert.equal(ba.preCookieCount, 1);
  assert.equal(ba.postCookieCount, 2);
  assert.equal(ba.newCookiesDelta, 1);
  assert.ok(ba.postStorageMechanisms.includes('indexedDB'));
});

test('provenance block records source scanner and derivation', () => {
  const out = deriveFindings(scan);
  assert.equal(out._provenance.scanner, 'glasshouse/2.2');
  assert.equal(out._provenance.generator, 'derive-findings');
});
