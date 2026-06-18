# KPIs & Rings — admin-defined KPIs via Mr. Wrangler (design)

**Date:** 2026-06-18 · **Branch:** `claude/infrastructure-i5b4za` · **Follow-on to:** Settings Board v1 (PR #157)
**Status:** spec for review — NOT yet built (architecturally significant; needs Jac sign-off).

Make the 3 dashboard rings per role **admin-configurable**: each admin picks which metric each ring
tracks and its target, and **authors new metrics in plain English with Mr. Wrangler** — who interrogates
the intent, locks in a structured (safe, no-`eval`) metric spec, proves it computes against live data,
and wires it into the gamification flash.

Decisions (Jac, 2026-06-18 popup): **keep 3 concentric rings** (choose the metric per ring, not the
count); **cross-entity joins are in scope** for the formula engine.

---

## 1 · What exists today (grounded)

- **Definitions:** `config.js` `ROLES[].kpis` — 5 roles × **3 KPI labels** (strings only). (`config.js:230`)
- **Computation:** `kpiFor(roleId)` (`app.js:4822`) is a hand-written switch returning `[pct,pct,pct]`
  (0–100). `kpiRaw(roleId)` (`app.js:4907`) returns the **raw numerators** (e.g. `$ paid`, `Ready count`).
  `KPI_HELP` (`app.js:4879`) holds the plain-English explainer per KPI.
- **Render:** `ring3SVG(vals,…)` (`app.js:4787`) draws **3 concentric** rings; `bandColor` (`app.js:4778`)
  bands red→orange→yellow→green (glow ≥90%). One header button per role (`headerEl`, `app.js:4940`).
- **Gamification (already live):** `scoreTick()` (`app.js:4922`, called every render) snapshots each KPI's
  raw numerator and **pops `+ΔN` + flashes the ring** when it rises (`scorePop`, `app.js:4931`). No
  points/badges table — the delta-on-real-numerator IS the gamification. **So any custom KPI auto-joins
  gamification simply by exposing a raw numerator.**
- **Mr. Wrangler (already a structured-action engine):** `wranglerSend()` (`app.js:6885`) posts
  `backendCall('wrangler', {system, messages})` → Apps Script → **Claude**. The reply carries a hidden
  `wrangler-action` JSON block, parsed (`parseWranglerAction`), **validated against an allowlist**
  (`wrValidatePlan` over `WR_EDITABLE`, `app.js:6978`), previewed, then applied (`applyWranglerData`,
  `app.js:7013`). Context is built from `wranglerDigest()` (`app.js:6794`).

**The key reuse:** Wrangler already turns plain English into validated structured ops. We add a new action
**kind** that emits a **KPI metric spec** instead of record edits — same propose → validate → preview →
apply pattern, no new AI plumbing.

## 2 · The metric spec (a safe DSL — no `eval`, Pages-public-safe)

Stored in `config.settings.kpis` (same persistence as Statuses, §6). Per role, an **ordered array of 3**
ring definitions:

```js
config.settings.kpis = {
  mechanic: [ ring0, ring1, ring2 ],   // exactly 3 (keeps the concentric look)
  mtech: [...], driver: [...], office: [...], sales: [...]
};
```

Each **ring** = `{ id, label, help, target, unit, band, metric }`:

```js
{
  id: 'wo-2day',                 // stable key (gamification snapshot uses role+ringIndex; id aids reset)
  label: 'WO ≤ 2 days',          // the stamped ring label
  help: 'Share of work orders finished within 2 days of opening.',  // KPI_HELP tooltip
  target: 100,                   // value that fills the ring (for 'goal' kind); ratios target 100%
  unit: '%',                     // '%' | '$' | 'count' — drives the +ΔN pop format
  band: 'up',                    // 'up' = higher is better, 'down' = lower is better (inverts fill)
  metric: { … see below … }
}
```

A **metric** is one of four kinds; **`ratio` is the cross-entity workhorse** (Jac chose cross-entity):

```js
// numerator ÷ denominator, each an INDEPENDENT source over ANY entity → cross-entity joins
{ kind:'ratio',
  num: { entity:'workOrders', where:[{f:'phase',op:'eq',v:'Complete'}, {f:'_ageDays',op:'lte',v:2}], agg:'count' },
  den: { entity:'workOrders', where:[{f:'cancelled',op:'ne',v:true}], agg:'count' } }

// single source, goal-scaled: pct = min(value/target,1)*100
{ kind:'goal', src:{ entity:'rentals', where:[{f:'_month',op:'eq',v:'@thisMonth'}], agg:'sum', field:'_revenue' }, target:50000 }

{ kind:'count', src:{ entity:'units', where:[{f:'fleetStatus',op:'in',v:['Ready','Not Ready']}] } }   // vs entity total → %
{ kind:'builtin', ref:'sales-pipeline' }   // ESCAPE HATCH → the existing hand-coded calc (back-compat, §5)
```

- **source** = `{ entity, where:[cond…], agg:'count'|'sum', field? }`. `cond` = `{f, op, v}` with
  `op ∈ eq, ne, in, gt, gte, lt, lte, contains, exists`.
- **Derived fields** (`f` starting `_`) are a curated, safe **computed-field registry** so common
  needs work without joins: `_ageDays`, `_month`, `_revenue` (rental price), `_paid` (invoice paid),
  `_totalPaid`/`_activePct` (customer digest). Tokens like `@thisMonth`/`@today` resolve at eval.
- **Evaluator** `kpiEval(ring) → { pct, raw, unit }`: pure, defensive (missing field/entity → 0, never
  throws), bounded 0–100. `band:'down'` ⇒ `pct = 100 - pct`. `raw` = the numerator value → feeds
  `kpiRaw`/`scoreTick` so **gamification works automatically**.

### Wiring into the live functions (back-compat is mandatory)
- Ship the **current 15 KPIs re-expressed as default ring specs** (`KPI_DEFAULTS[roleId]`), so with no
  admin override the dashboard is **byte-for-byte what it is today**. Gnarly ones that don't fit the DSL
  cleanly (customer-digest math) ship as `kind:'builtin'` pointing at the existing code — the escape
  hatch guarantees zero regression on day one.
- Refactor: `kpiFor(roleId)` → `(settings.kpis[roleId] || KPI_DEFAULTS[roleId]).map(r => kpiEval(r).pct)`;
  `kpiRaw` likewise from `kpiEval(r).raw`. `KPI_HELP[label]` reads `ring.help`. `applySettings()` (already
  added in v1) gains `applyKpiOverrides()` — purely a read-through, nothing mutates the registry.

## 3 · The Mr. Wrangler authoring flow (Jac's idea)

1. **KPIs & Rings tab** (Settings Board): pick a role → its 3 ring rows. Each row has a **plain-English
   description field** + **"Refine with Mr. Wrangler"**.
2. **Refine** opens the existing Wrangler dock, **seeded** with: a KPI-authoring system prompt, the role +
   ring slot, the admin's description, and a **fields digest** (entities + their filterable fields +
   the derived-field registry). Wrangler is told to return a `wrangler-action` of **`kind:'kpi'`**.
