# Backlog — sorted task branches

Captured from Jac's handwritten list on **2026-06-23** and sorted into area
branches. Each row is a real branch on `origin` with a marker commit describing
the task. To work one: `git checkout <branch>`, refresh it from its area
(`git merge origin/main` / rebase per `/start`), then build.

> Bug / removal items run through `/wrangler-fix` first (prove the root cause
> before changing code). UI items run through `/jactec-ui` + `/frontend`.

| # | Item | Area | Branch | Type |
|---|---|---|---|---|
| 1 | Card-on-File still blocks On Rent | `rentals-dispatch` | `rentals-dispatch/onrent-cardfile-gate` | bug |
| 2 | Rental Status button | `rentals-dispatch` | `rentals-dispatch/status-button` | feature |
| 8 | Rental Window Picker is obsolete | `rentals-dispatch` | `rentals-dispatch/retire-window-picker` | removal |
| 3 | Invoice link shows "OBi" | `invoicing-payments` | `invoicing-payments/invoice-link-label` | bug |
| 12 | Invoice Card | `invoicing-payments` | `invoicing-payments/invoice-card` | feature |
| 6 | Category Rows — scroll by group | `units-fleet` | `units-fleet/category-rows-scroll-group` | feature |
| 7 | Default Services — give manuals | `maintenance-shop` | `maintenance-shop/default-services` | feature |
| 5 | Custom Fields (Defaults?) | `backend-data` | `backend-data/custom-fields-defaults` | feature |
| 10 | New Website → customer self-service portal | `mobile-remote` | `mobile-remote/customer-portal` | feature |
| 9 | Notifications | `comms-notifications` | `comms-notifications/notifications` | feature |
| 11 | Customer Communication — text / email | `comms-notifications` | `comms-notifications/customer-text-email` | feature |
| 4 | Memberships — **needs detail** | `memberships` | `memberships/membership-todo` | TBD |
| 13 | Rental Detail redesign — flag colors + numbered-date calendar | `design-system` | `design-system/flag-color-system` | feature |

## Notes
- **#4 Memberships** is parked but unspecified — needs a concrete task (state
  machine? member pricing gating? renewals / Paid-Until? unlimited transport?).
- **Timeline Selector** (app.js §13.4, `graphViewsFor`/`openGvWinMenu`) — a per-
  chart time-window filter (7/30/90/180/360 days, or All time) that's fully
  built but never wired to any graph view (`v.timed` is never set `true`).
  Kept in the code intentionally (Jac, 2026-07-09 pre-promotion audit follow-
  up: "I have a lot in mind for this. Leave it in the UI but add a task for
  later completion.") — needs a concrete spec for which graph(s) should get
  it before it's wired up.
- **#13 Rental Detail redesign** — a flag-driven R/Y/G status-color engine
  (`getEntityFlags`/`getEntityColor`/`entityArchived`, reworked `statusPill`)
  plus a new numbered-date summary calendar embedded in the Rental Detail card
  (`rentalDetailCal`) and a reshuffled header/units/footer. Real, unshipped
  work but 455+ commits stale (hard conflicts in app.js/config.js/icons.js/
  rule-usage.js/style.css/tools/gen-icons.mjs) — would need a forward-port,
  not a merge. Doesn't touch the dispatch-grid Calendar card's code directly,
  but it's calendar UI in the rentals area landing near Jac's concurrent
  Trips-card work — **parked at Jac's direction (2026-07-09), revisit next
  week** once Trips has more shape.
- **`area/comms-notifications`** is a new area created off `staging` for #9 + #11
  (they share send plumbing — templates, triggers, delivery status).
- Safety backup of the pre-reset `staging` tip lives at branch
  `backup/staging-2026-06-23`.
- **Gaps found during the 2026-07-09 area-spec reconciliation sweep** (10 area
  specs synced to shipped reality across PRs #568–#577) — real, not yet acted
  on:
  - **`gpsToken` auth-proxy still has a hardcoded fallback password** (backend
    audit finding, not fixed) — `docs/specs/gps-tracking.md`.
  - **GPS Driving Score shipped fleet-level, not per-driver** as Decision D1
    resolved; **GPS coordinate visibility + the Tracking-board role gate both
    shipped all-roles**, not manager+ as Decision D2 called for — a real
    access-scope deviation from what was decided, worth a look.
    `docs/specs/gps-tracking.md`.
  - **`PARTIAL_REFUNDS_ENABLED` flipped to `true` in production** with no
    in-repo writeup confirming the deploy→verify→flip sequence Decision D1
    required was actually followed in order — worth a quick sanity check with
    whoever flipped it. `docs/specs/invoicing-payments.md`.
  - **Sell-a-unit flow shipped alongside an old bare fleet-status dropdown**
    that still lets anyone flip a unit to "Sold" with no price/gate, bypassing
    the new gated flow entirely. `docs/specs/units-fleet.md`.
  - **`purchaseDate` isn't money-tier-gated** for edits, unlike `trueCost`/
    `purchasePrice` — likely an oversight in the same D2 unit-fields lock.
    `docs/specs/units-fleet.md`.
  - Already tracked elsewhere, not duplicated here: team-chat privacy hardening
    (inert, gated on `claude/internal-chat-updates-vq6p7b`) and Wrangler Ops'
    global 100/day rate limit (documented, not yet deployed) — both live in
    `docs/handoffs/BACKEND-DEPLOY-QUEUE.md`.
