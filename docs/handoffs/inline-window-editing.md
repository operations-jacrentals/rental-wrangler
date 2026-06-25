# Handoff — retire the rental-window popup → inline editing in the standard calendar

**Branch:** `rentals-dispatch/inline-window-editing` (off `origin/main`)
**Author of this note:** prior session (2026-06-25), investigating Jac's report that
"the rental window picker was retired when we switched to the calendar standard view."
**Status:** investigation complete + plan written. **No code written yet** — pick up here.

---

## TL;DR

Jac believes the floating **rental-window picker popup** was retired in favor of editing
dates **inline** in the rental standard-mode calendar, with live date changes driving the
**availability lens** on the Categories/Units card to the left. **It was half-built:**

- ✅ **The availability lens is LIVE** (category mini-cards + units reflect availability for
  a window).
- ❌ **The popup was NEVER retired** — it's still the only working date editor.
- ❌ **Inline date editing is a DEAD SCAFFOLD** — the setter + handler exist but nothing on
  screen triggers them.

**The job:** finish the migration — inline tap-to-edit dates in the standard calendar,
drive the availability lens from the open rental's window (not just while the popup is
open), retire the popup, and **re-home the extension preview/billing** (see §Coupling) onto
the inline surface.

---

## Proven current state (citations, not memory)

All line numbers are `app.js` on `origin/main` at the time of writing (re-grep — they
drift). Verified identical on `main`, `staging`, and the extension branch.

### What's LIVE — the availability lens
- `availWin` (module global, set each render) drives availability UI.
  `availWin = activeDraftWindow()` every render — **`app.js:10449`**.
- `activeDraftWindow()` (**~`app.js:1601`**) returns a window ONLY when:
  1. `state.winpicker` is open → the rental being picked (**`app.js:1604`**) — *popup-gated*, OR
  2. `availSearchActive()` (a pinned "available" search) → `state.availWin` or a default (**`app.js:1607`**).
