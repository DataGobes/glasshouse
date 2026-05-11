# Risk Scoring System

> **Updated 2026-04-23** — Phase D scoring rebalance. Now 9 weighted categories summing to 100%. Two new categories (DSAR, Processor Transparency) were carved out of Legal Pages and Cross-Border respectively, since enforcement data shows these are independently penalised. Old persisted scans without `dsar` and `processorTransparency` still validate; the validator emits warnings rather than errors so existing scans can be re-rendered.

## Category Weights (rebalanced)

| Category | Weight | What's Measured | Notes |
|----------|--------|----------------|-------|
| Consent Mechanism | 22% | CMP present, granular, easy reject, GCMv2 | was 25%; −3 to make room |
| Pre-Consent Tracking | 20% | Trackers/cookies firing before consent | unchanged |
| Legal Pages | 12% | Privacy/cookie/terms/impressum + Art. 13/14 content | was 15%; −3 carved into DSAR |
| Cross-Border Transfers | 11% | Third-party destinations, adequacy, DPF | was 15%; −4 carved into Processor Transparency |
| Security Headers | 10% | HSTS, CSP, security.txt, breach-notification commitment | unchanged weight, expanded scope |
| Cookie Management | 8% | Reasonable expiry, purpose alignment, post-reject deletion | was 10%; −2 to fund new categories |
| Processor Transparency | 7% | **NEW** — named processors, DPA, sub-processors, joint controllers | from cross-border + legal-pages |
| DSAR / Rights Mechanism | 5% | **NEW** — contact, dedicated page, 30-day commitment | from legal-pages |
| Dark Patterns | 5% | Asymmetric buttons, pre-checked, no reject | unchanged |

Total: **100%**.

## Scoring Per Category (0–100)

### Consent Mechanism (22%)
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
- Revocation found but cookies persist after revocation: −10
- More clicks to revoke than accept (`revocationClicks > acceptanceClicks`): −5 (Art. 7(3))
- Site reads GPC signal (`gpc.siteReadsSignal` = true): +5 bonus
- GCMv2 detected but missing one of `ad_user_data` / `ad_personalization`: −5 (incomplete v2)

### Pre-Consent Tracking (20%)
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

### Legal Pages (12%)
Checked documents (5 categories): Privacy Policy, Cookie Policy, Terms of Service, Impressum/Legal Notice (controller identity), Cookie Settings.

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

### Cross-Border Transfers (11%)
- 100: All third parties in EU/EEA or adequate-country jurisdictions
- 75: Some US transfers, all to DPF-certified entities
- 50: US transfers without clear DPF certification
- 25: Multiple non-adequate-country transfers
- 0: Transfers to high-risk jurisdictions (China, Russia) without safeguards

(Processor list disclosure is now scored separately — see Processor Transparency.)

### Security Headers (10%) — expanded scope (Phase D)
Base score = `(present_headers / total_checked) × 100` covering HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.

**Modifiers — security baseline:**
- SRI coverage 0% with 5+ external scripts: −10
- SRI coverage > 80%: +5 bonus
- CORS wildcard with credentials: −10
- CSP `'unsafe-inline'` in script-src: −5
- Session cookie missing `Secure` flag: −5

**Modifiers — breach-notification governance (NEW):**
- `security.txt` present and current: +5 bonus
- `security.txt` present but expired: −5
- 72-hour DPA notification commitment in policy (`breachNotification.dpaNotificationCommitment`): +5
- Art. 34 individual notification commitment (`breachNotification.individualNotificationCommitment`): +3
- Delay-tactic language detected (`breachNotification.delayTacticLanguage`): −10

### Cookie Management (8%)
- 100: Few cookies, reasonable expiry (<13 months), clear purposes
- 75: Moderate cookies, some long-lived
- 50: Many cookies, several 2+ year expiry
- 25: Excessive cookies, very long expiry, unclear purposes
- 0: Cookie chaos — dozens of cookies, tracking-heavy

**Modifiers:**
- Cookie purpose mismatch (`cookiePurposeMatching`): −5 each, capped at −20
- Cookie expires after 13 months without functional justification: −5 each
- Pixel fires after reject (FAIL flag, separate from score): always surface in TLDR

### Processor Transparency (7%) — NEW
- 100: All scanner-detected processors named in policy + country + purpose
- 75: All named, missing some country/purpose detail
- 50: Mix of generic categories and some names
- 25: Only generic categories ("third-party providers")
- 0: No processor disclosure

**Modifiers:**
- Joint controller (Meta Pixel, Like buttons, embeds) detected without Art. 26 disclosure: −10 each
- Sub-processor disclosure mentioned (`processors.subProcessorsDisclosed`): +5
- DPA reference present (`processors.dpaReferenced`): +3

### DSAR / Rights Mechanism (5%) — NEW
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

### Dark Patterns (5%)
- 100: No dark patterns detected
- 75: Minor asymmetry (accept slightly larger)
- 50: Clear asymmetry OR missing reject button
- 25: Multiple patterns combined
- 0: Cookie wall + forced consent

When citing in the report, use the EDPB Guidelines 03/2022 taxonomy (overloading, skipping, stirring, hindering, fickle, left in the dark) — see `concepts/dark-patterns-taxonomy.md`.

## Commercial Fingerprinting SDK Modifier (NEW 2026-04, applies independently)

For each `findings.fingerprinting.commercialSdks[]` entry where `purposeDisclosed === false` OR `legitimateBasisClaim === null`: −15 from overall score (stacks outside the −20 pre-consent cap because commercial FP SDKs are inherently identification networks). When both fields are positive, no penalty — the SDK is surfaced as a disclosed-purpose finding rather than a violation. Per criteria/fingerprinting.md, the LLM analyst fills both fields by reading the privacy policy.

## Context-Aware Modifiers (apply only when triggered)

These do not have their own weighted slot but adjust the overall score:

- **Special Categories** (criteria/special-categories.md) — only relevant for healthcare, fintech-KYC, employment, dating, identity-verification:
  - Health input fields without explicit-consent checkbox: −20 from overall
  - Biometric SDK detected without DPIA mention: −15
  - Identity verification SDK (Jumio, Onfido, Veriff) without explicit consent: −15

- **DPIA gap** (criteria/dpia.md) — when high-risk indicators detected (session replay, fingerprinting SDK, large-scale ad pixels, AI/ML profiling):
  - DPIA not mentioned in policy: −10 from overall

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

Old persisted scans (pre-rebalance) have only the original 7 categories. The validator now treats `dsar` and `processorTransparency` as optional (warnings, not errors) so old analyses can be re-rendered. New scans MUST include all 9.

To compare old-score vs new-score for a re-scan:
- Old weights: consent 25, preConsent 20, legal 15, crossBorder 15, security 10, cookies 10, dark 5 = 100
- New weights: consent 22, preConsent 20, legal 12, crossBorder 11, security 10, cookies 8, processor 7, dsar 5, dark 5 = 100

Most sites' overall score should shift by less than 0.5 points — the rebalance redistributes weight rather than increasing total severity.
