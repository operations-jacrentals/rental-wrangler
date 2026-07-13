# jactec-ui re-spec — router core · taste ledger · chart language · options-first

- **Date:** 2026-07-03
- **Status:** Draft for Jac's redline (co-specced in-session)
- **Branch:** `claude/bugs-improvements-0bocof`
- **Driver:** Jac: the skill "often does not produce the outcome I'm looking for."
  Evidence: PR #450 (Units graph redesign) — five consecutive "Per Jac:" correction
  commits all pulling toward denser, quieter, data-forward UI, plus the hazard-stripe
  seam the skill itself prompted (added a3f7ba7, stripped by Jac 034504b two minutes
  later). PR #456 confirmed the corrected pattern generalizes.

## 1. Diagnosis (what the audit found)

1. **Rule engine, no taste.** ~90% of the skill is constraints (tokens, R-map, bans,
   checklists); nothing teaches composition or Jac's actual density/quietness
   preferences — so Claude's airy-dashboard priors won on every judgment call.
2. **The signature mandate backfires.** "Spend boldness in ONE place (the hazard
   stripe)" reads as an instruction to ADD stripe when something looks plain. Jac's
   revealed preference: quiet is correct inside data surfaces.
3. **Charts are a blind spot.** R1–R24 covers pills/buttons/fields; Graph V2 was 100%
   dataviz. The house chart language Jac converged on exists only in commit messages.
4. **Five jobs, one 368-line body + ~330-word description** — low signal-to-task
   ratio for small edits.
5. **Screenshot self-critique is a mandate with no procedure** — the most-skipped step.
6. **No feedback loop** — Jac's corrections evaporate after each session.

## 2. Decisions (Jac, 2026-07-03, via popup)

| Decision | Call |
|---|---|
| Hazard stripe | **Opt-in only. NEVER apply it unless Jac explicitly asks.** Existing uses stay. |
| Density priors | Encode as first-class law (no legends/titles, counts on chart, minimal vertical footprint, big marks, tight spacing). |
| Signature restraint | "Quiet is correct" — decoration never fixes genericness. |
| Chart language | New `references/charts.md` encoding the Graph V2 pattern. |
| Structure | **Router + lean core** — short SKILL.md routes by task type; depth in references. |
| Process | **Options-first** — for non-trivial UI, 2–3 screenshot variants → Jac picks via popup → then polish. Small edits skip. |
| Taste ledger | **`references/taste.md`, auto-append** — every in-session correction distilled into the same PR, visible in the diff. |

## 3. The new shape

```
jactec-ui/
├── SKILL.md                 ~150 lines: identity · router · core laws · options-first loop · gates
└── references/
    ├── taste.md             NEW — the revealed-preference ledger (seeded from Graph V2) + append protocol
    ├── charts.md            NEW — the house chart language (from #450/#456 + the graph spec)
    ├── craft.md             NEW — the Hobday safe-rules layer + layout + motion + ranch (moved out of SKILL.md)
    ├── tokens.md            unchanged
    ├── rulebook.md          unchanged
    ├── signature-recipes.md EDIT — stripe section carries the opt-in law
    ├── anti-slop.md         EDIT — reframe: quiet-is-correct; genericness is never fixed with chrome
    ├── checklists.md        EDIT — density/chart/options-first boxes; boldness line rewritten
    ├── frontend-design.md   unchanged (vendored) — router scopes it to greenfield surfaces only
    ├── mobile.md            unchanged
    ├── designmd-*.md        unchanged (4 files)
    └── role-*.md            unchanged (2 files)
```

### SKILL.md core laws (the always-on set, compressed)
1. Tokens are law (no hardcoded literals; theme parity).
2. §5 builders + `data-r` stamps; zero R0; rulebook kept truthful.
3. One orange, one meaning (selected · ignition · linked; dark ink on orange).
4. Two type voices (Saira stamped vs Geist read).
5. Status registry + action-color law fixed.
6. AA accessibility gate (contrast · not-color-alone · focus-visible · reduced-motion).
7. **Quiet is correct.** Data surfaces stay calm. Decoration never fixes "generic."
   **Signature devices (hazard stripe above all) are opt-in: only when Jac asks.**
8. **Dense by default.** Vertical footprint is a cost. No legends (hover + aria name
   things), no chart/section titles that repeat the tab, counts folded onto the data,
   marks sized up when chrome is removed, top-aligned tight spacing.
9. Native UI banned (R22/R23/R19 styled paths).
10. Questions to Jac via AskUserQuestion popups, never inline.

