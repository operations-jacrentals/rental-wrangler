// CI logic regression suite — boots the app in #local (demo) mode and exercises the
// REAL money + multi-unit functions via the window.__rw test seam (see exposeTestApi
// in app.js). Locks in the audit fixes (allocation lid-stability, per-unit status,
// No-Show line removal, mirror logic) so they can't silently regress on a money app.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const root = process.cwd();

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/' || p === '') p = '/index.html';
    const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(8000, r));

const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));

let failed = false;
try {
  await page.goto('http://localhost:8000/#local', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => !!window.__rw, { timeout: 20000 });

  const results = await page.evaluate(async () => {
    const T = window.__rw; const out = []; const ok = (c, m) => out.push({ ok: !!c, m });

    // 1) CRITICAL — allocations keyed by a stable lid, immune to line reorder/splice
    const inv = T.IDX.invoice.get('01i02Ju26');
    const rl = inv.lineItems.find((l) => l.kind === 'rental');
    const before = T.itemPaid(inv, rl);
    inv.lineItems.unshift({ kind: 'custom', lid: 'TEST_DUMMY', ref: null, amount: 0 }); // shift every index by 1
    const after = T.itemPaid(inv, rl);
    inv.lineItems.shift();                                                              // restore
    ok(before === 753 && after === before, `allocation lid-stable under line reorder (before=${before} after=${after})`);

    // 2) itemPaid → 0 on an unpaid line of a partial invoice
    const inv2 = T.IDX.invoice.get('02i07Ju26');
    ok(T.itemPaid(inv2, inv2.lineItems[0]) === 0, 'itemPaid 0 on an unpaid invoice line');

    // 2b) §19b per-line / partial refund (#125) — refund math, settled balance, applyPayment merge
    {
      const ri = T.IDX.invoice.get('01i02Ju26');
      const rline = ri.lineItems.find((l) => l.kind === 'rental');
      const rkey = T.lineKey(rline);
      const linePaid = T.itemPaid(ri, rline);                              // 753
      const snap = { refundedAmount: ri.refundedAmount, refunded: ri.refunded, refundAllocations: ri.refundAllocations };
      const balBefore = T.invoiceTotals(ri).balance;
      const half = Math.round((linePaid / 2) * 100) / 100;

      ri.refundAllocations = { [rkey]: half }; ri.refundedAmount = half;   // simulate a partial per-line refund
      ok(Math.abs(T.itemRefunded(ri, rline) - half) < 0.01, 'itemRefunded tracks the per-line refund');
      ok(Math.abs(T.itemRefundable(ri, rline) - (linePaid - half)) < 0.01, 'itemRefundable = paid − refunded');
      ok(!T.lineFullyRefunded(ri, rline), 'half-refunded line is not fully refunded');
      ok(T.invoiceTotals(ri).balance === balBefore, 'SETTLED: balance unchanged by a refund (#116 invariant, extended to partials)');
      ok(T.refundLines(ri).some((L) => L.key === rkey), 'a still-refundable line appears in refundLines');

      ri.refundAllocations = { [rkey]: linePaid };                        // fully refund the line
      ok(T.lineFullyRefunded(ri, rline), 'line fully refunded when its refund == its paid');
      ok(!T.refundLines(ri).some((L) => L.key === rkey), 'refundLines excludes a fully-refunded line');

      ri.refundAllocations = {}; ri.refundedAmount = 0; ri.refunded = false;
      T.applyPayment('01i02Ju26', { refundedAmount: half, refundedCents: Math.round(half * 100), amountPaid: ri.amountPaid }, null, { [rkey]: half });
      ok(Math.abs((ri.refundAllocations[rkey] || 0) - half) < 0.01, 'applyPayment merges the refund split into inv.refundAllocations');

      ri.refundAllocations = snap.refundAllocations; ri.refundedAmount = snap.refundedAmount; ri.refunded = snap.refunded;   // restore
      ok(T.rentalLineRefund({ rentalId: 'Z', invoiceId: null }).refunded === false, 'rentalLineRefund: no invoice → not refunded');
    }

    // 3) per-unit status derivation off the shared window (date-robust via TODAY_ISO)
    const today = T.TODAY_ISO;
    ok(T.unitStatus({ startDate: today }, { status: 'Reserved' }) === 'Reserved', 'Reserved + today window stays Reserved (Today/Tomorrow retired → flags)');
    ok(T.unitStatus({ startDate: '2099-01-01' }, { status: 'Reserved' }) === 'Reserved', 'Reserved + far window stays Reserved');
    ok(T.unitStatus({ startDate: '2000-01-01' }, { status: 'Reserved' }) === 'No Show', 'Reserved + passed window → No Show (derivation kept)');
    ok(T.unitStatus({}, { status: 'On Rent' }) === 'On Rent', 'stored On Rent passes through');

    // 4) rentalStatusDisplay — uniform single status vs the mix label
    ok(T.rentalStatusDisplay({ units: [{ status: 'On Rent' }, { status: 'On Rent' }] }).mixed === false, 'uniform units → not mixed');
    const mix = T.rentalStatusDisplay({ startDate: today, units: [{ status: 'On Rent' }, { status: 'Reserved' }] });
    ok(mix.mixed === true && /On Rent/.test(mix.label) && /(Today|Reserved)/.test(mix.label), `divergent units → mix label ("${mix.label}")`);

    // 5) rentalMirrorStatus — an active unit beats a terminal one (keeps ACTIVE_RENTAL true)
    ok(T.rentalMirrorStatus({ units: [{ status: 'Returned' }, { status: 'On Rent' }] }) === 'On Rent', 'mirror: active beats terminal');
    ok(T.rentalMirrorStatus({ units: [{ status: 'Returned' }, { status: 'No Show' }] }) === 'Returned', 'mirror: all-terminal → terminal');

    // 6) allUnitsTerminal — Returned/No Show terminal, On Rent not, zero units not
    ok(T.allUnitsTerminal({ units: [{ status: 'Returned' }, { status: 'No Show' }] }) === true, 'all terminal → true');
    ok(T.allUnitsTerminal({ units: [{ status: 'Returned' }, { status: 'On Rent' }] }) === false, 'one active → not all terminal');
    ok(T.allUnitsTerminal({ units: [] }) === false, 'zero units → not terminal');

    // 7) unitVoided — only No Show / Cancelled (Returned is terminal but billed)
    ok(T.unitVoided({}, { status: 'No Show' }) && T.unitVoided({}, { status: 'Cancelled' }) && !T.unitVoided({}, { status: 'Returned' }), 'voided = No Show / Cancelled only');

    // 8) rentalLineItems / transportLineItems skip a voided unit (real multi-unit R-MU).
    // R-MU's start date has passed, so a *Reserved* U023 now auto-derives to No Show
    // (the "reservation past start = No Show" rule) — force it billable first so the base
    // case measures 2 real lines, independent of the demo clock. PRODUCTION logic is correct.
    const rmu = T.IDX.rental.get('R-MU');
    const u023 = T.unitEntry(rmu, 'U023'); const saved = u023.status;
    u023.status = 'On Rent';
    const baseLines = T.rentalLineItems(rmu).length;
    u023.status = 'No Show';
    const voidedLines = T.rentalLineItems(rmu).length;
    const voidedTransport = T.transportLineItems(rmu).length;
    u023.status = saved;                                                                // restore
    ok(baseLines === 2 && voidedLines === 1, `rentalLineItems skips voided unit (${baseLines} → ${voidedLines})`);
    ok(voidedTransport === 1, `transportLineItems skips voided unit (→ ${voidedTransport})`);

    // 9) removeUnitInvoiceLine drops BOTH the unit's rental + transport lines (keeps siblings)
    const inv4 = T.IDX.invoice.get('04i13Ju26');
    const snapshot = inv4.lineItems.slice();
    T.removeUnitInvoiceLine(rmu, 'U023');
    const u023left = inv4.lineItems.filter((l) => l.unitId === 'U023').length;
    const u007left = inv4.lineItems.filter((l) => l.unitId === 'U007').length;
    inv4.lineItems = snapshot;                                                          // restore
    ok(u023left === 0 && u007left === 2, `removeUnitInvoiceLine drops both U023 lines, keeps U007 (U023=${u023left} U007=${u007left})`);

    // 10) unitEntry + isPrimaryUnit (the consolidated helpers)
    ok(T.unitEntry(rmu, 'U007').unitId === 'U007' && T.unitEntry(rmu, 'NOPE') === null, 'unitEntry finds the entry / null when absent');
    ok(T.isPrimaryUnit(rmu, T.unitEntry(rmu, 'U007')) === true && T.isPrimaryUnit(rmu, T.unitEntry(rmu, 'U023')) === false, 'isPrimaryUnit by unitId');

    // 11) completing a WO's LINES never completes the WO — only the blue button does
    const wo = T.IDX.wo.get('WO0002');
    if (wo && (wo.lineItems || []).length) {
      const sp = wo.phase, sl = wo.lineItems.map((l) => l.phase);
      wo.lineItems.forEach((l, i) => T.setWoLinePhase(wo.woId, i, 'Complete'));
      ok(wo.phase !== 'Complete', 'all lines Complete does NOT complete the WO');
      ok(T.woBottleneck(wo).label === 'Ready to complete', 'WO reads "Ready to complete" when all lines done');
      T.setWoPhase(wo.woId, 'Complete');
      ok(wo.phase === 'Complete', 'the blue Complete-WO button completes it');
      wo.phase = sp; wo.lineItems.forEach((l, i) => { l.phase = sl[i]; });
    } else ok(false, 'WO0002 fixture missing');

    // 12) Round up missing units — imported rentals that carry only a free-text legacyUnitName
    // (unitId null) become real unit records, and every referencing rental is linked. Dedupe by
    // cleaned name; an existing unit by name is LINKED not duplicated; the run is idempotent.
    ok(T.cleanUnitName('(❌)Phantom') === 'Phantom' && T.cleanUnitName('❌Yaga Feb 22-23') === 'Yaga' && T.cleanUnitName('Landslide_BMT ONLY') === 'Landslide', 'cleanUnitName strips ❌ / dates / BMT-ONLY / underscores');
    const seedR = (id, legacy, cat) => { const r = { rentalId: id, customerId: 'C0009', unitId: null, legacyUnitName: legacy, categoryId: cat, rentalName: legacy, startDate: T.TODAY_ISO, endDate: T.TODAY_ISO, status: 'On Rent', transportType: 'Self', units: [], invoiceId: null, startHours: null, returnHours: null, refunded: false, notes: '' }; T.DATA.rentals.push(r); T.IDX.rental.set(id, r); return r; };
    seedR('R-MIG1', '(❌)Phantom', 'CAT011'); seedR('R-MIG2', 'Phantom', 'CAT011'); seedR('R-MIG3', 'Worm', 'CAT011');
    const unitsBefore = T.DATA.units.length;
    const plan = T.planUnitMigration();
    const pPhantom = plan.find((p) => p.name === 'Phantom');
    const pWorm = plan.find((p) => p.name === 'Worm');
    ok(!!pPhantom && pPhantom.action === 'create' && pPhantom.count === 2, `two legacy names → one new "Phantom" unit (×2 rentals)`);
    ok(!!pWorm && pWorm.action === 'link' && pWorm.unitId === 'U003', 'an existing unit by name is LINKED, not duplicated (Worm → U003)');
    const res = T.applyUnitMigration(plan);
    const newPhantom = T.DATA.units.find((u) => u.name === 'Phantom');
    ok(!!newPhantom && newPhantom.fleetStatus === 'Active', 'the new unit is a normal Active record');
    ok(T.IDX.rental.get('R-MIG1').unitId === newPhantom.unitId && T.IDX.rental.get('R-MIG3').unitId === 'U003', 'rentals now point at the resolved unitIds');
    ok(T.DATA.units.length === unitsBefore + 1, 'exactly ONE unit was created for the two Phantom rentals');
    ok(T.planUnitMigration().length === 0, 'migration is idempotent — a second run finds nothing');

    // 13) Transport pricing v2 — $3.50/mile + $50 load + $20 fuel (fueled), per leg.
    const tp = (a) => T.computeTransportPrice(a).price;
    // 10 mi Delivery, fueled: (3.5*10 + 50 + 20) * 1 = 105
    ok(tp({ transportType: 'Delivery', oneWayMiles: 10, fueled: true }) === 105, 'Delivery 10mi fueled → $105');
    // 10 mi Round-Trip, fueled: 105 * 2 = 210
    ok(tp({ transportType: 'Round-Trip', oneWayMiles: 10, fueled: true }) === 210, 'Round-Trip 10mi fueled → $210 (2 legs)');
    // 10 mi Delivery, NOT fueled: (35 + 50) * 1 = 85
    ok(tp({ transportType: 'Delivery', oneWayMiles: 10, fueled: false }) === 85, 'Delivery 10mi electric → $85 (no fuel)');
    // Recovery = 1 leg like Delivery
    ok(tp({ transportType: 'Recovery', oneWayMiles: 10, fueled: true }) === 105, 'Recovery 10mi fueled → $105 (1 leg)');
    // Self / unlimited / unknown miles
    ok(tp({ transportType: 'Self', oneWayMiles: 10, fueled: true }) === 0, 'Self → $0');
    ok(tp({ transportType: 'Round-Trip', oneWayMiles: 10, fueled: true, unlimitedTransport: true }) === 0, 'Unlimited member → $0');
    ok(T.computeTransportPrice({ transportType: 'Delivery', oneWayMiles: null, fueled: true }).price === null, 'no miles yet → price unknown (null)');
    // fuel-type detection
    ok(T.isFueledType('Diesel') && T.isFueledType('Gas') && !T.isFueledType('Electric') && !T.isFueledType(''), 'isFueledType: Diesel/Gas yes, Electric/empty no');

    // 14) §20 invoice SYNC — adding a unit to an invoiced rental bills it; removing un-bills +
    // restores the total; splitting moves the unit + its lines to a sibling on the SAME invoice.
    const JT = window.JT;
    const af = T.DATA.units.filter((u) => u.fleetStatus === 'Active');
    const [ua, ub, uc] = af;
    const mk = (u) => ({ unitId: u.unitId, status: 'On Rent', transportType: 'Delivery', deliveryAddress: 'X', recoveryAddress: '', transportMiles: 10, startCapture: null, endCapture: null, fcCapture: null });
    const rS = { rentalId: 'R-SYNCTEST', customerId: 'C0009', unitId: ua.unitId, categoryId: ua.categoryId, startDate: '2099-02-01', endDate: '2099-02-08', startTime: '', status: 'On Rent', transportType: 'Delivery', deliveryAddress: 'X', transportMiles: 10, invoiceId: null, units: [mk(ua), mk(ub)], notes: '', actions: [], mock: true };
    T.DATA.rentals.push(rS); T.IDX.rental.set('R-SYNCTEST', rS);
    const invS = { invoiceId: 'I-SYNCTEST', customerId: 'C0009', rentalIds: ['R-SYNCTEST'], date: T.TODAY_ISO, dueDate: T.TODAY_ISO, po: '', amountPaid: 0, lineItems: [], mock: true };
    T.rentalLineItems(rS).forEach((li) => invS.lineItems.push(li));
    T.transportLineItems(rS).forEach((li) => invS.lineItems.push(li));
    T.DATA.invoices.push(invS); T.IDX.invoice.set('I-SYNCTEST', invS); rS.invoiceId = 'I-SYNCTEST';
    const sumS = () => invS.lineItems.reduce((s, li) => s + (+li.amount || 0), 0);
    const baseSum = sumS();
    const wasOB = JT.state.overbookOn; JT.state.overbookOn = true;
    JT.linkUnitToRental('R-SYNCTEST', uc.unitId);
    // a freshly-added unit inherits the transport TYPE but not miles/address, so it gets its
    // rental line immediately (+ a transport line once its own site is set) — assert the rental line + total bump.
    ok(invS.lineItems.filter((li) => li.unitId === uc.unitId && li.kind === 'rental').length === 1 && sumS() > baseSum, `add unit → rental line billed onto the invoice (+$${sumS() - baseSum})`);
    JT.removeUnitFromRental(rS, uc.unitId);
    ok(invS.lineItems.filter((li) => li.unitId === uc.unitId).length === 0 && sumS() === baseSum, 'remove unit → both lines dropped + invoice total restored');
    const sibS = JT.splitUnitToNewRental('R-SYNCTEST', ub.unitId, '2099-03-01', '2099-03-05');
    ok(!!sibS && sibS.invoiceId === 'I-SYNCTEST', 'split → sibling rental on the SAME invoice');
    ok(!!sibS && invS.lineItems.some((li) => li.ref === sibS.rentalId && li.unitId === ub.unitId), 'split → moved unit lines re-homed to the sibling ref');
    ok(!T.rentalUnits(rS).some((eu) => eu.unitId === ub.unitId), 'split → unit removed from the original rental');
    JT.state.overbookOn = wasOB;

    // 15) §20 un-void restores billing — No-Show drops the unit's lines; reactivating re-adds them
    // (regression guard for the silent-under-billing bug found in the self-audit).
    const ud = af[3], ue = af[4];
    const rV = { rentalId: 'R-VOIDTEST', customerId: 'C0009', unitId: ud.unitId, categoryId: ud.categoryId, startDate: '2099-04-01', endDate: '2099-04-08', startTime: '', status: 'On Rent', transportType: 'Delivery', deliveryAddress: 'X', transportMiles: 10, invoiceId: null, units: [mk(ud), mk(ue)], notes: '', actions: [], mock: true };
    T.DATA.rentals.push(rV); T.IDX.rental.set('R-VOIDTEST', rV);
    const invV = { invoiceId: 'I-VOIDTEST', customerId: 'C0009', rentalIds: ['R-VOIDTEST'], date: T.TODAY_ISO, dueDate: T.TODAY_ISO, po: '', amountPaid: 0, lineItems: [], mock: true };
    T.rentalLineItems(rV).forEach((li) => invV.lineItems.push(li));
    T.transportLineItems(rV).forEach((li) => invV.lineItems.push(li));
    T.DATA.invoices.push(invV); T.IDX.invoice.set('I-VOIDTEST', invV); rV.invoiceId = 'I-VOIDTEST';
    const vBase = invV.lineItems.filter((li) => li.unitId === ue.unitId).length;
    JT.setUnitStatus('R-VOIDTEST', ue.unitId, 'No Show');
    const vVoid = invV.lineItems.filter((li) => li.unitId === ue.unitId).length;
    JT.setUnitStatus('R-VOIDTEST', ue.unitId, 'Returned');
    const vRestored = invV.lineItems.filter((li) => li.unitId === ue.unitId).length;
    ok(vBase >= 1 && vVoid === 0 && vRestored >= 1, `un-void restores billing (base ${vBase} → No-Show ${vVoid} → reactivated ${vRestored})`);

    // Mr. Wrangler data-actions — add/update/import safe fields only, never money, never delete
    ok(T.wrFunnel('payment discussed') === 'Payment Discussed' && T.wrFunnel('contacted') === 'Contacted', 'wrFunnel maps stage words → canonical funnel');
    const wrPlan = T.wrValidatePlan({ action: 'data', title: 'test', ops: [
      { op: 'import', entity: 'customers', rows: [{ firstName: 'Lead', lastName: 'One', phone: '337-555-0001', membershipStage: 'contacted' }, { firstName: 'Lead', lastName: 'Two', phone: '337-555-0002' }] },
      { op: 'update', entity: 'units', id: 'U003', fields: { notes: 'WR test note', currentHours: 99999 } },   // currentHours NOT allowlisted → dropped
      { op: 'update', entity: 'invoices', id: '01i02Ju26', fields: { amountPaid: 999999 } },                  // invoices not editable at all → refused
    ] });
    const wrImp = wrPlan.ops.find((o) => o.op === 'import');
    const wrUpd = wrPlan.ops.find((o) => o.op === 'update' && o.entity === 'units');
    ok(wrImp && wrImp.rows.length === 2 && wrImp.rows[0].membershipStage === 'Contacted', 'import keeps 2 rows + maps the stage');
    ok(wrUpd && wrUpd.fields.notes === 'WR test note' && !('currentHours' in wrUpd.fields), 'update keeps allowlisted notes, DROPS currentHours');
    ok(!wrPlan.ops.some((o) => o.entity === 'invoices'), 'invoices edit is REFUSED entirely (never touch money)');
    // #152 — a big import truncated mid-JSON (no closing fence) must STILL strip from the
    // bubble and open a preview from the rows that fully arrived (not dump raw JSON, no Apply).
    const truncReply = 'Here’s the import:\n\n```wrangler-action\n{"action":"data","title":"Import leads","ops":[{"op":"import","entity":"customers","rows":[\n{"firstName":"Ann","lastName":"One","phone":"337-555-0009"},\n{"firstName":"Bo","lastName":"Two","phone":"337-555-0010"},\n{"firstName":"Cut","lastName":"Off","phone":"337-555';
    const truncAct = T.parseWranglerAction(truncReply);
    ok(truncAct && truncAct.action === 'data' && truncAct._truncated, 'truncated import block still parses into a data action (#152)');
    ok(truncAct && truncAct.ops[0].rows.length === 2, 'salvage keeps the 2 complete rows, drops the cut-off one');
    ok(!/wrangler-action/.test(T.stripWranglerAction(truncReply)), 'truncated action block is stripped from the visible bubble (no raw JSON dump)');
    const truncPlan = T.wrValidatePlan(truncAct);
    ok(truncPlan.ops.length === 1 && truncPlan.ops[0].rows.length === 2, 'salvaged action validates into an applyable preview plan');
    // csv-import: model maps columns, frontend expands all rows (no output-token ceiling)
    const csvText = 'First Name,Last Name,Mobile,Email\nAnn,One,337-555-0001,ann@x.com\nBo,Two,337-555-0002,\nCut,Off,,';
    const parsed = T.parseCsvFile(csvText);
    ok(parsed && parsed.headers.length === 4, 'parseCsvFile extracts 4 headers from CSV');
    ok(parsed && parsed.rows.length === 3, 'parseCsvFile extracts 3 data rows');
    ok(parsed && parsed.rows[0]['First Name'] === 'Ann' && parsed.rows[0]['Mobile'] === '337-555-0001', 'parseCsvFile maps header names to values correctly');
    const csvFile = { name: 'leads.csv', csvHeaders: parsed.headers, csvRows: parsed.rows };
    const csvAction = { action: 'data', title: 'Import from CSV', ops: [{ op: 'csv-import', entity: 'customers', mapping: { 'First Name': 'firstName', 'Last Name': 'lastName', 'Mobile': 'phone', 'Email': 'email' }, skipIfEmpty: ['firstName', 'lastName'] }], _csvAttached: csvFile };
    const csvPlan = T.wrValidatePlan(csvAction);
    ok(csvPlan.ops.length === 1 && csvPlan.ops[0].op === 'csv-import', 'csv-import op passes wrValidatePlan');
    const csvOp = csvPlan.ops[0];
    ok(csvOp && csvOp.rows.length === 3, 'all 3 rows mapped (skipIfEmpty only cuts rows with blank firstName/lastName)');
    ok(csvOp && csvOp.rows[0].firstName === 'Ann' && csvOp.rows[0].phone === '337-555-0001', 'column mapping applied correctly');
    ok(csvOp && !('Mobile' in csvOp.rows[0]), 'CSV column name (Mobile) is gone -- only app field name (phone) survives');
    const csvSkipAction = { action: 'data', title: 'Import skipping blanks', ops: [{ op: 'csv-import', entity: 'customers', mapping: { 'First Name': 'firstName', 'Last Name': 'lastName', 'Mobile': 'phone' }, skipIfEmpty: ['firstName', 'phone'] }], _csvAttached: csvFile };
    const csvSkipPlan = T.wrValidatePlan(csvSkipAction);
    const csvSkipOp = csvSkipPlan.ops[0];
    ok(csvSkipOp && csvSkipOp.rows.length === 2, 'skipIfEmpty on phone drops only Cut (empty phone) -- Ann and Bo both survive');
    // HARDENING — correctness must not depend on the model labelling every column perfectly.
    // 1) forgiving header match: model mislabels columns (case / punctuation / app-name style) and they STILL map
    const csvFuzzyAction = { action: 'data', title: 'Import with sloppy column keys', ops: [{ op: 'csv-import', entity: 'customers', mapping: { 'first name': 'firstName', 'LAST NAME': 'lastName', 'mobile': 'phone', 'E-Mail': 'email' }, skipIfEmpty: ['firstName', 'lastName'] }], _csvAttached: csvFile };
    const csvFuzzyOp = T.wrValidatePlan(csvFuzzyAction).ops[0];
    ok(csvFuzzyOp && csvFuzzyOp.rows.length === 3, 'forgiving match: sloppy-case/punctuation column keys still map all 3 rows');
    ok(csvFuzzyOp && csvFuzzyOp.rows[0].email === 'ann@x.com' && csvFuzzyOp.rows[0].phone === '337-555-0001', 'forgiving match: "E-Mail"->Email and "mobile"->Mobile resolved to the right columns');
    // 2) a genuinely unmatched column is surfaced (not silently dropped without a word)
    const csvBadColAction = { action: 'data', title: 'Import with one bad column', ops: [{ op: 'csv-import', entity: 'customers', mapping: { 'First Name': 'firstName', 'Last Name': 'lastName', 'Cell Phone Number': 'phone' }, skipIfEmpty: ['firstName', 'lastName'] }], _csvAttached: csvFile };
    const csvBadColPlan = T.wrValidatePlan(csvBadColAction);
    ok(csvBadColPlan.issues.some((s) => /Cell Phone Number/.test(s)), 'unmatched column is reported back to the user, not silently dropped');
    // 3) wrFindAttachedCsv — the live dock seam that links an action to its attached file (was stubbed before)
    const dockMsgs = [{ role: 'user', content: 'import these', files: [csvFile] }, { role: 'assistant', content: 'here you go', action: { action: 'data', ops: [{ op: 'csv-import', entity: 'customers', mapping: {} }] } }];
    ok(T.wrFindAttachedCsv(dockMsgs, 1) === csvFile, 'wrFindAttachedCsv finds the CSV attached on an earlier user message');
    ok(T.wrFindAttachedCsv(dockMsgs, 0) === null, 'wrFindAttachedCsv returns null when no earlier message holds a CSV');
    // 4) safety net: model inlined FEWER rows than the attached CSV (truncated/batched) -> loud, NO silent partial apply
    const shortInline = { action: 'data', title: 'Partial inline import', ops: [{ op: 'import', entity: 'customers', rows: [{ firstName: 'Ann', lastName: 'One' }] }], _csvAttached: csvFile };
    const shortPlan = T.wrValidatePlan(shortInline);
    ok(shortPlan.ops.length === 0, 'safety net: a 1-row inline import against a 3-row attached CSV produces NO op (no silent partial)');
    ok(shortPlan.issues.some((s) => /1 of 3 rows/.test(s)), 'safety net: surfaces "only sent 1 of 3 rows" so the user re-asks for csv-import');
    // 5) the salvage path (no CSV attached, e.g. pasted-then-truncated rows) is UNAFFECTED by the safety net
    const inlineNoCsv = { action: 'data', title: 'Plain inline import', ops: [{ op: 'import', entity: 'customers', rows: [{ firstName: 'Solo', lastName: 'Lead' }] }] };
    ok(T.wrValidatePlan(inlineNoCsv).ops.length === 1, 'safety net only fires when a CSV is attached — a plain inline import still applies');
    const custBefore = T.DATA.customers.length; const u3 = T.IDX.unit.get('U003'); const noteBefore = u3.notes, hoursBefore = u3.currentHours;
    window.JT.snapshotSaved();   // #164 baseline the diff-sync against the CURRENT data
    T.applyWranglerData(wrPlan);
    ok(T.DATA.customers.length === custBefore + 2, 'applyWranglerData added exactly the 2 imported customers');
    ok(T.IDX.unit.get('U003').notes === 'WR test note' && T.IDX.unit.get('U003').currentHours === hoursBefore, 'applied the safe note, did NOT write the money/ops field');
    // #164 — the bulk import must reach the diff-sync (it was being lost when the page
    // closed before the 1200ms debounce fired). computeChanges sees the new + updated.
    const wrDiff = window.JT.computeChanges();
    ok(wrDiff.upserts.customers && wrDiff.upserts.customers.length >= 2, 'imported customers are QUEUED for the diff-sync (persist, not just in-memory)');
    ok(wrDiff.upserts.units && wrDiff.upserts.units.some((u) => u.id === 'U003'), 'the applied unit note is queued for persistence too');
    T.DATA.customers.length = custBefore; u3.notes = noteBefore;   // restore

    // #227 — a bare "+New Rental" click must NOT leave an empty Quote in the Sheet. The
    // mock draft is held out of the §18b sync until it earns real content (a unit, a
    // customer, a window) — so abandoning it leaves zero backend junk — yet a Quote WITH
    // content still persists and survives (Wave 2). Baseline first so the draft is "new".
    window.JT.snapshotSaved();
    const q227 = { rentalId: 'R-NEW227x', customerId: null, unitId: null, categoryId: null, rentalName: 'New Quote', startDate: '', endDate: '', startTime: '', status: 'Quote', transportType: 'Self', deliveryAddress: '', po: '', invoiceId: null, startHours: null, returnHours: null, notes: '', mock: true };
    T.DATA.rentals.push(q227); T.IDX.rental.set(q227.rentalId, q227);
    const d227a = window.JT.computeChanges();
    ok(!(d227a.upserts.rentals || []).some((u) => u.id === 'R-NEW227x'), '#227: a content-free mock Quote is held OUT of the sync (a bare +New click leaves no backend junk)');
    q227.customerId = 'C0009';   // now it has real content → it must persist (Quotes survive)
    const d227b = window.JT.computeChanges();
    ok((d227b.upserts.rentals || []).some((u) => u.id === 'R-NEW227x'), '#227: once the Quote earns content (a customer) it DOES sync — content-bearing Quotes survive');
    const qi227 = T.DATA.rentals.findIndex((r) => r.rentalId === 'R-NEW227x'); if (qi227 >= 0) T.DATA.rentals.splice(qi227, 1); T.IDX.rental.delete('R-NEW227x'); window.JT.snapshotSaved();   // restore baseline

    // #152 a big import reply can be TRUNCATED by the model's output limit (no closing ```);
    // parseWranglerAction must salvage the complete rows so the preview still opens.
    const wrTrunc = '```wrangler-action\n{"action":"data","title":"Import leads","ops":[{"op":"import","entity":"customers","rows":[\n{"firstName":"Aaa","lastName":"One","phone":"337-555-0101"},\n{"firstName":"Bbb","lastName":"Two","email":"b@x.com"},\n{"firstName":"Ccc","lastName":"Tr';   // cut off mid-row, no closing fence
    const wrSal = T.parseWranglerAction(wrTrunc);
    ok(wrSal && wrSal.action === 'data' && wrSal._truncated && wrSal.ops[0].rows.length === 2, 'parseWranglerAction salvages 2 complete rows from a truncated import + flags _truncated');
    const wrFull = T.parseWranglerAction('```wrangler-action\n{"action":"data","title":"t","ops":[{"op":"import","entity":"customers","rows":[{"firstName":"Z"}]}]}\n```');
    ok(wrFull && !wrFull._truncated && wrFull.ops[0].rows.length === 1, 'a normal closed import still parses cleanly (no _truncated flag)');

    // 13) MERGE INVOICES (#64) — consolidate a customer's UNPAID bills; money-safe by construction
    const mC = 'C0009';
    const mA = { invoiceId: 'TST-KEEP', customerId: mC, rentalIds: [], date: T.TODAY_ISO, dueDate: T.TODAY_ISO, po: '', amountPaid: 0, lineItems: [{ kind: 'custom', ref: null, lid: 'LMA1', label: 'A line', amount: 100 }] };
    const mB = { invoiceId: 'TST-SRC', customerId: mC, rentalIds: [], date: T.TODAY_ISO, dueDate: T.TODAY_ISO, po: 'PO-9', amountPaid: 0, lineItems: [{ kind: 'custom', ref: null, lid: 'LMB1', label: 'B line', amount: 50 }, { kind: 'custom', ref: null, lid: 'LMB2', label: 'B line 2', amount: 25 }] };
    T.DATA.invoices.push(mA, mB); T.IDX.invoice.set(mA.invoiceId, mA); T.IDX.invoice.set(mB.invoiceId, mB);
    ok(T.invoiceMergeable(mA) && T.invoiceMergeable(mB), 'two unpaid same-customer invoices are mergeable');
    ok(!T.invoiceMergeable(T.IDX.invoice.get('01i02Ju26')), 'a PAID invoice is NOT mergeable (money guard)');
    T.mergeInvoiceInto('TST-KEEP', 'TST-SRC');
    const mKeep = T.IDX.invoice.get('TST-KEEP');
    ok(mKeep && mKeep.lineItems.length === 3, `merge folded all lines onto the keeper (3 → got ${mKeep ? mKeep.lineItems.length : 'gone'})`);
    ok(mKeep && Math.round(T.invoiceTotals(mKeep).subtotal) === 175, 'merged subtotal = 100 + 50 + 25');
    ok(!T.IDX.invoice.get('TST-SRC') && !T.DATA.invoices.some((o) => o.invoiceId === 'TST-SRC'), 'absorbed invoice deleted (IDX + array)');
    ok(mKeep && mKeep.po === 'PO-9', 'keeper inherited the absorbed PO (had none)');
    const mLids = (mKeep ? mKeep.lineItems : []).map((l) => l.lid); ok(new Set(mLids).size === mLids.length, 'merged line lids are unique (no allocation collision)');
    T.mergeInvoiceInto('TST-KEEP', '01i02Ju26');   // money guard: refuse to absorb a PAID invoice
    const mPaid = T.IDX.invoice.get('01i02Ju26');
    ok(mPaid && (Number(mPaid.amountPaid) || 0) === 1000 && mPaid.lineItems.length === 2, 'blocked merge left the PAID invoice fully intact');
    const mki = T.DATA.invoices.findIndex((o) => o.invoiceId === 'TST-KEEP'); if (mki >= 0) T.DATA.invoices.splice(mki, 1); T.IDX.invoice.delete('TST-KEEP');   // restore

    // 13) photo backdrops — customer Account selfie + open Work Order first-photo
    ok(T.latestCustomerSelfie(null) === '' && T.latestCustomerSelfie({}) === '', 'latestCustomerSelfie: no customer / no cards → empty');
    ok(T.latestCustomerSelfie({ selfie: 'data:legacy' }) === 'data:legacy', 'latestCustomerSelfie: legacy c.selfie fallback');
    const lcsCust = { cards: [{ status: 'active', agreements: [
      { key: 'rental', signedAt: '2026-01-01', selfie: 'data:old' },
      { key: 'rental', signedAt: '2026-05-01', driveSelfieUrl: 'https://drive/new.jpg', selfie: 'data:new' } ] }] };
    ok(T.latestCustomerSelfie(lcsCust) === 'https://drive/new.jpg', 'latestCustomerSelfie: newest signing wins + prefers the Drive URL over base64');
    const lcsTwoCards = { cards: [
      { status: 'active', agreements: [{ key: 'rental', signedAt: '2026-06-10', driveSelfieUrl: 'https://drive/A.jpg' }] },
      { status: 'active', agreements: [{ key: 'rental', signedAt: '2026-02-01', driveSelfieUrl: 'https://drive/B.jpg' }] } ] };
    ok(T.latestCustomerSelfie(lcsTwoCards) === 'https://drive/A.jpg', 'latestCustomerSelfie: newest across multiple cards');
    ok(T.woBackdrop(null) === '' && T.woBackdrop({ phase: 'Part Needed' }) === '', 'woBackdrop: nothing / no photo → empty');
    ok(T.woBackdrop({ phase: 'Part Needed', lineItems: [{}, { photo: 'data:part' }] }) === 'data:part', 'woBackdrop: first part-line photo');
    const wbInsp = { phase: 'Part Needed', inspectionId: 'INS-2', lineItems: [{ photo: 'data:part' }] };
    ok(T.woBackdrop(wbInsp) === (T.IDX.insp.get('INS-2')?.photo || ''), 'woBackdrop: linked failed-inspection photo wins over the part photo');
    ok(T.woBackdrop({ phase: 'Complete', inspectionId: 'INS-2', lineItems: [{ photo: 'data:part' }] }) === '', 'woBackdrop: dropped once the WO is Complete');

    // 14) photo offload to Drive (de-bloat) — swap logic via an injected uploader stub
    const okUp = async (p) => ({ ok: true, url: 'https://drive/' + p.name });
    const failUp = async () => ({ ok: false });
    const recA = { photo: 'data:image/jpeg;base64,AAA' };
    ok((await T.offloadPhotoNow(recA, 'photo', 'n1', null, null, okUp)) === true && recA.photo === 'https://drive/n1', 'offloadPhotoNow: base64 → Drive URL on ok');
    ok((await T.offloadPhotoNow(recA, 'photo', 'n1', null, null, okUp)) === false && recA.photo === 'https://drive/n1', 'offloadPhotoNow: idempotent — a URL is a no-op');
    const recB = { photo: 'data:image/jpeg;base64,BBB' };
    ok((await T.offloadPhotoNow(recB, 'photo', 'n2', null, null, failUp)) === false && recB.photo === 'data:image/jpeg;base64,BBB', 'offloadPhotoNow: failed upload leaves base64 untouched (never lose a photo)');
    ok((await T.offloadPhotoNow({ photo: '' }, 'photo', 'n3', null, null, okUp)) === false, 'offloadPhotoNow: empty → no-op');
    const recD = { photo: 'data:image/jpeg;base64,DDD' };
    const staleUp = async () => { recD.photo = 'data:image/jpeg;base64,NEW'; return { ok: true, url: 'https://drive/stale' }; };   // re-captured mid-flight
    ok((await T.offloadPhotoNow(recD, 'photo', 'n4', null, null, staleUp)) === false && recD.photo === 'data:image/jpeg;base64,NEW', 'offloadPhotoNow: stale-guard — a mid-flight re-capture is not clobbered');
    // base64PhotoTargets — counts only data: photos (inspections + nested WO line items), idempotent after a pass
    const beforeT = T.base64PhotoTargets().length;
    const insX = { inspectionId: 'INS-OFFLOAD', photo: 'data:image/jpeg;base64,III' };
    T.DATA.inspections.push(insX); T.IDX.insp.set('INS-OFFLOAD', insX);
    const woX = { woId: 'WO-OFFLOAD', lineItems: [{ photo: 'data:image/jpeg;base64,LLL', lid: 'LX' }, { photo: 'https://drive/already.jpg' }, {}] };
    T.DATA.workOrders.push(woX); T.IDX.wo.set('WO-OFFLOAD', woX);
    ok(T.base64PhotoTargets().length === beforeT + 2, 'base64PhotoTargets: counts the new inspection + the one base64 line (skips the URL line + the photoless line)');
    for (const job of T.base64PhotoTargets()) await T.offloadPhotoNow(job.t, 'photo', job.name, job.owner, job.coll, okUp);
    ok(T.base64PhotoTargets().length === 0, 'base64PhotoTargets: empty after a full offload pass (idempotent)');
    T.DATA.inspections.pop(); T.IDX.insp.delete('INS-OFFLOAD'); T.DATA.workOrders.pop(); T.IDX.wo.delete('WO-OFFLOAD');   // restore

    // 15) wrStore — the IndexedDB layer for the Wrangler rail (real round-trips)
    const S = T.wrStore;
    const chat = { id: 'wc-test-1', title: 'hi', ts: 1, messages: [{ role: 'user', content: 'yo', images: [{ blobKey: 'b_wc-test-1_0' }] }] };
    await S.putChat(chat);
    const got = await S.getChat('wc-test-1');
    ok(got && got.id === 'wc-test-1' && got.messages[0].images[0].blobKey === 'b_wc-test-1_0', 'wrStore: putChat/getChat round-trip keeps the message ref');
    const listed = await S.listChats();
    ok(Array.isArray(listed) && listed.some((c) => c.id === 'wc-test-1'), 'wrStore: listChats returns the stored chat');
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
    await S.putBlob('b_wc-test-1_0', blob);
    const gotBlob = await S.getBlob('b_wc-test-1_0');
    ok(gotBlob instanceof Blob && gotBlob.size === 4, 'wrStore: putBlob/getBlob round-trip returns the Blob (binary, not base64)');
    await S.delBlob('b_wc-test-1_0');
    ok((await S.getBlob('b_wc-test-1_0')) === undefined, 'wrStore: delBlob removes the blob');
    await S.delChat('wc-test-1');
    ok((await S.getChat('wc-test-1')) === undefined, 'wrStore: delChat removes the chat');
    const est = await S.estimate();
    ok(est && typeof est.usage === 'number' && typeof est.quota === 'number', 'wrStore: estimate() returns usage/quota numbers');

    // 16) Drive offload + eviction for the Wrangler store (the size guarantee)
    const wrUp = async (p) => ({ ok: true, url: 'https://drive/' + encodeURIComponent(p.name) });
    const ob = new Blob([new Uint8Array([9, 9, 9, 9, 9])], { type: 'image/png' });
    await S.putBlob('b_wc-off_0', ob);
    const offChat = { id: 'wc-off', ts: 2, messages: [{ role: 'user', content: 'x', images: [{ blobKey: 'b_wc-off_0' }] }] };
    await S.putChat(offChat);
    const did = await T.wrOffloadChatImages(offChat, wrUp);
    ok(did === true && offChat.messages[0].images[0].driveUrl && !offChat.messages[0].images[0].blobKey, 'wrOffloadChatImages: un-synced blob → Drive URL set, local blobKey cleared');
    ok((await S.getBlob('b_wc-off_0')) === undefined, 'wrOffloadChatImages: local blob dropped after offload (re-fetchable from driveUrl)');
    ok((await T.wrOffloadChatImages(offChat, wrUp)) === false, 'wrOffloadChatImages: idempotent — a synced chat is a no-op');
    // eviction: a synced blob is a safe cache drop; an un-synced one needs unsyncedOk
    await S.putBlob('b_wc-ev_0', ob); await S.putBlob('b_wc-ev_1', ob);
    const evChat = { id: 'wc-ev', ts: 3, messages: [{ role: 'user', content: 'y', images: [{ blobKey: 'b_wc-ev_0', driveUrl: 'https://drive/x' }, { blobKey: 'b_wc-ev_1' }] }] };
    ok((await T.wrEvictChatBlobs(evChat, false)) === 1, 'wrEvictChatBlobs: drops only the synced blob when unsyncedOk=false (text untouched)');
    ok(evChat.messages[0].content === 'y' && evChat.messages[0].images.length === 2, 'wrEvictChatBlobs: message text + refs preserved — only the local blob is freed');
    ok((await T.wrEvictChatBlobs(evChat, true)) === 1, 'wrEvictChatBlobs: drops the un-synced blob only as a last resort (unsyncedOk=true)');
    await S.delChat('wc-off'); await S.delChat('wc-ev');

    // 17) driveViewUrl — uploadCapture's file-view page → an embeddable <img> URL via fileId
    ok(T.driveViewUrl({ ok: true, url: 'https://drive.google.com/file/d/FID/view', fileId: 'FID' }) === 'https://drive.google.com/uc?export=view&id=FID', 'driveViewUrl: builds the embeddable uc?export=view form from fileId');
    ok(T.driveViewUrl({ ok: true, url: 'https://x/y' }) === 'https://x/y', 'driveViewUrl: falls back to res.url when no fileId');
    ok(T.driveViewUrl(null) === '' && T.driveViewUrl({}) === '', 'driveViewUrl: empty when nothing usable');
    // integration: an offload that returns a fileId stores the EMBEDDABLE url (not the file-view page)
    const fidUp = async (p) => ({ ok: true, url: 'https://drive.google.com/file/d/Z9/view', fileId: 'Z9' });
    const recE = { photo: 'data:image/jpeg;base64,EEE' };
    await T.offloadPhotoNow(recE, 'photo', 'ne', null, null, fidUp);
    ok(recE.photo === 'https://drive.google.com/uc?export=view&id=Z9', 'offloadPhotoNow: stores the embeddable Drive URL when the backend returns a fileId');

    // 18) cross-device Wrangler rail merge — union by id, newest ts wins, localAhead
    const A = { id: 'a', ts: 10 }, A2 = { id: 'a', ts: 20 }, B = { id: 'b', ts: 5 }, C = { id: 'c', ts: 7 };
    let m = T.mergeWranglerRails([A], [B]);
    ok(m.merged.length === 2 && m.changed === true && m.localAhead === true, 'mergeWranglerRails: remote-only chat added (changed), local-only chat flags localAhead');
    m = T.mergeWranglerRails([A], [A2]);
    ok(m.merged.find((c) => c.id === 'a').ts === 20 && m.changed === true && m.localAhead === false, 'mergeWranglerRails: remote newer ts wins');
    m = T.mergeWranglerRails([A2], [A]);
    ok(m.merged.find((c) => c.id === 'a').ts === 20 && m.changed === false && m.localAhead === true, 'mergeWranglerRails: local newer ts kept + flags localAhead');
    m = T.mergeWranglerRails([A2, C], [A2, C]);
    ok(m.changed === false && m.localAhead === false, 'mergeWranglerRails: identical rails → no change, not ahead');
    m = T.mergeWranglerRails([], [C, B]);
    ok(m.merged.map((c) => c.id).join(',') === 'c,b' && m.changed === true, 'mergeWranglerRails: empty local → adopts remote, sorted newest-first');

    // 19) KPIs & RINGS — admin-definable metric engine (step 1: defaults === today + DSL correctness)
    const ROLE_IDS = ['mechanic', 'mtech', 'driver', 'office', 'sales'];
    let kpiMatch = true, kpiRawMatch = true;
    ROLE_IDS.forEach((id) => {
      if (JSON.stringify(T.kpiFor(id)) !== JSON.stringify(T.legacyKpiPct(id))) kpiMatch = false;
      const nr = T.kpiRaw(id).map((m) => [m.v, m.unit]), or = T.legacyKpiRaw(id).map((m) => [m.v, m.unit]);
      if (JSON.stringify(nr) !== JSON.stringify(or)) kpiRawMatch = false;
    });
    ok(kpiMatch, 'KPI defaults reproduce legacy kpiFor for all 5 roles (no dashboard regression)');
    ok(kpiRawMatch, 'KPI raw numerators reproduce legacy kpiRaw for all 5 roles (gamification unchanged)');
    ok(T.kpiFor('driver')[2] === null && T.kpiFor('office')[2] === null, 'GPS/email placeholder rings stay null (not coerced to 0)');
    // DSL engine — synthetic specs computed over live demo data
    const kUnits = T.DATA.units, kWos = T.DATA.workOrders;
    const readyN = kUnits.filter((u) => u.inspectionStatus === 'Ready').length;
    const ce = T.kpiEval({ metric: { kind: 'count', src: { entity: 'units', where: [{ f: 'inspectionStatus', op: 'eq', v: 'Ready' }] } } });
    ok(ce.raw === readyN && ce.pct === Math.round(readyN / kUnits.length * 100), `count kind: Ready units (${ce.raw}) ÷ fleet → ${ce.pct}%`);
    const compN = kWos.filter((w) => w.phase === 'Complete').length, liveN = kWos.filter((w) => !w.cancelled).length;
    const re = T.kpiEval({ metric: { kind: 'ratio', num: { entity: 'workOrders', where: [{ f: 'phase', op: 'eq', v: 'Complete' }], agg: 'count' }, den: { entity: 'workOrders', where: [{ f: 'cancelled', op: 'ne', v: true }], agg: 'count' } } });
    ok(re.raw === compN && re.pct === (liveN > 0 ? Math.round(compN / liveN * 100) : 0), `ratio kind: Complete (${compN}) ÷ live WOs (${liveN}) → ${re.pct}%`);
    const totalPaid = T.DATA.invoices.reduce((a, i) => a + T.invoiceTotals(i).paid, 0);
    const ge = T.kpiEval({ target: 1000000, metric: { kind: 'goal', src: { entity: 'invoices', agg: 'sum', field: '_paid' } } });
    ok(ge.raw === totalPaid && ge.unit === '$', `goal kind: collected $${ge.raw} sums via the _paid derived field`);
    ok(T.kpiEval({ band: 'down', metric: { kind: 'count', src: { entity: 'units', where: [{ f: 'inspectionStatus', op: 'eq', v: 'Ready' }] } } }).pct === 100 - ce.pct, 'band:down inverts the ring fill (lower-is-better)');
    ok(T.kpiEval({ metric: { kind: 'ratio', num: { entity: 'NOPE' } } }).pct === 0, 'malformed metric → safe 0 ring (never throws)');

    // 20) Mr. Wrangler KPI authoring — validate + lock-in write path
    const goodKpi = { action: 'kpi', role: 'mechanic', ring: 1, label: 'WO ≤ 2 days', band: 'up', unit: '%',
      metric: { kind: 'ratio', num: { entity: 'workOrders', where: [{ f: 'phase', op: 'eq', v: 'Complete' }, { f: '_ageDays', op: 'lte', v: 2 }], agg: 'count' }, den: { entity: 'workOrders', where: [{ f: 'cancelled', op: 'ne', v: true }], agg: 'count' } } };
    const gv = T.wrValidateKpi(goodKpi);
    ok(gv.ok && typeof gv.value === 'number' && gv.idx === 1, `wrValidateKpi accepts a sound cross-field ratio (live ${gv.value}%)`);
    const badField = T.wrValidateKpi({ action: 'kpi', role: 'mechanic', ring: 1, target: 5, metric: { kind: 'goal', src: { entity: 'units', where: [{ f: 'currentHours', op: 'gt', v: 0 }] } } });
    ok(!badField.ok && badField.issues.some((s) => /currentHours/.test(s)), 'wrValidateKpi rejects a non-allowlisted field (currentHours — money/ops fields stay off-limits)');
    ok(!T.wrValidateKpi({ action: 'kpi', role: 'nope', ring: 9, metric: { kind: 'bogus' } }).ok, 'wrValidateKpi rejects bad role / ring / kind');
    // lock-in write path: a non-trivial custom ring flows through roleRings → kpiFor
    const nz = T.wrValidateKpi({ action: 'kpi', role: 'mechanic', ring: 1, label: 'WO done rate', band: 'up',
      metric: { kind: 'ratio', num: { entity: 'workOrders', where: [{ f: 'phase', op: 'eq', v: 'Complete' }], agg: 'count' }, den: { entity: 'workOrders', where: [{ f: 'cancelled', op: 'ne', v: true }], agg: 'count' } } });
    const st = T.__state; const savedKpis = st.settings.kpis;
    st.settings.kpis = { mechanic: JSON.parse(JSON.stringify(T.KPI_DEFAULTS.mechanic)) };
    st.settings.kpis.mechanic[1] = nz.ring;
    const overridden = T.kpiFor('mechanic')[1];
    ok(nz.value > 0 && overridden === nz.value, `kpiFor reflects a locked-in custom ring (${overridden}%, ≠ default)`);
    st.settings.kpis = savedKpis;   // restore
    ok(JSON.stringify(T.kpiFor('mechanic')) === JSON.stringify(T.legacyKpiPct('mechanic')), 'removing the override restores the default ring');

    // 21) Company tab — identity read-through with shipped fallbacks; revenue goal feeds the Sales ring
    const savedCo = st.settings.company;
    ok(T.companyRevenueGoal() === 150000 && T.companyName() === 'JacRentals', 'company helpers fall back to the shipped defaults when unset');
    st.settings.company = { name: 'Bayou Iron', tagline: 'Diggers & Dozers', revenueGoal: 222000 };
    ok(T.companyRevenueGoal() === 222000 && T.companyName() === 'Bayou Iron' && T.companyTagline() === 'Diggers & Dozers', 'company override is read back');
    const salesGoalHi = T.kpiFor('sales')[0];
    st.settings.company = { revenueGoal: 1 };
    const salesGoalLo = T.kpiFor('sales')[0];
    ok(salesGoalLo >= salesGoalHi, `Sales Revenue Goal ring tracks the company goal (goal=1 → ${salesGoalLo}% ≥ goal=222k → ${salesGoalHi}%)`);
    st.settings.company = savedCo;   // restore
    ok(JSON.stringify(T.kpiFor('sales')) === JSON.stringify(T.legacyKpiPct('sales')), 'no company override → Sales ring matches the shipped default (150k)');

    // 22) Rental Rules — hard-block On Rent (default Off = zero change; pure rentalRuleBlock)
    const savedRules = st.settings.rentalRules;
    st.settings.rentalRules = {};
    ok(T.rentalRuleBlock({ invoiceId: null }, { name: 'X' }, 'On Rent') === null, 'no rules set → On Rent never blocked (regression-safe default)');
    st.settings.rentalRules = { signature: 'required' };
    ok(T.rentalRuleBlock({}, { name: 'X' }, 'Reserved') === null, 'rules gate ONLY On Rent (Reserved passes)');
    ok(/sign/i.test(T.rentalRuleBlock({}, { name: 'X' }, 'On Rent') || ''), 'signature Required + no signature → On Rent blocked');
    ok(T.rentalRuleBlock({}, { name: 'X', signature: 'data:sig' }, 'On Rent') === null, 'signature Required + signature on file → allowed');
    st.settings.rentalRules = { card: 'required' };
    ok(/card/i.test(T.rentalRuleBlock({}, { name: 'X' }, 'On Rent') || ''), 'card Required + no card → On Rent blocked (true hard stop)');
    st.settings.rentalRules = { po: 'required' };
    ok(/PO/.test(T.rentalRuleBlock({ invoiceId: null }, { name: 'X' }, 'On Rent') || ''), 'PO Required + no invoice/PO → On Rent blocked');
    const poInv = T.DATA.invoices.find((i) => i.po);
    if (poInv) ok(T.rentalRuleBlock({ invoiceId: poInv.invoiceId }, { name: 'X' }, 'On Rent') === null, 'PO Required + invoice carries a PO → allowed');
    st.settings.rentalRules = { id: 'required' };
    ok(/ID/i.test(T.rentalRuleBlock({}, { name: 'X' }, 'On Rent') || '') && T.rentalRuleBlock({}, { name: 'X', idNumber: 'LA-12345' }, 'On Rent') === null, 'ID Required: blocks without an ID #, allows with one');
    st.settings.rentalRules = { terms: 'required' };
    ok(T.rentalRuleBlock({}, { name: 'X' }, 'On Rent') === null && T.rentalRuleBlock({}, { name: 'X', netDays: 0 }, 'On Rent') === null && /terms/i.test(T.rentalRuleBlock({}, { name: 'X', netDays: 'abc' }, 'On Rent') || ''), 'Payment-terms Required: blank Net days counts as COD (passes), 0 passes, only a non-numeric value blocks');
    st.settings.rentalRules = savedRules;   // restore

    // 23) Net-days terms → invoice due date, capped by the system max (Settings → Company)
    const tc = T.DATA.customers[0]; const savedNd = tc.netDays; const savedCo2 = st.settings.company;
    st.settings.company = { maxNetDays: 30 };
    tc.netDays = undefined; ok(T.dueForCustomer(tc.customerId) > T.TODAY_ISO, 'no terms → the shipped 14-day default, unchanged');
    const due14b = T.dueForCustomer(tc.customerId);
    tc.netDays = 0; ok(T.dueForCustomer(tc.customerId) === T.TODAY_ISO, 'Net 0 → due today (COD)');
    tc.netDays = 30; const due30b = T.dueForCustomer(tc.customerId); ok(due30b > due14b, `Net 30 → later due date than the 14-day default (${due30b})`);
    tc.netDays = 999; const dueCap = T.dueForCustomer(tc.customerId); ok(dueCap === due30b, `customer Net 999 is CAPPED at the system max of 30 (${dueCap})`);
    st.settings.company = { maxNetDays: 60 }; const dueCap60 = T.dueForCustomer(tc.customerId); ok(dueCap60 > due30b, 'raising the system max to 60 lets the same Net 999 customer go further out');
    tc.netDays = savedNd; st.settings.company = savedCo2;   // restore

    // 25) Custom Fields — admin-defined fields per entity (default none = forms unchanged)
    const savedCF = st.settings.customFields;
    st.settings.customFields = undefined;
    ok(T.customFieldsFor('customers').length === 0, 'no custom fields configured → none on any form (default)');
    st.settings.customFields = { customers: [{ id: 'cf_tax_id_ab12', label: 'Tax-exempt #', type: 'text', required: true }] };
    const cf = T.customFieldsFor('customers');
    ok(cf.length === 1 && cf[0].required && cf[0].id === 'cf_tax_id_ab12', 'a defined custom field reads back with its type/required');
    ok(T.customFieldsFor('units').length === 0, 'custom fields are per-entity (units unaffected)');
    st.settings.customFields = savedCF;   // restore

    // 26) Inspections — required checklist keyed by EQUIPMENT FAMILY (default none = quick toggles unchanged)
    const savedInsp = st.settings.inspections;
    const aUnit = T.DATA.units[0]; const aKey = T.inspKeyOfCat(aUnit.categoryId);
    st.settings.inspections = undefined;
    ok(T.checklistFor(aUnit) === null && T.checklistRequired(aUnit) === false, 'no checklist config → unit uses the quick Pass/Fail toggles (default)');
    st.settings.inspections = { [aKey]: { required: true, items: [{ id: 'ck_brakes_a1', label: 'Brakes' }, { id: 'ck_lights_b2', label: 'Lights' }] } };
    ok(T.checklistRequired(aUnit) === true && T.checklistFor(aUnit).items.length === 2, 'a required checklist is picked up for units of that family');
    const otherUnit = T.DATA.units.find((u) => T.inspKeyOfCat(u.categoryId) !== aKey);
    if (otherUnit) ok(T.checklistRequired(otherUnit) === false, 'checklists are per-family (other families unaffected)');
    const sibUnit = T.DATA.units.find((u) => u.categoryId !== aUnit.categoryId && T.inspKeyOfCat(u.categoryId) === aKey);
    if (sibUnit) ok(T.checklistRequired(sibUnit) === true && (T.checklistFor(sibUnit) || {}).items.length === 2, 'a sibling category in the same family SHARES the checklist');
    st.settings.inspections = { [aKey]: { required: false, items: [{ id: 'ck_x', label: 'X' }] } };
    ok(T.checklistRequired(aUnit) === false && T.checklistFor(aUnit) !== null, 'a defined-but-not-required checklist is available but does not take over');
    st.settings.inspections = savedInsp;   // restore

    // 26b) Fail-condition model (Jac 2026-06-26) — per-type fail predicate + all-required gate
    const F = T.inspItemFails, U = T.inspItemUnanswered;
    // toggle: legacy (no it.fail) still fails on 'Fail'; inverted fails on 'Pass'
    ok(F({ type: 'toggle' }, 'Fail') === true && F({ type: 'toggle' }, 'Pass') === false, 'toggle (legacy, no fail cfg) → fails on Fail, passes on Pass');
    ok(F({ type: 'toggle', fail: { failWhen: 'pass' } }, 'Pass') === true && F({ type: 'toggle', fail: { failWhen: 'pass' } }, 'Fail') === false, 'toggle inverted → Pass trips the fail');
    // a bare item (no type) reads as toggle — the 21 default families are unaffected
    ok(F({}, 'Fail') === true && F({}, 'Pass') === false, 'typeless item reads as toggle (default families unchanged)');
    // number: above / below / outside / inside
    ok(F({ type: 'number', fail: { op: 'above', a: 100 } }, '120') === true && F({ type: 'number', fail: { op: 'above', a: 100 } }, '80') === false, 'number above → fails when value > a');
    ok(F({ type: 'number', fail: { op: 'below', a: 30 } }, '20') === true && F({ type: 'number', fail: { op: 'below', a: 30 } }, '40') === false, 'number below → fails when value < a');
    ok(F({ type: 'number', fail: { op: 'outside', a: 10, b: 20 } }, '25') === true && F({ type: 'number', fail: { op: 'outside', a: 10, b: 20 } }, '15') === false, 'number outside → fails when value outside [a,b]');
    ok(F({ type: 'number', fail: { op: 'inside', a: 10, b: 20 } }, '15') === true && F({ type: 'number', fail: { op: 'inside', a: 10, b: 20 } }, '25') === false, 'number inside → fails when value inside [a,b]');
    ok(F({ type: 'number', fail: { op: 'above', a: 100 } }, '') === false && F({ type: 'number', fail: { op: 'none' } }, '5') === false, 'number → blank or op:none never fails');
    // date: before / after a ref (today by default)
    ok(F({ type: 'date', fail: { op: 'before', ref: '2026-06-26' } }, '2026-06-01') === true && F({ type: 'date', fail: { op: 'before', ref: '2026-06-26' } }, '2026-07-01') === false, 'date before → fails when date < ref (expiry)');
    ok(F({ type: 'date', fail: { op: 'after', ref: '2026-06-26' } }, '2026-07-01') === true, 'date after → fails when date > ref');
    // text: empty / contains
    ok(F({ type: 'text', fail: { op: 'empty' } }, '') === true && F({ type: 'text', fail: { op: 'empty' } }, 'ok') === false, 'text empty → fails when blank');
    ok(F({ type: 'text', fail: { op: 'contains', value: 'crack' } }, 'hairline CRACK seen') === true && F({ type: 'text', fail: { op: 'none' } }, 'x') === false, 'text contains → case-insensitive match; op:none never fails');
    // select: per-option fail (unchanged)
    ok(F({ type: 'select', options: [{ label: 'Bald', fail: true }, { label: 'OK' }] }, 'Bald') === true && F({ type: 'select', options: [{ label: 'Bald', fail: true }, { label: 'OK' }] }, 'OK') === false, 'select → fails when chosen option flagged fail');
    // all-required gate — every type must be answered (the Optional path is gone)
    ok(U({ type: 'toggle' }, '') === true && U({ type: 'toggle' }, 'Pass') === false, 'gate: toggle must be picked');
    ok(U({ type: 'number' }, '') === true && U({ type: 'number' }, '5') === false, 'gate: number must be filled (no more optional)');
    ok(U({ type: 'file' }, '') === true && U({ type: 'file' }, 'data:...') === false, 'gate: file must be attached');
    ok(U({ type: 'text', required: false }, '') === true, 'gate: legacy required:false is ignored — all fields required now');
    // evidence gate — failphoto requires a photo only when the item currently fails
    const EM = T.inspEvidenceMissing;
    ok(EM({ type: 'toggle', evidence: 'failphoto' }, 'Fail', []) === true && EM({ type: 'toggle', evidence: 'failphoto' }, 'Fail', [{ url: 'x' }]) === false, 'evidence: failphoto blocks a Fail with no photo, clears once attached');
    ok(EM({ type: 'toggle', evidence: 'failphoto' }, 'Pass', []) === false, 'evidence: failphoto does NOT block a passing item');
    ok(EM({ type: 'number', evidence: 'failphoto', fail: { op: 'below', a: 30 } }, '20', []) === true, 'evidence: failphoto keys off the generalized fail (number below trips it)');
    ok(EM({ type: 'toggle', evidence: 'always' }, 'Pass', []) === true && EM({ type: 'toggle', evidence: 'optional' }, 'Fail', []) === false && EM({ type: 'toggle' }, 'Fail', []) === false, 'evidence: always needs a photo regardless; optional/none never block');

    // 27) Reversibility — a corrupt customization must self-heal, never brick the app
    const savedAll = st.settings;
    st.settings = { status: { rentalStatus: 'this-is-not-an-object-it-is-garbage' } };   // malformed
    let threw = false; try { T.applySettings(st.settings); } catch (e) { threw = true; }
    ok(!threw, 'applySettings never throws on a corrupt settings object');
    ok(T.getStatus('rentalStatus', 'On Rent').label === 'On Rent', 'after a corrupt apply, the status registry is back to its shipped default');
    st.settings = savedAll; T.applySettings(st.settings);   // restore + re-apply clean
    ok(JSON.stringify(T.kpiFor('mechanic')) === JSON.stringify(T.legacyKpiPct('mechanic')), 'clean settings re-apply leaves the dashboard at defaults');

    // 28) Per-tab "Reset page" — each tab maps to its own slice + a defaults value
    ok(T.pageDefaultSlice('statuses').key === 'status' && T.pageDefaultSlice('kpis').key === 'kpis', 'each tab resets only its own settings slice');
    const cfReset = T.pageDefaultSlice('fields').value;
    ok(Array.isArray(cfReset.customers) && cfReset.customers.length === 0 && Array.isArray(cfReset.units), 'Reset page (Custom Fields) empties every entity, not just the active one');
    ok(T.pageDefaultSlice('logins') === null && T.pageDefaultSlice('notifications') === null, 'tabs with no settings slice (Logins/planned) have no Reset page');

    // 29) §5.4d DATE SEARCH — overlap (rentals), point-in-range (dated cards), invoice
    //     either/or, no-op on date-less cards, negation — all through the real matchers.
    const rA = T.IDX.rental.get('R-A');   // window 2026-06-02 → 2026-06-12
    ok(T.dateTermHits('rentals', rA, '2026-06-05') === true, 'date: a single day inside the rental window hits (overlap)');
    ok(T.dateTermHits('rentals', rA, '2026-06-20') === false, 'date: a day outside the window misses');
    ok(T.dateTermHits('rentals', rA, '2026-06-10..2026-06-30') === true, 'date: a range overlapping the tail of the window hits');
    ok(T.dateTermHits('rentals', rA, '2026-06-13..2026-06-30') === false, 'date: a range starting after the window ends misses');
    ok(T.dateTermHits('rentals', rA, '2026-05-01..2026-12-31') === true, 'date: a range that fully contains the window hits (overlap, not containment)');
    const rB = T.IDX.rental.get('R-B');   // window 2026-06-15 → 2026-06-22 (extends past the query range)
    ok(T.dateTermHits('rentals', rB, '2026-06-18..2026-06-20') === true, 'date: a rental spanning PAST the searched range still hits (Jac: overlapping)');
    const iv = T.IDX.invoice.get('01i02Ju26');   // issued 2026-06-02, due 2026-06-16
    ok(T.dateTermHits('invoices', iv, '2026-06-02') === true, 'date: an invoice matches on its ISSUED date');
    ok(T.dateTermHits('invoices', iv, '2026-06-16') === true, 'date: an invoice matches on its DUE date too (either/or, per Jac)');
    ok(T.dateTermHits('invoices', iv, '2026-06-09') === false, 'date: a day between issued and due (matching neither) misses');
    const insp = T.IDX.insp.get('INS-1');   // dated 2026-06-01
    ok(T.dateTermHits('inspections', insp, '2026-05-30..2026-06-03') === true && T.dateTermHits('inspections', insp, '2026-06-02') === false, 'date: a point-dated card matches its own date within range only');
    const file = (T.DATA.files || []).find((f) => f.reviewByDate);
    if (file) ok(T.dateTermHits('files', file, file.reviewByDate) === true, 'date: a company file matches its review-by date');
    // integration through rowMatches — no-op on date-less cards + negation
    const aUnit2 = T.DATA.units[0];
    const dPos = [{ col: '__date', value: '2026-06-05', neg: false }];
    ok(T.rowMatches('units', aUnit2, '', dPos) === true, 'date: a date filter is a NO-OP on date-less cards (units stay shown)');
    ok(T.rowMatches('rentals', rA, '', dPos) === true && T.rowMatches('rentals', rB, '', dPos) === false, 'date: rowMatches keeps the overlapping rental, drops the non-overlapping one');
    const dNeg = [{ col: '__date', value: '2026-06-05', neg: true }];
    ok(T.rowMatches('rentals', rA, '', dNeg) === false && T.rowMatches('rentals', rB, '', dNeg) === true, 'date: a NEGATED date filter excludes the match and keeps the rest');
    ok(T.rowMatches('units', aUnit2, '', dNeg) === true, 'date: a NEGATED date filter is STILL a no-op on date-less cards (never excluded)');

    // 30) RENTAL EXTENSIONS — re-price the lengthened window, bill only the delta as additive
    //     'extension' line(s); positive only; composes across repeats; never touches paid lines.
    {
      const priceFor = (catId, s, e) => { const p = T.rentalPrice({ categoryId: catId, startDate: s, endDate: e, customerId: 'C0009' }); return p ? p.price : 0; };
      const S0 = '2099-06-01', E0 = '2099-06-06', E1 = '2099-06-13', E2 = '2099-06-20';   // 5d → 12d → 19d
      // pick two Active units whose category actually PRICES (and prices higher for a longer window)
      const priced = af.filter((u) => priceFor(u.categoryId, S0, E1) > priceFor(u.categoryId, S0, E0) && priceFor(u.categoryId, S0, E0) > 0);
      const exU = priced[0], exV = priced[1];
      ok(!!exU && !!exV, 'two priced Active units available for the extension fixture');
      const rX = { rentalId: 'R-EXTTEST', customerId: 'C0009', unitId: exU.unitId, categoryId: exU.categoryId, startDate: S0, endDate: E0, startTime: '', status: 'On Rent', transportType: 'Self', deliveryAddress: '', transportMiles: null, invoiceId: null, units: [mk(exU), mk(exV)].map((u) => ({ ...u, transportType: 'Self', transportMiles: null })), notes: '', actions: [], mock: true };
      T.DATA.rentals.push(rX); T.IDX.rental.set('R-EXTTEST', rX);
      const invX = { invoiceId: 'I-EXTTEST', customerId: 'C0009', rentalIds: ['R-EXTTEST'], date: T.TODAY_ISO, dueDate: T.TODAY_ISO, po: '', amountPaid: 0, lineItems: [], mock: true };
      T.rentalLineItems(rX).forEach((li) => invX.lineItems.push(li));
      invX.covOf = 'R-EXTTEST'; invX.covStart = S0; invX.covEnd = E0;   // §28cap chunk bounds (≤28-day window)
      T.DATA.invoices.push(invX); T.IDX.invoice.set('I-EXTTEST', invX); rX.invoiceId = 'I-EXTTEST';
      const extLines = () => invX.lineItems.filter((l) => l.kind === 'extension');
      const billedUnit = (uId) => invX.lineItems.filter((l) => l.unitId === uId && (l.kind === 'rental' || l.kind === 'extension')).reduce((a, l) => a + (+l.amount || 0), 0);

      // preview is pure (no mutation) and matches the real per-unit price delta
      const expDeltaU = Math.round((priceFor(exU.categoryId, S0, E1) - priceFor(exU.categoryId, S0, E0)) * 100) / 100;
      const expDeltaV = Math.round((priceFor(exV.categoryId, S0, E1) - priceFor(exV.categoryId, S0, E0)) * 100) / 100;
      const pv = T.extensionPreview(rX, S0, E1);
      const linesBeforePv = invX.lineItems.length;
      ok(pv && Math.abs(pv.subtotalDelta - (expDeltaU + expDeltaV)) < 0.01, `extensionPreview delta = Σ per-unit re-price (${pv ? pv.subtotalDelta : 'null'})`);
      ok(invX.lineItems.length === linesBeforePv, 'extensionPreview is PURE — adds no line items');
      ok(pv && Math.abs(pv.taxDelta - Math.round(pv.subtotalDelta * 0.1075 * 100) / 100) < 0.01, 'extensionPreview taxes the delta at 10.75%');

      // commit the 5→12 extension → one extension line per unit, equal to the re-price delta
      rX.endDate = E1; const e1 = T.billExtension(rX, E0);
      ok(e1 && e1.count === 2 && Math.abs(e1.subtotalDelta - (expDeltaU + expDeltaV)) < 0.01, `billExtension 5→12 adds 2 lines (+$${e1 ? e1.subtotalDelta : '?'})`);
      ok(Math.abs(billedUnit(exU.unitId) - priceFor(exU.categoryId, S0, E1)) < 0.01, 'after extension, unit total billed == full re-priced window (no double-count)');

      // second extension 12→19 composes: diffs against rental + the first extension line
      rX.endDate = E2; const e2 = T.billExtension(rX, E1);
      ok(e2 && Math.abs(billedUnit(exU.unitId) - priceFor(exU.categoryId, S0, E2)) < 0.01, 'repeat extension 12→19 composes — billed == full 19-day window, no double-count');
      ok(extLines().length === 0 && Math.abs(billedUnit(exV.unitId) - priceFor(exV.categoryId, S0, E2)) < 0.01, 'retro RE-PRICES the rental line in place (no extension-line pileup) — both units track cheapest(window)');

      // shorten → NO auto-credit (refund-first); positive-delta-only guard
      const linesBeforeShorten = invX.lineItems.length;
      rX.endDate = E0; const e3 = T.billExtension(rX, E2);
      ok(e3 === null && invX.lineItems.length === linesBeforeShorten, 'shortening the window bills nothing (no auto-credit — refund stays manual)');
      rX.endDate = E2;   // restore to 19 days

      // allocation stability: a payment allocated to the original rental line survives a new extension line
      const rl0 = invX.lineItems.find((l) => l.kind === 'rental' && l.unitId === exU.unitId);
      invX.amountPaid = rl0.amount; invX.allocations = { [T.lineKey(rl0)]: rl0.amount };   // pay the original line exactly
      const paidBefore = T.itemPaid(invX, rl0);
      rX.endDate = '2099-06-25'; T.billExtension(rX, E2);   // 19 → 24 days, stays within this invoice (≤28, still open)
      ok(T.itemPaid(invX, rl0) === paidBefore, 'paid original rental line keeps its allocation after an extension line is appended (lid-stable)');

      // locked active invoice → extension SPILLS to a new invoice (never edits the sealed one)
      invX.locked = true; const invXLines = invX.lineItems.length;
      rX.endDate = '2099-07-20'; const eLock = T.billExtension(rX, '2099-06-25');
      ok(eLock && eLock.newInvoices >= 1 && invX.lineItems.length === invXLines, 'locked active invoice → extension spills to a NEW invoice (sealed one untouched)');
      invX.locked = false;

      // cleanup (sweep the whole series — the locked spill opened extra invoices)
      T.rentalInvoices(rX).forEach((iv) => { const i = T.DATA.invoices.findIndex((o) => o.invoiceId === iv.invoiceId); if (i >= 0) T.DATA.invoices.splice(i, 1); T.IDX.invoice.delete(iv.invoiceId); });
      const riX = T.DATA.rentals.findIndex((o) => o.rentalId === 'R-EXTTEST'); if (riX >= 0) T.DATA.rentals.splice(riX, 1); T.IDX.rental.delete('R-EXTTEST');

      // 31) RETROACTIVE RENTAL PRICING setting (default ON) — OFF bills the extension as a
      //     fresh rental of just the added days; ON blends the whole window (≤ OFF total).
      const stx = T.__state; const savedCoRetro = stx.settings.company;
      ok(T.retroPricingOn() === true, 'retroPricingOn() defaults to ON (no setting)');
      stx.settings.company = { ...(stx.settings.company || {}), retroactivePricing: false };
      ok(T.retroPricingOn() === false, 'retroPricingOn() reflects the OFF setting');
      const rY = { rentalId: 'R-EXTOFF', customerId: 'C0009', unitId: exU.unitId, categoryId: exU.categoryId, startDate: S0, endDate: E0, startTime: '', status: 'On Rent', transportType: 'Self', deliveryAddress: '', transportMiles: null, invoiceId: null, units: [{ ...mk(exU), transportType: 'Self', transportMiles: null }], notes: '', actions: [], mock: true };
      T.DATA.rentals.push(rY); T.IDX.rental.set('R-EXTOFF', rY);
      const invY = { invoiceId: 'I-EXTOFF', customerId: 'C0009', rentalIds: ['R-EXTOFF'], date: T.TODAY_ISO, dueDate: T.TODAY_ISO, po: '', amountPaid: 0, lineItems: [], mock: true };
      T.rentalLineItems(rY).forEach((li) => invY.lineItems.push(li));
      T.DATA.invoices.push(invY); T.IDX.invoice.set('I-EXTOFF', invY); rY.invoiceId = 'I-EXTOFF';
      const baseLineY = invY.lineItems.find((l) => l.kind === 'rental' && l.unitId === exU.unitId).amount;
      rY.endDate = E1; const off1 = T.billExtension(rY, E0);
      const standaloneSeg = priceFor(exU.categoryId, E0, E1);     // E0→E1 priced as its own rental
      ok(off1 && off1.retro === false && Math.abs(off1.subtotalDelta - standaloneSeg) < 0.01, `OFF: extension billed as standalone added days ($${standaloneSeg}), not the blended delta`);
      ok(invY.lineItems.find((l) => l.kind === 'rental' && l.unitId === exU.unitId).amount === baseLineY, 'OFF: the original rental line is frozen (unchanged)');
      // invariant — for the SAME extension, blending the whole window (ON) is never MORE than standalone (OFF)
      const Emid8 = '2099-06-09';   // S0 +8 days
      ok(priceFor(exU.categoryId, S0, Emid8) <= priceFor(exU.categoryId, S0, E0) + priceFor(exU.categoryId, E0, Emid8) + 0.005, 'retroactive ON total ≤ OFF total for the same extension (blend never costs more)');
      stx.settings.company = savedCoRetro;   // restore default
      [['R-EXTOFF', T.DATA.rentals, 'rentalId'], ['I-EXTOFF', T.DATA.invoices, 'invoiceId']].forEach(([id, arr, k]) => { const i = arr.findIndex((o) => o[k] === id); if (i >= 0) arr.splice(i, 1); });
      T.IDX.rental.delete('R-EXTOFF'); T.IDX.invoice.delete('I-EXTOFF');
    }

    // 32) §28cap MULTI-INVOICE SERIES — long rentals split into ≤28-day invoices; same total;
    //     extend past 28 days OR a closed invoice → a continuation invoice (never reopen settled).
    {
      const pf = (catId, s, e) => { const p = T.rentalPrice({ categoryId: catId, startDate: s, endDate: e, customerId: 'C0009' }); return p ? p.price : 0; };
      const af2 = T.DATA.units.filter((u) => u.fleetStatus === 'Active');
      const cu = af2.find((u) => pf(u.categoryId, '2099-09-01', '2099-09-29') > 0) || af2[0];
      const mkU = (u) => ({ unitId: u.unitId, status: 'On Rent', transportType: 'Self', deliveryAddress: '', recoveryAddress: '', transportMiles: null, startCapture: null, endCapture: null, fcCapture: null });
      const mkRental = (id, start, end) => { const r = { rentalId: id, customerId: 'C0009', unitId: cu.unitId, categoryId: cu.categoryId, startDate: start, endDate: end, startTime: '', status: 'On Rent', transportType: 'Self', deliveryAddress: '', transportMiles: null, invoiceId: null, units: [mkU(cu)], notes: '', actions: [], mock: true }; T.DATA.rentals.push(r); T.IDX.rental.set(id, r); return r; };
      // ≤28 days → exactly ONE invoice (common path unchanged)
      const rS = mkRental('R-CAP1', '2099-09-01', '2099-09-15');
      T.createInvoiceForRental('R-CAP1');
      ok(T.rentalInvoices(rS).length === 1, '≤28-day rental → exactly one invoice (common path unchanged)');
      // 40-day rental → series of 2 (28 + 12), contiguous chunks, continuation links back
      const rL = mkRental('R-CAP2', '2099-10-01', '2099-11-10');
      T.createInvoiceForRental('R-CAP2');
      const series = T.rentalInvoices(rL);
      ok(series.length === 2, `40-day rental → 2-invoice series (got ${series.length})`);
      ok(series[0].covStart === '2099-10-01' && series[0].covEnd === '2099-10-29' && series[1].covStart === '2099-10-29', 'chunks cover contiguous ≤28-day windows');
      ok(series[1].contOf === series[0].invoiceId, 'continuation invoice points back to the first (contOf)');
      const seriesSub = series.reduce((a, iv) => a + T.invoiceTotals(iv).subtotal, 0);
      ok(Math.abs(seriesSub - pf(cu.categoryId, '2099-10-01', '2099-11-10')) < 0.01, 'split bills the SAME total as one blended bill (28-day cap is organizational only)');
      // extend past 28 days → spills into a 2nd invoice; series total stays cheapest(full)
      const rE = mkRental('R-CAP3', '2099-12-01', '2099-12-20');
      T.createInvoiceForRental('R-CAP3');
      ok(T.rentalInvoices(rE).length === 1, 'a 19-day rental starts as one invoice');
      // preview reflects the SIGNED retro delta — incl. a reduction when extending unlocks a cheaper rate
      const pvDown = T.extensionPreview(rE, '2099-12-01', '2099-12-29');
      ok(pvDown && Math.abs(pvDown.subtotalDelta - (pf(cu.categoryId, '2099-12-01', '2099-12-29') - pf(cu.categoryId, '2099-12-01', '2099-12-20'))) < 0.01, 'preview shows the signed retro delta (a credit when extending into the cheaper 4-Week rate)');
      rE.endDate = '2100-01-05'; T.billExtension(rE, '2099-12-20');   // 19 → 35 days
      ok(T.rentalInvoices(rE).length === 2, 'extending 19→35 days spills into a 2nd invoice (28-day cap)');
      const eTot = T.rentalInvoices(rE).reduce((a, iv) => a + T.invoiceTotals(iv).subtotal, 0), e35 = pf(cu.categoryId, '2099-12-01', '2100-01-05');
      ok(Math.abs(eTot - e35) < 0.01, `after the spill, series total == cheapest(35 days) — incl. retro down-reblend at the 28-day mark (${eTot} vs ${e35})`);
      // closed (paid in full) active invoice + extend → NEW invoice; settled one untouched
      const rC = mkRental('R-CAP4', '2100-02-01', '2100-02-08');
      T.createInvoiceForRental('R-CAP4');
      const inv0 = T.rentalInvoices(rC)[0];
      inv0.amountPaid = T.invoiceTotals(inv0).total;   // pay in full → CLOSED
      ok(T.invoiceTotals(inv0).balance <= 0, 'first invoice paid in full (closed)');
      const inv0Lines = inv0.lineItems.length;
      rC.endDate = '2100-02-15'; T.billExtension(rC, '2100-02-08');   // still <28 days, but prior is closed
      ok(T.rentalInvoices(rC).length === 2, 'extending a CLOSED invoice opens a new one (never reopens the settled invoice)');
      ok(inv0.lineItems.length === inv0Lines && T.invoiceTotals(inv0).balance <= 0, 'the paid invoice stays settled — no lines added, still $0 balance');
      // cleanup
      ['R-CAP1', 'R-CAP2', 'R-CAP3', 'R-CAP4'].forEach((rid) => {
        const rr = T.IDX.rental.get(rid);
        if (rr) T.rentalInvoices(rr).forEach((iv) => { const i = T.DATA.invoices.findIndex((o) => o.invoiceId === iv.invoiceId); if (i >= 0) T.DATA.invoices.splice(i, 1); T.IDX.invoice.delete(iv.invoiceId); });
        const ri = T.DATA.rentals.findIndex((o) => o.rentalId === rid); if (ri >= 0) T.DATA.rentals.splice(ri, 1); T.IDX.rental.delete(rid);
      });
    }

    // 32b) EXTENSION PREVIEW == ACTUAL POSTING (regression for the reported bug — the inline
    //      confirm panel's "Added charge" must equal EXACTLY what Bill Extension posts, even when
    //      the invoice is PAID (spills the added segment to a continuation invoice) or its prior
    //      charge is a MANUAL line, not an auto rental line. The old preview blindly did
    //      `price(full window) − matched-billed`, which overstated both cases.)
    {
      const pf = (catId, s, e) => { const p = T.rentalPrice({ categoryId: catId, startDate: s, endDate: e, customerId: 'C0009' }); return p ? p.price : 0; };
      const SB = '2099-07-31', S0 = '2099-08-01', E0 = '2099-08-03', E1 = '2099-08-04';   // base 2-day window [S0,E0]; SB = start −1, E1 = end +1
      const af3 = T.DATA.units.filter((u) => u.fleetStatus === 'Active');
      const cu = af3.find((u) => pf(u.categoryId, S0, E1) > pf(u.categoryId, S0, E0) && pf(u.categoryId, S0, E0) > 0) || af3[0];
      const seriesSub = (r) => T.rentalInvoices(r).reduce((a, iv) => a + iv.lineItems.filter((l) => l.kind === 'rental' || l.kind === 'extension').reduce((s, l) => s + (+l.amount || 0), 0), 0);
      // ns/ne = the staged new window; default = back extension. Asserts the inline preview equals
      // the real series delta billExtension posts, for an extension at EITHER end (or both).
      const scenario = (label, paid, matched, ns, ne) => {
        ns = ns || S0; ne = ne || E1;
        const rid = 'R-PVEQ', iid = 'I-PVEQ';
        const r = { rentalId: rid, customerId: 'C0009', unitId: cu.unitId, categoryId: cu.categoryId, startDate: S0, endDate: E0, startTime: '', status: 'On Rent', transportType: 'Self', deliveryAddress: '', transportMiles: null, invoiceId: iid, units: [{ unitId: cu.unitId, transportType: 'Self', transportMiles: null }], notes: '', actions: [], mock: true };
        T.DATA.rentals.push(r); T.IDX.rental.set(rid, r);
        const inv = { invoiceId: iid, customerId: 'C0009', rentalIds: [rid], date: T.TODAY_ISO, dueDate: T.TODAY_ISO, po: '', amountPaid: 0, lineItems: [], covOf: rid, covStart: S0, covEnd: E0, mock: true };
        if (matched) T.rentalLineItems(r).forEach((li) => inv.lineItems.push(li));
        else inv.lineItems.push({ kind: 'item', ref: rid, unitId: cu.unitId, lid: 'L-MAN', label: `${T.IDX.unit.get(cu.unitId)?.name || 'Unit'} · 1-Day×1`, amount: pf(cu.categoryId, S0, E0), qty: 1 });
        T.DATA.invoices.push(inv); T.IDX.invoice.set(iid, inv);
        if (paid) { inv.amountPaid = T.invoiceTotals(inv).total; const l0 = inv.lineItems[0]; inv.allocations = { [T.lineKey(l0)]: l0.amount }; }
        const pv = T.extensionPreview(r, ns, ne);
        const before = seriesSub(r);
        r.startDate = ns; r.endDate = ne; T.billExtension(r, E0, S0);
        const actual = Math.round((seriesSub(r) - before) * 100) / 100;
        ok(pv && Math.abs(pv.subtotalDelta - actual) < 0.01, `preview == actual posting — ${label} (preview ${pv ? pv.subtotalDelta : 'null'} vs billed ${actual})`);
        T.rentalInvoices(r).forEach((iv) => { const i = T.DATA.invoices.findIndex((o) => o.invoiceId === iv.invoiceId); if (i >= 0) T.DATA.invoices.splice(i, 1); T.IDX.invoice.delete(iv.invoiceId); });
        const ri = T.DATA.rentals.findIndex((o) => o.rentalId === rid); if (ri >= 0) T.DATA.rentals.splice(ri, 1); T.IDX.rental.delete(rid);
        return pv ? pv.subtotalDelta : null;
      };
      // BACK extension (end +1) — the #358 fix
      scenario('back · unpaid · auto line', false, true, S0, E1);
      scenario('back · PAID · auto line', true, true, S0, E1);
      const pvManual = scenario('back · PAID · manual ×1 line (orig bug)', true, false, S0, E1);
      ok(pvManual != null && Math.abs(pvManual - pf(cu.categoryId, E0, E1)) < 0.01, `back+paid+manual: added charge = the added segment ($${pf(cu.categoryId, E0, E1)}), not the full window ($${pf(cu.categoryId, S0, E1)})`);
      // FRONT extension (start −1) — the reported "go BACK a day" case: paid invoice spills the added FRONT day
      scenario('front · unpaid · auto line', false, true, SB, E0);
      const pvFront = scenario('front · PAID · auto line (start back a day)', true, true, SB, E0);
      ok(pvFront != null && Math.abs(pvFront - pf(cu.categoryId, SB, S0)) < 0.01, `front+paid: added charge = the added FRONT segment ($${pf(cu.categoryId, SB, S0)}) — start back a day bills the added day`);
      // COMBINED front+back in one save — composes correctly (a single open chunk re-prices to the full window)
      scenario('combined front+back · unpaid · auto line', false, true, SB, E1);
      scenario('combined front+back · PAID · auto line', true, true, SB, E1);
      // MOVE (slide the window, same length) — NOT an extension: one end grows but a prior day is
      // DROPPED, so it must bill NOTHING (a reschedule, not an extension — re-price/refund is manual).
      const SP1 = '2099-08-02';   // S0 + 1
      const pvMoveFwd = scenario('MOVE forward · PAID (drop front day, add back day)', true, true, SP1, E1);
      ok(Math.abs(pvMoveFwd || 0) < 0.01, `move forward bills nothing — a same-length slide is not an extension (got ${pvMoveFwd})`);
      const pvMoveBack = scenario('MOVE backward · PAID (drop back day, add front day)', true, true, SB, SP1);
      ok(Math.abs(pvMoveBack || 0) < 0.01, `move backward bills nothing — not an extension (got ${pvMoveBack})`);
      scenario('MOVE forward · unpaid', false, true, SP1, E1);
    }
    // === F1 — membership fee math (spec §2): no proration; protection = 15% of BASE only; 10.75% tax ===
    {
      const PR = { monthlyBase: 299, annualBase: 2691, monthlyTransport: 500, annualTransport: 4500, protectionPct: 15, protectionCapMonthly: 2000 };
      const mf = (plan, t, p) => T.membershipFee({ plan, addOns: { transport: t, protection: p } }, PR);
      const mBoth = mf('Monthly', true, true);
      ok(mBoth.base === 299 && mBoth.transport === 500 && mBoth.protection === 44.85 && mBoth.subtotal === 843.85 && mBoth.tax === 90.71 && mBoth.total === 934.56, `membership: Monthly both add-ons → 843.85 + tax = 934.56 (got ${mBoth.subtotal}/${mBoth.total})`);
      ok(mBoth.protection === 44.85, `membership: protection is 15% of BASE only ($299→$44.85), NOT base+transport (got ${mBoth.protection})`);
      const mBase = mf('Monthly', false, false);
      ok(mBase.subtotal === 299 && mBase.transport === 0 && mBase.protection === 0 && mBase.total === 331.14, `membership: Monthly base-only → 299 + tax = 331.14 (got ${mBase.total})`);
      const mTrans = mf('Monthly', true, false);
      ok(mTrans.subtotal === 799 && mTrans.protection === 0, `membership: Monthly transport-only → subtotal 799, no protection (got ${mTrans.subtotal}/${mTrans.protection})`);
      const aBoth = mf('Yearly', true, true);
      ok(aBoth.base === 2691 && aBoth.transport === 4500 && aBoth.protection === 403.65 && aBoth.subtotal === 7594.65 && aBoth.total === 8411.07, `membership: Annual both add-ons → 7594.65 + tax = 8411.07 (got ${aBoth.subtotal}/${aBoth.total})`);
      const aBase = mf('Yearly', false, false);
      ok(aBase.subtotal === 2691 && aBase.total === 2980.28, `membership: Annual base-only → 2691 + tax = 2980.28 (got ${aBase.total})`);
      const pr = T.membershipPricing();
      ok(['monthlyBase', 'annualBase', 'monthlyTransport', 'annualTransport', 'protectionPct', 'protectionCapMonthly'].every((k) => typeof pr[k] === 'number' && isFinite(pr[k]) && pr[k] >= 0), 'membership: membershipPricing() returns six numeric fields (defaults applied when unset)');
    }

    // === F2 — membership status engine + Active pricing/entitlement gate (spec §3, §10.4) ===
    {
      const ms = T.membershipStatus, iam = T.isActiveMember;
      const future = '2099-01-01', past = '2000-01-01';
      ok(ms({ accountType: 'Non-Business' }) === 'None' && iam({ accountType: 'Non-Business' }) === false, 'status: non-member → None, not active');
      ok(ms({ accountType: 'Member Incomplete' }) === 'Incomplete' && iam({ accountType: 'Member Incomplete' }) === false, 'status: Member Incomplete → Incomplete, NOT active (no member rate)');
      ok(ms({ accountType: 'Business Member' }) === 'Active', 'status: legacy member (no subscription fields) → grandfathered Active');
      ok(iam({ accountType: 'Business Member', paidUntil: future }) === true, 'status: paid-through-future → Active (member rate applies)');
      ok(ms({ accountType: 'Business Member', paidUntil: past, graceUntil: future }) === 'Past Due' && iam({ accountType: 'Business Member', paidUntil: past, graceUntil: future }) === true, 'status: lapsed but in 7-day grace → Past Due, KEEPS member rate');
      ok(ms({ accountType: 'Business Member', paidUntil: past, graceUntil: past }) === 'Lapsed' && iam({ accountType: 'Business Member', paidUntil: past, graceUntil: past }) === false, 'status: grace expired → Lapsed, member rate REVOKED');
      ok(ms({ accountType: 'Business Member', prepaid: true, paidUntil: past }) === 'Active', 'status: prepaid-to-term member → Active even past paidUntil');
      // gate flows through real pricing: an Incomplete member pays RETAIL, an Active member pays the member rate
      const cat = T.DATA.categories.find((k) => k.memberDaily > 0);
      const r = { rentalId: 'R-MEMGATE', customerId: 'C-MEMGATE', categoryId: cat.categoryId, unitId: null, startDate: '2026-06-01', endDate: '2026-06-04' };
      const cust = { customerId: 'C-MEMGATE', accountType: 'Business Member', paidUntil: future };
      T.IDX.customer.set('C-MEMGATE', cust); T.IDX.rental.set('R-MEMGATE', r);
      const active = T.rentalPrice(r)?.price;
      cust.accountType = 'Member Incomplete';
      const incomplete = T.rentalPrice(r)?.price;
      T.IDX.customer.delete('C-MEMGATE'); T.IDX.rental.delete('R-MEMGATE');
      ok(active != null && incomplete != null && active < incomplete && active === 3 * cat.memberDaily, `gate: Active member pays member rate (${active}) < Incomplete pays retail (${incomplete})`);
    }

    // === F3 — membership funnel 'Signed' is agreement-driven, never manual (spec §3.1) ===
    {
      const c = { customerId: 'C-SIGN', accountType: 'Business Member', membershipStage: 'Contacted', activityLog: [] };
      T.IDX.customer.set('C-SIGN', c);
      T.markMembershipSigned(c, 'rental');
      ok(c.membershipStage === 'Contacted', 'funnel: signing the RENTAL agreement does NOT touch the membership funnel');
      T.markMembershipSigned(c, 'membership');
      ok(c.membershipStage === 'Signed', 'funnel: signing the MEMBERSHIP agreement auto-advances the funnel to Signed');
      // manual set of the terminal is refused for membership, but allowed for used-sales ('Paid')
      c.membershipStage = 'Contacted';
      T.setFunnelStage('C-SIGN', 'membership', 'Signed');
      ok(c.membershipStage === 'Contacted', 'funnel: Signed cannot be set manually on the membership funnel');
      T.setFunnelStage('C-SIGN', 'membership', 'Payment Discussed');
      ok(c.membershipStage === 'Payment Discussed', 'funnel: a non-terminal membership stage IS settable manually');
      T.setFunnelStage('C-SIGN', 'usedSales', 'Paid');
      ok(c.usedSalesStage === 'Paid', 'funnel: used-sales keeps Paid as a normal manual terminal');
      T.IDX.customer.delete('C-SIGN');
    }

    // === F4a — Rental Protection account surcharge (spec §2.1): 15% of the rental equipment subtotal, off by default ===
    {
      const cat = T.DATA.categories.find((k) => k.rate1Day > 0);
      const r = { rentalId: 'R-PROT', customerId: 'C-PROT', categoryId: cat.categoryId, units: [{ unitId: 'U-PROT' }], status: 'Reserved', startDate: '2099-06-01', endDate: '2099-06-02' };
      const u = { unitId: 'U-PROT', categoryId: cat.categoryId, name: 'Prot Unit' };
      const cust = { customerId: 'C-PROT', accountType: 'Non-Business', rentalProtection: false };
      T.IDX.customer.set('C-PROT', cust); T.IDX.unit.set('U-PROT', u); T.IDX.rental.set('R-PROT', r);
      const sub = T.rentalLineItems(r).reduce((a, li) => a + li.amount, 0);
      ok(T.rentalProtectionAmount(r) === 0, 'protection: OFF account → $0 protection on the rental');
      cust.rentalProtection = true;
      const amt = T.rentalProtectionAmount(r);
      ok(amt === Math.round(sub * T.rentalProtectionRate() * 100) / 100 && amt > 0, `protection: ON → ${T.rentalProtectionRate() * 100}% of equipment subtotal ${sub} = ${amt}`);
      T.IDX.customer.delete('C-PROT'); T.IDX.unit.delete('U-PROT'); T.IDX.rental.delete('R-PROT');
    }

    // === F4b — Rental Protection invoice LINE: built at creation, lid-preserving reprice, taxable ===
    {
      const r2c = (n) => Math.round(n * 100) / 100;
      const cat = T.DATA.categories.find((k) => k.rate1Day > 0);
      const cust = { customerId: 'C-PL', accountType: 'Non-Business', rentalProtection: true };
      const u1 = { unitId: 'U-PL', categoryId: cat.categoryId, name: 'PL1' };
      const u2 = { unitId: 'U-PL2', categoryId: cat.categoryId, name: 'PL2' };
      const r = { rentalId: 'R-PL', customerId: 'C-PL', status: 'Reserved', startDate: '2099-06-01', endDate: '2099-06-03', units: [{ unitId: 'U-PL' }], invoiceId: 'I-PL' };
      const inv = { invoiceId: 'I-PL', customerId: 'C-PL', amountPaid: 0, lineItems: [] };
      T.IDX.customer.set('C-PL', cust); T.IDX.unit.set('U-PL', u1); T.IDX.unit.set('U-PL2', u2); T.IDX.rental.set('R-PL', r); T.IDX.invoice.set('I-PL', inv);
      // build at creation: rental lines + protection line
      T.rentalLineItems(r).forEach((li) => inv.lineItems.push(li));
      T.protectionLineItems(r).forEach((li) => inv.lineItems.push(li));
      const rentalSub = inv.lineItems.filter((l) => l.kind === 'rental').reduce((a, l) => a + l.amount, 0);
      const pl = inv.lineItems.find((l) => l.kind === 'protection');
      ok(pl && pl.amount === r2c(rentalSub * T.rentalProtectionRate()) && pl.amount > 0, `protection line: built at creation = 15% of rental subtotal ${rentalSub} → ${pl && pl.amount}`);
      ok(r2c(T.invoiceTotals(inv).subtotal) === r2c(rentalSub + pl.amount), 'protection line: included in the invoice subtotal');
      ok(r2c(T.invoiceTotals(inv).tax) === r2c((rentalSub + pl.amount) * 0.1075), 'protection line: taxed like the rest (taxable)');
      // turn protection OFF + resync → unpaid line dropped
      cust.rentalProtection = false; T.syncProtectionLine(r);
      ok(!inv.lineItems.some((l) => l.kind === 'protection'), 'protection line: dropped when the account toggles protection off');
      // back ON + resync → re-added; then add a unit → reprices UP, lid preserved
      cust.rentalProtection = true; T.syncProtectionLine(r);
      const plOn = inv.lineItems.find((l) => l.kind === 'protection'); const lid1 = plOn.lid; const amtOn = plOn.amount;   // snapshot the NUMBER (reprice mutates the line in place)
      r.units.push({ unitId: 'U-PL2' });
      T.rentalLineItems(r).filter((li) => li.unitId === 'U-PL2').forEach((li) => inv.lineItems.push(li));   // add the new unit's rental line (grows the base)
      T.syncProtectionLine(r);
      const plUp = inv.lineItems.find((l) => l.kind === 'protection');
      ok(plUp && plUp.lid === lid1 && plUp.amount > amtOn, `protection line: reprices UP when a unit is added (${amtOn}→${plUp.amount}), lid preserved`);
      T.IDX.customer.delete('C-PL'); T.IDX.unit.delete('U-PL'); T.IDX.unit.delete('U-PL2'); T.IDX.rental.delete('R-PL'); T.IDX.invoice.delete('I-PL');
    }

    // === F7 — membership economics (spec §7): member rev vs retail counterfactual, derived discount/net ===
    {
      const cat = T.DATA.categories.find((k) => k.memberDaily > 0 && k.rate1Day > k.memberDaily);
      const u = { unitId: 'U-EC', categoryId: cat.categoryId, name: 'EC' };
      const cust = { customerId: 'C-EC', accountType: 'Business Member', paidUntil: '2099-01-01', paidFees: 1200 };
      const r = { rentalId: 'R-EC', customerId: 'C-EC', status: 'Reserved', startDate: '2099-06-01', endDate: '2099-06-04', units: [{ unitId: 'U-EC' }] };
      T.IDX.customer.set('C-EC', cust); T.IDX.unit.set('U-EC', u); T.IDX.rental.set('R-EC', r); T.DATA.rentals.push(r);
      const e = T.membershipEconomics(cust);
      const days = 3;
      ok(e.memberRev === days * cat.memberDaily, `economics: member-rate revenue = ${days}×${cat.memberDaily} = ${e.memberRev}`);
      ok(e.retailRev > e.memberRev, `economics: retail counterfactual ${e.retailRev} > member ${e.memberRev}`);
      ok(e.discount === Math.round((e.retailRev - e.memberRev) * 100) / 100 && e.discount > 0, `economics: member discount = retail − member = ${e.discount}`);
      ok(e.feeRevenue === 1200, 'economics: fee revenue falls back to paidFees when no membership invoices exist');
      ok(e.net === Math.round((e.feeRevenue - e.discount) * 100) / 100, `economics: net program contribution = fees − discount = ${e.net}`);
      const idx = T.DATA.rentals.indexOf(r); if (idx >= 0) T.DATA.rentals.splice(idx, 1);
      T.IDX.customer.delete('C-EC'); T.IDX.unit.delete('U-EC'); T.IDX.rental.delete('R-EC');
    }

    // === F5 — cancel → Cancellation Invoice → reactivate-to-prepaid (spec §4); demo charge ===
    {
      ok(T.addMonthsISO('2026-06-25', 1) === '2026-07-25' && T.addMonthsISO('2026-06-25', 12) === '2027-06-25', 'enroll: addMonthsISO advances Paid-Until / commitment by the cadence');
      const c = { customerId: 'C-CX', accountType: 'Business Member', company: 'Acme', paidCadence: 'Monthly', commitmentStart: '2099-01-01', commitmentEnd: '2099-12-01', paidUntil: '2099-07-01', addOns: { transport: false, protection: false }, cards: [{ id: 'K1', status: 'active', isDefault: true, stripePmId: 'pm_x', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2099 }], activityLog: [] };
      T.IDX.customer.set('C-CX', c);
      ok(T.isActiveMember(c) === true, 'cancel: starts as an Active member');
      await T.membershipCancel('C-CX');
      const cxl = T.membershipCancellationInvoice(c);
      ok(cxl && cxl.membershipCancellation && T.invoiceTotals(cxl).balance > 0, 'cancel: Monthly mid-commitment drops a Cancellation Invoice for the remaining term');
      ok(T.membershipStatus(c) === 'Lapsed' && T.isActiveMember(c) === false, 'cancel: reverts to Lapsed → retail pricing (rentalProtection untouched)');
      await T.membershipReactivate('C-CX');
      ok(T.membershipStatus(c) === 'Active' && c.prepaid === true && c.paidUntil === c.commitmentEnd, 'reactivate: paying the Cancellation Invoice in full reopens the membership PREPAID through the term');
      ok(T.invoiceTotals(cxl).balance <= 0.005, 'reactivate: the Cancellation Invoice reads paid in full');
      T.IDX.customer.delete('C-CX');
      const ci = T.DATA.invoices.indexOf(cxl); if (ci >= 0) T.DATA.invoices.splice(ci, 1); T.IDX.invoice.delete(cxl.invoiceId);
    }

    // === F5 — enrollment happy path (demo charge): card on file → Active + paid membership invoice ===
    {
      const c = { customerId: 'C-EN', accountType: 'Non-Business', company: '', membershipStage: 'Signed', cards: [{ id: 'K1', status: 'active', isDefault: true, stripePmId: 'pm_y', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2099 }], activityLog: [] };
      T.IDX.customer.set('C-EN', c);
      T.openMembershipEnroll('C-EN');
      T.__state.overlay.plan = 'Monthly'; T.__state.overlay.addOns = { transport: true, protection: true };
      await T.membershipEnrollCommit();
      ok(T.membershipStatus(c) === 'Active' && /Member/.test(c.accountType) && c.accountType !== 'Member Incomplete', 'enroll: a cleared charge flips the account to an Active member');
      const inv = T.DATA.invoices.find((i) => i.membership && i.customerId === 'C-EN');
      ok(inv && T.invoiceTotals(inv).balance <= 0.005, 'enroll: a PAID membership invoice is created');
      ok(c.unlimitedTransport === true && c.rentalProtection === true && c.paidCadence === 'Monthly' && c.commitmentEnd, 'enroll: add-ons + cadence + 12-mo commitment set on the account');
      T.IDX.customer.delete('C-EN');
      if (inv) { const ix = T.DATA.invoices.indexOf(inv); if (ix >= 0) T.DATA.invoices.splice(ix, 1); T.IDX.invoice.delete(inv.invoiceId); }
      T.__state.overlay = null;
    }

    return out;
  });

  const passed = results.filter((r) => r.ok).length;
  results.forEach((r) => console.log(`${r.ok ? '  ✓' : '  ✗ FAIL:'} ${r.m}`));
  if (pageErrors.length) { console.error('❌ Console/page errors:\n  - ' + pageErrors.join('\n  - ')); failed = true; }
  const anyFail = results.some((r) => !r.ok);
  if (anyFail) failed = true;
  console.log(`\n${failed ? '❌' : '✅'} Logic suite: ${passed}/${results.length} checks passed.`);
} catch (e) {
  console.error('❌ Logic test threw:', e && e.message || e); failed = true;
} finally {
  await browser.close(); server.close();
}
process.exit(failed ? 1 : 0);
