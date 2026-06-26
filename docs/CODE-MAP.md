# The Code Atlas — Rental Wrangler

> **What this is.** A narrated table-of-contents for the whole codebase — a
> "chapter book" you read to find, edit, and debug any line fast. It does **not**
> change how the code works; it tells you *where* everything lives and *why it's
> there*. When you need to touch the code, find the chapter here first, then jump
> to the `file:line`.
>
> **Two files, one map.** This file is the *story* (hand-written). Its companion
> [`code-map.generated.md`](./code-map.generated.md) is the *index* (machine-owned,
> produced by `tools/gen-code-map.mjs`) — it holds the live line numbers and the
> full key-symbol lists, and a CI `--check` keeps it honest. When code moves,
> regenerate the index; the chapter **IDs** below stay stable.

---

## How to read this map

- The app is one SPA: `index.html` loads **`app.js`** (the engine, ~15.7k lines)
  plus six ES-module siblings (`config.js`, `data.js`, `cascade.js`,
  `icons.js`, `agreements.js`, `service-countdown.js`) and **`style.css`**.
- `app.js` is divided into **chapters** marked by `═` banners. Each chapter has a
  stable **ID** (`APP-01` … `APP-38`) and usually a legacy **`§`-anchor** (e.g.
  `§3`) that ties back to SPEC v8. *We never renumber `§`* — the IDs are the
  stable handle; the `§`s are preserved as-is. The IDs are **stamped into the
  banner comments**, so `grep "APP-19" app.js` jumps straight to that chapter
  (here, the Shop card). The generator verifies each stamp still matches its
  file order, so a stray reorder fails `--check`.
- The chapters do **not** sit in reading order in the file (history bolted later
  features in wherever they fit — e.g. `§13.3/§13.4` land before `§12`, and `§17`
  / `§18` each appear twice). **This map supplies the reading order** via *Acts*.
  The "Found in file order" table at the bottom is the as-it-sits-on-disk view.

**The data-flow story (the one rule that explains the whole app):**
> One normalized `state` object. UI **renders from state** → a user action
> **mutates state** → the app **re-renders**. Records reference each other **by
> ID**; everything else is **derived**, never stored. So: to change *what shows*,
> find a **builder/renderer** (Acts III–VI); to change *a number*, find a
> **derivation** (Act II); to change *what a click does*, find an **action**
> (Act VIII) or an **event handler** (Act VII).

---

# Part I — The Frontend

## Act I — Foundations: boot, data, utilities, state
*Start here. The ground the whole app stands on: where data comes from, the tiny
helpers everything uses, and the one state object.*

- **`data.js`** (chapter `DATA`, 199 lines) — the demo/seed dataset (`DATA.*`):
  customers, units, categories, rentals, invoices, work/service orders,
  inspections, vendors, expenses, parts, files. _Edit here when:_ changing the
  shape or seed of a record type.