### The router (task type → what to load)
- **Any UI task** → read `taste.md` FIRST (it's short; it is Jac's actual taste).
- Small edit to an existing element → `rulebook.md` + `tokens.md`; build directly.
- New/reshaped section, screen, or popup → options-first loop + `craft.md` +
  `anti-slop.md` (+ `signature-recipes.md` only if extending an existing signature surface).
- Any chart/graph/KPI/stat work → `charts.md`.
- Phone/touch work → `mobile.md`. DESIGN.md work → `designmd-guide.md`.
  Spec review → `role-framework.md` + `role-roles.md`. Pre-ship → `checklists.md`.

### Options-first loop (new/reshaped UI only)
1. Frame the brief in one paragraph (subject, job, constraints, where density lands).
2. Build 2–3 genuinely different variants (layout/structure differences, not palette
   tweaks) as real markup in the app.
3. Screenshot each: serve the repo (`node <scratch>/serve.mjs`, port 9147), drive with
   Playwright/`webapp-testing` headless Chromium at 1440×900 (+390×844 if mobile-relevant);
   cloud sessions CAN do this — Chromium is pre-installed.
4. Present via AskUserQuestion (one option per variant, screenshots attached/described).
5. Build out the winner; polish; self-critique screenshot; gates.
Skip for: single-element edits, copy changes, token-value tweaks, bugfixes — but the
self-critique screenshot still runs on every visual change.

### taste.md seed entries (from Graph V2, generalized)
- Legends/titles are chrome → hover + aria + the selected tab carry naming.
- Counts live on the chart, not beside it.
- Vertical height is a core cost; reclaim it (single-line chips, top-align, kill gaps).
- When chrome is removed, size the data marks UP to use the room.
- Fixed, opinionated pairings beat user-facing compare/config toggles (the 2-Up lesson).
- The hazard-stripe seam on the graph section was rejected within minutes → stripe is
  structural chrome (card cap, login, drop zones) and now **opt-in only, everywhere**.
- Armed/selected inside data = orange OUTLINE, never fill.
**Append protocol:** when Jac corrects a design call, add one generalized entry (date ·
what was corrected → the rule) in the same PR. Never delete; supersede.

### charts.md contents (from #450/#456 + `2026-07-03-units-graph-redesign-design.md`)
Group tabs on top · left time-rail (Wk/Mo/30d/60d/90d) only where a dated source exists ·
snapshot→trend morph (donut→stacked proportional-area / trajectory) · honest denominators
(name the shift; never fake history) · direct labels (slices carry counts, band-edge %,
center total + noun) · no legends/titles · hover `data-tip` + aria + keyboard-focusable
marks · fixed side-by-side pairs · empty states always ("No data in this window.") ·
no auto-select on open · armed = orange outline · registry colors for status; blue =
calm trend hue; red = attention leaderboards only · donut sizes (196 single / 144 paired) ·
extend the `GV2` per-source config + V2 renderers (`APP-24/25`, `app.js` §13.3–13.5),
never a parallel chart engine.

### Description rewrite
Same trigger coverage (build/restyle/mobile/DESIGN.md//role, "make this work on phones",
etc.) at roughly half the length; adds chart/graph/KPI triggers explicitly.

## 4. Eval plan (skill-creator loop)

Baseline = the pre-edit snapshot (already copied to the session workspace). Four test
prompts, each run old-skill vs new-skill by parallel subagents in isolated worktrees,
producing a design plan + diff (graded on decisions, not pixels):

1. **Chart class:** "Add a graph section to the Invoices card popup showing invoice
   aging (current/30/60/90) and how collections trend over time."
   → Expect: charts.md pattern, no legends/titles, honest-denominator note, time-rail
   only where dated data exists.
2. **New section:** "Add a Fuel Log section to the unit record — mechanics log fill-ups,
   we track cost per unit." → Expect: options-first popup with 2–3 variants, §5 builders,
   R11 section, density.
3. **Small edit:** "Make overdue rentals stand out more in the rentals list."
   → Expect: registry red via existing builders (R3/R4b/R9b family), no new chrome,
   no options popup (correctly skipped).
4. **The trap (the Graph V2 failure replayed):** "The customers card graphs look a bit
   plain — give them some visual interest." → Expect: NO hazard stripe, no decoration;
   data-forward suggestions and/or a popup asking Jac what feels plain. Old skill is
   predicted to reach for the stripe.

Grading: per-prompt assertion checklist (stripe absent unless asked · no legends/titles ·
builders used · options-first fired only where it should · taste.md consulted). Results
in a side-by-side review for Jac; iterate on misses.

## 5. Out of scope

- Retro-restyling any shipped UI (CLAUDE.md rule stands).
- Un-folding the skill back into separate skills (rejected in the popup).
- The `?v=` cache token / deploy machinery (no runtime files change in this PR).
