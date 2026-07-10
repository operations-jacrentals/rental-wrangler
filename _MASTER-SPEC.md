# master-spec — the shared, spec-only surface

This branch carries ONLY `docs/specs/` (the per-area specs + the AREAS-ROADMAP index).
It is the live **pre-publish** visibility hub: every area/task branch pushes its in-flight
spec changes here and reads everyone else's, so parallel projects see each other's design
intent BEFORE any code is published to `main`.

It does NOT replace the promotion path — authoritative specs still ride
`area/<domain>` → `staging` → `main` with their code. This branch is the shared draft layer.

Do NOT commit code or anything outside `docs/specs/` here. Do NOT merge this branch into a
code branch. Sync is path-scoped via the tool:

    node tools/spec-sync.mjs down            # session START — pull everyone's latest specs
    node tools/spec-sync.mjs up "<message>"  # every ~2h + before ending — push your spec deltas
    node tools/spec-sync.mjs status          # see what would move each way

The tool only ever pushes the spec files YOU changed, so it can't clobber a sibling area's spec.
