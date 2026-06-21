#!/usr/bin/env node
// /audit analyzer — crunch the current Claude Code session transcript for
// token efficiency + model-appropriateness. Prints a compact JSON metrics blob.
// Usage: node audit.mjs [--transcript <path.jsonl>]
// No deps; Node 18+. Reused by the ~100k auto-audit hook.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function findNewestTranscript() {
  const root = join(homedir(), '.claude', 'projects');
  let best = null;
  let projects;
  try { projects = readdirSync(root, { withFileTypes: true }); } catch { return null; }
  for (const proj of projects) {
    if (!proj.isDirectory()) continue;
    const projDir = join(root, proj.name);
    let entries;
    try { entries = readdirSync(projDir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      // top-level session files only — skip subagents/ and workflows/ subdirs
      if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
      const p = join(projDir, e.name);
      const m = statSync(p).mtimeMs;
      if (!best || m > best.m) best = { p, m };
    }
  }
  return best?.p ?? null;
}

const argIdx = process.argv.indexOf('--transcript');
const transcript = argIdx >= 0 ? process.argv[argIdx + 1] : findNewestTranscript();
if (!transcript) { console.log(JSON.stringify({ error: 'no transcript found' })); process.exit(0); }

let lines;
try { lines = readFileSync(transcript, 'utf8').split('\n').filter(Boolean); }
catch (e) { console.log(JSON.stringify({ error: 'cannot read transcript', transcript })); process.exit(0); }

let input = 0, output = 0, cacheRead = 0, cacheCreate = 0;
const models = {};
const tools = {};
const readPaths = {};
let bigOutputs = 0, bigOutputChars = 0, longAssistant = 0, reads = 0, grepGlob = 0;
const BIG = 20000;    // chars (~5k tokens): a "big" tool result
const LONGTXT = 6000; // chars: a "long" assistant text block

for (const line of lines) {
  let o; try { o = JSON.parse(line); } catch { continue; }
  const msg = o.message || o;
  const role = msg.role;
  if (role === 'assistant') {
    const u = msg.usage || o.usage || {};
    input += u.input_tokens || 0;
    output += u.output_tokens || 0;
    cacheRead += u.cache_read_input_tokens || 0;
    cacheCreate += u.cache_creation_input_tokens || 0;
    const model = msg.model || o.model || 'unknown';
    const mm = models[model] || (models[model] = { turns: 0, output: 0 });
    mm.turns++; mm.output += u.output_tokens || 0;
    for (const c of (msg.content || [])) {
      if (c.type === 'tool_use') {
        tools[c.name] = (tools[c.name] || 0) + 1;
        if (c.name === 'Read') { reads++; const fp = c.input?.file_path; if (fp) readPaths[fp] = (readPaths[fp] || 0) + 1; }
        else if (c.name === 'Grep' || c.name === 'Glob') grepGlob++;
      } else if (c.type === 'text' && typeof c.text === 'string' && c.text.length > LONGTXT) {
        longAssistant++;
      }
    }
  } else if (role === 'user') {
    const content = Array.isArray(msg.content) ? msg.content : [];
    for (const c of content) {
      if (c && c.type === 'tool_result') {
        const t = typeof c.content === 'string' ? c.content : JSON.stringify(c.content || '');
        if (t.length > BIG) { bigOutputs++; bigOutputChars += t.length; }
      }
    }
  }
}

const totalInputish = input + cacheRead + cacheCreate;
const cacheHitRate = totalInputish ? +(cacheRead / totalInputish).toFixed(3) : null;
const repeatedReads = Object.entries(readPaths)
  .filter(([, n]) => n > 1)
  .map(([file, n]) => ({ file, reads: n }))
  .sort((a, b) => b.reads - a.reads)
  .slice(0, 10);

console.log(JSON.stringify({
  transcript,
  turns: lines.length,
  tokens: { input, output, cacheRead, cacheCreate, approxContextTotal: totalInputish + output },
  cacheHitRate,
  models,
  tools,
  reads, grepGlob,
  repeatedReads,
  bigOutputs, bigOutputApproxTokens: Math.round(bigOutputChars / 4),
  longAssistantBlocks: longAssistant,
}, null, 2));
