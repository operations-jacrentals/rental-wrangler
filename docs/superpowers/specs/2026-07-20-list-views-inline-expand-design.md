# List Views + Inline-Expand — design

**Date:** 2026-07-20 · **Status:** design in progress (brainstorming; no build until approved)
**Renders through:** `wrangler-style` (values) + `style` (rules). This doc holds the
*interaction & feature architecture* only — not colours/type/numbers.

## Goal

Kill the commitment of "click into a detail view." Accessing an item's detail becomes
**expanding it in place in the list**. The list is the home; detail is a reveal, not a
navigation.

## 1. Inline-expand model

- **Trigger:** tap/click a list row · tile · mini-card → it expands.
- **Desktop:** expands **in place to a fixed target** size/position (grows downward in
  its column; siblings push down; opened Units/Rentals items may break out to span the
  full grid-row width so labels don't truncate). Animate with the **mobile-swipe easing/
  timing** (that gesture is the quality bar). `prefers-reduced-motion` → no motion.
- **Mobile / coarse-pointer:** the tap opens a **focused full-screen mode**, **reusing
  the comms full-screen gesture system** — there, horizontal **swipe pages sections**,
  so swipe never competes with the toggle/card gestures. Close via ✕.
- Re-tap / ✕ collapses and cleanly releases the inline height.

## 2. Sections & paging

- Multi-section cards (**Units, Customers**) page their sections.
- **Section chips live in the item's OWN top row** — on expand, the top row of the item
  becomes the section rail (tab chips), plus ‹ › chevrons + a dot indicator. (This is
  distinct from the page-level item tab rail in §5.)
- **Landing section = the SIGNAL summary** ("what's hot / your move") on the user's own
  taps. A **link/transfer lands on its target section instead** (see §4).
- **Role sets the default landing + section order**; user can **drag-resort**, persisted
  per record-type.
- **Persistent History-search footer:** every expanded item keeps a `History: [ …search… ]`
  bar pinned at the **bottom**, present on ALL sections (does not page away). Focusing the
  search **expands a history log downward** (card grows taller, siblings push further
  down) + reveals **quick-filter chips** (Payments·Edits for rentals, Inspections·WOs·
  Washes for units, …). History is NOT a paged tab.
- **Tall sections scroll internally.** Fixed outer height; a section that overflows
  (esp. Customers' **Invoices**) scrolls within its own body — never blows out the card.

## 3. Rentals is the exception — no sections

The Rental card is **one view anchored on the calendar**:
- The mini-card **adopts the detail window-picker calendar, condensed** to mini-card
  width (drops its own mini-calendar).
- That calendar is the **constant anchor** — collapsed and expanded it stays the **exact
  same size and position**; it must not move, resize, or reflow on expand.
- On expand, the calendar stays put and the rest is **revealed around it, all at once**
  (not paged): customer Ref · status Gate · balance (owed) · per-unit rows (unit Ref +
  rate + per-unit gate) · PO / protection-off. Keeps the History footer.

## 4. Anchoring, item tab rail, links, cascade  *(integrate with the existing system)*

- **Anchoring must keep working** with inline-expand, **including cross-card cascade**
  (anchoring an item still lights its related records on the other two cards). Ground the
  new UI against the app's existing anchor-ring / rail / cascade behaviour — do not
  reinvent it.
- **Anchor UI on an expanded item:** the **top-right corner shows an anchor icon**
  (anchor this item). If an item is **already anchored**, that icon becomes a **`+`** on
  *other* expanded items — **adds the item to the rail without changing the current
  anchor.** De-anchor stays available via hotkey + the rail bar, and now also this button.
- **Links / transfers jump precisely:** clicking a linked record **scrolls to the item on
  its card, expands it, and opens it on the correct section** (the link encodes the target
  section). Own taps land on the SIGNAL summary; links land on their subject.
- **Preview tool is retired** — expanding is now so low-commitment that a separate peek/
  preview affordance is redundant.

## 5. KPI Rings → left vertical rail  *(OPEN — dangerous tradeoff)*

Candidate: move the **KPI Rings from the top to a left-hand vertical rail**, freeing the
top for a **single item tab rail** (the anchored/open items — nothing more).
- **Only do this if the horizontal real-estate given up is worth less than the vertical
  space gained.** Measure before committing (mock top-KPI vs left-KPI side by side).

## Open problems

- **Cross-user:** transferable sessions, send-to-coworker (Teams), other linking systems
  — how the section/anchor state travels. Firm up the Teams/linking model first.
- **Mobile focused-mode** should reuse the real **comms full-screen gestures**; the mockup
  ships a placeholder overlay until that integration.
- **KPI tradeoff (§5)** — decide by measurement, not feel.
