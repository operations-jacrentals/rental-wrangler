# Pills & Flags redesign — approved design (2026-06-15)

Jac's locked per-element selection for the R-Rulebook chip system, chosen from the
round-1→4 drafts. This is the build contract; implemented as an append-only block in
`style.css` (no §5 builder or `data-r` changes, so the R0 lint stays intact), and it
adapts to the active `[data-theme="yard"]` because every value is token-based.

## The eight elements — chosen idiom each

| Rule | Element | Chosen idiom | Treatment |
|---|---|---|---|
| **R1** | Gate pill | **Wells** | Raised steel key: status-tinted gradient face (derived from `currentColor`), top highlight + bottom shadow (reads pressable), Saira-caps label, chevron in a recessed dark "detent" well on the right. `:active` presses in; `:focus-visible` orange ring. |
| **R2** | Linked pill | **mini-R10 chip** | Scaled-down R10 `.c-titlecard`: dark `--bg-2` plate, white bold name (Geist), plain orange leading destination icon, permanent orange border, optional unlink ✕, 8px radius. |
| **R3** | Status badge | **Stamped** | Soft registry-tint pill, parent-card icon, **Saira Condensed uppercase** label, hover underline only. Flat — never raised, never pressable. |
| **R3b** | Data chip | **Stamped** | Gray `--panel-2` plate, `--line` border, Saira-caps, no icon, no hover, `cursor:default`. The quietest chip. |
| **R4** | Derived pill | **Current** | Unchanged: no bg/border, ink + icon only, sits right of its parent. |
| **R4b** | Flashing pill | **Hazard cap** | Derived pill that grows a 2px **red hi-vis hazard tape** cap on its top edge, animated as a slow barber-pole (~1.4s); replaces the opacity pulse. |
| **R9** | Title flags | **Stamped** | ≤2 stacked mini-flags, NO background, ink + small icon, **Saira micro-caps**, hover underline. |
| **R9b** | Flashing flag | **Current** | Title flag, no background, Geist sentence-case, red ink + icon, gentle opacity pulse (existing `flagPulse`). |

## Semantics preserved (unchanged)
green = ready/good · yellow = waiting/caution · red = alert/needed · orange = linked record OR required gate · gray = plain fact. Action (R1) reads pressable; status (R3/R4/R9) reads NOT pressable; derived (R4) lighter/attached; flashing (R4b/R9b) pulls the eye without strobing.

## Implementation
Single append-only block in `style.css` (after the `.flag.alert, .pill.alert` rule),
targeting `.pill.gate`, `.pill.ref.link`, `.pill[data-badge]`, `.pill[data-r="R3b"]`,
`.pill.dvd.alert`, `.flag`, `.flag.alert`. No `app.js` edits. `rule-usage.js`
regenerated (its catalog includes style.css). Quality floor: visible `:focus-visible`,
`prefers-reduced-motion` freezes the hazard barber-pole. Gates: `node ci/smoke.mjs` ·
`ci/logic-test.mjs` · `ci/gen-rule-usage.mjs --check`. Deploy: feature branch → PR →
squash-merge to `main`.
