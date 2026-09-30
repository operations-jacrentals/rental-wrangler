#!/usr/bin/env node
// rail-mutants.mjs — the mutation proof for the rw-api router (RC-84), its rail.json kill switch (RC-92 S3-A), the url
// binding (S3-4 A), the CI guard (ci/rail-guard.mjs), the unattended-promote refusal (S3-5 A: the inline step in
// auto-promote.yml, and promote.mjs / promote-guard.mjs behind it) and the shipped RAIL_URL
// (S3-2 A), plus the RC-83 Q13-A carrier in this release (Settings → Reset all keeps the Team Roster; rows Q01–Q10), the setUserPrefs
// beacon (B01–B02) and the CI job bound (C01).
// Each row below breaks the code in one named way; the suite that owns it must then FAIL ("killed"). A row
// marked `survive` is a control (the unmutated tree, or a legal rail.json) and must PASS.
//
// It NEVER touches this checkout: every worker copies the tracked (and untracked, non-ignored) files into its own
// temp folder, links node_modules there, mutates only the copy, and deletes the copy (link first) when it is done.
//
// NOT part of `npm run gates`: one row runs a whole suite (the logic suite is ~80 s), so the full table takes the
// better part of an hour. Run it after any change to the router, rail.json handling, rail-guard or promote-guard.
//
// usage: node ci/rail-mutants.mjs [--workers N] [--port P] [--only ID,ID] [--dry] [--out DIR] [--runner SCRIPT]
//   --workers N    parallel copies (default 1); worker w serves the logic suite on port P+w
//   --port P       first port for the logic suite's local server (default 9161; the suite itself uses 8000 in CI)
//   --only IDS     run just these rows
//   --dry          check that every anchor is found exactly once, run nothing
//   --out DIR      where each row's output and the summary JSON go (default: a temp folder, printed)
//   --runner SH    run the logic suite through an external `sh SH <dir> <port> <outfile>` script (same contract as
//                  a port-swapping runner); by default this script swaps the port itself, the same way
// Provenance: ported from the RC-92/RC-93 scratch proofs (fixrouter/mut.mjs, fx93/mut.mjs), rows re-anchored to this tree.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, mkdtempSync, rmSync, rmdirSync, existsSync, lstatSync, realpathSync, symlinkSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const WORKERS = Math.max(1, parseInt(opt('--workers', '1'), 10) || 1);
const PORT = parseInt(opt('--port', '9161'), 10) || 9161;
const ONLY = opt('--only', '') ? new Set(opt('--only', '').split(',').map((s) => s.trim()).filter(Boolean)) : null;
const DRY = argv.includes('--dry');
const RUNNER = opt('--runner', '');
const OUT = resolve(opt('--out', '') || mkdtempSync(join(tmpdir(), 'rw-rail-mut-out-')));
mkdirSync(OUT, { recursive: true });

