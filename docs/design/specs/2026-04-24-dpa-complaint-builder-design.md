# DPA Complaint Builder — Design

**Date:** 2026-04-24
**Status:** Design approved, pending implementation plan
**Context:** Add a civic-handoff layer to the `privacy-scan` skill so any user can turn a scan into a ready-to-submit GDPR complaint dossier for their chosen EU data protection authority.

## Motivation

The `privacy-scan` skill already produces a detailed, legally-grounded report of GDPR/ePrivacy violations on any website. That report stops one step short of useful civic action: the user can *see* that a site is violating the law, but the gap between "I have evidence" and "I filed a complaint" is a legal-drafting burden that stops most non-lawyers from filing. This feature closes that gap.

The broader framing is a deliberate repositioning: rather than publishing identifiable scan results under the maintainer's name (which reads as "attacking companies"), the skill becomes a neutral instrument that empowers *anyone* to hold *any* site accountable, filing under their own name to the DPA of their choice. The DPA-complaint feature is what completes that reframe — the scanner becomes a reporting tool, not an accusation.

## Non-goals

- Automated submission to DPA portals (no Playwright against official forms, no email auto-send, no API calls on the user's behalf). The user submits manually. This is a deliberate posture.
- Scanner changes. The complaint builder consumes the existing scan contract; scanner gaps are tracked separately.
- Legal review service or human-in-the-loop review.
- Multi-controller complaints. One dossier targets one controller.
- Non-EU jurisdictions. GDPR/ePrivacy shape only; UK ICO is included because UK-GDPR is near-identical.

## Deferred

- Additional DPA adapters beyond the three seed adapters. Contribution-driven; each new adapter is a JSON file against the published schema.
- Smart-routing (auto-suggested lead DPA vs. complainant DPA with trade-off explanation). A one-sentence information display in the DPA picker covers the initial need; full routing decision support is deferred.
- Complaint follow-up tooling, filing history/search, internationalised letter generation.

## Scope & integration

A new slash command `/file-dpa-complaint <scan-json-path>` in the existing `privacy-scan` skill.

- Takes a scan JSON produced by `scripts/scan.js`.
- Walks the user through curation → identity → DPA selection → dossier build.
- Writes a folder-shaped dossier (see Dossier layout) to the working directory.
- Fully offline after loading the scan JSON. No telemetry, no network calls.
- Zero changes to `/privacy-scan`. Independent entry point.

Seed adapters at launch: Dutch AP, French CNIL, UK ICO.

The scan JSON contract (`templates/analysis-schema.json`) is the only coupling surface between the scanner and the complaint builder. If the scanner schema changes, the complaint builder tracks it; this is the only cross-cutting maintenance cost.

## Workflow

Running `/file-dpa-complaint /tmp/privacy-scan-example.com-*.json` executes:

1. **Load & validate scan JSON.** Read the file, check against the scanner's schema, abort with a clear error if the JSON is malformed or from an incompatible scanner version. Print a one-line scan summary.

2. **DPA selection.** Show the three available adapters with a one-line enforcement summary for each. Ask the user to pick one. Also display a sentence with the one-stop-shop lead DPA inferred from the scan's cross-border analysis, so the user can see whether their choice aligns with the procedurally-simpler lead authority.

3. **Controller detection.** Pre-fill controller fields from the scan: domain, registered company name if available from imprint/legal-page extraction, HQ country from cross-border analysis. Show these to the user and ask "confirm or edit". Fields the scanner can't fill (DPO email, postal address) are shown as `[TO FILL]` and flagged in the final submission checklist.

4. **Complainant identity.** Check for `~/.claude/privacy-complaint/complainant.json`. If present, offer "use saved profile? [Y/n/edit]". If absent, prompt for name / address / email / data-subject-status, write the profile for reuse. `--anonymize` flag skips this entirely and leaves placeholders in the dossier.

5. **Violation curation.** Iterate through the scan's findings grouped by article. For each finding with actionable status, display: the finding in plain language, the article it violates, one-line enforcement precedent if present in `references/enforcement.md`, and a `[Y/n]` prompt defaulting to Y. Non-actionable findings default to `n` and are only asked about if the user passed `--include-all`. After the pass, show the final list and ask for final confirmation.

6. **Dossier build.** Generate the folder into the working directory. Print the full folder path, the submission checklist location, and a final reminder: the filing is the user's, not the tool's.

Steps 2–5 are restartable. Partial state is written to `.complaint-draft-{slug}.json` in the working directory; re-running the command detects it and offers to resume. Deleted automatically on successful build.

### Actionable findings filter

Default curation pre-ticks findings matching these article clusters:

- Unlawful pre-consent tracking (Art. 6 GDPR + Art. 5(3) ePrivacy)
- Missing / broken consent mechanism (Art. 7 GDPR)
- Dark patterns in the banner (per EDPB Guidelines 03/2022)
- Cross-border transfers without safeguards (Ch. V GDPR)
- Missing or inadequate privacy notice (Art. 13/14 GDPR)
- Ignored reject / consent-withdrawal failure (Art. 7(3) GDPR)

Everything else is context-only in the dossier unless the user opts in via `--include-all`.

## Data model

Three pieces of state: the per-DPA adapter, the complainant profile, and the draft state.

### Per-DPA adapter

Location: `references/dpa-adapters/{id}.json`. Must satisfy `references/dpa-adapters/_schema.json`.

```json
{
  "id": "nl-ap",
  "name": "Autoriteit Persoonsgegevens",
  "country": "NL",
  "jurisdiction": "Netherlands",
  "languages": ["nl", "en"],
  "letterLanguage": "en",
  "submission": {
    "portalUrl": "https://...",
    "acceptsEmail": true,
    "email": "klacht@...",
    "acceptsPost": true,
    "postalAddress": "..."
  },
  "form": {
    "requiredFields": ["complainantName", "complainantAddress", "complainantEmail",
                       "controllerName", "factsSummary", "articlesCited"],
    "fieldMapping": {
      "complainantName": "Uw naam",
      "complainantAddress": "Uw adres"
    },
    "attachmentsAccepted": ["pdf", "png", "jpg"],
    "maxTotalAttachmentMB": 25
  },
  "enforcementFocus": [
    {"article": "Art. 6", "weight": "high"},
    {"article": "ePrivacy Art. 5(3)", "weight": "high"}
  ],
  "enforcementExamples": [
    {"year": 2024, "target": "...", "fine": "...", "articles": ["..."]}
  ],
  "procedural": {
    "responseTimeMonths": 3,
    "acknowledgementExpected": true,
    "canFileInEnglish": true,
    "notes": "..."
  }
}
```

Intentionally all-data, no code. Contributors add a new DPA by writing one JSON file and a fixture test.

### Complainant profile

Location: `~/.claude/privacy-complaint/complainant.json`.

```json
{
  "fullName": "...",
  "postalAddress": {
    "street": "...",
    "city": "...",
    "postalCode": "...",
    "country": "..."
  },
  "email": "...",
  "phone": "...",
  "dataSubjectStatus": "self",
  "createdAt": "2026-04-24T..."
}
```

`dataSubjectStatus` is `"self"` or `"representative"` (for Art. 80 filings on behalf of another subject). First line of the file is a comment warning the user not to commit it to a public repo and showing the delete command.

### Draft state

Location: `.complaint-draft-{slug}.json` in the working directory. Only present during an interrupted run. Records which workflow steps completed and what was chosen. Read on resume; deleted on successful dossier build. `.gitignore` pattern is added to the repo to prevent accidental commits.

## Dossier layout

`dpa-complaint-{slug}-{YYYY-MM-DD}/`:

```
├── README.md                    # Overview + what to do next
├── submission-checklist.md      # DPA-specific: where to upload, what to paste, which language
├── complaint.md                 # The complaint letter (markdown source of truth)
├── complaint.pdf                # Typeset version of complaint.md for email/portal upload
├── facts.md                     # Per-violation narrative, one section per article
├── articles-cited.md            # Appendix: full text of each cited article + triggering finding
└── evidence/
    ├── scan.json                # Original scan JSON, full, unmodified
    ├── scan-summary.md          # Human-readable digest from analysis-brief.js
    ├── screenshots/
    │   ├── banner-viewport.png
    │   ├── banner-fullpage.png
    │   └── ...                  # Scan-produced screenshots relevant to cited findings
    ├── trackers.csv             # Per-tracker: domain, category, jurisdiction, pre-consent?, article
    ├── cookies.csv              # Per-cookie: name, domain, purpose, duration, pre-consent?
    └── timeline.md              # Audit trail: what loaded when, before and after consent events
```

Generation rules:

- `complaint.md` is the source of truth; `complaint.pdf` is derived from it at build time. PDF generation uses Playwright's bundled chromium (already available via the scanner). If PDF generation fails, the skill still writes the folder and warns — the complaint remains submittable from markdown or print.
- `facts.md` has one section per cited article: the article's relevant clause quoted, the specific finding from the scan, evidence file links into `evidence/`, and any enforcement precedent from `references/enforcement.md`.
- `articles-cited.md` is verbatim from GDPR / ePrivacy, bundled in-repo under `references/article-text/` so the skill works offline.
- `evidence/trackers.csv` and `cookies.csv` contain only rows for the violations the user selected during curation. Keeps the dossier scoped to what was filed. Full scan remains at `evidence/scan.json` for DPA audit.
- Filenames are deterministic — no timestamps inside filenames other than the folder name. Folder is diffable across re-runs with different curation choices.
- If the target folder already exists (same domain + same date), the skill prompts the user: overwrite, add a numeric suffix (`-2`, `-3`), or abort. Overwrite is never silent.
- No watermark or tool branding in the complaint body. The PDF footer includes one line: `Generated with privacy-scan DPA complaint builder (open source). Reviewed and signed by the complainant.` Transparency, not marketing.

### `--inline` mode variation

When invoked with `--inline`, the skill produces a single `dpa-complaint-{slug}-{YYYY-MM-DD}.md` file instead of the folder. The letter, facts, and articles-cited sections are concatenated; evidence is reduced to inline tables (tracker/cookie rows) and `[SEE SCAN JSON]` pointers. No PDF, no screenshots embedded. Intended for users pasting into a portal textarea. Not the default.

## Implementation surface

### New files

```
scripts/
  file-dpa-complaint.js              # Entry point for the slash command
  complaint/
    load-scan.js                     # Read + validate scan JSON against schema
    select-dpa.js                    # Interactive DPA picker, loads adapter
    detect-controller.js             # Pre-fill controller fields from scan
    load-profile.js                  # Complainant profile I/O + --anonymize handling
    curate-findings.js               # Interactive Y/n loop over actionable findings
    build-dossier.js                 # Orchestrates folder build from curated state
    render-complaint-md.js           # complaint.md + facts.md + articles-cited.md
    render-pdf.js                    # complaint.md → complaint.pdf via chromium
    render-evidence.js               # trackers.csv, cookies.csv, timeline.md, screenshot copy
    render-checklist.js              # submission-checklist.md from DPA adapter
    draft-state.js                   # Read/write .complaint-draft-{slug}.json
  validate-adapter.js                # CLI validator for contributors adding new DPAs

references/
  dpa-adapters/
    nl-ap.json
    fr-cnil.json
    uk-ico.json
    _schema.json                     # JSON schema the three above must satisfy
  article-text/
    gdpr/                            # One file per article, markdown, verbatim
    eprivacy/
  complaint-templates/
    letter.md.hbs                    # Handlebars template for complaint.md
    facts-section.md.hbs             # Per-article facts block
    readme.md.hbs                    # Dossier README
    checklist.md.hbs                 # Per-DPA submission checklist

tests/
  fixtures/
    sample-scan.json                 # Minimal valid scan used by tests
    sample-adapter.json              # Test adapter
  complaint/
    load-scan.test.js
    detect-controller.test.js
    curate-findings.test.js
    build-dossier.test.js
    render-complaint-md.test.js
    render-pdf.test.js               # Smoke test: PDF produced, non-empty
    render-evidence.test.js
    draft-state.test.js
    validate-adapter.test.js
  e2e/
    full-flow.test.js                # End-to-end fixture → full dossier, assert all files + content anchors
```

### Modified files

- `SKILL.md` — new top-level "DPA Complaint Builder" section with command signature, flags (`--anonymize`, `--include-all`, `--dpa <id>`, `--output-dir <path>`, `--inline`), and a one-paragraph pointer to the dossier layout.
- `package.json` — add `handlebars` dependency. PDF uses existing Playwright chromium; CSV writing is hand-rolled.
- `.gitignore` — add `.complaint-draft-*.json` pattern.
- `references/README.md` — index the new `dpa-adapters/`, `article-text/`, and `complaint-templates/` subtrees.

### Explicitly unchanged

- `scripts/scan.js`, `scripts/generate.js`, `scripts/analysis-brief.js`, `scripts/extract-summary.js`, `scripts/validate-analysis.js` — the scanner pipeline is untouched.
- `templates/analysis-schema.json` — the scan JSON contract is the interface; changing it is out of scope.
- The existing Supabase publish flow (Step 12 in `SKILL.md`) — not touched, not referenced from the complaint builder. The complaint builder is fully local.

### Flags (surface reference)

- `--dpa <id>` — skip the interactive picker (values: `nl-ap`, `fr-cnil`, `uk-ico`).
- `--anonymize` — skip the complainant profile; dossier uses placeholders.
- `--include-all` — include non-actionable findings in the curation pass.
- `--output-dir <path>` — override the default working-directory output.
- `--inline` — produce a single markdown file instead of a folder. For users pasting into portal textareas.

### Testing approach

Unit tests per script file. One end-to-end test runs the full flow against a fixture scan with scripted answers and asserts: resulting folder structure, file count, key content anchors (article citations present, evidence files populated, PDF non-empty). No tests hit real DPA portals or the network.

### Build sequence (for the implementation plan)

1. Adapter schema + validator + three seed adapters. Buildable without any other code existing.
2. `load-scan.js`, `draft-state.js`, `load-profile.js` — infrastructure plumbing.
3. `detect-controller.js`, `select-dpa.js`, `curate-findings.js` — interactive layer.
4. `render-complaint-md.js`, `render-evidence.js`, `render-checklist.js` — content renderers, each testable in isolation from a fixture state.
5. `render-pdf.js` — last among renderers, depends on `complaint.md` being stable.
6. `build-dossier.js` + `file-dpa-complaint.js` — orchestration.
7. End-to-end fixture test.
8. Article-text bundles — parallelisable with the above; it's data entry.
9. `SKILL.md` doc update.

## Cross-cutting concerns

- **Scanner schema versioning.** The complaint builder should read a `schemaVersion` field from the scan JSON and refuse incompatible versions. If `templates/analysis-schema.json` does not emit one today, a small companion change alongside this feature adds it. Soft prerequisite for the implementation plan.
- **Open-source readiness of the rest of the repo.** Out of scope for this spec. The complaint builder has no private dependencies and is OSS-ready by construction; what ultimately gets published is a separate decision.
- **Footgun prevention.** When the dossier is built from a populated complainant profile (i.e., not `--anonymize`), the skill writes a visible warning in the final terminal output that the generated dossier contains the user's personal data and should not be committed to a public repository. The `.gitignore` addition covers the draft state file but cannot cover dossier folders (whose names are deterministic per-site); the terminal warning is the mitigation. Under `--anonymize` the warning is suppressed since the dossier contains only placeholders.

## Open questions

None blocking. Resolved in brainstorming:

- Dossier scope: DPA-agnostic vs. user-picks vs. auto-routed → user-picks with three seed adapters.
- Violation selection: everything vs. actionable-only vs. user-curated → user-curated with actionable pre-selection.
- Integration style: continuation of scan vs. separate command vs. separate skill/repo → separate slash command, same skill/repo.
- Identity handling: prompt-per-run vs. local profile vs. CLI flags vs. placeholders-only → local profile with `--anonymize` fallback.
- Output shape: markdown vs. folder vs. folder + PDF vs. zip → folder + PDF.
