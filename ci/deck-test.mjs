// deck-test.mjs — pure-Node tests for the Staging Deck core (tools/lib/staging-deck.mjs).
//
// NO network, NO browser, NO Playwright — NOT part of the port-8000→9147 swap. Exercises the
// id/sequence, manifest parse/validate/serialize, and prepend+cap+prune logic that the deck
// publish path in deploy-staging.mjs builds on. Reporting idiom mirrors ci/lease-test.mjs.

import {
  slugFeature, emptyManifest, serializeManifest, parseManifest, validateManifest,
  nextN, deckId, addAndPrune, DECK_VERSION, DECK_CAP, DeckError,
} from '../tools/lib/staging-deck.mjs';

const results = [];
const ok = (c, m) => results.push({ ok: !!c, m });
function throws(fn) { try { fn(); return false; } catch { return true; } }
function entry(id, feature, extra = {}) {
  return { id, label: 'x', feature, branch: `claude/${feature}`, sha: 'abc1234', when: '2026-07-18T00:00:00Z', ...extra };
}

// ── slugFeature ──
ok(slugFeature('claude/work-queue-92oeso') === 'work-queue-92oeso', 'slugFeature: takes the branch tail');
ok(slugFeature('claude/Fix_Thing!!') === 'fix-thing', 'slugFeature: lowercases + collapses non-[a-z0-9-] to single dashes, trims');
ok(slugFeature('') === 'deploy', 'slugFeature: empty branch → safe fallback');
ok(slugFeature('feature/ABC/xyz') === 'xyz', 'slugFeature: uses only the last path segment');

// ── manifest parse / validate / serialize ──
ok(parseManifest(null).deploys.length === 0 && parseManifest(null).version === DECK_VERSION, 'parseManifest: absent → fresh empty manifest');
ok(throws(() => parseManifest('{not json')), 'parseManifest: unparseable JSON throws (never silently overwrite)');
ok(throws(() => validateManifest({ version: 2, deploys: [] })), 'validateManifest: wrong version throws');
ok(throws(() => validateManifest({ version: 1, deploys: [{ id: 'x' }] })), 'validateManifest: entry missing fields throws');
{
  const m = { version: 1, deploys: [entry('work-queue-92oeso-1', 'work-queue-92oeso')] };
  const round = parseManifest(serializeManifest(m));
  ok(JSON.stringify(round) === JSON.stringify(m), 'manifest: serialize → parse round-trips');
  ok(serializeManifest(m) === serializeManifest(parseManifest(serializeManifest(m))), 'serializeManifest: byte-stable (idempotent)');
  ok(serializeManifest(m).endsWith('\n'), 'serializeManifest: trailing newline');
}

// ── nextN / deckId ──
ok(nextN('funnel', emptyManifest()) === 1, 'nextN: empty manifest → 1');
{
  const m = { version: 1, deploys: [entry('funnel-3', 'funnel'), entry('funnel-1', 'funnel'), entry('other-9', 'other')] };
  ok(nextN('funnel', m) === 4, 'nextN: 1 + max n for the feature (gaps ignored)');
  ok(nextN('other', m) === 10, 'nextN: per-feature independent');
  ok(nextN('brand-new', m) === 1, 'nextN: unseen feature → 1');
  ok(deckId('funnel', m) === 'funnel-4', 'deckId: <feature>-<nextN>');
}
{
  const m = { version: 1, deploys: [entry('funnel-weird', 'funnel'), entry('funnel-2', 'funnel')] };
  ok(nextN('funnel', m) === 3, 'nextN: ignores ids whose suffix is not a number');
}

// ── addAndPrune ──
{
  const m0 = emptyManifest();
  const { manifest: m1 } = addAndPrune(m0, entry('funnel-1', 'funnel'));
  ok(m1.deploys.length === 1 && m1.deploys[0].id === 'funnel-1', 'addAndPrune: first entry lands newest-first');
  const { manifest: m2 } = addAndPrune(m1, entry('funnel-2', 'funnel'));
  ok(m2.deploys[0].id === 'funnel-2' && m2.deploys[1].id === 'funnel-1', 'addAndPrune: prepends (newest-first)');
}
{
  // cap enforcement + dropIds
  let m = emptyManifest();
  for (let i = 1; i <= DECK_CAP + 3; i++) m = addAndPrune(m, entry(`funnel-${i}`, 'funnel')).manifest;
  ok(m.deploys.length === DECK_CAP, `addAndPrune: capped at ${DECK_CAP}`);
  ok(m.deploys[0].id === `funnel-${DECK_CAP + 3}`, 'addAndPrune: newest kept');
  const last = addAndPrune(
    { version: 1, deploys: Array.from({ length: DECK_CAP }, (_, i) => entry(`f-${DECK_CAP - i}`, 'f')) },
    entry('f-999', 'f'),
  );
  ok(last.dropIds.length === 1 && last.dropIds[0] === 'f-1', 'addAndPrune: reports the pruned id so its folder can be deleted');
}
{
  // re-deploying the same id replaces, never duplicates
  const m = { version: 1, deploys: [entry('funnel-2', 'funnel'), entry('funnel-1', 'funnel')] };
  const { manifest } = addAndPrune(m, entry('funnel-2', 'funnel', { sha: 'newsha1' }));
  ok(manifest.deploys.filter((d) => d.id === 'funnel-2').length === 1, 'addAndPrune: same id de-duplicates (replace, not duplicate)');
  ok(manifest.deploys[0].id === 'funnel-2' && manifest.deploys[0].sha === 'newsha1', 'addAndPrune: the replacement moves to newest with new bytes');
}

// ── report ──
let failed = false;
for (const r of results) { if (!r.ok) failed = true; console.log(`  ${r.ok ? '✓' : '✗'} ${r.m}`); }
console.log(failed ? '\n✗ Deck suite: FAILURES above.' : `\n✅ Deck suite: ${results.length}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
