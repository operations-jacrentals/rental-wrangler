/**
 * data.js — Rental Wrangler demo seed (SPEC v6 §13)
 * ------------------------------------------------------------------------------
 * Small, RELATIONALLY-COHERENT demo seed for the prototype phase. Built from
 * authentic names + pricing pulled from the cleaned CSVs so the cascade,
 * status pills, timeline visualizations and §10 money formulas all exercise
 * real shapes. Everything here is source/editable data ONLY — prices, rates,
 * balances, transport costs, availability, rental/order status and service
 * countdowns are DERIVED LIVE (SPEC §2 "one fact, one place").
 *
 * In production this object is replaced by reads from the Google Sheets backend
 * (one tab per board) across the `// DATA WIRING` seam in data wiring. Invoices,
 * inspections and service orders have no CSV — they're created in-app — but a
 * few are seeded here so the Rentals reference card can show its Invoice /
 * Inspection sections and the cross-card cascade.
 *
 * All records carry `mock:true` (SPEC §13.9 hygiene) for easy removal.
 * ------------------------------------------------------------------------------
 */

const m = (o) => ({ ...o, mock: true });

/* ── Categories (home of all pricing; SPEC §7.2) — real rows from categories.csv ── */
const categories = [
  m({ categoryId: 'CAT001', name: 'Light Tower',      memberDaily: 29,  rate1Day: 100, rate7Day: 290,  rate4Wk: 820,  weekend: 150, msrp: 12000,  askPrice: 6210,  bottomDollar: 5400,  fuelType: 'Diesel',   description: 'LED light tower. Yanmar diesel, 204,488 lumens, 4-section mast, 355° rotation.' }),
  m({ categoryId: 'CAT004', name: 'Lift Scissor 26ft', memberDaily: 29, rate1Day: 190, rate7Day: 290,  rate4Wk: 890,  weekend: 285, msrp: 18000,  askPrice: 9900,  bottomDollar: 8200,  fuelType: 'Electric', description: '26ft electric scissor lift. Indoor/outdoor, non-marking tires.' }),
  m({ categoryId: 'CAT008', name: 'Skid Steer 75hp',   memberDaily: 89, rate1Day: 360, rate7Day: 1190, rate4Wk: 2880, weekend: 540, msrp: 62000,  askPrice: 41000, bottomDollar: 36500, fuelType: 'Diesel',   description: '75hp skid steer loader. High-flow aux hydraulics, enclosed cab.' }),
  m({ categoryId: 'CAT011', name: '12k Excavator',     memberDaily: 120, rate1Day: 440, rate7Day: 1290, rate4Wk: 3500, weekend: 660, msrp: 98000,  askPrice: 64000, bottomDollar: 57000, fuelType: 'Diesel',   description: '12,000 lb class hydraulic excavator. Rubber tracks, hydraulic thumb.' }),
  m({ categoryId: 'CAT012', name: '8k Excavator',      memberDaily: 89, rate1Day: 320, rate7Day: 990,  rate4Wk: 2880, weekend: 480, msrp: 71000,  askPrice: 46000, bottomDollar: 41000, fuelType: 'Diesel',   description: '8,000 lb class excavator. Compact tail swing, quick coupler.' }),
];

/* ── Units (SPEC §7.3) — real rows from units.csv. purchaseHours + serviceCompletions
 *    seeded so the derived service countdowns land on a realistic mix. ── */
