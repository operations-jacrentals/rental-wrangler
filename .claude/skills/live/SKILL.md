---
name: live
description: One-command full ship — runs /deploy → /merge → /promote end to end so a single word takes the current feature branch all the way LIVE to production. Use when Jac says "live", "ship it live", or "deploy merge promote". Runs straight through without stopping UNLESS there's something Jac needs to see or know (a gate fails, a surprise commit is in the promote range, a real merge conflict, or it touches money/card/auth/WO-completion). If the branch changes no served-site file, it ships by /merge alone (nothing to deploy or promote). Invoke with /live.
---

# /live — one word, all the way to production

`/live` is the **one-shot equivalent of `/deploy → /merge → /promote`**. Jac typing `/live`
IS the authorization for the whole pipeline, so **run it straight through to live and don't
pause between gates** — surface only the few things Jac genuinely needs to see or decide
(below). It does **not** reinvent the three gate skills; it runs them in order, using each
one's exact mechanics and hard rules.

## The flow — /live drives all three gates in sequence

```
   FEATURE BRANCH ──/deploy──▶  STAGING      (review mirror — pushes to NOTHING)
        │
      /merge   (Gate 1: squash the feature branch INTO trunk)
        │
        ▼
      TRUNK  ──/promote──▶  PRODUCTION        (Gate 2: fast-forward trunk → production = LIVE)
 (integrated,
  not live)
```

`/live` = walk this whole path top to bottom, once, on Jac's single say-so.

## Default posture: DON'T STOP — push it live

Jac's rule: *"Don't stop unless I need to see or know something. Typically push it live."*
So the happy path is fully automatic — deploy, review, merge, `promote --yes`, report the
live `?v=`. **Do NOT pause between gates for a "ready for the next step?" confirmation** —
that friction is exactly what `/live` exists to remove.

## The ONLY reasons to stop and surface (anything else → keep going)

Pause and bring it to Jac ONLY when there's something to see or decide:

1. **A gate fails** — any local gate red, a red CI `smoke`, a failed staging live-bytes
   verify, or `promote.mjs` refusing (staging behind / `production` diverged). Never force
   past a red gate; surface it.
2. **A surprise in the promote range** — the `promote.mjs` preview shows a commit that
   ISN'T this feature (someone else's un-promoted `trunk` work that would ride live with it).
   Show Jac the range before `--yes`. An expected single-feature range → just go.
3. **A merge conflict with `trunk`** that isn't a mechanical `?v=` token resolve.
4. **It touches money / card / auth / WO-completion**, or you hit genuine ambiguity
   mid-ship. Stop, don't guess (canon rule).
5. **The staging review itself looks wrong** — console errors, or the built result doesn't
   match what was asked. A red review STOPs the ship (fix on the branch, re-run).

Outside these, keep moving.

## Config-only? Ship by /merge — skip deploy + promote

If the branch changes **no served-site file** (`app.js` / `style.css` / `index.html` /
`*.html` / `config.js` / `rule-usage.js` / `data.js` / `assets/` / `manifest`) — i.e. only
skills, `.claude/`, CI, `tools/`, `docs/`, or `.github/workflows/` — then there is **nothing
for staging to show and nothing to promote**: Pages serves `production`, while workflows and
`.claude/` config are read from `trunk`. So `/live` **skips `/deploy` and `/promote` and
ships by `/merge` alone**, then tells Jac it merged with production intentionally untouched.
Don't bump `?v=` or move the production pointer for a change no browser is served.

## Run order (defer to each gate skill for the mechanics)

Walk the gates in order, running each exactly as its own skill defines it — don't duplicate
their steps here, follow them:

1. **`/deploy`** — deploy the feature branch to staging, verify the live bytes, review the
   running app. *(Skipped for a config-only branch.)*
2. **`/merge`** — local gates green → fresh-context code-review of `git diff origin/trunk...HEAD`
   → PR to `trunk` → CI `smoke` green → squash-merge → delete the branch.
3. **`/promote`** — `node tools/promote.mjs` preview (read the range + staging-freshness),
   then `node tools/promote.mjs --yes`, then verify the LIVE `?v=`. *(Skipped for
   config-only.)*

Each gate skill already backfills its predecessor, so `/live` is simply "do all three, in
order, without pausing between them."

## Hard rules (inherited — /live never loosens them)

- **Fast-forward-only promote** (`promote.mjs`, never `--force`); if `production` diverged it
  refuses — surface it, a human reconciles.
- **A red gate is a hard stop** — never merge or promote past a failing check.
- **Never weaken money / card / auth / WO-completion logic** to make a ship go through.
- **`--skip-staging-check`** only if staging genuinely can't be reached, and say so loudly.
- Go-live is irreversible — `/promote` is still the only step that touches
  app.jacrentals.com. `/live` just spares Jac from typing it as a separate command.

## After

Report the end state in one line: what went live (the promoted `?v=`), or — for a config-only
ship — that it's merged to `trunk` with production untouched. If anything stopped the ship,
say what and why.
