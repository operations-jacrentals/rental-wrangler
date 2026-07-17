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
 * A REFERRER-RESTRICTED browser key (locked to app.jacrentals.com) — public by
 * design, like the Stripe publishable key above: only usable from our domain, so
 * it's safe to commit. The backend can still override it at runtime (Script
 * Property GOOGLE_MAPS_KEY via backendCall('mapsKey')); empty → offline/mock map. */
export const GOOGLE_MAPS_KEY = 'AIzaSyBDI79RRj31RTWfHFUNWQZ5AO4wHLihIc8';

/* ── WranglerGPS backend URL (telematics integration, spec 2026-07-07) ─────────
 * Our OWN redeploy of the forked WranglerGPS service (Node/Express + Postgres on
 * Railway) — the live-telemetry backend the GPS section talks to directly. Public
 * by design, exactly like GOOGLE_MAPS_KEY above: the URL alone is useless without
 * the team password (POST /auth/login → x-auth-token on every call). Empty string
 * disables the integration cleanly (the app renders without live GPS). Swap this if
 * the service moves (e.g. behind a gps.jacrentals.com custom domain). */
export const GPS_BACKEND_URL = 'https://wranglergps-production-c2ad.up.railway.app';

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
    'Ready':     { label: 'Passed',    color: 'green'  },  // stored value stays 'Ready' (live-DB compatible); label only is 'Passed'
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
    'Not Due':     { label: 'Not Due',     color: 'yellow' },  // balance exists, due date not yet passed (RYG: not-yet-due = caution → red when due)
    'Unpaid':      { label: 'Unpaid',      color: 'red'    },
    'Partial':     { label: 'Partial',     color: 'orange' },
    'Late':        { label: 'Late',        color: 'red'    },
    'Late+30':     { label: 'Late +30',    color: 'red'    },
    'Late+60':     { label: 'Late +60',    color: 'red'    },
    'Late+90':     { label: 'Late +90',    color: 'red'    },
    'Collections': { label: 'Collections', color: 'red'    },
    // Stored placement marker beats the derived aging tier (spec collections §4.2/§7.1, Jac 2026-06-29):
    // gray-adjacent = off the active R/Y/G aging ladder — the balance left active chasing.
    'Sent to Collections': { label: 'In Collections', color: 'gray' },
    'Paid':        { label: 'Paid',        color: 'green'  },
    'Refunded':    { label: 'Refunded',    color: 'gray'   },
    // Voided (Jac 2026-07-09): an unpaid invoice unlinked from its rental & retired to a
    // $0 record — off the active books (gray), keeps the audit trail instead of a delete gap.
    'Voided':      { label: 'Voided',      color: 'gray'   },
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
    'Cancel':         { label: 'Cancelled',      color: 'gray'   },
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
    'N/A':               { label: 'N/A',               color: 'gray'   },
    'Lead':              { label: 'Lead',              color: 'blue'   },   // funnel redesign 2026-07-17 — the shared entry stage for Rental/Member/Equipment
    'Reserved':          { label: 'Reserved',          color: 'purple' },   // Rental funnel — AUTO from a future reservation (never a manual pick)
    'Rented':            { label: 'Rented',            color: 'green'  },   // Rental funnel — AUTO from On Rent
    'Inbound Lead':      { label: 'Inbound Lead',      color: 'blue'   },   // legacy (pre-redesign) — kept for existing data; migrated → 'Lead'
    'Outbound Lead':     { label: 'Outbound Lead',     color: 'navy'   },
    "Don't Contact":     { label: "Don't Contact",     color: 'red'    },
    'Contacted':         { label: 'Contacted',         color: 'yellow' },
    'Not A No!':         { label: 'Not A No!',         color: 'purple' },
    'Payment Discussed': { label: 'Payment Discussed', color: 'orange' },
    'Paid':              { label: 'Paid',              color: 'green'  },
    'Signed':            { label: 'Signed',            color: 'green'  },   // membership terminal — auto-set by signing the agreement (F3), never manual
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
    'Parts':     { label: 'Parts',     color: 'blue'   },
    'Fuel':      { label: 'Fuel',      color: 'orange' },
    'Tools':     { label: 'Tools',     color: 'navy'   },
    'Service':   { label: 'Service',   color: 'purple' },
    'Shipping':  { label: 'Shipping',  color: 'brown'  },
    'Supplies':  { label: 'Supplies',  color: 'gray'   },
    'Insurance': { label: 'Insurance', color: 'navy'   },   // yard equipment-policy premiums — a COST, never revenue (spec equipment-insurance §7.3)
    'Other':     { label: 'Other',     color: 'gray'   },
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

