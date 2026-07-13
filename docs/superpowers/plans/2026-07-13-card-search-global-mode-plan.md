# Implementation Plan — Card-search global mode

Spec: `docs/superpowers/specs/2026-07-13-card-search-global-mode-design.md`
Branch: `claude/card-search-global-mode-4q6plf` off `main`

Gates after every code phase (port 8000 reserved → swap to 9147, then restore):
```
sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs
node ci/smoke.mjs && node ci/logic-test.mjs && node ci/gen-rule-usage.mjs --check \
  && node ci/check-window-catalog.mjs && node tools/gen-code-map.mjs --check
git checkout -- ci/
```
Every UI phase runs through `jactec-ui` (screenshot + self-critique before Jac sees it).

## The model in one paragraph

Global mode is a single runtime flag, **`state.globalMode`**, surfaced as a globe in
every grid-card search bar. It is independent of `state.searchMode` (which stays "a
query is actively narrowing" — false when the query is empty). When `globalMode` is on,
each bar reads/writes the shared `state.query` instead of its own `cs.search`; the
existing `listFor` global path (`app.js:8379`) narrows every card by `state.query`; and
the per-card filter in `cardListEl` (`app.js:8950`) is **guarded off** so no card
double-filters and every card's own `cs.search` is preserved-but-dormant (→ free restore
on disengage). The whole feature is gated behind `FEATURES.cardGlobalSearch`; flag off =
today's giant `#globalsearch` bar, untouched.

---

## Phase 0 — Feature flag + globe glyph (no behavior change yet)

- **`config.js:617`** — add the key: `cardGlobalSearch: false` to `FEATURES`.
  All new paths below check `flagOn('cardGlobalSearch')` (reader already at `app.js:37`).
- **`tools/gen-icons.mjs`** — add `globe: 'globe'` to the `LUCIDE.I` map, then
  `node tools/gen-icons.mjs` (needs network; dev-time only) to regenerate `icons.js` so
  `I.globe` exists. Confirm with `node tools/gen-icons.mjs --check`. Never hand-edit
  `icons.js`. (If this environment has no network, generate the glyph in a follow-up on a
  machine that does — the whole feature stays behind the flag until then.)
- **Verify:** app boots unchanged (flag off). Gates green.
- **Commit:** "Global mode phase 0: FEATURES.cardGlobalSearch flag + globe glyph".

## Phase 1 — State + the filter guard (the load-bearing logic)

- **`app.js:2277`** (state object, beside `searchMode: false`) — add `globalMode: false`.
- **Reset `globalMode` everywhere `searchMode` resets** so a clear / tab-switch drops it:
  `clearSearch` (`app.js:2854`) and the session/tab resets at `app.js:2425, 2447, 2453,
  2467`. Add `state.globalMode = false;` at each.
- **`app.js:8950`** (`cardListEl`, the per-card filter) — guard it off in global mode:
  ```js
  const glob = flagOn('cardGlobalSearch') && state.globalMode;
  if (!glob && (cs.search.trim() || (cs.filterTerms || []).length)) {
    rows = rows.filter((rec) => rowMatches(card, rec, cs.search, cs.filterTerms));
  }
  ```
  In global mode the ONLY filter is `listFor`'s global one (`app.js:8379`, unchanged);
  each card's `cs.search` is left intact but unapplied.
- **`app.js:8972–8979`** (per-card empty states — "No customer matches…", the
  New-Customer-from-search and units/categories availability empties) — these read
  `cs.search`. In global mode branch them onto `state.query` for the "no match" text and
  **suppress the per-card quick-add-from-search** affordance (it's a per-card convenience,
  not a global action). Keep them exactly as-is when `!glob`.
- **Verify (flag on, toggled by hand in console):** with `state.globalMode=true` and a
  `state.query`, every card narrows uniformly; a card that had leftover `cs.search` does
  NOT narrow further than its siblings. Gates green.
- **Commit:** "Global mode phase 1: state.globalMode + per-card filter guard".

## Phase 2 — Bar render: the globe + the mirrored display (`listView`)

- **`app.js:8900–8902`** — compute the display source once:
  `const glob = flagOn('cardGlobalSearch') && state.globalMode;`
  - input `value` = `glob ? esc(state.query) : esc(cs.search)`
  - pills = `glob ? state.filterTerms.map((ft,i)=>filterTermPill(ft,i,'global')) :
    cterms.map((ft,i)=>filterTermPill(ft,i,card))`
  - `.has-terms` / `.has-query` classes computed from the active source
    (`glob ? (state.query.trim()||state.filterTerms.length) : (cs.search.trim()||cterms.length)`)
  - placeholder = `glob ? (state.filterTerms.length ? 'Add filter — Enter to pin…' :
    'Search everything…') : <today's per-card placeholder>`
