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

**Two distinct checks — do not conflate them:**

1. **Reject parity *at the banner* (the consent moment).** Reject must be as prominent and as shallow as accept on the *first* layer. "Accept = 1 click, Reject only reachable via Manage settings (layer 2)" is a dark pattern — this is the CNIL Bing/Google line of enforcement and is scored via `rejectAccessibility` / `multiLayer` (see dark-patterns.md). This is well-settled law.

2. **Withdrawal *after* consent (Art. 7(3)).** The standard, per EDPB Guidelines 05/2020, is that withdrawal be **"equally straightforward" in effort and accessibility, via the same interface** — **not** that it take the identical number of clicks. The Board's own example of a *violation* is consenting with one online click but having to phone or write a letter to withdraw. A footer "cookie settings" link that reopens the CMP is **compliant**, even though it is one click more than the banner's "Accept all". Do not penalize that.

Genuine Art. 7(3) violations (penalize):
- Withdrawal requires a *different channel* than granting — emailing the DPO, calling support, a postal letter, or logging into an account when consent was given anonymously on the banner
- Withdrawal buried >3 clicks deep or hidden in account settings with no on-page entry point
- Revocation gated behind confirmshaming / "are you SURE?" friction, or "wait 30 days for processing"

Not a violation (do **not** penalize):
- A clean footer / preference-center link that reopens the CMP in one click (even if a panel then loads) — this is the normal, compliant pattern and an automated raw click-count comparison is a poor proxy for the spirit of Art. 7(3).

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
- `findings.consent.consentRevocation.newRequestsAfterRevocation` — number (>0 ⇒ processing continued after revoking; this is the −10 signal)
- `findings.consent.consentRevocation.trackingCookiesDeleted` — boolean (deletion is best-practice, not the legal test)
- `findings.consent.consentRevocation.trackingCookiesRemaining[]` — cookie names still present after revocation
- `findings.consent.consentRevocation.mechanismType` — e.g. `"cmp-api"`, `"footer-link"`, `"not-found"`
- `findings.consent.revocationClicks` / `acceptanceClicks` — recorded for context; the *delta alone* is not a violation (see Art. 7(3) above)
- `findings.consent.gcmV2.signalsPresent[]` — list of consent-mode signals detected

## Scoring Impact (see scoring.md)
Base 0–100 by CMP quality. Modifiers:
- Binary on layer 1 **and** no granular controls behind a settings link (`consentGranularity.settingsLinkFound === false`): cap at 75. If granular controls exist one click deeper (`settingsLinkFound === true`), do **not** cap.
- TCF malformed string: −5
- Google ads but no TCF: −10
- No revocation mechanism: −15
- Revocation found but non-essential processing continues: −10 (see cookie-hygiene.md — the test is processing cessation, not cookie deletion)
- Withdrawal needs a *different channel* than granting (email/phone/account login): −15; on-site but buried >3 clicks / confirmshaming: −5; clean footer preference-center link: **no penalty** (Art. 7(3) is "equally straightforward", not identical click count)
- Reads GPC signal: +5
