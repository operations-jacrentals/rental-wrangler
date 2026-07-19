/* gen-logos.mjs — Rental Wrangler logo drafts (3 concepts)
 * All text is converted to vector paths via opentype.js (library fonts:
 * Saira Condensed = stamped voice, Zilla Slab = ranch voice). All other
 * geometry is simple computed shapes (bespoke brand-mark exception).
 * Deterministic: no randomness, no dates.
 */
import fs from 'node:fs';
import opentype from 'opentype.js';

const F = p => {
  const b = fs.readFileSync(p);
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const saira600 = F('fonts/SairaCondensed-600.ttf');
const saira800 = F('fonts/SairaCondensed-800.ttf');
const zilla600 = F('fonts/ZillaSlab-600.ttf');
const zilla700 = F('fonts/ZillaSlab-700.ttf');

/* ---------- palette (style.css :root + ranch tokens) ---------- */
const C = {
  bg: '#0b0c0f', panel1: '#1b2129', panel2: '#0c0e11',
  line: '#262a31', lineSoft: '#1f232a',
  txt: '#e9edf4', txt2: '#a7afbc', txt3: '#6b7480',
  accent: '#ff7a1a', onOrange: '#1a1205',
  hazardY: '#f5c542', hazardInk: '#14181d',
  tan: '#c2925a', tanDeep: '#8a5a2b',
  purple: '#b07cf5',
};

/* ---------- text helpers ---------- */
function textPath(font, text, size, { tracking = 0 } = {}) {
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);
  let x = 0; const parts = [];
  glyphs.forEach((g, i) => {
    const d = g.getPath(x, 0, size).toPathData(2);
    if (d) parts.push(d);
    x += g.advanceWidth * scale + tracking;
    if (i < glyphs.length - 1) x += font.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  return { d: parts.join(' '), width: x - tracking };
}
const T = (font, text, size, x, y, fill, opt = {}) => {
  const { d, width } = textPath(font, text, size, opt);
  const dx = opt.anchor === 'middle' ? x - width / 2 : opt.anchor === 'end' ? x - width : x;
  return { svg: `<path transform="translate(${dx.toFixed(2)},${y.toFixed(2)})" fill="${fill}" d="${d}"/>`, width };
};

/* arc text: dir=1 top arc (reads over the top), dir=-1 bottom arc */
function arcText(font, text, size, cx, cy, r, fill, { tracking = 0, dir = 1 } = {}) {
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);
  const widths = glyphs.map(g => g.advanceWidth * scale);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (glyphs.length - 1);
  const totalAng = total / r;
  let a = -totalAng / 2;
  let out = '';
  glyphs.forEach((g, i) => {
    const w = widths[i];
    const ga = a + (w / 2) / r;
    const deg = (ga * 180 / Math.PI) * dir;
    const px = cx + r * Math.sin(ga) * (dir === 1 ? 1 : 1);
    const py = dir === 1 ? cy - r * Math.cos(ga) : cy + r * Math.cos(ga);
    const d = g.getPath(-w / 2, 0, size).toPathData(2);
    const rot = dir === 1 ? ga * 180 / Math.PI : -ga * 180 / Math.PI;
    if (d) out += `<path fill="${fill}" transform="translate(${px.toFixed(2)},${py.toFixed(2)}) rotate(${rot.toFixed(2)})" d="${d}"/>`;
    a += (w + tracking) / r;
  });
  return out;
}

/* 5-point star */
function star(cx, cy, ro, fill) {
  const ri = ro * 0.42; const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon fill="${fill}" points="${pts.join(' ')}"/>`;
}

/* deterministic LCG for star-field placement */
function lcg(seed) { let s = seed; return () => (s = (s * 48271) % 2147483647) / 2147483647; }

/* ============================================================
 * CONCEPT 1 — "THE BRAND" · branding-iron RW inside a lasso ring
 * ============================================================ */
function concept1() {
  const W = 800, H = 660, cx = 400, cy = 236, r = 150;
  const P = (deg, rad = r) => [cx + rad * Math.cos(deg * Math.PI / 180), cy + rad * Math.sin(deg * Math.PI / 180)];

  // full lasso ring; the tail crosses it tangentially like a hanging lasso
  const ring = `M ${(cx + r).toFixed(1)} ${cy} A ${r} ${r} 0 1 1 ${(cx - r).toFixed(1)} ${cy} A ${r} ${r} 0 1 1 ${(cx + r).toFixed(1)} ${cy}`;

  // rope-strand ticks all the way around
  let ticks = '';
  for (let a = 0; a < 360; a += 7.5) {
    const [x1, y1] = P(a - 1.5, r + 5.4);
    const [x2, y2] = P(a + 1.5, r - 5.4);
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }

  // tail: leaves the ring tangentially at ~32°, lazy S down-right, ends in a coil
  const [tx, ty] = P(32);
  const tail = `M ${(tx - 14).toFixed(1)} ${(ty - 22).toFixed(1)} C ${tx + 26} ${ty + 12}, ${tx + 2} ${ty + 58}, ${tx + 34} ${ty + 86} S ${tx + 74} ${ty + 108}, ${tx + 62} ${ty + 124}`;
  const coilX = tx + 60, coilY = ty + 134;
  const coil = `<circle cx="${coilX}" cy="${coilY}" r="11.5" fill="none"/>
    <circle cx="${coilX}" cy="${coilY}" r="5.5" fill="none"/>`;

  // RW monogram — stamped Saira 800, tight like a cattle-brand ligature
  const rw = T(saira800, 'RW', 168, cx, cy + 60, C.tan, { anchor: 'middle', tracking: -6 });

  // wordmark + stitch + sub-line
  const word = T(zilla700, 'RENTAL WRANGLER', 68, cx, 512, C.txt, { anchor: 'middle', tracking: 2.5 });
  const subL = T(saira600, 'HEAVY EQUIPMENT RENTAL', 21, 0, 0, C.txt2, { tracking: 3.2 });
  const subR = T(saira600, 'SULPHUR, LOUISIANA', 21, 0, 0, C.txt2, { tracking: 3.2 });
  const gap = 30, subY = 584;
  const totalW = subL.width + gap + subR.width;
  const lx = cx - totalW / 2, rx = cx + totalW / 2 - subR.width;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="none">
  <defs>
    <radialGradient id="b1-ember" cx="50%" cy="46%" r="55%">
      <stop offset="0%" stop-color="${C.tanDeep}" stop-opacity=".26"/>
      <stop offset="100%" stop-color="${C.tanDeep}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="186" fill="url(#b1-ember)"/>
  <g stroke="${C.tan}" stroke-width="9" fill="none" stroke-linecap="round">
    <path d="${ring}"/>
    <path d="${tail}"/>
  </g>
  <g stroke="${C.tanDeep}" stroke-width="2.1" stroke-linecap="round" opacity=".85">${ticks}</g>
  <g stroke="${C.tan}" stroke-width="4.5" stroke-linecap="round">${coil}</g>
  ${rw.svg}
  ${word.svg}
  <line x1="230" y1="545" x2="570" y2="545" stroke="${C.tan}" stroke-width="2" stroke-dasharray="9 7" stroke-linecap="round"/>
  <g>
    <path transform="translate(${lx.toFixed(1)},${subY})" fill="${C.txt2}" d="${textPath(saira600, 'HEAVY EQUIPMENT RENTAL', 21, { tracking: 3.2 }).d}"/>
    ${star(lx + subL.width + gap / 2, subY - 7, 8, C.tan)}
    <path transform="translate(${rx.toFixed(1)},${subY})" fill="${C.txt2}" d="${textPath(saira600, 'SULPHUR, LOUISIANA', 21, { tracking: 3.2 }).d}"/>
  </g>
</svg>`;
}

/* ============================================================
 * CONCEPT 2 — "THE DATA-PLATE" · steel plate, rivets, hazard cap
 * ============================================================ */
function concept2() {
  const W = 960, H = 420;
  const px = 40, py = 40, pw = 880, ph = 340, rx = 20;
  const capH = 30;

  const rivet = (x, y) => `
    <circle cx="${x}" cy="${y}" r="7.5" fill="url(#p2-riv)" stroke="#0a0c10" stroke-width="1"/>
    <circle cx="${x - 2.2}" cy="${y - 2.4}" r="2" fill="#4a5462" opacity=".9"/>`;

  // wordmark: RENTAL (steel white) + WRANGLER (the one orange accent)
  const size = 96, tr = 5, sp = 26;
  const w1 = textPath(saira800, 'RENTAL', size, { tracking: tr });
  const w2 = textPath(saira800, 'WRANGLER', size, { tracking: tr });
  const totW = w1.width + sp + w2.width;
  const wx = 480 - totW / 2, wy = 248;

  // micro data row
  const m1 = textPath(saira600, 'HEAVY EQUIPMENT RENTAL', 21, { tracking: 3.6 });
  const m2 = textPath(saira600, 'SULPHUR, LA', 21, { tracking: 3.6 });
  const m3 = textPath(saira600, 'MODEL RW-01', 21, { tracking: 3.6 });
  const mgap = 34, mtot = m1.width + m2.width + m3.width + mgap * 2;
  let mx = 480 - mtot / 2; const my = 302;
  const det = x => `<rect x="${(x - 2.4).toFixed(1)}" y="${my - 9.4}" width="4.8" height="4.8" fill="${C.txt3}" transform="rotate(45 ${x.toFixed(1)} ${my - 7})"/>`;
  const microRow =
    `<path transform="translate(${mx.toFixed(1)},${my})" fill="${C.txt2}" d="${m1.d}"/>` +
    det(mx + m1.width + mgap / 2) +
    `<path transform="translate(${(mx + m1.width + mgap).toFixed(1)},${my})" fill="${C.txt2}" d="${m2.d}"/>` +
    det(mx + m1.width + mgap + m2.width + mgap / 2) +
    `<path transform="translate(${(mx + m1.width + mgap + m2.width + mgap).toFixed(1)},${my})" fill="${C.txt2}" d="${m3.d}"/>`;

  // horseshoe stamp (verbatim geometry from icons.js, scaled), tan
  const hs = `<g transform="translate(453.6,94) scale(2.2)" fill="none" stroke="${C.tan}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 3.5C3.5 6 3 11 5 15.5 6.2 18.3 9 20 12 20s5.8-1.7 7-4.5C21 11 20.5 6 17 3.5"/>
    <path d="M6.5 19.5l-.5 1.5M17.5 19.5l.5 1.5"/>
  </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="none">
  <defs>
    <linearGradient id="p2-steel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.panel1}"/><stop offset="100%" stop-color="${C.panel2}"/>
    </linearGradient>
    <radialGradient id="p2-riv" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#39414d"/><stop offset="100%" stop-color="#10141a"/>
    </radialGradient>
    <pattern id="p2-hazard" patternUnits="userSpaceOnUse" width="26" height="26" patternTransform="rotate(45)">
      <rect width="26" height="26" fill="${C.hazardInk}"/>
      <rect width="13" height="26" fill="${C.hazardY}"/>
    </pattern>
    <clipPath id="p2-plate"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="${rx}"/></clipPath>
  </defs>
  <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="${rx}" fill="url(#p2-steel)" stroke="${C.line}" stroke-width="1.5"/>
  <g clip-path="url(#p2-plate)">
    <rect x="${px}" y="${py}" width="${pw}" height="${capH}" fill="url(#p2-hazard)"/>
    <rect x="${px}" y="${py + capH}" width="${pw}" height="2" fill="#07090c"/>
  </g>
  <rect x="${px + 22}" y="${py + capH + 22}" width="${pw - 44}" height="${ph - capH - 44}" rx="12" fill="none" stroke="${C.lineSoft}" stroke-width="1.5"/>
  ${rivet(px + 40, py + capH + 40)}${rivet(px + pw - 40, py + capH + 40)}${rivet(px + 40, py + ph - 40)}${rivet(px + pw - 40, py + ph - 40)}
  ${hs}
  <path transform="translate(${wx.toFixed(1)},${wy})" fill="${C.txt}" d="${w1.d}"/>
  <path transform="translate(${(wx + w1.width + sp).toFixed(1)},${wy})" fill="${C.accent}" d="${w2.d}"/>
  ${microRow}
</svg>`;
}

/* ============================================================
 * CONCEPT 3 — "THE FRONTIER BADGE" · the intro video, distilled
 * ============================================================ */
function concept3() {
  const W = 820, H = 820, cx = 410, cy = 410;
  const rScene = 246;

  // star field (deterministic)
  const rnd = lcg(20260713);
  let starsF = '';
  for (let i = 0; i < 30; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * (rScene - 14);
    const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
    if (y > cy + 60) continue; // keep stars in the sky
    starsF += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + rnd() * 1.1).toFixed(2)}" fill="#eef" opacity="${(0.3 + rnd() * 0.6).toFixed(2)}"/>`;
  }

  // grazing excavator (bespoke computed silhouette, boom down = head grazing)
  const excavator = (x, y, s, fill, hole) => `
  <g transform="translate(${x},${y}) scale(${s})" fill="${fill}">
    <path d="M -40 -48 Q -80 -64 -98 -38 Q -110 -20 -117 -6" fill="none" stroke="${fill}" stroke-width="13" stroke-linecap="round"/>
    <path d="M -104 -12 L -130 -9 Q -136 2 -124 3 L -103 -1 Z"/>
    <rect x="-58" y="-46" width="102" height="22" rx="4"/>
    <rect x="-10" y="-82" width="52" height="40" rx="7"/>
    <rect x="-52" y="-27" width="104" height="27" rx="13.5"/>
    <circle cx="-30" cy="-13.5" r="6" fill="${hole}"/>
    <circle cx="0" cy="-13.5" r="6" fill="${hole}"/>
    <circle cx="30" cy="-13.5" r="6" fill="${hole}"/>
  </g>`;

  // laser fence (right of the herd — quiet, two beams)
  const post = x => `<rect x="${x}" y="518" width="6" height="46" rx="2" fill="#2a3038"/>
    <circle cx="${x + 3}" cy="516" r="3.4" fill="${C.accent}"/>`;
  const fence = `
    ${post(552)}${post(648)}
    <g stroke="${C.accent}">
      <line x1="558" y1="530" x2="648" y2="530" stroke-width="6" opacity=".18"/>
      <line x1="558" y1="530" x2="648" y2="530" stroke-width="2.2" opacity=".9"/>
      <line x1="558" y1="548" x2="648" y2="548" stroke-width="6" opacity=".18"/>
      <line x1="558" y1="548" x2="648" y2="548" stroke-width="2.2" opacity=".9"/>
    </g>`;

  const topArc = arcText(saira800, 'RENTAL WRANGLER', 58, cx, cy, 277, C.txt, { tracking: 6, dir: 1 });
  const botArc = arcText(zilla600, 'SULPHUR · LOUISIANA', 33, cx, cy, 290, C.tan, { tracking: 4, dir: -1 });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="none">
  <defs>
    <linearGradient id="b3-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3a2166"/>
      <stop offset="45%" stop-color="#241543"/>
      <stop offset="78%" stop-color="#150f28"/>
      <stop offset="100%" stop-color="#0e0a1c"/>
    </linearGradient>
    <radialGradient id="b3-moonhalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${C.purple}" stop-opacity=".32"/>
      <stop offset="100%" stop-color="${C.purple}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="b3-scene"><circle cx="${cx}" cy="${cy}" r="${rScene}"/></clipPath>
  </defs>

  <circle cx="${cx}" cy="${cy}" r="324" fill="#0e1116" stroke="${C.tan}" stroke-width="7"/>
  <circle cx="${cx}" cy="${cy}" r="306" fill="none" stroke="${C.tanDeep}" stroke-width="2.4" stroke-dasharray="10 8"/>

  <g clip-path="url(#b3-scene)">
    <rect x="${cx - rScene}" y="${cy - rScene}" width="${rScene * 2}" height="${rScene * 2}" fill="url(#b3-sky)"/>
    ${starsF}
    <circle cx="505" cy="295" r="132" fill="url(#b3-moonhalo)"/>
    <circle cx="505" cy="295" r="88" fill="#ded6ec"/>
    <circle cx="472" cy="268" r="17" fill="#c9bede" opacity=".85"/>
    <circle cx="533" cy="322" r="11" fill="#c9bede" opacity=".8"/>
    <circle cx="519" cy="266" r="7" fill="#cfc4e2" opacity=".8"/>
    <circle cx="483" cy="322" r="6" fill="#cfc4e2" opacity=".7"/>
    <path d="M 164 492 L 236 492 L 252 466 L 318 466 L 332 492 L 656 492 L 656 540 L 164 540 Z" fill="#1c1636"/>
    <path d="M 164 512 Q 300 498 470 512 T 656 508 L 656 660 L 164 660 Z" fill="#1b1512"/>
    ${excavator(505, 486, 0.42, '#d9ab39', '#1c1636')}
    ${fence}
    ${excavator(330, 570, 1.1, C.hazardY, '#1b1512')}
  </g>
  <circle cx="${cx}" cy="${cy}" r="${rScene + 2}" fill="none" stroke="${C.tanDeep}" stroke-width="4"/>

  ${topArc}
  ${botArc}
  ${star(cx - 292, cy + 6, 10, C.tan)}
  ${star(cx + 292, cy + 6, 10, C.tan)}
</svg>`;
}

/* ---------- emit ---------- */
fs.writeFileSync('logo-1-brand.svg', concept1());
fs.writeFileSync('logo-2-dataplate.svg', concept2());
fs.writeFileSync('logo-3-badge.svg', concept3());
console.log('wrote logo-1-brand.svg, logo-2-dataplate.svg, logo-3-badge.svg');
