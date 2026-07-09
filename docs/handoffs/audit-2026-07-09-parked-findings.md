# Pre-promotion audit — parked findings (2026-07-09)

Source: 19-agent adversarial line-by-line audit of `staging` (branch `wrangler-fix/pr552-batch`,
content-identical to `origin/staging`), run before PR #552's staging→main promotion per Jac's
explicit "before, not after" instruction. 54 findings confirmed after verification (0 critical /
7 high / 20 medium / 27 low). 24 were mechanical/zero-risk and already fixed + pushed to this
branch. The 28 below need a judgment call, touch money/auth/WO-completion semantics, or need
more investigation than a pre-promotion pass should absorb — parked for Jac.

Legend: **file:line** — one-line verdict. Full evidence trail is in the audit transcript if needed.

---

## HIGH — money / auth / security (7)

1. **app.js:1662, 1673 (`setTransportType`, `armTransportNode`)** — Transport-type changes reprice
   an invoice's transport line (via `syncTransportLine`), and the dedicated editor (`openTransportEdit`)
   explicitly gates this behind `canMoney()` ("a site/leg edit reprices transport — money tier, whole
   edit"). But the segmented-control (`.js-ttype`) and route-rail (`.js-tnode`) controls call
   `setTransportType`/`armTransportNode` directly with **no** role check — a mechanic/driver-tier
   login (both legitimately view the rental detail for dispatch) can reprice transport. Needs a call:
   add `canMoney()` to these two paths, or decide the money-repricing action itself should be
   restricted differently (e.g. require confirmation, or split "which stops" from "what it costs").

2. **app.js:12817 (`wrValidatePlan`)** — The `update` branch enforces the Office/Admin money-tier gate
   for any `WR_MONEY_FIELDS` field; the `create` branch has no equivalent check. Mr. Wrangler (the AI)
   could create a category or expense with attacker-influenced rate/amount fields regardless of the
   requesting role. Needs the same gate added to `create`, but worth a careful pass over the whole
   Acts chapter (APP-28) in case other actions have the same update-gated/create-ungated asymmetry.

3. **app.js:18304 (WO header phase-pill dropdown)** — Can jump a work order straight to `Complete`
   with no confirmation, which directly violates the CLAUDE.md rule "changing a WO part/task line to
   Complete must NOT complete the work order — only the blue Complete WO button does." This is a
   documented invariant being broken in a live control; recommend prioritizing this one first among
   the parked items even though it needs UI/flow judgment (block the dropdown from offering
   `Complete`, or intercept and redirect to the real Complete-WO flow).

4. **app.js:17359 (`openPayInvoice`/`chargeInvoiceFlow`/`refundInvoiceFlow`/`recordManualPayment`)** —
   Missing the defense-in-depth `canMoney()` check that every sibling money action in the same click
   dispatcher has inline. Likely low exploitability if the entry points are themselves gated elsewhere,
   but worth confirming and closing the gap explicitly rather than relying on gating upstream.

5. **app.js:18918 (`billWOToInvoice`)** — The quick "Bill" button on a WO card can add a line to a
   pricing-locked invoice, bypassing the §7.5 lock gate enforced everywhere else. Money-integrity bug;
   needs the same lock check every other billing path uses.

6. **ci/check-design-md.mjs:71** — The `components:` block parser only recognizes a single-line
   component definition; a multi-line entry is silently dropped from validation with no error/warning.
   This is a CI-gate correctness bug (the gate whose job is to keep `DESIGN.md` honest can silently
   skip real content) rather than a live-app risk — still worth a fix, lower urgency than 1-5.

7. **`.github/workflows/wrangler-fix.yml:67`** — The autonomous Wrangler-fix agent's prompt embeds
   `github.event.issue.title`/`.body` verbatim (confirmed: only in the `prompt:` string, never in a
   `run:` shell step — no direct shell-injection path, see item 48 below). But the audit flagged a
   concrete secret-exfiltration consequence worth your read: with `--allowedTools Bash` and a PAT in
   `GH_TOKEN`, a maliciously crafted issue body could attempt to instruct the agent to read/leak the
   PAT or API key via a crafted PR/comment. The existing mitigations (CI-gated auto-merge, "never
   weaken money/card/auth" instruction, STOP-and-ask-Jac on ambiguity) are real but don't specifically
   address prompt-injection-driven secret exfiltration. Worth a design pass if/when this workflow is
   switched on for real (currently inert pending secrets).

---

## MEDIUM (13)

8. **app.js:6472 (`rentalLineRefund`)** + **app.js:5830 (rentals card "Invoice" column)** — Same root
   cause, bundle together: both only look at `r.invoiceId` (the rental's *first* §28-cap chunk
   invoice), so a refund or status change on a continuation invoice (chunk #2+) is invisible to the
   refund UI and the Invoice column/footer counts. The fix shape already exists in the codebase
   (`rentalInvoices(r)` walks the whole series, already used a few lines away in the same renderer) —
   this is a real gap in the r4 chunk-billing area, worth doing as one focused fix.

9. **app.js:8217 (`legacyKpiRaw`, mtech "WO Rate" ring)** — The raw/gamification value moves opposite
   to the percentage it's supposed to mirror (counts all-time inspections *without* a WO instead of
   30-day inspections *with* one), so the score-pop celebration fires on the wrong events. Cosmetic/
   gamification only, but a real inversion bug — needs the raw computation's windowing to match the
   percentage computation's windowing.

10. **app.js:9688 (§13.4 Timeline Selector)** — Confirmed permanently unreachable: `v.timed` is never
    set `true` anywhere, so this whole window-picker feature (button, menu, handlers, ~160 lines) can
    never render. Product decision, not a bug fix: either finish wiring it or delete it as dead UI.

11. **app.js:14230 (`DROP_MATRIX` units↔rentals validators)** — Uses the legacy single-unit `r.unitId`
    instead of checking all of `r.units[]`, so a non-primary unit already linked to a multi-unit rental
    still visually lights up as a valid drag-drop target (the real link function still blocks the actual
    drop with a toast, so no data corruption — just a misleading visual).

12. **app.js:18321 (`setWoLinePhase`)** — Derives the WO's displayed phase from whichever open line
    happens to be *last* in array order, not the worst-severity bottleneck (`woBottleneck()` elsewhere
    does this correctly via `WO_SEV` sort). Can show a misleadingly mild status on the WO header. Same
    subsystem as item 3 (WO phase) — consider fixing together.

13. **config.js:295 (`LEGACY_MAP`)** — Confirmed zero consumers anywhere in the frontend. Per the
    project's own dead-code-report caveat, string-dispatch/import-script usage can hide a real
    reference — cross-check against `tools/import-real-data.ps1` before deleting; this is exactly the
    class of "looks dead statically, might be load-bearing for CSV import" case that needs a human
    check rather than an automated one.

14. **ci/check-design-md.mjs:130** — The drift guard downgrades to an advisory `WARN` (not a build-
    failing `ERR`) when a mapped `style.css :root` variable can't be found at all — arguably the most
    common real-world drift case (a renamed/removed token) escapes the gate whose entire job is to
    catch exactly that. All 24 currently-mapped vars happen to still resolve, so this hasn't bitten yet.

15. **ci/logic-test.mjs:1132 and :654** — Two dead assertions (never execute due to fixture state):
    the "PO on file unblocks On Rent" rental-rule check, and the sale-price engine's "cost basis"
    regression check. Both were empirically confirmed dead (instrumented + run through the real
    Playwright harness). This means two money/pricing code paths have zero regression coverage despite
    a passing-green test file — worth fixing the fixtures so these actually exercise the intended path.

16. **tools/gen-code-map.mjs:88 and tools/dead-code-scan.mjs:59** — Both banner-parsers pair up
    chapter-boundary rule-lines by flat array position with no proximity/validity check, contradicting
    `gen-code-map.mjs`'s own docstring ("a banner is a cluster of rule lines within 3 lines of each
    other"). A stray 6+-`═` line anywhere in the codebase would silently desync chapter titles/ranges
    in the generated docs, with `--check` unable to catch it (it only checks the desynced *output* is
    self-consistent, not that the desync happened). Tooling-only, no live-app impact, but worth
    hardening since these generators are trusted for navigation.

17. **`.github/workflows/branch-janitor.yml:66`** — *(fixed — see commit)* listed here only because
    the sibling item below is related and parked.

18. **docs/handoffs/perf-report-backend.gs:31** — Writes client-controlled strings (build/device/role)
    straight into Sheet cells with no formula-injection sanitization (no leading-apostrophe guard
    against a value starting with `=`/`+`/`-`/`@`). This is a *reference snippet*, not live code — only
    matters if/when re-pasted to the real backend — but worth fixing the tracked snippet so the next
    paste-deploy doesn't carry the gap forward.

19. **docs/handoffs/membership-billing-additions.gs:14** — Still shows the dispatch snippet gating on
    the superseded name-keyed `MONEY_ROLES` map rather than the tier-based `roleMoneyOk_` that
    `role-tiers-backend.gs` says replaced it. Same class as item 26 below (cash-payment snippet). Both
    are reference-doc staleness, not live-backend bugs (assuming the live migration already happened),
    but risk being pasted back verbatim by a future session that pattern-matches on the wrong file.

---

## LOW (8)

20. **config.js:26 (`colorVar`/`colorBgVar`)** — Documented as the mandatory color-resolution API in
    the file's own header comment, but zero call sites; app.js reimplements the same template-literal
    pattern inline dozens of times instead. Not necessarily "delete" — could also mean "go retrofit the
    inline call sites to use the documented helper," which is a bigger, deliberate cleanup, not a
    park-and-forget deletion.

21. **style.css:1944 (`!important` on `.set-planned-sub`)** — Papers over a specificity conflict that
    scoping the selector (`.set-planned p.set-planned-sub`) would resolve cleanly. Low risk but touches
    live rendering, so flagged rather than auto-fixed.

22. **style.css:2753 (`--good` token)** — Referenced with a hardcoded fallback in 5 places but never
    defined in `:root`/`[data-theme="light"]`, so it always renders the literal fallback and never
    themes per-mode like its sibling status colors do. Fixing means choosing dark/light values — a
    design-token decision, not a mechanical one.

23. **`.github/workflows/branch-janitor.yml:58`** — `gh pr list --limit 1000` on both merged/open
    queries isn't paginated (unlike the `gh api .../branches --paginate` call in the same file); at
    >1000 PRs a stale/reused branch name could theoretically slip past the "never delete a branch with
    an open PR" guard. Not urgent at current repo scale, but a real latent gap in an unattended daily
    job — worth switching to `--paginate` when convenient.

24. **docs/handoffs/cash-payment-backend.gs:17** — Same staleness class as item 19: dispatch snippet
    still shows the pre-tier-redesign `MONEY_ROLES[role]` gate rather than `roleMoneyOk_(role)`.

25. **Backend contract coverage gaps (informational, no file to edit)** — Two backend action families
    the frontend calls have **no** tracked reference snippet at all in `docs/handoffs/`: all 10 Stripe
    actions (`stripePubKey` through `stripeFinalizeInvoice` — the single largest unverifiable,
    money-critical backend surface in this whole review) and the `gpsToken` GAS-side proxy action. This
    isn't a bug — the live `Code.gs` may implement these correctly — but there's no way to verify from
    this repo, and no snippet to hand a future session. Worth writing reference snippets for both next
    time you're in the Apps Script editor.

---

## Dropped (not real findings — kept for completeness)

- `.github/workflows/branch-janitor.yml:55` and `wrangler-fix.yml:79` — the audit's F17 pass explicitly
  went looking for GitHub Actions script-injection (untrusted `${{ github.event.* }}` interpolated into
  a `run:` shell step) and came back clean on both files: neither ever puts issue/PR title, body, or
  labels into a `run:` step — `wrangler-fix.yml` only interpolates them into the Claude action's
  `prompt:` string (a different, already-acknowledged risk — see HIGH item 7). Recorded here so the
  question doesn't get re-asked, not because either needs action.
