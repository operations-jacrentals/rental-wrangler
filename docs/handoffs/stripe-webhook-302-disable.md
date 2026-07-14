# Stripe "failing webhook endpoint" email — what it uncovered (2026-07-13/14)

**TL;DR:** Stripe emailed that it couldn't deliver live-mode events to
`…/exec?wh=stripe`. The email itself was a harmless symptom (Apps Script's 302
redirect), **but chasing it uncovered a real gap: membership billing was running
in Stripe subscriptions that the app had no link to and wasn't reconciling.**
Decision (Jac): the **app** owns memberships; delete the dead webhook, and
migrate the live Stripe subscriptions onto the app-driven membership engine.
Webhook deleted; first customer migrated. Details + a follow-up bug below.

> **Correction to the first pass:** an earlier version of this note said "billing
> is not affected — `membershipDailySweep` carries authoritative state." **That was
> wrong.** The sweep only reconciles customers that carry a `stripeSubId`, and
> **zero** customers do — so it was a no-op. Neither the webhook nor the sweep was
> syncing Stripe subscription state into the app. See "What it uncovered."

## The email & its (harmless) root cause

The failing endpoint was the current prod deployment of the "Rental Wrangler
Gate" Apps Script. Every POST to an Apps Script `/exec` URL answers with an **HTTP
302 redirect** to `script.googleusercontent.com`; **Stripe doesn't follow
redirects**, so it logs every delivery as failed (Stripe's own "Error insight"
flagged it as a 3xx-redirect problem). This is a platform limitation, upstream of
the `stripeWebhook_` handler (which always returns 200 when reached), so it can't
be fixed in `Code.gs`. Verified live: first-hop status `302`, `location:
…googleusercontent.com/macros/echo…`.

## What it uncovered — the real issue

Read-only audit of the live store (aggregates only, no PII):

- **0 of ~2,257 customers** carry a `stripeSubId`, and **0** carry any
  `membershipStatus`. `stripeSubId`/`membershipStatus`/`paidUntil` are all in the
  `PROTECTED` sync list, so they aren't stripped on client sync — the server
  simply **never wrote them** on current records.
- Yet **live Stripe subscriptions were actively billing** membership customers
  (successful + failed renewals, a cancellation). Product: "JacRentals Membership
  — Monthly."
- The **app-driven** membership engine (`membershipEnroll_` /
  `membershipBillingCron`, re-spliced v84) is **installed and healthy** — its
  daily trigger runs at ~3 AM with 0% error — but had produced **0 `MINV`
  invoices** because **nobody was enrolled in it.**

**Conclusion:** memberships were being billed *entirely inside Stripe*, via
subscriptions left over from the older Stripe-native flow (EDIT D, ~2026-06-19)
that was superseded by app-driven billing. The subscriptions kept auto-renewing
on customers' cards with nothing in the app tracking or reconciling them — the
"charged after they lapsed" failure mode (an already-canceled sub showed exactly
that: app membership expired, Stripe billed on until the card failed). **No
double-billing was occurring** (app-driven billing had zero enrollees), but the
app was blind to real recurring revenue.

Scale turned out small: only **2 active** Stripe subscriptions at audit time.

## Decision & resolution (Jac, 2026-07-14)

- **App owns memberships** (source of truth). Membership model is a **12-month
  commitment**, monthly payments, early-cancel generates a cancellation invoice.
- **Webhook: deleted** in Stripe (done). Emails stop; nothing depended on it.
- **Migrate the 2 orphaned subscriptions onto app-driven billing**, one at a time,
  with a no-double-charge handoff.

### Migration recipe (no double-charge, no gap)

For an in-app customer with a card on file whose Stripe sub renews on day *D*:

1. **Enroll in the app with `startDate = D`** (the sub's period end). Because the
   start is in the future, `membershipEnroll_` takes the **deferred** path: it
   lands the member fields now and charges **$0 today**; the daily cron makes the
   first charge on day *D*. Confirm the app price matches the Stripe price first
   (Monthly base $299 + 10.75% tax = **$331.14**; matched).
2. **In Stripe, cancel the subscription "at period end" (day *D*)** — not
   immediately. Stripe covers the customer through *D*, never charges again, and
   the app cron picks up that same day. Seamless.

First customer (in-app, card on file) migrated this way on 2026-07-14, deferred to
his period-end. Verified: member fields set (Monthly, 12-mo commitment,
auto-renew), `paidUntil` empty (uncharged), first `$331.14` charge will post via
the cron on the start day.

## Follow-up bug — deferred enroll leaves an orphan invoice

`membershipEnroll_` creates the cycle invoice **before** branching, so on the
**deferred** path it returns an invoice it never charges — and the cron later
creates its **own** fresh invoice on the start day. Result: a **dangling unpaid
`MINV` invoice** for every future-dated enrollment (had to be voided by hand for
the first migration to avoid a phantom balance).

**Fix (additive, backend):** in the deferred branch, either (a) don't create the
invoice at all (let the cron create it on the start day, matching the immediate
path's "one invoice, charged" shape), or (b) have `membershipBillingCron` reuse an
existing unpaid same-cycle `MINV` invoice instead of always minting a new one.
Option (a) is the smaller change. Ships via `/clasp` (STOP-gate), not git.

## Still pending

- The migrated customer's Stripe **subscription** must be canceled **at period
  end** (deleting the webhook did NOT cancel it) — else Stripe + the app both
  charge on the start day = double charge.
- Confirm the first app-driven charge posts on the start day (invoice + card
  charge + `paidUntil` advance).
- **Second orphaned subscription** — that customer is **not in the app at all**;
  needs a customer record + card on file before the same migration.

## No repo/code change here

`Code.gs` is untouched by this note. The `wh=stripe` routing/handler are harmless
left in place (with the endpoint deleted in Stripe they receive no traffic). This
file is the record so the investigation and the migration recipe aren't re-derived.
