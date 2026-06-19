# Analysis JSON Field Contract

The generator normalises common drift, but **use these exact field names** for best results.

## `findings.cookies[].purpose` (Persistence Bars)
Must be one of: `essential`, `functional`, `analytics`, `tracking`, `marketing`, `unknown`.
Do NOT use decorated values like `"Analytics (Snowplow)"` or `"Advertising (Google)"`.

## `findings.gdprCompliance[]` (Compliance Matrix)
```json
{ "article": "Art. 6(1)(a)", "title": "Consent basis", "status": "fail", "finding": "No valid consent collected" }
```
- `article`: string (e.g. `"Art. 6(1)(a)"`, `"ePrivacy 5(3)"`)
- `title`: short label
- `status`: `"pass"` | `"fail"` | `"partial"`
- `finding`: optional explanation

## `findings.beforeAfter` (Before/After Consent)
```json
{
  "preCookieCount": 5, "postCookieCount": 22,
  "preBreakdown": [{"label":"Analytics","color":"yellow"}], "postBreakdown": [...],
  "preCategoryBreakdown": [{"category":"tracking","count":3,"color":"#dc2626"},{"category":"analytics","count":2,"color":"#d97706"}],
  "postCategoryBreakdown": [{"category":"tracking","count":12,"color":"#dc2626"},{"category":"analytics","count":6,"color":"#d97706"}],
  "preTrackerCount": 4, "postTrackerCount": 11,
  "preThirdPartyCount": 8, "postThirdPartyCount": 22,
  "preStorageMechanisms": ["cookies","localStorage"], "postStorageMechanisms": ["cookies","localStorage","indexedDB"],
  "newCookiesDelta": 17
}
```
- Use `preCookieCount` / `postCookieCount` (not `preCookies` / `postCookies`)
- Use `preBreakdown` / `postBreakdown` (not `prePills` / `postPills`)
- Pills use `color` (red/yellow/green/blue), not `type`
- **Enhanced fields (optional, backward compatible):**
  - `preCategoryBreakdown` / `postCategoryBreakdown`: per-category `{category, count, color}` — renders stacked horizontal bars. Use CSS color values for `color` (e.g. `"#dc2626"` for tracking, `"#d97706"` for analytics, `"#059669"` for essential)
  - `preTrackerCount` / `postTrackerCount`: distinct tracker count shown as stat line
  - `preThirdPartyCount` / `postThirdPartyCount`: third-party domain count shown as stat line
  - `preStorageMechanisms` / `postStorageMechanisms`: `["cookies","localStorage","sessionStorage","indexedDB"]` — renders small badges
  - `newCookiesDelta`: integer delta — if absent, calculated as `postCookieCount - preCookieCount`
- When enhanced fields are present, category bars replace pills and a central delta indicator is shown
- When absent, falls back to pills-only view (backward compatible)

## `findings.darkPatterns` (Fairness Scale)
```json
{
  "tiltClass": "fs-bar-heavy-tilt",
  "verdictClass": "fs-verdict-dark",
  "verdictText": "Significant dark patterns detected",
  "acceptFactors": [{ "name": "Button size", "value": "2x larger", "status": "bad" }],
  "rejectFactors": [{ "name": "Visibility", "value": "Grey text", "status": "bad" }]
}
```
- `tiltClass`: `"fs-bar-balanced"` | `"fs-bar-tilted-accept"` | `"fs-bar-tilted-reject"` | `"fs-bar-heavy-tilt"`
- Use separate `acceptFactors` / `rejectFactors` arrays (not a single `factors` array with `side` field)
- Factors use `name` / `value` / `status` (not `label` / `weight`)
- Use `verdictText` (not `verdict`)

## `findings.auditTrail` (Timeline — TWO slides, ONE findings key)
```json
{
  "auditTrail": {
    "preConsent": [
      { "time": "t+0ms", "title": "Page load begins", "domain": "example.com", "type": "essential" },
      { "time": "t+530ms", "title": "Canvas fingerprinting: getImageData", "domain": "cdn.example.com", "type": "tracking" }
    ],
    "postConsent": [
      { "time": "t+0ms", "title": "Consent accepted", "domain": "example.com", "type": "consent" },
      { "time": "t+120ms", "title": "Google Analytics fired", "domain": "analytics.google.com", "type": "tracking" }
    ]
  }
}
```
- **CRITICAL**: The findings key is `auditTrail` (singular) containing BOTH `preConsent` and `postConsent` arrays.
- The `slides.include` keys are `"auditTrailPre"` and `"auditTrailPost"` — but these are just slide identifiers. The **data** always lives at `findings.auditTrail.preConsent` / `findings.auditTrail.postConsent`.
- **DO NOT** create `findings.auditTrailPre` or `findings.auditTrailPost` as separate keys — the generator will not find the data.
- Use `title` (not `event`)
- Use `type`: `"essential"` | `"tracking"` | `"adtech"` | `"security"` | `"consent"` (not `severity`)

