# Criterion: Breach Notification (NEW)

## What the Scanner Checks
Whether the site has visible breach-response infrastructure: a `security.txt` file, an Art. 33 (72-hour DPA notification) commitment in the privacy policy, and an Art. 34 individual-notification commitment.

## Legal Basis
- **GDPR Art. 33** — "Without undue delay and, where feasible, not later than **72 hours** after becoming aware" of a personal data breach, the controller shall notify the supervisory authority
- **GDPR Art. 34** — When breach is "likely to result in a high risk", controller must also notify affected data subjects without undue delay
- **EDPB Guidelines 9/2022** on breach notification (replaces WP250)
- **RFC 9116** — `security.txt` format for vulnerability disclosure
- **NIS2 Directive (in force from 2024)** — Adds 24-hour early-warning notification for "essential" and "important" entities

## Key Scanner Checks

### 1. `security.txt` Present
Fetch `https://<host>/.well-known/security.txt` (canonical) or `https://<host>/security.txt` (legacy fallback).

Expected RFC 9116 fields:
- `Contact:` — email or URL for vulnerability reports
- `Expires:` — expiration date of the file (must be in the future)
- `Preferred-Languages:` — languages for reports
- `Policy:` — link to security/responsible-disclosure policy
- `Acknowledgments:` — link to vulnerability acknowledgment page
- `Encryption:` — PGP key URL

Presence of a non-expired, well-formed `security.txt` is a strong positive governance signal.

### 2. 72-Hour DPA Notification Commitment
Policy text mentions: "72 hours", "three days", or "without undue delay" in the breach context, ideally with the supervisory authority named.

### 3. Art. 34 Individual Notification Commitment
Policy mentions notifying affected users when breach is "high risk" or "likely to affect your rights".

### 4. Dedicated Security Contact
Separate from general privacy/contact form — `security@`, `incident@`, or a clearly labeled security page.

### 5. No Delay-Tactic Language
Red flags: "We will notify you when we deem it appropriate", "If we determine notification is necessary".

## Art. 33 vs. Art. 34

| | Art. 33 — DPA notification | Art. 34 — Data subject notification |
|---|---|---|
| Recipient | Supervisory authority | Affected data subjects |
| Deadline | 72 hours after awareness | Without undue delay |
| Threshold | Any personal data breach (unless unlikely to result in risk) | Likely high risk to rights and freedoms |
| Content | Nature, categories/size, DPO contact, consequences, measures | Plain language, likely consequences, mitigation |

## Verified Enforcement

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| Vodafone Italia (ETid-438) | Garante Italy, 2020-11-12 | €12.3M | Delayed breach notification + inadequate access controls |
| ENDESA Energía (ETid-2220) | AEPD Spain, 2023-10-25 | €6.1M | Inadequate documented breach-response procedures |
| Postel (ETid-2474) | Garante Italy, 2024-07-04 | €0.9M | Breach notification incomplete — missing required content |
| Air Europa (ETid-609) | AEPD Spain, 2021-03-15 | €0.6M | Late + incomplete breach notification |
| Sorgenia (ETid-1893) | Garante Italy, 2023-04-14 | €0.68M | Inadequate breach response + technical measures |

(Art. 33 — 51 fines in the enforcementtracker dataset; pattern: late notification compounds underlying security failure.)

## What the Scanner CANNOT Check
- Whether the company would actually meet 72h in practice (requires breach simulation)
- Whether a breach has actually occurred (no internal access)
- Whether notification content would meet Art. 33(3) requirements

## Scanner Output Fields (see field-contract.md)
- `findings.breachNotification.securityTxtPresent` — boolean
- `findings.breachNotification.securityTxtFields` — `{contact, expires, policy, ...}`
- `findings.breachNotification.securityTxtExpired` — boolean
- `findings.breachNotification.dpaNotificationCommitment` — boolean
- `findings.breachNotification.individualNotificationCommitment` — boolean
- `findings.breachNotification.dedicatedSecurityContact` — boolean
- `findings.breachNotification.delayTacticLanguage[]` — flagged phrases

## Scoring Impact
**New category.** Recommended weight: folded into security-headers (raise security weight to 12%) rather than a standalone bucket — these are governance signals around the same Art. 32/33/34 cluster.

Modifiers on the security score:
- `security.txt` present + valid: +5
- `security.txt` expired: −5
- 72-hour DPA commitment: +5
- Art. 34 commitment: +3
- Delay-tactic language: −10
