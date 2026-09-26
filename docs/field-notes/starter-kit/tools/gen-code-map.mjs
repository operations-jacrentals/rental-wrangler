#!/usr/bin/env node
/**
 * gen-code-map.mjs — the generated half of the two-file code map.
 *
 * Scans your source for CHAPTER banners and writes a machine-owned index with
 * live line numbers. The hand-written half (docs/CODE-MAP.md) tells the story
 * and never has to be regenerated.
 *
 *   node tools/gen-code-map.mjs           # write the index
 *   node tools/gen-code-map.mjs --check   # exit 1 if writing would change anything
 *
 * The --check mode is the whole point: wire it into CI and the map can never
 * silently drift from the code.
 *
 * A chapter banner is any comment line containing an ID and a title:
 *
 *   // ═══ <PREFIX>-01 · Utilities & formatting ═══════════════════════
 *   /* <PREFIX>-02 · State & sessions *\/
 *   # <PREFIX>-03 · Derivations
 *
 * IDs must be unique and must appear in file order — a stray reorder fails
 * --check, which is how you find out someone moved a chapter without saying so.
 *
 * No dependencies. Node 18+.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── configure these three for your project ───────────────────────────────────
const ROOT = process.cwd();
const SOURCE_DIRS = ['.', 'src', 'lib'];          // where to look
const OUT = 'docs/code-map.generated.md';          // what to write
const PREFIX = 'APP';                              // your chapter ID prefix
// ─────────────────────────────────────────────────────────────────────────────

const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rb', '.css']);
const SKIP_DIR = new Set([
  'node_modules', '.git', 'dist', 'build', 'vendor', 'coverage', '.next',
  // build tooling is not app source — drop these two if you do want it mapped
  'tools', 'ci',
]);
// never scan this generator itself: its own docs contain example banners
const SELF = relative(ROOT, fileURLToPath(import.meta.url));

const bannerRe = new RegExp(`\\b(${PREFIX}-\\d+)\\b[^\\S\\n]*[·\\-—:|]?[^\\S\\n]*(.*)$`);
// A "key symbol" is a top-level declaration — the things you actually jump to.
const symbolRe = /^(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\()|class\s+(\w+)|def\s+(\w+))/;

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue;
      walk(p, out);
    } else if (CODE_EXT.has(extname(e.name))) {
      out.push(p);
    }
  }
  return out;
}

function collectFiles() {
  const seen = new Set();
  const files = [];
  for (const d of SOURCE_DIRS) {
    const abs = join(ROOT, d);
    if (!existsSync(abs)) continue;
    for (const f of walk(abs)) {
      const rel = relative(ROOT, f);
      if (rel === SELF) continue;
      if (!seen.has(rel)) { seen.add(rel); files.push(rel); }
    }
  }
  return files.sort();
}

function scan(files) {
  const chapters = [];
  for (const rel of files) {
    const lines = readFileSync(join(ROOT, rel), 'utf8').split('\n');
    let current = null;
    lines.forEach((line, i) => {
      const m = line.match(bannerRe);
      // only treat it as a banner if the line is a comment
      const isComment = /^\s*(\/\/|\/\*|\*|#|<!--)/.test(line);
      if (m && isComment) {
        current = {
          id: m[1],
          // close the block comment FIRST, then strip the trailing rule characters
          title: (m[2] || '')
            .replace(/(\*\/|-->)\s*$/, '')
            .replace(/[═=\-*\/#\s]+$/, '')
            .trim() || '(untitled)',
          file: rel,
          line: i + 1,
          symbols: [],
        };
        chapters.push(current);
        return;
      }
      if (!current) return;
      const s = line.match(symbolRe);
      if (s) {
        const name = s[1] || s[2] || s[3] || s[4];
        if (name && current.symbols.length < 12) current.symbols.push(name);
      }
    });
  }
  return chapters;
}

function validate(chapters) {
  const problems = [];
  const byId = new Map();
  for (const c of chapters) {
    if (byId.has(c.id)) {
      problems.push(`duplicate chapter id ${c.id} — ${byId.get(c.id).file}:${byId.get(c.id).line} and ${c.file}:${c.line}`);
    } else {
      byId.set(c.id, c);
    }
  }
  // IDs should ascend within each file — a descending pair means a chapter moved.
  const byFile = new Map();
  for (const c of chapters) {
    if (!byFile.has(c.file)) byFile.set(c.file, []);
    byFile.get(c.file).push(c);
  }
  for (const [file, list] of byFile) {
    for (let i = 1; i < list.length; i++) {
      const prev = Number(list[i - 1].id.split('-')[1]);
      const cur = Number(list[i].id.split('-')[1]);
      if (cur < prev) {
        problems.push(`chapter order: ${list[i].id} appears after ${list[i - 1].id} in ${file}:${list[i].line}`);
      }
    }
  }
  return problems;
}

function render(chapters) {
  const stamp = [
    '<!-- GENERATED FILE — DO NOT EDIT BY HAND.',
    '     Produced by tools/gen-code-map.mjs. Run `node tools/gen-code-map.mjs` to refresh.',
    '     The hand-written companion is docs/CODE-MAP.md — edit that one. -->',
    '',
    '# Code map — generated index',
    '',
    `${chapters.length} chapters across ${new Set(chapters.map(c => c.file)).size} files.`,
    '',
    '| Chapter | Title | Location | Key symbols |',
    '|---|---|---|---|',
  ];
  for (const c of chapters) {
    const syms = c.symbols.length ? c.symbols.map(s => `\`${s}\``).join(', ') : '—';
    stamp.push(`| \`${c.id}\` | ${c.title} | \`${c.file}:${c.line}\` | ${syms} |`);
  }
  stamp.push('');
  stamp.push('## Found in file order');
  stamp.push('');
  let lastFile = null;
  for (const c of chapters) {
    if (c.file !== lastFile) { stamp.push(`\n**\`${c.file}\`**`); lastFile = c.file; }
    stamp.push(`- \`${c.id}\` — ${c.title} (line ${c.line})`);
  }
  stamp.push('');
  return stamp.join('\n');
}

// ── main ─────────────────────────────────────────────────────────────────────
const check = process.argv.includes('--check');
const chapters = scan(collectFiles());

if (!chapters.length) {
  console.error(`No ${PREFIX}-NN chapter banners found. Add one to a source file:\n`);
  console.error(`    // ═══ ${PREFIX}-01 · What this chapter is ═══════════════════\n`);
  process.exit(check ? 1 : 0);
}

const problems = validate(chapters);
if (problems.length) {
  console.error('Code map problems:');
  for (const p of problems) console.error('  ✗ ' + p);
  process.exit(1);
}

const next = render(chapters);
const outPath = join(ROOT, OUT);
const prev = existsSync(outPath) ? readFileSync(outPath, 'utf8') : null;

if (check) {
  if (prev !== next) {
    console.error(`✗ ${OUT} is out of date. Run: node tools/gen-code-map.mjs`);
    process.exit(1);
  }
  console.log(`✓ ${OUT} is current (${chapters.length} chapters).`);
} else {
  writeFileSync(outPath, next);
  console.log(`✓ wrote ${OUT} — ${chapters.length} chapters.`);
}
