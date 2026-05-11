# Fingerprinting Detection Expansion — Design Spec

**Status:** Draft for review
**Date:** 2026-04-23
**Owner:** Gijs Jansen (datagobes.dev privacy scanner)
**Companion specs (separate, to follow):** PDF generator + private-appendix model; browsing intelligence (collapsible expansion); cookie appendix + 1st/3rd-party split; legal-analysis precision (adequacy check, EDPB taxonomy, per-tracker Art. 6); evidence-screenshot slide.

## Goal

Expand the privacy scanner's fingerprinting detection to cover all JavaScript-detectable techniques documented in the `privacy-wiki/concepts/fingerprinting-*.md` reference set, while preserving today's low false-positive discipline. Output a tiered, caller-attributed, scoring-aware data structure that the LLM analyst can annotate with legal-basis context and that downstream renderers (HTML deck + future PDF) consume.

## Non-goals

- Network-layer fingerprinting detection (TLS JA3/JA4, HTTP/3 QUIC, IP TTL, BGP/ASN). These are documented as out-of-scope caveats; not in scanner scope.
- CSS timing-attack detection. Indistinguishable from legitimate rendering measurement.
- Worker-internal canvas readback observation. Detected indirectly via `OffscreenCanvas` + `Worker.postMessage` transfer pattern; the readback itself is not main-thread visible.
- A new PDF generator. Separate spec — this design only ensures the data fields it will need are present.
- The other improvement themes from the 2026-04-23 review (collapsible expansion, cookie appendix, evidence slide, legal-precision items) — separate specs.

## Background

Current detection (in `scripts/scan.js` `addInitScript` block, lines ~601-762):
- Canvas: `toDataURL` / `getImageData` on canvases ≤16px or hidden
- WebGL/WebGL2: `getParameter` for hardware params (VENDOR/RENDERER/UNMASKED_*) + `getExtension('WEBGL_debug_renderer_info')`
- AudioContext: `OfflineAudioContext` constructor
- Battery: `getBattery`
- Fonts: `document.fonts.check` after >20 calls
- WebRTC: `RTCPeerConnection` constructor
- Media devices: `enumerateDevices()`
- Navigator: `deviceMemory` only

Output today: `findings.fingerprinting.{detected, preConsent, severity, apiCalls[], callerDomains[]}`. Single binary `−20` scoring modifier when `preConsent === true`.

Wiki-documented vectors not currently caught: WebGPU, OffscreenCanvas + Worker pattern, online AudioContext (createAnalyser/createScriptProcessor/AudioWorkletNode), `getShaderPrecisionFormat`, `userAgentData.getHighEntropyValues`, FP-class `matchMedia` queries, `navigator.connection`, `screen.colorDepth/pixelDepth/availWidth/availHeight`, `document.fonts.values()` iteration, canvas `measureText` font probing, full-size text-only canvases (commercial FPs use 280×40 visible-but-hidden), html2canvas library, `hardwareConcurrency`, `platform`, `maxTouchPoints`, `pdfViewerEnabled`.

Nuno Assis (former data director, privacy-affecionado reviewer) feedback emphasised: "The legal conclusions need more nuance to hold up when a knowledgeable DPO reads them … per-tracker Art. 6 analysis is needed; Riskified can plausibly claim Art. 6(1)(f) for fraud prevention even if the same argument fails for marketing pixels." This spec includes a per-caller `legitimateBasisClaim` annotation hook the LLM analyst fills from the policy text.

## Architecture

### Tier classification

**Tier 1 — high-confidence hardware probes (always publish)**

