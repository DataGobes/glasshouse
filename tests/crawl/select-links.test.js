// Unit tests for the multi-page crawl link selector (feedback #3.5).
// Pure/deterministic — no browser needed.
const { test } = require("node:test");
const assert = require("node:assert");
const { selectCrawlLinks, registrableDomain, CAMPAIGN_PARAM_RE } = require("../../scripts/scan.js");

test("registrableDomain strips subdomains and handles multi-part TLDs", () => {
  assert.equal(registrableDomain("www.miele.nl"), "miele.nl");
  assert.equal(registrableDomain("miele.nl"), "miele.nl");
  assert.equal(registrableDomain("shop.example.co.uk"), "example.co.uk");
});

test("CAMPAIGN_PARAM_RE matches tracking params, ignores plain links", () => {
  assert.ok(CAMPAIGN_PARAM_RE.test("https://miele.nl/p?cmpid=abc"));
  assert.ok(CAMPAIGN_PARAM_RE.test("https://miele.nl/p?utm_source=nl"));
  assert.ok(CAMPAIGN_PARAM_RE.test("https://miele.nl/p?gclid=xyz"));
  assert.ok(!CAMPAIGN_PARAM_RE.test("https://miele.nl/products/ovens"));
});

const baseHost = "www.miele.nl";
const basePath = "https://www.miele.nl/";
const links = [
  "https://www.miele.nl/",                                   // entry page — skip
  "https://www.miele.nl/products/ovens",                     // same-site, plain
  "https://www.miele.nl/products/ovens",                     // duplicate — dedupe
  "https://www.miele.nl/c/dishwashers?cmpid=spring-sale",    // CAMPAIGN
  "https://www.miele.nl/service?utm_source=email",           // CAMPAIGN
  "https://shop.miele.nl/cart",                              // same registrable domain
  "https://facebook.com/miele",                              // third-party — exclude
  "mailto:info@miele.nl",                                    // non-http — exclude
  "javascript:void(0)",                                      // junk — exclude
];

test("selectCrawlLinks excludes entry page, third-party, and non-http", () => {
  const picked = selectCrawlLinks(links, baseHost, basePath, 5);
  assert.ok(!picked.includes("https://www.miele.nl/"));
  assert.ok(!picked.some((u) => u.includes("facebook.com")));
  assert.ok(!picked.some((u) => u.startsWith("mailto") || u.startsWith("javascript")));
});

test("selectCrawlLinks includes same registrable subdomain and dedupes paths", () => {
  const picked = selectCrawlLinks(links, baseHost, basePath, 5);
  assert.ok(picked.some((u) => u.includes("shop.miele.nl/cart")));
  assert.equal(picked.filter((u) => u.includes("/products/ovens")).length, 1);
});

test("selectCrawlLinks floats campaign links to the front", () => {
  const picked = selectCrawlLinks(links, baseHost, basePath, 5);
  assert.ok(CAMPAIGN_PARAM_RE.test(picked[0]));
  assert.ok(CAMPAIGN_PARAM_RE.test(picked[1]));
});

test("selectCrawlLinks respects the maxPages cap and edge cases", () => {
  assert.equal(selectCrawlLinks(links, baseHost, basePath, 2).length, 2);
  assert.equal(selectCrawlLinks(links, baseHost, basePath, 0).length, 0);
  assert.equal(selectCrawlLinks([], baseHost, basePath, 5).length, 0);
});
