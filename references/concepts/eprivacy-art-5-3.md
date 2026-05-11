# Concept: ePrivacy Directive Art. 5(3)

The single most-cited legal hook in cookie/tracking enforcement. Worth understanding deeply because it predates GDPR and operates alongside it — not under it.

## The Text
ePrivacy Directive 2002/58/EC, Article 5(3) (as amended by Directive 2009/136/EC):

> Member States shall ensure that the storing of information, or the gaining of access to information already stored, in the terminal equipment of a subscriber or user is only allowed on condition that the subscriber or user concerned has given his or her consent, having been provided with clear and comprehensive information... This shall not prevent any technical storage or access for the sole purpose of carrying out the transmission of a communication over an electronic communications network, or as strictly necessary in order for the provider of an information society service explicitly requested by the subscriber or user to provide the service.

## Key Implications
1. **"Storing or gaining access"** covers both writing AND reading from terminal equipment — applies to cookies, localStorage, IndexedDB, sessionStorage, and to APIs that *read* device characteristics (fingerprinting).
2. **"Strictly necessary"** is narrowly construed (CJEU Planet49). The service must be genuinely impossible to deliver without the storage/access. Analytics is not strictly necessary. Advertising is not strictly necessary.
3. The exemption is **per-purpose**. A session cookie for cart state is strictly necessary for an e-commerce checkout. The same cookie repurposed for analytics is not.

## EDPB Guidelines 2/2023 on the Technical Scope of Art. 5(3)
Adopted 2023, finalized 2024. Confirmed:
- Fingerprinting is in scope of Art. 5(3) and requires consent
- Pixel-based tracking falls under "gaining access to information stored" — even if no cookies are placed
- IP collection by third parties from `<img>` or pixel requests falls under Art. 5(3)
- "Local processing" exemption for tracking that never leaves the device is narrow

## The Two-Track Enforcement Model

**ePrivacy Art. 5(3) violations:**
- Enforced by national DPAs under domestic ePrivacy implementations
- France: Article 82 of the French Data Protection Act
- Penalties under national law (CNIL: up to 2% of global revenue, recently raised to align with GDPR)
- These fines are **not in the GDPR enforcementtracker dataset** — they're separate

**GDPR violations (Art. 6, 7, 13/14) on the same processing:**
- Enforced by lead supervisory authority
- Up to €20M or 4% of global revenue
- These are in enforcementtracker

A site that places advertising cookies pre-consent typically violates both regimes simultaneously — CNIL increasingly cites both in the same decision.

## The Pending ePrivacy Regulation
ePrivacy Regulation has been in negotiation since 2017 and is still not adopted as of 2026. When eventually adopted, it will:
- Replace the Directive (no national transposition needed)
- Align maximum fines with GDPR (up to 4% global revenue / €20M)
- Clarify cookie/storage rules
- Address machine-to-machine communications

Until then, the 2002 Directive + national transpositions remain the operative law.

## Cited In
- pre-consent-tracking.md
- consent.md
- cookie-hygiene.md
- fingerprinting.md
