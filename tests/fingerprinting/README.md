# Fingerprinting Detection Test Fixture

End-to-end test for the tiered fingerprinting detection added in 2026-04.

## Run

```bash
# From the repo root
node tests/fingerprinting/run-fixture.js
```

Starts a local HTTP server on a random port, serves `fixture.html`, runs the
scanner against it, and asserts that:

- Every Tier 1 vector is detected and bucketed into `tier1Calls[]`
- Tier 2 vectors are stacked (since the fixture has Tier 1 hits from the same
  caller, all Tier 2 hits should be promoted)
- Tier 3 vectors (navigator.language etc.) appear in `tier3Appendix[]` only
- `stackedSignals[]` contains an "active fingerprinting" verdict for the fixture
- `outOfScopeCaveats[]` contains the 3 documented caveats

Exit code 0 = pass, 1 = fail.

## What each fixture script section exercises

| Section | Vectors |
|---|---|
| Canvas (text-only hidden) | toDataURL on a 280×40 text canvas never in DOM |
| Canvas measureText | font enumeration via >20 measureText calls |
| WebGL | getParameter (VENDOR/RENDERER), getExtension(debug_renderer_info), getShaderPrecisionFormat |
| AudioContext | OfflineAudioContext + AnalyserNode→ScriptProcessor graph |
| OffscreenCanvas + Worker | constructor + Worker.postMessage transfer |
| WebRTC + enumerateDevices + Battery | constructor / method calls |
| getHighEntropyValues | UA Client Hints |
| Navigator + Screen + matchMedia | Tier 2 hardware/screen/CSS-FP-query reads |
| Tier 3 controls | navigator.language, cookieEnabled, screen.width |
