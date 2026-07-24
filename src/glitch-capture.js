/**
 * glitch-capture.js — Rental Wrangler glitch capture (moved from app.js APP-01
 * · §0.7 GLITCH CAPTURE, 2026-07-24 module split).
 * ----------------------------------------------------------------------------
 * A small ring buffer of recent JS errors, so when you hand a glitch to Mr.
 * Wrangler the repro packet carries what actually broke (the single most
 * useful clue for the auto-fixer). Installed first thing so it catches
 * boot-time errors too. Kept tiny + best-effort — never throws itself.
 * Pure relocation: same functions, same behavior, just callable via import.
 */
export const ERR_LOG = [];
export function logErr(kind, msg) {
  try {
    const t = new Date().toTimeString().slice(0, 8);
    ERR_LOG.push(`[${t}] ${kind}: ${String(msg).replace(/\s+/g, ' ').slice(0, 300)}`);
    if (ERR_LOG.length > 30) ERR_LOG.shift();
  } catch (_) {}
}
window.addEventListener('error', (e) => logErr('error', (e.message || 'error') + (e.filename ? ` @ ${String(e.filename).split('/').pop()}:${e.lineno || '?'}` : '')));
window.addEventListener('unhandledrejection', (e) => logErr('promise', (e.reason && (e.reason.message || e.reason)) || 'unhandled rejection'));
{ const _ce = console.error; console.error = function (...a) { try { logErr('console', a.map((x) => (x && x.message) || x).join(' ')); } catch (_) {} return _ce.apply(this, a); }; }

/* The public repo this app fixes itself through (Track B — see docs/wrangler-pipeline.md).
   A glitch handed to Mr. Wrangler becomes a `wrangler-fix` GitHub issue that the
   Action engine reproduces, patches, gate-checks, and auto-merges to live. The
   browser can't hold a token, so we open a PRE-FILLED issue (one Submit tap). */
const WRANGLER_REPO = 'operations-jacrentals/rental-wrangler';
// label 'wrangler-fix' → the auto-fix Action runs (glitches). 'wrangler-request'
// → filed for Jac's OK, NOT auto-implemented (he can add the fix label to greenlight).
export function wranglerIssueUrl(title, body, label = 'wrangler-fix') {
  const u = new URL(`https://github.com/${WRANGLER_REPO}/issues/new`);
  u.searchParams.set('title', String(title || 'Reported glitch').slice(0, 120));
  u.searchParams.set('labels', label);
  u.searchParams.set('body', String(body || '').slice(0, 6000));   // GitHub URL body cap headroom
  return u.toString();
}
