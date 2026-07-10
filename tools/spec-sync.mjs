#!/usr/bin/env node
// spec-sync.mjs — cross-area spec propagation for Rental Wrangler.
//
// WHY THIS EXISTS
// Per-area specs live in docs/specs/<slug>.md and are edited on many area/task
// branches AT THE SAME TIME. Without a shared surface, area B can't see area A's
// in-flight spec change until A merges to main — which couples "spec published"
// to "code published" and causes simultaneous projects to collide.
//
// This tool keeps a single long-lived, SPEC-ONLY branch (`master-spec`) that every
// session reads from and writes to, so design intent propagates across all parallel
// areas *before* any code ships. It is spec-only by construction: every operation is
// path-scoped to docs/specs/, so syncing specs can never drag half-built code along.
//
// USAGE
//   node tools/spec-sync.mjs down            # pull everyone's latest specs into your tree (run at session START)
//   node tools/spec-sync.mjs up  "<message>" # push YOUR changed spec files up to master-spec (every ~2h + before ending)
//   node tools/spec-sync.mjs status          # show what would sync each way
//   node tools/spec-sync.mjs seed            # create master-spec from main's docs/specs (one-time bootstrap)
//
// SAFETY
//   `up` pushes ONLY the spec files YOU changed (vs origin/main) — it never overwrites
//   a sibling area's spec, even if your working tree holds a stale copy of it. Concurrent
//   pushes are handled by a fetch→re-overlay→retry loop (per-file last-writer-wins, scoped
//   to files you own). `down` refuses to clobber uncommitted local spec edits unless --force.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const REMOTE = 'origin';
const SPEC_BRANCH = 'master-spec';
const SPEC_DIR = 'docs/specs';
const BASE = `${REMOTE}/main`;

const ARGV = process.argv.slice(2);
const CMD = ARGV[0];
const FORCE = ARGV.includes('--force');

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...opts }).trim();
}
function gitTry(args, opts = {}) {
  try { return { ok: true, out: git(args, opts) }; }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || ''), err: e }; }
}
function lines(s) { return s.split('\n').map(x => x.trim()).filter(Boolean); }

const ROOT = git(['rev-parse', '--show-toplevel']);
process.chdir(ROOT);

function remoteBranchExists() {
  const r = gitTry(['ls-remote', '--heads', REMOTE, SPEC_BRANCH]);
  return r.ok && r.out.length > 0;
}

// A stale local origin/main ref makes the merge-base ancient, which makes `up`
// think every spec file is "mine" (and would clobber siblings). Always refresh
// the base before deciding what's mine. Best-effort — offline just uses local.
function ensureFreshBase() {
  gitTry(['fetch', REMOTE, 'main']);
}

// Files this branch/worktree has actually changed under docs/specs — the only files
// `up` is allowed to write to master-spec. Union of committed-since-main + staged +
// unstaged + untracked. Returns a Set of repo-relative paths.
function myChangedSpecFiles() {
  ensureFreshBase();
  const set = new Set();
  const add = (out) => lines(out).forEach(f => { if (f.startsWith(SPEC_DIR + '/')) set.add(f); });
  const mb = gitTry(['merge-base', 'HEAD', BASE]);
  if (mb.ok && mb.out) add(gitTry(['diff', '--name-only', `${mb.out}...HEAD`, '--', SPEC_DIR]).out);
  add(gitTry(['diff', '--name-only', '--', SPEC_DIR]).out);            // unstaged
  add(gitTry(['diff', '--name-only', '--cached', '--', SPEC_DIR]).out); // staged
  add(gitTry(['ls-files', '--others', '--exclude-standard', '--', SPEC_DIR]).out); // untracked
  return set;
}

function freshWorktree() {
  gitTry(['worktree', 'prune']);
  const dir = join(tmpdir(), `rw-spec-sync-${process.pid}-${Date.now()}`);
  rmSync(dir, { recursive: true, force: true });
  return dir;
}
function removeWorktree(dir) {
  gitTry(['worktree', 'remove', '--force', dir]);
  rmSync(dir, { recursive: true, force: true });
  gitTry(['worktree', 'prune']);
}

