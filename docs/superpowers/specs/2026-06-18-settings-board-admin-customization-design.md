# Settings Board — Admin Customization (design)

**Date:** 2026-06-18 · **Branch:** `claude/infrastructure-i5b4za` · **Status:** approved to build (Jac: "make your own plan and continue")

Major infrastructure: turn the one-screen Admin "Settings" (role passwords only) into a
**Settings Board** with a **vertical tab rail**, so admins can customize fields, statuses,
requirements, layout, and more — persisted via the existing schema-less backend `config`.

---

## 1 · Why / current state

- Today: `openSettings()` (app.js:9388) opens a single Admin-gated overlay that edits **role
  passwords and the admin password — nothing else.** Persisted via `setConfig`
  (`config: { roles, admin }`); read via `getConfig`.
- Nearly every customizable thing already exists as a **registry**: `RAW_STATUS` (~18 status
  sets, each option `{label,color}`), `inspectionChecklist`, `ROLES` (+per-role KPIs),
  `GRID_CARDS`, `COLUMNS`, `SORT_FIELDS`, and the per-card totals footers. The work is
  **exposing those registries through an admin UI and persisting overrides** — not inventing
  new data models.

## 2 · The full vision (tab rail) — for context, NOT all v1

A vertical tab rail (data-plate language) down the left of the Settings Board. Tabs:

1. **General / Company** — identity, logo, yard origin, revenue goal, fiscal/timezone/tax.
2. **Statuses & Pills** — per status set: relabel, recolor, reorder, add/remove, **assign a
   free-library icon per option**, lock criticals.
3. **Custom Fields** — extra fields per entity (customers/units/categories/rentals/invoices):
   type, required/optional, placement, validation.
4. **Inspections** — checklist templates per category type, Pass/Fail items, custom inspection
   fields, required photos, auto-fail → `inspectionStatus`/WO.
