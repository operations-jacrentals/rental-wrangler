# Notifications pane + two-audience comms — DESIGN (2026-07-14)

**Status:** DESIGN — built A, plans B/C/D. Awaiting Jac's review (approved to build overnight,
2026-07-14; layout mock approved).
**Extends:** `docs/specs/comms-notifications.md` (the canonical area spec) — this is the Phase-2/3
build design + the new **staff (crew) SMS channel** Jac added 2026-07-14.
**Design skill:** UI runs through `/jactec-ui` (yard data-plate). Backend is additive on the single
`backendCall` entry point; go-live is Jac's editor deploy.

---

## 1. Context & goal

Twilio went live tonight (backend v92 — 6am–8pm window, admin `override`, `smsProviderStatus`).
The Settings → Notifications tab is still a stub (`app.js` `SETTINGS_TABS` 'notifications', renders
`settingsPlannedPane`; `pageDefaultSlice('notifications') === null`, asserted in `ci/logic-test.mjs`).

This design fills that stub with the operator **control center** and defines the two message
programs it governs:

- **Customer-facing** texts (reminders, reviews, dispatch ETA, quotes) — gentle hours, TCPA consent.
- **Crew-facing** texts (a NEW channel) — dispatch/WO/schedule alerts to employees' phones + a manual
  broadcast — earlier hours ("employee use"), employee opt-out.

Jac's two framing decisions (2026-07-14):
- **Two send windows, by audience:** a Customer window and a *different, earlier* Staff window.
- **Staff = a real audience** (texts *to* the crew), not just "who sent it."

## 2. Users, roles & gates

- **The pane** is **admin-tier** to edit (settings write gate; `isAdmin` server-side on `setConfig`),
  visible read-only to any signed-in role. Settings ride the existing `getConfig`/`setConfig` sync →
  every device.
