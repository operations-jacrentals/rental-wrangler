# Next session — paste this as the opening message

---

Read the `art-pipeline` skill FIRST, before touching anything. It was written at the end of
the last session and it is the method we are testing today. Then read ledger rows
**#252–#257** in `docs/superpowers/specs/2026-07-20-decisions-ledger.md`.

**The goal today is SPEED, and speed is the thing being measured.** Yesterday it took hours
to get one card out of Figma, mostly through avoidable rework. The `art-pipeline` skill
exists so that never repeats. Today we prove the method: **artwork in Figma → a live
published artifact, in minutes, without a fidelity argument.**

## The test

Take **one** component I nominate from the Figma file `cc3TcK2F2a8qSbCAstzcA5` and carry it
end to end:

1. **Export it** with Figma's own `exportAsync({format:'SVG_STRING'})`. Do NOT hand-walk
   `vectorNetwork.regions`, and do NOT recreate it in CSS. Export is the road; hand-authoring
   is not a fallback we are taking.
2. **Split it** — static art baked as one z-ordered `background-image` in Figma's paint
   order; anything that changes with state as a white-silhouette `mask-image` filled with
   `var(--row-hue)`. Nothing state-coloured baked in (#217).
3. **Make it resize** — `border-image` 9-slice. Structure `stretch`, rhythm `round`.
   Per-axis where they differ.
4. **Publish it** as an interactive artifact I can open and resize.

**Start a timer at step 1 and report the wall-clock time at step 4.** If it takes more than
about 30 minutes for a single component, the method has failed and I want to know *which step*
ate the time — not a heroic recovery.

## Rules that make it fast

- **The exported asset IS ground truth.** Do not pixel-diff it against a Figma PNG and argue
  about tones. Yesterday two "failures" were a uint8 overflow in the comparison, not real.
  Fidelity comes from exporting, not from matching afterwards.
- **Render the node and LOOK at it before building from it.** Frame bounds are not painted
  extent. One pass built a whole component from a 41×158 sliver believing it was the elbow.
- **Use `get_design_context` for anything instanced.** `get_metadata` reports the
  *un-overridden component* position and will lie to you (the channel read 149px, was 108px).
- **One agent owns geometry AND assets.** Splitting those across two agents is what produced
  the wrong-layout rebuild — nobody owned the composition.
- Do not chase tone counts. Do not animate a `filter: drop-shadow()`. Do not bake text into
  art. All three are already-paid-for lessons in the skill.

## What "done" looks like

A published artifact, the component resizing correctly at several widths with its decor
repeating rather than smearing, per-state tinting working, and a one-line time report.

## Then, if that clears

Tell me what it would take to run the same method across the whole assembly, and whether the
rail should be authored as a single repeating tile (see #257) — that changes how I draw it,
so I need to decide before I do more Figma work.

## Where things stand

- Branch `claude/design-system-phase-1-vcgald`, PR #798. Tree clean.
- The current build is committed at `docs/design/v2-card/` — serve the folder, open
  `card.html`. Its README carries the traps.
- Rows are fused to their elbows (#256); they hide behind the group header and ride the
  channel down. The channel reveals as they descend.
- Open and mine to decide, not yours: whether the housing/deck/board panels get authored
  with uniform slice bands at their edges (9-slice needs somewhere clean to cut), and whether
  the conduit rail becomes one repeating tile.

---
