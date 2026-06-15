/**
 * config.js — Rental Wrangler centralized registry (SPEC v6 §2.3, §8, §11, §10, §12)
 * ------------------------------------------------------------------------------
 * THE single source of truth for every status set, color, role/KPI definition,
 * the transport city lookup, and the locked date formats. Render code NEVER
 * hardcodes a status string or a color — it always resolves through here.
 *
 *   getStatus(set, value) -> { label, color, slug, value }
 *   colorVar(token)       -> 'var(--green)'   (text/border tone)
 *   colorBgVar(token)     -> 'var(--green-bg)'(soft fill tone)
 *   lookupTransport(city) -> { price, driveMin } | null
 *   fmtWindow(start,end)  -> 'Mo03-Mo10' | 'Ju28-Jy05' (SPEC §12.2 locked)
 *   fmtShortDate(iso)     -> 'Jun 03'
 *   invoiceId(date, seq)  -> 'INV.06.07.26.001'
 * ------------------------------------------------------------------------------
 */

/* ── Color tokens (SPEC §6.1) ─────────────────────────────────────────────
 * The named status colors. The actual hex values live in style.css under
 * :root / [data-theme="light"]; here we only ever reference the CSS var names
 * so a single stylesheet edit re-themes the whole app. */
export const COLOR_TOKENS = [
  'green', 'yellow', 'red', 'blue', 'navy', 'purple',
  'pink', 'brown', 'gray', 'orange',
];
export const colorVar   = (token) => `var(--${token})`;
export const colorBgVar = (token) => `var(--${token}-bg)`;

/* ── Stripe (Phase 2 — card-on-file & invoice charging) ───────────────────
 * PUBLISHABLE test key only. Publishable keys are designed to live in client
 * code and are safe to commit — they can only create tokens, never move money.
 * The SECRET key (sk_test_…) lives ONLY in the Apps Script backend as a Script
 * Property and is NEVER placed here or in any client file. Swap to the live
 * pk_live_… key at go-live. */
// LIVE publishable key (public by design). The backend can override this per-mode
// via Script Property STRIPE_PUBLISHABLE_KEY (e.g. set pk_test_… to run in test).
export const STRIPE_PUBLISHABLE_KEY = 'pk_live_51TdOu3DEE4GXf0zT7xBP4KQ5vxK21P8n24MwxewyF4awrladyPYTkpiK8SRvUfFpwnFE1i2cITo1UxJ0CQrx30fl00dGxTTpWZ';

/* ── Google Maps key (Places autocomplete · map · drive distance) ─────────────
 * A REFERRER-RESTRICTED browser key (locked to app.jacrentals.com) — never a
 * true secret, but per the no-secrets-in-repo rule we DON'T commit it. The live
 * key is served at runtime by the backend (Script Property GOOGLE_MAPS_KEY) via
 * backendCall('mapsKey'), exactly like the Stripe publishable key. Empty here →
 * the transport editor runs in offline/mock mode until the backend serves a key. */
export const GOOGLE_MAPS_KEY = '';

/* ── Status registry (SPEC §8 canonical values + §6.2 #7 colors) ──────────
 * STATUS[set][value] = { label, color }. `slug` and `value` are derived.
 * Every set the app renders a pill for lives here. Legacy→canonical import
 * mapping lives in LEGACY_MAP below (used by the import layer, §13). */
