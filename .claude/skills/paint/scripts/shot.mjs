// Render the recreation at the mockup's NATIVE size (never resized — a resized
// screenshot cannot be used to judge color or edges).
//   node shot.mjs <recreation.html> <out.png> <width> <height> [grayscale]
// Pass `grayscale` for the grisaille check (step 7 of the master-copy workflow).
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const [file, out, w, h, gray] = process.argv.slice(2);
if (!file || !out || !w || !h) {
  console.error('usage: node shot.mjs <recreation.html> <out.png> <width> <height> [grayscale]');
  process.exit(1);
}
const width = Number(w), height = Number(h);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await p.goto('file://' + (file.startsWith('/') ? file : process.cwd() + '/' + file));
if (gray === 'grayscale') await p.addStyleTag({ content: 'html{filter:grayscale(1)}' });
await p.waitForTimeout(400);
await p.screenshot({ path: out, clip: { x: 0, y: 0, width, height } });
await b.close();
console.log('shot', out, `${width}x${height}`, gray === 'grayscale' ? '(grayscale)' : '');
