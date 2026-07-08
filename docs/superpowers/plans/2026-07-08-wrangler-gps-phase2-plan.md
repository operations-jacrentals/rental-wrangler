# WranglerGPS Phase 2 — implementation plan (2026-07-08)

Visibility-first + bulk onboarding. Fleet views are **all signed-in roles** (Jac 2026-07-08 — declined the manager-only asset-protection gate). Area spec: `docs/specs/gps-tracking.md` (§ "Phase 2 sub-status"). Design source: the 8-agent workflow diagnosis (root cause: no unit carries `gpsProvider`+`gpsDeviceId`; login was also broken — both fixed/addressed this session).

## Status snapshot
| M | What | State |
|---|------|-------|
| — | **GPS login fix** (GAS `gpsToken` proxy; password server-side) | code SHIPPED; **needs Jac's editor deploy + `GPS_DASHBOARD_PASSWORD` Script Property** |
| M0 | Verify the pipe | gated on the login deploy; then the M2 roster IS the check |
| M2 | Tracker Health roster (`gpsHealth`) | ✅ SHIPPED |
| M3 | `serialNumber` through `gpsNormalize` | ✅ SHIPPED |
| M4 | `gpsMatchFleet` matcher (pure, tested) | ✅ SHIPPED |
| M1 | Fleet Map (`gpsFleet`) | in build (worktree) |
| M5 | Round Up Trackers bulk onboarding | **NEXT — the actual unblock** |
| M6 | Onboard real fleet + reconcile legacy GPSWOX | Jac (human-in-the-loop) |
| M7 | CI/enforcement | folded into each commit |

## Key APIs already in the tree (build M5 against these)
- **Matcher (M4):** `gpsMatchFleet(units, devices)` → `{ proposals:[{unitId, deviceId, provider, device, score, serial, margin, contested, tier, reasons, runnerUp}], unmatchedUnits:[unitId], unmatchedDevices:[{key,provider,name}] }`. `tier ∈ confident|probable|look|conflict`. Pure; exposed on `window.__rw`. Feed it `DATA.units` + `gpsFleetStatus()` (or the deduped `[...new Set(gpsLive.values())]`).
- **Roster helper (M2):** `gpsFleetRoster()` → per-device `{key, machine, provider, name, serial, status, engineOn, lastSeen, unit}`. `gpsDeviceFresh(machine)`, `gpsProvLabel(p)`.
- **Live snapshot:** `refreshGpsLive()` populates `gpsLive` (Map deviceKey→machine), `gpsLiveAt`, `gpsLiveErr`. `gpsFleetStatus()` returns the flat normalized list. `gpsConfigured()`.
- **Write path (per-unit map):** mirror `gpsConnectSave` (app.js ~17862): `u.gpsProvider = provider; u.gpsDeviceId = deviceId; reindex('units', u); logAction(u, 'GPS → …')`. Do NOT call `gpsConnectSave` directly (it reads `state.overlay`). The autosave/sync picks up the dirty units; confirm a backend `sync` fires (same as any unit edit).
- **Picker helpers (per-row override):** `gpsRawDeviceId(provider, raw)`, `gpsRawDeviceLabel`, `gpsRawDeviceSub`; `gpsProviderDevices(provider)` loads a provider's raw device list.
- **Live first-contact (optional per-row confirm):** `gpsConnectStartPoll(o)` / `gpsConnectPollTick(o)` (app.js ~17838).

## Popup pattern (copy the shipped `gpsHealth` verbatim)
- WINDOW_CATALOG entry (`~11107`), buildPopupEl branch (`o.kind === 'gpsHealth'` ~10305), afterRender hook (`~10115`, e.g. `if (o.kind==='roundup') ruMountCharts()`), click handlers (`~14557`), input handler (`~15426`, caret-restore), CSS (`.gpsh-*`, style.css ~2139).
- `openOverlay({kind, …})` opens; `renderOverlay()` re-renders on state change; `popupShell({icon,title,tag,body,foot})`; `el('div','popup …')`.
- Builders only (`data-r` stamps): `badge` R3b, `statusPill('gpsStatus', s)` R3, `refPill('units',id,name)` R2, `segCtl` R14 (selected = `on:'orange'`), `ghostPill` R18, `actionPill` R17, `addBtn` R5, `closeX` R24. Tokens only; no `I.refresh` (use `I.refresh || '⟳'`); no hand-drawn icons (library glyphs: `I.truck`, `I.grid`, `I.list`, …).

