/**
 * app.js — Rental Wrangler application engine (SPEC v6)
 * ============================================================================
 * One normalized state object; one-way data flow (§2): UI renders from state →
 * actions mutate state → re-render. Reference by ID; DERIVE everything else.
 *
 * This slice delivers the SKELETON (shell, §0 single-page mechanics: tabs /
 * anchor / cascade / universal pill rule / global search) + the RENTALS card as
 * the fully-built reference pattern. The other seven cards render with the
 * universal row template + a generic standard view so the cascade is fully
 * demonstrable; each gets its bespoke §12 layout in a later slice.
 * ============================================================================
 */

import { DATA } from './data.js';
import { createCascade } from './cascade.js';
import { serviceOrdersForUnit, completeService, SERVICE_TASKS } from './service-countdown.js';
import * as CFG from './config.js';
import { AGREEMENTS } from './agreements.js';
import {
  getStatus, STATUS, ROLES, GRID_CARDS, BACKOFFICE_BOARDS, SORT_FIELDS,
  SHOP_TYPES, SHOP_SEGMENTS,
  transportPrice, fmtWindow, fmtShortDate, showsTruck, parseISO, TODAY_ISO, invoiceShort,
} from './config.js';

/* ════════════════════════════════════════════════════════════════════════
   0. Small utilities
   ════════════════════════════════════════════════════════════════════════ */
const $  = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }));
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 }));
const TODAY = parseISO(TODAY_ISO);
const dayDiff = (a, b) => Math.round((b - a) / 86400000);

const SINGULAR = { customers: 'customer', rentals: 'rental', units: 'unit', invoices: 'invoice', categories: 'category', workOrders: 'workOrder', inspections: 'inspection', serviceOrders: 'unit' };

/* ════════════════════════════════════════════════════════════════════════
   1. Indexes — built once on load (SPEC §3: never scan thousands per keystroke)
   ════════════════════════════════════════════════════════════════════════ */
const IDX = {};
/* Split a legacy single "name" (optionally "First Last (Company)") into parts.
   First token = firstName, the rest = lastName; "(…)" → company if none set yet. */
