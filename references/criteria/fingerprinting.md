# Criterion: Fingerprinting

## What the Scanner Checks
Whether the site uses browser/device fingerprinting to identify or track users without consent. The scanner intercepts JavaScript API calls known for fingerprinting (Canvas, WebGL, AudioContext, navigator) and detects commercial fingerprinting SDKs by network signatures.

## Legal Basis
- **ePrivacy Directive Art. 5(3)** — Storage of or **access to** information stored in terminal equipment requires consent. Fingerprinting accesses device-level info — directly in scope.
- **GDPR Art. 4(11)** — A persistent re-identifiable record tied to an individual is personal data
- **GDPR Art. 6** — No valid legal basis = unlawful processing
- **GDPR Art. 32** — Appropriate technical measures (fingerprinting-resistance)
- **EDPB Guidelines 2/2023 on the technical scope of Art. 5(3)** — Explicitly confirms fingerprinting falls under Art. 5(3) and requires consent

## Why Fingerprinting Always Requires Consent
The "strictly necessary" Art. 5(3) exemption does not apply because:
1. Fingerprinting is not necessary to deliver the service the user requested — it's tracking
2. CJEU Planet49 (C-673/17) requires consent exemptions to be narrowly construed
3. A webpage can render without fingerprinting; a session cookie cannot be "substituted" by fingerprinting

## Two Classes

### Active / JavaScript-Level (scanner detects)

| API | What It Reveals | Entropy |
|---|---|---|
| `CanvasRenderingContext2D.toDataURL()` | GPU/renderer rendering differences | High |
| `WebGLRenderingContext.getParameter()` (`UNMASKED_VENDOR_WEBGL`, `UNMASKED_RENDERER_WEBGL`) | GPU vendor, renderer, driver | High |
| `navigator.gpu` (WebGPU) | GPU model, architecture, driver | Very High |
| `AudioContext` analyser | Audio hardware fingerprint | High |
| `navigator.hardwareConcurrency` | CPU core count | Medium |
| `navigator.deviceMemory` | RAM amount | Medium |
| `Battery Status API` | Battery level/charging time | Medium |
| `NavigatorUAData` (UA Client Hints) | Brand, model, platform version | Medium |
| Font enumeration via canvas measurement | Installed fonts | Medium |
| `screen` properties | Resolution, color depth, pixel ratio | Low–Medium |
| `document.fonts` (Font Access API) | Detailed font enumeration | High |
| `color-gamut`, `dynamic-range` CSS media | HDR display support | Medium |

### Passive / Network-Level (scanner CANNOT detect)
- **TLS JA3/JA4 fingerprints** — passive observation of TLS Client Hello
- **HTTP/3 / QUIC connection IDs** — UDP transport tracking
- **IP/TCP fingerprinting** — OS-level TCP stack signatures
- **BGP/ASN correlation** — IP-range to network infrastructure mapping

Note this caveat in any report — sites using TLS or QUIC fingerprinting will not trigger scanner alerts.

## Severity Classification

| Severity | Scenario |
|---|---|
| Critical | Fingerprint hash exfiltrated to identity-linkage networks (TransUnion, Experian, Equifax) |
| High | Commercial fingerprinting SDK loaded (Fingerprint Pro, SEON, Sift, Arkose, Accertify) without consent |
| Medium | Canvas / WebGL / AudioContext API calls detected pre-consent |
| Low | API anomalies suggesting possible fingerprinting; needs manual review |

## Commercial Services Detected

| Service | Detection signature | Risk |
|---|---|---|
| Fingerprint Pro (FingerprintJS) | `fpjs.io`, `api.fpjs.io`, `window.Fingerprint` | High — cross-site persistent tracking |
| SEON | `seon.io`, `window.SEON` | High — device-to-identity linkage |
| Sift | `sift.com`, `window.sift` | High — fraud detection + profiling |
| Arkose Labs | `arkoselabs.com`, `window.arkose` | Medium — anti-bot, persistent |
| Accertify | `accertify.com`, `window.accertify` | Medium — identity verification |
| TransUnion / Experian | Outbound to `transunion.com`, `experian.com` | Critical — identity confirmation network |

## Pre-Consent Fingerprinting = Aggravating Factor
Treat as the most severe form of pre-consent tracking. Apply **−20** modifier on the pre-consent-tracking score (already baked into scoring.md). EDPB has stated pre-consent fingerprinting is a serious aggravated violation.

