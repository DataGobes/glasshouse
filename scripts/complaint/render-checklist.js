const fs = require('node:fs');
const path = require('node:path');
const Handlebars = require('handlebars');

const TEMPLATE = path.join(__dirname, '..', '..', 'references', 'complaint-templates', 'checklist.md.hbs');

Handlebars.registerHelper('join', (arr, sep) => (arr || []).join(sep));

function renderChecklist({ dpa, evidenceFiles }) {
  const tpl = Handlebars.compile(fs.readFileSync(TEMPLATE, 'utf8'), { noEscape: true });
  return tpl({ dpa, evidenceFiles });
}

module.exports = { renderChecklist };
