# Membership Billing — Backend handoff (Track C, hand-paste into Code.gs)

**Date:** 2026-06-19 · **Spec:** `docs/superpowers/specs/2026-06-19-membership-billing-design.md`

The **frontend** for membership billing is built and shipping (plan capture + the
**Activate Membership** flow). It degrades gracefully: until the backend below is
live, tapping *Activate Membership* shows *"the membership billing backend isn't
deployed yet"* and writes nothing. This doc is the **backend half** — it's
gitignored `Code.gs`, so it can't auto-deploy; paste it in and redeploy on the
usual cadence, **keeping the same deployment id** so the exec URL the frontend
calls is unchanged (see CLAUDE.md / the ACH handoff for the clasp mechanics).

> ⚠️ Money code. Test in Stripe **test mode** first, then flip to live. The frontend
> already enforces: Member type + plan chosen + card on file + signed Membership
> Agreement before it will call `membershipActivate`.

---

## 1. One-time Stripe dashboard setup

1. **Products / Prices** (recurring):
   - Product "JacRentals Membership — Monthly" → **Price $299.00 / month**, id e.g. `price_monthly`.
   - Product "JacRentals Membership — Annual" → **Price $2,691.00 / year**, id e.g. `price_annual`.
   - Store both ids in Script Properties: `PRICE_MEMBER_MONTHLY`, `PRICE_MEMBER_ANNUAL`.
2. **Tax:** the contract says "plus applicable taxes." Either enable **Stripe Tax**
   on the subscription (`automatic_tax[enabled]=true`) or attach a fixed **TaxRate**
   id (`MEMBER_TAX_RATE`) matching the existing invoice tax handling (10.75%).
3. **Webhook endpoint:** point a Stripe webhook at the Apps Script exec URL with
   `?wh=stripe` (or your routing of choice). Subscribe to: `invoice.paid`,
   `invoice.payment_failed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Save the **signing secret** to Script
   Properties as `STRIPE_WH_SECRET`.

## 2. Frontend ↔ backend contract

The frontend calls `POST { action:'membershipActivate', password, customerId, plan }`
and expects back:

```json
{ "ok": true, "subscriptionId": "sub_...", "paidUntil": "YYYY-MM-DD", "last4": "4242" }
```

On any failure return `{ "ok": false, "error": "<code>" }` (the frontend shows a
friendly message; an unknown/blank action already degrades to the "not deployed"
toast). The webhook then keeps these **server-owned** customer fields current:
`membershipStatus` (`active|past_due|lapsed`), `paidUntil`, `graceUntil`,
`stripeSubId`. Add them to your `SYNC_PROTECTED` customer list so the optimistic
client never clobbers a webhook write.

## 3. `membershipActivate` — dispatch action (illustrative; adapt to Code.gs)

```js
case 'membershipActivate': {
  const c = getCustomerRow_(req.customerId);              // your existing lookup
  if (!c) return json({ ok:false, error:'no-customer' });
  if (!/member/i.test(c.accountType||''))   return json({ ok:false, error:'not-member' });
  if (c.membershipStatus === 'active' && c.stripeSubId) // idempotent: already active
    return json({ ok:true, subscriptionId:c.stripeSubId, paidUntil:c.paidUntil });
  const priceId = req.plan === 'annual'
    ? props('PRICE_MEMBER_ANNUAL') : props('PRICE_MEMBER_MONTHLY');
  if (!priceId) return json({ ok:false, error:'no-price' });

  // Customer must exist in Stripe with the card as default PM (same as the
  // card-on-file flow already does via stripeSaveCard_/stripeSetDefault_).
  const stripeCustId = c.stripeId;
  if (!stripeCustId) return json({ ok:false, error:'no-stripe-customer' });

  // Subscription: anchor billing to NOW (no 1st-of-month, no proration).
  const params = {
    'customer': stripeCustId,
    'items[0][price]': priceId,
    'proration_behavior': 'none',
    'payment_behavior': 'error_if_incomplete', // fail loudly if the card declines
    'expand[0]': 'latest_invoice.payment_intent',
  };
  // tax: either automatic_tax[enabled]=true OR items[0][tax_rates][0]=MEMBER_TAX_RATE
  const taxRate = props('MEMBER_TAX_RATE');
  if (taxRate) params['items[0][tax_rates][0]'] = taxRate;

  const sub = stripePost_('/v1/subscriptions', params);   // your UrlFetchApp helper
  if (sub.error) return json({ ok:false, error: sub.error.code || 'stripe-error' });

  const paidUntil = isoDate_(sub.current_period_end);      // unix → YYYY-MM-DD
  // Persist server-owned fields on the customer row.
  setCustomerFields_(c, { stripeSubId: sub.id, membershipStatus:'active',
    membershipStartedAt: todayIso_(), paidUntil, graceUntil:'' });
  return json({ ok:true, subscriptionId: sub.id, paidUntil, last4: defaultCardLast4_(c) });
}
```

## 4. Webhook handler — in `doPost` (signature-verified)

```js
// At the top of doPost, before the password-gated dispatch:
if (e.parameter && e.parameter.wh === 'stripe') return handleStripeWebhook_(e);

