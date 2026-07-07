# Implementation Plan — WranglerGPS Integration (Phase 1)

- **Date:** 2026-07-07
- **Spec:** `docs/superpowers/specs/2026-07-07-wrangler-gps-integration-design.md`
- **Area branch:** `area/wrangler-gps` · **Task branch:** `claude/gps-rental-wrangler-integration-5dme8g` · **PR:** #508 (draft)
- **Scope:** Phase 1 only — own-hosted backend, unit↔tracker mapping, enriched Unit-detail GPS section (live location + live status), Driving-Score wiring, Hapn-only role-gated remote shutdown. Phase 2 (fleet map view, Tracker Health, Issues, Reports) is a separate spec.

## Two tracks, run in parallel

Phase 1 splits into an **infra/ops track** (not code in this repo) and a **frontend track** (`app.js`/`config.js`/`style.css`). The frontend can be built and gate-tested against a **mock backend** before the real service is live, so the two tracks don't block each other until the Staging E2E.

### Track A — Infra/ops (outside this repo; Jac + a Haiku/plumbing pass where scriptable)

A1. **Stand up our own backend.** New Railway project under JacRentals' account; deploy the forked `operations-jacrentals/wranglergps` `backend/` unchanged; provision Railway Postgres (`DATABASE_URL`); set fresh `SESSION_SECRET` + `DASHBOARD_PASSWORD`; set the four providers' credentials (already JacRentals-owned) and the Deere/Bouncie `*_REDIRECT_URI` to the new Railway URL. Reconnect Deere + Bouncie OAuth once via Settings to seed tokens (README runbook).
A2. **CORS/allowed origin.** Set `FRONTEND_URL` to `https://app.jacrentals.com`; also allow the staging mirror origin for the E2E step.
A3. **~~New backend endpoint `GET /api/fleet/status`~~ — DROPPED (2026-07-07).** Reading `frontend/src/hooks/useFleet.js` showed the four-provider merge is already done **client-side** by calling the existing per-provider endpoints (`/api/hapn/devices` + `/fleet-status`, `/api/deere/status`+`/machines`, `/api/yanmar/status`+`/machines`, `/api/bouncie/status`+`/vehicles`) with `Promise.allSettled` (partial-failure tolerant). Rather than add a new endpoint to the friend's already-debugged backend (which the README warns against touching), **Track B mirrors this merge in our own `app.js`** — we control it, and the vendored backend stays untouched. Net: **zero new backend routes.** The only fork change is A3b.
A3b. **CORS — allow our origins.** DONE — fork PR operations-jacrentals/wranglergps#1 (draft): adds `.github.io` (staging mirror) + `localhost:9147` (local dev) and makes `FRONTEND_URL` a comma-list. Merges when Railway is stood up.
A4. **Unit↔tracker backfill (ops task).** Walk the fleet, record each unit's `gpsProvider` + `gpsDeviceId`. Blocks *meaningful* data per unit but not the frontend build.

### Track B — Frontend (this repo, `area/wrangler-gps`)

Build order — each step ends green before the next.

