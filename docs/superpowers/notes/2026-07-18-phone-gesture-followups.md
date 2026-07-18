# Parked — phone-gesture follow-ups (deferred from #725, 2026-07-18)

Two follow-ups deferred from the phone-gestures ship (**#725** — swipe-toggle decks,
pull-down-to-close, comms edge-back). Both are "extend a shipped gesture to more
surfaces"; **neither has code yet** — this note IS the artifact.
Spec: `docs/superpowers/specs/2026-07-18-phone-gestures-swipe-pulldown-design.md`.

## 1. Pull-down-to-close on the winpicker + datesearch sheets

Feature B (`initPhoneSheetGestures` → `closePhoneSheet`, in `app.js`) currently arms
only on `.mcomms` and full-pane `#overlay-root .overlay .popup`. The **winpicker**
calendar (`.winpicker-float` / `.winpicker`) and the **datesearch** float
(`.datesearch-float`) are also full-pane phone sheets but were excluded — they're
bespoke floaters with their own `.sheet-backdrop` tap-to-close + Esc, and
`closePhoneSheet` doesn't handle them, so a pull-down would animate them off-screen
without actually closing (stranded transform).

**Needs:** give `closePhoneSheet` a close path for these (e.g. `winPickCancel()` /
`closeDateSearch()`), add their roots to the `touchstart` sheet selector, and
`touch-action:none` on their header/grab region — same touch-events + `{passive:false}`
pattern as the comms sheet. Verify the header-always / at-top-body guard with their layout.

## 2. Swipe-to-toggle on the GPS + Transport toggle-sections

Feature A (R36 swipe decks) shipped on the funnel, Invoices, and comms Text/Email.
Jac chose to keep the first cut to those three (2026-07-18). Four more **view-switch**
`segCtl` sections are eligible (they swap panel content, so a swipe is meaningful):

- **GPS Round-up** — All · Down · Verify (`js-gpsh-bucket`)
- **GPS Fleet-map** — All · Running · Stopped (`js-gpsfm-filter`)
- **GPS Utilization** — 7d · 30d · 90d (`js-gpsu-days`)
- **Transport Alerts** — Today · +Tomorrow · This week (`js-tralert-win`)

**Needs:** wrap each in the R36 deck pattern (render all panes side-by-side on phone,
`swipeSeg`/`swipeTrack`, `deckCommit` writing that section's state key). These live in
the GPS/dispatch tooling (more ops-desk than phone-first), so confirm each is worth the
phone treatment before building.

**Guard:** never attach swipe to a *value/action* `segCtl` (inspection Pass/Fail,
transport leg type, vendor tax, coverage, etc.) — R36 is **view-switch only**; a swipe
must never set a record's state.
