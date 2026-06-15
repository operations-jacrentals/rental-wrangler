# Handoff → local Claude Code session (2026-06-15, evening)

Pick up here. Live is current; this is what shipped, what's open, and how to work safely.

## Where things stand (live = `main` → app.jacrentals.com via Pages)

Top of `main`: **#29** — *Phase 6 free-form route arrows + For-Sale availability fix; cleared the
2 scroll bugs*. Squashed & merged, CI (`smoke`) green, deployed. Plus, from other sessions already
on `main`: **#32** Services (heart) tab → Units 'Service Due' pill · **#31** 'Not Ready' tab → Units
search · **#30** Mr. Wrangler merge · **#28** footer chips route into the card search bar · **#27**
real session sharing via QR.

What #29 actually did (all proven via the `wrangler-fix` prove-then-fix protocol — see that skill):
- **Free-form route arrows** on the Calendar daily-driver timeline. Click a D/R/🏠 icon to arm a
  leg, click another to draw a directional "from here → there" arrow. Per-day in `localStorage`
  (`jactec.dispatchArrows`), drawn as an SVG overlay in the route's **left rail**. Re-draw/click a
  leg to remove, "× N arrows" clears the day, Esc cancels. Keyboard + focus + reduced-motion.
  Code: `dispatchArrowsLS`/`dispatchArrowClick`/`removeDispatchArrow` + `drawDispatchArrows()`
  (called at the end of `render()`); transient `state.dispArm`.
- **For-Sale-in-availability:** under an availability window (`availWin`) the Units list now shows
  only the Active (rentable) fleet, matching the count. All-fleet/sold-inactive sorts still reveal
  them; normal views untouched. (Units list build, ~the `unitsVisible` call site.)
- **Two scroll bugs:** proven already fixed at HEAD (#16/#17) — no code change.
- **D/R dispatch icon** letter was blue-on-blue → now white.

Docs updated alongside: `JacTec-SPEC-v8.md` (**v8.4 delta**), `docs/wrangler-backlog.md` (4 pinned
items marked resolved with the proofs).

## Move forward — candidate next work

1. **Notification bell → in-app feed (the pinned "few days" item).** The bottom-right bell is still
   a **stub**. The intended payoff: surface the engine's *verdict + proof + "refresh to see it"*
   issue comments back inside the app so the report→fix loop closes without anyone opening GitHub.
   Backend already files/lists requests (`wranglerRequests`); the bell needs a feed that polls
   the issue's closing comment (or a new backend action that returns it) and renders it in the
   `notifications` overlay kind that's already stubbed in `app.js`.
2. **Per-card Graph views beyond Units.** Phase 4 shipped Units first (`cardGraphBody`/`pieSVG`/
   `gvBars`); Rentals/Customers/Categories/Invoices each still want their own charts behind the
   same graph icon.
3. **Route arrows — possible follow-ups if Jac wants them:** a printable/"driver sheet" export of a
   day's legs, or auto-suggesting legs from the sequential order. Leave unless asked — current build
   satisfies the pinned request.
4. Work the rest of `docs/wrangler-backlog.md` / `JacTec-handoff/JAC-BUILD-LIST.md` (the master
   build list) for anything still unchecked.

## How to work here (gotchas that cost time)

- **Design language:** every new/changed UI goes through the **yard data-plate** language (see
  `CLAUDE.md` + the `frontend` skill): hazard stripes, rivets, Saira Condensed stamps, safety-orange
  `--accent`, light ranch twist. Screenshot + self-critique before showing Jac.
- **Gates (must pass before push):** `node ci/smoke.mjs` · `node ci/logic-test.mjs` ·
  `node ci/gen-rule-usage.mjs --check`. Regenerate `rule-usage.js` (drop `--check`) only when
  `data-r` usage actually changes.
- **Deploy:** `git push origin HEAD:main` ships live; also open a **draft PR** for the record. `main`
  is gate-protected (the `smoke` check) and PRs auto-merge on green via the Wrangler engine.
- **Headless testing the real app:** boot offline with the `#local` hash (renders from `data.js`,
  no backend) and drive it with Playwright. Serve over **HTTP** (e.g. `python3 -m http.server`) —
  `file://` blocks the ES-module load via CORS. Launch with
  `chromium.launch({args:['--ignore-certificate-errors']})` + `newContext({ignoreHTTPSErrors:true})`;
  the font/Stripe cert warnings and the `dev-version.txt` 404 are environmental, not bugs.
  `window.__rw` exposes a read-mostly logic API (and `DATA`/`IDX`) in `#local` only.
- **Playwright vs clasp conflict:** they're installed `--no-save` and evict each other
  (`npm install` for one prunes the other). Reinstall what you need + `npx playwright install chromium`.
- **The R-Rulebook:** UI is stamped `data-r="Rxx"`; rules live in `RULE_META`/`CLASS_RULE` in
  `app.js` and §1 of the SPEC. Bespoke timeline controls (the `disp-*` dispatch elements, incl. the
  new route arrows) are intentionally **not** stamped.

## Backend (Mr. Wrangler — Apps Script)

- `backend/` is **gitignored and never served by Pages** — never commit it (it holds
  `DEFAULT_CONFIG` with real passwords). It's present locally for clasp.
- clasp is wired: `clasp pull` → edit → `clasp push` → `clasp deploy -i <deploymentId>` (keeps the
  same `/exec` URL). Re-auth each session (`clasp login --no-localhost`) — creds are ephemeral.
- Secrets (`STRIPE_SECRET`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`) live **only** in Script Properties.
- Actions live: `wranglerFile`, `wranglerRequests`, `wranglerApprove`, `wranglerDismiss`,
  `wranglerReply_` (accepts image content blocks + an allowlisted model). Deployed `@16`.

## Security note (not blocking)

The `GITHUB_TOKEN` that was pasted into chat earlier is a **known-leaked** credential (fine-grained
PAT, scoped to this one repo: Contents/PRs/Issues RW). Nothing breaks if it isn't rotated — it's a
hygiene call. To stop the churn for good: keep the token **out of chat** (paste it straight into the
GitHub Actions secret `WRANGLER_PAT` and the Apps Script Script Property `GITHUB_TOKEN`), use a
narrow long-expiry PAT, or run `/install-github-app` so the engine uses the Claude GitHub App token
and there's no PAT to mint at all.

## Don'ts (from CLAUDE.md)

- Never put the model identifier, secrets, or `DEFAULT_CONFIG` passwords in the repo (it's public).
- Changing a WO part/task line to Complete must **not** complete the work order — only the blue
  **Complete WO** button does.
