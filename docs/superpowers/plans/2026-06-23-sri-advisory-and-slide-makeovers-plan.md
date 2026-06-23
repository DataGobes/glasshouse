# Plan: SRI Advisory + Slide Makeovers

Spec: `docs/superpowers/specs/2026-06-23-sri-advisory-and-slide-makeovers-design.md`
Repo: `glasshouse` privacy-scan skill. Worktree on `main` @ `161d676` (PR #13 merged).

## Global Constraints (bind every task)

- **Design language — the "Ember" palette.** The deck's default theme (`:root` in
  `templates/presentation-theme.md`). Use these CSS variables, never hard-coded hex:
  `--bg-primary #f0ebe0`, `--bg-card #fff`, `--bg-card-border rgba(28,25,23,0.08)`,
  `--text-primary #1c1917`, `--text-secondary #6b6259`, `--text-muted #a09888`,
  `--accent #c75c2c`, `--accent-green #059669`, `--accent-yellow #d97706`,
  `--accent-red #dc2626`, `--accent-blue #2563eb`; fonts `--font-display` (Inter),
  `--font-mono` (JetBrains Mono); sizes `--body-size`, `--small-size`, `--mono-size`;
  spacing `--content-gap`, `--element-gap`; `--card-shadow`, `--ease-out-expo`.
- **Slide structure.** Each slide is `<section class="slide" data-title="…"><div class="slide-content">…`
  + `${watermark()}` + `<div class="slide-num">`. `.reveal` children animate in when the
  slide gets `.visible`. Keep `data-title` values **unchanged** (nav + screenshot harness key off them).
- **CSS lives in `templates/presentation-theme.md`** inside ```` ```css ```` fences; slide-builder
  JS lives in `scripts/generate.js`. Put new styles in the theme file, not inline in JS. Avoid
  ad-hoc inline `style="…"` in the builders except for genuinely data-driven values (e.g. a bar
  width computed from data); never use inline styles that override a class's themed colour.
- **No score-logic changes outside Task 1.** Tasks 2–4 are presentation-only.
- **Tests stay green.** Run `npm test` (156 tests, all passing at baseline) before committing.
  No test currently asserts on these slides' HTML, so changes should not break tests; if one does,
  investigate before "fixing" the test.
- **The deck must keep rendering.** `node scripts/generate.js <analysis.json> --output-dir <dir>`
  must succeed and the slide must degrade gracefully when its data is absent/partial.

## Visual verification harness (Tasks 2–4 must use it every iteration)

A rich fixture + Playwright screenshot script already exist in `/tmp/gh-verify/`:

```
# 1. (re)build fixture + render the deck
node /tmp/gh-verify/make-fixture.js "$PWD"
node scripts/generate.js /tmp/gh-verify/fixture.json --output-dir /tmp/gh-verify
# 2. screenshot a slide by its data-title (PNG written to /tmp/gh-verify/shots/)
NODE_PATH=/Users/datagobes/.claude/skills/glasshouse/node_modules \
  node /tmp/gh-verify/shoot.js \
  /tmp/gh-verify/demo-fixture.example-privacy-audit.html \
  /tmp/gh-verify/shots "<DATA-TITLE>"
