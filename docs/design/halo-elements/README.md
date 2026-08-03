# Halo Elements — how to iterate

## What this is

One design mockup got uploaded as a single 1292×635 canvas
(`_ref/original.html`) with every element absolutely positioned in stage
coordinates. That's fine for a static picture and useless for anything else —
nothing in it can move, resize, or get reused without dragging along a pile of
coordinates that only make sense next to everything else on the page.

This kit is that canvas taken apart. Each visually distinct component (a
status chip, a display plate, a metal panel frame…) has been extracted into
its own CSS file, rebased so its root sits at `(--x, --y)` and every child
offset is measured from the part's **own** top-left, and proven — pixel by
pixel, against the original render — to still look exactly like it did on the
canvas. **Nothing was redesigned.** Every gradient stop, blur radius, opacity
and sub-pixel offset survived on purpose. This is a separation pass, not an
improvement pass — see "what's not done yet" below.

Open **`index.html`** first — it lists every part and assembly with its
preview link, its gate result, and the knobs you can turn.

## File map

```
docs/design/halo-elements/
  _ref/
    original.html        source of truth — the untouched 1292x635 canvas. NEVER EDIT.
    original.png          that canvas rendered natively. What every gate compares against.
    check.py               the pixel-gate script (see below)
    mkfull.py               helper used to build check.py's --full mode
  ANATOMY.md               the measurement map: bands, painted boxes, hazards, paint order.
                            Read this before touching a part you didn't build.
  tokens.css                shared :root vars, the reset, .oct/.oct4 clip-path primitives.
                            Every preview/verify page links this FIRST.
  workbench.css / .js        a shared "specimen + knob rail" chrome library. Built early,
                            not yet wired into any part page — see "what's not done yet".
  parts/
    <id>.css                 one component's rules, everything namespaced under .halo-<id>
    <id>.html                 preview page — every variant, side by side
    <id>.verify.html           bare gate fixture (see "how to prove you didn't break it")
    <id>.verify-full.html       THE gate fixture — part at its true canvas position inside
                                the real 1292x635 stage. Run with --full; this is what
                                prints 0.000. Regenerate with _ref/mkfull.py
    <id>.verify-right.html      extra window where one box can't cover everything (etch)
  assembly/
    main-item.css / .html / .verify.html      band B's header row, 7 parts recombined
    subitem.css / .html                        band B's lower row, 7 parts recombined
    main-plus-subitem.html                      both rows on one shell — the whole card
  index.html                 the launcher — start here
  README.md                  this file
```

The ten parts: **c1** status chip · **c2** segment bars · **c3** conduit elbow
· **c4** panel frame · **c5** display plate · **c9** circuit field · **c10**
banner top row · **c11** L bracket · **c12** marks · **c13** banner shell.
(There's no c6/c7/c8 — those numbers belong to elements that weren't part of
this canvas.)

## How to change ONE element

1. Find its card on `index.html` and open its **CSS** link — that's the only
   file you should need to touch for a visual change.