| Vector | API | Detection |
|---|---|---|
| Canvas (tiny/hidden) | `HTMLCanvasElement.prototype.toDataURL`, `CanvasRenderingContext2D.prototype.getImageData` | Existing logic — keep |
| Canvas (text-only, any size, never displayed) | Same APIs | New filter: track `fillText`/`strokeText` calls per canvas; if a canvas has only text operations and is never inserted into DOM AND `toDataURL`/`getImageData` is called → flag |
| Canvas font enumeration | `CanvasRenderingContext2D.prototype.measureText` | New: count per context; >20 calls in a 5-second window → flag |
| OffscreenCanvas | `OffscreenCanvas` constructor, `getContext('2d')` | New: wrap constructor |
| Worker postMessage with canvas transfer | `Worker.prototype.postMessage` | New: inspect `transferList` arg for `OffscreenCanvas` instances; flag |
| WebGL hardware params | `getParameter(VENDOR/RENDERER/UNMASKED_*)`, `getExtension('WEBGL_debug_renderer_info')` | Existing — keep |
| WebGL shader precision | `getShaderPrecisionFormat` | New: wrap method |
| WebGPU adapter info | `navigator.gpu.requestAdapter()`, `adapter.info` access | New: wrap `Object.getOwnPropertyDescriptor(GPU.prototype, 'requestAdapter')` and the returned adapter's `info` getter |
| OfflineAudioContext | Constructor | Existing — keep |
| Online AudioContext FP pattern | `AudioContext.prototype.createAnalyser` followed by `.createScriptProcessor` connect graph | New: detect the connect-graph pattern, not the individual constructor calls (avoids false positives from media players) |
| AudioWorklet | `AudioWorkletNode` construction | New: wrap |
| `getBattery()` | Existing — keep | |
| `enumerateDevices()` | Existing — keep | |
| `RTCPeerConnection` | Existing — keep | |
| `document.fonts.check()` >20× | Existing — keep | |
| Modern Font Access | `document.fonts.values()`, `.entries()`, `.forEach()` | New: wrap iterator methods |
| `NavigatorUAData.getHighEntropyValues()` | Wrap method on `NavigatorUAData.prototype` | New |

**Tier 2 — medium-entropy contextual signals (publish only when stacked)**

| API | Detection |
|---|---|
| `navigator.deviceMemory` | Existing hook — reclassify as Tier 2 |
| `navigator.hardwareConcurrency` | New: wrap getter |
| `navigator.platform` | New: wrap getter |
| `navigator.maxTouchPoints` | New: wrap getter |
| `navigator.pdfViewerEnabled` | New: wrap getter |
| `navigator.connection.{effectiveType, downlink, rtt}` | New: wrap NetworkInformation getters |
| `screen.colorDepth`, `screen.pixelDepth`, `screen.availWidth/availHeight` | New: wrap Screen.prototype getters |
| FP-class `matchMedia` queries — patterns matching `(color-gamut: …)`, `(dynamic-range: …)`, `(resolution: ≥2dppx)` | New: wrap `window.matchMedia`; classify query string against allowlist |
| `document.fonts.size` / `document.fonts.ready` access | New: wrap getters |

**Tier 3 — low-entropy / commonly-legitimate (private appendix only)**

| API |
|---|
| `navigator.language`, `navigator.languages` |
| `navigator.cookieEnabled`, `navigator.doNotTrack` |
| `screen.width`, `screen.height`, `devicePixelRatio` |
| `navigator.userAgent` access |
| Single non-FP-class `matchMedia` queries |
| `navigator.storage.estimate()` |
| `caches.keys()` |

**Out of scope (document, do not detect)**

- TLS JA3/JA4 fingerprinting
- HTTP/3 / QUIC connection IDs
- IP TTL / TCP window kernel fingerprints
- BGP / ASN external observation
- CSS timing attacks
- Plain `new AudioContext()` without the analyser-script-processor pattern (legitimate media use)

These are surfaced in `findings.fingerprinting.outOfScopeCaveats[]` so the deck footer and PDF appendix can quote them verbatim.

### Caller-domain attribution

Each FP call captures `callerUrl` from `(new Error()).stack` (existing mechanism). Extract `callerDomain = hostname` of the script URL in the relevant stack frame.

Edge cases:
- Inline scripts on the first-party page → `callerDomain = first-party host`
- Scripts injected by GTM → `callerDomain = the actual script's CDN`, not GTM (stack trace shows executed code, not loader)
- Workers created from blob URLs → `callerDomain = "<inline-blob>"`; stack-walking to find the blob's creator is out of scope (marginal value)
- Empty stack trace (rare browser quirk) → bucket as `"<unknown>"`; excluded from stacking decisions

### Stacking algorithm

Run after all variants complete. For each `callerDomain D`:

```
T1 = count of Tier-1 calls from D
T2 = count of Tier-2 calls from D
distinctT2 = number of distinct Tier-2 APIs from D

if T1 >= 1:
  publish all D's Tier-1 calls
  publish all D's Tier-2 calls (corroboration)
  verdict = "active fingerprinting"
elif T2 >= 4 AND distinctT2 >= 3:
  publish D's Tier-2 calls
  verdict = "probable fingerprinting"
else:
  move D's Tier-2 calls to tier3Appendix
  no public surface
```

Tier 3 calls always go to `tier3Appendix[]` regardless of count or stacking.

### Output schema (extends `findings.fingerprinting`)

