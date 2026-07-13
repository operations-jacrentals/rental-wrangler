# Mobile Back/Forward jog pill — design

**Date:** 2026-07-13
**Status:** Approved design (pre-implementation)
**Topic:** Make each grid card's Back/Forward navigation visible and thumb-reachable on phone.

## Problem

On phone, the per-card Back/Forward control is effectively missing. The app already
has per-card view history — each of the 5 grid cards walks its **own** sequence of views
(`cs.backStack` / `cs.fwdStack`, capped at `HIST_CAP = 50`) via `cardBack(card)` /
`cardFwd(card)` (`app.js:2677`), rendered as a two-chevron "jog" by `cardJog(card, cs)`
(`app.js:2712`). On **desktop** the jog sits in the card header (`app.js:8861`) and again
in list view (`app.js:8898`).

### Proven root cause (wrangler-fix, 2026-07-13)

The report is **correct**, and the phone behavior splits by view:

- **List view still works** — `render()` → `columnEl()` lifts the card's `.listbar` (jog is
  its first child, `app.js:8898`) into `.col > .mdock-searchslot` above the card
  (`app.js:8705-8706`); no CSS hides it. But `cardJog` returns empty until that card has
  history (`app.js:2714`), so a fresh list shows nothing.
- **Record/detail view has no Back at all** — the card header suppresses the jog on phone
  (`app.js:8861`) with a now-stale comment (*"on phones the jog rides the bottom dock"*).
  The **§M7 scroll-snap refactor (2026-07-12)** deleted that bottom dock. The only code that
  rebuilt a standalone record-view jog (`app.js:15752-15754`) is now **dead** — it lives in
  `renderResults()`'s phone branch, which returns early on phone (`app.js:15725`) and calls a
  `mobileDockEl()` that no longer exists. In record mode `cardEl` never builds a `.listbar`
  (`app.js:8872`), so nothing carries the jog. **Net: drilling into a record on phone leaves
  no visible way back.**

**Origin:** §M7 removed the mobile bottom-dock the record-view jog depended on, but left the
header suppression (`app.js:8861`) and the rebuild code (`app.js:15752`) behind as fossils.
The floating pill is the correct root-cause fix: one mount that serves both views,
independent of the deleted dock.

Two facts about today's mobile shape frame the fix:

- **One card at a time.** The 3-column grid becomes a native horizontal scroll-snap track
  on phone (`style.css:438`, `§M7`), one column at 100% width. `state.mobileCol` tracks the
  snapped column, kept in sync by `syncMobileColFromScroll()` (`app.js:23213`).
- **Horizontal swipe is already taken.** Left/right swipe pages between columns via
  scroll-snap, so Back/Forward cannot be a swipe gesture — it must be a tappable control.

## Decisions (settled during brainstorming)

1. **Model — unchanged, per-card.** Keep the existing per-card history exactly as desktop
   uses it. We are not introducing a global/browser-style history or an undo-only model.
   The pill reuses `cardBack` / `cardFwd` and the `cs.backStack` / `cs.fwdStack` arrays
   verbatim.
2. **Placement — a floating pill, bottom-right.** A small floating Back/Forward pill over
   the card content, thumb-reachable, rather than on the top toggle row or in the bottom
   tool bar.
3. **Scope — the pill only.** Do **not** wire the phone's hardware/gesture Back into the
   card history in this change. Hardware Back keeps today's behavior (closes an open sheet
   via the `dismissTopSheet` chain at `app.js:11993`; otherwise falls through to browser
   history). Integrating the hardware gesture is deferred to its own deliberate change
   because it touches the balanced `backGuard` / `popstate` machinery (`app.js:11990`,
   `app.js:23201`).

## Design

### A. The control

A single **floating jog pill**, fixed to the bottom-right of the phone viewport, shown only
under the `is-phone` body class. It contains the two existing chevron glyphs (`I.chevL` /
`I.chevR` from `icons.js:58-59` — library glyphs, never hand-drawn) and nothing else.

- **One pill, not three.** All three columns are present in the DOM (the scroll-snap track),
  so a per-column jog would render three overlapping `position:fixed` pills. Instead there is
  **one** fixed pill that reflects the **currently snapped** card (`state.mobileCol`). It is
  re-targeted whenever the active column changes, hooking the existing scroll-sync
  (`syncMobileColFromScroll`, `app.js:23213`) — no new scroll listener.
- **Reuses the existing handlers.** The pill's two buttons carry the active card's id plus
  the existing `js-cardback` / `js-cardfwd` classes so the current click handlers
  (`app.js:17523`) fire unchanged; `cardBack` / `cardFwd` resolve the card from that id.

### B. When it shows

- **Appears only when the visible card has history** — render when
  `backStack.length || fwdStack.length`. A fresh card (never navigated) shows no pill, so it
  never floats over content when it would do nothing.
- **Each chevron greys independently.** Back is disabled when `backStack` is empty; Forward
  is disabled when `fwdStack` is empty (reduced opacity + `aria-disabled="true"`,
  non-interactive). This mirrors desktop jog behavior.
