# Session Workflow v2 — Design Spec

- **Date:** 2026-07-15
- **Branch:** `claude/session-workflow-guidelines-nyom46`
- **Status:** Approved (design) — pending implementation plan
- **Ships as:** one feature branch → one PR → `trunk`. No `production` promote (config/skills/hooks only; nothing the browser is served changes).

---

## 1. Problem

How Jac and Claude work together in sessions has drifted from how the best
Claude Code users operate, and — more urgently — the setup's own safety rules
have gone stale. A research pass (Anthropic best practices), an audit of this
repo's Claude Code config, and a capability-verification pass surfaced four gaps
plus a fifth Jac raised directly (interaction style).

## 2. The design principle (the spine)

> **Shift the safety load off Jac's vigilance and onto deterministic machinery.**

Jac trusts delegation, runs long sessions, doesn't `/clear`, and moves fast at
plan-time. The published best practices lean on human vigilance (read the plan,
clear context, review before approving). That's not how Jac drives — and that's
fine, because the *system* carries the load his habits don't: hooks over prose,
fresh-context review over plan-reading, lean-context-via-delegation over
clearing.

## 3. Verified capability findings (what the design is allowed to assume)

| Capability | Verdict | Consequence for this spec |
|---|---|---|
| `.claude/rules/*.md` with `paths:` glob frontmatter | Supported — loads only when a matching file is read | Mechanism for slimming CLAUDE.md (WS2) |
| `@import` in CLAUDE.md | Supported but does **not** reduce context (loads at launch) | Do **not** use imports for trimming — use rules/skills |
| Native auto-memory | Machine-local (`~/.claude/...`) | Wrong tool — blank in every fresh cloud clone; memory must be git-committed (WS3) |
| `permissions.deny` (Edit/Read path globs) | Client-enforced regardless of model decision | Primary hard enforcement for backend/secrets (WS1) |
| PreToolUse Bash command-matching hook | Best-effort, **fails open** on obfuscated input | Tripwire only — not the wall (WS1) |
| Skill `context: fork` + `agent:` frontmatter | Supported — fresh subagent, no conversation history | Fresh-context review mechanism (WS4) |
| Built-in "block merge until reviewed" gate | Does **not** exist | Must be composed from a review step + a best-effort tripwire (WS4) |

## 4. Workstreams

### WS1 — De-drift + hard-enforce the gates

**Goal:** remove rules that contradict the trunk model, and back the
un-undoable actions with real enforcement.

**De-drift sweep** (replace `main`/`area`/"merge = live" language with the
trunk model — feature branch → PR → squash to `trunk` (integrated, *not* live)
→ `production` promote is the only go-live):
- `.claude/skills/wrangler-fix/SKILL.md` — "minimal PR to `main`", `gh pr merge --auto --squash`, sync-into-`area/<domain>` steps.
- `.claude/skills/jactec-ui/SKILL.md` — "Gates before push (push to `main` = live)", "`main` is branch-protected".
- Sweep every `.claude/skills/*/SKILL.md` and `CLAUDE.md` for residual `main`/`area`/"merge = live".

**Enforcement, layered by what each mechanism actually guarantees:**

| Rule | Mechanism | Strength |
|---|---|---|
| No backend edits | `permissions.deny: ["Edit(backend/**)", "Write(backend/**)"]` | Hard (client-enforced) |
| No reading secret-bearing local files | `permissions.deny` on the enumerated local secret paths (e.g. `*.local.md`, `test-creds.local.json`) | Hard (built-in file tools + recognized bash file cmds) |
| No direct push to `trunk`/`production` | GitHub branch protection (already live) is the wall; a `git push` PreToolUse tripwire is the local catch | Wall + tripwire |
| No echoing secrets | PreToolUse tripwire scanning the command for known secret var names (`RW_PW`, `STAGING_DEPLOY_PAT`, `GAS_SA_KEY_B64`, `CLASPRC_JSON_B64`) | Tripwire (best-effort) |

**Permission-friction reduction (folded in, Jac-approved):** expand
`permissions.allow` with the everyday **read-only** shell utilities that
currently prompt every time (`grep`, `rg`, `sed`, `ls`, `cat`, `find`, `head`,
`tail`, `wc`, `mkdir`, `curl` for staging verification). Deny-rules above take
precedence over allow, so secrets/backend stay guarded. Destructive commands
(`rm`, `git push --force`, etc.) are **not** allow-listed.

**Files:** `.claude/settings.json` (deny + allow + hook wiring); new
`.claude/hooks/guard-bash.mjs`; the stale skills + `CLAUDE.md`.