const units = [
  // CAT011 — 12k Excavator: deliberately spread Ready / Not Ready / Failed for the inspection-mix viz
  m({ unitId: 'U003', name: 'Worm',          categoryId: 'CAT011', assignedMechanic: '',        currentHours: 3122,   inspectionStatus: 'Failed',    fleetStatus: 'Active', purchaseHours: 140,  serviceCompletions: { 'svc-oil': 3050, 'svc-grease': 3000 }, serial: 'JCB-512-3390', year: 2019, make: 'JCB', model: '512-56', weight: '24,800 lbs', gpsType: 'GPSWOX', gpsPlacement: 'Under dash', gpsStatus: 'Not Reporting', purchasePrice: 86000, purchaseDate: '2019-08-22', trueCost: 90400, notes: 'GPS unit replaced once; verify wiring.' }),
  m({ unitId: 'U004', name: 'Shrek',         categoryId: 'CAT011', assignedMechanic: 'Cameron', currentHours: 3675,   inspectionStatus: 'Ready',     fleetStatus: 'Active', purchaseHours: 95,   serviceCompletions: { 'svc-oil': 3600, 'svc-grease': 3500, 'svc-safety': 3650, 'svc-air': 3300, 'svc-hydraulic': 3000 }, serial: 'JCB-512-4471', year: 2021, make: 'JCB', model: '512-56 Loadall', weight: '24,800 lbs', gpsType: 'GPSWOX', gpsPlacement: 'Under dash', gpsStatus: 'Reporting', purchasePrice: 92000, purchaseDate: '2021-03-14', trueCost: 88500, notes: 'High-flow coupler upgraded 2024.' }),
  m({ unitId: 'U005', name: 'Reptar',        categoryId: 'CAT011', assignedMechanic: '',        currentHours: 2125,   inspectionStatus: 'Failed',    fleetStatus: 'Active', purchaseHours: 0,    serviceCompletions: { 'svc-oil': 2000 } }),
  m({ unitId: 'U006', name: 'Young (Bobcat)',categoryId: 'CAT011', assignedMechanic: '',        currentHours: 1000,   inspectionStatus: 'Ready',     fleetStatus: 'Active', purchaseHours: 0,    serviceCompletions: { 'svc-oil': 950, 'svc-grease': 900, 'svc-air': 800 } }),
  m({ unitId: 'U007', name: 'Moto Moto',     categoryId: 'CAT011', assignedMechanic: 'Cameron', currentHours: 2953.3, inspectionStatus: 'Not Ready', fleetStatus: 'Active', purchaseHours: 0,    serviceCompletions: { 'svc-oil': 2900 } }),
  // CAT012 — 8k Excavator
  m({ unitId: 'U023', name: 'Eileen',        categoryId: 'CAT012', assignedMechanic: 'Cameron', currentHours: 3379.6, inspectionStatus: 'Ready',     fleetStatus: 'Active', purchaseHours: 0,    serviceCompletions: { 'svc-oil': 3300, 'svc-grease': 3250 } }),
  m({ unitId: 'U024', name: 'Brookie',       categoryId: 'CAT012', assignedMechanic: 'Cameron', currentHours: 2060.3, inspectionStatus: 'Ready',     fleetStatus: 'Active', purchaseHours: 70,   serviceCompletions: { 'svc-oil': 2000, 'svc-grease': 1900, 'svc-safety': 1980 }, serial: 'KUB-KX080-2041', year: 2022, make: 'Kubota', model: 'KX080-4', weight: '18,300 lbs', gpsType: 'GPSWOX', gpsPlacement: 'Cab roof', gpsStatus: 'Reporting', purchasePrice: 71000, purchaseDate: '2022-05-09', trueCost: 69200, notes: '' }),
  m({ unitId: 'U025', name: 'Milkshake',     categoryId: 'CAT012', assignedMechanic: '',        currentHours: 1513,   inspectionStatus: 'Ready',     fleetStatus: 'Active', purchaseHours: 0,    serviceCompletions: { 'svc-oil': 1450 } }),
  // CAT008 — Skid Steer 75hp
  m({ unitId: 'U001', name: 'Dirt Dauber',   categoryId: 'CAT008', assignedMechanic: 'Cameron', currentHours: 1249.1, inspectionStatus: 'Ready',     fleetStatus: 'Active', purchaseHours: 60,   serviceCompletions: { 'svc-oil': 1200, 'svc-grease': 1150, 'svc-safety': 1220 }, serial: 'BOB-S76-2210', year: 2020, make: 'Bobcat', model: 'S76', weight: '9,400 lbs', gpsType: 'GPSWOX', gpsPlacement: 'Cab roof', gpsStatus: 'Verify', purchasePrice: 62000, purchaseDate: '2020-07-02', trueCost: 59800, notes: '' }),
  // CAT001 — Light Tower
  m({ unitId: 'U120', name: 'Beacon',        categoryId: 'CAT001', assignedMechanic: '',        currentHours: 480,    inspectionStatus: 'Ready',     fleetStatus: 'Active', purchaseHours: 0,    serviceCompletions: { 'svc-oil': 450 } }),
  m({ unitId: 'U121', name: 'Lumen',         categoryId: 'CAT001', assignedMechanic: '',        currentHours: 312,    inspectionStatus: 'Ready',     fleetStatus: 'Sold', purchaseHours: 0, serviceCompletions: {} }),
  // CAT004 — Lift Scissor 26ft
  m({ unitId: 'U060', name: 'Highrise',      categoryId: 'CAT004', assignedMechanic: '',        currentHours: 540,    inspectionStatus: 'Not Ready', fleetStatus: 'Active', purchaseHours: 0,    serviceCompletions: {} }),
];

/* ── Customers (SPEC §7.1) — real rows from customers.csv. The history-digest
 *    numbers (totalPaid/visits/years/avgFrequencyDays/activePct/first-last) are
 *    DERIVED in production; seeded here so the Customers list can render its
 *    Active-Status spectrum + digest while Customers stays a basic card this slice. ── */
