# Privacy Audit Presentation Themes

Three theme variants available. Default is **Datagobes** (branded, portfolio-ready). Use **Dark Forensic** for security teams or **Corporate Clean** for client-facing reports.

## Theme Selection

Add `data-theme="datagobes"` (default), `data-theme="dark"`, or `data-theme="corporate"` to the `<html>` element. The CSS handles all via attribute selectors.

## Font Loading

Use Google Fonts via `@import` at the top of the `<style>` block. Do NOT embed fonts as base64 — it bloats the file and breaks rendering.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
```

## CSS Custom Properties — Datagobes (default)

Light cream background (`#f0ebe0`) with warm dark text (`#1c1917`), ember accent (`#c75c2c`). White cards float on cream for depth layering. RAG severity colors use deeper tones for light-bg contrast. Designed for LinkedIn sharing and portfolio presentation.

```css
:root, [data-theme="datagobes"] {
    /* Background — warm cream, white card surfaces */
    --bg-primary: #f0ebe0;
    --bg-card: #ffffff;
    --bg-card-border: rgba(28,25,23,0.08);

    /* Text hierarchy — warm darks on cream */
    --text-primary: #1c1917;
    --text-secondary: #6b6259;
    --text-muted: #a09888;

    /* Accent — ember (#c75c2c) */
    --accent: #c75c2c;
    --accent-soft: rgba(199,92,44,0.08);
    --accent-glow: rgba(199,92,44,0.04);
    --accent-secondary: #d4724a;
    --accent-tertiary: #a84e26;
    --accent-green: #059669;
    --accent-yellow: #d97706;
    --accent-red: #dc2626;
    --accent-blue: #2563eb;

    /* Brand — ember, used for watermark + brand header */
    --brand-ember: #c75c2c;

    /* Grid */
    --grid-color: rgba(28,25,23,0.02);

    /* Typography */
    --font-display: 'Inter', system-ui, -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
    --title-size: clamp(1.75rem, 5vw, 4rem);
    --h2-size: clamp(1.4rem, 3.5vw, 2.5rem);
    --h3-size: clamp(1rem, 2vw, 1.4rem);
    --body-size: clamp(0.75rem, 1.3vw, 1rem);
    --small-size: clamp(0.6rem, 0.9vw, 0.8rem);
    --mono-size: clamp(0.6rem, 0.85vw, 0.75rem);

    /* Spacing */
    --slide-padding: clamp(1.5rem, 5vw, 5rem);
    --content-gap: clamp(0.75rem, 2vw, 2rem);
    --element-gap: clamp(0.4rem, 1vw, 0.75rem);

    /* Animation */
    --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
    --duration: 0.6s;

    /* Theme-specific */
    --gradient-start: #c75c2c;
    --gradient-mid: #d4724a;
    --gradient-end: #a84e26;
    --progress-gradient: linear-gradient(90deg, #a84e26, #c75c2c, #d4724a);
    --code-bg: rgba(28,25,23,0.04);
    --table-border: rgba(28,25,23,0.08);
    --table-border-subtle: rgba(28,25,23,0.04);
    --badge-border: rgba(199,92,44,0.3);

    /* Light-theme shadows (replace glows) */
    --card-shadow: 0 1px 3px rgba(28,25,23,0.06), 0 1px 2px rgba(28,25,23,0.04);
    --card-shadow-hover: 0 4px 12px rgba(28,25,23,0.08), 0 2px 4px rgba(28,25,23,0.04);
    --card-shadow-accent: 0 2px 8px rgba(199,92,44,0.1), 0 1px 3px rgba(199,92,44,0.06);
}

/* Datagobes cards — white surfaces on cream with subtle shadow */
[data-theme="datagobes"] .card,
[data-theme="datagobes"] .stat-box,
[data-theme="datagobes"] .finding-card,
[data-theme="datagobes"] .cat-card,
[data-theme="datagobes"] .tr-card,
[data-theme="datagobes"] .cm-card,
[data-theme="datagobes"] .rp-row {
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    box-shadow: var(--card-shadow);
}

/* Datagobes accent text — ember */
[data-theme="datagobes"] .gradient-text {
    color: #c75c2c;
    -webkit-text-fill-color: #c75c2c;
}

/* Datagobes subtle noise grain — very light on cream */
[data-theme="datagobes"] body::after {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 50;
    opacity: 0.015;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 256px 256px;
}

/* Datagobes ambient accents — warm shadows instead of glows on light bg */
[data-theme="datagobes"] .glow-red::after {
    background: radial-gradient(ellipse, rgba(199,92,44,0.03) 0%, transparent 70%);
}
[data-theme="datagobes"] .glow-right::after {
    background: radial-gradient(ellipse, rgba(199,92,44,0.02) 0%, transparent 70%);
}

/* Datagobes badge */
[data-theme="datagobes"] .badge {
    color: var(--accent);
    border-color: var(--badge-border);
}

/* Datagobes nav dot */
[data-theme="datagobes"] .nav-dot.active {
    background: var(--accent);
    box-shadow: 0 0 8px rgba(199,92,44,0.3);
}

/* Datagobes severity colors — deeper tones for light bg contrast */
[data-theme="datagobes"] .severity-high { color: #dc2626; }
[data-theme="datagobes"] .severity-med { color: #d97706; }
[data-theme="datagobes"] .severity-low { color: #059669; }

/* Datagobes pills — light bg variants with deeper colors */
[data-theme="datagobes"] .pill-red { background: rgba(220,38,38,0.08); color: #dc2626; }
[data-theme="datagobes"] .pill-yellow { background: rgba(217,119,6,0.08); color: #d97706; }
[data-theme="datagobes"] .pill-green { background: rgba(5,150,105,0.08); color: #059669; }
[data-theme="datagobes"] .pill-blue { background: rgba(199,92,44,0.08); color: #c75c2c; }

/* Datagobes score-range badges — deeper tones on white cards */
[data-theme="datagobes"] .score-excellent { background: rgba(5,150,105,0.08); color: #059669; border-color: rgba(5,150,105,0.2); }
[data-theme="datagobes"] .score-good { background: rgba(5,150,105,0.06); color: #16a34a; border-color: rgba(22,163,74,0.2); }
[data-theme="datagobes"] .score-acceptable { background: rgba(217,119,6,0.08); color: #d97706; border-color: rgba(217,119,6,0.2); }
[data-theme="datagobes"] .score-poor { background: rgba(234,88,12,0.08); color: #ea580c; border-color: rgba(234,88,12,0.2); }
[data-theme="datagobes"] .score-bad { background: rgba(220,38,38,0.08); color: #dc2626; border-color: rgba(220,38,38,0.2); }

/* Datagobes card styling — dark-accented edges */
[data-theme="datagobes"] .card {
    border-left: 3px solid rgba(28,25,23,0.12);
    box-shadow: inset 0 0 0 1px rgba(28,25,23,0.06), var(--card-shadow);
}
[data-theme="datagobes"] .risk-card {
    border-left: 3px solid var(--accent);
}
[data-theme="datagobes"] .risk-card-label {
    font-family: var(--font-mono);
    color: var(--accent);
}

/* Datagobes status cards — tinted backgrounds, readable on cream */
[data-theme="datagobes"] .bp-annotation.bp-fail {
    background: rgba(220,38,38,0.06);
    border-left: 3px solid var(--accent-red);
}
[data-theme="datagobes"] .bp-annotation.bp-pass {
    background: rgba(5,150,105,0.06);
    border-left: 3px solid var(--accent-green);
}
[data-theme="datagobes"] .bp-annotation.bp-warn {
    background: rgba(217,119,6,0.06);
    border-left: 3px solid var(--accent-yellow);
}

/* Datagobes stat-box num */
[data-theme="datagobes"] .stat-box .num {
    color: var(--accent);
}

/* Datagobes gauge — subtle track on cream */
[data-theme="datagobes"] .gauge-track {
    stroke: rgba(28,25,23,0.06);
}

/* Datagobes score bars — white card track surface */
[data-theme="datagobes"] .score-bar-track {
    background: rgba(28,25,23,0.04);
}
[data-theme="datagobes"] .score-bar-separator {
    background: rgba(28,25,23,0.08);
}

/* Datagobes branding watermark — bottom-left of every slide */
[data-theme="datagobes"] .datagobes-watermark {
    position: absolute;
    bottom: clamp(1rem, 2vw, 2rem);
    left: var(--slide-padding);
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    color: var(--text-muted);
    letter-spacing: 0.1em;
}
[data-theme="datagobes"] .datagobes-watermark a {
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.2s;
}
[data-theme="datagobes"] .datagobes-watermark a:hover {
    color: var(--accent);
}

/* Datagobes title slide brand header */
[data-theme="datagobes"] .brand-header {
    display: flex;
    align-items: center;
    gap: clamp(0.5rem, 1vw, 1rem);
    margin-bottom: clamp(1rem, 2vh, 2rem);
}
[data-theme="datagobes"] .brand-header .brand-name {
    font-family: var(--font-mono);
    font-size: var(--h3-size);
    font-weight: 700;
    letter-spacing: -0.02em;
}
[data-theme="datagobes"] .brand-header .brand-separator {
    width: 1px;
    height: clamp(1rem, 2vw, 1.5rem);
    background: var(--text-muted);
}
[data-theme="datagobes"] .brand-header .brand-label {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--text-muted);
}

/* Datagobes progress bar — ember gradient on cream */
[data-theme="datagobes"] .progress-bar {
    background: var(--progress-gradient);
}

/* Datagobes hero grade badge — warm shadow instead of glow */
[data-theme="datagobes"] .hero-grade {
    box-shadow: var(--card-shadow-accent);
}
```

## CSS Custom Properties — Dark Forensic

Red/orange accents for security teams. Internal/dramatic.

```css
[data-theme="dark"] {
    /* Background */
    --bg-primary: #0a0e17;
    --bg-card: rgba(255,255,255,0.02);
    --bg-card-border: rgba(255,255,255,0.06);

    /* Text hierarchy */
    --text-primary: #e8eaf0;
    --text-secondary: #6b7280;
    --text-muted: #3b4252;

    /* Accent colors */
    --accent: #ef4444;
    --accent-soft: rgba(239,68,68,0.15);
    --accent-glow: rgba(239,68,68,0.08);
    --accent-secondary: #f97316;
    --accent-green: #22c55e;
    --accent-yellow: #eab308;
    --accent-red: #ef4444;
    --accent-blue: #3b82f6;

    /* Grid */
    --grid-color: rgba(99,102,241,0.04);

    /* Theme-specific */
    --gradient-start: #ef4444;
    --gradient-end: #f97316;
    --progress-gradient: linear-gradient(90deg, #ef4444, #f97316);
    --code-bg: rgba(0,0,0,0.4);
    --table-border: rgba(255,255,255,0.06);
    --table-border-subtle: rgba(255,255,255,0.03);
    --badge-border: rgba(239,68,68,0.3);
}

[data-theme="dark"] .gradient-text {
    background: linear-gradient(135deg, #ef4444, #f97316);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
```

## CSS Custom Properties — Corporate Clean

```css
[data-theme="corporate"] {
    /* Background */
    --bg-primary: #ffffff;
    --bg-card: rgba(0,0,0,0.02);
    --bg-card-border: rgba(0,0,0,0.08);

    /* Text hierarchy */
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --text-muted: #9ca3af;

    /* Accent colors — professional blue instead of red */
    --accent: #2563eb;
    --accent-soft: rgba(37,99,235,0.1);
    --accent-glow: rgba(37,99,235,0.05);
    --accent-secondary: #7c3aed;
    --accent-green: #059669;
    --accent-yellow: #d97706;
    --accent-red: #dc2626;
    --accent-blue: #2563eb;

    /* Grid */
    --grid-color: rgba(0,0,0,0.03);

    /* Theme-specific */
    --gradient-start: #2563eb;
    --gradient-end: #7c3aed;
    --progress-gradient: linear-gradient(90deg, #2563eb, #7c3aed);
    --code-bg: rgba(0,0,0,0.03);
    --table-border: rgba(0,0,0,0.08);
    --table-border-subtle: rgba(0,0,0,0.04);
    --badge-border: rgba(37,99,235,0.3);
}

/* Corporate-specific overrides */
[data-theme="corporate"] .gradient-text {
    background: linear-gradient(135deg, #2563eb, #7c3aed);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

[data-theme="corporate"] .badge {
    color: var(--accent);
    border-color: var(--badge-border);
}

[data-theme="corporate"] .progress-bar {
    background: var(--progress-gradient);
}

[data-theme="corporate"] .nav-dot.active {
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent-glow);
}

/* Corporate score-range badges */
[data-theme="corporate"] .score-excellent { background: rgba(5,150,105,0.08); color: #059669; border-color: rgba(5,150,105,0.2); }
[data-theme="corporate"] .score-good { background: rgba(5,150,105,0.06); color: #10b981; border-color: rgba(16,185,129,0.2); }
[data-theme="corporate"] .score-acceptable { background: rgba(217,119,6,0.08); color: #d97706; border-color: rgba(217,119,6,0.2); }
[data-theme="corporate"] .score-poor { background: rgba(234,88,12,0.08); color: #ea580c; border-color: rgba(234,88,12,0.2); }
[data-theme="corporate"] .score-bad { background: rgba(220,38,38,0.08); color: #dc2626; border-color: rgba(220,38,38,0.2); }

/* Corporate severity colors for readability on white */
[data-theme="corporate"] .severity-high { color: #dc2626; }
[data-theme="corporate"] .severity-med { color: #d97706; }
[data-theme="corporate"] .severity-low { color: #059669; }

[data-theme="corporate"] .pill-red { background: rgba(220,38,38,0.08); color: #dc2626; }
[data-theme="corporate"] .pill-yellow { background: rgba(217,119,6,0.08); color: #d97706; }
[data-theme="corporate"] .pill-green { background: rgba(5,150,105,0.08); color: #059669; }
[data-theme="corporate"] .pill-blue { background: rgba(37,99,235,0.08); color: #2563eb; }

/* Corporate glow is subtle blue instead of red */
[data-theme="corporate"] .glow-red::after {
    background: radial-gradient(ellipse, rgba(37,99,235,0.04) 0%, transparent 70%);
}
[data-theme="corporate"] .glow-right::after {
    background: radial-gradient(ellipse, rgba(37,99,235,0.04) 0%, transparent 70%);
}

/* Print-friendly: corporate theme hides nav, removes animations */
@media print {
    [data-theme="corporate"] .nav-dots,
    [data-theme="corporate"] .progress-bar { display: none; }
    [data-theme="corporate"] .slide { break-after: page; height: auto; min-height: 100vh; }
    [data-theme="corporate"] .reveal { opacity: 1; transform: none; }
}
```

## Base Styles

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

html {
    scroll-snap-type: y mandatory;
    scroll-behavior: smooth;
    height: 100%;
}

body {
    font-family: var(--font-display);
    background: var(--bg-primary);
    color: var(--text-primary);
    overflow-x: hidden;
    height: 100%;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}
```

## Slide Container

```css
.slide {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    scroll-snap-align: start;
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
    padding: var(--slide-padding);
}

.slide-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-height: 100%;
    overflow: hidden;
}

/* Grid background on all slides */
.slide::before {
    content: '';
    position: absolute; inset: 0;
    background-image:
        linear-gradient(var(--grid-color) 1px, transparent 1px),
        linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
}
```

## Typography

```css
h1 { font-size: var(--title-size); font-weight: 700; line-height: 1.1; color: var(--text-primary); }
h2 { font-size: var(--h2-size); font-weight: 700; line-height: 1.15; color: var(--text-primary); }
h3 { font-size: var(--h3-size); font-weight: 600; line-height: 1.3; color: var(--text-primary); }
p { font-size: var(--body-size); line-height: 1.6; color: var(--text-secondary); }

.gradient-text {
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
```

## Component Library

### Badge
```css
.badge {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--accent);
    border: 1px solid var(--badge-border);
    padding: 0.4em 1.2em;
    border-radius: 100px;
    display: inline-block;
    margin-bottom: clamp(0.75rem, 1.5vh, 1.5rem);
}
.slide-desc {
    font-size: var(--small-size);
    color: var(--text-secondary);
    max-width: 600px;
    line-height: 1.5;
    margin-bottom: clamp(0.5rem, 1vh, 1rem);
}
```

### Card
```css
.card {
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 12px;
    padding: clamp(0.75rem, 1.5vw, 1.25rem);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
```

### Out-of-Scope Caveats

Scoped layout for the methodology "Out-of-Scope Caveats" slide — a balanced grid
of exclusion cards so the content fills the canvas instead of stranding it
top-left. Classes are namespaced `oos-` and fully self-contained.

```css
/* Two-panel layout: a left title/summary rail beside the stack of exclusion
   cards. Balances the 16:9 canvas on both axes for the small item counts typical
   of this slide, instead of stranding content top-left or stretching cards. */
.oos-content {
    display: grid;
    grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
    gap: clamp(2rem, 5vw, 5rem);
    align-content: center;   /* centre the whole block vertically … */
    align-items: start;      /* … while the rail + first card share a top baseline */
}
@media (max-width: 900px) {
    .oos-content { grid-template-columns: 1fr; gap: clamp(1.25rem, 4vh, 2rem); }
}
.oos-rail { display: flex; flex-direction: column; align-items: flex-start; }
.oos-rail h2 { margin: 0.15em 0 0.4em; }
.oos-rail .slide-desc {
    margin-bottom: clamp(1.5rem, 4vh, 2.5rem);
    max-width: 460px;
    font-size: var(--body-size);
    color: var(--text-secondary);
}
.oos-summary { display: flex; align-items: center; gap: 0.85rem; }
.oos-summary-num {
    font-family: var(--font-mono);
    font-size: clamp(2.5rem, 5vw, 3.75rem);
    font-weight: 700;
    line-height: 1;
    color: var(--accent);
}
.oos-summary-label {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary);
    line-height: 1.35;
}

.oos-cards { display: flex; flex-direction: column; gap: clamp(0.85rem, 1.8vh, 1.4rem); }
.oos-card {
    display: flex;
    align-items: center;
    gap: clamp(1rem, 1.6vw, 1.4rem);
    padding: clamp(1rem, 1.6vw, 1.5rem) clamp(1.1rem, 1.8vw, 1.7rem);
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 14px;
    box-shadow: var(--card-shadow);
}
/* single filled-ember icon is the sole accent per card — one focal punch */
.oos-card-icon {
    flex-shrink: 0;
    width: clamp(38px, 3vw, 48px);
    height: clamp(38px, 3vw, 48px);
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: var(--accent);
    color: #fff;
    box-shadow: var(--card-shadow-accent);
}
.oos-card-icon svg { width: 54%; height: 54%; }
.oos-card-body { flex: 1; min-width: 0; }
.oos-card-kicker {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 0.4em;
}
/* one coherent sentence — emphasised subject, full-contrast predicate, so the
   actual finding reads as part of the line rather than a faint afterthought */
.oos-card-line {
    margin: 0;
    font-size: clamp(0.95rem, 1.25vw, 1.15rem);
    line-height: 1.5;
    color: #3a352f;
}
.oos-card-line strong { font-weight: 600; color: var(--text-primary); }
```

### Fingerprinting Tier 3 Appendix

Two-panel layout (consistent with Out-of-Scope) for the private Tier 3 appendix: a
left title/summary rail beside a proper proportional bar chart of API-call counts.
Namespaced `fpx-` so it never touches the shared `fp-*` fingerprinting classes.

```css
.fpx-content {
    display: grid;
    grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
    gap: clamp(2rem, 5vw, 5rem);
    align-content: center;  /* centre the row block vertically in the slide */
    align-items: stretch;   /* both columns equal height, content centred within → symmetric */
}
@media (max-width: 900px) {
    .fpx-content { grid-template-columns: 1fr; gap: clamp(1.25rem, 4vh, 2rem); align-items: center; }
}
.fpx-rail { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; }
.fpx-rail h2 { margin: 0.15em 0 0.4em; }
.fpx-rail .slide-desc {
    margin-bottom: clamp(1.5rem, 4vh, 2.5rem);
    max-width: 460px;
    font-size: var(--body-size);
    color: var(--text-secondary);
}
.fpx-summary { display: flex; gap: clamp(1.5rem, 3vw, 2.75rem); }
.fpx-stat { display: flex; flex-direction: column; }
.fpx-stat-num {
    font-family: var(--font-mono);
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 700;
    line-height: 1;
    color: var(--accent);
}
.fpx-stat-label {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary);
    margin-top: 0.45em;
}

