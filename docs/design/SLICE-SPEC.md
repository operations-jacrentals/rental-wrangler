# Halo 9-Slice Spec — measured, verified, decided

**Date:** 2026-08-05 · **Source:** Figma reference PNGs at native size · **Method:** per-pixel band
measurement + adversarial re-render in headless Chromium at 320 / 380 / 700 / 1100 / 1500 / 2200 px
and at heights 131 / 300 / 700.

## The headline

**Four of the five panels failed first-pass verification. All four now have corrected numbers below —
use the CORRECTED numbers, not the originals.** Two panels also need an **art re-export** before any
slice can be correct, and one panel (`asm-deck`) **cannot be 9-sliced at all** below 1316px and needs
a second art variant. `asm-channel` passed clean and should stop being a 9-slice entirely — see the
CONDUIT RAIL decision.

---

## 1. Slice table (FINAL — corrected values)

| Panel | Source | top | right | bottom | left | repeatH | repeatV | Rhythm pitch | Confidence |
|---|---|---:|---:|---:|---:|---|---|---|---|
| `asm-housing` | 1171×151 | **62** | 147 | **81** | 150 | stretch | stretch | none (near-rhythm 460/440/459px — rejected) | high |
| `asm-deck` | 1335×151 | 28 | **221** | 20 | **1095** | stretch | stretch | none on the growable axis (3px scanline is inside the fixed left corner) | high |
| `asm-rowboard` | 470×97 | 0 | 66 | 0 | 56 | stretch | stretch | none H (tile is uniform in x — stretch is lossless); 3px scanline V (never rescales, slice V = 0) | **verified 2026-08-05** |
| `asm-headboard` | 241×141 | **43** | 47 | **59** | 30 | stretch | **round** | **3px** horizontal scanline, vertical axis, r = 1.00 @ lag 3/6/9 | high |
| `asm-btn-done` | 203×112 | **24** | 26 | **20** | **46** | stretch | stretch | none (hand-painted, no rhythm) | **verified 2026-08-06** |
| `asm-channel` | **39×140** | — | — | — | — | n/a | n/a | **not a slice — 39×4 `repeat-y` tile**; zero vertical variation | **verified 2026-08-05** |

Bold = changed from the first-pass proposal. Every bold number was re-rendered and re-measured, not
reasoned about.

