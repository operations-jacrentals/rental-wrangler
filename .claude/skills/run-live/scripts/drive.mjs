// run-live — headless driver for the app. Reuses the pre-provisioned Chromium.
//
// Env knobs:
//   RW_REAL=1        → REAL-DATA run: load /, press Ctrl+Alt+P, sign in with the team
//                      password (RW_PW) against the LIVE backend. Only works where the
//                      backend is reachable (a LOCAL session — NOT cloud).
//   (default)        → DEMO run: load /#local (seed data, no login, no backend). Works anywhere.
//   RW_URL=<url>     → override the URL (demo mode only; default http://localhost:9147/#local).
//   RW_SHOT=<path>   → screenshot path (default ./run-live.png).
//   RW_NAME=<name>   → operator name for the real-data login (default "Claude (dev)").
//
// Chromium: use the headless-shell build — the full chrome errors "Old Headless mode has
// been removed". Playwright is a CJS module under ESM import → chromium is on .default.

const pwMod = await import(new URL('../../../../node_modules/playwright/index.js', import.meta.url).href)
  .catch(() => import('playwright'));
const chromium = pwMod.chromium || (pwMod.default && pwMod.default.chromium);
const EXE = process.env.RW_CHROME
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const REAL = process.env.RW_REAL === '1';
const SHOT = process.env.RW_SHOT || 'run-live.png';
const URL_ = REAL ? 'http://localhost:9147/' : (process.env.RW_URL || 'http://localhost:9147/#local');

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errs.push('PE:' + (e.message || '').slice(0, 160)));

// waitUntil:'domcontentloaded' (NOT 'load' — the login intro <video preload> hangs the load event).
await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForSelector('.login-screen, #login-name, [id^="pid-"], [data-card]', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);

const out = { mode: REAL ? 'real' : 'demo', url: URL_ };

if (REAL) {
  // Reveal the dev password login (localhost only) and sign in against the live backend.
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown',
    { ctrlKey: true, altKey: true, code: 'KeyP', key: 'p', bubbles: true })));
  await page.waitForTimeout(600);
  const pw = process.env.RW_PW;
  out.revealed = (await page.locator('#login-pw').count()) > 0;
  if (out.revealed && pw) {
    await page.fill('#login-name', process.env.RW_NAME || 'Claude (dev)');
    await page.fill('#login-pw', pw);
    await page.click('#login-go');
    await page.waitForTimeout(14000);   // the live load is a slow GAS round-trip
    out.cards = await page.locator('[data-card]').count();
    out.signedIn = (await page.locator('#login-pw, .login-screen').count()) === 0 && out.cards > 0;
    out.loginErr = await page.locator('#login-err').innerText().catch(() => '');
    if (!out.signedIn) out.hint = 'Backend unreachable? Real-data runs need a LOCAL session (cloud proxy blocks script.google.com).';
  } else if (!pw) {
    out.hint = 'RW_PW not set — set the team password env var to sign in (never hardcode it).';
  }
} else {
  out.cards = await page.locator('[data-card]').count();
  out.populated = out.cards > 0;
}

await page.screenshot({ path: SHOT });
out.shot = SHOT;
out.errors = errs.slice(0, 6);
console.log('RUN-LIVE ' + JSON.stringify(out, null, 2));
await browser.close();