/* ── Flag-driven color system (SPEC docs/specs/flag-color-system.md) ─────────
   The CATALOG is data-only (id · label · severity) and lives here next to the
   STATUS registry. The CONDITION functions live in app.js `FLAG_COND` (they need
   app-layer helpers: rentalOverbooked, cardFlag, customerActivity, invoiceTotals,
   topServiceForUnit … which depend on IDX/DATA and can't be imported here — same
   data-in-config / logic-in-app split as STATUS vs the render code).
   Severity drives the computed pill/border color: red > yellow > green; an
   archived record short-circuits to gray (see getEntityColor in app.js). */
export const FLAG_META = {
  rentals: [
    { id: 'fc',              label: 'Field Call',             severity: 'red'    },
    { id: 'overbooked',      label: 'Overbooked',             severity: 'red'    },
    { id: 'unpaid-balance',  label: 'Unpaid Balance',         severity: 'red'    },
    { id: 'no-card',         label: 'No Card',                severity: 'red'    },
    { id: 'unsigned-card',   label: 'Unsigned Card',          severity: 'red'    },
    { id: 'unit-failed',     label: 'Unit Failed Inspection', severity: 'red'    },
    { id: 'off-rent-overdue',label: 'Overdue Return',         severity: 'red'    },
    { id: 'no-show',         label: 'No Show',                severity: 'yellow' },  // derived: Reserved whose start passed (mirrors the retired derived status)
    { id: 'starts-today',    label: 'Starts Today',           severity: 'yellow' },
    { id: 'starts-tomorrow', label: 'Starts Tomorrow',        severity: 'yellow' },
    { id: 'end-rent',        label: 'Returning Today',        severity: 'yellow' },
    { id: 'unit-due-soon',   label: 'Service Due Soon',       severity: 'yellow' },
    { id: 'partial-payment', label: 'Partial Payment',        severity: 'yellow' },
    { id: 'card-expiring',   label: 'Card Expiring',          severity: 'yellow' },
  ],
  units: [
    { id: 'inspection-failed',    label: 'Failed Inspection', severity: 'red'    },
    { id: 'service-past-due',     label: 'Service Past Due',  severity: 'red'    },
    { id: 'overbooked',           label: 'Overbooked',        severity: 'red'    },
    { id: 'gps-offline',          label: 'GPS Offline',       severity: 'red'    },
    { id: 'inspection-not-ready', label: 'Not Ready',         severity: 'yellow' },
    { id: 'service-due-soon',     label: 'Service Due Soon',  severity: 'yellow' },
    { id: 'wash-requested',       label: 'Wash Requested',    severity: 'yellow' },
    { id: 'gps-verify',           label: 'GPS Verify',        severity: 'yellow' },
    { id: 'coverage-expired',     label: 'Coverage Expired',  severity: 'red'    },   // insured but past insurance.expires (spec equipment-insurance D6)
    { id: 'uninsured-active',     label: 'Uninsured On Rent', severity: 'yellow' },   // on rent with no yard coverage — the worst-case pre-warning
  ],
  workOrders: [
    { id: 'part-needed',         label: 'Part Needed',       severity: 'red'    },
    { id: 'field-call',          label: 'Field Call',        severity: 'red'    },
    { id: 'failed-origin',       label: 'From Failed Inspection', severity: 'red' },
    { id: 'no-lines',            label: 'No Line Items',     severity: 'red'    },
    { id: 'part-unknown',        label: 'Part Needed?',      severity: 'yellow' },
    { id: 'part-ordered-no-eta', label: 'No ETA',            severity: 'yellow' },
    { id: 'part-ordered-eta',    label: 'Part Ordered',      severity: 'yellow' },
    { id: 'part-local',          label: 'Pick Up Part',      severity: 'yellow' },
    { id: 'bill-maybe',          label: 'Bill Customer?',    severity: 'yellow' },
  ],
  invoices: [
    { id: 'unpaid',      label: 'Unpaid',      severity: 'red'    },
    { id: 'late',        label: 'Late',        severity: 'red'    },
    { id: 'collections', label: 'Collections', severity: 'red'    },
    { id: 'partial',     label: 'Partial Payment', severity: 'yellow' },
    { id: 'not-due',     label: 'Balance Due', severity: 'yellow' },
  ],
  customers: [
    { id: 'unpaid-balance',    label: 'Unpaid Balance',    severity: 'red'    },
    { id: 'blacklisted',       label: 'Blacklisted',       severity: 'red'    },
    { id: 'no-card',           label: 'No Card',           severity: 'red'    },
    { id: 'customer-lost',     label: 'Lost',              severity: 'red'    },
    { id: 'customer-inactive', label: 'Inactive',          severity: 'red'    },
    { id: 'partial-balance',   label: 'Partial Balance',   severity: 'yellow' },
    { id: 'member-incomplete', label: 'Member Incomplete', severity: 'yellow' },
    { id: 'action-required',   label: 'Action Required',   severity: 'yellow' },
    { id: 'check-in',          label: 'Due for Check-In',  severity: 'yellow' },
    { id: 'card-expiring',     label: 'Card Expiring',     severity: 'yellow' },
    { id: 'no-card-reserved',  label: 'No Card',           severity: 'yellow' },
  ],
};
/** Severity rank for sorting/highest-wins. Higher = more severe. */
export const FLAG_SEVERITY_RANK = { red: 3, yellow: 2, green: 1 };

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
    kpis: ['Successful Rentals', 'Pass Rate', 'WO Rate (20% goal)'] },
  { id: 'driver', label: 'Driver', color: 'green',
    kpis: ['On-Time', 'Wash Completion', 'Driving Score'] },
  { id: 'office', label: 'Office', color: 'orange',
    kpis: ['Invoice Collection Rate', 'Show Rate', 'Reputation'] },
  { id: 'sales', label: 'Sales', color: 'navy',
    kpis: ['Revenue Goal', 'Active Customer Rate', 'Pipeline'] },
];

