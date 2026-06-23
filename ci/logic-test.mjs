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
    ok(/terms/i.test(T.rentalRuleBlock({}, { name: 'X' }, 'On Rent') || '') && T.rentalRuleBlock({}, { name: 'X', netDays: 0 }, 'On Rent') === null, 'Payment-terms Required: blocks until Net days entered (0/COD counts)');
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

    // 24) Layout & Footers — per-card footer visibility (default shown = zero change)
    const savedLayout = st.settings.layout;
    st.settings.layout = undefined;
    ok(T.footerHidden('rentals') === false, 'no layout config → footers shown (default)');
    st.settings.layout = { footers: { rentals: 'off' } };
    ok(T.footerHidden('rentals') === true && T.footerHidden('units') === false, 'a card footer can be hidden without affecting others');
    st.settings.layout = savedLayout;   // restore

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
    ok(JSON.stringify(T.pageDefaultSlice('layout').value) === JSON.stringify({ footers: {} }), 'Reset page (Layout) restores all footers shown');
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
