# <Project> — project notes

<One paragraph: what this is, who it's for, what it's built with. A model reads this first,
every session. Keep it under a screen.>

**Contents:** [Interaction](#interaction) · [Design](#design) · [Ship flow](#ship-flow) ·
[Don't](#dont) · [Delegation](#delegation)
Cross-session memory lives in **`MEMORY.md`**. Path-scoped detail lives in `.claude/rules/`
(loads only when the relevant files are touched).

## Interaction

- **How to ask me things:** <one format, decided once. Batched? One at a time? Inline?>
- **Lead with the outcome**, not the process.
- **Show, don't describe** — a rendered page beats a paragraph for anything visual or
  comparative.
- **Don't stop unless there's something to see or know.**

## Design

- Every new or reshaped UI runs through **<your rules skill>** and **<your decisions skill>**.
- **Every UI decision is indexed in `docs/DECISIONS.md`.** Read it before designing, read to
  the END, and add a row when something is settled.
- <The one-line version of the design language: palette, type, one accent.>

## Ship flow

<The exact sequence, with who owns each gate. Name the one step that changes what users see,
and say plainly that it is a human's call.>

**Gates (must pass before push):**
```
node ci/smoke.mjs
node tools/gen-code-map.mjs --check
<every other check, one per line, copy-pasteable>
```

## Don't

- Never commit secrets. <Name the env vars by name; never a value.>
- Never push directly to `<protected branch>`.
- <The project-specific rule someone got wrong once and must never get wrong again.>

## Delegation

Push cheap work down, keep the hard calls up. Delegate by **cost-of-being-wrong** and by
whether the main thread needs the intermediate reasoning.

| Tier | Delegate this |
|---|---|
| Mechanical · IO | git plumbing, grep sweeps, file munging, run-a-script-and-report |
| Scoped build | code from a settled spec, PR bodies, research gathering |
| Hard reasoning | specs, security/auth/data gates, architecture, ambiguous calls |

**Never delegate:** authoring specs · security, auth or data-exposure calls · irreversible or
live-deploy operations · any bug that already resisted two fixes.
