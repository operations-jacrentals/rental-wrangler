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

// ── Config — CONFIRM before the first real run (these are the Phase 0 blockers) ──

// Confirmed 2026-07-13 — the staging repo; its GitHub Pages serves the staging URL
// (https://operations-jacrentals.github.io/rental-wrangler-staging/).
const STAGING_REPO = 'operations-jacrentals/rental-wrangler-staging';

// Confirmed 2026-07-13 — the branch staging's Pages source builds from. The staging
// repo has exactly one branch, `main`, so a "deploy from a branch" Pages source can
// only serve `main`.
const STAGING_PAGES_BRANCH = 'main';

// TODO(jac): confirm — which credential this session actually has (plan §0.4 offers
// either an SSH deploy key or a fine-scoped PAT; this script supports both and prefers
// the SSH key when both are set, since a leaked SSH key PATH is far safer to fail loudly
// with than a PAT, which can end up embedded in a git remote URL — see gitAuthed()).
// Neither set => clean no-op (see resolveCredential()), nothing is pushed.
const STAGING_DEPLOY_KEY_PATH = process.env.STAGING_DEPLOY_KEY_PATH || ''; // path to the PRIVATE half of the deploy key
const STAGING_DEPLOY_PAT = process.env.STAGING_DEPLOY_PAT || '';           // fine-scoped PAT, staging repo only

// Refuse to deploy from these — a short feature branch is the whole point of Gate 1.
// NB: STAGING_PAGES_BRANCH below is the STAGING repo's own Pages branch (still 'main') —
// unrelated to this repo's trunk, which was renamed main -> trunk.
const PROTECTED_BRANCHES = ['trunk', 'production'];

// ── small git helpers (same shape as tools/spec-sync.mjs) ──

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...opts }).trim();
}
function gitTry(args, opts = {}) {
  try { return { ok: true, out: git(args, opts) }; }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || ''), err: e }; }
}
function lines(s) { return s.split('\n').map((x) => x.trim()).filter(Boolean); }
function fail(msg) { console.error(msg); process.exit(1); }
// Portable synchronous sleep (no deps, no event-loop turn needed) — used to wait out GitHub
// Pages propagation between the live-bytes verification polls after a push.
function sleepMs(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

const ROOT = git(['rev-parse', '--show-toplevel']);
process.chdir(ROOT);

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

// ── credential resolution + the sanitizing wrapper for network git calls ──

function resolveCredential() {
  if (STAGING_DEPLOY_KEY_PATH) {
    if (!existsSync(STAGING_DEPLOY_KEY_PATH)) {
      fail(`deploy-staging: STAGING_DEPLOY_KEY_PATH is set but no file exists at ${STAGING_DEPLOY_KEY_PATH}.`);
    }
    return { kind: 'ssh', keyPath: STAGING_DEPLOY_KEY_PATH };
  }
  if (STAGING_DEPLOY_PAT) return { kind: 'pat', token: STAGING_DEPLOY_PAT };
  return null;
}

function stagingRemoteUrl(cred) {
  return cred.kind === 'ssh'
    ? `git@github.com:${STAGING_REPO}.git`
    // PAT embedded in the URL — never printed. Every command that uses this URL goes
    // through gitAuthed(), which never surfaces raw git stderr/argv on failure.
    : `https://x-access-token:${cred.token}@github.com/${STAGING_REPO}.git`;
}
function gitEnv(cred) {
  if (cred.kind !== 'ssh') return process.env;
  return { ...process.env, GIT_SSH_COMMAND: `ssh -i ${JSON.stringify(cred.keyPath)} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new` };
}
// Network operations against the staging remote ONLY. Deliberately swallows the
// original error (it can carry the PAT via git's own "fatal: unable to access '<url>'"
// text) and throws a sanitized one instead.
function gitAuthed(args, cred, opts = {}) {
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

// ── main ──

function main() {
  const DRY_RUN = process.argv.includes('--dry-run');

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  assertFeatureBranch(branch);

  const cred = resolveCredential();
  if (!cred) {
    console.log('deploy-staging: no staging deploy credential configured — nothing pushed.');
    console.log('                Set STAGING_DEPLOY_KEY_PATH or STAGING_DEPLOY_PAT once plan §0.4 is done, then re-run.');
    return;
  }

  const files = deriveSiteFiles();
  if (!files.length) fail('deploy-staging: derived an empty site-file list — something upstream is broken.');
  console.log(`deploy-staging: ${files.length} site file(s) derived from index.html + the module/asset graph:`);
  files.forEach((f) => console.log('   ' + f));

  const { oldToken, newToken } = bumpVersionToken(join(ROOT, 'index.html'));
  console.log(`deploy-staging: bumped shared ?v= token ${oldToken} -> ${newToken} in index.html`);

  if (DRY_RUN) {
    console.log("deploy-staging: --dry-run — stopping before touching the staging repo.");
    console.log("                index.html was still bumped locally; `git checkout -- index.html` to revert.");
    return;
  }

  const dirty = git(['status', '--porcelain']).length > 0;
  const shortSha = gitTry(['rev-parse', '--short', 'HEAD']).out || 'nocommit';

  const cloneDir = freshCloneDir();
  try {
    console.log(`deploy-staging: cloning ${STAGING_REPO}#${STAGING_PAGES_BRANCH} …`);
    cloneStaging(cloneDir, cred);
    syncFiles(cloneDir, files);
    git(['add', '-A'], { cwd: cloneDir });
    if (gitTry(['diff', '--cached', '--quiet'], { cwd: cloneDir }).ok) {
      console.log('deploy-staging: staging already matches this working tree. Nothing to push.');
      return;
    }
    const msg = `deploy: ${branch} @ ${shortSha}${dirty ? '+dirty' : ''} (?v=${newToken})`;
    git(['commit', '-m', msg], { cwd: cloneDir });
    pushStaging(cloneDir, cred);

    const [owner, repoName] = STAGING_REPO.split('/');
    console.log('deploy-staging: pushed.');
    console.log(`  staging URL:  https://${owner}.github.io/${repoName}/`);
    console.log(`  ?v= marker:   ${newToken}`);

    // Verify the LIVE staging site actually serves the new token — a push "succeeding" is NOT
    // proof Pages updated. Poll (~1 min for Pages to propagate), then FAIL LOUDLY if it never
    // catches up, so a deploy that silently didn't take can't be mistaken for a good one (the
    // "staging serves an OLD file under a NEW token" trap CLAUDE.md warns about). This is what
    // stops staging from drifting behind while a broken deploy looks green.
    const indexUrl = `https://${owner}.github.io/${repoName}/index.html`;
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
      console.log(`deploy-staging: ✅ verified — live staging is serving ?v=${newToken}.`);
    } else {
      console.error(`deploy-staging: 🔴 push succeeded but live staging is NOT serving ?v=${newToken} after ~1 min (got ?v=${served || 'unreachable'}).`);
      console.error('deploy-staging: staging did not take — it may be misconfigured or serving a stale build. Do NOT treat this deploy as done.');
      console.error(`  re-check: curl -s ${indexUrl} | grep ${newToken}`);
      process.exit(2);
    }
  } finally {
    removeCloneDir(cloneDir);
  }
}

try {
  main();
} catch (e) {
  fail(e && e.message ? e.message : String(e));
}