const RAW_STATUS = {
  // Jac's locked palette (2026-06-07). NOTE: Tomorrow & Today are DERIVED display
  // states (not user-selected statuses) — the UI shows them on an upcoming rental
  // to signal urgency. Stored status stays Reserved; see deriveDisplayStatus (app).
  rentalStatus: {
    'Quote':     { label: 'Quote',     color: 'gray'   },
    'Reserved':  { label: 'Reserved',  color: 'purple' },
    'Tomorrow':  { label: 'Tomorrow',  color: 'purple' },  // derived urgency display
    'Today':     { label: 'Today',     color: 'blue'   },  // derived urgency display
    'On Rent':   { label: 'On Rent',   color: 'green'  },
    'End Rent':  { label: 'End Rent',  color: 'yellow' },
    'Off Rent':  { label: 'Off Rent',  color: 'pink'   },
    'Returned':  { label: 'Returned',  color: 'brown'  },
    'Cancelled': { label: 'Cancelled', color: 'orange' },
    'No Show':   { label: 'No Show',   color: 'orange' },
  },
  transportType: {
    'Self':       { label: 'Self',       color: 'gray' },
    'Delivery':   { label: 'Delivery',   color: 'blue' },
    'Recovery':   { label: 'Recovery',   color: 'navy' },
    'Round-Trip': { label: 'Round-Trip', color: 'blue' },
  },
  unitInspectionStatus: {
    'Ready':     { label: 'Ready',     color: 'green'  },
    'Not Ready': { label: 'Not Ready', color: 'yellow' },
    'Failed':    { label: 'Failed',    color: 'red'    },
  },
  unitFleetStatus: {
    'Purchased': { label: 'Purchased', color: 'navy'   },
    'Onboard':   { label: 'Onboard',   color: 'blue'   },
    'Active':    { label: 'Active',    color: 'green'  },
    'Inactive':  { label: 'Inactive',  color: 'gray'   },
    'For Sale':  { label: 'For Sale',  color: 'purple' },
    'Sold':      { label: 'Sold',      color: 'gray'   },
  },
  inspectionChecklist: {
    'Pass': { label: 'Pass', color: 'green' },
    'Fail': { label: 'Fail', color: 'red'   },
  },
  invoiceStatus: {
    'Not Due':     { label: 'Not Due',     color: 'blue'   },  // balance exists, due date not yet passed
    'Unpaid':      { label: 'Unpaid',      color: 'red'    },
    'Partial':     { label: 'Partial',     color: 'orange' },
    'Late':        { label: 'Late',        color: 'red'    },
    'Late+30':     { label: 'Late +30',    color: 'red'    },
    'Late+60':     { label: 'Late +60',    color: 'red'    },
    'Late+90':     { label: 'Late +90',    color: 'red'    },
    'Collections': { label: 'Collections', color: 'red'    },
    'Paid':        { label: 'Paid',        color: 'green'  },
    'Refunded':    { label: 'Refunded',    color: 'gray'   },
  },
  customerPayStatus: {
    'Current':      { label: 'Current',      color: 'green' },
    'Unpaid':       { label: 'Unpaid',       color: 'red'   },
    'Partial':      { label: 'Partial',      color: 'yellow'},
    'New Customer': { label: 'New Customer', color: 'blue'  },
  },
  customerAccountType: {
    'Non-Business':        { label: 'Non-Business',     color: 'gray'   },
    'Business':            { label: 'Business',         color: 'blue'   },
    'Non-Business Member': { label: 'Member',           color: 'purple' },
    'Business Member':     { label: 'Business Member',  color: 'purple' },
    'Member Incomplete':   { label: 'Member Incomplete',color: 'yellow' },
    'Blacklisted':         { label: 'Blacklisted',      color: 'red'    },
  },
  woPhase: {
    'Part Needed?':   { label: 'Part Needed?',   color: 'purple' },
    'No Part Needed': { label: 'No Part Needed', color: 'yellow' },
    'Part Needed':    { label: 'Part Needed',    color: 'red'    },
    'Part is Local':  { label: 'Part is Local',  color: 'yellow' },
    'Part in Stock':  { label: 'Part in Stock',  color: 'green'  },
    'Part Ordered':   { label: 'Part Ordered',   color: 'blue'   },
    'Complete':       { label: 'Complete',       color: 'green'  },
  },
  woType: {
    'Failed':     { label: 'Failed',     color: 'red'  },
    'Manual':     { label: 'Manual',     color: 'gray' },
    'Field Call': { label: 'Field Call', color: 'red'  },
  },
  billCustomer: {
    'Yes':   { label: 'Bill: Yes',   color: 'green'  },
    'Maybe': { label: 'Bill: Maybe', color: 'yellow' },
    'No':    { label: 'Bill: No',    color: 'gray'   },
  },
  funnelStage: {
    'Inbound Lead':      { label: 'Inbound Lead',      color: 'blue'   },
    'Outbound Lead':     { label: 'Outbound Lead',     color: 'navy'   },
    "Don't Contact":     { label: "Don't Contact",     color: 'red'    },
    'Contacted':         { label: 'Contacted',         color: 'yellow' },
    'Not A No!':         { label: 'Not A No!',         color: 'purple' },
    'Payment Discussed': { label: 'Payment Discussed', color: 'orange' },
    'Paid':              { label: 'Paid',              color: 'green'  },
  },
  gpsStatus: {
    'Reporting':     { label: 'Reporting',     color: 'green'  },
    'Verify':        { label: 'Verify',        color: 'yellow' },
    'Not Reporting': { label: 'Not Reporting', color: 'red'    },
  },
  expenseReconcile: {
    'Unreconciled': { label: 'Unreconciled', color: 'yellow' },
    'Pending':      { label: 'Pending',      color: 'blue'   },
    'Reconciled':   { label: 'Reconciled',   color: 'green'  },
  },
  expenseCategory: {
    'Parts':    { label: 'Parts',    color: 'blue'   },
    'Fuel':     { label: 'Fuel',     color: 'orange' },
    'Tools':    { label: 'Tools',    color: 'navy'   },
    'Service':  { label: 'Service',  color: 'purple' },
    'Shipping': { label: 'Shipping', color: 'brown'  },
    'Supplies': { label: 'Supplies', color: 'gray'   },
    'Other':    { label: 'Other',    color: 'gray'   },
  },
  vendorType: {
    'Local':  { label: 'Local',  color: 'gray' },
    'Online': { label: 'Online', color: 'navy' },
  },
  paymentMethod: {
    'Visa':  { label: 'Visa',  color: 'blue'  },
    'Amex':  { label: 'Amex',  color: 'navy'  },
    'Cash':  { label: 'Cash',  color: 'green' },
    'Check': { label: 'Check', color: 'gray'  },
    'ACH':   { label: 'ACH',   color: 'purple'},
  },
  companyFileType: {
    'Document': { label: 'Document', color: 'blue'   },
    'Photo':    { label: 'Photo',    color: 'purple' },
    'Link':     { label: 'Link',     color: 'navy'   },
    'Note':     { label: 'Note',     color: 'gray'   },
  },
  // Service-countdown urgency (mirrors service-countdown.js serviceColor()).
  serviceStatus: {
    'ok':       { label: 'On Schedule', color: 'green'  },
    'due-soon': { label: 'Due Soon',    color: 'yellow' },
    'past-due': { label: 'Past Due',    color: 'red'    },
  },
};

