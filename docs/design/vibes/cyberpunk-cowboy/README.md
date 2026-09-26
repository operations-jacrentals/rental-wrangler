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

## Round three: the world out back

Jac: *"I want a 3D world behind my container cards that changes as I interact in the app."*

A Three.js scene (pinned r128 build from the CDN, no bundler) renders behind every card;
panels are translucent with a backdrop blur so the street ghosts through. The scene is
Neon Gulch's main street: saloon with a neon sign and lit windows, notice board, corral
with crates and a flatbed, your rig on a charging cable, water tower, windmill, antenna
beacon, mesas, a distant neon skyline, stars, moon or sun, drifting dust.

What your actions do out there:

| You | The world |
|---|---|
| Move between pages | The camera rides to a new vantage: the porch, the notice board, the corral, the rig, the sky, the water tower |
| Jack in / ride off | The saloon sign buzzes on / the street goes dark |
| Post a bounty | A poster gets nailed to the notice board (open bounties = posters) |
| Claim a bounty | A rider gallops through town |
| Mark a bounty done | The saloon flashes |
| Move Corral cards | Crates move between pens; shipped crates stack on the flatbed |
| Plug in the rig | The cable and charge strip glow; headlights brighten as charge climbs |
| Play the jukebox | The saloon windows pulse to the beat |
| Uplink latency | The antenna beacon goes green, yellow or red and blinks faster; the neon flickers when the wire is bad |
| Storm advisory (bell) or the weather chip | A dust storm rolls in: wind, fog, windmill spins up |
| High Noon | Sun, sand, shadows; neon and stars off |
| Accent picker | The neon sign changes colour |
| Onboarding rig choice | The parked rig changes shape (Mustang, Iron Mule, Ghostwire) |

Idle: the windmill turns, dust drifts, the beacon breathes, the camera sways with the mouse.
Respects reduced-motion (no sway), pauses when the tab is hidden, and has an off switch in
the Rig. If the CDN build cannot load, the page falls back to the flat gradient.

## Round four: the fleet

Jac: *"Can you include a fleet of excavators, scissor lifts, skid steers, and light towers?"*

A rental yard east of the notice board (the Rig page's camera looks over it): three
excavators, three skid steers, three scissor lifts and four light towers, all low-poly
box-and-cylinder builds with the right silhouettes (tracks and a slewing house with boom,
stick and bucket; a crossed-arm scissor stack under a railed platform; a compact loader with
lift arms and a bucket; a trailer with a mast and a four-lamp head).

| You | The fleet |
|---|---|
| Night / High Noon | Light towers switch on and light the yard / switch off |
| Storm | Tower lamps flicker; scissor lifts drop to the deck for safety |
| Claim a bounty | A skid steer rolls out of its slot, up to the street and away east, then returns to its slot |
| Mark a bounty done | Every excavator slews and digs a cycle |
| Jukebox | Scissor platforms bounce to the beat |
| Idle | Booms sway, lift arms bob, platforms cycle slowly up and down |
