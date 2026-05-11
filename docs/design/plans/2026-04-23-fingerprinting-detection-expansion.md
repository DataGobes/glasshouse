# Fingerprinting Detection Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the privacy scanner's fingerprinting detection to cover all JavaScript-detectable techniques in the privacy-wiki, with tiered classification, caller-domain stacking, per-caller legitimate-basis annotation, and a private-appendix data path.

**Architecture:** Extend the existing `addInitScript` block in `scripts/scan.js` with new wrapped APIs grouped by Tier 1 / Tier 2 / Tier 3. After scan, aggregate raw calls per caller-domain, compute stacking verdicts, emit a new `findings.fingerprinting` schema with `tier1Calls / tier2Calls / stackedSignals / commercialSdks / tier3Appendix / outOfScopeCaveats`. Update analysis-brief, validator, generator slide, and scoring rules. Maintain backwards compatibility by keeping the legacy `apiCalls[]` field and degrading the slide gracefully when new fields are absent.

**Tech Stack:** Node.js, Playwright (Firefox), pure-JS init scripts, no existing test framework — verification via end-to-end scan of a local fixture page.

**Spec:** [docs/design/specs/2026-04-23-fingerprinting-detection-expansion-design.md](../specs/2026-04-23-fingerprinting-detection-expansion-design.md)

---

## File Structure

**Modify:**
- `scripts/scan.js` — init-script hooks, post-scan aggregation, output wiring (~lines 586-762 init script; new function `aggregateFingerprinting`; integration in `buildSummary`)
- `scripts/analysis-brief.js` — new "FINGERPRINTING (NEW MODEL)" section after current FINGERPRINTING block
- `scripts/validate-analysis.js` — new optional-field validations for `stackedSignals` / `commercialSdks` / `outOfScopeCaveats`
- `scripts/generate.js` — rewrite `buildFingerprinting`, add `--include-private-appendix` flag and two appendix builders
- `references/criteria/fingerprinting.md` — replace API table with tier table, add stacking rule + scoring section
- `references/scoring.md` — replace pre-consent fingerprinting binary modifier with per-domain rules; add commercial-SDK modifier
- `references/field-contract.md` — add new schema entries under `findings.fingerprinting`
- `references/analysis-guide.md` — add "Fingerprinting analysis" subsection cueing the LLM to fill annotation fields

**Create:**
- `tests/fingerprinting/fixture.html` — self-contained HTML page that exercises every Tier 1 + Tier 2 + Tier 3 vector
- `tests/fingerprinting/run-fixture.js` — Node script: serve fixture, run scanner against it, assert expected output structure
- `tests/fingerprinting/expected.json` — golden output excerpt for the fixture
- `tests/fingerprinting/README.md` — how to run the test, what each fixture call exercises

---

## Task Breakdown

### Task 1: Tier classification constants + logFP refactor

**Files:**
- Modify: `scripts/scan.js:586-614`

- [ ] **Step 1: Add tier constants and refactor logFP signature**

Locate the `addInitScript` block at line 586-614. Replace the existing `logFP` definition with a tier-aware version. The existing function:

```js
window.__fpCalls = [];
const logFP = (api, method) => {
  try {
    window.__fpCalls.push({
      api,
      method,
      timestamp: Date.now(),
      callerUrl: (new Error()).stack?.split("\n")[2]?.trim()?.substring(0, 200) || "",
    });
  } catch { }
};
```

Replace with:

```js
window.__fpCalls = [];
const TIER1 = "tier1";
const TIER2 = "tier2";
const TIER3 = "tier3";
const logFP = (api, method, tier) => {
  try {
    window.__fpCalls.push({
      api,
      method,
      tier: tier || TIER1,
      timestamp: Date.now(),
      callerUrl: (new Error()).stack?.split("\n")[2]?.trim()?.substring(0, 200) || "",
      inWorker: typeof importScripts !== "undefined",
    });
  } catch { }
};
```

The default `tier || TIER1` keeps existing call sites working while we update them in subsequent tasks.

- [ ] **Step 2: Update existing hook call sites to pass tier explicitly**

Find every `logFP(...)` call in the existing block (Canvas, WebGL, OfflineAudioContext, Battery, fonts, WebRTC, MediaDevices, Navigator deviceMemory). Add `TIER1` as the third argument to each EXCEPT `Navigator.deviceMemory` which gets `TIER2`. Examples:

```js
// Before
if (isFpCanvas(this)) logFP("Canvas", "toDataURL");
// After
if (isFpCanvas(this)) logFP("Canvas", "toDataURL", TIER1);

// Before
logFP("Navigator", "deviceMemory");
// After
logFP("Navigator", "deviceMemory", TIER2);
```

Touch every existing hook. There are 11 call sites in lines 627-761.

- [ ] **Step 3: Verify no syntax regression**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node --check scripts/scan.js`
Expected: clean exit, no output.

- [ ] **Step 4: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add scripts/scan.js
git commit -m "refactor(fingerprinting): add tier classification to logFP"
```

---

### Task 2: Tier 1 hook additions — Canvas measureText + text-only canvas filter

**Files:**
- Modify: `scripts/scan.js:619-637` (canvas hook block)

- [ ] **Step 1: Extend the canvas hook with measureText counter and text-only tracking**

Replace the existing canvas block (lines 619-637, the `try { const isFpCanvas = ...` block through to its closing `} catch { }`):

```js
// Canvas fingerprinting
// Three triggers, all Tier 1:
//   (a) toDataURL/getImageData on tiny/hidden canvases (existing behavior)
//   (b) toDataURL/getImageData on text-only canvases never inserted into DOM
//       (commercial FPs use 280x40 visible-but-hidden canvases — existing
//        16px filter misses them)
//   (c) measureText called >20 times in a 5s window on the same context
//       (font enumeration via canvas)
try {
  const canvasMeta = new WeakMap(); // canvas -> {textOnly, inserted, measureCount, measureWindowStart}
  const getMeta = (canvas) => {
    let m = canvasMeta.get(canvas);
    if (!m) {
      m = { textOnly: true, hasNonText: false, measureCount: 0, measureWindowStart: Date.now() };
      canvasMeta.set(canvas, m);
    }
    return m;
  };

  const isFpCanvas = (canvas) => {
    if (!canvas) return false;
    if (canvas.width <= 16 || canvas.height <= 16) return true;
    const s = canvas.style;
    if (s && (s.display === "none" || s.visibility === "hidden")) return true;
    return false;
  };

  const isTextOnlyHidden = (canvas) => {
    if (!canvas) return false;
    const m = canvasMeta.get(canvas);
    if (!m) return false;
    // Text-only AND never inserted into DOM
    return m.textOnly && !canvas.isConnected;
  };

  // Track which canvases have non-text drawing operations
  const wrapNonText = (proto, methodName) => {
    if (!proto[methodName]) return;
    const orig = proto[methodName];
    proto[methodName] = function (...args) {
      try {
        const m = getMeta(this.canvas);
        m.hasNonText = true;
        m.textOnly = false;
      } catch { }
      return orig.apply(this, args);
    };
  };
  wrapNonText(CanvasRenderingContext2D.prototype, "drawImage");
  wrapNonText(CanvasRenderingContext2D.prototype, "putImageData");
  wrapNonText(CanvasRenderingContext2D.prototype, "fill");
  wrapNonText(CanvasRenderingContext2D.prototype, "stroke");

  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...args) {
    if (isFpCanvas(this) || isTextOnlyHidden(this)) logFP("Canvas", "toDataURL", TIER1);
    return origToDataURL.apply(this, args);
  };
  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function (...args) {
    if (isFpCanvas(this.canvas) || isTextOnlyHidden(this.canvas)) logFP("Canvas", "getImageData", TIER1);
    return origGetImageData.apply(this, args);
  };

  // measureText font-probing detection
  const origMeasureText = CanvasRenderingContext2D.prototype.measureText;
  CanvasRenderingContext2D.prototype.measureText = function (...args) {
    try {
      const m = getMeta(this.canvas);
      const now = Date.now();
      if (now - m.measureWindowStart > 5000) {
        m.measureCount = 0;
        m.measureWindowStart = now;
      }
      m.measureCount++;
      if (m.measureCount === 21) {
        logFP("Canvas", "measureText (font enumeration, >20 calls in 5s)", TIER1);
      }
    } catch { }
    return origMeasureText.apply(this, args);
  };
} catch { }
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node --check scripts/scan.js`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add scripts/scan.js
git commit -m "feat(fingerprinting): detect canvas measureText font probing + text-only hidden canvases"
```

---

### Task 3: Tier 1 hook additions — OffscreenCanvas + Worker postMessage

**Files:**
- Modify: `scripts/scan.js` (insert new block after the canvas hooks, before the WebGL hooks)

- [ ] **Step 1: Add OffscreenCanvas + Worker hooks**

After the canvas hook block (the one ending right before `// WebGL fingerprinting`), insert:

```js
// OffscreenCanvas + Worker postMessage fingerprinting
// Worker-based canvas FP bypasses main-thread toDataURL/getImageData hooks.
// We detect the entry pattern: OffscreenCanvas creation + Worker.postMessage
// with the OffscreenCanvas in the transfer list.
try {
  if (typeof OffscreenCanvas !== "undefined") {
    const OrigOC = OffscreenCanvas;
    window.OffscreenCanvas = function (...args) {
      logFP("OffscreenCanvas", "constructor", TIER1);
      return new OrigOC(...args);
    };
    window.OffscreenCanvas.prototype = OrigOC.prototype;
  }
} catch { }

try {
  if (typeof Worker !== "undefined") {
    const origPostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, transferOrOptions) {
      try {
        let transferList = null;
        if (Array.isArray(transferOrOptions)) {
          transferList = transferOrOptions;
        } else if (transferOrOptions && Array.isArray(transferOrOptions.transfer)) {
          transferList = transferOrOptions.transfer;
        }
        if (transferList && typeof OffscreenCanvas !== "undefined") {
          for (const item of transferList) {
            if (item instanceof OffscreenCanvas) {
              logFP("Worker", "postMessage(OffscreenCanvas transfer)", TIER1);
              break;
            }
          }
        }
      } catch { }
      return origPostMessage.apply(this, arguments);
    };
  }
} catch { }
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node --check scripts/scan.js`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add scripts/scan.js
git commit -m "feat(fingerprinting): detect OffscreenCanvas + Worker canvas-transfer pattern"
```

---

### Task 4: Tier 1 hook additions — WebGL getShaderPrecisionFormat + WebGPU

**Files:**
- Modify: `scripts/scan.js` (extend the WebGL hook block + add WebGPU block)

- [ ] **Step 1: Add getShaderPrecisionFormat to existing wrapGL function**

Locate the `wrapGL` function (lines ~651-664). Inside `wrapGL`, after the existing `getExtension` wrap and before its closing `}`, add:

```js
const origGetShaderPrecisionFormat = proto.getShaderPrecisionFormat;
if (origGetShaderPrecisionFormat) {
  proto.getShaderPrecisionFormat = function (...rest) {
    logFP(name, "getShaderPrecisionFormat", TIER1);
    return origGetShaderPrecisionFormat.apply(this, rest);
  };
}
```

- [ ] **Step 2: Add WebGPU hook after the WebGL block**

After the WebGL hook block (after the `if (typeof WebGL2RenderingContext ...) wrapGL(..., "WebGL2");` line and its enclosing `try/catch`), insert:

```js
// WebGPU fingerprinting (next-gen high-entropy vector)
// Wraps navigator.gpu.requestAdapter() and access to adapter.info.
try {
  if (navigator.gpu && typeof navigator.gpu.requestAdapter === "function") {
    const origRequestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter = function (...args) {
      logFP("WebGPU", "requestAdapter", TIER1);
      const promise = origRequestAdapter(...args);
      return promise.then((adapter) => {
        if (adapter) {
          try {
            const proto = Object.getPrototypeOf(adapter);
            const infoDesc = Object.getOwnPropertyDescriptor(proto, "info");
            if (infoDesc && infoDesc.get) {
              Object.defineProperty(adapter, "info", {
                get: function () {
                  logFP("WebGPU", "adapter.info access", TIER1);
                  return infoDesc.get.call(this);
                },
                configurable: true,
              });
            }
          } catch { }
        }
        return adapter;
      });
    };
  }
} catch { }
```

- [ ] **Step 3: Verify syntax**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node --check scripts/scan.js`
Expected: clean exit.

- [ ] **Step 4: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add scripts/scan.js
git commit -m "feat(fingerprinting): detect WebGL shader precision + WebGPU adapter info"
```

---

### Task 5: Tier 1 hook additions — AudioContext extensions

**Files:**
- Modify: `scripts/scan.js` (extend AudioContext block at lines ~669-683)

- [ ] **Step 1: Replace AudioContext block with expanded version**

Locate the `AudioContext fingerprinting` block (lines ~669-683 — the OfflineAudioContext-only block). Replace with:

```js
// AudioContext fingerprinting
// (a) OfflineAudioContext constructor — canonical FP, no legitimate non-media use
// (b) AudioContext.createAnalyser → createScriptProcessor connect graph
//     (the canonical online FP pattern; createOscillator alone has legitimate uses)
// (c) AudioWorkletNode construction — modern FP path
try {
  if (typeof OfflineAudioContext !== "undefined") {
    const OrigOffline = OfflineAudioContext;
    window.OfflineAudioContext = function (...args) {
      logFP("AudioContext", "OfflineAudioContext", TIER1);
      return new OrigOffline(...args);
    };
    window.OfflineAudioContext.prototype = OrigOffline.prototype;
  }
} catch { }

try {
  // Track AnalyserNode + ScriptProcessor created from the same AudioContext
  // and only flag if both are connected (the FP graph pattern).
  const ctxMeta = new WeakMap();
  const getCtxMeta = (ctx) => {
    let m = ctxMeta.get(ctx);
    if (!m) { m = { hasAnalyser: false, hasScriptProcessor: false, flagged: false }; ctxMeta.set(ctx, m); }
    return m;
  };
  const wrapAudioCtx = (proto) => {
    if (!proto) return;
    const origAnalyser = proto.createAnalyser;
    if (origAnalyser) {
      proto.createAnalyser = function (...args) {
        try { getCtxMeta(this).hasAnalyser = true; } catch { }
        return origAnalyser.apply(this, args);
      };
    }
    const origScriptProc = proto.createScriptProcessor;
    if (origScriptProc) {
      proto.createScriptProcessor = function (...args) {
        try {
          const m = getCtxMeta(this);
          m.hasScriptProcessor = true;
          if (m.hasAnalyser && !m.flagged) {
            m.flagged = true;
            logFP("AudioContext", "createAnalyser + createScriptProcessor (FP graph)", TIER1);
          }
        } catch { }
        return origScriptProc.apply(this, args);
      };
    }
  };
  if (typeof AudioContext !== "undefined") wrapAudioCtx(AudioContext.prototype);
  if (typeof OfflineAudioContext !== "undefined") wrapAudioCtx(OfflineAudioContext.prototype);
} catch { }

try {
  if (typeof AudioWorkletNode !== "undefined") {
    const OrigAWN = AudioWorkletNode;
    window.AudioWorkletNode = function (...args) {
      logFP("AudioContext", "AudioWorkletNode", TIER1);
      return new OrigAWN(...args);
    };
    window.AudioWorkletNode.prototype = OrigAWN.prototype;
  }
} catch { }
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node --check scripts/scan.js`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add scripts/scan.js
git commit -m "feat(fingerprinting): detect online AudioContext FP graph + AudioWorklet"
```

---

### Task 6: Tier 1 hook additions — Font Access API + getHighEntropyValues

**Files:**
- Modify: `scripts/scan.js` (extend fonts block; add new UA Client Hints block)

- [ ] **Step 1: Extend the document.fonts block with iterator method wraps**

Locate the `Font enumeration fingerprinting` block (lines ~696-713). Inside the existing `try { if (document.fonts && document.fonts.check) { ... } }`, after the existing `document.fonts.check` wrap (still inside the same try-block), add:

```js
// Modern Font Access API enumeration
const wrapFontIter = (methodName) => {
  if (typeof document.fonts[methodName] !== "function") return;
  const orig = document.fonts[methodName].bind(document.fonts);
  document.fonts[methodName] = function (...args) {
    logFP("Fonts", `${methodName} (Font Access API)`, TIER1);
    return orig(...args);
  };
};
wrapFontIter("values");
wrapFontIter("entries");
wrapFontIter("forEach");
```

- [ ] **Step 2: Add NavigatorUAData.getHighEntropyValues hook**

After the existing `Navigator hardware properties` block (around line 750-761), but before the closing `});` of the entire `addInitScript` block, insert:

```js
// NavigatorUAData high-entropy values (UA Client Hints)
// EDPB 2023 explicitly flagged getHighEntropyValues() as a tracking signal.
try {
  if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === "function") {
    const orig = navigator.userAgentData.getHighEntropyValues.bind(navigator.userAgentData);
    navigator.userAgentData.getHighEntropyValues = function (...args) {
      logFP("NavigatorUAData", "getHighEntropyValues", TIER1);
      return orig(...args);
    };
  }
} catch { }
```

- [ ] **Step 3: Verify syntax**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node --check scripts/scan.js`
Expected: clean exit.

- [ ] **Step 4: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add scripts/scan.js
git commit -m "feat(fingerprinting): detect Font Access API + getHighEntropyValues"
```

---

### Task 7: Tier 2 hook additions — Navigator + Screen + matchMedia

**Files:**
- Modify: `scripts/scan.js` (insert new Tier 2 block before the closing `});` of addInitScript)

- [ ] **Step 1: Add Tier 2 hook block**

After the `getHighEntropyValues` hook from Task 6 (and before the closing `});` of `addInitScript`), insert:

