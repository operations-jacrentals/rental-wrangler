# Rental Wrangler — Claude Code → OpenAI Codex migration handoff

**Purpose:** everything Codex needs to take over this repo. Written to travel *with* the repo,
so it works wherever Codex reads it.

## TL;DR — most of this is agent-agnostic and already travels
The project is mostly portable Node + markdown on a GitHub repo. There are **three real work
items**, everything else just works if Codex runs on the same repo:

1. **Create `AGENTS.md`** — Codex's instruction file (it does not read `CLAUDE.md`).
2. **Re-provision secrets** in Codex's environment — *you* do this, never through chat or the repo.
3. **Swap the two LLM-calling GitHub Actions** to OpenAI (`wrangler-fix.yml`, check `auto-promote.yml`).
4. **If Claude + Codex run at once:** namespace branches (`codex/*`) + a `docs/WIP.md` ledger +
   a cross-review skill (§8). The staging deck already isolates deploys for free.

---

## 1. Already portable — NO action (GitHub covers it)
Your instinct was right: most "control gates" are a nonstarter because GitHub already holds them.
- **CI gates** — `.github/workflows/ci.yml` runs the whole suite (`smoke`, `logic-test`,
  `lease-test`, `lease-deploy-test`, `promote-test`, `cachebust-test`, `gen-rule-usage --check`,
  `check-window-catalog`, `gen-code-map --check`, `check-cachebust`). GitHub-native → **any agent
  on this repo inherits them**. **Branch protection** on `trunk`/`production` travels too.
- **Release tooling** — `tools/*.mjs` (`deploy-staging`, `promote`, `staging-lease`,
  `bump-cachebust`, `gen-code-map`, `gen-icons`) are plain Node, zero Claude dependencies.
- **The repo brain** — `docs/CODE-MAP.md`, `MEMORY.md`, `docs/`, `.claude/rules/`, and the
  R0–R25 `data-r` rulebook + its CI guards are all markdown/Node and travel automatically.
  Codex can **read** `.claude/skills/*` and `.claude/rules/*` as plain files even though it can't
  "invoke" them as skills.

## 2. Small adaptations
### 2a. `AGENTS.md` (Codex's instruction file)
Codex reads `AGENTS.md` at the repo root, not `CLAUDE.md`. Fastest path: seed `AGENTS.md` from
`CLAUDE.md`, then graft in the essential runbooks below so the ship flow + design canon are inline.
Keep `CLAUDE.md` too (harmless, and lets you run Claude again if ever needed).

### 2b. Skills → runbooks (the knowledge travels; the `/invoke` mechanism doesn't)
Every skill is a markdown file under `.claude/skills/<name>/SKILL.md`. Point `AGENTS.md` at these:

| Skill | Action | Why |
|---|---|---|
| `build` · `deploy` · `merge` · `promote` · `live` | **PORT** | the ship flow — core release runbook. Tooling is portable; document the orchestration (see §6 npm scripts). |
| `clasp` | **PORT** | backend (Google Apps Script) deploy runbook — the backend can't ship without it. |
| `style` · `wrangler-style` | **PORT (critical)** | the design canon (palette, type voices, Signal·Gate·Stamp·Ref·Door, the measurable rulebook). The reason the UI is one family. |
| `wrangler-fix` | **PORT** | "prove the root cause with citations before changing code" — the debugging methodology. |
| `atlas` | **PORT (as instruction)** | CODE-MAP-first navigation → the #2 token lever (§5). |
| `start` | **ADAPT** | session orientation — keep the branch-flow parts, drop Claude-session bits. |
| `run-live` · `lazy-audit` · `webapp-testing` | **ADAPT** | Playwright-based test/audit flows — portable, useful. |
| `brainstorming` | **ADAPT** | the spec-first design dialogue — a useful pattern, not Claude-specific. |
| `audit` | **DROP** | Claude token-efficiency audit — harness-specific. |
| `end` · `skill-creator` | **DROP** | Claude session/skill management. |

## 3. Secrets — YOU re-provision, never through the agent or the repo
**Hard rule (unchanged): the repo is PUBLIC via Pages. No secret value ever goes in the repo, a
commit, or a chat message.** This doc lists NAMES and PURPOSES only.

