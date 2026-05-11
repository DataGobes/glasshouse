const fs = require('node:fs');
const path = require('node:path');

function draftPath(outputDir, slug) {
  return path.join(outputDir, `.complaint-draft-${slug}.json`);
}

function readDraft(outputDir, slug) {
  const p = draftPath(outputDir, slug);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeDraft(outputDir, slug, state) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(draftPath(outputDir, slug), JSON.stringify(state, null, 2));
}

function deleteDraft(outputDir, slug) {
  const p = draftPath(outputDir, slug);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

module.exports = { draftPath, readDraft, writeDraft, deleteDraft };