.fpx-chart { display: flex; flex-direction: column; justify-content: center; gap: clamp(1rem, 2.4vh, 1.8rem); width: 100%; }
.fpx-chart-head {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    padding-bottom: 0.5em;
    border-bottom: 1px solid var(--bg-card-border);
}
.fpx-row {
    display: grid;
    grid-template-columns: minmax(110px, 0.55fr) 1fr auto;
    align-items: center;
    gap: clamp(0.75rem, 1.5vw, 1.25rem);
}
.fpx-name {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.fpx-bar-track {
    height: clamp(20px, 2.8vh, 30px);
    /* quarter gridlines show through the unfilled portion of the track for scale */
    background-color: rgba(28,25,23,0.05);
    background-image: linear-gradient(90deg, rgba(28,25,23,0.08) 1px, transparent 1px);
    background-size: 25% 100%;
    border-radius: 100px;
    overflow: hidden;
}
.fpx-bar {
    height: 100%;
    min-width: 8px;
    border-radius: 100px;
    background: linear-gradient(90deg, var(--accent-tertiary), var(--accent));
}
.fpx-val {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: var(--body-size);
    color: var(--text-primary);
    text-align: right;
    min-width: 2.5ch;
}
.fpx-note {
    margin-top: clamp(0.5rem, 1.5vh, 1rem);
    padding-top: 0.7em;
    border-top: 1px solid var(--bg-card-border);
    font-size: var(--small-size);
    color: var(--text-secondary);
}
```

### Stats Strip
```css
.stats-strip {
    display: flex;
    gap: clamp(1rem, 2vw, 2rem);
    flex-wrap: wrap;
}
.stat-box {
    text-align: center;
    padding: clamp(0.75rem, 1.5vw, 1.25rem) clamp(1rem, 2vw, 2rem);
    border: 1px solid var(--bg-card-border);
    border-radius: 12px;
    background: var(--bg-card);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    flex: 1;
    min-width: 100px;
}
.stat-box .num {
    font-family: var(--font-mono);
    font-size: clamp(1.5rem, 3vw, 2.5rem);
    font-weight: 700;
    color: var(--accent);
}
.stat-box .label {
    font-size: var(--small-size);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-top: 0.2rem;
}
```

### Evidence Table
```css
.evidence-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--body-size);
}
.evidence-table th {
    text-align: left;
    font-size: var(--small-size);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    padding: 0.5em 0.75em;
    border-bottom: 1px solid var(--table-border);
}
.evidence-table td {
    padding: clamp(0.4rem, 0.8vh, 0.65rem) 0.75em;
    border-bottom: 1px solid var(--table-border-subtle);
    color: var(--text-secondary);
    font-size: var(--body-size);
}
.evidence-table td:first-child {
    color: var(--text-primary);
    font-weight: 500;
}
```

### Severity Indicators
```css
.severity-high { color: #ef4444; }
.severity-med { color: #eab308; }
.severity-low { color: #22c55e; }

.pill {
    display: inline-block;
    padding: 0.15em 0.6em;
    border-radius: 100px;
    font-size: var(--small-size);
    font-weight: 600;
}
.pill-red { background: rgba(239,68,68,0.15); color: #ef4444; }
.pill-yellow { background: rgba(234,179,8,0.15); color: #eab308; }
.pill-green { background: rgba(34,197,94,0.15); color: #22c55e; }
.pill-blue { background: rgba(59,130,246,0.15); color: #3b82f6; }

/* Flex-wrap container for a chip cloud of .pill items */
.pill-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(0.3rem, 0.6vw, 0.5rem);
    margin-top: var(--element-gap);
}
```

### Callout

General-purpose aside / "why it matters" note. Severity is tokenised so it
adapts across themes — never hardcode the colour inline. Mirrors the `.rs-note`
surface treatment so it sits naturally next to the score notes.

```css
.callout {
    margin-top: var(--content-gap);
    padding: clamp(0.55rem, 1.1vw, 0.85rem) clamp(0.75rem, 1.4vw, 1.15rem);
    background: rgba(28,25,23,0.025);
    border-radius: 8px;
    border-left: 3px solid var(--accent);
    font-size: var(--body-size);
    color: var(--text-secondary);
    line-height: 1.55;
}
.callout strong { color: var(--text-primary); }
.callout + .callout { margin-top: var(--element-gap); }
.callout-bad { border-left-color: var(--accent-red); }
.callout-good { border-left-color: var(--accent-green); }
.callout-info { border-left-color: var(--accent-blue); }
.callout-label {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    margin-right: 0.5em;
}
.callout-bad .callout-label { color: var(--accent-red); }
.callout-good .callout-label { color: var(--accent-green); }
.callout-info .callout-label { color: var(--accent-blue); }
```

### Custom Slide Body

Wrapper for custom-slide content. No heavy card box of its own, so the inner
components (`.tracker-grid`, `.split-compare`, `.callout`, …) own their
structure. `finding-highlight` adds an accent rail.

```css
.custom-body {
    width: 100%;
}
.custom-body-highlight {
    border-left: 3px solid var(--accent);
    padding-left: clamp(0.75rem, 1.5vw, 1.25rem);
}

/* Structured custom-slide extras (cs.metrics / cs.tags). Scoped so they enlarge
   ONLY inside custom slides — the shared .stat-box / .pill defaults elsewhere are
   untouched. */
.cs-metrics {
    margin-top: clamp(1.25rem, 3vh, 2.25rem);
    gap: clamp(1rem, 2vw, 1.75rem);
}
.cs-metrics .stat-box {
    padding: clamp(1.1rem, 2.2vw, 2rem) clamp(1rem, 2vw, 2rem);
    text-align: left;
}
.cs-metrics .stat-box .num { font-size: clamp(2.2rem, 4.5vw, 3.5rem); line-height: 1; }
.cs-metrics .stat-box .label { margin-top: 0.5rem; }
.cs-stat-danger { border-color: rgba(220,38,38,0.3); background: rgba(220,38,38,0.05); }
.cs-stat-danger .num { color: var(--accent-red); }

.cs-tags {
    margin-top: clamp(1.25rem, 3vh, 2rem);
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
}
.cs-tags-label {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-secondary);
}
.cs-tags .pill-cloud { margin-top: 0; gap: clamp(0.5rem, 1vw, 0.85rem); }
.cs-tags .pill {
    display: inline-flex;
    align-items: center;
    font-size: clamp(0.9rem, 1.15vw, 1.1rem);
    font-weight: 600;
    padding: 0.5em 1.05em;
}
.cs-tags .pill::before {
    content: "";
    width: 0.5em; height: 0.5em;
    border-radius: 50%;
    background: currentColor;
    margin-right: 0.55em;
}
```

### Code Block
```css
.code-block {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    background: var(--code-bg);
    border: 1px solid var(--table-border);
    border-radius: 8px;
    padding: clamp(0.5rem, 1vw, 1rem) clamp(0.75rem, 1.5vw, 1.25rem);
    line-height: 1.7;
    overflow: hidden;
    color: var(--text-secondary);
}
.code-block .key { color: #7dd3fc; }
.code-block .val { color: #86efac; }
.code-block .comment { color: #475569; }
```

### Tracker Grid
```css
.tracker-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
    gap: clamp(0.5rem, 1vw, 0.75rem);
}
.tracker-card {
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 10px;
    padding: clamp(0.6rem, 1.2vw, 1rem);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
}
.tracker-card .name { font-weight: 600; font-size: var(--body-size); color: var(--text-primary); margin-bottom: 0.2rem; }
.tracker-card .domain { font-family: var(--font-mono); font-size: var(--mono-size); color: var(--accent); margin-bottom: 0.3rem; }
.tracker-card .desc { font-size: var(--small-size); color: var(--text-secondary); line-height: 1.4; }
```

### Domain Grid
```css
.domain-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
    gap: clamp(0.3rem, 0.6vw, 0.5rem);
}
.domain-item {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    padding: 0.4em 0.8em;
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 0.5em;
}
.domain-item .dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
}
```

### Recommendation Cards
```css
.rec-list {
    display: flex;
    flex-direction: column;
    gap: clamp(0.3rem, 0.6vh, 0.5rem);
}
.rec-item {
    display: flex;
    align-items: flex-start;
    gap: clamp(0.5rem, 1vw, 0.75rem);
    padding: clamp(0.5rem, 1vw, 0.75rem);
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 8px;
}
.rec-num {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    font-weight: 600;
    color: var(--accent);
    flex-shrink: 0;
    width: 1.5em;
}
.rec-text {
    font-size: var(--body-size);
    color: var(--text-secondary);
    line-height: 1.4;
}
.rec-text strong { color: var(--text-primary); }
```

### Hero Grade Badge (title slide)

Large animated grade badge for the title slide — the first thing viewers notice.

```css
.hero-grade {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: clamp(4.5rem, 10vw, 7rem);
    height: clamp(4.5rem, 10vw, 7rem);
    padding: 0 0.3em;
    border-radius: 16px;
    font-family: var(--font-mono);
    font-size: clamp(1.6rem, 3.5vw, 2.8rem);
    font-weight: 800;
    animation: grade-pulse 3s ease-in-out infinite;
    margin-top: var(--element-gap);
}

@keyframes grade-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(var(--grade-pulse-rgb), 0.15); }
    50% { box-shadow: 0 0 0 12px rgba(var(--grade-pulse-rgb), 0.0); }
}
```

Set `--grade-pulse-rgb` per score range:
- 7.0+ (excellent/good): `5,150,105` (green)
- 5.5-6.9 (acceptable): `217,119,6` (amber)
- 4.0-5.4 (poor): `234,88,12` (orange)
- below 4.0 (bad): `220,38,38` (red)

### Favicon Embed (title slide)

Embed the target site's favicon next to the domain name for visual recognition.

```css
.domain-with-favicon {
    display: flex;
    align-items: center;
    gap: clamp(0.5rem, 1vw, 1rem);
}
.site-favicon {
    width: clamp(1.5rem, 3vw, 2.5rem);
    height: clamp(1.5rem, 3vw, 2.5rem);
    border-radius: 6px;
    border: 1px solid var(--bg-card-border);
    object-fit: contain;
    background: var(--bg-card);
}
```

**CRITICAL: Favicon must be fetched and embedded correctly.** Use the Bash tool to fetch and encode:

```bash
curl -sL "https://www.google.com/s2/favicons?domain={DOMAIN}&sz=128" | base64
```

Copy the **complete** base64 output into the `src` attribute: `src="data:image/png;base64,{FULL_BASE64_STRING}"`. The output is typically 500-3000 characters — if your base64 string is shorter than 200 characters, the fetch failed or was truncated. Re-fetch and verify.

### Section Divider

Gradient horizontal rule between major sections for visual breathing room.

```css
.section-divider {
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    border: none;
    margin: var(--content-gap) 0;
    opacity: 0.3;
}
```

### Score Badge (for risk scoring — 1.0-10.0 scale)
```css
.score-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: clamp(2.5rem, 5vw, 4rem);
    height: clamp(2.5rem, 5vw, 4rem);
    border-radius: 12px;
    font-family: var(--font-mono);
    font-size: clamp(1rem, 2.5vw, 1.5rem);
    font-weight: 700;
    padding: 0 0.4em;
}
.score-excellent { background: rgba(34,197,94,0.15); color: #22c55e; border: 2px solid rgba(34,197,94,0.3); }
.score-good { background: rgba(34,197,94,0.1); color: #4ade80; border: 2px solid rgba(74,222,128,0.3); }
.score-acceptable { background: rgba(234,179,8,0.15); color: #eab308; border: 2px solid rgba(234,179,8,0.3); }
.score-poor { background: rgba(249,115,22,0.15); color: #f97316; border: 2px solid rgba(249,115,22,0.3); }
.score-bad { background: rgba(239,68,68,0.15); color: #ef4444; border: 2px solid rgba(239,68,68,0.3); }
```

### Risk Summary Grid
```css
.risk-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(0.4rem, 0.8vw, 0.6rem);
    margin-top: var(--content-gap);
}
.risk-card {
    display: flex;
    align-items: center;
    gap: clamp(0.5rem, 1vw, 0.75rem);
    padding: clamp(0.5rem, 1vw, 0.75rem);
}
.risk-card-score {
    font-size: clamp(1rem, 2vw, 1.4rem);
    min-width: 2.5rem;
    height: 2.5rem;
}
.risk-card-info {
    flex: 1;
    min-width: 0;
}
.risk-card-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.2;
}
.risk-card-weight {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    color: var(--text-muted);
    margin-top: 0.1rem;
}
.risk-overall {
    text-align: center;
    margin-top: 0.75rem;
    padding: 1.25rem 2rem;
    max-width: 260px;
    margin-left: auto;
    margin-right: auto;
    border-left: none !important;
}
```

### Audit Gauge (title slide)

SVG circular gauge that fills proportional to score. Ring animates via CSS transition on `.slide.visible`.

```css
.audit-gauge {
    position: relative;
    width: 200px;
    height: 200px;
    margin: var(--element-gap) auto;
}
.gauge-ring {
    display: block;
}
.gauge-track {
    opacity: 1;
}
.gauge-fill {
    transition: stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide.visible .gauge-fill {
    stroke-dashoffset: var(--gauge-offset) !important;
}
.gauge-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}
.gauge-score {
    font-family: var(--font-mono);
    font-size: clamp(2.2rem, 5vw, 3rem);
    font-weight: 800;
    line-height: 1;
}
.gauge-verdict {
    font-family: var(--font-mono);
    font-size: clamp(0.55rem, 1vw, 0.75rem);
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin-top: 0.25rem;
}
.title-meta {
    font-size: var(--small-size);
    color: var(--text-secondary);
    text-align: center;
    max-width: 45ch;
    margin-top: var(--element-gap);
}
```

### Score Bars (risk summary)

Horizontal bar chart for category scores. Bars fill with staggered animation on `.slide.visible`.

```css
.score-bars {
    display: flex;
    flex-direction: column;
    gap: clamp(0.3rem, 0.6vw, 0.5rem);
    margin-top: var(--content-gap);
    width: 100%;
    max-width: 560px;
}
.score-bar-row {
    display: grid;
    grid-template-columns: 160px 1fr 3.5rem;
    align-items: center;
    gap: clamp(0.4rem, 0.8vw, 0.75rem);
}
.score-bar-label {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    min-width: 0;
}
.score-bar-name {
    font-family: var(--font-mono);
    font-size: clamp(0.65rem, 1vw, 0.8rem);
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
}
.score-bar-weight {
    font-family: var(--font-mono);
    font-size: clamp(0.5rem, 0.8vw, 0.65rem);
    color: var(--text-muted);
}
.score-bar-track {
    height: clamp(0.5rem, 1vw, 0.65rem);
    background: rgba(28,25,23,0.04);
    border-radius: 4px;
    overflow: hidden;
}
.score-bar-fill {
    height: 100%;
    width: 0;
    border-radius: 4px;
    transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide.visible .score-bar-fill {
    width: var(--bar-width);
}
.score-bar-excellent { background: #059669; }
.score-bar-good { background: #16a34a; }
.score-bar-acceptable { background: #d97706; }
.score-bar-poor { background: #ea580c; }
.score-bar-bad { background: #dc2626; }
.score-bar-value {
    font-family: var(--font-mono);
    font-size: clamp(0.75rem, 1.2vw, 0.95rem);
    font-weight: 700;
    text-align: right;
}
.score-bar-separator {
    height: 1px;
    background: rgba(28,25,23,0.08);
    margin: clamp(0.2rem, 0.4vw, 0.4rem) 0;
}
.score-bar-overall .score-bar-name {
    font-size: clamp(0.75rem, 1.2vw, 0.95rem);
    font-weight: 700;
}
.score-bar-overall .score-bar-track {
    height: clamp(0.65rem, 1.2vw, 0.85rem);
}
.score-bar-overall .score-bar-value {
    font-size: clamp(0.9rem, 1.4vw, 1.1rem);
}

/* Risk Summary — unified layout with inline bars in note cards */
.rs-layout {
    margin-top: var(--content-gap);
}
.rs-layout.rs-unified {
    display: flex;
    flex-direction: column;
    gap: clamp(1rem, 2vw, 1.5rem);
}
.rs-notes-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(0.5rem, 1vw, 0.75rem);
}
.rs-overall {
    max-width: 560px;
    margin: 0 auto;
    width: 100%;
}
.rs-note {
    padding: clamp(0.4rem, 0.8vw, 0.6rem) clamp(0.6rem, 1vw, 0.8rem);
    background: rgba(28,25,23,0.025);
    border-radius: 6px;
    border-left: 3px solid rgba(28,25,23,0.1);
}
.rs-note-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.2rem;
}
.rs-note-bar {
    margin: 0.25rem 0;
}
.rs-note-bar-track {
    height: clamp(0.3rem, 0.5vw, 0.4rem);
    background: rgba(28,25,23,0.04);
    border-radius: 3px;
    overflow: hidden;
}
.rs-note-bar-fill {
    height: 100%;
    width: 0;
    border-radius: 3px;
    transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide.visible .rs-note-bar-fill {
    width: var(--bar-width);
}
.rs-note-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}
.rs-dot-excellent { background: #059669; }
.rs-dot-good { background: #16a34a; }
.rs-dot-acceptable { background: #d97706; }
.rs-dot-poor { background: #ea580c; }
.rs-dot-bad { background: #dc2626; }
.rs-note-cat {
    font-family: var(--font-mono);
    font-size: clamp(0.6rem, 0.9vw, 0.75rem);
    font-weight: 700;
    color: var(--text-primary);
}
.rs-note-score {
    font-family: var(--font-mono);
    font-size: clamp(0.55rem, 0.8vw, 0.65rem);
    font-weight: 600;
    margin-left: auto;
}
.rs-note-text {
    font-size: clamp(0.55rem, 0.85vw, 0.7rem);
    line-height: 1.4;
    color: var(--text-secondary);
    margin: 0;
}
```

### Security Header Scorecard
```css
.header-row {
    display: flex;
    align-items: center;
    padding: clamp(0.3rem, 0.6vh, 0.5rem) 0;
    border-bottom: 1px solid var(--table-border-subtle);
    gap: 1rem;
}
.header-name {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    color: var(--text-primary);
    min-width: 200px;
}
.header-status {
    font-size: var(--small-size);
    font-weight: 600;
}
.header-present { color: #22c55e; }
.header-missing { color: #ef4444; }
.header-partial { color: #eab308; }
```

## Animations

Smoother scale+translate entrance for a premium feel:

```css
.reveal {
    opacity: 0;
    transform: scale(0.98) translateY(20px);
    transition: opacity var(--duration) var(--ease-out-expo),
                transform var(--duration) var(--ease-out-expo);
}
.slide.visible .reveal {
    opacity: 1;
    transform: scale(1) translateY(0);
}
.slide.visible .reveal:nth-child(1) { transition-delay: 0.05s; }
.slide.visible .reveal:nth-child(2) { transition-delay: 0.15s; }
.slide.visible .reveal:nth-child(3) { transition-delay: 0.25s; }
.slide.visible .reveal:nth-child(4) { transition-delay: 0.35s; }
.slide.visible .reveal:nth-child(5) { transition-delay: 0.45s; }
.slide.visible .reveal:nth-child(6) { transition-delay: 0.55s; }
```

## Navigation Elements

```css
.slide-num {
    position: absolute;
    bottom: clamp(1rem, 2vw, 2rem);
    right: clamp(1.5rem, 3vw, 3rem);
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    color: var(--text-muted);
}

.progress-bar {
    position: fixed;
    top: 0; left: 0;
    height: 3px;
    background: var(--progress-gradient);
    z-index: 100;
    transition: width 0.3s ease;
}

.nav-dots {
    position: fixed;
    right: clamp(0.5rem, 1vw, 1rem);
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 100;
}
.nav-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--text-muted);
    cursor: pointer;
    transition: all 0.3s ease;
    border: none;
    padding: 0;
}
.nav-dot {
    opacity: 0.5;
    transition: all 0.3s ease;
}
.nav-dot.active {
    opacity: 1;
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent-glow);
    transform: scale(1.5);
}
```

## Glow Accents

```css
.glow-red::after {
    content: '';
    position: absolute;
    top: -30%; left: -10%;
    width: 50%; height: 80%;
    background: radial-gradient(ellipse, var(--accent-glow) 0%, transparent 70%);
    pointer-events: none;
}
.glow-right::after {
    content: '';
    position: absolute;
    bottom: -20%; right: -10%;
    width: 50%; height: 70%;
    background: radial-gradient(ellipse, var(--accent-glow) 0%, transparent 70%);
    pointer-events: none;
}
```

## Responsive Breakpoints

```css
@media (max-height: 700px) {
    :root {
        --slide-padding: clamp(1rem, 3vw, 2.5rem);
        --content-gap: clamp(0.5rem, 1.5vw, 1rem);
        --title-size: clamp(1.5rem, 4.5vw, 2.5rem);
        --h2-size: clamp(1.2rem, 3vw, 1.75rem);
    }
}
@media (max-height: 600px) {
    :root {
        --slide-padding: clamp(0.75rem, 2.5vw, 1.5rem);
        --content-gap: clamp(0.4rem, 1vw, 0.75rem);
        --title-size: clamp(1.25rem, 4vw, 2rem);
        --body-size: clamp(0.65rem, 1vw, 0.85rem);
    }
    .nav-dots { display: none; }
}
@media (max-height: 500px) {
    :root {
        --slide-padding: clamp(0.5rem, 2vw, 1rem);
        --title-size: clamp(1rem, 3.5vw, 1.5rem);
        --h2-size: clamp(0.9rem, 2.5vw, 1.25rem);
        --body-size: clamp(0.6rem, 0.9vw, 0.8rem);
    }
}
@media (max-width: 600px) {
    :root { --title-size: clamp(1.5rem, 8vw, 2.5rem); }
    .tracker-grid { grid-template-columns: 1fr; }
    .stats-strip { flex-direction: column; }
    .risk-grid { grid-template-columns: 1fr; }
    .split-compare { grid-template-columns: 1fr; }
    .fs-factor-grid { grid-template-columns: 1fr; }
    .tc-dest-grid { grid-template-columns: 1fr; }
    .risk-card { width: 100%; }
    .persist-chart { overflow-x: auto; }
    .score-bar-row { grid-template-columns: 100px 1fr 2.5rem; }
    .rs-notes-grid { grid-template-columns: 1fr; }
    .audit-gauge { width: 160px; height: 160px; }
}
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.2s !important;
    }
    html { scroll-behavior: auto; }
}
```

## JavaScript Navigation

```js
class SlidePresentation {
    constructor() {
        this.slides = document.querySelectorAll('.slide');
        this.progressBar = document.getElementById('progress');
        this.navDotsContainer = document.getElementById('navDots');
        this.currentSlide = 0;

        this.createNavDots();
        this.setupIntersectionObserver();
        this.setupKeyboardNav();
        this.updateProgress();
    }

    createNavDots() {
        this.slides.forEach((slide, i) => {
            const dot = document.createElement('button');
            dot.className = 'nav-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', `Go to slide ${i + 1}: ${slide.dataset.title || ''}`);
            dot.addEventListener('click', () => {
                this.slides[i].scrollIntoView({ behavior: 'smooth' });
            });
            this.navDotsContainer.appendChild(dot);
        });
        this.navDots = document.querySelectorAll('.nav-dot');
    }

    setupIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    const index = Array.from(this.slides).indexOf(entry.target);
                    this.currentSlide = index;
                    this.updateProgress();
                    this.updateNavDots();
                }
            });
        }, { threshold: 0.4 });

        this.slides.forEach(slide => observer.observe(slide));
    }

    setupKeyboardNav() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                const next = Math.min(this.currentSlide + 1, this.slides.length - 1);
                this.slides[next].scrollIntoView({ behavior: 'smooth' });
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const prev = Math.max(this.currentSlide - 1, 0);
                this.slides[prev].scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    updateProgress() {
        const pct = ((this.currentSlide + 1) / this.slides.length) * 100;
        this.progressBar.style.width = pct + '%';
    }

    updateNavDots() {
        this.navDots.forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentSlide);
        });
    }
}

new SlidePresentation();
```

## Branding Component

When a company name or logo is provided, add the branding bar to the title slide.

### Branding CSS
```css
.brand-bar {
    display: flex;
    align-items: center;
    gap: clamp(0.5rem, 1vw, 1rem);
    margin-bottom: clamp(1rem, 2vh, 2rem);
}
.brand-logo {
    height: clamp(1.5rem, 3vw, 2.5rem);
    width: auto;
    object-fit: contain;
}
.brand-name {
    font-family: var(--font-display);
    font-size: var(--h3-size);
    font-weight: 600;
    color: var(--text-secondary);
}
.brand-separator {
    width: 1px;
    height: clamp(1rem, 2vw, 1.5rem);
    background: var(--text-muted);
}
/* Footer branding on every slide */
.brand-footer {
    position: absolute;
    bottom: clamp(1rem, 2vw, 2rem);
    left: var(--slide-padding);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--mono-size);
    color: var(--text-muted);
    font-family: var(--font-mono);
}
.brand-footer img {
    height: clamp(0.75rem, 1.2vw, 1rem);
    width: auto;
    opacity: 0.5;
}
```

### Branding HTML (title slide)

When logo URL is provided — embed as base64 data URI (fetch the image and convert):
```html
<div class="brand-bar reveal">
    <img class="brand-logo" src="data:image/png;base64,{LOGO_BASE64}" alt="{COMPANY} logo">
    <div class="brand-separator"></div>
    <span class="brand-name">{COMPANY}</span>
</div>
```

When only company name is provided (no logo):
```html
<div class="brand-bar reveal">
    <span class="brand-name">{COMPANY}</span>
    <div class="brand-separator"></div>
    <span style="font-family: var(--font-mono); font-size: var(--mono-size); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.15em;">Privacy Audit</span>
</div>
```

### Footer branding (on every slide, bottom-left)
```html
<div class="brand-footer">
    <span>Prepared for {COMPANY}</span>
</div>
```

## Datagobes Watermark

When using the `datagobes` theme (default), add a subtle watermark to every slide (bottom-left, before `slide-num`):

```html
<div class="datagobes-watermark">
    <a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a>
</div>
```

This replaces the brand-footer for non-branded scans. When `--company` is provided, the brand-footer takes precedence (both can coexist).

## HTML Shell

```html
<!DOCTYPE html>
<html lang="en" data-theme="{THEME}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Audit #{EPISODE}: {DOMAIN} — datagobes.dev</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔒</text></svg>">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        /* Theme CSS: include ALL theme variable blocks (datagobes + dark + corporate) */
        /* Component + layout CSS (all sections above) */
        /* Branding CSS (if branding is used) */
    </style>
</head>
<body>

<div class="progress-bar" id="progress"></div>
<nav class="nav-dots" id="navDots"></nav>

<!-- Slide 1: Title — hero grade badge, favicon, episode number, series branding -->
<section class="slide glow-red" data-title="Title">
    <div class="slide-content">
        <!-- Datagobes brand header with episode number -->
        <div class="brand-header reveal">
            <span class="brand-name gradient-text"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</span>
            <div class="brand-separator"></div>
            <span class="brand-label">Privacy Audit #{EPISODE}</span>
        </div>
        <!-- Optional: company brand bar (only if company/logo provided, below the brand header) -->
        <!-- Domain with embedded favicon -->
        <div class="domain-with-favicon reveal">
            <img class="site-favicon" src="data:image/png;base64,{FAVICON_BASE64}" alt="{DOMAIN} favicon">
            <h1><span class="gradient-text">{DOMAIN}</span></h1>
        </div>
        <!-- Hero grade badge with pulse animation -->
        <div class="hero-grade grade-{GRADE} reveal" style="--grade-pulse-rgb: {GRADE_RGB};">{GRADE}</div>
        <p class="reveal" style="max-width: 45ch; margin-top: var(--element-gap);">
            {SUBTITLE}
        </p>
        <div class="stats-strip reveal" style="margin-top: var(--content-gap);">
            <div class="stat-box">
                <div class="num">{TRACKER_COUNT}</div>
                <div class="label">Trackers</div>
            </div>
            <div class="stat-box">
                <div class="num">{COOKIE_COUNT}</div>
                <div class="label">Cookies</div>
            </div>
            <div class="stat-box">
                <div class="num">{SCORE}</div>
                <div class="label">Score</div>
            </div>
        </div>
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">1 / {TOTAL}</div>
</section>

<!-- More slides follow the same pattern -->

<script>
// Navigation JS (see above)
</script>
</body>
</html>
```

## Slide Templates

Use these slide types as building blocks. Mix and match based on findings.

### TL;DR Slide

Quick-hook slide for social media — 3 key takeaways that immediately communicate the story. Place as slide 2.

```html
<section class="slide" data-title="TL;DR">
    <div class="slide-content">
        <span class="badge reveal">TL;DR</span>
        <h2 class="reveal">Three Things to Know</h2>
        <div style="display: flex; flex-direction: column; gap: var(--content-gap); margin-top: var(--content-gap); max-width: 600px;">
            <div class="card reveal" style="display: flex; align-items: flex-start; gap: 1rem; border-left: 3px solid {COLOR_1};">
                <span style="font-size: 1.5rem;">{EMOJI_1}</span>
                <div>
                    <div style="font-weight: 600; color: var(--text-primary);">{HEADLINE_1}</div>
                    <div style="font-size: var(--small-size); color: var(--text-secondary); margin-top: 0.25rem;">{DETAIL_1}</div>
                </div>
            </div>
            <!-- Repeat for 2 and 3 -->
        </div>
        <p class="reveal" style="font-size: var(--small-size); color: var(--text-muted); margin-top: var(--content-gap);">Scroll for the full story →</p>
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">2 / {TOTAL}</div>
</section>
```

Pick 3 findings that tell the story: one positive, one negative, one surprising.

### Before vs After Slide

Split comparison showing pre-consent vs post-consent state. Powerful visual for showing consent mechanism effectiveness.

```css
.split-compare {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--content-gap);
    margin-top: var(--content-gap);
}
.split-col {
    padding: clamp(0.75rem, 1.5vw, 1.25rem);
}
.split-col h3 {
    font-size: var(--h3-size);
    margin-bottom: var(--element-gap);
    padding-bottom: var(--element-gap);
    border-bottom: 1px solid var(--table-border-subtle);
}

