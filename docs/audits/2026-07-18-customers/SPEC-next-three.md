# Settled specs — B1, B2, D1 (decided by Jac, 2026-07-18)

These three were DEFERRED out of the `/build` run because they were product decisions, not
implementation details. Jac has now answered. They are build-ready — **blocked only on trunk
being settled** after the force-push.

---

## B1 — derive pay status from live invoice balances

**Decision:** `Unpaid` = anything **past due**. `Partial` = **paid > 0 but a balance remains**
(and not past due). `Current` = zero balance.

This deliberately mirrors what the row's money pill already computes — red for owed-and-overdue,
amber for owed-not-yet-due (`app.js` ROWS.customers, the `owed` / `owedPastDue` block). The point
is that the badge finally agrees with the number printed beside it.

**Build shape**
- Extract the row's existing owed/owedPastDue math into one shared helper, e.g.
  `customerPayComputed(c) -> { owed, owedPastDue, anyPaid, status }`.
- Replace the stored-field reads at all four sites:
  `app.js` FLAG_COND `'unpaid-balance'` and `'partial-balance'`; `GROUP_DEFS.customers.keyOf`;
  `headFlagsHtml`'s `pay` / `payBad`; and `SORT_FIELDS.customers`' `payStatus` sort in `config.js`.
- Leave the stored `c.payStatus` field in place for now (backend/Sheets still writes it) but stop
  reading it for display, grouping, filtering, sorting and the pulse.
- `New Customer` keeps meaning "no invoices yet", so it must survive as a distinct outcome — see B4.

**Watch out**
- `SORT_FIELDS.customers` also has the dead `lastInvoice` case (B3). Fixing the sort switch is a
  separate item; don't silently fold it in.
- A customer with zero invoices must NOT read `Current` — that is the drift the audit found.
- Ordering for the sort needs the severity rank Unpaid → Partial → Current → New Customer, matching
  the group order, not alphabetical.

**Verify** with the harness in `VERIFY-HARNESS.md`: a customer whose stored `payStatus` disagrees
with their live balance must flip; assert on an exact customer id, cache-bust the page load, and
do not call `reindex()`.

---

## B2 — stop "Don't Contact" being laundered into "Lead"

**Decision:** keep the funnel ladder showing `Lead`, and render an explicit **red "Do Not Contact"
banner above the funnel**.

Chosen because `funnelCurrentStage`'s clamp exists to keep `stages.indexOf` from returning -1 —
`datedFunnelHtml` uses that index to decide which rungs read as reached. Leaving the clamp intact
and adding a banner above it means the warning becomes the first thing seen without disturbing the
ladder's index maths.

**Build shape**
- In the customers detail, before `funnelSectionHtml(c)`, test the RAW stored values
  (`c.usedSalesStage` / `c.membershipStage`) for `"Don't Contact"` — not the clamped stage.
- Render a red banner; reuse an existing R-stamped builder so no new `data-r` is needed.
- Do **not** change `funnelCurrentStage` itself — `ci/logic-test.mjs:1592-1593` asserts the clamp,
  and the Sales pipeline board (`funnelPill`) already renders the raw value correctly.

**Watch out** — the value is reachable today via Mr. Wrangler chat and CSV import (`WR_FUNNEL`
includes it) and the 2026-07-17 migration does not purge it, so this is live data, not legacy-only.

---

## D1 — tap-to-call

**Decision: all four placements.** Jac selected every option, so the phone should be dialable
everywhere it appears, each with the affordance that fits its surface.

1. **Phone icon button beside the Account field** — the number itself stays tap-to-edit
   (`acctField` renders it `.inline-edit`); the icon dials. Needs `/jactec-ui` for the icon.
2. **Icon on the list row, right of the number** — highest value for the front desk. Must not
   swallow the row-open tap; note 96% of rows carrying a balance currently truncate the number, so
   this likely wants the layout fix (E1) alongside it or it will be dialing a clipped number.
3. **Title-band phone flag becomes a link** — requires extending `flagEl` to accept an `href`.
   This is a shared R9 builder used on every card, so it is a **design-system change**: run it
   through `/jactec-ui` and regenerate `rule-usage.js`.
4. **Call in the right-click menu** — cheapest; the menu already has "Text {name}…" / "Email
   {name}…" (`app.js` openCtxMenu). Add Call beside them.

Use the existing `telHref()` helper (`app.js`) for all four — it already normalises to `+1`.

**Ordering suggestion:** 4 → 1 → 2 → 3, cheapest and least risky first, leaving the shared-builder
change until last.

---

## Still unanswered (not asked yet)

- **B4** — the `New Customer` group section: config already defines the status blue, but its
  position in `GROUP_DEFS.customers.sections` relative to Unpaid/Partial/Current is undecided.
  B1 makes this urgent, since deriving the status is what finally sorts these 2,260 records.
