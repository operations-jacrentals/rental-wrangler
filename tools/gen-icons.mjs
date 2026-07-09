/**
 * tools/gen-icons.mjs — regenerate icons.js from the Lucide icon library.
 * ---------------------------------------------------------------------------
 * Rental Wrangler has NO build step (modules are served as-is by GitHub Pages)
 * and must run offline (demo mode), so icons can't be a runtime CDN dependency.
 * Instead every GENERIC glyph is vendored VERBATIM from Lucide (ISC license,
 * https://lucide.dev) at the pinned version below and written into icons.js as
 * an inline SVG string (currentColor, viewBox 0 0 24 24) — never hand-drawn.
 *
 * To add or change a generic icon: add a name -> lucide-icon-name entry to the
 * LUCIDE maps and run `node tools/gen-icons.mjs`. NEVER author generic <path>
 * data by hand. A handful of bespoke brand/ranch marks that have no clean
 * Lucide equivalent (the steel logo, horseshoe, hardhat, the excavator, the
 * gate-timeline status glyphs) are kept in CUSTOM and emitted verbatim.
 *
 * Run:  node tools/gen-icons.mjs            (writes icons.js)
 *       node tools/gen-icons.mjs --check    (fails if icons.js is stale)
 * Requires network access (dev-time only) to fetch the pinned Lucide source.
 */
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const VERSION = '1.21.0';
const CDN = (name) => `https://cdn.jsdelivr.net/npm/lucide-static@${VERSION}/icons/${name}.svg`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'icons.js');

// ── name in our code  ->  Lucide icon name (verbatim source) ──────────────
const LUCIDE = {
  I: {
    plus: 'plus', search: 'search', x: 'x', filter: 'filter', grid: 'layout-grid',
    truck: 'truck', back: 'chevron-left', list: 'list', sun: 'sun', moon: 'moon',
    qr: 'qr-code', mouse: 'mouse', video: 'video', camera: 'camera', droplet: 'droplet',
    table: 'table', graph: 'chart-column', sliders: 'sliders-horizontal', inbox: 'inbox',
    bell: 'bell', alert: 'triangle-alert', eye: 'eye', eyeOff: 'eye-off', feedback: 'message-square-text',
    box: 'box', doc: 'file', copy: 'copy', lock: 'lock', lockOpen: 'lock-open',
    chevL: 'chevron-left', chevR: 'chevron-right', chat: 'message-circle',
    linkOut: 'external-link',
    // D8 comms-rail toolbar chips (Team · Texts · Email · Mr. Wrangler)
    users: 'users', messageSquare: 'message-square', mail: 'mail', lasso: 'lasso',
  },
  CARD_ICON: {
    customers: 'user', rentals: 'calendar', categories: 'tag', invoices: 'receipt',
    workOrders: 'wrench', serviceOrders: 'heart', inspections: 'clipboard-check',
    shop: 'hammer', parts: 'package', vendors: 'store', expenses: 'receipt-text',
    files: 'folder',
  },
  RING_ICON: { driver: 'truck', office: 'building', sales: 'trending-up' },
  // Per-category unit glyphs — keyword-resolved by categoryIconFor() in app.js.
  // Families cover the ~50 real fleet categories (Fleet_Categories rate sheet), not
  // just the 5-record demo seed — see docs/handoffs or ask Jac for the source sheet.
  CATEGORY_ICON: {
    attachment: 'puzzle', generator: 'zap', compressor: 'wind',
    pump: 'droplet', truck: 'truck', tractor: 'tractor',
    fuel: 'fuel', heater: 'flame',
    box: 'box',
  },
};