/* Before/After enhanced layout */
.ba-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: var(--element-gap);
    margin-top: var(--content-gap);
    align-items: start;
}
.ba-panel {
    padding: clamp(0.75rem, 1.5vw, 1.25rem);
}
.ba-panel h3 {
    font-size: var(--h3-size);
    margin-bottom: var(--element-gap);
    padding-bottom: var(--element-gap);
    border-bottom: 1px solid var(--table-border-subtle);
}
.ba-big-num {
    font-family: var(--font-mono);
    font-size: clamp(1.5rem, 3vw, 2.5rem);
    font-weight: 700;
    line-height: 1.1;
}
.ba-big-unit {
    font-size: 0.5em;
    font-weight: 400;
    opacity: 0.7;
}
.ba-cat-row {
    display: grid;
    grid-template-columns: 5.5rem 2rem 1fr;
    gap: 0.4rem;
    align-items: center;
    padding: clamp(0.1rem, 0.2vh, 0.15rem) 0;
    font-size: var(--small-size);
}
.ba-cat-label {
    color: var(--text-secondary);
    text-transform: capitalize;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ba-cat-count {
    font-family: var(--font-mono);
    font-weight: 600;
    text-align: right;
    font-size: var(--mono-size);
}
.ba-cat-bar {
    height: 6px;
    background: var(--bg-card-border);
    border-radius: 3px;
    overflow: hidden;
}
.ba-cat-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.6s var(--ease-out-expo);
}
.ba-stat-line {
    margin-top: var(--element-gap);
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    color: var(--text-muted);
}
.ba-storage {
    margin-top: 0.3rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
}
.ba-storage-badge {
    font-family: var(--font-mono);
    font-size: calc(var(--mono-size) * 0.9);
    color: var(--text-muted);
    background: var(--code-bg);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
}
.ba-delta {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0;
    align-self: center;
}
.ba-delta-arrow {
    font-size: clamp(1.2rem, 2vw, 1.8rem);
    color: var(--text-muted);
    margin-bottom: 0.3rem;
}
.ba-delta-stats {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    text-align: center;
}
.ba-delta-item {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    color: var(--text-muted);
    white-space: nowrap;
}
.ba-delta-up {
    color: var(--accent-red);
    font-weight: 600;
}
@media (max-width: 768px) {
    .ba-grid { grid-template-columns: 1fr; }
    .ba-delta { flex-direction: row; gap: 0.5rem; padding: 0.3rem 0; }
    .ba-delta-arrow { transform: rotate(90deg); margin-bottom: 0; }
    .ba-delta-stats { flex-direction: row; flex-wrap: wrap; justify-content: center; }
}
```

```html
<section class="slide" data-title="Before vs After">
    <div class="slide-content">
        <span class="badge reveal">Consent Delta</span>
        <h2 class="reveal">Before vs After Consent</h2>
        <div class="split-compare reveal">
            <div class="card split-col" style="border-top: 3px solid var(--accent-red);">
                <h3>Before Consent</h3>
                <div style="font-family: var(--font-mono); font-size: clamp(1.5rem, 3vw, 2.5rem); font-weight: 700; color: var(--accent-red);">{PRE_COUNT} cookies</div>
                <div style="margin-top: var(--element-gap);">
                    <!-- Pill breakdown of cookie categories -->
                </div>
            </div>
            <div class="card split-col" style="border-top: 3px solid var(--accent-yellow);">
                <h3>After Accept</h3>
                <div style="font-family: var(--font-mono); font-size: clamp(1.5rem, 3vw, 2.5rem); font-weight: 700; color: var(--accent-yellow);">{POST_COUNT} cookies</div>
                <div style="margin-top: var(--element-gap);">
                    <!-- Pill breakdown of new cookie categories -->
                </div>
            </div>
        </div>
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">{N} / {TOTAL}</div>
</section>
```

### Series Footer (final slide)

On the last slide (usually Methodology or Recommendations), add series branding:

```html
<hr class="section-divider reveal">
<p class="reveal" style="font-family: var(--font-mono); font-size: var(--small-size); color: var(--text-muted); text-align: center; margin-top: var(--element-gap);">
    Privacy Audit #{EPISODE} in the <span class="gradient-text" style="font-weight: 600;">datagobes.dev</span> series
</p>
```

### Audit Trail Timeline

The timeline is the evidence backbone — a chronological audit trail showing every network request and cookie as it happens. Split into 2 slides at the consent click boundary.

#### Timeline CSS

```css
/* Container — vertical line on left */
.timeline {
    position: relative;
    padding-left: clamp(2.5rem, 5vw, 4rem);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: clamp(0.3rem, 0.9vh, 0.7rem);
    flex: 1;
    min-height: 0;
}
.timeline::before {
    content: '';
    position: absolute;
    left: clamp(0.65rem, 1.2vw, 0.85rem);
    top: clamp(0.4rem, 1vh, 0.8rem); bottom: clamp(0.4rem, 1vh, 0.8rem);
    width: 2px;
    background: linear-gradient(180deg, var(--accent), var(--accent-secondary), var(--accent-tertiary));
    opacity: 0.25;
}

