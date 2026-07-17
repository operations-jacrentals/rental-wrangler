// staging-control.mjs — the disposable coordination state for staging traffic control.
//
// Owns:
//   - the control.json schema + canonical (byte-stable) serialization,
//   - defaultControl / parseControl / validateControl / serialize / slotUrl / reapExpired,
//   - the git-native compare-and-swap (CAS) primitives — remoteControlSha, fetchControl,
//     commitControl, bootstrapControl, assertOnlyControlFileStaged — each taking an
//     INJECTABLE git runner (`git = realGit`) as its last arg so the whole substrate is
//     testable with zero network (see ci/lease-test.mjs's makeFakeGit),
//   - self-disposing random temp dirs + atomic advisory-marker I/O.
//
// The only atomic primitive is git's non-fast-forward push rejection. Every state change
// is exactly one commit on the fetched baseSha + one push of that single control.json to
// the `staging-control` branch, so a crash leaves the remote fully-updated or untouched —
// no representable half-state. See the plan §3 / §6 for the full invariant list.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import {
  git as plainGit, gitTry, lines, gitAuthed, gitAuthedTry, stagingRemoteUrl,
} from './staging-git.mjs';

// ── constants ──

export const STAGING_CONTROL_BRANCH = 'staging-control';
export const CONTROL_FILE = 'control.json';
export const CONTROL_VERSION = 1;
export const DEFAULT_TTL_MINUTES = 30;      // holder TTL — a holder does no work during Jac's review
export const DEFAULT_QUEUE_TTL_SECONDS = 90; // waiter TTL (~3× the 30 s poll) — a live waiter proves liveness by polling
export const DEFAULT_N = 1;                   // slot count today (single staging URL)

// slot id → its own Pages URL. N=1 today; N=3 is a data change here + provisioning.
export const SLOT_URLS = {
  1: 'https://operations-jacrentals.github.io/rental-wrangler-staging/',
};

// Explicit committer identity — there is NO ambient git identity on a clean container, so
// every control commit stamps this pair via `-c user.name=/-c user.email=`.
export const COMMIT_IDENTITY = { name: 'staging-control', email: 'staging-control@jacrentals' };

// The advisory marker (diagnostic-only, gitignored, never trusted for eviction).
export const MARKER_FILE = '.staging-lease.json';

// ── typed error ──

export class ControlError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ControlError';
    this.code = code || 'CORRUPT_CONTROL';
  }
}

// ── schema helpers ──

export function slotUrl(id) {
  const u = SLOT_URLS[id];
  if (!u) throw new ControlError(`staging-control: no URL configured for slot ${id}`, 'BAD_SLOT');
  return u;
}

export function defaultControl(n = DEFAULT_N) {
  const slots = [];
  for (let id = 1; id <= n; id++) slots.push({ id, url: slotUrl(id), holder: null });
  return {
    version: CONTROL_VERSION,
    epoch: 0,
    ttlMinutes: DEFAULT_TTL_MINUTES,
    queueTtlSeconds: DEFAULT_QUEUE_TTL_SECONDS,
    slots,
    queue: [],
  };
}

// Canonical serialization — byte-identical output for identical state (no spurious commits,
// clean diffs). Deep-clone-via-JSON in the pure decide* functions preserves key order, so
// two identical states serialize to identical bytes.
export function serialize(control) {
  return JSON.stringify(control, null, 2) + '\n';
}

function isInt(x) { return typeof x === 'number' && Number.isFinite(x) && Math.floor(x) === x; }