2. The card lists every **knob**: the CSS custom properties (`--something`)
   that are free to move. Anything not listed as a knob is either a shared
   coordinate system piece (don't touch) or a value the part's own header
   comment says is measured and load-bearing (also don't touch — read the
   comment, it'll say why).
3. Edit the value in the `.css` file, then open the part's **Preview** page
   (`parts/<id>.html`) straight off disk — no server needed, no build step.
   Every variant on that page updates together since they share one
   stylesheet.
4. If you want to feel the value out live before committing to an edit, that's
   what `workbench.css`/`workbench.js` are *for* — see the caveat under
   "what's not done yet"; today the fastest live-feel loop is just editing the
   `.css` file and refreshing the preview tab.
5. Once you're happy, re-run the part's gate (next section) before moving on.
   A part that "looks right" and fails the gate usually means a sub-pixel
   offset crept in — trust the number over the eyeball.

Two things that are NOT "change one element":

- **Moving a part's `--x`/`--y` to a new position.** That's supported (it's
  the whole point of origin-relative parts), but ANATOMY.md's "the stage
  width changes the pixels" section explains why a relocated part can pick up
  a sub-pixel rendering difference even with identical values — re-gate it at
  its new position before trusting it.
- **A value shared by more than one part** (a hex colour in `tokens.css`, the
  `#chipSoft` filter c1 owns, the conduit `<defs>` c3 owns). Changing those
  ripples into every consumer — check `ANATOMY.md`'s "Shared machinery"
  section for who owns what before editing `tokens.css` itself.

## How to prove you didn't break it

The instrument is `_ref/check.py`. It renders a page, crops the same window
out of `_ref/original.png` at the position you give it, and reports the
per-pixel difference:

```
python3 _ref/check.py <page.html> <W> <H> <refX> <refY> [outPrefix] [--full]
```

**Pass bar:** mean delta ≤ 1.0 **and** ≥ 99% of pixels within a delta of 8.
Prefer `--full` when the fixture supports it (renders at the canvas's own
1292×635 and crops from there) — a box-sized render has a measurable
Chromium raster floor of its own that has nothing to do with your CSS; see
ANATOMY.md's "stage width changes the pixels" section for the worked example.

### The five parts with a real, standalone gate

These sit alone on bare background in the mockup, so an isolated crop of
`original.png` shows the part and nothing else:

**Use the `verify-full` fixture and the `--full` flag.** These are the commands that
reproduce the `0.000` figures quoted in `index.html` and the commit messages. The
box-sized fixtures below them also pass, but they carry a rasterisation floor and
will never print 0.000 — see *the stage width changes the pixels* in `ANATOMY.md`.

| part | command | result |
|---|---|---|
| chip | `python3 _ref/check.py parts/chip.verify-full.html 660 104 385 4 --full` | PASS, **mean 0.000, max 0** |
| slots | `python3 _ref/check.py parts/slots.verify-full.html 202 98 188 26 --full` | PASS, **mean 0.000, max 0** |
| conduit | `python3 _ref/check.py parts/conduit.verify-full.html 240 155 90 450 --full` | PASS, **mean 0.000, max 0** |
| cartridge | `python3 _ref/check.py parts/cartridge.verify-full.html 944 157 330 478 --full` | PASS, **mean 0.000, max 0** |
| screen | `python3 _ref/check.py parts/screen.verify-full.html 247 124 1045 0 --full` | PASS, **mean 0.000, max 0** |
| etch | `python3 _ref/check.py parts/etch.verify-full.html 139 135 11 241 --full` | PASS, **mean 0.000, max 0** |

`mkfull.py` regenerates any `verify-full` page from its box-sized original:
`python3 _ref/mkfull.py parts/<name>.verify.html <refX> <refY>`.

<details><summary>The box-sized fixtures, and the floor they carry</summary>

| part | command | result |
|---|---|---|
| chip | `python3 _ref/check.py parts/chip.verify.html 660 104 385 4` | PASS, mean 0.082, max 2 |
| slots | `python3 _ref/check.py parts/slots.verify.html 202 98 188 26` | PASS, mean 0.000, max 0 |
| conduit | `python3 _ref/check.py parts/conduit.verify.html 240 155 90 450` | PASS, mean 0.064, max 8 |
| cartridge | `python3 _ref/check.py parts/cartridge.verify.html 944 157 330 478` | PASS, mean 0.288, max 84 (raster floor — see ANATOMY.md; not a defect) |
| screen | `python3 _ref/check.py parts/screen.verify.html 247 124 1045 0` | PASS, mean 0.114, max 1 |

Every one of these residuals is the harness, not the part. Proven by control:
the *original's own untouched markup*, dropped into the same box-sized stage,
reproduces them identically.

</details>

etch gets **two** real gate windows because no single rectangle
of the mockup is c9 and only c9:

```
python3 _ref/check.py parts/etch.verify.html       139 135 11 241    # primary  → PASS mean 0.475
python3 _ref/check.py parts/etch.verify-right.html 336 40  11 336    # bottom strip → FAIL mean 1.111 (see below)
```

The bottom-strip window is a **known, documented artifact**, not a defect:
rendered box-sized (336×40) it picks up Chromium screen-space dither
re-phasing and lands 0.111 over the bar; rendered at its true position inside
the full-card assembly (a real 1292×635 stage) the identical pixels score
mean 0.000. The full derivation — signed-delta symmetry, the row-alternating
magnitude, the exact break at the `--layer1` gradient stop — is in the file's
own header comment. Re-run the assembly gate below if you want the clean
number for this part.

All six of the above were re-run against the kit's current files while
building this index and printed exactly what's shown.

### The five band-B-only parts (c9's siblings) — no standalone gate exists

c10, c11, c12, and c13 never appear alone on bare background anywhere in the
mockup — they sit under, beside, or interleaved with another part on the
real card, so there is no honest `(refX, refY, W, H)` crop of `original.png`
that isolates one of them. Their `.verify.html` files exist for structural
completeness (every part carries one) and, for some, as a fixture for a
same-instrument **isolation-diff** (mask everything but that part in a
scratch copy of `original.html`, render both, diff) — which proves the
*extraction* is byte-faithful but is a different instrument than a
`check.py` PASS against `original.png` and should not be reported as one.

**Correction made while building this index:** an earlier report listed
marks' isolation-diff result as `gate=PASS`. It isn't a `check.py` PASS —
it's the isolation-diff described above. The index now marks c12 `N/A`, same
as c10/c13.

**Also found while building this index:** bracket's own `.verify.html`,
run literally (`python3 _ref/check.py parts/bracket.verify.html 1040 102 24 138`),
prints a real `FAIL` — mean 56.247, only 24.4% of pixels within 8. This is
**expected, not a regression**: c11's box in the mockup is painted over by
c10's banner face and partially occluded by c10's `.bt-warm`, and neither of
those live in `bracket.css`. Isolating c11 alone can never match a
composited reference — the FAIL is the instrument being asked the wrong
question, not evidence the part is wrong.

**The real proof for all five band-B-only parts** is the assembly gates
below — they composite every one of these parts exactly as the mockup does,
against the real `original.png`, with `check.py`, no substitute instrument.

### The three assemblies — the gate that actually matters

| assembly | command | result |
|---|---|---|
| Main Item (4 windows) | `python3 _ref/check.py assembly/main-item.verify.html 1292 95 0 118 --full` (+ `150 28 0 213` / `1007 28 285 213` / `939 4 353 241`) | PASS, all four mean 0.000, max 0, within8 100% |
| Subitem (2 windows) | `python3 _ref/check.py assembly/main-plus-subitem.html 1292 140 0 242 --full` (+ `1063 1 0 241`) | PASS, both mean 0.000, max 0, within8 100% |
| Full card (1 window) | `python3 _ref/check.py assembly/main-plus-subitem.html 1292 268 0 118 --full` | PASS, mean 0.000, max 0, within8 100% |

All three were re-run against the kit's current files while building this
index and printed exactly what's shown above. Together they cover every
pixel of band B that the mockup actually paints, including every part that
has no standalone gate of its own — which is why c10/c11/c12/c13 (and c9's
occluded remainder) are provably correct even without an isolated crop to
test them against.

## How the parts compose

**Main Item** = band B's header row (y 125–241): `housing` (the
shared housing) → `deck` → `bracket` interleaved *inside*
c10's own children (between `.bt-graph` and `.bt-warm` — see ANATOMY.md, c10
hazard 9) → `slots` (is-c2b) → `chip` (is-wide.is-labelled)
→ `screen` (is-failed) → `marks` (the rivets).

