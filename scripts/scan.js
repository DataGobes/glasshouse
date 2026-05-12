#!/usr/bin/env node
/**
 * Glasshouse — Privacy Scan Engine
 *
 * Standalone Playwright script that performs a two-phase privacy audit:
 *   Phase 1: Load page without interaction — capture pre-consent state
 *   Phase 2: Accept consent banner — capture post-consent delta
 *
 * Usage: node scan.js <url>
 * Output: JSON to /tmp/glasshouse-{domain}-{timestamp}.json
 *
 * Always uses Firefox (Chromium gets blocked by WAFs like Imperva/Cloudflare).
 */

const { firefox } = require("playwright");
const tls = require("tls");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");

// ───────────────────────────────────────────
// Configuration
// ───────────────────────────────────────────
const STEALTH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
const VIEWPORT = { width: 1440, height: 900 };
const PAGE_TIMEOUT = 45_000;
const POST_CONSENT_WAIT = 8_000;
const SCROLL_PAUSE = 1_500;

// ───────────────────────────────────────────
// Consent banner selectors (ordered by prevalence)
// ───────────────────────────────────────────
const CONSENT_SELECTORS = {
  onetrust: {
    banner: "#onetrust-banner-sdk",
    accept: "#onetrust-accept-btn-handler",
    reject: "#onetrust-reject-all-handler",
    name: "OneTrust",
  },
  cookiebot: {
    banner: "#CybotCookiebotDialog",
    accept:
      "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept",
    reject:
      "#CybotCookiebotDialogBodyButtonDecline, #CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll",
    name: "Cookiebot",
  },
  didomi: {
    banner: "#didomi-popup",
    accept: "#didomi-notice-agree-button, .didomi-continue-without-agreeing",
    reject: "#didomi-notice-learn-more-button:first-child", // Often hidden behind 'learn more' or implicit in closing
    name: "Didomi",
  },
  quantcast: {
    banner: ".qc-cmp2-container, #qcCmpUi",
    accept: '[mode="primary"], .qc-cmp2-summary-buttons button:first-child',
    reject: '[mode="secondary"], .qc-cmp2-summary-buttons button:last-child',
    name: "Quantcast Choice",
  },
  cookieyes: {
    banner: ".cky-consent-container",
    accept: ".cky-btn-accept",
    reject: ".cky-btn-reject",
    name: "CookieYes",
  },
  complianz: {
    banner: ".cmplz-cookiebanner",
    accept: ".cmplz-accept",
    reject: ".cmplz-deny",
    name: "Complianz",
  },
  trustarc: {
    banner: "#truste-consent-track, .truste_box_overlay",
    accept: "#truste-consent-button, .pdynamicbutton .call",
    reject: "#truste-consent-required, .pdynamicbutton .decline",
    name: "TrustArc",
  },
  generic: {
    banner: [
      '[class*="cookie-banner"]',
      '[class*="cookie-consent"]',
      '[class*="consent-banner"]',
      '[class*="gdpr"]',
      '[id*="cookie-banner"]',
      '[id*="cookie-consent"]',
      '[id*="consent-banner"]',
      '[id*="gdpr"]',
      '[class*="cookie-notice"]',
      '[id*="cookie-notice"]',
      '[class*="privacy-banner"]',
      '[id*="privacy-banner"]',
      '[class*="CookieBanner"]',
      '[class*="ConsentBanner"]',
    ].join(", "),
    accept: [
      '[class*="accept"]',
      '[class*="agree"]',
      '[class*="allow"]',
      '[data-action="accept"]',
      '[data-consent="accept"]',
      'button[action-type="ACCEPT"]',
      ':is(button, [role="button"]):has-text("Accept All")',
      ':is(button, [role="button"]):has-text("Accept all")',
      ':is(button, [role="button"]):has-text("Accept all cookies")',
      ':is(button, [role="button"]):has-text("Allow all cookies")',
      ':is(button, [role="button"]):has-text("Allow all")',
      ':is(button, [role="button"]):has-text("Akkoord")',
      ':is(button, [role="button"]):has-text("Alles accepteren")',
      ':is(button, [role="button"]):has-text("Alle akzeptieren")',
      ':is(button, [role="button"]):has-text("Tout accepter")',
      ':is(button, [role="button"]):has-text("Accetta tutti")',
      ':is(button, [role="button"]):has-text("Aceptar todo")',
      ':is(button, [role="button"]):has-text("Accept")',
      ':is(button, [role="button"]):has-text("I agree")',
      ':is(button, [role="button"]):has-text("Got it")',
      ':is(button, [role="button"]):has-text("OK")',
    ].join(", "),
    reject: [
      '[class*="reject"]',
      '[class*="decline"]',
      '[class*="deny"]',
      '[data-action="reject"]',
      '[data-consent="reject"]',
      'button[action-type="REJECT"]',
      ':is(button, [role="button"]):has-text("Reject All")',
      ':is(button, [role="button"]):has-text("Reject all")',
      ':is(button, [role="button"]):has-text("Decline All")',
      ':is(button, [role="button"]):has-text("Decline all")',
      ':is(button, [role="button"]):has-text("Weigeren")',
      ':is(button, [role="button"]):has-text("Alles weigeren")',
      ':is(button, [role="button"]):has-text("Alle ablehnen")',
      ':is(button, [role="button"]):has-text("Tout refuser")',
      ':is(button, [role="button"]):has-text("Rifiuta tutti")',
      ':is(button, [role="button"]):has-text("Rechazar todo")',
      ':is(button, [role="button"]):has-text("Reject")',
      ':is(button, [role="button"]):has-text("Decline")',
    ].join(", "),
    name: "Generic/Custom",
  },
};

// ───────────────────────────────────────────
// Cookie wall selectors — full-page redirects to consent domains
//
// Unlike consent banners (overlays on the same domain), cookie walls
// redirect to a separate domain entirely. The scanner lands on the
// wall instead of the target site, capturing zero real data.
// ───────────────────────────────────────────
const COOKIE_WALL_SELECTORS = {
  dpgmedia: {
    name: "DPG Media Privacy Gate",
    domainPattern: /myprivacy\.dpgmedia\.nl/,
    accept: [
      'button:has-text("Akkoord")',
      'button:has-text("Alles accepteren")',
      'button:has-text("Accept all")',
      'button:has-text("Agree")',
      'button[class*="accept"]',
      'button[class*="agree"]',
      '.btn-primary',
      'button[data-testid*="accept"]',
    ].join(", "),
    reject: [
      'button:has-text("Weigeren")',
      'button:has-text("Alles weigeren")',
      'button:has-text("Reject all")',
      'button:has-text("Decline")',
      'button[class*="reject"]',
      'button[class*="decline"]',
    ].join(", "),
    extractReturnUrl: (consentUrl) => {
      try {
        const u = new URL(consentUrl);
        return u.searchParams.get("callbackUrl") || null;
      } catch { return null; }
    },
  },
  generic: {
    name: "Generic Cookie Wall",
    domainPattern: null,
    accept: [
      'button:has-text("Accept All")', 'button:has-text("Accept all")',
      'button:has-text("Akkoord")', 'button:has-text("Alles accepteren")',
      'button:has-text("Alle akzeptieren")', 'button:has-text("Tout accepter")',
      'button:has-text("Accetta tutti")', 'button:has-text("Aceptar todo")',
      'button:has-text("I agree")', 'button:has-text("Accept")',
      'button[class*="accept"]', 'button[class*="agree"]',
    ].join(", "),
    reject: [
      'button:has-text("Reject All")', 'button:has-text("Reject all")',
      'button:has-text("Weigeren")', 'button:has-text("Alles weigeren")',
      'button:has-text("Alle ablehnen")', 'button:has-text("Tout refuser")',
      'button:has-text("Rifiuta tutti")', 'button:has-text("Rechazar todo")',
      'button:has-text("Decline")', 'button:has-text("Reject")',
      'button[class*="reject"]', 'button[class*="decline"]',
    ].join(", "),
    extractReturnUrl: (consentUrl) => {
      try {
        const u = new URL(consentUrl);
        for (const p of ["callbackUrl", "returnUrl", "redirect_uri", "redirect", "next"]) {
          const v = u.searchParams.get(p);
          if (v && (v.startsWith("http") || v.startsWith("/"))) return v;
        }
      } catch { }
      return null;
    },
  },
};

// ───────────────────────────────────────────
// Multi-layer banner traversal
//
// Many CMPs (and walls like DPG Media's Privacy Gate) only expose
// "Accept" + "Settings" on layer 1 — the reject path requires opening
// layer 2. Layer 2 may have a direct "Reject all" button (quick path)
// or only per-category toggles that have to be unchecked before saving
// (deep path). These selectors and helpers are shared between
// bypassCookieWall and the same-domain reject-click path.
// ───────────────────────────────────────────
const MULTILAYER_SELECTORS = {
  // Buttons that OPEN layer 2 (settings / manage / customize).
  // i18n labels first (most reliable), structural fallbacks last.
  settings: [
    // English
    'button:has-text("Manage settings")',
    'button:has-text("Manage preferences")',
    'button:has-text("Manage your choices")',
    'button:has-text("Manage cookies")',
    'button:has-text("Cookie settings")',
    'button:has-text("Customize")',
    'button:has-text("Customise")',
    'button:has-text("Show purposes")',
    'button:has-text("Show details")',
    'button:has-text("More options")',
    'button:has-text("Preferences")',
    // Dutch
    'button:has-text("Instellen")',
    'button:has-text("Instellingen")',
    'button:has-text("Aanpassen")',
    'button:has-text("Voorkeuren")',
    'button:has-text("Meer opties")',
    // German
    'button:has-text("Einstellungen")',
    'button:has-text("Anpassen")',
    'button:has-text("Einstellungen verwalten")',
    'button:has-text("Mehr Optionen")',
    // French
    'button:has-text("Personnaliser")',
    'button:has-text("Paramètres")',
    'button:has-text("Gérer mes choix")',
    'button:has-text("Plus d\'options")',
    // Spanish / Portuguese
    'button:has-text("Configurar")',
    'button:has-text("Personalizar")',
    'button:has-text("Preferencias")',
    'button:has-text("Gestionar")',
    // Italian
    'button:has-text("Personalizza")',
    'button:has-text("Impostazioni")',
    'button:has-text("Gestisci")',
    // Nordic
    'button:has-text("Tilpas")',
    'button:has-text("Inställningar")',
    'button:has-text("Mer information")',
    // Structural fallbacks
    'button[class*="settings"]',
    'button[class*="manage"]',
    'button[class*="customize"]',
    'button[id*="settings"]',
    'button[id*="manage"]',
    'a[class*="settings"]',
    'a[class*="manage"]',
  ],
  // Direct reject on layer 2 (the quick path — most major CMPs have this).
  layer2Reject: [
    // English
    'button:has-text("Reject All")', 'button:has-text("Reject all")',
    'button:has-text("Refuse all")', 'button:has-text("Decline all")',
    'button:has-text("Reject non-essential")',
    'button:has-text("Continue without accepting")',
    'button:has-text("Save without consent")',
    // Dutch
    'button:has-text("Alles weigeren")', 'button:has-text("Weigeren")',
    'button:has-text("Alles afwijzen")', 'button:has-text("Afwijzen")',
    // German
    'button:has-text("Alle ablehnen")', 'button:has-text("Ablehnen")',
    'button:has-text("Alles ablehnen")',
    // French
    'button:has-text("Tout refuser")', 'button:has-text("Refuser tout")',
    'button:has-text("Continuer sans accepter")',
    // Spanish / Portuguese
    'button:has-text("Rechazar todo")', 'button:has-text("Rechazar")',
    'button:has-text("Rejeitar tudo")',
    // Italian
    'button:has-text("Rifiuta tutti")', 'button:has-text("Rifiuta tutto")',
    // Nordic
    'button:has-text("Afvis alle")', 'button:has-text("Avvisa alla")',
    // Structural fallbacks
    'button[class*="reject"]',
    'button[class*="refuse"]',
    'button[class*="decline"]',
  ],
  // Save button on layer 2 (the deep path — click after unchecking toggles).
  layer2Save: [
    // English
    'button:has-text("Save preferences")',
    'button:has-text("Save settings")',
    'button:has-text("Save and exit")',
    'button:has-text("Save choices")',
    'button:has-text("Confirm choices")',
    'button:has-text("Confirm my choices")',
    'button:has-text("Confirm")',
    'button:has-text("Save")',
    'button:has-text("Apply")',
    // Dutch
    'button:has-text("Opslaan")',
    'button:has-text("Bevestig keuze")',
    'button:has-text("Bevestigen")',
    'button:has-text("Mijn keuzes opslaan")',
    // German
    'button:has-text("Speichern")',
    'button:has-text("Auswahl bestätigen")',
    'button:has-text("Bestätigen")',
    // French
    'button:has-text("Enregistrer")',
    'button:has-text("Confirmer mes choix")',
    'button:has-text("Valider")',
    // Spanish / Portuguese
    'button:has-text("Guardar")',
    'button:has-text("Guardar preferencias")',
    'button:has-text("Confirmar")',
    // Italian
    'button:has-text("Salva preferenze")',
    'button:has-text("Conferma")',
    // Structural fallbacks (avoid generic .btn-primary — too lossy)
    'button[class*="save"]',
    'button[class*="confirm"]',
  ],
};

// Keywords that mark a toggle as essential / always-on / locked.
// The deep path must NEVER uncheck these — doing so either causes the
// save to fail or leaves the CMP in a broken state. If you add a locale,
// add both the long form ("strictly necessary") and the short form ("necessary").
const ESSENTIAL_TOGGLE_KEYWORDS = /\b(strictly\s+necessary|essential|necessary|required|always\s+(on|active)|technical|noodzakelijk|verplicht|essentiel|essentiell|notwendig|erforderlich|technisch|esencial|necesario|essenziali|tecnici|funcional)\b/i;

// Check if any layer-2 reject OR save button is visible right now.
// Used both as a success signal after clicking a settings button, and
// as the entry condition for the deep-path toggle flow.
async function findVisibleLayer2RejectOrSave(page) {
  for (const sel of MULTILAYER_SELECTORS.layer2Reject) {
    const btn = await page.$(sel).catch(() => null);
    if (btn && await btn.isVisible().catch(() => false)) {
      return { type: "reject", selector: sel };
    }
  }
  for (const sel of MULTILAYER_SELECTORS.layer2Save) {
    const btn = await page.$(sel).catch(() => null);
    if (btn && await btn.isVisible().catch(() => false)) {
      return { type: "save", selector: sel };
    }
  }
  return null;
}

// Open layer 2 by clicking a settings-style button. Validates success by
// confirming a layer-2 reject or save button became visible after the
// click — not by measuring text deltas (which were too brittle for
// banners where layer-2 content overlaps layer-1 content in size).
async function openLayer2(page) {
  // If a layer-2 reject/save is already visible, we don't need to open anything.
  const preexisting = await findVisibleLayer2RejectOrSave(page);
  if (preexisting) return { opened: true, selector: "(layer-2 already visible)", preexisting: true };

  let candidatesChecked = 0;
  let candidatesFound = 0;
  for (const sel of MULTILAYER_SELECTORS.settings) {
    candidatesChecked++;
    let btn;
    try {
      btn = await page.$(sel);
    } catch (err) {
      if (process.env.GLASSHOUSE_DEBUG) console.error(`[openLayer2] selector error ${sel}: ${err.message}`);
      continue;
    }
    if (!btn) continue;
    candidatesFound++;
    const visible = await btn.isVisible().catch(() => false);
    if (process.env.GLASSHOUSE_DEBUG) console.error(`[openLayer2] candidate ${sel} → visible=${visible}`);
    if (!visible) continue;

    try {
      await btn.click({ timeout: 5000 });
    } catch {
      continue;
    }
    await page.waitForTimeout(1500);

    const layer2 = await findVisibleLayer2RejectOrSave(page);
    if (process.env.GLASSHOUSE_DEBUG) console.error(`[openLayer2] post-click via ${sel} → layer2=${JSON.stringify(layer2)}`);
    if (layer2) {
      return { opened: true, selector: sel, layer2Hint: layer2 };
    }
    // No layer-2 reject/save appeared. The click went somewhere we don't
    // want (footer link, account page). Best-effort: continue to next candidate.
    // Doing more would require state restoration we can't reliably provide.
  }
  if (process.env.GLASSHOUSE_DEBUG) console.error(`[openLayer2] no opener clicked. checked=${candidatesChecked} found=${candidatesFound}`);
  return { opened: false };
}

// Reject on layer 2. Quick path first (direct reject button), then deep
// path (uncheck non-essential toggles + save). Returns the method used
// so callers can surface it in the multiLayer signal.
async function rejectOnLayer2(page) {
  // Quick path: direct reject button on layer 2
  for (const sel of MULTILAYER_SELECTORS.layer2Reject) {
    let btn;
    try {
      btn = await page.$(sel);
    } catch {
      continue;
    }
    if (!btn) continue;
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) continue;
    try {
      await btn.click({ timeout: 5000 });
      return { rejected: true, method: "layer2-direct-reject" };
    } catch {
      continue;
    }
  }

  // Deep path: uncheck non-essential toggles, then save
  const toggleResult = await page.evaluate((essentialPattern) => {
    const essentialRe = new RegExp(essentialPattern, "i");
    const toggles = Array.from(document.querySelectorAll('input[type="checkbox"], [role="switch"]'));
    let toggleCount = 0;
    let togglesUnchecked = 0;
    for (const t of toggles) {
      // Skip if hidden
      const style = window.getComputedStyle(t);
      if (style.display === "none" || style.visibility === "hidden") continue;
      toggleCount++;

      // Pull label text from any plausible source
      const label = (
        (t.labels && t.labels[0] && t.labels[0].textContent) ||
        t.getAttribute("aria-label") ||
        (t.closest("label, [class*='row'], [class*='item'], [class*='purpose'], [class*='category']")?.textContent) ||
        ""
      ).trim();

      // Skip essential / always-on toggles — never uncheck these
      if (essentialRe.test(label)) continue;

      // Skip disabled / locked toggles
      if (t.disabled || t.getAttribute("aria-disabled") === "true") continue;

      const checked = t.checked || t.getAttribute("aria-checked") === "true";
      if (!checked) continue;

      try {
        t.click();
        togglesUnchecked++;
      } catch { /* ignore individual toggle failures */ }
    }
    return { toggleCount, togglesUnchecked };
  }, ESSENTIAL_TOGGLE_KEYWORDS.source).catch(() => ({ toggleCount: 0, togglesUnchecked: 0 }));

  if (toggleResult.toggleCount === 0) {
    return { rejected: false, method: "no-reject-and-no-toggles" };
  }

  // Click save (works whether or not we unchecked anything — some sites
  // default toggles to off and just need "Save preferences").
  for (const sel of MULTILAYER_SELECTORS.layer2Save) {
    let btn;
    try {
      btn = await page.$(sel);
    } catch {
      continue;
    }
    if (!btn) continue;
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) continue;
    try {
      await btn.click({ timeout: 5000 });
      return {
        rejected: true,
        method: "layer2-toggle-save",
        toggleCount: toggleResult.toggleCount,
        togglesUnchecked: toggleResult.togglesUnchecked,
      };
    } catch {
      continue;
    }
  }
  return { rejected: false, method: "save-button-not-found" };
}

// ───────────────────────────────────────────
// Known tracker patterns — split into SDK loads vs active tracking
//
// KEY DISTINCTION:
//   "sdk" = loading a script library (e.g., fbevents.js, gtm.js)
//           This is NOT tracking by itself — the script must fire events.
//   "event" = actual data collection (pixels, beacons, collect endpoints)
//           This IS tracking — data leaves the browser to a third party.
//
// Only "event" patterns count as pre-consent violations.
// "sdk" loads are noted but scored separately (they enable tracking
// but don't constitute it until they fire).
// ───────────────────────────────────────────

