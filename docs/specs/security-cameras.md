# Security Cameras — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/security-cameras`
**Task branch:** `security-cameras/spec` (proposed)
**Maturity:** ⬜ Greenfield (nothing built — this spec proposes the whole area from the existing maps/GPS/backend spine)
**Scope:** Embed and surface live + recorded yard/property camera feeds inside Rental Wrangler so staff can watch the lot, verify a unit's position before/after a haul, and pull footage for an incident — without leaving the app or logging into the NVR's own console.

## ✅ Decisions — 2026-06-29 critique (Jac)

- **D1 — Streaming protocol stays provider-agnostic (hardware TBD).** The NVR/camera brand isn't chosen yet, so the spec must NOT hard-pick HLS-restream vs WebRTC vs vendor-embed. Model the stream layer as a **pluggable broker**: GAS exposes `cameraLive` which returns a short-TTL, server-signed playback descriptor `{ kind: 'hls'|'webrtc'|'embed', url, expiresAt }`; the front-end picks the player by `kind`. Real NVR credentials/host live in **GAS Script Properties (named-only)** and never reach the browser. Decide the concrete transport when the hardware is bought; nothing else in the spec depends on which one wins.
- **D2 — Per-camera visibility configured in Settings (not a flat tier floor).** Each `cameras[]` record carries a visibility config: which **tiers** and which **yards** may view it (e.g. gate cam = all staff, office/interior cam = admin-only). The camera wall renders only the cameras the current login is allowed to see. Manager+ still gates recorded playback/export; Admin gates config. This is stricter-where-it-matters and open-where-it-helps, matching the GPS "coords open to all staff" instinct without exposing interior/office cams to everyone.
- **D3 — Record video + audio; 90-day retention on Google Drive.** Capture **audio as well as video** (Jac's call — accept the one-party-consent posture for LA; surface a "this property is under audio/video surveillance" signage note in the rollout checklist). Recorded footage is archived to **Google Drive** (reuse the existing inspection-evidence offload spine) with **~90-day retention**, after which un-pinned footage rolls off.
- **D4 — Clip-capture pins to records; export is Admin-only, default-off, audit-logged.** Manager+ can grab a clip from live/recorded and **pin it to a unit / WO / dispute record** (same pattern as the per-record photo capture today); pinned clips survive the 90-day rolloff. **Exporting/downloading footage off-platform is Admin-only, default-off, and audit-logged.**

---

## 1. Goal & Problem

**What this area is for.** JacRentals runs a physical yard in Sulphur, LA full of six-figure machines that come and go on trucks all day. There are (or will be) IP cameras / an NVR (network video recorder) watching the gate, the lot, the wash bay, and the shop. Today that footage lives in a *separate* vendor app or a wall monitor in the office. **Security Cameras** is the area that pulls those feeds **into** Rental Wrangler so the people already living in this app — office, manager, owner — can:

1. **Watch the yard live** — a wall of camera tiles on one board, the "is the gate clear / who just pulled in" glance.
2. **Tie video to records** — verify a unit is actually on the trailer before "On Rent", confirm a machine is back in its stall before "Returned", or grab a clip when a customer disputes damage.
3. **Pull recorded footage for an incident** — scrub to a timestamp (a return, a theft, a wash) and capture a still or a clip onto the relevant record's History.

**The business/user problem.** Surveillance currently means a second login, a second app, and a second screen. The footage is *near* the work but never *on* the work — the person disputing a damage WO is in Rental Wrangler; the camera that would settle it is on a different monitor. Asset protection (theft, after-hours intrusion, unauthorized unit moves) is reactive and disconnected from the live yard the app already models.

**Why it matters.** A single recovered clip can settle a customer-damage dispute (a billable WO), prove a unit left the yard at a certain time, or catch a theft early. The app **already mounts maps, already knows where each unit sits, already has a GPS/stray spine being built** (`gps-tracking`) — adding the camera layer makes "where is it / what happened to it" answerable with *video*, not just a dot.

**North star.** *Open one board and see the yard live; click any unit, return, or incident and jump to the camera that was pointed at it, at the moment it happened — all inside the app, with the NVR credentials never leaving the server.*

This is a **Want** (tier), priority **#20** — real value but gated on (a) an external NVR/camera integration we don't control, (b) the maps/GPS spine landing first, and (c) hard streaming/performance/security constraints in a **public-Pages** SPA. The spec phases deliberately so Phase 1 ships a useful live wall without recording-scrub, clip storage, or per-unit camera mapping.

---

## 2. Current State (Baseline) — greenfield

**Nothing for surveillance exists.** Stated plainly so the critique starts from truth:

| Concern | Today | Anchor |
|---|---|---|
| Any camera **stream** (RTSP/HLS/WebRTC) | **None.** No stream URL, no `<video>` of a feed, no NVR client. | — |
| NVR / camera-vendor integration | **None.** `backendCall` has Stripe / maps-key / membership / wrangler / config / GPS(proposed) actions — **nothing for video**. | `app.js:14811` (`backendCall`) |
| The only "camera" code | The **device-camera** selfie/inspection capture (`startAgCam`, `getUserMedia({facingMode})`) — captures a still from the *operator's own webcam/phone* for an agreement selfie or inspection evidence. **This is document capture, not surveillance.** | `app.js:11037` (`startAgCam`), `app.js:11055` (`captureAgSelfie`) |
| Inspection evidence photos/video | Checklist items + walkaround capture images/video via file-input/`getUserMedia` and offload to Drive. Surveillance is unrelated but **the capture/offload plumbing is reusable** for "save this still to a record". | `app.js:9577` (checklist `file` item), `2026-06-26-inspection-evidence-capture-design.md` |

**Adjacent code this area MUST build on (do not reinvent):**

| Spine piece | Where | Why it's the foundation |
|---|---|---|
| Maps loader + mount pattern | `loadGoogleMaps()` `app.js:1313`, `mapsReady()` `app.js:1345`, `_teMap`/`_dispMap` mounts | The yard map a camera wall can pin cameras onto; the graceful "external thing failed, don't crash the mount" model. |
| `YARD_CENTER` | `app.js:1346` `{lat:30.2366,lng:-93.3774}` | The yard the cameras watch; where camera pins anchor on a map view. |
| `backendCall` entry point | `app.js:14811` (`APP-38 · §18b`) | The **single** additive GAS action surface. All NVR/stream-URL brokering rides here, server-side, so credentials never reach the browser. |
| Overlay / popup engine + `WINDOW_CATALOG` | `renderOverlay` `APP-26 app.js:8673`; catalog `app.js:9796` | A new "Cameras" board is a popup window; every popup is catalogued (CI-gated). |
| Settings → Integrations stub | `app.js:3415` (`{ id:'integrations', … 'secrets stay server-side' }`) | **Note-only today.** The same panel that `gps-tracking` proposes to build — cameras add a sibling card here. |
| Role tiers + gates | `ROLE_TIERS`/`tierRank` `config.js:326`, `canMoney()` `app.js:14166`, `roleTier()` `app.js:13060`, `adminUnlocked()` `app.js:13071` | Camera access is a *visibility* gate (money/manager/admin floors), not a money gate — but it reuses the tier-comparison machinery (`tierRank(role) >= tierRank(X)`). |
| Inspection-evidence capture + Drive offload | `2026-06-26-inspection-evidence-capture-design.md`, `uploadCapture` (`backendCall`, `app.js:7816`) | "Save this frame to the record" reuses the existing image-offload-to-Drive path, not a new store. |
| GPS/Tracking spine (sibling, in progress) | `docs/specs/gps-tracking.md` | Establishes the *exact* pattern this area follows: a server-side external feed, an Integrations panel, a manager board, secret-by-name handling, and a Tracking/board popup. **Cameras is the video cousin of GPS.** |

---

## 3. Users, Roles & Data Gates

Roles are customizable; gates compare **tiers** (`tierRank`), **never role names**. The shipped roles map to tiers via `settings.roleMeta` (default ladder `staff < money < manager < admin < developer`). The same machinery the rest of the app uses applies here: `roleTier(currentRole)` (`app.js:13060`) resolves a role to its tier rank, `canMoney()` (`app.js:14166`) is the money floor, `adminUnlocked()` (`app.js:13071`) the admin floor. **Surveillance is a *visibility* gate, not a money gate** — it reuses the tier-compare, but it touches **none** of the pricing-floor machinery.

**The cardinal rule (mirrors the GPS spec, `gps-tracking.md` §3):** *Read gates are UI-conditioned (front-end hide/show); every WRITE, broker, and footage-access gate is ENFORCED server-side.* A hidden board button is **not** a security boundary — the corresponding `cameraLive`/`cameraRecorded`/`cameraCapture`/`cameraConfig` action **re-checks the session password's tier server-side** and refuses below floor. Defence-in-depth: the front-end hides what you can't use; the server enforces what you can't do.

| Role (default tier) | Camera access (proposed, conservative) |
|---|---|
| **Mechanic / M.Tech / Driver** (staff) | **None by default.** Surveillance of the lot is an asset-protection / management tool, not an operational one. No board entry, no per-record camera surface, no capture. *Possible exception:* a driver loading a trailer might want the gate cam — surfaced as **Open Q §11.4** rather than silently granted. |
| **Office / Sales** (money) | **Live wall + per-record "jump to camera"** for operational verification (is the unit loaded / back) **+ capture-still-to-record**. **No** recorded-footage scrub or export by default — pulling *old* footage is an investigative act. → Open Q §11.5. |
| **Manager / Admin / Owner** (manager/admin) | **Full:** live wall, recorded scrub, still/clip capture-to-record, the camera↔location/unit mapping, footage **export/download**, and the Integrations health/config panel. |
| **Developer** | Same as admin + the Rulebook/Inspector dev tools (no extra camera power). |

### 3.1 Per-capability gate table (the enforceable contract)

Every row is a **tier compare** (`tierRank(role) >= tierRank(X)`), never a name match — a renamed/custom role inherits the gate by its mapped tier. **Enforced** = the server action re-checks; **UI** = front-end hide only (no server secret behind it).

| Capability | Floor (proposed) | Where enforced | Why |
|---|---|---|---|
| See that the Cameras board exists (Tools-tray entry) | money | UI | Below the floor sees no entry at all. |
| `cameraList` (roster + health, **no URLs**) | money | **Enforced** | A roster reveals what's watched; gate it even though it carries no stream. |
| `cameraLive` (broker a live view URL) | money | **Enforced** | Live viewing = operational verification. |
| `cameraCapture` (still-to-record) | money | **Enforced** | A still on a load-out/return is operational evidence. |
| `cameraRecorded` (broker recorded playback) | manager | **Enforced** | Pulling history is investigative — higher bar. |
| Footage **export / download** off a record | manager | **Enforced** | Exfiltrating people-in-frame footage is the highest-sensitivity act. → Open Q §11.6. |
| `cameraConfig` / registry edit / `homeCameraId` mapping | admin | **Enforced** | Config writes the broker target & roster. |
| `cameraTestConn` (reachability probe) | admin | **Enforced** | Touches the integration; never echoes host/token. |
| See the NVR host / username / password / provider token | **nobody** (server-only) | n/a | Never in a payload, never echoed by any action (§5). |

**Hard gate decisions (surfaced, not silently chosen):**

- **The camera board itself is tier-gated.** Default floor = **money** for *live* viewing + capture, **manager** for *recorded* viewing + export, **admin** for config. This is a deliberately conservative split; the exact floors are **Open Q §11.5**. When in doubt the spec **gates UP** and asks, never down.
- **No money/pricing-floor interaction — and none introduced.** Cameras surface no `bottomDollar`/margin/cost/pricing data, so the money/pricing-floor gate (`canMoney`) is *not* loosened or touched. A captured still attached to a *billable* WO is just an image on a record — it carries **no** pricing, never auto-sets `billCustomer`, never auto-completes a WO (§7.4, honors the "Don't" list). The `money`-tier floor on `cameraLive` is a *visibility* reuse of the tier ladder, **not** a money-action grant.
- **Customer-isolation / PII.** Camera footage **incidentally captures people** (drivers, customers, members of the public on the street) and **reveals which customer was physically at the yard, when**. That makes raw footage *more* sensitive than the records it attaches to. Mitigations, all conservative:
  - v1 is **internal-only** — no customer-facing "watch your pickup" link, no per-customer footage surface (explicitly out of scope, Open Q §11.9). A customer-facing URL would be a far larger attack surface and is deferred wholesale.
  - A still/clip **captured to a record** inherits that record's existing isolation (it's an image on the rental/WO, governed by the same visibility that record already has).
  - **Raw live/recorded brokering is never customer-scoped** — there is no "this customer's camera." A camera watches the *yard*, not a customer; so footage access is gated purely by staff tier, never exposed through any customer-facing surface.
  - **Retention + who-can-export** is a sensitivity call → Open Q §11.6. **Audio is out of scope entirely** (two-party-consent / wiretap exposure) → Open Q §11.6.
