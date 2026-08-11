---
name: art-pipeline
description: >-
  How ILLUSTRATED UI gets out of Figma and into running code — the asset pipeline for
  artwork-heavy surfaces (the Halo assembly: deck, housing, conduit rail, elbows, boards,
  slots) where the interface IS artwork rather than standard components. Covers the three
  things that actually cross the Figma boundary (tokens, component identity, exported
  assets), why you EXPORT art instead of recreating it, how a fixed-size panel is made to
  fit any width — 9-slice via `border-image`, and the STRETCH vs REPEAT vs ROUND decision
  for edges, etchings and decorative runs — how to tint art per state without re-exporting
  it, what the artwork is allowed to WEIGH and COST at runtime (the three budgets in
  `docs/design/ART-BUDGET.md`), and the ten measured traps that have cost this project real
  time (Figma metadata lying about overridden instances, painted extent ≠ frame bounds, mask
  layers not pairing with background layers, sub-1% paths being the bevels, export
  quantization faking tone differences, an SVG export smuggling a raster inside it, and a
  Figma shader grain silently not surviving export). Reach for it whenever pulling a
  component out of Figma, building or fixing a panel that must resize, deciding whether a
  decorative run should stretch or repeat, deciding whether a texture asset is warranted, or
  when artwork looks flat, stretched, smeared, heavy, or stuck on one colour. NOT for choosing
  colours/fonts/shapes (that is `wrangler-style` + `style`) and NOT for laying out a screen.
---

# Art pipeline — Figma → running code, for UI that IS artwork

## 1. The thing to understand first

**In a normal product team, nobody pulls artwork out of Figma.** Handoff is fast because
three things cross the boundary and none of them is pixels:

| What crosses | How | Consumed as |
|---|---|---|
| **Tokens** | Figma Variables → JSON (Style Dictionary etc.) | `var(--accent)`, not `#ff7e1f` |
| **Component identity** | `Button/Primary` ↔ `<Button variant="primary">` (Code Connect) | you CALL it, never redraw it |
| **Art assets** | exported SVG/PDF/PNG | referenced, never recreated |

Fidelity is achieved by **not diverging** — the designer composes from a kit whose parts
already exist in code. It is not achieved by matching afterwards. An iOS build is
deliberately *not* pixel-identical: same tokens, same spacing, native controls.

**Rental Wrangler's Halo surfaces are the exception**, and this skill exists for that
exception. The deck, housing, conduit rail and elbows are not standard components — there
is no `<Button>` to call. The interface **is** artwork. The correct analogue is **game UI**,
and the game-UI answer is: **export the art; do not rebuild it.**

> Hand-rebuilding an elbow in CSS was tried on 2026-08-05. It failed the fidelity bar and
> cost hours. Figma's own `exportAsync({format:'SVG_STRING'})` produced a better result
> immediately. **Export first. Always.** Hand-authoring is the fallback, not the road.

## 2. The shape that works

**One shared asset, declared once, referenced N times.**

```css
:root{
  --asm-housing-image: url("data:image/svg+xml,…");   /* static steel, all tones baked */
  --asm-housing-laser-core-mask: url("data:image/svg+xml,…");  /* white silhouette */
  --asm-housing-laser-well-mask: url("data:image/svg+xml,…");
}
```

Marginal cost per instance ≈ **0 bytes**. Measured: 96 elbows across 3 cards = 37KB, against
1,268KB for one shipped Tier-01 card — **2.95%**. Inline SVG per row would have been ~60×
that: this is ledger **#233**'s "unsustainable by quantity", and it is what killed the bulb.

**Static art = ONE z-ordered `background-image` with real fills baked in, in Figma's own
paint order.** Anything that changes with state = a separate `mask-image` filled with
`var(--row-hue)`.

Do **not** build one mask per tone. Roughly half the regions overlap deliberately — darker
and lighter patches painted over a base to fake bevels — so an order-blind rebuild lets the
dark tone swallow the silhouette.

**Masking the element clips everything on it.** Steel + laser needs two layers: steel is the
element's `background-image`, the tinted laser rides on `::after`. Same for the elbow.

## 3. Making fixed-size art fit any width — 9-slice

Art is authored at one size. Panels must be any width. Scaling the whole thing distorts the
corners and smears the detail. **9-slice** is the answer, and CSS has it natively:

```css
.panel{
  border-image-source: var(--asm-housing-image);
  border-image-slice: 24 40 24 40 fill;   /* top right bottom left, in SOURCE px */
  border-image-width: 24px 40px 24px 40px;
  border-image-repeat: stretch;            /* ← see §4, this is the decision */
}
```

Corners stay fixed. Edges grow on **one** axis only. The centre (`fill`) covers the middle.
A machined chamfer at the corner keeps its exact angle at every width.

