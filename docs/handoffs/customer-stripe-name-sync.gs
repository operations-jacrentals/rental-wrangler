/* ════════════════════════════════════════════════════════════════════════
 * CUSTOMER → STRIPE identity sync in doSync — backend fix (2026-07-07)
 * -------------------------------------------------------------------------
 * ROOT CAUSE (report: "I'm charging John's account but Stripe has it attached
 * to Julia Long"): a Stripe Customer's display name/email/phone is stamped
 * ONCE, at card-save time, by stripeSetupIntent_ (from the app record's fields
 * at that moment) and was NEVER re-synced afterward. So when a customer record
 * was later renamed in the app (common when a record is created back-to-back
 * with, or copied from, a neighbor — e.g. adjacent ids C2198 John Chaisson /
 * C2199 Julia Long, Stripe objects created seconds apart), the app showed the
 * corrected name while the Stripe dashboard kept the STALE one. The app DB was
 * never wrong (John C2198 and Julia C2199 have distinct stripeIds + distinct
 * cards, verified against live Stripe via stripeListCards) — only Stripe's
 * label drifted. Money always routed to the correct Stripe customer; the label
 * was cosmetic but alarming to staff.
 *
 * FIX: piggyback on doSync, which already loads each customer's `existing`
 * record (to protect server-owned fields like stripeId). When name/email/phone
 * changed AND the customer already has a stripeId, POST the change to Stripe so
 * the display fields track the app. Fires ONLY on a real identity change to a
 * customer with a stripeId (a normal resync makes ZERO Stripe calls), is
 * idempotent (next sync sees no diff), runs OFF the lock, and is capped at 50
 * per sync so a bulk rename can't blow the 6-min execution limit. If Stripe
 * isn't configured, stripeApi_ throws and the try/catch makes it a silent no-op.
 *
 * This file is the tracked, SECRET-FREE source of truth. Additive-only; three
 * small edits to Code.gs `doSync` (deployed via /clasp @78, 2026-07-07):
 *
 * EDIT 1 — declare the queue (the counters line at the top of doSync):
 *     var nUp = 0, nDel = 0, stripeCustomerSyncs = [];
 *
 * EDIT 2 — inside the per-id upsert forEach, INSIDE the `if (prot) { ... }`
 *          block (so `existing` is in scope), right AFTER the protList.forEach:
 *
 *   if (entity === 'customers' && existing && existing.stripeId) {
 *     var _sc = {};
 *     ['name', 'email', 'phone'].forEach(function (f) {
 *       var nv = rec[f] == null ? '' : String(rec[f]);
 *       var ov = existing[f] == null ? '' : String(existing[f]);
 *       if (nv !== ov && nv !== '') _sc[f] = nv;   // never blank a Stripe field from a partial record
 *     });
 *     if (Object.keys(_sc).length) stripeCustomerSyncs.push({ stripeId: existing.stripeId, fields: _sc });
 *   }
 *
 * EDIT 3 — after `} finally { lock.releaseLock(); }`, BEFORE the return; and
 *          add stripeSynced to the returned object:
 *
 *   var stripeSynced = 0;
 *   stripeCustomerSyncs.slice(0, 50).forEach(function (u) {
 *     try {
 *       var p = {}, fl = u.fields;
 *       if (fl.name != null) p.name = fl.name;
 *       if (fl.email != null) p.email = fl.email;
 *       if (fl.phone != null) p.phone = fl.phone;
 *       var r = stripeApi_('post', 'customers/' + encodeURIComponent(u.stripeId), p);
 *       if (r && r.ok) stripeSynced++;
 *     } catch (e) {}
 *   });
 *   return { ok: true, synced: true, upserted: nUp, deleted: nDel, stripeSynced: stripeSynced };
 *
 * TEST (end-to-end, on prod): rename a customer who has a card on file, then
 * confirm their Stripe customer's name updates in the dashboard. Throwaway
 * check (no stripeId → stripeSynced:0) done pre-prod on a DIAG-CUST-* record.
 * ════════════════════════════════════════════════════════════════════════ */