## `findings.consent` (Consent Banner slide)
```json
{
  "platform": "OneTrust",
  "bannerText": "We use cookies to provide, secure, analyze and improve our services...",
  "acceptText": "Accept All",
  "rejectText": "Reject All",
  "isAsymmetric": false,
  "annotations": [...]
}
```
- **`bannerText`** (REQUIRED): the consent banner paragraph text visible to the user. Reconstruct from the scout screenshot. **NOT** `bannerType`.
- **`acceptText`** (REQUIRED): the accept button label as displayed. **NOT** `acceptButton` — the generator reads `c.acceptText`. The scanner captures CSS selectors in `acceptButton`; you must provide the human-readable label here.
- **`rejectText`**: the reject button label. **NOT** `rejectButton`. Omit if no reject button exists.
- **`isAsymmetric`**: `true` if accept button is visually larger/more prominent than reject
- `acceptWidth` / `rejectWidth`: optional size descriptors for the measurement bar (e.g. `"2x larger"`, `"standard"`)
- **`multiLayer`** (scanner-emitted): `true` if reject was only reachable by opening a second layer (clicking a "Settings"/"Manage" button on layer 1). `false` when reject is on layer 1, omitted when no banner.
- **`rejectAccessibility`** (scanner-emitted): one of `"layer-1"` (reject button on the first banner), `"layer-2"` (reject was reached after opening settings), or `"not-found"` (banner detected but no reject path discovered even after layer-2 traversal). Read this in your audit narrative instead of inferring "no reject" from missing fields — the scanner now traverses one layer deep before giving up.
- `multiLayerMethod` (scanner-emitted, optional): when `multiLayer` is `true`, the strategy used — `"layer2-direct-reject"` (clicked a reject button on layer 2) or `"layer2-toggle-save"` (unchecked non-essential toggles and saved).

## `findings.consent.annotations[]` (Consent Banner)
```json
{ "status": "fail", "title": "No reject button", "detail": "Users must navigate to settings to decline" }
```
- Use `title` (not `label`)

## `findings.trackers[]` (Tracker Cards — "Who's Watching?")
```json
{
  "name": "Google Analytics",
  "tier": "active",
  "status": "Active pre-consent",
  "category": "Analytics",
  "domains": "analytics.google.com, stats.g.doubleclick.net",
  "jurisdiction": "US",
  "is4thParty": false,
  "loadedBy": null
}
```
- **`tier`** (REQUIRED): `"active"` = fires pre-consent (shows animated pulse + red card), `"gated"` = fires only post-consent (muted card), `"csp"` = CSP-detected only (no network fire)
- **`status`** (REQUIRED): short human label shown on the card, e.g. `"Active pre-consent"`, `"Gated (post-consent)"`, `"CSP-detected"`
- **`domains`**: comma-separated string (not an array)
- `is4thParty`: when `true`, include `loadedBy` — renders a red "loaded by X" badge

**DO NOT use** `firedPreConsent: bool` — the generator ignores this field. Use `tier` instead.

## `findings.thirdPartyDomains[]` (Transfer Circuit)
```json
{
  "domains": "static.licdn.com",
  "requestCount": 27,
  "jurisdiction": "US",
  "risk": "dpf",
  "company": "Microsoft"
}
```
- **`domains`** (REQUIRED, plural): string shown inside the circuit node. **NOT** `domain` (singular) — the generator reads `d.domains`, not `d.domain`.
- **`requestCount`** (REQUIRED): integer for the request badge. **NOT** `requests`.
- **`risk`** (REQUIRED): `"adequate"` (green line) | `"dpf"` (orange line) | `"risk"` (red line). **NOT** `transferRisk`.
- `company`: optional, not currently rendered in the node.