5. **Rental Requirements** — require card-on-file for On Rent; selfie/signature/ID/PO as
   Required-Optional-None; payment terms Cash/Net 30 (closes request #88); deposits.
6. **Roles & Permissions** — role passwords (existing) + per-role visible cards/footers/fields,
   KPIs, approval gates.
7. **Notifications & Comms** — team chat on/off, driver dispatch notifications, customer
   reminders + cadence.
8. **Layout & Display** — per-card footer visibility, card/column visibility, grid order,
   default sort, density.
9. **Integrations** — Stripe / Maps / telematics / backend (references + toggles; secrets stay
   in Script Properties).
10. **Automation** *(stretch)* — auto-invoice rules, late-fee schedule, service intervals.
11. **Audit & Data** *(stretch)* — change log, export/backup, import mappings.

Each non-v1 tab ships as a tasteful **"Planned"** stub so the information architecture is
visible and each becomes its own follow-on spec.

## 3 · v1 scope (this build)

Prove the whole pattern end-to-end with the lowest-risk, most demonstrative tab:

- **A. Settings Board shell + tab rail.** Replaces the old `kind:'settings'` overlay. Admin
  gate unchanged. Tab rail lists all 11 tabs; non-v1 tabs render the "Planned" stub.
- **B. Persistence layer** (`config.settings`). See §4.
- **C. Statuses & Pills tab (fully working, but value-safe):** for each status set, edit
  **label, color (from the palette), and icon** per option. **The underlying status *value*
  (the data key) is never editable** — values are keys used across every record, the cascade
  engine, and `LEGACY_MAP`; renaming one would orphan data. The value is shown as a **locked
  chip** next to the editable LABEL field so the role-vs-label split is explicit (Jac, live:
  "the label can change but their role in the system can't" — e.g. **On Rent** may read "Out"
  yet still behave like On Rent everywhere). Add/remove/reorder options is **deferred** to a
  follow-on (same reason). Live pill preview as you edit.
- **F. KPIs & Rings tab (Planned stub in v1).** Jac (live) wants per-role dashboard rings
  editable here — **how many rings, which metric each shows, and the formula/target behind
  each.** The formula editor needs a small **safe calc DSL** over record aggregates (a real
  subsystem), so v1 ships it as a "Planned" rail tab; it gets its own follow-on spec.
- **D. Roles / Logins tab:** folds the existing password editor in unchanged, so the new board
  is a strict superset of today's Settings (no regression).
- **E. Icon library:** a **curated, vendored subset** of **Lucide** (MIT) icons (~36 relevant:
  truck, wrench, check, x, alert-triangle, clock, calendar, dollar-sign, etc.) as inline-SVG
  path data, matching the existing `I.*` / `CARD_ICON` inline-SVG pattern. **No runtime
  dependency** — the app stays dependency-free and Pages-static. A status option with no icon
  renders exactly as today (color dot + label).

Out of v1 (follow-on specs): Custom Fields, Inspections, Rental Requirements, Notifications,
Layout, Integrations, Automation, Audit, and status add/remove/reorder.

## 4 · Persistence architecture (the load-bearing decision)

Storage is schema-less; `config` already round-trips through `getConfig`/`setConfig`. I cannot
inspect or deploy the backend (gitignored `Code.js`; clasp login is interactive + Jac-only).
So:

- **Read:** `getConfig` → `config.settings` (a new top-level object, default `{}`). Applied at
  load by `applySettings(config.settings)`.
- **Write:** `setConfig` is sent the **full merged config** `{ roles, admin, settings }` (never
  a partial — avoids clobbering passwords). `settings` holds only **presentational overrides**,
  e.g. `settings.status = { rentalStatus: { 'On Rent': { color:'blue', icon:'truck' } } }`.
- **Apply:** `applyStatusOverrides()` mutates the frozen `STATUS` records **in place** —
  setting only `.color` / `.label` / `.icon`. Every render path reads through the single
  resolver `getStatus(set,value)`, so one mutation propagates everywhere. **Values/keys are
  never touched**, so cascade/import/data integrity is unaffected.
- **Resilience to the backend unknown:** if `setConfig` happens to cherry-pick `{roles,admin}`
  and drops `settings`, cross-device sync silently no-ops. To avoid losing admin work and to
  apply instantly, settings are **mirrored to `localStorage` (`jactec.settings`)** and applied
  on boot; the board shows a small "saved locally · syncing to all devices" state. **The one
  backend dependency** — widening `getConfig`/`setConfig` to pass `settings` through — ships as
  a **paste-ready `Code.gs` snippet in the PR** for Jac to confirm/deploy (mirrors how the
  transport spec delivered a `getConfig` snippet). The frontend is fully functional and
  gate-verifiable without it; only multi-device sync waits on that paste.

## 5 · UI / design language

Runs through the **jactec-ui** skill ("yard data-plate"): dark steel panels, one safety-orange
accent, hazard-stripe signature used sparingly, stamped Saira Condensed tab labels, corner
rivets, light wrangler seasoning in copy. The tab rail is a riveted steel rail; the active tab
gets the orange baseline (consistent with the board/boardview header rail from #142). Mobile:
the rail reflows to a horizontal scroller / bottom sheet per the mobile-navigation skill.
Reduced-motion respected; visible focus; 44px touch targets.

- **Icon-in-pill** is a presentation change to `statusPill` (R3): a small leading icon before
  the label, color unchanged. Run through jactec-ui; no new rule needed if it stays within R3's
  "informational, never an action" contract (it does).

## 6 · Gates / safety

- `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check` all green
  (port 8000 is free in this env — no swap needed).
- Defensive: missing/empty `config.settings` → app behaves exactly as today.
- No secrets, no model id, no passwords in the repo. Backend `Code.js` stays gitignored.
- Cache-bust `?v=` token bumped on `app.js`/`style.css`/`rule-usage.js` in `index.html`.
- Regenerate `rule-usage.js` only if rule usage changes (icon-in-pill stays within R3).

## 7 · Deliverable

Build on `claude/infrastructure-i5b4za` → gates green → screenshot + self-critique →
**draft PR** with the `Code.gs` widening snippet in the body.
