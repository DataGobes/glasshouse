# glasshouse-judge (optional)

TypeSafe System One (Jev) judgments for parts of the analysis step. It is
**optional**: nothing in `scripts/` loads it, and without `TYPESAFE_API_KEY`
Glasshouse runs exactly as before, with the analysis written by hand via
SKILL.md. Output uses the analysis JSON schema
(`templates/analysis-schema.json`), so `generate.js` and the complaint builder
take it unchanged.

Not yet wired into SKILL.md: first it has to agree with hand-written analyses
on the replay fixtures (`scripts/replay.js`).

## What it judges today

**Art. 13/14 checklist** → `findings.privacyPolicyAnalysis[]`, the 13 elements
of `references/analysis-guide.md` with `present | vague | absent` and an
excerpt copied from the policy.

0. **Gate.** One Noul over the opening and a middle sample asks whether the
   text is a privacy policy at all. Scans sometimes capture a login,
   password-reset or cookie-only page; those are skipped instead of producing
   13 confident "absent"s. Text cut at a scanner cap (flagged, or exactly
   15000/30000/… chars, which old privacy-scan/2.1 scans don't flag) is still
   judged, but its "absent"s are marked unverifiable and the replay doesn't
   score them.
1. The policy text is split into clauses (`c0001`, …) and packed into windows
   of at most 254 clauses and ~16k characters.
2. Per window, one request asks for every element at once: a **Noul** "does
   any clause address it?" and a **Choice** over the clause IDs plus `none`
   "which clause does?". P(disclosed) is the max over windows.
3. Per disclosed element, one small request asks a **Noul**: taken together,
   is what the policy says specific or vague? It sees up to 4 clauses: the
   pick, the clause after it, and the best candidates from elsewhere, because
   large policies spread one item over several sections (criteria per
   element in `checklists/art13.js`).

## Configuration

| Env var | Default | |
|---|---|---|
| `TYPESAFE_API_KEY` | none | Enables live calls. Without it only cached answers are used. |
| `GLASSHOUSE_JEV_MODEL` | `jev-1.13.0` | Pinned on purpose; bump deliberately and re-run the replay. |
| `TYPESAFE_BASE_URL` | `https://api.typesafe.ai` | |
| `GLASSHOUSE_JUDGE_CACHE_DIR` | `./.glasshouse-judge-cache` | Answers keyed by a hash of the full request (model + state + questions). Contains third-party policy text: gitignored, keep it local. |

## Replay

```bash
TYPESAFE_API_KEY=... node scripts/replay.js                 # all fixtures/replay/<site>/
node scripts/replay.js --site linkedin.com --json report.json
node scripts/replay.js --min-agreement 0.8                  # exit 1 below 80% exact agreement
node scripts/replay.js --disagreements review.md            # review sheet: label or judge? (local only)
```

Per labelled item it compares the judge's status with the hand-written one and
reports exact agreement, "addressed or not" agreement, Cohen's kappa, per
element agreement, a confusion matrix, and what agreement would be at other
specific-vs-vague thresholds (from cached answers, no new calls). Labels named in a fixture's
`validation.errors` are dropped; fixtures with a checklist-related validation
error count at half weight (errors about trackers, cookies etc. don't affect
the checklist score). Hand-written element names are mapped by alias ("Lawful basis",
"Retention period", …); names that map to nothing are listed, not scored.

## Caveats

- Policy text is untrusted third-party content; Jev reads it as state and can
  be steered by text written to do so. Treat output as judgments to review.
- The Choice labels are clause IDs whose text lives in `state.clauses`. Whether
  Jev links the two reliably is exactly what the first live replay will show.
