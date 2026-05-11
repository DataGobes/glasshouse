# Criterion: DSAR / Data Subject Rights Mechanism (NEW)

## What the Scanner Checks
Whether the site provides a discoverable, proportionate mechanism for data subjects to exercise their GDPR rights (access, rectification, erasure, portability, objection) and whether the privacy policy commits to the statutory 30-day response window.

## Legal Basis
- **GDPR Art. 12(3)** — Controller "shall provide information on action taken... without undue delay and in any event within **one month** of receipt of the request"
- **GDPR Art. 12(5)** — Refusal only permitted when manifestly unfounded or excessive (and the controller bears the burden of proving this)
- **GDPR Art. 15** — Right of access
- **GDPR Art. 16** — Rectification
- **GDPR Art. 17** — Erasure ("right to be forgotten")
- **GDPR Art. 20** — Data portability (machine-readable format)
- **GDPR Art. 21** — Right to object (see opt-out-mechanism.md)
- **EDPB Guidelines 01/2022** on the right of access

## Key Scanner Checks

### 1. DSAR Contact Mechanism Present
The privacy policy or a dedicated rights page must expose a contact for rights requests:
- Dedicated email (`privacy@`, `dsar@`, `datarequests@`)
- Web form / portal for submitting requests
- Postal address as a fallback (cannot be the only option)

**Fails:** Only a generic contact form with no mention of data rights.

### 2. Dedicated Rights Page
Common slugs to detect: `/privacy-rights`, `/your-data`, `/data-request`, `/gdpr-rights`, `/your-privacy`, `/privacy-center`. A clearly labeled in-policy section is also acceptable.

### 3. 30-Day Response Commitment
The policy should reference the statutory deadline: "within one month", "within 30 days", "30 days of receipt". Presence of this language is a positive signal that the company knows the obligation.

### 4. Identity Verification — Proportionate
- Acceptable: "We may ask for two pieces of identification to verify your identity"
- Red flag: "You must provide a notarized government ID" / "Requests must be submitted in person at our HQ" / "All requests must be sent by certified mail"

EDPB: verification measures must be proportionate to the risk of fraudulent requests, not used as a barrier.

### 5. Acknowledgment Mechanism
EDPB recommends automated acknowledgment within 72 hours. Policy mention is a positive signal.

### 6. Per-Right Mechanism Mapping
For each right, identify whether an accessible mechanism exists. Output as `findings.dataSubjectRights[]`:

```json
{
  "right": "Art. 15 access",
  "accessible": true,
  "clickDepth": 2,
  "url": "https://example.com/privacy-rights"
}
```

Cover: Art. 15 (access), 16 (rectification), 17 (erasure), 18 (restriction), 20 (portability), 21 (objection).

## Disproportionate-Burden Dark Patterns
- Requests must be submitted in person
- All requests must be notarized
- Only via certified mail
- Verification requires personal data the controller does not already hold

These are Art. 12(5) "manifestly excessive" deflection tactics — DPAs scrutinize them heavily.

## Verified Enforcement

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| Criteo (ETid-1912) | CNIL, 2023-06-15 | €40M | "Insufficient fulfilment of data subjects rights" — erasure requests not propagated |
| TIM (ETid-189) | Garante Italy, 2020-01-15 | €27.8M | Failed to handle erasure + objection requests; no clear contact path |
| Vodafone Italia (ETid-438) | Garante Italy, 2020-11-12 | €12.3M | Failed to act on right-to-object requests |
| Vodafone España (ETid-594) | AEPD Spain, 2021-03-11 | €8.15M | Right-to-object mechanism not communicated |
| Clearview AI (ETid-1190) | ICO UK, 2022-05-18 | €9M | No mechanism whatsoever for EU residents to request erasure |
| Google LLC (ETid-232) | Sweden IMY, 2020-03-11 | €5M | Insufficient fulfilment of data subject rights |

(Art. 15 — 173 fines, Art. 12 — 153 fines, Art. 17 — 96 fines in the enforcementtracker dataset.)

## What the Scanner CANNOT Check
- Whether the company actually responds within 30 days (requires test-account submission)
- Whether erasure is actually performed (requires account access)
- Whether portability data is genuinely machine-readable

## Scanner Output Fields (see field-contract.md)
- `findings.dsar.contactPresent` — boolean
- `findings.dsar.contactType` — `"email" | "form" | "postal_only" | "none"`
- `findings.dsar.dedicatedPagePresent` — boolean + URL
- `findings.dsar.responseCommitmentDays` — integer or null
- `findings.dsar.idVerificationProportionate` — boolean
- `findings.dsar.disproportionateBurdens[]` — strings describing barriers
- `findings.dataSubjectRights[]` — per-right `{right, accessible, clickDepth, url}`

## Scoring Impact
**New category.** Recommended weight: **5%** (folded into a rebalanced legal/rights bucket; see scoring.md).
- 100: contact + dedicated page + 30-day commitment + proportionate verification
- 75: contact + commitment, missing dedicated page
- 50: contact only
- 25: postal-only or generic contact form
- 0: no DSAR mechanism mentioned at all
- −25 if disproportionate-burden language detected
