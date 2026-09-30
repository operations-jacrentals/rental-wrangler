// promote-guard.mjs — the unattended promote path never carries rail.json (rw-api CONTRACT §3.5, RC-92 S3-5 A).
//
// WHY THIS EXISTS
// rail.json is the router's kill switch: {"on":true,"url":"<RAIL_URL>"} lets devices send sign-in and load calls to
// rw-api, {"on":false} sends everything to Apps Script. CI accepts both files (ci/rail-guard.mjs), so a commit that
// flips it merges like any other. The unattended path — .github/workflows/auto-promote.yml, which fast-forwards
// `production` to the WHOLE trunk tip whenever a Wrangler auto-fix merges — would then take that flip live with no
// human in the loop, riding along with an unrelated fix. Turning routing on or off must always be a human (or Claude,
// on the owner's word) promote, so the unattended path refuses any range in which ANY commit touches rail.json.
//
// A run is unattended when promote.mjs is given --unattended (auto-promote.yml passes it) OR runs inside GitHub
// Actions (GITHUB_ACTIONS=true): a workflow that forgets the flag is still refused. A human promote from a terminal is
// never refused by this guard; it prints a notice instead so the switch is never promoted unnoticed.
//
// PURE + TESTABLE: no I/O. promote.mjs gathers the paths with git; ci/promote-test.mjs drives these functions and,
// end to end, runs promote.mjs against throwaway local repositories.

/** The kill-switch file's name. Any path whose last segment is this name (any case) counts: conservative on purpose. */
export const RAIL_GATE_FILE = 'rail.json';

/** The paths in `paths` that are (or could be served as) the kill switch. */
export function railGatePaths(paths) {
  return [...new Set((paths || []).map((p) => String(p || '').trim().replace(/\\/g, '/')).filter((p) => p && p.split('/').pop().toLowerCase() === RAIL_GATE_FILE))];
}

/** Is this promote unattended? `--unattended` on the command line, or running in GitHub Actions. */
export function isUnattended(argv, env) {
  return (argv || []).includes('--unattended') || String((env || {}).GITHUB_ACTIONS || '').toLowerCase() === 'true';
}

/** The refusal message for an unattended promote whose range touches rail.json, or null when it may go on.
 *  `paths` is every path any commit in the range touched (null when git could not list them: that refuses too). */
export function unattendedRailRefusal({ unattended, paths }) {
  if (!unattended) return null;
  if (!Array.isArray(paths)) return 'could not list the files this range touches, so it cannot prove rail.json is untouched';
  const hit = railGatePaths(paths);
  return hit.length ? `this range touches ${hit.join(', ')} (the rw-api routing switch)` : null;
}
