# Comms performance — session follow-ups (2026-07-18)

Parked from the `claude/thread-rounding-performance` session (PRs #722, #728, #729 — all shipped
live). Two things to carry forward: one actionable infra follow-up, and durable gotchas to fold
into `MEMORY.md`.

---

## A. Follow-up — teach the deck→production path to bump `?v=` automatically

**The gap.** In **deck mode** (the default staging path since #720) `deploy-staging.mjs` does **not**
bump the shared `?v=` token — the immutable `d/<id>/` folder path is the *staging* cache guarantee,
so staging never needs it. But **production** is served from the branch root at
`app.jacrentals.com/app.js?v=<token>` with `max-age=600` and no per-file hashing, and the service
worker keys its cache name on `?v=` (`rw-shell-<token>`, `sw.js`). So a deck ship that goes all the
way to production under an **unchanged** token means:
- the CDN keeps serving the cached old `app.js?v=<same token>` for up to ~10 min, and
- the installed PWA's service worker never rolls its cache (same `sw.js?v=` URL → no SW update),

…so the promoted code doesn't actually reach devices cleanly. This bit **both** #722 and #728
(both shipped under `20260718f`), and #729 was a manual `index.html` `?v=` bump to force delivery.

**Why `promote.mjs`'s own check didn't catch it.** `promote.mjs` verifies "live serves `?v=<trunk
token>`" — but when the token never changed, that check is trivially true and does **not** confirm
the *new bytes* are served. The content-hash freshness check is against the **staging deck folder**
(which has the new bytes), not production.

**Proposed fix (pick one seam):**
1. **`promote.mjs` bumps `?v=` as part of a production-bound promote** — but promote is
   fast-forward-only (it moves a pointer, doesn't commit file changes), so this would need a
   commit on trunk first, which fights branch protection. Awkward.
2. **`deploy-staging.mjs` bumps `?v=` even in deck mode when the deploy is destined for a
   production ship** — e.g. a `--for-promote` / `--bump` flag the `/merge`/`/live` flow passes, so
   the bumped `index.html` rides the feature branch → trunk → production naturally. Cleaner: the
   bump lands as a normal committed file change through the gates.
3. **A tiny pre-merge step in `/merge` (or `/live`)** that bumps the three `index.html` `?v=` refs
   on the feature branch when any served file (`app.js`/`style.css`/`rule-usage.js`) changed and
   the branch is headed for production. This is what a human does today; automate it.

Option 2 or 3 is preferred — keep the bump a committed, gate-visible file change, not a
promote-time mutation. Whichever seam: the invariant to enforce is **"a production ship that
changes a served, `?v=`-versioned file MUST change `?v=`."** A CI guard could even assert it
(a promote whose served-file hash differs from production's but whose `?v=` matches → fail).

**Note:** the token is now being bumped **manually** by sessions (it reached `20260718h` the same
day), so this is a papercut, not a fire — but it's a silent-stale-delivery trap worth closing.

---

## B. Gotchas to fold into `MEMORY.md`

### Gotchas section
- **A prefetch that `render()`s on every completion causes a summon render-storm (2026-07-18, PRs
  #722→#728).** The comms instant-open prefetch warmed up to 12 customer threads on summon, and
  `commsFetchMsgs` called a full `render()` (a whole `#app` `replaceChildren` rebuild) on **each**
  `messagesFor` completion → ~12 rebuilds in a burst → the phone froze/janked on first open until
  the burst drained (fine afterward, because cached). Fix pattern: **background warms must be
  silent.** `commsFetchMsgs` took a `{ quiet: true }` opt; the prefetch pump + hover-preload pass it
  and don't render; only a thread that is **currently on screen** repaints when its bodies land
  (`renderOnDone` set by displayed callers + a completion-time `commsThreadOnScreen(id)` check so a
  quiet warm landing on the OPEN thread still repaints). Lesson: when you fan out N background
  fetches that each end in `render()`, gate the render on visibility, or you trade first-open
  latency for a jank storm — worst on phones (big DOM) and on first access (nothing cached).
- **In a cloud session a headless browser cannot egress the agent proxy (2026-07-18).** `curl`
  gets transparent routing and reaches the internet fine, but a launched Chromium (Playwright,
  pre-installed at `/opt/pw-browsers`) gets `net::ERR_CONNECTION_RESET` on **every** external URL
  (even `example.com`), with or without `--proxy-server=$HTTPS_PROXY` / `--no-sandbox`, and the
  proxy port moves per turn. So a Playwright-driven **staging review of a live URL can't be done
  from a cloud session** — rely on CI `smoke` (boots the exact code headless) + curl-verified
  bytes + a fresh-context code review, and hand the real click-through to Jac. (Local-`localhost`
  Playwright — what `ci/smoke.mjs` does — is unaffected; it's only external egress that resets.)
- **Staging phone-identity login blocks an automated drive (2026-07-18).** `FEATURES.phoneIdentity`
  is ON, so the live/staging login is per-person **SMS-code / PIN** — there is no password field.
  A shared team password (the old flag-off `renderLogin` path) does **not** unlock it, and a fresh
  automated browser has no trusted device/PIN. Automating a signed-in staging drive would need an
  SMS-code relay through Jac's phone. (And never add a "secret" password backdoor to the shipped
  client — it's public via Pages, so it's neither secret nor safe; declined this session.)
- **Deck mode never bumps `?v=` → production ships can serve stale (2026-07-18).** See section A
  above. Cross-reference from the `/deploy`/`/promote` gotchas.

### Open threads section
- **Auto-bump `?v=` on production-bound deck deploys (2026-07-18).** Parked follow-up + proposal:
  `docs/superpowers/notes/2026-07-18-comms-perf-followups.md` §A. Deck mode's skipped `?v=` bump
  means a production promote can serve stale CDN/service-worker bytes; today it's bumped by hand
  (needed a manual #729). Teach `deploy-staging`/`/merge`/`/live` to bump it for a production-bound
  ship. Papercut, not urgent.
