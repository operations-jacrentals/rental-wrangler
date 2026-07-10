# WranglerGPS backend — Railway standup runbook (Track A)

Stand up **our own** copy of the WranglerGPS backend so we don't depend on the
friend's hosting. The code is already forked to `operations-jacrentals/wranglergps`.
This deploys its `backend/` to a new Railway project under JacRentals' account.

**Secrets rule:** every value below goes straight into Railway's own env-var UI,
entered by Jac. Never paste a secret into chat, a commit, or this repo.

## Prereqs (confirmed)
- Fork exists: `operations-jacrentals/wranglergps` (backend unchanged from source).
- Provider accounts (Hapn / Deere / Yanmar / Bouncie) are JacRentals-owned — reuse
  the same credentials, no re-registration.
- Backend boot config: `startCommand: node server.js` (railway.json, NIXPACKS),
  health check at `GET /health`, listens on `process.env.PORT`.

## Steps (Railway dashboard — Jac drives)

1. **New project** → *Deploy from GitHub repo* → pick `operations-jacrentals/wranglergps`.
2. **Set the service root directory to `backend/`** (the repo has `backend/` + `frontend/`;
   Railway must build only `backend/`). Settings → *Root Directory* = `backend`.
   Railway auto-detects Node/NIXPACKS and uses `node server.js`.
3. **Add Postgres**: project → *New* → *Database* → *Add PostgreSQL*. Railway injects
   `DATABASE_URL` into the service automatically. (Tables auto-create on boot — see
   `backend/db.js`.)
4. **Set service env vars** (Variables tab). Names are exact — values entered by Jac:
   ```
   SESSION_SECRET        long random string (the dashboard auth token is derived: SESSION_SECRET + "_authed")
   DASHBOARD_PASSWORD    the password Rental Wrangler will send to /auth/login (use the team password so login is silent)
   FRONTEND_URL          https://app.jacrentals.com
   HAPN_CLIENT_ID        (JacRentals Hapn app)
   HAPN_CLIENT_SECRET
   DEERE_CLIENT_ID       (JacRentals Deere app)
   DEERE_CLIENT_SECRET
   DEERE_ORG_ID          521951   (from source README; confirm it's ours)
   DEERE_REDIRECT_URI    https://<this-railway-url>/auth/deere/callback
   BOUNCIE_CLIENT_ID
   BOUNCIE_CLIENT_SECRET
   BOUNCIE_REDIRECT_URI  https://<this-railway-url>/auth/bouncie/callback
   YANMAR_ID             (fallback only; can also be set in-app later)
   YANMAR_PASSWORD       (fallback only)
   ```
   `DATABASE_URL` and `PORT` are provided by Railway — don't set them by hand.
   Note the two `*_REDIRECT_URI` values need the Railway URL, so you may set them
   after the first deploy gives you the domain, then redeploy.
5. **Deploy.** Watch logs for `🚜 JAC Fleet Backend running on port …`. Verify:
   `GET https://<railway-url>/health` → `{"status":"ok",...}`.
6. **Update the OAuth apps' redirect URIs** in the Deere and Bouncie developer
   consoles to the new `https://<railway-url>/auth/deere/callback` and
   `.../auth/bouncie/callback` (they must match the env vars exactly).
7. **Seed OAuth tokens once**: from the (soon) Rental Wrangler Settings → GPS, or
   directly hit `GET /auth/deere` and `GET /auth/bouncie` in a browser while authed,
   approve — tokens then persist in Postgres and auto-refresh (README runbook).
8. **Point Rental Wrangler at it**: set `GPS_BACKEND_URL` in `config.js` to
   `https://<railway-url>` (Track B, step 1). Referrer-safe public URL, like
   `BACKEND_URL`/`GOOGLE_MAPS_KEY` already are.

## Two fork-side code tweaks (do in `operations-jacrentals/wranglergps`, deploy via Railway — NOT this repo's git)

- **A3 — add `GET /api/fleet/status`** (unified cross-provider snapshot for the fleet
  pill). Additive; composes the existing per-provider status paths. Not required to
  boot — add after the service is up.
- **CORS — allow the staging origin.** `backend/server.js` CORS currently allows
  `*.vercel.app`, `*.railway.app`, `FRONTEND_URL`, `localhost:3000`. The Rental
  Wrangler **staging mirror** is served from `https://operations-jacrentals.github.io`
  — add that origin (or make `FRONTEND_URL` a comma-list and include it) or the
  Staging E2E will fail CORS. `app.jacrentals.com` is already covered via `FRONTEND_URL`.

## Verify ownership before cutover
- Confirm `DEERE_ORG_ID=521951` is JacRentals' org (carried over from source README).
- Confirm each provider credential is the JacRentals account, not the friend's.
- This is an irreversible-ish prod op — treat cutover like the `/clasp` STOP gate:
  confirm before pointing the live app at it.