function parseCustomerName(raw, existingCompany) {
  let s = String(raw || '').trim();
  let company = existingCompany || '';
  const m = s.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m) { s = m[1].trim(); if (!company) company = m[2].trim(); }
  const parts = s.split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() || '', lastName: parts.join(' '), company };
}
const fullName = (c) => `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || '';
let migrationDirty = false;
/* One-time, idempotent: give every customer firstName/lastName parsed from `name`,
   then keep `name` as the derived "First Last" display. Runs on seed AND loaded data. */
function migrateCustomers() {
  DATA.customers.forEach((c) => {
    if (c.firstName == null) {
      const p = parseCustomerName(c.name, c.company);
      c.firstName = p.firstName; c.lastName = p.lastName; if (p.company) c.company = p.company;
      c.name = fullName(c);
      migrationDirty = true;
    }
  });
}

function buildIndexes() {
  migrateCustomers();
  IDX.unit     = new Map(DATA.units.map((u) => [u.unitId, u]));
  IDX.category = new Map(DATA.categories.map((c) => [c.categoryId, c]));
  IDX.customer = new Map(DATA.customers.map((c) => [c.customerId, c]));
  IDX.invoice  = new Map(DATA.invoices.map((i) => [i.invoiceId, i]));
  IDX.rental   = new Map(DATA.rentals.map((r) => [r.rentalId, r]));
  IDX.wo       = new Map(DATA.workOrders.map((w) => [w.woId, w]));
  IDX.insp     = new Map(DATA.inspections.map((n) => [n.inspectionId, n]));
  IDX.vendor   = new Map(DATA.vendors.map((v) => [v.vendorId, v]));
  // lowercased comprehensive search blobs per record (§5) — built via the single
  // searchBlob() source of truth so every field is searchable.
  IDX.search = new Map();
  DATA.customers.forEach((c) => reindex('customers', c));
  DATA.rentals.forEach((r) => reindex('rentals', r));
  DATA.categories.forEach((c) => reindex('categories', c));
  DATA.units.forEach((u) => reindex('units', u));
  DATA.invoices.forEach((i) => reindex('invoices', i));
  DATA.workOrders.forEach((w) => reindex('workOrders', w));
  DATA.inspections.forEach((n) => reindex('inspections', n));
}
const idOf   = (card, rec) => rec[{ customers: 'customerId', rentals: 'rentalId', categories: 'categoryId', units: 'unitId', invoices: 'invoiceId', workOrders: 'woId', inspections: 'inspectionId', serviceOrders: 'unitId' }[card]];
const recOf  = (card, id) => ({ customers: IDX.customer, rentals: IDX.rental, categories: IDX.category, units: IDX.unit, invoices: IDX.invoice, workOrders: IDX.wo, inspections: IDX.insp, serviceOrders: IDX.unit }[card])?.get(id);

/* ── §5 comprehensive search blob — ONE source of truth for what's searchable.
   Emits every raw field, foreign-key DISPLAY names, AND the getStatus(...) labels
   so the VISIBLE text ('Member', 'Bill: Yes', 'Past Due', 'Delivery') matches too. */
function searchBlob(card, rec) {
  if (!rec) return '';
  const L = (set, v) => (v == null || v === '' ? '' : getStatus(set, v).label);
  const cu = (id) => IDX.customer.get(id);
  const un = (id) => IDX.unit.get(id);
  const ca = (id) => IDX.category.get(id);
  let p = [];
  switch (card) {
    case 'customers':
      p = [rec.name, rec.firstName, rec.lastName, rec.company, rec.phone, rec.email, rec.address, rec.industry,
        rec.accountType, L('customerAccountType', rec.accountType),
        rec.payStatus, L('customerPayStatus', rec.payStatus),
        rec.membershipStage, L('funnelStage', rec.membershipStage),
        rec.usedSalesStage, L('funnelStage', rec.usedSalesStage),
        rec.salesAction, rec.accountNotes, rec.paidCadence, rec.stripeId,
        ...(rec.interestedCategoryIds || []).map((id) => ca(id)?.name),
        ...(rec.activityLog || []).map((a) => a.text)];
      break;
    case 'rentals': {
      const u = un(rec.unitId), c = ca(rec.categoryId), cust = cu(rec.customerId);
      p = [rec.rentalName, rec.legacyUnitName, rec.startTime, rec.deliveryAddress, rec.po, rec.notes,
        rec.fieldCall ? 'field call fc' : '', rec.startDate, rec.endDate, rec.invoiceId,
        rec.status, L('rentalStatus', rec.status), L('rentalStatus', rentalDisplayStatus(rec)),
        rec.transportType, L('transportType', rec.transportType),
        u?.name, u?.make, u?.model, u?.serial, c?.name, cust?.name, cust?.company];
      break;
    }
    case 'categories':
      p = [rec.name, rec.fuelType, rec.description];
      break;
    case 'units':
      p = [rec.name, rec.assignedMechanic, rec.serial, rec.year, rec.make, rec.model, rec.weight,
        rec.gpsType, rec.gpsPlacement, rec.notes,
        rec.inspectionStatus, L('unitInspectionStatus', rec.inspectionStatus),
        rec.fleetStatus, L('unitFleetStatus', rec.fleetStatus),
        rec.gpsStatus, L('gpsStatus', rec.gpsStatus), ca(rec.categoryId)?.name];
      break;
    case 'invoices': {
      const cust = cu(rec.customerId); const t = invoiceTotals(rec);
      p = [rec.invoiceId, rec.po, cust?.name, cust?.company,
        t.status, L('invoiceStatus', t.status),
        ...(rec.lineItems || []).map((li) => li.label)];
      break;
    }
    case 'workOrders': {
      const u = un(rec.unitId), cust = cu(rec.customerId);
      p = [rec.woReport, rec.description, rec.assignedMechanic,
        rec.phase, L('woPhase', rec.phase), rec.woType, L('woType', rec.woType),
        rec.billCustomer, L('billCustomer', rec.billCustomer), rec.eta,
        u?.name, cust?.name,
        ...(rec.lineItems || []).flatMap((li) => [li.part, li.vendor, li.eta, L('woPhase', li.phase)])];
      break;
    }
    case 'inspections':
      p = ['inspection', rec.checklist, L('inspectionChecklist', rec.checklist),
        rec.wash, rec.billCustomer, L('billCustomer', rec.billCustomer),
        rec.description, un(rec.unitId)?.name];
      break;
  }
  return p.filter(Boolean).join(' ').toLowerCase();
}
/** (Re)build a record's search blob in IDX.search. Call after any create/edit. */
const reindex = (card, rec) => { const id = idOf(card, rec); if (id != null) IDX.search.set(card + ':' + id, searchBlob(card, rec)); saveSoon(); };

/* ════════════════════════════════════════════════════════════════════════
   2. Derivations (SPEC §10) — money, availability, statuses, countdowns
   ════════════════════════════════════════════════════════════════════════ */
const RATE_LABELS = { m: '4-Week', w: '7-Day', d: '1-Day' };

/** Rental price + winning rate-combo label (SPEC §10). Returns null when the
 *  rental has no category/dates (e.g. a Quote). */
function rentalPrice(r) {
  const cat = IDX.category.get(r.categoryId);
  const s = parseISO(r.startDate), e = parseISO(r.endDate);
  if (!cat || !s || !e) return null;
  const days = Math.max(1, dayDiff(s, e));
  const cust = IDX.customer.get(r.customerId);
  const isMember = cust && /Member/.test(cust.accountType || '') && cust.accountType !== 'Member Incomplete';

  if (isMember) return { price: days * cat.memberDaily, rate: `Member×${days}`, days };
  // §10 weekend rate (Jac 2026-06-07): Fri→Sun, Fri→Mon, or Sat→Mon — NOT Sat→Sun.
  // Day-of-week: Sun=0 Mon=1 … Fri=5 Sat=6. Bounded by the short getaway length.
  const sd = s.getDay(), ed = e.getDay();
  const weekendWindow = (sd === 5 && ed === 0 && days === 2)   // Fri → Sun
    || (sd === 5 && ed === 1 && days === 3)                    // Fri → Mon
    || (sd === 6 && ed === 1 && days === 2);                   // Sat → Mon
  if (weekendWindow) return { price: cat.weekend, rate: 'WKND', days };

  let best = null;
  for (let mm = 0; mm <= Math.floor(days / 28); mm++) {
    for (let ww = 0; ww <= Math.floor((days - 28 * mm) / 7); ww++) {
      const dd = days - 28 * mm - 7 * ww;
      const total = mm * cat.rate4Wk + ww * cat.rate7Day + dd * cat.rate1Day;
      if (best == null || total < best.total) best = { total, mm, ww, dd };
    }
  }
  if (!best) return null;
  const parts = [];
  if (best.mm) parts.push(`${RATE_LABELS.m}×${best.mm}`);
  if (best.ww) parts.push(`${RATE_LABELS.w}×${best.ww}`);
  if (best.dd) parts.push(`${RATE_LABELS.d}×${best.dd}`);
  return { price: best.total, rate: parts.join(' + ') || '—', days };
}

/** Transport cost + drive time for a rental (SPEC §10). */
function rentalTransport(r) {
  const cust = IDX.customer.get(r.customerId);
  const unlimited = !!cust?.unlimitedTransport;
  return transportPrice(r.transportType, r.deliveryAddress, { unlimitedTransport: unlimited });
}

/** Invoice subtotal / tax / total / paid / balance / derived status (§10 + aging). */
const TAX_RATE = 0.1075;   // §10 sales tax — 10.75% (Jac 2026-06-07); honors exemptions
function invoiceTotals(inv) {
  const subtotal = (inv.lineItems || []).reduce((a, li) => a + (Number(li.amount) || 0), 0);
  const cust = inv.customerId ? IDX.customer.get(inv.customerId) : null;
  const exempt = !!(inv.taxExempt || cust?.salesTaxExempt);
  // transport + custom lines can be flagged li.taxExempt; rentals/parts/labor are taxable
  const taxBase = exempt ? 0 : (inv.lineItems || []).reduce((a, li) => a + (li.taxExempt ? 0 : (Number(li.amount) || 0)), 0);
  const tax = Math.round(taxBase * TAX_RATE);
  const total = subtotal + tax;
  const paid = Number(inv.amountPaid) || 0;
  const balance = total - paid;
  let status;
  if (inv.refunded) status = 'Refunded';
  else if (total > 0 && paid >= total) status = 'Paid';
  else if (paid > 0) status = 'Partial';
  else {
    const due = parseISO(inv.dueDate);
    if (due && due > TODAY) status = 'Not Due';
    else {
      const daysPast = due ? dayDiff(due, TODAY) : 0;   // §10 aging tiers by days past due
      status = daysPast >= 120 ? 'Collections' : daysPast >= 90 ? 'Late+90' : daysPast >= 60 ? 'Late+60' : daysPast >= 30 ? 'Late+30' : daysPast >= 1 ? 'Late' : 'Unpaid';
    }
  }
  return { subtotal, tax, total, exempt, paid, balance, status };
}

/** The active rental driving a unit's mirrored Rental Status (excludes
 *  Returned/Cancelled/No Show — §12.4). */
const ACTIVE_RENTAL = new Set(['Quote', 'Tomorrow', 'Today', 'Reserved', 'On Rent', 'End Rent', 'Off Rent']);
/** §8/§6.2#7 — Tomorrow/Today are DERIVED display states (stored status stays Reserved):
 *  a Reserved rental starting today shows "Today" (blue), tomorrow shows "Tomorrow" (purple). */
function rentalDisplayStatus(r) {
  if (r.status === 'Reserved') {
    const s = parseISO(r.startDate);
    if (s) { const d = dayDiff(TODAY, s); if (d === 0) return 'Today'; if (d === 1) return 'Tomorrow'; }
  }
  return r.status;
}
function activeRentalForUnit(unitId) {
  return DATA.rentals.filter((r) => r.unitId === unitId && ACTIVE_RENTAL.has(r.status) && r.status !== 'Quote')
    .sort((a, b) => (parseISO(a.startDate) || 0) - (parseISO(b.startDate) || 0))[0] || null;
}

/* ── §10 Availability Tool (derived, never stored) ──────────────────────────
   A unit is available for a selected window iff Fleet=Active, Inspection≠Failed,
   and no occupying rental overlaps it. Overlap is half-open (`end>start`) so a
   same-day return frees the unit for a same-day re-rent. Computed live against
   the draft window during a +New-Rental unit pick (the cascade per §0.3/§10). */
let availWin = null;   // {start,end,time,selfId} set each render during a windowed unit pick
function rentalOverlaps(r, selS, selE) {
  const rs = parseISO(r.startDate), re = parseISO(r.endDate);
  if (!rs || !re || !selS || !selE) return false;
  return re > selS && selE > rs;   // touching boundaries do NOT conflict (same-day handoff)
}
function rentalsOverlappingUnit(unitId, startISO, endISO, selfId) {
  const selS = parseISO(startISO), selE = parseISO(endISO);
  if (!selS || !selE) return [];
  return DATA.rentals.filter((r) => r.unitId === unitId && r.rentalId !== selfId
    && ACTIVE_RENTAL.has(r.status) && r.status !== 'Quote' && rentalOverlaps(r, selS, selE));
}
function isUnitAvailableFor(u, startISO, endISO, selfId) {
  if (!u || u.fleetStatus !== 'Active') return false;
  if (u.inspectionStatus === 'Failed') return false;
  return rentalsOverlappingUnit(u.unitId, startISO, endISO, selfId).length === 0;
}
function categoryAvailableCount(catId, startISO, endISO, selfId) {
  return DATA.units.filter((u) => u.categoryId === catId && isUnitAvailableFor(u, startISO, endISO, selfId)).length;
}
/** The draft rental window in scope during a unit pick (drives the availability UI). */
function activeDraftWindow() {
  const win = (r) => (r && r.startDate && r.endDate) ? { start: r.startDate, end: r.endDate, time: r.startTime, selfId: r.rentalId } : null;
  // live while the window is being PICKED (Categories/Units update before "Done")
  if (state.winpicker) { const w = win(IDX.rental.get(state.winpicker.rentalId)); if (w) return w; }
  // and during the unit-pick phase on a windowed rental draft
  if (state.pick && state.pick.slot === 'unit' && entityCardOf(state.pick.card, state.pick.recType) === 'rentals') return win(recOf('rentals', state.pick.recId));
  return null;
}
/** True when, under the active window, this row's record is unavailable (red tint). */
function availUnavailable(card, rec) {
  if (!availWin) return false;
  if (card === 'units') return !isUnitAvailableFor(rec, availWin.start, availWin.end, availWin.selfId);
  if (card === 'categories') return categoryAvailableCount(rec.categoryId, availWin.start, availWin.end, availWin.selfId) === 0;
  return false;
}
/** Open WO bottleneck (latest non-Complete) for a unit (§7.3 Order Status). */
function openWOForUnit(unitId) {
  return DATA.workOrders.filter((w) => w.unitId === unitId && w.phase !== 'Complete')
    .sort((a, b) => (parseISO(b.date) || 0) - (parseISO(a.date) || 0))[0] || null;
}
/** Rounded countdown text for display (the reference module returns exact
 *  decimals; we round only at the render layer so the module stays faithful). */
const svcText = (s) => (s.status === 'past-due'
  ? `${Math.abs(Math.round(s.remaining))} HRS overdue`
  : `${Math.round(s.remaining)} HRS remaining`);

/** Most-urgent active service order for a unit (derived via the reference module). */
function topServiceForUnit(unit) {
  const rows = serviceOrdersForUnit(unit, unit.serviceCompletions || {}, { hoursField: 'currentHours', baselineField: 'purchaseHours' });
  const active = rows.filter((s) => s.status !== 'ok');
  return active[0] || null;
}
/** Total repair cost for a unit = Σ its WO line-item costs (SPEC §12.4). */
function unitRepairCost(unitId) {
  return DATA.workOrders.filter((w) => w.unitId === unitId)
    .reduce((a, w) => a + (w.lineItems || []).reduce((s, li) => s + (Number(li.cost) || 0), 0), 0);
}
/** §7.6 WO "Price if billed": tiered parts markup (by each part's cost) + $150/hr labor.
 *  Tiers (Jac 2026-06-07): ≤$50 ×2.0 · ≤$200 ×1.5 · ≤$1000 ×1.3 · >$1000 ×1.2. */
const LABOR_RATE = 150;
const partMarkup = (cost) => cost <= 50 ? 2.0 : cost <= 200 ? 1.5 : cost <= 1000 ? 1.3 : 1.2;
function woBillable(w) {
  const items = w.lineItems || [];
  const parts = items.reduce((a, li) => { const c = Number(li.cost) || 0; return a + c * partMarkup(c); }, 0);
  const labor = items.reduce((a, li) => a + (Number(li.hours) || 0), 0) || w.laborHours || 0;
  return Math.round(parts + labor * LABOR_RATE);
}
/** Total revenue a unit has earned = Σ its rentals' derived prices (SPEC §12.4). */
function unitTotalRevenue(unitId) {
  return DATA.rentals.filter((r) => r.unitId === unitId)
    .reduce((a, r) => { const p = rentalPrice(r); return a + (p ? p.price : 0); }, 0);
}

/** Inspection result (handles the pending state: no checklist yet = Not Ready). */
function inspResult(n) {
  if (n.checklist === 'Pass') return { label: 'Pass', color: 'green' };
  if (n.checklist === 'Fail') return { label: 'Fail', color: 'red' };
  return { label: 'Not Ready', color: 'yellow' };   // pending — awaiting the gated flow
}
const inspComplete = (n) => n.checklist === 'Pass' || n.checklist === 'Fail';

/** Category proportional inspection mix (SPEC §6.2 #8 / §12.3). */
function categoryMix(categoryId) {
  const us = DATA.units.filter((u) => u.categoryId === categoryId);
  const c = { Ready: 0, 'Not Ready': 0, Failed: 0 };
  us.forEach((u) => { if (c[u.inspectionStatus] != null) c[u.inspectionStatus]++; });
  return { ...c, total: us.length };
}
/** A unit's current rental bucket (mirrors §12.4 Rental Status into 3 buckets). */
function unitRentalBucket(u) {
  const r = activeRentalForUnit(u.unitId);
  return r ? rentalDisplayStatus(r) : 'Available';   // granular display status, or Available
}
/** The order rental-status segments appear in the §12.3 second bar (birds-eye renting). */
const RENTAL_BAR_ORDER = ['Available', 'Tomorrow', 'Today', 'Reserved', 'On Rent', 'End Rent', 'Off Rent', 'Returned', 'Cancelled', 'No Show'];
/** Category proportional RENTAL mix by actual display status, plus which buckets
   involve transport (truck icon). Same proportional pattern as categoryMix. */
function categoryRentalMix(categoryId) {
  const us = DATA.units.filter((u) => u.categoryId === categoryId);
  const counts = {}, truck = {};
  us.forEach((u) => {
    const b = unitRentalBucket(u);
    counts[b] = (counts[b] || 0) + 1;
    const r = activeRentalForUnit(u.unitId);
    if (r && showsTruck(b, r.transportType)) truck[b] = true;
  });
  return { counts, truck, total: us.length };
}
/** Category aggregate stats (SPEC §12.3 Fleet Summary + Investment, derived). */
function categoryStats(cat) {
  const us = DATA.units.filter((u) => u.categoryId === cat.categoryId);
  const n = us.length || 1;
  const sum = (f) => us.reduce((a, u) => a + f(u), 0);
  const totalRev = sum((u) => unitTotalRevenue(u.unitId));
  const totalRepair = sum((u) => unitRepairCost(u.unitId));
  const trueCost = sum((u) => Number(u.trueCost || u.purchasePrice || 0));
  const denom = trueCost + totalRepair;
  // §10 ROI = lifetime return ÷ cost, annualized ×(365 ÷ avg days owned). Days owned
  // derive from purchaseDate; units missing it default to ~1 year (annualize factor ≈ 1).
  const daysOwned = us.map((u) => u.purchaseDate ? Math.max(1, dayDiff(parseISO(u.purchaseDate), TODAY)) : 365);
  const avgDaysOwned = daysOwned.length ? daysOwned.reduce((a, b) => a + b, 0) / daysOwned.length : 365;
  const lifetimeRoi = denom ? ((totalRev + (cat.bottomDollar || 0) * us.length) - denom) / denom : null;
  const roi = lifetimeRoi != null ? Math.round(lifetimeRoi * (365 / avgDaysOwned) * 100) : null;
  return {
    count: us.length,
    forSale: us.filter((u) => u.fleetStatus === 'For Sale').length,
    avgHours: sum((u) => Number(u.currentHours) || 0) / n,
    avgRevUnit: totalRev / n,
    avgExpUnit: totalRepair / n,
    roi,
  };
}

/* ════════════════════════════════════════════════════════════════════════
   3. State (one normalized object) + session model (SPEC §0.1)
   ════════════════════════════════════════════════════════════════════════
   A "session" is the full grid state. The default (no tabs) session is pure
   list-search across all cards. Each TAB carries its own isolated session with
   its own anchored main card + cascade. */
function freshSession() {
  const cards = {};
  for (const c of GRID_CARDS) cards[c.id] = { mode: 'list', recId: null, recType: null, search: '', filterTerms: [], historySearch: '', sort: loadSort(c.id), backStack: [], segment: c.id === 'shop' ? 'all' : null };
  return { anchor: null, cascade: null, cards };
}
/* Per-card sort persists per-device across sessions (localStorage). Store only
   {field,dir}; the label is re-derived from SORT_FIELDS so it can never drift. */
const SORT_LS_KEY = (card) => `jactec.sort.${card}`;
function loadSort(card) {
  const def = SORT_FIELDS[card][0];
  try {
    const raw = localStorage.getItem(SORT_LS_KEY(card));
    if (!raw) return { ...def };
    const saved = JSON.parse(raw);
    const f = SORT_FIELDS[card].find((x) => x.field === saved.field);
    if (!f) return { ...def };                                  // stale/removed field → default
    const dir = saved.dir === 'asc' || saved.dir === 'desc' ? saved.dir : f.dir;
    return { field: f.field, label: f.label, dir };
  } catch { return { ...def }; }
}
function saveSort(card, sort) {
  try { localStorage.setItem(SORT_LS_KEY(card), JSON.stringify({ field: sort.field, dir: sort.dir })); } catch {}
}
// the entity-card a record belongs to (Shop holds 3 entity types via recType)
const entityCardOf = (card, recType) => (card === 'shop' ? recType : card);

const state = {
  data: DATA,
  theme: 'dark',
  query: '',
  searchMode: false,
  tabs: [],            // [{ id, card, recId, label, sub, color, session }]
  activeTabId: null,
  defaultSession: freshSession(),
  cascade: createCascade(DATA),   // wired with v6 canonical fields (cascade.js DEFAULT_FIELDS)
  overlay: null,       // { kind, ... } for popups
  focusedCard: null,   // clicked card → orange border (§0.1 visual feedback, no anchor)
  pick: null,          // { card, recId, recType, slot } — §0.3 cascading-picker mode
  winpicker: null,     // { rentalId, monthISO, anchor } — the rental-window range picker
  filterTerms: [],            // §5.4 — AND-narrowing filter terms (type + Enter)
  fleetFilter: null,          // { categoryId, status } — fleet-summary badge → units by status
  woPartForm: null,           // woId whose "+ Add Part/Labor" inline form is open
  invLineForm: null,          // invoiceId whose "+ Add Custom" inline form is open
  dashboard: false,           // §5.3/§11 Office Dispatch Time Grid (grid-swap mode)
  seq: 1,
  invoiceSeq: DATA.invoices.length,   // monotonic invoice number (never reused after a discard)
};
const activeSession = () => (state.activeTabId ? state.tabs.find((t) => t.id === state.activeTabId)?.session : state.defaultSession) || state.defaultSession;
/** Next unique invoice id — a monotonic counter so discarding a draft can't reuse a number. */
const nextInvoiceId = () => CFG.invoiceId(TODAY_ISO, ++state.invoiceSeq);

/* ── session actions ──────────────────────────────────────────────────────
   `recType` is only meaningful for the Shop card (which holds inspections /
   workOrders / serviceOrders); it's undefined for the 5 normal cards. */
function setAnchor(session, card, recId, recType) {
  if (state.fleetFilter && !(card === 'categories' && recId === state.fleetFilter.categoryId)) state.fleetFilter = null;
  const entityCard = entityCardOf(card, recType);
  const type = SINGULAR[entityCard];
  const rec = recOf(entityCard, recId);
  session.anchor = { card, recId, recType };
  session.cascade = state.cascade.cascadeAll(type, rec);
  // anchored card → standard; others → list (cascade)
  for (const c of GRID_CARDS) {
    session.cards[c.id].backStack = [];
    session.cards[c.id].mode = c.id === card ? 'standard' : 'list';
    session.cards[c.id].recId = c.id === card ? recId : null;
    session.cards[c.id].recType = c.id === card ? recType : null;
  }
}

function anchorRecord(card, recId, recType) {
  // ⊞ : anchor in current session. No active tab → create a tab and switch.
  const rec = recOf(entityCardOf(card, recType), recId);
  if (state.activeTabId) {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    Object.assign(tab, tabMeta(card, recId, rec, recType));
    setAnchor(tab.session, card, recId, recType);
  } else {
    const tab = makeTab(card, recId, rec, recType);
    setAnchor(tab.session, card, recId, recType);
    state.tabs.push(tab);
    state.activeTabId = tab.id;
  }
  state.searchMode = false; state.query = '';
  render();
}

function openInNewTab(card, recId, recType) {
  // + : new background tab, do NOT disturb the current session/anchor.
  const rec = recOf(entityCardOf(card, recType), recId);
  const tab = makeTab(card, recId, rec, recType);
  setAnchor(tab.session, card, recId, recType);
  state.tabs.push(tab);
  render();
}

function makeTab(card, recId, rec, recType) { return { id: 'T' + state.seq++, session: freshSession(), ...tabMeta(card, recId, rec, recType) }; }
function tabMeta(card, recId, rec, recType) {
  const metaCard = entityCardOf(card, recType);
  const meta = ROW_META[metaCard] ? ROW_META[metaCard](rec) : { title: idOf(metaCard, rec), sub: '', color: 'gray' };
  return { card, recId, recType, label: meta.title, sub: meta.sub, color: meta.color };
}
function switchTab(id) {
  if (state.activeTabId === id) { closeTab(id); return; }     // clicking active (orange) tab closes it
  state.activeTabId = id; state.searchMode = false; state.query = ''; render();
}
function closeTab(id) {
  const i = state.tabs.findIndex((t) => t.id === id);
  if (i < 0) return;
  discardIfEmptyDraft(state.tabs[i]);
  state.tabs.splice(i, 1);
  if (state.activeTabId === id) state.activeTabId = state.tabs.length ? state.tabs[Math.max(0, i - 1)].id : null;
  render();
}
function closeAll() { state.tabs.forEach(discardIfEmptyDraft); state.tabs = []; state.activeTabId = null; state.searchMode = false; state.query = ''; state.winpicker = null; render(); }
/* Discard a `mock` draft that was abandoned with no meaningful data, so closing
   the tab doesn't leave an empty "New Rental"/blank invoice cluttering the lists. */
function discardIfEmptyDraft(tab) {
  if (!tab) return;
  const entity = entityCardOf(tab.card, tab.recType);
  const rec = recOf(entity, tab.recId);
  if (!rec || !rec.mock) return;
  const empty = (entity === 'rentals' && !rec.unitId && !rec.customerId)
    || (entity === 'inspections' && !rec.unitId)
    || (entity === 'workOrders' && !rec.unitId && !(rec.lineItems || []).length)
    || (entity === 'invoices' && !rec.customerId && !(rec.lineItems || []).length);
  if (!empty) return;
  const coll = collection(entity);
  const idx = coll.findIndex((x) => idOf(entity, x) === tab.recId);
  if (idx >= 0) coll.splice(idx, 1);
  ({ rentals: IDX.rental, inspections: IDX.insp, workOrders: IDX.wo, invoices: IDX.invoice }[entity])?.delete(tab.recId);
  IDX.search.delete(entity + ':' + tab.recId);
}

/** Click a row → standard mode in that card (push back-stack). §0.2 */
function openStandard(card, recId, recType) {
  const cs = activeSession().cards[card];
  if (cs.mode === 'standard' && cs.recId != null) cs.backStack.push({ mode: cs.mode, recId: cs.recId, recType: cs.recType });
  cs.mode = 'standard'; cs.recId = recId; cs.recType = recType || null;
  render();
}
function goBack(card) {
  const cs = activeSession().cards[card];
  const prev = cs.backStack.pop();
  const session = activeSession();
  if (prev) { cs.mode = prev.mode; cs.recId = prev.recId; cs.recType = prev.recType ?? null; }
  else if (session.anchor?.card === card) { cs.mode = 'standard'; cs.recId = session.anchor.recId; cs.recType = session.anchor.recType ?? null; }
  else { cs.mode = 'list'; cs.recId = null; cs.recType = null; }
  render();
}
/** Universal pill rule (§0.2): clicking any pill forces its target card into
 *  standard mode. WO/Inspection/Service pills now resolve to the Shop card. */
function pillTo(card, recId) {
  if (recId == null) return;
  if (SHOP_TYPES.includes(card)) { if (recOf(card, recId)) openStandard('shop', recId, card); return; }
  if (recOf(card, recId)) openStandard(card, recId);
}

/* ── global search (§5.4) ────────────────────────────────────────────────── */
function setQuery(q) {
  state.query = q;
  recomputeSearchMode();
  render();
}
/** Clear any "Show more" expansion on every card of the active session. */
function resetListLimits() { const s = activeSession(); if (s && s.cards) Object.values(s.cards).forEach((cs) => { cs.listLimit = undefined; }); }
// Any search/filter-set change restarts each card at 60 rows (keeps typing snappy
// and a new query doesn't inherit a previous "Show more" expansion).
function recomputeSearchMode() { state.searchMode = !!(state.query.trim() || state.filterTerms.length); resetListLimits(); }
function clearSearch() { state.query = ''; state.filterTerms = []; state.searchMode = false; resetListLimits(); render(); }
/** Core matcher (§5.4): blob must include the live query AND satisfy every pinned
    term — an include term (neg:false) must be present, a NOT term (neg:true) absent. */
function blobMatches(blob, query, terms) {
  const b = blob || '';
  const q = (query || '').trim().toLowerCase();
  if (q && !b.includes(q)) return false;
  return (terms || []).every((ft) => (ft.neg ? !b.includes(ft.t) : b.includes(ft.t)));
}
function matchesSearch(blob) { return blobMatches(blob, state.query, state.filterTerms); }

/* ── filter-term builder, shared by global search and each card's list search.
   `scope` is 'global' or a card id; a term is { t, neg } where neg means "NOT". */
function termsFor(scope) {
  if (scope === 'global') return state.filterTerms;
  const cs = activeSession().cards[scope];
  return (cs.filterTerms = cs.filterTerms || []);
}
function afterFilterChange(scope) {
  if (scope === 'global') recomputeSearchMode();           // sets searchMode + resets list limits
  else activeSession().cards[scope].listLimit = undefined;  // re-window this card from the top
  render();
  document.querySelector(scope === 'global' ? '#globalsearch' : `.mini-search[data-card="${scope}"]`)?.focus();
}
function addFilterTerm(scope, raw) {
  const v = (raw || '').trim().toLowerCase(); if (!v) return;
  const arr = termsFor(scope);
  if (!arr.some((ft) => ft.t === v)) arr.push({ t: v, neg: false });
  if (scope === 'global') state.query = ''; else activeSession().cards[scope].search = '';
  afterFilterChange(scope);
}
function removeFilterTerm(scope, i) { const arr = termsFor(scope); if (i >= 0 && i < arr.length) arr.splice(i, 1); afterFilterChange(scope); }
function toggleFilterNeg(scope, i) { const arr = termsFor(scope); if (arr[i]) arr[i].neg = !arr[i].neg; afterFilterChange(scope); }

/** A pinned filter-term pill: leading ○ toggle (→ red − = NOT) + label. The whole
    pill is click-to-remove (js-ft-x); the ○ toggle is checked first so it wins. */
function filterTermPill(ft, i, scope) {
  return `<span class="filt-term${ft.neg ? ' neg' : ''} js-ft-x" data-scope="${esc(scope)}" data-i="${i}" title="Click to remove">`
    + `<button class="ft-neg js-ft-neg" data-scope="${esc(scope)}" data-i="${i}" title="${ft.neg ? 'Excluding — click to include' : 'Including — click to exclude'}"></button>`
    + `<span class="lbl">${esc(ft.t)}</span>`
    + `</span>`;
}

/* ════════════════════════════════════════════════════════════════════════
   4. Inline SVG icons (stroke-based, currentColor — §6.2 #12)
   ════════════════════════════════════════════════════════════════════════ */
const I = {
  circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="5"/><rect x="9.3" y="9.3" width="5.4" height="5.4" rx="1.6" fill="currentColor" stroke="none"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 5h13v11H1zM14 8h4l4 4v4h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 6l-6 6 6 6"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
  mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l5-12 4 8 3-5 6 9z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A8 8 0 1 1 11.2 3 6 6 0 0 0 21 12.8z"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v7M14 20h7"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="13" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3z"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>',
};

/* Card + KPI-ring glyphs — sourced from free libraries (Lucide MIT; the excavator
   is Tabler's "backhoe", MIT). Inlined per §6.2 #12 (stroke-based, currentColor). */
const ico = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const CARD_ICON = {
  customers:     ico('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),                                // person
  rentals:       ico('<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'),                    // calendar
  categories:    ico('<path d="M2 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M11 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M13 19h-9"/><path d="M4 15h9"/><path d="M8 12v-5h2a3 3 0 0 1 3 3v5"/><path d="M5 15v-2a1 1 0 0 1 1 -1h7"/><path d="M21.12 9.88l-3.12 -4.88l-5 5"/><path d="M21.12 9.88a3 3 0 0 1 -2.12 5.12a3 3 0 0 1 -2.12 -.88l4.24 -4.24"/>'), // excavator (Tabler backhoe)
  units:         ico('<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>'), // tag (asset)
  invoices:      ico('<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>'), // receipt
  workOrders:    ico('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'), // wrench
  serviceOrders: ico('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'),  // heart
  inspections:   ico('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),                                                          // magnifier
  shop:          ico('<path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>'), // hammer (Shop)
  parts:         ico('<path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'), // package
  vendors:       ico('<path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18"/><path d="M9 22V12h6v10"/>'),  // storefront
  expenses:      ico('<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M14 8h-4M14 12h-4M12 16h-2"/>'),  // receipt
  files:         ico('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>'),  // folder
};
const RING_ICON = {
  mechanic: CARD_ICON.workOrders,  // wrench
  mtech:    ico('<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1Z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a6 6 0 0 1 6-6"/><path d="M14 6a6 6 0 0 1 6 6v3"/>'),  // hard-hat
  driver:   ico('<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'),  // truck
  office:   ico('<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/>'),  // building
  sales:    ico('<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>'),  // trending-up
};

/* ════════════════════════════════════════════════════════════════════════
   5. Pill / badge factories (registry-driven — never hardcode color/label)
   ════════════════════════════════════════════════════════════════════════ */
function statusPill(set, value, { card, recId, x, truck } = {}) {
  const st = getStatus(set, value);
  const data = card ? ` data-pill-card="${card}" data-pill-rec="${esc(recId)}"` : '';
  const tk = truck ? `<span class="truck">${I.truck}</span>` : '';
  const xb = x ? `<span class="x" data-x="${esc(x)}">✕</span>` : '';
  return `<span class="pill c-${st.color}${truck ? ' truck' : ''}"${data}>${tk}${esc(st.label)}${xb}</span>`;
}
function refPill(card, recId, label, { x, xData } = {}) {
  const xb = x ? `<span class="x" data-x="${esc(x)}"${xData != null ? ` data-id="${esc(xData)}"` : ''}>✕</span>` : '';
  // customer-name pills get long — clip to ~9 chars (full name stays in the tooltip)
  const tip = (card === 'customers' && label && label.length > 9) ? ` data-tip="${esc(label)}"` : '';
  const shown = (card === 'customers' && label && label.length > 9) ? label.slice(0, 9).trimEnd() + '…' : label;
  return `<span class="pill ref" data-pill-card="${card}" data-pill-rec="${esc(recId)}"${tip}>${esc(shown)}${xb}</span>`;
}
/** A Unit pill — colored by the unit's Inspection Status (Jac, 2026-06-07). */
function unitPill(unitId, { x } = {}) {
  const u = IDX.unit.get(unitId);
  if (!u) return '<span class="pill c-gray">No unit</span>';
  const color = getStatus('unitInspectionStatus', u.inspectionStatus).color;
  const xb = x ? `<span class="x" data-x="${esc(x)}">✕</span>` : '';
  return `<span class="pill c-${color}" data-pill-card="units" data-pill-rec="${esc(unitId)}">${esc(u.name)}${xb}</span>`;
}
const badge = (label, color = 'gray') => `<span class="pill c-${color}">${esc(label)}</span>`;
/** A funnel-stage pill (§7.1) — clickable to change stage via a dropdown. */
function funnelPill(custId, which, stage) {
  const st = getStatus('funnelStage', stage);
  return `<span class="pill c-${st.color} js-funnel" data-rec="${esc(custId)}" data-which="${which}">${esc(st.label)}</span>`;
}

/* ════════════════════════════════════════════════════════════════════════
   6. Row meta (tab label/dot) + the universal row template (§6.2 #2)
   ════════════════════════════════════════════════════════════════════════ */
const ROW_META = {
  rentals:    (r) => ({ title: IDX.unit.get(r.unitId)?.name || r.rentalName || 'Rental', sub: IDX.customer.get(r.customerId)?.name || '', color: getStatus('rentalStatus', rentalDisplayStatus(r)).color }),
  customers:  (c) => ({ title: c.name, sub: c.phone || c.company || '', color: getStatus('customerPayStatus', c.payStatus).color }),
  units:      (u) => ({ title: u.name, sub: IDX.category.get(u.categoryId)?.name || '', color: getStatus('unitInspectionStatus', u.inspectionStatus).color }),
  categories: (c) => ({ title: c.name, sub: c.fuelType || '', color: 'orange' }),
  invoices:   (i) => ({ title: i.invoiceId, sub: IDX.customer.get(i.customerId)?.name || '', color: getStatus('invoiceStatus', invoiceTotals(i).status).color }),
  workOrders: (w) => ({ title: `${IDX.unit.get(w.unitId)?.name || '—'} — ${w.woReport}`, sub: fmtShortDate(w.date), color: getStatus('woPhase', w.phase).color }),
  inspections:(n) => ({ title: `${IDX.unit.get(n.unitId)?.name || '—'} — ${fmtShortDate(n.date)}`, sub: inspResult(n).label, color: inspResult(n).color }),
  serviceOrders:(u) => ({ title: u.name, sub: 'Service', color: (topServiceForUnit(u)?.color) || 'green' }),
};

/* row-background visualization layers (§6.2 #8) → returns inline-style div */
/* Fleet status → row-background tint (units out of active service). Active = none.
   Sold is GREEN (out of inventory, revenue realized) per Jac. */
const FLEET_ROW_TINT = { 'Sold': 'green', 'For Sale': 'purple', 'Inactive': 'gray', 'Onboard': 'blue', 'Purchased': 'navy' };
function rowViz(card, rec) {
  // §10 availability tint takes precedence while a rental window is in scope
  if (availWin && availUnavailable(card, rec)) return `<div class="row-viz" style="background:var(--red-bg)"></div>`;
  if (card === 'rentals') return rentalTimelineViz(rec);
  if (card === 'customers') return customerSpectrumViz(rec);
  if (card === 'categories') return categoryMixViz(rec.categoryId);
  if (card === 'serviceOrders') { const s = topServiceForUnit(rec); if (s) return `<div class="row-viz" style="background:linear-gradient(90deg, var(--${s.color}-bg), transparent 60%)"></div>`; }
  if (card === 'units') {
    if (rec.fleetStatus !== 'Active') return `<div class="row-viz" style="background:var(--${FLEET_ROW_TINT[rec.fleetStatus] || 'gray'}-bg)"></div>`;
    if (rec.inspectionStatus === 'Failed') return `<div class="row-viz" style="background:var(--red-bg)"></div>`;
  }
  if (card === 'invoices') { const s = invoiceTotals(rec).status; return `<div class="row-viz" style="background:linear-gradient(90deg, var(--${getStatus('invoiceStatus', s).color}-bg), transparent 70%)"></div>`; }
  return '';
}
function rentalTimelineViz(r) {
  const color = getStatus('rentalStatus', rentalDisplayStatus(r)).color;
  const s = parseISO(r.startDate), e = parseISO(r.endDate);
  let fill = 0;
  if (s && e) { const total = Math.max(1, e - s); fill = Math.max(0, Math.min(1, (TODAY - s) / total)); }
  return `<div class="row-viz" style="background:linear-gradient(90deg, var(--${color}-bg) ${Math.round(fill * 100)}%, transparent ${Math.round(fill * 100)}%)"></div>`;
}
function customerSpectrumViz(c) {
  const pct = c._digest?.activePct ?? 0;
  return `<div class="row-viz" style="background:linear-gradient(90deg, var(--red-bg), var(--orange-bg), var(--yellow-bg), var(--green-bg)); clip-path: inset(0 ${100 - pct}% 0 0)"></div>`;
}
function categoryMixViz(catId) {
  const mix = categoryMix(catId);
  if (!mix.total) return '';
  const g = (mix.Ready / mix.total) * 100, y = (mix['Not Ready'] / mix.total) * 100, r = (mix.Failed / mix.total) * 100;
  return `<div class="row-viz" style="background:linear-gradient(90deg, var(--mix-green) 0 ${g}%, var(--mix-yellow) ${g}% ${g + y}%, var(--mix-red) ${g + y}% ${g + y + r}%)"></div>`;
}

/* ════════════════════════════════════════════════════════════════════════
   7. Per-card list rows
   ════════════════════════════════════════════════════════════════════════ */
function rowEl(card, rec) {
  const id = idOf(card, rec);
  const inner = ROWS[card] ? ROWS[card](rec) : genericRow(card, rec);
  let extra = '';
  if (card === 'units') {
    if (rec.fleetStatus !== 'Active') extra = ' fleet-dim';        // out of active inventory → tint + dim
    else if (rec.inspectionStatus === 'Failed') extra = ' unavailable';
  }
  if (card === 'customers' && /Blacklist/i.test(rec.accountType || '')) extra += ' unavailable';   // §9 blacklisted → red
  // §10 — under an active rental window, tint every unavailable unit/category red
  if (availWin && availUnavailable(card, rec)) extra += ' unavailable';
  if (card === 'categories' && state.pick?.catFilter === rec.categoryId) extra += ' selected';
  const node = el('div', 'row' + extra);
  node.dataset.card = card; node.dataset.rec = id;
  node.innerHTML = `${rowViz(card, rec)}
    <div class="r-actions">
      <button class="rbtn js-anchor" title="Anchor (⊞)">${I.circle}</button>
      <button class="rbtn js-newtab" title="Open in new tab (+)">${I.plus}</button>
    </div>
    <div class="row-content">${inner}</div>`;
  return node;
}
function genericRow(card, rec) {
  const meta = ROW_META[card](rec);
  return `<div class="row-1"><span class="r-title">${esc(meta.title)}</span><span class="r-fields"><span>${esc(meta.sub)}</span></span></div>
          <div class="row-2">${badge(idOf(card, rec), 'gray')}</div>`;
}

const ROWS = {
  /* ── RENTALS — fully built (§12.2 list view) ── */
  rentals: (r) => {
    const unit = IDX.unit.get(r.unitId);
    const cat = IDX.category.get(r.categoryId);
    const cust = IDX.customer.get(r.customerId);
    const price = rentalPrice(r);
    const inv = r.invoiceId ? IDX.invoice.get(r.invoiceId) : null;
    const truck = showsTruck(r.status, r.transportType);
    const name = unit?.name || r.legacyUnitName || r.rentalName || 'Rental';
    // row 1 shows just the price — rows are date-ordered, so the per-row window is redundant
    const row1 = `<div class="row-1">
      <span class="r-title">${esc(name)}</span>
      <span class="r-fields">
        ${cat ? `<span>${esc(cat.name)}</span>` : ''}
        ${price ? `<span class="r-key">${money(price.price)}</span>` : ''}
      </span></div>`;
    const row2 = `<div class="row-2">
      ${statusPill('rentalStatus', rentalDisplayStatus(r), { card: 'rentals', recId: r.rentalId, truck })}
      ${cust ? refPill('customers', r.customerId, cust.name) : ''}
      ${inv ? statusPill('invoiceStatus', invoiceTotals(inv).status, { card: 'invoices', recId: inv.invoiceId }) : ''}
      ${unit ? statusPill('unitInspectionStatus', unit.inspectionStatus, { card: 'units', recId: unit.unitId }) : ''}
    </div>`;
    return row1 + row2;
  },

  customers: (c) => {
    const active = DATA.rentals.filter((r) => r.customerId === c.customerId && ACTIVE_RENTAL.has(r.status) && r.status !== 'Quote');
    const unitPills = active.map((r) => { const u = IDX.unit.get(r.unitId); return u ? statusPill('rentalStatus', rentalDisplayStatus(r), { card: 'rentals', recId: r.rentalId }) : ''; }).join('');
    const isMember = /Member/.test(c.accountType || '') && c.accountType !== 'Member Incomplete';
    const isBusiness = /business/i.test(c.accountType || '') && !/non-?business/i.test(c.accountType || '');   // "Non-Business" must NOT match
    return `<div class="row-1"><span class="r-title">${esc(c.name)}</span><span class="r-fields"><span>${esc(c.phone || '')}</span></span></div>
      <div class="row-2">
        ${badge(isBusiness ? 'Business' : 'Non-Business', isBusiness ? 'blue' : 'gray')}
        ${isMember ? badge('Member', 'purple') : ''}
        ${statusPill('customerPayStatus', c.payStatus, { card: 'customers', recId: c.customerId })}
        ${unitPills}
      </div>`;
  },

  units: (u) => {
    const cat = IDX.category.get(u.categoryId);
    const ar = activeRentalForUnit(u.unitId);
    const wo = openWOForUnit(u.unitId);
    const svc = topServiceForUnit(u);
    // §10: while a rental window is in scope, Row 2 leads with the availability
    // verdict for THAT window (green Available / fleet / Failed / conflicting rental).
    let availLead = '';
    if (availWin) {
      if (isUnitAvailableFor(u, availWin.start, availWin.end, availWin.selfId)) availLead = `<span class="pill c-green">Available</span>`;
      else if (u.fleetStatus !== 'Active') availLead = statusPill('unitFleetStatus', u.fleetStatus);
      else if (u.inspectionStatus === 'Failed') availLead = `<span class="pill c-red">Failed</span>`;
      else { const cf = rentalsOverlappingUnit(u.unitId, availWin.start, availWin.end, availWin.selfId)[0]; availLead = cf ? statusPill('rentalStatus', rentalDisplayStatus(cf), { card: 'rentals', recId: cf.rentalId }) : `<span class="pill c-red">Unavailable</span>`; }
    }
    // §12.4: QR badge on Row 1; Inspection Status pill lives on Row 2 with the other
    // status badges. Fleet Status is conveyed by the ROW BACKGROUND (when not Active).
    return `<div class="row-1"><span class="r-title">${esc(u.name)}</span><span class="r-fields">
        ${cat ? `<span>${esc(cat.name)}</span>` : ''}<span class="r-key">${num(u.currentHours)} HRS</span></span>
        <span class="pill c-gray" title="QR code">${I.qr}</span></div>
      <div class="row-2">
        ${availWin ? availLead : (ar ? statusPill('rentalStatus', rentalDisplayStatus(ar), { card: 'rentals', recId: ar.rentalId }) : '')}
        ${svc ? `<span class="pill c-${svc.color}">${esc(svcText(svc))}</span>` : ''}
        ${wo ? statusPill('woPhase', wo.phase, { card: 'workOrders', recId: wo.woId }) : ''}
        ${statusPill('unitInspectionStatus', u.inspectionStatus, { card: 'units', recId: u.unitId })}
      </div>`;
  },

  categories: (c) => {
    const mix = categoryMix(c.categoryId);
    const st = categoryStats(c);
    // §10: under a rental window, lead with how many units are available for it
    // (a category with zero available shows a red "0" pill).
    let availLead = '';
    if (availWin) { const n = categoryAvailableCount(c.categoryId, availWin.start, availWin.end, availWin.selfId); availLead = n > 0 ? badge(`${n} Available`, 'green') : badge('0 Available', 'red'); }
    // §12.3 Row 1 = name · 1-Day · 7-Day · 4-Week · Avg Hours; Row 2 = mix counts · ROI
    return `<div class="row-1"><span class="r-title">${esc(c.name)}</span><span class="r-fields">
        <span>${money(c.rate1Day)}/1d</span><span>${money(c.rate7Day)}/7d</span><span>${money(c.rate4Wk)}/4wk</span><span class="r-key">${num(st.avgHours)} HRS</span></span></div>
      <div class="row-2">
        ${availLead}${mix.Ready ? badge(`${mix.Ready} Ready`, 'green') : ''}${mix['Not Ready'] ? badge(`${mix['Not Ready']} Not Ready`, 'yellow') : ''}${mix.Failed ? badge(`${mix.Failed} Failed`, 'red') : ''}${st.roi != null ? badge(`${st.roi}% ROI`, st.roi >= 0 ? 'green' : 'red') : ''}
      </div>`;
  },

  invoices: (i) => {
    const t = invoiceTotals(i);
    const cust = IDX.customer.get(i.customerId);
    // balance colors: paid→both green; partial→paid orange + total green; unpaid→paid red + total green
    const paidColor = (t.paid >= t.total && t.total > 0) ? 'green' : (t.paid > 0 ? 'orange' : 'red');
    // §12.5 Row 2 = invoice status + each line-item rental's status pill + the rental window
    const rentalPills = (i.lineItems || []).filter((li) => li.kind === 'rental' && li.ref).map((li) => { const r = IDX.rental.get(li.ref); return r ? statusPill('rentalStatus', rentalDisplayStatus(r), { card: 'rentals', recId: r.rentalId }) : ''; }).join('');
    // rental window now lives on ROW 2 — first linked rental that carries dates
    const winR = (i.rentalIds || []).map((id) => IDX.rental.get(id)).find((r) => r && (r.startDate || r.endDate));
    const win = winR ? fmtWindow(winR.startDate, winR.endDate) : '';
    return `<div class="row-1"><span class="r-title">${esc(i.invoiceId)}</span><span class="r-fields">
        <span>${esc(cust?.name || '')}</span><span class="r-key"><b style="color:var(--${paidColor})">${money(t.paid)}</b> / <b style="color:var(--green)">${money(t.total)}</b></span><span>${esc(fmtShortDate(i.dueDate))}</span></span></div>
      <div class="row-2">${statusPill('invoiceStatus', t.status, { card: 'invoices', recId: i.invoiceId })}${rentalPills}${win ? `<span class="r-key">${esc(win)}</span>` : ''}</div>`;
  },

  workOrders: (w) => {
    const unit = IDX.unit.get(w.unitId);
    const cust = w.customerId ? IDX.customer.get(w.customerId) : null;
    const partsCost = (w.lineItems || []).reduce((a, li) => a + (Number(li.cost) || 0), 0);
    const labor = (w.lineItems || []).reduce((a, li) => a + (Number(li.hours) || 0), 0) || w.laborHours || 0;
    const priceIfBilled = woBillable(w);
    return `<div class="row-1"><span class="r-title">${esc(`${unit?.name || '—'} — ${w.woReport}`)}</span>
        <span class="r-fields"><span>${fmtShortDate(w.date)}</span></span></div>
      <div class="row-2">
        ${badge(getStatus('woType', w.woType).label, getStatus('woType', w.woType).color)}
        ${statusPill('woPhase', w.phase, { card: 'workOrders', recId: w.woId })}
        ${unit ? statusPill('unitInspectionStatus', unit.inspectionStatus, { card: 'units', recId: unit.unitId }) : ''}
        ${badge(getStatus('billCustomer', w.billCustomer).label, getStatus('billCustomer', w.billCustomer).color)}
        ${w.billCustomer === 'Yes' && cust ? refPill('customers', w.customerId, cust.name) : ''}
        ${w.billCustomer === 'Yes' ? `<span class="r-key">${money(priceIfBilled)}</span>` : ''}
      </div>`;
  },

  inspections: (n) => {
    const unit = IDX.unit.get(n.unitId);
    const ir = inspResult(n);
    const ar = unit ? activeRentalForUnit(unit.unitId) : null;
    return `<div class="row-1"><span class="r-title">${esc(`${unit?.name || '—'} — ${fmtShortDate(n.date)}`)}</span></div>
      <div class="row-2">
        <span class="pill c-${ir.color}" data-pill-card="inspections" data-pill-rec="${esc(n.inspectionId)}">${esc(ir.label)}</span>
        ${badge('Wash: ' + (n.wash || 'Pending'), n.wash === 'Yes' ? 'green' : 'gray')}
        ${badge(getStatus('billCustomer', n.billCustomer).label, getStatus('billCustomer', n.billCustomer).color)}
        ${n.woId ? refPill('workOrders', n.woId, 'WO') : ''}
        ${ar ? statusPill('rentalStatus', rentalDisplayStatus(ar), { card: 'rentals', recId: ar.rentalId }) : ''}
      </div>`;
  },

  serviceOrders: (u) => {
    const top = topServiceForUnit(u) || serviceOrdersForUnit(u, u.serviceCompletions || {}, { hoursField: 'currentHours', baselineField: 'purchaseHours' })[0];
    const ar = activeRentalForUnit(u.unitId);
    return `<div class="row-1"><span class="r-title">${esc(u.name)}</span><span class="r-fields">
        <span>${esc(top?.name || 'Service')}</span><span>Every ${top?.intervalHours || '—'} HRS</span></span></div>
      <div class="row-2">
        ${top ? `<span class="pill c-${top.color}">${esc(getStatus('serviceStatus', top.status).label)}</span>` : ''}
        ${top ? `<span class="pill c-${top.color}">${esc(svcText(top))}</span>` : ''}
        ${ar ? statusPill('rentalStatus', rentalDisplayStatus(ar), { card: 'rentals', recId: ar.rentalId }) : ''}
      </div>`;
  },
};

/* ════════════════════════════════════════════════════════════════════════
   8. Standard mode (detail) renderers
   ════════════════════════════════════════════════════════════════════════ */
/* Label-free stacked field (§6.2 #3): value + optional prefix/suffix qualifier.
 * `value` may be raw text (escaped) or pre-built HTML (pills) via {html:true}. */
function kv(value, { pfx, sfx, wrap, big, html } = {}) {
  const v = html ? value : esc(value);
  const attach = sfx && sfx[0] === '/';   // unit suffixes (/one-way, /1-day…) attach to the value with no space
  return `<div class="kv${wrap ? ' wrap' : ''}">${pfx ? `<span class="pfx">${esc(pfx)}</span>` : ''}<span class="v${big ? ' big' : ''}">${v}${attach ? `<span class="sfx">${esc(sfx)}</span>` : ''}</span>${sfx && !attach ? `<span class="sfx">${esc(sfx)}</span>` : ''}</div>`;
}
/* A row of adjacent pills, no label (e.g. Unit + Category side by side). */
const kvPills = (html) => `<div class="kv pillrow">${html}</div>`;

/* Generic click-to-edit field for ANY card (rentals/units/workOrders/…). Mirrors
   the customer efield but routes through recOf/reindex via the 'field' edit kind,
   so a one-field change auto-saves per-record. Empty value renders "+ placeholder".
   opts: { type:'text'|'number'|'date', pfx, sfx, wrap, fmt(value) }. */
function efld(card, rec, idField, field, ph, opts = {}) {
  const raw = rec[field];
  const has = raw !== '' && raw != null;
  const disp = has ? esc(opts.fmt ? opts.fmt(raw) : String(raw)) : `<span class="add-field">+ ${esc(ph)}</span>`;
  const pfx = opts.pfx ? `<span class="pfx">${esc(opts.pfx)}</span>` : '';
  const sfx = (has && opts.sfx) ? `<span class="sfx">${esc(opts.sfx)}</span>` : '';
  return `<div class="kv${opts.wrap ? ' wrap' : ''}">${pfx}<span class="v inline-edit" data-edit="field" data-card="${card}" data-field="${field}" data-rec="${esc(String(rec[idField]))}" data-ph="${esc(ph)}" data-type="${opts.type || 'text'}"${opts.wrap ? ' style="white-space:normal"' : ''}>${disp}</span>${sfx}</div>`;
}

const DETAIL = {
  /* ── RENTALS — fully built (§12.2 standard mode) ── */
  rentals: (r, cs) => {
    const unit = IDX.unit.get(r.unitId);
    const cat = IDX.category.get(r.categoryId);
    const cust = IDX.customer.get(r.customerId);
    const price = rentalPrice(r);
    const tr = rentalTransport(r);
    const inv = r.invoiceId ? IDX.invoice.get(r.invoiceId) : null;
    const invT = inv ? invoiceTotals(inv) : null;
    const truck = showsTruck(r.status, r.transportType);
    const stColor = getStatus('rentalStatus', rentalDisplayStatus(r)).color;
    const s = parseISO(r.startDate), e = parseISO(r.endDate);
    let fill = 0; if (s && e) { const total = Math.max(1, e - s); fill = Math.max(0, Math.min(1, (TODAY - s) / total)) * 100; }

    const hasWin = s && e;
    const statusBar = (r.mock && !hasWin)
      ? `<button class="statusbar draftwin wintrigger js-open-winpicker" data-rec="${r.rentalId}"><span class="wt-label">${r.startDate ? esc(fmtShortDate(r.startDate)) + ' → pick end' : 'Select rental window'}</span><span class="pill c-${stColor}">${esc(getStatus('rentalStatus', rentalDisplayStatus(r)).label)}</span></button>`
      : `<div class="statusbar js-statusbar js-open-winpicker" data-rec="${r.rentalId}">
        <div class="sb-fill" style="background:linear-gradient(90deg, var(--${stColor}-bg) ${Math.round(fill)}%, var(--panel) ${Math.round(fill)}%)"></div>
        <div class="sb-row">
          <span class="sb-date">${s ? esc(fmtShortDate(r.startDate)) : 'No start'}</span>
          <span class="sb-date">${e ? esc(fmtShortDate(r.endDate)) : 'No end'}</span>
        </div>
        <div class="sb-center">
          <span class="pill c-${stColor} js-status-pill" data-rec="${r.rentalId}">${truck ? `<span class="truck">${I.truck}</span>` : ''}${esc(getStatus('rentalStatus', rentalDisplayStatus(r)).label)}</span>
          ${r.startTime ? `<span class="muted" style="font-size:11px">${esc(r.startTime)}</span>` : ''}
        </div>
      </div>`;
    const pickUnitBtn = `<button class="pill ref js-pick" data-card="${cs?.recType ? 'shop' : 'rentals'}" data-rec="${r.rentalId}" data-slot="unit">+ Pick unit</button>`;
    const pickCustBtn = `<button class="pill ref js-pick" data-card="rentals" data-rec="${r.rentalId}" data-slot="customer">+ Pick customer</button>`;

    // Label-free, stacked (§6.2 #3): Unit + Category pills sit adjacent; transport
    // pill carries its cost as a /one-way (or /round-trip) suffix; address + drive
    // time need no labels.
    const transportPill = `<span class="pill c-${getStatus('transportType', r.transportType).color} js-transport-pill" data-rec="${r.rentalId}">${esc(getStatus('transportType', r.transportType).label)} ${I.chev}</span>`;
    const transportLine = (r.transportType && r.transportType !== 'Self')
      ? `<div class="kv">${transportPill}<span class="v">${tr.price == null ? '-' : money(tr.price)}<span class="sfx">/${r.transportType === 'Round-Trip' ? 'round-trip' : 'one-way'}</span></span></div>`
      : kvPills(transportPill);
    const rentalCol = `<div class="section"><h4>Rental</h4>
      <div class="fieldstack">
        ${kvPills(`${unit ? unitPill(unit.unitId, { x: 'unit-swap' }) : (r.mock ? pickUnitBtn : '<span class="pill c-gray">No unit</span>')}${cat ? refPill('categories', cat.categoryId, cat.name) : ''}`)}
        ${transportLine}
        ${kvPills(`<span class="pill ref inline-edit" data-edit="rentalAddress" data-rec="${r.rentalId}">${r.deliveryAddress ? esc(r.deliveryAddress) : '+ Add address'}</span>`)}
        ${tr.driveMin != null ? kv(`${tr.driveMin} min`, { sfx: '/one-way' }) : ''}
      </div></div>`;

    const invPill = inv
      ? `<span class="pill c-${getStatus('invoiceStatus', invT.status).color}" data-pill-card="invoices" data-pill-rec="${esc(inv.invoiceId)}">${esc(invoiceShort(inv.invoiceId))} · ${esc(invT.status)}<span class="x" data-x="inv-remove">✕</span></span>`
      : (r.mock && cust && s && e ? `<button class="pill ref js-create-invoice" data-rec="${r.rentalId}">+ Create invoice</button>` : '<span class="pill c-gray">No invoice</span>');
    const invoiceCol = `<div class="section"><h4>Invoice</h4>
      <div class="fieldstack">
        ${kvPills(cust ? refPill('customers', r.customerId, cust.name, { x: 'cust-swap' }) : (r.mock ? pickCustBtn : '<span class="pill c-gray">No customer</span>'))}
        ${kvPills(invPill)}
        ${invT ? kv(money(invT.balance), { sfx: 'due', big: true }) : ''}
        ${price ? kv(money(price.price), { sfx: `· ${price.rate}` }) : ''}
        ${efld('rentals', r, 'rentalId', 'po', 'Add PO', { fmt: (v) => 'PO ' + v })}
      </div></div>`;

    // §9 Field Call — a unit breaking mid-rental: flag the rental (red FC), fail the unit,
    // auto-open a Field-Call WO. Offered while a unit is attached and the rental is live.
    const fcLive = unit && ACTIVE_RENTAL.has(r.status) && r.status !== 'Quote';
    const fcRow = r.fieldCall
      ? `<button class="pill c-red js-clear-fc" data-rec="${r.rentalId}">Field Call active — clear</button>`
      : (fcLive ? `<button class="pill ref js-field-call" data-rec="${r.rentalId}">${I.video} Mark Field Call</button>` : '');
    const inspSection = `<div class="section"><h4>Inspection</h4>
      <div class="fieldstack">
        ${kvPills(unit ? statusPill('unitInspectionStatus', unit.inspectionStatus, { card: 'units', recId: unit.unitId }) : '<span class="pill c-gray">—</span>')}
        <div class="kv"><span class="pfx">Start</span><span class="v inline-edit" data-edit="field" data-card="rentals" data-field="startHours" data-rec="${r.rentalId}" data-ph="Start hrs" data-type="number">${r.startHours != null ? num(r.startHours) + ' HRS' : '<span class="add-field">+ set</span>'}</span><span class="pfx" style="margin-left:8px">Return</span><span class="v inline-edit" data-edit="field" data-card="rentals" data-field="returnHours" data-rec="${r.rentalId}" data-ph="Return hrs" data-type="number">${r.returnHours != null ? num(r.returnHours) + ' HRS' : '<span class="add-field">+ set</span>'}</span></div>
        ${kvPills(`<span class="pill ref">${I.video} On-Rent</span><span class="pill ref">${I.video} Returning</span>`)}
        ${fcRow ? kvPills(fcRow) : ''}
      </div></div>`;

    const notes = `<div class="section"><h4>Notes</h4>${efld('rentals', r, 'rentalId', 'notes', 'Add notes', { wrap: true })}</div>`;
    const history = historySection('rentals', r, cs);

    return `<div class="detail">
      <div class="detail-head"><span class="d-title inline-edit" data-edit="field" data-card="rentals" data-field="rentalName" data-rec="${r.rentalId}" data-ph="Rental name">${esc(r.rentalName || unit?.name || 'Rental')}</span>${r.fieldCall ? badge('FC', 'red') : ''}</div>
      ${statusBar}
      ${notes}
      <div class="detail-cols">${rentalCol}${invoiceCol}</div>
      ${inspSection}
      ${history}
    </div>`;
  },

  /* ── UNITS — fully built (§12.4 standard mode) ── */
  units: (u, cs) => {
    const cat = IDX.category.get(u.categoryId);
    const repair = unitRepairCost(u.unitId);
    const totalRev = unitTotalRevenue(u.unitId);
    const monthsOwned = u.purchaseDate ? Math.max(1, Math.round((TODAY - parseISO(u.purchaseDate)) / 2592000000)) : 0;
    const avgRevMo = monthsOwned ? Math.round(totalRev / monthsOwned) : 0;
    const yr = (iso) => `${fmtShortDate(iso)}, ${parseISO(iso).getFullYear()}`;
    const makeModel = [u.year, u.make, u.model].filter(Boolean).join(' ');

    const specs = `<div class="section"><h4>Specs</h4><div class="fieldstack">
      ${kvPills(cat ? refPill('categories', cat.categoryId, cat.name) : '<span class="pill c-gray">No category</span>')}
      ${efld('units', u, 'unitId', 'serial', 'Add serial', { pfx: 'S/N' })}
      ${efld('units', u, 'unitId', 'year', 'Year', { type: 'number' })}
      ${efld('units', u, 'unitId', 'make', 'Make')}
      ${efld('units', u, 'unitId', 'model', 'Model')}
      ${efld('units', u, 'unitId', 'weight', 'Weight')}
      ${efld('units', u, 'unitId', 'assignedMechanic', 'Assign mechanic', { sfx: 'mechanic' })}
      <div class="kv"><span class="v inline-edit" data-edit="unitHours" data-rec="${u.unitId}">${num(u.currentHours)} HRS</span></div>
    </div></div>`;
    const gps = `<div class="section"><h4>GPS</h4><div class="fieldstack">
      ${kvPills(u.gpsStatus ? statusPill('gpsStatus', u.gpsStatus) : '<span class="pill c-gray">No GPS</span>')}
      ${efld('units', u, 'unitId', 'gpsType', 'GPS unit/type')}
      ${efld('units', u, 'unitId', 'gpsPlacement', 'Placement')}
    </div></div>`;
    const investment = `<div class="section"><h4>Investment</h4><div class="fieldstack">
      ${efld('units', u, 'unitId', 'purchasePrice', 'Purchase price', { type: 'number', sfx: 'paid', fmt: money })}
      ${efld('units', u, 'unitId', 'purchaseDate', 'Purchase date', { type: 'date', sfx: 'purchased', fmt: yr })}
      ${efld('units', u, 'unitId', 'trueCost', 'True cost', { type: 'number', sfx: 'true cost', fmt: money })}
      ${efld('units', u, 'unitId', 'purchaseHours', 'Hours at purchase', { type: 'number', sfx: 'at purchase', fmt: (v) => num(v) + ' HRS' })}
      ${kv(money(repair), { sfx: 'repairs' })}
      ${kv(money(avgRevMo), { sfx: '/mo avg' })}
      ${kv(money(totalRev), { sfx: 'total revenue' })}
    </div></div>`;
    const notes = `<div class="section"><h4>Notes</h4>${efld('units', u, 'unitId', 'notes', 'Add notes', { wrap: true })}</div>`;
    return `<div class="detail">
      <div class="detail-head"><span class="d-title inline-edit" data-edit="field" data-card="units" data-field="name" data-rec="${u.unitId}" data-ph="Unit name">${esc(u.name)}</span><span class="pill c-${getStatus('unitFleetStatus', u.fleetStatus).color} js-fleetstatus" data-rec="${u.unitId}">${esc(getStatus('unitFleetStatus', u.fleetStatus).label)} ${I.chev}</span>${statusPill('unitInspectionStatus', u.inspectionStatus)}<button class="pill ref js-wash-request" data-rec="${u.unitId}">${I.video} Request Wash</button><span class="pill c-gray">${I.qr} QR</span></div>
      <div class="detail-cols">${specs}${gps}</div>
      ${investment}
      ${notes}
      ${historySection('units', u, cs)}
    </div>`;
  },

  /* ── CUSTOMERS — fully built (§12.1 standard mode: contact · account · funnels) ── */
  customers: (c, cs) => {
    const d = c._digest || {};
    const isMember = /Member/.test(c.accountType || '') && c.accountType !== 'Member Incomplete';
    const isBusiness = /business/i.test(c.accountType || '') && !/non-?business/i.test(c.accountType || '');   // "Non-Business" must NOT match
    const yr = (iso) => `${fmtShortDate(iso)}, ${parseISO(iso).getFullYear()}`;

    // §7.1 — every contact/account detail is click-to-edit (auto-saves via the persist hook)
    const efield = (f, ph, wrap) => { const val = c[f]; return `<div class="kv"><span class="v inline-edit" data-edit="custField" data-field="${f}" data-rec="${c.customerId}" data-ph="${esc(ph)}"${wrap ? ' style="white-space:normal"' : ''}>${val ? esc(val) : `<span class="add-field">+ ${esc(ph)}</span>`}</span></div>`; };
    const contact = `<div class="section"><h4>Contact</h4><div class="fieldstack">
      ${efield('firstName', 'First name')}${efield('lastName', 'Last name')}
      ${efield('phone', 'Add phone')}${efield('email', 'Add email')}
      ${efield('company', 'Add company')}${efield('address', 'Add address', true)}
    </div></div>`;
    const account = `<div class="section"><h4>Account</h4><div class="fieldstack">
      ${kvPills(`${badge(isBusiness ? 'Business' : 'Non-Business', isBusiness ? 'blue' : 'gray')}${c.requiresPO ? badge('PO Required', 'yellow') : ''}`)}
      ${efield('industry', 'Add industry')}${efield('accountNotes', 'Add notes', true)}
      ${kv(`${money(d.totalPaid)} total · ${d.visits || 0} visits · ${d.years || 0} yrs · every ${d.avgFrequencyDays || 0} days`, { wrap: true })}
    </div></div>`;
    // name → badges → full-width activity bar → sections (Jac 2026-06-07); even .detail gaps
    const title = `<span class="d-title">${esc(fullName(c)) || 'New Customer'}</span>`;
    const acctDone = !!(c.selfie && c.signature);
    const selfieThumb = c.selfie ? `<img class="cust-selfie" src="${esc(c.selfie)}" alt="" />` : '';
    const agPill = c.agreementSignedAt ? `<button class="pill c-green js-view-agreement" data-rec="${c.customerId}" title="View signed agreement">${esc(AGREEMENTS[c.agreementType]?.title || 'Agreement')} ✓</button>` : '';
    const badges = `<div class="detail-badges pillrow">${selfieThumb}${badge(isBusiness ? 'Business' : 'Non-Business', isBusiness ? 'blue' : 'gray')}${isMember ? badge('Member', 'purple') : ''}${statusPill('customerPayStatus', c.payStatus)}${agPill}<span class="spacer"></span>${acctDone ? '' : badge('Incomplete', 'yellow')}<button class="pill ref js-edit-customer" data-rec="${c.customerId}">${acctDone ? 'Edit account' : 'Complete account'}</button></div>`;
    const activeBar = `<div class="active-bar wide"><div class="active-spectrum" style="clip-path:inset(0 ${100 - (d.activePct || 0)}% 0 0)"></div><span class="active-lbl">${d.activePct || 0}% Active</span></div>`;

    const intCats = (c.interestedCategoryIds || []).map((id) => { const cat = IDX.category.get(id); return cat ? refPill('categories', id, cat.name, { x: 'intcat-remove', xData: id }) : ''; }).join('');
    const usedSales = `<div class="section"><h4>Used Sales</h4><div class="fieldstack">
      ${kvPills(funnelPill(c.customerId, 'usedSales', c.usedSalesStage || 'Inbound Lead'))}
      <div class="kv pillrow">${intCats}<button class="pill ref js-addcat" data-rec="${c.customerId}">+ Add Category</button></div>
    </div></div>`;
    const membership = `<div class="section"><h4>Membership</h4><div class="fieldstack">
      ${kvPills(funnelPill(c.customerId, 'membership', c.membershipStage || 'Inbound Lead'))}
      ${isMember && c.paidUntil ? kv(yr(c.paidUntil), { sfx: 'paid until' }) : ''}
      ${c.paidCadence ? kvPills(`${badge('Paid ' + c.paidCadence, 'green')}${c.unlimitedTransport ? badge('Unlimited Transport', 'purple') : ''}`) : ''}
      ${c.paidFees ? kv(money(c.paidFees), { sfx: 'paid fees' }) : ''}
    </div></div>`;
    const log = (c.activityLog || []).map((a) => `<div class="hitem"><span class="htime">${esc(fmtShortDate(a.when))}</span><span>${esc(a.text)}</span></div>`).join('');
    // §12.1 — the action entry + Record/Schedule lead the Activity Log (they're related)
    const activity = `<div class="section"><h4>Activity Log</h4>
      <div class="pillrow" style="margin-bottom:10px">
        <span class="pill ref inline-edit" data-edit="salesAction" data-rec="${c.customerId}">${c.salesAction ? esc(c.salesAction) : '+ Add action'}</span>
        <button class="pill ref js-funnel-record" data-rec="${c.customerId}">Record</button>
        <button class="pill ref js-funnel-schedule" data-rec="${c.customerId}">Schedule</button>
      </div>
      <div class="hlog">${log || '<span class="muted" style="font-size:12px">No activity yet.</span>'}</div></div>`;

    return `<div class="detail">
      <div class="detail-head">${title}</div>
      ${badges}
      ${activeBar}
      <div class="detail-cols">${contact}${account}</div>
      <div class="detail-cols">${usedSales}${membership}</div>
      ${activity}
      ${historySection('customers', c, cs)}
    </div>`;
  },

  /* ── CATEGORIES — fully built (§12.3; no in-app editing) ── */
  categories: (c, cs) => {
    const mix = categoryMix(c.categoryId);
    const rmix = categoryRentalMix(c.categoryId);
    const st = categoryStats(c);
    const pct = (n, t) => t ? (n / t) * 100 : 0;
    // §12.3 proportional bars — each segment is clickable (filters Units to that status),
    // count+label inside, colored by the status. `kind` = which field it filters by;
    // `truck` shows a transport glyph for rental segments being delivered.
    const mixSeg = (count, total, label, color, status, kind, truck) => { const p = pct(count, total); if (p <= 0) return ''; const on = state.fleetFilter?.categoryId === c.categoryId && state.fleetFilter?.status === status && state.fleetFilter?.kind === kind ? ' on' : ''; const tk = truck ? `<span class="seg-truck">${I.truck}</span>` : ''; return `<button class="mixseg js-fleet-filter${on}" data-cat="${c.categoryId}" data-status="${esc(status)}" data-kind="${kind}" style="width:${p}%;background:var(--mix-${color})"><span class="mixseg-lbl" style="color:var(--${color})">${count} ${esc(label)}${tk}</span></button>`; };
    const mixBar = mix.total ? `<div class="mixbar tall">${mixSeg(mix.Ready, mix.total, 'Ready', 'green', 'Ready', 'inspection')}${mixSeg(mix['Not Ready'], mix.total, 'Not Ready', 'yellow', 'Not Ready', 'inspection')}${mixSeg(mix.Failed, mix.total, 'Failed', 'red', 'Failed', 'inspection')}</div>` : '';
    // §12.3 second bar — birds-eye RENTAL status: Available + each active status
    // (Tomorrow/Today/Reserved/On Rent/…) in order, with a truck icon for transport.
    const rentSegs = RENTAL_BAR_ORDER.map((stt) => { const ct = rmix.counts[stt] || 0; if (!ct) return ''; const color = stt === 'Available' ? 'gray' : getStatus('rentalStatus', stt).color; return mixSeg(ct, rmix.total, stt, color, stt, 'rental', !!rmix.truck[stt]); }).join('');
    const rentBar = rmix.total ? `<div class="mixbar tall">${rentSegs}</div>` : '';
    const bars = (mixBar || rentBar) ? `<div class="mixbars">${mixBar}${rentBar}</div>` : '';
    const pricing = `<div class="section"><h4>Pricing</h4><div class="fieldstack">
      ${kv(money(c.memberDaily), { sfx: '/day member' })}${kv(money(c.rate1Day), { sfx: '/1-day' })}${kv(money(c.rate7Day), { sfx: '/7-day' })}${kv(money(c.rate4Wk), { sfx: '/4-week' })}${kv(money(c.weekend), { sfx: '/weekend' })}
    </div></div>`;
    const fleet = `<div class="section"><h4>Fleet Summary</h4><div class="fieldstack">
      ${st.forSale ? kvPills(badge(st.forSale + ' For Sale', 'purple')) : ''}
      ${kv(`${num(st.avgHours)} HRS`, { sfx: 'avg hours' })}
      ${c.description ? kv(c.description, { wrap: true }) : ''}
    </div></div>`;
    const investment = `<div class="section"><h4>Investment</h4><div class="fieldstack">
      ${st.roi != null ? kv(`${st.roi}%`, { sfx: 'ROI' }) : ''}
      ${kv(money(st.avgRevUnit), { sfx: '/unit revenue' })}${kv(money(st.avgExpUnit), { sfx: '/unit expenses' })}
      ${kv(money(c.msrp), { sfx: 'MSRP' })}${kv(money(c.askPrice), { sfx: 'ask' })}${kv(money(c.bottomDollar), { sfx: 'bottom dollar' })}
      ${kv('—', { sfx: 'time / dollar util (backend)' })}
    </div></div>`;
    return `<div class="detail">
      <div class="detail-head"><span class="d-title">${esc(c.name)}</span>${c.fuelType ? badge(c.fuelType, 'navy') : ''}${badge(`${mix.total} units`, 'gray')}</div>
      ${bars}
      <div class="detail-cols">${pricing}${fleet}</div>
      ${investment}
      ${historySection('categories', c, cs)}
    </div>`;
  },

  /* ── INVOICES — fully built (§12.5; live, self-building) ── */
  invoices: (i, cs) => {
    const t = invoiceTotals(i);
    const cust = IDX.customer.get(i.customerId);
    const subBy = (kind) => (i.lineItems || []).filter((l) => l.kind === kind).reduce((a, l) => a + (Number(l.amount) || 0), 0);
    const lines = (i.lineItems || []).map((li, idx) => {
      const ref = li.kind === 'rental' ? `data-pill-card="rentals" data-pill-rec="${esc(li.ref)}"` : '';
      // transport line auto-appears from the rental (no remove); rental/WO/custom carry an X (§12.5)
      const x = li.kind !== 'transport' ? `<span class="x line-x" data-x="inv-line-remove" data-idx="${idx}">✕</span>` : '';
      return `<div class="hitem"><span class="pill c-gray" style="min-width:62px;justify-content:center">${esc(li.kind)}</span><span ${ref} class="${li.kind === 'rental' ? 'inv-line-link' : ''}">${esc(li.label)}</span><span class="spacer"></span><b>${money(li.amount)}</b>${x}</div>`;
    }).join('');
    const invoiceSec = `<div class="section"><h4>Invoice</h4><div class="fieldstack">
      ${kvPills(cust ? refPill('customers', i.customerId, cust.name, { x: 'inv-cust-remove' }) : (i.mock ? `<button class="pill ref js-pick" data-card="invoices" data-rec="${i.invoiceId}" data-slot="customer">+ Pick customer</button>` : '<span class="pill c-gray">No customer</span>'))}
      ${kv(money(t.balance), { sfx: 'due', big: true })}
      ${kv(`${money(t.paid)} / ${money(t.total)}`, { sfx: 'paid' })}
      ${kv(fmtShortDate(i.dueDate), { sfx: 'due date' })}
      ${kvPills(`<span class="pill ref inline-edit" data-edit="invoicePO" data-rec="${i.invoiceId}">${esc(i.po ? 'PO ' + i.po : 'Add PO')}</span>${cust?.requiresPO && !i.po ? badge('PO required', 'yellow') : ''}`)}
      ${t.status === 'Paid'
        ? `<div class="pillrow"><span class="pill c-green" style="min-width:0">Paid${i.paymentMethod ? ' · ' + esc(i.paymentMethod) : ''}</span></div>`
        : (canMoney() && t.balance > 0 && t.status !== 'Refunded' && cust
            ? `<div class="pillrow" style="margin-top:2px"><button class="pill c-green js-pay-invoice" data-rec="${i.invoiceId}">${hasCardOnFile(cust) ? 'Pay ' + money(t.balance) : 'Take payment'}</button>${hasCardOnFile(cust) ? `<span class="muted" style="font-size:11px">${esc(cardLabel(cust))}</span>` : '<span class="muted" style="font-size:11px">no card on file</span>'}</div>`
            : '')}
    </div></div>`;
    const lineForm = `<div class="lineform"><input class="lf-in js-lf-label" placeholder="Custom line description" /><div class="lineform-row"><input class="lf-in js-lf-amt" type="number" min="0" placeholder="Amount $" /></div><div class="pillrow"><button class="pill c-green js-line-save" data-rec="${i.invoiceId}">Add line</button><button class="pill c-gray js-line-cancel">Cancel</button></div></div>`;
    const items = `<div class="section"><h4>Items</h4>
      <div class="hlog">${lines || '<span class="muted" style="font-size:12px">No line items</span>'}</div>
      ${state.invLineForm === i.invoiceId ? lineForm : `<div class="pillrow" style="margin-top:8px"><button class="pill ref js-add-line" data-rec="${i.invoiceId}" data-kind="Rental">+ Add Rental</button><button class="pill ref js-add-line" data-rec="${i.invoiceId}" data-kind="WO">+ Add WO</button><button class="pill ref js-add-line" data-rec="${i.invoiceId}" data-kind="Custom">+ Add Custom</button></div>`}
    </div>`;
    const totals = `<div class="section"><h4>Totals</h4><div class="fieldstack">
      ${kv(money(subBy('rental')), { sfx: 'rental sub' })}
      ${subBy('transport') ? kv(money(subBy('transport')), { sfx: 'transport sub' }) : ''}
      ${subBy('parts') ? kv(money(subBy('parts')), { sfx: 'parts sub' }) : ''}
      ${subBy('labor') ? kv(money(subBy('labor')), { sfx: 'labor sub' }) : ''}
      ${kv(money(t.subtotal), { sfx: 'subtotal' })}
      ${kv(t.exempt ? 'Exempt' : money(t.tax), { sfx: `tax (${(TAX_RATE * 100).toFixed(2)}%)` })}
      ${kv(money(t.total), { sfx: 'total', big: true })}
      ${kv(`${money(t.paid)} / ${money(t.total)}`, { sfx: 'paid' })}
    </div></div>`;
    return `<div class="detail">
      <div class="detail-head"><span class="d-title">${esc(i.invoiceId)}</span>${statusPill('invoiceStatus', t.status)}</div>
      ${invoiceSec}
      ${items}
      ${totals}
      ${historySection('invoices', i, cs)}
    </div>`;
  },

  /* ── WORK ORDERS — fully built (§12.6) ── */
  workOrders: (w, cs) => {
    const unit = IDX.unit.get(w.unitId);
    const cat = unit ? IDX.category.get(unit.categoryId) : null;
    const cust = w.customerId ? IDX.customer.get(w.customerId) : null;
    const partsCost = (w.lineItems || []).reduce((a, li) => a + (Number(li.cost) || 0), 0);
    const labor = (w.lineItems || []).reduce((a, li) => a + (Number(li.hours) || 0), 0) || w.laborHours || 0;
    const priceIfBilled = woBillable(w);   // §7.6 tiered parts markup + $150/hr labor
    const journey = (w.lineItems || []).map((li, idx) => `<div class="hitem"><span class="pill c-${getStatus('woPhase', li.phase).color} js-wophase-line" data-rec="${w.woId}" data-idx="${idx}" style="min-width:88px;justify-content:center">${esc(getStatus('woPhase', li.phase).label)} ${I.chev}</span><span>${esc(li.part)}</span><span class="spacer"></span><span class="muted">${li.eta ? fmtShortDate(li.eta) + ' · ' : ''}${li.hours || 0}h${li.vendor ? ' · ' + esc(li.vendor) : ''}</span><b>${money(li.cost)}</b></div>`).join('');
    const billable = partsCost > 0 || labor > 0;
    const alreadyBilled = DATA.invoices.some((i) => (i.lineItems || []).some((li) => li.kind === 'WO' && li.ref === w.woId));
    const billBtn = billable && !alreadyBilled ? `<button class="pill ref js-bill-wo" data-rec="${w.woId}">Bill to invoice →</button>` : (alreadyBilled ? badge('Billed', 'green') : '');
    const partForm = `<div class="lineform">
      <input class="lf-in js-pf-part" placeholder="Part / labor description" />
      <div class="lineform-row"><input class="lf-in js-pf-cost" type="number" min="0" placeholder="Part $ (0 for labor)" /><input class="lf-in js-pf-hours" type="number" min="0" placeholder="Labor hrs" /></div>
      <div class="pillrow"><button class="pill c-green js-part-save" data-rec="${w.woId}">Add line</button><button class="pill c-gray js-part-cancel">Cancel</button></div>
    </div>`;
    const journeySec = `<div class="section"><h4>Journey</h4>
      <div class="hlog">${journey || '<span class="muted" style="font-size:12px">No line items</span>'}</div>
      ${state.woPartForm === w.woId ? partForm : `<div class="pillrow" style="margin-top:8px"><button class="pill ref js-add-part" data-rec="${w.woId}">+ Add Part / Labor</button>${billBtn}</div>`}
    </div>`;
    const billToggle = `<button class="pill ${w.billCustomer === 'Yes' ? 'c-orange' : 'c-gray'} js-wo-bill" data-rec="${w.woId}">Bill customer: ${w.billCustomer === 'Yes' ? 'Yes' : 'No'}</button>`;
    const report = `<div class="section"><h4>Report</h4><div class="fieldstack">
      ${kvPills(`${unit ? unitPill(unit.unitId, { x: 'unit-swap' }) : (w.mock ? `<button class="pill ref js-pick" data-card="shop" data-rec="${w.woId}" data-type="workOrders" data-slot="unit">+ Pick unit</button>` : '<span class="pill c-gray">No unit</span>')}${cat ? refPill('categories', cat.categoryId, cat.name) : ''}${unit ? statusPill('unitInspectionStatus', unit.inspectionStatus, { card: 'units', recId: unit.unitId }) : ''}`)}
      ${kvPills(`${badge(getStatus('woType', w.woType).label, getStatus('woType', w.woType).color)}${cust ? refPill('customers', w.customerId, cust.name) : ''}`)}
      ${efld('workOrders', w, 'woId', 'woReport', 'Report summary')}
      ${efld('workOrders', w, 'woId', 'assignedMechanic', 'Assign mechanic', { sfx: 'mechanic' })}
      ${efld('workOrders', w, 'woId', 'eta', 'Set ETA', { type: 'date', sfx: 'ETA', fmt: fmtShortDate })}
      ${kvPills(billToggle)}
      ${kv(fmtShortDate(w.date), { sfx: 'opened' })}
      ${kv(`${num(w.unitHoursAtCreation)} HRS`, { sfx: 'at creation' })}
      ${kv(money(partsCost), { sfx: 'parts cost' })}${kv(`${labor} HRS`, { sfx: 'labor' })}
      ${w.billCustomer === 'Yes' ? kv(money(priceIfBilled), { sfx: 'if billed' }) : ''}
      ${efld('workOrders', w, 'woId', 'description', 'Add description', { wrap: true })}
    </div></div>`;
    return `<div class="detail">
      <div class="detail-head"><span class="d-title">${esc(`${unit?.name || '—'} — ${w.woReport}`)}</span>${badge(getStatus('woType', w.woType).label, getStatus('woType', w.woType).color)}<span class="pill c-${getStatus('woPhase', w.phase).color} js-wophase" data-rec="${w.woId}">${esc(getStatus('woPhase', w.phase).label)} ${I.chev}</span></div>
      ${journeySec}
      ${report}
      ${historySection('workOrders', w, cs)}
    </div>`;
  },

  /* ── SERVICE ORDERS (§12.7) — Jac 2026-06-07: no Schedule/Reference sections (unit
       pill + hours live in the title; Reference moved into the completion popup). The
       STATUS pill gates the popup; each task shows its last service date+hours. ── */
  serviceOrders: (u, cs) => {
    const rows = serviceOrdersForUnit(u, u.serviceCompletions || {}, { hoursField: 'currentHours', baselineField: 'purchaseHours' });
    const top = rows.find((s) => s.status !== 'ok') || rows[0];
    const ar = activeRentalForUnit(u.unitId);
    const lastFor = (taskId) => { const ls = (u.serviceLog || []).filter((l) => l.taskId === taskId); return ls.length ? ls[ls.length - 1] : null; };
    const list = rows.map((s) => {
      const last = lastFor(s.taskId);
      return `<div class="svc-task">
        <div class="svc-task-top">
          <button class="pill c-${s.color} js-svc-complete" data-unit="${u.unitId}" data-task="${s.taskId}" title="Log a completion" style="min-width:78px;justify-content:center">${esc(getStatus('serviceStatus', s.status).label)}</button>
          <span class="svc-name">${esc(s.name)}</span>
          <span class="spacer"></span>
          <b>${esc(svcText(s))}</b>
        </div>
        <div class="svc-task-sub muted">Every ${s.intervalHours} HRS${last ? ` · last ${esc(fmtShortDate(last.date))} @ ${num(last.hours)} HRS` : ' · never serviced'}</div>
      </div>`;
    }).join('');
    const tasks = `<div class="section"><h4>Service Tasks</h4><div class="hlog">${list}</div></div>`;
    return `<div class="detail">
      <div class="detail-head">${unitPill(u.unitId)}<span class="muted" style="font-size:13px;font-weight:600">${num(u.currentHours)} HRS</span>${ar ? statusPill('rentalStatus', rentalDisplayStatus(ar), { card: 'rentals', recId: ar.rentalId }) : ''}${top ? `<span class="pill c-${top.color}">${esc(getStatus('serviceStatus', top.status).label)}</span>` : ''}</div>
      ${tasks}
      ${historySection('units', u, cs)}
    </div>`;
  },

  /* ── INSPECTIONS (§12.8) — quick Wash/Pass/Fail INLINE; a Fail opens the
       photo/video + description popup. Report kept VERY simple (Jac 2026-06-07). ── */
  inspections: (n, cs) => {
    const unit = IDX.unit.get(n.unitId);
    const ir = inspResult(n);
    const resultPill = `<span class="pill c-${ir.color}">${esc(ir.label)}</span>`;
    const washSet = !(n.wash === '' || n.wash == null);
    const done = inspComplete(n);
    // Report = ONLY the gated flow (unit pill + status live in the title now).
    let gate = '';
    if (!unit) {
      gate = kvPills(`<button class="pill ref js-pick" data-card="shop" data-rec="${n.inspectionId}" data-type="inspections" data-slot="unit">+ Pick unit</button>`);
    } else if (!washSet) {
      gate = `<div class="insp-gate"><span class="insp-gate-lbl">Wash</span><button class="pill c-blue js-insp-wash" data-rec="${n.inspectionId}" data-val="Yes">Wash</button><button class="pill c-gray js-insp-wash" data-rec="${n.inspectionId}" data-val="No">Don't wash</button></div>`;
    } else if (!done) {
      gate = `<div class="insp-gate"><span class="insp-gate-lbl">Checklist</span><button class="pill c-green js-insp-result" data-rec="${n.inspectionId}" data-val="Pass">Pass</button><button class="pill c-red js-insp-result" data-rec="${n.inspectionId}" data-val="Fail">Fail</button></div>`;
    } else if (n.checklist === 'Fail') {
      gate = kvPills(`${n.woId ? refPill('workOrders', n.woId, 'WO') : ''}<button class="pill ref js-open-insp" data-rec="${n.inspectionId}">Failure report →</button>`);
    } else {
      gate = kvPills(`<span class="pill c-green">Ready</span>${washSet ? badge(n.wash === 'Yes' ? 'Washed' : 'No wash', n.wash === 'Yes' ? 'blue' : 'gray') : ''}`);
    }
    const isVideo = (n.photo || '').startsWith('data:video');
    const thumb = n.photo ? (isVideo
      ? `<video class="insp-thumb js-open-insp" data-rec="${n.inspectionId}" src="${esc(n.photo)}" muted></video>`
      : `<img class="insp-thumb js-open-insp" data-rec="${n.inspectionId}" src="${esc(n.photo)}" alt="">`) : '';
    const report = `<div class="section"><h4>Report</h4><div class="fieldstack">
      ${gate}
      ${thumb}
    </div></div>`;
    return `<div class="detail">
      <div class="detail-head">${unit ? unitPill(unit.unitId) : '<span class="d-title">Inspection</span>'}${resultPill}<span class="muted" style="font-size:12px;margin-left:auto">${esc(fmtShortDate(n.date))}</span></div>
      ${report}
      ${historySection('inspections', n, cs)}
    </div>`;
  },
};