// SDK/script loads — loading the library, not firing events
const SDK_PATTERNS = [
  { pattern: /googletagmanager\.com\/gtm\.js/, name: "Google Tag Manager", category: "tag-manager" },
  { pattern: /googletagmanager\.com\/gtag\/js/, name: "Google Analytics (gtag.js)", category: "analytics" },
  { pattern: /connect\.facebook\.net\/.*\/fbevents\.js/, name: "Meta Pixel SDK", category: "tracking" },
  { pattern: /connect\.facebook\.net\/.*\/sdk\.js/, name: "Meta SDK", category: "tracking" },
  { pattern: /bat\.bing\.com\/bat\.js/, name: "Microsoft UET SDK", category: "tracking" },
  { pattern: /bat\.bing\.com\/p\/action\/.*\.js/, name: "Microsoft UET Action Script", category: "tracking" },
  { pattern: /bat\.bing\.com\/p\/insights\//, name: "Microsoft UET Insights Module", category: "tracking" },
  { pattern: /cdn\.optimizely\.com\/js\/.*\.js/, name: "Optimizely SDK", category: "testing" },
  { pattern: /cdn\.optimizely\.com\/public\/.*\.js/, name: "Optimizely SDK", category: "testing" },
  { pattern: /snap\.licdn\.com\/li\.lms-analytics\/insight\.min\.js/, name: "LinkedIn Insight SDK", category: "tracking" },
  { pattern: /static\.hotjar\.com\/c\/hotjar-/, name: "Hotjar SDK", category: "analytics" },
  { pattern: /clarity\.ms\/tag\//, name: "Microsoft Clarity SDK", category: "analytics" },
  { pattern: /cdn\.segment\.com\/analytics\.js/, name: "Segment SDK", category: "analytics" },
  { pattern: /cdn\.amplitude\.com\//, name: "Amplitude SDK", category: "analytics" },
  { pattern: /js\.hs-analytics\.net\//, name: "HubSpot SDK", category: "analytics" },
  { pattern: /widget\.intercom\.io\//, name: "Intercom SDK", category: "analytics" },
  { pattern: /googlesyndication\.com\/tag\/js\/gpt\.js/, name: "Google Publisher Tag SDK", category: "advertising" },
  { pattern: /googlesyndication\.com\/pagead\/managed\/js\/gpt\/.*\/pubads_impl/, name: "Google Publisher Tag Impl", category: "advertising" },
  { pattern: /cdn\.cookielaw\.org\//, name: "OneTrust CMP", category: "consent" },
  { pattern: /geolocation\.onetrust\.com/, name: "OneTrust Geolocation", category: "consent" },
  { pattern: /privacyportal.*\.onetrust\.com/, name: "OneTrust Portal", category: "consent" },
];

// Active tracking — actual data collection, pixel fires, beacons
const TRACKER_PATTERNS = [
  // Google Analytics — collect endpoints (actual data transmission)
  { pattern: /google-analytics\.com\/collect/, category: "analytics", name: "Google Analytics (collect)" },
  { pattern: /google-analytics\.com\/g\/collect/, category: "analytics", name: "Google Analytics 4 (collect)" },
  { pattern: /analytics\.google\.com\/g\/collect/, category: "analytics", name: "Google Analytics 4 (collect)" },
  { pattern: /googletagmanager\.com\/a\?/, category: "analytics", name: "GTM Event" },
  // Google Ads — conversion/remarketing endpoints
  { pattern: /googleads\.g\.doubleclick\.net\/pagead/, category: "advertising", name: "Google Ads" },
  { pattern: /ad\.doubleclick\.net/, category: "advertising", name: "DoubleClick Ad" },
  { pattern: /adservice\.google\.com/, category: "advertising", name: "Google Ad Service" },
  { pattern: /googlesyndication\.com\/pagead\/(?!managed\/js\/)/, category: "advertising", name: "Google Syndication" },
  { pattern: /googlesyndication\.com\/safeframe/, category: "advertising", name: "Google Syndication SafeFrame" },
  { pattern: /googleadservices\.com\/pagead\/conversion/, category: "advertising", name: "Google Ads Conversion" },
  { pattern: /www\.google\.com\/ads\/ga-audiences/, category: "advertising", name: "Google Ads Audiences" },
  { pattern: /pagead\/landing/, category: "advertising", name: "Google Ads Landing" },
  // Meta — pixel fires (the /tr? endpoint is the actual tracking call)
  { pattern: /facebook\.com\/tr[\/?]/, category: "tracking", name: "Meta Pixel Fire" },
  { pattern: /facebook\.com\/ajax\/bz/, category: "tracking", name: "Meta Beacon" },
  // Microsoft UET — actual beacon/event calls (not the SDK script or module loads)
  { pattern: /bat\.bing\.com\/action\/0\?/, category: "tracking", name: "Microsoft UET Event" },
  { pattern: /bat\.bing\.com\/actionp\/0\?/, category: "tracking", name: "Microsoft UET Event" },
  // Optimizely — event logging (not SDK load)
  { pattern: /logx\.optimizely\.com/, category: "testing", name: "Optimizely Event Log" },
  // LinkedIn — actual pixel fire
  { pattern: /linkedin\.com\/px/, category: "tracking", name: "LinkedIn Pixel" },
  { pattern: /px\.ads\.linkedin\.com/, category: "tracking", name: "LinkedIn Ads Pixel" },
  // TikTok
  { pattern: /analytics\.tiktok\.com/, category: "tracking", name: "TikTok Pixel" },
  // Pinterest
  { pattern: /pinterest\.com\/ct/, category: "tracking", name: "Pinterest Tag" },
  // Twitter/X
  { pattern: /twitter\.com\/i\/adsct/, category: "tracking", name: "X/Twitter Pixel" },
  { pattern: /t\.co\/i\//, category: "tracking", name: "X/Twitter Pixel" },
  // Hotjar — event recording endpoints
  { pattern: /hotjar\.com.*\.json/, category: "analytics", name: "Hotjar Event" },
  { pattern: /hotjar\.io\/api/, category: "analytics", name: "Hotjar API" },
  // Clarity — data collection
  { pattern: /clarity\.ms\/collect/, category: "analytics", name: "Clarity Collect" },
  // Segment — API calls
  { pattern: /api\.segment\.io/, category: "analytics", name: "Segment Event" },
  // Amplitude — event API
  { pattern: /api\.amplitude\.com/, category: "analytics", name: "Amplitude Event" },
  // Mixpanel
  { pattern: /api\.mixpanel\.com/, category: "analytics", name: "Mixpanel Event" },
  { pattern: /mixpanel\.com\/track/, category: "analytics", name: "Mixpanel Track" },
  // HubSpot — analytics collection
  { pattern: /forms\.hubspot\.com/, category: "analytics", name: "HubSpot Form" },
  { pattern: /hubspot\.com\/__ptq/, category: "analytics", name: "HubSpot Track" },
  // FullStory
  { pattern: /fullstory\.com\/s\/fs\.js/, category: "analytics", name: "FullStory" },
  { pattern: /rs\.fullstory\.com/, category: "analytics", name: "FullStory Record" },
  // Mouseflow
  { pattern: /mouseflow\.com\/projects/, category: "analytics", name: "Mouseflow Record" },
  // Crazy Egg
  { pattern: /crazyegg\.com\/pages\/scripts/, category: "analytics", name: "Crazy Egg" },
  // Sentry — error monitoring (not really tracking, but third-party data)
  { pattern: /sentry\.io\/api\//, category: "monitoring", name: "Sentry" },
  // New Relic
  { pattern: /nr-data\.net/, category: "monitoring", name: "New Relic" },
  { pattern: /newrelic\.com\/.*beacon/, category: "monitoring", name: "New Relic Beacon" },
  // Cloudflare Analytics
  { pattern: /cloudflareinsights\.com\/beacon/, category: "analytics", name: "Cloudflare Analytics" },
  // Privacy-friendly analytics (still third-party, but less invasive)
  { pattern: /plausible\.io\/api/, category: "analytics", name: "Plausible (privacy-friendly)" },
  // Ad networks
  { pattern: /adnxs\.com/, category: "advertising", name: "AppNexus/Xandr" },
  { pattern: /criteo\.com\/event/, category: "advertising", name: "Criteo" },
  { pattern: /criteo\.net/, category: "advertising", name: "Criteo" },
  { pattern: /taboola\.com\/log/, category: "advertising", name: "Taboola" },
  { pattern: /outbrain\.com\//, category: "advertising", name: "Outbrain" },
  { pattern: /quantserve\.com\/pixel/, category: "analytics", name: "Quantcast Measure" },
  // Adobe
  { pattern: /demdex\.net/, category: "tracking", name: "Adobe Audience Manager" },
  { pattern: /omtrdc\.net/, category: "tracking", name: "Adobe Analytics" },
];

// ───────────────────────────────────────────
// Main scan function
// ───────────────────────────────────────────
// ───────────────────────────────────────────
// Scout mode: lightweight page load for banner detection only
// ───────────────────────────────────────────
async function scout(targetUrl) {
  const url = new URL(targetUrl);
  const domain = url.hostname.replace(/^www\./, "");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const result = {
    scoutResult: true,
    url: targetUrl,
    domain,
    screenshot: null,
    cmpDetected: null,
    bannerDetected: false,
    acceptButtonFound: false,
    rejectButtonFound: false,
    candidateButtons: [],
    recommendHints: false,
    suggestedAcceptText: null,
    suggestedRejectText: null,
  };

  console.error(`[Scout] Starting lightweight scan of ${targetUrl}...`);

  const browser = await firefox.launch({
    headless: true,
    firefoxUserPrefs: {
      "privacy.trackingprotection.enabled": false,
      "network.cookie.cookieBehavior": 0,
      "dom.webdriver.enabled": false,
    },
  });

  try {
    const context = await browser.newContext({
      userAgent: STEALTH_UA,
      viewport: VIEWPORT,
      locale: "en-NL",
      timezoneId: "Europe/Amsterdam",
      extraHTTPHeaders: {
        "Accept-Language": "en-GB,en;q=0.9,nl;q=0.8",
        "Sec-GPC": "1",
      },
      ignoreHTTPSErrors: true,
    });

    await context.clearCookies();
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      delete window.__playwright;
      delete window.__pw_manual;
    });

    const page = await context.newPage();

    // Navigate and wait for the page to settle
    console.error("[Scout] Loading page...");
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
    // Wait for banner to appear (most CMPs render within 3s)
    await page.waitForTimeout(4000);

    // Take viewport screenshot
    const screenshotPath = `/tmp/privacy-scout-${domain}-viewport.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    result.screenshot = screenshotPath;
    console.error(`[Scout] Screenshot saved: ${screenshotPath}`);

    // Run CMP detection (reuse detectConsent)
    const consentInfo = await detectConsent(page, {});
    result.cmpDetected = consentInfo.platform || null;
    result.bannerDetected = consentInfo.detected;
    result.acceptButtonFound = !!consentInfo.acceptButton;
    result.rejectButtonFound = !!consentInfo.rejectButton;

    // Enumerate all candidate buttons in the banner area
    const candidates = await page.evaluate(() => {
      const consentKeywords = /\b(cookie|cookies|privacy|consent|tracking|data protection|akkoord|accepteren|weigeren)\b/i;
      const bannerSelectors = [
        '#onetrust-banner-sdk', '#CybotCookiebotDialog', '#didomi-popup',
        '.qc-cmp2-container', '.cky-consent-container', '.cmplz-cookiebanner',
        '#truste-consent-track',
      ];

      // Find the banner element
      let bannerEl = null;
      for (const sel of bannerSelectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
          bannerEl = el;
          break;
        }
      }

      // Fallback: find fixed/sticky/absolute positioned consent containers
      if (!bannerEl) {
        const allElements = document.querySelectorAll('div, dialog, section, aside');
        for (const el of allElements) {
          if (el.offsetWidth === 0 || el.offsetHeight === 0) continue;
          const style = window.getComputedStyle(el);
          if (style.position !== 'fixed' && style.position !== 'sticky' && style.position !== 'absolute') continue;
          const text = el.textContent || '';
          if (text.match(consentKeywords) && text.length < 5000) {
            bannerEl = el;
            break;
          }
        }
      }

      if (!bannerEl) return [];

      const buttons = bannerEl.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]');
      const results = [];
      for (const btn of buttons) {
        const text = (btn.textContent || btn.value || '').trim();
        if (!text || text.length > 100) continue;
        const visible = btn.offsetWidth > 0 && btn.offsetHeight > 0;
        let selector = '';
        if (btn.id) selector = `#${btn.id}`;
        else if (btn.className && typeof btn.className === 'string') {
          selector = `${btn.tagName.toLowerCase()}.${btn.className.split(/\s+/).filter(c => c && !c.includes(':')).join('.')}`;
        }
        results.push({ text, selector, visible });
      }
      return results;
    });

    result.candidateButtons = candidates;

    // Determine if hints are recommended
    if (result.bannerDetected && (!result.acceptButtonFound || !result.rejectButtonFound)) {
      result.recommendHints = true;
    }
    if (!result.bannerDetected && candidates.length > 0) {
      // Banner wasn't detected by CMP selectors but we found candidate buttons
      result.bannerDetected = true;
      result.recommendHints = true;
    }

    // Suggest accept/reject text from candidates
    const acceptPatterns = /^(accept|agree|allow|ok|got it|i agree|akkoord|alles accepteren|alle akzeptieren|tout accepter|accept all|accept cookies|allow all|allow all cookies|accept all cookies|allow essential and optional cookies)$/i;
    const rejectPatterns = /^(reject|decline|deny|weigeren|alles weigeren|alle ablehnen|tout refuser|reject all|decline all|alleen noodzakelijke)$/i;
    const savePatterns = /^(save|opslaan|save preferences|save settings|bewaar|save my choices)$/i;

    for (const btn of candidates) {
      if (!btn.visible) continue;
      if (!result.suggestedAcceptText && btn.text.match(acceptPatterns)) {
        result.suggestedAcceptText = btn.text;
      }
      if (!result.suggestedRejectText && btn.text.match(rejectPatterns)) {
        result.suggestedRejectText = btn.text;
      }
      if (!result.suggestedRejectText && btn.text.match(savePatterns)) {
        result.suggestedRejectText = btn.text; // save with defaults off = reject
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }

  console.error(`[Scout] Done. Banner: ${result.bannerDetected}, CMP: ${result.cmpDetected || 'none'}, Hints needed: ${result.recommendHints}`);
  return result;
}

async function scan(targetUrl, buttonHints = {}) {
  const url = new URL(targetUrl);
  const domain = url.hostname.replace(/^www\./, "");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const result = {
    meta: {
      schemaVersion: "1",
      url: targetUrl,
      domain,
      scannedAt: new Date().toISOString(),
      scanner: "glasshouse/2.1",
      browser: "Firefox (Playwright)",
      phases: ["pre-consent", "post-consent"], // Keep for legacy scripts, but variants is what matters now
      variants: ["ignore", "accept", "reject"],
      cleanSession: true, // Fresh context per variant
    },
    tls: null,
    // We store the run results for each variant here.
    // Each variant will have: preConsent, postConsent, errors, consent, cookieWall, etc.
    variants: {
      ignore: null,
      accept: null,
      reject: null,
    },
    // The following top-level fields will be populated from the 'ignore' run (the baseline)
    consent: null,
    cookieWall: null,
    legalPages: [],
    metaTags: {},
    securityHeaders: {},
    errors: [],
  };

  // ─── TLS Info ───
  try {
    result.tls = await getTlsInfo(url.hostname, url.port || 443);
  } catch (err) {
    result.errors.push({ phase: "tls", error: err.message });
  }

  // Define the variants to run
  const variantsToRun = ["ignore", "accept", "reject"];

  // ─── Browser Session ───
  const browser = await firefox.launch({
    headless: true,
    firefoxUserPrefs: {
      "privacy.trackingprotection.enabled": false,
      "network.cookie.cookieBehavior": 0,
      "dom.webdriver.enabled": false,
    },
  });

  // Run each variant sequentially — each in its own try/catch so one failure doesn't kill the rest
  for (const variant of variantsToRun) {
    console.error(`\n=========================================`);
    console.error(`[Variant: ${variant.toUpperCase()}] Starting scan phase...`);
    console.error(`=========================================`);

    let context;
    try {
      const variantResult = {
        preConsent: null,
        postConsent: null,
        errors: [],
        consent: null,
        cookieWall: null,
        legalPages: [],
        metaTags: {},
        securityHeaders: {},
      };

      // Fresh context = clean session (no cookies, no storage, no cache)
      // This is equivalent to a brand-new incognito window for EVERY variant

      context = await browser.newContext({
        userAgent: STEALTH_UA,
        viewport: VIEWPORT,
        locale: "en-NL",
        timezoneId: "Europe/Amsterdam",
        extraHTTPHeaders: {
          "Accept-Language": "en-GB,en;q=0.9,nl;q=0.8",
          "Sec-GPC": "1",
        },
        ignoreHTTPSErrors: true,
      });

      // Belt-and-suspenders: explicitly clear any inherited state
      await context.clearCookies();

      // Mask webdriver + inject GPC signal + fingerprinting hooks
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
        // Remove Playwright-specific properties
        delete window.__playwright;
        delete window.__pw_manual;

        // ─── GPC Signal ───
        // Expose navigator.globalPrivacyControl = true and track if site reads it
        window.__gpcAccessed = false;
        Object.defineProperty(navigator, "globalPrivacyControl", {
          get: () => { window.__gpcAccessed = true; return true; },
          configurable: true,
        });

        // ─── Fingerprinting Detection ───
        // Wrap browser APIs commonly used for fingerprinting.
        // Each wrapper calls the original, logs the call, and returns the unmodified result.
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

        // Canvas fingerprinting
        // Only flag reads from small (≤16px) or hidden canvases — fingerprint canvases are tiny,
        // while legitimate rendering uses full-size visible canvases.
        try {
          const canvasMeta = new WeakMap();
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
            return m.textOnly && !canvas.isConnected;
          };
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
          // Text operations: ensure meta exists so isTextOnlyHidden can fire
          const wrapTextOp = (proto, methodName) => {
            if (!proto[methodName]) return;
            const orig = proto[methodName];
            proto[methodName] = function (...args) {
              try { getMeta(this.canvas); } catch { }
              return orig.apply(this, args);
            };
          };
          wrapTextOp(CanvasRenderingContext2D.prototype, "fillText");
          wrapTextOp(CanvasRenderingContext2D.prototype, "strokeText");
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

        // OffscreenCanvas + Worker postMessage fingerprinting
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

        // WebGL fingerprinting
        // Only flag calls that read hardware-identifying parameters (VENDOR, RENDERER,
        // UNMASKED_VENDOR_WEBGL, UNMASKED_RENDERER_WEBGL) or request the debug renderer
        // extension. Legitimate rendering calls getParameter/getExtension constantly for
        // texture setup, capability checks, etc. — those are not fingerprinting.
        try {
          const HARDWARE_PARAMS = new Set([
            0x1F00, // VENDOR
            0x1F01, // RENDERER
            0x9245, // UNMASKED_VENDOR_WEBGL (via WEBGL_debug_renderer_info)
            0x9246, // UNMASKED_RENDERER_WEBGL (via WEBGL_debug_renderer_info)
          ]);
          const wrapGL = (proto, name) => {
            const origGetParam = proto.getParameter;
            proto.getParameter = function (param, ...rest) {
              if (HARDWARE_PARAMS.has(param)) logFP(name, "getParameter", TIER1);
              return origGetParam.apply(this, [param, ...rest]);
            };
            const origGetExt = proto.getExtension;
            proto.getExtension = function (extName, ...rest) {
              if (typeof extName === "string" && extName.toLowerCase().includes("debug_renderer_info")) {
                logFP(name, "getExtension(WEBGL_debug_renderer_info)", TIER1);
              }
              return origGetExt.apply(this, [extName, ...rest]);
            };
            const origGetShaderPrecisionFormat = proto.getShaderPrecisionFormat;
            if (origGetShaderPrecisionFormat) {
              proto.getShaderPrecisionFormat = function (...rest) {
                logFP(name, "getShaderPrecisionFormat", TIER1);
                return origGetShaderPrecisionFormat.apply(this, rest);
              };
            }
          };
          if (typeof WebGLRenderingContext !== "undefined") wrapGL(WebGLRenderingContext.prototype, "WebGL");
          if (typeof WebGL2RenderingContext !== "undefined") wrapGL(WebGL2RenderingContext.prototype, "WebGL2");
        } catch { }

        // WebGPU fingerprinting
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

        // AudioContext fingerprinting
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
          // Track AnalyserNode + ScriptProcessor created from the same AudioContext;
          // only flag when both appear (the FP graph pattern).
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

        // Battery API
        try {
          if (navigator.getBattery) {
            const origGetBattery = navigator.getBattery.bind(navigator);
            navigator.getBattery = function () {
              logFP("Battery", "getBattery", TIER1);
              return origGetBattery();
            };
          }
        } catch { }

        // Font enumeration fingerprinting
        // Fingerprinting scripts probe hundreds of system font names in sequence.
        // Legitimate font-load checks are 1-3 calls (checking if a web font is ready).
        // Only flag after >20 calls — that volume indicates system font enumeration.
        try {
          if (document.fonts && document.fonts.check) {
            let fontCheckCount = 0;
            const FONT_FP_THRESHOLD = 20;
            const origCheck = document.fonts.check.bind(document.fonts);
            document.fonts.check = function (...args) {
              fontCheckCount++;
              if (fontCheckCount === FONT_FP_THRESHOLD) {
                logFP("Fonts", "check (system font enumeration)", TIER1);
              }
              return origCheck(...args);
            };
          }
        } catch { }

        // WebRTC IP leak
        // RTCPeerConnection with STUN servers reveals the real IP address even behind VPNs.
        // Fingerprinting/ad-fraud SDKs use this to de-anonymize users. Flag any construction
        // pre-consent — legitimate video-call features only activate after user interaction.
        try {
          if (typeof RTCPeerConnection !== "undefined") {
            const OrigRTC = RTCPeerConnection;
            window.RTCPeerConnection = function (...args) {
              logFP("WebRTC", "RTCPeerConnection", TIER1);
              return new OrigRTC(...args);
            };
            window.RTCPeerConnection.prototype = OrigRTC.prototype;
            Object.setPrototypeOf(window.RTCPeerConnection, OrigRTC);
          }
        } catch { }

        // Media device enumeration
        // enumerateDevices() lists available cameras/microphones by label and deviceId.
        // The resulting list is device-unique and stable — a reliable fingerprint vector.
        // No legitimate reason to call this without explicit user interaction.
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            const origEnum = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
            navigator.mediaDevices.enumerateDevices = function (...args) {
              logFP("MediaDevices", "enumerateDevices", TIER1);
              return origEnum(...args);
            };
          }
        } catch { }

        // Modern Font Access API enumeration
        try {
          if (document.fonts) {
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
          }
        } catch { }

        // NavigatorUAData high-entropy values (UA Client Hints) — EDPB 2023 flagged
        try {
          if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === "function") {
            const orig = navigator.userAgentData.getHighEntropyValues.bind(navigator.userAgentData);
            navigator.userAgentData.getHighEntropyValues = function (...args) {
              logFP("NavigatorUAData", "getHighEntropyValues", TIER1);
              return orig(...args);
            };
          }
        } catch { }

        // ─── Tier 2: medium-entropy contextual signals ───
        // Wrapped but only published when stacked with Tier 1 from same caller.

        // Navigator getters (deviceMemory + hardwareConcurrency + platform + maxTouchPoints + pdfViewerEnabled)
        try {
          for (const prop of ["deviceMemory", "hardwareConcurrency", "platform", "maxTouchPoints", "pdfViewerEnabled"]) {
            const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
            if (desc && desc.get) {
              Object.defineProperty(Navigator.prototype, prop, {
                get: function () { logFP("Navigator", prop, TIER2); return desc.get.call(this); },
                configurable: true,
              });
            }
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

        // Screen properties (Tier 2: colorDepth, pixelDepth, availWidth, availHeight)
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

        // document.fonts.size + document.fonts.ready (Tier 2)
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

        // ─── Tier 3: low-entropy / commonly-legitimate (private appendix only) ───

        // navigator.language / languages / cookieEnabled / doNotTrack
        try {
          for (const prop of ["language", "languages", "cookieEnabled", "doNotTrack"]) {
            const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
            if (desc && desc.get) {
              Object.defineProperty(Navigator.prototype, prop, {
                get: function () { logFP("Navigator", prop, TIER3); return desc.get.call(this); },
                configurable: true,
              });
            }
          }
        } catch { }

        // screen.width / height (Tier 3)
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
      });

      const page = await context.newPage();

      // Clear storage on the target origin before navigating
      await page.addInitScript(() => {
        try { localStorage.clear(); } catch { }
        try { sessionStorage.clear(); } catch { }
      });

      // ═══════════════════════════════════════
      // PHASE 1: Pre-consent scan
      // ═══════════════════════════════════════
      console.error(`[Variant: ${variant}] [Phase 1] Loading page without interaction...`);
      const phase1 = await scanPhase(page, targetUrl, "pre-consent");
      variantResult.preConsent = phase1;

      // ─── Take screenshots for visual verification ───
      const screenshotDir = `/tmp`;
      const screenshotBase = `glasshouse-${domain}-${timestamp}-${variant}`;

      // Full page screenshot (visible viewport)
      const screenshotPath = `${screenshotDir}/${screenshotBase}-viewport.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.error(`[Variant: ${variant}] [Screenshot] Viewport saved: ${screenshotPath}`);

      // Full page screenshot (scrolled) — catches bottom banners
      const screenshotFullPath = `${screenshotDir}/${screenshotBase}-fullpage.png`;
      await page.screenshot({ path: screenshotFullPath, fullPage: true });
      console.error(`[Variant: ${variant}] [Screenshot] Full page saved: ${screenshotFullPath}`);

      variantResult.screenshots = {
        viewport: screenshotPath,
        fullPage: screenshotFullPath,
      };

      // ─── Check for cookie wall redirect ───
      let consentClickTimestamp = null;
      let wallInfo = { detected: false };

      // Cookie wall checks only really matter for the first variant to populate the top-level result
      wallInfo = await detectCookieWall(page, targetUrl);

      if (wallInfo.detected) {
        // ═══════════════════════════════════════
        // COOKIE WALL PATH: bypass → capture actual site
        // ═══════════════════════════════════════
        variantResult.cookieWall = {
          detected: true,
          type: wallInfo.type,
          name: wallInfo.name,
          wallDomain: wallInfo.wallDomain,
          wallUrl: wallInfo.wallUrl,
          bypassAttempted: true,
        };

        // ── FIX: Remove Phase 1 listener BEFORE bypass so nu.nl post-consent
        // requests don't leak into the pre-consent measurement.
        // phase1.networkRequests is a live array reference — the handler keeps
        // appending to it until explicitly removed.
        if (phase1._requestHandler) {
          page.removeListener("request", phase1._requestHandler);
        }

        // Attach Phase 2 listener BEFORE bypass so we capture ALL nu.nl requests
        // from the moment of redirect-back, including the initial page load.
        const phase2Networks = [];
        page.on("request", (req) => {
          phase2Networks.push({
            url: req.url(),
            method: req.method(),
            resourceType: req.resourceType(),
            timestamp: Date.now(),
          });
        });

        // If variant is reject, we might not be able to bypass a wall, but we try the standard bypass
        const bypassResult = await bypassCookieWall(page, wallInfo, targetUrl, variant);
        variantResult.cookieWall.bypassSuccess = bypassResult.success;
        variantResult.cookieWall.bypassMethod = bypassResult.method;
        if (bypassResult.multiLayer) {
          variantResult.cookieWall.multiLayer = bypassResult.multiLayer;
        }

        if (bypassResult.success) {
          // Consent was given on the wall — synthesize consent result
          variantResult.consent = {
            detected: true,
            platform: wallInfo.name,
            acceptButton: wallInfo.acceptSelector,
            rejectButton: wallInfo.rejectSelector,
            darkPatterns: [{
              type: "cookie-wall",
              description: "Full-page cookie wall blocks access to content without consent — violates GDPR freely-given requirement",
            }],
            viaCookieWall: true,
            multiLayer: bypassResult.multiLayer ? true : false,
            rejectAccessibility: bypassResult.multiLayer ? "layer-2" : "layer-1",
          };

          // Now on the actual site — capture legal pages and meta tags
          variantResult.legalPages = await findLegalPages(page, url.origin);
          variantResult.metaTags = await extractMetaTags(page);

          // Scroll to trigger lazy-loaded trackers
          await autoScroll(page);
          await page.waitForTimeout(SCROLL_PAUSE);

          const phase2 = await captureState(page, "post-consent");
          phase2.networkRequests = phase2Networks;
          variantResult.postConsent = phase2;
        } else {
          // Bypass failed — capture whatever state we have
          variantResult.consent = {
            detected: false,
            platform: null,
            acceptButton: null,
            rejectButton: null,
            darkPatterns: [],
          };
          variantResult.errors.push({
            phase: "cookie-wall-bypass",
            error: `Failed to bypass ${wallInfo.name} (method: ${bypassResult.method})`,
          });
          variantResult.legalPages = await findLegalPages(page, url.origin);
          variantResult.metaTags = await extractMetaTags(page);
          variantResult.postConsent = await captureState(page, "post-consent");
        }
      } else {
        // ═══════════════════════════════════════
        // NORMAL PATH: no cookie wall
        // ═══════════════════════════════════════

        // ─── Detect consent mechanism ───
        const consentInfo = await detectConsent(page, buttonHints);
        variantResult.consent = consentInfo;
        // Default: if a layer-1 reject button was discovered, mark accessibility.
        // Multi-layer fallback (later) will overwrite this to "layer-2" or "not-found".
        if (consentInfo.detected) {
          variantResult.consent.rejectAccessibility = consentInfo.rejectButton ? "layer-1" : "not-found";
          variantResult.consent.multiLayer = false;
        }

        // ─── TCF + Google Consent Mode v2 detection ───
        console.error(`[Variant: ${variant}] [Detection] Checking TCF, Consent Mode v2, consent granularity...`);
        variantResult.tcf = await detectTCF(page);
        variantResult.googleConsentMode = await detectConsentModeV2(page);
        variantResult.consent.granularity = await detectConsentGranularity(page, consentInfo);

        // ─── Scan for legal pages ───
        variantResult.legalPages = await findLegalPages(page, url.origin);

        // ─── Extract meta tags ───
        variantResult.metaTags = await extractMetaTags(page);

        // ═══════════════════════════════════════
        // PHASE 2: Post-consent scan
        // ═══════════════════════════════════════

        // Remove Phase 1 request listener so it stops accumulating
        if (phase1._requestHandler) {
          page.removeListener("request", phase1._requestHandler);
        }

        // Determine which button to click based on the variant
        let buttonToClick = null;
        let actionName = null;
        let multiLayerAlreadyClicked = false;

        if (variant === "accept" && consentInfo.detected && consentInfo.acceptButton) {
          buttonToClick = consentInfo.acceptButton;
          actionName = "accept";
        } else if (variant === "reject" && consentInfo.detected && consentInfo.rejectButton) {
          buttonToClick = consentInfo.rejectButton;
          actionName = "reject";
        }

        // Multi-layer fallback: same-domain banner detected, reject variant, but
        // layer 1 only exposed accept + settings. Open layer 2 and reject there.
        if (variant === "reject" && consentInfo.detected && !buttonToClick && consentInfo.acceptButton) {
          console.error(`[Variant: reject] [Phase 2] Layer-1 reject missing — trying multi-layer traversal...`);
          const opened = await openLayer2(page);
          if (opened.opened) {
            const rej = await rejectOnLayer2(page);
            if (rej.rejected) {
              console.error(`[Variant: reject] [Phase 2] Multi-layer reject via ${rej.method}`);
              consentClickTimestamp = Date.now();
              actionName = "reject";
              multiLayerAlreadyClicked = true;
              variantResult.consent = variantResult.consent || {};
              variantResult.consent.multiLayer = true;
              variantResult.consent.rejectAccessibility = "layer-2";
              variantResult.consent.multiLayerMethod = rej.method;
              variantResult.consent.multiLayerSettingsSelector = opened.selector;
            } else {
              console.error(`[Variant: reject] [Phase 2] Multi-layer traversal: opened layer 2 but no reject path (${rej.method})`);
              variantResult.consent = variantResult.consent || {};
              variantResult.consent.multiLayer = true;
              variantResult.consent.rejectAccessibility = "not-found";
              variantResult.consent.multiLayerMethod = rej.method;
            }
          } else {
            console.error(`[Variant: reject] [Phase 2] Multi-layer traversal: settings button not found`);
            variantResult.consent = variantResult.consent || {};
            variantResult.consent.rejectAccessibility = "not-found";
          }
        }

        if (buttonToClick || multiLayerAlreadyClicked) {
          if (!multiLayerAlreadyClicked) {
            console.error(`[Variant: ${variant}] [Phase 2] Clicking consent ${actionName} button...`);
            consentClickTimestamp = Date.now();
          }
          try {
            if (!multiLayerAlreadyClicked) {
              // Try clicking the first visible match (some sites have duplicate buttons)
              const btnLocator = page.locator(buttonToClick);
              const count = await btnLocator.count();
              let clicked = false;
              for (let i = 0; i < count; i++) {
                const el = btnLocator.nth(i);
                if (await el.isVisible().catch(() => false)) {
                  await el.click({ timeout: 5000 });
                  clicked = true;
                  break;
                }
              }
              if (!clicked) {
                // Fallback: just click the selector directly
                await page.click(buttonToClick, { timeout: 5000 });
              }
            }
            // (multi-layer click already happened inside rejectOnLayer2)

            // Register Phase 2 listener AFTER the click — only captures post-consent requests
            const phase2Networks = [];
            page.on("request", (req) => {
              phase2Networks.push({
                url: req.url(),
                method: req.method(),
                resourceType: req.resourceType(),
                timestamp: Date.now(),
              });
            });

            console.error(`[Variant: ${variant}] [Phase 2] Waiting for post-interaction activity...`);
            await page.waitForTimeout(POST_CONSENT_WAIT);

            // Scroll to trigger lazy-loaded trackers
            await autoScroll(page);
            await page.waitForTimeout(SCROLL_PAUSE);

            const phase2 = await captureState(page, "post-consent");
            phase2.networkRequests = phase2Networks;
            variantResult.postConsent = phase2;
          } catch (err) {
            variantResult.errors.push({
              phase: `post-consent-${actionName}-click`,
              error: err.message,
            });
            // Still capture post state even if click failed
            variantResult.postConsent = await captureState(page, "post-consent");
          }
        } else {
          // 'ignore' variant, or missing banner, or missing button for this variant
          if (variant !== "ignore") {
            console.error(`[Variant: ${variant}] [Phase 2] Required button not found or no banner. Capturing current state.`);
          } else {
            console.error(`[Variant: ${variant}] [Phase 2] Ignore variant selected. Not interacting with banner. Capturing current state.`);
            // For ignore, we still want to establish a Phase 2 listener to capture ongoing natural activity
            const phase2Networks = [];
            page.on("request", (req) => {
              phase2Networks.push({
                url: req.url(),
                method: req.method(),
                resourceType: req.resourceType(),
                timestamp: Date.now(),
              });
            });
            console.error(`[Variant: ${variant}] [Phase 2] Waiting for natural ongoing activity...`);
            await page.waitForTimeout(POST_CONSENT_WAIT);

            // Scroll to trigger lazy-loaded trackers
            await autoScroll(page);
            await page.waitForTimeout(SCROLL_PAUSE);

            const phase2 = await captureState(page, "post-consent");
            phase2.networkRequests = phase2Networks;
            variantResult.postConsent = phase2;
          }
          if (variant !== "ignore" && !variantResult.postConsent) {
            variantResult.postConsent = await captureState(page, "post-consent");
          }
        }
      }

      // ─── Process security headers ───
      variantResult.securityHeaders = phase1.responseHeaders || {};

      // ═══════════════════════════════════════
      // PHASE 3: Extended detection (runs on both paths)
      // ═══════════════════════════════════════
      console.error(`[Variant: ${variant}] [Phase 3] Running extended detection...`);

      // Collect fingerprinting results (hooks were injected pre-load)
      const rawFp = await collectFingerprintingResult(page, consentClickTimestamp);
      variantResult.fingerprinting = aggregateFingerprinting(rawFp);

      // Collect GPC signal detection
      variantResult.gpc = await collectGPCResult(page);

      // Form leakage detection (after consent, on main page)
      variantResult.formLeakage = await detectFormLeakage(page);

      // Privacy policy content fetch (new page, parallel-safe). Only necessary once.
      if (variant === "ignore") {
        variantResult.legalPageContent = await fetchLegalPageContent(context, variantResult.legalPages);
        variantResult.securityTxt = await fetchSecurityTxt(context, url.origin);
      } else {
        variantResult.legalPageContent = null; // Save space
        variantResult.securityTxt = null;
      }

      // Consent revocation testing (only if consent was detected and accepted, and ONLY during ACCEPT variant)
      if (variant === "accept" && variantResult.consent?.detected && variantResult.consent?.acceptButton && !variantResult.cookieWall?.detected) {
        console.error(`[Variant: ${variant}] [Phase 3] Testing consent revocation...`);
        variantResult.consentRevocation = await testConsentRevocation(page, variantResult.consent);
      } else {
        variantResult.consentRevocation = {
          mechanismFound: false,
          mechanismType: "not-tested",
          acceptanceClicks: 0,
          revocationClicks: 0,
          cookiesBefore: 0,
          cookiesAfter: 0,
          trackingCookiesDeleted: false,
          trackingCookiesRemaining: [],
          newRequestsAfterRevocation: 0,
        };
      }

      console.error(`[Variant: ${variant}] [Phase 3] Extended detection complete.`);

      // Store the variant result
      result.variants[variant] = variantResult;

      // For backwards compatibility and high-level summary, populate the top level with 'ignore' or 'accept' data
      if (variant === "ignore") {
        result.consent = variantResult.consent;
        result.cookieWall = variantResult.cookieWall;
        result.legalPages = variantResult.legalPages;
        result.metaTags = variantResult.metaTags;
        result.securityHeaders = variantResult.securityHeaders;
      }
      result.errors.push(...variantResult.errors);

      await context.close();
    } catch (err) {
      console.error(`[Variant: ${variant}] ERROR: ${err.message}`);
      result.errors.push({ phase: `variant-${variant}`, error: err.message });

      // Check for bot blocking
      if (
        err.message.includes("timeout") ||
        err.message.includes("net::ERR_")
      ) {
        result.errors.push({
          phase: "detection",
          error:
            `Variant ${variant}: Possible bot detection or WAF block. Site may use Imperva/Cloudflare protection.`,
        });
      }

      // Clean up context if it was created
      try { if (context) await context.close(); } catch { }
    }
  } // End of variants loop

  await browser.close();

  // ─── Classify all findings for all variants ───
  for (const variant of variantsToRun) {
    const v = result.variants[variant];
    if (v) {
      v.preConsent = classifyFindings(v.preConsent, result.meta.domain);
      if (v.postConsent) {
        v.postConsent = classifyFindings(v.postConsent, result.meta.domain);
      }

      // Clean up internal fields before serialization
      if (v.preConsent) delete v.preConsent._requestHandler;
      if (v.postConsent) delete v.postConsent._requestHandler;
    }
  }

  // To support legacy report gen without major refactor, provide a top-level summary from the 'accept' variant
  // (which mimics the old behavior: pre-consent -> accept -> post-consent).
  // AND attach variant summaries.
  result.preConsent = result.variants?.accept?.preConsent || null;
  result.postConsent = result.variants?.accept?.postConsent || null;
  result.fingerprinting = result.variants?.accept?.fingerprinting || null;
  result.gpc = result.variants?.accept?.gpc || null;
  result.formLeakage = result.variants?.accept?.formLeakage || null;
  result.consentRevocation = result.variants?.accept?.consentRevocation || null;
  result.legalPageContent = result.variants?.ignore?.legalPageContent || null; // Read from ignore since we captured it there

  // Build the detailed variants summaries
  result.variantSummaries = {
    ignore: buildSummary(result.variants?.ignore, result),
    accept: buildSummary(result.variants?.accept, result),
    reject: buildSummary(result.variants?.reject, result),
  };

  // Create a diff summary that is injected into the root
  result.summary = buildOverallDiffSummary(result);

  // ─── Write output ───
  const outFile = `/tmp/glasshouse-${domain}-${timestamp}.json`;
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(outFile);
  return outFile;
}

// ───────────────────────────────────────────
// Phase scanning
// ───────────────────────────────────────────
async function scanPhase(page, url, phaseName) {
  const networkRequests = [];
  const responseHeaders = {};

  // Capture all network requests — store handler so caller can remove it
  const requestHandler = (req) => {
    let initiatorUrl = null;
    try { initiatorUrl = req.frame()?.url() || null; } catch { }
    networkRequests.push({
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      timestamp: Date.now(),
      initiatorUrl,
    });
  };
  page.on("request", requestHandler);

  // Navigate — try networkidle first, fall back to domcontentloaded on timeout
  // Many sites (e.g. Dyson) never reach networkidle due to persistent analytics/websocket connections
  let response;
  try {
    response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: PAGE_TIMEOUT,
    });
  } catch (err) {
    if (err.message.includes("Timeout") || err.message.includes("timeout")) {
      console.error(`[scanPhase] networkidle timed out for ${url}, retrying with domcontentloaded...`);
      response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: PAGE_TIMEOUT,
      });
      // Give extra time for scripts to fire after DOM is ready
      await page.waitForTimeout(5000);
    } else {
      throw err;
    }
  }

  // Capture response headers from main document
  if (response) {
    const headers = response.headers();
    for (const [key, value] of Object.entries(headers)) {
      responseHeaders[key.toLowerCase()] = value;
    }
  }

  // Wait for dynamic content
  await page.waitForTimeout(3000);

  const state = await captureState(page, phaseName);
  state.networkRequests = networkRequests;
  state.responseHeaders = responseHeaders;
  // Return the handler so the caller can remove it before Phase 2
  state._requestHandler = requestHandler;
  return state;
}

// ───────────────────────────────────────────
// Capture current page state
// ───────────────────────────────────────────
async function captureState(page, phaseName) {
  const state = {
    phase: phaseName,
    cookies: [],
    localStorage: {},
    sessionStorage: {},
    networkRequests: [],
    responseHeaders: {},
  };

  // Cookies
  try {
    const cookies = await page.context().cookies();
    state.cookies = cookies.map((c) => ({
      name: c.name,
      domain: c.domain,
      path: c.path,
      value: c.value.substring(0, 200), // Truncate long values
      expires: c.expires > 0 ? new Date(c.expires * 1000).toISOString() : "session",
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    }));
  } catch (err) {
    // Cookie access may fail on some pages
  }

  // localStorage
  try {
    state.localStorage = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        items[key] = localStorage.getItem(key)?.substring(0, 500);
      }
      return items;
    });
  } catch (err) {
    // May fail on cross-origin pages
  }

  // sessionStorage
  try {
    state.sessionStorage = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        items[key] = sessionStorage.getItem(key)?.substring(0, 500);
      }
      return items;
    });
  } catch (err) {
    // May fail on cross-origin pages
  }

  // SRI — external script/stylesheet integrity audit
  try {
    state.scriptIntegrity = await page.evaluate(() => {
      const host = location.hostname;
      const results = [];
      document.querySelectorAll('script[src], link[rel="stylesheet"][href]').forEach(el => {
        const url = el.src || el.href;
        try {
          const u = new URL(url, location.origin);
          if (u.hostname === host) return; // skip first-party
          results.push({
            url: url.substring(0, 300),
            type: el.tagName === 'SCRIPT' ? 'script' : 'stylesheet',
            hasIntegrity: !!el.integrity,
            integrity: el.integrity || null,
            crossorigin: el.crossOrigin || null,
          });
        } catch { }
      });
      return results;
    });
  } catch { state.scriptIntegrity = []; }

  // IndexedDB database enumeration
  try {
    state.indexedDB = await page.evaluate(async () => {
      if (!indexedDB.databases) return { supported: false, databases: [] };
      try {
        const dbs = await indexedDB.databases();
        return {
          supported: true,
          databases: dbs.map(db => ({ name: db.name, version: db.version })),
        };
      } catch { return { supported: false, databases: [] }; }
    });
  } catch { state.indexedDB = { supported: false, databases: [] }; }

  return state;
}

// ───────────────────────────────────────────
// Classify network requests — THREE tiers:
//
//   Tier 1: sdkLoads
//     Loading a script library (gtm.js, fbevents.js, bat.js).
//     NOT a violation. Required for post-consent functionality.
//
//   Tier 2: consentModePings
//     Tags firing in Google Consent Mode "denied" state, or
//     Microsoft UET consent-status pings (evt=consent).
//     Data still transmitted (IP, URL, viewport) but restricted.
//     LEGALLY DEBATABLE — strict ePrivacy says violation,
//     Google/MS argue privacy-safe. Report separately.
//
//   Tier 3: trackers
//     Full, unrestricted tracking fires — pixel events with
//     custom data, beacons with user IDs, collect endpoints
//     with no consent restrictions.
//     CLEAR VIOLATION without consent.
//
// This three-tier model prevents credibility issues from
// lumping consent-mode pings with full tracking fires.
// ───────────────────────────────────────────

/**
 * Detect Google Consent Mode state from URL parameters.
 * gcd= parameter encodes consent per category.
 * Values with 'r' = restricted/denied, 'l' = granted.
 * Returns { active: bool, allDenied: bool, state: string }
 */
function detectConsentMode(url) {
  const gcdMatch = url.match(/[?&]gcd=([^&]+)/);
  if (!gcdMatch) return { active: false, allDenied: false, state: null };

  const gcd = gcdMatch[1];
  // 'r' positions indicate denied consent categories
  const deniedCount = (gcd.match(/r/g) || []).length;
  const grantedCount = (gcd.match(/l/g) || []).length;

  return {
    active: true,
    allDenied: deniedCount > 0 && grantedCount <= 1, // l1 at end is functionality_storage
    state: gcd,
  };
}

/**
 * Detect Microsoft UET consent ping (evt=consent).
 * These are consent-status pings, not tracking events.
 */
function isUETConsentPing(url) {
  return /bat\.bing\.com.*evt=consent/.test(url);
}

function classifyFindings(phaseData, firstPartyDomain) {
  if (!phaseData) return phaseData;

  const trackers = [];         // Tier 3: full tracking (clear violations)
  const consentModePings = []; // Tier 2: restricted/denied mode pings (debatable)
  const sdkLoads = [];         // Tier 1: script loads (not violations)
  const thirdPartyDomains = new Map();
  const trackingPixels = [];

  for (const req of phaseData.networkRequests || []) {
    let reqUrl;
    try {
      reqUrl = new URL(req.url);
    } catch {
      continue;
    }

    const reqDomain = reqUrl.hostname;

    // Count third-party domains
    const existing = thirdPartyDomains.get(reqDomain) || {
      count: 0,
      categories: new Set(),
    };
    existing.count++;
    thirdPartyDomains.set(reqDomain, existing);

    // ── Tier 1: SDK/script load? ──
    let isSDK = false;
    for (const sp of SDK_PATTERNS) {
      if (sp.pattern.test(req.url)) {
        sdkLoads.push({
          name: sp.name,
          category: sp.category,
          domain: reqDomain,
          url: req.url.substring(0, 300),
          resourceType: req.resourceType,
        });
        existing.categories.add(sp.category);
        isSDK = true;
        break;
      }
    }
    if (isSDK) continue;

    // ── Match against tracker patterns ──
    let matchedTracker = null;
    for (const tp of TRACKER_PATTERNS) {
      if (tp.pattern.test(req.url)) {
        matchedTracker = tp;
        break;
      }
    }

    if (matchedTracker) {
      // ── Tier 2 vs Tier 3: check consent mode state ──
      const consentMode = detectConsentMode(req.url);
      const isConsentPing = isUETConsentPing(req.url);

      // ── Piggybacking / 4th-party detection ──
      let loadedBy = null;
      let is4thParty = false;
      if (req.initiatorUrl) {
        try {
          const initDomain = new URL(req.initiatorUrl).hostname;
          const fpBase = (firstPartyDomain || "").replace(/^www\./, "");
          is4thParty = fpBase && !initDomain.includes(fpBase) && initDomain !== reqDomain;
          if (is44thParty) loadedBy = initDomain;
        } catch { }
      }

      if (consentMode.active && consentMode.allDenied) {
        // Google Consent Mode "denied" ping — restricted data
        consentModePings.push({
          name: matchedTracker.name,
          category: matchedTracker.category,
          domain: reqDomain,
          url: req.url.substring(0, 300),
          resourceType: req.resourceType,
          consentMode: consentMode.state,
          reason: "Google Consent Mode: all consent categories denied/restricted",
          dataTransmitted: ["page_url", "timestamp", "ip_address", "viewport", "user_agent"],
          is4thParty,
          loadedBy,
        });
        existing.categories.add(matchedTracker.category);
      } else if (isConsentPing) {
        // Microsoft UET consent status ping
        consentModePings.push({
          name: "Microsoft UET Consent Ping",
          category: "consent-infrastructure",
          domain: reqDomain,
          url: req.url.substring(0, 300),
          resourceType: req.resourceType,
          consentMode: null,
          reason: "UET consent-status ping (evt=consent), not a tracking event",
          dataTransmitted: ["consent_status", "tag_id", "ip_address"],
          is4thParty,
          loadedBy,
        });
        existing.categories.add("consent-infrastructure");
      } else {
        // ── Tier 3: Full tracking fire — no consent mode protection ──
        trackers.push({
          name: matchedTracker.name,
          category: matchedTracker.category,
          domain: reqDomain,
          url: req.url.substring(0, 300),
          resourceType: req.resourceType,
          consentMode: consentMode.active ? consentMode.state : null,
          is4thParty,
          loadedBy,
        });
        existing.categories.add(matchedTracker.category);
      }
    }

    // Detect tracking pixels (1x1 images, beacons) — with type classification
    const beaconPatterns = [
      { pattern: /\/pixel/, type: "pixel" },
      { pattern: /\/beacon/, type: "beacon" },
      { pattern: /\/tr\?/, type: "pixel" },
      { pattern: /\/collect\?/, type: "collect" },
      { pattern: /1x1/, type: "pixel" },
      { pattern: /\/p\.gif/, type: "pixel" },
      { pattern: /\/b\/ss\//, type: "collect" },
      { pattern: /\/r\/collect/, type: "collect" },
    ];
    if (req.resourceType === "image") {
      let beaconType = null;
      for (const bp of beaconPatterns) {
        if (bp.pattern.test(req.url)) { beaconType = bp.type; break; }
      }
      if (beaconType) {
        trackingPixels.push({
          url: req.url.substring(0, 300),
          domain: reqDomain,
          beaconType,
        });
      }
    }
  }

  phaseData.trackers = trackers;               // Tier 3: clear violations
  phaseData.consentModePings = consentModePings; // Tier 2: debatable
  phaseData.sdkLoads = sdkLoads;               // Tier 1: not violations
  phaseData.thirdPartyDomains = Array.from(thirdPartyDomains.entries()).map(
    ([domain, info]) => ({
      domain,
      requestCount: info.count,
      categories: Array.from(info.categories || []),
    })
  );
  phaseData.trackingPixels = trackingPixels;

  return phaseData;
}

// ───────────────────────────────────────────
// Consent banner detection
// ───────────────────────────────────────────
async function detectConsent(page, buttonHints = {}) {
  const info = {
    detected: false,
    platform: null,
    acceptButton: null,
    rejectButton: null,
    darkPatterns: [],
  };

  for (const [key, sel] of Object.entries(CONSENT_SELECTORS)) {
    try {
      const banner = await page.$(sel.banner);
      if (banner) {
        const isVisible = await banner.isVisible().catch(() => false);
        if (!isVisible) continue;

        info.detected = true;
        info.platform = sel.name;

        // Find accept button
        const acceptBtn = await page.$(sel.accept);
        if (acceptBtn) {
          const btnVisible = await acceptBtn.isVisible().catch(() => false);
          if (btnVisible) {
            info.acceptButton = sel.accept;
          }
        }

        // Find reject button
        if (sel.reject) {
          const rejectBtn = await page.$(sel.reject);
          if (rejectBtn) {
            const btnVisible = await rejectBtn.isVisible().catch(() => false);
            if (btnVisible) {
              info.rejectButton = sel.reject;
            }
          }
        }

        // Dark pattern checks
        const darkPatterns = await page.evaluate((bannerSel) => {
          const patterns = [];
          const banner = document.querySelector(bannerSel);
          if (!banner) return patterns;

          // Check for pre-checked toggles
          const toggles = banner.querySelectorAll(
            'input[type="checkbox"]:checked'
          );
          if (toggles.length > 0) {
            patterns.push({
              type: "pre-checked-toggles",
              count: toggles.length,
              description: `${toggles.length} toggle(s) pre-checked — opt-out instead of opt-in`,
            });
          }

          // Check for asymmetric buttons (accept prominent, reject hidden)
          const buttons = banner.querySelectorAll("button, [role='button'], input[type='button']");
          let acceptSize = 0;
          let rejectSize = 0;
          let rejectFound = false;

          buttons.forEach((btn) => {
            const text = btn.textContent.toLowerCase().trim();
            const rect = btn.getBoundingClientRect();
            const area = rect.width * rect.height;

            if (
              text.includes("accept") ||
              text.includes("agree") ||
              text.includes("allow") ||
              text.includes("akkoord") ||
              text.includes("ok")
            ) {
              acceptSize = Math.max(acceptSize, area);
            }
            if (
              text.includes("reject") ||
              text.includes("decline") ||
              text.includes("refuse") ||
              text.includes("weiger") ||
              text.includes("deny")
            ) {
              rejectFound = true;
              rejectSize = Math.max(rejectSize, area);
            }
          });

          if (acceptSize > 0 && rejectSize > 0 && acceptSize > rejectSize * 2) {
            patterns.push({
              type: "asymmetric-buttons",
              ratio: (acceptSize / rejectSize).toFixed(1),
              description: `Accept button is ${(acceptSize / rejectSize).toFixed(1)}x larger than reject`,
            });
          }
          if (acceptSize > 0 && !rejectFound) {
            patterns.push({
              type: "no-reject-button",
              description:
                "No reject/decline button found — user cannot easily refuse",
            });
          }

          // Count clicks needed to reject
          const settingsLinks = banner.querySelectorAll(
            'a[href*="settings"], button:has-text("Settings"), button:has-text("Manage"), button:has-text("Customize"), a:has-text("Manage")'
          );
          if (settingsLinks.length > 0 && !rejectFound) {
            patterns.push({
              type: "multi-click-reject",
              description:
                "Rejecting requires navigating to settings — not a single action",
            });
          }

          return patterns;
        }, sel.banner);

        info.darkPatterns = darkPatterns;
        break; // Found a match, stop looking
      }
    } catch {
      continue;
    }
  }

  // ─── Content-based fallback ───
  // Runs if no CMP matched, OR if a banner was detected but no accept button found.
  // Scans for visible elements with consent language and clickable accept/reject buttons.
  // This catches custom implementations (Facebook, LinkedIn, X, Amazon, etc.)
  if (!info.detected || (!info.acceptButton && !info.rejectButton)) {
    console.error("[Consent] No selector match — trying content-based detection...");
    try {
      const contentResult = await page.evaluate(() => {
        const consentKeywords = /\b(cookie|cookies|privacy|consent|tracking|non-essential|data protection)\b/i;
        const acceptTexts = /^(accept|agree|allow|ok|got it|i agree|akkoord|alles accepteren|alle akzeptieren|tout accepter|accetta tutti|aceptar todo|accept all|accept cookies|allow all cookies|allow all|allow essential and optional cookies|accept all cookies)$/i;
        const rejectTexts = /^(reject|decline|deny|weigeren|alles weigeren|alle ablehnen|tout refuser|rifiuta tutti|rechazar todo|reject all|decline all)$/i;

        // Find all text nodes that might be part of a consent banner
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        let bannerEl = null;
        let acceptBtn = null;
        let rejectBtn = null;

        while ((node = walker.nextNode())) {
          if (node.textContent.match(consentKeywords)) {
            let parent = node.parentElement;
            // Traverse up to find a container (dialog, banner, fixed div, etc.)
            let depth = 0;
            while (parent && parent !== document.body && depth < 5) {
              const style = window.getComputedStyle(parent);
              if (
                parent.tagName === 'DIALOG' ||
                style.position === 'fixed' ||
                style.position === 'absolute' ||
                style.position === 'sticky' ||
                parent.id.match(/(banner|consent|cookie|privacy)/i) ||
                parent.className.match(/(banner|consent|cookie|privacy)/i)
              ) {
                // Check if it's actually visible
                if (parent.offsetWidth > 0 && parent.offsetHeight > 0 && style.visibility !== 'hidden' && style.display !== 'none') {
                  bannerEl = parent;
                  break;
                }
              }
              parent = parent.parentElement;
              depth++;
            }
          }
          if (bannerEl) break;
        }

        if (bannerEl) {
          const clickableEls = bannerEl.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]');
          for (const el of clickableEls) {
            const text = (el.textContent || el.value || "").trim();
            if (text.match(acceptTexts)) {
              if (el.offsetWidth > 0 && el.offsetHeight > 0) acceptBtn = el;
            }
            if (text.match(rejectTexts)) {
              if (el.offsetWidth > 0 && el.offsetHeight > 0) rejectBtn = el;
            }
          }
        }

        if (bannerEl) {
          // We need a unique selector path for the Playwright click
          const getPath = (el) => {
            if (!el) return null;
            if (el.id) return `#${el.id}`;
            const path = [];
            let current = el;
            while (current && current !== document.body) {
              let selector = current.tagName.toLowerCase();
              if (current.className && typeof current.className === 'string') {
                const classes = current.className.split(/\s+/).filter(c => c && !c.includes(':')).join('.');
                if (classes) selector += `.${classes}`;
              }
              let nth = 1;
              let sibling = current.previousElementSibling;
              while (sibling) {
                if (sibling.tagName === current.tagName) nth++;
                sibling = sibling.previousElementSibling;
              }
              if (nth > 1) selector += `:nth-of-type(${nth})`;
              path.unshift(selector);
              current = current.parentElement;
            }
            return 'body > ' + path.join(' > ');
          };

          return {
            platform: "Content-Based Fallback",
            acceptButton: getPath(acceptBtn),
            rejectButton: getPath(rejectBtn)
          };
        }
        return null;
      });

      if (contentResult) {
        info.detected = true;
        info.platform = contentResult.platform;
        info.acceptButton = contentResult.acceptButton;
        info.rejectButton = contentResult.rejectButton;
      }
    } catch { }
  }

  // ─── Vision-assisted fallback (Claude-provided button text hints) ───
  // When automatic detection fails to find buttons, use text hints from Claude
  // who has already read the viewport screenshot and identified the button labels.
  const hasHints = buttonHints.acceptText || buttonHints.rejectText || buttonHints.saveText;
  if (hasHints && (!info.acceptButton || !info.rejectButton)) {
    console.error("[Consent] Trying vision-assisted detection with Claude-provided hints...");

    // Helper: find a visible button by exact text match using Playwright's text locator
    const findButtonByText = async (text) => {
      if (!text) return null;
      try {
        // Try multiple selector strategies for robustness
        const strategies = [
          `button:has-text("${text}")`,
          `[role="button"]:has-text("${text}")`,
          `a:has-text("${text}")`,
        ];
        for (const sel of strategies) {
          const locator = page.locator(sel);
          const count = await locator.count();
          for (let i = 0; i < count; i++) {
            const el = locator.nth(i);
            if (await el.isVisible().catch(() => false)) {
              // Verify the text matches closely (not just a substring in a large container)
              const elText = (await el.textContent().catch(() => "")).trim();
              if (elText === text || elText.toLowerCase() === text.toLowerCase()) {
                console.error(`[Consent] [Hint] Found button: "${text}" via ${sel}`);
                return sel;
              }
            }
          }
        }
        // Fallback: use Playwright's getByRole which handles accessible names well
        const roleLocator = page.getByRole("button", { name: text, exact: true });
        if (await roleLocator.count() > 0 && await roleLocator.first().isVisible().catch(() => false)) {
          // Return a CSS-style selector that Playwright can use later
          const roleSelector = `button:has-text("${text}")`;
          console.error(`[Consent] [Hint] Found button via getByRole: "${text}"`);
          return roleSelector;
        }
      } catch (err) {
        console.error(`[Consent] [Hint] Error finding "${text}": ${err.message}`);
      }
      return null;
    };

    // Find accept button
    if (!info.acceptButton && buttonHints.acceptText) {
      info.acceptButton = await findButtonByText(buttonHints.acceptText);
    }

    // Find reject button
    if (!info.rejectButton && buttonHints.rejectText) {
      info.rejectButton = await findButtonByText(buttonHints.rejectText);
    }

    // "Save" text is treated as reject — saving with toggles off = rejecting
    if (!info.rejectButton && buttonHints.saveText) {
      info.rejectButton = await findButtonByText(buttonHints.saveText);
      if (info.rejectButton) {
        console.error(`[Consent] [Hint] Using save button ("${buttonHints.saveText}") as reject action`);
      }
    }

    // If we found any button via hints, mark as detected
    if ((info.acceptButton || info.rejectButton) && !info.detected) {
      info.detected = true;
      info.platform = "Vision-Assisted (Claude)";
    } else if (info.detected && (info.acceptButton || info.rejectButton)) {
      // Banner was already detected but buttons weren't — update platform note
      info.platform = (info.platform || "Unknown") + " + Vision-Assisted";
    }

    if (hasHints && !info.acceptButton && !info.rejectButton) {
      console.error("[Consent] [Hint] Vision hints provided but no matching buttons found on page.");
    }
  }

  return info;
}

