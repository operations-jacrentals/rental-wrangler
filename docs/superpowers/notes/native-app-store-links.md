# Parked: native app-store download links in the crew-welcome text

**Parked 2026-07-15** from the phone-identity polish session (branch
`claude/zen-mayer-r2rdgw`). Idea with no code yet — this note IS the artifact.

## What Jac asked for

While building the customizable crew-welcome SMS, Jac said the setup text should include
"a url and app download (later for android/apple)." The **URL** part shipped (the welcome
links `app.jacrentals.com` via the `{link}` token). The **app-download** part — links to the
native Android / iOS apps — was explicitly deferred to "later" because those apps don't
exist yet.

## What's left to do (when the native apps ship)

- Add store-link substitution to the welcome copy. The natural seam is `pidWelcomeText_`
  in the backend (`docs/handoffs/phone-identity-backend.gs` → live `Code.gs`): support new
  tokens, e.g. `{ios}` / `{android}` (or a combined `{apps}`), sourced from Script
  Properties like `PID_IOS_URL` / `PID_ANDROID_URL` (mirrors how `{link}` uses
  `PID_APP_URL`). Empty prop → token drops out cleanly so the copy still reads.
- Surface the same tokens in the Settings → Team Roster "Crew welcome text" editor help
  line (`settingsTeamPane`, `app.js`) so admins know they exist.
- Default `PHONE_IDENTITY.welcomeText` in `config.js` can stay URL-only until the apps are
  real; only add store links to the default once the URLs are live.

## Why not now

No native apps exist yet, so there are no store URLs to link. Ship this alongside the first
Android/iOS build, not before. The phone-first web login is fully live in the meantime.

## Related

- Live feature: customizable crew-welcome (`docs/handoffs/phone-identity-STATUS.md`).
- Also-deferred (already captured in STATUS): Phase 5 — retire shared passwords + harden the
  rare admin `pw`-rechecking edges.
