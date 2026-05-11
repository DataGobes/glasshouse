const PLACEHOLDER = '[TO FILL]';

function detectController(scan) {
  const fromScan = (scan && scan.findings && scan.findings.controller) || {};
  return {
    domain:         (scan && scan.meta && scan.meta.domain) || PLACEHOLDER,
    registeredName: fromScan.registeredName || PLACEHOLDER,
    country:        fromScan.country        || PLACEHOLDER,
    imprintUrl:     fromScan.imprintUrl     || PLACEHOLDER,
    postalAddress:  fromScan.postalAddress  || PLACEHOLDER,
    dpoEmail:       fromScan.dpoEmail       || PLACEHOLDER
  };
}

function applyOverrides(base, overrides) {
  return { ...base, ...overrides };
}

module.exports = { detectController, applyOverrides, PLACEHOLDER };
