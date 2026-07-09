# Pre-promotion audit — findings tracker (2026-07-09)

Source: 19-agent adversarial line-by-line audit of `staging` before PR #552's promotion to
`main`. 54 findings confirmed after verification (0 critical / 7 high / 20 medium / 27 low).

**Status as of end-of-day 2026-07-09: 51 of 54 resolved.** 23 mechanical/zero-risk fixes shipped
in PR #554. The 7 HIGH items shipped in PR #556 (Jac worked through each via popup rather than
leave them parked). The remaining 21 MEDIUM/LOW items were then *also* worked through
("let's fix all of them, go!") — all but 3 are now resolved too. Items 16, 20, and 21 below
remain genuinely open (16 was attempted and reverted — see its entry for why).

Legend: **file:line** — one-line verdict.

---

## ✅ RESOLVED — HIGH (7, shipped PR #556)

1. **Transport-type money gate** (app.js `setTransportType`/`armTransportNode`) — now requires
   `canMoney()`, matching the address editor's existing gate.
2. **Wrangler create-gate** (`wrValidatePlan`) — `create` ops now strip money fields below money
   tier, same as `update` already did.
3. **WO Complete/Cancel redesign** — the header status pill is now a read-only derived display
   (`woBottleneck`), not a dropdown; a Cancel gate was added to line items (blocked if the line
   still carries cost).
4. **Payment-flow defense-in-depth** — `openPayInvoice`/`chargeInvoiceFlow`/`refundInvoiceFlow`/
   `recordManualPayment`(`postManualPayment`) all now re-check `canMoney()` internally.
5. **`billWOToInvoice` rewrite** — bills to the invoice carrying the rental that needed the WO
   specifically, falls through to a fresh invoice if that one's locked/paid.
6. **`check-design-md.mjs` fail-loud fix** — a wrapped component spec now hard-errors instead of
   silently escaping validation.
7. **`wrangler-fix.yml` prompt-hardening** — untrusted-data framing + standing no-secrets
   instruction added. Exploitability checked: repo is public, but the trigger label can only be
   attached by an existing collaborator; the in-app reporter requires a human "Submit new issue"
   click, never auto-files.

---

## ✅ RESOLVED — MEDIUM/LOW (shipped same day, 2026-07-09, no PR # yet at time of writing)

8. **`rentalLineRefund` + rentals "Invoice" column** (app.js) — both now walk the whole §28cap
   chunk series (`rentalInvoices`/`rentalActiveInvoice`) instead of only the first chunk.
9. **mtech "WO Rate" gamification ring** (`legacyKpiRaw`) — raw value now uses the same 30-day
   window + same-direction count as the percentage it's supposed to mirror.
11. **`DROP_MATRIX` units↔rentals validators** — now use `rentalHasUnit()` (checks the whole
    `r.units[]`) instead of the legacy single-unit `r.unitId`.
