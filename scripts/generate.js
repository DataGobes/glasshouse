#!/usr/bin/env node
/**
 * Glasshouse — HTML + Markdown Generator
 *
 * Takes analysis JSON (from Claude) and produces:
 *   1. HTML presentation using the presentation theme
 *   2. Markdown report
 *
 * Usage: node generate.js <analysis.json> [--output-dir <dir>] [--scan-json <scan.json>]
 *
 * This replaces Claude acting as a template engine, saving ~65K tokens per run.
 */

const fs = require("fs");
const path = require("path");

// ───────────────────────────────────────────
// Pagination constants
// ───────────────────────────────────────────
const MAX = {
  TIMELINE_EVENTS: 12,
  TRACKER_CARDS: 18,
  COOKIE_ROWS: 20,
  DOMAIN_NODES: 6,
  COMPLIANCE_CARDS: 9,
  REQUEST_ROWS: 12,
  RECOMMENDATIONS: 6,
  LEGAL_BOOKS: 6,
  FINDINGS_ITEMS: 8,
};

// ───────────────────────────────────────────
// Opt-out / consent cookie detector — pure helper, usable without CLI setup
// ───────────────────────────────────────────
function isOptOutCookie(name) {
  return /(opt-?out|consent|optanon|cookieconsent|euconsent|gdpr)/i.test(String(name || ''));
}

// ───────────────────────────────────────────
// eTLD+1 and party-classification — pure helpers, usable without CLI setup
// ───────────────────────────────────────────
const COMPOUND_TLDS = new Set([
  "co.uk", "co.jp", "co.nz", "co.kr", "co.in", "co.za", "co.il",
  "com.au", "com.br", "com.mx", "com.cn", "com.tw", "com.sg", "com.hk", "com.tr",
  "net.au", "net.nz", "org.uk", "ac.uk", "gov.uk", "org.au",
]);
function eTLDplus1(domain) {
  const clean = (domain || "").replace(/^\./, "").toLowerCase().trim();
  if (!clean) return "";
  const parts = clean.split(".");
  if (parts.length <= 2) return clean;
  const last2 = parts.slice(-2).join(".");
  if (COMPOUND_TLDS.has(last2)) return parts.slice(-3).join(".");
  return last2;
}

/**
 * Classify a host relative to a site's meta:
 *   'first-party'  — eTLD+1 matches meta.domain's eTLD+1
 *   'affiliated'   — eTLD+1 is listed in meta.aliasDomains (same owner, different eTLD)
 *   'third-party'  — everything else
 *
 * @param {string} host   — the hostname to classify (e.g. "media.miele.com")
 * @param {{ domain: string, aliasDomains?: string[] }} meta
 * @returns {'first-party'|'affiliated'|'third-party'}
 */
function classifyParty(host, meta) {
  const hostEtld = eTLDplus1(host);
  if (!hostEtld) return 'third-party';
  const siteEtld = eTLDplus1(meta.domain);
  if (hostEtld === siteEtld) return 'first-party';
  const aliasEtlds = Array.isArray(meta.aliasDomains)
    ? meta.aliasDomains.map(eTLDplus1).filter(Boolean)
    : [];
  if (aliasEtlds.includes(hostEtld)) return 'affiliated';
  return 'third-party';
}

// ───────────────────────────────────────────
// CLI
// ───────────────────────────────────────────
if (require.main !== module) {
  // When required as a module (e.g. by tests), skip CLI setup.
  // Exports are defined at the bottom of this file.
} else {

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: node generate.js <analysis.json> [--output-dir <dir>]");
  process.exit(1);
}

const jsonPath = args[0];
const includePrivateAppendix = args.includes("--include-private-appendix");
const outputDirIdx = args.indexOf("--output-dir");
const outputDir = outputDirIdx !== -1 ? args[outputDirIdx + 1] : process.cwd();
const suffixIdx = args.indexOf("--suffix");
const suffix = suffixIdx !== -1 ? args[suffixIdx + 1] : "";

const analysis = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
const { meta, scores, findings, slides, customSlides, markdownReport } = analysis;

const scanJsonIdx = args.indexOf("--scan-json");
const scanJsonPath = scanJsonIdx !== -1 ? args[scanJsonIdx + 1] : null;
const downloadJson = scanJsonPath
  ? JSON.parse(fs.readFileSync(scanJsonPath, "utf-8"))
  : analysis;

// ───────────────────────────────────────────
// Score-range helpers
// ───────────────────────────────────────────
function scoreRangeClass(score) {
  if (score >= 8.5) return "excellent";
  if (score >= 7.0) return "good";
  if (score >= 5.5) return "acceptable";
  if (score >= 4.0) return "poor";
  return "bad";
}

function scorePulseRGB(score) {
  if (score >= 7.0) return "5,150,105";
  if (score >= 5.5) return "217,119,6";
  if (score >= 4.0) return "234,88,12";
  return "220,38,38";
}

function sentimentColor(sentiment) {
  const map = { positive: "var(--accent-green)", negative: "var(--accent-red)", surprising: "var(--accent-yellow)" };
  return map[sentiment] || "var(--accent)";
}

// ───────────────────────────────────────────
// Pagination helper
// ───────────────────────────────────────────
function paginate(items, max) {
  if (!items || items.length <= max) return [items || []];
  const numPages = Math.ceil(items.length / max);
  const perPage = Math.ceil(items.length / numPages);
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages;
}

// ───────────────────────────────────────────
// HTML escaping
// ───────────────────────────────────────────
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ───────────────────────────────────────────
// Normalisation layer — bridge schema↔Claude output drift
// ───────────────────────────────────────────
const normalise = {
  cookiePurpose(raw) {
    const s = (raw || "").toLowerCase();
    if (s.includes("essential") || s.includes("necessary")) return "essential";
    if (s.includes("functional")) return "functional";
    if (s.includes("analytics") || s.includes("statist")) return "analytics";
    if (s.includes("tracking") || s.includes("advertising") || s.includes("marketing") || s.includes("ad")) return "marketing";
    return "unknown";
  },
  severityToStatus(sev) {
    if (!sev) return "partial";
    const s = sev.toLowerCase();
    if (s === "critical" || s === "high") return "fail";
    if (s === "medium") return "partial";
    return "pass";
  },
  tiltClass(raw) {
    const map = {
      "balanced": "fs-bar-balanced",
      "heavy-accept": "fs-bar-heavy-accept",
      "heavy-right": "fs-bar-heavy-accept",
      "heavy-left": "fs-bar-heavy-reject",
      "tilted-accept": "fs-bar-tilted-accept",
      "tilted-reject": "fs-bar-tilted-reject",
      "fs-bar-balanced": "fs-bar-balanced",
      "fs-bar-tilted-accept": "fs-bar-tilted-accept",
      "fs-bar-tilted-reject": "fs-bar-tilted-reject",
      "fs-bar-heavy-accept": "fs-bar-heavy-accept",
      "fs-bar-heavy-reject": "fs-bar-heavy-reject",
      "fs-bar-heavy-tilt": "fs-bar-heavy-tilt",
    };
    return map[(raw || "").toLowerCase()] || "fs-bar-balanced";
  },
  severityToTimelineType(sev) {
    const s = (sev || "").toLowerCase();
    if (s === "critical") return "tracking";
    if (s === "warn" || s === "warning") return "adtech";
    return "essential";
  },
  domains(d) {
    return Array.isArray(d) ? d.join(", ") : (d || "");
  },
};

// ───────────────────────────────────────────
// Watermark helper
// ───────────────────────────────────────────
// Watermark is the maintainer's personal signature on generated decks
// (theme="datagobes"). For neutral themes used by OSS adopters (default
// "corporate", or "dark"), this returns empty so the deck carries no
// external branding. Users who want to credit glasshouse can do so in
// their own slide content.
function watermark() {
  if (meta && meta.theme === "datagobes") {
    return `<div class="datagobes-watermark"><a href="https://datagobes.dev"><span style="color:var(--brand-ember,#c75c2c);-webkit-text-fill-color:var(--brand-ember,#c75c2c)">&gt;_</span> datagobes.dev</a></div>`;
  }
  return "";
}

// ───────────────────────────────────────────
// Slide descriptions — short context for non-experts
// ───────────────────────────────────────────
const SLIDE_DESCRIPTIONS = {
  beforeAfter: "How many cookies exist before you interact with the banner vs after clicking Accept.",
  auditTrailPre: "Network requests fired before any user interaction — these happen without consent.",
  auditTrailPost: "New requests triggered immediately after clicking Accept All.",
  auditTrailReject: "Requests that still fire after explicitly clicking Reject — these shouldn't exist.",
  darkPatterns: "Whether the consent interface makes it equally easy to accept or reject tracking.",
  variantComparison: "Side-by-side comparison of what gets loaded depending on your consent choice.",
  requestPulse: "Volume of third-party network requests per domain, split by consent phase.",
  thirdPartyDomains: "Where your data travels — each destination's jurisdiction and legal safeguards.",
  cookiePurposeMatching: "Whether cookies are used for the purpose the site claims in its consent banner.",
  fingerprinting: "Browser fingerprinting techniques detected — these work even without cookies.",
  consentRevocation: "How easy it is to withdraw consent after initially accepting.",
  storageAnalysis: "All browser storage mechanisms used — cookies, localStorage, IndexedDB, and more.",
  formLeakage: "Whether form data leaks to third parties before you submit it.",
  piggybackingChains: "Third-party scripts that load additional scripts — creating invisible tracking chains.",
  dataSubjectRights: "How accessible GDPR rights are — data access, deletion, portability, and objection.",
  privacyPolicy: "How well the privacy policy covers the 13 GDPR-required information items.",
  tcfConsentMode: "IAB Transparency & Consent Framework signals and Google Consent Mode configuration.",
};

function slideDesc(type) {
  const desc = SLIDE_DESCRIPTIONS[type];
  if (!desc) return "";
  return `<p class="slide-desc reveal">${esc(desc)}</p>`;
}

// ───────────────────────────────────────────
// Slide builders — each returns HTML string or string[]
// ───────────────────────────────────────────

function scoreVerdict(score) {
  if (score >= 8.5) return "EXCELLENT";
  if (score >= 7.0) return "GOOD";
  if (score >= 5.5) return "ADEQUATE";
  if (score >= 4.0) return "POOR";
  return "CRITICAL";
}

function gaugeColor(score) {
  if (score >= 8.5) return "#059669";
  if (score >= 7.0) return "#16a34a";
  if (score >= 5.5) return "#d97706";
  if (score >= 4.0) return "#ea580c";
  return "#dc2626";
}

function buildTitle(slideNum, totalSlides) {
  const score = meta.overallScore;
  const circumference = 534.07; // 2 * π * 85
  const gaugeOffset = circumference - (score / 10) * circumference;
  const color = gaugeColor(score);
  const verdict = scoreVerdict(score);
  const trackerCount = (findings.trackers || []).length;
  const cookieCount = (findings.cookies || []).length;

  return `<section class="slide glow-red" data-title="Title">
  <div class="slide-content" style="align-items:center;">
    <div class="brand-header reveal">
      ${meta.theme === "datagobes" ? `<span class="brand-name" style="color:var(--text-muted)"><span style="color:var(--brand-ember,#c75c2c);-webkit-text-fill-color:var(--brand-ember,#c75c2c)">&gt;_</span> datagobes.dev</span>
      <div class="brand-separator"></div>` : ""}
      <span class="brand-label">Privacy Audit #${String(meta.episode).padStart(2, "0")}</span>
    </div>
    <div class="domain-with-favicon reveal" style="justify-content:center;">
      ${meta.faviconBase64 ? `<img class="site-favicon" src="data:image/png;base64,${meta.faviconBase64}" alt="${esc(meta.domain)} favicon">` : ""}
      <h1><span class="gradient-text">${esc(meta.domain)}</span></h1>
    </div>
    <div class="audit-gauge reveal">
      <svg class="gauge-ring" viewBox="0 0 200 200" width="200" height="200">
        <circle class="gauge-track" cx="100" cy="100" r="85" fill="none" stroke="rgba(28,25,23,0.06)" stroke-width="10" />
        <circle class="gauge-fill" cx="100" cy="100" r="85" fill="none" stroke="${color}" stroke-width="10"
          stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"
          style="--gauge-offset:${gaugeOffset}" transform="rotate(-90 100 100)" />
      </svg>
      <div class="gauge-center">
        <div class="gauge-score" style="color:${color}">${score}</div>
        <div class="gauge-verdict" style="color:${color}">${verdict}</div>
      </div>
    </div>
    <p class="reveal title-meta">${esc(meta.subtitle)} &middot; ${trackerCount} tracker${trackerCount !== 1 ? "s" : ""} &middot; ${cookieCount} cookie${cookieCount !== 1 ? "s" : ""}</p>
    <p class="reveal" style="font-size:0.55rem;color:var(--text-muted);opacity:0.6;max-width:600px;text-align:center;margin-top:1.5rem;line-height:1.5">This report presents technical observations from an automated external scan. It does not constitute legal advice or a formal compliance assessment. Findings should be interpreted in consultation with qualified legal counsel.</p>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildTldr(slideNum, totalSlides) {
  const sentimentRange = { positive: "excellent", negative: "bad", surprising: "acceptable" };
  const sentimentBorder = { positive: "#059669", negative: "#dc2626", surprising: "#d97706" };

  const items = (findings.tldr || []).map((t) => {
    const rangeClass = sentimentRange[t.sentiment] || "acceptable";
    const border = sentimentBorder[t.sentiment] || sentimentBorder.surprising;
    return `<div class="rs-note reveal" style="border-left-color:${border};">
      <div class="rs-note-header">
        <span class="rs-note-dot rs-dot-${rangeClass}"></span>
        <span class="rs-note-cat">${esc(t.headline)}</span>
        <span class="rs-note-score" style="font-size:1.1rem;opacity:1;">${t.emoji}</span>
      </div>
      <p class="rs-note-text">${esc(t.detail)}</p>
    </div>`;
  }).join("\n");

  return `<section class="slide" data-title="TL;DR">
  <div class="slide-content">
    <span class="badge reveal">TL;DR</span>
    <h2 class="reveal">Three Things to Know</h2>
    <div class="rs-layout rs-unified" style="max-width:560px;">
      <div class="rs-notes-grid" style="grid-template-columns:1fr;">
        ${items}
      </div>
    </div>
    <p class="reveal" style="font-size:var(--small-size);color:var(--text-muted);margin-top:var(--content-gap);">Scroll for the full story &rarr;</p>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildBeforeAfter(slideNum, totalSlides) {
  const ba = findings.beforeAfter || {};
  const preCookieCount = ba.preCookieCount ?? ba.preCookies ?? 0;
  const postCookieCount = ba.postCookieCount ?? ba.postCookies ?? 0;
  const preBreakdown = ba.preBreakdown || ba.prePills || [];
  const postBreakdown = ba.postBreakdown || ba.postPills || [];
  const hasEnhancedData = ba.preCategoryBreakdown || ba.postCategoryBreakdown;

  const pills = (arr) => (arr || []).map((p) =>
    `<span class="pill pill-${p.color || p.type}">${esc(p.label)}</span>`
  ).join(" ");

  // Category breakdown bars — proportional mini-bars color-coded by category
  const categoryBars = (items, maxCount) => {
    if (!items || !items.length) return "";
    const max = maxCount || Math.max(...items.map(i => i.count));
    return items.map(i => {
      const pct = max > 0 ? Math.round((i.count / max) * 100) : 0;
      return `<div class="ba-cat-row">
        <span class="ba-cat-label">${esc(i.category)}</span>
        <span class="ba-cat-count">${i.count}</span>
        <div class="ba-cat-bar"><div class="ba-cat-bar-fill" style="width:${pct}%;background:${esc(i.color)};"></div></div>
      </div>`;
    }).join("");
  };

  // Storage mechanism badges
  const storageBadges = (mechanisms) => {
    if (!mechanisms || !mechanisms.length) return "";
    const icons = { cookies: "◉", localStorage: "◉", sessionStorage: "◉", indexedDB: "◉" };
    return `<div class="ba-storage">${mechanisms.map(m =>
      `<span class="ba-storage-badge">${icons[m] || "◉"} ${esc(m)}</span>`
    ).join("")}</div>`;
  };

  // Stat line: trackers · domains
  const statLine = (trackers, domains) => {
    if (trackers == null && domains == null) return "";
    const parts = [];
    if (trackers != null) parts.push(`${trackers} tracker${trackers !== 1 ? "s" : ""}`);
    if (domains != null) parts.push(`${domains} domain${domains !== 1 ? "s" : ""}`);
    return `<div class="ba-stat-line">${parts.join(" · ")}</div>`;
  };

  // Find max across both breakdowns for consistent bar scaling
  const allCounts = [...(ba.preCategoryBreakdown || []), ...(ba.postCategoryBreakdown || [])].map(i => i.count);
  const maxCatCount = allCounts.length ? Math.max(...allCounts) : 0;

  // Delta indicator
  const delta = ba.newCookiesDelta ?? (postCookieCount - preCookieCount);
  const deltaTrackers = (ba.postTrackerCount != null && ba.preTrackerCount != null)
    ? ba.postTrackerCount - ba.preTrackerCount : null;
  const deltaMultiplier = preCookieCount > 0 ? (postCookieCount / preCookieCount).toFixed(1) : null;

  const deltaHtml = hasEnhancedData ? `<div class="ba-delta reveal">
    <div class="ba-delta-arrow">→</div>
    <div class="ba-delta-stats">
      ${delta > 0 ? `<span class="ba-delta-item ba-delta-up">+${delta} cookies</span>` : `<span class="ba-delta-item">${delta} cookies</span>`}
      ${deltaTrackers != null && deltaTrackers > 0 ? `<span class="ba-delta-item ba-delta-up">+${deltaTrackers} trackers</span>` : ""}
      ${deltaMultiplier && parseFloat(deltaMultiplier) > 1 ? `<span class="ba-delta-item ba-delta-up">${deltaMultiplier}× increase</span>` : ""}
    </div>
  </div>` : "";

  const buildPanel = (label, color, cookieCount, breakdown, catBreakdown, trackerCount, domainCount, storageMechs) => {
    return `<div class="ba-panel" style="background:rgba(28,25,23,0.025);border-radius:6px;border-left:3px solid var(${color});padding:clamp(0.75rem,1.5vw,1.25rem);">
      <h3>${esc(label)}</h3>
      <div class="ba-big-num" style="color:var(${color});">${cookieCount} <span class="ba-big-unit">cookies</span></div>
      ${hasEnhancedData && catBreakdown && catBreakdown.length
        ? categoryBars(catBreakdown, maxCatCount)
        : `<div style="margin-top:var(--element-gap);">${pills(breakdown)}</div>`}
      ${statLine(trackerCount, domainCount)}
      ${storageBadges(storageMechs)}
    </div>`;
  };

  return `<section class="slide" data-title="Before vs After">
  <div class="slide-content">
    <span class="badge reveal">Consent Delta</span>
    <h2 class="reveal">Before vs After Consent</h2>
    ${slideDesc("beforeAfter")}
    <div class="ba-grid reveal">
      ${buildPanel("Before Consent", "--accent-red", preCookieCount, preBreakdown,
        ba.preCategoryBreakdown, ba.preTrackerCount, ba.preThirdPartyCount, ba.preStorageMechanisms)}
      ${deltaHtml}
      ${buildPanel("After Accept", "--accent-yellow", postCookieCount, postBreakdown,
        ba.postCategoryBreakdown, ba.postTrackerCount, ba.postThirdPartyCount, ba.postStorageMechanisms)}
    </div>
    ${(() => {
      const idb = findings.indexedDB || {};
      const preIdb = idb.preConsent || [];
      if (!preIdb.length) return "";
      return `<div class="cm-summary reveal" style="margin-top:0.75rem;">
       <div class="cm-summary-item" style="color:var(--accent-red);">
         <strong>IndexedDB (pre-consent):</strong> ${preIdb.map((db) => esc(db.name || db)).join(", ")}
       </div>
     </div>`;
    })()}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildTimelineEvents(events) {
  return events.map((ev) => {
    const evType = ev.type || normalise.severityToTimelineType(ev.severity);
    const title = ev.title || ev.event || "";
    const typeClass = evType ? `tl-${evType === "consent" ? "consent-ev" : evType}` : "";
    const tag = ev.tag ? `<span class="tl-tag tl-tag-${ev.tag.type}">${esc(ev.tag.text)}</span>` : "";
    const domain = ev.domain ? `<span class="tl-domain">${esc(ev.domain)}</span>` : "";
    const desc = ev.description ? `<div class="tl-desc">${esc(ev.description)}</div>` : "";
    const chips = (ev.chips || []).map((c) =>
      `<span class="tl-group-chip chip-${c.type}">${esc(c.label)}</span>`
    ).join("");
    const chipsHtml = chips ? `<div class="tl-group">${chips}</div>` : "";
    return `<div class="tl-event ${typeClass} reveal">
      <span class="tl-time">${esc(ev.time)}</span>
      <div class="tl-body">
        <div class="tl-title">${esc(title)} ${domain} ${tag}</div>
        ${desc}${chipsHtml}
      </div>
    </div>`;
  }).join("\n");
}

function buildAuditTrailPre(slideNum, totalSlides) {
  const events = (findings.auditTrail || {}).preConsent || [];
  const pages = paginate(events, MAX.TIMELINE_EVENTS);
  return pages.map((page, i) => {
    const pageTitle = pages.length > 1 ? `Audit Trail: Pre-Consent (${i + 1}/${pages.length})` : "Audit Trail: Pre-Consent";
    return `<section class="slide" data-title="${esc(pageTitle)}">
  <div class="slide-content">
    <span class="badge reveal">Audit Trail</span>
    <h2 class="reveal">What Happens Before You Click <span style="color:var(--accent-red)">Anything</span></h2>
    ${slideDesc("auditTrailPre")}
    <div class="timeline reveal">
      <div class="tl-phase tl-phase-pre reveal">
        <span class="tl-phase-label">Phase 1 — Page Load (no interaction)</span>
      </div>
      ${buildTimelineEvents(page)}
    </div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum + i} / ${totalSlides}</div>
</section>`;
  });
}

function buildAuditTrailPost(slideNum, totalSlides) {
  const events = (findings.auditTrail || {}).postConsent || [];
  const pages = paginate(events, MAX.TIMELINE_EVENTS);
  return pages.map((page, i) => {
    const pageTitle = pages.length > 1 ? `Audit Trail: Post-Consent (${i + 1}/${pages.length})` : "Audit Trail: Post-Consent";
    return `<section class="slide" data-title="${esc(pageTitle)}">
  <div class="slide-content">
    <span class="badge reveal">Audit Trail</span>
    <h2 class="reveal">What Happens After <span class="gradient-text">Accept</span></h2>
    ${slideDesc("auditTrailPost")}
    <div class="timeline reveal">
      <div class="tl-consent-break reveal">
        <span class="tl-consent-click">User Clicks Accept</span>
      </div>
      <div class="tl-phase tl-phase-post reveal">
        <span class="tl-phase-label">Phase 2 — Post-Consent</span>
      </div>
      ${buildTimelineEvents(page)}
    </div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum + i} / ${totalSlides}</div>
