# Criterion: Pre-Consent Tracking

## What the Scanner Checks
Whether cookies, pixels, or tracking scripts fire **before** valid consent — the most direct ePrivacy violation.

## Legal Basis
- **ePrivacy Directive Art. 5(3)** — "Storage of information or access to information stored in the terminal equipment of a subscriber or user is only allowed on condition that the subscriber or user concerned has given his or her consent"
- **GDPR Art. 5(1)(a)** — Lawfulness, fairness, transparency
- **GDPR Art. 6** — Processing must have a valid legal basis before it occurs
- **CJEU Planet49 (C-673/17, 2019)** — Pre-ticked boxes invalid; consent must precede the storage

## The "Ignore Variant"
Scanner runs three variants per scan: ignore, accept, reject. The ignore variant is the most diagnostic — it shows what happens when the user has not yet interacted with the banner. Anything beyond strictly-necessary cookies in this state is presumptively unlawful.

Patterns:
- Cookie placed on first byte; cleared after Reject (still illegal — was set without consent)
- Pixel fires on `DOMContentLoaded` before CMP renders
- `gtag.js` initializes and ships pageview before consent is requested
- localStorage written by analytics SDK on script load
- Fingerprinting APIs called pre-consent (most severe — see fingerprinting.md)

## Three-Tier Tracker Classification (apply this in analysis)

| Tier | Field | What | GDPR Status |
|---|---|---|---|
| 3 | `trackers` | Full tracking fires — pixel events, beacons, collect endpoints with no consent restrictions | **Clear violation** without consent |
| 2 | `consentModePings` | Tags firing in Google Consent Mode "denied" state, or Microsoft UET consent-status pings. Data still transmitted (IP, URL) but restricted | **Legally debatable** — strict ePrivacy reading says violation; Google/MS argue privacy-safe |
| 1 | `sdkLoads` | Script/library loads (gtm.js, fbevents.js, bat.js). Not tracking by themselves | **Not a violation** alone |

Never lump these together in the report — it undermines credibility with technical readers.

## Pre-Consent vs Post-Reject vs Post-Accept

| Scenario | Lawful? |
|---|---|
| Strictly-necessary cookie (session, CSRF) on page load | Yes |
| Analytics cookie before any consent UI | No (Art. 5(3)) |
| Pixel fires after "Accept" clicked | Yes (consent obtained) |
| Pixel fires after "Reject" clicked | No (consent refused) |
| Cookie wall with no access alternative | No (consent not freely given) |
| GPC signal detected → tracking blocked | Yes |

## Verified Enforcement

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| Amazon Europe Core | CNIL, 2020-12-07 | €35M | Advertising cookies set on amazon.fr before any consent action (verified via cnil.fr) |
| Google LLC + Ireland (ETid-978/979) | CNIL, 2021-12-31 | €90M + €60M | google.fr placed cookies before refusal was offered |
| Facebook Ireland (ETid-980) | CNIL, 2021-12-31 | €60M | Same pattern on facebook.com |
| Microsoft Ireland | CNIL, 2022-12-19 | €60M | bing.com — cookies deposited without consent |
| Austrian DSB — NetDoktor | 2022-01-12 | No fine (landmark ruling) | Google Analytics on a health-information site = unlawful EU→US transfer + pre-consent placement |

**EDPB Guidelines 2/2023 on Art. 5(3)** confirm fingerprinting falls under Art. 5(3) and therefore requires consent.

## Scanner Output Fields (see field-contract.md)
- `summary.preConsentCookies[]` — cookies present in ignore variant
- `summary.preConsentTrackers[]` — tier-3 fires before consent
- `summary.consentModePings[]` — tier-2 (Google Consent Mode denied / MS UET)
- `summary.sdkLoads[]` — tier-1 (script loads)
- `findings.fingerprinting.preConsent` — boolean (severe modifier)
- `findings.formLeakage.leaks[]` — pre-submit form-field reading by trackers

## Scoring Impact (see scoring.md)
20% category weight. Base score by tracker count:
- 100: zero non-essential cookies/trackers pre-consent
- 75: only essential cookies (session, CSRF)
- 50: 1–2 analytics cookies pre-consent
- 25: multiple trackers
- 0: 5+ trackers / extensive ad pixels

Modifiers:
- Pre-consent fingerprinting: −20 (treat as full tracking, EDPB 2/2023)
- Pre-submit form leakage: −10
