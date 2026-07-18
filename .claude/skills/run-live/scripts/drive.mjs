// run-live — headless driver for the app. Reuses the pre-provisioned Chromium.
//
// Env knobs:
//   RW_REAL=1   → REAL-DATA run: load /, Ctrl+Alt+P reveals the dev login, sign in with the team
//                 password (RW_PW). A page.route SHIM relays the app's backend calls through Node,
//                 so it gets REAL records even in a CLOUD session — where the headless browser
//                 itself can't reach the backend (the proxy resets Chromium's egress to
//                 script.google.com, but a Node fetch from the shell works fine).
//   RW_WRITES=1 → allow write actions to hit the REAL backend. DEFAULT is READ-ONLY: writes
//                 (sync/set*/save*/charges/sends/uploads) are stubbed {ok:true} so a drive-through
//                 audit can never mutate live data.
//   (default)   → DEMO run: load /#local (data.js seed, no login, no backend). Works anywhere.
//   RW_URL, RW_SHOT, RW_NAME, RW_CHROME → overrides.
//
// Chromium: the headless-shell build (the full chrome errors "Old Headless mode has been removed").
// Playwright is CJS under ESM import → chromium is on .default.

const BACKEND = 'https://script.google.com/macros/s/AKfycbzHahzgJqOYe9o4GKlRVGh-A7USRn1k4Dvyy4ajLh8EYCqVxofouM28qs8trNlObZw/exec';
// Anything that MUTATES live data — blocked in read-only mode. `sync` is the big one (the app's
// debounced save); the rest are money moves, config/pref writes, sends, and uploads.
const WRITE_ACTIONS = /^(sync|seed|set[A-Z]|save[A-Z]|stripe(Charge|Finalize|Refund|Save|Set|Remove|Lock|Unlock)|recordManual(Payment|Refund)|membership(Enroll|Cancel|Reactivate)|uploadFile|uploadCapture|archive|sendCustomerMessage|wrangler(Approve|Dismiss|Comment|File))/;

const pwMod = await import(new URL('../../../../node_modules/playwright/index.js', import.meta.url).href)
  .catch(() => import('playwright'));
const chromium = pwMod.chromium || (pwMod.default && pwMod.default.chromium);
const EXE = process.env.RW_CHROME
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const REAL = process.env.RW_REAL === '1';
const READONLY = process.env.RW_WRITES !== '1';
const SHOT = process.env.RW_SHOT || 'run-live.png';
const URL_ = REAL ? 'http://localhost:9147/' : (process.env.RW_URL || 'http://localhost:9147/#local');

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errs.push('PE:' + (e.message || '').slice(0, 160)));

// ── REAL-DATA SHIM ── the headless browser can't reach the GAS backend (hard-blocked in cloud),
// but Node can. Intercept the app's calls to script.google.com and relay them through a Node fetch.
// Read-only by default: write actions are stubbed so a drive-through never mutates live records.
let relayed = 0, stubbed = 0;
if (REAL) {
  await page.route((u) => u.hostname === 'script.google.com', async (route) => {
    const body = route.request().postData() || '';
    let action = ''; try { action = (JSON.parse(body).action) || ''; } catch (e) {}
    if (READONLY && WRITE_ACTIONS.test(action)) {
      stubbed++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, readonly: true }) });
    }
    try {
      const r = await fetch(BACKEND, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
      relayed++;
      route.fulfill({ status: 200, contentType: 'application/json', body: await r.text() });
    } catch (e) {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'shim-fetch-failed' }) });
    }
  });
}

// waitUntil:'domcontentloaded' (NOT 'load' — the login intro <video preload> hangs the load event).
await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForSelector('.login-screen, #login-name, [id^="pid-"], [data-card]', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);

const out = { mode: REAL ? 'real' : 'demo', url: URL_ };
if (REAL) out.readonly = READONLY;

if (REAL) {
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown',
    { ctrlKey: true, altKey: true, code: 'KeyP', key: 'p', bubbles: true })));
  await page.waitForTimeout(600);
  const pw = process.env.RW_PW;
  out.revealed = (await page.locator('#login-pw').count()) > 0;
  if (out.revealed && pw) {
    await page.fill('#login-name', process.env.RW_NAME || 'Claude (run-live)');
    await page.fill('#login-pw', pw);
    await page.click('#login-go');
    await page.waitForTimeout(14000);   // slow GAS round-trip, relayed via Node
    out.cards = await page.locator('[data-card]').count();
    out.signedIn = (await page.locator('#login-pw, .login-screen').count()) === 0 && out.cards > 0;
    out.loginErr = await page.locator('#login-err').innerText().catch(() => '');
    out.relayed = relayed; out.stubbed = stubbed;
  } else if (!pw) {
    out.hint = 'RW_PW not set — set the team password env var to sign in (never hardcode it).';
  }
} else {
  out.cards = await page.locator('[data-card]').count();
  out.populated = out.cards > 0;
}

await page.screenshot({ path: SHOT });
out.shot = SHOT; out.errors = errs.slice(0, 6);
console.log('RUN-LIVE ' + JSON.stringify(out, null, 2));
await browser.close();