// ───────────────────────────────────────────
// Cookie wall detection
//
// Detects when the browser has been redirected to a
// separate consent domain instead of landing on the
// target site. This happens with DPG Media (nu.nl,
// ad.nl, volkskrant.nl) and similar cookie wall patterns.
// ───────────────────────────────────────────
async function detectCookieWall(page, targetUrl) {
  const target = new URL(targetUrl);
  const targetDomain = target.hostname.replace(/^www\./, "");

  let currentUrl;
  try {
    currentUrl = new URL(page.url());
  } catch {
    return { detected: false };
  }
  const currentDomain = currentUrl.hostname.replace(/^www\./, "");

  // Same domain — no cookie wall redirect happened
  if (currentDomain === targetDomain) {
    return { detected: false };
  }

  // Check known cookie wall platforms first
  for (const [type, wall] of Object.entries(COOKIE_WALL_SELECTORS)) {
    if (type === "generic") continue; // Try specific patterns first

    if (wall.domainPattern && wall.domainPattern.test(currentUrl.hostname)) {
      const returnUrl = wall.extractReturnUrl(page.url());
      console.error(`[Cookie Wall] Detected ${wall.name} on ${currentDomain}`);
      return {
        detected: true,
        type,
        name: wall.name,
        wallDomain: currentDomain,
        wallUrl: page.url(),
        acceptSelector: wall.accept,
        rejectSelector: wall.reject,
        returnUrl: returnUrl || targetUrl,
      };
    }
  }

  // Generic detection: different domain + page contains consent keywords
  try {
    const looksLikeConsent = await page.evaluate(() => {
      const text = (document.body?.innerText || "").toLowerCase();
      const title = (document.title || "").toLowerCase();
      const combined = text + " " + title;
      const keywords = [
        "privacy", "consent", "cookie", "gdpr", "akkoord",
        "toestemming", "einwilligung", "consentement", "accept",
        "tracking", "data protection",
      ];
      let matches = 0;
      for (const kw of keywords) {
        if (combined.includes(kw)) matches++;
      }
      return matches >= 2;
    });

    if (looksLikeConsent) {
      const generic = COOKIE_WALL_SELECTORS.generic;
      const returnUrl = generic.extractReturnUrl(page.url());
      console.error(`[Cookie Wall] Detected generic cookie wall on ${currentDomain}`);
      return {
        detected: true,
        type: "generic",
        name: generic.name,
        wallDomain: currentDomain,
        wallUrl: page.url(),
        acceptSelector: generic.accept,
        rejectSelector: generic.reject,
        returnUrl: returnUrl || targetUrl,
      };
    }
  } catch {
    // page.evaluate failed — possibly navigating
  }

  return { detected: false };
}

