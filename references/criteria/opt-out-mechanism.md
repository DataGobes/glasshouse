# Criterion: Opt-Out / Right to Object (NEW)

## What the Scanner Checks
Whether the site provides functional opt-out mechanisms for direct marketing and processing based on legitimate interests, and whether withdrawal of consent is as easy as giving it (Art. 7(3)).

## Legal Basis
- **GDPR Art. 7(3)** — "It shall be as easy to withdraw as to give consent"
- **GDPR Art. 21(1)** — Right to object to processing based on legitimate interests; controller must cease unless overriding grounds
- **GDPR Art. 21(2)** — Right to object to direct marketing = **absolute**; processing must cease immediately
- **GDPR Art. 21(3)** — Data subject must be informed of this right at the time of first communication
- **ePrivacy Directive Art. 13** — Unsolicited email marketing requires prior opt-in; SMS/spam requires functional opt-out

## Two Different Objection Rights

| | Art. 21(2) — direct marketing | Art. 21(1) — legitimate interests |
|---|---|---|
| Trigger | Any direct marketing communication | Processing under Art. 6(1)(e) or (f) |
| Standard | Absolute right | Must demonstrate compelling legitimate grounds |
| Controller action | Cease immediately | Cease unless overriding grounds |
| Timeframe | Immediate | Within 30 days |
| Enforcement | Most-enforced Art. 21 provision | Less commonly enforced standalone |

## Key Scanner Checks

### 1. Marketing Opt-Out Reference
Privacy policy should mention unsubscribe / opt-out for email marketing. Verify pattern: "all marketing emails contain a one-click unsubscribe link". (Scanner cannot read inbox content — verifies disclosure only.)

### 2. Withdrawal As Easy As Consent (Art. 7(3))
Judge withdrawal by **channel and effort**, not raw click count. EDPB Guidelines 05/2020 require withdrawal to be "equally straightforward" via the **same interface** — the Board's example of a violation is consenting with one click online but having to phone or write to withdraw. It does **not** require the identical number of clicks. A footer "cookie settings" link that reopens the CMP is compliant even though it is one click more than the banner's "Accept all".

`acceptanceClicks` and `revocationClicks` are recorded for context, but the *delta alone is not a violation*. Score on substance:
- Withdrawal needs a **different channel** than granting (account login, email/DPO, phone, postal, leaving the site): −15
- Withdrawal on-site but genuinely buried (>3 clicks / hidden in account settings) or behind confirmshaming: −5
- Clean footer / preference-center link that reopens the CMP in one click: **no penalty**
- Revocation impossible from the CMP at all (`consentRevocation.mechanismFound = false`): −15

This is a behavioral check the scanner performs in the **reject variant**. See consent.md "Art. 7(3)" for the banner-reject-parity check, which is separate and *is* a hard line (CNIL Bing/Google).

### 3. Right to Object Disclosed
Policy must specifically mention Art. 21 right to object — not just a vague "you can opt out". Should distinguish:
- Right to object to direct marketing (absolute)
- Right to object to legitimate-interests processing (with compelling grounds test)

### 4. Legitimate-Interests Objection Mechanism
If the site relies on Art. 6(1)(f), a contact mechanism for objection must be provided. "Contact privacy@company.com to object" is acceptable.

### 5. Preference Center
Site / account settings allow toggling marketing preferences ON/OFF per channel (email, SMS, push). Cross-channel consistency is required: opting out of email must not leave SMS marketing active without separate consent.

### 6. No Pre-Ticked Marketing Boxes (Art. 7(1))
- Pre-ticked boxes invalid per CJEU Planet49
- Scanner detects `<input type="checkbox" checked>` in consent / signup contexts
- Also covered in dark-patterns.md

## Verified Enforcement

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| TIM (ETid-189) | Garante Italy, 2020-01-15 | €27.8M | Systematic failure to process customer objections to telemarketing |
| Vodafone Italia (ETid-438) | Garante Italy, 2020-11-12 | €12.3M | Right-to-object requests not honored; marketing continued |
| Eni Gas e Luce (ETid-186) | Garante Italy, 2019-12-11 | €8.5M | Telemarketing objections logged but not enforced in CRM |
| Vodafone España (ETid-594) | AEPD Spain, 2021-03-11 | €8.15M | Art. 21(3) — right to object not communicated at first marketing contact |
| Clearview AI (ETid-1190) | ICO UK, 2022-05-18 | €9M | No mechanism whatsoever for objection to facial-recognition processing |
| TIM (ETid-1871) | Garante Italy, 2023-04-13 | €7.6M | Repeat — telemarketing objections still mishandled |

(Art. 21 — 71 fines in the enforcementtracker dataset; concentrated in telecom + utilities.)

## What the Scanner CANNOT Check
- Whether marketing emails actually contain a working unsubscribe link (no inbox access)
- Whether the company actually ceases processing after objection (requires monitoring)
- Whether compelling-legitimate-grounds assessment is genuinely performed

## Scanner Output Fields (see field-contract.md)
- `findings.optOut.unsubscribeMentioned` — boolean
- `findings.optOut.art21Disclosed` — boolean
- `findings.optOut.art21AbsoluteForMarketingDisclosed` — boolean
- `findings.optOut.legitimateInterestsObjectionContact` — boolean + contact
- `findings.optOut.preferenceCenterPresent` — boolean + URL
- `findings.optOut.preTickedMarketingBoxes[]` — detected pre-ticked checkboxes in signup
- `findings.consent.revocationClicks` / `acceptanceClicks` — comparative effort

## Scoring Impact
Most of this folds into existing categories:
- Art. 7(3) withdrawal-ease → consent.md modifiers (already exist)
- Pre-ticked boxes → dark-patterns.md (already exist)
- Art. 21 disclosure → legal-pages.md content score

A standalone "opt-out" weight is not necessary; the explicit checks here strengthen the existing buckets.
