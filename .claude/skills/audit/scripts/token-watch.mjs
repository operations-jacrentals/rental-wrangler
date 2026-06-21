#!/usr/bin/env node
// UserPromptSubmit hook — fires the /audit coaching report roughly every 100k
// tokens used this session. Reads the hook JSON on stdin (transcript_path,
// session_id), sums non-cache input+output across assistant turns, and when a
// new 100k bucket is crossed, prints a reminder that becomes context so Claude
// runs /audit after handling the current message. Silent otherwise. No deps.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const THRESHOLD = 100000;

let stdin = '';
try { stdin = readFileSync(0, 'utf8'); } catch {}
let info = {}; try { info = JSON.parse(stdin || '{}'); } catch {}
const transcript = info.transcript_path || info.transcriptPath;
const sessionId = info.session_id || info.sessionId || 'unknown';
if (!transcript || !existsSync(transcript)) process.exit(0);

let used = 0;
try {
  for (const line of readFileSync(transcript, 'utf8').split('\n')) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    const m = o.message || o;
    if (m.role === 'assistant') {
      const u = m.usage || o.usage || {};
      used += (u.input_tokens || 0) + (u.output_tokens || 0); // non-cache work
    }
  }
} catch { process.exit(0); }

const bucket = Math.floor(used / THRESHOLD);
const stateDir = join(tmpdir(), 'rw-audit-state');
const stateFile = join(stateDir, String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
let last = 0;
try { last = JSON.parse(readFileSync(stateFile, 'utf8')).bucket || 0; } catch {}

if (bucket > last) {
  try { mkdirSync(stateDir, { recursive: true }); writeFileSync(stateFile, JSON.stringify({ bucket })); } catch {}
  const k = Math.round(used / 1000);
  process.stdout.write(
    `[token checkpoint] ~${k}k tokens used this session (crossed ${bucket}x100k). ` +
    `After you finish the user's current request, run the /audit skill and give Jac a brief token + model-fit coaching report.`
  );
}
process.exit(0);
