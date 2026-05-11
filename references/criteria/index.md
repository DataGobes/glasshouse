# Criteria Index

Each scanner criterion has a single page covering: what the scanner checks, the legal basis, scanner-observable detection, verified enforcement examples, the field-contract fields the scanner emits, and the scoring impact.

## The 15 Criteria

### Consent & User Choice
- [consent.md](consent.md) — CMP, TCF, GCMv2, GPC, Art. 7(3) withdrawal
- [dark-patterns.md](dark-patterns.md) — Pre-ticking, asymmetry, cookie walls
- [pre-consent-tracking.md](pre-consent-tracking.md) — ePrivacy Art. 5(3), three-tier classification
- [opt-out-mechanism.md](opt-out-mechanism.md) — Art. 21 right to object, marketing opt-out (NEW)

### Data Subject Rights
- [legal-pages.md](legal-pages.md) — Art. 12/13/14 disclosure completeness + Art. 12 readability
- [dsar.md](dsar.md) — Rights mechanism, 30-day commitment (NEW)
- [special-categories.md](special-categories.md) — Art. 9 health/biometric, context-aware (NEW)
- [dpia.md](dpia.md) — Art. 35 high-risk processing inference

### Security & Breach
- [security-headers.md](security-headers.md) — HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy
- [breach-notification.md](breach-notification.md) — security.txt, 72h Art. 33, Art. 34 (NEW)
- [retention.md](retention.md) — Art. 5(1)(e) storage limitation, 13-month consent refresh

### Cross-Border Transfers
- [cross-border.md](cross-border.md) — Schrems II, SCCs, EU-US DPF, adequacy

### Processor Transparency
- [processor-transparency.md](processor-transparency.md) — Named processors, DPA, sub-processors, joint controllers (NEW)

### Technical Identification
- [fingerprinting.md](fingerprinting.md) — Canvas/WebGL/AudioContext/WebGPU, commercial SDKs
- [cookie-hygiene.md](cookie-hygiene.md) — Post-reject deletion, expiration, GCMv2 hygiene

## Enforcement Coverage Map (Articles → Criteria)

| GDPR Article | Fines in DB | Primary Criterion |
|---|---|---|
| Art. 6 (lawfulness) | 520 | consent + legitimate-interest checks |
| Art. 13 (info at collection) | 471 | legal-pages, processor-transparency |
| Art. 32 (security) | 375 | security-headers, breach-notification |
| Art. 5(1)(f) (integrity) | 296 | security-headers, fingerprinting |
| Art. 5 (principles) | 288 | retention, consent |
| Art. 5(1)(c) (minimisation) | 286 | cookie-hygiene, retention |
| Art. 15 (access rights) | 173 | dsar |
| Art. 12 (transparent comms) | 153 | legal-pages, dsar |
| Art. 9 (special categories) | 151 | special-categories |
| Art. 14 (info not from subject) | 104 | legal-pages |
| Art. 17 (erasure) | 96 | retention, dsar |
| Art. 25 (privacy by design) | 91 | dpia |
| Art. 28 (processors) | 75 | processor-transparency |
| Art. 21 (right to object) | 71 | opt-out-mechanism |
| Art. 33 (breach notification) | 51 | breach-notification |
| Art. 7 (consent conditions) | 67 | consent + dark-patterns |

(Counts derived from the 3,082-fine enforcementtracker dataset as of 2026-04.)

## Verification Provenance

All `ETid` references map to records in the public [GDPR Enforcement
Tracker](https://www.enforcementtracker.com/) dataset. The skill itself does
**not** bundle the dataset; it bundles statically-verified citations. If you
maintain a local SQLite snapshot for verification, point the queries below at
your local path.

ePrivacy/cookie-only fines (CNIL Amazon Europe Core 2020, CNIL Microsoft Ireland 2022, Belgian APD IAB Europe 2022) are **not** in the GDPR enforcementtracker dataset. They are cited directly from the relevant DPA's published decision and verified at write time.

When updating enforcement examples in the future, query `fines.db` for current data:
```bash
sqlite3 privacy-wiki/fines.db "SELECT etid, controller, country, date_iso, fine_amount_eur, violation_type FROM fines WHERE controller LIKE '%X%';"
```
