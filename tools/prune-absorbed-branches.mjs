#!/usr/bin/env node
/**
 * prune-absorbed-branches.mjs — delete remote branches whose content is ALREADY on trunk.
 *
 * WHY THIS EXISTS
 * ---------------
 * By 2026-08-02 the repo carried ~296 remote branches. Most were dead, but "dead" could not be
 * determined by eye, and the obvious git answers are all WRONG here:
 *
 *   - `git branch --merged` is useless: the repo SQUASH-merges, so a merged branch's commits never
 *     appear on trunk and it reports as unmerged forever.
 *   - Comparing commit SHAs is useless for the same reason.
 *
 * The only reliable question is about CONTENT: "if I merged this into trunk, would anything
 * change?" That is `git merge-tree --write-tree` — if the resulting tree equals trunk's tree, the
 * branch contributes nothing and is safe to delete.
 *
 * THE SHALLOW-CLONE TRAP (read this before trusting any output)
 * ------------------------------------------------------------
 * Cloud sessions clone shallow. On the sandboxed git proxy, **any plain `git fetch` re-applies
 * `.git/shallow`**, which truncates trunk to ONE reachable commit. Every `merge-base` against it
 * then fails and every branch looks like unrelated history — or, just as bad, the absorbed set comes
 * back empty and you conclude there is nothing to delete. `git rev-parse --is-shallow-repository`
 * can answer `false` while `.git/shallow` is still on disk, so it is NOT a trustworthy check.
 *
 * The reliable tell: `git rev-list --max-parents=0 origin/trunk` returning trunk's own HEAD. A
 * repository's root commit can never be its own tip.
 *
 * This script repairs the state itself and then ASSERTS trunk is deep before measuring anything.
 *
 * USAGE
 *   node tools/prune-absorbed-branches.mjs            # dry run — lists what WOULD be deleted
 *   node tools/prune-absorbed-branches.mjs --yes      # actually delete
 *   node tools/prune-absorbed-branches.mjs --skip-pr-check --yes   # only if `gh` is unavailable
 *
 * SAFETY
 *   - Never touches trunk, production, or the branch you are on.
 *   - Never touches a branch that is the head of an OPEN pull request.
 *   - Never touches a branch that contributes ANY content not already on trunk.
 *   - Dry run is the default. Deleting requires --yes.
 *
 * NOTE: the sandboxed cloud git proxy returns HTTP 403 for ref deletion, so the --yes path must be
 * run from a session with real push rights (a local machine, typically).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const ARGV = process.argv.slice(2);
const DO_IT = ARGV.includes('--yes');
const SKIP_PR = ARGV.includes('--skip-pr-check');

const PROTECTED = new Set(['trunk', 'production', 'HEAD']);

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}
function gitQuiet(args) {
  try { return git(args); } catch { return null; }
}

// ── 1. repair the shallow state, then PROVE it took ────────────────────────────
function repairShallow() {
  const shallowPath = '.git/shallow';
  if (existsSync(shallowPath)) rmSync(shallowPath, { force: true });
  try {
    git(['fetch', 'origin', '+refs/heads/*:refs/remotes/origin/*', '--prune', '--quiet']);
  } catch (e) {
    console.error('warn: fetch failed, continuing with local refs —', e.message.split('\n')[0]);
  }
  // the fetch itself can re-write it
  if (existsSync(shallowPath)) rmSync(shallowPath, { force: true });

  const depth = Number(git(['rev-list', '--count', 'origin/trunk']));
  const roots = gitQuiet(['rev-list', '--max-parents=0', 'origin/trunk']) || '';
  const head = git(['rev-parse', 'origin/trunk']);

  if (depth < 100 || roots.split('\n').includes(head)) {
    console.error(
      `\nFATAL: origin/trunk is still shallow (${depth} reachable commit(s)).\n` +
      `Every comparison below would be garbage, so nothing will be measured.\n` +
      `Fix manually, then re-run:\n` +
      `  rm -f .git/shallow && git fetch origin '+refs/heads/*:refs/remotes/origin/*'\n`
    );
    process.exit(2);
  }
  return depth;
}

// ── 2. branches that are the head of an open PR ────────────────────────────────
function openPrHeads() {
  if (SKIP_PR) {
    console.error('WARNING: --skip-pr-check given. Branches behind OPEN pull requests are NOT excluded.');
    return new Set();
  }
  try {
    const raw = execFileSync('gh', ['pr', 'list', '--state', 'open', '--limit', '500', '--json', 'headRefName'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return new Set(JSON.parse(raw).map((p) => p.headRefName));
  } catch {
    console.error(
      '\nFATAL: could not list open PRs via `gh`. Refusing to guess — a branch behind an open PR\n' +
      'must never be deleted. Install/authenticate `gh`, or pass --skip-pr-check if you have\n' +
      'independently confirmed no open PR points at these branches.\n'
    );
    process.exit(2);
  }
}

// ── 3. classify ────────────────────────────────────────────────────────────────
const depth = repairShallow();
const prHeads = openPrHeads();
const current = gitQuiet(['branch', '--show-current']);
const trunkTree = git(['rev-parse', 'origin/trunk^{tree}']);

const refs = git(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin'])
  .split('\n')
  .map((r) => r.replace(/^origin\//, ''))
  .filter((b) => b && b !== 'HEAD');

const absorbed = [];
const kept = { protectedRef: 0, openPr: [], current: [], hasWork: 0, unrelated: 0 };

for (const b of refs) {
  if (PROTECTED.has(b)) { kept.protectedRef++; continue; }
  if (b === current) { kept.current.push(b); continue; }
  if (prHeads.has(b)) { kept.openPr.push(b); continue; }

  const ref = `origin/${b}`;
  if (!gitQuiet(['merge-base', 'origin/trunk', ref])) { kept.unrelated++; continue; }

  let tree = null;
  try { tree = git(['merge-tree', '--write-tree', 'origin/trunk', ref]); } catch { kept.hasWork++; continue; }
  if (tree === trunkTree) absorbed.push(b); else kept.hasWork++;
}

// ── 4. report ──────────────────────────────────────────────────────────────────
console.log(`\ntrunk depth ...... ${depth} commits (deep — measurements are valid)`);
console.log(`branches ......... ${refs.length}`);
console.log(`absorbed ......... ${absorbed.length}  <- contribute nothing to trunk`);
console.log(`carrying work .... ${kept.hasWork}`);
console.log(`unrelated hist ... ${kept.unrelated}`);
console.log(`held: open PR .... ${kept.openPr.length}${kept.openPr.length ? '  (' + kept.openPr.join(', ') + ')' : ''}`);
console.log(`held: current .... ${kept.current.length ? kept.current.join(', ') : '—'}`);

if (!absorbed.length) { console.log('\nNothing to prune.\n'); process.exit(0); }

console.log('\n' + (DO_IT ? 'DELETING:' : 'WOULD DELETE (dry run):'));
for (const b of absorbed) console.log('  ' + b);

if (!DO_IT) {
  console.log(`\n${absorbed.length} branch(es). Re-run with --yes to delete.`);
  console.log('Each one is recoverable from its closed PR or reflog even after deletion.\n');
  process.exit(0);
}

let ok = 0, fail = 0;
for (const b of absorbed) {
  try { git(['push', 'origin', '--delete', b]); console.log(`  deleted ${b}`); ok++; }
  catch (e) {
    fail++;
    const msg = e.message || '';
    console.error(`  FAILED  ${b}${msg.includes('403') ? '  (HTTP 403 — this environment forbids ref deletion; run from a session with real push rights)' : ''}`);
  }
}
console.log(`\ndeleted ${ok}, failed ${fail}\n`);
process.exit(fail ? 1 : 0);