- **Audit (the accountability gate).** Every `cameraRecorded` brokering, footage export/download, and capture-to-record is **`logAction`-stamped** (who · when, `logAction` pattern used throughout `app.js`) on the relevant record, and — proposed — mirrored into a dedicated `cameraAudit` log so "who pulled the gate footage for Jan 3, and did they download it" is answerable independent of any single record. *Live* viewing is high-volume and optionally un-logged; *recorded* + *export* are always logged. Shape (standalone log vs. record-only lines) → Open Q §11.7.

---

## 4. Data Model

Schema-less Sheets + `data.js`-shaped objects; all fields **additive** (a missing field reads as "no cameras configured" and the app behaves exactly as today).

### 4.1 New entity: `cameras` (a small registry, like `categories`)

Lives in `DATA.cameras` (new `data.js` array → new Sheet tab `cameras`), indexed in `IDX.camera` (mirror the existing `IDX.unit` pattern, `APP-03 app.js:78`).

| Field | Type | Source | Notes |
|---|---|---|---|
| `cameraId` | string PK | seed / admin | e.g. `CAM01`. The join key. |
| `name` | string | admin | "Gate", "Wash Bay", "Lot North", "Shop Bay 2". Stamped label. |
| `area` | enum | admin | `gate` \| `lot` \| `wash` \| `shop` \| `office` \| `perimeter` — for grouping the wall + the saddle-stitch section heads. |
| `nvrChannel` | string | admin | The NVR-side channel/device id. **The join key to the broker** — never a stream URL, never credentials. |
| `enabled` | bool | admin | Off = hidden from the wall (decommissioned / temporarily down). |
| `lat` `lng` | number? | admin | Optional pin on the yard map view (so a camera shows *where it points*). Null = not mapped. |
| `heading` | number? (deg) | admin | Optional cone-of-view direction for the map pin. |
| `recordedCapable` | bool | admin | Does this channel have NVR recording (scrub-able) vs. live-only? |
| `online` | bool | **server-set** | Last health poll said the channel was reachable. Drives the red/green flag. |
| `lastSeenTs` | ISO/epoch | **server-set** | Last successful health check. Null until first poll. |
| `sortOrder` | number? | admin | Wall ordering. |

