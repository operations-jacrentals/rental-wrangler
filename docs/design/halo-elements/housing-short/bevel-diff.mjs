// Localise WHERE the bevel bands differ, by column, so we can tell
// "the bevel frame changed" from "a diagonal that crosses the bevel changed slope".
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

  const bandCols = (ay0, by0, rows) => {
    const cols = new Set();
    for (let r = 0; r < rows; r++) for (let x = 0; x < A.W; x++) {
      const i = ((ay0 + r) * A.W + x) * 4, j = ((by0 + r) * B.W + x) * 4;
      let m = 0; for (let k = 0; k < 4; k++) m = Math.max(m, Math.abs(A.d[i+k] - B.d[j+k]));
      if (m > 0) cols.add(x);
    }
    // compress to ranges
    const s = [...cols].sort((p, q) => p - q), out = [];
    let st = s[0], pv = s[0];
    for (const x of s.slice(1)) { if (x !== pv + 1) { out.push([st, pv]); st = x; } pv = x; }
    if (s.length) out.push([st, pv]);
    return out;
  };
  return { top: bandCols(0, 0, 28), bottom: bandCols(A.H - 25, B.H - 25, 25), W: A.W };
}, [uri(origPath), uri(shortPath)]);

await browser.close();

const known = [[80, 115, 'Group 1 diagonal'], [539, 574, 'Group 2 diagonal'], [979, 1014, 'Group 3 diagonal'], [1042, 1156, 'Vector 2 right flank']];
const label = ([a, b]) => {
  const hit = known.find(k => a >= k[0] - 12 && b <= k[1] + 12);
  return hit ? hit[2] : '** UNEXPLAINED **';
};
for (const [name, ranges] of [['TOP', out.top], ['BOTTOM', out.bottom]]) {
  console.log(`\n${name} bevel — differing column ranges (image is ${out.W}px wide):`);
  if (!ranges.length) { console.log('  none — byte-identical'); continue; }
  for (const r of ranges) console.log(`  x ${String(r[0]).padStart(4)}–${String(r[1]).padEnd(4)}  ${String(r[1]-r[0]+1).padStart(4)}px   ${label(r)}`);
  const unexplained = ranges.filter(r => label(r).startsWith('**'));
  console.log(`  → ${ranges.length} range(s), ${unexplained.length} unexplained`);
}
