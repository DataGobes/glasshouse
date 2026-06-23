// Regression guard for custom-slide chrome.
//
// Background: custom slides (analysis JSON `customSlides[slot]`) used to render
// as just a tiny eyebrow badge + one flat `.card` of raw HTML — no big <h2>
// heading, no subtitle — so they looked visibly off-design next to native
// slides. buildCustomSlide now emits the same chrome as a native slide: the
// eyebrow (title), an optional <h2> heading, an optional slide-desc subtitle,
// then a `.custom-body` wrapper for the content. These tests pin that, with a
// self-contained synthetic fixture (no external scan), so they run in any
// checkout.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const GENERATE = path.join(__dirname, '..', '..', 'scripts', 'generate.js');

function generate(analysis) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-chrome-'));
  const fixture = path.join(dir, 'analysis.json');
  fs.writeFileSync(fixture, JSON.stringify(analysis));
  const res = spawnSync('node', [GENERATE, fixture, '--output-dir', dir], { encoding: 'utf8' });
  assert.equal(res.status, 0, `generate.js failed: ${res.stderr}`);
  const htmlFile = fs.readdirSync(dir).find(f => f.endsWith('.html'));
  assert.ok(htmlFile, 'generate.js should write an .html file');
  return fs.readFileSync(path.join(dir, htmlFile), 'utf8');
}

const base = {
  meta: { domain: 'example.test', scanDate: '2026-06-23', episode: 1, overallScore: 5.0, theme: 'datagobes' },
  scores: { consent: { score: 5.0 } },
  findings: {},
  slides: { include: ['title'] },
};

test('a custom slide with heading + subtitle gets native slide chrome', () => {
  const html = generate({
    ...base,
    customSlides: {
      'before-recommendations': {
        title: 'Eyebrow Label',
        heading: 'Big Heading Here',
        subtitle: 'A one-line subtitle.',
        style: 'default',
        content: '<div class="tracker-grid"><div class="tracker-card reveal"><div class="name">x</div></div></div>',
      },
    },
  });

  assert.match(html, /<span class="badge reveal">Eyebrow Label<\/span>/, 'eyebrow badge from title');
  assert.match(html, /<h2 class="reveal">Big Heading Here<\/h2>/, 'big <h2> heading');
  assert.match(html, /<p class="slide-desc reveal">A one-line subtitle\.<\/p>/, 'subtitle as slide-desc');
  assert.match(html, /class="custom-body reveal"/, 'content lives in a .custom-body wrapper, not a flat .card');
  assert.match(html, /data-title="Eyebrow Label"/, 'title drives the nav data-title');
});

test('a custom slide without heading/subtitle still renders (backward compatible)', () => {
  const html = generate({
    ...base,
    customSlides: {
      'before-recommendations': {
        title: 'Just A Title',
        content: '<p>plain body</p>',
      },
    },
  });

  assert.match(html, /<span class="badge reveal">Just A Title<\/span>/, 'eyebrow still renders');
  assert.match(html, /class="custom-body reveal"/, 'body wrapper still renders');
  assert.doesNotMatch(html, /<h2 class="reveal">Just A Title<\/h2>/, 'no heading is invented from the title');
  assert.doesNotMatch(html, /class="slide-desc reveal"><\/p>/, 'no empty subtitle is emitted');
});

test('finding-highlight style adds the accent rail to the body wrapper', () => {
  const html = generate({
    ...base,
    customSlides: {
      'before-recommendations': {
        title: 'Highlighted',
        content: '<p>x</p>',
        style: 'finding-highlight',
      },
    },
  });

  assert.match(html, /class="custom-body custom-body-highlight reveal"/, 'finding-highlight adds the accent rail class');
});
