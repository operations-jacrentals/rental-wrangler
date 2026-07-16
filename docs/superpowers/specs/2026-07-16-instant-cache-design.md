# Instant Cache — on-device data cache for fast signed-in open

**Status:** approved design (Jac, 2026-07-16) · pre-implementation
**Branch (build):** cut a fresh `claude/instant-cache` off `trunk` at build time
(separate from PR #650)
**Relationship to #650:** builds ON TOP of the boot splash + parallel-resume fix.
That PR made the wait *legible* and *shorter*; this makes it *disappear* on a
trusted device by painting real data before the backend answers.

## Problem

On a signed-in open, the app shows nothing usable until the Google Apps Script
backend returns the full dataset. PR #650 paints a "Saddling up…" splash and fires
`authResume` + `load` in parallel, but the operator still stares at a splash for a
cold-container round-trip (GAS cold start ≈ 1–5 s). The data to fill the screen was
already on the device from the last session — we just throw it away every open.

## Goal

On a **trusted/personal device**, paint the **last known-good data instantly** on
open, run the normal backend load in parallel, and swap in the authoritative data
the moment it lands. Cut perceived open time from "cold round-trip" to "near-zero"
without widening the data-corruption or PII surface.

## Non-goals (YAGNI)

- **No offline editing / write buffer / conflict resolution.** The cache is
  display-only. (This was the rejected "Option B" — it re-opens the corruption
  surface the app deliberately closed.)
- **No eviction engine.** The cache is a single record that is overwritten each
  load, not a growing store — nothing to evict.
- **No encryption-at-rest.** The decryption key would have to live on the same
  device, so it's theater. The device-trust gate (below) is the real control.
- **No caching on shared computers** or the plain-password path.

## Prior incidents this design is shaped by

Three documented failures define the guardrails; the design closes each **by
construction**, not by vigilance:

1. **localStorage quota silently vanished the Mr. Wrangler chat rail**
   (`2026-06-20-wrangler-chat-storage-design.md`): a `QuotaExceededError` was
   swallowed by a silent `catch`; history disappeared. → We use **IndexedDB**
   (gigabytes, not localStorage's ~5 MB) via the existing `wrStore`-style wrapper
   that **rejects loudly**. A cache-write failure is logged and non-fatal — it
   never breaks the app and never fails silently.
2. **A bad saved customization bricked the screen** → hence `applySettings`
   self-heals (wipe → shipped defaults) and the `#reset-settings` / `#safe-mode`
   recovery hatch exists. → Our cache **discards on any doubt** (schema / app-version
   / identity mismatch, parse error, unexpected shape) and the recovery hatch is
   extended to wipe it.
3. **Auto-seed-on-empty once overwrote real data on a transient blip** → now
   disabled in `applyLoadResponse`. → Our cache is **never a save baseline**; the
   backend remains the sole source of truth for every write.

## The load-bearing invariant

> **The cache is a photograph of a confirmed backend state — never a source of
> edits.** It is written only *after* a successful `load`, only *from* that load's
> payload. `snapshotSaved()` / `computeChanges()` continue to baseline off the
> **backend** `load` response exclusively. Therefore a stale or corrupt cache can
> change what the operator briefly *sees*, but can **never** change what is
> *written back* to the Sheet.

Everything else is in service of that sentence.

## Scope of the cache

- **Device gate:** cache is read/written **only** when the device is the trusted
  "My phone" type — the persistent 30-day `jactec.pidToken` in `localStorage`
  (`pidTokenGet()` reading the *localStorage* token, not the sessionStorage one).
  A **shared computer** (sessionStorage token, PIN each session) and the plain
  shared-password path (`jactec.pw` in sessionStorage) **never** touch the cache —
  their boot is exactly today's behavior.
- **What's cached:** the `load` response payload that fills the first paint — the
  `PERSIST_KEYS` data arrays plus the `settings` object — as **one** record.
  (Settings already persist to localStorage and apply pre-render; caching them in
  the same envelope keeps the first paint internally consistent.)
- **Not cached:** anything with its own store/load already (the Mr. Wrangler rail
  in `wrStore`, group order, trips, chats). Those keep their current paths; a later
  phase may fold them in, out of scope here.

## Architecture — one new tiny module

A dedicated `dataCache` object modeled line-for-line on `wrStore`
(`app.js` ~§18b): its **own** IndexedDB database `jactec.datacache`, its own
version, a thin promise wrapper, **rejects loudly, no silent catch**.

Rationale for a separate DB (not the `jactec.wrangler` DB): this is a single
overwritten snapshot with none of the wrangler store's budget/eviction/blob
lifecycle. Keeping them apart avoids entangling two different lifecycles and keeps
each wrapper trivial.

One object store, one fixed key (`'snapshot'`), holding an **envelope**:

```js
{
  cacheVer:  CACHE_SCHEMA_VER,   // hand-bumped constant; the anti-stale guard
  appVer:    <this build's ?v= token>,   // see "appVer source" below
  tokenTag:  <same-device equality tag>, // see "identity match" below
  savedAt:   <ms epoch>,
  payload: {
    data:     { ...PERSIST_KEYS arrays },   // what applyLoadResponse applies
    settings: { ... } | null,
  }
}
```

**appVer source:** read at boot from the `app.js` `<script>` tag's `?v=` query in
the DOM (`document.querySelector('script[src*="app.js"]')`). That token is already
bumped on every deploy (`index.html` cache-bust), so a snapshot written by an older
build never matches the running build — the "don't corrupt future updates" guard,
with a source that already exists.

**identity match (`tokenTag`):** the snapshot must belong to whoever is signing in
on *this* device. We cannot compare a `personId` at read time — the person's
identity isn't known until `authResume` resolves, which is *after* we paint. So the
envelope instead carries `tokenTag` = a short **non-reversible** hash of the trusted
`jactec.pidToken` that wrote it (the raw token is **never** stored; this is a
same-device equality tag, not a security control — the token itself already sits in
localStorage on this device). On read we recompute the tag from the *current*
localStorage token and require a match. A different person's personal login on the
same device carries a different token → different tag → the old snapshot is never
painted, with no dependency on `authResume` having resolved yet.

### Store surface (mirrors `wrStore`)

```
dataCache.read()          → envelope | null      (readonly get 'snapshot')
dataCache.write(envelope) → Promise (tx commit)  (readwrite put)
dataCache.wipe()          → Promise              (clear the store)
```

`CACHE_SCHEMA_VER` is a constant in `app.js`, bumped **in the same commit** as any
change to the shape of `PERSIST_KEYS` data or the settings the payload carries.

## Boot flow (trusted/personal device)

Extends `phoneBoot()` (which #650 already made fire `authResume` + `load` in
parallel). Order:

```
open ─▶ dataCache.read()  (async, ~ms — no network)
          │
   valid? ├─ YES ─▶ applyLoadResponse(cache.payload) → buildIndexes → render REAL app NOW
          │          + a subtle non-blocking "refreshing" cue
          │                       ╲
          │   (already in flight from #650:) authResume(token)  +  load
          │                       ╱
          │   load resolves   ─▶ applyLoadResponse(backend) → re-render → dataCache.write(fresh)
          │   resume REJECTS  ─▶ dataCache.wipe() → pidTokenClear() → phone login
          │
          └─ NO / invalid ─▶ renderBootSplash()  (the #650 path, unchanged)
```

**"valid?" =** envelope parses **and** `cacheVer === CACHE_SCHEMA_VER` **and**
`appVer === thisBuild` **and** `tokenTag === tag(current pidToken)`. Any failure →
treat as no cache (and wipe the bad record).

### Auth ordering note (deliberate)

We paint cached data **before** `authResume` confirms the token is still valid.
This is safe and intentional:

- The device already passed the personal-trust gate and the data is **already at
  rest on this device** — painting it reveals nothing new to whoever holds the
  phone.
- If `authResume` then **rejects** (token expired/revoked), we **wipe the cache**,
  clear the token, and drop to the phone login — the stale view is torn down and no
  write ever happened against it (writes are gated on a live `backendPassword`,
  which a rejected resume never sets).
- Net auth outcome is identical to #650's parallel path; we've only moved the
  *paint* earlier.

## The staleness cue (UI — runs through `jactec-ui`)

While cached data is showing and the backend `load` is in flight, a small,
**non-blocking** "refreshing…" indicator reuses the existing `signing-in`
hazard-stripe/barber-pole treatment (no new tokens/CSS; themed for dark + light +
ranch; frozen under `prefers-reduced-motion`). The app is **fully interactive**
from cache the whole time — this is a cue, not a gate. Cleared the instant fresh
data lands. Stamped with a `data-r` rule per the R-rulebook (new micro-indicator →
new `RULE_META` row + `rule-usage.js` regen if it introduces a lint-family element;
if it's a plain non-interactive status chip it rides R3b — decided at build time
through `jactec-ui`).

## Cache lifecycle — write & wipe triggers

**Write** (overwrite the single record): after every successful backend `load` on a
trusted device — in `finishLoad()` (and the phone-identity `pidEnter` chain), once
`applyLoadResponse` has applied the confirmed backend state. Non-fatal: a rejected
write is logged, never surfaced as an error, never blocks the app.

**Wipe** (clear the record) on **any** of:
- logout / `pidTokenClear()` (fold `dataCache.wipe()` into the token-clear helper so
  the two can't drift);
- `authResume` rejection at boot;
- validation mismatch at boot (schema / appVer / tokenTag / parse);
- the `#reset-settings` / `#safe-mode` recovery hatch — **extended** to nuke the
  data cache too, so the guaranteed way back also clears a poisoned snapshot;
- **any new personal login** — `pidAdopt` wipes the prior snapshot *before* writing
  the new person's, so a shared physical device never paints the previous person's
  data (this is folded into the token-set path, alongside the plain
  `pidTokenClear()` logout wipe above, so the two can't drift).

## Error handling summary

| Failure | Behavior |
|---|---|
| IndexedDB unavailable (private mode/disabled) | `read()` → null; boot falls to splash path; no cache written. App unaffected. |
| Cache read throws / bad JSON | Treated as no cache; bad record wiped; splash path. |
| `cacheVer` / `appVer` / `tokenTag` mismatch | Discard + wipe; splash path. Old-build / other-person snapshots are never painted. |
| Cache write fails (quota/tx) | Logged loudly, non-fatal; app continues; next open just uses the splash path. |
| `authResume` rejects after cache paint | Wipe cache, clear token, phone login. |

No silent `catch` anywhere. A cache problem degrades to "today's behavior," never to
a broken or corrupted app.

## Testing

**Playwright drives (headless, stubbed backend with injected latency):**
1. **Cache-hit fast paint** — pre-seed a valid snapshot + trusted token; assert the
   real grid renders *before* the stubbed `load` resolves, the refreshing cue is
   visible, then the grid updates when `load` lands and the snapshot is re-written.
2. **Schema-mismatch discard** — seed a snapshot with a stale `cacheVer`; assert it
   is NOT painted (splash path), and the bad record is wiped.
3. **App-version mismatch** — seed a snapshot with a stale `appVer`; same discard.
4. **Resume-rejection wipe** — valid snapshot painted, `authResume` → `{ok:false}`;
   assert cache wiped, token cleared, phone login shown, no writes.
5. **Shared device never writes** — sessionStorage token; assert `dataCache` store
   stays empty across a full load.
6. **Recovery hatch** — open with `#reset-settings`; assert the data cache is wiped.

**Unit (via the exposed test API):** envelope validation predicate
(valid / stale-schema / stale-app / wrong-tokenTag / malformed), device-gate
predicate.

**Standard gates:** `ci/smoke.mjs`, `ci/logic-test.mjs` (669), `gen-rule-usage
--check`, `check-window-catalog`, `gen-code-map --check`. Zero R0 lint violations;
`jactec-ui` self-critique screenshot on the refreshing cue.

## Rollout

Ships behind a `FEATURES` flag in `config.js` (`flagOn('instantCache')`) so the
whole path is a runtime toggle — flag OFF = exactly #650's behavior. Default OFF
until reviewed on staging; Jac flips it on when satisfied. Standard ship: feature
branch → `/deploy` (staging review, drive a real trusted-device reopen) → `/merge`
→ `/promote`.

## Open questions for the plan phase

- Exact home for the refreshing cue in the render pipeline (header micro-chip vs a
  corner stamp) — a `jactec-ui` call at build time.
- Whether to also stamp `savedAt` in the cue ("as of 2m ago") — nice-to-have,
  decide during build; default is a plain "refreshing…".
