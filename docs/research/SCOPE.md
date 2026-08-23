# The Completed Scope

**What a redesigned UI system has to solve — the gathering, finished. 2026-07-19.**

This is the capstone of the research phase. It presents the full problem space and stops there:
**nothing in this repository proposes a UI direction, a component system, a layout, or a spec.**
Per the owner's instruction, design starts only when the owner says so.

---

## The corpus

| Body of evidence | Findings | Verification |
|---|---|---|
| Five persona-driven desktop audits (`01-inventory/`) | 171 (64R / 70O / 37Y, 80 systemic) | adversarial passes in the original audits; 36 claims retracted |
| Job taxonomy + re-index (`01-inventory/JOB-TAXONOMY.md`, `FINDINGS-BY-JOB.md`) | — (organizes the 171) | checksums tie out to inventory totals |
| Phone / touch-tablet walk (`07-phone-walk/`) | 17 (P1–P17) | 7 load-bearing claims → 5 CONFIRMED, 2 SCOPED |
| Unaudited surfaces (`08-unaudited-surfaces/`) | 62 (S1–S62; 11R / 22O / 25Y + 4 confirmatory) | 12 headline claims → 9 CONFIRMED, 2 REFUTED + corrected, 1 SCOPED |
| Cross-card traces (`09-cross-card-traces/`) | 19 numbered + 15 orphaned arrows | 10 load-bearing claims → 10 CONFIRMED |
| Detail-view audits (`contrib/*-detail/`, `01-inventory/DETAIL-FINDINGS-BY-JOB.md`) | 130 (40R / 66O / 24Y) | per-card adversarial verify + a v2 persona-seat pass; 3 corpus retractions/re-files |

**≈399 cited findings total.** Every load-bearing claim was handed to an independent refutation
agent; every refutation and scoping is folded into its document in place, marked with its verdict.
The original inventory's 36 retractions remain in force, plus the detail wave's corrections
(`01-inventory/CORPUS-CORRECTIONS.md`) — nothing refuted was resurrected.

**The detail-view wave** deep-audited the standard (detail) view of each of the four cards — the
dense surfaces the list audits only grazed (Unit detail absorbed the retired Shop card; Customer
detail absorbed the retired Invoices card). Its v2 passes closed the corpus's biggest fidelity
gap by walking each card **from the persona's real low-tier seat** (`#local` + `setRole` on pinned
production bytes) rather than as admin — converting dozens of role/money-gate claims from CODE-READ
to VERIFIED-LIVE. One residual gap is accepted, not closed: click-time admin gates fail open under
`#local`, so verifying them at a real low tier would need a staff-tier *production* login — judged
not worth a round three (render-time gating, the part the UI-system question needs, is verified).

## The backbone: 25 jobs

The primary axis is **the work** — `01-inventory/JOB-TAXONOMY.md` defines 15 business jobs and
10 table-stakes jobs, phrased as the person doing them would say them, with all 171 original
findings re-indexed one-job-each and damage-ranked. Every later body arrived pre-tagged against
the same vocabulary. **All 130 detail-view findings mapped cleanly to the 25 jobs with zero
off-vocabulary — in a wave that never touched the taxonomy authors.** Across ~399 findings and four
independent audit waves, nothing required a 26th job. That is the strongest available evidence the
backbone is right.

**The detail view re-orders the damage.** The list wave was led by `spot-the-fire`; the detail wave
is led by **`trust-the-screen` (54)**, then `whats-next-to-wrench` (36) — the detail is the dense,
authoritative surface where two systems' answers to one number render inches apart, and it is where
the ex-Shop service/repair mass lives. The two axes are complementary, not contradictory: the list
is where you fail to *notice*, the detail is where you fail to *trust*.

**From the original 171:** the table-stakes layer carries 51% of all damage; the top jobs are
`spot-the-fire` (29), `get-told` (24), `keep-my-place` (24), `get-to-it` (24); the worst business
job is `get-it-back` (17); the rental's back half (return · triage · repair · field) outweighs
its front half (quote · stock · attach · dispatch), 72 to 56.

**What the new evidence moved** (qualitatively — the new bodies use the same tags but their own
numbering):

- **`get-told` is now provably the deepest hole, not just the widest.** The desktop audits saw
  the absence; the traces and surfaces proved the *whole stack* is inert by construction: the
  staff-notification system (driver-assigned, WO-assigned, schedule-change) and the customer
  reminder engines are fully built Settings panes wired to nothing (T14, T10, S-findings; ≥13
  individually-inert Settings controls confirmed), and `assignStopDriver` notifies no one. Every
  dispatcher→driver and dispatcher→mechanic handoff is 100% manual behind a UI that promises
  otherwise.