/* History section (§0.6) — dotted separator + bg shift, pinned at bottom. */
function historySection(card, rec, cs) {
  // Timestamped actions taken this session (logAction) ride at the top, newest-first,
  // above the date-derived history. Single merge point → every card gets action history.
  const acts = (rec.actions || []).slice().sort((a, b) => b.seq - a.seq).map((a) => {
    const when = fmtShortDate(a.when) + (a.clock ? ` · ${a.clock}` : '');
    return { when, text: a.text, by: a.by || '', search: `${when} ${a.text} ${a.by || ''}` };
  });
  const all = [...acts, ...historyFor(card, rec)];
  const q = (cs?.historySearch || '').trim().toLowerCase();
  const items = q ? all.filter((h) => (h.search || `${h.when} ${h.text}`).toLowerCase().includes(q)) : all;
  const log = items.length
    ? items.map((h) => `<div class="hitem"><span class="htime">${esc(h.when)}</span>${h.pill || ''}<span>${esc(h.text)}</span>${h.by ? `<span class="hby">${esc(h.by)}</span>` : ''}</div>`).join('')
    : `<div class="muted" style="font-size:12px">${q ? 'No matching history.' : 'No history yet.'}</div>`;
  // History Search (§0.6) — appears once the log has some depth.
  const searchBar = all.length >= 3 ? `<input class="mini-search js-history-search" placeholder="Search history…" value="${esc(cs?.historySearch || '')}" />` : '';
  return `<div class="history"><h4>History</h4>${searchBar}<div class="hlog">${log}</div></div>`;
}
function historyFor(card, rec) {
  if (card === 'rentals') {
    const out = [];
    if (rec.invoiceId) { const inv = IDX.invoice.get(rec.invoiceId); if (inv) out.push({ when: fmtShortDate(inv.date), pill: refPill('invoices', inv.invoiceId, invoiceShort(inv.invoiceId)), text: `Invoice ${invoiceTotals(inv).status.toLowerCase()}`, search: `${inv.invoiceId} invoice ${invoiceTotals(inv).status}` }); }
    out.push({ when: fmtShortDate(rec.startDate), text: `Rental created — ${getStatus('rentalStatus', rec.status).label}`, search: `rental ${rec.status} ${rec.rentalName}` });
    return out;
  }
  if (card === 'units' || card === 'serviceOrders') {
    const insp = DATA.inspections.filter((n) => n.unitId === rec.unitId).map((n) => { const ir = inspResult(n); return { when: fmtShortDate(n.date), pill: `<span class="pill c-${ir.color}" data-pill-card="inspections" data-pill-rec="${esc(n.inspectionId)}">${esc(ir.label)}</span>`, text: 'Inspection', search: `${fmtShortDate(n.date)} inspection ${ir.label} ${n.description || ''}` }; });
    const wos = DATA.workOrders.filter((w) => w.unitId === rec.unitId).map((w) => ({ when: fmtShortDate(w.date), pill: refPill('workOrders', w.woId, w.woReport.slice(0, 16)), text: getStatus('woPhase', w.phase).label, search: `${fmtShortDate(w.date)} ${w.woReport} ${w.phase} ${w.woType}` }));
    return [...insp, ...wos].sort((a, b) => (b.when > a.when ? 1 : -1));
  }
  if (card === 'customers') {
    return DATA.rentals.filter((r) => r.customerId === rec.customerId).map((r) => ({ when: fmtShortDate(r.startDate) || '—', pill: refPill('rentals', r.rentalId, IDX.unit.get(r.unitId)?.name || 'Rental'), text: getStatus('rentalStatus', rentalDisplayStatus(r)).label, search: `${r.rentalName} ${r.status} ${IDX.unit.get(r.unitId)?.name || ''}` }));
  }
  return [];
}

/* ════════════════════════════════════════════════════════════════════════
   9. Card rendering (header + body) + the grid
   ════════════════════════════════════════════════════════════════════════ */
