#!/usr/bin/env node
// promote.mjs — Gate 2 of the two-gate trunk-based workflow: trunk (main) -> production.
//
// GO-LIVE step (Gate 2). With --yes this fast-forwards `production` to the approved trunk
// commit — the live deploy. `production` exists and is kept in sync with trunk; Pages is
// expected to serve it (per CLAUDE.md). ⚠️ Confirm Pages' source branch is `production`
// before relying on auto-promote.yml: if Pages still serves `trunk`, merging is already live
// and this step is a no-op. Run only on Jac's explicit "promote it", or from
// .github/workflows/auto-promote.yml for a Wrangler auto-fix.
//
// See: docs/superpowers/plans/2026-07-12-dev-workflow-trunk-based-redesign-plan.md (§1.3)
//      docs/superpowers/specs/2026-07-12-dev-workflow-trunk-based-redesign-design.md
//
// WHY THIS EXISTS
// Once Phase 0 lands, production Pages stops tracking `main` directly — it serves a
// `production` release-pointer branch instead. That's what makes Gate 1 ("merge it",
// feature -> main) safe to run without going live: `main` can run ahead of production,
// holding blessed-but-not-live work. Gate 2 ("promote it") is the ONLY thing that moves
// the live site — it fast-forwards `production` to the exact commit already approved on
// `main` (byte-identical to what was reviewed on staging, per the one-feature-at-a-time
// flow this plan assumes). That makes this the irreversible go-live step, so it gets the
// same caution posture as the /clasp production deploy: preview first (commit range +
// diffstat), a hard STOP-gate behind an explicit --yes, a fast-forward-only push (no
// --force, ever), then a live-bytes check afterward instead of just trusting the push —
// the same "a stale snapshot no browser refresh fixes, only a re-sync/re-verify does"
// trap called out for the staging mirror in CLAUDE.md applies here too.
//
// USAGE
//   node tools/promote.mjs           # PREVIEW ONLY — shows what would go live, does nothing
//   node tools/promote.mjs --yes     # promote: fast-forward + push `production`, then verify live
//
// SAFETY
//   Without --yes this script only fetches + prints a preview and exits — it never
//   pushes. With --yes it still refuses to move `production` unless the fast-forward is
//   clean (production must be a strict ancestor of main); a diverged/rewritten production
//   is left untouched and reported so a human can reconcile it manually — there is no
//   --force path in this script. Never echoes secrets (none are needed for this step).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// TODO(jac): confirm — the release-pointer branch Pages serves as PRODUCTION (plan Phase 0.2/0.3).
const PRODUCTION_BRANCH = 'production';
// The trunk branch Gate 1 ("merge it") lands on (branch renamed main -> trunk, 2026-07-13).
const TRUNK = 'trunk';
// TODO(jac): confirm — the live site's public URL (what Pages serves for PRODUCTION_BRANCH).
const LIVE_URL = 'https://app.jacrentals.com';
// The STAGING review site's public URL. Its live ?v= token MUST equal the trunk commit being
// promoted — otherwise staging is showing something OTHER than what's about to go live, which
// defeats the review gate. Enforced below so staging can never fall behind production.
const STAGING_URL = 'https://operations-jacrentals.github.io/rental-wrangler-staging';

// The advisory lease marker deploy-staging writes at the repo root (diagnostic-only,
// gitignored). promote NEVER requires it — it's usually already deleted by /merge — but when
// present it names the slot the feature was deployed to and may carry the last verified ?v=
// token, which enriches the freshness print and lets us flag marker/trunk drift.
const MARKER_FILE = '.staging-lease.json';

// Normalize a base URL so `${base}/index.html` can never produce the `…staging//index.html`
// double-slash bug (STAGING_URL / a slot url may or may not carry a trailing slash).
function stripSlash(u) { return String(u || '').replace(/\/+$/, ''); }

