# Labs — Prompt 0.1b · The Section (rail chip · paged pane)

**Tier 0.1 — containers, part two.** The section is the container *inside* a record: a labelled,
colour-stated group of facts. A detail view is a **rail of these, paged one at a time** — the rail is
built from their rolled-up states — so the section has to be right before the detail view can lock.

**Attach from the `rw-design-system` folder:** `components/section-plate.html` (the existing plate
grammar — the thing being refined) · `elements/signal.html` · `elements/gate.html` ·
`elements/stamp.html` · `elements/ref.html` · `elements/pin.html` · `elements/door.html` ·
`foundations/spacing.html`.

**Reference (context, not canon — and note what's stale):** `docs/design/reference/detail-views.html`
shows Units / Rentals / Customers as a **plate stack with every section open at once**. That is the
**superseded** model — it is the very mockup that proved records get far too tall. Mine it for the
plate's *look* (stripe, stamped label, body grammar); do **not** copy its stacked structure.

---

## ⭐ North Star — the one thing this pass decides
**What a section IS** — one labelled, state-coloured group of facts that reports its own worst state
and carries its own primary action — so a record's detail is nothing but a rail of them, paged.

## 🚫 Out of scope (anti-objectives — do NOT critique or redesign here)
- **The atoms.** LOCKED 2026-07-25. Reuse verbatim.
- **The card frame, card header and list row.** Locked in prompt 0.1a. A section is *not* a small
  card — if the two start converging, that is a finding to report, not a licence to redesign the card.
- **Which sections each record type has.** No "Units gets Service, Rentals gets Billing." That is
  **Tier 2, per-card content**. Use generic placeholder sections.
- **The section rail itself** — the horizontal strip of chips that pages between sections one at a
  time. That is **Tier 1, the detail view**, and it depends on the shell. Here you only decide what
  a single section *contributes* to a rail chip: its label, its rolled-up Signal, its primary Door.
- **The expanded item's bounded height and section paging.** Tier 1. ⚠️ But **not** the section's own
  overflow — see the locked rule below; a section does *not* get "whatever height it needs."
- **Popups and the ⋯ menu.** The next prompt.

## ♻️ Inherit (locked — reuse verbatim)
- **All eight atom families.**
- **The card frame, header and list row** from prompt 0.1a — a section may *contain* rows, and when
  it does it uses that exact row, not a variant.
- **The four control shapes** and **`--radius: 14px`** for container corners.
- **Rollup precedence** `red > yellow > blue > green > gray` — a section's rail chip shows the worst
  state inside it, whether or not that section is the one currently open.
- **The `--*-bg` tint tokens.** Outline chips gave up their tints in the atom pass, but **plates kept
  them** — the tinted header band is now the plate's own signature and nothing else uses it.

## The ask — one artifact, four questions

### 1. The plate's two forms — rail chip and open pane

**⚠️ Read this before designing: the section model is PAGED, not an accordion.** A section does *not*
sit in a stack of collapsible plates. It has exactly two presentations:

1. **Its rail chip** — the at-a-glance form, always visible on the rail whether or not the section is
   open: stamped label + its **rolled-up Signal** (the worst state inside) + its **primary Door**.
2. **Its open pane** — the body, shown **one section at a time** in the single content pane below the
   rail. Clicking a chip pages that section in.

There is **no collapsed-plate-in-a-stack state**, and no chevron doing accordion duty. The old
plate-stack grammar (colour stripe · label · summary · chevron → body) is the **superseded** model —
see the precedence note below.

So the "summary" question moves onto the **rail chip**: it is what lets someone see all eight sections'
states at once without opening any. Decide what the chip carries, how the label truncates, what it
shows when the section is empty, and how chip and pane stay visibly the same object.

> **⏱ Precedence — why paging, and don't flip it back.** This reversed twice, so the chain matters:
> ledger **#53** (2026-07-20) paging → spec **§2.0** (2026-07-21) accordion plate stack on desktop →
> **`prompts/prompt-01-detail-views.md`** (2026-07-25) **back to paging, and it is the newest**:
> *"The settled answer is a bounded, paging detail view driven by a section rail… no long scroll, no
> accordion stack."* The accordion lost because stacking every section open made records **far too
> tall** (the Customer ran ~5 phone-screens). Paging hides nothing **because** every rail chip shows
> its rolled-up Signal at rest — which is exactly what the accordion was chosen for in the first
> place. If you find yourself designing a collapsible stack, you have reverted to the 07-21 model.

### 2. The section's own state
A section reports the worst state of its contents on its rail chip. Decide **how loud that is allowed
to be.** Eight chips on one rail, three of them red, is a wall of alarm that reports nothing. Design
the calm case as carefully as the on-fire case — most sections, most of the time, are gray.

### 3. The body
What goes inside: a **key/value grid** for facts, a **row list** for contained records, and a
**free-form** slot for anything else. Design all three, and the rules for mixing them. Decide the
label/value alignment, what a missing value looks like, and how a long value wraps without breaking
the 24px control band.

**⚠️ A tall section scrolls INTERNALLY — it never blows out the card** (ledger #57; the worked example
is Customers' Invoices, which can hold hundreds of rows). So the section owns a max height and its own
scroll. Decide what that scroll looks like, where the boundary reads, and how a scrolled section still
shows that there is more below — the same anti-silent-cutoff problem the card frame solves at its hem,
one level down.

### 4. The section's actions — a Door **and** a graph button
Each section owns at most one **primary Door** ("Add Part", "Collect Payment", "Start Inspection")
plus optional secondary actions. Decide where it lives — in the header band or the body footer —
and what happens to it on the rail chip when that section is *not* the open one — the chip carries
the Door whether or not its pane is showing, which is what lets a dispatcher act without paging in.

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

## Two neighbours the section must not collide with

Both are Tier 1's to design, but they bound this one — so know they exist:

- **The landing section is the Signal summary, and it is labelled "To Do"** (ledger #54). Internally we
  call it Signal; **the user never sees that word** — component names are our vocabulary, never
  user-facing. So one chip on every rail is *the summary of the others*, and it is where the user
  lands on open. Make sure the chip grammar can carry that without needing a special case.
- **A persistent History-search footer sits under every expanded item, on all sections** (ledger #56)
  — it is **never paged away** when you move between sections. That footer is not yours, but it eats
  the bottom edge: **don't design a section footer that competes with it.** This is the main reason
  the section's primary Door may want to live in the header band rather than at the bottom.

Also inherited: **role sets the default landing section and the section order**, and a user's
**drag-resort persists per record-type** (ledger #55). So section order is data — never hard-code a
sequence into the design, and make sure a chip looks right in any position on the rail.

## The test the artifact has to pass
Put **eight** section chips on one rail — two red, one yellow, five gray — with one pane open. Can
you find the two that matter without reading a word? And does the rail read as a **table of contents**
for the record, or as a row of tabs you have to click through to learn anything?

## After you lock
The plate becomes an Inherit item for the detail view (Tier 1) and every per-card content prompt
(Tier 2). Tell me what you changed; I fold it into the kit and re-sync.
