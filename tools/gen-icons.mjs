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
    box: 'box', doc: 'file', lock: 'lock', lockOpen: 'lock-open',
    chevL: 'chevron-left', chevR: 'chevron-right', chat: 'message-circle',
  },
  CARD_ICON: {
    customers: 'user', rentals: 'calendar', units: 'tag', invoices: 'receipt',
    workOrders: 'wrench', serviceOrders: 'heart', inspections: 'clipboard-check',
    shop: 'hammer', parts: 'package', vendors: 'store', expenses: 'receipt-text',
    files: 'folder',
  },
  RING_ICON: { driver: 'truck', office: 'building', sales: 'trending-up' },
  // Per-category unit glyphs — keyword-resolved by categoryIconFor() in app.js.
  CATEGORY_ICON: {
    lift: 'forklift', light: 'lightbulb', generator: 'zap', compressor: 'wind',
    pump: 'droplet', truck: 'truck', tractor: 'tractor', trailer: 'container',
    fuel: 'fuel', heater: 'flame', tower: 'radio-tower', saw: 'wrench', box: 'box',
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
    // Tabler "backhoe" (MIT) — Lucide has no excavator.
    categories: `ico('<path d="M2 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M11 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M13 19h-9"/><path d="M4 15h9"/><path d="M8 12v-5h2a3 3 0 0 1 3 3v5"/><path d="M5 15v-2a1 1 0 0 1 1 -1h7"/><path d="M21.12 9.88l-3.12 -4.88l-5 5"/><path d="M21.12 9.88a3 3 0 0 1 -2.12 5.12a3 3 0 0 1 -2.12 -.88l4.24 -4.24"/>')`,
    // clipboard-question — not in Lucide; bespoke clipboard + "?".
    inspectionsPending: `ico('<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M10 12.3a2 2 0 1 1 2.7 1.9c-.6.3-1 .7-1 1.4"/><path d="M11.7 17.8h.01"/>')`,
  },
  RING_ICON: {
    mechanic: `CARD_ICON.workOrders`,
    mtech: `ico('<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1Z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a6 6 0 0 1 6-6"/><path d="M14 6a6 6 0 0 1 6 6v3"/>')`,
  },
  CATEGORY_ICON: {
    // excavator / skid / backhoe family reuses the vendored Tabler backhoe.
    excavator: `CARD_ICON.categories`,
  },
};

// Emission order per object (keeps the generated file diff-stable).
const ORDER = {
  I: ['circle', 'plus', 'search', 'x', 'filter', 'grid', 'truck', 'back', 'list', 'mark',
      'sun', 'moon', 'hardhat', 'horseshoe', 'bluesteel', 'qr', 'mouse', 'video', 'camera',
      'droplet', 'table', 'graph', 'sliders', 'inbox', 'bell', 'alert', 'eye', 'eyeOff', 'feedback',
      'box', 'doc', 'lock', 'lockOpen', 'chev', 'chevL', 'chevR', 'chat'],
  CARD_ICON: ['customers', 'rentals', 'categories', 'units', 'invoices', 'workOrders',
      'serviceOrders', 'inspections', 'inspectionsPending', 'shop', 'parts', 'vendors',
      'expenses', 'files'],
  RING_ICON: ['mechanic', 'mtech', 'driver', 'office', 'sales'],
  CATEGORY_ICON: ['excavator', 'lift', 'light', 'generator', 'compressor', 'pump',
    'truck', 'tractor', 'trailer', 'fuel', 'heater', 'tower', 'saw', 'box'],
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
