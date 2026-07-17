// staging-git.mjs — the ONE authed + sanitizing git wrapper for the staging repo.
//
// Extracted VERBATIM from deploy-staging.mjs (the small git helpers, credential
// resolution, the authed staging remote URL, and the sanitizing network wrapper) so
// there is exactly ONE copy of the credential/sanitizing plumbing — no split-brain
// between deploy-staging.mjs and the staging-lease/control substrate that also has to
// touch the same authenticated remote.
//
// Two hardening deltas are added on top of the verbatim extraction:
//   - Delta 1 — gitEnv now pins GIT_TERMINAL_PROMPT=0 / LC_ALL=C / LANG=C (and SSH
//     BatchMode=yes), so a bad/expired credential FAILS FAST instead of blocking on an
//     interactive prompt (the exact "session hangs" class this project already fought),
//     and any residual git text is locale-stable.
//   - Delta 2 — gitAuthedTry, a non-throwing variant that classifies a push loser via
//     `git push --porcelain` machine-stable flag parsing (a per-ref line starting with
//     '!' means rejected / non-fast-forward). This is the CAS classifier. Like
//     gitAuthed it NEVER returns or logs raw git output — stdout carries the
//     `To https://x-access-token:<PAT>@…` line, which must never surface.
//
// SECRET HANDLING (unchanged posture): the PAT is read from an env var and NEVER
// logged. Every network op against the authed remote routes through gitAuthed /
// gitAuthedTry, which discard the original error/stdout (git does not redact a token
// embedded in a remote URL from its own messages) and surface only a sanitized value.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// ── Config (verbatim from deploy-staging.mjs) ──

// The staging repo; its GitHub Pages serves the staging URL
// (https://operations-jacrentals.github.io/rental-wrangler-staging/).
export const STAGING_REPO = 'operations-jacrentals/rental-wrangler-staging';

// The branch staging's Pages source builds from. The staging repo has exactly one
// branch, `main`, so a "deploy from a branch" Pages source can only serve `main`.
export const STAGING_PAGES_BRANCH = 'main';

// The push credential — an SSH deploy key PATH (preferred when both are set: a leaked
// key path is far safer to fail loudly with than a PAT, which can end up embedded in a
// git remote URL) or a fine-scoped PAT. Neither set => resolveCredential() returns null
// => a clean no-op, nothing is pushed.
const STAGING_DEPLOY_KEY_PATH = process.env.STAGING_DEPLOY_KEY_PATH || ''; // path to the PRIVATE half of the deploy key
const STAGING_DEPLOY_PAT = process.env.STAGING_DEPLOY_PAT || '';           // fine-scoped PAT, staging repo only

// ── small git helpers (same shape as tools/spec-sync.mjs) ──

