# Legacy `jactec-ui` references — capability rescued, design language retired

The **`jactec-ui` skill was deleted** (Jac, 2026-07-26 — executing ledger **#26/#91**, which recorded
the deletion back on 07-20 but was never actually carried out; the skill stayed on disk and `/start`
+ `CLAUDE.md` kept routing every UI change to it).

**The design language it taught is superseded.** `style` (measurable rules) + `wrangler-style`
(locked decisions) are the canon now, and they disagree with `jactec-ui` on real things:

| | `jactec-ui` (retired) | `style` + `wrangler-style` (current) |
|---|---|---|
| Accent | `#ff7a1a` | `#ff7e1f` |
| Body voice | Saira Condensed | **Archivo** |
| Control shapes | one 7px chip radius | **four shapes** — squared · opener · rounded · pill |
| Signature | hazard-stripe + rivets | **not re-adopted** — matte, no glow |

## Why these eight files survived the deletion

Four capabilities lived **only** inside that skill and have **no home in the replacements** —
verified, not assumed:

- **`role-framework.md` + `role-roles.md` — the `/role` audit.** The 15 role lenses plus the
  authority / data-sensitivity / gate checklist, used to catch **margin-floor and PII leaks and
  missing gates before building.** `style` and `wrangler-style` contain **zero** coverage of this.
  Deleting it outright would have been a security-adjacent regression, which is why it is here.
- **`mobile.md`** — phone reflow of the 3-column yard grid, bottom sheets, viewport/safe-area/dvh
  sizing, tap vs long-press vs drag vs swipe, Vibration-API haptics. Effectively uncovered elsewhere.
- **`anti-slop.md`** — the checklist for avoiding templated, AI-default output.
- **`designmd-*.md`** — scaffolding and linting the portable YAML-tokens `DESIGN.md`.
- **`rulebook.md`** — a **mirror** of `RULE_META` in `app.js` (the R0–R24 `data-r` rulebook). It is
  documentation, not a source of truth: CI (`ci/gen-rule-usage.mjs`) reads `app.js`, so **no gate
  depended on this file** — it is kept as the readable index.

## Status: reference only, and two of these need a real home

These files are **not a skill** — nothing loads them automatically. They are readable canon for the
capabilities above until someone gives them a proper one.

**Open follow-up for Jac:** the **`/role` audit** and **mobile** guidance deserve to be their own
skills so they trigger automatically again. Right now they only work if someone remembers to open
this folder — which is exactly the "lives in the wrong place" failure that cost three audits on
2026-07-26. Filed rather than invented: creating two new skills is a decision, not cleanup.

Anything else from the old skill (tokens, signature recipes, checklists, frontend-design,
jactec.design.md) was **dropped deliberately** — it taught the superseded design language, and it
remains recoverable from git history.

## Dangling references left in place (deliberately)

Retiring the skill leaves pointers behind. These were **not** rewritten:

- **~17 dated plans under `docs/superpowers/plans/`** — these are *historical records* of builds
  that really did run through `jactec-ui` at the time. Rewriting them would falsify the record.
- **~27 live specs under `docs/specs/`, plus `DESIGN.md`, `AGENTS.md` and `backlog.md`** still name
  the deleted skill and, in several cases, still *describe the old language*. The clearest example is
  `docs/specs/sales-growth.md`, whose "yard data-plate" paragraph still specifies `#ff7a1a`, Saira
  Condensed, rivets and the hazard stripe, and instructs the reader to run UI through the skill that
  no longer exists.

  **Not corrected here, on purpose.** That is ~30 product specs Jac owns; quietly rewriting their
  design sections while retiring a skill would bury a large content change inside a cleanup commit.
  It is real follow-up work, and it is filed as such rather than done by stealth.

- One prose mention in an `app.js` comment (~line 25616) referencing the old screenshot
  self-critique step. Harmless; left for whoever next touches that block.
