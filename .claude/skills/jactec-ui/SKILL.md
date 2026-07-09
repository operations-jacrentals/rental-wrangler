---
name: jactec-ui
description: >-
  The single design skill for JacTec / Rental Wrangler. Use whenever you build,
  reshape, or restyle ANY UI — a screen, column, card, section, pill, flag,
  button, field, popup, menu, date picker, KPI ring, or any visible element in
  app.js / style.css — AND for the four folded sub-capabilities: (1) aesthetic
  direction / typography / avoiding templated AI-default "slop"; (2) MOBILE work
  — phone reflow of the 3-column yard grid, bottom sheets, viewport/safe-area/dvh
  sizing, touch gestures (tap vs long-press vs drag vs swipe) and Vibration-API
  haptics; (3) DESIGN.md — scaffolding or linting the portable YAML-tokens design
  file (Google Labs spec); (4) the /role audit — reviewing a spec/feature/screen
  through the 15 Jac Rentals role lenses + the authority / data-sensitivity / gate
  checklist to catch margin/PII leaks and missing gates BEFORE building. Governs
  the "yard data-plate" design language (dark industrial steel, ONE safety-orange
  accent, hi-vis hazard-stripe signature, stamped Saira Condensed labels, rivets,
  a light wrangler/ranch seasoning) and its enforcement machinery (the §5
  builders, the R0–R25 stamped rulebook, the R0 flash-lint, the CI gates). Exists
  to keep UI unmistakably OURS and never generic, AI-detectable slop. Triggers:
  "add a column to the units card", "restyle the rentals popup", "make a new
  status pill", "make this work on phones", "wire a long-press", "scaffold a
  DESIGN.md", "run /role on this spec", "run it through the design language". Do
  NOT use for: marketing/landing pages, backend Apps Script (Code.gs), or non-UI
  logic. Apply only to NEW or RESHAPED UI — never retroactively restyle untouched
  parts unless Jac asks for a site-wide pass.
---

# JacTec UI — the yard data-plate design system

JacTec is a **dense, dark, industrial equipment-rental operations app** — not a
marketing site. Every screen should read like a steel **data-plate** bolted to a
machine in the yard: quiet steel surfaces, one safety-orange ignition accent, the
hi-vis hazard stripe as the signature, stamped condensed labels, a light wrangler
twist in the copy. The whole system is already encoded in the codebase. **Your job
is to EXTEND it, never to invent a parallel one.** When in doubt, match what's
there and speak in rule numbers.

**This is the one design skill** — it absorbed the former `frontend`, `mobile-*`,
`design-md`, and `role` skills. The **build language below is the dominant content**;
the four folded sub-capabilities each live behind a reference and have their own
section near the end: **Aesthetic direction**, **Mobile**, **DESIGN.md**, and the
**/role audit**. Jump to the section you need; everything visual still routes through
the rulebook.

> Load the right reference for depth.
> **Build language:** [`references/tokens.md`](references/tokens.md)
> (every color/size literal, all themes) · [`references/rulebook.md`](references/rulebook.md)
> (the full R0–R25 catalog) · [`references/signature-recipes.md`](references/signature-recipes.md)
> (copy-paste hazard stripe / rivets / ignition / rings / focus / reduced-motion)
> · [`references/anti-slop.md`](references/anti-slop.md) (the banned looks + tells)
> · [`references/checklists.md`](references/checklists.md) (pre-ship gate).
> **Folded sub-capabilities:** [`references/frontend-design.md`](references/frontend-design.md)
> (aesthetic-direction method) · [`references/mobile.md`](references/mobile.md)
> (viewport + reflow + touch/haptics) · [`references/designmd-guide.md`](references/designmd-guide.md)
> + [`references/designmd-spec.md`](references/designmd-spec.md) +
> [`references/designmd-lint.md`](references/designmd-lint.md) +
> [`references/jactec.design.md`](references/jactec.design.md) (DESIGN.md) ·
> [`references/role-framework.md`](references/role-framework.md) +
> [`references/role-roles.md`](references/role-roles.md) (/role audit).

## Requirements — non-negotiable, read before touching any UI