## `findings.requestPulse[]` (Request Pulse bars)
```json
{
  "domain": "analytics.google.com",
  "preConsent": 12,
  "postConsent": 5,
  "total": 17,
  "isEssential": false
}
```
- **`preConsent`** (REQUIRED): request count fired before consent — renders as red bar
- **`postConsent`** (REQUIRED): request count fired after consent — renders as orange bar
- **`total`** (REQUIRED): sum, used for bar width scaling and count label
- **`isEssential`**: `true` renders a green bar (CDN/infra) instead of pre/post split
- **DO NOT use** `requests: N` alone — the generator ignores that field and all bars show 0

The slide is skipped if `requestPulse` has fewer than 3 entries.

## `findings.recommendations[]` (Recommendations)
```json
{ "priority": "critical", "action": "Remove pre-consent fingerprinting", "detail": "Full explanation.", "article": "ePrivacy Art. 5(3)", "enforcementRef": "EDPB 2023" }
```
- **`action`** (REQUIRED): short title shown in bold. **NOT** `title` — the generator reads `r.action`.
- `detail`: explanation text
- `priority`: used for visual badge colour (`critical` | `high` | `medium` | `low`)
- **HARD LIMIT: max 6 recommendations total.** The `paginate()` function splits evenly across pages, but the numbering formula assumes exactly `MAX.RECOMMENDATIONS (6)` items per page. With 7+ items, page 2 numbering starts at 7 (skipping 5–6). Always provide ≤6 recommendations to avoid split-page numbering bugs.

## `findings.securityHeaders[]` (Shield Rings)
Flat array — **NOT** an object with `present`/`missing` sub-arrays.
```json
[
  { "name": "strict-transport-security", "value": "max-age=31536000", "status": "present" },
  { "name": "referrer-policy", "value": null, "status": "missing" }
]
```
- `status`: `"present"` | `"missing"` | `"partial"`
- `findings.scriptIntegrity` and `findings.cors` are **separate top-level findings fields**, NOT nested inside `securityHeaders`

## `findings.cookies[]` (Cookie Lifespan — Persistence Bars)
```json
{ "name": "guest_id", "domain": ".x.com", "duration": "1.1yr", "durationDays": 396, "purpose": "analytics", "phase": "pre", "secure": true }
```
- **`durationDays`** (REQUIRED integer): used to calculate bar widths. Session cookies = `0`. Without this field all bars render at 0 width (empty slide).
- **`duration`** (REQUIRED string): human label displayed next to the bar (e.g. `"1.1yr"`, `"6mo"`, `"Session"`).
- **`purpose`**: must be one of `essential` | `functional` | `analytics` | `tracking` | `marketing` | `unknown`
- `phase`: `"pre"` | `"post"` — informational only, not rendered in bars

## `cookieParty` slide (First-Party vs Third-Party)

Derived slide — no dedicated `findings` key. Reuses `findings.cookies[]`, `meta.domain`, and optional `meta.aliasDomains[]`.

- Each cookie's `domain` (leading dot stripped) is classified by eTLD+1 match against `meta.domain` plus any `meta.aliasDomains[]`:
  - **first-party**: cookie eTLD+1 equals `meta.domain` eTLD+1 OR equals any eTLD+1 listed in `meta.aliasDomains`
  - **third-party**: cookie eTLD+1 matches none of the above
- **`meta.aliasDomains`** (optional, array of strings): use this when the scanned URL redirects to a different TLD or the site owner controls multiple eTLDs the user traverses in one session. The scanner's final landed URL (after redirects) is a common source — e.g. `dyson.com` redirects to `dyson.nl`, so set `meta.aliasDomains: ["dyson.nl"]`. Without it, all `.dyson.nl` cookies get misclassified as third-party.
- Classification is *technical*, not editorial: cookies like `_ga` or `_fbp` set on the eTLD by a client-side tag show up as **first-party** here even though their purpose is third-party tracking. The slide deliberately exposes that gap — pair it with the `cookies` purpose breakdown for the full story.
- A small compound-TLD list (`co.uk`, `com.au`, etc.) is used in place of a full Public Suffix List.
- Slide is skipped when `findings.cookies[]` is empty or `meta.domain` is missing.
- Slide key: `"cookieParty"` — placed after `"cookies"` in the default order.

## `findings.legalPages[]` (Document Shelf)
```json
{ "title": "Privacy Policy", "url": "https://...", "status": "present" }
```
- Use `title` (not `label`), `status: "present"|"missing"` (not `present: true`)

