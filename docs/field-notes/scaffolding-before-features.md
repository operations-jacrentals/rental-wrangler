# Scaffolding Before Features

**Field notes from building Rental Wrangler with AI — what to install on day one of the next app.**

*Rental Wrangler · 2026-08-20 · engine `app.js` 27,714 lines · chapters `APP-01`…`APP-38` · 11 CI scripts · 14 build tools · 23 project skills*

---

## §01 — The one idea, if you only keep one

An AI-built app has two codebases. There's the source, and there's the **context needed to safely
change the source** — where things live, what was already decided, what "done" means. Humans carry
the second one in their heads. A model carries none of it, and rebuilds it from scratch on every
session, every subagent, every audit.

So the highest-leverage thing you can build is not a feature. It's the machinery that makes that
second codebase **cheap to load and impossible to lose**. Every hour spent on a map, an index, a
ledger, or a gate pays back on every single session afterward, forever. Every hour you don't spend
gets charged back to you as re-derivation, at compounding interest.

Practically: **write the tools that answer questions before you write the code that raises them.**

---

## §02 — The day-one build order

Before the first feature — while the repo is still small enough that all of this takes an afternoon
rather than a month of retrofitting:

**01. A boot smoke test.**
Thirty lines: serve the app, load it headless, assert no console errors and one known element
rendered. Written before feature one, it never has to be retrofitted, and it catches roughly half of
all "it's broken" reports before a human sees them.

**02. Chapter IDs stamped into the source.**
Banner comments carrying a stable ID — `APP-01` … `APP-38`. The ID lives *in the code*, not only in
a doc, so `grep APP-19` lands on the right chapter from a cold start with zero context loaded. Line
numbers rot; IDs don't.

**03. A code map, in two halves.**
One hand-written file that tells the *story* (why each chapter exists, how the data flows), and one
machine-generated index that holds the volatile part — line numbers, symbol lists. A CI `--check`
keeps the generated half honest. Splitting them is the trick: the story stays stable while the index
churns.

**04. A regression test for anything that computes money.**
The day a function first returns a dollar figure, it gets a test. Money bugs are the only bugs that
cost you customers rather than time, and they're the ones a model is most confident about while
being wrong.

**05. A dated decisions ledger — starting at row one.**
Append-only, every row dated, every reversal carrying a pointer both ways. Not a document you write
later: a table you append to the moment something is settled. A decision that isn't in the table
hasn't been made.

**06. The `--check` pattern on every registry.**
Any list a human or model must keep in sync — design rules, routes, feature flags, window catalogs —
gets a generator with two modes: *write it*, or *fail if writing would change anything*. Same
script. That single flag is what makes documentation non-optional without anyone having to nag.

**07. Deploy and release as scripts with a preview mode.**
Anything you'll do the same way twice becomes a script. Anything irreversible gets a bare read-only
preview and an explicit `--yes`. The script is also where the safety check lives — ours refuses to
promote unless the reviewed bytes actually match what's about to go live.

**08. A memory file, committed to the repo.**
Decisions, gotchas, open threads. Read at session start, updated at session end. It's the difference
between session forty knowing what session three decided and session forty re-litigating it.

> **What skipping it costs.** Every item above was eventually built here — just later, against a
> codebase that had grown past 15,000 lines. Retrofitting chapter IDs and a map into a file that size
> is a multi-session job that produces zero visible product. Doing it at 500 lines is an afternoon.

---

## §03 — The map, and making the atlas interactive

The map is the single highest-return artifact in this repo. The arithmetic is blunt: reading a
27,000-line file to change one function costs roughly 350k tokens. Reading a 450-line map, then one
600-line chapter, costs about 15k and lands more accurately. That's the whole game — **map before
grep**, every time.

### What makes a map actually work

- **Narrate, don't list.** A table of function names is a symbol dump. The useful map explains the
  *one rule that explains the whole app* — for us: render from state, actions mutate state,
  everything else is derived. With that sentence, a model knows which of four places to look before
  it opens anything.