1. **Tokens are law.** Derive every color, size, radius, shadow, and font from the
   CSS custom properties in `style.css` `:root`. **Never** hardcode a hex, px
   shadow, or font-name in `app.js` markup or new CSS. Dark `:root` is the default;
   `[data-theme="light"]` and `[data-theme="yard"]`/`[data-theme="ranch"]` override
   the **same** token names — so a treatment expressed in tokens themes itself for
   free. Mirror every new treatment across dark + light (+ the active yard theme)
   and confirm parity. Literals live in `references/tokens.md`.
2. **Emit from a §5 builder with a `data-r` stamp.** Any new/changed pill · flag ·
   add · button · field · date picker · file-drop · close-✕ MUST be produced by a
   §5 builder in `app.js` that outputs `data-r="Rxx"`. Never hand-roll a
   `.pill`/`.flag`/`.add-field`/`.req`/`.linkname` inline — extend the matching
   builder so the fix lands everywhere. **Build target = ZERO R0 flash-lint
   violations** (the lint pulses any un-stamped lint-family element red).
3. **One orange, one meaning.** `--accent #ff7a1a` (ink `--on-orange #1a1205`) is
   reserved for exactly three things: the **selected tab**, the **ignition/primary
   action**, and **linked-record** affordances (R2). Never decorative, never a
   second status color, never a hero gradient. Selected = solid orange + dark ink;
   armed = orange **outline**, not fill. Orange surfaces always carry dark ink,
   never white.
