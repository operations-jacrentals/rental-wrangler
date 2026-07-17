// lease-test.mjs — pure-Node state-machine + mocked-git tests for staging traffic control.
//
// NO network, NO browser, NO Playwright — this is NOT part of the port-8000→9147 swap. Every
// git interaction goes through makeFakeGit (an in-memory monotonic-version CAS arbiter with
// _armConcurrent / _armFail), so the async orchestration is exercised end-to-end without ever
// touching the real staging remote. Covers §7 cases 4.1–4.18 (the whole correctness surface).
//
// Reporting idiom mirrors ci/logic-test.mjs: collect {ok, m}, print ✓/✗, process.exit(anyFail?1:0).

import {
  decideAcquire, decideRenew, decideRelease, reapExpired, deepEqual,
  acquire,
} from '../tools/staging-lease.mjs';
import {
  serialize, defaultControl, commitControl, assertOnlyControlFileStaged, COMMIT_IDENTITY,
  bootstrapControl, refetchControl, SLOT_URLS, DEFAULT_N, slotUrl,
} from '../tools/lib/staging-control.mjs';
import {
  classifyPushFailure, SLOT_TARGETS, slotTarget, pagesUrlForRepo, STAGING_REPO,
} from '../tools/lib/staging-git.mjs';
import { readFileSync } from 'node:fs';

const T0 = 1752800000000;
const MIN = 60000;
const CRED = { kind: 'pat', token: 'ghp_SECRETTOKEN_must_never_leak_0000' };
const noopSleep = async () => {};
const fixedDeps = { now: () => T0, sleep: noopSleep, rng: () => 0 };

const results = [];
const ok = (c, m) => results.push({ ok: !!c, m });
async function group(label, fn) {
  try { await fn(); }
  catch (e) { ok(false, `${label} — UNEXPECTED THROW: ${e && e.message || e}`); }
}

// ── fixtures ──

function held(session, atMs = T0, ttlMin = 30, extra = {}) {
  return {
    session,
    branch: extra.branch || `br-${session}`,
    feature: extra.feature || `ft-${session}`,
    acquiredAt: atMs,
    renewedAt: atMs,
    expiresAt: typeof extra.expiresAt === 'number' ? extra.expiresAt : atMs + ttlMin * MIN,
  };
}
function qEntry(session, atMs = T0, ttlSec = 90, feature) {
  return { session, branch: `br-${session}`, feature: feature || `ft-${session}`, since: atMs, expiresAt: atMs + ttlSec * 1000 };
}
function freshN(n) {
  const slots = [];
  for (let id = 1; id <= n; id++) slots.push({ id, url: `https://staging.example/slot-${id}/`, holder: null });
  return { version: 1, epoch: 0, ttlMinutes: 30, queueTtlSeconds: 90, slots, queue: [] };
}
const aopts = (session, extra = {}) => ({ session, branch: extra.branch || `br-${session}`, feature: extra.feature || `ft-${session}`, now: extra.now ?? T0, ttlMinutes: 30, queueTtlSeconds: 90 });

