# Implementation Plan — Instant Cache (fast signed-in open)

Spec: `docs/superpowers/specs/2026-07-16-instant-cache-design.md`
Branch: `claude/instant-cache` (off `trunk`) → `/deploy` → `/merge` → `/promote`
Depends on: PR #650 (splash + parallel resume) being on `trunk` — Phase 2 extends
`phoneBoot()`'s parallel resume. If #650 hasn't merged when we reach Phase 2, rebase
this branch on the #650 branch first (note it, don't duplicate #650's changes).

Gates after every code phase (port 8000 reserved → swap to 9147, then restore):
```
sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs
node ci/smoke.mjs && node ci/logic-test.mjs && node ci/gen-rule-usage.mjs --check \
  && node ci/check-window-catalog.mjs && node tools/gen-code-map.mjs --check
git checkout -- ci/
```
Every UI phase runs through `jactec-ui` (screenshot + self-critique before Jac sees it).
**Auth-touch caution:** Phase 2 sits in the resume/auth path — it must not weaken the
gate (writes stay gated on a live `backendPassword`; a rejected resume wipes + bounces
to login). Flag that explicitly in the Phase 2 commit + PR body.

---

## Phase 0 — Feature flag + the `dataCache` module (no behavior change)

- `config.js`: add `instantCache: false` to `FEATURES` (default OFF = exactly #650's
  behavior; whole path is a runtime toggle).
- `app.js`, beside the `wrStore` block (§18b): add the **`dataCache`** module — its
  own IndexedDB DB `jactec.datacache` (version 1, one store `snapshot`), mirroring
  `wrDbOpen`/`wrTx`/`wrStore`: `read()` (get the single `'snapshot'` key), `write(env)`
  (put), `wipe()` (clear). **Rejects loudly, no silent catch**; `read()` resolves
  `null` when IndexedDB is unavailable.
- Add the helpers + the anti-stale guards:
  - `CACHE_SCHEMA_VER` constant (hand-bumped with any `PERSIST_KEYS`/settings shape
    change — call this out in its comment).
  - `cacheAppVer()` — read this build's `?v=` off the `app.js` script tag
    (`document.querySelector('script[src*="app.js"]')`).
  - `cacheTokenTag(tok)` — a short **non-reversible** hash of the token (cheap string
    hash; raw token never stored; same-device equality tag, not a security control).
  - `cacheValid(env)` — parses ∧ `cacheVer` ∧ `appVer` ∧ `tokenTag` all match.
  - `cacheDeviceOk()` — `flagOn('instantCache')` ∧ a **personal** token in
    *localStorage* (`localStorage.getItem('jactec.pidToken')`, not sessionStorage).
- Expose `dataCache` + `cacheValid` + `cacheDeviceOk` + `cacheTokenTag` on the test
  API (`exposeTestApi`) for unit coverage.
- **No boot wiring yet** — pure addition; flag OFF; zero behavior change.
- **Verify:** unit (via test API) — `cacheValid` over valid / stale-schema /
  stale-app / wrong-tokenTag / malformed; `cacheDeviceOk` personal-vs-shared. Gates
  green.
- **Commit:** "Instant cache phase 0: dataCache IndexedDB module + FEATURES flag (dark, no wiring)".

## Phase 1 — Write the snapshot after a confirmed backend load

- In `finishLoad()` (runs after `applyLoadResponse(backend)` for every login path):
  if `cacheDeviceOk()`, build the envelope from the **just-applied backend state**
  (`PERSIST_KEYS` arrays from `DATA` + `state.settings`, `cacheVer`, `cacheAppVer()`,
  `cacheTokenTag(backendPassword)`, `savedAt`) and `dataCache.write(env)`. **Non-fatal**
  — a rejected write is logged, never toasted-as-error, never blocks. (Cache the
  photograph of the confirmed state — never from local edits.)
