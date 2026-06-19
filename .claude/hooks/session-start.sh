#!/bin/bash
# SessionStart hook — restore clasp (Apps Script CLI) credentials from an environment secret
# so the agent can deploy the gitignored backend (`clasp push`) in Claude Code on the web.
#
# NOTHING SECRET IS COMMITTED. The credentials come from an env secret you set on the
# environment (see docs/backend-clasp-setup.md):
#   • CLASPRC_JSON_B64 — base64 of your local ~/.clasprc.json   (recommended)
#   • CLASPRC_JSON     — the raw contents of ~/.clasprc.json    (fallback)
#
# Safe everywhere: if no secret is set (e.g. your local machine), it does nothing and never
# touches an existing ~/.clasprc.json. It also never fails the session.
set -uo pipefail

creds=""
if [ -n "${CLASPRC_JSON_B64:-}" ]; then
  creds="$(printf '%s' "$CLASPRC_JSON_B64" | base64 -d 2>/dev/null || true)"
elif [ -n "${CLASPRC_JSON:-}" ]; then
  creds="${CLASPRC_JSON}"
fi

if [ -z "$creds" ]; then
  echo "clasp: no CLASPRC_JSON(_B64) secret set — skipping backend auth (backend deploys stay manual)."
  exit 0
fi

# Safety: on a non-remote (local) machine that already has a clasp login, leave it untouched.
target="$HOME/.clasprc.json"
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && [ -f "$target" ]; then
  echo "clasp: local ~/.clasprc.json present — leaving your existing login untouched."
  exit 0
fi

printf '%s' "$creds" > "$target"
chmod 600 "$target"

if command -v clasp >/dev/null 2>&1; then
  who="$(clasp show-authorized-user 2>&1 | head -2 | tr '\n' ' ' || true)"
  echo "clasp: credentials restored — ${who:-(could not verify; check the secret)}"
else
  echo "clasp: credentials restored (clasp not on PATH; install @google/clasp to deploy)."
fi
exit 0
