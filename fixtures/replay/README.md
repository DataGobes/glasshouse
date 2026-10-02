# Replay fixtures

Labelled pairs for replaying the **analysis** step without re-scanning live
sites: one raw scan plus the analysis JSON that was written for it. A replay
harness feeds `scan.json` to an analyst (the SKILL.md flow, or an optional
Jev-backed one) and diffs the output against `analysis.json`.

```
fixtures/replay/<site>/
  scan.json       raw scripts/scan.js output (must have `variants`)
  analysis.json   the analysis written for that scan (the label)
  meta.json       provenance + last validation result
```

## meta.json

```jsonc
{
  "site": "linkedin.com",
  "scan": {
    "url": "https://www.linkedin.com",
    "scannedAt": "2026-03-09T17:36:58.979Z",
    "scanner": "privacy-scan/2.1",          // scan.meta.scanner
    "engine": "Firefox (Playwright)",
    "source": "~/Projects/…/linkedin.com-scan.json"
  },
  "analysis": {
    "author": "who or what wrote it (human, Claude via skill, Jev, …)",
    "source": "…",
    "writtenAt": "…",                       // file mtime at import
    "notes": "free text"
  },
  "addedAt": "…",
  "validation": {                           // validate-analysis.js --scan-json
    "checkedAt": "…",
    "validatorCommit": "55bbf79",
    "exitCode": 1,
    "errors":   ["findings.cookies: \"AMCV_*@AdobeOrg\" does not appear …"],
    "warnings": ["…"]
  }
}
```

Labels are not gold: `validation.errors` lists where the analysis disagrees
with its own scan or the current schema. A harness should either skip those
fields when scoring or treat the fixture as lower-confidence.

## Maintaining

```bash
# add or replace a pair
node scripts/replay-fixture.js add <site> --scan <scan.json> --analysis <analysis.json> \
  --author "Claude via glasshouse skill, reviewed by Gijs" --notes "…"

# after changing the validator, cross-check or schema: re-validate everything
node scripts/replay-fixture.js check

# overview: scanner version, scan date, error count, author
node scripts/replay-fixture.js list
```

When a fixture's scanner version falls behind (`list` shows `privacy-scan/2.1`
vs the current `glasshouse/2.2`), re-scan the site, re-run the analyst, review
the result, and `add` it again under the same site name.

## Privacy

Everything here except this README and `datagobes.dev/` (our own site) is
gitignored: scans of third-party sites never go in the repo, matching the rule
for `glasshouse-*.json`. Do not add employer or client sites.