4. **Two type voices, strictly separated.** `Saira Condensed` (UPPERCASE,
   ~1.4–2px tracking, 600–800) is the **stamped** voice — wordmarks, column/section
   tabs, KPI/micro labels, section headers, ignition buttons ONLY. `Geist`
   (`var(--font)`) is body for everything you **read**; record names are Geist
   bold, not caps. `ui-monospace` is only for the Inspector tag + builder names.
   Body in the condensed face reads shouty; a stamped label in a neutral sans reads
   generic. (Under `[data-theme="ranch"]` the stamped voice swaps to `Zilla Slab`
   via the theme block — don't fight it.)
5. **Status registry + action-color law are fixed and separate.** Registry colors
   carry one meaning everywhere: `--green` ready · `--yellow` caution · `--red`
   danger · `--blue` link · `--purple` scheduled · `--gray` plain fact. Action
   *intent* is separate: blue = commit/save, green = takes money, red =
   destructive-confirm (R17). Never invent or repurpose a color.
6. **Accessibility is a gate, not a nicety.** Meet WCAG AA — ≥4.5:1 text, ≥3:1
   large/UI — in dark **and** light **and** ranch. Never encode meaning in color
   alone (always color + label + parent-card icon). Every interactive element has a
   visible `:focus-visible`. Every animation degrades to a steady state under
   `prefers-reduced-motion`.
7. **Keep the rulebook truthful.** When you add or change a rule or token, update
   `RULE_META` + `RB_FOUNDATION` + `RB_TABS` in the **same edit**, and speak/debug
   in rule language ("that violates R4 — fix `dPill`") — fix the one builder, never
   patch a single instance.
8. **Route native UI through the styled path.** No native `title=` (use R23
   `data-tip`), no native date picker (R22 `dateField`), no `alert()`/raw error
   text (R19 attention-flash that points at the on-screen fix). Reaching for a
   browser default is a tell.

## The element → builder → rule map (use the builder, never hand-roll)

| You need… | Builder | Rule |
|---|---|---|
| Status DROPDOWN that advances a record (big shape + chevron) | `gatePill`/`gatePillRaw`/`funnelPill`/`masterGate`/`unitStatusGate` | **R1** |
| LINKED record (orange-outline / R10-chip, opens a record, optional ✕) | `refPill` / `unitPill` | **R2** |
| Informational STATUS badge (registry color, parent-card icon, never an action) | `statusPill` | **R3** |
| Plain FACT chip (`480 HRS`, `No GPS` — gray, no icon, no hover) | `badge` | **R3b** |
| DERIVED pill riding its parent (ink+icon only, right of parent) | `dPill` | **R4** · `dPill({alert})` → **R4b** (pulses) |
| BLUE dashed `+Thing` (links/creates a record OR adds a line item) | `addBtn({link\|line\|anchor})` | **R5b** |
| GRAY dashed `+Thing` (a normal empty field) | `addBtn()` | **R5c** |
| Required-until-entered (white bg + dark ink, stays loud) | `reqBtn` | **R6** |
| Hyperlink (blue · italic · not bold · permanent underline) | `linkName` | **R7** |
| Derived/computed VALUE (italic — you didn't type it) | `kv({derived})` / `.derived` | **R8** |
| Title mini-flags (≤2 stacked, no backgrounds) | `flagEl` / `flagsStack` | **R9** · `flagEl({alert})` → **R9b** (pulses) |
| S1 title chip (dark chip · white bold · plain orange icon · orange border) | `.c-titlecard` (`cardEl`) | **R10** |
| Section (centered header; header+border follow live status) | `.section` + `sec-green/yellow/red` | **R11** |
| Notes line (boxless; filled→top, empty→bottom) | `notesSection` | **R12** |
| History (count chips above an inline filter) | `historySection` | **R13** |
| 3-state segmented toggle | `segCtl` | **R14** |
| Journey (yard +Start/+FC/+End · transport) | `yardToolHtml` / `miniJourneyHtml` | **R15** |
| Day timeline (window in day cells) | the rentals `timeline` | **R16** |
| Forward-action button (blue commit / green money / red danger) | `actionPill` | **R17** |
| The ONE quiet action (Cancel/Close/Exit/Clear) | `ghostPill` | **R18** |
| Attention flash that points AT the fix (replaces an error toast) | `attnFlash` / `flashOr` | **R19** |
| Right-click / long-press menu | `openCtxMenu` | **R20** |
| Massive popup add-file zone | `fileDrop` | **R21** |
| The ONE app-styled single date/time picker | `dateField` | **R22** |
| Tooltip (NEVER native `title=`) | `data-tip` attribute | **R23** |
| Deliberate close/remove ✕ (red circle, white ✕) | `closeX` | **R24** |

Full one-liners + do/don't per rule: [`references/rulebook.md`](references/rulebook.md).
If an element genuinely has no rule, that's a decision to make WITH a new builder +
a new `RULE_META` row + a `data-r` stamp — not an excuse to drop raw markup.

## The objective safe-rules layer (apply unless you state a reason to override)

Anthony Hobday's near-always-safe visual rules, adapted for a dense dark ops UI.
They sharpen the system; they don't replace it.

- **Near-black, near-white, never pure.** `--bg #0b0c0f` / `--txt #e9edf4` already
  satisfy this — never introduce `#000` or `#fff`. Reserve max contrast for orange.
- **Saturate neutrals one temperature.** Keep new neutrals on the existing yard
  cast; never drop a dead `#888` gray in, never mix warm + cool.
- **High contrast only for what leads.** Lines, `--txt-3` micro-labels, and panel
  edges stay low-contrast; spend high contrast on data values, status, and orange.
  Avoid both the even-grey-soup and the low-contrast fad.
- **Depth by lightness, not shadow, on dark.** Closer = lighter. Use only the two
  defined elevations (`--shadow` floats cards/popups; `--chip-shadow` lifts
  chips/rows) plus the orange halo ring on menus/pop-ups and the `#18b6ff` neon ring
  for an anchored "you are here" record. **No new drop shadows on dark cards**;
  don't mix shadow/border/flat across sibling panels. Delineate sections with
  `--line` borders that contrast both surfaces, not big fills.
- **One math spacing scale.** Pull every gap/pad from the rhythm (grid 12 · list 7
  · section pad 12 · row pad 9–11; radius `--radius 14–16` / `--chip-radius 11–12` /
  8–10 controls / 999 pills). No one-off 13px/7px values. **Outer padding ≥ inner.**
- **Nest radii properly:** inner = outer − gap. **Dim icons** to match the text
  weight beside them. **Collapse redundant dividers** — one divide per boundary.
  **Optical-align** glyphs whose visual center ≠ geometric (chevron, ▸).
- **Deliberate overrides, named.** We legitimately override Hobday's marketing-tuned
  16px-body / ~70-char-line rules: a dense yard grid runs smaller, tighter type (the
  28/15/13/12/11/10/9.5px scale, 11px badges) and narrow numeric columns on purpose.
  Enforce a minimum **legible** size and split into more views rather than shrink
  past it — never let density become cramped. This is the one place we deviate.

## Accessibility & contrast (hard)

- **Check ratios, don't eyeball.** AA in dark **and** light **and** ranch. Light
  theme darkens status colors so pill TEXT reads on the soft `-bg` fills — preserve
  that when adding/altering a status.
- **Orange ink is fixed:** orange surfaces carry dark `--on-orange`, never `--txt`.
- **Never color alone** — color + label + parent-card icon, always.
- **Visible `:focus-visible`** on every interactive element (`outline: 2px solid
  var(--accent); outline-offset: 2px`).
- **Respect `prefers-reduced-motion`** — pulses/barber-poles freeze to steady.
- **Don't rely on hover** for critical info; long-press (R20) + tap reach it too.

## Layout — flexible grids, recognition over recall

- **The yard grid is fixed 3-equal-column** (Units / Rentals / Customers), 12px gap,
  with a desktop floor. Below the floor the page **pans** horizontally — it never
  squishes the columns, and the body never scrolls vertically. Don't introduce a
  vertical-scroll page.
- **Modern layout only:** CSS Grid + container queries (`@container`) for anything
  that adapts to its container — never a 12-col bootstrap clone. Section headers are
  centered Saira caps with flags pinned absolutely so the title stays true-center.
- **Recognition over recall.** Reuse established shapes so a status pill looks like
  every status pill and an add like every add. Consistency *is* grouping: repeat the
  exact treatment for related items rather than improvising a variant.
- **Button order & flow.** Keep confirm/cancel in the established order/position;
  the ignition/commit action gets the weight, the ghost (R18) stays quiet. Order by
  visual weight, heaviest toward the outer edge. **Minimize clicks** — a one-gate
  move should never become a multi-step dialog.

## Signature, motion & the ranch seasoning

- **Spend boldness in ONE place: the hi-vis hazard stripe** —
  `repeating-linear-gradient(135deg, var(--yellow) 0 13px, #14181d 13px 26px)` (red
  variant for danger/abort). Apply it as plate **chrome** — the card cap, the login
  band, drop zones, the R4b hazard cap — and keep everything around it quiet. Stripes
  + rivets are intentional "complex" texture: keep DATA and reading content on calm
  fields (simple-on-complex), never behind text. Supporting devices: corner rivets,
  recessed detent wells, stamped labels, the ignition button. Reference
  implementations live in the `.login-*` and `.cancel-arc` blocks in `style.css` —
  match them. Snippets: [`references/signature-recipes.md`](references/signature-recipes.md).
- **Motion is fast + functional, one orchestrated moment.** .12s controls · .15s
  surfaces · .5s rings/timeline. Use the named keyframes only (`attnGlow`, `plateIn`,
  `flagPulse`, `rwLint`). **Forbidden:** generic `transition: all 0.2s ease`,
  bouncy/overshoot easing, scattered ambient micro-interactions — those read
  consumer-marketing. Default crisp ease-out; reserve the one beat (the attnGlow that
  REPLACES an error by pointing at the fix).
- **Ranch is a seasoning, never the meal.** Carry it mostly through VOICE/COPY in the
  yard/wrangler register (Wrangle · Round up · Corral · Brand · Saddle up · Rein in).
  Restrained visual cues only: worn leather-tan (`--tan`) for tiny touches +
  saddle-stitch dashed dividers; a rare brand/star marker. **Litmus: if a glance
  reads "western" before "industrial rental yard," dial it back.** Never add
  wood/rope/saloon-serif as a dominant skin in the dark/light themes.
- **Copy is design material.** Active voice; an action keeps its name through the
  whole flow ("Release to cancel" → matching toast). Errors say what's wrong and how
  to fix it in the interface's voice — never apologize, never vague. Empty states
  invite action.

## Workflow: structure → tidy → responsive → polish → self-critique

0. **Plan tokens first** (the aesthetic-direction method — [`references/frontend-design.md`](references/frontend-design.md)). Name the surfaces, status
   colors, type roles, layout concept, and where the ONE signature beat lands.
   Confirm it dodges the three AI defaults (cream+serif+terracotta /
   near-black+acid-green / broadsheet hairlines). If `brainstorming` is opted in, its
   HARD-GATE forbids code before an approved design+spec. **Ask Jac any decision via
   the AskUserQuestion popup, never inline** (CLAUDE.md rule).
1. **Structure** — right builders, right stamped elements, correct rules + data.
   Make it correct in rule language before styling.
2. **Tidy** — one spacing scale, align everything to something, nested radii,
   collapsed dividers, outer ≥ inner padding, weight ordering. Reason for every choice.
3. **Responsive** — grid pans (never squishes); container queries where a piece
   adapts; minimum-legible-size honored (split, don't shrink); touch reaches every action.
4. **Polish** — dim icons, optical-align glyphs, tune the one motion moment, wire the
   halo / anchored ring, mirror into light (+ ranch).
5. **Self-critique before showing Jac** — screenshot and review against this skill
   (a picture is worth 1000 tokens); "remove one accessory"; run the anti-slop
   checklist; then the gates.

## Anti-slop checklist (catch these before you ship)

The three banned AI-default looks: ① cream `#F4F1EA` + high-contrast serif +
terracotta · ② near-black + a single acid-green/vermilion accent · ③ broadsheet
hairlines + zero radius + dense newspaper columns. We are none of them. Then:

- [ ] Any pill/flag/add/button/field **without a `data-r` stamp** (#1 tell) → route through a §5 builder.
- [ ] Pure `#000` surface or `#fff` text anywhere → use the near-black/near-white tokens.
- [ ] Orange as decoration, a 2nd status color, or a hero gradient → accent = selected · ignition · linked only.
- [ ] New drop shadow on a dark card, or mixed elevation across siblings → lightness + the two defined elevations.
- [ ] A dead `#888` / off-temperature gray instead of a token.
- [ ] Body set in Saira Condensed, or a label in a neutral/system sans → keep the two voices separate (Inter/Roboto/Arial/system/Space Grotesk are banned for labels).
- [ ] Arbitrary one-off spacing instead of the scale; inner padding tighter than outer.
- [ ] Mismatched nested radii; full-strength icon out-shouting its label; stacked redundant dividers; mathematically-centered chevron that looks off.
- [ ] Native `title=` / native date picker / `alert()` → R23 / R22 / R19.
- [ ] Generic `transition: all .2s`, bouncy easing, scattered micro-interactions, or the template hero / ornamental 01·02·03 markers.
- [ ] Ranch reading western-first; a treatment shipped in one theme only; a new rule with no `RULE_META` entry; missing `:focus-visible`; contrast under AA; meaning in color alone.

## Gates before push (push to `main` = live)

`node ci/smoke.mjs` · `node ci/logic-test.mjs` · `node ci/gen-rule-usage.mjs --check`
(regenerate without `--check` only when rule USAGE changed) · **zero R0 violations** ·
a self-critique screenshot pass. Deploy = feature branch → PR → squash-merge (main is
branch-protected). Never push a failing gate or a red lint; never put model ids /
secrets / passwords in the repo (it's public via Pages). Full pre-ship list:
[`references/checklists.md`](references/checklists.md).

---

# Folded sub-capabilities

Everything above is the **build language** — the dominant job. The four sections below
are the skills that merged in. Each is a different *mode* of design work; read the one
that matches the request, then come back to the rulebook when you touch real UI.

## ① Aesthetic direction (the taste layer)

Before you reach for a builder, frame the *direction*. The general method —
design-lead framing, the two-pass plan (token system → critique against the brief →
build), the writing-as-design-material rules, and the "remove one accessory"
self-critique — lives in [`references/frontend-design.md`](references/frontend-design.md).
For JacTec it's **not** a free hand: the yard data-plate language already IS the
direction. Use the method to make *intentional* choices within it (where the ONE bold
beat lands, how the copy reads, which AI-default to dodge), never to invent a parallel
look. Plan-tokens-first (Workflow step 0) is this layer in action.

## ② Mobile — reflow, viewport, touch

Making any screen work on a phone. **Mobile is a reflow of the data-plate language, not
a re-theme** — tokens, rules, and the signature stay intact. Full detail in
[`references/mobile.md`](references/mobile.md), which covers three domains:
- **Viewport & ratio** — `viewport-fit=cover`, never `100vh` (use `dvh`/`svh`),
  `env(safe-area-inset-*)` for the notch/home-bar, `aspect-ratio` to kill layout shift,
  the ≥44×44px touch-target floor, no horizontal overflow.
- **Navigation & reflow** — the 3-equal-column yard grid collapses to **one active
  column + a segmented switcher** (reuses `revealCol`); overlays/winpicker/chat-dock
  become bottom sheets; one predictable Esc/back chain; one primary scroll region.
- **Touch & haptics** — extend the existing `app.js` §15 pointer drag engine
  (tap = action, 400ms long-press/drag = grab); `touch-action` is load-bearing; no
  hover-only actions; optional swipe; a guarded `haptic()` helper (best-effort —
  **iOS Safari has no Vibration API**, never rely on it for meaning).
Verify with `webapp-testing` at a phone context (390×844 + 320px).

## ③ DESIGN.md — the portable token file

Scaffold or lint a `DESIGN.md` — the portable YAML-tokens + markdown-rationale file
(Google Labs alpha spec) that any agent reads to stay on-brand. Full procedure, the
rails, the CLI, and the offline spec/lint rules are in
[`references/designmd-guide.md`](references/designmd-guide.md) (with
[`references/designmd-spec.md`](references/designmd-spec.md),
[`references/designmd-lint.md`](references/designmd-lint.md), and the ready JacTec stub
[`references/jactec.design.md`](references/jactec.design.md)). **The load-bearing rail:**
scaffolding/linting is safe, but **the moment its tokens would fan out into real files,
STOP — surface the file, get Jac's OK first.** A DESIGN.md is a *projection* of our canon
(CLAUDE.md + this skill + the R-rulebook), never a competing rulebook; propagating it
back into UI is a full build job under the rules above, never a silent rewrite. Not a CI
gate (needs network) — dev-time only.

## ④ The /role audit — role-lens spec review

Audit a spec/design/screen against the real Jac Rentals org **before building**: 15 role
lenses (Dispatcher → Customer/Contractor) + a 12-step authority / data-sensitivity / gate
checklist. Catches the leaks a single-perspective spec misses. Load both
[`references/role-framework.md`](references/role-framework.md) (the hierarchy, the 9-tier
data-sensitivity matrix, the 12-step checklist) and
[`references/role-roles.md`](references/role-roles.md) (the 15 cards with each role's
`spec_audit_questions`) before auditing.

**When:** right after a SPEC is generated, before a new feature/screen, or after any
change to permissions, pricing visibility, customer-facing surfaces, or status/gate
logic. Anytime someone types `/role` (no spec named → audit the most recent spec or the
feature under discussion).

**Hard-fail gates (🔴 blockers, not suggestions):** data-sensitivity (step 3) and
customer isolation (step 4). **Margin floors are radioactive** — Bottom Dollar, True
Cost, ROI, part cost on any Sales-shared or customer-facing surface is an automatic 🔴.
Customer isolation and gates are **server-side** concerns — "the UI hides it" is never an
acceptable answer.

Output: lead with blockers, then gaps, then per-role pass/fail, then clears, then ordered
fixes. **Silence = pass** (don't pad). This audit produces findings — it does **not** write
code or change the spec; offer to apply fixes only after presenting them.

```
# /role audit — <spec name>
## Roles touched
<primary actor(s)> · <incidental readers> — one line each on their lens
## 🔴 Blockers (HARD-FAIL)
- <data-sensitivity / isolation / authority violation> — role, field, why, fix
## 🟡 Gaps
- <missing gate / audit trail / cascade / mobile / KPI issue> — role, why, fix
## Per-role audit questions
**<Role>** — ✅/❌/⚠️ per question, one line each
## ✅ Clears
- <what the spec already handles well>
## Recommended fixes (ordered)
1. <concrete change>
```