**Cut the slices where the art is uniform**, not at an arbitrary inset — a slice line through
a rivet or a groove will smear that feature. This is a decision made when the art is AUTHORED
in Figma, not only when it is consumed.

## 4. STRETCH vs REPEAT — the decision Jac raised

> *"Decor should always stretch, many times it should repeat."*

`border-image-repeat` takes the answer, and it can differ per axis
(`border-image-repeat: <horizontal> <vertical>`):

| Value | What it does | Use for |
|---|---|---|
| **`stretch`** | edge scales continuously | plain bevels, gradients, plain rails — anything with no rhythm |
| **`repeat`** | tiles at native size, **clips partial tiles at the ends** | textures where a cut tile is invisible |
| **`round`** | tiles, **scaling slightly so a whole number fits** | **etchings, rivets, dashes, any motif that must not be cut** |
| **`space`** | tiles at native size, distributes leftover as **gaps** | evenly-spaced decor where spacing may breathe but the motif may not scale |

**The rule for this project:**

- **Structure stretches.** A bevel, a plain edge, a smooth rail: `stretch`. Scaling a
  gradient is invisible.
- **Rhythm repeats.** Etchings, rivet runs, hazard ticks, grip knurling: **`round`**, not
  `repeat`. `round` is almost always the right pick over `repeat` — a half-cut rivet at the
  end of a run reads as a mistake, and `round`'s sub-pixel scaling to fit whole tiles is
  imperceptible where a clipped motif is not.
- **Use `space`** only when the motif's size is sacred AND uneven gaps are acceptable.
- **Mixed axes are normal:** `border-image-repeat: round stretch` — etchings tile
  horizontally, the vertical edge just scales.

**The conduit rail** is a repeating run by nature. Author one tile segment and repeat it
along the run rather than exporting a rail of a fixed length; the rail then serves any row
count. The **elbow stays fixed-size** — it is a cap/branch, not a run, and must never scale.

**Deciding, in one question:** *does the feature have a countable rhythm?* Countable
(rivets, ticks, etchings) → `round`. Continuous (bevel, gradient, plain edge) → `stretch`.

## 5. Tint without re-exporting

Colour that varies by state never gets baked. Export the coloured part as a **white
silhouette mask**, fill it with the token:

```css
.row__laser::after{
  mask-image: var(--asm-housing-laser-core-mask);
  background: var(--row-hue);                          /* hot core   */
}
.row__laser::before{
  mask-image: var(--asm-housing-laser-well-mask);
  background: hsl(from var(--row-hue) h s 31%);        /* deep well  */
}
```