export function validateControl(control) {
  if (!control || typeof control !== 'object' || Array.isArray(control)) {
    throw new ControlError('control.json is not an object', 'CORRUPT_CONTROL');
  }
  if (control.version !== CONTROL_VERSION) {
    throw new ControlError(
      `control.json version ${control.version} is not understood (expected ${CONTROL_VERSION}) — run \`staging-lease reset\`.`,
      'CORRUPT_CONTROL',
    );
  }
  if (!isInt(control.epoch)) throw new ControlError('control.epoch must be an integer', 'CORRUPT_CONTROL');
  if (!(typeof control.ttlMinutes === 'number' && control.ttlMinutes > 0)) {
    throw new ControlError('control.ttlMinutes must be a positive number', 'CORRUPT_CONTROL');
  }
  if (!(typeof control.queueTtlSeconds === 'number' && control.queueTtlSeconds > 0)) {
    throw new ControlError('control.queueTtlSeconds must be a positive number', 'CORRUPT_CONTROL');
  }
  if (!Array.isArray(control.slots) || control.slots.length === 0) {
    throw new ControlError('control.slots must be a non-empty array', 'CORRUPT_CONTROL');
  }
  for (const s of control.slots) {
    if (!s || typeof s !== 'object') throw new ControlError('a slot is not an object', 'CORRUPT_CONTROL');
    if (!isInt(s.id)) throw new ControlError('slot.id must be an integer', 'CORRUPT_CONTROL');
    if (typeof s.url !== 'string' || !s.url) throw new ControlError('slot.url must be a string', 'CORRUPT_CONTROL');
    if (!(s.holder === null || (s.holder && typeof s.holder === 'object'))) {
      throw new ControlError('slot.holder must be null or an object', 'CORRUPT_CONTROL');
    }
  }
  if (!Array.isArray(control.queue)) throw new ControlError('control.queue must be an array', 'CORRUPT_CONTROL');
  return control;
}

// Parse raw control.json text. Distinguishes CORRUPT (unparseable / bad shape / unknown
// version — fail loudly, require reset) from ABSENT (raw === null → caller may bootstrap).
export function parseControl(raw) {
  if (raw == null) return null;
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new ControlError('control.json is not valid JSON — run `staging-lease reset`.', 'CORRUPT_CONTROL');
  }
  return validateControl(obj);
}

// ── reap (shared pure helper) ──

// Reap expired holders (holder.expiresAt <= now → cleared) then expired queue entries
// (expiresAt <= now → dropped). Deep-clones its input; never mutates the caller's object.
// Correctness never depends on a reap being persisted — the next reader re-derives it.
export function reapExpired(control, nowMs) {
  const next = JSON.parse(JSON.stringify(control));
  const reaped = { holders: [], queue: [] };
  for (const s of next.slots) {
    if (s.holder && typeof s.holder.expiresAt === 'number' && s.holder.expiresAt <= nowMs) {
      reaped.holders.push(s.id);
      s.holder = null;
    }
  }
  next.queue = (next.queue || []).filter((q) => {
    const dead = typeof q.expiresAt === 'number' && q.expiresAt <= nowMs;
    if (dead) reaped.queue.push(q.session);
    return !dead;
  });
  return { next, reaped };
}

// ── disposable temp dirs ──

// Random-suffixed to avoid same-ms collision between two first-runners on one host.
export function newControlDir() {
  const dir = join(tmpdir(), `rw-staging-control-${process.pid}-${Date.now()}-${randomBytes(4).toString('hex')}`);
  rmSync(dir, { recursive: true, force: true });
  return dir;
}
export function disposeControlDir(dir) {
  if (dir) rmSync(dir, { recursive: true, force: true });
}

// ── advisory marker I/O (atomic temp + rename; diagnostic-only, gitignored) ──

let _markerRoot = null;
function markerRoot() {
  if (_markerRoot == null) _markerRoot = plainGit(['rev-parse', '--show-toplevel']);
  return _markerRoot;
}
function markerPath() { return join(markerRoot(), MARKER_FILE); }

