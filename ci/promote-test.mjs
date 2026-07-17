// promote-test.mjs — pure-Node tests for the content-verified staging-freshness resolver.
//
// NO network, NO browser, NO Playwright — this is NOT part of the port-8000→9147 swap. It
// imports the PURE helpers from tools/lib/promote-freshness.mjs (normalizeForHash / contentHash
// / resolveFreshSlot) and drives resolveFreshSlot with a fully in-memory `probe`, so every
// freshness branch (content-match, token-collision, multi-slot pick, --slot pin, none,
// unreachable, N=1) is exercised without touching git or the network.
//
// Reporting idiom mirrors ci/logic-test.mjs / ci/lease-test.mjs: collect {ok,m}, print ✓/✗,
// process.exit(anyFail?1:0).

import { normalizeForHash, contentHash, resolveFreshSlot } from '../tools/lib/promote-freshness.mjs';

const results = [];
const ok = (c, m) => results.push({ ok: !!c, m });
function group(label, fn) {
  try { fn(); }
  catch (e) { ok(false, `${label} — UNEXPECTED THROW: ${e && e.message || e}`); }
}

// A read() over the three FRESHNESS_FILES from a {file: text} map (missing → undefined).
const readerFrom = (map) => (f) => map[f];
const TRUNK_FILES = { 'app.js': 'APP//v1', 'style.css': 'CSS//v1', 'rule-usage.js': 'RULES//v1' };
const H = contentHash(readerFrom(TRUNK_FILES)); // trunk's authoritative content hash

// deps builder: slotIds + a probe map {id: {token,hash} | {error}}.
function deps(slotIds, probeMap) {
  return {
    slotIds,
    urlOf: (id) => `https://staging.example/slot-${id}/`,
    probe: (id) => probeMap[id],
  };
}
const P = (token, files) => ({ token, hash: contentHash(readerFrom(files)) }); // a probe from real files

// ── 1. normalizeForHash + contentHash ──
group('hash', () => {
  ok(normalizeForHash('a\r\nb\rc') === 'a\nb\nc', 'normalizeForHash collapses CRLF and lone CR to LF');
  ok(normalizeForHash(null) === '' && normalizeForHash(undefined) === '', 'normalizeForHash treats null/undefined as empty');

  const h2 = contentHash(readerFrom({ ...TRUNK_FILES }));
  ok(H === h2, 'contentHash is deterministic (same content → same hash)');

  const changed = contentHash(readerFrom({ ...TRUNK_FILES, 'app.js': 'APP//v2' }));
  ok(H !== changed, 'contentHash changes when app.js bytes change');

  const crlf = contentHash(readerFrom({ 'app.js': 'APP\r\n//v1', 'style.css': 'CSS//v1', 'rule-usage.js': 'RULES//v1' }));
  const lf = contentHash(readerFrom({ 'app.js': 'APP\n//v1', 'style.css': 'CSS//v1', 'rule-usage.js': 'RULES//v1' }));
  ok(crlf === lf, 'contentHash ignores CRLF-vs-LF (normalized) — no false mismatch from line endings');

  const missing = contentHash(readerFrom({ 'style.css': 'CSS//v1', 'rule-usage.js': 'RULES//v1' })); // no app.js
  ok(H !== missing, 'a missing file (empty) never hash-matches a present file');
});

// ── 2. resolveFreshSlot: content is authoritative ──
group('content-match', () => {
  // slot 2 serves trunk's exact bytes → fresh by content, even though slots 1/3 differ.
  const d = deps([1, 2, 3], {
    1: P('o', { ...TRUNK_FILES, 'app.js': 'OTHER' }),
    2: P('p', TRUNK_FILES),
    3: P('q', { ...TRUNK_FILES, 'app.js': 'THIRD' }),
  });
  const r = resolveFreshSlot({ expectedToken: 'p', expectedHash: H, slotArg: NaN }, d);
  ok(r.fresh === true && r.slotId === 2 && r.resolvedBy === 'content', 'content match → fresh, correct slot, resolvedBy=content');
});

group('token-collision', () => {
  // slot 1 serves trunk's TOKEN (p) but DIFFERENT bytes → collision, NOT fresh.
  const d = deps([1, 2, 3], {
    1: P('p', { ...TRUNK_FILES, 'app.js': 'DIFFERENT-BUT-SAME-TOKEN' }),
    2: P('o', { ...TRUNK_FILES, 'app.js': 'X' }),
    3: { error: 'unreachable' },
  });
  const r = resolveFreshSlot({ expectedToken: 'p', expectedHash: H, slotArg: NaN }, d);
  ok(r.fresh === false, 'token collision → NOT fresh (the whole point)');
  ok(r.resolvedBy === 'collision' && r.slotId === 1, 'collision reported on the token-matching slot');
  ok(r.probe && r.probe.hash !== H, 'collision probe carries the mismatching hash for the diagnostic');
});

group('content-beats-colliding-token', () => {
  // slot 1 collides on the token (wrong bytes); slot 2 actually serves trunk's bytes.
  // The resolver MUST pick slot 2 (content), never be steered to slot 1 by the token.
  const d = deps([1, 2], {
    1: P('p', { ...TRUNK_FILES, 'app.js': 'WRONG' }),
    2: P('p', TRUNK_FILES),
  });
  const r = resolveFreshSlot({ expectedToken: 'p', expectedHash: H, slotArg: NaN }, d);
  ok(r.fresh === true && r.slotId === 2 && r.resolvedBy === 'content', 'content match wins over an earlier token-colliding slot');
});