// Resolve which staging slot's URL the freshness gate should check. At N=1 this is ALWAYS the
// single STAGING_URL; the advisory marker (if present) only names the slot id and surfaces its
// last verified token. Credential-free — reads a local file, never the control branch. N=3 is
// the one deferred seam (resolve by expectedToken / --slot; see plan §8.2).
function resolveStagingSlotUrl() {
  let marker = null;
  try {
    const p = join(ROOT, MARKER_FILE);
    if (existsSync(p)) marker = JSON.parse(readFileSync(p, 'utf8'));
  } catch { marker = null; }
  const slotId = marker && Number.isInteger(marker.slotId) ? marker.slotId : 1;
  const markerToken = marker && marker.token != null ? String(marker.token) : null;
  return { url: STAGING_URL, slotId, markerToken };
}

const REMOTE = 'origin';
const ARGV = process.argv.slice(2);
const CONFIRMED = ARGV.includes('--yes');
// Deliberate, loud override for when staging genuinely can't be verified (its Pages host is
// down, etc.). Requires a conscious flag — the freshness gate never silently no-ops.
const SKIP_STAGING_CHECK = ARGV.includes('--skip-staging-check');

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...opts }).trim();
}
function gitTry(args, opts = {}) {
  try { return { ok: true, out: git(args, opts) }; }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || ''), err: e }; }
}
function lines(s) { return s.split('\n').map(x => x.trim()).filter(Boolean); }

function fail(msg) {
  console.error(`promote: ${msg}`);
  process.exit(1);
}

const ROOT = git(['rev-parse', '--show-toplevel']);
process.chdir(ROOT);

// --- Step 1: fetch both refs fresh, so the preview can never be stale -------
console.log(`promote: fetching ${REMOTE}/${TRUNK} and ${REMOTE}/${PRODUCTION_BRANCH}…`);
const fetchTrunk = gitTry(['fetch', REMOTE, TRUNK]);
if (!fetchTrunk.ok) fail(`could not fetch ${REMOTE}/${TRUNK}:\n${fetchTrunk.out}`);

const fetchProd = gitTry(['fetch', REMOTE, PRODUCTION_BRANCH]);
if (!fetchProd.ok) {
  fail(
    `could not fetch ${REMOTE}/${PRODUCTION_BRANCH} — it may not exist yet.\n${fetchProd.out}\n` +
    `promote: this is expected until plan Phase 0.2 creates it:\n` +
    `  git branch ${PRODUCTION_BRANCH} ${REMOTE}/${TRUNK} && git push ${REMOTE} ${PRODUCTION_BRANCH}\n` +
    `promote: (and Phase 0.3 must repoint Pages to it) before this script can run.`
  );
}

const trunkRef = `${REMOTE}/${TRUNK}`;
const prodRef = `${REMOTE}/${PRODUCTION_BRANCH}`;
const trunkSha = git(['rev-parse', trunkRef]);
const prodSha = git(['rev-parse', prodRef]);

// The ?v= cache-bust token of the trunk commit we're about to promote — the one generic marker
// we compare against BOTH staging (the freshness gate below) and the live site (Step 6).
// extractVersionToken is a hoisted function declaration (defined lower), so it is callable here.
const expectedToken = extractVersionToken(git(['show', `${trunkRef}:index.html`]));

// --- Step 2: preview — print EXACTLY what would go live, before doing anything ---
if (trunkSha === prodSha) {
  console.log(`promote: ${PRODUCTION_BRANCH} already matches ${TRUNK} (${prodSha.slice(0, 8)}) — nothing to promote.`);
  process.exit(0);
}

const range = `${prodRef}..${trunkRef}`;
const commitLog = lines(git(['log', '--oneline', range]));
const diffStat = lines(git(['diff', '--stat', prodRef, trunkRef]));

console.log('');
console.log('='.repeat(72));
console.log(`promote: THIS WILL GO LIVE at ${LIVE_URL}`);
console.log('='.repeat(72));
console.log(`  ${PRODUCTION_BRANCH} (${prodSha.slice(0, 8)})  ->  ${TRUNK} (${trunkSha.slice(0, 8)})`);
console.log(`  ${commitLog.length} commit(s) in range ${range}:`);
commitLog.forEach(c => console.log('    ' + c));
console.log('  Files changed:');
diffStat.forEach(l => console.log('    ' + l));
console.log('='.repeat(72));

