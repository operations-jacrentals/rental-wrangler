#!/usr/bin/env node
/*
 * SessionStart hook — set the session title to this session's open PR numbers.
 *
 * WHY THIS EXISTS
 * Jac wants the session title to read like "#669 · popup question format" and to
 * follow the PRs this session opens. Only a SessionStart hook can set a title
 * (via hookSpecificOutput.sessionTitle), and it re-fires on every resume — so this
 * script re-derives the title each startup/resume from a best-effort record file
 * the assistant maintains. Instant mid-session updates are a separate one-tap
 * `/rename` (the model can't self-invoke slash commands); see CLAUDE.md.
 * Design: docs/superpowers/specs/2026-07-17-session-title-pr-numbers-design.md
 *
 * CONTRACT / SAFETY
 *   - FAIL SAFE. Any error, missing file, or empty PR list => emit nothing and
 *     exit 0, leaving whatever title exists untouched. A title hook must never
 *     break session start.
 *   - Reads   .claude/.session-prs        (gitignored) — open PR numbers, one/line.
 *   - Marks   .claude/.session-title-set   (gitignored) — the last title WE emitted,
 *     so a hand-set `/rename` can be detected and respected (when the harness
 *     exposes the current title on stdin; if it doesn't, we set the title anyway —
 *     see RESPECT MANUAL RENAMES below).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// ---- fail-safe scaffolding -------------------------------------------------
function done() { process.exit(0); }                 // emit nothing, leave title as-is
function setTitle(title, markerPath) {
  try { writeFileSync(markerPath, title); } catch { /* marker is best-effort */ }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', sessionTitle: title },
  }));
  process.exit(0);
}
function readMaybe(path) { try { return readFileSync(path, 'utf8'); } catch { return ''; } }

// ---- locate the repo -------------------------------------------------------
let root = process.env.CLAUDE_PROJECT_DIR || '';
try {
  root = execFileSync('git', ['rev-parse', '--show-toplevel'],
    { encoding: 'utf8', timeout: 5000 }).trim() || root;
} catch { /* fall back to env / cwd below */ }
if (!root) root = process.cwd();

const PRS_FILE = join(root, '.claude', '.session-prs');
const MARK_FILE = join(root, '.claude', '.session-title-set');

// ---- read the open PR numbers ---------------------------------------------
const nums = [...new Set(
  readMaybe(PRS_FILE)
    .split(/\s+/)
    .map((s) => s.replace(/^#/, '').trim())
    .filter((s) => /^[0-9]+$/.test(s))
    .map(Number),
)].sort((a, b) => a - b);
if (nums.length === 0) done();                        // no PRs recorded → no title

// ---- derive the branch label ----------------------------------------------
// claude/popup-question-format-1f0oz6 → "popup question format"
//   • strip a leading "claude/" (or any "owner/") prefix
//   • strip a trailing random id segment (has a digit, ~4-8 chars): "-1f0oz6"
//   • hyphens/underscores → spaces
function label() {
  let b = '';
  try {
    b = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', timeout: 5000 }).trim();
  } catch { return ''; }
  if (!b || b === 'HEAD') return '';
  b = b.replace(/^[^/]+\//, '');                      // drop "claude/" style prefix
  b = b.replace(/-[a-z0-9]*[0-9][a-z0-9]*$/i, (m) =>  // drop trailing id if 4-8 chars
    (m.length >= 5 && m.length <= 9 ? '' : m));
  return b.replace(/[-_]+/g, ' ').trim();
}

const lbl = label();
const title = '#' + nums.join(', #') + (lbl ? ' · ' + lbl : '');

// ---- RESPECT MANUAL RENAMES -----------------------------------------------
// If the harness hands us the current title on stdin and it differs from the last
// title WE set and isn't an auto pattern, Jac renamed it by hand → leave it alone.
// If the current title isn't available, we can't tell, so we set ours (the feature
// is the point); a hand-set name then survives only until the next resume.
let stdin = {};
try { stdin = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { stdin = {}; }
const current = String(
  stdin.title || stdin.session_title || stdin.sessionTitle ||
  (stdin.session && stdin.session.title) || '',
).trim();

if (current) {
  const lastSet = readMaybe(MARK_FILE).trim();
  const looksAuto = /^#[0-9]/.test(current)           // our "#669 · …" shape
    || /-[0-9a-f]{2}$/i.test(current)                 // default "my-app-3f" shape
    || current === lastSet;
  if (current !== title && current !== lastSet && !looksAuto) done(); // manual rename → respect
}

setTitle(title, MARK_FILE);
