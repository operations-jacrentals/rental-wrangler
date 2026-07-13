# Card-search global mode — design

**Date:** 2026-07-13
**Status:** Approved (Jac) — ready for implementation plan
**Feature branch:** `claude/card-search-global-mode-4q6plf` off `main`
**Supersedes:** the standalone `#globalsearch` header bar (desktop-only global search)

## Goal

Remove the giant, desktop-only global search bar from the header and fold its
capability **into the per-card search bars** as a **"global mode."** Each of the
5 grid cards gets a small **globe** at the right edge of its search bar. The globe
is a single shared toggle: flip it on from anywhere and all 5 bars become **one
search across the whole yard**; flip it off from anywhere and each bar snaps back
to searching just its own card.

Net effect: one fewer piece of header chrome, and — because the old bar was
desktop-only — **global search reaches phones for the first time**, with no extra
mobile UI.

## Decisions (settled with Jac)

1. **Sticky scope toggle, not a momentary action.** The globe is a reversible
   *mode*, not a one-shot "send" button. On = global; off = per-card. It reuses
   today's in-place card narrowing — there is **no** new results overlay / command
   palette.
2. **One shared toggle, surfaced in every bar (lockstep).** The globe is not
   per-bar state. There is a single global on/off flag mirrored into all 5 bars.
   Clicking *any* globe engages global for the whole grid and lights *every* globe;
   clicking *any* lit globe disengages everywhere. The user can round up **or** rein
   it back in from whichever card their cursor is on.
3. **All bars mirror one query.** While global is on, every bar displays the same
   shared query and typing in *any* bar edits that one query; the whole grid
   re-narrows live. (This is the model Jac picked over a single "source" bar with
   empty followers.)
4. **Non-destructive overlay.** Each card's own local search text is never
   overwritten — global is an overlay on top of it. Toggle off and every bar restores
   exactly the local text (and local pinned filter-pills) it had before. A per-card
   search survives a global excursion untouched.
5. **Engage seeds from the clicked bar.** Turning the globe on seeds the shared
   global query from the text currently in the bar you clicked. If that bar is empty,
   global engages with an empty query (shows everything) until you type.
6. **Scope = the 5 grid cards.** Globe appears on `units`, `categories`, `rentals`,
   `invoices`, `customers` (the cards that share the `listView` builder) — exactly
   what the old giant bar covered. **Calendar/Trips is left as-is:** its own local
   bar, no globe (a separate, card-stateless code path; the old giant bar never
   reached it either).
7. **Giant bar removed behind a flag.** The `#globalsearch` header block is removed,
   gated by a `FEATURES` flag in `config.js` so the swap is a runtime toggle, not
   code surgery.

## Architecture (rides existing machinery)

The elegance here is that almost everything already exists; global mode mostly
decides **which state a bar reads from** at render time.

- **Shared query = the existing `state.query`.** Engaging sets `state.searchMode`
  on (via the existing `recomputeSearchMode` / `setQueryValue` path, `app.js:2842`,
  `2853`) and seeds `state.query`. The existing **`renderResults()`**
  (`app.js:15721`) already narrows every grid card in place — no new render path,
  no overlay. Disengaging clears search mode via the existing `clearSearch`
  (`app.js:2854`).