/* Phase marker label */
.tl-phase {
    position: relative;
    margin: clamp(0.4rem, 0.8vh, 0.6rem) 0 clamp(0.6rem, 1.2vh, 1rem);
    margin-left: clamp(0.25rem, 0.5vw, 0.5rem);
}
.tl-phase-label {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-family: var(--font-mono); font-size: var(--mono-size);
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;
    padding: 0.3em 1em; border-radius: 100px;
}
.tl-phase-pre .tl-phase-label { background: rgba(220,38,38,0.06); color: #dc2626; border: 1px solid rgba(220,38,38,0.15); }
.tl-phase-consent .tl-phase-label { background: rgba(107,98,89,0.06); color: var(--accent); border: 1px solid rgba(107,98,89,0.15); }
.tl-phase-post .tl-phase-label { background: rgba(217,119,6,0.06); color: #d97706; border: 1px solid rgba(217,119,6,0.15); }

/* Consent click divider */
.tl-consent-break {
    position: relative;
    margin: clamp(0.5rem, 1vh, 0.8rem) 0;
    margin-left: calc(-1 * clamp(2.5rem, 5vw, 4rem));
    display: flex; align-items: center; gap: 0.75rem;
}
.tl-consent-break::before, .tl-consent-break::after {
    content: ''; flex: 1; height: 2px;
}
.tl-consent-break::before { background: linear-gradient(90deg, var(--accent), var(--accent-secondary), transparent); }
.tl-consent-break::after { background: linear-gradient(90deg, transparent, var(--accent-secondary), var(--accent)); }
.tl-consent-click {
    font-family: var(--font-mono); font-size: var(--mono-size);
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;
    color: var(--accent); white-space: nowrap;
    padding: 0.3em 1em; background: var(--accent-soft);
    border: 1px solid rgba(79,70,229,0.2); border-radius: 100px;
}

/* Single event row */
.tl-event {
    position: relative;
    display: grid; grid-template-columns: clamp(2.5rem, 4vw, 3.5rem) 1fr;
    gap: clamp(0.4rem, 0.8vw, 0.7rem); align-items: start;
    padding: clamp(0.32rem, 0.7vh, 0.55rem) 0;
}
/* Every event body is a subtle card → uniform width + disciplined column */
.tl-body {
    background: rgba(28,25,23,0.022);
    border: 1px solid var(--bg-card-border);
    border-left: 3px solid var(--text-muted);
    border-radius: 9px;
    padding: clamp(0.4rem, 0.85vh, 0.62rem) clamp(0.6rem, 1.2vw, 0.95rem);
}
/* Violation events — the compliance failures must land hard */
.tl-event-violation .tl-body {
    background: rgba(220,38,38,0.05);
    border: 1px solid rgba(220,38,38,0.18);
    border-left: 3px solid var(--accent-red);
    border-radius: 9px;
    padding: clamp(0.45rem, 0.9vh, 0.7rem) clamp(0.6rem, 1.2vw, 0.95rem);
    margin-top: -0.2rem;
}
.tl-event-violation .tl-time { color: var(--accent-red); font-weight: 600; }
/* Dot on timeline */
.tl-event::before {
    content: ''; position: absolute;
    left: calc(-1 * clamp(2.5rem, 5vw, 4rem) + clamp(0.35rem, 0.8vw, 0.55rem));
    top: clamp(0.4rem, 0.7vh, 0.55rem);
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--text-muted);
    border: 2px solid var(--bg-primary);
    box-shadow: 0 0 0 1px var(--bg-card-border); z-index: 1;
}
/* Dot color variants */
.tl-event.tl-essential::before { background: #059669; box-shadow: 0 0 0 1px rgba(5,150,105,0.3); }
.tl-event.tl-tracking::before { background: #dc2626; box-shadow: 0 0 0 2px rgba(220,38,38,0.15); }
.tl-event.tl-adtech::before { background: #d97706; box-shadow: 0 0 0 2px rgba(217,119,6,0.15); }
.tl-event.tl-security::before { background: #0ea5e9; box-shadow: 0 0 0 1px rgba(14,165,233,0.3); }
.tl-event.tl-consent-ev::before { background: var(--accent); box-shadow: 0 0 0 2px rgba(79,70,229,0.2); width: 10px; height: 10px; }

/* Timestamp, title, description */
.tl-time { font-family: var(--font-mono); font-size: clamp(0.6rem, 0.8vw, 0.74rem); color: var(--text-secondary); text-align: right; white-space: nowrap; padding-top: 0.05rem; }
.tl-title { font-size: clamp(0.82rem, 1.35vw, 1.05rem); font-weight: 600; color: var(--text-primary); line-height: 1.3; }
.tl-title .tl-domain { font-family: var(--font-mono); font-size: var(--mono-size); font-weight: 400; color: var(--accent); margin-left: 0.35rem; }
.tl-desc { font-size: clamp(0.66rem, 0.92vw, 0.82rem); color: var(--text-secondary); line-height: 1.4; margin-top: 0.15rem; }

/* Grouped domain chips */
.tl-group { display: flex; flex-wrap: wrap; gap: clamp(0.2rem, 0.4vw, 0.3rem); margin-top: 0.2rem; }
.tl-group-chip {
    font-family: var(--font-mono); font-size: clamp(0.5rem, 0.7vw, 0.65rem);
    padding: 0.15em 0.5em; border-radius: 4px;
    background: var(--bg-card); border: 1px solid var(--bg-card-border);
    color: var(--text-secondary); display: inline-flex; align-items: center; gap: 0.3em;
}
.tl-group-chip .chip-count { font-weight: 700; color: var(--text-primary); }
.tl-group-chip.chip-tracking { border-color: rgba(220,38,38,0.15); color: #dc2626; }
.tl-group-chip.chip-adtech { border-color: rgba(217,119,6,0.15); color: #d97706; }
.tl-group-chip.chip-essential { border-color: rgba(5,150,105,0.15); color: #059669; }

/* Inline violation/ok tags */
.tl-tag {
    display: inline-block; font-family: var(--font-mono);
    font-size: clamp(0.56rem, 0.74vw, 0.68rem);
    padding: 0.22em 0.62em; border-radius: 100px; font-weight: 700;
    letter-spacing: 0.05em; text-transform: uppercase;
    vertical-align: middle; margin-left: 0.4rem; white-space: nowrap;
}
.tl-tag-violation { background: var(--accent-red); color: #fff; }
.tl-tag-ok { background: rgba(5,150,105,0.1); color: #059669; border: 1px solid rgba(5,150,105,0.25); }
.tl-tag-warn { background: rgba(217,119,6,0.1); color: #d97706; border: 1px solid rgba(217,119,6,0.25); }

/* Audit-Trail Post-Reject (atr-*) — two-column: timeline (left) + verdict panel (right). */
.atr-layout {
    display: flex;
    gap: clamp(0.7rem, 1.6vw, 1.4rem);
    align-items: stretch;
    flex: 1;
    min-height: 0;
    margin-top: clamp(0.5rem, 1.2vh, 1rem);
}
.atr-layout .timeline { flex: 1.8; margin-top: 0; }
.atr-side {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: clamp(0.2rem, 0.6vh, 0.4rem);
    padding: clamp(1rem, 2vw, 1.7rem);
    background: rgba(220,38,38,0.06);
    border: 1px solid rgba(220,38,38,0.22);
    border-left: 4px solid var(--accent-red);
    border-radius: 14px;
}
.atr-side-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: clamp(26px, 3vw, 34px); height: clamp(26px, 3vw, 34px);
    border-radius: 50%; background: var(--accent-red); color: #fff;
    margin-bottom: clamp(0.3rem, 0.8vh, 0.55rem);
}
.atr-side-icon svg { width: 58%; height: 58%; }
.atr-bignum {
    font-family: var(--font-display);
    font-size: clamp(3rem, 7vw, 5.5rem);
    font-weight: 800; line-height: 0.92;
    color: var(--accent-red);
}
.atr-biglabel {
    font-family: var(--font-display);
    font-size: clamp(1rem, 1.7vw, 1.35rem);
    font-weight: 700; color: var(--text-primary); line-height: 1.2;
}
.atr-bignote {
    font-size: clamp(0.72rem, 1vw, 0.88rem);
    color: var(--text-secondary); line-height: 1.45; margin-top: 0.35rem;
}
.atr-offenders {
    display: flex; flex-direction: column; gap: clamp(0.25rem, 0.6vh, 0.42rem);
    margin-top: clamp(0.55rem, 1.2vh, 0.9rem);
    padding-top: clamp(0.5rem, 1.1vh, 0.8rem);
    border-top: 1px solid rgba(220,38,38,0.2);
}
.atr-offender {
    display: flex; align-items: center; gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: clamp(0.7rem, 0.95vw, 0.84rem);
    font-weight: 600; color: var(--text-primary);
}
.atr-offender-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-red); flex: none; }
```

#### Timeline HTML structure

**Slide A: Pre-Consent Trail** — everything that happens from page load to consent banner appearing. This is the evidence slide that proves violations.

```html
<section class="slide" data-title="Audit Trail: Pre-Consent">
    <div class="slide-content">
        <span class="badge reveal">Audit Trail</span>
        <h2 class="reveal">What Happens Before You Click <span style="color: var(--accent-red);">Anything</span></h2>
        <div class="timeline reveal">
            <div class="tl-phase tl-phase-pre reveal">
                <span class="tl-phase-label">Phase 1 — Page Load (no interaction)</span>
            </div>
            <div class="tl-event tl-essential reveal">
                <span class="tl-time">t+0ms</span>
                <div class="tl-body">
                    <div class="tl-title">Document Request <span class="tl-domain">{DOMAIN}</span></div>
                    <div class="tl-desc">Initial navigation — fresh browser, no cookies, EU locale</div>
                </div>
            </div>
            <!-- More events... group static assets, highlight tracking/ad-tech -->
            <div class="tl-event tl-tracking reveal">
                <span class="tl-time">t+{MS}ms</span>
                <div class="tl-body">
                    <div class="tl-title">{TRACKER_NAME} <span class="tl-domain">{DOMAIN}</span> <span class="tl-tag tl-tag-violation">Pre-Consent</span></div>
                    <div class="tl-group">
                        <span class="tl-group-chip chip-tracking">{COOKIE} ({EXPIRY})</span>
                    </div>
                </div>
            </div>
            <div class="tl-event tl-consent-ev reveal">
                <span class="tl-time">t+3s</span>
                <div class="tl-body">
                    <div class="tl-title">Consent Banner Rendered <span class="tl-tag tl-tag-ok">Detected</span></div>
                </div>
            </div>
        </div>
    </div>
</section>
```

**Slide B: Post-Consent Trail** — starts with the consent click divider, then shows what activates.

```html
<section class="slide" data-title="Audit Trail: Post-Consent">
    <div class="slide-content">
        <span class="badge reveal">Audit Trail</span>
        <h2 class="reveal">What Happens After <span class="gradient-text">Accept</span></h2>
        <div class="timeline reveal">
            <div class="tl-consent-break reveal">
                <span class="tl-consent-click">User Clicks Accept</span>
            </div>
            <div class="tl-phase tl-phase-post reveal">
                <span class="tl-phase-label">Phase 2 — Post-Consent</span>
            </div>
            <!-- Post-consent events -->
            <div class="tl-event tl-consent-ev reveal">
                <span class="tl-time">t+{END}s</span>
                <div class="tl-body">
                    <div class="tl-title">Scan Complete <span class="tl-tag tl-tag-ok">Done</span></div>
                    <div class="tl-desc">{TOTAL} cookies total • {NEW} new post-consent • {SYSTEMS} tracking systems</div>
                </div>
            </div>
        </div>
    </div>
</section>
```

**Grouping strategy** — keep to ~10 events per slide:
- Collapse static assets into one event with chip counts
- Collapse essential cookies into one event with chips
- Expand each tracking/ad-tech system as its own event
- Use `tl-group-chip` for individual cookies/domains within a group

### Evidence Slide (table-based)
```html
<section class="slide" data-title="{TITLE}">
    <div class="slide-content">
        <span class="badge reveal">{CATEGORY}</span>
        <h2 class="reveal">{TITLE}</h2>
        <table class="evidence-table" style="margin-top: var(--content-gap);">
            <thead><tr><th>Item</th><th>Details</th><th>Risk</th></tr></thead>
            <tbody>
                <tr class="reveal">
                    <td>{NAME}</td>
                    <td>{DETAIL}</td>
                    <td><span class="pill pill-red">High</span></td>
                </tr>
            </tbody>
        </table>
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">{N} / {TOTAL}</div>
</section>
```

### Tracker Grid Slide

See **Tracker Radar** in the Supplementary Components section below for the dedicated visual component.

### Grade/Score Slide
```html
<section class="slide glow-right" data-title="Risk Summary">
    <div class="slide-content">
        <span class="badge reveal">Risk Assessment</span>
        <h2 class="reveal">Privacy Risk Summary</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: var(--content-gap);">
            <div class="card reveal" style="text-align: center;">
                <div class="grade-badge grade-{GRADE}" style="margin: 0 auto 0.5rem;">{GRADE}</div>
                <div style="color: var(--text-primary); font-weight: 600;">{CATEGORY}</div>
                <div style="color: var(--text-secondary); font-size: var(--small-size);">{SCORE}%</div>
            </div>
        </div>
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">{N} / {TOTAL}</div>
</section>
```

## Content Density Rules

CRITICAL — every slide MUST fit in one viewport:

| Slide Type | Maximum Content |
|------------|----------------|
| Title | 1 heading + 1 subtitle + 3-4 stat boxes |
| Evidence table | 1 heading + max 6 rows |
| Tracker grid | 1 heading + max 6 cards |
| Cookie table | 1 heading + max 8 rows (split if more) |
| Domain list | 1 heading + max 12 domain items |
| Recommendations | 1 heading + max 6 items |
| Code block | 1 heading + max 10 lines |

If content exceeds limits → split into multiple slides (e.g., "Cookies (1/2)", "Cookies (2/2)").

---

## Category Components

Each of the 7 scoring categories has a dedicated visual component. These are **mandatory** — when presenting a category, always use its component. The agent can adapt content, but the visual structure must match.

| Category | Component | Status |
|----------|-----------|--------|
| Consent Mechanism | Banner Blueprint | New |
| Pre-Consent Tracking | Audit Trail Timeline | Existing (above) |
| Legal Pages | Document Shelf | New |
| Cross-Border Transfers | Transfer Circuit | New |
| Security Headers | Shield Rings | New |
| Cookie Management | Persistence Bars | New |
| Dark Patterns | Fairness Scale | New |

---

### 1. Banner Blueprint (Consent Mechanism)

A technical schematic that reverse-engineers the consent banner — like an architect's annotated blueprint. Shows the banner's actual layout with measurement lines, color swatches, and compliance annotations. Makes the viewer *see* the consent UI as a technical artifact under inspection.

#### Banner Blueprint CSS

```css
/* Blueprint container — technical drawing aesthetic */
.blueprint {
    position: relative;
    background:
        linear-gradient(var(--bp-grid, rgba(240,235,224,0.03)) 1px, transparent 1px),
        linear-gradient(90deg, var(--bp-grid, rgba(240,235,224,0.03)) 1px, transparent 1px);
    background-size: 20px 20px;
    border: 1px solid var(--bg-card-border);
    border-radius: 12px;
    padding: clamp(1rem, 2vw, 1.5rem);
    margin-top: var(--content-gap);
}

/* The reconstructed banner wireframe */
.bp-banner {
    border: 2px dashed var(--text-muted);
    border-radius: 8px;
    padding: clamp(0.6rem, 1.2vw, 1rem) clamp(0.75rem, 1.5vw, 1.25rem);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: clamp(0.75rem, 1.5vw, 1.25rem);
    position: relative;
}

/* Banner text placeholder */
.bp-banner-text {
    font-size: var(--body-size);
    color: var(--text-secondary);
    font-style: italic;
    flex: 1;
    min-width: 0;
}

/* Button pair — the core of the analysis */
.bp-buttons {
    display: flex;
    gap: clamp(0.4rem, 0.8vw, 0.6rem);
    flex-shrink: 0;
}
.bp-btn {
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    font-weight: 600;
    padding: 0.5em 1em;
    text-align: center;
    position: relative;
    border: 2px solid transparent;
    white-space: nowrap;
}
/* Accept button reconstruction */
.bp-btn-accept {
    background: var(--accent-soft);
    color: var(--text-primary);
    border-color: var(--accent);
}
/* Reject button reconstruction */
.bp-btn-reject {
    background: var(--bg-card);
    color: var(--text-secondary);
    border-color: var(--bg-card-border);
}
/* Visual emphasis when buttons are equal size */
.bp-btn-equal { flex: 1; }
/* Visual emphasis when accept is larger (dark pattern) */
.bp-btn-large { flex: 2; font-size: calc(var(--mono-size) * 1.2); }
.bp-btn-small { flex: 1; font-size: calc(var(--mono-size) * 0.85); opacity: 0.7; }

/* Measurement annotation lines */
.bp-measure {
    position: relative;
    display: flex;
    align-items: center;
    margin-top: clamp(0.5rem, 1vh, 0.75rem);
    gap: 0.3rem;
}
.bp-measure-line {
    flex: 1;
    height: 0;
    border-top: 1px dashed var(--text-muted);
    position: relative;
}
.bp-measure-line::before, .bp-measure-line::after {
    content: '';
    position: absolute;
    top: -3px;
    width: 1px;
    height: 6px;
    background: var(--text-muted);
}
.bp-measure-line::before { left: 0; }
.bp-measure-line::after { right: 0; }
.bp-measure-label {
    font-family: var(--font-mono);
    font-size: clamp(0.5rem, 0.7vw, 0.6rem);
    color: var(--text-muted);
    white-space: nowrap;
    padding: 0 0.3em;
}

/* Annotation callouts — point to specific banner features */
.bp-annotations {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
    gap: clamp(0.4rem, 0.8vw, 0.6rem);
    margin-top: clamp(0.6rem, 1.2vh, 1rem);
}
.bp-annotation {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: clamp(0.5rem, 1vw, 0.75rem);
    border-left: 2px solid var(--text-muted);
    border-radius: 6px;
}
.bp-annotation.bp-pass { border-left-color: var(--accent-green); }
.bp-annotation.bp-fail { border-left-color: var(--accent-red); }
.bp-annotation.bp-warn { border-left-color: var(--accent-yellow); }
.bp-annotation-icon {
    font-size: var(--body-size);
    flex-shrink: 0;
    width: 1.2em;
    text-align: center;
}
.bp-annotation-text {
    font-size: var(--small-size);
    color: var(--text-secondary);
    line-height: 1.35;
}
.bp-annotation-text strong {
    color: var(--text-primary);
    display: block;
    margin-bottom: 0.1em;
}

/* CMP platform badge */
.bp-platform {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    padding: 0.3em 0.8em;
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 6px;
    color: var(--text-secondary);
    margin-bottom: var(--element-gap);
}
.bp-platform-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent);
}
```

#### Banner Blueprint HTML

```html
<section class="slide" data-title="Consent Mechanism">
    <div class="slide-content">
        <span class="badge reveal">Consent Mechanism</span>
        <h2 class="reveal">Banner Blueprint</h2>
        <div class="bp-platform reveal">
            <span class="bp-platform-dot"></span>
            {CMP_NAME} <!-- e.g. "OneTrust", "Cookiebot", "Custom", "None Detected" -->
        </div>
        <div class="blueprint reveal">
            <div class="bp-banner">
                <div class="bp-banner-text">"{BANNER_TEXT}"</div>
                <div class="bp-buttons">
                    <!-- Equal buttons (no dark pattern): -->
                    <div class="bp-btn bp-btn-reject bp-btn-equal">{REJECT_TEXT}</div>
                    <div class="bp-btn bp-btn-accept bp-btn-equal">{ACCEPT_TEXT}</div>
                    <!-- OR asymmetric (dark pattern detected): -->
                    <!-- <div class="bp-btn bp-btn-reject bp-btn-small">{REJECT_TEXT}</div> -->
                    <!-- <div class="bp-btn bp-btn-accept bp-btn-large">{ACCEPT_TEXT}</div> -->
                </div>
            </div>
            <!-- Size comparison measurement -->
            <div class="bp-measure">
                <span class="bp-measure-label">Accept</span>
                <span class="bp-measure-line"></span>
                <span class="bp-measure-label">{ACCEPT_WIDTH}</span>
                <span class="bp-measure-line"></span>
                <span class="bp-measure-label">Reject</span>
                <span class="bp-measure-line"></span>
                <span class="bp-measure-label">{REJECT_WIDTH}</span>
            </div>
        </div>
        <!-- Compliance annotations -->
        <div class="bp-annotations reveal">
            <div class="bp-annotation bp-pass">
                <span class="bp-annotation-icon">&#10003;</span>
                <div class="bp-annotation-text">
                    <strong>Equal Button Sizing</strong>
                    No visual asymmetry between accept and reject
                </div>
            </div>
            <div class="bp-annotation bp-pass">
                <span class="bp-annotation-icon">&#10003;</span>
                <div class="bp-annotation-text">
                    <strong>One-Click Reject</strong>
                    Refuse option requires same clicks as accept
                </div>
            </div>
            <div class="bp-annotation bp-fail">
                <span class="bp-annotation-icon">&#10007;</span>
                <div class="bp-annotation-text">
                    <strong>No Granular Control</strong>
                    Binary all-or-nothing — no per-category toggles
                </div>
            </div>
            <!-- Add/remove annotations based on findings. Max 4. -->
        </div>
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">{N} / {TOTAL}</div>
</section>
```

**Adaptation rules:**
- If no banner detected: show an empty blueprint frame with dashed outline and "No Consent Banner Detected" centered in red. All annotations become `bp-fail`.
- If dark pattern (asymmetric buttons): use `bp-btn-large`/`bp-btn-small` classes. The measurement lines will visually show the size difference.
- If cookie wall: add a `bp-annotation bp-fail` noting "Cookie Wall — content blocked until consent given".
- Max 4 annotations per slide.

---

### 2. Audit Trail Timeline (Pre-Consent Tracking)

Already defined above in "Audit Trail Timeline" section. Use for the Pre-Consent Tracking category.

---

### 3. Document Shelf (Legal Pages)

A physical bookshelf metaphor — legal documents as books standing upright on a wooden shelf. Present documents have solid spines with titles; missing documents are ghost outlines (dashed borders). The shelf is a single horizontal line. Immediately communicates completeness at a glance.

#### Document Shelf CSS

```css
/* Shelf container */
/* Legal Pages — two-panel: left title/score rail beside a 2-col grid of document
   cards. Replaces the old "book shelf" whose rotated spine labels were illegible.
   Namespaced `lp-`; the shared .doc-shelf-stat/.dot rules below are untouched
   (still used by the Processor Transparency slide). */
.lp-content {
    display: grid;
    grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
    gap: clamp(2rem, 5vw, 5rem);
    align-items: stretch;   /* both columns full height; the card grid fills the canvas */
}
@media (max-width: 900px) {
    .lp-content { grid-template-columns: 1fr; gap: clamp(1.25rem, 4vh, 2rem); align-items: center; }
}
.lp-rail { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; }
.lp-rail h2 { margin: 0.15em 0 0.4em; }
.lp-rail .slide-desc {
    margin-bottom: clamp(1.5rem, 4vh, 2.5rem);
    max-width: 460px;
    font-size: var(--body-size);
    color: var(--text-secondary);
}
.lp-score { display: flex; flex-direction: column; gap: 0.35em; }
.lp-score-num {
    font-family: var(--font-mono);
    font-size: clamp(2.5rem, 5vw, 4rem);
    font-weight: 700;
    line-height: 1;
    color: var(--accent);
}
.lp-score-den { color: var(--text-muted); font-size: 0.5em; font-weight: 500; }
.lp-score-label {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-secondary);
}
.lp-score-missing { color: var(--accent-red); }

.lp-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: 1fr;
    height: 100%;
    gap: clamp(0.9rem, 1.8vw, 1.5rem);
}
.lp-card {
    display: flex;
    align-items: center;
    gap: clamp(0.85rem, 1.5vw, 1.25rem);
    min-height: clamp(120px, 18vh, 190px);
    padding: clamp(1.1rem, 2vw, 1.8rem);
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 14px;
    box-shadow: var(--card-shadow);
}
.lp-card-icon {
    flex-shrink: 0;
    width: clamp(36px, 3vw, 46px);
    height: clamp(36px, 3vw, 46px);
    display: grid;
    place-items: center;
    border-radius: 10px;
}
.lp-card-icon svg { width: 56%; height: 56%; }
.lp-card-found .lp-card-icon { background: rgba(5,150,105,0.12); color: var(--accent-green); }
.lp-card-body { display: flex; flex-direction: column; gap: 0.3em; min-width: 0; }
.lp-card-title { font-size: var(--h3-size); font-weight: 600; line-height: 1.2; color: var(--text-primary); }
.lp-card-status {
    align-self: flex-start;
    margin-top: 0.15em;
    font-family: var(--font-mono);
    font-size: clamp(0.6rem, 0.74vw, 0.72rem);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.32em 0.75em;
    border-radius: 100px;
}
.lp-card-found .lp-card-status { background: rgba(5,150,105,0.12); color: var(--accent-green); }
.lp-card-note {
    margin-top: 0.5em;
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    letter-spacing: 0.06em;
    color: var(--accent-red);
}
/* Missing card — dominant: the absence IS the slide's point */
.lp-card-missing {
    border: 2px dashed var(--accent-red);
    background: rgba(220,38,38,0.06);
}
.lp-card-missing .lp-card-icon { background: rgba(220,38,38,0.14); color: var(--accent-red); }
.lp-card-missing .lp-card-title { color: var(--accent-red); }
.lp-card-missing .lp-card-status { background: var(--accent-red); color: #fff; }

/* Shelf summary below */
.doc-shelf-summary {
    display: flex;
    justify-content: center;
    gap: clamp(1rem, 2vw, 2rem);
    margin-top: clamp(0.75rem, 1.5vh, 1.25rem);
    font-size: var(--small-size);
    color: var(--text-secondary);
}
.doc-shelf-stat {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.doc-shelf-stat .dot {
    width: 8px; height: 8px;
    border-radius: 50%;
}
.doc-shelf-stat .dot-present { background: var(--accent-green); }
.doc-shelf-stat .dot-missing { background: var(--accent-red); }
```

#### Document Shelf HTML

```html
<section class="slide" data-title="Legal Pages">
    <div class="slide-content">
        <span class="badge reveal">Legal Compliance</span>
        <h2 class="reveal">Document Shelf</h2>
        <div class="doc-shelf reveal">
            <div class="doc-books">
                <div class="doc-book doc-book-present reveal">
                    <span class="doc-book-title">Privacy Policy</span>
                    <span class="doc-book-status">Found</span>
                </div>
                <div class="doc-book doc-book-present reveal">
                    <span class="doc-book-title">Cookie Policy</span>
                    <span class="doc-book-status">Found</span>
                </div>
                <div class="doc-book doc-book-present reveal">
                    <span class="doc-book-title">Terms of Service</span>
                    <span class="doc-book-status">Found</span>
                </div>
                <div class="doc-book doc-book-missing reveal">
                    <span class="doc-book-title">Impressum</span>
                    <span class="doc-book-status">Missing</span>
                </div>
            </div>
            <div class="doc-shelf-surface"></div>
        </div>
        <div class="doc-shelf-summary reveal">
            <div class="doc-shelf-stat"><span class="dot dot-present"></span> {FOUND_COUNT} found</div>
            <div class="doc-shelf-stat"><span class="dot dot-missing"></span> {MISSING_COUNT} missing</div>
        </div>
        <!-- Optional: linked URLs below each book as small mono text -->
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">{N} / {TOTAL}</div>
</section>
```

**Adaptation rules:**
- Always show all expected documents (Privacy Policy, Cookie Policy, Terms of Service, Impressum). Mark each as present or missing.
- If site has additional legal pages (DPA, DSAR page), add extra books.
- Impressum is only expected for EU-based sites. If site is clearly non-EU, mark it as `doc-book-missing` but with a softer annotation ("Not required for non-EU entities").
- Max 6 books per shelf. If more, use two rows.

---

### 4. Transfer Circuit (Cross-Border Transfers)

A network diagram showing data flowing from the scanned site to third-party jurisdictions. The site is the central node; third parties radiate outward grouped by jurisdiction. Connection lines are colored by transfer risk (green=adequate, yellow=DPF, red=no safeguards). Immediately shows the data flow geography.

#### Transfer Circuit CSS

```css
/* Plain-language explainer above the flow */
.tc-explainer {
    max-width: 52rem;
    margin: var(--element-gap) auto 0;
    text-align: center;
    font-size: var(--small-size);
    line-height: 1.55;
    color: var(--text-secondary);
}
.tc-explainer strong { color: var(--text-primary); }
.tc-key {
    font-weight: 700;
    white-space: nowrap;
}
.tc-key-safe { color: var(--accent-green); }
.tc-key-dpf { color: var(--accent-yellow); }
.tc-key-risk { color: var(--accent-red); }

/* Circuit board container — vertical top-to-bottom flow:
   origin → downward arrow → destination grid. */
.transfer-circuit {
    position: relative;
    margin-top: var(--content-gap);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
}

/* Origin card — the scanned site at top */
.tc-origin {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(0.5rem, 1vw, 0.75rem);
    padding: clamp(0.6rem, 1.2vw, 1rem) clamp(1rem, 2vw, 1.5rem);
    background: var(--bg-card);
    border: 2px solid var(--accent);
    border-radius: 10px;
    box-shadow: var(--card-shadow-accent);
    max-width: 24rem;
}
.tc-origin-icon {
    font-size: clamp(1rem, 2vw, 1.5rem);
}
.tc-origin-label {
    font-family: var(--font-mono);
    font-size: var(--body-size);
    font-weight: 700;
    color: var(--text-primary);
}

/* Flow arrow between origin and destinations */
.tc-flow-line {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    padding: clamp(0.3rem, 0.8vh, 0.6rem) 0;
}
.tc-flow-arrow {
    opacity: 0.85;
}
.tc-flow-label {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
}

/* Destination cards grid */
.tc-dest-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: clamp(0.5rem, 1vw, 0.85rem);
    width: 100%;
    max-width: 60rem;
    margin: 0 auto;
}
.tc-dest-card {
    position: relative;
    overflow: hidden;
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-left: 5px solid var(--text-muted);
    border-radius: 10px;
    padding: clamp(0.55rem, 1vw, 0.8rem) clamp(0.7rem, 1.3vw, 0.95rem);
    box-shadow: var(--card-shadow);
}
/* Risk colour — driven entirely by these classes (no inline overrides).
   Strong left accent bar + tinted surface so the coding reads at a glance. */
.tc-dest-safe {
    border-left-color: var(--accent-green);
    background: linear-gradient(90deg, rgba(5,150,105,0.07), var(--bg-card) 60%);
}
.tc-dest-dpf {
    border-left-color: var(--accent-yellow);
    background: linear-gradient(90deg, rgba(217,119,6,0.08), var(--bg-card) 60%);
}
.tc-dest-risk {
    border-left-color: var(--accent-red);
    background: linear-gradient(90deg, rgba(220,38,38,0.09), var(--bg-card) 60%);
}
.tc-dest-neutral { border-left-color: var(--text-muted); }
.tc-dest-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.3rem;
}
.tc-dest-flag {
    font-size: clamp(0.9rem, 1.5vw, 1.2rem);
    flex-shrink: 0;
}
.tc-dest-jurisdiction {
    font-size: var(--small-size);
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
}
/* Risk pill — coloured chip, pinned to the right of the header */
.tc-dest-pill {
    margin-left: auto;
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    font-weight: 700;
    letter-spacing: 0.02em;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    color: var(--bg-card);
    background: var(--text-muted);
}
.tc-dest-safe .tc-dest-pill { background: var(--accent-green); }
.tc-dest-dpf .tc-dest-pill { background: var(--accent-yellow); }
.tc-dest-risk .tc-dest-pill { background: var(--accent-red); }
.tc-dest-company {
    font-size: var(--small-size);
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.15rem;
}
.tc-dest-domains {
    font-family: var(--font-mono);
    font-size: clamp(0.5rem, 0.7vw, 0.62rem);
    color: var(--text-muted);
    line-height: 1.4;
    word-break: break-all;
}
.tc-dest-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.4rem;
    padding-top: 0.35rem;
    border-top: 1px solid var(--bg-card-border);
}
.tc-dest-safeguard {
    font-size: var(--mono-size);
    color: var(--text-muted);
}
.tc-dest-count {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    font-weight: 700;
    color: var(--text-secondary);
    flex-shrink: 0;
}

/* Transfer risk legend */
.tc-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: clamp(1rem, 2vw, 1.5rem);
    margin-top: clamp(0.5rem, 1.2vh, 0.85rem);
    font-size: var(--small-size);
    color: var(--text-secondary);
}
.tc-legend-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.tc-legend-swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex-shrink: 0;
}
.tc-legend-safe { background: var(--accent-green); }
.tc-legend-dpf { background: var(--accent-yellow); }
.tc-legend-risk { background: var(--accent-red); }
```

#### Transfer Circuit HTML

Top-down flow: a plain-language explainer, the origin card, an SVG "sends data to" arrow,
then a risk-sorted (worst-first) grid of colour-coded destination cards below. Each card's
risk class (`tc-dest-safe|dpf|risk|neutral`) drives a visible left bar, tinted surface, and
pill — no inline colour overrides.

```html
<section class="slide" data-title="Cross-Border Transfers">
    <div class="slide-content">
        <span class="badge reveal">Data Transfers</span>
        <h2 class="reveal">Transfer Circuit</h2>
        <p class="tc-explainer reveal">A <strong>cross-border transfer</strong> happens whenever your data leaves the EU. Jurisdiction decides the safeguard: <span class="tc-key tc-key-safe">EU / adequate countries</span> are protected by default, a <span class="tc-key tc-key-dpf">DPF-certified US recipient</span> is conditionally allowed, and an <span class="tc-key tc-key-risk">unverified or non-adequate destination</span> (e.g. RU, CN) needs Standard Contractual Clauses — or it is a high-risk transfer.</p>
        <div class="transfer-circuit reveal">
            <div class="tc-origin reveal">
                <span class="tc-origin-icon">🌐</span>
                <span class="tc-origin-label">{DOMAIN}</span>
            </div>
            <div class="tc-flow-line reveal">
                <svg class="tc-flow-arrow" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
                <span class="tc-flow-label">sends data to</span>
            </div>
            <div class="tc-dest-grid">
                <div class="tc-dest-card tc-dest-{RISK} reveal">
                    <div class="tc-dest-header">
                        <span class="tc-dest-flag">{FLAG}</span>
                        <span class="tc-dest-jurisdiction">{JURISDICTION}</span>
                        <span class="tc-dest-pill">{RISK_LABEL}</span>
                    </div>
                    <div class="tc-dest-company">{COMPANY}</div>
                    <div class="tc-dest-domains">{DOMAIN_LIST}</div>
                    <div class="tc-dest-meta">
                        <span class="tc-dest-safeguard">{SAFEGUARD}</span>
                        <span class="tc-dest-count">{N} reqs</span>
                    </div>
                </div>
                <!-- More destination cards, worst-risk first -->
            </div>
        </div>
        <div class="tc-legend reveal">
            <div class="tc-legend-item"><span class="tc-legend-swatch tc-legend-safe"></span> EU / Adequate</div>
            <div class="tc-legend-item"><span class="tc-legend-swatch tc-legend-dpf"></span> DPF-Certified US</div>
            <div class="tc-legend-item"><span class="tc-legend-swatch tc-legend-risk"></span> Unverified / High-risk</div>
        </div>
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">{N} / {TOTAL}</div>
</section>
```

**Adaptation rules:**
- Group third-party domains by jurisdiction (US, EU, etc.). Each jurisdiction becomes one destination card.
- Max 6 destination cards. If more, group smaller ones into "Other".
- Flag emoji for jurisdiction: 🇺🇸 US, 🇪🇺 EU, 🇬🇧 UK, 🇨🇳 CN, etc.
- Card border-left color: `tc-dest-safe` (EU/EEA/adequate), `tc-dest-dpf` (US with DPF), `tc-dest-risk` (no safeguards).
- Domains wrap naturally (`word-break: break-all`) — no truncation.

---

### 5. Shield Rings (Security Headers)

Concentric defense rings around a core. Each security header is a ring — present headers form solid protective layers, missing headers are broken/dashed gaps in the defense. The visual immediately communicates how many layers of protection exist.

#### Shield Rings CSS

```css
/* Shield container — centered rings */
.shield-rings {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: var(--content-gap);
    gap: clamp(1.5rem, 3vw, 3rem);
}

/* Ring diagram */
.sr-diagram {
    position: relative;
    width: clamp(12rem, 24vw, 18rem);
    height: clamp(12rem, 24vw, 18rem);
    flex-shrink: 0;
}

/* Each ring is an absolutely positioned circle */
.sr-ring {
    position: absolute;
    border-radius: 50%;
    border: 2px solid;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    transition: all 0.5s var(--ease-out-expo);
}

/* Ring sizes — outermost to innermost */
.sr-ring-1 { width: 100%; height: 100%; }
.sr-ring-2 { width: 83%; height: 83%; }
.sr-ring-3 { width: 66%; height: 66%; }
.sr-ring-4 { width: 49%; height: 49%; }
.sr-ring-5 { width: 32%; height: 32%; }
.sr-ring-6 { width: 18%; height: 18%; }

/* Present — solid ring with glow */
.sr-ring-present {
    border-color: var(--accent-green);
    box-shadow: 0 0 8px rgba(52,211,153,0.1), inset 0 0 8px rgba(52,211,153,0.05);
}

/* Missing — broken/dashed ring */
.sr-ring-missing {
    border-color: var(--accent-red);
    border-style: dashed;
    opacity: 0.4;
}

/* Partial — dotted ring */
.sr-ring-partial {
    border-color: var(--accent-yellow);
    border-style: dotted;
    opacity: 0.7;
}

/* Center core — the website */
.sr-core {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: clamp(2.5rem, 5vw, 3.5rem);
    height: clamp(2.5rem, 5vw, 3.5rem);
    border-radius: 50%;
    background: var(--accent-soft);
    border: 2px solid var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: clamp(0.5rem, 0.8vw, 0.65rem);
    font-weight: 700;
    color: var(--accent);
    z-index: 2;
}

/* Ring labels — listed beside the diagram */
.sr-legend {
    display: flex;
    flex-direction: column;
    gap: clamp(0.25rem, 0.5vh, 0.4rem);
    flex: 1;
    max-width: clamp(14rem, 28vw, 20rem);
}
.sr-legend-item {
    display: flex;
    align-items: center;
    gap: clamp(0.4rem, 0.8vw, 0.6rem);
    padding: clamp(0.25rem, 0.5vh, 0.4rem) clamp(0.4rem, 0.8vw, 0.6rem);
    border-radius: 6px;
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
}
.sr-legend-ring {
    width: clamp(1.2rem, 2vw, 1.5rem);
    height: clamp(1.2rem, 2vw, 1.5rem);
    border-radius: 50%;
    border: 2px solid;
    flex-shrink: 0;
}
.sr-legend-ring-present { border-color: var(--accent-green); }
.sr-legend-ring-missing { border-color: var(--accent-red); border-style: dashed; opacity: 0.5; }
.sr-legend-ring-partial { border-color: var(--accent-yellow); border-style: dotted; }
.sr-legend-name {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    color: var(--text-primary);
    font-weight: 500;
    flex: 1;
}
.sr-legend-status {
    font-size: clamp(0.5rem, 0.7vw, 0.6rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}
.sr-legend-status-present { color: var(--accent-green); }
.sr-legend-status-missing { color: var(--accent-red); }
.sr-legend-status-partial { color: var(--accent-yellow); }

/* Score fraction */
.sr-score {
    text-align: center;
    margin-top: clamp(0.3rem, 0.6vh, 0.5rem);
    font-family: var(--font-mono);
    font-size: var(--body-size);
    color: var(--text-secondary);
}
.sr-score strong {
    font-size: clamp(1.25rem, 2.5vw, 2rem);
    font-weight: 700;
}
.sr-score-good strong { color: var(--accent-green); }
.sr-score-mid strong { color: var(--accent-yellow); }
.sr-score-bad strong { color: var(--accent-red); }

/* SRI advisory line — not scored, visually secondary */
.sri-advisory {
    display: flex;
    align-items: baseline;
    gap: 0.5em;
    margin-top: clamp(0.3rem, 0.5vh, 0.4rem);
    font-family: var(--font-mono);
    font-size: var(--small-size);
    color: var(--text-muted);
}
.sri-advisory-label {
    font-style: italic;
}
.sri-advisory-value {
    color: var(--text-secondary);
}
```

#### Shield Rings HTML

```html
<section class="slide" data-title="Security Headers">
    <div class="slide-content">
        <span class="badge reveal">Security Posture</span>
        <h2 class="reveal">Shield Rings</h2>
        <div class="shield-rings reveal">
            <div class="sr-diagram">
                <!-- Rings from outermost to innermost — order by importance -->
                <div class="sr-ring sr-ring-1 sr-ring-present"></div>  <!-- HSTS -->
                <div class="sr-ring sr-ring-2 sr-ring-present"></div>  <!-- CSP -->
                <div class="sr-ring sr-ring-3 sr-ring-present"></div>  <!-- X-Content-Type -->
                <div class="sr-ring sr-ring-4 sr-ring-present"></div>  <!-- X-Frame-Options -->
                <div class="sr-ring sr-ring-5 sr-ring-missing"></div>  <!-- Referrer-Policy -->
                <div class="sr-ring sr-ring-6 sr-ring-missing"></div>  <!-- Permissions-Policy -->
                <div class="sr-core">{SCORE_FRACTION}</div>
            </div>
            <div class="sr-legend">
                <div class="sr-legend-item reveal">
                    <span class="sr-legend-ring sr-legend-ring-present"></span>
                    <span class="sr-legend-name">strict-transport-security</span>
                    <span class="sr-legend-status sr-legend-status-present">Active</span>
                </div>
                <div class="sr-legend-item reveal">
                    <span class="sr-legend-ring sr-legend-ring-present"></span>
                    <span class="sr-legend-name">content-security-policy</span>
                    <span class="sr-legend-status sr-legend-status-present">Active</span>
                </div>
                <div class="sr-legend-item reveal">
                    <span class="sr-legend-ring sr-legend-ring-present"></span>
                    <span class="sr-legend-name">x-content-type-options</span>
                    <span class="sr-legend-status sr-legend-status-present">Active</span>
                </div>
                <div class="sr-legend-item reveal">
                    <span class="sr-legend-ring sr-legend-ring-present"></span>
                    <span class="sr-legend-name">x-frame-options</span>
                    <span class="sr-legend-status sr-legend-status-present">Active</span>
                </div>
                <div class="sr-legend-item reveal">
                    <span class="sr-legend-ring sr-legend-ring-missing"></span>
                    <span class="sr-legend-name">referrer-policy</span>
                    <span class="sr-legend-status sr-legend-status-missing">Missing</span>
                </div>
                <div class="sr-legend-item reveal">
                    <span class="sr-legend-ring sr-legend-ring-missing"></span>
                    <span class="sr-legend-name">permissions-policy</span>
                    <span class="sr-legend-status sr-legend-status-missing">Missing</span>
                </div>
            </div>
        </div>
        <div class="sr-score sr-score-mid reveal">
            <strong>{PRESENT}</strong> / {TOTAL} headers active
        </div>
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">{N} / {TOTAL_SLIDES}</div>
</section>
```

**Adaptation rules:**
- Always check 6 headers: HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- Ring order = importance (outermost = most critical). HSTS outer, Permissions-Policy inner.
- Score color class: `sr-score-good` (5-6/6), `sr-score-mid` (3-4/6), `sr-score-bad` (0-2/6).
- If a header is present but weak (e.g., CSP with `unsafe-inline`), use `sr-ring-partial`.
- The core displays the fraction (e.g., "4/6").

---

### 6. Persistence Bars (Cookie Management)

A horizontal Gantt-style lifespan chart. Each cookie is a bar whose length represents its expiry duration on a time scale. Color-coded by purpose. Session cookies are tiny dots; 13-month monsters are full-width bars. Immediately communicates which cookies overstay their welcome.

#### Persistence Bars CSS

```css
/* Lifespan chart container */
.persist-chart {
    --p-name: clamp(7rem, 13vw, 10rem);
    --p-dur: clamp(4rem, 6vw, 5.5rem);
    --p-gap: clamp(0.5rem, 1vw, 0.85rem);
    margin-top: clamp(1rem, 2.5vh, 2rem);
    flex: 1;                 /* fill the vertical space so few-row charts don't strand whitespace */
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: clamp(0.3rem, 0.9vh, 0.7rem);
}

/* Time scale header — same 3-col grid as the rows so ticks align to bar origins */
.persist-scale {
    display: grid;
    grid-template-columns: var(--p-name) 1fr var(--p-dur);
    gap: var(--p-gap);
    margin-bottom: clamp(0.5rem, 1.2vh, 0.9rem);
}
.persist-scale-track { grid-column: 2; position: relative; height: 1.5em; }
.persist-scale-tick {
    font-family: var(--font-mono);
    font-size: clamp(0.62rem, 0.8vw, 0.78rem);
    color: var(--text-secondary);
    letter-spacing: 0.04em;
    position: absolute;
    top: 0;
}
.persist-thresh-label {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    font-family: var(--font-mono);
    font-size: clamp(0.6rem, 0.78vw, 0.74rem);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--accent-red);
    white-space: nowrap;
}
/* Scale baseline, spanning exactly the bar-track column */
.persist-scale-line {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 1px;
    background: var(--bg-card-border);
}

/* Single cookie row — shared 3-col grid */
.persist-row {
    display: grid;
    grid-template-columns: var(--p-name) 1fr var(--p-dur);
    align-items: center;
    gap: var(--p-gap);
    min-height: clamp(1.3rem, 2.6vh, 1.9rem);
}
.persist-name {
    font-family: var(--font-mono);
    font-size: clamp(0.78rem, 1.05vw, 1rem);
    font-weight: 500;
    color: var(--text-primary);
    width: 100%;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* The bar itself — quarter gridlines through the track anchor short bars to the
   axis ticks (0/25/50/75/100%) so the proportional encoding reads at a glance */
.persist-bar-track {
    height: clamp(0.95rem, 2vh, 1.5rem);
    position: relative;
    border-radius: 4px;
    background-color: rgba(28,25,23,0.04);
    background-image: linear-gradient(90deg, rgba(28,25,23,0.06) 1px, transparent 1px);
    background-size: 25% 100%;
    overflow: hidden;
}
.persist-bar {
    height: 100%;
    border-radius: 4px;
    position: relative;
    min-width: 4px;
    transition: width 0.8s var(--ease-out-expo);
}

/* Purpose colors — solid for legibility */
.persist-bar-essential { background: var(--accent-green); }
.persist-bar-functional { background: var(--accent-blue); }
.persist-bar-analytics { background: var(--accent-yellow); }
.persist-bar-tracking { background: var(--accent-red); }
.persist-bar-marketing { background: var(--accent-red); }
.persist-bar-unknown { background: var(--text-muted); }

/* Session cookie — a dashed outlined micro-marker so it reads as "ephemeral /
   until browser close" rather than a broken zero-length bar */
.persist-bar-session {
    width: 20px !important;
    background: rgba(28,25,23,0.06) !important;
    border: 1.5px dashed var(--text-secondary);
    border-radius: 4px;
    opacity: 1;
}

/* Duration label — grid column 3, right-aligned. Over-1yr cookies turn red+bold
   so the proportionality risk reads at a glance; compliant ones stay muted. */
.persist-duration {
    font-family: var(--font-mono);
    font-size: clamp(0.68rem, 0.9vw, 0.85rem);
    font-weight: 500;
    color: var(--text-secondary);
    white-space: nowrap;
    text-align: right;
}
.persist-duration-over { color: var(--accent-red); font-weight: 700; }

/* Legend */
.persist-legend {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(0.75rem, 1.5vw, 1.25rem);
    margin-top: clamp(0.6rem, 1.5vh, 1rem);
    padding-left: calc(clamp(7rem, 13vw, 10rem) + clamp(0.5rem, 1vw, 0.85rem));
}
.persist-legend-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-family: var(--font-mono);
    font-size: clamp(0.6rem, 0.78vw, 0.74rem);
    letter-spacing: 0.04em;
    color: var(--text-secondary);
}
.persist-legend-swatch {
    width: 14px; height: 8px;
    border-radius: 2px;
}

/* Group header separator between purpose categories */
.persist-group-header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-top: clamp(0.45rem, 1vh, 0.75rem);
    margin-bottom: clamp(0.15rem, 0.4vh, 0.3rem);
    padding-left: calc(var(--p-name) + var(--p-gap));
}
.persist-group-dot {
    width: 11px;
    height: 11px;
    border-radius: 3px;
    flex-shrink: 0;
    align-self: center;
}
.slide-desc-thresh { color: var(--accent-red); }
.persist-group-label {
    font-family: var(--font-mono);
    font-size: clamp(0.6rem, 0.75vw, 0.72rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-primary);
}
.persist-group-count {
    font-family: var(--font-mono);
    font-size: clamp(0.62rem, 0.74vw, 0.72rem);
    color: var(--text-secondary);
}