3. **Wrangler interrogates** ambiguity in chat ("Over what window? Do cancelled WOs count? Higher is
   better, right?") — exactly the "make sure it locks in" you described — then emits:
   `{ type:'kpi', role, ring:1, label, help, target, unit, band, metric }`.
4. **Validate + prove** (`wrValidateKpi`, mirrors `wrValidatePlan`): entity ∈ allowlist, every `where.f`
   is a known/derived field, ops valid; then **run `kpiEval` against live DATA** and show the **computed
   value right now** + the raw numerator in a preview card. "functions / tracks across the app" is proven
   by the live number; "triggers gamification" is shown as the +Δ source. Bad spec → Wrangler is asked to
   fix it (the issues list), never applied.
5. **Lock in** writes the ring into `o.draftSettings.kpis[role][ring]`; the tab shows a **live 3-ring
   preview** (`ring3SVG` with `kpiEval` values) so the admin sees it before **Save settings** (§6).

Manual fallback (no Wrangler / offline): the tab also exposes the structured fields (entity, filters,
aggregate, target, band) as plain controls, so a KPI can be built or tweaked without the chat. Wrangler is
the fast path, not the only path.

## 4 · UI (jactec-ui — yard data-plate)

A new `kpis` pane in the Settings Board, same language as the Statuses tab: role picker chips → 3 ring
rows. Each row: ring-slot stamp, **label** input, **description/help** field, **live-value chip**
(`kpiEval`), **target** input, **band** segmented toggle (R14, "Higher ▲ / Lower ▼ is better"), a
**"Refine with Mr. Wrangler" 🤠** button (orange ignition, R17), and reset-to-default. A **mini 3-ring
preview** (reusing `ring3SVG`) sits beside the rows showing the role's live rings. Run through the skill;
no new R-rule (uses existing builders); mirror dark/light/ranch.

## 5 · Persistence, safety, gates

- **Storage:** `config.settings.kpis` — the **same** `setConfig({roles,admin,settings})` + `localStorage`
  mirror + `applySettings()`-at-boot path built in v1. Cross-device needs the **same one-line backend
  widen** already shipped in PR #157's snippet (no new backend work beyond that). The **`wrangler`
  backend action already exists** — authoring needs no new endpoint.
- **Safety:** the DSL has **no code execution** — only declarative filters over an entity/field allowlist,
  evaluated by our own `kpiEval`. Wrangler can only emit specs that pass `wrValidateKpi`; an admin Saves
  the reviewed result (preview-then-apply, like all Wrangler ops). Defaults reproduce today's rings, so
  the feature is **purely additive** and degrades to current behavior if `settings.kpis` is empty/invalid.
- **Gates:** new `kpiEval` unit checks in `ci/logic-test.mjs` (each default spec reproduces the legacy
  `kpiFor`/`kpiRaw` number — the regression guard); smoke + rule-usage unchanged. Cache-bust bump.

## 6 · Build order (when approved)

1. `kpiEval` + derived-field registry + `KPI_DEFAULTS` (with `builtin` escape hatch); refactor
   `kpiFor`/`kpiRaw`/`KPI_HELP` to read through it. **Gate: defaults === today.**
2. `applyKpiOverrides()` in `applySettings`; persistence already done.
3. KPIs & Rings tab UI (manual controls + live preview).
4. Wrangler `kind:'kpi'` authoring: system prompt, fields digest, `wrValidateKpi`, preview card, Lock-in.
5. Logic tests + jactec-ui screenshot pass + draft-PR.

## 7 · Open questions for Jac (next popup, at build time)

- **Who can edit KPIs** — Admin only, or Owner too? (Settings is Admin-gated today.)
- **Targets that drift** — should a goal like "Revenue Goal" read from the existing company revenue-goal
  setting (one source of truth) rather than a per-ring number?
- **Band default** — assume "higher is better" unless Wrangler detects otherwise (e.g. field-call rate)?
