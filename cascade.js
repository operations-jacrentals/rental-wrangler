/**
 * cascade.js — Rental Wrangler relational cascade engine
 * ------------------------------------------------------------------
 * The heart of the single-page UX (SPEC v6 §0.1/§0.3). When a record is
 * ANCHORED, every other card shows that record's related items in
 * list-search view. This module computes "what shows where" — it is PURE
 * DATA IN → IDs OUT, with zero DOM/framework coupling, so any renderer can
 * consume it.
 *
 * Ported faithfully from jactec-frontend-v2.html (`scope()` + `relatedFor()`),
 * then generalized: it takes a `data` store instead of a global, and all
 * foreign-key names live in one FIELDS config so it works against either the
 * current prototype seed OR the v6 canonical model by editing one block.
 *
 * ------------------------------------------------------------------
 * WIRED FOR v6: DEFAULT_FIELDS below uses the CANONICAL v6 field names (the
 * names the cleaned CSVs / data.js actually use). The logic is unchanged from
 * the reference module — only the right-hand FK strings were swapped per the
 * module's own instructions ("Swap the right-hand strings to the canonical
 * names when you wire the v6 data model.").
 * ------------------------------------------------------------------
 */

export const DEFAULT_FIELDS = {
  rental:     { id: 'rentalId', unit: 'unitId', customer: 'customerId', invoice: 'invoiceId' },
  unit:       { id: 'unitId', category: 'categoryId' },
  invoice:    { id: 'invoiceId', customer: 'customerId', rentals: 'rentalIds' },
  customer:   { id: 'customerId' },
  category:   { id: 'categoryId' },
  workOrder:  { id: 'woId', unit: 'unitId', customer: 'customerId', billed: 'billCustomer', woType: 'woType' },
  inspection: { id: 'inspectionId', unit: 'unitId' },
};

// Which array in the data store holds each entity type.
// NOTE: serviceOrders has no own collection — its records ARE units
// (one service row per task per unit), so it resolves against `units`.
export const DEFAULT_COLLECTIONS = {
  units: 'units',
  customers: 'customers',
  invoices: 'invoices',
  rentals: 'rentals',
  inspections: 'inspections',
  categories: 'categories',
  workOrders: 'workOrders',
  // serviceOrders intentionally omitted — handled via units
};

/**
 * Create a cascade engine bound to a data store.
 * @param {object} data  e.g. { rentals:[], units:[], customers:[], invoices:[], categories:[], workOrders:[], inspections:[] }
 * @param {object} [opts] { fields, collections } to override the maps above.
 */