/* ── Customer funnels (redesign 2026-07-17 — spec: customer-funnel-redesign) ──
 * Three funnels a customer can be in at once (explicit membership on customer.funnels).
 * Each has its own stage LADDER (in order) and its AUTO stages (derived from live rental /
 * agreement / invoice activity — never a manual pick, rendered locked like today's Signed/Paid).
 *   • Rental  = renting equipment. Reserved/Rented are auto from the customer's rentals; a first
 *               reservation/rental AUTO-JOINS the Rental funnel (see the migration + derivations).
 *   • Member  = the membership-signup pipeline (a continuation of Rental in the detail view).
 *   • Equipment = the equipment-SALES pipeline (no rental states). Terminal Paid (Member ends Signed). */
export const FUNNELS = {
  rental:    { label: 'Rental',    stages: ['Lead', 'Reserved', 'Rented'],                                          auto: ['Reserved', 'Rented'] },   // Reserved/Rented DERIVED from live rentals
  member:    { label: 'Member',    stages: ['Lead', 'Contacted', 'Not A No!', 'Payment Discussed', 'Signed'],       auto: ['Signed'] },               // Signed auto-set by signing the membership agreement (markMembershipSigned)
  // Equipment 'Paid' stays a MANUAL terminal: there is no customer↔sale-invoice link today to auto-lock it on
  // payment (sellUnit is fleet-level, no buyer; no 'sale' line-kind), so keeping it auto-only would make it
  // unreachable. Flagged for Jac — wire an auto trigger later and move 'Paid' into `auto`.
  equipment: { label: 'Equipment', stages: ['Lead', 'Contacted', 'Not A No!', 'Payment Discussed', 'Paid'],         auto: [] },
};
export const FUNNEL_KEYS = Object.keys(FUNNELS);   // ['rental','member','equipment']

