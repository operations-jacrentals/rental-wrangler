# Rental Wrangler — UI System Research

**Private.** Contains app-weakness detail and internal findings. Do not mirror into the public
`rental-wrangler` repo.

This repository is the combined output of **five persona-driven usability audits** ("lazy-audit"),
each run against a different card of the live app and verified against production's real bytes.
It exists to answer one question:

> **What is the full scope of problems a redesigned UI *system* has to solve?**

"UI system" here does not mean prettiness. In Jac's words: *"I'm referring to all the WORK that has
to be done and how UI helps it all get done."* The app is a large set of competing systems — rentals,
units, customers, categories, dispatch, invoicing, service, comms — sharing one screen. No coherent
UI system was settled up front, because it could not be. The app is now nearly built, so it can be.

**This is a gathering, not a design.** Nothing here proposes a solution. The next session's job is to
finish the gathering and present the completed scope — then stop for review.

---

## ⚠️ Clone this repo blobless — do not do a plain `git clone`

`03-screenshots/` holds ~17MB of JPEGs. A full clone of that through a cloud proxy is slow and has
already timed out one session. Nothing here needs the image bytes up front — the captions in
`04-screenshot-index/` carry what the images showed.

```bash
git clone --filter=blob:none https://github.com/operations-jacrentals/rental-wrangler-ui-research.git
```

`--filter=blob:none` fetches file *contents* lazily, so text lands immediately and an image only
transfers if you actually open it. If you only need to contribute and never read the research, narrow
it further:

```bash
git clone --filter=blob:none --sparse <url> && cd rental-wrangler-ui-research
git sparse-checkout set contrib
```

If git still struggles, skip cloning and write through the API instead:
`gh api --method PUT repos/operations-jacrentals/rental-wrangler-ui-research/contents/<path> -f message="…" -f content="$(base64 -w0 <file>)"`

## What's in here

| Folder | What it is | How to use it |
|---|---|---|
| `SCOPE.md` | **Start here.** The completed scope: the whole corpus (≈269 verified findings), the 25-job backbone, what the gathering closed, and what remains unknown. | The capstone — read first, then drill into the folders it cites. |
| `01-inventory/` | The combined, deduplicated problem inventory — every finding from all five audits, tagged by the job it blocks, the UI primitive implicated, the failure mode, and severity. Plus cross-card patterns, a blind-spot analysis, **the job taxonomy (`JOB-TAXONOMY.md`) and the full re-index (`FINDINGS-BY-JOB.md`)**. | Read `COMBINED-INVENTORY.md` in full; use the taxonomy as the primary axis. |
| `07-phone-walk/` | The first-ever walk of the <640px phone build + the 641–1024 touch-tablet band, live-driven with real touch events against production bytes. 17 findings, a hover re-grade table, 12 screenshots. | The phone gap, closed. Adversarially verified in place. |
| `08-unaudited-surfaces/` | The 12 surfaces no audit touched — Settings, Rental Rules, money/ACH, back-office boards, agreements/signing, print, the Wrangler write path, public pages, login/day-one, offline. 62 findings. | Adversarially verified in place; corrections marked. |
| `09-cross-card-traces/` | Five end-to-end job traces across card boundaries; 15 orphaned arrows no card owns, ranked by business consequence. | Adversarially verified in place (10/10 confirmed). |
| `02-source-artifacts/` | The four finished audit documents, exactly as each session shipped them. Self-contained HTML with the persona, an as-is vs should-be mock, a report card, and a retractions section. | Open in a browser when you need one card's full argument. |
| `03-screenshots/` | 138 unique screenshots captured live against production during the audits. Deduplicated by content hash. | **Read the index first — don't open these blind.** |
| `04-screenshot-index/` | For every screenshot: the browser action that produced it, and **what the auditing session said immediately after seeing it**. 100% coverage. | This is the point: the images were already analysed once. Use the captions; open a `.jpg` only when you need the actual pixels. |
| `05-raw-transcripts/` | The four audit conversations, stripped of tool noise. ~130KB each. | Source of truth for anything the artifacts left out. Search these when a finding seems thin. |
| `06-structured-findings/` | 11 raw workflow outputs — the verified finding sets, with citations, evidence, adversarial verdicts and corrections. JSON. | Parse with node, don't cat them whole. Use when you need the exact evidence behind a claim. |

---

## The five audits

| Card | Persona | Fidelity |
|---|---|---|
| **UNITS** | Merle — lazy yard mechanic | Full |
| **CUSTOMERS** | counter/sales rep | Full |
| **CATEGORIES** | — | Full |
| **CALENDAR / DRIVER** | dispatcher/driver | Full |
| **RENTALS** | Denny — dispatcher | ⚠️ **Partial** — reconstructed |

**On RENTALS:** it was the *reference* run — the lazy-audit skill was written from it — but its session
does not exist on the authoring machine. Its findings were reconstructed from the skill text (which
quotes the run's biggest finds verbatim) plus PR #740 and the `rentals-dispatch/*` branches. It is
marked lower-fidelity throughout. **If the original RENTALS artifact turns up, fold it in at equal
footing — that is the single biggest known gap in this research.**

---

## How findings are tagged

Every finding carries four tags so the inventory can be read along any axis:

- **job** — the real-world task it blocks (*"get a machine ready to rent"*, *"chase an unpaid invoice"*).
  This is the primary axis.
- **primitive** — the UI element implicated (flag, status pill, group bar, mini-card, popup, toast,
  drag target, nav control…). This is the cross-index.
- **failureMode** — one of: `invisible` · `ambiguous` · `unreachable` · `inconsistent` · `lying` ·
  `destructive`
- **scope** — one of: `signal` (flags/colour/severity) · `architecture` (what lives where, reachability)
  · `interaction` (drag/hover/gesture/guards) · `density` (size, truncation, labelling)

---

## Read this before trusting anything

**Retractions are load-bearing.** Every audit ran an adversarial verify pass, and several headline
claims did not survive it. The inventory carries a retractions list. Findings that were refuted must
**not** be resurrected — some are seductive and wrong. Two examples worth knowing up front:

- *"The UNITS card opens as six collapsed drawers"* — false. That was stored device state on the
  account being driven; the shipped default is open.
- *"The worklist graph is buried / the default sort is alphabetical"* — false for the mechanic role.
  `ROLE_LANDING` already opens the graph and sorts by service-due. The real defect is that this good
  default does not *survive* opening a record.

**The app repo is a shallow clone** on the authoring machine, which makes local `git merge-base`,
`rev-list --count` and `rebase` lie at the graft boundary. This produced a false "production is
broken, nothing can ship" alarm in one session. Use the GitHub compare API for any ancestry question.

**Figma:** a parked project recreated the current UI in Figma. It was deliberately set aside for this
gathering so the findings stay uninfluenced by the existing structure. It is the best available
*as-is* record and should be un-parked at design time, not before.