**Repeat-mode rule applied throughout (ledger #257):** countable rhythm → `round`; continuous feature
→ `stretch`. Only `asm-headboard` has a countable rhythm on an axis that grows, and it is the only
`round` in the set.

---

## 2. Ready-to-paste CSS

Paths assume `assets/halo/`. Adjust the URL only — never the numbers.

### asm-housing — instrument housing (width-flexible, HEIGHT-FIXED)

```css
.halo-housing {
  box-sizing: border-box;
  height: 151px;              /* FIXED — see §4 */
  min-width: 650px;           /* fidelity floor; hard geometric floor is 297px */
  border-style: solid;
  border-width: 62px 147px 81px 150px;
  border-image-source: url("assets/halo/asm-housing.png");
  border-image-slice: 62 147 81 150 fill;
  border-image-width: 62px 147px 81px 150px;
  border-image-repeat: stretch stretch;
}
```

### asm-deck — group deck head (grows ONLY; hard floor 1316px)

```css
.halo-deck {
  box-sizing: border-box;
  height: 151px;              /* FIXED — vertical scaling moirés the 3px scanline */
  min-width: 1316px;          /* INTRINSIC floor — not a style choice */
  border-style: solid;
  border-width: 28px 221px 20px 1095px;
  border-image-source: url("assets/halo/asm-deck.png");
  border-image-slice: 28 221 20 1095 fill;
  border-image-width: 28px 221px 20px 1095px;
  border-image-repeat: stretch stretch;
}

/* Below 1316px the 9-slice is impossible. Scale the whole plate instead. */
@media (max-width: 1315px) {
  .halo-deck {
    border: 0;
    background: url("assets/halo/asm-deck.png") center / contain no-repeat;
    aspect-ratio: 1335 / 151;
    height: auto;
    min-width: 0;
  }
}
```

### asm-rowboard — row message board (HEIGHT-FIXED 97px, min 122px) — VERIFIED 2026-08-05

Source art `470×97`, text-free and slot-free (see ledger #268). The old `684×97 / 0 72 0 500`
numbers were measured off a **contaminated export** — two stray duplicate `Slots — signal row`
instances hung 189px off the left edge, making render bounds 683.4 wide. That 684 is where the
figure came from. Do not resurrect those numbers.

```css
.halo-rowboard {
  box-sizing: border-box;
  height: 97px;               /* FIXED — both chamfers run the full painted height */
  min-width: 122px;           /* geometric floor = 56 + 66; see note on practical minimum */
  border-style: solid;
  border-width: 0 66px 0 56px;
  border-image-source: url("assets/asm-rowboard-plate.svg");
  border-image-slice: 0 66 0 56 fill;
  border-image-width: 0 66px 0 56px;
  border-image-repeat: stretch;
}
/* State colour rides on masks, NOT on the plate — see "the plate is neutral" below. */
.halo-rowboard > b { position: absolute; inset: 0 -66px 0 -56px; display: block; pointer-events: none; }
.halo-rowboard .b-scr  { background: var(--row-hue); opacity: .14;
  mask-border: url("assets/asm-rowboard-screen-mask.svg") 0 66 0 56 fill stretch; }
.halo-rowboard .b-ring { background: var(--row-hue);
  mask-border: url("assets/asm-rowboard-ring-mask.svg")   0 66 0 56 stretch; }
```

**THE PLATE IS NEUTRAL — state colour is masked on top (fixed 2026-08-06, ledger #276).** The
first verified plate still had the row colour baked in: ring stroke `#FF4242`, screen wash
`#D63636`, and four gradients carrying `#FF4242` stops. The board physically could not follow the
row hue — an orange row rendered a red board. Slice geometry was correct; the colour contract was
not. Now `asm-rowboard-plate.svg` (1,506 B) is neutral steel + scanline only, and two masks carry
the hue: `asm-rowboard-screen-mask.svg` (211 B, the glass aperture at 14%) and
`asm-rowboard-ring-mask.svg` (232 B, the signal outline). **The masks 9-slice on the SAME bands via
`mask-border`, so they track the plate at every width.**

**`inset: 0` is wrong for a mask layer over a bordered box.** An absolutely-positioned child's
containing block is the PADDING box, so `inset: 0` sits inside the 56/66px borders and the ring
renders visibly inset from the plate. Use `inset: 0 -66px 0 -56px` to span the border box.

**Why the cuts are where they are.** The innermost feature is `ring core`, whose bottom-left
chamfer ends at x=49.85 and whose top-right chamfer begins at x=409.72 (→ 60.28 from the right
edge). Add its 2.8 stroke (1.4 each side) and its 0.81 σ blur, and the minimum safe cuts are
L≥53.7 / R≥64.1. Rounded up to **56 / 66** for margin.

**Why `stretch` and not `round`.** The scanline tile was decoded: 4×12px, and **every row is a
single constant colour across all 4 columns** — pure horizontal banding (8 rows clear, 4 rows
black @ 20%). There is no horizontal information to preserve, so stretching the centre is
*lossless*, and `round` would only risk a partial tile at the seam for no gain. Vertically the
3px pitch never rescales at all, because the vertical slice is 0 and the height is locked.

**SHIP ONE MASTER — `354:38` (470 wide). Do NOT also ship `21:19` (487.42 wide).** The two are the
same art at different scale (487.42/470 = 1.0371; chamfer insets are an identical 10.6% / 12.8% of
width in both). Shipping both defeats the entire point of a 9-slice, and `21:19` would need
`sliceR ≥ 66.32`, which this spec's `66` fails by 0.32px. Render the 470 master at 487.42 instead:
the borders stay at native scale and only the centre widens, which is exactly the intended
behaviour.

**Practical minimum vs geometric floor.** 122px is where the two borders butt and the centre
corridor is zero-width. It renders correctly but shows no screen. For a marquee (#266) budget
**≥240px** so there is a usable aperture for text to scroll through.

**Verification performed:** rendered at 122 / 180 / 240 / 380 / 470 / 700 / 1100 / 1600px against
a `preserveAspectRatio="none"` naive-scale control. Chamfers hold 45° and the ring stroke holds
constant thickness at every width; the control rakes the chamfers flat and balloons the stroke
by 1100px.

### asm-headboard — group headboard (width-flexible AND height-flexible)

Requires the **text-free plate re-export** (§3). Until that lands, this panel is not shippable.

```css
.halo-headboard {
  box-sizing: border-box;
  min-width: 77px;            /* left 30 + right 47 */
  min-height: 102px;          /* top 43 + bottom 59 */
  border-style: solid;
  border-width: 43px 47px 59px 30px;
  border-image-source: url("assets/halo/asm-headboard-plate.png");  /* TEXT-FREE plate */
  border-image-slice: 43 47 59 30 fill;
  border-image-width: 43px 47px 59px 30px;
  border-image-repeat: stretch round;
}
```

### asm-channel — conduit rail — VERIFIED 2026-08-05 (a TILE, never a slice)

**The rail is 39px wide, not 41.** The 41 came from a PNG measurement; the vector source has 13
stripes butting from x=0 to exactly x=39.000 with no gaps and every fill at alpha 1.0 (ledger #262).
Component is `39×140`, 875 bytes, clean — no nested components, no text, zero render overhang.

```css
.halo-channel {
  width: 39px;
  height: 100%;                                    /* any row count */
  background: url("assets/asm-channel-tile.svg") repeat-y top left;
  background-size: 39px 4px;
}
```

**Verification.** Rendered at heights 40 / 97 / 140 / 333.5 / 777.25px × DPR 1 / 2 / 3 — including
deliberately fractional heights, which is where `repeat-y` resampling would seam. **All 45
combinations clean: zero seam rows, max row-to-row delta 0.** The columns were then checked against
the expected stripe profile and matched **13/13 exact**, so the clean result is real and not a false
pass on a missing asset.

**Why 4px and not 1px.** Nothing in the art needs it — there is zero vertical variation, so a 1px
tile carries identical information. 4px is insurance against fractional-DPR edge sampling, and it
measured identically, so it costs nothing to keep.

**RECOLOURED to neutral steel 2026-08-06** (ledger #261, Jac approved) using hexes already present
in the rail, so the palette stays closed: `accent — core` `#FF4242`→`#4A4F56`, `accent — hot`
`#FF4242`→`#575D64`, `accent — well` `#9D0000`→`#1E1F22`. The value rhythm is preserved — groove
`#0C0C0D` → conduit face → shadow line → edge-lit `#7A828C` — so it still reads as a rounded
conduit in a groove, just no longer a lit one. **Re-verified after the recolour: 0 seam rows across
all 45 height×DPR combinations, stripe profile 13/13 exact.** The rail never tints; the elbow is
the branch point that carries the row signal.

**Noted alternative — a pure CSS gradient, no asset at all.** Because the panel is 13 solid vertical
bands, `linear-gradient(90deg, …)` with hard stops reproduces it *exactly* — measured
pixel-identical to the tile, 13/13 stripes, zero seams, at every height and DPR above. It drops the
image decode and makes recolouring a token swap. It is NOT the shipped form because art-pipeline
rule 1 says export art rather than recreating it in CSS; this is flagged as a deliberate, measured
exception for Jac to rule on, not taken unilaterally. Generated form kept at
`assets/asm-channel-gradient.css`.

### asm-elbow — conduit elbow (FIXED SIZE, tinted) — VERIFIED 2026-08-05

Not sliced. Fixed `224×157` (the frame is 223.43×156.29; Figma rounds the export up — use the
asset's own size). **This is the part that carries the row signal** — per ledger #252/#261 the
channel stays neutral steel and the elbow is the branch point where the row's colour surfaces.

Ships as **four stacked layers**, painted in Figma's own paint order:

```css
.halo-elbow { position: relative; width: 224px; height: 157px; }
.halo-elbow > i { position: absolute; inset: 0; display: block; }

.halo-elbow .l-under { background: url("assets/asm-elbow-plate-under.svg") no-repeat 0 0/224px 157px; }
.halo-elbow .l-well  { background: var(--row-hue-well);
                       mask: url("assets/asm-elbow-well-mask.svg")   no-repeat 0 0/224px 157px; }
.halo-elbow .l-sig   { background: var(--row-hue);
                       mask: url("assets/asm-elbow-signal-mask.svg") no-repeat 0 0/224px 157px; }
.halo-elbow .l-over  { background: url("assets/asm-elbow-plate-over.svg") no-repeat 0 0/224px 157px; }
```
```html
<div class="halo-elbow"><i class="l-under"></i><i class="l-well"></i><i class="l-sig"></i><i class="l-over"></i></div>
```

| Layer | Paths | Bytes | |
|---|---:|---:|---|
| `asm-elbow-plate-under.svg` | 2 | 5,277 | steel that sits BELOW the signal |
| `asm-elbow-well-mask.svg` | 2 | 2,315 | white silhouette → `var(--row-hue-well)` |
| `asm-elbow-signal-mask.svg` | 5 | 2,510 | white silhouette → `var(--row-hue)` |
| `asm-elbow-plate-over.svg` | 40 | 19,618 | steel that OCCLUDES the signal |

2 + 2 + 5 + 40 = **49 = the original path count.** Nothing was dropped in the split.

**Why two masks and not one.** The accent is two-tone — 5 paths `#FF4242` and 2 paths `#9D0000`.
A single mask flattens them, and luminance-encoding the darker tone into one mask cannot work: a
tint composited over any base can never reach `#9D0000`'s zero green/blue. Two masks let the shade
be its own token, and keep the choice of how the well behaves per state open.

**Why the plate is split in two.** Path order in the source interleaves steel and accent —
`steel(0,1) · well(2) · steel(3) · bright(4,5,6) · steel(7–24) · well(25) · bright(26,27) ·
steel(28–48)`. Bright paints above well in both clusters, and steel paints above the accent at
several indices. Collapsing all steel under all accent produced a **visible wrong-colour block**
(1,816 px reading `#9d0000` where the source is `#151618`). Splitting steel into under/over and
putting bright above well fixes it.

**Fidelity, measured.** The four layers recomposited with the source colours and pixel-diffed
against the unsplit original: **0.791% of pixels differ at all, max channel delta 36, only 0.031%
differ by more than 16.** All residual difference is anti-aliasing at shared edges — inherent to
splitting paths across compositing layers, since each layer antialiases against transparency
before compositing. No wrong colours remain. This is a *compare-by-distance* result, per
art-pipeline rule 1 — do not chase it to zero.

**Use explicit child elements, not `::before`/`::after`.** Pseudo-elements stack as first and last
child, so a real child element lands BETWEEN them — which silently put the signal mask above the
top plate on the first attempt.

### asm-cap — conduit end cap (FIXED SIZE, never tints) — VERIFIED 2026-08-05

```css
.halo-cap { width: 39px; height: 22px;
            background: url("assets/asm-cap.svg") no-repeat 0 0/39px 22px; }
```

**The asset is `39×22`, but the Figma frame reads `39×18.8`.** `clipsContent` is false and the
rotated fitting overhangs the frame bottom by 3px, so Figma expands the export to contain it.
**Size the cap at 22px, not 18.8px** — using the frame height squashes or clips the fitting.

**No mask, no tint.** The cap's 10 paths contain zero accent colours — only `#151618`, `#3D4146`,
`#575D64`, `#7A828C`. It is pure steel and stays neutral in every row state, which independently
confirms ledger #252: only the elbow carries the signal.

### asm-btn-done — "Button · Done" (FLEXIBLE ON BOTH AXES) — VERIFIED 2026-08-06

Figma `656:2235`, a GROUP of 8 painted vectors inside `Main item · FAILED board`. Export is
`203×112` (the group measures 202.16×111.82; Figma rounds up — use the asset's own size).
Clean: no nested components, no TEXT, zero render overhang, 3,004 B.

```css
.halo-btn-done {
  box-sizing: border-box;
  min-width: 72px;            /* 46 + 26 */
  min-height: 44px;           /* 24 + 20 */
  border-style: solid;
  border-width: 24px 26px 20px 46px;
  border-image-source: url("assets/asm-btn-done.svg");
  border-image-slice: 24 26 20 46 fill;
  border-image-width: 24px 26px 20px 46px;
  border-image-repeat: stretch;
}
```

**Why these cuts.** The art is a light-from-top-left bevel: `#686C6F` highlight along the top and
left, `#2B2E2F` / `#06080A` / `#171C1F` shadow along the bottom and right.
- **L = 46** holds the left bevel *and* both hand-painted scuff marks (x 11.94–26.46 and
  28.27–42.24). This is the band that carries the left-hand depth.
- **R = 26** contains the top-right chamfer, which runs (182.33, 4.37) → (200.35, 21.42) and so
  needs ≥ 20.67.
- **T = 24** clears that same chamfer vertically (it ends at y = 21.42).
- **B = 20, not 18.** The upper scuff spans y 92.80–95.14 and *straddles* an 18px cut, which would
  split it between the bottom-left corner and the vertically-stretching left edge. At 20 both marks
  sit wholly inside the corner and can never distort.

**Verification — the left band is byte-identical at every width tested.** Widths 120 / 160 / 203 /
260 / 340 / 500 / 760 px, each captured as its own element screenshot and compared against native:

| width | 9-slice left 46px band | naive-scale left 46px band |
|---:|---|---|
| 120 | **0.00% — identical** | 17.88% differ |
| 160 | **0.00% — identical** | 13.71% |
| 203 | identical (native) | identical (native) |
| 260 | **0.00% — identical** | 15.92% |
| 340 | **0.00% — identical** | 24.06% |
| 500 | **0.00% — identical** | 38.55% |
| 760 | **0.00% — identical** | **56.76%** |

The naive control degrades monotonically with width — the bevel thickens into a fat light band and
the scuff marks smear into streaks. The 9-slice does not move a single pixel of it.

The right 26px band (the chamfer) is identical at 6 of 7 widths; at 260px it differs by 1.49% with
**max channel delta 11**, scattered along the diagonal — anti-aliasing phase, not a slice error.

**Height verified too:** rendered at 112 / 140 / 190 / 260px. Chamfer size, bevel thickness and
scuff-mark position all hold; only the edges lengthen.

**No tint mask needed — this panel is state-neutral.** Its five colours (`#444A4C`, `#06080A`,
`#171C1F`, `#2B2E2F`, `#686C6F`) are all steel; there is no accent anywhere in it, so nothing
state-coloured is baked and it satisfies #276 on the state axis as well as the resize axis.

**Not a CSS border.** The paths are hand-drawn — vertices like `5.05355`, `13.9771`, `40.4747`,
`60.5476`, and edges that are deliberately not parallel. `border:` would produce mathematically
straight, uniform edges and discard exactly the painted quality that makes it read as art. The
narrow rule-1 exception in #272 covers art that is provably plain rectangles; this is not that.

**It is a GROUP, not a component.** Worth promoting to a component if it is going to be reused.

---

## 3. What FAILED verification, and what changed

### `asm-housing` — FAILED (vertical cuts bisected a real feature)

The proposed y-cuts 66/92 bracketed and then **cut through** the left-flank hairline tick. The tick's
true extent is rows **71–99** (29 rows), not the y72–85 that was claimed, so 21 of its rows sat inside
the stretch band and the y=92 cut landed mid-tick. Rendered at h=700 the tick smeared from a 29px stub
into a ~530px full-height rail with a visible kink.

**Corrected: `62 147 81 150 fill`, stretch stretch.** Only the y-cuts move (66→62, and the bottom cut
moves up so bottom = 151−70 = 81), which puts the whole tick inside the fixed bottom border. At native
151px the output is byte-identical to the source, so the fix costs nothing at rest.

Held up under scrutiny and unchanged: the x-cuts at **150 and 1024** are pixel-identical to their
neighbours over the full height, seam discontinuity is **0** at both boundaries at 700/1100/1500/2200,
and stretch/stretch is correct on both axes.

### `asm-deck` — FAILED (the border box cannot shrink)

Not a smear failure — a geometry failure. left 1100 + right 226 = **1326px of fixed border**, so
Chromium clamped the element to 1326px at every requested width of 320/380/700/1100. In a real 380px
container the panel spills 3.5× past it.

**This floor is intrinsic, not a bad cut.** For any 9-slice, left + right = sourceWidth − middleBand,
and the widest exact-uniform corridor in the entire painted area is **19px** — so the theoretical
minimum is 1335 − 19 = **1316px**. No cut lines rescue this asset at 1100px, let alone 320px.

**Corrected: `28 221 20 1095 fill`, stretch stretch** — uses the full 19px corridor instead of the
conservative 9px, verified pixel-perfect at 1335/1500/2200 (corners byte-identical, every stretched
column an exact copy of source column 1104), and lowers the floor from 1326 to 1316px. That is the
best these numbers can do.

**Second failure, vertical:** at h=300 and h=700 the whole 1100px left region stretches — chips become
ovals, PROMISED smears, and the 3px nameplate scanline moirés. **Pin the height at 151px.**

### `asm-rowboard` — FAILED (the fill region contained the baked wordmark)

> **SUPERSEDED 2026-08-05 — kept as a record of the failure, not as current guidance.** The
> analysis below is sound about the *proposal it rejected*, but it was reasoning about a
> contaminated 684×97 export. With the text stripped at export time and the stray slot rows
> hidden, the wordmark is not in the art at all and the fill region is clean glass end to end.
> Current verified numbers are in the `asm-rowboard` CSS block above.

The proposal claimed x250–617 was "one continuous band, max column diff 3/255". It is not: the baked
**"PROMISED"** wordmark sits at x353–489 inside that claimed band with column-to-column deltas up to
**178/255**. The proposal's own geometry paragraph contradicted its own uniformity claim.

Consequence, measured against the 4px reference letter stroke: 2.17× at w=1100, 3.29× at w=1500,
5.26× at w=2200 — an unreadable blur; and at w=380 the text is crushed to 0.146×, at w=320 it is
annihilated. Works at exactly one width — the textbook failure.

**Corrected: `0 72 0 500 fill`, stretch stretch.** left=500 swallows the chips, the bottom-left
chamfer, the ring's left vertical **and the entire wordmark** (text ends x489, so 10px clearance).
The centre fill becomes x500–611: 112px of verified-featureless glass (max column diff 4/255,
autocorrelation 0.186). Letter stroke now holds at 4px — pixel-identical to reference — at 700, 1100,
1500 and 2200.

Cost: hard **min-width 572px**. At declared 320/380 the element overflows to 572px, but the art stays
completely undistorted — a far better failure than crushing the wordmark.

### `asm-headboard` — FAILED twice (baked text + wrong repeat mode)

1. **Baked "FAILED" lockup smears at every width.** The warm pixels sit at x50–192, y54–87 —
   entirely inside the fill region. Measured red-run width vs the native 138px: 1.48× @320,
   3.80× @700, 12.93× @2200. **No slice numbers can fix this** — the text is horizontally centred
   and occupies 143px of a 241px plate. Asset defect.
2. **`repeatV: stretch` contradicted the proposal's own finding.** The 3px scanline is correctly
   identified as the one countable rhythm, on the vertical axis — and then stretch was specified,
   which is the opposite of what the operative test dictates. Measured: native period 3px, but 9px at
   h=300 and 25px at h=700. Texture destroyed.
3. The old y-cuts (32/32) made #2 unfixable — 77 growable rows, 77 % 3 = 2 (not phase-closed), and
   both one-off rail notches sat inside the growable band, so `round` would have tiled the notches.

**Corrected: `43 47 59 30 fill`, `stretch round`.** The cut at y=43 is the first row from which both
rails are mod-3 stationary; the cut at y=82 (bottom 59) puts both notches and both bottom chamfers in
the fixed corners. Growable band = rows 43–81 = **39 rows = exactly 13 scanline periods**, mod-3 drift
0/255 left rail, 3/255 right. Phase-closed, so `round` tiles it seamlessly. Verified: scanline holds
its native 3px period at h=300 AND h=700.

Held up and unchanged: left=30, right=47, repeatH=stretch. Both vertical cuts are **byte-identical**
column runs. The top rail stays flat with zero interior gaps and the rail break stays pinned at
exactly 43px from the right edge at all seven tested widths.

**Two factual errors in the original notes, corrected for the record:**
- There is **no drop shadow**. Measured alpha maximum in all four bleed regions is exactly **0**. The
  margin is empty transparent padding (7px top, 6px bottom, 4px left, 8px right). Keep the frame at
  241×141 anyway — trimming it moves every slice number — but there is nothing shadow-shaped to
  preserve.
- The x=194 cut is better than claimed: with text rows masked, columns 191–197 are byte-identical.

### `asm-channel` — HOLDS

Verified clean. All 131 rows byte-identical (max row-to-row delta **0**, per-column std **0.0000**).
Reconstruction error 0 at 41×131, 41×1, 41×7, 41×40, 41×600 and 60×300. No change to the numbers.

---

## 4. Panels that must be REDRAWN — do not hide these

| Panel | Problem | Verdict |
|---|---|---|
| `asm-headboard` | "FAILED" baked into the plate, dead centre | **Re-export a text-free plate.** Blocking — the corrected numbers do not pass without it. Group name becomes live DOM text over the panel. |
| `asm-rowboard` | ~~"PROMISED" baked into the plate~~ **RESOLVED 2026-08-05 — and it was never the real blocker.** | The label is a real `TEXT` node, so `visible=false` before `exportAsync` strips it with **no redraw** (ledger #263) — it was only 4.4 KB of a 664 KB export. The actual blocker was two stray duplicate `Slots — signal row` instances hanging 189px off the left edge (ledger #267/#268); hiding them took the export to 3.9 KB and dropped the floor from 572px to 122px. Verified numbers above. |
| `asm-housing` | **The interior staircase lives inside the stretch zone.** 5 jogs/diagonals at pitch 460/440/459 — a *near*-rhythm, not a repeat, with the first instance fused to the left cap and the last truncated by the right cap. It cannot be stretched (the 128×76 diagonal rakes 23° at w=1500 and 79° at w=400) and it cannot be `round`ed (no whole-tile count exists). | **REDRAW. Decision: option (a).** Move ALL diagonals, jogs and joints into x<150 / x>1024 and leave the middle as plain steel plus a straight horizontal groove. The ends carry the sculpting — which is what the yard data-plate reads like anyway. Do NOT attempt option (b) (a true seamless tile at integer pitch) — it costs more and buys a motif the language doesn't need. |
| `asm-deck` | Every piece of content — 3 chips, nameplate, "PROMISED" — is frozen in a 1100px fixed left corner. Widest uniform corridor in the whole 1294px painted panel is 19px. | **REDRAW.** Pull the chips and the nameplate OUT of the exported art into live DOM, leaving a plain steel shell with a wide uniform mid-run. sliceLeft then drops from 1095 to roughly 130 and the min-width drops with it. Until then: ship the corrected slice above **plus** the `contain` fallback below 1316px. |
| `asm-housing` (vertical) | No feature-free row band exists anywhere in the interior — the panel is decorated continuously y22–125. | Fixed-height part. A height change cannot be absorbed invisibly by any cut. |
| `asm-rowboard` (vertical) | Both 45° chamfers run the FULL 87px of painted height, as do the chip silhouettes — so there are zero horizontally-uniform rows in the side slice regions. | Height locked at 97px. If a variable-height board is ever needed, confine the chamfers to ≤12px corner notches so a uniform vertical band exists on both side edges, and flip repeatV to `round` (3px pitch). |

**Size contract — enforce these in CSS, they are not suggestions:**

| Panel | Width | Height |
|---|---|---|
| `asm-housing` | min 650px (hard floor 297px) | **fixed 151px** |
| `asm-deck` | min **1316px**, grows only | **fixed 151px** |
| `asm-rowboard` | min **122px** geometric, **240px** practical | **fixed 97px** |
| `asm-headboard` | min 77px | flexible, min 102px |
| `asm-channel` | **fixed 39px** | any (pure vertical extrusion — verified seamless) |

---

## 5. CONDUIT RAIL — the decision (ledger #257)

**YES. Ship `asm-channel` as one repeating tile. Stop shipping it as a 140px-tall image.**

> **Updated 2026-08-05:** the decision holds and is now render-verified, but the dimensions below
> are off — the rail is **39×140**, not 41×131. Both figures came from PNG measurements. See the
> `asm-channel` CSS block above for the verified form.

The measurement is unambiguous: **all 131 rows are byte-identical** (max row-to-row delta 0, per-column
std 0.0000 down every sampled column). The panel is a pure vertical extrusion of a single 41px
scanline, so 41×131 carries **zero** information beyond its first row. Ledger #257 already calls the
rail "a repeating run — author one tile and repeat it, so it serves any row count." The art agrees.

**Tile: 41 × 4 px.**
- Width 41px is the full cross-section and is fixed (see defect (b) below — it may become ~44px after
  a corrected re-export; re-measure then, do not guess).
- Height **4px**, not 1px. 1px is mathematically sufficient (verified: a 1-row tile re-tiles to full
  height with max error 0), but 1px tiles are where renderers do edge-sampling and half-pixel bleed at
  fractional devicePixelRatio. 4px is ~40 bytes of insurance.

**Seam requirement:** the tile's **last row must be pixel-identical to its first row**, and the tile
height must be an exact integer. Today that is trivially satisfied — every row is identical — so any
integer height seams perfectly. The requirement only becomes load-bearing if a vertical rhythm is
ever added: then the tile height must be an **exact multiple of the rhythm's pitch**, the tile must
start on the same phase it ends on, and the CSS must move from `background-repeat: repeat-y` to
`border-image-repeat: … round` so partial end-tiles are impossible.

**Render it with `background-repeat: repeat-y` and `background-size: 41px 4px`** — not `border-image`.
There are no corner features to protect (end caps come from `asm-elbow`, which is fixed-size and must
never scale, per #257), so 9-slice buys nothing here and adds a border box to reason about.

**Three authoring defects in the current rail export — fix before this becomes the canonical tile:**

1. **x=19 is a 1px fully-transparent full-height slot** between the dark red (#9d0000, alpha 64 at
   x=18) and the bright red (#ff4242, alpha 191 at x=20). Whatever is behind the rail shows through as
   a hairline. This is the classic Figma symptom of two shapes butted with a sub-pixel gap. Confirm
   whether it is deliberate; assume it is not and close it.
2. **The right edge is CLIPPED, not finished.** The profile terminates at x=40 at alpha 255 while still
   on a rising luminance ramp (…#33373b → #363a3e → #3d4146). The left edge by contrast fades cleanly
   to alpha 0. Classic "painted extent ≠ frame bounds". Widen the frame until the right ramp resolves,
   then re-measure the width.
3. **The accent is RED (#ff4242 / #9d0000), not the canon safety-orange `#ff7e1f`** — and a bright core
   against a transparent seam reads as *lit*, not matte. Two direct conflicts with the house language
   ("ONE safety-orange accent", "Matte — no glow"). **Decision: author the rail neutral and tint it per
   state at runtime.** That is also what makes one asset serve every state, per #257's "share one
   asset, tint at runtime."

---

## 6. What to author in Figma

These are the rules that keep the slices working. Break one and the panel breaks at every width, not
just at the edges.

**A. Reserve the uniform corridors. They are named, load-bearing, and thin.**

| Panel | Keep permanently free of decoration |
|---|---|
| `asm-housing` | **x 114–268** and **x 1014–1034** (vertical cuts); **y 60–71** and **y 86–98** on BOTH flanks, x<150 and x>1024 (horizontal cuts) |
| `asm-deck` | **x 1091–1117** — the 19px strip of plain steel between the nameplate's right edge (x1081) and the right chevron notch (x1114) |
| `asm-rowboard` | **x 56–404** — the whole screen corridor, now the text and slots are out of the art. This is the **marquee viewport** (#266): keep it absolutely free of decoration, scrolling glyphs pass through it. |
| `asm-headboard` | **x 30–194** free of decoration; **rows 43–81** free of ANY content on both side rails |
| `asm-channel` | n/a — it is a tile, not a slice. The whole 39px profile repeats; there is no corridor to protect. |

Give each of these a **named spacer frame in Figma** so it cannot be closed up by accident. The deck's
corridor has 5px and 4px of slack; a single stray drop shadow drifting into it breaks the head at every
width.

**B. Never cut through a feature — so never draw a feature where a cut must go.** A slice line lands
where adjacent columns (or rows) are pixel-identical. Anything crossing that line — a rivet, a groove, a
diagonal, a chamfer, a notch — smears at every rendered size, not just at extremes. Both the housing
tick and the rowboard wordmark failed exactly this way.

**C. Corners are for one-off hardware. Edges are for uniform runs. Middles are for nothing.**
- One-off features (end caps, chamfers, notches, rail breaks, bezel joints, pips) belong **inside a
  corner**, where they are never resampled. The deck's bottom-bezel joint at x1035–1042 and the
  headboard's rail break at x198–210 are correctly authored — they stay pinned at every width.
- A side edge grows on one axis only, so anything on it must be either continuous (a bevel) or a true
  repeating tile. **Never put a one-off feature on a growing edge** — that is exactly what forced the
  headboard's y-cuts to move: two rail notches sat where `round` would have tiled them N times.
- The **centre fill stretches on both axes.** Nothing legible, countable or diagonal may live there.
  Text NEVER lives there — it goes in live DOM on top. Two of five panels failed on baked text.

**D. Decoration relative to a tile boundary.** If a run must repeat, it has to be a genuine tile: one
motif, an **exact integer pitch**, identical at both tile edges, fully contained between the slice
lines, and the growable band must be an exact multiple of the pitch (phase-closed). The headboard's
39 rows = 13 × 3px is the model. A *near*-rhythm — like the housing's 460/440/459px staircase, with
its first instance fused to the end cap — is not a tile and cannot be rescued by `round`. Either make
it exact or move it into a corner.

**E. The middle band must be genuinely empty, not approximately empty.** During verification, an
imperfect text scrub left a faint red ghost in the headboard's growable band and `round` **tiled the
ghost visibly down the panel**. A scrub must be complete.

**F. Export at 1× / integer scale, at the full frame, with the padding intact.** The deck's art is
painted at x34–1328, y20–147 inside a 1335×151 frame — all four slice numbers include that asymmetric
transparent pad. Re-export at exactly the same frame size with the same padding or every number moves.
Fine features (2px bevel highlights, 3px scanline pitches) alias at fractional scale.

**G. If a chamfer grows, the slice must grow with it.** The headboard's three chamfers each need ~24px
of corner. Any chamfer that grows past its slice number puts a diagonal on a slice line.

**H. Anything with variable text is not artwork.** Chips, nameplates and group labels come out of the
export and into live DOM. That is the single change that would fix the deck, the rowboard and the
headboard at once.

---

## 7. Ledger rows to add

- **Housing interior:** the staircase moves to the end caps; the middle becomes plain steel plus a
  straight horizontal groove. Option (a), not (b).
- **Deck:** chips + nameplate leave the export and become live DOM; below 1316px the deck scales with
  `contain` rather than 9-slicing.
- **Rowboard / headboard:** all baked labels become live DOM text; plates export empty.
- **Conduit rail:** ships as a 41×4 `repeat-y` tile, authored **neutral** and tinted per state;
  `asm-elbow` stays a fixed-size cap and never scales. (Implements #257.)
- **Fixed-dimension contract:** housing 151px, deck 151px, rowboard 97px — height is not negotiable
  as drawn.