const customers = [
  m({ customerId: 'C0009', name: 'Devin Lyles (bayou games)', company: 'bayou games', phone: '(337) 214-5001', email: 'manager@bayougames.com', address: 'Lake Charles, LA, USA', accountType: 'Business', payStatus: 'Current', industry: 'Entertainment', requiresPO: false, accountNotes: 'Recurring event-equipment renter.', stripeId: 'cus_demo009', cards: [{ id: 'CARD-D009', stripePmId: 'pm_demo009', brand: 'visa', last4: '4242', expMonth: 8, expYear: 2031, nickname: '', notes: '', isDefault: true, status: 'active' }], cardBrand: 'visa', cardLast4: '4242', cardExpMonth: 8, cardExpYear: 2031, _digest: { totalPaid: 18400, visits: 14, years: 2, avgFrequencyDays: 26, activePct: 82, firstInvoice: '2024-05-10', lastInvoice: '2026-06-02' },
      usedSalesStage: 'Contacted', interestedCategoryIds: ['CAT001', 'CAT008'], salesAction: 'Send weekend light-tower package quote',
      membershipStage: 'N/A',
      activityLog: [ { when: '2026-05-20', text: 'Quoted weekend light-tower package' }, { when: '2026-04-02', text: 'Inbound lead via website form' } ] }),
  m({ customerId: 'C0016', name: 'Kaleb Guidry (Industrial Thermal Services)', company: 'Industrial Thermal Services', phone: '(337) 400-1121', email: 'gracie.manuel@its-thermal.com', address: 'Sulphur, LA, USA', accountType: 'Business Member', payStatus: 'Current', industry: 'Industrial', requiresPO: true, accountNotes: 'PO required on every invoice.', stripeId: 'cus_demo016', _digest: { totalPaid: 41250, visits: 22, years: 3, avgFrequencyDays: 19, activePct: 91, firstInvoice: '2023-09-01', lastInvoice: '2026-05-28' },
      usedSalesStage: 'Not A No!', interestedCategoryIds: ['CAT011'], salesAction: 'Pitch a second excavator for Q3',
      membershipStage: 'Paid', paidUntil: '2026-12-31', paidCadence: 'Yearly', unlimitedTransport: true, paidFees: 6000,
      activityLog: [ { when: '2026-01-15', text: 'Membership renewed — Yearly, Unlimited Transport' }, { when: '2025-11-30', text: 'Payment discussed for renewal' } ] }),
  m({ customerId: 'C0033', name: 'matthew hazel (HD Services)', company: 'HD Services', phone: '(337) 304-0071', email: 'Hdservices2409@gmail.com', address: 'Sulphur, LA, USA', accountType: 'Business', payStatus: 'Partial', industry: 'Construction', requiresPO: true, accountNotes: '', stripeId: 'cus_demo033', _digest: { totalPaid: 7600, visits: 6, years: 1, avgFrequencyDays: 41, activePct: 58, firstInvoice: '2025-08-15', lastInvoice: '2026-06-07' },
      usedSalesStage: 'Payment Discussed', interestedCategoryIds: ['CAT008'], salesAction: 'Follow up on used skid-steer purchase',
      membershipStage: 'N/A',
      activityLog: [ { when: '2026-06-07', text: 'Discussed buying a used skid steer' } ] }),
  m({ customerId: 'C0008', name: 'Tucker Fontenot', company: '', phone: '(337) 905-2210', email: '', accountType: 'Non-Business', payStatus: 'Current', industry: '', requiresPO: false, accountNotes: '', stripeId: 'cus_demo008', _digest: { totalPaid: 2320, visits: 4, years: 1, avgFrequencyDays: 63, activePct: 34, firstInvoice: '2025-11-02', lastInvoice: '2026-02-20' } }),
  m({ customerId: 'C0007', name: 'Chaise Russell', company: '', phone: '(409) 781-3344', email: '', accountType: 'Non-Business', payStatus: 'Unpaid', industry: '', requiresPO: false, accountNotes: 'Outstanding balance on last delivery.', stripeId: '', _digest: { totalPaid: 990, visits: 2, years: 1, avgFrequencyDays: 88, activePct: 21, firstInvoice: '2026-01-12', lastInvoice: '2026-03-13' } }),
  m({ customerId: 'C0001', name: 'Richard Brown', company: '', phone: '(318) 560-9005', email: '', accountType: 'Non-Business', payStatus: 'New Customer', industry: '', requiresPO: false, accountNotes: '', stripeId: '', _digest: { totalPaid: 0, visits: 0, years: 0, avgFrequencyDays: 0, activePct: 0, firstInvoice: '', lastInvoice: '' } }),
];