// ── bespoke marks kept verbatim (no clean Lucide equivalent / styling hook) ──
const CUSTOM = {
  I: {
    circle: `'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="5"/><rect x="9.3" y="9.3" width="5.4" height="5.4" rx="1.6" fill="currentColor" stroke="none"/></svg>'`,
    mark: `'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l5-12 4 8 3-5 6 9z"/></svg>'`,
    hardhat: `'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 18a9 9 0 0 1 18 0z"/><path d="M2 18h20"/><path d="M10 9V6a2 2 0 0 1 2-2 2 2 0 0 1 2 2v3"/><path d="M5 14V12M19 14V12"/></svg>'`,
    horseshoe: `'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5C3.5 6 3 11 5 15.5 6.2 18.3 9 20 12 20s5.8-1.7 7-4.5C21 11 20.5 6 17 3.5"/><path d="M6.5 19.5l-.5 1.5M17.5 19.5l.5 1.5"/></svg>'`,
    bluesteel: `'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><circle cx="6.4" cy="6.5" r=".7" fill="currentColor" stroke="none"/><circle cx="17.6" cy="6.5" r=".7" fill="currentColor" stroke="none"/></svg>'`,
    // chevron-down, but carries class="chev" (CSS sizes/rotates it) — keep wrapper.
    chev: `'<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>'`,
  },
  CARD_ICON: {
    // Tabler "backhoe" (MIT) — Lucide has no excavator. (Jac, 2026-07-03: was on
    // `categories` — swapped onto `units` because a literal machine glyph reads as
    // "a unit", not "a category"; `categories` now uses the Lucide tag/label glyph.)
    units: `ico('<path d="M2 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M11 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M13 19h-9"/><path d="M4 15h9"/><path d="M8 12v-5h2a3 3 0 0 1 3 3v5"/><path d="M5 15v-2a1 1 0 0 1 1 -1h7"/><path d="M21.12 9.88l-3.12 -4.88l-5 5"/><path d="M21.12 9.88a3 3 0 0 1 -2.12 5.12a3 3 0 0 1 -2.12 -.88l4.24 -4.24"/>')`,
    // clipboard-question — not in Lucide; bespoke clipboard + "?".
    inspectionsPending: `ico('<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M10 12.3a2 2 0 1 1 2.7 1.9c-.6.3-1 .7-1 1.4"/><path d="M11.7 17.8h.01"/>')`,
  },
  RING_ICON: {
    mechanic: `CARD_ICON.workOrders`,
    mtech: `ico('<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1Z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a6 6 0 0 1 6-6"/><path d="M14 6a6 6 0 0 1 6 6v3"/>')`,
  },
  CATEGORY_ICON: {
    // excavator / backhoe family reuses the vendored Tabler backhoe (now on CARD_ICON.units).
    excavator: `CARD_ICON.units`,
    // ── round-2 bespoke machines (Jac, 2026-07-04: every library pick for these was
    // rejected — no icon set draws real rental equipment; simple computed geometry,
    // same precedent as the sawblade/scissor) ──
    dozer: `ico('<path d="M2 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M12 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M19 13v4a2 2 0 0 0 2 2h1"/><path d="M14 19h-10"/><path d="M4 15h10"/><path d="M9 11v-5h2a3 3 0 0 1 3 3v6"/><path d="M5 15v-3a1 1 0 0 1 1 -1h8"/><path d="M19 17h-3"/>')`,
    roller: `ico('<circle cx="6.4" cy="15.8" r="3.2"/><path d="M6.4 15.8h.01"/><circle cx="17.6" cy="15.8" r="3.2"/><path d="M17.6 15.8h.01"/><rect x="3.2" y="8.5" width="17.6" height="4.5" rx="1"/><path d="M15 8.5 17 4"/><path d="M15.5 4h3.5"/>')`,
    tamper: `ico('<path d="M4.5 3 9 11"/><path d="M3 4.5 6 2.5"/><rect x="8" y="10" width="8" height="5" rx="1"/><path d="M6.5 18.5 8 15h8l1.5 3.5z"/><path d="M8.5 21.5h2"/><path d="M13.5 21.5h2"/>')`,
    // engine box + tracked undercarriage with tread lugs + toothed chain blade
    // (Jac's machine-trio reference, 2026-07-07: comb teeth reading as an actual
    // saw-toothed digging chain, not the earlier ladder-rung crossbar attempt)
    trencher: `ico('<rect x="4.5" y="6" width="7" height="7" rx="1.2"/><path d="M2.3 15.8a2.7 2.7 0 0 1 2.7 -2.7h7.5a2.7 2.7 0 0 1 2.7 2.7 2.7 2.7 0 0 1 -2.7 2.7h-7.5a2.7 2.7 0 0 1 -2.7 -2.7z"/><path d="M5 17.3v-3"/><path d="M8 17.3v-3"/><path d="M11 17.3v-3"/><circle cx="11.7" cy="12" r="1.1"/><path d="M12.6 12.5 20.3 15.9"/><path d="M13.88 13.07 14.73 11.15"/><path d="M16.45 14.2 17.3 12.28"/><path d="M19.02 15.33 19.86 13.41"/>')`,
    telehandler: `ico('<rect x="4" y="12.5" width="13.5" height="4" rx="1"/><circle cx="7.5" cy="18.6" r="2.1"/><circle cx="15" cy="18.6" r="2.1"/><path d="M17 12.5 6.5 4.8"/><path d="M17 12.5 11.5 8.4"/><path d="M6.5 4.8 6.5 8 3 8"/>')`,
    towablelift: `ico('<path d="M2 18h3.5"/><path d="M5.5 18h9.5"/><circle cx="10" cy="20" r="1.8"/><path d="M6.5 18 4.8 21.3"/><path d="M13.8 18 15.5 21.3"/><path d="M13 18 10.2 10 16 6.3"/><path d="M10.2 10h.01"/><rect x="15.3" y="3" width="6" height="4" rx=".5"/>')`,
    // Tabler "bulldozer" (MIT) — Lucide has no skid-steer/loader/dozer equivalent.
    skidsteer: `ico('<path d="M2 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M12 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M19 13v4a2 2 0 0 0 2 2h1"/><path d="M14 19h-10"/><path d="M4 15h10"/><path d="M9 11v-5h2a3 3 0 0 1 3 3v6"/><path d="M5 15v-3a1 1 0 0 1 1 -1h8"/><path d="M19 17h-3"/>')`,
    // Tabler "crane" (MIT) — Lucide's forklift read as a warehouse lift, not a boom/scissor/towable lift.
    lift: `ico('<path d="M6 21h6"/><path d="M9 21v-18l-6 6h18"/><path d="M9 3l10 6"/><path d="M17 9v4a2 2 0 1 1 -2 2"/>')`,
    // bespoke scissor lift (Jac, 2026-07-03: a scissor lift is not a boom lift) —
    // platform / X-frame / base+wheels, simple geometry like the sawblade precedent.
    scissor: `ico('<rect x="3" y="3" width="18" height="4" rx="1"/><path d="m5 7 14 9"/><path d="m19 7-14 9"/><path d="M4 16h16"/><circle cx="7.5" cy="20" r="1.6"/><circle cx="16.5" cy="20" r="1.6"/>')`,
    // bespoke utility trailer (Jac reference art, 2026-07-06 — the caravan read as a camper).
    trailer: `ico('<path d="M2 13.5h4"/><path d="M3.5 13.5v3"/><path d="M2.5 16.5h2"/><path d="M6 13.5h1.5"/><rect x="7.5" y="9.5" width="14" height="6" rx="1"/><circle cx="11.5" cy="17.7" r="2"/><circle cx="16.5" cy="17.7" r="2"/><path d="M7.5 15.5h1.8"/><path d="M18.7 15.5h2.8"/>')`,
    // bespoke dump trailer + light tower (Jac reference art, 2026-07-06)
    dumptrailer: `ico('<path d="M2 16.5H6.5"/><path d="M2.5 16.5V18.3"/><path d="M6.5 16.5H17"/><path d="M14.78 15.95L11.07 4.95L13.85 3.99L17.64 15.04L14.78 15.95Z"/><path d="M13.5 15.5L16.1 12.1"/><path d="M10.5 20.6C11.55 20.6 12.4 19.75 12.4 18.7C12.4 17.65 11.55 16.8 10.5 16.8C9.45 16.8 8.6 17.65 8.6 18.7C8.6 19.75 9.45 20.6 10.5 20.6Z"/><path d="M15 20.6C16.05 20.6 16.9 19.75 16.9 18.7C16.9 17.65 16.05 16.8 15 16.8C13.95 16.8 13.1 17.65 13.1 18.7C13.1 19.75 13.95 20.6 15 20.6Z"/>')`,
    tower: `ico('<path d="M6.2 2H3C2.72 2 2.5 2.22 2.5 2.5V4.9C2.5 5.18 2.72 5.4 3 5.4H6.2C6.48 5.4 6.7 5.18 6.7 4.9V2.5C6.7 2.22 6.48 2 6.2 2Z"/><path d="M12 2H8.8C8.52 2 8.3 2.22 8.3 2.5V4.9C8.3 5.18 8.52 5.4 8.8 5.4H12C12.28 5.4 12.5 5.18 12.5 4.9V2.5C12.5 2.22 12.28 2 12 2Z"/><path d="M6.2 7H3C2.72 7 2.5 7.22 2.5 7.5V9.9C2.5 10.18 2.72 10.4 3 10.4H6.2C6.48 10.4 6.7 10.18 6.7 9.9V7.5C6.7 7.22 6.48 7 6.2 7Z"/><path d="M12 7H8.8C8.52 7 8.3 7.22 8.3 7.5V9.9C8.3 10.18 8.52 10.4 8.8 10.4H12C12.28 10.4 12.5 10.18 12.5 9.9V7.5C12.5 7.22 12.28 7 12 7Z"/><path d="M7.5 10.5V21.75"/><path d="M11 18V15.3C11 14.82 11.19 14.36 11.53 14.03C11.86 13.69 12.32 13.5 12.8 13.5H18.2C18.5 13.5 18.8 13.56 19.08 13.68C19.36 13.79 19.61 13.96 19.83 14.17C20.04 14.39 20.21 14.64 20.32 14.92C20.44 15.2 20.5 15.5 20.5 15.8V18"/><path d="M2 18H21"/><path d="M17 21.9C18.05 21.9 18.9 21.05 18.9 20C18.9 18.95 18.05 18.1 17 18.1C15.95 18.1 15.1 18.95 15.1 20C15.1 21.05 15.95 21.9 17 21.9Z"/>')`,
    // bespoke concrete power buggy (Jac, 2026-07-04: the garden-cart/wheelbarrow was rejected).
    buggy: `ico('<path d="M8.62 4.58L14.6 9.89L10.95 14C10.33 14.7 9.46 15.12 8.54 15.17C7.61 15.23 6.7 14.91 6.01 14.29L2.64 11.3L8.62 4.58Z"/><path d="M2.31 11.68L9.62 3.46"/><path d="M13.75 11H18.25C19.05 11 19.81 11.32 20.37 11.88C20.93 12.44 21.25 13.2 21.25 14V15.5"/><path d="M19.88 14.63V12.28L21.38 10.88"/><path d="M4.88 17.81C4.88 17.27 5.28 16.74 6 16.35C6.72 15.97 7.7 15.75 8.72 15.75H19.4C20.42 15.75 21.4 15.97 22.12 16.35C22.84 16.74 23.25 17.27 23.25 17.81C23.25 18.36 22.84 18.88 22.12 19.27C21.4 19.66 20.42 19.88 19.4 19.88H8.72C7.7 19.88 6.72 19.66 6 19.27C5.28 18.88 4.88 18.36 4.88 17.81Z"/><path d="M11.81 18.38C12.12 18.38 12.38 18.12 12.38 17.81C12.38 17.5 12.12 17.25 11.81 17.25C11.5 17.25 11.25 17.5 11.25 17.81C11.25 18.12 11.5 18.38 11.81 18.38Z"/><path d="M7.31 18.38C7.62 18.38 7.88 18.12 7.88 17.81C7.88 17.5 7.62 17.25 7.31 17.25C7 17.25 6.75 17.5 6.75 17.81C6.75 18.12 7 18.38 7.31 18.38Z"/><path d="M16.31 18.38C16.62 18.38 16.88 18.12 16.88 17.81C16.88 17.5 16.62 17.25 16.31 17.25C16 17.25 15.75 17.5 15.75 17.81C15.75 18.12 16 18.38 16.31 18.38Z"/><path d="M20.81 18.38C21.12 18.38 21.38 18.12 21.38 17.81C21.38 17.5 21.12 17.25 20.81 17.25C20.5 17.25 20.25 17.5 20.25 17.81C20.25 18.12 20.5 18.38 20.81 18.38Z"/>')`,
    // Tabler "hammer" (MIT, Jac 2026-07-03) — distinct path from Lucide's hammer already on CARD_ICON.shop,
    // so the small-tool catch-all doesn't collide with the Shop card's glyph.
    saw: `ico('<path d="M9.00,11.52L16.67,3.85c1.13-1.13,2.97-1.13,4.11,0.00l0.00,0.00c1.13,1.13,1.13,2.97,0.00,4.11L13.12,15.62"/><path d="M6.77,21.95c-1.20,1.00-2.99,0.94-4.12-0.19L0.70,19.82l2.03-2.03"/><path d="M7.68,10.34l6.05,6.05L7.58,22.55l-4.63-4.63c-0.78-0.78-0.78-2.05,0.00-2.83L7.68,10.34z"/><path d="M8.64,15.44l-3.82-3.82c-0.72-0.72-1.88-0.72-2.60,0.00l0.00,0.00c-0.72,0.72-0.72,1.88,0.00,2.60l0.80,0.80"/><path d="M17.74,6.89L11.35,13.28"/><path d="M21.96 2.67L20.79 3.84"/><path d="M18.74 1.34L18.74 2.99"/><path d="M15.51 2.67L16.68 3.84"/><path d="M21.96 9.12L20.79 7.95"/><path d="M12.94 5.24L14.11 6.41"/><path d="M19.39 11.69L18.22 10.52"/><path d="M10.38 7.81L11.55 8.98"/><path d="M16.83 14.26L15.66 13.09"/><path d="M23.30 5.90L21.64 5.90"/>')`,
    // Bespoke sawblade (Jac 2026-07-03): no Lucide/Tabler icon is a literal serrated cutting disc, so this is
    // computed geometry (9 teeth via trig, r=9.2 peak / r=7.0 valley, viewBox 0 0 24 24) rather than hand-drawn
    // freeform art — distinct from the "cog" settings-gear glyph it replaced.
    grinder: `ico('<path d="M9.16 12.75H5.46C4.93 12.75 4.5 12.92 4.5 13.14V14.61C4.5 14.83 4.93 15 5.46 15H9.16C9.69 15 10.13 14.83 10.13 14.61V13.14C10.13 12.92 9.69 12.75 9.16 12.75Z"/><path d="M3.38 17.81C3.38 17.27 3.59 16.74 3.97 16.35C4.36 15.97 4.87 15.75 5.42 15.75H11.08C11.63 15.75 12.14 15.97 12.53 16.35C12.91 16.74 13.13 17.27 13.13 17.81C13.13 18.36 12.91 18.88 12.53 19.27C12.14 19.66 11.63 19.88 11.08 19.88H5.42C4.87 19.88 4.36 19.66 3.97 19.27C3.59 18.88 3.38 18.36 3.38 17.81Z"/><path d="M11.06 14.25C11.37 14.25 11.63 14 11.63 13.69C11.63 13.38 11.37 13.13 11.06 13.13C10.75 13.13 10.5 13.38 10.5 13.69C10.5 14 10.75 14.25 11.06 14.25Z"/><path d="M5.63 18.38C5.83 18.38 6 18.12 6 17.81C6 17.5 5.83 17.25 5.63 17.25C5.42 17.25 5.25 17.5 5.25 17.81C5.25 18.12 5.42 18.38 5.63 18.38Z"/><path d="M8.25 18.38C8.46 18.38 8.63 18.12 8.63 17.81C8.63 17.5 8.46 17.25 8.25 17.25C8.04 17.25 7.88 17.5 7.88 17.81C7.88 18.12 8.04 18.38 8.25 18.38Z"/><path d="M10.88 18.38C11.08 18.38 11.25 18.12 11.25 17.81C11.25 17.5 11.08 17.25 10.88 17.25C10.67 17.25 10.5 17.5 10.5 17.81C10.5 18.12 10.67 18.38 10.88 18.38Z"/><path d="M10.64 13.06C10.16 13.25 9.9 13.85 10.07 14.41C10.24 14.96 10.78 15.26 11.26 15.08L10.95 14.07L10.64 13.06ZM14.15 13.98C14.63 13.8 14.89 13.2 14.72 12.64C14.55 12.08 14.01 11.78 13.53 11.97L13.84 12.97L14.15 13.98ZM10.95 14.07L11.26 15.08L14.15 13.98L13.84 12.97L13.53 11.97L10.64 13.06L10.95 14.07Z"/><path d="M10.98 13.37C10.49 13.55 10.24 14.15 10.41 14.71C10.58 15.27 11.11 15.57 11.6 15.38L11.29 14.37L10.98 13.37ZM14.48 14.28C14.97 14.1 15.23 13.5 15.05 12.94C14.88 12.39 14.35 12.09 13.86 12.27L14.17 13.28L14.48 14.28ZM11.29 14.37L11.6 15.38L14.48 14.28L14.17 13.28L13.86 12.27L10.98 13.37L11.29 14.37Z"/><path d="M5.83 11.08C5.77 10.51 5.31 10.13 4.78 10.22C4.25 10.32 3.87 10.85 3.92 11.42L4.88 11.25L5.83 11.08ZM4.3 15.53C4.36 16.09 4.83 16.48 5.35 16.38C5.88 16.29 6.26 15.75 6.21 15.18L5.26 15.36L4.3 15.53ZM4.88 11.25L3.92 11.42L4.3 15.53L5.26 15.36L6.21 15.18L5.83 11.08L4.88 11.25Z"/><path d="M18.75 12.19L17.64 12.97L18.14 14.16L16.8 14.11L16.54 15.38L15.49 14.51L14.58 15.38L14.21 14.03L12.99 14.16L13.44 12.84L12.38 12.19L13.48 11.4L12.99 10.22L14.32 10.27L14.58 9L15.63 9.86L16.54 9L16.92 10.35L18.14 10.22L17.68 11.54L18.75 12.19ZM16.31 12.19C16.31 11.98 16.23 11.78 16.09 11.63C15.95 11.48 15.76 11.4 15.56 11.4C15.36 11.4 15.17 11.48 15.03 11.63C14.89 11.78 14.81 11.98 14.81 12.19C14.81 12.4 14.89 12.6 15.03 12.74C15.17 12.89 15.36 12.97 15.56 12.97C15.76 12.97 15.95 12.89 16.09 12.74C16.23 12.6 16.31 12.4 16.31 12.19Z"/>')`,
  },
};