- **`hook-it-to-the-rental` got its worst finding on touch.** On a phone, drag-to-link is retired
  (P4), the replacement long-press menu self-destructs ~200ms after opening — closed by the
  browser's own touch-compat mouse event that nothing guards (P5, CONFIRMED with a dedicated
  refutation hunt) — and the hint toast still says "Drag" (P6). Phone users currently have no
  reliably working, instructed way to link records. On the touch tablet, the drag works but the
  unit pill's chat-tag stamp hijacks it (P17-corrected).
- **`get-it-back` gained a critical:** no code path connects a delinquent/blacklisted account to
  physically recovering the machine — "recall" is collections paperwork only (T9). Combined with
  the original findings (overdue invisible to every count; the return captures no hours, no
  condition, no damage; the $1,000 protection cap enforced nowhere — T4/T5), the end of the
  rental is the single most damaged stretch of the business.
- **`keep-the-keys` / `no-fat-fingers` sharpened into one statement: guards are improvised
  per-gate.** The everyday Quote→Reserved path writes status directly and bypasses the entire
  gate battery (T13); five gates in one function carry three different override styles (S5
  corrected); no gate anywhere reads machine fitness (T1: a Failed/Field-Call unit can be
  attached, reserved and delivered with zero block); Rental Rules is structurally incapable of
  expressing a machine rule (S6/S11); an Admin can silence any safety flag with an audit trail
  no surface displays (S-findings).
- **`works-in-gloves` expanded from a density complaint to a device-class fact.** The tooltip
  layer, hover previews, and hover-revealed controls are categorically absent on every
  touch-primary device — including the 641–1024px yard-tablet band, which gets the desktop build
  with `.r-actions` hidden and `.c-actions`/close-X invisible-but-clickable (P14–P16). The band
  the yard actually holds is owned by no code branch.
- **`get-our-money` gained the ACH class:** a returned ACH debit leaves no trail, sets no
  account block (unlike a card decline), and an in-flight ACH renders identically to
  stone-cold-overdue everywhere except one popup (T8, S13/S14 scoped).
- **`clean-records` gained proof the sync hazard is avoidable:** rentals/WOs/units/customers get
  whole-record last-write-wins while Trips and Invoices in the same file get real conflict-safe
  handling (T22).

## The six root problems, after the gathering

The inventory's six roots all stand. Three got materially heavier:

- **R1 — the app has no addressee** → now proven end-to-end: not one notification engine behind
  the Settings toggles exists; nothing addresses anyone, anywhere, on any card.
- **R4 — guards per-widget, not per-consequence** → now includes: the everyday booking path
  bypassing the battery entirely; gates that never consult the machine; per-gate override
  improvisation; `flashOr` swallowing all six failure reasons depending on what an unrelated
  column happens to display (28 call sites).
- **R5 — capability without a door** → now includes the sharpest example in the corpus: the
  built, manager-gated, auto-blacklisting collections flow is reachable *only* through a click
  inside a hover preview (S15 corrected) — a door that is undiscoverable, is itself the known
  misclick-trap surface, and does not exist on touch.

Two cross-cutting facts the desktop-only gathering structurally could not see, now on record:

1. **Touch is a second-class citizen categorically, not incrementally.** Every hover-dependent
   finding class re-graded *worse* on touch except attach-by-drag (P-walk re-grade table), and
   the linking grammar — the app's core connective gesture — is broken outright on phones.
2. **The app is weakest at the ends of its own workflows.** Intake has no surface (both traces
   start at "no intake form exists"); closure has no capture (return), no enforcement (damage
   cap, billing on terminal jumps), and no recovery path (delinquency). The middles are dense;
   the ends leak.

Two more the detail wave added:

3. **`keep-the-keys` is now the corpus's strongest security thread, and it is a fail-*open*, not a
   fail-closed.** The `canMoney()` gate is *computed correctly* and then *never consulted*: the
   Unit-detail Investment block shows a mechanic the same `Profit / true cost / paid` an owner
   sees; only 2 of 6 category money figures are gated at all; card-remove (a live Stripe detach) is
   ungated while card-*add* is gated. And the gate itself fails open on a blank role — reachable by
   a real signed-in user when a role-aware backend's `auth` RPC throws anything but `unauthorized`,
   silently degrading a fully-authenticated session to money-tier-everything with nothing on screen
   to say so (verified live on three surfaces; held at orange because two of its three blank-role
   paths are documented intent; a second, code-read fail-open at `app.js:8637/8920` is a money-
   *write* path). The redesign's authority model has to gate *data*, not *widgets* — the audits
   proved the tier table is sound and the consultation is missing.
