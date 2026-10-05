# Scaffolding before features — the card

An AI-built app has two codebases: the source, and the context needed to safely change it. You carry
the second in your head; a model rebuilds it from scratch every session. **Build the tools that
answer questions before the code that raises them.**

## Day one — before feature #1
1. **Boot smoke test.** Thirty lines. Catches half of all "it's broken" before a human sees it.
2. **Chapter IDs stamped in the source.** `grep APP-19` works cold. Line numbers rot; IDs don't.
3. **Code map in two halves.** Hand-written story + generated index, with a CI `--check`.
4. **A test for anything computing money.** The day it first returns a dollar.
5. **Dated decisions ledger, from row one.** Written later, it's a guess about what you used to think.
6. **`--check` on every registry.** Same script, two modes: write, or fail if writing would change anything.
7. **Deploy/release as scripts with a preview mode.** Bare = read-only; `--yes` to run.
8. **A memory file in the repo.** So session 40 doesn't re-derive session 3.

## The five I'd redo
1. **Map and chapter IDs on day one**, not at 15,000 lines. Retrofitting produces nothing visible.
2. **Ledger live from row one.** Ours was reconstructed — that's why its first 100 rows are the least trustworthy.
3. **Click-to-source in dev builds, week one.** The cheapest bug report is a coordinate, not a paragraph.
4. **Nothing to arbitrate beats good locking.** Immutable paths killed a whole class of contention bug by construction.
5. **Every guard a script, never a habit.** Anything enforced by remembering is already broken.

## Before the next integration
- **Ownership.** For every object on both sides: which system is the source of truth? What reconciles them — and how would you know it did nothing?
- **Spike it.** Twenty lines proving the API behaves as documented, before designing on that assumption.
- **Slow paths.** What's asynchronous or takes days? What assumes it finishes now? (Cards attach instantly; bank accounts take days.)
- **Second variants.** When a second type arrives, which checks written for the first will wrongly reject it?
- **Verify from the far side.** `ok:true` is not proof. The Sent copy, the dashboard, the actual charge.
- **No heavy work in a boot path.** An account quota is a ceiling — backoff spends it faster, not slower.

## Tokens, agents, loops
- **Map before grep.** Index + one chapter ≈ 15k tokens. Whole file ≈ 350k. That's the 20×.
- **Cap every tool output.** Oversized output is the biggest silent burn there is.
- **Delegate the reading, keep the deciding** — and give every agent the coordinates, or it re-greps blind.
- **Never delegate ambiguity, or the third attempt** at a bug that already beat two fixes.
- **Make "done" a command,** not a judgement. "Looks good" never exits.
- **Externalize the loop's checklist.** One item per pass, commit, stop. Flat context per pass.
- **Dedupe against everything *seen*, not everything *accepted*** — the #1 reason a loop never converges.

## Build the jig, not the part
- Before a big build, spend an hour on a **throwaway that makes one decision cheap**. Then delete it.
- **Isolate one variable.** A texture explorer carrying your nav and auth is just the app.
- **Interactive, not static** — a picture can't answer "400 rows, empty list, 60-character name."
- **Fake data, but hostile.** Friendly fake data proves nothing.
- **Cheapest medium that holds the decision.** Sketch → page → slice → design tool → code. One level at a time.
- **Rebuilt the same throwaway twice? It earned a script.** Same rule as skills.

## UI · UX · characters
- **Name the archetypes before drawing.** Otherwise: fourteen button variants and no vocabulary.
- **One accent, budgeted.** Semantic colour stays separate from brand accent.
- **A smart persona finds nothing.** Make them lazy, distracted, mid-task — that's the real user.
- **"What does this screen tell me to do next?"** Nothing → it isn't finished.
- **Verify every finding against shipping code.** Personas hallucinate enthusiastically.
- **Read the ledger to the END.** Stopping at the first hit is how a dead decision becomes canon.

---

Every piece of knowledge that lives only in a person's head or a past conversation is a **recurring
bill**. Write it into a file a model reads, or a script that fails without it. Those are the only two
places it survives.
