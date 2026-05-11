const fs = require('node:fs');
const path = require('node:path');
const Handlebars = require('handlebars');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'references', 'complaint-templates');
const ARTICLE_TEXT_DIR = path.join(__dirname, '..', '..', 'references', 'article-text');

Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('join', (arr, sep) => (arr || []).join(sep));

function loadTemplate(name) {
  // noEscape: output is markdown, not HTML — apostrophes and quotes must be literal.
  return Handlebars.compile(fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8'), { noEscape: true });
}

function uniqueArticles(selections) {
  const seen = new Set();
  const out = [];
  for (const s of selections) {
    for (const a of s.articles) {
      if (!seen.has(a)) { seen.add(a); out.push(a); }
    }
  }
  return out;
}

function renderLetter(state) {
  const tpl = loadTemplate('letter.md.hbs');
  return tpl({
    ...state,
    articleList: uniqueArticles(state.selections),
    violationCount: state.selections.length
  });
}

function groupByArticle(selections) {
  const out = {};
  for (const s of selections) {
    for (const a of s.articles) {
      (out[a] = out[a] || []).push(s);
    }
  }
  return out;
}

function renderFacts(state) {
  const tpl = loadTemplate('facts-section.md.hbs');
  const grouped = groupByArticle(state.selections);
  const sections = [];
  for (const [article, items] of Object.entries(grouped)) {
    for (const it of items) {
      sections.push(tpl({
        article,
        headline: it.headline,
        detail: it.detail,
        evidencePointers: it.evidencePointers || []
      }));
    }
  }
  return ['# Facts per cited article', '', ...sections].join('\n\n');
}

function articleFilePath(article) {
  const map = {
    'Art. 4(11)':           'gdpr/art-4-11.md',
    'Art. 6':               'gdpr/art-6.md',
    'Art. 7':               'gdpr/art-7.md',
    'Art. 13':              'gdpr/art-13.md',
    'Art. 14':              'gdpr/art-14.md',
    'Art. 80':              'gdpr/art-80.md',
    'Ch. V':                'gdpr/chapter-v.md',
    'ePrivacy Art. 5(3)':   'eprivacy/art-5-3.md',
    'EDPB Guidelines 03/2022': 'edpb/guidelines-03-2022.md'
  };
  return map[article] ? path.join(ARTICLE_TEXT_DIR, map[article]) : null;
}

function renderArticlesCited(state) {
  const chunks = ['# Cited articles (verbatim)\n'];
  for (const article of uniqueArticles(state.selections)) {
    const p = articleFilePath(article);
    if (p && fs.existsSync(p)) {
      chunks.push(fs.readFileSync(p, 'utf8'));
    } else {
      chunks.push(`## ${article}\n\n_Article text not bundled. See the source in the cited instrument._`);
    }
  }
  return chunks.join('\n\n---\n\n');
}

module.exports = { renderLetter, renderFacts, renderArticlesCited };
