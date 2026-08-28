# Field notes — what building this app actually taught us

Written 2026-08-20, reconstructed from this repo's own record: `MEMORY.md`, 68 design specs, the
178-row decisions ledger, ~40 handoff notes in `docs/handoffs/`, and the git history underneath.
Nothing here is generic best practice — every claim traces to something that happened on this
project, and most of them cost real time to learn.

The audience is **the next app**, not this one. None of it changes how Rental Wrangler works.

| File | What it is | Read it when |
|---|---|---|
| [`scaffolding-before-features.md`](./scaffolding-before-features.md) | The playbook — 14 sections on builder tooling, the code map, labelling, skills, UI/UX, disposable jigs, audits, agents, tokens, loops and local organisation. | Starting a new app, or deciding what to build before the first feature. |
| [`integration-field-report.md`](./integration-field-report.md) | What each external system actually cost — Stripe, texting, Google Maps, Gmail, GPS/telematics, Figma, and Apps Script itself. The specific traps, not the quickstarts. | Before wiring up any external service. |
| [`scaffolding-card.md`](./scaffolding-card.md) | The whole playbook on one page. | Pinning up, or pasting into a short prompt. |
| [`starter-kit/`](./starter-kit/) | Runnable scaffolding — two dependency-free scripts and seven templates. Start with its own README. | Day one of the next repo. |

Rendered PDF and self-contained HTML copies of these documents exist but are deliberately not
committed — they're build outputs, and the font-embedded HTML is ~265KB apiece. The Markdown here
is the source of truth.

## The two ideas everything else hangs off

**1. An AI-built app has two codebases** — the source, and the context needed to safely change it.
A person carries the second one in their head; a model rebuilds it from scratch every session,
every subagent, every audit. The machinery that makes that context cheap to load and impossible to
lose is worth more than any single feature. That machinery is most of what `CLAUDE.md`,
`MEMORY.md`, `docs/CODE-MAP.md` and the `ci/*-check` guards actually are.

**2. Anything enforced by remembering is already broken** — it just hasn't cost you yet. Every
rule worth having is a script that fails without it. This repo learned that twice: once with the
cache-bust bump, and once with the code map.

## What's deliberately not here

A fifth document — a candid retrospective on how the collaboration itself worked — was written at
the same time and kept out of this public repo on purpose. It's a named personal assessment, and
git history is permanent.
