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

  const results = await page.evaluate(() => {
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

    // 3) per-unit status derivation off the shared window (date-robust via TODAY_ISO)
    const today = T.TODAY_ISO;
    ok(T.unitStatus({ startDate: today }, { status: 'Reserved' }) === 'Today', 'Reserved + today window → Today');
    ok(T.unitStatus({ startDate: '2099-01-01' }, { status: 'Reserved' }) === 'Reserved', 'Reserved + far window stays Reserved');
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