- **`config.js`** (chapter `CFG`, 524 lines) — the constants & registries (see
  [§ config.js detail](#configjs--the-registries) below): colors, statuses,
  flags, roles, KPIs, card registry, pricing/transport maps, tax inputs.
  _Edit here when:_ adding a status value, a role, a card, a flag, a column key.
- **`cascade.js`** (chapter `CASC`, 208 lines) — the **cascade engine**: clicking
  a pill filters related cards (the "anchor → cascade" mechanic). _Debug here
  when:_ a pill click filters the wrong card or won't clear.
- **`APP-01 · §0.7 Glitch Capture** — `app.js:29`. A tiny ring buffer of recent
  JS errors so a glitch handed to Mr. Wrangler carries what actually broke.
  `ERR_LOG`, `logErr`, `wranglerIssueUrl`. _Debug here when:_ you need the
  boot-time error trail.
- **`APP-02 · §1 Utilities & Formatting** — `app.js:62`. The atoms: `$`, `el`,
  `esc`, `money`, `num`, date helpers. _Edit here when:_ changing how money/dates
  format everywhere.
- **`APP-03 · §2 Indexes & Search** — `app.js:78` (§2, §3). Built once on load:
  `IDX` lookups, the customer/rental migrations, the per-record search blobs.
  _Debug here when:_ search misses a record, or a lookup-by-ID is stale.
- **`APP-07 · §4 State & Sessions** — `app.js:1795` (§4, §0.1). The `state`
  object, sessions, anchors, the invoice-id counter. `state`, `freshSession`,
  `setAnchor`, `nextInvoiceId`. _Edit here when:_ adding a piece of session state.

## Act II — Derivations & the Money Engine
*Every dollar, due-date, and status the user sees is computed here from stored
facts. If a number is wrong, it's almost always in this Act.*

- **`APP-04 · §3 Derivations** — `app.js:841` (§3, §10). Rental price + rate
  combo, transport cost, invoice subtotal/tax/total, per-unit statuses,
  countdowns. `rentalPrice`, `unitRentalPrice`, `transportCost`, `invoiceTotals`,
  `TAX_RATE` (`app.js:1528`, 10.75%). _Debug here when:_ a price, tax, or status
  pill is wrong.
- **`APP-05 · Rental Extensions** — `app.js:942`. Lengthening a window re-prices
  the rental across its ≤28-day invoice series. `rentalInvoices`,
  `invoiceChunks`, `unitExtensionDelta`, `INV_CAP_DAYS`. _Debug here when:_ an
  extension bills the wrong amount or opens the wrong invoice chunk.
- **`APP-06 · Inline Transport Editor + Google Maps** — `app.js:1216`. The
  per-leg delivery/recovery editor, live map, drive-distance pricing.
  `openTransportEdit`, `loadGoogleMaps`, `mountTransportEditor`. _Debug here
  when:_ the map won't mount or a transport leg mis-prices.
- **`service-countdown.js`** (chapter `SVC`, 138 lines) — service-due math
  (`serviceOrdersForUnit`, `completeService`, `SERVICE_TASKS`); the reference
  module Act II derivations call for service urgency.
- **`agreements.js`** (chapter `AGR`, 151 lines) — the rental-agreement text +
  version registry (`AGREEMENTS`, `AGREEMENT_VERSIONS`, `AGREEMENT_CURRENT`).

## Act III — The Design System: drawing the yard
*The "yard data-plate" look made executable. One builder per design rule; every
visible element is stamped `data-r="Rxx"`. Change how things **look** here.*

- **`APP-08 · §5a Icons** — `app.js:2432`. Pointer to `icons.js`; bespoke glyph
  notes. Companion module **`icons.js`** (chapter `ICON`, 110 lines): `I`,
  `CARD_ICON`, `RING_ICON`, vendored Lucide + bespoke marks. _Never hand-draw an
  icon — see CLAUDE.md → Icons._
- **`APP-09 · Settings Board** — `app.js:2440`. Admin customization
  (`config.settings`): status icon overrides, KPI rings, etc. `loadAdminSettings`,
  `applySettings`, `persistAdminSettings`.
- **`APP-10 · §5 UI Builders** — `app.js:3679`. The R-rulebook builders — one
  function per rule (R1 gate pill, R2 entity pill, R5 add affordance, R17 action
  pills, R22 close ✕, the popup plate…). `statusPill`, `refPill`, `actionPill`,
  `popupShell`. _Edit here when:_ changing how any pill/button/field is built.
- **`APP-11 · Flag-driven Color Engine** — `app.js:3700`. What color a record
  shows = its highest active flag. `getEntityFlags`, `getEntityColor`,
  `FLAG_COND`. _Debug here when:_ a row/pill is the wrong color.
- **`APP-12 · Design-System Catalog (the Rulebook)** — `app.js:4167`. The admin
  "Rulebook" overlay that documents R0–R24. `RB_FOUNDATION`, `RB_TABS`, `ruleOf`.

## Act IV — The Cards: rows, columns, details, grid, shop
*The six-card grid and everything inside a card: the list rows, the column
registry + totals, the standard-view detail renderers, and the merged Shop card.*

- **`APP-13 · §6 List Rows** — `app.js:4335`. Row metadata + the universal row
  template. `ROW_META`, `rowViz`, `categoryIconFor`.
- **`APP-14 · §6b Per-card Rows** — `app.js:4446`. `rowEl`, `genericRow`, the
  `ROWS` per-card registry.
- **`APP-15 · §7 Column Registry & Footer Totals** — `app.js:4724`. One source of
  truth per card for columns + aggregates. `CARD_COLUMNS`, `aggColumn`,
  `LIST_LAYOUTS`. _Edit here when:_ adding/removing a list column.
- **`APP-16 · §8 Detail Renderers** — `app.js:4921`. The standard-view bodies:
  `kv`, `efld`, `notesSection`, WO sections, the yard-tool, inspections.
  _Edit here when:_ changing what a record's open card shows.
- **`APP-17 · §9 Cards & Grid** — `app.js:6276`. `cardEl`, `listView`, sorting,
  windowed render, the 3-column shell entry.
- **`APP-18 · 3-Column Layout** — `app.js:6371`. The display-only 3-wide shell
  over the cards. `columnEl`, `memberCardEl`, `goToCard`, mobile card switching.
- **`APP-19 · §10 Shop Card** — `app.js:6652`. Work Orders + Service Orders +
  Inspections merged into one card. `shopItemsByType`, `shopUrgency`,
  `shopCardEl`, `shopRowColor`.

## Act V — Header, KPIs, Comms & Graphs
*The top band (logo + KPI rings), the bottom comms band, the admin KPI engine,
and the per-card graph overlay.*

- **`APP-20 · §11 Header, KPI & Bottom Bar** — `app.js:6846`. `bandColor`,
  `ringsSVG`, `fleetInsp`, the header/bottom-bar builders.
- **`APP-21 · §11b KPI Metric Engine** — `app.js:6970`. Admin-definable KPIs +
  rings. `kpiEval`, `KPI_DEFAULTS`, `kpiBand`. _Debug here when:_ a ring shows the
  wrong percentage.
- **`APP-22 · Coming 2026** — `app.js:7140`. The roadmap morale plate + the
  bottom-bar/comms shell + mobile card nav. `ROADMAP_ITEMS`, `bottomBarEl`,
  `goToCard`.
- **`APP-23 · §17 Internal Team Dock** — `app.js:7350`. The bottom-bar team chat
  (the "Phase 7" dock). `newChat`, `openChat`, `chatFeed`, `chatUnreadCount`.
- **`APP-24 · §13.3 Card Graph View** — `app.js:8121`. The per-card charts
  overlay. `pieSVG`, `gvBars`, `gvPieTile`, `unitGraphData`.
- **`APP-25 · §13.4 Graph Carousel** — `app.js:8227`. The per-card graph as a
  swipeable deck. `graphViewsFor`, `gvOpen`, `toggleGraphSeg`.

## Act VI — Overlays & Mr. Wrangler
*Every popup/board, the window catalog, and the in-app AI that can read and act
on your data.*

- **`APP-26 · §12 Overlays & Boards** — `app.js:8673`. `renderOverlay` + the
  back-office board popups + `buildPopupEl`. _Debug here when:_ a popup won't open
  or dismiss.
- **`APP-27 · RB-Windows Catalog** — `app.js:9547`. The Rulebook "Windows" tab
  index of every popup (`WINDOW_CATALOG`, gated by `ci/check-window-catalog.mjs`).
  _Edit here when:_ you add or remove a popup window (CI fails otherwise).
- **`APP-28 · §18 Mr. Wrangler** — `app.js:9642`. The AI chat (Claude via the
  Apps Script backend). `WRANGLER_SYSTEM`, `wranglerSend`, `parseWranglerAction`.
- **`APP-29 · Mr. Wrangler Acts** — `app.js:9907`. The allow-listed data actions
  the AI can preview/apply. `wrValidatePlan`, `wrCreateCustomer`, `WR_EDITABLE`.
  _Security-sensitive — keep edits on the main session._

## Act VII — Interaction: dropdowns, render, events, drag, date search
*The single render pipeline and the one listener tree; how clicks, drags, and the
date picker turn into actions.*

- **`APP-30 · §13 Dropdowns** — `app.js:10590`. The shared floating dropdown +
  status/fleet/funnel/sort menus + the gate timeline. `openDropdown`,
  `openStatusDropdown`, `gateTimeline`.
- **`APP-31 · §14 Render Pipeline + toast** — `app.js:10860`. `render`,
  `applyTitles`, tooltips, `toast`. _The heartbeat: every state change ends here._
- **`APP-32 · §15 Event Handlers** — `app.js:10985`. The single click/input/change
  listener tree (delegated). _Debug here when:_ a click does nothing.
- **`APP-33 · §15c Drag & Drop Link Engine** — `app.js:10989`. The custom pointer
  engine (link by drag, the cancel arc, haptics). `initDrag`, `DROP_MATRIX`,
  `dragDown`. _Debug here when:_ a drag-link won't drop.
- **`APP-36 · §5.4d Date Search Picker** — `app.js:14367`. The standalone
  calendar that reuses the rental window grid. `openDateSearch`, `dsPickDay`.

## Act VIII — Mutations & Money Movement
*Where state actually changes, and where real money moves through Stripe. Highest
blast radius — read the chapter before editing.*

- **`APP-34 · §16 Actions / Mutations** — `app.js:12428`. Every state change
  funnels through here: condition/wash, captures, WO/invoice lines, +New, the
  logo menu. `commitAction` lives in Act VIII's neighbor below. _Edit here when:_
  changing what an action *does* to state.
- **`APP-35 · §17 Stripe / Payments** — `app.js:13339`. Card-on-file + invoice
  charging (client side). `getStripe`, `canMoney`, `openAddCard`,
  `friendlyPayErr`. _Security/auth-sensitive — `canMoney` gates money to
  Office/Admin; keep edits on the main session._

## Act IX — Persistence & Backend Sync
*How the app saves: localStorage + the Google Apps Script web app over the Sheet
that is the real database.*

- **`APP-37 · §18 Persistence & Boot** — `app.js:14808`. The boot sequence entry.
- **`APP-38 · §18b Backend Sync** — `app.js:14811`. The Apps Script web-app
  client: load on sign-in, debounced save, snapshots. `BACKEND_URL`,
  `backendCall`, `loadFromBackend`, `dataSnapshot`, `PERSIST_KEYS`. _Debug here
  when:_ data won't save/load or the password gate fails.

---

## config.js — the registries
*Already well-sectioned with `/* ── … ── */` headers and `§`-anchors. The map of
its sections (grep the header text to jump):*

| Section | Line | What |
|---------|-----:|------|
| Color tokens (§6.1) | `config.js:18` | `COLOR_TOKENS`, `colorVar` |
| Stripe publishable key | `config.js:29` | `STRIPE_PUBLISHABLE_KEY` (public by design) |
| Google Maps key | `config.js:39` | `GOOGLE_MAPS_KEY` |
| Status registry (§8/§6.2) | `config.js:46` | `RAW_STATUS`, `STATUS`, `getStatus` |
| Flag-driven color (flag-color-system) | `config.js:209` | `FLAG_META`, `FLAG_SEVERITY_RANK` |
| Legacy → canonical map (§8/§13) | `config.js:280` | `LEGACY_MAP` |
| Transport-on-status (§8) | `config.js:293` | `showsTruck`, `TRUCK_STATUSES` |
| Roles, KPIs & dashboards (§11) | `config.js:301` | `ROLES` |
| Card registry (§5.5/§0.4) | `config.js:315` | `GRID_CARDS`, `SHOP_TYPES`, `BACKOFFICE_BOARDS` |

_Edit here when:_ adding a status, role, card, flag, color token, or transport
rule. (Pricing/transport math also pulls from here — `computeTransportPrice`,
`TRANSPORT_MAP`, `legsForType`.)

## style.css — the stylesheet
*3,386 lines, sectioned with `/* ── … ── */` and `§`-anchors that mirror app.js.
Major regions (grep the header to jump):*

| Region | Line | What |
|--------|-----:|------|
| §6.1 Color tokens | `style.css:8` | the CSS variables (`--accent`, `--yellow`, `--red`, …) |
| Reset / base | `style.css:62` | base, no-vertical-scroll rule (§0) |
| App frame | `style.css:88` | the shell |
| Header (§5.1) + KPI rings (§5.2/§11) | `style.css:91` | floating header, rings, gamification flash |
| Coming 2026 | `style.css:156` | the roadmap plate + gleam |
| Tabs / cascade chip / search bar (§5.4) | `style.css:199` | item tabs, filter-term builder |
| 3-column layout | `style.css:292` | the grid columns |
| §M0–§M5 Mobile | `style.css:300`+ | responsive reflow, touch floors, bottom sheets, the winpicker |
| Cards-on-file / payment picker (§14) | `style.css:494` | Stripe UI |

_Edit here when:_ changing any visual style. Run new/changed UI through
`/jactec-ui` + `/frontend` (CLAUDE.md → Design language).

---

## Reverse index — "I want to change X → go here"

| I want to change… | Go to | Location |
|-------------------|-------|----------|
| The sales-tax rate | `APP-04` | `app.js:1528` (`TAX_RATE`) |
| How money/dates format | `APP-02` | `app.js:62` (`money`, date helpers) |
| A rental's price or rate combo | `APP-04` | `app.js:846` (`rentalPrice`) |
| Transport/delivery pricing | `APP-04`/`APP-06` | `app.js:909` / `app.js:1216` |
| Extension / 28-day invoice billing | `APP-05` | `app.js:942` |
| A status value or its color | `CFG` | `config.js:46` (`RAW_STATUS`) |
| What color a row/pill shows | `APP-11` / `CFG` | `app.js:3700` / `config.js:209` |
| How a pill/button/field is built | `APP-10` | `app.js:3679` |
| A list column or its total | `APP-15` | `app.js:4724` |
| What an open record card shows | `APP-16` | `app.js:4921` |
| The Shop card (WO/SO/Inspections) | `APP-19` | `app.js:6652` |
| A KPI ring's math | `APP-21` / `CFG` | `app.js:6970` / `config.js:301` |
| The team chat dock | `APP-23` | `app.js:7350` |
| A popup that won't open/dismiss | `APP-26` | `app.js:8673` |
| Adding/removing a popup window | `APP-27` | `app.js:9547` (`WINDOW_CATALOG`) |
| Mr. Wrangler's behavior or actions | `APP-28`/`APP-29` | `app.js:9642` / `app.js:9907` |
| A click that does nothing | `APP-32` | `app.js:10985` (event tree) |
| A drag-link that won't drop | `APP-33` | `app.js:10989` |
| What an action does to state | `APP-34` | `app.js:12428` |
| Card-on-file / charging / money gate | `APP-35` | `app.js:13339` (`canMoney`) |
| Saving/loading data, backend sync | `APP-38` | `app.js:14811` (`backendCall`) |
| Any visual style | `style.css` | grep the region header above |
| A constant/registry (role, card, flag) | `config.js` | grep the section header above |
| Pill-click cascade filtering | `CASC` | `cascade.js` |

---

## Found in file order (the as-it-sits-on-disk view)

For the exact, current line ranges and the full key-symbol list of every
chapter, see the generated index: **[`code-map.generated.md`](./code-map.generated.md)**.
Regenerate it after any chapter change:

```
node tools/gen-code-map.mjs           # rewrite the index
node tools/gen-code-map.mjs --check   # CI drift guard (fails if stale)
```

**Dead-code candidates.** `node tools/dead-code-scan.mjs` writes
[`dead-code-report.md`](./dead-code-report.md) — per-chapter top-level symbols
that appear exactly once in the whole frontend (defined, never referenced).
Conservative leads for cleanup, **for review — not an auto-delete list** (string
dispatch can hide a real use).

---

# Part II — The Workshop (GitHub / CI / docs / tools / root)

*Everything that builds, guards, deploys, and documents the app — but is never
served to the browser. Documentation only: these files are wired to GitHub by
path, so the atlas describes where they live; it does not move or rename them.*

## Act W1 — The Gates (`.github/workflows/ci.yml` → `ci/`)
The **`smoke`** job runs on every push/PR **to `main`** and is the required
status check that protects the trunk. It runs six steps, in order:

| Step | Runs | What it guards | Source |
|------|------|----------------|--------|
| Syntax check | `node --check` on each JS module | a syntax error can't reach live | `ci.yml` |
| Boot smoke | `node ci/smoke.mjs` | the app actually boots (headless Chromium) | `ci/smoke.mjs` |
| Logic regression | `node ci/logic-test.mjs` | money + multi-unit math stays correct (the big one, ~85 KB) | `ci/logic-test.mjs` |
| Rulebook catalog | `node ci/gen-rule-usage.mjs --check` | `rule-usage.js` matches the `data-r` stamps | `ci/gen-rule-usage.mjs` |
| Window catalog | `node ci/check-window-catalog.mjs` | `WINDOW_CATALOG` covers every popup (`APP-27`) | `ci/check-window-catalog.mjs` |
| DESIGN.md sync | `node ci/check-design-md.mjs` | `DESIGN.md` is valid + in sync with `style.css` | `ci/check-design-md.mjs` |

> Playwright (`smoke`, `logic-test`) runs in CI, **not** locally on Jac's
> machine — CI installs Chromium fresh each run. Locally only the non-browser
> gates run (`gen-rule-usage --check`, `check-window-catalog`, `check-design-md`,
> and the atlas `gen-code-map --check`). _Debug here when:_ a PR check is red —
> open the failing step's script above.

## Act W2 — The Robots (`.github/workflows/`)
- **`ci.yml`** — the gates above (job `smoke`).
- **`branch-janitor.yml`** — daily (~07:17 UTC) prune of **merged** task
  branches. Safe by design: never touches `main`, `staging`, or `area/*`, and
  never a branch with an open PR.
- **`wrangler-fix.yml`** — Mr. Wrangler's **Track B** auto-fix engine. An issue
  labelled `wrangler-fix` / `wrangler-request` → a Claude agent reproduces,
  patches the frontend, runs the gates, opens a PR, and auto-merges on green.
  Inert until its secrets (`ANTHROPIC_API_KEY`, `WRANGLER_PAT`) + branch
  protection are configured. Pairs with the in-app reporter (`APP-01`).

## Act W3 — The Generators (`tools/`)
*Dev-time only — none are served or imported. Each owns a generated artifact.*

| Tool | Generates / does | Notes |
|------|------------------|-------|
| `tools/gen-code-map.mjs` | `docs/code-map.generated.md` (the Atlas index) + `--check` | this phase |
| `tools/dead-code-scan.mjs` | `docs/dead-code-report.md` (unreferenced-symbol candidates) | this phase |
| `tools/gen-icons.mjs` | `icons.js` generic glyphs, vendored from Lucide | needs network; never hand-edit icons |
| `tools/gen-app-icons.py` | the PWA app-icon assets | |
| `tools/import-real-data.ps1` | imports real customer data | ⚠️ PII — never paste its data into the repo |

## Act W4 — The Library (`docs/`)
- **`docs/CODE-MAP.md`** (this file), `docs/code-map.generated.md`,
  `docs/dead-code-report.md` — the Atlas.
- **`docs/superpowers/specs/`** — design specs (incl. this reorg's).
- **`docs/handoffs/`**, **`docs/archive/`** — backend-deploy + clasp notes,
  and the tidied historical handoffs (Part I Step C).
- **`docs/backend-snippets/`**, `docs/wrangler-*.md`, `docs/google-maps-setup.md`
  — backend/integration references (see Part III).

## Act W5 — The Root (build, serve, config)
| File | Role |
|------|------|
| `index.html` | the served entrypoint (loads `app.js` + modules + `style.css`; carries the shared `?v=` cache token) |
| `serve.ps1` | local static server (port 8000 default; use 9147 here) |
| `Build-Standalone.ps1` | bundle a single-file standalone build |
| `manifest.webmanifest` | PWA manifest |
| `package.json` | scripts/metadata |
| `rule-usage.js` | **generated** by `gen-rule-usage.mjs` (don't hand-edit) |
| `CNAME` · `.nojekyll` | GitHub Pages: custom domain + raw-serve |
| `.gitignore` | keeps the backend (`Code.gs`/`backend/`) and secrets out of the public repo |

## Workshop reverse index — "I need to…"

| I need to… | Go to |
|------------|-------|
| Fix a failing PR check | the step's script in `ci/` (Act W1) |
| Add/adjust a CI gate | `.github/workflows/ci.yml` + the `ci/*.mjs` it calls |
| Add or change an icon | `tools/gen-icons.mjs` (then run it) — never hand-draw |
| Regenerate the code map | `tools/gen-code-map.mjs` |
| Find dead-code candidates | `tools/gen-code-map.mjs` → `docs/dead-code-report.md` via `dead-code-scan.mjs` |
| Understand branch cleanup | `.github/workflows/branch-janitor.yml` |
| Understand the auto-fix engine | `.github/workflows/wrangler-fix.yml` + `docs/wrangler-pipeline.md` |
| Change the served entry / cache token | `index.html` |
| Serve locally | `serve.ps1` (port 9147) |

# Part III — The Backend (Apps Script `Code.js`)

*The Google Apps Script **web app** behind a single `/exec` URL, over the
Google Sheet that **is** the database ("Rental Wrangler — Live Database"). The
source (`Code.gs`/`Code.js`) is **gitignored** — it never lives in this public
repo, and ships via **`/clasp`**, never git. So this map documents the backend's
**contract** (the actions the frontend calls and what they do), which is the
authoritative frontend↔backend boundary — not the server implementation. To read
the live handlers, use the Drive connector or `clasp` (see
`docs/backend-clasp-setup.md`); to deploy, use the `/clasp` skill (additive,
STOP-gated).*

## How the frontend talks to it (the one entry point)
- **`APP-38 · §18b Backend Sync** (`app.js:14811`) is the *only* caller.
  `backendCall(action, extra)` POSTs `{ action, password, ...extra }` as
  `text/plain` (dodges the GAS CORS preflight) to **`BACKEND_URL`**
  (`app.js:14817`). Every call is gated by the team **password**.
- The server always replies `{ ok, ... }` (or `{ ok:false, error }`); the client
  parses defensively and never coerces a failure into a success.
- **Persistence is diff-based.** `PERSIST_KEYS` (11 entities) + `PERSIST_ID` (the
  id field per entity) drive `computeChanges()` → only upserts/deletes are sent
  (`sync`), not the whole 1.7 MB state. `load` hydrates on sign-in; `seed`
  populates a fresh backend (admin `#reseed` only).

## The action catalog (every `backendCall` the frontend makes)

| Family | Actions | What the backend does |
|--------|---------|-----------------------|
| **Auth & session** | `auth`, `saveSession`, `getSession` | verify the team password; persist/restore a device session |
| **Data sync** | `load`, `seed`, `sync` | hydrate all entities · seed a fresh DB · apply incremental upserts/deletes |
| **Config & Views** | `getConfig`, `setConfig`, `getViews`, `setViews` | admin Settings Board (`APP-09`) + company-wide saved Views |
| **Team chat** | `getChats`, `setChats` | the internal dock (`APP-23`) message store |
| **Wrangler rail** | `getWranglerRail`, `setWranglerRail` | cross-device store of past Mr. Wrangler conversations (`§18g`) |
| **Mr. Wrangler AI** | `wrangler` | proxies the chat to Claude (the API key lives server-side, never in the client) |
| **Wrangler inbox** | `wranglerRequests`, `wranglerThread`, `wranglerComment`, `wranglerApprove`, `wranglerDismiss`, `wranglerFile`, `wranglerNotifications` | the in-app glitch/request pipeline (mirrors the GitHub issues from `wrangler-fix.yml`) |
| **Files & media** | `uploadFile`, `uploadCapture`, `archiveAgreementMedia` | offload photos/video/signed-agreement media to Drive (see `docs/backend-snippets/archiveAgreementMedia.md`) |
| **Stripe — cards/bank** | `stripePubKey`, `stripeSetupIntent`, `stripeSaveCard`, `stripeSetDefault`, `stripeRemoveCard`, `stripeBankSetupIntent`, `stripeSaveBank`, `stripeVerifyBank` | card/ACH on file via Stripe (secret key server-side) |
| **Stripe — charging** | `stripeChargeInvoice`, `stripeFinalizeInvoice`, `recordManualPayment` | charge / finalize an invoice · log a manual payment |
| **Membership** | `membershipEnroll`, `membershipCancel`, `membershipReactivate` | the subscription lifecycle (`APP-09` economics) |
| **Misc** | `mapsKey`, `feedback` | hand the client the Maps key · file user feedback |

## Backend reverse index — "I need to…"
| I need to… | Where |
|------------|-------|
| Change how the client calls the backend | `APP-38` (`app.js:14811`) |
| Add a backend action | add the handler in `Code.gs` (deploy via `/clasp`) **and** a `backendCall('…')` in `app.js` |
| Read the live server code | Drive connector / `clasp` — `docs/backend-clasp-setup.md` |
| Deploy the backend | the `/clasp` skill (additive only, STOPs before prod) |
| Understand the Wrangler inbox server side | `docs/wrangler-inbox-backend.md`, `docs/wrangler-pipeline.md` |
| See the Sheets DB layout | the `PERSIST_KEYS` / `PERSIST_ID` map (`app.js:14818`) = one tab per entity |

> ⚠️ **PII guard.** The live DB holds real customer data. This map documents the
> *contract* only — never paste Drive/Sheets contents, the Apps Script source, or
> any secret/PII into this repo, commits, or seeds.