// ───────────────────────────────────────────
// Multi-layer wall reject
//
// Falls through here when the layer-1 reject button isn't present on
// the wall. Tries to open layer 2 (settings/manage), then reject either
// via a direct layer-2 button or by unchecking non-essential toggles
// and saving. On success, waits for the same redirect-back behavior
// that the single-layer bypass relies on.
// ───────────────────────────────────────────
async function tryMultiLayerWallReject(page, wallInfo, originalUrl, layer1Reason) {
  const openResult = await openLayer2(page);
  if (!openResult.opened) {
    console.error(`[Cookie Wall] Multi-layer: settings button not found on layer 1`);
    return {
      success: false,
      method: layer1Reason,
      multiLayer: { attempted: true, settingsFound: false },
      finalUrl: page.url(),
    };
  }
  console.error(`[Cookie Wall] Multi-layer: opened layer 2 via ${openResult.selector}`);

  const rejectResult = await rejectOnLayer2(page);
  if (!rejectResult.rejected) {
    console.error(`[Cookie Wall] Multi-layer: no reject path on layer 2 (${rejectResult.method})`);
    return {
      success: false,
      method: `multilayer-${rejectResult.method}`,
      multiLayer: { attempted: true, settingsFound: true, layer2Method: rejectResult.method },
      finalUrl: page.url(),
    };
  }
  console.error(`[Cookie Wall] Multi-layer: layer-2 reject via ${rejectResult.method}`);

  // Same redirect-back wait as the single-layer path
  await page.waitForTimeout(2000);
  const originalDomain = new URL(originalUrl).hostname.replace(/^www\./, "");
  let currentDomain;
  try {
    currentDomain = new URL(page.url()).hostname.replace(/^www\./, "");
  } catch {
    currentDomain = "";
  }
  if (currentDomain !== originalDomain) {
    // Try manual navigation back, same as single-layer fallback
    try {
      await page.goto(wallInfo.returnUrl || originalUrl, {
        waitUntil: "networkidle",
        timeout: PAGE_TIMEOUT,
      });
      await page.waitForTimeout(3000);
      currentDomain = new URL(page.url()).hostname.replace(/^www\./, "");
    } catch (err) {
      console.error(`[Cookie Wall] Multi-layer: manual navigation after reject failed: ${err.message}`);
    }
  }
  if (currentDomain !== originalDomain) {
    return {
      success: false,
      method: `multilayer-redirect-failed`,
      multiLayer: { attempted: true, settingsFound: true, layer2Method: rejectResult.method },
      finalUrl: page.url(),
    };
  }

  try {
    await page.waitForLoadState("networkidle", { timeout: 15000 });
  } catch { /* streaming content is fine */ }
  await page.waitForTimeout(3000);

  return {
    success: true,
    method: `multilayer-${rejectResult.method}`,
    multiLayer: {
      attempted: true,
      settingsFound: true,
      layer2Method: rejectResult.method,
      toggleCount: rejectResult.toggleCount,
      togglesUnchecked: rejectResult.togglesUnchecked,
    },
    finalUrl: page.url(),
  };
}

