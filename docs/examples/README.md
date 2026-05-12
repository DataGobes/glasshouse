# Example output

Each subdirectory holds one full audit of a real site: the HTML deck, the
Markdown report, the analysis JSON the deck was generated from, and three
PNG screenshots used as preview thumbnails in the project README.

Examples here serve two purposes:

1. **Marketing surface.** README readers see what an audit deck looks like
   before they install anything. The HTML decks are also published via
   GitHub Pages at
   [datagobes.github.io/glasshouse/examples/](https://datagobes.github.io/glasshouse/examples/).
2. **Reference output.** When working on the scanner or the generator,
   re-running an example and diffing against the committed copy is the
   fastest way to spot regressions in the deck rendering.

## Current examples

| Site | Notes |
|---|---|
| [`datagobes.dev/`](./datagobes.dev/) | Project's own homepage. Clean-baseline audit (9.5 / 10): zero trackers, zero cookies, server-side analytics under Art. 6(1)(f), six of six security headers. One genuine recommendation (read the GPC header). Useful as a "passing audit" reference. |

## Regenerating an example

```bash
# 1. Scan the site
cd $SKILL_DIR && node scripts/scan.js https://<site>

# 2. Hand-write or re-edit the analysis JSON (~/tmp/privacy-analysis-<site>.json)
#    — this is the analyst step; the brief at scripts/analysis-brief.js helps.

# 3. Validate + generate
node scripts/validate-analysis.js /tmp/privacy-analysis-<site>.json
node scripts/generate.js /tmp/privacy-analysis-<site>.json --output-dir docs/examples/<site>/

# 4. Rename the HTML so GitHub Pages serves it at the directory root
mv docs/examples/<site>/<site>-privacy-audit.html docs/examples/<site>/index.html
mv docs/examples/<site>/<site>-privacy-audit.md   docs/examples/<site>/report.md
cp /tmp/privacy-analysis-<site>.json               docs/examples/<site>/analysis.json

# 5. Regenerate the README preview PNGs
node docs/examples/capture-thumbnails.js <site>
```

The `capture-thumbnails.js` helper opens the deck in headless Firefox,
forces every `.reveal` element visible (the deck's IntersectionObserver
won't fire in a non-scrolling headless context), and screenshots three
representative slides at 2x device pixel ratio: `slide-title.png`,
`slide-tldr.png`, `slide-recommendations.png`.

## Adding a new example

A new audit goes in its own subdirectory: `docs/examples/<domain>/`. The
README's "Example output" section should link the most polished one as
the canonical preview; additional examples can be listed in the table
above. Keep large binary artifacts (full-page screenshots, scan JSON over
~50 KB) outside `docs/examples/` if they aren't needed for the published
deck — the goal here is reference output, not a full evidence archive.
