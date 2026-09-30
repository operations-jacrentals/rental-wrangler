// promote-test.mjs — pure-Node tests for the content-verified staging-freshness resolver.
//
// NO network, NO browser, NO Playwright (sections 7 and 8 run git, and auto-promote.yml's inline bash steps, against throwaway LOCAL repos, curl through a dead proxy) — this is NOT part of the port-8000→9147 swap. It
// imports the PURE helpers from tools/lib/promote-freshness.mjs (normalizeForHash / contentHash
// / resolveFreshSlot) and drives resolveFreshSlot with a fully in-memory `probe`, so every
// freshness branch (content-match, token-collision, multi-slot pick, --slot pin, none,
// unreachable, N=1) is exercised without touching git or the network.
//
// Reporting idiom mirrors ci/logic-test.mjs / ci/lease-test.mjs: collect {ok,m}, print ✓/✗,
// process.exit(anyFail?1:0).

import { normalizeForHash, contentHash, resolveFreshSlot } from '../tools/lib/promote-freshness.mjs';
import { railGatePaths, isUnattended, unattendedRailRefusal } from '../tools/lib/promote-guard.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

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

// ── 7. S3-5 A (RC-92) — the unattended promote path never carries rail.json ──
group('rail-guard-pure', () => {
  ok(JSON.stringify(railGatePaths(['app.js', 'rail.json', 'docs/x.md'])) === '["rail.json"]', 'railGatePaths finds rail.json among the touched paths');
  ok(railGatePaths(['Rail.JSON']).length === 1 && railGatePaths(['sub\\rail.json']).length === 1 && railGatePaths(['a/b/rail.json']).length === 1, 'railGatePaths is conservative: any case, any folder, either slash');
  ok(railGatePaths(['rail.json.bak', 'rails.json', 'trail.json', 'rail.jsonx', '']).length === 0 && railGatePaths(null).length === 0, 'railGatePaths ignores look-alikes and empty input');
  ok(isUnattended(['--yes', '--unattended'], {}) === true, 'isUnattended: --unattended');
  ok(isUnattended(['--yes'], { GITHUB_ACTIONS: 'true' }) === true, 'isUnattended: any run inside GitHub Actions, even without the flag');
  ok(isUnattended(['--yes'], { GITHUB_ACTIONS: 'false' }) === false && isUnattended(['--yes'], {}) === false && isUnattended([], { CI: 'true' }) === false, 'isUnattended: a terminal promote is attended (CI=true alone does not count)');
  ok(/rail\.json/.test(unattendedRailRefusal({ unattended: true, paths: ['app.js', 'rail.json'] }) || ''), 'unattended + rail.json in the range → refused, naming the file');
  ok(unattendedRailRefusal({ unattended: true, paths: ['app.js', 'index.html'] }) === null, 'unattended + rail.json untouched → allowed');
  ok(unattendedRailRefusal({ unattended: false, paths: ['rail.json'] }) === null, 'attended (a human promote) + rail.json → not refused by this guard');
  ok(typeof unattendedRailRefusal({ unattended: true, paths: null }) === 'string', 'unattended + the touched paths could not be listed → refused (fails closed)');
});

