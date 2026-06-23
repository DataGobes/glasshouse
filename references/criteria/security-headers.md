# Criterion: Security Headers

## What the Scanner Checks
Whether the site implements baseline HTTP response headers that protect users in transit and demonstrate Art. 32 "appropriate technical measures."

## Legal Basis
- **GDPR Art. 32** — Appropriate technical and organisational measures
- **GDPR Art. 5(1)(f)** — Integrity and confidentiality principle
- **NIS2 Directive (2024)** — Tightens security obligations for "essential" and "important" entities

## Headers Checked

### Strict-Transport-Security (HSTS)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```
- Pass: `max-age ≥ 31536000` (1 year) on production
- Bonus: `includeSubDomains`, `preload`

### Content-Security-Policy (CSP)
```
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com
```
- Pass: present and not `default-src *`
- Penalty: `'unsafe-inline'` and `'unsafe-eval'` in script-src reduce effectiveness

### X-Frame-Options / `frame-ancestors`
```
X-Frame-Options: DENY
```
or via CSP `frame-ancestors 'none'`. Either is acceptable; CSP `frame-ancestors` supersedes `X-Frame-Options`.

### X-Content-Type-Options
```
X-Content-Type-Options: nosniff
```
Single value. Either present (pass) or absent (fail).

### Referrer-Policy
```
Referrer-Policy: strict-origin-when-cross-origin
```
- Pass: `strict-origin-when-cross-origin`, `same-origin`, `no-referrer`
- Weak: `unsafe-url`, `origin-when-cross-origin`

### Permissions-Policy (formerly Feature-Policy)
```
Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()
```
- Pass: explicit deny for unused features

## Adjacent Checks
- **SRI (Subresource Integrity)** — `integrity=` attribute on `<script src>` from external CDNs. **Score only against SRI-*eligible* scripts.** Tag managers and analytics loaders (Google Tag Manager, gtag.js, Tealium, Adobe Launch/DTM, Segment) republish a new file on every container change, so a static hash is infeasible — adding SRI would break them the moment the vendor updates, with no alerting beyond noticing data stopped flowing. GTM is also the single most valuable script to protect, yet the one that *cannot* take SRI. The scanner separates these: see `scriptIntegrity.eligibleCoveragePercent` and `scriptIntegrity.cannotTakeSri[]`.
- **CORS** — `Access-Control-Allow-Origin: *` combined with `Allow-Credentials: true` is a misconfiguration
- **Cookie security flags** — `Secure`, `HttpOnly`, `SameSite=Strict|Lax` on session cookies

### Recommending SRI (don't be naive)
When you write an SRI recommendation:
- Scope it to **static third-party scripts** (versioned CDN libraries) — those genuinely benefit and won't break.
- **Explicitly carve out the tag manager.** Recommend CSP + a script-monitoring/change-alerting approach for GTM-managed tags instead of SRI, because SRI on a tag manager forces a site redeploy on every tag change and silently breaks tags when a vendor updates a hosted file.
- Acknowledge the breakage/alerting tradeoff: with SRI, a vendor changing their script yields broken functionality detectable mainly by noticing GA/Meta stopped receiving data.

## Verified Enforcement

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| Meta Platforms Ireland (ETid-1502) | DPC Ireland, 2022-11-25 | €265M | Inadequate technical measures (data scraping breach) |
| Meta Platforms Ireland (ETid-2484) | DPC Ireland, 2024-12-17 | €251M | Insufficient technical and organisational measures |
| Meta Platforms Ireland (ETid-2461) | DPC Ireland, 2024-09-27 | €91M | Plain-text password storage (Art. 32) |
| Enel Energia (ETid-2306) | Garante Italy, 2024-02-08 | €79.1M | Insufficient technical/organisational measures |
| ENDESA Energía (ETid-2220) | AEPD Spain, 2023-10-25 | €6.1M | Inadequate security + breach response |
| Cosmote (ETid-1024) | HDPA Greece, 2022-01-27 | €6M | Insufficient technical measures (breach exposure) |
| Hellenic Post (ETid-2284) | HDPA Greece, 2024-02-28 | €3M | Insufficient technical/organisational measures |

(GDPR Art. 32 is the most-cited security article — 375 fines in the 3,082-fine enforcementtracker dataset.)

## Scanner Output Fields (see field-contract.md)
- `summary.securityHeaders` — `{header, value, status, weight}` per header
- `summary.scriptIntegrity.coveragePercent` — raw fraction of external scripts with valid SRI
- `summary.scriptIntegrity.eligibleCoveragePercent` / `eligibleExternal` — coverage over SRI-eligible scripts only (tag managers excluded) — **score off this**
- `summary.scriptIntegrity.cannotTakeSri[]` — external scripts that cannot take a static hash (GTM, gtag, Tealium, Adobe Launch, Segment)
- `summary.corsConfig` — `{wildcardOrigin, credentialsAllowed}` flags
- `summary.cookieFlagAudit[]` — per-cookie `{name, secure, httpOnly, sameSite}`

## Scoring Impact (see scoring.md)
9% weight (Phase E). Score = `(present_headers / total_checked) × 100`.

Modifiers:
- SRI **eligible** coverage 0% with 5+ eligible external scripts: −10 (use `eligibleCoveragePercent`; tag managers in `cannotTakeSri[]` don't count toward the penalty)
- SRI eligible coverage > 80%: +5
- CORS wildcard with credentials: −10
- CSP `'unsafe-inline'` in script-src: −5
- Session cookie missing `Secure`: −5
