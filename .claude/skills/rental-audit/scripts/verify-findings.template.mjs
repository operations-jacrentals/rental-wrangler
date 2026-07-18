/*
 * /rental-audit — Step 3 verification workflow (TEMPLATE).
 *
 * Adversarially verifies each audit finding against the byte-identical-to-production code,
 * and (optionally) runs completeness critics for the flows the lenses missed.
 *
 * HOW TO USE:
 *   1. Fill CLAIMS below with the actionable findings from the Step-2 lens agents.
 *      Each = { id, sev, claim, cites }.  Keep claim/cites terse; the verifier reads the code.
 *   2. Launch:  Workflow({ scriptPath: "<this file>" })   (runs in the background)
 *   3. Read the compact verdicts from the completion notification (or parse journal.jsonl).
 *
 * ⚠ GOTCHA — EMBED the claims here as a const. Do NOT pass them through Workflow `args`:
 *    on the first RENTALS run, args arrived empty and the verify pipeline spawned ZERO agents
 *    (verified: []) while the gap critics still ran. Check `agent_count` in the completion
 *    notification == CLAIMS.length; if it's smaller, the pipeline got an empty list.
 */

export const meta = {
  name: 'rental-audit-verify',
  description: 'Adversarially verify persona-audit findings against the code + hunt coverage gaps',
  phases: [
    { title: 'Verify', detail: 'refute-or-confirm each finding at its cited file:line' },
    { title: 'Gaps', detail: 'completeness + contradiction critics' },
  ],
}

// ── FILL THIS with the Step-2 findings (one example shown) ──────────────────────────────
const CLAIMS = [
  {
    id: 'example-finding-id',
    sev: 'CRITICAL',
    claim: 'One-sentence statement of the alleged problem, specific enough to refute.',
    cites: 'the file:line evidence the lens gave, e.g. app.js:1234-1240 (fn foo), config.js:56',
  },
  // …one entry per actionable finding (skip pure-opinion polish items).
];

// The completeness critics don't need the claims wired in beyond the contradiction check.
// Remap the anchors in GAP_LENSES[0] to the surface under audit.
const GAP_LENSES = [
  { key: 'missed-flow', prompt:
    'Six lens-reports already audited this surface for a lazy, not-sharp version of its role. Find what they ALL under-covered. Read the surface end to end (creating a record from scratch, the status funnel, cross-role handoffs, the empty/error/offline states, the first-shift path) and name the 3-5 most important WHOLE FLOWS or SCENARIOS the lenses missed. Cite file:line. Return structured gaps.' },
  { key: 'contradictions', prompt:
    'Here are the audit findings as JSON:\n' + JSON.stringify(CLAIMS) +
    '\nCross-examine them against the code and against each other. Flag any finding that is factually wrong, overstated, double-counted, or contradicted. Read the cited lines to adjudicate. Return each problem as a gap; empty array if all hold up.' },
];

const REPO = 'Repo: /home/user/rental-wrangler. app.js/config.js/style.css are BYTE-IDENTICAL to production. Always cite file:line from what you actually read.';

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['id', 'verdict', 'isRealBug', 'severityForDispatcher', 'evidence', 'smallestFix'],
  properties: {
    id: { type: 'string' },
    verdict: { type: 'string', enum: ['CONFIRMED', 'REFUTED', 'PARTIAL'] },
    isRealBug: { type: 'boolean' },
    severityForDispatcher: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    evidence: { type: 'string' },
    correction: { type: 'string' },
    smallestFix: { type: 'string' },
  },
};
const GAPS_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['gaps'],
  properties: { gaps: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['title', 'why', 'severity'],
    properties: {
      title: { type: 'string' }, why: { type: 'string' },
      cite: { type: 'string' }, severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    } } } },
};

function verifyPrompt(c) {
  return REPO + '\nYou are an ADVERSARIAL verifier. A prior audit made the claim below. Try to REFUTE it by reading the actual code at the cited locations AND enough surrounding context to judge. Only CONFIRM if the code genuinely supports it; default to skepticism.\n\n' +
    'CLAIM [' + c.id + '] (audit severity ' + c.sev + '): ' + c.claim + '\nCITED EVIDENCE: ' + c.cites + '\n\n' +
    'Decide: verdict CONFIRMED/REFUTED/PARTIAL; isRealBug (true=code defect, false=UX gap/opinion); severityForDispatcher (critical/high/medium/low); evidence (quote the key lines you saw, each with file:line); correction (if partial/refuted); smallestFix (or "n/a"). Return ONLY the structured object.';
}

phase('Verify');
const verifyP = pipeline(
  CLAIMS,
  (c) => agent(verifyPrompt(c), { schema: VERDICT_SCHEMA, model: 'sonnet', phase: 'Verify', label: 'verify:' + c.id }),
);
const gapsP = parallel(GAP_LENSES.map((l) => () =>
  agent(l.prompt, { schema: GAPS_SCHEMA, phase: 'Gaps', effort: 'high', label: 'gap:' + l.key })));

const [verified, gaps] = await Promise.all([verifyP, gapsP]);
return { verified: (verified || []).filter(Boolean), gaps: (gaps || []).filter(Boolean) };