function down() {
  if (!remoteBranchExists()) {
    console.log(`spec-sync: ${SPEC_BRANCH} does not exist on ${REMOTE} yet.`);
    console.log(`           Nothing to pull. Run \`node tools/spec-sync.mjs seed\` to create it.`);
    return;
  }
  const dirty = lines(git(['status', '--porcelain', '--', SPEC_DIR]));
  if (dirty.length && !FORCE) {
    console.error('spec-sync: you have uncommitted changes under docs/specs:');
    dirty.forEach(d => console.error('   ' + d));
    console.error('spec-sync: `up` them first (so they are not lost), or pass --force to overlay anyway.');
    process.exit(1);
  }
  git(['fetch', REMOTE, SPEC_BRANCH]);
  // Path-scoped checkout: brings docs/specs from master-spec into the working tree only.
  git(['checkout', `${REMOTE}/${SPEC_BRANCH}`, '--', SPEC_DIR]);
  gitTry(['reset', '-q', 'HEAD', '--', SPEC_DIR]); // unstage — leave overlay in working tree for review
  const changed = lines(git(['status', '--porcelain', '--', SPEC_DIR]));
  if (!changed.length) console.log('spec-sync: already up to date with master-spec.');
  else {
    console.log(`spec-sync: pulled ${changed.length} spec file(s) from master-spec into your working tree:`);
    changed.forEach(c => console.log('   ' + c));
    console.log('spec-sync: review, then commit them onto your branch if you want to keep the merged state.');
  }
}

function up(message) {
  const mine = [...myChangedSpecFiles()];
  if (!mine.length) { console.log('spec-sync: no spec changes of yours to push. Nothing to do.'); return; }
  const baseRef = remoteBranchExists() ? `${REMOTE}/${SPEC_BRANCH}` : BASE;
  if (remoteBranchExists()) git(['fetch', REMOTE, SPEC_BRANCH]);

  console.log(`spec-sync: pushing ${mine.length} spec file(s) to ${SPEC_BRANCH}:`);
  mine.forEach(f => console.log('   ' + f));

  const TMP = freshWorktree();
  try {
    git(['worktree', 'add', '--detach', TMP, baseRef]);
    for (let attempt = 1; attempt <= 5; attempt++) {
      // Overlay ONLY my files onto the latest master-spec tip.
      for (const f of mine) {
        const src = join(ROOT, f);
        const dst = join(TMP, f);
        if (existsSync(src)) { mkdirSync(dirname(dst), { recursive: true }); copyFileSync(src, dst); }
        else rmSync(dst, { force: true }); // I deleted this spec — mirror the deletion
      }
      git(['add', '-A', SPEC_DIR], { cwd: TMP });
      if (gitTry(['diff', '--cached', '--quiet'], { cwd: TMP }).ok) {
        console.log('spec-sync: master-spec already matches your specs. Nothing to push.');
        return;
      }
      git(['commit', '-m', message], { cwd: TMP });
      const pushed = gitTry(['push', REMOTE, `HEAD:refs/heads/${SPEC_BRANCH}`], { cwd: TMP });
      if (pushed.ok) { console.log(`spec-sync: synced to ${SPEC_BRANCH}. ✅`); return; }
      // Non-fast-forward: someone else pushed. Rebase our overlay onto their new tip and retry.
      console.log(`spec-sync: push rejected (attempt ${attempt}) — re-syncing on the new master-spec tip…`);
      git(['fetch', REMOTE, SPEC_BRANCH], { cwd: TMP });
      git(['reset', '--hard', `${REMOTE}/${SPEC_BRANCH}`], { cwd: TMP });
    }
    console.error('spec-sync: could not push after 5 attempts (heavy concurrent activity). Try again.');
    process.exit(1);
  } finally {
    removeWorktree(TMP);
  }
}

