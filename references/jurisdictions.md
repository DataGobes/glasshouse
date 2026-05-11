# Jurisdiction Mapping

Map third-party domains to jurisdictions to assess cross-border transfer compliance.

## EU Adequacy Decisions (as of 2024)

Countries with EU adequacy decisions — transfers allowed without additional safeguards:

| Country | Decision Date | Notes |
|---------|--------------|-------|
| Andorra | 2010 | |
| Argentina | 2003 | |
| Canada | 2001 | Commercial sector only (PIPEDA) |
| Faroe Islands | 2010 | |
| Guernsey | 2003 | |
| Israel | 2011 | |
| Isle of Man | 2004 | |
| Japan | 2019 | |
| Jersey | 2008 | |
| New Zealand | 2012 | |
| Republic of Korea | 2022 | |
| Switzerland | 2000 | |
| United Kingdom | 2021 | Expires June 2025, under review |
| Uruguay | 2012 | |
| United States | 2023 | EU-US Data Privacy Framework only — company must be certified |

### US Data Privacy Framework (DPF)
- Companies must self-certify with US Dept. of Commerce
- Check certification at: https://www.dataprivacyframework.gov/list
- Major certified companies: Google, Meta, Microsoft, Amazon, Apple, Salesforce
- **Important**: DPF certification alone may not suffice — Schrems III risk exists

## Major Service Provider Jurisdictions

### United States (HIGH RISK without DPF)
| Company | Services/Domains |
|---------|-----------------|
| Google LLC | `google.com`, `googleapis.com`, `googletagmanager.com`, `google-analytics.com`, `doubleclick.net`, `gstatic.com`, `youtube.com` |
| Meta Platforms | `facebook.com`, `facebook.net`, `fbcdn.net`, `instagram.com`, `whatsapp.com` |
| Microsoft | `microsoft.com`, `bing.com`, `clarity.ms`, `linkedin.com`, `licdn.com`, `azure.com`, `live.com` |
| Amazon | `amazonaws.com`, `amazon.com`, `cloudfront.net`, `aws.amazon.com` |
| Apple | `apple.com`, `icloud.com`, `apple-dns.net` |
| Cloudflare | `cloudflare.com`, `cloudflareinsights.com`, `cdnjs.cloudflare.com` |
| Fastly | `fastly.net`, `fastlylb.net` |
| Amplitude | `amplitude.com` |
| Segment/Twilio | `segment.com`, `segment.io`, `twilio.com` |
| Mixpanel | `mixpanel.com` |
| FullStory | `fullstory.com` |
| HubSpot | `hubspot.com`, `hsforms.com`, `hs-analytics.net` |
| Intercom | `intercom.io` |
| New Relic | `newrelic.com`, `nr-data.net` |
| Sentry | `sentry.io` |
| Pinterest | `pinterest.com`, `pinimg.com` |
| X Corp | `twitter.com`, `t.co`, `twimg.com` |
| Snap Inc. | `snapchat.com`, `snap.com` |

### European Union / EEA (LOW RISK)
| Company | Country | Domains |
|---------|---------|---------|
| Hotjar | Malta | `hotjar.com`, `hotjar.io` |
| Criteo | France | `criteo.com`, `criteo.net` |
| Plausible | Estonia | `plausible.io` |
| Cookiebot/Usercentrics | Denmark/Germany | `cookiebot.com`, `usercentrics.eu` |
| OneTrust | US HQ, EU processing | `onetrust.com`, `cookielaw.org` |
| Didomi | France | `didomi.io` |
| Quantcast | US HQ, EU processing | `quantcast.com` |
| Matomo | New Zealand (often self-hosted) | `matomo.org` |

### China / Hong Kong (VERY HIGH RISK)
| Company | Domains |
|---------|---------|
| ByteDance/TikTok | `tiktok.com`, `tiktokcdn.com`, `bytedance.com` |
| Tencent | `qq.com`, `weixin.qq.com` |
| Alibaba | `alibaba.com`, `alicdn.com`, `aliyun.com` |
| Baidu | `baidu.com`, `bdstatic.com` |

### Israel (ADEQUATE)
| Company | Domains |
|---------|---------|
| Taboola | `taboola.com` |
| Outbrain | `outbrain.com` |
| Wix | `wix.com`, `wixstatic.com` |

### Other
| Company | Country | Domains | Adequacy |
|---------|---------|---------|----------|
| Shopify | Canada | `shopify.com`, `cdn.shopify.com` | Adequate (PIPEDA) |
| Stripe | US | `stripe.com`, `js.stripe.com` | DPF required |

## Domain → Country Heuristics

When exact company mapping isn't available, use TLD heuristics:

| TLD Pattern | Likely Country |
|-------------|---------------|
| `.de` | Germany |
| `.nl` | Netherlands |
| `.fr` | France |
| `.co.uk`, `.uk` | United Kingdom |
| `.it` | Italy |
| `.es` | Spain |
| `.be` | Belgium |
| `.at` | Austria |
| `.ch` | Switzerland |
| `.se` | Sweden |
| `.dk` | Denmark |
| `.no` | Norway |
| `.fi` | Finland |
| `.pl` | Poland |
| `.cz` | Czech Republic |
| `.ie` | Ireland |
| `.pt` | Portugal |
| `.com` | Unknown — often US, but not always |
| `.io` | Unknown — often US/EU startups |
| `.cn` | China |
| `.jp` | Japan |
| `.kr` | South Korea |
| `.ru` | Russia (NO adequacy) |
| `.in` | India (NO adequacy) |
| `.br` | Brazil (NO adequacy, but has LGPD) |

## Risk Classification

### Transfer Risk Levels

| Risk | Conditions |
|------|-----------|
| **None** | Data stays in EU/EEA or adequate country |
| **Low** | Adequate country with strong data protection |
| **Medium** | US company with DPF certification |
| **High** | US company WITHOUT DPF certification |
| **Very High** | China, Russia, or countries with mass surveillance and no adequacy |

### Assessment Checklist for Each Third Party

1. What domain(s) does it use?
2. What company operates it?
3. Where is the company headquartered?
4. Where are their servers located?
5. Is there an adequacy decision for that country?
6. If US: is the company DPF-certified?
7. What data is transmitted (IP, device info, behavior, PII)?
8. Is there a Data Processing Agreement (DPA)?
9. Are Standard Contractual Clauses (SCCs) in place?