- Category mini-card available count: `categoryAvailableCount(catId, start, end, selfId)`
  (**~`app.js:1597`**), surfaced on the card at **~`app.js:4287`** (`availN` + tip "X available
  for the selected rental window").
- Units show **Available / Booked / Unavailable** at **~`app.js:4060-4064`**; unavailable rows
  get a red `row-viz` tint (**~`app.js:4012`**, `availUnavailable()` at **~`app.js:1611`**).
- The lens persists after the popup closes via `enterAvailabilitySearch(r)` (**~`app.js:13786`**),
  which pins an "available" search onto Units + Categories and sets `state.availWin`
  (**`app.js:13788`**); `exitAvailabilitySearch` clears it (**`app.js:13801`**).

### What's NOT done — the popup is still the editor
- The standard-mode calendar **opens the popup**: `<div class="rdcal js-open-winpicker" …>`
  — **`app.js:5204`** (this branch) / **`origin/main:~5015`**. The click handler:
  **`app.js:~11628`** (`closest('.js-open-winpicker')` → `openWinPicker(rec)`).
- The popup itself: `openWinPicker` (**~`app.js:13738`**), `winPickerEl` rendered into
  `.winpicker-float` (**~`app.js:10498`**), `winPickSave` (**~`app.js:13757`**), `closeWinPicker`
  (**~`app.js:13776`**). ~35 references to `winPickerEl`/`state.winpicker`/`js-open-winpicker`.
- It's still a catalogued rulebook element: **R16 "Day timeline"** in `RULE_META`
  (**~`app.js:3805`**), and the comment at **~`app.js:3604`** says outright *"The rental WINDOW
  uses the timeline winpicker."*

### What's a DEAD SCAFFOLD — inline editing
- `setDraftDate(rentalId, which, val)` exists (**~`app.js:13649`**) and a change-handler
  `js-draftdate` → `setDraftDate` exists (**~`app.js:12634`**) — **but `grep -c 'js-draftdate'`
  on any rendered element = 0.** Nothing emits it. The inline editor was scaffolded
  (setter + handler) and never wired to UI.
- PR **#331** ("standard calendar month-1st label") — the "calendar standard view" change
  Jac remembers — only relabeled the calendar's day cells (`rdcal-n.mon1st`) + a CSS rule.
  **It did not touch the picker.** (`git show e3dc6a6`.)

**Conclusion:** "what we made live" = the availability lens. The popup-retirement + inline
editing = started, never shipped.

---

## The goal (Jac, 2026-06-25, verbatim intent)

> "It should've been retired. The categories card mini-cards should show available
> according to the rental window in the rental standard mode. That's why we retired the
> rental window picker pop-up — [editing] should be editable inline without any pop-up.
> Changing the dates live will also change the availability of the category card to the
> left, or the units card on the left."

So: **edit start/end dates inline in the rental standard-mode calendar (no popup); the
left column (Categories or Units) reflects availability for that window live as you edit.**

---

## Design forks to resolve (do this first — ideally via `/brainstorming`)

1. **Inline edit interaction.** How does one set the window in the `rdcal` calendar without
   a popup? Options: (a) tap a start cell then an end cell directly in `rdcal` (make cells
   `data-iso` date-setters calling `setDraftDate`); (b) two inline `dateField` (R22) chips
   for start/end above the calendar; (c) hybrid — chips that also highlight on the calendar.
   Recommendation: **(a) direct cell tap** — it reuses the calendar already on screen and
   matches the popup's two-click start→end model, minus the float.
2. **When does the availability lens fire in standard mode?** Today it only fires while the
   popup is open. Jac wants it live in standard mode. Decide: fire whenever a rental **with
   a window** is open in standard mode (auto), or only after the user **focuses/begins
   editing** the window (less noisy). Recommendation: fire on **edit focus** (entering the
   inline editor), persist via the existing `enterAvailabilitySearch` pin, so merely opening
   a rental doesn't hijack the left column. This needs a new trigger feeding
   `activeDraftWindow()` (a `state.editingWindow = rentalId` flag parallel to
   `state.winpicker`).
3. **Fragile-rental Save staging.** `rentalFragile(r)` (**~`app.js:13740`**: invoiced OR
   On/End/Off/Returned) currently makes the popup **stage** edits behind an explicit Save
   (money/dispatch consequences). Inline editing must preserve this: a fragile rental's
   inline edits **stage + require a Save affordance**; a non-fragile rental commits live.
   Decide where the inline Save lives (a small Save chip by the calendar when staged).
4. **The popup's other duties.** The popup also handles **start TIME** (`wp-time` input) and
   **month navigation** (prev/next) and **overbooking** warnings. Inline editing needs an
   equivalent for time (an inline time chip) and month paging (the `rdcal` is single-month
   today — may need prev/next, or span the window's months).
5. **Retiring the popup cleanly.** Remove `winPickerEl`/`openWinPicker`/`winPickSave`/
   `closeWinPicker`/`state.winpicker`/`positionWinPicker`/`.winpicker-float` and the
   `js-open-winpicker` triggers. **Update `RULE_META` R16** + `RB_FOUNDATION`/`RB_TABS` in
   the same edit (rulebook truthfulness). If the popup is in `WINDOW_CATALOG`, remove it and
   re-run `ci/check-window-catalog.mjs`. Decide whether to keep R16 (re-point it at the
   inline calendar editor) or retire it.

---

## ⚠️ Coupling with the Extensions + Invoicing feature (PR #340)

**This is the important one.** PR #340 (`claude/rental-extensions-invoicing-kvxso4`,
branch off the same `main`) builds the **rental-extension billing UI INSIDE the popup**:
- `winPickerEl` renders the **extension-preview banner** (`.wp-ext` — added charge / credit,
  tax, new balance, basis note) when a fragile invoiced rental's window changes.
- `winPickSave` calls **`billExtension(r, prevEnd)`** to bill the lengthened window across
  the ≤28-day invoice series (retroactive re-blend up/down, spill to continuation invoices).
- A **`+Extend`** affordance opens the popup via `js-open-winpicker`.

If the popup is retired, **all three must re-home onto the inline editor:**
- The preview banner → an inline panel near the `rdcal` calendar (same `.wp-ext` markup/CSS
  can be reused; it's not popup-specific).
- The billing call → wherever inline date-commit/Save happens (the fragile-rental Save path).
- `+Extend` → focus/scroll the inline window editor instead of opening a float.

The **money logic is fully decoupled and reusable** — `billExtension` / `extensionPreview` /
`reconcileChunkRetro` / the multi-invoice series / `retroPricingOn` are pure model functions
that don't care about the popup. Only the **UI wiring** (banner location, Save trigger)
moves. See PR #340's spec: `docs/superpowers/specs/2026-06-25-rental-extensions-invoicing-design.md`.

**Sequencing recommendation:** land #340 first (it's done, tested 214/214, on the popup),
**then** rebase this branch onto the merged result so the extension code is present to
re-home. Doing the inline migration before #340 merges means re-homing code that isn't on
this base yet. (Alternatively, base this branch on #340's branch instead of `main` — but
then this can't merge until #340 does.)

---

## Suggested implementation order (once the forks are settled)

1. **Inline editor in `rdcal`** — make calendar cells tappable date-setters (start→end),
   calling `setDraftDate` (reuse the dead scaffold) or a new staged equivalent; wire the
   `js-draftdate` handler (or replace it). Add an inline time chip + month paging.
2. **Drive the lens from standard mode** — add `state.editingWindow` (or similar) and feed
   it into `activeDraftWindow()` so the left column reflects availability while editing
   inline; persist via `enterAvailabilitySearch` on commit.
3. **Fragile-rental staging inline** — stage edits + show a Save chip for fragile rentals;
   commit live otherwise. Mirror `winPickSave`'s logic (incl. the `billExtension` call).
4. **Retire the popup** — delete the popup functions/state/CSS/triggers; update `RULE_META`
   R16 + `RB_TABS` + `WINDOW_CATALOG`; regenerate `rule-usage.js`.
5. **Re-home the extension UI** (if #340 is merged in) — move the `.wp-ext` preview + the
   `billExtension` trigger + `+Extend` onto the inline editor.
6. **Run through `/jactec-ui` + `/frontend`** (any new/changed UI) and the gates:
   `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`,
   `node ci/check-window-catalog.mjs`, `node ci/check-design-md.mjs`. Bump the shared `?v=`.

## Gotchas
- **Port:** swap `8000`→`9147` in `ci/smoke.mjs`/`ci/logic-test.mjs` before running, then
  `git checkout -- ci/` (or revert the port only).
- **Playwright local:** the pinned `1.48.0` wants `chromium-1140` but the cloud container
  ships `chromium-1194`. To run the browser gates locally:
  `npm install --no-save playwright@1.48.0`, then `ln -sfn /opt/pw-browsers/chromium-1194
  /opt/pw-browsers/chromium-1140`, and run with `PLAYWRIGHT_CHROMIUM_USE_HEADLESS_NEW=1`
  (the 1194 binary rejects `--headless=old`). CI installs the matching browser, so CI is the
  source of truth.
- **`enterAvailabilitySearch` already persists the lens** post-edit — reuse it; don't build
  a parallel persistence.
- **Don't break the "available" search typed manually** (`availSearchActive()` path) — it's
  independent of the picker and must keep working.
- The dead `js-draftdate` handler + `setDraftDate` are safe to reuse OR remove — confirm no
  other caller (there isn't, as of this writing).