- **Add the globe button** at the right edge of `.mini-searchwrap`, only when the flag is
  on (last child, pinned right):
  ```js
  ${flagOn('cardGlobalSearch') ? `<button class="mini-globe js-cardglobe${glob ? ' on' : ''}"
    data-card="${card}" data-r="R30" aria-pressed="${glob}"
    data-tip="${glob ? 'Search this card only' : 'Round up the whole yard'}">${I.globe}</button>` : ''}
  ```
  (Rule number `R30` is illustrative — use the next free R in Phase 6.)
- Because every bar reads the one `state.globalMode`, a render lights/dims **all** globes
  in lockstep for free.
- **Note scope:** `listView` serves only the 5 `GRID_CARDS`; the Calendar/Trips bar
  (`app.js:8799`) is a different builder and gets **no** globe — leave it untouched.
- **Verify:** flag on, globe renders right-aligned in all 5 bars, dim at rest. Gates green.
- **Commit:** "Global mode phase 2: globe button + mirrored bar display".

## Phase 3 — The toggle handler (engage / disengage, lockstep)

- **Add a delegated click handler for `.js-cardglobe`** (beside the other listbar button
  handlers — `js-sortmenu` / `js-cardgraph` region). Full `render()` is correct here (a
  discrete action, not a hot keystroke path):
  ```js
  const card = btn.dataset.card, cs = activeSession().cards[card];
  if (!state.globalMode) {                     // ENGAGE
    state.globalMode = true;
    setQueryValue(cs.search || '');            // seed shared query from THIS bar; recomputes searchMode
    render();
  } else {                                     // DISENGAGE (from any card)
    state.globalMode = false;
    state.query = ''; state.filterTerms = []; state.searchMode = false; resetListLimits();
    render();
  }
  // focus the clicked card's input, caret at end
  const inp = document.querySelector(`.mini-search[data-card="${card}"]`);
  if (inp) { inp.focus(); const n = inp.value.length; try { inp.setSelectionRange(n, n); } catch {} }
  ```
- Engage with an empty bar → `searchMode` stays false (nothing narrows) but `globalMode`
  is true, so all globes light and every bar shows the empty shared query until you type
  (spec decision 5). Disengage clears the shared query/terms; each card's `cardListEl`
  re-applies its own `cs.search` (guard now off) → local searches restored (spec dec. 4).
- **Verify:** click a globe in Units with "cat 320" typed → all globes light, all bars
  show "cat 320", whole grid narrows; click any globe → all dim, each bar back to its own
  text. Gates green.
- **Commit:** "Global mode phase 3: globe toggle (engage/disengage in lockstep)".

## Phase 4 — Typing + Enter routing in global mode

