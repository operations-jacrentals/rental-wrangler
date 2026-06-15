# Mr. Wrangler — the self-healing pipeline

Goal: report a glitch to Mr. Wrangler and have it **fixed and live** with no
human in the loop — the way today's right-click bug got fixed, but automatic.

Because the app deploys differently in two places, fixes route down three tracks:

| Track | Bug type | How it ships | Speed |
|-------|----------|--------------|-------|
| **A — Data** | wrong status / date / name / hours on a record | Mr. Wrangler auto-applies the change in-app; the normal diff-sync persists it (money/card fields are hard-blocked in code) | instant |
| **B — Code** | an actual glitch in `app.js` / `style.css` / `index.html` / `config.js` | GitHub issue → Claude coding agent patches → PR → **3 CI gates** → auto-merge → Pages deploys `main` | ~1–2 min, live |
| **C — Backend** | a bug in `Code.gs` (Apps Script) | **cannot auto-deploy** — `Code.gs` is pasted by hand into the Apps Script editor; fixes batch into one paste for a human | on a cadence |

The split is forced by the architecture: the frontend deploys from GitHub `main`
via Pages (automatable), but `Code.gs` is gitignored and pasted by hand (not).

---

## Track B — the code-fix engine (this is the headline)

```
You tell Mr. Wrangler "right-click isn't working"
   │  in-app: + screenshot + console errors + the element's R-rule stamp + view/role
   ▼
A GitHub issue is filed with that repro packet, labelled `wrangler-fix`
   ▼
.github/workflows/wrangler-fix.yml wakes → Claude coding agent reproduces +
patches the frontend, runs the 3 gates, opens a PR
   ▼
CI (ci.yml): syntax · boot smoke · logic suite · rule-usage   ◄── the safety net
   ▼
all green → auto-merge → Pages redeploys → refresh, glitch gone
```

The browser **can't** rewrite `app.js`, so the actual patching happens on GitHub
via a coding agent (the same kind that fixes bugs in a normal session), triggered
automatically by the label.

### Switch-on (one-time, in repo Settings — only the owner can do these)

1. **Secrets** — Settings → Secrets and variables → Actions → *New repository secret*:
   - `ANTHROPIC_API_KEY` — your Anthropic API key (lets the Action call Claude).
   - `WRANGLER_PAT` — a **fine-grained PAT** scoped to this repo: *Contents RW ·
     Pull requests RW · Issues RW · Actions R*.
     - Why a PAT, not the built-in `GITHUB_TOKEN`? A PR opened by `GITHUB_TOKEN`
       does **not** trigger the CI workflow — so it could never go green and never
       auto-merge. The PAT opens the PR "as you", so CI runs normally.
     - Alternative: run `/install-github-app` to use the Claude GitHub App token
       instead of a PAT.
2. **Allow auto-merge** — Settings → General → Pull Requests → ✓ *Allow auto-merge*.
3. **Branch protection** — Settings → Branches → add a rule for `main`:
   - ✓ *Require status checks to pass before merging* → add the **`smoke`** check
     (from the "CI — boot check" workflow).
   - This is what makes "auto-merge on green" mean "all 3 gates passed". A fix that
     breaks the build can't merge.

Until these are set the workflow is inert — nothing ships without the switch-on.

### Autonomy

Configured for **full auto-merge on green** (owner's choice, 2026-06-15): a code
fix reaches `app.jacrentals.com` the moment CI passes, no tap. The CI gates are the
safety net; a fix that breaks a gate can't merge. A subtly-wrong-but-CI-passing fix
*would* ship — the mitigation is investing in `ci/logic-test.mjs` coverage (every
test added is a guardrail the auto-fixer must clear) and the one-click revert PR.

---

## Track A — data fixes (auto-applied, money hard-blocked)

Mr. Wrangler can correct a data error he diagnoses (a wrong status/date/name/hours/
note/flag/link on a specific record). He emits a fenced action block; the frontend
**hard-blocks money/card/payment fields in code** (never trusting the model's
judgment), auto-applies safe fixes through the normal sync, logs an audit trail,
and offers Undo. No backend endpoint needed — the app already persists `DATA`
changes via diff-sync. *(Build status: pending.)*

---

## Track C — backend (Apps Script) fixes (batched for a human paste)

`Code.gs` can't auto-deploy. Backend fixes accumulate into a pending changeset and
surface to the owner as "N backend fixes ready to paste", emitting one compiled
`Code.gs`. *(Build status: pending.)*