/* Double-line name column: cookie name + domain */
.persist-name-col {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    overflow: hidden;
}
.persist-domain {
    font-family: var(--font-mono);
    font-size: clamp(0.6rem, 0.74vw, 0.72rem);
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}

/* Threshold warning line (e.g., 1 year mark) */
.persist-threshold {
    position: absolute;
    top: 0; bottom: 0;
    width: 1px;
    border-left: 2px dashed var(--accent-red);
    opacity: 0.7;
    z-index: 1;
}
.persist-threshold-label {
    position: absolute;
    top: -1.2em;
    transform: translateX(-50%);
    font-family: var(--font-mono);
    font-size: clamp(0.4rem, 0.55vw, 0.5rem);
    color: var(--accent-red);
    white-space: nowrap;
}
```

#### Persistence Bars HTML

```html
<section class="slide" data-title="Cookie Management">
    <div class="slide-content">
        <span class="badge reveal">Cookie Lifespan</span>
        <h2 class="reveal">Persistence Bars</h2>
        <!-- Time scale: 0 → max cookie duration -->
        <div class="persist-chart reveal">
            <div class="persist-scale">
                <div class="persist-scale-line"></div>
                <span class="persist-scale-tick" style="left: clamp(6rem,12vw,9rem);">0</span>
                <span class="persist-scale-tick" style="left: 25%;">30d</span>
                <span class="persist-scale-tick" style="left: 50%;">6mo</span>
                <span class="persist-scale-tick" style="left: 75%;">1yr</span>
                <span class="persist-scale-tick" style="right: 0;">2yr</span>
            </div>
            <!-- Cookie rows — sorted by duration descending -->
            <div class="persist-row reveal">
                <span class="persist-name">{COOKIE_NAME}</span>
                <div class="persist-bar-track">
                    <!-- Width % = (cookie_days / max_days) * 100 -->
                    <div class="persist-bar persist-bar-{PURPOSE}" style="width: {WIDTH_PCT}%;"></div>
                </div>
                <span class="persist-duration">{DURATION_LABEL}</span>
            </div>
            <!-- Session cookie example -->
            <div class="persist-row reveal">
                <span class="persist-name">__cf_bm</span>
                <div class="persist-bar-track">
                    <div class="persist-bar persist-bar-essential persist-bar-session"></div>
                </div>
                <span class="persist-duration">30min</span>
            </div>
            <!-- More rows... max 8 per slide -->
        </div>
        <div class="persist-legend reveal">
            <div class="persist-legend-item"><span class="persist-legend-swatch" style="background:var(--accent-green)"></span> Essential</div>
            <div class="persist-legend-item"><span class="persist-legend-swatch" style="background:var(--accent-blue)"></span> Functional</div>
            <div class="persist-legend-item"><span class="persist-legend-swatch" style="background:var(--accent-yellow)"></span> Analytics</div>
            <div class="persist-legend-item"><span class="persist-legend-swatch" style="background:var(--accent-red)"></span> Tracking</div>
        </div>
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">{N} / {TOTAL}</div>
</section>
```

**Adaptation rules:**
- Sort cookies by duration descending (longest bar at top).
- Width calculation: `(cookie_duration_days / scale_max_days) * 100`. Scale max = longest cookie duration, capped at 2 years (730 days).
- Session cookies use `persist-bar-session` class (renders as a dot, not a bar).
- Max 8 cookie rows per slide. If more, split into multiple slides sorted by duration.
- Duration labels: "30min", "2.5h", "6mo", "13mo", "2yr", "Session".
- Color by purpose: essential (green), functional (blue), analytics (yellow), tracking/marketing (red).
- Only include legend items for colors actually used.

---

### 6b. Methodology Flowchart

Horizontal process flowchart showing scan phases (Scout → Pre-Consent → Post-Consent) connected by arrows. Each node shows an icon + count badges.

#### Methodology CSS

```css
/* Methodology flowchart */
.meth-flow {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 0;
    margin-top: var(--content-gap);
    flex-wrap: wrap;
}
.meth-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 12px;
    padding: clamp(0.6rem, 1.2vw, 1rem) clamp(0.8rem, 1.5vw, 1.5rem);
    box-shadow: var(--card-shadow);
    min-width: clamp(6rem, 12vw, 10rem);
    text-align: center;
}
.meth-icon {
    font-size: clamp(1.2rem, 2vw, 1.8rem);
    margin-bottom: 0.3rem;
}
.meth-label {
    font-family: var(--font-mono);
    font-size: var(--body-size);
    font-weight: 600;
    color: var(--text-primary);
}
.meth-desc {
    font-size: var(--small-size);
    color: var(--text-muted);
    margin-top: 0.1rem;
}
.meth-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.4rem;
    justify-content: center;
}
.meth-badge {
    font-family: var(--font-mono);
    font-size: calc(var(--mono-size) * 0.9);
    background: var(--accent-soft);
    color: var(--accent);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    white-space: nowrap;
}
.meth-connector {
    display: flex;
    align-items: center;
    font-size: clamp(1rem, 2vw, 1.5rem);
    color: var(--text-muted);
    padding: 0 clamp(0.3rem, 0.8vw, 0.6rem);
    align-self: center;
}
.meth-details {
    margin-top: var(--content-gap);
}
.meth-details summary {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    background: var(--code-bg);
    display: inline-block;
}
.meth-details summary:hover {
    background: var(--accent-soft);
}
.meth-detail-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.2rem 1rem;
    padding: 0.6rem 0.8rem;
    font-size: var(--small-size);
}
.meth-detail-label {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text-secondary);
}
@media (max-width: 768px) {
    .meth-flow { flex-direction: column; align-items: center; }
    .meth-connector { transform: rotate(90deg); padding: 0.2rem 0; }
}
```

### 7. Fairness Scale (Dark Patterns)

A visual balance/scale comparing the treatment of "Accept" vs "Reject" options. The scale tips based on how fair the consent mechanism is. Multiple factors are weighed: button size, color contrast, click count, placement. A level scale = fair. A tipped scale = dark patterns detected.

#### Fairness Scale CSS

```css
/* Scale container */
.fairness-scale {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: var(--content-gap);
}

