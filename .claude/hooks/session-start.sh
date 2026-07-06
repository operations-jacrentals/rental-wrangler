#!/bin/bash
# Rental Wrangler — Claude Code on the web: clasp DEPLOY BRIDGE bootstrap.
# Wires up clasp so the agent can deploy the Apps Script backend (gitignored
# Code.gs) without manual pasting. It is a safe no-op unless CLASPRC_JSON_B64
# (or raw CLASPRC_JSON) is set — a Google clasp credential held ONLY as an
# environment secret in the env settings, never in this repo or chat.
# See docs/handoffs/backend-deploy-via-clasp.md.
set -euo pipefail

# Only meaningful in the remote (Claude Code on the web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then exit 0; fi

# Resolve the clasp credential from either CLASPRC_JSON_B64 (preferred — base64
# survives env-var newline/quoting cleanly) or raw CLASPRC_JSON. Held ONLY as an
# environment secret in the env settings, never in this repo or chat.
cred=""
if [ -n "${CLASPRC_JSON_B64:-}" ]; then
  cred="$(printf '%s' "$CLASPRC_JSON_B64" | base64 -d 2>/dev/null || true)"
elif [ -n "${CLASPRC_JSON:-}" ]; then
  cred="${CLASPRC_JSON}"
fi

# Sanity-check it decoded to a JSON object before writing — guards against a
# placeholder/garbage secret silently clobbering ~/.clasprc.json with junk.
case "$cred" in
  *'{'*'}'*) : ;;
  *)
    echo "clasp deploy bridge: no valid clasp credential configured (set CLASPRC_JSON_B64 to the base64 of a clasp-login ~/.clasprc.json); skipping — clasp will be unauthenticated."
    exit 0
    ;;
esac

# 1) Write the clasp credential so clasp is authenticated for this session.
printf '%s' "$cred" > "$HOME/.clasprc.json"
chmod 600 "$HOME/.clasprc.json"

# 2) Bind a working dir to the Apps Script project (Script ID from env).
proj="no ~/rw-backend (APPS_SCRIPT_ID unset)"
if [ -n "${APPS_SCRIPT_ID:-}" ]; then
  mkdir -p "$HOME/rw-backend"
  printf '{"scriptId":"%s","rootDir":"%s"}\n' "$APPS_SCRIPT_ID" "$HOME/rw-backend" > "$HOME/rw-backend/.clasp.json"
  proj="project at ~/rw-backend"
fi

# 3) Report TRUTHFULLY. The real deploy-bridge litmus is the SERVICE-ACCOUNT push path
# (GAS_SA_KEY_B64 + impersonation) — clasp's user-OAuth is RAPT-blocked for this Workspace
# and `loggedIn:true` proves only that a creds FILE exists (see /clasp SKILL.md). clasp
# itself is installed lazily at use time (keeps session start instant).
sa="GAS_SA_KEY_B64 unset — backend PUSH unavailable (see docs/handoffs/BACKEND-DEPLOY-QUEUE.md setup)"
if [ -n "${GAS_SA_KEY_B64:-}" ]; then sa="service-account push path ready (GAS_SA_KEY_B64 set; go-live stays Jac's editor deploy)"; fi
echo "clasp deploy bridge: credential file wired (~/.clasprc.json — NB user-OAuth is RAPT-blocked, reads/deploys via clasp will fail); ${proj}; ${sa}. Runbook: .claude/skills/clasp/SKILL.md + docs/handoffs/BACKEND-DEPLOY-QUEUE.md."