- **Per-bar render branch.** In `listView` (`app.js:8881`, bar at `app.js:8897–8903`),
  the bar chooses its contents by the global flag:
  - **global ON →** show `state.query` + the shared global filter-pills + **lit** globe.
  - **global OFF →** show that card's own `cs.search` + its local per-card pills +
    **dim** globe (today's exact behavior).
  Because `cs.search` is a separate state slot that global mode never writes to,
  **restore-on-toggle-off is automatic** — no explicit stash/restore is needed.
- **Input routing.** The delegated `onInput` for `.mini-search` (`app.js:18809–18827`)
  branches on the global flag: global on → route keystrokes to `setQueryValue` +
  `renderResults` (the global path, `app.js:18781`); global off → today's per-card
  `cs.search` + `renderCardList` path. Enter-to-pin / Backspace-to-pop
  (`app.js:23435`) likewise route to the global vs per-card `addFilterTerm` scope.
- **New pieces (all additive):**
  1. A **globe span** rendered at the right edge of every `.mini-searchwrap` in
     `listView` (mirror of how the global bar renders its left `.s-icon`,
     `app.js:9358`).
  2. A **toggle click handler** (event-delegated, like the other `.mini-search`
     handlers) that flips the shared global flag, seeds/clears `state.query` from the
     clicked bar, and triggers `renderResults`. Because every bar re-renders from the
     one flag, all globes update in lockstep for free.
  3. The **render branch** above (global vs per-card contents per bar).
  4. **Flag-gated removal** of the `#globalsearch` block in the header builder
     (`app.js:9355–9363`).
- **State.** Reuse `state.searchMode` as the single source of truth for "global on"
  (it already means "a global query is active"). No new parallel boolean unless the
  distinction between "search mode via typing" and "explicitly toggled global" proves
  necessary during the plan — default is to reuse `searchMode`.

## Design language + guardrails (applied at build via `/jactec-ui`)

- **Globe glyph — sourced, never hand-drawn.** Add `globe: 'globe'` to the `LUCIDE.I`
  map in `tools/gen-icons.mjs` and regenerate `icons.js` (`node tools/gen-icons.mjs`).
  No hand-authored `<path>`.
- **Active state = safety-orange ignition accent** (`--accent #ff7a1a`); resting =
  dim steel. Visible focus ring on the globe (keyboard-operable button). Any transition
  respects `prefers-reduced-motion`.
- **R-rulebook.** The globe is net-new stamped UI → it gets a `data-r="Rxx"` rule
  entry and flows through `ci/gen-rule-usage.mjs` (regenerate, don't `--check`, when
  usage changes). No new popup window → `WINDOW_CATALOG` / `ci/check-window-catalog.mjs`
  untouched. Note: neither search bar is R-stamped today, so this introduces the first
  stamp on the search surface.
- **`FEATURES` flag** (`config.js`, `flagOn()` reader) gates the giant-bar removal so
  backing out is a toggle. The flag hides *execution*, not source, on public Pages —
  fine here (no secret/auth gated on it).
- **Copy (wrangler seasoning, light).** Globe tooltip suggestion: **"Round up the whole
  yard"** (on) / **"Search this card only"** (off). Final wording is Jac's call at build.
- **Cache-bust.** Bump the shared `?v=` token on `style.css` / `app.js` in `index.html`
  on deploy (per the deploy convention).

## Files touched

- `app.js:8881–8903` — `listView` bar: render the globe + the global-vs-per-card
  contents branch.
- `app.js:18781–18828`, `app.js:23429–23449` — input / keydown routing branch on the
  global flag; new globe-click toggle handler.
- `app.js:9355–9363` — flag-gated removal of the `#globalsearch` header block.
- `app.js:2842–2854` — reuse `setQueryValue` / `recomputeSearchMode` / `clearSearch`
  (likely no change; confirm during plan).
- `style.css:245–284` — new `.mini-searchwrap` globe styling (resting/lit), mirroring
  the `.s-icon` pattern (`style.css:254`); plus theme blocks (`style.css:4541–4555`,
  `4644–4645`).
- `icons.js:13` + `tools/gen-icons.mjs` — add the `globe` glyph (generated).
- `config.js` — the `FEATURES` flag; `GRID_CARDS` (`config.js:361–367`) already
  enumerates the 5 cards that get the globe.
- `index.html` — shared `?v=` cache-bust bump on deploy.

## Edge cases & defaults

- **Empty-query global.** Toggling global on an empty bar = global on with empty
  query = shows everything; narrows as you type. No error, no-op filter.
- **Local text preserved.** Editing the query while global does **not** rewrite any
  card's `cs.search`; toggle off restores each bar's own local text and local pills.
- **Pinned filter-pills.** While global, the shared global filter-pills render in
  every bar (consistent with the mirror). Local per-card pills are hidden under the
  overlay and return on toggle-off.
- **Exit paths.** Clicking any lit globe disengages. Existing global exits still work:
  clearing the query / the click-off-grid auto-clear (`app.js:17828`).
- **Focus preservation.** `renderResults` deliberately does not rebuild the header, so
  the focused input stays mounted across re-narrows; the per-bar globe re-render must
  likewise not steal focus from the active input.
- **Mobile.** The globe rides each card's existing per-card bar, so it appears on
  phones automatically — the first time phones get global search. No separate mobile
  layout work beyond confirming the globe fits the phone bar (a `/jactec-ui` mobile
  check at build).

## Out of scope (YAGNI — parked as possible follow-ups)

- A desktop keyboard hotkey to toggle global (the old bar had none).
- A Cmd-K-style categorized results overlay (today's cards-narrow-in-place model stays).
- Folding Calendar/Trips into global mode.
- Substring match-highlighting (`<mark>`) — none exists today; matches are shown by
  narrowing + `.search-glow`, and that stays.

## Rollout

1. Build on `claude/card-search-global-mode-4q6plf`, gated behind the `FEATURES` flag.
2. Run local gates (`smoke`, `logic-test`, `gen-rule-usage --check`,
   `check-window-catalog`, `gen-code-map --check`).
3. `node tools/deploy-staging.mjs` → review the running app at the staging URL:
   verify the globe toggles global from multiple cards, all bars mirror, disengage
   works from any card, local searches restore, and the giant bar is gone. Confirm
   on a phone viewport.
4. **"Merge it"** → PR to `main` → `smoke` CI → squash-merge (integrated, not live).
5. Wait. **"Promote it"** (`tools/promote.mjs`) is Jac's explicit call.
