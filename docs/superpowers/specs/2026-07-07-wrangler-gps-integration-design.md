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
- **Addendum (Jac, 2026-07-07):** GPS devices must be addable to units **from Rental
  Wrangler**, not the providers' own dashboards, with live feedback during setup, plus
  a **GPS status & alert history feed** modeled on the customer-thread pattern shipped
  to `staging` (`docs/specs/comms-notifications.md`, commit `403b406` — the `.chat-dock`
  UI extended to per-record timelines). See §5a and §6a. Folded into Phase 1.
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
- **Connect-a-device wizard** in the GPS section (§5a): provider picker → identifier
  entry/search → live first-contact feedback, replacing raw text-field mapping entry
- Enriched Unit-detail GPS section: live location, live ignition status, a real
  `gpsStatus` pill computed from live data
- **GPS status & alert history feed** (§6a): a persisted, chat-dock-styled timeline of
  status transitions, provider alerts, and shutdown commands
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
                              ├── Bouncie API      (location, hours, miles — read-only)
                              └── new: device_events table (Postgres) — durable log of
                                        status transitions + shutdown commands (§5a/§6a)
```

Apps Script/Sheets remains the system of record for which unit maps to which
tracker. The GPS backend remains the system of record for live telemetry AND now
the **event history** (new — see §5a): still no raw telemetry copied into Sheets, but
a small, durable `device_events` table is added to the GPS backend's existing
Postgres (alongside `ignition_events`/`engine_sessions`) so status changes, alerts,
and shutdown commands survive past a single page load. This is the one Phase 1
addition to the forked backend beyond redeploying it unchanged — additive only, new
table + two new route handlers (write on shutdown, read for the history feed), no
existing endpoint touched.

**Provisioning reality (researched 2026-07-07):** none of the four providers expose a
public API to register a *new* device — confirmed for Hapn specifically (activation is
a paid checkout flow at `checkout.gethapn.com`, gated to the Account Owner login, not
an API; Hapn's own docs list no device-creation endpoint) and true by construction for
Deere/Yanmar (OEM-enrolled telematics — the device exists in their system before we'd
ever call an API) and Bouncie (physical OBD dongle, paired via their own app). So the
connect wizard (§5a) does not eliminate the provider's one-time physical/account-level
activation step — it eliminates ever needing to *open the provider's dashboard* to
link, monitor, or manage a device from Rental Wrangler afterward, which is what was
actually being asked for.

## 5. Auth & data flow

- **Auth:** on Rental Wrangler login, silently call the GPS backend's `/auth/login`
  with the same team password and cache the returned token in memory for the
  session — no second login prompt. GPS backend `FRONTEND_URL`/CORS config points at
  `app.jacrentals.com` and the staging mirror.
- **Unit-to-tracker mapping:** stored the same as originally planned — two fields on
  the Unit record, next to the existing `gpsType`/`gpsPlacement`: `gpsProvider`
  (`Hapn` | `Deere` | `Yanmar` | `Bouncie`) and `gpsDeviceId` (that provider's
  IMEI/principalId/contractId). **How they get set changes — see §5a**, the connect
  wizard replaces raw text-field entry.
- **Live detail, on open:** opening a mapped unit's detail popup calls that provider's
  status/location endpoint directly and renders it; a 30s refresh keeps it live while
  the popup stays open (scoped to one unit, not the whole fleet).
- **List/grid status pill:** one new **additive** backend endpoint,
  `GET /api/fleet/status`, aggregates a snapshot across all four providers for every
  mapped device in a single call. Rental Wrangler fetches it once per app load and
  computes the real `gpsStatus` pill fleet-wide from it — avoids polling N units
  individually from the browser.

## 5a. Connect-a-device wizard (added 2026-07-07)

A guided flow inside the Unit's GPS section that sets `gpsProvider`/`gpsDeviceId`
*and* confirms the device is actually reporting, instead of trusting a hand-typed
IMEI. Never leaves Rental Wrangler; does not require the provider's dashboard.

1. **Pick provider** — segmented control: Hapn / Deere / Yanmar / Bouncie.
2. **Identify the device** — differs by provider because "adding" means different
   things per §4's provisioning reality:
   - **Hapn:** enter the IMEI (printed on the tracker, per Hapn's own activation
     instructions — a technician reads this off the hardware). The device must
     already be activated on the Hapn account (that one-time step still happens at
     `checkout.gethapn.com`, outside Rental Wrangler — physically installing +
     paying for a tracker isn't something any software UI can skip).
   - **Deere / Yanmar / Bouncie:** a **searchable picker** of machines/vehicles
     already visible to our authorized account (`GET /api/deere/machines`, Yanmar
     `/machines`, `GET /api/bouncie/vehicles` — all three already exist in the
     forked backend), so the operator picks "this is Unit U024" from a live list
     instead of copying an ID by hand. These machines already exist in the
     provider's system by the time they're ours to pick — nothing to "activate."
3. **Live first-contact feedback** — poll that provider's status endpoint for this
   device every few seconds (short-lived client-side poll, capped attempts):
   `waiting for signal…` → `device seen — confirming location…` → `✓ Reporting` (or
   an explicit `Not responding yet — check the tracker's power/signal` after the cap,
   not a silent hang).