function listFor(card, session) {
  // pick mode → the source card lists every record so any can be chosen (§0.3)
  if (state.pick && card === PICK_SRC[state.pick.slot]) {
    // adding a rental to an invoice → scope to that invoice's customer (§7.5)
    if (state.pick.slot === 'rental') { const inv = IDX.invoice.get(state.pick.recId); if (inv?.customerId) return collection('rentals').filter((r) => r.customerId === inv.customerId); }
    // windowed unit pick → optionally narrow to a clicked category (§0.3 cascade)
    if (card === 'units' && availWin && state.pick.catFilter) return collection('units').filter((u) => u.categoryId === state.pick.catFilter);
    return collection(card);
  }
  // §10 — while a rental window is in scope, Categories AND Units show every record
  // with its window-availability (not the empty draft cascade), live as dates change.
  if (availWin && card === 'categories') return collection('categories');
  if (availWin && card === 'units') { return state.pick?.catFilter ? collection('units').filter((u) => u.categoryId === state.pick.catFilter) : collection('units'); }
  // search mode → filtered across all; anchored (cascade) → cascade subset; else → all
  if (state.searchMode) {
    return collection(card).filter((rec) => matchesSearch(IDX.search.get(card + ':' + idOf(card, rec))));
  }
  // §12.3 — mix-bar segment click filters the anchored category's units, either by
  // inspection status (top bar) or by rental status bucket (second bar).
  if (card === 'units' && state.fleetFilter && session.anchor?.card === 'categories' && session.anchor.recId === state.fleetFilter.categoryId) {
    const units = session.cascade?.units || [];
    return state.fleetFilter.kind === 'rental'
      ? units.filter((u) => unitRentalBucket(u) === state.fleetFilter.status)
      : units.filter((u) => u.inspectionStatus === state.fleetFilter.status);
  }
  // anchored card in list mode (js-tolist "browse") → show every item so a different one can be anchored
  if (session.anchor?.card === card && session.cards[card].mode === 'list') return collection(card);
  if (session.anchor && session.cascade) return session.cascade[card] || [];
  return collection(card);
}
function collection(card) {
  return { customers: DATA.customers, rentals: DATA.rentals, categories: DATA.categories, units: DATA.units, invoices: DATA.invoices, workOrders: DATA.workOrders, inspections: DATA.inspections, serviceOrders: DATA.units }[card];
}
function sortRows(card, rows, sort) {
  const val = (rec) => {
    switch (sort.field) {
      case 'name': return ROW_META[card](rec).title.toLowerCase();
      case 'startDate': return parseISO(rec.startDate)?.getTime() || 0;
      case 'endDate': return parseISO(rec.endDate)?.getTime() || 0;
      case 'price': return rentalPrice(rec)?.price || 0;
      case 'status': return rec.status || '';
      case 'currentHours': return rec.currentHours || 0;
      case 'date': return parseISO(rec.date)?.getTime() || 0;
      case 'dueDate': return parseISO(rec.dueDate)?.getTime() || 0;
      case 'balance': return invoiceTotals(rec).balance;
      case 'activePct': return rec._digest?.activePct || 0;
      case 'totalPaid': return rec._digest?.totalPaid || 0;
      case 'rate1Day': return rec.rate1Day || 0;
      case 'countdown': { const s = topServiceForUnit(rec); return s ? s.remaining : 1e9; }
      default: return ROW_META[card](rec).title.toLowerCase();
    }
  };
  const dir = sort.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => { const va = val(a), vb = val(b); return va < vb ? -dir : va > vb ? dir : 0; });
}

const VIRT_CAP = 60;   // first-paint cap (SPEC §3 windowing)
const SHOW_MORE_BATCH = 200;   // how many more rows each "Show more" click reveals

/* Windowed list render. Paints up to cs.listLimit rows (default 60 → fast first
   paint + fast typing while searching) and, when more match, appends a REAL
   "Show more" button so every match is reachable on demand. Without this the
   overflow was an inert "+N more" line and rows 61+ could never be reached. */
function appendWindowed(list, rows, cs, card, renderRow) {
  const limit = cs.listLimit || VIRT_CAP;
  rows.slice(0, limit).forEach(renderRow);
  const remaining = rows.length - limit;
  if (remaining > 0) {
    const btn = el('button', 'showmore js-showmore', `↓ Show ${Math.min(SHOW_MORE_BATCH, remaining)} more · ${remaining} hidden`);
    btn.dataset.card = card;
    list.appendChild(btn);
  }
}

// The open record's display title, mirroring each card's old detail-head title.
function detailTitle(card, rec) {
  if (!rec) return '';
  switch (card) {
    case 'rentals': return rec.rentalName || IDX.unit.get(rec.unitId)?.name || 'Rental';
    case 'units': return rec.name || 'Unit';
    case 'customers': return fullName(rec) || rec.name || 'Customer';
    case 'categories': return rec.name || 'Category';
    case 'invoices': return rec.invoiceId || 'Invoice';
    case 'workOrders': return `${IDX.unit.get(rec.unitId)?.name || '—'} — ${rec.woReport || 'Work order'}`;
    case 'inspections': return `${IDX.unit.get(rec.unitId)?.name || 'Inspection'}`;
    default: return (ROW_META[card] ? ROW_META[card](rec).title : '') || '';
  }
}
function cardEl(cardDef, session) {
  const card = cardDef.id;
  if (card === 'shop') return shopCardEl(cardDef, session);   // merged WO + Service + Inspections
  const cs = session.cards[card];
  const anchored = session.anchor?.card === card;
  const pickTarget = state.pick && PICK_SRC[state.pick.slot] === card;
  const node = el('div', 'card' + (anchored ? ' anchored' : '') + (state.searchMode ? ' search-glow' : '') + (state.focusedCard === card ? ' card-focus' : '') + (pickTarget ? ' pick-target' : ''));
  node.dataset.card = card;

  // §5.4: global search forces EVERY card into list view (the prior standard/anchor
  // state is untouched, so exiting search restores the session for free).
  const inStandard = !state.searchMode && cs.mode === 'standard' && cs.recId != null;
  // header — floating chips over one continuous surface (no separating line)
  const head = el('div', 'card-head');
  const stdRec = inStandard ? recOf(card, cs.recId) : null;
  const count = !inStandard ? `<span class="c-count">${listFor(card, session).length}</span>` : '';
  // §0.6 — in standard mode the open record's NAME rides in the card header (badges
  // drop just below it); editable in place for rentals/units.
  const titleHtml = (inStandard && stdRec)
    ? (card === 'rentals' ? `<span class="c-title inline-edit" data-edit="field" data-card="rentals" data-field="rentalName" data-rec="${esc(cs.recId)}" data-ph="Rental name">${esc(detailTitle(card, stdRec))}</span>`
      : card === 'units' ? `<span class="c-title inline-edit" data-edit="field" data-card="units" data-field="name" data-rec="${esc(cs.recId)}" data-ph="Unit name">${esc(detailTitle(card, stdRec))}</span>`
      : `<span class="c-title">${esc(detailTitle(card, stdRec))}</span>`)
    : `<span class="c-title">${esc(cardDef.title)}</span>`;
  head.innerHTML = `
    <span class="c-titlecard"><span class="c-icon">${CARD_ICON[card] || ''}</span>${titleHtml}${count}</span>
    <div class="c-head-right">
      ${inStandard ? `<div class="c-actions"><button class="hbtn js-tolist" title="${anchored ? 'Browse list (pick another to anchor)' : 'Back to list'}">${I.list}</button><button class="hbtn js-anchor" data-rec="${esc(cs.recId)}" title="Anchor (⊞)">${I.circle}</button><button class="hbtn js-newtab" data-rec="${esc(cs.recId)}" title="New tab (+)">${I.plus}</button></div>` : ''}
    </div>`;
  node.appendChild(head);

  // body
  const body = el('div', 'card-body');
  if (inStandard) {
    const rec = recOf(card, cs.recId);
    body.innerHTML = rec && DETAIL[card] ? DETAIL[card](rec, cs) : '<div class="empty">Record not found.</div>';
  } else {
    body.appendChild(listView(cardDef, session));
  }
  node.appendChild(body);
  return node;
}

function listView(cardDef, session) {
  const card = cardDef.id;
  const cs = session.cards[card];
  const wrap = el('div');
  // sort/search bar
  const sf = SORT_FIELDS[card];
  const curField = sf.find((f) => f.field === cs.sort.field) || sf[0];
  const bar = el('div', 'listbar');
  const cterms = cs.filterTerms || [];
  bar.innerHTML = `
    <div class="mini-searchwrap${cterms.length ? ' has-terms' : ''}">
      ${cterms.map((ft, i) => filterTermPill(ft, i, card)).join('')}
      <input class="mini-search" placeholder="${cterms.length ? 'Add filter — Enter to pin…' : `Search ${esc(cardDef.title.toLowerCase())}…`}" value="${esc(cs.search)}" data-card="${card}" />
    </div>
    <div class="sort">
      <button class="sortbtn js-sortmenu" data-card="${card}">${esc(curField.label)} ${I.chev}</button>
      <button class="dir js-sortdir" data-card="${card}"><span class="${cs.sort.dir === 'asc' ? 'on' : ''}">▲</span><span class="${cs.sort.dir === 'desc' ? 'on' : ''}">▼</span></button>
    </div>`;
  wrap.appendChild(bar);

  let rows = listFor(card, session);
  if (cs.search.trim() || (cs.filterTerms || []).length) { rows = rows.filter((rec) => blobMatches(IDX.search.get(card + ':' + idOf(card, rec)), cs.search, cs.filterTerms)); }
  rows = sortRows(card, rows, cs.sort);
  // §10 — surface available units/categories first while a rental window is in scope
  if (availWin && (card === 'units' || card === 'categories')) rows = [...rows].sort((a, b) => (availUnavailable(card, a) ? 1 : 0) - (availUnavailable(card, b) ? 1 : 0));

  const list = el('div', 'list');
  if (!rows.length) {
    // creation lives in ONE place — the header + New menu (no per-card +New, even when empty)
    const hint = PLUS_NEW.has(card) ? ` — use <b>+ New</b> above` : '';
    list.appendChild(el('div', 'empty', `No ${esc(cardDef.singular)}${session.anchor ? ' related' : hint}.`));
  } else {
    appendWindowed(list, rows, cs, card, (rec) => list.appendChild(rowEl(card, rec)));
  }
  wrap.appendChild(list);
  return wrap;
}
const PLUS_NEW = new Set(['rentals', 'invoices', 'customers']);

/* ════════════════════════════════════════════════════════════════════════
   9b. SHOP CARD  —  merged Work Orders + Service Orders + Inspections
   ────────────────────────────────────────────────────────────────────────
   ITERATE HERE: this whole block is the Shop card's presentation. The grid
   plumbing (anchor/cascade/tabs/standard-mode) routes through it via the
   `recType` thread, so alternate Shop layouts only need these functions.
   ════════════════════════════════════════════════════════════════════════ */

/** Active queue vs completed archive. Default = the work queue (pending
 *  inspections, open WOs, all services). The "Completed" sort flips to the
 *  archive: resolved inspections + completed WOs (services aren't archived here). */
function shopItemMode(ty, rec, complete) {
  if (ty === 'inspections') return complete ? inspComplete(rec) : !inspComplete(rec);
  if (ty === 'workOrders') return complete ? rec.phase === 'Complete' : rec.phase !== 'Complete';
  if (ty === 'serviceOrders') return !complete;
  return true;
}
/** The in-scope records for each Shop sub-type (cascade subset / search / all),
 *  filtered to the active queue or the completed archive. */
function shopItemsByType(session) {
  const complete = session.cards.shop.sort.field === 'complete';
  const out = {};
  const q = state.query.trim().toLowerCase();
  const woPick = state.pick && state.pick.slot === 'wo';
  const browsing = session.anchor?.card === 'shop' && session.cards.shop.mode === 'list';   // js-tolist "browse"
  for (const ty of SHOP_TYPES) {
    let recs;
    if (woPick && ty === 'workOrders') {
      recs = collection('workOrders');                 // §0.3 pick — choose from every WO
    } else if (state.searchMode) {
      const blobKey = ty === 'serviceOrders' ? 'units' : ty;
      recs = collection(ty).filter((rec) => matchesSearch(IDX.search.get(blobKey + ':' + idOf(ty, rec))));
    } else if (browsing) {
      recs = collection(ty);
    } else if (session.anchor && session.cascade) {
      recs = session.cascade[ty] || [];
    } else {
      recs = collection(ty);
    }
    out[ty] = recs.filter((rec) => shopItemMode(ty, rec, complete));
  }
  return out;
}
/** Urgency score for the default Shop sort (higher = needs attention sooner). */
function shopUrgency(it) {
  const r = it.rec;
  if (it.type === 'inspections') return r.checklist === 'Fail' ? 90 : 20;
  if (it.type === 'workOrders') return r.phase === 'Complete' ? 10 : (r.woType === 'Failed' ? 95 : 60);
  if (it.type === 'serviceOrders') { const s = topServiceForUnit(r); return s ? (s.status === 'past-due' ? 100 : 70) : 5; }
  return 0;
}
function shopSort(items, sort) {
  const val = (it) => {
    const r = it.rec;
    switch (sort.field) {
      case 'urgency': return shopUrgency(it);
      case 'date': case 'complete': return parseISO(r.date)?.getTime() || 0;
      case 'unit': return (IDX.unit.get(r.unitId)?.name || '').toLowerCase();
      case 'type': return it.type;
      default: return shopUrgency(it);
    }
  };
  const dir = sort.dir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => { const va = val(a), vb = val(b); return va < vb ? -dir : va > vb ? dir : 0; });
}

function shopCardEl(cardDef, session) {
  const cs = session.cards.shop;
  const anchored = session.anchor?.card === 'shop';
  const byType = shopItemsByType(session);
  const total = SHOP_TYPES.reduce((a, ty) => a + byType[ty].length, 0);
  const woPick = state.pick && state.pick.slot === 'wo';
  const node = el('div', 'card' + (anchored ? ' anchored' : '') + (state.searchMode ? ' search-glow' : '') + (state.focusedCard === 'shop' ? ' card-focus' : '') + (woPick ? ' pick-target' : ''));
  node.dataset.card = 'shop';

  const inStandard = !state.searchMode && cs.mode === 'standard' && cs.recId != null && cs.recType;
  const head = el('div', 'card-head');
  const count = !inStandard ? `<span class="c-count">${total}</span>` : '';
  head.innerHTML = `
    <span class="c-titlecard"><span class="c-icon">${CARD_ICON.shop}</span><span class="c-title">${esc(cardDef.title)}</span>${count}</span>
    <div class="c-head-right">
      ${inStandard ? `<div class="c-actions"><button class="hbtn js-tolist" title="${anchored ? 'Browse list (pick another to anchor)' : 'Back to list'}">${I.list}</button><button class="hbtn js-anchor" data-rec="${esc(cs.recId)}" data-type="${esc(cs.recType)}" title="Anchor (⊞)">${I.circle}</button><button class="hbtn js-newtab" data-rec="${esc(cs.recId)}" data-type="${esc(cs.recType)}" title="New tab (+)">${I.plus}</button></div>` : ''}
    </div>`;
  node.appendChild(head);

  const body = el('div', 'card-body');
  if (inStandard) {
    const rec = recOf(cs.recType, cs.recId);
    body.innerHTML = rec && DETAIL[cs.recType] ? DETAIL[cs.recType](rec, cs) : '<div class="empty">Record not found.</div>';
  } else {
    body.appendChild(shopListView(session, byType));
  }
  node.appendChild(body);
  return node;
}

function shopListView(session, byType) {
  const cs = session.cards.shop;
  const wrap = el('div');
  const counts = { all: SHOP_TYPES.reduce((a, ty) => a + byType[ty].length, 0) };
  SHOP_TYPES.forEach((ty) => { counts[ty] = byType[ty].length; });

  // segment control
  const segbar = el('div', 'shopbar');
  segbar.innerHTML = SHOP_SEGMENTS.map((s) => `<button class="shop-seg ${cs.segment === s.id ? 'on' : ''} js-shopseg" data-seg="${s.id}">${esc(s.label)}<span class="seg-n">${counts[s.id] || 0}</span></button>`).join('');
  wrap.appendChild(segbar);

  // search + sort (reuses the standard list-bar chrome)
  const sf = SORT_FIELDS.shop; const curField = sf.find((f) => f.field === cs.sort.field) || sf[0];
  const bar = el('div', 'listbar');
  const sterms = cs.filterTerms || [];
  bar.innerHTML = `
    <div class="mini-searchwrap${sterms.length ? ' has-terms' : ''}">
      ${sterms.map((ft, i) => filterTermPill(ft, i, 'shop')).join('')}
      <input class="mini-search" placeholder="${sterms.length ? 'Add filter — Enter to pin…' : 'Search shop…'}" value="${esc(cs.search)}" data-card="shop" />
    </div>
    <div class="sort">
      <button class="sortbtn js-sortmenu" data-card="shop">${esc(curField.label)} ${I.chev}</button>
      <button class="dir js-sortdir" data-card="shop"><span class="${cs.sort.dir === 'asc' ? 'on' : ''}">▲</span><span class="${cs.sort.dir === 'desc' ? 'on' : ''}">▼</span></button>
    </div>`;
  wrap.appendChild(bar);

  // items for the active segment (a WO pick forces the Work Orders segment)
  const segActive = (state.pick && state.pick.slot === 'wo') ? 'workOrders' : cs.segment;
  let items = segActive === 'all'
    ? SHOP_TYPES.flatMap((ty) => byType[ty].map((rec) => ({ type: ty, rec })))
    : byType[segActive].map((rec) => ({ type: segActive, rec }));
  if (cs.search.trim() || (cs.filterTerms || []).length) {
    items = items.filter((it) => blobMatches(IDX.search.get((it.type === 'serviceOrders' ? 'units' : it.type) + ':' + idOf(it.type, it.rec)), cs.search, cs.filterTerms));
  }
  items = shopSort(items, cs.sort);

  const list = el('div', 'list');
  if (!items.length) {
    // creation lives in ONE place — the header + New menu (no per-card +New)
    list.appendChild(el('div', 'empty', `No shop items${session.anchor ? ' related' : ' — use <b>+ New</b> above'}.`));
  } else {
    appendWindowed(list, items, cs, 'shop', (it) => list.appendChild(shopRowEl(it.type, it.rec)));
  }
  wrap.appendChild(list);
  return wrap;
}

/** A Shop list row = the entity's own list row + a small type glyph on the left. */
/** The status color that tints a Shop row, so the user sees at a glance what each
 *  item needs: inspection result (Not Ready=yellow…), WO phase/bottleneck (Part
 *  Ordered=blue…), or service urgency (past-due=red…). */
function shopRowColor(type, rec) {
  if (type === 'inspections') return inspResult(rec).color;
  if (type === 'workOrders') return getStatus('woPhase', rec.phase).color;
  if (type === 'serviceOrders') { const s = topServiceForUnit(rec); return s ? s.color : 'green'; }
  return 'gray';
}
function shopRowEl(type, rec) {
  const id = idOf(type, rec);
  const color = shopRowColor(type, rec);
  const node = el('div', 'row shop-row');
  node.dataset.card = 'shop'; node.dataset.type = type; node.dataset.rec = id;
  node.innerHTML = `<div class="row-viz" style="background:linear-gradient(90deg, var(--${color}-bg), transparent 62%)"></div>
    <div class="shop-type" style="color:var(--${color})" title="${esc(SHOP_SEGMENTS.find((s) => s.id === type)?.label || type)}">${CARD_ICON[type]}</div>
    <div class="r-actions">
      <button class="rbtn js-anchor" data-type="${type}" data-rec="${id}" title="Anchor (⊞)">${I.circle}</button>
      <button class="rbtn js-newtab" data-type="${type}" data-rec="${id}" title="Open in new tab (+)">${I.plus}</button>
    </div>
    <div class="row-content">${ROWS[type](rec)}</div>`;
  return node;
}

/* ════════════════════════════════════════════════════════════════════════
   10. Header (KPI rings, tabs, search, buttons) + dashboard placeholder
   ════════════════════════════════════════════════════════════════════════ */
function ringSVG(pct, color, { size = 40, center } = {}) {
  const sw = size >= 100 ? 9 : 4;
  const r = size / 2 - sw, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, pct / 100));
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}"/>
    <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--${color})" stroke-width="${sw}" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    ${center != null ? `<text class="ring-pct" x="50%" y="54%" text-anchor="middle">${center}</text>` : ''}
  </svg>`;
}
/** Apple-style band coloring (§11): 0-25 red · 25-50 orange · 50-75 yellow ·
 *  75-100 green · 95-100 glowing green. */
function bandColor(pct) {
  if (pct >= 90) return { color: 'green', glow: true };
  if (pct >= 75) return { color: 'green', glow: false };
  if (pct >= 50) return { color: 'yellow', glow: false };
  if (pct >= 25) return { color: 'orange', glow: false };
  return { color: 'red', glow: false };
}
/** Three concentric Apple-style progress rings — one per role KPI, each colored by
 *  its OWN value band, glowing when ≥95% (outer = most important, §11). */
function ring3SVG(vals, _color, { size = 48, center } = {}) {
  const big = size >= 100;
  const sw = big ? 13 : 4.6, gap = big ? 7 : 2.4, pad = big ? 16 : 5;
  const step = sw + gap;
  const rings = [0, 1, 2].map((i) => {
    const pct = Math.max(0, Math.min(100, vals[i] || 0));
    const b = bandColor(pct);
    const r = size / 2 - pad - i * step;
    const c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    return `<circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}"/>
      <circle class="ring-fill${b.glow ? ' ring-glow' : ''}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--${b.color})" stroke-width="${sw}" stroke-dasharray="${c}" stroke-dashoffset="${off}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
  }).join('');
  return `<svg class="ring3" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${rings}${center != null ? `<text class="ring-pct" x="50%" y="54%" text-anchor="middle">${center}</text>` : ''}</svg>`;
}
/** §10/§11 KPI ring values, computed live from DATA (all-time for the demo seed).
 *  Driver Score + Office Reputation need the GPS/email backend → null placeholders. */
const pctOf = (a, b) => (b > 0 ? Math.round(Math.max(0, Math.min(100, (a / b) * 100))) : 0);
function fleetInsp() {
  const c = { Ready: 0, 'Not Ready': 0, Failed: 0 };
  DATA.units.forEach((u) => { if (c[u.inspectionStatus] != null) c[u.inspectionStatus]++; });
  return { ...c, total: c.Ready + c['Not Ready'] + c.Failed };
}
function kpiFor(roleId) {
  const R = DATA.rentals, W = DATA.workOrders, N = DATA.inspections, INV = DATA.invoices, C = DATA.customers;
  const f = fleetInsp();
  if (roleId === 'mechanic') {
    const renting = pctOf(f.Ready + f['Not Ready'], f.total);                 // rentable ÷ fleet
    const woComplete = pctOf(W.filter((w) => w.phase === 'Complete').length, W.length);
    const billable = W.filter((w) => (w.lineItems || []).some((li) => (li.cost || 0) > 0 || (li.hours || 0) > 0));
    const billRate = pctOf(billable.filter((w) => w.billCustomer === 'Yes').length, billable.length);
    return [renting, woComplete, billRate];
  }
  if (roleId === 'mtech') {
    const fc = R.filter((r) => r.fieldCall).length;
    const successful = R.length ? Math.round((1 - fc / R.length) * 100) : 100;
    const readyRate = pctOf(f.Ready, f.total);
    const woRate = N.length ? N.filter((n) => n.woId).length / N.length : 0;   // lower is better; full ring = ≤0%, empty = ≥20%
    const woRing = Math.round(Math.max(0, 1 - Math.min(woRate, 0.2) / 0.2) * 100);
    return [successful, readyRate, woRing];
  }
  if (roleId === 'driver') {
    const delivered = R.filter((r) => ['On Rent', 'End Rent', 'Off Rent', 'Returned'].includes(r.status)).length;
    const scheduled = R.filter((r) => !['Quote', 'Cancelled', 'No Show'].includes(r.status)).length;
    const washes = N.filter((n) => n.wash === 'Yes').length;
    const washReq = N.filter((n) => n.wash === 'Yes' || n.wash === 'No').length;
    return [pctOf(delivered, scheduled), pctOf(washes, washReq), null];        // Driving Score = GPS backend
  }
  if (roleId === 'office') {
    const billed = INV.reduce((a, i) => a + invoiceTotals(i).total, 0);
    const collected = INV.reduce((a, i) => a + invoiceTotals(i).paid, 0);
    const reservations = R.filter((r) => ['Reserved', 'On Rent', 'End Rent', 'Off Rent', 'Returned', 'No Show'].includes(r.status)).length;
    const shows = R.filter((r) => ['On Rent', 'End Rent', 'Off Rent', 'Returned'].includes(r.status)).length;
    return [pctOf(collected, billed), pctOf(shows, reservations), null];       // Reputation = email backend
  }
  if (roleId === 'sales') {
    // §11 Revenue Goal is MONTHLY ($150k, resets on the 1st) — count rentals that start
    // in the current calendar month. (A future Settings board will make the goal admin-set.)
    const ym = TODAY_ISO.slice(0, 7);
    const revenue = R.reduce((a, r) => { if ((r.startDate || '').slice(0, 7) !== ym) return a; const p = rentalPrice(r); return a + (p ? p.price : 0); }, 0);
    const revGoal = pctOf(revenue, CFG.REVENUE_GOAL_DEFAULT || 150000);
    const big = C.filter((c) => (c._digest?.totalPaid || 0) > 1999);
    const activeRate = pctOf(big.filter((c) => (c._digest?.activePct || 0) > 0).length, big.length);
    const members = C.filter((c) => /Member/.test(c.accountType || '') && c.accountType !== 'Member Incomplete').length;
    const leads = C.filter((c) => c.usedSalesStage && c.usedSalesStage !== 'Inbound Lead').length;
    const pipeline = pctOf(members + leads, 10);
    return [revGoal, activeRate, pipeline];
  }
  return [0, 0, 0];
}
/** §11 Team ring — per-position average across the 5 roles (skips null placeholders). */
function kpiTeam() {
  const all = ROLES.map((r) => kpiFor(r.id));
  return [0, 1, 2].map((i) => { const vals = all.map((v) => v[i]).filter((x) => x != null); return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null; });
}

function headerEl() {
  const h = el('div', 'header');
  const roleRing = (id, label, vals, color) => `<button class="kpi-ring js-ring" data-role="${id}">
      <span class="ring-wrap">${ring3SVG(vals, color, { size: 54 })}</span>
      <span class="ring-label">${esc(label)}</span>
    </button>`;
  const rings = ROLES.map((role) => roleRing(role.id, role.label, kpiFor(role.id), role.color)).join('');
  // One band: logo + rings on the left; a right column with the item tabs (single
  // row) above the toolbar (New / Dashboard / theme / QR / search / close-all).
  h.innerHTML = `
    <button class="logo js-logo"><img class="logo-img" src="assets/jac-rentals-logo.jpg" alt="Jac Rentals" /></button>
    <div class="kpis">${rings}</div>
    <div class="header-right">
      <div class="hr-top">
        ${state.tabs.length ? `<div class="tabstrip">${tabStrip()}</div>` : ''}
        ${currentUser ? `<span class="hello-name">${esc(currentUser)}</span>` : ''}
      </div>
      <div class="toolbar">
        <button class="iconbtn primary js-newrental">${I.plus}New</button>
        <button class="iconbtn js-dashboard">${I.grid} Dashboard</button>
        <button class="iconbtn js-theme" title="${state.theme === 'dark' ? 'Light' : 'Dark'} mode">${state.theme === 'dark' ? I.sun : I.moon}</button>
        <button class="iconbtn js-qr" title="Share session (QR)">${I.qr}</button>
        <div class="searchwrap ${state.filterTerms.length ? 'has-terms' : ''}">
          <span class="s-icon">${I.search}</span>
          ${state.filterTerms.map((ft, i) => filterTermPill(ft, i, 'global')).join('')}
          <input id="globalsearch" class="search" placeholder="${state.filterTerms.length ? 'Add filter — type, Enter to pin…' : 'Search everything…'}" value="${esc(state.query)}" />
          ${(state.query || state.filterTerms.length) ? `<div class="search-tools"><button class="search-tool js-clear" title="Clear">${I.x}</button></div>` : ''}
        </div>
        ${state.tabs.length ? `<button class="iconbtn closeall js-closeall">${I.x} Close all</button>` : ''}
      </div>
    </div>`;
  return h;
}
function tabStrip() {
  if (!state.tabs.length) return '';
  return state.tabs.map((t) => {
    const ec = entityCardOf(t.card, t.recType);
    const rec = recOf(ec, t.recId);
    const b = rec ? tabBadge(ec, rec) : '';
    return `<div class="tab ${t.id === state.activeTabId ? 'active' : ''} js-tab" data-tab="${t.id}">
      <span class="tab-name">${esc(t.label)}</span>${b}</div>`;
  }).join('');
}

/* ── §5.3/§11 Office Dispatch Time Grid ──────────────────────────────────────
   Every transport task (Deliver at the rental's start, Pick up at its end) for
   active rentals, grouped by day so the Office sees what trucks go where/when. */
function dispatchEvents() {
  const out = [];
  const SKIP = new Set(['Cancelled', 'No Show', 'Returned', 'Quote']);
  DATA.rentals.forEach((r) => {
    if (!r.unitId || SKIP.has(r.status) || !r.transportType || r.transportType === 'Self') return;
    const unit = IDX.unit.get(r.unitId), cust = IDX.customer.get(r.customerId);
    const base = { rentalId: r.rentalId, unit: unit?.name || '—', cust: cust?.name || cust?.company || '—', addr: r.deliveryAddress || '', ttype: r.transportType };
    if (['Delivery', 'Round-Trip'].includes(r.transportType) && r.startDate) out.push({ ...base, date: r.startDate, time: r.startTime || '', task: 'Deliver', color: 'blue' });
    if (['Round-Trip', 'Recovery'].includes(r.transportType) && r.endDate) out.push({ ...base, date: r.endDate, time: '', task: 'Pick up', color: 'brown' });
  });
  return out.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}
function dashboardEl() {
  const wrap = el('div', 'dashboard');
  const events = dispatchEvents();
  const today = TODAY_ISO;
  const byDate = {};
  events.forEach((ev) => { (byDate[ev.date] = byDate[ev.date] || []).push(ev); });
  const dates = Object.keys(byDate).sort();
  const stat = (n, label, color) => `<div class="dash-stat"><b style="color:var(--${color})">${n}</b><span>${esc(label)}</span></div>`;
  const stats = `<div class="dash-stats">
    ${stat(events.filter((e) => e.date === today && e.task === 'Deliver').length, 'Deliveries today', 'blue')}
    ${stat(events.filter((e) => e.date === today && e.task === 'Pick up').length, 'Pickups today', 'brown')}
    ${stat(events.filter((e) => e.date >= today).length, 'Upcoming dispatches', 'green')}
    ${stat(events.length, 'Total scheduled', 'gray')}</div>`;
  const groups = dates.length ? dates.map((d) => {
    const isToday = d === today, isPast = d < today;
    const rows = byDate[d].map((ev) => `<button class="dash-ev js-dash-ev" data-rec="${esc(ev.rentalId)}">
        <span class="dash-time">${esc(ev.time || (ev.task === 'Pick up' ? 'EOD' : '—'))}</span>
        <span class="pill c-${ev.color}"><span class="truck">${I.truck}</span>${esc(ev.task)}</span>
        <span class="dash-unit">${esc(ev.unit)}</span>
        <span class="dash-cust">${esc(ev.cust)}</span>
        <span class="dash-addr">${esc(ev.addr || '—')}</span>
        <span class="pill c-gray dash-ttype">${esc(ev.ttype)}</span>
      </button>`).join('');
    return `<div class="dash-day${isToday ? ' today' : ''}${isPast ? ' past' : ''}"><div class="dash-day-head">${esc(fmtShortDate(d))}${isToday ? ' · Today' : ''}<span class="dash-day-count">${byDate[d].length}</span></div>${rows}</div>`;
  }).join('') : `<div class="empty" style="padding:34px;text-align:center">No dispatches scheduled. Rentals with Delivery / Round-Trip / Recovery transport appear here.</div>`;
  wrap.innerHTML = `
    <div class="dash-head">
      <div class="dash-title"><span class="c-icon" style="color:var(--accent);display:inline-flex">${I.grid}</span><h2>Office Dispatch — Time Grid</h2></div>
      <button class="iconbtn js-dashboard">${I.back} Back to cards</button>
    </div>
    ${stats}
    <div class="dash-grid">${groups}</div>`;
  return wrap;
}
/** The status badge shown on an item tab (replaces the old datapoint sub-text). */
function tabBadge(card, rec) {
  const b = (set, val) => { const s = getStatus(set, val); return badge(s.label, s.color); };
  switch (card) {
    case 'rentals':       return b('rentalStatus', rec.status);
    case 'customers':     return b('customerPayStatus', rec.payStatus);
    case 'units':         return b('unitInspectionStatus', rec.inspectionStatus);
    case 'categories':    return rec.fuelType ? badge(rec.fuelType, 'navy') : '';
    case 'invoices':      return b('invoiceStatus', invoiceTotals(rec).status);
    case 'workOrders':    return b('woPhase', rec.phase);
    case 'inspections':   { const ir = inspResult(rec); return badge(ir.label, ir.color); }
    case 'serviceOrders': { const s = topServiceForUnit(rec); return s ? badge(getStatus('serviceStatus', s.status).label, s.color) : badge('On Schedule', 'green'); }
    default: return '';
  }
}

/* ════════════════════════════════════════════════════════════════════════
   11. Overlays (logo menu, role KPI popup) — §0.4 / §5.2
   ════════════════════════════════════════════════════════════════════════ */
