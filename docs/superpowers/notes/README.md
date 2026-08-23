# Parked notes — where a deferred idea lives

A **parked note** is an idea, follow-up, or known-issue that came out of a session but isn't being
built yet. It lives here, on `trunk`, as a dated markdown file.

**It does not live as an open pull request.** That was the old habit and it's what made the board
unreadable: by 2026-08-02 there were twelve `[parked]` PRs holding **zero lines of code** between
them, sitting in the same list as real unmerged work. A reader could not tell the difference without
opening each one. All twelve were closed in that cleanup and their notes landed here instead.

## The rule

| Situation | Where it goes |
|---|---|
| Idea, follow-up, or deferred decision — no code | A dated file **here**, merged to trunk |
| A known bug or a task with a shape | A row in `backlog.md` |
| Real code you want reviewed | An actual PR |

A note merged to trunk is greppable from every future session, survives a fresh cloud clone, and
costs nothing to leave alone. A note held open as a PR is invisible to `grep`, ages into a merge
conflict, and quietly inflates the count of "unfinished work" — which is the number you use to
decide whether a session is safe to archive.

## Writing one

Name it `YYYY-MM-DD-short-slug.md`. Say what the idea is, why it was deferred, and — the part
future-you actually needs — **what question has to be answered before it can be built**. A note that
records only the idea will get re-litigated from scratch; one that records the open question can be
picked straight back up.

If the note is a handoff for specific verification work rather than an idea, put it in
`docs/handoffs/` instead.
