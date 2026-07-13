# Stripe "failing webhook endpoint" email — diagnosis & resolution (2026-07-13)

**TL;DR:** Stripe emailed that it can't deliver live-mode events to
`…/exec?wh=stripe`. Root cause is a hard Google Apps Script limitation, **not** a
bug in our code, and **billing is not affected** — the daily reconciler
(`membershipDailySweep`) already carries authoritative subscription state.
**Decision (Jac, 2026-07-13): disable the endpoint in Stripe and rely on the
daily sweep.** Steps below.

## The email

> We've had some trouble sending requests in live mode to a webhook endpoint
> associated with your Jac Rentals Excavators, LLC account. … The URL of the
> failing webhook endpoint is
> `https://script.google.com/macros/s/AKfycbzHahzgJqOYe9o4GKlRVGh-A7USRn1k4Dvyy4ajLh8EYCqVxofouM28qs8trNlObZw/exec?wh=stripe`

That URL is the **current** prod deployment of the "Rental Wrangler Gate" Apps
Script (`DEPLOYMENT_ID` in `docs/handoffs/gas-deploy-service-account.mjs`) — so
this is **not** a stale-URL problem.

## Root cause — Apps Script returns 302 on POST; Stripe won't follow it

Every POST to an Apps Script `/exec` URL responds with an **HTTP 302 redirect**
to `script.googleusercontent.com` (where the real response body is served).
**Stripe does not follow redirects** and treats any non-2xx (including 3xx) as a
**failed delivery**. So every live subscription event Stripe sends is logged as
failed; after enough failures Stripe sent the warning email (and will eventually
auto-disable the endpoint on its own).

This is upstream of our handler — `stripeWebhook_` never even runs — so it
**cannot be fixed in `Code.gs`**. There is no way to make `/exec` return a direct
2xx for a cross-origin POST.

### Evidence (probed against the live endpoint, 2026-07-13)

- Anonymous auth-reject probe → `HTTP 200`, JSON `{"ok":false,"error":"unauthorized"}`
  (anonymous access is healthy — rules out the REST-deploy anon-access breakage
  the `/clasp` runbook warns about).
- Webhook POST `?wh=stripe`, **without** following redirects → **first-hop
  status `302`**, `location: https://script.googleusercontent.com/macros/echo?…`.
  This 302 is exactly what Stripe's delivery sees and rejects.
- Following the redirect (`curl -L`) → `200 "ok"`, confirming the handler works
  *if reached*. Stripe can't reach it because it won't follow the 302.

## Why billing is safe without the webhook

`stripeWebhook_` (`Code.gs`) only serves the **Stripe-subscription** membership
path, and is designed as an unreliable best-effort "ping": GAS can't read the
`Stripe-Signature` header, so the payload is never trusted — the handler
re-fetches authoritative state from Stripe. The real reconciler is the daily
trigger **`membershipDailySweep()`**, which re-fetches *every* subscription's
status straight from Stripe and enforces the 7-day grace. Its own comment:
*"covers any webhook that didn't deliver."*

So the webhook has effectively never delivered (GAS has always 302'd), and the
daily sweep has carried membership state the whole time. Removing the webhook
only removes near-real-time updates; status changes lag up to ~24h instead of
being instant — comfortably inside the 7-day grace. The app-driven membership
path (`membershipBillingCron`, no `stripeSubId`) never used the webhook at all.

## Resolution — disable the Stripe webhook endpoint

Jac performs this in the Stripe Dashboard (no code/infra change):

1. Stripe Dashboard → **Developers → Webhooks**.
2. Open the endpoint whose URL ends in `…/exec?wh=stripe`.
3. **Delete** it (or **Disable** to keep it for reference). Emails stop.

### Verify the safety net is actually running

The daily sweep is now the *sole* subscription reconciler, so confirm it's live:

- Apps Script editor (**Rental Wrangler Gate**) → **Triggers** (clock icon) →
  confirm a time-driven daily trigger on **`membershipDailySweep`** exists. If
  it's missing, add it (it must be installed via the editor — `scripts.run` /
  trigger installs 404 for the service account; see `/clasp`).

### Optional (not chosen, noted for later)

- Tightening the sweep from daily → hourly would cut worst-case status lag from
  ~24h to ~1h. Not required (grace is 7 days); a Triggers-UI change if ever
  wanted.
- If near-real-time is ever needed, the only working shape is a small relay
  (e.g. a Cloudflare Worker) that returns 200 to Stripe and forwards the POST to
  `/exec` — and it must include `&whk=<key>` if the `STRIPE_WH_KEY` script
  property is set (the `§250` DoS guard in `stripeWebhook_`).

## No code change

`Code.gs` is untouched. The `wh=stripe` routing and `stripeWebhook_` handler are
harmless if left in place — with the endpoint removed in Stripe they simply
never receive traffic. This file is the record so the email isn't re-triaged.