Two homes for secrets:
- **GitHub Actions secrets (CI):** already set on this repo. If Codex works on the **same repo**,
  CI keeps working with no action.
- **Codex's agent environment (interactive `deploy`/`clasp` runs):** recreate these env vars in
  Codex's sandbox config, values pulled from **your** vault:

| Env var / secret | Purpose | Source |
|---|---|---|
| `STAGING_DEPLOY_PAT` | GitHub PAT for the staging-deck push (`tools/deploy-staging.mjs`) | your GitHub PAT store |
| `STAGING_DEPLOY_KEY_PATH` | alt deploy-key path (if used instead of the PAT) | your key store |
| `GAS_SA_KEY_B64` | base64 Google service-account key for the `clasp` backend push | Google Cloud IAM |
| backend/team + role passwords | login + role gates | live in the backend `Code.gs`/config (gitignored) — carry them with the backend, **never** the repo |
| Google Maps / GPS · Twilio SMS · Stripe (if used) | maps, texts, payments | your provider dashboards |
| `CLAUDE_CODE_SESSION_ID` | Claude-only | **drop** |

## 4. The two GitHub Actions that call an LLM — swap to OpenAI
- `.github/workflows/wrangler-fix.yml` — the auto-fix engine calls Claude to triage issues.
  Swap the model call to OpenAI, or disable it until ported.
- `.github/workflows/auto-promote.yml` — check for any Claude-action dependency. If it's just
  `promote.mjs` on a trigger, it's fine as-is.
- `ci.yml`, `branch-janitor.yml` are LLM-free → no change.

## 5. Token levers (from the other session — encoded here)
1. **Split `app.js` (27,812 lines) — the #1 win.** A read then pulls the right module, not 27k
   lines. **Caution:** gates key off `app.js` — `gen-code-map` (chapter markers), `gen-rule-usage`
   (the `data-r` scan), and `smoke`/`logic` (boot). Split along the **chapter boundaries CODE-MAP
   already names**, keep every `data-r` stamp intact, and re-run the **full gate suite after each
   move**. Best done as an early Codex task: clean, mechanical, high payoff — but it must stay
   gate-green.