```js
// ─── Tier 2: medium-entropy contextual signals ───
// Wrapped but only published when stacked with Tier 1 from same caller.

// Navigator.hardwareConcurrency
try {
  const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, "hardwareConcurrency");
  if (desc && desc.get) {
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", {
      get: function () { logFP("Navigator", "hardwareConcurrency", TIER2); return desc.get.call(this); },
      configurable: true,
    });
  }
} catch { }

// Navigator.platform
try {
  const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, "platform");
  if (desc && desc.get) {
    Object.defineProperty(Navigator.prototype, "platform", {
      get: function () { logFP("Navigator", "platform", TIER2); return desc.get.call(this); },
      configurable: true,
    });
  }
} catch { }

// Navigator.maxTouchPoints
try {
  const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, "maxTouchPoints");
  if (desc && desc.get) {
    Object.defineProperty(Navigator.prototype, "maxTouchPoints", {
      get: function () { logFP("Navigator", "maxTouchPoints", TIER2); return desc.get.call(this); },
      configurable: true,
    });
  }
} catch { }

// Navigator.pdfViewerEnabled
try {
  const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, "pdfViewerEnabled");
  if (desc && desc.get) {
    Object.defineProperty(Navigator.prototype, "pdfViewerEnabled", {
      get: function () { logFP("Navigator", "pdfViewerEnabled", TIER2); return desc.get.call(this); },
      configurable: true,
    });
  }
} catch { }

// Navigator.connection (NetworkInformation)
try {
  const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, "connection");
  if (desc && desc.get) {
    Object.defineProperty(Navigator.prototype, "connection", {
      get: function () {
        const conn = desc.get.call(this);
        if (conn && !conn.__wrapped) {
          conn.__wrapped = true;
          for (const prop of ["effectiveType", "downlink", "rtt"]) {
            try {
              const proto = Object.getPrototypeOf(conn);
              const propDesc = Object.getOwnPropertyDescriptor(proto, prop);
              if (propDesc && propDesc.get) {
                Object.defineProperty(conn, prop, {
                  get: function () { logFP("Navigator", `connection.${prop}`, TIER2); return propDesc.get.call(this); },
                  configurable: true,
                });
              }
            } catch { }
          }
        }
        return conn;
      },
      configurable: true,
    });
  }
} catch { }

// Screen properties (colorDepth, pixelDepth, availWidth, availHeight)
try {
  for (const prop of ["colorDepth", "pixelDepth", "availWidth", "availHeight"]) {
    const desc = Object.getOwnPropertyDescriptor(Screen.prototype, prop);
    if (desc && desc.get) {
      Object.defineProperty(Screen.prototype, prop, {
        get: function () { logFP("Screen", prop, TIER2); return desc.get.call(this); },
        configurable: true,
      });
    }
  }
} catch { }

// FP-class matchMedia queries
// Allowlist of FP-indicating query patterns (not generic responsive queries).
try {
  const FP_QUERY_PATTERNS = [
    /color-gamut\s*:/i,
    /dynamic-range\s*:/i,
    /\bresolution\s*:\s*\d+(\.\d+)?dppx/i,
    /forced-colors\s*:/i,
    /inverted-colors\s*:/i,
  ];
  const origMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = function (query) {
    try {
      if (typeof query === "string" && FP_QUERY_PATTERNS.some(re => re.test(query))) {
        logFP("CSS", `matchMedia(${query.substring(0, 60)})`, TIER2);
      }
    } catch { }
    return origMatchMedia(query);
  };
} catch { }

// document.fonts.size + document.fonts.ready access
try {
  if (document.fonts) {
    const proto = Object.getPrototypeOf(document.fonts);
    const sizeDesc = Object.getOwnPropertyDescriptor(proto, "size");
    if (sizeDesc && sizeDesc.get) {
      Object.defineProperty(document.fonts, "size", {
        get: function () { logFP("Fonts", "size", TIER2); return sizeDesc.get.call(this); },
        configurable: true,
      });
    }
  }
} catch { }
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node --check scripts/scan.js`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add scripts/scan.js
git commit -m "feat(fingerprinting): add Tier 2 hooks (Navigator/Screen/matchMedia/connection)"
```

---

### Task 8: Tier 3 hook additions

**Files:**
- Modify: `scripts/scan.js` (insert Tier 3 block after Tier 2)

- [ ] **Step 1: Add Tier 3 hook block**

After the Tier 2 block from Task 7, before the closing `});` of `addInitScript`, insert:

```js
// ─── Tier 3: low-entropy / commonly-legitimate (private appendix only) ───

// navigator.language / languages
try {
  for (const prop of ["language", "languages"]) {
    const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
    if (desc && desc.get) {
      Object.defineProperty(Navigator.prototype, prop, {
        get: function () { logFP("Navigator", prop, TIER3); return desc.get.call(this); },
        configurable: true,
      });
    }
  }
} catch { }

// navigator.cookieEnabled / doNotTrack
try {
  for (const prop of ["cookieEnabled", "doNotTrack"]) {
    const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
    if (desc && desc.get) {
      Object.defineProperty(Navigator.prototype, prop, {
        get: function () { logFP("Navigator", prop, TIER3); return desc.get.call(this); },
        configurable: true,
      });
    }
  }
} catch { }

// screen.width/height + devicePixelRatio
try {
  for (const prop of ["width", "height"]) {
    const desc = Object.getOwnPropertyDescriptor(Screen.prototype, prop);
    if (desc && desc.get) {
      Object.defineProperty(Screen.prototype, prop, {
        get: function () { logFP("Screen", prop, TIER3); return desc.get.call(this); },
        configurable: true,
      });
    }
  }
} catch { }

// navigator.userAgent — log access only (not the value itself, every page reads it)
// Skipped intentionally: navigator.userAgent is read by virtually every site for
// browser detection. Logging it would create thousands of Tier-3 entries with no
// signal value. If we want to detect deliberate FP via UA-string parsing later,
// we'd need a heuristic on read frequency from the same caller.

// navigator.storage.estimate()
try {
  if (navigator.storage && typeof navigator.storage.estimate === "function") {
    const orig = navigator.storage.estimate.bind(navigator.storage);
    navigator.storage.estimate = function (...args) {
      logFP("Storage", "estimate", TIER3);
      return orig(...args);
    };
  }
} catch { }

// caches.keys()
try {
  if (typeof caches !== "undefined" && caches && typeof caches.keys === "function") {
    const orig = caches.keys.bind(caches);
    caches.keys = function (...args) {
      logFP("Cache", "keys", TIER3);
      return orig(...args);
    };
  }
} catch { }
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node --check scripts/scan.js`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add scripts/scan.js
git commit -m "feat(fingerprinting): add Tier 3 hooks for private-appendix forensic data"
```

---

### Task 9: Aggregation function — caller-domain extraction + tier bucketing + stacking

**Files:**
- Modify: `scripts/scan.js` — add new function `aggregateFingerprinting` near `collectFingerprintingResult` (around line 2230)

- [ ] **Step 1: Add helpers + aggregateFingerprinting function**

Find the `collectFingerprintingResult` function (around line 2230). Immediately AFTER its closing brace, insert:

```js
// ───────────────────────────────────────────
// Fingerprinting aggregation (post-scan)
// ───────────────────────────────────────────

function extractCallerDomain(callerUrl) {
  if (!callerUrl) return "<unknown>";
  // callerUrl looks like: "at func@https://example.com/script.js:line:col"
  // Extract the URL portion.
  const urlMatch = callerUrl.match(/(https?:\/\/[^\s):]+)/);
  if (!urlMatch) {
    if (callerUrl.includes("blob:")) return "<inline-blob>";
    return "<unknown>";
  }
  try {
    return new URL(urlMatch[1]).hostname;
  } catch {
    return "<unknown>";
  }
}

function classifyApiName(api, method) {
  // Stable display name for a Tier-{1,2} call. Used for the `apis` array
  // in stackedSignals so duplicate counts collapse cleanly.
  return `${api}.${method.split(" ")[0]}`;
}

const COMMERCIAL_FP_SDKS = [
  { name: "Fingerprint Pro / FingerprintJS", domains: ["fpjs.io", "api.fpjs.io", "fingerprint.com"] },
  { name: "SEON", domains: ["seon.io"] },
  { name: "Sift", domains: ["sift.com", "siftscience.com"] },
  { name: "Arkose Labs", domains: ["arkoselabs.com"] },
  { name: "Accertify", domains: ["accertify.com"] },
  { name: "Riskified", domains: ["riskified.com", "beacon.riskified.com"] },
  { name: "DataDome", domains: ["datadome.co"] },
  { name: "PerimeterX / HUMAN", domains: ["perimeterx.net", "px-cdn.net", "humansecurity.com"] },
];

function aggregateFingerprinting(rawResult, preConsentTimestamp) {
  // rawResult shape: { detected, preConsent, severity, apiCalls[], callerDomains[] }
  // apiCalls[] entries from injected hook: { api, method, tier, count?, timestamp, callerUrl, inWorker, preConsent? }

  const calls = (rawResult.apiCalls || []).map(c => ({
    api: c.api,
    method: c.method,
    tier: c.tier || "tier1",
    count: c.count || 1,
    callerDomain: extractCallerDomain(c.callerUrl),
    callerUrl: c.callerUrl,
    inWorker: !!c.inWorker,
    preConsent: c.preConsent !== undefined ? c.preConsent : (preConsentTimestamp ? c.timestamp <= preConsentTimestamp : true),
    firstSeenAt: c.firstSeenAt || null,
  }));

  const tier1Calls = calls.filter(c => c.tier === "tier1");
  const tier2Calls = calls.filter(c => c.tier === "tier2");
  const tier3CallsRaw = calls.filter(c => c.tier === "tier3");

  // Per-domain aggregation for stacking
  const byDomain = new Map();
  for (const c of [...tier1Calls, ...tier2Calls]) {
    if (!byDomain.has(c.callerDomain)) {
      byDomain.set(c.callerDomain, { tier1: [], tier2: [], preConsent: false });
    }
    const bucket = byDomain.get(c.callerDomain);
    if (c.tier === "tier1") bucket.tier1.push(c); else bucket.tier2.push(c);
    if (c.preConsent) bucket.preConsent = true;
  }

  const stackedSignals = [];
  const promotedTier2Calls = []; // Tier 2 calls that got published via stacking
  const droppedTier2Calls = []; // Tier 2 calls that get demoted to tier3 appendix

  for (const [domain, bucket] of byDomain) {
    if (domain === "<unknown>") {
      // Unknown caller: log calls but never stack
      droppedTier2Calls.push(...bucket.tier2);
      continue;
    }
    const t1Count = bucket.tier1.reduce((s, c) => s + c.count, 0);
    const t2Count = bucket.tier2.reduce((s, c) => s + c.count, 0);
    const distinctT2 = new Set(bucket.tier2.map(c => classifyApiName(c.api, c.method))).size;

    let verdict = null;
    if (t1Count >= 1) {
      verdict = "active fingerprinting";
      promotedTier2Calls.push(...bucket.tier2);
    } else if (t2Count >= 4 && distinctT2 >= 3) {
      verdict = "probable fingerprinting";
      promotedTier2Calls.push(...bucket.tier2);
    } else {
      // Demote this domain's Tier 2 calls to the private appendix
      droppedTier2Calls.push(...bucket.tier2);
      continue;
    }

    const apis = Array.from(new Set([
      ...bucket.tier1.map(c => classifyApiName(c.api, c.method)),
      ...bucket.tier2.map(c => classifyApiName(c.api, c.method)),
    ]));

    stackedSignals.push({
      callerDomain: domain,
      verdict,
      tier1Count: t1Count,
      tier2Count: t2Count,
      apis,
      preConsent: bucket.preConsent,
      rationale: null,         // LLM analyst fills
      legitimateBasisClaim: null, // LLM analyst fills
      purposeDisclosed: null,  // LLM analyst fills
    });
  }

  // Commercial SDK matching (against ANY caller domain we saw, including those
  // that didn't make it into stackedSignals)
  const allDomains = new Set(calls.map(c => c.callerDomain));
  const commercialSdks = [];
  for (const sdk of COMMERCIAL_FP_SDKS) {
    const matchedDomains = sdk.domains.filter(d =>
      Array.from(allDomains).some(seen => seen === d || seen.endsWith("." + d))
    );
    if (matchedDomains.length > 0) {
      commercialSdks.push({
        name: sdk.name,
        domains: matchedDomains,
        legitimateBasisClaim: null, // LLM analyst fills
        purposeDisclosed: null,     // LLM analyst fills
      });
    }
  }

  const tier3Appendix = [
    ...tier3CallsRaw,
    ...droppedTier2Calls.map(c => ({ ...c, demotedFrom: "tier2" })),
  ];

  return {
    detected: tier1Calls.length > 0 || stackedSignals.length > 0,
    preConsent: rawResult.preConsent || false,
    severity: rawResult.severity || (stackedSignals.length > 0 ? "high" : "low"),
    tier1Calls: tier1Calls.map(({ callerUrl, ...rest }) => rest),
    tier2Calls: promotedTier2Calls.map(({ callerUrl, ...rest }) => rest),
    stackedSignals,
    commercialSdks,
    callerDomains: Array.from(allDomains).filter(d => d !== "<unknown>"),
    tier3Appendix: tier3Appendix.map(({ callerUrl, ...rest }) => rest),
    outOfScopeCaveats: [
      "Network-layer fingerprinting (TLS JA3/JA4, HTTP/3 QUIC, IP TTL) is not detectable by JavaScript instrumentation. Sites may use these techniques.",
      "CSS timing attacks are indistinguishable from legitimate rendering measurements.",
      "Worker-internal canvas readbacks are detected indirectly (via OffscreenCanvas postMessage transfers); the readback itself is not visible from the main thread.",
    ],
    apiCalls: rawResult.apiCalls || [], // legacy field kept for backwards compat
  };
}
```

