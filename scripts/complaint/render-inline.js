const { renderLetter, renderFacts, renderArticlesCited } = require('./render-complaint-md');

function trackerTable(scan, selections) {
  const wanted = new Set(
    selections.filter(s => s.kind === 'preConsentTracker')
              .flatMap(s => (s.evidencePointers || []).map(p => p.domain))
              .filter(Boolean)
  );
  const rows = (scan.findings.trackers || []).filter(t => wanted.has(t.domain));
  if (rows.length === 0) return '';
  const header = '| domain | category | jurisdiction | pre_consent | purpose |\n|---|---|---|---|---|';
  const body = rows.map(t => `| ${t.domain} | ${t.category || ''} | ${t.jurisdiction || ''} | ${!!t.preConsent} | ${t.purpose || ''} |`).join('\n');
  return `### Trackers (selected rows)\n\n${header}\n${body}\n`;
}

function cookieTable(scan, selections) {
  const wanted = new Set(
    selections.filter(s => s.kind === 'preConsentCookie')
              .flatMap(s => (s.evidencePointers || []).map(p => p.name))
              .filter(Boolean)
  );
  const rows = (scan.findings.cookies || []).filter(c => wanted.has(c.name));
  if (rows.length === 0) return '';
  const header = '| name | domain | first_party | pre_consent | duration_days | purpose |\n|---|---|---|---|---|---|';
  const body = rows.map(c => `| ${c.name} | ${c.domain} | ${!!c.firstParty} | ${!!c.preConsent} | ${c.durationDays} | ${c.purpose || ''} |`).join('\n');
  return `### Cookies (selected rows)\n\n${header}\n${body}\n`;
}

function renderInline(scan, state) {
  const parts = [
    renderLetter(state),
    '\n---\n',
    renderFacts(state),
    '\n---\n',
    renderArticlesCited(state),
    '\n---\n',
    '# Evidence (inline)\n',
    trackerTable(scan, state.selections),
    cookieTable(scan, state.selections),
    '\n_Full scan JSON not inlined. [SEE SCAN JSON] attached separately if the DPA requests raw evidence._\n'
  ];
  return parts.filter(Boolean).join('\n');
}

module.exports = { renderInline };
