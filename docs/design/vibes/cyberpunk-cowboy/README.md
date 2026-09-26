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
