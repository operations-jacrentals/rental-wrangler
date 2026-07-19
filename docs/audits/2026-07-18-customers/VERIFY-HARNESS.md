# Behaviour-verification harness (learned the hard way, 2026-07-18)

How to prove a derivation change actually does what you think, in this app.

## The trap that cost me a false "verified" claim

First attempt measured through **`categoryStats`** and mutated seed data with `reindex()`.
It showed a clean delta (`avgRevUnit 862 → 346`) that matched the unit's price exactly — and it
was **meaningless**, because a control run against *unmodified trunk* reproduced the identical
delta. `reindex()` perturbs that stat the same way on both builds, so the test could not tell the
two apart. Two wrong hypotheses along the way:

- *"the service worker served stale bytes"* — no: `serviceWorkers: 0` on localhost, and a
  cache-busted refetch matched the served bytes.
- *"`rmemo` cached across the mutation"* — no: `RENDER_MEMO` is `null` outside a render
  (`app.js` — `rmemo` returns `compute()` when it's null; it is opened at render start and closed
  in a `finally`). Console calls always compute fresh.

The actual contaminant was `reindex()`. **Do not call it in a measurement.**

## The method that works

1. **Measure the primitive, not a downstream stat.** Replicate the function's own formula from
   `window.__rw` primitives and compare it against the shipped predicate, in the same page.
2. **Mutate the smallest possible thing** (one `eu.status`, one `w.cancelled`) and restore it.
3. **Never call `reindex()`** — it has side effects that move stats independently of your change.
4. **Run BOTH formulas in the same page load.** The "naive" (pre-fix) shape must NOT move and the
   shipped shape MUST move. That single comparison is the control — no build-swapping needed.
5. Assert on an **exact expected delta** (the unit's price, the WO's line cost), not just direction.

## Setup

Port 9147 is often taken by another session's `/run-live`. Use an override, and don't kill
anything you didn't start:

```
RW_PORT=9347 node .claude/skills/run-live/scripts/serve.mjs &
# open http://localhost:9347/#local   (seed data, no login, no backend, no PII)
```

Gates also want a free port — `sed -i 's/8000/9247/g' ci/smoke.mjs ci/logic-test.mjs`, run, then
`git checkout -- ci/`.

## Template

```js
const rw = window.__rw, D = rw.DATA;
const naive = (id) => /* the CURRENT (buggy) formula, from primitives */ 0;
const fixed = (id) => /* the predicate you shipped */ 0;
const before = { n: naive(ID), f: fixed(ID) };
target.someField = 'the void state';          // smallest possible mutation
const after  = { n: naive(ID), f: fixed(ID) };
target.someField = original;                   // restore
({ before, after,
   PASS: before.n === after.n && before.f !== after.f,   // naive blind, fixed sees it
   removed: before.f - after.f })                        // must equal the exact expected amount
```

## Gotchas

- Keep console scripts **small**. Anything looping `categoryStats` over a category, or doing a
  full `fetch('/app.js')`, times out the CDP evaluate at 45s.
- `window.DATA` is not global; use `window.__rw.DATA`.
- `__rw` exposes ~292 helpers but **not** `unitTotalRevenue` / `unitRepairCost` / `ruCatMoney` —
  hence replicating their formulas rather than calling them.
- Don't force-navigate a tab showing production: a "Leave site?" dialog means real unsaved state.
  Open a second tab instead.
