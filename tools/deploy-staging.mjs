#!/usr/bin/env node
// deploy-staging.mjs — "put my feature on staging."
//
// OPERATIONAL (2026-07-15) — the staging repo + STAGING_DEPLOY_PAT are confirmed and the
// staging site serves live; this is the working Gate-1 review deploy (/deploy wraps it).
//
// WHY THIS EXISTS
// Per the trunk-based redesign (see the two docs below), staging stops being a
// cron-mirrored repo and becomes a direct push target: a feature branch deploys
// itself to the staging Pages site so Jac can review the running app at a URL,
// then says "merge it" (Gate 1, trunk) / "promote it" (Gate 2, production).
// This script is Phase 1.1 — the FIRST of those two chat-driven gates' plumbing.
//   - Plan:   docs/superpowers/plans/2026-07-12-dev-workflow-trunk-based-redesign-plan.md  (§Phase 0, §Phase 1.1)
//   - Design: docs/superpowers/specs/2026-07-12-dev-workflow-trunk-based-redesign-design.md (D8)
//
// WHAT IT DOES
//   1. refuses to run off main/production — this workflow assumes a short feature branch
//   2. derives the real set of publishable site files by crawling from the repo's
//      top-level *.html entry points through their asset/script/import/CSS graph
//      (NOT a hardcoded list — see deriveSiteFiles() below)
//   3. bumps the shared ?v= cache-bust token in index.html (style.css/rule-usage.js/app.js
//      only — never the ES-module import specifiers inside app.js, per CLAUDE.md)
//   4. clones the staging repo's Pages branch fresh, replaces its tracked files with the
//      derived set, commits, and pushes
//   5. prints the staging URL + the new ?v= marker so the deploy is verifiable
//
// BUILD-FREE POSTURE: this copies files, it does not bundle/transpile them — same
// posture as the app itself and as tools/spec-sync.mjs, which this file's shape follows
// (Node ESM, execFileSync('git', ...), no external deps, small git/gitTry/lines helpers).
//
// SECRET HANDLING
//   The push credential is read from an env var and NEVER logged. Every git operation
//   that touches the authenticated staging remote (clone, push) is routed through
//   gitAuthed(), which discards the original error (git does not redact a token embedded
//   in a remote URL from its own "fatal: unable to access '...'" messages) and throws a
//   generic, safe-to-print one instead. Local-only git calls (branch check, add, commit,
//   diff) use the plain git()/gitTry() helpers and print normally.
//
// USAGE (once activated)
//   node tools/deploy-staging.mjs              # derive, bump, clone, push
//   node tools/deploy-staging.mjs --dry-run    # derive + bump index.html locally, stop
//                                               # before touching the staging repo

import { execFileSync } from 'node:child_process';
import {
  existsSync, mkdirSync, copyFileSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync,
} from 'node:fs';
import { join, dirname, extname, posix } from 'node:path';
import { tmpdir } from 'node:os';
// The credential/sanitizing git plumbing now lives in ONE place — tools/lib/staging-git.mjs
// — shared with the staging-lease/control substrate so there is no split-brain copy of the
// authed-remote handling. See that file for the two hardening deltas (prompt-suppression +
// the porcelain CAS classifier). git/gitTry/lines/fail/sleepMs are byte-identical to the
// helpers this file used to define locally.
import {
  git, gitTry, lines, fail, sleepMs,
  STAGING_REPO, STAGING_PAGES_BRANCH,
  resolveCredential, stagingRemoteUrl, gitEnv, gitAuthed,
} from './lib/staging-git.mjs';
// Step 7 — the staging-lease coordination layer. Acquire a slot (or auto-queue and wait)
// before deploying, renew it on a verified live-bytes check, and release it only when
// nothing landed. The advisory marker is diagnostic-only (gitignored). See the plan §5.7 / §6.
import { pathToFileURL } from 'node:url';
import { acquire as leaseAcquire, renew as leaseRenew, release as leaseRelease } from './staging-lease.mjs';
import { writeMarkerAtomic, clearMarker, DEFAULT_TTL_MINUTES } from './lib/staging-control.mjs';

