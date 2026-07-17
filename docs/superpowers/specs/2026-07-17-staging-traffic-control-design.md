# Staging Traffic Control — a git-native lease + waitlist for shared staging

**Date:** 2026-07-17
**Status:** Design approved (brainstorming). Next: implementation plan (writing-plans).
**Owner:** Jac / Claude

## Problem

`tools/deploy-staging.mjs` pushes the current feature branch's site files to **one shared
staging repo** (`operations-jacrentals/rental-wrangler-staging`), served at **one GitHub
Pages URL** — the URL Jac has bookmarked on phone + desktop. The deploy is a wholesale
**wipe-and-replace** (delete every tracked file in the staging clone, copy the branch's
crawled site-file set over — see `deploy-staging.mjs` lines ~336–342).

Because staging is a single mutable environment, **the last deploy wins**. When two Claude
sessions each `/deploy` their own feature branch, whichever pushes last silently clobbers the
other's staging review. The `?v=` token can even appear to move backward (e.g. `…f` → `…a`)
because each deploy bumps the token from *its own* branch's base, not a global counter.

This already bit a real ship: session A deployed `#656` and verified staging at `?v=20260717f`;
another session then deployed a different branch (`?v=20260717a`), overwriting it; and
`promote.mjs` correctly **refused to promote** because live staging no longer matched trunk.
Nothing was corrupted — trunk/production are the source of truth and staging is disposable —
but the go-live was blocked and the contention was invisible until the promote gate caught it.

### Why "just deploy on top of each other" cannot work here

Rental Wrangler is effectively a **single-file app** (`app.js`, ~25k lines). Two sessions
almost always both edit `app.js`. Copying one branch's `app.js` "on top of" staging *replaces*
the whole file — the other feature vanishes. The only way to show **both** features in one
`app.js` is to **merge** the two versions, which is combining code (occasional conflicts, and
always an `app.js` state no CI ran and nobody promotes as-is). So per-file layering — the trick
behind multi-file deploy previews — collapses to "whose `app.js` wins." The fix must therefore
be **coordination** (take turns / isolate), not blending.

## Constraints

- **Static GitHub Pages, no server.** No daemon can hold a lock or run a queue; coordination
  must be **git-native** (sessions share only git remotes + GitHub).
- **Ephemeral, isolated sessions.** Each Claude cloud session is a fresh container with no
  knowledge of other sessions and can be **reclaimed at any time** — so any held lease MUST
  auto-expire (a dead session must never wedge staging forever).
- **Stable bookmark(s).** Jac relies on fixed staging URL(s) saved to phone + desktop. The
  design must not require opening a different dynamic URL per feature.
- **Promote safety is non-negotiable.** `promote.mjs` must keep refusing to go live unless the
  live staging bytes are the trunk bytes being promoted.

## Decisions (locked in brainstorming)

| Decision | Choice |
|---|---|
| Contention behavior | **Auto-queue → deploy when a slot frees** (register in the waitlist, poll, deploy automatically, then notify). |
| Lease release | **On `/merge`** (review window over) **+ ~30-min idle TTL** backstop. |
| Substrate | **Git-native lock branch** (a `control.json` on a dedicated non-served branch in the staging repo). |
| Parallelism model | **Counting semaphore of N slots.** Build **N=1** now (today's single staging); design pool-ready for **N=3** (Jac's "Staging 1/2/3", each permanently bookmarked) as a config + provisioning follow-up. |

## Architecture

### 1. Control substrate — `staging-control` branch + `control.json`

A dedicated **orphan branch `staging-control`** in the staging repo. It is **not** the Pages
`main` branch, so it is never served publicly and never wiped by a deploy (deploys only touch
`main`). One file:

```jsonc
{
  "version": 1,
  "ttlMinutes": 30,
  "slots": [
    {
      "id": 1,
      "url": "https://operations-jacrentals.github.io/rental-wrangler-staging/",
      "holder": null   // or { session, branch, feature, acquiredAt, renewedAt, expiresAt }
    }
    // N=3 later: slots 2 and 3 with their own URLs
  ],
  "queue": [
    // { session, branch, since, expiresAt }
  ]
}
```

- **Identity** = `process.env.CLAUDE_CODE_SESSION_ID` (confirmed present in the session env).
- **`slots` is an array from day one** so N=1 → N=3 is adding slot objects + provisioning the
  extra Pages sites, not a redesign.
- The control file is **disposable coordination state**, never real data — it can be reset from
  scratch at any time.

### 2. Lease protocol — `tools/staging-lease.mjs`

A small CLI with subcommands. All state changes are a **fetch → mutate → commit → push** to the
`staging-control` branch; the atomic primitive is **git's non-fast-forward push rejection**: if
two sessions push concurrently, exactly one succeeds and the loser re-fetches and re-evaluates.

- `acquire` — fetch control; reap expired holders and stale queue entries (see TTL). **FIFO is
  enforced:** claim a free slot only if the live `queue` is empty **or** the caller is its head
  (a session ahead in line is never jumped). Claiming = write `holder`, remove self from `queue`
  if present, push; on non-fast-forward rejection → re-fetch + retry (bounded, with small
  backoff). If no slot is free, **or** a slot is free but another session is ahead of the caller,
  → ensure the caller is in `queue`, push, and report position + ETA (soonest `holder.expiresAt`).
  Returns the acquired slot (id + url) or a "queued" result.
