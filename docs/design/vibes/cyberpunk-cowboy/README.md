# Neon Gulch — a cyberpunk-cowboy UI sandbox

**Throwaway.** This folder is a vibe test, not product work: one self-contained page
(`index.html`) that dresses every common app pattern in a single personality so the
look, voice and feel can be judged side by side. It does nothing real. It is not wired
to the Rental Wrangler app, its tokens, its rulebook, or the decisions ledger, and it
must not be promoted to production.

Open `index.html` in a browser. Any handle and passkey signs you in. The page keeps
its own theme, accent and sign-in state in `localStorage` only.

## What's in the box

| Pattern | Where |
|---|---|
| Sign-in (validation, show/hide, remember me, social buttons) | first screen |
| Three-step onboarding wizard | after first sign-in |
| App shell: sidebar, top bar, breadcrumbs, status bar, mobile drawer | everywhere |
| Dashboard: stat tiles with sparklines, bar chart with hover, feed, leaderboard, progress ring, weather | Overwatch |
| Data table: search, filter chips, sortable columns, row selection, bulk bar, pagination, row menu, empty state | Bounty Board |
| Kanban with drag-and-drop (and a touch-friendly move menu) | Corral |
| Chat: channels, thread, composer, typing indicator, reactions | Saloon |
| Calendar month grid, day detail, native date picker, add event | Almanac |
| Profile card, tabs, forms, file dropzone, password strength, 2FA switch, sessions | Wanted Poster |
| Settings: theme toggle, accent picker, effects, switches, plans, integrations, API key, danger zone | Rig |
| FAQ accordion, shortcut list, changelog drawer | Help |
| Command palette (⌘K), toasts with undo, modals, confirm-with-typed-name, tooltips, consent banner, 404, skeleton loading, fake jukebox with a WebAudio synth | global |

## Personality notes

- Two worlds, one page: **Night** (neon tubes over desert-dark indigo) and **High Noon**
  (sun-bleached paper, rust ink). The switch is in the top bar and the Rig.
- Type: Rye for the display voice, Chakra Petch for reading, Share Tech Mono for
  stamped labels and data. Icons come from Lucide at runtime (pinned CDN build).
- One accent at a time. The accent picker swaps it live so its weight can be judged.
- Status never rides on colour alone: chips carry an icon and a word; the day palette
  uses tinted fills with dark ink. Contrast and colour-blind separation were checked
  numerically before the palette was locked.

## Round two (Jac's picks: louder western, louder cyberpunk, new default accent, deeper dashboard)

- **Default accent is now sunset amber**, orange against the cyan uplink. Magenta stays as a
  fixed "hot" state colour (riding, hot cards). All four accents remain in the Rig picker.
- **Louder cyberpunk**: periodic glitch on the wordmark with chromatic fringing, HUD corner
  brackets on every panel (cyan on the featured ones), a neon rail across the top bar and
  status bar, heavier scanlines with a slow CRT sweep, mono data readouts in panel headers
  that carry real totals.
- **Louder western**: panel titles in Rye, wanted-poster frames as a panel variant, rope
  dividers, a circle-bar brand mark on every eyebrow, and more ranch voice ("Corral by",
  "Round up the ledger", "Nail it up", "On the wire", "trail 1 of 2").
- **Dashboard deep pass**: a filter row (7 / 14 / 30 / 90 day range, sector) that drives a
  seeded 90-day series; the bar chart got a table view; new line-and-area latency chart with
  a crosshair and a threshold band; a bounties-by-status donut with a hover-linked legend; a
  scrip-by-sector bar list that sets the sector filter; richer stat tiles (goal bar, risk
  mini-bars, crew presence dots, p95 readout).
- The status palette was re-searched numerically around the new accent so every co-occurring
  pair clears the colour-blind floor; day-mode info and hot chips became fills like the rest.