// Refuse to deploy from these — a short feature branch is the whole point of Gate 1.
// NB: STAGING_PAGES_BRANCH (imported above) is the STAGING repo's own Pages branch (still
// 'main') — unrelated to this repo's trunk, which was renamed main -> trunk.
const PROTECTED_BRANCHES = ['trunk', 'production'];

// ROOT/chdir are set inside main() (hoisted per plan [R7]) so that importing this module
// for its exported seams (ci/lease-deploy-test.mjs) has NO side effects — no git call, no
// chdir at import time. deriveSiteFiles/syncFiles/bumpVersionToken read this module-level
// ROOT, which main() assigns before any of them run.
let ROOT;

// ── branch guard ──

function assertFeatureBranch(branch) {
  if (!branch || branch === 'HEAD') {
    fail('deploy-staging: detached HEAD — check out a feature branch first.');
  }
  if (PROTECTED_BRANCHES.includes(branch)) {
    fail(`deploy-staging: refusing to run from '${branch}'. This is Gate-1 plumbing for a ` +
      `short-lived feature branch (see the plan) — check out a feature branch first.`);
  }
}

// ── deriving the real site-file list (crawl, don't guess) ──

// Explicit defense-in-depth: even if a bug in the crawler ever resolved one of these,
// never let it into the staging deploy.
//   - CNAME is the PRODUCTION custom-domain pointer; copying it into the staging repo
//     would misconfigure that repo's Pages domain.
//   - the rest are gitignored/never-served-by-Pages per CLAUDE.md (real customer PII,
//     the GAS backend, local secret dumps).
const DENY_PATTERNS = [
  /^CNAME$/, /^backend\//, /\.local\./, /^data\.generated\.js$/, /^data\.demo-backup\.js$/, /^JacTec-handoff\//,
];
function isDenied(rel) { return DENY_PATTERNS.some((re) => re.test(rel)); }

// Files no static scan can find, added unconditionally:
//   - sw.js is registered from app.js via a runtime string ('sw.js?v=' + token), not a
//     static import or href — the crawler below can't see it.
//   - .nojekyll is Pages hosting hygiene (skip Jekyll processing); it's a dotfile, so the
//     *.html-seeded crawl below never reaches it on its own.
const ALWAYS_SHIP = ['sw.js', '.nojekyll'];