function renderOverlay() {
  const root = $('#overlay-root');
  destroyCardElement();        // any re-render/overlay-switch tears down a mounted Stripe element
  root.innerHTML = '';
  if (!state.overlay) return;
  const o = state.overlay;
  const overlay = el('div', 'overlay');
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeOverlay(); });

  if (o.kind === 'qr') {
    const url = o.url || location.href;
    const pop = el('div', 'popup'); pop.style.width = '340px';
    pop.innerHTML = `
      <div class="popup-head"><span class="mark" style="color:var(--accent);display:inline-flex">${I.qr}</span><h3>${esc(o.title || 'Share session')}</h3><span class="spacer"></span><button class="x js-close">${I.x}</button></div>
      <div class="popup-body" style="text-align:center">
        <img class="qr-img" alt="QR code" src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&bgcolor=15171c&color=ff7a1a&data=${encodeURIComponent(url)}" width="220" height="220" style="border-radius:12px;background:var(--panel-2)" />
        <p class="muted" style="margin-top:10px;font-size:12px;word-break:break-all">${esc(url)}</p>
        <p class="muted" style="margin-top:6px;font-size:11px">${esc(o.caption || 'Scan to open this session on another device (single shared login — §1/§4.2).')}</p>
      </div>`;
    overlay.appendChild(pop);
  } else if (o.kind === 'role') {
    const role = ROLES.find((r) => r.id === o.role);
    const vals = kpiFor(role.id);
    const ringTag = ['Outer', 'Middle', 'Inner'];
    const lines = role.kpis.map((k, i) => {
      const raw = vals[i];
      const b = bandColor(raw == null ? 0 : raw);
      const valTxt = raw == null ? '<span class="muted">— backend</span>' : `<span style="color:var(--${b.color})">${raw}%</span>`;
      return `<div class="kpi-line"><span class="ring-no" style="border-color:var(--${raw == null ? 'line' : b.color});color:var(--${raw == null ? 'txt-3' : b.color})">${i + 1}</span><span class="k-name">${esc(k)}<span class="muted" style="font-size:10px;margin-left:6px">${ringTag[i]}</span></span><span class="k-val">${valTxt}</span></div>`;
    }).join('');
    const pop = el('div', 'popup kpi-popup');
    pop.innerHTML = `
      <div class="popup-head"><span class="ring-ico" style="color:var(--${role.color});display:inline-flex;width:18px;height:18px">${RING_ICON[role.id]}</span><h3>${esc(role.label)} KPIs</h3><span class="spacer"></span><button class="x js-close">${I.x}</button></div>
      <div class="popup-body">
        <div class="big-ring">${ring3SVG(vals, role.color, { size: 150 })}</div>
        <div class="kpi-list">${lines}</div>
      </div>`;
    overlay.appendChild(pop);
  } else if (o.kind === 'board') {
    const board = BACKOFFICE_BOARDS.find((b) => b.id === o.board);
    const pop = el('div', 'popup board-popup');
    pop.innerHTML = `
      <div class="popup-head">${CARD_ICON[board.id] ? `<span class="c-icon" style="color:var(--accent);display:inline-flex">${CARD_ICON[board.id] || ''}</span>` : ''}<h3>${esc(board.title)}</h3><span class="c-count">${boardRows(board.id).length}</span><span class="spacer"></span><button class="x js-close">${I.x}</button></div>
      <div class="popup-body board-body">${boardTable(board.id)}</div>`;
    overlay.appendChild(pop);
  } else if (o.kind === 'settings') {
    const cfg = o.config || { roles: {}, admin: '' };
    const roleRows = Object.keys(cfg.roles).map((role) => `<label class="set-row"><span class="set-role">${esc(role)}</span><input class="set-input" data-role="${esc(role)}" value="${esc(cfg.roles[role])}" autocomplete="off" /></label>`).join('');
    const pop = el('div', 'popup'); pop.style.width = '380px';
    pop.innerHTML = `
      <div class="popup-head"><span class="mark" style="color:var(--accent);display:inline-flex">${I.grid}</span><h3>Settings — Logins</h3><span class="spacer"></span><button class="x js-close">${I.x}</button></div>
      <div class="popup-body">
        <p class="muted" style="font-size:11px;margin:0 0 10px">Each role signs in with its password (plus their name). Changes apply at next sign-in.</p>
        ${roleRows}
        <label class="set-row set-admin"><span class="set-role">Admin</span><input class="set-input" data-admin="1" value="${esc(cfg.admin)}" autocomplete="off" /></label>
        ${o.error ? `<div class="login-err" style="text-align:left;margin-top:8px">${esc(o.error)}</div>` : ''}
        <div class="pillrow" style="margin-top:14px;justify-content:flex-end"><button class="pill c-gray js-close">Cancel</button><button class="pill c-green js-settings-save">Save</button></div>
      </div>`;
    overlay.appendChild(pop);
  } else if (o.kind === 'newCustomer') {
    const d = o.draft; const isEdit = !!o.editId;
    const indOpts = NC_INDUSTRIES.map((i) => `<option value="${esc(i)}"></option>`).join('');
    const acctPills = NC_ACCOUNT_TYPES.map((t) => `<button type="button" class="nc-pill js-nc-acct${t === d.accountType ? ' on' : ''}" data-val="${esc(t)}">${esc(getStatus('customerAccountType', t).label)}</button>`).join('');
    const selfieBox = d.selfie ? `<img class="nc-thumb" src="${esc(d.selfie)}" alt="selfie" />` : `<div class="nc-thumb empty">No photo</div>`;
    const sigBox = d.signature ? `<img class="nc-thumb sig" src="${esc(d.signature)}" alt="signature" />` : `<canvas class="nc-sigpad" width="400" height="120"></canvas>`;
    const custRec = IDX.customer.get(o.editId || '');
    const cardOnFile = hasCardOnFile(custRec);
    const cardShort = cardOnFile ? `${brandName(custRec.cardBrand)} ••••${custRec.cardLast4}` : 'No card';
    const agType = /member/i.test(d.accountType || '') ? 'membership' : 'rental';
    const ag = AGREEMENTS[agType];
    const agSigned = d.agreementSignedAt && d.agreementType === agType;
    const pop = el('div', 'popup nc-popup');
    pop.innerHTML = `
      <div class="popup-head"><span class="mark" style="color:var(--accent);display:inline-flex">${CARD_ICON.customers || ''}</span><h3>${isEdit ? 'Edit / Complete Account' : 'New Customer'}</h3><span class="spacer"></span>${isEdit ? `<button class="iconbtn js-nc-qr" title="Open on phone">${I.qr}</button>` : ''}<button class="x js-close">${I.x}</button></div>
      <div class="popup-body">
        <div class="nc-grid">
          <label class="nc-field"><span>First name *</span><input class="nc-in" data-f="firstName" value="${esc(d.firstName)}" autocomplete="off" /></label>
          <label class="nc-field"><span>Last name</span><input class="nc-in" data-f="lastName" value="${esc(d.lastName)}" autocomplete="off" /></label>
          <label class="nc-field nc-wide"><span>Company</span><input class="nc-in" data-f="company" value="${esc(d.company)}" autocomplete="off" /></label>
          <label class="nc-field"><span>Phone *</span><input class="nc-in" data-f="phone" value="${esc(d.phone)}" autocomplete="off" /></label>
          <label class="nc-field"><span>Email</span><input class="nc-in" data-f="email" type="email" value="${esc(d.email)}" autocomplete="off" /></label>
          <label class="nc-field nc-wide"><span>Industry</span><input class="nc-in" data-f="industry" list="nc-industries" value="${esc(d.industry)}" autocomplete="off" /></label>
          <div class="nc-field nc-wide"><span>Account type</span><div class="nc-pills">${acctPills}</div></div>
          <label class="nc-field nc-wide"><span>Notes</span><input class="nc-in" data-f="accountNotes" value="${esc(d.accountNotes)}" autocomplete="off" /></label>
        </div>
        <datalist id="nc-industries">${indOpts}</datalist>
        <div class="nc-sec-title">${esc(ag.title)}${agSigned ? ' <span class="nc-ag-ok">✓ accepted ' + esc(d.agreementSignedAt) + '</span>' : ' <span class="nc-ag-note">— sign below to accept</span>'}</div>
        <div class="nc-agreement" tabindex="0">${esc(ag.text)}</div>
        <div class="nc-sec-title">Account packet</div>
        <div class="nc-packet">
          <div class="nc-cap"><span class="nc-cap-lbl">Selfie</span>${selfieBox}<div class="pillrow"><label class="pill ref">${d.selfie ? 'Retake' : 'Take photo'}<input type="file" accept="image/*" capture="user" class="js-nc-selfie" hidden /></label>${d.selfie ? '<button class="pill c-gray js-nc-selfie-clear">Remove</button>' : ''}</div></div>
          <div class="nc-cap"><span class="nc-cap-lbl">Signature${agSigned ? '' : ' *'}</span>${sigBox}<div class="pillrow">${d.signature ? '<button class="pill c-gray js-nc-sig-clear">Re-sign</button>' : '<button class="pill c-green js-nc-sig-save">Accept &amp; sign</button><button class="pill c-gray js-nc-sig-clearpad">Clear</button>'}</div></div>
          <div class="nc-cap"><span class="nc-cap-lbl">Card on file</span><div class="nc-thumb empty${cardOnFile ? ' good' : ''}">${esc(cardShort)}</div><div class="pillrow">${isEdit ? (d.signature && d.selfie ? `<button class="pill ref js-add-card" data-rec="${o.editId}">${cardOnFile ? 'Replace card' : '＋ Add card'}</button>` : '<span class="muted" style="font-size:11px">Sign first</span>') : '<span class="muted" style="font-size:11px">Save customer first</span>'}</div></div>
        </div>
        ${o.error ? `<div class="login-err" style="text-align:left;margin-top:10px">${esc(o.error)}</div>` : ''}
        <div class="pillrow" style="margin-top:16px;justify-content:flex-end"><button class="pill c-gray js-close">Cancel</button><button class="pill c-green js-nc-save">${isEdit ? 'Save account' : 'Create customer'}</button></div>
      </div>`;
    overlay.appendChild(pop);
  } else if (o.kind === 'agreement') {
    // Read-only signed-agreement viewer (from the customer card). Shows the exact
    // agreement the customer accepted plus their signature + the date.
    const c = IDX.customer.get(o.recId);
    if (!c) { state.overlay = null; return; }
    const ag = AGREEMENTS[c.agreementType] || AGREEMENTS.rental;
    const pop = el('div', 'popup nc-popup');
    pop.innerHTML = `
      <div class="popup-head"><span class="mark" style="color:var(--accent);display:inline-flex">${CARD_ICON.customers || ''}</span><h3>${esc(ag.title)}</h3><span class="spacer"></span><button class="x js-close">${I.x}</button></div>
      <div class="popup-body">
        <div class="nc-ag-meta">${esc(fullName(c))}${c.agreementSignedAt ? ` · accepted ${esc(c.agreementSignedAt)}` : ' · not yet signed'}</div>
        <div class="nc-agreement" tabindex="0">${esc(ag.text)}</div>
        ${c.signature ? `<div class="nc-ag-sigline"><span class="nc-cap-lbl">Signature</span><img class="nc-thumb sig" src="${esc(c.signature)}" alt="signature" /></div>` : ''}
        <div class="pillrow" style="margin-top:14px;justify-content:flex-end"><button class="pill c-gray js-close">Close</button><button class="pill ref js-edit-customer" data-rec="${c.customerId}">Edit account</button></div>
      </div>`;
    overlay.appendChild(pop);
  } else if (o.kind === 'inspection') {
    // §12.8 Failure report — triggered when an inspection is marked Failed: capture a
    // photo/video + a description for the auto-created work order.
    const n = IDX.insp.get(o.recId);
    if (!n) { state.overlay = null; return; }
    const unit = IDX.unit.get(n.unitId);
    const ir = inspResult(n);
    const isVideo = (n.photo || '').startsWith('data:video');
    const media = n.photo
      ? `<div class="insp-photo">${isVideo ? `<video src="${esc(n.photo)}" controls></video>` : `<img src="${esc(n.photo)}" alt="failure photo">`}<label class="insp-rephoto">Replace<input type="file" accept="image/*,video/*" class="js-insp-photo" data-rec="${n.inspectionId}" hidden></label></div>`
      : `<label class="insp-photo empty"><span>${I.video} Add photo / video</span><input type="file" accept="image/*,video/*" class="js-insp-photo" data-rec="${n.inspectionId}" hidden></label>`;
    const pop = el('div', 'popup insp-popup');
    pop.innerHTML = `
      <div class="popup-head"><span class="c-icon" style="color:var(--red);display:inline-flex">${CARD_ICON.inspections}</span><h3>Failure report — ${esc(unit?.name || '—')}</h3><span class="spacer"></span><button class="x js-close">${I.x}</button></div>
      <div class="popup-body">
        <div class="pillrow" style="margin-bottom:12px">${unit ? unitPill(unit.unitId) : ''}<span class="pill c-${ir.color}">${esc(ir.label)}</span>${n.woId ? refPill('workOrders', n.woId, 'Work Order') : ''}<span class="muted" style="font-size:12px;margin-left:auto">${esc(fmtShortDate(n.date))}</span></div>
        ${media}
        <textarea class="insp-desc js-insp-desc" data-rec="${n.inspectionId}" placeholder="Describe the failure (what's wrong, parts needed)…">${esc(n.description || '')}</textarea>
        <div class="insp-gate" style="margin-top:12px"><span class="insp-gate-lbl">Charge the customer?</span><button class="pill ${n.billCustomer === 'Yes' ? 'c-green' : 'ref'} js-insp-bill" data-rec="${n.inspectionId}" data-val="Yes">Bill</button><button class="pill ${n.billCustomer === 'No' ? 'c-gray' : 'ref'} js-insp-bill" data-rec="${n.inspectionId}" data-val="No">Don't bill</button></div>
        <div class="pillrow" style="justify-content:flex-end;margin-top:14px"><button class="pill c-green js-close">Done</button></div>
      </div>`;
    overlay.appendChild(pop);
  } else if (o.kind === 'service') {
    // §7.7/§12.7 service completion — Hours at Completion · Date · Photo · Notes
    const u = IDX.unit.get(o.unitId);
    const rows = u ? serviceOrdersForUnit(u, u.serviceCompletions || {}, { hoursField: 'currentHours', baselineField: 'purchaseHours' }) : [];
    const task = rows.find((s) => s.taskId === o.taskId);
    if (!u || !task) { state.overlay = null; return; }
    const svcVid = (state.svcPhoto || '').startsWith('data:video');
    const media = state.svcPhoto
      ? `<div class="insp-photo">${svcVid ? `<video src="${esc(state.svcPhoto)}" controls></video>` : `<img src="${esc(state.svcPhoto)}" alt="service photo">`}<label class="insp-rephoto">Replace<input type="file" accept="image/*,video/*" class="js-svc-photo" hidden></label></div>`
      : `<label class="insp-photo empty req"><span>${I.video} Add photo / video (required)</span><input type="file" accept="image/*,video/*" class="js-svc-photo" hidden></label>`;
    const pop = el('div', 'popup insp-popup');
    pop.innerHTML = `
      <div class="popup-head"><span class="c-icon" style="color:var(--accent);display:inline-flex">${CARD_ICON.serviceOrders || ''}</span><h3>Complete service — ${esc(u.name)}</h3><span class="spacer"></span><button class="x js-close">${I.x}</button></div>
      <div class="popup-body">
        <div class="pillrow" style="margin-bottom:12px">${unitPill(u.unitId)}<span class="pill c-${task.color}">${esc(task.name)}</span><span class="muted" style="font-size:12px;margin-left:auto">${esc(svcText(task))}</span></div>
        <div class="svc-ref"><div class="svc-ref-head">Reference</div><div class="svc-ref-body">${task.parts && task.parts.length ? `Parts: ${esc(task.parts.join(' · '))}<br>` : ''}Filters · Hyperlinks · Instructions · Photo — set per-task in the backend (§7.7)</div></div>
        <label class="svc-field"><span>Hours at completion</span><input type="number" class="js-svc-hours" value="${num(u.currentHours)}"></label>
        <label class="svc-field"><span>Date completed</span><input type="date" class="js-svc-date" value="${TODAY_ISO}"></label>
        ${media}
        <textarea class="insp-desc js-svc-notes" placeholder="Notes (parts used, observations)…"></textarea>
        <div class="pillrow" style="justify-content:flex-end;margin-top:10px"><button class="pill c-green js-svc-save" data-unit="${u.unitId}" data-task="${task.taskId}">Record completion</button></div>
      </div>`;
    overlay.appendChild(pop);
  } else if (o.kind === 'schedule') {
    // §12.1 Schedule — a single date+time follow-up logged to the customer Activity Log
    const c = IDX.customer.get(o.customerId);
    if (!c) { state.overlay = null; return; }
    const def = `${TODAY_ISO}T${to24(nowHourLabel()) || '09:00'}`;
    const pop = el('div', 'popup'); pop.style.width = '340px';
    pop.innerHTML = `
      <div class="popup-head"><span class="c-icon" style="color:var(--accent);display:inline-flex">${CARD_ICON.customers}</span><h3>Schedule — ${esc(c.name)}</h3><span class="spacer"></span><button class="x js-close">${I.x}</button></div>
      <div class="popup-body">
        <label class="svc-field"><span>Date &amp; time</span><input type="datetime-local" class="js-sch-when" value="${def}"></label>
        <textarea class="insp-desc js-sch-note" placeholder="What's the follow-up? (quote call, pickup, demo…)"></textarea>
        <div class="pillrow" style="justify-content:flex-end;margin-top:10px"><button class="pill c-green js-schedule-save" data-rec="${c.customerId}">Add to schedule</button></div>
      </div>`;
    overlay.appendChild(pop);
  } else if (o.kind === 'addCard') {
    // Stripe Card Element — raw card data stays inside Stripe's iframe.
    const c = IDX.customer.get(o.customerId);
    if (!c) { state.overlay = null; return; }
    const consent = !!(c.signature && c.selfie);
    const pop = el('div', 'popup'); pop.style.width = '430px';
    pop.innerHTML = `
      <div class="popup-head"><span class="mark" style="color:var(--accent);display:inline-flex">${CARD_ICON.customers || ''}</span><h3>Add card — ${esc(c.name)}</h3><span class="spacer"></span><button class="x js-close">${I.x}</button></div>
      <div class="popup-body">
        ${consent ? '' : `<div class="login-err" style="text-align:left;margin-bottom:12px">A selfie + signature are required first (card authorization). <button class="pill ref js-edit-customer" data-rec="${c.customerId}" style="margin-left:6px">Complete account</button></div>`}
        <div class="pay-cap">Card number</div>
        <div class="pay-card-field" id="sl-card-element"></div>
        <div class="pay-err" id="sl-card-error"></div>
        <p class="muted" style="font-size:11px;margin:10px 0 0">Entered securely via Stripe. We store only the brand + last 4 digits — never the full number. The customer's signature + selfie on file authorize future charges.</p>
        <div class="pillrow" style="justify-content:flex-end;margin-top:14px"><button class="pill c-gray js-close">Cancel</button><button class="pill c-green js-card-save" ${consent ? '' : 'disabled style="opacity:.45;cursor:default"'}>Save card</button></div>
      </div>`;
    overlay.appendChild(pop);
  } else if (o.kind === 'payment') {
    const inv = IDX.invoice.get(o.invoiceId);
    if (!inv) { state.overlay = null; return; }
    const t = invoiceTotals(inv);
    const c = inv.customerId ? IDX.customer.get(inv.customerId) : null;
    const card = hasCardOnFile(c);
    const paid = inv.paid === true || t.status === 'Paid' || t.balance <= 0;
    const pop = el('div', 'popup'); pop.style.width = '380px';
    pop.innerHTML = `
      <div class="popup-head"><span class="mark" style="color:var(--accent);display:inline-flex">${CARD_ICON.invoices || ''}</span><h3>Pay ${esc(inv.invoiceId)}</h3><span class="spacer"></span><button class="x js-close">${I.x}</button></div>
      <div class="popup-body">
        <div class="pay-amount"><span class="pay-amount-num">${money(t.balance)}</span><span class="pay-amount-sfx">due${c ? ' · ' + esc(c.name) : ''}</span></div>
        ${paid ? '<div class="pay-card-on-file good">✓ This invoice is paid.</div>'
          : card ? `<div class="pay-card-on-file"><span class="pill c-gray" style="min-width:0">${I.qr ? '' : ''}💳</span><span>${esc(cardLabel(c))}</span></div>`
                 : '<div class="pay-card-on-file warn">No card on file for this customer.</div>'}
        ${o.error ? `<div class="login-err" style="text-align:left;margin-top:10px">${esc(o.error)}</div>` : ''}
        <div class="pillrow" style="justify-content:flex-end;margin-top:16px">
          <button class="pill c-gray js-close">Close</button>
          ${paid ? '' : card
            ? `<button class="pill c-green js-charge-invoice" data-rec="${inv.invoiceId}" ${o.busy ? 'disabled' : ''}>${o.busy ? 'Charging…' : 'Charge ' + money(t.balance)}</button>`
            : `<button class="pill ref js-pay-addcard" data-rec="${inv.customerId || ''}" data-inv="${inv.invoiceId}" ${inv.customerId ? '' : 'disabled style="opacity:.45;cursor:default"'}>Add a card</button>`}
        </div>
      </div>`;
    overlay.appendChild(pop);
  }
  root.appendChild(overlay);
  if (o.kind === 'newCustomer') setupSignaturePad();
  if (o.kind === 'addCard') { const cc = IDX.customer.get(o.customerId); if (cc && cc.signature && cc.selfie) mountCardElement(); }   // only mount with consent (nothing to orphan otherwise)
}
const openOverlay = (o) => { state.overlay = o; renderOverlay(); };
// Read the customer-form inputs back into the draft (call before any re-render so
// typed values survive a selfie/signature/pill change).
function ncSyncInputs() {
  const o = state.overlay; if (!o || o.kind !== 'newCustomer') return;
  const root = document.querySelector('.overlay .popup-body'); if (root) root.querySelectorAll('[data-f]').forEach((i) => { o.draft[i.dataset.f] = i.value.trim(); });
}
// Wire the signature canvas for finger/stylus/mouse drawing (white bg → JPEG export).
function setupSignaturePad() {
  const cv = document.querySelector('.overlay .nc-sigpad'); if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = '#15171c'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let drawing = false, last = null;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) }; };
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); drawing = true; last = pos(e); cv.dataset.drawn = '1'; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (!drawing) return; e.preventDefault(); const p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; });
  cv.addEventListener('pointerup', () => { drawing = false; });
  cv.addEventListener('pointerleave', () => { drawing = false; });
}
const closeOverlay = () => { destroyCardElement(); state.overlay = null; renderOverlay(); };

/* ── Back-office boards (§7.9–7.12): spreadsheet-style tables ─────────────── */
function vendorTotals(vendorId) {
  const exp = DATA.expenses.filter((e) => e.vendorId === vendorId);
  const totalSpent = exp.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const partsCount = DATA.parts.filter((p) => p.vendorId === vendorId).length;
  return { totalSpent, partsCount, avgCost: partsCount ? Math.round(totalSpent / partsCount) : 0 };
}
const reviewSoon = (iso) => { const d = parseISO(iso); return d && (d - TODAY) / 86400000 <= 30 && d >= TODAY; };
const boardRows = (boardId) => ({ parts: DATA.parts, vendors: DATA.vendors, expenses: DATA.expenses, files: DATA.companyFiles }[boardId] || []);
const BOARD_DEF = {
  parts: {
    cols: ['Part', 'Vendor', 'Cost', 'Qty', 'Product #', 'Order from'],
    row: (p) => [esc(p.name), esc(IDX.vendor.get(p.vendorId)?.name || '—'), p.priceEach != null ? money(p.priceEach) : '—', p.qtyOnHand != null ? `${p.qtyOnHand}` : '—', esc(p.productNumber || '—'), esc(p.orderEmail || p.website || '—')],
  },
  vendors: {
    cols: ['Vendor', 'Type', 'Phone', 'Total Spent', 'Parts', 'Avg Cost'],
    row: (v) => { const t = vendorTotals(v.vendorId); return [esc(v.name) + (v.salesTaxExempt ? ' <span class="badge">tax-exempt</span>' : ''), badge(v.vendorType || '—', v.vendorType === 'Online' ? 'navy' : 'gray'), esc(v.phone || '—'), money(t.totalSpent), `${t.partsCount}`, t.partsCount ? money(t.avgCost) : '—']; },
  },
  expenses: {
    cols: ['Vendor', 'Date', 'Amount', 'Reconcile', 'Method', 'Category', 'WO'],
    row: (e) => [esc(IDX.vendor.get(e.vendorId)?.name || '—'), esc(fmtShortDate(e.date)), money(e.amount), statusPill('expenseReconcile', e.reconcile), badge(e.method, getStatus('paymentMethod', e.method).color), badge(e.category, getStatus('expenseCategory', e.category).color), e.woId ? `<span class="pill ref">${esc(e.woId)}</span>` : '—'],
  },
  files: {
    cols: ['Title', 'Type', 'Group', 'Review-By'],
    row: (f) => [esc(f.name), badge(getStatus('companyFileType', f.type).label, getStatus('companyFileType', f.type).color), esc(f.group || '—'), f.reviewByDate ? esc(fmtShortDate(f.reviewByDate)) + (reviewSoon(f.reviewByDate) ? ' <span class="pill c-yellow">review soon</span>' : '') : '—'],
  },
};
function boardTable(boardId) {
  const def = BOARD_DEF[boardId]; const rows = boardRows(boardId);
  if (!def) return '<p class="muted">—</p>';
  const head = `<tr>${def.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const body = rows.map((r) => `<tr>${def.row(r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table class="board-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

/* ════════════════════════════════════════════════════════════════════════
   12. Status dropdown (pill-rule exception — the record's own status pill)
   ════════════════════════════════════════════════════════════════════════ */
/** Shared floating dropdown (matches board chrome) — used by the status pill
 *  dropdown and the in-card Sort menu. */
function openDropdown(anchorEl, html, { align = 'left' } = {}) {
  // re-clicking the SAME trigger toggles the menu shut (the anchor is excluded from the
  // outside-close handler below, so its mousedown doesn't pre-close before this runs).
  const existing = document.querySelector('.dropdown-menu');
  const sameAnchor = existing && existing._anchor === anchorEl;
  // detach each closing menu's own outside-close listener so none orphan on document
  document.querySelectorAll('.dropdown-menu').forEach((n) => { if (n._off) document.removeEventListener('mousedown', n._off); n.remove(); });
  if (sameAnchor) return null;
  const dd = el('div', 'dropdown-menu', html);
  dd._anchor = anchorEl;
  document.body.appendChild(dd);
  const rect = anchorEl.getBoundingClientRect();
  const w = dd.offsetWidth || 180, h = dd.offsetHeight || 100;
  let left = align === 'right' ? rect.right - w : rect.left;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  let top = rect.bottom + 5;
  if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 5);
  dd.style.left = left + 'px'; dd.style.top = top + 'px';
  const off = (e) => { if (!dd.contains(e.target) && !anchorEl.contains(e.target)) { dd.remove(); document.removeEventListener('mousedown', off); } };
  dd._off = off;
  setTimeout(() => document.addEventListener('mousedown', off), 0);
  return dd;
}
function openStatusDropdown(rentalId, anchorEl) {
  // Tomorrow/Today are DERIVED display states (not user-selectable) — exclude from the picker
  const html = Object.keys(STATUS.rentalStatus).filter((v) => v !== 'Tomorrow' && v !== 'Today').map((v) =>
    `<button class="dd-item js-setstatus" data-rec="${esc(rentalId)}" data-val="${esc(v)}">${statusPill('rentalStatus', v)}</button>`).join('');
  openDropdown(anchorEl, html);
}
function openTransportDropdown(rentalId, anchorEl) {
  const html = Object.keys(STATUS.transportType).map((v) =>
    `<button class="dd-item js-settransport" data-rec="${esc(rentalId)}" data-val="${esc(v)}">${statusPill('transportType', v)}</button>`).join('');
  openDropdown(anchorEl, html);
}
function openFleetDropdown(unitId, anchorEl) {
  const html = Object.keys(STATUS.unitFleetStatus).map((v) =>
    `<button class="dd-item js-setfleet" data-rec="${esc(unitId)}" data-val="${esc(v)}">${statusPill('unitFleetStatus', v)}</button>`).join('');
  openDropdown(anchorEl, html);
}
function setUnitFleet(unitId, val) {
  const u = IDX.unit.get(unitId); if (!u) return;
  u.fleetStatus = val; reindex('units', u);
  logAction(u, `Fleet status → ${getStatus('unitFleetStatus', val).label}`);
  document.querySelectorAll('.dropdown-menu').forEach((n) => n.remove());
  render();
}
function openFunnelDropdown(custId, which, anchorEl) {
  const cust = IDX.customer.get(custId);
  const cur = which === 'membership' ? cust?.membershipStage : cust?.usedSalesStage;
  const html = Object.keys(STATUS.funnelStage).map((v) =>
    `<button class="dd-item js-setfunnel ${v === cur ? 'on' : ''}" data-rec="${esc(custId)}" data-which="${which}" data-val="${esc(v)}">${badge(getStatus('funnelStage', v).label, getStatus('funnelStage', v).color)}</button>`).join('');
  openDropdown(anchorEl, html);
}
function setFunnelStage(custId, which, val) {
  const c = IDX.customer.get(custId);
  if (!c) return;
  if (which === 'membership') c.membershipStage = val; else c.usedSalesStage = val;
  reindex('customers', c);
  document.querySelectorAll('.dropdown-menu').forEach((n) => n.remove());
  render();
}
function openSortMenu(card, anchorEl) {
  const cs = activeSession().cards[card];
  const html = SORT_FIELDS[card].map((f) =>
    `<button class="dd-item js-sortfield ${f.field === cs.sort.field ? 'on' : ''}" data-card="${card}" data-field="${f.field}">${esc(f.label)}<span class="tick">✓</span></button>`).join('');
  openDropdown(anchorEl, html, { align: 'right' });
}
/** Clicked card → orange border (§0.1 visual feedback; not an anchor). */
function setFocusedCard(cardId) {
  if (state.focusedCard === cardId) return;
  state.focusedCard = cardId;
  document.querySelectorAll('.card.card-focus').forEach((c) => c.classList.remove('card-focus'));
  const c = cardId && document.querySelector(`.card[data-card="${cardId}"]`);
  if (c) c.classList.add('card-focus');
}

/* ════════════════════════════════════════════════════════════════════════
   13. Render pipeline + toast
   ════════════════════════════════════════════════════════════════════════ */
let renderCount = 0;
function render() {
  const t0 = performance.now();
  hideTip();
  // Preserve each card's scroll position across the DOM swap, so recording an action
  // or editing a field doesn't dump you back at the top of a scrolled card (§0.6).
  const scrollMemo = {};
  document.querySelectorAll('.card[data-card]').forEach((c) => { const b = c.querySelector('.card-body'); if (b && b.scrollTop) scrollMemo[c.dataset.card] = b.scrollTop; });
  availWin = activeDraftWindow();   // §10 — recompute window availability each render
  // Build off-screen, then swap in ONE operation (replaceChildren) so there's no
  // blank frame between teardown and rebuild — kills the flash on anchor/cascade.
  const header = headerEl();
  const session = activeSession();
  if (state.dashboard) {
    $('#app').replaceChildren(header, dashboardEl());
    document.documentElement.setAttribute('data-theme', state.theme);
    applyTitles();
    return;
  }
  const grid = el('div', 'grid');
  for (const cardDef of GRID_CARDS) grid.appendChild(cardEl(cardDef, session));
  const pb = pickBarEl();
  if (pb) $('#app').replaceChildren(header, pb, grid); else $('#app').replaceChildren(header, grid);
  // restore the per-card scroll captured above
  Object.keys(scrollMemo).forEach((card) => { const b = document.querySelector(`.card[data-card="${card}"] .card-body`); if (b) b.scrollTop = scrollMemo[card]; });
  document.documentElement.setAttribute('data-theme', state.theme);
  // the rental-window picker floats above the grid, anchored to its trigger (§12.2)
  if (state.winpicker) {
    const wr = IDX.rental.get(state.winpicker.rentalId);
    if (wr) { const fl = el('div', 'winpicker-float'); fl.innerHTML = winPickerEl(wr); $('#app').appendChild(fl); positionWinPicker(fl); }
    else state.winpicker = null;
  }
  applyTitles();   // full text on hover wherever we truncate (custom ~0.5s tooltip)
  const dt = performance.now() - t0;
  renderCount++;
  if (dt > CFG.PERF_BUDGET_MS) console.warn(`[perf] render ${renderCount} took ${dt.toFixed(1)}ms (budget ${CFG.PERF_BUDGET_MS}ms)`);
  else console.log(`[perf] render ${renderCount}: ${dt.toFixed(1)}ms`);
}
/** Flag any element that's actually truncated with data-tip (full text) so the
 *  custom app-styled tooltip can show it on hover. Nothing lost to ellipsis. */
function applyTitles() {
  document.querySelectorAll('.r-title, .r-fields span, .tab-name, .c-title, .kv > .v, .pill').forEach((e) => {
    if (e.scrollWidth > e.clientWidth + 1) e.setAttribute('data-tip', e.textContent.trim());
    else if (e.hasAttribute('data-tip')) e.removeAttribute('data-tip');
  });
}

/* Custom tooltip (matches the app, not the OS) — shows full text after ~0.5s. */
let tipTimer, tipEl;
function initTooltip() {
  tipEl = el('div', 'tooltip'); document.body.appendChild(tipEl);
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => {
      tipEl.textContent = t.getAttribute('data-tip');
      const r = t.getBoundingClientRect();
      tipEl.style.maxWidth = 'none';
      tipEl.style.left = Math.max(8, Math.min(r.left, window.innerWidth - tipEl.offsetWidth - 8)) + 'px';
      tipEl.style.top = (r.bottom + 6 > window.innerHeight - 30 ? r.top - 30 : r.bottom + 6) + 'px';
      tipEl.classList.add('show');
    }, 500);
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('[data-tip]')) { clearTimeout(tipTimer); tipEl.classList.remove('show'); }
  });
}
const hideTip = () => { clearTimeout(tipTimer); if (tipEl) tipEl.classList.remove('show'); };
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ════════════════════════════════════════════════════════════════════════
   14. Event delegation (single listener tree)
   ════════════════════════════════════════════════════════════════════════ */