/* ── Invoices (SPEC §7.5) — live, self-building, no Draft. Seeded so Rentals can
 *    show its Invoice pill + balance. Subtotal/balance/status derived in app. ── */
const invoices = [
  m({ invoiceId: '01i02Ju26', customerId: 'C0009', rentalIds: ['R-A'], date: '2026-06-02', dueDate: '2026-06-16', po: '', amountPaid: 1000,
      allocations: { '0:rental:R-A': 753, '1:transport:R-A': 150 },   // §19 partial split: $903 pre-tax (+$97 tax = the $1,000 paid)
      lineItems: [
        { kind: 'rental',    ref: 'R-A', label: 'Shrek — 12k Excavator (7-Day×1 + 1-Day×3)', amount: 2610 },
        { kind: 'transport', ref: 'R-A', label: 'Delivery — Orange, TX', amount: 150 },
      ] }),
  m({ invoiceId: '02i07Ju26', customerId: 'C0033', rentalIds: ['R-C'], date: '2026-06-07', dueDate: '2026-06-21', po: '', amountPaid: 0,
      lineItems: [
        { kind: 'rental',    ref: 'R-C', label: 'Dirt Dauber — Skid Steer 75hp (1-Day×2)', amount: 720 },
        { kind: 'transport', ref: 'R-C', label: 'Delivery — Sulphur, LA', amount: 90 },
      ] }),
  m({ invoiceId: '03i20Fe26', customerId: 'C0008', rentalIds: ['R-D'], date: '2026-02-20', dueDate: '2026-03-06', po: '', amountPaid: 487,
      lineItems: [
        { kind: 'rental', ref: 'R-D', label: 'Shrek — 12k Excavator (1-Day×1)', amount: 440 },
      ] }),
  m({ invoiceId: '04i13Ju26', customerId: 'C0009', rentalIds: ['R-MU'], date: '2026-06-13', dueDate: '2026-06-27', po: '', amountPaid: 1772,
      allocations: { '0:rental:R-MU': 1450, '1:transport:R-MU': 150 },   // §20 demo: Moto Moto's lines paid ($1,600 pre-tax + $172 tax = $1,772); Eileen still due
      lineItems: [
        { kind: 'rental',    ref: 'R-MU', unitId: 'U007', label: 'Moto Moto — 12k Excavator (1-Day×5)', amount: 1450 },
        { kind: 'transport', ref: 'R-MU', unitId: 'U007', label: 'Transport · Moto Moto · Delivery', amount: 150 },
        { kind: 'rental',    ref: 'R-MU', unitId: 'U023', label: 'Eileen — 8k Excavator (1-Day×5)', amount: 1250 },
        { kind: 'transport', ref: 'R-MU', unitId: 'U023', label: 'Transport · Eileen · Delivery', amount: 150 },
      ] }),
];

/* ── Rentals (SPEC §7.4) — THE reference card this slice. Source fields only;
 *    price / rate / transport cost / drive time all derived in app.js. Statuses
 *    chosen relative to "today" 2026-06-07 to exercise the full spectrum. ── */
