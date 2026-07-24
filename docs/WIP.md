# Work in flight — the dual-agent ledger

One line per in-flight feature, so Claude and Codex don't collide (see `docs/CODEX-HANDOFF.md`
§8a). Each agent **appends** a line when it starts a feature and **removes** it on merge. Read this
before starting anything, so the two agents never grab the same work.

**Format:** `owner (claude | codex) · branch · flag · one-line status`

---

- **claude** · `claude/rental-wrangler-ui-research-rhd74v` (PR #752) · `FEATURES.designV2` · dv2
  inline-expand redesign — Steps 1–2 built (inline-expand rendering seam + section plate-stack,
  Units done). Pending: land on trunk behind the flag, then carry the plate-stack into Rentals +
  Customers and finish rollout steps 3–10 (`docs/superpowers/plans/2026-07-21-list-detail-views-build-plan.md`).
