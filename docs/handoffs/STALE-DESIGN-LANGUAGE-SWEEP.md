# Handoff — sweep the superseded design language out of the specs

**Created 2026-07-26.** Self-contained: everything needed is below. Est. one focused session.

## The job in one line

**~30 documents still describe the OLD design language** — `#ff7a1a`, Saira Condensed, the
hazard-stripe, rivets — and/or still tell the reader to run UI through **`jactec-ui`, a skill that
no longer exists** (deleted 2026-07-26, PR #775). Bring them to current canon.

## Why it matters

These are **live product specs**, not history. Anyone building from one today gets pointed at a
deleted skill and a retired palette. The current canon is:

| | superseded (what the specs still say) | **current** |
|---|---|---|
| Accent | `--accent #ff7a1a` | **`#ff7e1f`** |
| Body voice | **Saira Condensed** | **Archivo** (mono voice unchanged) |
| Control shapes | one 7px chip radius, **then** four shapes (squared/opener/rounded/pill) | **radius 0 + finishes** — machined ring · well glass · pressed key · dark key (ledger #140, 2026-07-28). Door alone keeps its pill (#153) |
| Signature | hazard-stripe + rivets, ignition buttons | **not re-adopted** — matte, **no glow** |
| Design skill | `jactec-ui` | **`style` + `wrangler-style`, both, always** |

Sources of truth: `.claude/skills/wrangler-style/SKILL.md` (decisions),
`.claude/skills/style/SKILL.md` (measurable rules), and
`docs/superpowers/specs/2026-07-20-decisions-ledger.md` (the index — **read to the end**, rows #101+
supersede some of #1–100).

## The worklist

### Class B — describes the old language (26 files, the real work)

Each is phrased differently — **this is not a find-and-replace.** Expect a bespoke edit per file.

**Start with the two heavyweights** (they're the canonical design descriptions others echo):

| File | old-language hits |
|---|---|
| `DESIGN.md` | 13 |
| `docs/specs/design-system.md` | 10 |

Then, by weight: `mobile-remote.md` (9) · `hr-compliance.md` (9) · `customers-crm.md` (9) ·
`automated-pricing.md` (7) · `security-cameras.md` (6) · `marketing.md` (5) · then the remainder:
`accounting.md` · `backend-data.md` · `collections.md` · `comms-notifications.md` ·
`customer-portal.md` · `equipment-insurance.md` · `financials-kpi.md` · `flag-color-system.md` ·
`fleet-spread.md` · `gps-tracking.md` · `maintenance-shop.md` · `maps-location.md` ·
`market-research.md` · `memberships.md` · `rentals-dispatch.md` · `sales-growth.md` ·
`search-views.md` · `units-fleet.md`.

Find them with:
```
grep -rln 'ff7a1a\|Saira\|hazard.stripe\|rivets' docs/specs/ DESIGN.md
```

### Class A — only names the dead skill (4 files, quick)

`AGENTS.md` · `backlog.md` · `docs/specs/AREAS-ROADMAP.md` · `docs/specs/wrangler-ai.md` —
just reroute the pointer to `style` + `wrangler-style`.

### Leave alone

- **`docs/superpowers/plans/` (~17 dated plans)** — historical records of builds that really did run
  through `jactec-ui`. **Rewriting them falsifies the record.** Don't.
- The one prose mention in an `app.js` comment (~line 25616). Harmless.

## Two judgement calls to make, not guess

1. **`DESIGN.md` may be being retired, not fixed.** It's the portable YAML-tokens file (a Google Labs
   spec) and its scaffolding guides now sit unowned in
   `docs/design/reference/legacy-jactec-ui/designmd-*.md`. **Ask Jac whether DESIGN.md is still a
   live artifact** before investing in rewriting 13 references inside it.
2. **`docs/specs/design-system.md` may substantially duplicate `wrangler-style`.** If so, the right
   fix is to make it a pointer rather than a second, drifting copy — that duplication is exactly how
   today's mess started. Check before rewriting it in place.

## What "done" looks like

- `grep -rn 'ff7a1a\|Saira\|hazard.stripe\|rivets' docs/specs/ DESIGN.md` returns nothing, **or**
  only clearly-labelled "superseded, kept for history" notes.
- `grep -rn 'jactec-ui' docs/specs/ AGENTS.md backlog.md DESIGN.md` returns nothing.
- `docs/superpowers/plans/` is **untouched**.
- Gates pass: `node ci/smoke.mjs`, `node ci/gen-rule-usage.mjs --check`,
  `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`,
  `node ci/check-cachebust.mjs`. (Port 8000 is reserved — `sed -i 's/8000/9147/g' ci/smoke.mjs
  ci/logic-test.mjs`, run, then `git checkout -- ci/`. Playwright is global here:
  `ln -sfn /opt/node22/lib/node_modules/playwright node_modules/playwright`.)
- Docs-only, so no cache-bust bump — `check-cachebust` confirms.

## Traps

- **Don't restyle the app.** This is a documentation sweep. No `style.css`, no `app.js`.
- **Don't invent canon.** If a spec describes something the current skills don't cover, that's a
  finding to report, not a licence to decide. Add it to the ledger only with Jac's say-so — a
  decision isn't made until it has a row (#135).
- **Read the ledger to the END.** Rows #1–100 are a 2026-07-20 snapshot; #101+ supersede several of
  them. Grepping and stopping at the first hit is how a superseded decision got cited as canon on
  2026-07-26 — it cost three audits and six PRs.

## Background

`jactec-ui` was deleted in PR #775, executing ledger #26/#91 (recorded 07-20, never carried out).
Four capabilities lived only in it and were preserved as reference in
`docs/design/reference/legacy-jactec-ui/` — the `/role` audit, mobile, anti-slop, and the DESIGN.md
guides. See that folder's README; it also carries the recommendation for where those should
eventually live as skills.

## Wave 2 — folded in 2026-08-01: the "current canon" table above is now ITSELF stale

The **Control shapes** row this document has called current since 2026-07-26 — "four shapes:
squared 2px state · opener 5px 5px 0 0 (Gate/Field) · rounded 8px records · pill (Doors only)" —
was superseded on **2026-07-28** by ledger **#140**: **radius 0 + chamfers on every control atom**
(Signal, Gate, Slot, Field, Ref), with shape semantics moved into FOUR **finishes** instead
(machined ring, well glass, pressed key, dark key). Door alone still keeps its pill (#153 —
predates radius-0, never in scope). A same-session batch (#142/#152/#153/#166/#177) also:

- put **mono on every control atom** (Ref was the last one speaking Archivo),
- **renamed Pin → Slot** everywhere (numeral-only collapsed face, hover-unfurl tray instead of a
  tooltip),
- reconciled `tokens.css` against ~20 hard-coded `TOKEN-GAP:` values in `tier-01-card.css`.

This landed in `docs/handoffs/2026-07-31-cascade-tier01-decisions.md`'s worklist (worked
2026-08-01): the **kit** (`docs/design/rw-design-system/` — every file, incl. `elements/pin.html`
→ renamed `elements/slot.html`), `docs/design/tier-01-handoff/atom-rebuild.md` (the 8-tick cap /
fixed-114px board facts it stated, retired by #170), the six **Labs prompts**
(`docs/design/prompts/prompt-00`…`05`, each given a `#145` "still honoured?" checklist), and
`docs/design/audit/prompt-b-tier-01-card.md` (regenerated via `/prompt-b`) are now current. This
document's own table row above is updated to match.

**Not yet done — genuinely a second pass, not duplicate work:** the ~30 `docs/specs/*.md` +
`DESIGN.md` files this sweep's Wave 1 targeted for the `#ff7a1a`/Saira/`jactec-ui` language were
never checked for the **four-shape-radius-ladder** language (`one 7px chip radius` → `four shapes`
→ now **radius-0 + finishes**), because Wave 1's grep (`ff7a1a\|Saira\|hazard.stripe\|rivets`)
wouldn't have caught it — a spec could describe the four-shape ladder without mentioning any Wave-1
term at all, or could have been "fixed" mid-Wave-1 to cite the four-shape ladder as current, which
is now itself wrong. Find candidates with:
```
grep -rln '7px chip\|opener.*5px 5px 0 0\|four.*shape\|four control shapes' docs/specs/ DESIGN.md
```
Same worklist discipline applies: bespoke edit per file, leave `docs/superpowers/plans/` alone
(historical record), don't invent canon beyond what `#140`/`#142`/`#152`/`#153`/`#166`/`#177`
actually settled.
