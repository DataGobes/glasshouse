# Criterion: DPIA — Data Protection Impact Assessment

## What the Scanner Checks
The scanner cannot read internal DPIA documents. It infers DPIA necessity from observable processing characteristics and flags when high-risk processing is present without DPIA disclosure in the privacy policy.

## Legal Basis
- **GDPR Art. 35(1)** — DPIA required when processing is "likely to result in a high risk"
- **GDPR Art. 35(3)** — Mandatory triggers: systematic and extensive automated profiling; large-scale special category data; systematic monitoring of public areas
- **GDPR Art. 35(7)** — Minimum DPIA content: description of processing, necessity assessment, risk assessment, safeguards
- **GDPR Art. 25** — Data protection by design and default (Art. 25 implements what the DPIA recommends)
- **EDPB Guidelines 4/2017** on DPIA + national DPA "DPIA black lists" (CNIL, ICO, Garante, etc. publish required-DPIA lists)

## When a DPIA Is Required
Mandatory when ≥ 2 of these criteria apply (EDPB scoring):

| Criterion | Example |
|---|---|
| Systematic monitoring | Session recording, behaviour analytics, eye tracking |
| Large-scale processing | Millions of users, broad data collection |
| Special category data | Health, biometric, genetic, sex life |
| Systematic profiling | Behavioural advertising, credit scoring, fraud scoring |
| Vulnerable data subjects | Children, employees, asylum seekers |
| Innovative technology | AI/ML, IoT, facial recognition, fingerprinting |
| Cross-border transfers | EU → US (post-Schrems II), or other non-adequate countries |

## Scanner-Observable Indicators

### Strong DPIA Triggers
- **Session replay** — Hotjar, FullStory, Mouseflow, Microsoft Clarity (captures input fields, keystrokes, mouse trails)
- **Commercial fingerprinting SDKs** — Fingerprint Pro, SEON, Sift, Arkose, Accertify
- **Biometric capture** — facial recognition, voice authentication via `getUserMedia()`
- **AI/ML profiling** — dynamic pricing, personalized recommendations from behavioural data
- **Large-scale ad pixels** — Meta Pixel, TikTok Pixel, Criteo (behavioural profiling at scale)
- **Cross-border US transfers** — Google Analytics, Meta Pixel, AWS infrastructure

### Disclosure Indicators (what the scanner reads in policy text)
- Policy mentions "DPIA" or "data protection impact assessment"
- Policy references Art. 35
- High-risk processing acknowledged with safeguards listed

## Common Failure Patterns

| Finding | Legal basis | Risk |
|---|---|---|
| High-risk processing detected, no DPIA mention | Art. 35(1) + 35(7) | Processing may be unlawful regardless of legal basis |
| DPIA not updated after processing change | Art. 35(11) | DPIA stale |
| DPIA outcome not implemented | Art. 25 | Design flaw persists |
| No DPIA for third-party processors | Art. 28 | Processor risk unassessed |

## Verified Enforcement

| Case | DPA / Date | Fine | DPIA issue |
|---|---|---|---|
| Meta Platforms Inc. (ETid-1373) | DPC Ireland, 2022-09-05 | €405M | Combined Art. 25 + 35 — children's data processing on Instagram without adequate DPIA |
| Cosmote (ETid-1024) | HDPA Greece, 2022-01-27 | €6M | Art. 35(7) cited alongside Art. 25, 28 — systemic processor management failure |
| Foodinho (ETid-2531) | Garante Italy, 2024-11-13 | €5M | Art. 35 — algorithmic profiling of gig workers |
| Portuguese National Statistical Institute (ETid-1524) | CNPD Portugal, 2022-11-02 | €4.3M | Statistical processing without adequate DPIA |
| Clearview AI (ETid-1448) | CNIL, 2022-10-17 | €20M | Biometric processing for unique identification — Art. 35(2) DPIA mandatory |

## DPIA vs. Privacy by Design (Art. 25)
- **Art. 35** = the *assessment* obligation (identify and evaluate risks before processing)
- **Art. 25** = the *implementation* obligation (build safeguards into the design)

A DPIA without Art. 25 implementation is a paper exercise. The scanner flags both: DPIA absence in disclosures, AND observable absence of safeguards for detected high-risk processing.

## Scanner Output Fields (see field-contract.md)
- `findings.dpia.indicatorsFound[]` — list of high-risk processing indicators detected
- `findings.dpia.dpiaMentioned` — boolean
- `findings.dpia.recommendedAction` — `"required" | "recommended" | "not_indicated"`
- `findings.dpia.triggeredCriteria[]` — which Art. 35 criteria are met by observable processing

## Scoring Impact
DPIA is a context-aware modifier rather than a top-line category. When indicators detected without disclosure: −10 from overall, surface as escalation flag in the dark-patterns / fingerprinting / cross-border slides as appropriate.
