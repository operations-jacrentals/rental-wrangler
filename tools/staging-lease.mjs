#!/usr/bin/env node
// staging-lease.mjs — a git-native lease + waitlist over the shared staging environment.
//
// A counting semaphore of N slots (N=3 — three parallel staging lanes) lives in control.json
// on the `staging-control` branch of the staging repo. Two Claude sessions that both `/deploy`
// no longer clobber each other: each acquires its own slot (or auto-queues when all are held,
// and deploys when one frees) — every slot is an independent Pages site with its own URL. The
// only atomic primitive is git's non-fast-forward push rejection — see tools/lib/staging-control.mjs.
//
// This file is the CLI (`acquire|renew|release|status|reset|init`) + the pure decision core
// (decide*) + the async orchestration loop (fetch → decide → commit-or-retry).
//
// LEASE MODEL (the review budget): a holder keeps its slot for `ttlMinutes` (default 30) since
// its last `renew` — a holder does NO work during Jac's review, so a long review must re-run
// `/deploy` (idempotent — clause (0) below renews in place) to refresh. A waiter keeps its
// queue place for `queueTtlSeconds` (default 90 ≈ 3× the 30 s poll) since its last poll — a
// live waiter proves liveness by polling; a dead one is reaped within 90 s. Both TTLs are the
// in-file source of truth (control.json), configurable there. `reset --force` is a loud,
// stop-the-world manual-recovery op: it can drop a concurrent acquire and wipe an in-flight
// holder (whose next `renew` then returns `not-held`).

import { pathToFileURL } from 'node:url';
import {
  reapExpired, defaultControl, makeControlPort, resetControl, fetchControl, disposeControlDir,
  realGit, DEFAULT_N,
} from './lib/staging-control.mjs';
import { git as plainGit, resolveCredential } from './lib/staging-git.mjs';

const MS_PER_MIN = 60000;

// ── small utilities ──

function clone(x) { return JSON.parse(JSON.stringify(x)); }

// Structural deep-equality (order-independent for objects) — the orchestration no-op guard.
// A ref/shallow compare would spuriously write on a pure-read poll and could livelock retries.
export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return false;
  const aArr = Array.isArray(a); const bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a); const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

function last4(session) { return String(session || '').slice(-4) || '????'; }

// ── pure decision core (§2) — no I/O; `now` is a parameter; each deep-clones its input ──

// reapExpired is imported (shared with the substrate) and re-exported for the tests.
export { reapExpired };

export function decideAcquire(control, { session, branch, feature, now, ttlMinutes, queueTtlSeconds }) {
  const c = reapExpired(control, now).next; // already a deep clone
  const holderTtl = ttlMinutes * MS_PER_MIN;
  const queueTtl = queueTtlSeconds * 1000;

  // (0) Already hold a slot → renew in place. A re-deploy must NEVER queue behind itself.
  const held = c.slots.find((s) => s.holder && s.holder.session === session);
  if (held) {
    held.holder.renewedAt = now;
    held.holder.expiresAt = now + holderTtl;
    held.holder.branch = branch;
    held.holder.feature = feature;
    c.queue = c.queue.filter((q) => q.session !== session);
    return { next: c, result: { status: 'acquired', slot: { id: held.id, url: held.url } } };
  }

  // (1) Generalized FIFO ([R6]): eligible iff #ahead < #free.
  const free = c.slots.filter((s) => s.holder === null).sort((a, b) => a.id - b.id);
  const qIdx = c.queue.findIndex((q) => q.session === session);
  const ahead = qIdx === -1 ? c.queue.length : qIdx;
  if (free.length > 0 && ahead < free.length) {
    const s = free[0];
    s.holder = { session, branch, feature, acquiredAt: now, renewedAt: now, expiresAt: now + holderTtl };
    c.queue = c.queue.filter((q) => q.session !== session);
    return { next: c, result: { status: 'acquired', slot: { id: s.id, url: s.url } } };
  }

  // (2) Queue (idempotent) + refresh OUR liveness IN PLACE (never re-append → preserves FIFO).
  const exp = now + queueTtl;
  if (qIdx === -1) {
    c.queue.push({ session, branch, feature, since: now, expiresAt: exp });
  } else if (c.queue[qIdx].expiresAt - now < queueTtl / 2) {
    c.queue[qIdx].expiresAt = exp; // lazy: only past half-TTL; `since` untouched
  }
  const position = c.queue.findIndex((q) => q.session === session) + 1;
  const holders = c.slots
    .filter((s) => s.holder)
    .map((s) => ({ slotId: s.id, session: s.holder.session, feature: s.holder.feature, expiresAt: s.holder.expiresAt }));
  const etaMs = holders.length ? Math.min(...holders.map((h) => h.expiresAt)) - now : null;
  const aheadList = c.queue.slice(0, position - 1).map((q) => ({ session: q.session, feature: q.feature }));
  return {
    next: c,
    result: { status: 'queued', position, etaMs, queueLen: c.queue.length, holders, ahead: aheadList },
  };
}

