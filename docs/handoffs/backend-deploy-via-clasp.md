# Backend deploy via clasp (agent-driven, no manual paste)

The Apps Script backend (`Code.gs`) is **gitignored** (it holds passwords + Stripe
keys) and was historically deployed by hand-pasting into the Apps Script editor.
This runbook lets the agent deploy it directly with [clasp](https://github.com/google/clasp).

## Prerequisites (set ONCE, in the Claude Code web **environment variables**)

| Variable | Value | Secret? |
|---|---|---|
| `CLASPRC_JSON_B64` | **base64** of a `~/.clasprc.json` from `clasp login` (a Google OAuth credential for the account that owns the script). Generate with `base64 -w0 ~/.clasprc.json`. Base64 is preferred — it survives env-var newline/quoting cleanly. | **Yes** — env secret only, never in the repo/chat |
| `APPS_SCRIPT_ID` | the backend project's Script ID (Apps Script → ⚙ Project Settings → Script ID) | No (not a credential) |

The **SessionStart hook** (`.claude/hooks/session-start.sh`) wires these at session
boot: it base64-decodes `CLASPRC_JSON_B64` (or accepts raw `CLASPRC_JSON`) into
`~/.clasprc.json` and writes `~/rw-backend/.clasp.json`. It's a safe no-op when no
valid credential is set (a non-JSON/garbage value is rejected rather than written).
The credential is revocable anytime at `myaccount.google.com/permissions` → "clasp".

> **Why clasp isn't working in a fresh session:** the most common cause is the
> `CLASPRC_JSON_B64` secret being unset or a placeholder. Decode-and-check it:
> `printf '%s' "$CLASPRC_JSON_B64" | base64 -d | head -c1` should print `{`. If it
> doesn't, re-mint the secret (below). The network is *not* the blocker — clasp
> reaches Google's API fine once `~/.clasprc.json` exists.

> Note: the credential can't always be minted by `clasp login` on every network
> (some firewalls/AV kill the token-exchange to `oauth2.googleapis.com` —
> "Premature close"). If so, run `clasp login` on a machine that can, then
> `base64 -w0 ~/.clasprc.json` and save the result as the `CLASPRC_JSON_B64`
> secret. To keep the live token out of chat/logs, generate the base64 yourself
> and paste it straight into the env settings — don't have the agent print it.

## Deploy flow

```bash
command -v clasp >/dev/null || npm install -g @google/clasp   # lazy install
cd ~/rw-backend
clasp pull                                                     # authoritative live Code.js + appsscript.json
#  …apply the change to Code.js.  The backend's modular, secret-free additions are
#  tracked in docs/handoffs/*.gs (e.g. cash-payment-backend.gs,
#  membership-billing-additions.gs) — splice those in, or edit Code.js directly.
clasp push --force                                             # upload to HEAD
clasp deploy -i AKfycbzHahzgJqOYe9o4GKlRVGh-A7USRn1k4Dvyy4ajLh8EYCqVxofouM28qs8trNlObZw -d "what changed"
```

The `-i …` is the **production deployment id** (it's the `…/macros/s/<id>/exec`
segment already public in `app.js`). Redeploying it keeps the **same exec URL** the
app calls — never run a bare `clasp deploy` (that mints a new URL).

## Verify after deploy

The exec URL is reachable read-only with a valid role password (GET):

```bash
URL="https://script.google.com/macros/s/AKfycbzHahzg…/exec"
curl -s -L -G --data-urlencode "action=load" --data-urlencode "password=<role-pw>" "$URL" | head -c 200
```

For money-path changes, prove it on a **throwaway** record (create → exercise the new
action → read back → delete), e.g. a `DIAG-INV-*` invoice. Never test on real data.

## Rules

- **Never commit `Code.gs`** (gitignored; secrets). Keep tracked, secret-free
  copies of *additions* in `docs/handoffs/*.gs`.
- Always `clasp pull` first and diff, so you build on what's actually live.
- Keep the **same deployment id** so the frontend's backend URL never changes.
