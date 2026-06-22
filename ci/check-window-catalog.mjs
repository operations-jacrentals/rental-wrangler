// CI guard: verifies that WINDOW_CATALOG lists exactly the popup kinds that
// buildPopupEl handles — no missing entries, no stale entries. (Jac 2026-06-22)
import { readFile } from 'fs/promises';
const src = await readFile(new URL('../app.js', import.meta.url), 'utf8');

// ── Isolate buildPopupEl body ─────────────────────────────────────────────
// Slice from `function buildPopupEl` to (but not including) `const openOverlay =`.
// This excludes o.kind references in event handlers and other functions.
const fnStart = src.indexOf('function buildPopupEl');
const fnEnd   = src.indexOf('const openOverlay =', fnStart);
if (fnStart === -1 || fnEnd === -1) {
  console.error('✗ Could not locate buildPopupEl / openOverlay in app.js');
  process.exit(1);
}
const fnBody = src.slice(fnStart, fnEnd);

// ── Extract kinds from buildPopupEl ──────────────────────────────────────
// Only keep plain string literals — filter out template-literal references like
// `o.kind === '${w.kind}'` (a doc string inside the rulebook branch).
const builtKinds = new Set(
  [...fnBody.matchAll(/o\.kind\s*===\s*'([^']+)'/g)]
    .map((m) => m[1])
    .filter((k) => !k.includes('$') && !k.includes('{'))
);

// ── Isolate WINDOW_CATALOG array ─────────────────────────────────────────
// Slice from `const WINDOW_CATALOG = [` to its closing `];` so we don't pick up
// `{ kind: '...' }` shapes elsewhere in the file (board columns, etc.).
const catStart = src.indexOf('const WINDOW_CATALOG = [');
const catEnd   = src.indexOf('];', catStart);
if (catStart === -1 || catEnd === -1) {
  console.error('✗ Could not locate WINDOW_CATALOG array in app.js');
  process.exit(1);
}
const catBody = src.slice(catStart, catEnd + 2);

// ── Extract kinds from WINDOW_CATALOG ────────────────────────────────────
const catalogKinds = new Set(
  [...catBody.matchAll(/\{\s*kind:\s*'([^']+)'/g)].map((m) => m[1])
);

// ── Compare ───────────────────────────────────────────────────────────────
const missingFromCatalog = [...builtKinds].filter((k) => !catalogKinds.has(k)).sort();
const staleInCatalog     = [...catalogKinds].filter((k) => !builtKinds.has(k)).sort();

let failed = false;
if (missingFromCatalog.length) {
  console.error(`✗ ${missingFromCatalog.length} popup kind(s) built in buildPopupEl but MISSING from WINDOW_CATALOG:`);
  for (const k of missingFromCatalog) console.error(`    missing: '${k}'`);
  failed = true;
}
if (staleInCatalog.length) {
  console.error(`✗ ${staleInCatalog.length} kind(s) in WINDOW_CATALOG have NO matching branch in buildPopupEl (stale):`);
  for (const k of staleInCatalog) console.error(`    stale:   '${k}'`);
  failed = true;
}
if (failed) process.exit(1);

console.log(`✓ window catalog covers all ${builtKinds.size} popup kinds.`);
