# Criterion: Cross-Border Transfers

## What the Scanner Checks
Whether the site lawfully transfers EU user data to third countries — primarily the US, but also UK (post-Brexit), India, and other non-adequate jurisdictions.

## Legal Framework
- **GDPR Art. 44–49** — General principles + derogations
- **GDPR Art. 45** — Adequacy decisions (Commission designates a country as providing essentially-equivalent protection)
- **GDPR Art. 46(2)(c)** — Standard Contractual Clauses (SCCs)
- **GDPR Art. 47** — Binding Corporate Rules (BCRs)
- **CJEU Schrems II (C-311/18, 2020)** — Invalidated Privacy Shield; SCCs require case-by-case Transfer Impact Assessment (TIA)
- **EU-US Data Privacy Framework (2023)** — Successor adequacy decision; under active legal challenge (NOYB)
- **EDPB Recommendations 01/2020** on supplementary measures

## Adequacy Decisions (Art. 45) — current as of 2026
Andorra, Argentina, Canada (commercial only), Faroe Islands, Guernsey, Israel, Isle of Man, Japan, Jersey, New Zealand, Republic of Korea, Switzerland, United Kingdom, Uruguay.

**United States** — adequate **only** for organisations DPF-certified at `dataprivacyframework.gov`. Non-DPF-certified US entities require SCCs + supplementary measures. NOYB challenge pending; treat DPF as conditional adequacy.

## Standard Contractual Clauses (2021 SCCs — Decision 2021/914)
- Module 1: Controller → Controller
- Module 2: Controller → Processor
- Module 3: Processor → Processor (sub-processor)
- Module 4: Processor → Controller

SCCs alone are insufficient when destination-country surveillance laws (US FISA 702, EO 12333) undermine essential equivalence — supplementary technical measures (encryption with EU-held keys, pseudonymisation) are required.

## US Transfer Risk
US intelligence laws (FISA 702, EO 12333) compel US providers (Google, Meta, Microsoft, Amazon, Cloudflare, etc.) to produce EU personal data on request. This is the unresolved core issue behind Schrems II → DPF challenge.

The "spy cloud" problem: hosting EU user data on US-based AWS / Google Cloud / Azure is itself a cross-border transfer requiring Art. 46 safeguard. DPF-certification of the cloud provider is the most common compliance path.

## Detection
1. Third-party requests to US-routed domains (`google.com`, `facebook.com`, `amazonaws.com`, `cloudflare.com`, `tiktok.com`, `microsoft.com`)
2. CDN providers with US-headquartered legal entities
3. Analytics/pixel endpoints calling US infrastructure
4. Embedded content from US companies (YouTube, Twitter/X, Google Maps, Vimeo)
5. IP geolocation of resolved domains via WHOIS

## Verified Enforcement

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| Meta Platforms Ireland (ETid-1844) | DPC Ireland, 2023-05-12 | €1,200M | EU→US transfers without adequate safeguards (post-Schrems II) — largest GDPR fine to date |
| Clearview AI (ETid-2448) | AP Netherlands, 2024-05-16 | €30.5M | Cross-border processing of biometric data for non-EU recipients |
| Austrian DSB — NetDoktor | 2022-01-12 | No fine (landmark) | Google Analytics on a health-info site = unlawful EU→US transfer |
| LG München I | 2022-01-20 | €100/user | Google Fonts loaded from Google US = unlawful IP transfer |
| CNIL — Multiple Google Analytics decisions | 2022 | Formal notices | Using GA without SCCs + supplementary measures = unlawful transfer |

## Scanner Output Fields (see field-contract.md)
- `summary.thirdPartyDomains[]` — `{domain, country, dpfStatus, transferMechanism}`
- `summary.usTransfers` — count of distinct US-bound requests
- `findings.crossBorder.adequateDestinations[]`
- `findings.crossBorder.requiringSafeguards[]`
- `findings.crossBorder.dpfCertifiedProcessors[]`
- `findings.crossBorder.unsafeguardedTransfers[]`

## Scoring Impact (see scoring.md)
10% weight (Phase E).
- 100: All third parties in EU/EEA or adequate countries
- 75: Some US transfers, all to DPF-certified entities
- 50: US transfers without clear DPF certification
- 25: Multiple non-adequate-country transfers
- 0: Transfers to high-risk jurisdictions (China, Russia) without safeguards
