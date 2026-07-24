/**
 * rulebook.js — Rental Wrangler Design-System Catalog (moved from app.js
 * APP-12 · DESIGN-SYSTEM CATALOG, 2026-07-24 module split).
 * ----------------------------------------------------------------------------
 * The tabbed Rulebook: RB_FOUNDATION = the primitives the rules are built
 * FROM (type, color, form, surfaces, motion…); RB_TABS = the IA that groups
 * every rule + foundation into tabs. Pure relocation: same functions, same
 * behavior, just callable via import.
 *
 * RULE_META and state still live in app.js — read via the APP registry
 * (see src/internals.js for why a direct `import ... from '../app.js'`
 * would be unsafe here).
 */
import { esc } from './format.js';
import { I } from '../icons.js';
import { APP } from './internals.js';

/* The Rulebook grew from "stamped element rules" (R0–R24) into the WHOLE
   design system. RB_FOUNDATION = the primitives the rules are built FROM (type,
   color, form, surfaces, motion…) — NOT data-r stamped, they're the tokens &
   guidelines. RB_TABS = the IA that groups every rule + foundation into tabs.
   Foundation row = [tag, name, spec/token, when/why, exampleHTML]. */
const rbSw = (bg, name, note, ink = '#fff') =>
  `<span class="rb-sw" style="background:${bg};color:${ink}">${name ? `<b>${name}</b>` : ''}${note ? `<i>${note}</i>` : ''}</span>`;
