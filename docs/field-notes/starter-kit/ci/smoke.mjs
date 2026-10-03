#!/usr/bin/env node
/**
 * smoke.mjs — "does it boot?" Write this BEFORE feature one.
 *
 *   node ci/smoke.mjs
 *
 * Serves the project statically, loads it, and asserts the basics. Two modes,
 * picked automatically:
 *
 *   • Playwright installed  → real browser: catches console errors, JS
 *     exceptions, failed requests, and checks a rendered element.
 *   • Playwright missing    → HTTP-only fallback: the page serves, is not
 *     empty, and every local asset it references resolves.
 *
 * The fallback exists so this never becomes the test nobody can run. CI
 * installs Playwright and gets the strict version; a laptop gets the useful
 * subset. Neither one is allowed to be skipped.
 *
 * No dependencies required. Node 18+.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

// ── configure ────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const PORT = Number(process.env.SMOKE_PORT || 9147);   // NOT 8000 — that's usually taken
const ENTRY = '/index.html';
const MUST_RENDER = 'body';        // a selector that proves the app actually drew something
const MUST_CONTAIN = [];           // optional: strings that must appear in the served HTML
// ─────────────────────────────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
};

const fail = (msg) => { console.error('✗ ' + msg); process.exitCode = 1; };
const pass = (msg) => console.log('✓ ' + msg);

function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        let p = decodeURIComponent(req.url.split('?')[0]);
        if (p === '/') p = ENTRY;
        const safe = normalize(p).replace(/^(\.\.[/\\])+/, '');
        const data = await readFile(join(ROOT, safe));
        res.writeHead(200, {
          'Content-Type': MIME[extname(safe)] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      } catch {
        res.writeHead(404); res.end('Not found');
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function withBrowser(base) {
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch { return false; }

  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('exception: ' + e.message));
  page.on('requestfailed', (r) => errors.push('request failed: ' + r.url()));

  await page.goto(base + ENTRY, { waitUntil: 'networkidle' });
  const rendered = await page.locator(MUST_RENDER).count();
  const text = (await page.textContent('body')) || '';
  await browser.close();

  if (errors.length) errors.forEach((e) => fail(e)); else pass('no console errors, exceptions or failed requests');
  if (rendered > 0) pass(`rendered ${MUST_RENDER}`); else fail(`nothing matched ${MUST_RENDER}`);
  if (text.trim().length > 0) pass('page produced visible text'); else fail('page rendered but is empty');
  return true;
}

async function withoutBrowser(base) {
  const res = await fetch(base + ENTRY);
  if (!res.ok) return fail(`${ENTRY} returned ${res.status}`);
  const html = await res.text();
  if (html.trim().length < 50) return fail(`${ENTRY} is suspiciously empty`);
  pass(`${ENTRY} serves (${html.length} bytes)`);

  for (const needle of MUST_CONTAIN) {
    if (html.includes(needle)) pass(`contains "${needle}"`);
    else fail(`missing "${needle}"`);
  }

  // every local asset the entry references must resolve
  const refs = [...html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)]
    .map((m) => m[1])
    .filter((u) => !/^(https?:)?\/\//.test(u) && !u.startsWith('data:') && !u.startsWith('mailto:'));

  let broken = 0;
  for (const ref of [...new Set(refs)]) {
    const url = base + (ref.startsWith('/') ? ref : '/' + ref);
    const r = await fetch(url.split('?')[0]).catch(() => null);
    if (!r || !r.ok) { fail(`broken local reference: ${ref}`); broken++; }
  }
  if (!broken) pass(`all ${new Set(refs).size} local references resolve`);
}

// ── run ──────────────────────────────────────────────────────────────────────
if (!existsSync(join(ROOT, ENTRY.slice(1)))) {
  console.error(`✗ no ${ENTRY} in ${ROOT} — set ENTRY at the top of ci/smoke.mjs`);
  process.exit(1);
}

const server = await serve();
const base = `http://localhost:${PORT}`;
console.log(`smoke: serving ${ROOT} on ${base}`);

try {
  const usedBrowser = await withBrowser(base);
  if (!usedBrowser) {
    console.log('  (playwright not installed — running HTTP-only checks)');
    await withoutBrowser(base);
  }
} finally {
  server.close();
}

if (process.exitCode) console.error('\nsmoke FAILED');
else console.log('\nsmoke passed');
