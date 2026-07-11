/* Rental Wrangler service worker — OFFLINE SHELL ONLY (spec frontend-performance P1, Jac 2026-06-29).
 * Registered ONLY on the production origin (see swInit in app.js) with ?v=<deploy token>, which
 * becomes the cache name — bumping ?v= in index.html rolls the SW cache in lockstep (R13 guard).
 *
 * SECURITY MODEL — allowlist BY CONSTRUCTION (spec §3.2, non-negotiable):
 * only the static, public app-shell assets below are ever cache.put(). Anything else —
 * every POST (backendCall is always POST), the GAS backend origin, Stripe, Maps, fonts —
 * passes straight to the network and is NEVER written to any cache. No data response,
 * no PII, no pricing can touch Cache Storage. Navigation fallback serves the cached
 * index.html shell only; the data layer then shows its own offline (R25) state. */
const TOKEN = (self.location.search.match(/v=([\w-]+)/) || [])[1] || 'dev';
const CACHE = 'rw-shell-' + TOKEN;
const SHELL = ['./', './index.html', './app.js', './style.css', './config.js', './data.js',
  './cascade.js', './icons.js', './icons-anim.js', './agreements.js', './service-countdown.js',
  './rule-usage.js', './manifest.webmanifest'];
const SHELL_SET = new Set(SHELL.map((p) => new URL(p, self.location.href).pathname));

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  // purge EVERY prior-version cache (never rely on query-string match — R13)
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                                   // every backendCall is a POST → network-only
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                    // third-party (Stripe/Maps/fonts/GAS) → network-only
  const isNav = req.mode === 'navigate';
  if (!isNav && !SHELL_SET.has(url.pathname)) return;                 // not on the shell allowlist → network-only, never cached
  // stale-while-revalidate on the shell; navigation falls back to the cached index.html offline
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(isNav ? './index.html' : req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res && res.ok) c.put(isNav ? './index.html' : req, res.clone()); return res; }).catch(() => null);
    return hit || net.then((r) => r || new Response('offline', { status: 503 }));
  }));
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
