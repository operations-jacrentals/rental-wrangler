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

// staging-control is listed defensively: it does not exist on origin today, but it carries the
// slot-lease control.json and must never be pruned if it is ever recreated.
const PROTECTED = new Set(['trunk', 'production', 'HEAD', 'staging-control']);

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
    // NEVER downgrade this to a warning. The depth assertion below proves only that trunk is
    // currently deep — which stays true from an EARLIER successful fetch — so it cannot detect
    // that THIS run's refs are stale. Continuing here would classify against cached refs while
    // printing "measurements are valid", and a branch that gained commits since the last fetch
    // would be deleted as "absorbed". On this repo's flaky git proxy that is a live scenario.
    console.error(
      `\nFATAL: could not refresh refs from origin — ${e.message.split('\n')[0]}\n` +
      `Refusing to classify against possibly-stale refs. Re-run once the network settles.\n`
    );
    process.exit(2);
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
  const LIMIT = 500;
  try {
    const raw = execFileSync('gh', ['pr', 'list', '--state', 'open', '--limit', String(LIMIT), '--json', 'headRefName'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const prs = JSON.parse(raw);
    // `gh` truncates SILENTLY at --limit: a partial list means some open-PR head is missing from
    // the guard, and any omitted head that happens to net to zero against trunk would be deleted
    // out from under live work. Refuse rather than delete on an incomplete guard.
    if (prs.length >= LIMIT) {
      console.error(
        `\nFATAL: \`gh pr list\` returned ${prs.length} PRs, at or above the --limit of ${LIMIT}.\n` +
        `The list may be truncated, so the open-PR guard cannot be trusted. Raise LIMIT in this\n` +
        `script and re-run.\n`
      );
      process.exit(2);
    }
    return new Set(prs.map((p) => p.headRefName));
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
  // Record the exact SHA this verdict was computed from, so the delete can be pinned to it.
  if (tree === trunkTree) absorbed.push({ name: b, sha: git(['rev-parse', ref]) });
  else kept.hasWork++;
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
for (const b of absorbed) console.log(`  ${b.name}  @ ${b.sha.slice(0, 8)}`);

if (!DO_IT) {
  console.log(`\n${absorbed.length} branch(es). Re-run with --yes to delete.`);
  console.log('Each one is recoverable from its closed PR or reflog even after deletion.\n');
  process.exit(0);
}

let ok = 0, fail = 0, stale = 0;
for (const { name, sha } of absorbed) {
  // Pin the delete to the SHA the "absorbed" verdict was computed from. A plain
  // `push --delete <name>` is an unconditional delete-by-name: if the branch moved between
  // classification and now (someone pushed to it, or the name was reused by new work), it would be
  // deleted anyway. --force-with-lease makes the remote reject the delete unless it still points
  // at the SHA we actually verified.
  try {
    git(['push', 'origin', `--force-with-lease=refs/heads/${name}:${sha}`, `:refs/heads/${name}`]);
    console.log(`  deleted ${name}`);
    ok++;
  } catch (e) {
    const msg = e.message || e.stderr?.toString() || '';
    if (/stale info|force-with-lease|non-fast-forward|rejected/i.test(msg)) {
      stale++;
      console.error(`  SKIPPED ${name}  (moved since it was classified — re-run to re-evaluate)`);
    } else {
      fail++;
      console.error(`  FAILED  ${name}${msg.includes('403') ? '  (HTTP 403 — this environment forbids ref deletion; run from a session with real push rights)' : ''}`);
    }
  }
}
if (stale) console.log(`\n${stale} branch(es) skipped because they moved after classification — that guard working as intended.`);
console.log(`\ndeleted ${ok}, failed ${fail}\n`);
process.exit(fail ? 1 : 0);
