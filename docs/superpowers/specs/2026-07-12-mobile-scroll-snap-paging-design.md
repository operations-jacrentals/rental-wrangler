# Mobile scroll-snap paging — design

**Date:** 2026-07-12
**Status:** Approved (Jac) — prototype build
**Area:** `area/mobile-remote` (task branch `mobile-remote/paging-feel`)
**Supersedes:** the custom `PAGE` ghost-paging engine + `§M6 reflowPhoneChrome` (archived session, currently on staging)

## Goal

Make phone column-switching feel like **the desktop app scrolled sideways, but it snaps
perfectly onto a card** (iPhone-home-screen feel). The custom JS paging engine
(ghost column + fixed-duration `translateX` glide + commit thresholds + angle cones)
re-implements OS scroll physics and never fully matches native. Replace it with **native
CSS scroll-snap** so the browser owns the scroll: true 1:1 tracking, native momentum,
clean snap onto the nearest card.

## Decisions (settled with Jac)

1. **Header chrome — each card owns its toolbar; revert §M6.** Multiple cards are on
   screen mid-scroll, so a single shared/lifted header can't belong to one card. Each
   column carries its own per-card search/sort + sub-card tab strip *inside* the track,
   scrolling with it — exactly like desktop. `reflowPhoneChrome` is removed.
2. **Snap stops = the 3 desktop columns** (Units · Rentals · Customers). Sub-cards
   (Categories, Calendar, Sales) are **tabs inside** their parent column, not separate
   snap panels — the desktop mental model. Three snap panels, each a full workstation.
3. **No global search on mobile.** The global search bar (the `.searchwrap` row) is
   dropped from the phone header. Per-card search stays inside each card's toolbar. The
   fixed phone top becomes **logo + KPI rings only**.
4. **Dock = a 3-way switcher + indicator.** With sub-cards now tabs, the footer dock
   collapses from 6 toggles to **3** (Units · Rentals · Customers). Tap → smooth
   scroll-snaps to that panel; scrolling highlights the snapped panel ("you are here").
5. **State sync.** `state.mobileCol` is updated *from* scroll position on `scrollend`
   (with an `IntersectionObserver` / scroll fallback for engines without `scrollend`), so
   everything keyed to `mobileCol` (KPI/role landing, cross-column link → `revealCol`)
   stays correct. A cross-column link calls `scrollIntoView`/sets `scrollLeft` to snap.
6. **Edges & motion — native.** Scroll stops at the ends (optional light overscroll); no
   custom rubber-band. `scroll-behavior: smooth` for tap-to-jump; `prefers-reduced-motion`
   → instant (`auto`). No JS animation timers.

## Architecture

- **`render()` phone branch:** instead of `shown = [COLUMNS[mobileCol]]` (one column),
  paint **all three** `COLUMNS` into the track (as desktop already does). The track is the
  existing `.grid` restyled for phone: `display:flex; overflow-x:auto; scroll-snap-type: x
  mandatory; scroll-behavior:smooth`. Each `.col` gets `min-width:100%; scroll-snap-align:
  start`. On first paint / after a `mobileCol`-changing action, set `scrollLeft` to the
  active column with no animation so it lands correctly without a visible glide.
- **Remove:** the `PAGE` state object + its pointerdown/move/up handlers, `pageCleanup`/
  `pageFinalize`/ghost, `EDGE_ZONE`, `is-paging`; `reflowPhoneChrome` and its call; the
  swipe-threshold / `MOBILE_SWIPE_ORDER` grid-swipe handler; the global search from the
  phone header; the paging-feel commits' now-obsolete tuning (threshold, glide, ghost-strip)
  and the `.paging-settle`/`.paging-ghost` CSS.
- **Dock:** `mobileDockEl` emits **one** bar of 3 main-column toggles. A `[data-gocard]`
  tap `scrollIntoView`s the target column. The snapped column's toggle gets `.on` from a
  scroll observer (not from `render()` alone).
- **Scroll → state:** a single `scrollend`/IntersectionObserver listener on the track maps
  the snapped column index → `state.mobileCol` and updates the dock `.on` state + anything
  else that must reflect the active column, WITHOUT a full `render()` on every scroll
  (cheap DOM class toggles only; a full render only when a real state change needs it).

## Non-goals

- No customer-portal / half-B work. No desktop change (desktop already pans). No haptics
  rework (keep the guarded `haptic()` if a snap-commit tick is wanted later — optional).

## Verification

Drive `webapp-testing` / Playwright at 390×844, `hasTouch`, and assert: three columns in
the track; the track is `scroll-snap-type: x mandatory`; setting `scrollLeft` to a column
snaps it; `scrollend` updates `state.mobileCol` and the dock `.on`; a cross-column link
scrolls to its column; no global search bar in the phone header; each card's toolbar rides
inside its column; reduced-motion resolves scroll-behavior to `auto`; no console errors.
Gates: smoke, logic, rule-usage, window-catalog, code-map all green.

## Rollback

The `PAGE` engine + §M6 remain in git history on staging; if the native model doesn't feel
right, revert this branch's commits and the prior engine is intact.