function stripQuery(p) { return p.replace(/^\.\//, '').split(/[?#]/)[0]; }
function isExternal(ref) { return /^([a-z][\w+.-]*:)?\/\//i.test(ref) || /^(mailto|tel|data):/i.test(ref) || ref.startsWith('#'); }

const HTML_REF_RE = /\b(?:src|href)\s*=\s*["']([^"']+)["']/g;
const CSS_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const JS_IMPORT_RE = /\bfrom\s+['"](\.[^'"]+)['"]/g;
const JS_DYNIMPORT_RE = /\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g;
// Safety net for asset paths referenced as plain strings rather than a formal
// src=/href=/url()/import (e.g. app.js building a <video> src at runtime).
const ASSET_LITERAL_RE = /\bassets\/[\w.\-/]+\.(?:png|jpe?g|svg|mp4|webp|gif|ico|woff2?|ttf|otf)\b/gi;

function extractHtmlRefs(text) {
  const out = new Set();
  for (const m of text.matchAll(HTML_REF_RE)) { if (!isExternal(m[1])) out.add(stripQuery(m[1])); }
  return out;
}
function extractCssRefs(text) {
  const out = new Set();
  for (const m of text.matchAll(CSS_URL_RE)) { if (!isExternal(m[2])) out.add(stripQuery(m[2])); }
  return out;
}
function extractJsRefs(text) {
  const out = new Set();
  for (const m of text.matchAll(JS_IMPORT_RE)) out.add(stripQuery(m[1]));
  for (const m of text.matchAll(JS_DYNIMPORT_RE)) out.add(stripQuery(m[1]));
  return out;
}
function extractManifestRefs(text) {
  const out = new Set();
  try {
    const j = JSON.parse(text);
    for (const icon of j.icons || []) { if (icon && icon.src) out.add(stripQuery(icon.src)); }
  } catch { /* not JSON we can parse — ignore */ }
  return out;
}
function extractLiteralAssetRefs(text) {
  const out = new Set();
  for (const m of text.matchAll(ASSET_LITERAL_RE)) out.add(stripQuery(m[0]));
  return out;
}
// Resolve a ref found inside `fromRel` (repo-relative, posix) to a repo-relative path.
function resolveRef(fromRel, ref) {
  const dir = posix.dirname(fromRel);
  return posix.normalize(posix.join(dir, ref));
}

const CRAWLABLE_EXT = new Set(['.html', '.css', '.js', '.mjs', '.webmanifest', '.json']);

// Crawl from every top-level *.html entry point (index.html plus any sibling static
// pages like the SMS opt-in/privacy/terms pages) through hrefs/srcs, the ES-module
// import graph, CSS url()s, and the manifest's icon list. This is deliberately a crawl,
// not a hardcoded list, so a new script/asset/page shows up here automatically the next
// time it's actually wired into the site — and something that's never referenced from
// index.html (a draft, a dev-only fixture) never gets shipped by accident.
function deriveSiteFiles() {
  const entryHtml = readdirSync(ROOT).filter((f) => f.endsWith('.html') && statSync(join(ROOT, f)).isFile());
  const queue = [...entryHtml, ...ALWAYS_SHIP];
  const seen = new Set();
  const discovered = [];
  const missing = [];
  const denied = [];

  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (isDenied(rel)) { denied.push(rel); continue; }
    const abs = join(ROOT, rel);
    if (!existsSync(abs) || !statSync(abs).isFile()) { missing.push(rel); continue; }
    discovered.push(rel);

    const ext = extname(rel).toLowerCase();
    if (!CRAWLABLE_EXT.has(ext)) continue; // binary asset — nothing to crawl further
    const text = readFileSync(abs, 'utf8');

    const refs = new Set();
    if (ext === '.html') for (const r of extractHtmlRefs(text)) refs.add(r);
    if (ext === '.css') for (const r of extractCssRefs(text)) refs.add(r);
    if (ext === '.js' || ext === '.mjs') for (const r of extractJsRefs(text)) refs.add(r);
    if (ext === '.webmanifest' || ext === '.json') for (const r of extractManifestRefs(text)) refs.add(r);
    for (const r of extractLiteralAssetRefs(text)) refs.add(r);

    for (const r of refs) {
      const resolved = resolveRef(rel, r);
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }

  if (denied.length) {
    console.warn('deploy-staging: referenced but denylisted (skipped, see DENY_PATTERNS):');
    denied.forEach((d) => console.warn('   ' + d));
  }
  if (missing.length) {
    console.warn('deploy-staging: referenced but not found on disk (skipped):');
    missing.forEach((m) => console.warn('   ' + m));
  }
  return discovered.sort();
}

// ── the shared ?v= cache-bust token ──

function todayStamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}
// Matches the existing history in index.html: YYYYMMDD + an alpha suffix that
// increments for repeat deploys the same day (…20260710e, 20260710f, 20260710g…).
function incrementSuffix(s) {
  if (!s) return 'a';
  const arr = s.split('');
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== 'z') { arr[i] = String.fromCharCode(arr[i].charCodeAt(0) + 1); return arr.join(''); }
    arr[i] = 'a';
  }
  return 'a' + arr.join('');
}
function nextToken(oldToken) {
  const today = todayStamp();
  const m = /^(\d{8})([a-z]*)$/i.exec(oldToken);
  if (!m || m[1] !== today) return today + 'a';
  return today + incrementSuffix(m[2].toLowerCase());
}

