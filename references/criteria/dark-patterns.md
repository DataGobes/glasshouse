# Criterion: Dark Patterns

## What the Scanner Checks
Whether the consent UI uses deceptive design that subverts user choice. Violates GDPR Art. 7 (consent must be freely given) and is increasingly enforced under DSA Art. 25 by national consumer authorities.

## Legal Basis
- **GDPR Art. 7(3)** — Consent must be as easy to withdraw as to give
- **GDPR Art. 4(11)** — "Freely given" requires absence of pressure or imbalance
- **DSA Art. 25** — Prohibits dark patterns on platforms (consumer-protection enforcement)
- **EDPB Guidelines 03/2022** on deceptive design patterns in social-media interfaces
- **CJEU Planet49 (C-673/17)** — Pre-ticked boxes invalid

## Taxonomy

### Pre-Ticking
Optional consent checkboxes pre-checked. Invalid per Planet49. Check `<input type="checkbox" checked>` in consent context.

### Accept/Reject Asymmetry
- "Accept" prominent (large, brand color, top of layout)
- "Reject" small, gray, hidden behind expansion, or requires scrolling
- "Manage preferences" is the only path to reject = path-of-least-resistance bias

### Cookie Walls
Site inaccessible without accepting all cookies. EDPB position: cookie walls generally violate Art. 7 because consent is not freely given.

### Confirmshaming / Guilt-Tripping
Reject button text engineered to shame: "No, I prefer worse content", "No, I don't want savings".

### Hidden Defaults / Multi-Layer Consent
- "Accept all" exposed at layer 1; "Reject all" only at layer 2 or deeper
- Withdrawal options buried in account settings
- "Continue browsing = consent" implication

**Detection signal**: the scanner emits `findings.consent.rejectAccessibility` (`"layer-1" | "layer-2" | "not-found"`) and `findings.consent.multiLayer` (boolean). When `rejectAccessibility === "layer-2"`, the reject path *exists* but the user must click "Manage settings" / "Instellen" / equivalent first — call this out in the audit narrative as a freely-given-consent violation rather than treating it like a missing-reject case. CNIL Bing (2022, €60M) and CNIL Google (2021, €150M) are the load-bearing enforcement precedents for "reject must be as easy as accept."

### Trick Location / Visual Hierarchy
- Accept button placed where the eye lands first (F-pattern reading)
- Reject below the fold or in low-contrast position

### Deceptive Form Design
- Marketing checkbox checked by default
- Tiny / hidden non-consent toggles
- Wrong expectation framing ("By continuing you agree")

## Detection (Scout + Vision Analysis)
1. **Button size asymmetry** — Accept ≥ 3× Reject area
2. **Color contrast** — Accept high contrast / brand color; Reject muted gray
3. **Visual hierarchy** — Accept above Reject in DOM/reading order
4. **Pre-ticking** — `checked` attributes in consent forms
5. **Layered consent** — Reject requires expansion / extra click

## Verified Enforcement

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| Meta Platforms Ireland (ETid-1543) | DPC Ireland, 2023-01-04 | €390M | Forced consent bundling on Facebook + Instagram |
| Google LLC + Ireland (ETid-978/979) | CNIL, 2021-12-31 | €90M + €60M | No reject button as easy as accept on google.fr |
| Facebook Ireland (ETid-980) | CNIL, 2021-12-31 | €60M | Same pattern on facebook.com |
| Microsoft Ireland | CNIL, 2022-12-19 | €60M | bing.com — reject required 2 clicks, accept 1 |
| Amazon Europe Core | CNIL, 2020-12-07 | €35M | Banner did not allow informed refusal of advertising cookies |

**EDPB Guidelines 03/2022** specifically prohibits asymmetric buttons, pre-checked boxes, and confusing language as violating freely-given consent — cited in nearly every CNIL cookie decision since 2022.

## Scanner Output Fields (see field-contract.md)
- `findings.darkPatterns.tiltClass` — `"fs-bar-balanced"` | `"fs-bar-tilted-accept"` | `"fs-bar-tilted-reject"` | `"fs-bar-heavy-tilt"`
- `findings.darkPatterns.acceptFactors[]` — `{name, value, status}` per accept-side feature
- `findings.darkPatterns.rejectFactors[]` — `{name, value, status}` per reject-side feature
- `findings.darkPatterns.verdictText` — short verdict string
- `findings.darkPatterns.verdictClass` — `"fs-verdict-clean"` | `"fs-verdict-mild"` | `"fs-verdict-dark"`

## Measured vs. Inferred Button Styling

The scanner emits `findings.consent.buttonStyling` — computed `{backgroundColor, color, borderStyle, fontWeight, areaPx}` for the accept and reject buttons, plus `stylingIdentical` (boolean) and `areaRatio`. **Score button-styling asymmetry only from these measured fields.** Do not describe a button as a "red brand button" or "high-contrast accept" from a screenshot impression — vision is unreliable for this and has produced false positives (a banner whose buttons were styled *identically* was described as having a prominent red accept vs. a plain reject). When `stylingIdentical === true`, state plainly that the buttons are styled identically and do **not** record a colour/contrast dark pattern. Size asymmetry is still a valid signal when `areaRatio` exceeds ~2× (`acceptSize > rejectSize * 2`), independent of colour.

## Scoring Impact (see scoring.md)
This criterion is weighted **15%** (raised from 5% in Phase E — deceptive design invalidates consent regardless of the formal mechanism; EDPB 03/2022, Opinion 08/2024). Score 0–100 based on number and severity of patterns:
- 100: no patterns detected (symmetric, shallow reject, no pre-ticking)
- 75: minor asymmetry only (still reject on layer 1)
- 50: clear asymmetry OR missing reject button OR reject only on layer 2
- 25: multiple patterns combined
- 0: cookie wall + forced consent, or no reject path at all