## `findings.privacyPolicyAnalysis[]` (Privacy Policy Checklist)
```json
{ "element": "Controller identity", "status": "present", "excerpt": "LinkedIn Ireland Unlimited Company..." }
```
- Use `element` (not `item`) — the generator reads `item.element`
- **`status`** must be one of `"present"` | `"absent"` | `"vague"`. Do **NOT** use `"missing"` (use `"absent"`) or `"partial"` (use `"vague"`) — the validator rejects them.

## `findings.rejectScenario` (Reject Scenario slide)
```json
{
  "rejectHonoured": false,
  "summary": "3 trackers and 5 cookies persist despite rejection",
  "persistingTrackers": [
    { "name": "Google Analytics", "domains": "analytics.google.com", "category": "Analytics" }
  ],
  "persistingCookies": [
    { "name": "_ga", "domain": ".example.com", "purpose": "analytics" }
  ]
}
```
- `rejectHonoured`: `true` if reject meaningfully reduces tracking (shows green checkmark)
- `persistingTrackers`: trackers from reject variant that aren't in essential category
- `persistingCookies`: non-essential cookies still present after reject
- Add `"rejectScenario"` to `slides.include` when the scanner ran a reject variant

## `findings.variantComparison` (Variant Comparison slide)
```json
{
  "ignore": { "trackerCount": 8, "cookieCount": 12, "thirdPartyDomainCount": 15 },
  "accept": { "trackerCount": 14, "cookieCount": 28, "thirdPartyDomainCount": 22 },
  "reject": { "trackerCount": 6, "cookieCount": 10, "thirdPartyDomainCount": 13 },
  "verdict": "Rejecting reduces tracking by 57% vs accepting, but 6 trackers still fire"
}
```
- Each variant has `trackerCount`, `cookieCount`, `thirdPartyDomainCount`
- `verdict`: one-line comparison summary
- Add `"variantComparison"` to `slides.include` when all 3 variants have data

## `findings.auditTrail.rejectConsent[]` (Audit Trail: Post-Reject)
Same format as `auditTrail.postConsent`. Use slide key `"auditTrailReject"`.

## `findings.piggybackingChains[]` (Piggybacking Chains slide)
```json
[
  {
    "chain": [
      { "name": "Google Ads", "domain": "pagead2.googlesyndication.com" },
      { "name": "DoubleClick", "domain": "stats.g.doubleclick.net" },
      { "name": "Criteo", "domain": "dis.criteo.com" }
    ],
    "risk": "high"
  }
]
```
- `chain`: ordered array of tracker nodes, first = root loader, last = deepest 4th party
- `risk`: `"low"` | `"medium"` | `"high"`
- Add `"piggybackingChains"` to `slides.include` when `is4thParty` trackers exist

## `findings.storageAnalysis` (Storage Analysis slide)
```json
{
  "localStorage": {
    "preConsent": [{ "key": "ab_test_group", "name": "ab_test_group" }],
    "postConsent": [{ "key": "user_prefs", "name": "user_prefs" }]
  },
  "sessionStorage": { "preConsent": [], "postConsent": [] },
  "indexedDB": {
    "preConsent": [{ "name": "firebaseLocalStorage" }],
    "postConsent": []
  }
}
```
- Each storage type has `preConsent` and `postConsent` arrays
- Items should have `key` or `name` field for display
- Builder returns `null` if all storage types are empty
- Add `"storageAnalysis"` to `slides.include` when any storage entries exist

## `findings.cookiePurposeMatching[]` (Cookie Purpose Matching slide)
```json
[
  { "cookie": "_ga", "declared": "Analytics", "observed": "Tracking", "match": false },
  { "cookie": "session_id", "declared": "Essential", "observed": "Essential", "match": true }
]
```
- `declared`: what the site's cookie policy says
- `observed`: what the scanner determined from behaviour
- `match`: `true` if declared matches observed
- Add `"cookiePurposeMatching"` to `slides.include` when mismatches exist

## `findings.methodology` (Methodology slide)
```json
{
  "scoutUsed": true,
  "bannerDetectionMethod": "vision-assisted",
  "variants": ["ignore", "accept", "reject"],
  "preCounts": { "cookies": 8, "trackers": 5, "requests": 47, "thirdPartyDomains": 12 },
  "postCounts": { "cookies": 34, "trackers": 14, "requests": 112, "thirdPartyDomains": 22 }
}
```
- `scoutUsed`: `true` if scout mode (`--scout`) was run before the full scan — adds a "Scout" node to the flowchart
- `bannerDetectionMethod`: `"cmp-selector"` (auto-detected known CMP), `"content-fallback"` (generic text matching), `"vision-assisted"` (Claude provided button text hints), `"none"` (no banner found)
- `variants`: which scan variants were executed
- `preCounts` / `postCounts`: aggregate counts for badge display on flowchart nodes
- When `findings.methodology` is absent, falls back to a static 2-phase description (backward compatible)

