# Customer Funnel Redesign — Design Spec

- **Date:** 2026-07-17
- **Status:** Draft for Jac's review
- **Author:** Claude (brainstormed with Jac)

## Goal

Replace the current two-tab customer funnel — **Rental** (`membershipStage`) /
**Equipment Sales** (`usedSalesStage`), driven by `funnelPill` / `openFunnelDropdown` /
`setFunnelStage` and `MEMBERSHIP_FUNNEL_ORDER` — with a **three-funnel** model that:

1. lets customers/leads be **added and organized quickly** (ties into the inline quick-add
   "Lead?" pill), and
2. reflects how the pipelines actually **diverge** (rental vs. membership vs. equipment sales),
   hiding stages that would be a distraction for a given lead.

## The three funnels

A customer can belong to **more than one funnel at once**; each funnel keeps **its own stage**.

### 1 · Rental — *activity-driven*
`Lead → Reserved﹡ → Rented﹡`

- **Reserved** (has a future reservation) and **Rented** (On Rent) are **auto** — derived from
  the customer's live rental records, never a manual pick.
- **Auto-join rule (Jac's rule of thumb):** any customer who has *ever* reserved or rented is in
  the Rental funnel. A customer with no rental history is **not** — until their first
  reservation/rental, which **auto-triggers** the Rental funnel.
- A customer may also be *manually* marked a Rental **prospect** (via quick-add) at `Lead` before
  they've rented anything.

### 2 · Member — *a continuation of Rental*
`Lead → Contacted → Not A No! → Payment Discussed → Signed﹡`

- The membership-signup pipeline. Manual stages; **Signed** auto-locks when the membership
  agreement is signed.
- Presented as a **continuation of the Rental funnel**: a customer who is both a renter and a
  member sees one combined **Track A** (Rental stages + Member stages).
- **Visibility rules** (the heart of the design):
  - **Member sales stages** (Contacted → Signed) show **only when Member is selected**.
  - **Rental stages** (Reserved/Rented) show **only when the customer has rental activity**
    (per the Rental auto-join).
  - Therefore:
    - **Rental-only** (renter, not a member): sees `Lead → Reserved → Rented`.
    - **Member-only** (member lead, never rented): sees `Lead → Contacted → … → Signed` —
      Reserved/Rented **hidden** (no distraction).
    - **Both**: the full combined ladder.
    - A **member-only lead who then rents** → Rental auto-triggers → Reserved/Rented appear.

### 3 · Equipment — *separate track*
`Lead → Contacted → Not A No! → Payment Discussed → Paid﹡`

- The equipment-**sales** pipeline. Manual stages; **Paid** auto-locks when the sale invoice is
  paid. **No** Reserved/Rented (you buy, not rent).
- Runs **fully alongside** Track A — a customer can be `Rented` on Rental/Member **and**
  `Contacted` on Equipment at the same time.

## Auto stages (﹡ — never a manual pick)

| Stage | Auto-trigger |
|-------|--------------|
| Reserved | customer has a future reservation |
| Rented | customer is On Rent |
| Signed | membership agreement signed |
| Paid | equipment-sale invoice paid |

Manual picks: `Lead`, `Contacted`, `Not A No!`, `Payment Discussed`.

**Divergent terminals:** Member ends at **Signed**; Equipment ends at **Paid** (matches today's
`MEMBERSHIP_FUNNEL_ORDER` excluding `Paid`, and `usedSalesStage` keeping `Paid`).

## The funnel menu

One dropdown, shared by the quick-add "Lead?" pill and the customer-detail funnel control:

```
N/A
── Leads ──              (section header)
   Rental   Member   Equipment          ← the funnel choice
── Stages ──
   Reserved﹡            (Rental / Member — shown when rental-active)
   Rented﹡              (Rental / Member — shown when On Rent)
   Contacted             (Member / Equipment)
   Not A No!             (Member / Equipment)
   Payment Discussed     (Member / Equipment)
   Signed﹡              (Member)
   Paid﹡                (Equipment)
```

- Stages are **tagged** with the funnel(s) they belong to; the menu shows only the stages
  relevant to the customer's current funnel membership + activity (per the visibility rules).
- Auto stages (﹡) render as **status** (locked), not manually selectable — same guard as today's
  `Signed`/`Paid` locks.
- Built through the existing R1 gate machinery (`funnelPill` / `gateTimeline` / a
  `setFunnelStage`-style writer), so it stays inside the yard data-plate language.

## Quick-add

The inline "Lead?" pill picks **one** funnel (Rental / Member / Equipment) and drops the new
customer at `Lead` on that track. (Multi-funnel membership is added later from the detail view.)

## Customer-detail funnel section

Replaces today's 2-tab (Rental / Equipment Sales) with a **two-track** view:

- **Track A — Rental → Member:** the combined ladder with the activity-gated Rental stages + the
  Member reveal.
- **Track B — Equipment:** the equipment-sales ladder.

## Data model

- **Explicit funnel membership (Jac 2026-07-17):** a customer stores **which funnels they're in** —
  e.g. `funnels: { rental, member, equipment }` (or a `funnelsIn[]` set). Membership is a
  deliberate selection (the "Leads" fork), **not** inferred from whether a stage is set — so a lead
  can be "a Member" while their sales stage is still empty, and the three tracks stay independent.
- **Member** stage → `membershipStage` (existing field, repurposed): `Lead … Signed`, manual, with
  `Signed` auto on the membership agreement.
- **Equipment** stage → `usedSalesStage` (existing): `Lead … Paid`, manual, with `Paid` auto on the
  sale invoice.
- **Rental** is a *selectable* fork like the others, but **past the fork its stage is derived** —
  Reserved/Rented come from live rental status; a rental prospect with no activity sits at `Lead`.
  **Auto-join:** the first reservation/rental sets `funnels.rental = true` if it wasn't already.

## Migration

- Existing `membershipStage` → Member funnel; existing `usedSalesStage` → Equipment. **No data
  loss.**
- The Rental funnel is derived from existing rental records → **no backfill**.
- `STATUS.funnelStage` (config.js) already carries every stage value; the redesign adds **per-funnel
  stage sets + order** (which stages each funnel allows, and their sequence).

## Out of scope

- The rental-activity records themselves (only how the funnel *reads* them).
- How memberships/invoices are created (only how the funnel reflects them).

## Resolved (Jac 2026-07-17)

1. Funnel membership is **explicit** — a stored selection (the "Leads" fork), **not** implied by a
   non-N/A stage.
2. **Rental** is a selectable fork; **past the fork its stages are derived** from rental activity
   (no manual Reserved/Rented picks).

## Open / for the plan

- Exact storage shape for membership (`funnels{}` object vs. a `funnelsIn[]` set) and the migration
  from today's `membershipStage`/`usedSalesStage` (which currently *imply* membership by being set).
- `/role` audit pass (data-sensitivity / gate lenses) before implementation — the funnel is
  lead-stage data, not pricing/margin, so expected low-risk, but confirm no membership-economics
  detail leaks onto a customer-facing surface.
