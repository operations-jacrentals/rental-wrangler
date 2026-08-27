---
name: jactec-ui
description: >-
  The single design skill for JacTec / Rental Wrangler. Use whenever you build,
  reshape, or restyle ANY UI — screen, column, card, section, pill, flag, button,
  field, popup, menu, date picker, or any visible element in app.js / style.css —
  and for ALL chart / graph / KPI / stat-tile / dashboard / trend work (the house
  Graph V2 chart language). Also covers: aesthetic direction & anti-slop; MOBILE
  (phone reflow of the yard grid, bottom sheets, viewport/safe-area, touch
  gestures + haptics); DESIGN.md scaffolding/linting; and the /role audit (15
  role lenses + authority / data-sensitivity gates that catch margin/PII leaks
  BEFORE building). Governs the "yard data-plate" language (dark industrial
  steel, ONE safety-orange accent, stamped Saira Condensed labels, a light
  wrangler seasoning) and its enforcement (§5 builders, the R0–R24 rulebook, CI
  gates) — plus Jac's revealed taste: dense, quiet, data-forward. Triggers: "add
  a column to the units card", "restyle the rentals popup", "add a graph/trend to
  a card", "make this work on phones", "scaffold a DESIGN.md", "run /role on this
  spec". NOT for marketing pages, backend Apps Script, or non-UI logic. Apply
  only to NEW or RESHAPED UI — never retro-restyle untouched parts unless Jac
  asks for a site-wide pass.
---

# JacTec UI — the yard data-plate design system

JacTec is a **dense, dark, industrial equipment-rental ops app** — a steel
data-plate bolted to a machine, not a marketing site. The system is already
encoded in the codebase: tokens, §5 builders, the R0–R24 rulebook, the Graph V2
chart engine. **Your job is to EXTEND it, never to invent a parallel one** — and
to match **Jac's revealed taste: dense, quiet, data-forward.** When in doubt,
match what's there, speak in rule numbers, and ask Jac via popup.

## Router — load only what the task needs

| Task | Load |
|---|---|
| **ANY UI task** | [`taste.md`](references/taste.md) **FIRST** — it's short; it is Jac's actual taste |
| Small edit to an existing element | [`rulebook.md`](references/rulebook.md) (element → builder → rule map) + [`tokens.md`](references/tokens.md); build directly |
| New / reshaped section, screen, or popup | the **options-first loop** below + [`craft.md`](references/craft.md) + [`anti-slop.md`](references/anti-slop.md) (+ [`signature-recipes.md`](references/signature-recipes.md) only if extending an existing signature surface) |
| Any chart / graph / KPI / stat / trend | [`charts.md`](references/charts.md) — the house Graph V2 language |
| Phone / touch / haptics | [`mobile.md`](references/mobile.md) |
| DESIGN.md scaffold or lint | [`designmd-guide.md`](references/designmd-guide.md) (+ spec/lint/stub files beside it) |
| Spec review / `/role` | [`role-framework.md`](references/role-framework.md) + [`role-roles.md`](references/role-roles.md) |
| Greenfield surface with no existing language (rare) | [`frontend-design.md`](references/frontend-design.md) — the general aesthetic-direction method; on existing surfaces the data-plate language already IS the direction |
| Pre-ship | [`checklists.md`](references/checklists.md) |

## The ten core laws (always on)

1. **Tokens are law.** Every color/size/radius/shadow/font derives from the
   `style.css` `:root` custom properties — never a hardcoded literal. Dark is
   default; light + yard/ranch override the same names, so token-expressed work
   themes itself. Mirror every treatment across themes. Literals: `tokens.md`.
2. **Emit from a §5 builder with a `data-r` stamp.** Any new/changed pill · flag
   · add · button · field · date picker · file-drop · ✕ comes from a §5 builder
   stamping `data-r="Rxx"` — never hand-rolled markup. Build target = **ZERO R0
   flash-lint violations**. If a rule/token changes, update `RULE_META` +
   `RB_FOUNDATION` + `RB_TABS` in the same edit; debug in rule language ("that
   violates R4 — fix `dPill`"), fixing the builder, never one instance.
3. **One orange, one meaning.** `--accent` = selected tab · ignition/primary ·
   linked (R2) — nothing else, never decorative. Orange surfaces carry dark
   `--on-orange` ink. **Armed = orange OUTLINE, never fill.**
4. **Two type voices.** Saira Condensed (UPPERCASE, tracked, 600–800) is the
   stamped voice — labels, tabs, section headers, ignition buttons only. Geist is
   everything you read; record names are Geist bold, not caps.
5. **Status registry + action-color law are fixed.** Registry: green ready ·
   yellow caution · red danger · blue link/calm-trend · purple scheduled · gray
   fact. Action intent: blue commit · green money · red destructive (R17). Never
   invent or repurpose a color.
6. **Accessibility is a gate.** AA contrast in dark AND light AND ranch; never
   meaning by color alone; visible `:focus-visible` everywhere; animations
   degrade under `prefers-reduced-motion`. Depth: `craft.md`.
7. **Quiet is correct.** Data surfaces stay calm. Decoration NEVER fixes
   "generic" — identity comes from tokens, type, and builders. **Signature
   devices (the hazard stripe above all) are OPT-IN: apply only when Jac
   explicitly asks.** If something "looks plain," the answer is density, data,
   or a popup asking Jac — not chrome.
8. **Dense by default.** Vertical footprint is a cost. No legends; no titles
   that repeat the tab; counts folded onto the data; hover `data-tip` + aria
   carry naming; marks sized UP when chrome is removed; single-line chips;
   top-aligned tight spacing. (But density never becomes cramped — split views
   rather than shrink past legible.)
9. **Native UI is banned.** No `title=` (R23 `data-tip`), no native date picker
   (R22 `dateField`), no `alert()` (R19 attention-flash at the fix).
10. **Ask Jac via AskUserQuestion popups, never inline** (CLAUDE.md rule).

## Options-first loop (new / reshaped UI only)

1. **Frame the brief** in one paragraph: subject, job, constraints, where the
   density lands.
2. **Build 2–3 genuinely different variants** — layout/structure differences,
   not palette tweaks — as real markup in the app.
3. **Screenshot each:** serve the repo on port 9147, drive headless Chromium via
   Playwright / `webapp-testing` at 1440×900 (+390×844 if mobile-relevant).
   Cloud sessions CAN do this — Chromium is pre-installed.
4. **Present via AskUserQuestion** — one option per variant, screenshots
   attached/described. Jac picks.
5. **Build out the winner; polish; self-critique screenshot** (review against
   `taste.md` + `anti-slop.md`, remove one accessory); then the gates.

**Skip the loop** for single-element edits, copy changes, token-value tweaks,
and bugfixes — but the self-critique screenshot still runs on every visual
change.

## Feedback loop — keep `taste.md` current

When Jac corrects any design call in-session, append ONE generalized entry to
`references/taste.md` (date · what was corrected → the rule) **in the same PR**.
Never delete; supersede. This is how corrections outlive the session.

## Gates before push (push to `main` = live)

`node ci/smoke.mjs` · `node ci/logic-test.mjs` · `node ci/gen-rule-usage.mjs
--check` (regen without `--check` when rule usage changed) ·
`node ci/check-window-catalog.mjs` · `node tools/gen-code-map.mjs --check` ·
**zero R0 violations** · self-critique screenshot. Deploy = feature branch → PR →
squash-merge (main is branch-protected). Never push a failing gate; never put
model ids / secrets / passwords in the repo (it's public via Pages). Full list:
[`checklists.md`](references/checklists.md).