function status() {
  console.log(`spec-sync status  (branch: ${SPEC_BRANCH}, dir: ${SPEC_DIR})`);
  console.log(`master-spec exists on ${REMOTE}: ${remoteBranchExists() ? 'yes' : 'no'}`);
  const mine = [...myChangedSpecFiles()];
  console.log(mine.length ? `\nYour spec files that WOULD sync up (${mine.length}):` : '\nNo spec changes of yours to push.');
  mine.forEach(f => console.log('   ' + f));
  if (remoteBranchExists()) {
    gitTry(['fetch', REMOTE, SPEC_BRANCH]);
    const incoming = lines(gitTry(['diff', '--name-only', `HEAD:${SPEC_DIR}`, `${REMOTE}/${SPEC_BRANCH}:${SPEC_DIR}`]).out);
    console.log(incoming.length ? `\nSpec files that differ on master-spec (\`down\` to review) (${incoming.length}):` : '\nYour tree matches master-spec.');
    incoming.forEach(f => console.log('   ' + f));
  }
}

// One-time bootstrap: create a spec-only master-spec branch from origin/main's docs/specs.
// Uses a scratch index so the working tree and real index are never touched.
function seed() {
  if (remoteBranchExists()) { console.log(`spec-sync: ${SPEC_BRANCH} already exists — skipping seed.`); return; }
  git(['fetch', REMOTE, 'main']);
  const idx = join(tmpdir(), `rw-spec-seed-idx-${process.pid}-${Date.now()}`);
  const env = { ...process.env, GIT_INDEX_FILE: idx };
  try {
    git(['read-tree', '--empty'], { env });
    git(['read-tree', `--prefix=${SPEC_DIR}/`, `${BASE}:${SPEC_DIR}`], { env });
    // Add a marker file explaining the branch.
    const marker = join(tmpdir(), `rw-spec-marker-${process.pid}.md`);
    writeFileSync(marker, MARKER_TEXT);
    const blob = git(['hash-object', '-w', marker]);
    // Marker lives at the branch ROOT, outside SPEC_DIR, so `down` (scoped to
    // docs/specs) never drags it into an area tree.
    git(['update-index', '--add', '--cacheinfo', `100644,${blob},_MASTER-SPEC.md`], { env });
    rmSync(marker, { force: true });
    const tree = git(['write-tree'], { env });
    const commit = git(['commit-tree', tree, '-m', 'Seed master-spec: spec-only shared surface for cross-area sync']);
    git(['push', REMOTE, `${commit}:refs/heads/${SPEC_BRANCH}`]);
    console.log(`spec-sync: created ${SPEC_BRANCH} (spec-only) on ${REMOTE}. ✅`);
  } finally {
    rmSync(idx, { force: true });
  }
}

const MARKER_TEXT = `# master-spec — the shared, spec-only surface

This branch carries ONLY \`docs/specs/\` (the per-area specs + AREAS-ROADMAP index).
It exists so every area/task branch can see everyone else's **in-flight** spec changes
**before** any code is published to \`main\`.

**Do not** commit code or anything outside \`docs/specs/\` here.
**Do not** merge this branch into a code branch — sync is path-scoped via the tool:

    node tools/spec-sync.mjs down            # session START — pull everyone's latest specs
    node tools/spec-sync.mjs up "<message>"  # every ~2h + before ending — push your spec deltas
    node tools/spec-sync.mjs status          # see what would move each way

The tool only ever pushes the spec files YOU changed, so it can't clobber a sibling area's spec.
`;

switch (CMD) {
  case 'down': down(); break;
  case 'up': up(ARGV[1] && !ARGV[1].startsWith('--') ? ARGV[1] : `spec-sync: update specs (${new Date().toISOString()})`); break;
  case 'status': status(); break;
  case 'seed': seed(); break;
  default:
    console.log('Usage: node tools/spec-sync.mjs <down|up|status|seed> ["message"] [--force]');
    process.exit(CMD ? 1 : 0);
}