function onClick(e) {
  const t = e.target;
  const closest = (sel) => t.closest(sel);

  // clicked card → orange-border focus (§0.1 visual feedback; applied immediately,
  // independent of whatever else this click does — anchor stays a separate action)
  const fc = closest('.card');
  setFocusedCard(fc ? fc.dataset.card : state.focusedCard);

  // §0.3 — while a rental window is in scope, clicking a Category filters the Units
  // (KEEP the calendar open; works whether or not the unit-pick slot is set yet)
  if (availWin) {
    const crow = closest('.row');
    if (crow && crow.dataset.card === 'categories') {
      e.stopPropagation();
      if (!state.pick || state.pick.slot !== 'unit') state.pick = { card: 'rentals', recId: availWin.selfId, recType: undefined, slot: 'unit' };
      state.pick.catFilter = state.pick.catFilter === crow.dataset.rec ? null : crow.dataset.rec;
      render();
      return;
    }
  }

  // close the floating window-picker on any click outside it / its trigger
  if (state.winpicker && !closest('.winpicker') && !closest('.js-open-winpicker')) { state.winpicker = null; render(); }

  // §0.3 pick mode — a click in the highlighted source card assigns to the draft
  if (state.pick) {
    if (closest('.js-cancelpick')) return cancelPick();
    const prow = closest('.row');
    if (prow) {
      const want = PICK_SRC[state.pick.slot];
      const rowEntity = prow.dataset.card === 'shop' ? prow.dataset.type : prow.dataset.card;
      if (rowEntity === want) { e.stopPropagation(); return assignPick(prow.dataset.rec); }
    }
  }

  // header / chrome
  if (closest('.js-logo')) return openLogoMenu(closest('.js-logo'));
  if (closest('.js-switch-user')) { e.stopPropagation(); return switchUser(); }
  if (closest('.js-open-settings')) { e.stopPropagation(); return openSettings(); }
  if (closest('.js-settings-save')) { e.stopPropagation(); return saveSettings(); }
  if (closest('.js-nc-save')) { e.stopPropagation(); return saveNewCustomer(); }
  if (closest('.js-nc-acct')) { const b = closest('.js-nc-acct'); e.stopPropagation(); ncSyncInputs(); state.overlay.draft.accountType = b.dataset.val; renderOverlay(); return; }
  if (closest('.js-nc-selfie-clear')) { e.stopPropagation(); ncSyncInputs(); state.overlay.draft.selfie = ''; renderOverlay(); return; }
  if (closest('.js-nc-sig-save')) { e.stopPropagation(); const cv = document.querySelector('.overlay .nc-sigpad'); if (cv && cv.dataset.drawn) { ncSyncInputs(); const dr = state.overlay.draft; dr.signature = cv.toDataURL('image/jpeg', 0.6); dr.agreementType = /member/i.test(dr.accountType || '') ? 'membership' : 'rental'; dr.agreementSignedAt = TODAY_ISO; renderOverlay(); } else toast('Sign in the box first.'); return; }
  if (closest('.js-nc-sig-clearpad')) { e.stopPropagation(); const cv = document.querySelector('.overlay .nc-sigpad'); if (cv) { const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); cv.dataset.drawn = ''; } return; }
  if (closest('.js-nc-sig-clear')) { e.stopPropagation(); ncSyncInputs(); const dr = state.overlay.draft; dr.signature = ''; dr.agreementType = ''; dr.agreementSignedAt = ''; renderOverlay(); return; }
  if (closest('.js-nc-qr')) { e.stopPropagation(); const id = state.overlay.editId; openOverlay({ kind: 'qr', title: 'Continue on phone', url: location.origin + location.pathname + '#edit=' + id, caption: 'Scan to finish this account on your phone.' }); return; }
  if (closest('.js-edit-customer')) { e.stopPropagation(); return openCustomerForm(closest('.js-edit-customer').dataset.rec); }
  if (closest('.js-view-agreement')) { e.stopPropagation(); const cust = IDX.customer.get(closest('.js-view-agreement').dataset.rec); if (cust) openOverlay({ kind: 'agreement', recId: cust.customerId }); return; }
  if (closest('.js-add-card')) { e.stopPropagation(); return openAddCard(closest('.js-add-card').dataset.rec); }
  if (closest('.js-card-save')) { e.stopPropagation(); return saveCardFlow(closest('.js-card-save')); }
  if (closest('.js-pay-invoice')) { e.stopPropagation(); return openPayInvoice(closest('.js-pay-invoice').dataset.rec); }
  if (closest('.js-charge-invoice')) { e.stopPropagation(); return chargeInvoiceFlow(closest('.js-charge-invoice').dataset.rec); }
  if (closest('.js-pay-addcard')) { e.stopPropagation(); const b = closest('.js-pay-addcard'); return openAddCard(b.dataset.rec, { returnTo: 'payment', invoiceId: b.dataset.inv }); }
  if (closest('.js-ring')) return openOverlay({ kind: 'role', role: closest('.js-ring').dataset.role });
  if (closest('.js-close')) return closeOverlay();
  if (closest('.js-theme')) { state.theme = state.theme === 'dark' ? 'light' : 'dark'; if (state.overlay && state.overlay.kind !== 'addCard') renderOverlay(); render(); return; }
  if (closest('.js-qr')) return openOverlay({ kind: 'qr' });
  if (closest('.js-board')) { const b = closest('.js-board'); document.querySelectorAll('.dropdown-menu').forEach((n) => n.remove()); return openOverlay({ kind: 'board', board: b.dataset.board }); }
  if (closest('.js-dashboard')) { state.dashboard = !state.dashboard; state.winpicker = null; state.pick = null; return render(); }
  if (closest('.js-dash-ev')) { e.stopPropagation(); state.dashboard = false; state.pick = null; return anchorRecord('rentals', closest('.js-dash-ev').dataset.rec); }
  if (closest('.js-newrental')) return openNewMenu(closest('.js-newrental'));
  if (closest('.js-newitem')) {
    const kind = closest('.js-newitem').dataset.new;
    const cust = activeSession().anchor?.card === 'customers' ? activeSession().anchor.recId : null;
    document.querySelectorAll('.dropdown-menu').forEach((n) => n.remove());
    if (kind === 'rental') return startNewRental(cust);
    if (kind === 'inspection') return startNewInspection();
    if (kind === 'workOrder') return startNewWorkOrder();
    if (kind === 'invoice') return startNewInvoice(cust);
    if (kind === 'customer') return startNewCustomer();
    if (kind === 'receipt') return startNewReceipt();
    return;
  }
  if (closest('.js-clear')) return clearSearch();
  if (closest('.js-ft-neg')) { const b = closest('.js-ft-neg'); e.stopPropagation(); return toggleFilterNeg(b.dataset.scope, Number(b.dataset.i)); }
  if (closest('.js-ft-x')) { const b = closest('.js-ft-x'); e.stopPropagation(); return removeFilterTerm(b.dataset.scope, Number(b.dataset.i)); }
  if (closest('.js-closeall')) return closeAll();
  if (closest('.js-tab')) return switchTab(closest('.js-tab').dataset.tab);

  // status dropdown set
  if (closest('.js-setstatus')) { const b = closest('.js-setstatus'); setRentalStatus(b.dataset.rec, b.dataset.val); document.querySelectorAll('.dropdown-menu').forEach((n) => n.remove()); return; }
  // funnel stage pill → stage dropdown; set; +Add Category / Record / Schedule
  if (closest('.js-setfunnel')) { const b = closest('.js-setfunnel'); return setFunnelStage(b.dataset.rec, b.dataset.which, b.dataset.val); }
  if (closest('.js-funnel')) { const b = closest('.js-funnel'); e.stopPropagation(); return openFunnelDropdown(b.dataset.rec, b.dataset.which, b); }
  if (closest('.js-fleet-filter')) {
    const b = closest('.js-fleet-filter'); e.stopPropagation();
    const same = state.fleetFilter?.categoryId === b.dataset.cat && state.fleetFilter?.status === b.dataset.status && state.fleetFilter?.kind === b.dataset.kind;
    state.fleetFilter = same ? null : { categoryId: b.dataset.cat, status: b.dataset.status, kind: b.dataset.kind };
    anchorRecord('categories', b.dataset.cat);   // §12.3 — anchor the category so Units cascades
    return;
  }
  if (closest('.js-addcat')) { e.stopPropagation(); return beginPick('customers', closest('.js-addcat').dataset.rec, undefined, 'intcat'); }
  if (closest('.js-funnel-record')) { e.stopPropagation(); const c = IDX.customer.get(closest('.js-funnel-record').dataset.rec); if (c && c.salesAction) { c.activityLog = c.activityLog || []; c.activityLog.push({ when: TODAY_ISO, text: c.salesAction }); c.salesAction = ''; toast('Logged to the Activity Log.'); render(); } else toast('Type an action in the chip first.'); return; }
  if (closest('.js-funnel-schedule')) { e.stopPropagation(); return openOverlay({ kind: 'schedule', customerId: closest('.js-funnel-schedule').dataset.rec }); }
  if (closest('.js-schedule-save')) { const b = closest('.js-schedule-save'); e.stopPropagation(); const root = b.closest('.popup-body'); const c = IDX.customer.get(b.dataset.rec); const when = root.querySelector('.js-sch-when')?.value; const note = (root.querySelector('.js-sch-note')?.value || '').trim(); if (!c || !when) { toast('Pick a date & time first.'); return; } c.activityLog = c.activityLog || []; c.activityLog.push({ when: when.slice(0, 10), text: `Scheduled: ${note || 'follow-up'} @ ${when.replace('T', ' ')}` }); reindex('customers', c); toast('Scheduled — added to the Activity Log.'); closeOverlay(); }
  // draft pickers / creation affordances (§0.3)
  if (closest('.js-pick')) { const b = closest('.js-pick'); e.stopPropagation(); return beginPick(b.dataset.card, b.dataset.rec, b.dataset.type || undefined, b.dataset.slot); }
  if (closest('.js-create-invoice')) { e.stopPropagation(); return createInvoiceForRental(closest('.js-create-invoice').dataset.rec); }
  if (closest('.js-field-call')) { e.stopPropagation(); return markFieldCall(closest('.js-field-call').dataset.rec); }
  if (closest('.js-clear-fc')) { e.stopPropagation(); return clearFieldCall(closest('.js-clear-fc').dataset.rec); }
  if (closest('.js-wash-request')) { e.stopPropagation(); return startWashRequest(closest('.js-wash-request').dataset.rec || null); }
  if (closest('.js-bill-wo')) { e.stopPropagation(); return billWOToInvoice(closest('.js-bill-wo').dataset.rec); }
  if (closest('.js-wo-bill')) { const b = closest('.js-wo-bill'); e.stopPropagation(); const w = IDX.wo.get(b.dataset.rec); if (w) { w.billCustomer = w.billCustomer === 'Yes' ? 'No' : 'Yes'; reindex('workOrders', w); logAction(w, `Bill customer → ${w.billCustomer}`); render(); } return; }
  if (closest('.js-svc-complete')) { const b = closest('.js-svc-complete'); e.stopPropagation(); state.svcPhoto = null; return openOverlay({ kind: 'service', unitId: b.dataset.unit, taskId: b.dataset.task }); }
  if (closest('.js-svc-save')) { const b = closest('.js-svc-save'); e.stopPropagation(); if (!state.svcPhoto) { toast('Photo / video proof is required to complete a service.'); return; } const root = b.closest('.popup-body'); return recordServiceCompletion(b.dataset.unit, b.dataset.task, root.querySelector('.js-svc-hours')?.value, root.querySelector('.js-svc-date')?.value, root.querySelector('.js-svc-notes')?.value, state.svcPhoto); }
  // invoice line-item add buttons → enter a pick for the source card
  if (closest('.js-add-line')) {
    const b = closest('.js-add-line'); e.stopPropagation();
    const inv = IDX.invoice.get(b.dataset.rec);
    if (b.dataset.kind === 'Rental') { if (inv && !inv.customerId) { toast('Pick a customer first.'); return beginPick('invoices', b.dataset.rec, undefined, 'customer'); } return beginPick('invoices', b.dataset.rec, undefined, 'rental'); }
    if (b.dataset.kind === 'WO') return beginPick('invoices', b.dataset.rec, undefined, 'wo');
    state.invLineForm = b.dataset.rec; return render();   // inline custom-line form
  }
  if (closest('.js-line-save')) { const b = closest('.js-line-save'); e.stopPropagation(); const root = b.closest('.lineform'); const label = root.querySelector('.js-lf-label')?.value; const amt = Number(root.querySelector('.js-lf-amt')?.value) || 0; state.invLineForm = null; return addCustomLine(b.dataset.rec, label || 'Custom', amt); }
  if (closest('.js-line-cancel')) { e.stopPropagation(); state.invLineForm = null; return render(); }
  if (closest('.js-add-part')) { const b = closest('.js-add-part'); e.stopPropagation(); state.woPartForm = b.dataset.rec; return render(); }
  if (closest('.js-part-save')) { const b = closest('.js-part-save'); e.stopPropagation(); const root = b.closest('.lineform'); const part = root.querySelector('.js-pf-part')?.value; const cost = Number(root.querySelector('.js-pf-cost')?.value) || 0; const hours = Number(root.querySelector('.js-pf-hours')?.value) || 0; state.woPartForm = null; return addPartToWO(b.dataset.rec, part || 'Part', cost, hours); }
  if (closest('.js-part-cancel')) { e.stopPropagation(); state.woPartForm = null; return render(); }
  // inspection gated flow (§9): Wash → Checklist → result
  if (closest('.js-open-insp')) { e.stopPropagation(); return openOverlay({ kind: 'inspection', recId: closest('.js-open-insp').dataset.rec }); }
  if (closest('.js-insp-wash')) { const b = closest('.js-insp-wash'); e.stopPropagation(); return setInspWash(b.dataset.rec, b.dataset.val); }
  if (closest('.js-insp-result')) { const b = closest('.js-insp-result'); e.stopPropagation(); return setInspResult(b.dataset.rec, b.dataset.val); }
  if (closest('.js-insp-bill')) { const b = closest('.js-insp-bill'); e.stopPropagation(); return setInspBill(b.dataset.rec, b.dataset.val); }

  // rental status pill on its own open card → dropdown (pill-rule exception)
  if (closest('.js-status-pill')) return openStatusDropdown(closest('.js-status-pill').dataset.rec, closest('.js-status-pill'));
  if (closest('.js-transport-pill')) { const b = closest('.js-transport-pill'); e.stopPropagation(); return openTransportDropdown(b.dataset.rec, b); }
  if (closest('.js-fleetstatus')) { const b = closest('.js-fleetstatus'); e.stopPropagation(); return openFleetDropdown(b.dataset.rec, b); }
  if (closest('.js-setfleet')) { const b = closest('.js-setfleet'); document.querySelectorAll('.dropdown-menu').forEach((n) => n.remove()); return setUnitFleet(b.dataset.rec, b.dataset.val); }
  if (closest('.js-wophase')) { const b = closest('.js-wophase'); e.stopPropagation(); return openWoPhaseDropdown(b.dataset.rec, b, null); }
  if (closest('.js-wophase-line')) { const b = closest('.js-wophase-line'); e.stopPropagation(); return openWoPhaseDropdown(b.dataset.rec, b, Number(b.dataset.idx)); }
  if (closest('.js-setwophase')) { const b = closest('.js-setwophase'); document.querySelectorAll('.dropdown-menu').forEach((n) => n.remove()); return setWoPhase(b.dataset.rec, b.dataset.val); }
  if (closest('.js-setwolinephase')) { const b = closest('.js-setwolinephase'); document.querySelectorAll('.dropdown-menu').forEach((n) => n.remove()); return setWoLinePhase(b.dataset.rec, Number(b.dataset.idx), b.dataset.val); }
  if (closest('.js-settransport')) { const b = closest('.js-settransport'); const r = IDX.rental.get(b.dataset.rec); if (r) r.transportType = b.dataset.val; document.querySelectorAll('.dropdown-menu').forEach((n) => n.remove()); const s = activeSession(); if (s.anchor) setAnchor(s, s.anchor.card, s.anchor.recId, s.anchor.recType); render(); return; }

  // §12.2 rental-window range picker (calendar popup) — clicking the bar opens it
  if (closest('.js-wp-day')) { e.stopPropagation(); return winPickDay(closest('.js-wp-day').dataset.iso); }
  if (closest('.js-wp-prev')) { e.stopPropagation(); return winPickMonth(-1); }
  if (closest('.js-wp-next')) { e.stopPropagation(); return winPickMonth(1); }
  if (closest('.js-wp-clear')) { e.stopPropagation(); return winPickClear(); }
  if (closest('.js-wp-today')) { e.stopPropagation(); return winPickToday(); }
  if (closest('.js-wp-done')) { e.stopPropagation(); return closeWinPicker(); }
  if (closest('.js-open-winpicker')) { e.stopPropagation(); const rec = closest('.js-open-winpicker').dataset.rec; return state.winpicker?.rentalId === rec ? closeWinPicker() : openWinPicker(rec); }

  // sort menu + direction toggle
  if (closest('.js-sortmenu')) { const b = closest('.js-sortmenu'); return openSortMenu(b.dataset.card, b); }
  if (closest('.js-sortfield')) { const b = closest('.js-sortfield'); const cs = activeSession().cards[b.dataset.card]; const f = SORT_FIELDS[b.dataset.card].find((x) => x.field === b.dataset.field); if (f) { cs.sort = { ...f }; saveSort(b.dataset.card, cs.sort); } document.querySelectorAll('.dropdown-menu').forEach((n) => n.remove()); render(); return; }
  if (closest('.js-sortdir')) { const card = closest('.js-sortdir').dataset.card; const cs = activeSession().cards[card]; cs.sort.dir = cs.sort.dir === 'asc' ? 'desc' : 'asc'; saveSort(card, cs.sort); render(); return; }

  // inline edit (click a value → input)
  if (closest('.inline-edit')) { e.stopPropagation(); return startInlineEdit(closest('.inline-edit')); }

  // X-to-swap / remove on pills (handle before the pill-open)
  const xEl = closest('.x');
  if (xEl) { e.stopPropagation(); return handlePillX(xEl); }

  // shop segment switch — clicking the active segment toggles back to All
  if (closest('.js-shopseg')) { const seg = closest('.js-shopseg').dataset.seg; const cs = activeSession().cards.shop; cs.segment = (cs.segment === seg) ? 'all' : seg; render(); return; }

  // row / header action buttons (anchor / new tab) — recType is set for Shop items
  const anchorBtn = closest('.js-anchor');
  if (anchorBtn) {
    e.stopPropagation();
    const row = anchorBtn.closest('.row');
    const card = anchorBtn.closest('.card')?.dataset.card;
    return anchorRecord(card, anchorBtn.dataset.rec || row?.dataset.rec, anchorBtn.dataset.type || row?.dataset.type);
  }
  const newtabBtn = closest('.js-newtab');
  if (newtabBtn) {
    e.stopPropagation();
    const row = newtabBtn.closest('.row');
    const card = newtabBtn.closest('.card')?.dataset.card;
    return openInNewTab(card, newtabBtn.dataset.rec || row?.dataset.rec, newtabBtn.dataset.type || row?.dataset.type);
  }

  if (closest('.js-showmore')) { const b = closest('.js-showmore'); e.stopPropagation(); const cs = activeSession().cards[b.dataset.card]; if (cs) { cs.listLimit = (cs.listLimit || VIRT_CAP) + SHOW_MORE_BATCH; render(); } return; }
  if (closest('.js-tolist')) { const card = closest('.card').dataset.card; activeSession().cards[card].mode = 'list'; render(); return; }

  // universal pill rule (clicking any pill → its target card to standard)
  const pill = closest('[data-pill-card]');
  if (pill) {
    e.stopPropagation();
    return pillTo(pill.dataset.pillCard, castId(pill.dataset.pillCard, pill.dataset.pillRec));
  }

  // click a row → standard mode (selection highlight handled too)
  const row = closest('.row');
  if (row) {
    // hotkey: Ctrl/Cmd+click opens the row in a new background tab (§0.1)
    if (e.metaKey || e.ctrlKey) { e.preventDefault(); return openInNewTab(row.dataset.card, row.dataset.rec, row.dataset.type); }
    // clicking a search result drills into it AND leaves search (§5.4)
    if (state.searchMode) { state.searchMode = false; state.query = ''; }
    // browsing the anchored card's list (js-tolist) → a row click RE-ANCHORS that item
    const sess = activeSession();
    if (sess.anchor?.card === row.dataset.card && sess.cards[row.dataset.card].mode === 'list') {
      return anchorRecord(row.dataset.card, row.dataset.rec, row.dataset.type);
    }
    document.querySelectorAll('.row.selected').forEach((n) => n.classList.remove('selected'));
    row.classList.add('selected');
    return openStandard(row.dataset.card, row.dataset.rec, row.dataset.type);
  }

  // click dead space → exit search mode (§5.4)
  if (state.searchMode && !closest('.card') && !closest('.header')) clearSearch();
}
function castId(card, raw) { return raw; }   // all our IDs are strings

function handlePillX(xEl) {
  const kind = xEl.dataset.x;
  // operate on the record open in the card that contains this pill. The Shop card
  // holds 3 entity types, so resolve through its recType (recOf('shop',…) fails).
  const cardNode = xEl.closest('.card');
  const card = cardNode?.dataset.card;
  const session = activeSession();
  const cs = card ? session.cards[card] : null;
  const recId = cs && cs.recId != null ? cs.recId : (session.anchor?.card === card ? session.anchor.recId : null);
  const recType = cs ? cs.recType : (session.anchor?.card === card ? session.anchor.recType : null);
  const entity = entityCardOf(card, recType);
  const rec = recId != null ? recOf(entity, recId) : null;
  if (!rec) return;

  if (kind === 'unit-swap') {
    rec.unitId = null; if (entity === 'rentals') rec.categoryId = null;
    toast('Unit removed — pick a replacement.'); return beginPick(card, recId, recType, 'unit');
  } else if (kind === 'cust-swap') {
    rec.customerId = null; toast('Customer removed — pick a replacement.'); return beginPick(card, recId, recType, 'customer');
  } else if (kind === 'inv-remove') {
    const inv = IDX.invoice.get(rec.invoiceId);
    if (inv && invoiceTotals(inv).paid > 0) { toast('Blocked: invoice has a payment — cannot unlink (§7.4).'); return; }
    rec.invoiceId = null; toast('Invoice unlinked.'); render();
  } else if (kind === 'inv-cust-remove') {
    if (invoiceTotals(rec).paid > 0) { toast('Blocked: invoice has a payment — customer locked (§7.5).'); return; }
    rec.customerId = null; toast('Customer removed — pick a replacement.'); return beginPick(card, recId, recType, 'customer');
  } else if (kind === 'inv-line-remove') {
    const idx = Number(xEl.dataset.idx);
    if (rec.lineItems && rec.lineItems[idx]) { rec.lineItems.splice(idx, 1); toast('Line item removed.'); render(); }
  } else if (kind === 'intcat-remove') {
    const cid = xEl.dataset.id;
    rec.interestedCategoryIds = (rec.interestedCategoryIds || []).filter((x) => x !== cid);
    reindex('customers', rec); toast('Interested category removed.'); render();
  }
}
function highlightCard(card) {
  setTimeout(() => { const c = document.querySelector(`.card[data-card="${card}"]`); if (c) { c.classList.add('highlight'); setTimeout(() => c.classList.remove('highlight'), 1600); } }, 30);
}

/** Inline edit (§6.2 #11): click value → input; Enter/blur commits, Esc cancels. */
function startInlineEdit(span) {
  const kind = span.dataset.edit, recId = span.dataset.rec;
  const input = el('input', 'inline-input');
  let done = false, commit;
  if (kind === 'rentalAddress') {
    const r = IDX.rental.get(recId);
    input.value = r?.deliveryAddress || '';
    input.placeholder = 'City, State';
    commit = () => { if (done) return; done = true; if (r) { const old = r.deliveryAddress; const v = input.value.trim(); if (String(old ?? '') !== v) { r.deliveryAddress = v; reindex('rentals', r); logAction(r, `Delivery address: ${auditVal(old)} → ${auditVal(v)}`); } } render(); };
  } else if (kind === 'unitHours') {
    const u = IDX.unit.get(recId);
    input.value = u?.currentHours ?? '';
    input.type = 'number'; input.placeholder = 'Hours';
    commit = () => { if (done) return; done = true; if (u && input.value !== '') { const old = u.currentHours; const v = Number(input.value); if (old !== v) { u.currentHours = v; reindex('units', u); logAction(u, `Hours: ${auditVal(old)} → ${auditVal(v)}`); } } render(); };
  } else if (kind === 'customerName') {
    const c = IDX.customer.get(recId);
    input.value = c?.name || ''; input.placeholder = 'Customer name';
    commit = () => { if (done) return; done = true; if (c && input.value.trim()) { c.name = input.value.trim(); reindex('customers', c); } render(); };
  } else if (kind === 'invoicePO') {
    const inv = IDX.invoice.get(recId);
    input.value = inv?.po || ''; input.placeholder = 'PO #';
    commit = () => { if (done) return; done = true; if (inv) { const old = inv.po; const v = input.value.trim(); if (String(old ?? '') !== v) { inv.po = v; reindex('invoices', inv); logAction(inv, `PO: ${auditVal(old)} → ${auditVal(v)}`); } } render(); };
  } else if (kind === 'salesAction') {
    const c = IDX.customer.get(recId);
    input.value = c?.salesAction || ''; input.placeholder = 'Next action…';
    commit = () => { if (done) return; done = true; if (c) { const old = c.salesAction; const v = input.value.trim(); if (String(old ?? '') !== v) { c.salesAction = v; reindex('customers', c); logAction(c, `Sales action: ${auditVal(old)} → ${auditVal(v)}`); } } render(); };
  } else if (kind === 'custField') {
    const c = IDX.customer.get(recId), f = span.dataset.field;
    input.value = (c && c[f]) || ''; input.placeholder = span.dataset.ph || '';
    if (f === 'email') input.type = 'email';
    commit = () => { if (done) return; done = true; if (c) { const old = c[f]; const v = input.value.trim(); if (String(old ?? '') !== v) { c[f] = v; if (f === 'firstName' || f === 'lastName') c.name = fullName(c); if (f === 'company' && v && c.accountType === 'Non-Business') { c.accountType = 'Business'; logAction(c, 'Account type → Business (company added)'); } reindex('customers', c); logAction(c, `${humanizeField(f)}: ${auditVal(old)} → ${auditVal(v)}`); } } render(); };
  } else if (kind === 'field') {
    // Generic per-card field editor (text / number / date) — routes through recOf+reindex.
    const card = span.dataset.card, f = span.dataset.field, type = span.dataset.type || 'text';
    const rec = recOf(card, recId);
    input.value = (rec && rec[f] != null) ? rec[f] : '';
    input.placeholder = span.dataset.ph || '';
    if (type === 'number') input.type = 'number';
    else if (type === 'date') input.type = 'date';
    commit = () => { if (done) return; done = true; if (rec) { let v = input.value.trim(); if (type === 'number') v = (v === '' ? null : Number(v)); const old = rec[f]; if (String(old ?? '') !== String(v ?? '')) { rec[f] = v; reindex(card, rec); logAction(rec, `${humanizeField(f)}: ${auditVal(old)} → ${auditVal(v)}`); } } render(); };
  } else { return; }
  span.replaceWith(input); input.focus(); input.select();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { done = true; render(); }
  });
  input.addEventListener('blur', commit);
}

function setRentalStatus(rentalId, val) {
  const r = IDX.rental.get(rentalId);
  if (!r) return;
  const cust = r.customerId ? IDX.customer.get(r.customerId) : null;
  // §9 hard gates
  if (val === 'On Rent' && !r.invoiceId) { toast('Blocked: "On Rent" requires a linked invoice (§9).'); return; }
  if (['On Rent', 'Reserved'].includes(val) && cust && /Blacklist/i.test(cust.accountType || '')) { toast('Blocked: customer is blacklisted (§9).'); return; }
  r.status = val;
  reindex('rentals', r);
  logAction(r, `Status → ${getStatus('rentalStatus', val).label}`);
  // §9 non-blocking warnings on go-live (warning, not block — Phase 1)
  let warn = '';
  if (val === 'On Rent' && cust) {
    if (cust.requiresPO && !IDX.invoice.get(r.invoiceId)?.po) warn = '⚠ PO required for this customer — add it before sending.';
    else if (!cust.stripeId) warn = '⚠ No card on file for this customer.';
  }
  toast(warn || `Status → ${getStatus('rentalStatus', val).label}`);
  render();
}
/* §9 Field Call — a unit breaks mid-rental: flag the rental (red FC), fail the unit,
   and auto-open a Field-Call work order so the M.Tech can dispatch parts/swap. */
function markFieldCall(rentalId) {
  const r = IDX.rental.get(rentalId); if (!r || !r.unitId) { toast('No unit on this rental.'); return; }
  r.fieldCall = true; reindex('rentals', r);
  const u = IDX.unit.get(r.unitId);
  if (u) { u.inspectionStatus = 'Failed'; reindex('units', u); logAction(u, `Field Call on rental ${r.rentalName || rentalId}`); }
  const id = 'WO-FC' + (state.seq++);
  const wo = { woId: id, unitId: r.unitId, customerId: r.customerId || null, woReport: 'Field Call — breakdown', woType: 'Field Call', description: `Field call raised on rental ${r.rentalName || rentalId}.`, phase: 'Part Needed?', billCustomer: 'No', date: TODAY_ISO, eta: '', unitHoursAtCreation: u?.currentHours || 0, assignedMechanic: '', laborHours: 0, lineItems: [], mock: true };
  DATA.workOrders.push(wo); IDX.wo.set(id, wo); reindex('workOrders', wo);
  logAction(r, 'Field Call marked — unit failed, work order opened');
  toast('Field Call logged — unit → Failed, work order opened.');
  reanchorRender();
}
function clearFieldCall(rentalId) {
  const r = IDX.rental.get(rentalId); if (!r) return;
  r.fieldCall = false; reindex('rentals', r); logAction(r, 'Field Call cleared'); toast('Field Call cleared.'); reanchorRender();
}

function onInput(e) {
  if (e.target.id === 'globalsearch') {
    const sel = e.target.selectionStart;
    setQuery(e.target.value);                      // re-renders; the input is recreated
    const gs = document.getElementById('globalsearch');
    if (gs) { gs.focus(); gs.setSelectionRange(sel, sel); }
    return;
  }
  if (e.target.classList.contains('js-history-search')) {
    const card = e.target.closest('.card')?.dataset.card; if (!card) return;
    activeSession().cards[card].historySearch = e.target.value;
    const sel = e.target.selectionStart; render();
    const hs = document.querySelector(`.card[data-card="${card}"] .js-history-search`); if (hs) { hs.focus(); hs.setSelectionRange(sel, sel); }
    return;
  }
  if (e.target.classList.contains('mini-search')) {
    const card = e.target.dataset.card; const mcs = activeSession().cards[card]; mcs.search = e.target.value; mcs.listLimit = undefined;
    // light re-render of just that card would be ideal; full render is fine at seed scale
    const sel = e.target.selectionStart; render();
    const ms = document.querySelector(`.mini-search[data-card="${card}"]`); if (ms) { ms.focus(); ms.setSelectionRange(sel, sel); }
  }
}

