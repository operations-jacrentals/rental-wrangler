/* ════════════════════════════════════════════════════════════════════════
 * MEMBERSHIP — PO-hold on dues + create-ahead-regardless-of-payment
 * Spec: docs/superpowers/specs/2026-07-17-membership-po-advance-billing-design.md
 * Jac 2026-07-17. ADDITIVE splice recipe against the LIVE Code.js membership block
 * (reconciled 2026-07-17 against the live source pulled via the Drive connector —
 * scriptId 1hw9A7Id3YIoiSCBkNFeDaKGRv-VtljFFIuBdQG5QULrgS0DjQhQ_2vyZ, project
 * "Rental Wrangler Gate"). The live code is AHEAD of the old tracked record
 * (membership-billing-additions.gs) — it already has memEnsureNextInvoice_,
 * memFindDueInvoice_, and the future-start branch. Reconcile against these live
 * functions, not the old record.
 *
 * ⚠ DEPLOY = /clasp push (service account) → Jac's Apps Script EDITOR deploy. Do NOT
 *   REST-deploy (breaks anonymous /exec). STOP-gate: confirm the diff with Jac first.
 * ⚠ TEST on a throwaway/test member on staging AFTER the editor deploy before trusting
 *   real dues (this logic can't run in the repo env).
 *
 * WHAT CHANGES vs live (three edits + four new helpers):
 *   NEW  memAddDaysIso_, memDuesPoHeld_, memDuesInvoiceIndex_, memEnsureInvoicesAhead_
 *   EDIT membershipEnroll_       — reuse a waiting invoice; PO-hold; create-ahead
 *   EDIT membershipBillingCron   — create-ahead for every active member each run
 *                                  (regardless of payment → stacking); PO-hold before charge
 *   The old memEnsureNextInvoice_ calls are REPLACED by memEnsureInvoicesAhead_ (leave the
 *   old fn defined but unused, or delete it — no other caller).
 *
 * MODEL (spec-locked):
 *   • duesRequirePO (customer, default falsey = EXEMPT) — set client-side in the agreement /
 *     account line. Dues are PO-held only when requiresPO && duesRequirePO && !inv.po.
 *   • Held ≠ declined: no charge, no graceUntil, no lapse — the invoice just waits; a later
 *     run charges it once a PO is on it (or the toggle is turned off).
 *   • Create-ahead: for every ACTIVE member each run, create every cycle invoice whose due is
 *     within the next 28 days that doesn't exist yet — regardless of whether prior dues are
 *     paid (open invoices stack; each month its own invoice). On a successful charge we also
 *     create the immediate next (horizon = the new paidUntil) — your "when it's paid, create
 *     the next one." Annual advances 12 mo at a time, so an annual renewal invoice is created
 *     28 days before renewal — never a year early.
 *   • Charge stays on the due date (memFindDueInvoice_ picks the oldest due unpaid; paidUntil
 *     advances only on a cleared charge). Cancellation unchanged (leftover term billed at once).
 * ════════════════════════════════════════════════════════════════════════ */

// ── NEW helpers ─────────────────────────────────────────────────────────
function memAddDaysIso_(iso, n) {
  var d = iso ? new Date(iso + 'T00:00:00Z') : new Date();
  return Utilities.formatDate(new Date(d.getTime() + n * 86400000), 'UTC', 'yyyy-MM-dd');
}
// Dues PO hold (spec 2026-07-17): held only when the account requires a PO AND the membership
// opted in (duesRequirePO) AND the dues invoice carries no PO. Mirrors the client invoicePoBlocked.
function memDuesPoHeld_(c, inv) { return !!(c && c.requiresPO && c.duesRequirePO && inv && !inv.po); }
// One scan of a member's non-cancellation membership invoices → { max: latest dueDate, dues: {due:true} }.
function memDuesInvoiceIndex_(customerId) {
  var idx = { max: '', dues: {} };
  var s = ss().getSheetByName('invoices'); if (!s) return idx;
  var last = s.getLastRow(); if (last < 2) return idx;
  var vals = s.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    var v = null; try { v = JSON.parse(vals[i][0]); } catch (e) { continue; }
    if (!v || v.customerId !== customerId || !v.membership || v.membershipCancellation) continue;
    var due = String(v.dueDate || v.date || ''); if (!due) continue;
    idx.dues[due] = true; if (due > idx.max) idx.max = due;
  }
  return idx;
}
// Create every cycle invoice with due <= horizonIso that doesn't exist yet, advancing one cycle at a
// time from the latest existing due. Idempotent (skips a due already present). No charge here — the
// cron charges on the due date. Regardless of payment, so unpaid cycles stack. guard caps a catch-up burst.
function memEnsureInvoicesAhead_(c, plan, horizonIso) {
  if (!c || !horizonIso) return;
  var cycM = memIsAnnual_(plan) ? 12 : 1;
  var idx = memDuesInvoiceIndex_(c.customerId);
  var nextDue = idx.max ? memAddMonthsIso_(idx.max, cycM) : String(c.commitmentStart || c.paidUntil || todayIso_());
  var guard = 0;
  while (nextDue && nextDue <= horizonIso && guard < 18) {
    guard++;
    if (c.commitmentEnd && nextDue >= c.commitmentEnd && c.autoRenew === false) break;   // term complete, no renew → stop
    if (!idx.dues[nextDue]) {
      var nb = memFeeLines_(plan, c.addOns || {}, memPricing_());
      memWriteInvoice_(c, nb.lines, { date: todayIso_(), due: nextDue });
      idx.dues[nextDue] = true;
    }
    nextDue = memAddMonthsIso_(nextDue, cycM);
  }
}

