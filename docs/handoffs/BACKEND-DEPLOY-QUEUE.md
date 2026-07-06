# Backend deploy queue — ready the moment clasp is re-armed (2026-07-06)

The cloud clasp credential is RAPT-expired (`invalid_grant / invalid_rapt`). Re-arm
(2 minutes, Jac's machine):

1. `npx @google/clasp login` (browser OAuth as operations@jacrentals.com)
2. `base64 -w0 ~/.clasprc.json` (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.clasprc.json"))`)
3. Paste the output into the **`CLASPRC_JSON_B64`** environment secret (Claude Code env settings — never into chat/repo)
4. Start a **fresh cloud session** (secrets inject at session start) and say "deploy the backend queue"

## The queue (all ADDITIVE — splice into Code.gs, one push, one redeploy)

| # | Item | Source | Wire-up | Post-deploy |
|---|---|---|---|---|
| 1 | **perfReport** — Web-Vitals sink → `_perf` tab (5k-row FIFO, metrics-only by construction) | `perf-report-backend.gs` | `if (action === 'perfReport') return perfReport_(body);` | Nothing — the client already flushes (fire-and-forget); data appears as sessions run |
| 2 | **unitDaily snapshots (M4)** — daily unit hours/fleet-status history | `unit-daily-snapshots.gs` | router line per that file + run `installUnitDailyTrigger()` ONCE | Unblocks KPI trend sparklines + true hour-based utilization |

Deploy flow (same deployment id — NEVER a bare `clasp deploy`):
```bash
cd ~/rw-backend && clasp pull
#  splice both .gs files' contents into Code.js
clasp push --force
clasp deploy -i AKfycbzHahzgJqOYe9o4GKlRVGh-A7USRn1k4Dvyy4ajLh8EYCqVxofouM28qs8trNlObZw -d "perfReport sink + unitDaily snapshots"
```
Verify: `curl -s -L -G --data-urlencode "action=load" --data-urlencode "password=<role-pw>" "$EXEC_URL" | head -c 120`
then run one app session and confirm a `_perf` row lands; run `installUnitDailyTrigger()` in the editor once.

## NOT in the queue (bigger, later)
- Collections Phase-2 outbound (`collectionsSend` + agency token) — needs the vendor pick first (spec collections OQ-13)
- Views getViews/setViews — retired client-side; the actions can stay deployed, harmless
- Per-role passwords / tier gates — **already live** (`role-tiers-backend.gs`, deployed 2026-06-26 era); the specs' "backend-data OQ-1 blocker" is narrower than written: what remains is per-ACTION tier maps for the new Phase-2 actions when they land

## Standing rule
Every deploy here is `/clasp` STOP-gated — Jac's explicit go before `clasp deploy`, every time.