const rentals = [
  m({ rentalId: 'R-A', customerId: 'C0009', unitId: 'U004', legacyUnitName: '', categoryId: 'CAT011', rentalName: 'Shrek — Devin Lyles', startDate: '2026-06-02', endDate: '2026-06-12', startTime: '8:00 AM', status: 'On Rent', transportType: 'Delivery', deliveryAddress: '265 Callie Ln, Orange, TX, USA', po: '', invoiceId: '01i02Ju26', startHours: 3600, returnHours: null, refunded: false, notes: '' }),
  m({ rentalId: 'R-B', customerId: 'C0016', unitId: 'U024', legacyUnitName: '', categoryId: 'CAT012', rentalName: 'Brookie — Kaleb Guidry', startDate: '2026-06-15', endDate: '2026-06-22', startTime: '9:00 AM', status: 'Reserved', transportType: 'Round-Trip', deliveryAddress: 'Lake Charles, LA, USA', po: 'PO-44821', invoiceId: null, startHours: null, returnHours: null, refunded: false, notes: 'PO on file.' }),
  m({ rentalId: 'R-C', customerId: 'C0033', unitId: 'U001', legacyUnitName: '', categoryId: 'CAT008', rentalName: 'Dirt Dauber — HD Services', startDate: '2026-06-07', endDate: '2026-06-09', startTime: '7:00 AM', status: 'Reserved', transportType: 'Delivery', deliveryAddress: 'Sulphur, LA, USA', po: '', invoiceId: '02i07Ju26', startHours: 1249, returnHours: null, refunded: false, notes: '' }),
  m({ rentalId: 'R-D', customerId: 'C0008', unitId: 'U004', legacyUnitName: '', categoryId: 'CAT011', rentalName: 'Shrek — Tucker Fontenot', startDate: '2026-02-19', endDate: '2026-02-20', startTime: '3:00 PM', status: 'Returned', transportType: 'Self', deliveryAddress: '', po: '', invoiceId: '03i20Fe26', startHours: 3500, returnHours: 3520, refunded: false, notes: '' }),
  m({ rentalId: 'R-E', customerId: 'C0001', unitId: null, legacyUnitName: '', categoryId: null, rentalName: 'New quote — Richard Brown', startDate: '', endDate: '', startTime: '', status: 'Quote', transportType: 'Self', deliveryAddress: '', po: '', invoiceId: null, startHours: null, returnHours: null, refunded: false, notes: 'Asked about a light tower for a weekend event.' }),
  m({ rentalId: 'R-F', customerId: 'C0009', unitId: 'U006', legacyUnitName: '', categoryId: 'CAT011', rentalName: 'Young (Bobcat) — Devin Lyles', startDate: '2026-06-08', endDate: '2026-06-10', startTime: '10:00 AM', status: 'Reserved', transportType: 'Delivery', deliveryAddress: 'Lake Charles, LA, USA', po: '', invoiceId: null, startHours: null, returnHours: null, refunded: false, notes: '' }),
  // §20 MULTI-UNIT DEMO — "a Rental is an EVENT": two excavators on one job, one
  // delivered (On Rent) + one still Reserved → the master gate locks to the mix,
  // each unit carries its own journey/address, and the invoice bills per unit.
  m({ rentalId: 'R-MU', customerId: 'C0009', unitId: 'U007', legacyUnitName: '', categoryId: 'CAT011', rentalName: 'Moto Moto, Eileen — Devin Lyles (multi-unit)', startDate: '2026-06-13', endDate: '2026-06-18', startTime: '8:00 AM', status: 'On Rent', transportType: 'Delivery', deliveryAddress: '1200 Ryan St, Lake Charles, LA, USA', po: '', invoiceId: '04i13Ju26', startHours: 2780, returnHours: null, refunded: false, notes: 'Two-machine job — the excavator pair went to two staging areas.',
      startCapture: { date: '2026-06-13', clock: '8:42 AM', video: '' },
      units: [
        { unitId: 'U007', status: 'On Rent', startHours: 2780, returnHours: null, startCapture: { date: '2026-06-13', clock: '8:42 AM', video: '' }, endCapture: null, fcCapture: null, transportType: 'Delivery', deliveryAddress: '1200 Ryan St, Lake Charles, LA, USA', recoveryAddress: '', sitePin: null },
        { unitId: 'U023', status: 'Reserved', startHours: null, returnHours: null, startCapture: null, endCapture: null, fcCapture: null, transportType: 'Delivery', deliveryAddress: '4500 Common St, Lake Charles, LA, USA', recoveryAddress: '', sitePin: null },
      ] }),
];

/* ── Work Orders (SPEC §7.6) — real-ish rows from work_orders.csv + the auto-WOs
 *    generated by the two Failed inspections below. ── */