/* Spectrum labels */
.fs-spectrum-labels {
    display: flex;
    justify-content: space-between;
    width: 100%;
    max-width: clamp(24rem, 50vw, 36rem);
    font-size: var(--small-size);
    color: var(--text-muted);
    margin-bottom: clamp(0.3rem, 0.6vh, 0.5rem);
}

/* Horizontal spectrum bar */
.fs-spectrum {
    position: relative;
    width: 100%;
    max-width: clamp(24rem, 50vw, 36rem);
    height: clamp(0.5rem, 1vw, 0.75rem);
    border-radius: 6px;
    background: linear-gradient(90deg, var(--accent-green) 0%, rgba(28,25,23,0.1) 50%, var(--accent-red) 100%);
    margin-bottom: var(--content-gap);
}

/* Marker dot on spectrum */
.fs-marker {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: clamp(1rem, 2vw, 1.4rem);
    height: clamp(1rem, 2vw, 1.4rem);
    border-radius: 50%;
    background: var(--bg-card);
    border: 3px solid var(--text-primary);
    box-shadow: var(--card-shadow);
    transition: left 0.8s var(--ease-out-expo);
}
.fs-marker-balanced { left: 50%; }
.fs-marker-tilted-accept { left: 65%; }
.fs-marker-tilted-reject { left: 35%; }
.fs-marker-heavy-accept { left: 85%; }
.fs-marker-heavy-reject { left: 15%; }

/* Factor panels grid */
.fs-factor-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(0.5rem, 1vw, 0.75rem);
    width: 100%;
    max-width: clamp(24rem, 50vw, 36rem);
}
.fs-factor-panel {
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 8px;
    padding: clamp(0.5rem, 1vw, 0.75rem);
    box-shadow: var(--card-shadow);
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0 clamp(0.5rem, 1vw, 0.75rem);
}
.fs-factor-panel-accept { border-top: 3px solid var(--accent-green); }
.fs-factor-panel-reject { border-top: 3px solid var(--accent-red); }
.fs-factor-panel-title {
    grid-column: 1 / -1;
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    text-align: center;
    padding-bottom: clamp(0.2rem, 0.4vh, 0.3rem);
    border-bottom: 1px solid var(--bg-card-border);
    margin-bottom: clamp(0.2rem, 0.4vh, 0.3rem);
    color: var(--text-secondary);
}

/* Factor rows — display:contents so name/value become grid cells */
.fs-factor {
    display: contents;
    font-size: var(--small-size);
    color: var(--text-secondary);
}
.fs-factor-name {
    color: var(--text-secondary);
    font-size: var(--small-size);
    padding: clamp(0.1rem, 0.2vh, 0.15rem) 0;
}
.fs-factor-value {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    font-weight: 600;
    text-align: right;
    padding: clamp(0.1rem, 0.2vh, 0.15rem) 0;
}
.fs-factor-value-good { color: var(--accent-green); }
.fs-factor-value-bad { color: var(--accent-red); }
.fs-factor-value-neutral { color: var(--text-muted); }

/* Verdict banner below the scale */
.fs-verdict {
    margin-top: clamp(0.75rem, 1.5vh, 1.25rem);
    text-align: center;
    padding: clamp(0.4rem, 0.8vh, 0.6rem) clamp(1rem, 2vw, 1.5rem);
    border-radius: 8px;
    font-family: var(--font-mono);
    font-size: var(--body-size);
    font-weight: 600;
}
.fs-verdict-fair {
    background: rgba(52,211,153,0.08);
    border: 1px solid rgba(52,211,153,0.2);
    color: var(--accent-green);
}
.fs-verdict-minor {
    background: rgba(251,191,36,0.08);
    border: 1px solid rgba(251,191,36,0.2);
    color: var(--accent-yellow);
}
.fs-verdict-dark {
    background: rgba(248,113,113,0.08);
    border: 1px solid rgba(248,113,113,0.2);
    color: var(--accent-red);
}
```

#### Fairness Scale HTML

Horizontal spectrum gauge with marker dot, factor panels below.

```html
<section class="slide" data-title="Dark Patterns">
    <div class="slide-content">
        <span class="badge reveal">UX Fairness</span>
        <h2 class="reveal">Fairness Scale</h2>
        <div class="fairness-scale reveal">
            <div class="fs-spectrum-labels">
                <span>Reject-biased</span>
                <span>Balanced</span>
                <span>Accept-biased</span>
            </div>
            <div class="fs-spectrum">
                <div class="fs-marker fs-marker-balanced"></div>
            </div>
            <div class="fs-factor-grid">
                <div class="fs-factor-panel fs-factor-panel-accept">
                    <div class="fs-factor-panel-title">Accept Path</div>
                    <div class="fs-factor">
                        <span class="fs-factor-name">Button size</span>
                        <span class="fs-factor-value fs-factor-value-good">Equal</span>
                    </div>
                    <!-- More factors -->
                </div>
                <div class="fs-factor-panel fs-factor-panel-reject">
                    <div class="fs-factor-panel-title">Reject Path</div>
                    <div class="fs-factor">
                        <span class="fs-factor-name">Button size</span>
                        <span class="fs-factor-value fs-factor-value-good">Equal</span>
                    </div>
                    <!-- More factors -->
                </div>
            </div>
        </div>
        <div class="fs-verdict fs-verdict-fair reveal">
            No dark patterns detected — consent is fairly presented
        </div>
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">{N} / {TOTAL}</div>
</section>
```

**Adaptation rules:**
- **Balanced** (`fs-marker-balanced`): Marker at center. Both buttons equal size, equal prominence, same click count.
- **Tilted accept** (`fs-marker-tilted-accept`): Marker at 65%. Accept slightly more prominent but reject still accessible.
- **Heavy accept** (`fs-marker-heavy-accept`): Marker at 85%. Multiple dark patterns — pre-checked, forced wall, hidden reject.
- **Tilted reject** (`fs-marker-tilted-reject`): Marker at 35%. Reject path is slightly easier (rare).
- **Heavy reject** (`fs-marker-heavy-reject`): Marker at 15%. Reject is strongly favoured (very rare).
- Factors to compare: button size, color contrast, click count, placement, pre-checked boxes, cookie wall.
- Color each factor value: `fs-factor-value-good` (equal/fair), `fs-factor-value-bad` (unfair), `fs-factor-value-neutral` (not a factor).
- Verdict: `fs-verdict-fair` (score 90-100), `fs-verdict-minor` (score 50-89), `fs-verdict-dark` (score 0-49).
- If no consent banner exists: show spectrum with balanced marker and "No consent mechanism" as verdict in red.

---

## Supplementary Components

These are not tied to a scoring category but appear in most decks. Use them when the scan data warrants it.

| Component | Purpose | When to use |
|-----------|---------|-------------|
| Tracker Radar | Inventory of all tracking systems with status | When 1+ tracking systems detected |
| Compliance Matrix | GDPR article compliance as visual grid | Always — every audit maps to GDPR articles |
| Request Pulse | Third-party request volume, pre vs post consent | When 3+ third-party domains with requests |

---

### 8. Tracker Radar (Tracking Systems)

A surveillance-aesthetic grid showing every tracking system detected during the scan. Each tracker gets a card with a pulsing indicator for pre-consent active systems. Grouped by severity: active pre-consent (red), gated post-consent (yellow), CSP-whitelisted only (muted).

#### Tracker Radar CSS

```css
/* Tracker Radar — surveillance grid */
.tracker-radar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
    gap: clamp(0.4rem, 0.8vw, 0.6rem);
    margin-top: var(--content-gap);
}

/* Individual tracker card */
.tr-card {
    position: relative;
    padding: clamp(0.6rem, 1.2vw, 0.9rem);
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 8px;
    border-left: 3px solid var(--text-muted);
    overflow: hidden;
}

/* Severity tiers */
.tr-card-active { border-left-color: var(--accent-red); }
.tr-card-gated { border-left-color: var(--accent-yellow); }
.tr-card-csp { border-left-color: var(--text-muted); opacity: 0.5; }

/* Pulsing dot for active pre-consent trackers */
.tr-pulse {
    position: absolute;
    top: clamp(0.6rem, 1.2vw, 0.9rem);
    right: clamp(0.6rem, 1.2vw, 0.9rem);
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--accent-red);
}
.tr-pulse::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid var(--accent-red);
    animation: tr-ping 2s ease-out infinite;
}
@keyframes tr-ping {
    0% { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(2); opacity: 0; }
}

/* Card content */
.tr-name {
    font-family: var(--font-mono);
    font-size: var(--body-size);
    font-weight: 600;
    color: var(--text-primary);
}
.tr-domain {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    color: var(--text-muted);
    margin-top: 0.1rem;
}
.tr-category {
    display: inline-block;
    font-size: var(--small-size);
    font-weight: 600;
    color: var(--text-secondary);
    margin-top: clamp(0.2rem, 0.4vh, 0.3rem);
}
.tr-status {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-family: var(--font-mono);
    font-size: clamp(0.45rem, 0.65vw, 0.55rem);
    margin-top: clamp(0.2rem, 0.4vh, 0.3rem);
    padding: 0.15em 0.5em;
    border-radius: 100px;
}
.tr-status-active { background: rgba(248,113,113,0.1); color: var(--accent-red); }
.tr-status-gated { background: rgba(251,191,36,0.1); color: var(--accent-yellow); }
.tr-status-csp { background: var(--bg-card); color: var(--text-muted); border: 1px solid var(--bg-card-border); }

/* Summary strip below grid */
.tr-summary {
    display: flex;
    justify-content: center;
    gap: clamp(1rem, 2vw, 2rem);
    margin-top: clamp(0.5rem, 1vh, 0.75rem);
    font-size: var(--small-size);
    color: var(--text-secondary);
}
.tr-summary-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.tr-summary-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
}
.tr-summary-dot-active { background: var(--accent-red); }
.tr-summary-dot-gated { background: var(--accent-yellow); }
.tr-summary-dot-csp { background: var(--text-muted); }
```

#### Tracking Systems — Consent Gate CSS

```css
/* === Tracking Systems "consent gate" (trk-*) — namespaced so the shared tr-* / */
/* .tracker-radar styles (still used by buildRejectScenario) are left untouched.   */
.trk-gate {
    display: flex;
    align-items: stretch;
    gap: clamp(0.7rem, 1.6vw, 1.4rem);
    flex: 1;
    min-height: 0;
    margin-top: clamp(0.6rem, 1.4vh, 1rem);
}
.trk-zone {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: clamp(0.4rem, 0.8vh, 0.6rem);
    min-width: 0;
    padding: clamp(0.6rem, 1.2vw, 0.95rem);
    border-radius: 12px;
    border: 1px solid var(--bg-card-border);
}
.trk-zone-bad { background: rgba(220,38,38,0.035); border-color: rgba(220,38,38,0.18); }
.trk-zone-ok  { background: rgba(28,25,23,0.018); }

.trk-zone-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: clamp(0.35rem, 0.7vh, 0.55rem);
    border-bottom: 1px solid var(--bg-card-border);
}
.trk-zone-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.trk-zone-dot-bad { background: var(--accent-red); }
.trk-zone-dot-ok  { background: var(--accent-green); }
.trk-zone-title {
    font-family: var(--font-mono);
    font-size: clamp(0.66rem, 0.95vw, 0.82rem);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}
.trk-zone-bad .trk-zone-title { color: var(--accent-red); }
.trk-zone-ok  .trk-zone-title { color: var(--accent-green); }
.trk-zone-count {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: var(--small-size);
    font-weight: 700;
    color: var(--text-primary);
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 100px;
    min-width: 1.6em;
    text-align: center;
    padding: 0.05em 0.5em;
}

.trk-cards {
    display: flex;
    flex-direction: column;
    gap: clamp(0.4rem, 0.8vh, 0.6rem);
    flex: 1;
    min-height: 0;
}
.trk-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: clamp(0.28rem, 0.6vh, 0.45rem);
    flex: 1;
    justify-content: flex-start;
    padding: clamp(0.6rem, 1.2vw, 0.95rem) clamp(0.7rem, 1.4vw, 1.05rem);
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-left: 3px solid var(--text-muted);
    border-radius: 9px;
    box-shadow: var(--card-shadow);
}
.trk-card-active { border-left-color: var(--accent-red); }
.trk-card-gated  { border-left-color: var(--accent-yellow); }
.trk-card-csp    { border-left-color: var(--text-muted); }

.trk-card-head { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
.trk-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-display);
    font-size: clamp(0.96rem, 1.55vw, 1.14rem);
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.15;
    min-width: 0;
}
.trk-live {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--accent-red);
    flex: none;
    position: relative;
}
.trk-live::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid var(--accent-red);
    animation: trk-ping 2s ease-out infinite;
}
@keyframes trk-ping {
    0% { transform: scale(0.8); opacity: 0.7; }
    100% { transform: scale(2.2); opacity: 0; }
}

.trk-badge {
    flex: none;
    font-family: var(--font-mono);
    font-size: clamp(0.5rem, 0.72vw, 0.62rem);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0.22em 0.6em;
    border-radius: 100px;
    white-space: nowrap;
}
.trk-badge-active { background: var(--accent-red); color: #fff; }
.trk-badge-gated  { background: rgba(217,119,6,0.14); color: var(--accent-yellow); border: 1px solid rgba(217,119,6,0.3); }
.trk-badge-csp    { background: var(--bg-card); color: var(--text-muted); border: 1px solid var(--bg-card-border); }

.trk-domain {
    font-family: var(--font-mono);
    font-size: clamp(0.68rem, 0.92vw, 0.78rem);
    color: var(--text-secondary);
    word-break: break-all;
}
.trk-meta { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.trk-chip {
    font-family: var(--font-mono);
    font-size: clamp(0.6rem, 0.84vw, 0.72rem);
    font-weight: 600;
    color: var(--text-secondary);
    background: rgba(28,25,23,0.04);
    border-radius: 5px;
    padding: 0.18em 0.55em;
}
.trk-chip-juris { color: var(--text-muted); background: transparent; border: 1px solid var(--bg-card-border); }
.trk-chip-juris-ext { color: var(--accent-red); border-color: rgba(220,38,38,0.3); }

.trk-articles { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.trk-article {
    font-family: var(--font-mono);
    font-size: clamp(0.58rem, 0.78vw, 0.68rem);
    font-weight: 600;
    color: var(--accent-red);
    background: rgba(220,38,38,0.07);
    border-radius: 4px;
    padding: 0.14em 0.5em;
}
.trk-piggyback {
    font-family: var(--font-mono);
    font-size: clamp(0.6rem, 0.82vw, 0.7rem);
    color: var(--accent);
    font-weight: 600;
}

/* center "consent gate" divider — only rendered when both zones are present */
.trk-divider {
    flex: none;
    width: clamp(36px, 4.6vw, 58px);
    align-self: stretch;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    position: relative;
}
.trk-divider::before {
    content: '';
    position: absolute;
    top: 4%; bottom: 4%;
    width: 2px;
    background: linear-gradient(to bottom, transparent, var(--accent) 16%, var(--accent) 84%, transparent);
    opacity: 0.6;
}
.trk-gate-badge {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(32px, 4vw, 42px);
    height: clamp(32px, 4vw, 42px);
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    box-shadow: 0 0 0 5px var(--bg-primary), var(--card-shadow-accent);
}
.trk-gate-label {
    position: relative;
    z-index: 1;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-family: var(--font-mono);
    font-size: clamp(0.52rem, 0.72vw, 0.62rem);
    font-weight: 700;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: var(--accent);
    background: var(--bg-primary);
    padding: 0.6em 0;
}

/* anchored legend */
.trk-legend {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: clamp(1rem, 2.4vw, 2.2rem);
    margin-top: clamp(0.55rem, 1.1vh, 0.85rem);
    padding-top: clamp(0.5rem, 1vh, 0.75rem);
    border-top: 1px solid var(--bg-card-border);
    font-family: var(--font-mono);
    font-size: clamp(0.64rem, 0.92vw, 0.8rem);
    font-weight: 500;
    color: var(--text-secondary);
}
.trk-legend-item { display: flex; align-items: center; gap: 0.45rem; }
.trk-legend-dot { width: 11px; height: 11px; border-radius: 50%; flex: none; }
.trk-dot-active { background: var(--accent-red); }
.trk-dot-gated  { background: var(--accent-yellow); }
.trk-dot-csp    { background: var(--text-muted); }
.trk-dot-piggy  { background: var(--accent); }

.trk-desc-bad { color: var(--accent-red); font-weight: 600; }
```

#### DSAR / Rights Mechanism CSS

```css
/* === DSAR rights-coverage (dsar-*) — namespaced so the shared rs-note component   */
/* (used by 13 builders) is untouched. Only buildDsar renders these classes.        */
.dsar-section {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
    margin-top: clamp(0.6rem, 1.4vh, 1rem);
}
.dsar-section-head {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    padding-bottom: clamp(0.4rem, 0.8vh, 0.6rem);
    border-bottom: 1px solid var(--bg-card-border);
}
.dsar-section-title {
    font-family: var(--font-mono);
    font-size: clamp(0.66rem, 0.95vw, 0.82rem);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary);
}
.dsar-section-count {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: clamp(0.78rem, 1.1vw, 0.98rem);
    font-weight: 700;
    color: var(--text-secondary);
}
.dsar-section-count .dsar-count-sat { color: var(--accent-green); font-size: 1.25em; }
.dsar-section-count .dsar-count-gap { color: var(--accent-red); }

.dsar-progress {
    position: relative;
    height: clamp(7px, 1vh, 10px);
    background: rgba(220,38,38,0.14);
    border-radius: 100px;
    overflow: hidden;
    margin-top: clamp(0.4rem, 0.8vh, 0.6rem);
}
.dsar-progress-fill {
    height: 100%;
    background: var(--accent-green);
    border-radius: 100px;
}

.dsar-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(0.55rem, 1.15vw, 0.9rem);
    grid-auto-rows: 1fr;
    flex: 1;
    min-height: 0;
    margin-top: clamp(0.5rem, 1vh, 0.8rem);
}
.dsar-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    padding: clamp(0.6rem, 1.15vw, 0.92rem) clamp(0.7rem, 1.35vw, 1.05rem);
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-left: 3px solid var(--text-muted);
    border-radius: 9px;
    box-shadow: var(--card-shadow);
}
.dsar-card-pass { border-left-color: var(--accent-green); }
.dsar-card-fail { border-left-color: var(--accent-red); }

.dsar-card-main { display: flex; flex-direction: column; gap: clamp(0.22rem, 0.5vh, 0.32rem); min-width: 0; }
.dsar-name {
    font-family: var(--font-display);
    font-size: clamp(0.86rem, 1.4vw, 1.04rem);
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.2;
}
.dsar-ref {
    font-family: var(--font-mono);
    font-size: clamp(0.62rem, 0.86vw, 0.74rem);
    color: var(--text-secondary);
    word-break: break-word;
}

.dsar-chip {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-width: 5em;
    font-family: var(--font-mono);
    font-size: clamp(0.6rem, 0.85vw, 0.72rem);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.34em 0.7em;
    border-radius: 100px;
}
.dsar-chip svg { width: 1em; height: 1em; flex: none; stroke-width: 3.4; }
.dsar-chip-pass { background: var(--accent-green); color: #fff; }
.dsar-chip-fail { background: var(--accent-red); color: #fff; }

/* burden flags — the weighted conclusion */
.dsar-burden {
    flex: none;
    margin-top: clamp(0.55rem, 1.1vh, 0.9rem);
    padding: clamp(0.6rem, 1.15vw, 0.92rem) clamp(0.7rem, 1.35vw, 1.05rem);
    background: rgba(220,38,38,0.045);
    border: 1px solid rgba(220,38,38,0.2);
    border-left: 3px solid var(--accent-red);
    border-radius: 9px;
}
.dsar-burden-head { display: flex; align-items: center; gap: 0.5rem; }
.dsar-burden-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: clamp(17px, 2vw, 22px);
    height: clamp(17px, 2vw, 22px);
    border-radius: 50%;
    background: var(--accent-red);
    color: #fff;
    flex: none;
}
.dsar-burden-icon svg { width: 0.8em; height: 0.8em; }
.dsar-burden-title {
    font-family: var(--font-display);
    font-size: clamp(0.84rem, 1.3vw, 0.98rem);
    font-weight: 600;
    color: var(--accent-red);
}
.dsar-burden-count {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: clamp(0.62rem, 0.88vw, 0.74rem);
    font-weight: 700;
    color: #fff;
    background: var(--accent-red);
    border-radius: 100px;
    padding: 0.12em 0.6em;
}
.dsar-burden-flags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: clamp(0.45rem, 0.9vh, 0.7rem);
}
.dsar-burden-flag {
    font-family: var(--font-mono);
    font-size: clamp(0.62rem, 0.88vw, 0.74rem);
    font-weight: 600;
    color: var(--accent-red);
    background: var(--bg-card);
    border: 1px solid rgba(220,38,38,0.2);
    border-radius: 6px;
    padding: 0.2em 0.6em;
}
.dsar-burden-note {
    margin-top: clamp(0.4rem, 0.8vh, 0.6rem);
    font-size: clamp(0.68rem, 0.95vw, 0.82rem);
    color: var(--text-secondary);
    line-height: 1.45;
}
```

#### Tracker Radar HTML

```html
<section class="slide" data-title="Tracking Systems">
    <div class="slide-content">
        <span class="badge reveal">Tracking Systems</span>
        <h2 class="reveal">Who's Watching?</h2>
        <div class="tracker-radar">
            <!-- Active pre-consent — red border + pulse -->
            <div class="tr-card tr-card-active reveal">
                <div class="tr-pulse"></div>
                <div class="tr-name">{TRACKER_NAME}</div>
                <div class="tr-domain">{DOMAINS}</div>
                <div class="tr-category">{CATEGORY}</div>
                <div class="tr-status tr-status-active">Active pre-consent</div>
            </div>
            <!-- Gated post-consent — yellow border, no pulse -->
            <div class="tr-card tr-card-gated reveal">
                <div class="tr-name">{TRACKER_NAME}</div>
                <div class="tr-domain">{DOMAINS}</div>
                <div class="tr-category">{CATEGORY}</div>
                <div class="tr-status tr-status-gated">Requests pre-consent, cookies gated</div>
            </div>
            <!-- CSP-only — muted, no pulse -->
            <div class="tr-card tr-card-csp reveal">
                <div class="tr-name">{TRACKER_NAME}</div>
                <div class="tr-domain">{DOMAINS}</div>
                <div class="tr-category">{CATEGORY}</div>
                <div class="tr-status tr-status-csp">CSP-whitelisted only</div>
            </div>
        </div>
        <div class="tr-summary reveal">
            <div class="tr-summary-item"><span class="tr-summary-dot tr-summary-dot-active"></span> {N} active pre-consent</div>
            <div class="tr-summary-item"><span class="tr-summary-dot tr-summary-dot-gated"></span> {N} gated post-consent</div>
            <div class="tr-summary-item"><span class="tr-summary-dot tr-summary-dot-csp"></span> {N} CSP-only</div>
        </div>
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">{N} / {TOTAL}</div>
</section>
```

**Adaptation rules:**
- Sort cards: active pre-consent first, then gated, then CSP-only. Most severe at top-left.
- Only show the pulse dot (`.tr-pulse`) on `tr-card-active` cards — these are the violations.
- CSP-only trackers are faded (0.5 opacity) — they're potential infrastructure, not active violations.
- If no trackers detected, skip this slide entirely.
- Category values: "Bot Detection", "Analytics", "Advertising", "Audience Management", "Session Replay", "Tag Management", "Social", "Error Monitoring".
- Max 8 cards per slide. If more, split into "Tracking Systems (1/2)" etc.
- The summary strip shows counts per tier — omit tiers with 0 items.

---

### 9. Compliance Matrix (GDPR Compliance)

A grid of stamp-like cards — one per GDPR/ePrivacy article. Each stamp shows pass (green circle), fail (red circle), or partial (amber circle) with the article number and a brief title. Makes the legal compliance status immediately scannable.

#### Compliance Matrix CSS

```css
/* Compliance Matrix — stamp grid */
.compliance-matrix {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
    gap: clamp(0.4rem, 0.8vw, 0.6rem);
    margin-top: var(--content-gap);
}