</section>`;
  });
}

function buildConsent(slideNum, totalSlides) {
  const c = findings.consent || {};
  // Normalize field names — accept both old (acceptText) and new (acceptButton) conventions
  const acceptText = c.acceptText || c.acceptButton || "Accept";
  const rejectText = c.rejectText || c.rejectButton || "";
  const bannerText = c.bannerText || "";
  // Infer detected=true if consent signals exist but detected was omitted
  const detected = c.detected || !!(bannerText || acceptText || rejectText ||
    (c.annotations && c.annotations.length > 0));
  const platform = c.platform || (detected ? "Custom CMP" : "None Detected");
  const asymmetric = c.isAsymmetric;

  const acceptClass = asymmetric ? "bp-btn-accept bp-btn-large" : "bp-btn-accept bp-btn-equal";
  const rejectClass = asymmetric ? "bp-btn-reject bp-btn-small" : "bp-btn-reject bp-btn-equal";

  let bannerInner;
  if (!detected) {
    bannerInner = `<div style="text-align:center;color:var(--accent-red);font-family:var(--font-mono);font-weight:700;padding:2rem;">No Consent Banner Detected</div>`;
  } else {
    bannerInner = `<div class="bp-banner-text">"${esc(bannerText)}"</div>
      <div class="bp-buttons">
        ${rejectText ? `<div class="bp-btn ${rejectClass}">${esc(rejectText)}</div>` : ""}
        <div class="bp-btn ${acceptClass}">${esc(acceptText)}</div>
      </div>`;
  }

  const annotations = (c.annotations || []).map((a) => {
    const icon = a.status === "pass" ? "&#10003;" : a.status === "fail" ? "&#10007;" : "&#9888;";
    const title = a.title || a.label || "";
    return `<div class="bp-annotation bp-${a.status}">
      <span class="bp-annotation-icon">${icon}</span>
      <div class="bp-annotation-text">
        <strong>${esc(title)}</strong>
        ${esc(a.detail)}
      </div>
    </div>`;
  }).join("\n");

  const measure = detected ? `<div class="bp-measure">
    <span class="bp-measure-label">Accept</span>
    <span class="bp-measure-line"></span>
    <span class="bp-measure-label">${esc(c.acceptWidth || "standard")}</span>
    <span class="bp-measure-line"></span>
    <span class="bp-measure-label">Reject</span>
    <span class="bp-measure-line"></span>
    <span class="bp-measure-label">${esc(c.rejectWidth || "standard")}</span>
  </div>` : "";

  return `<section class="slide" data-title="Consent Mechanism">
  <div class="slide-content">
    <span class="badge reveal">Consent Mechanism</span>
    <h2 class="reveal">Banner Blueprint</h2>
    <div class="bp-platform reveal">
      <span class="bp-platform-dot"></span>
      ${esc(platform)}
    </div>
    <div class="blueprint reveal">
      <div class="bp-banner">${bannerInner}</div>
      ${measure}
    </div>
    <div class="bp-annotations reveal">${annotations}</div>
    ${(() => {
      const cg = findings.consentGranularity;
      if (!cg) return "";
      const toggleIcon = cg.hasToggles ? "&#10003;" : "&#10007;";
      const toggleColor = cg.hasToggles ? "var(--accent-green)" : "var(--accent-red)";
      const cats = (cg.categories || []).map((c) => `<span class="cg-cat">${esc(c)}</span>`).join(" ");
      return `<div class="cg-summary reveal">
        <div class="cg-toggle-status" style="color:${toggleColor};">
          <span>${toggleIcon}</span>
          <strong>${cg.hasToggles ? `${cg.toggleCount || 0} category toggles` : "No granular toggles"}</strong>
        </div>
        ${cats ? `<div class="cg-categories">${cats}</div>` : ""}
      </div>`;
    })()}
    ${(() => {
      const gpc = findings.gpc;
      if (!gpc) return "";
      const signalIcon = gpc.signalSent ? "&#10003;" : "&#10007;";
      const readsIcon = gpc.siteReadsSignal ? "&#10003;" : "&#10007;";
      const signalColor = gpc.signalSent ? "var(--accent-green)" : "var(--text-muted)";
      const readsColor = gpc.siteReadsSignal ? "var(--accent-green)" : "var(--accent-red)";
      return `<div class="gpc-callout reveal">
        <div class="gpc-header">Global Privacy Control (GPC)</div>
        <div class="gpc-signals">
          <span style="color:${signalColor};">${signalIcon} Signal sent</span>
          <span style="color:${readsColor};">${readsIcon} Site reads signal</span>
        </div>
      </div>`;
    })()}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildDarkPatterns(slideNum, totalSlides) {
  const dp = findings.darkPatterns || {};
  // Normalise factors: support flat factors[] with side field, or split acceptFactors/rejectFactors
  let acceptFactors = dp.acceptFactors;
  let rejectFactors = dp.rejectFactors;
  if (!acceptFactors && !rejectFactors && Array.isArray(dp.factors)) {
    acceptFactors = dp.factors.filter((f) => (f.side || "").toLowerCase() === "accept");
    rejectFactors = dp.factors.filter((f) => (f.side || "").toLowerCase() === "reject");
  }

  const tiltClass = normalise.tiltClass(dp.tiltClass);
  // Map beam tilt classes to spectrum marker positions
  const markerMap = {
    "fs-bar-balanced": "fs-marker-balanced",
    "fs-bar-tilted-accept": "fs-marker-tilted-accept",
    "fs-bar-tilted-reject": "fs-marker-tilted-reject",
    "fs-bar-heavy-accept": "fs-marker-heavy-accept",
    "fs-bar-heavy-reject": "fs-marker-heavy-reject",
    "fs-bar-heavy-tilt": "fs-marker-heavy-accept",
  };
  const markerClass = markerMap[tiltClass] || "fs-marker-balanced";

  const buildFactorPanel = (arr, label, panelClass) => {
    const rows = (arr || []).map((f) =>
      `<div class="fs-factor">
        <span class="fs-factor-name">${esc(f.name || f.label)}</span>
        <span class="fs-factor-value fs-factor-value-${f.status || "neutral"}">${esc(f.value || String(f.weight || ""))}</span>
      </div>`
    ).join("\n");
    return `<div class="fs-factor-panel ${panelClass}">
      <div class="fs-factor-panel-title">${label} Path</div>
      ${rows}
    </div>`;
  };

  const verdictText = dp.verdictText || dp.verdict || "No dark patterns detected";

  return `<section class="slide" data-title="Dark Patterns">
  <div class="slide-content">
    <span class="badge reveal">UX Fairness</span>
    <h2 class="reveal">Fairness Scale</h2>
    ${slideDesc("darkPatterns")}
    <div class="fairness-scale reveal">
      <div class="fs-spectrum-labels">
        <span>Reject-biased</span>
        <span>Balanced</span>
        <span>Accept-biased</span>
      </div>
      <div class="fs-spectrum">
        <div class="fs-marker ${markerClass}"></div>
      </div>
      <div class="fs-factor-grid">
        ${buildFactorPanel(acceptFactors, "Accept", "fs-factor-panel-accept")}
        ${buildFactorPanel(rejectFactors, "Reject", "fs-factor-panel-reject")}
      </div>
    </div>
    <div class="${dp.verdictClass || "fs-verdict-fair"} fs-verdict reveal">
      ${esc(verdictText)}
    </div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildTrackers(slideNum, totalSlides) {
  const trackers = findings.trackers || [];
  if (!trackers.length) return [];
  const sorted = [...trackers].sort((a, b) => {
    const order = { active: 0, gated: 1, csp: 2 };
    return (order[a.tier] || 3) - (order[b.tier] || 3);
  });
  const pages = paginate(sorted, MAX.TRACKER_CARDS);

  const activeCt = trackers.filter((t) => t.tier === "active").length;
  const gatedCt = trackers.filter((t) => t.tier === "gated").length;
  const cspCt = trackers.filter((t) => t.tier === "csp").length;
  const piggybackCt = trackers.filter((t) => t.is4thParty).length;

  return pages.map((page, i) => {
    const pageTitle = pages.length > 1 ? `Tracking Systems (${i + 1}/${pages.length})` : "Tracking Systems";
    const cards = page.map((t) => {
      const pulse = t.tier === "active" ? '<div class="tr-pulse"></div>' : "";
      const piggyback = t.is4thParty
        ? `<div style="font-size:0.55rem;color:var(--accent-red);font-weight:600;margin-top:0.15rem;">loaded by ${esc(t.loadedBy || "3rd party")}</div>`
        : "";
      return `<div class="tr-card tr-card-${t.tier} reveal" style="background:rgba(28,25,23,0.025);border-color:transparent;box-shadow:none;">
        ${pulse}
        <div class="tr-name">${esc(t.name)}</div>
        ${piggyback}
        <div class="tr-domain">${esc(normalise.domains(t.domains))}</div>
        <div class="tr-category">${esc(t.category)}</div>
        <div class="tr-status tr-status-${t.tier}">${esc(t.status)}</div>
      </div>`;
    }).join("\n");

    const summary = [
      activeCt > 0 ? `<div class="tr-summary-item"><span class="tr-summary-dot tr-summary-dot-active"></span> ${activeCt} active pre-consent</div>` : "",
      gatedCt > 0 ? `<div class="tr-summary-item"><span class="tr-summary-dot tr-summary-dot-gated"></span> ${gatedCt} gated post-consent</div>` : "",
      cspCt > 0 ? `<div class="tr-summary-item"><span class="tr-summary-dot tr-summary-dot-csp"></span> ${cspCt} CSP-only</div>` : "",
      piggybackCt > 0 ? `<div class="tr-summary-item"><span class="tr-summary-dot" style="background:var(--accent);"></span> ${piggybackCt} piggybacked</div>` : "",
    ].filter(Boolean).join("\n");

    return `<section class="slide" data-title="${esc(pageTitle)}">
  <div class="slide-content">
    <span class="badge reveal">Tracking Systems</span>
    <h2 class="reveal">Who's Watching?</h2>
    <div class="tracker-radar">${cards}</div>
    ${i === 0 ? `<div class="tr-summary reveal">${summary}</div>` : ""}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum + i} / ${totalSlides}</div>
