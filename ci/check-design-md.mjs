// CI guard: validates /DESIGN.md and keeps it TRUE to the real source. Pure Node, zero
// deps, no network (the @google/design.md CLI can't run in CI) — a hand-rolled mirror of
// the spec linter's core rules PLUS a drift guard, the way gen-rule-usage/check-window-
// catalog guard the rulebook. Three jobs: (1) spec-lint DESIGN.md, (2) drift-check every
// token against style.css :root, (3) cross-check the R-catalog against app.js RULE_META.
// ERRORS fail the build (exit 1); contrast / orphan / R-catalog findings are advisory.
//   node ci/check-design-md.mjs            (Jac 2026-06-23)
import { readFile } from 'fs/promises';

const root   = new URL('../', import.meta.url);
const lf     = (s) => s.replace(/\r\n/g, '\n');   // tolerate CRLF checkouts (Windows autocrlf); CI is LF
const design = lf(await readFile(new URL('DESIGN.md', root), 'utf8'));
const css    = lf(await readFile(new URL('style.css', root), 'utf8'));
const appjs  = lf(await readFile(new URL('app.js',   root), 'utf8').catch(() => ''));

const errors = [], warns = [], infos = [];
const ERR = (m) => errors.push(m), WARN = (m) => warns.push(m), INFO = (m) => infos.push(m);

// ── Split frontmatter / body ───────────────────────────────────────────────
const fm = design.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!fm) { console.error('✗ DESIGN.md: missing or malformed `---` frontmatter fences'); process.exit(1); }
const [, front, body] = fm;

// ── Parse frontmatter into top-level blocks (key at column 0) ──────────────
function topBlocks(src) {
  const blocks = {}; let cur = null;
  for (const ln of src.split('\n')) {
    const m = ln.match(/^(\w[\w-]*):\s*(.*)$/);
    if (m) { cur = m[1]; blocks[cur] = { inline: m[2], body: [] }; }
    else if (cur) blocks[cur].body.push(ln);
  }
  return blocks;
}
const blocks = topBlocks(front);
const memberKeys = (b) => new Set((b ? b.body : [])
  .map((l) => l.match(/^\s{2}([\w-]+):/)).filter(Boolean).map((m) => m[1]));
