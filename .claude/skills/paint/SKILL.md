---
name: paint
description: Pixel-for-pixel recreation of a design mockup/screenshot in clean HTML/CSS, then a gridded multi-agent refinement pass — invoke with /paint when Jac supplies a mockup image and wants it recreated faithfully, wants a "pixel pass" on an existing recreation, or says a build "looks nothing like" his mockup. Recreate FROM SCRATCH first, grid-compare per element with agents, and only then port the proven recipes into the real codebase as construction swaps. NOT for building new UI from a text spec (that is wrangler-style + style) and NOT for triaging a functional bug (that is wrangler-fix).
---

# /paint — recreate the pixels, then borrow from what you built

Born 2026-08-02, after two failed attempts to edit the Tier-0.1 card toward
Jac's mockups from memory. Jac's diagnosis, verbatim, is the core of the
method:

> "I think your issue is editing, you're bad at that. You need to create from
> scratch and then apply/merge into the mockup." … "Break the screenshot into
> grids. use agents. See how close you can get per element in each grid."

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

## The method

### Phase 1 — solo recreation (2-3 rounds)

1. Copy `scripts/shot.mjs` and `scripts/compare.py` into the scratchpad;
   point them at your recreation file and the mockup path.
2. Sample the mockup's key geometry with PIL (see `scripts/probe-example.py`).
3. Build `recreation.html` at the mockup's native size. Render, stack-compare
   (mockup on top, recreation below), fix the big reads yourself: layout,
   proportions, palette, silhouettes. Stop when only fine detail differs.

### Phase 2 — the grid pass (agents; needs Jac's multi-agent opt-in unless ultracode is on)

4. Cut BOTH images into **element-aligned** cells — one cell per meaningful
   element cluster (a rack, a board, a plate, a frame corner), not blind
   squares. 3x nearest-neighbor upscale per cell. `scripts/cut.py` template.
5. Workflow: `parallel` one **analyst per cell** (read-only!), each returns
   `{score 1-10, deltas:[{element, issue, fix}]}` with original-scale px
   coordinates and sampled hex pairs. Then ONE **applier** (opus) merges all
   cells' deltas into the file — cells own their shared styles (the tick cell
   rules tick styles), re-renders, re-cuts. Loop analyze→apply until every
   cell ≥9 or 3 rounds.
6. **Your final pass:** full-frame compare with your own eyes; hand-apply the
   analysts' last coordinates and fix any applier regressions. Republish the
   recreation artifact (its own URL, never the app artifact's).

### Phase 3 — the port (separate, gated)

7. Name what the recreation taught — as recipes, with the false findings
   retracted explicitly. Popup Jac the port list (multiSelect). Only then
   touch the real codebase, and through its own gates (backtick audit, sweep,
   ledger rows).

## Scripts

Templates in `scripts/` (copy to scratchpad and adjust paths):
- `cut.py` — cell definitions + 3x crops for both images
- `shot.mjs` — playwright render of the recreation at native size
- `compare.py` — stacked mockup/recreation comparison image
- `probe-example.py` — PIL sampling patterns (blob columns, stroke runs,
  lean-direction settlement)

## Score honestly

Cell scores of 6-7 with a strong visual match are normal — analysts at 3x
zoom see texture gaps a viewer never will. The stop condition is Jac's read
("not terrible" → another pass; silence → ship the comparison and ask), not
a perfect 10.