```

Then **Read the PNG**, critique it honestly against the task's "excellent" bar, and iterate
edits → re-render → re-screenshot until it genuinely looks excellent. Do not report DONE until
the screenshot shows a clean, clear, on-brand slide.

---

## Task 1: SRI becomes advisory (does not affect score)

**Files:** `references/scoring.md`, `references/criteria/security-headers.md`,
`scripts/generate.js` (`buildSecurityHeaders`, ~line 1078–1136).

**Rationale to encode:** SRI (Subresource Integrity) is an Art. 32 security best-practice but is
**not** a privacy-compliance signal a DPA enforces in an ePrivacy/GDPR audit. In a *privacy* scan
it is unfair for it to move the score. Keep advising on it; stop scoring it.

**1a. `references/scoring.md` — Security Headers section (currently lines ~89–104).**
- The base formula line stays: `Base score = (present_headers / total_checked) × 100` over the six
  headers.
- **Delete** the two SRI modifier bullets:
  - "SRI coverage 0% across 5+ SRI-eligible external scripts: −10 …"
  - "SRI coverage > 80% of eligible scripts: +5 bonus"
- **Add**, in their place, an explicit advisory note (under the "Modifiers — security baseline"
  list or just below it), e.g.:
  > **SRI is advisory and does NOT affect the score (neither penalty nor bonus).** Subresource
  > Integrity is a sound Art. 32 hardening measure, but it is not a privacy/ePrivacy signal a DPA
  > enforces in this kind of audit. Report SRI coverage and recommend it where it genuinely helps
  > (static third-party scripts; tag managers in `scriptIntegrity.cannotTakeSri[]` cannot take a
  > static hash and are excluded) — but do not add or subtract any points for it.
- Keep CORS / CSP `'unsafe-inline'` / Secure-flag modifiers untouched.

**1b. `references/criteria/security-headers.md`.**
- In "## Scoring Impact (see scoring.md)" (currently lines ~85–93): **remove** the two SRI
  modifier bullets; leave CORS, CSP unsafe-inline, and Secure-flag modifiers.
- Add a short **"SRI — advisory only (not scored)"** note in that section (or convert the SRI
  bullet under "Adjacent Checks" / "Recommending SRI" to make the not-scored status explicit),
  cross-referencing the same rationale. Keep the existing "Recommending SRI (don't be naive)"
  guidance and the `scriptIntegrity` field descriptions intact (detection + reporting stay).

**1c. `scripts/generate.js` `buildSecurityHeaders` SRI line (~1103–1108).**
- Relabel the SRI summary line so the deck makes clear it is advisory and not part of the score,
  e.g. label it **"SRI Coverage · advisory (not scored)"** and give it a subtle, clearly-secondary
  visual treatment (muted text / an "Advisory" tag) distinct from the scored "headers active" line.
  Keep showing the coverage numbers. Add any needed CSS to `templates/presentation-theme.md`
  (don't override themed colours with inline styles). Keep it tasteful and on-brand.

**1d. Verify no other reference deducts for SRI.** Grep `references/` and `scripts/` for SRI/
integrity; confirm `gdpr-articles.md`, `field-contract.md`, `criteria/index.md`,
`analysis-brief.js`, `scan.js` only *detect/report* SRI (no scoring instruction). Leave detection
intact. Note findings in the report.

**Verification:** `npm test` green. Re-render the fixture deck; the Security Headers slide shows
SRI clearly labelled advisory/not-scored. No scored modifier for SRI remains in either reference doc.

---

## Task 2: Transfer Circuit slide makeover

**Files:** `scripts/generate.js` `buildThirdPartyDomains` (~953–1016);
`templates/presentation-theme.md` transfer-circuit CSS (~2420–2530). **data-title stays
`"Cross-Border Transfers"`.**

**Bugs to fix (confirmed by baseline screenshot):**
1. **Risk colours invisible.** Destination cards carry inline
   `style="background:rgba(28,25,23,0.025);border-color:transparent;box-shadow:none;"` (line 976),
   which overrides the `.tc-dest-safe/dpf/risk { border-left-color: … }` classes — so the
   green/yellow/red risk coding the legend promises never shows. Remove these inline overrides and
   let the risk classes drive a **clearly visible** colour (strong left accent bar or coloured
   pill/chip). The schema enum for `thirdPartyDomains[].risk` is `safe | dpf | risk` (matches the
   classes); map defensively (unknown → neutral).
2. **Confusing layout.** `.transfer-circuit { display:flex }` defaults to `row`, so origin /
   down-arrow / destination-grid sit side-by-side while the arrow points down. Make the flow read
   correctly as **origin (the scanned site) → downward → destinations**.

**Make it excellent:**
- A clear, on-brand "where does the data go" visual: the origin (`meta.domain`) clearly at the
  start of the flow; destinations as colour-coded cards (flag, jurisdiction, domains, request
  count) with the **risk colour unmistakable at a glance**; consider grouping/sorting worst-risk
  first so the eye lands on the red destinations.
- Add a concise plain-language explanation of **what a cross-border transfer is and why
  jurisdiction matters** (EU/adequate = safe; DPF-certified US = conditional; unverified /
  non-adequate like RU/CN = needs SCCs or is high-risk). The existing one-line `slideDesc`
  ("Where your data travels — each destination's jurisdiction and legal safeguards") can stay; add
  the risk framing near the legend or as short helper text.
- Legend must match the colours actually rendered.
- Degrade gracefully: keep the "No third-party cross-border transfers detected" empty state; handle
  1 destination and many (current cap `MAX.DOMAIN_NODES`).

**Verification:** render fixture (6 destinations: 2 dpf-US, 2 safe-EU, 2 risk RU/CN), screenshot
`"Cross-Border Transfers"`, Read it: risk colours must be obviously visible and the flow legible.
Iterate until excellent. `npm test` green.

---

## Task 3: TCF & Consent Mode slide makeover

**Files:** `scripts/generate.js` `buildTcfConsentMode` (~2243–2311);
`templates/presentation-theme.md` tcf/gcm CSS (~4076–4129). **data-title stays
`"TCF & Consent Mode"`.**

**Problems (confirmed by baseline screenshot):** cramped one-liners; cryptic `P1 P2 … P10` chips
meaningless to non-experts; GCM signals jammed onto a single wrapping row; no explanation of what
TCF or Consent Mode are; large dead space below.

**Make it excellent — two clearly-explained, visually consistent panels:**

- **IAB TCF panel.** One-line plain-language explainer, e.g. "IAB TCF — the ad industry's standard
  *consent string*: it records which data-processing purposes you allowed across hundreds of ad
  vendors." Show CMP id and vendor count as clear stats. Replace the `P1…P10` chips with the
  **human-readable IAB TCF v2.2 purpose names**, granted/denied colour-coded (green/red), with a
  granted/denied legend. Purpose name map (id → short label) — use verbatim:
  - 1 → "Store / access info on device"
  - 2 → "Basic ads"
  - 3 → "Personalised-ads profile"
  - 4 → "Personalised ads"
  - 5 → "Personalised-content profile"
  - 6 → "Personalised content"
  - 7 → "Measure ad performance"
  - 8 → "Measure content performance"
  - 9 → "Market research"
  - 10 → "Develop & improve services"
  - Any id outside 1–10 → show `Purpose <id>` as a fallback.
- **Google Consent Mode v2 panel.** One-line explainer, e.g. "Google Consent Mode v2 — a signal
  layer telling Google's tags whether they may use cookies for ads/analytics." Tell the
  **before→after story**: show each signal's **default state** vs its **state after the consent
  update**, side by side, so a viewer instantly sees "denied by default → granted on accept".
  Signals: `analytics_storage, ad_storage, ad_user_data, ad_personalization, functionality_storage,
  personalization_storage, security_storage` (humanise the labels). Granted = green, denied = red.
  If there are no update events, show defaults only and say so.
- Consistent card styling with the rest of the deck; no ad-hoc inline styles overriding themed
  colours; fill the space sensibly (no big empty gap).
- Degrade gracefully: TCF-only, GCM-only, or both. Slide returns null only when neither detected
  (unchanged guard).

**Verification:** render fixture (TCF v2 / CMP 28 / 312 vendors / mixed purposes; GCM all-denied
defaults + an update granting ads/analytics), screenshot `"TCF & Consent Mode"`, Read it: purposes
must be human-readable, the GCM before→after must read at a glance, layout clean and on-brand.
Iterate until excellent. `npm test` green.

---

## Task 4: "Ignore vs Accept vs Reject" (Variant Comparison) makeover

**Files:** `scripts/generate.js` `buildVariantComparison` (~1721–1776);
`templates/presentation-theme.md` vc-* CSS (~3868–3948). **data-title stays
`"Variant Comparison"`.**

**Problem (confirmed by baseline screenshot):** `maxVal` is computed **per metric** (line 1737),
so each metric (Trackers / Cookies / 3rd Parties) is normalised to its own max. The three
scenarios' bars therefore look ~equal length across metrics even though absolute counts differ
wildly (e.g. Accept = 31 trackers vs 48 cookies vs 15 third-parties all render near-full). You
cannot eyeball-compare the scenarios. Also the colours are semantically inverted (accept = most =
currently green; reject = least = currently red).

**Make it excellent:**
- Put the three scenarios on a **single shared scale** so they are directly, visually comparable in
  one eyeball. Use one global max across all scenarios × metrics (or an equivalent consistent-axis
  treatment) so a longer bar always means more, everywhere on the slide.
- Lead with the takeaway: a short headline/verdict that states the relationship at a glance (e.g.
  "Accept All loads ~10× the trackers of Reject All"). The fixture provides `vc.verdict`.
- **Colour semantics by outcome, not by label:** more tracking = worse. Reject All (least) should
  read as the good/green end, Accept All (most) as the red end, Ignore as the neutral/baseline
  (yellow). Make this intuitive — do not leave accept=green.
- Keep all three metrics (Trackers, Cookies, 3rd Parties) and the three scenarios
  (No Interaction / Accept All / Reject All); a clear legend.
- Degrade gracefully when a variant is missing or all values are 0.

**Verification:** render fixture (ignore 3/6/2, accept 31/48/15, reject 4/7/2, verdict present),
screenshot `"Variant Comparison"`, Read it: the scenario comparison must be obvious at a glance on
a shared scale, colours intuitive, takeaway clear. Iterate until excellent. `npm test` green.

---

## Final

After all four tasks: full render of the fixture deck, visual re-check of all four slides, run
`npm test`, dispatch a whole-branch code review, then finish the branch.