// ───────────────────────────────────────────
// Cookie wall bypass
//
// Clicks the accept or reject button on a cookie wall and handles
// the redirect back to the original site. Falls back to
// manual navigation if the redirect doesn't happen.
// ───────────────────────────────────────────
async function bypassCookieWall(page, wallInfo, originalUrl, variant = "accept") {
  const isReject = variant === "reject";
  const actionName = isReject ? "reject" : "accept";
  const selector = isReject ? wallInfo.rejectSelector : wallInfo.acceptSelector;

  console.error(`[Cookie Wall] Attempting bypass via ${actionName} button...`);

  if (!selector && isReject) {
    console.error(`[Cookie Wall] No reject selector defined for ${wallInfo.name} — trying multi-layer traversal.`);
    return tryMultiLayerWallReject(page, wallInfo, originalUrl, "no-reject-selector");
  }

  // Find the button
  let btn;
  try {
    btn = await page.$(selector);
  } catch {
    btn = null;
  }

  if (!btn) {
    if (isReject) {
      console.error(`[Cookie Wall] No layer-1 reject button found — trying multi-layer traversal.`);
      return tryMultiLayerWallReject(page, wallInfo, originalUrl, "reject-button-not-found");
    }
    console.error(`[Cookie Wall] No ${actionName} button found`);
    return { success: false, method: "no-button", finalUrl: page.url() };
  }

  // Verify button is visible
  const isVisible = await btn.isVisible().catch(() => false);
  if (!isVisible) {
    console.error(`[Cookie Wall] ${actionName} button found but not visible`);
    return { success: false, method: "button-hidden", finalUrl: page.url() };
  }

  // Click and wait for navigation
  try {
    await Promise.all([
      page.waitForNavigation({ timeout: 15000, waitUntil: "domcontentloaded" }),
      btn.click(),
    ]);
  } catch (err) {
    console.error(`[Cookie Wall] Navigation after click: ${err.message}`);
  }

  // Settle time — let redirects complete
  await page.waitForTimeout(2000);

  // Check if we're back on the original domain
  const originalDomain = new URL(originalUrl).hostname.replace(/^www\./, "");
  let currentDomain;
  try {
    currentDomain = new URL(page.url()).hostname.replace(/^www\./, "");
  } catch {
    currentDomain = "";
  }

  if (currentDomain === originalDomain) {
    console.error(`[Cookie Wall] Bypass successful — redirected back to ${currentDomain}`);
    // Wait for the actual page to fully load and trackers to fire
    try {
      await page.waitForLoadState("networkidle", { timeout: 15000 });
    } catch {
      // networkidle timeout is acceptable — page may have streaming content
    }
    await page.waitForTimeout(3000);
    return { success: true, method: "redirect-back", finalUrl: page.url() };
  }

  // Not back yet — try manual navigation
  console.error(`[Cookie Wall] Still on ${currentDomain}, trying manual navigation to ${wallInfo.returnUrl || originalUrl}`);
  try {
    await page.goto(wallInfo.returnUrl || originalUrl, {
      waitUntil: "networkidle",
      timeout: PAGE_TIMEOUT,
    });
    await page.waitForTimeout(3000);

    currentDomain = new URL(page.url()).hostname.replace(/^www\./, "");
    if (currentDomain === originalDomain) {
      console.error(`[Cookie Wall] Manual navigation successful`);
      return { success: true, method: "manual-navigate", finalUrl: page.url() };
    }
  } catch (err) {
    console.error(`[Cookie Wall] Manual navigation failed: ${err.message}`);
  }

  console.error(`[Cookie Wall] Bypass failed — still on ${currentDomain}`);
  return { success: false, method: "redirect-failed", finalUrl: page.url() };
}

// ───────────────────────────────────────────
// TCF + Google Consent Mode v2 detection
// ───────────────────────────────────────────
async function detectTCF(page) {
  try {
    return await page.evaluate(() => {
      const result = {
        detected: false,
        version: null,
        cmpId: null,
        purposeConsents: {},
        vendorCount: 0,
        consentString: null,
      };

      // Check for TCF API
      if (typeof window.__tcfapi === "function") {
        result.detected = true;
        result.version = 2;
        // Try to get consent data (async but we can check synchronously via ping)
        try {
          window.__tcfapi("ping", 2, (pingData) => {
            if (pingData) {
              result.cmpId = pingData.cmpId || null;
            }
          });
        } catch { }
      } else if (typeof window.__cmp === "function") {
        result.detected = true;
        result.version = 1;
      }

      // Check for TCF consent string in cookies
      const cookies = document.cookie.split(";").map(c => c.trim());
      for (const c of cookies) {
        if (c.startsWith("euconsent-v2=")) {
          result.consentString = c.split("=")[1]?.substring(0, 100);
          result.detected = true;
          result.version = result.version || 2;
        }
        if (c.startsWith("euconsent=")) {
          result.consentString = result.consentString || c.split("=")[1]?.substring(0, 100);
          result.detected = true;
          result.version = result.version || 1;
        }
      }

      // Check localStorage for TCF keys
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (/tcf|euconsent|cmp/i.test(key)) {
            result.detected = true;
            break;
          }
        }
      } catch { }

      return result;
    });
  } catch {
    return { detected: false };
  }
}

async function detectConsentModeV2(page) {
  try {
    return await page.evaluate(() => {
      const result = {
        detected: false,
        defaultState: {},
        updateEvents: [],
      };

      // Check dataLayer for consent_default and consent_update events
      const dataLayer = window.dataLayer || window.google_tag_data?.ics?.entries || [];
      if (!Array.isArray(dataLayer)) return result;

      const consentCategories = ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization", "functionality_storage", "personalization_storage", "security_storage"];

      for (const entry of dataLayer) {
        if (!entry || typeof entry !== "object") continue;

        // GTM consent commands: [command, params] or {event: ..., ...}
        if (entry[0] === "consent" && entry[1] === "default" && entry[2]) {
          result.detected = true;
          for (const cat of consentCategories) {
            if (entry[2][cat]) result.defaultState[cat] = entry[2][cat];
          }
        }
        if (entry[0] === "consent" && entry[1] === "update" && entry[2]) {
          result.detected = true;
          const update = {};
          for (const cat of consentCategories) {
            if (entry[2][cat]) update[cat] = entry[2][cat];
          }
          if (Object.keys(update).length > 0) result.updateEvents.push(update);
        }

        // Also check for gtag consent events
        if (entry.event === "consent_update" || entry.event === "consent_default") {
          result.detected = true;
        }
      }

      // Check for Google consent mode via google_tag_data
      try {
        if (window.google_tag_data?.ics?.entries) {
          result.detected = true;
          const entries = window.google_tag_data.ics.entries;
          for (const [key, val] of Object.entries(entries)) {
            if (consentCategories.includes(key) && val) {
              result.defaultState[key] = val.default ? "granted" : "denied";
            }
          }
        }
      } catch { }

      return result;
    });
  } catch {
    return { detected: false };
  }
}

// ───────────────────────────────────────────
// Consent granularity verification
// ───────────────────────────────────────────
async function detectConsentGranularity(page, consentInfo) {
  if (!consentInfo.detected) return null;
  try {
    // Determine which banner element to inspect
    const bannerSelector = consentInfo.platform
      ? Object.values(CONSENT_SELECTORS).find(s => s.name === consentInfo.platform)?.banner
      : null;

    return await page.evaluate((selector) => {
      // Find the consent banner element
      let banner = null;
      if (selector) banner = document.querySelector(selector);
      if (!banner) {
        // Fallback: find any visible fixed/dialog element with consent text
        const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
        for (const d of dialogs) {
          if (d.offsetHeight > 0 && /cookie|consent|privacy/i.test(d.textContent)) {
            banner = d;
            break;
          }
        }
      }
      // Still nothing — try fixed/sticky elements
      if (!banner) {
        const fixed = document.querySelectorAll('*');
        for (const el of fixed) {
          const style = window.getComputedStyle(el);
          if ((style.position === 'fixed' || style.position === 'sticky') &&
            el.offsetHeight > 50 && /cookie|consent|privacy/i.test(el.textContent)) {
            banner = el;
            break;
          }
        }
      }
      if (!banner) return { hasToggles: false, toggleCount: 0, categoriesFound: [], settingsLinkFound: false };

      // Look for category toggles
      const checkboxes = banner.querySelectorAll('input[type="checkbox"]');
      const switches = banner.querySelectorAll('[role="switch"]');
      const toggleEls = banner.querySelectorAll('[class*="toggle"], [class*="Toggle"]');
      const toggleCount = checkboxes.length + switches.length + toggleEls.length;

      // Try to identify categories from labels
      const categoriesFound = [];
      const categoryPatterns = {
        necessary: /necessary|essential|required|strictly|strikt/i,
        functional: /functional|preferences|voorkeuren/i,
        analytics: /analytics|statistics|statistiek|performance/i,
        marketing: /marketing|advertising|ads|targeting|reclame/i,
      };
      const allText = banner.innerText || "";
      for (const [cat, pattern] of Object.entries(categoryPatterns)) {
        if (pattern.test(allText)) categoriesFound.push(cat);
      }

      // Check for settings/preferences link
      const settingsPatterns = /cookie.?settings|privacy.?preferences|manage.?cookies|show.?details|customize|aanpassen|instellingen/i;
      const links = banner.querySelectorAll('a, button');
      let settingsLinkFound = false;
      for (const link of links) {
        if (settingsPatterns.test(link.textContent)) {
          settingsLinkFound = true;
          break;
        }
      }

      return {
        hasToggles: toggleCount > 0,
        toggleCount,
        categoriesFound,
        settingsLinkFound,
      };
    }, bannerSelector);
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────
// GPC signal detection (collect results)
// ───────────────────────────────────────────
async function collectGPCResult(page) {
  try {
    const gpcAccessed = await page.evaluate(() => window.__gpcAccessed || false);
    return {
      signalSent: true, // Always sent via header + navigator property
      siteReadsSignal: gpcAccessed,
    };
  } catch {
    return { signalSent: true, siteReadsSignal: false };
  }
}

// ───────────────────────────────────────────
// Fingerprinting detection (collect results)
// ───────────────────────────────────────────
function extractCallerDomain(callerUrl) {
  if (!callerUrl) return "<unknown>";
  const urlMatch = callerUrl.match(/(https?:\/\/[^\s):]+)/);
  if (!urlMatch) {
    if (callerUrl.includes("blob:")) return "<inline-blob>";
    return "<unknown>";
  }
  try { return new URL(urlMatch[1]).hostname; } catch { return "<unknown>"; }
}

async function collectFingerprintingResult(page, consentTimestamp) {
  try {
    const fpCalls = await page.evaluate(() => window.__fpCalls || []);
    if (fpCalls.length === 0) {
      return { detected: false, apiCalls: [], preConsent: false, callerDomains: [] };
    }

    // Deduplicate by (api, method, callerDomain) so per-caller breakdown is
    // preserved for the aggregator's stacking pass.
    const callMap = new Map();
    for (const call of fpCalls) {
      const callerDomain = extractCallerDomain(call.callerUrl);
      const isPreConsent = consentTimestamp ? call.timestamp < consentTimestamp : true;
      const key = `${call.api}:${call.method}:${callerDomain}:${isPreConsent ? "pre" : "post"}`;
      if (!callMap.has(key)) {
        callMap.set(key, {
          api: call.api,
          method: call.method,
          tier: call.tier || "tier1",
          count: 1,
          timestamp: call.timestamp,
          callerUrl: call.callerUrl,
          callerDomain,
          inWorker: !!call.inWorker,
          preConsent: isPreConsent,
        });
      } else {
        callMap.get(key).count++;
      }
    }

    const apiCalls = Array.from(callMap.values());
    const preConsent = consentTimestamp
      ? fpCalls.some(c => c.timestamp < consentTimestamp)
      : true;

    const callerDomains = Array.from(new Set(apiCalls.map(c => c.callerDomain).filter(d => d !== "<unknown>")));

    return {
      detected: true,
      apiCalls,
      preConsent,
      callerDomains,
    };
  } catch {
    return { detected: false, apiCalls: [], preConsent: false, callerDomains: [] };
  }
}

// ───────────────────────────────────────────
// Fingerprinting aggregation (post-scan)
// ───────────────────────────────────────────

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

function classifyApiName(api, method) {
  return `${api}.${(method || "").split(" ")[0]}`;
}

function aggregateFingerprinting(rawResult) {
  // rawResult shape: { detected, apiCalls[], preConsent, callerDomains[] }
  // Each apiCalls entry already has callerDomain + tier + preConsent attached
  // by the new collectFingerprintingResult.

  const calls = (rawResult.apiCalls || []);
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
  const promotedTier2Calls = [];
  const droppedTier2Calls = [];

  for (const [domain, bucket] of byDomain) {
    if (domain === "<unknown>") {
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
      rationale: null,
      legitimateBasisClaim: null,
      purposeDisclosed: null,
    });
  }

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
        legitimateBasisClaim: null,
        purposeDisclosed: null,
      });
    }
  }

  const tier3Appendix = [
    ...tier3CallsRaw,
    ...droppedTier2Calls.map(c => ({ ...c, demotedFrom: "tier2" })),
  ];

  // Strip callerUrl from public-surface arrays (kept on tier3Appendix for forensic value)
  const stripUrl = ({ callerUrl, ...rest }) => rest;

  return {
    detected: tier1Calls.length > 0 || stackedSignals.length > 0,
    preConsent: rawResult.preConsent || false,
    severity: stackedSignals.some(s => s.verdict === "active fingerprinting" && s.preConsent)
      ? "high"
      : (stackedSignals.length > 0 ? "medium" : "low"),
    tier1Calls: tier1Calls.map(stripUrl),
    tier2Calls: promotedTier2Calls.map(stripUrl),
    stackedSignals,
    commercialSdks,
    callerDomains: Array.from(allDomains).filter(d => d !== "<unknown>"),
    tier3Appendix: tier3Appendix.map(stripUrl),
    outOfScopeCaveats: [
      "Network-layer fingerprinting (TLS JA3/JA4, HTTP/3 QUIC, IP TTL) is not detectable by JavaScript instrumentation. Sites may use these techniques.",
      "CSS timing attacks are indistinguishable from legitimate rendering measurements.",
      "Worker-internal canvas readbacks are detected indirectly (via OffscreenCanvas postMessage transfers); the readback itself is not visible from the main thread.",
    ],
    apiCalls: calls.map(stripUrl), // legacy field — duplicated data, kept for backwards compat
  };
}

