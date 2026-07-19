# CUSTOMERS card audit — handoff to a cloud session

**Written 2026-07-18 by a local session that is being repurposed. Everything needed to continue is
in this folder or on a pushed branch. Nothing is left on the local machine.**

Read this file first, then `BACKLOG.md`. Do not start coding until you have read
**"The trunk problem"** below — it decides whether you can push at all.

---

## 1. What this was

A `/lazy-audit` persona walkthrough of the **CUSTOMERS card**, judged as **"Robin"** — the
front-desk / counter sales rep who won't scroll, won't read, and needs the screen to spell out the
next move. Audited `origin/production` (`0fac006`, `?v=20260718i`) — the exact bytes
app.jacrentals.com served — and driven **live in a real browser** twice.

Method: 6 lens agents → 22 adversarial refute agents → 3 gap critics → 2 live production drives.
Four findings were narrowed, one downgraded, and two of my own live readings were withdrawn as
overstated. The gap critics produced four of the six top fixes — they earned their keep.

**Report artifact (private):** https://claude.ai/code/artifact/3adffaa9-038b-44f3-a0b6-c75fb19af550

### The single most important finding

Sorting the live customer list by name shows staff have **rebuilt the flag system inside the name
field**. Of 860 rendered names, 25 carry business state that belongs in a flag:

```
!!!Owes $8,738.17!!! <name>
(Do Not RENT-owes $2232) <name> (Contact <staff>)
(Do Not Rent) <name>
( $140 Credit) <name>
<name> Job Location On Invoices
```

**23 of them begin with punctuation** — `(` `!` `#` `"` `*` — because punctuation sorts before
letters. That is a hand-rolled priority queue exploiting the one sort that isn't broken. It is
user-generated proof that B1 (frozen pay status), B2 (Don't-Contact laundering) and B3 (dead
sorts) are costing real time daily.

**Fix those three before any data cleanup**, or staff will simply re-enter it.

### Live production numbers worth keeping

| Measured on production | Value |
|---|---|
| Customers with **no card on file** | **2,141 of 2,265 (94.5%)** — only 124 cards exist |
| Red rows in the default view | 44 of 60; **11 of the first 12** |
| Red rows that say *why* they're red | **0** (no flag word, no title attribute) |
| Rows with a balance whose phone is **clipped** | **96%** (vs 25% without a balance) |
| Tappable phone numbers anywhere | **0**, with 59 numbers on screen |
| "Show more" cost, same 200 rows each press | **547 → 658 → 803 → 1044 ms** (re-renders whole list) |
| Groups on the Customers card | **2** (Units and Rentals get 6 each); 2,260 of 2,265 in one bucket |

---

## 2. The trunk problem — READ BEFORE PUSHING

Mid-run, **`trunk` was force-pushed / rewritten**. Concretely:

- The base these branches were cut from, **`a061746`, is no longer an ancestor of `origin/trunk`**.
- `git merge-base origin/trunk <any of my branches>` returns **nothing** — unrelated histories.
- Every `git cherry-pick` of my commits onto the new trunk **conflicts**, consistent with a
  wholesale content rewrite of `app.js` (the base commit was a line-ending normalisation).

**This is not only my work.** At the time of writing these remote branches were also still on the
orphaned base: `claude/categories-derivation-fixes`, `units-fleet/readiness-and-hours-warnings`,
`wrangler-fix/calendar-badge-and-map`, `claude/rentals-dispatcher-audit-k977x2`, and
`chore/code-map-refresh`. **Other sessions are affected and may not have noticed.**

Jac's instruction was **hold — he settles trunk first**. So:

> **Do not rebase, force-push, or "fix" anyone's branches.** Confirm with Jac that trunk is settled,
> then re-apply the seven patches in `patches/` by hand onto the new base and re-verify each.

The patches are the durable copy. The branches below are pushed as-is on the **orphaned base** so
nothing is lost — they will **not** merge cleanly until re-applied.

---

## 3. What is already built

Six branches, all twelve gates green, pushed on the orphaned base. Patches in `patches/`.

| Branch | Contents | Verification |
|---|---|---|
| `customers-crm/safe-cleanup` | Dead `RUS_TABS.invoices` removed; two stale Comms comments corrected | gates |
| `customers-crm/flag-typo-fixes` | **B10** Non-Business Members never got the green tint · **B7** New Customer no longer pulses · **B8** Payment Due now pulses instead of No Billing | gates |
| `customers-crm/money-gates` | **A1** card/bank remove + make-default gated behind `canMoney()` + arm-to-confirm · **A2** cancellation charge arms to confirm · **A3** Cancel Membership arms to confirm | gates |
| `customers-crm/void-revenue` | **J1/J2/J3** revenue and repair-cost void filters | ✅ **controlled A/B** |
| `customers-crm/tel-and-comms` | **C3** the customer Comms section (built, zero call sites) is now called | gates |
| `customers-crm/collections-void` | **C1/C2** Void + Send-to-Collections reachable from the invoice menu | ✅ **real UI** |

`check-cachebust` is red on all of them **by design** — `tools/bump-cachebust.mjs` lands the `?v=`
bump at `/merge`, not on a feature branch.

### Deliberate deviations — do not "correct" these without reading why

