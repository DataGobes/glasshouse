const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { renderLetter, renderFacts, renderArticlesCited } = require('../../scripts/complaint/render-complaint-md');

const state = {
  scanDate: '2026-04-01',
  dpa: require('../../references/dpa-adapters/nl-ap.json'),
  complainant: { fullName: 'Jane Doe', email: 'j@ex.test', postalAddress: { street: '1 A St', postalCode: '0000', city: 'Town', country: 'NL' } },
  controller: { domain: 'example-tracker.test', registeredName: 'Example Tracker BV', country: 'NL', postalAddress: '10 Canal St' },
  selections: [
    { id: 'x1', kind: 'preConsentTracker', headline: 'google-analytics.com loaded before consent', detail: 'Analytics. US jurisdiction.', articles: ['Art. 6', 'ePrivacy Art. 5(3)'], evidencePointers: [{ file: 'trackers.csv', domain: 'google-analytics.com' }] }
  ],
  anonymized: false
};

test('renderLetter includes complainant, controller, and DPA', () => {
  const md = renderLetter(state);
  assert.match(md, /Jane Doe/);
  assert.match(md, /Example Tracker BV/);
  assert.match(md, /Autoriteit Persoonsgegevens/);
  assert.match(md, /Art\. 6/);
});

test('renderLetter deduplicates cited articles across selections', () => {
  const s = { ...state, selections: [state.selections[0], state.selections[0]] };
  const md = renderLetter(s);
  const occurrences = md.match(/^- Art\. 6$/gm) || [];
  assert.equal(occurrences.length, 1, `expected Art. 6 once, got ${occurrences.length}`);
});

test('renderFacts produces one section per selection and names every article', () => {
  const md = renderFacts(state);
  assert.match(md, /google-analytics\.com/);
  assert.match(md, /## Art\. 6/);
  assert.match(md, /## ePrivacy Art\. 5\(3\)/);
});

test('renderArticlesCited includes the verbatim text for every cited article', () => {
  const md = renderArticlesCited(state);
  assert.match(md, /Article 6/);
  assert.match(md, /Article 5\(3\)/);
  assert.match(md, /Source:/);
});

test('renderLetter does not HTML-escape apostrophes or quotes in DPA / controller names', () => {
  // Regression: Handlebars default escaping turned "l'Informatique" into "l&#x27;Informatique"
  // in the rendered markdown. Output is markdown, not HTML — punctuation must stay literal.
  const s = {
    ...state,
    dpa: require('../../references/dpa-adapters/fr-cnil.json'),
    controller: { ...state.controller, registeredName: "O'Brien & Sons" }
  };
  const md = renderLetter(s);
  assert.ok(!md.includes('&#x27;'), `apostrophe got HTML-escaped: ${md.match(/.{0,40}&#x27;.{0,40}/)}`);
  assert.ok(!md.includes('&amp;'), `ampersand got HTML-escaped: ${md.match(/.{0,40}&amp;.{0,40}/)}`);
  assert.match(md, /l'Informatique/);
  assert.match(md, /O'Brien & Sons/);
});
