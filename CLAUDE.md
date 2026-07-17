# Rental Wrangler — project notes for Claude

Heavy-equipment rental management SPA for **JacRentals** (Sulphur, LA).
Vanilla-JS single-file app (`app.js`), `style.css`, `index.html`, `config.js`,
`data.js`; Google Apps Script backend (schema-less Sheets, deployed by paste —
`backend/` is gitignored, never served by Pages).

**Contents:** [Interaction](#interaction-popup-first-single-attempt--jac-2026-07-16) ·
[Design language](#design-language) · [Deploy & gates](#deploy--gates) ·
[Don't](#dont) · [Delegation & model triage](#delegation--model-triage).
Cross-session memory lives in **`MEMORY.md`** (read at `/start`); path-scoped detail
lives in **`.claude/rules/`** (loads only when the relevant files are touched).

## Interaction (popup-first, single-attempt — Jac, 2026-07-16)

**Every decision and question goes through the `AskUserQuestion` popup.** This
**supersedes** the 2026-07-15 "hybrid / inline-favored" rule — the popup format is
what Jac wants for all choices.
- **Try the popup exactly ONCE.** Do **NOT** retry a popup that fails — a stalled/
  aborted permission stream is why sessions used to hang. One attempt, then fall back.
- **If that one popup fails, fall back to INLINE** — the *same* question, the *same*
  options as lettered choices (**A / B / C …**) plus an **Other**, in a crisp
  structured block. No second popup.
- Lead with the outcome. An **artifact** is still the right call for anything
  comparative or visual (it renders in the cloud web app; a localhost preview does
  not) — the artifact *shows* the options, the popup (or its inline fallback) *asks*.
- **Batch related questions and favor multiSelect** (Jac: *"I love the multiselect
  most"*). One popup carries up to **4** questions — group related ones instead of
  asking one at a time — and use **multiSelect** whenever the answers aren't mutually
  exclusive. Applies everywhere, including `/brainstorming`'s clarifying questions.

## Design language

**Every new or reshaped UI runs through the `jactec-ui` skill** — the single design
skill and quality gate. The house language is the **"yard data-plate"**: dark
industrial steel, **ONE** safety-orange accent (`--accent #ff7a1a`), a hi-vis
**hazard-stripe** signature (`repeating-linear-gradient(135deg,var(--yellow,#f5c542)
0 13px, #14181d 13px 26px)`), stamped **Saira Condensed** labels, corner **rivets**,
ignition-style primary buttons, and a light **wrangler/ranch seasoning** — voice-first
("Wrangle", "Round up", "Corral", "Brand"), with restrained leather-tan (`~#c2925a`)
touches only. If a glance reads "western" before "industrial rental yard," dial it back.

- **Scope: new/reshaped UI only** — do **NOT** retroactively restyle the existing site
  unless Jac asks for a site-wide pass.
- Full tokens, signature recipes, the R0–R25 rulebook, the anti-slop checklist, and the
  folded sub-capabilities (aesthetic direction, mobile, DESIGN.md, `/role` audit) all
  live in `jactec-ui`. Reference implementations: `.login-*` and `.cancel-arc` in `style.css`.

## Deploy & gates

**Trunk + two chat-driven gates** (2026-07-13; `main`→`trunk` rename same day). `trunk`
is the integrated trunk branch but **NOT live**; Pages serves the separate **`production`**
release-pointer branch — a merge to `trunk` no longer goes live. Both gates run on Jac's
say-so:
- **`/deploy`** (`tools/deploy-staging.mjs`) — push the feature branch's site files to the
  staging repo (`operations-jacrentals/rental-wrangler-staging`, its own Pages branch
  `main`); review the running app at the staging URL. It bumps the shared `?v=` and
  curl-verifies the live bytes. A failed/unverified deploy is a **HARD STOP** — staging
  must never fall behind. (`STAGING_DEPLOY_PAT` authenticates the push — never echo it.)
  - **Staging traffic control** (`tools/staging-lease.mjs`, N=1): staging is one shared slot
    guarded by a git-native lease — `control.json` on the non-served `staging-control` branch of
    the staging repo. `/deploy` acquires the slot before pushing; a second session auto-queues and
    deploys when the slot frees. **The 30-min holder TTL is the review budget** — a holder does no
    work during Jac's review, so a review that outruns 30 min must re-run `/deploy` (idempotent —
    it renews the same slot in place) to refresh the lease. **`/deploy` exit 3 = staging BUSY, not
    broken** — contention, not a bad PAT: report the holder + ETA and re-run `/deploy`, never
    rotate the token. `/merge` releases the slot **by branch** (soft — TTL is the backstop); a
    `not-held` at that point means the review outran the TTL → re-`/deploy` before `/promote`.
    `reset --force` is a **loud, stop-the-world manual-recovery op** — it can drop a concurrent
    acquire and wipe an in-flight holder (whose next `renew` then returns `not-held`); use only to
    unwedge a corrupt/stuck `control.json`. The advisory marker `.staging-lease.json` is
    diagnostic-only and gitignored.
- **Gate 1 `/merge`** — feature branch → PR → `smoke` CI → squash-merge to `trunk`
  (integrated, still not live). `trunk` is **branch-protected**; **NEVER** `git push origin
  HEAD:trunk` (or `HEAD:production`) directly — it's rejected.
- **Gate 2 `/promote`** — `node tools/promote.mjs` (bare = read-only preview; `--yes` to
  run) fast-forwards `production` to the approved `trunk` commit → app.jacrentals.com goes
  live. Fast-forward-only; verifies the live `?v=` after; refuses if staging is behind. **The
  only step that changes the live site — always Jac's explicit call.**
- **`/live`** — one word runs `/deploy → /merge → /promote` end to end and takes the feature
  branch all the way live. Runs straight through (Jac: don't stop unless there's something to
  see/know — a red gate or a surprise commit in the promote range). A **config-only** branch
  (nothing served changes) ships by `/merge` alone — no deploy, no promote.
- Big *replacements* ride behind a `FEATURES` flag in `config.js` (`flagOn()` reader) so
  backing a swap out is a runtime toggle. (A flag hides execution, not source, on public
  Pages — never gate a secret/auth check on it.)

**Gates (must pass before push):** `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
`node ci/lease-test.mjs`, `node ci/lease-deploy-test.mjs`, `node ci/gen-rule-usage.mjs --check`,
`node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`. Port 8000 is reserved —
swap to 9147 first: `sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`, run, then `git
checkout -- ci/`. The two `lease-*` suites are **pure-Node** (mocked git seam, no browser/server)
— **excluded from the port swap** and never touch the network.

**Cache-bust every deploy:** bump the shared `?v=` on `style.css`, `rule-usage.js`, and
`app.js` in `index.html` (Pages serves `max-age=600`, no per-file hashing). Don't add `?v=`
to the ES-module imports inside `app.js`. (`deploy-staging.mjs` bumps it for you.)

**Session title = this session's PRs.** On opening a PR, append its number to
`.claude/.session-prs` (gitignored) and surface a one-tap `/rename #<nums> · <branch-label>`
(the model can't self-`/rename`); remove it on merge/close. A `SessionStart` hook
(`.claude/hooks/session-title.mjs`) re-derives the title each start/resume, respecting a
manual rename. Full rule: `/start` §4.

**R-rulebook:** every UI element is stamped `data-r="Rxx"`; regenerate `rule-usage.js` with
`node ci/gen-rule-usage.mjs` when usage changes (`--check` is the CI drift + duplicate
guard). New popups also need a `WINDOW_CATALOG` entry (`ci/check-window-catalog.mjs`). These
CI guards are the enforcement — the Rulebook can't silently drift.

**Backend** ships via `/clasp` on the service-account path (`GAS_SA_KEY_B64`; clasp OAuth is
RAPT-blocked). `Code.gs`/`Code.js` are gitignored. Push only — go-live is Jac's Apps Script
editor deploy.

## Don't

- Never put the model identifier, secrets, or `DEFAULT_CONFIG` passwords in the repo (it's
  public via Pages). Backend `Code.gs` stays gitignored.
- Changing a WO part/task line to Complete must NOT complete the work order — only the blue
  **Complete WO** button does.
- Never hand-roll an icon — source it from Lucide (rules in `.claude/rules/icons.md`).
- Never push directly to `trunk`/`production` — integrate via `/merge`, go live via `/promote`.

## Delegation & model triage

Push cheap work down, keep the hard calls up. **Delegate by cost-of-being-wrong AND whether
the main thread needs the intermediate reasoning** — not blindly always. Default to
**background** agents so the main chat stays free, and always tell Jac in one line which
agent + model you assigned and why.

| Tier | Model | Delegate this |
|---|---|---|
| Mechanical · IO | **Haiku** | git/gh plumbing, grep/atlas sweeps, file munging, run-a-script-and-report |
| Scoped build | **Sonnet** | UI/code from a settled spec, an additive GAS handler, PR bodies, research gathering |
| Hard reasoning · main | **Opus** | specs, security/auth/PII gates, cross-system architecture, ambiguous calls |
| Frontier escalation (rare) | **Fable** | a sub-problem Opus itself stalls on; correctness ≫ cost (2× Opus, slower) |

**Never delegate (keep on main):** authoring/revising specs; security / auth / data-gate
calls (role-password, customer isolation, margin-floor visibility — wrong = live PII or
pricing leak); irreversible / live-deploy ops (`/promote`, force-push, secret handling); any
bug that already resisted ≥2 fixes. A subagent that reads secrets is Sonnet-minimum and must
never echo a secret value.

**Fan-out:** when the same mechanical step repeats across many similar items, drive it as
parallel agents (or a Workflow when opted in), not a manual loop.

**Mockups — show, don't describe; cheapest tier first:** ① inline markdown / ASCII / mermaid
(≈ free) → ② a self-contained **artifact** (~1–3k tokens; the cloud sweet spot) → ③ Figma /
Canva (only when the design IS the deliverable). One good mockup over three rough ones.

**Something reported broken → `wrangler-fix` first:** prove the claim against canon with
citations, trace to the root cause, fix only the proven cause, then re-reproduce.
