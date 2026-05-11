# Known Tracker Signatures

Cross-reference scan results against these signatures to identify trackers, classify their purpose, and determine jurisdiction.

## Analytics Platforms

### Google Analytics (GA4 / Universal)
- **Domains**: `google-analytics.com`, `analytics.google.com`, `googletagmanager.com`
- **Cookies**: `_ga` (2 years), `_ga_*` (2 years), `_gid` (24h), `_gat` (1min)
- **Pixels**: `collect?v=2` (GA4), `collect?v=1` (UA)
- **localStorage**: `_ga_*`, `gaGlobal`
- **Jurisdiction**: US (Google LLC, Mountain View, CA)
- **Risk**: High — sends IP, device, behavior data to US servers

### Google Tag Manager
- **Domains**: `googletagmanager.com`, `tagmanager.google.com`
- **Scripts**: `gtm.js`, `gtag/js`
- **Note**: Container may load additional trackers dynamically — check all requests post-GTM load
- **Jurisdiction**: US

### Amplitude
- **Domains**: `amplitude.com`, `api.amplitude.com`, `cdn.amplitude.com`
- **Cookies**: `amp_*`, `amplitude_id_*`
- **localStorage**: `amplitude_*`
- **Jurisdiction**: US (Amplitude Inc., San Francisco)
- **Risk**: Medium-High — behavioral analytics with user identification

### Hotjar
- **Domains**: `hotjar.com`, `hotjar.io`, `static.hotjar.com`, `vars.hotjar.com`
- **Cookies**: `_hj*` (various), `_hjid` (365 days), `_hjSession*` (30min)
- **Scripts**: `hotjar.com/c/hotjar-*.js`
- **Jurisdiction**: Malta (EU) — Hotjar Ltd
- **Risk**: Medium — session recordings may capture PII in form fields

### Microsoft Clarity
- **Domains**: `clarity.ms`, `c.clarity.ms`
- **Cookies**: `_clsk`, `_clck`, `CLID`
- **Scripts**: `clarity.ms/tag/`
- **Jurisdiction**: US (Microsoft Corp)
- **Risk**: Medium — session replay, heatmaps

### Segment
- **Domains**: `segment.com`, `segment.io`, `cdn.segment.com`, `api.segment.io`
- **Cookies**: `ajs_*`
- **localStorage**: `ajs_*`
- **Jurisdiction**: US (Twilio Inc.)
- **Risk**: High — CDP that can route data to many downstream services

### Mixpanel
- **Domains**: `mixpanel.com`, `api.mixpanel.com`, `cdn.mxpnl.com`
- **Cookies**: `mp_*`
- **localStorage**: `mp_*`
- **Jurisdiction**: US (Mixpanel Inc., San Francisco)

### FullStory
- **Domains**: `fullstory.com`, `rs.fullstory.com`
- **Cookies**: `fs_uid`, `_fs_*`
- **Jurisdiction**: US (FullStory Inc., Atlanta)
- **Risk**: High — full session replay

### Mouseflow
- **Domains**: `mouseflow.com`, `o2.mouseflow.com`
- **Cookies**: `mf_*`
- **Jurisdiction**: Denmark (EU)

### HubSpot
- **Domains**: `hubspot.com`, `hs-analytics.net`, `hubapi.com`, `hsforms.com`
- **Cookies**: `__hs*`, `hubspotutk`, `__hstc`, `__hssc`, `__hssrc`
- **Jurisdiction**: US (HubSpot Inc., Cambridge, MA)

### Intercom
- **Domains**: `intercom.io`, `widget.intercom.io`, `api-iam.intercom.io`
- **Cookies**: `intercom-*`
- **localStorage**: `intercom.*`
- **Jurisdiction**: US (Intercom Inc., San Francisco)

## Advertising / Tracking Pixels

### Meta Pixel (Facebook)
- **Domains**: `facebook.com`, `connect.facebook.net`, `facebook.net`
- **Pixels**: `facebook.com/tr?`, `tr?id=`
- **Cookies**: `_fbp` (90 days), `_fbc`
- **Jurisdiction**: US (Meta Platforms, Menlo Park)
- **Risk**: Very High — cross-site tracking, ad profiling
- **GDPR Note**: Meta Pixel + US transfer = very high risk per Schrems II

### Google Ads / DoubleClick
- **Domains**: `doubleclick.net`, `googleadservices.com`, `googlesyndication.com`, `google.com/pagead`
- **Cookies**: `IDE` (13 months), `DSID`, `_gcl_*`
- **Pixels**: `/pagead/conversion/`, `doubleclick.net/activity`
- **Jurisdiction**: US (Google LLC)

