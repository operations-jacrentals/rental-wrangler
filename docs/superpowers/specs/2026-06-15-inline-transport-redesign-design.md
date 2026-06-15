# Inline Transport Redesign — design spec

**Date:** 2026-06-15 · **Branch:** `claude/mr-wrangler-ox71bk` · **Status:** approved (Jac, via pop-up)

Replaces the popup-driven Transport·Site flow with an inline, per-unit transport
editor; the Jac—Site—Jac journey becomes the interactive control; pricing moves
from the city-tier table to a real per-mile formula driven by Google drive
distance/time.

## Goals (from Jac)

1. **+Transport is its own blue R5b button** under **+Unit** in the rental card's
   left action column — de-fused from the combined "+Invoice/+Transport" button
   (which becomes just **+Invoice**).
2. **No popup.** Address is entered inline: a **minimap above** the field, a
   **Google-style typeahead** below it, **keyboard navigable** (↑/↓/Tab/Enter).
   The **one-way price** shows on the section's right side, above "X min /one-way".
3. The +Transport action **builds the Jac—Site—Jac journey**. The journey is the
   control surface: click **Jac→Site / Site→Jac / Jac→Site→Jac** to set the type;
   the entered address renders on the relevant leg(s). Round-Trip shows delivery
   address outbound and recovery address inbound — **both editable, may differ**.
   Address edits **cascade to price + invoice** and onto the **unit cards**.
   Multi-unit rentals support **per-unit, multi-transport**.

## Pricing (replaces config.js `lookupTransport`/city-tier)

Per unit, per transport:

```
legs   = Round-Trip → 2 ; Delivery|Recovery → 1 ; Self|none → 0
fueled = /diesel|gas|gasoline|petrol|propane|lp/i.test(category.fuelType)   // Electric/battery/empty → false
perLeg = 3.50 * oneWayMiles + 50 (load) + (fueled ? 20 : 0) (fuel)
price  = perLeg * legs
driveMin = Google one-way duration (yard → site)
```

- Unlimited-transport members → `price = 0` (existing perk preserved).
- `oneWayMiles` + `driveMin` come from Google Distance Matrix (origin = the
  JacRentals yard, Sulphur LA) and are **cached on the unit entry at save time**,
  so render/billing never calls Google and `ci/logic-test.mjs` stays deterministic.
- Pure, testable: `computeTransportPrice({ type, oneWayMiles, fueled, unlimited })`.

### Fallback (no key / offline / CI)

If Google is unavailable and no cached miles exist, fall back to the legacy
city-tier `TRANSPORT_MAP` so seeded demo rentals still show a price and the
smoke gate still boots. Real Google auto-engages once a key is present.

## Data model (per unit-entry `eu`, mirrored to rental for the primary)

Add: `transportMiles`, `transportDriveMin`. `sitePin` becomes `{lat,lng}`
(back-compat read of the old `{x,y}` mock — treated as unset).

## Google integration (key-based, key never in repo)

- One **referrer-restricted** browser key (restricted to `app.jacrentals.com`)
  powers Maps JS + Places Autocomplete + Distance Matrix.
- Fetched at runtime from the backend via `backendCall('getConfig')`
  (Script Property `GOOGLE_MAPS_KEY`), mirroring the Stripe publishable-key
  pattern (app.js:7576). Maps JS `<script>` is injected dynamically — no key in
  `index.html`/`config.js`.
- **Owner provisioning checklist** (delivered with the PR): create Google Cloud
  project → enable Maps JavaScript API + Places API + Distance Matrix API →
  create an API key restricted by HTTP referrer to `app.jacrentals.com/*` and by
  API to those three → set Script Property `GOOGLE_MAPS_KEY` → paste the provided
  `getConfig` `Code.gs` snippet.

## UI build (frontend skill — yard data-plate language)

- **Action column** (app.js ~2734): Customer · Unit(s) · **+Transport (R5b)** ·
  **+Invoice** · +PO. Once transport exists, the slot shows a compact
  type+price summary chip; the full journey renders in the Transport section.
- **Inline editor** (replaces the `site` overlay ~4740 + `saveSiteAddress`):
  expands in place. Minimap (Google) on top; address input; suggestion list
  below with roving-tabindex keyboard nav. Selecting a result geocodes, recenters
  the map, drops the exact draggable pin, and caches miles/driveMin.
- **Journey** (`miniJourneyHtml` ~2576): inline type segments; per-leg inline-
  editable addresses; per-unit; one-way `$` on the right `.side` above the min.
- **Unit-card cascade:** the per-unit journey (R15) already reads `eu`, so it
  inherits the new editor/types/pin automatically.

## Gates / safety

- Defensive boot: missing Maps/Places/key → mock fallback; app still boots.
- `node ci/smoke.mjs`, `node ci/logic-test.mjs` (+ new pricing tests),
  `node ci/gen-rule-usage.mjs` (regenerate) all green before push.
- Money flag honored: pricing change is an explicit owner decision.
</content>
</invoke>