const U = 'https://rw-api-production.up.railway.app';
// Whole-step anchors in auto-promote.yml (a row that deletes a step): the text from one step's `- name:` to the next's.
const WF = (() => { try { return readFileSync(join(ROOT, '.github', 'workflows', 'auto-promote.yml'), 'utf8'); } catch { return ''; } })();
const wfStep = (name, next) => { const i = WF.indexOf('      - name: ' + name), j = WF.indexOf('      - name: ' + next, i + 1); return i >= 0 && j > i ? WF.slice(i, j) : '\u0000no such step: ' + name; };
const WFY = { file: '.github/workflows/auto-promote.yml', suite: 'promote' };
// [id, from, to, { file = 'app.js', suite = 'logic', survive = false }]; from/to may be arrays (all replaced); to null deletes the file
const M = [
  ['CTRL1', null, null, { survive: true }],
  ['CTRLP', null, null, { suite: 'promote', survive: true }],
  // ── RC-84 router ──
  ['M01', "if (read || (body && body.error === 'rail-not-owner')) {", "if ((body && body.error === 'rail-not-owner')) {"],
  ['M02', "if (read || (body && body.error === 'rail-not-owner')) {", 'if (true) {'],
  ['M03', "  if (action === 'authVerify' && railMem.stickyStart) return railMem.stickyStart;\n", ''],
  ['M04', '/^rw1_/.test(', '/^rw2_/.test('],
  ['M05', 'strikesToOpen: 3', 'strikesToOpen: 4'],
  ['M06', "(e === 'busy' && !body.shed)", "(e === 'busy')"],
  ['M07', "  if (railMem.broken || railBreakerOpen()) return 'gas';\n  const t = railTable()", "  if (railMem.broken) return 'gas';\n  const t = railTable()"],
  ['M08', "  if (cohort === 'off') return 'gas';\n", ''],
  ['M09', "  if (!RAIL.url || !RAIL.actions.has(action)) return 'gas';\n  const cohort", "  if (!RAIL.url) return 'gas';\n  const cohort"],
  ['M10', "(cohort === 'canary' ? t.canary : t.all)", 't.all'],
  ['M11', 'if (railNeedsWait(action, payload)) await railRefresh();', 'if (railNeedsWait(action, payload)) railRefresh();'],
  ['M12', 'Math.min(t.ttlMs, RAIL.ttlMaxMs)', 't.ttlMs'],
  ['M13', '&& railShapeOk(j))) throw', ')) throw'],
  ['M14', ['  const table = railRetryBlocked() ? Promise.resolve(false) : (async () => {', '  if (railRetryBlocked() && !railMem.inflight) return gateDue;\n'], ['  const table = (async () => {', '']],
  ['M15', "contentType: 'application/json'", "contentType: 'text/plain;charset=utf-8'"],
  ['M16', "try { if (railNeedsWait(action, payload)) await railRefresh(); to = railPick(action, payload); } catch (e) { to = 'gas'; }", 'if (railNeedsWait(action, payload)) await railRefresh(); to = railPick(action, payload);'],
  ['M17', ' || (hdrVersion && (!t || hdrVersion !== t.version))', ''],
  ['M18', "if ((body && body.error === 'rail-not-owner') || (hdrVersion", 'if ((hdrVersion'],
  ['M19', "if (v === 'canary' || v === 'off') localStorage.setItem", "if (v === 'canary') localStorage.setItem"],
  ['M20', "sp.delete('rail'); ", ''],
  ['M21', "  if (action === 'authStart') railMem.stickyStart = 'rail';", ''],
  ['M22', "fetch(rail ? RAIL.url + '/healthz' : BACKEND_URL", 'fetch(BACKEND_URL'],
  ['M23', 'left > 0 && left <= RAIL.breakerMs', 'left > 0'],
  ['M24', 'read ? { timeoutMs: RAIL.readMs, bodyTimeoutMs: RAIL.readBodyMs } : opts', 'opts'],
  ['M25', '/^http-\\d+$/.test(e)', 'false'],
  ['M26', "if (body && body.ok === true) { railSafe(() => railTrace(action, 'rail', word, t0)); return body; }", "if (body && body.ok === true && !read) { railSafe(() => railTrace(action, 'rail', word, t0)); return body; }"],
  ['M27', "&& String(j.contract || '').split('.')[0] === RAIL.contract.split('.')[0] ", ''],
  ['R01', "  if (railMem.broken || railBreakerOpen()) return false;\n  if (railRetryBlocked()", "  if (railMem.broken) return false;\n  if (railRetryBlocked()"],
  ['R02', " || railCohort() === 'off') return false;", ') return false;'],
  ['R03', "return e === 'server-error' ||", "return e === 'ip-rate' || e === 'server-error' ||"],
  ['R04', "document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') railSafe(", "void (() => { if (document.visibilityState === 'visible') railSafe("],
  ['R06', " || railCohort() === 'off') return false;", " || railCohort() === 'OFF') return false;"],
  ['R07', "if (RAIL.url && railCohort() !== 'off') railRefresh();", 'if (RAIL.url) railRefresh();'],
  ['N01', "  if (railMem.broken || railBreakerOpen()) return 'gas';\n  const t = railTable()", "  if (railBreakerOpen()) return 'gas';\n  const t = railTable()"],
  ['N02', "railMem.broken = true; railNote('broken'", "railNote('broken'"],
  ['N03', 'railPersist(() => localStorage.setItem(RAIL_KEY.breaker, JSON.stringify({ openUntil: Date.now() + RAIL.breakerMs })));', 'try { localStorage.setItem(RAIL_KEY.breaker, JSON.stringify({ openUntil: Date.now() + RAIL.breakerMs })); } catch (e) {}'],
  ['N04', "if (!railPersist(() => localStorage.setItem(RAIL_KEY.routes, JSON.stringify({ version: j.version, all: j.all, canary: j.canary, ttlMs: j.ttlMs, fetchedAt: Date.now() })))) throw new Error('routes-store');", 'localStorage.setItem(RAIL_KEY.routes, JSON.stringify({ version: j.version, all: j.all, canary: j.canary, ttlMs: j.ttlMs, fetchedAt: Date.now() }));'],
  ['N05', 'read ? { timeoutMs: RAIL.readMs, bodyTimeoutMs: RAIL.readBodyMs } : opts', 'read ? { timeoutMs: RAIL.readMs } : opts'],
  ['N06', "    if (timer) { clearTimeout(timer); timer = setTimeout(() => ac.abort(), (opts && opts.bodyTimeoutMs) || ms * 2); }\n", "    if (timer && !(opts && opts.bodyTimeoutMs === RAIL.readBodyMs)) { clearTimeout(timer); timer = setTimeout(() => ac.abort(), (opts && opts.bodyTimeoutMs) || ms * 2); }\n"],
  ['N07', "      railNote('breaker', ", "      (() => {})('breaker', "],
  ['N08', "if (read) railSafe(() => railNote('fell:' + action,", "if (false) railSafe(() => railNote('fell:' + action,"],
  ['N09', "  if (r.ok === false && r.error === 'busy') return pidErr(\"Couldn't send the text — try again.\");\n", ''],
  ['N10', 'if (untouched) return pidErr(', 'if (false) return pidErr('],
  ['N11', "(r.error === 'busy' || r.error === 'ip-rate')", "(r.error === 'busy')"],
  ['N12', "  if (railMem.broken || railBreakerOpen()) return false;\n  if (railRetryBlocked()", "  if (railBreakerOpen()) return false;\n  if (railRetryBlocked()"],
  ['N13', 'railMem.noted[key] = 1; logErr(', 'logErr('],
  ['N14', ["  railPersist(() => { if (v === 'canary' || v === 'off')", "localStorage.removeItem(RAIL_KEY.cohort); });   // a lever that did not stick"], ["  try { (() => { if (v === 'canary' || v === 'off')", "localStorage.removeItem(RAIL_KEY.cohort); })(); } catch (e) {}   // a lever that did not stick"]],
  // ── S3-A (RC-92): rail.json, the kill switch ──
  ['S01', "  if (railMem.gate !== true) return 'gas';", ''],
  ['S02', ["  if (railMem.gate !== true) return 'gas';", '  if (sticky) return sticky;\n'], ['', "  if (sticky) return sticky;\n  if (railMem.gate !== true) return 'gas';\n"]],
  ['S03', "if (!(j && j.on === true)) return 'off';", "if (!(j && j.on == true)) return 'off';"],
  ['S04', "if (!(j && j.on === true)) return 'off';", "if (!(j && j.on)) return 'off';"],
  ['S05', "    if (!res.ok) return 'http-' + res.status;\n", ''],
  ['S06', "mode: 'same-origin', cache: 'no-store', credentials: 'omit', signal }", "mode: 'same-origin', credentials: 'omit', signal }"],
  ['S07', "mode: 'same-origin', cache: 'no-store', credentials: 'omit', signal }", "mode: 'same-origin', cache: 'no-store', signal }"],
  ['S08', "mode: 'same-origin', cache: 'no-store', credentials: 'omit', signal }", "cache: 'no-store', credentials: 'omit', signal }"],
  ['S09', 'railGateRead(ac.signal).then((w) => { railSafe(() => railGateSet(w)); return w; });', 'railGateRead(ac.signal).then((w) => { setTimeout(() => railSafe(() => railGateSet(w)), 0); return w; });'],
  ['S10', 'railGateRead(ac.signal).then(', 'railGateRead(undefined).then('],
  ['S11', ['railGateRead(ac.signal).then((w) => { railSafe(() => railGateSet(w)); return w; });', 'Promise.all([gate, table]).then((r) => { clearTimeout(timer); return r[1]; });'], ['railGateRead(ac.signal);', 'Promise.all([gate, table]).then((r) => { if (r[1]) railSafe(() => railGateSet(r[0])); clearTimeout(timer); return r[1]; });']],
  ['S12', 'age < 0 || age >= RAIL.ttlMaxMs; }', 'age < 0 || age >= Infinity; }'],
  ['S13', '  return railStale(railTable()) || gateDue;', '  return railStale(railTable());'],
  ['S14', "  if (sticky) return sticky === 'rail' && gateDue;", '  if (sticky) return false;'],
  ['S15', "  if (sticky) return sticky === 'rail' && gateDue;", '  if (sticky) return gateDue;'],
  ['S16', 'if (!railMem.gate && was) railNote(', 'if (false) railNote('],
  ['S17', 'if (railMem.gate && !was) railNote(', 'if (false) railNote('],
  ['S18', "railNote('gate:off', ", "railNote('gate:off' + Date.now(), "],
  ['S19', "railMem.gate = word === 'on';", 'railMem.gate = !!word;'],
  ['S20', '    gate: { on: railMem.gate === true, why: railGateWhy(railMem.gateWord), word: railMem.gateWord, checkedAt: railMem.gateAt },', ''],
  ['S21', "gateUrl: './rail.json',", "gateUrl: RAIL_URL + '/rail.json',"],
  ['S22', "  } catch (e) { return signal && signal.aborted ? 'timeout' : 'network'; }", "  } catch (e) { return 'network'; }"],
  ['S23', "let j; try { j = JSON.parse(text); } catch (e) { return 'bad-json'; }", "let j; try { j = JSON.parse(text); } catch (e) { return 'on'; }"],
  ['S24', '  if (url.pathname === RAIL_GATE) return;', '  if (false) return;', { file: 'sw.js' }],
  ['S25', "'./rule-usage.js', './manifest.webmanifest'];", "'./rule-usage.js', './manifest.webmanifest', './rail.json'];", { file: 'sw.js' }],
  ['S26', '{"on":false}', '{"on":"true"}', { file: 'rail.json' }],
  ['S27', "const ALWAYS_SHIP = ['sw.js', '.nojekyll', 'rail.json'];", "const ALWAYS_SHIP = ['sw.js', '.nojekyll'];", { file: 'tools/deploy-staging.mjs' }],
  // ── RC-93 review fixes ──
  ['X01', "railMem.gate = word === 'on';", "railMem.gate = word === 'on' || (was && word !== 'off');"],
  ['X02', 'return !railMem.gateAt || age < 0 || age >= RAIL.ttlMaxMs; }', 'return !railMem.gateAt || age >= RAIL.ttlMaxMs; }'],
  ['X03', 'a >= 0 && a < RAIL.refreshRetryMs', 'a < RAIL.refreshRetryMs'],
  ['X04', '  if (railMem.inflight) return railMem.inflight;\n  const ac = new AbortController()', '  if (railMem.inflight) return railMem.inflight;\n  if (railRetryBlocked()) return Promise.resolve(false);\n  const ac = new AbortController()'],
  ['X05', '  if (!gateDue && railMem.gate !== true) return false;\n', ''],
  ['X06', "const p = Promise.race([done, gate.then((w) => (w === 'on' ? done : false))]);", 'const p = done;'],
  ['X07', "const p = Promise.race([done, gate.then((w) => (w === 'on' ? done : false))]);", 'const p = Promise.race([done, gate.then(() => false)]);'],
  ['X08', '  if (railRetryBlocked() && !railMem.inflight) return gateDue;\n', '  if (railRetryBlocked() && !railMem.inflight) return false;\n'],
  ['X09', '  const table = railRetryBlocked() ? Promise.resolve(false) : (async () => {', '  const table = (async () => {'],
  ['X10', '  if (railRetryBlocked() && !railMem.inflight) return gateDue;\n', ''],
  ['X11', "  if (sticky) return sticky === 'rail' && gateDue;\n  if (railMem.broken", "  if (sticky) return sticky === 'rail' && gateDue && !railRetryBlocked();\n  if (railMem.broken"],
  // ── S3-4 A (1): the on file must name this build's origin exactly ──
  ['U01', "return typeof j.url === 'string' && j.url !== '' && j.url === RAIL.url ? 'on' : 'url-mismatch';", "return 'on';"],   // the RC-92 gate: any {"on":true}
  ['U02', "j.url === RAIL.url ? 'on'", "j.url.replace(/\\/+$/, '') === RAIL.url ? 'on'"],   // a trailing slash forgiven
  ['U03', "j.url === RAIL.url ? 'on'", "j.url.toLowerCase() === RAIL.url.toLowerCase() ? 'on'"],   // case folded
  ['U04', "return typeof j.url === 'string' && j.url !== '' && j.url === RAIL.url ? 'on' : 'url-mismatch';", "return j.url == RAIL.url ? 'on' : 'url-mismatch';"],   // loose equality ([url] == url)
  ['U05', "j.url === RAIL.url ? 'on'", "j.url.startsWith(RAIL.url) ? 'on'"],   // a prefix match (url + '/v1', url + '/')
  ['U06', "railMem.gate = word === 'on';", "railMem.gate = word === 'on' || word === 'url-mismatch';"],   // a mismatch still routes
  ['U07', "j.url === RAIL.url ? 'on'", "j.url === RAIL_URL ? 'on'"],   // bound to the constant, not the origin this page sends to (an old build's view)
  ['U08', "function railGateWhy(word) { return word === 'on' || word === 'off' || word === 'url-mismatch' || word === 'unchecked' ? word : 'error'; }", 'function railGateWhy(word) { return word; }'],
  ['U09', "  if (railMem.gateWord === 'url-mismatch') railNote('gate:url',", "  if (false) railNote('gate:url',"],
  ['U10', "j.url === RAIL.url ? 'on'", "j.url.trim() === RAIL.url ? 'on'"],   // whitespace forgiven
  ['U11', "typeof j.url === 'string' && j.url !== '' && j.url === RAIL.url", "typeof j.url === 'string' && (j.url === '' || j.url === RAIL.url)"],   // an empty url accepted
  // ── S3-4 A (2): the CI guard accepts exactly {"on":false} and {"on":true,"url":"<RAIL_URL>"} ──
  ['G01', '{"on":false}', '{"on":true}', { file: 'rail.json' }],   // the RC-92 on file: now illegal
  ['G02', '{"on":false}', '{"on":false}\n', { file: 'rail.json', survive: true }],   // legal: one final newline
  ['G03', '{"on":false}', '﻿{"on":false}', { file: 'rail.json' }],
  ['G04', '{"on":false}', null, { file: 'rail.json' }],
  ['G05', '{"on":false}', '{"on": false}', { file: 'rail.json' }],
  ['G06', '{"on":false}', '{"on":true,"url":"' + U + '"}', { file: 'rail.json', survive: true }],   // legal: the turn-on commit passes CI (the shipped-build case follows it)
  ['G07', '{"on":false}', '{"on":true,"url":"' + U + '/"}', { file: 'rail.json' }],
  ['G08', '{"on":false}', '{"on":true,"url":"https://rw-api-old.up.railway.app"}', { file: 'rail.json' }],
  ['G09', '{"on":false}', '{"url":"' + U + '","on":true}', { file: 'rail.json' }],
  ['G10', '{"on":false}', '{"on":false,"url":"' + U + '"}', { file: 'rail.json' }],
  ['V01', "forms.push('{\"on\":true,\"url\":' + JSON.stringify(railUrl) + '}');", "forms.push('{\"on\":true}');", { file: 'ci/rail-guard.mjs' }],
  ['V02', "const body = text.endsWith('\\r\\n') ? text.slice(0, -2) : text.endsWith('\\n') ? text.slice(0, -1) : text;", 'const body = text.trim();', { file: 'ci/rail-guard.mjs' }],
  ['V03', "if (typeof railUrl === 'string' && railUrl !== '') forms.push(", "if (typeof railUrl === 'string') forms.push(", { file: 'ci/rail-guard.mjs' }],
  ['V04', "const m = String(src || '').match(/\\nconst RAIL_URL = '([^'\\n\\\\]*)';/);", "const m = String(src || '').match(/\\nconst RAIL_URL = ['\"]([^'\"\\n\\\\]*)['\"];/);", { file: 'ci/rail-guard.mjs' }],
  ['V05', 'return railFileForms(railUrl).includes(body);', 'return railFileForms(railUrl).some((f) => { try { return JSON.stringify(JSON.parse(body)) === f; } catch (e) { return false; } });', { file: 'ci/rail-guard.mjs' }],
  // ── S3-5 A (3): the unattended promote path refuses a range that touches rail.json ──
  ['P01', "|| String((env || {}).GITHUB_ACTIONS || '').toLowerCase() === 'true'", '', { file: 'tools/lib/promote-guard.mjs', suite: 'promote' }],
  ['P02', "  return net.ok && each.ok ? [...new Set(lines(net.out + '\\n' + each.out))] : null;", '  return net.ok ? [...new Set(lines(net.out))] : null;', { file: 'tools/promote.mjs', suite: 'promote' }],
  ['P03', "['log', '--format=', '--name-only', '--no-renames', '-m', range]", "['log', '--format=', '--name-only', '--no-renames', range]", { file: 'tools/promote.mjs', suite: 'promote' }],
  ['P04', 'if (railRefusal) {', 'if (false) {', { file: 'tools/promote.mjs', suite: 'promote' }],
  ['P05', ".split('/').pop().toLowerCase() === RAIL_GATE_FILE", ".split('/').pop() === RAIL_GATE_FILE", { file: 'tools/lib/promote-guard.mjs', suite: 'promote' }],
  ['P06', "  if (!Array.isArray(paths)) return 'could not list", "  if (!Array.isArray(paths)) return null; if (0) return 'could not list", { file: 'tools/lib/promote-guard.mjs', suite: 'promote' }],
  ['P07', 'run: node tools/promote.mjs --yes --unattended', 'run: node tools/promote.mjs --yes', { file: '.github/workflows/auto-promote.yml', suite: 'promote' }],
  ['P08', ["['diff', '--name-only', '--no-renames', prodRef, trunkRef]", "['log', '--format=', '--name-only', '--no-renames', '-m', range]"], ["['diff', '--name-only', prodRef, trunkRef]", "['log', '--format=', '--name-only', '-m', range]"], { file: 'tools/promote.mjs', suite: 'promote' }],
  ['P09', ['const touched = rangePaths();', "console.log('');\nconsole.log('promote: --yes given"], ["const touched = [];", "if (unattendedRailRefusal({ unattended: UNATTENDED, paths: rangePaths() })) fail('late refusal');\nconsole.log('');\nconsole.log('promote: --yes given"], { file: 'tools/promote.mjs', suite: 'promote' }],   // the refusal after the staging probes
  // ── S3-5 A (3b): the inline auto-promote.yml step, the layer an auto-fix cannot rewrite ──
  ['P10', wfStep('Refuse an unattended range that touches rail.json', 'Promote the merged auto-fix'), '', WFY],   // the inline step deleted
  ['P11', 'Nothing was pushed."\n            exit 1', 'Nothing was pushed."\n            exit 0', WFY],   // it finds rail.json and says so, but lets the promote run
  ['P12', '--no-renames -m "$PROD..$TRUNK"', '--no-renames "$PROD..$TRUNK"', WFY],   // merge commits not diffed against their parents
  ['P13', "'tolower($NF) == \"rail.json\"'", "'$NF == \"rail.json\"'", WFY],   // case-sensitive
  ['P14', 'git diff -z --name-only --no-renames "$PROD" "$TRUNK"; git log -z --format= --name-only --no-renames -m', 'git diff -z --name-only "$PROD" "$TRUNK"; git log -z --format= --name-only -m', WFY],   // a rename hides rail.json
  ['P15', '        id: rail-refusal\n', '        id: rail-refusal\n        continue-on-error: true\n', WFY],   // a refusal the job ignores
  ['P16', "        if: always() && steps.rail-refusal.outcome == 'success'", "        if: success() && steps.rail-refusal.outcome == 'success'", WFY],   // no confirm when the promote step fails after pushing
  ['P17', '          if [ "$NOW" != "$RAIL_CHECKED_TRUNK" ] && [ "$NOW" != "$RAIL_CHECKED_PROD" ]; then', '          if false; then', WFY],   // the confirm step never fails
  ['P18', wfStep('Confirm production landed on the trunk tip that was checked', 'Tell the reporter'), '', WFY],   // the confirm step deleted
  ['P19', "          set -euo pipefail\n          git fetch -q --no-tags origin '+refs/heads/trunk", "          set -euo pipefail\n          node tools/lib/rail-check.mjs\n          git fetch -q --no-tags origin '+refs/heads/trunk", WFY],   // the step hands control to a repo script
  ['P20', "          set -euo pipefail\n          git fetch -q --no-tags origin '+refs/heads/trunk", "          set +e\n          git fetch -q --no-tags origin '+refs/heads/trunk", WFY],   // fails open when git fails
  ['P21', '        run: node tools/promote.mjs --yes --unattended', '        if: always()\n        run: node tools/promote.mjs --yes --unattended', WFY],   // the promote runs even after a refusal
  // ── S3-2 A (4): the shipped RAIL_URL, and nothing caches rw-api ──
  ['W01', "const RAIL_URL = '" + U + "';", "const RAIL_URL = '" + U + "/';"],
  ['W02', "const RAIL_URL = '" + U + "';", "const RAIL_URL = '';"],
  ['W03', "const RAIL_URL = '" + U + "';", "const RAIL_URL = 'https://rw-api-staging.up.railway.app';"],
  ['W04', '  if (url.origin !== self.location.origin) return;', '', { file: 'sw.js' }],   // a cross-origin rw-api path that collides with the shell would be answered from cache
  // ── RC-83 Q13-A (auth): Settings → Reset all keeps settings.employees, so the backend never purges the crew's sign-ins ──
  ['Q01', ["  const emp = ((o.config && o.config.settings) || {}).employees;\n  const kept = Array.isArray(emp) ? { employees: emp } : {};\n", 'settings: kept } }); } catch (e) {}\n  persistAdminSettings(kept);\n  o.draftSettings = {}; o.config.settings = kept;'], ['', 'settings: {} } }); } catch (e) {}\n  persistAdminSettings({});\n  o.draftSettings = {}; o.config.settings = {};']],   // the whole fix reverted: the 0a01796 behaviour
  ['Q02', 'admin: o.config.admin, settings: kept } });', 'admin: o.config.admin, settings: {} } });'],   // the backend is sent an empty roster (the crew-wide sign-out)
  ['Q03', '  persistAdminSettings(kept);\n', '  persistAdminSettings({});\n'],   // this device forgets the roster
  ['Q04', 'const kept = Array.isArray(emp) ? { employees: emp } : {};', 'const kept = o.config.settings || {};'],   // "Reset all" resets nothing
  ['Q05', "'Click again — reset all but the Team Roster'", "'Click again — reset everything'"],   // the armed confirm no longer says what it keeps
  ['Q06', ' data-tip="Resets every customization except the Team Roster"', ''],   // the button's tip gone
  ['Q07', '.is-phone .settings-popup .popup-foot { flex-wrap: wrap; row-gap: 8px; }', '.is-phone .settings-popup .popup-foot { row-gap: 8px; }', { file: 'style.css' }],   // on a phone the armed confirm is pushed off-screen
  // ── release review fixes (RC-97 run): the Settings footer repaint, the KPI lock-in reopen, the beacon, the CI bound ──
  ['Q08', 'settings: JSON.parse(JSON.stringify(settings)) }, adminPw: kt.adminPw', 'settings }, adminPw: kt.adminPw'],   // the KPI reopen shares one object: an unsaved roster delete rides Reset all
  ['Q09', "  const foot = document.querySelector('.overlay .settings-popup .popup-foot'); if (foot) foot.innerHTML = settingsFootHtml(o);\n", ''],   // the in-place repaint leaves the footer: the armed confirm never shows
  ['Q10', 'if (o.resetArm) return resetAllSettings(); o.resetArm = true; reSettings(); return;', 'if (o.resetArm) return resetAllSettings(); o.resetArm = true; return;'],   // click #1 arms with no repaint at all
  ['B01', "let beaconUrl = BACKEND_URL; try { if (railPick('setUserPrefs', null) === 'rail') beaconUrl = RAIL.url + '/v1'; } catch (e) {}", "let beaconUrl = RAIL.url + '/v1';"],   // the credential-bearing beacon always goes to rw-api
  ['B02', "railPick('setUserPrefs', null)", "railPick('load', null)"],   // the beacon follows load's route instead of its own action's
  ['C01', '    timeout-minutes: 30\n', '', { file: '.github/workflows/ci.yml' }],   // the required CI job loses its time limit: a hung suite blocks trunk for 6 h
];