4. **Save** — only on confirmed first contact (or an explicit "save anyway, it may
   take longer to report" override) does `gpsProvider`/`gpsDeviceId` get written to
   the Unit record. Prevents silently mapping a typo'd IMEI that never resolves.

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
- **Connect wizard (§5a):** a small step-through popup launched from the GPS section's
  current "No GPS" badge / edit affordance — provider segmented control, then either a
  text field (Hapn) or a searchable list (Deere/Yanmar/Bouncie), then a live status
  line (spinner → check/✕) per step 3 of §5a. Uses existing form/popup chrome, no new
  visual language.
- Every new/changed element gets its `data-r="Rxx"` stamp; `rule-usage.js` regenerated
  per the standing CI gate

## 6a. GPS status & alert history feed (added 2026-07-07)

Modeled directly on the `.chat-dock`/`.chat-feed` pattern (APP-23, extended for
customer threads in `docs/specs/comms-notifications.md` D5) — a scrollable, timestamped
feed, read-only (no compose box; nothing "replies" here), living in the Unit's GPS
section rather than the global bottom dock (this is per-unit, not a cross-record
thread).

- **Entry types**, each rendered like a feed row (icon + timestamp + text, color by
  severity — reusing existing status colors, not new ones):
  - Status transitions (`Reporting` ↔ `Verify` ↔ `Not Reporting`), sourced from the
    same live-status calls already made for the pill (§5); a transition is written to
    `device_events` server-side when detected (backend already polls/refreshes on its
    existing crons — piggyback there rather than adding new polling).
  - Provider alerts — pulled live from each provider's existing alert endpoint (Hapn
    `/device/:imei/alerts`, Yanmar `/machine/:id/alerts`, Bouncie's `mil` field) and
    rendered as feed entries. **Scope honesty:** these provider endpoints return
    *current* alerts, not a history — so Phase 1's alert feed is "current alerts,
    shown in the timeline as of when we started polling" going forward, not a
    retroactive backfill of alerts that happened before this ships.
  - Shutdown commands — every attempt (success and failure), who triggered it, from
    the same `device_events` write §7 already required for audit. **This supersedes
    the original plan to merge shutdown events into `historyFor()`/the generic unit
    History section** — the dedicated feed is the single audit trail for GPS events;
    the generic History section is not touched.
- **Persistence:** `device_events` table in the GPS backend's Postgres (§4), fetched
  via a new read endpoint scoped to one device, called when the GPS section opens
  (same on-open pattern as live detail, not a full-sync).
- **Empty state:** "No GPS events yet" — same empty-state convention as other feeds.

## 7. Safety, error handling & audit trail

- **Role gating:** the shutdown control is absent from the DOM (not disabled) for any
  role outside Owner/Dispatcher/Mechanic-M.Tech.
- **Confirmation:** hold-to-arm hazard control, same interaction cost as the cancel-arc.
- **Audit trail — the GPS status & alert history feed (§6a), not the generic unit
  History section.** *(Revised 2026-07-07 — originally planned to merge shutdown
  events into `historyFor()`/app.js:7052; superseded once the dedicated feed was
  added, so there's one GPS audit trail, not two.)* Every shutdown attempt (success or
  failure) writes a `device_events` row server-side — who triggered it, when, and the
  outcome — and appears in that unit's feed immediately.
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

- **Unit-tracker mapping backfill** is a real ops task — someone still needs to go
  unit-by-unit and run the connect wizard (§5a) per unit before the live GPS section
  means anything for that unit. The wizard makes each one faster/safer, it doesn't
  eliminate the need to do all of them.
- **Railway project setup** (new project, Postgres provisioning, env vars, DNS) is an
  infra task alongside the code changes — in progress (runbook:
  `docs/handoffs/wrangler-gps-railway-standup.md`).
- **Historical alerts pre-dating Phase 1** are not recoverable — §6a's alert entries
  only exist from when polling starts; the providers' alert endpoints expose current
  state, not a history we can backfill.
- **Hapn dealer/reseller API tier** — researched 2026-07-07, found no evidence one
  exists (Hapn's own docs list no device-creation endpoint of any kind; activation is
  a checkout/billing flow). If Hapn support ever confirms a partner tier with
  programmatic provisioning, §5a's Hapn step could be simplified — not assumed here.
- Phase 2 scope (map view, Tracker Health, Issues, Reports) is intentionally deferred
  to its own spec once Phase 1 is proven.

---

## Spec self-review

- **Placeholders:** none — every section states a concrete decision, not a TBD.
- **Internal consistency:** architecture (§4), data flow (§5/§5a), and UI (§6/§6a)
  agree on "browser talks directly to the GPS backend, Sheets keeps only the
  mapping, `device_events` is the one new durable table"; role gating in §2.5 matches
  §6 and §7; §7's audit-trail bullet was updated to match §6a rather than left
  pointing at the superseded `historyFor()` approach.
- **Scope:** Phase 1 only, as scoped in §3 — Phase 2 explicitly deferred to its own
  spec, keeping this one implementable as a single plan. The 2026-07-07 addendum
  (connect wizard + history feed) was folded into Phase 1 per Jac's explicit call,
  not left as scope creep.
- **Ambiguity check:** "add devices from Rental Wrangler, no provider UI" is made
  concrete by researching what's actually achievable per provider (§4) rather than
  promising a uniform capability that doesn't exist — the wizard's Hapn step and its
  Deere/Yanmar/Bouncie picker step are explicitly different because the underlying
  provisioning reality differs.