- **`onInput`, `app.js:8809` (`.mini-search` branch)** — before the calendar check, add
  the global route (calendar can never be global):
  ```js
  const glob = flagOn('cardGlobalSearch') && state.globalMode && card !== 'calendar';
  if (glob) {
    const sel = e.target.selectionStart;
    setQueryValue(e.target.value);
    scheduleGlobalSearchRender(() => {
      GRID_CARDS.forEach((c) => renderCardList(c.id));   // re-narrow every card, inputs stay mounted
      mirrorGlobeBars(card);                              // sync the OTHER bars' value + has-query to state.query
      const inp = document.querySelector(`.mini-search[data-card="${card}"]`);
      if (inp && document.activeElement !== inp) { inp.focus(); try { inp.setSelectionRange(sel, sel); } catch {} }
    });
    return;
  }
  ```
  - **`mirrorGlobeBars(exceptCard)`** (new small helper): for each `GRID_CARDS` id except
    `exceptCard`, set its `.mini-search` `.value = state.query` and toggle its
    `.mini-searchwrap.has-query`. Keeps every bar mirrored live without a header/grid
    rebuild. (If any `renderCardList` falls back to a full `render()` — card in graph/
    standard mode — the whole grid, bars included, rebuilds already-mirrored from
    `state.query`+`globalMode`, and the refocus line restores the caret.)
  - Else (flag off / not global): today's per-card path (`mcs.search = value;
    scheduleCardListRender`), unchanged.
- **`keydown`, `app.js:23435` (`.mini-search` branch)** — in global mode route pins to the
  global scope:
  ```js
  if (flagOn('cardGlobalSearch') && state.globalMode && card !== 'calendar') {
    if (e.key === 'Enter') { e.preventDefault(); addFilterTerm('global', e.target.value); return; }
    if (e.key === 'Backspace' && !e.target.value && state.filterTerms.length) {
      e.preventDefault(); removeFilterTerm('global', state.filterTerms.length - 1); return; }
    return;   // skip the customers two-Enter quick-add while global
  }
  ```
  Else: today's per-card Enter-to-pin / Backspace-to-pop (incl. the customers quick-add).
- **Verify:** in global mode, typing in ANY bar re-narrows the whole grid and mirrors into
  the other bars; the active caret never jumps; Enter pins a shared global pill that shows
  in every bar; Backspace-on-empty pops it. Gates green.
- **Commit:** "Global mode phase 4: global typing + Enter/Backspace routing".

## Phase 5 — Remove the giant bar (flag-gated) + CSS

- **`app.js:9355–9363`** — gate the header `.toolbar`/`.searchwrap` block off when the
  flag is on: `${isPhone || flagOn('cardGlobalSearch') ? '' : `<div class="toolbar">…`}`.
  Flag off → today's desktop giant bar. Flag on → gone on every viewport; the globes carry
  global search (and phones get it for the first time).
- **`style.css` (~after `:284`)** — add `.mini-globe`:
  - pin right: `margin-left:auto; flex:0 0 auto;` inside the flex-wrap `.mini-searchwrap`
    (stays on the input's row, after any pills/input).
  - button: ~24×24, `border-radius:8px`, `display:inline-flex; align-items:center;
    justify-content:center`; `svg{width:15px;height:15px}`.
  - resting = `color:var(--txt-3)` (dim steel); hover = `color:var(--txt);
    background:var(--panel-2)`.
  - engaged `.mini-globe.on` = `color:var(--accent)` (safety-orange) + a soft ring/tint
    (e.g. `background:var(--accent-soft)`), echoing the ignition-accent language.
  - `:focus-visible` ring (keyboard-operable); wrap any color transition in
    `@media (prefers-reduced-motion: no-preference)`.
  - theme parity: check the dark/blued-steel blocks (`style.css:4541–4555, 4644–4645`)
    for any `.s-icon`/search token the globe should match.
- **Verify (`jactec-ui`):** globe reads as ours (dim steel → safety-orange on), right-
  aligned, focus ring visible, reduced-motion respected; giant bar gone with flag on;
  desktop + phone screenshots. Gates green.
- **Commit:** "Global mode phase 5: remove giant #globalsearch (flag-gated) + globe CSS".

## Phase 6 — R-rulebook + flip the flag on

- **R-rulebook:** assign the next free R-number (verify against the R0–R29 block
  ~`app.js:5804–5834`), add a one-line rule ("Card search global-mode toggle"), stamp the
  globe `data-r="Rxx"`. Regenerate: `node ci/gen-rule-usage.mjs` (no `--check`), then
  `--check` to confirm no drift/dupes. No new popup → `WINDOW_CATALOG` /
  `check-window-catalog.mjs` untouched.
- **Flip the flag on for shipping:** set `FEATURES.cardGlobalSearch: true` on this branch
  (the flag's default-false is the rollback lever; this feature *is* the intended
  replacement, so we ship it on and keep the old giant-bar path behind the false branch as
  the one-release rollback, removed in a later cleanup once proven).
- **Cache-bust:** bump the shared `?v=` token on `style.css` / `app.js` in `index.html`
  (`deploy-staging.mjs` does this for a staging deploy).
- **Verify:** full gate set green with the flag on.
- **Commit:** "Global mode phase 6: R-stamp + enable FEATURES.cardGlobalSearch".

## Phase 7 — Staging review + gates

- `node tools/deploy-staging.mjs`; confirm the new bytes:
  `curl -s https://operations-jacrentals.github.io/rental-wrangler-staging/index.html | grep <new ?v=>`.
- Drive it (Claude-in-Chrome, login pw from `$RW_PW` — never echo it):
  1. Type in the Units bar, click its globe → all globes light, all bars show the query,
     the whole grid narrows.
  2. Edit the query from a *different* card's bar → the whole grid re-narrows, all bars
     mirror, caret stays put.
  3. Click any lit globe → global disengages everywhere; each bar restores its own local
     search (pre-seed a couple of different per-card searches to prove restore).
  4. Enter pins a shared global pill visible in every bar; Backspace pops it.
  5. The giant header bar is gone; no console errors on boot.
  6. Phone viewport: the globe appears in each card bar and global search works (new).
  - Save screenshots for the handoff. A red review STOPs the merge — fix on the branch,
    redeploy, re-check.
- **Gate 1 "merge it":** local gates → PR to `main` → `smoke` CI → squash-merge (integrated,
  not live). **Wait.** **Gate 2 "promote it":** `tools/promote.mjs` — Jac's explicit call.

## Risks / watch-items

- **Focus during global typing:** the `renderCardList`-loop keeps every input mounted; the
  refocus line only fires on the full-render fallback. If a caret jump ever shows on the
  fallback path, the simpler alternative is `renderResults()` + caret-restore (it rebuilds
  the grid and mirrors all bars in one pass, at the cost of a refocus every tick).
- **`cardListEl` guard is load-bearing:** miss it and the engaged card double-filters. It's
  the one edit that must land with Phase 1.
- **Calendar stays out:** confirm no `.js-cardglobe` renders in the Trips bar and its
  onInput/keydown branches are untouched.
- **Other `cs.search` readers** (`availSearchActive` `app.js:2872`, `app.js:6041`,
  `openInTab` `app.js:2730`) already also honor `state.query`/`searchMode`, so global mode
  doesn't regress them — spot-check during Phase 4.
