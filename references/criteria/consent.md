# Criterion: Consent

## What the Scanner Checks
Whether the site obtains valid GDPR Art. 7 consent before placing non-essential cookies or processing data for advertising/personalization.

## Legal Basis
- **GDPR Art. 4(11)** — Consent: freely given, specific, informed, unambiguous indication
- **GDPR Art. 7** — Conditions for consent (must be demonstrable; withdrawal as easy as giving it)
- **ePrivacy Directive Art. 5(3)** — Prior consent required for cookie/storage access
- **EDPB Guidelines 05/2020** on consent
- **CJEU Planet49 (C-673/17, 2019)** — Pre-ticked boxes invalid; consent must be active

## Valid Consent Requirements
1. **Freely given** — no detriment for refusing, no bundling with T&Cs
2. **Specific** — separate consent per purpose (analytics ≠ advertising)
3. **Informed** — who, what, why, duration, third-party recipients disclosed before consent
4. **Unambiguous** — active opt-in (no pre-ticking, no silence/inactivity, no scrolling)

## Art. 7(3) — Withdrawal Must Be as Easy as Giving
Verify the policy and CMP both expose a one-equivalent-click withdrawal path. Examples of violations:
- Accept = 1 click; Reject buried behind preferences pane = 2+ clicks
- Consent given via checkbox; withdrawal requires emailing the DPO
- Settings change accepted instantly; revocation requires "wait 30 days for processing"

## Invalid Consent Patterns
- Pre-ticked checkboxes
- "Accept all" pre-selected by default
- Bundled consent with terms acceptance
- Cookie walls with no functional alternative
- Implied consent from continued use ("by browsing this site you agree...")

## CMP Quality Signals
A compliant CMP must:
- Show granular purpose-level controls (not just binary accept/reject)
- Allow rejection at the same UI layer as acceptance
- Store consent records with timestamp + proof
- Support withdrawal as easily as giving consent
- Implement TCF integration if part of IAB advertising chain

## Google Consent Mode v2
When detected, verify all four signals are present and gate appropriately:
- `analytics_storage` — granted/denied
- `ad_storage` — granted/denied
- `ad_user_data` — granted/denied
- `ad_personalization` — granted/denied

A site loading `gtag.js` without GCMv2 signals while collecting consent is non-conformant with Google's own 2024+ policy and likely transmits data despite a "Reject" click.

## GPC Signal (Global Privacy Control)
A scanner-detected GPC signal can constitute valid objection. Sites should read it via `navigator.globalPrivacyControl` and treat it as withdrawal of consent for ad/analytics purposes.

## Verified Enforcement (sources: enforcementtracker.com, CNIL, EDPB)

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| Meta Platforms Ireland (ETid-1844) | DPC Ireland, 2023-05-12 | €1,200M | Invalid legal basis for EU→US transfers |
| Meta Platforms Ireland (ETid-1543) | DPC Ireland, 2023-01-04 | €390M | Forced consent bundled with terms (Facebook + Instagram) |
| Meta Platforms Inc. (ETid-1373) | DPC Ireland, 2022-09-05 | €405M | Children's privacy on Instagram — invalid consent for minors |
| Google LLC (ETid-978) | CNIL, 2021-12-31 | €90M | No equally simple reject button |
| Google Ireland (ETid-979) | CNIL, 2021-12-31 | €60M | Same — companion fine to Google LLC |
| Facebook Ireland (ETid-980) | CNIL, 2021-12-31 | €60M | No equally simple reject button on facebook.com |
| Microsoft Ireland Operations | CNIL, 2022-12-19 | €60M | bing.com — refuse cookies took 2 clicks; accept took 1 (verified via cnil.fr) |
| Amazon Europe Core | CNIL, 2020-12-07 | €35M | Advertising cookies set on amazon.fr without prior consent (verified via cnil.fr) |
| IAB Europe (ETid-1051) | Belgian APD, 2022-02-02 | €250K (DB shows €0; verified via dataprotectionauthority.be) | TCF — invalid legal basis, no DPIA, no DPO, TC Strings = personal data |

## Scanner Output Fields (see field-contract.md)
- `findings.consent.cmpDetected` — CMP platform name or null
- `findings.consent.consentGranularity` — `"binary"` | `"granular"` | `"none"`
- `findings.consent.gpc.siteReadsSignal` — boolean
- `findings.consent.consentRevocation.mechanismFound` — boolean
- `findings.consent.consentRevocation.cookiesDeletedAfterRevocation` — boolean
- `findings.consent.revocationClicks` / `acceptanceClicks` — comparison of effort
- `findings.consent.gcmV2.signalsPresent[]` — list of consent-mode signals detected

## Scoring Impact (see scoring.md)
Base 0–100 by CMP quality. Modifiers:
- Binary-only (no granularity): cap at 75
- TCF malformed string: −5
- Google ads but no TCF: −10
- No revocation mechanism: −15
- Revocation found but cookies persist: −10
- Revoke clicks > accept clicks: −5
- Reads GPC signal: +5
