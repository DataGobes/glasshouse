# Contributing

Thanks for your interest. This skill gets more useful with every DPA adapter
added, every legal text refresh, and every bug fix — contributions of all
sizes are welcome.

## The lowest-friction contribution: a new DPA adapter

Each Data Protection Authority is a single JSON file under
[`references/dpa-adapters/`](./references/dpa-adapters/). To add one:

1. **Copy an existing adapter** that's close to the shape you need —
   [`nl-ap.json`](./references/dpa-adapters/nl-ap.json) is a good general
   template; [`fr-cnil.json`](./references/dpa-adapters/fr-cnil.json) shows
   `canFileInEnglish: false`; the [German adapters](./references/dpa-adapters/)
   show the federal-vs-Länder pattern.

2. **Fill in verified values** from the authority's official pages. Required:
   `id` (`{country}-{name}`, lowercase, hyphens), `name`, `country` (ISO
   3166-1 alpha-2), `submission.portalUrl`, `submission.postalAddress`,
   `procedural.responseTimeMonths`, `procedural.canFileInEnglish`.

3. **Do not invent data.** If a value isn't on the authority's published
   pages, omit the optional field or set the boolean to `false`. A truthful
   skeleton is more useful than a confident inaccuracy. Where a site sits
   behind bot protection (the AP and ICO both do), use
   `node scripts/fetch-page.js <url>` to render it in Playwright Firefox
   and grep the output.

4. **Validate locally:**
   ```bash
   node scripts/validate-adapter.js references/dpa-adapters/<id>.json
   ```

5. **Add the ID to the seed test** at
   [`tests/complaint/seed-adapters.test.js`](./tests/complaint/seed-adapters.test.js)
   and to the country mapping at
   [`scripts/complaint/select-dpa.js`](./scripts/complaint/select-dpa.js)
   if the country has a single national DPA (countries with multiple
   regional authorities — like Germany — should leave the mapping unset).

6. **Run the test suite:** `npm test` — should report all green.

7. **Open a PR.** Use the `New DPA adapter` issue template if you want to
   discuss before implementing.

## Other contributions

- **Bug fixes** — tests welcome but not required for small fixes. For
  anything touching the curation or rendering pipeline, please add a
  regression test.
- **Article-text refreshes** — if the EU updates an article you should
  pull the verbatim text from EUR-Lex and update both the body and the
  `Retrieved:` date in the file header.
- **New features** — please open an issue first to discuss scope. The
  project tries to stay narrow: scan a site, write a dossier; everything
  else is out of scope.

## Development setup

```bash
git clone https://github.com/datagobes/glasshouse
cd glasshouse
npm install
npx playwright install firefox
npm test
```

The test suite uses Node's built-in `node:test` runner — no Jest, no Vitest.
All tests run in under two seconds.

## Style

- Two-space indent, single quotes in JavaScript, no semicolons in JSON.
- No new runtime dependencies unless the addition is significant. The
  project already depends on `playwright` and `handlebars`; everything else
  is the Node standard library.
- Comments only when the *why* is non-obvious. Avoid restating the code.

## What stays out of scope

- **Automated submission to DPAs.** No Playwright against official forms,
  no email auto-send, no API calls on the user's behalf. The user files
  themselves. This posture is deliberate.
- **Legal review or advice.** The skill surfaces evidence and suggests
  article citations; it does not pre-judge outcomes or advise on strategy.
- **Multi-controller complaints.** One dossier targets one controller.

## Reporting security issues

If you find a security issue (e.g., the `fetch-page` helper enabling SSRF,
or a path-traversal in the dossier writer), please **don't** open a public
issue. See [SECURITY.md](./SECURITY.md) for the disclosure process.

## Code of Conduct

Be kind. Disagree with the work, not the person. Civic-tech contributors
come from many backgrounds; assume good faith.
