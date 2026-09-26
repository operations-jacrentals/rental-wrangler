# Loop checklist — <goal>

> **How to run this loop.** Each pass: read this file, do **one** unchecked item, check it off,
> commit, stop. Do not re-read the whole world; do not batch items. Context per pass stays flat,
> and the work survives the session ending.

**Done means:** `<the exact command that must exit 0>`
*(If "done" is "looks good", the loop never terminates. Make it a command.)*

**Budget:** stop after `<N>` passes or when remaining budget drops below `<X>`, then report
what's left rather than running dry mid-edit.

**Blast radius per pass:** one file / one failure / one item. Larger passes fail in ways you
can't attribute.

## Items

- [ ] …
- [ ] …

## Seen (do NOT re-add)

> Deduplicate against everything **seen**, not everything **accepted**. Otherwise rejected
> findings resurface every round and the loop can never converge — the single most common
> reason a discovery loop runs away.

- …

## Log

| Pass | Item | Result | Commit |
|---|---|---|---|
