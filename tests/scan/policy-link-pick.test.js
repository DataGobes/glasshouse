// tests/scan/policy-link-pick.test.js
//
// Regression: fetchLegalPageContent took the FIRST legal link whose type or
// text mentioned "privacy". On facebook.com that was the "Forgot password?"
// link (its URL carries a privacy_mutation_token), and on mediamarkt.nl the
// "Cookieverklaring" link (URL /nl/privacy/cookies), so the privacy-policy
// analysis ran on a login page and a cookie statement.
const { test } = require('node:test');
const assert = require('node:assert');
const { pickPolicyLink } = require('../../scripts/scan.js');

test('facebook: skips the account-recovery link, picks the footer privacy policy', () => {
  const links = [
    { type: 'privacy', text: 'Forgot password?', url: 'https://www.facebook.com/recover/initiate/?privacy_mutation_token=abc&ars=facebook_login' },
    { type: 'privacy', text: 'Privacy Policy', url: 'https://www.facebook.com/privacy/policy/?entry_point=facebook_page_footer' },
    { type: 'privacy', text: 'Privacy Center', url: 'https://www.facebook.com/privacy/center/?entry_point=facebook_page_footer' },
    { type: 'cookie', text: 'Cookies', url: 'https://www.facebook.com/policies/cookies/' },
  ];
  assert.strictEqual(pickPolicyLink(links, 'privacyPolicy').url, links[1].url);
  assert.strictEqual(pickPolicyLink(links, 'cookiePolicy').url, links[3].url);
});

test('mediamarkt: prefers Privacyverklaring over a cookie statement under /privacy/', () => {
  const links = [
    { type: 'privacy', text: 'Cookieverklaring', url: 'https://www.mediamarkt.nl/nl/privacy/cookies' },
    { type: 'privacy', text: 'Privacyverklaring', url: 'https://www.mediamarkt.nl/nl/legal/privacyverklaring' },
  ];
  assert.strictEqual(pickPolicyLink(links, 'privacyPolicy').url, links[1].url);
  assert.strictEqual(pickPolicyLink(links, 'cookiePolicy').url, links[0].url);
});

test('a single plain privacy link is still picked', () => {
  const links = [{ type: 'privacy', text: 'Privacy', url: 'https://example.com/privacy' }];
  assert.strictEqual(pickPolicyLink(links, 'privacyPolicy').url, links[0].url);
});

test('returns null when nothing matches', () => {
  assert.strictEqual(pickPolicyLink([{ type: 'terms', text: 'Terms', url: 'https://example.com/terms' }], 'privacyPolicy'), null);
  assert.strictEqual(pickPolicyLink(undefined, 'privacyPolicy'), null);
});