export function createCascade(data, opts = {}) {
  const F = { ...DEFAULT_FIELDS, ...(opts.fields || {}) };
  const C = { ...DEFAULT_COLLECTIONS, ...(opts.collections || {}) };

  // A `type` may arrive SINGULAR ('unit', 'rental' — used internally by
  // scope/byId) or PLURAL ('units', 'rentals' — the card ids). Normalize so
  // both forms resolve to the same data array and id field.
  const SINGULAR = { customers: 'customer', rentals: 'rental', units: 'unit', invoices: 'invoice', categories: 'category', workOrders: 'workOrder', inspections: 'inspection' };
  const PLURAL   = { customer: 'customers', rental: 'rentals', unit: 'units', invoice: 'invoices', category: 'categories', workOrder: 'workOrders', inspection: 'inspections' };
  const arrName  = (type) => C[type] || C[PLURAL[type]] || PLURAL[type] || type;
  const coll     = (type) => data[arrName(type)] || [];
  const idField  = (type) => { const s = SINGULAR[type] || type; return (F[s] && F[s].id) || 'id'; };
  const byId     = (type, id) => coll(type).find((x) => x[idField(type)] === id);

  /**
   * Build the related-ID scope for an anchored record. Mirrors the v2
   * `scope()` exactly: a customer pulls in its rentals (+ their units/
   * invoices) and invoices; a unit pulls in its rentals; a rental pulls in
   * its unit/customer/invoice; an invoice pulls in its customer + its
   * rentals; a category pulls in its units + their rentals; a work order
   * pulls in its unit (+ customer); an inspection pulls in its unit.
   *
   * @param {string} type  'customer'|'unit'|'rental'|'invoice'|'category'|'workOrder'|'inspection'
   * @param {object} rec   the anchored record
   * @returns {{unit:Set,rental:Set,customer:Set,invoice:Set}}
   */
  function scope(type, rec) {
    const s = { unit: new Set(), rental: new Set(), customer: new Set(), invoice: new Set() };
    if (!rec) return s;

    const addRental = (r) => {
      if (!r) return;
      s.rental.add(r[F.rental.id]);
      if (r[F.rental.unit] != null) s.unit.add(r[F.rental.unit]);
      if (r[F.rental.customer] != null) s.customer.add(r[F.rental.customer]);
      if (r[F.rental.invoice] != null) s.invoice.add(r[F.rental.invoice]);
    };

    switch (type) {
      case 'customer': {
        s.customer.add(rec[F.customer.id]);
        coll('rentals').filter((r) => r[F.rental.customer] === rec[F.customer.id]).forEach(addRental);
        coll('invoices').filter((i) => i[F.invoice.customer] === rec[F.customer.id])
          .forEach((i) => s.invoice.add(i[F.invoice.id]));
        break;
      }
      case 'unit': {
        s.unit.add(rec[F.unit.id]);
        coll('rentals').filter((r) => r[F.rental.unit] === rec[F.unit.id]).forEach(addRental);
        break;
      }
      case 'rental': {
        addRental(rec);
        break;
      }
      case 'invoice': {
        s.invoice.add(rec[F.invoice.id]);
        if (rec[F.invoice.customer] != null) s.customer.add(rec[F.invoice.customer]);
        (rec[F.invoice.rentals] || []).forEach((rid) => addRental(byId('rental', rid)));
        break;
      }
      case 'category': {
        coll('units').filter((u) => u[F.unit.category] === rec[F.category.id]).forEach((u) => {
          s.unit.add(u[F.unit.id]);
          coll('rentals').filter((r) => r[F.rental.unit] === u[F.unit.id]).forEach(addRental);
        });
        break;
      }
      case 'workOrder': {
        if (rec[F.workOrder.unit] != null) s.unit.add(rec[F.workOrder.unit]);
        if (rec[F.workOrder.customer] != null) s.customer.add(rec[F.workOrder.customer]);
        break;
      }
      case 'inspection': {
        if (rec[F.inspection.unit] != null) s.unit.add(rec[F.inspection.unit]);
        break;
      }
    }
    return s;
  }

  /**
   * Records that should appear on `cardId` when `(type, rec)` is anchored.
   * Mirrors the v2 `relatedFor()` exactly, including:
   *  - inspections resolve by unit
   *  - serviceOrders resolve to the in-scope units (one SO row per task/unit)
   *  - categories derive from the in-scope units' categories
   *  - workOrders match unit OR customer; when the anchor is a CUSTOMER, the
   *    list is restricted to billable WOs (billCustomer = 'Yes' or Field Call)
   *
   * @returns {Array} the related records for that card (list-search rows)
   */
  function relatedFor(cardId, type, rec) {
    const s = scope(type, rec);
    switch (cardId) {
      case 'units':
        return coll('units').filter((u) => s.unit.has(u[F.unit.id]));
      case 'customers':
        return coll('customers').filter((c) => s.customer.has(c[F.customer.id]));
      case 'invoices':
        return coll('invoices').filter((i) => s.invoice.has(i[F.invoice.id]));
      case 'rentals':
        return coll('rentals').filter((r) => s.rental.has(r[F.rental.id]));
      case 'inspections':
        return coll('inspections').filter((n) => s.unit.has(n[F.inspection.unit]));
      case 'serviceOrders':
        return coll('units').filter((u) => s.unit.has(u[F.unit.id]));
      case 'categories': {
        const catIds = new Set([...s.unit].map((id) => byId('unit', id)?.[F.unit.category]));
        return coll('categories').filter((k) => catIds.has(k[F.category.id]));
      }
      case 'workOrders': {
        let list = coll('workOrders').filter(
          (w) => s.unit.has(w[F.workOrder.unit]) ||
                 (w[F.workOrder.customer] != null && s.customer.has(w[F.workOrder.customer]))
        );
        if (type === 'customer') {
          list = list.filter(
            (w) => w[F.workOrder.billed] === 'Yes' || w[F.workOrder.woType] === 'Field Call'
          );
        }
        return list;
      }
      default:
        return [];
    }
  }

  /**
   * One-shot convenience: the full cascade for every card when a record is
   * anchored. This is what a grid renderer typically wants per anchor change.
   * @returns {Object<string, Array>} { customers, rentals, categories, units, invoices, workOrders, serviceOrders, inspections }
   */
  function cascadeAll(type, rec) {
    const cards = ['customers', 'rentals', 'categories', 'units', 'invoices', 'workOrders', 'serviceOrders', 'inspections'];
    const out = {};
    for (const id of cards) out[id] = relatedFor(id, type, rec);
    return out;
  }

  /**
   * Which cards to HIGHLIGHT for the "+New" creation flows (SPEC v6 §0.3).
   * Building a rental walks Category → Unit; building an invoice walks
   * Work Orders → Rentals. Returns [] for everything else.
   */
  function suggestedCards(type) {
    if (type === 'rental') return ['categories', 'units'];
    if (type === 'invoice') return ['workOrders', 'rentals'];
    return [];
  }

  return { scope, relatedFor, cascadeAll, suggestedCards, byId };
}

export default createCascade;