const colorMap = (b) => Object.fromEntries((b ? b.body : [])
  .map((l) => l.match(/^\s{2}([\w-]+):\s*"([^"]+)"/)).filter(Boolean).map((m) => [m[1], m[2]]));

const colors     = colorMap(blocks.colors);
const colorKeys  = new Set(Object.keys(colors));
const groupKeys  = { colors: colorKeys, rounded: memberKeys(blocks.rounded),
                     typography: memberKeys(blocks.typography), spacing: memberKeys(blocks.spacing) };

// ── (1a) Required keys ─────────────────────────────────────────────────────
if (!blocks.name || !blocks.name.inline.trim()) ERR('frontmatter: required `name` is missing');
if (!blocks.colors)        ERR('frontmatter: required `colors` block is missing');
else if (!colorKeys.has('primary')) ERR('frontmatter: required `colors.primary` is missing');

// ── (1b) Components: broken refs + contrast ────────────────────────────────
const referenced = { colors: new Set(), rounded: new Set(), typography: new Set(), spacing: new Set() };
const comps = (blocks.components ? blocks.components.body : [])
  .map((l) => l.match(/^\s{2}([\w-]+):\s*\{(.*)\}\s*(?:#.*)?$/)).filter(Boolean)
  .map((m) => ({ name: m[1], spec: m[2] }));

const lum = (hex) => {
  const c = hex.replace('#', '');
  const n = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const hi = Math.max(lum(a), lum(b)), lo = Math.min(lum(a), lum(b)); return (hi + 0.05) / (lo + 0.05); };
const resolve = (spec, field) => {
  const ref = spec.match(new RegExp(field + ':\\s*"\\{colors\\.([\\w-]+)\\}"'));
  if (ref) return colors[ref[1]];
  const lit = spec.match(new RegExp(field + ':\\s*"(#[0-9a-fA-F]{3,8})"'));
  return lit ? lit[1] : null;
};
for (const c of comps) {
  for (const r of c.spec.matchAll(/\{(colors|rounded|typography|spacing)\.([\w-]+)\}/g)) {
    const [, g, k] = r;
    if (!groupKeys[g].has(k)) ERR(`component \`${c.name}\`: broken reference {${g}.${k}}`);
    else referenced[g].add(k);
  }
  const bg = resolve(c.spec, 'backgroundColor'), tx = resolve(c.spec, 'textColor');
  if (bg && tx && /^#/.test(bg) && /^#/.test(tx)) {
    const cr = ratio(bg, tx);
    if (cr < 4.5) WARN(`contrast: \`${c.name}\` text ${tx} on ${bg} = ${cr.toFixed(2)}:1 (below AA 4.5:1)`);
  }
}

// ── (1c) Body sections: no duplicate headings; canonical ones in order ─────
const CANON = ['Overview', 'Colors', 'Typography', 'Layout', 'Elevation & Depth', 'Shapes', 'Components', "Do's and Don'ts"];
const heads = [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]);
const seen = new Set();
for (const h of heads) { if (seen.has(h)) ERR(`duplicate section heading: "${h}"`); seen.add(h); }
const seq = heads.filter((h) => CANON.includes(h)).map((h) => CANON.indexOf(h));
for (let i = 1; i < seq.length; i++) if (seq[i] < seq[i - 1]) { WARN(`body sections out of canonical order (near "${CANON[seq[i]]}")`); break; }

// ── (1d) Orphan tokens → advisory count (a full token dictionary is by design) ─
const orphans = [...colorKeys].filter((k) => !referenced.colors.has(k));
if (orphans.length) INFO(`${orphans.length} documented colors not bound to a component (palette/theme reference): ${orphans.join(', ')}`);

// ── (2) DRIFT GUARD: every mapped token must match style.css :root ─────────
const rootBlock = (css.match(/:root\s*\{([\s\S]*?)\n\}/) || [])[1] || '';
const cssVar = {};
for (const m of rootBlock.matchAll(/(--[\w-]+):\s*([^;]+);/g)) cssVar[m[1].trim()] = m[2].trim();
// style.css :root var → DESIGN.md color token (the projection). add-blue, tan/tan-deep are
// not in :root (named literal / yard-theme) so they're intentionally outside this map.
const MAP = {
  '--accent': 'primary', '--on-orange': 'on-primary', '--accent-soft': 'accent-soft', '--accent-line': 'accent-line',
  '--bg': 'bg', '--bg-2': 'bg-2', '--panel': 'panel', '--panel-2': 'panel-2', '--card': 'card', '--card-head': 'card-head',
  '--anchor-section': 'anchor', '--line': 'line', '--line-soft': 'line-soft',
  '--txt': 'text', '--txt-2': 'text-2', '--txt-3': 'text-3', '--track': 'track',
  '--green': 'ready', '--yellow': 'caution', '--red': 'danger', '--blue': 'link', '--purple': 'scheduled',
  '--navy': 'navy', '--pink': 'pink', '--brown': 'brown', '--gray': 'gray',
};
const norm = (v) => v.toLowerCase().replace(/\s+/g, '')
  .replace(/rgba?\(([^)]+)\)/, (_, p) => 'rgba(' + p.split(',').map((x) => (/^\./.test(x.trim()) ? '0' + x.trim() : x.trim())).join(',') + ')');
let mapped = 0;
for (const [cv, dk] of Object.entries(MAP)) {
  const want = cssVar[cv], got = colors[dk];
  if (want == null) { WARN(`drift map: style.css ${cv} (→ ${dk}) not found in :root — update the map`); continue; }
  if (got == null) { ERR(`drift: DESIGN.md colors.${dk} missing — style.css ${cv} = ${want}`); continue; }
  if (norm(want) !== norm(got)) ERR(`drift: colors.${dk} = "${got}" ≠ style.css ${cv} = "${want}"`);
  else mapped++;
}

// ── (3) R-catalog cross-check vs app.js RULE_META (advisory) ───────────────
const rmBlock = (appjs.match(/const RULE_META\s*=\s*\{([\s\S]*?)\n\s*\};/) || [])[1] || '';
const metaRules = new Set([...rmBlock.matchAll(/^\s*(R\d+[a-z]*)\s*:/gm)].map((m) => m[1]));
const designRules = new Set([...body.matchAll(/\bR\d+[a-z]*\b/g)].map((m) => m[0]));
if (metaRules.size) {
  const missing = [...metaRules].filter((r) => r !== 'R5' && !designRules.has(r)).sort();
  const extra   = [...designRules].filter((r) => !metaRules.has(r)).sort();
  if (missing.length) WARN(`R-catalog: in RULE_META but undocumented in DESIGN.md: ${missing.join(', ')}`);
  if (extra.length)   WARN(`R-catalog: in DESIGN.md but not in RULE_META: ${extra.join(', ')}`);
} else INFO('R-catalog cross-check skipped (RULE_META not found in app.js)');

// ── Report ─────────────────────────────────────────────────────────────────
for (const m of infos) console.log('  · ' + m);
for (const m of warns) console.warn('⚠ ' + m);
if (errors.length) {
  for (const m of errors) console.error('✗ ' + m);
  console.error(`\n✗ DESIGN.md check FAILED — ${errors.length} error(s), ${warns.length} warning(s).`);
  process.exit(1);
}
console.log(`✓ DESIGN.md valid & in sync with style.css (${mapped} tokens) — 0 errors, ${warns.length} advisory warning(s).`);
