---
name: clasp
description: Deploy the Google Apps Script backend via clasp (the backend ships via clasp, NOT git — it is gitignored). Use when changing or deploying backend Code.js, wiring clasp auth from the env secret, or pushing a new GAS deployment. ADDITIVE changes only; ALWAYS stops for explicit confirmation before any production deploy. Invoke with /clasp.
---

# /clasp — Deploy the Apps Script backend (via clasp, NOT git)

The Rental Wrangler backend is a Google Apps Script web app. It ships through **clasp**, never through git — `Code.gs`/`Code.js` are gitignored because the repo is **public** via GitHub Pages. This skill wires auth, pulls the live code, makes additive changes, tests on a throwaway deployment, then (only after your OK) promotes to the same prod URL.

## ⛔ Safety rails — read every time
1. **Additive changes only.** Never remove or rewrite existing actions/handlers. Add new ones alongside.
2. **STOP before prod.** After the throwaway test passes, **halt and get explicit "OK" from Jac** before the production deploy. No exceptions.
3. **Never commit `Code.gs` / `Code.js`.** They're gitignored; the repo is public. If you ever see them staged, unstage them.
4. **Never print secrets or passwords** — not `~/.clasprc.json`, not `$CLASPRC_JSON_B64`, not `$RW_PW`, not any role password. Don't echo them, don't paste them into reports.
5. **Throwaway-test before prod.** Always `clasp deploy -d "test"` → curl-test → `clasp undeploy <test-id>` before touching the live deployment.
6. **`clasp push --force` updates HEAD only** — it does NOT change the live `/exec` URL. Only `clasp deploy -i <prod-id>` goes live.

## Backend identifiers
Read the `scriptId`, prod `deployment id`, and `exec URL` from `references/backend-ids.local.md` (gitignored — never published). If that file is absent (e.g. a fresh cloud container), take them from env vars `RW_SCRIPT_ID` / `RW_PROD_DEPLOYMENT_ID` / `EXEC_URL`, or ask Jac. **Never hardcode them in this committed file.**

## Step 1 — Wire clasp auth, then VERIFY with clasp itself (never by file path)
Auth is "wired" only if **`clasp show-authorized-user` says so** — a credentials *file existing* proves nothing (clasp 3.x doesn't reliably read the old `~/.clasprc.json` default path, so `test -f` gives false readings). Write the secret to an explicit file, point clasp at it with `clasp_config_auth`, then confirm with clasp's own command:
```bash
# Cloud session: secret -> explicit auth file -> tell clasp where it is
if [ -n "$CLASPRC_JSON_B64" ]; then
  printf '%s' "$CLASPRC_JSON_B64" | base64 -d > ~/.clasprc.json && chmod 600 ~/.clasprc.json
  export clasp_config_auth="$HOME/.clasprc.json"   # v3 reads creds from here (sidesteps default-path drift)
fi
clasp --version                                    # expect 3.x
clasp show-authorized-user --json                  # THE source of truth -> {"loggedIn": true}
```
- **`loggedIn: true`** → authed; proceed.
- **`loggedIn: false`** → **stop, do not deploy.** Either `CLASPRC_JSON_B64` is empty (session started before the secret existed → ask Jac to restart it) or the secret is stale / wrong-format for v3 (re-export: `clasp login` on a trusted machine, then base64 its fresh `.clasprc.json` back into the secret). Don't guess, don't hunt for files.

**Local Windows desktop = NOT a deploy environment.** Credentials are cloud-provisioned, so a desktop has clasp but no keys (`loggedIn:false` is expected, not broken). **Don't `clasp login` here** — run `/clasp` from a **cloud session**, where the secret auto-wires auth. A local session that needs a backend deploy should route the work to a cloud session.

## Step 2 — Backend working copy
```bash
mkdir -p ~/rw-backend && cd ~/rw-backend && clasp pull \
  || clasp clone "$RW_SCRIPT_ID"
```

## Step 3 — Deploy runbook
```
a. clasp pull            — start from the LIVE code
b. edit Code.js          — ADDITIVE
c. node --check Code.js  — syntax gate
d. clasp push --force    — updates HEAD only; does NOT touch the live URL
e. THROWAWAY TEST:  clasp deploy -d "test"  →  curl-test the new /exec  →  clasp undeploy <test-id>
f. *** STOP — confirm with Jac before going to prod ***
g. GO LIVE (same URL):  clasp deploy -i "$RW_PROD_DEPLOYMENT_ID" -d "what changed"
h. VERIFY: call an existing action (e.g. auth) on the prod exec URL and confirm it still works.
```

## Curl test
`text/plain` avoids a CORS preflight GAS can't answer; `-L` follows the redirect; password via `$RW_PW`.
```bash
curl -sS -L -H 'Content-Type: text/plain;charset=utf-8' \
  --data '{"action":"auth","password":"'"$RW_PW"'"}' "$EXEC_URL"
```
No `RW_PW` set? You can only test the **auth-rejection** path — ask Jac for a role password if you need a money-action test.

## Environment
clasp (backend), GitHub, Google Drive, Gmail, Figma, HeyGen are available in the clasp-enabled **cloud** session — that's the deploy environment, and this runbook is written for it (Linux/bash). The local Windows desktop is **not** a deploy environment: it has clasp but no cloud secret, so don't `clasp login` there — run `/clasp` from a cloud session. (Auth state is always whatever `clasp show-authorized-user --json` reports — never an assumed file path.)

## Note for /start
This skill is referenced by the startup skill: at session start, if clasp is installed, `/start` checks auth with `clasp show-authorized-user --json` and **only if `loggedIn: true`** treats the backend as reachable via `/clasp` (then: don't ask how to access the backend, use clasp). If `loggedIn: false`, `/start` reports it's installed-but-not-authed and how to fix — see `/start` §1.