### LinkedIn Insight Tag
- **Domains**: `linkedin.com`, `snap.licdn.com`, `px.ads.linkedin.com`
- **Cookies**: `li_sugr`, `UserMatchHistory`, `bcookie`, `lidc`
- **Jurisdiction**: US (LinkedIn/Microsoft)

### TikTok Pixel
- **Domains**: `analytics.tiktok.com`, `tiktokcdn.com`
- **Cookies**: `_ttp`
- **Jurisdiction**: Singapore/China (ByteDance — complex jurisdiction)
- **Risk**: Very High — data access by Chinese entity

### Pinterest Tag
- **Domains**: `pinterest.com`, `ct.pinterest.com`, `pinimg.com`
- **Cookies**: `_pinterest_*`, `_pin_unauth`
- **Jurisdiction**: US (Pinterest Inc.)

### X/Twitter Pixel
- **Domains**: `twitter.com`, `t.co`, `ads-api.twitter.com`
- **Pixels**: `t.co/i/adsct`
- **Jurisdiction**: US (X Corp)

### Microsoft UET (Bing Ads)
- **Domains**: `bat.bing.com`, `bing.com/bat.js`
- **Cookies**: `_uetsid`, `_uetvid`
- **Jurisdiction**: US (Microsoft Corp)

### Adobe Audience Manager
- **Domains**: `demdex.net`, `omtrdc.net`, `2o7.net`
- **Cookies**: `demdex`, `s_cc`, `s_sq`
- **Jurisdiction**: US (Adobe Inc.)

### Criteo
- **Domains**: `criteo.com`, `criteo.net`
- **Cookies**: `cto_*`
- **Jurisdiction**: France (EU) — Criteo SA
- **Note**: EU-based but extensive cross-site tracking

### AppNexus/Xandr
- **Domains**: `adnxs.com`, `appnexus.com`
- **Cookies**: `uuid2`, `anj`
- **Jurisdiction**: US (Microsoft/Xandr)

### Taboola
- **Domains**: `taboola.com`, `trc.taboola.com`
- **Cookies**: `t_gid`, `taboola_*`
- **Jurisdiction**: US/Israel (Taboola Inc.)

### Outbrain
- **Domains**: `outbrain.com`, `widgets.outbrain.com`
- **Cookies**: `obuid`
- **Jurisdiction**: US/Israel (Outbrain Inc.)

## Monitoring / Error Tracking

### Sentry
- **Domains**: `sentry.io`, `*.ingest.sentry.io`
- **Note**: Error tracking — may inadvertently capture PII in stack traces
- **Jurisdiction**: US (Functional Software Inc.)
- **Risk**: Low-Medium — legitimate error tracking, but may leak PII

### New Relic
- **Domains**: `newrelic.com`, `nr-data.net`, `bam.nr-data.net`
- **Cookies**: `JSESSIONID`
- **Jurisdiction**: US (New Relic Inc.)

## Privacy-Friendly Analytics

### Plausible
- **Domains**: `plausible.io`
- **Cookies**: None
- **Jurisdiction**: Estonia (EU) — Plausible Insights OÜ
- **Risk**: Very Low — no cookies, no PII, GDPR-compliant by design

### Matomo (self-hosted)
- **Domains**: Varies (self-hosted)
- **Cookies**: `_pk_*`
- **Risk**: Low if self-hosted — data stays on first-party servers

### Cloudflare Web Analytics
- **Domains**: `cloudflareinsights.com`, `static.cloudflareinsights.com`
- **Cookies**: None (beacon-based)
- **Jurisdiction**: US (Cloudflare Inc.)
- **Risk**: Low — privacy-focused, no cookies

## CDN / Infrastructure (Not Trackers)

These are commonly seen but are NOT tracking — do not flag as privacy issues:
- `cdnjs.cloudflare.com` — JS library CDN
- `cdn.jsdelivr.net` — JS library CDN
- `unpkg.com` — npm CDN
- `fonts.gstatic.com` — Google Fonts (note: IP leak concern per GDPR)
- `fonts.googleapis.com` — Google Fonts CSS
- `use.typekit.net` — Adobe Fonts
- `maxcdn.bootstrapcdn.com` — Bootstrap CDN

**Note on Google Fonts**: While not a tracker, serving fonts from Google leaks visitor IP addresses to Google. German court (LG München, Jan 2022) ruled this a GDPR violation — self-hosting required.
