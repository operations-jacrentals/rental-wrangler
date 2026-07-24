# Rental Wrangler — operating guide

Rental Wrangler is a heavy-equipment rental-management SPA for JacRentals (Sulphur, LA). It is vanilla JavaScript: the frontend is primarily `app.js`, `style.css`, `index.html`, `config.js`, and `data.js`. The Google Apps Script backend is schema-less Sheets code, is gitignored, and is never served by Pages.

## Start with the map

Before reading application code, open `docs/CODE-MAP.md` and navigate by its `file:line` entries. Do not scan `app.js` blindly. Read `MEMORY.md` for durable context and the relevant `.claude/rules/` files before editing scoped files (notably the icon rule: use Lucide; never draw icons by hand).

For design work, use the design canon and current specs as the source of truth, not reverse-engineering from the current implementation:

- `docs/superpowers/specs/2026-07-20-decisions-ledger.md`
- `docs/superpowers/specs/2026-07-20-list-views-inline-expand-design.md`
- `docs/superpowers/specs/2026-07-20-mockup-critique-log.md`
- `DESIGN.md` and `docs/design/` when applicable

## Safety and product constraints

- This repository is public via Pages. Never commit, print, or report secrets, passwords, tokens, service-account material, or backend source/configuration.
- `Code.gs` / `Code.js` remain gitignored. If either is staged, unstage it.
- Never push directly to `trunk` or `production`. Use a PR to integrate; production promotion is always a human-directed action.
- Do not make autonomous decisions about money, auth, role gates, customer PII/isolation, work-order completion semantics, secret handling, force pushes, or live deployment. Ask Jac when an explicit decision is required.
- Completing a work-order part/task must not complete the work order; only the explicit Complete WO control does that.
- Large replacement UI work must be additive behind a `FEATURES` flag. A flag is not a security or authentication control.
- When a defect is reported, establish the root cause with evidence before changing code.

## Gates and ship flow

The required ship sequence is:

```
feature branch → build → staging review → PR/merge to trunk → human-approved promotion
```

1. Build on a feature branch (use `codex/<slug>` when Codex and Claude may work concurrently). Finish the approved scope, defer unresolved product/security decisions, and keep backend changes additive.
2. Run `npm run gates` before pushing. Gates must be green.
3. Deploy the committed feature branch for review with `npm run deploy:staging`. This pushes a review copy to the separate staging repository; it does not merge or go live. Treat a failed or unverified staging deploy as a hard stop.
4. After Jac reviews and explicitly authorizes integration, open a PR and squash-merge it into protected `trunk`. Never bypass branch protection.
5. Promotion is the only production-changing operation. On Jac's explicit instruction only, run a preview with `npm run promote`, review its content-freshness result and range, then run `node tools/promote.mjs --yes` only after Jac confirms the exact range. The tool fast-forwards `production` and verifies the live site.

`trunk` is integrated but not live. Staging must serve the actual trunk bytes before promotion; token equality alone is insufficient. Do not use a staging or production override casually. Cache-busting remains required for served-file changes; use `npm run cachebust` where the ship flow calls for it.

## Staging deploy details

`npm run deploy:staging` uses `tools/deploy-staging.mjs`. The default staging deck deploy writes an immutable `d/<branch-slug>-<n>/` directory and prints a deploy ID/URL to review. The `--slots` lease pool is an exceptional backup path: an exit code of 3 means busy, not broken; report the holder/ETA and retry later, never rotate credentials. Never expose `STAGING_DEPLOY_PAT` or a deploy key.

## Backend push runbook

The usable backend push path is service-account based, not interactive clasp OAuth:

1. Require `GAS_SA_KEY_B64` in the agent environment and the impersonation subject required by the backend handoff. Never reveal either value.
2. Read `docs/handoffs/BACKEND-DEPLOY-QUEUE.md` and use `docs/handoffs/gas-deploy-service-account.mjs` to pull the live backend, make additive changes, and prepare the spliced diff.
3. Show Jac the intended backend diff and get explicit confirmation before pushing. Push is not authorization to go live.
4. Jac performs the Apps Script editor deployment to production. Verify afterward with the documented anonymous rejection probe; an HTML/403 response indicates a broken anonymous deployment and needs recovery.

