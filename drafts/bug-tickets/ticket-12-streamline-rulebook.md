# BUG: R-rulebook needs a streamlining deep-dive — rental-status pills don't match the row-slot styling system

**Reported by Jac (verbatim):** "We need to do a deep dive on streamlining the bar rulebook across all of the features now that we've done so much updating. For example, the rental statuses do not match the style of the row slots one and two."

**Area:** design-system

**Status:** AUDIT / streamlining deep-dive — larger than a one-line fix.

**Symptom:** After many UI updates, the R-rulebook / pill-bar system has drifted out of consistency. A concrete example: rental-status pills don't visually match the styling used in List-View "row slots one and two."

**Suspected code locations (the machinery + the cited inconsistency):**
- Rulebook machinery:
  - `rule-usage.js:2` — the generated `window.RULE_USAGE` catalog (R1, R2, R3, R3b, R17, R18…). Auto-generated; do not hand-edit.
  - `ci/gen-rule-usage.mjs` — generator + `--check` drift/duplicate guard (the enforcement).
  - `app.js:4167`+ (`APP-12`, `RB_FOUNDATION`, `RB_TABS`, `ruleOf`) — the in-app Rulebook catalog documenting R0–R24.
  - `app.js:3679`+ (`APP-10`) — the §5 builders, one per rule (`statusPill`, `refPill`, `actionPill`, `gatePill`, `masterGate`).
- The "row slots one and two" system:
  - `app.js:5077-5084` — `DEFAULT_LAYOUT`: each card's `row1` (details, non-badge) vs `row2` (badge pills). Rentals = `row1:[name,category,price]`, `row2:[status,customer,invoice]`.
  - `app.js:5119-5129` — `genericRow`/row template: `row1` non-badge fields, `row2` badge pills; emits `.row-1`/`.row-2`.
  - `style.css:902-913` — `.row-1` / `.row-2` slot styling (sizes, gaps).
- The rental-status pill styling (the mismatch):
  - `app.js:4026` `statusPill(...)` → emits `pill c-${color} data-r="R3"` — R3 status badge. In row-2 this is the rental-status pill (`app.js:4925/4936/4888`, `statusPill('rentalStatus', …)`).
  - `style.css:985-993` — R3 badge style: `border-radius:5px`, `height:22px`, **Saira caps**, 11px.
  - `app.js:4077/4090/4096` `gatePill`/`masterGate` → `pill gate c-${color} data-r="R1"` — the rental-status **gate** (dropdown) used in the Day Timeline / row.
  - `style.css:2419-2421` — R1 gate style: `border-radius:10px`, `height:28px`, 12px, **mixed-case label** (no Saira caps), chevron.

**Root-cause hypothesis (hypothesis):** Rental status is rendered through two different builders with two different visual grammars depending on context: as an **R3 badge** (`statusPill`, 5px-radius, 22px, Saira-caps) inside the row-2 slot, but as an **R1 gate** (`gatePill`/`masterGate`, 10px-radius, 28px, mixed-case, chevron) in the timeline/interactive context. So in the very row where row-1/row-2 slots establish one badge look, the rental status pill can read as a differently-shaped, differently-cased object. More broadly, the pill family (R1 gate, R2 ref/link, R3 badge, R3b data-chip, R17 commit) has accumulated divergent radii/heights/casing/fonts across updates — exactly the streamlining Jac is calling for. This is a system-level audit.

**Acceptance criteria:**
- [ ] An inventory of every pill/bar variant (R1 gate, R2 ref/link/entity, R3 badge, R3b chip, R17 commit, R18 ghost) with its current radius/height/font/casing, mapped against the row-1/row-2 slot baseline.
- [ ] Rental-status pills read consistently with the row-slot badge style (resolve the R3-badge vs R1-gate divergence — same shape/casing family, or a documented, intentional distinction).
- [ ] The Rulebook catalog (`APP-12`) and `rule-usage.js` reflect the streamlined system; `node ci/gen-rule-usage.mjs --check` passes (regenerate without `--check` after changes).
- [ ] No duplicate-rule or catalog drift; spot-checked across rentals, invoices, units, shop, and the Day Timeline.

**Notes / R-rulebook impact:** This is the highest-impact ticket for the R-rulebook itself — it touches the rule definitions, the §5 builders, and the generated `rule-usage.js` (so the `gen-rule-usage --check` gate must stay green). No popups are added/removed, so `WINDOW_CATALOG` / `check-window-catalog.mjs` should be unaffected unless a Rulebook tab popup is reshaped. Must run through the `jactec-ui` skill (it owns the R0–R24 rulebook and the data-plate pill language). Treat as a deep-dive/audit branch, not a quick fix; bump shared `?v=` on deploy.