> **No stream URL, token, NVR host, or password ever lives in `cameras` / `data.js` / the Sheet.** The repo is public via Pages. `nvrChannel` is an opaque channel id; the **broker action** resolves it to a *short-lived* stream URL server-side at view time (§5).

### 4.2 New optional fields on existing entities (additive, all default-absent)

| Entity | New field | Type | Meaning |
|---|---|---|---|
| **Unit** (`DATA.units`) | `homeCameraId` | string? | The camera whose view best covers this unit's home stall — powers "jump to the cam pointed at U004". Blank = none. |
| **Rental** (`DATA.rentals`) | `clips` | array? | `[{ url, thumb, ts, cameraId, by, kind:'still'\|'clip' }]` — footage captured **to this record** (e.g. the trailer at load-out). Stored via the existing Drive offload, not a new media store. |
| **Work Order** (`DATA.workOrders`) | `clips` | array? | Same shape — a damage-dispute still attached to a billable WO. |
| Any record's `actions[]` | (existing) | — | A capture/scrub-export appends a `logAction` line ("Footage captured · Gate · 2:14 PM"). `logAction(rec, msg)` is the standard audit-line helper used throughout `app.js` (e.g. `app.js:401`, `app.js:1572`); it stamps who·when onto the record's history. |

### 4.3 Config (in `config.js`, hardcoded defaults — no runtime UI v1)

```js
// config.js — additive
export const CAMERA_CFG = {
  enabled: false,          // master off until Jac wires the NVR (demo/Pages safe)
  provider: '',            // 'reolink' | 'hikvision' | 'unifi' | 'rtsp-generic' (label only; adapter lives server-side)
  healthMinutes: 5,        // server health-poll cadence
  liveProtocol: 'hls',     // 'hls' | 'webrtc' | 'mjpeg' — how the broker hands the browser a live view (Open Q §11.1)
  clipRetentionDays: 30,   // how long the NVR keeps recordings (informational; the NVR enforces it)
};
export const CAMERA_AREAS = ['gate','lot','wash','shop','office','perimeter'];
```

### 4.4 Status / flag wiring (reuse the flag engine, zero new color code)

A new `STATUS.cameraStatus` map in `config.js` (mirror `gpsStatus`, `config.js:145`) so the camera tile pill flows through the **existing** flag-color engine (`APP-11 app.js:3700`):

```js
cameraStatus: {
  'Online':  { label: 'Online',  color: 'green'  },
  'Stale':   { label: 'Stale',   color: 'yellow' },  // missed last health poll
  'Offline': { label: 'Offline', color: 'red'    },
}
```

Derived server-side from `online`/`lastSeenTs` age (§7.1) — the tile dot is **truthful** with no per-tile color logic.

### 4.5 Migration concerns

