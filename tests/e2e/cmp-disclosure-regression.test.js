// Regression guard for CMP-vendor-list-aware processor disclosure.
//
// Background: analyzePolicyText used to read only the privacy/cookie policy
// prose and missed processors that are named ONLY in the CMP per-vendor list
// (the JS-rendered "cookie declaration" reached via the consent banner's
// settings link). That made genuinely-disclosed processors show up as
// "undisclosed". analyzePolicyText now folds legalPageContent.cmpVendorList.text
// into the disclosure corpus, and the processor catalog recognises brand-name
// mentions ("SAP CC" -> SAP CDC / Gigya, bare "Microsoft" -> Microsoft
// Advertising / Bing). These tests pin that behaviour with synthetic inputs, so
// they are self-contained and run in any checkout (no external scan fixture).
const { test } = require('node:test');
const assert = require('node:assert');
const { analyzePolicyText } = require('../../scripts/scan.js');

// A processor whose domain loads on the site (detectedOnSite) but whose name
// appears only in the CMP vendor list must NOT be reported undisclosed.
function analyseWithVendorList(vendorListText, thirdPartyDomains) {
  const lpc = {
    privacyPolicy: { text: '' },
    cookiePolicy: { text: '' },
    cmpVendorList: { source: 'onetrust', text: vendorListText, vendors: vendorListText.split('\n') },
  };
  return analyzePolicyText(lpc, thirdPartyDomains, null);
}

test('a processor named only in the CMP vendor list is not reported undisclosed', () => {
  const out = analyseWithVendorList('Optimizely\nBloomreach Discovery\nHotjar', [{ domain: 'logx.optimizely.com' }]);
  assert.ok(out.processors.detectedOnSite.includes('Optimizely'), 'Optimizely should be detected on site');
  assert.ok(!out.processors.undisclosed.includes('Optimizely'), 'Optimizely is named in the vendor list, so not undisclosed');
});

test('a "SAP CC" mention in the vendor list discloses SAP CDC / Gigya', () => {
  const out = analyseWithVendorList('Optimizely\nSAP CC\nMicrosoft\nLinkedIn', [{ domain: 'gigya.com' }]);
  assert.ok(!out.processors.undisclosed.some(p => p.toLowerCase().includes('gigya')));
});

test('a bare "Microsoft" mention in the vendor list discloses Microsoft Advertising / Bing', () => {
  const out = analyseWithVendorList('Optimizely\nSAP CC\nMicrosoft\nLinkedIn', [{ domain: 'bat.bing.com' }]);
  assert.ok(!out.processors.undisclosed.some(p => p.toLowerCase().includes('microsoft') || p.toLowerCase().includes('bing')));
});