- [ ] **Step 2: Wire aggregation into the per-variant flow**

Find the line `variantResult.fingerprinting = await collectFingerprintingResult(page, consentClickTimestamp);` (around line 1019). Replace it with:

```js
const rawFp = await collectFingerprintingResult(page, consentClickTimestamp);
variantResult.fingerprinting = aggregateFingerprinting(rawFp, consentClickTimestamp);
```

- [ ] **Step 3: Verify syntax**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node --check scripts/scan.js`
Expected: clean exit.

- [ ] **Step 4: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add scripts/scan.js
git commit -m "feat(fingerprinting): aggregation, stacking verdicts, commercial SDK match"
```

---

### Task 10: Build the test fixture page + run script

**Files:**
- Create: `tests/fingerprinting/fixture.html`
- Create: `tests/fingerprinting/run-fixture.js`
- Create: `tests/fingerprinting/expected.json`
- Create: `tests/fingerprinting/README.md`

- [ ] **Step 1: Create fixture HTML page**

Create `tests/fingerprinting/fixture.html` with content that exercises every Tier 1 + Tier 2 + a few Tier 3 vectors:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Fingerprinting Detection Fixture</title>
</head>
<body>
  <h1>FP fixture</h1>
  <script>
  // === Tier 1: Canvas (text-only hidden, never inserted) ===
  (function () {
    const c = document.createElement("canvas");
    c.width = 280; c.height = 40;
    const ctx = c.getContext("2d");
    ctx.font = "14px Arial";
    ctx.fillText("fingerprint", 2, 15);
    void c.toDataURL();
  })();

  // === Tier 1: Canvas measureText font enum (>20 calls) ===
  (function () {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    for (let i = 0; i < 25; i++) {
      ctx.font = `12px font${i}`;
      ctx.measureText("mmmmmmmmmm");
    }
  })();

  // === Tier 1: WebGL hardware params ===
  (function () {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl");
    if (gl) {
      gl.getParameter(0x1F00); // VENDOR
      gl.getParameter(0x1F01); // RENDERER
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
        gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      }
      if (gl.getShaderPrecisionFormat) {
        gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      }
    }
  })();

  // === Tier 1: OfflineAudioContext + online AC graph ===
  (function () {
    if (typeof OfflineAudioContext !== "undefined") {
      const oc = new OfflineAudioContext(1, 1, 44100);
    }
    if (typeof AudioContext !== "undefined") {
      try {
        const ac = new AudioContext();
        const an = ac.createAnalyser();
        const sp = ac.createScriptProcessor(4096, 1, 1);
        an.connect(sp);
      } catch (e) { /* AudioContext may be blocked without user gesture */ }
    }
  })();

  // === Tier 1: OffscreenCanvas + Worker ===
  (function () {
    if (typeof OffscreenCanvas !== "undefined") {
      const oc = new OffscreenCanvas(280, 40);
      try {
        // Inline worker via blob to test postMessage transfer
        const blob = new Blob(["self.onmessage = e => { /* noop */ };"], { type: "application/javascript" });
        const worker = new Worker(URL.createObjectURL(blob));
        worker.postMessage({ canvas: oc }, [oc]);
      } catch (e) { /* CSP may block blob workers */ }
    }
  })();

  // === Tier 1: WebRTC + enumerateDevices + Battery ===
  (function () {
    if (typeof RTCPeerConnection !== "undefined") {
      try { new RTCPeerConnection(); } catch {}
    }
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().catch(()=>{});
    }
    if (navigator.getBattery) {
      navigator.getBattery().catch(()=>{});
    }
  })();

  // === Tier 1: getHighEntropyValues ===
  (function () {
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(["model", "platformVersion"]).catch(()=>{});
    }
  })();

  // === Tier 2: Navigator + Screen + matchMedia FP queries ===
  (function () {
    void navigator.hardwareConcurrency;
    void navigator.platform;
    void navigator.maxTouchPoints;
    void navigator.deviceMemory;
    void screen.colorDepth;
    void screen.pixelDepth;
    void screen.availWidth;
    matchMedia("(color-gamut: p3)");
    matchMedia("(dynamic-range: high)");
    matchMedia("(resolution: 2dppx)");
  })();

  // === Tier 3: language + cookieEnabled (should never appear in stackedSignals) ===
  (function () {
    void navigator.language;
    void navigator.cookieEnabled;
    void screen.width;
  })();
  </script>
