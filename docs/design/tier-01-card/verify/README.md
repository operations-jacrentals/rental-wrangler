# P1 verification harness (parked)

Deferred from `claude/tier-01-card-audit-crnxj3` on 2026-07-31 (PR #785).

These scripts built and verified the Tier-0.1 **P1** block that now ships inside
`docs/design/tier-01-card/index.html`. They are parked because they only ever lived in an
ephemeral session scratchpad, and because they regression-test **six real bugs a fresh-context
review found after the block had already been landed and declared verified** (ledger #179).

| File | What it is |
|---|---|
| `p1.mjs` | The source of truth for the R2→R7 + P1 **CSS**. Injects it against a served prototype and screenshots. |
| `land.mjs` | **Generates the landed block** in `index.html` from `p1.mjs`'s CSS, so what ships is byte-identical to what was measured. Idempotent — replaces a previously-landed block. |
| `verify2.mjs` | Clean-load verification of all six #179 findings, each independently. |
| `regress.mjs` | The chained-interaction version (filter → search → open → remount). |
| `glow.mjs` | The **#146 audit**: proves nothing on the housing emits — an outer `0 0 Npx` shadow is light, an inset or hard-offset shadow is paint. |

## Running them

Serve the prototype from **inside** `docs/design/tier-01-card/` on port **9147** (8000 is
reserved): `python3 -m http.server 9147 --bind 127.0.0.1`. Kill a stuck one with
`fuser -k 9147/tcp`.

Playwright **must** launch with
`executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'` —
the plain chromium binary errors *"Old Headless mode has been removed"*. Wait ~3000ms after
`networkidle`; the component mounts asynchronously.

## What they exist to stop coming back

1. **`getComputedStyle` on a `display:none` element returns `transform: none`** — reading state off
   an element your own CSS hides pins that state forever. This killed the whole housing open/shut
   mechanic while a "measured proof" said it worked.
2. **dc-runtime RECYCLES row/head nodes positionally.** A presence-based "already built?" guard
   leaves an injected layer describing a *different record*.
3. The jump band being permanently swept on a row that unmounts while open.
4. `.rw-noframe` over-matching and taking chassis steel with the laser.
5. Head counts falling back to member **state** text, so an empty lifecycle group read "N OPEN".
6. `+N` specified by #170 but never emitted, so excess ticks clipped silently.

## Needs

Nothing to finish — they pass as of `d196df4`. Re-point the paths if the prototype moves, and
re-run `verify2.mjs` + `glow.mjs` after any change to the landed block.
