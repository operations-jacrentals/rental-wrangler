// CI smoke test — serves the static app, loads it in headless Chromium, and fails
// if anything errors on boot or the login screen doesn't render. Catches the common
// deploy-breakers (syntax errors, bad imports, boot crashes) before they reach the live site.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const root = process.cwd();

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/' || p === '') p = '/index.html';
    const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(8000, r));

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e && e.message || e)));

let failed = false;
try {
  await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);                 // let modules load + boot() run
  const hasLogin = await page.locator('.login-screen').count();
  const appExists = await page.locator('#app').count();
  if (errors.length) { console.error('❌ Console/page errors on boot:\n  - ' + errors.join('\n  - ')); failed = true; }
  if (!appExists) { console.error('❌ #app mount point missing'); failed = true; }
  if (!hasLogin) { console.error('❌ Login screen did not render (boot may have crashed)'); failed = true; }
  if (!failed) console.log('✅ Smoke test passed — app boots clean and the login screen renders.');
} catch (e) {
  console.error('❌ Smoke test threw:', e && e.message || e); failed = true;
} finally {
  await browser.close(); server.close();
}
process.exit(failed ? 1 : 0);
