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

> **⚠ SUPERSEDED by ledger #256 (2026-08-05).** The model below — *rail drops, then rows slide
> in FROM THE RIGHT* — is no longer current. Jac fused the elbow to its row: rows now hide
> BEHIND the group header and slide **DOWN** into place, so the elbows read as riding the
> channel down carrying the rows they are stuck to. The motion is vertical only. The stagger,
> the per-row power-on as each lands, and transform/opacity-only motion all carry over.
> The timings below are still the working values; the ORDER is what changed.

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

---

# style + wrangler-style audit — 2026-08-04

CLAUDE.md requires every new or reshaped UI to run through **both** skills. This
session built a bulb part, a conduit channel and a lettering treatment without
doing so; this is that pass, run as measurements rather than opinion.

## PASS

| Rule | Result |
|---|---|
| `style` §5 — never pure `#000`/`#fff` | **clean.** The only `rgba(0,0,0)` hits in `marks.css` are inside comments quoting the original shadow, not live CSS. |
| wrangler-style §1 — dark-only, no light block | **clean**, 0 `prefers-color-scheme: light` across all four sheets. |
| `style` §3 — text contrast ≥4.5 | **passes on all four colourways.** The debossed name `#dfe5ec` measures gunmetal **5.25**, blued **6.48**, slate **4.55**, charcoal **7.59**. Slate is the tight one — do not darken the face further without re-measuring. |
| wrangler-style §1 — frozen palette | **clean.** Every `--row-hue` is a canon token; the steel ladder and `--laser-well` are *derived* shades of existing tokens, which #219 and the `--red-line` precedent both allow. |

## FAIL — the bulb row encodes state in colour alone

`style` §3: *"Never encode meaning in colour alone — always colour + label + icon."*
`style` §4 requires co-occurring status colours to clear **90** separation under
deuteranopia and protanopia. Measured, for the five bulb states that appear in one row:

| pair | deuter | protan |
|---|---|---|
| blue / green | **72** | ok |
| blue / gray | **48** | **46** |
| green / gray | **31** | **69** |

Three pairs fail, one of them at **31**.

These exact failures are already known and *accepted* in wrangler-style §1 — but the
acceptance is **conditional**: *"those are disambiguated by label + icon + position,
not by inventing a colour."* The bulb as it stands has **no label and no icon**. It is
a bare coloured lozenge, so the condition that makes the palette failure acceptable is
not met here.

This is not a theoretical nit. wrangler-style states plainly: *"Jac is colour-blind —
this is a gate."*

**Not fixable by recolouring** — the palette is frozen and these pairs are the known
cost of that. It has to be fixed in the component layer, which is also what `style` §7
already says a Signal is: *"coloured chip, read-only state + a verbalising word +
parent-card icon."* The bulb is currently missing both halves of that.

Three ways out, for Jac to pick:

1. **Give each bulb its state glyph** — canon, matches the Signal archetype, costs a
   small icon per state. My recommendation.
2. **Fix the slot order** so position carries the meaning (slot 1 is always overdue,
   slot 2 always due…). Free, but only honest if the row really is a fixed ladder
   rather than a list of whatever states are live.
3. **Vary the mottle per state.** A texture is not a colour, so it survives CVD
   entirely. Cheap given the lens is already a texture — one extra ~5KB asset per
   state — and it would be genuinely distinctive. Worth considering alongside 1.

I did **not** guess this one. It changes what the bulb *is*, so it waits for Jac.

## FLAG — the bulb's 13px radius contradicts ledger #140

Ledger #140 (2026-07-28) reversed the four-shape radius ladder for the redesign:
*"`border-radius: 0` + chamfers and 45° notches… radii read as plastic against a
machined steel frame."*

`bulb.css` carries `--bulb-r: 13px`, because 13px is what the Figma artwork measures.
So the approved artwork and the locked rule disagree. `style` §1's own arbitration is
that *"when a decision and a rule conflict, the decision moves — not the rule"* — but
here the decision (the drawn bulb) and the rule (#140) are both Jac's. Left as measured
and flagged rather than silently squared, especially since he has been moving *toward*
square this session (the deck board 45° → 90°).
