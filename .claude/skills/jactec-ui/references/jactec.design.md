---
name: Rental Wrangler — JacRentals Yard Data-Plate
version: alpha
description: >
  Heavy-equipment rental management for JacRentals (Sulphur, LA). An industrial
  steel-yard plate, ONE safety-orange ignition accent, hi-vis hazard stripe, stamped
  Saira Condensed labels, corner rivets — with a light wrangler/ranch seasoning carried
  mostly in voice. Reads as a rental-yard tool first, western a distant second.
colors:
  primary: "#ff7a1a"          # safety-orange — the ONLY accent; ignition/primary actions
  on-primary: "#1a1205"       # dark ink stamped onto orange (high contrast)
  bg: "#0b0c0f"               # yard-floor base
  surface: "#15171c"          # steel panel
  surface-raised: "#1b1e24"   # raised steel
  card: "#14161b"
  neutral: "#262a31"          # hairline / rivet line
  on-surface: "#e9edf4"       # primary text
  on-surface-muted: "#a7afbc" # secondary text
  on-surface-faint: "#6b7480" # tertiary text
  caution: "#f5c542"          # caution-yellow (warnings, $0-rate flags)
  error: "#ff4242"            # danger-red (overdue, Failed, abort)
  leather: "#c2925a"          # worn-tan tertiary — TINY ranch touches only
  leather-deep: "#8a5a2b"     # saddle-stitch / deep tan
typography:
  wordmark:                   # stamped wordmarks / data-plate labels
    fontFamily: "Saira Condensed"
    fontSize: 13px
    fontWeight: 800
    letterSpacing: "2px"
  label:                      # stamped condensed UI labels (uppercase)
    fontFamily: "Saira Condensed"
    fontSize: 11px
    fontWeight: 700
    letterSpacing: "1px"
  body-md:
    fontFamily: "Geist"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
  body-sm:
    fontFamily: "Geist"
    fontSize: 11.5px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: 8px
  chip: 12px
  card: 16px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 13px
  lg: 16px
components:
  button-primary:             # ignition button — orange gradient face, dark ink
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 13px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  button-armed:               # armed/toggle mode = orange OUTLINE, not fill (rule 4)
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
  tab-active:                 # selected = solid orange + dark ink (rule 2)
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  pill-caution:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.caution}"
    rounded: "{rounded.full}"
  pill-danger:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.error}"
    rounded: "{rounded.full}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.card}"
---

## Overview
Ground every surface in the JacRentals **yard** — heavy-equipment rental, read as one
shop. The core is **industrial steel-yard**: dark panels, stamped data-plate labels,
corner rivets, ignition-style controls. On top sits a **light wrangler/ranch seasoning**,
carried mostly through **voice** ("Wrangle", "Round up", "Corral", "Brand", "Saddle up").
Rule of thumb: if a glance reads *western* before it reads *industrial rental yard*, dial
it back. The signature motif is the hi-vis **hazard stripe** —
`repeating-linear-gradient(135deg, var(--yellow) 0 13px, #14181d 13px 26px)`, red variant
for danger/abort.

## Colors
**One accent, spent on ignition.** Safety-orange (`#ff7a1a`) is the *only* accent — primary
and "ignition" actions, selected tabs (solid orange + **dark** `#1a1205` ink), armed mode
(orange **outline**, never fill). Steel panels carry everything else. Caution-yellow and
danger-red are status-only, never decoration. **Leather tan is a seasoning** — tiny tertiary
touches and saddle-stitch dividers, never a surface. Dark is default; a `[data-theme=light]`
mirror overrides the same token names.

## Typography
**Saira Condensed** for anything stamped — wordmarks, data-plate labels, primary buttons:
uppercase, letter-spaced ~1–2px, weight 600–800. **Geist** for all body copy. Two families,
no third.

## Layout
Fixed single-page frame, rows-as-chips, label-free two-column sections. Card radius 16px,
chip 12px. Corner **rivets** anchor panels; **saddle-stitch** dashed tan lines are the
occasional divider, pairing with the rivets.

## Components
Ignition primary buttons (orange face, dark ink). Selected tabs = solid orange + dark ink;
armed/toggle = orange outline. Pills are status fills on raised steel. Every interactive
element keeps a **visible focus ring** (`outline: 2px solid var(--accent)`), reduced-motion
respected. Each UI element is stamped `data-r="Rxx"` against the R-rulebook.

## Do's and Don'ts
- **Do** spend boldness in ONE place — the orange ignition action — and keep the rest steel.
- **Do** lean the ranch flavor into copy first, visuals second (a worn-tan touch, a brand/
  star mark used rarely).
- **Don't** add a second accent, gradients-as-decoration, or glow/glass/neumorph "slop."
- **Don't** let it read western before industrial — the ranch twist is a seasoning, not the
  meal.
- **Don't** treat this file as the source of truth yet: it's a *projection* of `CLAUDE.md` +
  `jactec-ui` + the R-rulebook. Refresh values against the live `style.css` before use.
