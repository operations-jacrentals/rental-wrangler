# Tier 0.1 card — the live, editable card

**This folder is the working card.** `../tier-01-handoff/final-card.html` remains the archived
original and should not be edited.

## What happened

`final-card.html` is a self-extracting artifact bundle: the real source sits gzipped and
base64'd inside a `__bundler/manifest` script tag, with a boot template alongside it. In that
form the card can't be edited, diffed in a PR, or served — which blocks both building decisions
into it and letting an outside model click through it for an audit.

This folder is that bundle unpacked, with the UUID-named payloads given readable filenames and
the references rewritten to match.

| File | What it is |
|---|---|
| `index.html` | The card — markup, inline styles, and the card's own script (~1.8k lines) |
| `dc-runtime.js` | The component runtime the card is built on (generated; do not edit) |
| `react.production.min.js` · `react-dom.production.min.js` | Runtime harness dependencies |
| `rw-namespace.js` | Namespace shim; states that Rental Wrangler is a CSS/token system with no importable React components |
| `steel-texture.png` | 384×384 brushed-steel texture, used as `background-image` on chassis and plates |
| `archivo-latin.woff2` · `archivo-latin-ext.woff2` | Bundled Archivo (variable, 400–800) — bundled rather than CDN-linked so the body voice survives a sandboxed render |

`window.__resources` is injected in `<head>`, mapping the two CDN URLs to the local copies —
`dc-runtime` resolves React through that map, which the outer bundler used to supply.

## Serving it

Any static server rooted at this folder. It is entirely self-contained; nothing is fetched
from the network.

```
node <your-static-server>.mjs   # root = this folder, port 9147 (8000 is reserved)
```

## Verified

Rendered headlessly against the unpacked folder and against the original bundle through an
identical harness. Output is **identical** — same text, same 162 divs, same 25 buttons, no
failed requests.

**One known difference.** The unpacked copy logs two non-fatal SVG warnings the bundle does
not:

```
<path> attribute d: Expected moveto path command ('M' or 'm'), "{{ p.icon }}"
<path> attribute d: Expected moveto path command ('M' or 'm'), "{{ c.icon }}"
```

Cause: the bundle materialised its markup detached (via `DOMParser`) before the runtime
substituted the template expressions, so the browser's SVG parser never saw them. Served
directly, the parser reads `d="{{ p.icon }}"` during the initial parse and complains, then the
runtime substitutes it correctly a moment later. **Rendered output is unaffected** — but these
two lines should go on the audit's ignore-list so they aren't reported as defects.

## Stack note

The card is a component class on `dc-runtime` + React, **not** vanilla JS — so it is not
directly portable into `app.js`, which is vanilla. Porting is Tier 2 work; this folder exists
so the design can be built out and audited first.
