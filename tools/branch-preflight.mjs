#!/usr/bin/env node
// branch-preflight.mjs — enforce the Rental Wrangler branch flow at session start.
//
// WHY THIS EXISTS
// The process is ALWAYS: task branch  ->  area/<domain>  ->  staging  ->  main.
// A skill can only *describe* that; it can't guarantee it. This script is wired into
// the SessionStart hook (see .claude/settings.json), so the harness runs it EVERY
// session on every machine (local + cloud) — no session can silently skip the flow.
//
// Default (hook) mode is READ-ONLY and non-fatal: it reports where the current branch
// sits in the flow, whether `staging` + `master-spec` exist, and the exact guardrails.
// `--ensure` mode (run by /start) actually creates staging + master-spec if missing and
// pulls the latest shared specs down.
//
//   node tools/branch-preflight.mjs            # report-only (SessionStart hook)
//   node tools/branch-preflight.mjs --ensure   # create staging + master-spec if missing, pull specs (/start)
//
// It ALWAYS exits 0 — a preflight must never block a session from starting.

import { execFileSync } from 'node:child_process';

const REMOTE = 'origin';
const TRUNK = 'main';
const INTEGRATION = 'staging';
const SPEC_BRANCH = 'master-spec';
const ENSURE = process.argv.includes('--ensure');
const NET_TIMEOUT = 8000;

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', timeout: NET_TIMEOUT, ...opts }).trim();
}
function gitTry(args, opts = {}) {
  try { return { ok: true, out: git(args, opts) }; }
  catch (e) { return { ok: false, out: ((e.stdout || '') + (e.stderr || '')).trim(), err: e }; }
}

function main() {
  // Not a git repo → nothing to enforce.
  const top = gitTry(['rev-parse', '--show-toplevel']);
  if (!top.ok) return;
  process.chdir(top.out);

  const branch = gitTry(['rev-parse', '--abbrev-ref', 'HEAD']).out || '(detached)';

  // One network probe for all three shared branches. Best-effort — offline is fine.
  const ls = gitTry(['ls-remote', '--heads', REMOTE, TRUNK, INTEGRATION, SPEC_BRANCH]);
  const online = ls.ok;
  const has = (b) => online && new RegExp(`refs/heads/${b}$`, 'm').test(ls.out);
  const stagingUp = has(INTEGRATION);
  const specUp = has(SPEC_BRANCH);

  const L = [];
  L.push('── branch preflight ─────────────────────────────────────────');
  L.push(`flow:  <domain>/<task>  →  area/<domain>  →  ${INTEGRATION}  →  ${TRUNK}   (never commit features to ${TRUNK})`);
  L.push(`here:  ${branch}`);

  // Classify the current branch and print the right guardrail.
  if (branch === TRUNK)
    L.push(`⛔ You're on ${TRUNK} — it's LIVE + protected. Do NOT commit here. Cut a task branch off an area.`);
  else if (branch === INTEGRATION)
    L.push(`⚠  You're on ${INTEGRATION} (integration surface). Don't build features here — promote to it via PR from an area.`);
  else if (branch === SPEC_BRANCH)
    L.push(`⚠  You're on ${SPEC_BRANCH} (spec-only). Only docs/specs/ belongs here — use \`node tools/spec-sync.mjs\`, don't hand-edit.`);
  else if (branch.startsWith('area/'))
    L.push(`•  You're on an AREA branch. Branch a task off it before building:  git checkout -b ${branch.slice(5)}/<task>`);
  else
    L.push(`•  Task/feature branch. When done: merge → area/<domain> (test locally) → ${INTEGRATION} → PR to ${TRUNK}.`);

  // Report the shared-branch topology.
  if (!online) {
    L.push(`(couldn't reach ${REMOTE} — skipped the staging/master-spec existence check)`);
  } else {
    L.push(`${INTEGRATION}: ${stagingUp ? 'exists ✅' : 'MISSING ❌'}   ${SPEC_BRANCH}: ${specUp ? 'exists ✅' : 'MISSING ❌'}`);
    if ((!stagingUp || !specUp) && !ENSURE)
      L.push(`   → run \`node tools/branch-preflight.mjs --ensure\` (or /start) to create the missing shared branch(es).`);
  }
  L.push('─────────────────────────────────────────────────────────────');
  console.log(L.join('\n'));

  if (!ENSURE || !online) return;

  // --ensure: create the shared branches if missing, then pull the latest specs.
  if (!stagingUp) {
    console.log(`preflight: creating ${INTEGRATION} from ${REMOTE}/${TRUNK}…`);
    const f = gitTry(['fetch', REMOTE, TRUNK]);
    const p = f.ok ? gitTry(['push', REMOTE, `${REMOTE}/${TRUNK}:refs/heads/${INTEGRATION}`]) : f;
    console.log(p.ok ? `preflight: ${INTEGRATION} created ✅` : `preflight: could not create ${INTEGRATION} — ${p.out}`);
  }
  if (!specUp) {
    console.log(`preflight: seeding ${SPEC_BRANCH}…`);
    const seed = spawnNode(['tools/spec-sync.mjs', 'seed']);
    if (!seed.ok) console.log(`preflight: seed failed — ${seed.out}`);
  }
  // Pull everyone's latest specs into the working tree (best-effort, never fatal).
  const down = spawnNode(['tools/spec-sync.mjs', 'down']);
  if (!down.ok && down.out) console.log(`preflight: spec-sync down note — ${down.out.split('\n')[0]}`);
}

function spawnNode(args) {
  try { return { ok: true, out: execFileSync('node', args, { encoding: 'utf8', timeout: NET_TIMEOUT }).trim() }; }
  catch (e) { return { ok: false, out: ((e.stdout || '') + (e.stderr || '')).trim() }; }
}

try { main(); } catch { /* preflight must never block a session */ }
process.exit(0);