const rows = M.filter(([id]) => !ONLY || ONLY.has(id)).map(([id, from, to, o]) => ({ id, from, to, file: 'app.js', suite: 'logic', survive: false, ...(o || {}) }));

function mutateText(s, row) {
  if (row.from === null) return { text: s };
  const froms = [].concat(row.from), tos = [].concat(row.to);
  for (let i = 0; i < froms.length; i++) {
    const c = s.split(froms[i]).length - 1;
    if (c !== 1) return { bad: `anchor found ${c}x in ${row.file}: ${JSON.stringify(froms[i].slice(0, 80))}` };
    if (tos[i] !== null) s = s.replace(froms[i], () => tos[i]);
  }
  return { text: s, del: tos.length === 1 && tos[0] === null };
}

// ── the copies ──
function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z', '-co', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
}
function insideRoot(p) { const r = relative(ROOT, p); return r === '' || (!r.startsWith('..') && !isAbsolute(r)); }
function makeCopy(files) {
  const dir = mkdtempSync(join(tmpdir(), 'rw-rail-mut-'));
  if (insideRoot(dir)) throw new Error('refusing: the copy would live inside the checkout');
  for (const f of files) { const d = join(dir, f); mkdirSync(dirname(d), { recursive: true }); copyFileSync(join(ROOT, f), d); }
  const nm = join(ROOT, 'node_modules');
  if (existsSync(nm)) symlinkSync(realpathSync(nm), join(dir, 'node_modules'), 'junction');
  return dir;
}
function dropCopy(dir) {
  if (insideRoot(dir)) return;   // never
  const link = join(dir, 'node_modules');
  if (existsSync(link) || (() => { try { lstatSync(link); return true; } catch { return false; } })()) {
    if (!lstatSync(link).isSymbolicLink()) { console.error(`rail-mutants: ${link} is not a link — leaving ${dir} in place`); return; }
    try { unlinkSync(link); } catch { rmdirSync(link); }   // removes the link itself, never what it points at
    if ((() => { try { lstatSync(link); return true; } catch { return false; } })()) { console.error(`rail-mutants: could not remove ${link} — leaving ${dir}`); return; }
  }
  rmSync(dir, { recursive: true, force: true });
}

