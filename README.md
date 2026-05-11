# glasshouse

[![tests](https://github.com/datagobes/glasshouse/actions/workflows/test.yml/badge.svg)](https://github.com/datagobes/glasshouse/actions/workflows/test.yml)

A [Claude Code](https://claude.ai/code) skill that runs a full GDPR / ePrivacy
audit of any public website and — optionally — turns the result into a
ready-to-submit complaint dossier for a data protection authority of your
choice.

Two commands ship together:

- **`/glasshouse-scan <url>`** — scans the site with Playwright Firefox, scores
  it across consent, pre-consent tracking, dark patterns, cross-border
  transfers, security headers, cookie management, and legal pages, and
  generates a scored HTML deck + markdown report.

- **`/glasshouse-file <scan-json>`** — takes a scan JSON and walks you
  through DPA selection, controller detection, identity, and per-finding
  curation, then writes a complete complaint dossier (letter, PDF, facts
  per article, verbatim cited articles, evidence CSVs, screenshots, scan
  copy, submission checklist) to your working directory. Fully local. No
  automated submission — *you* file with the authority.

## Why

The scanner alone tells you *that* a site is violating the law. The civic
gap between "I have evidence" and "I filed a complaint" is a legal-drafting
burden that stops most people from following through. The complaint builder
closes that gap so anyone, not just lawyers, can hold any site accountable.

## What it ships with

**Seed DPA adapters (9):**

| Adapter | Authority | Country |
|---|---|---|
| `nl-ap` | Autoriteit Persoonsgegevens | 🇳🇱 Netherlands |
| `fr-cnil` | Commission Nationale de l'Informatique et des Libertés | 🇫🇷 France |
| `uk-ico` | Information Commissioner's Office | 🇬🇧 United Kingdom |
| `ie-dpc` | Data Protection Commission | 🇮🇪 Ireland (one-stop-shop lead for many Dublin-HQ platforms) |
| `de-bfdi` | Bundesbeauftragter für den Datenschutz und die Informationsfreiheit | 🇩🇪 Germany (federal) |
| `de-berlin` | Berliner Beauftragte für Datenschutz und Informationsfreiheit | 🇩🇪 Berlin |
| `de-hamburg` | Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit | 🇩🇪 Hamburg |
| `de-bayern` | Bayerisches Landesamt für Datenschutzaufsicht | 🇩🇪 Bavaria |
| `de-nrw` | Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen | 🇩🇪 North Rhine-Westphalia |

Adding a DPA is a one-JSON-file pull request — see
[CONTRIBUTING.md](./CONTRIBUTING.md).

**Bundled verbatim legal text** (so the dossier works offline): GDPR Arts.
4(11), 6, 7, 13, 14, 80, Chapter V (Arts. 44–49), ePrivacy Directive Art.
5(3), and EDPB Guidelines 03/2022 reference.

## Install

```bash
# 1. Clone into your Claude Code skills directory
git clone https://github.com/datagobes/glasshouse ~/.claude/skills/glasshouse
cd ~/.claude/skills/glasshouse

# 2. Install dependencies + the Playwright browser
npm install
npx playwright install firefox

# 3. Restart Claude Code so the skill is discovered
```

The skill is then user-invocable via `/glasshouse-scan` and
`/glasshouse-file` in any Claude Code session.

## Usage

### Run a scan

```bash
node scripts/scan.js https://example.com
# → /tmp/glasshouse-example.com-{timestamp}.json
```

Or invoke the skill conversationally: `/glasshouse-scan example.com`.

### File a complaint from a scan

```bash
node scripts/glasshouse-file.js /tmp/glasshouse-example.com-*.json
```

You'll be walked through:

1. **DPA selection** — pick from the seed set; the one-stop-shop lead is
   highlighted if it can be inferred.
2. **Controller** — pre-filled from the scan; you confirm or edit.
3. **Identity** — saved locally at `~/.claude/privacy-complaint/complainant.json`
   for reuse, or use `--anonymize` for placeholders.
4. **Findings curation** — for each detected violation, decide whether to
   include it.
5. **Build** — writes `dpa-complaint-{slug}-{date}/` to the working
   directory.

Useful flags:

| Flag | Effect |
|---|---|
| `--dpa <id>` | Skip the picker |
| `--anonymize` | Use `[COMPLAINANT NAME]` placeholders |
| `--include-all` | Include non-actionable findings in curation |
| `--output-dir <path>` | Override the output root |
| `--inline` | Single concatenated markdown file instead of a folder (for portal textareas) |
| `--on-collision <p>` | `abort` (default) / `overwrite` / `suffix` when the folder exists |

### What the dossier contains

```
dpa-complaint-example-2026-04-01/
├── README.md                  # Overview + what to do next
├── submission-checklist.md    # DPA-specific: where to upload, what to paste, language
├── complaint.md               # The letter (markdown source of truth)
├── complaint.pdf              # Typeset version of complaint.md
├── facts.md                   # Per-article narrative with evidence citations
├── articles-cited.md          # Verbatim text of every cited provision
└── evidence/
    ├── scan.json              # Full, unmodified scan output
    ├── scan-summary.md        # Human-readable digest
    ├── trackers.csv           # Per-tracker, only the selected rows
    ├── cookies.csv            # Per-cookie, only the selected rows
    ├── timeline.md            # Audit trail of pre-consent events
    └── screenshots/
```

## Posture

- **No automated submission.** No Playwright against DPA portals, no email
  auto-send, no API calls on your behalf. The dossier is yours to review,
  edit, sign, and file.
- **Fully local.** No telemetry, no network calls after the initial scan.
  The DPA adapters and article text are bundled.
- **No legal advice.** This tool surfaces evidence and suggests article
  citations; it does not pre-judge outcomes. Review `complaint.md` and
  `facts.md` carefully before submitting — *you* are signing the filing.
- **Personal data warning.** Generated dossiers contain your name, address,
  and email unless you use `--anonymize`. The repo's `.gitignore` covers
  `dpa-complaint-*/` automatically.

## Development

```bash
npm test           # node:test suite (~80 tests)
npm run test:watch # watch mode
node scripts/validate-adapter.js references/dpa-adapters/<id>.json
```

CI runs the test suite on every push and PR — see
[`.github/workflows/test.yml`](./.github/workflows/test.yml).

## Contributing

The lowest-friction contribution is **a new DPA adapter**. Each DPA is a
single JSON file under [`references/dpa-adapters/`](./references/dpa-adapters/)
that validates against
[`_schema.json`](./references/dpa-adapters/_schema.json). See
[CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.

Bug reports and feature requests welcome — please use the
[issue templates](./.github/ISSUE_TEMPLATE).

## License

MIT. See [LICENSE](./LICENSE).

The bundled legal text under `references/article-text/` is in the public
domain (EU legal instruments) and may be redistributed freely.
