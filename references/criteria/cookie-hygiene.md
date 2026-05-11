# Criterion: Cookie Hygiene

## What the Scanner Checks
Whether the site properly manages the cookie lifecycle — post-rejection blocking, post-rejection deletion, and cookie expiration alignment with EDPB / CNIL guidance.

## Legal Basis
- **ePrivacy Directive Art. 5(3)** — Consent required before storing or accessing cookies
- **GDPR Art. 5(1)(c)** — Data minimisation
- **GDPR Art. 5(1)(e)** — Storage limitation
- **GDPR Art. 7(3)** — Withdrawal as easy as giving consent
- **GDPR Art. 17** — Right to erasure (applies to cookie-stored personal data)
- **EDPB Guidelines 05/2020** — Cookie expiration, post-rejection requirements
- **CNIL Recommendation 2020-091** — 13-month maximum for consent-based cookies

## Key Behavioral Checks

### 1. Post-Rejection Blocking (Critical)
After clicking "Reject" in the CMP:
- No new cookies set by advertising / analytics / tracking domains
- No pixel / beacon requests to third-party adtech
- No localStorage / sessionStorage entries written by tracking scripts

### 2. Post-Rejection Deletion
After clicking "Reject":
- Pre-existing non-essential cookies from the session deleted
- Tracking pixels (Facebook, TikTok, Google Ads) do not fire
- Google Analytics ships no `collect` requests

### 3. Cookie Expiration
- **Session cookies** — for functional needs; should expire on browser close
- **Persistent consent-based cookies** — max 13 months (CNIL hard rule, EDPB-aligned)
- **Functional persistent cookies** (login, language) — may exceed 13 months but must be disclosed
- A "session" cookie that persists across browser restarts is a violation (mislabeled lifecycle)

### 4. Third-Party Cookie Blocking Pre-Consent
For users who haven't consented:
- Google Analytics optional cookies blocked
- Facebook / TikTok / Criteo pixels blocked
- YouTube / Twitter embed cookies blocked (or use `youtube-nocookie.com` style alternates)

### 5. Google Consent Mode v2 Hygiene
- `ad_storage: denied` → no Google ad cookies
- `analytics_storage: denied` → no GA4 / Floodlight cookies
- Tags firing despite `denied` = GCMv2 not properly wired

## Common Violations (in observed scan order)
1. **"Reject" still fires advertising pixel** — most common, easiest to detect
2. **Post-reject localStorage persists** — tracking IDs not cleared
3. **Pre-consent cookie persists into post-consent state** — never cleared on transition
4. **Embedded content tracking** — YouTube/Twitter/FB widgets set cookies regardless of consent
5. **DoubleClick cookie not cleared** — Google ad cookie persists across sessions despite reject

## Verified Enforcement

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| Meta Platforms Ireland (ETid-1844) | DPC Ireland, 2023-05-12 | €1,200M | Cross-cutting — includes inadequate consent + tracking lifecycle |
| Microsoft Ireland | CNIL, 2022-12-19 | €60M | bing.com — cookies set without consent + no parity reject |
| Amazon Europe Core | CNIL, 2020-12-07 | €35M | Advertising cookies on amazon.fr without prior consent |
| Google LLC + Ireland (ETid-978/979) | CNIL, 2021-12-31 | €90M + €60M | Reject did not stop tracking cookies |
| Free Mobile (ETid-2993) | CNIL, 2026-01-08 | €27M | Excessive retention of telecom data beyond legal periods |

## Scanner Output Fields (see field-contract.md)
- `findings.beforeAfter.preCookieCount` / `postCookieCount`
- `findings.beforeAfter.newCookiesDelta`
- `findings.beforeAfter.preCategoryBreakdown[]` / `postCategoryBreakdown[]`
- `findings.beforeAfter.preStorageMechanisms[]` / `postStorageMechanisms[]`
- `findings.cookies[]` — `{name, domain, expirationDays, purpose, postRejectPersists}`
- `findings.cookies[].purpose` — must be one of `essential|functional|analytics|tracking|marketing|unknown`

## Scoring Impact (see scoring.md)
10% weight. Score by lifecycle behaviour:
- 100: few cookies, ≤13mo expiry, post-reject deletion working
- 75: moderate count, some long-lived disclosed cookies
- 50: many cookies, several 2yr+ expiry
- 25: excessive count + long expiry + unclear purposes
- 0: cookie chaos, pixels fire after reject

Modifiers:
- Cookie purpose mismatch (from cookiePurposeMatching): −5 each, capped at −20
- Pixel fires after reject: FAIL flag (not just modifier)