</body>
</html>
```

- [ ] **Step 2: Create the run-fixture.js test runner**

Create `tests/fingerprinting/run-fixture.js`:

```js
#!/usr/bin/env node
/**
 * Run the privacy scanner against the local fixture page and assert the
 * fingerprinting output structure. Exit code 0 = pass, 1 = fail.
 *
 * Usage: node tests/fingerprinting/run-fixture.js
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const FIXTURE_DIR = __dirname;
const SCAN_DIR = path.resolve(__dirname, "../..");

function startFixtureServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = path.join(FIXTURE_DIR, "fixture.html");
      const html = fs.readFileSync(file, "utf8");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function runScan(url) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [path.join(SCAN_DIR, "scripts/scan.js"), url], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    let stdout = "";
    proc.stdout.on("data", (chunk) => { stdout += chunk; });
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`scan exited with code ${code}`));
      const lines = stdout.trim().split("\n");
      const jsonPath = lines[lines.length - 1];
      resolve(jsonPath);
    });
  });
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

async function main() {
  console.log("Starting fixture server...");
  const { server, port } = await startFixtureServer();
  const url = `http://127.0.0.1:${port}/`;

  try {
    console.log(`Running scan against ${url}...`);
    const jsonPath = await runScan(url);
    const result = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    const fp = result.summary?.details?.fingerprinting ||
               result.variants?.ignore?.fingerprinting;
    if (!fp) {
      console.error("FAIL: no fingerprinting result in scan output");
      process.exit(1);
    }

    // Schema assertions
    assert(Array.isArray(fp.tier1Calls), "tier1Calls is array");
    assert(Array.isArray(fp.tier2Calls), "tier2Calls is array");
    assert(Array.isArray(fp.stackedSignals), "stackedSignals is array");
    assert(Array.isArray(fp.commercialSdks), "commercialSdks is array");
    assert(Array.isArray(fp.tier3Appendix), "tier3Appendix is array");
    assert(Array.isArray(fp.outOfScopeCaveats) && fp.outOfScopeCaveats.length === 3, "outOfScopeCaveats has 3 entries");

    // Vector coverage assertions (these MUST appear in tier1Calls)
    const t1ApiMethods = new Set(fp.tier1Calls.map(c => `${c.api}.${c.method.split(" ")[0]}`));
    const expectedT1 = [
      "Canvas.toDataURL",
      "Canvas.measureText",
      "WebGL.getParameter",
      "WebGL.getExtension(WEBGL_debug_renderer_info)",
      "AudioContext.OfflineAudioContext",
      "OffscreenCanvas.constructor",
      "Worker.postMessage(OffscreenCanvas",
      "RTCPeerConnection",
    ];
    for (const expected of expectedT1) {
      const found = Array.from(t1ApiMethods).some(api => api.startsWith(expected));
      assert(found, `Tier 1 detected: ${expected}`);
    }

    // Tier 2 assertions
    const t2ApiMethods = new Set(fp.tier2Calls.map(c => `${c.api}.${c.method.split(" ")[0]}`));
    const expectedT2 = [
      "Navigator.hardwareConcurrency",
      "Navigator.platform",
      "Screen.colorDepth",
      "CSS.matchMedia",
    ];
    for (const expected of expectedT2) {
      const found = Array.from(t2ApiMethods).some(api => api.startsWith(expected));
      assert(found, `Tier 2 stacked + published: ${expected}`);
    }

    // Tier 3 assertion: navigator.language MUST be in tier3Appendix and NOT in tier1Calls or tier2Calls
    const t3 = fp.tier3Appendix.some(c => c.api === "Navigator" && c.method === "language");
    assert(t3, "Tier 3: navigator.language is in tier3Appendix");
    const noT3InPublished = !fp.tier1Calls.some(c => c.method === "language") && !fp.tier2Calls.some(c => c.method === "language");
    assert(noT3InPublished, "Tier 3: navigator.language not in published tiers");

    // Stacking: 127.0.0.1 should appear as 'active fingerprinting' (it has Tier 1 hits)
    const fixtureDomain = new URL(url).hostname;
    const fixtureSignal = fp.stackedSignals.find(s => s.callerDomain === fixtureDomain || s.callerDomain === "<unknown>");
    assert(fixtureSignal, `stackedSignals contains entry for ${fixtureDomain} (or <unknown>)`);
    if (fixtureSignal) {
      assert(fixtureSignal.verdict === "active fingerprinting", `verdict is 'active fingerprinting' (got: ${fixtureSignal.verdict})`);
    }

    console.log("\nAll fixture assertions passed.");
  } finally {
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Create the README**

Create `tests/fingerprinting/README.md`:

```markdown
# Fingerprinting Detection Test Fixture

End-to-end test for the tiered fingerprinting detection added in 2026-04.

## Run

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
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
```

- [ ] **Step 4: Run the test**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
node tests/fingerprinting/run-fixture.js
```

Expected: all assertions PASS, exit 0. If any fail, debug the corresponding hook in `scripts/scan.js`.

- [ ] **Step 5: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add tests/
git commit -m "test(fingerprinting): end-to-end fixture exercising all tier vectors"
```

---

### Task 11: Update analysis-brief.js with the new section

**Files:**
- Modify: `scripts/analysis-brief.js` — extend the existing `EXTENDED DETECTION` section or add a new `FINGERPRINTING (NEW MODEL)` section right after it

- [ ] **Step 1: Add the new brief section**

Find the `EXTENDED DETECTION` section in `scripts/analysis-brief.js` (around line 200). Right after the `Fingerprinting: ${fp.detected ...}` line and the `apiCalls.forEach(...)` block, insert (still inside the same logical section):

```js
// ── Fingerprinting (NEW tiered model) ──
if (fp.stackedSignals && fp.stackedSignals.length) {
  ln(`\n--- Fingerprinting (tiered) ---`);
  ln(`Active fingerprinting domains: ${fp.stackedSignals.length}`);
  fp.stackedSignals.forEach(s => {
    const tag = s.preConsent ? " [pre-consent]" : "";
    const sdk = (fp.commercialSdks || []).find(c => (c.domains || []).some(d => s.callerDomain === d || s.callerDomain.endsWith("." + d)));
    const sdkTag = sdk ? ` [commercial SDK: ${sdk.name}]` : "";
    ln(`  ${s.callerDomain}: ${s.tier1Count} Tier-1 + ${s.tier2Count} Tier-2 (${s.verdict})${tag}${sdkTag}`);
    ln(`    APIs: ${(s.apis || []).join(", ")}`);
  });
}
if (fp.tier3Appendix && fp.tier3Appendix.length) {
  ln(`Tier 3 informational signals: ${fp.tier3Appendix.length} (private appendix only)`);
}
if (fp.outOfScopeCaveats && fp.outOfScopeCaveats.length) {
  ln(`Out-of-scope caveats: ${fp.outOfScopeCaveats.length} (TLS/QUIC/CSS-timing not detectable in JS)`);
}
ln(`\n>>> LLM analyst: fill stackedSignals[*].rationale, .legitimateBasisClaim, and .purposeDisclosed`);
ln(`>>> by reading the privacy policy. Same for commercialSdks[*].`);
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node --check scripts/analysis-brief.js`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add scripts/analysis-brief.js
git commit -m "feat(brief): surface tiered fingerprinting + LLM annotation cues"
```

---

### Task 12: Update validate-analysis.js with new optional validations

**Files:**
- Modify: `scripts/validate-analysis.js` — extend the existing `// ── fingerprinting (API heatmap) ──` block

- [ ] **Step 1: Add validations for new fields**

Find the `// ── fingerprinting (API heatmap) ──` block (around line 257). Right after the existing block (after `checkEnum("findings.fingerprinting.severity", fp.severity, ["none", "low", "medium", "high"]);`), add:

```js
  // New tiered model fields (all optional)
  if (fp.stackedSignals != null) {
    if (!isArr(fp.stackedSignals)) err("findings.fingerprinting.stackedSignals", "must be array when present");
    else fp.stackedSignals.forEach((s, i) => {
      const p = `findings.fingerprinting.stackedSignals[${i}]`;
      if (!isStr(s.callerDomain)) err(`${p}.callerDomain`, "required string");
      checkEnum(`${p}.verdict`, s.verdict, ["active fingerprinting", "probable fingerprinting"]);
      if (!isInt(s.tier1Count)) err(`${p}.tier1Count`, "required integer");
      if (!isInt(s.tier2Count)) err(`${p}.tier2Count`, "required integer");
      if (!isArr(s.apis)) err(`${p}.apis`, "required array");
      if (s.preConsent != null && !isBool(s.preConsent)) err(`${p}.preConsent`, "must be boolean");
    });
  }
  if (fp.commercialSdks != null) {
    if (!isArr(fp.commercialSdks)) err("findings.fingerprinting.commercialSdks", "must be array when present");
    else fp.commercialSdks.forEach((s, i) => {
      const p = `findings.fingerprinting.commercialSdks[${i}]`;
      if (!isStr(s.name)) err(`${p}.name`, "required string");
      if (!isArr(s.domains)) err(`${p}.domains`, "required array");
    });
  }
  if (fp.tier1Calls != null && !isArr(fp.tier1Calls)) err("findings.fingerprinting.tier1Calls", "must be array when present");
  if (fp.tier2Calls != null && !isArr(fp.tier2Calls)) err("findings.fingerprinting.tier2Calls", "must be array when present");
  if (fp.tier3Appendix != null && !isArr(fp.tier3Appendix)) err("findings.fingerprinting.tier3Appendix", "must be array when present");
  if (fp.outOfScopeCaveats != null && !isArr(fp.outOfScopeCaveats)) err("findings.fingerprinting.outOfScopeCaveats", "must be array when present");
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node --check scripts/validate-analysis.js`
Expected: clean exit.

- [ ] **Step 3: Sanity-check against existing analysis JSON**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node scripts/validate-analysis.js /tmp/privacy-analysis-dyson.json`
Expected: passes (the dyson analysis doesn't have the new fields, so the optional validations are no-ops).

- [ ] **Step 4: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add scripts/validate-analysis.js
git commit -m "feat(validate): optional checks for tiered fingerprinting fields"
```

---

### Task 13: Rebuild the fingerprinting slide in generate.js

**Files:**
- Modify: `scripts/generate.js` — locate `buildFingerprinting` (search for `function buildFingerprinting`) and rewrite

- [ ] **Step 1: Find the existing buildFingerprinting function**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && grep -n "function buildFingerprinting\|fingerprinting:" scripts/generate.js | head`

Note the line range of the existing builder. (Likely a single `function buildFingerprinting(slideNum, totalSlides) { ... }` block.)

- [ ] **Step 2: Replace the function with the tiered version**

Replace the existing `buildFingerprinting` body with:

```js
function buildFingerprinting(slideNum, totalSlides) {
  const fp = findings.fingerprinting;
  if (!fp || !fp.detected) return null;

  // Backwards compat: if new fields missing, fall back to legacy heatmap.
  if (!fp.stackedSignals && !fp.tier1Calls) {
    return buildFingerprintingLegacy(slideNum, totalSlides, fp);
  }

  const stacked = fp.stackedSignals || [];
  const tier1 = fp.tier1Calls || [];
  const tier2 = fp.tier2Calls || [];
  const sdks = fp.commercialSdks || [];

  // Section 1: Active fingerprinting cards
  const cards = stacked.map((s, i) => {
    const verdictColor = s.verdict === "active fingerprinting" ? "#dc2626" : "#d97706";
    const verdictLabel = s.verdict === "active fingerprinting" ? "Active" : "Probable";
    const sdk = sdks.find(c => (c.domains || []).some(d => s.callerDomain === d || s.callerDomain.endsWith("." + d)));
    const sdkBadge = sdk ? `<span class="rs-note-score score-bad">SDK: ${esc(sdk.name)}</span>` : "";
    const lbcBadge = s.legitimateBasisClaim
      ? `<span class="rs-note-score score-${s.purposeDisclosed ? "excellent" : "acceptable"}">claim: ${esc(s.legitimateBasisClaim)}</span>`
      : "";
    const preTag = s.preConsent ? ' <span style="color:#dc2626;">[pre-consent]</span>' : "";
    const rationale = s.rationale ? `<p class="rs-note-text">${esc(s.rationale)}</p>` : "";
    const apiList = (s.apis || []).slice(0, 6).join(", ");
    const delay = (i * 0.05).toFixed(2);
    return `<div class="rs-note reveal" style="border-left-color:${verdictColor};">
      <div class="rs-note-header">
        <span class="rs-note-dot rs-dot-${s.verdict === "active fingerprinting" ? "bad" : "acceptable"}"></span>
        <span class="rs-note-cat">${esc(s.callerDomain)}${preTag}</span>
        <span class="rs-note-score score-${s.verdict === "active fingerprinting" ? "bad" : "acceptable"}">${verdictLabel} · T1:${s.tier1Count} T2:${s.tier2Count}</span>
        ${sdkBadge}
        ${lbcBadge}
      </div>
      <div class="rs-note-bar">
        <div class="rs-note-bar-track"><div class="rs-note-bar-fill score-bar-bad" style="--bar-width:100%;transition-delay:${delay}s"></div></div>
      </div>
      ${rationale}
      <p class="rs-note-text" style="opacity:0.7;font-size:0.85em;">APIs: ${esc(apiList)}${(s.apis || []).length > 6 ? ` +${(s.apis || []).length - 6} more` : ""}</p>
    </div>`;
  }).join("\n");

  // Section 2: API call detail (compact heatmap-style by tier)
  const callDetail = (() => {
    const byApi = new Map();
    for (const c of tier1) {
      const k = `${c.api}.${c.method.split(" ")[0]}`;
      const e = byApi.get(k) || { tier: 1, count: 0 };
      e.count += c.count || 1;
      byApi.set(k, e);
    }
    for (const c of tier2) {
      const k = `${c.api}.${c.method.split(" ")[0]}`;
      const e = byApi.get(k) || { tier: 2, count: 0 };
      e.count += c.count || 1;
      byApi.set(k, e);
    }
    const rows = Array.from(byApi.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 12);
    return rows.map(([api, e]) => {
      const color = e.tier === 1 ? "#dc2626" : "#d97706";
      const tierTag = e.tier === 1 ? "T1" : "T2";
      return `<div class="rs-note reveal" style="border-left-color:${color};">
        <div class="rs-note-header">
          <span class="rs-note-cat">${esc(api)}</span>
          <span class="rs-note-score score-${e.tier === 1 ? "bad" : "acceptable"}">${tierTag} · ${e.count}×</span>
        </div>
      </div>`;
    }).join("\n");
  })();

  return `<section class="slide" data-title="Fingerprinting Detection">
  <div class="slide-content">
    <span class="badge reveal">Fingerprinting</span>
    <h2 class="reveal">Active Fingerprinting</h2>
    ${stacked.length === 0 ? '<p class="slide-intro reveal">No stacked fingerprinting signals detected on caller-domain attribution.</p>' : ''}
    <div class="rs-notes reveal">${cards}</div>
    ${callDetail ? `<h3 class="reveal" style="margin-top:1.5rem;">API Call Detail</h3><div class="rs-notes reveal">${callDetail}</div>` : ''}
    <p class="reveal" style="opacity:0.6;font-size:0.8em;margin-top:1.5rem;">Network-layer fingerprinting (TLS, QUIC) is not JavaScript-detectable. See methodology.</p>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

// Legacy fingerprinting slide for old scans without tiered fields
function buildFingerprintingLegacy(slideNum, totalSlides, fp) {
  const apiCalls = fp.apiCalls || [];
  if (apiCalls.length === 0) return null;
  const cards = apiCalls.slice(0, 12).map((c, i) => {
    const delay = (i * 0.04).toFixed(2);
    return `<div class="rs-note reveal" style="border-left-color:#dc2626;">
      <div class="rs-note-header">
        <span class="rs-note-cat">${esc(c.api)}.${esc(c.method)}</span>
        <span class="rs-note-score score-bad">${c.count || 1}×${c.preConsent ? " · pre-consent" : ""}</span>
      </div>
      <div class="rs-note-bar">
        <div class="rs-note-bar-track"><div class="rs-note-bar-fill score-bar-bad" style="--bar-width:100%;transition-delay:${delay}s"></div></div>
      </div>
    </div>`;
  }).join("\n");
  return `<section class="slide" data-title="Fingerprinting Detection">
  <div class="slide-content">
    <span class="badge reveal">Fingerprinting</span>
    <h2 class="reveal">Fingerprinting API Calls</h2>
    <div class="rs-notes reveal">${cards}</div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}
```

- [ ] **Step 3: Verify syntax**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node --check scripts/generate.js`
Expected: clean exit.

- [ ] **Step 4: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add scripts/generate.js
git commit -m "feat(generate): rebuild fingerprinting slide with tiered model"
```

---

### Task 14: Add private-appendix slides + flag

**Files:**
- Modify: `scripts/generate.js` — add two new builders and the flag handling

- [ ] **Step 1: Add the appendix slide builders**

After the `buildFingerprintingLegacy` function from Task 13, add:

```js
function buildFingerprintingTier3Appendix(slideNum, totalSlides) {
  if (!includePrivateAppendix) return null;
  const fp = findings.fingerprinting;
  if (!fp || !Array.isArray(fp.tier3Appendix) || fp.tier3Appendix.length === 0) return null;
  const byApi = new Map();
  for (const c of fp.tier3Appendix) {
    const k = `${c.api}.${c.method}`;
    byApi.set(k, (byApi.get(k) || 0) + (c.count || 1));
  }
  const rows = Array.from(byApi.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([api, count]) =>
      `<div class="rs-note reveal" style="border-left-color:#6b7280;">
        <div class="rs-note-header">
          <span class="rs-note-cat">${esc(api)}</span>
          <span class="rs-note-score score-acceptable">T3 · ${count}×</span>
        </div>
      </div>`
    ).join("\n");
  return `<section class="slide" data-title="Fingerprinting: Tier 3 Appendix">
  <div class="slide-content">
    <span class="badge reveal">Private Appendix</span>
    <h2 class="reveal">Tier 3 — Informational Signals</h2>
    <p class="slide-intro reveal">Low-entropy / commonly-legitimate API access. Not published in the public deck. Forensic context for the audit trail.</p>
    <div class="rs-notes reveal">${rows}</div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildOutOfScopeCaveats(slideNum, totalSlides) {
  if (!includePrivateAppendix) return null;
  const fp = findings.fingerprinting;
  if (!fp || !Array.isArray(fp.outOfScopeCaveats) || fp.outOfScopeCaveats.length === 0) return null;
  const items = fp.outOfScopeCaveats.map(t => `<li class="reveal">${esc(t)}</li>`).join("\n");
  return `<section class="slide" data-title="Methodology: Out of Scope">
  <div class="slide-content">
    <span class="badge reveal">Methodology</span>
    <h2 class="reveal">Out-of-Scope Caveats</h2>
    <p class="slide-intro reveal">Vectors the JavaScript-instrumentation scanner cannot observe.</p>
    <ul class="reveal" style="line-height:1.6;">${items}</ul>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}
```

- [ ] **Step 2: Add flag parsing + builders to dispatch**

Find the CLI argument parsing in `generate.js` (search for `process.argv` or `--output-dir`). Add a flag check. The simplest robust pattern is, near the top of the main script body where other flags are parsed:

```js
const includePrivateAppendix = process.argv.includes("--include-private-appendix");
```

If it's a `let` declared somewhere already, just add this line. The variable must be in scope where the appendix builders read it.

Then find the `builders` dispatch object (search for `consentRevocation: buildConsentRevocation,`). Add the two new entries near the bottom of the object, before the closing brace:

```js
fingerprintingTier3Appendix: buildFingerprintingTier3Appendix,
outOfScopeCaveats: buildOutOfScopeCaveats,
```

The auto-discovery pass already in `generate.js` (lines ~2016-2043) will probe these and only include them when their builders return non-null — which only happens when `--include-private-appendix` is set AND the data exists.

- [ ] **Step 3: Add to validator's VALID_SLIDES**

In `scripts/validate-analysis.js`, find the `VALID_SLIDES` set (already includes `"dsar", "processorTransparency", "breachNotification"` from earlier work). Add:

```js
"fingerprintingTier3Appendix", "outOfScopeCaveats",
```

- [ ] **Step 4: Verify syntax**

Run: `cd /Users/datagobes/.claude/skills/privacy-scan && node --check scripts/generate.js && node --check scripts/validate-analysis.js`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add scripts/generate.js scripts/validate-analysis.js
git commit -m "feat(generate): private-appendix slides for Tier 3 + out-of-scope caveats"
```

---

### Task 15: Update reference docs

**Files:**
- Modify: `references/criteria/fingerprinting.md`
- Modify: `references/scoring.md`
- Modify: `references/field-contract.md`
- Modify: `references/analysis-guide.md`

- [ ] **Step 1: Update criteria/fingerprinting.md — replace the API table section**

Find the "## Two Classes" section and the "### Active / JavaScript-Level (scanner detects)" subsection. Replace the table there with:

```markdown
### Active / JavaScript-Level (scanner detects, tiered)

The scanner classifies every detected API access into one of three tiers (see `concepts/fingerprinting-emerging-techniques.md` for the source taxonomy):

**Tier 1 — high-confidence hardware probes (always published)**

| API | Method | Why Tier 1 |
|---|---|---|
| Canvas | `toDataURL` / `getImageData` on tiny/hidden OR text-only-undisplayed canvases | Canonical FP signature — no legitimate render reason |
| Canvas | `measureText` >20× in 5s on the same context | Font enumeration via canvas |
| OffscreenCanvas | constructor + `Worker.postMessage` transfer | Worker-based canvas FP entry pattern |
| WebGL/WebGL2 | `getParameter(VENDOR/RENDERER/UNMASKED_*)`, `getExtension('WEBGL_debug_renderer_info')`, `getShaderPrecisionFormat` | Hardware identification |
| WebGPU | `navigator.gpu.requestAdapter()`, `adapter.info` access | Very-high-entropy GPU info |
| AudioContext | `OfflineAudioContext` constructor; `createAnalyser` + `createScriptProcessor` graph; `AudioWorkletNode` | Audio-hardware FP |
| Battery | `navigator.getBattery()` | EDPB-flagged |
| Media devices | `enumerateDevices()` | Device enumeration |
| WebRTC | `RTCPeerConnection` constructor | IP-leak / FP signal |
| Fonts | `document.fonts.check()` >20×; `.values()` / `.entries()` / `.forEach()` | Font enumeration |
| UA Client Hints | `NavigatorUAData.getHighEntropyValues()` | EDPB 2023 explicitly flagged |

**Tier 2 — medium-entropy contextual signals (published only when stacked with ≥1 Tier 1 from same caller domain, OR ≥4 hits across ≥3 distinct APIs)**

| API |
|---|
| `navigator.deviceMemory`, `hardwareConcurrency`, `platform`, `maxTouchPoints`, `pdfViewerEnabled` |
| `navigator.connection.{effectiveType, downlink, rtt}` |
| `screen.colorDepth`, `pixelDepth`, `availWidth`, `availHeight` |
| FP-class `matchMedia` queries: `(color-gamut: …)`, `(dynamic-range: …)`, `(resolution: ≥2dppx)`, `(forced-colors: …)`, `(inverted-colors: …)` |
| `document.fonts.size` / `document.fonts.ready` access |

**Tier 3 — low-entropy / commonly-legitimate (private appendix only, never in public deck)**

| API |
|---|
| `navigator.language`, `languages`, `cookieEnabled`, `doNotTrack` |
| `screen.width`, `height`, `devicePixelRatio` |
| Single non-FP-class `matchMedia` queries |
| `navigator.storage.estimate()` |
| `caches.keys()` |
```

Then find the "### Passive / Network-Level (Cannot Be Directly Scanned)" subsection. Keep it as-is — the spec explicitly references this content.

- [ ] **Step 2: Append a new "Stacking and verdicts" section to criteria/fingerprinting.md**

After the tier tables, before "## Pre-Consent Fingerprinting Is an Aggravating Factor", insert:

```markdown
## Stacking and Verdicts

The scanner attributes every detected call to a `callerDomain` (extracted from the call stack — first-party for inline scripts, third-party for embedded scripts). Per domain:

- `Tier 1 ≥ 1` → verdict `"active fingerprinting"` — all that domain's Tier 1 + Tier 2 calls are published
- `Tier 2 ≥ 4 AND distinct APIs ≥ 3` (no Tier 1) → verdict `"probable fingerprinting"` — that domain's Tier 2 calls are published
- Otherwise → that domain's Tier 2 calls are demoted to the private-appendix `tier3Appendix[]`

Tier 3 is always private-appendix-only.

For each `stackedSignals[]` entry, the LLM analyst fills three annotation fields by reading the privacy policy:
- `rationale` — one-sentence "why this matters" prose
- `legitimateBasisClaim` — the basis the controller could plausibly invoke (e.g., "fraud prevention under Art. 6(1)(f)")
- `purposeDisclosed` — boolean: did the policy actually disclose this processor's purpose?

This per-tracker annotation responds to the precision concern raised in 2026-04 expert review: not every fingerprinting call is equally indefensible. Riskified for fraud prevention has a plausible Art. 6(1)(f) argument; Adobe Target for A/B testing does not. The scanner detects; the LLM analyst contextualises.
```

- [ ] **Step 3: Update scoring.md — replace the binary fingerprinting modifier**

Find the "### Pre-Consent Tracking (20%)" section's modifiers list. Replace this line:

```markdown
- Pre-consent fingerprinting (`fingerprinting.preConsent` = true): −20 (EDPB 2/2023 — fingerprinting in scope of Art. 5(3))
```

With:

```markdown
- Pre-consent fingerprinting (per-domain, replaces the old binary −20):
  - Each `stackedSignals[]` entry where `preConsent: true` and `verdict: "active fingerprinting"`: −10
  - Each entry where `verdict: "probable fingerprinting"`: −5
  - Capped at −20 total (preserves the previous cap so scores stay comparable)
```

Then find the "## Context-Aware Modifiers" section. Add a new bullet at the end:

```markdown
- **Commercial fingerprinting SDK detected** (criteria/fingerprinting.md):
  - For each `commercialSdks[]` entry where `purposeDisclosed === false` OR `legitimateBasisClaim === null`: −15 from overall (stacks outside the −20 pre-consent cap because commercial FP SDKs are inherently identification networks).
  - When `purposeDisclosed === true` and `legitimateBasisClaim` is non-null: no penalty; the SDK is still surfaced in the deck but as a disclosed-purpose finding.
```

- [ ] **Step 4: Update field-contract.md — add the new schema entries**

Open `references/field-contract.md`. Find the section that documents `findings.fingerprinting` (search for "fingerprinting"). After the existing schema, add:

```markdown
## `findings.fingerprinting` (NEW tiered model — 2026-04)

```json
{
  "detected": true,
  "preConsent": true,
  "severity": "high",

  "tier1Calls": [
    { "api": "Canvas", "method": "toDataURL", "count": 3, "callerDomain": "www.example.com",
      "preConsent": true, "inWorker": false }
  ],
  "tier2Calls": [
    { "api": "Navigator", "method": "deviceMemory", "count": 1, "callerDomain": "www.example.com",
      "preConsent": true }
  ],
  "stackedSignals": [
    {
      "callerDomain": "www.example.com",
      "verdict": "active fingerprinting",
      "tier1Count": 16, "tier2Count": 4,
      "apis": ["WebGL.getParameter", "Canvas.toDataURL"],
      "preConsent": true,
      "rationale": null,
      "legitimateBasisClaim": null,
      "purposeDisclosed": null
    }
  ],
  "commercialSdks": [
    { "name": "Riskified", "domains": ["beacon.riskified.com"],
      "legitimateBasisClaim": null, "purposeDisclosed": null }
  ],
  "callerDomains": ["..."],
  "tier3Appendix": [
    { "api": "Navigator", "method": "language", "count": 1, "callerDomain": "..." }
  ],
  "outOfScopeCaveats": ["Network-layer fingerprinting...", "..."],
  "apiCalls": []
}
```

- `verdict` enum: `"active fingerprinting"` | `"probable fingerprinting"`
- `rationale`, `legitimateBasisClaim`, `purposeDisclosed`: `null` from scanner; LLM analyst fills from privacy policy
- `apiCalls[]`: legacy field — duplicated data, kept for backwards compat with old scans
- `tier3Appendix[]` and `outOfScopeCaveats[]`: rendered in private-appendix slides only (when generator is invoked with `--include-private-appendix`); not for public deck
```

- [ ] **Step 5: Update analysis-guide.md — add Fingerprinting analysis subsection**

Open `references/analysis-guide.md`. Find a logical insertion point (after the existing "Data Subject Rights Assessment" section, before any subsequent section). Insert:

```markdown
## Fingerprinting Analysis (NEW tiered model — 2026-04)

The scanner now produces `findings.fingerprinting.stackedSignals[]` (caller-domain attributed verdicts) and `findings.fingerprinting.commercialSdks[]` (matched commercial fingerprinting SDKs). Two annotation responsibilities for the analyst:

### For each `stackedSignals[]` entry

Read `summary.legalPageContent.privacyPolicy` and fill:

1. **`rationale`** — one short sentence summarising what was detected and why it matters. Example: "16 hardware probes (WebGL renderer info + Canvas readback) before any consent action."
2. **`legitimateBasisClaim`** — what Art. 6 basis the controller could plausibly invoke for this caller, IF disclosed. Examples:
   - First-party Adobe Target on a content site: typically no plausible non-consent basis ("personalisation of marketing content" is hard to justify under legitimate interest).
   - Riskified or other anti-fraud SDK: plausible Art. 6(1)(f) for fraud prevention, but only if the policy says so.
   - New Relic RUM / Sentry error tracking: plausible Art. 6(1)(f) for service operation, often disclosed.
   - Set to `null` if no plausible basis exists.
3. **`purposeDisclosed`** — boolean. Did the policy actually name this processor and state its purpose? Vague "third-party providers" wording is `false`.

### For each `commercialSdks[]` entry

Same three annotations. The scoring rule: when `purposeDisclosed: true` AND `legitimateBasisClaim` is non-null, the SDK is surfaced as a disclosed finding (no penalty); otherwise it adds −15 to the overall score outside the −20 pre-consent cap.

### What the scanner does NOT decide

Whether the disclosed purpose is *adequate* under Art. 12 transparency — that requires policy interpretation. The analyst's `purposeDisclosed: true` just means a name + purpose appear; whether that disclosure satisfies Art. 13(1)(e) is a separate Art. 12 / 13 analysis (covered in `criteria/legal-pages.md`).
```

- [ ] **Step 6: Commit**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add references/
git commit -m "docs(fingerprinting): tiered model in criteria + scoring + field-contract + analysis guide"
```

---

### Task 16: Real-site regression on dyson.com

**Files:**
- No code changes — verification only

- [ ] **Step 1: Re-run the dyson.com scan**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
node scripts/scan.js https://dyson.com --accept-text "Alle cookies accepteren" --save-text "Mijn keuzes bevestigen" 2>&1 | tail -10
```

Note the output JSON path printed on the last stdout line.

- [ ] **Step 2: Inspect the new fingerprinting structure**

```bash
SCAN=<path-from-previous-step>
node -e "
const j = require('$SCAN');
const fp = j.summary.details.fingerprinting;
console.log('=== Stacked signals ===');
console.log(JSON.stringify(fp.stackedSignals, null, 2));
console.log('=== Commercial SDKs ===');
console.log(JSON.stringify(fp.commercialSdks, null, 2));
console.log('=== Tier 3 appendix size ===', fp.tier3Appendix.length);
console.log('=== Out of scope caveats ===', fp.outOfScopeCaveats.length);
"
```

Expected:
- `stackedSignals` contains entries for `www.dyson.nl` and `beacon.riskified.com`, both with `verdict: "active fingerprinting"` and `preConsent: true`.
- `commercialSdks` contains an entry for `Riskified` with domains including `beacon.riskified.com`.
- `tier3Appendix.length > 0` (Tier 3 calls were captured).
- `outOfScopeCaveats.length === 3`.

- [ ] **Step 3: Run the analysis-brief and check the new section appears**

```bash
node scripts/analysis-brief.js $SCAN | grep -A 20 "Fingerprinting (tiered)"
```

Expected: lists `Active fingerprinting domains:` count, per-domain breakdown, and the LLM-analyst cue lines.

- [ ] **Step 4: Confirm no false positives on common APIs**

```bash
node -e "
const j = require('$SCAN');
const fp = j.summary.details.fingerprinting;
const t3 = fp.tier3Appendix.map(c => c.api + '.' + c.method);
console.log('Tier 3 APIs:', t3);
"
```

Expected: includes navigator.language / cookieEnabled / userAgent etc., bucketed in Tier 3 (never in stackedSignals or tier1Calls).

- [ ] **Step 5: Commit no-op (verification result)**

If everything looks right, no commit needed — this is a regression check. If issues found, fix in `scripts/scan.js` and re-run from Step 1.

---

### Task 17: False-positive sweep on low-FP sites

**Files:**
- No code changes — verification only

- [ ] **Step 1: Scan five known-low-FP sites**

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
for SITE in "https://en.wikipedia.org" "https://www.gov.uk" "https://ec.europa.eu" "https://duckduckgo.com" "https://startpage.com"; do
  echo "=== $SITE ==="
  node scripts/scan.js "$SITE" 2>/dev/null | tail -1
done
```

Note each output JSON path.

- [ ] **Step 2: Aggregate fingerprinting verdicts**

```bash
for JSON in /tmp/privacy-scan-en.wikipedia.org-*.json /tmp/privacy-scan-www.gov.uk-*.json /tmp/privacy-scan-ec.europa.eu-*.json /tmp/privacy-scan-duckduckgo.com-*.json /tmp/privacy-scan-startpage.com-*.json; do
  echo "--- $JSON ---"
  node -e "
  const j = require('$JSON');
  const fp = j.summary?.details?.fingerprinting;
  if (!fp) { console.log('NO FP DATA'); return; }
  console.log('Stacked:', (fp.stackedSignals || []).length, 'Active:', (fp.stackedSignals||[]).filter(s=>s.verdict==='active fingerprinting').length, 'Probable:', (fp.stackedSignals||[]).filter(s=>s.verdict==='probable fingerprinting').length);
  console.log('SDKs:', (fp.commercialSdks||[]).map(s=>s.name).join(', ') || 'none');
  console.log('Tier 3 size:', (fp.tier3Appendix || []).length);
  "
done
```

Expected: For wikipedia / gov.uk / ec.europa.eu / duckduckgo / startpage, stackedSignals counts should be low (0-2 entries), and any present should have plausible explanations (e.g., a CDN that legitimately reads device info). No commercialSdks should appear on these sites.

If any site shows unexpectedly high stackedSignals counts, drill in and either (a) confirm the site is actually doing FP, or (b) adjust the Tier 1/Tier 2 classification of the noisy API in `scripts/scan.js`.

- [ ] **Step 3: Document findings**

If the sweep reveals FP threshold mis-tuning (e.g., responsive design libraries triggering Tier 2 stacking), commit a tweak to either:
- The Tier 2 stacking threshold (currently `≥4 hits across ≥3 APIs`) in `aggregateFingerprinting`
- The classification of a specific API (move from Tier 2 to Tier 3)

Otherwise no changes needed — the design is validated.

---

### Task 18: Final integration — generate the dyson.com deck with the new pipeline

**Files:**
- No code changes — final smoke test

- [ ] **Step 1: Generate a fresh analysis JSON for dyson.com**

The existing `/tmp/privacy-analysis-dyson.json` does not have the new fingerprinting fields populated by the LLM analyst. Either (a) re-author it manually filling the new fields, or (b) for this verification step, use the schema as-emitted by the scanner with `null` annotations.

Quickest path: write a minimal analysis JSON that pulls fingerprinting straight from the scan and uses placeholder findings for everything else:

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
SCAN=$(ls -t /tmp/privacy-scan-dyson.com-*.json | head -1)
node -e "
const j = require('$SCAN');
const fp = j.summary.details.fingerprinting;
// Add LLM-style annotations for one signal as a smoke test
if (fp.stackedSignals[0]) {
  fp.stackedSignals[0].rationale = 'WebGL renderer probes from inline Adobe Target before consent action.';
  fp.stackedSignals[0].purposeDisclosed = false;
}
const sdk = (fp.commercialSdks || []).find(s => s.name === 'Riskified');
if (sdk) {
  sdk.legitimateBasisClaim = 'fraud prevention under Art. 6(1)(f)';
  sdk.purposeDisclosed = false;
}
const out = {
  meta: { domain: 'dyson.com', scanDate: '2026-04-23', episode: 99, overallScore: 3.9, theme: 'datagobes' },
  scores: { consent: { score: 3.3 }, preConsentTracking: { score: 1.9 }, legalPages: { score: 5.5 }, crossBorder: { score: 4.2 }, securityHeaders: { score: 7.3 }, cookieManagement: { score: 2.8 }, darkPatterns: { score: 3.7 } },
  findings: { tldr: [{ headline: 'Smoke test', detail: 'Verifying tiered fingerprinting render', sentiment: 'negative' }], fingerprinting: fp },
  slides: { include: ['title', 'tldr', 'fingerprinting', 'riskSummary'] }
};
require('fs').writeFileSync('/tmp/privacy-analysis-dyson-smoke.json', JSON.stringify(out, null, 2));
console.log('Wrote /tmp/privacy-analysis-dyson-smoke.json');
"
```

- [ ] **Step 2: Validate**

```bash
node scripts/validate-analysis.js /tmp/privacy-analysis-dyson-smoke.json
```

Expected: passes.

- [ ] **Step 3: Generate the public deck (no private appendix)**

```bash
node scripts/generate.js /tmp/privacy-analysis-dyson-smoke.json --output-dir /tmp 2>&1 | tail -5
```

Expected: success, slide count > 0, no errors.

- [ ] **Step 4: Verify the new fingerprinting slide rendered**

```bash
grep -c "Active Fingerprinting" /tmp/dyson.com-privacy-audit.html
grep -c "API Call Detail" /tmp/dyson.com-privacy-audit.html
grep -c "stackedSignals\|active fingerprinting" /tmp/dyson.com-privacy-audit.html | head
```

Expected: Active Fingerprinting heading present, API Call Detail subsection present.

- [ ] **Step 5: Generate the DPO deck WITH private appendix**

```bash
node scripts/generate.js /tmp/privacy-analysis-dyson-smoke.json --output-dir /tmp --include-private-appendix 2>&1 | tail -5
```

Expected: success, slide count includes the two new appendix slides (Tier 3 + Out-of-Scope).

- [ ] **Step 6: Verify appendix slides rendered**

```bash
grep -o 'data-title="[^"]*"' /tmp/dyson.com-privacy-audit.html | grep -E "Tier 3|Out of Scope"
```

Expected: both appendix slide titles appear.

- [ ] **Step 7: Final commit if anything changed**

If Steps 1-6 prompted any code adjustments, commit them:

```bash
cd /Users/datagobes/.claude/skills/privacy-scan
git add -A && git commit -m "fix: end-to-end smoke-test adjustments"
```

---

## Self-Review Checklist (post-implementation)

Before declaring done, verify:

- [ ] Every spec section has a corresponding task: tier classification (Tasks 1-8), stacking (Task 9), output schema (Task 9 + 12), slide changes (Tasks 13-14), scoring (Task 15), private appendix (Task 14), reference docs (Task 15), tests (Tasks 10, 16, 17, 18)
- [ ] No "TBD" / "TODO" / vague placeholders in any task
- [ ] All function/method/property names referenced in later tasks match earlier definitions (e.g., `aggregateFingerprinting`, `stackedSignals`, `tier1Calls`, `commercialSdks`, `outOfScopeCaveats` — these names appear consistently throughout)
- [ ] Backwards-compat path exists: `buildFingerprintingLegacy` for old scans (Task 13)
- [ ] Validator changes are additive (optional fields, no new required fields) so old analyses still pass (Task 12)
- [ ] Test fixture (Task 10) covers every Tier 1 and a representative Tier 2 + Tier 3 sample