12. **`setWoLinePhase`'s phase derivation** — resolved as a side effect of item 3: the function no
    longer writes `w.phase` at all (that's now purely a derived display), so the wrong-derivation
    bug has no code path left to occur on.
13. **`LEGACY_MAP`** (config.js) — deleted. Verified zero references anywhere in the frontend
    *and* in `tools/import-real-data.ps1` (the one plausible "import layer" in the repo) before
    removing.
14. **`check-design-md.mjs` drift guard** — a missing mapped `:root` var now hard-errors instead
    of just warning.
15. **2 dead test assertions** (`ci/logic-test.mjs`) — both fixture bugs fixed (synthetic PO'd
    invoice; synthetic unit with `trueCost` set) so both now actually execute every run.
16. **`gen-code-map.mjs` + `dead-code-scan.mjs` banner-pairing** — ⚠ **attempted, reverted.** Tried
    a max-gap validity check between a banner's open/close rule lines, but real banners in this
    file routinely carry 10-30+ lines of descriptive prose (the deleted ranch-theme banner alone
    spanned 13), so any gap threshold tight enough to catch a genuinely stray line also rejects
    the vast majority of real banners — confirmed by running it against the actual file (`--check`
    started failing with 20+ banner-id mismatches). Reverted to the original pairing logic rather
    than ship something broken. The underlying finding is still real (no proximity/validity check
    at all) but a line-count heuristic isn't the right fix for this codebase's banner-size
    distribution — would need a smarter check (e.g. comparing against the previous known-good
    banner count) or just isn't worth hardening against a failure mode with zero real occurrences.
17. **`branch-janitor.yml`'s `backup/*` guard** — fixed earlier, in PR #554.
18. **`perf-report-backend.gs` formula-injection guard** — fixed in the tracked snippet (leading-
    apostrophe guard on `t1()`) and **queued** in `BACKEND-DEPLOY-QUEUE.md` (#3) — **not yet
    deployed live**, needs the usual `/clasp` STOP-gate before it ships.
19. **`membership-billing-additions.gs` stale gate** — corrected `MONEY_ROLES[role]` →
    `roleMoneyOk_(role)` in the snippet. **⚠ New finding while fixing this**: a live Code.gs read
    (via the Drive connector) found **none** of `membershipEnroll_`/`membershipCancel_`/
    `membershipReactivate_`/`membershipBillingCron` actually exist in the bound script, despite
    this file's header claiming "DEPLOYED LIVE 2026-06-25 (version 46)." Flagged at the top of
    that file — needs Jac to confirm whether this is a versioning mismatch (deployed web-app
    version vs. bound-script content) or the app-driven membership system genuinely isn't live.
22. **`--good` CSS token / light theme** — resolved differently than originally scoped: Jac opted
    to delete the light theme entirely (confirmed dormant/unreachable) rather than define
    `--good` for it. Also deleted the `ranch` theme (same dormant class, ~25 rule-blocks) per
    Jac's "the others can be removed." **⚠ New finding**: the whole theme-TOGGLE mechanism turned
    out to be unreachable too — no `.js-theme` button ever renders in the UI (only its click-
    handler exists), so even the documented Yard⇄Blued-Steel cycle can never fire; the app is
    permanently on `bluedsteel`. Not touched — Jac may want to revisit whether to finish wiring a
    real toggle button or clean up `THEME_NEXT`/`yard` CSS too.
23. **`branch-janitor.yml` pagination** — both `gh pr list` calls (the daily prune job AND the
    one-time stranded-branch cleanup job) now use `--paginate` instead of `--limit 1000`.
24. **`cash-payment-backend.gs` stale gate** — corrected to `roleMoneyOk_(role)`; confirmed this
    one **is** live and matches (unlike item 19's discrepancy).
25. **Missing Stripe/gpsToken backend snippets** — written from a live Code.gs read via the Drive
    connector: `docs/handoffs/stripe-actions-backend.gs` (dispatch table + 2 representative
    handlers) and `docs/handoffs/gps-token-proxy-backend.gs`. **⚠ New finding while writing the
    gpsToken snippet**: the live `gpsToken_` has a hardcoded plaintext password fallback baked
    into the source (justified in-line as "server-side + gitignored, never served publicly," which
    is true for the public-repo vector but means the credential can't be fully rotated without an
    editor edit). Flagged in the new snippet file, not fixed (would need a live backend deploy).

---

## ⏳ STILL OPEN (2)

20. **`colorVar()`/`colorBgVar()`** (config.js) — documented as the mandatory color-resolution
    API but zero call sites. **Parked at Jac's explicit direction** ("park this as a design thing
    to look at later") — not touched.

21. **`style.css:1944` `!important` on `.set-planned-sub`** — papers over a specificity conflict
    that scoping the selector would resolve cleanly. Not part of today's fix pass; low risk but
    touches live rendering, so still flagged rather than auto-fixed.

---

## Dropped (not real findings — kept for completeness)

- `.github/workflows/branch-janitor.yml:55` and `wrangler-fix.yml:79` — the audit's F17 pass
  explicitly went looking for GitHub Actions script-injection and came back clean on both files.
  Recorded here so the question doesn't get re-asked.
