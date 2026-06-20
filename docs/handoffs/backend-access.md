# Backend + deploy access (for any session working this repo)

There are **two ways to ship**: the frontend (git/PR) and the Google Apps
Script backend (clasp). Read this before pushing code.

> **Secrets:** this file is intentionally secret-free and lives in the public
> repo. Never add passwords, API keys, deployment-specific tokens, or
> `DEFAULT_CONFIG` here or anywhere in the repo.

## First, verify your environment has the tooling

- `clasp --version` → expect 3.x
- `test -f ~/.clasprc.json && echo authed` → clasp must be logged in
- Backend working copy: `~/rw-backend` (`Code.js` + `appsscript.json`). If missing:
  ```sh
  mkdir -p ~/rw-backend && cd ~/rw-backend \
    && clasp clone 1hw9A7Id3YIoiSCBkNFeDaKGRv-VtljFFIuBdQG5QULrgS0DjQhQ_2vyZ
  ```

If clasp isn't installed/authed in your environment, **stop and ask** — don't guess.

## Backend facts

- It's `Code.gs` — a schema-less Google Sheets backend, **one tab per entity**,
  rows `[id, json]`.
- Apps Script project id (scriptId):
  `1hw9A7Id3YIoiSCBkNFeDaKGRv-VtljFFIuBdQG5QULrgS0DjQhQ_2vyZ`
- **PROD deployment id** (also the path in the exec URL):
  `AKfycbzHahzgJqOYe9o4GKlRVGh-A7USRn1k4Dvyy4ajLh8EYCqVxofouM28qs8trNlObZw`
- Live exec URL: `https://script.google.com/macros/s/<PROD deployment id>/exec`
- API shape: POST/GET JSON `{ action, password, ... }`. `password` is a role
  password. Money actions (`stripe*`) require an **Admin/Office** role.
- `Code.gs` is **gitignored** and never served by Pages. **Never commit it.**

## Backend deploy workflow (clasp)

1. `cd ~/rw-backend && clasp pull` — always start from the **live** code.
2. Edit `Code.js`.
3. `node --check Code.js` — syntax gate.
4. `clasp push --force` — updates **HEAD only**; does **not** touch the live exec URL.
5. **Test on a throwaway deployment first:**
   ```sh
   clasp deploy -d "test"          # prints a NEW deployment id + url
   # curl-test the new /exec (see below)
   clasp undeploy <that-test-id>   # clean up
   ```
6. **Go live, keeping the SAME url:**
   ```sh
   clasp deploy -i AKfycbzHahzgJqOYe9o4GKlRVGh-A7USRn1k4Dvyy4ajLh8EYCqVxofouM28qs8trNlObZw -d "what changed"
   ```
7. **Verify** on the prod exec URL: call an existing action (e.g. `auth`) and
   confirm it still works. **Additive changes only** unless intended.

> `clasp run` is **not** available (no API-executable deployment) — use the exec URL.

## Curl test pattern

`text/plain` avoids a CORS preflight GAS can't answer; `-L` follows the GAS redirect.

```sh
curl -sS -L -H 'Content-Type: text/plain;charset=utf-8' \
  --data '{"action":"auth","password":"'"$RW_PW"'"}' "$EXEC_URL"
```

Pass the password via an env var (`RW_PW`); **never echo it or hardcode it** in a script.

## Secrets — do not leak

- Stripe key, Anthropic key, GitHub token live in **Script Properties**; role
  passwords live in Script Properties / `DEFAULT_CONFIG` inside `Code.gs`. Never
  print, commit, or paste any of them. **The repo is public via Pages.**
- The backend is **live money/ops**. Always test on a throwaway deployment before
  the prod id, and keep the **same deployment id** so the exec URL never changes.

## Frontend (the git repo) push workflow

- Branch off `main`; **never push to `main`** (branch-protected, requires the
  `smoke` CI check).
- Gates before push (port 8000 is reserved → swap to 9147, run, then restore):
  ```sh
  sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs
  node ci/smoke.mjs && node ci/logic-test.mjs && node ci/gen-rule-usage.mjs --check
  git checkout -- ci/
  ```
- Bump the shared `?v=` cache-bust token on `style.css` / `rule-usage.js` /
  `app.js` in `index.html`.
- Push the feature branch → open a **draft PR** → squash-merge once `smoke` is green.
- Never commit secrets / `DEFAULT_CONFIG` / passwords.

## Other tools

_If tools beyond clasp are set up in the environment (name, where they live, auth,
what they're for), list them here so future sessions can use them._