// ── the mocked git seam: a monotonic-version CAS arbiter ──
//
// Models the shared remote branch as { sha:'<n>', text:<control.json> } | null, and each clone
// dir as an in-memory workspace. push() is the compare-and-swap: it succeeds only if the dir's
// fetched parent still equals the remote tip, else returns {ok:false,raced:true}. _armConcurrent
// injects a winning writer just before the next push (advancing the remote, so the caller loses
// and must re-fetch). _armFail makes the next network op throw a sanitized (token-free) error.
function makeFakeGit(seed) {
  let counter = 0;
  const nextSha = () => `sha${++counter}`;
  let remote;
  if (seed == null) remote = null;
  else if (typeof seed === 'string') remote = { sha: nextSha(), text: seed };
  else remote = { sha: nextSha(), text: serialize(seed) };

  const dirs = new Map();
  const api = {
    writes: 0,
    commits: [],
    refetches: 0,
    _concurrent: null,
    _fail: null,
    _armConcurrent(mutator) { this._concurrent = mutator; },
    _armFail(kind) { this._fail = kind || 'auth'; },
    _setStaged(dir, files) { dirs.get(dir).stagedFiles = files.slice(); },
    _remoteControl() { return remote ? JSON.parse(remote.text) : null; },
    _remoteSha() { return remote ? remote.sha : null; },

    _maybeFail() {
      if (this._fail) {
        this._fail = null;
        throw new Error('staging-control: git op against the staging remote failed (message withheld — it may echo the credential).');
      }
    },
    _applyConcurrent() {
      if (!this._concurrent) return;
      const m = this._concurrent; this._concurrent = null;
      const cur = remote ? JSON.parse(remote.text) : null;
      const mutated = m(cur) || cur;
      remote = { sha: nextSha(), text: serialize(mutated) };
      this.writes++; // the concurrent winner's successful push
    },

    remoteControlSha() { this._maybeFail(); return remote ? remote.sha : null; },
    clone(_cred, dir) {
      this._maybeFail();
      if (remote == null) throw new Error('fake: clone of an absent branch');
      // A clone sets up an `origin` remote → refetch (git fetch origin) works.
      dirs.set(dir, { baseSha: remote.sha, baseText: remote.text, workText: remote.text, stagedFiles: [], isBootstrap: false, hasOrigin: true });
    },
    headSha(dir) { return dirs.get(dir).baseSha; },
    readControl(dir) { return dirs.get(dir).baseText; },
    writeControl(dir, text) { dirs.get(dir).workText = text; },
    refetch(_cred, dir) {
      this._maybeFail();
      const d = dirs.get(dir);
      // Model realGit.refetch's `git fetch origin …`: a `git init`'d bootstrap dir has NO
      // origin, so a refetch of one FATALS (the exact divergence the fake used to mask).
      if (!d.hasOrigin) throw new Error("fake: fatal: 'origin' does not appear to be a git repository");
      this.refetches++;
      d.baseSha = remote.sha; d.baseText = remote.text; d.workText = remote.text; d.stagedFiles = [];
      return d.baseSha;
    },
    stageAll(dir) {
      const d = dirs.get(dir);
      d.stagedFiles = (d.isBootstrap || d.workText !== d.baseText) ? ['control.json'] : [];
    },
    hasStagedChanges(dir) { const d = dirs.get(dir); return d.isBootstrap || d.workText !== d.baseText; },
    stagedList(dir) { return dirs.get(dir).stagedFiles.slice(); },
    commitOn(dir, baseSha, msg) {
      this.commits.push({ dir, baseSha, msg, name: COMMIT_IDENTITY.name, email: COMMIT_IDENTITY.email });
      return `local-${this.commits.length}`;
    },
    push(_cred, dir) {
      this._maybeFail();
      this._applyConcurrent();
      const d = dirs.get(dir);
      const expected = d.isBootstrap ? null : d.baseSha;
      const current = remote ? remote.sha : null;
      if (expected === current) {
        remote = { sha: nextSha(), text: d.workText };
        d.baseSha = remote.sha; d.baseText = d.workText; d.isBootstrap = false; d.stagedFiles = [];
        this.writes++;
        return { ok: true, sha: remote.sha };
      }
      return { ok: false, raced: true };
    },
    forcePush(_cred, dir) {
      this._maybeFail();
      const d = dirs.get(dir);
      remote = { sha: nextSha(), text: d.workText || d.baseText };
      this.writes++;
      return { ok: true, sha: remote.sha };
    },
    initSeed(dir, text, msg) {
      this.commits.push({ dir, baseSha: null, msg, name: COMMIT_IDENTITY.name, email: COMMIT_IDENTITY.email });
      // `git init -b staging-control <dir>` — a fresh repo with NO `origin` remote yet.
      dirs.set(dir, { baseSha: null, baseText: text, workText: text, stagedFiles: ['control.json'], isBootstrap: true, hasOrigin: false });
      return 'seed-local';
    },
  };
  return api;
}

// ── the cases ──