// Freeze the registry into { label, color, slug, value } records.
const slugify = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
export const STATUS = {};
for (const [set, values] of Object.entries(RAW_STATUS)) {
  STATUS[set] = {};
  for (const [value, def] of Object.entries(values)) {
    STATUS[set][value] = { ...def, value, slug: slugify(value) };
  }
}

const UNKNOWN_STATUS = { label: '—', color: 'gray', value: '', slug: 'unknown' };

/** Resolve a status descriptor. Returns a safe placeholder for unknown values
 *  rather than throwing — render code can always read .label/.color. */
export function getStatus(set, value) {
  const bag = STATUS[set];
  if (!bag) return { ...UNKNOWN_STATUS, value: value ?? '' };
  return bag[value] || { ...UNKNOWN_STATUS, label: value ?? '—', value: value ?? '' };
}

/* ── Legacy → canonical import map (SPEC §8 / §13; used by the import layer) ─ */
export const LEGACY_MAP = {
  rentalStatus: { 'Quoting': 'Quote', 'Return': 'Returned', 'End': 'End Rent', 'Refunded': 'Cancelled' },
  transportType: { '🚚🔄': 'Round-Trip', '🚚🔻': 'Delivery', '🚚🔼': 'Recovery' },
  woPhase: {
    'NEW': 'Part Needed?', 'Done!!': 'Complete', '🙏🔩': 'Part Needed', '🚫🔩': 'No Part Needed',
    '🔩✅📬': 'Part is Local', '🔩🔄📬': 'Part Ordered', '@Retailer': 'Part is Local', '@Dealer': 'Part is Local',
    'Hrs': 'Complete',
  },
  marker: { 'NCP': 'Ready', '?': 'Not Ready', '❌': 'Failed', '': 'Ready' },
  store: { 'SUL': 'Sulphur', 'BMT': 'Sulphur', 'Pick One': 'Sulphur' },
};