- **A2**: the audit proposed routing `js-mem-paycxl` through `openPayInvoice` for a review overlay.
  **That is wrong.** `membershipReactivate` does not merely charge the cancellation invoice — it also
  calls `backendCall('membershipReactivate', …)` and reopens the membership. Re-pointing the button
  would take the customer's money and leave them lapsed. Arm-to-confirm was used instead.
- **A1 vs spec D3**: `js-blacklist` is deliberately ungated — *"spec customers-crm D3: ANY role can
  blacklist; the audit trail is the control"*. Cards were gated anyway because **adding** a card was
  already Office/Admin-only, and `removeCard` fires an irreversible Stripe detach. Jac confirmed
  keeping the gate. Reversible if that changes.
- **`SORT_FIELDS.invoices` was NOT deleted** despite a sweep calling it dead config. `GRID_CARDS`
  still lists `invoices`, so `freshSession()` calls `loadSort('invoices')`, which does
  `SORT_FIELDS[card][0]` unguarded. **Deleting it crashes session creation.** It can only go together
  with the `GRID_CARDS` entry.
- **`app.js` `isMember`**: a sweep flagged `c.accountType === 'Member'` as a dead disjunct "safe to
  delete". It is dead — *because of a typo*. The legal key is `'Non-Business Member'`; `'Member'` is
  only its label. Deleting it would have cemented the bug. It was **fixed**, not removed (B10).

---

## 4. Everything still parked

**`BACKLOG.md`** — 42+ items in 9 tiers, each with `file:line`, verdict marks (`✓` confirmed ·
`≈` narrowed · `✦` gap-critic · `▣` measured live · `!` self-corrected) and a suggested build order.
Tier 0 money/authority, Tier 1 correctness, Tier 2 built-but-unreachable, Tier 3 comms/alerts,
Tier 4 information design, Tier 5 navigation, Tier 6 glitch/polish, Tier 7 data hygiene,
Tier 8 revenue rollups.

**`SPEC-next-three.md`** — B1, B2 and D1 are **decided and build-ready**, blocked only on trunk:

- **B1** — derive pay status: `Unpaid` = anything **past due**; `Partial` = **paid > 0 with a
  balance remaining**; `Current` = zero balance. Mirrors the row's existing money-pill maths so the
  badge finally agrees with the number beside it.
- **B2** — "Don't Contact": keep the ladder at `Lead`, add a **red banner above the funnel**. Do
  **not** change `funnelCurrentStage` — `ci/logic-test.mjs:1592-1593` asserts the clamp, and the
  Sales board already renders the raw value correctly.
- **D1** — tap-to-call: **all four placements** approved (icon beside the Account field; icon on the
  row; title-band flag as a link — a shared-R9 design-system change needing `/jactec-ui`; and Call in
  the right-click menu). Suggested order 4 → 1 → 2 → 3.

**Still unanswered:** **B4** — where the `New Customer` group sits in
`GROUP_DEFS.customers.sections` relative to Unpaid/Partial/Current. Config already defines the
status blue. B1 makes this urgent, because deriving the status is what finally sorts those 2,260
records out of the grey leftover bin.

**`VERIFY-HARNESS.md`** — read this before verifying anything. Two traps cost me a false
"verified" claim:
1. Calling `reindex()` inside a measurement moves the stat **identically on both builds**, so it
   cannot distinguish them.
2. A plain reload is **not enough** — `index.html` is cached too, so the page keeps running the old
   `app.js?v=` token and a real code change looks like a no-op. Load with a cache-busting query on
   the document. This is exactly what `ci/check-cachebust.mjs` exists to prevent.

---

## 5. Environment notes

- **Several sessions share the local clone.** Branches and commits from other audits (UNITS,
  CATEGORIES, CALENDAR/DRIVER) landed on whatever branch was checked out. Work in your own worktree.
- **Port 9147 is often taken** by another session's `/run-live`. `serve.mjs` honours `RW_PORT`; the
  gates need a free port too (`sed -i 's/8000/9247/g' ci/smoke.mjs ci/logic-test.mjs`, run, then
  `git checkout -- ci/`).
- A background agent once **edited `app.js` unprompted** despite a read-only instruction. Its
  findings turned out to be real (they became J1/J2), but its line citations were wrong. Verify
  anything an agent hands you against the functions located **by name**, not by cited line number.
- In a cloud session, `/run-live`'s Node-fetch relay shim reaches real records headlessly; locally
  the app reaches the backend natively. `#local` demo mode is seed data, **no PII** — use it for
  anything that ships.

---

## 6. Suggested first moves in the cloud session

1. Confirm with Jac that **trunk is settled**, and that other sessions' orphaned branches are handled.
2. Re-apply `patches/` onto the new base, one branch at a time, re-running the full gate set.
3. Re-verify `void-revenue` and `collections-void` with the harness — they are the two with real
   behavioural proof today, and that proof does not survive a re-application.
4. Then build **B1 + B4 together** (one shared helper plus the missing group section). That single
   change fixes the wrong buckets, the broken Unpaid filter, the `N/A` pills and the false all-clear
   — and closes a gap `docs/specs/customers-crm.md:642-650` has had open since 2026-07-09.
5. Ask Jac about **B4** before building it.
