# WranglerGPS backend handoff (from Cameron) — annotated

Original doc from Cameron (the backend's author), addressed to Jacob, for
integrating WranglerGPS into Rental Wrangler. Reproduced in full below for
reference, with one correction up front.

## Correction: don't follow §8 ("Suggested integration order")

§8 assumes Rental Wrangler will host its own Node/Express + Postgres backend
and that `db.js`/`tokenManager.js`/the route files get **ported into** it.
That's not our architecture and isn't necessary:

- Rental Wrangler has no Node runtime — it's a vanilla-JS SPA + Google Apps
  Script backend + Sheets (see repo `CLAUDE.md`). There's nothing to port
  Express/Postgres code *into*.
- Our approved design (`docs/superpowers/specs/2026-07-07-wrangler-gps-integration-design.md`)
  keeps Cameron's backend **unchanged**, forked to `operations-jacrentals/wranglergps`,
  redeployed as our **own standalone Railway + Postgres service** under our
  own credentials. Rental Wrangler's `app.js` calls it directly over HTTPS
  (see the Railway runbook: `docs/handoffs/wrangler-gps-railway-standup.md`).
- This is lower-risk than porting: none of the already-debugged logic (Hapn's
  broken-pagination cursor, the Deere/Bouncie rotating-refresh-token guards,
  the ignition-session pairing) needs to be reimplemented or re-verified.

Sections 1–7 below (data model, auth model, usage-computation flow, API
surface, gotchas) are accurate regardless of hosting and are the real value
of this doc — that's what Track B's frontend integration is built against.

## Addendum — from Cameron's raw session transcript (2026-07-07)

Cameron also shared his full Claude Code development transcript. Two things
worth recording that aren't in the README or the doc below:

- **Yanmar account confirmed JacRentals-owned** (`sales@jacrentals.com` login).
  No credential migration needed for Yanmar.
- **Historical Hapn incident (already fixed in the code we forked):** early on,
  `backfillIgnitionEvents` ran in full on every server restart (in addition to
  the hourly cron), which exhausted Hapn's account-level API quota on
  `api.iotgps.io` (AWS API Gateway `LimitExceededException`, HTTP 429) and made
  Hapn units disappear from the dashboard. Fix: don't run the backfill at boot.
  Confirmed still fixed in the forked `server.js` — the startup listener only
  warms the Hapn token and Yanmar login, it does not call
  `backfillIgnitionEvents`. **Regression trap for later:** if anyone adds a
  startup-time backfill call back in, this will recur — Hapn's quota is a hard
  account-level ceiling, not something a retry/backoff fixes.
- **Not found in the transcript:** any statement of who owns the Deere or
  Bouncie developer-portal app registrations. Searched for org-ID mentions,
  `developer.deere.com`, account/signup language, and Cameron's own saved
  memory index — none of it says whose account. Still needs to come from
  Cameron directly (see the open item in the Railway runbook).

---

## Original doc

**For:** Jacob, integrating the WranglerGPS backend into Rental Wrangler.
**Purpose:** Everything the WranglerGPS backend does, why it does it that way, and
the non-obvious details you need to reimplement/port it correctly. Read this
alongside `README.md` (architecture) — this doc focuses on the integration
surface and the hard-won decisions.

The whole backend exists to do one thing: **pull fleet telematics from four
providers, normalize it, and compute engine-usage/utilization.** If you take
nothing else, take the "Data model" and "Gotchas" sections — they encode weeks
of debugging.

---

### 1. The four integrations (auth model + what you get)

| Provider | What it covers | Auth | Base URL |
|---|---|---|---|
| **Hapn** (iotgps.io) | Small equipment: skid steers, lifts, light towers, stump grinders, trenchers, buggies | OAuth2 client-credentials (server-to-server, no user step) | `https://api.iotgps.io/v1` |
| **John Deere** | Deere skid steers/dozers (317G, 325G, 450K) | OAuth2 auth-code (user connects once) | `https://api.deere.com` |
| **Yanmar SmartAssist** | Yanmar excavators (VIO25–80, SV100) | **Session login** (POST id+password → token) | `https://api.smartassist.yanmar.com/terra-cs` |
| **Bouncie** | On-road trucks | OAuth2 auth-code (user connects once) | `https://api.bouncie.dev/v1` |

Token handling lives in `backend/tokenManager.js` (Hapn/Deere/Bouncie) and
`backend/routes/yanmar.js` (Yanmar). Deere & Bouncie tokens persist in Postgres
(`deere_tokens`, `bouncie_tokens`) so they survive restarts. Hapn re-auths from
client credentials on demand. Yanmar re-logs-in from stored/env credentials.

**Note confirmed against the Hapn dashboard screenshot Jac captured:** Hapn's
"API Tokens" page (Client ID + Secret) is exactly this client-credentials pair
— `HAPN_CLIENT_ID` / `HAPN_CLIENT_SECRET`. No interactive OAuth step needed for
Hapn, unlike Deere/Bouncie.

#### Normalized machine shape
`frontend/src/hooks/useFleet.js` shows the merged shape every provider is mapped
into — use it as the canonical model for a machine:

```
{ id, source: 'hapn'|'deere'|'yanmar'|'bouncie',
  name, make, model, serialNumber,
  lat, lng, engineOn, moving, lastSeen,
  imei | principalId | contractId,   // provider-specific key
  engineHours, address, battery/batteryVoltage }
```

---

### 2. Data model (Postgres — `backend/db.js`)

Tables are created on boot (`initDb`). **Railway's filesystem is ephemeral, so
everything durable lives here.**

| Table | Purpose |
|---|---|
| `ignition_events` | Raw Hapn ignition events (GTIGN/GTIGF/GTVGN/GTVGF). Dedup source for the backfill. |
| `engine_sessions` | Paired engine on→off sessions. **This is Hapn's usage.** |
| `daily_usage` | Durable per-(source, machine_key, day) hours+miles cache. |
| `device_settings` | Hapn starter-interrupt (kill-switch) enable/disable state. |
| `deere_tokens` / `bouncie_tokens` | Persisted OAuth tokens. |
| `yanmar_credentials` | DB-stored Yanmar login (overrides env, updatable in-app). |

---

### 3. How usage is computed (the core logic)

#### Hapn usage = ignition sessions
Hapn has **no usage API**. Engine time is derived from ignition events:
- `GTIGN`/`GTIGF` = hardwired ignition on/off
- `GTVGN`/`GTVGF` = virtual (voltage/motion) ignition on/off — treat identically
- Pair on→off into rows in `engine_sessions`.

Two populate paths (both in `server.js` + `routes/webhooks.js`):
1. **Real-time:** Hapn webhook → `POST /webhooks/hapn` → `upsertEngineSession`.
2. **Hourly backfill cron** (`backfillIgnitionEvents`): re-scans each device's
   `/messages` for missed events, and auto-closes sessions stuck "in progress"
   >24h (missed ignition-off).

#### Everything else = daily cache
`GET /api/usage/daily?source=&key=&start=&end=` (`routes/usage.js`) returns
per-day `{ hours, miles }`. **Past (completed) days are computed once and stored
in `daily_usage`; only the current day is fetched live.** Per source:
- Hapn → summed from `engine_sessions` (DB, no upstream call)
- Yanmar → per-day `/dailyWorkReport/detail` (also file/DB cached)
- Deere → `hoursOfOperation` engine-state segments
- Bouncie → `/trips` (duration + distance)

**Critical rule:** a *failed* upstream fetch is never written as `0` — that would
poison the cache permanently. Only successful results are cached.

#### Category utilization (the report)
`frontend/src/pages/Reports.jsx`, but the logic is portable:
- `getCategory(machine)` maps make/model → category (Skid Steer, 6k/8k/12k/20k
  Excavator, Light Tower, Stump Grinder, Concrete Buggy, Telehandler, Trencher,
  Scissor Lift, Boom Lift, Dozer, Trucks).
- Each category has a target hrs/day (`CATEGORY_HOURS_PER_DAY`); Trucks also has
  target mi/day. **Utilization = actual ÷ (target × active-unit-count)**, rolling
  15-day window.
- A unit is **inactive/down** if it logged `< 0.05 hrs` over the window — excluded
  from count, totals, and denominator; surfaced via a "Show inactive units" button.
- Over 100% → "Over capacity" message, splitting needed units across **repair**
  (available inactive units) and **purchase** (the remainder).
- **Reporting timezone is America/Chicago** everywhere.

---

### 4. API endpoints (the integration surface)

Auth: all `/api/*` and the Deere/Bouncie routes require header
`x-auth-token: <token>` (token returned by `POST /auth/login`). Public:
`/auth/login`, `/health`, OAuth callbacks, `/webhooks/*`.

**Hapn** (`/api/hapn`): `/devices`, `/fleet-status`, `/device/:imei/status`,
`/device/:imei/messages`, `/device/:imei/engine-sessions`,
`/device/:imei/db-sessions`, `/device/:imei/alerts`, `/device/:imei/trailering`,
`/device/:imei/db-stats`, starter-interrupt toggle; `POST /api/hapn/backfill-now`.

**Deere**: `/api/deere/status`, `/api/deere/machines`,
`/api/deere/machine/:principalId/{hours,locations,state,trailering}`.

**Yanmar** (`/api/yanmar`): `/status`, `PUT /credentials`, `/machines`,
`/machine/:id/alerts`, `/machine/:contractId/daily-report`.

**Bouncie**: `/api/bouncie/{status,vehicles}`, `/api/bouncie/vehicle/:imei/trips`.

**Unified usage**: `GET /api/usage/daily?source=&key=&start=&end=`.

**Webhook**: `POST /webhooks/hapn` (real-time ignition).

---

### 5. Background jobs (`server.js` crons)

| Schedule | Job |
|---|---|
| every 55 min | Refresh Hapn token |
| top of every hour | Ignition backfill + close stale sessions |
| every 30 min | Bouncie token keep-alive |
| every 4 hours | Deere token keep-alive |

---

### 6. Gotchas — the weeks-of-debugging list (do NOT re-discover)

1. **Hapn `/messages` pagination is broken.** Oldest-first, capped per request,
   **`nextToken` does not work.** You MUST time-cursor: advance `startDate` to
   the newest message received, with `limit: 1000`. A small limit only covers a
   few minutes of a fast-pinging unit and makes usage silently stop.
2. **Some Hapn trackers report no ignition.** If wired to constant battery power
   (not switched/ignition), a unit only sends `GTFRI` (position) + `GTMPN/GTMPF`
   (main power, constant-on — useless as an engine proxy) + `GTTOW` (movement).
   Those units show 0 engine hours — the fix is to enable ignition detection on
   the tracker in the Hapn portal, not in code.
3. **Deere location is decimated.** The API returns only ~50–65 GPS points/day
   per machine. Operations Center's denser path reads Deere's internal feed,
   which is **not exposed by any API endpoint** (`/locations`,
   `/machineLocations`, ISG location = 404). We already get 100% of what's
   available; there is nothing denser to fetch.
4. **Deere & Bouncie refresh tokens are single-use (rotating).** Concurrent
   refreshes invalidate each other and kill auth (~24h). `tokenManager.js` uses a
   shared in-flight refresh promise + keep-alive crons to prevent this. Preserve
   this pattern.
5. **Deere `hoursOfOperation` records gaps.** A machine can be online (GPS/
   battery reporting) yet show no engine runtime if JDLink stops logging it —
   that's a Deere-side data gap, not a bug. Cross-check the cumulative hour meter.
6. **Provider "currently running" flags can be stale.** Bouncie `isRunning` /
   Yanmar `latestRunState` are passed straight through with no freshness check.
7. **Railway FS is ephemeral** — persist tokens/caches in Postgres only.

---

### 7. Environment variables

```
# Hapn
HAPN_CLIENT_ID= / HAPN_CLIENT_SECRET=
# John Deere
DEERE_CLIENT_ID= / DEERE_CLIENT_SECRET=
DEERE_REDIRECT_URI=<backend>/auth/deere/callback
DEERE_ORG_ID=521951
# Bouncie
BOUNCIE_CLIENT_ID= / BOUNCIE_CLIENT_SECRET=
BOUNCIE_REDIRECT_URI=<backend>/auth/bouncie/callback
# Yanmar (fallback if no DB credential)
YANMAR_ID= / YANMAR_PASSWORD=
# App
DATABASE_URL=            # Postgres
SESSION_SECRET=          # dashboard auth token derives from this
DASHBOARD_PASSWORD=      # login password
FRONTEND_URL=            # for CORS + OAuth redirects
```

---

### 8. Cameron's suggested integration order — SUPERSEDED, see correction at top

~~1. Stand up Postgres and port `db.js` (tables + queries) first.~~
~~2. Port `tokenManager.js` (keep the rotating-refresh guards) + the four route files.~~
~~3. Port the webhook + hourly backfill.~~
~~4. Port `routes/usage.js`.~~
~~5. Reuse `getCategory` + the category targets for utilization.~~

Not applicable — see the correction at the top of this doc. We redeploy the
backend unchanged instead of porting it.