/* change events — native <input type="date"> / <select> on draft details. */
function onChange(e) {
  // Customer form selfie: capture (phone camera via capture="user", or upload) → compress → store.
  if (e.target.classList.contains('js-nc-selfie')) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { downscaleImage(reader.result, 340, 0.5, (out) => { if (!out) { toast('Could not read that image.'); return; } ncSyncInputs(); if (state.overlay) { state.overlay.draft.selfie = out; renderOverlay(); } }); };
    reader.readAsDataURL(file);
    return;
  }
  // New Customer form: filling Company auto-promotes Non-Business → Business.
  if (e.target.dataset && e.target.dataset.f === 'company' && state.overlay?.kind === 'newCustomer') {
    const o = state.overlay, root = document.querySelector('.overlay .popup-body');
    if (root) root.querySelectorAll('[data-f]').forEach((i) => { o.draft[i.dataset.f] = i.value.trim(); });
    if (o.draft.company && o.draft.accountType === 'Non-Business') { o.draft.accountType = 'Business'; renderOverlay(); }
    return;
  }
  if (e.target.classList.contains('js-insp-photo')) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const n = IDX.insp.get(e.target.dataset.rec); if (n) { n.photo = reader.result; render(); if (state.overlay?.kind === 'inspection') renderOverlay(); } };
    reader.readAsDataURL(file);
    return;
  }
  if (e.target.classList.contains('js-insp-desc')) { const n = IDX.insp.get(e.target.dataset.rec); if (n) { n.description = e.target.value; render(); } return; }
  if (e.target.classList.contains('js-svc-photo')) { const file = e.target.files && e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { state.svcPhoto = reader.result; renderOverlay(); }; reader.readAsDataURL(file); return; }
  if (e.target.classList.contains('js-wp-time')) { return setWinTime(e.target.value); }
  if (e.target.classList.contains('js-draftdate')) { return setDraftDate(e.target.dataset.rec, e.target.dataset.which, e.target.value); }
  if (e.target.classList.contains('js-transport-sel')) {
    const r = IDX.rental.get(e.target.dataset.rec); if (!r) return;
    r.transportType = e.target.value;
    const session = activeSession(); if (session.anchor) setAnchor(session, session.anchor.card, session.anchor.recId, session.anchor.recType);
    render();
  }
}

/* +New Rental (§0.3 flow, basic): open a draft rental tab + highlight Category→Unit */
/** The +New menu (header) — opens the create-flow for each entity (§0.3). */
function openNewMenu(anchorEl) {
  const items = [
    { id: 'rental', label: 'New Rental', ico: CARD_ICON.rentals },
    { id: 'customer', label: 'New Customer', ico: CARD_ICON.customers },
    { id: 'inspection', label: 'New Inspection', ico: CARD_ICON.inspections },
    { id: 'workOrder', label: 'New Work Order', ico: CARD_ICON.workOrders },
    { id: 'invoice', label: 'New Invoice', ico: CARD_ICON.invoices },
    { id: 'receipt', label: 'New Receipt', ico: CARD_ICON.expenses },
  ];
  openDropdown(anchorEl, items.map((it) => `<button class="dd-item js-newitem" data-new="${it.id}"><span class="mi-ico" style="color:var(--accent);display:inline-flex">${it.ico}</span>${it.label}</button>`).join(''));
}
/** Logo menu — anchored to the logo (like +New): back-office boards + the Team KPI block. */
function openLogoMenu(anchorEl) {
  const boards = BACKOFFICE_BOARDS.map((b) => `<button class="dd-item js-board" data-board="${b.id}"><span class="mi-ico" style="color:var(--accent);display:inline-flex">${CARD_ICON[b.id] || I.box}</span>${esc(b.title)}<span class="c-count" style="margin-left:auto">${boardRows(b.id).length}</span></button>`).join('');
  const teamLines = ROLES.map((role) => {
    const v = kpiFor(role.id).filter((x) => x != null);
    const avg = v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
    const bd = bandColor(avg);
    return `<div class="kpi-line"><span class="ring-no" style="border-color:var(--${role.color})"></span><span class="k-name">${esc(role.label)}</span><span class="k-val" style="color:var(--${bd.color})">${avg}%</span></div>`;
  }).join('');
  const team = `<div class="menu-sep"></div><div class="menu-team"><div class="menu-team-head">Team KPIs</div><div class="menu-team-ring">${ring3SVG(kpiTeam(), 'accent', { size: 104 })}</div><div class="kpi-list">${teamLines}</div></div>`;
  const userLine = `<div class="menu-user"><span class="mu-name">${esc(currentUser || 'Signed in')}</span>${currentRole ? `<span class="mu-role">${esc(currentRole)}</span>` : ''}</div>
    <button class="dd-item js-switch-user"><span class="mi-ico" style="display:inline-flex;color:var(--accent)">${I.back}</span>Switch user</button>
    <button class="dd-item js-open-settings"><span class="mi-ico" style="display:inline-flex;color:var(--accent)">${I.grid}</span>Settings${currentRole === 'Admin' ? '' : ' <span class="muted" style="font-size:10px;margin-left:2px">Admin</span>'}</button>
    <div class="menu-sep"></div>`;
  openDropdown(anchorEl, userLine + boards + team);
}
// Switch user — clear this session's password/role (name stays remembered) → login.
function switchUser() {
  document.querySelectorAll('.dropdown-menu').forEach((n) => n.remove());
  backendPassword = ''; currentRole = ''; booting = true;
  sessionStorage.removeItem('jactec.pw'); sessionStorage.removeItem('jactec.role');
  renderLogin();
}
// Settings (Admin-only): manage the role passwords. Admin is already authed with the
// admin password; a staff role must enter it. Loads the live config, then opens the editor.
async function openSettings() {
  document.querySelectorAll('.dropdown-menu').forEach((n) => n.remove());
  const adminPw = currentRole === 'Admin' ? backendPassword : (window.prompt('Settings is Admin-only.\nEnter the Admin password:') || '');
  if (!adminPw) return;
  try {
    const r = await backendCall('getConfig', { password: adminPw });
    if (!r || !r.ok) { toast(r && r.error === 'unauthorized' ? 'Wrong Admin password.' : 'Could not open Settings.'); return; }
    openOverlay({ kind: 'settings', config: r.config, adminPw });
  } catch (e) { toast('Could not reach the database.'); }
}
async function saveSettings() {
  const o = state.overlay; if (!o || o.kind !== 'settings') return;
  const root = document.querySelector('.overlay .popup-body'); if (!root) return;
  const roles = {}; root.querySelectorAll('.set-input[data-role]').forEach((i) => { roles[i.dataset.role] = i.value.trim(); });
  const admin = root.querySelector('.set-input[data-admin]')?.value.trim() || '';
  if (!admin || Object.values(roles).some((v) => !v)) { o.error = 'Passwords can\'t be empty.'; renderOverlay(); return; }
  try {
    const r = await backendCall('setConfig', { password: o.adminPw, config: { roles, admin } });
    if (r && r.ok) { if (currentRole === 'Admin') { backendPassword = admin; sessionStorage.setItem('jactec.pw', admin); o.adminPw = admin; } closeOverlay(); toast('Logins updated.'); }
    else { o.error = 'Save failed.'; renderOverlay(); }
  } catch (e) { o.error = 'Could not reach the database.'; renderOverlay(); }
}
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// §7.1 — guided customer form (validated). Used for BOTH new intake and editing /
// completing an existing customer (opened from the customer card → "Complete account").
function startNewCustomer() { openCustomerForm(null); }
function openCustomerForm(editId) {
  const c = editId ? IDX.customer.get(editId) : null;
  const f = (k, d) => (c && c[k] != null ? c[k] : (d || ''));
  openOverlay({ kind: 'newCustomer', error: '', editId: editId || null, draft: {
    firstName: f('firstName'), lastName: f('lastName'), company: f('company'), phone: f('phone'),
    email: f('email'), industry: f('industry'), accountType: f('accountType', 'Non-Business'),
    accountNotes: f('accountNotes'), selfie: f('selfie'), signature: f('signature'),
    agreementType: f('agreementType'), agreementSignedAt: f('agreementSignedAt'),
  } });
}
// Downscale + JPEG-compress an image data URL so it fits inside one Sheet cell
// (Google caps cells at ~50k chars). cb receives the compressed data URL.
function downscaleImage(dataUrl, maxDim, quality, cb) {
  const img = new Image();
  img.onload = () => {
    let w = img.width, h = img.height; const s = Math.min(1, maxDim / Math.max(w, h));
    w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    cb(cv.toDataURL('image/jpeg', quality));
  };
  img.onerror = () => cb('');
  img.src = dataUrl;
}
const NC_INDUSTRIES = ['Construction', 'Concrete', 'Welding', 'Electrical', 'Plumbing', 'Roofing', 'Painting', 'Landscaping', 'Trucking', 'Industrial', 'Oil & Gas', 'Real Estate', 'Entertainment', 'Agriculture'];
const NC_ACCOUNT_TYPES = ['Non-Business', 'Business', 'Non-Business Member', 'Business Member'];
/** Next sequential customer id (C0001 format), one past the current max. */
function nextCustomerId() {
  const max = DATA.customers.reduce((m, c) => { const n = /^C(\d+)$/.exec(c.customerId || ''); return n ? Math.max(m, +n[1]) : m; }, 0);
  return 'C' + String(max + 1).padStart(4, '0');
}
function saveNewCustomer() {
  const o = state.overlay; if (!o || o.kind !== 'newCustomer') return;
  const root = document.querySelector('.overlay .popup-body'); if (!root) return;
  root.querySelectorAll('[data-f]').forEach((i) => { o.draft[i.dataset.f] = i.value.trim(); });
  if (!o.draft.firstName) { o.error = 'First name is required (we use it for marketing).'; renderOverlay(); document.querySelector('.overlay [data-f="firstName"]')?.focus(); return; }
  if (!o.draft.phone) { o.error = 'A phone number is required.'; renderOverlay(); document.querySelector('.overlay [data-f="phone"]')?.focus(); return; }
  if (o.draft.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.draft.email)) { o.error = 'That email doesn’t look valid (or leave it blank).'; renderOverlay(); return; }
  const d = o.draft;
  if (o.editId) {                                   // ── editing / completing an existing customer ──
    const c = IDX.customer.get(o.editId); if (!c) { closeOverlay(); return; }
    const wasSigned = !!c.agreementSignedAt;
    Object.assign(c, { firstName: d.firstName, lastName: d.lastName, company: d.company, phone: d.phone, email: d.email, industry: d.industry, accountType: d.accountType || 'Non-Business', accountNotes: d.accountNotes, selfie: d.selfie, signature: d.signature, agreementType: d.agreementType || '', agreementSignedAt: d.agreementSignedAt || '' });
    c.name = `${d.firstName} ${d.lastName}`.trim() || c.name;
    reindex('customers', c);
    if (c.agreementSignedAt && !wasSigned) logAction(c, `${AGREEMENTS[c.agreementType]?.title || 'Agreement'} signed`);
    logAction(c, 'Account details updated');
    closeOverlay(); anchorRecord('customers', c.customerId); toast(`${c.name} updated.`);
    return;
  }
  const id = nextCustomerId();                       // ── new customer ──
  const c = {
    customerId: id, firstName: d.firstName, lastName: d.lastName, name: `${d.firstName} ${d.lastName}`.trim(),
    company: d.company, phone: d.phone, email: d.email, address: '',
    industry: d.industry, accountType: d.accountType || 'Non-Business', payStatus: 'New Customer',
    requiresPO: false, accountNotes: d.accountNotes, stripeId: '', selfie: d.selfie || '', signature: d.signature || '',
    agreementType: d.agreementType || '', agreementSignedAt: d.agreementSignedAt || '',
    interestedCategoryIds: [], activityLog: [], usedSalesStage: 'Inbound Lead', membershipStage: 'Inbound Lead',
    _digest: { activePct: 0, totalPaid: 0, visits: 0, years: 0, avgFrequencyDays: 0, firstInvoice: '', lastInvoice: '' },
  };
  DATA.customers.push(c); IDX.customer.set(id, c); reindex('customers', c);
  logAction(c, 'Customer onboarded');
  closeOverlay();
  anchorRecord('customers', id);
  toast(`${c.name} added.`);
}
/* ════════════════════════════════════════════════════════════════════════
 * STRIPE CLIENT (Phase 2) — card-on-file + invoice charging.
 * Card data is entered ONLY in Stripe's iframe (Card Element) and tokenized in
 * the browser; raw PAN/CVC never touches our code or the backend. The backend
 * owns the money math — the client never sends an amount.
 * ════════════════════════════════════════════════════════════════════════ */
let _stripe = null, _cardElements = null, _cardElement = null;
function getStripe() {
  if (_stripe) return _stripe;
  if (typeof Stripe === 'undefined' || !CFG.STRIPE_PUBLISHABLE_KEY) { toast('Payment library not ready yet — try again in a moment.'); return null; }
  try { _stripe = Stripe(CFG.STRIPE_PUBLISHABLE_KEY); } catch (e) { toast('Could not start the payment library.'); return null; }
  return _stripe;
}
// Only Office/Admin take payments. In #local demo (no role) we still show the UI.
const canMoney = () => !currentRole || currentRole === 'Admin' || currentRole === 'Office';
const brandName = (b) => (b || 'Card').replace(/^./, (m) => m.toUpperCase());
const hasCardOnFile = (c) => !!(c && c.stripeId && c.cardLast4);
const cardLabel = (c) => hasCardOnFile(c) ? `${brandName(c.cardBrand)} ending ${c.cardLast4}${c.cardExpMonth ? ` · exp ${c.cardExpMonth}/${String(c.cardExpYear).slice(-2)}` : ''}` : '';
function friendlyPayErr(r) {
  const code = (r && r.error) || 'charge-failed';
  return ({
    'no-card-on-file': 'No card on file — add one first.', 'no-stripe-customer': 'No card on file — add one first.',
    'consent-required': 'Capture a selfie + signature first (card authorization).',
    'card_declined': 'The card was declined.', 'expired_card': 'That card is expired.', 'insufficient_funds': 'Insufficient funds.',
    'over-ceiling': 'Amount exceeds the per-charge limit — split it or charge manually.', 'bad-invoice-amount': 'Nothing is due on this invoice.',
    'forbidden': 'Only Office/Admin can take payments.', 'stripe-not-configured': 'Payments aren’t configured on the backend yet.',
    'pm-customer-mismatch': 'That card isn’t linked to this customer.', 'setupintent-invalid': 'Card setup didn’t verify — try again.',
    'amount-mismatch': 'Amount changed during payment — flagged for review.', 'customer-mismatch': 'Payment didn’t match this customer.',
    'server-error': 'Server error — try again.',
  })[code] || 'Payment failed — try again or use another card.';
}

function openAddCard(customerId, opts) { openOverlay({ kind: 'addCard', customerId, returnTo: (opts && opts.returnTo) || '', invoiceId: (opts && opts.invoiceId) || '' }); }
function openPayInvoice(invoiceId) { openOverlay({ kind: 'payment', invoiceId, busy: false, error: '' }); }

// Mount the Stripe Card Element into the open addCard overlay (called post-append,
// like setupSignaturePad). Recreated per open; destroyed on close.
function mountCardElement() {
  const stripe = getStripe(); if (!stripe) return;
  const host = document.getElementById('sl-card-element'); if (!host) return;
  destroyCardElement();
  _cardElements = stripe.elements();
  _cardElement = _cardElements.create('card', { hidePostalCode: false, style: { base: { color: '#e8ebf2', fontFamily: 'Geist, system-ui, sans-serif', fontSize: '15px', '::placeholder': { color: '#8a93a6' } }, invalid: { color: '#ff6b6b' } } });
  _cardElement.mount('#sl-card-element');
  _cardElement.on('change', (e) => { const b = document.getElementById('sl-card-error'); if (b) b.textContent = e.error ? e.error.message : ''; });
}
function destroyCardElement() { if (_cardElement) { try { _cardElement.destroy(); } catch (e) {} } _cardElement = null; _cardElements = null; }

// Save card: SetupIntent (server) → confirmCardSetup (browser) → persist (server).
// DOM-driven (no renderOverlay) so the Card Element isn't wiped mid-entry.
async function saveCardFlow(btn) {
  const o = state.overlay; if (!o || o.kind !== 'addCard') return;
  const c = IDX.customer.get(o.customerId); if (!c) return;
  const stripe = getStripe(); if (!stripe || !_cardElement) return;
  const errBox = document.getElementById('sl-card-error');
  const setErr = (m) => { if (errBox) errBox.textContent = m || ''; };
  const reset = () => { btn.disabled = false; btn.textContent = 'Save card'; };
  if (!c.signature || !c.selfie) { setErr('Capture a selfie + signature first (card authorization).'); return; }
  const live = () => state.overlay === o;   // bail if the overlay changed/closed mid-await
  btn.disabled = true; btn.textContent = 'Saving…'; setErr('');
  try {
    const r = await backendCall('stripeSetupIntent', { customerId: c.customerId });
    if (!live()) return;
    if (!r || !r.ok) { setErr(friendlyPayErr(r)); reset(); return; }
    const { setupIntent, error } = await stripe.confirmCardSetup(r.clientSecret, { payment_method: { card: _cardElement, billing_details: { name: c.name || undefined, email: c.email || undefined, phone: c.phone || undefined } } });
    if (!live()) return;
    if (error) { setErr(error.message); reset(); return; }
    if (!setupIntent || setupIntent.status !== 'succeeded') { setErr('Card could not be saved — try again.'); reset(); return; }
    const s = await backendCall('stripeSaveCard', { customerId: c.customerId, paymentMethodId: setupIntent.payment_method, setupIntentId: setupIntent.id });
    if (!live()) return;
    if (!s || !s.ok) { setErr(friendlyPayErr(s)); reset(); return; }
    c.stripeId = r.stripeId || c.stripeId;
    c.cardBrand = s.card.brand; c.cardLast4 = s.card.last4; c.cardExpMonth = s.card.expMonth; c.cardExpYear = s.card.expYear;
    reindex('customers', c); logAction(c, `Card on file added — ${brandName(s.card.brand)} ••••${s.card.last4}`);
    destroyCardElement();
    toast('Card saved ✓');
    if (o.returnTo === 'payment' && o.invoiceId) openPayInvoice(o.invoiceId);
    else closeOverlay();
    render();
  } catch (e) { setErr('Network error — try again.'); reset(); }
}

// Charge an invoice off_session; on 3DS fall back to an on-session confirm, then
// re-verify server-side before marking paid. The payment overlay has no Card
// Element, so re-rendering it for busy/error states is safe.
async function chargeInvoiceFlow(invoiceId) {
  const o = state.overlay; if (!o || o.kind !== 'payment') return;
  const live = () => state.overlay === o;   // bail if the overlay changed/closed mid-await
  o.busy = true; o.error = ''; renderOverlay();
  const fail = (msg) => { if (!live()) return; o.busy = false; o.error = msg; renderOverlay(); };
  try {
    const r = await backendCall('stripeChargeInvoice', { invoiceId });
    if (!live()) return;
    if (r && r.ok && (r.status === 'succeeded' || r.alreadyPaid)) { applyInvoicePaid(invoiceId, r); toast('Payment captured ✓'); closeOverlay(); return; }
    if (r && r.requiresAction && r.clientSecret) {
      const stripe = getStripe(); if (!stripe) { fail('Payment library not ready.'); return; }
      const { paymentIntent, error } = await stripe.confirmCardPayment(r.clientSecret);
      if (!live()) return;
      if (error) { fail(error.message || 'Authentication failed.'); return; }
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        const f = await backendCall('stripeFinalizeInvoice', { invoiceId, paymentIntentId: r.paymentIntentId });
        if (!live()) return;
        if (f && f.ok) { applyInvoicePaid(invoiceId, f); toast('Payment captured ✓'); closeOverlay(); return; }
        fail(friendlyPayErr(f)); return;
      }
      fail('Card authentication was not completed.'); return;
    }
    fail(friendlyPayErr(r));
  } catch (e) { fail('Network error — try again.'); }
}
function applyInvoicePaid(invoiceId, r) {
  const inv = IDX.invoice.get(invoiceId); if (!inv) return;
  inv.paid = true; inv.status = 'Paid'; inv.paidAt = r.paidAt || TODAY_ISO;
  if (r.paymentIntentId) inv.paymentIntentId = r.paymentIntentId;
  if (r.chargedAmount != null) inv.chargedAmount = r.chargedAmount;
  if (r.amountPaid != null) inv.amountPaid = r.amountPaid;
  if (r.paymentMethod) inv.paymentMethod = r.paymentMethod;
  reindex('invoices', inv); logAction(inv, `Payment captured — ${r.paymentMethod || 'card on file'}`);
  render();
}

function startNewReceipt() {
  const id = 'E-NEW' + (state.seq++);
  const draft = { expenseId: id, vendorId: null, date: TODAY_ISO, amount: 0, reconcile: 'Unreconciled', method: 'Cash', category: 'Parts', woId: null, notes: 'New receipt', mock: true };
  DATA.expenses.push(draft);
  openOverlay({ kind: 'board', board: 'expenses' });   // receipts live in the back-office board
  toast('New receipt added to Expenses & Receipts.');
}

function startNewInspection() {
  const id = 'INS-NEW' + (state.seq++);
  const draft = { inspectionId: id, unitId: null, date: TODAY_ISO, wash: '', checklist: '', billCustomer: 'No', customerId: null, woId: null, photo: '', description: '', mock: true };
  DATA.inspections.push(draft); IDX.insp.set(id, draft); reindex('inspections', draft);
  logAction(draft, 'Inspection created');
  anchorRecord('shop', id, 'inspections');
  toast('New inspection — pick the unit, then run Wash → Checklist.');
  beginPick('shop', id, 'inspections', 'unit');
}
function startNewWorkOrder() {
  const id = 'WO-NEW' + (state.seq++);
  const draft = { woId: id, unitId: null, customerId: null, woReport: 'New Work Order', woType: 'Manual', description: '', phase: 'Part Needed?', billCustomer: 'No', date: TODAY_ISO, eta: '', unitHoursAtCreation: 0, assignedMechanic: '', laborHours: 0, lineItems: [], mock: true };
  DATA.workOrders.push(draft); IDX.wo.set(id, draft); reindex('workOrders', draft);
  logAction(draft, 'Work order created');
  anchorRecord('shop', id, 'workOrders');
  toast('New work order — pick the unit, then add parts / labor.');
  beginPick('shop', id, 'workOrders', 'unit');
}
function startNewInvoice(customerId) {
  const cust = customerId ? IDX.customer.get(customerId) : null;
  const id = nextInvoiceId();
  const draft = { invoiceId: id, customerId: customerId || null, rentalIds: [], date: TODAY_ISO, dueDate: addDays(TODAY_ISO, 14), po: '', amountPaid: 0, lineItems: [], mock: true };
  DATA.invoices.push(draft); IDX.invoice.set(id, draft); reindex('invoices', draft);
  anchorRecord('invoices', id);
  toast(cust ? `New invoice for ${cust.name} — add rentals / WOs.` : 'New invoice — pick a customer, then add rentals / WOs.');
  if (!customerId) beginPick('invoices', id, undefined, 'customer');
}

function startNewRental(customerId) {
  const id = 'R-NEW' + (state.seq++);
  const cust = customerId ? IDX.customer.get(customerId) : null;
  const draft = { rentalId: id, customerId: customerId || null, unitId: null, categoryId: null, rentalName: cust ? `New Rental — ${cust.name}` : 'New Rental', startDate: '', endDate: '', startTime: '', status: 'Quote', transportType: 'Self', deliveryAddress: '', po: '', invoiceId: null, startHours: null, returnHours: null, notes: '', mock: true };
  DATA.rentals.push(draft); IDX.rental.set(id, draft); reindex('rentals', draft);
  logAction(draft, cust ? `Rental created for ${cust.name}` : 'Rental created');
  anchorRecord('rentals', id);
  toast('New rental — pick the window, then a Unit (§0.3).');
  beginPick('rentals', id, undefined, 'unit');   // opens the window picker first (customer auto-advances after)
}

/* ── §0.3 cascading pickers (pick mode) ──────────────────────────────────────
   A draft (or a swap) puts the app in "pick mode": the source card lists every
   record and a banner prompts the choice. Clicking a row in that card assigns
   it to the draft slot and auto-advances to the next empty required slot. */
const PICK_SRC = { customer: 'customers', unit: 'units', rental: 'rentals', wo: 'workOrders', intcat: 'categories' };
const PICK_LABEL = { customer: 'a customer', unit: 'a unit', rental: 'a rental', wo: 'a work order', intcat: 'an interested category' };
function draftName(card, rec) {
  const entity = entityCardOf(card, state.pick?.recType);
  if (entity === 'rentals') return rec.rentalName || 'this rental';
  if (entity === 'inspections') return 'this inspection';
  if (entity === 'workOrders') return rec.woReport || 'this work order';
  if (entity === 'invoices') return rec.invoiceId || 'this invoice';
  return 'this record';
}
function nextPickFor(card, rec, recType) {
  const entity = entityCardOf(card, recType);
  if (entity === 'rentals') { if (!rec.customerId) return 'customer'; if (!rec.unitId) return 'unit'; return null; }
  if (entity === 'inspections' || entity === 'workOrders') { if (!rec.unitId) return 'unit'; return null; }
  if (entity === 'invoices') { if (!rec.customerId) return 'customer'; return null; }
  return null;
}
function beginPick(card, recId, recType, slot) {
  if (!slot) { state.pick = null; render(); return; }
  state.pick = { card, recId, recType, slot };
  // §0.3 — auto-open the rental window picker when picking a unit for a window-less
  // draft, so the user sets the window first and Categories/Units light up live.
  if (slot === 'unit' && entityCardOf(card, recType) === 'rentals') {
    const r = recOf('rentals', recId);
    if (r && (!r.startDate || !r.endDate)) {
      if (!r.startTime) r.startTime = nowHourLabel();
      state.winpicker = { rentalId: recId, monthISO: firstOfMonthISO(r.startDate || TODAY_ISO), anchor: null };
    }
  }
  render();
  // WOs live inside the Shop card, so highlight that for the 'wo' pick
  highlightCard(slot === 'wo' ? 'shop' : PICK_SRC[slot]);
}
function cancelPick(silent) {
  if (!state.pick) return;
  state.pick = null;
  if (!silent) toast('Picker closed — finish later from the card.');
  render();
}
function reindexDraft(card, rec) {
  // a freshly-named "New Rental" draft adopts "{unit} — {customer}" once both are set,
  // then the comprehensive searchBlob picks up every field.
  if (rec.rentalId) { const cust = IDX.customer.get(rec.customerId), u = IDX.unit.get(rec.unitId);
    if (cust && /^New Rental/.test(rec.rentalName || '')) rec.rentalName = `${u?.name || 'Rental'} — ${cust.name}`;
    return reindex('rentals', rec); }
  if (rec.invoiceId) return reindex('invoices', rec);
  if (rec.inspectionId) return reindex('inspections', rec);
  if (rec.woId) return reindex('workOrders', rec);
  if (rec.customerId) return reindex('customers', rec);
  if (rec.unitId) return reindex('units', rec);
  if (rec.categoryId) return reindex('categories', rec);
}
function assignPick(srcId) {
  const p = state.pick; if (!p) return;
  // invoice line-item pickers (add a rental or a work order to the invoice)
  if (p.slot === 'rental') { state.pick = null; addRentalLineToInvoice(p.recId, srcId); return; }
  if (p.slot === 'wo') { state.pick = null; addWOToInvoice(p.recId, srcId); return; }
  // §12.1 interested-category attach — push the picked category onto the customer
  if (p.slot === 'intcat') {
    const c = IDX.customer.get(p.recId); state.pick = null;
    if (c) { c.interestedCategoryIds = c.interestedCategoryIds || []; if (!c.interestedCategoryIds.includes(srcId)) { c.interestedCategoryIds.push(srcId); reindex('customers', c); logAction(c, `Interested in ${IDX.category.get(srcId)?.name || 'category'}`); } }
    reanchorRender(); return;
  }
  const entity = entityCardOf(p.card, p.recType);
  const rec = recOf(entity, p.recId); if (!rec) { state.pick = null; render(); return; }
  if (p.slot === 'customer') { rec.customerId = srcId; logAction(rec, `Customer → ${IDX.customer.get(srcId)?.name || ''}`); toast(`Customer → ${IDX.customer.get(srcId)?.name || ''}`); }
  else if (p.slot === 'unit') {
    const u = IDX.unit.get(srcId);
    // §9 — a non-Active unit (For Sale / Sold / Inactive…) can't be rented
    if (entity === 'rentals' && u && u.fleetStatus !== 'Active') { toast(`Blocked: ${u.name} is ${u.fleetStatus} — not rentable (§9).`); return; }
    rec.unitId = srcId;
    if (entity === 'rentals' && u) rec.categoryId = u.categoryId;
    if (entity === 'workOrders' && u) rec.unitHoursAtCreation = u.currentHours;
    logAction(rec, `Unit → ${u?.name || ''}`);
    toast(`Unit → ${u?.name || ''}`);
  }
  reindexDraft(p.card, rec);
  state.pick = null;
  // a "Bill to invoice" that needed a customer first → now auto-bill the WO
  if (p.slot === 'customer' && state.pendingBillWO === p.recId) { state.pendingBillWO = null; return billWOToInvoice(p.recId); }
  const session = activeSession();
  if (session.anchor && session.anchor.card === p.card && session.anchor.recId === p.recId) setAnchor(session, p.card, p.recId, p.recType);
  const nxt = nextPickFor(p.card, rec, p.recType);
  if (nxt) { beginPick(p.card, p.recId, p.recType, nxt); return; }
  render();
}

/* The pick banner — a floating strip over the grid while in pick mode. */
function pickBarEl() {
  const p = state.pick; if (!p) return null;
  if (state.winpicker) return null;   // while the window calendar is open, just show the calendar
  const entity = entityCardOf(p.card, p.recType);
  const rec = recOf(entity, p.recId);
  const bar = el('div', 'pickbar');
  bar.innerHTML = `<span class="pb-dot"></span><span class="pb-text">Pick ${PICK_LABEL[p.slot]} for <b>${esc(draftName(p.card, rec || {}))}</b> — click a row in the highlighted card.</span>
    <button class="pb-cancel js-cancelpick">Cancel</button>`;
  return bar;
}