## M5 — "Round Up Trackers" bulk onboarding (the plan)
New popup `gpsRoundup` (name TBD; opened from the Units card header AND the toolbar; the single-unit `gpsConnect` wizard stays for one-offs).
1. **SCAN:** one `refreshGpsLive()` / `gpsFleetStatus()` → `gpsMatchFleet(DATA.units, devices)`.
2. **REVIEW TABLE**, bucketed by `proposal.tier`: **CONFIDENT** (serial, pre-ticked) · **PROBABLE** (unchecked) · **NEEDS-A-LOOK** · **CONFLICT** (a device two units claim — never auto-tick) · **NO-MATCH** (`unmatchedUnits` / `unmatchedDevices`). Show per row: unit (name/serial/make/model) ↔ proposed device (provider chip, name, serial, last-seen, live location), the `reasons`, and the score/margin.
3. **PER-ROW OVERRIDE:** swap the proposed device via the existing picker (`gpsProviderDevices` + `gpsRawDevice*`); unmap; pick from NO-MATCH.
4. **CONFIRM (safety gate):** expand-to-confirm side-by-side plates + last-seen/location. **MANDATORY-visible for shutdown-capable Hapn rows** (`gpsDeviceId` drives the starter relay — a wrong map cuts the wrong starter). Optional live first-contact poll (`gpsConnectPollTick`); consider making it **mandatory for Hapn** (open Q for Jac).
5. **APPLY:** for each ticked+confirmed proposal write `u.gpsProvider`/`u.gpsDeviceId` + `reindex` + `logAction`; **per-unit partial-failure surfacing** (R25-style) — a half-applied ~50-unit batch must NEVER report "done"; a silently-missing mapping is as safety-relevant as a wrong one. Offer Unmap + batch undo.
6. **DoD:** matcher already unit-tested; add a smoke/interaction check that Apply writes the pair + never completes a WO; screenshot self-critique; WINDOW_CATALOG + rule-usage + code-map + `?v=` bump.

## M6 — onboard the real fleet (Jac)
Run M5 against live accounts; human-confirm/override/Apply. **Rebind the 4 legacy GPSWOX units** (U001 Dirt Dauber, U003 Worm, U004 Shrek, U024 Brookie) to a supported provider (hapn/deere/yanmar/bouncie) and clear their stale stored `gpsStatus` — GPSWOX is not integrated, so nothing migrates, only re-map. Verify a sample reads Reporting/Verify per-unit.

## Remaining open questions for Jac (from the design workflow)
- Hapn shutdown bar: is metadata + mandatory human side-by-side confirm enough, or make the live first-contact poll **mandatory** for Hapn rows? (Even a passing poll proves the tracker is ALIVE, not bolted to THAT machine.)
- Sparse serials: many units carry no serial (U005/6/7 blank) and Bouncie exposes none → name-only/no-match, hand-picked. Fine to hand-eyeball non-green rows, or gather serials/PINs first to raise auto-match coverage?
- Are the 4 GPSWOX units actually on one of the four supported trackers now, or still on unreadable GPSWOX hardware?

## Gate dance (this cloud env)
`npm i --no-save googleapis playwright` (both together). Non-browser: `node --check app.js`, `node ci/gen-rule-usage.mjs [--check]`, `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs [--check]`. Browser (revert after): `sed -i 's/8000/9147/g; s/chromium\.launch()/chromium.launch({ executablePath: process.env.PW_EXEC })/g' ci/smoke.mjs ci/logic-test.mjs` → `PW_EXEC=/opt/pw-browsers/chromium node ci/smoke.mjs` + `… logic-test.mjs` → `git checkout -- ci/`. Backend deploy = `docs/handoffs/gas-deploy-service-account.mjs push` then Jac's editor New-version deploy (the STOP-gate). Promotion: task branch → `area/wrangler-gps` → staging → main (bump the shared `?v=` token every promotion).
