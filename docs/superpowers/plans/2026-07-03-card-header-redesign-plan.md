# Card header redesign — implementation plan

**Spec:** `docs/superpowers/specs/2026-07-03-card-header-redesign-design.md`
(approved, `/role`-audited). Build on `claude/wrangler-dashboard-space-h2nu0i`.
Front-end only — `app.js`, `config.js`, `style.css`. No backend.

**Real hooks already in the code (verified):**
- Toggle: `colTabsEl` (app.js 6822), `colTabButtonsHtml` (6831), `memberIcon`
  (6755); toggle inserted at card top on desktop (6811).
- List surface: `listView` (6917), `listbar` (6926), graph `bv-btn`
  `js-cardgraph` (6935); `listFor(card, session)` (6651) + `unitsVisible(...)` =
  the **already role-scoped** row source.
- Sort/views: `SORT_FIELDS[card]` (config.js 397), `openViewMenu` (11831),
  `loadViews`/`saveViews` (11794).
- Derivations (reuse, don't re-implement): `unitStatus` (231), `invoiceTotals`
  (1609), `rentalDisplayStatus` (1641), the Today/Tomorrow display derivation
  (config note near `rentalStatus`).
- R20 menu: `openCtxMenu` (4334), `openCtxMenuAt` (4363), `runCtxAction` (4398).
- Role gate: `roleTier` (13438), `tierRank`, `canMoney` (14550 =
  `!currentRole || roleTier(currentRole) >= tierRank('money')`), `adminUnlocked`
  (13454); `currentRole` (15295), `currentUser`.
- Per-operator key pattern: `commentUserKey = () => currentUser || currentRole ||
  'me'` (5556) — reuse for personal custom-view storage.
- Icons: `I.*` (`icons.js`) + `tools/gen-icons.mjs`; status registry
  `RAW_STATUS` (config.js 50).

Each phase ends green on `node ci/smoke.mjs` + `node ci/logic-test.mjs`
(port-swap to 9147 first) and a local `serve.mjs` drive at desktop + phone
(390×844). R-rulebook: new stamped elements get `data-r`, regen `rule-usage.js`;
new popups get `WINDOW_CATALOG` entries.

> **Sibling change (not in this plan):** the KPI-ring compaction (~14 px) that,
> with this header merge (~38 px/card), realizes the full ~66 px. Tracked by the
> space mockup; land it separately.

---

## Progress — 2026-07-03 (phase 4 shipped; next → phase 5)

Phases 1–3 shipped on `claude/wrangler-dashboard-space-h2nu0i` (PR #447). **Phase 4 continues
the feature on `claude/wrangler-dashboard-space-vdijk0`** (based off the phase-1–3 tip; per Jac,
this branch's PR carries phases 1–4 and supersedes #447). All gates green.
- **Phase 1 ✅** icon-first toggle — `colTabButtonsHtml` + `aria-label`, `style.css`
  `.coltab:not(.on) .ct-lbl { display:none }`.
- **Phase 2 ✅** one-row header — `columnEl` wraps toggle + listbar in `.hrow`; listbar =
  search (fills) + inline ▲▼ + gear (`I.sliders`). Graph + sort-field chip **removed from
  the row** (graph → phase 4, sort field → phase 5).
- **Phase 3 ✅** `CARD_OPTIONS` map in **app.js** (not config.js — predicates need app
  helpers). Per-card `{ id, label, tier, combo, test }`; composites Bill/Out; Available =
  canonical availability.
- **Phase 4 ✅** gear → Row 2. `js-cardgear`/`js-opt` handlers; `optionsOpen`/`activeOptions`
  on the card session (array, not Set — survives the array-shaped session copy). `listView`
  renders `.optrow` = entitled options (`.opt`, `.opt.combo` dashed) inside a truncating
  `.opts` box + the graph `bv-btn` (moved here, always-visible right). AND-filter over the
  already role-scoped rows in `listView` (entitled-guard + try-guard). Gear stays lit while a
  filter is active so a collapsed Row 2 still signals it; **the filter persists on collapse.**
  Verified end-to-end in `#local` (20/20: toggle/filter/persist + the §16 gate) + smoke + logic 400/400.

**Phase-4 decisions (resolved on the main session — gate-sensitive, per CLAUDE.md):**
- **`crm` tier gates at `canMoney()` (≥ money), same as `money`.** The tier ladder
  (`config.js` `ROLE_TIERS`) has **no separate sales/CRM tier** — `office` AND `sales` both map
  to `money`. The plan's `tierRank('sales')` returns **0** (unknown) → would show CRM filters to
  *everyone incl. operational staff* (a §16 leak). `≥ money` excludes exactly the operational
  roles §16 names (mechanic/mtech/driver = staff) while admitting office/sales/manager/admin/
  owner. Real guarantee stays: predicates run over the already role-scoped list (narrow-only).
  A finer sales/CRM tier would be a separate role-system change.
- **`⋯` deferred to phase 6.** Its only job is to open Row 3 (Custom Views, phase 6); no
  ellipsis glyph exists in `icons.js` and a dead placeholder button adds nothing. It arrives
  with its function in phase 6. Desktop overflow currently **truncates** (clips) — the `⋯`
  overflow-fold also lands in phase 6.

**Next → Phase 5:** right-click / long-press the ▲▼ → a sort-only menu of `SORT_FIELDS[card]`.

**Notes for next session:** gear icon is Lucide `sliders` (Jac may want a literal cog via
`gen-icons.mjs`). `lost`/`unitWhen` predicates are best-effort (try-guarded) — spot-check when
driven. **Run ALL no-browser gates before each push** (smoke/logic run in CI): `node --check
app.js` · `gen-rule-usage --check` · `check-window-catalog` · `gen-code-map` (regen + commit the
map; don't use a `════` banner in a non-chapter comment or it miscounts APP-NN). Cloud tip: the
browser gates DO run here — `npm i --no-save playwright@1.48.0`, then launch with
`executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'`
(the pinned 1.48 browser build mismatches; old-headless needs the headless-shell). Sibling:
janitor race fix on `wrangler-fix/janitor-boot-race` (PR #449, draft, CI green) — awaiting merge.

## Phase 1 — Icon-first toggle (isolated, visual)
1. `colTabButtonsHtml` (6831): keep icon + count on every member; render `.ct-lbl`
   **only** on the active member. Alert ring (Shop) unchanged.
2. `style.css`: `.coltab:not(.on) .ct-lbl { display: none }` (desktop **and**
   phone — drop the `max-width:74px` truncation at 476, no longer needed on
   inactive). Keep the active label full.
**Verify:** only the selected member spells its name; counts persist; toggle stays
short with 3 members (Units/Categories/Shop). Smoke green; local drive.

## Phase 2 — Row 1: one row (toggle + search fills gap + inline ▲▼ + gear)
1. Merge the toggle row and the top of `listbar` into one flex `.hrow`: toggle
   (from `colTabsEl`) · search field (`mini-searchwrap`/`mini-search`, `flex:1`) ·
   sort **direction** ▲▼ inline at the search's right edge · a new **gear** button.
2. Move the sort ▲▼ out of the `.sort` chip; drop the `.sort .dir` border-left
   seam. Remove the sort **field** chip and the graph button from their current
   `listbar` spots (field → Phase 5 menu; graph → Phase 4 Row 2).
3. `style.css`: `.hrow` layout; search `flex:1 1 auto`; `.gear` icon button
   (`data-r`); ▲▼ inline, minimal padding, no divider.
**Verify:** resting state is ONE row; search filters; ▲▼ flips asc/desc; gear
present (toggles an empty Row 2 for now). Smoke green; local drive.

## Phase 3 — Config: default options + composites + tier (pure data)
1. `config.js`: `CARD_OPTIONS[card] = [{ id, label, tier, predicate }]` for
   rentals · units · customers · invoices (per spec §6). `tier` drives Phase 4
   role-gating.
2. Predicates **reuse the authoritative helpers** — never re-derive:
   - Rentals: `rentalDisplayStatus` for Today/Tomorrow/Reserved/On Rent/End Rent;
     **Bill ∑** = predicate over `rentalStatus` + linked-invoice `invoiceTotals`
     (overdue ∪ unpaid ∪ Quote ∪ Off Rent ∪ billing issue).
   - Units: `unitStatus` for **Out ∑** {On Rent, End Rent, Off Rent};
     inspection/fleet for Not Ready/Failed; **Available** = canonical availability
     (Active AND not out AND not Failed/Not Ready/For Sale/Inactive/Sold — §16);
     Today/Tomorrow/Reserved from the unit's linked rental derivation.
   - Customers: account-type/pay-status/funnel for Active/Lost/Members/Business/
     Non-Business/Unpaid; **Member Funnel** vs **Used Funnel** (used-equipment
     sales pipeline — confirm/define the sales-stage field, §10 note).
   - Invoices: `invoiceTotals().status` for Not Due/Unpaid/Late/Partial/Refunded/
     Collections.
**Verify:** logic-test seam — each predicate filters a sample set correctly, esp.
composites (Bill/Out) and Available (a Failed unit is NOT Available).

## Phase 4 — Row 2: gear → options row (multi-select, role-gated, graph, ⋯)
1. Gear toggles `session.cards[card].optionsOpen`. Render Row 2: the entitled
   `CARD_OPTIONS[card]` as **text** buttons + the graph `bv-btn` (moved here) + a
   **⋯** button. All `data-r` stamped.
2. **Role gate at render (§16):** show an option only if the role may see its
   tier — money-state (`tier:'money'`) → `canMoney()`; funnel/CRM
   (`tier:'crm'`) → sales-tier (`roleTier(currentRole) >= tierRank('sales')` —
   confirm rank); maintenance/availability → shop/fleet/owner. Built entitled from
   the start, never role-blind.
3. **Multi-select filter:** `session.cards[card].activeOptions` (a Set); tapping
   toggles membership + `render()`. In `listView`, AND every active option's
   predicate over the **already role-scoped** rows (`listFor`/`unitsVisible`
   output) — never a raw list. Composites contribute their union as one term.
4. `style.css`: Row 2 desktop **truncates** to card width (no scrollbar in the
   3-col grid); mobile `overflow-x:auto` scroll. Active option = orange + dark ink.
**Verify:** gear toggles Row 2; options AND-filter; graph still toggles graph
view; low-tier `currentRole` hides money/funnel options; desktop truncation vs
mobile scroll. Smoke + logic green; regen `rule-usage.js`.

## Phase 5 — Sort field: right-click ▲▼ → sort-only menu
1. Right-click / long-press the ▲▼ → a dropdown listing **all** `SORT_FIELDS[card]`
   and nothing else (via `openCtxMenuAt` or a dedicated `openDropdown`). Pick →
   set `cs.sort.field` + `render()`.
2. Retire the **Sort** section of `openViewMenu` (Views + per-card filter sections
   handled in Phase 6 / as options). `WINDOW_CATALOG` entry for the sort menu.
**Verify:** right-click ▲▼ shows only sort fields; picking re-sorts; no other menu
content. Smoke green; `check-window-catalog` green.

## Phase 6 — Row 3: personal Custom Views + create/remove + icon picker
1. ⋯ toggles `customOpen` → Row 3 renders the operator's custom views (icon +
   label, `data-r`). A `+ New` affordance at the end.
2. **Personal storage:** extend `loadViews`/`saveViews` to key by operator (reuse
   the `commentUserKey()` pattern), add an `icon` field; per-view
   `{ name, search, terms, sort, icon }`. Clear/namespace on logout so a shared
   terminal doesn't leak (§16).
3. **Create:** right-click the search bar → `openCtxMenu` item **"+ View"**
   (captures current search + `filterTerms` + `sort`) → **icon-picker popup**
   (grid of `I.*` library icons — never hand-drawn) → name → save → Row 3.
   `WINDOW_CATALOG` entry for the picker.
4. **Remove:** right-click a custom-view button → **"Remove View."** Long-press on
   mobile for both.
5. Applying a custom view sets search + terms + sort together; its predicate runs
   over the role-scoped list (§16).
**Verify:** +View → picker → view appears → applies its saved query; Remove View;
switch operator (`currentUser`) → different set (isolation). Smoke + logic +
`gen-rule-usage --check` + `check-window-catalog` green; local drive desktop +
phone (long-press).

## Phase 7 — Cleanup, gates, self-critique
1. Fully retire `openViewMenu` (11831): Views → Row 3, Sort → Phase 5, per-card
   filters (e.g. invoices `payMethod`) → an option or the ⋯ overflow. Remove dead
   `.sort`/`listbar` CSS the merge orphaned.
2. **Role-projection + isolation verification:** simulate `currentRole` at each
   tier → assert money/funnel options absent for operational roles; assert filters
   never widen (run over `listFor`/`unitsVisible`); confirm views are per-operator.
3. Run ALL gates: `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
   `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`,
   `node tools/gen-code-map.mjs --check`. Zero R0 flash-lint.
4. jactec-ui self-critique screenshot pass (dark + light + yard); anti-slop
   checklist; confirm one-row-at-rest reclaim.
**Verify:** all gates green; screenshots attached; ready for the area-level local
test → continue-or-archive fork.
