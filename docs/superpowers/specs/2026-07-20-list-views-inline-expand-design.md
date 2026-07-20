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

## 4. Anchoring, item tab rail, links, cascade  *(grounded on the existing system — recon 2026-07-20)*

The app already has every primitive; the new model mostly **re-maps single-click to
inline-expand** and leaves anchoring / rail / cascade / links intact.

- **Single vs double (reuse the existing `deferOrAnchor`, 220 ms discriminator):**
  **single-click/tap → inline-expand** (the new low-commitment primary; **no cascade**).
  **Double-click → anchor** (existing behaviour: opens a foreground **tab**, sets
  `session.anchor`, cascades the other two cards to the related subset, paints the
  `#18b6ff` ring).
- **Anchor UI on an expanded item:** **top-right anchor icon = anchor** (= `anchorRecord`
  / foreground tab + cascade). If something is **already anchored**, that icon becomes a
  **`+`** on *other* expanded items = **add to the rail without changing the anchor**
  (= existing `openInNewTab` / ctrl-click background tab). De-anchor: double-tap the
  anchor, the rail ✕, hotkeys — and now this button.
- **Cascade fires on ANCHOR only**, never on inline-expand — that's what keeps expand
  cheap. Cascade engine unchanged (`cascade.js`: FK-walk → related subset → hard-filter
  the sibling cards to it).
- **Item tab rail unchanged** (`tabStrip`: one tab per anchored/open record; header-right
  on desktop, bottom-dock above the toolbar on phone; active-tab click re-cascades).
- **Tabs are SESSIONS, not just items** (Chrome-tab style): a tab holds the anchored
  record **plus the whole 3-card state** (cascade, sibling filters, scroll) at that moment;
  switching tabs restores that entire context. This is the natural unit for **transferable
  sessions / send-to-coworker** (§Open) — you hand over a *tab* = a working context, not one
  record.
- **Links jump precisely (generalise the existing `pillTo`):** a link-click **reveals the
  target's card column, opens the record in place, scrolls to + inline-expands it on the
  correct section** — exactly the pattern the retired-Invoice case (`openInvoice`) already
  runs (reveal customer → scroll to the Invoices section → expand the row → glow). Own
  taps land on the SIGNAL summary; links land on their subject section. (Double-clicking a
  link still anchors, as today.)
- **Preview tool retired.** The hover-preview + the row/bottom-bar **eye** toggles go away
  — inline-expand is the peek now.

## 5. KPI Rings → left vertical rail  *(OPEN — dangerous tradeoff)*

Candidate: move the **KPI Rings from the top to a left-hand vertical rail**, freeing the
top for a **single item tab rail** (the anchored/open items — nothing more).
- **Only do this if the horizontal real-estate given up is worth less than the vertical
  space gained.** Measure before committing (mock top-KPI vs left-KPI side by side).

## 6. Section content the extra room unlocks  *(Units — early ideas, not locked)*

Inline-expand gives sections real estate the cramped detail view never had. Two Units
sections to rethink with it:
- **Inspection** (current design is outdated): if an inspection needs a checklist, keep the
  **checklist open live in the section** — answers fill in place; the inspection only flips
  to **done when it's actually done**, not on a separate screen. A live capture surface, not
  a button that launches a form.
- **Yard journey** ("not good enough"): replace the cramped horizontal node rail. Leading
  direction — a **live vertical lifecycle timeline** (done / current / upcoming stages, each
  a row carrying its captured evidence + the one next Door), led by a compact **"now + next"**
  header, with an inline **route map** when transport applies. Concepts to mock + pick.

## Open problems

- **Cross-user:** transferable sessions, send-to-coworker (Teams), other linking systems
  — how the section/anchor state travels. Firm up the Teams/linking model first.
- **Mobile focused-mode** should reuse the real **comms full-screen gestures**; the mockup
  ships a placeholder overlay until that integration.
- **KPI tradeoff (§5)** — decide by measurement, not feel.
