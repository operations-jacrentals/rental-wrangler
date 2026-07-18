// ── Shared ?v= cache-bust token logic ────────────────────────────────────────
// The ONE shared token across style.css / rule-usage.js / app.js in index.html
// (CLAUDE.md → Deploy & gates). Extracted here so deploy-staging.mjs (the bumper),
// tools/bump-cachebust.mjs (the auto-bump), and ci/check-cachebust.mjs (the guard)
// all agree on the format — YYYYMMDD + an alpha suffix that increments for repeat
// bumps the same day (…20260710e, …f, …g). Pure string/date helpers only, no I/O.

// The three sub-resources the token versions. index.html itself is served WITHOUT a
// ?v= (it's the entry doc, cache-busted by a Pages purge + max-age), so a change to
// ONLY index.html needs no bump — the token protects the cached app.js/style.css/
// rule-usage.js, which the browser + service worker key on ?v=.
export const VERSIONED = ['style.css', 'rule-usage.js', 'app.js'];

const tokenRe = (name) => new RegExp(`(\\b${name.replace('.', '\\.')}\\?v=)([\\w-]+)`);

export function todayStamp(date = new Date()) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
}

// 'a' → 'b' … 'z' → 'aa' (odometer carry), never empty.
export function incrementSuffix(s) {
  if (!s) return 'a';
  const arr = s.split('');
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== 'z') { arr[i] = String.fromCharCode(arr[i].charCodeAt(0) + 1); return arr.join(''); }
    arr[i] = 'a';
  }
  return 'a' + arr.join('');
}

// Next token: a fresh day resets to <today>a; the same day increments the suffix.
export function nextToken(oldToken, today = todayStamp()) {
  const m = /^(\d{8})([a-z]*)$/i.exec(oldToken || '');
  if (!m || m[1] !== today) return today + 'a';
  return today + incrementSuffix(m[2].toLowerCase());
}

// Read the ONE shared token from index.html's markup. Returns { token } when all three
// versioned refs agree, or { error } describing the mismatch/absence — never throws, so
// callers (the guard especially) can turn it into their own clean failure message.
export function readSharedToken(html) {
  const tokens = new Set();
  for (const name of VERSIONED) {
    const m = tokenRe(name).exec(html);
    if (!m) return { error: `could not find a ?v= token on ${name} in index.html — the cache-bust pattern may have changed.` };
    tokens.add(m[2]);
  }
  if (tokens.size !== 1) {
    return { error: `style.css/rule-usage.js/app.js don't share one ?v= token in index.html (found: ${[...tokens].join(', ')}) — CLAUDE.md requires one shared token.` };
  }
  return { token: [...tokens][0] };
}

// Gather the cache-bust comparison state from git via an INJECTED runner
// `sh(args: string[]) => string` (git stdout, throws on failure). Injection keeps this one
// implementation shared by the bump tool, the CI guard, and the pure-Node test. Compares the
// base branch's TIP to HEAD's tip (two-dot: tree vs tree, so it needs no merge-base history —
// safe in a shallow CI checkout — and it catches a token that collides with trunk's, not just
// one that failed to move). base defaults to 'origin/trunk'.
export function readCacheBustState(sh, base = 'origin/trunk') {
  const servedChanged = sh(['diff', '--name-only', base, 'HEAD', '--', ...VERSIONED])
    .split('\n').map((s) => s.trim()).filter(Boolean);
  const headRead = readSharedToken(sh(['show', 'HEAD:index.html']));
  const baseRead = readSharedToken(sh(['show', `${base}:index.html`]));
  return {
    servedChanged,
    headToken: headRead.token || null,
    baseToken: baseRead.token || null,
    headError: headRead.error || null,
    baseError: baseRead.error || null,
  };
}

// Decision (pure): given which versioned files changed vs the base branch and the two
// shared tokens, does this branch still need a ?v= bump before it can safely reach
// production? A versioned served-file change under an UNCHANGED token is the stale-delivery
// trap — same app.js?v=<token> URL, new bytes → the CDN + service worker keep serving the
// old copy. An equal-but-both-present token also fails (a collision: two different app.js
// under one token), so a concurrent branch that reused the same next-token is caught too.
export function bumpVerdict({ servedChanged, headToken, baseToken }) {
  if (!servedChanged || servedChanged.length === 0) return { needsBump: false, reason: 'no versioned served-file change vs trunk' };
  if (headToken && baseToken && headToken !== baseToken) return { needsBump: false, reason: `?v= bumped ${baseToken} → ${headToken}` };
  return { needsBump: true, reason: `${servedChanged.join(', ')} changed vs trunk but the shared ?v= is unchanged (${headToken})` };
}

// Bump the shared token across all three refs (pure string transform). Returns
// { oldToken, newToken, html } on success or { error }. Deliberately never touches
// app.js's internal ES-module import specifiers (they carry no ?v= — a relative import
// drops the query string, so a versioned + unversioned copy would instantiate twice).
export function bumpTokenInHtml(html, today = todayStamp()) {
  const read = readSharedToken(html);
  if (read.error) return { error: read.error };
  const oldToken = read.token;
  const newToken = nextToken(oldToken, today);
  let next = html;
  for (const name of VERSIONED) next = next.replace(tokenRe(name), `$1${newToken}`);
  return { oldToken, newToken, html: next };
}