- **Supply a reading order the file doesn't have.** Real codebases accrete — ours has chapters
  sitting physically out of order because features got bolted in wherever they fit. The map imposes
  the order the file lacks, and keeps a separate "as it sits on disk" view for when you need the
  truth.
- **Never renumber.** Anchors are handles, not addresses. We have a `§13.3` that sits before `§12`
  and we left it there, because renumbering silently invalidates every reference in every doc, every
  past decision, and every memory of every prior session.

### Making it interactive — the thing I'd build in week one

The map answers "where does X live" when you can already name X. The expensive case is the opposite:
you're looking at a screen and something is wrong, and nobody can name it. That gap is where most
triage tokens die.

So close the loop from pixel back to source. Stamp every UI element with its rule ID in the markup,
then add a dev-only overlay that prints the coordinates on click:

```
R14 · APP-19 Header & KPI · app.js:6585 · style.css:1204
```

That turns a bug report from a paragraph of prose into a coordinate. Instead of "the status chip on
the rentals card looks wrong," you get three tokens that a model can act on without reading anything.
Ours has the stamps (`data-r` on every element) but not the overlay — the overlay is the piece I'd
add first on the next build.

---

## §04 — Labelling and splitting the code

A 27,000-line file is survivable *because* it's chaptered and indexed — but I wouldn't do it again.
Split at chapter boundaries early, and name the file after the chapter ID so the map and the
filesystem agree: `app-19-header-kpi.js`. Then the map's index and `ls` tell the same story, and a
model that has neither loaded can still find its way by filename alone.

- **One concept per file, named for the concept** — not `utils.js`, which is where findability goes
  to die.
- **Keep a dead-code report generated, not audited.** AI-built codebases accrete abandoned helpers
  fast; a script that lists unreferenced symbols weekly beats a human noticing.
- **Stamp generated files as generated,** in the first line, loudly. Someone will eventually
  hand-edit one otherwise, and the next regeneration silently eats the edit.

---

## §05 — Skills

Twenty-three of them here, and the pattern that emerged is fairly clean.

- **A skill is a decision that survived being made twice.** Don't write them up front — you'll guess
  wrong about what recurs. Write one the second time you catch yourself explaining the same thing.
- **The description is the product.** A skill that never fires is worth zero, and firing is entirely
  a function of the description. Ours are long on purpose: they list the literal phrasings a person
  actually uses ("walk the invoices card as an AR clerk"), and — just as important — they end with an
  explicit boundary pointing at the sibling skill: *NOT for X, that's Y.* The negative half does as
  much work as the positive half.
- **Separate decisions from rules.** Our design system is deliberately two skills: one holds the
  *decisions* (this exact orange, this typeface, these four control shapes) and one holds the
  *measurable rules* those decisions must satisfy (contrast floors, one control height, the accent
  budget). Decisions change constantly; rules almost never. Merge them and every brand tweak forces
  you to rewrite the rulebook.
- **Publish the precedence rule.** Ours: *when a decision and a rule conflict, the decision moves,
  not the rule.* One sentence, and an entire category of circular argument disappears.
- **Make workflow skills chainable and self-backfilling.** `/promote` runs `/merge`, which runs
  `/deploy` if the work was never deployed. You can enter the pipeline at any station and it repairs
  the steps behind you. That's what makes it safe to forget the order.

---

## §06 — UI

- **Name the archetypes before you draw anything.** Ours are Signal · Gate · Stamp · Ref · Door ·
  Pin · Field. Deciding what *kinds* of things exist is what keeps screen two hundred coherent with
  screen one. Skip it and you get fourteen button variants and no vocabulary to discuss them in.
- **Shape carries meaning, and there are only a few shapes.** Four here: squared means state, one
  means opener, rounded means record, pill means action. A user learns that once and then reads every
  new screen for free.
- **One accent, budgeted.** One orange, roughly a 60-30-10 split. The discipline isn't picking the
  colour, it's refusing the second one — and keeping semantic colour (good / warning / critical)
  strictly separate from brand accent so an alert can never be mistaken for decoration.
