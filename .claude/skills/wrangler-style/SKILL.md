---
name: wrangler-style
description: >-
  The DECISIONS home for Rental Wrangler's UI — the hard brand/design picks that
  the `style` skill's numbers constrain. This is the true replacement for the old
  jactec-ui skill. Holds the locked steel palette (exact hexes, dark + light), the
  two type voices, the button taxonomy, the Signal · Gate · Stamp · Ref · Door
  component vocabulary, the kept-structure layout rules, and the restrained
  wrangler/ranch voice. Reach for it whenever you build or restyle ANY UI to look
  up "which colour / which font / how does a chip/gate/stamp/ref/door look / what's
  our voice". ALWAYS pair it with `style` (the measurable rulebook): every UI
  decision here must also pass style's numbers, and when a decision and a rule
  conflict, the decision moves — not the rule.
---

# Wrangler-Style — the hard decisions

This skill is the **decisions registry**: the specific colours, fonts, component
looks, and voice we've actually chosen. `style` says what numbers a decision must
hit; **this skill says what the decision IS.** Any UI runs through **both**. These
values are ours and free to change — change them here, then re-check against `style`.

> Provenance: replaced `jactec-ui` (2026-07-20). We deliberately did **not** carry
> over its yard-data-plate signature wholesale — see §6. The space-cowboy / laser
> direction was explored and **dropped**: the app is **matte, no glow.**

---

## 1. Palette — locked (contrast + colour-blind checked)

**Dark (default):**
```
Surfaces  --bg #0a0d11 · --panel #171d25 · --card #12171e · --card-head #1a212b
Lines     --line #2c343f · --line-soft #212834
Text      --txt #eef2f7 · --txt-2 #aab4c1 · --txt-3 #838e9c
Accent    --accent #ff7e1f · --on-orange #1a1205   (safety orange; dark ink ALWAYS)
Status    --green #34d399 · --yellow #eed44b · --red #ff4242 · --red-fill #d63636
          --blue #6394cc · --gray #8b94a3 · --on-red-fill #fdfdfd
Action    --commit #2f6fd0 · --on-commit #fdfdfd   (deep blue: Save / +Add / write)
Leather   --tan #c2925a      (wrangler seasoning — tiny touches only)
```
**Light:** `--bg #e6e8ea · --panel/#card #fff · --line #cfd6e1 · --txt #141821 ·
--txt-2 #414b5a · --txt-3 #69727f · --accent #cf6000 · --red #d52a2a · --red-fill
#b5241f · --blue #2f5fb0 · --commit #1f56c0 · --green #0c8f5f · --gray #566072 ·
--yellow #eed44b · --tan #8a5a2b`.