/* Individual article card */
.cm-card {
    position: relative;
    padding: clamp(0.5rem, 1vw, 0.75rem);
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 8px;
    text-align: center;
    overflow: hidden;
}
.cm-card-pass { border-color: rgba(52,211,153,0.25); }
.cm-card-fail { border-color: rgba(248,113,113,0.25); }
.cm-card-partial { border-color: rgba(251,191,36,0.25); }

/* Stamp circle — the compliance verdict */
.cm-stamp {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: clamp(2rem, 4vw, 3rem);
    height: clamp(2rem, 4vw, 3rem);
    border-radius: 50%;
    border: 2px solid;
    font-size: clamp(0.8rem, 1.4vw, 1.1rem);
    margin-bottom: 0.3rem;
}
.cm-card-pass .cm-stamp {
    border-color: var(--accent-green);
    color: var(--accent-green);
    background: rgba(52,211,153,0.06);
}
.cm-card-fail .cm-stamp {
    border-color: var(--accent-red);
    color: var(--accent-red);
    background: rgba(248,113,113,0.06);
}
.cm-card-partial .cm-stamp {
    border-color: var(--accent-yellow);
    color: var(--accent-yellow);
    background: rgba(251,191,36,0.06);
}

/* Article reference + title */
.cm-article {
    font-family: var(--font-mono);
    font-size: var(--mono-size);
    font-weight: 600;
    color: var(--text-primary);
}
.cm-title {
    font-size: clamp(0.5rem, 0.7vw, 0.6rem);
    color: var(--text-secondary);
    line-height: 1.3;
    margin-top: 0.15rem;
}
.cm-finding {
    font-size: clamp(0.45rem, 0.6vw, 0.55rem);
    color: var(--text-muted);
    margin-top: 0.2rem;
    font-style: italic;
    line-height: 1.25;
}

/* Summary row */
.cm-summary {
    display: flex;
    justify-content: center;
    gap: clamp(1rem, 2vw, 2rem);
    margin-top: clamp(0.5rem, 1vh, 0.75rem);
    font-size: var(--small-size);
    color: var(--text-secondary);
}
.cm-summary-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.cm-summary-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
}
.cm-summary-dot-pass { background: var(--accent-green); }
.cm-summary-dot-fail { background: var(--accent-red); }
.cm-summary-dot-partial { background: var(--accent-yellow); }
```

#### Compliance Matrix HTML

```html
<section class="slide" data-title="GDPR Compliance">
    <div class="slide-content">
        <span class="badge reveal">GDPR Compliance</span>
        <h2 class="reveal">Compliance Matrix</h2>
        <div class="compliance-matrix">
            <!-- Pass example -->
            <div class="cm-card cm-card-pass reveal">
                <div class="cm-stamp">&#10003;</div>
                <div class="cm-article">Art. 6(1)(a)</div>
                <div class="cm-title">Valid consent obtained</div>
            </div>
            <!-- Fail example -->
            <div class="cm-card cm-card-fail reveal">
                <div class="cm-stamp">&#10007;</div>
                <div class="cm-article">ePrivacy 5(3)</div>
                <div class="cm-title">Prior consent for cookies</div>
                <div class="cm-finding">Cookies set before consent interaction</div>
            </div>
            <!-- Partial example -->
            <div class="cm-card cm-card-partial reveal">
                <div class="cm-stamp">&#9888;</div>
                <div class="cm-article">Art. 44-49</div>
                <div class="cm-title">International transfers</div>
                <div class="cm-finding">DPF certified but subject to invalidation</div>
            </div>
        </div>
        <div class="cm-summary reveal">
            <div class="cm-summary-item"><span class="cm-summary-dot cm-summary-dot-pass"></span> {N} compliant</div>
            <div class="cm-summary-item"><span class="cm-summary-dot cm-summary-dot-fail"></span> {N} violations</div>
            <div class="cm-summary-item"><span class="cm-summary-dot cm-summary-dot-partial"></span> {N} partial</div>
        </div>
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">{N} / {TOTAL}</div>
</section>
```

**Adaptation rules:**
- Standard GDPR articles to always include (adapt based on findings):
  - Art. 5(1)(a) — Lawful processing
  - Art. 6(1)(a) — Valid consent
  - Art. 7 — Consent conditions (freely given, specific, informed)
  - Art. 13 — Privacy information provided
  - Art. 25 — Data protection by design
  - Art. 32 — Security measures
  - Art. 44-49 — International transfers
  - ePrivacy Art. 5(3) — Prior consent for non-essential cookies
- Use `cm-card-pass` with checkmark for compliant articles.
- Use `cm-card-fail` with cross for clear violations. Add `.cm-finding` with the specific issue.
- Use `cm-card-partial` with warning for debatable/partial compliance. Add `.cm-finding` explaining the ambiguity.
- Max 8 cards per slide. The standard 8 articles above fit on one slide.
- Stamp symbols: `&#10003;` (checkmark) for pass, `&#10007;` (cross) for fail, `&#9888;` (warning) for partial.

---

### 10. Request Pulse (Third-Party Request Volume)

A horizontal bar chart showing request counts per third-party domain, split into pre-consent (red) and post-consent (yellow) segments. Reveals which domains have the heaviest presence and whether consent gates them. Like a network pulse monitor — each bar is a "heartbeat" of data flowing to that domain.

#### Request Pulse CSS

```css
/* Request Pulse — domain request volume chart */
/* Request Pulse — stacked pre/post request bars per domain. rp-* exclusive to buildRequestPulse. */
:root { --rp-domain-w: clamp(8.5rem, 16.5vw, 12.5rem); --rp-count-w: 2.9em; --rp-gap: clamp(0.45rem, 0.9vw, 0.65rem); }
.request-pulse {
    margin-top: clamp(0.6rem, 1.4vh, 1rem);
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
}

/* Scale header — aligned to the bar track via matching spacers */
.rp-scale {
    display: flex;
    align-items: flex-end;
    gap: var(--rp-gap);
    margin-bottom: clamp(0.3rem, 0.7vh, 0.5rem);
}
.rp-scale-axis {
    width: var(--rp-domain-w);
    flex-shrink: 0;
    text-align: right;
    padding-right: clamp(0.4rem, 0.7vw, 0.6rem);
    font-family: var(--font-mono);
    font-size: clamp(0.55rem, 0.72vw, 0.65rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
}
.rp-scale-rail { flex: 1; position: relative; height: 1.35em; }
.rp-scale-countspace {
    width: var(--rp-count-w);
    flex-shrink: 0;
    text-align: right;
    align-self: flex-end;
    font-family: var(--font-mono);
    font-size: clamp(0.55rem, 0.72vw, 0.65rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
}
.rp-scale-line { position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--bg-card-border); }
.rp-scale-tick {
    position: absolute; bottom: 0.28rem;
    font-family: var(--font-mono);
    font-size: clamp(0.6rem, 0.82vw, 0.72rem);
    font-weight: 600;
    color: var(--text-secondary);
}
.rp-scale-tick-mid { transform: translateX(-50%); }

/* rows wrapper fills the remaining vertical space */
.rp-rows {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: clamp(0.45rem, 1vh, 0.85rem);
}

/* Individual domain row */
.rp-row {
    display: flex;
    align-items: center;
    gap: var(--rp-gap);
    flex: 1;
    min-height: 0;
}
.rp-domain {
    font-family: var(--font-mono);
    font-size: clamp(0.62rem, 0.85vw, 0.76rem);
    color: var(--text-primary);
    width: var(--rp-domain-w);
    flex-shrink: 0;
    text-align: right;
    padding-right: clamp(0.4rem, 0.7vw, 0.6rem);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.rp-bar-track {
    flex: 1;
    height: clamp(1.4rem, 3.2vh, 2.1rem);
    position: relative;
    border-radius: 4px;
    background:
        linear-gradient(90deg, transparent calc(50% - 0.5px), var(--bg-card-border) calc(50% - 0.5px) calc(50% + 0.5px), transparent calc(50% + 0.5px)),
        linear-gradient(90deg, transparent calc(100% - 1px), var(--bg-card-border) calc(100% - 1px));
    border-left: 2px solid var(--text-muted);
    display: flex;
    overflow: hidden;
}
.rp-bar-pre, .rp-bar-post, .rp-bar-essential {
    height: 100%;
    display: flex; align-items: center; justify-content: flex-end;
    padding: 0 0.5em;
    font-family: var(--font-mono);
    font-size: clamp(0.62rem, 0.82vw, 0.76rem);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    min-width: 0;
}
.rp-bar-pre { background: var(--accent-red); color: #fff; }
.rp-bar-post { background: var(--accent-yellow); color: #1c1917; }
.rp-bar-essential { background: var(--accent-green); color: #fff; }
/* crisp separator between abutting segments */
.rp-bar-pre + .rp-bar-post { box-shadow: inset 1.5px 0 0 var(--bg-primary); }

.rp-count {
    font-family: var(--font-mono);
    font-size: clamp(0.8rem, 1.08vw, 0.98rem);
    font-weight: 700;
    color: var(--text-primary);
    flex-shrink: 0;
    width: var(--rp-count-w);
    text-align: right;
}

/* Legend */
.rp-legend {
    display: flex;
    gap: clamp(0.9rem, 1.8vw, 1.5rem);
    padding-left: var(--rp-domain-w);
    margin-top: clamp(0.45rem, 1vh, 0.8rem);
    padding-top: clamp(0.4rem, 0.8vh, 0.6rem);
    border-top: 1px solid var(--bg-card-border);
    font-family: var(--font-mono);
    font-size: clamp(0.6rem, 0.8vw, 0.72rem);
    color: var(--text-secondary);
}
.rp-legend-item { display: flex; align-items: center; gap: 0.45rem; }
.rp-legend-swatch { width: 14px; height: 10px; border-radius: 3px; flex: none; }
```

#### Request Pulse HTML

```html
<section class="slide" data-title="Third-Party Requests">
    <div class="slide-content">
        <span class="badge reveal">Network Activity</span>
        <h2 class="reveal">Request Pulse</h2>
        <div class="request-pulse reveal">
            <div class="rp-scale">
                <div class="rp-scale-line"></div>
                <span class="rp-scale-tick" style="left: clamp(7rem,14vw,10rem)">0</span>
                <span class="rp-scale-tick" style="left: 50%">{MID}</span>
                <span class="rp-scale-tick" style="right: 0">{MAX}</span>
            </div>
            <!-- First-party / CDN — green, essential -->
            <div class="rp-row reveal">
                <span class="rp-domain">{CDN_DOMAIN}</span>
                <div class="rp-bar-track">
                    <div class="rp-bar-essential" style="width: {PCT}%"></div>
                </div>
                <span class="rp-count">{N}</span>
            </div>
            <!-- Third-party with pre + post split -->
            <div class="rp-row reveal">
                <span class="rp-domain">{DOMAIN}</span>
                <div class="rp-bar-track">
                    <div class="rp-bar-pre" style="width: {PRE_PCT}%"></div>
                    <div class="rp-bar-post" style="width: {POST_PCT}%"></div>
                </div>
                <span class="rp-count">{N}</span>
            </div>
            <!-- Third-party pre-consent only -->
            <div class="rp-row reveal">
                <span class="rp-domain">{DOMAIN}</span>
                <div class="rp-bar-track">
                    <div class="rp-bar-pre" style="width: {PCT}%"></div>
                </div>
                <span class="rp-count">{N}</span>
            </div>
        </div>
        <div class="rp-legend reveal">
            <div class="rp-legend-item"><span class="rp-legend-swatch" style="background: var(--accent-green); opacity: 0.5"></span> Essential / CDN</div>
            <div class="rp-legend-item"><span class="rp-legend-swatch" style="background: var(--accent-red); opacity: 0.7"></span> Pre-consent</div>
            <div class="rp-legend-item"><span class="rp-legend-swatch" style="background: var(--accent-yellow); opacity: 0.7"></span> Post-consent</div>
        </div>
    </div>
    <div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember, #c75c2c); -webkit-text-fill-color:var(--brand-ember, #c75c2c)">&gt;_</span> datagobes.dev</a></div>
    <div class="slide-num">{N} / {TOTAL}</div>
</section>
```

**Adaptation rules:**
- Sort rows by total request count (highest first). First-party CDN typically at top.
- Bar widths are percentage of the max request count. `width: (count / max_count * 100)%`.
- Split bars into pre-consent (red) and post-consent (yellow) segments. Width of each segment proportional to its count within the total for that domain.
- Use `.rp-bar-essential` (green, muted) for first-party domains and CDNs — these aren't violations.
- Scale ticks: 0, midpoint, and max value. Adjust based on data range.
- Max 12 rows per slide. If more domains, show top 12 by request count.
- If a domain only has pre-consent requests, show only the red segment.
- If a domain only has post-consent requests, show only the yellow segment.
- Skip this slide if fewer than 3 third-party domains (not enough data to be interesting).

---

### New Component Styles (v3.0)

All CSS for new slide types added in the gap analysis upgrade.

