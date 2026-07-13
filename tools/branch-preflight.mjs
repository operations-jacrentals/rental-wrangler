#!/usr/bin/env node
// branch-preflight.mjs — orient the session on the trunk-based flow at start.
//
// WHY THIS EXISTS
// The flow is: short feature branch off `main` (the trunk)  →  deploy-staging (review)
// →  "merge it" (PR → main, integrated but NOT live)  →  "promote it" (main → production,
// the ONLY go-live). A skill can only *describe* that; this script, wired into the
// SessionStart hook (see .claude/settings.json), makes the harness print where the
// current branch sits EVERY session on every machine — report-only, never blocks.
//
//   node tools/branch-preflight.mjs   # report-only (SessionStart hook)
//
// (The old area/<domain> + staging + master-spec flow — and the `--ensure` branch
// creation + spec-sync pull — were retired with the move to trunk-based development.)
//
// It ALWAYS exits 0 — a preflight must never block a session from starting.

import { execFileSync } from 'node:child_process';

const REMOTE = 'origin';
// TRUNK is resolved dynamically inside main() (prefer 'trunk' if the remote has it, else 'main')
// so this survives the main -> trunk rename with no code change.
const RELEASE = 'production';   // the release-pointer branch GitHub Pages serves as PRODUCTION
const NET_TIMEOUT = 8000;

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', timeout: NET_TIMEOUT, ...opts }).trim();
}
function gitTry(args, opts = {}) {
  try { return { ok: true, out: git(args, opts) }; }
  catch (e) { return { ok: false, out: ((e.stdout || '') + (e.stderr || '')).trim(), err: e }; }
}

function main() {
  const top = gitTry(['rev-parse', '--show-toplevel']);
  if (!top.ok) return; // not a git repo → nothing to enforce
  process.chdir(top.out);

  const branch = gitTry(['rev-parse', '--abbrev-ref', 'HEAD']).out || '(detached)';

  // One best-effort network probe for the trunk + release branches. Offline is fine —
  // a live ls-remote so a shallow clone's missing local refs never read as "gone".
  const ls = gitTry(['ls-remote', '--heads', REMOTE, 'main', 'trunk', RELEASE]);
  const online = ls.ok;
  const has = (b) => online && new RegExp(`refs/heads/${b}$`, 'm').test(ls.out);
  // main -> trunk rename transition: prefer 'trunk' once the remote has it, else 'main'.
  const TRUNK = has('trunk') ? 'trunk' : 'main';
  const trunkUp = has(TRUNK);
  const releaseUp = has(RELEASE);

  const L = [];
  L.push('── branch preflight ─────────────────────────────────────────');
  L.push(`flow:  feature branch off ${TRUNK}  →  deploy-staging (review)  →  "merge it" (${TRUNK})  →  "promote it" (${RELEASE} = live)`);
  L.push(`here:  ${branch}`);

  // Classify the current branch and print the right guardrail.
  if (branch === TRUNK)
    L.push(`⛔ You're on ${TRUNK} — the TRUNK (protected, integrated but NOT live). Do NOT commit here. Cut a feature branch:  git checkout -b claude/<task> ${REMOTE}/${TRUNK}`);
  else if (branch === RELEASE)
    L.push(`⛔ You're on ${RELEASE} — the LIVE release pointer. Never commit here; it only moves via \`node tools/promote.mjs --yes\` (Jac's explicit call).`);
  else if (branch.startsWith('area/'))
    L.push(`⚠  You're on a FROZEN area branch (legacy — not a routing target). Don't build here — cut a feature branch off ${TRUNK}:  git checkout -b claude/<task> ${REMOTE}/${TRUNK}`);
  else
    L.push(`•  Feature branch. When done: deploy-staging (review) → "merge it" (PR → ${TRUNK}) → wait → "promote it" (${RELEASE}, Jac's call).`);

  // Report the trunk/release topology.
  if (!online)
    L.push(`(couldn't reach ${REMOTE} — skipped the ${TRUNK}/${RELEASE} existence check)`);
  else
    L.push(`${TRUNK}: ${trunkUp ? 'exists ✅' : 'MISSING ❌'}   ${RELEASE}: ${releaseUp ? 'exists ✅' : 'MISSING ❌'}`);
  L.push('─────────────────────────────────────────────────────────────');
  console.log(L.join('\n'));
}

try { main(); } catch { /* preflight must never block a session */ }
process.exit(0);
