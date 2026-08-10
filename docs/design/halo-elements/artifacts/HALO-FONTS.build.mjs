#!/usr/bin/env node
/**
 * Builds HALO-FONTS.html from HALO-FONTS.template.html.
 *
 * The page compares the typefaces the Halo games shipped against the Halo
 * Elements kit's own surface. None of the real faces are licensable for a
 * public Pages app, so the page renders OFL stand-ins — and because an
 * Artifact's CSP blocks font CDNs, they have to be embedded rather than
 * linked. This script pulls the latin subset of each stand-in from Google
 * Fonts and inlines it as a base64 @font-face at the /*FONTS* / marker.
 *
 *   node docs/design/halo-elements/artifacts/HALO-FONTS.build.mjs
 *
 * Requires network. The built HTML is committed, so a normal checkout never
 * needs to run this — only re-run it to change the face list or weights.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// Chrome UA — Google Fonts serves woff2 only to browsers it recognises.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** local family name → Google Fonts family spec. Order = load order. */
const FACES = [
  ['RW-Orbitron', 'Orbitron:wght@700'], //         Handel Gothic  (CE, H2)
  ['RW-Overpass', 'Overpass:wght@400;600'], //     Highway Gothic (CE body)
  ['RW-ChakraPetch', 'Chakra+Petch:wght@400;600;700'], // ITC Conduit (H3/ODST)
  ['RW-ArchivoNarrow', 'Archivo+Narrow:wght@400;700'], // TV Nord    (Reach)
  ['RW-Saira', 'Saira:wght@600;700'], //           Industry       (Infinite)
  ['RW-Archivo', 'Archivo:wght@400;700'], //       Normative Pro  (Infinite body) = canon
];

const LATIN = /unicode-range:\s*U\+0000-00FF/;

async function faceBlocks(family, spec) {
  const url = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${spec}: css2 returned ${res.status}`);
  const css = await res.text();

  const out = [];
  for (const block of css.split('@font-face').slice(1)) {
    if (!LATIN.test(block)) continue; // latin only — the page is English
    const weight = block.match(/font-weight:\s*(\d+)/)?.[1];
    const src = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (!weight || !src) continue;

    const bin = await fetch(src, { headers: { 'User-Agent': UA } });
    if (!bin.ok) throw new Error(`${spec} ${weight}: woff2 returned ${bin.status}`);
    const b64 = Buffer.from(await bin.arrayBuffer()).toString('base64');

    out.push(
      `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};` +
        `font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`
    );
    console.log(`  ${family} ${weight}  ${(b64.length / 1024).toFixed(0)} KB b64`);
  }
  if (!out.length) throw new Error(`${spec}: no latin faces found`);
  return out;
}

const css = [
  '/* Embedded OFL stand-ins for the Halo faces — see HALO-FONTS.build.mjs.',
  '   Generated, do not hand-edit: re-run the build script instead. */',
];
for (const [family, spec] of FACES) css.push(...(await faceBlocks(family, spec)));

const template = readFileSync(join(HERE, 'HALO-FONTS.template.html'), 'utf8');
if (!template.includes('/*FONTS*/')) throw new Error('template is missing the /*FONTS*/ marker');
const html = template.replace('/*FONTS*/', css.join('\n'));

const dest = join(HERE, 'HALO-FONTS.html');
writeFileSync(dest, html);
console.log(`\nwrote ${dest} — ${(html.length / 1048576).toFixed(2)} MB`);
