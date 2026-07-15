---
paths:
  - "icons.js"
  - "icons-anim.js"
  - "tools/gen-icons.mjs"
  - "tools/gen-app-icons.py"
  - "app.js"
---

# Icons (Jac, 2026-06-19)

Path-scoped rule — loads only when an icon-related file is in play. (Moved out of
the always-loaded `CLAUDE.md` in Session Workflow v2, 2026-07-15.)

- **Never hand-draw / hand-author icons.** Every glyph comes from a library.
  Generic glyphs are vendored **verbatim from Lucide** (ISC, pinned) into
  `icons.js` (`I`, `CARD_ICON`, `RING_ICON`) by `tools/gen-icons.mjs`. To add or
  change one, map `name -> lucide-icon-name` in that script and run
  `node tools/gen-icons.mjs` (needs network, dev-time only) — never paste raw
  `<path>` data by hand. It's NOT a required CI gate (no external CDN in CI);
  use `node tools/gen-icons.mjs --check` locally to catch drift.
- **Bespoke marks are the only exception** and stay in `icons.js` (emitted from
  the CUSTOM map in `tools/gen-icons.mjs` — simple computed geometry, never
  freeform hand-drawing): the brand marks (`bluesteel`, `horseshoe`, `hardhat`/
  `mtech`, `mark`, `circle`), the Tabler machine glyphs (backhoe → `CARD_ICON.units`
  + `CATEGORY_ICON.excavator`, bulldozer → `dozer`, crane → `lift`, caravan →
  `trailer`, hammer → `saw`), `clipboard-question` (`inspectionsPending`), the
  gate-timeline glyphs (`GATE_ICON`, app.js), and — after Jac rejected every
  library option for real rental machines (2026-07-03/04) — the bespoke machine
  set: scissor lift, roller, plate tamper, trencher, concrete buggy, telehandler,
  towable lift, auger attachment, stump-grinder wheel. Don't replace any of these
  with library icons without asking; iterate them through Jac's red-mark
  correction loop instead.
- **Animated category glyphs** (Jac, 2026-07-03): the boom-lift / skid-steer
  families render animated SVG loops from `icons-anim.js` (`CATEGORY_ANIM`) — PAUSED
  until the parent row/card is hovered (Jac: no motion until hover, no orange tint) —
  converted BY HAND from Lottie artwork Jac supplied (LottieFiles), NOT from
  `tools/gen-icons.mjs` and NOT hand-drawn. Keyframes live in `style.css`
  ("ANIMATED CATEGORY GLYPHS"); reduced-motion freezes to the rest pose. If Jac
  supplies more Lottie files, convert the same way (nested translate(p)›anim›translate(-a)
  groups so CSS rotations pivot at the Lottie anchors) — don't add lottie-web. The
  excavator conversion was DROPPED (2026-07-03: its artwork read as a track loader,
  not a boom-arm digger) — that family stays on the static Tabler backhoe until
  correct artwork arrives.
- **Category icons are FAMILY-level, not per-model** (Jac, 2026-07-03): the real
  fleet has ~50 rate-card categories (see the `Fleet_Categories` sheet in Drive),
  not the 5 in the `data.js` demo seed. `categoryIconFor()` in `app.js` keyword-matches
  a category name onto one of ~19 equipment-family glyphs in `CATEGORY_ICON`
  (excavator, skid steer, dozer, boom lift, scissor lift, telehandler, towable
  lift, auger attachment, roller, plate tamper, trencher,
  stump grinder, buggy, generator, compressor, pump, trailer, tractor, small-tool
  catch-all) — every size/model in a family shares its icon. An unmatched name falls
  to the neutral `box` glyph, not a machine shape, so a miss is visible instead of
  silently wrong. Add a new family only when an existing one is a genuine mismatch —
  don't reach for per-model glyphs.