**Honest caveat:** command-matching hooks fail open. They are tripwires that
catch the accidental slip; branch protection and `permissions.deny` are the
walls. This is stated, not oversold.

### WS2 — Slim CLAUDE.md + path-scoped rules

**Goal:** cut the always-loaded core to a scannable target of **< 150 lines**;
move occasional knowledge to rules that load only when the relevant file is
touched.

- Move the **Icons** section + the "category icons are FAMILY-level" rule →
  `.claude/rules/icons.md` (the default — clean path-scoped separation) with
  `paths: [icons.js, icons-anim.js, tools/gen-icons.mjs, tools/gen-app-icons.py, app.js]`.
  The `app.js` glob covers `categoryIconFor()`.
- CLAUDE.md core keeps: identity, the ship model (trunk + two gates), the hard
  "Don't"s, the delegation-policy pointer, and the (updated) interaction rule.
- Add a short table-of-contents at the top.

**Files:** `CLAUDE.md` (trim + TOC); new `.claude/rules/*.md`.

### WS3 — One memory that survives a cold clone

**Goal:** replace the dead `MEMORY.md` reference (`/start` reads a file that
doesn't exist) with a living, **git-committed, public-safe** memory.

- New `MEMORY.md` at repo root. Sections: `## Decisions` (dated log),
  `## Design prefs`, `## Gotchas`, `## Open threads`.
- `/start` reads it (make the existing instruction point to a real file);
  `/end` updates it (append decisions, prune closed threads).
- **Public-safe by construction:** it's committed to a public repo, so it holds
  only shareable content — never customer PII, pricing/margin data, or secrets.
  The WS1 secret tripwire + a `permissions.deny` guard reinforce this.
- Seed with this session's durable decisions (trunk model, the hybrid
  interaction rule, the delegation-triage table).

