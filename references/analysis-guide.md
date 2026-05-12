# Deep Analysis Guide

Reference for Steps 4–8 of the glasshouse scan workflow. Read this during the analysis phase, then read each `criteria/<name>.md` for the criteria triggered by the scan.

## Reading Order

1. This file (analysis-guide.md) — the methodology
2. `criteria/index.md` — the 15 criteria and which articles they cover
3. The relevant `criteria/<name>.md` page for each finding you're writing
4. `concepts/<name>.md` only when a criterion file points to one
5. `field-contract.md` immediately before writing the analysis JSON
6. `scoring.md` when calculating the score

## Reject-Path Accessibility (Multi-Layer Banners)

The scanner now traverses one layer deep when the reject button is missing on layer 1. Read these fields from `raw.variants.reject.consent` (the brief surfaces them as "Reject path"):

- **`rejectAccessibility: "layer-1"`** — reject reachable on the first panel. Normal.
- **`rejectAccessibility: "layer-2"`** — the scanner had to click "Manage settings" / "Instellen" / equivalent before reject became reachable. Always emit a `findings.consent.annotations[]` entry calling this out (status: `"fail"`, title: `"Reject requires opening layer 2"`, detail referencing CNIL Bing 2022 / Google 2021 — "reject must be as easy as accept"). Also surface as a dark pattern under "Hidden Defaults / Multi-Layer Consent" (see `criteria/dark-patterns.md`).
- **`rejectAccessibility: "not-found"`** — banner detected but no reject path discovered even after traversal. Score consent as 0 and call out the dark pattern explicitly.
- **`multiLayerMethod`** — `"layer2-direct-reject"` means there was a "Reject all" on layer 2; `"layer2-toggle-save"` means the scanner had to uncheck non-essential toggles and save. The second is *more* of a freely-given-consent problem because real users almost never do that.

Do not infer "no reject" from missing `rejectText` — that field reflects what was visible on layer 1, not what's reachable.

## Three-Tier Tracker Classification

Present each tier separately with appropriate severity language. Do NOT lump consent-mode pings with full tracking fires — this undermines report credibility with technical reviewers.

| Tier | Field | What | GDPR Status |
|------|-------|------|-------------|
| 3 | `trackers` | Full tracking fires — pixel events, beacons, collect endpoints with no consent restrictions | **Clear violation** without consent |
| 2 | `consentModePings` | Tags firing in Google Consent Mode "denied" state, or Microsoft UET consent-status pings. Data still transmitted (IP, URL) but restricted | **Legally debatable** — strict ePrivacy reading says violation; Google/MS argue privacy-safe |
| 1 | `sdkLoads` | Script/library loads (gtm.js, fbevents.js, bat.js). Not tracking by themselves | **Not a violation** alone |

See `criteria/pre-consent-tracking.md` for the full classification + EDPB Guidelines 2/2023 framing.

## Art. 12 / 13 / 14 Privacy Policy Content Analysis

If `summary.legalPageContent.privacyPolicy` contains text, score these 13 disclosures (Art. 13 + 14). Output as `findings.privacyPolicyAnalysis[]`. Each entry: `{element, status, excerpt}` where `status ∈ {present, absent, vague}`.

1. **Controller identity** — Name and contact details of the data controller
2. **DPO contact** — Data Protection Officer contact details (if applicable)
3. **Processing purposes** — Each purpose explicitly listed
4. **Legal basis per purpose** — Consent, legitimate interest, contract, legal obligation, etc.
5. **Legitimate interests** — If using Art. 6(1)(f), what interests are pursued
6. **Recipients** — Categories of recipients OR specific recipients (prefer specific — see processor-transparency.md)
7. **International transfers** — Transfer details + safeguards (SCCs, BCRs, adequacy decisions, DPF)
8. **Retention periods** — Per purpose, or criteria for determining retention
9. **Data subject rights** — Access, rectification, erasure, restriction, portability, objection
10. **Right to withdraw consent** — How to withdraw, and that withdrawal doesn't affect prior processing
11. **Right to complain** — Right to lodge complaint with supervisory authority
12. **Statutory/contractual requirement** — Whether data provision is required and consequences of not providing
13. **Automated decision-making** — Profiling logic, significance, and consequences

Plus the Art. 12 quality layer (NEW):
- **Readability** (Flesch-Kincaid grade level — target ≤12)
- **Legalese density** ("notwithstanding", "hereinafter", "therein" per 1k words)
- **Structure** (descriptive headings present)
- **Accessibility** (not behind cookie wall, contrast OK)

See `criteria/legal-pages.md` for full detail.

## Cookie Purpose Cross-Reference

If `summary.legalPageContent.cookiePolicy` contains text:

1. Extract cookie names and declared categories from the cookie policy text
2. Compare against scanner-classified purposes in `summary.preConsentCookies` and `summary.newPostConsentCookies`
3. Flag mismatches: e.g., site declares `li_sugr` as "functional" but scanner classifies it as "tracking"
4. Flag undisclosed cookies: cookies found by scanner but not mentioned in the policy

Output as `findings.cookiePurposeMatching[]`. Each entry: `{cookie, declared, observed, match}`.

## Data Subject Rights Assessment

