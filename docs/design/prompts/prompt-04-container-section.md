# Labs — Prompt 0.1b · The Section (plate · stack · rail chip)

**Tier 0.1 — containers, part two.** The section is the container *inside* a record: the plate that
groups a handful of facts under one labelled, colour-stated header. A detail view is a **stack of
these**, and the Tier 1 section rail is built from their rolled-up states — so the section has to be
right before the detail view can lock.

**Attach from the `rw-design-system` folder:** `components/section-plate.html` (the existing plate
grammar — the thing being refined) · `elements/signal.html` · `elements/gate.html` ·
`elements/stamp.html` · `elements/ref.html` · `elements/pin.html` · `elements/door.html` ·
`foundations/spacing.html`.

**Reference (context, not canon):** `docs/design/reference/detail-views.html` — the plate-stack as
it was drafted for Units / Rentals / Customers.

---

## ⭐ North Star — the one thing this pass decides
**What a section IS** — one labelled, state-coloured plate that groups related facts, reports its own
worst state, and carries its own primary action — so a record's detail is nothing but a stack of them.

## 🚫 Out of scope (anti-objectives — do NOT critique or redesign here)
- **The atoms.** LOCKED 2026-07-25. Reuse verbatim.
- **The card frame, card header and list row.** Locked in prompt 0.1a. A section is *not* a small
  card — if the two start converging, that is a finding to report, not a licence to redesign the card.
- **Which sections each record type has.** No "Units gets Service, Rentals gets Billing." That is
  **Tier 2, per-card content**. Use generic placeholder sections.
- **The section rail itself** — the horizontal strip of chips that pages between sections one at a
  time. That is **Tier 1, the detail view**, and it depends on the shell. Here you only decide what
  a single section *contributes* to a rail chip: its label, its rolled-up Signal, its primary Door.
- **Bounded height and paging behaviour.** Tier 1. Design the section as if it will be given
  whatever height it needs.
- **Popups and the ⋯ menu.** The next prompt.

## ♻️ Inherit (locked — reuse verbatim)
- **All eight atom families.**
- **The card frame, header and list row** from prompt 0.1a — a section may *contain* rows, and when
  it does it uses that exact row, not a variant.
- **The four control shapes** and **`--radius: 14px`** for container corners.
- **Rollup precedence** `red > yellow > blue > green > gray` — a collapsed section header shows the
  worst state inside it.
- **The `--*-bg` tint tokens.** Outline chips gave up their tints in the atom pass, but **plates kept
  them** — the tinted header band is now the plate's own signature and nothing else uses it.

## The ask — one artifact, four questions

### 1. The plate, collapsed and expanded
The existing grammar is: colour stripe · stamped label · a one-line **summary** of what is inside ·
a chevron. Judge it hard. The summary line is the whole bet — it is what lets someone skim eight
sections without opening any of them. Decide what belongs in it, how it truncates, and what it says
when the section is empty.

### 2. The section's own state
A section reports the worst state of its contents in its header band. Decide **how loud that is
allowed to be.** Eight sections stacked, three of them red, is a wall of alarm that reports nothing.
Design the calm case as carefully as the on-fire case — most sections, most of the time, are gray.

### 3. The body
What goes inside: a **key/value grid** for facts, a **row list** for contained records, and a
**free-form** slot for anything else. Design all three, and the rules for mixing them. Decide the
label/value alignment, what a missing value looks like, and how a long value wraps without breaking
the 24px control band.

### 4. The section's actions — a Door **and** a graph button
Each section owns at most one **primary Door** ("Add Part", "Collect Payment", "Start Inspection")
plus optional secondary actions. Decide where it lives — in the header band or the body footer —
and what happens to it when the section is collapsed. This choice directly feeds the Tier 1 rail
chip, which carries the section's Signal *and* its primary Door.

**⚠️ Every section also carries a GRAPH BUTTON — this is locked, not optional**
(`docs/superpowers/specs/2026-07-20-list-views-inline-expand-design.md` §5.2). Clicking it pops that
section's graph **onto the user's role Dashboard** — *not* inline, which is the whole point: the graph
never eats the card's vertical budget. This is the **composition mechanism** for the role Dashboard —
users curate it section by section (open a unit's Investment / Services / GPS section → click its
graph → it lands on their Dashboard).

So a section header carries **two** affordances of different kinds: a **Door** (a verb that changes
this record) and a **graph button** (a verb that changes *the user's dashboard*). Decide how they sit
together without reading as a row of equal buttons — they are not equals, and the graph button is the
quieter of the two. Decide what it looks like once the graph is already on the Dashboard.

## The test the artifact has to pass
Stack **eight** sections — two red, one yellow, five gray — and scroll it. Can you find the two that
matter without reading a word? And with everything collapsed, does the stack read as a **table of
contents** for the record, or as a pile of closed drawers?

## After you lock
The plate becomes an Inherit item for the detail view (Tier 1) and every per-card content prompt
(Tier 2). Tell me what you changed; I fold it into the kit and re-sync.
