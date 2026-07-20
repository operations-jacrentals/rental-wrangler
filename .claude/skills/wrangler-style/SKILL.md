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
Text      --txt #eef2f7 · --txt-2 #aab4c1 · --txt-3 #717b89
Accent    --accent #ff7e1f · --on-orange #1a1205   (safety orange; dark ink ALWAYS)
Status    --green #34d399 · --yellow #ffe14d · --red #ff4242 · --red-fill #d63636
          --blue #6394cc · --gray #8b94a3
Action    --commit #2f6fd0   (deep blue: Save / +Add / write)
Leather   --tan #c2925a      (wrangler seasoning — tiny touches only)
```
**Light:** `--bg #e6e8ea · --panel/#card #fff · --line #cfd6e1 · --txt #141821 ·
--txt-2 #414b5a · --txt-3 #69727f · --accent #cf6000 · --red #d52a2a · --red-fill
#b5241f · --blue #2f5fb0 · --commit #1f56c0 · --green #0c8f5f · --gray #566072 ·
--yellow #ffe14d · --tan #8a5a2b`.

**The three forced picks (don't casually undo):**
- **`--red-fill #d63636`** for *filled* red — white text clears AA at 4.73 (bright
  `#ff4242` = 3.44, fails). Bright `--red` stays for outline chips / bars / dots.
- **`--yellow #ffe14d`** — the amber `#e0b13a` sat only 77 from orange under
  deuteranopia+protanopia sim; this is 103 (Jac is colour-blind — this is a gate).
- **`--blue #6394cc`** — muted so it stops fighting the orange (soften-complements).

Never `#000`/`#fff`. Fills always take dark ink (blue/orange/yellow/green); only the
deepened `--red-fill` and the `--commit` button carry white.

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

- **Signal** — coloured chip, read-only state; **colour = state, fill = today**;
  radius 8; dark ink on fill (filled red = `--red-fill`). Click → teleport to source;
  hover → explain + name the source.
- **Gate** — a Signal + a **leading, optically-centred SVG chevron that hugs the text**
  (≤2px gap). **No orange dot.** Opens a status picker.
- **Stamp** — a plain fact: **chip text, no box, no colour** (`--txt-3`), stamped
  voice. Sits beside a Signal as its quiet sibling. Budget overflow → `+N` (accent).
- **Ref** — a linked record: square **accent-tinted backing holding the parent's
  Lucide icon** + the name (body voice); radius 6; orange-marked = touchable. Not a
  status chip. Walks across cards.
- **Door** — a verb action, **radii = pill (999)**:
  - **Commit / create** → deep blue `--commit` (Save = solid; `+Add` = dashed outline).
  - **Takes money** → green. **Destructive-confirm** → red.
  - **The one quiet Cancel/Close** → **ghost** (transparent, `--line` border).
  - **Toggle active segment** → **orange** (`--accent`, dark ink).
- **Contact** — show the **phone number itself** as the `tel:` link (readable on
  desktop, tappable on mobile); email likewise. Honest-affordance: tappable ⇒ looks
  it; not ⇒ plain text. No fake hover-underlines.

## 4. Layout & structure

- **Keep where things are.** We reinvent look & function, not the map — the app's
  section order / placement stays. (Detail views proved this out.)
- **Plate grammar** — every section is the same repeated plate: left status-bar +
  stamped label + summary + status chip + chevron → expands to a body; header colour
  = the worst item inside (SIGNAL rollup).
- **Parked (approved-in-principle, not built):** detail views collapse to **inline,
  in-list expansion** — tap a row, it grows in place (~70%), you **page the sections**
  left/right; the **landing section is always the SIGNAL summary** (what's hot / your
  move). **Role sets the default landing + order; user can drag-resort, persisted per
  record-type.**

## 5. Voice — the wrangler/ranch seasoning

- Active, verb-first, ranch register: **Wrangle · Round up · Corral · Brand · Saddle
  up · Rein in.** An action keeps its name through the whole flow (button → toast).
- Restrained: leather-`--tan` touches only; copy carries the character, not the chrome.
- **Litmus:** if a glance reads "western" before "industrial rental yard," dial it back.

## 6. Open decisions (not locked)

- **Signature motif** — we did **not** re-adopt jactec-ui's hazard-stripe + rivets by
  default. If we want one bold signature beat, decide it here fresh. (Current builds
  are clean matte plates.)
- **Commit-blue exact** — `#2f6fd0` chosen (white clears AA 4.9); revisit if it reads
  too close to `--blue`.
- Any new colour/font/component decision gets **added here**, then re-checked against
  `style`'s numbers before it ships.
