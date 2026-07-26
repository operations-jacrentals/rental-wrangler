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

## Where these should actually live — the recommendation

**The lesson from `jactec-ui` is that one skill doing four jobs rots**, because the parts get
superseded at different rates and nobody notices the stale ones. So the answer is *not* "make a new
combined design skill." It is to put each capability where its own kind of content already lives:

| Capability | Recommended home | Why |
|---|---|---|
| **mobile** | **split across the existing two** — measurable bits (≥44px touch floor, safe-area/dvh sizing, gesture timing thresholds) into `style`; decisions (bottom sheets, the 3-column phone reflow, which gesture does what, haptics) into `wrangler-style` | Matches the established rules-vs-decisions architecture. **No new skill** — mobile isn't a separate discipline, it's the same design system at another width. |
| **`/role` audit** | **its own skill** (`.claude/skills/role/`) | It is a **review gate**, not design language — explicitly invoked, its own triggers, its own output. Critically it is the **PII / margin-leak** check, and burying a security gate inside a styling skill is how it gets skipped by a design-focused session. |
| **anti-slop** | **`wrangler-style`** | "Don't look generic" is a voice/decision concern, and it's short. |
| **DESIGN.md guides** | **decide first** | Ask Jac whether `DESIGN.md` is still a live artifact. If it's being retired, these go with it; if it's live, they belong wherever it's owned. Don't build a skill for a file that may be on the way out. |

⚠️ **One thing to check before creating the `/role` skill:** it overlaps the existing **`lazy-audit`**
skill, which is also role-lens auditing. They are *probably* distinct — `lazy-audit` walks a **running
surface** as one persona; `/role` reviews a **spec** against 15 lenses plus the authority /
data-sensitivity / gate checklist — different inputs, different outputs. But confirm that before
standing up a second, overlapping skill rather than extending `lazy-audit`.

**All of this is filed, not done.** Creating skills and moving canon between them is a decision, not
cleanup — and doing it silently is what produced the mess this folder documents.

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