- **Tokens in the code, never hexes.** So a reskin is a variable swap rather than a search-and-replace
  across thousands of lines.
- **Read the ledger to the end.** This one cost us real time: our first hundred ledger rows were
  written as a snapshot after the fact, and later rows supersede some of them. Grepping for a decision
  and stopping at the first hit is exactly how a dead decision gets confidently cited as canon. Date
  every row, require a supersedes-pointer both directions, and if you can, add a check that fails when
  two live rows contradict.

---

## §07 — UX, and the characters that find the bugs

The most productive UX tool we built is a persona audit — walk a screen as a specific person with a
specific bad day. The counter-intuitive part:

> **A smart, patient persona finds nothing.** The character has to be lazy, distracted, mid-task and
> not especially interested — because that's the actual user. A charitable reviewer reads the tooltip.
> A real dispatcher with forty minutes before the yard closes does not.

Give each character four things and keep them in a file the model reads:

| | |
|---|---|
| **A job** | dispatcher, AR clerk, shop hand |
| **A competence level** | how fluent are they, really |
| **A distraction** | what's actually on their mind right now |
| **A failure mode** | what they do when confused — guess, tap the biggest button, walk away |

Three to five characters covers most apps.

Two questions catch more than any checklist:

- **"What does this screen tell me to do next?"** If nothing, the screen isn't finished. This is the
  single most productive question we ask.
- **"Where is the real emergency, and what is burying it?"** Most bad dashboards aren't missing
  information — they're weighting it wrong.

Then **verify every finding against the actual shipping code before you believe it**. Personas
hallucinate problems enthusiastically. An unverified persona audit is a tidy list of plausible
fiction, and acting on it burns more than the audit saved.

The second use of characters is voice. A product character — ours is "Mr. Wrangler" — plus a fixed
verb set (six to ten words: *wrangle, round up, corral, brand*) gets you consistent copy across
hundreds of strings without a style meeting per string.

---

## §08 — Build the jig, not the part

The most avoidable cost in this project was iterating inside the real app when a throwaway would
have answered the question in a tenth of the time. Changing something in the real app costs a build,
a deploy, a review pass and a context reload. Changing it in a 200-line scratch page costs a refresh.

So before a big build, spend an hour on a **disposable tool whose only job is to make one decision
cheap** — then throw it away.

### The five worth building

- **A renderer / explorer.** One page that shows a single visual system — a texture, a palette, a
  type ramp, every state of one component — side by side with live controls. Turns "which of these
  six" into a two-minute look instead of six deploy cycles.
- **An interactive mockup, not a static one.** Real interaction, fake data. A static image can't
  answer *what happens with four hundred rows, an empty list, or a sixty-character name* — and
  that's where most designs actually die.
- **A standalone slice of the real UI.** One card, extracted, with no nav, no auth and no backend.
  We built exactly this, and the reason is instructive: a hand-inlined copy of a prototype card
  silently fell behind the real one, because nobody rebuilt it. Making it one command fixed that
  permanently.
- **A data-shape probe.** Feed a real export in and print what your parser actually makes of it,
  *before* designing around an assumed shape. Real data is where assumptions go to die.
- **An API spike.** Twenty lines proving an integration behaves the way its documentation claims,
  before you design a feature on top of it. Nearly every entry in the integration report would have
  been cheaper as a spike first.

### Four rules that keep them cheap

- **Isolate exactly one variable.** A texture explorer that also carries your nav and your auth
  isn't a jig — it's the app, and it costs what the app costs.
- **Fake the data, but make it hostile.** Longest plausible name, empty set, four hundred rows, a
  missing field. Friendly fake data proves nothing.
- **No tests, no polish, no reuse.** Scratch folder, git-ignored, deleted after. A "temporary" tool
  that quietly becomes permanent is a second product you now maintain forever.
- **Decide in the cheapest medium that can hold the decision.** Sketch → published page → standalone
  slice → design tool → real code. Move up one level only when the current one genuinely can't
  answer the question — and no further.

