# Membership subscription system — implementation plan

- **Spec:** [2026-06-25-membership-subscription-design.md](../specs/2026-06-25-membership-subscription-design.md)
- **Branch:** `claude/membership-software-setup-squ67m` (area: `area/memberships`)
- **Date:** 2026-06-25

Two deploy tracks. **Frontend** (`B`-prefixed phases are backend; `F` are
frontend) ships via PR → CI. **Backend** (`Code.gs`) ships via **`/clasp`**
(additive-only; the skill STOPS before any prod deploy) and is **gitignored** —
never committed. Each phase is its own commit (frontend) or its own clasp push
(backend), so history/diagnosis stays isolated.

**Frontend gates before every push** (per CLAUDE.md): `node ci/smoke.mjs`,
`node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`,
`node ci/check-window-catalog.mjs`. Port 8000 is reserved:
`sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`, run, then
`git checkout -- ci/`. **Backend gate:** `node --check Code.js` before any
`clasp push`.

**Cross-cutting hardening (spec §10) is applied IN the phase that introduces the
surface, not bolted on after:** server-side money math, attributed append-only
history on every money event, price-lock seal on membership/cancellation
invoices, entitlement gating in quote AND invoice, server-side row-isolation on
the enroll/reactivate actions.

**Dependency spine:** `B1 → F1` (pricing) · `B2 → F5/F6` (enroll/cancel UI needs
the actions) · `B3` (cron) is independent once B2's invoice/charge helpers exist.
Build order below respects this.

---

## Phase 0 — Baseline
- Run all four frontend gates on the branch; confirm green. Establishes the
  "behavior unchanged" baseline.
- **Verify:** gates green. No commit.

---

## B1 — Membership pricing in the Company config (backend reads it) · `/clasp`
**Why first:** every money figure must be Owner-settable and read **server-side**
(spec §2, §10.1). Nothing should hardcode a price.
- Membership pricing block in the **Company config** object (already synced to the
  backend via `getConfig`/`setConfig`): `membership: { monthlyBase, annualBase,
  monthlyTransport, annualTransport, protectionPct, protectionCapMonthly }` with
  the spec defaults (299 / 2691 / 500 / 4500 / 0.15 / 2000).
- Backend reads these from the config tab at billing time — add a
  `membershipCfg_()` helper in `Code.js` (falls back to the defaults if unset).
- **Verify:** `node --check Code.js`; round-trip a `setConfig`/`getConfig` shows
  the block; `membershipCfg_()` returns defaults when the block is absent.
- **Model:** main (money parameters).
- **Deploy:** `/clasp` (additive; STOP-gate before prod).

## F1 — Settings → Company UI for the pricing + pure fee math
**Depends:** B1.
- Add the membership pricing fields to the **Settings → Company** tab
  (`co-fld` inputs alongside `membershipAgreementTemplate` at `app.js:2860`).
  Owner/Admin-gated like the rest of Settings.
- Pure helpers (covered by `logic-test.mjs`): `membershipFee({plan, addOns}, cfg)`
  → `{ base, transport, protection, subtotal, tax, total }`; **protection = 15%
  of base only** (spec §2). No proration.
- **Verify:** add `logic-test` cases — Monthly both add-ons = base 299 + transport
  500 + protection 44.85 → subtotal 843.85, +10.75% tax; Annual; base-only; each
  add-on alone. Settings UI saves + reloads.
- **UI:** Settings fields → quick `/jactec-ui` + `/frontend` pass; R-rulebook
  stamps; `gen-rule-usage.mjs` regen.
- **Model:** main (math) + Sonnet may draft the Settings inputs from the existing
  `co-fld` pattern.
- **Commit:** "Membership pricing: Owner-settable Company config + fee math".

## F2 — Membership data model + status engine + pricing-gate to Active
**Why critical + on main:** this is the security/entitlement gate.
- Customer membership fields (schema-less, just JSON keys): `paidCadence`,
  `paidUntil`, `commitmentStart`, `commitmentEnd`, `addOns:{transport,protection}`,
  `autoRenew`, `prepaid`, `graceUntil` (spec §3 table).
- `membershipStatus(c)` deriving **Active / Incomplete / Past Due / Lapsed** from
  those fields; `isActiveMember(c)`.