// --- Step 2b: STAGING-FRESHNESS GATE ----------------------------------------
// Staging must be showing the EXACT commit we're about to promote. If it's behind (or
// unreachable), promoting would put production AHEAD of the review site — the drift this gate
// exists to prevent (2026-07-13). Reported in the preview; ENFORCED under --yes (Step 3b).
function fetchLiveToken(url) {
  try {
    const html = execFileSync('curl', ['-sS', '-L', '--max-time', '15', `${url}/index.html`], { encoding: 'utf8' });
    return { token: extractVersionToken(html) };
  } catch (e) {
    return { error: e.message };
  }
}
const slot = resolveStagingSlotUrl();
const slotName = `staging slot ${slot.slotId}`;
const staging = fetchLiveToken(stripSlash(slot.url));
const stagingFresh = !staging.error && !!expectedToken && staging.token === expectedToken;
console.log('');
if (!expectedToken) {
  console.log('promote: staging freshness — ⚠️ no app.js?v= token in the promoted index.html; cannot verify.');
} else if (staging.error) {
  console.log(`promote: staging freshness — ⚠️ could not reach ${slotName} at ${slot.url} (${staging.error}).`);
} else if (stagingFresh) {
  console.log(`promote: staging freshness — ✅ ${slotName} serves ?v=${expectedToken}, matching the trunk commit.`);
} else {
  console.log(`promote: staging freshness — 🔴 ${slotName.toUpperCase()} IS BEHIND. Trunk = ?v=${expectedToken}, ${slotName} = ?v=${staging.token || '(none)'}.`);
  console.log(`promote:   ${slotName} is NOT showing what you're about to promote — deploy this commit to staging and review it first.`);
}
// Marker/trunk drift note — only when the advisory marker actually carries a token.
if (slot.markerToken && expectedToken && slot.markerToken !== expectedToken) {
  console.log(`promote:   note — the last-deploy marker recorded ?v=${slot.markerToken} for ${slotName}, which differs from the trunk token ?v=${expectedToken}.`);
}

// --- Step 3: hard STOP-gate — mirrors the /clasp prod-deploy posture ---------
if (!CONFIRMED) {
  console.log('');
  console.log('promote: PREVIEW ONLY — no changes made, nothing was pushed.');
  console.log('promote: *** this is an irreversible go-live step ***');
  console.log('promote: re-run with --yes ONLY after Jac has explicitly said "promote it" for the range above.');
  process.exit(0);
}

console.log('');
console.log('promote: --yes given — proceeding with the promotion above.');

// --- Step 3b: ENFORCE the staging-freshness gate before touching production ---
if (!stagingFresh && !SKIP_STAGING_CHECK) {
  fail(
    `refusing to promote — ${slotName} is not confirmed fresh (see above). Promoting now would put ` +
    `production AHEAD of the staging review site — exactly the drift this gate prevents.\n` +
    `promote: fix it — from the merged feature branch run \`node tools/deploy-staging.mjs\`, confirm ` +
    `${slotName} serves ?v=${expectedToken || '(the trunk token)'}, then re-run promote.\n` +
    `promote: if staging genuinely can't be reached (its host is down) and you accept the risk, ` +
    `re-run with --skip-staging-check to override this deliberately.`
  );
}
if (!stagingFresh && SKIP_STAGING_CHECK) {
  console.log(`promote: ⚠️ --skip-staging-check given — proceeding WITHOUT a fresh-${slotName} confirmation (deliberate override).`);
}

// --- Step 4: refuse anything that is not a clean fast-forward ---------------
const ff = gitTry(['merge-base', '--is-ancestor', prodRef, trunkRef]);
if (!ff.ok) {
  fail(
    `${PRODUCTION_BRANCH} is NOT an ancestor of ${TRUNK} — production has diverged ` +
    `(hotfixed directly, or rewritten) and cannot fast-forward safely.\n` +
    `promote: refusing to push. A human must reconcile ${PRODUCTION_BRANCH} manually ` +
    `(rebase the divergence onto ${TRUNK}, or deliberately reset ${PRODUCTION_BRANCH}) ` +
    `before promote.mjs can run again. There is no --force path in this script.`
  );
}