```json
"findings.fingerprinting": {
  "detected": true,
  "preConsent": true,
  "severity": "high",

  "tier1Calls": [
    {
      "api": "Canvas",
      "method": "toDataURL",
      "count": 3,
      "callerDomain": "www.dyson.nl",
      "callerUrl": "https://www.dyson.nl/...:line 10",
      "preConsent": true,
      "inWorker": false,
      "firstSeenAt": "t+1.5s"
    }
  ],

  "tier2Calls": [
    {
      "api": "Navigator",
      "method": "deviceMemory",
      "count": 1,
      "callerDomain": "www.dyson.nl",
      "preConsent": true
    }
  ],

  "stackedSignals": [
    {
      "callerDomain": "www.dyson.nl",
      "verdict": "active fingerprinting",
      "tier1Count": 16,
      "tier2Count": 4,
      "apis": ["WebGL.getParameter", "WebGL.getExtension(...)", "Canvas.toDataURL", "Navigator.deviceMemory"],
      "preConsent": true,
      "rationale": null,
      "legitimateBasisClaim": null,
      "purposeDisclosed": null
    }
  ],

  "commercialSdks": [
    {
      "name": "Riskified",
      "domains": ["beacon.riskified.com"],
      "legitimateBasisClaim": null,
      "purposeDisclosed": null
    }
  ],

  "callerDomains": ["www.dyson.nl", "beacon.riskified.com"],

  "tier3Appendix": [
    {
      "api": "Navigator",
      "method": "language",
      "count": 1,
      "callerDomain": "www.dyson.nl"
    }
  ],

  "outOfScopeCaveats": [
    "Network-layer fingerprinting (TLS JA3/JA4, HTTP/3 QUIC, IP TTL) is not detectable by JavaScript instrumentation. Sites may use these techniques.",
    "CSS timing attacks are indistinguishable from legitimate rendering measurements.",
    "Worker-internal canvas readbacks are detected indirectly (via OffscreenCanvas postMessage transfers); the readback itself is not visible from the main thread."
  ],

  "apiCalls": []
}
```

`apiCalls[]` (existing field) is retained for backwards compatibility. New scans populate both `apiCalls[]` and the new `tier1Calls[] / tier2Calls[]` arrays. Legacy field is duplicate data — the deprecation cost is one redundant array per scan, the deprecation risk is breaking re-renders of pre-rebalance scans, so it stays indefinitely.

The `rationale`, `legitimateBasisClaim`, and `purposeDisclosed` fields on `stackedSignals[]` and `commercialSdks[]` start `null` from the scanner; the LLM analyst fills them by reading `summary.legalPageContent.privacyPolicy`. The scanner does only what is deterministic; legal interpretation stays in the LLM step.

### Scoring

Replace the current binary `−20` modifier in scoring.md's Pre-Consent Tracking section with:

```
For each entry in stackedSignals where preConsent is true:
  - verdict "active fingerprinting": -10
  - verdict "probable fingerprinting": -5
Capped at -20 total (preserves today's cap so scores remain comparable).
```

New modifier on the overall score (not Pre-Consent category — applies independently):

```
For each commercialSdk entry where (purposeDisclosed === false OR legitimateBasisClaim === null):
  -15 from overall score
```

This stacks outside the Pre-Consent Tracking cap because commercial fingerprinting SDKs are inherently identification networks — a different class of finding than "this site happens to read WebGL parameters."

When `purposeDisclosed === true` and `legitimateBasisClaim` is non-null, no SDK penalty fires. The deck still shows the SDK was detected (with the disclosed legitimate basis as a callout) — the finding is not suppressed, but the framing shifts from violation to disclosure.

### Slide changes (public deck)

The existing `Fingerprinting Detection` slide is rebuilt with three sections:

1. **Active fingerprinting by domain** (new headline). One card per `stackedSignals` entry. Card shows: caller domain, verdict badge ("Active" / "Probable"), Tier 1 / Tier 2 counts, the rationale sentence, and the legitimate-basis annotation when present. Pre-consent entries get a red severity stripe.
2. **API call detail** (kept). Heatmap-style breakdown of actual calls. Color-code Tier 1 (red) vs Tier 2 (amber). Tier 3 omitted.
3. **Footer caveat** (new). One line: "Network-layer fingerprinting (TLS, QUIC) is not JavaScript-detectable. See methodology."

Backwards-compatible degradation: when `stackedSignals` is missing (old scans), the slide falls back to the current `apiCalls[]` heatmap rendering.

