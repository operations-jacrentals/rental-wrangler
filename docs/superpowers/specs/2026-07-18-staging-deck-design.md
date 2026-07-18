# Staging Deck — numbered, switchable staging deploys

**Status:** approved design (Jac, 2026-07-18)
**Supersedes in practice:** the 3-slot lease pool as the *default* staging path. The slot
system is **kept as a tested backup**, reachable via `/deploy --slots`.

## Problem

Staging today is a 3-slot pool (`tools/staging-lease.mjs`) guarded by a git-native lease.
Two sessions sharing three recycled slots hit real pain this session: a dead 30-min hold
wedged a slot, expired holds lingered, and deploys clobbered each other's bytes at a shared
`?v=` token — so "which slot / did it get overwritten / is my cache stale" became a recurring
tax. The slots exist only to *arbitrate a shared, overwritten target*.

## Idea

Give every deploy its **own immutable numbered URL** instead of a recycled slot. Nothing is
ever overwritten, so there is nothing to arbitrate: no lease, no TTL, no cache collision. An
in-app **"Staging" switcher** (styled like the theme toggle, dev-gated to staging) lists recent
deploys; Claude just tells Jac an id/label to switch to.

## Decisions (locked)

1. **Publish target:** immutable subfolders in the existing `operations-jacrentals/rental-wrangler-staging`
   repo — `…github.io/rental-wrangler-staging/d/<id>/`. Slots 2/3 repos stay as the backup pool.
2. **Switcher:** an in-app, dev-gated control (like the theme button), not a standalone page.
3. **Identity:** `<id> = <feature>-<n>` (feature = branch tail; `n` = per-branch sequence),
   **plus a human `--label`** so Jac knows what each deploy is.
4. **Fallback:** `/deploy --slots` runs the existing lease/slot pool, untouched.
5. **Retention:** keep the newest ~20 deploys (prune older folders + manifest entries); never
   prune the deploy whose bytes currently match `trunk` for a pending `/promote`.

## Architecture

Four units, each independently testable:

### 1. Deck publisher (`tools/deploy-staging.mjs`, deck path — the new default)
- Reuse the existing crawl (`deriveSiteFiles`) and `?v=` bump verbatim — same site-file set.
- Compute `id = <feature>-<n>`: `n` = 1 + max existing `n` for this `feature` in the manifest.
- Publish everything to `d/<id>/` in the staging repo's served branch (`main`), **and** rewrite
  `d/deploys.json` (prepend the new entry, cap at 20), **and** delete pruned folders — as **one
  commit**. Push; on non-fast-forward rejection, re-fetch → recompute `n` → retry (bounded).
  This is the same "git push rejection is the only atomic primitive" model the lease uses.
- Verify: `GET …/d/<id>/index.html` serves the expected `?v=` (poll ~1 min for Pages), exit
  non-zero if it never appears — mirrors today's live-bytes check, but against the folder URL.
- Print the **id, label, and folder URL**.
- `--label "<text>"`: human description (defaults to the HEAD commit subject).
- `--slots`: bypass the deck entirely and run the current lease-slot path unchanged.

### 2. Manifest (`d/deploys.json`, served)
- Shape: `{ version: 1, deploys: [{ id, label, feature, branch, sha, when }] }`, newest-first,
  length ≤ 20. `when` is an ISO string stamped by the deploy tool (never `Date.now()` inside a
  workflow; the deploy tool is a normal Node process so real time is fine here).
- Single source of truth for both the sequence computation and the switcher. Lives on the
  served `main` branch so the switcher can fetch it over HTTP (unlike the non-served
  `staging-control` branch the lease uses).

### 3. In-app "Staging" switcher (`app.js` + `style.css`)
- **Dev-gate:** render only when `location.host` is the staging Pages host **and** the path is
  under `/rental-wrangler-staging/` — never on `app.jacrentals.com`. (Belt-and-suspenders with
  the existing `FEATURES`/dev gating; the gate is a hostname check, not a secret.)
- A `Staging ▾` control in the same chrome slot family as the theme toggle. On open, `fetch`
  `../deploys.json` (relative to `/d/<id>/`), render rows: **label** (primary) · `id` (mono, dim)
  · relative age; the current `id` (parsed from `location.pathname`) is marked "here".
- Tap a row → `location.assign('../' + id + '/')`. Same origin, immutable target — instant.
- Styled through tokens per `jactec-ui` (stamped label, one-accent current marker); no new
  design language. Reduced-motion safe; visible focus.

### 4. Slot fallback (unchanged)
- `tools/staging-lease.mjs` and the slot repos are **not modified**. `/deploy --slots` calls the
  existing acquire→push→verify path. The `lease-*` CI suites keep covering it.

## Skill updates (the second deliverable)

- **`/deploy`** — deck is the default; document the id+label output, that Claude hands Jac an id
  to switch to, and the `--slots` fallback. A failed deck publish/verify is still a HARD STOP.
- **`/start`** — mention the deck: how to open the Staging switcher and read recent deploys.
- **`/merge`** — staging-review precondition now checks the **deck deploy** (or the slot, under
  `--slots`); no lease release needed in deck mode (deploys are ephemeral, pruned by retention).
- **`/promote`** — freshness gate still content-hashes `trunk`'s `app.js`/`style.css`/`rule-usage.js`
  against the **deployed folder's** bytes (finds the matching `d/<id>/`), not a slot. `--slot` pin
  becomes "pin an id" in deck mode.
- **`/end`** — deck deploys are ephemeral; nothing to release. Note the deck as the default and
  slots as the backup.

## What does NOT change

- **Production / `/promote`:** production stays one live site at `app.jacrentals.com` with the
  shared `?v=` cache-bust discipline. The deck is **staging-only**. Promote still verifies staging
  bytes match trunk before the fast-forward go-live.
- **The lease/slot system:** intact, tested, and the backup path.

## Testing

- **Pure-Node unit tests** (mirror `ci/lease-test.mjs`, no network): id/sequence computation from
  a manifest (per-branch `max(n)+1`), manifest prepend + 20-cap prune, retry-on-rejection loop
  (injected fake-git), retention never dropping the promote-matched id.
- **Deck-deploy test** (mirror `ci/lease-deploy-test.mjs`, mocked git seam): the deck path builds
  the right folder + manifest commit; `--slots` still routes to the lease path.
- **Switcher:** a headless render assertion — the switcher renders on the staging host and is
  absent on the production host; a manifest fixture drives the row list + "here" marker.
- Existing gates (`smoke`, `logic`, `lease-*`, `promote-test`, rule-usage, window-catalog,
  code-map) stay green; new tooling ships config-only (no served-site change) → by `/merge` alone.

## Open questions

None — design is locked. Retention depth (20) and the atomic mechanism (git-CAS on the served
branch) are decided above.