/* ── Transport-on-status: when does the truck icon show? (SPEC §8) ────────── */
const TRUCK_STATUSES = new Set(['Tomorrow', 'Today', 'Reserved', 'On Rent']);
export function showsTruck(rentalStatus, transportType) {
  if (transportType === 'Self' || !transportType) return false;
  if (transportType === 'Recovery') return rentalStatus === 'On Rent'; // Recovery: On Rent only
  return TRUCK_STATUSES.has(rentalStatus); // Delivery / Round-Trip on the 4 statuses
}

/* ── Roles, KPIs & dashboards (SPEC §11) ─────────────────────────────────── */
export const ROLES = [
  { id: 'mechanic', label: 'Mechanic', color: 'blue',
    kpis: ['Healthy Fleet', 'WO Completion Rate', 'Parts Breakeven'] },
  { id: 'mtech', label: 'M.Tech', color: 'purple',
    kpis: ['Successful Rentals', 'Ready Rate', 'WO Rate (20% goal)'] },
  { id: 'driver', label: 'Driver', color: 'green',
    kpis: ['On-Time', 'Wash Completion', 'Driving Score'] },
  { id: 'office', label: 'Office', color: 'orange',
    kpis: ['Invoice Collection Rate', 'Show Rate', 'Reputation'] },
  { id: 'sales', label: 'Sales', color: 'navy',
    kpis: ['Revenue Goal', 'Active Customer Rate', 'Pipeline'] },
];

/* ── Card registry (SPEC §5.5 grid order + §0.4 back-office boards) ──────── */
// 6-card grid (3×2): Work Orders + Service Orders + Inspections are merged into
// the single "Shop" card. The cascade engine still resolves those 3 entity types
// separately; the Shop card aggregates them.
// Grid order (3×2): row 1 = Units · Categories · Rentals; row 2 = Shop · Invoices · Customers
export const GRID_CARDS = [
  { id: 'units',      title: 'Units',      singular: 'Unit'      },
  { id: 'categories', title: 'Categories', singular: 'Category'  },
  { id: 'rentals',    title: 'Rentals',    singular: 'Rental'    },
  { id: 'shop',       title: 'Shop',       singular: 'Shop item' },
  { id: 'invoices',   title: 'Invoices',   singular: 'Invoice'   },
  { id: 'customers',  title: 'Customers',  singular: 'Customer'  },
];
export const SHOP_TYPES = ['inspections', 'workOrders', 'serviceOrders'];
// No "All" button — default is all 3 types; clicking a segment filters, clicking
// the active segment again clears back to all.
export const SHOP_SEGMENTS = [
  { id: 'inspections',   label: 'Inspections' },
  { id: 'workOrders',    label: 'Work Orders' },
  { id: 'serviceOrders', label: 'Service'     },
];
export const BACKOFFICE_BOARDS = [
  { id: 'parts',    title: 'Parts'                },
  { id: 'vendors',  title: 'Vendors'              },
  { id: 'expenses', title: 'Expenses & Receipts'  },
  { id: 'files',    title: 'Company Files'        },
];

/* ── 3-column layout (display only) ───────────────────────────────────────
 * Each column shows ONE active "member" at a time; the rest are a tab away.
 * The 3 shop members (inspections/serviceOrders/workOrders) still render via
 * the single 'shop' engine card with its segment pinned — the engine, anchor,
 * cascade and recType are NOT aware of columns. 'calendar' is the
 * Office Dispatch grid relocated into the middle column (never a pill target).
 * COLUMN_OF maps a member → its column so a link pill can reveal it. */
export const COLUMNS = [
  { id: 'left',   default: 'units',     members: ['units', 'categories', 'inspections', 'serviceOrders', 'workOrders'] },
  { id: 'middle', default: 'rentals',   members: ['rentals', 'calendar'] },
  { id: 'right',  default: 'customers', members: ['customers', 'invoices'] },
];
export const COLUMN_OF = {
  units: 'left', categories: 'left', inspections: 'left', serviceOrders: 'left', workOrders: 'left',
  rentals: 'middle', invoices: 'right', customers: 'right',
};