### Private appendix (data plumbing — full PDF rendering is a separate spec)

Two appendix sections rendered behind a `--include-private-appendix` flag in `generate.js`:
- `tier3Appendix` — informational signals that didn't meet stacking
- `outOfScopeCaveats` — full prose

Default off for the public HTML deck. The future PDF generator (separate spec) will set this flag.

The private appendix is **not uploaded** to Supabase Storage on publish. It exists on local disk and in the LLM analysis JSON, for the DPO PDF only.

### Worker / OffscreenCanvas detection mechanism

Two complementary hooks, both on the main thread:

1. Wrap `OffscreenCanvas` constructor: log instantiation. Captures the entry into worker-based FP.
2. Wrap `Worker.prototype.postMessage`: inspect the `transfer` argument; if any element is an `OffscreenCanvas` instance → flag. Captures the transfer-to-worker step.

`inWorker: true` is set on calls captured this way. The actual readback (in worker context) cannot be observed from the main thread; documented as a caveat.

## Components

### `scripts/scan.js` — `addInitScript` block (~lines 601-762)

The init script gets new wrapped APIs grouped by tier. Pseudocode shape:

```js
window.__fpCalls = [];

const TIER1 = "tier1";
const TIER2 = "tier2";
const TIER3 = "tier3";

function logFP(api, method, tier) {
  try {
    const stack = (new Error()).stack || "";
    const callerLine = stack.split("\n")[2]?.trim() || "";
    window.__fpCalls.push({
      api, method, tier,
      timestamp: Date.now(),
      callerUrl: callerLine.substring(0, 200),
      inWorker: typeof importScripts !== "undefined",
    });
  } catch {}
}

// Tier 1 hooks (existing + new)
// Tier 2 hooks (existing deviceMemory + new)
// Tier 3 hooks (new — log only, never publish)
```

The wrapping pattern follows the existing template: store the original method, replace with a logging wrapper, call original. Errors swallowed so a hook failure never breaks the page.

### `scripts/scan.js` — post-scan aggregation

A new function `aggregateFingerprinting(rawFpCalls)` runs after `collectFingerprintingResult` produces the raw call list. Responsibilities:
1. Extract `callerDomain` from each call's `callerUrl`
2. Bucket calls into `tier1Calls / tier2Calls / tier3Appendix` by tier
3. Per `callerDomain`, count Tier-1 and Tier-2 hits, compute verdict, build `stackedSignals[]` entries
4. Match commercial-SDK domains (existing tracker signature catalog) against detected callers, emit `commercialSdks[]`
5. Emit `outOfScopeCaveats[]` (constant 3-item array)

Output replaces `findings.fingerprinting` building today; legacy `apiCalls[]` populated alongside.

### `scripts/analysis-brief.js` — POLICY ANALYSIS extension

Brief surfaces the new findings in a new section so the LLM analyst sees what to annotate:

```
=== FINGERPRINTING (NEW MODEL) ===
Active fingerprinting domains: 2
  www.dyson.nl: 16 Tier-1 + 4 Tier-2 (active) [pre-consent]
  beacon.riskified.com: 3 Tier-1 (active) [pre-consent] [commercial SDK: Riskified]
Tier 3 informational signals: 47 (private appendix only)
Out-of-scope caveats: 3
```

The brief explicitly cues the analyst to fill `rationale`, `legitimateBasisClaim`, and `purposeDisclosed` from the privacy policy.

### `scripts/validate-analysis.js`

New validation:
- `findings.fingerprinting.stackedSignals[]` (optional): each entry has `callerDomain` (string), `verdict` (enum: `"active fingerprinting" | "probable fingerprinting"`), counts (integers), `apis` (array)
- `findings.fingerprinting.commercialSdks[]` (optional): each entry has `name` (string), `domains` (array)
- `findings.fingerprinting.outOfScopeCaveats[]` (optional)
- Backwards-compat: missing new fields = warning, not error

### `scripts/generate.js` — `buildFingerprinting` rewrite

Replace the current builder with a three-section layout described above. Add `--include-private-appendix` CLI flag handling. New builders for the appendix sections (rendered only when flag is set).

### Reference docs to update

- `references/criteria/fingerprinting.md`: add the new tier table, stacking rule, scoring section
- `references/scoring.md`: replace the binary `−20` modifier description with the new per-domain + commercial-SDK rules
- `references/field-contract.md`: add the new schema entries
- `references/analysis-guide.md`: add a "Fingerprinting analysis" subsection cueing the LLM to fill the annotation fields

