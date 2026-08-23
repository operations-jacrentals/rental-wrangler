# RENTALS dispatcher audit — remaining-work handoff (2026-07-19)

**Purpose:** the session that ran the RENTALS "Denny" dispatcher audit is being freed for other
use; all remaining work moves to a fresh **cloud** session. This is the durable, git-tracked
source of truth — pull `trunk`, read this, and continue. The shipped part is clean; the rest is
parked with enough detail to act.

Source: a persona-driven, source-grounded UX audit of the RENTALS card (walked as "Denny," a
lazy/not-sharp dispatcher) via the `/lazy-audit` skill, adversarially verified against
production-identical code. Findings split into **Bucket A** (bugs / missing feedback that
*should already work* — shipped) and **Bucket B** (anything that changes a system, process, or
UI — parked for Jac).

---

## 1 · Status — what is DONE vs OPEN

**DONE — the 4 Bucket-A dispatch fixes are integrated on `trunk`** (content-verified present at
`?v=20260719b`; reviewed by a fresh-context agent, no correctness issues; all gates green). In
`app.js`:
1. **`markFieldCall(rentalId, unitId)`** — was reading `r.unitId` (the rental's PRIMARY unit)
   when flagging a mid-rental breakdown, so on a multi-unit rental the repair WO + `Failed`
   condition hit the WRONG machine and left the broken one bookable. Now takes the failing unit
   explicitly (`targetId = unitId || r.unitId`); both call sites pass it (`setUnitCondition`
   on-rent FAIL path, `commitYardCapture` `fc` path). *(This is the only behavior change; the
   other three are confirmations/copy.)*
2. **`setUnitStatus`** — added a success `toast` (mirrors `setRentalStatus`); a per-unit
   delivery/recovery no longer commits silently.
3. **`winPickSave`** — added an `else`-branch `toast` so a window shrink/move confirms (only a
   billable extension confirmed before).
4. **Empty-slot link hints** — four strings made device-aware
   (`document.body.classList.contains('is-phone') ? long-press-copy : drag-copy`), because
   drag-to-link is retired on phones (long-press → R20 menu is the link path).

**NOT LIVE.** These are on `trunk` but **not promoted** — production still runs the old code.
See §2.

**Git history caveat (read before touching branches):** these fixes first landed as **PR #740**
(squash `705ea12`). Trunk was then **force-moved by concurrent sessions** onto a different, cleaner
lineage (currently `1c9612d`/#744); the reconciliation **carried the #740 *content* forward** but
the original commit *hash* (`705ea12`) is now orphaned. So: the fixes are on trunk **by content,
not by that hash**. Verify by content (the four markers above), never by looking for `705ea12`.
**Trunk is volatile right now** — multiple sessions are force-moving it — so don't pin work to a
specific trunk hash; rebase onto whatever `origin/trunk` currently is.

---

## 2 · ⛔ Promote is BLOCKED — do NOT force it (task-tracked; see §5)

`/promote` HARD-STOPPED and pushed nothing. `production` is **not a fast-forward ancestor of
`trunk`** — the two have a **history split** (root cause: PR **#739 "Normalize line endings to
LF"** rewrote history, detaching commit hashes; the app.js *content* delta is only the #740
fixes). `promote.mjs` is ff-only and correctly refuses; there is **no `--force` path** by design.

As of this handoff the split is **still unresolved** and trunk is being actively reworked by
other sessions. Rules for whoever picks this up:
- **Do NOT force-push `production` or `trunk`** to work around it — that's a non-ff move of the
  **live** branch / the **protected** trunk, and it's Jac's explicit, coordinated call.
- **Wait for the churn to settle**, then: confirm current `trunk` still contains the four fixes
  (§1), confirm `origin/production..origin/trunk` is a clean fast-forward, and only then
  `/promote`. If it still won't ff, reconcile deliberately WITH Jac (never silently).
- **Watch for concurrent sessions** — a `calendar-badge-and-map` deploy and the #744 Trips fix
  were both in flight during this handoff. Don't reconcile production under contention.
- The fixes are safe on trunk — nothing is lost by waiting for production to catch up.

---

## 3 · Parked Bucket-B work (the audit's UI/process findings)

Each changes how a system/process/UI works, so each needs Jac's input — route new/reshaped UI
through **`/jactec-ui`** (yard data-plate design language), larger designs through
**`/brainstorming`**. Ordered roughly by dispatcher value. Re-locate code with the `atlas` skill
(`docs/CODE-MAP.md`) before editing.

### High value — "what's urgent" (the audit's core miss)
1. **"Needs You Now" attention bucket + labeled flag badges.** Denny can't tell what's urgent at
   a glance. Add a red top-of-card triage bucket surfacing only truly-urgent rentals (overdue,
   open field-call, overbooked), and replace color-only pulses with **text-labeled** flag badges
   so the *reason* a row is flagged is legible. Changes card IA/layout.
2. **Verb CTAs + `Off-Rent`→`Overdue` relabel + next-gate highlight.** Status pills read as
   nouns; the next action isn't obvious. Make CTAs verbs, relabel the ambiguous "Off-Rent" state
   to "Overdue" where it means late, highlight the next lifecycle gate. Touches status vocabulary
   (`getStatus('rentalStatus', …)`, the gate-timeline builders).
3. **"Due Back Today" bucket / grouping.** No at-a-glance grouping for units due back today;
   Denny eyeballs dates. Add a Due-Back-Today sort group/bucket. Changes card grouping.

### Safety / correctness of the workflow
4. **Terminal-status confirm + undo toast + Returned-no-invoice gate.** Terminal changes
   (Returned/Closed) commit instantly with no confirm and no undo, and a unit can be marked
   Returned with **no invoice raised**. Add a confirm step, an undo toast, and a gate warning on
   return-without-invoice. WO-completion-adjacent — MUST stay Jac's call; never let a
   non-Complete-WO path complete a work order.

### Missing subsystems (the audit's "what's lacking")
5. **Proactive alerts.** No alert engine: overdue rentals don't drive a bell count, no push/OS
   badge, no daily digest. Denny only sees problems if he looks. New notifications subsystem.
6. **Comms wiring.** `refreshCommsThreads` exists but isn't polled; no one-tap text/call to
   driver or customer from a rental; the reminder engine exists **backend-only** with no frontend
   trigger. Wire polling + one-tap contact + a frontend reminder trigger. Touches comms/PII flow.
7. **Dispatch coordination.** Restore the delivery-lane rail + a "Round up" batching action, add
   a **driver double-booking** check (no driver assigned two overlapping runs). Prior research:
   `docs/handoffs/dispatch-ux-research-2026-07-06.md` (note its named "drag-only" anti-pattern).
8. **Returns damage handoff.** On return, field-captured damage notes/photos are discarded
   instead of routed to a WO/inspection. Preserve field capture and hand it into the
   returns/inspection flow. Touches returns process.

### Polish / smaller
9. **Empty-roster / empty-state guidance made reachable.** Empty-state guidance exists but isn't
   reachable in normal flow, so an empty yard gives Denny a dead card with no next step.
10. **UX-polish bundle** (needs a design pass to prioritize): identity scroll-position restore; a
    toast **queue** so rapid toasts don't clobber each other; a 44px min touch target on
    `.gt-row` for phone; a **visible** clear-filter anchor chip (currently hover-only); undated
    quotes should sort **last** not first; denser rental detail; dispatcher graph as a sensible
    default view.

---

## 4 · Context & artifacts

- **Audit artifact** (yard data-plate visual of findings, v2):
  `https://claude.ai/code/artifact/8716a062-d640-401d-ae5c-49e5fa600283`
- **Skills:** `/lazy-audit` (re-run the persona audit on any card), `/run-live` (drive the app —
  opens by telling Jac which *seat* to use, local vs cloud; the cloud Node-fetch relay shim
  reaches real backend data). Both are on `trunk`.
- **Interaction house rule:** every decision/question goes through the `AskUserQuestion` popup
  (one attempt; if it fails, fall back to the SAME question inline as lettered A/B/C + Other).
  Batch related questions; favor `multiSelect`. *(In the origin session the popup permission
  stream repeatedly closed — expect to use the inline fallback.)*
- **Design:** all new/reshaped UI runs through `/jactec-ui` (dark industrial steel, ONE
  safety-orange accent `#ff7a1a`, hazard-stripe signature, stamped Saira Condensed, rivets, light
  wrangler seasoning). Don't retro-restyle the existing site unless asked.
- **Ship flow:** feature branch off `trunk` → `/deploy` (staging) → `/merge` (Gate 1, → trunk) →
  `/promote` (Gate 2, → production = live, Jac's explicit call). `/live` runs all three — but
  **`/promote` is blocked until §2 clears.**

---

## 5 · How to pick this up (fresh cloud session)

1. `git pull` on `trunk` — you'll have this file, the four fixes (verify by content, §1), and the
   two skills.
2. Re-create the working task list from §2–§3 (the origin session tracked parked items as tasks
   #12–21 and the blocker as #22; those are session-scoped and don't transfer — this file is
   their durable form).
3. If Jac wants #740 live: **first** get past §2 — wait for the trunk churn to settle, verify a
   clean trunk→production fast-forward, and only reconcile deliberately with Jac. Never force-push
   live branches.
4. For any Bucket-B item: confirm scope/design with Jac (popup→inline), route UI through
   `/jactec-ui`, build on a feature branch, ship via the gates.

**Guardrails that still apply:** never commit secrets / `RW_PW` / `DEFAULT_CONFIG` passwords /
customer PII to the repo (public via Pages); backend `Code.gs` stays gitignored; never push
directly to `trunk`/`production`; changing a WO part/task line to Complete must NOT complete the
work order.