- **Hidden while a sheet/overlay is open.** When `state.overlay` (or any dismissable surface
  in `anyDismissable()`, `app.js:11992`) is open on phone, the pill is hidden — it belongs
  to the card underneath, and the sheet carries its own ✕ / back affordance.

### C. Not occluding content

- **Bottom scroll-padding** is added to the phone card list equal to the pill height + gap,
  so the last row always scrolls clear of the pill.
- The pill sits **above the bottom tool bar** (`.mobile-toolbar`, `style.css:464`), offset by
  the safe-area inset (`env(safe-area-inset-bottom)`) so it clears the home indicator.

### D. Look & feel (yard data-plate design language)

Run at build time through `/jactec-ui`.

- Dark steel pill (`linear-gradient(180deg,#1b2129,#0c0e11)`), thin hairline border, and a
  soft drop shadow to lift it off the list beneath. Two chevron buttons split by a hairline
  divider — optionally a **saddle-stitch tan** dashed divider as a light ranch touch.
- **Neutral, not orange.** Safety-orange (`--accent`) stays reserved for primary/ignition
  actions; Back/Forward is a quiet secondary control, so the chevrons are neutral steel/light
  ink, with orange appearing only as the pressed/tap-feedback state ("spend boldness in ONE
  place").
- **Quality floor:** ≥44px touch targets, visible focus ring, and reduced-motion respected
  (no slide/scale-in animation under `prefers-reduced-motion`).

### E. Rulebook + code touch points

- **R-Rulebook.** The jog currently carries **no `data-r` stamp**. This is new/reshaped UI,
  so a **new rule** is assigned (the next free number in `RULE_META` — read at build; likely
  R30), named for the nav jog / Back-Forward control. Both the desktop jog and the new mobile
  pill are stamped with it. Then regenerate `rule-usage.js` (`node ci/gen-rule-usage.mjs`, no
  `--check`) and pass the drift gate (`node ci/gen-rule-usage.mjs --check`). No
  `WINDOW_CATALOG` entry is needed — the pill is not a popup window.
- **Code touch points.**
  - `cardJog(card, cs)` (`app.js:2712`) gains a floating-pill variant (or a sibling builder
    that renders the fixed pill for the active mobile column, keyed to `state.mobileCol`).
  - **List view:** on phone, suppress the inline `.listbar` jog (`app.js:8898`, which
    `columnEl` lifts into `.mdock-searchslot` at `app.js:8705-8706`) so the pill is the
    single control — not a duplicate.
  - **Record view:** the pill is the *only* jog mount (today there is none — the deleted-dock
    fossil). Update the stale suppression + comment at `app.js:8861`.
  - Desktop jog placements (`app.js:8861` header, `app.js:8898` list-bar) are **untouched**.
  - The orphaned rebuild block (`app.js:15740-15756`, incl. the undefined `mobileDockEl()`
    call) is provably dead on the live path — flag for cleanup, but the core fix does not
    depend on it; keep the fix minimal.
  - New `.mjog` CSS block in the `§M` mobile section of `style.css`; bottom scroll-padding on
    the phone card list; safe-area inset; focus ring; reduced-motion guard.
- **Root-cause check first.** Because this was reported as *missing*, the build runs through
  `wrangler-fix`: confirm and cite *why* the phone jog at `app.js:15753` is not visible today,
  then fix the real gap rather than layering a new pill over a broken mount.

### F. Verification

- **Local gates:** `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
  `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`,
  `node tools/gen-code-map.mjs --check` (swap port 8000 → 9147 for the Playwright gates per
  CLAUDE.md, then restore `ci/`).
- **Staging review:** deploy via `node tools/deploy-staging.mjs`, confirm the new `?v=` token
  is served, then drive a phone viewport with Claude-in-Chrome — verify the pill appears after
  navigating, both chevrons step correctly, each greys when its stack is empty, the last row
  is not occluded, the pill hides when a sheet is open, and safe-area spacing is correct.
- **⚠️ Login caveat:** `RW_PW` is not set this session, so the logged-in staging app cannot be
  driven from here (only the pre-login surface is reachable). Either set `RW_PW`, or Jac
  eyeballs the pill on staging.

## Out of scope

- Hardware/gesture Back integration with card history (deferred — see Decision 3).
- Any change to the per-card history model, the desktop jog, breadcrumbs, or a global
  navigation history.
- Popup/overlay back affordances (board-popup back pill, ✕, Escape) — unchanged.

## Acceptance criteria

1. On phone, after navigating within a card, a floating Back/Forward pill is visible
   bottom-right and steps that card's history via the existing `cardBack` / `cardFwd`.
2. The pill reflects the currently snapped column and re-targets on column change.
3. Back/Forward each grey out (disabled) when their stack is empty; the pill is absent when
   both are empty.
4. The pill hides while a sheet/overlay is open and never permanently occludes the last list
   row.
5. The control is stamped with its new `data-r` rule, `rule-usage.js` is regenerated, and all
   local gates pass.
6. Desktop navigation is unchanged.
