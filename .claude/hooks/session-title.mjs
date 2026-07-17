#!/usr/bin/env node
/*
 * SessionStart hook — set the session title to this session's open PR numbers.
 *
 * WHY THIS EXISTS
 * Jac wants the session title to read like "#674 · popup question format" and to
 * follow the PRs this session opens. Only a SessionStart hook can set a title
 * (via hookSpecificOutput.sessionTitle), and it re-fires on every resume — so this
 * script re-derives the title from a best-effort record file the assistant maintains.
 * Instant mid-session updates are a separate one-tap `/rename` (the model can't
 * self-invoke slash commands); see CLAUDE.md / /start §4.
 * Design: docs/superpowers/specs/2026-07-17-session-title-pr-numbers-design.md
 *
 * CONTRACT / SAFETY
 *   - FAIL SAFE. Any error, missing file, or empty PR list => emit nothing and
 *     exit 0, leaving whatever title exists untouched. A title hook must never
 *     break session start.
 *   - Reads  .claude/.session-prs        (gitignored) — open PR numbers, one/line.
 *   - Marks  .claude/.session-title-set   (gitignored) — the PR SET we last titled
 *     for. SessionStart stdin carries NO current title (documented fields are
 *     session_id/source/transcript_path/permission_mode/hook_event_name/cwd), so we
 *     can't read a live title to detect a hand-set /rename. Instead we key off the
 *     PR set: once we've titled for a given set of open PRs we DON'T re-assert on
 *     later resumes (leaving any manual rename intact); we only (re)assert when the
 *     PR set actually changes — a PR opened or merged — or on first run.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

function done() { process.exit(0); }                 // emit nothing, leave title as-is
function setTitle(title, markerPath, markerValue) {
  try { writeFileSync(markerPath, markerValue); } catch { /* marker is best-effort */ }
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
//   • strip a trailing Claude-generated random id segment, but KEEP a real
//     word-with-version like "oauth2" / "node20" / "sha256" (letters-then-digits).
//     A random id (e.g. "1f0oz6", "l8pjfd") has a digit but is NOT letters-then-
//     digits; that's the discriminator. Rare miss: an id like "nyom46" that happens
//     to be letters-then-digits is kept — harmless (an extra token, never a
//     misleading truncation).
//   • hyphens/underscores → spaces
function labelFrom(branch) {
  if (!branch || branch === 'HEAD') return '';
  let b = branch.replace(/^[^/]+\//, '');             // drop "claude/" style prefix
  const segs = b.split('-');
  const last = segs[segs.length - 1];
  const looksLikeId =
    segs.length > 1 &&
    /^[a-z0-9]{5,9}$/i.test(last) &&                  // right length + charset
    /[0-9]/.test(last) &&                             // has a digit
    /[a-z]/i.test(last) &&                            // has a letter
    !/^[a-z]+[0-9]+$/i.test(last);                    // NOT a "word+version" like oauth2
  if (looksLikeId) segs.pop();
  return segs.join('-').replace(/[-_]+/g, ' ').trim();
}
function branchLabel() {
  try {
    return labelFrom(execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', timeout: 5000 }).trim());
  } catch { return ''; }
}

const lbl = branchLabel();
const title = '#' + nums.join(', #') + (lbl ? ' · ' + lbl : '');

// ---- respect manual renames via the PR-SET marker -------------------------
const key = nums.join(',');
if (readMaybe(MARK_FILE).trim() === key) done();      // PR set unchanged → leave title alone
setTitle(title, MARK_FILE, key);                      // first run or PR set changed → assert
