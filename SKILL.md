---
name: glasshouse
description: "Audit any website against GDPR/ePrivacy and (optionally) turn the findings into a ready-to-file DPA complaint. The skill has two subcommands: `scan` (default — runs a privacy audit and generates a scored presentation + report) and `file` (turns an existing scan into a complaint dossier for a chosen Data Protection Authority)."
user_invocable: true
---

# Glasshouse — privacy audit + DPA complaint builder

Automated privacy audit: scan a website, analyze findings against GDPR/ePrivacy, generate a scored presentation + report. Optionally turn the scan into a ready-to-file complaint dossier.

**Base directory**: The skill lives at the path shown in the "Base directory for this skill" message injected at invocation time. All `cd` commands and file references below use `$SKILL_DIR` as shorthand for that path.

## Subcommand dispatch

The skill has two subcommands sharing one slash command. Parse `ARGUMENTS` to route:

| First token | Mode | Example |
|---|---|---|
| (URL) or `scan <url>` | **scan** (default) | `/glasshouse www.example.com`, `/glasshouse scan www.example.com` |
| `file <scan-json-path>` | **file** (build complaint) | `/glasshouse file /tmp/glasshouse-example.com-*.json` |

If the first token is `scan` or `file`, treat it as the mode and use the remaining arguments as the mode's input. Otherwise default to `scan` mode with the whole argument as the URL.

If `ARGUMENTS` is empty, ask: "Do you want to **scan** a website (give a URL) or **file** a complaint from an existing scan (give a scan JSON path)?"

---

# Scan mode

The user provides a URL. Everything else is determined conversationally or uses smart defaults.

## Conversational flow

1. **Extract the URL** — Parse from the user's message. If missing, ask: "What website should I scan?"
2. **Check for context clues** — Look for hints like "for a client", "corporate", "executive summary", or a company name.
3. **Determine settings** — Only ask when ambiguous:

| Setting | Default | When to ask |
|---------|---------|-------------|
| **Theme** | `corporate` | `datagobes` if maintainer is generating their own deck; `corporate` or `dark` otherwise |
| **Format** | Full (up to 15 slides) | Only if user says "quick", "summary", or "executive" |
| **Branding** | None | The `datagobes` theme adds the maintainer's `>_ datagobes.dev` signature; `corporate` and `dark` carry no branding |

4. **Start immediately** — Don't ask unnecessary questions. The defaults are good.

## Workflow

### Step 1: Prerequisites

Before first use, ensure Playwright is installed:

```bash
cd $SKILL_DIR && npm install 2>/dev/null && npx playwright install firefox 2>/dev/null
```

Skip if `node_modules/playwright` already exists.

### Step 2: Scout the banner

Run a lightweight scout first to detect the consent banner and identify button text — this takes ~10s instead of a full 3-variant scan:

```bash
cd $SKILL_DIR && node scripts/scan.js {URL} --scout
```

**Output**: JSON to stdout with:
- `screenshot` — path to viewport screenshot
- `cmpDetected` — CMP platform name or null
- `bannerDetected` — whether a consent banner was found
- `acceptButtonFound` / `rejectButtonFound` — whether the scanner can click them
- `candidateButtons[]` — all visible buttons in the banner area with `{text, selector, visible}`
- `recommendHints` — `true` if the scanner needs text hints for the full scan
- `suggestedAcceptText` / `suggestedRejectText` — auto-detected button text suggestions

**MANDATORY: Read the scout screenshot using the Read tool.**

Check the screenshot for:
- **Consent banner** — is one visible? Does it match the scout JSON?
- **Button text** — verify the `suggestedAcceptText`/`suggestedRejectText` match what's visible
- **Dark patterns** — asymmetric buttons, hidden reject, pre-checked toggles, colour contrast tricks
- **CMP platform** — identify from visual branding if scanner didn't
- **Cookie wall** — page content blocked behind consent dialog?

### Step 3: Run the full scan

Based on the scout results, run the full scan:

**If `recommendHints` is `false`** (scanner can detect buttons automatically):
```bash
cd $SKILL_DIR && node scripts/scan.js {URL}
```

**If `recommendHints` is `true`** (custom banner needs hints):
Use the button text from the scout results or your visual inspection of the screenshot:
```bash
cd $SKILL_DIR && node scripts/scan.js {URL} --accept-text "Accept all" --reject-text "Reject all"
```

