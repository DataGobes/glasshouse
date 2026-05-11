const fs = require('node:fs');
const path = require('node:path');

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeTrackers(dir, scan, selections) {
  const wanted = new Set(
    selections.filter(s => s.kind === 'preConsentTracker')
              .flatMap(s => (s.evidencePointers || []).map(p => p.domain))
              .filter(Boolean)
  );
  const rows = (scan.findings.trackers || []).filter(t => wanted.has(t.domain));
  const header = 'domain,category,jurisdiction,pre_consent,purpose';
  const body = rows.map(t => [t.domain, t.category, t.jurisdiction, !!t.preConsent, t.purpose].map(csvEscape).join(',')).join('\n');
  fs.writeFileSync(path.join(dir, 'trackers.csv'), body ? `${header}\n${body}\n` : `${header}\n`);
}

function writeCookies(dir, scan, selections) {
  const wanted = new Set(
    selections.filter(s => s.kind === 'preConsentCookie')
              .flatMap(s => (s.evidencePointers || []).map(p => p.name))
              .filter(Boolean)
  );
  const rows = (scan.findings.cookies || []).filter(c => wanted.has(c.name));
  const header = 'name,domain,first_party,pre_consent,duration_days,purpose';
  const body = rows.map(c => [c.name, c.domain, !!c.firstParty, !!c.preConsent, c.durationDays, c.purpose].map(csvEscape).join(',')).join('\n');
  fs.writeFileSync(path.join(dir, 'cookies.csv'), body ? `${header}\n${body}\n` : `${header}\n`);
}

function writeTimeline(dir, scan) {
  const events = (scan.findings.auditTrail && scan.findings.auditTrail.preConsent) || [];
  const lines = events.length
    ? events.map((e) => {
        const time = e.time || e.t || '?';
        const title = e.title || e.kind || '(event)';
        const where = e.domain || e.url || '';
        const type = e.type ? ` [${e.type}]` : '';
        return `- ${time}: ${title}${where ? ` — ${where}` : ''}${type}`;
      })
    : ['_No pre-consent timeline events recorded by the scanner._'];
  fs.writeFileSync(path.join(dir, 'timeline.md'), `# Audit trail (pre-consent)\n\n${lines.join('\n')}\n`);
}

function writeSummary(dir, scan) {
  const meta = scan.meta || {};
  const scores = scan.scores || {};
  const lines = [
    `# Scan summary`,
    ``,
    `Domain: ${meta.domain}`,
    `Scan date: ${meta.scanDate}`,
    `Overall score: ${meta.overallScore}`,
    ``,
    `## Scores`,
    ...Object.entries(scores).map(([k, v]) => `- ${k}: ${v}`)
  ];
  fs.writeFileSync(path.join(dir, 'scan-summary.md'), lines.join('\n') + '\n');
}

function copyRawScan(dir, scan) {
  fs.writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(scan, null, 2));
}

function copyScreenshots(dir, scan) {
  const ss = (scan.screenshots || {});
  const targetDir = path.join(dir, 'screenshots');
  fs.mkdirSync(targetDir, { recursive: true });
  for (const [label, p] of Object.entries(ss)) {
    if (p && fs.existsSync(p)) {
      const name = `${label}.png`;
      fs.copyFileSync(p, path.join(targetDir, name));
    }
  }
}

function writeEvidence(evidenceDir, scan, selections) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  copyRawScan(evidenceDir, scan);
  writeSummary(evidenceDir, scan);
  writeTrackers(evidenceDir, scan, selections);
  writeCookies(evidenceDir, scan, selections);
  writeTimeline(evidenceDir, scan);
  copyScreenshots(evidenceDir, scan);
}

module.exports = { writeEvidence };