- **Re-gate pricing:** `isMember` at `app.js:844` becomes "is an **Active**
  member" (not merely `accountType==='Member'`). `unlimitedTransport` entitlement
  ($0 transport) likewise requires Active — refused to Incomplete **and** lapsed,
  in the **quote and the invoice line** both (spec §10.4, Conflict #10).
- **Verify:** `logic-test` — member-rate applies only when Active; Incomplete and
  Lapsed both fall back to retail in price AND on the invoice; $0 transport only
  when Active.
- **Model:** **main** (pricing/entitlement gate — never delegate).
- **Commit:** "Membership status engine; gate member rate + $0 transport to Active".

## F3 — Funnel "Signed" (agreement-driven, not manual)
- Membership funnel terminal label "Paid" → **"Signed"** (membership funnel only;
  Used-Sales keeps "Paid" — they share the `funnelStage` set, so map at the
  membership call site, `app.js:5410` / `funnelPill`).
- Remove "Signed" from the manual membership dropdown (`openFunnelDropdown` /
  `setFunnelStage`, `app.js:10128`); signing the **membership** agreement
  auto-flips the stage to Signed + logs it.
- **Verify:** smoke; sign a membership agreement on a demo customer → stage flips
  to Signed; the dropdown no longer offers it; Used-Sales "Paid" unaffected.
- **UI:** dropdown change → `/jactec-ui` + `/frontend`; rule-usage regen.
- **Model:** Sonnet (well-scoped against settled spec); main reviews the gate.
- **Commit:** "Membership funnel: Paid→Signed, agreement-driven, not manual".

## F4 — Rental Protection account toggle (mirror PO) + 15% rental line + reminder
- `rentalProtection` account field; tri-state toggle in New/Edit Customer form
  mirroring `requiresPO` (`app.js:8670` button, `js-nc-po` handler `app.js:11022`,
  forced-answer-before-save `app.js:12680`). Available to members **and**
  non-members.
- When **on**: rental invoices add a **+15% Rental Protection line** on subtotal.
- When **off**: per-rental **"Rental Protection not enabled"** reminder mirroring
  the `⚠ PO required` warning (`app.js:11731`, invoice cell `app.js:5531`).
- Persists independently of membership (never cleared on lapse — spec §3).
- **Verify:** `logic-test` — 15% line present/absent by toggle; smoke — toggle +
  reminder render; forced answer before save.
- **UI:** mirrors an existing pattern → `/jactec-ui` + `/frontend`; rule-usage regen.
- **Model:** Sonnet (mirror of a settled pattern).
- **Commit:** "Rental Protection: account toggle + 15% line + not-enabled reminder".

## B2 — `membershipEnroll` / `membershipCancel` / `membershipReactivate` · `/clasp`
**The money core — all server-side, all hardened.**
- `membershipEnroll(body, role)` — **Office/Owner gated** (T2). Validates a valid
  card on file + a signed membership agreement; computes the fee **server-side**
  (`membershipCfg_()` + `membershipFee`); creates the membership **invoice**
  (itemized: base / transport / protection / tax), charges the saved default card
  via the existing `stripeChargeInvoice` path; on success sets the membership
  fields, `commitmentStart/End`, flips `accountType` to Member, switches the
  chosen add-on flags; **price-lock-seals** the invoice; writes an **attributed
  append-only History** entry. **Row-isolation:** the action keys strictly off the
  passed `customerId` and (for the future web caller) the authenticated account —
  a caller can enroll only the account they own (spec §10.6).
- `membershipCancel` — flips off Member (revert pricing), stage Lapsed, **clears
  member entitlements** (`unlimitedTransport` off) but **leaves `rentalProtection`
  on**; for a Monthly mid-commitment account generates the **Cancellation Invoice**
  = remaining months × full monthly fee incl. add-ons (Annual = none). One atomic
  write. Attributed history.
- `membershipReactivate` — charges/marks the Cancellation Invoice paid in full →
  reopens Member, `paidUntil = commitmentEnd`, `prepaid = true`. Attributed history.
- **Verify:** `node --check`; exercise each action against the live test path with
  a demo customer — correct invoice lines, seal applied, history attributed,
  isolation (wrong-account call rejected).
- **Model:** **main** (money + auth + isolation).
- **Deploy:** `/clasp` (STOP-gate before prod).

## B3 — `membershipBillingCron` daily time-trigger · `/clasp`
**Depends:** B2 (reuses its invoice + charge + history helpers).
- Daily trigger: find members with `paidUntil ≤ today` and `prepaid !== true`;
  generate the cycle invoice (server-side math), charge the saved card.
- **Success** → mark paid, advance `paidUntil` (+1 mo / +1 yr), attributed
  history; Monthly completing month 12 → apply `autoRenew` (new cycle vs complete).
- **Decline** → leave invoice **unpaid**, set `membershipStatus` Past Due,
  `graceUntil = today + 7d`, attributed history; retry daily; grace expired →
  **lapse** (calls the B2 cancel path: revert + Cancellation Invoice).
- **Verify:** `node --check`; dry-run the cron against a seeded due/declined/
  grace-expired trio in the test sheet; confirm the three transitions + history.
- **Model:** **main** (billing correctness + money).
- **Deploy:** `/clasp` (STOP-gate); install the time-trigger.

## F5 — Enrollment dialog (calls `membershipEnroll`)
**Depends:** B2.
- New popup: plan (Monthly/Annual), add-on toggles, **start-date picker** (default
  today, future allowed — no proration), **auto-renew** toggle (default OFF),
  live **first-charge total**, gates surfaced (valid card + signed agreement →
  else stays **Member Incomplete**). Confirm → `membershipEnroll`.
- New popup → **`WINDOW_CATALOG` entry** (`check-window-catalog.mjs`) +
  R-rulebook `data-r` stamps + rule-usage regen.
- **Verify:** smoke; `check-window-catalog` passes; enroll a demo customer end to
  end (success → Active; missing card → stays Incomplete with an actionable msg).
- **UI:** new screen → full `/jactec-ui` + `/frontend`.
- **Model:** main drives the flow/gates; Sonnet may build the dialog markup.
- **Commit:** "Membership enrollment dialog (plan/add-ons/start-date/auto-renew)".

## F6 — Membership card section (lifecycle display + actions)
**Depends:** F2, B2.
- Rebuild the Membership section (`app.js:5409`) to show: plan + cadence,
  **Paid-Until countdown**, add-on badges, auto-renew state, and the Past-Due
  **"⚠️ Canceled In N Days"** countdown flag (spec §3, §5). Actions: **Enroll**
  (when none), **Cancel**, and **Pay Cancellation Invoice** (when lapsed).
- **Verify:** smoke across each state (Incomplete / Active / Past Due / Lapsed /
  prepaid) renders the right flag + actions; Cancel/Reactivate hit the B2 actions.
- **UI:** reshaped section → `/jactec-ui` + `/frontend`; rule-usage regen.
- **Model:** Sonnet (settled spec); main reviews the state-driven gating.
- **Commit:** "Membership card: lifecycle states, countdown flag, cancel/reactivate".

## F7 — Membership economics block (spec §7)
**Depends:** F1, F2.
- In the customer **Standard view** Membership section: **Membership Fee Revenue**,
  **Member Rental Revenue**, **Counterfactual Retail** (equipment-rate-only, via
  the `priceRental` retail branch — **derived, nothing stored**), **Member
  Discount**, **Net Program Contribution**. Internal-only (not the customer portal).
- Fee + member-rental revenue roll into the $150k Revenue Goal; counterfactual is
  analysis-only.
- **Verify:** `logic-test` — counterfactual = retail tiered price of the member's
  rentals; discount/net arithmetic; smoke — block renders as stamped stat KVs.
- **UI:** new stat block → `/jactec-ui` + `/frontend`; rule-usage regen.
- **Model:** main (the counterfactual math); Sonnet may build the stat markup.
- **Commit:** "Membership economics block on customer Standard view".

---

## Sequencing summary
`0 → B1 → F1 → F2 → F3 → F4 → B2 → B3 → F5 → F6 → F7`

- **B-phases** deploy via `/clasp` (additive, STOP-gate) and are gitignored.
- **F-phases** are individual commits → the four CI gates → push to the task
  branch / PR #338.
- **Local test loop:** when work lands on `area/memberships`, serve on
  `localhost:9147` and exercise enroll → cycle → decline → grace → lapse →
  reactivate (per `/start` §3). Cloud session builds + pushes; Jac drives the URL.

## Deferred (own branch, NOT in this plan)
- Damage-claim accounting against the $2,000/mo protection cap →
  `memberships/protection-claims` (spec §9).
- Public website self-enrollment UI (the B2 actions are built isolation-ready;
  the web surface is later).
