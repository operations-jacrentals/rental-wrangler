# Work in flight — the dual-agent ledger

One line per in-flight feature, so Claude and Codex don't collide (see `docs/CODEX-HANDOFF.md`
§8a). Each agent **appends** a line when it starts a feature and **removes** it on merge. Read this
before starting anything, so the two agents never grab the same work.

**Format:** `owner (claude | codex) · branch · flag · one-line status`

---

*Nothing in flight as of 2026-08-10.*

Recently cleared:
- ~~**claude** · `claude/rental-wrangler-ui-research-rhd74v` (PR #752) · `FEATURES.designV2` · dv2
  inline-expand redesign~~ — **merged as #766**; the `designV2` flag was retired afterwards.
- ~~**claude** · `claude/design-system-phase-1-vcgald` (PR #798) · design system / V2 card~~ —
  **merged as `def4a15`**. Follow-on state and blockers:
  `docs/design/HANDOFF-2026-08-05.md`; next step in `docs/design/NEXT-SESSION-PROMPT.md`.
