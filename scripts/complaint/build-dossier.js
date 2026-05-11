const fs = require('node:fs');
const path = require('node:path');
const Handlebars = require('handlebars');
const { renderLetter, renderFacts, renderArticlesCited } = require('./render-complaint-md');
const { writeEvidence } = require('./render-evidence');
const { renderChecklist } = require('./render-checklist');
const { renderPdf: defaultRenderPdf } = require('./render-pdf');

function slugify(domain) {
  return String(domain).replace(/^www\./, '').replace(/\.com$/, '').replace(/\./g, '-');
}

function folderName(slug, scanDate) {
  const datePart = String(scanDate).slice(0, 10);
  return `dpa-complaint-${slug}-${datePart}`;
}

function resolveFolder(outputRoot, baseName, policy) {
  const first = path.join(outputRoot, baseName);
  if (!fs.existsSync(first)) return first;
  if (policy === 'abort') throw new Error(`Folder already exists: ${first}`);
  if (policy === 'overwrite') {
    fs.rmSync(first, { recursive: true, force: true });
    return first;
  }
  let n = 2;
  while (fs.existsSync(path.join(outputRoot, `${baseName}-${n}`))) n += 1;
  return path.join(outputRoot, `${baseName}-${n}`);
}

async function buildDossier({ scan, state, outputRoot, renderPdf = defaultRenderPdf, collisionPolicy = 'abort' }) {
  const base = folderName(state.slug, state.scanDate);
  const dossierDir = resolveFolder(outputRoot, base, collisionPolicy);
  fs.mkdirSync(dossierDir, { recursive: true });
  const evidenceDir = path.join(dossierDir, 'evidence');
  writeEvidence(evidenceDir, scan, state.selections);

  const letter = renderLetter(state);
  fs.writeFileSync(path.join(dossierDir, 'complaint.md'), letter);
  fs.writeFileSync(path.join(dossierDir, 'facts.md'), renderFacts(state));
  fs.writeFileSync(path.join(dossierDir, 'articles-cited.md'), renderArticlesCited(state));

  const evidenceFiles = fs.readdirSync(evidenceDir).map(f => {
    const p = path.join(evidenceDir, f);
    return fs.statSync(p).isDirectory() ? null : f;
  }).filter(Boolean);
  if (fs.existsSync(path.join(evidenceDir, 'screenshots'))) {
    for (const f of fs.readdirSync(path.join(evidenceDir, 'screenshots'))) {
      evidenceFiles.push(path.join('screenshots', f));
    }
  }
  fs.writeFileSync(path.join(dossierDir, 'submission-checklist.md'), renderChecklist({ dpa: state.dpa, evidenceFiles }));

  const readmeTpl = Handlebars.compile(fs.readFileSync(path.join(__dirname, '..', '..', 'references', 'complaint-templates', 'readme.md.hbs'), 'utf8'), { noEscape: true });
  fs.writeFileSync(path.join(dossierDir, 'README.md'), readmeTpl(state));

  const pdfResult = await renderPdf(letter, path.join(dossierDir, 'complaint.pdf'), {
    footer: 'Generated with glasshouse (open source). Reviewed and signed by the complainant.'
  });

  return { dossierDir, pdfOk: pdfResult.ok, pdfReason: pdfResult.reason };
}

module.exports = { buildDossier, slugify, folderName };
