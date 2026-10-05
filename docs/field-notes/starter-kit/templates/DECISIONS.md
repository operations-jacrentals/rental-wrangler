# Decisions ledger

> **Append-only. Every row dated. A decision is not made until it has a row here.**
>
> Three rules, learned expensively:
> 1. **Read this before designing anything.** Don't re-derive what's settled.
> 2. **Read to the END, and check dates.** A later row may supersede an earlier one.
>    Grepping and stopping at the first hit is how a dead decision gets cited as canon.
> 3. **When something is reversed, point both ways** — the old row gets `→ superseded by #N`,
>    the new row gets `(reverses #M)`. Never delete a row; a struck-through decision is
>    evidence, a missing one is a mystery.

| # | Date | Area | Decision | Why | Status |
|---|------|------|----------|-----|--------|
| 1 | YYYY-MM-DD | example | The thing that was settled, stated as a rule. | The reason, in one clause. | LIVE |
| 2 | YYYY-MM-DD | example | The replacement rule. (reverses #1) | What changed our mind. | LIVE |

**Status values:** `LIVE` · `SUPERSEDED → #N` · `OPEN` (raised, not settled) ·
`DEFERRED` (settled to not decide yet) · `PROVISIONAL` (in use, not blessed).

**Areas** are yours — keep the list short enough to scan: `ui`, `data`, `money`, `auth`,
`process`, `copy`.
