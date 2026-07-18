---
name: build
description: Build the feature as currently outlined all the way to deploy-ready, WITHOUT stopping for anything that needs Jac. Use when Jac says "/build", "build it", or "build this out" and a plan/spec is already outlined. Sits BEFORE the ship flow (/build → /deploy → /merge → /promote): it turns an approved outline into committed, gates-green, deploy-ready code on the feature branch, then STOPS and hands back a one-tap /deploy. Never guesses money/auth/PII/WO-completion/irreversible calls and never stalls waiting on a backend go-live or an answer — it builds everything buildable, defers the rest to a single batched report + popup at the very end. Invoke with /build.
---

# /build — turn the outlined feature into deploy-ready code (no stalls)

## Where /build sits — it's the step BEFORE the ship flow

```
   OUTLINE  ──/build──▶  DEPLOY-READY          (this skill: code done, gates green, pushed)
 (approved                     │
  plan/spec)              /deploy   (Step 1: copy the feature branch to staging for review)
                               │
                               ▼
                           STAGING ──/merge──▶ TRUNK ──/promote──▶ PRODUCTION (live)
```

`/build` produces the thing the ship flow assumes already exists: a feature branch whose
work is **complete, gate-green, and committed**. It **stops one step short of `/deploy`** —
"ready to deploy" means *ready*, not *deployed*. The staging/live gates stay Jac's calls.

## The one rule: build as far as possible, NEVER stall

Build **everything buildable now.** The moment you hit something that needs Jac, or is
genuinely ambiguous, **do not stop and do not guess** — **defer** it (log it) and keep
building everything else. A session must never hang on a question or a backend go-live.

- **The ONLY improvisation allowed is backend code:** author/update `Code.gs` and **push it
  via `/clasp`** (service-account path) when you can — then **defer just the go-live editor
  deploy** (Jac's Apps Script click). If `GAS_SA_KEY_B64` is unset, defer the push too.
- **You do NOT get to pick product/UX decisions for Jac, and you do NOT get to stub a real
  decision behind a `FEATURES` flag as a shortcut.** (Jac deliberately withheld both.) When a
  choice is a user's / designer's / PM's to make → **defer the piece**, build around it.
- **The line between "build it" and "defer it":** an *implementation detail an engineer makes
  while building a settled spec* (naming, structure, following an existing house pattern via
  `/atlas`) → just build it. A *decision the spec left open that changes what the user gets* →
  defer it. When unsure which side of the line, defer — deferring is cheap, a wrong guess isn't.

## Step 0 — Pin what "as currently outlined" is
- **Source, in order:** (1) an explicit arg — `/build <topic-or-spec-path>`; (2) the active
  plan/spec in *this session's* context; (3) the most recent approved `/brainstorming` spec in
  `docs/`.
- **The one and only up-front stop:** if **nothing is outlined**, you can't build an unstated
  feature — confirm the scope with a single popup (popup-first, single-attempt; inline fallback).
  Once scope exists, you never stop again — you defer.
- If the outline never went through `/brainstorming` and involves real UX, note that in the
  DEFERRED report (built anyway; flag it for design sign-off) — don't block on it.

## Step 1 — Decompose the outline into units, classify each
Break the outline into the smallest independently-buildable units. Tag each:
- **BUILD NOW** — unambiguous and within your power (frontend, app logic, backend *code*, CI,
  docs, gates).
- **DEFER** — needs a Jac decision, needs Jac's hand (go-live editor deploy, a secret, an
  external account), or touches a **hard-defer** class (below).

## Step 2 — Build every BUILD-NOW unit
- **Find code map-first:** `/atlas` → `docs/CODE-MAP.md` → the `file:line`, not a blind grep of
  `app.js`. Match the surrounding code's idiom, naming, and comment density.
- **Any new or reshaped UI → `/jactec-ui`** (mandatory design gate — the yard data-plate
  language). Stamp every new element `data-r="Rxx"`; **regenerate** `node ci/gen-rule-usage.mjs`
  when usage changes. A **new popup** needs a `WINDOW_CATALOG` entry
  (`ci/check-window-catalog.mjs`).