- Wipe wiring (fold in so it can't drift):
  - `pidTokenClear()` (logout) → also `dataCache.wipe()`.
  - `pidAdopt()` → `dataCache.wipe()` **before** adopting a new person's token (a new
    personal login never paints the previous person's data).
  - `boot()` recovery hatch (`#reset-settings` / `#safe-mode`) → also
    `dataCache.wipe()` so the guaranteed way back clears a poisoned snapshot.
- **Verify:** Playwright — after a personal-token load the snapshot exists and matches;
  logout wipes it; a second personal login wipes-then-rewrites; a **shared** (session)
  token writes nothing. Gates green.
- **Commit:** "Instant cache phase 1: write the snapshot after a confirmed load + wipe triggers".

## Phase 2 — Paint from cache on boot (the payoff)

- New `paintFromCache(env)`: `applyLoadResponse(env.payload)` → `buildIndexes()` →
  `state.cascade = createCascade(DATA)` → `render()` the **real app** now. **Critical
  invariant:** it does **NOT** call `snapshotSaved()` and leaves `booting = true`, so
  the save baseline is only ever set by the real `finishLoad(backend)` — a stale cache
  can never become a save baseline.
- `phoneBoot()` (personal path), extending #650's parallel resume:
  1. `dataCache.read()`; if `cacheValid`, `paintFromCache(env)` + turn the refreshing
     cue on (Phase 3). Else → `renderBootSplash()` (the #650 path, unchanged).
  2. `authResume(token)` + `load` already in flight (parallel, from #650).
  3. `load` resolves → the normal `finishLoad(backend)` runs: `applyLoadResponse` +
     `snapshotSaved()` (baseline off backend) + `booting = false` + re-render →
     `dataCache.write(fresh)` (Phase 1 path) → cue off.
  4. `authResume` rejects → `dataCache.wipe()` → `pidTokenClear()` → phone login.
- **Edit-in-window edge (decision):** while the cache is up and the backend load is in
  flight, `booting = true` keeps `saveSoon()` a no-op, so **nothing corrupts** — the
  backend `load` then replaces `DATA`. An edit made in that sub-second window would be
  superseded (not persisted, not corrupting). Recommend a light `state.hydrating` guard
  that no-ops the mutation entry points until fresh data lands (the cue explains why),
  eliminating the surprise entirely. Final toggle decided at build with `jactec-ui`;
  default to shipping the guard.
- **Verify:** Playwright (spec tests 1–5) — cache-hit real grid renders *before* the
  stubbed `load` resolves; schema-mismatch + appVer-mismatch discard (splash path, bad
  record wiped); resume-rejection wipe → login; shared device never paints/writes;
  assert **no save fires off cached state** (spy `computeChanges`/backend `sync`). Gates
  green.
- **Commit:** "Instant cache phase 2: paint last snapshot instantly on a trusted reopen (auth-path — gate unchanged)".

## Phase 3 — The "refreshing" cue (UI · `jactec-ui`)

- Small, **non-blocking** indicator reusing the `signing-in` hazard-stripe/barber-pole
  treatment (no new tokens/CSS; themed dark + light + ranch; frozen under
  `prefers-reduced-motion`). Shown while cached data is up and the backend load is in
  flight; cleared the instant fresh data lands.
- `data-r` stamp: if it introduces a lint-family element, add a `RULE_META` row +
  `node ci/gen-rule-usage.mjs`; if it's a plain non-interactive status chip it rides
  R3b (decide in `jactec-ui`). Placement (header micro-chip vs corner stamp) is a
  `jactec-ui` call; optional `savedAt` "as of 2m ago" is a nice-to-have (default plain
  "refreshing…").
- **Verify:** cue visible across the load window, gone after; screenshot self-critique
  vs the data-plate language; light/dark/ranch parity; reduced-motion steady state;
  gates green + zero R0 lint.
- **Commit:** "Instant cache phase 3: non-blocking refreshing cue over cached data".

## Phase 4 — The shared-device login video (spec: "The shared-device wait")

- `renderPhoneLogin()`: add the `<video id="login-video" class="login-video"
  src="assets/login-intro.mp4?v=…" muted loop playsinline preload="auto"
  aria-hidden="true">` element + the mute toggle, mirroring `renderLogin` and adapted
  to the phone-login layout (placement through `jactec-ui`).
- `pidEnter()` (already adds `.signing-in`): play the video + honor `state.loginMuted`,
  mirroring the `attemptLogin` video-play wiring.
- No new CSS — existing `.login-video` / `.signing-in .login-video` /
  `prefers-reduced-motion → display:none` rules already cover it.
- **Verify:** Playwright (spec test 7) — video present on the phone login, plays on
  `.signing-in`, honors `state.loginMuted`, hidden under emulated reduced-motion;
  desktop + phone screenshots; gates green.
- **Commit:** "Instant cache phase 4: play the intro video during the shared-device (PIN) login wait".

## Phase 5 — Staging review, flag-on, handoff

- Full gate set green. `/deploy` to staging.
- **Drive the running staging app** (Claude-in-Chrome, not unit tests alone),
  `instantCache` flag ON on staging:
  - Personal login → reload → **instant paint + refreshing cue**, then data refreshes;
    make an edit → confirm it round-trips and persists (baseline off backend, not
    cache).
  - Shared (PIN) login → **intro video during the wait**, and confirm the
    `jactec.datacache` store stays **empty** (no PII at rest).
  - `#reset-settings` → confirm the data cache is wiped.
  - Screenshot each for the handoff.
- Flip `FEATURES.instantCache` → `true` in `config.js` **on Jac's say-so** (its own
  small commit; cache-bust `?v=`).
- `MEMORY.md`: short note under Decisions (instant cache shipped; display-only,
  personal-devices-only, backend sole write source). Handoff note in the session
  folder.
- **Ship:** `/merge` (Gate 1 → `trunk`) → wait → `/promote` (Gate 2 → live) — both
  Jac's explicit call.

---

## Risks / notes

- **The one invariant that must never break:** the cache is never a save baseline
  (`paintFromCache` leaves `booting = true` + skips `snapshotSaved`). Phase 2's test
  asserting "no save off cached state" is the guard — do not let it regress.
- **Auth path:** Phase 2 touches resume; keep the gate server-side, writes gated on a
  live `backendPassword`, rejected resume → wipe + login. Called out in the PR body.
- **PII:** personal devices only; shared never caches; wipe on logout / new login /
  recovery hatch. No plaintext PII at rest on a shared machine — verified in Phase 5.
- **Storage:** one overwritten ~1.7 MB record in IndexedDB (gigabytes) — no growth, no
  eviction engine; a write failure degrades to the splash path, never breaks the app.
