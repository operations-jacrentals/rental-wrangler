# New Computer Setup — JacTec / Rental Wrangler

Clone the repo and you're most of the way there. This folder has the two things
that don't come from git: the session handoff and the Claude memory files.

---

## Day 1 checklist

1. **Clone the repo**
   ```
   git clone https://github.com/operations-jacrentals/rental-wrangler.git
   cd rental-wrangler
   npm install
   npx playwright install chromium
   ```

2. **Read the handoff** → `HANDOFF-2026-06-18.md` (this folder)

3. **Restore Claude memory** → `MEMORY-FILES.md` (this folder)
   Copy each section into the appropriate file under:
   `C:\Users\<you>\.claude\projects\<project-slug>\memory\`

4. **Set up the skill gate hook**
   The `UserPromptSubmit` hook (in `.claude/settings.local.json` on the old machine)
   makes Claude decide skill usage autonomously. Re-create it on the new machine:
   ```json
   {
     "hooks": {
       "UserPromptSubmit": [
         {
           "hooks": [
             {
               "type": "command",
               "shell": "bash",
               "command": "node -e \"console.log(JSON.stringify({hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:'Check available skills (jactec-ui / frontend / brainstorming) and invoke the right one autonomously — do not ask the user.'}}))\"",
               "statusMessage": "Skill check..."
             }
           ]
         }
       ]
     }
   }
   ```

5. **Set up clasp** (backend deploys)
   ```
   npm install -g @google/clasp
   clasp login --no-localhost
   # auth as operations@jacrentals.com
   cd backend/
   clasp clone 1hw9A7Id3YIoiSCBkNFeDaKGRv-VtljFFIuBdQG5QULrgS0DjQhQ_2vyZ
   ```

6. **⚠️ Port 8000 — check if reserved on this machine**
   Run: `netsh interface ipv4 show excludedportrange protocol=tcp`
   If 8000 is listed, CI gates need a port swap before running locally.
   See: `CLAUDE.md` → Deploy & gates section.

---

## Key files already in the repo (no action needed)

| File | What it is |
|---|---|
| `CLAUDE.md` | Project rules, design language, deploy instructions |
| `JacTec-handoff/JacTec-SPEC-v8.md` | Full spec — v8.6 is current |
| `.claude/skills/jactec-ui/` | The yard data-plate design skill |
| `JacTec-handoff/` | All session handoff docs |
| `rw-automation/gh-api.mjs` | Deploy helper (create-pr / wait-merge / merge) |

---

## ⚠️ Live state to know immediately

- **KPI rings are blurred** — intentional. `filter: blur(12px)` block at the very end
  of `style.css`. Do NOT remove it until Jac says so. See `MEMORY-FILES.md` → KPI Blur Mask.
- **main is branch-protected** — never `git push origin HEAD:main` directly.
  Always: feature branch → PR → squash-merge. CI `smoke` check must pass.
- **Backend deployed @19** — clasp scriptId above.