const workOrders = [
  m({ woId: 'WO0001', unitId: 'U001', customerId: null, woReport: 'Track Center Calibration', woType: 'Manual', description: 'Machine drifts to the left. Calibrate track center.', phase: 'Complete', billCustomer: 'No', date: '2026-05-20', eta: '', unitHoursAtCreation: 1218, assignedMechanic: 'Cameron', laborHours: 1, lineItems: [] }),
  m({ woId: 'WO0002', unitId: 'U001', customerId: null, woReport: 'Seat', woType: 'Manual', description: 'Operator seat torn; replacement on hand.', phase: 'Part is Local', billCustomer: 'No', date: '2026-05-20', eta: '2026-06-10', unitHoursAtCreation: 1249, assignedMechanic: '', laborHours: 0.5, lineItems: [ { part: 'Skid Seat', phase: 'Part is Local', eta: '2026-06-10', hours: 0.5, cost: 220, vendor: 'Belts & Blades' } ] }),
  m({ woId: 'WO-F1', unitId: 'U003', customerId: null, woReport: 'Failed Inspection — Hydraulic Leak', woType: 'Failed', description: 'Hydraulic fluid pooling under boom. Source the leak and reseal.', phase: 'Part Needed', billCustomer: 'No', date: '2026-06-05', eta: '', unitHoursAtCreation: 3122, assignedMechanic: 'Cameron', laborHours: 0, inspectionId: 'INS-2', lineItems: [ { part: 'Hydraulic Filter', phase: 'Part Needed', eta: '', hours: 1.5, cost: 65, vendor: 'Belts & Blades' } ] }),
  m({ woId: 'WO-F2', unitId: 'U005', customerId: null, woReport: "Failed Inspection — Won't Start", woType: 'Failed', description: 'No crank. Suspect starter solenoid; part ordered.', phase: 'Part Ordered', billCustomer: 'No', date: '2026-06-03', eta: '2026-06-11', unitHoursAtCreation: 2125, assignedMechanic: '', laborHours: 0, inspectionId: 'INS-3', lineItems: [ { part: 'Starter Solenoid', phase: 'Part Ordered', eta: '2026-06-11', hours: 1, cost: 140, vendor: 'Online' } ] }),
  m({ woId: 'WO-B1', unitId: 'U004', customerId: 'C0008', woReport: 'Customer Damage — Bent Loader Arm', woType: 'Manual', description: 'Returned with bent loader arm. Straighten + reinforce. Billable.', phase: 'Complete', billCustomer: 'Yes', date: '2026-02-21', eta: '', unitHoursAtCreation: 3520, assignedMechanic: 'Cameron', laborHours: 3, lineItems: [ { part: 'Arm Reinforcement Plate', phase: 'Complete', eta: '2026-02-22', hours: 3, cost: 180, vendor: 'Belts & Blades' } ] }),
  // Dirt Dauber (U001) historical repairs (from the real export) — give it a deep, searchable history.
  m({ woId: 'WO0004', unitId: 'U001', customerId: null, woReport: 'Ignition', woType: 'Manual', description: 'Ignition has key broken in it. Removed key; ignition works.', phase: 'Complete', billCustomer: 'No', date: '2026-05-07', eta: '', unitHoursAtCreation: 1219, assignedMechanic: 'Cameron', laborHours: 0.5, lineItems: [ { part: 'Ignition Switch', phase: 'Complete', eta: '2026-05-07', hours: 0.5, cost: 20, vendor: 'Belts & Blades' } ] }),
  m({ woId: 'WO0005', unitId: 'U001', customerId: null, woReport: 'Covered in Concrete', woType: 'Manual', description: 'Unit has concrete all over it. Use acid to remove.', phase: 'Complete', billCustomer: 'No', date: '2026-05-07', eta: '', unitHoursAtCreation: 1218, assignedMechanic: 'Cameron', laborHours: 3, lineItems: [ { part: 'Concrete Dissolver', phase: 'Complete', eta: '2026-05-07', hours: 3, cost: 75, vendor: 'Belts & Blades' } ] }),
  m({ woId: 'WO0008', unitId: 'U001', customerId: null, woReport: 'Right Track Jumpy', woType: 'Manual', description: 'Track/drive motor goes full speed regardless of joystick. Replace solenoid valve.', phase: 'Complete', billCustomer: 'No', date: '2026-05-07', eta: '', unitHoursAtCreation: 1218, assignedMechanic: 'Cameron', laborHours: 1, lineItems: [ { part: 'Solenoid Valve', phase: 'Complete', eta: '2026-05-07', hours: 1, cost: 600, vendor: 'Belts & Blades' } ] }),
];

/* ── Inspections (SPEC §7.8) — created via the gated flow; read-only after.
 *    Two Fails auto-create exactly one WO each (WO-F1 / WO-F2). ── */
const inspections = [
  m({ inspectionId: 'INS-1', unitId: 'U004', date: '2026-06-01', wash: 'Yes', checklist: 'Pass', billCustomer: 'No', customerId: null, woId: null, photo: '', description: 'Full pass. Washed and staged for delivery.' }),
  m({ inspectionId: 'INS-2', unitId: 'U003', date: '2026-06-05', wash: 'No',  checklist: 'Fail', billCustomer: 'No', customerId: null, woId: 'WO-F1', photo: 'https://jacrentals.monday.com/protected_static/3980535/resources/placeholder/hyd-leak.jpg', description: 'Hydraulic fluid pooling under boom. One WO opened.' }),
  m({ inspectionId: 'INS-3', unitId: 'U005', date: '2026-06-03', wash: 'No',  checklist: 'Fail', billCustomer: 'No', customerId: null, woId: 'WO-F2', photo: 'https://jacrentals.monday.com/protected_static/3980535/resources/placeholder/no-start.jpg', description: 'No crank on start. One WO opened; starter solenoid ordered.' }),
  // Pending inspections (checklist not yet set) — the "Not Ready" queue awaiting the gated flow.
  m({ inspectionId: 'INS-4', unitId: 'U007', date: '2026-06-07', wash: 'No',  checklist: '', billCustomer: 'No', customerId: null, woId: null, photo: '', description: 'Returned from rental — awaiting wash + checklist.' }),
  m({ inspectionId: 'INS-5', unitId: 'U060', date: '2026-06-06', wash: 'No',  checklist: '', billCustomer: 'No', customerId: null, woId: null, photo: '', description: 'Pulled for inspection — awaiting checklist.' }),
];

