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
- **`area/comms-notifications`** is a new area created off `staging` for #9 + #11
  (they share send plumbing — templates, triggers, delivery status).
- Safety backup of the pre-reset `staging` tip lives at branch
  `backup/staging-2026-06-23`.