// ── EDIT: membershipEnroll_ (full replacement — changes flagged inline) ──
function membershipEnroll_(body, role) {
  var c = readRecord_('customers', String(body.customerId || '')); if (!c) return { ok: false, error: 'customer-not-found' };
  var plan = memIsAnnual_(body.plan) ? 'Yearly' : 'Monthly';
  var addOns = body.addOns || {}, p = memPricing_(), start = String(body.startDate || todayIso_());
  var built = memFeeLines_(plan, addOns, p);
  // CHANGED: reuse a waiting unpaid dues invoice on a retry (e.g. after a PO was added to a held enroll)
  // instead of minting a duplicate. Fresh enroll → none found → create one (due = start, as live).
  var inv = memFindDueInvoice_(c.customerId, '') || memWriteInvoice_(c, built.lines, { date: todayIso_(), due: start });
  if (!inv) return { ok: false, error: 'busy' };
  // deferred (future-dated) start: land member fields now, skip the charge — the cron charges on start day (UNCHANGED)
  if (start > todayIso_()) {
    memPatchCustomer_(c.customerId, { accountType: memMemberAccountType_(c), paidCadence: plan, commitmentStart: start, commitmentEnd: memAddMonthsIso_(start, MEM_TERM_MONTHS),
      autoRenew: !!body.autoRenew, addOns: { transport: !!addOns.transport, protection: !!addOns.protection },
      unlimitedTransport: !!addOns.transport || undefined, rentalProtection: !!addOns.protection || undefined, prepaid: false, graceUntil: undefined });
    memLedger_(inv.invoiceId, c.customerId, Math.round(built.fee.total * 100), c.stripeId, role, 'membership-enroll-deferred');
    return { ok: true, status: 'pending', invoiceId: inv.invoiceId };
  }
  // fields, still Member Incomplete until the charge clears (UNCHANGED)
  memPatchCustomer_(c.customerId, { accountType: 'Member Incomplete', paidCadence: plan, commitmentStart: start, commitmentEnd: memAddMonthsIso_(start, MEM_TERM_MONTHS),
    autoRenew: !!body.autoRenew, addOns: { transport: !!addOns.transport, protection: !!addOns.protection },
    unlimitedTransport: !!addOns.transport || undefined, rentalProtection: !!addOns.protection || undefined, prepaid: false, graceUntil: undefined });
  var c1 = readRecord_('customers', c.customerId) || c;
  // NEW: PO-hold — never charge a PO-required member's dues without a PO. Stay Member Incomplete; the
  // operator adds a PO to invoice `inv` (or turns the requirement off) and re-runs Start Membership,
  // which reuses this same waiting invoice (above) instead of duplicating it.
  if (memDuesPoHeld_(c1, inv)) return { ok: true, status: 'held-po', invoiceId: inv.invoiceId };
  var res = stripeChargeInvoice_({ invoiceId: inv.invoiceId }, role);   // UNLOCKED — charge manages its own lock
  if (res && res.ok && (res.status === 'succeeded' || res.alreadyPaid)) {
    var newPaidUntil = memAddMonthsIso_(start, plan === 'Yearly' ? 12 : 1);
    var c2 = memPatchCustomer_(c.customerId, { accountType: memMemberAccountType_(c), paidUntil: newPaidUntil });
    memLedger_(inv.invoiceId, c.customerId, Math.round(built.fee.total * 100), c.stripeId, role, 'membership-enroll');
    // CHANGED: memEnsureNextInvoice_ → memEnsureInvoicesAhead_ (on-payment trigger). Monthly → horizon = new
    // paidUntil (immediate next). Annual → cap at today+28d so we DON'T create the renewal a year early (spec).
    if (body.autoRenew !== false) memEnsureInvoicesAhead_(c2 || c, plan, memIsAnnual_(plan) ? memAddDaysIso_(todayIso_(), 28) : newPaidUntil);
    return { ok: true, status: 'active', invoiceId: inv.invoiceId, paidUntil: c2 && c2.paidUntil };
  }
  return { ok: true, status: 'incomplete', invoiceId: inv.invoiceId, charge: res };   // declined → stays Member Incomplete
}

