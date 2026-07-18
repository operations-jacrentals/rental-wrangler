// run-live — static file server for driving the app locally.
// Serves the repo root on :9147 (8000 is reserved for the CI smoke server).
// Run from the repo root: `node .claude/skills/run-live/scripts/serve.mjs`
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const ROOT = process.cwd();          // run from the repo root
const PORT = Number(process.env.RW_PORT || 9147);

createServer(async (q, s) => {
  try {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const safe = normalize(p).replace(/^(\.\.[\/\\])+/, '');   // no path traversal
    const data = await readFile(join(ROOT, safe));
    s.writeHead(200, { 'Content-Type': MIME[extname(safe)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    s.end(data);
  } catch { s.writeHead(404); s.end('Not found'); }
}).listen(PORT, () => console.log('run-live: serving ' + ROOT + ' on http://localhost:' + PORT));
