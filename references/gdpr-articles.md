# GDPR & ePrivacy Reference

Quick reference for mapping privacy scan findings to specific legal violations.

## Core GDPR Articles

### Art. 5 — Principles of Processing
- **5(1)(a) Lawfulness, fairness, transparency** — Must have legal basis; must inform users
- **5(1)(b) Purpose limitation** — Collect only for specified, explicit purposes
- **5(1)(c) Data minimisation** — Adequate, relevant, limited to what's necessary
- **5(1)(f) Integrity and confidentiality** — Appropriate security measures
- **5(2) Accountability** — Must demonstrate compliance

**Scan relevance**: Pre-consent tracking violates 5(1)(a). Excessive cookie collection violates 5(1)(c).

### Art. 6 — Lawful Basis for Processing
- **(1)(a) Consent** — Freely given, specific, informed, unambiguous (see Art. 7)
- **(1)(f) Legitimate interest** — Balancing test required; cannot use for marketing tracking

**Scan relevance**: Analytics/ad tracking requires consent under 6(1)(a). No legitimate interest shortcut for tracking cookies.

### Art. 7 — Conditions for Consent
- **(1)** Controller must demonstrate consent was given
- **(2)** Consent request must be clearly distinguishable, intelligible, plain language
- **(3)** Right to withdraw consent at any time, must be as easy as giving consent
- **(4)** Consent not freely given if bundled or conditional

**Scan relevance**: Dark patterns (asymmetric buttons, no reject option) violate 7(2)(3)(4). Pre-checked boxes are NOT valid consent (Planet49 ruling).

### Art. 12–14 — Transparency & Information
- **Art. 12** — Information in concise, transparent, intelligible form
- **Art. 13** — Information to provide when collecting from data subject:
  - Identity of controller
  - Purposes and legal basis
  - Recipients/categories of recipients
  - Third country transfers + safeguards
  - Retention periods
  - Data subject rights
  - Right to lodge complaint with supervisory authority
- **Art. 14** — Information when data not obtained from subject

**Scan relevance**: Missing privacy policy = Art. 13 violation. Incomplete privacy policy = Art. 13 violation.

### Art. 25 — Data Protection by Design and Default
- **(1)** Implement appropriate technical measures (pseudonymization, minimization)
- **(2)** By default, only process data necessary for each specific purpose

**Scan relevance**: Loading trackers before consent = failure of privacy by design/default.

### Art. 32 — Security of Processing
- Encryption, pseudonymization
- Confidentiality, integrity, availability
- Regular testing and evaluation

**Scan relevance**: Missing security headers (HSTS, CSP) indicate weak security posture.

### Art. 44–49 — International Transfers
- **Art. 44** — General principle: transfers only with adequate safeguards
- **Art. 45** — Adequacy decision by Commission
- **Art. 46** — Standard contractual clauses (SCCs)
- **Art. 47** — Binding corporate rules
- **Art. 49** — Derogations (explicit consent, contract necessity)

**Scan relevance**: Requests to US servers without adequacy/SCCs = transfer violation.

## ePrivacy Directive (2002/58/EC, amended by 2009/136/EC)

### Art. 5(3) — Cookie Consent (the "Cookie Law")
> Storing or accessing information on a user's terminal equipment is only allowed if:
> 1. The user has given **prior consent** based on clear information, OR
> 2. The storage is **strictly necessary** for the service explicitly requested

**Strictly necessary exemptions** (no consent needed):
- Session cookies for shopping cart / login state
- Load balancer cookies
- User preference cookies (language, accessibility)
- Security cookies (CSRF tokens)

**NOT strictly necessary** (consent required):
- Analytics cookies (including Google Analytics)
- Advertising cookies
- Social media tracking pixels
- A/B testing cookies
- Session replay tools

**Scan relevance**: ANY non-essential cookie/localStorage set before consent = ePrivacy Art. 5(3) violation.

## Key Court Decisions

### Planet49 (CJEU, C-673/17, Oct 2019)
- **Ruling**: Pre-checked consent boxes are NOT valid consent
- **Impact**: Consent must be active opt-in, not opt-out
- **Scan relevance**: Pre-checked toggles in consent banner

### Schrems II (CJEU, C-311/18, Jul 2020)
- **Ruling**: EU-US Privacy Shield invalidated
- **Impact**: US transfers need SCCs + supplementary measures; surveillance risk assessment required
- **Scan relevance**: Any data flow to US services (Google, Meta, etc.)

### Google Fonts (LG München I, 3 O 17493/20, Jan 2022)
- **Ruling**: Embedding Google Fonts from Google CDN = GDPR violation
- **Impact**: Dynamic IP address transmitted to Google = personal data transfer to US
- **Damages**: €100 per visitor
- **Scan relevance**: Requests to `fonts.googleapis.com` or `fonts.gstatic.com`

### CNIL v. Google Analytics (CNIL, Feb 2022)
- **Ruling**: Use of Google Analytics violates GDPR (transfers to US without adequate safeguards)
- **Impact**: French DPA ruled GA illegal; Austrian, Italian DPAs followed
- **Scan relevance**: Google Analytics presence = high risk in EU context

### IAB Europe TCF (Belgian APD, Feb 2022)
- **Ruling**: IAB's Transparency & Consent Framework itself violated GDPR
- **Impact**: TCF string = personal data; IAB = joint controller
- **Scan relevance**: TCF-based consent mechanisms have systemic issues

### Meta Pixel (Austrian DPA, various 2022-2023)
- **Ruling**: Meta Pixel transfers data to US in violation of GDPR
- **Impact**: Cannot use Meta Pixel without explicit consent + SCCs
- **Scan relevance**: Any facebook.com/tr requests

### TikTok (Various DPAs, 2023-2024)
- **Ruling**: Multiple DPAs fined/warned TikTok for data transfers to China
- **Impact**: TikTok data processing under extra scrutiny
- **Scan relevance**: TikTok pixel/SDK presence

## Security Header Requirements

While not strictly GDPR, security headers demonstrate Art. 32 compliance:

| Header | Expected | Relevance |
|--------|----------|-----------|
| `strict-transport-security` | `max-age=31536000; includeSubDomains` | Prevents downgrade attacks |
| `content-security-policy` | Restrictive policy | Prevents XSS, data injection |
| `x-content-type-options` | `nosniff` | Prevents MIME sniffing |
| `x-frame-options` | `DENY` or `SAMEORIGIN` | Prevents clickjacking |
| `referrer-policy` | `strict-origin-when-cross-origin` or stricter | Prevents URL leakage |
| `permissions-policy` | Restrictive | Controls browser features |
| `x-xss-protection` | `0` (modern) or `1; mode=block` (legacy) | Legacy XSS filter |

## Consent Mechanism Requirements (EDPB Guidelines 05/2020)

Valid consent must be:
1. **Freely given** — No "cookie walls" (access denied without consent)
2. **Specific** — Separate consent per purpose (analytics vs marketing vs social)
3. **Informed** — Clear description of what data, who processes, for what purpose
4. **Unambiguous** — Clear affirmative action (click, toggle ON)
5. **Withdrawable** — Easy to withdraw, link always visible
6. **Granular** — Per-category control, not just "accept all"

Invalid consent patterns:
- Pre-checked boxes (Planet49)
- "By continuing to browse" = NOT consent
- No reject option
- Accept button 3x larger than reject (dark pattern)
- Cookie wall (no access without consent)
- Bundled consent (one checkbox for everything)