// Emission order per object (keeps the generated file diff-stable).
const ORDER = {
  I: ['circle', 'plus', 'search', 'x', 'filter', 'grid', 'truck', 'back', 'list', 'mark',
      'sun', 'moon', 'hardhat', 'horseshoe', 'bluesteel', 'qr', 'mouse', 'video', 'camera',
      'droplet', 'table', 'graph', 'sliders', 'inbox', 'bell', 'alert', 'eye', 'eyeOff', 'feedback',
      'box', 'doc', 'copy', 'lock', 'lockOpen', 'chev', 'chevL', 'chevR', 'chat', 'linkOut',
      'users', 'messageSquare', 'mail', 'lasso'],
  CARD_ICON: ['customers', 'rentals', 'categories', 'units', 'invoices', 'workOrders',
      'serviceOrders', 'inspections', 'inspectionsPending', 'shop', 'parts', 'vendors',
      'expenses', 'files'],
  RING_ICON: ['mechanic', 'mtech', 'driver', 'office', 'sales'],
  CATEGORY_ICON: ['excavator', 'skidsteer', 'dozer', 'lift', 'scissor', 'telehandler', 'towablelift', 'attachment', 'roller', 'tamper', 'trencher',
    'grinder', 'buggy', 'generator', 'compressor', 'pump', 'truck', 'tractor', 'trailer', 'dumptrailer',
    'fuel', 'heater', 'tower', 'saw', 'box'],
};

