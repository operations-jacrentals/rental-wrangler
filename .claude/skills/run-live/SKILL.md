---
name: run-live
description: >-
  Run and DRIVE the Rental Wrangler app in a real (headless) browser — to SEE a change actually
  working, screenshot a card / flow, or test-drive behavior end to end, not just eyeball the code
  or trust a unit test. It ALWAYS checks local-vs-cloud FIRST and PREFERS a real-backend run (live
  data via the Ctrl+Alt+P dev login) because a backend-included run is far more valuable; it falls
  back to the `#local` demo-seed mode (which works even in a cloud session) only when the backend
  can't be reached. Reach for this WHENEVER Jac wants to run, drive, open, preview, or screenshot
  the app or one of its cards/flows — phrasings like "run the app", "drive it", "show me the
  Rentals card", "screenshot the app / this flow", "let me see it working", "does it actually
  render / behave", "test-drive this change", or an explicit /run-live. NOT the CI boot gate
  (that's ci/smoke.mjs) and NOT a staging deploy (that's /deploy) — this is a local, interactive
  drive of the running app in a browser Claude controls.
---

# /run-live — drive the running app in a real browser

The point is to **see the app actually run**, not to read code or trust a green test. Two things
make that possible here — the `#local` demo mode and the `Ctrl+Alt+P` dev login — and one thing
constrains it: **a cloud session's headless browser can't reach the live backend** (the agent
proxy blocks `script.google.com`, the same wall that blocks `github.io`). So the *first* decision
is always **where am I running**, because it decides whether the valuable real-data run is even
on the table.

## Step 1 — Check local vs cloud FIRST (this decides everything)

```
echo $CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE
```

- **blank / not `cloud_default` → LOCAL session.** The backend is reachable → **do the real-data
  run** (Step 2A). This is the prize: the actual live records, the real money engine, the true
  state.
- **`cloud_default` → CLOUD session.** Headless Chromium can't reach the backend from here →
  the real-data run will fail at `load`/`auth`. Go to Step 2B (demo), and if Jac specifically
  needs *real* data, route it to a local session or his connected Claude-in-Chrome instead of
  faking it.

Everything else (install, serve) is shared. Do it once:

```
npm i --no-save playwright@1.61.1          # browsers are pre-provisioned — never `playwright install`
node .claude/skills/run-live/scripts/serve.mjs &   # serves the repo root on :9147 (background)
```

(8000 is the reserved CI port — this server uses **9147**.)

## Step 2A — LOCAL: the real-data run (preferred)

The `Ctrl+Alt+P` dev login reveals the team-password plate on `localhost` even under the SMS
`phoneIdentity` flow, so Claude can sign in without a phone. The password is **typed at runtime
from the `RW_PW` env var — never hardcoded**.

```
[ -n "$RW_PW" ] && echo "RW_PW set" || echo "RW_PW MISSING — set it or have Jac type it"
RW_REAL=1 RW_SHOT=/tmp/real.png node .claude/skills/run-live/scripts/drive.mjs
```

`drive.mjs` (with `RW_REAL=1`) loads `http://localhost:9147/`, dispatches `Ctrl+Alt+P`, fills the
operator name + `RW_PW`, signs in against the **live backend**, then screenshots and reports
`{ signedIn, cards, ... }`. If `RW_PW` isn't set, it stops and says so (don't invent one). A
`signedIn:false` with the backend hint means you're not actually local-with-internet — fall back
to demo.

## Step 2B — CLOUD (or backend unreachable): the demo run

`#local` boots the app straight from the `data.js` seed — a fully populated yard, **no login, no
backend** — and exposes a test API (`window.__rw`, from `exposeTestApi()`). It renders identically
to production and works anywhere, so it's the right call for driving UI, layout, a card's states,
or a screenshot when real data isn't required.

```
RW_SHOT=/tmp/demo.png node .claude/skills/run-live/scripts/drive.mjs      # loads /#local
```

Reports `{ populated, cards, ... }`. Be honest in the write-up that this is **seed data, not real
records** — never present a demo screenshot as the live yard.

## Step 3 — Exercise the actual thing, then report

Don't stop at "it rendered." Drive the *specific* flow the task is about — open the card you
changed, click the pill, take the action — and assert the visible result. Adapt `drive.mjs`
(it's a template): add `page.click(...)`, `page.fill(...)`, a second screenshot of the after-state,
or read `window.__rw` for a programmatic check in demo mode. Save a screenshot and send it with
`SendUserFile` so Jac sees it, and say plainly which mode ran (real vs demo) and what you verified.

## The gotchas this skill exists to encode

- **Port 9147, not 8000** — 8000 is the reserved CI smoke port.
- **Use the `headless_shell` Chromium** (`/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`).
  The full `chrome` binary errors *"Old Headless mode has been removed"*.
- **`waitUntil: 'domcontentloaded'`, never `'load'`** — the login screen's intro `<video preload="auto">`
  never fires `load`, so a `load` wait times out. Then `waitForSelector` for the login or `[data-card]`.
- **Playwright is CJS under ESM import** — `chromium` is on `.default` (`pw.chromium || pw.default.chromium`).
- **The cloud backend wall is real** — don't fight it. In cloud, headless fetches to
  `script.google.com` fail (`ERR_CONNECTION_RESET` / `Failed to fetch`), *even routed through
  `$HTTPS_PROXY`*. `#local` sidesteps it entirely; the real run just needs a local machine.
- **Harmless noise** — in `#local` you'll see `ERR_CONNECTION_RESET` / `404` console errors for
  external fonts/maps/assets. The app renders fine; ignore them.
- **Never hardcode `RW_PW`** — it gates real customer PII and this repo is public. Type it from the
  env at runtime; if it's missing, ask Jac, don't invent one.
- **Clean up** — stop the background server when done (it holds :9147, which the CI gates also want).

## When Claude can't drive it but Jac can

If real data is required and you're in cloud, the honest paths are: (1) Jac runs `/run-live` from a
**local** Claude session, or (2) Jac drives his **connected Claude-in-Chrome** (his real browser
reaches the backend) and Claude directs the clicks. Offer these instead of pretending the cloud
headless run reached the backend.
