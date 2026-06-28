---
name: janitor
description: Repo + inbox hygiene sweep for Rental Wrangler — close already-resolved Wrangler-inbox tasks, prune merged/stale branches, and flag leftover artifacts, all confirm-first. Use when the inbox or branch list has gone stale, or on a periodic tidy. Invoke with /janitor.
---

# /janitor — keep the yard tidy

Keeps the working surfaces honest: the in-app **Wrangler approval inbox**, the **branch list**, and any leftover build/scratch artifacts. Everything here is **confirm-first** — the janitor proposes, Jac approves; nothing is closed or deleted by surprise. Pairs with `/tidy-sessions` (which archives finished *chats*) and the **branch-janitor** workflow (which deletes merged *branches*).

## Steps

1. **Sweep the Wrangler inbox — remove already-resolved tasks (Jac, 2026-06-28).** The in-app approval inbox is fed by the **open** GitHub issues labeled `wrangler-fix` / `wrangler-request`. A request whose work has already shipped (its PR merged, or the change is otherwise live) but whose issue is still open **lingers in Jac's inbox as a stale task**. So:
   - List open `wrangler-fix` / `wrangler-request` issues.
   - Cross-check each against merged PRs / the live code to decide if it's **already resolved**.
   - Present the resolved-looking ones as a short list (issue # · title · why it looks resolved), and **only close the ones Jac confirms** — leave a short "shipped in #NNN — closing" comment so the trail is clear.
   - **Never** close an issue that's still `wrangler-needs-jac` (awaiting Jac's answer) or still building/in-progress.
2. **Prune branches.** List remote branches whose PR is **merged** but the branch wasn't auto-deleted (the branch-janitor workflow handles most, but webhooks/squash-merges can miss some). Cross-check with merged PRs; propose the clearly-merged ones for deletion and delete only those Jac confirms. Never touch `main`, `staging`, an `area/*` branch, or a branch with an **open** PR or no PR.
3. **Flag leftover artifacts.** Note any obviously-stale scratch files, temp branches, or uncommitted local cruft worth clearing — surface them; don't delete working files without explicit say-so.

## Rules

- **Confirm-first, always.** Closing an issue or deleting a branch is proposed, never surprise-applied. Closing is reversible (reopen), deletion mostly is — but surprise isn't welcome.
- **Conservative when unsure.** If it's not *clearly* resolved/merged, leave it and say why.
- **Protected refs are off-limits:** never delete `main`, `staging`, or any `area/*` branch; never close an issue still awaiting Jac or still building.
- **Scope is this repo + its inbox.** Sessions are `/tidy-sessions`' job; live deploys are never the janitor's call.
- **Pairs with:** `/tidy-sessions` (finished chats) · the **branch-janitor** workflow (auto-deletes merged task branches) · the `/start` promotion cadence (branch gone = chat done).