The **well moves lightness only**. Mixing toward the background drifts grey and stops
reading as the same light source — measured at a 61-value miss (ledger **#236**).

Ledger **#217**: the laser follows the signal, the body never does. If a state colour is
baked into the steel, every instance is pinned to that colour forever — this is exactly what
happened when the housing shipped with 21 red elements baked in.

## 6. The ten traps — all measured, all cost real time

1. **Figma metadata lies about overridden instances.** `get_metadata` reports the
   *un-overridden component* position; the instance's real override differs. The conduit
   channel read 149px from metadata and was actually at 108px. Use `get_design_context`
   (or the instance's own transform) for anything instanced.
2. **Frame bounds ≠ painted extent.** `429:53`'s frame is 40×158 while its child sits at
   absolute (40,158) — outside it. `429:77`'s frame is 487×97, painted extent 683×97 offset
   193.93px left. **Render the node and LOOK at it** before building from it: one pass built
   an entire component from a 41×158 sliver believing it was the elbow.
3. **`mask-image` layers do not pair 1:1 with `background-image` layers.** They union via
   `mask-composite: add`, so only the topmost background ever shows. Use one z-ordered image,
   or separate elements.
4. **Sub-1% paths are the bevels.** Dropping ~40 of them collapsed the deck from 9 tones to
   6 and made the steel read flat. On the elbow, **32 of 33** sub-1% runs had a measurable
   visible cost when removed. Low area ≠ low value.
5. **Figma's PNG export quantizes translucent washes** into bands one channel value apart.
   Counting those as distinct design tones fails an asset for not reproducing a rasteriser
   artifact. **Compare tones by distance, not identity** — and cast to `int` before
   subtracting, or uint8 overflow turns Δ=1 into Δ=36 (this produced two false failures).
6. **Paint order is load-bearing.** The message-board ring is the *topmost* layer
   (`plate → screen → label → film → glow → ring`). Painting the ring before the opaque plate
   buries it — looks like a missing asset, is actually z-order.
7. **Baked text doubles with live text.** Export art WITHOUT text glyphs; let the DOM supply
   words. But strip only the glyphs — the inner outline usually lives in the same layer group.
8. **Layer names go stale.** `438:315` is named "Main item · FAILED board" and actually
   renders the group NAME. Trust the render, not the name.
9. **An SVG export can smuggle a raster inside it — decode it and grep for `<image`.** Audited
   2026-08-09: `asm-rowboard-image` embeds a 330x97 PNG that is **97.1%** of the asset and
   `asm-deck-image` a 316x88 PNG at **66.1%**. It is not texture — it is the slot ticks and the
   board screen, baked as pixels. Baked controls cannot be clicked (#250), cannot be recoloured to
   pass the CVD floor (#238/#248), and pin the slice band that stops the panel resizing (#260).
   Pulling them into live DOM takes rowboard 46KB -> ~1.4KB. A tiny tile in a `<pattern>` is fine
   and correct — headboard's 77-byte 4x12 scanline is the model; a 33KB one is a bug.
10. **A Figma SHADER paint does not survive SVG export.** `#223` says the steel body is a solid
   plus a shader at opacity .02 blend LIGHTEN, and that shader IS the machined grain. SVG has no
   shader primitive: `asm-housing-image` (33 paths) and `elbow-steel-image` (32 paths) carry no
   raster, no `<pattern>`, no `<filter>`. The tonal sculpt survives — the grain does not, on the
   two surfaces that repeat per row. Re-add it as a **grain overlay tile: one seamless <=256px
   square, lossless WebP, ONE `background-size`, ~2-5KB.** Never a photographic metal plate.

## 7. Performance shape

Everything that moves, moves by `transform`/`opacity` only. Measured at the 96-elbow worst
case: `LayoutCount: 0`, style-only recalc, **~60fps**.

An **animated** `filter: drop-shadow()` glow cost ~48fps against ~60 and was removed — the
mask + colour fill already reads as lit (ledger **#254**). A *static* glow on glass is fine;
animating one across many instances is not.

Because the art never stretches at runtime (it only moves), the browser rasterises each
shared asset **once** and reuses it. Resize is a re-render, which is allowed.

**The numbers live in `docs/design/ART-BUDGET.md`** (ledger **#262**) — read it before adding an
asset. The three things it says that this section does not:

- **There are THREE budgets, not one, and they have different multipliers.** Wire bytes scale with
  the count of *unique assets* (which is why "declared once in `:root`" wins). Decoded memory scales
  with the count of *distinct rasterised sizes* — the decode-cache key is `{image, mip level, filter
  quality, colour space}`, so one panel drawn at five widths costs five entries. That is what makes
  `#258`'s **fixed panel heights** a performance decision and not only a fidelity one. Frame time
  scales with *instance count × per-element paint ops*, and the shared-asset pattern does nothing
  for it.
- **Only ROWS multiply.** Card frames cap at 7, group headers at 23, the footer at 1, graph frames
  at 0 until opened — but rows are **60 at first paint (`VIRT_CAP`) and +200 per Show-more click**.
  So above ~24 instances: **`stretch` only** (`round` routes to `DrawImageTiled` plus a per-tile
  rescale) and **at most ONE mask layer** (`mask-image` is the slowest of 11 measured techniques,
  ~0.149 ms/element — 60 rows is ~8.9 ms, the entire 90 Hz frame, before the field phone's 4.4×
  multiplier).
- **Vector vs raster has a threshold now: ~26 paths** (measured 187 B/path gzipped). It is tighter
  on this project than elsewhere because **GitHub Pages serves gzip only — brotli is not offered**,
  so a complex SVG costs 168 KB here where a brotli host charges 37.6 KB. Percent-encode SVG
  data-URIs; base64 costs +431% gzipped against +0.24% for percent-encoding.

## 8. Checklist

- [ ] Exported via Figma's own SVG export, not hand-walked regions
- [ ] Verified painted extent by rendering and looking, not by frame bounds
- [ ] Static art: one z-ordered image, Figma's paint order preserved, no baked text
- [ ] State colour: white-silhouette mask + token fill; nothing state-coloured baked in
- [ ] Declared once in `:root`; marginal per-instance cost ~0 bytes
- [ ] Resizable panels use `border-image` 9-slice, sliced where the art is uniform
- [ ] Rhythm (`round`) vs structure (`stretch`) chosen per axis, deliberately
- [ ] Motion is transform/opacity only; `LayoutCount: 0` verified
- [ ] Tone check compares by DISTANCE with int casting
- [ ] `stretch` (not `round`) and ≤1 mask layer on anything that can exceed 24 instances
- [ ] Exported UNDITHERED; one 2× raster, never a 3× ladder
- [ ] Format per ART-BUDGET §6 — masks are lossless WebP or AVIF, **never** lossy WebP
- [ ] SVG data-URIs percent-encoded, never base64; exporter precision set (3dp→1dp = −28.9% gzip)
- [ ] Added to `sw.js`'s `SHELL`, with the version in the FILENAME (`?v=` cannot reach `assets/`)
- [ ] Surface budget from ART-BUDGET §5.1 not exceeded; running total still ≤ 900 KB
