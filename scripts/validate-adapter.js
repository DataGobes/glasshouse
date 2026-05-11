#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { validateAdapter } = require('./complaint/validate-adapter-lib');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/validate-adapter.js <adapter.json>');
  process.exit(2);
}

let adapter;
try {
  adapter = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`Failed to read/parse ${file}: ${err.message}`);
  process.exit(2);
}

const { ok, errors } = validateAdapter(adapter);
if (ok) {
  console.log(`OK: ${path.basename(file)} is a valid DPA adapter.`);
  process.exit(0);
}
console.error(`INVALID: ${path.basename(file)}`);
for (const e of errors) console.error(`  ${e.path || '/'}: ${e.message}`);
process.exit(1);
