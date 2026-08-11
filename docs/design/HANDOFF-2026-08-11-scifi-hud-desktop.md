# Handoff — sci-fi HUD Card Header → full desktop screen (2026-08-11)

Written at the end of the 2026-08-09→11 sessions, for whoever picks this up next.
Companion paste-in prompt: `docs/design/NEXT-SESSION-PROMPT.md`.

---

## Where things stand

| | |
|---|---|
| Branch | `claude/scifi-hud-subitem-connect-wqzm3i` |
| PR | [#806](https://github.com/operations-jacrentals/rental-wrangler/pull/806) — **draft, open, unmerged** |
| Live? | **No.** Nothing from this branch has been deployed, merged, or promoted. |
| Figma file | `cc3TcK2F2a8qSbCAstzcA5` — *Rental Wrangler — Halo Elements Library* |
| Ledger rows | **#262–#277** are this branch's work. Read them before touching anything. |

The whole branch so far is **Figma + ledger**, not app code. No `app.js` / `style.css`
change has been made for the HUD. That matters for the desktop-screen job below: it is a
greenfield build, not a restyle.

---

## Jac's next four jobs, in his words

> "editing the size of the search bar which is way too big. I also want to stretch the
> background hex to the full card and actually start building the full desktop screen. I need
> the inverted grey hex grid behind the WORK OPEN DONE buttons."

### The target node

**`987:1726`** on the canvas Jac linked — `Group 38` → `Card Header` → `Plate · Body + Search
Well`, **1077 × 243.94**. It renders as: a red vent wedge at far left, a `Units | Categories`
toggle pair, a `WORK / OPEN / DONE` status cluster at right, and a full-width search well
across the bottom.

Named children worth knowing (there are two near-identical copies of the header on this
canvas — `987:1728` and `987:1957`; **confirm which one Jac is looking at before editing**):

| Node | Name | Size |
|---|---|---|
| `987:1728` | Plate · Body + Search Well | 1077 × 252.23 |
| `987:1936` | **Field · Search** | **762.76 × 59.05** |
| `987:1764` | Plate · Status Slab | 568.84 × 237.37 |
| `987:1940/1941/1942` | Label · WORK / OPEN / DONE | 144.82 × 63.27 each |
| `987:2168` | Globe Icon 1 [Vectorized] | 78 × 66 |
| `987:1943` | Funnel Button | 105 × 76.28 |
| `987:1950`, `987:1953` | Card Toggle Button | 234 × 79.5 |

### 1 · The search bar is too big

Measured off the **render**, not the frame boxes (`#263` — sample pixels, never infer from
geometry):

- toggle label `Units` cap ≈ **38px**, `Categories` cap ≈ **34px**
- search text `Search…` cap ≈ **48px**, and the well eats the bottom ~45% of the card
- the `OPEN` status label cap is **59px**, but that one is a deliberate status stamp

So the complaint is **proportional**: the placeholder is ~1.3–1.4× the toggle labels that sit
directly above it, in a well that already owns nearly half the card. Fix the ratio; don't
just scale the frame.

**The trap, and please do not walk into it.** `1077 = 3 × 359` exactly, and **359 is the
locked card-width anchor** (`#273`, worst-case iPhone SE). If this canvas really is the @3x
copy of that anchor, then `Field · Search` at 59.05 mockup px is **19.7 CSS px tall** — already
*below* the 24px Door height (`#274`) and far below the 44px touch floor. Shrinking it would
break both.

**Verify the scale before changing any size.** The header height argues against a naive
reading: 243.94 / 3 = 81.3 CSS px, but `#273` measured the real header at **359 × 44.0**. So
either this is a different, taller HUD header, or the canvas is not 3:1. Settle that first —
it decides whether "too big" means *shrink the type* or *shrink the well and keep the type*.
My read is that only the **type and the well's share of the card height** should come down,
and the field's hit box must stay ≥44px CSS.

### 2 · Stretch the background hex to the full card

The hex field is `#262`: a clipping frame `Backdrop · Hex field`, seated **above** the shader
plate and **below** the bars, holding `Grid · Hex lattice` (flat-top, 90% inset), `Grid · Lit
cells`, and `Trace · Gap link (cyan)` `#5fd0e0`.

Two rules govern any resize:

- **`#263` — one vector per role, never one node per cell.** The lattice is a single
  `createVector()` with generated `vectorPaths`. Extending it means regenerating that path
  data, not duplicating nodes. **And track `minX`/`minY` per chain** — Figma normalises a
  vector's bbox to its own content, so positioning two sibling chains off a shared `minX`
  silently offsets whichever one doesn't own it. That bug hid a whole red chain under the
  cyan one, with no error and no visible misalignment.
- **`#264` — the content pitch is the master, the grid is derived.** Row pitch 287px →
  `py = 287/3`, `R = py/√3 = 55.233`, so every gap presents an identical slice of lattice.
  If the card's rhythm sets a pitch, derive `R` from it. Never pick `R` and make the content
  move.

### 3 · Inverted grey hex grid behind WORK / OPEN / DONE

**This recipe already exists — `#268`.** Don't invent a second one.

> Inverted means the **cells are FILLED and the gutters read as the lines** — the reciprocal
> of the backdrop, where the outline is drawn and the cells are empty.

From that row, directly reusable:

- pitch is exactly **half** the backdrop's — `py = 287/6`, `R = 27.617` — so the two fields
  stay harmonically related rather than arbitrarily different
- layers inside a clipped frame, seated beneath the type: opaque panel ground → optional
  wash → `Hex · filled cells (inverted)`
- **an inverted field needs an opaque ground.** With `fills = []` the frame is a hole and the
  backdrop shows through — that is the Window option, which Jac rejected in favour of Display
- Jac wants this one **grey**. `#262` keeps the lattice neutral steel specifically so the
  bars keep the accent budget — so grey is consistent with canon, not an exception to it
- **measurement caveat, already paid for once:** a single-scanline autocorrelation *cannot*
  tell these two grids apart — the display's per-row period equals the backdrop's column
  pitch numerically. A bleed-through claim was made on that basis and was unsupported.

The status slab is `987:1764` (568.84 × 237.37); the three labels are `987:1940/1941/1942`.

### 4 · Start building the full desktop screen

This is the big one and it is **greenfield** — nothing HUD-shaped exists in `app.js` /
`style.css` yet.

**The desktop card is NOT full-width.** From `style.css:322-345`:

```css
.grid { display: grid; gap: 12px; padding: 12px 12px 4px;
        grid-template-columns: repeat(3, 1fr); grid-template-rows: 1fr; }
```

So **card width = (viewport − 48) / 3** — 24px of side padding plus 24px of inter-column gaps.

| Viewport | Card width |
|---|---|
| 1180 (the §4.4 desktop floor) | **377px** |
| 1440 | 464px |
| 1920 | 624px |

Breakpoints: **≤1024px** → 2 columns at 50% each (flex, scroll-snap); **≤640px** → 1 column.

The number that should shape the whole plan: **the desktop card at the 1180 floor is 377px —
within 5% of the 359px phone card.** The card is roughly the same width in both worlds. A
1077px-wide HUD header is therefore ~2.9× a real desktop card, and the layout has to survive
at ~377px, not at 1077. Design for the floor.

---

## Rules that will bite if you skip them

1. **`style` + `wrangler-style`, both, always** — every new or reshaped UI. `wrangler-style`
   holds the decisions, `style` holds the numbers they must satisfy. When they conflict, the
   decision moves, not the rule.
2. **Read the decisions ledger to the end before designing** —
   `docs/superpowers/specs/2026-07-20-decisions-ledger.md`. Rows #1–100 are a 07-20 snapshot;
   **#101+ supersede some of them**. Add a row when something is settled: *a decision is not
   made until it is in that table.*
3. **Scope: new/reshaped UI only.** Do not retroactively restyle the shipped site.
4. **Judge sizes at 100%, sub-pixel finish at ~300%** (`#273`). A screenshot zoomed past ~300%
   exaggerates 1px artefacts beyond anything a screen paints — that is how the `#276` stamp
   came to be wrongly reported as broken. And **never round a sub-pixel offset up to 1px** to
   make it visible.
5. **Sample the render, don't trust the frame** (`#263`). `absoluteRenderBounds` returns the
   frame box, not the painted extent. That error once put a trace on the wrong seam and cost a
   rebuild.
6. **Popup-first, single attempt** (CLAUDE.md). Every question goes through `AskUserQuestion`
   **once**; if that one attempt fails, fall back to the same question inline as A/B/C. Never
   retry the popup. Batch up to 4 questions and favour multiSelect.
7. **Ultracode is on for these sessions** — but this repo's system prompt also says not to
   spawn workflows/agents unless Jac asks. Ask before fanning out.

---

## Type: what is settled and what is still open

**`#277` (settled 2026-08-11):** the HUD canvas runs on **Chakra Petch + Oxanium**. Scope is
this canvas only — the shipped site's Archivo-body + mono-stamped pair is untouched.

The measurement Jac accepted along with it, because it changes how the pair should be used:

- `ChakraPetch-700` vs `Oxanium-700` = **0.751** — *above* the 0.70 same-typeface threshold.
  At bold, they are not separable by eye.
- `ChakraPetch-400` vs `ChakraPetch-700` = **0.582** — a family differs from its own bold by
  **more** than it differs from the other family's bold.

⇒ **The weight axis carries more separation than the family axis here.** Split the two across
weights (one bold/display, one regular/data). Splitting jobs by family at the same weight buys
nothing a reader can see.

**Still open, flagged in `#277`:** the FIELD CALLS wordmark is **Rajdhani Bold** (`#276`,
0.905 IoU), which now sits *outside* the pair — a third family. It measures 0.776 against
Oxanium Bold. Cheap to replace, and cheap-looking to keep. Unresolved: move it onto the pair,
or keep it as a wordmark-only exception.

**Unfinished edit, never applied.** Jac approved swapping six labels on the
`STAMP · steel depth — recipe` frame (`948:2914`, page *Experiment 1*) from Oxanium Bold to
**Chakra Petch Bold** — nodes `952:545/546/547` (13px row) and `952:549/550/551` (52px row).
The Figma write was **denied at the permission prompt and never retried**, so the file is
unchanged. Sizes stay at 13 and 52; cap shifts 9.0 → 9.1px, not worth compensating. The
frame's own caption still reads "Oxanium Bold 13px" and would need updating with it.

---

## Tooling you now have (and the cache you must rebuild)

`tools/design/font-match.py` — shape-matches a reference typeface against a candidate library
by per-glyph IoU. This is what identified Rajdhani Bold at 0.905 and produced every number in
`#277`. It was written in a session scratchpad, which does **not** survive; it is committed
now so the next identification costs minutes instead of a day.

```bash
python3 tools/design/font-match.py --fetch          # rebuild the 55-face cache (gitignored)
python3 tools/design/font-match.py ref.ttf          # rank candidates against a reference
python3 tools/design/font-match.py -a A.ttf -b B.ttf # compare two directly
```

Three things about it that are easy to get wrong:

- **Cap-height normalisation happens first**, always. Skip it and you measure point size, not
  shape, and every condensed face wins by accident.
- **Caps alone overstate similarity.** The same pair scores **0.805 on A–Z** but **0.751 on
  the full 62 glyphs** — these techno faces diverge mostly in their lowercase. Always say
  which set a quoted score came from. The default is the full 62.
- **Compare like weight to like.** Given the 0.582 self-comparison above, a "different family"
  conclusion drawn from a weight mismatch is worthless.

Score calibration, from this project's own runs: **0.90+** identification · **0.70** the
same-typeface threshold · **0.60–0.75** same genre, different face · **0.16–0.24** noise floor.

**Also unresolved from `#277`:** the two fonts Jac owns (Arame, Baksheesh) have **no licence
data embedded**, and onlinewebfonts repackages without carrying licences. Commercial use is
not cleared. Neither should ship until it is.

---

## Ledger rows to read before you start

**#262** hex field + cyan gap link · **#263** one-vector-per-role + the `minX` trap + measure
the render · **#264** content pitch is master, `R = py/√3` · **#268** the inverted display
field, half pitch, opaque ground · **#273** the 359px anchor, the 100%/300% rule, sub-pixel
offsets · **#274** Door = 24px, no size tiers, the slot hit-area gap · **#276** the stamp
recipe and the Rajdhani identification · **#277** the two-font pair and its cost.