/* ── In-card sort fields (SPEC §12 locked table) ─────────────────────────── */
export const SORT_FIELDS = {
  customers:     [{ field: 'activePct', label: 'Active %', dir: 'desc' }, { field: 'name', label: 'Name', dir: 'asc' }, { field: 'totalPaid', label: 'Total Paid', dir: 'desc' }, { field: 'lastInvoice', label: 'Last Invoice', dir: 'desc' }, { field: 'payStatus', label: 'Pay Status', dir: 'asc' }],
  rentals:       [{ field: 'startDate', label: 'Start date', dir: 'asc' }, { field: 'endDate', label: 'End date', dir: 'asc' }, { field: 'status', label: 'Status', dir: 'asc' }, { field: 'customer', label: 'Customer', dir: 'asc' }, { field: 'price', label: 'Rental Price', dir: 'desc' }],
  categories:    [{ field: 'name', label: 'Name', dir: 'asc' }, { field: 'roi', label: 'ROI', dir: 'desc' }, { field: 'unitCount', label: 'Unit count', dir: 'desc' }, { field: 'avgHours', label: 'Avg Hours', dir: 'desc' }, { field: 'rate1Day', label: '1-Day rate', dir: 'desc' }],
  units:         [{ field: 'name', label: 'Name', dir: 'asc' }, { field: 'currentHours', label: 'Current Hours', dir: 'desc' }, { field: 'inspectionStatus', label: 'Inspection', dir: 'asc' }, { field: 'fleetStatus', label: 'Fleet', dir: 'asc' }, { field: 'category', label: 'Category', dir: 'asc' }, { field: 'repairCost', label: 'Repair Cost', dir: 'desc' }, { field: 'soldInactive', label: 'Sold/Inactive', dir: 'asc' }, { field: 'allFleet', label: 'All Units (any status)', dir: 'asc' }],
  invoices:      [{ field: 'dueDate', label: 'Due Date', dir: 'asc' }, { field: 'date', label: 'Date', dir: 'desc' }, { field: 'balance', label: 'Balance', dir: 'desc' }, { field: 'status', label: 'Status', dir: 'asc' }, { field: 'customer', label: 'Customer', dir: 'asc' }],
  workOrders:    [{ field: 'date', label: 'Date', dir: 'desc' }, { field: 'phase', label: 'Phase', dir: 'asc' }, { field: 'unit', label: 'Unit', dir: 'asc' }, { field: 'priceIfBilled', label: 'Price If Billed', dir: 'desc' }, { field: 'woType', label: 'WO Type', dir: 'asc' }],
  serviceOrders: [{ field: 'countdown', label: 'Countdown', dir: 'asc' }, { field: 'unit', label: 'Unit', dir: 'asc' }, { field: 'task', label: 'Task', dir: 'asc' }, { field: 'status', label: 'Status', dir: 'asc' }],
  inspections:   [{ field: 'date', label: 'Date', dir: 'desc' }, { field: 'result', label: 'Result', dir: 'asc' }, { field: 'unit', label: 'Unit', dir: 'asc' }],
  shop:          [{ field: 'urgency', label: 'Urgency', dir: 'desc' }, { field: 'date', label: 'Date', dir: 'desc' }, { field: 'unit', label: 'Unit', dir: 'asc' }, { field: 'type', label: 'Type', dir: 'asc' }, { field: 'complete', label: 'Completed', dir: 'desc' }],
};

/* ── Transport city lookup (SPEC §10) ────────────────────────────────────
 * Flat fee + drive minutes by destination city. Round-Trip doubles the fee
 * (handled by the caller); Unlimited-Transport members price $0; city not
 * found → '-'. Keys are lowercased for tolerant matching. */