export function decideRenew(control, { session, now, ttlMinutes }) {
  const c = reapExpired(control, now).next;
  const s = c.slots.find((x) => x.holder && x.holder.session === session);
  if (!s) return { next: c, result: { status: 'not-held' } };
  s.holder.renewedAt = now;
  s.holder.expiresAt = now + ttlMinutes * MS_PER_MIN;
  return { next: c, result: { status: 'renewed', slotId: s.id, expiresAt: s.holder.expiresAt } };
}

export function decideRelease(control, { session, branch, slot, force } = {}) {
  const c = clone(control);
  if (!Array.isArray(c.slots)) throw new Error('staging-control: control.slots is not an array — run reset.');
  if (!Array.isArray(c.queue)) c.queue = [];

  if (force) {
    if (!Number.isInteger(slot)) {
      throw new Error('staging-lease: `release --force` requires `--slot N` — refusing a silent self-release.');
    }
    const s = c.slots.find((x) => x.id === slot);
    if (!s) throw new Error(`staging-lease: no slot with id ${slot}.`);
    const prior = s.holder;
    s.holder = null;
    return { next: c, result: { status: 'force-cleared', slotId: slot, forced: !!(prior && prior.session !== session) } };
  }

  // self / hook path — match by session OR branch ([R5]).
  const s = c.slots.find((x) => x.holder && ((session && x.holder.session === session) || (branch && x.holder.branch === branch)));
  if (!s) return { next: c, result: { status: 'not-held' } };
  const slotId = s.id;
  s.holder = null; // clears ONLY this slot; queue UNTOUCHED (no queue advance on release)
  return { next: c, result: { status: 'released', slotId } };
}

// ── async orchestration (§2) ──

export const defaultDeps = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  maxRetries: 5,
  backoffMs: 300,
  rng: Math.random,
};

// One CAS transaction: fetch → decide → (no-op | commit | retry). Threads the in-file TTLs
// into the pure decide fn; captures startEpoch and aborts loudly if a later fetch shows a
// bumped epoch (a deliberate reset happened under us, [R10]).
async function orchestrate(port, decideFn, opts, deps, mkMsg) {
  const d = { ...defaultDeps, ...deps };
  let startEpoch = null;
  for (let attempt = 0; attempt <= d.maxRetries; attempt++) {
    const { control, baseSha, epoch } = await port.read();
    if (startEpoch === null) startEpoch = epoch;
    else if (epoch !== startEpoch) {
      throw new Error('staging-control was reset (epoch advanced) — re-run /deploy.');
    }
    const now = d.now();
    const merged = { ...opts, now, ttlMinutes: control.ttlMinutes, queueTtlSeconds: control.queueTtlSeconds };
    const { next, result } = decideFn(control, merged);
    if (deepEqual(next, control)) return result; // pure read (poll no-op) → NO write
    const w = await port.write(next, baseSha, mkMsg(result, opts)); // throws on fatal auth/network
    if (w.ok) return result;
    // w.raced — a concurrent writer won; jittered bounded backoff, then re-fetch + re-decide.
    await d.sleep(d.backoffMs * (attempt + 1) + d.rng() * d.backoffMs);
  }
  const e = new Error('staging-control: lease contention — could not commit after retries. Re-run.');
  e.code = 'LEASE_CONTENTION';
  throw e;
}