group('content-authoritative-over-token', () => {
  // A slot serving trunk's bytes with a DIFFERENT token is still fresh — content is the source
  // of truth, not the token (documents the design decision).
  const d = deps([1], { 1: P('different-token', TRUNK_FILES) });
  const r = resolveFreshSlot({ expectedToken: 'p', expectedHash: H, slotArg: NaN }, d);
  ok(r.fresh === true && r.resolvedBy === 'content', 'matching content with a differing token → still fresh');
});

// ── 3. --slot pin ──
group('flag-pin', () => {
  const d = deps([1, 2, 3], { 1: P('o', { ...TRUNK_FILES, 'app.js': 'X' }), 2: P('p', TRUNK_FILES), 3: P('q', { ...TRUNK_FILES, 'app.js': 'Y' }) });
  const fresh = resolveFreshSlot({ expectedToken: 'p', expectedHash: H, slotArg: 2 }, d);
  ok(fresh.fresh === true && fresh.slotId === 2 && fresh.resolvedBy === 'flag', '--slot 2 (matching) → fresh, resolvedBy=flag');
  const mismatch = resolveFreshSlot({ expectedToken: 'p', expectedHash: H, slotArg: 1 }, d);
  ok(mismatch.fresh === false && mismatch.resolvedBy === 'flag', '--slot 1 (wrong bytes) → NOT fresh (pin does not bypass the hash)');
  const bad = resolveFreshSlot({ expectedToken: 'p', expectedHash: H, slotArg: 9 }, d);
  ok(bad.badPin === true && bad.fresh === false, '--slot 9 (unconfigured) → badPin, not fresh');
});

// ── 4. none / unreachable ──
group('none', () => {
  const d = deps([1, 2, 3], {
    1: P('a', { ...TRUNK_FILES, 'app.js': 'A' }),
    2: P('b', { ...TRUNK_FILES, 'app.js': 'B' }),
    3: P('c', { ...TRUNK_FILES, 'app.js': 'C' }),
  });
  const r = resolveFreshSlot({ expectedToken: 'p', expectedHash: H, slotArg: NaN }, d);
  ok(r.fresh === false && r.resolvedBy === 'none', 'no slot matches token or content → resolvedBy=none, not fresh');
  ok(Array.isArray(r.probes) && r.probes.length === 3, 'none carries the full per-slot probe list for diagnostics');
});

group('unreachable', () => {
  // All slots unreachable → none, not fresh (never a spurious "fresh").
  const allErr = resolveFreshSlot({ expectedToken: 'p', expectedHash: H, slotArg: NaN }, deps([1, 2], { 1: { error: 'x' }, 2: { error: 'y' } }));
  ok(allErr.fresh === false && allErr.resolvedBy === 'none', 'all slots unreachable → not fresh');
  // A reachable fresh slot alongside an unreachable one still resolves fresh.
  const mixed = resolveFreshSlot({ expectedToken: 'p', expectedHash: H, slotArg: NaN }, deps([1, 2], { 1: { error: 'x' }, 2: P('p', TRUNK_FILES) }));
  ok(mixed.fresh === true && mixed.slotId === 2, 'an unreachable slot never blocks a genuinely fresh one');
});

// ── 5. N=1 parity ──
group('n1', () => {
  const freshOne = resolveFreshSlot({ expectedToken: 'p', expectedHash: H, slotArg: NaN }, deps([1], { 1: P('p', TRUNK_FILES) }));
  ok(freshOne.fresh === true && freshOne.slotId === 1 && freshOne.resolvedBy === 'content', 'N=1: matching content → fresh');
  const staleOne = resolveFreshSlot({ expectedToken: 'p', expectedHash: H, slotArg: NaN }, deps([1], { 1: P('x', { ...TRUNK_FILES, 'app.js': 'STALE' }) }));
  ok(staleOne.fresh === false && staleOne.resolvedBy === 'none', 'N=1: stale bytes → not fresh');
  // N=1 token collision: same token, different bytes → collision, not fresh (the bug this fixes).
  const collideOne = resolveFreshSlot({ expectedToken: 'p', expectedHash: H, slotArg: NaN }, deps([1], { 1: P('p', { ...TRUNK_FILES, 'app.js': 'COLLIDE' }) }));
  ok(collideOne.fresh === false && collideOne.resolvedBy === 'collision', 'N=1: token collision → NOT fresh (content-verified)');
});

// ── 6. empty expected hash (degenerate: trunk had no hashable files) ──
group('empty-hash-guard', () => {
  // With no expectedHash, content can't be the authority; a token match is reported as a
  // collision (not fresh) — never a spurious pass.
  const r = resolveFreshSlot({ expectedToken: 'p', expectedHash: '', slotArg: NaN }, deps([1], { 1: P('p', TRUNK_FILES) }));
  ok(r.fresh === false, 'empty expectedHash → never fresh (no authority to confirm bytes)');
});

const passed = results.filter((r) => r.ok).length;
results.forEach((r) => console.log(`${r.ok ? '  ✓' : '  ✗ FAIL:'} ${r.m}`));
const anyFail = results.some((r) => !r.ok);
console.log(`\n${anyFail ? '❌' : '✅'} Promote-freshness suite: ${passed}/${results.length} checks passed.`);
process.exit(anyFail ? 1 : 0);