1. **Config + client module.** Add `GPS_BACKEND_URL` to `config.js` (alongside `BACKEND_URL`; a referrer-safe public URL). Add a small `gps` client in `app.js` (new APP chapter banner — update the code-map): `gpsLogin()` (calls `/auth/login` with the team password on Rental Wrangler login, caches token in memory), `gpsFleetStatus()` (one `/api/fleet/status` fetch per app load), `gpsUnitStatus(provider, deviceId)` (live detail), `gpsShutdown(deviceId)` (Hapn starter-interrupt). All wrapped in the existing timeout helper (app.js:15923) and a try/catch that degrades gracefully. **No proxy through Apps Script** — direct fetch, per spec §4.
2. **Mapping fields.** Add `gpsProvider` + `gpsDeviceId` to the Unit edit surface (the GPS section, app.js:6422–6426, next to `gpsType`/`gpsPlacement`) via `efld(...)`. `gpsProvider` is a small fixed set (`Hapn`/`Deere`/`Yanmar`/`Bouncie`) — a segmented control or select; `gpsDeviceId` a text field. Admin-editable (these are config, not live data). No schema migration — Sheets is schema-less.
3. **Live status → real `gpsStatus`.** On app load, `gpsFleetStatus()` populates an in-memory `gpsLive` map keyed by `deviceId`. Compute the displayed `gpsStatus` for a mapped unit from it (`online` → `Reporting`, stale/`Verify` heuristic → `Verify`, offline → `Not Reporting`), falling back to the stored `u.gpsStatus` field when the backend is unreachable. The existing pills (config `gpsStatus`: Reporting/Verify/Not Reporting) and the R3b "No GPS" data-chip stay as-is — only their *source* changes. Add the "as of `<ts>`, live link unavailable" notice on fallback (spec §7).
4. **Enriched GPS section (on open).** In the unit-detail GPS section, for a mapped unit: render a "last seen" line (timestamp + Google-maps link using the existing `GOOGLE_MAPS_KEY`) and an ignition-state chip from `gpsUnitStatus()`. Add a lightweight 30s refresh scoped to the open popup only (interval cleared on close), mirroring `useFleet.js` but single-unit. Distinguish "Not wired for ignition" from "Not Reporting" (spec §7).
5. **Remote shutdown control (Hapn only).**
   - **Role gate (AUTHORITY — resolve before building):** renders only for Owner + Dispatcher + Mechanic/M.Tech. The built-in role ids are `owner`/`admin`, `mechanic`/`mtech`, plus whatever the Dispatcher role id actually is in this deployment (there is no literal `dispatcher` in `BUILTIN_ROLE_TIERS` — **confirm the real role id with Jac / `settings.roleMeta` before wiring**, do not guess). Gate by an explicit allow-list of role ids, absent-from-DOM for others (not disabled) — matches the D5 "omit, don't hide" pattern used for cost/margin fields.
   - Renders only when `gpsProvider === 'Hapn'` (the other three are read-only).
   - Styled as the ignition-critical hold/release-to-arm hazard control (red variant), reusing the cancel-arc pattern (`.cancel-arc` in style.css).
   - On confirm → `gpsShutdown(deviceId)`; explicit success/failure toast, **no auto-retry**.
   - **Audit trail via existing History** (spec §7, Jac's addition): extend `historyFor(card, rec)` (app.js:7052) `card === 'units'` branch to merge shutdown events as `{ when, pill, text, search }` entries so they appear in the unit's existing History log, attributed. Source of these events: TBD in step 6 — a small append to a Sheet log via the Apps Script backend (`backendCall`) so the record survives (the GPS backend's Postgres is the live-command log, but the History log needs it in our own data). Pick the lightest of: (a) a new `gpsEvents` collection synced like other DATA, or (b) piggyback the unit's existing `serviceLog`/notes. **Decide in step 6, keep it additive.**
6. **Persist shutdown events for History.** Wire the chosen mechanism from step 5's audit note. Additive backend handler if needed goes through `/clasp` (additive-only, its own STOP-gated deploy) — not git.
7. **Driving Score KPI.** Wire the `null` placeholder (app.js:~7887, "Driving Score = GPS backend") to real data where the provider exposes it (Bouncie trips carry the signals; others may stay `null`). Keep `null` where unavailable rather than faking a number.
8. **R-rulebook + gates.** `data-r` stamps on every new element (mapping fields, last-seen line, ignition chip, shutdown control). Map to existing rules where they fit, else add `RULE_META` rows in the same edit. Regenerate `node ci/gen-rule-usage.mjs`. **No new popup window** → `WINDOW_CATALOG` unchanged (the enriched section lives inside the existing unit-detail window). Update the code-map if a chapter banner was added (step 1).

## Test checkpoints

- **After step 3:** with a mocked `/api/fleet/status` response, the Units list pills reflect live status; with the mock forced to fail, pills fall back to stored values + the "as of" notice — no silent stale-as-live.
- **After step 4:** opening a mapped unit renders last-seen + ignition; the 30s refresh updates and is cleared on close (no leaked interval); "Not wired for ignition" renders distinctly.
- **After step 5:** the shutdown control is present only for the allow-listed roles AND only for Hapn units; hold-to-arm fires exactly one command; a mocked non-ack shows failure with no retry; the event lands in the unit's History log.
- **Before push:** all gates green — `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`; zero R0 lint; screenshot the enriched GPS section (seed data + mock backend) for a jactec-ui self-critique. Port 8000→9147 for browser gates, then `git checkout -- ci/`.
- **Staging E2E (promotion-time only):** against the real backend — live location renders for a mapped unit; remote shutdown tested against a **non-critical test tracker only**, never fleet equipment in business hours.

## Model-triage notes (per CLAUDE.md)

- **Stays on main (never delegate):** the shutdown role gate + role-id resolution (authority/security), the direct-fetch auth wiring (a credential path), and the GPS-backend↔Sheets audit-trail contract (cross-system data shape).
- **Sonnet-delegable:** the mapping-field `efld` additions (step 2), the last-seen/ignition-chip render from a settled shape (step 4 UI), CSS for the hazard control from the existing cancel-arc (step 5 styling).
- **Haiku-delegable:** git/gh plumbing, the gate-runner sweep, code-map regen.
- **Track A infra** is Jac's call + scriptable plumbing; the Railway deploy is an irreversible-ish prod op — treat like the `/clasp` STOP gate (confirm before cutover).

## Risks

- **Backend not ours yet at build time** — mitigated by building Track B against a mock; real wiring proven only at Staging E2E.
- **Safety (remote shutdown)** — role-gated (absent-from-DOM), Hapn-only, hold-to-arm, no auto-retry, audited. The single highest-risk surface; its role gate is an explicit Jac decision, not inferred.
- **Dispatcher role id ambiguity** — the role framework's "Dispatcher" lens has no matching built-in role id; resolve the real id before gating (flagged in step 5) so the control isn't accidentally shown to the wrong role or hidden from the right one.
- **Direct-to-backend auth exposure** — the GPS backend is reached from the browser with the team token; confirm its own auth (README: `x-auth-token` on all `/api/*`) and CORS lock to our origins hold before go-live.
- **`app.js` size** — keep the new GPS client + render in one new APP chapter; update the code-map if a banner moves.
- **Two live-command logs** — the GPS backend's Postgres logs the relay command; our History log is the operator-facing record. Keep them consistent but don't try to make Sheets the command-of-record.