2. **Use CODE-MAP hard.** `AGENTS.md` should tell Codex: open `docs/CODE-MAP.md` FIRST, jump to
   `file:line`, never scan `app.js` blind. (That's the `/atlas` discipline.)
3. **Codex model routing.** Route mechanical work to cheaper tiers; keep the hard reasoning up.

## 6. Decisions needed from you
1. **Same repo? — ✅ CONFIRMED (Jac).** Codex runs on this same GitHub repo, so CI (`ci.yml`),
   branch protection on `trunk`/`production`, the GitHub Actions secrets, and all of `tools/`
   carry over with **zero re-setup**.
2. **Keep trunk → staging → production? — ✅ CONFIRMED (Jac).** The tooling is portable; only the
   `/build /deploy /merge /promote` *invocation* was Claude-specific → wrap it in **npm scripts**
   so the flow is agent-agnostic (first Codex chore):
   - `npm run gates` → runs the full CI suite locally
   - `npm run deploy:staging` → `node tools/deploy-staging.mjs`
   - `npm run promote` → `node tools/promote.mjs`
   - `npm run cachebust` → `node tools/bump-cachebust.mjs`
3. **Backend (Google Apps Script):** keep the clasp service-account push (the only backend path) —
   just re-provision `GAS_SA_KEY_B64`. Go-live stays your Apps Script editor deploy.
4. **`app.js` split — ✅ CONFIRMED: Codex does it.** Split along the **chapter boundaries
   `docs/CODE-MAP.md` already names**, keep every `data-r` stamp intact, and **re-run the full
   gate suite after each move** (`gen-code-map`/`gen-rule-usage`/`smoke`/`logic` all key off
   `app.js`). Do it early — it's the #1 token lever (§5).
5. **Cross-review — recommend ADVISORY (Jac to confirm):** the `/cross-review` skill (§8b) posts
   its opinion on a PR; you decide. Promote it to a *blocking* required check later only if you
   want a hard merge-gate.

## 7. First-week Codex checklist
- [ ] Confirm Codex on the **same** GitHub repo (inherits CI + branch protection + Actions secrets).
- [ ] Create `AGENTS.md` (seed from `CLAUDE.md`; graft in `build`/`deploy`/`promote`/`clasp`/
      `style`/`wrangler-style` runbooks; point it at `docs/CODE-MAP.md` as the nav entrypoint).
- [ ] Add the §6 npm scripts so the ship flow is agent-agnostic.
- [ ] Re-provision agent-env secrets from your vault (§3) — never via chat/repo.
- [ ] Swap `wrangler-fix.yml` (and check `auto-promote.yml`) to OpenAI, or disable.
- [ ] Split `app.js` by CODE-MAP chapters, re-running the full gate suite after each move.

## 8. Running Claude + Codex on one repo — collisions & cross-review
Both agents on one repo is safe *if* each stays in its own lane and the shared integration point
(`trunk`, branch-protected) serializes them.

### 9a. Collision avoidance — namespace by platform
- **Branches:** prefix by platform. Claude already uses `claude/<slug>`; **Codex uses
  `codex/<slug>`.** One glance says who owns a ref; the two never fight over the same branch.
- **Deploys — already isolated, nothing to change.** The staging deck writes immutable
  `d/<branch-slug>-<n>/` folders keyed by branch, so `codex/foo` → `codex-foo-1`, `claude/bar` →
  `claude-bar-1`. No collision, and the `/d/` launcher + in-app **Staging ▾** switcher list both
  agents' deploys side by side.
- **Features:** keep **one `FEATURES` flag per feature** (not per platform); note the owning
  platform + branch in the flag's comment so neither agent re-implements a flag the other owns.
- **Integration:** both PR into `trunk` (branch-protected → writes serialize, no direct pushes).
  Two PRs touching the same lines = an ordinary merge conflict, resolved at merge time.
  **Production only moves via `/promote` — a human call — and that stays the single go-live gate
  for BOTH agents.** Neither agent ever ships to production on its own.
- **The catch-all = a work ledger.** Keep a tiny shared `docs/WIP.md`: one line per in-flight
  feature — `owner (claude|codex) · branch · flag · one-line status`. Each agent **appends when it
  starts** a feature and **removes on merge**. Before starting anything, an agent reads WIP.md so
  the two never grab the same work. (`branch-janitor` can flag stale entries.)

### 9b. Cross-review — "look at what the other one did and tell me what you think"
A small skill on each side, both grounded in the SAME canon (`docs/CODE-MAP.md` + the R0–R25
rulebook + `style`/`wrangler-style` + the specs) so they judge by one standard:
- **Claude:** a `/cross-review <codex-branch-or-PR>` skill — fetch the diff, check it against the
  gates, the R-rulebook, and the design canon, then report **agree / disagree / risks / canon
  violations** with `file:line` citations. (It's the existing `/review` + `/code-review`, pointed
  at Codex's PR with a "measure against canon" framing.)
- **Codex:** a mirror command that does the same to a `claude/*` PR, pointed at the same canon files.
- Because production is `/promote`-gated by a human, cross-review is **advisory** — it informs
  your call, it doesn't auto-merge. Make it a required PR check only if you want it blocking.

## 9. Current work-in-flight (context for whoever picks up the UI)
The active branch `claude/rental-wrangler-ui-research-rhd74v` (PR #752) holds the **Phase-2
`dv2` redesign**, gated behind `FEATURES.designV2` (off in production; auto-on on staging/local
via the `html.dv2` class). Steps 1–2 of the inline-expand model are built: a single-click reveals
a record **in the list** (row expands, height-capped to the column), reshaped to the section
**plate-stack** (header-as-close, collapsed Inspection + History, swipe-easing reveal). Remaining:
carry the reshape into Rentals + Customers, the History-search footer, links-land-on-section,
mobile paged sections + To-Do, and retiring the legacy card-swap detail. Full plan:
`docs/superpowers/specs/2026-07-20-list-views-inline-expand-design.md` and
`docs/superpowers/plans/2026-07-21-list-detail-views-build-plan.md`.
