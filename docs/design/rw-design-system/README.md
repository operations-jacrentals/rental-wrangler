# Rental Wrangler — design-system preview package

This is a code-accurate design-system package for **Rental Wrangler** (JacRentals): 13 self-contained
preview cards under `foundations/`, `elements/`, and `components/`, plus `tokens.css` (the raw
token stylesheet) — built from the **locked `html.dv2` redesign tokens** in `style.css` (not the
legacy `:root` values), rendering the **Signal · Gate · Stamp · Ref · Door** vocabulary from the
`wrangler-style` and `style` skills. Every file is **vanilla HTML + CSS only** (no React, no JS
framework) and renders standalone when opened directly or dragged into a prompt — that's also how to
use it: attach the files you need to a Claude Design Labs prompt to ground a generation, or sync the
whole folder as a design system via `/design-sync` in a local Claude Code session so Design Labs emits
code matching this idiom. Dark-only, matte, no glow — there is no light mode.

**The one rule underneath every file here: nothing does two jobs.** Signal reports state and nothing
else; Gate is the one Signal you can turn; Stamp is a plain fact with no colour; Ref is the only thing
that links to another record; Door is the only thing that carries an action colour — and it never
borrows a status hue to mean "click me."

## Atom consistency pass — applied 2026-07-25

Every file here carries the approved pass from `../rw-consistency-pass.css` (kept as the source
record of what was decided). What changed:

- **Four control shapes, one per family.** State chips **squared** (`--chip-radius: 2px`), **openers**
  top-rounded (`5px 5px 0 0` — Gate and Field, so a trigger reads as the top half of an already-open
  menu), records **rounded** (`--item-radius: 8px` — Ref and `+Add`), actions **pill**
  (`--pill-radius` — Doors and nothing else). This **supersedes** the old "two radii / one 7px chip
  radius" line in the `style` skill; that canon is stale. Rejected for the opener shape on purpose:
  `.plate` / `.plate__head` (a container on `--radius`, not an inline control), `.door` (actions
  never open), `.seg` (a toggle switches, it does not open).
- **Body voice is Archivo**, loaded via the Google Fonts `<link>` in each file's `<head>` (fonts are
  CDN-loaded, never bundled). `--font-mono` is unchanged.
- **Outline chips are true outlines** — transparent + 1px border in the status hue. The `--*-bg`
  tints stay in tokens (plates use them) but no longer back a chip. `--red-line` keeps outlined red
  legible on dark.
- **`.menu` is superseded as a status picker** by `.seg--stack` (the segmented toggle, stacked). A
  menu of unrelated *actions* (⋯ → Duplicate / Export / Archive / Delete) is a different job and is
  queued as a **container**, not an atom.
- **New atom: Pin** (`elements/pin.html`) — the universal corner marker. Colour = state, fill = today
  like a Signal; 13px, deliberately off the 24px control ladder; zero layout footprint.
- **Interaction is uniform** — one hover ring drawn *outside* the element (no layout shift), one focus
  ring, real `<button type="button">` for every tappable atom, and no atom shrinks or wraps in a row.

## Finish pass — applied 2026-07-28/07-31 (ledger #140/#142/#152/#153/#166/#177)

Supersedes the four-shape radius ladder above for every control. What changed:

- **Radius 0 + chamfers on every control atom** (Signal, Gate, Slot, Field, Ref) — the squared/opener/
  rounded ladder read as plastic against a machined frame. Shape semantics moved into **finishes**
  instead: **machined ring** (the standard trim on a filled/glass control), **well glass** (a recessed
  dark face — OFF Seg cells, Field), **pressed key** (an ON Seg cell), **dark key** (the cool-tone
  finish a filled control wears at row/head scale in the tier-01 card). **Door alone keeps its pill**
  (ledger #153, predates radius-0 and was never in scope) — nothing else may take `--pill-radius`.
  `.ref__icon` and the old Pin tooltip's corner, previously unruled rounded survivors, are zeroed too.
- **MONO on every control atom** (ledger #142) — Ref was the last one speaking Archivo; it's mono now.
  Archivo survives only in prose (hint bubbles, empty states, callout copy).
- **Pin → Slot, everywhere** (ledger #177, `elements/pin.html` → `elements/slot.html`) — same job
  (colour = state, fill = today, 13px, zero layout footprint), a skewed stud face instead of a rounded
  chip, and an **unfurl** on hover/focus (a left-growing tray of every issue) instead of a single-line
  tooltip. The collapsed face is a **numeral only** now (ledger #166) — no status word, so it can never
  overhang its cell.
- **`tokens.css` reconciled** (ledger #152) — every hard-coded value `tier-01-card.css` flagged with a
  `TOKEN-GAP:` marker now has a named token (`--well`, `--key`, `--ref-plate`, the `--seam-*` family,
  `--lit-rgb`, the steel accent-seed map, and more). The `#C28E54` near-miss unified to the existing
  `--tan` rather than becoming a second one.
