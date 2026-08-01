# Steel v2 — the hybrid head, the steel cartridge, and lit glass

**Date:** 2026-08-01 · **Status:** approved in brainstorm, not yet built
**Scope:** the Tier-0.1 card's **steel** theme (`docs/design/tier-01-card/index.html`).
The `halo` skin is untouched — it stays as the comparison it was built to be.

## Why

The Halo skin proved the material taxonomy (#188) works as a finish layer: the whole
card reskinned without a single behaviour change. Jac took four ideas back out of it
and into steel itself. This spec is those four, plus the two rulings that fell out of
them.

---

## 1 · Texture — the olive grain, minus the colour

The olive tile's grain reads better than the current steel plate texture, but its hue
belongs to the Halo skin.

**Build** `steel-grain.png` — the same 512px procedural recipe as `halo-olive.png`
(mottle + fine horizontal grain + hairline scratches) with the olive constants pulled
to neutral warm-grey. Register it in the texture atlas and re-point steel's plate var
to it:

```
:root{ --rw-steel:url("steel-grain.png"); }          /* was steel-texture.png */
html[data-skin="halo"]{ --rw-steel:var(--h-olive); } /* unchanged */
```

All 13 inline chassis surfaces already route through `--rw-steel`, so this is a
one-line swap. `steel-texture.png` stays in the repo as a revert point but is no
longer referenced; the builder's atlas list drops it.

---

## 2 · Toggle — the well is inert; only the glass inside it lights

**The physics, stated first, because the first draft got this wrong.** A toggle is a
**milled steel well with a glass segment seated in it**. The well is steel, so by law
2 nothing about it may change in response to interaction — not on hover, not on
select, not on press. Every visible state change happens to the **glass**.

| State | What changes |
|---|---|
| Unselected | glass dark, text muted grey |
| **Selected** | the glass lights — orange rim drawn **inset within the glass's own edge**, orange text, faint bloom contained by the well |
| Hover | the glass wakes (law 4's flicker) |
| Press | the segment pushes **deeper into the well**; the well does not move |

The lit edge in Jac's reference is the glass panel's edge glowing, **not a line painted
on metal**. The rim is drawn **at least 1px inside the glass segment's own edge**, so
there is always unlit glass between the rim and the bezel and the two can never touch.
§7.2 asserts this geometrically rather than by eye.

Nothing changes size or position on select, so a row never shifts under the cursor.

**Applies to** all three control families: `WORK / OPEN / DONE`, `UNITS / CATEGORIES`,
and the sort + filter chips. One selected-state language across every control.

### 2.1 · The count is a floating SLOT, not a badge

Jac, 2026-08-01: *"It should be a floating slot."*

This is not an exception — it is two existing rules meeting:

- **`#177`** already ruled that **slots replace pins everywhere**, explicitly including
  the three filter chips. The count on `WORK` was the last surviving pin.
- **Law 8** already permits **slots to break physics**, and named *hovering over toggle
  corners* as the case it was written for.

So the count renders as a **slot floating at the toggle's top-right corner**, free to
overlap the steel bezel, carrying its own state hue (red for WORK, green for DONE —
a count is state, not accent). It unfurls on hover like every other slot (#177).

Because law 8 licenses the overlap, no new ruling is needed and no physics is bent.

---

## 3 · Glass — Halo's circuit surface, and a rule for its colour

The five glass elements take the Halo skin's circuit texture, scanline film and
stronger emission:

1. group-head board (`6 OPEN`, `NOMINAL`)
2. row board (`3D OVERDUE`, `DUE BACK`)
3. the drawer a row drops on open
4. the footer terminal rail
5. the search field

### 3.1 · Readouts cyan, controls orange

**`Cyan is what the machine tells you. Orange is what you touch.`**

- **Cyan** — head board, row board, drawer, footer rail.
- **Orange** (`--accent #ff7e1f`) — search field and caret, and every toggle from §2.

**This formally retires the one-accent rule for glass, and needs its own ledger row.**
Two reasons it is worth the cost:

- It **codifies what the card already does** rather than inventing a split. Today's
  resting board text is `#6a7684`, a lit board glows `#8fd8ff`, drawer lines glow
  `#7fd0ff` — while the search caret is orange. The split grew without ever being
  ruled; this rules it.
- **Separation.** The four state hues are red `#ff4242`, yellow `#eed44b`, blue
  `#6394cc`, green `#34d399`. Orange sits adjacent to red — at 8.5px mono on a black
  board, an orange glow and a red slot are hard to separate, and harder under
  red-green CVD. **Cyan collides with none of the four.** Making readouts orange would
  put the accent next to a state hue at the smallest type on the card.

---

## 4 · The head is a face plate; the row is a cartridge

Jac, 2026-08-01: *"Right now the group header doesn't appear to be a steel element, but
it should be… It is no longer only steel, it's a hybrid. The full steel cartridge moves
to the row."*

### 4.1 · Group head — a fixed steel face plate

Brushed grain, milled bevel, real edges. It must **read as metal at a glance**, which
it does not today. Composition:

- the **name is stamped into the steel** — no separate plate. This is `#189`'s
  A-strict, already locked: steel text holds its panel's colour, milled from the
  panel's own recipe.
- the **slots sit on it as studs**.
- the **message board is its single glass window** — the only inset (Jac's pick; the
  name plate and slot channel stay steel).
- it still **opens by MOTION** (`#168`), and the motion carries no light.

### 4.2 · Row — a seated steel cartridge, steel-faced always

The row reads as a **removable module inserted into the housing**: side rails, a seam
at the top edge, slightly recessed. Head and row are now both steel but never
confusable — one is a fixed face plate, the other a seated module.

**Open state:**

- the face **stays steel**. It never becomes glass and never emits. Its **message board
  remains a glass window set into that steel face**, exactly as the head's board is —
  the face being steel does not make its instruments steel. The cartridge is steel
  hardware with one lit window, same grammar as the head.
- a **glass terminal drawer drops beneath it** — that is where all the light lives.
- the **hue laser frame wraps the whole cartridge**. A frame is a light source, not a
  material, so no steel glows. `#172`'s "the frame carries the hue alone" survives.
- the row's **name stops glowing** when lit — it is steel now.

### 4.3 · The flicker belongs to the drawer

Jac, 2026-08-01: *"The flicker opening dance moves to the drawer as well, not at group
open."*

`#161`'s CRT power-on flicker moves off the row's face children and onto the **drawer**,
and it must fire **only when a drawer drops** — never when a group expands. Group
expansion mounts rows without opening drawers, so it must produce no flicker at all.

Implementation note: the flicker must be bound to drawer *creation*, not to a row being
present, or a rebuild/filter pass will replay it. The existing sweep already appends
`.rw-cartlines` only when absent, which is the correct hook.

---

## 5 · Ledger consequences

| Row | Effect |
|---|---|
| `#172` | **DEAD.** The lit cartridge's face is no longer neutral glass — it stays steel. The clause that the frame carries the hue alone **survives**. |
| `#161` | **RELOCATED.** The CRT flicker moves from the row face to the drawer, and is forbidden on group open. |
| `#168` | **REFINED, not reversed.** Two levels, two physics still holds: the head opens by motion, the row opens by dropping a drawer. What changes is that the row's face no longer changes material. |
| `#177` | **LANDS on the toggles.** The count pin becomes a slot — the last pin standing. |
| `#189` | **REINFORCED.** The head's stamped name is A-strict applied. |
| Law 8 | **First real use.** The floating count slot is the toggle-corner case the law was written for. |
| one-accent | **RETIRED FOR GLASS.** Needs a new row recording the cyan/orange split and the separation argument in §3.1. |

---

## 6 · Out of scope

- The `halo` skin — untouched.
- The A/B/C switches — untouched. The B axis (`#191`) stays open and orthogonal.
- The shared head/row board column — still `#174`'s wall, still deferred (`#196`).
- The group-head `+N` meter density flagged after the halo build.

---

## 7 · Verification

Playwright, both skins, before/after:

1. steel plate grain resolves to `steel-grain.png`; halo still resolves to olive.
2. selected toggle: the orange rim's box is strictly inside the glass segment's box —
   assert no overlap with the well's bezel rect.
3. toggle press: the segment's transform changes, the well's does not.
4. count renders as a slot at the corner, hover-unfurls, keeps its state hue.
5. glass: readouts compute cyan, search computes orange.
6. head: name is `background-clip:text` off the panel recipe (A-strict), board is the
   only child stamped `data-material="glass"`.
7. row lit: face `data-material` stays `steel`; drawer is `glass`; laser frame present.
8. **flicker fires on drawer creation only** — expand a group, assert zero animation on
   any row; then open a row, assert the drawer animates.
9. zero console errors; standalone build makes zero off-page requests.