export function writeMarkerAtomic(obj) {
  const p = markerPath();
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  renameSync(tmp, p);
}
export function readMarker() {
  try {
    const p = markerPath();
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}
export function clearMarker() {
  try { rmSync(markerPath(), { force: true }); } catch { /* best-effort */ }
}

// ── the injectable git runner (default = real git against the staging remote) ──
//
// Every method the CAS primitives need is here so a test can supply a fully in-memory
// arbiter. Network methods (remoteControlSha / clone / refetch / push) are the ONLY ones
// that touch the authed remote, and all route through the sanitizing wrappers — raw git
// output (which can carry the `To <PAT-url>` line) is never returned or logged.
export const realGit = {
  // Presence probe → the branch's sha, or null if the branch does not exist.
  remoteControlSha(cred) {
    const r = gitAuthedTry(['ls-remote', stagingRemoteUrl(cred), `refs/heads/${STAGING_CONTROL_BRANCH}`], cred);
    if (!r.ok) throw (r.error || new Error('staging-control: ls-remote failed (message withheld).'));
    const first = (r.out || '').split('\n').map((l) => l.trim()).filter(Boolean)[0];
    return first ? first.split(/\s+/)[0] : null;
  },
  // Full single-branch clone ([R2]) of the tiny control branch into dir (dir must not exist).
  clone(cred, dir) {
    gitAuthed(['clone', '--single-branch', '--branch', STAGING_CONTROL_BRANCH, stagingRemoteUrl(cred), dir], cred);
  },
  headSha(dir) {
    return plainGit(['rev-parse', 'HEAD'], { cwd: dir });
  },
  readControl(dir) {
    return readFileSync(join(dir, CONTROL_FILE), 'utf8');
  },
  writeControl(dir, text) {
    writeFileSync(join(dir, CONTROL_FILE), text);
  },
  // Re-fetch + reset --hard FETCH_HEAD ([R2]) — FETCH_HEAD is always written regardless of
  // refspec, so this is version/tracking-ref-independent. origin already carries the authed url.
  refetch(cred, dir) {
    gitAuthed(['fetch', 'origin', STAGING_CONTROL_BRANCH], cred, { cwd: dir });
    plainGit(['reset', '--hard', 'FETCH_HEAD'], { cwd: dir });
    return this.headSha(dir);
  },
  stageAll(dir) {
    plainGit(['add', '-A'], { cwd: dir });
  },
  hasStagedChanges(dir) {
    return !gitTry(['diff', '--cached', '--quiet'], { cwd: dir }).ok;
  },
  stagedList(dir) {
    return lines(plainGit(['ls-files'], { cwd: dir }));
  },
  // Commit the staged tree with the explicit committer identity. HEAD is the fetched
  // baseSha (fresh clone, or a reset --hard FETCH_HEAD on a retry), so this commits on it.
  commitOn(dir, baseSha, msg) {
    plainGit(
      ['-c', `user.name=${COMMIT_IDENTITY.name}`, '-c', `user.email=${COMMIT_IDENTITY.email}`, 'commit', '-m', msg],
      { cwd: dir },
    );
    return this.headSha(dir);
  },
  // CAS push of HEAD:refs/heads/staging-control via --porcelain. git's own ref rules enforce
  // the compare-and-swap: a stale parent (or an unrelated bootstrap root) is rejected non-ff.
  push(cred, dir) {
    const r = gitAuthedTry(
      ['push', '--porcelain', stagingRemoteUrl(cred), `HEAD:refs/heads/${STAGING_CONTROL_BRANCH}`],
      cred,
      { cwd: dir },
    );
    if (r.ok) return { ok: true, sha: this.headSha(dir) };
    if (r.raced) return { ok: false, raced: true };
    throw r.error;
  },
  // Force-push a fresh orphan root — reset ONLY. Never deletes the branch (that would loop
  // the presence probe during a concurrent reset).
  forcePush(cred, dir) {
    const r = gitAuthedTry(
      ['push', '--force', '--porcelain', stagingRemoteUrl(cred), `HEAD:refs/heads/${STAGING_CONTROL_BRANCH}`],
      cred,
      { cwd: dir },
    );
    if (r.ok) return { ok: true, sha: this.headSha(dir) };
    throw (r.error || new Error('staging-control: force-push failed (message withheld).'));
  },
  // Bootstrap: init a fresh repo in dir on the control branch, write the seed, commit with
  // identity. Leaves HEAD at the seed commit, ready to push.
  initSeed(dir, text, msg) {
    plainGit(['init', '-b', STAGING_CONTROL_BRANCH, dir]);
    this.writeControl(dir, text);
    this.stageAll(dir);
    return this.commitOn(dir, null, msg);
  },
};

// ── CAS primitives (each threads git = realGit) ──

// Defense-in-depth: only control.json may ever be pushed to the control branch.
export function assertOnlyControlFileStaged(dir, git = realGit) {
  const staged = git.stagedList(dir);
  if (!(staged.length === 1 && staged[0] === CONTROL_FILE)) {
    throw new ControlError(
      `staging-control: refusing to push — expected only ${CONTROL_FILE} staged, got [${staged.join(', ')}].`,
      'BAD_STAGE',
    );
  }
}

// Create-or-adopt the control branch. Whether our seed push WINS or the branch already
// exists (loser), we dispose the `git init`'d seed dir and hand back a fresh clone via
// fetchControl. The init'd dir has NO `origin` remote, so returning it would make the port's
// later CAS-retry refetch (`git fetch origin staging-control`) fail FATALLY the moment the
// bootstrap winner loses a subsequent CAS — misreported as an auth/network HARD STOP. A
// clone always carries `origin`, so refetch works. The winner's own push is never
// --force'd, and the loser adopts the winner's branch (never clobbers it). Threads the SAME
// git runner through the fetchControl recursion; the freshly-created branch means that
// recursion resolves to a clone (remoteControlSha non-null), not another bootstrap.
export function bootstrapControl(cred, git = realGit, seed = defaultControl(DEFAULT_N)) {
  const dir = newControlDir();
  try {
    git.initSeed(dir, serialize(seed), 'staging-control: bootstrap');
    assertOnlyControlFileStaged(dir, git);
    git.push(cred, dir); // {ok} (we won) | {ok:false,raced:true} (someone won first) | throws
  } catch (e) {
    disposeControlDir(dir);
    throw e;
  }
  // Won or raced, the branch now exists — adopt it as a proper clone (with `origin`).
  disposeControlDir(dir);
  return fetchControl(cred, git);
}

// Fetch the current control state. Absent branch → bootstrap. Present → full clone + parse.
// Removes its own clone dir on ANY failure before throwing (no temp-dir leak on a parse throw).
export function fetchControl(cred, git = realGit) {
  const sha = git.remoteControlSha(cred); // throws sanitized on auth/network
  if (sha == null) return bootstrapControl(cred, git);
  const dir = newControlDir();
  try {
    git.clone(cred, dir);
    const baseSha = git.headSha(dir);
    const control = parseControl(git.readControl(dir)); // throws ControlError on corrupt/version
    return { dir, baseSha, control };
  } catch (e) {
    disposeControlDir(dir);
    throw e;
  }
}

// Re-fetch an existing clone dir (fetch + reset --hard FETCH_HEAD) and re-parse. Used by the
// orchestration on a CAS retry so each attempt re-decides from the fresh remote tip.
export function refetchControl(dir, cred, git = realGit) {
  const baseSha = git.refetch(cred, dir);
  const control = parseControl(git.readControl(dir));
  return { baseSha, control };
}

// The CAS write. Writes canonical control.json, stages it; if nothing changed → {ok,noop}
// (no empty commit). Else commits on the fetched baseSha and pushes --porcelain. Returns
// exactly one of {ok,sha} / {ok:false,raced:true} / throws sanitized (auth/network/other).
export function commitControl(dir, cred, next, msg, baseSha, git = realGit) {
  git.writeControl(dir, serialize(next));
  git.stageAll(dir);
  if (!git.hasStagedChanges(dir)) return { ok: true, noop: true };
  assertOnlyControlFileStaged(dir, git);
  git.commitOn(dir, baseSha, msg);
  return git.push(cred, dir); // {ok,sha} | {ok:false,raced:true} | throws
}

// Force-reset the control branch to a fresh seed (loud, stop-the-world recovery). NEVER
// deletes the branch — keeps the presence probe reliable during a concurrent reset.
export function resetControl(cred, git = realGit, seed = defaultControl(DEFAULT_N)) {
  const dir = newControlDir();
  try {
    git.initSeed(dir, serialize(seed), 'staging-control: reset');
    assertOnlyControlFileStaged(dir, git);
    // Bump epoch above whatever a concurrent reader captured — best-effort: the seed's
    // epoch is 0, but a live reset should advance it. Callers that want the livelock guard
    // pass a seed whose epoch is already bumped; the default seed resets to 0.
    git.forcePush(cred, dir);
    return { control: seed, sha: git.headSha(dir) };
  } finally {
    disposeControlDir(dir);
  }
}

// ── the control port used by the orchestration loop ──
//
// Wraps fetchControl/refetchControl/commitControl + dir lifecycle. First read clones (or
// bootstraps); subsequent reads refetch the same dir (reset --hard FETCH_HEAD). dispose()
// removes the dir. Threads the injected git runner throughout.
export function makeControlPort(cred, git = realGit) {
  let dir = null;
  let control = null;
  let baseSha = null;
  return {
    async read() {
      if (dir == null) {
        const f = fetchControl(cred, git);
        dir = f.dir; baseSha = f.baseSha; control = f.control;
      } else {
        const r = refetchControl(dir, cred, git);
        baseSha = r.baseSha; control = r.control;
      }
      return { control, baseSha, epoch: control.epoch };
    },
    async write(next, base, msg) {
      return commitControl(dir, cred, next, msg, base, git);
    },
    dispose() {
      if (dir) { disposeControlDir(dir); dir = null; }
    },
  };
}