```css
/* ─── Variant Comparison (variantComparison slide) ─── */
/* Verdict hero — lead with the takeaway, not a footnote. */
.vc-verdict-hero {
    display: flex;
    align-items: center;
    gap: clamp(0.6rem, 1.2vw, 0.9rem);
    margin-top: var(--element-gap);
    padding: clamp(0.6rem, 1.2vw, 0.9rem) clamp(0.9rem, 1.8vw, 1.25rem);
    background: linear-gradient(90deg, rgba(199,92,44,0.08), var(--bg-card) 70%);
    border: 1px solid var(--bg-card-border);
    border-left: 4px solid var(--accent);
    border-radius: 8px;
    box-shadow: var(--card-shadow);
}
.vc-verdict-icon {
    font-size: clamp(1.1rem, 2vw, 1.5rem);
    color: var(--accent);
    flex-shrink: 0;
    line-height: 1;
}
.vc-verdict-text {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(0.8rem, 1.25vw, 1rem);
    font-weight: 600;
    line-height: 1.35;
    color: var(--text-primary);
}
.vc-legend {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(0.75rem, 1.6vw, 1.25rem);
    align-items: center;
    justify-content: center;
    margin-top: var(--content-gap);
    margin-bottom: var(--element-gap);
    font-size: var(--small-size);
    color: var(--text-secondary);
}
.vc-legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}
.vc-legend-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
}
.vc-legend-scale {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    color: var(--text-muted);
    margin-left: auto;
    padding-left: clamp(0.5rem, 1vw, 1rem);
}
.vc-chart {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: clamp(0.6rem, 1.2vw, 1rem);
}
.vc-metric-row {
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 8px;
    padding: clamp(0.7rem, 1.3vw, 1.1rem) clamp(0.8rem, 1.5vw, 1.2rem);
    box-shadow: var(--card-shadow);
}
.vc-metric-title {
    font-family: var(--font-mono);
    font-size: clamp(0.7rem, 1vw, 0.85rem);
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--text-primary);
    margin-bottom: clamp(0.5rem, 1vh, 0.75rem);
}
.vc-bar-group {
    display: flex;
    flex-direction: column;
    gap: clamp(0.4rem, 0.9vh, 0.65rem);
}
.vc-bar-row {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    column-gap: 0.4rem;
    row-gap: 0.2rem;
}
.vc-bar-label {
    grid-column: 1;
    grid-row: 1;
    font-size: var(--small-size);
    color: var(--text-secondary);
    white-space: nowrap;
}
.vc-bar-track {
    grid-column: 1 / -1;
    grid-row: 2;
    position: relative;
    height: clamp(0.9rem, 1.8vw, 1.25rem);
    background: rgba(28,25,23,0.04);
    border-radius: 4px;
    overflow: hidden;
}
.vc-bar-fill {
    height: 100%;
    width: 0;
    min-width: 2px;
    border-radius: 4px;
    transition: width 0.9s var(--ease-out-expo);
}
.slide.visible .vc-bar-fill {
    width: var(--vc-w);
}
.vc-bar-val {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
    font-family: var(--font-mono);
    font-size: clamp(0.7rem, 1.05vw, 0.9rem);
    font-weight: 700;
    line-height: 1;
}
.vc-tone-good .vc-bar-val { color: var(--accent-green); }
.vc-tone-neutral .vc-bar-val { color: var(--accent-yellow); }
.vc-tone-bad .vc-bar-val { color: var(--accent-red); }

/* ─── Reject Scenario ─── */
.vc-reject-stats {
    display: flex;
    gap: var(--content-gap);
    justify-content: center;
    margin-top: var(--content-gap);
}
.vc-stat-box {
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 8px;
    padding: 1rem 1.5rem;
    text-align: center;
    box-shadow: var(--card-shadow);
}
.vc-stat-bad { border-top: 3px solid var(--accent-red); }
.vc-stat-good { border-top: 3px solid var(--accent-green); }
.vc-stat-warn { border-top: 3px solid var(--accent-yellow); }
.vc-stat-num {
    font-family: var(--font-mono);
    font-size: clamp(1.5rem, 3vw, 2rem);
    font-weight: 700;
}
.vc-stat-bad .vc-stat-num { color: var(--accent-red); }
.vc-stat-good .vc-stat-num { color: var(--accent-green); }
.vc-stat-warn .vc-stat-num { color: var(--accent-yellow); }
.vc-stat-label {
    font-size: var(--small-size);
    color: var(--text-secondary);
    margin-top: 0.25rem;
}
.vc-persist-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: var(--content-gap);
}
.vc-persist-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 0.8rem;
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 6px;
    font-size: var(--small-size);
}
.vc-persist-name {
    font-family: var(--font-mono);
    font-weight: 600;
    flex: 1;
}
.vc-persist-domain {
    color: var(--text-muted);
    font-family: var(--font-mono);
}
.vc-persist-purpose {
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 600;
}
.vc-persist-marketing { background: rgba(220,38,38,0.1); color: var(--accent-red); }
.vc-persist-analytics { background: rgba(217,119,6,0.1); color: var(--accent-yellow); }
.vc-persist-essential { background: rgba(5,150,105,0.1); color: var(--accent-green); }
.vc-persist-unknown { background: rgba(28,25,23,0.06); color: var(--text-muted); }
.vc-persist-reason {
    font-size: clamp(0.5rem, 0.75vw, 0.65rem);
    color: var(--text-muted);
    font-style: italic;
    padding: 0 clamp(0.5rem, 1vw, 0.8rem);
    margin-top: -0.15rem;
    margin-bottom: 0.15rem;
}

/* ─── Consent Granularity (within Consent slide) ─── */
.cg-summary {
    margin-top: var(--content-gap);
    padding: 0.6rem 1rem;
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 6px;
    box-shadow: var(--card-shadow);
}
.cg-toggle-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--body-size);
}
.cg-categories {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-top: 0.4rem;
}
.cg-cat {
    padding: 0.15rem 0.5rem;
    border-radius: 3px;
    font-size: 0.65rem;
    background: rgba(28,25,23,0.04);
    color: var(--text-secondary);
}

/* ─── GPC Callout (within Consent slide) ─── */
.gpc-callout {
    margin-top: var(--element-gap);
    padding: 0.5rem 1rem;
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 6px;
    box-shadow: var(--card-shadow);
}
.gpc-header {
    font-size: var(--small-size);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.3rem;
}
.gpc-signals {
    display: flex;
    gap: 1rem;
    font-size: var(--small-size);
}

/* ─── TCF Purpose Chips ─── */
/* ─── TCF & Consent Mode: two explained panels ─── */
.ct-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--content-gap);
    align-items: start;
}
.ct-grid-single {
    grid-template-columns: 1fr;
    max-width: 46rem;
    margin: 0 auto;
}
.ct-panel {
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 12px;
    padding: clamp(0.9rem, 1.6vw, 1.3rem);
    box-shadow: var(--card-shadow);
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
}
.ct-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
}
.ct-panel-title {
    font-size: clamp(0.95rem, 1.4vw, 1.15rem);
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
}
.ct-explainer {
    font-size: var(--small-size);
    line-height: 1.45;
    color: var(--text-secondary);
    margin: 0;
}
.ct-explainer em { color: var(--accent); font-style: normal; font-weight: 600; }
.ct-legend {
    display: flex;
    gap: 0.75rem;
    font-size: var(--small-size);
    color: var(--text-muted);
}
.ct-legend-item { display: inline-flex; align-items: center; gap: 0.3rem; }
.ct-dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; display: inline-block; }
.ct-dot-granted { background: var(--accent-green); }
.ct-dot-denied { background: var(--accent-red); }
.ct-stats { display: flex; gap: 0.6rem; }
.ct-stat {
    flex: 1;
    text-align: center;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--bg-card-border);
    border-radius: 8px;
    background: linear-gradient(90deg, rgba(199,92,44,0.06), var(--bg-card) 70%);
}
.ct-stat-num {
    display: block;
    font-family: var(--font-mono);
    font-size: clamp(1.1rem, 2vw, 1.5rem);
    font-weight: 700;
    color: var(--accent);
    line-height: 1.1;
}
.ct-stat-label {
    font-size: var(--small-size);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.ct-sublabel {
    font-size: var(--small-size);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.1rem;
}
.ct-note {
    font-size: var(--small-size);
    color: var(--text-muted);
    font-style: italic;
    line-height: 1.4;
    margin: 0.1rem 0 0;
}

/* TCF purpose list — human-readable, colour-coded */
.tcf-purposes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.35rem;
}
.tcf-purpose {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.32rem 0.5rem;
    border-radius: 6px;
    border-left: 3px solid var(--text-muted);
    font-size: var(--small-size);
    line-height: 1.25;
}
.tcf-purpose-granted {
    border-left-color: var(--accent-green);
    background: linear-gradient(90deg, rgba(5,150,105,0.07), var(--bg-card) 60%);
}
.tcf-purpose-denied {
    border-left-color: var(--accent-red);
    background: linear-gradient(90deg, rgba(220,38,38,0.07), var(--bg-card) 60%);
}
.tcf-purpose-icon { font-weight: 700; flex-shrink: 0; }
.tcf-purpose-granted .tcf-purpose-icon { color: var(--accent-green); }
.tcf-purpose-denied .tcf-purpose-icon { color: var(--accent-red); }
.tcf-purpose-label { color: var(--text-primary); }

/* GCM before → after table */
.gcm-table { display: flex; flex-direction: column; gap: 0.3rem; }
.gcm-row {
    display: grid;
    grid-template-columns: 1.6fr auto auto auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0.32rem 0.55rem;
    border-radius: 6px;
    background: rgba(28,25,23,0.025);
    font-size: var(--small-size);
}
.gcm-row-changed { background: linear-gradient(90deg, rgba(199,92,44,0.07), var(--bg-card) 70%); }
.gcm-row-head {
    background: none;
    padding-bottom: 0.1rem;
}
.gcm-row-name { color: var(--text-primary); font-weight: 500; }
.gcm-col-head, .gcm-row-head .gcm-row-name {
    font-size: var(--small-size);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    text-align: center;
}
.gcm-state {
    font-family: var(--font-mono);
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
}
.gcm-state-granted { color: var(--accent-green); }
.gcm-state-denied { color: var(--accent-red); }
.gcm-state-na { color: var(--text-muted); }
.gcm-arrow { color: var(--text-muted); text-align: center; }

/* ─── Consent Revocation Flow ─── */
.cr-flow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin-top: var(--content-gap);
}
.cr-step {
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 8px;
    padding: 1rem 1.5rem;
    text-align: center;
    box-shadow: var(--card-shadow);
    min-width: 120px;
}
.cr-step-accept { border-top: 3px solid var(--accent-green); }
.cr-step-revoke { border-top: 3px solid var(--accent-red); }
.cr-step-icon { font-size: 1.5rem; margin-bottom: 0.3rem; }
.cr-step-label { font-weight: 700; font-size: var(--body-size); }
.cr-step-detail { font-size: var(--small-size); color: var(--text-secondary); }
.cr-step-cookies { font-family: var(--font-mono); font-size: var(--small-size); margin-top: 0.3rem; }
.cr-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 0.5rem;
}
.cr-arrow-line {
    width: 3rem;
    height: 2px;
    background: var(--text-muted);
    position: relative;
}
.cr-arrow-line::after {
    content: '→';
    position: absolute;
    right: -0.5rem;
    top: -0.6rem;
    color: var(--text-muted);
}
.cr-arrow-warn .cr-arrow-line { background: var(--accent-red); }
.cr-arrow-warn .cr-arrow-line::after { color: var(--accent-red); }
.cr-arrow-text {
    font-size: 0.6rem;
    color: var(--text-muted);
    margin-top: 0.2rem;
    font-family: var(--font-mono);
}
.cr-verdict {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: var(--content-gap);
}
.cr-verdict-item { font-size: var(--body-size); }
.cr-verdict-good { color: var(--accent-green); }
.cr-verdict-bad { color: var(--accent-red); }
.cr-remaining {
    margin-top: var(--content-gap);
    padding: 0.6rem 1rem;
    background: rgba(220,38,38,0.04);
    border-radius: 6px;
}
.cr-remaining-label {
    font-size: var(--small-size);
    color: var(--text-secondary);
    margin-bottom: 0.3rem;
}
.cr-remaining-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
}
.cr-persist-cookie {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    padding: 0.15rem 0.4rem;
    background: rgba(220,38,38,0.08);
    color: var(--accent-red);
    border-radius: 3px;
}
.cr-persist-more {
    background: rgba(28,25,23,0.06);
    color: var(--text-muted);
}

/* ─── Fingerprinting Heatmap ─── */
.fp-severity {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--body-size);
    margin-bottom: var(--content-gap);
}
.fp-severity-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}
.fp-api-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}
.fp-api-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0;
}
.fp-api-info {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: clamp(10rem, 20vw, 15rem);
    flex-shrink: 0;
}
.fp-api-name {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.fp-phase {
    font-size: 0.55rem;
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-weight: 700;
    flex-shrink: 0;
}
.fp-phase-pre { background: var(--accent-red); color: #fff; }
.fp-phase-post { background: var(--accent-yellow); color: #fff; }
.fp-api-bar-track {
    flex: 1;
    height: 0.8rem;
    background: rgba(28,25,23,0.03);
    border-radius: 3px;
    overflow: hidden;
}
.fp-api-bar {
    height: 100%;
    border-radius: 3px;
    opacity: 0.7;
    transition: width 0.6s var(--ease-out-expo);
}
.fp-api-count {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    color: var(--text-muted);
    width: 2rem;
    text-align: right;
}
.fp-legend {
    display: flex;
    gap: 1rem;
    margin-top: var(--content-gap);
    font-size: var(--small-size);
    color: var(--text-secondary);
}
.fp-legend-item { display: flex; align-items: center; gap: 0.3rem; }
.fp-legend-swatch { width: 12px; height: 6px; border-radius: 2px; opacity: 0.7; }

/* ─── Form Leakage Data Flow ─── */
.fl-summary {
    text-align: center;
    color: var(--accent-red);
    font-size: var(--body-size);
    margin-bottom: var(--content-gap);
}
.fl-flows {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.fl-flow {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.8rem;
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 6px;
    box-shadow: var(--card-shadow);
}
.fl-source {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 8rem;
}
.fl-icon { font-size: 1.2rem; }
.fl-field {
    font-family: var(--font-mono);
    font-size: var(--body-size);
    font-weight: 600;
}
.fl-arrow {
    display: flex;
    align-items: center;
    gap: 0;
    flex: 1;
}
.fl-arrow-line {
    flex: 1;
    height: 2px;
    background: linear-gradient(90deg, var(--accent-red), rgba(220,38,38,0.3));
}
.fl-arrow-head {
    color: var(--accent-red);
    font-size: 0.8rem;
}
.fl-dest {
    min-width: 10rem;
    text-align: right;
}
.fl-dest-domain {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    color: var(--accent-red);
    font-weight: 600;
}

/* ─── Data Subject Rights Click-Depth ─── */
.dsr-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: var(--content-gap);
}
.dsr-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.8rem;
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 6px;
    box-shadow: var(--card-shadow);
}
.dsr-accessible { border-left: 3px solid var(--accent-green); }
.dsr-missing { border-left: 3px solid var(--accent-red); }
.dsr-icon { font-size: 0.9rem; flex-shrink: 0; }
.dsr-accessible .dsr-icon { color: var(--accent-green); }
.dsr-missing .dsr-icon { color: var(--accent-red); }
.dsr-right {
    font-size: var(--body-size);
    font-weight: 500;
    min-width: 10rem;
}
.dsr-depth {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.dsr-depth-track {
    flex: 1;
    height: 0.6rem;
    background: rgba(28,25,23,0.03);
    border-radius: 3px;
    overflow: hidden;
}
.dsr-depth-bar {
    height: 100%;
    border-radius: 3px;
    transition: width 0.6s var(--ease-out-expo);
}
.dsr-depth-val {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    color: var(--text-secondary);
    min-width: 5rem;
    text-align: right;
}
.dsr-legend {
    display: flex;
    gap: 1rem;
    margin-top: var(--element-gap);
    font-size: var(--small-size);
    color: var(--text-secondary);
}
.dsr-legend-item { display: flex; align-items: center; gap: 0.3rem; }
.dsr-legend-swatch { width: 12px; height: 6px; border-radius: 2px; }

/* ─── Privacy Policy Checklist ─── */
.pp-score {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: var(--content-gap);
}
.pp-score-ring { position: relative; }
.pp-score-val {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
}
.pp-score-label {
    font-size: var(--body-size);
    color: var(--text-secondary);
}
.pp-checklist {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}
.pp-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.4rem 0.7rem;
    border-radius: 4px;
}
.pp-present { background: rgba(5,150,105,0.04); }
.pp-absent { background: rgba(220,38,38,0.04); }
.pp-vague { background: rgba(217,119,6,0.04); }
.pp-icon {
    flex-shrink: 0;
    font-size: 0.85rem;
}
.pp-present .pp-icon { color: var(--accent-green); }
.pp-absent .pp-icon { color: var(--accent-red); }
.pp-vague .pp-icon { color: var(--accent-yellow); }
.pp-content { flex: 1; }
.pp-element {
    font-size: var(--small-size);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.3rem;
}
.pp-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.6rem;
    color: var(--text-muted);
    padding: 0;
    line-height: 1;
}
.pp-excerpt {
    display: none;
    font-size: 0.65rem;
    color: var(--text-secondary);
    margin-top: 0.2rem;
    padding: 0.3rem 0.5rem;
    background: rgba(28,25,23,0.03);
    border-radius: 3px;
    font-style: italic;
}

/* ─── Cookie Purpose Matching (cpm-*) — declared→observed matching matrix ─── */
.cpm {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: clamp(0.5rem, 1.2vh, 0.95rem);
    margin-top: clamp(0.5rem, 1.2vh, 1rem);
}

/* Match-rate band */
.cpm-rate {
    flex: none;
    display: flex;
    align-items: center;
    gap: clamp(0.85rem, 1.9vw, 1.7rem);
    padding: clamp(0.7rem, 1.4vw, 1.15rem) clamp(0.95rem, 1.9vw, 1.4rem);
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 13px;
    box-shadow: var(--card-shadow);
}
.cpm-rate-num {
    font-family: var(--font-display);
    font-size: clamp(2rem, 4.2vw, 3.3rem);
    font-weight: 800; line-height: 0.9;
    color: var(--accent); flex: none;
}
.cpm-rate-mid { flex: 1; display: flex; flex-direction: column; gap: clamp(0.3rem, 0.7vh, 0.5rem); min-width: 0; }
.cpm-rate-label {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--text-secondary);
}
.cpm-rate-track { height: clamp(8px, 1.1vh, 11px); background: rgba(28,25,23,0.08); border-radius: 100px; overflow: hidden; }
.cpm-rate-fill { height: 100%; background: var(--accent); border-radius: 100px; }
.cpm-rate-counts { flex: none; display: flex; flex-direction: column; gap: clamp(0.3rem, 0.7vh, 0.5rem); font-family: var(--font-mono); font-size: var(--small-size); }
.cpm-count { display: flex; align-items: center; gap: 0.45rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; }
.cpm-count-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.cpm-count-pass .cpm-count-dot { background: var(--accent-green); }
.cpm-count-fail .cpm-count-dot { background: var(--accent-red); }

/* Matrix */
.cpm-matrix { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: clamp(0.35rem, 0.8vh, 0.6rem); }
.cpm-header, .cpm-row {
    display: grid;
    grid-template-columns: 1.25fr 1fr clamp(2.4rem, 3.4vw, 3rem) 1fr;
    align-items: center;
    gap: clamp(0.5rem, 1.2vw, 1.1rem);
}
.cpm-header {
    flex: none;
    padding: 0 clamp(0.75rem, 1.5vw, 1.1rem) clamp(0.3rem, 0.6vh, 0.45rem);
    font-family: var(--font-mono);
    font-size: clamp(0.6rem, 0.85vw, 0.74rem);
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--bg-card-border);
}
.cpm-h-verdict { text-align: center; }
.cpm-h-declared { text-align: right; }
.cpm-list { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: clamp(0.35rem, 0.8vh, 0.6rem); }
.cpm-row {
    flex: 1;
    padding: clamp(0.42rem, 0.85vh, 0.66rem) clamp(0.75rem, 1.5vw, 1.1rem);
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-left: 3px solid var(--text-muted);
    border-radius: 9px;
    box-shadow: var(--card-shadow);
}
.cpm-row-pass { border-left-color: var(--accent-green); background: rgba(5,150,105,0.04); }
.cpm-row-fail { border-left-color: var(--accent-red); background: rgba(220,38,38,0.04); }
.cpm-cookie {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: clamp(0.74rem, 1.05vw, 0.92rem);
    color: var(--text-primary);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cpm-purpose {
    font-family: var(--font-mono);
    font-size: clamp(0.66rem, 0.92vw, 0.8rem);
    font-weight: 600;
    padding: 0.24em 0.7em;
    border-radius: 6px;
    background: rgba(28,25,23,0.06);
    border: 1px solid var(--bg-card-border);
    color: var(--text-primary);
}
.cpm-declared { justify-self: end; }
.cpm-observed { justify-self: start; }
.cpm-row-fail .cpm-declared { text-decoration: line-through; opacity: 0.7; }
.cpm-row-pass .cpm-observed { background: rgba(5,150,105,0.12); border-color: rgba(5,150,105,0.3); color: var(--accent-green); }
.cpm-row-fail .cpm-observed { background: rgba(220,38,38,0.12); border-color: rgba(220,38,38,0.3); color: var(--accent-red); }
.cpm-verdict {
    justify-self: center;
    display: inline-flex; align-items: center; justify-content: center;
    width: clamp(1.7rem, 2.7vw, 2.3rem); height: clamp(1.7rem, 2.7vw, 2.3rem);
    border-radius: 50%; flex: none;
}
.cpm-verdict svg { width: 56%; height: 56%; }
.cpm-verdict-pass { background: var(--accent-green); color: #fff; }
.cpm-verdict-fail { background: var(--accent-red); color: #fff; }

/* ─── Piggybacking Chains ─── */
.pb-chains {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-top: var(--content-gap);
}
.pb-chain {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.8rem;
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 6px;
    box-shadow: var(--card-shadow);
}
.pb-chain-nodes {
    display: flex;
    align-items: center;
    gap: 0;
    flex: 1;
    overflow-x: auto;
}
.pb-node {
    display: flex;
    flex-direction: column;
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    flex-shrink: 0;
}
.pb-node-root {
    background: rgba(5,150,105,0.08);
    border: 1px solid rgba(5,150,105,0.2);
}
.pb-node-child {
    background: rgba(220,38,38,0.06);
    border: 1px solid rgba(220,38,38,0.15);
}
.pb-node-name {
    font-family: var(--font-mono);
    font-size: var(--small-size);
    font-weight: 600;
}
.pb-node-domain {
    font-size: 0.6rem;
    color: var(--text-muted);
}
.pb-arrow {
    font-size: 0.8rem;
    color: var(--accent-red);
    padding: 0 0.2rem;
    flex-shrink: 0;
}
.pb-chain-risk {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    flex-shrink: 0;
}
.pb-risk-low { background: rgba(5,150,105,0.1); color: var(--accent-green); }
.pb-risk-medium { background: rgba(217,119,6,0.1); color: var(--accent-yellow); }
.pb-risk-high { background: rgba(220,38,38,0.1); color: var(--accent-red); }

/* ─── Storage Analysis ─── */
.sa-section {
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 8px;
    padding: 0.8rem 1rem;
    margin-top: var(--element-gap);
    box-shadow: var(--card-shadow);
}
.sa-section-title {
    font-family: var(--font-mono);
    font-size: var(--body-size);
    font-weight: 600;
    margin: 0 0 0.5rem;
}
.sa-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--content-gap);
}
.sa-col-label {
    font-size: var(--small-size);
    font-weight: 700;
    margin-bottom: 0.3rem;
}
.sa-col {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}
.sa-item {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
}
.sa-item-pre { background: rgba(220,38,38,0.06); color: var(--accent-red); }
.sa-item-post { background: rgba(217,119,6,0.06); color: var(--accent-yellow); }
.sa-empty { font-size: 0.65rem; color: var(--text-muted); font-style: italic; }
```

### 13. Cookie Ownership (First-Party vs Third-Party)

#### Cookie Ownership CSS

```css
.cp-bar {
    display: flex;
    width: 100%;
    height: clamp(1.4rem, 2.4vh, 1.9rem);
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-card);
    margin-top: clamp(0.3rem, 0.6vh, 0.5rem);
}
.cp-bar-seg {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: width 0.8s var(--ease-out-expo);
    min-width: 2px;
}
.cp-bar-first { background: var(--accent-green); opacity: 0.75; }
.cp-bar-third { background: var(--accent-red);   opacity: 0.75; }
.cp-bar-count {
    font-family: var(--font-mono);
    font-size: clamp(0.55rem, 0.7vw, 0.65rem);
    font-weight: 600;
    color: #fff;
}
.cp-bar-legend {
    display: flex;
    gap: clamp(0.6rem, 1.2vw, 1rem);
    margin-top: clamp(0.3rem, 0.5vh, 0.45rem);
    font-size: clamp(0.5rem, 0.65vw, 0.6rem);
    color: var(--text-secondary);
}
.cp-legend-item { display: flex; align-items: center; gap: 0.35rem; }
.cp-legend-swatch {
    width: 10px; height: 6px;
    border-radius: 2px;
}
.cp-swatch-first { background: var(--accent-green); }
.cp-swatch-third { background: var(--accent-red); }

.cp-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(0.6rem, 1.2vw, 1rem);
    margin-top: clamp(0.5rem, 0.9vh, 0.7rem);
}
.cp-col {
    background: rgba(28,25,23,0.02);
    border: 1px solid var(--border-muted, rgba(120,113,108,0.25));
    border-radius: 4px;
    padding: clamp(0.4rem, 0.8vw, 0.6rem) clamp(0.5rem, 1vw, 0.8rem);
    display: flex;
    flex-direction: column;
    gap: clamp(0.15rem, 0.3vh, 0.25rem);
    min-height: 0;
}
.cp-col-first { border-top: 2px solid var(--accent-green); }
.cp-col-third { border-top: 2px solid var(--accent-red); }
.cp-col-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.4rem;
    margin-bottom: clamp(0.25rem, 0.4vh, 0.4rem);
    padding-bottom: clamp(0.2rem, 0.35vh, 0.3rem);
    border-bottom: 1px solid rgba(120,113,108,0.18);
}
.cp-col-label {
    font-family: var(--font-mono);
    font-size: clamp(0.55rem, 0.7vw, 0.65rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-primary);
}
.cp-col-sub {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: var(--text-muted);
    margin-left: 0.35rem;
}
.cp-col-count {
    font-family: var(--font-mono);
    font-size: clamp(0.7rem, 0.9vw, 0.85rem);
    font-weight: 700;
}
.cp-row {
    display: flex;
    align-items: center;
    gap: clamp(0.3rem, 0.6vw, 0.45rem);
    padding: 2px 0;
    min-height: clamp(0.9rem, 1.5vh, 1.15rem);
}
.cp-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    opacity: 0.8;
}
.cp-dot-essential { background: var(--accent-green); }
.cp-dot-functional { background: var(--accent-blue); }
.cp-dot-analytics { background: var(--accent-yellow); }
.cp-dot-tracking { background: var(--accent-red); }
.cp-dot-marketing { background: var(--accent-red); }
.cp-dot-unknown { background: var(--text-muted); opacity: 0.5; }
.cp-row-text {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    min-width: 0;
    flex: 1;
}
.cp-name {
    font-family: var(--font-mono);
    font-size: clamp(0.5rem, 0.65vw, 0.6rem);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 55%;
    flex-shrink: 0;
}
.cp-domain {
    font-family: var(--font-mono);
    font-size: clamp(0.45rem, 0.58vw, 0.55rem);
    color: var(--text-muted);
    opacity: 0.8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
}
.cp-more {
    font-family: var(--font-mono);
    font-size: clamp(0.45rem, 0.58vw, 0.55rem);
    color: var(--text-muted);
    opacity: 0.7;
    margin-top: 0.2rem;
    text-align: right;
}
.cp-empty {
    font-size: clamp(0.5rem, 0.65vw, 0.6rem);
    color: var(--text-muted);
    font-style: italic;
}
.cp-footnote {
    margin-top: clamp(0.5rem, 0.9vh, 0.7rem);
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    font-size: clamp(0.5rem, 0.65vw, 0.6rem);
    color: var(--text-secondary);
}
.cp-foot-pill {
    font-family: var(--font-mono);
    font-size: clamp(0.45rem, 0.58vw, 0.55rem);
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    background: rgba(28,25,23,0.05);
    text-transform: capitalize;
}
.cp-foot-marketing, .cp-foot-tracking { color: var(--accent-red); background: rgba(220,38,38,0.08); }
.cp-foot-analytics { color: var(--accent-yellow); background: rgba(217,119,6,0.08); }
.cp-foot-functional { color: var(--accent-blue); background: rgba(37,99,235,0.08); }
.cp-foot-essential { color: var(--accent-green); background: rgba(5,150,105,0.08); }
.cp-foot-unknown { color: var(--text-muted); }

@media (max-width: 720px) {
    .cp-grid { grid-template-columns: 1fr; }
    .cp-name { max-width: 50%; }
}
```

## Component Content Density

| Component | Max Items |
|-----------|-----------|
| Banner Blueprint | 1 banner wireframe + 5 annotations |
| Audit Trail Timeline | 10 events per slide |
| Document Shelf | 6 books |
| Transfer Circuit | 6 jurisdiction nodes (3 per side) |
| Shield Rings | 6 rings + legend |
| Persistence Bars | 10 cookie rows per slide |
| Fairness Scale | 4 factors per pan |
| Tracker Radar | 8 tracker cards per slide |
| Compliance Matrix | 8 article cards per slide |
| Request Pulse | 12 domain rows per slide |