// --- Step 5: fast-forward + push production ----------------------------------
// Pushes the trunk's exact commit straight to refs/heads/production without needing a
// local checkout of `production` — git only accepts this as an ordinary (non-force)
// push because Step 4 already proved it is a fast-forward.
console.log(`promote: pushing ${trunkRef} -> ${REMOTE}/${PRODUCTION_BRANCH}…`);
const push = gitTry(['push', REMOTE, `${trunkRef}:refs/heads/${PRODUCTION_BRANCH}`]);
if (!push.ok) {
  fail(
    `push rejected:\n${push.out}\n` +
    `promote: ${PRODUCTION_BRANCH} may have moved since the preview above — re-run for a fresh preview.`
  );
}
console.log(`promote: pushed. ${PRODUCTION_BRANCH} now at ${trunkSha.slice(0, 8)}. ${LIVE_URL} should update shortly.`);

// --- Step 6: verify the live site actually serves the new bytes -------------
// The ?v= cache-bust token (bumped on every deploy per CLAUDE.md) is the one
// generic, feature-agnostic marker this script can check without knowing what any
// given promotion actually changed. The token itself lives in index.html's script/
// link tags (not inside app.js's own bytes), so: pull the expected token from the
// promoted commit's index.html, confirm the LIVE index.html reports the same token,
// and confirm the live app.js is reachable at that exact versioned URL.
function extractVersionToken(html) {
  const m = html.match(/app\.js\?v=([A-Za-z0-9._-]+)/);
  return m ? m[1] : null;
}

// expectedToken was computed up front (used by the staging-freshness gate too).
if (!expectedToken) {
  console.log('promote: WARNING — could not find an app.js?v= token in the promoted index.html; skipping live-bytes verification.');
  console.log('promote: push succeeded. Verify the live site manually.');
  process.exit(0);
}

console.log(`promote: verifying ${LIVE_URL} serves ?v=${expectedToken}…`);

let liveHtml;
try {
  liveHtml = execFileSync('curl', ['-sS', '-L', '--max-time', '15', `${LIVE_URL}/index.html`], { encoding: 'utf8' });
} catch (e) {
  console.log(`promote: WARNING — could not curl ${LIVE_URL}/index.html to verify (${e.message}).`);
  console.log('promote: push succeeded, but live-bytes verification could not run. Verify manually:');
  console.log(`  curl -s ${LIVE_URL}/index.html | grep 'app.js?v='`);
  process.exit(0);
}

const liveToken = extractVersionToken(liveHtml);
if (liveToken !== expectedToken) {
  console.log(`promote: WARNING — live site not updated yet. Expected ?v=${expectedToken}, got ?v=${liveToken || '(not found)'}.`);
  console.log('promote: push succeeded — Pages can take ~1 min to propagate. Re-check shortly:');
  console.log(`  curl -s ${LIVE_URL}/index.html | grep 'app.js?v='`);
  process.exit(0); // the push itself succeeded; this is a propagation-timing warning, not a script failure
}

let assetStatus = null;
try {
  assetStatus = execFileSync(
    'curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '15', `${LIVE_URL}/app.js?v=${expectedToken}`],
    { encoding: 'utf8' }
  ).trim();
} catch (e) {
  console.log(`promote: index.html confirmed at ?v=${expectedToken}, but could not fetch app.js to double-check (${e.message}).`);
  process.exit(0);
}

if (assetStatus === '200') {
  console.log(`promote: ✅ live site confirmed serving ?v=${expectedToken} (app.js -> HTTP 200). Promotion complete.`);
} else {
  console.log(`promote: WARNING — index.html is at ?v=${expectedToken}, but app.js?v=${expectedToken} returned HTTP ${assetStatus}.`);
  console.log('promote: push succeeded; investigate the asset response before telling Jac it is fully live.');
}
