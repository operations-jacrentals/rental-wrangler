# Account / Agreements + Membership Auto-Enrollment + Payment-Gate Hardening — DESIGN (2026-07-10)

**Branch:** `customers-crm/account-agreements-redesign` (off `area/customers-crm`)
**Status:** DRAFT — awaiting Jac's review of the three `[NEEDS CONFIRM]` items.
**Origin:** Bug report (Dena, SMS thread) — a customer was set to "Business Member" via
the profile-card ACCOUNT TYPE control with no invoice, no charge, no cadence. Triage
(wrangler-fix) confirmed the bypass and its blast radius; Jac then reframed the fix into
a full redesign of the Account section, membership enrollment, and the account-block gate.

---

## 1. The problem (proven, cited)

The profile-card **ACCOUNT TYPE** control (`NC_ACCOUNT_TYPES`, `app.js:18372`; click
handler `app.js:16072`; save `app.js:18443`) writes `accountType` directly onto the
customer with **zero side effects** — no fee calc, no card charge, no invoice, no
`paidUntil`/`paidCadence`/`commitmentStart`/`commitmentEnd`. Setting `Business Member`
there produces a member with no backing invoice.

Worse: `membershipStatus()` (`app.js:3639-3649`) grandfathers a member with no
subscription fields to **Active** (`app.js:3644`), and `isActiveMember` (`app.js:3653`)
is the one gate granting member pricing + $0 Unlimited Transport. So the bypass silently
grants free member pricing.

**Sibling bypasses (same class):** Mr. Wrangler `UPDATE customer` chat + CSV import both
accept `accountType: "Business Member"` (`app.js:13566-13576`, `wrAccount()` fuzzy-matches
"member" text). These are closed structurally by the redesign below (account-type change
only ever happens through a signed Agreement).

---

## 2. Decisions (all Jac, 2026-07-10)

- **D1 — Account section, not a popup.** The account-level popup is eliminated. It becomes
  the **new Account section** that replaces the current Account section on the customer card.
  The only surviving modal is the literal **Add Card** (card-number entry).
- **D2 — Agreements are rows *inside* the new Account section.** They are **not** their own
  section and do **not** replace the header card-tabs. The header card-tabs (`VISA ••2261`)
  come out of the header and become rows in the Account section. Each row can show richer
  info than brand+last4.
- **D3 — `+Agreement/Card` button** at the top of the rows (blue secondary). Clicking a row
  expands it inline (push-down, like the Invoices section), revealing that agreement's
  selfie + agreement text + terms + signature + an **ACCOUNT TYPE dropdown** + a
  **Start Date** field.
- **D4 — ACCOUNT TYPE is a per-agreement dropdown** that changes the agreement type *live*
  until the agreement is saved. It is the **general mechanism for every account-type change**
  — Non-Business, Business, Member, Business Member all flow through a signed Agreement. No
  raw account-type flip exists anywhere anymore (this is what structurally closes §1).
- **D5 — Signature IS enrollment (atomic).** For a Member/Business Member agreement, signing
  the agreement *is* the enrollment — no separate "Enroll & Charge" step, no separate overlay.
  The old `openMembershipEnroll` overlay (`app.js:3771`) is retired/absorbed.
- **D6 — Start Date gates the signature.** When ACCOUNT TYPE = Member/Business Member, the
  signature step is **blocked until a Start Date is entered** (we can't schedule the charge
  without it).
- **D7 — Charge fires on the Start Date, not at signing.** The first invoice is created at
  signing, but the **card charge executes on the Start Date**. The card charged is whichever
  card is tied to that agreement (existing, or the one added via `+Agreement/Card`).
- **D8 — Build the real daily billing cron now.** Deferred-start charging and recurring
  renewals share one mechanism: `membershipBillingCron` (memberships.md §5.4, previously
  unbuilt Phase 2). One engine handles both.
- **D9 — Default-populate agreement fields** from data we already have on the customer, to
  save the user clicks.
