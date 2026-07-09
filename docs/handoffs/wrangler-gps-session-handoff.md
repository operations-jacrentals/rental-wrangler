# WranglerGPS integration — session handoff (2026-07-07)

Full Phase 1 of the WranglerGPS → Rental Wrangler integration, built this session.

## Status: Phase 1 code complete, awaiting merges + live verification

**Branch:** `claude/gps-rental-wrangler-integration-5dme8g` (off `area/wrangler-gps`, off `staging`)
**PR:** rental-wrangler #508 (draft) · **Backend PR:** wranglergps #2 (draft)
**Backend live:** `https://wranglergps-production-c2ad.up.railway.app` (Railway, our account)

## All four providers connected
Hapn (server creds) · Yanmar (`sales@jacrentals.com`) · Bouncie (OAuth, 2 trucks) · Deere (OAuth, org 521951, SANDBOX tier). CORS fix (wranglergps #1) merged.

## What shipped (rental-wrangler #508, commits on the branch)
1. GPS client module (four-provider merge, login, live status, shutdown, events)
2. Connect-a-device wizard (`gpsConnect` popup)
3. Live-driven `gpsStatus` (freshness-derived, stored fallback)
4. Enriched GPS section (last-seen + map link + engine chip, view-scoped 30s poll)
5. Status & alert history feed (chat-feed styled, from `device_events`)
6. Remote shutdown — Hapn starter-interrupt, arm→confirm hazard control, role-gated
   (Owner/Admin + Manager + Mechanic/M.Tech), audited. **Polarity: `enabled:false` = immobilize.**
7. Driving Score KPI (fleet Bouncie safety score; null when no data; tunable weights)

## Backend (wranglergps #2 — MERGE TO DEPLOY)
`device_events` table + `GET /api/device/:source/:key/events` + shutdown audit write. Additive.

## OPEN — needs Jac
1. **Merge wranglergps #2** → deploys `device_events` → lights up the history feed + shutdown audit.
2. **Local visual check** — serve the branch, log in, open a unit: wizard, live pills, enriched
   section, and the shutdown arm→confirm (I could not screenshot from the cloud sandbox).
3. **Exercise remote shutdown on a NON-critical test tracker only** (never live equipment in
   business hours) + confirm the audit row appears in the feed.
4. **Deere Okta admin** — the app (`0oav39jk2w7ByM70V5d7`) is Cameron's; adding redirect URIs
   needed his console access. Works now, but ownership is still his.

## Known limitations (documented in-code + spec)
- Shutdown gate is client-side + server audit, NOT server-enforced-per-role (one shared team token).
- No "not wired for ignition" distinction yet (needs a backend message-type signal).
- Feed shows shutdown history now; auto `status_change` population + live alert merge are deferred.
- Driving Score is a FLEET metric (per-truck telematics, no driver↔trip attribution); weights tunable.
- Deere SANDBOX tier.

## Promotion path (unchanged)
`area/wrangler-gps` accumulates → local test → (when Jac chooses) → `staging` → Staging E2E → one PR to `main`. Nothing here has touched `main`/production.
