# Labs — Prompt 0.1a · The Card (frame · header · list row)

**Tier 0.1 — containers.** This is the first container prompt and the most load-bearing one in the
whole build order: the frame, its header, and the repeated row are the anatomy **every card in the
app shares**. Get these three right and twelve surfaces are 80% designed.

**Attach from the `rw-design-system` folder** — the locked atoms this must be built out of:
`foundations/spacing.html` (the 24px control law + the four control shapes) · `elements/signal.html` ·
`elements/gate.html` · `elements/stamp.html` · `elements/ref.html` · `elements/pin.html` ·
`elements/door.html` · `components/section-plate.html` (for the header grammar only).

**Reference (context, not canon):** `docs/design/reference/list-views.html` — the earlier list-view
mockup. Its vocabulary (`col-head` / `col-title` / `col-body`, `list-row` with its heading, detail
and "when" slots, `jitem-collapsed` / `jitem-expanded`) is the shape we've been circling. Treat it
as a starting sketch, not an approved design.

---

## ⭐ North Star — the one thing this pass decides
**What a card IS** — the frame it draws, the header that caps it, and the row it repeats — so that
every card in the app is the same object with different contents.

## 🚫 Out of scope (anti-objectives — do NOT critique or redesign here)
- **The atoms.** Signal, Gate, Stamp, Ref, Pin, Door, chips, fields and the two type voices are
  **LOCKED** (2026-07-25). Use them verbatim. If one genuinely cannot do the job a container needs,
  say so in a note — do not quietly restyle it.
- **The palette, type and token values.** Settled canon, CVD-tuned. Not up for discussion.
- **The 3-column grid** — how many cards sit side by side, how wide a column is, and how an
  expansion relates to its column. That is **Tier 0.2, the shell**, and it is the very next prompt.
  Design the card as if it will be handed an arbitrary width.
- **What any specific card contains.** No Units columns, no Rentals calendar, no Invoices totals.
  Per-card content is **Tier 2**. Use generic placeholder content so the *container* is what gets
  judged.
- **The detail view** — what appears when a row expands. **Tier 1**, already drafted and parked.
  Here, only design the row's *affordance* for expanding, not the expansion itself.
- **Section plates, popups, and the ⋯ action menu.** The next two container prompts.

## ♻️ Inherit (locked — reuse verbatim)
- **All eight atom families**, exactly as they render in the attached kit.
- **The four control shapes:** state chips **squared** (2px), openers **top-rounded** (`5px 5px 0 0` —
  Gate and Field only), records **rounded** (8px), actions **pill** (Doors only) — and `--radius: 14px`
  for containers, which is what the card frame itself takes.
- **The 24px control law.** Every control in a row is 24px on one baseline. The **Pin** at 13px is
  the single exception, and it is the tool for marking a row or header without consuming a slot.
- **Rollup precedence:** `red > yellow > blue > green > gray`. A header never shows calm while
  something inside it is on fire.

## The ask — three artifacts, in this order

### 1. The card frame
The container itself: border, radius, surface, elevation-or-not, how its body scrolls, and where it
ends. Show it **empty**, **loading**, and **full**. Decide whether the frame or the body owns the
scroll, and what the bottom edge does when there is more below the fold — a card that silently cuts
off is the failure mode to design against.

### 2. The card header
The cap that says what this card is and what is wrong inside it. It has to carry, in one 
constant-height band: the card's **name**, a **count**, the **rolled-up worst state** of everything
inside, a **filter/segment control**, and a **primary action**. Decide the order, what survives when
the card is narrow, and what happens to the header when the body is scrolled. This header appears on
all twelve surfaces below — design it as a system, not a one-off.

### 3. The list row
The unit that repeats. Design the **collapsed** row and its **states**: default, hover, focused,
selected, expanded-parent, and the row that is on fire. Decide:
- **The slot grammar** — which atoms go where, left to right, and which slots are optional. A row
  should be readable as a fixed set of positions, not an improvised flex soup.
- **Density.** How tall, how much breathing room, how many rows before the eye loses the column.
- **The group header** — the divider that separates "Overdue" from "Due today" from "Later". It is a
  different object from the card header; decide how different.
- **The expansion affordance.** How the row says "there is more inside me," and what it looks like
  the instant before the detail opens.
- **Overflow.** What a row does when the name is too long, when there are six chips and room for
  three, and when a value is missing entirely.

## Grounding — the real inventory
This container is shared by **twelve surfaces**:
- **Five grid cards** — Units · Categories · Rentals · Invoices · Customers.
- **Six back-office boards** — Parts · Vendors · Expenses & Receipts · Company Files · Collections ·
  Sales Pipeline.
- **Trips** — confirmed by Jac 2026-07-25 as a twelfth surface. It is not yet in the shipped card
  registry, but it has three reference mockups (`trips-card.html`, `trips-ledger.html`,
  `trips-schedule.html`) and it **is** in scope for this container.

Trips is the useful stress test here, because it is the least list-shaped of the twelve: it is
time-anchored (a schedule and an ETA ledger, not a static roster), so its rows carry *when* as
prominently as *what*. **If the row grammar can seat a departure time and an ETA without a special
case, it will seat anything the other eleven throw at it.** Check the row design against
`trips-ledger.html` before calling it done — but design the general row, not a Trips row.

> The build order used to say "all 7 cards." That number was stale: the Shop card was retired
> 2026-07-07 (Work Orders / Service Orders / Inspections moved inside each Unit's detail view).
> Corrected to twelve.

## The test each artifact has to pass
Put the three together and ask the yard question: **a tired dispatcher glances at this card for two
seconds — do they know what is on fire and what to touch first?** If the answer needs a second
glance, the header or the row is doing too many jobs.

## After you lock
Tell me what changed and why. I fold the result into the code-accurate kit, re-sync the design
system, and the frame + header + row become carried-forward Inherit items on every prompt after
this one — starting with the **shell** (Tier 0.2), which finally decides how these cards sit in
three columns.
