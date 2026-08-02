# Steel v2 — implementation plan

**Spec:** `2026-08-01-steel-v2-design.md` (approved by Jac, 2026-08-01)
**Target:** `docs/design/tier-01-card/index.html` — the `steel` theme only.
**Invariant across every phase:** the `halo` skin, the A/B/C switches, and the 220ms
click contract (`#173`) all keep working. No new event handlers.

Each phase is independently verifiable and independently revertible. Build in order —
P1 is a prerequisite for P2 and P3.

---

## P0 · Texture

1. Add a `steel-grain` tile to `scratchpad/tex.html` — the `halo-olive` recipe with its
   olive constants pulled to neutral warm-grey; render to
   `docs/design/tier-01-card/steel-grain.png`.
2. Atlas: change `--rw-steel` from `steel-texture.png` to `steel-grain.png`.
   `html[data-skin="halo"]{--rw-steel:var(--h-olive)}` is untouched.
3. Drop `steel-texture.png` from the builder's `TEXTURES` list. Keep the file as a
   revert point.

**Verify:** steel resolves to `steel-grain.png`, halo still resolves to olive, the
builder's "exactly 1 atlas reference" guard still passes for every remaining texture.

---

## P1 · The glass family

The foundation P2/P3 build on. Applies to the five elements in spec §3.

1. Route the glass surfaces to `--h-circuit` + scanline film + the halo emission
   recipe, in the **steel** theme (not gated on `data-skin`).
2. Readouts cyan: head board, row board, drawer, footer rail.
3. Controls orange: search field + caret. (Toggles come in P5.)

**Verify:** each of the five computes a circuit background; readout text computes cyan;
search computes orange; halo's own H1 rules still override where they intend to.

---

## P2 · Head inversion

**The known specificity risk.** The A-switch currently mills the head name from
`.scp1`'s own recipe via `--m-mix` / `--m-tint` and `background-clip:text` — but after
this phase `.scp1` is **glass** and the name plate is the steel. Those A rules must be
**re-pointed from `.scp1` to the name plate**, or A-bold will tint the glass bar instead
of the plate. This is the single most likely place for this work to go wrong.

1. `.scp1` → glass: circuit texture, scanline film, neutral (no tone tint, spec §4.3).
2. The name plate (the `.gate` host) → the only steel: raised plate on the bar, brushed
   grain, keeps the 9px NW / 14px SE chamfer as its **own silhouette** (spec §5, `#193`).
3. Move the A-switch's `--m-mix` / `--m-tint` / `background-clip:text` milling off
   `.scp1` and onto the name plate.
4. Board: remove the well. Replace the bezel ring with a single darker hairline seam.
   Keep `#185`'s clip, width, marquee and scanlines.
5. Slots sit on glass — drop the stud shading, keep geometry and behaviour.

**Verify:** bar stamps `glass`, name plate is the only descendant stamping `steel`; the
board's computed shadow has no bezel ring; A=strict and A=bold both change the *plate*
and never the bar; head bars compute no tone tint in any group state.

---

## P3 · Row cartridge

1. The face stays **steel in both states** — delete the lit-face glass swap.
2. The row's board stays a glass window in that steel face (spec §4.2).
3. The lit row's name stops glowing — it is steel now.
4. The drawer takes the **signal hue**: circuit texture tinted with the row's tone at a
   low mix, texture still legible.
5. The laser frame still wraps the whole cartridge, unchanged.
6. Add the seated-module reading: side rails, a top seam, slight recess.

**Verify:** lit row's face `data-material` stays `steel`; drawer is `glass`; the
drawer's background contains the row's hue and the face's does not; laser frame present;
one hue surface per open row (spec §4.4).

---

## P4 · Flicker relocation

1. Move `rwCrtOn` off `[data-row][data-lit="1"] > div > *` and onto the drawer.
2. Bind it to **drawer creation**, not to a row being lit — the existing sweep appends
   `.rw-cartlines` only when absent, which is the correct hook.

**Verify:** expand a group → assert **zero** animation on any row. Then open a row →
assert the drawer animates. Then filter/search to force a rebuild → assert it does not
replay.

---

## P5 · Toggle

1. The well (`.seg`) becomes inert: no hover, select or press response on the steel.
2. The glass segment inside carries every state — selected lights with an orange rim
   drawn **≥1px inside the glass's own edge**, plus orange text and a contained bloom.
3. Hover wakes the glass. Press pushes the segment deeper into the well.
4. Apply across WORK/OPEN/DONE, UNITS/CATEGORIES, and the sort + filter chips.

**Verify:** the rim's bounding box is strictly inside the segment's, which is strictly
inside the well's — asserted geometrically, not by eye. On press the segment's transform
changes and the well's does not. Nothing changes size or position on select.

---

## P6 · The count becomes a floating slot

1. Replace the count pin on the toggles with a **slot** (`#177` — the last pin standing).
2. Float it at the top-right corner, free to overlap the bezel (law 8).
3. Keep its state hue: red WORK, green DONE. Hover-unfurls like every other slot.

**Verify:** the count renders as a slot, overlaps the corner, keeps its hue, unfurls on
hover.

---

## P7 · Close out

1. Full Playwright sweep: both skins × A × B, spec §7's nine assertions.
2. Rebuild the standalone; assert zero off-page requests; republish the artifact.
3. Ledger rows for: the cyan/orange split (retiring one-accent for glass), the head
   inversion, the drawer hue, `#172`'s death, `#193`'s moot clause, `#161`'s relocation,
   and law 8's first use.
4. **Ask Jac about `#191`** — the spec flags it as likely-closed-but-not-closed.
5. Commit + push.

---

## Risks

| Risk | Mitigation |
|---|---|
| A-switch still keyed to `.scp1` after the head inverts (P2) | Called out as P2's headline risk; verified explicitly in P2's checks |
| `!important` specificity fights — the P1/M1 blocks use it throughout | Restate at the same attribute specificity, the trap `#187` already documented |
| The halo skin regressing as steel moves underneath it | Every phase verifies both skins, not just steel |
| Drawer tint reading as a colour block | Low mix over the circuit texture; verify the texture is still legible |
| Flicker replaying on rebuild (P4) | Explicit filter/search rebuild assertion |