// Bumps the ONE shared token across style.css/rule-usage.js/app.js in index.html.
// Deliberately does NOT touch app.js's internal ES-module import specifiers (they never
// carry ?v= — see CLAUDE.md: a relative import drops the query string, so a versioned +
// unversioned copy of a sub-module would instantiate twice).
function bumpVersionToken(indexHtmlAbs) {
  const html = readFileSync(indexHtmlAbs, 'utf8');
  const patterns = [
    ['style.css', /(\bstyle\.css\?v=)([\w-]+)/],
    ['rule-usage.js', /(\brule-usage\.js\?v=)([\w-]+)/],
    ['app.js', /(\bapp\.js\?v=)([\w-]+)/],
  ];
  const tokens = new Set();
  for (const [name, re] of patterns) {
    const m = re.exec(html);
    if (!m) fail(`deploy-staging: could not find a ?v= token on ${name} in index.html — the cache-bust pattern may have changed; update this script.`);
    tokens.add(m[2]);
  }
  if (tokens.size !== 1) {
    fail(`deploy-staging: style.css/rule-usage.js/app.js don't share one ?v= token in index.html ` +
      `(found: ${[...tokens].join(', ')}) — CLAUDE.md requires one shared token. Fix index.html by hand first.`);
  }
  const oldToken = [...tokens][0];
  const newToken = nextToken(oldToken);
  let next = html;
  for (const [, re] of patterns) next = next.replace(re, `$1${newToken}`);
  writeFileSync(indexHtmlAbs, next);
  return { oldToken, newToken };
}

// ── syncing files into a fresh clone of the staging repo ──

function freshCloneDir() {
  const dir = join(tmpdir(), `rw-deploy-staging-${process.pid}-${Date.now()}`);
  rmSync(dir, { recursive: true, force: true });
  return dir;
}
function removeCloneDir(dir) { rmSync(dir, { recursive: true, force: true }); }

function cloneStaging(dir, cred) {
  gitAuthed(['clone', '--depth', '1', '--branch', STAGING_PAGES_BRANCH, '--single-branch', stagingRemoteUrl(cred), dir], cred);
}
function pushStaging(dir, cred) {
  // 'origin' already points at the authed URL from the clone above — no need to re-embed it.
  gitAuthed(['push', 'origin', `HEAD:refs/heads/${STAGING_PAGES_BRANCH}`], cred, { cwd: dir });
}

// Replace the clone's tracked files with exactly `files` (so a file removed from the
// source side is removed from staging too, not left behind as a stale orphan).
function syncFiles(cloneDir, files) {
  for (const f of lines(git(['ls-files'], { cwd: cloneDir }))) {
    rmSync(join(cloneDir, f), { force: true });
  }
  for (const f of files) {
    const dst = join(cloneDir, f);
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(join(ROOT, f), dst);
  }
}

// ── Step 7: staging-lease coordination (exported seams — injected in ci/lease-deploy-test.mjs) ──

const QUEUE_POLL_MS = 30000;   // poll the lease ~every 30 s while queued
const QUEUE_GRACE_MS = 60000;  // watchdog grace on top of the holder TTL
const WATCHDOG_MS = DEFAULT_TTL_MINUTES * 60000 + QUEUE_GRACE_MS; // stalled-position give-up window

function stripSlash(u) { return String(u || '').replace(/\/+$/, ''); }
function last4(s) { return String(s || '').slice(-4) || '????'; }
function ceilMin(ms) { const m = Math.ceil(ms / 60000); return m > 0 ? `~${m} min` : 'any moment'; }