// ───────────────────────────────────────────
// Privacy policy content fetch (new page)
// ───────────────────────────────────────────
async function fetchLegalPageContent(context, legalPages) {
  const result = {};
  // Find privacy policy and cookie policy URLs
  const policyTypes = [
    { key: "privacyPolicy", match: (l) => /privacy/i.test(l.type || "") || /privacy/i.test(l.text || "") },
    { key: "cookiePolicy", match: (l) => /cookie/i.test(l.type || "") || /cookie/i.test(l.text || "") },
  ];

  for (const pt of policyTypes) {
    const found = (legalPages || []).find(pt.match);
    if (!found || !found.url) continue;

    let policyPage;
    try {
      console.error(`[Legal] Fetching ${pt.key}: ${found.url}`);
      policyPage = await context.newPage();
      await policyPage.goto(found.url, { waitUntil: "networkidle", timeout: 30000 });
      await policyPage.waitForTimeout(3000);

      const text = await policyPage.evaluate(() => {
        // Strip nav, footer, header to get just the content
        const clutter = document.querySelectorAll("nav, header, footer, [role='navigation'], [role='banner']");
        clutter.forEach(el => el.remove());
        return (document.body.innerText || "").substring(0, 30000);
      });

      result[pt.key] = {
        url: found.url,
        text: text,
        fetchedAt: new Date().toISOString(),
        charCount: text.length,
      };
    } catch (err) {
      console.error(`[Legal] Failed to fetch ${pt.key}: ${err.message}`);
    } finally {
      if (policyPage) {
        try { await policyPage.close(); } catch { }
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

// ───────────────────────────────────────────
// security.txt fetch (RFC 9116)
// ───────────────────────────────────────────
async function fetchSecurityTxt(context, originUrl) {
  const candidates = [
    `${originUrl}/.well-known/security.txt`,
    `${originUrl}/security.txt`,
  ];
  for (const url of candidates) {
    try {
      console.error(`[security.txt] Trying ${url}`);
      const response = await context.request.get(url, { timeout: 10000, failOnStatusCode: false });
      if (!response.ok()) continue;
      const ct = response.headers()["content-type"] || "";
      if (!ct.includes("text/plain") && !ct.includes("text/")) continue;
      const text = await response.text();
      if (text.length > 50000) continue; // sanity guard
      const fields = parseSecurityTxt(text);
      console.error(`[security.txt] Found at ${url} (${Object.keys(fields).length} fields)`);
      return {
        url,
        present: true,
        rawLength: text.length,
        fields,
        expired: isSecurityTxtExpired(fields.Expires),
      };
    } catch (err) {
      // continue to next candidate
    }
  }
  return { present: false, url: null, fields: {}, expired: null };
}

function parseSecurityTxt(text) {
  const fields = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z][A-Za-z0-9-]*)\s*:\s*(.+)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim();
    if (fields[key] === undefined) fields[key] = value;
    else if (Array.isArray(fields[key])) fields[key].push(value);
    else fields[key] = [fields[key], value];
  }
  return fields;
}

function isSecurityTxtExpired(expires) {
  if (!expires) return null;
  const expiresValue = Array.isArray(expires) ? expires[0] : expires;
  const date = new Date(expiresValue);
  if (isNaN(date.getTime())) return null;
  return date.getTime() < Date.now();
}

// ───────────────────────────────────────────
// Policy text analysis (DSAR, processors, breach, opt-out)
// ───────────────────────────────────────────
function analyzePolicyText(legalPageContent, thirdPartyDomains, securityTxt) {
  const privacy = legalPageContent?.privacyPolicy?.text || "";
  const cookie = legalPageContent?.cookiePolicy?.text || "";
  const combined = (privacy + "\n\n" + cookie).toLowerCase();
  const policyLen = combined.trim().length;

  // ── DSAR ──
  const dsar = {
    contactPresent: false,
    contactType: "none",     // "email" | "form" | "postal_only" | "none"
    contactEvidence: null,
    dedicatedPagePresent: false,
    responseCommitmentDays: null,
    art21Disclosed: /\b(right to object|right to oppose|recht\s+(?:van|tot)\s+bezwaar|art(?:icle|\.)?\s*21)\b/i.test(combined),
    rightToErasureDisclosed: /\b(right to (be forgotten|erasure|deletion)|recht op (vergetelheid|verwijdering)|art(?:icle|\.)?\s*17)\b/i.test(combined),
    rightToAccessDisclosed: /\b(right of access|right to access|recht op (inzage|toegang)|art(?:icle|\.)?\s*15)\b/i.test(combined),
    portabilityDisclosed: /\b(data portability|right to portability|recht op (data)?overdraagbaarheid|art(?:icle|\.)?\s*20)\b/i.test(combined),
    complainToDpaDisclosed: /\b(lodge (a )?complaint|complaint with (the )?(supervisory|data protection) authority|klacht (in te dienen )?bij (de )?autoriteit)\b/i.test(combined),
    disproportionateBurdenFlags: [],
  };
  // Email contact
  const emailMatch = combined.match(/\b(?:privacy|dpo|data[-_. ]?protection|gdpr|datarequest|dsar|rights)[a-z0-9._-]*@[a-z0-9.-]+\.[a-z]{2,}\b/);
  if (emailMatch) {
    dsar.contactPresent = true;
    dsar.contactType = "email";
    dsar.contactEvidence = emailMatch[0];
  } else if (/\b(privacy|data subject|gdpr).{0,40}(form|portal|request|webform)\b/i.test(combined)) {
    dsar.contactPresent = true;
    dsar.contactType = "form";
  } else if (/\b(write|mail|send) (us )?(at|to)\b.{0,80}(p\.?o\.? box|postcode|street|avenue|straat)/i.test(combined)) {
    dsar.contactPresent = true;
    dsar.contactType = "postal_only";
  }
  // Dedicated page hint (URLs in either policy linking to /privacy-rights, /your-data, etc.)
  const allText = (legalPageContent?.privacyPolicy?.text || "") + "\n" + (legalPageContent?.cookiePolicy?.text || "");
  if (/\/(privacy-rights|your-(privacy|data|rights)|data-request|gdpr-rights|privacy-center|dsar|subject-rights)\b/i.test(allText)) {
    dsar.dedicatedPagePresent = true;
  }
  // 30-day response commitment
  const responseMatch = combined.match(/\b(within|in)\s+(one|1)\s+month\b|\bwithin\s+(thirty|30)\s+days\b|\bbinnen\s+(een|1)\s+maand\b|\bbinnen\s+(dertig|30)\s+dagen\b/);
  if (responseMatch) dsar.responseCommitmentDays = 30;
  // Disproportionate burden flags
  const burdenPatterns = [
    { re: /notari[sz]e/i, flag: "notarized identification required" },
    { re: /in person at our (office|headquarters|hq)/i, flag: "in-person submission required" },
    { re: /certified mail (only|required)/i, flag: "certified mail only" },
    { re: /government[- ]issued (id|identification).{0,40}(notari|certif)/i, flag: "government ID + certification required" },
  ];
  for (const p of burdenPatterns) if (p.re.test(combined)) dsar.disproportionateBurdenFlags.push(p.flag);

  // ── Processors ──
  // Known processor name → display tokens
  const processorCatalog = [
    { name: "Google Analytics", patterns: [/google analytics/], jurisdiction: "US" },
    { name: "Google Tag Manager", patterns: [/google tag manager|gtm/i], jurisdiction: "US" },
    { name: "Google Ads", patterns: [/google ads|adwords|doubleclick/i], jurisdiction: "US" },
    { name: "Meta Pixel / Facebook", patterns: [/meta pixel|facebook pixel|facebook (connect|sdk)/i], jurisdiction: "US/IE" },
    { name: "TikTok Pixel", patterns: [/tiktok pixel/i], jurisdiction: "CN/IE" },
    { name: "Hotjar", patterns: [/hotjar/i], jurisdiction: "MT" },
    { name: "Mouseflow", patterns: [/mouseflow/i], jurisdiction: "DK" },
    { name: "FullStory", patterns: [/fullstory/i], jurisdiction: "US" },
    { name: "Microsoft Clarity", patterns: [/microsoft clarity\b/i, /\bclarity\.ms/i], jurisdiction: "US" },
    { name: "Adobe Analytics", patterns: [/adobe analytics|adobe experience/i], jurisdiction: "US" },
    { name: "Segment", patterns: [/segment\.(?:com|io)|twilio segment/i], jurisdiction: "US" },
    { name: "Amplitude", patterns: [/amplitude/i], jurisdiction: "US" },
    { name: "Mixpanel", patterns: [/mixpanel/i], jurisdiction: "US" },
    { name: "Criteo", patterns: [/criteo/i], jurisdiction: "FR" },
    { name: "Salesforce", patterns: [/salesforce/i], jurisdiction: "US" },
    { name: "HubSpot", patterns: [/hubspot/i], jurisdiction: "US" },
    { name: "Mailchimp", patterns: [/mailchimp/i], jurisdiction: "US" },
    { name: "Intercom", patterns: [/intercom/i], jurisdiction: "US" },
    { name: "Zendesk", patterns: [/zendesk/i], jurisdiction: "US" },
    { name: "AWS / Amazon Web Services", patterns: [/aws\b|amazon web services/i], jurisdiction: "US" },
    { name: "Google Cloud", patterns: [/google cloud/i], jurisdiction: "US" },
    { name: "Microsoft Azure", patterns: [/azure\b/i], jurisdiction: "US" },
    { name: "Cloudflare", patterns: [/cloudflare/i], jurisdiction: "US" },
    { name: "Stripe", patterns: [/stripe\b/i], jurisdiction: "US" },
    { name: "Adyen", patterns: [/adyen/i], jurisdiction: "NL" },
    { name: "PayPal", patterns: [/paypal/i], jurisdiction: "US/LU" },
    { name: "OneTrust", patterns: [/onetrust/i], jurisdiction: "US" },
    { name: "Cookiebot", patterns: [/cookiebot|cybot/i], jurisdiction: "DK" },
    { name: "Didomi", patterns: [/didomi/i], jurisdiction: "FR" },
    { name: "Usercentrics", patterns: [/usercentrics/i], jurisdiction: "DE" },
    { name: "Fingerprint Pro / FingerprintJS", patterns: [/fingerprint(?:js|\s*pro)/i], jurisdiction: "US" },
    { name: "Sift", patterns: [/sift\.(?:com|science)/i], jurisdiction: "US" },
    { name: "SEON", patterns: [/seon\.io/i], jurisdiction: "HU" },
  ];

  // Domain → name lookup (rough)
  const domainNameHints = {
    "google-analytics.com": "Google Analytics",
    "googletagmanager.com": "Google Tag Manager",
    "doubleclick.net": "Google Ads",
    "googleadservices.com": "Google Ads",
    "facebook.net": "Meta Pixel / Facebook",
    "facebook.com": "Meta Pixel / Facebook",
    "connect.facebook.net": "Meta Pixel / Facebook",
    "tiktok.com": "TikTok Pixel",
    "hotjar.com": "Hotjar",
    "clarity.ms": "Microsoft Clarity",
    "amplitude.com": "Amplitude",
    "mixpanel.com": "Mixpanel",
    "criteo.com": "Criteo",
    "criteo.net": "Criteo",
    "segment.com": "Segment",
    "segment.io": "Segment",
    "intercom.io": "Intercom",
    "zendesk.com": "Zendesk",
    "hubspot.com": "HubSpot",
    "stripe.com": "Stripe",
    "cloudflare.com": "Cloudflare",
    "onetrust.com": "OneTrust",
    "cookiebot.com": "Cookiebot",
    "didomi.io": "Didomi",
    "usercentrics.eu": "Usercentrics",
    "fpjs.io": "Fingerprint Pro / FingerprintJS",
  };

  const namedInPolicy = [];
  for (const p of processorCatalog) {
    if (p.patterns.some((re) => re.test(combined))) {
      namedInPolicy.push({ name: p.name, jurisdiction: p.jurisdiction });
    }
  }
  // Detect on site (from third party domains)
  const detectedOnSite = new Set();
  for (const td of thirdPartyDomains || []) {
    const host = (td.domain || "").toLowerCase();
    for (const [dom, name] of Object.entries(domainNameHints)) {
      if (host === dom || host.endsWith("." + dom)) {
        detectedOnSite.add(name);
      }
    }
  }
  const detectedList = Array.from(detectedOnSite);
  const namedSet = new Set(namedInPolicy.map((p) => p.name));
  const undisclosed = detectedList.filter((n) => !namedSet.has(n));
  const dpaReferenced = /\b(data processing agreement|dpa\b|art(?:icle|\.)?\s*28)\b/i.test(combined);
  const subProcessorsDisclosed = /\b(sub[- ]?processor|sub[- ]?contractor)\b/i.test(combined);
  // Joint controller scenarios
  const jointControllers = [];
  if (detectedOnSite.has("Meta Pixel / Facebook")) {
    const disclosed = /\bjoint controller|gezamenlijke verwerkingsverantwoordelijke|art(?:icle|\.)?\s*26\b/i.test(combined);
    jointControllers.push({ processor: "Meta Pixel / Facebook", type: "Pixel/Like-button", disclosed });
  }
  const processors = {
    namedInPolicy,
    detectedOnSite: detectedList,
    undisclosed,
    dpaReferenced,
    subProcessorsDisclosed,
    jointControllerScenarios: jointControllers,
  };

  // ── Breach notification ──
  const breach = {
    securityTxtPresent: !!securityTxt?.present,
    securityTxtExpired: securityTxt?.expired ?? null,
    securityTxtFields: securityTxt?.fields || {},
    dpaNotificationCommitment: /\b(72\s*hours|72\s*hour|three\s+days|72\s*uur|drie\s+dagen)\b/i.test(combined) && /\b(notif|notify|inform|informeren|melden)/i.test(combined),
    individualNotificationCommitment: /\b(notify (you|affected (users|individuals|customers|data subjects))|inform you of (a )?(data )?breach|hoog risico)\b/i.test(combined),
    delayTacticLanguage: [],
  };
  const delayPatterns = [
    /\bwhen we deem (it )?(appropriate|necessary)\b/i,
    /\bif we determine (notification is )?(necessary|appropriate)\b/i,
    /\bat our (sole )?discretion\b.{0,40}(breach|notif)/i,
  ];
  for (const re of delayPatterns) {
    const m = combined.match(re);
    if (m) breach.delayTacticLanguage.push(m[0].slice(0, 120));
  }

  // ── Opt-out / Art. 7(3) ──
  const optOut = {
    unsubscribeMentioned: /\bunsubscribe|opt[- ]out|opt out|uitschrijven|afmelden\b/i.test(combined),
    art21Disclosed: dsar.art21Disclosed,
    withdrawAsEasyAsConsent: /\b(as easy to withdraw as.{0,30}consent|withdrawal.{0,30}as easy as|even (eenvoudig|gemakkelijk).{0,30}intrekken)\b/i.test(combined),
    legitimateInterestsObjectionContact: /\blegitimate interest.{0,80}(contact|email|object)/i.test(combined),
    preferenceCenterMentioned: /\b(preference center|marketing preferences|email preferences|notification settings)\b/i.test(combined),
  };

  return {
    policyTextAvailable: policyLen > 0,
    policyLength: policyLen,
    dsar,
    processors,
    breach,
    optOut,
  };
}

// ───────────────────────────────────────────
// Form data leakage detection
// ───────────────────────────────────────────
async function detectFormLeakage(page) {
  try {
    // Find forms with input fields
    const formInfo = await page.evaluate(() => {
      const forms = document.querySelectorAll("form");
      const targetForms = [];
      for (const form of forms) {
        const inputs = form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="password"], input:not([type])');
        if (inputs.length === 0) continue;
        // Only visible forms
        if (form.offsetHeight === 0) continue;
        const fields = Array.from(inputs).map(inp => ({
          type: inp.type || "text",
          name: inp.name || inp.id || "",
          visible: inp.offsetHeight > 0,
        })).filter(f => f.visible);
        if (fields.length > 0) {
          targetForms.push({ fields, formAction: form.action || "" });
        }
      }
      return targetForms;
    });

    if (formInfo.length === 0) {
      return { formsFound: 0, fieldsInjected: 0, leaks: [] };
    }

    const canaryTimestamp = Date.now();
    const canaryEmail = `privacyscan-test-${canaryTimestamp}@example.com`;
    const canaryPhone = "+31612345678";
    const canaryName = `PrivacyScanTest${canaryTimestamp}`;

    // Monitor network for canary values
    const leaks = [];
    const leakListener = (req) => {
      const reqUrl = req.url();
      const postData = req.postData() || "";
      const searchIn = reqUrl + " " + postData;

      if (searchIn.includes(canaryEmail) || searchIn.includes(String(canaryTimestamp)) || searchIn.includes(canaryPhone)) {
        let reqDomain;
        try { reqDomain = new URL(reqUrl).hostname; } catch { reqDomain = "unknown"; }
        leaks.push({
          field: searchIn.includes(canaryEmail) ? "email" : searchIn.includes(canaryPhone) ? "phone" : "name",
          destination: reqDomain,
          url: reqUrl.substring(0, 200),
        });
      }
    };
    page.on("request", leakListener);

    // Inject canary values into the first form's fields
    console.error(`[Form Leakage] Testing ${formInfo.length} form(s)...`);
    await page.evaluate(({ email, phone, name }) => {
      const inputs = document.querySelectorAll('input[type="email"], input[type="text"], input[type="tel"], input:not([type])');
      for (const inp of inputs) {
        if (inp.offsetHeight === 0) continue;
        try {
          const type = inp.type || inp.getAttribute("type") || "";
          const nameAttr = (inp.name || inp.placeholder || "").toLowerCase();
          let value = name;
          if (type === "email" || nameAttr.includes("email")) value = email;
          else if (type === "tel" || nameAttr.includes("phone") || nameAttr.includes("tel")) value = phone;

          // Set value without submitting
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(inp, value);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        } catch { }
      }
    }, { email: canaryEmail, phone: canaryPhone, name: canaryName });

    // Wait for any exfiltration
    await page.waitForTimeout(3000);

    // Clean up: clear fields and remove listener
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="email"], input[type="text"], input[type="tel"], input:not([type])');
      for (const inp of inputs) {
        try {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(inp, '');
          inp.dispatchEvent(new Event('input', { bubbles: true }));
        } catch { }
      }
    });
    page.removeListener("request", leakListener);

    const totalFields = formInfo.reduce((sum, f) => sum + f.fields.length, 0);
    return {
      formsFound: formInfo.length,
      fieldsInjected: totalFields,
      leaks: leaks,
    };
  } catch (err) {
    console.error(`[Form Leakage] Error: ${err.message}`);
    return { formsFound: 0, fieldsInjected: 0, leaks: [] };
  }
}