/* ── draft mutations driven from the detail view ── */
function createInvoiceForRental(rentalId) {
  const r = IDX.rental.get(rentalId); if (!r) return;
  if (!r.customerId) { toast('Pick a customer first.'); return beginPick('rentals', rentalId, undefined, 'customer'); }
  if (!r.startDate || !r.endDate) { toast('Set the rental window first.'); return; }
  const id = nextInvoiceId();
  const inv = { invoiceId: id, customerId: r.customerId, rentalIds: [rentalId], date: TODAY_ISO, dueDate: addDays(TODAY_ISO, 14), po: '', amountPaid: 0, lineItems: [], mock: true };
  const price = rentalPrice(r);
  if (price) inv.lineItems.push({ kind: 'rental', ref: rentalId, label: `${IDX.unit.get(r.unitId)?.name || 'Rental'} · ${price.rate}`, amount: price.price });
  const tr = rentalTransport(r);
  if (tr && tr.price) inv.lineItems.push({ kind: 'transport', ref: rentalId, label: `Transport · ${r.transportType}`, amount: tr.price });
  DATA.invoices.push(inv); IDX.invoice.set(id, inv); reindex('invoices', inv);
  r.invoiceId = id;
  logAction(inv, `Created for ${IDX.unit.get(r.unitId)?.name || 'rental'}`);
  logAction(r, `Invoice ${invoiceShort(id)} created`);
  toast(`Invoice ${invoiceShort(id)} created and linked.`);
  const session = activeSession(); if (session.anchor) setAnchor(session, session.anchor.card, session.anchor.recId, session.anchor.recType);
  render();
}
function setDraftDate(rentalId, which, val) {
  const r = IDX.rental.get(rentalId); if (!r) return;
  if (which === 'start') r.startDate = val; else r.endDate = val;
  // a dated quote becomes Reserved (urgency display derives Today/Tomorrow); keep On Rent gated on invoice
  if (r.startDate && r.endDate && r.status === 'Quote') r.status = 'Reserved';
  reanchorRender();
}
const reanchorRender = () => { const s = activeSession(); if (s.anchor) setAnchor(s, s.anchor.card, s.anchor.recId, s.anchor.recType); render(); };
/** Append a timestamped action to a record's log (surfaced in its History section). */
let actionSeq = 0;
// Audit trail: who's signed in on this device (remembered across sessions). Every
// logAction stamps the user + clock time so the record History reads "what · when · who".
let currentUser = (() => { try { return localStorage.getItem('jactec.user') || ''; } catch { return ''; } })();
let currentRole = (() => { try { return sessionStorage.getItem('jactec.role') || ''; } catch { return ''; } })();
function nowClock() { const d = new Date(); let h = d.getHours(); const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`; }
function logAction(rec, text) { if (!rec) return; rec.actions = rec.actions || []; rec.actions.push({ when: TODAY_ISO, clock: nowClock(), text, by: currentUser || '', seq: actionSeq++ }); saveSoon(); }
// Humanize a field key + format a value for an audit line ("Phone: (337)… → (337)…").
const humanizeField = (f) => ({ po: 'PO', eta: 'ETA', accountNotes: 'Notes', assignedMechanic: 'Mechanic', gpsType: 'GPS type', gpsPlacement: 'GPS placement', purchasePrice: 'Purchase price', purchaseDate: 'Purchase date', trueCost: 'True cost', purchaseHours: 'Hours at purchase', currentHours: 'Hours', startHours: 'Start hours', returnHours: 'Return hours', rentalName: 'Name', woReport: 'Report', firstName: 'First name', lastName: 'Last name' }[f] || (f.charAt(0).toUpperCase() + f.slice(1).replace(/([A-Z])/g, ' $1')));
const auditVal = (v) => { const s = String(v ?? '').trim(); return s ? (s.length > 28 ? s.slice(0, 28) + '…' : s) : '(empty)'; };

/* §12.6 — WO phase changes (header pill + per-line journey pills) via a woPhase
   dropdown; reaching Complete reverts a Failed unit to Not Ready (§9). */
function woCompleteCascade(w) {
  // a completed Failed-inspection OR Field-Call WO re-opens the unit for inspection
  if ((w.woType === 'Failed' || w.woType === 'Field Call') && w.unitId) {
    const u = IDX.unit.get(w.unitId);
    if (u && u.inspectionStatus === 'Failed') { u.inspectionStatus = 'Not Ready'; reindex('units', u); logAction(u, `Re-inspect needed — repairs complete (${w.woReport})`); return ' — unit → Not Ready (re-inspect)'; }
  }
  return '';
}
function setWoPhase(woId, val) {
  const w = IDX.wo.get(woId); if (!w) return;
  w.phase = val;
  let note = '';
  if (val === 'Complete') { (w.lineItems || []).forEach((li) => { li.phase = 'Complete'; }); note = woCompleteCascade(w); }
  reindex('workOrders', w);
  logAction(w, `Status → ${getStatus('woPhase', val).label}`);
  toast(`Status → ${getStatus('woPhase', val).label}${note}`);
  reanchorRender();
}
function setWoLinePhase(woId, idx, val) {
  const w = IDX.wo.get(woId); if (!w || !w.lineItems || !w.lineItems[idx]) return;
  w.lineItems[idx].phase = val;
  const open = w.lineItems.filter((li) => li.phase !== 'Complete');
  const newPhase = open.length ? open[open.length - 1].phase : 'Complete';
  let note = '';
  if (newPhase === 'Complete' && w.phase !== 'Complete') note = woCompleteCascade(w);
  w.phase = newPhase;
  reindex('workOrders', w);
  logAction(w, `${w.lineItems[idx].part} → ${getStatus('woPhase', val).label}`);
  toast(`Line → ${getStatus('woPhase', val).label}${note}`);
  reanchorRender();
}
function openWoPhaseDropdown(woId, anchorEl, lineIdx) {
  const html = Object.keys(STATUS.woPhase).map((v) =>
    `<button class="dd-item ${lineIdx == null ? 'js-setwophase' : 'js-setwolinephase'}" data-rec="${esc(woId)}"${lineIdx == null ? '' : ` data-idx="${lineIdx}"`} data-val="${esc(v)}">${statusPill('woPhase', v)}</button>`).join('');
  openDropdown(anchorEl, html);
}

/* ── §12.2 rental-window range picker — a single popup: a time selector above a
   calendar that selects a start→end window in two clicks. Writes date-only ISO
   to startDate/endDate (price/availability contract) + a 12-hr startTime. ── */
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const firstOfMonthISO = (iso) => { const d = parseISO(iso) || parseISO(TODAY_ISO); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function nowHourLabel() { const d = new Date(); let h = d.getHours(); const ap = h < 12 ? 'AM' : 'PM'; let h12 = h % 12; if (h12 === 0) h12 = 12; return `${h12}:00 ${ap}`; }
function to24(label) { if (!label) return ''; const m = String(label).match(/(\d+):(\d+)\s*(AM|PM)/i); if (!m) return ''; let h = Number(m[1]) % 12; if (/PM/i.test(m[3])) h += 12; return `${String(h).padStart(2, '0')}:${m[2]}`; }
function to12(hhmm) { if (!hhmm) return ''; const [H, M] = hhmm.split(':').map(Number); const ap = H < 12 ? 'AM' : 'PM'; let h12 = H % 12; if (h12 === 0) h12 = 12; return `${h12}:${String(M || 0).padStart(2, '0')} ${ap}`; }

function openWinPicker(rentalId) {
  const r = IDX.rental.get(rentalId); if (!r) return;
  if (!r.startTime) r.startTime = nowHourLabel();   // default to the current hour (user spec)
  state.winpicker = { rentalId, monthISO: firstOfMonthISO(r.startDate || TODAY_ISO), anchor: null };
  render();
}
function closeWinPicker() { state.winpicker = null; render(); }
function winPickMonth(delta) {
  const wp = state.winpicker; if (!wp) return;
  const d = parseISO(wp.monthISO); d.setMonth(d.getMonth() + delta);
  wp.monthISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; render();
}
function winPickDay(iso) {
  const wp = state.winpicker; if (!wp) return;
  const r = IDX.rental.get(wp.rentalId); if (!r) return;
  if (!wp.anchor || (r.startDate && r.endDate)) {        // begin a fresh range
    wp.anchor = iso; r.startDate = iso; r.endDate = '';
  } else {                                               // close the range
    const a = wp.anchor;
    if (parseISO(iso) - parseISO(a) >= 0) { r.startDate = a; r.endDate = iso; }
    else { r.startDate = iso; r.endDate = a; }
    wp.anchor = null;
    if (r.startDate && r.endDate && r.status === 'Quote') r.status = 'Reserved';
  }
  reanchorRender();
}
function setWinTime(hhmm) { const wp = state.winpicker; if (!wp) return; const r = IDX.rental.get(wp.rentalId); if (!r) return; r.startTime = to12(hhmm); reanchorRender(); }
function winPickClear() { const wp = state.winpicker; if (!wp) return; const r = IDX.rental.get(wp.rentalId); if (r) { r.startDate = ''; r.endDate = ''; wp.anchor = null; } reanchorRender(); }
function winPickToday() { const wp = state.winpicker; if (!wp) return; wp.monthISO = firstOfMonthISO(TODAY_ISO); const r = IDX.rental.get(wp.rentalId); if (r) { r.startDate = TODAY_ISO; r.endDate = ''; wp.anchor = TODAY_ISO; } reanchorRender(); }

/** Render the inline calendar popup for the rental whose picker is open. */
function winPickerEl(r) {
  const wp = state.winpicker;
  const md = parseISO(wp.monthISO); const y = md.getFullYear(), m = md.getMonth();
  const startDow = new Date(y, m, 1).getDay();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const s = r.startDate, e = r.endDate, a = wp.anchor;
  const lo = s && e ? (s < e ? s : e) : (s || a);
  const hi = s && e ? (s < e ? e : s) : null;
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += `<button class="wp-day empty" tabindex="-1"></button>`;
  for (let day = 1; day <= daysIn; day++) {
    const iso = isoOf(new Date(y, m, day));
    let cls = 'wp-day js-wp-day';
    if (iso === lo) cls += ' range-start';
    if (hi && iso === hi) cls += ' range-end';
    if (hi && iso > lo && iso < hi) cls += ' in-range';
    if (a && iso === a && !hi) cls += ' range-start range-end';
    if (iso === TODAY_ISO) cls += ' today';
    cells += `<button class="${cls}" data-iso="${iso}">${day}</button>`;
  }
  const dows = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => `<span class="wp-dow">${d}</span>`).join('');
  return `<div class="winpicker">
    <div class="wp-time"><label>Pickup time</label><input type="time" class="js-wp-time" value="${esc(to24(r.startTime) || '09:00')}"></div>
    <div class="wp-head"><span class="wp-month">${MONTH_NAMES[m]} ${y}</span>
      <span class="wp-nav"><button class="js-wp-prev" title="Previous month">‹</button><button class="js-wp-next" title="Next month">›</button></span></div>
    <div class="wp-grid">${dows}${cells}</div>
    <div class="wp-foot"><button class="js-wp-clear">Clear</button><button class="js-wp-today">Today</button><button class="js-wp-done">Done</button></div>
  </div>`;
}
/** Float the picker beside its trigger, clamped on-screen (opens upward if needed). */
function positionWinPicker(fl) {
  const trigger = document.querySelector(`.js-open-winpicker[data-rec="${state.winpicker.rentalId}"]`);
  if (!trigger) { fl.style.display = 'none'; return; }       // detail not visible → hide
  const tr = trigger.getBoundingClientRect();
  const pw = fl.offsetWidth || 300, ph = fl.offsetHeight || 360;
  let left = Math.min(tr.left, window.innerWidth - pw - 10);
  left = Math.max(10, left);
  let top = tr.bottom + 6;
  if (top + ph > window.innerHeight - 10) top = Math.max(10, tr.top - ph - 6);
  fl.style.left = Math.round(left) + 'px';
  fl.style.top = Math.round(top) + 'px';
}

/* ── inspection gated flow (§9): Wash → Checklist → Ready/Failed (+auto-WO) ── */
function setInspWash(id, val) {
  const n = IDX.insp.get(id); if (!n) return;
  n.wash = val;
  logAction(n, `Wash → ${val}`);
  toast(val === 'Yes' ? 'Washed — proceed to the checklist.' : 'No wash — proceed to the checklist.');
  render(); if (state.overlay?.kind === 'inspection') renderOverlay();
}
function setInspResult(id, val) {
  const n = IDX.insp.get(id); if (!n) return;
  n.checklist = val;
  const u = IDX.unit.get(n.unitId);
  if (u) { u.inspectionStatus = val === 'Pass' ? 'Ready' : 'Failed'; reindex('units', u); logAction(u, `Inspection ${val === 'Pass' ? 'passed → Ready' : 'failed → Failed'}`); }
  logAction(n, `Checklist → ${val}`);
  reindexDraft('inspections', n);
  if (val === 'Fail') {
    const wo = autoWOFromInspection(n);
    logAction(wo, 'Created from failed inspection');
    toast(`Failed — WO ${wo.woId} created. Add a photo + notes.`);
    state.overlay = { kind: 'inspection', recId: id };   // Fail → open the photo/video + notes popup
  } else { toast('Passed — unit marked Ready.'); }
  const session = activeSession(); if (session.anchor) setAnchor(session, session.anchor.card, session.anchor.recId, session.anchor.recType);
  render(); renderOverlay();
}
/* §7.7/§12.7 — record a service completion: reset the countdown, log to History. */
function recordServiceCompletion(unitId, taskId, hours, date, note, photo) {
  const u = IDX.unit.get(unitId); if (!u) return;
  const when = date || TODAY_ISO;
  u.serviceCompletions = completeService(u.serviceCompletions || {}, taskId, hours);
  u.serviceLog = u.serviceLog || [];
  u.serviceLog.push({ taskId, hours: Number(hours) || 0, date: when, note: note || '', photo: photo || '' });
  const tn = SERVICE_TASKS.find((x) => x.taskId === taskId);
  logAction(u, `Serviced: ${tn?.name || taskId} @ ${num(hours)} HRS (${fmtShortDate(when)})`);
  toast('Service completed — countdown reset.');
  state.overlay = null;
  const session = activeSession(); if (session.anchor) setAnchor(session, session.anchor.card, session.anchor.recId, session.anchor.recType);
  render(); renderOverlay();
}
/* §12.8 — set bill-to-customer from the Fail popup; sync the auto-created WO. */
function setInspBill(id, val) {
  const n = IDX.insp.get(id); if (!n) return;
  n.billCustomer = val;
  if (val === 'Yes' && !n.customerId) { const ar = activeRentalForUnit(n.unitId); n.customerId = ar?.customerId || null; }
  if (n.woId) { const w = IDX.wo.get(n.woId); if (w) { w.billCustomer = val; w.customerId = val === 'Yes' ? n.customerId : null; logAction(w, `Bill customer → ${val}`); } }
  logAction(n, `Bill customer → ${val}`);
  toast(val === 'Yes' ? 'Repair will be billed to the customer.' : 'Repair will not be billed.');
  const session = activeSession(); if (session.anchor) setAnchor(session, session.anchor.card, session.anchor.recId, session.anchor.recType);
  render(); renderOverlay();
}
function autoWOFromInspection(n) {
  const id = 'WO-INS' + (state.seq++);
  const u = IDX.unit.get(n.unitId);
  const wo = { woId: id, unitId: n.unitId, customerId: n.billCustomer === 'Yes' ? n.customerId : null, woReport: 'From failed inspection', woType: 'Failed', description: `Auto-created from inspection ${n.inspectionId}.`, phase: 'Part Needed?', billCustomer: n.billCustomer || 'No', date: TODAY_ISO, eta: '', unitHoursAtCreation: u?.currentHours || 0, assignedMechanic: '', laborHours: 0, lineItems: [], mock: true };
  DATA.workOrders.push(wo); IDX.wo.set(id, wo); reindex('workOrders', wo);
  n.woId = id;
  return wo;
}
/* Add a custom line item to an invoice (label + amount via quick prompt). */
function addCustomLine(invoiceId, label, amount) {
  const inv = IDX.invoice.get(invoiceId); if (!inv) return;
  if (label == null) label = (typeof prompt === 'function') ? prompt('Custom line description:', 'Misc charge') : 'Misc charge';
  if (label == null) return;                       // cancelled
  if (amount == null) { const raw = (typeof prompt === 'function') ? prompt('Amount ($):', '100') : '100'; if (raw == null) return; amount = Number(raw) || 0; }
  inv.lineItems.push({ kind: 'custom', ref: null, label: label || 'Custom', amount });
  logAction(inv, `Added line: ${label || 'Custom'} (${money(amount)})`);
  toast(`Custom line added (${money(amount)}).`);
  const session = activeSession(); if (session.anchor) setAnchor(session, session.anchor.card, session.anchor.recId, session.anchor.recType);
  render();
}
/* Add a part / labor line to a work order; advances the WO phase sensibly. */
function addPartToWO(woId, part, cost, hours, phase) {
  const w = IDX.wo.get(woId); if (!w) return;
  if (part == null) part = (typeof prompt === 'function') ? prompt('Part / labor description:', 'Hydraulic hose') : 'Part';
  if (part == null) return;
  if (cost == null) { const raw = (typeof prompt === 'function') ? prompt('Part cost ($, 0 for labor-only):', '0') : '0'; if (raw == null) return; cost = Number(raw) || 0; }
  if (hours == null) { const raw = (typeof prompt === 'function') ? prompt('Labor hours:', '1') : '1'; if (raw == null) return; hours = Number(raw) || 0; }
  w.lineItems = w.lineItems || [];
  w.lineItems.push({ part: part || 'Part', cost, hours, phase: phase || (cost > 0 ? 'Part Needed' : 'No Part Needed'), eta: '', vendor: '' });
  // reflect the bottleneck on the WO header phase (latest non-complete line)
  const open = w.lineItems.filter((li) => li.phase !== 'Complete');
  if (open.length) w.phase = open[open.length - 1].phase;
  logAction(w, `Added: ${part || 'Part'}${cost > 0 ? ` (${money(cost)})` : ''}`);
  toast('Line added to work order.');
  // plain render() — a part doesn't change cascade membership, and it preserves
  // the current card view (the WO may be open via its pill, not as the anchor).
  render();
}
/* Bill a WO from the work-order side: find the customer's open invoice (or make
   one) and add the WO to it, then jump to that invoice. */
function billWOToInvoice(woId) {
  const w = IDX.wo.get(woId); if (!w) return;
  let custId = w.customerId;
  if (!custId) { const ar = activeRentalForUnit(w.unitId); custId = ar?.customerId || null; }
  if (!custId) {
    // no bill-to-customer yet → pick one, then auto-bill (see assignPick)
    toast('Pick the customer to bill this work order to.');
    state.pendingBillWO = woId;
    return beginPick('shop', woId, 'workOrders', 'customer');
  }
  let inv = DATA.invoices.find((i) => i.customerId === custId && !['Paid', 'Refunded'].includes(invoiceTotals(i).status));
  if (!inv) {
    const id = nextInvoiceId();
    inv = { invoiceId: id, customerId: custId, rentalIds: [], date: TODAY_ISO, dueDate: addDays(TODAY_ISO, 14), po: '', amountPaid: 0, lineItems: [], mock: true };
    DATA.invoices.push(inv); IDX.invoice.set(id, inv); reindex('invoices', inv);
  }
  addWOToInvoice(inv.invoiceId, woId);
  anchorRecord('invoices', inv.invoiceId);   // jump to the invoice we billed to
}
/* Wash Request (§9 lightweight) — a No-Part WO flagged as a wash job. */
function startWashRequest(unitId) {
  const id = 'WO-WASH' + (state.seq++);
  const u = IDX.unit.get(unitId);
  const wo = { woId: id, unitId: unitId || null, customerId: null, woReport: 'Wash request', woType: 'Manual', description: 'Wash / detail requested.', phase: 'No Part Needed', billCustomer: 'No', date: TODAY_ISO, eta: '', unitHoursAtCreation: u?.currentHours || 0, assignedMechanic: '', laborHours: 0, lineItems: [], mock: true };
  DATA.workOrders.push(wo); IDX.wo.set(id, wo); reindex('workOrders', wo);
  anchorRecord('shop', id, 'workOrders');
  toast(`Wash request ${id} created.`);
  if (!unitId) beginPick('shop', id, 'workOrders', 'unit');
}
/* Add a rental (price + transport) as line items on an invoice. */
function addRentalLineToInvoice(invoiceId, rentalId) {
  const inv = IDX.invoice.get(invoiceId), r = IDX.rental.get(rentalId);
  if (!inv || !r) return;
  // a rental bills to ONE invoice — block double-billing onto a second (§7.5)
  if (r.invoiceId && r.invoiceId !== invoiceId) { toast(`Already on invoice ${invoiceShort(r.invoiceId)} — remove it there first.`); return; }
  if ((inv.lineItems || []).some((li) => li.kind === 'rental' && li.ref === rentalId)) { toast('That rental is already on this invoice.'); return; }
  const price = rentalPrice(r);
  inv.lineItems.push({ kind: 'rental', ref: rentalId, label: `${IDX.unit.get(r.unitId)?.name || 'Rental'} · ${price ? price.rate : '—'}`, amount: price ? price.price : 0 });
  const tr = rentalTransport(r);
  if (tr && tr.price) inv.lineItems.push({ kind: 'transport', ref: rentalId, label: `Transport · ${r.transportType}`, amount: tr.price });
  if (!r.invoiceId) r.invoiceId = invoiceId;
  if (!inv.rentalIds.includes(rentalId)) inv.rentalIds.push(rentalId);
  logAction(inv, `Added rental: ${IDX.unit.get(r.unitId)?.name || 'Rental'} (${money(price ? price.price : 0)})`);
  logAction(r, `Added to invoice ${invoiceShort(invoiceId)}`);
  toast('Rental added to invoice.');
  const session = activeSession(); if (session.anchor) setAnchor(session, session.anchor.card, session.anchor.recId, session.anchor.recType);
  render();
}
/* Add a WO's billable amount as a line on an invoice (bill-to-customer path). */
function addWOToInvoice(invoiceId, woId) {
  const inv = IDX.invoice.get(invoiceId), w = IDX.wo.get(woId);
  if (!inv || !w) return;
  // a WO bills once — block a duplicate line on any invoice (§7.6)
  if (DATA.invoices.some((i) => (i.lineItems || []).some((li) => li.kind === 'WO' && li.ref === woId))) { toast('This work order is already billed to an invoice.'); return; }
  const partsCost = (w.lineItems || []).reduce((a, li) => a + (Number(li.cost) || 0), 0);
  const labor = (w.lineItems || []).reduce((a, li) => a + (Number(li.hours) || 0), 0) || w.laborHours || 0;
  const amount = woBillable(w);
  inv.lineItems.push({ kind: 'WO', ref: woId, label: `${w.woReport} · ${IDX.unit.get(w.unitId)?.name || ''}`, amount });
  w.billCustomer = 'Yes'; if (!w.customerId) w.customerId = inv.customerId;
  logAction(w, `Billed to invoice ${invoiceShort(inv.invoiceId)} (${money(amount)})`);
  logAction(inv, `Added work order: ${w.woReport} (${money(amount)})`);
  toast(`Work order billed to invoice (${money(amount)}).`);
  const session = activeSession(); if (session.anchor) setAnchor(session, session.anchor.card, session.anchor.recId, session.anchor.recType);
  render();
}

/* ════════════════════════════════════════════════════════════════════════
   15. Boot
   ════════════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════════
   16. Backend persistence — Google Sheets via an Apps Script web app
   ════════════════════════════════════════════════════════════════════════
   The app loads its data from the Sheet on sign-in, seeds the Sheet from the
   demo data on first run, and auto-saves (debounced) after every change.
   Single shared password (sent with every call; the URL alone is useless). */
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbzHahzgJqOYe9o4GKlRVGh-A7USRn1k4Dvyy4ajLh8EYCqVxofouM28qs8trNlObZw/exec';
const PERSIST_KEYS = ['categories', 'units', 'customers', 'invoices', 'rentals', 'workOrders', 'inspections', 'vendors', 'parts', 'companyFiles', 'expenses'];
let backendPassword = sessionStorage.getItem('jactec.pw') || '';
let booting = true;                       // suppresses saves during initial load
let saveTimer = null, saving = false, savePending = false;

async function backendCall(action, extra) {
  // text/plain avoids a CORS preflight that GAS web apps can't answer
  const payload = Object.assign({ action, password: backendPassword }, extra || {});
  const res = await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
  return res.json();
}
const dataSnapshot = () => { const s = {}; PERSIST_KEYS.forEach((k) => { s[k] = DATA[k] || []; }); return s; };
async function loadFromBackend() {
  const r = await backendCall('load');
  if (!r || !r.ok) throw new Error((r && r.error) || 'load-failed');
  const data = r.data || {};
  // Apply whatever the backend holds. We do NOT auto-seed on empty anymore — that
  // could overwrite real data on a transient blip. A fresh backend is populated
  // explicitly via #reseed (admin), never silently from the demo file.
  PERSIST_KEYS.forEach((k) => { if (Array.isArray(data[k])) { DATA[k].length = 0; data[k].forEach((x) => DATA[k].push(x)); } });
}

// ── Incremental persistence (diff-based sync) ──────────────────────────────
// Whole-state seed doesn't scale (≈1.7 MB / 10 s at real volume). Instead we keep
// a snapshot of what the backend last held and, on each flush, send only the
// records that changed (upserts) or vanished (deletes). A one-field edit becomes
// a few-hundred-byte, sub-second call.
const PERSIST_ID = { categories: 'categoryId', units: 'unitId', customers: 'customerId', invoices: 'invoiceId', rentals: 'rentalId', workOrders: 'woId', inspections: 'inspectionId', vendors: 'vendorId', parts: 'partId', companyFiles: 'fileId', expenses: 'expenseId' };
let lastSaved = null;   // { entity: Map(id → JSON) } — the last successfully-persisted state
function snapshotSaved() {
  lastSaved = {};
  PERSIST_KEYS.forEach((k) => { const m = new Map(); (DATA[k] || []).forEach((r) => m.set(String(r[PERSIST_ID[k]]), JSON.stringify(r))); lastSaved[k] = m; });
}
function computeChanges() {
  const upserts = {}, deletes = {}; let n = 0;
  PERSIST_KEYS.forEach((k) => {
    const idf = PERSIST_ID[k]; const prev = (lastSaved && lastSaved[k]) || new Map(); const seen = new Set();
    const ups = [];
    (DATA[k] || []).forEach((r) => { const id = String(r[idf]); seen.add(id); const js = JSON.stringify(r); if (prev.get(id) !== js) ups.push({ id, js, rec: r }); });
    const dels = []; prev.forEach((_, id) => { if (!seen.has(id)) dels.push(id); });
    if (ups.length) { upserts[k] = ups; n += ups.length; }
    if (dels.length) { deletes[k] = dels; n += dels.length; }
  });
  return { upserts, deletes, n };
}
function saveSoon() { if (booting || !backendPassword) return; clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 1200); }
async function flushSave() {
  if (saving) { savePending = true; return; }
  if (!lastSaved) return;                       // never loaded → nothing to diff against
  const { upserts, deletes, n } = computeChanges();
  if (!n) return;                               // nothing changed
  saving = true;
  const wireUp = {}; Object.keys(upserts).forEach((k) => { wireUp[k] = upserts[k].map((u) => u.rec); });
  try {
    const r = await backendCall('sync', { upserts: wireUp, deletes });
    if (r && r.ok) {
      // Commit ONLY what we sent — edits made mid-flight stay dirty and re-flush.
      Object.keys(upserts).forEach((k) => upserts[k].forEach((u) => lastSaved[k].set(u.id, u.js)));
      Object.keys(deletes).forEach((k) => deletes[k].forEach((id) => lastSaved[k].delete(id)));
    } else { savePending = true; }              // server error → retry
  } catch (e) { savePending = true; }            // offline → retry on next change
  saving = false;
  if (savePending) { savePending = false; saveSoon(); }
}
function renderLogin(msg) {
  $('#app').innerHTML = `<div class="login-screen"><form class="login-box" id="login-form">
    <img class="login-logo" src="assets/jac-rentals-logo.jpg" alt="Jac Rentals" />
    <div class="login-title">Rental Wrangler</div>
    <div class="login-sub">Sign in to continue.</div>
    <input id="login-name" class="login-input" placeholder="Your name" autocomplete="name" value="${esc(currentUser)}" />
    <input id="login-pw" type="password" class="login-input" placeholder="Team password" autocomplete="current-password" />
    <button type="submit" class="login-btn" id="login-go">Sign in</button>
    <div class="login-err" id="login-err">${msg ? esc(msg) : ''}</div>
  </form></div>`;
  document.getElementById('login-form').addEventListener('submit', (e) => { e.preventDefault(); attemptLogin(); });
  document.getElementById(currentUser ? 'login-pw' : 'login-name').focus();
}
function finishLoad() {
  snapshotSaved();                                              // baseline = what the backend currently holds
  buildIndexes(); state.cascade = createCascade(DATA); booting = false; render();
  if (migrationDirty) { migrationDirty = false; saveSoon(); }   // push parsed first/last names up to the Sheet
  // #edit=<id> — desktop→phone handoff opens that customer's account form (§7.1).
  const em = (location.hash || '').match(/edit=([\w-]+)/i);
  if (em && IDX.customer.get(em[1])) { history.replaceState(null, '', location.pathname + location.search); openCustomerForm(em[1]); }
}
async function attemptLogin() {
  const name = (document.getElementById('login-name')?.value || '').trim();
  const pw = document.getElementById('login-pw')?.value || '';
  if (!name) { const errEl = document.getElementById('login-err'); if (errEl) errEl.textContent = 'Please enter your name (edits are logged under it).'; document.getElementById('login-name')?.focus(); return; }
  if (!pw) return;
  backendPassword = pw;
  const btn = document.getElementById('login-go'); if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }
  try {
    // Ask the backend for the role. The role-aware backend returns it; an older
    // backend (pre-roles) replies "unknown action" → we proceed without a role
    // (single-password mode). loadFromBackend then validates the password either way.
    let role = '';
    try {
      const a = await backendCall('auth');
      if (a && a.ok) role = a.role || '';
      else if (a && /unauthorized/i.test(a.error || '')) throw new Error('unauthorized');
    } catch (e2) { if (/unauthorized/i.test(e2.message || '')) throw e2; }
    currentRole = role;
    currentUser = name;
    try { localStorage.setItem('jactec.user', name); } catch {}
    try { sessionStorage.setItem('jactec.role', role); } catch {}
    sessionStorage.setItem('jactec.pw', pw);
    await loadFromBackend();
    finishLoad();
  } catch (e) {
    backendPassword = ''; sessionStorage.removeItem('jactec.pw'); sessionStorage.removeItem('jactec.role');
    renderLogin(/unauthorized/i.test(String(e && e.message)) ? 'That password wasn’t recognized.' : "Couldn't reach the database. Check your connection and try again.");
  }
}

function boot() {
  initTooltip();
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('keydown', (e) => {
    // §5.4 — the search bar IS the filter builder: Enter locks the current text in as
    // an AND-narrowing pill (clearing the input), Backspace-on-empty pops the last pill.
    if (e.target.id === 'globalsearch') {
      if (e.key === 'Enter') { e.preventDefault(); addFilterTerm('global', e.target.value); return; }
      if (e.key === 'Backspace' && !e.target.value && state.filterTerms.length) { e.preventDefault(); removeFilterTerm('global', state.filterTerms.length - 1); return; }
      return;
    }
    // §5.4 (per-card) — same Enter-to-pin / Backspace-to-pop on a card's list search.
    if (e.target.classList.contains('mini-search') && e.target.dataset.card && !e.target.classList.contains('js-history-search')) {
      const card = e.target.dataset.card; const cs = activeSession().cards[card];
      if (e.key === 'Enter') { e.preventDefault(); addFilterTerm(card, e.target.value); return; }
      if (e.key === 'Backspace' && !e.target.value && (cs.filterTerms || []).length) { e.preventDefault(); removeFilterTerm(card, cs.filterTerms.length - 1); return; }
      return;
    }
    if (e.target.classList.contains('nc-in') && e.key === 'Enter' && e.target.tagName !== 'SELECT') { e.preventDefault(); return saveNewCustomer(); }
    if (e.key === 'Escape') { if (state.winpicker) { closeWinPicker(); } else if (state.overlay) { closeOverlay(); } else if (state.pick) cancelPick(true); }
  });
  // mouse hotkeys (§0.1): double-click a row = anchor; right-click = Back
  const hotkeyGuard = (e) => e.target.closest('.inline-edit, input, textarea, select, .pill, button, .x') || state.pick || state.winpicker;
  document.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.row'); if (!row || hotkeyGuard(e)) return;
    e.preventDefault(); window.getSelection()?.removeAllRanges();
    anchorRecord(row.dataset.card, row.dataset.rec, row.dataset.type);
  });
  document.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.card'); if (!card) return;        // right-click anywhere in a card = Back
    if (e.target.closest('input, textarea, .inline-input')) return;   // allow native menu in fields
    e.preventDefault();                                               // suppress native menu, do Back
    if (state.pick || state.winpicker) return;
    goBack(card.dataset.card);
  });
  // Admin / offline boot modes (opt-in via URL hash) — checked before the login gate.
  const hash = (location.hash || '').toLowerCase();
  if (hash.includes('local')) { return offlineBoot(); }     // #local — render from data.js, no backend
  if (hash.includes('reseed')) { return reseedFromFile(); }  // #reseed — REPLACE live data with the file

  // §16 — gate on the shared password: load from the backend if we already have it
  // this session, otherwise show the login screen. The app only renders once data is in.
  if (backendPassword) {
    loadFromBackend().then(finishLoad)
      .catch(() => { backendPassword = ''; sessionStorage.removeItem('jactec.pw'); renderLogin('Please sign in again.'); });
  } else {
    renderLogin();
  }
}

// #local — render straight from data.js with NO backend (offline/demo + dev smoke test).
// saveSoon() already no-ops without a password, so edits stay in-memory only.
function offlineBoot() { buildIndexes(); state.cascade = createCascade(DATA); booting = false; render(); }

// #reseed — one-time admin: REPLACE the entire live database with the imported file (data.js).
// Guarded by the password + an explicit confirm, and self-clears the hash so it can't re-fire.
async function reseedFromFile() {
  const pw = window.prompt('RESEED — this REPLACES all live data with the imported file (data.js).\nThis cannot be undone.\n\nEnter the team password to proceed:');
  if (!pw) { renderLogin(); return; }
  backendPassword = pw;
  $('#app').innerHTML = '<div class="login-screen"><div class="login-box"><div class="login-title">Reseeding…</div><div class="login-sub">Uploading the imported data to the database. This can take a minute.</div></div></div>';
  try {
    // Safety: never let a small public/demo file overwrite a populated live database.
    // Fetch the current backend counts (without applying) and refuse to shrink it.
    const cur = await backendCall('load');
    if (cur && cur.ok && cur.data) {
      const liveCust = (cur.data.customers || []).length;
      const fileCust = (DATA.customers || []).length;
      if (liveCust > 0 && fileCust < liveCust) {
        backendPassword = ''; sessionStorage.removeItem('jactec.pw');
        alert('Reseed BLOCKED — the live database has ' + liveCust + ' customers but this file only has ' + fileCust + '.\nRefusing to overwrite real data with a smaller seed. Live data unchanged.');
        renderLogin('Reseed blocked — live data unchanged.');
        return;
      }
    }
    const r = await backendCall('seed', { data: dataSnapshot() });
    if (!r || !r.ok) throw new Error((r && r.error) || 'seed-failed');
    sessionStorage.setItem('jactec.pw', pw);
    history.replaceState(null, '', location.pathname + location.search);   // drop #reseed so a refresh won't wipe edits
    alert('Reseed complete — the live database now holds the imported data. Loading the app…');
    finishLoad();
  } catch (e) {
    backendPassword = ''; sessionStorage.removeItem('jactec.pw');
    alert('Reseed FAILED: ' + ((e && e.message) || e) + '\n\nThe live data was NOT changed.');
    renderLogin('Reseed failed — live data unchanged.');
  }
}
boot();

// expose for console/debugging + future DATA WIRING
window.JT = {
  state, DATA, IDX, render, rentalPrice, invoiceTotals, buildIndexes, migrateCustomers, fullName,
  saveSoon, flushSave, snapshotSaved, computeChanges,   // persistence hooks (debug + wiring)
  // creation / mutation API (the UI calls these; exposed for scripting + wiring)
  startNewRental, startNewInspection, startNewWorkOrder, startNewInvoice, startWashRequest,
  createInvoiceForRental, addRentalLineToInvoice, addWOToInvoice, addCustomLine, addPartToWO,
  setInspWash, setInspResult, setDraftDate, beginPick, assignPick,
  billWOToInvoice, anchorRecord, startNewCustomer, startNewReceipt, openOverlay,
};
