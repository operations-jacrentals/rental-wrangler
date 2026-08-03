# Return-rating — post-ship verification (PARKED)

**Status:** shipped LIVE, **not yet exercised end-to-end.**
**Parked from:** the return-rating build session, 2026-07-15.
**Live at:** `app.jacrentals.com` — `index.html ?v=20260715h`, production commit `ca57dd7`
(feature `#645`, cache-bust `#646`).

## What shipped (all live now)

When **every** unit of a rental reaches a terminal status and at least one is
`Returned`, the office gets a **required** popup (`kind:'returnRating'`, not
dismissable by backdrop/Esc) to rate the customer experience **1–5★**. The stars
drive tiered, default-armed reactions the office can skip per-send:

- **4–5★** → thank-you + review-link SMS to the customer.
- **2–3★** → Sales follow-up (activity-log entry on the customer) + optional office note.
- **1★** → apology SMS (invite to contact the manager) **and** a manager review
  request (`addRecComment`, red) that is **always** sent — non-skippable.

Ratings surface on the rental row/detail (star badge), the customer profile
(overall-experience average), and the customer activity chart (a line of orange
stars over time, scaled 1–5). **Ratings never feed the Reputation KPI** (integrity —
an employee must not influence their own number).

Key functions in `app.js`: `maybePromptReturnRating`, `returnRatingHtml`,
`saveReturnRating`, `fireRatingActions`, `ratingSend`.

## Why this is parked (what's untested)

The **customer-facing SMS sends are LIVE but have never fired once.**
`fireRatingActions` → `ratingSend(customerId, text)` calls the real
`backendCall('sendCustomerMessage', …)` SMS path (consent-gated via
`commsOnline()`), the same live path used elsewhere. It has only ever been
exercised against seed/demo data in the browser test seam — no real message has
gone out from a real return-rating, so the round-trip (office rates → text
actually delivered, correct template, `{name}` filled, consent respected) is
unverified in production.

The Sales follow-up (activity-log push) and the 1★ manager `addRecComment` are
local state writes and lower-risk, but they ride the same untested flow.

## What's left to close this out

1. Rate a return for the **C0991 test customer** (Jac's own consent-gated test
   number) and confirm:
   - the 4–5★ thank-you text actually delivers, with `{name}` filled and the
     review link intact;
   - the 1★ apology text delivers and the manager review request appears;
   - `commsOnline()` correctly gates when consent is absent (no send).
2. Only after that passes, treat the return-rating sends as trusted for real
   customer returns.

**Do not** autonomously fire a test send — Jac drives the C0991 test-return
(same rule as the rest of the live SMS work).