</section>`;
  });
}

function buildCookies(slideNum, totalSlides) {
  const rawCookies = findings.cookies || [];
  if (!rawCookies.length) return [];

  // Sort by purpose severity (marketing first) then duration descending
  const PURPOSE_ORDER = { marketing: 0, tracking: 0, analytics: 1, functional: 2, essential: 3, unknown: 4 };
  const cookies = [...rawCookies].sort((a, b) => {
    const pa = PURPOSE_ORDER[normalise.cookiePurpose(a.purpose)] ?? 4;
    const pb = PURPOSE_ORDER[normalise.cookiePurpose(b.purpose)] ?? 4;
    if (pa !== pb) return pa - pb;
    return (b.durationDays || 0) - (a.durationDays || 0);
  });

  const maxDays = Math.min(Math.max(...cookies.map((c) => c.durationDays || 0), 1), 730);
  const pages = paginate(cookies, MAX.COOKIE_ROWS);
  const GROUP_LABELS = { marketing: "Marketing & Tracking", tracking: "Marketing & Tracking", analytics: "Analytics", functional: "Functional", essential: "Essential", unknown: "Unknown" };
  const colorMap = { essential: "var(--accent-green)", functional: "var(--accent-blue)", analytics: "var(--accent-yellow)", tracking: "var(--accent-red)", marketing: "var(--accent-red)", unknown: "var(--text-muted)" };

  return pages.map((page, i) => {
    const pageTitle = pages.length > 1 ? `Cookie Lifespan (${i + 1}/${pages.length})` : "Cookie Lifespan";

    // Inject group headers between purpose transitions
    let lastGroup = null;
    const rows = [];
    page.forEach((c) => {
      const purpose = normalise.cookiePurpose(c.purpose);
      // Normalise marketing/tracking into one group label
      const groupKey = (purpose === "tracking") ? "marketing" : purpose;

      if (groupKey !== lastGroup) {
        const groupCount = cookies.filter((x) => {
          const p = normalise.cookiePurpose(x.purpose);
          return (p === "tracking" ? "marketing" : p) === groupKey;
        }).length;
        const label = GROUP_LABELS[groupKey] || groupKey;
        rows.push(`<div class="persist-group-header">
          <span class="persist-group-label">${label}</span>
          <span class="persist-group-count">${groupCount} cookie${groupCount !== 1 ? "s" : ""}</span>
        </div>`);
        lastGroup = groupKey;
      }

      const widthPct = c.durationDays > 0 ? Math.max((c.durationDays / maxDays) * 100, 1) : 0;
      const optOut = isOptOutCookie(c.name);
      const barClass = optOut
        ? `persist-bar-essential${c.durationDays === 0 ? " persist-bar-session" : ""}`
        : `persist-bar-${purpose}${c.durationDays === 0 ? " persist-bar-session" : ""}`;
      const domain = esc(c.domain || "");
      rows.push(`<div class="persist-row reveal">
        <div class="persist-name-col">
          <span class="persist-name">${esc(c.name)}</span>
          ${domain ? `<span class="persist-domain">${domain}</span>` : ""}
          ${optOut ? `<span class="persist-note" style="color:var(--accent-green);font-size:0.7em;margin-left:0.3em;">opt-out</span>` : ""}
        </div>
        <div class="persist-bar-track">
          <div class="persist-bar ${barClass}" style="width:${widthPct.toFixed(1)}%;"></div>
        </div>
        <span class="persist-duration">${esc(c.duration)}</span>
      </div>`);
    });

    const purposes = [...new Set(page.map((c) => normalise.cookiePurpose(c.purpose)))];
    const legend = purposes.map((p) =>
      `<div class="persist-legend-item"><span class="persist-legend-swatch" style="background:${colorMap[p] || "var(--text-muted)"}"></span> ${p.charAt(0).toUpperCase() + p.slice(1)}</div>`
    ).join("\n");

    return `<section class="slide" data-title="${esc(pageTitle)}">
  <div class="slide-content">
    <span class="badge reveal">Cookie Lifespan</span>
    <h2 class="reveal">Persistence Bars</h2>
    <div class="persist-chart reveal">
      <div class="persist-scale">
        <div class="persist-scale-line"></div>
        <span class="persist-scale-tick" style="left:clamp(6rem,12vw,9rem);">0</span>
        <span class="persist-scale-tick" style="left:25%;">30d</span>
        <span class="persist-scale-tick" style="left:50%;">6mo</span>
        <span class="persist-scale-tick" style="left:75%;">1yr</span>
        <span class="persist-scale-tick" style="right:0;">2yr</span>
      </div>
      ${rows.join("\n")}
    </div>
    <div class="persist-legend reveal">${legend}</div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum + i} / ${totalSlides}</div>
