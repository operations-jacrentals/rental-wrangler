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
    generator: 'zap', compressor: 'wind',
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
    roller: `ico('<circle cx="6" cy="15.5" r="4"/><path d="M6 15.5h.01"/><path d="M10 13h8.5a2 2 0 0 1 2 2v3.5h-2.5"/><path d="M12.5 13V8h5v5"/><circle cx="15.5" cy="18.5" r="2.2"/><path d="M10 18.5h3.3"/>')`,
    tamper: `ico('<path d="M4.5 3 9 11"/><path d="M3 4.5 6 2.5"/><rect x="8" y="10" width="8" height="5" rx="1"/><path d="M6.5 18.5 8 15h8l1.5 3.5z"/><path d="M8.5 21.5h2"/><path d="M13.5 21.5h2"/>')`,
    trencher: `ico('<rect x="10" y="15.5" width="9.5" height="4" rx="2"/><path d="M13 17.5h3.5"/><rect x="11.5" y="10" width="7.5" height="5.5" rx="1"/><path d="M12.5 12.5 4.2 5.2"/><path d="M14.5 10.5 6.3 3.3"/><path d="M4.2 5.2 6.3 3.3"/><path d="M6.5 6.5 5 8"/><path d="M9 8.7 7.5 10.2"/>')`,
    telehandler: `ico('<circle cx="7.5" cy="17.5" r="2.3"/><circle cx="17" cy="17.5" r="2.3"/><path d="M9.8 17.5h4.9"/><path d="M5.2 17.2 4.5 14h11"/><path d="M20 13.5 7.5 4.5"/><path d="M19 15.5 13 11.2"/><path d="M15.5 14h4.5v3.5"/><path d="M7.5 4.5v3.4h-3.4"/>')`,
    towablelift: `ico('<path d="M2 18h4"/><path d="M6 18h9"/><circle cx="10.5" cy="20" r="1.7"/><path d="M7.5 18 5.5 21.5"/><path d="M13.5 18 15.5 21.5"/><path d="M13 18 10 10.5 15.5 7.2"/><rect x="15" y="3.5" width="5.5" height="3.7" rx=".5"/>')`,
    attachment: `ico('<rect x="8" y="2.5" width="8" height="4" rx="1"/><path d="M12 6.5V19"/><path d="M12 21.5 12 19"/><path d="m12 21.5-1.8-2.1"/><path d="M7.5 9.2c3 2 6 -2 9 0"/><path d="M8.3 13c2.6 1.8 4.8 -1.8 7.4 0"/><path d="M9.3 16.6c1.9 1.4 3.5 -1.4 5.4 0"/>')`,
    // Tabler "bulldozer" (MIT) — Lucide has no skid-steer/loader/dozer equivalent.
    skidsteer: `ico('<path d="M2 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M12 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M19 13v4a2 2 0 0 0 2 2h1"/><path d="M14 19h-10"/><path d="M4 15h10"/><path d="M9 11v-5h2a3 3 0 0 1 3 3v6"/><path d="M5 15v-3a1 1 0 0 1 1 -1h8"/><path d="M19 17h-3"/>')`,
    // Tabler "crane" (MIT) — Lucide's forklift read as a warehouse lift, not a boom/scissor/towable lift.
    lift: `ico('<path d="M6 21h6"/><path d="M9 21v-18l-6 6h18"/><path d="M9 3l10 6"/><path d="M17 9v4a2 2 0 1 1 -2 2"/>')`,
    // bespoke scissor lift (Jac, 2026-07-03: a scissor lift is not a boom lift) —
    // platform / X-frame / base+wheels, simple geometry like the sawblade precedent.
    scissor: `ico('<rect x="3" y="3" width="18" height="4" rx="1"/><path d="m5 7 14 9"/><path d="m19 7-14 9"/><path d="M4 16h16"/><circle cx="7.5" cy="20" r="1.6"/><circle cx="16.5" cy="20" r="1.6"/>')`,
    // bespoke utility trailer (Jac reference art, 2026-07-06 — the caravan read as a camper).
    trailer: `ico('<path d="M2 13.5h4"/><path d="M3.5 13.5v3"/><path d="M2.5 16.5h2"/><path d="M6 13.5h1.5"/><rect x="7.5" y="9.5" width="14" height="6" rx="1"/><circle cx="13" cy="17.5" r="2.2"/><path d="M15.2 15.5h5"/><path d="M7.5 15.5h3.3"/>')`,
    // bespoke dump trailer + light tower (Jac reference art, 2026-07-06)
    dumptrailer: `ico('<path d="M2 16.5h4.5"/><path d="M2.5 16.5v1.8"/><path d="M6.5 16.5h10.5"/><path d="M17.7 15.7 8.3 8.9 10 6.5 19.5 13.3z"/><path d="M13.5 15.5l2.6-3.4"/><circle cx="10.5" cy="18.7" r="1.9"/><circle cx="15" cy="18.7" r="1.9"/>')`,
    tower: `ico('<rect x="3" y="2.5" width="3.6" height="3" rx=".6"/><rect x="8" y="2.5" width="3.6" height="3" rx=".6"/><rect x="3" y="6.5" width="3.6" height="3" rx=".6"/><rect x="8" y="6.5" width="3.6" height="3" rx=".6"/><path d="M7.3 9.5V18"/><path d="M10.5 18v-3.5a1.5 1.5 0 0 1 1.5-1.5h6a2 2 0 0 1 2 2v3"/><path d="M2 18h14"/><circle cx="17.5" cy="19.6" r="1.8"/><path d="M4 18v-2"/>')`,
    // bespoke concrete power buggy (Jac, 2026-07-04: the garden-cart/wheelbarrow was rejected).
    buggy: `ico('<path d="M11.5 7.5v8H6a3.5 3.5 0 0 1-3.5-3.5V7.5z"/><path d="M2 7.5h11"/><path d="M11.5 11h4.5a3 3 0 0 1 3 3v1.5"/><path d="M19 15.5V13l2.5-1.5"/><circle cx="7.5" cy="18" r="2.4"/><circle cx="16" cy="18" r="2.4"/>')`,
    // Tabler "hammer" (MIT, Jac 2026-07-03) — distinct path from Lucide's hammer already on CARD_ICON.shop,
    // so the small-tool catch-all doesn't collide with the Shop card's glyph.
    saw: `ico('<path d="M11.414 10l-7.383 7.418a2.091 2.091 0 0 0 0 2.967a2.11 2.11 0 0 0 2.976 0l7.407 -7.385"/><path d="M18.121 15.293l2.586 -2.586a1 1 0 0 0 0 -1.414l-7.586 -7.586a1 1 0 0 0 -1.414 0l-2.586 2.586a1 1 0 0 0 0 1.414l7.586 7.586a1 1 0 0 0 1.414 0z"/>')`,
    // Bespoke sawblade (Jac 2026-07-03): no Lucide/Tabler icon is a literal serrated cutting disc, so this is
    // computed geometry (9 teeth via trig, r=9.2 peak / r=7.0 valley, viewBox 0 0 24 24) rather than hand-drawn
    // freeform art — distinct from the "cog" settings-gear glyph it replaced.
    grinder: `ico('<path d="M3 4.5 7.5 10"/><path d="M2 6.5 4.5 4"/><rect x="6.5" y="8.5" width="7" height="5" rx="1"/><circle cx="9" cy="16.5" r="1.7"/><circle cx="12.5" cy="16.5" r="1.7"/><circle cx="18" cy="14.5" r="3.6"/><path d="M18 14.5h.01"/><path d="M18 18.1v1.9"/><path d="M20.5 17l1.4 1.4"/><path d="M15.5 17 14 18.4"/><path d="M14.5 12.5h-1"/>')`,
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