function runOp(decideFn, opts, { cred, git = realGit, deps = {} } = {}, mkMsg) {
  const port = makeControlPort(cred, git);
  return (async () => {
    try { return await orchestrate(port, decideFn, opts, deps, mkMsg); }
    finally { port.dispose(); }
  })();
}

export function acquire(opts, io = {}) {
  return runOp(decideAcquire, opts, io, (result, o) =>
    result.status === 'acquired'
      ? `staging-control: acquire slot ${result.slot.id} by …${last4(o.session)} (${o.branch || '?'})`
      : `staging-control: queue …${last4(o.session)} (${o.branch || '?'})`);
}
export function renew(opts, io = {}) {
  return runOp(decideRenew, opts, io, (result, o) =>
    `staging-control: renew by …${last4(o.session)}`);
}
export function release(opts, io = {}) {
  return runOp(decideRelease, opts, io, (result, o) =>
    result.status === 'force-cleared'
      ? `staging-control: force-clear slot ${result.slotId}`
      : `staging-control: release slot ${result.slotId ?? '?'} (${o.branch || `…${last4(o.session)}`})`);
}

// ── CLI ──

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') out.force = true;
    else if (a === '--slot') out.slot = parseInt(argv[++i], 10);
    else if (a === '--slots') out.slots = parseInt(argv[++i], 10);
    else if (a === '--branch') out.branch = argv[++i];
    else if (a === '--feature') out.feature = argv[++i];
    else if (a === '--session') out.session = argv[++i];
    else out._.push(a);
  }
  return out;
}

function fmtTs(ms) {
  if (typeof ms !== 'number') return '—';
  return new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}
function relMin(ms, now) {
  if (typeof ms !== 'number') return '';
  const m = Math.ceil((ms - now) / MS_PER_MIN);
  return m > 0 ? `~${m} min` : 'expired';
}

function printStatus(control) {
  const now = Date.now();
  console.log(`staging-control: version ${control.version}, epoch ${control.epoch}, ttl ${control.ttlMinutes} min / queue ttl ${control.queueTtlSeconds} s`);
  for (const s of control.slots) {
    if (!s.holder) {
      console.log(`  slot ${s.id}: FREE   ${s.url}`);
    } else {
      const h = s.holder;
      console.log(`  slot ${s.id}: HELD by …${last4(h.session)} (${h.feature || h.branch || '?'}), expires ${fmtTs(h.expiresAt)} (${relMin(h.expiresAt, now)})`);
    }
  }
  if (!control.queue.length) {
    console.log('  queue: empty');
  } else {
    console.log(`  queue (${control.queue.length}):`);
    control.queue.forEach((q, i) => console.log(`    #${i + 1} …${last4(q.session)} (${q.feature || q.branch || '?'}), keep-alive ${relMin(q.expiresAt, now)}`));
  }
}

