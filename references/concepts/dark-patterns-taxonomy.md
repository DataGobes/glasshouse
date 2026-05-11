# Concept: Dark Patterns Taxonomy

EDPB Guidelines 03/2022 (joint with EDPS) define six categories of deceptive design. The scanner's `findings.darkPatterns` should map to these categories so that the report can cite the EDPB taxonomy directly.

## The Six Categories (EDPB 03/2022)

### 1. Overloading
Confronting the user with too much information / too many options at once, exhausting their decision-making capacity.

Examples:
- Cookie banner with 800+ vendor toggles, no "reject all" shortcut
- TCF interfaces that require scrolling through dozens of purposes per vendor
- Multi-page consent flow with each page presenting different consent contexts

### 2. Skipping
Designing the interface so that the user forgets or skips parts of the process that protect their privacy.

Examples:
- Default-allowed legitimate-interest toggles below the fold
- "Save preferences" button hidden in a sub-menu while "Accept all" is at the top
- Mobile banner where reject requires horizontal scrolling

### 3. Stirring
Affecting choice through emotional manipulation or visual nudging that has no factual basis.

Examples:
- Confirmshaming: "No, I prefer ads about products I don't like"
- Visual bias: smiling faces near "Accept", sad faces near "Reject"
- Color psychology: green Accept, red/gray Reject

### 4. Hindering
Obstructing or blocking the user from getting informed about how data is processed or making choices.

Examples:
- "Reject all" requires 5+ clicks; "Accept all" requires 1
- Cookie wall blocking site access until consent given
- Privacy policy link in 8pt gray text in a footer collapsed behind "More"

### 5. Fickle
Inconsistent design choices and information that disorient the user.

Examples:
- Settings UI has different purpose names than the consent banner
- "Marketing" cookies in banner = "Personalized advertising" in policy = "Ads" in account settings
- Toggling a category does not predictably enable/disable the corresponding cookies

### 6. Left in the Dark
Hiding information or design elements that would help the user.

Examples:
- Hidden cookie policy link
- "Necessary" cookies category that includes obvious tracking cookies
- Cookie expiration not disclosed in the banner UI

## Mapping Scanner Findings to Categories

The scanner's existing dark-pattern detections map cleanly:

| Scanner finding | EDPB category |
|---|---|
| Pre-ticked checkbox | Skipping |
| Accept/Reject button-size asymmetry | Hindering, Stirring |
| Color contrast asymmetry | Stirring |
| Reject behind multiple clicks | Hindering |
| Cookie wall | Hindering |
| Confirmshaming reject text | Stirring |
| 800+ vendor toggles, no reject-all | Overloading |
| Cookie purpose mismatch (policy vs scanner) | Fickle |
| No expiration shown in banner | Left in the dark |

## Citing in Reports
"This banner exhibits a Hindering pattern (EDPB Guidelines 03/2022): rejecting requires three clicks while accepting requires one, in violation of GDPR Art. 7(3) which requires withdrawal to be as easy as giving consent."

This phrasing is more authoritative than a generic "dark pattern detected" because it ties the finding to:
1. A named EDPB taxonomy
2. A specific GDPR article
3. The observable scanner evidence
