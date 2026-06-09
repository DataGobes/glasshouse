const crypto = require('node:crypto');
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
  const note = '_Times are relative to the first observed request in the phase. Events derive from the scan\'s request log; the full machine-readable log is in `scan.json`._';
  fs.writeFileSync(path.join(dir, 'timeline.md'), `# Audit trail (pre-consent)\n\n${note}\n\n${lines.join('\n')}\n`);
}

function writeSummary(dir, scan) {
  const meta = scan.meta || {};
  const scores = scan.scores || {};
  // Score entries may be bare numbers (legacy) or { score } objects.
  const scoreVal = (v) => (v && typeof v === 'object' ? v.score : v);
  const lines = [
    `# Scan summary`,
    ``,
    `Domain: ${meta.domain}`,
    `Scan date: ${meta.scanDate || meta.scannedAt || 'unknown'}`,
    `Scan tool: ${meta.scanner || 'glasshouse (version not recorded in scan)'}`,
    `Browser: ${meta.browser || 'not recorded'}`,
    `Scan variants: ${(meta.variants || []).join(', ') || 'not recorded'}`,
    `Overall score: ${meta.overallScore}`,
    ``,
    `## Scores`,
    ...Object.entries(scores).map(([k, v]) => `- ${k}: ${scoreVal(v)}`)
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

// Walk the evidence dir and record a SHA-256 + size for every file, plus the
// scan provenance and the finding→evidence mapping. This gives the dossier a
// verifiable chain: each complaint claim references a finding id, each finding
// references evidence files, and each file has a checksum fixed at generation
// time. The manifest cannot include a hash of itself.
function writeManifest(evidenceDir, scan, selections) {
  const files = [];
  const walk = (dir, prefix) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, name);
      const rel = prefix ? path.join(prefix, name) : name;
      if (fs.statSync(p).isDirectory()) {
        walk(p, rel);
      } else if (rel !== 'manifest.json') {
        const buf = fs.readFileSync(p);
        files.push({
          file: rel,
          bytes: buf.length,
          sha256: crypto.createHash('sha256').update(buf).digest('hex'),
        });
      }
    }
  };
  walk(evidenceDir, '');

  const meta = scan.meta || {};
  const manifest = {
    generatedAt: new Date().toISOString(),
    generator: 'glasshouse complaint builder',
    scan: {
      domain: meta.domain || null,
      url: meta.url || null,
      scanDate: meta.scanDate || meta.scannedAt || null,
      scanner: meta.scanner || null,
      browser: meta.browser || null,
      variants: meta.variants || null,
    },
    findings: (selections || []).map((s) => ({
      id: s.id || null,
      kind: s.kind || null,
      headline: s.headline || null,
      articles: s.articles || [],
      evidencePointers: s.evidencePointers || [],
    })),
    files,
  };
  fs.writeFileSync(path.join(evidenceDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

function writeEvidence(evidenceDir, scan, selections) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  copyRawScan(evidenceDir, scan);
  writeSummary(evidenceDir, scan);
  writeTrackers(evidenceDir, scan, selections);
  writeCookies(evidenceDir, scan, selections);
  writeTimeline(evidenceDir, scan);
  copyScreenshots(evidenceDir, scan);
  writeManifest(evidenceDir, scan, selections);
}

module.exports = { writeEvidence };
