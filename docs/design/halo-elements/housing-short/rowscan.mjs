// Where do adjacent rows actually differ? A row-pair that differs at only a handful of
// x positions is a "flat" band whose only variation is the angled side edges — that is
// the band you can shorten. A row-pair differing across many columns carries real detail.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const png = readFileSync(process.argv[2]);
const dataUri = 'data:image/png;base64,' + png.toString('base64');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const page = await browser.newPage();
await page.goto('about:blank');

const r = await page.evaluate(async (uri) => {
  const img = new Image(); img.src = uri; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;
  const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i+1], d[i+2], d[i+3]]; };

  const distinct = new Set();
  for (let i = 0; i < d.length; i += 4) { distinct.add(d.slice(i, i+4).join(',')); if (distinct.size > 64) break; }

  const rows = [];
  for (let y = 1; y < H; y++) {
    const cols = [];
    for (let x = 0; x < W; x++) {
      const a = px(x, y - 1), b = px(x, y);
      let m = 0; for (let k = 0; k < 4; k++) m = Math.max(m, Math.abs(a[k] - b[k]));
      if (m > 8) cols.push(x);
    }
    rows.push({ y, n: cols.length,
      lo: cols.length ? cols[0] : null,
      hi: cols.length ? cols[cols.length - 1] : null,
      // how much of the differing action sits in the outer 200px on each side
      edgeOnly: cols.length ? cols.every(x => x < 220 || x > W - 220) : true });
  }
  return { W, H, distinct: distinct.size, rows };
}, dataUri);

await browser.close();

console.log(`image ${r.W}x${r.H}  distinct colours (capped) ${r.distinct}`);
if (r.distinct < 3) { console.log('BLANK — abort'); process.exit(1); }

console.log('\ny    diffcols  x-range        edges-only');
for (const x of r.rows) {
  const bar = '#'.repeat(Math.min(40, Math.round(x.n / 25)));
  console.log(
    String(x.y).padStart(3) + '  ' +
    String(x.n).padStart(5) + '  ' +
    (x.lo === null ? '     -       ' : (String(x.lo).padStart(4) + '–' + String(x.hi).padEnd(5))).padEnd(14) +
    (x.edgeOnly ? ' EDGES' : '      ') + ' ' + bar);
}

const flat = r.rows.filter(x => x.edgeOnly);
console.log(`\nrows whose only change is at the two side edges: ${flat.length}`);
if (flat.length) {
  let start = flat[0].y, prev = flat[0].y, runs = [];
  for (const f of flat.slice(1)) {
    if (f.y !== prev + 1) { runs.push([start, prev]); start = f.y; }
    prev = f.y;
  }
  runs.push([start, prev]);
  for (const [a, b] of runs) console.log(`  y ${a}–${b}  (${b - a + 1} rows)`);
}
