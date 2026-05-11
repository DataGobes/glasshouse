# Concept: Google Consent Mode v2

Google's signaling layer for consent-aware tag execution. Mandatory since March 2024 for advertisers using Google Ads, Floodlight, GA4 in the EEA — but compliant implementation is uneven.

## The Four Signals
A consent-mode-enabled site must call `gtag('consent', 'default', {...})` and `gtag('consent', 'update', {...})` with these four flags:

| Signal | What it gates |
|---|---|
| `analytics_storage` | Google Analytics 4 cookies + measurement |
| `ad_storage` | Google Ads, Floodlight, DoubleClick cookies |
| `ad_user_data` | Whether user data may be sent to Google for advertising purposes |
| `ad_personalization` | Whether data may be used for personalized ads / remarketing |

Each is `granted` or `denied`. `default` is set before any consent UI; `update` is called after the user interacts with the CMP.

## Scanner Detection

### Signal Presence
Inspect `dataLayer` and `window.google_tag_data.ics` post-consent. A compliant site:
- Sets all four signals (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`)
- Sets a meaningful default (typically all `denied`) before any tag fires
- Updates after consent interaction

### Tag Behavior Verification
The hard test: when `analytics_storage: denied` is set:
- No GA4 cookies (`_ga`, `_ga_*`) should be set
- No `collect?v=2` requests to `*.google-analytics.com`
- "Consent mode pings" (parameters like `gcs=G100`, `gcd=...`) MAY still be sent — these are **tier 2** in the three-tier classification (see pre-consent-tracking.md)

When `ad_storage: denied`:
- No `IDE` / `_gcl_au` / `NID` cookies
- No `googleadservices.com/pagead/conversion` calls

## Consent Mode "Basic" vs "Advanced"

| | Basic | Advanced |
|---|---|---|
| When tags load | Only after consent granted | Tags load immediately, gated by signals |
| Pre-consent pings | None | Modeled "pings" sent (cookieless) |
| Modeled conversions | No | Yes (Google ML fills gaps) |
| EU compliance posture | Conservative — clearly compliant | Debatable — pings still send IP and URL |

Most marketing teams want Advanced for the modeling. From an ePrivacy strict-reading perspective, the pings still constitute "gaining access to information stored in terminal equipment" (the IP/URL data) and require consent.

## Common Implementation Failures
1. **No GCMv2 at all** — Google tags fire without checking consent (most common before March 2024 compliance push)
2. **Only `analytics_storage` and `ad_storage`** set — missing the new `ad_user_data` / `ad_personalization` signals (introduced in v2)
3. **Default not set** — `update` called without prior `default`, which means the tag library's default-allowed behavior runs first
4. **Update not called** — Default is `denied`, user accepts, but the CMP never propagates the update
5. **Tags fire despite `denied`** — typically because GTM custom HTML tags bypass the consent check

## What the Scanner Reports
Surface in `findings.consent.gcmV2`:
```json
{
  "implemented": true,
  "signalsPresent": ["analytics_storage", "ad_storage", "ad_user_data", "ad_personalization"],
  "signalsMissing": [],
  "defaultSetBeforeTags": true,
  "updateCalledOnConsent": true,
  "behaviorVerified": {
    "ga4CookiesBlockedWhenDenied": true,
    "adCookiesBlockedWhenDenied": true,
    "consentModePingsSent": true
  }
}
```

## Cited In
- consent.md
- cookie-hygiene.md
- pre-consent-tracking.md (consentModePings = tier 2)