The one exception to disposability: **if you rebuild the same throwaway twice, it has earned a
script.** That's the same rule as skills — the second time is the signal.

> **The counter-example.** Pixel-recreating one card from a flat image cost **103 minutes and
> roughly two million tokens** — to recover structure that was never in the file to begin with. A jig
> can make a decision cheap; it cannot recover information that doesn't exist. If an editable
> source exists anywhere, go get the source first.

---

## §09 — Audits: three kinds, and you need all three

| Kind | Cost | Cadence | Catches |
|---|---|---|---|
| **Machine gates** | seconds | every push | Boot failures, money regressions, contract breaks. Non-negotiable, so nobody argues. |
| **Drift checks** | seconds | every push | The `--check` family — map out of date, registry out of sync, a released file changed without its version bumped. |
| **Judgment audits** | expensive | on demand | Persona/role sweeps, security and data-exposure passes. Real reasoning, so run them deliberately. |

- **No fix without a cited root cause.** Our triage skill requires the symptom be traced *up* to a
  cause, with file-and-line citations, before a line changes. This one rule kills the most common AI
  failure mode: a plausible, confident fix that changes nothing because it addressed a symptom.
- **Verify adversarially.** Fan out finders, then have *separate* agents try to refute each finding.
  Majority-refuted dies. Without this, a forty-item audit is about thirty items of fiction and you'll
  spend a week on it.
- **Audit the bytes that ship,** not the working tree.
- **Findings become rows, not prose.** A finding with no home in a tracked list is a finding you'll
  rediscover in three weeks and pay for twice.

---

## §10 — Agents

The real benefit of a subagent isn't parallelism — it's **context isolation**. An agent that greps
forty files and hands back eight lines just saved you thirty-nine files of context you'll never have
to carry.

Two questions decide every delegation: *what does it cost if this is wrong?* and *do I need to see
the reasoning, or just the answer?* If you need the intermediate thinking to make the next call, keep
it. If you only need the result, send it away.

| Tier | Send it | Why |
|---|---|---|
| **Cheapest** | git plumbing, grep sweeps, file munging, run-a-script-and-report | Being wrong is instantly visible and free to redo. |
| **Mid** | UI or code from a settled spec, an additive endpoint, PR bodies | Bounded work with a written target to check against. |
| **Top** | specs, security and data gates, cross-system architecture, ambiguous calls | Wrong here leaks data or money. Keep it on the main thread. |

### Four rules that stop delegation from backfiring

- **Never delegate ambiguity.** An agent handed an under-specified task returns a confident, wrong
  artifact, and reviewing it costs more than building it. Ambiguity gets resolved *before* the handoff
  or not at all.
- **Never delegate the third attempt.** If two fixes already failed, the problem isn't effort — it's
  a wrong model of the system. A fresh agent with less context will fail faster and more expensively.
- **Give every agent the coordinates.** An agent without your map re-greps blind and burns more than
  doing it yourself. Hand it the chapter ID and the file path in the prompt. This is why the map pays
  twice.
- **Background by default,** so the main thread stays free for the next question — and say in one line
  which agent got what, so nobody has to guess where a decision was actually made.

---

## §11 — Tokens

Ranked by what they actually saved here, largest first.

| Habit | Rough saving |
|---|---|
| Map before grep — index plus one chapter, never the whole file | ~20× |
| Delegate the reading; keep the deciding | ~10× on sweeps |
| Cap every tool output — `\| head -50`, ranges not whole files | large, silent |
| Never re-read a file you just edited to "verify" | 2 reads/edit |
| Write decisions down once so session 40 doesn't re-derive session 3 | compounding |
| Keep stable context stable — churn invalidates cache from that point on | cache-wide |

The biggest silent burn is **oversized tool output**. A single unbounded directory listing or log
dump can cost more than an hour of careful editing. Cap everything by reflex.