Available hint flags:
- `--accept-text "..."` — Text of the "accept all" button
- `--reject-text "..."` — Text of the "reject all" button
- `--save-text "..."` — Text of a "save preferences" button (used as reject action — saving with toggles off = rejecting)

**Examples by language:**
- Dutch: `--accept-text "Alles accepteren" --save-text "Opslaan"`
- German: `--accept-text "Alle akzeptieren" --reject-text "Alle ablehnen"`
- French: `--accept-text "Tout accepter" --reject-text "Tout refuser"`

- Stdout: JSON file path (last line). Stderr: progress messages.
- **Failures**: Timeout = WAF, bot detection = stealth didn't help, missing Playwright = run step 1.

### Step 4: Verify full scan screenshots

The full scan saves `{base}-ignore-viewport.png` and `{base}-ignore-fullpage.png`. The JSON includes a `screenshots` object with paths.

**MANDATORY: Read the viewport screenshot using the Read tool BEFORE analyzing the JSON.**

Check the stderr output and the screenshot:

1. **Did the scanner click the consent buttons?** Look for `[Phase 2] Clicking consent accept button...` in stderr. If you see `Required button not found` instead, the scanner failed to interact with the banner.

2. **If the full scan also failed to click buttons** despite hints — identify the correct button text from the screenshot and re-run with corrected hints. Discard the failed scan.

Also check for:
- **Dark patterns** — asymmetric buttons, hidden reject, pre-checked toggles, colour contrast tricks
- **CMP platform** — identify from visual branding if scanner didn't
- **Cookie wall** — page content blocked behind consent dialog?

### Step 5: Read and analyze the JSON

**Generate an analysis brief** — a single-pass text extraction that produces ~18-20K chars from a ~1-2MB scan JSON (98-99% reduction). This replaces the old multi-chunk JSON reading approach.

```bash
cd $SKILL_DIR && node scripts/analysis-brief.js /tmp/glasshouse-{domain}-*.json
```

Output goes to stdout. **Read it with a single Bash call**, not multiple Read chunks. The brief contains all data needed for analysis in structured plain text: counts, trackers, cookies, domains, timeline events, security headers, legal pages, storage, fingerprinting, and truncated legal page content (first 3000 chars of each policy).

**If legal page content is truncated or missing** and you need the full text for Art. 13/14 analysis, fetch it separately (see below).

Legacy alternative (JSON, larger output — use only if you need machine-parseable data):
```bash
cd $SKILL_DIR && node scripts/extract-summary.js /tmp/glasshouse-{domain}-*.json
```

**Read `references/analysis-guide.md`** for:
- Three-tier tracker classification (trackers vs consent-mode pings vs SDK loads)
- Art. 12/13/14 privacy policy content analysis (13-item checklist + readability)
- Cookie purpose cross-reference methodology
- Data subject rights assessment
- New analysis sections: processor transparency, breach notification, opt-out, special categories

**Then for each criterion you're scoring, read `references/criteria/<name>.md`**. The 15 criterion files are the fast-reference surface — what the scanner checks, the legal basis, detection logic, verified enforcement examples, the field-contract fields the scanner emits, and the scoring impact. Cross-reference `references/criteria/index.md` for the full list and the article-to-criterion mapping.

