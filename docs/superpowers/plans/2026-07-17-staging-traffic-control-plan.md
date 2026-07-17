# Staging Traffic Control — Consolidated Implementation Plan (N=1)

**Spec:** `docs/superpowers/specs/2026-07-17-staging-traffic-control-design.md`
**Grounded in:** `tools/deploy-staging.mjs`, `tools/promote.mjs`, `ci/logic-test.mjs`, `.claude/skills/{deploy,merge,promote,live}/SKILL.md`.
**Ships by `/merge` alone** — nothing Pages serves changes (spec §Scope): no `/deploy`, no `/promote`, no `?v=` bump, no `data-r`/`WINDOW_CATALOG`/`rule-usage.js` impact. Standard merge gates still run.

This plan merges five reviewed sub-plans (control-substrate, lease-cli, deploy-integration, release-promote, tests-rollout) into one dependency-ordered build. Contradictions are resolved once, here, and are marked **[R#]** where a sub-plan position was overridden.

---

## 0. Resolved architecture (single source of truth)

Three new/edited code modules — **no split-brain, one copy of the git-auth plumbing**:

| Path | Status | Owns |
|---|---|---|
| `tools/lib/staging-git.mjs` | **new** | The ONE authed + sanitizing git wrapper, extracted verbatim from `deploy-staging.mjs:77-142`, plus two hardening deltas and a porcelain CAS classifier. |
| `tools/lib/staging-control.mjs` | **new** | Schema constants, `defaultControl`/`parse`/`validate`/`serialize`, the fetch/commit **CAS primitives**, `reapExpired`, atomic advisory-marker I/O, and an **injectable git-runner seam**. Imported by BOTH `staging-lease.mjs` and `deploy-staging.mjs`. |
| `tools/staging-lease.mjs` | **new** | Pure `decide*` state machine + async `acquire`/`renew`/`release` orchestration + CLI (`acquire\|renew\|release\|status\|reset\|init`). |
| `tools/deploy-staging.mjs` | **edit** | Import wrapper+primitives; async `main()`; acquire→deploy→verify→renew wiring; advisory-marker writes; SIGINT release. |
| `tools/promote.mjs` | **edit** | Slot-aware freshness (slash-normalize) — behaviour-identical at N=1. |
| `ci/lease-test.mjs` | **new** | Pure-Node state-machine + mocked-git tests (logic-test reporting idiom). |
| `.github/workflows/ci.yml`, `CLAUDE.md`, `.claude/skills/{deploy,merge,promote,live}/SKILL.md`, `.gitignore` | **edit** | Gate wiring + exit-code semantics + release steps + ignore the marker. |

**Resolutions applied up front:**
- **[R1] One CAS classification:** the push loser is detected via **`git push --porcelain` machine-stable flag parsing** (`!` = rejected) with `LC_ALL=C`/`LANG=C`, NOT human-stderr regex. Locale-independent, version-stable. stdout (which carries the `To https://x-access-token:<PAT>@…` line) is inspected in-process and **never returned or logged**. (Overrides the stderr-regex approach in lease-cli/release-promote/tests-rollout.)
- **[R2] Full single-branch clone of the tiny control branch — NOT `--depth 1`.** Removes shallow-push (`shallow update not allowed`) and missing-tracking-ref edge cases; refetch is `git fetch origin staging-control` + `git reset --hard FETCH_HEAD` (FETCH_HEAD is always written regardless of refspec). (Overrides control-substrate's `--depth 1`.)
- **[R3] Two TTLs.** `ttlMinutes` (holders, default 30 — a holder does no work during Jac's review) and `queueTtlSeconds` (waiters, default 90 ≈ 3× the 30 s poll — a live waiter proves liveness by polling). (Adopts deploy-integration/tests-rollout; supersedes control-substrate's single TTL.)
- **[R4] Timestamps are epoch-ms integers** everywhere in `control.json` (deterministic reap math + tests; `status` formats them for humans). (Overrides ISO-8601 in control-substrate/release-promote.)
- **[R5] Release matches by `session` OR `branch`.** `/merge` and `/promote` release **by branch** (the merge process may be a different session than the deploy process); the deploy-error / SIGINT path releases **by session**. (Adopts tests-rollout; supersedes release-promote's session-only assumption.)
- **[R6] Generalized N-correct FIFO eligibility:** a caller may claim a free slot iff `#sessions-ahead-of-it < #free-slots`. Reduces to head-only at N=1; prevents idle free slots at N=3. (Adopts tests-rollout; supersedes strict head-only.)
- **[R7] Acquire order in deploy:** read-only `dirty`/`shortSha` first → **acquire** → **then** `bumpVersionToken` → clone → push → verify → renew. A queue timeout therefore never leaves `index.html` dirty. (Adopts lease-cli; supersedes deploy-integration's bump-before-acquire.)
- **[R8] Hold the lease on push-indeterminate and post-push failures; release only when nothing landed** (pre-push abort / pre-bump timeout). A network error after the pack is accepted is INDETERMINATE → hold (TTL governs). (Adopts deploy-integration; supersedes tests-rollout's blanket release-on-any-post-acquire-failure.)
- **[R9] Async orchestration + async poll sleep** (`await new Promise(r=>setTimeout(r,ms))`) so SIGINT fires promptly and the process stays event-loop-clean during a minutes-long wait. The short CAS backoff may reuse blocking `sleepMs`. (Adopts tests-rollout; supersedes deploy-integration's chunked-`sleepMs` interruptible sleep.)
- **[R10] `epoch` reset-guard field** is kept (control-substrate) — cheap in the schema, closes the reviewed reset-livelock: reset is the ONLY writer that bumps it; a long-lived poll/renew captures `startEpoch` and aborts loudly on advance rather than re-applying onto reset state.
- **[R11] The advisory marker is diagnostic-only.** Release is `control.json`-authoritative (session/branch scan); the marker is never trusted for eviction. Kept for promote diagnostics + a resolve fast-path; atomic (temp+rename), gitignored, `token:null` at acquire, filled only on verified renew.

---

## 1. Data-shape reference — `control.json` (version 1, canonical)

Lives on the **`staging-control` orphan branch** in the staging repo (`operations-jacrentals/rental-wrangler-staging`). Never served (Pages source pinned to `main`), never wiped by a deploy (the deploy clone is `--single-branch --branch main`; `syncFiles` wipes only that clone's `ls-files`; push targets `HEAD:refs/heads/main`).

Always serialized canonically: **`JSON.stringify(control, null, 2) + '\n'`** (byte-identical output for identical state → no spurious commits, clean diffs).

```jsonc
{
  "version": 1,               // number, exactly 1. parse throws on mismatch → "run reset".
  "epoch": 0,                 // integer, bumped ONLY by reset (reset-livelock guard, [R10]).
  "ttlMinutes": 30,           // holder TTL. Single in-file source of truth for holder expiry.
  "queueTtlSeconds": 90,      // waiter TTL (≈3× poll). Single in-file source of truth for queue expiry.
  "slots": [
    { "id": 1,
      "url": "https://operations-jacrentals.github.io/rental-wrangler-staging/",
      "holder": null }
  ],
  "queue": []
}
```

**Holder** (`slots[].holder`, `null` when free):
```jsonc
{ "session": "<CLAUDE_CODE_SESSION_ID>",   // release/renew/acquire key
  "branch": "claude/wo-658",               // release-by-branch key ([R5])
  "feature": "wo-658" ,                    // may be null; shown in contention UX
  "acquiredAt": 1752800000000,             // epoch-ms
  "renewedAt":  1752800000000,             // epoch-ms; expiresAt = renewedAt + ttlMinutes*60000
  "expiresAt":  1752801800000 }            // epoch-ms
```

**QueueEntry** (`queue[]`, FIFO by immutable `since`):
```jsonc
{ "session": "…", "branch": "…", "feature": "…",   // feature REQUIRED (contention UX reads it)
  "since":     1752800000000,                       // immutable — sole FIFO ordering key
  "expiresAt": 1752800090000 }                      // liveness keep-alive; refreshed each poll
```

**Invariants baked into the shape:**
- Timestamps are **epoch-ms integers** ([R4]); reap compares `expiresAt <= nowMs` directly (no `Date.parse`).
- Holder expiry uses **in-file `ttlMinutes`**; queue expiry uses **in-file `queueTtlSeconds`** — never a code-side constant (which only seeds a fresh bootstrap). Prevents cross-version sessions reaping each other inconsistently.
- `session` is derived once from `process.env.CLAUDE_CODE_SESSION_ID`; **empty/unset id hard-fails** on any mutating op — never a null-session holder that only TTL can free.
- `slots` is an array from day one → N=3 is a data change, not a schema change.

---

## 2. Lease state-machine contract

Pure functions (no I/O; `now` is a parameter; **each deep-clones its input and never mutates it** — a shallow clone would write through into the caller and break re-decision on CAS retry). The only atomic primitive is git's non-fast-forward rejection of a one-file commit; every state change is one commit + one push, so a crash leaves the remote fully-updated or untouched — no half-state.

### `reapExpired(control, nowMs) → { next, reaped }`
1. Reap **holders** with `holder.expiresAt <= nowMs` → `holder = null`.
2. Reap **queue** entries with `expiresAt <= nowMs` → dropped.
Order matters: reap FIRST, then decide, so a dead `queue[0]` can never block live waiters and nobody self-queues behind an expired-but-present holder. Correctness does not depend on a reap being persisted — the next reader re-derives it.

### `decideAcquire(control, {session, branch, feature, now, ttlMinutes, queueTtlSeconds}) → {next, result}`
```
c = reapExpired(control, now).next
// (0) Already hold a slot → renew in place. A re-deploy must NEVER queue behind itself.
if c has slot s with s.holder.session === session:
    s.holder.renewedAt = now; s.holder.expiresAt = now + ttlMinutes*60000
    s.holder.branch = branch; s.holder.feature = feature
    remove any queue entry for session
    return {status:'acquired', slot:{id,url}}
// (1) Generalized FIFO ([R6]): eligible iff #ahead < #free
free  = c.slots.filter(holder===null).sort(by id)
qIdx  = c.queue.findIndex(session)
ahead = qIdx === -1 ? c.queue.length : qIdx
if free.length > 0 and ahead < free.length:
    claim free[0]; holder = {session,branch,feature,acquiredAt:now,renewedAt:now,expiresAt:now+ttlMinutes*60000}
    remove any queue entry for session
    return {status:'acquired', slot:{id,url}}
// (2) Queue (idempotent) + refresh OUR liveness in place (never re-append → preserves FIFO)
exp = now + queueTtlSeconds*1000
if qIdx === -1: c.queue.push({session,branch,feature,since:now,expiresAt:exp})   // tail
else if c.queue[qIdx].expiresAt - now < queueTtlSeconds*1000/2:                    // lazy: only past half-TTL
        c.queue[qIdx].expiresAt = exp                                             // in place; `since` untouched
position = index_in_queue(session)+1
etaMs    = soonest live holder.expiresAt - now, or null
return {status:'queued', position, etaMs, queueLen, holders:[{slotId,session,feature,expiresAt}], ahead:[{session,feature}]}
```
Notes: the written queue entry **includes `feature`** (fixes the `ahead[].feature===undefined` bug the fixtures masked). The lazy half-TTL refresh means most polls compute `next===control` → orchestration writes nothing (bounds control-branch write churn). `holders` MAY be empty when queued behind the FIFO head while a slot is momentarily free — the UX must branch on that.

### `decideRenew(control, {session, now, ttlMinutes}) → {next, result}`
```
c = reapExpired(control, now).next
s = c.slots.find(holder.session === session)          // re-checks fresh state
if !s: return {status:'not-held'}                     // caller MUST surface this loudly (§6)
s.holder.renewedAt = now; s.holder.expiresAt = now + ttlMinutes*60000
return {status:'renewed', slotId:s.id, expiresAt:s.holder.expiresAt}
```
Renew NEVER re-asserts ownership — if the fresh holder isn't this session, it returns `not-held`, it does not overwrite. This is the double-ownership guard.

### `decideRelease(control, {session?, branch?, slot?, force?}) → {next, result}`
```
guard Array.isArray(control.slots); default queue = []
if force:
    require slot != null (integer)  // `release --force` without --slot is refused, never a silent self-release
    s = slots.find(id === slot); require s
    prior = s.holder; s.holder = null; return {status:'force-cleared', slotId:slot, forced: prior && prior.session!==session}
// self / hook path — match by session OR branch ([R5])
s = slots.find(holder && ((session && holder.session===session) || (branch && holder.branch===branch)))
if !s: return {status:'not-held'}
slotId = s.id; s.holder = null                        // clears ONLY this slot; queue UNTOUCHED (no queue advance on release)
return {status:'released', slotId}
```
Release never advances the queue — the freed slot is claimed by the eligible waiter on its next `acquire` poll (FIFO). Release never wipes deployed Pages bytes — a just-released slot keeps serving its last `?v=` until someone redeploys it (this is why promote-freshness still passes right after a `/merge` release in `/live`).

### Orchestration (`acquire`/`renew`/`release`, async, injectable deps)
```
deps = { now:()=>Date.now(), sleep: async ms=>…, maxRetries:5, backoffMs:300, rng:Math.random }
for attempt in 0..maxRetries:
    { control, baseSha } = await port.read()          // absent branch → bootstrap; corrupt/version-mismatch → throw (loud)
    if startEpoch == null: startEpoch = control.epoch
    else if control.epoch !== startEpoch: throw 'staging-control was reset — re-run /deploy'   // [R10]
    { next, result } = decide*(control, opts)
    if deepEqual(next, control): return result        // pure read (poll no-op) → NO write
    w = await port.write(next, baseSha)               // commit on baseSha, push --porcelain
    if w.ok: return result
    if w.reason !== 'non-fast-forward': throw sanitized // auth/network — fatal
    await deps.sleep(backoffMs*(attempt+1) + rng()*backoffMs)   // JITTER breaks lockstep herd
throw {code:'LEASE_CONTENTION'}                        // bounded give-up; a lost CAS always makes progress after re-fetch
```
`deepEqual` must be **structural** (a ref/shallow compare would spuriously write on a no-op poll and could livelock the retry).

---

## 3. CAS primitive contract (`tools/lib/staging-control.mjs`)

`fetchControl(cred, git=realGit) → { dir, baseSha, control }`
- If `remoteControlSha(cred)===null` → `bootstrapControl` (create-or-adopt).
- Else **full single-branch clone** ([R2]) of `staging-control`; `baseSha = rev-parse HEAD`; `parseControl(control.json)`.
- **Removes its own clone dir on ANY failure before throwing** (no temp-dir leak on a parse throw).
- Throws typed errors: `err.code==='NO_CONTROL_BRANCH'` (absent — clean no-op for release), generic sanitized (net/cred), `err.code==='CORRUPT_CONTROL'`/`ControlError` (unparseable or `version` mismatch → "run reset").

`commitControl(dir, cred, next, msg, baseSha, git=realGit)` — the CAS. Writes canonical `control.json`, `add`, and if nothing changed returns `{ok:true, noop:true}` (no empty commit). Else **commits on the fetched `baseSha`** (detached), then `git push --porcelain <url> HEAD:refs/heads/staging-control`. Returns exactly one of:
- `{ ok:true, sha }` — porcelain shows no `!` flag.
- `{ ok:false, raced:true }` (reason `'non-fast-forward'`) — porcelain `!` line ([R1]).
- **throws sanitized** — auth/network/other; raw stdout (with the `To <PAT-url>` line) discarded, never logged.

`bootstrapControl` — `git init -b staging-control` a fresh **random-suffixed** temp dir (`rw-staging-control-<pid>-<Date.now()>-<randomBytes(4).hex>` to avoid same-ms collision), write seed, commit with **explicit committer identity** `-c user.name=staging-control -c user.email=staging-control@jacrentals` (no ambient identity on a clean container), push `--porcelain`. On `raced:true` → dispose + `fetchControl` (adopt the winner, **never `--force`**); on other failure → dispose + throw. **`reset` force-pushes a fresh orphan root and NEVER deletes the branch** (deleting it would loop the `remoteControlSha→bootstrap→fetch` presence probe during a concurrent reset).

Every primitive threads an **injectable `git` runner** (default = real `staging-git.mjs`) as its last arg, and the bootstrap↔fetch recursion threads the SAME runner — so tests never touch the network.

`reapExpired(control, nowMs)` (shared, per §2). `assertOnlyControlFileStaged(dir)` — `git ls-files` must equal `['control.json']` before any push to `staging-control` (defense-in-depth so app files can never leak onto the control branch via a bootstrap-from-`main` path).

Advisory marker I/O: `writeMarkerAtomic(obj)` (temp file + `renameSync`), `readMarker()`, `clearMarker()` on `.staging-lease.json` at repo root.

---

## 4. `tools/lib/staging-git.mjs` — extraction + hardening

Move **verbatim** from `deploy-staging.mjs`: `git`/`gitTry`/`lines`/`fail`/`sleepMs` (`:77-88`), `STAGING_REPO`/`STAGING_PAGES_BRANCH` (`:55`/`:60`), `resolveCredential` (`:107-116`), `stagingRemoteUrl` (`:118-124`), `gitEnv` (`:125-128`), `gitAuthed` (`:132-142`). Then `deploy-staging.mjs` deletes those locals and `import`s them (`node ci/smoke.mjs` + a `--dry-run` prove parity).

**Delta 1 — `gitEnv` prompt-suppression + locale pin** (strengthens the existing deploy transparently; the exact "session hangs" class this project already fought):
```js
function gitEnv(cred) {
  const base = { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', LANG: 'C' };
  if (cred.kind !== 'ssh') return base;
  return { ...base, GIT_SSH_COMMAND:
    `ssh -i ${JSON.stringify(cred.keyPath)} -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new` };
}
```
`GIT_TERMINAL_PROMPT=0` + SSH `BatchMode=yes` → a bad/expired credential fails fast instead of blocking on an interactive prompt. `LC_ALL=C` stabilizes any residual text.

**Delta 2 — `gitAuthedTry`, porcelain-classified ([R1]):** runs `git ... --porcelain`, on failure inspects `e.stdout` line flags in-process (`l.startsWith('!')` ⇒ rejected/non-ff ⇒ `{ok:false, raced:true}`), else returns a sanitized `{ok:false, raced:false, error}`; **stdout/argv/stderr are never returned or logged** (same posture as `gitAuthed`).

---

## 5. Numbered, dependency-ordered build

> Each step: **what · file · why · verify**. Steps 1–6 are the substrate + state machine (buildable/testable with zero network via the injected git seam). Steps 7–10 wire consumers. Steps 11–15 are gates/docs/rollout.

**1. Extract the shared git wrapper.**
File: `tools/lib/staging-git.mjs` (new) + `tools/deploy-staging.mjs` (edit: delete locals, import).
Why: one copy of the credential/sanitizing plumbing; no split-brain ([R1] classifier lives here).
Verify: `node ci/smoke.mjs` green; `node tools/deploy-staging.mjs --dry-run` behaves byte-identically (still bumps `?v=`, stops before network).

**2. Schema + pure helpers.**
File: `tools/lib/staging-control.mjs` — constants (`STAGING_CONTROL_BRANCH`, `CONTROL_FILE`, `CONTROL_VERSION=1`, `DEFAULT_TTL_MINUTES=30`, `DEFAULT_QUEUE_TTL_SECONDS=90`, `DEFAULT_N=1`, `SLOT_URLS={1:…}`), `defaultControl(n)`, `serialize`, `validateControl`, `parseControl`, `slotUrl`, `reapExpired`, `newControlDir`/`disposeControlDir`, marker I/O, `ControlError`.
Why: the disposable coordination state + canonical serialization; array-from-day-one for N=3.
Verify: pure unit cases in step 6 (round-trip, validate-throws, `defaultControl(1)` deep-equals the §1 literal incl. `epoch:0`).

**3. CAS + bootstrap primitives with the injectable seam.**
File: `tools/lib/staging-control.mjs` — `remoteControlSha`, `bootstrapControl`, `fetchControl`, `commitControl` (§3), all taking `git=realGit`; `assertOnlyControlFileStaged`.
Why: the compare-and-swap mutex substrate ([R2] full clone, FETCH_HEAD refetch, [R1] porcelain classify, random temp dir, committer identity, self-disposing dirs).
Verify: step 6 mocked-git cases (absent→bootstrap; bootstrap race→adopt; present→parse; corrupt→throw; CAS raced→`{ok:false,raced:true}`; identical→`{noop:true}`; auth→sanitized throw with **no token substring**).

**4. Pure state machine.**
File: `tools/staging-lease.mjs` — `reapExpired` (re-export), `decideAcquire`, `decideRenew`, `decideRelease` (§2). No import-time git/FS.
Why: deterministic, deep-cloning decision core — the whole correctness surface.
Verify: step 6 pure cases (acquire-on-free, acquire-when-full→queue, already-holds→renew-not-self-queue, live-poller-refreshed-not-reaped, release-by-branch, generalized-FIFO, reap order, input-not-mutated).

**5. Async orchestration + CLI.**
File: `tools/staging-lease.mjs` — `acquire`/`renew`/`release` orchestration loop (§2, epoch guard, jittered backoff, `LEASE_CONTENTION`), `main()` subcommands `acquire|renew|release|status|reset|init`, `pathToFileURL` main-guard, `SESSION` derivation (hard-fail on empty for mutating ops; `status`/`init`/`reset` don't require a session). `release` CLI accepts `--slot N`, `--force`, `--branch <b>`.
Why: the CLI surface `/deploy`, `/merge`, `/promote`, and humans call; async ([R9]) so poll stays signal-clean.
Verify: `node tools/staging-lease.mjs status` against a bootstrapped branch prints "slot 1 free, queue empty"; injected-git race test (step 6) drives rejected-then-ok.

**6. Test harness.**
File: `ci/lease-test.mjs` (new) — pure-Node, `logic-test.mjs` reporting idiom, `makeFakeGit` monotonic-version arbiter with `_armConcurrent`/`_armFail`. Full case list in §7.
Why: locks every invariant before any consumer wiring; **no browser/server → NOT part of the port-8000→9147 swap**.
Verify: `node ci/lease-test.mjs` exits 0, all checks pass.

**7. Deploy integration — acquire→deploy→verify→renew.**
File: `tools/deploy-staging.mjs` (edit). Make `main()` async; bottom becomes `main().catch(e=>fail(e?.message||String(e)))` behind the `import.meta.url===pathToFileURL(process.argv[1]).href` guard; hoist `ROOT`/`process.chdir(ROOT)` (`:90-91`) into `main()`. `--dry-run` → **no lease, no network** (unchanged local derive+bump+stop). Real path ([R7] order): compute read-only `dirty`/`shortSha` → `installLeaseSignalRelease(cred)` → `const slot = await acquireSlotOrQueue(...)` → `assertSlotShape(slot)` → **then** `bumpVersionToken` → clone→sync→commit→push→5-attempt live-bytes verify against `slot.url` → on ✅ `renew` (surface `not-held` loudly). Release/hold rules per [R8] (§6). Write advisory marker `token:null` at acquire, `token:newToken` on verified renew.
Why: real traffic control; never deploy without a held, shape-valid slot.
Verify: step 8 `ci/lease-deploy-test.mjs`; manual `--lease-only`/two-session race (§8).

**8. Deploy-integration tests.**
File: `ci/lease-deploy-test.mjs` (new) — imports the exported seams (`acquireSlotOrQueue`, `contentionBanner`, `queueProgressLine`, `queueTimeoutMessage`, `assertSlotShape`), all effects injected (`lease`,`sleep`,`now`,`log`) → no network. Cases in §7(C).
Why: the watchdog/banner/exit-3 logic is easy to get subtly wrong.
Verify: `node ci/lease-deploy-test.mjs` exits 0.

**9. `/merge` + `/promote` release wiring.**
Files: `.claude/skills/merge/SKILL.md` (new step after squash-merge: `node tools/staging-lease.mjs release --branch <feature-branch>` — **by branch** [R5]; a failed release is a **soft WARNING, never a merge failure** — TTL backstops), `.claude/skills/promote/SKILL.md` (belt-and-suspenders sweep `release --branch <b>` after the live-bytes ✅; soft-only). `promote.mjs` stays credential-free.
Why: free the slot the moment the review window closes; TTL is only the backstop.
Verify: manual — after a `/merge`, `status` shows the slot free; a second release no-ops.

**10. Promote per-slot freshness (slash-safe).**
File: `tools/promote.mjs` (edit) — add `stripSlash(u)` + `resolveStagingSlotUrl()` after `:50`; change `:134` to `fetchLiveToken(stripSlash(resolveStagingSlotUrl().url))`; enrich the `:140-146` prints and the enforced `:161-173` gate to name the slot. N=1 always resolves to the single `STAGING_URL` (marker is advisory; usually already deleted by `/merge`). Drift note guarded on a non-null marker token.
Why: fixes the `…staging//index.html` double-slash and makes N=3 a one-seam change; freshness gate otherwise unchanged.
Verify: `node tools/promote.mjs` (read-only preview) prints the same freshness verdict as today at N=1.

**11. Gate wiring.**
Files: `.github/workflows/ci.yml` (add `node ci/lease-test.mjs` + `node ci/lease-deploy-test.mjs` after the logic-suite step), `CLAUDE.md` "Gates" list (append both; note they're pure-Node, **excluded from the port swap**), `.claude/skills/merge/SKILL.md` local-gates list.
Why: CI enforcement is the drift guard.
Verify: `node ci/lease-test.mjs && node ci/lease-deploy-test.mjs` green locally; CI green on the PR.

**12. Exit-code semantics in the skills.**
Files: `.claude/skills/deploy/SKILL.md` (exit 3 = **staging busy, NOT broken** — do not treat as the rotate-PAT HARD STOP; report queued/timed-out, re-run `/deploy`), `.claude/skills/live/SKILL.md` (on `/deploy` exit 3 STOP the chain cleanly — can't `/merge` without a completed deploy), `.claude/skills/merge/SKILL.md` (handoff: after squash-merge, if `release` returns `not-holder`/`not-held` the slot was TTL-reclaimed during review → warn Jac + re-`/deploy` before `/promote`).
Why: `/deploy` currently treats ANY non-zero as "staging broken" — exit 3 must read as busy-not-broken.
Verify: doc review; grep the three SKILLs mention exit 3.

**13. `.gitignore` + review-budget doc.**
Files: `.gitignore` (add `.staging-lease.json`), `CLAUDE.md`/`staging-lease.mjs` header (document the 30-min holder TTL as the review budget — configurable in `control.json`; a long review must re-run `/deploy`, idempotent, to refresh; `reset --force` is a loud stop-the-world manual-recovery op that can drop a concurrent acquire and wipe an in-flight holder → its next `renew` returns `not-held`).
Why: the marker must never ship; humans need the TTL contract.
Verify: `git status` after a deploy shows the marker ignored.

**14. Bootstrap + verify the control branch (rollout §8.1).**

**15. N=3 flip is data-only (rollout §8.2, deferred).**

---

## 6. Concurrency correctness

The system is a **git-native distributed mutex**: `control.json` on `staging-control` is the shared state; git's non-fast-forward push rejection is the ONLY atomic primitive. Each invariant below states the race and how it is guaranteed.

**INV-1 — Single-writer CAS (no lost update / no half-state).**
*Race:* two sessions read the same tip and both try to mutate.
*Guarantee:* `commitControl` commits on the exact fetched `baseSha` and pushes `HEAD:refs/heads/staging-control`. The second push's parent is no longer the remote tip → git rejects it non-fast-forward → `{ok:false,raced:true}` → the loser **re-fetches and re-decides from scratch** (never blind-replays). Because every change is one commit + one push, a crash mid-op leaves the remote fully-updated or untouched — no representable half-state.

**INV-2 — Non-ff vs fatal classification without leaking the PAT.**
*Race:* the retry loop must tell a retryable CAS loss from a fatal auth/network failure, but the sanitizing wrapper hides stderr (it can carry the token).
*Guarantee:* [R1] `git push --porcelain` + `LC_ALL=C`; the per-ref `!` flag is parsed from stdout **in-process** (locale-independent) → `raced`; anything else → sanitized throw. stdout (incl. the `To <PAT-url>` line) is never returned/logged. Test 4.9/§7 asserts the thrown message contains no token substring.

**INV-3 — TTL reap ordering (dead entity never wedges the line).**
*Race:* an expired-but-unreaped `queue[0]` (or holder) makes every live caller conclude "someone's ahead" → nobody claims.
*Guarantee:* within one snapshot, `reapExpired` runs FIRST (holders then queue), THEN eligibility is evaluated, THEN a single CAS persists the whole thing. Correctness never depends on the reap being persisted — the next reader re-derives it (so a pure-reap poll writes nothing).

**INV-4 — FIFO fairness + live-poller liveness ([R3][R6]).**
*Race A (starvation):* a session waiting > queue-TTL behind a re-renewing holder has its live queue entry reaped, then re-appended at the tail → loses its place.
*Guarantee A:* FIFO order is the immutable `since`; `expiresAt` is a liveness keep-alive refreshed **in place** (same index, lazily past half-TTL) on every poll — never re-appended.
*Race B (head-of-line by a corpse):* a crashed waiter holds the head for the full holder-TTL.
*Guarantee B:* queue entries use the short `queueTtlSeconds` (90 s ≈ 3× poll); a live waiter refreshes every 30 s, a dead one is reaped within 90 s. Holders (idle during review) keep the long `ttlMinutes`.
*Race C (idle free slot at N>1):* strict head-only leaves a free slot idle behind a non-eligible head.
*Guarantee C:* eligibility is `#ahead < #free` — reduces to head-only at N=1, fills all slots at N=3.

**INV-5 — No double ownership after a reap/reclaim.**
*Race:* holder A is reaped on TTL (slow container / clock skew) while its session is alive; A's next `renew` re-asserts ownership → two owners.
*Guarantee:* `decideRenew`/`decideRelease` read the **fresh** holder and no-op (`not-held`) unless it is still this session — they NEVER re-assert. Deploy surfaces a post-verify `not-held` loudly ("lease expired — staging may be overwritten, re-run /deploy"). `/merge`'s existing "live staging `?v=` must equal this branch" rule is the catch-all.

**INV-6 — Idempotent same-session re-deploy (no self-deadlock).**
*Race:* a holder re-runs `/deploy` while its lease is live; naive acquire sees no free slot (it holds the only one) → queues behind its own `holder.expiresAt` forever.
*Guarantee:* `decideAcquire` clause (0) detects a slot already held by this session and renews it in place, returning `acquired` — never self-queues.

**INV-7 — Bootstrap race (atomic branch creation).**
*Race:* two first-runners create the orphan `staging-control` with unrelated roots; a naive `--force` clobbers the winner.
*Guarantee:* `bootstrapControl` pushes `--porcelain` non-force; the loser gets `raced:true` → disposes → `fetchControl` **adopts** the winner's branch and re-applies. `reset` is the only force-push and NEVER deletes the branch (keeps the presence probe reliable).

**INV-8 — Corrupt ≠ absent (no silent wipe of live leases).**
*Race:* a transient/partial/corrupt read makes a normal `acquire` overwrite `control.json` with a fresh default, destroying every holder + the queue.
*Guarantee:* the read distinguishes `raw===null` (absent → bootstrap allowed) from `raw!=null && unparseable` (corrupt → **fail loudly, require `reset`**); `parseControl` also throws on a `version` it doesn't understand. Only `reset` overwrites unconditionally.

**INV-9 — Reset livelock guard ([R10]).**
*Race:* a spinning poll/renew keeps re-applying stale state onto a deliberate `reset`.
*Guarantee:* `epoch` is bumped ONLY by reset; long-lived callers capture `startEpoch` and abort loudly ("control was reset — re-run /deploy") when a later fetch shows a higher epoch.

**INV-10 — Deploy release/hold correctness ([R8]).**
*Race:* releasing a slot whose bytes actually landed lets a queued session clobber a real deploy.
*Guarantee:* release only when **nothing landed** (pre-push abort / pre-bump timeout). A push error is INDETERMINATE (pack may have been accepted) → **hold** (TTL governs). A post-push verify failure → **hold** (bytes ARE pushed). SIGINT before push → release; after push/indeterminate → hold. TTL is always the ultimate backstop.

**INV-11 — Contention is not fatal.**
*Race:* a transient thundering-herd non-ff kills a deploy that would have won on the next re-fetch.
*Guarantee:* the orchestration retries internally with **jittered** backoff (a lost CAS always progresses after re-fetch); acquire/renew/release throw only on genuine auth/network failure. `waitForSlot`/`acquireSlotOrQueue` additionally catch `LEASE_CONTENTION` per poll and ride it out — only a no-forward-progress watchdog (position stalled > `ttl+grace`) ends the wait with exit 3.

**INV-12 — No token / no app files on the wrong branch.**
`gitAuthed`/`gitAuthedTry` are the only remote-touching calls and never surface raw output; `assertOnlyControlFileStaged` guarantees `staging-control` pushes carry only `control.json`; the advisory marker is an unreferenced root dotfile (unreachable by `deriveSiteFiles`, gitignored).

*Accepted, bounded:* clock skew — every timestamp is written from the mutating session's own `Date.now()`; the 30-min holder TTL and 90 s queue TTL dwarf realistic NTP skew on cloud containers; the INV-5 fresh-holder re-check is the safety net when skew does bite.

---

## 7. Test plan — invariant → concrete case

All in `ci/lease-test.mjs` (pure + mocked-git) and `ci/lease-deploy-test.mjs` (deploy seam), `logic-test.mjs:2715-2726` reporting idiom, `process.exit(anyFail?1:0)`. Fixtures: `freshControl(n)`, `heldSlot(id,session,atMs,ttlMin)`, `qEntry(session,atMs,ttlSec)` (includes `feature`), `makeFakeGit(control)` (monotonic version arbiter, `_armConcurrent`, `_armFail`), `clone`, `T0`, `noopSleep`.

| # | Invariant | Case |
|---|---|---|
| 4.1 | INV-1, purity | acquire-on-free: holder set, `expiresAt===T0+30*60000`, queue empty, **input control not mutated**. |
| 4.2 | INV-4 | acquire-when-full → `queued`; assert pushed `queue[0].feature` is populated (not `undefined`). |
| 4.3 | INV-5 | renew extends TTL for the holder; a **non-holder renew → `not-held`** (no overwrite). |
| 4.4 | INV-3 | release-then-head-claims: release does NOT pop the queue; the head's next acquire claims the freed slot. |
| 4.5 | INV-3 | expired holder reaped → cleared + reported; next acquire reclaims. |
| 4.6 | INV-3/4 | expired queue entry dropped; live one becomes head and claims. |
| 4.7 | INV-1/11 | race: `_armConcurrent` → loser gets non-ff, re-reads, queues at #1; exactly one holder; `writes===2` (false→true). |
| 4.8 | INV-4 (N=1) | non-head cannot jump a free slot (head-only degenerate). |
| 4.9 | INV-2/11 | `_armFail('auth')` → `acquire` **throws** (never proceeds lease-less); thrown message contains **no token substring**. |
| 4.10 | INV-6 | already-holds → `acquire` renews same slot, `queue.length===0` (no self-queue). |
| 4.11 | INV-4A | live poller past half-TTL → `expiresAt` strictly increased (refreshed); a poll well before half-TTL → `deepEqual(next,control)` (pure read, no write). |
| 4.12 | INV-5 [R5] | release-by-branch (no session) clears the holder; `release({session:'other'})` → `not-held`. |
| 4.13 | INV-4C | N=3: queue=[B,A], 2 free → A (ahead=1<free=2) acquires; a 3rd waiter with 1 free + 2 ahead → queued. Plus 3-arrivals-all-acquire, 4th queues. |
| 4.14 | INV-8 | corrupt read (`raw:'{bad'`) → orchestration **fails loudly, no overwrite**; `raw:null` → bootstraps. |
| 4.15 | INV-7 | bootstrap race: two first-runners, one create wins, loser adopts via FETCH_HEAD refetch; final control has exactly one holder. |
| 4.16 | INV-9 | epoch advance between fetch and re-decide → orchestration aborts with the reset message. |
| 4.17 | INV-12 | `commitControl` records the committer-identity `-c` pair on every commit; `assertOnlyControlFileStaged` rejects a staged app file. |
| 4.18 | INV-1 | `commitControl` on identical state → `{ok:true,noop:true}` (no empty commit); refetch asserts `reset --hard FETCH_HEAD` (not `origin/<branch>`). |
| C-1 | INV-10/11 | (deploy seam) free slot → returns slot, zero sleeps; busy→frees → `queued`×2 then `acquired`, banner once. |
| C-2 | INV-11 | contention-during-wait: first N `acquire` raise `LEASE_CONTENTION`, then a slot frees → resolves `acquired` (wait not aborted). |
| C-3 | watchdog/exit-3 | decreasing position keeps waiting (deadline resets); stuck position past `ttl+grace` → `queueTimeoutMessage` + `process.exit(3)` (spy). |
| C-4 | UX | empty-`holders` queued state renders "a slot is free but N ahead", never "Slot undefined"; banner/progress strings exact (session last-4, minutes ceil). |
| C-5 | INV-2 | `acquire` throws (auth) → propagates, never deploys. |
| C-6 | INV-6 | idempotent same-session: fake `acquire` returns the same slot for an already-holder → returned, no queue. |
| C-7 | dry-run | `--dry-run` performs **no** lease/network call. |

Manual (against the real branch, §8): two near-simultaneous `acquire` → exactly one `acquired`, one `queued`; a THIRD session `release --branch <holder-branch>` frees it (proves cross-session release-by-branch); queued session then claims. Cleanup `reset --force`. `STAGING_DEPLOY_PAT` set, never echoed.

---

## 8. Rollout

### 8.1 Land N=1 — ships by `/merge` alone
Touches only non-served tooling/config/skills → `/merge` alone (no `/deploy`, no `/promote`).

1. `git checkout -b claude/staging-traffic-control origin/trunk`.
2. Build steps 1–13 (§5).
3. **Bootstrap the control branch (race-safe):** `node tools/staging-lease.mjs init` → `bootstrapControl` create-or-adopt (never `--force`). Seed = the §1 N=1 literal (`version:1, epoch:0, ttlMinutes:30, queueTtlSeconds:90, slots:[{id:1,url:…,holder:null}], queue:[]`). Because Pages serves `main`, `staging-control` is never served and never wiped by a deploy. One-time human check: staging → Settings → Pages source stays `main`.
4. **Verify substrate:** `node tools/staging-lease.mjs status` prints "slot 1 free, queue empty"; run the §7 manual two-session race once (incl. the cross-session release-by-branch check).
5. **Gates:** `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/lease-test.mjs`, `node ci/lease-deploy-test.mjs`, `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check` (port 8000→9147 swap for the two Playwright suites only; the lease suites are pure-Node and **excluded**). Fresh-context code-review subagent on `git diff origin/trunk...HEAD` — focus the reviewer on: porcelain non-ff-vs-fatal classification (must not print stdout), commit-on-`baseSha`, corrupt≠absent, release-hold matrix ([R8]).
6. `/merge` → PR → `smoke` CI (now runs both lease steps) → squash to trunk. Nothing to promote.

### 8.2 Later flip to N=3 (data + provisioning, no state-machine code change)

> **LANDED 2026-07-17 (code):** steps 2–4 below are implemented on the N=3 branch. Confirmed
> against the code that this is **more than a data flip**: step 3 (deploy-side slot→repo routing)
> and the promote per-slot resolution were BOTH genuinely required, not already-done —
> `deploy-staging.mjs` hardcoded slot 1's repo and `promote.mjs`'s `resolveStagingSlotUrl` always
> returned slot 1's URL. Now: `SLOT_TARGETS`+`slotTarget()` in `tools/lib/staging-git.mjs`
> (`SLOT_URLS` derived from it), deploy clones/pushes the acquired slot's repo, promote scans all
> slots for the one serving the trunk token (or `--slot N`). No state-machine change; still `/merge`
> alone. **Remaining = step 1 (provisioning) + the re-seed in step 2**, done when staging is idle.

`slots` is an array from day one and eligibility is already `#ahead < #free`, so:
1. **Provision two more Pages sites** (Jac): `rental-wrangler-staging-2`/`-3` (or two more Pages branches), each its own URL; bookmark all three.
2. **Config:** add slot URLs — `SLOT_URLS = {1:…, 2:…, 3:…}` and `DEFAULT_N = 3` in `staging-control.mjs`; `node tools/staging-lease.mjs reset --slots 3` re-seeds `control.json` with 3 free slots.
3. **Deploy-side slot→repo/branch mapping** is the one genuinely deferred component (deploy currently hardcodes `STAGING_REPO`/`main`): add a slot→{repo,pushBranch} map so a deploy pushes to the acquired slot's repo, and thread `resolveStagingSlotUrl()` in promote to resolve by `expectedToken`/`--slot` (never the marker, which `/merge` deletes).
4. **Verify:** `status` shows 3 free slots; case 4.13 already pins that all three fill and a fourth queues (the correctness prerequisite for N>1).
5. Non-served (control.json + config) → `/merge` alone again.

---

## 9. Definition of done

- [ ] `tools/lib/staging-git.mjs` extracted; `deploy-staging.mjs` imports it; `smoke` + `--dry-run` byte-identical to pre-change.
- [ ] `gitEnv` sets `GIT_TERMINAL_PROMPT=0`/`LC_ALL=C`/SSH `BatchMode=yes`; `gitAuthedTry` classifies via porcelain `!`, never surfaces token-bearing output.
- [ ] `tools/lib/staging-control.mjs`: schema/validate/serialize (canonical `+'\n'`), CAS primitives (full clone, FETCH_HEAD refetch, commit-on-`baseSha`, random temp dir, committer identity, self-disposing dirs, `assertOnlyControlFileStaged`), `reapExpired`, atomic marker I/O, injectable git seam threaded through the bootstrap↔fetch recursion.
- [ ] `tools/staging-lease.mjs`: pure `decide*` (deep-clone, reap-first, generalized FIFO, already-holds, in-place queue refresh, session-OR-branch release), async orchestration (epoch guard, jittered backoff, `LEASE_CONTENTION`, structural `deepEqual` no-op guard), CLI subcommands + main-guard + empty-session hard-fail.
- [ ] `deploy-staging.mjs`: async `main()`; `--dry-run` does no lease/network; order = read-only compute → acquire → shape-assert → bump → clone→push→verify → renew(surface `not-held`); release/hold per [R8]; SIGINT release (re-entrancy guard, bounded push); advisory marker `token:null`→`newToken`; exit codes {0,1,2,3,130}.
- [ ] `promote.mjs`: `stripSlash` + `resolveStagingSlotUrl`; freshness names the slot; credential-free; N=1 verdict identical to today.
- [ ] `ci/lease-test.mjs` + `ci/lease-deploy-test.mjs` cover every §7 case; both exit 0; no network/browser.
- [ ] Control branch bootstrapped; `status` shows slot 1 free/queue empty; manual two-session race + cross-session release-by-branch verified.
- [ ] All gates green (lease suites excluded from the port swap); fresh-context code-review pass done.
- [ ] Gate wiring in `.github/workflows/ci.yml`, `CLAUDE.md`, `merge/SKILL.md`; exit-3 semantics in `deploy`/`live`/`merge` SKILLs; review-budget + `reset --force` caveat documented; `.gitignore` has `.staging-lease.json`.
- [ ] Shipped via `/merge` alone (non-served); nothing promoted.

## 10. Exit codes (deploy-staging)

| Code | Meaning |
|---|---|
| 0 | success / nothing-to-push / dry-run / lease-only clean exit |
| 1 | generic `fail()` — branch guard, empty file list, bump pattern, malformed slot, **lease auth/network throw** |
| 2 | push succeeded but live-bytes verify failed (post-push HARD STOP) — unchanged |
| 3 | **new** — queue wait gave up with no forward progress (never acquired). *Busy, not broken* — do not rotate the PAT; re-run `/deploy`. |
| 130 | interrupted (SIGINT/SIGTERM) after best-effort (pre-push-only) release |