## `slides.include` — Valid slide type keys
`title`, `tldr`, `beforeAfter`, `auditTrailPre`, `auditTrailPost`, `auditTrailReject`, `consent`, `darkPatterns`, `rejectScenario`, `variantComparison`, `trackers`, `cookies`, `cookieParty`, `cookiePurposeMatching`, `thirdPartyDomains`, `piggybackingChains`, `requestPulse`, `storageAnalysis`, `securityHeaders`, `legalPages`, `gdprCompliance`, `riskSummary`, `recommendations`, `methodology`, `privacyPolicy`, `fingerprinting`, `consentRevocation`, `tcfConsentMode`, `dataSubjectRights`, `formLeakage`

**NOT valid**: `overview`, `privacyPolicyAnalysis`, `consentGranularity` — these do not exist as standalone slides in generate.js. `consentGranularity` and `gpc` are now rendered within the `consent` slide automatically.

**Always include**: `riskSummary` — shows the 7-category score breakdown + overall score. Place it before `recommendations`.

`consentRevocation` returns `null` (skipped) when `mechanismFound` is `false` — omit from slides.include in that case.

## `findings.riskSummaryNotes[]` (Risk Summary — right panel)
```json
[
  { "category": "consent", "note": "OneTrust CMP present but no first-layer reject button; GPC signal read" },
  { "category": "preConsentTracking", "note": "7 trackers and 38 cookies fire before any consent interaction" }
]
```
- `category` (REQUIRED): must match a `scores` key. The 9 scoring categories (see `scoring.md`) are valid: `consent`, `preConsentTracking`, `legalPages`, `crossBorder`, `securityHeaders`, `cookieManagement`, `darkPatterns`, plus the Phase-D additions `processorTransparency` and `dsar`.
- `note` (REQUIRED): 1-2 sentence insight explaining *why* this category scored the way it did
- When present, the Risk Summary slide switches to a 2-column layout (bars left, notes right)
- When absent, the slide renders as before (bars only, full width) — backward compatible
- Include notes for all 9 categories for best visual balance

## `findings.scriptIntegrity` (Security Headers slide)
```json
{ "totalExternal": 12, "withIntegrity": 2, "coveragePercent": 17 }
```

## `findings.cors` (Security Headers slide)
```json
{ "allowOrigin": "*", "isWildcard": true, "hasCredentialsWithWildcard": false }
```

## `findings.indexedDB` (Storage Analysis)
```json
{ "preConsent": [{"name": "firebaseLocalStorage", "version": 1}], "postConsent": [] }
```
Report in `storageAnalysis` markdown if pre-consent databases exist.

## `findings.fingerprinting` (API Interception Heatmap slide)
```json
{
  "detected": true,
  "preConsent": true,
  "severity": "high",
  "apiCalls": [
    { "api": "WebGL", "method": "getExtension(WEBGL_debug_renderer_info)", "count": 1, "preConsent": true },
    { "api": "Canvas", "method": "toDataURL", "count": 3, "preConsent": false }
  ],
  "callerDomains": ["cdn.example.com"]
}
```
- **`apiCalls`** (REQUIRED for heatmap bars): array of API interceptions. Each has `api`, `method`, `count`, optional `preConsent`. The generator also accepts `apis` as an alias. **DO NOT use `methods`** (string array) — the generator reads `fp.apiCalls || fp.apis`, not `fp.methods`.
- String arrays are also accepted (`apiCalls: ["Canvas.toDataURL", "WebGL.getParameter"]`) but objects with `count` render better bars.
- `severity`: `"none"` | `"low"` | `"medium"` | `"high"` — controls dot color and badge. Defaults to `"medium"`.
- `preConsent`: top-level boolean AND per-apiCall boolean — per-call overrides top-level for bar coloring (red=pre, yellow=post).

## `findings.formLeakage` (Form Leakage slide)
```json
{ "detected": true, "leaks": [{ "field": "email", "destination": "analytics.google.com" }] }
```
- `detected`: boolean -- set `true` only when form fields are confirmed exfiltrated before submission
- `leaks`: array of `{ field, destination }` pairs
- Add `"formLeakage"` to `slides.include` when `formLeakage.detected` is `true`
- **Not in default slideOrder** -- opt-in only