// A malformed acquired slot must NEVER send a deploy to an unknown target — throw (→ exit 1).
export function assertSlotShape(slot) {
  if (!slot || typeof slot !== 'object' || !Number.isInteger(slot.id) || typeof slot.url !== 'string' || !slot.url) {
    throw new Error(`deploy-staging: acquired slot is malformed (${JSON.stringify(slot)}) — refusing to deploy to an unknown target.`);
  }
  return slot;
}

// One-time banner printed when the deploy first lands in the queue. Branches on whether any
// holder is reported: when a slot is momentarily free but the caller is behind the FIFO head,
// `holders` MAY be empty — render "a slot is free but N ahead", NEVER "Slot undefined".
export function contentionBanner(q, now) {
  const out = [];
  if (q.holders && q.holders.length) {
    const parts = q.holders
      .slice()
      .sort((a, b) => a.expiresAt - b.expiresAt)
      .map((h) => `Slot ${h.slotId} held by …${last4(h.session)}${h.feature ? ` (${h.feature})` : ''}, frees ${ceilMin(h.expiresAt - now)}`);
    out.push(`🔒 All staging slots busy — ${parts.join('; ')}.`);
  } else {
    const ahead = Math.max(0, (q.position || 1) - 1);
    out.push(`🔒 Queued — a slot is free but ${ahead} ahead of you in line.`);
  }
  out.push(`Queued you at #${q.position} (${q.queueLen} in line); I'll deploy the moment a slot frees and ping you.`);
  return out.join('\n');
}

// A per-poll progress line while waiting (position + soonest-free ETA).
export function queueProgressLine(q, now) {
  const eta = typeof q.etaMs === 'number' ? ceilMin(q.etaMs) : 'unknown';
  return `staging queue: still #${q.position} of ${q.queueLen}, soonest slot frees ${eta}…`;
}

// The exit-3 message when the watchdog gives up with no forward progress. BUSY, not broken.
export function queueTimeoutMessage(q) {
  const pos = q && typeof q.position === 'number' ? `#${q.position}` : 'in line';
  return `🔴 staging queue: no forward progress (${pos}) past the watchdog window — giving up. ` +
    `Staging is BUSY, not broken: do NOT rotate the PAT. Re-run /deploy when you're ready.`;
}

// Acquire a slot, or auto-queue and poll until one frees. ALL effects are injected
// (lease/sleep/now/log/exit) so the deploy-seam tests never touch the network. A transient
// LEASE_CONTENTION is ridden out per poll (never aborts the wait); a genuine auth/network
// throw propagates (never deploy lease-less). Forward progress (a falling queue position)
// resets the watchdog deadline; a position stalled past the watchdog window ends the wait
// with exit 3 (busy, not broken).
export async function acquireSlotOrQueue(opts, deps = {}) {
  const {
    lease,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = () => Date.now(),
    log = (...a) => console.log(...a),
    exit = (code) => process.exit(code),
    pollMs = QUEUE_POLL_MS,
    watchdogMs = WATCHDOG_MS,
  } = deps;

  let bannered = false;
  let bestPosition = Infinity;
  // Wall-clock deadline anchor, armed on the first poll (elapsed = t - lastProgressAt).
  // Init lazily to the first poll's clock so the watchdog measures ELAPSED time, not an
  // absolute epoch — and so sustained LEASE_CONTENTION (which never yields a queued result
  // to reset it) is still bounded by the watchdog, not an infinite loop (INV-11).
  let lastProgressAt = null;

  for (;;) {
    const t = now();
    if (lastProgressAt === null) lastProgressAt = t; // arm the deadline on the first poll

    let res;
    try {
      res = await lease.acquire({ session: opts.session, branch: opts.branch, feature: opts.feature });
    } catch (e) {
      if (e && e.code === 'LEASE_CONTENTION') {
        // Ride out the herd — but the watchdog is the ultimate bound: persistent contention
        // that never returns a queued/acquired result must still give up (busy, not broken).
        if (t - lastProgressAt > watchdogMs) {
          log(queueTimeoutMessage(null));
          exit(3);
          return; // real process.exit never returns; a test's exit spy returns → stop looping
        }
        await sleep(pollMs);
        continue;
      }
      throw e; // genuine auth/network — never deploy lease-less (→ main catch → exit 1)
    }

    if (res.status === 'acquired') {
      if (bannered) log(`staging queue: ✅ a slot freed — deploying to slot ${res.slot.id}.`);
      return res.slot;
    }

    if (!bannered) { log(contentionBanner(res, t)); bannered = true; }
    else log(queueProgressLine(res, t));

    if (typeof res.position === 'number' && res.position < bestPosition) {
      bestPosition = res.position; lastProgressAt = t; // forward progress → reset the deadline
    }
    if (t - lastProgressAt > watchdogMs) {
      log(queueTimeoutMessage(res));
      exit(3);
      return; // real process.exit never returns; a test's exit spy returns → stop looping
    }
    await sleep(pollMs);
  }
}