And **build the self-measurement in.** We have an audit that fires automatically roughly every million
tokens and reports cache hit rate, redundant reads, oversized outputs, and whether the model tier
actually fit the work. You cannot fix a habit you can't see, and nobody reviews their own transcripts
voluntarily.

---

## §12 — Looping toward a goal without burning everything

The failure mode is specific and worth naming: an open-ended loop where each pass re-reads the world,
makes a small change, and re-verifies everything. Cost grows with the square of the number of passes,
and it does not converge — it just runs out of budget.

Every fix is a variation on the same move: **put the loop's state outside the conversation.**

- **Define "done" as a command before you start.** If the exit condition is "looks good," the loop
  never exits. If it's *this script exits zero*, it terminates on its own.
- **Externalize the checklist.** Each pass reads a file, does *one* item, marks it, and stops.
  Context per pass stays flat instead of growing with history — and the work survives the session
  ending.
- **Loop until dry, not until N.** For discovery, keep going until two consecutive passes find
  nothing new; a fixed count always stops mid-tail or long past it.
- **Deduplicate against everything *seen*, not everything *accepted*.** Miss this and rejected
  findings resurface every round forever and the loop can never converge. It's the single most common
  reason a discovery loop runs away.
- **Cap the blast radius per pass** — one file, one failure, one item. Large passes fail in ways you
  can't attribute, which forces a re-read of everything.
- **Commit each green step.** A loop that checkpoints can be resumed; one that holds its progress in
  context dies with the session and takes the work with it.
- **Set the budget explicitly** — stop at N passes or below X remaining, then report what's left
  rather than silently running dry mid-edit.

---

## §13 — The desk: local and cloud organization

- **One canonical checkout.** Two working copies of the same project is how you end up shipping the
  wrong one. Parallel work goes in isolated worktrees off the same repo, never a second clone.
- **Outputs never touch source.** A dated, git-ignored session folder per topic; a known scratch
  directory for temporary files. Never the repo root, never scattered through the system temp.
- **Secrets are environment variables, always.** Ours are referenced by name only — never a value,
  not even in a doc. If the repo is public, a password committed once is a permanent leak, and
  rotating it doesn't un-publish it.
- **Write down what each machine can actually do.** Our browser test suite runs in CI and the cloud
  but has never once installed correctly on the desktop. That fact lives in the startup routine now,
  which is the only reason we stopped rediscovering it every few weeks.
- **Have a start ritual and an end ritual.** Start orients: what's installed, what branch, what did
  we decide last time. End closes: what actually shipped, what's still pending, park every loose idea
  on its own branch, and write the handoff note. The end ritual is the one that stops good
  half-finished ideas from dying quietly in a closed tab.

---

## §14 — What I'd genuinely do differently

**01. Chapter IDs and the map on day one, not at 15,000 lines.**
Everything else in this document depends on being able to find things cheaply. It was built late
here, and retrofitting it was a multi-session job with nothing visible to show for it.

**02. The decisions ledger starting at row one, live.**
Ours began as a reconstruction, which is why its first hundred rows are the least trustworthy part of
it. A ledger written after the fact is a guess about what you used to think.

**03. Click-to-source in dev builds, in week one.**
The cheapest bug report is a coordinate. Everything else is prose that someone has to translate back
into a file and a line.

**04. Prefer designs with nothing to arbitrate over designs with good locking.**
We built a lock-and-lease system so parallel sessions could share three staging slots, then replaced
it with immutable numbered folders — where contention simply cannot occur, because nothing is shared.
The second design is smaller, has no failure states, and made an entire class of "staging is busy"
problems stop existing. Reach for the version with no shared mutable state first.

**05. Make every guard a script, never a habit.**
We had a rule that a released file needs its version bumped. People and models forgot it, repeatedly,
until it became a check that fails the build. Anything enforced by remembering is already broken — it
just hasn't cost you yet.

---

> The through-line: **every piece of knowledge that lives only in a person's head or a past
> conversation is a recurring bill.** Write it into a file a model reads, or a script that fails
> without it. Those are the only two places it survives.
