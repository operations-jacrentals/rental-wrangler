#!/usr/bin/env node
/*
 * PreToolUse guard for the Bash tool — best-effort tripwires, NOT walls.
 *
 * Blocks two accidental slips:
 *   1. A direct `git push` to the protected release branches (trunk / production).
 *   2. Echoing a known secret env var into command output.
 *
 * Design rules (see docs/superpowers/specs/2026-07-15-session-workflow-v2-design.md):
 *   - FAIL OPEN. Any parse error, unexpected shape, or non-Bash tool => allow.
 *     A guard that breaks real sessions is worse than a missed catch.
 *   - These are tripwires. Command-matching cannot see obfuscated input, so the
 *     REAL enforcement is GitHub branch protection (trunk/production) and the
 *     `permissions.deny` rules in settings.json (backend/secrets). This just
 *     catches the honest accidental slip before it round-trips.
 */
import { readFileSync } from 'node:fs';

function allow() { process.exit(0); }
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  allow();
}

const tool = (input && (input.tool_name || input.toolName)) || '';
const cmd = (input && input.tool_input && input.tool_input.command) || '';
if (tool !== 'Bash' || typeof cmd !== 'string' || cmd.length === 0) allow();

// (1) direct push to a protected release branch
const isPush = /\bgit\s+push\b/.test(cmd);
const targetsProtected = /(?:HEAD:|:|\borigin\s+\+?)(?:trunk|production)(?![\w-])/.test(cmd);
if (isPush && targetsProtected) {
  deny(
    'Direct push to a protected release branch (trunk/production) is blocked. ' +
    'Integrate via PR → squash-merge to trunk (/merge); go live via tools/promote.mjs (/promote). ' +
    'GitHub branch protection is the real gate; this local tripwire just catches the slip.'
  );
}

// (2) echoing a known secret env var
const SECRETS = /\b(RW_PW|STAGING_DEPLOY_PAT|GAS_SA_KEY_B64|CLASPRC_JSON_B64)\b/;
const PRINTS = /\b(echo|printf|printenv)\b/;
if (PRINTS.test(cmd) && SECRETS.test(cmd)) {
  deny(
    'Refusing to print a known secret env var (RW_PW / STAGING_DEPLOY_PAT / GAS_SA_KEY_B64 / CLASPRC_JSON_B64). ' +
    'The repo is public via Pages — a printed secret can leak into logs or artifacts. Best-effort guard.'
  );
}

allow();
