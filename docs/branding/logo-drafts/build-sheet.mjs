/* build-sheet.mjs — assemble the review sheet from the generated SVGs */
import fs from 'node:fs';
const svg1 = fs.readFileSync('logo-1-brand.svg', 'utf8');
const svg2 = fs.readFileSync('logo-2-dataplate.svg', 'utf8');
const svg3 = fs.readFileSync('logo-3-badge.svg', 'utf8');
const saira = fs.readFileSync('fonts/SairaCondensed-600.ttf').toString('base64');

const plate = (cls, num, name, why, svg) => `
<div class="plate ${cls}"><h2>${num} · ${name}</h2><div class="why">${why}</div><div class="art">${svg}</div></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rental Wrangler — Logo Drafts</title>
<style>
@font-face{font-family:'Saira Condensed';src:url(data:font/ttf;base64,${saira}) format('truetype');font-weight:600}
*{margin:0;box-sizing:border-box}
body{background:#0b0c0f;color:#e9edf4;font-family:'Saira Condensed',sans-serif;padding:36px 44px 44px}
h1{font-size:26px;letter-spacing:2.5px;text-transform:uppercase;font-weight:600}
.sub{color:#6b7480;font-size:13px;letter-spacing:1.6px;text-transform:uppercase;margin:6px 0 26px}
.grid{display:grid;gap:22px}
.plate{background:linear-gradient(180deg,#1b2129,#0c0e11);border:1px solid #262a31;border-radius:14px;padding:22px 26px 26px}
.plate h2{font-size:15px;letter-spacing:2px;text-transform:uppercase;color:#a7afbc;font-weight:600}
.plate .why{color:#6b7480;font-size:12.5px;letter-spacing:1px;text-transform:uppercase;margin-top:3px}
.art{display:flex;justify-content:center;margin-top:10px}
.art svg{max-width:100%;height:auto}
.p1 .art svg{width:560px}.p2 .art svg{width:760px}.p3 .art svg{width:540px}
</style></head><body>
<h1>Rental Wrangler — logo drafts · round 1</h1>
<div class="sub">Three directions off the intro video · dark-surface primaries · light &amp; one-color variants after a direction is picked</div>
<div class="grid">
${plate('p1', '01', 'The Brand', 'Branding-iron RW inside a lasso ring — “brand” both ways · leather tan + slab voice', svg1)}
${plate('p2', '02', 'The Data-Plate', 'Steel plate, hazard cap, rivets, one orange ignition word — closest to the app', svg2)}
${plate('p3', '03', 'The Frontier Badge', 'The video distilled — purple sky, moon, grazing excavators, laser fence, rope ring', svg3)}
</div></body></html>`;
fs.writeFileSync('index.html', html);
console.log('sheet built,', (html.length / 1024).toFixed(0) + 'KB');
