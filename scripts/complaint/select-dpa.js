const fs = require('node:fs');
const path = require('node:path');

const ADAPTERS_DIR = path.join(__dirname, '..', '..', 'references', 'dpa-adapters');
const COUNTRY_TO_ADAPTER = { NL: 'nl-ap', FR: 'fr-cnil', GB: 'uk-ico', UK: 'uk-ico', IE: 'ie-dpc' };

function listAdapters() {
  return fs.readdirSync(ADAPTERS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => JSON.parse(fs.readFileSync(path.join(ADAPTERS_DIR, f), 'utf8')));
}

function loadAdapter(id) {
  const file = path.join(ADAPTERS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) throw new Error(`Unknown DPA id: ${id}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function inferLeadDpa(scan) {
  const country = scan && scan.findings && scan.findings.controller && scan.findings.controller.country;
  if (!country) return null;
  return COUNTRY_TO_ADAPTER[country] || null;
}

module.exports = { listAdapters, loadAdapter, inferLeadDpa };
