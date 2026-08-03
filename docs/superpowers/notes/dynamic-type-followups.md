# Parked: iOS Dynamic Type follow-ups

**Parked 2026-07-18** from the mobile Text-Size a11y work (PR #714, shipped live `?v=20260718e`).
The core change is live: the app now roots on a 17px `rem` anchor bound to `-apple-system-body`
on touch devices, and all font sizes are `rem`, so the iOS Text-Size slider resizes the whole
app. These are the two known follow-ups that need a **real iPhone** to tune (Chromium can't
emulate Dynamic Type).

## 1. Fixed-height controls may clip at the LARGEST accessibility sizes
Font sizes now scale, but many controls still have hard `px` **heights** (pills, gate buttons,
chips, the disp/nav boxes, etc.). At the biggest iOS Text-Size steps (AX3–AX5, up to ~3×) the
scaled text can clip or overflow its fixed-height container.
- **What's left:** on a physical iPhone, walk the dense surfaces (Units/Rentals/Customers cards,
  status pills, gate dropdowns, the funnel + swipe rail) at a large Text Size and note which
  controls clip. Relax those specific heights (`min-height` + auto, or convert the height to
  `rem`) — do **not** blanket-convert every height; only the offenders.
- Icons are mostly Lucide SVGs sized by `width`/`height` (not font-size), so the glyph-in-fixed-box
  risk is small — it's the text-in-fixed-height-control case that matters.

## 2. Min-legible floor at the SMALLEST Text Size
The iOS slider also goes *below* default. At xSmall the anchor drops ~14px, so the smallest labels
(6px → `0.3529rem`) render ~4.9px — below legible. The design is already calibrated to its minimum
at default, so shrinking past it is the concern (jactec-ui: "enforce a minimum legible size").
- **What's left:** decide whether to floor the scaling so it only grows (never shrinks below the
  calibrated baseline). `-apple-system-body` can't be wrapped in `max()` directly, so options are:
  (a) accept the shrink (rare — most users bump text UP), (b) clamp via a small JS read of the
  computed anchor, or (c) leave it. Recommend deciding after seeing #1 on-device.

## Reference
- Implementation: `style.css` `html` rule (§M-a11y anchor + the `@media (hover:none) and
  (pointer:coarse)` binding); the px→rem migration across `style.css` + `app.js`.
- Gotcha recorded in `MEMORY.md`: `-apple-system-body` is a fixed ~13px on macOS Safari, which is
  why the binding is touch-scoped.