**If `legalPageContent` is null** (scanner couldn't fetch policy text), **you MUST fetch the privacy policy and cookie policy yourself** using Playwright Firefox (not WebFetch — many sites block plain HTTP with bot protection). Run a one-off Playwright script from `$SKILL_DIR`:

```bash
cd $SKILL_DIR && node -e "
const { firefox } = require('playwright');
(async () => {
  const browser = await firefox.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0' });
  const urls = {URLS_OBJECT};
  for (const [key, url] of Object.entries(urls)) {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const text = await page.evaluate(() => document.body.innerText);
    require('fs').writeFileSync('/tmp/x-' + key + '.txt', text);
    console.log(key + ':', text.length, 'chars');
    await page.close();
  }
  await browser.close();
})();
"
```

Replace `{URLS_OBJECT}` with a JS object like `{ 'privacy-policy': 'https://...', 'cookie-policy': 'https://...' }`.

Then read the saved files and perform the full Art. 13/14 analysis, cookie purpose cross-reference, and data subject rights assessment. Never skip content analysis just because the scanner didn't extract it — the scanner's fetch is best-effort; yours is the fallback.

**Important**: Always prefer Playwright over WebFetch for any fallback page fetching during privacy scans. Sites with consent banners frequently have bot protection that blocks plain HTTP requests.

### Step 6: Score the findings

**Read `references/scoring.md`** for the full scoring rubric — category weights, per-category 0-100 internal scales, modifiers, and conversion to the public 1.0-10.0 score.

### Step 7: Fetch favicon

```bash
curl -sL "https://www.google.com/s2/favicons?domain={DOMAIN}&sz=128" | base64
```

Should be 200-4000 characters. If shorter, retry or skip.

### Step 8: Generate analysis JSON

Produce a structured JSON file. Write to `/tmp/privacy-analysis-{domain}.json`.

**Read `references/field-contract.md`** for exact field names and enum values before writing the JSON.

Top-level sections:

**`meta`**: `domain`, `scanDate`, `episode` (check existing `*-privacy-audit*.html`), `overallScore` (1.0-10.0), `theme`, `faviconBase64`, `subtitle`. Optional: `company`, `logoBase64`, `aliasDomains`.

- **`company`** is the *registered controller name* (e.g. `"DPG Media Magazines B.V."`). The complaint builder reads this directly when constructing the letter — populate it whenever you can identify it from the imprint or privacy policy.
- **`aliasDomains`** (array of eTLD+1 strings): populate when the scanner redirects across TLDs or the site owner controls multiple domains the user traverses in one session. Check the scanner JSON: if `meta.url` differs from the cookie domains (e.g. `meta.url=https://www.dyson.com` but most cookies land on `.dyson.nl`), the redirect target is a first-party alias — set `meta.aliasDomains: ["dyson.nl"]`. Cross-check against `variants.{ignore|accept}.preConsent.cookies[].domain` — any same-owner eTLD appearing repeatedly is a likely alias. Without this, the `cookieParty` slide misclassifies same-owner cookies as third-party.

**`scores`**: One entry per category (`consent`, `preConsentTracking`, `legalPages`, `crossBorder`, `securityHeaders`, `cookieManagement`, `darkPatterns`). Each has `score` (1.0-10.0).

**`findings`**: All structured data for slides:
- `tldr`: 3 takeaways (positive, negative, surprising) — `emoji`, `headline`, `detail`, `sentiment`
- `consent`: Banner details, annotations, button asymmetry
- `darkPatterns`: Fairness scale (tilt class, factors, verdict)
- `beforeAfter`: Pre/post cookie counts and pill breakdowns
- `auditTrail`: Pre-consent and post-consent timeline events — **always reconstruct manually** from scanner data. The scanner does NOT produce this. **Slide keys are `auditTrailPre` and `auditTrailPost`** — never use `auditTrail` as a slide key.
- `trackers`, `cookies`, `thirdPartyDomains`, `securityHeaders`, `legalPages`, `gdprCompliance`
- `requestPulse`: **Always reconstruct manually** from `summary.thirdPartyDomains[].requests`. Never skip this slide.
- `recommendations`: Max 8 prioritised actions, optional `enforcementRef` (see `references/enforcement.md`)
- `privacyPolicyAnalysis`, `fingerprinting`, `tcf`, `googleConsentMode`, `gpc`, `consentRevocation`, `formLeakage`, `dataSubjectRights`, `cookiePurposeMatching`, `consentGranularity`
- `rejectScenario`: Construct from reject variant data — list trackers/cookies that persist despite rejection, set `rejectHonoured` based on whether tracking meaningfully decreases
- `variantComparison`: Aggregate tracker/cookie/domain counts from each variant's summary for the side-by-side comparison chart
- `auditTrail.rejectConsent`: Timeline events after reject — reconstruct from reject variant significant events (same format as `postConsent`)
- `piggybackingChains`: Build from trackers where `is4thParty: true` — trace `loadedBy` chains
- `storageAnalysis`: Consolidate from summary's `preConsentLocalStorage`, `postConsentLocalStorage`, `preConsentIndexedDB`, `postConsentIndexedDB`
- `cookiePurposeMatching`: Cross-reference scanner-classified cookie purposes with privacy policy declarations
- `cookieParty`: Derived slide — no data needed. Auto-splits `findings.cookies[]` into first-party vs third-party by eTLD+1 match against `meta.domain` + `meta.aliasDomains[]`. Just make sure `meta.aliasDomains` is set for redirect-chain sites.

**`slides`**: `include` array of slide type names in display order. Omit slides with no meaningful content.

**`customSlides`** (optional): Named slots — `after-overview`, `after-consent`, `after-tracking`, `after-details`, `before-recommendations`. Each has `title`, `content` (raw HTML), `style`.

**`markdownReport`**: Prose sections — `executiveSummary`, `consentAnalysis`, `preConsentAnalysis`, `postConsentAnalysis`, `storageAnalysis`.

### Step 9: Validate analysis JSON

**MANDATORY** — run before generating to catch schema errors that cause empty/broken slides:

```bash
cd $SKILL_DIR && node scripts/validate-analysis.js /tmp/privacy-analysis-{domain}.json
```

- Exit code `0` = pass (warnings are informational only)
- Exit code `1` = errors found — **fix the JSON before proceeding**
- The validator catches wrong field names (`methods` vs `apiCalls`, `domain` vs `domains`, `title` vs `action`, etc.), missing required fields, invalid enums, and anti-patterns

If errors are reported, fix the analysis JSON and re-run validation until it passes. Only then proceed to Step 10.

### Step 10: Generate HTML + markdown

```bash
cd $SKILL_DIR && node scripts/generate.js /tmp/privacy-analysis-{domain}.json --output-dir {CWD}
```

The script reads the JSON, extracts CSS/JS from `templates/presentation-theme.md`, builds slides with auto-pagination, and generates both `.html` and `.md` files.

### Step 11: Verify output

**Do not just check that the script ran — verify the key slides actually rendered data.**

Run this extraction to pull slide titles and a quick sanity check:

```bash
grep -o 'data-title="[^"]*"' {OUTPUT_HTML} | sed 's/data-title=//;s/"//g'
```

Then spot-check these specific slides in the HTML:

```bash
# Persistence bars — must show non-zero width values
grep -o 'persist-bar[^"]*" style="width:[^%]*%' {OUTPUT_HTML} | head -5

# Audit trail pre — must have timeline events
grep -c 'tl-event' {OUTPUT_HTML}

# Request pulse bars — must have rp-bar elements
grep -c 'rp-bar-pre\|rp-bar-post' {OUTPUT_HTML}
```

**If persistence bars show `width:0%` or no `tl-event` elements exist:**
1. Check `findings.cookies[].durationDays` — must be an integer (not missing). Session = 0, all others from scan data.
2. Check `findings.auditTrail.preConsent` — data must be at `findings.auditTrail`, NOT `findings.auditTrailPre`. The slides.include keys `auditTrailPre`/`auditTrailPost` are slide identifiers only; the data lives at `findings.auditTrail.{preConsent,postConsent}`.
3. Fix the analysis JSON and re-run `generate.js`.

Report file paths and the slide count to the user once verified. If they may want to file a complaint based on the findings, offer it (e.g. "Want me to turn this into a complaint dossier for the Dutch AP? Run `/glasshouse file <scan-json-path>`.").

## Episode numbering

Sequential across scans. LinkedIn = #01. Check existing `*-privacy-audit*.html` files in the working directory for the next number.

## Important: do not delegate analysis JSON generation

Background/subagents cannot write files or run bash in this environment. Always generate the analysis JSON, run validation, and run `generate.js` in the **main conversation context** — never delegate these steps to a subagent.

## Cookie wall handling

Some sites redirect to a separate consent domain. The scanner detects and bypasses these automatically. The JSON includes a `cookieWall` field (`detected`, `type`, `name`, `wallDomain`, `bypassAttempted`, `bypassSuccess`, `bypassMethod`). When `cookieWall` is `null`, no wall was detected. `consent.viaCookieWall: true` means consent was accepted on the wall page. Pre-consent state is captured on the wall page, not the target.

## Multi-layer banner handling

Many CMPs (and walls like DPG Media's Privacy Gate) hide the "Reject all" button behind a "Manage settings" / "Instellen" / "Customize" click — the reject path only appears on layer 2. The scanner now traverses one layer deep before giving up:

- **`findings.consent.rejectAccessibility`** = `"layer-1"` (reject on the first panel), `"layer-2"` (reject reached after opening settings), or `"not-found"` (no reject path discovered even after traversal). Always read this in the audit narrative — do not infer "no reject" from missing fields.
- **`findings.consent.multiLayer`** (boolean) = `true` when reject required opening layer 2. Surface this as a dark pattern in the report ("reject required two clicks vs accept's one" — CNIL Bing precedent).
- **`findings.consent.multiLayerMethod`** = `"layer2-direct-reject"` (clicked a reject button on layer 2) or `"layer2-toggle-save"` (unchecked non-essential toggles and saved).

For cookie walls, the same fields surface on `cookieWall.multiLayer` and `consent.multiLayer`, and `bypassMethod` becomes `multilayer-layer2-direct-reject` / `multilayer-layer2-toggle-save` instead of the old `reject-button-not-found`.

When writing the audit narrative for a site with `rejectAccessibility === "layer-2"`: name it as a "Hidden Defaults / Multi-Layer Consent" dark pattern, not as a missing-reject case or "pay-to-play" scheme. See `references/criteria/dark-patterns.md`.

## Error handling

- **Playwright missing**: `cd $SKILL_DIR && npm install && npx playwright install firefox`
- **Malformed JSON**: Report scan failure, suggest manual inspection
- **Login wall**: Note in report, scan covers public-facing pages only
- **TLS failure**: Skip TLS section, note in errors
- **No consent banner**: Score consent as 0, note all tracking is unconsented
- **Cookie wall bypass fails**: Error logged, pre-consent state from wall page
- **generate.js fails**: Check analysis JSON for schema violations, fix and re-run

## Notes

- Point-in-time snapshot — results may vary
- CMPs load asynchronously; scan waits 3s after page load
- Cookie values truncated to 200 chars
- Bot detection may prevent some features from loading
- The HTML generator handles all layout, pagination, and theming — you only produce the analysis JSON

---

# File mode (DPA complaint builder)

`/glasshouse file <scan-json-path>` turns an existing scan into a ready-to-submit GDPR complaint dossier for a user-chosen Data Protection Authority. The command is fully local, fully offline after the scan is loaded, and performs no automated submission — the dossier is for the user to review and file themselves.

## Agent-driven curation flow

The script is interactive when run in a terminal, but **inside the Claude Code conversation you must drive the curation in chat**, not via the script's stdin. The script's prompts cannot reach the user from a subprocess. Use the non-interactive flags described below.

The flow:

### Step 1: List findings

```bash
cd $SKILL_DIR && node scripts/glasshouse-file.js <scan-json-path> --list-findings
```

This emits JSON to stdout:
```json
{
  "meta": { "domain": "...", "scanDate": "..." },
  "controller": { "registeredName": "...", "country": "...", "imprintUrl": "...", "dpoEmail": "..." },
  "candidates": [
    { "id": "<10-char hash>", "kind": "preConsentTracker", "headline": "...", "detail": "...", "articles": [...], "actionable": true }
  ]
}
```

Add `--include-all` if you want non-actionable findings (e.g. missing cookie policy) to appear too.

### Step 2: Present and let the user pick

Show the candidates to the user in chat. For each one, give a one-sentence read of why it matters legally (which article, what the enforcement risk looks like) — that's where you add value over a unix prompt. Then ask the user which to file: free-form, numbered, "all of them", or by id.

Defaults are conservative: don't pick for the user. The whole point of this fix is that the previous version silently included everything.

### Step 3: Confirm the controller

The `controller.registeredName` comes from `meta.company` in the scan analysis JSON when present, else it tries to parse the privacy-policy excerpt. If `registeredName` is `[TO FILL]`, ask the user to confirm the company name (and country, postal address, DPO email if also `[TO FILL]`). You can pass overrides through the chat, but the script doesn't accept controller overrides via flags — instead just remind the user that they'll need to fill those in `complaint.md` before submitting.

### Step 4: Pick the DPA

Default to the lead supervisory authority based on controller country (the `--list-findings` output tells you the country, or you can call `node -e "console.log(require('./scripts/complaint/select-dpa').inferLeadDpa(require('<scan>')))"`).

Available DPA ids (kept in sync with `references/dpa-adapters/`):

| id | Authority | Country |
|---|---|---|
| `nl-ap` | Autoriteit Persoonsgegevens | Netherlands |
| `fr-cnil` | CNIL | France |
| `uk-ico` | Information Commissioner's Office | United Kingdom |
| `ie-dpc` | Data Protection Commission | Ireland |
| `de-bfdi` | BfDI | Germany (federal) |
| `de-berlin` | Berliner Beauftragte | Germany (Berlin) |
| `de-hamburg` | HmbBfDI | Germany (Hamburg) |
| `de-bayern` | BayLDA | Germany (Bayern, private sector) |
| `de-nrw` | LDI NRW | Germany (NRW) |

### Step 5: Identity vs anonymize

Two paths:

- **Anonymize** — the dossier uses placeholders for the complainant. Use this when the user hasn't shared identity in the conversation, or asks for it explicitly. Pass `--anonymize`.
- **Identified** — the dossier contains the complainant's real name, address, email. The complainant must already have a saved profile at `~/.claude/privacy-complaint/complainant.json`, or pass all six flags: `--full-name "..." --email "..." --street "..." --postal-code "..." --city "..." --country "NL"` (+ optional `--phone "..." --save-profile`).

Default to `--anonymize` unless the user has clearly opted in to using their real identity.

### Step 6: Build

```bash
cd $SKILL_DIR && node scripts/glasshouse-file.js <scan-json-path> \
  --yes \
  --dpa <id> \
  --include <comma-separated-ids> \
  --anonymize \
  --output-dir <cwd> \
  --on-collision suffix
```

The `--yes` flag is **required** for non-interactive runs. Without it the script errors out — the TTY guard prevents silently filling in defaults the user never approved.

### Step 7: Verify and report

The dossier folder contains:
- `complaint.md` / `complaint.pdf` — the letter
- `facts.md` — per-article narrative
- `articles-cited.md` — verbatim provision text
- `submission-checklist.md` — where + how to file
- `README.md`
- `evidence/` — scan.json, screenshots, trackers.csv, cookies.csv, timeline.md

Verify the controller name in `complaint.md` matches what the user expects (look at the `**Concerning:**` line). If the user used `--anonymize`, remind them which placeholders they need to fill before submitting: `[COMPLAINANT NAME]`, `[STREET]`, `[POSTAL CODE]`, `[CITY]`, `[COUNTRY]`, `[COMPLAINANT EMAIL]`, and any `[TO FILL]` fields in the controller block.

## Full flag reference

| Flag | Effect |
|---|---|
| `--list-findings` | Emit candidates as JSON, exit. No prompts, no side effects. |
| `--include <ids>` | Comma-separated finding IDs to file. Required when `--yes` is set. |
| `--yes` | Suppress every confirmation prompt; use defaults. Required when stdin isn't a TTY. |
| `--dpa <id>` | Skip the DPA picker (ids listed above) |
| `--anonymize` | Use placeholders instead of a stored complainant profile |
| `--include-all` | Include non-actionable findings in the candidate list (default: actionable only) |
| `--output-dir <path>` | Override the output root (default: cwd) |
| `--inline` | Produce a single markdown file instead of a folder |
| `--on-collision <p>` | Behaviour when folder exists: `abort` (default) / `overwrite` / `suffix` |
| `--full-name`, `--email`, `--phone`, `--street`, `--postal-code`, `--city`, `--country` | Complainant fields for non-interactive use without `--anonymize` |
| `--save-profile` / `--no-save-profile` | Persist (or don't) the entered complainant profile to `~/.claude/privacy-complaint/` |

## Adding a DPA

Every DPA is one JSON file in `references/dpa-adapters/`. Copy `nl-ap.json`, edit values, validate:

```bash
cd $SKILL_DIR && node scripts/validate-adapter.js references/dpa-adapters/<new>.json
```

See `references/dpa-adapters/_schema.json` for the required shape. When you add a new adapter, also update the DPA table in this file (Step 4 above) and the `--dpa` line in `scripts/glasshouse-file.js`'s usage text.

## Important

The dossier contains the complainant's personal data (name, address, email) unless `--anonymize` is used. **Do not commit dossier folders to public repositories.** The `.gitignore` added by the complaint builder covers `dpa-complaint-*/` by default.

The complaint is the complainant's filing, not the tool's. Review `complaint.md` and `facts.md` before submitting; edit anything the user does not want to defend.