**Subitem** = band B's lower row (y 241–378): `housing` again (a
second instance, clipped to just this row so a lone Subitem preview doesn't
drag in housing that belongs to the row above) → `etch` →
`conduit` (is-banner) → `cartridge` (is-c4b, carries the extra
`.pf-lift` child) → `marks` (hexicon + name) → `slots`
(is-c2c) → `chip` (is-narrow.is-labelled).

**Full card** (`assembly/main-plus-subitem.html`) is both rows on **one**
shared `housing` instance — the shell is not duplicated the way it
is across the two standalone previews. Ten part stylesheets, zero visual
values of their own on the assembly page: every colour, gradient, blur, stop
and radius still lives in a `parts/<id>.css` file. Paint order is DOM order
throughout (there is no `z-index` anywhere in the kit, matching the
original) — see ANATOMY.md's "Paint-order and overlap map" for the full
sequence if you're re-ordering anything.

## What's deliberately NOT done yet

This is a **separation pass only**. Everything above proves the parts are
byte-faithful to the uploaded mockup — it says nothing about whether the
mockup's own design choices match Rental Wrangler's house language. In
particular, **none of the following has happened**, on purpose:

- **No reconciliation with the decisions ledger**
  (`docs/superpowers/specs/2026-07-20-decisions-ledger.md`). The mockup's red
  (`#f95a5c` / `#ff433e` / `#fc6c5c` …), its metals, its Arial name label —
  none of it has been checked against, or swapped for, the locked
  `wrangler-style` palette (`--accent #ff7e1f`, Archivo + mono, the four
  control shapes). Assume every colour and font in this kit is still the
  mockup's own until that pass happens.
- **No `style`/`wrangler-style` pass.** Control heights, the type ramp,
  contrast floors, the 60-30-10 accent budget — none of it has been checked.
  These parts are recreations of a static image, not yet UI.
- **`workbench.css`/`workbench.js` exist but nothing uses them.** They're a
  real, working "specimen + knob rail" chrome library (masthead, pass/fail
  stamp, a live `<input type=range>` bound to a CSS var, "copy CSS" of just
  what changed) built early in this kit's history — but every part's actual
  preview page was built with its own bespoke inline scaffolding instead of
  wiring into it. `index.html` reuses `workbench.css`'s colour tokens and its
  `.wb-gate` stamp for visual consistency, but the live knob-rail interaction
  itself is not wired into any part page yet.
- **No `data-r` rule stamps, no `WINDOW_CATALOG` entries.** These parts are
  not yet real app UI — they're plain HTML/CSS files outside `app.js` — so
  the R-Rulebook and window-catalog CI guards don't apply to them yet and
  won't until they're actually wired into a card.
- **c2's C2b/C2c and c3's is-banner variants have no dedicated pixel gate.**
  They were rebased with the same arithmetic as their gated sibling and
  visually cross-checked, and they additionally ride inside the Main
  Item / Subitem assembly gates above — but they don't have their own
  isolated `check.py` box the way c1a/c2a/c3a/c4a/c5a do.
- **Subitem has no standalone `.verify.html`.** Its gate today runs through
  `assembly/main-plus-subitem.html` (which is also the Full Card preview).
  A dedicated `assembly/subitem.verify.html` — a lone Subitem row at its
  true canvas origin in a real 1292×635 stage — doesn't exist yet.