function run(cmd, args, cwd, outFile) {
  return new Promise((res) => {
    const c = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; });
    const t = setTimeout(() => { try { c.kill(); } catch {} }, 15 * 60 * 1000);
    c.on('close', (code) => { clearTimeout(t); writeFileSync(outFile, out); res(code == null ? 99 : code); });
  });
}
async function runSuite(dir, suite, port, outFile) {
  if (suite === 'promote') return run(process.execPath, ['ci/promote-test.mjs'], dir, outFile);
  if (RUNNER) {
    const code = await run('sh', [RUNNER, dir, String(port), outFile + '.runner'], dir, outFile + '.sh');
    try { writeFileSync(outFile, readFileSync(outFile + '.runner')); } catch {}
    return code;
  }
  const src = readFileSync(join(dir, 'ci', 'logic-test.mjs'), 'utf8').replace(/localhost:8000/g, 'localhost:' + port).replace(/listen\(8000/g, 'listen(' + port);
  writeFileSync(join(dir, 'ci', '_lt_port.mjs'), src);
  try { return await run(process.execPath, ['ci/_lt_port.mjs'], dir, outFile); } finally { try { unlinkSync(join(dir, 'ci', '_lt_port.mjs')); } catch {} }
}

const files = trackedFiles();
const results = [];
if (DRY) {
  const cache = {};
  for (const row of rows) {
    const s = cache[row.file] ??= (existsSync(join(ROOT, row.file)) ? readFileSync(join(ROOT, row.file), 'utf8') : '');
    const m = mutateText(s, row);
    let detail = m.bad || '';
    if (!m.bad && !m.del && row.from !== null && /\.m?js$/.test(row.file)) {   // a mutant must still parse: a syntax error is a cheap kill that proves nothing
      const tmpDir = mkdtempSync(join(tmpdir(), 'rw-rail-mut-chk-')), f = join(tmpDir, 'x' + (row.file.endsWith('.mjs') ? '.mjs' : '.js'));
      try { writeFileSync(f, m.text); execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { detail = 'does not parse: ' + String(e.stderr || e.message).split('\n').find((l) => /Error/.test(l)); } finally { rmSync(tmpDir, { recursive: true, force: true }); }
    }
    results.push({ id: row.id, result: m.bad ? 'BAD-ANCHOR' : detail ? 'NO-PARSE' : 'ANCHOR-OK', detail });
  }
  results.forEach((r) => console.log(r.id, r.result, r.detail));
  const bad = results.filter((r) => r.result !== 'ANCHOR-OK').length;
  console.log(`${results.length - bad}/${results.length} anchors found exactly once, every JS mutant parses`);
  process.exit(bad ? 1 : 0);
}

const queue = rows.slice();
async function worker(w) {
  const dir = makeCopy(files), port = PORT + w;
  try {
    while (queue.length) {
      const row = queue.shift(), F = join(dir, row.file), outFile = join(OUT, `mut-${row.id}.out`);
      const orig = existsSync(F) ? readFileSync(F) : null;
      const m = mutateText(orig ? orig.toString('utf8') : '', row);
      if (m.bad) { results.push({ id: row.id, result: 'BAD-ANCHOR', detail: m.bad }); console.log(row.id, 'BAD-ANCHOR', m.bad); continue; }
      if (row.from !== null) { if (m.del) unlinkSync(F); else writeFileSync(F, m.text, 'utf8'); }
      const t0 = Date.now();
      let code; try { code = await runSuite(dir, row.suite, port, outFile); } finally { if (orig) writeFileSync(F, orig); }
      let fails = []; try { fails = readFileSync(outFile, 'utf8').split('\n').filter((l) => /✗ FAIL|Logic test threw|Console\/page errors|UNEXPECTED THROW/.test(l)); } catch {}
      const passed = code === 0, ok = row.survive ? passed : !passed;
      const r = { id: row.id, suite: row.suite, result: passed ? 'SURVIVED' : 'KILLED', expected: row.survive ? 'SURVIVE' : 'KILL', ok, fails: fails.length, first: (fails[0] || '').trim().slice(0, 200), secs: Math.round((Date.now() - t0) / 1000) };
      results.push(r); console.log(JSON.stringify(r));
    }
  } finally { dropCopy(dir); }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: Math.min(WORKERS, rows.length) }, (_, i) => worker(i)));
results.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(OUT, 'rail-mutants.json'), JSON.stringify(results, null, 1));
const wrong = results.filter((r) => !r.ok);
const kills = results.filter((r) => r.expected === 'KILL');
console.log(`\n${wrong.length ? '❌' : '✅'} rail-mutants: ${kills.filter((r) => r.result === 'KILLED').length}/${kills.length} mutants killed; ${results.filter((r) => r.expected === 'SURVIVE' && r.ok).length}/${results.filter((r) => r.expected === 'SURVIVE').length} controls passed; ${Math.round((Date.now() - t0) / 1000)} s; logs in ${OUT}`);
if (wrong.length) console.log('  wrong: ' + wrong.map((r) => `${r.id} ${r.result}${r.detail ? ' ' + r.detail : ''}`).join(', '));
process.exit(wrong.length ? 1 : 0);
