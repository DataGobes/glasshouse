# DPA Enforcement Compendium

Verified enforcement examples organized by scanner criterion. Use these in `recommendations[].enforcementRef`.

**Verification provenance:**
- `ETid` references resolve in the public [GDPR Enforcement Tracker](https://www.enforcementtracker.com/) dataset (CC BY-NC-SA 4.0 — "enforcementtracker.com, provided by CMS Law.Tax"). The dataset is **not** bundled with this repo; maintainers re-verify periodically from that source.
- ePrivacy-only fines (cookies-without-consent under national ePrivacy implementations) are NOT in that dataset. They are cited directly from the DPA's published decision and verified at write-time (2026-04).
- Amounts and dates here have been cross-checked against the public source. Past errors corrected: previously mistakenly-cited `ETid-1374` (real value €480) and `ETid-1413` (real value €2,000) have been removed; the actual large Meta fines are listed below with correct ETids.

For full criterion context, read `criteria/<name>.md`. The cases here are quick-reference only.

---

## Consent (criteria/consent.md)

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Meta Platforms Ireland | DPC Ireland, 2023-05-12 | €1,200M | Invalid legal basis for EU→US data transfers | ETid-1844 |
| Meta Platforms Ireland | DPC Ireland, 2023-01-04 | €390M | Forced consent bundled with terms (Facebook + Instagram) | ETid-1543 |
| Meta Platforms Inc. | DPC Ireland, 2022-09-05 | €405M | Children's privacy on Instagram — invalid consent for minors | ETid-1373 |
| Google LLC | CNIL France, 2021-12-31 | €90M | No equally-simple reject button on google.fr | ETid-978 |
| Google Ireland | CNIL France, 2021-12-31 | €60M | Companion fine to Google LLC | ETid-979 |
| Facebook Ireland | CNIL France, 2021-12-31 | €60M | No equally-simple reject button on facebook.com | ETid-980 |
| Microsoft Ireland Operations | CNIL France, 2022-12-19 | €60M | bing.com — refuse cookies took 2 clicks; accept took 1 | cnil.fr (ePrivacy, not in DB) |
| Amazon Europe Core | CNIL France, 2020-12-07 | €35M | Advertising cookies set on amazon.fr without prior consent | cnil.fr (ePrivacy, not in DB) |
| WhatsApp Ireland | DPC Ireland, 2021-09-02 | €225M | Insufficient fulfilment of information obligations | ETid-820 |
| IAB Europe | Belgian APD, 2022-02-02 | €250K | TCF — invalid legal basis, no DPIA, no DPO; TC Strings = personal data | ETid-1051 (DB shows €0 — verified amount via dataprotectionauthority.be) |

## Dark Patterns (criteria/dark-patterns.md)

The same CNIL Dec 2021 / 2022 fines above all cite asymmetric reject buttons as the dark-pattern dimension. Add:

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Meta Platforms Ireland | DPC Ireland, 2023-01-04 | €390M | Forced consent bundling — coercive UI | ETid-1543 |
| EDPB Guidelines 03/2022 | EDPB | (guidance) | Formal taxonomy of dark patterns in social-media interfaces; cited in nearly all CNIL decisions since 2022 | edpb.europa.eu |

## Pre-Consent Tracking (criteria/pre-consent-tracking.md)

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Amazon Europe Core | CNIL France, 2020-12-07 | €35M | Advertising cookies set before consent action | cnil.fr |
| Google LLC + Ireland | CNIL France, 2021-12-31 | €150M (€90M + €60M) | Cookies placed before refusal offered | ETid-978 / 979 |
| Facebook Ireland | CNIL France, 2021-12-31 | €60M | Pre-consent cookies on facebook.com | ETid-980 |
| Microsoft Ireland | CNIL France, 2022-12-19 | €60M | bing.com cookies deposited without consent | cnil.fr |
| Austrian DSB — NetDoktor | 2022-01-12 | (landmark, no fine) | Google Analytics on a health-info site = unlawful EU→US transfer + pre-consent placement | dsb.gv.at |

## Legal Pages — Art. 12/13/14 (criteria/legal-pages.md)

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Meta Platforms Ireland | DPC Ireland, 2023-05-12 | €1,200M | Disclosure failures (cross-border component) | ETid-1844 |
| Criteo | CNIL France, 2023-06-15 | €40M | Inadequate transparency about processing purposes | ETid-1912 |
| Clearview AI | Garante Italy, 2022-02-10 | €20M | Privacy policy missing/incomplete for biometric processing | ETid-1098 |
| WhatsApp Ireland | DPC Ireland, 2021-09-02 | €225M | Insufficient fulfilment of Art. 12/13/14 obligations | ETid-820 |

## Security Headers / Art. 32 (criteria/security-headers.md)

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Meta Platforms Ireland | DPC Ireland, 2022-11-25 | €265M | Inadequate technical measures (data scraping breach) | ETid-1502 |
| Meta Platforms Ireland | DPC Ireland, 2024-12-17 | €251M | Insufficient technical and organisational measures | ETid-2484 |
| Meta Platforms Ireland | DPC Ireland, 2024-09-27 | €91M | Plain-text password storage | ETid-2461 |
| Enel Energia | Garante Italy, 2024-02-08 | €79.1M | Insufficient technical/organisational measures | ETid-2306 |
| ENDESA Energía | AEPD Spain, 2023-10-25 | €6.1M | Inadequate security + breach response | ETid-2220 |
| Cosmote | HDPA Greece, 2022-01-27 | €6M | Insufficient technical measures (breach exposure) | ETid-1024 |
| Hellenic Post | HDPA Greece, 2024-02-28 | €3M | Insufficient technical/organisational measures | ETid-2284 |

(Art. 32 — 375 fines in the dataset — most-cited security article.)

## Cookie Hygiene (criteria/cookie-hygiene.md)

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Free Mobile | CNIL France, 2026-01-08 | €27M | Excessive retention of telecom data beyond legal periods | ETid-2993 |
| Microsoft Ireland | CNIL France, 2022-12-19 | €60M | Reject did not stop cookie placement | cnil.fr |

(Most cookie-hygiene enforcement is the same set of CNIL ePrivacy fines under consent / pre-consent.)

## Retention (criteria/retention.md)

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Free Mobile | CNIL France, 2026-01-08 | €27M | Telecom data retained beyond legal periods | ETid-2993 |
| Criteo | CNIL France, 2023-06-15 | €40M | Art. 17 — erasure requests not propagated to sub-processors | ETid-1912 |
| Clearview AI | CNIL France, 2022-10-17 | €20M | Data not deletable from all systems | ETid-1448 |
| Verkkokauppa.com | Finnish DPO, 2024-03-06 | €856K | Indefinite retention, no auto-delete | ETid-2243 |

## DPIA (criteria/dpia.md)

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Meta Platforms Inc. | DPC Ireland, 2022-09-05 | €405M | Combined Art. 25 + 35 — children's data on Instagram without adequate DPIA | ETid-1373 |
| Cosmote | HDPA Greece, 2022-01-27 | €6M | Art. 35(7) cited alongside Art. 25, 28 | ETid-1024 |
| Foodinho | Garante Italy, 2024-11-13 | €5M | Art. 35 — algorithmic profiling of gig workers | ETid-2531 |
| Portuguese National Statistical Institute | CNPD Portugal, 2022-11-02 | €4.3M | Statistical processing without adequate DPIA | ETid-1524 |
| Clearview AI | CNIL France, 2022-10-17 | €20M | Biometric processing — Art. 35(2) DPIA mandatory | ETid-1448 |

## Fingerprinting (criteria/fingerprinting.md)

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Clearview AI | Garante Italy, 2022-02-10 | €20M | Biometric/dataset fingerprinting for identification | ETid-1098 |
| Clearview AI | HDPA Greece, 2022-07-13 | €20M | Same pattern | ETid-1268 |
| Clearview AI | CNIL France, 2022-10-17 | €20M | Same pattern | ETid-1448 |
| Clearview AI | AP Netherlands, 2024-05-16 | €30.5M | Same pattern, larger scope | ETid-2448 |
| Clearview AI | ICO UK, 2022-05-18 | €9M | Facial recognition + Art. 17 erasure failure | ETid-1190 |
| Meta Platforms Inc. | DPC Ireland, 2022-09-05 | €405M | Systemic profiling via pixel + login data | ETid-1373 |
| EDPB Guidelines 2/2023 | EDPB | (guidance) | Confirmed fingerprinting falls under ePrivacy Art. 5(3) and requires consent | edpb.europa.eu |

## Cross-Border (criteria/cross-border.md)

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Meta Platforms Ireland | DPC Ireland, 2023-05-12 | €1,200M | EU→US transfers without adequate safeguards (post-Schrems II) | ETid-1844 |
| Clearview AI | AP Netherlands, 2024-05-16 | €30.5M | Cross-border processing of biometric data for non-EU recipients | ETid-2448 |
| Austrian DSB — NetDoktor | 2022-01-12 | (landmark) | Google Analytics on a health-info site = unlawful EU→US transfer | dsb.gv.at |
| LG München I | 2022-01-20 | €100/user | Google Fonts loaded from Google US = unlawful IP transfer | LG München I, 3 O 17493/20 |

## DSAR (criteria/dsar.md) — NEW criterion

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Criteo | CNIL France, 2023-06-15 | €40M | "Insufficient fulfilment of data subjects rights" — erasure requests not propagated | ETid-1912 |
| TIM | Garante Italy, 2020-01-15 | €27.8M | Failed to handle erasure + objection requests | ETid-189 |
| Vodafone Italia | Garante Italy, 2020-11-12 | €12.3M | Failed to act on right-to-object requests | ETid-438 |
| Vodafone España | AEPD Spain, 2021-03-11 | €8.15M | Right-to-object mechanism not communicated | ETid-594 |
| Clearview AI | ICO UK, 2022-05-18 | €9M | No mechanism for EU residents to request erasure | ETid-1190 |
| Google LLC | Sweden IMY, 2020-03-11 | €5M | Insufficient fulfilment of data subject rights | ETid-232 |

## Processor Transparency (criteria/processor-transparency.md) — NEW criterion

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Enel Energia | Garante Italy, 2024-02-08 | €79.1M | Largest Art. 28-related fine — many marketing processors without proper DPAs | ETid-2306 |
| Cosmote | HDPA Greece, 2022-01-27 | €6M | Sub-processors used for billing without disclosure | ETid-1024 |
| Foodinho | Garante Italy, 2024-11-13 | €5M | Delivery-logistics processors without proper Art. 28 documentation | ETid-2531 |
| Vodafone España | AEPD Spain, 2021-03-11 | €8.15M | DPA scope incomplete | ETid-594 |
| EDPB Binding Decision 01/2020 | EDPB | (binding) | Facebook + website operators are joint controllers for Pixel data | edpb.europa.eu |

## Breach Notification (criteria/breach-notification.md) — NEW criterion

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Vodafone Italia | Garante Italy, 2020-11-12 | €12.3M | Delayed breach notification + inadequate access controls | ETid-438 |
| ENDESA Energía | AEPD Spain, 2023-10-25 | €6.1M | Inadequate documented breach-response procedures | ETid-2220 |
| Postel | Garante Italy, 2024-07-04 | €0.9M | Breach notification incomplete — missing required content | ETid-2474 |
| Air Europa | AEPD Spain, 2021-03-15 | €0.6M | Late + incomplete breach notification | ETid-609 |
| Sorgenia | Garante Italy, 2023-04-14 | €0.68M | Inadequate breach response + technical measures | ETid-1893 |

## Opt-Out / Right to Object (criteria/opt-out-mechanism.md) — NEW criterion

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| TIM | Garante Italy, 2020-01-15 | €27.8M | Systematic failure to process customer objections to telemarketing | ETid-189 |
| Vodafone Italia | Garante Italy, 2020-11-12 | €12.3M | Right-to-object requests not honored | ETid-438 |
| Eni Gas e Luce | Garante Italy, 2019-12-11 | €8.5M | Telemarketing objections logged but not enforced in CRM | ETid-186 |
| Vodafone España | AEPD Spain, 2021-03-11 | €8.15M | Art. 21(3) — right not communicated at first contact | ETid-594 |
| Clearview AI | ICO UK, 2022-05-18 | €9M | No mechanism for objection to facial-recognition processing | ETid-1190 |
| TIM | Garante Italy, 2023-04-13 | €7.6M | Repeat — telemarketing objections still mishandled | ETid-1871 |

## Special Categories — Art. 9 (criteria/special-categories.md) — NEW context-aware

| Case | DPA / Date | Fine | Issue | Cite |
|---|---|---|---|---|
| Clearview AI | Garante Italy, 2022-02-10 | €20M | Biometric facial recognition | ETid-1098 |
| Clearview AI | HDPA Greece, 2022-07-13 | €20M | Same pattern | ETid-1268 |
| Clearview AI | CNIL France, 2022-10-17 | €20M | Same pattern | ETid-1448 |
| Clearview AI | AP Netherlands, 2024-05-16 | €30.5M | Same pattern, larger scope | ETid-2448 |
| Clearview AI | ICO UK, 2022-05-18 | €9M | Biometric + erasure failure | ETid-1190 |
| Mercadona | AEPD Spain, 2021-07-26 | €2.5M | Employee health data (COVID) without valid Art. 9(2) basis | ETid-777 |
| BREBAU GmbH | DPA Bremen, 2022-03-03 | €1.9M | Mandatory fingerprint clock-in for employees | ETid-1103 |