/* ── Permission tiers (role-system redesign 2026-06-26) ───────────────────────
 * Roles are customizable (add/remove/rename in Settings → Roles & Logins), so
 * permissions can no longer key off role NAMES. Instead every role — built-in or
 * custom — carries one TIER, and all gates compare tiers. A strict superset
 * ladder: each tier includes every power below it. `rank` is the comparison key.
 *   staff   — operational only (units/shop/rentals/inspections)
 *   money   — + see pricing/margin, take payments, invoices
 *   manager — + approve requests, override blocks
 *   admin   — + Settings, category/pricing edits, migrations
 *   developer — + dev tools (Design Lint / Inspector / Rulebook)
 * Spec: docs/superpowers/specs/2026-06-26-role-system-redesign-design.md */
export const ROLE_TIERS = [
  { id: 'staff',     rank: 1, label: 'Staff' },
  { id: 'money',     rank: 2, label: 'Money' },
  { id: 'manager',   rank: 3, label: 'Manager' },
  { id: 'admin',     rank: 4, label: 'Admin' },
  { id: 'developer', rank: 5, label: 'Developer' },
];
/* tierRank('admin') -> 4; unknown/blank -> 0 (no privilege). */
export const tierRank = (tierId) => {
  const t = ROLE_TIERS.find((x) => x.id === String(tierId || '').trim().toLowerCase());
  return t ? t.rank : 0;
};
/* Default tier per SHIPPED role id — the fallback when a backend predates
 * `settings.roleMeta`. Keyed by lowercased role id. */
export const BUILTIN_ROLE_TIERS = {
  mechanic: 'staff', mtech: 'staff', driver: 'staff',
  office: 'money', sales: 'money',
  manager: 'manager', admin: 'admin', developer: 'developer',
  // Backward-compat bridge: the legacy "Owner" login keeps its admin-ceiling
  // powers until it's explicitly converted to Manager (runtime, via Settings),
  // so the rollout never strips an in-use login mid-flight.
  owner: 'admin',
};

/* ── Card registry (SPEC §5.5 grid order + §0.4 back-office boards) ──────── */
// 5-card grid: the Shop card was RETIRED (Jac 2026-07-07) — Work Orders, Service
// Orders and Inspections live inside each Unit's detail view now; the cascade
// engine still resolves those 3 entity types separately (SHOP_TYPES below), and
// any reference to one opens its OWNING UNIT.
// Grid order: row 1 = Units · Categories · Rentals; row 2 = Invoices · Customers
export const GRID_CARDS = [
  { id: 'units',      title: 'Units',      singular: 'Unit'      },
  { id: 'categories', title: 'Categories', singular: 'Category'  },
  { id: 'rentals',    title: 'Rentals',    singular: 'Rental'    },
  { id: 'invoices',   title: 'Invoices',   singular: 'Invoice'   },
  { id: 'customers',  title: 'Customers',  singular: 'Customer'  },
];
// The 3 unit-borne entity types the retired Shop card used to aggregate — still
// the routing/entity vocabulary (pills, cascade, hover previews, Round-Up).
export const SHOP_TYPES = ['inspections', 'workOrders', 'serviceOrders'];
/* ── Equipment-insurance coverage types (spec equipment-insurance D1, Jac 2026-06-29) ──
 * The YARD's asset-policy riders — exactly three: Theft, Flood, In-Tow Damage (asset only).
 * NOT the same thing as membership Rental Protection (customer-side, covers anything up to
 * $2,000 on the rented unit). Owner-editable at runtime via settings.insuranceTypes
 * (same repriceable-config pattern as the mem* keys); these are the shipped defaults. */
export const INSURANCE_COVERAGE_TYPES = [
  { id: 'theft',  label: 'Theft' },
  { id: 'flood',  label: 'Flood' },
  { id: 'in-tow', label: 'In-Tow Damage (asset only)' },
];

export const BACKOFFICE_BOARDS = [
  { id: 'parts',       title: 'Parts'                },
  { id: 'vendors',     title: 'Vendors'              },
  { id: 'expenses',    title: 'Expenses & Receipts'  },
  { id: 'files',       title: 'Company Files'        },
  { id: 'collections', title: 'Collections'          },   // invoices queued for collections (spec collections Phase 1)
  { id: 'pipeline',    title: 'Sales Pipeline'       },   // the top-level sales board (spec sales-growth D1, Jac 2026-06-29)
];