async function fetchInner(lucideName) {
  const res = await fetch(CDN(lucideName));
  if (!res.ok) throw new Error(`Lucide "${lucideName}" -> HTTP ${res.status} (${CDN(lucideName)})`);
  const svg = await res.text();
  const m = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!m) throw new Error(`Could not parse <svg> for "${lucideName}"`);
  return m[1].replace(/\s*\n\s*/g, '').replace(/\s+\/>/g, '/>').trim();
}

async function buildEntry(obj, key) {
  if (CUSTOM[obj]?.[key] != null) return CUSTOM[obj][key];        // verbatim literal / ref
  const lucideName = LUCIDE[obj]?.[key];
  if (!lucideName) throw new Error(`No mapping for ${obj}.${key}`);
  return `ico('${await fetchInner(lucideName)}')`;
}

async function buildObject(name) {
  const lines = [];
  let mode = '';
  for (const key of ORDER[name]) {
    const isCustom = CUSTOM[name]?.[key] != null;
    const tag = isCustom ? 'custom' : 'lucide';
    if (tag !== mode) { lines.push(`  // ── ${tag === 'lucide' ? 'Lucide ' + VERSION + ' (verbatim)' : 'bespoke marks (kept)'} ──`); mode = tag; }
    lines.push(`  ${key}: ${await buildEntry(name, key)},`);
  }
  return `export const ${name} = {\n${lines.join('\n')}\n};`;
}

