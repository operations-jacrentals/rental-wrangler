// lease-deploy-test.mjs — deploy-integration (Step 7) tests for staging traffic control.
//
// NO network, NO browser, NO Playwright — this is NOT part of the port-8000→9147 swap. It
// imports the EXPORTED deploy seams (acquireSlotOrQueue / contentionBanner / queueProgressLine
// / queueTimeoutMessage / assertSlotShape) with EVERY effect injected (lease/sleep/now/log/exit),
// so the acquire→queue→watchdog→banner logic runs end-to-end without ever touching the staging
// remote. The one subprocess case (C-7) runs `deploy-staging.mjs --dry-run`, which is network-free
// by contract and whose only side effect (bumping index.html) is snapshotted + restored byte-exact.
//
// Covers §7 cases C-1..C-7. Reporting idiom mirrors ci/logic-test.mjs / ci/lease-test.mjs:
// collect {ok,m}, print ✓/✗, process.exit(anyFail?1:0).

import {
  acquireSlotOrQueue, contentionBanner, queueProgressLine, queueTimeoutMessage, assertSlotShape,
} from '../tools/deploy-staging.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const T0 = 1752800000000;
const MIN = 60000;
const ROOT = fileURLToPath(new URL('../', import.meta.url));

const results = [];
const ok = (c, m) => results.push({ ok: !!c, m });
async function group(label, fn) {
  try { await fn(); }
  catch (e) { ok(false, `${label} — UNEXPECTED THROW: ${e && e.message || e}`); }
}

// ── injected effects: a fully in-memory lease + deterministic sleep/now/log/exit ──

// A fake lease.acquire() driven by a script of steps. Each step is a result object or
// { throw: <error> }; when the script is exhausted the LAST step repeats (so a watchdog case
// can poll a stuck position forever). Records the call count.
function makeLease(steps) {
  let i = 0;
  return {
    calls: 0,
    async acquire() {
      this.calls++;
      const step = steps[Math.min(i, steps.length - 1)];
      i++;
      if (step && step.throw) throw step.throw;
      return step;
    },
  };
}

function makeDeps(overrides = {}) {
  const logs = [];
  const sleeps = [];
  const exits = [];
  const deps = {
    sleep: async (ms) => { sleeps.push(ms); },
    now: () => T0,
    log: (...a) => logs.push(a.join(' ')),
    exit: (code) => { exits.push(code); },
    pollMs: 0,
    watchdogMs: 1_000_000_000, // effectively off unless a case overrides it
    ...overrides,
  };
  return { deps, logs, sleeps, exits };
}

const SLOT = { id: 1, url: 'https://staging.example/slot-1/' };
const acquired = (slot = SLOT) => ({ status: 'acquired', slot });
const queued = (position, extra = {}) => ({
  status: 'queued',
  position,
  queueLen: extra.queueLen ?? position,
  etaMs: extra.etaMs ?? 5 * MIN,
  holders: extra.holders ?? [{ slotId: 1, session: 'sess-abcd', feature: 'wo-658', expiresAt: T0 + 14 * MIN }],
  ahead: extra.ahead ?? [],
});
const leaseContentionErr = () => Object.assign(new Error('staging-control: lease contention — could not commit after retries.'), { code: 'LEASE_CONTENTION' });
const authErr = () => new Error('staging-control: git push against the staging remote failed (message withheld — it may echo the credential).');

const AOPTS = { session: 'sess-abcd', branch: 'claude/wo-658', feature: 'wo-658' };
const countIncluding = (arr, sub) => arr.filter((l) => l.includes(sub)).length;

// ── the cases ──

