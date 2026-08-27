# charts.md — the house chart language (Graph V2)

Load for ANY chart / graph / KPI / stat-tile / leaderboard / trend work. The
language was converged with Jac across PR #450 (Units redesign) and #456 (rollout
to every card); the full design rationale is
`docs/superpowers/specs/2026-07-03-units-graph-redesign-design.md`. The engine is
`GV2` + the V2 renderers (`APP-24/25`, `app.js` §13.3–13.5). **Extend that engine —
never build a parallel chart stack.**

## Anatomy of a graph section

```
┌───────────────────────────────────────────────┐
│  INSPECTION   FLEET   WO   #S                  │  group TABS (top; solid orange = selected)
├──────┬─────────────────────────────────────────┤
│ WK   │   donut ←→ stacked area / trajectory    │  time-RAIL (left, single-line chips)
│ MO   │   counts ON the chart · center total    │  — only where a DATED source exists
│ 30D… │                                          │
└──────┴─────────────────────────────────────────┘
```

- **Group tabs on top** replace any chevron/carousel/dots navigation. Selected
  tab = solid orange + dark ink. Naturally-related data sets ride together in ONE
  tab as a **fixed side-by-side pair** (Inspection + Service, WO + Field Calls) —
  never a user-facing compare/config control.
- **Left time-rail** — single-line chips `WK / MO / 30D / 60D / 90D` (full meaning
  on hover), **only where a dated event source exists**. A snapshot-only metric
  (no history) shows Current alone with the rail collapsed — never a broken or
  faked time-series.
- **Snapshot → trend morph:** Current = the snapshot form (donut / tiles /
  leaderboard). Picking a window morphs the SAME metric into a time-series —
  **trajectory line** for single-value counts, **stacked proportional-area** for
  status breakdowns — with today's reality pinned at the right edge.

## Honest denominators

A windowed series derived from an event log answers a different question than the
snapshot ("outcomes of N events in the window" vs "state of the fleet now").
That's acceptable — but **name the shift** (the selected chip + caption/aria carry
it) and **never fabricate history** a source doesn't store. If a metric has no
dated source, it gets no rail; if Jac wants its trend, that's a backend
snapshot-recording feature (via `/clasp`), not a chart trick.

## Labels, not legends

- **No legends. No chart titles. No static period label.** The selected tab + rail
  chip already say what and when; a title repeating them is deleted chrome.
- **Direct labels:** counts on the slices (inside when wide enough, else a short
  leader line), band values at the right edge of stacked areas, center = total +
  unit noun, emphasized endpoint dot + today value on trajectories.
- **Hover + aria carry the rest:** every mark gets `data-tip` (R23) and an aria
  name; marks are keyboard-focusable. A single compact caption row of series
  names is the accessible/click filter path when slices are too small to hit.

## Interaction

- **No auto-select on open.** Default = the whole picture, nothing filtered.
- **Armed/selected = orange OUTLINE** (+ the series' own status color), never an
  orange fill on a status-colored mark (the color law).
- Slices / bands / caption chips toggle the list filter (the `g`-tagged
  `cs.filterTerms` mechanic); per-source tab + timeframe state persists
  (`cs.gvm`/`cs.gvp`, `localStorage`).
- **Empty states always:** "No data in this window." — never bare axes, zero-stub
  bars, or red baseline artifacts. Zero-value bars = faint baseline gridline.

## Color

- **Status data wears registry colors** (green ready · yellow caution · red danger
  · purple scheduled · gray fact) — identical meaning to the pills.
- **Blue is the calm trend hue** for neutral time-series (bookings, opened-WOs,
  Field-Call trajectories) — matching the app's other monthly bars.
- **Red = attention leaderboards only** (Most Field Calls, Biggest Balances).
- Revenue bars: `$k` compact labels, full `$` on hover, red cap = uncollected.
- Orange is NEVER a series color — it means selected/armed/ignition only.

## Size & density

- Donut diameters: **196px single**, **144px paired** (side-by-side). When chrome
  (legend/title) is removed, size marks UP to use the room — no small mark
  floating in whitespace.
- Top-align the section; single-line rail chips; no empty vertical bands. Faint
  gridlines; 2px surface gaps between stacked bands; 2–2.4px trajectory lines
  with a faint area fill.
- AA contrast for on-mark labels (dark ink on green/yellow, white on red);
  `prefers-reduced-motion` freezes any morph/animation to the steady state.

## $-visibility

Revenue / balance / spend views are Office+Owner-sensitive. Before adding any $
chart to a shared or role-ambiguous surface, run the `/role` data-sensitivity
check — margin floors (Bottom Dollar, True Cost, ROI, part cost) on any
Sales-shared or customer-facing surface are an automatic 🔴.