- **D10 — Unsaved-changes guard.** If a field in an open agreement (or the account fields)
  is edited but not saved, collapsing the row or clicking away from the card intercepts with
  a **"Save Changes?"** block (Save / Discard / stay).
- **D11 — Account block model** (replaces today's paperwork-only gate, `app.js:343-350`,
  where the comment reads "Charging is NEVER gated on this"):
  - **No card on file → blocked.** Cleared by adding a valid card.
  - **A payment fails (even with other valid cards) → blocked.** Cleared by **any** successful
    payment succeeding anywhere on the account.
  - **Failed *membership* charges are exempt** — they stay pricing-only (Past Due → grace →
    Lapsed per today's rules) and do **not** trip the delivery block.
- **D12 — Manual block button** in the Account section. When staff manually block, they choose
  either **Blacklist** (existing state/lingo + existing lift path, `app.js:16179`) **or**
  select the specific **invoice(s)** that must be paid to auto-unblock.
- **D13 — Owner password for a bare Blacklist.** Manually Blacklisting **without** an invoice
  selection (a hard ban with no auto-unblock) requires the **Owner password**. A block *with*
  invoice-selection is a lower-tier staff action.
- **D14 — Manager password override, per-action.** Attempting a rental on a blocked account
  pops a **Manager-password** prompt authorizing **only that one action**. Every subsequent
  attempt re-prompts — intentionally repetitive, no persistent bypass. **A Blacklist is Owner-tier
  (D13) and is NOT Manager-overridable** — Manager per-action override covers `no-card`,
  `failed-payment`, and `invoice-hold` only.
- **D15 — Notes is its own row.** `+Notes` sits as its own row **under Driver's License** in the
  account fields (pulled out of the current NOTES·PO·PROTECTION grouping).
- **D16 — `+Agreement/Card` is the top add-row** *inside* the scrollable Agreements list,
  styled identically to the `+Customer` / `+Rental` add-row pattern (blue add-row pinned at the
  top of the scroll list) — not a detached button.
- **D17 — Block Account button sits bottom-RIGHT** of the Account section (not bottom-left).
- **D18 — Collapsed agreement row field order** (left → right):
  1. **Account Type** — OR, if it's a membership agreement, its **status** (e.g. `MEMBERSHIP
     PENDING`, `MEMBERSHIP RENEWAL FAILED`, …).
  2. **Signed Date** — or `NOT SIGNED`.
  3. **Card indicator** — `V-2261` (Visa) / `M-2261` (Mastercard) [letter-dash-last4], OR a card
     status: `NO CARD`, `PAYMENT FAILED`, `EXPIRED`, `EXPIRING SOON`, `BANK BLOCKED`, `DISPUTED`, …
  4. **`NO SELFIE`** flag (when the selfie is missing).

---

## 3. UI design — the new Account section

Replaces the current Account section on the customer card (yard data-plate language,
routed through `/jactec-ui` at build time).

```
┌─ ACCOUNT ─────────────────────────────────────────────┐
│  NAME    Jacob Cameron      COMPANY  Jac Rentals        │  ← merged-in account fields
│  PHONE   (409) 679-5133     EMAIL    jacob@…            │     (were behind the old popup)
│  INDUSTRY …                 PO · PROTECTION …           │
│  DRIVER'S LICENSE …         PAYMENT TERMS — NET DAYS …  │
│  [ + Notes … ]                                          │  ← D15: own row under Driver's License
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│  AGREEMENTS  (scrollable)                               │
│  ┌───────────────────────────────────────────────────┐ │
│  │ [ + Agreement/Card ]                                │ │  ← D16: top add-row, like +Customer
│  │ ● Business Member · Jun 11 · V-2261                 │ │  ← D18 collapsed order (see below)
│  ├───────────────────────────────────────────────────┤ │
│  │ ▼ (expanded) selfie · agreement · terms · signature│ │  ← push-down inline expand
│  │   ACCOUNT TYPE [ Business Member ▾ ]   Start Date […]│ │     (like Invoices rows)
│  │   [ Sign ]  (blocked until Start Date if Member)    │ │
│  └───────────────────────────────────────────────────┘ │
│                                     [ Block account ]   │  ← D17: bottom-RIGHT
└────────────────────────────────────────────────────────┘
```

**Collapsed agreement row (D18), left → right:**
`[Account Type | membership STATUS]` · `[Signed Date | NOT SIGNED]` ·
`[V-2261 | M-2261 | NO CARD | PAYMENT FAILED | EXPIRED | EXPIRING SOON | BANK BLOCKED | DISPUTED]` ·
`[NO SELFIE]`

- Row expand mirrors the Invoices inline-row mechanic (find the existing push-down expand
  in the Invoices section and reuse its structure/animation).
- The "N card needs signing — On-Rent & delivery blocked" banner logic (`app.js:10748`)
  moves/merges into this section's block state.

---

## 4. Enrollment flow (D5–D8)

1. `+Agreement/Card` → new agreement row (add a card here if none exists).
2. Set ACCOUNT TYPE dropdown → Member / Business Member. Dropdown updates the live agreement
   text/type until saved (D4).
3. Enter Start Date. Until it's set, the **Sign** action is disabled (D6).
4. Sign → **atomic enroll**: pick cadence + add-ons inline (reuse `membershipFee` math,
   `app.js:3620`), create the first membership invoice (`buildMembershipInvoice`,
   tag `membership:true`), set `paidCadence`/`commitmentStart`/`commitmentEnd`/`autoRenew`.
5. The charge is **scheduled for the Start Date** (not run at signing) against the tied card.
   `membershipBillingCron` (D8) executes it when the Start Date arrives.

**Consequence handled:** today `membershipEnrollCommit` (`app.js:3789-3807`) charges
immediately; `startDate` only labels `commitmentStart`. Deferred charging requires D8.

---

## 5. Backend contract — `membershipBillingCron` (D8)

Additive Apps Script daily time-trigger (ships via `/clasp`; `Code.gs` gitignored). Per
memberships.md §5.4, with these responsibilities:

1. **Deferred first charge:** signed-but-uncharged enrollment whose `startDate <= today` and
   not yet charged → build/charge the cycle's invoice against the tied card; on success mark
   paid + set `paidUntil`.
2. **Recurring renewal:** members where `paidUntil <= today` AND `prepaid !== true` → build +
   charge next cycle; advance `paidUntil` (+1mo/+1yr) on cleared charge; apply `autoRenew` at
   month-12.
3. **Failure:** leave invoice UNPAID, flip **Past Due**, `graceUntil = today+7d`; retry daily
   while in grace; grace expired → atomic **Lapse**.

**Safety (all from memberships.md §5.4 — non-negotiable):** idempotent per cycle (charge keyed
by `(customerId, cycle-period)`, `paidUntil` advances only on a *cleared* charge); atomic
lapse; system-actor authority only (renewal + lapse, never enroll/cancel; not reachable from
interactive `backendCall`); bounded retries; ambiguous-timeout re-checks Stripe before
re-charging.

**Note the D11 seam:** a failed membership charge here must **not** set the account's
delivery-block flag — it only walks the pricing lifecycle (Past Due/grace/Lapsed).

---

## 6. Account-block gate (D11–D14)

Replaces `cardGateBlocked` / `accountAgreementsBlocked` (`app.js:343-356`). New block state
on the customer record with a typed reason:

| Block type | Trigger | Clears when | Auth to set |
|---|---|---|---|
| `no-card` | No valid card on file | A valid card is added | (automatic) |
| `failed-payment` | A card charge on a rental invoice fails | **Any** successful payment on the account | (automatic) |
| `blacklist` | Manual, no invoice selection | Only the existing blacklist-lift path | **Owner password** (D13) |
| `invoice-hold` | Manual, staff selects invoice(s) | The selected invoice(s) are paid → auto-unblock | staff (lower tier) |

- **Rental attempt on a blocked account** → Manager-password popup authorizing that one action
  (D14). No persistent unblock. **Exception: a `blacklist` block is Owner-tier and is NOT
  Manager-overridable** — only `no-card`, `failed-payment`, and `invoice-hold` accept the
  Manager per-action override.
- **Membership charge failures are excluded** from `failed-payment` (D11).
- Reuse the existing `roleTier`/`canMoney` machinery (`app.js:15890`) for the Owner/Manager
  password tiers; do not invent a parallel auth path.

---

## 7. Open / deferred UI items — **[NEEDS CONFIRM]**

These three came up earlier and haven't been pinned. My interpretation below; react in review.

- **7a — Invoices/Transactions toggle.** Replace the "INVOICES" section title with a two-way
  toggle. *Invoices* = current grouped-by-invoice list. *Transactions* = flattened list of
  every transaction (payment) across all of this customer's invoices (one invoice can have
  many). **[NEEDS CONFIRM]** exact columns of the Transactions view.
- **7b — Member-Mode / Non-Member-Mode KPI toggle.** A button on the far right of the KPI row
  (Open / #Invoices / Paid YTD / Avg Pay). Labeled "Member Mode" for a non-member, "Non Member
  Mode" for a member. Toggling recomputes the KPI tiles to the *opposite* membership state,
  reusing existing member-vs-retail math (`membershipEconomics` ~`app.js:3208`, `memberDaily`
  rates). This **replaces** the always-on membership-economics block (the "$0 membership fees /
  member-rate rentals / retail equivalent / member discount / net program" block), which is
  removed from its current location. **[NEEDS CONFIRM]** exactly which KPI tiles recompute and
  the precise formula (dictation was garbled).
- **7c — Colored-dot → red/green/yellow background.** On the toggles, replace indicator dots
  with a red/green/yellow **background color** on the toggle itself. **[NEEDS CONFIRM]** which
  toggles/dots this covers (the new Invoices/Transactions toggle, Member-Mode toggle, both, or
  other existing dot indicators on the card).

---

## 8. Scope / sequencing

- **Front-end (app.js / style.css):** new Account section, Agreements rows + inline expand,
  `+Agreement/Card`, ACCOUNT TYPE dropdown, Start-Date gate, atomic-sign-enroll, unsaved-changes
  guard, block button + Owner/Manager password prompts, the §7 toggles. All routed through
  `/jactec-ui`; R-Rulebook stamps + `WINDOW_CATALOG` entries for any new popup
  (Add Card modal, password prompts) + `rule-usage.js` regen.
- **Back-end (`Code.gs`, via `/clasp`):** `membershipBillingCron`; enrollment action accepts a
  future `startDate` and schedules rather than charges; block-state fields persisted.
- **Bug closure:** removing the raw ACCOUNT TYPE control + routing all account-type changes
  through signed agreements closes the profile-card bypass AND the Wrangler-chat / CSV siblings
  (§1) structurally.

## 9. Open questions

1. ~~D14 scope vs Blacklist~~ — **RESOLVED (2026-07-10):** Blacklist is Owner-tier; Manager
   override does not reach it (D14).
2. §7a/7b/7c — the three `[NEEDS CONFIRM]` items above.
3. Migration: existing members created via the old bypass (e.g. Matt Bellon) — data remediation
   is separate from this code change (flagged in triage; Jac handling account-side).

## 10. Acceptance criteria (draft)

- No code path sets `accountType` to a Member value without a signed agreement + scheduled/charged
  invoice (grep proves the raw control is gone; Wrangler/CSV reject Member values).
- Signing a Member agreement with a future Start Date creates the invoice now and charges on the
  Start Date via the cron (not at signing).
- A failed rental-invoice charge blocks delivery; adding a card clears a no-card block; any
  successful payment clears a failed-payment block; a membership charge failure does NOT block.
- Bare Blacklist requires Owner password; invoice-hold block auto-unblocks on payment; rental on a
  blocked account requires Manager password per attempt.
- CI gates green: `smoke`, `logic-test`, `gen-rule-usage --check`, `check-window-catalog`,
  `gen-code-map --check`.
