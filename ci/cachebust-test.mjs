#!/usr/bin/env node
// Pure-Node unit suite for the ?v= cache-bust logic (tools/lib/cachebust.mjs) — no
// git, no network, no browser. Mirrors ci/promote-test.mjs style. Guards the token
// format + the bump-verdict decision that ci/check-cachebust.mjs and
// tools/bump-cachebust.mjs both rely on.

import {
  nextToken, incrementSuffix, readSharedToken, bumpTokenInHtml, bumpVerdict, readCacheBustState,
} from '../tools/lib/cachebust.mjs';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ ${label}`); } };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)})`);

console.log('cachebust suite');

// ── incrementSuffix: odometer with carry ──
eq(incrementSuffix(''), 'a', 'incrementSuffix empty → a');
eq(incrementSuffix('a'), 'b', 'incrementSuffix a → b');
eq(incrementSuffix('z'), 'aa', 'incrementSuffix z → aa (carry)');
eq(incrementSuffix('az'), 'ba', 'incrementSuffix az → ba');
eq(incrementSuffix('zz'), 'aaa', 'incrementSuffix zz → aaa');

// ── nextToken: fresh day resets, same day increments ──
eq(nextToken('20260718h', '20260718'), '20260718i', 'same-day bump h → i');
eq(nextToken('20260717z', '20260718'), '20260718a', 'new day resets → a');
eq(nextToken('', '20260718'), '20260718a', 'empty/unknown → today a');
eq(nextToken('garbage', '20260718'), '20260718a', 'malformed → today a');

// ── readSharedToken ──
const good = 'x style.css?v=20260718h y rule-usage.js?v=20260718h z app.js?v=20260718h';
eq(readSharedToken(good), { token: '20260718h' }, 'readSharedToken agrees → token');
ok(!!readSharedToken('style.css?v=1 rule-usage.js?v=2 app.js?v=1').error, 'readSharedToken mismatch → error');
ok(!!readSharedToken('style.css?v=1 rule-usage.js?v=1').error, 'readSharedToken missing app.js → error');

// ── bumpTokenInHtml: all three refs move together, imports untouched ──
const src = '<link href="style.css?v=20260718h"><script src="rule-usage.js?v=20260718h"></script>' +
  '<script type="module" src="app.js?v=20260718h"></script><!-- import "./x.js" (no ?v=) -->';
const bumped = bumpTokenInHtml(src, '20260718');
eq(bumped.oldToken, '20260718h', 'bumpTokenInHtml oldToken');
eq(bumped.newToken, '20260718i', 'bumpTokenInHtml newToken');
ok((bumped.html.match(/\?v=20260718i/g) || []).length === 3, 'bumpTokenInHtml moves all 3 refs');
ok(/import "\.\/x\.js"/.test(bumped.html), 'bumpTokenInHtml leaves un-versioned imports alone');

// ── bumpVerdict: the decision the guard/tool share ──
eq(bumpVerdict({ servedChanged: [], headToken: 'a', baseToken: 'a' }).needsBump, false, 'no served change → no bump');
eq(bumpVerdict({ servedChanged: ['app.js'], headToken: '20260718h', baseToken: '20260718h' }).needsBump, true,
  'served change + unchanged token → NEEDS bump');
eq(bumpVerdict({ servedChanged: ['app.js'], headToken: '20260718i', baseToken: '20260718h' }).needsBump, false,
  'served change + bumped token → no bump');
eq(bumpVerdict({ servedChanged: ['style.css'], headToken: '20260718h', baseToken: '20260718h' }).needsBump, true,
  'token collision with trunk (equal, both present) → NEEDS bump');

// ── readCacheBustState with an injected git runner (no real git) ──
const fakeGit = (map) => (args) => {
  const key = args.join(' ');
  if (key.startsWith('diff --name-only')) return map.changed;
  if (key === 'show HEAD:index.html') return map.head;
  if (key.endsWith(':index.html')) return map.base;
  throw new Error('unexpected git call: ' + key);
};
const st = readCacheBustState(fakeGit({
  changed: 'app.js\n',
  head: 'style.css?v=20260718h rule-usage.js?v=20260718h app.js?v=20260718h',
  base: 'style.css?v=20260718h rule-usage.js?v=20260718h app.js?v=20260718h',
}));
eq(st.servedChanged, ['app.js'], 'readCacheBustState parses changed files');
eq(st.headToken, '20260718h', 'readCacheBustState reads HEAD token');
eq(bumpVerdict(st).needsBump, true, 'readCacheBustState feeds a NEEDS-bump verdict');

console.log(fail === 0 ? `\n✅ Cachebust suite: ${pass}/${pass} checks passed.` : `\n❌ Cachebust suite: ${fail} FAILED, ${pass} passed.`);
process.exit(fail === 0 ? 0 : 1);