From `summary.legalPages`, identify DSAR-related links (type matches: "data-request", "dsar", "erasure", "portability", "opt-out", "privacy-center", etc.). Assess which rights have accessible mechanisms:

- Right of access (Art. 15)
- Right to rectification (Art. 16)
- Right to erasure (Art. 17)
- Right to restriction (Art. 18)
- Right to portability (Art. 20)
- Right to object (Art. 21)

Output as `findings.dataSubjectRights[]`. Each entry: `{right, accessible, clickDepth, url}`.

See `criteria/dsar.md` for the contact / 30-day commitment / verification-burden checks.

## NEW Analysis Sections (post-2026-04 wiki migration)

### Processor Transparency Audit (criteria/processor-transparency.md)
After identifying scanner-detected third-party domains in `summary.thirdPartyDomains`, parse the privacy policy for **named** processor mentions:

1. For each detected processor (Google Analytics, Meta Pixel, Hotjar, etc.), check if the **specific name** appears in the privacy-policy text
2. Output as `findings.processors.namedInPolicy[]` (named) and `findings.processors.undisclosed[]` (detected but not named)
3. Flag joint-controller scenarios: Meta Pixel, Facebook Like/Share buttons, YouTube embeds with cookies — these require Art. 26 disclosure
4. Generic "third-party service providers" without names = Art. 13(1)(e) violation per EDPB transparency guidance

### Breach Notification Infrastructure (criteria/breach-notification.md)
1. Fetch `https://<host>/.well-known/security.txt` — note presence, expiration, fields
2. Search privacy policy for "72 hours", "three days", "without undue delay" in the breach context
3. Search for individual notification commitment ("notify affected users", "high risk to your rights")
4. Flag delay-tactic language ("when we deem appropriate", "if we determine")
5. Output as `findings.breachNotification`

### Opt-Out / Art. 7(3) Withdrawal Audit (criteria/opt-out-mechanism.md)
1. Compare `findings.consent.acceptanceClicks` and `findings.consent.revocationClicks` from the reject-variant scan
2. Search policy for Art. 21 right-to-object disclosure (specifically marketing absolute right + legitimate-interests right)
3. Detect pre-ticked marketing checkboxes in any signup forms
4. Output as `findings.optOut`

### Fingerprinting Analysis (NEW tiered model — 2026-04, criteria/fingerprinting.md)
The scanner produces `findings.fingerprinting.stackedSignals[]` (caller-domain attributed verdicts) and `findings.fingerprinting.commercialSdks[]`. For each entry, read `summary.legalPageContent.privacyPolicy` and fill:

1. **`rationale`** — one sentence summarising what was detected and why it matters (e.g., "16 hardware probes from inline Adobe Target before consent action")
2. **`legitimateBasisClaim`** — what Art. 6 basis the controller could plausibly invoke for this caller, IF disclosed. Examples: Riskified anti-fraud → plausible Art. 6(1)(f) for fraud prevention; Adobe Target A/B testing → typically no plausible non-consent basis; New Relic / Sentry → plausible Art. 6(1)(f) for service operation. Set to `null` if no plausible basis exists.
3. **`purposeDisclosed`** — boolean. Did the policy actually name this processor and state its purpose? Vague "third-party providers" wording is `false`.

Same three annotations apply to each `commercialSdks[]` entry. Scoring rule: when both `purposeDisclosed: true` AND `legitimateBasisClaim` is non-null, the SDK is surfaced as a disclosed finding (no penalty); otherwise −15 to overall outside the −20 pre-consent cap.

What the scanner does NOT decide: whether the disclosed purpose is *adequate* under Art. 12 transparency — that requires policy interpretation. The `purposeDisclosed: true` just means a name + purpose appear; whether that disclosure satisfies Art. 13(1)(e) is a separate Art. 12/13 analysis.

### Special Categories Detection (criteria/special-categories.md) — context-aware
Only run this analysis when the site is in scope: healthcare, fintech with KYC, employment platforms, dating apps, identity verification.
1. Scan form fields for health-related input names
2. Detect biometric capture APIs (`getUserMedia()`, WebAuthn for identification, third-party identity SDKs)
3. Verify explicit-consent checkbox separate from general consent
4. Output as `findings.specialCategories`

## Citing Enforcement

Each criterion file contains a verified enforcement table with ETids. Use these in `recommendations[].enforcementRef`:

```json
{
  "title": "Implement post-reject cookie deletion",
  "priority": "high",
  "detail": "...",
  "enforcementRef": "CNIL Microsoft Ireland 2022-12-19, €60M (cnil.fr)"
}
```

For ePrivacy-only fines (Amazon EU Core 2020, Microsoft Ireland 2022, IAB Europe 2022) — cite the DPA URL directly. They're not in the GDPR `fines.db`.

When in doubt, cross-reference against an authoritative source (the
[GDPR Enforcement Tracker](https://www.enforcementtracker.com/) or the DPA's
own published decision). If you maintain a local SQLite snapshot of the
dataset:

```bash
sqlite3 <path/to/your>/fines.db \
  "SELECT etid, controller, date_iso, fine_amount_eur, violation_type FROM fines WHERE etid='ETid-1844';"
```
