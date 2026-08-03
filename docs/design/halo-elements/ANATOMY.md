# Halo Elements — anatomy of the canvas

This is the map you read before you touch anything in this kit. It says what is on the
canvas, where each piece really paints, which pieces share machinery, and which offsets are
lies — canvas coordinates masquerading as local ones.

**Source of truth:** `_ref/original.html` — 1194 lines, a 1292x635 absolutely-positioned
canvas. Never edit it.
**Reference image:** `_ref/original.png` — that canvas rendered at native size. It is a
*byte-exact* render of the HTML (`check.py _ref/original.html 1292 635 0 0` → mean delta
0.000, max 0), which is why the measurements below can be trusted.

### How the boxes here were measured

Not by eye, and not from the CSS. For every instance the markup was deleted from a copy of
`original.html`, the copy re-rendered, and the result diffed against `original.png`. The
bounding box of *any* changed pixel — delta > 0, not > some threshold — is exactly the
region that instance paints into, bloom, blur, glow spill, sub-pixel antialiasing and all.
Where an instance composites onto something else, that box is the region it *affects*,
which is the number you actually need.

**Coordinate convention throughout:** `x, y, w, h` in canvas pixels, `x`/`y` the top-left,
right edge = `x + w` (exclusive). So `x 394 w 635` means columns 394..1028 are painted.

---

## The canvas

| Band | Declared | Truly painted rows | Holds |
|---|---|---|---|
| **A** — loose parts | y 0..109 | **0..109** | C2a bars · C1a wide chip · C5a blank plate |
| *gap* | | 110..124 pure `--bg` | |
| **B** — the assembled thing | y 125..378 | **125..378** | the card: banner shell, header row, subitem row |
| *gap* | | 379..394 pure `--bg` | |
| **C** — loose parts | y 394..623 | **395..622** | C1d narrow chip · C3a conduit · C4a panel frame |

