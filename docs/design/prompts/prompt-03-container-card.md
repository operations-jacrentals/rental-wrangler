# Labs — Prompt 0.1a · The Card (frame · header · list row)

**Tier 0.1 — containers.** This is the first container prompt and the most load-bearing one in the
whole build order: the frame, its header, and the repeated row are the anatomy **every card in the
app shares**. Get these three right and twelve surfaces are 80% designed.

**Attach from the `rw-design-system` folder** — the locked atoms this must be built out of:
`foundations/spacing.html` (the 24px control law + radius-0-and-four-finishes: machined ring / well
glass / pressed key / dark key — #140) · `elements/signal.html` · `elements/gate.html` ·
`elements/stamp.html` · `elements/ref.html` · `elements/slot.html` (renamed from Pin — #166/#177) ·
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
- **The atoms.** Signal, Gate, Stamp, Ref, Slot (renamed from Pin — #166/#177), Door, chips, fields and
  the two type voices are **LOCKED**. Use them verbatim, in their **current** kit form (see the
  "✅ Still honoured?" checklist below — the atoms themselves moved since 2026-07-25). If one genuinely
  cannot do the job a container needs, say so in a note — do not quietly restyle it.
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
- **All eight atom families**, exactly as they render in the attached kit — **note that the kit itself
  changed after 2026-07-25** (see checklist below); build against the current files, not memory of the
  old ones.
- **Radius 0 + four finishes, not a shape ladder (#140/#153) — supersedes the old four-shape rule.**
  Every control atom (Signal, Gate, Slot, Field, Ref) is `border-radius: 0`. Shape semantics live in
  the **finish** instead: **machined ring** (filled Signal/Gate), **well glass** (OFF seg cells,
  Field), **pressed key** (ON seg cells), **dark key** (cool-tone Signal/Gate at row/head scale).
  **Door alone keeps its pill radius** (confirmed, not an exception — #153). Containers still take
  `--radius: 14px`, which is what the card frame itself uses. `.ref__icon` and the old Pin tooltip
  corner are zeroed to 0 too (#153).
- **Every control atom speaks mono, including Ref (#142)** — Ref was the last one in Archivo; Archivo
  is prose-only now (hint bubbles, empty states).
- **The 24px control law.** Every control in a row is 24px on one baseline. The **Slot** (renamed from
  Pin — #166/#177) at 13px is the single exception, and it is the tool for marking a row or header
  without consuming a slot. Its collapsed face shows a **numeral only, no status word** (#166); hover
  or focus **unfurls a tray** of the issues behind it — there is no tooltip anymore (#177).
- **Rollup precedence:** `red > yellow > blue > green > gray`. A header never shows calm while
  something inside it is on fire.

## ✅ Still honoured? — decisions locked since this file's 2026-07-25 edit
This file predates the whole 07-28/07-31/08-01 batch below (ledger rule #145: a handoff can carry a
decision through revisions and still lose it to drift, not just omission — check this list every time
this prompt is touched again).

- [x] **#140** Radius 0 + four finishes replaces the four-shape ladder on every control atom — *fixed
  above, in Inherit.*
- [x] **#142** Mono on every control atom, including Ref — Archivo is prose-only now — *fixed above.*
- [x] **#147** Filter chips are **three**, not two — Your Work · **Open** · Done — each carrying its
  own Slot (hue = worst state in that bucket, number = count, hidden at zero) — *fixed in the card
  header ask.*
- [x] **#149** The header's **description line is REMOVED** — its context job migrated to the footer
  terminal + per-group message boards (out of scope here). This ledger row names *this file* by title
  ("prompt 0.1a's header contents") — *fixed in the card header ask.*
- [ ] **#152 / #181** Token-gap pass closed (`--well`, `--key`, `--ref-plate`, `--seam-1..5`,
  `--lit-rgb`, etc. now named in `tokens.css`) — informational only, nothing for this prompt to change.
- [x] **#153** `.ref__icon` and the old Pin tooltip corner zeroed to 0; Door's pill confirmed, not an
  exception — *fixed above, in Inherit.*
- [x] **#156 / #172 / #180** A lit row's **laser frame alone** carries the state hue; the cartridge's
  face stays neutral glass, not also washed in the group hue — stating the hue twice was rejected, and
  this is now **final**, not provisional — *fixed in the list-row ask.*
- [x] **#161** Boot theatre (CRT flicker + laser drop + per-row type-in, `steps(16)` .07s stagger) is
  now the **row-open** animation, not a group-open effect — *fixed in the expansion-affordance bullet.*
- [x] **#163 / #164** `app.js` lags the decision trail — never check shipped code for what's currently
  locked; check the ledger/spec/audit trail instead. (No specific fix needed here — noted for whoever
  builds this next.)
- [x] **#166 / #177** **Pin is renamed Slot, everywhere** — including on filter chips, which carry
  Slots too, not a separate non-unfurling Pin. Collapsed = numeral only; hover/focus **unfurls a tray**
  (no tooltip) — *fixed throughout.*
- [x] **#168 / #169** **Two-level architecture**: **GROUP = housing**, opens by **MOVING** (steel,
  mechanical, no light); **ROW = cartridge**, opens by **LIGHTING** (glass, terminal, emission — laser
  frame + CRT-flicker power-on). Invariant at both levels: the name is right-aligned — *fixed in the
  group-header and expansion-affordance bullets.*
- [x] **#170** The head's slot-rack 8-tick cap and the message board's fixed 114px width are
  **retired** — every other head/row element is edge-anchored, so the rack takes the residual width
  (measured 138–243px / 16–28 ticks) — *fixed in the slot-grammar bullet.*
- [ ] **#171** "Failed" drops from the group label text, stays a filter/search term — not this file's
  concern (group *labels* are Tier 2 content), noted for completeness only.
- [x] **#173** The 220ms single/double-click discriminator is **unchanged** — a single click now
  powers on/lights the whole cartridge rather than just expanding a row, but no new click handler was
  added — *fixed in the expansion-affordance bullet.*
- [ ] **#174** Converting the row's button to a verb does **not** free enough width to restore a facts
  column at 380px (27px reclaim vs. a ~59px shortfall) — not asserted anywhere in this file; nothing to
  fix, flagged so no future edit re-introduces facts at this width without a wider column.
- [ ] **#175** Row verb wording (Dispatch/Return/etc.) is a **deliberate placeholder** — do not polish
  it. This file doesn't specify verb wording, so nothing to change; flagged so it stays that way.
- [x] **#176** **Row order is LOCKED**: `button · slots · board · name`, left to right — the head's own
  `name · board · slots` right-to-left grammar plus a left-anchored button — *fixed in the slot-grammar
  bullet, no longer an open design question.*
- [x] **#178** "Close all open rows" is now a **click on the Open filter chip** while it's active, not
  a hover-to-✕ gesture (that collided with slots unfurling on hover everywhere) — *fixed in the card
  header ask.*

## The ask — three artifacts, in this order

### 1. The card frame
The container itself: border, radius, surface, elevation-or-not, how its body scrolls, and where it
ends. Show it **empty**, **loading**, and **full**. Decide whether the frame or the body owns the
scroll, and what the bottom edge does when there is more below the fold — a card that silently cuts
off is the failure mode to design against.

### 2. The card header
The cap that says what this card is and what is wrong inside it. Decide the order, what survives when
the card is narrow, and what happens to the header when the body is scrolled. This header appears on
all twelve surfaces below — design it as a system, not a one-off.

**⚠️ The header's CONTENTS are already decided — do not re-derive them.** These are locked
(`docs/superpowers/specs/2026-07-20-decisions-ledger.md` §5 + decisions 36/37, and
`2026-07-20-list-views-inline-expand-design.md` §5.2). Your job is the **grammar** — order, spacing,
priority, responsive behaviour — **not** which controls exist:

- **The card's name, LEFT-aligned.** It moved from centre to left *specifically* to free header room
  for the filter chips (ledger #37). Do not centre it. It renders as a **Ref**, not plain text — a
  card title is a linked record like any other (critique log: "Ref drift").
- ~~A short description line under the name~~ — **REMOVED (#149).** The header's description-line
  slot is gone; its context job migrated to the footer terminal + the per-group message boards, both
  out of scope here. Ledger #149 names this exact file ("prompt 0.1a's header contents") as what it
  supersedes — do not design a description line back into the header.
- **"Your Work"** — the quick-filter chip. Hides any group holding **only** green/gray; shows only
  groups containing red/yellow/blue. It does **not** re-bucket items, only hides/shows whole groups,
  and it **carries a rolled-up count**. Accent-filled when on. This was deliberately chosen over four
  time-based chips (Today/Tomorrow/Week/Done) because those are Rentals-specific words that don't fit
  Units or Customers — a per-card filter set would have broken "same builder everywhere."
- **"Open"** — a **third** quick-filter chip (#147, supersedes the two-chip model below it). Shows only
  groups holding an expanded/lit row. While it is the **active** filter, **clicking it closes every
  open row** on the card (#178) — there is no hover-to-✕ gesture; a Slot's hover is already spoken for
  by the universal unfurl (#177), so the collision #147 first raised is resolved by moving the action
  to a click, not a hover.
- **"Done"** — shows only items in the green "done today" state, so a user can re-find and re-touch
  what they just did. A **filter**, explicitly *not* a group.
- Each of the three chips **carries its own Slot** (#147/#177): hue = worst state in that bucket,
  numeral = count, hidden at zero — same atom as everywhere else, same numeral-only-collapsed/
  hover-unfurl behaviour (#166/#177), not a bespoke chip-count badge.
- **Search** and **sort**. (Sort is flagged weak and parked for a future all-cards redesign, ledger
  #85 — give it a slot, don't over-invest in it.)
- **The rolled-up worst state** and a **primary action** (one verb per card).
- **NOT the graph button.** It used to live in the card subheader; it **moved onto each section**
  (spec §5.2), where clicking it pops that graph onto the user's Dashboard. Do not put it back here.

So the real question this artifact answers is: **how do a left-aligned Ref title, three filter chips
(each carrying a Slot), search, sort, a rollup, and one Door share one band** — and what drops first
as the card narrows. That is a harder packing problem than a generic six-slot header, and it is the
actual problem.

**A note on what already exists:** a prior Labs pass produced a clean six-slot header
(stripe · name · count · rollup · filter-seg · verb) that is good grammar but was built without the
list above — its `ALL / OPEN / PAID` segment is not the locked Your Work / Open / Done model (note:
that pass's "OPEN" is a status filter-seg value, unrelated to the later, same-named Open quick-filter
chip of #147 — don't conflate the two). Treat that pass's **frame, row and overflow work as sound**;
the header is the part to redo against this canon.

### 3. The list row
The unit that repeats. Design the **collapsed** row and its **states**: default, hover, focused,
selected, expanded-parent, and the row that is on fire. Decide:

**⚠️ The group and the row are now two DIFFERENT mechanisms, not one (#168/#169) — this is new since
this file was last written and changes what "the group header" and "the row's expansion" each are:**
- **GROUP = housing.** It opens by **MOVING** — steel, mechanical, physical, **no light at all**. A
  purely physical `translateY` shift.
- **ROW = cartridge.** It opens by **LIGHTING** — glass, terminal, emission. A laser-frame hue outline
  plus a CRT-flicker power-on carries the state; the row's face itself stays **neutral glass** — the
  hue lives on the frame alone, not repeated on the face too (#156/#172/#180, final). The boot theatre
  (CRT flicker + laser drop + per-row type-in, `steps(16)` .07s stagger) fires on **row**-open, not
  group-open.
- **The invariant that holds at both levels: the name is right-aligned.** Middles may differ — a group
  head has no button and no facts; a row does.
- Design both objects against this split, not as one shared "expand" mechanic wearing two skins.

- **The slot grammar** — which atoms go where, left to right, and which slots are optional. **Row
  order is now LOCKED, not an open design question here (#176):** left to right it is
  **`button · slots · board · name`** — the head's own right-to-left grammar (`name · board · slots`)
  plus a left-anchored button, the one element a head doesn't have. A row should be readable as a fixed
  set of positions, not an improvised flex soup. The slot rack itself is **not tick-capped** (#170) —
  every other element in the row is edge-anchored, so the rack simply takes whatever residual width is
  left, showing `+N` only when it genuinely runs out of room.
- **Density.** How tall, how much breathing room, how many rows before the eye loses the column.
- **The group header** — the divider that separates "Overdue" from "Due today" from "Later" — is now,
  per the two-level split above, a **housing face plate**: right-aligned `[ slots ][ board ][ name ]`,
  opening by moving, carrying no light of its own. It is a different object from the card header;
  decide how different. **⚠️ Groups come in two locked kinds** (ledger #31/#34/#35) and the header must
  serve both:
  - **Attention groups** (Field Calls, Failed) exist *only* because something is wrong — they are
    **hidden entirely when empty** and carry colour natively.
  - **Lifecycle groups** (On Rent, Reserved, Available) are **always present, gray by default**, and
    take colour **only** when a member inside triggers it. No group ever carries a fixed colour.
  - **Never named after status** ("Bad", "To-Do") — a group name says *where in the workflow*, colour
    says *how much it needs you*. Double-encoding those is the error to design against.
  - The same group **set** is **reordered per role** — so group order is data, not layout. Don't bake
    an order into the design.
- **The expansion affordance — and the click contract behind it** (ledger #50/#62/#63/#67, **kept
  exactly as-is by #173**):
  - **Single click = power on / light the row-cartridge in place. No cascade.** The row opens where it
    sits; siblings push down. There is still a **220ms discriminator**, so single and double click are
    different verbs — **#173 is explicit that this did not change**, even though a single click now
    lights a whole cartridge rather than doing a plain inline-expand; no new click handler was added,
    the row's existing click contract still drives it underneath.
  - **Double click = anchor** — that one fires the cascade and opens a tab. The row needs to make
    both reachable without advertising two buttons.
  - **An expanded row carries an anchor icon, top-right.** If something is *already* anchored, that
    icon becomes a **"+"** on every other expanded row. Design both states.
  - **The power-on animates with CRT-flicker + a laser drop + per-row type-in** (`steps(16)`, .07s
    stagger) — **not** the mobile-swipe easing this file previously called for; that boot theatre
    relocated from group-open to row-open (#161 relocated by #168/#169). It still animates to a fixed
    target size.
  - The old **hover-eye preview is retired** — the row's power-on *is* the peek. Don't reintroduce a
    preview affordance.
- **The hover-jump accelerator** (ledger #58/#59/#60). On hover, a **popover emerges from the row's
  top edge** with a tail/notch, **one chip-line tall**, flipping below when the row is near the top of
  the list. It is **instant — no dwell timer** — and made mis-click-safe by **geometry** (a right-lane
  or whole-row hover target), never by a delay. Here, decide only **what the row owes it**: where it
  emerges from and what must stay clear. The popover itself is designed in prompt 0.1c.
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

**Plus a thirteenth, different one: the Dashboard card** (ledger #44/#45/#86–#89). Every role gets the
base cards **plus a role-dependent Dashboard** as a 6th. It is a **landing, never a lockout** — the
base cards stay reachable. Its content is charts rather than rows, and **chart marks are links**
(a wedge fires the same cascade a text link would), under **one colour law shared by chip and chart**:
a graph wedge is the same colour as the Signal chip it lands on. Field roles get a live timeline
(Yard Journey / route) instead of graphs — one pattern, two forms.
**You are not designing the Dashboard here** — that is Tier 2. What matters now is that the card
**frame and header must not assume a row list inside them**, because one of the thirteen isn't one.

> **⚠️ Flag for Jac — a canon/code mismatch worth settling before Tier 2.** Ledger #44 names the five
> base cards as **Units · Rentals · Customers · Trips · Categories** (+ Dashboard). The shipped
> registry (`config.js` → `GRID_CARDS`) has **Units · Categories · Rentals · Invoices · Customers** —
> it includes **Invoices** and omits **Trips**. Both can't be the base five. This doesn't block the
> container work (the frame serves all of them either way), but it decides Tier 2's scope.

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
