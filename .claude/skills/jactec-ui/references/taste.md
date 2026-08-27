# taste.md — Jac's revealed preferences (READ FIRST on any UI task)

This is the ledger of what Jac has **actually corrected**, distilled into rules.
It outranks your own aesthetic priors and any generic dashboard instinct. When a
judgment call isn't covered by a token, a rule number, or a law in SKILL.md, the
answer is in here — and if it isn't, the default is **denser and quieter than you
think**, then ask via popup.

## The ledger

Format: `date · what was corrected → the rule`. Never delete an entry; when a later
correction supersedes an earlier one, add the new entry and mark the old one
`(superseded YYYY-MM-DD)`.

- **2026-07-03 · Graph V2 (#450): legend pill column stripped** → Legends and
  chart/section titles are chrome. The selected tab, hover `data-tip`, and `aria`
  names carry naming; series names live in one compact caption row at most — never
  a separate legend column, never a title that repeats the tab.
- **2026-07-03 · Graph V2 (#450): counts moved onto the chart** → Numbers live ON
  the data (slice labels, band-edge values, center totals), not beside it in pills
  or side columns.
- **2026-07-03 · Graph V2 (#450): "Current" label + per-chart titles deleted;
  date-range chips compressed to single-line WK/MO/30D/60D/90D** → Vertical
  footprint is a core cost. Reclaim it: single-line chips, top-aligned layouts,
  kill empty bands and redundant caption lines; full meaning goes on hover.
- **2026-07-03 · Graph V2 (#450): donuts enlarged after the legends were removed**
  → When chrome is removed, size the data marks UP to use the reclaimed room. Don't
  leave a small mark floating in new whitespace.
- **2026-07-03 · Graph V2 (#456): user-facing "compare / Show: A + B" control
  rejected as overkill** → Fixed, opinionated pairings beat user-facing
  compare/config toggles. Decide which data sets ride together (Inspection +
  Service, WO + Field Calls) and ship the pairing; don't ship a configurator.
- **2026-07-03 · Graph V2 (#450): the hazard-stripe seam on the graph section was
  stripped by Jac within minutes of being added** → The stripe is structural plate
  chrome (card cap, login band, drop zones, R4b cap) and is now **opt-in only,
  everywhere**: never apply it — or any signature decoration — unless Jac
  explicitly asks. Inside data surfaces, quiet is correct.
- **2026-07-03 · Graph V2 (#450): auto-select of the smallest slice in orange fill
  removed** → Armed/selected inside a data surface = orange **outline** (+ the
  series' own status color), never an orange fill on a status-colored mark. And
  nothing is auto-selected on open — the default is the whole picture, unfiltered.

## Append protocol (mandatory, same PR)

When Jac corrects a design call in-session — a popup answer that reverses your
choice, a "remove that", a redo — add ONE generalized entry to the ledger above
**in the same PR** as the fix, so the correction is visible in the diff and never
evaporates with the session. Generalize the lesson (the rule a future session
needs), not the incident. Never delete; supersede.