const TRANSPORT_TIERS = [
  [90, 5,    ['Sulphur']],
  [100, 10,  ['Carlyss', 'Edgerly']],
  [115, 15,  ['Westlake', 'Vinton', 'Lake Charles']],
  [140, 25,  ['DeQuincy', 'Moss Bluff', 'Starks', 'Hackberry']],
  [150, 30,  ['Iowa', 'Lacassine', 'Orange', 'Grand Lake', 'Gillis']],
  [165, 35,  ['West Orange', 'Fenton', 'Deweyville']],
  [175, 40,  ['Bell City', 'Ragley', 'Orangefield', 'Roanoke', 'Mauriceville', 'Vidor', 'Welsh', 'Singer', 'Fields', 'Big Lake']],
  [190, 45,  ['Rose City', 'Bridge City', 'Hayes', 'Sweet Lake', 'Kinder', 'Longville', 'Pine Forest']],
  [200, 50,  ['Jennings', 'Beaumont', 'Reeves', 'Groves', 'Evangeline', 'Merryville']],
  [210, 54,  ['Egan']],
  [215, 55,  ['Mermentau', 'Rose Hill Acres', 'DeRidder', 'Elton', 'Buna', 'Evadale', 'Oberlin']],
  [225, 60,  ['LeBlanc', 'Nederland', 'Port Neches', 'Estherwood', 'Iota', 'Midland', 'Bevil Oaks', 'Crowley', 'Port Arthur', 'Lumberton', 'Dry Creek', 'Creole', 'Kirbyville', 'Bon Wier']],
  [240, 65,  ['Morse', 'Fannett', 'Lake Arthur', 'Rayne', 'Silsbee', 'Cameron', 'Basile']],
  [250, 70,  ['Bon Ami', 'Hamshire', 'Nome', 'Sour Lake', 'Duson', 'Evans', 'Grayburg', 'Mittie', 'Johnson Bayou', 'Newton']],
  [265, 75,  ['Branch', 'Scott', 'Sugartown', 'Winnie', 'Stowell', 'Grand Chenier', 'Oakdale', 'Eunice', 'Kountze']],
  [275, 80,  ['Church Point']],
  [290, 85,  ['Carencro', 'Elizabeth', 'Maurice', 'Saratoga', 'Burkeville']],
  [300, 90,  ['China', 'Wildwood', 'Mamou', 'Jasper']],
  [315, 95,  ['Votaw']],
  [325, 100, ['Ville Platte']],
  [340, 105, ['Woodville']],
];
export const TRANSPORT_MAP = {};
for (const [price, driveMin, cities] of TRANSPORT_TIERS) {
  for (const c of cities) TRANSPORT_MAP[c.toLowerCase()] = { price, driveMin };
}

/** Extract a city token from a free-text address ("265 Callie Ln, Orange, TX")
 *  and resolve its transport fee + drive time. Returns null if not found. */
export function lookupTransport(address) {
  if (!address) return null;
  // Try the whole string, then each comma-separated segment (city is usually
  // the 2nd-to-last segment before STATE, ZIP, Country).
  const candidates = [address, ...address.split(',').map((s) => s.trim())];
  for (const cand of candidates) {
    const hit = TRANSPORT_MAP[cand.toLowerCase()];
    if (hit) return hit;
  }
  return null;
}

/** LEGACY transport price (city-tier table). Kept as the offline/no-key fallback
 *  for addresses that have never been geocoded (seeded demo data, CI). The live
 *  app prices via computeTransportPrice using Google drive distance (see below). */
export function legacyTransportPrice(transportType, address, { unlimitedTransport = false } = {}) {
  if (!transportType || transportType === 'Self') return { price: 0, driveMin: 0, label: 'Self' };
  if (unlimitedTransport) return { price: 0, driveMin: 0, label: 'Unlimited' };
  const hit = lookupTransport(address);
  if (!hit) return { price: null, driveMin: null, label: '-' };
  const mult = transportType === 'Round-Trip' ? 2 : 1;
  return { price: hit.price * mult, driveMin: hit.driveMin, label: `$${hit.price * mult}` };
}

/* ── Transport pricing v2 (Jac 2026-06-15) — real per-mile formula ────────────
 * Per unit, per transport leg:  $3.50/mile + $50 load + ($20 fuel if fueled).
 * legs = Delivery|Recovery → 1 ; Round-Trip → 2 ; Self|none → 0. One-way miles
 * and drive minutes come from Google (origin = the yard) and are CACHED on the
 * unit entry at save time, so render/billing never calls Google. */
export const TRANSPORT_RATES = { perMile: 3.5, loadPerLeg: 50, fuelPerLeg: 20 };

/** The dispatch origin for every transport distance lookup (Google Distance Matrix). */
export const YARD_ORIGIN = 'JacRentals, Sulphur, LA, USA';

/** A unit is "fueled" (gets the $20/leg fuel-fill) when its category runs on a
 *  combustion fuel. Electric / battery / unknown → no fuel charge. */
export function isFueledType(fuelType) {
  return /diesel|gas(oline)?|petrol|propane|\blp\b/i.test(String(fuelType || ''));
}

