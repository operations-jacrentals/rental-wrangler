# Dispatch-board UX research — market patterns for the driver-lane rail (2026-07-06)

Commissioned for the `rentals-dispatch/driver-laned-rail` build (spec D4/D5/D6). Sources:
Onfleet, OptimoRoute, Routific, Circuit/Spoke, Bringg, ServiceTitan, Tookan, Samsara,
Motive, Verizon Connect, DispatchTrack, Housecall Pro (docs + 2024–2026 reviews).

## Folded into v1 (shipped with the lane rail)

- **Lane-header drop = append; between-token drop = exact position** (Onfleet/OptimoRoute).
- **Hot drop-target highlight** while dragging — the armed lane gets the orange outline; drag
  back to the Unassigned pool = unassign (Onfleet's "return to Unassigned").
- **Done/total progress fraction in the lane header** ("2/5", green when complete) — Onfleet's
  per-driver status pattern, minus the live-GPS parts we don't have yet.
- **Route isolation: tap a lane header → the map traces only that run** (Bringg/Routific
  route-isolation). With 2–7 overlapping small-town routes this beats route colors.
- **A non-drag assignment path stays first-class** — the per-stop `+Driver` dropdown — because
  >90% of Onfleet reviewers call drag-only assignment tedious (SelectHub).
- **Done stops stay visible** (dimmed), never removed from the lane — keeping the day's
  narrative honest (anti-pattern lesson from Onfleet's disappearing succeeded tasks).
- **Auto-split (Round up) is a visible, reviewable action** — never Tookan-style silent
  force-assign. v1 commits immediately but every assignment is drag-reversible and audited
  via the activity log.

## Deferred follow-ups (need data or design we don't have yet)

1. **Live impact preview while dragging** ("+38 min" ghost insert — OptimoRoute/Routific):
   needs per-lane drive-time recalc; pairs naturally with the D3 backend schedule slice.
2. **Staged auto-split with Accept/Revert + per-lane locks** (Routific lock-routes): worth it
   when Round up starts using region/load smarts instead of round-robin.
3. **Lane load meter / overtime warning** (Routific overtime, Onfleet task caps): needs
   driver shift data — lands with `hr-compliance` records.
4. **CDL/equipment eligibility glyphs on drag** (Bringg match-skills): needs the
   hr-compliance certification model; warn, don't block.
5. **Pool "reason" chips after auto-split** (OptimoRoute's Not-Scheduled reasons): becomes
   meaningful once the split respects constraints that can fail.
6. **Hover sync token↔pin** (pulse the pin on token hover): nice-to-have; tap-to-focus
   already links lane↔map both directions.

## Anti-patterns held as guardrails

- Drag-and-drop as the only assignment path.
- Silent force auto-assign.
- Enterprise-board bloat: at 1–7 drivers every header stat must fight for its pixels —
  name, progress, (later: finish ETA + delay minutes); nothing else by default.

Full pattern citations live in the session transcript; the products named above are the
reference points if a pattern needs re-examination.
