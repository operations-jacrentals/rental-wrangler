# Backend deploy queue — ready the moment auth is unblocked (2026-07-06)

## Auth status (2026-07-06): clasp's user-OAuth is BLOCKED by Google's RAPT re-auth policy

Confirmed with a **brand-new** OAuth consent (not a stale token) — it fails
`invalid_grant / invalid_rapt` on the very first call. This is Google Workspace enforcing
a re-authentication policy on the `cloud-platform` scope for the `jacrentals.com` domain;
it's enforced server-side per-call and a CLI's refresh-token flow can never satisfy it.
**Re-running `clasp login` will not fix this** — don't retry it.

### The real fix — a SERVICE ACCOUNT (JWT auth, not subject to RAPT), Jac in progress

1. GCP project with the **Apps Script API** enabled.
2. A service account + JSON key in that project.
3. The Apps Script project's GCP link pointed at that project (script editor → ⚙️ Project Settings → GCP Project → Change project).
4. The Apps Script file shared with the service account's email as **Editor**.
5. The key, base64'd (`base64 -w0 keyfile.json`), set as the **`GAS_SA_KEY_B64`** env secret (never in chat/repo).
6. Start a fresh cloud session and say "deploy the backend queue" — it drives `docs/handoffs/gas-deploy-service-account.mjs` (push + deploy via the Apps Script REST API directly, no clasp involved).

### Fallback if the service-account setup stalls: deploy by paste

The Apps Script web editor always works regardless of any of the above —
https://script.google.com/d/1hw9A7Id3YIoiSCBkNFeDaKGRv-VtljFFIuBdQG5QULrgS0DjQhQ_2vyZ/edit
→ paste the spliced `Code.js` → Deploy → Manage deployments → Edit the existing deployment → New version. Slower, zero dependency on OAuth/service-account plumbing.

### (Historical — clasp user-OAuth re-arm, superseded by the service account above)
1. `npx @google/clasp login` (browser OAuth as operations@jacrentals.com) — **will hit invalid_rapt immediately per the above; kept only for reference if Google's policy ever changes**
2. `base64 -w0 ~/.clasprc.json` (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.clasprc.json"))`)
3. Paste the output into the **`CLASPRC_JSON_B64`** environment secret (Claude Code env settings — never into chat/repo)
4. Start a **fresh cloud session** (secrets inject at session start) and say "deploy the backend queue"

## The queue (all ADDITIVE — splice into Code.gs, one push, one redeploy)

| # | Item | Source | Wire-up | Post-deploy |
|---|---|---|---|---|
| 1 | **perfReport** — Web-Vitals sink → `_perf` tab (5k-row FIFO, metrics-only by construction) | `perf-report-backend.gs` | `if (action === 'perfReport') return perfReport_(body);` | Nothing — the client already flushes (fire-and-forget); data appears as sessions run |
| 2 | **unitDaily snapshots (M4)** — daily unit hours/fleet-status history | `unit-daily-snapshots.gs` | router line per that file + run `installUnitDailyTrigger()` ONCE | Unblocks KPI trend sparklines + true hour-based utilization |

Deploy flow via the service account (same deployment id, same exec URL — the script never
calls a bare "new deployment" path, so the URL the app already calls stays fixed):
```bash
npm i --no-save googleapis   # ephemeral, not committed
#  splice both .gs files' contents into ~/rw-backend/Code.js (pull via the web editor's
#  file view if clasp pull is also blocked, or via the Drive API — Code.js is not in git)
GAS_SA_KEY_B64=... node docs/handoffs/gas-deploy-service-account.mjs push
GAS_SA_KEY_B64=... node docs/handoffs/gas-deploy-service-account.mjs deploy "perfReport sink + unitDaily snapshots"
```
Verify: `curl -s -L -G --data-urlencode "action=load" --data-urlencode "password=<role-pw>" "$EXEC_URL" | head -c 120`
then run one app session and confirm a `_perf` row lands; run `installUnitDailyTrigger()` in the editor once.

## NOT in the queue (bigger, later)
- Collections Phase-2 outbound (`collectionsSend` + agency token) — needs the vendor pick first (spec collections OQ-13)
- Views getViews/setViews — retired client-side; the actions can stay deployed, harmless
- Per-role passwords / tier gates — **already live** (`role-tiers-backend.gs`, deployed 2026-06-26 era); the specs' "backend-data OQ-1 blocker" is narrower than written: what remains is per-ACTION tier maps for the new Phase-2 actions when they land

## Standing rule
Every deploy here is `/clasp` STOP-gated — Jac's explicit go before `clasp deploy`, every time.