- **Customer sends** keep every existing server gate (`sendCustomerMessage_`): isolation (recipient
  from the record's `customerId`, never a client `to`), consent (`commsConsent`, opt-out hard-block),
  **server-derived var allowlist** (no `cost`/`margin`/`bottomDollar`), the Customer window, daily cap.
- **Staff sends** (`sendStaffMessage_`, new) get the mirror gates: recipient resolved **from a roster
  id** (`settings.employees`), never a client-supplied phone; **crew opt-out**; a **staff var
  allowlist** (job/customer name, address, dates, unit — NEVER pricing floor / margin / cost, even to
  a driver); the Staff window; the shared daily cap.
- **Admin override** (`override:true`, v92) stays admin-only, manual sends only, both audiences.

## 3. Data model (additive)

### 3.1 `settings.notifications` (backend settings blob; loaded at boot; admin-written)

```js
settings.notifications = {
  internal: { teamChat: true, bell: true },
  channels: {
    priority: ['sms', 'email'],
    windows: {                         // NEW — per-audience send windows (Central), Jac 2026-07-14
      customer: { start: 8,  end: 20 },// gentler default (respect customer quiet time)
      staff:    { start: 6,  end: 20 },// earlier — the yard opens early
    },
    dailyCap: 50,
    adminOverride: true,               // allow admin "send anyway" on a manual send
  },
  customer: {
    dispatchEta: false,                // "unit's on the way" (Phase D trigger)
    reminders: {
      start:   { enabled: false, leadDays: 1 },
      return:  { enabled: false, leadDays: 1 },
      balance: { enabled: false, afterDueDays: 3 },
    },
    review:  { enabled: false, delayDays: 2 },   // Phase D
  },
  staff: {                             // NEW — crew notification events (Phase C triggers)
    driverAssigned: { enabled: false },
    woAssigned:     { enabled: false },
    scheduleChange: { enabled: false },
    // manual "text the crew" broadcast has no toggle — it's operator-initiated
  },
}
```

All fields additive; absent → the defaults above. `pageDefaultSlice('notifications')` returns this
default object (was `null`); `ci/logic-test.mjs` assertion updated deliberately (comms spec AC-8).

### 3.2 Crew consent — additive on the roster person

```js
// settings.employees[i]  (already: { id, name, role, phone, note })
commsConsent: { sms: 'opted-in' | 'opted-out' | 'unknown', updatedAt, source }
```
Default `'unknown'` = allowed for **internal/work** texts (employees, not consumer marketing); a crew
`STOP` reply flips to `'opted-out'` (Phase C inbound). Mirror of customer `commsConsent`.

### 3.3 `messages` log — extend, don't fork

The existing server-only `messages` tab gains `audience: 'customer' | 'staff'` and, for staff rows,
`rosterId` instead of `customerId`. The redacted client projection stays PII-safe (masked recipient,
no raw `to`).

## 4. Backend contract (additive actions; `Code.gs`)

| Action / fn | Audience | Notes |
|---|---|---|
| `smsQuietNow_(audience)` | both | reads `settings.notifications.channels.windows[audience]`; falls back to 6am–8pm. **Phase A** (built). |
| `sendCustomerMessage_` | customer | existing; now passes `audience:'customer'` to the window check. **Phase A** wires the window. |
| `sendStaffMessage_(body, role, pw)` | staff | NEW. recipient from `rosterId`→roster phone; crew consent; staff var allowlist; staff window; cap; dedup. **Phase C.** |
| `runReminderSweep()` | customer | NEW installable trigger. Walks records, fires start/return/balance per settings + Customer window, dedup ledger. **Phase B — NOT auto-installed.** |
| staff triggers | staff | driver-assigned (dispatch/trips), wo-assigned (work orders), schedule-change (trips) call `sendStaffMessage_`. **Phase C.** |
| `smsProviderStatus` | — | v92, done. Feeds the LIVE/OFFLINE pill. |

**Templates** (server-side registry, hardcoded v1): add `reminder-balance`, `review-request`,
`dispatch-eta` (customer) and `staff-run`, `staff-wo`, `staff-schedule`, `staff-broadcast` (crew).
Staff templates interpolate only allowlisted job vars — never pricing.

## 5. UX / UI — the pane (yard data-plate)

Six stamped steel cards (rivets, Saira Condensed stamped labels, saddle-stitch tan dividers), admin-
editable, `data-r` stamped, `/jactec-ui` quality floor (focus rings, reduced-motion, boldness in ONE
place = the orange ignition Save + the LIVE pills). Layout approved via the 2026-07-14 mock.

1. **Internal** — team-chat + resolved-fix-bell on/off.
2. **Customer reminders** — start/return/balance toggles + lead-day steppers + cadence summary.
3. **Crew alerts** *(NEW)* — driver-assigned / WO-assigned / schedule-change toggles; a "Text the
   crew" manual-broadcast affordance (pick roster people → composer). Notes each trigger's source.
4. **Reviews** — ask-after-a-rental toggle + delay stepper.
5. **Dispatch** — customer "unit's on the way" ETA toggle.
6. **Channels** — provider LIVE/OFFLINE pills (`smsProviderStatus`); **two windows** (Customer +
   Staff) as start/end steppers; priority order; after-hours override toggle; daily cap.

Empty/loading/error states per comms spec §6.6. The pane lives inside the existing Settings popup →
**no new `WINDOW_CATALOG` entry** (confirm during build; the manual-broadcast composer, if an overlay,
does need one).

## 6. Phasing (build order + status)

- **🅐 Control center — BUILT this session (staged, not live).** The pane + `settings.notifications`
  slice + two windows (UI + the `smsQuietNow_(audience)` backend change, pushed to HEAD + versioned,
  **awaiting Jac's editor deploy**) + provider pills + all event toggles (stored; engines land in B/C).
  Event *triggers/engines* are inert until B/C — the toggles just persist intent.
- **🅑 Customer reminder engine — PLAN.** `runReminderSweep` + balance/review templates + dedup.
  **The cron is NOT installed/enabled unsupervised** (it texts real customers) — install with Jac.
- **🅒 Staff SMS channel — PLAN.** `sendStaffMessage_` + crew consent + the 4 triggers + broadcast UI.
  Fires real texts to the crew → build + activate with Jac.
- **🅓 Later — PLAN.** dispatch-ETA (customer) + review source → Reputation KPI.

## 7. Acceptance (Phase A)

1. Notifications tab renders a real pane (no stub); `pageDefaultSlice('notifications')` returns the
   §3.1 default; `ci/logic-test.mjs` assertion updated.
2. Admin can edit + Save → persists to `settings.notifications` via `setConfig`; non-admin sees it
   read-only.
3. Channels card shows Twilio/Gmail LIVE pills from `smsProviderStatus`; both windows editable.
4. Backend `smsQuietNow_('customer'|'staff')` honors the configured windows (fallback 6am–8pm) — a
   customer send obeys the Customer window, a staff send the Staff window. (Staff sends land in C; the
   window fn + wiring ship in A.)
5. CI green: `gen-rule-usage --check`, `check-window-catalog`, `gen-code-map --check` locally; `smoke`
   + `logic-test` on CI. No secrets/PII in the diff.

## 8. Risks

- **Cost/spam runaway** (B/C) — cron + broadcast texting many real people. Mitigation: not activated
  unsupervised; daily cap; dedup ledger; windows; per-audience consent.
- **Pricing-floor leak to a driver's phone** (C) — staff var allowlist excludes cost/margin/floor.
- **Window confusion** — a send with an unknown audience falls back to the safe 6am–8pm window, never
  "no window."
- **Roster without a phone** — a staff trigger for a phone-less roster person logs `no-phone`, no send.