async function run() {
  // 4.1 INV-1, purity — acquire-on-free.
  await group('4.1', () => {
    const c0 = defaultControl(1);
    const frozen = serialize(c0);
    const { next, result } = decideAcquire(c0, aopts('S-aaaa'));
    ok(result.status === 'acquired' && result.slot.id === 1, '4.1 acquire-on-free → acquired slot 1');
    ok(next.slots[0].holder && next.slots[0].holder.expiresAt === T0 + 30 * MIN, '4.1 holder expiresAt === T0 + 30min');
    ok(next.queue.length === 0, '4.1 queue empty after acquire');
    ok(serialize(c0) === frozen, '4.1 input control NOT mutated');
  });

  // 4.2 INV-4 — acquire-when-full → queued; pushed queue entry carries feature.
  await group('4.2', () => {
    const c = defaultControl(1);
    c.slots[0].holder = held('S-hold', T0, 30, { feature: 'fh' });
    const { next, result } = decideAcquire(c, aopts('S-me', { feature: 'fm' }));
    ok(result.status === 'queued' && result.position === 1, '4.2 full → queued at #1');
    ok(next.queue[0].feature === 'fm', '4.2 pushed queue[0].feature populated (not undefined)');
    ok(result.holders.length === 1 && result.holders[0].feature === 'fh', '4.2 holders reported with feature');
  });

  // 4.3 INV-5 — renew extends TTL; a non-holder renew → not-held (no overwrite).
  await group('4.3', () => {
    const c = defaultControl(1);
    c.slots[0].holder = held('S-h', T0);
    const r1 = decideRenew(c, { session: 'S-h', now: T0 + 10 * MIN, ttlMinutes: 30 });
    ok(r1.result.status === 'renewed' && r1.result.expiresAt === T0 + 10 * MIN + 30 * MIN, '4.3 renew extends TTL from now');
    const r2 = decideRenew(c, { session: 'S-other', now: T0 + 10 * MIN, ttlMinutes: 30 });
    ok(r2.result.status === 'not-held', '4.3 non-holder renew → not-held');
    ok(r2.next.slots[0].holder && r2.next.slots[0].holder.session === 'S-h', '4.3 non-holder renew does NOT overwrite');
  });

  // 4.4 INV-3 — release does NOT pop the queue; the head's next acquire claims the freed slot.
  await group('4.4', () => {
    const c = defaultControl(1);
    c.slots[0].holder = held('S-h', T0);
    c.queue = [qEntry('S-a', T0)];
    const rel = decideRelease(c, { session: 'S-h' });
    ok(rel.result.status === 'released' && rel.result.slotId === 1 && rel.next.slots[0].holder === null, '4.4 release clears the holder');
    ok(rel.next.queue.length === 1 && rel.next.queue[0].session === 'S-a', '4.4 release leaves the queue UNTOUCHED');
    const acq = decideAcquire(rel.next, aopts('S-a'));
    ok(acq.result.status === 'acquired' && acq.next.slots[0].holder.session === 'S-a' && acq.next.queue.length === 0, '4.4 head claims the freed slot on next acquire');
  });

  // 4.5 INV-3 — expired holder reaped → cleared + reported; next acquire reclaims.
  await group('4.5', () => {
    const c = defaultControl(1);
    c.slots[0].holder = held('S-old', T0, 30, { expiresAt: T0 });
    const rr = reapExpired(c, T0);
    ok(rr.next.slots[0].holder === null && rr.reaped.holders.includes(1), '4.5 expired holder reaped + reported');
    const acq = decideAcquire(c, aopts('S-new'));
    ok(acq.result.status === 'acquired', '4.5 next acquire reclaims the expired slot');
  });

  // 4.6 INV-3/4 — expired queue entry dropped; the live one becomes head and claims.
  await group('4.6', () => {
    const c = defaultControl(1);
    c.queue = [qEntry('S-dead', T0 - 1000, 0.5), qEntry('S-live', T0, 90)]; // dead head expires T0-500, live at T0+90s
    const rr = reapExpired(c, T0);
    ok(rr.reaped.queue.includes('S-dead') && !rr.reaped.queue.includes('S-live'), '4.6 expired queue entry dropped, live kept');
    const acq = decideAcquire(c, aopts('S-live'));
    ok(acq.result.status === 'acquired' && acq.next.queue.length === 0, '4.6 live head claims the free slot');
  });

  // 4.7 INV-1/11 — race: loser gets non-ff, re-reads, queues at #1; exactly one holder; writes===2.
  await group('4.7', async () => {
    const fake = makeFakeGit(defaultControl(1));
    fake._armConcurrent((cur) => { cur.slots[0].holder = held('S-winner', T0); return cur; });
    const r = await acquire(aopts('S-loser'), { cred: CRED, git: fake, deps: fixedDeps });
    ok(r.status === 'queued' && r.position === 1, '4.7 CAS loser re-reads and queues at #1');
    const fin = fake._remoteControl();
    const holders = fin.slots.filter((s) => s.holder);
    ok(holders.length === 1 && holders[0].holder.session === 'S-winner', '4.7 exactly one holder (the winner)');
    ok(fake.writes === 2, `4.7 writes===2 (winner + loser's queue) (got ${fake.writes})`);
  });

  // 4.8 INV-4 (N=1) — a non-head cannot jump a free slot (head-only degenerate).
  await group('4.8', () => {
    const c = defaultControl(1); // slot free
    c.queue = [qEntry('S-head', T0)];
    const { result } = decideAcquire(c, aopts('S-me'));
    ok(result.status === 'queued', '4.8 non-head cannot jump the free slot');
  });

  // 4.9 INV-2/11 — auth failure → acquire throws (never lease-less); message carries no token.
  await group('4.9', async () => {
    const fake = makeFakeGit(defaultControl(1));
    fake._armFail('auth');
    let threw = null;
    try { await acquire(aopts('S'), { cred: CRED, git: fake, deps: fixedDeps }); } catch (e) { threw = e; }
    ok(!!threw, '4.9 auth failure → acquire throws (does not proceed lease-less)');
    ok(threw && !String(threw.message).includes(CRED.token), '4.9 thrown message contains NO token substring');
    ok(fake.writes === 0, '4.9 nothing written on an auth failure');
  });

  // 4.10 INV-6 — already-holds → acquire renews the same slot, no self-queue.
  await group('4.10', () => {
    const c = defaultControl(1);
    c.slots[0].holder = held('S-me', T0);
    c.queue = [qEntry('S-me', T0)]; // stray self queue entry must be cleaned up
    const { next, result } = decideAcquire(c, aopts('S-me', { now: T0 + 5 * MIN, branch: 'b2', feature: 'f2' }));
    ok(result.status === 'acquired' && result.slot.id === 1, '4.10 already-holds → acquired (renew in place)');
    ok(next.slots[0].holder.expiresAt === T0 + 5 * MIN + 30 * MIN, '4.10 TTL refreshed from now');
    ok(next.slots[0].holder.branch === 'b2' && next.slots[0].holder.feature === 'f2', '4.10 branch/feature updated');
    ok(next.queue.length === 0, '4.10 no self-queue (stray entry cleaned)');
  });

  // 4.11 INV-4A — live poll past half-TTL refreshes expiresAt; a poll before half-TTL is a pure read.
  await group('4.11', () => {
    const c = defaultControl(1);
    c.slots[0].holder = held('S-busy', T0); // slot busy
    c.queue = [qEntry('S-me', T0, 90)];
    const before = decideAcquire(c, aopts('S-me', { now: T0 + 10000 })); // 10s in, 80s left > 45s half
    ok(deepEqual(before.next, c), '4.11 poll well before half-TTL → deepEqual(next,control) (no write)');
    const after = decideAcquire(c, aopts('S-me', { now: T0 + 50000 })); // 50s in, 40s left < 45s half
    ok(after.next.queue[0].expiresAt > c.queue[0].expiresAt, '4.11 past half-TTL → expiresAt refreshed');
    ok(after.next.queue[0].since === c.queue[0].since, '4.11 FIFO `since` untouched by the refresh');
  });

  // 4.12 INV-5 [R5] — release-by-branch clears the holder; a wrong-session release → not-held.
  await group('4.12', () => {
    const c = defaultControl(1);
    c.slots[0].holder = held('S-1', T0, 30, { branch: 'claude/wo-1' });
    const rel = decideRelease(c, { branch: 'claude/wo-1' });
    ok(rel.result.status === 'released' && rel.next.slots[0].holder === null, '4.12 release-by-branch clears the holder');
    const rel2 = decideRelease(c, { session: 'S-other' });
    ok(rel2.result.status === 'not-held' && rel2.next.slots[0].holder && rel2.next.slots[0].holder.session === 'S-1', '4.12 wrong-session release → not-held, no clear');
  });

  // 4.13 INV-4C — N=3 generalized FIFO (#ahead < #free) + fill-all-then-queue.
  await group('4.13', () => {
    // queue=[B,A], 2 free (slot3 busy) → A (ahead=1 < free=2) acquires.
    const c = freshN(3);
    c.slots[2].holder = held('S-x', T0);
    c.queue = [qEntry('B', T0), qEntry('A', T0)];
    const acqA = decideAcquire(c, aopts('A'));
    ok(acqA.result.status === 'acquired', '4.13 A (ahead=1 < free=2) acquires');
    // 1 free, 2 ahead → a fresh 3rd caller queues.
    const c2 = freshN(3);
    c2.slots[1].holder = held('S-y', T0);
    c2.slots[2].holder = held('S-z', T0);
    c2.queue = [qEntry('B', T0), qEntry('A', T0)];
    const acqC = decideAcquire(c2, aopts('C'));
    ok(acqC.result.status === 'queued', '4.13 fresh caller with 1 free + 2 ahead → queued');
    // 3 arrivals all acquire, 4th queues.
    let cc = freshN(3);
    const a1 = decideAcquire(cc, aopts('U1')); cc = a1.next;
    const a2 = decideAcquire(cc, aopts('U2')); cc = a2.next;
    const a3 = decideAcquire(cc, aopts('U3')); cc = a3.next;
    const a4 = decideAcquire(cc, aopts('U4'));
    ok(a1.result.status === 'acquired' && a2.result.status === 'acquired' && a3.result.status === 'acquired', '4.13 three arrivals fill all three slots');
    ok(a4.result.status === 'queued', '4.13 the fourth arrival queues');
  });

  // 4.14 INV-8 — corrupt read fails loudly (no overwrite); absent read bootstraps.
  await group('4.14', async () => {
    const fakeCorrupt = makeFakeGit('{ this is not json');
    let threw = null;
    try { await acquire(aopts('S'), { cred: CRED, git: fakeCorrupt, deps: fixedDeps }); } catch (e) { threw = e; }
    ok(threw && /reset/i.test(threw.message), '4.14 corrupt control → loud failure requiring reset');
    ok(fakeCorrupt.writes === 0, '4.14 corrupt read → NO overwrite');
    const fakeAbsent = makeFakeGit(null);
    const r = await acquire(aopts('S'), { cred: CRED, git: fakeAbsent, deps: fixedDeps });
    ok(r.status === 'acquired', '4.14 absent branch → bootstraps then acquires');
  });

  // 4.15 INV-7 — bootstrap race: a competing create wins, the loser adopts, one final holder.
  await group('4.15', async () => {
    const fake = makeFakeGit(null); // absent → our run will bootstrap
    fake._armConcurrent((cur) => cur || defaultControl(1)); // a competitor creates the branch first
    const r = await acquire(aopts('S-adopt'), { cred: CRED, git: fake, deps: fixedDeps });
    ok(r.status === 'acquired', '4.15 loser adopts the winner and still acquires');
    const fin = fake._remoteControl();
    ok(fin.slots.filter((s) => s.holder).length === 1 && fin.slots[0].holder.session === 'S-adopt', '4.15 exactly one holder after the bootstrap race');
  });

  // 4.16 INV-9 — an epoch advance between fetch and re-decide aborts loudly.
  await group('4.16', async () => {
    const fake = makeFakeGit(defaultControl(1));
    fake._armConcurrent((cur) => { cur.epoch = (cur.epoch || 0) + 1; cur.slots[0].holder = held('S-w', T0); return cur; });
    let threw = null;
    try { await acquire(aopts('S-me'), { cred: CRED, git: fake, deps: fixedDeps }); } catch (e) { threw = e; }
    ok(threw && /reset|epoch/i.test(threw.message), '4.16 epoch advance → abort with the reset message');
  });

  // 4.17 INV-12 — every commit stamps the committer identity; assertOnlyControlFileStaged rejects app files.
  await group('4.17', async () => {
    const fake = makeFakeGit(defaultControl(1));
    await acquire(aopts('S'), { cred: CRED, git: fake, deps: fixedDeps });
    ok(fake.commits.length >= 1 && fake.commits.every((c) => c.name === COMMIT_IDENTITY.name && c.email === COMMIT_IDENTITY.email), '4.17 every commit records the committer-identity pair');
    const fake2 = makeFakeGit(defaultControl(1));
    const dir = '/fake/clone';
    fake2.clone(CRED, dir);
    fake2._setStaged(dir, ['control.json', 'app.js']);
    let threw = null;
    try { assertOnlyControlFileStaged(dir, fake2); } catch (e) { threw = e; }
    ok(!!threw, '4.17 assertOnlyControlFileStaged rejects a staged app file');
  });

  // 4.18 INV-1 — commitControl on identical state → {ok,noop} (no empty commit); refetch uses FETCH_HEAD.
  await group('4.18', () => {
    const fake = makeFakeGit(defaultControl(1));
    const dir = '/fake/noop';
    fake.clone(CRED, dir);
    const cur = fake._remoteControl();
    const res = commitControl(dir, CRED, cur, 'noop-msg', fake.headSha(dir), fake);
    ok(res.ok && res.noop === true, '4.18 identical state → {ok,noop:true} (no empty commit)');
    ok(fake.commits.length === 0, '4.18 no commit recorded for a noop');
    // NOTE: this pair is a deliberate SOURCE-LINT guard (the no-network constraint means the
    // fake models neither FETCH_HEAD nor origin/<branch>), NOT a behavioral assertion — it
    // pins that realGit.refetch stays on FETCH_HEAD. 4.19 gives the origin-carrying-dir
    // invariant real behavioral coverage.
    const ctlSrc = readFileSync(new URL('../tools/lib/staging-control.mjs', import.meta.url), 'utf8');
    ok(/'reset',\s*'--hard',\s*'FETCH_HEAD'/.test(ctlSrc), '4.18 refetch resets --hard FETCH_HEAD');
    ok(!/'reset',\s*'--hard',\s*'origin\//.test(ctlSrc), '4.18 refetch does NOT reset to origin/<branch>');
  });

  // 4.19 INV-1/7 — the dir a bootstrap hands back MUST support a later CAS-retry refetch.
  // A `git init`'d seed dir has no `origin`; if bootstrapControl returned it, the winner's
  // FIRST lost CAS would fatal on `git fetch origin` (misreported as an auth HARD STOP).
  // bootstrapControl must therefore adopt its own push as a proper clone (origin present).
  await group('4.19', async () => {
    // (a) winner path: absent branch, no competitor → our seed push WINS the bootstrap.
    const fakeWin = makeFakeGit(null);
    const boot = bootstrapControl(CRED, fakeWin);
    let threw = null;
    try { refetchControl(boot.dir, CRED, fakeWin); } catch (e) { threw = e; }
    ok(!threw, '4.19 bootstrap-winner dir refetches without throwing (has origin)');

    // (b) end-to-end: win the bootstrap, then LOSE a CAS on the acquire write → the retry
    // must re-fetch + re-decide (INV-1/INV-11), never surface a fatal origin error.
    const fake = makeFakeGit(null);
    let armed = false;
    const origPush = fake.push.bind(fake);
    fake.push = function (cred, dir) {
      const r = origPush(cred, dir);
      // After our seed bootstrap push has won (branch now exists), arm ONE concurrent winner
      // so the NEXT push (our acquire write) loses the CAS and forces a refetch-driven retry.
      // Fill EVERY seeded slot (bootstrap seeds DEFAULT_N of them) so the re-decide has no free
      // slot to claim → the assertion's "queued at #1" holds regardless of N.
      if (r.ok && !armed) { armed = true; this._armConcurrent((cur) => { cur.slots.forEach((s, i) => { s.holder = held(`S-other-${i}`, T0); }); return cur; }); }
      return r;
    };
    const r = await acquire(aopts('S-win'), { cred: CRED, git: fake, deps: fixedDeps });
    ok(r.status === 'queued' && r.position === 1, '4.19 winner-then-lost-CAS re-fetches and queues (never a fatal origin throw)');
  });

  // 4.20 INV-2 — the porcelain CAS classifier is a PURE, directly-tested function (not a
  // tautology decided by the fake). A per-ref '!' line ⇒ raced; no '!' line ⇒ fatal. The
  // token-bearing `To <PAT-url>` line must neither be surfaced nor flip the classification.
  await group('4.20', () => {
    const TOKEN = 'ghp_SECRETTOKEN_must_never_leak_0000';
    const rejected =
      `To https://x-access-token:${TOKEN}@github.com/operations-jacrentals/rental-wrangler-staging.git\n` +
      '!\trefs/heads/staging-control:refs/heads/staging-control\t[rejected] (fetch first)\n' +
      'Done';
    const fatal =
      `fatal: unable to access 'https://x-access-token:${TOKEN}@github.com/...': Could not resolve host`;
    const cr = classifyPushFailure(rejected);
    const cf = classifyPushFailure(fatal);
    ok(cr.raced === true, '4.20 porcelain "!" ref line → raced:true');
    ok(cf.raced === false, '4.20 fatal blob with no "!" line → raced:false');
    // The classifier returns ONLY {raced} — the token-bearing stdout is never carried out.
    ok(!JSON.stringify(cr).includes(TOKEN) && !JSON.stringify(cf).includes(TOKEN), '4.20 classifier return carries NO token substring');
  });

  // 4.21 N=3 slot config — the data-flip: three lanes, each mapped to its OWN site repo, with
  // SLOT_URLS derived from SLOT_TARGETS (single source of truth, no drift). Guards that slot 1
  // still resolves to the ORIGINAL single staging URL (Jac's bookmark must never move) and that
  // an unconfigured slot throws rather than silently falling back to slot 1.
  await group('4.21', () => {
    ok(DEFAULT_N === 3, '4.21 DEFAULT_N === 3 (three lanes on)');

    const three = defaultControl(3);
    ok(three.slots.length === 3, '4.21 defaultControl(3) seeds three slots');
    ok(three.slots.map((s) => s.id).join(',') === '1,2,3', '4.21 slot ids are 1,2,3');
    ok(three.slots.every((s) => s.holder === null), '4.21 all three slots seed free (holder null)');

    // Slot 1 must stay byte-identical to the original single staging URL (bookmark stability).
    ok(SLOT_URLS[1] === 'https://operations-jacrentals.github.io/rental-wrangler-staging/',
      '4.21 slot 1 URL unchanged (…/rental-wrangler-staging/)');
    ok(three.slots[0].url === SLOT_URLS[1], '4.21 seeded slot 1 url === SLOT_URLS[1]');

    // SLOT_URLS is DERIVED from SLOT_TARGETS — assert they never drift.
    const urlIds = Object.keys(SLOT_URLS).map(Number).sort((a, b) => a - b);
    const tgtIds = Object.keys(SLOT_TARGETS).map(Number).sort((a, b) => a - b);
    ok(urlIds.join(',') === tgtIds.join(',') && urlIds.join(',') === '1,2,3', '4.21 SLOT_URLS ids === SLOT_TARGETS ids === 1,2,3');
    ok(urlIds.every((id) => SLOT_URLS[id] === pagesUrlForRepo(SLOT_TARGETS[id].repo)),
      '4.21 every SLOT_URLS[id] === pagesUrlForRepo(SLOT_TARGETS[id].repo) (no URL↔repo drift)');

    // Each slot maps to a DISTINCT repo (the whole point — no two lanes share a repo → no clobber).
    const repos = tgtIds.map((id) => SLOT_TARGETS[id].repo);
    ok(new Set(repos).size === 3, '4.21 the three slots map to three distinct repos');
    ok(slotTarget(1).repo === STAGING_REPO && slotTarget(1).branch === 'main', '4.21 slot 1 → STAGING_REPO#main (control-branch home)');
    ok(slotTarget(2).repo === 'operations-jacrentals/rental-wrangler-staging-2', '4.21 slot 2 → …-staging-2');
    ok(slotTarget(3).repo === 'operations-jacrentals/rental-wrangler-staging-3', '4.21 slot 3 → …-staging-3');
    ok(pagesUrlForRepo('operations-jacrentals/rental-wrangler-staging-2') === 'https://operations-jacrentals.github.io/rental-wrangler-staging-2/',
      '4.21 pagesUrlForRepo builds the project-Pages URL with a trailing slash');

    // Unconfigured slots throw — never a silent slot-1 fallback that would send a deploy to the
    // wrong repo or check the wrong URL.
    let threwT = null; try { slotTarget(4); } catch (e) { threwT = e; }
    ok(!!threwT, '4.21 slotTarget(4) throws (no silent fallback for an unconfigured slot)');
    let threwU = null; try { slotUrl(4); } catch (e) { threwU = e; }
    ok(!!threwU, '4.21 slotUrl(4) throws (BAD_SLOT for an unconfigured slot)');
  });

  // 4.22 SOURCE-LINT — deploy/promote consumers actually route by the acquired/served slot.
  // These are drift guards (the idiom of 4.18): the routing is network-side so it can't be
  // exercised here, but a revert to the hardcoded-repo / hardcoded-URL behaviour must fail CI.
  await group('4.22', () => {
    const deploySrc = readFileSync(new URL('../tools/deploy-staging.mjs', import.meta.url), 'utf8');
    ok(/slotTarget\(slot\.id\)/.test(deploySrc), '4.22 deploy resolves the acquired slot → slotTarget(slot.id)');
    ok(/stagingRemoteUrl\(cred,\s*target\.repo\)/.test(deploySrc), '4.22 deploy clones the acquired slot\'s repo (stagingRemoteUrl(cred, target.repo))');
    ok(/HEAD:refs\/heads\/\$\{target\.branch\}/.test(deploySrc), '4.22 deploy pushes to the acquired slot\'s branch');
    ok(!/stagingRemoteUrl\(cred\)\s*,\s*dir/.test(deploySrc), '4.22 deploy no longer clones the hardcoded default repo');

    const promoteSrc = readFileSync(new URL('../tools/promote.mjs', import.meta.url), 'utf8');
    ok(/resolveStagingSlotUrl\(expectedToken,\s*SLOT_ARG\)/.test(promoteSrc), '4.22 promote resolves the slot by trunk token / --slot');
    ok(/from '\.\/lib\/staging-control\.mjs'/.test(promoteSrc), '4.22 promote imports SLOT_URLS from the slot map');
    ok(!/const STAGING_URL\s*=/.test(promoteSrc), '4.22 promote no longer hardcodes a single STAGING_URL');
  });
}

await run();

const passed = results.filter((r) => r.ok).length;
results.forEach((r) => console.log(`${r.ok ? '  ✓' : '  ✗ FAIL:'} ${r.m}`));
const anyFail = results.some((r) => !r.ok);
console.log(`\n${anyFail ? '❌' : '✅'} Lease suite: ${passed}/${results.length} checks passed.`);
process.exit(anyFail ? 1 : 0);
