# SRI Advisory + Slide Makeovers — Design

**Date:** 2026-06-23
**Branch:** `claude/flamboyant-colden-b4f1e2` (worktree on `main` @ `161d676`, PR #13 merged)
**Scope:** Two independent goals in the `glasshouse` privacy-scan skill.

---

## Goal 1 — SRI becomes an advisory, not a scored signal

### Problem
Subresource Integrity (SRI) coverage currently moves the score: the Security Headers
category (9% weight) applies **−10** for 0% eligible coverage across 5+ eligible external
scripts, and **+5** for >80% coverage (`references/scoring.md` §Security Headers lines 93–94;
`references/criteria/security-headers.md` lines 88–93).

SRI is a genuine Art. 32 security best-practice, but it is **not** a privacy-compliance
signal a Data Protection Authority enforces in an ePrivacy/GDPR audit. Letting it drag the
score is unfair in a *privacy* scan. We should still **advise** on it (it's useful), but it
must **not affect the score in either direction**.

### Decision
- **Remove both SRI score modifiers** (−10 and +5) from the scoring rules.
- **Keep SRI as advisory guidance** — still detected, still reported, still recommended where
  useful (scoped to static third-party scripts, tag managers carved out), but explicitly
  labelled "advisory — not scored".
- The eligibility nuance (tag managers in `cannotTakeSri[]` can't take a static hash) stays,
  reframed as advisory context rather than a scoring guard.

### Changes
1. `references/scoring.md` — Security Headers §: delete the two SRI modifier bullets; add an
   explicit "SRI is advisory and does not affect the score" note with the rationale (security
   best-practice, not a DPA-enforced privacy signal).
2. `references/criteria/security-headers.md` — move SRI out of "Scoring Impact / Modifiers"
   into an **"Advisory (not scored)"** subsection; keep the "Recommending SRI (don't be naive)"
   guidance intact.
3. `scripts/generate.js` `buildSecurityHeaders` (lines 1103–1108) — relabel the SRI line as
   advisory (e.g. "SRI Coverage · advisory, not scored") with a subtle, clearly-non-scored
   visual treatment. Keep showing coverage.
4. Verify no other reference (`gdpr-articles.md`, `field-contract.md`, `criteria/index.md`,
   `analysis-brief.js`, `scan.js`) instructs the analyst to deduct for SRI. Those are
   detection/contract docs (no scoring) — confirm and leave detection intact.

### Non-goals
- Do **not** remove SRI *detection* in the scanner. Detection + reporting stay.
- Do **not** touch the other Security Headers modifiers (CORS, CSP unsafe-inline, Secure flag).

---

## Goal 2 — Make over three poor-quality slides

All three slides are built in `scripts/generate.js`; their CSS lives in
`templates/presentation-theme.md`. The deck's design language is the warm **"Ember"** palette
(default `:root`): `--bg-primary #f0ebe0`, `--bg-card #fff`, `--accent #c75c2c`,
`--accent-green #059669`, `--accent-yellow #d97706`, `--accent-red #dc2626`,
`--accent-blue #2563eb`; mono font `JetBrains Mono`. Each slide is a full-viewport
`section.slide`; `.reveal` children animate in when `.slide.visible`. **All makeovers must
match this design language** (use the CSS variables, no hard-coded hex, no random inline styles).

### 2a — Transfer Circuit (`buildThirdPartyDomains`, generate.js:953–1016; CSS theme:2420–2530)
**Problems**
- **Colours don't render.** Each destination card carries inline
  `style="background:rgba(28,25,23,0.025);border-color:transparent;box-shadow:none;"`
  (line 976). Inline `border-color:transparent` overrides the risk-colour classes
  `.tc-dest-safe/dpf/risk { border-left-color: ... }`, so the green/yellow/red coding the
  legend promises is invisible. The flat near-transparent bg + removed shadow also wash the
  cards out.
- **Confusing layout.** `.transfer-circuit { display:flex }` has the default `row` direction,
  so origin / down-arrow / destination-grid sit side-by-side while the arrow points *down* —
  the "circuit"/flow metaphor reads as noise.
- **Unclear meaning.** No framing of *what a cross-border transfer is* or *why jurisdiction
  matters* (adequacy / DPF / SCCs).

**Redesign**
- A clear top-to-bottom data-flow: **origin (the scanned site) → downward flow → destinations**,
  destinations colour-coded by transfer risk with the colour **actually visible** (strong
  left-border or pill), flag, jurisdiction, domains, request count. Sort/group worst-risk first.
- Remove the inline overrides; let the `.tc-dest-{safe,dpf,risk}` classes drive colour
  (schema enum is `safe|dpf|risk`, which already matches the classes).
- Add a one-line plain-language explanation (what a transfer is, why non-adequate destinations
  need safeguards). Legend must match the colours actually shown.
- Keep it on-brand and visually rich.

### 2b — TCF & Consent Mode (`buildTcfConsentMode`, generate.js:2243–2311; CSS theme:4076–4129)
**Problems**
- Messy: two plain inline-styled cards; cryptic `P1 P2 …` chips meaningless to non-experts;
  GCM signals a flat grid. No explanation of what TCF or Consent Mode *are*.

**Redesign — two clearly-explained panels**
- **IAB TCF panel:** one-line plain explanation ("the ad industry's standard consent string —
  records which data-processing purposes you allowed across hundreds of ad vendors"). Show CMP
  id, vendor count, and purpose consents with **human-readable IAB TCF v2.2 purpose labels**
  (P1 "Store/access info on device", P2 "Basic ads", P3 "Personalised-ads profile",
  P4 "Personalised ads", P5 "Personalised-content profile", P6 "Personalised content",
  P7 "Measure ad performance", P8 "Measure content performance", P9 "Market research",
  P10 "Develop & improve services"), granted/denied colour-coded, with a legend.
- **Google Consent Mode v2 panel:** one-line explanation ("Google's signal layer — tells
  Google tags whether they may use cookies for ads/analytics"). Show the signal **default
  state vs after-consent-update** side by side — the before→after is the story (denied by
  default, granted on accept). Clear granted/denied visual.
- Consistent card styling, on-brand, no ad-hoc inline styles.

### 2c — Ignore vs Accept vs Reject (`buildVariantComparison`, generate.js:1721–1776; CSS theme:3868–3948)
**Problem**
- `maxVal` is computed **per metric** (line 1737), so each metric card has its own scale and
  the three scenarios aren't comparable across metrics at a glance; grouping by metric buries
  the scenario story. User: "doesn't use the same scale for each scenario, so it's not clear
  relative in one eyeball."

**Redesign**
- Put the three scenarios on a **single shared scale** so they're directly, visually
  comparable at a glance (one global max across all scenarios × metrics, or an equivalent
  consistent-axis treatment). Lead with the takeaway (e.g. "Accept All loads N× the trackers
  of Reject All"). Keep colour semantics: ignore = baseline (yellow), accept = most (red),
  reject = least (green). The hard requirement: **shared scale + instant scenario comparison.**

---

## Verification harness (shared tooling)
A rich synthetic fixture exercises all four slides (the shipped datagobes.dev example is a
clean site with no TCF/GCM/SRI and a non-nested `variantComparison`, so it can't validate
these slides). Harness lives in a scratch dir (not committed):
- `fixture.json` — analysis with: `tcf` (v2.2, cmp, vendorCount, mixed P1–P10 purposeConsents);
  `googleConsentMode` (all-denied defaults, update events granting on accept); `thirdPartyDomains`
  (multiple, risk `safe`/`dpf`/`risk` across EU/US-DPF/unverified); `variantComparison`
  (nested ignore/accept/reject with trackerCount/cookieCount/thirdPartyDomainCount + verdict);
  `scriptIntegrity` (low eligible coverage, to show the advisory).
- `shoot.js` — Playwright (Chromium, already a dep): render via `generate.js`, open the HTML,
  force every `.slide.visible` + disable animations, screenshot each target `section[data-title]`
  to PNG for visual self-validation.

## Execution model
Sub-agent driven development, **sequential** for anything editing `generate.js` /
`presentation-theme.md` (they share those two files → parallel edits would collide):
1. Build harness + capture baseline screenshots of the 4 affected slides.
2. SRI advisory (docs + security-slide label).
3. Transfer Circuit makeover → render → screenshot → iterate to excellent.
4. TCF & Consent Mode makeover → render → screenshot → iterate.
5. Ignore/Accept/Reject makeover → render → screenshot → iterate.
6. Final: full render, visual review of all four, run `npm test`, code review.

Each makeover sub-agent must self-validate visually (screenshot + read it) and iterate before
reporting done; the main agent re-verifies each screenshot before moving on.