export function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...opts }).trim();
}
export function gitTry(args, opts = {}) {
  try { return { ok: true, out: git(args, opts) }; }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || ''), err: e }; }
}
export function lines(s) { return s.split('\n').map((x) => x.trim()).filter(Boolean); }
export function fail(msg) { console.error(msg); process.exit(1); }
// Portable synchronous sleep (no deps, no event-loop turn needed) — used to wait out
// GitHub Pages propagation between the live-bytes verification polls after a push, and
// as the short blocking backoff between CAS retries.
export function sleepMs(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

// ── credential resolution + the sanitizing wrapper for network git calls ──

export function resolveCredential() {
  if (STAGING_DEPLOY_KEY_PATH) {
    if (!existsSync(STAGING_DEPLOY_KEY_PATH)) {
      fail(`deploy-staging: STAGING_DEPLOY_KEY_PATH is set but no file exists at ${STAGING_DEPLOY_KEY_PATH}.`);
    }
    return { kind: 'ssh', keyPath: STAGING_DEPLOY_KEY_PATH };
  }
  if (STAGING_DEPLOY_PAT) return { kind: 'pat', token: STAGING_DEPLOY_PAT };
  return null;
}

export function stagingRemoteUrl(cred) {
  return cred.kind === 'ssh'
    ? `git@github.com:${STAGING_REPO}.git`
    // PAT embedded in the URL — never printed. Every command that uses this URL goes
    // through gitAuthed()/gitAuthedTry(), which never surface raw git stderr/argv/stdout.
    : `https://x-access-token:${cred.token}@github.com/${STAGING_REPO}.git`;
}

// Delta 1 — prompt-suppression + locale pin. GIT_TERMINAL_PROMPT=0 (+ SSH BatchMode=yes)
// make a bad/expired credential fail fast instead of blocking on an interactive prompt;
// LC_ALL=C / LANG=C stabilize any residual git text so the porcelain classifier and any
// message handling are locale-independent.
export function gitEnv(cred) {
  const base = { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', LANG: 'C' };
  if (cred.kind !== 'ssh') return base;
  return {
    ...base,
    GIT_SSH_COMMAND: `ssh -i ${JSON.stringify(cred.keyPath)} -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`,
  };
}

// Network operations against the staging remote ONLY. Deliberately swallows the
// original error (it can carry the PAT via git's own "fatal: unable to access '<url>'"
// text) and throws a sanitized one instead.
export function gitAuthed(args, cred, opts = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', env: gitEnv(cred), ...opts }).trim();
  } catch {
    throw new Error(
      `deploy-staging: git ${args[0]} against the staging remote failed (credential, network, or ` +
      `repo/branch-name issue). Message withheld — it may echo the credential. Check ` +
      `STAGING_REPO/STAGING_PAGES_BRANCH and the credential env var by hand.`
    );
  }
}

// The porcelain CAS classifier (pure, exported for direct unit testing — see ci/lease-test.mjs
// 4.20). `git push --porcelain` prints one machine-stable status line per ref; a line whose
// first non-space char is '!' means that ref was REJECTED (non-fast-forward / fetch-first) ⇒
// the CAS loser must re-fetch and re-decide. Any other failure (no '!' line) is fatal
// auth/network. We inspect ONLY the leading flag char and return ONLY {raced} — the line text
// (which carries the `To https://x-access-token:<PAT>@…` remote URL) is never surfaced.
export function classifyPushFailure(stdout) {
  const rejected = String(stdout || '')
    .split('\n')
    .map((l) => l.trimStart())
    .some((l) => l.startsWith('!'));
  return { raced: rejected };
}

// Delta 2 — the CAS classifier. A NON-throwing authed network call that runs the given
// git command (the caller passes `--porcelain` for push) and, on failure, inspects the
// captured stdout line flags IN-PROCESS to distinguish a non-fast-forward CAS loss
// (a per-ref line starting with '!') from a fatal auth/network error. It NEVER returns
// or logs raw git output (stdout/stderr/argv) — the same secret-safe posture as
// gitAuthed. Returns one of:
//   { ok:true, out }                          — command succeeded (out is the sanitized trimmed stdout; safe: a clean push's porcelain stdout carries the ref update line but the loser-detection path is the only place stdout matters, and callers of the ok path do not print it)
//   { ok:false, raced:true }                  — porcelain shows a rejected '!' ref line ⇒ non-fast-forward
//   { ok:false, raced:false, error }          — any other failure ⇒ sanitized Error, no raw output
export function gitAuthedTry(args, cred, opts = {}) {
  try {
    const out = execFileSync('git', args, { encoding: 'utf8', env: gitEnv(cred), ...opts });
    return { ok: true, out: out.trim() };
  } catch (e) {
    // Classify via the porcelain machine-stable flags on stdout (pure helper above). We parse
    // only the leading flag char — never surface the line text (it contains the `To <PAT-url>`
    // remote line).
    if (classifyPushFailure((e && e.stdout) || '').raced) return { ok: false, raced: true };
    return {
      ok: false,
      raced: false,
      error: new Error(
        `staging-control: git ${args[0]} against the staging remote failed (credential, network, ` +
        `or repo/branch-name issue). Message withheld — it may echo the credential.`
      ),
    };
  }
}
