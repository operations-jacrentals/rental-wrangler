// Verify the shortened housing kept BOTH bevel bands byte-identical to the original,
// and that only the interior lost rows. Guarded on distinct-colour count per ledger #282
// (blank-vs-blank reports a perfect 0% match).
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const [origPath, shortPath] = process.argv.slice(2);
const uri = p => 'data:image/png;base64,' + readFileSync(p).toString('base64');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const page = await browser.newPage();
await page.goto('about:blank');

const out = await page.evaluate(async ([a, b]) => {
  const load = async (u) => {
    const img = new Image(); img.src = u; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    return { W: c.width, H: c.height, d: x.getImageData(0, 0, c.width, c.height).data };
  };
  const A = await load(a), B = await load(b);

  const colours = (img, y0, y1) => {
    const s = new Set();
    for (let y = y0; y < y1; y++) for (let x = 0; x < img.W; x++) {
      const i = (y * img.W + x) * 4;
      s.add(img.d[i] + ',' + img.d[i+1] + ',' + img.d[i+2] + ',' + img.d[i+3]);
      if (s.size > 200) return s.size;
    }
    return s.size;
  };

  // compare band [ay0,ay1) of A against [by0,by1) of B
  const cmp = (ay0, by0, rows) => {
    let differ = 0, maxDelta = 0, total = rows * A.W;
    for (let r = 0; r < rows; r++) {
      for (let x = 0; x < A.W; x++) {
        const i = ((ay0 + r) * A.W + x) * 4, j = ((by0 + r) * B.W + x) * 4;
        let m = 0;
        for (let k = 0; k < 4; k++) m = Math.max(m, Math.abs(A.d[i+k] - B.d[j+k]));
        if (m > 0) differ++;
        if (m > maxDelta) maxDelta = m;
      }
    }
    return { differPct: Math.round(differ / total * 10000) / 100, maxDelta, total };
  };

  const TOPROWS = 28, BOTROWS = 25;
  return {
    A: { W: A.W, H: A.H }, B: { W: B.W, H: B.H },
    topColoursOrig: colours(A, 0, TOPROWS),
    topColoursShort: colours(B, 0, TOPROWS),
    top: cmp(0, 0, TOPROWS),
    bottom: cmp(A.H - BOTROWS, B.H - BOTROWS, BOTROWS)
  };
}, [uri(origPath), uri(shortPath)]);

await browser.close();

console.log(`original ${out.A.W}x${out.A.H}   short ${out.B.W}x${out.B.H}   (removed ${out.A.H - out.B.H} rows)`);
console.log(`\nnon-blank guard — distinct colours in top band: original ${out.topColoursOrig}, short ${out.topColoursShort}`);
if (out.topColoursOrig < 3 || out.topColoursShort < 3) { console.log('BLANK — measurement meaningless, abort'); process.exit(1); }
console.log(`\nTOP bevel    (28 rows): ${out.top.differPct}% differ, max delta ${out.top.maxDelta}`);
console.log(`BOTTOM bevel (25 rows): ${out.bottom.differPct}% differ, max delta ${out.bottom.maxDelta}`);
console.log(out.top.maxDelta === 0 && out.bottom.maxDelta === 0
  ? '\nBOTH BEVELS BYTE-IDENTICAL — only the interior changed.'
  : '\nBevels changed — investigate.');
