// Shared render harness for the Rental Wrangler logo-intro sample.
// Proven path (feasibility probe, Remotion 4.0.494): bundle() -> selectComposition()
// -> renderMedia(), with browserExecutable pinned to the pre-installed headless
// Chromium so there is ZERO network dependency at render time.
//
//   node render.mjs <entry.jsx> <CompId> <out.mp4>
//
import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia } from '@remotion/renderer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [, , entryArg, compId, outArg] = process.argv;
if (!entryArg || !compId || !outArg) {
  console.error('usage: node render.mjs <entry.jsx> <CompId> <out.mp4>');
  process.exit(1);
}

// The pre-installed headless-shell Chromium (guaranteed present per the environment
// contract). Rendering against this avoids Remotion's ~92MB one-time shell download.
const BROWSER = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const entryPoint = path.resolve(__dirname, entryArg);
const outputLocation = path.resolve(__dirname, outArg);

console.log('[render] bundling', entryPoint);
const serveUrl = await bundle({ entryPoint });

console.log('[render] selecting composition', compId);
const composition = await selectComposition({ serveUrl, id: compId, browserExecutable: BROWSER });

console.log(
  `[render] ${composition.width}x${composition.height} ${composition.durationInFrames}f @ ${composition.fps}fps`,
);
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation,
  browserExecutable: BROWSER,
});
console.log('RENDERED', outputLocation);

// Best-effort review stills. Remotion's vendored ffmpeg is a MINIMAL build (only the
// `scale` filter — no select/tile/fps), so we seek discrete timestamps with -ss and
// grab one frame each rather than build a filter montage. (The pre-installed Playwright
// ffmpeg is a stripped webm-only build and can't read h264 at all.)
try {
  const ffmpeg = path.join(__dirname, 'node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg');
  if (existsSync(ffmpeg)) {
    const durSec = composition.durationInFrames / composition.fps;
    const base = outputLocation.replace(/\.mp4$/, '');
    const fracs = [0.02, 0.25, 0.5, 0.75, 0.98];
    let ok = 0;
    fracs.forEach((fr, i) => {
      const t = (durSec * fr).toFixed(3);
      const still = `${base}-s${i}.png`;
      const r = spawnSync(
        ffmpeg,
        ['-y', '-ss', t, '-i', outputLocation, '-frames:v', '1', '-vf', 'scale=720:-1', still],
        { encoding: 'utf8' },
      );
      if (r.status === 0 && existsSync(still)) ok++;
    });
    console.log('STILLS', ok, '->', `${base}-s0..4.png`);
  }
} catch (e) {
  console.log('[render] stills error', e.message);
}
