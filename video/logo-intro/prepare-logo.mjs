// Extract the embedded PNG from the repo's jac-rentals-logo.svg (a Sketch export
// that wraps a single raster) into public/logo.png so Remotion can <Img> it.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = '/home/user/rental-wrangler/assets/jac-rentals-logo.svg';
const svg = readFileSync(SRC, 'utf8');

const m = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=\s]+)/);
if (!m) {
  console.error('no data:image/png found in', SRC);
  process.exit(1);
}
const buf = Buffer.from(m[1].replace(/\s+/g, ''), 'base64');

mkdirSync('public', { recursive: true });
writeFileSync('public/logo.png', buf);

// Parse the IHDR chunk for dimensions (sig 8 + len 4 + 'IHDR' 4 => w@16, h@20).
const w = buf.readUInt32BE(16);
const h = buf.readUInt32BE(20);
console.log(`wrote public/logo.png ${buf.length} bytes, ${w}x${h}`);
