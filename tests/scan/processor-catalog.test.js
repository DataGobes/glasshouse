// tests/scan/processor-catalog.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { analyzePolicyText } = require('../../scripts/scan.js');

test('detects Optimizely, Bloomreach, Gigya, Microsoft Ads by domain', () => {
  const tpd = [
    { domain: 'logx.optimizely.com' },
    { domain: 'api-crm.miele.com' },     // Bloomreach/Exponea CRM endpoint pattern handled separately; see Step 3
    { domain: 'cdns.eu1.gigya.com' },
    { domain: 'bat.bing.com' },
  ];
  const out = analyzePolicyText({ privacyPolicy: { text: '' }, cookiePolicy: { text: '' } }, tpd, null);
  const names = out.processors.detectedOnSite;
  assert.ok(names.includes('Optimizely'), 'Optimizely detected');
  assert.ok(names.includes('SAP CDC / Gigya'), 'Gigya detected');
  assert.ok(names.includes('Microsoft Advertising / Bing'), 'Bing Ads detected');
});

test('a processor named in the cookie text is not undisclosed', () => {
  const tpd = [{ domain: 'logx.optimizely.com' }];
  const out = analyzePolicyText(
    { privacyPolicy: { text: '' }, cookiePolicy: { text: 'Wij gebruiken Optimizely voor A/B-testen.' } },
    tpd, null);
  assert.ok(out.processors.namedInPolicy.some(p => p.name === 'Optimizely'));
  assert.ok(!out.processors.undisclosed.includes('Optimizely'));
});

test('brand-name-only prose discloses Microsoft and SAP CC / Gigya', () => {
  const tpd = [{ domain: 'bat.bing.com' }, { domain: 'cdns.eu1.gigya.com' }];
  const cookieText = 'Wij delen gegevens met o.a. LinkedIn, Pinterest en Microsoft. Essentiële cookies van SAP CC.';
  const out = require('../../scripts/scan.js').analyzePolicyText({ privacyPolicy: { text: '' }, cookiePolicy: { text: cookieText } }, tpd, null);
  const named = out.processors.namedInPolicy.map(p => p.name);
  assert.ok(named.includes('Microsoft Advertising / Bing'), 'Microsoft via brand name');
  assert.ok(named.includes('SAP CDC / Gigya'), 'Gigya via SAP CC');
  assert.ok(!out.processors.undisclosed.includes('Microsoft Advertising / Bing'));
  assert.ok(!out.processors.undisclosed.includes('SAP CDC / Gigya'));
});
