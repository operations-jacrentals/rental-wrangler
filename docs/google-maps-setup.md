# Going live: Google Maps for transport (owner one-time setup)

The inline transport editor (minimap + address autocomplete + drive-time pricing)
ships **working today** in offline/mock mode — a placeholder map and the built-in
city list. To turn on the **real** Google map, address autocomplete, and accurate
drive-distance pricing, do this once. Nothing here puts a key in the public repo.

## 1. Create the key in Google Cloud (~5 min)

1. Go to <https://console.cloud.google.com/> → create (or pick) a project.
2. **APIs & Services → Library** → enable all three:
   - **Maps JavaScript API**
   - **Places API**
   - **Distance Matrix API**
3. **APIs & Services → Credentials → Create credentials → API key.**
4. Click the new key → **Restrict** it (important — this is what makes it safe to
   serve to browsers):
   - **Application restrictions → Websites** → add referrers:
     `https://app.jacrentals.com/*` (and `http://localhost:*/*` if you test locally).
   - **API restrictions → Restrict key** → tick the three APIs above.
5. Make sure **Billing** is enabled on the project (Google requires it; the free
   monthly credit covers a yard's volume comfortably).
6. Copy the key (`AIza…`).

## 2. Store the key in the backend (never the repo)

In the Apps Script project (the same one that holds the Stripe secret):

- **Project Settings → Script Properties → Add property**
  - Name: `GOOGLE_MAPS_KEY`
  - Value: the `AIza…` key

## 3. Serve it to the app — paste into `Code.gs`

The frontend calls `backendCall('mapsKey')` and expects `{ ok: true, key }`.
Add this `mapsKey` case to the action router in `Code.gs` (alongside the existing
`stripePubKey` handler), then redeploy the web app:

```js
// --- Google Maps browser key (referrer-restricted; safe to serve to the client) ---
case 'mapsKey':
  return json({ ok: true, key: PropertiesService.getScriptProperties().getProperty('GOOGLE_MAPS_KEY') || '' });
```

(`json(...)` is the existing helper that returns a `ContentService` JSON response —
mirror however `stripePubKey` already returns. No password gate is needed: the key
is referrer-locked, so it's only usable from `app.jacrentals.com`.)

## 4. Done

Reload the app. Open any rental → **+Transport**: you'll get the live Google map,
real address autocomplete, and pricing computed from Google's actual one-way drive
distance — `$3.50/mile + $50 load + $20 fuel (per leg)`. Until the key is live the
editor keeps working in mock mode, so nothing is ever broken.

### How pricing uses the key

On save, the chosen address is geocoded to lat/lng and the **one-way driving miles
+ minutes** are fetched once (Distance Matrix) and **cached on the rental/unit**.
Pricing and invoicing then read the cached numbers — Google is never called during
render or billing, so it stays fast and the CI logic suite stays deterministic.
</content>