- `renew` — bump the caller's `holder.renewedAt`/`expiresAt` (called on deploy activity so a live
  review never times out mid-flight).
- `release` — clear the caller's `holder` from its slot; the freed slot is picked up by the
  **head of the live queue** on its next `acquire` (FIFO — see `acquire`), so releasing never
  lets a later arrival jump a session that was already waiting.
- `status` — print slots (holder, expiry) + queue; human-readable.
- `reset` / `--force` — rewrite `control.json` (or force-clear one slot) to recover from a wedged
  or corrupt state. Loud.

**TTL** = `ttlMinutes` (default 30) since last `renew`. A holder past `expiresAt` is treated as
dead and its slot is reclaimable; a queue entry past its `expiresAt` is dropped. This is what
makes a reclaimed/ crashed session safe — nothing wedges.

### 3. `deploy-staging.mjs` integration

Before the clone/push:

1. Call `acquire`.
2. **Got a slot** → deploy to *that slot's* URL (for N=1 this is today's single staging URL);
   `renew` on a successful live-bytes verify; **keep the lease** (held until `/merge` or TTL).
3. **All slots busy** → enter **auto-queue mode**: register in `queue`, then poll `acquire` on a
   timer until a slot frees or a holder TTL-expires, then deploy automatically and notify Jac.
   - **Ephemeral caveat (stated up front to Jac):** if the waiting session is reclaimed, its
     queue entry TTL-expires and Jac simply re-runs `/deploy`. There is no server to finish the
     wait.

The `?v=` bump + live-bytes verification stay exactly as today, but are **per-slot** (each slot
is an independent Pages site with its own `?v=`).

### 4. Release wiring

- **`/merge`** calls `staging-lease.mjs release` after the squash-merge to trunk succeeds (the
  feature is integrated → its staging review window is over).
- **TTL** is the backstop for a session that never reaches `/merge` (idle, crashed, reclaimed).
- **`/promote`** sweeps a `release` if the promoted feature still held a slot, and its existing
  **freshness gate is unchanged** — it just verifies the slot the feature was deployed to serves
  trunk's `?v=`.

### 5. Contention UX

- Busy `/deploy` prints, e.g.:
  `🔒 All staging slots busy — Slot 1 held by session …abcd (feature #658), frees ~14 min.
   Queued you at #1; I'll deploy the moment a slot frees and ping you.`
- Manual escapes (loud, explicit): `staging-lease.mjs release --slot N --force` to reclaim a
  wedged slot; a queue "bump" to jump the line when Jac wants priority.

## Error handling / edge cases

- **Acquire race** → non-ff push rejection → bounded retry with re-fetch; on repeated loss
  (thundering herd) back off and report rather than spin.
- **Dead holder** → TTL expiry frees the slot; next `acquire` reclaims it.
- **Dead queued session** → its queue entry TTL-expires and is skipped when a slot frees.
- **Corrupt / diverged control branch** → `reset` rewrites `control.json` from scratch; it is
  coordination state, not real data, so this is always safe.
- **Credential/network failure on the control push** → fail the same way `deploy-staging`
  already fails (loud, credential never logged); do **not** silently deploy without a lease.
- **Promote freshness** → guarantee preserved: promote still refuses unless the live slot serves
  trunk's `?v=`.

## Testing

- **Lease state-machine unit tests** against a **mocked git layer** (no network): acquire on a
  free slot, acquire when full → queue, renew extends TTL, release advances the queue, expired
  holder is reclaimed, expired queue entry is dropped, race (two acquires, one push wins) →
  exactly one holder. Pure logic, fast, CI-able in the `logic-test.mjs` style.
- **Deploy dry-run** that exercises acquire/queue without pushing site files.
- **Manual two-session race**: two checkouts run `acquire` near-simultaneously → exactly one
  wins, the other queues.

## Scope

- **First build (N=1):** the `staging-control` branch + `control.json`, `tools/staging-lease.mjs`
  (acquire/renew/release/status/reset), `deploy-staging.mjs` integration (acquire + auto-queue +
  renew), and the `/merge` release hook — all at **N=1** (today's single staging URL, unchanged
  bookmark). Unit tests for the state machine.
- **Deferred (designed-for, not built now):** the **N=3 pool** (Staging 1/2/3). Requires Jac to
  provision two more Pages sites + bookmarks; then it's `slots` config + slot→URL mapping. Also
  deferred: mirroring `status` into a human-visible surface (a `curl`-able line or a pinned
  issue comment) for at-a-glance queue visibility.

This is **non-served tooling** (`tools/`, plus a branch in the staging repo) — it changes no
file GitHub Pages serves, so it ships by **`/merge` alone** (no `/deploy`, no `/promote`).

## Out of scope (explicitly rejected)

- **Blending two branches onto staging** for simultaneous review. Technically possible (staging
  is disposable), but promote still needs single-branch, CI-tested bytes, so a blend is
  review-only theater with a "which bytes actually ship?" ambiguity. Serialize (lease) or
  isolate (pool) instead of combine.
- **Moving the deploy into a GitHub Actions workflow** to use Actions `concurrency`/Environments.
  The "enterprise" answer, but it loses the in-session deploy+verify+review immediacy and is a
  much larger change. Possible future direction, out of scope here.
