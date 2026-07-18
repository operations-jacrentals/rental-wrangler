---
name: run-live
description: >-
  Run and DRIVE the Rental Wrangler app in a real browser — to SEE a change actually working,
  screenshot a card / flow, or test-drive behavior end to end, not just eyeball the code or trust
  a unit test. It OPENS by telling Jac which SEAT to use — a local machine session or a cloud
  session — for what he's about to do, then drives with REAL data in either seat (locally the app
  reaches the backend natively; in a cloud session a Node-fetch page.route shim relays the backend
  calls, so real records work there too), or the `#local` demo-seed mode when real data isn't
  needed. Reach for this WHENEVER Jac wants to run, drive, open, preview, or screenshot the app or
  one of its cards/flows, OR asks whether to use a local vs cloud session for a drive/audit —
  phrasings like "run the app", "drive it", "show me the Rentals card", "screenshot this flow",
  "let me see it working", "does it actually render", "test-drive this change", "should I run this
  local or in the cloud", or an explicit /run-live. NOT the CI boot gate (ci/smoke.mjs) and NOT a
  staging deploy (/deploy) — this is an interactive drive of the running app.
---

# /run-live — drive the running app in a real browser

See the app actually run, on real data where it matters. Three capabilities make this work in any
seat — the `#local` demo mode, the `Ctrl+Alt+P` dev login, and a **Node-fetch relay shim** that
gets real backend data into a cloud session's headless browser (which otherwise can't reach the
backend). The first thing this skill does is **tell Jac which seat to be in** — don't skip it.

## Step 0 — Which seat? Tell Jac this BEFORE any work starts

Detect the session, then state a clear recommendation + the setup for it. Present it to Jac; don't
silently pick a mode. This is the part Jac asked to always see up front.

```
echo $CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE      # cloud_default = CLOUD · blank/other = LOCAL
```

Give Jac the row that matches what he's about to do:

| What you're doing | Best seat | Why | Setup before you start |
|---|---|---|---|
| **"Click through PRODUCTION live"** (the most faithful audit) | **LOCAL + your own browser** | You drive the real production app — real data, real browser, real everything. Nothing else matches it. | `git pull` (to get these skills), then open **app.jacrentals.com** (already signed in on your phone number) and drive it by hand or via **Claude-in-Chrome**. No serve, no dev-login. |
| **Automated / repeatable real-data drive** (headless, screenshots, assertions) | **CLOUD session** | Cloud has working headless Playwright *and* the relay shim reaches real records. Local desktops often can't install Playwright. | Nothing — the cloud env already has `RW_PW` and provisions Playwright. |
| **UI / layout / states / a quick screenshot** — no real data needed | **Either — `#local` demo** | Seed data, no login, no backend, **no PII**. | Nothing. |
| **Keep real customer data OUT of any Claude session** | **LOCAL + your own browser** | The data stays in your browser and never enters a Claude session. | `git pull`; drive production yourself. |

Then say whether the **current** session matches: if it does, proceed; if not, tell Jac to switch
seats (and exactly how) before continuing. Rule of thumb: **want the truest look at production →
local + your browser; want Claude to drive it hands-off with real data → cloud (the shim covers
you).**

## Step 1 — Shared setup (once)

```
npm i --no-save playwright@1.61.1                    # browsers pre-provisioned — never `playwright install`
node .claude/skills/run-live/scripts/serve.mjs &     # serves the repo root on :9147 (background)
```

(8000 is the reserved CI port — this server uses **9147**.)

## Step 2 — Drive it (pick the mode; `drive.mjs` handles both)

**Real data — works in LOCAL *and* CLOUD** (`RW_REAL=1`):

```
RW_SHOT=/tmp/real.png RW_REAL=1 node .claude/skills/run-live/scripts/drive.mjs
```

Loads `localhost:9147/`, presses `Ctrl+Alt+P`, signs in with `RW_PW`, and a **`page.route` shim
relays every `script.google.com` call through Node** — so the headless browser gets real records
even in cloud, where its own fetches to the backend are blocked (Node's aren't). Reports
`{ signedIn, cards, relayed, stubbed }`. **Read-only by default** — write actions (`sync`, charges,
sends, uploads) are stubbed `{ok:true}` so a drive-through can't mutate live data; pass `RW_WRITES=1`
only if you deliberately want writes to hit the real backend. Needs `RW_PW` in the env (it stops if
missing — never invent one).

**Demo — anywhere, no PII** (default):

```
RW_SHOT=/tmp/demo.png node .claude/skills/run-live/scripts/drive.mjs      # loads /#local
```

`#local` boots from the `data.js` seed — a fully populated yard, no login, no backend — and exposes
a test API (`window.__rw`). Right for UI / layout / states / screenshots. Say plainly it's **seed
data, not real records**.

**Most faithful (local, human present):** skip the driver — open **app.jacrentals.com** in the real
browser (or Claude-in-Chrome) where Jac's already signed in, and drive production directly.

## Step 3 — Exercise the actual thing, then report

Don't stop at "it rendered." Drive the *specific* flow — open the card, click the pill, take the
action — and assert the visible result. `drive.mjs` is a template: add `page.click(...)`, a second
after-state screenshot, or read `window.__rw` in demo mode. `SendUserFile` the screenshot, and say
which seat + mode ran (**real vs demo**) and what you verified.

**PII rule:** a real-data run pulls live customer records into the session. Screenshot them *to
Jac* if useful, but **never** put a real record into a committed file, a report, or a shareable
artifact — use demo data for anything that persists or ships.

## The gotchas this skill exists to encode

- **Port 9147, not 8000** — 8000 is the reserved CI smoke port.
- **Use the `headless_shell` Chromium** (`/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`);
  the full `chrome` errors *"Old Headless mode has been removed"*.
- **`waitUntil: 'domcontentloaded'`, never `'load'`** — the login intro `<video preload>` never fires `load`.
- **Playwright is CJS under ESM import** — `chromium` is on `.default`.
- **The cloud backend wall is browser-only.** Headless Chromium can't reach `script.google.com`
  (`ERR_CONNECTION_RESET`, *even through `$HTTPS_PROXY`*) — but **Node `fetch` from the shell
  reaches it fine.** That's exactly why the relay shim works: the browser's blocked call is
  fulfilled by a Node fetch that isn't. (Don't retry the browser through the proxy — it won't work.)
- **Harmless noise** — `ERR_CONNECTION_RESET` / `404` for external fonts/maps/GPS is expected; the
  app degrades gracefully. In a cloud real-data run, GPS/Maps still won't render (different hosts,
  not shimmed) — the GAS *data* does.
- **Never hardcode `RW_PW`** — it gates real PII and this repo is public. Read it from the env; if
  missing, ask Jac.
- **Clean up** — stop the background server when done (it holds :9147, which the CI gates also want).
