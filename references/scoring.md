# Risk Scoring System

> **Updated 2026-06-23** — Phase E. **Dark Patterns raised from 5% → 15%.** Deceptive design is not a cosmetic sub-issue: where dark patterns steer the choice, the EDPB treats the processing as unlawful *ab origine* — invalid *regardless* of whether formal consent was recorded (EDPB Guidelines 03/2022; Opinion 08/2024 on "consent or pay"). A flawless CMP is worthless if the interface pushes users, so the weight now reflects that. The +10 was funded by an even trim across the other eight categories (most from the consent-family, since dark patterns are themselves a consent-quality judgment). Still 9 categories summing to 100%.
>
> **Prior — 2026-04-23** — Phase D rebalance: carved DSAR and Processor Transparency out of Legal Pages and Cross-Border. Old persisted scans without `dsar`/`processorTransparency` still validate (validator warns, doesn't error).

## Category Weights (Phase E)

| Category | Weight | What's Measured | Notes |
|----------|--------|----------------|-------|
| Consent Mechanism | 20% | CMP present, granular, easy reject, GCMv2 | was 22%; −2 → Dark Patterns (overlapping judgment) |
| Pre-Consent Tracking | 18% | Trackers/cookies firing before consent | was 20%; −2 |
| Dark Patterns | 15% | Asymmetric buttons, pre-checked, hidden/buried reject, confirmshaming | **was 5%; +10** — deceptive design invalidates consent (EDPB 03/2022) |
| Legal Pages | 11% | Privacy/cookie/terms + provider-identity disclosure + Art. 13/14 content | was 12%; −1 |
| Cross-Border Transfers | 10% | Third-party destinations, adequacy, DPF | was 11%; −1 |
| Security Headers | 9% | HSTS, CSP, security.txt, breach-notification commitment | was 10%; −1 |
| Cookie Management | 7% | Reasonable expiry, purpose alignment, post-reject processing cessation | was 8%; −1 |
| Processor Transparency | 6% | Named processors, DPA, sub-processors, joint controllers | was 7%; −1 |
| DSAR / Rights Mechanism | 4% | Contact, dedicated page, 30-day commitment | was 5%; −1 |

Total: **100%**.

## Scoring Per Category (0–100)

### Consent Mechanism (20%)
- 100: CMP present, granular opt-in with category toggles, easy reject, GCMv2 properly wired, GPC signal read
- 75: CMP present, some issues (no granularity OR binary-only accept/reject)
- 50: CMP present but significant issues (no reject, cookie wall)
- 25: CMP present but essentially non-functional
- 0: No consent mechanism at all

**Modifiers:**
- Binary accept/reject only (no category toggles via `consentGranularity`): cap at 75
- Granular toggles present: eligible for 100
- TCF detected but malformed consent string: −5
- Site uses Google advertising but no TCF: −10
- No consent revocation mechanism (`consentRevocation.mechanismFound` = false): −15
- Revocation found but **non-essential processing continues** after revocation — tracking scripts still fire (`consentRevocation.newRequestsAfterRevocation > 0`): −10. Note: `consentRevocation.trackingCookiesRemaining` being non-empty while `newRequestsAfterRevocation === 0` (cookies persist but nothing reads them) is **not** this penalty — the law requires stopping processing, not deleting cookies (see cookie-hygiene.md).
- **Withdrawal harder than granting (Art. 7(3))** — judge by *channel and effort*, not raw click count. EDPB Guidelines 05/2020 require withdrawal to be "equally straightforward" via the *same interface*, **not** identical to the number of clicks used to consent:
  - Withdrawal requires a *different channel* than granting — email/phone/postal, account login, or leaving the site (`consentRevocation.channel` differs from the banner): −15
  - Withdrawal is on-site but genuinely buried (>3 clicks, hidden in account settings) or gated behind confirmshaming / "are you sure?" friction: −5
  - A standard footer "cookie settings" / preference-center link that reopens the CMP (one click to surface it, even if a panel then loads): **no penalty** — this meets Art. 7(3). Do not deduct merely because revoking is one click more than the single-click "Accept all".
- Site reads GPC signal (`gpc.siteReadsSignal` = true): +5 bonus
- GCMv2 detected but missing one of `ad_user_data` / `ad_personalization`: −5 (incomplete v2)

### Pre-Consent Tracking (18%)
- 100: Zero trackers/non-essential cookies before consent
- 75: Only essential cookies (session, CSRF)
- 50: 1–2 analytics cookies pre-consent
- 25: Multiple trackers active pre-consent
- 0: 5+ trackers / extensive ad pixels pre-consent

**Modifiers:**
- Pre-consent fingerprinting (per-domain, replaces the prior binary −20):
  - For each `stackedSignals[]` entry where `preConsent: true` and `verdict: "active fingerprinting"`: −10
  - For each entry where `verdict: "probable fingerprinting"`: −5
  - Capped at −20 total (preserves the previous cap so scores stay comparable)
- Pre-submit form leakage (`formLeakage.leaks` non-empty): −10
- Tier-2 consent-mode pings present but no Tier-3 fires: −5 only (legally debatable; do not stack with pre-consent fingerprinting)

### Legal Pages (11%)
Checked documents (5 categories): Privacy Policy, Cookie Policy, Terms of Service, **Provider-identity disclosure** (e-Commerce Directive Art. 5 — DE Impressum / NL colofon-or-footer per art. 3:15d BW / FR mentions légales; see legal-pages.md), Cookie Settings. Match the local equivalent — a `.nl` site needs no page literally called "Impressum", and a Dutch *Disclaimer* is only partial evidence.

**Split scoring (presence 50% + content 50%):**
- **Presence**: 100 = all 5 present, 80 = 4/5, 60 = 3/5, etc.
- **Content** (from Art. 13/14 analysis in `privacyPolicyAnalysis`):
  - 13/13 elements present = 100
  - 10–12 = 75
  - 7–9 = 50
  - 4–6 = 25
  - 0–3 = 0
  - "vague" counts as 0.5 of a present element
- **Final** = `(presence × 0.5) + (content × 0.5)`

If `legalPageContent` is null, fall back to presence-only scoring.

DSAR mechanism is now scored separately (see DSAR / Rights Mechanism below) — do **not** double-penalise here.

### Cross-Border Transfers (10%)
- 100: All third parties in EU/EEA or adequate-country jurisdictions
- 75: Some US transfers, all to DPF-certified entities
- 50: US transfers without clear DPF certification
- 25: Multiple non-adequate-country transfers
- 0: Transfers to high-risk jurisdictions (China, Russia) without safeguards

(Processor list disclosure is now scored separately — see Processor Transparency.)

### Security Headers (9%) — expanded scope (Phase D)
Base score = `(present_headers / total_checked) × 100` covering HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.

**Modifiers — security baseline:**
- SRI coverage 0% across **5+ SRI-eligible external scripts**: −10. Score off `scriptIntegrity.eligibleCoveragePercent` / `eligibleExternal`, **not** raw `coveragePercent`. Tag managers and republishing loaders (GTM, gtag, Tealium, Adobe Launch, Segment — listed in `scriptIntegrity.cannotTakeSri`) **cannot take a static hash** and are excluded from the eligible set; do not penalize a site whose only un-hashed externals are these. (Security tools like SecurityScorecard/Bitsight exclude them too, as of 2026-03.)
- SRI coverage > 80% of eligible scripts: +5 bonus
- CORS wildcard with credentials: −10
- CSP `'unsafe-inline'` in script-src: −5
- Session cookie missing `Secure` flag: −5

**Modifiers — breach-notification governance (NEW):**
- `security.txt` present and current: +5 bonus
- `security.txt` present but expired: −5
- 72-hour DPA notification commitment in policy (`breachNotification.dpaNotificationCommitment`): +5
- Art. 34 individual notification commitment (`breachNotification.individualNotificationCommitment`): +3
- Delay-tactic language detected (`breachNotification.delayTacticLanguage`): −10

### Cookie Management (7%)
- 100: Few cookies, reasonable expiry (<13 months), clear purposes
- 75: Moderate cookies, some long-lived
- 50: Many cookies, several 2+ year expiry
- 25: Excessive cookies, very long expiry, unclear purposes
- 0: Cookie chaos — dozens of cookies, tracking-heavy

**Modifiers:**
- Cookie purpose mismatch (`cookiePurposeMatching`): −5 each, capped at −20
- Cookie expires after 13 months without functional justification: −5 each
- Pixel fires after reject (FAIL flag, separate from score): always surface in TLDR

### Processor Transparency (6%)
- 100: All scanner-detected processors named in policy + country + purpose
- 75: All named, missing some country/purpose detail
- 50: Mix of generic categories and some names
- 25: Only generic categories ("third-party providers")
- 0: No processor disclosure

**Modifiers:**
- Joint controller (Meta Pixel, Like buttons, embeds) detected without Art. 26 disclosure: −10 each
- Sub-processor disclosure mentioned (`processors.subProcessorsDisclosed`): +5
- DPA reference present (`processors.dpaReferenced`): +3

### DSAR / Rights Mechanism (4%)
- 100: Contact + dedicated rights page + 30-day commitment + proportionate ID verification
- 80: Contact + 30-day commitment, missing dedicated page
- 60: Contact only (any type)
- 40: Postal-only contact
- 20: Generic "contact us" form, no rights mention
- 0: No DSAR mechanism mentioned

**Modifiers:**
- Disproportionate-burden language detected (`dsar.disproportionateBurdenFlags` non-empty): −25
- Right to lodge complaint with DPA disclosed (`dsar.complainToDpaDisclosed`): +3
- All major rights disclosed (access + erasure + portability + object): +5

### Dark Patterns (15%)

Weight raised from 5% in Phase E. Rationale: deceptive design is not a minor deduction on an otherwise-valid banner — the EDPB position is that where the interface steers the choice, the resulting "consent" is invalid and the processing is unlawful *ab origine*, **regardless of whether a consent record was stored** (EDPB Guidelines 03/2022; Opinion 08/2024). A technically perfect CMP that nudges users toward "Accept all" fails the freely-given test. This category is the scorer's proxy for that, so it now carries weight comparable to the consent mechanism itself.

- 100: No dark patterns detected — symmetric buttons, reject as prominent and as shallow as accept, no pre-ticking, no confirmshaming
- 75: Minor asymmetry only (accept slightly larger or higher-contrast, but reject still one click on layer 1)
- 50: Clear asymmetry OR missing reject button OR reject only on layer 2 (`findings.consent.rejectAccessibility === "layer-2"`)
- 25: Multiple patterns combined (e.g. layer-2 reject *and* confirmshaming, or asymmetry *and* pre-ticked toggles)
- 0: Cookie wall + forced consent, or no reject path at all (`rejectAccessibility === "not-found"`)

When citing in the report, use the EDPB Guidelines 03/2022 taxonomy (overloading, skipping, stirring, hindering, fickle, left in the dark) — see `concepts/dark-patterns-taxonomy.md`.

**Do not invent visual asymmetry.** Only score below 100 for button styling/colour when the scanner actually measured it (`findings.consent.buttonStyling` — see criteria/dark-patterns.md). If accept and reject are styled identically, that is a *clean* signal (75–100), not a dark pattern — say so explicitly rather than describing a colour difference that isn't there.

**Multi-layer reject + consent score interaction**: when `rejectAccessibility === "layer-2"`, the consent score caps at 50 (binary accept/reject only on layer 1, with the reject path one click deeper). Score the dark-patterns slot at 50 too, not both — the impact is one pattern, not two. The complaint builder emits a `multiLayerReject` candidate citing CNIL Bing (2022, €60M).

## Commercial Fingerprinting SDK Modifier (NEW 2026-04, applies independently)

For each `findings.fingerprinting.commercialSdks[]` entry where `purposeDisclosed === false` OR `legitimateBasisClaim === null`: −15 from overall score (stacks outside the −20 pre-consent cap because commercial FP SDKs are inherently identification networks). When both fields are positive, no penalty — the SDK is surfaced as a disclosed-purpose finding rather than a violation. Per criteria/fingerprinting.md, the LLM analyst fills both fields by reading **both the privacy policy and the cookie policy** (and the CMP vendor list) — many profiling vendors are disclosed only in the cookie policy, so don't apply this −15 without checking both.

## Context-Aware Modifiers (apply only when triggered)

These do not have their own weighted slot but adjust the overall score:

- **Special Categories** (criteria/special-categories.md) — only relevant for healthcare, fintech-KYC, employment, dating, identity-verification:
  - Health input fields without explicit-consent checkbox: −20 from overall
  - Biometric SDK detected without DPIA mention: −15
  - Identity verification SDK (Jumio, Onfido, Veriff) without explicit consent: −15

- **DPIA gap** (criteria/dpia.md) — Art. 35 requires *conducting* a DPIA for high-risk processing; it does **not** require publishing or referencing one in the privacy policy. The absence of a DPIA *mention* is **not** evidence the DPIA was not done — **apply no score modifier for it.** When high-risk indicators are present (session replay, fingerprinting SDK, large-scale ad pixels, AI/ML profiling), describe them factually in the report and, where relevant, recommend confirming a DPIA exists — but do not deduct. (Reproduced bug: the 2026-06 miele.nl scan applied −10 here and dropped 6.7 vs the verified 8.0.)

## Score Calculation

1. Calculate weighted internal score: `internal = Σ(category_score × weight)` over the 9 categories (0–100)
2. Apply context-aware modifiers (special categories, DPIA gap)
3. Convert to public 1.0–10.0: `publicScore = round(internal / 100 × 9 + 1, 1)`
4. Map to band:
   - **8.5–10.0** Exemplary — minimal to no issues
   - **7.0–8.4** Good — minor issues, largely compliant
   - **5.5–6.9** Acceptable — some issues need attention
   - **4.0–5.4** Poor — significant compliance gaps
   - **2.0–3.9** Very Poor — major violations
   - **1.0–1.9** Failing — systemic non-compliance

## Backwards Compatibility

Old persisted scans (pre-rebalance) have only the original 7 categories. The validator treats `dsar` and `processorTransparency` as optional (warnings, not errors) so old analyses can be re-rendered. New scans MUST include all 9.

To compare scores across rebalances for a re-scan:
- Legacy (pre-Phase-D): consent 25, preConsent 20, legal 15, crossBorder 15, security 10, cookies 10, dark 5 = 100
- Phase D (2026-04): consent 22, preConsent 20, legal 12, crossBorder 11, security 10, cookies 8, processor 7, dsar 5, dark 5 = 100
- **Phase E (2026-06, current): consent 20, preConsent 18, dark 15, legal 11, crossBorder 10, security 9, cookies 7, processor 6, dsar 4 = 100**

A re-scan under Phase E will score **lower than Phase D for any site with dark patterns** (the 5%→15% shift triples that category's drag) and slightly higher for a site with none. This is intended: the rebalance increases the penalty for deceptive design specifically, not overall severity for clean sites.

Most sites' overall score should shift by less than 0.5 points — the rebalance redistributes weight rather than increasing total severity.