function deriveBranch() {
  try { return plainGit(['rev-parse', '--abbrev-ref', 'HEAD']); } catch { return ''; }
}
function deriveFeature(branch) {
  if (!branch) return null;
  const tail = branch.split('/').pop();
  return tail || null;
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const cmd = argv._[0] || 'status';
  const SESSION = argv.session || process.env.CLAUDE_CODE_SESSION_ID || '';
  const branch = argv.branch || deriveBranch();
  const feature = argv.feature || deriveFeature(branch);

  const cred = resolveCredential();
  if (!cred) {
    console.log('staging-lease: no staging deploy credential configured (STAGING_DEPLOY_KEY_PATH / STAGING_DEPLOY_PAT).');
    console.log('               Nothing touched. Set a credential and re-run.');
    return 0;
  }

  const MUTATING = ['acquire', 'renew', 'release'];
  if (MUTATING.includes(cmd) && !SESSION && !(cmd === 'release' && argv.branch)) {
    // empty/unset session hard-fails on any mutating op — never a null-session holder that
    // only TTL can free. (release --branch is the one session-free mutating path, [R5].)
    console.error('staging-lease: CLAUDE_CODE_SESSION_ID is empty — refusing a session-less mutating op.');
    return 1;
  }

  if (cmd === 'acquire') {
    const r = await acquire({ session: SESSION, branch, feature }, { cred });
    if (r.status === 'acquired') {
      console.log(`staging-lease: ✅ acquired slot ${r.slot.id} → ${r.slot.url}`);
      return 0;
    }
    const eta = typeof r.etaMs === 'number' ? relMin(Date.now() + r.etaMs, Date.now()) : 'unknown';
    console.log(`staging-lease: 🔒 all slots busy — queued at #${r.position} (${r.queueLen} in line), soonest free ${eta}.`);
    return 0;
  }
  if (cmd === 'renew') {
    const r = await renew({ session: SESSION }, { cred });
    if (r.status === 'renewed') { console.log(`staging-lease: renewed slot ${r.slotId}, expires ${fmtTs(r.expiresAt)}.`); return 0; }
    console.error('staging-lease: ⚠️ not-held — this session no longer holds a slot (TTL-reclaimed?). Re-run /deploy.');
    return 1;
  }
  if (cmd === 'release') {
    const r = await release({ session: SESSION, branch: argv.branch, slot: argv.slot, force: argv.force }, { cred });
    if (r.status === 'released') console.log(`staging-lease: released slot ${r.slotId}.`);
    else if (r.status === 'force-cleared') console.log(`staging-lease: force-cleared slot ${r.slotId}${r.forced ? ' (evicted another holder)' : ''}.`);
    else console.log('staging-lease: nothing to release (no matching holder).');
    return 0;
  }
  if (cmd === 'status') {
    const port = makeControlPort(cred, realGit);
    try { const { control } = await port.read(); printStatus(control); } finally { port.dispose(); }
    return 0;
  }
  if (cmd === 'init') {
    // create-or-adopt: fetchControl bootstraps an absent branch, adopts an existing one.
    const f = fetchControl(cred, realGit);
    try { console.log('staging-lease: control branch ready.'); printStatus(f.control); } finally { disposeControlDir(f.dir); }
    return 0;
  }
  if (cmd === 'reset') {
    const n = Number.isInteger(argv.slots) && argv.slots > 0 ? argv.slots : DEFAULT_N;
    // reset is the ONLY writer that bumps epoch ([R10]) — read the current epoch best-effort.
    let curEpoch = -1;
    try {
      const f = fetchControl(cred, realGit);
      try { curEpoch = f.control.epoch; } finally { disposeControlDir(f.dir); }
    } catch { /* absent/corrupt — start epoch at 0 */ }
    const seed = defaultControl(n);
    seed.epoch = curEpoch + 1;
    console.error('staging-lease: ⚠️ reset — force-rewriting control.json (stop-the-world; can drop a concurrent acquire).');
    const res = resetControl(cred, realGit, seed);
    console.log(`staging-lease: reset done (epoch ${seed.epoch}, ${n} slot(s)).`);
    printStatus(res.control);
    return 0;
  }

  console.error(`staging-lease: unknown command '${cmd}'. Use acquire|renew|release|status|reset|init.`);
  return 1;
}

// main-guard — only run the CLI when invoked directly, not when imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code || 0)).catch((e) => {
    console.error(e && e.message ? e.message : String(e));
    process.exit(e && e.code === 'LEASE_CONTENTION' ? 3 : 1);
  });
}
