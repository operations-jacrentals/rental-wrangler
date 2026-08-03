# The recreation lane — rebuilding from an image with no editable source

The `/paint` fallback. Reach for this **only** when Jac is handed an image that has
no Canva or Figma file behind it, so there is no structure to read and the pixels
are genuinely all there is. When an editable source exists, S3's Canva critique is
the road and this is a detour that costs days — measured on the Halo card, a
byte-exact recreation took 103 minutes, 1,587 model turns and ~2M tokens to recover
structure that was never in the file.

It is preserved in full because when it *is* the right tool, it is the best one
there is, and every rule below was paid for.

Born 2026-08-02, after two failed attempts to edit a card toward Jac's mockups from
memory. His diagnosis, verbatim:

> "I think your issue is editing, you're bad at that. You need to create from
> grids. use agents. See how close you can get per element in each grid."

Extended the same day with the **master-copy workflow**, the copyist's discipline
translated to HTML/CSS. Two sentences carry it:

> "Copy the artwork's **relationships** — not its individual objects."
> "A single one-layer element does not need to bear the weight of accuracy —
> using opacity and stacking elements can achieve it."

## The iron rules (each one paid for)

1. **The target image lives ON DISK and you have OPENED it.** Never work from
   a remembered description of an image — two full rebuild passes were wasted
   that way while the mockup sat unopened in the uploads folder. Check
   `/root/.claude/uploads/<session>/` by *opening files*, not by filename.
   If the image only exists in conversation, ask Jac to re-attach it.
2. **Recreate from scratch, never edit toward.** A big cascade fights every
   move; a clean standalone file has the mockup as its only constraint.
   One `#stage` div at the image's native pixel size, absolute-positioned
   elements, zero project CSS.
3. **Measure before building.** PIL-sample colors and geometry (bboxes, stroke
   widths, corner cuts, lean directions) — the eye misreads gloss as lean and
   hue as shape.