async function run() {
  // C-0 — assertSlotShape guards the deploy target (extra coverage for the exported seam).
  await group('C-0', () => {
    ok(assertSlotShape({ id: 1, url: 'https://x/' }).id === 1, 'C-0 valid slot passes assertSlotShape');
    for (const bad of [null, undefined, {}, { id: 1 }, { id: 'x', url: 'u' }, { id: 1, url: '' }, { id: 1, url: 5 }]) {
      let threw = null;
      try { assertSlotShape(bad); } catch (e) { threw = e; }
      ok(!!threw, `C-0 malformed slot ${JSON.stringify(bad)} → throws`);
    }
  });

  // C-1 — free slot returns immediately (zero sleeps); busy→frees queues twice then acquires,
  //       banner exactly once.
  await group('C-1', async () => {
    // free slot
    const lease1 = makeLease([acquired()]);
    const { deps: d1, sleeps: s1, logs: l1 } = makeDeps();
    const slot1 = await acquireSlotOrQueue(AOPTS, { lease: lease1, ...d1 });
    ok(slot1 && slot1.id === 1, 'C-1 free slot → returns the slot');
    ok(s1.length === 0, 'C-1 free slot → zero sleeps');
    ok(countIncluding(l1, '🔒') === 0, 'C-1 free slot → no contention banner');

    // busy → frees
    const lease2 = makeLease([queued(1), queued(1), acquired()]);
    const { deps: d2, sleeps: s2, logs: l2 } = makeDeps();
    const slot2 = await acquireSlotOrQueue(AOPTS, { lease: lease2, ...d2 });
    ok(slot2 && slot2.id === 1, 'C-1 busy→frees → eventually acquires the slot');
    ok(countIncluding(l2, '🔒') === 1, 'C-1 contention banner printed exactly once');
    ok(countIncluding(l2, 'still #') === 1, 'C-1 progress line printed on the repeat poll');
    ok(s2.length === 2, 'C-1 slept once per queued poll (2)');
  });

  // C-2 — contention DURING the wait: transient LEASE_CONTENTION is ridden out (not aborted);
  //       once a slot frees the wait resolves acquired.
  await group('C-2', async () => {
    const lease = makeLease([{ throw: leaseContentionErr() }, { throw: leaseContentionErr() }, acquired()]);
    const { deps, sleeps, logs } = makeDeps();
    const slot = await acquireSlotOrQueue(AOPTS, { lease, ...deps });
    ok(slot && slot.id === 1, 'C-2 LEASE_CONTENTION ridden out → still acquires');
    ok(sleeps.length === 2, 'C-2 slept once per contention poll (2), wait not aborted');
    ok(countIncluding(logs, '🔒') === 0, 'C-2 never queued (contention, not a queued result) → no banner');
  });

  // C-3 — watchdog: a falling position keeps the wait alive (deadline resets); a position
  //       stalled past the watchdog window ends the wait with queueTimeoutMessage + exit(3).
  await group('C-3', async () => {
    const steps = [queued(3), queued(2), queued(1), queued(1), queued(1)]; // last repeats
    const clock = [0, 40, 80, 150, 250];
    let ci = 0;
    const now = () => clock[Math.min(ci++, clock.length - 1)];
    const lease = makeLease(steps);
    const { deps, sleeps, logs, exits } = makeDeps({ now, watchdogMs: 100 });
    const ret = await acquireSlotOrQueue(AOPTS, { lease, ...deps });
    ok(ret === undefined, 'C-3 watchdog path returns nothing (never acquired)');
    ok(exits.length === 1 && exits[0] === 3, 'C-3 exits with code 3 (busy, not broken)');
    ok(countIncluding(logs, 'no forward progress') === 1, 'C-3 prints queueTimeoutMessage once');
    ok(sleeps.length === 4, 'C-3 slept through the 4 progressing/holding polls, exited on the 5th');
    // Prove the falling positions (3→2→1) did NOT trip the 100-unit watchdog early.
    ok(countIncluding(logs, '🔒') === 1, 'C-3 banner once; the decreasing positions kept it waiting');
  });

  // C-4 — UX strings: empty-holders queued state, holder-present banner, progress line,
  //       session last-4, minutes-CEIL.
  await group('C-4', () => {
    // empty holders — "a slot is free but N ahead", never "Slot undefined".
    const emptyBanner = contentionBanner(queued(2, { holders: [], queueLen: 2 }), T0);
    ok(emptyBanner.includes('a slot is free'), 'C-4 empty-holders → "a slot is free"');
    ok(emptyBanner.includes('1 ahead'), 'C-4 empty-holders → correct ahead count (position-1)');
    ok(!emptyBanner.includes('undefined'), 'C-4 empty-holders → never renders "undefined"');

    // holder present — Slot id, session last-4, feature, minutes CEIL (13.5 min → 14).
    const heldBanner = contentionBanner(
      queued(1, { queueLen: 1, holders: [{ slotId: 1, session: 'zzz-abcd', feature: 'wo-658', expiresAt: T0 + 13 * MIN + 30000 }] }),
      T0,
    );
    ok(heldBanner.includes('Slot 1 held by …abcd'), 'C-4 holder banner names "Slot 1 held by …abcd" (session last-4)');
    ok(heldBanner.includes('(wo-658)'), 'C-4 holder banner names the feature');
    ok(heldBanner.includes('~14 min'), 'C-4 holder banner ceils 13.5 min → ~14 min');
    ok(heldBanner.includes('Queued you at #1 (1 in line)'), 'C-4 holder banner reports queue position + length');

    // progress line
    const prog = queueProgressLine(queued(2, { queueLen: 3, etaMs: 5 * MIN - 1 }), T0);
    ok(prog.includes('still #2 of 3'), 'C-4 progress line reports "#2 of 3"');
    ok(prog.includes('~5 min'), 'C-4 progress line ceils the ETA (4m59s → ~5 min)');

    // timeout message
    const tmsg = queueTimeoutMessage(queued(1));
    ok(/BUSY/i.test(tmsg) && /do NOT rotate the PAT/i.test(tmsg), 'C-4 timeout message reads busy-not-broken (do not rotate PAT)');
  });

  // C-5 — a genuine auth throw propagates (never deploys lease-less).
  await group('C-5', async () => {
    const err = authErr();
    const lease = makeLease([{ throw: err }]);
    const { deps } = makeDeps();
    let threw = null;
    let slot = 'still-unset';
    try { slot = await acquireSlotOrQueue(AOPTS, { lease, ...deps }); } catch (e) { threw = e; }
    ok(threw === err, 'C-5 auth throw propagates out of acquireSlotOrQueue');
    ok(slot === 'still-unset', 'C-5 never returns a slot on an auth throw (never deploys lease-less)');
  });

  // C-6 — idempotent same-session: an already-holder acquire returns the same slot, no queue.
  await group('C-6', async () => {
    const lease = makeLease([acquired(SLOT)]); // decideAcquire clause (0) renews in place → 'acquired'
    const { deps, sleeps, logs } = makeDeps();
    const slot = await acquireSlotOrQueue(AOPTS, { lease, ...deps });
    ok(slot && slot.id === 1, 'C-6 already-holder → returned the same slot');
    ok(lease.calls === 1, 'C-6 resolved on the first acquire (no re-poll)');
    ok(sleeps.length === 0 && countIncluding(logs, '🔒') === 0, 'C-6 no queue, no sleep, no banner');
  });

  // C-7 — --dry-run performs NO lease/network call: bumps index.html locally then stops.
  await group('C-7', () => {
    const indexPath = fileURLToPath(new URL('../index.html', import.meta.url));
    const before = readFileSync(indexPath, 'utf8');
    let out = '';
    let code = 0;
    try {
      const env = { ...process.env, STAGING_DEPLOY_PAT: 'x-dry-run-not-used' };
      delete env.STAGING_DEPLOY_KEY_PATH; // force the PAT branch; dry-run never sends it
      out = execFileSync('node', ['tools/deploy-staging.mjs', '--dry-run'], { cwd: ROOT, env, encoding: 'utf8' });
    } catch (e) {
      code = e.status ?? 1;
      out = (e.stdout || '') + (e.stderr || '');
    } finally {
      writeFileSync(indexPath, before); // restore the bump byte-exact — never leave the tree dirty
    }
    ok(code === 0, 'C-7 --dry-run exits 0');
    ok(/no lease acquired/.test(out), 'C-7 --dry-run explicitly acquires NO lease');
    ok(/bumped shared \?v=/.test(out), 'C-7 --dry-run still bumps ?v= locally');
    ok(!/holding slot/.test(out) && !/cloning/.test(out) && !out.includes('🔒'), 'C-7 --dry-run never acquires/clones/queues (no network)');
  });
}

await run();

const passed = results.filter((r) => r.ok).length;
results.forEach((r) => console.log(`${r.ok ? '  ✓' : '  ✗ FAIL:'} ${r.m}`));
const anyFail = results.some((r) => !r.ok);
console.log(`\n${anyFail ? '❌' : '✅'} Lease-deploy suite: ${passed}/${results.length} checks passed.`);
process.exit(anyFail ? 1 : 0);