// ── 8. S3-5 A, first layer — the inline refusal step in auto-promote.yml ──
// auto-promote.yml runs promote.mjs from the merged PR's own checkout, so an auto-fix that turns rail.json on could
// also rewrite promote.mjs / promote-guard.mjs / this file in the same PR. The workflow file is the one thing the
// wrangler-fix PAT cannot edit (no Workflows permission), so the refusal that counts is an inline shell + git step in
// it. This section reads the job's steps (a small reader for this file's own shape, no YAML library) and, in the e2e
// block below, RUNS those inline blocks with bash the way GitHub runs `shell: bash` (bash --noprofile --norc -eo
// pipefail) against throwaway local repositories.
const AUTO_PROMOTE_YML = fileURLToPath(new URL('../.github/workflows/auto-promote.yml', import.meta.url));
function workflowSteps(text) {
  const L = String(text).replace(/\r\n/g, '\n').split('\n');
  const at = L.findIndex((l) => /^    steps:\s*$/.test(l));
  const raw = [];
  for (let i = at + 1; at >= 0 && i < L.length; i++) {
    const l = L[i];
    if (/^      - /.test(l)) { raw.push([l.replace(/^      - /, '        ')]); continue; }
    if (l.trim() === '') { if (raw.length) raw[raw.length - 1].push(''); continue; }
    if (!/^        /.test(l) || !raw.length) break;
    raw[raw.length - 1].push(l);
  }
  return raw.map((lines) => {
    const st = { keys: {}, run: null };
    for (let j = 0; j < lines.length; j++) {
      const m = lines[j].match(/^        ([A-Za-z][\w-]*):(?:\s+(.*))?$/);
      if (!m) continue;
      if (m[1] === 'run' && (m[2] || '').trim() === '|') {
        const body = []; let k = j + 1;
        for (; k < lines.length; k++) { const b = lines[k]; if (b.trim() === '') { body.push(''); continue; } if (!/^          /.test(b)) break; body.push(b.slice(10)); }
        st.run = body.join('\n').replace(/\n+$/, '') + '\n'; j = k - 1;
      } else st.keys[m[1]] = (m[2] || '').trim();
    }
    return st;
  });
}
// Anything in an inline block that could hand control to a file the promoted range can rewrite.
const CALLS_REPO_CODE = /\b(node|npm|npx|pnpm|yarn|deno|bun|python3?|ruby|perl|source|sh|bash|zsh|make|eval)\b|(^|[\s;&|(=`'"])\.{1,2}\/|\btools\/|\bci\/|\.m?js\b|\.cjs\b|\.sh\b|\.py\b/m;
const WF_STEPS = workflowSteps(readFileSync(AUTO_PROMOTE_YML, 'utf8'));
const WF_REFUSE = WF_STEPS.findIndex((s) => s.keys.id === 'rail-refusal');
const WF_PROMOTE = WF_STEPS.findIndex((s) => /tools\/promote\.mjs/.test(s.keys.run || ''));
const WF_CONFIRM = WF_STEPS.findIndex((s) => /steps\.rail-refusal\.outcome/.test(s.keys.if || ''));
group('auto-promote-inline-shape', () => {
  const r = WF_STEPS[WF_REFUSE], p = WF_STEPS[WF_PROMOTE], c = WF_STEPS[WF_CONFIRM];
  ok(WF_STEPS.length >= 4 && WF_PROMOTE >= 0, `the reader finds auto-promote.yml's steps and the promote step (${WF_STEPS.length} steps)`);
  ok(!!r && typeof r.run === 'string' && /rail\.json/.test(r.run) && /exit 1/.test(r.run), 'auto-promote.yml has an inline step (id: rail-refusal) with its own rail.json check that exits 1');
  ok(!!r && WF_REFUSE < WF_PROMOTE, `the inline refusal runs BEFORE the step that runs promote.mjs (refusal #${WF_REFUSE}, promote #${WF_PROMOTE})`);
  ok(!!r && r.keys.shell === 'bash' && !('if' in r.keys) && !('continue-on-error' in r.keys), 'the refusal step runs under shell: bash (-eo pipefail), always, and its failure is never ignored (no if:, no continue-on-error)');
  ok(!!r && !CALLS_REPO_CODE.test(r.run), 'the refusal step is shell + git only: it runs no script from the checkout the range could rewrite');
  ok(!!p && !('if' in p.keys) && !('continue-on-error' in p.keys), 'the promote step has no if: / continue-on-error, so a failed refusal stops it');
  ok(!!c && WF_CONFIRM > WF_PROMOTE && /always\(\)/.test(c.keys.if) && c.keys.shell === 'bash' && typeof c.run === 'string' && !CALLS_REPO_CODE.test(c.run) && !('continue-on-error' in c.keys), 'after the promote, an always() shell + git step confirms production landed on the trunk tip that was checked');
});

// The whole wiring, end to end: tools/promote.mjs run against throwaway local repositories (a bare `origin` holding
// trunk + production, and a clone). No network: git talks to a local path, and every curl goes to a dead proxy.
{
  const promoteJs = fileURLToPath(new URL('../tools/promote.mjs', import.meta.url));
  const tmp = mkdtempSync(join(tmpdir(), 'rw-promote-rail-'));
  const idEnv = { GIT_AUTHOR_NAME: 'promote-test', GIT_AUTHOR_EMAIL: 'promote-test@invalid', GIT_COMMITTER_NAME: 'promote-test', GIT_COMMITTER_EMAIL: 'promote-test@invalid', GIT_TERMINAL_PROMPT: '0' };
  const baseEnv = { ...process.env, ...idEnv };
  for (const k of ['GITHUB_ACTIONS', 'NO_PROXY', 'no_proxy']) delete baseEnv[k];
  const dead = 'http://127.0.0.1:9';
  Object.assign(baseEnv, { http_proxy: dead, https_proxy: dead, HTTP_PROXY: dead, HTTPS_PROXY: dead, ALL_PROXY: dead, all_proxy: dead });
  const g = (cwd, ...a) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=' + join(tmp, 'no-hooks'), ...a], { cwd, env: baseEnv, encoding: 'utf8' }).trim();
  const put = (dir, f, text) => writeFileSync(join(dir, f), text);
  let n = 0;
  // origin: trunk === production at a base commit; then `build(work)` adds trunk commits and pushes trunk only
  const scenario = (build) => {
    const root = join(tmp, 's' + (++n)), origin = join(root, 'origin.git'), work = join(root, 'work');
    mkdirSync(root, { recursive: true });
    g(root, 'init', '-q', '--bare', origin);
    g(root, 'init', '-q', work); g(work, 'checkout', '-q', '-b', 'trunk');
    put(work, 'index.html', '<script src="app.js?v=t1"></script>\n'); put(work, 'app.js', '// v1\n'); put(work, 'rail.json', '{"on":false}');
    g(work, 'add', '-A'); g(work, 'commit', '-q', '-m', 'base');
    g(work, 'remote', 'add', 'origin', origin); g(work, 'push', '-q', 'origin', 'trunk', 'trunk:production');
    build(work);
    g(work, 'push', '-q', 'origin', 'trunk');
    return { origin, work, prodBefore: g(origin, 'rev-parse', 'production'), trunk: g(origin, 'rev-parse', 'trunk') };
  };
  const promote = (sc, args, env) => spawnSync(process.execPath, [promoteJs, ...args], { cwd: sc.work, env: { ...baseEnv, ...(env || {}) }, encoding: 'utf8', timeout: 120000 });
  const said = (r) => (r.stdout || '') + (r.stderr || '');
  const onFile = '{"on":true,"url":"https://rw-api-production.up.railway.app"}';
  try {
    const flip = scenario((w) => { put(w, 'app.js', '// v2 fix\n'); g(w, 'commit', '-qam', 'auto-fix'); put(w, 'rail.json', onFile); g(w, 'commit', '-qam', 'routing on'); });
    const r1 = promote(flip, ['--yes', '--unattended']);
    ok(r1.status === 1 && /refusing an unattended promote/.test(said(r1)) && /rail\.json/.test(said(r1)), `e2e: --yes --unattended over a range that turns routing on → refused, exit 1 (exit ${r1.status})`);
    ok(!/staging freshness/.test(said(r1)) && !/pushing /.test(said(r1)), 'e2e: the refusal comes before any staging probe or push');
    ok(g(flip.origin, 'rev-parse', 'production') === flip.prodBefore, 'e2e: production did not move');
    const r2 = promote(flip, ['--yes'], { GITHUB_ACTIONS: 'true' });
    ok(r2.status === 1 && /refusing an unattended promote/.test(said(r2)) && g(flip.origin, 'rev-parse', 'production') === flip.prodBefore, `e2e: the same range inside GitHub Actions WITHOUT --unattended → still refused (exit ${r2.status})`);
    const r3 = promote(flip, []);
    ok(r3.status === 0 && !/refusing an unattended promote/.test(said(r3)) && /touches rail\.json/.test(said(r3)) && /PREVIEW ONLY/.test(said(r3)), `e2e: a human preview of the same range is not refused, and says the switch rides this promote (exit ${r3.status})`);
    const round = scenario((w) => { put(w, 'rail.json', onFile); g(w, 'commit', '-qam', 'on'); put(w, 'rail.json', '{"on":false}'); g(w, 'commit', '-qam', 'off again'); put(w, 'app.js', '// v3\n'); g(w, 'commit', '-qam', 'fix'); });
    ok(g(round.work, 'diff', '--name-only', round.prodBefore, round.trunk) === 'app.js', 'e2e setup: on → off inside the range leaves rail.json out of the net diff');
    const r4 = promote(round, ['--unattended']);
    ok(r4.status === 1 && /refusing an unattended promote/.test(said(r4)), `e2e: a range that flips rail.json on and back off is refused too (every commit counts, not the net diff; exit ${r4.status})`);
    const merged = scenario((w) => { g(w, 'checkout', '-q', '-b', 'side'); put(w, 'rail.json', onFile); g(w, 'commit', '-qam', 'side: on'); g(w, 'checkout', '-q', 'trunk'); put(w, 'app.js', '// v4\n'); g(w, 'commit', '-qam', 'trunk fix'); g(w, 'merge', '-q', '--no-ff', '-m', 'merge side', 'side'); });
    const r5 = promote(merged, ['--unattended']);
    ok(r5.status === 1 && /refusing an unattended promote/.test(said(r5)), `e2e: rail.json arriving through a merge commit is refused (exit ${r5.status})`);
    // two "evil" merges: the first merge commit itself turns routing on, the second turns it back off — no ordinary
    // commit touches rail.json and the net diff is empty, so only diffing each merge against its parents sees it
    const evil = scenario((w) => {
      for (const [br, text] of [['side1', onFile], ['side2', '{"on":false}']]) {
        g(w, 'checkout', '-q', '-b', br); put(w, br + '.txt', br); g(w, 'add', br + '.txt'); g(w, 'commit', '-qm', br);
        g(w, 'checkout', '-q', 'trunk'); g(w, 'merge', '-q', '--no-ff', '--no-commit', br); put(w, 'rail.json', text); g(w, 'add', 'rail.json'); g(w, 'commit', '-qm', 'merge ' + br);
      }
    });
    ok(!/rail\.json/.test(g(evil.work, 'log', '--format=', '--name-only', '--no-renames', evil.prodBefore + '..' + evil.trunk)) && !/rail\.json/.test(g(evil.work, 'diff', '--name-only', evil.prodBefore, evil.trunk)), 'e2e setup: the evil merges hide rail.json from the plain log and the net diff');
    const rEvil = promote(evil, ['--unattended']);
    ok(rEvil.status === 1 && /refusing an unattended promote/.test(said(rEvil)), `e2e: rail.json flipped only inside merge commits is refused (each merge diffed against its parents; exit ${rEvil.status})`);
    const renamed = scenario((w) => { g(w, 'mv', 'rail.json', 'rail.off'); g(w, 'commit', '-qm', 'rename'); });
    const r6 = promote(renamed, ['--unattended']);
    ok(r6.status === 1 && /refusing an unattended promote/.test(said(r6)), `e2e: renaming rail.json away (the file devices read goes missing) is refused (exit ${r6.status})`);
    const clean = scenario((w) => { put(w, 'app.js', '// v5 fix\n'); g(w, 'commit', '-qam', 'auto-fix'); });
    const r7 = promote(clean, ['--unattended']);
    ok(r7.status === 0 && /unattended — rail\.json is untouched/.test(said(r7)) && /staging freshness/.test(said(r7)) && /PREVIEW ONLY/.test(said(r7)), `e2e: an unattended range that leaves rail.json alone passes this guard and goes on to the staging gate (exit ${r7.status})`);
    const r8 = promote(clean, ['--yes', '--unattended']);
    ok(r8.status === 1 && /refusing to promote — no deck deploy or slot/.test(said(r8)) && g(clean.origin, 'rev-parse', 'production') === clean.prodBefore, `e2e control: with --yes the clean range is stopped by the staging gate (no staging reachable here), never pushed (exit ${r8.status})`);

    // ── 8 (e2e): auto-promote.yml's inline blocks, run the way GitHub runs `shell: bash`, in the same repositories ──
    const refuseRun = WF_REFUSE >= 0 ? WF_STEPS[WF_REFUSE].run : null, confirmRun = WF_CONFIRM >= 0 ? WF_STEPS[WF_CONFIRM].run : null;
    let nb = 0;
    const block = (sc, script, extraEnv) => {
      const f = join(tmp, 'step' + (++nb) + '.sh'), envFile = join(tmp, 'github_env' + nb);
      writeFileSync(f, script || 'echo "auto-promote.yml: step missing"; exit 97\n'); writeFileSync(envFile, '');
      const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', f], { cwd: sc.work, env: { ...baseEnv, GITHUB_ENV: envFile, ...(extraEnv || {}) }, encoding: 'utf8', timeout: 120000 });
      const setEnv = Object.fromEntries(readFileSync(envFile, 'utf8').split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
      return { status: r.status, out: (r.stdout || '') + (r.stderr || '') + (r.error ? String(r.error) : ''), env: setEnv };
    };
    const refusedInline = (sc, label) => {
      const r = block(sc, refuseRun);
      ok(r.status === 1 && /::error::auto-promote: refusing an unattended promote/i.test(r.out) && /rail\.json/i.test(r.out) && !r.env.RAIL_CHECKED_TRUNK && g(sc.origin, 'rev-parse', 'production') === sc.prodBefore, `inline step: ${label} → refused, exit 1, nothing recorded (exit ${r.status}; ${r.out.trim().split('\n').pop().slice(0, 140)})`);
    };
    refusedInline(flip, 'a range that turns routing on');
    refusedInline(round, 'rail.json on and back off inside the range (every commit counts, not the net diff)');
    refusedInline(merged, 'rail.json arriving through a merge commit');
    refusedInline(evil, 'rail.json changed only inside merge commits (each merge diffed against its parents)');
    refusedInline(renamed, 'rail.json renamed away (renames count as delete + add)');
    const cased = scenario((w) => { mkdirSync(join(w, 'Sub'), { recursive: true }); put(w, 'Sub/RAIL.JSON', onFile); g(w, 'add', '-A'); g(w, 'commit', '-qm', 'cased'); });
    refusedInline(cased, 'Sub/RAIL.JSON (any case, any folder, same rule as promote-guard.mjs)');
    // the bypass the review reproduced: one auto-fix commit turns routing on AND relaxes the repo's own guard
    const bypass = scenario((w) => {
      mkdirSync(join(w, 'tools', 'lib'), { recursive: true });
      put(w, 'tools/lib/promote-guard.mjs', 'export function unattendedRailRefusal() { return null; }\n'); put(w, 'rail.json', onFile);
      g(w, 'add', '-A'); g(w, 'commit', '-qm', 'Wrangler fix: glitch');
    });
    refusedInline(bypass, 'the same commit also rewrites tools/lib/promote-guard.mjs to allow everything (the step reads no repo file)');
    const rc = block(clean, refuseRun);
    ok(rc.status === 0 && /rail\.json is untouched/.test(rc.out) && rc.env.RAIL_CHECKED_TRUNK === clean.trunk && rc.env.RAIL_CHECKED_PROD === clean.prodBefore, `inline step: a range that leaves rail.json alone passes and records the exact trunk and production tips it checked (exit ${rc.status})`);
    const gone = scenario((w) => { put(w, 'app.js', '// v6\n'); g(w, 'commit', '-qam', 'fix'); });
    g(gone.origin, 'branch', '-D', 'production');
    const rg = block(gone, refuseRun);
    ok(rg.status !== 0 && !rg.env.RAIL_CHECKED_TRUNK, `inline step: when git cannot read production the step fails (fails closed), recording nothing (exit ${rg.status})`);
    // the confirm step: production must be where it started or exactly on the checked trunk tip
    const confirm = (sc, env) => block(sc, confirmRun, env);
    const c1 = confirm(clean, rc.env);
    ok(c1.status === 0, `confirm step: production still where it started (nothing pushed) → passes (exit ${c1.status})`);
    g(clean.work, 'push', '-q', 'origin', clean.trunk + ':refs/heads/production');
    const c2 = confirm(clean, rc.env);
    ok(c2.status === 0 && g(clean.origin, 'rev-parse', 'production') === clean.trunk, `confirm step: production on exactly the checked trunk tip → passes (exit ${c2.status})`);
    put(clean.work, 'rail.json', onFile); g(clean.work, 'commit', '-qam', 'routing on, after the check'); g(clean.work, 'push', '-q', 'origin', 'HEAD:refs/heads/trunk', 'HEAD:refs/heads/production');
    const c3 = confirm(clean, rc.env);
    ok(c3.status === 1 && /::error::auto-promote: production is at/.test(c3.out), `confirm step: production moved past the checked tip (trunk changed between the check and the push) → fails loudly (exit ${c3.status})`);
  } catch (e) {
    ok(false, `e2e — UNEXPECTED THROW: ${e && e.message || e}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// auto-promote.yml (and any other workflow) runs promote.mjs only with --unattended
{
  const wfDir = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
  const calls = readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f)).flatMap((f) => readFileSync(join(wfDir, f), 'utf8').split('\n').filter((l) => /tools\/promote\.mjs/.test(l) && /^\s*(-\s*)?run:/.test(l)).map((l) => f + ': ' + l.trim()));
  ok(calls.length >= 1 && calls.some((c) => /^auto-promote\.ya?ml: /.test(c)) && calls.every((c) => /--unattended(\s|$)/.test(c)), `every workflow step that runs promote.mjs passes --unattended (${calls.join(' | ')})`);
}

const passed = results.filter((r) => r.ok).length;
results.forEach((r) => console.log(`${r.ok ? '  ✓' : '  ✗ FAIL:'} ${r.m}`));
const anyFail = results.some((r) => !r.ok);
console.log(`\n${anyFail ? '❌' : '✅'} Promote-freshness suite: ${passed}/${results.length} checks passed.`);
process.exit(anyFail ? 1 : 0);
