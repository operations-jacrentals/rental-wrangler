# Card header redesign — one-row header, gear options & Custom Views — design

**Date:** 2026-07-03
**Status:** Design **approved** (Jac, 2026-07-03) · **/role audit passed** — fixes folded (§16) → implementation plan
**Branch:** `claude/wrangler-dashboard-space-h2nu0i`
**Mockups (hosted):**
- One-row + space reclaim — `claude.ai/code/artifact/0a9e2a2e-e7d3-4694-a06a-07203471bb25`
- Assembled (one gear, three levels) — `claude.ai/code/artifact/9fca1502-aa9a-4d0b-b3bf-55b5e9a4ecda`

## 1. Problem & goal

The dashboard cards spend **two rows** of chrome before the first data row: the
toggle row (`colTabsEl`, `app.js:6822`) **and** the list search/sort bar
(`listbar`, `app.js:6926`). Measured from `style.css`, ~200 px stacks up before
a unit/rental/customer appears — ~25–33 % of a laptop viewport. Separately, the
sort control is a cramped "Views & sort" dropdown (`openViewMenu`,
`app.js:11831`) Jac has flagged as **not good enough** and wants completely
rethought.

**Goal:** collapse the header to **one row at rest**, and replace the sort
dropdown with a cleaner model — a single **gear** that drops a row of per-card
**quick-filter options** (built from the card's gates), the graph toggle, and a
third row of user-made **Custom Views**. Resting state stays one row, so the
vertical-space win holds.

**Success:** on load, a card is a single ~46 px row (toggle + search + gear).
Filtering, sorting, graphing, and saved views are all reachable without a
permanent second row. Combined with the compact KPI rings (separate change),
the first data row rises from ~200 px to ~134 px (~66 px / ~33 % reclaimed).

## 2. Scope (settled with Jac)

- **Dashboard list cards** (`cardEl` list view: units, categories, rentals,
  customers, invoices; shop deferred — may be removed). Standard/record view and
  the calendar card are out of scope.
- **KPI-ring compaction** (the other ~14 px) is a **sibling change**, specced by
  the space mockup; this doc covers the **card header** only. Rings stay (all
  five + "Coming 2026"), just rendered at the compact size.
- **Backend:** none. Pure front-end (`app.js`, `style.css`, `config.js`).
- **`/role` audit runs before build** — Custom Views may filter to money/PII
  states (Unpaid, Collections, Bill), so the data-sensitivity lens applies.

## 3. Row 1 — the header (always visible)

Left → right, one flex row (replaces both `colTabsEl` and the current `listbar`
top strip in list view):

1. **Toggle — icon-first** (`colTabButtonsHtml`). The card's members as a
   segmented control. **Every** member shows its `memberIcon` glyph + count
   chip; **only the active** member also shows its text label (`.ct-lbl`).
   Today the label shows on all members and merely truncates
   (`style.css:476`, and phone just grows the tabs taller — `style.css:368`);
   this change **hides `.ct-lbl` on non-active tabs** on both desktop and phone,
   so the toggle stays short regardless of member count. Alert state (red ring on
   Shop) is unchanged.
2. **Search field — fills the remaining width** between the toggle and the gear
   ("fills the difference"). Reuses the current `mini-searchwrap` / `mini-search`
   input + pinned filter-term chips (`filterTermPill`). Placeholder
   `Search {card}…`.
3. **Sort direction ▲▼** — inline at the **right end of the search field**. No
   dashed divider, no cutoff sub-box, minimal padding (drop the current
   `.sort .dir` border-left seam). Tap = flip asc/desc (`js-sortdir`, unchanged
   behavior; new placement).
4. **Gear** — one icon button at the far right. The single "options" control
   (replaces today's three-way of graph button + sort chip). Tap = toggle Row 2.

Resting state is Row 1 only. Toggling the gear off collapses Rows 2/3 — this is
what preserves the ~66 px reclaim.

## 4. Row 2 — Options (drops when the gear is tapped)

A horizontal strip of the card's **default quick-filter buttons** plus the graph
toggle plus an overflow control:

- **Default option buttons — TEXT ONLY, no icons** (§6 for the per-card sets).
  Each is a one-tap filter to a gate stage, a derived state, or a **composite**
  (a union of states — §7). Icons are reserved for Custom Views (Row 3).
- **Graph** — the existing `bv-btn` (`app.js:6935`) moves here as one option. It
  keeps its bar-chart glyph because it is an **action/toggle**, not a filter (the
  no-icon rule applies to filters). Lit orange when graph view is active.
- **⋯ three-dot** — at the end of the row. Opens Row 3 (Custom Views).

**Selection model:** **multi-select (AND)** — options toggle independently and
stack; several can be active at once (e.g. On Rent + Not Ready), each lit orange.
Active options AND together and AND with the free-text search + pinned chips. A
composite (Bill/Out) contributes its internal union as one AND-term.

**Overflow:**
- **Desktop:** the row **truncates** to the card width (a horizontal scrollbar
  reads as broken inside the 3-column grid). Options that don't fit fold into the
  **⋯** menu (above the Custom Views).
- **Mobile:** the row **scrolls horizontally** (`overflow-x:auto`), so every
  default is swipeable.

**Defaults are fixed:** the per-card default options are permanent (not
removable); only Custom Views (Row 3) are user-added/removed. No removed-default
state to persist.

## 5. Row 3 — Custom Views (opens from the ⋯)

User-made saved views — each a one-tap button **with an icon** (the only filter
buttons that carry icons). A Custom View captures the current **search text +
pinned filters + sort** (the existing `viewSig` model, promoted from the
`openViewMenu` list to a button row). A **+ New** affordance sits at the end.

**Scope:** Custom Views are **personal per operator** — each logged-in user keeps
their own set; the team shares only the defaults. Creation is un-gated (anyone
adds their own), dropping the current admin-only `Add view` gate. Storage keys to
`currentUser` (§10).

## 6. Default options — per card

Text buttons, in order. `∑` marks a **composite** (§7). Filters reuse existing
status/derivation helpers; exact predicates finalize during planning.

### Rentals — gate: Rental Status
| Button | Filters to |
| --- | --- |
| Today | derived display status `Today` (`deriveDisplayStatus`) |
| Tomorrow | derived display status `Tomorrow` |
| Reserved | `rentalStatus = Reserved` |
| On Rent | `rentalStatus = On Rent` |
| End Rent | `rentalStatus = End Rent` |
| **Bill ∑** | overdue rentals · unpaid rentals · quotes · off rent · any other billing issue (§7) |

### Units — gates: Inspection · Fleet (+ schedule)
| Button | Filters to |
| --- | --- |
| Not Ready | `unitInspectionStatus = Not Ready` |
| Failed | `unitInspectionStatus = Failed` |
| Available | **canonical availability** — rentable now: `Active` AND not out AND not Failed / Not Ready / For Sale / Inactive / Sold (§16) |
| Today | units on a rental going out **today** |
| Tomorrow | units on a rental going out **tomorrow** |
| Reserved | units on a `Reserved` rental |
| **Out ∑** | unit status ∈ { On Rent, End Rent, Off Rent } (§7) |

### Customers — gates: Account Type · Customer Pay · Funnel
| Button | Filters to |
| --- | --- |
| Active | active customers (has live rental / not lost) |
| Lost | lost customers |
| Member Funnel | in the membership funnel |
| Used Funnel | in the used-equipment **Sales** funnel (distinct pipeline from membership — §10 note) |
| Members | `accountType` ∈ member types |
| Business | `accountType = Business` |
| Non-Business | `accountType = Non-Business` |
| Unpaid | `customerPayStatus = Unpaid` |

### Invoices — gate: Invoice (derived)
| Button | Filters to |
| --- | --- |
| Not Due | `invoiceStatus = Not Due` |
| Unpaid | `invoiceStatus = Unpaid` |
| Late | `invoiceStatus = Late` (+ Late+30/60/90) |
| Partial | `invoiceStatus = Partial` |
| Refunded | `invoiceStatus = Refunded` |
| Collections | `invoiceStatus = Collections` |

### Deferred / none
- **Shop** — skipped; the card may be removed soon.
- **Categories** (aggregates, no gate) and **Calendar** (date grid) — no default
  options unless Jac requests a set.

## 7. Composite options

A composite is a single button whose predicate is a **union** of states, so one
tap covers a workflow bucket:

- **Rentals · Bill ∑** = overdue rentals ∪ unpaid rentals ∪ quotes (`Quote`) ∪
  off rent (`Off Rent`) ∪ any other billing issue. Implemented as a predicate
  over `rentalStatus` + linked-invoice status; the exact "other billing issue"
  set is enumerated during planning against `invoiceTotals`/`rentalDisplayStatus`.
- **Units · Out ∑** = unit rental status ∈ { On Rent, End Rent, Off Rent }
  (`unitStatus`).

Composites render with a dashed border (visually distinct from single-state
options) and a tooltip listing the bundled states.

## 8. Sort — direction & field

- **Direction:** the ▲▼ inline in the search bar (Row 1). Tap = flip
  (`js-sortdir`).
- **Field:** **right-click the ▲▼** → a **sort-only context menu** listing **all
  `SORT_FIELDS[card]` and nothing else** (`config.js:397`). No views, no filters
  — a dedicated sort picker. Long-press on mobile. This replaces the "Sort"
  section of the retired `openViewMenu`.

## 9. Creating & removing Custom Views (R20 context menus)

- **Create:** right-click the **search bar** → R20 context menu item **"+ View"**
  (captures current search + pinned filters + sort). This opens an
  **icon-library popup** — a grid of the vendored **Lucide** icons (per the icons
  rule; sourced from `icons.js` / `tools/gen-icons.mjs`, never hand-drawn) — to
  pick the button's glyph; then name and save. The view appears in Row 3.
  Long-press on mobile.
- **Remove:** right-click a **Custom View button** → **"Remove View."**
  Long-press on mobile.
- Both hang off the existing R20 `openCtxMenu` system (same as menu-driven
  linking), so no new always-on chrome.

## 10. Data model & config

- **Default options:** a new per-card map in `config.js`, e.g.
  `CARD_OPTIONS[card] = [{ id, label, kind: 'gate'|'derived'|'composite',
  predicate }]`. Composites (`Bill`, `Out`) carry a predicate function; single
  gate/derived options carry the status set + value. Reuses existing helpers
  (`deriveDisplayStatus`, `unitStatus`, `invoiceTotals`, `rentalDisplayStatus`).
- **Custom Views (personal):** extend `loadViews`/`saveViews` (`app.js:11794`) to
  key storage by **operator** (`currentUser`) instead of one shared set, add an
  **`icon`** field (Lucide name), and drop the admin-only add gate. Per-view shape
  `{ name, search, terms, sort, icon }`. **Isolation (§16):** key server-side, or
  at minimum namespace per operator **and clear on logout**, so a shared terminal
  never serves one operator's views to the next.
- **Sort fields:** unchanged (`SORT_FIELDS[card]`).
- **Active options / open state:** per-card UI state on `session.cards[card]` —
  `activeOptions` (a **set/array**, since options multi-select AND) plus
  `optionsOpen` / `customOpen` for the gear and ⋯ rows — alongside the existing
  `search`/`filterTerms`/`sort`/`graphView`.
- **Used-equipment Sales funnel:** a pipeline **distinct** from the membership
  funnel. If the data doesn't already carry a sales-funnel stage separate from
  `membershipStage`/`funnelStage`, that field is defined during planning — flag it
  before the Customers `Used Funnel` predicate can be built.

## 11. Components touched

- `app.js`
  - `colTabButtonsHtml` / `colTabsEl` (`6822`, `6831`) — icon-first toggle; label
    on active member only.
  - `listView` / `listbar` (`6917`, `6926`) — restructure into Row 1
    (search + ▲▼ + gear) and the droppable Row 2 (options + graph + ⋯) / Row 3
    (custom views). Move the `bv-btn` graph (`6935`) into Row 2.
  - New builders: options row, custom-views row, gear toggle handler, sort-field
    context menu, icon-picker popup, `+View`/`Remove View` R20 menu items.
  - Retire `openViewMenu` (`11831`) — split into the sort-field menu (§8) + gear
    options (§4) + custom views (§5).
- `config.js` — `CARD_OPTIONS` (§10); `SORT_FIELDS` reused.
- `style.css` — Row 1 layout, `.opt` / `.opt.combo` / `.opt.graph` / `.opt.more`,
  Row 3 `.cv`, sort ▲▼ inline (drop `.sort .dir` seam), gear button, desktop
  truncation vs mobile `overflow-x:auto`.

## 12. Decisions (resolved with Jac, 2026-07-03)

1. **Custom View scope — personal per operator** (keyed to `currentUser`, not a
   shared set). §5, §10.
2. **Option selection — multi-select (AND)** — options stack. §4.
3. **"Used Funnel" — the used-equipment Sales funnel,** a pipeline distinct from
   membership. §6, §10 note.
4. **Desktop overflow — truncate;** excess defaults fold into the **⋯** menu.
   Mobile scrolls horizontally. §4.
5. **Defaults are fixed** (not removable); only Custom Views add/remove. §4.

## 13. R-Rulebook · icons · CI

- New UI elements get `data-r` stamps; regenerate `rule-usage.js`
  (`node ci/gen-rule-usage.mjs`).
- New popups — the **icon-picker** and the **sort-field context menu** — get
  `WINDOW_CATALOG` entries (`ci/check-window-catalog.mjs`).
- All glyphs come from the library (Lucide via `tools/gen-icons.mjs`); the
  icon-picker enumerates that vendored set. No hand-authored `<path>`.
- Gates before push: `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
  `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`,
  `node tools/gen-code-map.mjs --check`.

## 14. Vertical-space payoff

- Today: toggle row (~40 px) + `listbar` (~44 px) = ~84 px of card chrome.
- Proposed: one row (~46 px) at rest; Rows 2/3 are on-demand.
- ≈ **−38 px per card** from the merge; with compact rings, the first data row
  moves from ~200 px → ~134 px (**~66 px / ~33 %**).

## 15. Testing

- `ci/smoke.mjs` — boots, cards render one row at rest, gear toggles Row 2.
- `ci/logic-test.mjs` — option predicates filter correctly (esp. composites
  `Bill`/`Out`) and compose with search + sort; money/derived states
  (Unpaid, Collections) filter to the right records.
- Manual (local `serve.mjs`, `localhost:9147`): icon-first toggle label follows
  selection; ▲▼ direction + right-click sort-field menu; `+View` → icon picker →
  Row 3; `Remove View`; desktop truncation vs mobile horizontal scroll.
- Mobile: the sort ▲▼ long-press target and the icon-picker cells meet the ≥44 px
  touch floor; `+View` / `Remove View` are reachable by long-press.
- Role projection (§16): each role sees only the options its tier allows — money
  and funnel filters absent for operational roles; no option widens a list.

## 16. Access & role projection (from /role audit, 2026-07-03)

The audit cleared the fundamentals — no margin-floor exposure, no authority
escalation, no new gates — but flagged that the options surface must be
**role-projected**, not built role-blind. Enforcement is **server-side**; hiding an
option in the UI is presentation, not access control.

- **Options & Custom Views are gated to the data tier each filter reads** — render
  only what a role may see, mirroring the field-level gating the cards already do:
  - **Money-state** filters — Rentals `Bill`, Invoices `Unpaid / Late / Partial /
    Refunded / Collections` — **Office / Owner only**. Not shown to Dispatcher /
    Driver / Mechanic / M.Tech (they know a rental exists and where it goes, never
    its balance). The Invoices card is already Office/Owner, which covers its set;
    the Rentals `Bill` option needs explicit suppression for the operational roles.
  - **CRM / funnel** filters — Customers `Member Funnel`, `Used Funnel`, `Lost` —
    **Sales / Marketing / Office / Owner only**. Operational roles get only the thin
    customer slice (name / account-type), never funnel-stage segmentation.
  - **Maintenance / availability** filters — Units `Not Ready`, `Failed`,
    `Available`, `Out` — shop / fleet / asset / owner (availability is broadly OK).
- **Filters only ever narrow the already-authorized list.** Every option and
  custom-view predicate runs over the role-scoped set the card already produces
  (`listFor(card, session)` / `unitsVisible(...)`), never a raw query. A filter can
  subtract rows; it can never add a row the role couldn't otherwise reach. (Custom
  views are user-authored predicates, so this guarantee is stated explicitly.)
- **Personal Custom Views isolate per operator** (§5, §10) — server-side or
  namespaced-per-`currentUser` + cleared on logout.
- **Internal-only surface** — these cards and options must never project into the
  customer self-service portal (a separate, row-isolated build).