/** Trip legs billed for a transport type. */
export function legsForType(transportType) {
  if (transportType === 'Round-Trip') return 2;
  if (transportType === 'Delivery' || transportType === 'Recovery') return 1;
  return 0;
}

/** PURE transport price from cached inputs (testable, no Google).
 *  @param oneWayMiles  yard↔site one-way driving miles (null → price unknown). */
export function computeTransportPrice({ transportType, oneWayMiles, fueled = false, unlimitedTransport = false } = {}) {
  const legs = legsForType(transportType);
  if (!legs) return { price: 0, driveMin: 0, label: 'Self', legs: 0 };
  if (unlimitedTransport) return { price: 0, driveMin: 0, label: 'Unlimited', legs };
  if (oneWayMiles == null || !isFinite(oneWayMiles)) return { price: null, driveMin: null, label: '—', legs };
  const perLeg = TRANSPORT_RATES.perMile * oneWayMiles + TRANSPORT_RATES.loadPerLeg + (fueled ? TRANSPORT_RATES.fuelPerLeg : 0);
  const price = Math.round(perLeg * legs);
  return { price, driveMin: null, label: `$${price}`, legs, perLeg: Math.round(perLeg) };
}

/* ── Locked date formats (SPEC §12.2) ────────────────────────────────────
 * Window pills: same-month  -> weekday+day  'Mo03-Mo10'
 *               cross-month  -> monthAbbr+day 'Ju28-Jy05'
 * NOTE: the spec's month-abbrev list omits October; we use 'Oc'. Flagged for
 * Jac to confirm. */
const WEEKDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_ABBR = ['Ja', 'Fe', 'Mr', 'Ap', 'Ma', 'Ju', 'Jy', 'Au', 'Se', 'Oc', 'Nv', 'De'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse 'YYYY-MM-DD' into a local Date with no timezone drift. */
export function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
const pad2 = (n) => String(n).padStart(2, '0');

/** Rental-window pill text per the locked §12.2 pattern. */
export function fmtWindow(startISO, endISO) {
  const s = parseISO(startISO), e = parseISO(endISO);
  if (!s && !e) return '—';
  if (s && !e) return `${WEEKDAY[s.getDay()]}${pad2(s.getDate())}`;
  if (!s && e) return `${WEEKDAY[e.getDay()]}${pad2(e.getDate())}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${WEEKDAY[s.getDay()]}${pad2(s.getDate())}-${WEEKDAY[e.getDay()]}${pad2(e.getDate())}`;
  }
  return `${MONTH_ABBR[s.getMonth()]}${pad2(s.getDate())}-${MONTH_ABBR[e.getMonth()]}${pad2(e.getDate())}`;
}

/** 'Jun 03' style single date (headers, §12.8). */
export function fmtShortDate(iso) {
  const d = parseISO(iso);
  if (!d) return '—';
  return `${MONTH_SHORT[d.getMonth()]} ${pad2(d.getDate())}`;
}

/** Invoice ID format ##iDDMmmYY — running number, 'i', day, 2-letter month abbrev,
 *  2-digit year (e.g. #1 on 2026-02-20 -> '01i20Fe26'). Date suffix is always 6 chars. */
export function invoiceId(iso, seq) {
  const d = parseISO(iso) || new Date(2026, 0, 1);
  const yy = String(d.getFullYear()).slice(-2);
  return `${pad2(seq)}i${pad2(d.getDate())}${MONTH_ABBR[d.getMonth()]}${yy}`;
}
/** Short label for an invoice id — the leading "##i" (everything before the 6-char
 *  DDMmmYY date suffix), so it works regardless of the running-number's digit count. */
export const invoiceShort = (id) => { id = String(id || ''); return id.length > 6 ? id.slice(0, -6) : id; };

/* ── Misc constants ──────────────────────────────────────────────────────── */
// Live "today" — the real local date, so the window picker, Today/Tomorrow badges,
// invoice aging, the monthly Revenue Goal, and weekend rates all track the actual day.
// (Was a frozen demo date '2026-06-07'; seeded demo rentals now read relative to today.)
export const TODAY_ISO = (() => {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();
export const REVENUE_GOAL_DEFAULT = 150000; // SPEC §10 Revenue Goal default
export const PERF_BUDGET_MS = 100;          // SPEC §3 hard interaction budget