// ── SIGINT/SIGTERM: best-effort release, pre-push ONLY (nothing landed), re-entrancy-guarded ──

let _held = false;       // we currently hold a slot
let _landed = false;     // a push has been attempted — the pack MAY have landed → HOLD, never release
let _releasing = false;  // re-entrancy guard shared by the signal handler and the abort path
let _heldIdent = null;   // { session } for release-BY-SESSION on abort ([R5])

function installLeaseSignalRelease(cred) {
  const handler = async () => {
    if (_releasing) return; // re-entrancy guard — never double-release
    _releasing = true;
    if (_held && !_landed && _heldIdent) { // pre-push only: nothing landed → safe to release
      // [R5] the deploy-error / SIGINT path releases BY SESSION only — never by branch.
      // Passing branch would broaden decideRelease's match and could clear a DIFFERENT
      // session that took over the same feature branch after a TTL reap.
      try { await leaseRelease({ session: _heldIdent.session }, { cred }); } catch { /* best-effort; TTL backstops */ }
      try { clearMarker(); } catch { /* advisory */ }
    }
    process.exit(130);
  };
  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
}

// Renew the held lease after a verified deploy (or a nothing-to-push no-op) and stamp the
// advisory marker with the live token. Surfaces a `not-held` result LOUDLY (INV-5): the slot
// was TTL-reclaimed mid-deploy and staging may be overwritten at any moment.
async function renewHeld(cred, session, slot, token) {
  try {
    const r = await leaseRenew({ session }, { cred });
    if (r.status === 'not-held') {
      console.error(`deploy-staging: ⚠️ LEASE EXPIRED — this session no longer holds slot ${slot.id} ` +
        `(TTL-reclaimed during the deploy?). Staging may be overwritten by another session at any moment. ` +
        `Re-run /deploy to reclaim the slot before telling Jac staging is ready.`);
    } else {
      console.log(`deploy-staging: 🔒 lease renewed — holding slot ${slot.id} until /merge or TTL.`);
    }
  } catch (e) {
    console.error(`deploy-staging: ⚠️ could not renew the lease (${e && e.message ? e.message : e}); TTL still governs.`);
  }
  try { writeMarkerAtomic({ slotId: slot.id, url: slot.url, session, token, renewedAt: Date.now() }); } catch { /* advisory only */ }
}

// ── main ──