/* ── Back-office boards (SPEC §7.9–7.12) — spreadsheet-style boards in the logo
 *    menu. Authentic rows pulled from the cleaned CSVs. ── */
const vendors = [
  m({ vendorId: 'V001', name: 'Belts & Blades',                   phone: '(337) 528-5755', email: '', address: '410 East Napoleon Street, Sulphur, LA, USA', website: '', primaryContact: '', salesTaxExempt: true,  vendorType: 'Local'  }),
  m({ vendorId: 'V002', name: 'Elite Services Recovery & Towing', phone: '(337) 707-4905', email: '', address: '2841 E Napoleon St, Sulphur, LA, USA',         website: 'www.elitewrecker.com', primaryContact: 'Shawn Vittorio', salesTaxExempt: false, vendorType: 'Local' }),
  m({ vendorId: 'V003', name: 'Delco Trailers',                   phone: '(903) 739-9400', email: '', address: 'Mount Pleasant, TX, USA',                     website: 'www.delcotrailersparts.com', primaryContact: '', salesTaxExempt: false, vendorType: 'Online' }),
  m({ vendorId: 'V004', name: 'GMG',                              phone: '(805) 222-0834', email: '', address: '', website: '', primaryContact: '', salesTaxExempt: false, vendorType: 'Online' }),
  m({ vendorId: 'V005', name: 'A&L Bolt & Screw Company',         phone: '(337) 436-4160', email: '', address: 'Lake Charles, LA, USA', website: 'https://albolts.com/', primaryContact: '', salesTaxExempt: false, vendorType: 'Local' }),
  m({ vendorId: 'V006', name: 'Amazon',                           phone: '', email: '', address: '', website: 'amazon.com', primaryContact: '', salesTaxExempt: false, vendorType: 'Online' }),
  m({ vendorId: 'V009', name: 'Beaumont Tractor',                 phone: '(409) 842-2222', email: '', address: 'Beaumont, TX, USA', website: '', primaryContact: '', salesTaxExempt: false, vendorType: 'Local' }),
  m({ vendorId: 'V011', name: 'Big Eight',                        phone: '(972) 792-8181', email: '', address: '', website: '', primaryContact: '', salesTaxExempt: false, vendorType: 'Online' }),
];
const parts = [
  m({ partId: 'P010', name: 'Hydraulic Filter',          status: 'Catalog', priceEach: 65,    qtyOnHand: 8,  website: '', orderEmail: 'parts@beltsandblades.com', productNumber: 'HF-2201', vendorId: 'V001', imageUrl: '', notes: '' }),
  m({ partId: 'P011', name: 'Starter Solenoid',          status: 'Catalog', priceEach: 140,   qtyOnHand: 2,  website: '', orderEmail: '', productNumber: 'SS-9007', vendorId: 'V006', imageUrl: '', notes: '' }),
  m({ partId: 'P012', name: 'Skid Seat',                 status: 'Catalog', priceEach: 220,   qtyOnHand: 1,  website: '', orderEmail: '', productNumber: 'ST-440',  vendorId: 'V001', imageUrl: '', notes: '' }),
  m({ partId: 'P001', name: 'Gift: Spiral Notebook',     status: 'Catalog', priceEach: 65,    qtyOnHand: 10, website: 'vistaprint.com', orderEmail: 'proadsupportna@vistaprintcorporate.com', productNumber: '5e15a3d4', vendorId: 'V006', imageUrl: '', notes: '' }),
  m({ partId: 'P007', name: '3k/7k Trailer Jacks, Bolt On', status: 'Catalog', priceEach: 87.99, qtyOnHand: 4, website: 'delcotrailersparts.com', orderEmail: '', productNumber: 'TJ-37', vendorId: 'V003', imageUrl: '', notes: 'Bolt-on style.' }),
  m({ partId: 'P009', name: '60amp Jcase Fuses',         status: 'Catalog', priceEach: 5.99,  qtyOnHand: 24, website: 'amazon.com', orderEmail: '', productNumber: 'FZ-60', vendorId: 'V006', imageUrl: '', notes: '' }),
  m({ partId: 'P013', name: 'Sign: 6ft Logo (Orange)',   status: 'Catalog', priceEach: 70,    qtyOnHand: 1,  website: 'vistaprint.com', orderEmail: '', productNumber: 'SG-6FT', vendorId: 'V006', imageUrl: '', notes: '' }),
  m({ partId: 'P014', name: 'Multipurpose Grease',       status: 'Catalog', priceEach: 12,    qtyOnHand: 30, website: '', orderEmail: '', productNumber: 'GR-MP', vendorId: 'V001', imageUrl: '', notes: 'Service consumable.' }),
  m({ partId: 'P015', name: 'Engine Oil 15W-40',         status: 'Catalog', priceEach: 28,    qtyOnHand: 18, website: '', orderEmail: '', productNumber: 'OIL-1540', vendorId: 'V001', imageUrl: '', notes: '' }),
  m({ partId: 'P016', name: 'Air Filter',                status: 'Catalog', priceEach: 34,    qtyOnHand: 9,  website: '', orderEmail: '', productNumber: 'AF-880', vendorId: 'V009', imageUrl: '', notes: '' }),
];
const companyFiles = [
  m({ fileId: 'F001', name: 'Member Rates QR Code',      group: 'Marketing', type: 'Photo',    reviewByDate: '2026-07-01', link: 'https://jacrentals.monday.com/protected_static/3980535/resources/2784614434/Member-Rates-QR.png' }),
  m({ fileId: 'F002', name: 'Hiring Website QR Code',    group: 'Marketing', type: 'Photo',    reviewByDate: '',           link: 'https://jacrentals.monday.com/protected_static/3980535/resources/2415189724/Website-QR.png' }),
  m({ fileId: 'F004', name: 'JacRentals.com QR Code',    group: 'Marketing', type: 'Photo',    reviewByDate: '',           link: 'https://jacrentals.monday.com/protected_static/3980535/resources/placeholder/site-qr.png' }),
  m({ fileId: 'F006', name: 'Albion Hurricanes Banner',  group: 'Marketing', type: 'Document', reviewByDate: '2026-06-20', link: 'https://jacrentals.monday.com/protected_static/3980535/resources/placeholder/banner.pdf' }),
  m({ fileId: 'F009', name: 'Logos & Taglines 6×6',      group: 'Marketing', type: 'Document', reviewByDate: '',           link: 'https://jacrentals.monday.com/protected_static/3980535/resources/placeholder/logos.pdf' }),
  m({ fileId: 'F020', name: 'Rental Agreement Template', group: 'Legal',     type: 'Document', reviewByDate: '2026-06-15', link: 'https://jacrentals.monday.com/protected_static/3980535/resources/placeholder/agreement.pdf' }),
  m({ fileId: 'F021', name: 'Membership Terms',          group: 'Legal',     type: 'Document', reviewByDate: '2026-09-01', link: 'https://jacrentals.monday.com/protected_static/3980535/resources/placeholder/terms.pdf' }),
  m({ fileId: 'F030', name: 'W-9 — Belts & Blades',      group: 'Vendors',   type: 'Document', reviewByDate: '',           link: 'https://jacrentals.monday.com/protected_static/3980535/resources/placeholder/w9.pdf' }),
];
const expenses = [
  m({ expenseId: 'E001', vendorId: 'V001', date: '2026-05-20', amount: 285,    reconcile: 'Reconciled',   method: 'Visa',  category: 'Parts',    woId: 'WO0008', notes: 'Solenoid valve + seat' }),
  m({ expenseId: 'E002', vendorId: 'V006', date: '2026-06-03', amount: 140,    reconcile: 'Pending',      method: 'Amex',  category: 'Parts',    woId: 'WO-F2', notes: 'Starter solenoid (Amazon)' }),
  m({ expenseId: 'E003', vendorId: 'V002', date: '2026-06-05', amount: 175,    reconcile: 'Unreconciled', method: 'Check', category: 'Service',  woId: '', notes: 'Recovery tow — Orange TX' }),
  m({ expenseId: 'E004', vendorId: 'V005', date: '2026-05-28', amount: 64.2,   reconcile: 'Reconciled',   method: 'Cash',  category: 'Supplies', woId: '', notes: 'Bolts & hardware' }),
  m({ expenseId: 'E005', vendorId: 'V006', date: '2026-06-01', amount: 412.5,  reconcile: 'Pending',      method: 'Amex',  category: 'Fuel',     woId: '', notes: 'Diesel — fleet' }),
  m({ expenseId: 'E006', vendorId: 'V003', date: '2026-04-18', amount: 351.96, reconcile: 'Reconciled',   method: 'ACH',   category: 'Parts',    woId: '', notes: 'Trailer jacks ×4' }),
];

/* ── Export the data store in the exact shape cascade.js / app.js expect ──── */
export const DATA = {
  categories, units, customers, invoices, rentals, workOrders, inspections,
  vendors, parts, companyFiles, expenses,
};
export default DATA;