Do not spend time retrying `clasp login` as the default path: Workspace reauthentication blocks its OAuth refresh flow. Do not commit backend files.

## Design canon (mandatory for UI work)

Before any new or reshaped UI, read both authorities in full:

- `.claude/skills/style/SKILL.md` — measurable constraints.
- `.claude/skills/wrangler-style/SKILL.md` — locked project decisions.

Also read the relevant current feature spec and decisions ledger. Never derive a new
design decision by reverse-engineering `app.js` or `style.css`. `jactec-ui` is
retired and must not be used.

Non-negotiables:

- Dark theme only. The steel palette is frozen: use only its locked tokens. Do not
  add colours; a palette change requires a separate, explicit cascade project.
- Use exactly two type voices: body sans for record names and prose only; stamped
  mono for labels, chips, IDs, numbers, and dollar figures, with tabular numerals.
- Keep one control height and baseline, the fixed size ladder, and one chip radius.
  Actions use pill radius.
- Meet WCAG contrast floors and preserve colour-blind distinction. Never communicate
  meaning with colour alone.
- Keep the orange accent near or below 10% of a surface (the 60-30-10 budget).
- `colour = state`; `fill = today`. Do not hand-set state colours per renderer.
- State ladder for Signals and Gates: blue = Waiting; yellow = near/due; red =
  late/overdue/error; green = Done only; grey = not applicable yet. An on-time,
  incomplete item is Waiting (blue), never green.
- Use the shared vocabulary consistently: Signal = read-only state; Gate = turnable
  state; Stamp = quiet fact; Ref = linked record; Door = verb action.
- Door/action palette: orange = touchable/interactive; deep `--commit` blue =
  commit/create; green = money; red = destructive confirmation; Ghost = the one
  quiet Cancel/Close treatment. Muted blue is Waiting state, while deep blue is a
  commit Door. Green means Done for state and money for actions; keep those contexts
  distinct.
- Keep the voice industrial rental yard first, with restrained wrangler/ranch
  seasoning in copy rather than decorative chrome.

## Working rules

- If a colour, font, or component is uncertain, its answer is in the two canon
  files, the feature spec, or the decisions ledger. Read those sources; do not guess
  or copy the current implementation. The live app may be wrong; the canon is the
  reference.
- Do not invent UI pieces. Every element is a Signal, Gate, Stamp, Ref, or Door.
  If a new pill or button seems necessary, stop and ask rather than creating one.
- Everything new rides behind `FEATURES.designV2` and remains additive. With that
  flag off, the app must look and behave byte-for-byte as it does today. Back out any
  change that alters the flag-off app.
- Colour is never decoration. Use the colour the state calls for, never one chosen
  merely because it looks nicer.
- Done is factual, not aesthetic: green = genuinely finished; blue = waiting/on
  time; yellow = getting close; red = late or wrong.
- When decisions conflict, the newer decision wins; the decision bends before a
  measurable constraint does. Never let an older decision override a newer one.
- Never guess about money, pricing, customer data, login/roles, work-order
  completion, or anything that goes live. Surface those decisions for Jac.
- Before design-heavy implementation, show Jac a small preview or plan and get a
  nod. When uncertain, ask.

## Where to look

**Design authority — decides what is correct:**

- `.claude/skills/style/SKILL.md` and `.claude/skills/wrangler-style/SKILL.md` —
  the canon.
- `docs/superpowers/specs/2026-07-20-list-views-inline-expand-design.md` — the
  current feature spec, including the mockups and Jac's ETA ledger in words.
- `docs/superpowers/specs/2026-07-20-decisions-ledger.md` — locked decisions;
  newer entries win.
- `docs/superpowers/specs/2026-07-20-mockup-critique-log.md` — known flaws and
  their fixes.
