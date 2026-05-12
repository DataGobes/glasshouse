> **Disclaimer:** This report presents technical observations from an automated external scan. It does not constitute legal advice or a formal compliance assessment. The findings reflect what was observed at the time of scanning and should be interpreted in consultation with qualified legal counsel.

# Privacy Audit Report: datagobes.dev

**Scan Date**: 2026-05-12
**Overall Score**: 9.5/10
**Scanner**: glasshouse/1.0 (Firefox, two-phase)
**Prepared for**: datagobes.dev

## Executive Summary

datagobes.dev is the homepage for an open-source GDPR audit toolkit and operates on a strict no-tracking baseline. The site sets zero cookies, loads zero third-party trackers, performs no fingerprinting, and connects only to its own Supabase backend over a CSP-restricted channel. No consent banner is needed because (a) ePrivacy Art. 5(3) is only triggered by storage that goes beyond strictly-necessary feature state — localStorage is used only for user-requested feature state (jukebox playback), which is exempt under the Article 29 WP Opinion 04/2012 carve-out — and (b) server-side analytics (Vercel Web Analytics) operates under Art. 6(1)(f) legitimate interest, not consent: it hashes the IP with a daily salt + User-Agent, discards the IP, and produces aggregated first-party traffic counts. Security headers are complete (6/6) with strong configuration (HSTS preload, comprehensive CSP, permissions-policy disabling camera/mic/geolocation). The only finding worth a recommendation: the browser sends a Sec-GPC: 1 signal that the site doesn't currently parse — under Art. 6(1)(f) users retain the Art. 21 right to object, and GPC is the implementable form of that objection. Reading the header and conditionally skipping the analytics beacon is the action that closes the loop.

## Methodology

- Two-phase scan: pre-consent capture → consent acceptance → post-consent capture
- Browser: Firefox with stealth settings (masked webdriver, realistic UA)
- Categories captured: network requests, cookies, localStorage, sessionStorage, security headers, TLS, consent mechanisms, legal pages, meta tags

## Findings

### Consent Mechanism
No CMP is present because no processing on the page requires consent under Art. 6. The CSP locks third-party origins to a small allowlist (fonts.googleapis.com, opengraph.githubassets.com, the site's own Supabase project, Vercel analytics for vitals). localStorage is used only for user-requested feature state (jukebox) and is exempt under Art. 5(3)'s strictly-necessary carve-out. Server-side analytics operates under Art. 6(1)(f) legitimate interest, not consent. The site receives Sec-GPC: 1 but doesn't parse it — the recommendation is to wire that up so users keep an enforceable Art. 21 right to object.

### Pre-Consent Activity
Zero trackers, zero cookies, zero fingerprinting calls before any (non-existent) consent action. The only outbound request beyond first-party assets is a single GET to the site's own Supabase project at jmsrmcpfzkcwofggbvto.supabase.co, restricted by CSP connect-src to that specific subdomain.

### Post-Consent Activity
Because there is no consent banner, the accept and reject variants produce identical state. No new trackers or cookies appear after attempted interaction. The site's behavior is the same regardless of any consent the user might attempt to grant or withhold.

### Tracking Systems
| Tracker | Category | Domain | Jurisdiction | Risk |
|---------|----------|--------|-------------|------|


### Cookie Inventory
| Name | Domain | Expiry | Purpose | Risk |
|------|--------|--------|---------|------|


### Storage (localStorage/sessionStorage)
See scan JSON for details.

### Security Headers
| Header | Status | Value |
|--------|--------|-------|
| Strict-Transport-Security | Present | max-age=63072000; includeSubDomains; preload |
| Content-Security-Policy | Present | default-src 'self' with locked-down allowlists for scripts, styles, images, connect-src |
| X-Content-Type-Options | Present | nosniff |
| X-Frame-Options | Present | SAMEORIGIN |
| Referrer-Policy | Present | strict-origin-when-cross-origin |
| Permissions-Policy | Present | camera=(), microphone=(), geolocation=() |

### Legal Pages
- Privacy notice: Found (https://datagobes.dev/privacy)
- Privacy-audit playbook: Found (https://datagobes.dev/playbooks/privacy-audit)

## GDPR Compliance Checklist



## Risk Matrix

| Category | Score | Weight |
|----------|-------|--------|
| Consent Mechanism | 9.5 | 25% |
| Pre-Consent Tracking | 10 | 20% |
| Legal Pages | 8 | 15% |
| Cross-Border Transfers | 8.5 | 15% |
| Security Headers | 10 | 10% |
| Cookie Management | 10 | 10% |
| Dark Patterns | 10 | 5% |
| **Overall** | **9.5** | 100% |

## Recommendations

1. **Read the GPC signal explicitly** — Even with no current tracking to suppress, parsing Sec-GPC: 1 and signaling acknowledgement (e.g., setting an internal flag) future-proofs the site for any future addition of analytics or marketing tools.
2. **Tighten privacy notice retention language** — The privacy notice mentions retention but in general terms. Specifying maximum durations per processing purpose strengthens Art. 13(2)(a) compliance.

---

*Generated by glasshouse • 2026-05-12*