// ── EDIT: membershipBillingCron (full replacement — changes flagged inline) ──
function membershipBillingCron() {
  var s = ss().getSheetByName('customers'); if (!s) return;
  var last = s.getLastRow(); if (last < 2) return;
  var vals = s.getRange(2, 2, last - 1, 1).getValues(), ids = [];
  for (var i = 0; i < vals.length; i++) {
    var c0 = null; try { c0 = JSON.parse(vals[i][0]); } catch (e) { continue; }
    if (c0 && memIsMemberType_(c0.accountType) && c0.paidCadence && !c0.stripeSubId) ids.push(c0.customerId);   // app-driven members only
  }
  var today = todayIso_();
  for (var j = 0; j < ids.length; j++) {
    try {
      var c = readRecord_('customers', ids[j]); if (!c || !memIsMemberType_(c.accountType) || c.stripeSubId || c.prepaid) continue;
      if (c.graceUntil && c.graceUntil >= today) continue;                      // still inside a decline-grace — a later run retries
      if (c.graceUntil && c.graceUntil < today) { memLapse_(c); continue; }     // grace expired → lapse
      var plan = (c.paidCadence === 'Yearly') ? 'Yearly' : 'Monthly';
      // NEW (Change 2): create every cycle invoice due within 28 days that doesn't exist yet, for EVERY
      // active member each run — regardless of whether prior dues are paid (open invoices stack). This is
      // the "28 days prior if the pay thing hasn't worked out" trigger; the on-payment trigger lives in the
      // success branch below. A PO-held member never enters grace, so they stay active here and keep stacking.
      memEnsureInvoicesAhead_(c, plan, memAddDaysIso_(today, 28));
      // due-check (UNCHANGED): only CHARGE when the current cycle is up
      if (!c.paidUntil && (!c.commitmentStart || c.commitmentStart > today)) continue;   // start not reached — not due
      if (c.paidUntil && c.paidUntil > today) continue;                          // paid ahead — not due yet
      if (c.commitmentEnd && c.paidUntil >= c.commitmentEnd) {                  // term complete
        if (!c.autoRenew) continue;                                            // completed; stops billing (member until paidUntil)
        memPatchCustomer_(c.customerId, { commitmentStart: today, commitmentEnd: memAddMonthsIso_(today, MEM_TERM_MONTHS) });
        c = readRecord_('customers', ids[j]);
        memEnsureInvoicesAhead_(c, plan, memAddDaysIso_(today, 28));            // renewed term → make sure the renewal cycle's invoice exists
      }
      var built = memFeeLines_(plan, c.addOns || {}, memPricing_());
      // Charge the oldest pre-created invoice due on/before today; mint one only if none exists (legacy/safety).
      var inv = memFindDueInvoice_(c.customerId, today) || memWriteInvoice_(c, built.lines, { date: today, due: today });
      if (!inv) continue;
      // NEW (Change 1): PO-hold — no charge, no grace, no lapse; the invoice waits for a PO. Retried each run.
      if (memDuesPoHeld_(c, inv)) continue;
      var res = stripeChargeInvoice_({ invoiceId: inv.invoiceId }, 'Owner');    // UNLOCKED
      if (res && res.ok && (res.status === 'succeeded' || res.alreadyPaid)) {
        var cur = readRecord_('customers', ids[j]);
        var payBase = cur.paidUntil || cur.commitmentStart || today;             // first charge has no paidUntil yet — base off the enrolled start date
        var newPaidUntil = memAddMonthsIso_(payBase, plan === 'Yearly' ? 12 : 1);
        memPatchCustomer_(ids[j], { paidUntil: newPaidUntil, graceUntil: undefined });
        memLedger_(inv.invoiceId, ids[j], Math.round(built.fee.total * 100), c.stripeId, 'cron', 'membership-cycle');
        // CHANGED: on-payment trigger — monthly creates the immediate next (horizon = new paidUntil); annual caps
        // at today+28d so the renewal isn't created a year early (spec). Skipped if term done + not auto-renewing.
        var cur2 = readRecord_('customers', ids[j]);
        var termDone = cur2 && cur2.commitmentEnd && newPaidUntil >= cur2.commitmentEnd && cur2.autoRenew === false;
        if (cur2 && memIsMemberType_(cur2.accountType) && !cur2.stripeSubId && !termDone) memEnsureInvoicesAhead_(cur2, plan, memIsAnnual_(plan) ? memAddDaysIso_(today, 28) : newPaidUntil);
      } else {
        memPatchCustomer_(ids[j], { graceUntil: Utilities.formatDate(new Date(Date.now() + MEM_GRACE_DAYS * 86400000), 'UTC', 'yyyy-MM-dd') });
        memLedger_(inv.invoiceId, ids[j], 0, c.stripeId, 'cron', 'membership-decline');
      }
    } catch (e) { try { console.error('membershipBillingCron ' + ids[j] + ': ' + (e && e.stack ? e.stack : e)); } catch (e2) {} }
  }
}
