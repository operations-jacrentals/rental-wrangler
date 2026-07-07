# WranglerGPS integration — Phase 1 design

- **Date:** 2026-07-07
- **Status:** Draft for Jac's review
- **Area branch:** `area/wrangler-gps` (new, cut off `staging` — `area/units-fleet` and
  `area/maps-location` were found stranded from the 2026-06-23 history rewrite, no
  common ancestor with `main`, so this GPS work gets its own fresh area instead)
- **Task branch:** `claude/gps-rental-wrangler-integration-5dme8g`
- **Source:** a friend built a standalone fleet-telematics app, **WranglerGPS**, for
  Jac Rentals already. Forked verbatim (no changes) into
  `operations-jacrentals/wranglergps` on 2026-07-07 so the code is owned by the org,
  not dependent on the friend's personal GitHub. Cloned to `/workspace/wranglergps`
  for this design pass; full original README preserved there.
- **Directive (Jac, 2026-07-07):** don't be at the mercy of his GitHub — duplicate the
  code into our own org and infrastructure. Goals that shaped the architecture: **live
  or near-live feedback**, especially opening a truck/driver/unit's live location, and
  **remote engine shutdown** from the app.
- **Related:** `2026-07-03-manager-metrics-design.md` §3 already references
  WranglerGPS's category useful-life-hour values for the Time Utilization panel and
  plans a daily `{date, unitId, currentHours, fleetStatus}` snapshot job (T2). Phase 2
  of this spec (below) should reconcile with that job rather than duplicate it.

---

## 1. What WranglerGPS is today

A Node/Express + PostgreSQL backend (hosted on Railway) and a React (CRA) frontend
(hosted on Vercel) that merge four GPS/telematics providers into one fleet view:

| Provider | Covers | Notes |
|---|---|---|
| Hapn (`api.iotgps.io`) | Small equipment (skid steers, lifts, trenchers, etc.) | Engine hours from ignition events (GTIGN/GTIGF/GTVGN/GTVGF), broken `/messages` pagination worked around with a time-cursor, and a **starter-interrupt (remote shutdown) relay** |
| John Deere Operations Center | Deere skid steers & dozers | OAuth2, rotating refresh tokens, location capped at ~50–65 pts/day (API limit, not a bug) |
| Yanmar SmartAssist | Yanmar excavators | Session-login auth, per-day usage reports |
| Bouncie | On-road trucks | OAuth2, rotating refresh tokens, hours **and** miles |

Full provider quirks, DB schema, cron jobs, and known gotchas are documented in
`/workspace/wranglergps/README.md` (preserved verbatim in the fork) — treat it as the
source of truth for provider-specific behavior; this spec doesn't repeat it.

**Only Hapn-tracked equipment supports remote shutdown.** Deere/Yanmar/Bouncie APIs
are read-only (telemetry in, no device commands out) — confirmed against the README's
API surface. This is a hardware/API ceiling, not a scope choice.

## 2. Decisions made this session

1. **Provider accounts** — Hapn/Deere/Yanmar/Bouncie are already JacRentals-owned
   accounts (confirmed by Jac), so no credential re-registration is needed — only a
   hosting migration.
2. **Backend** — re-deployed as our own service (new Railway project under
   JacRentals' own account/billing, our own Postgres, fresh `SESSION_SECRET` /
   `DASHBOARD_PASSWORD`), forked code unchanged. Not rewritten into Apps Script: the
   live-location and remote-shutdown requirements need real-time polling and
   interactive device commands, which Apps Script's 6-minute execution cap and lack
   of persistent processes can't support, and the provider quirks (Hapn pagination,
   OAuth token rotation races) are already solved in working code — rewriting them
   would be pure risk for no benefit.
3. **Frontend** — the standalone React app is retired. Its functionality is rebuilt as
   new views inside Rental Wrangler's `app.js`, styled through `jactec-ui`. One app
   for the team.
4. **Browser talks directly to the GPS backend** (same pattern WranglerGPS's own
   frontend already uses) rather than proxying every call through the Apps Script
   backend, which would add latency and burn into Apps Script's daily URL-fetch quota
   for something that needs to feel live.
5. **Remote shutdown authority** — Owner, Dispatcher, and Mechanic/M.Tech roles only.
   The control doesn't render at all for other roles (not merely disabled), matching
   the existing "Must NOT see" pattern used elsewhere in the role framework.

## 3. Phasing

This is too large for one implementation pass — a five-page app plus a live-command
safety feature — so it's split in two. **This spec covers Phase 1 only.**

**Phase 1 (this spec):**
- Our own backend deployment (Railway + Postgres, forked code, our credentials)
- Unit-to-tracker mapping fields + a one-time manual backfill
- Enriched Unit-detail GPS section: live location, live ignition status, a real
  `gpsStatus` pill computed from live data
- Driving Score KPI wired to real data where available
- Remote shutdown control for Hapn-tracked units, role-gated

**Phase 2 (separate spec, later):** dedicated fleet-wide Live Tracking map view,
Tracker Health, Issues (fault codes), and full Reports/category-utilization pages,
ported in jactec-ui style — and reconciliation with the T2 daily-snapshot job from
the manager-metrics spec.

## 4. Architecture

```
 Rental Wrangler (app.js, browser)
   │
   ├── existing: Google Apps Script backend ⇄ Sheets   (unchanged — owns gpsProvider/
   │                                                     gpsDeviceId mapping data)
   │
   └── new: direct fetch ⇄ WranglerGPS backend (our own Railway + Postgres)
                              │
                              ├── Hapn API        (location, ignition, starter-interrupt)
                              ├── Deere API        (location, hours — read-only)
                              ├── Yanmar API       (location, hours — read-only)
                              └── Bouncie API      (location, hours, miles — read-only)
```

