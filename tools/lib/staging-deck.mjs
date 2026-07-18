// staging-deck.mjs — the PURE core of the Staging Deck (spec 2026-07-18).
//
// The deck publishes every deploy to its OWN immutable folder in the served staging repo —
//   …github.io/rental-wrangler-staging/d/<feature>-<n>/
// listed in a served manifest (d/deploys.json) that the in-app "Staging" switcher reads.
// Nothing is overwritten, so there is no lease/slot to arbitrate (the slot pool stays as the
// backup, reachable via `/deploy --slots`).
//
// This module is PURE (no fs, no network, no git): id/sequence, manifest parse/validate/
// canonical-serialize, and the prepend+cap+prune plan. The git orchestration (clone `main`,
// copy the crawled site files into d/<id>/, rewrite the manifest, remove pruned folders,
// commit, push, CAS-retry on reject) lives in deploy-staging.mjs and reuses staging-git.mjs.
// Keeping the logic pure makes it unit-testable with zero network (see ci/deck-test.mjs).

export const DECK_DIR = 'd';                 // all deck artifacts live under this served path
export const MANIFEST_PATH = 'd/deploys.json';
export const DECK_VERSION = 1;
export const DECK_CAP = 20;                  // keep the newest N deploys; prune older folders

export class DeckError extends Error {
  constructor(message, code) { super(message); this.name = 'DeckError'; this.code = code || 'CORRUPT_MANIFEST'; }
}

// A branch tail → a URL/​folder-safe feature slug. `claude/work-queue-92oeso` → `work-queue-92oeso`.
export function slugFeature(branch) {
  const tail = String(branch || '').split('/').pop() || '';
  const slug = tail.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return slug || 'deploy';
}

export function emptyManifest() {
  return { version: DECK_VERSION, deploys: [] };
}

// Canonical, byte-stable serialization (identical state → identical bytes → clean diffs, no
// spurious commits) — same discipline as staging-control.mjs.
export function serializeManifest(m) {
  return JSON.stringify(m, null, 2) + '\n';
}

function isNonEmptyStr(x) { return typeof x === 'string' && x.length > 0; }

export function validateManifest(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw new DeckError('deploys.json is not an object');
  if (m.version !== DECK_VERSION) throw new DeckError(`deploys.json version ${m.version} not understood (expected ${DECK_VERSION})`);
  if (!Array.isArray(m.deploys)) throw new DeckError('deploys.json .deploys must be an array');
  for (const d of m.deploys) {
    if (!d || typeof d !== 'object') throw new DeckError('a deploy entry is not an object');
    for (const k of ['id', 'label', 'feature', 'branch', 'sha', 'when']) {
      if (!isNonEmptyStr(d[k])) throw new DeckError(`a deploy entry is missing a valid ${k}`);
    }
  }
  return m;
}

// Absent (raw == null) → a fresh empty manifest (first-ever deploy). Present → parse+validate;
// unparseable/bad-shape throws loudly (a corrupt manifest should never be silently overwritten).
export function parseManifest(raw) {
  if (raw == null) return emptyManifest();
  let obj;
  try { obj = JSON.parse(raw); } catch { throw new DeckError('deploys.json is not valid JSON'); }
  return validateManifest(obj);
}

// The next per-feature sequence number: 1 + the max `n` among existing entries whose feature
// matches (their id is `<feature>-<n>`). Robust to ids that don't parse (ignored).
export function nextN(feature, manifest) {
  let max = 0;
  for (const d of (manifest.deploys || [])) {
    if (d.feature !== feature) continue;
    const m = /-(\d+)$/.exec(d.id || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export function deckId(feature, manifest) {
  return `${feature}-${nextN(feature, manifest)}`;
}

// Prepend a new entry (newest-first), cap to `cap`, and report which ids fell off so the
// caller can delete their d/<id>/ folders in the same commit. A never-pruned promote target
// is guaranteed structurally: /promote re-deploys trunk immediately before go-live, so its
// target is always the newest entry (spec [R6]).
export function addAndPrune(manifest, entry, cap = DECK_CAP) {
  const deploys = [entry, ...(manifest.deploys || []).filter((d) => d.id !== entry.id)];
  const kept = deploys.slice(0, cap);
  const keptIds = new Set(kept.map((d) => d.id));
  const dropIds = deploys.slice(cap).map((d) => d.id).filter((id) => !keptIds.has(id));
  return { manifest: { version: DECK_VERSION, deploys: kept }, dropIds };
}
