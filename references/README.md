# References Directory

Reference material the scanner uses during analysis. Two-layer structure mirroring the upstream privacy-wiki:

```
references/
├── README.md                   # This file
├── analysis-guide.md           # Step-by-step analysis methodology
├── scoring.md                  # Category weights, modifiers, public-score conversion
├── field-contract.md           # Exact JSON field names the generator expects
├── enforcement.md              # Verified DPA enforcement compendium (by criterion)
├── trackers.md                 # Tracker signatures (Google, Meta, Hotjar, etc.)
├── jurisdictions.md            # Adequacy decisions, DPF certification, country risk
├── gdpr-articles.md            # Quick-reference summaries of GDPR articles
├── criteria/                   # Per-criterion fast-reference (read for the criterion you're scoring)
│   ├── index.md
│   ├── consent.md
│   ├── dark-patterns.md
│   ├── pre-consent-tracking.md
│   ├── legal-pages.md
│   ├── security-headers.md
│   ├── cookie-hygiene.md
│   ├── retention.md
│   ├── dpia.md
│   ├── fingerprinting.md
│   ├── cross-border.md
│   ├── dsar.md                 # NEW
│   ├── processor-transparency.md  # NEW
│   ├── breach-notification.md  # NEW
│   ├── opt-out-mechanism.md    # NEW
│   └── special-categories.md   # NEW (context-aware)
└── concepts/                   # Cross-cutting deep-dives (read when criteria reference them)
    ├── eprivacy-art-5-3.md
    ├── google-consent-mode-v2.md
    ├── edpb-key-guidelines.md
    └── dark-patterns-taxonomy.md
```

## How To Use

**During analysis** (Step 5–8 of the workflow):
1. Read `analysis-guide.md` — it tells you which criteria apply and how to score
2. For each criterion you're evaluating, read its `criteria/<name>.md` page
3. Follow concept references when the criterion file points to one
4. Read `field-contract.md` before writing the analysis JSON
5. Cite enforcement examples from the criterion's enforcement table or from `enforcement.md`

**When citing fines:**
- Prefer ETid references (e.g., `ETid-1844`) — these resolve in the upstream privacy-wiki `fines.db`
- For ePrivacy-only fines (CNIL Amazon Europe Core 2020, CNIL Microsoft Ireland 2022, Belgian APD IAB Europe 2022) — cite the DPA decision URL directly because they're not in the GDPR enforcement dataset

**When updating enforcement examples:**
Cross-reference against an authoritative source. The maintainer's setup uses a
local SQLite snapshot of [GDPR Enforcement Tracker](https://www.enforcementtracker.com/),
queried like so (path is local-only; this DB is **not** bundled with the
repo):

```bash
sqlite3 <path/to/your/privacy-wiki>/fines.db \
  "SELECT etid, controller, country, dpa, date_iso, fine_amount_eur, violation_type
   FROM fines WHERE controller LIKE '%X%' ORDER BY fine_amount_eur DESC;"
```

For contributors without a local DB, verify directly against the DPA's
published decision URL.

## Verification Discipline

Every fine in this directory has been verified against `fines.db` (3,082-fine dataset) or via WebSearch against the originating DPA's published decision. Past errors (Meta €405M ≠ fingerprinting; CNIL 2020 €135M ≠ fingerprinting; wiki ETid-1374 mis-cited as €746M when DB has €480) demonstrate why this matters — privacy enforcement is a high-trust domain and a single fabricated number undermines an entire report.

When updating: **never copy a citation from training data, prior conversation, or web sources without verifying the amount + date against an authoritative source**.

## DPA Complaint Builder subtrees

The `/glasshouse-file` command (see `SKILL.md`) reads three additional subtrees here:

- `dpa-adapters/` — One JSON file per supported Data Protection Authority. All adapters must validate against `dpa-adapters/_schema.json`. To add a DPA, copy an existing file (`nl-ap.json`, `fr-cnil.json`, or `uk-ico.json`), edit values to match the authority's published pages, and validate with `node scripts/validate-adapter.js references/dpa-adapters/<id>.json`. Where a DPA site blocks plain HTTP fetches, `node scripts/fetch-page.js <url>` renders it in Playwright Firefox to dump the body text.
- `article-text/` — Verbatim text of every GDPR / ePrivacy / EDPB provision the complaint builder cites, bundled so the dossier works offline. Each file lists its source URL and retrieval date at the top. Update only against the authoritative source (EUR-Lex for GDPR/ePrivacy; edpb.europa.eu for EDPB guidelines).
- `complaint-templates/` — Handlebars templates used to render the dossier: `letter.md.hbs`, `facts-section.md.hbs`, `readme.md.hbs`, `checklist.md.hbs`.