4. **The instrument is not the app — a corpus-quality lesson the sessions taught themselves.**
   Three sessions independently retracted a finding after mistaking a measurement artifact for
   behavior: two "% below the fold" densities were a short-viewport tool artifact (re-measured
   away), and a "card-detach is clickable" claim died when the button proved 0px wide. DOM-present
   ≠ user-visible; rulebook-registered ≠ rendered. `01-inventory/CORPUS-CORRECTIONS.md` carries the
   full log and the standing warning to re-measure any Chrome-extension density number.

## What was closed

- The **job axis** exists: 25 jobs, every original finding indexed, new findings pre-tagged.
- The **phone build has now been walked** — the project's largest evidence gap — plus the
  unowned tablet band, with screenshots and live-traced mechanisms.
- The **surfaces no audit touched** are audited: Settings' 11 panes, Rental Rules, the money/ACH
  layer, the six back-office boards, agreements/signing, print targets, the Wrangler write path,
  public pages, login/identity/day-one, offline.
- **Work now crosses card boundaries on paper**: five end-to-end traces, every arrow graded on
  who carries the baton, 15 orphaned arrows ranked by business consequence.
- **The detail views are audited** — the dense standard views of all four cards, from the
  persona's real low-tier seat, with the corpus's known-wrong claims (finding #130; the two
  density artifacts) retired and #27/#32/#18 re-filed to their true surface.

## What remains unknown — read before treating this scope as complete

1. **No real user has ever been observed.** The personas are constructed. The single best piece
   of field evidence remains the name-field ledger (staff typing balances and do-not-rent flags
   into customer names) — found by accident. More workarounds like it certainly exist, unfound.
2. **No physical device has been touched.** The phone walk is headless Chromium with real CDP
   touch events. P5's mechanism is standard-spec browser behavior and survived a dedicated
   refutation hunt, but it has not been reproduced on actual hardware — that is the
   highest-priority real-world check in the corpus. Gloves, sunlight, OS gestures: untested.
3. **Production Settings state is unknown.** Every finding was measured against shipped
   defaults; ten live panes can rewrite statuses, flags, fields, checklists and gates at
   runtime. What Jac's yard has actually configured — and what breaks when the panes are used as
   intended — is unexamined.
4. **The backend is out of scope entirely.** Whether a Stripe webhook resolves ACH, what the
   sync endpoint does under conflict, the reminder sweep's server half — all gitignored, all
   unverified from this repo.
5. **Concurrency was traced, never watched.** Last-write-wins is proven in code (T22); no one
   has had two sessions edit one record and observed the screens.
6. **The RENTALS list audit remains reconstructed**, not re-run at full fidelity. The detail-view
   wave *did* run RENTALS live and found `DETAIL.rentals` role-invariant, but the list-level
   reconstruction stands. If the original list artifact surfaces, fold it in.
7. **The Wrangler dock's write path was read, not driven** — `startRental`'s zero-confirm
   auto-apply is confirmed in code (S-findings) but has never been exercised against a live
   backend.
8. **Coverage of the phone walk was representative, not exhaustive** — comms decks, the
   invoices funnel deck, and WO photo capture were not walked; the SMS login flow cannot be
   driven headlessly at all. The **phone detail views were not walked either** — the detail wave
   was desktop, so its findings inherit the corpus's touch caveats.
9. **Click-time admin gates at a real low tier — accepted CODE-READ, not closed.** The detail
   wave's `#local` seat faithfully shows what a role *sees* (render-time gating) but structurally
   fails click-time gates open (`requireAdmin` short-circuits with no backend password). Verifying
   them at a real low tier needs a staff-tier *production* login; the owner judged this not worth a
   round three. Also still code-read: the category `salePriceSuggest` money-write fail-open (N-03,
   the seed generates no drift) and the RENTALS multi-unit `isPrimaryUnit` fallback (RD-08, the one
   multi-unit fixture had addresses on both units).
10. **The `#local` demo seed is NOT PII-free** — it carries authentic customer names/phones/
   addresses (confirmed by four sessions; the same name appears in seed and production). Some
   already-committed round-one screenshots may contain real PII. The owner has reviewed this and
   chosen to leave it as-is on the private repo; a future reader taking this corpus wider must
   re-decide.
11. **The 36 original retractions plus every later correction** — S15, S5/S12, S13, P10, P17, the
   account-block correction, **and the detail wave's `01-inventory/CORPUS-CORRECTIONS.md`** (finding
   #130 FALSE; #27/#32/#18 re-filed; F-14 + the density-artifact class) — are part of the scope. A
   future reader who quotes a refuted absolute is re-introducing a known error.

---

*The gathering is finished. The next step — deciding what the UI system should be — is
deliberately not taken here.*
