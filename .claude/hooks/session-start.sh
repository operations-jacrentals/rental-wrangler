#!/bin/bash
# Rental Wrangler — Claude Code on the web: clasp DEPLOY BRIDGE bootstrap.
# Wires up clasp so the agent can deploy the Apps Script backend (gitignored
# Code.gs) without manual pasting. It is a safe no-op unless CLASPRC_JSON is set
# (a Google clasp credential held ONLY as an environment variable in the env
# settings — never in this repo). See docs/handoffs/backend-deploy-via-clasp.md.
set -euo pipefail

# Only meaningful in the remote (Claude Code on the web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then exit 0; fi
# No credential configured → nothing to wire (silent, safe default).
if [ -z "${CLASPRC_JSON:-}" ]; then exit 0; fi

# 1) Write the clasp credential so clasp is authenticated for this session.
printf '%s' "$CLASPRC_JSON" > "$HOME/.clasprc.json"
chmod 600 "$HOME/.clasprc.json"

# 2) Bind a working dir to the Apps Script project (Script ID from env).
if [ -n "${APPS_SCRIPT_ID:-}" ]; then
  mkdir -p "$HOME/rw-backend"
  printf '{"scriptId":"%s","rootDir":"%s"}\n' "$APPS_SCRIPT_ID" "$HOME/rw-backend" > "$HOME/rw-backend/.clasp.json"
fi

# clasp itself is installed lazily at deploy time (keeps session start instant).
echo "clasp deploy bridge: credential wired (~/.clasprc.json), project at ~/rw-backend. To deploy the backend, see docs/handoffs/backend-deploy-via-clasp.md."
