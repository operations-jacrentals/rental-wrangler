// promote-freshness.mjs — content-verified staging freshness for tools/promote.mjs.
//
// WHY THIS EXISTS
// The staging-freshness gate asks: "is the live staging slot showing the EXACT bytes we're
// about to promote to production?" It used to answer by comparing the `app.js?v=<token>`
// cache-bust marker in index.html. But that token is HAND-BUMPED per deploy (…o → …p → …q),
// NOT derived from file contents — so two INDEPENDENT deploys of DIFFERENT code can land on
// the SAME token on the same day. Comparing only the token then reports "fresh" when a slot is
// actually serving different bytes (a real collision was observed 2026-07-17: a throwaway test
// deploy reached ?v=…p, the same token trunk happened to hold, so the token check matched
// despite different code). At N=3 the multi-slot scan widens the collision surface.
//
// THE FIX: keep the token as a cheap PRE-FILTER, but make an authoritative CONTENT HASH the
// source of truth. We hash the files the shared ?v= token versions (app.js / style.css /
// rule-usage.js, per CLAUDE.md) and a slot is fresh ONLY when its served bytes hash-match
// trunk. This closes both failure modes: the false POSITIVE (token collision → "fresh" when
// bytes differ) and the false NEGATIVE (a collision making the scan pick the wrong slot).
//
// PURE + TESTABLE: this module does NO I/O. promote.mjs injects a `probe(id)` that curls the
// slot + hashes it, and reads trunk bytes via `git show`. That keeps the go-live tool's flow
// intact and lets ci/promote-test.mjs exercise every branch with zero network.

import { createHash } from 'node:crypto';

// The served files the shared ?v= cache-bust token versions (CLAUDE.md: "bump the shared ?v=
// on style.css, rule-usage.js, and app.js"). Hashing exactly these is the faithful answer to
// "are the meaningful served bytes trunk's bytes?" — app.js is where features live; the other
// two carry design + the R-rulebook usage map.
export const FRESHNESS_FILES = ['app.js', 'style.css', 'rule-usage.js'];

// Newline-normalize before hashing so a CRLF-vs-LF checkout (e.g. a deploy from a Windows box
// vs. `git show` on a Linux promote host) can never cause a FALSE mismatch. Real content
// differences still register; only \r is neutralized.
export function normalizeForHash(text) {
  return String(text == null ? '' : text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// A deterministic SHA-256 over FRESHNESS_FILES. `read(file)` returns the file's raw text, or
// null/undefined if it couldn't be read (hashed as empty — which can never equal a present
// file's hash, so a missing/unreachable file is correctly "not fresh"). Each file's bytes are
// bound to its name + delimited, so a rename/reorder can't produce a coincidental match.
export function contentHash(read) {
  const h = createHash('sha256');
  for (const f of FRESHNESS_FILES) {
    h.update(f);
    h.update('\0');
    h.update(normalizeForHash(read(f)));
    h.update('\0');
  }
  return h.digest('hex');
}

// Resolve which staging slot (if any) is genuinely showing trunk's bytes.
//
//   opts.expectedToken — trunk index.html's ?v= token (cheap pre-filter / diagnostics).
//   opts.expectedHash  — trunk's contentHash over FRESHNESS_FILES (the AUTHORITY).
//   opts.slotArg       — a `--slot N` human pin (integer), or NaN/undefined to auto-resolve.
//   deps.slotIds       — configured slot ids, e.g. [1,2,3].
//   deps.urlOf(id)     — a slot's display URL (for messaging).
//   deps.probe(id)     — { token, hash } | { error } for a slot: token from its index.html,
//                        hash over its served FRESHNESS_FILES. Injected → this fn does NO I/O.
//
// Returns { slotId, resolvedBy, fresh, probe, probes, badPin }:
//   resolvedBy: 'flag' (pinned) | 'content' (bytes matched) | 'collision' (token matched but
//               bytes differ) | 'none' (nothing matched).
//   fresh: TRUE only when the resolved slot's content hash === expectedHash.
//   badPin: true when --slot named an unconfigured id (caller should fail loudly).
export function resolveFreshSlot({ expectedToken, expectedHash, slotArg }, deps) {
  const ids = [...deps.slotIds].sort((a, b) => a - b);
  const probeOf = (id) => ({ id, url: deps.urlOf(id), ...deps.probe(id) });

  // --slot pin: check exactly that slot; the content hash is still the authority.
  if (Number.isInteger(slotArg)) {
    if (!ids.includes(slotArg)) {
      return { slotId: slotArg, resolvedBy: 'flag', fresh: false, probe: null, probes: null, badPin: true };
    }
    const p = probeOf(slotArg);
    const fresh = !p.error && !!expectedHash && p.hash === expectedHash;
    return { slotId: slotArg, resolvedBy: 'flag', fresh, probe: p, probes: [p], badPin: false };
  }

  // Auto-resolve: probe each slot ONCE. The fresh slot is the one whose CONTENT matches trunk
  // (not merely its token) — so a token collision can neither fake freshness nor steer the pick
  // to the wrong slot. A slot whose token matches but whose content does not is recorded as a
  // 'collision' for a precise diagnostic, but is NOT fresh.
  const probes = ids.map(probeOf);
  const byContent = expectedHash ? probes.find((p) => !p.error && p.hash === expectedHash) : null;
  if (byContent) return { slotId: byContent.id, resolvedBy: 'content', fresh: true, probe: byContent, probes, badPin: false };
  const byTokenOnly = expectedToken ? probes.find((p) => !p.error && p.token === expectedToken) : null;
  if (byTokenOnly) return { slotId: byTokenOnly.id, resolvedBy: 'collision', fresh: false, probe: byTokenOnly, probes, badPin: false };
  return { slotId: ids[0], resolvedBy: 'none', fresh: false, probe: null, probes, badPin: false };
}
