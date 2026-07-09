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
    // excavator: bespoke Figma-drawn art (Jac, 2026-07-09) — no longer aliases
    // CARD_ICON.units (the two now have genuinely different art; CARD_ICON.units
    // still uses the vendored Tabler backhoe for the Units nav icon elsewhere).
    excavator: `ico('<path d="M2.59 18.41C2.21 18.04 2 17.53 2 17C2 16.47 2.21 15.96 2.59 15.59C2.96 15.21 3.47 15 4 15C4.53 15 5.04 15.21 5.41 15.59C5.79 15.96 6 16.47 6 17C6 17.53 5.79 18.04 5.41 18.41C5.04 18.79 4.53 19 4 19C3.47 19 2.96 18.79 2.59 18.41Z"/><path d="M11 17C11 17.53 11.21 18.04 11.59 18.41C11.96 18.79 12.47 19 13 19C13.53 19 14.04 18.79 14.41 18.41C14.79 18.04 15 17.53 15 17C15 16.47 14.79 15.96 14.41 15.59C14.04 15.21 13.53 15 13 15C12.47 15 11.96 15.21 11.59 15.59C11.21 15.96 11 16.47 11 17Z"/><path d="M13 19H4"/><path d="M4 15H13"/><path d="M8 12V7H10C10.8 7 11.56 7.32 12.12 7.88C12.68 8.44 13 9.2 13 10V15"/><path d="M5 15V13C5 12.73 5.11 12.48 5.29 12.29C5.48 12.11 5.73 12 6 12H13"/><path d="M20.25 9.63L17.51 4.88L13.13 9.75"/><path d="M21.58 10.52C21.09 10.18 20.52 10 19.92 9.98L19.82 15.98C20.62 15.99 21.39 15.69 21.96 15.14C22.38 14.73 22.68 14.2 22.8 13.62C22.93 13.04 22.88 12.43 22.66 11.88C22.44 11.33 22.07 10.86 21.58 10.52Z"/>')`,
    // ── round-2 bespoke machines (Jac, 2026-07-04: every library pick for these was
    // rejected — no icon set draws real rental equipment; simple computed geometry,
    // same precedent as the sawblade/scissor). dozer/roller redrawn 2026-07-09 to
    // match Jac's Figma frame-1 art (see icons-frames.js for the hover sprite) ──
    dozer: `ico('<path d="M2.59 18.41C2.21 18.04 2 17.53 2 17C2 16.47 2.21 15.96 2.59 15.59C2.96 15.21 3.47 15 4 15C4.53 15 5.04 15.21 5.41 15.59C5.79 15.96 6 16.47 6 17C6 17.53 5.79 18.04 5.41 18.41C5.04 18.79 4.53 19 4 19C3.47 19 2.96 18.79 2.59 18.41Z"/><path d="M12 17C12 17.53 12.21 18.04 12.59 18.41C12.96 18.79 13.47 19 14 19C14.53 19 15.04 18.79 15.41 18.41C15.79 18.04 16 17.53 16 17C16 16.47 15.79 15.96 15.41 15.59C15.04 15.21 14.53 15 14 15C13.47 15 12.96 15.21 12.59 15.59C12.21 15.96 12 16.47 12 17Z"/><path d="M19 13V17C19 17.53 19.21 18.04 19.59 18.41C19.96 18.79 20.47 19 21 19H22"/><path d="M14 19H4"/><path d="M4 15H14"/><path d="M9 11V6H11C11.8 6 12.56 6.32 13.12 6.88C13.68 7.44 14 8.2 14 9V15"/><path d="M5 15V12C5 11.73 5.11 11.48 5.29 11.29C5.48 11.11 5.73 11 6 11H14"/><path d="M19 17H16"/>')`,
    roller: `ico('<path d="M6.4 19C8.17 19 9.6 17.57 9.6 15.8C9.6 14.03 8.17 12.6 6.4 12.6C4.63 12.6 3.2 14.03 3.2 15.8C3.2 17.57 4.63 19 6.4 19Z"/><path d="M6.4 15.8H6.41"/><path d="M17.6 19C19.37 19 20.8 17.57 20.8 15.8C20.8 14.03 19.37 12.6 17.6 12.6C15.83 12.6 14.4 14.03 14.4 15.8C14.4 17.57 15.83 19 17.6 19Z"/><path d="M17.6 15.8H17.61"/><path d="M15.63 10.88H7.99C7.72 10.88 7.5 11.06 7.5 11.29V12.33C7.5 12.56 7.72 12.75 7.99 12.75H15.63C15.91 12.75 16.13 12.56 16.13 12.33V11.29C16.13 11.06 15.91 10.88 15.63 10.88Z"/><path d="M16.99 14.63H7.01C6.66 14.63 6.38 14.77 6.38 14.96V15.79C6.38 15.98 6.66 16.13 7.01 16.13H16.99C17.34 16.13 17.63 15.98 17.63 15.79V14.96C17.63 14.77 17.34 14.63 16.99 14.63Z"/><path d="M16.41 12.75L16.5 5.63"/><path d="M7.5 12.38V8.25"/><path d="M9 12.38V8.25"/><path d="M7.5 8.25H9"/>')`,
    tamper: `ico('<path d="M4.5 3 9 11"/><path d="M3 4.5 6 2.5"/><rect x="8" y="10" width="8" height="5" rx="1"/><path d="M6.5 18.5 8 15h8l1.5 3.5z"/><path d="M8.5 21.5h2"/><path d="M13.5 21.5h2"/>')`,
    // engine box + tracked undercarriage with tread lugs + toothed chain blade
    // (Jac's Figma frame-1 art, 2026-07-09 — see icons-frames.js for the hover sprite)
    trencher: `ico('<path d="M9.16 12.75H5.46C4.93 12.75 4.5 12.92 4.5 13.14V14.61C4.5 14.83 4.93 15 5.46 15H9.16C9.69 15 10.13 14.83 10.13 14.61V13.14C10.13 12.92 9.69 12.75 9.16 12.75Z"/><path d="M2.63 17.81C2.63 17.27 2.86 16.74 3.29 16.35C3.72 15.97 4.3 15.75 4.9 15.75H11.22C11.83 15.75 12.41 15.97 12.83 16.35C13.26 16.74 13.5 17.27 13.5 17.81C13.5 18.36 13.26 18.88 12.83 19.27C12.41 19.66 11.83 19.88 11.22 19.88H4.9C4.3 19.88 3.72 19.66 3.29 19.27C2.86 18.88 2.63 18.36 2.63 17.81Z"/><path d="M11.06 14.25C11.37 14.25 11.63 14 11.63 13.69C11.63 13.38 11.37 13.13 11.06 13.13C10.75 13.13 10.5 13.38 10.5 13.69C10.5 14 10.75 14.25 11.06 14.25Z"/><path d="M5.63 18.38C5.83 18.38 6 18.12 6 17.81C6 17.5 5.83 17.25 5.63 17.25C5.42 17.25 5.25 17.5 5.25 17.81C5.25 18.12 5.42 18.38 5.63 18.38Z"/><path d="M8.25 18.38C8.46 18.38 8.63 18.12 8.63 17.81C8.63 17.5 8.46 17.25 8.25 17.25C8.04 17.25 7.88 17.5 7.88 17.81C7.88 18.12 8.04 18.38 8.25 18.38Z"/><path d="M10.88 18.38C11.08 18.38 11.25 18.12 11.25 17.81C11.25 17.5 11.08 17.25 10.88 17.25C10.67 17.25 10.5 17.5 10.5 17.81C10.5 18.12 10.67 18.38 10.88 18.38Z"/><path d="M12.61 11.79C12.11 11.97 11.83 12.57 11.97 13.12C12.11 13.68 12.63 13.98 13.13 13.8L12.87 12.79L12.61 11.79ZM20.38 11.12C20.88 10.94 21.17 10.34 21.02 9.78C20.88 9.22 20.36 8.92 19.86 9.11L20.12 10.11L20.38 11.12ZM12.87 12.79L13.13 13.8L20.38 11.12L20.12 10.11L19.86 9.11L12.61 11.79L12.87 12.79Z"/><path d="M6.14 10.02C6.14 9.45 5.7 9.02 5.17 9.07C4.64 9.11 4.22 9.62 4.23 10.19L5.19 10.11L6.14 10.02ZM4.3 15.44C4.31 16.01 4.74 16.44 5.27 16.39C5.8 16.35 6.22 15.85 6.21 15.27L5.26 15.36L4.3 15.44ZM5.19 10.11L4.23 10.19L4.3 15.44L5.26 15.36L6.21 15.27L6.14 10.02L5.19 10.11Z"/><path d="M18.75 12.38L20.63 8.63"/><path d="M16.88 12.75L18.75 9"/><path d="M15.75 13.13L17.63 9.75"/><path d="M13.88 13.88L15.75 10.13"/><path d="M12.75 13.88L13.88 10.5"/><path d="M21.41 9.94C21.6 9.89 21.71 9.67 21.66 9.46C21.62 9.24 21.43 9.11 21.24 9.17L21.33 9.56L21.41 9.94ZM17.91 10.14C17.72 10.2 17.61 10.41 17.65 10.63C17.7 10.84 17.89 10.97 18.08 10.91L17.99 10.53L17.91 10.14ZM21.33 9.56L21.24 9.17L17.91 10.14L17.99 10.53L18.08 10.91L21.41 9.94L21.33 9.56Z"/><path d="M19.35 9.87C19.15 9.82 18.95 9.95 18.89 10.15C18.83 10.36 18.93 10.57 19.13 10.62L19.24 10.24L19.35 9.87ZM21.27 11.17C21.46 11.22 21.66 11.1 21.72 10.89C21.78 10.68 21.68 10.47 21.48 10.42L21.38 10.8L21.27 11.17ZM19.24 10.24L19.13 10.62L21.27 11.17L21.38 10.8L21.48 10.42L19.35 9.87L19.24 10.24Z"/><path d="M12.12 11.4C11.93 11.35 11.73 11.48 11.67 11.69C11.61 11.89 11.71 12.1 11.91 12.15L12.02 11.78L12.12 11.4ZM14.04 12.7C14.24 12.75 14.44 12.63 14.5 12.42C14.56 12.21 14.46 12.01 14.26 11.96L14.15 12.33L14.04 12.7ZM12.02 11.78L11.91 12.15L14.04 12.7L14.15 12.33L14.26 11.96L12.12 11.4L12.02 11.78Z"/><path d="M18.14 10.21C17.95 10.13 17.74 10.23 17.65 10.43C17.57 10.62 17.65 10.84 17.84 10.92L17.99 10.56L18.14 10.21ZM19.91 11.75C20.1 11.82 20.32 11.73 20.4 11.53C20.48 11.34 20.4 11.12 20.21 11.04L20.06 11.39L19.91 11.75ZM17.99 10.56L17.84 10.92L19.91 11.75L20.06 11.39L20.21 11.04L18.14 10.21L17.99 10.56Z"/>')`,
    telehandler: `ico('<path d="M16.62 13.5H5.13C4.57 13.5 4.13 13.84 4.13 14.25V15.75C4.13 16.16 4.57 16.5 5.13 16.5H16.62C17.18 16.5 17.63 16.16 17.63 15.75V14.25C17.63 13.84 17.18 13.5 16.62 13.5Z"/><path d="M13.49 10.88H9.01C8.8 10.88 8.63 11.5 8.63 12.28V15.09C8.63 15.87 8.8 16.5 9.01 16.5H13.49C13.7 16.5 13.88 15.87 13.88 15.09V12.28C13.88 11.5 13.7 10.88 13.49 10.88Z"/><path d="M6.41 19.88C7.34 19.88 8.1 19.12 8.1 18.19C8.1 17.26 7.34 16.5 6.41 16.5C5.48 16.5 4.73 17.26 4.73 18.19C4.73 19.12 5.48 19.88 6.41 19.88Z"/><path d="M15.94 19.88C16.87 19.88 17.63 19.12 17.63 18.19C17.63 17.26 16.87 16.5 15.94 16.5C15.01 16.5 14.25 17.26 14.25 18.19C14.25 19.12 15.01 19.88 15.94 19.88Z"/><path d="M14.15 10.79L8.65 5.25"/><path d="M17.25 13.88L11.63 8.25"/><path d="M8.37 4.88V8.07H4.88"/>')`,
    towablelift: `ico('<path d="M2 18H5.5"/><path d="M5.5 18H15"/><path d="M10 21.8C10.99 21.8 11.8 20.99 11.8 20C11.8 19.01 10.99 18.2 10 18.2C9.01 18.2 8.2 19.01 8.2 20C8.2 20.99 9.01 21.8 10 21.8Z"/><path d="M6.5 18L4.8 21.3"/><path d="M13.8 18L15.5 21.3"/><path d="M13 18L4.69 14.06L13.69 11.81"/><path d="M19.75 7.5H14.75C14.47 7.5 14.25 7.72 14.25 8V11C14.25 11.28 14.47 11.5 14.75 11.5H19.75C20.03 11.5 20.25 11.28 20.25 11V8C20.25 7.72 20.03 7.5 19.75 7.5Z"/>')`,
    // Tabler "bulldozer" (MIT) — Lucide has no skid-steer/loader/dozer equivalent.
    skidsteer: `ico('<path d="M2 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M12 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M19 13v4a2 2 0 0 0 2 2h1"/><path d="M14 19h-10"/><path d="M4 15h10"/><path d="M9 11v-5h2a3 3 0 0 1 3 3v6"/><path d="M5 15v-3a1 1 0 0 1 1 -1h8"/><path d="M19 17h-3"/>')`,
    // Tabler "crane" (MIT) — Lucide's forklift read as a warehouse lift, not a boom/scissor/towable lift.
    lift: `ico('<path d="M6 21h6"/><path d="M9 21v-18l-6 6h18"/><path d="M9 3l10 6"/><path d="M17 9v4a2 2 0 1 1 -2 2"/>')`,
    // bespoke scissor lift (Jac, 2026-07-03: a scissor lift is not a boom lift) —
    // platform / X-frame / base+wheels, simple geometry like the sawblade precedent.
    scissor: `ico('<path d="M20 7.13H4C3.45 7.13 3 7.57 3 8.13V10.13C3 10.68 3.45 11.13 4 11.13H20C20.55 11.13 21 10.68 21 10.13V8.13C21 7.57 20.55 7.13 20 7.13Z"/><path d="M3.6 11.56L19.65 15.94"/><path d="M4.13 16.07L20.32 12.25"/><path d="M4 16H20"/><path d="M7.5 21.6C8.38 21.6 9.1 20.88 9.1 20C9.1 19.12 8.38 18.4 7.5 18.4C6.62 18.4 5.9 19.12 5.9 20C5.9 20.88 6.62 21.6 7.5 21.6Z"/><path d="M16.5 21.6C17.38 21.6 18.1 20.88 18.1 20C18.1 19.12 17.38 18.4 16.5 18.4C15.62 18.4 14.9 19.12 14.9 20C14.9 20.88 15.62 21.6 16.5 21.6Z"/>')`,
    // bespoke utility trailer (Jac reference art, 2026-07-06 — the caravan read as a camper).
    trailer: `ico('<path d="M1.88 15.38H6.38"/><path d="M4.13 15.75V18.75"/><path d="M3.75 19.13H4.88"/><path d="M20.37 9.44H6.87C6.25 9.44 5.75 9.89 5.75 10.44V14.44C5.75 14.99 6.25 15.44 6.87 15.44H20.37C21 15.44 21.5 14.99 21.5 14.44V10.44C21.5 9.89 21 9.44 20.37 9.44Z"/><path d="M13.75 19.7C14.85 19.7 15.75 18.8 15.75 17.7C15.75 16.6 14.85 15.7 13.75 15.7C12.65 15.7 11.75 16.6 11.75 17.7C11.75 18.8 12.65 19.7 13.75 19.7Z"/><path d="M19.5 19.7C20.6 19.7 21.5 18.8 21.5 17.7C21.5 16.6 20.6 15.7 19.5 15.7C18.4 15.7 17.5 16.6 17.5 17.7C17.5 18.8 18.4 19.7 19.5 19.7Z"/><path d="M6 15.5H7.8"/><path d="M17.2 15.5H20"/>')`,
    // bespoke dump trailer + light tower (Jac reference art, 2026-07-06)
    dumptrailer: `ico('<path d="M2 16.5H6.5"/><path d="M2.5 16.5V18.3"/><path d="M6.5 16.5H17"/><path d="M14.78 15.95L11.07 4.95L13.85 3.99L17.64 15.04L14.78 15.95Z"/><path d="M13.5 15.5L16.1 12.1"/><path d="M10.5 20.6C11.55 20.6 12.4 19.75 12.4 18.7C12.4 17.65 11.55 16.8 10.5 16.8C9.45 16.8 8.6 17.65 8.6 18.7C8.6 19.75 9.45 20.6 10.5 20.6Z"/><path d="M15 20.6C16.05 20.6 16.9 19.75 16.9 18.7C16.9 17.65 16.05 16.8 15 16.8C13.95 16.8 13.1 17.65 13.1 18.7C13.1 19.75 13.95 20.6 15 20.6Z"/>')`,
    tower: `ico('<path d="M6.2 2H3C2.72 2 2.5 2.22 2.5 2.5V4.9C2.5 5.18 2.72 5.4 3 5.4H6.2C6.48 5.4 6.7 5.18 6.7 4.9V2.5C6.7 2.22 6.48 2 6.2 2Z"/><path d="M12 2H8.8C8.52 2 8.3 2.22 8.3 2.5V4.9C8.3 5.18 8.52 5.4 8.8 5.4H12C12.28 5.4 12.5 5.18 12.5 4.9V2.5C12.5 2.22 12.28 2 12 2Z"/><path d="M6.2 7H3C2.72 7 2.5 7.22 2.5 7.5V9.9C2.5 10.18 2.72 10.4 3 10.4H6.2C6.48 10.4 6.7 10.18 6.7 9.9V7.5C6.7 7.22 6.48 7 6.2 7Z"/><path d="M12 7H8.8C8.52 7 8.3 7.22 8.3 7.5V9.9C8.3 10.18 8.52 10.4 8.8 10.4H12C12.28 10.4 12.5 10.18 12.5 9.9V7.5C12.5 7.22 12.28 7 12 7Z"/><path d="M7.5 10.5V21.75"/><path d="M11 18V15.3C11 14.82 11.19 14.36 11.53 14.03C11.86 13.69 12.32 13.5 12.8 13.5H18.2C18.5 13.5 18.8 13.56 19.08 13.68C19.36 13.79 19.61 13.96 19.83 14.17C20.04 14.39 20.21 14.64 20.32 14.92C20.44 15.2 20.5 15.5 20.5 15.8V18"/><path d="M2 18H21"/><path d="M17 21.9C18.05 21.9 18.9 21.05 18.9 20C18.9 18.95 18.05 18.1 17 18.1C15.95 18.1 15.1 18.95 15.1 20C15.1 21.05 15.95 21.9 17 21.9Z"/>')`,
    // bespoke concrete power buggy (Jac, 2026-07-04: the garden-cart/wheelbarrow was rejected).
    buggy: `ico('<path d="M8.62 4.58L14.6 9.89L10.95 14C10.33 14.7 9.46 15.12 8.54 15.17C7.61 15.23 6.7 14.91 6.01 14.29L2.64 11.3L8.62 4.58Z"/><path d="M2.31 11.68L9.62 3.46"/><path d="M13.75 11H18.25C19.05 11 19.81 11.32 20.37 11.88C20.93 12.44 21.25 13.2 21.25 14V15.5"/><path d="M19.88 14.63V12.28L21.38 10.88"/><path d="M4.88 17.81C4.88 17.27 5.28 16.74 6 16.35C6.72 15.97 7.7 15.75 8.72 15.75H19.4C20.42 15.75 21.4 15.97 22.12 16.35C22.84 16.74 23.25 17.27 23.25 17.81C23.25 18.36 22.84 18.88 22.12 19.27C21.4 19.66 20.42 19.88 19.4 19.88H8.72C7.7 19.88 6.72 19.66 6 19.27C5.28 18.88 4.88 18.36 4.88 17.81Z"/><path d="M11.81 18.38C12.12 18.38 12.38 18.12 12.38 17.81C12.38 17.5 12.12 17.25 11.81 17.25C11.5 17.25 11.25 17.5 11.25 17.81C11.25 18.12 11.5 18.38 11.81 18.38Z"/><path d="M7.31 18.38C7.62 18.38 7.88 18.12 7.88 17.81C7.88 17.5 7.62 17.25 7.31 17.25C7 17.25 6.75 17.5 6.75 17.81C6.75 18.12 7 18.38 7.31 18.38Z"/><path d="M16.31 18.38C16.62 18.38 16.88 18.12 16.88 17.81C16.88 17.5 16.62 17.25 16.31 17.25C16 17.25 15.75 17.5 15.75 17.81C15.75 18.12 16 18.38 16.31 18.38Z"/><path d="M20.81 18.38C21.12 18.38 21.38 18.12 21.38 17.81C21.38 17.5 21.12 17.25 20.81 17.25C20.5 17.25 20.25 17.5 20.25 17.81C20.25 18.12 20.5 18.38 20.81 18.38Z"/>')`,
    // Tabler "hammer" (MIT, Jac 2026-07-03) — distinct path from Lucide's hammer already on CARD_ICON.shop,
    // so the small-tool catch-all doesn't collide with the Shop card's glyph.
    saw: `ico('<path d="M9 11.52L16.67 3.85C17.8 2.72 19.64 2.72 20.78 3.85C21.91 4.98 21.91 6.82 20.78 7.96L13.12 15.62"/><path d="M6.77 21.95C5.57 22.95 3.78 22.89 2.65 21.76L0.7 19.82L2.73 17.79"/><path d="M7.68 10.34L13.73 16.39L7.58 22.55L2.95 17.92C2.17 17.14 2.17 15.87 2.95 15.09L7.68 10.34Z"/><path d="M8.64 15.44L4.82 11.62C4.1 10.9 2.94 10.9 2.22 11.62C1.5 12.34 1.5 13.5 2.22 14.22L3.02 15.02"/><path d="M17.74 6.89L11.35 13.28"/><path d="M21.96 2.67L20.79 3.84"/><path d="M18.74 1.34V2.99"/><path d="M15.51 2.67L16.68 3.84"/><path d="M21.96 9.12L20.79 7.95"/><path d="M12.94 5.24L14.11 6.41"/><path d="M19.39 11.69L18.22 10.52"/><path d="M10.38 7.81L11.55 8.98"/><path d="M16.83 14.26L15.66 13.09"/><path d="M23.3 5.9H21.64"/>')`,
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
