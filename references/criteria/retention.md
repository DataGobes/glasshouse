# Criterion: Data Retention

## What the Scanner Checks
Whether the site discloses lawful retention periods and enforces them at the cookie/storage layer that the scanner can observe.

## Legal Basis
- **GDPR Art. 5(1)(c)** — Data minimisation
- **GDPR Art. 5(1)(e)** — Storage limitation: kept "no longer than necessary"
- **GDPR Art. 13(2)(a)** — Privacy notice must disclose retention periods (or criteria)
- **GDPR Art. 17** — Right to erasure
- **ePrivacy Art. 5(3)** — Non-essential cookies must stop on consent withdrawal
- **CNIL Recommendation 2020-091** — Consent re-collected after 13 months

## Thresholds

| Cookie / data type | Maximum |
|---|---|
| Session functional | Browser session only |
| Consent-based analytics | 13 months (CNIL; EDPB-aligned) |
| Consent-based advertising | 13 months |
| Functional persistent (login, language) | Disclose duration; no hard cap |
| Legitimate interest (Art. 6(1)(f)) | Annual review + delete when basis expires |

**Consent refresh rule:** After 13 months, fresh consent is required. Policies stating "consent valid until withdrawal" without a refresh mechanism are non-compliant under CNIL guidance.

## Scanner Detection
- Cookies with expiration > 13 months
- Cookies declared "session" but persisting across browser restarts
- localStorage / IndexedDB persistence of non-essential identifiers
- Privacy policy statements about retention periods (compare against observed cookie ages)
- Right-to-erasure mechanism mentioned in policy (also feeds dsar.md)

## Verified Enforcement

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| Free Mobile (ETid-2993) | CNIL, 2026-01-08 | €27M | Telecom data retained beyond legal periods |
| Criteo (ETid-1912) | CNIL, 2023-06-15 | €40M | Art. 17 — erasure requests not propagated to sub-processors |
| Clearview AI (ETid-1448) | CNIL, 2022-10-17 | €20M | Data not deletable from all systems |
| Verkkokauppa.com (ETid-2243) | Finnish DPO, 2024-03-06 | €856K | Indefinite retention, no auto-delete |

## Scanner Output Fields (see field-contract.md)
- `findings.cookies[].expirationDays`
- `findings.cookies[].declared` — declared in cookie policy: yes/no
- `findings.retention.policyMentionsErasure` — boolean
- `findings.retention.policyMentionsRefresh` — boolean
- `findings.retention.violations[]` — `{cookie, declared, observed, exceedsCap}`

## Scoring Impact
Folded into legal-pages.md (content score) and cookie-hygiene.md (long-expiry penalty). Distinct retention findings surface as supporting evidence rather than a separate weighted bucket.