async function main() {
  const I = await buildObject('I');
  const CARD = await buildObject('CARD_ICON');
  const RING = await buildObject('RING_ICON');
  const CAT = await buildObject('CATEGORY_ICON');
  const out = `/**
 * icons.js — the icon registry (AUTO-GENERATED for generic glyphs).
 * ---------------------------------------------------------------------------
 * Generic glyphs are vendored VERBATIM from Lucide ${VERSION} (ISC,
 * https://lucide.dev); the bespoke brand/ranch marks (steel logo, horseshoe,
 * hardhat, the Tabler excavator, etc.) are kept by design. DO NOT hand-author
 * generic <path> data here — edit the maps in tools/gen-icons.mjs and run
 * \`node tools/gen-icons.mjs\` to regenerate. The gate-timeline status glyphs
 * (GATE_ICON) live in app.js and are intentionally bespoke.
 */
export const ico = (p) => \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\${p}</svg>\`;

${I}

${CARD}

${RING}

${CAT}
`;
  if (process.argv.includes('--check')) {
    let cur = '';
    try { cur = await readFile(OUT, 'utf8'); } catch {}
    if (cur !== out) { console.error('✗ icons.js is stale — run `node tools/gen-icons.mjs`.'); process.exit(1); }
    console.log('✓ icons.js is current.');
    return;
  }
  await writeFile(OUT, out);
  console.log(`✓ wrote icons.js (Lucide ${VERSION}).`);
}

main().catch((e) => { console.error('gen-icons failed:', e.message); process.exit(1); });