// ───────────────────────────────────────────
// Consent revocation testing (Phase 3)
// ───────────────────────────────────────────
async function testConsentRevocation(page, consentInfo) {
  const result = {
    mechanismFound: false,
    mechanismType: "not-found",
    acceptanceClicks: 1, // We already clicked accept once
    revocationClicks: 0,
    cookiesBefore: 0,
    cookiesAfter: 0,
    trackingCookiesDeleted: false,
    trackingCookiesRemaining: [],
    newRequestsAfterRevocation: 0,
  };

  try {
    // Record baseline
    const baselineCookies = await page.context().cookies();
    result.cookiesBefore = baselineCookies.length;
    const trackingCookiesBefore = baselineCookies.filter(c =>
      classifyCookiePurpose(c.name, c.domain) === "tracking" ||
      classifyCookiePurpose(c.name, c.domain) === "analytics"
    ).map(c => c.name);

    // Try CMP API first (most reliable)
    let clicked = false;
    const cmpApis = [
      { name: "OneTrust", check: "typeof OneTrust !== 'undefined'", call: "OneTrust.ToggleInfoDisplay()" },
      { name: "Cookiebot", check: "typeof Cookiebot !== 'undefined'", call: "Cookiebot.renew()" },
      { name: "Didomi", check: "typeof Didomi !== 'undefined'", call: "Didomi.preferences.show()" },
    ];

    for (const cmp of cmpApis) {
      const exists = await page.evaluate(cmp.check).catch(() => false);
      if (exists) {
        console.error(`[Revocation] Found ${cmp.name} API, invoking...`);
        await page.evaluate(cmp.call).catch(() => { });
        await page.waitForTimeout(1500);
        result.mechanismFound = true;
        result.mechanismType = "cmp-api";
        result.revocationClicks = 1;

        // Look for reject/deny all button in the re-opened banner
        const rejectClicked = await page.evaluate(() => {
          const rejectTexts = /^(reject|decline|refuse|deny|weiger|reject all|decline all|deny all|refuse all|alleen noodzakelijke|save|opslaan)$/i;
          const buttons = document.querySelectorAll('button, [role="button"], input[type="button"]');
          for (const btn of buttons) {
            if (btn.offsetHeight > 0 && rejectTexts.test(btn.textContent.trim())) {
              btn.click();
              return true;
            }
          }
          // Try unchecking all toggles
          const toggles = document.querySelectorAll('input[type="checkbox"]:checked');
          let unchecked = 0;
          for (const t of toggles) {
            // Skip "necessary" toggles that are usually disabled
            if (t.disabled) continue;
            t.click();
            unchecked++;
          }
          if (unchecked > 0) {
            // Look for save/confirm button
            const saveTexts = /^(save|confirm|opslaan|bevestigen|apply)$/i;
            for (const btn of buttons) {
              if (btn.offsetHeight > 0 && saveTexts.test(btn.textContent.trim())) {
                btn.click();
                return true;
              }
            }
          }
          return false;
        });

        if (rejectClicked) {
          result.revocationClicks++;
          clicked = true;
        }
        break;
      }
    }

    // Fall back to footer link scanning
    if (!clicked) {
      console.error("[Revocation] No CMP API found, scanning footer links...");
      const footerLink = await page.evaluate(() => {
        const linkTexts = /cookie.?settings|privacy.?preferences|manage.?cookies|cookie.?instellingen|cookie.?beheren/i;
        // Look in footer area first
        const footerEls = document.querySelectorAll('footer, [role="contentinfo"]');
        for (const footer of footerEls) {
          const links = footer.querySelectorAll("a, button");
          for (const link of links) {
            if (linkTexts.test(link.textContent.trim()) && link.offsetHeight > 0) {
              return { found: true, text: link.textContent.trim() };
            }
          }
        }
        // Check for floating widget (OneTrust, etc.)
        const floatingBtns = document.querySelectorAll('#ot-sdk-btn-floating, .cky-btn-revisit, [class*="cookie-settings"]');
        for (const btn of floatingBtns) {
          if (btn.offsetHeight > 0) {
            return { found: true, text: "floating-widget" };
          }
        }
        // Last resort: scan all visible links
        const allLinks = document.querySelectorAll("a, button");
        for (const link of allLinks) {
          if (linkTexts.test(link.textContent.trim()) && link.offsetHeight > 0) {
            return { found: true, text: link.textContent.trim() };
          }
        }
        return { found: false };
      });

      if (footerLink.found) {
        result.mechanismFound = true;
        result.mechanismType = footerLink.text === "floating-widget" ? "floating-widget" : "footer-link";
        result.revocationClicks = 1;

        // Click the link
        try {
          const linkTexts = /cookie.?settings|privacy.?preferences|manage.?cookies|cookie.?instellingen|cookie.?beheren/i;
          if (footerLink.text === "floating-widget") {
            await page.click('#ot-sdk-btn-floating, .cky-btn-revisit, [class*="cookie-settings"]', { timeout: 3000 });
          } else {
            // Click by text matching
            const clicked = await page.evaluate((pattern) => {
              const links = document.querySelectorAll("a, button");
              const re = new RegExp(pattern, "i");
              for (const link of links) {
                if (re.test(link.textContent.trim()) && link.offsetHeight > 0) {
                  link.click();
                  return true;
                }
              }
              return false;
            }, linkTexts.source);
            if (!clicked) throw new Error("Could not click footer link");
          }

          await page.waitForTimeout(2000);
          result.revocationClicks++;

          // Try to reject all in the re-opened banner
          const rejected = await page.evaluate(() => {
            const rejectTexts = /^(reject|decline|refuse|deny|weiger|reject all|decline all|deny all|refuse all|alleen noodzakelijke)$/i;
            const buttons = document.querySelectorAll('button, [role="button"]');
            for (const btn of buttons) {
              if (btn.offsetHeight > 0 && rejectTexts.test(btn.textContent.trim())) {
                btn.click();
                return true;
              }
            }
            return false;
          });
          if (rejected) {
            result.revocationClicks++;
            clicked = true;
          }
        } catch (err) {
          console.error(`[Revocation] Footer link click failed: ${err.message}`);
        }
      }
    }

    if (!result.mechanismFound) {
      console.error("[Revocation] No revocation mechanism found");
      return result;
    }

    // Wait for cookie deletion
    console.error("[Revocation] Waiting for cookie changes...");

    // Monitor post-revocation network activity
    let postRevocationRequests = 0;
    const revocationListener = (req) => { postRevocationRequests++; };
    page.on("request", revocationListener);

    await page.waitForTimeout(5000);

    page.removeListener("request", revocationListener);
    result.newRequestsAfterRevocation = postRevocationRequests;

    // Check cookies after revocation
    const afterCookies = await page.context().cookies();
    result.cookiesAfter = afterCookies.length;
    const afterCookieNames = new Set(afterCookies.map(c => c.name));

    // Check which tracking cookies were deleted
    const remaining = trackingCookiesBefore.filter(name => afterCookieNames.has(name));
    result.trackingCookiesRemaining = remaining;
    result.trackingCookiesDeleted = remaining.length < trackingCookiesBefore.length;

  } catch (err) {
    console.error(`[Revocation] Error: ${err.message}`);
    result.mechanismFound = false;
    result.mechanismType = "error";
  }

  return result;
}

// ───────────────────────────────────────────
// Legal pages detection
// ───────────────────────────────────────────
async function findLegalPages(page, origin) {
  const legalKeywords = [
    "privacy",
    "cookie",
    "terms",
    "conditions",
    "impressum",
    "imprint",
    "legal",
    "datenschutz",
    "privacyverklaring",
    "privacybeleid",
    "politique-de-confidentialite",
    "informativa-privacy",
    "aviso-legal",
    "disclaimer",
    "data-protection",
    "gdpr",
    "ccpa",
    // DSAR and data subject rights
    "data-request",
    "dsar",
    "subject-access",
    "access-request",
    "data-subject",
    "erasure",
    "delete-my-data",
    "right-to-delete",
    "forget-me",
    "portability",
    "download-my-data",
    "export-data",
    "preferences",
    "privacy-center",
    "privacy-dashboard",
    "my-data",
    "opt-out",
    "do-not-sell",
    "unsubscribe",
  ];

  try {
    const links = await page.evaluate(
      ({ keywords, origin }) => {
        const found = [];
        const seen = new Set();
        const allLinks = document.querySelectorAll("a[href]");

        allLinks.forEach((a) => {
          const href = a.href;
          const text = (a.textContent || "").trim().toLowerCase();
          const hrefLower = href.toLowerCase();

          const matches = keywords.some(
            (kw) => text.includes(kw) || hrefLower.includes(kw)
          );
          if (matches && !seen.has(href)) {
            seen.add(href);
            found.push({
              url: href,
              text: (a.textContent || "").trim().substring(0, 100),
              type: keywords.find(
                (kw) => text.includes(kw) || hrefLower.includes(kw)
              ),
            });
          }
        });
        return found;
      },
      { keywords: legalKeywords, origin }
    );

    return links;
  } catch {
    return [];
  }
}

// ───────────────────────────────────────────
// Meta tags extraction
// ───────────────────────────────────────────
async function extractMetaTags(page) {
  try {
    return await page.evaluate(() => {
      const tags = {};
      const metas = document.querySelectorAll("meta");

      metas.forEach((meta) => {
        const name =
          meta.getAttribute("name") ||
          meta.getAttribute("property") ||
          meta.getAttribute("http-equiv");
        const content = meta.getAttribute("content");
        if (name && content) {
          tags[name] = content.substring(0, 500);
        }
      });

      tags["title"] = document.title;
      return tags;
    });
  } catch {
    return {};
  }
}

// ───────────────────────────────────────────
// TLS certificate info
// ───────────────────────────────────────────
function getTlsInfo(hostname, port) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: hostname, port: parseInt(port), servername: hostname },
      () => {
        const cert = socket.getPeerCertificate();
        const protocol = socket.getProtocol();
        const cipher = socket.getCipher();

        resolve({
          protocol,
          cipher: cipher
            ? { name: cipher.name, version: cipher.version }
            : null,
          certificate: {
            subject: cert.subject,
            issuer: cert.issuer,
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            serialNumber: cert.serialNumber,
            fingerprint256: cert.fingerprint256,
          },
        });

        socket.end();
      }
    );

    socket.setTimeout(10_000);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("TLS connection timed out"));
    });
    socket.on("error", (err) => reject(err));
  });
}

// ───────────────────────────────────────────
// Auto-scroll to trigger lazy-loaded content
// ───────────────────────────────────────────
async function autoScroll(page) {
  await page.evaluate(async () => {
    const distance = 400;
    const maxScrolls = 10;
    let scrolls = 0;

    while (scrolls < maxScrolls) {
      window.scrollBy(0, distance);
      await new Promise((r) => setTimeout(r, 300));
      scrolls++;

      if (window.scrollY + window.innerHeight >= document.body.scrollHeight) {
        break;
      }
    }

    // Scroll back to top
    window.scrollTo(0, 0);
  });
}