/* ── 3-column layout (display only) ───────────────────────────────────────
 * Each column shows ONE active "member" at a time; the rest are a tab away.
 * 'calendar' is the Office Dispatch grid relocated into the middle column
 * (never a pill target). COLUMN_OF maps a member → its column so a link pill
 * can reveal it. (Shop retirement 2026-07-07: the left column holds Units +
 * Categories only — WO/service/inspection references reveal 'units'.) */
export const COLUMNS = [
  { id: 'left',   default: 'units',     members: ['units', 'categories'] },
  { id: 'middle', default: 'rentals',   members: ['rentals', 'calendar'] },
  { id: 'right',  default: 'customers', members: ['customers', 'sales'] },   // invoices retired (embedded in Customer Details); 2nd slot reserved for the upcoming 'sales' card ("coming soon" placeholder until PR 2)
];
export const COLUMN_OF = {
  units: 'left', categories: 'left',
  rentals: 'middle', calendar: 'middle', customers: 'right', sales: 'right',   // no 'invoices' — links route via openInvoice() into Customer Details; 'sales' is a bespoke card (like 'calendar'), not in GRID_CARDS
};

/* ── In-card sort fields (SPEC §12 locked table) ─────────────────────────── */
export const SORT_FIELDS = {
  customers:     [{ field: 'activePct', label: 'Active %', dir: 'desc' }, { field: 'name', label: 'Name', dir: 'asc' }, { field: 'totalPaid', label: 'Total Paid', dir: 'desc' }, { field: 'lastInvoice', label: 'Last Invoice', dir: 'desc' }, { field: 'payStatus', label: 'Pay Status', dir: 'asc' }],
  rentals:       [{ field: 'startDate', label: 'Start date', dir: 'asc' }, { field: 'endDate', label: 'End date', dir: 'asc' }, { field: 'status', label: 'Status', dir: 'asc' }, { field: 'customer', label: 'Customer', dir: 'asc' }, { field: 'price', label: 'Rental Price', dir: 'desc' }, { field: 'done', label: 'Completed', dir: 'desc' }],
  categories:    [{ field: 'name', label: 'Name', dir: 'asc' }, { field: 'roi', label: 'ROI', dir: 'desc' }, { field: 'unitCount', label: 'Unit count', dir: 'desc' }, { field: 'avgHours', label: 'Avg Hours', dir: 'desc' }, { field: 'rate1Day', label: '1-Day rate', dir: 'desc' }],
  units:         [{ field: 'name', label: 'Name', dir: 'asc' }, { field: 'countdown', label: 'Service Due', dir: 'asc' }, { field: 'currentHours', label: 'Current Hours', dir: 'desc' }, { field: 'inspectionStatus', label: 'Inspection', dir: 'asc' }, { field: 'fleetStatus', label: 'Fleet', dir: 'asc' }, { field: 'category', label: 'Category', dir: 'asc' }, { field: 'repairCost', label: 'Repair Cost', dir: 'desc' }, { field: 'soldInactive', label: 'Sold/Inactive', dir: 'asc' }, { field: 'allFleet', label: 'All Units (any status)', dir: 'asc' }],
  invoices:      [{ field: 'dueDate', label: 'Due Date', dir: 'asc' }, { field: 'date', label: 'Date', dir: 'desc' }, { field: 'balance', label: 'Balance', dir: 'desc' }, { field: 'status', label: 'Status', dir: 'asc' }, { field: 'customer', label: 'Customer', dir: 'asc' }],
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

/** Invoice ID format ##MMDDYY (Jac 2026-07-08) — running number that resets PER MONTH,
 *  2-letter UPPERCASE month abbrev, day, 2-digit year (e.g. the 228th July-2026 invoice on
 *  the 8th -> '228JY0826'). No 'i' separator — the digit→letter→digit boundary parses it.
 *  Legacy ids are the old ##iDDMmmYY form; invoiceShort / parseInvoice handle both so nothing
 *  minted before the switch breaks. */
export function invoiceId(iso, seq) {
  const d = parseISO(iso) || new Date(2026, 0, 1);
  const yy = String(d.getFullYear()).slice(-2);
  return `${pad2(seq)}${MONTH_ABBR[d.getMonth()].toUpperCase()}${pad2(d.getDate())}${yy}`;
}
/** Short pill label — number + month ("228JY"): drop the 4-char DDYY tail on a NEW-format id;
 *  legacy ##iDDMmmYY ids drop their 6-char date suffix -> "##i". */
export const invoiceShort = (id) => {
  id = String(id || '');
  if (/^\d+[A-Za-z]{2}\d{4}$/.test(id)) return id.slice(0, -4);   // NEW ##MMDDYY -> ##MM
  return id.length > 6 ? id.slice(0, -6) : id;                    // legacy ##iDDMmmYY -> ##i
};
/** Month+year key that scopes the per-month invoice counter (e.g. 'JY26' for July 2026). */
export function invoiceMonthKey(iso) {
  const d = parseISO(iso) || new Date(2026, 0, 1);
  return MONTH_ABBR[d.getMonth()].toUpperCase() + String(d.getFullYear()).slice(-2);
}
/** Parse any invoice id -> { seq, monthKey } | null. Handles the NEW ##MMDDYY form AND the
 *  legacy ##iDDMmmYY form, so the per-month counter counts both across the transition. */
export function parseInvoice(id) {
  id = String(id || '');
  let x = /^(\d+)([A-Za-z]{2})\d{2}(\d{2})$/.exec(id);      // NEW: seq, month, day, year
  if (x) return { seq: +x[1], monthKey: x[2].toUpperCase() + x[3] };
  x = /^(\d+)i\d{2}([A-Za-z]{2})(\d{2})$/.exec(id);         // legacy: seq, 'i', day, month, year
  if (x) return { seq: +x[1], monthKey: x[2].toUpperCase() + x[3] };
  return null;
}

/* ── Misc constants ──────────────────────────────────────────────────────── */
// Live "today" — the real local date, so the window picker, Today/Tomorrow badges,
// invoice aging, the monthly Revenue Goal, and weekend rates all track the actual day.
// (Was a frozen demo date '2026-06-07'; seeded demo rentals now read relative to today.)
const computeTodayISO = () => {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
// LIVE, not frozen: an always-on shop machine keeps the SPA open across midnight,
// which used to leave TODAY_ISO stuck on the load day — so every new action/inspection/
// WO stamp got yesterday's date while nowClock() read the live time (History showed
// e.g. "Jul 07 · 11:59 AM" for a Jul 08 event). refreshTodayISO() rolls it over; the
// app calls it on render + the refresh poll, and ESM live bindings hand the fresh value
// to every importer that reads TODAY_ISO at call time.
export let TODAY_ISO = computeTodayISO();
/** Re-evaluate "today"; returns true only when the calendar day actually rolled over. */
export function refreshTodayISO() {
  const next = computeTodayISO();
  if (next === TODAY_ISO) return false;
  TODAY_ISO = next;
  return true;
}
export const REVENUE_GOAL_DEFAULT = 150000; // SPEC §10 Revenue Goal default
export const PERF_BUDGET_MS = 100;          // SPEC §3 hard interaction budget
export const PERF_VITALS_ON = true;         // master kill-switch for Web-Vitals/render instrumentation (spec frontend-performance P0)
export const PERF_SAMPLE_RATE = 1;          // fraction of sessions that flush a perfReport (1 = all, tune down at scale)

/* ── Feature flags (dev-workflow trunk-based redesign D5, spec 2026-07-12) ──
 * Scaffold ONLY — nothing is wired to a key yet, no behavior changes here.
 * What it's for: when a big feature REPLACEMENT ships, land the new code path
 * ALONGSIDE the old one, gated on FEATURES[key]. Default OFF keeps the old
 * path live in production; flipping the key to true is the rollout switch,
 * and flipping it back is the instant rollback — no code surgery either way.
 * Delete the old path only once the new one has proven out. Small/low-risk
 * changes skip this scaffold entirely and merge plainly.
 * CAVEAT — this is NOT a secrecy mechanism: on a public Pages site, a flag
 * disables EXECUTION, not VISIBILITY — flagged code still ships readable in
 * the public bundle. Never gate a secret or a security/auth check on this. */
export const FEATURES = {
  // Card-search global mode — a globe toggle inside each grid-card search bar flips
  // between per-card and whole-yard search, replacing the giant #globalsearch bar.
  // Flag ON = the globe path (old bar removed); OFF = the old #globalsearch bar.
  cardGlobalSearch: true,
  // Phone-verified device identity — per-person staff logins that replace the shared
  // role-passwords (spec 2026-07-13-text-link-identity). ON = per-person mode (SMS code
  // verify → personal device trusted 30d / shared device takes a PIN each session);
  // OFF = today's shared team-password login. The BACKEND enforces the real auth
  // independently — this flag only switches the login EXPERIENCE, never the gate.
  phoneIdentity: true,
  // QR decal → scan-to-log video (spec/plan 2026-07-16). ON = the #u=<unitId> scan
  // route + lite capture screen are active; OFF = the route is inert (nothing in
  // production touches it). Ships OFF so the frontend can promote before the backend
  // captureByScan handler is deployed (Jac deploys the backend last); flipped ON only
  // after that deploy. The flag gates EXPERIENCE only — the real auth is the server-side
  // write-only scanDeviceToken check in captureByScan, never this flag.
  qrScanLog: true,   // PRODUCTION switch — ON (2026-07-17): backend captureByScan + history-derivation deployed; scan-to-log live
  // Staging-review aid for the scan flow: when ON, the client short-circuits captureByScan to
  // CANNED responses (no backend needed) so every state is walkable before the handler is deployed.
  // Test-decal id suffix → state: …1 start · …2 end · …3 blocked · …4 not-found. OFF in production
  // (real backend). Never a security surface — the real auth is always server-side.
  qrScanPreview: false,
  // Instant Cache — on a PERSONAL (trusted) device, paint the last known-good backend
  // load from an on-device IndexedDB snapshot instantly on open, then reconcile with
  // the live backend (spec 2026-07-16-instant-cache). Display-only: the cache is never
  // a save baseline, so it can't corrupt the Sheet; personal devices only (no PII at
  // rest on shared machines). ON = paint-from-cache path; OFF = today's splash + load.
  instantCache: true,
  // Cross-device user sync (spec 2026-07-17). ON = a logged-in person's display/sort prefs,
  // saved Views, dispatcher route state, comms state, and resume-column follow them across
  // devices — via the additive getUserPrefs/setUserPrefs blob + the personId-re-keyed
  // group-order/Wrangler-rail; OFF = today's device-local localStorage (the layer no-ops).
  // Ships OFF so the client can promote before/independent of the backend deploy; flip ON to
  // roll out, back to OFF for instant rollback. Gates EXPERIENCE only — operator isolation is
  // enforced server-side (personId resolved from the session token, never a client value).
  // ACTIVATED 2026-07-17 after reconciliation folded in the first-adopt seed-before-wipe fix
  // (no cutover Views loss), logout/pagehide flush, and refresh-poll re-drive. Flip back to
  // false for instant rollback.
  userSync: true,
};

/* Phone-identity client constants (non-secret — display/UX only; the backend owns the
 * authoritative TTLs, hashing, and attempt caps). Safe to ship in the public bundle. */
export const PHONE_IDENTITY = {
  codeLen: 6,               // digits in an SMS verification code
  pinMinLen: 4,             // minimum PIN length on a shared device
  pinMaxLen: 8,
  trustDays: 30,            // how long a personal device stays trusted before re-verify
  codeTtlMin: 10,           // verification-code lifetime (a login someone's waiting on)
  linkTtlMin: 45,           // enrollment/welcome link lifetime
  // Default crew-welcome SMS (customizable in Settings → Team Roster; the backend is the
  // authoritative default and substitutes the tokens at send time). Tokens: {name} = the
  // hand's roster name (falls back to "partner"), {link} = the app URL. No login code —
  // the phone-first sign-in issues that in-app when they enter their mobile number.
  welcomeText:
    "Saddle up, {name}! You're on the JacRentals crew. Open {link} and sign in with your mobile number to get rolling.",
};
