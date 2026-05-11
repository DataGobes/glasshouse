#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { stdin, stdout } = require('node:process');

function makeAsker() {
  const rl = readline.createInterface({ input: stdin, terminal: false });
  const queue = [];
  const waiters = [];
  let closed = false;
  rl.on('line', (line) => {
    if (waiters.length) waiters.shift()(line);
    else queue.push(line);
  });
  rl.on('close', () => {
    closed = true;
    while (waiters.length) waiters.shift()('');
  });
  return {
    ask(prompt) {
      stdout.write(prompt);
      return new Promise((resolve) => {
        if (queue.length) return resolve(queue.shift());
        if (closed) return resolve('');
        waiters.push(resolve);
      });
    },
    close() { rl.close(); }
  };
}

const { loadScan } = require('./complaint/load-scan');
const { listAdapters, loadAdapter, inferLeadDpa } = require('./complaint/select-dpa');
const { detectController, applyOverrides, PLACEHOLDER } = require('./complaint/detect-controller');
const { readProfile, writeProfile, anonymizedProfile } = require('./complaint/load-profile');
const { extractCandidates, applyUserChoices } = require('./complaint/curate-findings');
const { buildDossier, slugify } = require('./complaint/build-dossier');
const { renderInline } = require('./complaint/render-inline');
const { readDraft, writeDraft, deleteDraft } = require('./complaint/draft-state');

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v != null) out.flags[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) { out.flags[k] = argv[i + 1]; i += 1; }
      else out.flags[k] = true;
    } else {
      out._.push(a);
    }
  }
  return out;
}

function usage() {
  console.error(`Usage: node scripts/glasshouse-file.js <scan.json> [options]

Options:
  --dpa <id>            Skip the DPA picker
                        (nl-ap | fr-cnil | uk-ico | ie-dpc |
                         de-bfdi | de-berlin | de-hamburg | de-bayern | de-nrw)
  --anonymize           Use placeholders instead of a stored complainant profile
  --include-all         Include non-actionable findings in curation
  --output-dir <path>   Output directory for the dossier (default: cwd)
  --inline              Produce a single markdown file instead of a folder
  --on-collision <p>    abort (default) | overwrite | suffix
`);
  process.exit(2);
}

async function main() {
  const { _: positional, flags } = parseArgs(process.argv);
  if (!positional[0]) usage();

  const scan = loadScan(positional[0]);
  const slug = slugify(scan.meta.domain);
  const outputRoot = path.resolve(flags['output-dir'] || process.cwd());
  const anonymize = !!flags.anonymize;
  const includeAll = !!flags['include-all'];
  const collisionPolicy = flags['on-collision'] || 'abort';

  const asker = makeAsker();
  const ask = (q) => asker.ask(q);

  try {
    const draft = readDraft(outputRoot, slug);
    if (draft) {
      const resume = (await ask(`Found a previous draft for ${slug}. Resume? [Y/n] `)).trim().toLowerCase();
      if (resume === 'n' || resume === 'no') deleteDraft(outputRoot, slug);
    }

    let dpaId = flags.dpa;
    if (!dpaId) {
      const adapters = listAdapters();
      const lead = inferLeadDpa(scan);
      stdout.write(`\nAvailable DPAs:\n`);
      adapters.forEach((a, i) => {
        const isLead = a.id === lead ? ' ← lead (one-stop-shop)' : '';
        stdout.write(`  [${i + 1}] ${a.name} (${a.id})${isLead}\n`);
      });
      const pick = (await ask(`Select [1-${adapters.length}]: `)).trim();
      const idx = parseInt(pick, 10) - 1;
      if (!(idx >= 0 && idx < adapters.length)) throw new Error('Invalid selection');
      dpaId = adapters[idx].id;
    }
    const dpa = loadAdapter(dpaId);

    let controller = detectController(scan);
    stdout.write(`\nController (from scan):\n`);
    for (const [k, v] of Object.entries(controller)) stdout.write(`  ${k}: ${v}\n`);
    const edit = (await ask(`Edit any field? [y/N] `)).trim().toLowerCase();
    if (edit === 'y' || edit === 'yes') {
      const overrides = {};
      for (const key of Object.keys(controller)) {
        if (controller[key] === PLACEHOLDER) {
          const v = (await ask(`  ${key}: `)).trim();
          if (v) overrides[key] = v;
        }
      }
      controller = applyOverrides(controller, overrides);
    }

    let complainant;
    if (anonymize) {
      complainant = anonymizedProfile();
    } else {
      const existing = readProfile(os.homedir());
      if (existing) {
        const use = (await ask(`Use saved complainant profile (${existing.fullName})? [Y/n] `)).trim().toLowerCase();
        if (use !== 'n' && use !== 'no') complainant = existing;
      }
      if (!complainant) {
        complainant = {
          fullName: (await ask('Full name: ')).trim(),
          email: (await ask('Email: ')).trim(),
          phone: (await ask('Phone (optional, blank to skip): ')).trim() || undefined,
          postalAddress: {
            street: (await ask('Street: ')).trim(),
            postalCode: (await ask('Postal code: ')).trim(),
            city: (await ask('City: ')).trim(),
            country: (await ask('Country (e.g. NL): ')).trim()
          },
          dataSubjectStatus: 'self'
        };
        const save = (await ask('Save this profile for next time? [Y/n] ')).trim().toLowerCase();
        if (save !== 'n' && save !== 'no') writeProfile(os.homedir(), complainant);
      }
    }

    const candidates = extractCandidates(scan);
    const visible = includeAll ? candidates : candidates.filter(c => c.actionable);
    stdout.write(`\nFindings to consider (${visible.length}):\n`);
    const choices = {};
    for (const c of visible) {
      stdout.write(`\n  ${c.headline}\n    ${c.detail}\n    Articles: ${c.articles.join(', ')}\n`);
      const ans = (await ask(`    Include? [Y/n] `)).trim().toLowerCase();
      choices[c.id] = !(ans === 'n' || ans === 'no');
    }
    const selections = applyUserChoices(candidates, choices);
    if (selections.length === 0) throw new Error('No findings selected; nothing to file.');

    const state = {
      scanDate: scan.meta.scanDate,
      slug,
      dpa,
      complainant,
      controller,
      selections,
      anonymized: anonymize
    };

    writeDraft(outputRoot, slug, { step: 'build', dpaId: dpa.id, choices });

    if (flags.inline) {
      const md = renderInline(scan, state);
      const outFile = path.join(outputRoot, `dpa-complaint-${slug}-${state.scanDate.slice(0, 10)}.md`);
      fs.writeFileSync(outFile, md);
      deleteDraft(outputRoot, slug);
      stdout.write(`\n✓ Inline dossier written to: ${outFile}\n`);
      if (!anonymize) stdout.write(`\n⚠ This file contains your personal data. Do not commit to a public repository.\n`);
    } else {
      const { dossierDir, pdfOk, pdfReason } = await buildDossier({ scan, state, outputRoot, collisionPolicy });
      deleteDraft(outputRoot, slug);
      stdout.write(`\n✓ Dossier written to: ${dossierDir}\n`);
      stdout.write(`  Start with: ${path.join(dossierDir, 'submission-checklist.md')}\n`);
      if (!pdfOk) stdout.write(`  (PDF not generated: ${pdfReason}. complaint.md is submittable as-is.)\n`);
      if (!anonymize) stdout.write(`\n⚠ This folder contains your personal data. Do not commit it to a public repository.\n`);
    }

  } finally {
    asker.close();
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