</section>`;
  });
}

let _cookiePartyWarned = false;

// eTLDplus1 / COMPOUND_TLDS are defined at module scope above — visible here via outer-scope lookup.
// classifyParty is also defined there as a module-level pure helper.

function buildCookieParty(slideNum, totalSlides) {
  const cookies = findings.cookies || [];
  if (!cookies.length) return null;
  const siteEtld = eTLDplus1(meta.domain);
  if (!siteEtld) return null;

  // Classify cookies via classifyParty: first-party, affiliated (same-owner different eTLD),
  // or third-party. aliasDomains lists eTLD+1 values (or hostnames) the site owner also controls
  // (e.g. dyson.com → dyson.nl redirect chain, or multi-TLD brands like miele.*).
  const aliasEtlds = Array.isArray(meta.aliasDomains)
    ? meta.aliasDomains.map(eTLDplus1).filter(Boolean)
    : [];

  const firstParty = [];
  const affiliated = [];
  const thirdParty = [];
  for (const c of cookies) {
    const party = classifyParty(c.domain, meta);
    if (party === 'first-party') firstParty.push(c);
    else if (party === 'affiliated') affiliated.push(c);
    else thirdParty.push(c);
  }

  const total = firstParty.length + affiliated.length + thirdParty.length;
  if (total === 0) return null;

  // Heuristic warning: if 0 cookies match meta.domain and aliasDomains is empty, the author
  // likely forgot to set meta.aliasDomains for a redirect-chain site. Suggest the top non-meta eTLD.
  if (firstParty.length === 0 && aliasEtlds.length === 0 && thirdParty.length > 0) {
    const freq = {};
    for (const c of thirdParty) {
      const e = eTLDplus1(c.domain);
      if (e) freq[e] = (freq[e] || 0) + 1;
    }
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3 && !_cookiePartyWarned) {
      _cookiePartyWarned = true;
      console.error(`[generate] cookieParty: 0 cookies match meta.domain "${siteEtld}". Top other eTLD is "${top[0]}" (${top[1]} cookies). If ${siteEtld} redirects to ${top[0]}, set meta.aliasDomains: ["${top[0]}"] to classify it as first-party.`);
    }
  }
  const firstPct = (firstParty.length / total) * 100;
  const affiliatedPct = (affiliated.length / total) * 100;
  const thirdPct = (thirdParty.length / total) * 100;

  const COL_CAP = 14;
  const PURPOSE_ORDER = { marketing: 0, tracking: 0, analytics: 1, functional: 2, essential: 3, unknown: 4 };
  const sortCookies = (arr) => [...arr].sort((a, b) => {
    const pa = PURPOSE_ORDER[normalise.cookiePurpose(a.purpose)] ?? 4;
    const pb = PURPOSE_ORDER[normalise.cookiePurpose(b.purpose)] ?? 4;
    if (pa !== pb) return pa - pb;
    return (b.durationDays || 0) - (a.durationDays || 0);
  });

  const renderRow = (c) => {
    const purpose = normalise.cookiePurpose(c.purpose);
    return `<div class="cp-row reveal">
      <span class="cp-dot cp-dot-${purpose}"></span>
      <div class="cp-row-text">
        <span class="cp-name">${esc(c.name)}</span>
        <span class="cp-domain">${esc(c.domain || "")}</span>
      </div>
    </div>`;
  };

  const renderColumn = (label, list, klass, countColor) => {
    const sorted = sortCookies(list);
    const visible = sorted.slice(0, COL_CAP);
    const more = sorted.length - visible.length;
    const rows = visible.map(renderRow).join("\n");
    const moreLine = more > 0 ? `<div class="cp-more">+${more} more</div>` : "";
    const empty = !sorted.length ? `<div class="cp-empty">None detected</div>` : "";
    return `<div class="cp-col ${klass} reveal">
      <div class="cp-col-header">
        <span class="cp-col-label">${label}</span>
        <span class="cp-col-count" style="color:${countColor};">${sorted.length}</span>
      </div>
      ${rows}
      ${moreLine}
      ${empty}
    </div>`;
  };

  // Purpose breakdown for third-party cookies (the editorial insight)
  const tpPurpose = thirdParty.reduce((acc, c) => {
    const p = normalise.cookiePurpose(c.purpose);
    const k = (p === "tracking") ? "marketing" : p;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const fpLabelList = siteEtld;
  const firstPartyLabel = `First-Party <span class="cp-col-sub">${esc(fpLabelList)}</span>`;
  const affiliatedLabel = `Affiliated <span class="cp-col-sub">${esc(aliasEtlds.join(", ") || "same owner")}</span>`;
  const thirdPartyLabel = `Third-Party <span class="cp-col-sub">other domains</span>`;
  const descExtra = aliasEtlds.length
    ? ` Affiliated domains (${aliasEtlds.map(esc).join(", ")}) are same-owner different eTLDs.`
    : "";

  return `<section class="slide" data-title="First-Party vs Third-Party">
  <div class="slide-content">
    <span class="badge reveal">Cookie Ownership</span>
    <h2 class="reveal">First-Party vs Third-Party</h2>
    <p class="slide-desc reveal">Cookies whose domain matches ${esc(fpLabelList)} count as first-party.${descExtra} Every other domain is third-party regardless of who actually controls the tracker.</p>
    <div class="cp-bar reveal" role="img" aria-label="First-party ${firstParty.length}, affiliated ${affiliated.length}, third-party ${thirdParty.length}">
      <div class="cp-bar-seg cp-bar-first" style="width:${firstPct.toFixed(1)}%;">
        ${firstPct >= 8 ? `<span class="cp-bar-count">${firstParty.length}</span>` : ""}
      </div>
      ${affiliated.length ? `<div class="cp-bar-seg cp-bar-affiliated" style="width:${affiliatedPct.toFixed(1)}%;">
        ${affiliatedPct >= 8 ? `<span class="cp-bar-count">${affiliated.length}</span>` : ""}
      </div>` : ""}
      <div class="cp-bar-seg cp-bar-third" style="width:${thirdPct.toFixed(1)}%;">
        ${thirdPct >= 8 ? `<span class="cp-bar-count">${thirdParty.length}</span>` : ""}
      </div>
    </div>
    <div class="cp-bar-legend reveal">
      <div class="cp-legend-item"><span class="cp-legend-swatch cp-swatch-first"></span>First-party <b>${firstParty.length}</b> (${firstPct.toFixed(0)}%)</div>
      ${affiliated.length ? `<div class="cp-legend-item"><span class="cp-legend-swatch cp-swatch-affiliated"></span>Affiliated <b>${affiliated.length}</b> (${affiliatedPct.toFixed(0)}%)</div>` : ""}
      <div class="cp-legend-item"><span class="cp-legend-swatch cp-swatch-third"></span>Third-party <b>${thirdParty.length}</b> (${thirdPct.toFixed(0)}%)</div>
    </div>
    <div class="cp-grid reveal">
      ${renderColumn(firstPartyLabel, firstParty, "cp-col-first", "var(--accent-green)")}
      ${affiliated.length ? renderColumn(affiliatedLabel, affiliated, "cp-col-affiliated", "var(--accent-yellow)") : ""}
      ${renderColumn(thirdPartyLabel, thirdParty, "cp-col-third", "var(--accent-red)")}
    </div>
    ${thirdParty.length ? `<div class="cp-footnote reveal">Third-party purpose mix: ${Object.entries(tpPurpose).map(([k,v]) => `<span class="cp-foot-pill cp-foot-${k}">${k} ${v}</span>`).join(" ")}</div>` : ""}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildThirdPartyDomains(slideNum, totalSlides) {
  const domains = findings.thirdPartyDomains || [];
  if (!domains.length) return `<section class="slide" data-title="Cross-Border Transfers">
  <div class="slide-content">
    <span class="badge reveal">Data Transfers</span>
    <h2 class="reveal">Transfer Circuit</h2>
    <div class="card reveal" style="text-align:center;padding:2rem;">
      <p>No third-party cross-border transfers detected.</p>
    </div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;

  // Defensive risk mapping: schema enum is safe | dpf | risk; anything else → neutral.
  const RISK = {
    risk: { cls: "risk", rank: 0, label: "High risk", safeguard: "No SCCs / non-adequate" },
    dpf: { cls: "dpf", rank: 1, label: "Conditional", safeguard: "DPF-certified" },
    safe: { cls: "safe", rank: 2, label: "Adequate", safeguard: "EU / adequate" },
  };
  const NEUTRAL = { cls: "neutral", rank: 3, label: "Unknown", safeguard: "Status unknown" };
  const riskOf = (d) => RISK[d.risk] || NEUTRAL;

  // Cap then sort worst-risk first so the eye lands on the red destinations.
  const visibleDomains = domains
    .slice(0, MAX.DOMAIN_NODES)
    .slice()
    .sort((a, b) => riskOf(a).rank - riskOf(b).rank);

  const cards = visibleDomains.map((d) => {
    const rk = riskOf(d);
    const flagMatch = (d.jurisdiction || "").match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\S+\s)/u);
    const flag = d.flag || (flagMatch ? flagMatch[1].trim() : "🌍");
    const juris = d.flag ? esc(d.jurisdiction) : esc((d.jurisdiction || "").replace(/^\S+\s+/, "").trim());
    const rawDomains = Array.isArray(d.domains) ? d.domains : (d.domains || "").split(",").map(s => s.trim()).filter(Boolean);
    const domainsStr = rawDomains.join(", ");
    return `<div class="tc-dest-card tc-dest-${rk.cls} reveal">
      <div class="tc-dest-header">
        <span class="tc-dest-flag">${flag}</span>
        <span class="tc-dest-jurisdiction">${juris}</span>
        <span class="tc-dest-pill">${rk.label}</span>
      </div>
      ${d.company ? `<div class="tc-dest-company">${esc(d.company)}</div>` : ""}
      <div class="tc-dest-domains">${esc(domainsStr)}</div>
      <div class="tc-dest-meta">
        <span class="tc-dest-safeguard">${rk.safeguard}</span>
        ${d.requestCount ? `<span class="tc-dest-count">${d.requestCount} req${d.requestCount !== 1 ? "s" : ""}</span>` : ""}
      </div>
    </div>`;
  }).join("\n");

  const arrow = `<div class="tc-flow-line reveal">
    <svg class="tc-flow-arrow" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <polyline points="19 12 12 19 5 12"></polyline>
    </svg>
    <span class="tc-flow-label">sends data to</span>
  </div>`;

  return `<section class="slide" data-title="Cross-Border Transfers">
  <div class="slide-content">
    <span class="badge reveal">Data Transfers</span>
    <h2 class="reveal">Transfer Circuit</h2>
    ${slideDesc("thirdPartyDomains")}
    <p class="tc-explainer reveal">A <strong>cross-border transfer</strong> happens whenever your data leaves the EU. Jurisdiction decides the safeguard: <span class="tc-key tc-key-safe">EU / adequate countries</span> are protected by default, a <span class="tc-key tc-key-dpf">DPF-certified US recipient</span> is conditionally allowed, and an <span class="tc-key tc-key-risk">unverified or non-adequate destination</span> (e.g. RU, CN) needs Standard Contractual Clauses — or it is a high-risk transfer.</p>
    <div class="transfer-circuit reveal">
      <div class="tc-origin reveal">
        <span class="tc-origin-icon">&#x1F310;</span>
        <span class="tc-origin-label">${esc(meta.domain)}</span>
      </div>
      ${arrow}
      <div class="tc-dest-grid">${cards}</div>
    </div>
    <div class="tc-legend reveal">
      <div class="tc-legend-item"><span class="tc-legend-swatch tc-legend-safe"></span> EU / Adequate</div>
      <div class="tc-legend-item"><span class="tc-legend-swatch tc-legend-dpf"></span> DPF-Certified US</div>
      <div class="tc-legend-item"><span class="tc-legend-swatch tc-legend-risk"></span> Unverified / High-risk</div>
    </div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildRequestPulse(slideNum, totalSlides) {
  const raw = findings.requestPulse || [];
  const items = raw.map((d) => ({
    ...d,
    preConsent: d.preConsent != null ? d.preConsent : d.preCount,
    postConsent: d.postConsent != null ? d.postConsent : d.postCount,
    total: d.total != null ? d.total : (d.preCount || 0) + (d.postCount || 0),
  }));
  if (items.length < 3) return [];
  const maxReq = Math.max(...items.map((d) => d.total), 1);
  const pages = paginate(items, MAX.REQUEST_ROWS);

  return pages.map((page, i) => {
    const pageTitle = pages.length > 1 ? `Third-Party Requests (${i + 1}/${pages.length})` : "Third-Party Requests";
    const rows = page.map((d) => {
      if (d.isEssential) {
        return `<div class="rp-row reveal">
          <span class="rp-domain">${esc(d.domain)}</span>
          <div class="rp-bar-track"><div class="rp-bar-essential" style="width:${(d.total / maxReq * 100).toFixed(1)}%"></div></div>
          <span class="rp-count">${d.total}</span>
        </div>`;
      }
      const prePct = d.preConsent ? (d.preConsent / maxReq * 100).toFixed(1) : 0;
      const postPct = d.postConsent ? (d.postConsent / maxReq * 100).toFixed(1) : 0;
      return `<div class="rp-row reveal">
        <span class="rp-domain">${esc(d.domain)}</span>
        <div class="rp-bar-track">
          ${d.preConsent ? `<div class="rp-bar-pre" style="width:${prePct}%"></div>` : ""}
          ${d.postConsent ? `<div class="rp-bar-post" style="width:${postPct}%"></div>` : ""}
        </div>
        <span class="rp-count">${d.total}</span>
      </div>`;
    }).join("\n");

    return `<section class="slide" data-title="${esc(pageTitle)}">
  <div class="slide-content">
    <span class="badge reveal">Network Activity</span>
    <h2 class="reveal">Request Pulse</h2>
    ${slideDesc("requestPulse")}
    <div class="request-pulse reveal">
      <div class="rp-scale">
        <div class="rp-scale-line"></div>
        <span class="rp-scale-tick" style="left:clamp(7rem,14vw,10rem)">0</span>
        <span class="rp-scale-tick" style="left:50%">${Math.round(maxReq / 2)}</span>
        <span class="rp-scale-tick" style="right:0">${maxReq}</span>
      </div>
      ${rows}
    </div>
    <div class="rp-legend reveal">
      <div class="rp-legend-item"><span class="rp-legend-swatch" style="background:var(--accent-green);opacity:0.5"></span> Essential / CDN</div>
      <div class="rp-legend-item"><span class="rp-legend-swatch" style="background:var(--accent-red);opacity:0.7"></span> Pre-consent</div>
      <div class="rp-legend-item"><span class="rp-legend-swatch" style="background:var(--accent-yellow);opacity:0.7"></span> Post-consent</div>
    </div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum + i} / ${totalSlides}</div>
</section>`;
  });
}

function buildSecurityHeaders(slideNum, totalSlides) {
  const headers = findings.securityHeaders || [];
  const present = headers.filter((h) => h.status === "present").length;
  const total = headers.length || 6;
  const scoreClass = present >= 5 ? "sr-score-good" : present >= 3 ? "sr-score-mid" : "sr-score-bad";

  const rings = headers.map((h, idx) =>
    `<div class="sr-ring sr-ring-${idx + 1} sr-ring-${h.status}"></div>`
  ).join("\n");

  const statusRange = { present: "excellent", missing: "bad", partial: "acceptable" };
  const statusBorder = { present: "#059669", missing: "#dc2626", partial: "#d97706" };
  const legend = headers.map((h) => {
    const rangeClass = statusRange[h.status] || "acceptable";
    const border = statusBorder[h.status] || statusBorder.partial;
    const statusText = h.status === "present" ? "Active" : h.status === "missing" ? "Missing" : "Partial";
    return `<div class="rs-note reveal" style="border-left-color:${border};padding:clamp(0.3rem,0.5vw,0.4rem) clamp(0.5rem,0.8vw,0.6rem);">
      <div class="rs-note-header">
        <span class="rs-note-dot rs-dot-${rangeClass}"></span>
        <span class="rs-note-cat">${esc(h.name)}</span>
        <span class="rs-note-score score-${rangeClass}">${statusText}</span>
      </div>
    </div>`;
  }).join("\n");

  const sri = findings.scriptIntegrity || {};
  const sriLine = (sri.totalExternal > 0)
    ? (() => {
        const useEligible = sri.eligibleExternal != null;
        const pct = useEligible ? (sri.eligibleCoveragePercent || 0) : (sri.coveragePercent || 0);
        const numerator = sri.withIntegrity || 0;
        const denominator = useEligible ? sri.eligibleExternal : sri.totalExternal;
        const label = useEligible
          ? `${pct}% of SRI-eligible external scripts (${numerator}/${denominator})`
          : `${pct}% (${numerator}/${denominator} external scripts)`;
        return `<div class="sri-advisory reveal">
         <span class="sri-advisory-label">SRI Coverage · advisory (not scored)</span>
         <span class="sri-advisory-value">${label}</span>
       </div>`;
      })()
    : "";

  const cors = findings.cors || {};
  const corsLine = cors.allowOrigin
    ? `<div class="cm-summary-item reveal">
         <strong>CORS:</strong> ${esc(cors.allowOrigin)}${cors.hasCredentialsWithWildcard ? ' <span style="color:var(--accent-red);">+ credentials (risk)</span>' : ""}
       </div>`
    : "";

  return `<section class="slide" data-title="Security Headers">
  <div class="slide-content">
    <span class="badge reveal">Security Posture</span>
    <h2 class="reveal">Shield Rings</h2>
    <div class="shield-rings reveal">
      <div class="sr-diagram">
        ${rings}
        <div class="sr-core">${present}/${total}</div>
      </div>
      <div class="rs-notes-grid">${legend}</div>
    </div>
    <div class="sr-score ${scoreClass} reveal">
      <strong>${present}</strong> / ${total} headers active
    </div>
    ${sriLine}${corsLine}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildLegalPages(slideNum, totalSlides) {
  const lp = findings.legalPages || [];
  const found = lp.filter((p) => p.status === "present").length;
  const missing = lp.filter((p) => p.status === "missing").length;

  const books = lp.map((p) =>
    `<div class="doc-book doc-book-${p.status === "present" ? "present" : "missing"} reveal">
      <span class="doc-book-title">${esc(p.title)}</span>
      <span class="doc-book-status">${p.status === "present" ? "Found" : "Missing"}</span>
    </div>`
  ).join("\n");

  return `<section class="slide" data-title="Legal Pages">
  <div class="slide-content">
    <span class="badge reveal">Legal Compliance</span>
    <h2 class="reveal">Document Shelf</h2>
    <div class="doc-shelf reveal">
      <div class="doc-books">${books}</div>
      <div class="doc-shelf-surface"></div>
    </div>
    <div class="doc-shelf-summary reveal">
      <div class="doc-shelf-stat"><span class="dot dot-present"></span> ${found} found</div>
      <div class="doc-shelf-stat"><span class="dot dot-missing"></span> ${missing} missing</div>
    </div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

// ─── DSAR / Rights Mechanism (Phase E) ───
function buildDsar(slideNum, totalSlides) {
  const d = findings.dsar;
  if (!d || (d.contactPresent === undefined && !d.dedicatedPagePresent && !d.responseCommitmentDays && !(d.disproportionateBurdenFlags || []).length)) return null;

  const yes = (v) => v ? `<span class="rs-note-dot rs-dot-excellent"></span>` : `<span class="rs-note-dot rs-dot-bad"></span>`;
  const yn  = (v) => v ? "yes" : "no";

  const rows = [
    { label: "Contact present", value: d.contactPresent ? `${d.contactType || "yes"}${d.contactEvidence ? ` (${d.contactEvidence})` : ""}` : "missing", ok: !!d.contactPresent && d.contactType !== "postal_only" && d.contactType !== "none" },
    { label: "Dedicated rights page", value: yn(d.dedicatedPagePresent), ok: !!d.dedicatedPagePresent },
    { label: "30-day response commitment", value: d.responseCommitmentDays === 30 ? "stated (Art. 12(3))" : "not stated", ok: d.responseCommitmentDays === 30 },
    { label: "Right of access (Art. 15)", value: yn(d.rightToAccessDisclosed), ok: !!d.rightToAccessDisclosed },
    { label: "Right to erasure (Art. 17)", value: yn(d.rightToErasureDisclosed), ok: !!d.rightToErasureDisclosed },
    { label: "Right to portability (Art. 20)", value: yn(d.portabilityDisclosed), ok: !!d.portabilityDisclosed },
    { label: "Right to object (Art. 21)", value: yn(d.art21Disclosed), ok: !!d.art21Disclosed },
    { label: "Right to lodge complaint with DPA", value: yn(d.complainToDpaDisclosed), ok: !!d.complainToDpaDisclosed },
  ];

  const noteCards = rows.map((r, idx) => {
    const range = r.ok ? "excellent" : "bad";
    const border = r.ok ? "#059669" : "#dc2626";
    const delay = (idx * 0.04).toFixed(2);
    return `<div class="rs-note reveal" style="border-left-color:${border};">
      <div class="rs-note-header">
        ${yes(r.ok)}
        <span class="rs-note-cat">${esc(r.label)}</span>
        <span class="rs-note-score score-${range}">${esc(r.value)}</span>
      </div>
      <div class="rs-note-bar">
        <div class="rs-note-bar-track"><div class="rs-note-bar-fill score-bar-${range}" style="--bar-width:${r.ok ? 100 : 5}%;transition-delay:${delay}s"></div></div>
      </div>
    </div>`;
  }).join("\n");

  const burden = (d.disproportionateBurdenFlags || []).length
    ? `<div class="rs-note reveal" style="border-left-color:#dc2626;margin-top:1rem;">
        <div class="rs-note-header">
          <span class="rs-note-dot rs-dot-bad"></span>
          <span class="rs-note-cat">Disproportionate burden flags</span>
          <span class="rs-note-score score-bad">${d.disproportionateBurdenFlags.length}</span>
        </div>
        <p class="rs-note-text">${d.disproportionateBurdenFlags.map(esc).join(" · ")}</p>
      </div>`
    : "";

  return `<section class="slide" data-title="DSAR / Rights Mechanism">
  <div class="slide-content">
    <span class="badge reveal">Data Subject Rights</span>
    <h2 class="reveal">DSAR Mechanism</h2>
    <p class="slide-intro reveal">GDPR Art. 12(3) requires response within 1 month. The mechanism must be discoverable and proportionate.</p>
    <div class="rs-notes reveal">${noteCards}</div>
    ${burden}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

// ─── Processor Transparency (Phase E) ───
function buildProcessorTransparency(slideNum, totalSlides) {
  const p = findings.processors;
  if (!p || (!(p.namedInPolicy || []).length && !(p.detectedOnSite || []).length)) return null;

  const named = p.namedInPolicy || [];
  const detected = p.detectedOnSite || [];
  const undisclosed = p.undisclosed || [];
  const namedSet = new Set(named.map(n => n.name));
  const detectedSet = new Set(detected);

  const rows = detected.map(name => {
    const isNamed = namedSet.has(name);
    const meta = named.find(n => n.name === name);
    return {
      name,
      jurisdiction: meta?.jurisdiction || "—",
      disclosed: isNamed,
    };
  });
  // Add policy-named processors not detected (informational)
  for (const n of named) {
    if (!detectedSet.has(n.name)) {
      rows.push({ name: n.name, jurisdiction: n.jurisdiction, disclosed: true, notDetected: true });
    }
  }

  const noteCards = rows.map((r, idx) => {
    const range = r.disclosed ? "excellent" : "bad";
    const border = r.disclosed ? "#059669" : "#dc2626";
    const delay = (idx * 0.03).toFixed(2);
    const tag = r.notDetected ? " · named only" : (r.disclosed ? " · disclosed" : " · UNDISCLOSED");
    return `<div class="rs-note reveal" style="border-left-color:${border};">
      <div class="rs-note-header">
        <span class="rs-note-dot rs-dot-${range}"></span>
        <span class="rs-note-cat">${esc(r.name)}</span>
        <span class="rs-note-score score-${range}">${esc(r.jurisdiction)}${tag}</span>
      </div>
      <div class="rs-note-bar">
        <div class="rs-note-bar-track"><div class="rs-note-bar-fill score-bar-${range}" style="--bar-width:${r.disclosed ? 100 : 5}%;transition-delay:${delay}s"></div></div>
      </div>
    </div>`;
  }).join("\n");

  const summary = `
    <div class="doc-shelf-summary reveal" style="margin-top:1rem;">
      <div class="doc-shelf-stat"><span class="dot dot-present"></span> ${named.length} named in policy</div>
      <div class="doc-shelf-stat"><span class="dot dot-missing"></span> ${undisclosed.length} undisclosed (detected, not named)</div>
      <div class="doc-shelf-stat"><span class="dot ${p.dpaReferenced ? "dot-present" : "dot-missing"}"></span> DPA referenced: ${p.dpaReferenced ? "yes" : "no"}</div>
      <div class="doc-shelf-stat"><span class="dot ${p.subProcessorsDisclosed ? "dot-present" : "dot-missing"}"></span> Sub-processors: ${p.subProcessorsDisclosed ? "disclosed" : "not disclosed"}</div>
    </div>`;

  const jcRows = (p.jointControllerScenarios || []).map(jc =>
    `<div class="rs-note reveal" style="border-left-color:${jc.disclosed ? "#059669" : "#dc2626"};margin-top:0.5rem;">
      <div class="rs-note-header">
        <span class="rs-note-dot rs-dot-${jc.disclosed ? "excellent" : "bad"}"></span>
        <span class="rs-note-cat">Joint controller: ${esc(jc.processor)}</span>
        <span class="rs-note-score score-${jc.disclosed ? "excellent" : "bad"}">${esc(jc.type)} · Art. 26 ${jc.disclosed ? "disclosed" : "MISSING"}</span>
      </div>
    </div>`
  ).join("\n");

  return `<section class="slide" data-title="Processor Transparency">
  <div class="slide-content">
    <span class="badge reveal">Processor Disclosure</span>
    <h2 class="reveal">Named Processors</h2>
    <p class="slide-intro reveal">Art. 13(1)(e) requires disclosure of recipients. Generic "third-party providers" is not sufficient.</p>
    <div class="rs-notes reveal">${noteCards}</div>
    ${summary}
    ${jcRows}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

// ─── Breach Notification Infrastructure (Phase E) ───
function buildBreachNotification(slideNum, totalSlides) {
  const b = findings.breachNotification;
  if (!b || (b.securityTxtPresent === undefined && b.dpaNotificationCommitment === undefined && b.individualNotificationCommitment === undefined)) return null;

  const yn = (v) => v ? "yes" : "no";
  const stxt = b.securityTxtPresent
    ? (b.securityTxtExpired === true ? "present (EXPIRED)" : b.securityTxtExpired === false ? "present, current" : "present")
    : "absent";
  const stxtOk = !!b.securityTxtPresent && b.securityTxtExpired !== true;

  const rows = [
    { label: "security.txt (RFC 9116)", value: stxt, ok: stxtOk },
    { label: "72-hour DPA notification commitment (Art. 33)", value: yn(b.dpaNotificationCommitment), ok: !!b.dpaNotificationCommitment },
    { label: "Individual notification commitment (Art. 34)", value: yn(b.individualNotificationCommitment), ok: !!b.individualNotificationCommitment },
    { label: "Dedicated security contact", value: yn(b.dedicatedSecurityContact), ok: !!b.dedicatedSecurityContact },
  ];

  const noteCards = rows.map((r, idx) => {
    const range = r.ok ? "excellent" : "bad";
    const border = r.ok ? "#059669" : "#dc2626";
    const delay = (idx * 0.04).toFixed(2);
    return `<div class="rs-note reveal" style="border-left-color:${border};">
      <div class="rs-note-header">
        <span class="rs-note-dot rs-dot-${range}"></span>
        <span class="rs-note-cat">${esc(r.label)}</span>
        <span class="rs-note-score score-${range}">${esc(r.value)}</span>
      </div>
      <div class="rs-note-bar">
        <div class="rs-note-bar-track"><div class="rs-note-bar-fill score-bar-${range}" style="--bar-width:${r.ok ? 100 : 5}%;transition-delay:${delay}s"></div></div>
      </div>
    </div>`;
  }).join("\n");

  const delay = (b.delayTacticLanguage || []).length
    ? `<div class="rs-note reveal" style="border-left-color:#dc2626;margin-top:1rem;">
        <div class="rs-note-header">
          <span class="rs-note-dot rs-dot-bad"></span>
          <span class="rs-note-cat">Delay-tactic phrases</span>
          <span class="rs-note-score score-bad">${b.delayTacticLanguage.length}</span>
        </div>
        <p class="rs-note-text">${b.delayTacticLanguage.map(esc).join(" · ")}</p>
      </div>`
    : "";

  return `<section class="slide" data-title="Breach Notification">
  <div class="slide-content">
    <span class="badge reveal">Security Governance</span>
    <h2 class="reveal">Breach Notification Infrastructure</h2>
    <p class="slide-intro reveal">GDPR Art. 33: 72-hour notification to the supervisory authority. Art. 34: individuals when high risk.</p>
    <div class="rs-notes reveal">${noteCards}</div>
    ${delay}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildGdprCompliance(slideNum, totalSlides) {
  const items = findings.gdprCompliance || [];
  // Normalise: support both schema fields and Claude's alternate field names
  const normalised = items.map((item) => ({
    article: item.article || (item.articles || [])[0] || "",
    title: item.title || item.finding || "",
    status: item.status || normalise.severityToStatus(item.severity),
    finding: item.finding || item.detail || "",
  }));
  const passCt = normalised.filter((x) => x.status === "pass").length;
  const failCt = normalised.filter((x) => x.status === "fail").length;
  const partialCt = normalised.filter((x) => x.status === "partial").length;
  const total = normalised.length || 1;
  const normPages = paginate(normalised, MAX.COMPLIANCE_CARDS);

  const statusRange = { pass: "excellent", fail: "bad", partial: "acceptable" };
  const statusBorder = { pass: "#059669", fail: "#dc2626", partial: "#d97706" };
  const statusBarWidth = { pass: 100, fail: 5, partial: 50 };

  return normPages.map((page, i) => {
    const pageTitle = normPages.length > 1 ? `GDPR Compliance (${i + 1}/${normPages.length})` : "GDPR Compliance";
    const noteCards = page.map((item, idx) => {
      const rangeClass = statusRange[item.status] || "acceptable";
      const border = statusBorder[item.status] || statusBorder.partial;
      const barWidth = statusBarWidth[item.status] || 50;
      const delay = (idx * 0.04).toFixed(2);
      const findingText = item.finding ? `<p class="rs-note-text">${esc(item.finding)}</p>` : "";
      return `<div class="rs-note reveal" style="border-left-color:${border};">
        <div class="rs-note-header">
          <span class="rs-note-dot rs-dot-${rangeClass}"></span>
          <span class="rs-note-cat">${esc(item.title)}</span>
          <span class="rs-note-score score-${rangeClass}">${esc(item.article)}</span>
        </div>
        <div class="rs-note-bar">
          <div class="rs-note-bar-track"><div class="rs-note-bar-fill score-bar-${rangeClass}" style="--bar-width:${barWidth}%;transition-delay:${delay}s"></div></div>
        </div>
        ${findingText}
      </div>`;
    }).join("\n");

    // Overall compliance bar on first page
    const compliancePct = Math.round((passCt / total) * 100);
    const overallRange = compliancePct >= 80 ? "excellent" : compliancePct >= 60 ? "good" : compliancePct >= 40 ? "acceptable" : compliancePct >= 20 ? "poor" : "bad";
    const overallBar = i === 0 ? `<div class="rs-overall reveal">
      <div class="score-bars">
        <div class="score-bar-row score-bar-overall">
          <div class="score-bar-label"><span class="score-bar-name">Compliance</span></div>
          <div class="score-bar-track"><div class="score-bar-fill score-bar-${overallRange}" style="--bar-width:${compliancePct}%;transition-delay:0.35s"></div></div>
          <div class="score-bar-value score-${overallRange}">${compliancePct}%</div>
        </div>
      </div>
    </div>` : "";

    return `<section class="slide" data-title="${esc(pageTitle)}">
  <div class="slide-content">
    <span class="badge reveal">GDPR Compliance</span>
    <h2 class="reveal">Compliance Matrix</h2>
    <div class="rs-layout rs-unified">
      <div class="rs-notes-grid">${noteCards}</div>
      ${overallBar}
    </div>
    ${i === 0 ? `<div class="cm-summary reveal">
      <div class="cm-summary-item"><span class="cm-summary-dot cm-summary-dot-pass"></span> ${passCt} compliant</div>
      <div class="cm-summary-item"><span class="cm-summary-dot cm-summary-dot-fail"></span> ${failCt} violations</div>
      <div class="cm-summary-item"><span class="cm-summary-dot cm-summary-dot-partial"></span> ${partialCt} partial</div>
    </div>` : ""}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum + i} / ${totalSlides}</div>
</section>`;
  });
}

function buildRiskSummary(slideNum, totalSlides) {
  const categories = [
    { key: "consent", label: "Consent", weight: 25 },
    { key: "preConsentTracking", label: "Pre-Consent", weight: 20 },
    { key: "legalPages", label: "Legal", weight: 15 },
    { key: "crossBorder", label: "Cross-Border", weight: 15 },
    { key: "securityHeaders", label: "Security", weight: 10 },
    { key: "cookieManagement", label: "Cookies", weight: 10 },
    { key: "darkPatterns", label: "Dark Patterns", weight: 5 },
  ];

  const bars = categories.map((cat, i) => {
    const s = scores[cat.key] || { score: 1.0 };
    const rangeClass = scoreRangeClass(s.score);
    const widthPct = (s.score / 10) * 100;
    const delay = (i * 0.05).toFixed(2);
    return `<div class="score-bar-row reveal">
      <div class="score-bar-label"><span class="score-bar-name">${esc(cat.label)}</span><span class="score-bar-weight">${cat.weight}%</span></div>
      <div class="score-bar-track"><div class="score-bar-fill score-bar-${rangeClass}" style="--bar-width:${widthPct}%;transition-delay:${delay}s"></div></div>
      <div class="score-bar-value score-${rangeClass}">${s.score}</div>
    </div>`;
  }).join("\n");

  const overallRange = scoreRangeClass(meta.overallScore);
  const overallWidth = (meta.overallScore / 10) * 100;

  const notes = findings.riskSummaryNotes || [];
  const hasNotes = notes.length > 0;

  // Overall bar — always rendered at the bottom
  const overallBar = `<div class="rs-overall reveal">
      <div class="score-bars">
        <div class="score-bar-row score-bar-overall">
          <div class="score-bar-label"><span class="score-bar-name">Overall</span></div>
          <div class="score-bar-track"><div class="score-bar-fill score-bar-${overallRange}" style="--bar-width:${overallWidth}%;transition-delay:0.40s"></div></div>
          <div class="score-bar-value score-${overallRange}">${meta.overallScore}</div>
        </div>
      </div>
    </div>`;

  let bodyHtml;
  if (hasNotes) {
    // Unified layout: note cards with inline bars in a 2-column grid
    const noteCards = notes.map((n, i) => {
      const cat = categories.find(c => c.key === n.category);
      const s = scores[n.category] || { score: 1.0 };
      const rangeClass = scoreRangeClass(s.score);
      const widthPct = (s.score / 10) * 100;
      const delay = (i * 0.05).toFixed(2);
      return `<div class="rs-note reveal">
          <div class="rs-note-header">
            <span class="rs-note-dot rs-dot-${rangeClass}"></span>
            <span class="rs-note-cat">${esc(cat ? cat.label : n.category)}</span>
            <span class="rs-note-score score-${rangeClass}">${s.score}</span>
          </div>
          <div class="rs-note-bar">
            <div class="rs-note-bar-track"><div class="rs-note-bar-fill score-bar-${rangeClass}" style="--bar-width:${widthPct}%;transition-delay:${delay}s"></div></div>
          </div>
          <p class="rs-note-text">${esc(n.note)}</p>
        </div>`;
    }).join("\n");

    bodyHtml = `<div class="rs-layout rs-unified">
      <div class="rs-notes-grid">${noteCards}</div>
      ${overallBar}
    </div>`;
  } else {
    // Fallback: standalone bars when no notes exist
    bodyHtml = `<div class="rs-layout">
      <div class="rs-bars">
        <div class="score-bars">
          ${bars}
          <div class="score-bar-separator"></div>
          <div class="score-bar-row score-bar-overall reveal">
            <div class="score-bar-label"><span class="score-bar-name">Overall</span></div>
            <div class="score-bar-track"><div class="score-bar-fill score-bar-${overallRange}" style="--bar-width:${overallWidth}%;transition-delay:0.40s"></div></div>
            <div class="score-bar-value score-${overallRange}">${meta.overallScore}</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  return `<section class="slide glow-right" data-title="Risk Summary">
  <div class="slide-content">
    <span class="badge reveal">Risk Assessment</span>
    <h2 class="reveal">Privacy Risk Summary</h2>
    ${bodyHtml}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildRecommendations(slideNum, totalSlides) {
  const recs = findings.recommendations || [];
  const pages = paginate(recs, MAX.RECOMMENDATIONS);
  return pages.map((page, i) => {
    const pageTitle = pages.length > 1 ? `Recommendations (${i + 1}/${pages.length})` : "Recommendations";
    const pageOffset = pages.slice(0, i).reduce((sum, p) => sum + p.length, 0);
    const noteCards = page.map((r, idx) => {
      const num = pageOffset + idx + 1;
      const refText = r.enforcementRef ? ` — ${esc(r.enforcementRef)}` : "";
      return `<div class="rs-note reveal" style="border-left-color:var(--accent);">
        <div class="rs-note-header">
          <span class="rs-note-dot" style="background:var(--accent);"></span>
          <span class="rs-note-cat">${esc(r.action)}</span>
          <span class="rs-note-score" style="color:var(--text-muted);font-weight:500;">#${num}</span>
        </div>
        <p class="rs-note-text">${esc(r.detail)}${refText}</p>
      </div>`;
    }).join("\n");

    return `<section class="slide" data-title="${esc(pageTitle)}">
  <div class="slide-content">
    <span class="badge reveal">Action Items</span>
    <h2 class="reveal">Recommendations</h2>
    <div class="rs-layout rs-unified">
      <div class="rs-notes-grid">${noteCards}</div>
    </div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum + i} / ${totalSlides}</div>
</section>`;
  });
}

function buildMethodology(slideNum, totalSlides) {
  const meth = findings.methodology;

  // Phase nodes for the flowchart
  const phases = [];
  if (meth) {
    if (meth.scoutUsed) {
      phases.push({ id: "scout", label: "Scout", icon: "🔍", desc: "Banner detection", badges: [] });
    }
    phases.push({
      id: "pre", label: "Pre-Consent", icon: "📡", desc: "Before interaction",
      badges: meth.preCounts ? [
        meth.preCounts.cookies != null ? `${meth.preCounts.cookies} cookies` : null,
        meth.preCounts.trackers != null ? `${meth.preCounts.trackers} trackers` : null,
        meth.preCounts.requests != null ? `${meth.preCounts.requests} requests` : null,
        meth.preCounts.thirdPartyDomains != null ? `${meth.preCounts.thirdPartyDomains} domains` : null,
      ].filter(Boolean) : []
    });
    phases.push({
      id: "post", label: "Post-Consent", icon: "✅", desc: "After accept/reject",
      badges: meth.postCounts ? [
        meth.postCounts.cookies != null ? `${meth.postCounts.cookies} cookies` : null,
        meth.postCounts.trackers != null ? `${meth.postCounts.trackers} trackers` : null,
        meth.postCounts.requests != null ? `${meth.postCounts.requests} requests` : null,
        meth.postCounts.thirdPartyDomains != null ? `${meth.postCounts.thirdPartyDomains} domains` : null,
      ].filter(Boolean) : []
    });
  } else {
    // Fallback: 2-node static phases
    phases.push({ id: "pre", label: "Pre-Consent", icon: "📡", desc: "Before interaction", badges: [] });
    phases.push({ id: "post", label: "Post-Consent", icon: "✅", desc: "After accept", badges: [] });
  }

  const detectionLabel = meth && meth.bannerDetectionMethod ? {
    "cmp-selector": "CMP auto-detected",
    "content-fallback": "Content-based detection",
    "vision-assisted": "Vision-assisted hints",
    "none": "No banner found",
  }[meth.bannerDetectionMethod] || meth.bannerDetectionMethod : null;

  const variantLabels = meth && meth.variants ? meth.variants.join(" · ") : "ignore · accept · reject";

  const flowNodes = phases.map((p, i) => {
    const badgeHtml = p.badges.length
      ? `<div class="meth-badges">${p.badges.map(b => `<span class="meth-badge">${esc(b)}</span>`).join("")}</div>`
      : "";
    const connector = i < phases.length - 1 ? `<div class="meth-connector">→</div>` : "";
    return `<div class="meth-node reveal" style="background:rgba(28,25,23,0.025);border:none;box-shadow:none;">
      <div class="meth-icon">${p.icon}</div>
      <div class="meth-label">${esc(p.label)}</div>
      <div class="meth-desc">${esc(p.desc)}</div>
      ${badgeHtml}
    </div>${connector}`;
  }).join("");

  return `<section class="slide" data-title="Methodology">
  <div class="slide-content">
    <span class="badge reveal">Methodology</span>
    <h2 class="reveal">How We Scanned</h2>
    <div class="meth-flow reveal">${flowNodes}</div>
    <div class="meth-details reveal">
      <details>
        <summary>Scan configuration</summary>
        <div class="meth-detail-grid">
          <span class="meth-detail-label">Browser</span><span>Firefox (stealth mode)</span>
          <span class="meth-detail-label">Viewport</span><span>1440×900</span>
          <span class="meth-detail-label">Locale</span><span>en-NL (EU)</span>
          <span class="meth-detail-label">Variants</span><span>${esc(variantLabels)}</span>
          ${detectionLabel ? `<span class="meth-detail-label">Banner detection</span><span>${esc(detectionLabel)}</span>` : ""}
          <span class="meth-detail-label">Classification</span><span>Tracking fires → consent-mode pings → SDK loads</span>
        </div>
      </details>
    </div>
    <div class="reveal" style="margin-top:var(--element-gap);display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;background:rgba(28,25,23,0.025);border-radius:6px;padding:clamp(0.6rem,1vw,0.9rem);">
      <a href="data:application/json;base64,${Buffer.from(JSON.stringify(downloadJson, null, 2)).toString('base64')}" download="${meta.domain}-privacy-audit.json" style="background:var(--accent);color:#fff;text-decoration:none;padding:0.6rem 1.2rem;border-radius:6px;font-family:var(--font-mono);font-size:var(--small-size);cursor:pointer;">
        &#8615; Download JSON
      </a>
      <a href="data:text/markdown;base64,${Buffer.from(generateMarkdown()).toString('base64')}" download="${meta.domain}-privacy-audit.md" style="background:transparent;color:var(--accent);text-decoration:none;padding:0.6rem 1.2rem;border-radius:6px;font-family:var(--font-mono);font-size:var(--small-size);cursor:pointer;border:1px solid var(--accent);">
        &#8615; Download Report
      </a>
    </div>
    ${meta.theme === "datagobes" ? `<hr class="section-divider reveal">
    <p class="reveal" style="font-family:var(--font-mono);font-size:var(--small-size);color:var(--text-muted);text-align:center;margin-top:var(--element-gap);">
      Privacy Audit #${String(meta.episode).padStart(2, "0")} in the <span class="gradient-text" style="font-weight:600;">datagobes.dev</span> series
    </p>` : ""}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

// ───────────────────────────────────────────
// Phase A: Reject & Variant Comparison slides
// ───────────────────────────────────────────

function buildRejectScenario(slideNum, totalSlides) {
  const rs = findings.rejectScenario;
  if (!rs) return null;

  const persistingTrackers = rs.persistingTrackers || [];
  const persistingCookies = rs.persistingCookies || [];
  const totalPersisting = persistingTrackers.length + persistingCookies.length;

  if (totalPersisting === 0 && !rs.summary) return null;

  const trackerCards = persistingTrackers.slice(0, 6).map((t) =>
    `<div class="tr-card tr-card-active reveal" style="background:rgba(28,25,23,0.025);border-color:transparent;box-shadow:none;">
      <div class="tr-pulse"></div>
      <div class="tr-name">${esc(t.name)}</div>
      <div class="tr-domain">${esc(normalise.domains(t.domains))}</div>
      <div class="tr-category">${esc(t.category)}</div>
      <div class="tr-status tr-status-active" style="color:var(--accent-red);">Persists after reject</div>
    </div>`
  ).join("\n");

  const cookieList = persistingCookies.slice(0, 8).map((c) =>
    `<div class="vc-persist-item reveal">
      <span class="vc-persist-name">${esc(c.name)}</span>
      <span class="vc-persist-domain">${esc(c.domain)}</span>
      <span class="vc-persist-purpose vc-persist-${normalise.cookiePurpose(c.purpose)}">${esc(c.purpose)}</span>
    </div>${c.reason ? `<div class="vc-persist-reason reveal">${esc(c.reason)}</div>` : ""}`
  ).join("\n");

  // Nuanced summary: if reject is honoured but cookies persist, auto-clarify
  let summaryText = rs.summary ? `<p class="reveal" style="font-size:var(--body-size);color:var(--text-secondary);margin-top:var(--content-gap);">${esc(rs.summary)}</p>` : "";
  if (rs.rejectHonoured && persistingCookies.length > 0 && !rs.summary) {
    const hasReasons = persistingCookies.some(c => c.reason);
    const clarify = hasReasons
      ? "Persisting cookies were set pre-consent or fall outside CMP scope — not a consent violation."
      : "Some cookies persist but are not consent-gated — typically set before the banner loads.";
    summaryText = `<p class="reveal" style="font-size:var(--body-size);color:var(--text-secondary);margin-top:var(--content-gap);">${esc(clarify)}</p>`;
  }

  return `<section class="slide" data-title="Reject Scenario">
  <div class="slide-content">
    <span class="badge reveal" style="background:rgba(220,38,38,0.1);color:var(--accent-red);">Reject Scenario</span>
    <h2 class="reveal">What Happens When You Say <span style="color:var(--accent-red)">No</span>?</h2>
    <div class="rs-notes-grid" style="grid-template-columns:repeat(3,1fr);margin-top:var(--content-gap);">
      <div class="rs-note reveal" style="border-left-color:${persistingTrackers.length > 0 ? '#dc2626' : '#059669'};text-align:center;">
        <div style="font-family:var(--font-mono);font-size:clamp(1.2rem,2.5vw,1.8rem);font-weight:700;color:${persistingTrackers.length > 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">${persistingTrackers.length}</div>
        <div class="rs-note-text" style="text-align:center;">Trackers persist</div>
      </div>
      <div class="rs-note reveal" style="border-left-color:${persistingCookies.length > 0 && !rs.rejectHonoured ? '#dc2626' : persistingCookies.length > 0 ? '#d97706' : '#059669'};text-align:center;">
        <div style="font-family:var(--font-mono);font-size:clamp(1.2rem,2.5vw,1.8rem);font-weight:700;color:${persistingCookies.length > 0 && !rs.rejectHonoured ? 'var(--accent-red)' : persistingCookies.length > 0 ? 'var(--accent-yellow)' : 'var(--accent-green)'};">${persistingCookies.length}</div>
        <div class="rs-note-text" style="text-align:center;">Cookies persist</div>
      </div>
      <div class="rs-note reveal" style="border-left-color:${rs.rejectHonoured ? '#059669' : '#dc2626'};text-align:center;">
        <div style="font-family:var(--font-mono);font-size:clamp(1.2rem,2.5vw,1.8rem);font-weight:700;color:${rs.rejectHonoured ? 'var(--accent-green)' : 'var(--accent-red)'};">${rs.rejectHonoured ? '✓' : '✗'}</div>
        <div class="rs-note-text" style="text-align:center;">Reject honoured</div>
      </div>
    </div>
    ${trackerCards ? `<div class="tracker-radar" style="margin-top:var(--content-gap);">${trackerCards}</div>` : ""}
    ${cookieList ? `<div class="vc-persist-list">${cookieList}</div>` : ""}
    ${summaryText}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildVariantComparison(slideNum, totalSlides) {
  const vc = findings.variantComparison;
  if (!vc) return null;

  const variants = ["ignore", "accept", "reject"];
  const labels = { ignore: "No Interaction", accept: "Accept All", reject: "Reject All" };
  const colors = { ignore: "var(--accent-yellow)", accept: "var(--accent-green)", reject: "var(--accent-red)" };
  const dotColors = { ignore: "var(--accent-yellow)", accept: "var(--accent-green)", reject: "var(--accent-red)" };

  const metrics = [
    { key: "trackerCount", label: "Trackers" },
    { key: "cookieCount", label: "Cookies" },
    { key: "thirdPartyDomainCount", label: "3rd Parties" },
  ];

  const metricSections = metrics.map((m) => {
    const maxVal = Math.max(...variants.map((v) => (vc[v] || {})[m.key] || 0), 1);
    const bars = variants.map((v) => {
      const val = (vc[v] || {})[m.key] || 0;
      const pct = (val / maxVal * 100).toFixed(1);
      return `<div class="vc-bar-row">
        <span class="vc-bar-label">${labels[v]}</span>
        <div class="vc-bar-track"><div class="vc-bar-fill" style="width:${pct}%;background:${colors[v]};"></div></div>
        <span class="vc-bar-val">${val}</span>
      </div>`;
    }).join("\n");
    return `<div class="rs-note reveal" style="border-left-color:var(--accent);padding:clamp(0.6rem,1vw,0.9rem) clamp(0.8rem,1.2vw,1rem);">
      <div class="rs-note-header" style="margin-bottom:0.4rem;">
        <span class="rs-note-dot" style="background:var(--accent);"></span>
        <span class="rs-note-cat">${m.label}</span>
      </div>
      <div class="vc-bar-group">${bars}</div>
    </div>`;
  }).join("\n");

  const legend = variants.map((v) =>
    `<span class="vc-legend-item"><span class="vc-legend-dot" style="background:${dotColors[v]};"></span> ${labels[v]}</span>`
  ).join("\n");

  const verdict = vc.verdict ? `<div class="rs-note reveal" style="border-left-color:var(--accent-yellow);margin-top:var(--element-gap);">
    <p class="rs-note-text" style="font-style:italic;">${esc(vc.verdict)}</p>
  </div>` : "";

  return `<section class="slide" data-title="Variant Comparison">
  <div class="slide-content">
    <span class="badge reveal">Consent Variants</span>
    <h2 class="reveal">Ignore vs Accept vs Reject</h2>
    ${slideDesc("variantComparison")}
    <div class="vc-legend reveal">${legend}</div>
    <div class="vc-chart">${metricSections}</div>
    ${verdict}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildAuditTrailReject(slideNum, totalSlides) {
  const events = (findings.auditTrail || {}).rejectConsent || [];
  if (events.length === 0) return null;
  const pages = paginate(events, MAX.TIMELINE_EVENTS);
  return pages.map((page, i) => {
    const pageTitle = pages.length > 1 ? `Audit Trail: Post-Reject (${i + 1}/${pages.length})` : "Audit Trail: Post-Reject";
    return `<section class="slide" data-title="${esc(pageTitle)}">
  <div class="slide-content">
    <span class="badge reveal" style="background:rgba(220,38,38,0.1);color:var(--accent-red);">Audit Trail</span>
    <h2 class="reveal">What Happens After <span style="color:var(--accent-red)">Reject</span></h2>
    ${slideDesc("auditTrailReject")}
    <div class="timeline reveal">
      <div class="tl-consent-break reveal">
        <span class="tl-consent-click" style="background:var(--accent-red);color:#fff;">User Clicks Reject</span>
      </div>
      <div class="tl-phase tl-phase-post reveal">
        <span class="tl-phase-label">Phase 2 — Post-Reject</span>
      </div>
      ${buildTimelineEvents(page)}
    </div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum + i} / ${totalSlides}</div>
</section>`;
  });
}

// ───────────────────────────────────────────
// Phase D: New Data Visualizations
// ───────────────────────────────────────────

function buildCookiePurposeMatching(slideNum, totalSlides) {
  const items = findings.cookiePurposeMatching || [];
  if (items.length === 0) return null;

  const matchCount = items.filter((i) => i.match).length;
  const mismatchCount = items.filter((i) => !i.match).length;
  const total = items.length || 1;

  const pages = paginate(items, MAX.COOKIE_ROWS);
  return pages.map((page, i) => {
    const pageTitle = pages.length > 1 ? `Cookie Purpose Matching (${i + 1}/${pages.length})` : "Cookie Purpose Matching";
    const noteCards = page.map((item) => {
      const rangeClass = item.match ? "excellent" : "bad";
      const border = item.match ? "#059669" : "#dc2626";
      const icon = item.match ? "&#10003;" : "&#10007;";
      const flow = item.match
        ? `${esc(item.declared)}`
        : `<span style="text-decoration:line-through;opacity:0.5;">${esc(item.declared)}</span> → ${esc(item.observed)}`;
      return `<div class="rs-note reveal" style="border-left-color:${border};">
        <div class="rs-note-header">
          <span class="rs-note-dot rs-dot-${rangeClass}"></span>
          <span class="rs-note-cat">${esc(item.cookie)}</span>
          <span class="rs-note-score score-${rangeClass}">${icon}</span>
        </div>
        <p class="rs-note-text">${flow}</p>
      </div>`;
    }).join("\n");

    // Overall match rate bar on first page
    const matchPct = Math.round((matchCount / total) * 100);
    const overallRange = matchPct >= 80 ? "excellent" : matchPct >= 60 ? "good" : matchPct >= 40 ? "acceptable" : matchPct >= 20 ? "poor" : "bad";
    const overallBar = i === 0 ? `<div class="rs-overall reveal">
      <div class="score-bars">
        <div class="score-bar-row score-bar-overall">
          <div class="score-bar-label"><span class="score-bar-name">Match Rate</span></div>
          <div class="score-bar-track"><div class="score-bar-fill score-bar-${overallRange}" style="--bar-width:${matchPct}%;transition-delay:0.30s"></div></div>
          <div class="score-bar-value score-${overallRange}">${matchPct}%</div>
        </div>
      </div>
    </div>` : "";

    return `<section class="slide" data-title="${esc(pageTitle)}">
  <div class="slide-content">
    <span class="badge reveal">Cookie Audit</span>
    <h2 class="reveal">Declared vs Observed Purpose</h2>
    ${slideDesc("cookiePurposeMatching")}
    <div class="rs-layout rs-unified">
      <div class="rs-notes-grid">${noteCards}</div>
      ${overallBar}
    </div>
    <div class="cm-summary reveal">
      <div class="cm-summary-item"><span class="cm-summary-dot cm-summary-dot-pass"></span> ${matchCount} match</div>
      <div class="cm-summary-item"><span class="cm-summary-dot cm-summary-dot-fail"></span> ${mismatchCount} mismatch</div>
    </div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum + i} / ${totalSlides}</div>
</section>`;
  });
}

function buildPiggybackingChain(slideNum, totalSlides) {
  const chains = findings.piggybackingChains || [];
  if (chains.length === 0) return null;

  const chainItems = chains.slice(0, 6).map((chain) => {
    const nodes = (chain.chain || []).map((node, idx) => {
      const isLast = idx === (chain.chain || []).length - 1;
      const nodeClass = idx === 0 ? "pb-node-root" : "pb-node-child";
      return `<div class="pb-node ${nodeClass}">
        <span class="pb-node-name">${esc(node.name || node)}</span>
        ${node.domain ? `<span class="pb-node-domain">${esc(node.domain)}</span>` : ""}
      </div>${!isLast ? '<div class="pb-arrow">→</div>' : ""}`;
    }).join("\n");

    return `<div class="pb-chain reveal">
      <div class="pb-chain-nodes">${nodes}</div>
      ${chain.risk ? `<span class="pb-chain-risk pb-risk-${chain.risk}">${esc(chain.risk)} risk</span>` : ""}
    </div>`;
  }).join("\n");

  return `<section class="slide" data-title="Piggybacking Chains">
  <div class="slide-content">
    <span class="badge reveal" style="background:rgba(220,38,38,0.1);color:var(--accent-red);">Supply Chain</span>
    <h2 class="reveal">4th-Party Piggybacking</h2>
    ${slideDesc("piggybackingChains")}
    <p class="reveal" style="font-size:var(--small-size);color:var(--text-secondary);">Tracker A loads Tracker B loads Tracker C — hidden supply-chain tracking</p>
    <div class="pb-chains">${chainItems}</div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildStorageAnalysis(slideNum, totalSlides) {
  const sa = findings.storageAnalysis;
  if (!sa) return null;

  const sections = [];

  // localStorage
  const ls = sa.localStorage || {};
  if ((ls.preConsent || []).length > 0 || (ls.postConsent || []).length > 0) {
    const preItems = (ls.preConsent || []).slice(0, 6).map((item) =>
      `<span class="sa-item sa-item-pre">${esc(typeof item === "string" ? item : item.key || item.name)}</span>`
    ).join("\n");
    const postItems = (ls.postConsent || []).slice(0, 6).map((item) =>
      `<span class="sa-item sa-item-post">${esc(typeof item === "string" ? item : item.key || item.name)}</span>`
    ).join("\n");
    sections.push(`<div class="rs-note sa-section reveal" style="border-left-color:var(--accent);">
      <div class="rs-note-header" style="margin-bottom:0.3rem;"><span class="rs-note-dot" style="background:var(--accent);"></span><span class="rs-note-cat">localStorage</span></div>
      <div class="sa-split">
        <div class="sa-col"><div class="sa-col-label" style="color:var(--accent-red);">Pre-Consent (${(ls.preConsent || []).length})</div>${preItems || '<span class="sa-empty">None</span>'}</div>
        <div class="sa-col"><div class="sa-col-label" style="color:var(--accent-yellow);">Post-Consent (${(ls.postConsent || []).length})</div>${postItems || '<span class="sa-empty">None</span>'}</div>
      </div>
    </div>`);
  }

  // sessionStorage
  const ss = sa.sessionStorage || {};
  if ((ss.preConsent || []).length > 0 || (ss.postConsent || []).length > 0) {
    const preItems = (ss.preConsent || []).slice(0, 6).map((item) =>
      `<span class="sa-item sa-item-pre">${esc(typeof item === "string" ? item : item.key || item.name)}</span>`
    ).join("\n");
    const postItems = (ss.postConsent || []).slice(0, 6).map((item) =>
      `<span class="sa-item sa-item-post">${esc(typeof item === "string" ? item : item.key || item.name)}</span>`
    ).join("\n");
    sections.push(`<div class="rs-note sa-section reveal" style="border-left-color:var(--accent);">
      <div class="rs-note-header" style="margin-bottom:0.3rem;"><span class="rs-note-dot" style="background:var(--accent);"></span><span class="rs-note-cat">sessionStorage</span></div>
      <div class="sa-split">
        <div class="sa-col"><div class="sa-col-label" style="color:var(--accent-red);">Pre-Consent (${(ss.preConsent || []).length})</div>${preItems || '<span class="sa-empty">None</span>'}</div>
        <div class="sa-col"><div class="sa-col-label" style="color:var(--accent-yellow);">Post-Consent (${(ss.postConsent || []).length})</div>${postItems || '<span class="sa-empty">None</span>'}</div>
      </div>
    </div>`);
  }

  // IndexedDB
  const idb = sa.indexedDB || {};
  if ((idb.preConsent || []).length > 0 || (idb.postConsent || []).length > 0) {
    const preItems = (idb.preConsent || []).slice(0, 4).map((item) =>
      `<span class="sa-item sa-item-pre">${esc(typeof item === "string" ? item : item.name)}</span>`
    ).join("\n");
    const postItems = (idb.postConsent || []).slice(0, 4).map((item) =>
      `<span class="sa-item sa-item-post">${esc(typeof item === "string" ? item : item.name)}</span>`
    ).join("\n");
    sections.push(`<div class="rs-note sa-section reveal" style="border-left-color:var(--accent);">
      <div class="rs-note-header" style="margin-bottom:0.3rem;"><span class="rs-note-dot" style="background:var(--accent);"></span><span class="rs-note-cat">IndexedDB</span></div>
      <div class="sa-split">
        <div class="sa-col"><div class="sa-col-label" style="color:var(--accent-red);">Pre-Consent (${(idb.preConsent || []).length})</div>${preItems || '<span class="sa-empty">None</span>'}</div>
        <div class="sa-col"><div class="sa-col-label" style="color:var(--accent-yellow);">Post-Consent (${(idb.postConsent || []).length})</div>${postItems || '<span class="sa-empty">None</span>'}</div>
      </div>
    </div>`);
  }

  if (sections.length === 0) return null;

  return `<section class="slide" data-title="Storage Analysis">
  <div class="slide-content">
    <span class="badge reveal">Browser Storage</span>
    <h2 class="reveal">Beyond Cookies</h2>
    ${slideDesc("storageAnalysis")}
    <p class="reveal" style="font-size:var(--small-size);color:var(--text-secondary);">Sites increasingly use storage APIs to avoid cookie regulations</p>
    ${sections.join("\n")}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

// ───────────────────────────────────────────
// New slide types (scanner v2.0)
// ───────────────────────────────────────────

function buildPrivacyPolicy(slideNum, totalSlides) {
  const items = findings.privacyPolicyAnalysis || [];
  if (items.length === 0) return null;

  const presentCt = items.filter((x) => x.status === "present").length;
  const absentCt = items.filter((x) => x.status === "absent").length;
  const vagueCt = items.filter((x) => x.status === "vague").length;
  const total = items.length;
  const score = total > 0 ? Math.round((presentCt / total) * 100) : 0;

  const statusRange = { present: "excellent", absent: "bad", vague: "acceptable" };
  const statusBorder = { present: "#059669", absent: "#dc2626", vague: "#d97706" };
  const statusBarWidth = { present: 100, absent: 5, vague: 50 };

  const noteCards = items.map((item, idx) => {
    const rangeClass = statusRange[item.status] || "acceptable";
    const border = statusBorder[item.status] || statusBorder.vague;
    const barWidth = statusBarWidth[item.status] || 50;
    const delay = (idx * 0.03).toFixed(2);

    const excerptId = `pp-excerpt-${idx}`;
    const excerptHtml = item.excerpt
      ? `<div class="pp-excerpt" id="${excerptId}" style="display:none;font-size:clamp(0.5rem,0.75vw,0.6rem);color:var(--text-muted);margin-top:0.2rem;font-style:italic;">${esc(item.excerpt.substring(0, 200))}${item.excerpt.length > 200 ? "..." : ""}</div>`
      : "";
    const toggle = item.excerpt
      ? ` <button class="pp-toggle" onclick="var el=document.getElementById('${excerptId}');el.style.display=el.style.display==='none'?'block':'none';" aria-label="Toggle excerpt" style="background:none;border:none;cursor:pointer;font-size:0.6rem;color:var(--text-muted);padding:0 0.2rem;">&#9662;</button>`
      : "";

    return `<div class="rs-note reveal" style="border-left-color:${border};">
        <div class="rs-note-header">
          <span class="rs-note-dot rs-dot-${rangeClass}"></span>
          <span class="rs-note-cat">${esc(item.element)}${toggle}</span>
          <span class="rs-note-score score-${rangeClass}">${item.status === "present" ? "&#10003;" : item.status === "absent" ? "&#10007;" : "&#9888;"}</span>
        </div>
        <div class="rs-note-bar">
          <div class="rs-note-bar-track"><div class="rs-note-bar-fill score-bar-${rangeClass}" style="--bar-width:${barWidth}%;transition-delay:${delay}s"></div></div>
        </div>
        ${excerptHtml}
      </div>`;
  }).join("\n");

  // Overall compliance bar
  const overallRange = score >= 80 ? "excellent" : score >= 60 ? "good" : score >= 40 ? "acceptable" : score >= 20 ? "poor" : "bad";
  const overallBar = `<div class="rs-overall reveal">
    <div class="score-bars">
      <div class="score-bar-row score-bar-overall">
        <div class="score-bar-label"><span class="score-bar-name">Coverage</span></div>
        <div class="score-bar-track"><div class="score-bar-fill score-bar-${overallRange}" style="--bar-width:${score}%;transition-delay:0.40s"></div></div>
        <div class="score-bar-value score-${overallRange}">${score}%</div>
      </div>
    </div>
  </div>`;

  return `<section class="slide" data-title="Privacy Policy Analysis">
  <div class="slide-content">
    <span class="badge reveal">Art. 13/14 Compliance</span>
    <h2 class="reveal">Privacy Policy Checklist</h2>
    ${slideDesc("privacyPolicy")}
    <div class="rs-layout rs-unified">
      <div class="rs-notes-grid">${noteCards}</div>
      ${overallBar}
    </div>
    <div class="cm-summary reveal">
      <div class="cm-summary-item"><span class="cm-summary-dot cm-summary-dot-pass"></span> ${presentCt} present</div>
      <div class="cm-summary-item"><span class="cm-summary-dot cm-summary-dot-fail"></span> ${absentCt} absent</div>
      <div class="cm-summary-item"><span class="cm-summary-dot cm-summary-dot-partial"></span> ${vagueCt} vague</div>
    </div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildFingerprinting(slideNum, totalSlides) {
  const fp = findings.fingerprinting;
  if (!fp || !fp.detected) return null;

  // NEW (2026-04): tiered model — render stacked-signals cards at top
  const stacked = fp.stackedSignals || [];
  const sdks = fp.commercialSdks || [];
  const stackedCards = stacked.length === 0 ? "" : stacked.map((s, i) => {
    const verdictColor = s.verdict === "active fingerprinting" ? "var(--accent-red)" : "var(--accent)";
    const verdictLabel = s.verdict === "active fingerprinting" ? "Active" : "Probable";
    const sdk = sdks.find(c => (c.domains || []).some(d => s.callerDomain === d || s.callerDomain.endsWith("." + d)));
    const sdkBadge = sdk ? `<span class="fp-stack-sdk">SDK: ${esc(sdk.name)}</span>` : "";
    const lbcBadge = s.legitimateBasisClaim
      ? `<span class="fp-stack-lbc fp-stack-lbc-${s.purposeDisclosed ? "ok" : "miss"}">claim: ${esc(s.legitimateBasisClaim)}</span>`
      : "";
    const preTag = s.preConsent ? '<span class="fp-stack-pre">PRE-CONSENT</span>' : "";
    const rationale = s.rationale ? `<p class="fp-stack-rationale">${esc(s.rationale)}</p>` : "";
    const apiList = (s.apis || []).slice(0, 6).join(", ");
    return `<div class="fp-stack-card reveal" style="border-left:3px solid ${verdictColor};">
      <div class="fp-stack-header">
        <span class="fp-stack-domain">${esc(s.callerDomain)}</span>
        ${preTag}
        <span class="fp-stack-verdict" style="color:${verdictColor};">${verdictLabel} \u00b7 T1:${s.tier1Count} T2:${s.tier2Count}</span>
      </div>
      ${sdkBadge ? `<div class="fp-stack-tags">${sdkBadge} ${lbcBadge}</div>` : (lbcBadge ? `<div class="fp-stack-tags">${lbcBadge}</div>` : "")}
      ${rationale}
      <p class="fp-stack-apis">APIs: ${esc(apiList)}${(s.apis || []).length > 6 ? ` +${(s.apis || []).length - 6} more` : ""}</p>
    </div>`;
  }).join("\n");

  // Existing heatmap kept as the lower section. Use tier1Calls + tier2Calls when
  // available (NEW model), else fall back to legacy apiCalls.
  const newTierCalls = [...(fp.tier1Calls || []), ...(fp.tier2Calls || [])];
  const apiItems = newTierCalls.length > 0 ? newTierCalls : (fp.apiCalls || fp.apis || []);
  const severityColors = { none: "var(--accent-green)", low: "var(--accent-yellow)", medium: "var(--accent)", high: "var(--accent-red)" };
  const sev = fp.severity || "medium";
  const maxCalls = Math.max(...apiItems.map((a) => (typeof a === "string" ? 1 : (a.callCount || a.count || 1))), 1);

  const apis = apiItems.map((api) => {
    const name = typeof api === "string" ? api : (api.name || [api.api, api.method].filter(Boolean).join("."));
    const count = typeof api === "string" ? 1 : (api.callCount != null ? api.callCount : (api.count || 1));
    const isPreConsent = typeof api === "string" ? fp.preConsent : (api.preConsent != null ? api.preConsent : fp.preConsent);
    const barWidth = (count / maxCalls * 100).toFixed(1);
    const barColor = isPreConsent ? "var(--accent-red)" : "var(--accent-yellow)";
    const phaseLabel = isPreConsent
      ? '<span class="fp-phase fp-phase-pre">PRE</span>'
      : '<span class="fp-phase fp-phase-post">POST</span>';

    return `<div class="fp-api-row reveal">
      <div class="fp-api-info">
        <span class="fp-api-name">${esc(name)}</span>
        ${phaseLabel}
      </div>
      <div class="fp-api-bar-track">
        <div class="fp-api-bar" style="width:${barWidth}%;background:${barColor};"></div>
      </div>
      <span class="fp-api-count">${count}</span>
    </div>`;
  }).join("\n");

  const preCount = apiItems.filter((a) => typeof a === "string" ? fp.preConsent : (a.preConsent != null ? a.preConsent : fp.preConsent)).length;
  const postCount = apiItems.length - preCount;

  return `<section class="slide" data-title="Fingerprinting Detection">
  <div class="slide-content">
    <span class="badge reveal" style="background:rgba(${sev === "high" ? "220,38,38" : "199,92,44"},0.1);color:${severityColors[sev]};">Browser Fingerprinting</span>
    <h2 class="reveal">API Interception Heatmap</h2>
    ${slideDesc("fingerprinting")}
    <div class="fp-severity reveal">
      <span class="fp-severity-dot" style="background:${severityColors[sev]};"></span>
      <span>Severity: <strong>${sev.toUpperCase()}</strong></span>
    </div>
    ${stackedCards ? `<div class="fp-stack-list reveal" style="margin:1rem 0;display:flex;flex-direction:column;gap:0.5rem;">${stackedCards}</div>` : ""}
    ${stackedCards ? `<h3 class="reveal" style="margin-top:1rem;font-size:0.95em;opacity:0.85;">API Call Detail</h3>` : ""}
    <div class="fp-api-list">${apis}</div>
    <div class="fp-legend reveal">
      ${preCount > 0 ? `<div class="fp-legend-item"><span class="fp-legend-swatch" style="background:var(--accent-red);"></span> Pre-consent (${preCount})</div>` : ""}
      ${postCount > 0 ? `<div class="fp-legend-item"><span class="fp-legend-swatch" style="background:var(--accent-yellow);"></span> Post-consent (${postCount})</div>` : ""}
    </div>
    <p class="reveal" style="opacity:0.55;font-size:0.78em;margin-top:1rem;">Network-layer fingerprinting (TLS JA3/JA4, HTTP/3 QUIC) is not JavaScript-detectable. See methodology.</p>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

// ─── Private-appendix slides (Phase 4 spec) — render only when CLI flag is set ───
function buildFingerprintingTier3Appendix(slideNum, totalSlides) {
  if (!includePrivateAppendix) return null;
  const fp = findings.fingerprinting;
  if (!fp || !Array.isArray(fp.tier3Appendix) || fp.tier3Appendix.length === 0) return null;
  const byApi = new Map();
  for (const c of fp.tier3Appendix) {
    const k = `${c.api}.${c.method}`;
    byApi.set(k, (byApi.get(k) || 0) + (c.count || 1));
  }
  const rows = Array.from(byApi.entries()).sort((a, b) => b[1] - a[1])
    .map(([api, count]) =>
      `<div class="fp-api-row reveal">
        <div class="fp-api-info"><span class="fp-api-name">${esc(api)}</span><span class="fp-phase fp-phase-post">T3</span></div>
        <div class="fp-api-bar-track"><div class="fp-api-bar" style="width:60%;background:var(--accent-yellow);opacity:0.5;"></div></div>
        <span class="fp-api-count">${count}</span>
      </div>`
    ).join("\n");
  return `<section class="slide" data-title="Fingerprinting: Tier 3 Appendix">
  <div class="slide-content">
    <span class="badge reveal">Private Appendix</span>
    <h2 class="reveal">Tier 3 \u2014 Informational Signals</h2>
    <p class="reveal" style="opacity:0.7;font-size:0.9em;">Low-entropy / commonly-legitimate API access. Not published in the public deck. Forensic context for the audit trail.</p>
    <div class="fp-api-list">${rows}</div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildOutOfScopeCaveats(slideNum, totalSlides) {
  if (!includePrivateAppendix) return null;
  const fp = findings.fingerprinting;
  if (!fp || !Array.isArray(fp.outOfScopeCaveats) || fp.outOfScopeCaveats.length === 0) return null;
  const items = fp.outOfScopeCaveats.map(t => `<li class="reveal" style="margin-bottom:0.5rem;">${esc(t)}</li>`).join("\n");
  return `<section class="slide" data-title="Methodology: Out of Scope">
  <div class="slide-content">
    <span class="badge reveal">Methodology</span>
    <h2 class="reveal">Out-of-Scope Caveats</h2>
    <p class="reveal" style="opacity:0.7;font-size:0.9em;">Vectors the JavaScript-instrumentation scanner cannot observe.</p>
    <ul class="reveal" style="line-height:1.6;">${items}</ul>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildConsentRevocation(slideNum, totalSlides) {
  const cr = findings.consentRevocation;
  if (!cr || !cr.mechanismFound) return null;

  const clicksAsymmetric = cr.revocationClicks > cr.acceptanceClicks;
  const cookieDelta = cr.cookiesBefore - cr.cookiesAfter;

  const remaining = (cr.trackingCookiesRemaining || []).slice(0, 6).map((c) =>
    `<span class="cr-persist-cookie">${esc(c)}</span>`
  ).join("\n");
  const overflowCount = (cr.trackingCookiesRemaining || []).length - 6;

  return `<section class="slide" data-title="Consent Revocation">
  <div class="slide-content">
    <span class="badge reveal">Art. 7(3) Compliance</span>
    <h2 class="reveal">Consent Withdrawal Test</h2>
    ${slideDesc("consentRevocation")}
    <div class="cr-flow reveal">
      <div class="cr-step cr-step-accept" style="background:rgba(28,25,23,0.025);border:none;border-left:3px solid var(--accent-green);box-shadow:none;">
        <div class="cr-step-icon">✓</div>
        <div class="cr-step-label">Accept</div>
        <div class="cr-step-detail">${cr.acceptanceClicks || 1} click${(cr.acceptanceClicks || 1) !== 1 ? "s" : ""}</div>
        <div class="cr-step-cookies">${cr.cookiesBefore || 0} cookies</div>
      </div>
      <div class="cr-arrow ${clicksAsymmetric ? 'cr-arrow-warn' : ''}">
        <span class="cr-arrow-line"></span>
        <span class="cr-arrow-text">${esc(cr.mechanismType || "unknown")}</span>
      </div>
      <div class="cr-step cr-step-revoke" style="background:rgba(28,25,23,0.025);border:none;border-left:3px solid var(--accent-red);box-shadow:none;">
        <div class="cr-step-icon" style="color:${cr.trackingCookiesDeleted ? 'var(--accent-green)' : 'var(--accent-red)'};">${cr.trackingCookiesDeleted ? '✓' : '✗'}</div>
        <div class="cr-step-label">Revoke</div>
        <div class="cr-step-detail">${cr.revocationClicks || "?"} click${(cr.revocationClicks || 0) !== 1 ? "s" : ""}</div>
        <div class="cr-step-cookies">${cr.cookiesAfter || 0} cookies</div>
      </div>
    </div>
    <div class="cr-verdict reveal">
      ${clicksAsymmetric
        ? `<div class="cr-verdict-item cr-verdict-bad">&#10007; ${cr.revocationClicks} clicks to revoke vs ${cr.acceptanceClicks} to accept</div>`
        : `<div class="cr-verdict-item cr-verdict-good">&#10003; Equal effort (${cr.acceptanceClicks || 1} click${(cr.acceptanceClicks || 1) !== 1 ? "s" : ""} each)</div>`
      }
      ${cr.trackingCookiesDeleted
        ? `<div class="cr-verdict-item cr-verdict-good">&#10003; ${cookieDelta} cookies deleted after revocation</div>`
        : `<div class="cr-verdict-item cr-verdict-bad">&#10007; Tracking cookies persisted after revocation</div>`
      }
    </div>
    ${remaining ? `<div class="cr-remaining reveal">
      <div class="cr-remaining-label">Cookies that survived revocation:</div>
      <div class="cr-remaining-list">${remaining}${overflowCount > 0 ? `<span class="cr-persist-cookie cr-persist-more">+${overflowCount} more</span>` : ""}</div>
    </div>` : ""}
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildTcfConsentMode(slideNum, totalSlides) {
  const tcf = findings.tcf;
  const gcm = findings.googleConsentMode;
  if ((!tcf || !tcf.detected) && (!gcm || !gcm.detected)) return null;

  let tcfSection = "";
  if (tcf && tcf.detected) {
    const purposes = tcf.purposeConsents || {};
    const purposeChips = Object.entries(purposes).slice(0, 10).map(([id, granted]) => {
      const color = granted ? "var(--accent-green)" : "var(--accent-red)";
      return `<span class="tcf-purpose-chip" style="border-color:${color};color:${color};">P${esc(id)}</span>`;
    }).join("\n");

    tcfSection = `<div class="card reveal" style="padding:1rem;">
      <h3 style="font-size:0.9rem;margin:0 0 0.6rem;">IAB TCF v${tcf.version || "?"}</h3>
      <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center;">
        <div><strong>CMP:</strong> ${tcf.cmpId || "Unknown"}</div>
        ${tcf.vendorCount ? `<div><strong>Vendors:</strong> ${tcf.vendorCount}</div>` : ""}
      </div>
      ${purposeChips ? `<div class="tcf-purposes" style="margin-top:0.5rem;">${purposeChips}</div>` : ""}
    </div>`;
  }

  let gcmSection = "";
  if (gcm && gcm.detected) {
    const signals = ["analytics_storage", "ad_storage", "ad_user_data", "ad_personalization", "functionality_storage", "personalization_storage", "security_storage"];
    const defaultState = gcm.defaultState || {};

    const signalNodes = signals.filter((s) => defaultState[s]).map((s) => {
      const val = defaultState[s];
      const denied = val === "denied";
      const cls = denied ? "gcm-signal-denied" : "gcm-signal-granted";
      const shortName = s.replace(/_storage$/, "").replace(/_/g, " ");
      return `<div class="gcm-signal ${cls}">
        <span class="gcm-signal-icon">${denied ? "✗" : "✓"}</span>
        <span class="gcm-signal-name">${esc(shortName)}</span>
        <span class="gcm-signal-val">${val}</span>
      </div>`;
    }).join("\n");

    const updates = (gcm.updateEvents || []).slice(0, 3).map((ev) => {
      const changes = Object.entries(ev).filter(([k]) => k !== "event" && k !== "timestamp").map(([k, v]) => {
        const color = v === "granted" ? "var(--accent-green)" : "var(--accent-red)";
        return `<span style="color:${color};font-size:0.7rem;">${esc(k.replace(/_/g, " "))}: ${v}</span>`;
      }).join(" ");
      return changes ? `<div class="gcm-update reveal">${changes}</div>` : "";
    }).filter(Boolean).join("\n");

    gcmSection = `<div class="card reveal" style="padding:1rem;">
      <h3 style="font-size:0.9rem;margin:0 0 0.6rem;">Google Consent Mode v2</h3>
      <div class="gcm-signal-grid">${signalNodes || '<span style="opacity:0.6;">No signal data</span>'}</div>
      ${updates ? `<div class="gcm-updates"><div class="gcm-update-label">After consent update:</div>${updates}</div>` : ""}
    </div>`;
  }

  return `<section class="slide" data-title="TCF & Consent Mode">
  <div class="slide-content">
    <span class="badge reveal">Consent Infrastructure</span>
    <h2 class="reveal">TCF &amp; Consent Mode</h2>
    ${slideDesc("tcfConsentMode")}
    <div style="display:flex;flex-direction:column;gap:0.8rem;">
      ${tcfSection}
      ${gcmSection}
    </div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildDataSubjectRights(slideNum, totalSlides) {
  const rights = findings.dataSubjectRights || [];
  if (rights.length === 0) return null;

  const accessibleCt = rights.filter((r) => r.accessible).length;
  const maxDepth = Math.max(...rights.filter((r) => r.accessible && r.clickDepth).map((r) => r.clickDepth), 1);

  const noteCards = rights.map((r, idx) => {
    const rangeClass = r.accessible ? (r.clickDepth <= 2 ? "excellent" : r.clickDepth <= 4 ? "acceptable" : "poor") : "bad";
    const border = r.accessible ? (r.clickDepth <= 2 ? "#059669" : r.clickDepth <= 4 ? "#d97706" : "#ea580c") : "#dc2626";
    const icon = r.accessible ? "&#10003;" : "&#10007;";
    const barWidth = r.accessible && r.clickDepth ? (r.clickDepth / Math.max(maxDepth, 5) * 100).toFixed(0) : (r.accessible ? 5 : 0);
    const detail = r.accessible && r.clickDepth
      ? `${r.clickDepth} click${r.clickDepth !== 1 ? "s" : ""}`
      : r.accessible ? "Direct link" : "Not found";
    const delay = (idx * 0.04).toFixed(2);

    return `<div class="rs-note reveal" style="border-left-color:${border};">
      <div class="rs-note-header">
        <span class="rs-note-dot rs-dot-${rangeClass}"></span>
        <span class="rs-note-cat">${esc(r.right)}</span>
        <span class="rs-note-score score-${rangeClass}">${icon}</span>
      </div>
      ${r.accessible ? `<div class="rs-note-bar">
        <div class="rs-note-bar-track"><div class="rs-note-bar-fill score-bar-${rangeClass}" style="--bar-width:${barWidth}%;transition-delay:${delay}s"></div></div>
      </div>` : ""}
      <p class="rs-note-text">${detail}</p>
    </div>`;
  }).join("\n");

  const total = rights.length || 1;
  const accessPct = Math.round((accessibleCt / total) * 100);
  const overallRange = accessPct >= 80 ? "excellent" : accessPct >= 60 ? "good" : accessPct >= 40 ? "acceptable" : "bad";

  return `<section class="slide" data-title="Data Subject Rights">
  <div class="slide-content">
    <span class="badge reveal">Art. 15-22</span>
    <h2 class="reveal">Data Subject Rights Accessibility</h2>
    ${slideDesc("dataSubjectRights")}
    <div class="rs-layout rs-unified">
      <div class="rs-notes-grid">${noteCards}</div>
      <div class="rs-overall reveal">
        <div class="score-bars">
          <div class="score-bar-row score-bar-overall">
            <div class="score-bar-label"><span class="score-bar-name">Accessible</span></div>
            <div class="score-bar-track"><div class="score-bar-fill score-bar-${overallRange}" style="--bar-width:${accessPct}%;transition-delay:0.35s"></div></div>
            <div class="score-bar-value score-${overallRange}">${accessPct}%</div>
          </div>
        </div>
      </div>
    </div>
    <div class="cm-summary reveal">
      <div class="cm-summary-item"><span class="cm-summary-dot cm-summary-dot-pass"></span> ${accessibleCt} accessible</div>
      <div class="cm-summary-item"><span class="cm-summary-dot cm-summary-dot-fail"></span> ${rights.length - accessibleCt} not found</div>
    </div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildFormLeakage(slideNum, totalSlides) {
  const fl = findings.formLeakage;
  if (!fl || !fl.detected || !(fl.leaks || []).length) return null;

  const fieldIcons = { email: "&#9993;", password: "&#128274;", phone: "&#128222;", name: "&#128100;", address: "&#127968;", search: "&#128269;" };

  const flows = fl.leaks.map((leak) => {
    const fieldLower = (leak.field || "").toLowerCase();
    const icon = Object.entries(fieldIcons).find(([k]) => fieldLower.includes(k));
    const iconHtml = icon ? `<span class="fl-icon">${icon[1]}</span>` : '<span class="fl-icon">&#128196;</span>';
    return `<div class="fl-flow reveal">
      <div class="fl-source">
        ${iconHtml}
        <span class="fl-field">${esc(leak.field)}</span>
      </div>
      <div class="fl-arrow">
        <span class="fl-arrow-line"></span>
        <span class="fl-arrow-head">&#9654;</span>
      </div>
      <div class="fl-dest">
        <span class="fl-dest-domain">${esc(leak.destination)}</span>
      </div>
    </div>`;
  }).join("\n");

  return `<section class="slide" data-title="Form Leakage">
  <div class="slide-content">
    <span class="badge reveal" style="background:rgba(220,38,38,0.1);color:var(--accent-red);">Form Leakage</span>
    <h2 class="reveal">Data Exfiltrated Pre-Submit</h2>
    ${slideDesc("formLeakage")}
    <div class="fl-summary reveal">
      <strong>${fl.leaks.length} field${fl.leaks.length !== 1 ? "s" : ""}</strong> sent to external destinations before the user clicks submit
    </div>
    <div class="fl-flows">${flows}</div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

function buildCustomSlide(slot, slideNum, totalSlides) {
  if (!customSlides || !customSlides[slot]) return null;
  const cs = customSlides[slot];
  // Custom slides get the same chrome as native slides: a short eyebrow (title),
  // an optional big heading, an optional subtitle, then the body. `content` is
  // raw maintainer-authored HTML — it should use the shared component classes
  // (.tracker-grid, .split-compare, .callout, .pill-*) so it reads as native.
  const heading = cs.heading ? `\n    <h2 class="reveal">${esc(cs.heading)}</h2>` : "";
  const subtitle = cs.subtitle ? `\n    <p class="slide-desc reveal">${esc(cs.subtitle)}</p>` : "";
  const bodyClass = cs.style === "finding-highlight"
    ? "custom-body custom-body-highlight reveal"
    : "custom-body reveal";
  return `<section class="slide" data-title="${esc(cs.title)}">
  <div class="slide-content">
    <span class="badge reveal">${esc(cs.title)}</span>${heading}${subtitle}
    <div class="${bodyClass}">${cs.content}</div>
  </div>
  ${watermark()}
  <div class="slide-num">${slideNum} / ${totalSlides}</div>
</section>`;
}

// ───────────────────────────────────────────
// Slide ordering + slot injection
// ───────────────────────────────────────────
const SLOT_AFTER = {
  "after-overview": "beforeAfter",
  "after-consent": "auditTrailPost",
  "after-tracking": "trackers",
  "after-details": "legalPages",
  "before-recommendations": "riskSummary",
};

// Slide ordering: slides.include is an ordering hint, not an allowlist.
// Any builder that returns data is auto-included unless in slides.exclude.
const DEFAULT_ORDER = [
  "title", "tldr", "consent", "darkPatterns", "beforeAfter",
  "auditTrailPre", "auditTrailPost", "auditTrailReject",
  "rejectScenario", "variantComparison",
  "trackers", "cookies", "cookieParty", "cookiePurposeMatching",
  "piggybackingChains", "requestPulse",
  "fingerprinting", "thirdPartyDomains",
  "securityHeaders", "storageAnalysis",
  "legalPages", "privacyPolicy", "dataSubjectRights",
  "gdprCompliance", "tcfConsentMode", "consentRevocation", "formLeakage",
  "riskSummary", "recommendations", "methodology",
];
const explicitOrder = (slides && slides.include) || DEFAULT_ORDER;
const excludeSet = new Set((slides && slides.exclude) || []);

// Canonical slide order — key order defines the natural presentation sequence.
// Auto-appended slides are inserted at the position matching this order.
const builders = {
  title: buildTitle,
  tldr: buildTldr,
  methodology: buildMethodology,
  consent: buildConsent,
  darkPatterns: buildDarkPatterns,
  beforeAfter: buildBeforeAfter,
  auditTrailPre: buildAuditTrailPre,
  fingerprinting: buildFingerprinting,
  fingerprintingTier3Appendix: buildFingerprintingTier3Appendix,
  outOfScopeCaveats: buildOutOfScopeCaveats,
  auditTrailPost: buildAuditTrailPost,
  auditTrailReject: buildAuditTrailReject,
  rejectScenario: buildRejectScenario,
  variantComparison: buildVariantComparison,
  trackers: buildTrackers,
  cookies: buildCookies,
  cookieParty: buildCookieParty,
  cookiePurposeMatching: buildCookiePurposeMatching,
  thirdPartyDomains: buildThirdPartyDomains,
  piggybackingChains: buildPiggybackingChain,
  requestPulse: buildRequestPulse,
  storageAnalysis: buildStorageAnalysis,
  securityHeaders: buildSecurityHeaders,
  consentRevocation: buildConsentRevocation,
  tcfConsentMode: buildTcfConsentMode,
  formLeakage: buildFormLeakage,
  legalPages: buildLegalPages,
  privacyPolicy: buildPrivacyPolicy,
  dataSubjectRights: buildDataSubjectRights,
  dsar: buildDsar,
  processorTransparency: buildProcessorTransparency,
  breachNotification: buildBreachNotification,
  gdprCompliance: buildGdprCompliance,
  riskSummary: buildRiskSummary,
  recommendations: buildRecommendations,
};

// Auto-discover: insert any builder with data not already in explicitOrder or excluded.
// Inserted at the correct position based on the canonical builders key order.
const canonicalOrder = Object.keys(builders);
const slideOrder = [...explicitOrder];
const explicitSet = new Set(explicitOrder);
const autoAppended = [];
for (const type of canonicalOrder) {
  if (!explicitSet.has(type) && !excludeSet.has(type)) {
    // Probe the builder to see if it returns data
    const probe = builders[type](1, 999);
    const hasData = Array.isArray(probe) ? probe.some(Boolean) : !!probe;
    if (hasData) {
      // Find the right insertion point: after the last slide that precedes
      // this one in canonical order, or at the end if none found.
      const canonIdx = canonicalOrder.indexOf(type);
      let insertAt = slideOrder.length; // default: end
      for (let i = slideOrder.length - 1; i >= 0; i--) {
        const existingCanonIdx = canonicalOrder.indexOf(slideOrder[i]);
        if (existingCanonIdx !== -1 && existingCanonIdx < canonIdx) {
          insertAt = i + 1;
          break;
        }
      }
      slideOrder.splice(insertAt, 0, type);
      autoAppended.push(type);
    }
  }
}
// Filter out excluded slides
const finalSlideOrder = slideOrder.filter(t => !excludeSet.has(t));
if (autoAppended.length > 0) {
  console.error(`[generate] Auto-appended slides with data not in slides.include: ${autoAppended.join(", ")}`);
}

// Count total slides (with pagination + custom slots)
function countSlides() {
  let count = 0;
  for (const type of finalSlideOrder) {
    const builder = builders[type];
    if (!builder) continue;
    const result = builder(1, 999);
    if (Array.isArray(result)) count += result.filter(Boolean).length;
    else if (result) count += 1;
    for (const [slot, afterType] of Object.entries(SLOT_AFTER)) {
      if (afterType === type && customSlides && customSlides[slot]) count += 1;
    }
  }
  return count;
}

const totalSlides = countSlides();

function buildAllSlides() {
  const allSlides = [];
  let slideNum = 1;

  for (const type of finalSlideOrder) {
    const builder = builders[type];
    if (!builder) continue;
    const result = builder(slideNum, totalSlides);
    if (Array.isArray(result)) {
      for (const s of result) { if (s) allSlides.push(s); }
      slideNum += result.length;
    } else if (result) {
      allSlides.push(result);
      slideNum += 1;
    }
    for (const [slot, afterType] of Object.entries(SLOT_AFTER)) {
      if (afterType === type) {
        const cs = buildCustomSlide(slot, slideNum, totalSlides);
        if (cs) { allSlides.push(cs); slideNum += 1; }
      }
    }
  }
  return allSlides;
}

// ───────────────────────────────────────────
// CSS + JS extraction from theme markdown
// ───────────────────────────────────────────
function extractBlocks(lang) {
  const themePath = path.join(__dirname, "..", "templates", "presentation-theme.md");
  const theme = fs.readFileSync(themePath, "utf-8");
  const blocks = [];
  const regex = new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "g");
  let match;
  while ((match = regex.exec(theme)) !== null) {
    blocks.push(match[1]);
  }
  let result = blocks.join("\n\n");
  // Remove duplicate @import lines (already in the HTML shell)
  if (lang === "css") {
    result = result.replace(/@import url\([^)]+\);\n?/g, "");
  }
  return result;
}

// ───────────────────────────────────────────
// Assemble final HTML
// ───────────────────────────────────────────
const allSlideHtml = buildAllSlides();
const css = extractBlocks("css");
const js = extractBlocks("js");
const ep = String(meta.episode).padStart(2, "0");

const html = `<!DOCTYPE html>
<html lang="en" data-theme="${meta.theme || "corporate"}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Audit #${ep}: ${esc(meta.domain)}${meta.theme === "datagobes" ? " &mdash; datagobes.dev" : ""}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#x1F512;</text></svg>">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
${css}
    </style>
</head>
<body>

<div class="progress-bar" id="progress"></div>
<nav class="nav-dots" id="navDots"></nav>

${allSlideHtml.join("\n\n")}

<script type="application/json" id="analysis-json">${JSON.stringify(analysis)}</script>
<script>
${js}
</script>
</body>
</html>`;

// ───────────────────────────────────────────
// Generate Markdown report
// ───────────────────────────────────────────
function generateMarkdown() {
  const mr = markdownReport || {};
  // Phase D weights (references/scoring.md). The two newer categories are
  // listed only when scored, with the legacy 7-category weights as fallback
  // so old analyses keep summing to 100%.
  const hasPhaseD = scores.dsar || scores.processorTransparency;
  const categories = hasPhaseD ? [
    { key: "consent", label: "Consent Mechanism", weight: 20 },
    { key: "preConsentTracking", label: "Pre-Consent Tracking", weight: 18 },
    { key: "darkPatterns", label: "Dark Patterns", weight: 15 },
    { key: "legalPages", label: "Legal Pages", weight: 11 },
    { key: "crossBorder", label: "Cross-Border Transfers", weight: 10 },
    { key: "securityHeaders", label: "Security Headers", weight: 9 },
    { key: "cookieManagement", label: "Cookie Management", weight: 7 },
    { key: "processorTransparency", label: "Processor Transparency", weight: 6 },
    { key: "dsar", label: "DSAR / Rights Mechanism", weight: 4 },
  ] : [
    { key: "consent", label: "Consent Mechanism", weight: 25 },
    { key: "preConsentTracking", label: "Pre-Consent Tracking", weight: 20 },
    { key: "legalPages", label: "Legal Pages", weight: 15 },
    { key: "crossBorder", label: "Cross-Border Transfers", weight: 15 },
    { key: "securityHeaders", label: "Security Headers", weight: 10 },
    { key: "cookieManagement", label: "Cookie Management", weight: 10 },
    { key: "darkPatterns", label: "Dark Patterns", weight: 5 },
  ];

  const riskRows = categories.map((cat) => {
    const s = scores[cat.key] || { score: 1.0 };
    return `| ${cat.label} | ${s.score} | ${cat.weight}% |`;
  }).join("\n");

  // Audit-trail evidence tables: timestamps and domains for every recorded
  // event, so the markdown report carries evidence, not just conclusions.
  const trailTable = (events) => {
    if (!Array.isArray(events) || events.length === 0) return null;
    const rows = events.map((ev) =>
      `| ${ev.time || "?"} | ${ev.domain || "—"} | ${ev.title} | ${ev.type || "—"} |`
    ).join("\n");
    return `| Time | Domain | Event | Type |\n|------|--------|-------|------|\n${rows}`;
  };
  const trail = findings.auditTrail || {};
  const trailSections = [
    ["Pre-Consent Timeline", trailTable(trail.preConsent)],
    ["Post-Consent Timeline (after accept)", trailTable(trail.postConsent)],
    ["Post-Reject Timeline", trailTable(trail.rejectConsent)],
  ].filter(([, t]) => t)
   .map(([title, t]) => `### ${title}\n${t}`)
   .join("\n\n");
  const auditTrailSection = trailSections
    ? `## Audit Trail (observed events)\n\nTimes are relative to the first observed request in each phase. Events marked "timing ambiguous" fired while the consent click was being dispatched and cannot be attributed to a consent state with certainty.\n\n${trailSections}\n`
    : "";

  const rs = findings.rejectScenario;
  const rejectSection = rs ? `## Reject Scenario

${rs.rejectHonoured
    ? "No tracker fires or new non-consent cookies were observed after rejecting consent."
    : `Rejection was **not fully honoured** in this scan: ${rs.summary || "see details below."}`}
${(rs.persistingTrackers || []).length ? `
| Tracker persisting after reject | Domain | Category |
|--------------------------------|--------|----------|
${rs.persistingTrackers.map((t) => `| ${t.name}${t.ambiguousTiming ? " *(timing ambiguous)*" : ""} | ${t.domains || t.domain || "—"} | ${t.category || "—"} |`).join("\n")}` : ""}
` : "";

  const trackerRows = (findings.trackers || []).map((t) =>
    `| ${t.name} | ${t.category} | ${t.domains} | ${t.jurisdiction || "Unknown"} | ${t.risk || "medium"} |`
  ).join("\n");

  const cookieRows = (findings.cookies || []).map((c) =>
    `| ${c.name} | ${c.domain} | ${c.duration} | ${c.purpose} | ${c.risk || "medium"} |`
  ).join("\n");

  const headerRows = (findings.securityHeaders || []).map((h) => {
    const st = h.status === "present" ? "Present" : h.status === "missing" ? "Missing" : "Partial";
    return `| ${h.name} | ${st} | ${h.value || "\u2014"} |`;
  }).join("\n");

  const gdprChecklist = (findings.gdprCompliance || []).map((g) =>
    `- [${g.status === "pass" ? "x" : " "}] ${g.article} \u2014 ${g.title}${g.finding ? ` *(${g.finding})*` : ""}`
  ).join("\n");

  const recList = (findings.recommendations || []).map((r, i) =>
    `${i + 1}. **${r.action}** \u2014 ${r.detail}`
  ).join("\n");

  const legalList = (findings.legalPages || []).map((p) =>
    `- ${p.title}: ${p.status === "present" ? `Found${p.url ? ` (${p.url})` : ""}` : "Missing"}`
  ).join("\n");

  const companyLine = meta.company ? `**Prepared for**: ${meta.company}\n` : "";

  return `> **Disclaimer:** This report presents technical observations from an automated external scan. It does not constitute legal advice or a formal compliance assessment. The findings reflect what was observed at the time of scanning and should be interpreted in consultation with qualified legal counsel.

# Privacy Audit Report: ${meta.domain}

**Scan Date**: ${meta.scanDate}
**Overall Score**: ${meta.overallScore}/10
**Scanner**: ${meta.scanner || "glasshouse"} (Firefox via Playwright)
${companyLine}
## Executive Summary

${mr.executiveSummary || "No executive summary provided."}

## Methodology

- Point-in-time scan: the findings reflect the site's behaviour at the scan date above and may not reflect its current behaviour
- Three variants in clean browser sessions: no interaction (ignore), accept-all, and reject-all where available; each captures pre- and post-interaction state
- Browser: Firefox with stealth settings (masked webdriver, realistic UA)
- Categories captured: network requests, cookies, localStorage, sessionStorage, IndexedDB, security headers, TLS, consent mechanisms, fingerprinting API usage, legal pages, meta tags
- Scope limits: public pages only; server-side processing is not observable from the browser; findings are a lower bound on observed processing, not an exhaustive inventory

## Findings

### Consent Mechanism
${mr.consentAnalysis || "See presentation for details."}

### Pre-Consent Activity
${mr.preConsentAnalysis || "See presentation for details."}

### Post-Consent Activity
${mr.postConsentAnalysis || "See presentation for details."}

### Tracking Systems
| Tracker | Category | Domain | Jurisdiction | Risk |
|---------|----------|--------|-------------|------|
${trackerRows}

### Cookie Inventory
| Name | Domain | Expiry | Purpose | Risk |
|------|--------|--------|---------|------|
${cookieRows}

### Storage (localStorage/sessionStorage)
${mr.storageAnalysis || "See scan JSON for details."}

### Security Headers
| Header | Status | Value |
|--------|--------|-------|
${headerRows}

### Legal Pages
${legalList}

${auditTrailSection}${rejectSection}
## GDPR Compliance Checklist

${gdprChecklist}

## Risk Matrix

| Category | Score | Weight |
|----------|-------|--------|
${riskRows}
| **Overall** | **${meta.overallScore}** | 100% |

## Recommendations

${recList}

---

*Generated by glasshouse \u2022 ${meta.scanDate}*
`;
}

// ───────────────────────────────────────────
// Write outputs
// ───────────────────────────────────────────
const domain = meta.domain.replace(/[^a-zA-Z0-9.-]/g, "_");
const htmlPath = path.join(outputDir, `${domain}-privacy-audit${suffix}.html`);
const mdPath = path.join(outputDir, `${domain}-privacy-audit${suffix}.md`);

fs.writeFileSync(htmlPath, html, "utf-8");
fs.writeFileSync(mdPath, generateMarkdown(), "utf-8");

console.log(`HTML: ${htmlPath}`);
console.log(`Markdown: ${mdPath}`);
console.log(`Slides: ${allSlideHtml.length}`);

} // end require.main === module guard

// ───────────────────────────────────────────
// Module exports (available when required as a library, e.g. by tests)
// ───────────────────────────────────────────
module.exports = {
  classifyParty,
  isOptOutCookie,
};