## Verified Enforcement

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| Clearview AI (ETid-1098 / 1268 / 1448) | Garante IT 2022-02-10, HDPA GR 2022-07-13, CNIL FR 2022-10-17 | €20M each | Biometric/dataset fingerprinting for identification — Art. 9 + Art. 5(1)(a) |
| Clearview AI (ETid-2448) | AP Netherlands, 2024-05-16 | €30.5M | Same pattern, larger scope |
| Clearview AI (UK ICO, ETid-1190) | ICO UK, 2022-05-18 | €9M | Facial recognition + Art. 17 erasure failure |
| Meta Platforms Inc. (ETid-1373) | DPC Ireland, 2022-09-05 | €405M | Systemic profiling via pixel + login data |

**EDPB Guidelines 2/2023 on Art. 5(3)** — landmark guidance: fingerprinting requires consent; the "strictly necessary" exemption is narrowly construed.

## Tiered Detection Model (2026-04 expansion)

Every detected API call is bucketed into one of three tiers based on entropy contribution and false-positive risk.

**Tier 1 — high-confidence hardware probes (always published).** Canvas (`toDataURL`/`getImageData` on tiny/hidden OR text-only-undisplayed canvases; `measureText` >20× in 5s), OffscreenCanvas + Worker postMessage, WebGL/WebGL2 hardware params + `getShaderPrecisionFormat`, WebGPU `requestAdapter` + `adapter.info`, AudioContext (`OfflineAudioContext`, `createAnalyser`+`createScriptProcessor` graph, `AudioWorkletNode`), `getBattery`, `enumerateDevices`, `RTCPeerConnection`, `document.fonts.check >20×` + `.values/.entries/.forEach`, `NavigatorUAData.getHighEntropyValues`.

**Tier 2 — medium-entropy (published only when stacked with ≥1 Tier 1 from same caller, OR ≥4 hits across ≥3 distinct APIs).** `navigator.{deviceMemory, hardwareConcurrency, platform, maxTouchPoints, pdfViewerEnabled}`, `navigator.connection.{effectiveType,downlink,rtt}`, `screen.{colorDepth,pixelDepth,availWidth,availHeight}`, FP-class `matchMedia` queries (`color-gamut`, `dynamic-range`, `resolution: ≥2dppx`), `document.fonts.size`.

**Tier 3 — low-entropy / commonly-legitimate (private appendix only).** `navigator.{language,languages,cookieEnabled,doNotTrack}`, `screen.{width,height}`, `navigator.storage.estimate()`, `caches.keys()`.

## Stacking Algorithm

Per `callerDomain D`:
- `T1 ≥ 1` → verdict `"active fingerprinting"` — all D's Tier 1 + Tier 2 calls published
- `T2 ≥ 4 AND distinct APIs ≥ 3` (no T1) → verdict `"probable fingerprinting"` — D's Tier 2 published
- Otherwise → D's Tier 2 demoted to `tier3Appendix[]`

For each `stackedSignals[]` entry, the LLM analyst fills `rationale`, `legitimateBasisClaim`, and `purposeDisclosed` by reading the privacy policy. Per-tracker Art. 6 nuance: Riskified for fraud prevention has a plausible Art. 6(1)(f) argument; Adobe Target for A/B testing does not.

## Out of Scope (Documented, Not Detected)

- TLS JA3/JA4 (network layer, no JS visibility)
- HTTP/3 / QUIC connection IDs (transport layer)
- IP TTL / TCP window kernel fingerprints
- BGP / ASN external observation
- CSS timing attacks (indistinguishable from legitimate timing)

These are surfaced verbatim in `findings.fingerprinting.outOfScopeCaveats[]`.

## Scanner Output Fields (see field-contract.md)
```json
{
  "findings.fingerprinting": {
    "detected": true,
    "preConsent": true,
    "severity": "high",
    "apiCalls": [
      { "api": "Canvas", "method": "toDataURL", "count": 3, "preConsent": true },
      { "api": "WebGL", "method": "getParameter(WEBGL_debug_renderer_info)", "count": 1, "preConsent": true }
    ],
    "callerDomains": ["cdn.example.com"],
    "commercialSdks": ["Fingerprint Pro"]
  }
}
```

## Scoring Impact (replaces the binary `−20` modifier as of 2026-04)

For each `stackedSignals[]` entry where `preConsent: true`:
- verdict `"active fingerprinting"`: −10
- verdict `"probable fingerprinting"`: −5

Capped at −20 total (preserves the prior cap so scores remain comparable to old scans).

Commercial SDK modifier (independent, applied to overall score):
- For each `commercialSdks[]` entry where `purposeDisclosed === false` OR `legitimateBasisClaim === null`: −15 (stacks outside the −20 pre-consent cap because commercial FP SDKs are inherently identification networks).
- When both `purposeDisclosed === true` AND `legitimateBasisClaim` is non-null: no penalty; the SDK is still surfaced as a disclosed-purpose finding rather than a violation.

When commercial SDK detected, also escalate DPIA criterion (Art. 35(1) systematic profiling trigger).
