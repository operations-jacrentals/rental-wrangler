#!/usr/bin/env node
// ── ci/check-cachebust.mjs — the guarantee that no ship silently serves stale bytes ──
//
// Fails when a branch changes a served, versioned file (app.js / style.css /
// rule-usage.js) vs trunk but does NOT bump the shared ?v= cache-bust token in
// index.html. Without the bump, production (served from the branch root with
// max-age=600, and cached by the service worker keyed on ?v=) keeps serving the
// pre-change app.js under the same URL — the exact stale-delivery trap that made a
// manual ?v= bump necessary after the deck deploy path shipped code under an
// unchanged token. Deck mode intentionally doesn't bump ?v= (staging's immutable
// folder path is its cache key); this guard is what forces the bump before trunk.
//
// The fix is one command — `node tools/bump-cachebust.mjs` (or just let /merge run
// it) — so a red here is trivially cleared. Compares TIPS (trunk vs HEAD), so it
// also catches a token that collides with trunk's, and needs no merge-base history
// (safe in a shallow CI checkout). Runs locally and as a step in the `smoke` CI job.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readCacheBustState, bumpVerdict } from '../tools/lib/cachebust.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const baseIdx = process.argv.indexOf('--base');
const base = baseIdx >= 0 ? process.argv[baseIdx + 1] : 'origin/trunk';

const git = (a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const gitTry = (a) => { try { return git(a); } catch { return null; } };

// Make sure the base tip is present (shallow CI checkout won't have origin/trunk yet).
if (base === 'origin/trunk') gitTry(['fetch', '--no-tags', '--depth=1', 'origin', 'trunk']);

let state;
try {
  state = readCacheBustState((a) => git(a), base);
} catch (e) {
  console.error(`check-cachebust: could not compare against ${base} — ${String(e.message || e).split('\n')[0]}`);
  console.error(`check-cachebust: ensure ${base} is fetched (CI: the smoke job fetches trunk; local: git fetch origin trunk).`);
  process.exit(1);
}

if (state.baseError || state.headError) {
  console.error(`check-cachebust: 🔴 index.html cache-bust token is malformed — ${state.headError || state.baseError}`);
  process.exit(1);
}

const verdict = bumpVerdict(state);
if (verdict.needsBump) {
  console.error('check-cachebust: 🔴 served files changed but the ?v= cache-bust token was NOT bumped.');
  console.error(`  ${verdict.reason}.`);
  console.error('  Production serves the branch root with max-age=600 and the service worker caches by ?v=,');
  console.error('  so promoting this under an unchanged token would serve the OLD app.js to already-loaded devices.');
  console.error('  Fix (one command):  node tools/bump-cachebust.mjs   (or let /merge run it for you), then push.');
  process.exit(1);
}

console.log(`check-cachebust: ✓ ${verdict.reason}.`);
