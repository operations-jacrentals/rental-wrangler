# Pre-ship checklist

Run this before showing Jac and before any push. If a box can't be ticked, it's not done.

## System fidelity
- [ ] Every color/size/radius/shadow/font is a **token** — zero hardcoded hex / px-shadow / font-name.
- [ ] Every lint-family element is emitted by a **§5 builder** and carries `data-r="Rxx"`.
- [ ] **R0 flash-lint = ZERO** (toggle the bottom-bar eye; nothing pulses red).
- [ ] Orange used ONLY for selected tab · ignition/primary · linked (R2). Dark `--on-orange` ink on every orange surface.
- [ ] Two type voices kept separate: Saira Condensed (stamped labels) vs Geist (read). No system sans on labels.
- [ ] Status color used per the fixed registry; action color per R17 (commit/money/danger). Nothing invented.
- [ ] If a rule/token changed: `RULE_META` + `RB_FOUNDATION` + `RB_TABS` updated in the same edit.

## Accessibility (verify, don't eyeball)
- [ ] AA contrast (≥4.5:1 text, ≥3:1 large/UI) in **dark, light, and yard/ranch**.
- [ ] Meaning never by color alone (color + label + icon).
- [ ] Visible `:focus-visible` on every interactive element.
- [ ] Every animation degrades to steady under `prefers-reduced-motion`.
- [ ] Touch (long-press R20 + tap) reaches every action; nothing hover-only that matters.

## Craft (the safe-rules layer)
- [ ] No pure `#000`/`#fff`; no dead/off-temperature greys.
- [ ] High contrast spent only on what leads; structure recedes.
- [ ] Depth by lightness + the two defined elevations/rings; **no new drop shadow on dark**, no mixed elevation across siblings.
- [ ] One spacing scale; outer padding ≥ inner; nested radii = outer − gap.
- [ ] Icons dimmed to text weight; one divide per boundary; glyphs optically aligned.
- [ ] Density honors a minimum legible size — split views rather than shrink past it.

## Density & charts (Jac's revealed taste — `taste.md`)
- [ ] No legends; no chart/section titles that repeat the tab; no static period labels.
- [ ] Counts/values folded ONTO the data (slices, band edges, center totals); hover `data-tip` + aria carry naming.
- [ ] Vertical footprint reclaimed: single-line chips, top-aligned, no empty bands; marks sized UP where chrome was removed.
- [ ] Chart work follows `charts.md`: time-rail only where a dated source exists; honest denominators; empty states ("No data in this window."); no auto-select on open; armed = orange OUTLINE.
- [ ] Fixed opinionated pairings — no user-facing compare/config toggles.

## Identity & motion
- [ ] NO signature device (hazard stripe, rivets, texture) added unless Jac explicitly asked; existing uses untouched. Where asked-for: chrome only, never behind text.
- [ ] Nothing decorative added to "fix plain" — quiet is correct; genericness addressed structurally or asked via popup.
- [ ] Motion fast + crisp, named keyframes only; no `transition: all .2s`, no bounce, no scattered micro-interactions.
- [ ] Ranch reads industrial-first (copy + a little tan); no western skin.
- [ ] No template hero / ornamental 01·02·03 / decorative gradient-glass.
- [ ] Treatment mirrored across themes (not shipped in one only).

## Process & ship
- [ ] `taste.md` read before designing; any in-session Jac correction appended to it in this same PR.
- [ ] Options-first loop fired for new/reshaped UI (2–3 variants → Jac picked via popup) — and correctly SKIPPED for single-element edits/copy/token tweaks/bugfixes.
- [ ] Design approved (if `brainstorming` opted in, spec saved to `docs/superpowers/specs/`).
- [ ] Decisions asked via `AskUserQuestion` popup, not inline.
- [ ] Self-critique screenshot reviewed; "removed one accessory."
- [ ] Gates green: `node ci/smoke.mjs` · `node ci/logic-test.mjs` · `node ci/gen-rule-usage.mjs --check` (regen without `--check` only if rule USAGE changed) · `node ci/check-window-catalog.mjs` · `node tools/gen-code-map.mjs --check`.
- [ ] Ship via feature branch → PR → squash-merge to `main` (branch-protected; push = live). No model ids / secrets / passwords in the repo.
