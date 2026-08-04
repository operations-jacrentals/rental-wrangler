# Open questions — interactive card rebuild

Logged while Jac was away, 2026-08-04. Everything here is a **guess I made to keep
moving**, not a blocker. Each one is cheap to flip; none of them is load-bearing for
the rest of the build.

---

## 1. Which card gets Gunmetal?

**Guessed:** Gunmetal = the Assembly / default colourway.

Jac named three of four — Deep Blued → Customers, Slate → Rentals, Charcoal → Units —
and left the fourth as *"whatever you call the Assembly color"*. Gunmetal is the
remaining one and is what the Figma assembly renders, so it is wired as the default.
If a fourth **card** was meant (Invoices? Work Orders?), it is a one-line alias swap in
`steel-skin.css` — the preset already carries both names.

## 2. How many subitem rows in the demo?

**Guessed:** three.

Enough to show the rail branching more than once and to stagger the slide-in, few
enough that the card still fits the frame without scrolling. The row count is markup,
not structure — the rail sizes itself to whatever is there.

## 3. Animation timing

**Guessed**, from *"the rail drops down while the rows slide in from the right, and as
the rows reach the elbows the rows power on"*:

| beat | value | why |
|---|---|---|
| rail drop | 420ms, ease-out | reads as weight settling, not a wipe |
| row slide | 360ms, ease-out, 90ms stagger | rows arrive in sequence, not as a block |
| row start delay | 160ms after rail starts | rail is visibly moving first, as described |
| power-on | 220ms, at slide end | fires per row as it lands, not globally |

The **order** is what Jac specified and is not a guess; only the numbers are.

## 4. What "power on" lights

**Guessed:** the laser contour only — `--row-hue` moves from `.row--off` grey to the
row's state colour. The steel body does not change.

This follows ledger #217 (*the laser follows the signal, the body never does*), which
is what makes the beat a single-token flip instead of a repaint. If Jac wants the
bulbs to light in sequence too, that is an additive step on the same timeline.

## 5. Does the deck row animate at all?

**Guessed:** no. The deck row is already present; only the subitem rail and its rows
animate in. Nothing Jac said implies the parent row moves, and animating it would
fight the "rail drops from it" reading.

---

## Not a question — a debt

The kit carries **three near-miss steel ladders**: the hex ladder in
`canon-colour-map.css`, the knob-driven ladder in `steel-skin.css`, and the four Figma
colourways. They are close but not equal, and it has already caused one real error —
a bulb bezel was "fixed" in Figma *away* from a CSS canon that was already correct.
Picking one source of truth is a design call for Jac, not a cleanup to do unattended.