export const RB_FOUNDATION = {
  // ── TYPE ──
  'type-display': ['Aa', 'Display · stamped', "'Saira Condensed' · 600–800 · UPPERCASE · +1–2px tracking",
    'The yard “stamped-steel” voice: wordmark, column tabs, KPI labels, section headers, ignition buttons.',
    `<span style="font-family:'Saira Condensed',sans-serif;text-transform:uppercase;letter-spacing:1.6px;font-weight:800;font-size:1.3529rem;color:var(--txt)">Clock In · Wrangle</span>`],
  'type-body': ['Aa', 'Body', "'Geist' (var(--font)) · 400–700",
    'Everything you read: row text, field values, descriptions. Quiet, legible, never stamped.',
    `<span style="font-size:0.8235rem;color:var(--txt)">Rugged equipment, rented right — the body face carries the content.</span>`],
  'type-mono': ['‹›', 'Mono', 'ui-monospace · 10–12px · txt-3',
    'Code + debug references only: the Inspector tag and rulebook builder names.',
    `<code style="font-family:ui-monospace,monospace;font-size:0.7059rem;color:var(--txt-3)">UNITS › INSPECTION › “Passed”</code>`],
  'type-scale': ['#', 'Size scale', '28 · 15 · 13 · 12 · 11 · 10 · 9.5px',
    'Bigger = identity/value (28 KPI · 15 popup title). 12–13 = content. ≤11 = stamped micro-labels & counters. ONE size (11px) for every status badge.',
    `<span style="display:flex;align-items:baseline;gap:13px;flex-wrap:wrap;color:var(--txt)"><span style="font-size:1.6471rem;font-weight:800">28</span><span style="font-size:0.8824rem;font-weight:700">15</span><span style="font-size:0.7647rem">13</span><span style="font-size:0.7059rem">12</span><span style="font-family:'Saira Condensed';text-transform:uppercase;letter-spacing:1px;font-size:0.6471rem;font-weight:700">11 label</span><span style="font-size:0.5588rem;color:var(--txt-3)">9.5</span></span>`],
  'type-weight': ['B', 'Weight', '800 · 700 · 600 · 400',
    '800 stamped identity · 700 titles & labels · 600 strong body · 400 body.',
    `<span style="display:flex;gap:16px;align-items:baseline;color:var(--txt)"><span style="font-weight:800">800</span><span style="font-weight:700">700</span><span style="font-weight:600">600</span><span style="font-weight:400">400</span></span>`],
  // ── COLOR ──
  'color-accent': ['●', 'Accent · safety orange', '--accent #ff7a1a (+ --on-orange ink)',
    'ONE orange, ONE meaning: the selected tab · ignition · primary action. Never decorative.',
    rbSw('var(--accent)', 'Accent', 'selected · ignition', 'var(--on-orange)')],
  'color-status': ['◐', 'Status palette', '--green / --yellow / --red / --blue / --navy / --purple / --gray',
    'Registry status colors — each carries a fixed meaning on every card (Passed · caution · danger · link…).',
    ['var(--green)', 'var(--yellow)', 'var(--red)', 'var(--blue)', 'var(--navy)', 'var(--purple)', 'var(--gray)'].map((c) => `<span class="rb-sw" style="background:${c}"></span>`).join('')],
  'color-semantic': ['▣', 'Action-color law', 'commit = blue · money = green · danger = red',
    'Action INTENT, not status: blue commits/saves · green takes money · solid red confirms destructive.',
    rbSw('var(--blue)', 'Commit') + rbSw('var(--green)', 'Money') + rbSw('var(--red)', 'Danger')],
  'color-neutral': ['▤', 'Neutrals', '--txt / --txt-2 / --txt-3 · --line',
    '3-step text hierarchy on steel; lines separate without shouting.',
    `<span class="rb-sw" style="background:var(--txt);color:#000"><b>Txt</b></span><span class="rb-sw" style="background:var(--txt-2);color:#000"><b>Txt-2</b></span><span class="rb-sw" style="background:var(--txt-3)"><b>Txt-3</b></span><span class="rb-sw" style="background:var(--line)"><b>Line</b></span>`],
  'color-tan': ['✶', 'Wrangler tan', '--tan #c2925a / --tan-deep (yard theme)',
    'The light ranch seasoning — worn leather for saddle-stitch dividers & tiny touches. Restrained.',
    rbSw('var(--tan,#c2925a)', 'Tan', 'saddle-stitch', '#1a1205')],
  'color-ec-red': ['⚠', 'ec-red · flagging glow', 'fill: color-mix(--red 65%, white) · shadow: 0 0 3px --red, 0 0 7px (--red 60%+transparent)',
    'Official treatment for EVERY flagging-red signal — text names/pills/flags/headers, borders, dots/bars. Three knobs in style.css .ec-red group: fill % (65), inner glow (3px), outer halo (7px / 60%). Never use pure --red alone on flagging text.',
    `<span style="-webkit-text-fill-color:color-mix(in srgb,var(--red) 65%,white);text-shadow:0 0 3px var(--red),0 0 7px color-mix(in srgb,var(--red) 60%,transparent);font-weight:700;font-size:0.7647rem;letter-spacing:.5px">TUCKER FONTENOT · No Card · $0.30 overdue</span>`],
  // ── FORM ──
  'radius': ['◳', 'Radius', '--radius 14–16 · --chip-radius 11–12 · 8–10 controls · 999 pills',
    'Cards/popups softest · chips medium · controls tight · pills & counters full-round · rings/avatars circles.',
    `<span style="display:flex;gap:8px;align-items:center"><span class="rb-surf" style="border-radius:16px">16</span><span class="rb-surf" style="border-radius:12px">12</span><span class="rb-surf" style="border-radius:8px">8</span><span class="rb-surf" style="border-radius:999px">999</span></span>`],
  'elevation': ['☁', 'Elevation', '--shadow (float) · --chip-shadow · accent glow',
    'Two depths: cards/popups float deep; chips/rows lift gently. Pop-ups & menus add the orange halo ring.',
    `<span style="display:flex;gap:12px"><span class="rb-surf" style="box-shadow:var(--shadow)">float</span><span class="rb-surf" style="box-shadow:var(--chip-shadow)">chip</span><span class="rb-surf" style="box-shadow:0 0 0 2px var(--accent-line),0 0 22px -8px var(--accent)">glow</span></span>`],
  'spacing': ['▦', 'Spacing', 'grid 12 · list 7 · section pad 12 · row pad 9–11',
    'Tight, dense yard data — generous enough to scan, never airy.',
    `<span style="display:flex;align-items:center;color:var(--txt-3);font-size:0.6471rem;gap:8px"><span style="display:flex;gap:12px"><span style="width:14px;height:14px;background:var(--accent-soft);border:1px solid var(--accent-line);border-radius:3px"></span><span style="width:14px;height:14px;background:var(--accent-soft);border:1px solid var(--accent-line);border-radius:3px"></span></span>12px gap</span>`],
  'motion': ['↻', 'Motion', '.12s controls · .15s surfaces · .5s rings/timeline',
    'Fast, functional. Keyframes: attnGlow (flash) · plateIn (login) · flagPulse · rwLint. prefers-reduced-motion respected everywhere.',
    `<span class="pill c-blue" style="animation:attnGlow 1.1s ease-in-out infinite;border-radius:10px"><span class="t">flash</span></span>`],
  // ── SURFACES ──
  'surface-bg': ['▢', 'App background', '--bg · yard: orange dawn-glow + mill texture',
    'The yard floor everything floats on; the header & bottom bar sit transparent over it.',
    `<span class="rb-surf" style="background:var(--bg);width:100%;height:34px"></span>`],
  'surface-panel': ['▢', 'Panel', '--panel / --panel-2',
    'Sub-surfaces: search bars, chips, dashboard stats, the action chip-trays.',
    `<span class="rb-surf" style="background:var(--panel);width:100%;height:34px"></span>`],
  'surface-card': ['▢', 'Card / plate', '--card · radius · --shadow',
    'The column plate. Yard theme = steel gradient + hazard-stripe top + corner rivets.',
    `<span class="rb-surf" style="background:var(--card);width:100%;height:38px;position:relative;overflow:hidden;justify-content:flex-start;padding-left:14px"><span style="position:absolute;top:0;left:0;right:0;height:5px;background:repeating-linear-gradient(135deg,var(--yellow,#f5c542) 0 13px,#14181d 13px 26px)"></span>card</span>`],
  'surface-section': ['▢', 'Section', '.section · --panel · centered header · status-tinted',
    'Sub-cards inside a record; the header + border follow the live status (sec-green/yellow/red).',
    `<span class="rb-surf" style="background:var(--panel);border-color:color-mix(in srgb,var(--green) 45%,transparent);width:100%;height:34px"></span>`],
  'surface-anchored': ['▢', 'Anchored ring', '#18b6ff neon ring',
    'An opened record glows neon blue — the “you are here” signal (distinct from orange selection).',
    `<span class="rb-surf" style="background:var(--card);width:100%;height:34px;border-color:#18b6ff;box-shadow:0 0 0 2px rgba(24,182,255,.55)"></span>`],
  'surface-row': ['▢', 'Row chip', '.row · --panel · row-bg viz',
    'List items are chips; a faint full-bleed visualization can tint a row by its data.',
    `<span class="rb-surf" style="background:var(--panel);width:100%;height:30px"></span>`],
  // ── UPLOAD / CAPTURE ──
  'upload-capture': ['⌖', 'Capture drop', '.cap-drop · dashed · camera / site',
    'Photo/selfie/site captures (inspections, deliveries). When transport is set the popup tops with the address + map pin.',
    `<span class="cap-drop" style="min-height:46px">${I.camera || ''}<span>Capture photo</span></span>`],
  // ── HEADERS / CONTAINERS ──
  'header-section': ['▭', 'Section header', '.section>h4 · centered · 11px UPPER',
    'Centered stamped label; right-side flags pin absolutely so the title stays true-center.',
    `<span style="display:block;text-align:center;font-size:0.6471rem;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--txt-3)">Inspection</span>`],
  'header-popup': ['▭', 'Popup header', '.popup-head · icon + h3(15) + ✕',
    'Every overlay leads with an accent icon, a 15px title, and the close on the right.',
    `<span style="display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:9px;padding:7px 10px;background:var(--panel)"><span style="color:var(--accent);display:inline-flex">${I.doc || ''}</span><b style="font-size:0.8235rem">Popup title</b></span>`],
  'overlay-popup': ['◳', 'Pop-up / overlay', '.overlay scrim + .popup',
    'Centered modal: 50%-black scrim · panel with the orange border + glow halo · max 92vw/86vh · internal scroll.',
    `<span class="rb-surf" style="background:var(--panel);border:1px solid var(--accent);box-shadow:0 0 0 2px var(--accent-line),0 0 20px -6px var(--accent);width:130px;height:42px;border-radius:12px">modal</span>`],
  'menu-dropdown': ['▾', 'Menu', '.dropdown-menu / .ctx-menu',
    'Floating orange-ringed lists: the sort/filter dropdowns and the R20 right-click menu.',
    `<span style="display:inline-block;background:var(--panel);border:1px solid var(--accent);border-radius:11px;box-shadow:0 0 0 2px var(--accent-line);padding:5px;min-width:128px"><span style="display:block;padding:5px 9px;border-radius:8px;font-size:0.7059rem;color:var(--txt-2)">Sort · Name</span><span style="display:block;padding:5px 9px;border-radius:8px;font-size:0.7059rem;color:var(--accent);background:var(--panel-2)">Sort · Status</span></span>`],
  'grid': ['▥', 'Yard grid', '.grid · 3 equal cols · 12px gap',
    'The fixed 3-column layout (Units · Rentals · Customers). Reflows 3→2→1 by width on phones (M0–M3); never squishes below the desktop floor.',
    `<span style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:150px"><span class="rb-surf" style="height:30px"></span><span class="rb-surf" style="height:30px"></span><span class="rb-surf" style="height:30px"></span></span>`],
  // ── DATA VIZ ──
  'data-kpi': ['◎', 'KPI rings', '.kpi-ring · concentric progress',
    'The header rings: Apple-style progress, each colored by its value band, number + stamped role label below.',
    `<span style="display:inline-grid;place-items:center;width:38px;height:38px;border-radius:50%;background:conic-gradient(var(--green) 72%,var(--track) 0)"><span style="display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:var(--bg);font-size:0.5882rem;font-weight:800;color:var(--txt)">9</span></span>`],
  'data-gauge': ['▰', 'Activity gauge', '.active-bar.bipolar · steel data-plate',
    'A bipolar −100…+100 track (customer health); a hazard overlay marks the deep-danger end.',
    `<span style="display:inline-block;width:140px;height:14px;border-radius:7px;overflow:hidden;background:var(--track)"><span style="display:block;height:100%;width:64%;background:linear-gradient(90deg,var(--red),var(--orange),var(--yellow),var(--green))"></span></span>`],
  // ── BEHAVIORS ──
  'behavior-preview': ['◉', 'Hover previews', 'the eye system · per-device toggle',
    'Hovering most elements shows a rich preview; a row eye + bottom-bar eye toggle it. Off = every eye runs red.',
    `<span class="pill c-gray"><span class="t">${I.eye || ''} preview</span></span>`],
};
/* The tabbed IA — every rule (R…) + foundation (f…) lands in exactly one tab. */
export const RB_TABS = [
  { id: 'foundation', label: 'Foundations', intro: 'The primitives every rule is built from — type, color, form, motion. Change these and the whole yard shifts.',
    items: [{ f: 'type-display' }, { f: 'type-body' }, { f: 'type-mono' }, { f: 'type-scale' }, { f: 'type-weight' },
            { f: 'color-accent' }, { f: 'color-status' }, { f: 'color-semantic' }, { f: 'color-neutral' }, { f: 'color-tan' },
            { f: 'radius' }, { f: 'elevation' }, { f: 'spacing' }, { f: 'motion' }] },
  { id: 'surfaces', label: 'Surfaces', intro: 'Backgrounds & containers — the steel everything is bolted to.',
    items: [{ f: 'surface-bg' }, { f: 'surface-panel' }, { f: 'surface-card' }, { f: 'surface-section' }, { f: 'surface-anchored' }, { f: 'surface-row' }] },
  { id: 'containers', label: 'Containers', intro: 'Title chips, sections, headers, pop-ups, menus and the layout grid.',
    items: [{ r: 'R10' }, { r: 'R11' }, { r: 'R12' }, { f: 'header-section' }, { f: 'header-popup' }, { f: 'overlay-popup' }, { f: 'menu-dropdown' }, { f: 'grid' }] },
  { id: 'pills', label: 'Pills & Flags', intro: 'The status vocabulary — every colored chip and exactly what it’s allowed to mean.',
    items: [{ r: 'R1' }, { r: 'R2' }, { r: 'R3' }, { r: 'R3b' }, { r: 'R4' }, { r: 'R4b' }, { r: 'R9' }, { r: 'R9b' }] },
  { id: 'fields', label: 'Fields & Adds', intro: 'Where you type, link, and add.',
    items: [{ r: 'R5' }, { r: 'R5b' }, { r: 'R5c' }, { r: 'R6' }, { r: 'R7' }, { r: 'R8' }, { r: 'R14' }, { r: 'R22' }, { r: 'R31' }, { r: 'R33' }] },
  { id: 'actions', label: 'Actions', intro: 'Buttons that DO something — colored by intent.',
    items: [{ r: 'R17' }, { r: 'R18' }, { r: 'R24' }, { r: 'R26' }, { r: 'R28' }, { r: 'R29' }, { r: 'R32' }] },
  { id: 'upload', label: 'Upload & Capture', intro: 'Add-file zones and photo/site captures.',
    items: [{ r: 'R21' }, { f: 'upload-capture' }] },
  { id: 'data', label: 'Data & Behaviors', intro: 'Visualizations, plus the app’s behaviors — it flashes instead of erroring, right-clicks, tooltips, and self-lints.',
    items: [{ r: 'R16' }, { r: 'R15' }, { r: 'R35' }, { r: 'R36' }, { r: 'R13' }, { f: 'data-kpi' }, { f: 'data-gauge' }, { r: 'R19' }, { r: 'R25' }, { r: 'R20' }, { r: 'R23' }, { f: 'behavior-preview' }, { r: 'R0' }] },

  { id: 'windows', label: 'Windows', intro: 'Every pop-up window in the app, by kind. Expand one for a live preview, its fields, and a copy-paste edit reference — your map to wrangle any screen.', items: [] },
];
/* structural fallbacks so hovering containers also names their rule */
const CLASS_RULE = [
  ['.c-titlecard', 'R10'], ['.nsec', 'R12'], ['.hvals', 'R13'], ['.history', 'R13'],
  ['.timeline', 'R16'], ['.jnode', 'R15'], ['.jseg', 'R15'], ['.journey', 'R15'],
  ['.seg', 'R14'], ['.kv.derived', 'R8'], ['.derived', 'R8'], ['.file-drop', 'R21'], ['.datefield', 'R22'], ['.dfunnel', 'R35'], ['.swipe-track', 'R36'], ['.section', 'R11'],
];
export function ruleOf(target) {
  if (!target || !target.closest) return null;
  const stamped = target.closest('[data-r]');
  if (stamped) return { r: stamped.dataset.r, el: stamped };
  for (const [sel, r] of CLASS_RULE) { const m = target.closest(sel); if (m) return { r, el: m }; }
  const fam = target.closest('.pill, .add-field, .flag, .linkname, .inv-line-link, .req');
  if (fam) return { r: null, el: fam };            // lint family, unstamped = violation
  return null;
}
/* human-readable reference: CARD › SECTION › "text" — what Jac pastes to debug */
export function refPath(el) {
  const card = el.closest('[data-card]')?.dataset.card;
  const sec = el.closest('.section')?.querySelector('h4')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 26);
  const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28);
  return [card ? card.toUpperCase() : null, sec || null, txt ? `“${txt}”` : null].filter(Boolean).join(' › ');
}
export function onInspectMove(e) {
  if (!APP.state.inspect) return;
  let t = document.getElementById('rw-tip');
  if (!t) { t = document.createElement('div'); t.id = 'rw-tip'; document.body.appendChild(t); }
  const hit = ruleOf(e.target);
  if (!hit || e.target.closest('#rw-tip, .overlay')) { t.style.display = 'none'; return; }
  const meta = hit.r ? APP.RULE_META[hit.r] : null;
  t.innerHTML = hit.r
    ? `<b>${esc(hit.r)}</b> ${esc(meta ? meta[0] : '')}<span class="rt-b">${esc(meta ? meta[1] : '')}</span>`
    : `<b class="bad">⚠ NO RULE</b> bypassed the builders (R0)`;
  t.style.display = 'block';
  t.style.left = Math.min(e.clientX + 14, window.innerWidth - 250) + 'px';
  t.style.top = Math.min(e.clientY + 18, window.innerHeight - 56) + 'px';
}
