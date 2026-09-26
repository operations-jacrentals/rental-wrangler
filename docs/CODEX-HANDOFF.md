# Rental Wrangler — Claude Code → OpenAI Codex migration handoff

**Purpose:** everything Codex needs to take over this repo. Written to travel *with* the repo,
so it works wherever Codex reads it.

> **Two-doc handoff:** this file is the **setup mechanics** (repo, secrets, tooling, dual-agent).
> Once set up, **study the project itself** via **`docs/CODEX-ONBOARDING.md`** — a guided reading
> order for the current state, the research, the flaws, the design canon, what's been built, and
> what's next.

## TL;DR — most of this is agent-agnostic and already travels
The project is mostly portable Node + markdown on a GitHub repo. Most of the setup is **already
done** — what remains is short:

1. ~~**Create `AGENTS.md`**~~ — ✅ done (#762/#765, refreshed 2026-08-10). Codex reads `AGENTS.md`,
   not `CLAUDE.md`.
2. ~~**Wrap the ship flow in npm scripts**~~ — ✅ done: `gates`, `deploy:staging`, `promote`,
   `cachebust`. ~~**Build the Codex plugin**~~ — ✅ done, 12 commands.
3. **Re-provision secrets** in Codex's environment — *you* do this, never through chat or the repo.
   **Still open.**
4. **Swap `wrangler-fix.yml` to OpenAI** (or disable it). **Still open** — it is the only workflow
   that actually calls an LLM.
5. **Split `app.js`** by CODE-MAP chapters — **still open**, and the largest single token win (§5).
6. **If Claude + Codex run at once:** namespace branches (`codex/*`) + a `docs/WIP.md` ledger +
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
- **The repo brain** — `docs/CODE-MAP.md`, `MEMORY.md`, `docs/`, and `.claude/rules/` are all
  markdown and travel automatically. Codex can **read** `.claude/skills/*` and `.claude/rules/*`
  as plain files even though it can't "invoke" them as skills.

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
| `style` · `wrangler-style` | **PORT (critical)** | the design canon (palette, type voices, Signal·Gate·Stamp·Ref·Door, and the measurable spec — control height, size ladder, contrast floors). The reason the UI is one family. |
| `wrangler-fix` | **PORT** | "prove the root cause with citations before changing code" — the debugging methodology. |
| `atlas` | **PORT (as instruction)** | CODE-MAP-first navigation → the #2 token lever (§5). |
| `art-pipeline` | **PORT (critical, added 2026-08-05)** | the Figma→code method for illustrated UI: export never recreate, 9-slice, stretch-vs-round, and eight measured traps. This is the *active* design method — not yet wrapped as a Codex command. |
| `startup` | **ADAPT** | session orientation. **Renamed from `start` on 2026-07-28 (#802)** to end a plugin name collision; the Codex plugin command is still `start`. Keep the branch-flow parts, drop Claude-session bits. |
| `run-live` · `lazy-audit` · `webapp-testing` | **ADAPT** | Playwright-based test/audit flows — portable, useful. |
| `paint` | **ADAPT** | the guided design pipeline (inspiration → Canva critique → Figma → gated code). Depends on Canva/Figma MCP connectors, so port only what Codex can actually reach. |
| `prompt-a` · `prompt-b` · `promptai` | **ADAPT** | the external-model audit handoff. Ironically useful in reverse: Codex can use these to hand a prototype to *another* model. |
| `brainstorming` | **ADAPT** | the spec-first design dialogue — a useful pattern, not Claude-specific. |
| `audit` | **DROP** | Claude token-efficiency audit — harness-specific. |
| `end` · `skill-creator` | **DROP** | Claude session/skill management. |

**Not yet wrapped as Codex commands:** `art-pipeline`, `paint`, `lazy-audit`, `run-live`,
`prompt-a`/`prompt-b`. The plugin currently ships 12: `start`, `style`, `wrangler-style`, `atlas`,
`wrangler-fix`, `gates`, `build`, `deploy`, `merge`, `promote`, `live`, `clasp`. Codex can still
**read** the unwrapped ones as plain markdown under `.claude/skills/<name>/SKILL.md`.

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
   lines. **Caution:** gates key off `app.js` — `gen-code-map` (chapter markers) and `smoke`/`logic`
   (boot). Split along the **chapter boundaries CODE-MAP already names** and re-run the **full gate
   suite after each move**. Best done as an early Codex task: clean, mechanical, high payoff — but
   it must stay gate-green.
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
   `docs/CODE-MAP.md` already names** and **re-run the full gate suite after each move**
   (`gen-code-map`/`smoke`/`logic` all key off `app.js`). Do it early — it's the #1 token lever (§5).
5. **Cross-review — ✅ CONFIRMED: a tool, never a gate (Jac).** The `/cross-review` skill (§8b) is
   something you run **on demand** for a second opinion; it never blocks a merge and is never a
   required check.

## 7. First-week Codex checklist
*Status as of 2026-08-10.*
- [x] Confirm Codex on the **same** GitHub repo (inherits CI + branch protection + Actions secrets).
- [x] Create `AGENTS.md` — **done** (#762/#765, refreshed 2026-08-10). It carries the ship flow,
      the backend runbook, the design canon, and the Codex command list.
- [x] Add the §6 npm scripts — **done**: `gates`, `deploy:staging`, `promote`, `cachebust`.
- [x] Build the Codex plugin — **done**: `plugins/rental-wrangler-commands` (12 commands) with its
      marketplace manifest at `.agents/plugins/marketplace.json`.
- [ ] **Re-provision agent-env secrets from your vault (§3) — YOURS to do, never via chat/repo.**
- [ ] **Swap `wrangler-fix.yml` to OpenAI, or disable it.** Still open: it calls Claude to triage
      auto-fix issues. `branch-janitor.yml` also mentions Claude but only to recognise `claude/*`
      branch names — no LLM call, so it needs a `codex/*` pattern, not a model swap.
      `auto-promote.yml` and `ci.yml` are LLM-free.
- [ ] **Split `app.js` (27,687 lines) by CODE-MAP chapters**, re-running the full gate suite after
      each move. Still open — the #1 token lever (§5).
- [ ] Wrap the unwrapped skills as Codex commands (§2b) — `art-pipeline` first, since it is the
      active design method.

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
A small skill on each side, both grounded in the SAME canon (`docs/CODE-MAP.md` +
`style`/`wrangler-style` + the specs) so they judge by one standard. **It is a tool you reach for
on demand — never a gate, never a merge block, never a required check.**
- **Claude:** a `/cross-review <codex-branch-or-PR>` skill — fetch the diff, check it against the
  gates and the design canon, then report **agree / disagree / risks** with `file:line` citations.
  (It's the existing `/review` + `/code-review`, pointed at Codex's PR with a "measure against
  canon" framing.)
- **Codex:** a mirror command that does the same to a `claude/*` PR, pointed at the same canon files.
- Production is `/promote`-gated by a human, so cross-review only ever **informs your call** — you
  run it whenever you want a second opinion, and it never touches the merge.

## 9. Current work-in-flight (context for whoever picks up the UI)
*Refreshed 2026-08-10. The earlier version of this section described the `dv2` inline-expand branch
as in-flight; that work **landed on `trunk` as #766** and its `FEATURES.designV2` flag was retired.*

The live frontier is the **design system / V2 card**, landed as **#798** (`def4a15`). It is a
Figma-sourced, illustrated UI — the interface *is* artwork — so the working method is the
**`art-pipeline`** skill: **export from Figma, never recreate in CSS**; bake static art as one
z-ordered `background-image`; carry anything state-coloured as a white-silhouette `mask-image`
filled with `var(--row-hue)`; make panels resize with `border-image` 9-slice using the measured
bands in `docs/design/SLICE-SPEC.md` (structure `stretch`, countable rhythm `round`).

**Read `docs/design/HANDOFF-2026-08-05.md` before touching any of this.** Two things it settles
that will otherwise cost you a day:

- **The V2 card is "a start," not at fidelity.** It still uses fixed-size scaled art, not
  `border-image` 9-slice. The spec exists; nothing is wired to it yet.
- **Four panels are blocked on Jac redrawing the artwork — do not try to fix them in CSS.**
  `asm-deck` cannot slice below 1316px (its chips and nameplate are frozen in a 1100px corner);
  `asm-housing`'s interior staircase is a near-rhythm that can neither `stretch` nor `round`;
  `asm-headboard`/`asm-rowboard` need text-free re-exports; the rail export has three defects
  (#259). **`asm-headboard`, `asm-rowboard` and `asm-channel` slice cleanly today** — start there.

Ledger rows **#238–#261** cover everything settled in that run, including two errors that were
scoped back rather than deleted. Read them; re-deriving them is what made the last session slow.

Also live but unrelated to the redesign: `docs/handoffs/audit-2026-07-19-rentals-dispatcher-remaining-work.md`
carries the parked Bucket-B dispatcher findings from the RENTALS audit.
