# Membership — completion to-do (handoff for a future session)

**As of 2026-06-25.** The membership subscription system is built, deployed, and live.
Two items remain — both need a hands-on step (an editor click or a fresh clasp
re-auth) and/or live prod testing, which is why they're parked here rather than
finished in-session.

## ✅ Already done (don't redo)
- **Frontend** (live on `main`, PRs #338 + #344): enrollment dialog, member-rate +
  $0-transport pricing gate, Rental Protection toggle + 15% line, "Signed" funnel,
  lifecycle display + Past-Due countdown, economics block. Enroll/cancel/reactivate
  call the **backend** in prod (so the server-protected `paidUntil`/`graceUntil`
  persist); `#local` keeps a demo path.
- **Backend** deployed live to prod (**version 46**) via clasp: `membershipEnroll`,
  `membershipCancel`, `membershipReactivate`, and the daily `membershipBillingCron`.
  Tracked, secret-free copy: `docs/handoffs/membership-billing-additions.gs`.
- Pricing is Owner-settable (Settings → Company; `mem*` keys). The backend reads it
  via `getConfigObj().settings.company`, falling back to the shipped defaults.

## 1. Install the daily billing-cron trigger  ← REQUIRED for auto-renewals
Without it, the actions work (enroll/cancel/reactivate charge immediately) but
**nothing auto-charges on a schedule**. Not urgent — no app-driven member exists yet,
so the earliest cycle is ~a month after the first real enrollment.

**Option A — editor (30 sec):** open the Apps Script project → **Run →
`installMembershipBillingCron_`** once (it's already in the deployed code). Or
Triggers ⏰ → Add Trigger → `membershipBillingCron` · Time-driven · Day timer · ~3am.

**Option B — no-editor, via the exec URL:** deploy the small admin action below, then
`curl` it once with an Admin password. Needs a fresh clasp window (RAPT ~10-min) to
deploy. **Scope caveat:** `ScriptApp.newTrigger` needs the `script.scriptapp` OAuth
scope on the web app — confirm it's in `appsscript.json` `oauthScopes` (add it +
redeploy if the call throws an authorization error).

```js
// add to Code.gs + dispatch (Admin-gated). Idempotent — won't duplicate the trigger.
function installMembershipCron_(body, role) {
  var t = ScriptApp.getProjectTriggers();
  for (var i = 0; i < t.length; i++) if (t[i].getHandlerFunction() === 'membershipBillingCron') return { ok: true, alreadyInstalled: true };
  ScriptApp.newTrigger('membershipBillingCron').timeBased().everyDays(1).atHour(3).create();
  return { ok: true, installed: true };
}
// dispatch (beside the other admin actions, e.g. after setConfig):
//   if (action === 'installMembershipCron') return json(isAdmin(pw) ? installMembershipCron_(body, role) : { ok:false, error:'forbidden' });
```
Then (GET, since POST→exec redirects drop the body):
`curl -s -L -G --data-urlencode "action=installMembershipCron" --data-urlencode "password=<ADMIN_PW>" "<EXEC_URL>"`
→ expect `{"ok":true,"installed":true}` (or `alreadyInstalled:true`).

## 2. Prod end-to-end verification  ← do once, with a real card
Drive the **live** app (app.jacrentals.com) as an Office/Admin and confirm the real
backend path (not just `#local`):
1. On a test customer with a **valid card on file** + a **signed membership agreement**,
   open Membership → **Saddle Up — Enroll** → pick a plan + add-ons → confirm.
2. Verify: the card is charged (a membership invoice appears in the Invoices card),
   `accountType` → Member, and the **Paid-Until persists after a reload** (this is the
   whole point of the backend wiring — it proves `paidUntil` wasn't stripped).
3. **Cancel** a Monthly member mid-term → a **Cancellation Invoice** for the remaining
   months appears; the member reads **Lapsed** and reverts to retail pricing.
4. **Pay Cancellation** → membership reopens **prepaid through the term**.
5. (After the trigger is installed) optionally run `membershipBillingCron` once from the
   editor against a member whose `paidUntil` is set to today to confirm a cycle charge +
   Paid-Until advance.

## Reference / gotchas
- Backend `Code.gs` is **gitignored**; the tracked copy is
  `docs/handoffs/membership-billing-additions.gs`. Deploy via `/clasp` (additive only).
- The Workspace enforces **RAPT reauth** with a ~10-min window — clasp write/deploy only
  works in a fresh-login window (the `clasp login` → paste-localhost-URL dance).
- The backend also has a **dormant Stripe-subscription** membership system
  (`membershipActivate_` / `membershipDailySweep`). We went app-driven on purpose; our
  cron only touches members **without** `stripeSubId`, so the two never overlap. If you
  ever switch to Stripe subscriptions, retire the app-driven cron to avoid double billing.
- Member pricing pages: `PRICE_MEMBER_MONTHLY/ANNUAL` (Stripe Price IDs) belong to the
  dormant subscription path — **not** used by the app-driven flow, which prices from the
  Settings `mem*` config. Keep them from drifting if both are ever live.