Apps Script/Sheets remains the system of record for which unit maps to which
tracker. The GPS backend remains the system of record for live telemetry only — no
telemetry gets copied into Sheets in Phase 1 (the aggregated fleet-status snapshot is
fetched live on each app load, not persisted).

## 5. Auth & data flow

- **Auth:** on Rental Wrangler login, silently call the GPS backend's `/auth/login`
  with the same team password and cache the returned token in memory for the
  session — no second login prompt. GPS backend `FRONTEND_URL`/CORS config points at
  `app.jacrentals.com` and the staging mirror.
- **Unit-to-tracker mapping:** two new fields on the Unit record, next to the existing
  `gpsType`/`gpsPlacement`: `gpsProvider` (`Hapn` | `Deere` | `Yanmar` | `Bouncie`) and
  `gpsDeviceId` (that provider's IMEI/principalId/contractId). Manually entered — an
  ops task, not an auto-match, since make/model naming isn't reliable enough to trust
  for a safety-relevant mapping.
- **Live detail, on open:** opening a mapped unit's detail popup calls that provider's
  status/location endpoint directly and renders it; a 30s refresh keeps it live while
  the popup stays open (scoped to one unit, not the whole fleet).
- **List/grid status pill:** one new **additive** backend endpoint,
  `GET /api/fleet/status`, aggregates a snapshot across all four providers for every
  mapped device in a single call. Rental Wrangler fetches it once per app load and
  computes the real `gpsStatus` pill fleet-wide from it — avoids polling N units
  individually from the browser.

## 6. UI (jactec-ui / yard data-plate)

Stays inside the existing Unit-detail popup's GPS section (app.js ~line 6422) rather
than a new window — smaller surface, no new `WINDOW_CATALOG` entry needed for Phase 1:

- **Live location:** "last seen" line (timestamp + map link) and an ignition-state
  chip, replacing the current static-only fields
- **Status pill:** the existing "No GPS" (red) / "GPS?" (yellow) pills become driven
  by the real `gpsStatus` from the fleet-status snapshot — same visual language, no
  new pill types
- **Remote shutdown control:** styled as an ignition-critical action, same
  hold/release-to-arm hazard-stripe pattern as the existing cancel-arc, red variant —
  cutting power is irreversible. Rendered only for Owner/Dispatcher/Mechanic-M.Tech.
- Every new/changed element gets its `data-r="Rxx"` stamp; `rule-usage.js` regenerated
  per the standing CI gate

## 7. Safety, error handling & audit trail

- **Role gating:** the shutdown control is absent from the DOM (not disabled) for any
  role outside Owner/Dispatcher/Mechanic-M.Tech.
- **Confirmation:** hold-to-arm hazard control, same interaction cost as the cancel-arc.
- **Audit trail — reuses the existing unit History section.** `historyFor()`
  (app.js:7052) already builds a unit's History log from inspections and work orders
  for `card === 'units'`. Shutdown commands (and significant GPS status transitions)
  become a new entry type merged into that same function's `units` branch, in the same
  `{when, pill, text, search}` shape the History UI already renders — no new UI
  component, and shutdown events show up alongside inspections/WOs in one timeline,
  attributed to who triggered it.
- **GPS backend unreachable:** GPS section falls back to last-known Sheet data with an
  explicit "as of `<timestamp>`, live link unavailable" notice — never silently
  presents stale data as live.
- **No ignition signal wired** (a known Hapn gotcha — some trackers are wired to
  constant power): shows "Not wired for ignition," distinct from "Not Reporting," so
  it doesn't read as a fault to chase.
- **Shutdown command not acked:** shows explicit failure, no silent success assumption,
  no auto-retry (avoids double-toggling a relay).
- **Deere/Yanmar/Bouncie units:** the shutdown control simply doesn't render — it's not
  possible on those trackers, so it isn't offered as a dead button.

## 8. Testing

- Extend `ci/smoke.mjs` / `ci/logic-test.mjs` to cover the new GPS section render and
  role-visibility of the shutdown control against a **mocked** backend response — CI
  never talks to the real live GPS service.
- Before promoting past `area/wrangler-gps`, a manual Staging E2E verifies live
  location renders end-to-end against the real backend.
- Remote shutdown gets tested against a real but **non-critical test tracker only** —
  never fleet equipment during business hours.
- Standard gates still apply: `node ci/gen-rule-usage.mjs --check`,
  `node ci/check-window-catalog.mjs` (unaffected — no new window),
  `node tools/gen-code-map.mjs --check`.

## 9. Open items / follow-ups (not blocking Phase 1 design approval)

- **Unit-tracker mapping backfill** is a real ops task — someone needs to go
  unit-by-unit and record which tracker is on which piece of equipment before the
  live GPS section means anything for that unit.
- **Railway project setup** (new project, Postgres provisioning, env vars, DNS) is an
  infra task alongside the code changes — not yet scheduled.
- Phase 2 scope (map view, Tracker Health, Issues, Reports) is intentionally deferred
  to its own spec once Phase 1 is proven.

---

## Spec self-review

- **Placeholders:** none — every section states a concrete decision, not a TBD.
- **Internal consistency:** architecture (§4), data flow (§5), and UI (§6) agree on
  "browser talks directly to the GPS backend, Sheets keeps only the mapping"; role
  gating in §2.5 matches §6 and §7.
- **Scope:** Phase 1 only, as scoped in §3 — Phase 2 explicitly deferred to its own
  spec, keeping this one implementable as a single plan.
- **Ambiguity check:** "leverage the unit history section" (Jac's addition) is made
  concrete in §7 by naming the exact function (`historyFor()`, app.js:7052) and the
  exact mechanism (new entry type in the existing `units` branch).
