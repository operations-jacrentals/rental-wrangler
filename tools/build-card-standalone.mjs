#!/usr/bin/env node
/* Build a SELF-CONTAINED copy of the Tier-0.1 card prototype, suitable for
   publishing as a Claude Artifact.
   ------------------------------------------------------------------------
   Why this exists: the prototype at docs/design/tier-01-card/index.html loads
   react, react-dom, dc-runtime, rw-namespace, two woff2 subsets and a steel
   texture as SEPARATE FILES. An Artifact is served under a strict CSP that
   blocks every external host, and it is wrapped in its own
   <!doctype>/<head>/<body>, so the published page has to be one file with no
   <html> scaffolding of its own.

   Hand-inlining that is how the published card silently fell behind the
   prototype: the artifact was a point-in-time copy nobody rebuilt. This makes
   it one command.

     node tools/build-card-standalone.mjs [outfile]

   Notes on two non-obvious steps:
   - window.__resources maps unpkg URLs to local react files for dc-runtime to
     fetch. React is inlined ahead of dc-runtime here, so the map is emptied
     rather than rewritten — there is nothing left to fetch.
   - steel-texture.png is referenced several times. Base64 is ~33% larger than
     the bytes, so inlining it per-reference would add megabytes; it is hoisted
     into a --rw-steel custom property and each reference becomes a var().        */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'docs/design/tier-01-card');
const OUT = process.argv[2] || resolve(SRC, 'card-standalone.html');
const TITLE = 'Tier 0.1 — the Units card';

const read = (f) => readFileSync(resolve(SRC, f), 'utf8');
const b64 = (f) => readFileSync(resolve(SRC, f)).toString('base64');
/* replacement strings go through a function so $& / $1 in base64 or JS can
   never be interpreted as replacement patterns */
const sub = (hay, needle, val) => hay.split(needle).join(val);

let html = read('index.html');
const before = html.length;

/* 1 — strip the page scaffolding the Artifact wrapper supplies itself */
html = html
  .replace(/^<!DOCTYPE html>\s*/i, '')
  .replace(/<\/?html[^>]*>/gi, '')
  .replace(/<\/?head[^>]*>/gi, '')
  .replace(/<\/?body[^>]*>/gi, '');

/* 2 — react/react-dom inlined ahead of everything, so dc-runtime finds the
       globals already present and the resource map has nothing to resolve */
/* the replacement MUST go through a function. React's source is full of
   $$typeof, and in a replacement STRING "$$" is the escape for a literal "$" —
   which silently rewrites every $$typeof to $typeof and leaves React a syntax
   error that only shows up as "Invalid or unexpected token" at runtime. */
const inlined =
  `<script>${read('react.production.min.js')}</script>\n` +
  `<script>${read('react-dom.production.min.js')}</script>\n` +
  `<script>window.__resources={};</script>`;
if (!/<script>window\.__resources = \{/.test(html)) throw new Error('__resources block not found');
html = html.replace(/<script>window\.__resources = \{[\s\S]*?\};<\/script>/, () => inlined);

/* 3 — the two local module scripts */
for (const f of ['dc-runtime.js', 'rw-namespace.js']) {
  const tag = `<script src="${f}"></script>`;
  if (!html.includes(tag)) throw new Error(`expected script tag missing: ${f}`);
  html = sub(html, tag, `<script>${read(f)}</script>`);
}

/* 4 — fonts, as data: URIs in place */
for (const f of ['archivo-latin-ext.woff2', 'archivo-latin.woff2']) {
  const uri = `url("data:font/woff2;base64,${b64(f)}")`;
  html = sub(html, `url("${f}")`, uri);
  html = sub(html, `url('${f}')`, uri);
  html = sub(html, `url(${f})`, uri);
}

/* 5 — the texture atlas. Every texture is referenced exactly ONCE, in the
       #rw-texroot :root block (inline chassis styles reach it via
       var(--rw-steel) etc.), so each url() is swapped for its data URI in
       place — no hoisting pass needed any more. */
const TEXTURES = ['steel-grain.png', 'steel-etch.png', 'halo-steel.png', 'halo-olive.png', 'halo-canvas.png', 'halo-circuit.png'];
for (const f of TEXTURES) {
  const ref = `url("${f}")`;
  const n = html.split(ref).length - 1;
  if (n !== 1) throw new Error(`expected exactly 1 atlas reference for ${f}, found ${n}`);
  html = sub(html, ref, `url(data:image/png;base64,${b64(f)})`);
}

/* 6 — title first */
html = `<title>${TITLE}</title>\n` + html.trimStart();

/* 7 — refuse to ship anything that still reaches off-page */
const leaks = [
  ...(html.match(/(?:src|href)="(?!data:|#)[^"]+"/g) || []),
  ...(html.match(/url\((?!data:|var\(|['"]?data:|#)[^)]*\.(?:png|jpe?g|woff2?|css|js)[^)]*\)/gi) || []),
];
if (leaks.length) {
  console.error('REFUSING TO WRITE — external references remain:');
  for (const l of [...new Set(leaks)].slice(0, 10)) console.error('  ' + l);
  process.exit(1);
}

writeFileSync(OUT, html);
console.log(`built ${OUT}`);
console.log(`  ${(before / 1024).toFixed(0)}KB source -> ${(html.length / 1024 / 1024).toFixed(2)}MB self-contained`);
console.log(`  atlas textures inlined: ${TEXTURES.length}`);
console.log(`  external references remaining: 0`);