- **Backend:** write/update `Code.gs`, additive only; push via `/clasp` service-account path when
  reachable; **defer the go-live editor deploy** to the report. Never commit `Code.gs` (gitignored,
  public repo).
- **Something reported broken along the way → `wrangler-fix` first** (prove the root cause with
  citations before changing code).
- **Delegate to keep the main thread free** — per `CLAUDE.md` → *Delegation & model triage*: a
  scoped unit against a settled spec → a **Sonnet** subagent; mechanical/IO (grep sweeps, git
  plumbing, run-a-script) → **Haiku**; keep architecture / security / auth / gates on **main**.
  Fan out independent units as parallel agents, not a manual loop. **Tell Jac in one line which
  agent + model you assigned and why**, as you launch it (a hard rule).

## What you NEVER guess and NEVER stub — hard-defer, every time
Skip these and log them; do **not** improvise, and do **not** hide a decision behind a flag:
- **Money** — pricing, margin, rounding, totals.
- **Auth / gates** — role passwords, the login gate, anything a `flagOn()` must not hide.
- **Customer PII / isolation** — operator/customer data separation, anything keyed to a real person.
- **WO-completion semantics** — a part/task line going Complete must never complete the work order.
- **Irreversible / live ops** — the go-live editor deploy, `/promote`, force-pushes, secret handling.

## Step 3 — Green every gate (this is what "ready to deploy" means)
Run the full gate set and make it pass before you push:
```
node ci/smoke.mjs            node ci/logic-test.mjs
node ci/lease-test.mjs       node ci/lease-deploy-test.mjs      node ci/promote-test.mjs
node ci/gen-rule-usage.mjs --check      node ci/check-window-catalog.mjs
node tools/gen-code-map.mjs --check
```
- **Port 8000 is reserved** — swap first for the browser gates:
  `sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`, run, then `git checkout -- ci/`.
- The `lease-*` and `promote-test` suites are **pure-Node** — **excluded** from the port swap,
  no browser/network.
- Skip only the gates that *cannot* be affected by your diff (a docs-only change need not boot
  Chromium) — but never skip a gate your change could touch, and say which you skipped and why.
- **Don't** bump the `?v=` cache-bust here — `/deploy` owns that.

## Step 4 — Commit, push, and STOP at deploy-ready
- Commit with a clear, descriptive message (never the model identifier, secrets, or passwords).
- `git push -u origin <feature-branch>`; on **network** failure retry up to 4× with backoff
  (2s, 4s, 8s, 16s).
- **STOP here.** Do **not** open the trunk PR (that's Gate 1, `/merge`) and do **not** deploy.
  `/build` ends at a pushed, gate-green feature branch.

## The hand-back — a written report + ONE batched popup
Close every `/build` run with both:
1. **A written `DEFERRED` section**, grouped:
   - **Questions for Jac** — every product/UX decision you deferred (with the options you saw).
   - **Jac's hands only** — the backend go-live editor deploy, any secret/account/external step.
   - **Skipped + why** — each hard-defer item you left untouched.
2. **One batched `AskUserQuestion` popup** collecting the deferred *decisions* — up to 4 questions,
   **favor multiSelect**, popup-first **single-attempt** (one try; if it fails, fall back to the
   same questions **inline** as A/B/C… + Other). Don't fire a popup at all if there's nothing to
   decide — the report alone is enough.
3. **End line:** what shipped to deploy-ready on which branch, then the one-tap next step —
   *"Built to deploy-ready on `<branch>`. Say `/deploy` to put it on staging for review."*
   (And append the PR number to `.claude/.session-prs` only once a PR actually exists — `/build`
   itself opens none.)

## In one breath
Read the outline → build everything buildable (defer, never guess, what needs Jac) → write &
push backend code but defer its go-live → green the gates → commit & push → **STOP at
deploy-ready** → hand back one batched report + popup and a one-tap `/deploy`.