- **Additive only.** No camera fields → app behaves exactly as today (Integrations note stays note-only, no board entry, no map pins).
- **Seed data must stay fictional and credential-free** — demo `cameras` rows carry only `name`/`area`/`nvrChannel:'demo-ch-1'`, `enabled:true`, and **no** real coordinates beyond the existing fictional yard center. **No real NVR host, channel, or any frame of real footage in the repo/seed.**
- **`homeCameraId` on units** is opt-in; absence = "no jump target", never an error.

---

## 5. Backend / Integration Contract

All NVR access is **server-side only**, **additive** on the single `backendCall` entry point (`backendCall` is defined at `app.js:15650`; it is the one HTTP surface to GAS). The browser **never** holds NVR credentials or a long-lived stream URL — it asks the broker for a **short-lived, single-use** view URL at the moment it mounts a tile.

### 5.1 Proposed additive GAS actions

Every action's `Auth` column is a **server-side** check inside the GAS handler (the front-end gate in §3.1 is *additional*, not a substitute). The handler resolves the caller's tier from the session password and refuses below floor with `{ ok:false, error:'forbidden' }` — never leaking *why* in a way that reveals the roster.

| Action | Caller | Payload | Returns | Server-enforced auth | Notes |
|---|---|---|---|---|---|
| `cameraList` | client → server | `{}` | `{ ok, cameras:[{cameraId,name,area,online,lastSeenTs,recordedCapable}] }` | session password + **tier ≥ money** | Health + roster. **No URLs, no credentials, no `nvrChannel`.** Mirrors `gpsSnapshot`. |
| `cameraLive` | client → server | `{ cameraId }` | `{ ok, url, protocol, expiresInSec }` | session password + **tier ≥ money** | Brokers a **short-lived** (e.g. 60 s) signed HLS/WebRTC URL for ONE channel. The token in the URL is ephemeral, **channel-scoped**, and **single-view**. Server maps `cameraId → nvrChannel` internally; the channel id never leaves GAS. |
| `cameraRecorded` | client → server | `{ cameraId, fromTs, toTs }` | `{ ok, url, protocol, expiresInSec }` | session password + **tier ≥ manager** | Brokers a playback URL for a time range from the NVR. Investigative → higher tier. **Logs a `cameraAudit` line** (who · channel · range · when). Range is clamped server-side to `CAMERA_CFG.clipRetentionDays` (can't request older than the NVR keeps). |
| `cameraCapture` | client → server | `{ cameraId, ts?, dataURL?, recordType, recordId, kind }` | `{ ok, fileId, url, thumb }` | session password + **tier ≥ money** (still) / **tier ≥ manager** (recorded-range clip) | Persists a still/clip via the **existing Drive offload** (`uploadCapture` path, `app.js:7816` / `13333`) and returns a stable URL to attach to a record. Reuses the inspection-evidence offload, **not** a new store. `recordType`/`recordId` let the server attach + `logAction` server-side too (defence-in-depth audit). |
| `cameraHealth` | client → server | `{}` | `{ ok, enabled, lastPollAt, channelCount, onlineCount, lastError }` | session password + **tier ≥ money** | Powers the Integrations health line. `lastError` is a **human string only** (e.g. "NVR timeout") — **never** a host, token, or stack trace. |
| `cameraTestConn` | client → server | `{ password }` | `{ ok, reachable, channelCount, error? }` | **admin** password | "Test connection" button — proves reachability **without** echoing host/token. `error` is a sanitized reason string. |
| `cameraConfig` | client → server | `{ password, config }` | `{ ok }` | **admin** password | Persist `CAMERA_CFG` + the `cameras` registry server-side (mirrors `setConfig`, `app.js:2646`). Validates: rejects any incoming field that looks like a URL/host/credential (defence against a registry row smuggling a secret into the public Sheet). |

> **Token / credential handling (same canon as Stripe / GPSWOX, `gps-tracking.md` §5).** The NVR host, username, password, and any provider API token live in **GAS Script Properties** (named secrets, e.g. `NVR_HOST` / `NVR_USER` / `NVR_PASS` / `NVR_TOKEN` — referenced **by name only** here), set out-of-band by Jac via the Apps Script console / `clasp` — **never in the repo, never in `config.js`, never in any payload, never echoed** by `cameraHealth`/`cameraTestConn`/`cameraList`. Unlike the Google Maps browser key (`backendCall('mapsKey')`, referrer-locked and *meant* to be public), NVR creds are **not** public-safe and stay server-side. The only thing the browser ever receives is an **ephemeral, channel-scoped, short-TTL, single-view** stream URL — and even that maps an opaque `cameraId`, never the real `nvrChannel`.

### 5.2 The streaming reality (the hard part — surfaced honestly)

A browser `<video>` cannot play raw RTSP (the native IP-camera protocol). Three viable shapes, **Open Q §11.1**:

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. HLS via a restreamer** | A server (the NVR itself, a small box, or a cloud relay) transcodes RTSP→HLS; the broker hands the browser a signed `.m3u8` | Plays in plain `<video>` + `hls.js`; firewalls love HTTP | ~3–10 s latency; needs a restreaming box; bandwidth |
| **B. WebRTC (low-latency)** | NVR/gateway with WebRTC (e.g. go2rtc, Frigate, UniFi Protect API) | Sub-second; true "live" | More moving parts; NAT/TURN; per-session negotiation |
| **C. NVR vendor embed** | Iframe/SDK the vendor's own player | Least work | We don't control the chrome/auth; iframe sandboxing + cross-origin pain; off-brand UI |

The spec **assumes A or B** (we control the player → yard data-plate styling) and treats the vendor as **provider-agnostic**: the GAS adapter knows the NVR; `cameraLive` returns a normalized `{url,protocol}` so swapping vendors is a server change only. **No NVR brand is hard-coded in the front-end.**

### 5.3 Failure handling (mirror the maps loader's graceful degradation, `app.js:1421`, and the GPS poll's "don't storm on provider-down", `gps-tracking.md` §5)

- **NVR unreachable / token bad** → the health poll sets `cameraHealth.lastError` (a sanitized reason string) but **does NOT mass-flip every channel to `Offline`** on a single failed *poll*: a transient NVR/network blip must not paint the whole wall red (a false fleet-wide "everything's down" storm). Instead the wall shows a **red hazard-stripe banner** "Camera system unreachable", tiles keep their last-known status until the staleness threshold (§7.1) genuinely lapses, and the next good poll heals it. **Never crash a board mount** on a dead feed.
- **One channel down, others up** → that tile is "Offline" (red), the rest play. Offline tiles sort to the top (action-needed-first, matching the flag-severity convention).
- **Stream URL expired mid-view** → the tile silently re-brokers (`cameraLive` again) on the player's `error`/`stalled` event, with **backoff** and **one in-flight broker per channel** (§7.3); a persistent failure flips the tile to "Offline" after the threshold.
- **HTTP 429 / 5xx from the NVR or restreamer** → back off (skip this re-broker cycle, retry on the next poll/interval); **never tight-loop** the NVR or relay.
- **`CAMERA_CFG.enabled === false` (demo / not wired) or no `backendPassword` (offline/demo mode)** → **no** Integrations camera card body, **no** board entry surfaced, **no** map pins, no broker calls. The app is byte-for-byte as today — identical to the GPS spec's "demo mode renders seeded data, never calls the feed" behavior.

---

## 6. UX / UI — yard data-plate language

All new UI runs through `jactec-ui` (dark steel panels `linear-gradient(180deg,#1b2129,#0c0e11)`, ONE safety-orange `--accent #ff7a1a`, hi-vis hazard stripe for danger, Saira Condensed stamped labels, corner rivets, subtle leather-tan ranch seasoning mostly in copy). **Self-critique screenshot before showing Jac** (skill quality floor). The status dot stays in the R/Y/G flag system — **orange is never a status color**.

### 6.1 NEW: Cameras board (the live wall) — popup window

A new **popup window** (its own `kind:'cameras'`), reusing the overlay engine (`APP-26 app.js:8673`) and, for the map view, `loadGoogleMaps`/`YARD_CENTER`/the `_dispMap` mount pattern (no second map stack).

- **Layout:** a responsive grid of **camera tiles** (the wall). Each tile is a **rivet-cornered steel plate**: a stamped Saira `name` + `area` header, a live `<video>` body, and a R/Y/G **status dot** (Online/Stale/Offline) from §4.4.
- **Tile chrome:** a thin hazard-stripe accent on the *Offline* tile header (danger = red hazard variant). A small leather-tan saddle-stitch divider between `area` groups (gate / lot / wash / shop) — the ranch seasoning, restrained.
- **Map toggle:** a "Wall ⇄ Map" segmented control (`segCtl`, the existing builder). Map view drops a **camera pin per mapped camera** (colored by status flag), with an optional view-cone (`heading`); clicking a pin focuses its tile.
- **Click a tile** → expands to a single large feed with: timestamp overlay, a **"Capture still"** ignition button (orange gradient, dark ink), and — **manager+ only** — a **"Recorded"** scrub control (§6.3).
- **Empty state:** no cameras configured → stamped "No cameras wired yet — add one in Settings → Integrations." Loading → skeleton steel plates. Feed error → red hazard-stripe banner (§5.3).
- **Entry point:** a "Cameras" item in the **Tools tray** (`kind:'tools'`, `app.js:9813`) and/or a header button — tier-gated (hidden below the money floor).
- **R-rulebook + catalog:** the open trigger, the Wall/Map toggle, the Capture button, and the Recorded control each need a **`data-r` stamp** (`rule-usage.js` regenerated via `ci/gen-rule-usage.mjs`, drop `--check`). The board is a **NEW WINDOW_CATALOG entry** — required by `ci/check-window-catalog.mjs`:

  ```js
  { kind: 'cameras', label: 'Camera wall', tag: 'Yard · surveillance', sample: () => ({ area: '' }) },
  ```

### 6.2 Per-record "Jump to camera" (the seam that makes it useful)

The value isn't a wall — it's *contextual* video. Additive, small surfaces:

- **Unit card** (`APP-16 app.js:4921`): if `unit.homeCameraId` is set + that camera is Online, a stamped **"View on camera"** link opens the board focused on that tile. (Mirrors the GPS-spec "View on map" pattern.) No mapping → no link, no clutter.
- **Rental detail** at the **load-out / return** moment: when a unit goes On Rent or Returned, a **"Capture trailer photo"** action grabs a still from the gate cam onto `rental.clips` — evidence the machine left/arrived. Tier ≥ money.
- **Work Order** (damage dispute): a **"Add footage"** action on a billable WO captures a still/short clip to `wo.clips`, shown as rivet-cornered thumbnails (reuse the inspection-evidence thumb pattern, `app.js:9589`). The clip is *evidence on the record*, never pricing.

### 6.3 Recorded scrub (manager+, Phase 2)

- A horizontal **time scrubber** (steel rail, stamped time ticks) under the expanded feed; drag to a moment, the player re-brokers `cameraRecorded` for that range.
- A **"Capture clip"** ignition button exports the visible range to the record via `cameraCapture`.
- Every scrub-export `logAction`-stamps the record + a `cameraAudit` line (§3, Open Q §11.7).

### 6.4 Settings → Integrations: build the camera card (alongside the GPS card)

The Integrations panel body is **note-only today** (`app.js:3415`). `gps-tracking` already proposes building it; cameras adds a sibling card:

- **Camera system card:** provider label, a master **enable** ignition toggle, `healthMinutes`/`clipRetentionDays`/`liveProtocol` stamps, a **Test connection** button (`cameraTestConn` → green "Reachable · N channels" / red error), and a health line from `cameraHealth` ("Last poll 4m ago · 6/7 channels online"). **Never shows the host/token.**
- **Camera registry sub-card** (admin): add/edit/remove `cameras` rows (`name`/`area`/`nvrChannel`/`enabled`/optional `lat`/`lng`/`heading`/`recordedCapable`), and the per-unit `homeCameraId` mapping. Persists via `cameraConfig`.
- All controls `data-r`-stamped; lives inside the existing `settings` window (no new catalog entry **unless** the registry editor becomes its own popup → then it is one).

### 6.5 Mobile reflow (per `jactec-ui` mobile sub-capability)

- The wall reflows 3→2→1 columns at the existing breakpoints (`style.css:300–456`); the expanded single feed is **full-bleed** on phone, with the tile roster as a **bottom sheet**.
- The recorded scrubber is **desktop/tablet-first** (a draggable timeline on a 360 px phone is poor); on phone, recorded view offers jump-to-timestamp inputs instead.
- **Respect reduced-motion** (no pulsing "live" dot), `dvh`/safe-area sizing, and a generous touch-target floor on tiles.

---

## 7. Business Rules / Derivations / Money

**No money in this area** — cameras price nothing and touch no margin. But precise derivations:

### 7.1 Camera status (the core rule — server-side, per health poll)

```
age = now - lastSeenTs
channel reachable this poll        → 'Online'   (green)
age <= healthMinutes (5)           → 'Online'   (green)   // last poll was recent
age <= 2*healthMinutes (10)        → 'Stale'    (yellow)  // missed one poll — intermittent
else                               → 'Offline'  (red)     // dark
enabled === false                  → hidden from the wall (not a status)
```

This flows through the **existing** flag engine via `STATUS.cameraStatus` (§4.4) — the tile dot is truthful with **zero new color code**. The exact `Stale`/`Offline` cutoffs are **Open Q §11.2**.

### 7.2 "Best camera for a unit"

`unit.homeCameraId` is the explicit, admin-set answer (no inference). v1 does **not** auto-pick a camera from a unit's GPS position vs. camera `lat/lng` — that geometric "nearest cam" is tempting but error-prone and deferred → **Open Q §11.8**. Blank `homeCameraId` = no "View on camera" link.

### 7.3 Stream URL TTL & re-broker

- A brokered live URL is **short-lived** (`expiresInSec`, e.g. 60 s). The tile re-brokers transparently before/at expiry. This keeps a leaked URL useless after a minute and stops a captured screenshot of devtools from being a durable feed key.
- Re-broker is **throttled** (one in-flight `cameraLive` per channel) so a render storm can't hammer the NVR.

### 7.4 Capture-to-record

A captured still/clip is offloaded via the **existing** Drive path (`uploadCapture`); the returned stable URL is pushed onto `rental.clips`/`wo.clips` with `{ ts, cameraId, by:currentUser, kind }`, and a `logAction` line is stamped. The clip is **evidence**, with no pricing/margin semantics — it never affects a WO's `billCustomer` decision automatically (a human still decides billability via the blue **Complete WO** button; **never** auto-complete a WO from a capture — honors the "Don't" list).

### 7.5 Edge cases

- **Camera `enabled:false`** → hidden everywhere; any `homeCameraId` pointing at it renders no link (treat as none).
- **`recordedCapable:false`** channel → live-only; the "Recorded" control is hidden for that tile.
- **NVR clock skew** → recorded scrub uses NVR-native timestamps; the app normalizes display to local but brokers the range in the NVR's reference (Open Q §11.3).
- **Unit Sold/Inactive** with a `homeCameraId` → keep the link working (footage of a since-sold machine is still legitimately reviewable), but it's never *required*.
- **Demo mode / `enabled:false`** → behaves exactly as today; the board no-ops cleanly with zero cameras.

---

## 8. Phasing & Milestones

**Phase 1 — Live wall + health + capture-to-record (MVP).**
*In scope:* the `cameras` registry (`data.js` + Sheet tab + `IDX.camera`); `cameraList`/`cameraLive`/`cameraCapture`/`cameraHealth`/`cameraTestConn`/`cameraConfig` actions; the **Cameras board** (live wall, tiles, status dots, Wall/Map toggle, expand-to-single, Capture still) with its WINDOW_CATALOG entry; per-record capture onto `rental.clips`/`wo.clips` via the Drive offload; the Settings → Integrations **camera card** (enable, Test connection, health) + registry editor; tier gating (money for live, manager for config). **Outcome:** open the app, see the yard live, and grab a still onto a record — credentials never leave the server.
*Out of scope (Phase 1):* recorded scrub/export, per-unit auto-camera inference, motion/intrusion alerts, customer-facing access.

**Phase 2 — Recorded scrub + camera↔unit jump + map pins.**
The recorded timeline (`cameraRecorded`, manager+), the unit-card "View on camera" link (`homeCameraId`), camera pins + view-cones on the map view, and the `cameraAudit` log for footage access.

**Phase 3 — Alerts + GPS cross-link + (optional) motion.**
Motion/intrusion events from the NVR → a yard "stray after-hours" alert that **pairs with the `gps-tracking` stray signal** (a GPS stray + a motion event on the gate cam = high-confidence theft). Optional NVR webhook for near-real-time motion (Open Q §11.10). Optional auto-clip on a stray event.

**Explicitly out of v1 entirely:** customer-facing "watch your pickup"; facial recognition / ANPR plate reading (privacy minefield); 24/7 cloud re-recording inside our app (the NVR owns recording/retention); audio capture (consent/wiretap law — Open Q §11.6); per-driver behavior video.

---

## 9. Acceptance Criteria

- [ ] With `CAMERA_CFG.enabled:false` (default), the app renders **byte-for-byte as today** — no Integrations camera card body, no board entry, no map pins, no new fields surfaced.
- [ ] With cameras configured + a reachable NVR, the **Cameras board** shows a live tile per `enabled` camera, each with a truthful R/Y/G status dot derived server-side (§7.1) — **no per-tile color code**.
- [ ] `cameraList` / `cameraHealth` / `cameraTestConn` / `cameraLive` responses **contain no NVR host, username, password, token, or raw `nvrChannel`** (assert in a `ci/logic-test.mjs` test that scans the response shape against a forbidden-key/forbidden-pattern list — host-looking strings, `rtsp://`, credential keys).
- [ ] **No secret in the repo or seed:** `config.js` `CAMERA_CFG` carries no URL/host/token; the demo `cameras` seed rows carry only `name`/`area`/`nvrChannel:'demo-ch-1'` and **no** real coordinates or footage (assert in `ci/logic-test.mjs` / a grep gate).
- [ ] The browser **never** receives a long-lived stream URL; `cameraLive`/`cameraRecorded` URLs carry an `expiresInSec` and the tile re-brokers on expiry (gate test on the TTL field's presence + that it is ≤ a small cap, e.g. 120 s).
- [ ] **Tier gates hold server-side (defence-in-depth):** for each action, a session below floor is **refused server-side** *and* the front-end hides the surface — per the §3.1 table: `cameraList`/`cameraLive`/`cameraCapture(still)` ≥ money; `cameraRecorded`/`cameraCapture(clip)`/footage-export ≥ manager; `cameraConfig`/`cameraTestConn` ≥ admin. A staff-tier session sees no board entry **and** every action returns `forbidden`. (Gate test asserts both layers.)
- [ ] `cameraConfig` **rejects** a registry row carrying a URL/host/credential-shaped field (can't smuggle a secret into the public Sheet). (Gate test.)
- [ ] A captured still attaches to `rental.clips`/`wo.clips`, shows as a thumbnail, and a `logAction` line stamps who·when. `cameraRecorded` + footage-export also write a `cameraAudit` line. Capturing a still **never** completes a WO or changes `billCustomer` (honors the "Don't" list — gate test).
- [ ] The §7.1 status derivation (`Online`/`Stale`/`Offline` from `lastSeenTs` age vs. `healthMinutes`) is pure and unit-tested in `ci/logic-test.mjs`; the tile dot has **zero per-tile color code** (flows through `STATUS.cameraStatus` + the existing flag engine, `APP-11 app.js:3700`).
- [ ] An NVR-unreachable state shows the red hazard-stripe banner and degrades gracefully **without crashing the board mount** and **without mass-flipping every channel to Offline on a single failed poll** (mirror maps-loader degradation + the GPS no-storm rule).
- [ ] Mobile: the wall reflows to 1 column, the expanded feed is full-bleed, reduced-motion suppresses the live-dot pulse, off-screen `<video>` tiles are paused, and concurrent live streams are capped (§7.3 / Open Q §11.11).
- **CI gates:** `node ci/smoke.mjs` + `node ci/logic-test.mjs` pass (add the no-credential-leak assertion + the tier-gate test + the §7.1 status-derivation test). New Cameras popup ⇒ **`ci/check-window-catalog.mjs`** updated. New buttons/pills/banner ⇒ **`ci/gen-rule-usage.mjs`** regenerated (drop `--check`); also passes `--check` duplicate-rule guard. New `app.js` chapter banner (if a Cameras chapter is added) ⇒ **`tools/gen-code-map.mjs`** regenerated. Cache-bust `?v=` bumped on `index.html` for `style.css`/`rule-usage.js`/`app.js`. Port 8000→9147 swap before running gates, then `git checkout -- ci/`.

---

## 10. Risks & Edge Cases

- **Public repo / Pages = credential exposure is fatal.** A leaked NVR host+token = live, exportable surveillance of the yard and anyone in it. **Everything authenticates server-side; the browser gets only ephemeral, channel-scoped, short-TTL URLs.** No host/channel/token/frame of real footage in the repo or seed — referenced **by name only** (mirrors the Stripe/maps/GPSWOX canon).
- **The streaming protocol is the make-or-break unknown.** RTSP doesn't play in a browser; we need a restreamer (HLS) or WebRTC gateway we may not have yet. Phase 1 should not block on the *perfect* low-latency path — ship HLS first if that's what the NVR can emit (Open Q §11.1).
- **Bandwidth / performance.** N live tiles = N concurrent streams; on a phone or a slow yard connection this melts the page (`frontend-performance` dependency). Mitigate: lazy-mount only visible tiles, pause off-screen `<video>`, cap concurrent live streams, prefer a low-res "wall" sub-stream and the full-res only on expand (Open Q §11.11).
- **Privacy / people in frame.** Surveillance captures employees, customers, and the public street. v1 stays **internal-only**; capture-to-record + recorded export are tier-gated and audited. **Audio is out** (consent/wiretap law). Retention is the NVR's job, not ours. → Open Q §11.6.
- **Customer presence inference.** Gate/lot footage reveals which customer was at the yard when — internal only, never customer-facing (Open Q §11.9).
- **NVR reliability / vendor lock-in.** Downtime/token expiry must degrade gracefully (Offline tiles + health badge), never crash a mount. Keep `cameraLive`'s shape provider-agnostic so a vendor swap is a server-only change (Open Q §11.12).
- **Render storms / re-broker hammering.** A re-render must not re-broker every tile — throttle one in-flight `cameraLive` per channel (§7.3).
- **Multi-user / offline / demo.** Demo mode and `enabled:false` must behave exactly as today; the board no-ops with zero cameras; an offline device shows last health, not a hang.
- **Storage growth.** Captured stills/clips accrue on records → reuse the existing Drive-offload lifecycle/quotas (`photo-offload-drive-design.md`), don't invent a new media store; clip captures should be **size/duration-capped** (Open Q §11.11).

---

## 11. Open Questions (for Jac)

> **Resolved 2026-06-29:** Q1/Q12 (protocol & broker topology) → **D1**: provider-agnostic pluggable broker; GAS signs short-TTL playback descriptors `{kind,url,expiresAt}`, real restreaming/transcode lives on a separate box once hardware is chosen; NVR creds in Script Properties named-only. Q4/Q5 (access & tier split) → **D2**: per-camera visibility (tiers + yards) configured in Settings — not a flat money floor; Manager+ for recorded playback/export, Admin for config. Q6 (retention/audio/export) → **D3/D4**: record **video + audio**, **90-day** retention on **Google Drive**, un-pinned footage rolls off; clip-capture pins to records (survives rolloff); export Admin-only, default-off, audit-logged. Q9 (customer-facing) → **permanently internal-only for now** (no customer footage links in scope). Remaining (Q2 status cutoffs, Q3 NVR clock, Q7 audit-log shape, Q8 nearest-camera, Q10 motion/GPS fusion, Q11 bandwidth, Q13 Settings-vs-hardcoded registry) stay as build-time calls for the implementing task.

*(No seed questions were captured for this area; the following are generated from the code + the streaming/security reality.)*

1. **Live-stream protocol & restreamer.** Does the JacRentals NVR already emit **HLS** or **WebRTC**, or only **RTSP** (needing a restreamer/gateway we must stand up)? This decides whether Phase 1 is "wire the broker" or "also build a streaming box." Latency vs. setup-cost trade-off.
2. **Status cutoffs.** `Stale` at one missed health poll (10 min), `Offline` after that? Or a tighter window so a dead gate cam goes red fast? Tighter = faster alarm, more false "Stale" on a flaky channel.
3. **NVR timestamp / timezone reference** for recorded scrub — do we trust the NVR's clock and normalize display, or require an NTP-synced NVR? Affects whether "scrub to 2:14 PM" lands on the right frame.
4. **Driver/staff access.** Do **drivers** get the **gate cam** (loading a trailer) and **mechanics** the **shop cam**? Or is the whole board **money-floor** with **no** staff access? (Default proposed: no staff access — surface the exception only if Jac wants it.)
5. **Live vs. recorded tier split.** Confirm: **live = money tier**, **recorded scrub + export + config = manager/admin**. Or should *recorded* viewing also be allowed at money (office pulling a return clip), with only *export/config* at manager? Investigative-act sensitivity vs. office convenience.
6. **Retention, audio, and export policy.** Confirm **no audio capture** (wiretap/consent law). Who may **export/download** footage off a record, and is there a retention/auto-purge rule on captured clips (vs. the NVR's own retention)? People-in-frame + customer-presence make this a real policy call.
7. **Audit log shape.** A dedicated `cameraAudit` log (who viewed/exported what footage when) vs. only `logAction` lines on the touched record. A standalone log is stronger for "who pulled the gate footage" but is a new store.
8. **Auto "nearest camera" for a unit.** Stick with the explicit admin-set `homeCameraId` (simple, reliable), or later infer the best camera from the unit's GPS fix vs. camera `lat/lng/heading` (slick, but error-prone)? Defer the geometric version?
9. **Customer-facing footage — ever?** Is there any future appetite for a "watch your equipment load out" customer link (a sales/trust feature), or is surveillance **permanently internal-only**? This bounds the whole security model (a customer-facing URL is a far bigger attack surface).
10. **Motion/intrusion alerts + GPS pairing (Phase 3).** Do we want NVR motion events to raise an in-app yard alert — and to **fuse with the `gps-tracking` stray signal** (motion at the gate + a GPS stray = high-confidence theft)? Webhook (near-real-time) vs. poll? This is the highest-value Phase-3 idea but adds an inbound endpoint.
11. **Concurrent-stream / bandwidth budget.** What's the worst-case device + connection (a phone on yard LTE)? That sets the cap on concurrent live tiles, whether we need a low-res wall sub-stream, and clip size/duration limits. `frontend-performance` co-owns this.
12. **Provider & where the broker runs.** Which NVR/camera brand (Reolink / Hikvision / UniFi Protect / generic ONVIF/RTSP)? Does the broker run **inside GAS** (limited — GAS can't transcode or hold a socket), meaning the *restreaming* must live on a separate box/relay and GAS only **signs/brokers URLs**? This likely splits the backend: GAS for URL-brokering/auth, a separate streaming service for the actual video. Confirm the topology before Phase 1.
13. **Settings UI vs. hardcoded registry.** Ship the `cameras` registry as a **runtime admin editor** (Integrations sub-card) from day one, or hardcode it in `config.js`/seed first (like `FLAG_CATALOG` shipped hardcoded) and add the editor later?

---

## 12. Dependencies & Sequencing

| Depends on (roadmap slug) | Why | Must land first? |
|---|---|---|
| **`maps-location`** (✅ shipped) | The map view's loader/`YARD_CENTER`/`_dispMap` mount pattern for camera pins. Reuse, don't add a second map stack. | Already shipped — ready. |
| **`gps-tracking`** (🟡 in progress) | The **template** for this area: server-side external feed, Integrations panel body, manager board, secret-by-name handling, the WINDOW_CATALOG/board pattern, and the Phase-3 stray-fusion. Build the Integrations panel **once**, shared. | Strongly recommended first — cameras should reuse, not duplicate, its Integrations panel + secret pattern. |
| **`units-fleet`** | `unit.homeCameraId` lives on the unit; the "View on camera" link sits on the unit card (`APP-16`). | Shipped — additive field only. |
| **`backend-data`** (✅) | The `backendCall` entry point + the new `cameras` Sheet tab + the Drive-offload lifecycle (`uploadCapture`, `photo-offload-drive-design.md`). | Shipped — additive actions only. |
| **`frontend-performance`** | N concurrent live `<video>` streams are a perf hazard (lazy-mount, pause off-screen, low-res sub-stream). Co-owns the concurrent-stream budget (Open Q §11.11). | Concurrent with Phase 1. |
| **`mobile-remote`** | The wall's phone reflow, full-bleed feed, and bottom-sheet roster ride the existing mobile layer (`style.css:300–456`). | Shipped — reuse. |
| **`comms-notifications`** (Phase 3) | Routing a motion/intrusion alert to a person reuses the notification spine. | Phase 3 only. |

**Sequencing summary:** land (or co-develop) `gps-tracking`'s Integrations-panel + secret pattern first so cameras **extend** it rather than fork it; ship Phase 1 (live wall + capture) on the existing maps/backend/Drive spine; defer recorded-scrub and alert-fusion to Phases 2–3 once the streaming topology (Open Q §11.1, §11.12) is settled.
