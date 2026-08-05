# Next session — paste everything below the rule

---

Read `docs/design/HANDOFF-2026-08-05.md` first, then the **`art-pipeline`** skill. Then ledger
rows **#238–#260**. Don't skim them — they are the method and the traps, and re-deriving either
is what made yesterday slow.

Branch `claude/design-system-phase-1-vcgald`, PR #798, 87 commits, unmerged. Nothing is live.

## Today's job: prove the pipeline is fast

Yesterday one card took hours, almost all of it rework. `art-pipeline` exists so that never
repeats. Today we measure it.

**Take ONE component from Figma `cc3TcK2F2a8qSbCAstzcA5` all the way to a published,
interactive artifact — and report the wall-clock time.**

Use **`asm-headboard`**, **`asm-rowboard`** or **`asm-channel`**. Those three slice cleanly
today. Don't pick the deck or the housing — their artwork has to be redrawn first
(`SLICE-SPEC.md` §4), and that's my job, not yours.

The four steps:

1. **Export** with Figma's own `exportAsync({format:'SVG_STRING'})`. Do **not** hand-walk
   `vectorNetwork.regions`. Do **not** recreate it in CSS. Export is the road, not a fallback.
2. **Split** — static art baked as one z-ordered `background-image` in Figma's paint order;
   anything state-coloured as a white-silhouette `mask-image` filled with `var(--row-hue)`.
   Nothing state-coloured baked in (#217).
3. **Make it resize** — `border-image` 9-slice using the numbers already decided in
   `docs/design/SLICE-SPEC.md`. Don't re-derive them; they were measured and adversarially
   verified. Structure `stretch`, rhythm `round`.
4. **Publish** an artifact I can open and resize.

**Start a timer at step 1. Report the elapsed time at step 4.** If it runs past ~30 minutes for
one component, stop and tell me **which step ate it** — I want the diagnosis, not a heroic
recovery.

## The five rules that keep it fast

1. **The exported asset IS ground truth.** Do not pixel-diff it against a Figma PNG and argue
   about tone counts. Two "failures" yesterday were a uint8 overflow in the comparison, and
   Figma's export quantizes translucent washes into bands one channel value apart anyway.
   Compare by distance, not identity — or better, don't compare at all.
2. **Render the node and LOOK at it before building from it.** Frame bounds are not painted
   extent. A whole component was once built from a 41×158 sliver believing it was the elbow.
3. **Use `get_design_context` for anything instanced.** `get_metadata` returns the
   *un-overridden component* position and will lie (the channel read 149px, was 108px).
4. **One agent owns geometry AND assets.** Splitting them is what produced the wrong-layout
   rebuild I rejected — nobody owned the composition.
5. **Don't chase tone counts, don't animate a `filter: drop-shadow()`, don't bake text into
   art.** All three are already-paid-for lessons in the skill.

## Done looks like

A published artifact; the component resizing correctly across several widths with its decor
repeating rather than smearing; per-state tinting working; and one line giving the time.

## Then

Tell me what it would take to run the same method across the whole assembly — and confirm the
rail tile spec in #259 (41×4, `repeat-y`, authored neutral and tinted per state) before I redraw
it, since that changes what I draw.

Don't start on the deck or housing redraws. Those are mine.

---