**Dark-only — no light mode in shipped code (Jac, 2026-07-21).** The app has **no light
mode**; shipped code must **not** emit `@media (prefers-color-scheme:light)` or
`:root[data-theme="light"]` palette blocks. The Light hexes above are kept for reference only
(a light mode is not planned; don't spend effort on it). Old mockups carry vestigial light
blocks + pure `#fff` inside them — **strip them on build.**

**The three forced picks (don't casually undo):**
- **`--red-fill #d63636`** for *filled* red — near-white ink `--on-red-fill #fdfdfd`
  clears AA at **4.65** (bright `#ff4242` = 3.44, fails). Bright `--red` stays for outline
  chips / bars / dots.
- **`--yellow #eed44b`** — dimmed from the neon `#ffe14d` on request, but kept
  colour-blind-safe: it's the **dimmest** yellow that still holds **≥90** separation from
  *both* orange (93) and green (95) under deuter+protan sim. Darkening more breaks orange-
  separation; softening more breaks green — `#eed44b` is the floor. (Amber `#e0b13a` = 77,
  failed. Jac is colour-blind — this is a gate, don't dim past it.)
- **`--blue #6394cc`** — muted so it stops fighting the orange (soften-complements).

**Neutral-text floor (`--txt-3`):** nudged `#717b89` → **`#838e9c`** — the old value read
only **3.78–4.20** against `--card`/`--card-head` as body text, failing the 4.5 floor. The
nudge clears **4.87** on `--card-head` and **5.41** on `--card`. Nudged rather than
restricted to icons/borders, because `Stamp` (§3) uses `--txt-3` as real chip *text*, not
just an icon/border tint — though both old and new values already clear the 3:1 UI floor
for any icon/border use.

Never `#000`/`#fff`. Fills always take dark ink (blue/orange/yellow/green); `--red-fill`
and `--commit` are the one exception needing a light ink — but that ink is **near-white,
not pure**, which the rule already permits: `--on-red-fill`/`--on-commit #fdfdfd`. This
resolves the old claim ("white clears AA 4.73/4.9"), which silently assumed pure `#fff` and
broke this same never-pure rule. Verified with `#fdfdfd`: `--red-fill` → **4.65**,
`--commit` → **4.80** — both still clear the 4.5 floor, no rule exception needed.

**Palette is FROZEN — no new colours (Jac, 2026-07-20).** These ten tokens are the whole
vocabulary; a new surface **picks from them, never adds to them.** *"We can't have a
thousand different colours."* Adding one means cascading it across every field, chip, chart,
and status in the app — that cost is not paid casually. Known consequence, **accepted:** some
pairs fall under the `style` **≥90 CVD-separation** floor (blue↔grey ~45–48, blue↔green ~72,
green↔grey ~31–69 under deuter+protan sim) — those are disambiguated by **label + icon +
position**, not by inventing a colour. Fixing them is a **deliberate full-cascade project**,
never a one-off tweak inside a mockup. A surface that "needs another colour" is a surface
that needs a Signal/Stamp/icon distinction instead — solve it in the component layer.

## 2. Type — the two voices (fonts are a decision; sizes are `style`'s ladder)

- **Stamped voice** — a **monospace technical** face (`ui-monospace, "Cascadia Code",
  "SF Mono", Menlo, Consolas, monospace`), UPPERCASE, ~0.03–0.06em tracking, 700–800.
  Used for: section/field **labels**, **chips** (Signal/Gate/Stamp), KPI micro-labels,
  the eyebrow. (This is the crisp "data-plate stamp" look Jac keeps — not Saira.)
- **Body voice** — a clean **system sans** (`-apple-system, "Segoe UI", Roboto,
  system-ui, sans-serif`). Record **names** are body-voice **bold, sentence-case**
  (not caps). Values / prose are body-voice regular.
- **Numbers / IDs / timestamps** — monospace, tabular (`font-variant-numeric:tabular-nums`).
- Never a third family.

## 3. Components — the decided look

**The one rule underneath every component below:** status colour = *what* it is · orange
= *touchable* · deep-blue `--commit` = *commit* · everything else = plain honest text.
Nothing ever does two jobs — that's the whole reason Signal, Ref, and Door don't collide.

- **Signal** — coloured chip, read-only state; **colour = state, fill = today**;
  radius 7 (the ONE chip radius — see note); dark ink on fill (filled red = `--red-fill`
  + `--on-red-fill` ink). Three-tier read: **(1) colour + fill** = the instant
  at-a-glance state, **(2) the word on the chip** = what it is, **(3) hover / Tab-focus /
  long-press** = *why* and *what it stops*. Click → teleport to source.
- **Gate** — a Signal + a **leading, optically-centred SVG chevron that hugs the text**
  (≤2px gap). **No orange dot.** Opens a status picker.
- **Stamp** — a plain fact: **chip text, no box, no colour** (`--txt-3`), stamped
  voice. Sits beside a Signal as its quiet sibling. Budget overflow → `+N` (accent).
- **Ref** — a linked record: square **accent-tinted backing holding the parent's
  Lucide icon** + the name (body voice); radius 7 (its square shape + accent tint carry
  its distinction, not a different radius — chips use ONE radius); orange-marked = touchable. Not a
  status chip. Walks across cards. **EVERY linked record is a Ref, everywhere its name/ID
  appears** — unit · customer · rental · invoice · category — including a card's **own
  title/header**, not just inline body references; **never plain text**. The icon is that
  record's **type icon** (unit→unit glyph, customer→user, invoice→invoice…), **never one
  generic user icon for all** (a shared `ref()` that hardcodes the user glyph is the bug).
  *(Confirmed drift 2026-07-21: card titles + unit/invoice sub-rows rendered as plain text
  on list-views/detail-views — the same miss caught on Trips.)*
- **Door** — a verb action, **radii = pill (999)**:
  - **Commit / create** → deep blue `--commit` (Save = solid; `+Add` = dashed outline).
  - **Takes money** → green. **Destructive-confirm** → red.
  - **The one quiet Cancel/Close** → **ghost** (transparent, `--line` border).
  - **Toggle active segment** → the **filled Signal chip** of the selected option's status
    (colour = state) — e.g. a "do-now" option shows filled-yellow, a blocked one filled-red.
    Falls back to **orange** (`--accent`, dark ink) when the option carries no status.
    Applies to every toggle, incl. funnel tabs and the yard/staff segmented controls.
  (Commit/money/destructive are action colours, never status colours — no Door, chip, or
  button ever repurposes a status hue to mean "click me"; see `style` §6.)
- **Contact** — show the **phone number itself** as the `tel:` link (readable on
  desktop, tappable on mobile); email likewise. Honest-affordance: tappable ⇒ looks
  it; not ⇒ plain text. No fake hover-underlines.
- **Ledger** (Trips ETA-Tracker; Jac 2026-07-21) — a trip renders as a **dispatch-book
  ledger**, not a card: a list of stop rows joined by a connector spine. Borrows the
  **register / carbon-dispatch-ticket** look **as a LAYOUT only** — it is built from the
  SAME **two type voices (§2)** and the SAME **Signal / Gate / Stamp / Ref / Door** elements;
  the register inspiration **never replaces the fonts or the element designs** (Jac,
  2026-07-21: don't abandon the wrangler type families / element looks). **No per-trip
  header or footer** (Jac round-2) — the ledger is just its rows; the driver-reassign Gate
  rides the START (store) row. Row rules: **no tilted stamp** (zero rotation), **no customer
  photo**. Each row = **one address, possibly many units**; the **unit icon + unit +
  departure time** sit in an **outside-left prefix**, labelled the full word **"DEPARTURE"**
  (never OUT/DEP/RTN abbreviations). **Connector = the stop's ORDER NUMBER** (1·2·3…) once
  tripped — it aids talk-back ("stop 1 then stop 2") and survives drag-reorder; an **untripped
  / loose stop instead shows a BOX** ("schedule me!"); **Start/End anchors are inert** (no
  number, no box). **Untrip by DRAGGING the row away** — there is no click-to-untrip box.
  **Row order (left→right):** number/box · **stop-type glyph** (`HQ`/`↓`/`↑`) · **Gate** ·
  **Drive** (a first-class fact, its own column — never subtext under the ETA) · **ETA** ·
  **Town** · **Customer** (a **Ref**) · **Deadline** — where **DRIVE folds into the ETA line**
  as a first-class figure: **`+42MIN = 8:22 ETA`** (not a separate column, not a whisper).
  **BOTH the unit AND the customer render as Refs** (parent icon in an accent-tinted square
  backing + name; walk to that record) — never plain text. The **Gate is a canon Gate chip**
  — a Signal you can turn: the **soft Waiting `--blue`** chip + a **leading chevron** (NOT a
  deep `--commit` affirm pill; `--commit` is reserved for real **Doors** like Save/+Add). The
  chevron is what distinguishes a blue **Gate** (turnable) from a blue **Waiting Signal**
  (read-only), so the two can share `--blue` without colliding. Gray when the gate doesn't yet
  apply. **Town = the "True hyperlink ↗"** from the *Words, links & flags*
  elements artifact: ink + accent underline + a **trailing ↗**, opens off-app, deep-linking
  to Google Maps; **towns column-align with the deadline chips** (an aligned right pair). The
  **Gate IS the next action** (Start → Arrived? → Dropped?/Picked Up?) and reads as a **canon
  Gate chip — soft `--blue` + leading chevron**, gray when it doesn't yet apply. **Blue does
  NOT overload:** the **chevron** separates a blue **Gate** (turnable action) from a chevron-less
  blue **Waiting Signal** (read-only) — the same distinction the whole app uses; `--commit`
  stays reserved for real **Doors**. Deadline-Signal
  ladder = the **standard wrangler state colours** driven by schedule slack
  (`slack = deadline − ETA`), NOT a reassignment: **`--blue` = Waiting** (incomplete,
  `slack>2h`) · **`--yellow`** = near/due (within 2h) · **`--red`** = late (overdue) ·
  **`--green` = Done** (gate closed). **Green is Done only** — the earlier mockup that
  coloured on-time stops green broke this (an on-time, not-yet-worked stop is **Waiting =
  blue**, never green). Numbers/thresholds live in `style`.

## 4. Layout & structure

- **Keep where things are** — reinvent look & function, not the map; the app's section
  order / placement stays. (A working principle, proven out by the detail views.)
- **Plate grammar** — every section is the same repeated plate: left status-bar +
  stamped label + summary + status chip + chevron → body; header colour = the worst
  item inside (SIGNAL rollup).
- **Group taxonomy.** Every card's list groups are one of two kinds: **Attention groups**
  (e.g. Field Calls, Failed) exist and are coloured only because something is wrong —
  hidden entirely when empty. **Lifecycle groups** (e.g. On Rent, Reserved, Available) are
  always present, grey by default, and take colour only when a member inside triggers it —
  no group ever carries a fixed/native colour.
- **Groups are never named after status** ("Bad"/"To-Do") — that double-encodes what
  colour already says; a group name says *where* in the workflow, colour says *how much*
  it needs you.
- **Interaction & feature architecture is NOT decided here.** The inline-expand model,
  anchoring + item rails, section paging, cross-card cascade, linking, KPI placement,
  and mobile focused-mode live in the **feature spec** (`docs/superpowers/specs/`). This
  skill holds only the design *values* — palette, type, numbers, component looks, voice.
- **Sourcing boundary (Jac, 2026-07-21).** Every design decision is drawn from the
  **controlled canon** — the deep-research corpus, this skill, `style`, the design
  **artifacts**, and the feature spec. **Never reverse-engineer design from the live app**
  (`app.js`/`style.css`, `data-r` numbers, class names); if the canon is missing something,
  **STOP and ask Jac** rather than backfilling from the old site. Reading the app is allowed
  **only** when Jac explicitly directs it (e.g. "study invoices").

## 5. Voice — the wrangler/ranch seasoning

- Active, verb-first, ranch register: **Wrangle · Round up · Corral · Brand · Saddle
  up · Rein in.** An action keeps its name through the whole flow (button → toast).
- Restrained: leather-`--tan` touches only; copy carries the character, not the chrome.
- **Litmus:** if a glance reads "western" before "industrial rental yard," dial it back.
- **Component names are internal vocabulary, never user-facing.** Signal/Gate/Stamp/Ref/
  Door are how *we* talk about the pieces; the person using the app always sees plain task
  language (e.g. the Signal-summary landing tab reads **"To Do"**, never "Signal").

## 6. Open decisions (not locked)

- **Signature motif** — we did **not** re-adopt jactec-ui's hazard-stripe + rivets by
  default. If we want one bold signature beat, decide it here fresh. (Current builds
  are clean matte plates.)
- **Commit-blue exact** — `#2f6fd0` chosen (near-white ink `--on-commit #fdfdfd` clears
  AA **4.80**); revisit if it reads too close to `--blue`.
- Any new colour/font/component decision gets **added here**, then re-checked against
  `style`'s numbers before it ships.