4. **Disputes are settled by sampling, not by confidence.** When an agent's
   reading disagrees with yours, sample the pixels. (The tick-lean incident:
   my eyes said `/`, three analysts said `\`, the pixels said `\`.)
5. **Appliers introduce cross-cell regressions.** After any multi-agent apply
   round, put YOUR OWN eyes on the full-frame comparison — cell analysts
   can't see neighboring-cell damage (the chevron plate, the wrong-way
   slash).
6. **Port = construction swap, not nudge.** What moves into the real codebase
   is the *recipe* (e.g. two-layer clipped-solid rings instead of inset
   box-shadows), applied deliberately, one commit, with the recreation as the
   reference artifact. Get Jac's call on the port list first (popup,
   multiSelect).
7. **Relationships, not objects.** A perfectly rendered eye in the wrong
   location is still wrong. Match the *intervals, proportions and value gaps*
   between elements before you perfect any single element. Same aspect ratio
   as the mockup, always — a `#stage` of the wrong ratio drifts the whole
   composition and no amount of per-element work recovers it.
8. **No single element bears the accuracy — stack it.** Shading, etching,
   bevels, gradients, grain, temperature: each is a *pile* of thin, low-alpha
   layers, not one clever declaration. When a detail won't come out right,
   the answer is almost always "add another layer at 8% alpha", not "tune
   this one value harder." → `references/layering.md`.

## Order of importance — the diagnostic ranking

When the recreation is wrong, fix in **this order**, largest discrepancy
first. A misplaced highlight never outranks a misplaced plate.

| # | Layer | What "wrong" looks like |
|---|---|---|
| 1 | Composition & placement | element in the wrong x/y, wrong `#stage` ratio |
| 2 | Proportion & drawing | right place, wrong width/height/angle/radius |
| 3 | Value structure | right shape, wrong lightness — the squint test fails |
| 4 | Edge hierarchy | everything equally sharp (or equally soft) |
| 5 | Color temperature & saturation | correct value, but too warm/cool or too chromatic |
| 6 | Surface handling | gradient/grain/texture reads flat or plastic |
| 7 | Fine detail | glyphs, ticks, hairlines, micro-labels |

This ranking governs **both** your own passes and the grid pass: an analyst
reporting a 1px hairline shift while a plate sits 6px off is reporting the
wrong thing. Cell reports carry the rank so the applier fixes top-down.

## The layering doctrine (short form)

Build every surface as a stack, cheapest layer first. A typical plate:

```
1. base fill            solid, the local color at correct VALUE
2. form modeling        1-3 linear/radial gradients, transparent-to-alpha
3. edge construction    clipped solid rings (light TL / dark BR) — not inset shadows
4. etching / incised    paired 1px lines: dark line + light line offset 1px
5. texture / grain      tiled noise or repeating-gradient at 3-6% alpha
6. temperature wash     one low-alpha warm or cool overlay, blend soft-light
7. accents              the few hard, opaque marks — last, fewest
```

Every layer has **one job**. Never re-cover the whole element to fix one
thing. Two hard constraints from the house language: **matte — no glow**
(colored blur shadows are banned; build a hairline + a wash instead), and
**never lighten with white** — white cools *and* desaturates; reach for the
lighter neighboring hue. Full recipes, blend modes, and the edge-hierarchy
table: `references/layering.md`.


## The method

### Phase 0 — define the target and prep the reference

Decide, out loud, before touching anything: is this an **exact reproduction**
or an **observational study**? Exact ⇒ native pixel size, native aspect ratio,
sight-size comparison. Then generate the reference set with
`scripts/refs.py` — full-color, grayscale, 3-value posterized (notan), and a
focal-area crop. You will judge value against the grayscale copy, not the
color one; hue is the loudest liar in a value dispute.

### Phase 1 — solo recreation (2-3 rounds)

1. Copy `scripts/` into the scratchpad; point `shot.mjs` and `compare.py` at
   your recreation file and the mockup path. `pip3 install Pillow` if PIL is
   missing (it usually is on a fresh cloud container).
2. Sample the mockup's key geometry with PIL (see `scripts/probe-example.py`):
   outer envelope, major axes, extreme points, big negative shapes.
3. **Envelope first.** Lay in `#stage` at native size on a *toned ground*
   (mid-steel, not white or black — a brilliant ground misreads every value),
   then block only the major masses as flat rectangles. No text, no ticks, no
   icons, no gradients. Check the block-in with `scripts/diag.py --overlay`
   before adding anything.
4. **Value map before color.** Take the whole recreation monochrome
   (`#stage { filter: grayscale(1) }`) and match it against the grayscale
   mockup at 3-5 values. It must read correctly at 25% scale
   (`scripts/diag.py --squint`) before any color goes down.
5. **First color pass, thin and simple.** Background, big shadow masses, big
   light masses, local colors, broad temperature shifts. Do not chase small
   variations yet — establish the color climate.
6. **Model with successive layers** (§ layering doctrine) — then rebuild the
   edge hierarchy deliberately: sharpen at the focal point, soften turning
   forms, *lose* edges where adjacent values merge. Do not outline everything.
7. Render, stack-compare (mockup on top, recreation below), fix the big reads
   yourself in the order-of-importance ranking. Stop when only fine detail
   differs.

### Phase 2 — the grid pass (agents; needs Jac's multi-agent opt-in unless ultracode is on)

8. Cut BOTH images into **element-aligned** cells — one cell per meaningful
   element cluster (a rack, a board, a plate, a frame corner), not blind
   squares. 3x nearest-neighbor upscale per cell. `scripts/cut.py` template.
9. Workflow: `parallel` one **analyst per cell** (read-only!), each returns
   `{score 1-10, deltas:[{rank 1-7, element, issue, fix}]}` with
   original-scale px coordinates and sampled hex pairs — `rank` is the
   order-of-importance row, and fixes are phrased as *layers to add* where a
   layer is the answer. Then ONE **applier** (opus) merges all cells' deltas
   **rank-ascending** (placement before proportion before value before edges…)
   into the file — cells own their shared styles (the tick cell rules tick
   styles) — re-renders, re-cuts. Loop analyze→apply until every cell ≥9 or
   3 rounds.
10. **Your final pass:** full-frame compare with your own eyes, in the
    order-of-importance sequence — silhouette, placement, value masses, focal
    contrast, temperature, saturation, edges, detail. Hand-apply the analysts'
    last coordinates and fix any applier regressions. Then **unify**: deepen a
    few darks, restore a few highlights, quiet overactive passages, repeat key
    colors across the frame, and delete detail that isn't earning its place.
    Republish the recreation artifact (its own URL, never the app artifact's).

### Phase 3 — the port (separate, gated)

11. Name what the recreation taught — as recipes, with the false findings
    retracted explicitly. Popup Jac the port list (multiSelect). Only then
    touch the real codebase, and through its own gates (backtick audit, sweep,
    ledger rows).

## Scripts

Templates in `scripts/` (copy to scratchpad; each takes paths as argv):
- `refs.py` — reference set: grayscale, 3-value notan, posterized, focal crop
- `cut.py` — cell definitions + 3x crops for both images
- `shot.mjs` — playwright render of the recreation at native size
- `compare.py` — stacked mockup/recreation comparison image
- `diag.py` — the diagnostic checks: `--overlay` (difference map + alignment),
  `--squint` (blur/downscale, the across-the-room read), `--flip` (mirror and
  180° for drawing errors), `--values` (both images posterized side by side)
- `probe-example.py` — PIL sampling patterns (blob columns, stroke runs,
  lean-direction settlement)

Bootstrap: `pip3 install Pillow` · playwright lives at
`/opt/node22/lib/node_modules/playwright`.

## Reference

- `references/layering.md` — the stacking recipes: shading, etching, bevels,
  gradients, grain, temperature washes, the edge-hierarchy table, blend-mode
  choices, and how to debug a stack.
- `references/master-copy.md` — the full master-copy workflow (Jac's brief),
  each step translated to what it means in HTML/CSS.

## Score honestly

Cell scores of 6-7 with a strong visual match are normal — analysts at 3x
zoom see texture gaps a viewer never will. The stop condition is Jac's read
("not terrible" → another pass; silence → ship the comparison and ask), not
a perfect 10. Stop adding layers when another mark no longer improves the
larger relationships.
