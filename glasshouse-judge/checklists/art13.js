/**
 * GDPR Art. 13/14 information checklist: the 13 elements of
 * references/analysis-guide.md, in the same order and under the same names,
 * so the judge's findings.privacyPolicyAnalysis[] reads like a hand-written one.
 *
 * Each element carries:
 *   disclosed  what counts as the policy addressing the element at all
 *   specific   what separates a "present" disclosure from a "vague" one
 *   aliases    patterns for element names seen in hand-written analyses, so
 *              scripts/replay.js can line labels up with judge output
 *
 * Bump VERSION when any wording changes: it is part of every cache key via
 * the question text, and replay reports carry it.
 */

const VERSION = "art13-v2";

const ELEMENTS = [
  {
    id: "controller",
    element: "Controller identity",
    article: "Art. 13(1)(a)",
    disclosed: "names the organisation responsible for the processing (the controller) or gives its contact details",
    specific: {
      true: "gives the controller's legal name together with a postal address or another direct contact route (email, form, phone)",
      false: "only a brand or site name, or a name with no way to contact the controller",
    },
    aliases: [/controller/, /identity/, /who we are/],
  },
  {
    id: "dpo",
    element: "DPO contact",
    article: "Art. 13(1)(b)",
    disclosed: "mentions a data protection officer (DPO), or says none is appointed",
    specific: {
      true: "gives a way to reach the DPO (email, postal address, form), or clearly states that no DPO is appointed",
      false: "refers to a DPO or privacy team without any way to contact them",
    },
    aliases: [/\bdpo\b/, /data protection officer/],
  },
  {
    id: "purposes",
    element: "Processing purposes",
    article: "Art. 13(1)(c)",
    disclosed: "states why personal data is processed",
    specific: {
      true: "lists distinct, concrete purposes (e.g. order fulfilment, newsletter, fraud prevention, analytics)",
      false: "only generic purposes such as 'to improve our services' or 'for business purposes'",
    },
    aliases: [/purpose/],
  },
  {
    id: "legalBasis",
    element: "Legal basis per purpose",
    article: "Art. 13(1)(c)",
    disclosed: "names a legal basis for processing (consent, contract, legal obligation, legitimate interests, vital or public interest)",
    specific: {
      true: "ties each legal basis to the purpose or processing it covers",
      false: "lists legal bases in general without saying which applies to which processing",
    },
    aliases: [/legal basis/, /lawful basis/, /lawfulness/, /legal ground/],
  },
  {
    id: "legitimateInterests",
    element: "Legitimate interests",
    article: "Art. 13(1)(d)",
    disclosed: "relies on legitimate interests (Art. 6(1)(f)) and says something about which interests",
    specific: {
      true: "names the actual interests pursued (e.g. securing the site, preventing fraud, direct marketing to existing customers)",
      false: "invokes 'our legitimate interests' without saying what they are",
    },
    aliases: [/legitimate interest/],
  },
  {
    id: "recipients",
    element: "Recipients",
    article: "Art. 13(1)(e)",
    disclosed: "says who receives or gets access to personal data (processors, partners, group companies, authorities)",
    specific: {
      true: "names specific recipients or service providers, or gives precise categories tied to what they do",
      false: "only vague phrases such as 'third parties', 'partners' or 'service providers'",
    },
    aliases: [/recipient/, /third part/, /processor/, /sharing/],
  },
  {
    id: "transfers",
    element: "International transfers",
    article: "Art. 13(1)(f)",
    disclosed: "addresses transfers of personal data outside the EU/EEA, or states that none take place",
    specific: {
      true: "names destination countries or recipients and the safeguard used (adequacy decision, EU-US Data Privacy Framework, standard contractual clauses, binding corporate rules), or clearly states no transfers happen",
      false: "mentions that data may be transferred abroad without naming a safeguard",
    },
    aliases: [/transfer/, /cross.?border/, /third countr/, /international/],
  },
  {
    id: "retention",
    element: "Retention periods",
    article: "Art. 13(2)(a)",
    disclosed: "says how long personal data is kept, or how that is decided",
    specific: {
      true: "gives concrete periods (e.g. '24 months', '7 years for invoices') or concrete criteria per purpose or data type",
      false: "only 'as long as necessary' or similar without periods or criteria",
    },
    aliases: [/retention/, /storage period/, /how long/],
  },
  {
    id: "rights",
    element: "Data subject rights",
    article: "Art. 13(2)(b)",
    disclosed: "informs people of their data protection rights",
    specific: {
      true: "lists the rights individually (access, rectification, erasure, restriction, portability, objection) and says how to exercise them",
      false: "a generic 'you have rights over your data' without listing them or how to use them",
    },
    aliases: [/subject rights/, /your rights/, /rights of/, /^rights$/, /access.*erasure/],
  },
  {
    id: "withdrawConsent",
    element: "Right to withdraw consent",
    article: "Art. 13(2)(c)",
    disclosed: "says consent can be withdrawn",
    specific: {
      true: "says how to withdraw (e.g. cookie settings link, unsubscribe link, contact address)",
      false: "says consent can be withdrawn without saying how",
    },
    aliases: [/withdraw/, /revoke/, /revocation/],
  },
  {
    id: "complaint",
    element: "Right to complain",
    article: "Art. 13(2)(d)",
    disclosed: "mentions the right to complain to a data protection or supervisory authority",
    specific: {
      true: "names a supervisory authority or explains how to reach one",
      false: "mentions complaining in general without pointing to a supervisory authority",
    },
    aliases: [/complain/, /supervisory/, /lodge/],
  },
  {
    id: "statutoryRequirement",
    element: "Statutory/contractual requirement",
    article: "Art. 13(2)(e)",
    disclosed: "says whether providing personal data is required by law or contract",
    specific: {
      true: "says which data is required and what happens if it is not provided",
      false: "mentions mandatory fields or obligations without consequences or scope",
    },
    aliases: [/statutory/, /contractual/, /obligat/, /requirement/],
  },
  {
    id: "automatedDecisions",
    element: "Automated decision-making",
    article: "Art. 13(2)(f)",
    disclosed: "addresses automated decision-making or profiling, including stating that none takes place",
    specific: {
      true: "clearly states none takes place, or explains the logic involved and the significance and consequences for the person",
      false: "mentions profiling or automated decisions without explaining logic or consequences",
    },
    aliases: [/automated/, /profiling/, /\badm\b/],
  },
];

/** Maps a hand-written element name to a checklist id, or null. */
function matchElement(name) {
  const n = String(name || "").toLowerCase().trim();
  if (!n) return null;
  const exact = ELEMENTS.find((e) => e.element.toLowerCase() === n);
  if (exact) return exact.id;
  // "legitimate interests" also matches /interest/ in nothing else, but
  // "legal basis ... legitimate interests" must stay legalBasis: first
  // alias hit in checklist order wins, and legalBasis precedes it.
  const hit = ELEMENTS.find((e) => e.aliases.some((re) => re.test(n)));
  return hit ? hit.id : null;
}

module.exports = { VERSION, ELEMENTS, matchElement };
