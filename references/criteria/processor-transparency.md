# Criterion: Processor Transparency (NEW)

## What the Scanner Checks
Whether the site transparently discloses the third-party processors that handle user data on the controller's behalf, and whether Data Processing Agreements (DPAs) are referenced.

## Legal Basis
- **GDPR Art. 13(1)(e)** — At collection, controller must disclose **recipients or categories of recipients**. EDPB guidance: prefer named recipients over generic categories
- **GDPR Art. 24** — Controller accountability — must use processors providing "sufficient guarantees"
- **GDPR Art. 26** — Joint controllers must make their arrangement available to data subjects
- **GDPR Art. 28** — Processors must be governed by a written contract (DPA) covering Art. 28(3) subjects
- **EDPB Guidelines 07/2020** on controllers and processors
- **EDPB Binding Decision 01/2020** — Facebook/Instagram Like-button & Pixel = joint controllership

## Key Scanner Checks

### 1. Named Processor List
Policy must list **actual named processors**, not generic categories.
- Acceptable: "We use Google Analytics (Google LLC, USA), Meta Pixel (Meta Platforms Ireland), AWS (Amazon Web Services Inc., USA)"
- Unacceptable: "We use third-party service providers"

### 2. Per-Processor Purpose
For each processor, the policy should state what data is shared and why:
- "Google Analytics: page-visit metrics for traffic analytics, retained 14 months"
- Vague "to improve our service" is insufficient

### 3. Per-Processor Country
- EU/EEA → adequacy area
- US → DPF certification or SCCs + supplementary measures
- "International" alone is insufficient — must specify country

### 4. DPA Mention
Positive signal: "We have Data Processing Agreements with all our processors." Not strictly required in the public policy but indicates Art. 28 awareness.

### 5. Sub-Processor Disclosure
- Art. 28(2) requires controller authorization for sub-processors
- Positive: "Our sub-processors are listed at [URL]"
- Acceptable: process for adding sub-processors disclosed

### 6. Joint Controller Identification (Art. 26)
- Meta Pixel + Facebook = joint controllers (EDPB BD 01/2020)
- Sites embedding Like buttons or Meta Pixel are joint controllers — must disclose this and make the joint-controller arrangement available
- Same applies to YouTube embeds with cookies, some HubSpot/Salesforce integrations

## Common Processor Categories on EU Sites

| Category | Examples | Risk |
|---|---|---|
| Analytics | Google Analytics, Adobe Analytics, Hotjar | Medium |
| Adtech | Google Ads, Meta Ads, TikTok Pixel, Criteo | High |
| CDP / Marketing automation | Salesforce, HubSpot, Mailchimp | Medium |
| Cloud infrastructure | AWS, Google Cloud, Azure | Medium |
| Payment | Stripe, Adyen, PayPal | Medium |
| Social widgets | Facebook Like, Twitter, LinkedIn | Medium |
| Customer support | Intercom, Zendesk, Freshdesk | Low–Medium |
| Fingerprinting SDKs | Fingerprint Pro, SEON, Sift | High |

## Verified Enforcement

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| Enel Energia (ETid-2306) | Garante Italy, 2024-02-08 | €79.1M | Largest Art. 28-related fine — used dozens of marketing processors without proper DPAs |
| Cosmote (ETid-1024) | HDPA Greece, 2022-01-27 | €6M | Sub-processors used for billing without disclosure |
| Foodinho (ETid-2531) | Garante Italy, 2024-11-13 | €5M | Delivery-logistics processors without proper Art. 28 documentation |
| Vodafone España (ETid-594) | AEPD Spain, 2021-03-11 | €8.15M | DPA scope incomplete — certain processing outside the agreement |
| EDPB Binding Decision 01/2020 | EDPB, 2020-09 | (binding decision, not a fine) | Facebook + website operators are joint controllers for Pixel data |

(Art. 24 — 64 fines, Art. 28 — 75 fines in the enforcementtracker dataset.)

## Scanner Detection of Processors
The scanner already identifies processors by network signature (see trackers.md). Combine with policy parsing:
1. Tokenize processor names from **both the privacy policy and the cookie policy** (and the CMP vendor table if present) — many named processors appear only in the cookie policy, so parsing the privacy policy alone over-reports "undisclosed"
2. Cross-reference scanner-detected third-party domains, matching **brand aliases** (e.g. Exponea ↔ Bloomreach, Optimizely ↔ Episerver, Clarity ↔ Microsoft)
3. Flag undisclosed processors **only when named in neither policy**; when disclosed, record `disclosureSource` (privacyPolicy / cookiePolicy / cmpVendorList) so the call is auditable
4. Flag joint-controller scenarios (Meta Pixel, Like button) without Art. 26 disclosure

## Scanner Output Fields (see field-contract.md)
- `findings.processors.namedInPolicy[]` — `{name, country, purpose}`
- `findings.processors.detectedOnSite[]` — from network analysis
- `findings.processors.undisclosed[]` — detected but not named
- `findings.processors.dpaReferenced` — boolean
- `findings.processors.subProcessorsDisclosed` — boolean
- `findings.processors.jointControllerScenarios[]` — `{processor, type, disclosed}`

## Scoring Impact
**New category.** Recommended weight: **5%** (carved from cross-border + legal-pages, since this is upstream of both).
- 100: all detected processors named + country + purpose; sub-processors disclosed
- 75: all named, missing country/purpose detail
- 50: generic categories with some names
- 25: only generic categories
- 0: no processor disclosure at all
- −10 per joint-controller scenario without Art. 26 disclosure