// ───────────────────────────────────────────
// ───────────────────────────────────────────
// Jurisdiction + tracker enrichment database
// Embeds data from references/*.md so Claude
// doesn't need to read those files (~5.5K tokens saved)
// ───────────────────────────────────────────
const DOMAIN_JURISDICTION = {
  // US (High risk without DPF)
  "google.com": { company: "Google LLC", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "googleapis.com": { company: "Google LLC", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "googletagmanager.com": { company: "Google LLC", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "google-analytics.com": { company: "Google LLC", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "doubleclick.net": { company: "Google LLC", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "gstatic.com": { company: "Google LLC", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "youtube.com": { company: "Google LLC", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "googlesyndication.com": { company: "Google LLC", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "googleadservices.com": { company: "Google LLC", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "facebook.com": { company: "Meta Platforms", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "facebook.net": { company: "Meta Platforms", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "connect.facebook.net": { company: "Meta Platforms", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "fbcdn.net": { company: "Meta Platforms", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "instagram.com": { company: "Meta Platforms", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "microsoft.com": { company: "Microsoft", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "bing.com": { company: "Microsoft", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "clarity.ms": { company: "Microsoft", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "linkedin.com": { company: "Microsoft", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "licdn.com": { company: "Microsoft", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "snap.licdn.com": { company: "Microsoft", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "bat.bing.com": { company: "Microsoft", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "amazonaws.com": { company: "Amazon", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "cloudfront.net": { company: "Amazon", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "cloudflare.com": { company: "Cloudflare", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "cloudflareinsights.com": { company: "Cloudflare", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "amplitude.com": { company: "Amplitude", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "segment.com": { company: "Twilio/Segment", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "segment.io": { company: "Twilio/Segment", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "mixpanel.com": { company: "Mixpanel", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "fullstory.com": { company: "FullStory", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "hubspot.com": { company: "HubSpot", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "hsforms.com": { company: "HubSpot", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "hs-analytics.net": { company: "HubSpot", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "intercom.io": { company: "Intercom", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "newrelic.com": { company: "New Relic", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "nr-data.net": { company: "New Relic", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "sentry.io": { company: "Sentry", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "twitter.com": { company: "X Corp", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: false },
  "t.co": { company: "X Corp", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: false },
  "pinterest.com": { company: "Pinterest", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "stripe.com": { company: "Stripe", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "js.stripe.com": { company: "Stripe", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  // EU (Low risk)
  "hotjar.com": { company: "Hotjar", country: "EU (Malta)", flag: "\u{1F1EA}\u{1F1FA}", dpf: false, adequate: true },
  "hotjar.io": { company: "Hotjar", country: "EU (Malta)", flag: "\u{1F1EA}\u{1F1FA}", dpf: false, adequate: true },
  "criteo.com": { company: "Criteo", country: "EU (France)", flag: "\u{1F1EA}\u{1F1FA}", dpf: false, adequate: true },
  "criteo.net": { company: "Criteo", country: "EU (France)", flag: "\u{1F1EA}\u{1F1FA}", dpf: false, adequate: true },
  "plausible.io": { company: "Plausible", country: "EU (Estonia)", flag: "\u{1F1EA}\u{1F1FA}", dpf: false, adequate: true },
  "cookiebot.com": { company: "Cookiebot", country: "EU (Denmark)", flag: "\u{1F1EA}\u{1F1FA}", dpf: false, adequate: true },
  "usercentrics.eu": { company: "Usercentrics", country: "EU (Germany)", flag: "\u{1F1EA}\u{1F1FA}", dpf: false, adequate: true },
  "didomi.io": { company: "Didomi", country: "EU (France)", flag: "\u{1F1EA}\u{1F1FA}", dpf: false, adequate: true },
  "cookielaw.org": { company: "OneTrust", country: "US (EU processing)", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "onetrust.com": { company: "OneTrust", country: "US (EU processing)", flag: "\u{1F1FA}\u{1F1F8}", dpf: true },
  "mouseflow.com": { company: "Mouseflow", country: "EU (Denmark)", flag: "\u{1F1EA}\u{1F1FA}", dpf: false, adequate: true },
  // China (Very high risk)
  "tiktok.com": { company: "ByteDance", country: "CN", flag: "\u{1F1E8}\u{1F1F3}", dpf: false },
  "tiktokcdn.com": { company: "ByteDance", country: "CN", flag: "\u{1F1E8}\u{1F1F3}", dpf: false },
  // Adequate countries
  "taboola.com": { company: "Taboola", country: "IL", flag: "\u{1F1EE}\u{1F1F1}", dpf: false, adequate: true },
  "outbrain.com": { company: "Outbrain", country: "IL", flag: "\u{1F1EE}\u{1F1F1}", dpf: false, adequate: true },
  "shopify.com": { company: "Shopify", country: "CA", flag: "\u{1F1E8}\u{1F1E6}", dpf: false, adequate: true },
  // CDN / Infrastructure (not trackers)
  "cdnjs.cloudflare.com": { company: "Cloudflare CDN", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true, infra: true },
  "cdn.jsdelivr.net": { company: "jsDelivr", country: "EU", flag: "\u{1F1EA}\u{1F1FA}", dpf: false, infra: true },
  "unpkg.com": { company: "Cloudflare", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true, infra: true },
  "fonts.gstatic.com": { company: "Google Fonts", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true, infra: true },
  "fonts.googleapis.com": { company: "Google Fonts", country: "US", flag: "\u{1F1FA}\u{1F1F8}", dpf: true, infra: true },
};

function lookupJurisdiction(domain) {
  // Direct match
  if (DOMAIN_JURISDICTION[domain]) return DOMAIN_JURISDICTION[domain];
  // Try parent domain (e.g., "c.clarity.ms" -> "clarity.ms")
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".");
    if (DOMAIN_JURISDICTION[parent]) return DOMAIN_JURISDICTION[parent];
  }
  // TLD heuristics
  const tld = parts.slice(-1)[0];
  const tld2 = parts.slice(-2).join(".");
  const euTlds = ["de", "nl", "fr", "it", "es", "be", "at", "se", "dk", "no", "fi", "pl", "cz", "ie", "pt"];
  if (euTlds.includes(tld)) return { company: "Unknown", country: "EU", flag: "\u{1F1EA}\u{1F1FA}", adequate: true };
  if (tld === "uk" || tld2 === "co.uk") return { company: "Unknown", country: "UK", flag: "\u{1F1EC}\u{1F1E7}", adequate: true };
  if (tld === "ch") return { company: "Unknown", country: "CH", flag: "\u{1F1E8}\u{1F1ED}", adequate: true };
  if (tld === "jp") return { company: "Unknown", country: "JP", flag: "\u{1F1EF}\u{1F1F5}", adequate: true };
  if (tld === "cn") return { company: "Unknown", country: "CN", flag: "\u{1F1E8}\u{1F1F3}" };
  if (tld === "ru") return { company: "Unknown", country: "RU", flag: "\u{1F1F7}\u{1F1FA}" };
  return null;
}

function classifyTransferRisk(jInfo) {
  if (!jInfo) return "risk";
  if (jInfo.adequate) return "safe";
  if (jInfo.dpf) return "dpf";
  if (jInfo.country === "CN" || jInfo.country === "RU") return "risk";
  return "risk";
}

// Cookie purpose classification
function classifyCookiePurpose(name, domain) {
  const n = name.toLowerCase();
  // Essential
  if (/^(csrf|xsrf|__cf_bm|__cflb|_cfuvid|session|sid|connect\.sid)$/i.test(n)) return "essential";
  if (/^(PHPSESSID|JSESSIONID|ASP\.NET_SessionId)$/i.test(n)) return "essential";
  // Analytics
  if (/^_ga/.test(n) || /^_gid$/.test(n) || /^_gat/.test(n)) return "analytics";
  if (/^_pk_/.test(n) || /^_hj/.test(n) || /^_clsk$/.test(n) || /^_clck$/.test(n)) return "analytics";
  if (/^amp_/.test(n) || /^amplitude_/.test(n)) return "analytics";
  if (/^mp_/.test(n) || /^mixpanel/.test(n)) return "analytics";
  if (/^ajs_/.test(n)) return "analytics";
  // Tracking / Advertising
  if (/^_fbp$/.test(n) || /^_fbc$/.test(n)) return "tracking";
  if (/^IDE$/.test(n) || /^DSID$/.test(n) || /^_gcl_/.test(n)) return "tracking";
  if (/^li_sugr$/.test(n) || /^UserMatchHistory$/.test(n) || /^bcookie$/.test(n)) return "tracking";
  if (/^_ttp$/.test(n) || /^_pin_/.test(n) || /^_pinterest/.test(n)) return "tracking";
  if (/^_uetsid$/.test(n) || /^_uetvid$/.test(n)) return "tracking";
  if (/^cto_/.test(n) || /^uuid2$/.test(n) || /^demdex$/.test(n)) return "tracking";
  if (/^__hs/.test(n) || /^hubspotutk$/.test(n)) return "tracking";
  if (/^intercom-/.test(n)) return "tracking";
  // Functional
  if (/^(lang|locale|currency|theme|mode|dark|consent|OptanonConsent|CookieConsent|eupubconsent)$/i.test(n)) return "functional";
  return "unknown";
}

// Cookie duration in days
function cookieDurationDays(expires) {
  if (!expires || expires === "Session" || expires === "session") return 0;
  const match = String(expires).match(/(\d+)\s*(year|yr|month|mo|week|wk|day|d|hour|hr|h|min|m|sec|s)/i);
  if (match) {
    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit.startsWith("year") || unit === "yr") return val * 365;
    if (unit.startsWith("month") || unit === "mo") return val * 30;
    if (unit.startsWith("week") || unit === "wk") return val * 7;
    if (unit.startsWith("day") || unit === "d") return val;
    if (unit.startsWith("hour") || unit === "hr" || unit === "h") return val / 24;
    if (unit.startsWith("min") || unit === "m") return val / 1440;
    return val;
  }
  // Try parsing as date
  const d = new Date(expires);
  if (!isNaN(d.getTime())) {
    return Math.max(0, Math.round((d.getTime() - Date.now()) / 86400000));
  }
  return 0;
}

function formatDuration(days) {
  if (days === 0) return "Session";
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}

// Build compact summary for LLM analysis
//
// The raw JSON can be 2000+ lines. This summary
// distills it to ~100 lines of key findings that
// Claude can read in one shot.
// ───────────────────────────────────────────
function buildSummary(variantResult, parentResult) {
  if (!variantResult) return null;
  const pre = variantResult.preConsent || {};
  const post = variantResult.postConsent || {};
  const headers = variantResult.securityHeaders || {};

  // Deduplicate trackers by name
  const uniqueTrackers = (list) => {
    const seen = new Map();
    for (const t of list || []) {
      const key = t.name;
      if (!seen.has(key)) seen.set(key, { ...t, count: 1 });
      else seen.get(key).count++;
    }
    return Array.from(seen.values());
  };

  // New cookies in post that weren't in pre
  const preCookieNames = new Set((pre.cookies || []).map(c => c.name));
  const newPostCookies = (post.cookies || []).filter(c => !preCookieNames.has(c.name));

  // Security headers check
  const SECURITY_HEADERS = [
    'strict-transport-security', 'content-security-policy',
    'x-content-type-options', 'x-frame-options',
    'referrer-policy', 'permissions-policy'
  ];
  const presentHeaders = SECURITY_HEADERS.filter(h => headers[h]);
  const missingHeaders = SECURITY_HEADERS.filter(h => !headers[h]);

  // Third-party domains (non-first-party)
  const domain = parentResult.meta.domain;
  const thirdPartyPre = (pre.thirdPartyDomains || []).filter(
    d => !d.domain.includes(domain.replace('www.', ''))
  );

  return {
    // Key counts — three tiers
    preConsentTrackerCount: (pre.trackers || []).length,
    preConsentConsentModePingCount: (pre.consentModePings || []).length,
    preConsentSdkLoadCount: (pre.sdkLoads || []).length,
    preConsentCookieCount: (pre.cookies || []).length,
    postConsentNewTrackerCount: (post.trackers || []).length - (pre.trackers || []).length,
    postConsentNewCookieCount: newPostCookies.length,
    thirdPartyDomainCount: thirdPartyPre.length,
    securityHeaderScore: `${presentHeaders.length}/${SECURITY_HEADERS.length}`,

    // Tier 3: Full tracking fires (clear violations)
    preConsentTrackers: uniqueTrackers(pre.trackers).map(t => {
      const jInfo = lookupJurisdiction(t.domain);
      return {
        name: t.name,
        category: t.category,
        count: t.count,
        domain: t.domain,
        resourceType: t.resourceType,
        jurisdiction: jInfo ? jInfo.country : "Unknown",
        company: jInfo ? jInfo.company : null,
        flag: jInfo ? jInfo.flag : null,
        transferRisk: classifyTransferRisk(jInfo),
        gdprArticles: ["ePrivacy 5(3)", "Art. 6(1)(a)", "Art. 5(1)(a)"],
        is4thParty: t.is4thParty || false,
        loadedBy: t.loadedBy || null,
      };
    }),

    // Piggybacking summary
    piggybackingCount: (pre.trackers || []).filter(t => t.is4thParty).length,

    // Tier 2: Consent-mode pings (legally debatable)
    preConsentConsentModePings: uniqueTrackers(pre.consentModePings).map(p => {
      const jInfo = lookupJurisdiction(p.domain);
      return {
        name: p.name,
        category: p.category,
        count: p.count,
        domain: p.domain,
        reason: p.reason,
        dataTransmitted: p.dataTransmitted,
        jurisdiction: jInfo ? jInfo.country : "Unknown",
        transferRisk: classifyTransferRisk(jInfo),
      };
    }),

    // Tier 1: SDK/script loads (not violations)
    preConsentSdkLoads: uniqueTrackers(pre.sdkLoads).map(s => ({
      name: s.name,
      category: s.category,
      count: s.count,
    })),

    // Pre-consent cookies (enriched with purpose + duration)
    preConsentCookies: (pre.cookies || []).map(c => {
      const days = cookieDurationDays(c.expires);
      return {
        name: c.name,
        domain: c.domain,
        expires: c.expires,
        secure: c.secure,
        purpose: classifyCookiePurpose(c.name, c.domain),
        durationDays: days,
        durationLabel: formatDuration(days),
      };
    }),

    // New post-consent cookies (enriched)
    newPostConsentCookies: newPostCookies.map(c => {
      const days = cookieDurationDays(c.expires);
      return {
        name: c.name,
        domain: c.domain,
        expires: c.expires,
        secure: c.secure,
        purpose: classifyCookiePurpose(c.name, c.domain),
        durationDays: days,
        durationLabel: formatDuration(days),
      };
    }),

    // Consent mechanism
    consent: {
      detected: variantResult.consent?.detected || false,
      platform: variantResult.consent?.platform || null,
      darkPatterns: variantResult.consent?.darkPatterns || [],
      viaCookieWall: variantResult.consent?.viaCookieWall || false,
    },

    // Cookie wall
    cookieWall: variantResult.cookieWall
      ? {
        detected: true,
        type: variantResult.cookieWall.type,
        name: variantResult.cookieWall.name,
        wallDomain: variantResult.cookieWall.wallDomain,
        bypassed: variantResult.cookieWall.bypassSuccess || false,
        method: variantResult.cookieWall.bypassMethod || null,
      }
      : { detected: false },

    // Security headers
    securityHeaders: {
      present: presentHeaders.map(h => ({ name: h, value: headers[h] })),
      missing: missingHeaders,
    },

    // CORS policy
    cors: {
      allowOrigin: headers['access-control-allow-origin'] || null,
      allowCredentials: headers['access-control-allow-credentials'] || null,
      isWildcard: headers['access-control-allow-origin'] === '*',
      hasCredentialsWithWildcard:
        headers['access-control-allow-origin'] === '*' &&
        headers['access-control-allow-credentials'] === 'true',
    },

    // Legal pages
    legalPages: (parentResult.legalPages || []).map(l => ({
      type: l.type,
      text: l.text,
      url: l.url,
    })),

    // Third-party domains (sorted by request count, enriched with jurisdiction)
    thirdPartyDomains: thirdPartyPre
      .sort((a, b) => b.requestCount - a.requestCount)
      .map(d => {
        const jInfo = lookupJurisdiction(d.domain);
        return {
          domain: d.domain,
          requests: d.requestCount,
          categories: d.categories,
          jurisdiction: jInfo ? jInfo.country : "Unknown",
          company: jInfo ? jInfo.company : null,
          flag: jInfo ? jInfo.flag : null,
          transferRisk: classifyTransferRisk(jInfo),
          isInfra: jInfo ? !!jInfo.infra : false,
        };
      }),

    // TLS
    tls: parentResult.tls ? {
      protocol: parentResult.tls.protocol,
      cipher: parentResult.tls.cipher?.name,
      issuer: parentResult.tls.certificate?.issuer?.CN,
      validTo: parentResult.tls.certificate?.validTo,
    } : null,

    // Tracking pixels (enriched with beacon type)
    trackingPixelCount: (pre.trackingPixels || []).length,
    trackingPixels: (pre.trackingPixels || []).map(p => ({
      domain: p.domain,
      beaconType: p.beaconType || "unknown",
      url: p.url,
    })),

    // SRI coverage
    scriptIntegrity: (() => {
      const scripts = pre.scriptIntegrity || [];
      const withSRI = scripts.filter(s => s.hasIntegrity);
      return {
        totalExternal: scripts.length,
        withIntegrity: withSRI.length,
        coveragePercent: scripts.length > 0
          ? Math.round((withSRI.length / scripts.length) * 100) : 100,
        details: scripts.slice(0, 20),
      };
    })(),

    // localStorage/sessionStorage
    preConsentLocalStorage: Object.keys(pre.localStorage || {}),
    postConsentLocalStorage: Object.keys(post.localStorage || {}),

    // IndexedDB
    preConsentIndexedDB: (pre.indexedDB || { databases: [] }).databases,
    postConsentIndexedDB: (post.indexedDB || { databases: [] }).databases,

    // ─── New Phase 3 fields ───

    // TCF
    tcf: variantResult.tcf || { detected: false },

    // Google Consent Mode v2
    googleConsentMode: variantResult.googleConsentMode || { detected: false },

    // GPC
    gpc: variantResult.gpc || { signalSent: true, siteReadsSignal: false },

    // Fingerprinting
    fingerprinting: variantResult.fingerprinting || { detected: false, apiCalls: [], preConsent: false, callerDomains: [] },

    // Form leakage
    formLeakage: variantResult.formLeakage || { formsFound: 0, fieldsInjected: 0, leaks: [] },

    // Consent revocation
    consentRevocation: variantResult.consentRevocation || { mechanismFound: false, mechanismType: "not-tested" },

    // Consent granularity (from consent object)
    consentGranularity: variantResult.consent?.granularity || null,

    // Legal page content (privacy policy text for Claude analysis)
    legalPageContent: variantResult.legalPageContent || null,

    // security.txt (RFC 9116) — fetched only on the ignore variant
    securityTxt: variantResult.securityTxt || null,

    // Policy text analysis: DSAR, processors, breach notification, opt-out
    // Computed once on the ignore variant where legalPageContent is fetched.
    policyAnalysis: (() => {
      // Build third-party domain list from the same source the slide uses
      const tpDomains = (thirdPartyPre || []).map(d => ({ domain: d.domain }));
      try {
        return analyzePolicyText(
          variantResult.legalPageContent || null,
          tpDomains,
          variantResult.securityTxt || null
        );
      } catch (e) {
        return { policyTextAvailable: false, policyLength: 0, error: String(e.message || e) };
      }
    })(),

    // ─── Pre-computed fields (so Claude can skip raw preConsent/postConsent) ───

    // Request pulse: per-domain pre/post request counts for the Request Pulse slide
    requestPulse: (() => {
      const preCounts = new Map();
      const postCounts = new Map();
      const baseDomain = domain.replace('www.', '');
      for (const r of pre.networkRequests || []) {
        try {
          const d = new URL(r.url).hostname;
          if (d && !d.includes(baseDomain)) preCounts.set(d, (preCounts.get(d) || 0) + 1);
        } catch { }
      }
      for (const r of post.networkRequests || []) {
        try {
          const d = new URL(r.url).hostname;
          if (d && !d.includes(baseDomain)) postCounts.set(d, (postCounts.get(d) || 0) + 1);
        } catch { }
      }
      const allDomains = new Set([...preCounts.keys(), ...postCounts.keys()]);
      return Array.from(allDomains)
        .map(d => {
          const preCount = preCounts.get(d) || 0;
          const postCount = postCounts.get(d) || 0;
          const jInfo = lookupJurisdiction(d);
          return {
            domain: d,
            preConsent: preCount,
            postConsent: postCount,
            total: preCount + postCount,
            isInfra: jInfo ? !!jInfo.infra : false,
          };
        })
        .sort((a, b) => b.total - a.total);
    })(),

    // Post-consent third-party domains (enriched, like thirdPartyDomains but for post phase)
    postConsentThirdPartyDomains: (() => {
      const baseDomain = domain.replace('www.', '');
      return (post.thirdPartyDomains || [])
        .filter(d => !d.domain.includes(baseDomain))
        .sort((a, b) => b.requestCount - a.requestCount)
        .map(d => {
          const jInfo = lookupJurisdiction(d.domain);
          return {
            domain: d.domain,
            requests: d.requestCount,
            categories: d.categories,
            jurisdiction: jInfo ? jInfo.country : "Unknown",
            company: jInfo ? jInfo.company : null,
            flag: jInfo ? jInfo.flag : null,
            transferRisk: classifyTransferRisk(jInfo),
            isInfra: jInfo ? !!jInfo.infra : false,
          };
        });
    })(),

    // Post-consent trackers (enriched, mirrors preConsentTrackers)
    postConsentTrackers: uniqueTrackers(post.trackers).map(t => {
      const jInfo = lookupJurisdiction(t.domain);
      return {
        name: t.name,
        category: t.category,
        count: t.count,
        domain: t.domain,
        resourceType: t.resourceType,
        jurisdiction: jInfo ? jInfo.country : "Unknown",
        company: jInfo ? jInfo.company : null,
        flag: jInfo ? jInfo.flag : null,
        transferRisk: classifyTransferRisk(jInfo),
        is4thParty: t.is4thParty || false,
        loadedBy: t.loadedBy || null,
      };
    }),

    // Significant events: filtered request log for audit trail construction
    // Includes: tracker fires, tracking pixels, first contact per 3rd-party domain, consent events
    significantEvents: (() => {
      const baseDomain = domain.replace('www.', '');
      const seenDomains = new Set();
      const trackerDomains = new Set((pre.trackers || []).map(t => t.domain));
      const pixelDomains = new Set((pre.trackingPixels || []).map(p => p.domain));
      const events = [];

      const processRequests = (reqs, phase) => {
        if (!reqs || !reqs.length) return;
        const t0 = reqs[0].timestamp;
        for (const r of reqs) {
          let d;
          try { d = new URL(r.url).hostname; } catch { continue; }
          if (!d) continue;
          const isThirdParty = !d.includes(baseDomain);
          const isTracker = trackerDomains.has(d);
          const isPixel = pixelDomains.has(d);
          const isFirstContact = isThirdParty && !seenDomains.has(d);
          if (isFirstContact) seenDomains.add(d);

          // Include if: tracker fire, tracking pixel, or first 3rd-party contact
          if (isTracker || isPixel || isFirstContact) {
            const deltaMs = r.timestamp - t0;
            events.push({
              phase,
              time: deltaMs < 1000 ? `t+${deltaMs}ms` : `t+${(deltaMs / 1000).toFixed(1)}s`,
              timestamp: r.timestamp,
              domain: d,
              url: r.url.substring(0, 150),
              resourceType: r.resourceType,
              isTracker,
              isPixel,
              isFirstContact,
            });
          }
        }
      };

      processRequests(pre.networkRequests, "pre");
      // Reset seenDomains for post — we want first-contact-post-consent too
      seenDomains.clear();
      processRequests(post.networkRequests, "post");
      return events;
    })(),

    // Post-consent cookie count (total, not just new)
    postConsentCookieCount: (post.cookies || []).length,

    // Errors
    errors: parentResult.errors || [],
  };
}

// ───────────────────────────────────────────
// Build Overall Diff Summary
// ───────────────────────────────────────────
function buildOverallDiffSummary(result) {
  const sum = result.variantSummaries;
  if (!sum || !sum.ignore || !sum.accept || !sum.reject) return null;

  return {
    consentDetected: sum.ignore.consent.detected,
    platform: sum.ignore.consent.platform,
    variantComparison: {
      trackers: {
        ignorePhase1: sum.ignore.preConsentTrackerCount,
        ignorePhase2: sum.ignore.preConsentTrackerCount + sum.ignore.postConsentNewTrackerCount, // "Phase 2" of ignore is natural delayed load
        acceptPhase2: sum.accept.preConsentTrackerCount + sum.accept.postConsentNewTrackerCount,
        rejectPhase2: sum.reject.preConsentTrackerCount + sum.reject.postConsentNewTrackerCount,
      },
      cookies: {
        ignorePhase1: sum.ignore.preConsentCookieCount,
        ignorePhase2: sum.ignore.preConsentCookieCount + sum.ignore.postConsentNewCookieCount,
        acceptPhase2: sum.accept.preConsentCookieCount + sum.accept.postConsentNewCookieCount,
        rejectPhase2: sum.reject.preConsentCookieCount + sum.reject.postConsentNewCookieCount,
      }
    },
    darkPatterns: sum.ignore.consent.darkPatterns,
    details: {
      ...sum.accept,
      // legalPageContent is only captured during the ignore variant (to save time).
      // Inject it here so the summary always has it.
      legalPageContent: sum.ignore.legalPageContent || null,
      // securityTxt and policyAnalysis are computed only on the ignore variant
      // (their inputs are static for the site). Promote them so analysis-brief
      // and downstream consumers don't have to reach into per-variant data.
      securityTxt: sum.ignore.securityTxt || null,
      policyAnalysis: sum.ignore.policyAnalysis || null,
    }
  };
}

// ───────────────────────────────────────────
// Entry point
// ───────────────────────────────────────────

// Parse CLI args: node scan.js <url> [--scout] [--accept-text "..."] [--reject-text "..."] [--save-text "..."]
const args = process.argv.slice(2);
const isScoutMode = args.includes("--scout");
const targetUrl = args.find(a => !a.startsWith("--"));
if (!targetUrl) {
  console.error("Usage: node scan.js <url> [--scout] [--accept-text \"...\"] [--reject-text \"...\"] [--save-text \"...\"]");
  console.error("Example: node scan.js https://example.com");
  console.error("  --scout         Lightweight banner detection only (screenshot + candidate buttons)");
  console.error("  --accept-text   Button text for accepting all cookies (e.g. \"Alles accepteren\")");
  console.error("  --reject-text   Button text for rejecting all cookies (e.g. \"Alles weigeren\")");
  console.error("  --save-text     Button text for saving current toggle selections (e.g. \"Opslaan\")");
  console.error("\nWhen provided, these text hints are used as a fallback if automatic banner detection fails.");
  console.error("Claude reads the viewport screenshot and provides these hints for custom consent banners.");
  process.exit(1);
}

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const buttonHints = {
  acceptText: getArg("--accept-text"),
  rejectText: getArg("--reject-text"),
  saveText: getArg("--save-text"),
};

const hasHints = buttonHints.acceptText || buttonHints.rejectText || buttonHints.saveText;
if (hasHints) {
  console.error(`[Hints] Vision-assisted mode — button hints provided:`);
  if (buttonHints.acceptText) console.error(`  accept: "${buttonHints.acceptText}"`);
  if (buttonHints.rejectText) console.error(`  reject: "${buttonHints.rejectText}"`);
  if (buttonHints.saveText)   console.error(`  save:   "${buttonHints.saveText}"`);
}

// Normalize URL
let normalizedUrl = targetUrl;
if (!normalizedUrl.startsWith("http")) {
  normalizedUrl = "https://" + normalizedUrl;
}

if (isScoutMode) {
  scout(normalizedUrl).then((result) => {
    // Output JSON to stdout for Claude to parse
    console.log(JSON.stringify(result, null, 2));
  }).catch((err) => {
    console.error("Scout error:", err.message);
    process.exit(1);
  });
} else {
  scan(normalizedUrl, buttonHints).catch((err) => {
    console.error("Fatal error:", err.message);
    process.exit(1);
  });
}