## Data flow

```
1. Scanner injects init-script hooks before page load.
2. Page runs; hooks log every matched API call to window.__fpCalls.
3. After all variants complete, scanner calls collectFingerprintingResult()
   → returns raw __fpCalls array.
4. aggregateFingerprinting() runs:
   - extracts callerDomain per call
   - assigns tier (1/2/3) per call
   - buckets into tier1Calls / tier2Calls / tier3Appendix
   - per-domain stacking → stackedSignals[]
   - commercial SDK match → commercialSdks[]
5. Result written to findings.fingerprinting.{...}
6. Scan JSON serialised to /tmp/privacy-scan-*.json.
7. analysis-brief.js surfaces the new section to the LLM.
8. LLM analyst writes /tmp/privacy-analysis-*.json with rationale/legitimateBasisClaim/purposeDisclosed filled.
9. validate-analysis.js checks schema.
10. generate.js renders the deck (public flag → public slide; private flag → adds appendix).
```

## Error handling

- Each init-script hook is wrapped in `try/catch`. A failure in one hook never breaks the page or other hooks.
- Browser API not available (e.g., WebGPU on Firefox): the wrap silently no-ops; nothing logged.
- Empty stack trace: `callerDomain = "<unknown>"`, excluded from stacking but still logged for forensic purposes.
- Worker postMessage with empty transferList: not flagged (no canvas transfer means no FP signal).
- Aggregation failures (malformed callerUrl, JSON serialization issue): logged to scan errors[] array, fingerprinting result falls back to legacy `apiCalls[]` only.

## Testing strategy

1. **Unit-equivalent**: build a fixture HTML page that exercises each tier-1 and tier-2 vector. Run scan, assert each call appears in the right tier bucket and stackedSignals.
2. **Real-site regression**: re-run dyson.com end-to-end. Compare new output to the existing scan. Verify:
   - Existing 16 WebGL hits still detected, now all Tier 1
   - `www.dyson.nl` and `beacon.riskified.com` appear in `stackedSignals[]` as "active fingerprinting"
   - No new false positives from generic responsive `matchMedia` queries
3. **False-positive sweep**: scan 5 known low-FP sites (e.g., wikipedia.org, gov.uk, ec.europa.eu). Assert empty or minimal `stackedSignals[]`.
4. **Validator regression**: run validate on existing test analyses to confirm new fields pass as optional.
5. **Generator regression**: render existing test analysis (without new fields) and confirm slide degrades to legacy heatmap without errors.

## Backwards compatibility

- Legacy `apiCalls[]` field stays. New scans populate both.
- `stackedSignals[]`, `tier1Calls[]`, `tier2Calls[]`, `tier3Appendix[]`, `commercialSdks[]`, `outOfScopeCaveats[]` are optional. Old scans validate.
- Generator falls back to old slide rendering when new fields missing.
- Scoring: old `−20` binary modifier becomes the cap for the new per-domain modifiers; total range unchanged so old scans remain numerically comparable.

## Dependencies on other specs

- **PDF generator + private-appendix model** — consumes `tier3Appendix[]` and `outOfScopeCaveats[]`. This spec produces those fields; PDF spec consumes them.
- **Browsing intelligence (collapsible expansion)** — independent. Improves policy text quality, which improves the LLM's `legitimateBasisClaim` annotations, but no schema dependency.
- **Cookie appendix + 1st/3rd-party split** — independent.
- **Legal-precision items** (adequacy check, EDPB taxonomy mapping, per-tracker Art. 6) — partially overlaps. The per-tracker Art. 6 work in that spec applies the same `legitimateBasisClaim` pattern this spec introduces for fingerprinting, to all third-party trackers. Same field shape, different trigger surface.
- **Evidence screenshot slide** — independent.

## Open questions

None. All section-1, -2, -3 design decisions confirmed during brainstorming on 2026-04-23.

## Implementation phases (high-level — full plan in writing-plans skill)

1. Init-script hook additions (Tier 1 then Tier 2 then Tier 3)
2. Caller-domain extraction + per-call tier tagging
3. Aggregation function (`stackedSignals`, `commercialSdks`)
4. Field-contract + validator updates
5. Scoring.md modifier rewrite
6. analysis-brief.js extension
7. generate.js — fingerprinting slide rebuild + `--include-private-appendix` flag
8. Reference doc updates (criteria/fingerprinting.md, analysis-guide.md, field-contract.md)
9. Test pass: dyson.com regression + 5-site false-positive sweep