Rows 110..124, 379..394 and 623..634 are pure `--bg` (#0a0c10) end to end — verified
per-row. That is what makes band A and band C parts independently checkable: a verify box
that stays inside a band and clear of its neighbours contains the component and nothing
else.

**Band B reads as one card.** Its header row (y 125..241) is the banner shell + banner top
row + the red L bracket + the 7 clipped bars + the wide PROMISED chip + the FAILED plate.
Its subitem row (y 241..372) is the circuit field + the conduit + the sub-panel frame, with
the hex icon, the name, the 5 bars and the narrow PROMISED chip riding on the sub-panel.

**Stacking is pure DOM order.** There is not a single `z-index` in the document. Every
overlap below resolves by which element appears later in the markup, and nothing else.

---

## Shared machinery

### `tokens.css`
Lifted verbatim from the original: the reset (line 17), the whole `:root` block (19–53),
the `html, body` page shell (55–56), and the four clip-path primitives (64–86). The one
intentional change is `#stage` → `.stage`: an id pinned to 1292x635 becomes a class of any
size, so verify pages and assemblies can both use it. `font-kerning: none` moves across with
it and is **load-bearing** — the original's text metrics were fitted with it on.

Proven: rebuilding the entire canvas from `tokens.css` + the original's component CSS scores
**mean delta 0.000, max 0** against `original.png`.

Two primitives are defined but **never used** anywhere in the original: `.oct-br` and `.a`.
They stay in `tokens.css` as part of the verbatim lift; no part depends on them.

| Primitive | Used by |
|---|---|
| `.oct` (top-right + bottom-left cut) | c1 `.plate`, c1 `.inner` |
| `.oct4` (all four cut) | c5 `.body`, `.glass`, `.hair`, `.hair > i` |
| `.oct-br`, `.a` | nothing |

### SVG `<defs>` — two blocks, two sole owners

There are exactly two defs blocks on the canvas and **no component shares one with another**:

| Block | Lines | Contents | Owner |
|---|---|---|---|
| conduit defs | 843–884 | `clipPath#cd_clip`, **18** `linearGradient`s (`g_bar g_capl g_capr g_footl g_footr g_leg1 g_leg2 g_diag g_diagL g_runA g_runB g_elbT g_elbB g_plate g_platT g_platB g_ubar g_rchan`), `g#cd_art` (1 path + 17 polygons) | **c3 outright** |
| chip filter | 886–888 | `filter#chipSoft` — `feGaussianBlur stdDeviation=".81"`, region x −6% y −25% w 112% h 150% | **c1 outright** |

Both are referenced by hard-coded id (`<use href="#cd_art">`, `filter: url(#chipSoft)`), so
the ids must survive extraction. Where two instances of the same component sit on one page
they share the single def — do not duplicate the id.

---

## c1 — status chip

`.chip` + its `svg.ringlayer` stroke + the `#chipSoft` filter. A dark maroon plate under a
stroked neon octagon, with a warm bloom hanging off the bottom edge and a dark end-cap rail
at the right.

**CSS** 88–164 (`.chip` 93 · `.plate` 95–106 · `.bloom` 107–124 · `svg.ringlayer` 125–133 ·
`.inner` 134–150 · `.cap` 151–159 · `.label` 160–164)
**Markup** C1a 902–913 · C1b 981–995 · C1c 1141–1155 · C1d 1160–1172 (each chip div is
immediately followed by its own `svg.ringlayer`) · filter def 886–888

| Instance | Band | Painted box | Notes |
|---|---|---|---|
| **C1a** wide, unlabelled | A | x **394** y **24** w **635** h **67** | nominal plate 394,24.4 634.8x60.6; ring bbox 403..1019 × 31..84; `--fill:#05070b` |
| **C1b** PROMISED, wide | B | x **403** y **150** w **633** h **66** | nominal 402.6,150.4 633x60.5; ring 413..1027 × 157..211; label 27.9px, ls 1.35, pad-left 239 |
| **C1c** PROMISED, narrow | B | x **878** y **272** w **362** h **74** | nominal 877.5,271.5 362.5x70.1; ring 888..1232 × 278..340; label 29.5px, ls 0.15, pad-left 119 |
| **C1d** narrow, unlabelled | C | x **889** y **395** w **363** h **75** | nominal 888.6,394.6 363x71; ring 899..1244 × 402..464 |

**Shares:** `tokens.css` `.oct`. Owns `#chipSoft`. Nothing else.

**Verify box (C1a):** `x 385, y 4, w 660, h 104`. Confirmed clean — with C1a and its ring
removed, every pixel in that window is exactly `--bg`. Left edge 385 clears C2a (last
painted column 383); right edge 1045 clears C5a (starts 1063); bottom 108 clears the banner
(starts 125).

### Hazards

1. **`svg.ringlayer` is a sibling, not a child**, positioned at stage (0,0) at 1292x635, and
   its `<path d="…">` is written in **absolute canvas coordinates**. Four separate svgs
   (lines 913, 995, 1155, 1172). Every d-attribute must be rewritten origin-relative and the
   svg re-parented into the part root. This is the single biggest rebase in the kit.
2. **`.inner` derives its offset from two absolute vars**:
   `left: calc(var(--ox) - var(--px) - 1px)`, `top: calc(var(--oy) - var(--py) - 1px)`.
   `--ox/--oy` (outline centreline) and `--px/--py` (plate) are both canvas coords. Rebase
   them **together** or the interior box slides.
3. **Deliberate sub-pixel disagreement between `--ox/--oy` and the SVG path start.** These
   are measured fits, not typos. Do **not** harmonise them:

   | | `--ox` | path start x | `--oy` | path start y |
   |---|---|---|---|---|
   | C1a | 407.5 | 407.46 | 34.87 | 34.9 |
   | C1b | 416.9 | 416.9 | 160.85 | 160.87 |
   | C1c | 892.26 | **891.89** (−0.37) | 282.45 | 282.49 |
   | C1d | 903.2 | 903.2 | 406.35 | **406.21** (−0.14) |

4. **`.cap` overruns the plate box on all four instances** (`--capy + --caph > --ph` by
   5.0 / 5.1 / 3.4 / 3.9 px). `.chip` has no overflow clip, so the cap paints below the
   plate. A part root with `overflow:hidden` will silently eat it.
5. **`.bloom` hangs outside too**, via `top: 100%` on `.chip`, extending `--blh` px below.
6. `--stroke`, `--hw`, `--cw` are never overridden — all four rings are `#f85a5c`, halo
   3.8 @ opacity .90, core 2.8, `stroke-linejoin: miter`.
7. `.label` is positioned `left:0; right:0` + `text-align:left` + a **local** `padding-left`.
   Safe under rebase, but it needs `--mono` and `.stage`'s `font-kerning:none`.
8. C1b/C1c/C1d override `--cap0`..`--cap5`; C1a uses the rule defaults.

---

## c2 — segment bars

`.bars` / `.b` — skewed round-rects, bottom leaning right, with the vertical softness baked
into the fill gradient and the horizontal softness done with a small blur.

**CSS** 166–204 (`.bars` 169 · `.b` 175–180 · `.b.r` 181–188 · `.b.y` 189–196 ·
`.b::before` 198–203 · `.b.y::before` 204)
**Markup** C2a 893–899 · C2b 969–978 · C2c 1132–1138

| Instance | Band | Painted box | Bars | `--y / --h / --ft / --fb` |
|---|---|---|---|---|
| **C2a** 5 bars R R R Y Y | A | x **204** y **43** w **180** h **66** | lefts 215.0 247.4 279.7 314.1 348.9 | 44.6 / 61.6 / 12 / 14 |
| **C2b** 7 bars R R R Y Y Y Y, clipped | B | x **133** y **155** w **251** h **51** | lefts 141.5 179.0 215.5 251.0 288.0 324.5 360.0 | 155.5 / 50.5 / 7 / 7 |
| **C2c** 5 bars R R R Y Y | B | x **691** y **279** w **177** h **60** | lefts 700.7 732.7 765.2 799.7 834.2 | 282 / 55 / 7.5 / 8 |

**Shares:** nothing. No defs, no primitives.

**Verify box (C2a):** `x 188, y 26, w 202, h 98`. Confirmed clean.

### Hazards

1. **Every `left` on a `.b` is a canvas X.** `.bars` declares `position:absolute; top; height`
   and **no `left`, no `width`** — so its used left is the static position (0, the stage's
   content-box left) and its shrink-to-fit width is 0 (all children are absolutely
   positioned). The bars therefore lay out against canvas origin 0. All 17 `left` values
   across the three instances must be rebased. C2b is the same story stated explicitly:
   it sets `left:0; width:1292px`.
2. **`clip-path: inset(0 908px 0 0)` on C2b is a canvas-space clip.** On a 1292px-wide
   element it cuts at canvas x = 1292 − 908 = **384** — and C2b's measured painted right
   edge is exactly 384, so this is confirmed, not inferred. Rebased to a root of width `W`
   whose origin is canvas `X0`, it becomes `inset(0 calc(W - (384 - X0)) 0 0)`. The comment
   at 966–968 confirms it is intentional artwork: bar 7's right edge stops growing at 383
   from y=186 down while its left edge keeps skewing.
3. **The painted box is much wider than the sum of the bar rects.** `transform: skewX(18deg)`
   with the default `transform-origin: 50% 50%` throws the top edge left and the bottom edge
   right by `tan(18°)·h/2` — ±10.0px for C2a, ±8.2 for C2b, ±8.9 for C2c — and
   `filter: blur(1.4px)` adds roughly ±2.5px more on every side. Never size a c2 root to the
   nominal rects.
4. `--ft`/`--fb` are not decoration: they are the top/bottom fade lengths inside the fill
   gradient, and `.b::before` (the pale specular cap) is positioned at
   `top: calc(var(--ft) - 2px)`. Change `--ft` and the highlight moves with it.
5. The yellow variant overrides the specular cap (`.b.y::before`) to a warmer,
   more opaque ramp. Both `.r`/`.y` classes must survive on each span.

---

## c3 — conduit elbow

`.conduit` — a 209x125 inline-SVG elbow, drawn once into a shared `<defs>` and dropped twice
with `<use>`.

**CSS** 483–486 (`.conduit` 486 — three lines, that is the whole sheet)
**Markup** defs 843–884 · C3b 1105 · C3a 1175

| Instance | Band | Painted box | Notes |
|---|---|---|---|
| **C3b** in the banner | B | x **150** y **213** w **203** h **122** | nominal svg box 147,211 209x125; carries inline `filter: saturate(.9)` |
| **C3a** standalone | C | x **108** y **466** w **203** h **122** | nominal 105,464 209x125; no filter |

**Shares:** owns the conduit defs block outright (clipPath + 18 gradients + `g#cd_art`).
Nothing else on the canvas references any `#cd_*` or `#g_*` id.

**Verify box (C3a):** `x 90, y 450, w 240, h 155`. Confirmed clean.

### Hazards

1. **This is the cleanest component in the kit — nothing needs rebasing inside it.** All 18
   gradients are `gradientUnits="userSpaceOnUse"` in `cd_art`'s own coordinate space, which
   is already local, and `.conduit` already takes `--x`/`--y`. Only the two instance
   positions are canvas coords, and they are already variables.
2. **The art overflows its own viewBox on purpose.** Polygons run out to x=217 and y=136 and
   back to x=−9, y=−12; `viewBox="0 0 209 125"` plus `clipPath#cd_clip` crop them. Painted
   extent is inset ~3px/2px from the nominal 209x125 box. Do not "tidy" the polygon
   coordinates to fit — the crop is the shape.
3. **Two instances, one def.** Keep them as `<use href="#cd_art">` against a single defs
   block; do not inline the art twice.
4. **`filter: saturate(.9)` is a per-instance variant**, applied inline on C3b only. It is
   the whole visual difference between the two.

---

## c4 — panel frame

`.pframe` and ~40 `.pf-*` rules — a 914.5x125 dark metal frame with a recessed cavity, a
rail plate, a right-hand chrome edge and a red "C" bracket down the left.

**CSS** 233–455 (`.pframe` 240 · `.pf-body` 244–281 · `.pf-r0/r1/r2` 285–299 ·
`.pf-r122/123/124` 300–314 · `.pf-railL/R` 316–328 · `.pf-cav` 331–341 · `.pf-cavr` 343–362 ·
`.pf-rmar/rface/riv` 365–380 · `.pf-lside` 383–388 · `.pf-fct/fcb` 389–403 · `.pf-lbev`
404–408 · `.pf-lface` 409–417 · `.pf-chT` 418–422 · `.pf-brk*` 424–443 · `.pf-bl*` 446–455)
**plus** `.pf-lift` 457–472 (C4b only)
**Markup** C4b 1108–1121 · C4a 1178–1190

| Instance | Band | Painted box | Notes |
|---|---|---|---|
| **C4b** banner sub-panel | B | x **348** y **245** w **915** h **127** | `--x:348.3 --y:246 --w:915.2`; has the extra `.pf-lift` child |
| **C4a** standalone | C | x **344** y **496** w **915** h **127** | `--x:344 --y:497 --w:914.5`; no lift |

C4b is exactly C4a translated by (+4.3, −251), per the comment at 1107.

**Shares:** nothing. No defs, no primitives.

**Verify box (C4a):** `x 330, y 478, w 944, h 157`. Confirmed clean — clears C1d above
(last painted row 469) and C3a to the left (last painted column 310), and runs to the canvas
bottom edge.

### Hazards

1. **This is the one component already authored origin-relative.** The comment at 236–238
   states the coordinate system outright: `.pframe` origin = (344, 497) for C4a, every child
   offset = absolute reference px minus that origin. No child needs rebasing.
2. **But the widths are baked to a ~910px body and do not scale.** `.pf-railR { left: 807px }`,
   `.pf-cav { left: 31.5px; right: 18px }`, `.pf-riv { left: 896.5px }`, and every `.pf-r*` /
   `.pf-bl*` 90deg gradient runs stops out to 910px. The two instances differ by 0.7px of
   `--w` and are otherwise identical inside. `height` is hard-coded 125px — only `--w` is a
   variable.
3. **Painted height is 127, not 125.** `.pf-blt { top: -1px }` and `.pf-blb { top: 125px }`
   are siblings of `.pf-body`, so they escape its clip-path and paint one row above and one
   row below the nominal box.
4. **`.pf-lift`'s selector is not namespaced** — it is a bare `.pf-lift`, unlike every other
   rule in the block. Namespace it when extracting.
5. **`.pf-lift`'s DOM slot is load-bearing.** In C4b it sits *inside* `.pf-body`, between
   `.pf-lbev` and `.pf-lface` (line 1116), so `.pf-lface` and `.pf-chT` paint over it and
   `.pf-body`'s clip-path crops it. It exists only to replay the +6/+7/+7 composite lift the
   semi-transparent panel art picks up from the banner's lighter backdrop — it is a
   *backdrop compensation*, not a decoration, and it is the entire difference between the
   two instances.
6. **`.pf-fct`/`.pf-fcb` bake `#0a0c10` (= `--bg`) into their gradients** as the fade-to-nothing
   colour. They assume a `--bg` backdrop; on any other backdrop they will read as a dark halo.
7. `.pf-brk` (the red C bracket) is a sibling of `.pf-body` carrying `filter: blur(.45px)` on
   the whole group, so it is **not** clipped by the body silhouette.

---

## c5 — display plate

`.oplate` — an octagonal screen: dark body, inset glass with a scanline overlay, and a 1px
cyan hairline ring.

**CSS** 206–231 (`.oplate` 209 · `.body` 210–213 · `.glass` 214–217 · `.glass::after`
218–221 · `.hair` 223–227 · `.hair > i` 228–231)
**Markup** C5a 916–921 · C5b 998–1006

| Instance | Band | Painted box | Vars |
|---|---|---|---|
| **C5a** blank | A | x **1063** y **0** w **219** h **110** | `--hx:9 --hy:9 --hw:192 --hh:88`, `--glass:#191720` |
| **C5b** "FAILED" | B | x **1063** y **136** w **222** h **106** | `--hx:11.5 --hy:8.5 --hw:193 --hh:88`, `--glass:#040910` |

Both painted boxes are exactly the nominal boxes — c5 has no spill at all.

**Shares:** `tokens.css` `.oct4`. Nothing else.

**Verify box (C5a):** `x 1045, y 0, w 247, h 124`. Confirmed clean. Note the plate touches
canvas **row 0**, so there is no top margin to give — that is correct, not a clipped box.

### Hazards

1. Structurally clean: `.oplate` already takes `--x/--y/--w/--h` and every child is
   inset-relative. No canvas coordinates inside.
2. **The hairline ring is measured and asymmetric.** `--hx/--hy/--hw/--hh` differ between
   instances and are *not* centred in the plate. Do not re-derive them from the plate size.
3. **`--cut` is hard-coded per layer and does not scale** with `--w`/`--h`: body 19px,
   glass 15px, hair 12px, `hair > i` 11.4px.
4. **`--glass` feeds two elements** — `.glass` and `.hair > i`. Changing it moves both.
5. **C5b's "FAILED" text has no class and no rule.** It is a raw div with a wholly inline
   style block (1003–1005): `--mono`, 700, 40.4px, line-height 1, letter-spacing −0.1px,
   `#f4595a`, `text-shadow: 0 0 6px rgba(244,95,91,.40)`, at local (38, 32.7). It must become
   a real class in the part sheet, carried across value-for-value.
6. c12's rivets land on top of C5b — see the overlap map.

---

## c9 — circuit field

`.circuitfield` — the etched copper field under the header row: four stacked background
layers, an inline SVG of traces and pads, and a block of micro technical text.

**CSS** 768–808 (field 774–801 · `svg` 803 · `.cu` 804 · `.cuf` 805 · `.cud` 806–807 ·
`.halo` 808) **plus** `.microtext` 810–823
**Markup** field + traces 1013–1089 · microtext 1091–1102 · 1 instance, band B

| Instance | Band | Painted box | Notes |
|---|---|---|---|
| **C9** | B | x **11** y **241** w **341** h **135** | exactly the nominal `.circuitfield` box |
| ↳ `.microtext` | B | x **30** y **321** w **108** h **44** | wholly inside the field; local offset (19, 80.35) |

**Shares:** nothing structurally, but see hazard 4 — it is coupled to three neighbours by
baked-in light.

**Verify: null.** Band-B-only — no loose instance exists on plain `--bg`, and the component
composites against the banner face. **Verified during the assembly phase instead.**

### Hazards

1. **`.circuitfield` hard-codes `left: 11px; top: 241px`** with no `--x`/`--y` vars.
2. **The mono text block is a detached sibling.** `.microtext` (markup 1091, CSS 810–823)
   lives outside `.circuitfield` at canvas `left:30px; top:321.35px`. It must be re-parented
   into the c9 root at local (19, 80.35).
3. The inline SVG is already local — `viewBox="0 0 341 135"` pinned `left:0; top:0` inside
   the field, and the markup comment says "svg units = px, origin = ref 11,241". The traces,
   pads and fills need **no** rebasing.
4. **Three of the four background layers replay light cast by other components**, baked in as
   gradients (the header comment at 768–773 lists them bottom-up):
   - layer 3 = the warm shadow cast by **c11's `.bt-div`** along the top edge,
   - layer 2 = **c3's C3b** ambient red wash over the right half,
   - layer 1 = light spilling up from **c4's C4b** sub-panel rim below y=347.

   Extracted alone c9 still *looks* right — the gradients are self-contained — but the part
   is not independent of its neighbours. Move C3b, C4b or C11 and c9's baked light is wrong.
5. `.microtext` line rhythm is fragile: pitch 4.55px, glyph band 3px, one line carries an
   inline `top:.55px` nudge (1094) and one is a bare `&nbsp;` spacer (1093). Both are
   load-bearing. `.microtext > div::before` draws the 2.4x2.15px gutter block.
6. c9 paints **before** c3's C3b and c4's C4b, both of which overlap it.

---

## c10 — banner top row

`#btr` and its `.bt-*` children — the frame rims, band stack, graph well, slate texture
panel, seam, ramp, notch, gutters and the exposed face strip. Every colour in it is a
measured per-scanline value.

**CSS** 520–719 **and** 750–766 — i.e. the whole block **except 721–749, which is c11**
**Markup** 932–962, **except 956–959, which is c11**
1 instance, band B.

| Instance | Band | Painted box |
|---|---|---|
| **C10** | B | x **13** y **125** w **1268** h **116** |

The box is the same with or without the c11 rules removed — `.bt-face` (top 143, h 98)
already reaches row 240.

Its 22 children, in DOM order, as declared (canvas `left`/`top`/`w`/`h`):

| | left | top | w | h | | | left | top | w | h |
|---|---|---|---|---|---|---|---|---|---|---|
| `.bt-top` | 13 | 125 | 1268 | 18 | | `.bt-slate` | 72 | 143 | 143 | 85 |
| `.bt-face` | 13 | 143 | 1268 | 98 | | `.bt-gut` | 13 | 142 | 11 | 71 |
| `.bt-mod` | 13 | 143 | 1268 | 14 | | `.bt-gutcap` | 13 | 136 | 13 | 6 |
| `.bt-band2` | 13 | 157 | 1268 | 14 | | `.bt-gutlow` | 13 | 213 | 11 | 16 |
| `.bt-fallA` | 800 | 129 | 481 | 11 | | `.bt-welltop` | 36 | 139 | 37 | 4 |
| `.bt-fallB` | 1000 | 140 | 281 | 3 | | `.bt-well` | 38 | 143 | 33 | 73 |
| `.bt-bev` | 73 | 138 | 150 | 5 | | `.bt-welledge` | 37 | 142 | 1 | 73 |
| `.bt-seam` | 224 | 151 | 814 | 13 | | `.bt-wellr` | 71 | 143 | 1 | 73 |
| `.bt-right` | 1038 | 143 | 20 | 85 | | `.bt-graph` | 37 | 143 | 36 | 73 |
| `.bt-ramp` | 203 | 134 | 24 | 31 | | `.bt-warm` | 33 | 143 | 4 | 86 |
| `.bt-notch` | 662 | 144 | 14 | 5 | | `.bt-rivet` | 13.5 | 232 | 7 | 7 |

**Shares:** nothing. No defs, no primitives.

**Verify: null.** Band-B-only. **Verified during the assembly phase instead.**

### Hazards

1. **`#btr { position: absolute; inset: 0 }` is the FULL 1292x635 stage**, not the banner.
   Every one of those 22 `left`/`top` pairs above is a stage-absolute canvas coordinate.
   All of them must be rebased. This is the largest mechanical rebase in the kit.
2. **`.bt-graph` carries a canvas-space `viewBox="37 143 36 73"`** *and* a polyline whose
   points are canvas coordinates (`37.5,172.6 40,172.6 62,157.6 71.6,148`). Both the viewBox
   and the points have to be rewritten.
3. **The `.bt-*` rules declare no `position` of their own** — they rely on
   `#btr i { position: absolute; display: block }` (line 526). `.bt-ramp b` and `.bt-graph`
   are the two exceptions that declare their own. Drop the `i` rule when namespacing and
   every child collapses into static flow.
4. **DOM order inside `#btr` is the compositing recipe.** `.bt-mod`, `.bt-fallA`, `.bt-fallB`
   and `.bt-bev` are translucent modulation layers whose result depends entirely on
   `.bt-top` / `.bt-face` / `.bt-slate` sitting underneath. Do not reorder.
5. `.bt-slate` and `.bt-ltip` both use `mask-image` with `-webkit-` + standard pairs — keep
   both prefixes.
6. **`.bt-right` is a hole-filler shaped by c1.** The strip at x 1038..1058 exists only
   because C1b covers the banner face to its left. It is not an independent feature.
7. **`.bt-rivet` is almost entirely covered by c12 — and that is a trap.** c12's loose
   `.rivet` #4 at (13, 231, 9x9) paints later and hides all of it except a 2-row sliver
   (x 14..21, y 238..239) where it contributes a **max delta of 1**. So `.bt-rivet` is
   effectively invisible in the assembly: get its paint order or even its existence wrong
   and a pixel gate will still pass. It has to be right by construction, not by test.
8. **c10 paints over c13.** `.bt-top` + `.bt-face` cover y 125..241 across x 13..1281, hiding
   almost all of the banner shell's own top gradient rows.
9. **c11's rules are physically interleaved inside c10's block** — CSS 721–749 sits in the
   middle of the `.bt-*` stylesheet, markup 956–959 in the middle of `#btr`'s child list.
   Splitting c11 out splits both. And `.bt-warm` (960, a c10 element) is listed *after* them,
   so it **fully occludes** `.bt-lch` in its own column: measured, `.bt-lch` contributes
   exactly zero pixels inside x 33..37. The elbow passes *behind* the warm shadow column.

---

## c11 — L bracket

The red L down the left of the header row: a vertical stroke, a 43.5deg elbow, and a long
horizontal divider running most of the card's width.

**CSS** 721–749 (`.bt-lv` 722–727 · `.bt-ltip` 728–736 · `.bt-lch` 737–742 · `.bt-div`
743–749) — **`.lbrk` itself has no CSS anywhere in the document**
**Markup** the painted bracket is `#btr`'s children at 956–959; the inert `.lbrk` div is at 964.
1 instance, band B.

| Instance | Band | Painted box |
|---|---|---|
| **C11** whole bracket (v + elbow + horizontal) | B | x **24** y **138** w **1040** h **102** |
| ↳ without the long horizontal | B | x 24 y 138 w 36 h 96 |

Sub-boxes: `.bt-ltip` 26..33 × 138..143 · `.bt-lv` 24..33 × 142..205 ·
`.bt-lch` 24..60 × 199..234 · `.bt-div` 52..1064 × 228..240.

**Shares:** nothing of its own — but its rules currently live inside c10's stylesheet and
c10's DOM, and c9 bakes its cast shadow into a background layer.

**Verify: null.** Band-B-only. **Verified during the assembly phase instead.**

### Hazards

1. **`.lbrk` paints nothing. At all.** The markup at line 964 —
   `<div class="lbrk"><span class="v"></span><span class="d"></span><span class="h"></span></div>`
   — has **no matching CSS rule in the entire document**. The three spans are inline, empty
   and unstyled, so they render zero pixels. Proved by deletion-diff: delete line 964,
   re-render, and the diff bounding box against the reference is **EMPTY**. Do not build the
   part from `.lbrk`.
2. **The bracket that is actually painted lives in `#btr`** as `.bt-lv` (vertical),
   `.bt-ltip` (its top cap), `.bt-lch` (the elbow) and `.bt-div` (the horizontal). Those map
   one-to-one onto `.lbrk`'s intended `.v` / `.d` / `.h` spans — vertical / diagonal /
   horizontal. The author clearly meant to move them into `.lbrk` and never did. **c11 must
   be built from the `.bt-*` rules, and c10 must give them up.** The two components' source
   ranges genuinely overlap; that is the split, not an error in this map.
3. **`.bt-lch`'s painted box is far bigger than its declared rect** and starts *left* of its
   own `left: 27px`. It is `43 x 5.6` with `margin-top: -2.8px`, `transform-origin: 0 50%`,
   `rotate(43.5deg)` — which puts its true extent at 24..60 × 199..234.
4. **`.bt-div` is 1012px long**, so c11's painted box is 1040px wide — far wider than the
   bracket reads visually. Sizing the part to the visible corner will clip the divider.
5. **Internal paint order matters, and it is not self-contained.** `.bt-div` (956) paints
   *before* `.bt-lch` (959), so the elbow overlaps the divider's left end at x 52..60,
   y 228..234 — measured, max delta 176. And c10's `.bt-warm` (960) paints *after* the whole
   bracket and fully occludes `.bt-lch` in the column x 33..37. So the correct z-order is
   `.bt-div` → `.bt-lv`/`.bt-ltip`/`.bt-lch` → **a c10 element**. c11 cannot be assembled as
   one contiguous layer sitting above or below c10; it has to interleave.
6. Both `.bt-lv` and `.bt-ltip` sit at `left: 24px`, but `.bt-ltip` carries a horizontal
   `mask-image` that eats its first 2px, so its painted left edge is 26, not 24.

---

## c12 — marks

Three unrelated small marks bundled under one id: the rivet, the hex icon and the name.

**CSS** `.rivet` 474–481 · `.hexicon` 825–826 · `.name` 828–838
**Markup** rivets 1007–1010 · hexicon 1123–1128 · name 1129
All instances band B.

| Instance | Band | Painted box | Notes |
|---|---|---|---|
| **`.rivet` R1** | B | x **1266** y **141** w **9** h **9** | on C5b |
| **`.rivet` R2** | B | x **1266** y **228** w **9** h **9** | on C5b |
| **`.rivet` R3** | B | x **1272** y **133** w **9** h **9** | straddles C5b's top edge (plate starts y136) |
| **`.rivet` R4** | B | x **13** y **231** w **9** h **9** | covers c10's `.bt-rivet` |
| **`.hexicon`** | B | x **398** y **297** w **28** h **31** | nominal box 397,297 30x31; on C4b |
| **`.name`** "Skid Ste..." | B | x **456** y **294** w **200** h **37** | type origin 458,290.5; on C4b |

**Shares:** nothing. No defs, no primitives.

**Verify: null.** Every instance is band-B-only, sitting on the banner, on C5b or on C4b.
**Verified during the assembly phase instead.**

### Hazards

1. **All three hard-code canvas position.** `.rivet` takes `left`/`top` from a per-instance
   **inline** style; `.hexicon { left: 397px; top: 297px }` and `.name { left: 458px;
   top: 290.5px }` are baked into the rules themselves with no vars at all.
2. **Paint order is mandatory.** R4 must paint after c10's `.bt-rivet`; R1/R2/R3 must paint
   after c5's C5b; the hexicon and the name must paint after c4's C4b.
3. **`.name`'s painted box exceeds its type box** because of
   `text-shadow: 0 2px 3px rgba(0,0,0,.72)` — 2px left and ~1px below.
4. **`.name`'s font choice is a measured value, not a preference.** The comment at 829–831
   documents that Arial Bold at 41.9px with `letter-spacing: -.35px` was picked to match
   measured glyph widths (S=25/k=20/i=6/d=21 against the reference's 24/22/7/20) and a 12px
   period pitch, sized so cap height = 30px. `.stage`'s `font-kerning: none` is part of that
   fit. Do not substitute a font.
5. `.hexicon`'s 3.5px miter stroke sits inside a 30x31 viewBox, so the painted columns are
   398..425 — one px inset from the nominal 397..427 on each side.
6. `.rivet` carries `box-shadow: inset 0 0 0 .5px rgba(150,160,170,.14)` — a sub-pixel inset
   ring. c10's `.bt-rivet` does **not**; they are different marks that look alike.

---

## c13 — banner shell

`#banner` and its `.back` / `.face` / `.rim-*` children — the outer chrome frame and the
interior vertical build-up that everything in band B sits on.

**CSS** 488–518 (`#banner` 491 · `.back` 492 · `.face` 495–508 · `.rim-t` 513 · `.rim-b` 514 ·
`.rim-l` 515–516 · `.rim-r` 517–518)
**Markup** 924–929. 1 instance, band B.

| Instance | Band | Painted box |
|---|---|---|
| **C13** | B | x **1** y **125** w **1287** h **254** |

Exactly the nominal `#banner` box — no spill.

**Shares:** nothing.

**Verify: null.** Band-B-only, and it is the substrate the whole band composites onto.
**Verified during the assembly phase instead.**

### Hazards

1. **`#banner` hard-codes `left: 1px; top: 125px; width: 1287px; height: 254px`** — canvas
   position with no vars.
2. **It is a substrate, and most of it is hidden.** c10 covers its entire top 116 rows;
   c9, c4b, c3b, c1b, c1c, c2b, c2c and c5b cover most of the rest. Its `.face` gradient is
   only visible in the strips those parts leave uncovered — which means an error in `.face`
   can be invisible in the assembly and still be wrong.
3. **The insets are asymmetric on purpose** — measured, not sloppy. `.rim-t` starts at
   `left: 12px` while `.rim-b` starts at 6, `.rim-l` at 5 and `.rim-r` at `right: 1px`;
   `.face` is inset `left:7 right:7 top:5 bottom:1`.
4. `.rim-t` and `.rim-b` carry `opacity: .85` / `.9` — they composite against `.face`.

---

## Paint-order and overlap map

Band B, in DOM order (= z-order; there is no `z-index` anywhere):

```
c13  #banner                     substrate, y125..379
c10  #btr .bt-*                  covers c13's top 116 rows
c11    ├ .bt-div (956)           c11's horizontal, painted first of the bracket
c11    ├ .bt-lv .bt-ltip .bt-lch (957-959)   elbow overlaps .bt-div at x52..60
c10    └ .bt-warm (960)          paints OVER .bt-lch at x33..37
c11  .lbrk (964)                 INERT — paints nothing
c2   C2b bars                    over .bt-face, .bt-seam, .bt-ramp; clipped at canvas x384
c1   C1b chip + ringlayer        over .bt-face; .bt-right fills the gap to its right
c5   C5b plate
c12  .rivet x4                   R1/R2/R3 over C5b · R4 over c10 .bt-rivet
c9   .circuitfield + .microtext  abuts c10/c11 at y241; bakes their light in
c3   C3b conduit                 over c9 at x150..352, y241..335
c4   C4b pframe                  over c9 at x348..352, y245..372
c12  .hexicon, .name             over C4b's cavity
c2   C2c bars                    over C4b
c1   C1c chip + ringlayer        over C4b
```

Band A (`c2` C2a → `c1` C1a + ring → `c5` C5a) and band C (`c1` C1d + ring → `c3` C3a →
`c4` C4a) have **no overlaps at all** — every loose part sits on bare `--bg`. That is what
makes them independently verifiable, and why c1/c2/c3/c4/c5 each get a real pixel gate while
c9/c10/c11/c12/c13 wait for the assembly.

## Verify boxes

All five were confirmed clean: with the target instance deleted, every pixel inside the box
is exactly `--bg` #0a0c10.

| id | instance | x | y | w | h |
|---|---|---|---|---|---|
| chip | C1a (band A) | 385 | 4 | 660 | 104 |
| slots | C2a (band A) | 188 | 26 | 202 | 98 |
| conduit | C3a (band C) | 90 | 450 | 240 | 155 |
| cartridge | C4a (band C) | 330 | 478 | 944 | 157 |
| screen | C5a (band A) | 1045 | 0 | 247 | 124 |
| c9 · c10 · c11 · c12 · c13 | — | *null — band-B-only, verified in the assembly phase* | | | |

For a verify page, the component root's `--x` / `--y` are `(instance canvas x) - refX` and
`(instance canvas y) - refY`, using the instance's **nominal** origin, not the painted box
above. The painted box is what the verify *window* must contain.

### The stage width changes the pixels — use `check.py --full`

A verify page sized to its own box does **not** rasterise identically to the real canvas.
Chrome resolves a fractionally-sized box — especially one carrying a `clip-path` — against
the enclosing stage, so the same markup lands on a different pixel grid depending on how wide
that stage is.

Measured on `cartridge`, whose `.pf-body` is 914.5px wide and clipped. The **original's
own untouched markup**, moved into a 944-wide stage, scores:

| stage the markup was rendered in | mean | max | within 8 |
|---|--:|--:|--:|
| 944 wide (box-sized verify page) | 0.288 | 84 | 99.70% |
| 1292 wide (the real canvas) | **0.000** | **0** | **100%** |

The error was a 4px-wide vertical stripe running the full frame height — the right-hand chrome
edge, shifted exactly 1px. It looks precisely like a botched extraction, and it is not one:
`cartridge` is byte-faithful. **Do not "fix" it.**

The lesson generalises past this one part. A harness with a floor of 0.288 is a harness that
can hide a real 1px defect, so `check.py` now takes **`--full`**: it renders the verify page
at the canvas's own 1292x635 and crops the same window out of the render. A verify page in
that mode carries a full-size stage with the part at its **true canvas coordinates**, which
also removes the rebase arithmetic from the verify page — one less thing to get wrong. Under
`--full` the c4 control scores 0.000.

Box-sized verify pages still work and still gate; they just carry this floor. Prefer `--full`.
