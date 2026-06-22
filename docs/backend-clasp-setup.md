# Letting the cloud agent deploy the backend (clasp)

This makes Claude Code **on the web** able to `clasp push` the gitignored Apps Script
backend (`Code.gs`). Nothing secret is committed — credentials come from an environment
secret, restored each session by `.claude/hooks/session-start.sh`.

Two reasons this needs setup (not just a login):
1. **Auth** — clasp's login is an interactive browser OAuth that can't run in the sandbox,
   so we restore your already-logged-in credentials from a secret.
2. **Source** — `backend/Code.gs` is gitignored (this repo is public via Pages and `Code.gs`
   holds passwords), so a fresh cloud clone doesn't have it. It has to come from a **private**
   place.

The cloud env already has: `clasp` v3 installed, and network access to Google APIs (verified).

---

## One-time setup (you, in the Claude Code web environment settings)

### 1. Capture your clasp credentials as a secret
On your **local** machine (where `clasp login` already works — clasp v3):

```bash
# your live credentials file (clasp v3 writes this on login)
base64 -w0 ~/.clasprc.json        # macOS: base64 -i ~/.clasprc.json | tr -d '\n'
```

Copy the output and add it as an **environment secret** named **`CLASPRC_JSON_B64`** on this
environment (Settings → Environment → Secrets). The session-start hook decodes it to
`~/.clasprc.json` on boot. (Raw, un-encoded `CLASPRC_JSON` also works, but base64 avoids any
JSON-quoting issues in env vars.)

> Rotating later: re-run the base64 command and update the secret. To revoke the cloud agent's
> access entirely, delete the secret (the hook then no-ops) and `clasp logout` doesn't apply —
> instead revoke the token at myaccount.google.com → Security → Third-party access.

### 2. Give the cloud a copy of the backend source (private)
Create a **private** repo, e.g. `operations-jacrentals/rental-wrangler-backend`, containing:
```
Code.gs            # the Apps Script source (with DEFAULT_CONFIG etc.)
appsscript.json    # the manifest
.clasp.json        # { "scriptId": "...", "rootDir": "." }
```
Then **add that repo to this environment** (so it's cloned each session alongside
`rental-wrangler`). That keeps the secret-bearing source out of the public repo while giving the
agent something to push.

### 3. Prerequisite (once)
Apps Script API must be ON for your account: <https://script.google.com/home/usersettings> →
**Google Apps Script API: ON**. (It already is if `clasp push` works for you locally.)

---

## After setup — how a deploy works

In a new web session the hook restores auth automatically. Then:

```bash
clasp show-authorized-user                 # confirms who we're acting as
cd ../rental-wrangler-backend              # the private backend clone
# (edit Code.gs)
clasp push                                 # updates the script content
# If the web app/API is served from a PINNED deployment version (not @HEAD), also:
clasp list-deployments
clasp update-deployment <deploymentId>     # or: clasp create-deployment
```

A `doPost`/`doGet` web app served at `@HEAD` goes live on `push`; a versioned deployment needs
the redeploy step above.

---

## The immediate job this unblocks: cross-device settings sync

The Settings Board (`config.settings`) persists per-device via localStorage today. To sync it
across devices/users, widen two handlers in `Code.gs` (adapt the variable names to your actual
`getConfig`/`setConfig`):

```js
// getConfig response — include the stored settings blob:
out.settings = cfg.settings || {};

// setConfig save — persist the settings key through (schema-less, JSON-in-a-cell):
cfg.settings = (body.config && body.config.settings) || cfg.settings || {};
```

For the customizations to apply for **non-admins** too (not just whoever opened Settings), also
return `settings` from the unauthenticated `load` action — then the frontend calls
`applySettings(serverSettings)` after server state loads (a small frontend follow-on).

---

## Security notes
- `CLASPRC_JSON_B64` is a **Google OAuth refresh token** — treat it like a password. It lives
  only in the env secret store and the ephemeral container's `~/.clasprc.json` (chmod 600), never
  in git or chat.
- The hook is a **safe no-op** anywhere the secret isn't set (your local machine), and never
  overwrites an existing local `~/.clasprc.json`.
- The backend source stays in a **private** repo — never committed to this public one.
