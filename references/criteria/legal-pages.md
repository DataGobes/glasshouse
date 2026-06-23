# Criterion: Legal Pages (Art. 12 / 13 / 14 Disclosure)

## What the Scanner Checks
Whether the site's privacy policy and cookie policy meet GDPR Art. 12 (transparent communication), Art. 13 (info at collection from subject), and Art. 14 (info when not from subject) — both **completeness** and **quality**.

## Legal Basis
- **GDPR Art. 12** — Communications must be concise, transparent, intelligible, easily accessible, in clear plain language
- **GDPR Art. 13** — Information to be provided when data is collected directly from the data subject
- **GDPR Art. 14** — Information to be provided when data has not been obtained from the data subject
- **EDPB Guidelines 04/2020** on transparency

## Art. 12 — Transparency Quality (NEW analysis layer)
Check the **how** of disclosure, not just the what:
- **Readability** — Flesch-Kincaid grade level; target ≤ grade 10–12 for general-audience policies
- **Legalese density** — count occurrences of "notwithstanding", "hereinafter", "therein", "aforementioned"
- **Section structure** — descriptive `##`/`<h2>` headings present; not wall-of-text
- **Language accessibility** — policy in primary language(s) of the site; multilingual EU sites should offer translations
- **Not behind cookie wall** — policy must be reachable before consent (CJEU Planet49 + EDPB position)
- **Not behind dark UX** — link to policy is not collapsed/hidden in footer with low contrast

## Art. 13 — Required Disclosures (collected from subject)
Score each as `present`, `absent`, or `vague`. Cite a brief excerpt as evidence.

1. Identity and contact details of controller (+ representative if applicable)
2. DPO contact details (if designated)
3. Purposes of processing (each purpose explicitly listed)
4. Legal basis per purpose (Art. 6(1)(a)–(f))
5. Legitimate interests pursued (if Art. 6(1)(f))
6. Recipients / categories of recipients
7. Third-country transfers + safeguards (SCCs, BCRs, adequacy, DPF)
8. Retention periods (or criteria for determining)
9. Data subject rights (access, rectification, erasure, restriction, portability, objection)
10. Right to withdraw consent (and that withdrawal does not affect prior processing)
11. Right to lodge a complaint with a supervisory authority
12. Whether provision is statutory/contractual + consequences of not providing
13. Automated decision-making / profiling — logic, significance, consequences

Output: `findings.privacyPolicyAnalysis[]`

## Art. 14 — Additional Disclosures (when data not from subject)
Same as Art. 13, plus:
- Categories of personal data concerned
- Source of the data (specific or general; whether publicly accessible)

## Cookie Policy Specifics
- What cookies / tracking technologies are used (named, not categories alone)
- Purpose of each cookie category
- Duration of each cookie (session vs persistent + max age)
- Third parties setting cookies, with links to their policies
- How to accept/reject/manage; consequences of refusal

## Cookie Purpose Cross-Reference (NEW analysis)
1. Extract cookie names and declared categories from the cookie policy text
2. Compare against scanner-classified purposes in `summary.preConsentCookies` and `summary.newPostConsentCookies`
3. Flag mismatches: e.g., site declares `li_sugr` as "functional" but scanner classifies it as "tracking"
4. Flag undisclosed cookies: cookies the scanner found not mentioned in the policy

Output: `findings.cookiePurposeMatching[]` — each entry `{cookie, declared, observed, match}`.

## Provider / Controller Identity Disclosure (e-Commerce Directive Art. 5) — jurisdiction-aware

One of the five checked documents is the **provider-identity disclosure** (the page that names who operates the site: legal name + form, registered address, contact email, trade-register/VAT numbers). This is the **e-Commerce Directive 2000/31/EC Art. 5** obligation — "easily, directly and permanently accessible" identity info — transposed by each member state, so its **name and form differ by country**. Match on the local equivalent, not just the German word:

| Jurisdiction | Local instrument | What to look for |
|---|---|---|
| Germany / Austria | **Impressum** — §5 DDG (since 14 May 2024; was §5 TMG), §5 ECG (AT) | A page literally titled *Impressum* / *Anbieterkennzeichnung* |
| Netherlands | **art. 3:15d BW** — *no fixed page name* | Identity info in a **colofon**, *over ons* / "about us", *contact*, footer block, or sometimes a *disclaimer* page. There is no Dutch "Impressum"; the duty is met wherever the info is permanently accessible |
| France | **Mentions légales** — LCEN | A *Mentions légales* page |
| Italy / Spain | *Note legali* / **Aviso legal** | Local legal-notice page |

**NL Disclaimer ≠ Impressum.** A Dutch *Disclaimer* page is a liability-limitation notice, not a formal identity register. It *may* carry some art. 3:15d BW identity info, but treat "found a Disclaimer" as **partial** evidence of identity disclosure — confirm the actual identity fields (legal name, address, KvK/VAT) are present somewhere accessible before scoring identity disclosure as satisfied. Conversely, do **not** mark identity disclosure as missing just because there is no page called "Impressum" on a `.nl` site — check the colofon/footer/contact.

**Detection-quality caveat (Terms of Service).** The scanner matches legal pages by link keyword, so it can surface a *narrow* terms page rather than the site-wide one — e.g. on miele.nl it flagged `gebruiksvoorwaarden-304.htm`, which defaults to the **Downloads** terms, not the general site terms. When the matched ToS/identity page looks scoped to a sub-product, say so in the narrative and note the general document may live elsewhere, rather than asserting the site's only terms are the narrow ones.

## Common Deficiencies
1. No DPO contact listed
2. Vague "third-party service providers" without named processors (also fails processor-transparency.md)
3. Missing retention period specifics
4. No cross-border transfer disclosure
5. Privacy policy doesn't match actual cookie usage
6. No mention of GPC signal handling
7. No right to lodge a complaint with the DPA
8. Automated decision-making disclosure missing

## Verified Enforcement

| Case | DPA / Date | Fine | Issue |
|---|---|---|---|
| Meta Platforms Ireland (ETid-1844) | DPC Ireland, 2023-05-12 | €1,200M | Disclosure failures part of broader breach (lawful basis) |
| Criteo (ETid-1912) | CNIL, 2023-06-15 | €40M | Inadequate transparency about processing purposes |
| Clearview AI (ETid-1098) | Garante Italy, 2022-02-10 | €20M | Privacy policy missing/incomplete for biometric processing |
| WhatsApp Ireland (ETid-820) | DPC Ireland, 2021-09-02 | €225M | Insufficient fulfilment of information obligations (Art. 12/13/14) |

## Scanner Output Fields (see field-contract.md)
- `summary.legalPages[]` — `{type, url, accessible}` per page
- `summary.legalPageContent.privacyPolicy` — fetched text
- `summary.legalPageContent.cookiePolicy` — fetched text
- `findings.privacyPolicyAnalysis[]` — Art. 13/14 element-by-element scoring
- `findings.cookiePurposeMatching[]` — declared-vs-observed mismatches
- `findings.legalReadability` — `{flesch, grade, legalesePerKWord}` (NEW)

## Scoring Impact (see scoring.md)
11% weight (Phase E). Split scoring:
- **Presence** (50%): 100 = all 5 pages found, 80 = 4/5, etc.
- **Content** (50%, Art. 13/14): 13/13 = 100, 10–12 = 75, 7–9 = 50, 4–6 = 25, 0–3 = 0; "vague" = 0.5
- Final = `presence * 0.5 + content * 0.5`
- DSAR mechanism missing: −10 (also tracked in dsar.md)
- (Optional) Readability grade > 14: −5
