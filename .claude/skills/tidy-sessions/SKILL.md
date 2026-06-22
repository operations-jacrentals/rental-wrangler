---
name: tidy-sessions
description: List finished / stale Claude Code sessions and archive them (with confirmation) so completed chats stop cluttering the list and you never reopen a done one. Use when chats pile up, or after task branches merge. Invoke with /tidy-sessions.
---

# /tidy-sessions — archive finished chats

Keeps the session list to what's actually live. A chat is "done" when its task branch has merged (the branch janitor then deletes that branch) — that's the cue to archive it.

## Steps
1. **List sessions** with `mcp__ccd_session_mgmt__list_sessions`. If that tool isn't available in this environment (e.g. a cloud run), say so and stop — point Jac to archive chats in the Claude app instead.
2. **Identify archive candidates** — be conservative:
   - No activity in the last **7 days** (default; honor a different age if Jac says so), OR
   - The session's task branch is **merged/gone** — cross-check with `gh pr list --state merged` / `git ls-remote` when the session records its branch.
   - NEVER flag the **current** session, or any session whose task branch still has an **open PR** or no PR at all.
3. **Present the candidates** as a short table — title · last activity · branch status — and ask which to archive (`AskUserQuestion`, multi-select). Default selection = the clearly-done ones; let Jac deselect.
4. **Archive** the confirmed ones with `mcp__ccd_session_mgmt__archive_session`. Report what was archived and what was kept.

## Rules
- **Never archive without explicit confirmation.** Archiving is reversible, but surprise is not welcome.
- **Never archive the active session.**
- Default conservative: when unsure whether a chat is finished, leave it.
- **Scope note:** this manages the sessions visible to this environment. The **cloud web chat list** is managed in the Claude app — if a chat lives only there, surface it for Jac to archive manually rather than claiming to have handled it.
- Pairs with the **branch janitor** (merged task branch → deleted) and the `/start` promotion cadence: branch gone = chat done = safe to archive.
