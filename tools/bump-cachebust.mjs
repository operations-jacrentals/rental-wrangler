#!/usr/bin/env node
// ── tools/bump-cachebust.mjs — auto-bump the ?v= cache-bust token when a branch
// changes a served, versioned file but hasn't bumped the token yet ───────────────
//
// WHY. In deck mode `deploy-staging.mjs` does NOT bump ?v= (the immutable d/<id>/
// folder path is the *staging* cache guarantee). But PRODUCTION is served from the
// branch root at app.jacrentals.com/app.js?v=<token> with max-age=600, and the
// service worker keys its cache on ?v= — so a deck ship that promotes under an
// UNCHANGED token means the CDN + installed PWAs keep serving the pre-change bytes.
// This closes that gap: run at integration time (the /merge gate runs it for you),
// it lands a committed ?v= bump on the feature branch so production gets fresh bytes.
//
// It is IDEMPOTENT and SCOPED: it bumps only when app.js/style.css/rule-usage.js
// actually differ from trunk AND the shared token still equals trunk's. No served
// change, or an already-bumped token → it's a clean no-op. Pairs with the CI guard
// ci/check-cachebust.mjs, which fails a ship that skipped the bump.
//
// Usage:
//   node tools/bump-cachebust.mjs [--base <ref>] [--no-commit]
//     --base <ref>   compare against this ref instead of origin/trunk
//     --no-commit    write the bumped index.html but don't commit it

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readCacheBustState, bumpVerdict, bumpTokenInHtml } from './lib/cachebust.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'index.html');

const args = process.argv.slice(2);
const noCommit = args.includes('--no-commit');
const baseIdx = args.indexOf('--base');
const base = baseIdx >= 0 ? args[baseIdx + 1] : 'origin/trunk';

const git = (a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const gitTry = (a) => { try { return git(a); } catch { return null; } };

function main() {
  // Best-effort refresh of the base tip so a local run compares against current trunk.
  // If offline / no remote, fall through and use whatever origin/trunk we already have.
  if (base === 'origin/trunk') gitTry(['fetch', 'origin', 'trunk']);

  let state;
  try {
    state = readCacheBustState((a) => git(a), base);
  } catch (e) {
    console.error(`bump-cachebust: could not read git state vs ${base} — ${String(e.message || e).split('\n')[0]}`);
    console.error(`bump-cachebust: is ${base} fetched? (run: git fetch origin trunk)`);
    process.exit(1);
  }

  if (state.baseError) { console.error(`bump-cachebust: ${base}:index.html — ${state.baseError}`); process.exit(1); }
  if (state.headError) { console.error(`bump-cachebust: HEAD:index.html — ${state.headError} Fix index.html by hand first.`); process.exit(1); }

  const verdict = bumpVerdict(state);
  if (!verdict.needsBump) {
    console.log(`bump-cachebust: no bump needed — ${verdict.reason}.`);
    return;
  }

  // Bump the working-tree index.html (it should equal HEAD's at integration time).
  const res = bumpTokenInHtml(readFileSync(INDEX, 'utf8'));
  if (res.error) { console.error(`bump-cachebust: ${res.error} Fix index.html by hand first.`); process.exit(1); }
  writeFileSync(INDEX, res.html);
  console.log(`bump-cachebust: ${verdict.reason}`);
  console.log(`bump-cachebust: bumped shared ?v= token ${res.oldToken} → ${res.newToken} in index.html.`);

  if (noCommit) {
    console.log('bump-cachebust: --no-commit — index.html left staged in the working tree (commit it before /merge).');
    return;
  }
  git(['add', '--', 'index.html']);
  git(['commit', '-m', `Cache-bust: bump ?v= to ${res.newToken} (served files changed vs trunk)`]);
  console.log(`bump-cachebust: committed the bump. Push it so it rides through /merge → /promote to production.`);
}

main();
