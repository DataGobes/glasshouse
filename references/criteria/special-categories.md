# Criterion: Special Categories (Art. 9) (NEW — context-aware)

## What the Scanner Checks
Whether the site collects special-category data (health, biometric, racial/ethnic origin, political opinions, religious beliefs, trade-union membership, sex life, sexual orientation) without appropriate Art. 9 lawful basis (typically explicit consent).

This is **context-aware** — primarily relevant for healthcare, fintech with KYC, employment platforms, dating apps, identity verification, and biometric authentication.

## Legal Basis
- **GDPR Art. 9(1)** — Processing of special-category data is **prohibited** by default
- **GDPR Art. 9(2)(a)** — Exception: **explicit consent** of the data subject
- **GDPR Art. 9(2)(b)** — Employment, social security, social protection law
- **GDPR Art. 9(2)(c)** — Vital interests
- **GDPR Art. 9(2)(g)** — Substantial public interest
- **GDPR Art. 9(2)(i)** — Public health
- **GDPR Art. 9(2)(j)** — Research / statistical purposes
- **GDPR Art. 9(4)** — National law may impose additional conditions for genetic, biometric, health
- **GDPR Art. 35(3)(b)** — DPIA mandatory for large-scale Art. 9 processing
- **EDPB Guidelines 03/2020** on the processing of health data for scientific research

## Key Scanner Checks

### 1. Health-Related Form Fields
Scan form input names for: `health`, `medical`, `condition`, `diagnosis`, `medication`, `treatment`, `symptom`, `blood-pressure`, `heart-rate`, `disability`, `pregnancy`, `mental-health`. Free-text fields explicitly asking for health info also count.

### 2. Biometric Capture APIs
- WebAuthn / FIDO2 (`navigator.credentials`) — usually authentication, not Art. 9 biometric processing UNLESS used for unique identification
- `MediaDevices.getUserMedia()` for face/voice capture
- Camera access combined with `<video>` + canvas snapshot
- Third-party identity-verification SDKs: Jumio, Onfido, Veriff, Persona

### 3. Explicit Consent for Special Categories
Regular marketing consent is **not sufficient** for Art. 9. Verify a separate, unchecked checkbox specifically for the special-category processing.

### 4. Sensitive-Domain SDK Detection
- Healthcare: Epic MyChart, Cerner, Doctolib widget
- Identity verification: Jumio, Onfido, Veriff, Persona
- Background checks: HireRight, Checkr
- Fitness/health APIs: Apple Health, Google Fit integration

### 5. Privacy-Policy Disclosure
Policy must:
- Identify which special categories are processed
- State the specific Art. 9(2) lawful basis for each
- Disclose retention periods (often shorter for health/biometric)

### 6. DPIA Reference for Biometric Systems
Art. 35(3)(b) makes DPIA mandatory for large-scale Art. 9 processing. If biometric SDK detected and policy doesn't mention DPIA → flag for escalation.

## What "Explicit Consent" Means

Regular consent (Art. 4(11)): freely given, specific, informed, unambiguous indication.

**Explicit consent (Art. 9(2)(a)):** an explicit statement, written or oral, that is unmistakably deliberate.

For form-based explicit consent: a separate, **unchecked** checkbox stating: "I explicitly consent to the processing of my [health/biometric] data for [specific purpose]". Bundling with general T&Cs is invalid.

## Verified Enforcement

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| Clearview AI (ETid-1098) | Garante Italy, 2022-02-10 | €20M | Biometric facial recognition — Art. 9 + Art. 5(1)(a) |
| Clearview AI (ETid-1268) | HDPA Greece, 2022-07-13 | €20M | Same pattern |
| Clearview AI (ETid-1448) | CNIL France, 2022-10-17 | €20M | Same pattern |
| Clearview AI (ETid-2448) | AP Netherlands, 2024-05-16 | €30.5M | Same pattern, larger scope |
| Clearview AI (ETid-1190) | ICO UK, 2022-05-18 | €9M | Biometric + erasure failure |
| Mercadona (ETid-777) | AEPD Spain, 2021-07-26 | €2.5M | Employee health data (COVID) without valid Art. 9(2) basis |
| BREBAU GmbH (ETid-1103) | DPA Bremen, 2022-03-03 | €1.9M | Mandatory fingerprint clock-in for employees — no freely-given consent |

(Art. 9 — 151 fines in enforcementtracker; healthcare and employment dominate.)

## What the Scanner CANNOT Check
- Whether internal back-end processing uses special categories
- Whether explicit consent is granular enough per purpose
- Whether the Art. 9(2)(b) employment exception genuinely applies
- Whether DPIA was actually conducted

## Scanner Output Fields (see field-contract.md)
- `findings.specialCategories.healthFieldsDetected[]`
- `findings.specialCategories.biometricApisDetected[]`
- `findings.specialCategories.sensitiveSdksDetected[]`
- `findings.specialCategories.explicitConsentMechanism` — boolean
- `findings.specialCategories.policyDisclosure` — `"present" | "vague" | "absent"`
- `findings.specialCategories.dpiaForBiometricMentioned` — boolean

## Scoring Impact
**Context-aware modifier** rather than standard category. Apply only when special-category indicators detected:
- Health input fields without explicit-consent checkbox: −20 from overall
- Biometric SDK without DPIA mention: −15
- Identity-verification SDK detected (Jumio etc.) without explicit consent: −15
- Properly disclosed + explicit consent: no change (baseline)