**Cross-session knowledge (Jac's "other sessions for knowledge" question):**
the committed `MEMORY.md` + `docs/` *are* the shared brain — every session
(cloud, local, parallel worktree) reads the same git. Live session-to-session
is only prompt-firing, not context-sharing. So durable cross-session knowledge
= git = this workstream.

**Files:** new `MEMORY.md`; `.claude/skills/start/SKILL.md`;
`.claude/skills/end/SKILL.md`.

### WS4 — Review that catches what a skimmed plan won't

**Goal:** put the safety net *after* the code, since Jac moves fast at
plan-time.

- `/merge` gains a **required** step: fork a **fresh-context** `/code-review`
  (no conversation history — `context: fork`) on
  `git diff origin/trunk...HEAD`, scoped to correctness/requirement gaps.
- Pair with a PreToolUse tripwire on the merge command that checks a review
  actually ran (best-effort — the review step is the real value; the tripwire
  is belt-and-suspenders).
- **Skimmable plan:** non-trivial changes get a 3–5 bullet "decisions only"
  plan Jac can read in ~20s before code. A working-rule convention (can't be
  hook-enforced — "non-trivial" isn't detectable); the post-hoc review is the
  enforced safety.

**Files:** `.claude/skills/merge/SKILL.md`; reuse the existing `/code-review`
skill (optionally a thin `context: fork` wrapper); `.claude/hooks/guard-bash.mjs`.

### WS5 — Interaction style (new — Jac's thread)

> **⚠️ SUPERSEDED 2026-07-16** — the "Hybrid / inline-favored" default below was
> reversed by Jac: *"the popup question format is WAY better."* Current rule is
> **popup-first, single-attempt** — every decision/question goes through the
> `AskUserQuestion` popup, tried **once**; if that one popup fails, fall back to
> **inline** with the same options as lettered **A/B/C… + Other**, no popup retry.
> See `CLAUDE.md` → *Interaction (popup-first, single-attempt)*. The mockup ladder
> and delegation triage below still stand.

**Goal:** kill the "massive blobs"; delegate deliberately, not dogmatically.

**Communication default = Hybrid** (decided 2026-07-15). This **supersedes**
the "always ask via popups, never inline" rule (`CLAUDE.md`, Jac 2026-06-15):
- Formatted **inline** for exploration and nuance (tables, tight sections,
  bold takeaways, blockquotes) — lead with the outcome, never a wall of bullets.
- A crisp structured block for clean either/or decisions.
- An **artifact** for anything comparative or visual.
- Popups deprioritized (and unreliable — the permission stream aborted 3× this
  session); inline is favored.
- This resolves the audit-flagged conflict where the vendored `brainstorming`
  skill asks questions inline one-at-a-time against a popup-only rule.

**Mockup ladder (cheapest tier first; show-don't-describe when spatial/
comparative/visual):**

| Tier | Medium | Cost | When |
|---|---|---|---|
| 1 | Inline markdown table / ASCII / mermaid | ≈ free | first reach for any concept |
| 2 | Self-contained **Artifact** | ~1–3k tokens | the cloud sweet spot — renders in Jac's web app (localhost does not reach a cloud session) |
| 3 | Figma / Canva | heavy | only when the design *is* the deliverable |

**Budget rule:** cheapest tier that conveys it; one good mockup over three
rough ones; escalate only when the cheaper tier genuinely fails.

**Delegation triage (refined — supersedes "delegate heavily, always"):**
delegate by cost-of-being-wrong **and** whether the main thread needs the
intermediate reasoning — not blindly always.

| Tier | Model | $ / 1M (in / out) | Delegate this |
|---|---|---|---|
| Mechanical · IO | Haiku 4.5 | $1 / $5 | git plumbing, grep/atlas sweeps, file munging, run-a-script-and-report |
| Scoped build | Sonnet 5 | $3 / $15 | UI/code from a settled spec, PR bodies, research gathering |
| Hard reasoning (stays on main) | Opus 4.8 | $5 / $25 | architecture, security / PII gates, spec authoring |
| Frontier escalation (rare) | Fable 5 | $10 / $50 | a sub-problem Opus itself stalls on; correctness ≫ cost |

`fable` is assignable to subagents today. It is the most capable model but 2×
Opus / 10× Haiku and runs longer per turn — an escalation lever, not a default.

**Files:** `CLAUDE.md` (interaction rule + a compact communication/mockup/
delegation note, or a dedicated rule); `.claude/skills/start/SKILL.md` and
`.claude/skills/end/SKILL.md` (they repeat "popups only").

## 5. Sequencing & shipping

- **One branch, one PR** → `trunk`. All five workstreams land together (config/
  skills/hooks, no interdependencies, no live-site impact).
- Nothing to `promote` — `production` is untouched (the browser bundle doesn't
  change).
- All existing CI gates must still pass: `ci/smoke.mjs`, `ci/logic-test.mjs`,
  `ci/gen-rule-usage.mjs --check`, `ci/check-window-catalog.mjs`,
  `tools/gen-code-map.mjs --check`.

## 6. Out of scope / parallel tracks

- **Repo privacy** — separate track, **parked** on Jac's manual GitHub
  billing-tier check (Pages-from-private needs GitHub Pro; Free forces public,
  and flipping private on Free takes `app.jacrentals.com` down). Memory ships
  public-safe either way, so this does not block v2. Safe order if Pro: canary
  staging → confirm → flip main + production (Jac's explicit trigger only).
- **Auto-fix to live (Jac, 2026-07-15)** — Mr. Wrangler must give end-users
  live fixes in real time, running the full pipeline (deploy → merge → promote)
  autonomously with **no user interaction**. The trunk rename broke this (Pages
  serves `production`; merge-to-trunk ≠ live), so restoring it needs the
  auto-fixer to run `promote` too. Safety = **fully machine-gated** (CI +
  staging-verify + the fresh-context review; any failure hard-stops and pings
  Jac — never a broken fix to live). This PR's WS1a updated the `wrangler-fix`
  skill + docs to the trunk model and recorded the intent; the actual
  live-deploy automation (`wrangler-fix.yml` + an automated promote path) is a
  **separate, Jac-gated** effort — enabling the live auto-promote switch is his
  explicit one-time go (it touches the live site + secrets).
- Retroactive restyle of existing UI (explicitly not wanted).

## 7. Open questions / risks

- The fresh-context review adds latency + a Sonnet/Opus subagent cost to every
  merge. Accepted — it's the safety net that replaces plan-reading.
- Exact enumeration of secret-bearing local paths for `permissions.deny` (done
  during implementation from `.gitignore`).
- Tripwire fail-open is documented, not oversold; branch protection remains the
  real trunk wall.

## 8. Success criteria

- `grep` for `main`/`area`/"merge = live" across skills + CLAUDE.md is clean
  (only accurate trunk-model language remains).
- `CLAUDE.md` < ~150 lines, scannable, with a TOC; occasional knowledge lives
  in `.claude/rules/`.
- `MEMORY.md` exists, is read at `/start`, written at `/end`, and is public-safe.
- `/merge` runs a fresh-context review before squash.
- `.claude/settings.json` has deny-rules (backend/secrets), an expanded
  read-only allow-list, and the guard hook wired.
- The interaction rule reads "Hybrid" across `CLAUDE.md` / `start` / `end`.
- All existing CI gates pass.