async function main() {
  ROOT = git(['rev-parse', '--show-toplevel']);
  process.chdir(ROOT);

  const DRY_RUN = process.argv.includes('--dry-run');

  const files = deriveSiteFiles();
  if (!files.length) fail('deploy-staging: derived an empty site-file list — something upstream is broken.');
  console.log(`deploy-staging: ${files.length} site file(s) derived from index.html + the module/asset graph:`);
  files.forEach((f) => console.log('   ' + f));

  // ── --dry-run: bump ?v= locally, then STOP. A PURE LOCAL PREVIEW — it touches nothing remote,
  // so it runs BEFORE the feature-branch guard AND the credential check (it needs neither). That
  // also makes it work in a detached-HEAD checkout (a pull_request CI run checks out the merge ref
  // detached, where `rev-parse --abbrev-ref HEAD` is "HEAD" and would otherwise trip
  // assertFeatureBranch). The REAL deploy below still enforces the branch guard + credential. ──
  if (DRY_RUN) {
    const { oldToken, newToken } = bumpVersionToken(join(ROOT, 'index.html'));
    console.log(`deploy-staging: bumped shared ?v= token ${oldToken} -> ${newToken} in index.html`);
    console.log('deploy-staging: --dry-run — stopping before touching the staging repo (no lease acquired).');
    console.log('                index.html was still bumped locally; `git checkout -- index.html` to revert.');
    return 0;
  }

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  assertFeatureBranch(branch);

  const cred = resolveCredential();
  if (!cred) {
    console.log('deploy-staging: no staging deploy credential configured — nothing pushed.');
    console.log('                Set STAGING_DEPLOY_KEY_PATH or STAGING_DEPLOY_PAT once plan §0.4 is done, then re-run.');
    return 0;
  }

  const SESSION = process.env.CLAUDE_CODE_SESSION_ID || '';
  if (!SESSION) {
    fail('deploy-staging: CLAUDE_CODE_SESSION_ID is empty — cannot coordinate a staging lease. Re-run inside a session.');
  }
  const feature = branch.split('/').pop() || null;

  // [R7] read-only compute (dirty/shortSha) BEFORE acquiring — a queue timeout then never
  // leaves index.html dirty, because the ?v= bump happens only AFTER a slot is held.
  const dirty = git(['status', '--porcelain']).length > 0;
  const shortSha = gitTry(['rev-parse', '--short', 'HEAD']).out || 'nocommit';

  installLeaseSignalRelease(cred);

  // Acquire (or auto-queue → wait → acquire). Auth/network throws propagate (→ exit 1); a
  // no-forward-progress watchdog ends the wait with exit 3 inside acquireSlotOrQueue.
  const lease = { acquire: (o) => leaseAcquire(o, { cred }) };
  const slot = await acquireSlotOrQueue({ session: SESSION, branch, feature }, { lease });
  assertSlotShape(slot);
  _held = true; _heldIdent = { session: SESSION };
  console.log(`deploy-staging: 🎟️  holding slot ${slot.id} → ${slot.url}`);

  // Advisory marker (diagnostic-only, gitignored): token:null at acquire, filled on verified renew.
  try { writeMarkerAtomic({ slotId: slot.id, url: slot.url, session: SESSION, branch, feature, token: null, acquiredAt: Date.now() }); } catch { /* advisory only */ }

  // [R7] bump AFTER the slot is held.
  const { oldToken, newToken } = bumpVersionToken(join(ROOT, 'index.html'));
  console.log(`deploy-staging: bumped shared ?v= token ${oldToken} -> ${newToken} in index.html`);

  const cloneDir = freshCloneDir();
  try {
    console.log(`deploy-staging: cloning ${STAGING_REPO}#${STAGING_PAGES_BRANCH} …`);
    cloneStaging(cloneDir, cred);
    syncFiles(cloneDir, files);
    git(['add', '-A'], { cwd: cloneDir });
    if (gitTry(['diff', '--cached', '--quiet'], { cwd: cloneDir }).ok) {
      // Nothing to push — staging already serves these exact bytes, so our feature IS on
      // staging. HOLD the lease (renew) and keep the review window; never release (nothing
      // was abandoned). This is what keeps a /merge release right after a re-deploy safe.
      console.log('deploy-staging: staging already matches this working tree. Nothing to push.');
      await renewHeld(cred, SESSION, slot, newToken);
      return 0;
    }
    const msg = `deploy: ${branch} @ ${shortSha}${dirty ? '+dirty' : ''} (?v=${newToken})`;
    git(['commit', '-m', msg], { cwd: cloneDir });

    // ── PUSH — from here the pack MAY have landed: HOLD the lease on ANY failure ([R8]). ──
    _landed = true;
    try {
      pushStaging(cloneDir, cred);
    } catch (e) {
      console.error('deploy-staging: 🔴 push to staging failed AFTER the commit — the push is INDETERMINATE');
      console.error('deploy-staging: (the pack may already have been accepted). HOLDING the lease; TTL reclaims it if nothing landed.');
      throw e; // → main-guard fail → exit 1; the pre-push release path is skipped because _landed is set
    }

    console.log('deploy-staging: pushed.');
    console.log(`  staging URL:  ${slot.url}`);
    console.log(`  ?v= marker:   ${newToken}`);

    // Verify the LIVE staging slot actually serves the new token — a push "succeeding" is NOT
    // proof Pages updated. Poll (~1 min for Pages to propagate), then FAIL LOUDLY if it never
    // catches up, so a deploy that silently didn't take can't be mistaken for a good one.
    const indexUrl = `${stripSlash(slot.url)}/index.html`;
    let served = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const html = execFileSync('curl', ['-sS', '-L', '--max-time', '15', indexUrl], { encoding: 'utf8' });
        const m = html.match(/app\.js\?v=([A-Za-z0-9._-]+)/);
        served = m ? m[1] : null;
      } catch { served = null; }
      if (served === newToken) break;
      if (attempt < 5) {
        console.log(`deploy-staging: live staging not serving ?v=${newToken} yet (got ?v=${served || 'n/a'}); waiting for Pages…`);
        sleepMs(12000);
      }
    }
    if (served === newToken) {
      console.log(`deploy-staging: ✅ verified — live staging (slot ${slot.id}) is serving ?v=${newToken}.`);
      // Verified live → renew (surface `not-held` LOUDLY) + stamp the marker with the live token.
      await renewHeld(cred, SESSION, slot, newToken);
      return 0;
    }
    // Post-push verify failure → bytes ARE pushed → HOLD the lease ([R8]); exit 2 (unchanged).
    console.error(`deploy-staging: 🔴 push succeeded but live staging (slot ${slot.id}) is NOT serving ?v=${newToken} after ~1 min (got ?v=${served || 'unreachable'}).`);
    console.error('deploy-staging: staging did not take — it may be misconfigured or serving a stale build. Do NOT treat this deploy as done.');
    console.error('deploy-staging: HOLDING the lease (bytes are pushed); TTL governs. Re-run /deploy after fixing Pages.');
    console.error(`  re-check: curl -s ${indexUrl} | grep ${newToken}`);
    // process.exit() terminates synchronously — the outer `finally { removeCloneDir }` never
    // runs — so clean the clone dir up explicitly here to avoid leaking a temp clone per
    // verify failure.
    removeCloneDir(cloneDir);
    process.exit(2);
  } catch (e) {
    // [R8] release ONLY when nothing landed (a pre-push abort). _landed → HOLD (TTL governs).
    if (_held && !_landed && !_releasing) {
      _releasing = true; // block the signal handler from a concurrent double-release
      try {
        // [R5] release BY SESSION only on the deploy-error path — the aborting process IS the
        // session that acquired, so a session-exact match releases strictly its own hold and
        // can never clear another session that took over the same branch after a TTL reap.
        await leaseRelease({ session: SESSION }, { cred });
        console.error(`deploy-staging: released slot ${slot.id} (deploy aborted before anything landed).`);
        clearMarker();
      } catch { /* best-effort; TTL is the backstop */ }
    }
    throw e;
  } finally {
    removeCloneDir(cloneDir);
  }
}

// main-guard — run the CLI only when invoked directly, NOT when imported for the seams above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code || 0)).catch((e) => fail(e && e.message ? e.message : String(e)));
}
