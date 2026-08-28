# Day-one starter kit

Drop-in scaffolding for a new app you intend to build with AI. Everything here exists because
building it *late* on a previous project cost multiples of what building it early would have.

Nothing here is a framework — two small scripts and five templates. Adapt freely.

## Install in this order

| # | Do this | Why first |
|---|---|---|
| 1 | Copy `ci/smoke.mjs`, run it. | Written before feature one, it never needs retrofitting. Catches roughly half of all "it's broken" reports. |
| 2 | Add a chapter banner to your first source file. | `// ═══ APP-01 · Utilities ═══`. IDs stamped in the source mean `grep APP-01` works from a cold start. |
| 3 | Copy `tools/gen-code-map.mjs`, run it, then wire `--check` into CI. | The `--check` flag is what makes the map impossible to silently drift. |
| 4 | Copy `templates/CODE-MAP.md` and write the *one rule that explains the whole app*. | That single paragraph saves more model time than everything else in the doc. |
| 5 | Copy `templates/DECISIONS.md` and add row #1 today. | A ledger reconstructed later is a guess about what you used to think. |
| 6 | Copy `templates/CLAUDE.md` and `templates/MEMORY.md`. | So session forty knows what session three decided. |
| 7 | Copy `templates/CHARACTERS.md` when you first build UI someone else will use. | |
| 8 | Copy `templates/LOOP-CHECKLIST.md` the first time you want a long unattended run. | |

## What's here

```
ci/smoke.mjs              does it boot? real browser if Playwright is present, HTTP checks if not
tools/gen-code-map.mjs    scans chapter banners → generated index; --check is the CI drift gate
templates/CLAUDE.md       project instructions a model reads every session
templates/MEMORY.md       durable cross-session memory
templates/DECISIONS.md    the append-only decisions ledger
templates/CHARACTERS.md   audit personas + the product voice character
templates/CODE-MAP.md     the hand-written story half of the map
templates/SKILL.md        a skill, with the description pattern that actually triggers
templates/LOOP-CHECKLIST.md   externalized loop state, so long runs converge
```

## The two ideas underneath all of it

**1. Every artifact a human or model must keep in sync gets a generator and a `--check`.**
Same script, two modes: write it, or fail if writing would change anything. That single flag
is what makes documentation non-optional without anyone nagging.

**2. Anything enforced by remembering is already broken** — it just hasn't cost you yet.

## Requirements

Node 18+. No dependencies. Playwright is optional and only upgrades `smoke.mjs` from useful
to strict.