- `docs/superpowers/plans/2026-07-21-list-detail-views-build-plan.md` — build plan
  and running shipped-work log.

**Where the current build lives — read to continue work, not to decide design:**

- `config.js` — `FEATURES.designV2`; `app.js` sets the `html.dv2` class.
- `style.css` — the `html.dv2` redesign blocks.
- `app.js` — inline-expand code: `rowEl`, `cardEl`, `openStandard`, `dv2On`, and
  `INLINE_EXPAND_CARDS`.

Reading those `dv2` implementation areas to extend them is expected. What is
off-limits is deciding what the design should be by copying the current app. The
visual mockups, hand-drawn sketches, and design artifacts are not in the repository;
do not hunt for them. Use the specs and the live staging build instead.

## Working conventions

## Invocable Codex commands

The repo-scoped Codex plugin is `plugins/rental-wrangler-commands`; its marketplace
manifest is `.agents/plugins/marketplace.json`. Keep its skills thin: each one points
back to this operating guide and the existing npm scripts rather than copying a runbook.

After cloning the repository in a Codex environment, install the marketplace and plugin
once, then begin a new task so Codex discovers the skills:

```text
codex plugin marketplace add .agents/plugins
codex plugin add rental-wrangler-commands@rental-wrangler
```

In the Codex desktop marketplace UI, add `operations-jacrentals/rental-wrangler` at
`trunk` and include both sparse paths: `.agents/plugins` and
`plugins/rental-wrangler-commands`.

Invoke a command as `$rental-wrangler-commands:<name>` (for example,
`$rental-wrangler-commands:style`). Available names: `start`, `style`,
`wrangler-style`, `atlas`, `wrangler-fix`, `gates`, `build`, `deploy`, `merge`,
`promote`, `live`, and `clasp`.

- `$rental-wrangler-commands:start` — at the top of every task, probe node/npm/gh/git,
  note the expected local Playwright limitation, verify origin/branch/tree state,
  read AGENTS/MEMORY/WIP plus the current spec and plan (report exact missing paths),
  choose the most efficient agent plan for the task (parallelize independent,
  low-risk reconnaissance or mechanical checks; keep product/security/money/auth/PII
  and work-order completion reasoning on the main thread), load the design canon and
  working rules, then propose a `codex/<slug>` branch and wait for explicit approval
  before switching. It never starts work on `trunk`.

  In a Codex sandbox, local `gh` credentials may belong to a different Windows
  identity than the user's desktop session. Do not loop on reauthentication or ask
  for a token. Use the authenticated GitHub integration for remote publishing when
  available, and never write credentials to the repo, workspace, or logs.

The five ship commands have these exact boundaries:

- `$rental-wrangler-commands:build` — build safe approved work, run gates, commit and
  push the feature branch, then stop before deploy.
- `$rental-wrangler-commands:deploy` — run `npm run deploy:staging`, print and verify
  the staging URL/new bytes, and hard-stop on failure or drift.
- `$rental-wrangler-commands:merge` — require staging review, run gates, push, open a
  ready PR, and queue `gh pr merge --auto --squash --delete-branch`; stop at trunk.
- `$rental-wrangler-commands:promote` — Jac's explicit call only; preview first,
  require staging/trunk freshness, then use the confirmed promote path and verify live bytes.
- `$rental-wrangler-commands:live` — deploy → merge → promote end to end; stop for
  red gates, review/freshness surprises, or sensitive product decisions. Config-only
  branches use merge alone.

The plugin is a portable command wrapper, not a second source of truth:
update this guide or the referenced canon/runbook first, then only adjust the small
wrapper that points to it.

- Keep a shared `docs/WIP.md` entry for each in-flight feature when multiple agents are active; read it before starting work and remove the entry after merge.
- Keep changes small and scoped. Run the full gates after structural moves, especially any future `app.js` split.
- Update `docs/CODE-MAP.md` through its generator when code-map-relevant structure changes.
- Report outcomes first, including the gate/deploy result and any deferred decision.
