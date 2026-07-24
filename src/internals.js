/**
 * internals.js — shared late-binding registry (2026-07-24 module split).
 * ----------------------------------------------------------------------------
 * WHY THIS EXISTS: index.html loads the app as `app.js?v=<token>` (a
 * cache-busting query string — see CLAUDE.md "Cache-bust every deploy").
 * ES modules cache/dedupe by exact resolved URL, so if an extracted
 * src/*.js module did `import {...} from '../app.js'` (no query string),
 * that resolves to a DIFFERENT URL than the one the browser already loaded
 * — the module loader silently evaluates a SECOND, fully independent copy
 * of the entire app.js body (its own IDX, its own state, its own boot()
 * call…) instead of sharing the real one. Confirmed empirically while
 * splitting app.js: a chapter that imported IDX/state back from '../app.js'
 * read from that phantom second copy, which the real app never touches —
 * so tests silently got undefined/stale data instead of a hard error.
 *
 * The fix: nothing imports FROM app.js. Instead app.js writes the internals
 * an extracted chapter still needs onto this ONE shared, non-circular
 * object (APP), and the extracted module reads APP.<name> at CALL TIME
 * (inside a function body — never at module-eval time, since app.js
 * populates APP only after its own top-level chapters have run). Every
 * OTHER module (including app.js) reaches this same file via an ordinary
 * relative specifier, so there is exactly one instance of it — no
 * duplication trap, because it is never anyone's <script> entry point.
 */
export const APP = {};