function handleStripeWebhook_(e) {
  const sig = (e.parameter.sig) || headerSig_(e);          // Stripe-Signature
  const ev = verifyStripeEvent_(e.postData.contents, sig, props('STRIPE_WH_SECRET'));
  if (!ev) return ContentService.createTextOutput('bad sig'); // 200 but ignored
  const obj = ev.data.object;
  switch (ev.type) {
    case 'invoice.paid': {
      const c = customerByStripeSub_(obj.subscription);
      if (c) setCustomerFields_(c, { membershipStatus:'active',
        paidUntil: isoDate_(obj.lines.data[0].period.end), graceUntil:'' });
      break;
    }
    case 'invoice.payment_failed':
    case 'customer.subscription.updated': {
      const sub = ev.type === 'invoice.payment_failed'
        ? { id: obj.subscription, status: 'past_due' } : obj;
      if (sub.status === 'past_due' || sub.status === 'unpaid') {
        const c = customerByStripeSub_(sub.id);
        if (c && c.membershipStatus !== 'past_due' && c.membershipStatus !== 'lapsed')
          setCustomerFields_(c, { membershipStatus:'past_due',
            graceUntil: addDaysIso_(todayIso_(), 7) });            // 7-day grace
      }
      break;
    }
    case 'customer.subscription.deleted': {                 // final failure / canceled
      const c = customerByStripeSub_(obj.id);
      if (c) lapseMembership_(c);                            // see §5
      break;
    }
  }
  return ContentService.createTextOutput('ok');
}
```

## 5. Lapse + the 7-day grace — daily time-trigger + `lapseMembership_`

A daily trigger enforces the day-7 lapse for anyone whose grace elapsed without a
paying webhook (Stripe's `subscription.deleted` may also fire it):

```js
function membershipDailySweep_() {                          // Apps Script time-trigger, daily
  const today = todayIso_();
  eachCustomer_(c => {
    if (c.membershipStatus === 'past_due' && c.graceUntil && c.graceUntil <= today)
      lapseMembership_(c);
  });
}

function lapseMembership_(c) {
  // Downgrade account type Member → non-member equivalent.
  const downgraded = /Business Member/i.test(c.accountType) ? 'Business'
                   : /Member/i.test(c.accountType) ? 'Non-Business' : c.accountType;
  setCustomerFields_(c, { membershipStatus:'lapsed', accountType: downgraded,
    membershipLapsedAt: todayIso_(), graceUntil:'' });
  // The frontend re-rates the customer's ACTIVE rentals to Retail on next refresh
  // (it owns the pricing engine) — see Phase 3 below. The contract (§4/§5) already
  // authorizes "all active and future rentals convert to Retail Rates" on lapse.
}
```

## 6. Remaining FRONTEND work — Phase 3 (NOT yet built)

The active-rental **re-rate on lapse** is intentionally left for a follow-up because
it's a money recompute that needs the frontend pricing engine and the backend
lapse events to exist first (untestable end-to-end until §1–§5 are live):

- On `refreshFromBackend`, detect a customer whose `membershipStatus` just became
  `lapsed` and whose active (on-rent, not returned/closed) rentals are still priced
  at Member rates. Recompute each at Retail via the existing pricing path (the
  `isMember` branch at `app.js:670` now resolves false post-downgrade), log the
  re-rate to each rental's activity, and queue the price change for the diff-sync.
- Gate it so it runs **once per lapse** (e.g. a `rentalsReRatedForLapseAt` marker)
  and never double-applies. This is the single deliberate money-write in the feature.

## 7. Checklist

- [ ] Stripe Prices ($299/mo, $2,691/yr) + tax + webhook (signing secret) created.
- [ ] Script Properties set: `PRICE_MEMBER_MONTHLY`, `PRICE_MEMBER_ANNUAL`,
      `MEMBER_TAX_RATE` (or Stripe Tax on), `STRIPE_WH_SECRET`.
- [ ] `membershipActivate`, `handleStripeWebhook_`, `membershipDailySweep_` pasted;
      daily trigger installed; new fields added to `SYNC_PROTECTED`.
- [ ] Redeploy keeping the SAME deployment id (exec URL unchanged).
- [ ] Test-mode dry run: activate → first charge → `invoice.paid` advances `paidUntil`;
      force a failed renewal → Past Due + 7-day grace → lapse downgrades the account.
- [ ] Then Phase 3 (frontend active-rental re-rate) and flip to live.
