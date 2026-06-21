---
name: audit
description: Token-efficiency + model-appropriateness coaching report for the current Claude Code session. Run with /audit anytime; also fired automatically by a hook roughly every 100k tokens. Reports cache hit rate, redundant file reads, oversized tool outputs, whether the model tier fit the work (Haiku / Sonnet / Opus), and 2-4 concrete habit changes with estimated savings.
---

# /audit — Token + Model Efficiency Coach

Analyzes THIS session and coaches Jac on saving tokens — including whether the wrong (or overkill) Claude model was used for the work.

## Steps
1. **Run the analyzer** (Node is installed):
   ```bash
   node ".claude/skills/audit/scripts/audit.mjs"
   ```
   It auto-detects the current session transcript and prints a JSON metrics blob. (A hook may pass `--transcript <path>`.)
2. **Read the JSON.** Do NOT re-read the raw transcript — the script already crunched it.
3. **Write a SHORT coaching report** (see format). Terse and specific to this session's actual numbers — a long report defeats its own purpose.

## What to flag
- **Cache hit rate** (`cacheHitRate`): healthy is ≥ 0.85. Below that → context is being invalidated (e.g. editing files high in context, long gaps, big mid-conversation inserts). Name the likely cause.
- **Redundant reads** (`repeatedReads`): same file read 2+ times → read once, or `Grep` for the specific line instead of re-reading the whole file.
- **Oversized outputs** (`bigOutputs`, `bigOutputApproxTokens`): large tool results → use narrower `Read` ranges, `Grep` with `head_limit`, or targeted queries instead of dumping whole files.
- **Read-vs-search ratio** (`reads` vs `grepGlob`): many reads with few greps → suggest `Grep`/`Glob` first to locate before reading.
- **Long assistant blocks** (`longAssistantBlocks`): verbose replies → default to terser answers.

## Model-appropriateness (`models` breakdown)
Compare the model(s) used against the work actually done this session:

| If the session was mostly… | Ideal tier | Coaching |
|---|---|---|
| Read-only exploration, grep/list, format/convert, simple Q&A | **Haiku** | "This was mechanical — Haiku at ~1/5 the cost would've handled it." |
| Normal coding, debugging, design decisions | **Sonnet** | "Sonnet was the right call." |
| Hard architecture, multi-system reasoning, repeated wrong answers | **Opus** | "Worth Opus here." or, if used on simple work, "Opus was overkill — Sonnet/Haiku would do." |

Note subagent/mechanical work specifically: if the session spawned agents for grep/read, those should run on Haiku. Frame model notes as **suggestions, not corrections** — a session can look simple from tool calls while involving nuanced reasoning in the text.

## Output format
```
⚡ /audit — <approxContextTotal/1000>k ctx · cache <cacheHitRate*100>% · model: <models>

<🔴 / 🟡 / ✅ one line per flagged item, with the number and the fix>

Model fit: <one line>

Try next:
1. <concrete habit change>
2. <concrete habit change>
Est. savings: ~<rough number/percent> if applied.
```

## Rules
- Keep it to a dozen lines or so. Bullets, not essays.
- Cite this session's real numbers — never generic advice.
- End with a single estimated-savings line so the coaching is actionable, not abstract.
