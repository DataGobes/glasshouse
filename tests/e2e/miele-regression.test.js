// tests/e2e/miele-regression.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const SCAN = process.env.MIELE_SCAN || path.join(__dirname, '../../docs/plans/evidence/miele.nl-scan-2026-06-23.json');
const { analyzePolicyText } = require('../../scripts/scan.js');

test('Optimizely is not reported undisclosed when the vendor list names it', () => {
  const d = require(SCAN);
  const lpc = (function f(o){ if(!o||typeof o!=='object') return null; if(o.legalPageContent) return o.legalPageContent; for(const k of Object.keys(o)){const r=f(o[k]); if(r) return r;} return null; })(d) || {};
  // Simulate the corrected corpus: vendor list present
  lpc.cmpVendorList = lpc.cmpVendorList || { source:'onetrust', text:'Optimizely\nSAP CDC / Gigya\nMicrosoft', vendors:['Optimizely'] };
  const out = analyzePolicyText(lpc, [{domain:'logx.optimizely.com'}], null);
  assert.ok(!out.processors.undisclosed.includes('Optimizely'));
});

test('SAP CDC / Gigya is not reported undisclosed when the vendor list names it', () => {
  const d = require(SCAN);
  const lpc = (function f(o){ if(!o||typeof o!=='object') return null; if(o.legalPageContent) return o.legalPageContent; for(const k of Object.keys(o)){const r=f(o[k]); if(r) return r;} return null; })(d) || {};
  // Simulate the corrected corpus: vendor list with SAP CC (alias for Gigya)
  lpc.cmpVendorList = lpc.cmpVendorList || { source:'onetrust', text:'Optimizely\nSAP CC\nMicrosoft\nLinkedIn', vendors:['Optimizely', 'SAP CC'] };
  const out = analyzePolicyText(lpc, [{domain:'gigya.com'}], null);
  // Gigya should not be in undisclosed because the vendor list names SAP CC (which maps to Gigya)
  assert.ok(!out.processors.undisclosed.some(p => p.toLowerCase().includes('gigya')));
});

test('Microsoft Advertising / Bing is not reported undisclosed when the vendor list names it', () => {
  const d = require(SCAN);
  const lpc = (function f(o){ if(!o||typeof o!=='object') return null; if(o.legalPageContent) return o.legalPageContent; for(const k of Object.keys(o)){const r=f(o[k]); if(r) return r;} return null; })(d) || {};
  // Simulate the corrected corpus: vendor list with Microsoft
  lpc.cmpVendorList = lpc.cmpVendorList || { source:'onetrust', text:'Optimizely\nSAP CC\nMicrosoft\nLinkedIn', vendors:['Microsoft'] };
  const out = analyzePolicyText(lpc, [{domain:'bat.bing.com'}], null);
  // Microsoft Advertising / Bing should not be in undisclosed because the vendor list names Microsoft
  assert.ok(!out.processors.undisclosed.some(p => p.toLowerCase().includes('microsoft') || p.toLowerCase().includes('bing')));
});
