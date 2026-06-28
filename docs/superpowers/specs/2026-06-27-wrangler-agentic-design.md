# Mr. Wrangler — Agentic (tool-use) Design

**Date:** 2026-06-27
**Status:** Approved direction — spec under review before implementation
**Owner:** Jac
**Origin:** "No more whack-a-mole. Build Mr. Wrangler the real way, agentic."
Today Wrangler gets **one blind shot** at a capped 200-row text snapshot, so it
guesses (wrong customer, missed unit, asks instead of looking) and we patch one
phrasing at a time. Jac's direction: make it reason like Claude — look things up,
self-correct, then act.

**Jac's hard constraint (the architecture-decider):** *"if it depends on clasp then
I don't see how the clasp holds. I myself have to reclasp damn near every ten
minutes."* The credential expiry means **no design may put evolving logic in the
backend.** This spec is built around that.

---

## 1. Goal

Turn Mr. Wrangler from a single-shot completion over a truncated snapshot into a
**tool-using agent** that discovers live data on demand and acts through the
existing safety pipeline. The intelligence — tools, the loop, prompts — lives in
the **frontend** so it ships via GitHub Pages and **never needs a re-clasp**.

Non-goals: no new chat UI surface (rides the existing dock), no change to the
money/auth fences, no new data model. This widens *how Wrangler thinks*, not what
it's allowed to touch.

---

## 2. The clasp story — why this never re-clasps (the crux)

The **only** reason a backend exists is to hold the Anthropic API key (it can't sit
in public Pages). Everything else can live in `app.js`, which already holds the
**full** `DATA`/`IDX` in memory — every customer, unit, rental, invoice — not the
200-row digest the model squints at today. And every "tool" an agent needs is
**already a JS function in `app.js`** (`wrResolveCustomer`, `rentalUnitIds`,
availability checks, the pricing engine, `wrValidatePlan`/`applyWranglerData`).

So:

- **Backend** shrinks to a **permanent, generic pass-through**: take
  `{system, messages, tools}`, forward to the Anthropic Messages API, return the
  raw reply (including `tool_use` blocks). It has no Wrangler-specific knowledge and
  **never changes again.**
- **Frontend** runs the agent loop in the browser: model asks for a tool →
  `app.js` runs it against live data → feeds the result back → repeat → final
  answer/action.

**Clasp is touched exactly once** (install the pass-through). After that, every
tool, capability, and fix ships through Pages. The 10-minute expiry is irrelevant
because Wrangler's brain isn't in the backend. This is the whole point of the
design.

---

## 3. Architecture

```
┌─ app.js (GitHub Pages — no clasp) ──────────────────────────────┐
│  runWranglerAgent(userMsg):                                      │
│    messages = [ …history, {role:user, content:userMsg} ]        │
│    loop (≤ WR_MAX_TURNS):                                        │
│      resp = wranglerProxy({ system, messages, tools: WR_TOOLS })│  ── HTTPS ──┐
│      if resp has tool_use:                                       │             │
│        for each call: result = WR_TOOL_IMPL[name](input)        │             ▼
│        messages.push(assistant tool_use, user tool_result)      │   ┌──────────────────────┐
│        continue                                                 │   │ Code.gs `wranglerProxy`│
│      else: render text; if final action → preview/Apply gate    │   │ (thin, permanent)      │
└─────────────────────────────────────────────────────────────────┘   │  key + POST to         │
                                                                        │  api.anthropic.com     │
                                                                        └──────────────────────┘
```

- **Read tools** answer from `DATA`/`IDX` (uncapped). They are pure lookups — no
  writes, no preview — so the agent can freely explore mid-loop.
- **Write tools** do **not** mutate directly. They assemble the same
  `wrangler-action` ops the current pipeline already validates, and the loop ends by
  handing them to `wrValidatePlan` → preview/Apply → `applyWranglerData`. **Every
  existing fence stays exactly where it is.**

### 3a. Backend pass-through contract (the one clasp deploy)

`Code.gs` action `wrangler` accepts:

```jsonc
{ "action":"wrangler", "password":"<backendPassword>",
  "system":"<string>", "messages":[…], "tools":[…], "max_tokens":2048 }
```

Forwards verbatim to `POST https://api.anthropic.com/v1/messages` with the
server-held `x-api-key` + `anthropic-version`, returns the raw response JSON. Keeps
the existing **password gate** (no anonymous use → no API-cost abuse). The model id
is set server-side (default to the latest Claude). The snippet + a one-time clasp
link is handed to Jac; backend stays gitignored.

---

## 4. Tool catalog

### 4a. Read tools (Stage 1 — safe, no writes)

| Tool | Maps to (existing) | Returns |
|---|---|---|
| `find_customers(query)` | `wrResolveCustomer` + name/phone match | matches w/ id, name, balance, flags |
| `find_units(query, status?)` | `wrResolveUnit` + fleet filter | units w/ id, category, fleet status |
| `find_categories(query)` | `wrResolveCategory` | categories w/ rates |
| `find_vendors(query)` / `find_parts(query)` | `wrResolveVendor`/`wrResolvePart` | matches |
| `find_rentals(customer?, unit?, status?)` | rentals filter over `DATA.rentals` | windows, units, invoice link |
| `find_invoices(customer?, status?)` | invoices filter + `invoiceTotals` | totals, balance, status |
| `find_work_orders(unit?, customer?)` | `DATA.workOrders` filter | phase, report |
| `check_unit_availability(unit, startDate, endDate)` | the overbooking gate used by `startRental` | free / clashing rental |
| `price_rental(units, startDate, endDate, customer?)` | the live pricing engine (read-only quote) | line items + total |
| `whoami_context()` | session/role | role, money-permission, today |

### 4b. Write tools (Stage 2 — funnel into the existing apply pipeline)

| Tool | Emits op | Gate |
|---|---|---|
| `create_record(entity, fields)` | `{op:create}` over `WR_EDITABLE` | allowlist; auto-apply if single+safe |
| `update_record(entity, ref, fields)` | `{op:update}` (ref by name/id) | allowlist |
| `import_rows(entity, rows)` / csv | `{op:import\|csv-import}` | always preview/Apply |
| `start_rental(customer, units, window, transport?)` | `operate startRental` | auto-apply (reservation) |
| `bill_rental(rental\|customer)` | `operate billRental` | preview/Apply |
| `record_payment(invoice\|customer, method, amount?)` | `operate recordPayment` | **cash/check only**; server-authoritative |

Write tools reuse `wrCleanFields`, `WR_FK` resolution, `WR_REQUIRED`, and the
unit-inference helper — i.e. they inherit today's safety + resolution for free.

---

## 5. Safety fences — unchanged, all still frontend/server-enforced

- **Hard blocks stay:** never charge a card / run ACH, never refund, never touch a
  balance, never change roles/permissions/passwords, never hard-delete, never
  complete a WO (no `phase`). Enforced in `wrValidatePlan` + server, **not** in the
  prompt — the agent literally has no tool for them.
- **Preview/Apply** (`wrPlanNeedsApply`) governs consequential writes exactly as
  today; reads never gate.
- **Money movement stays server-authoritative** — `recordPayment` posts through the
  existing manual-payment endpoint, not the proxy.
- **Loop bounds:** `WR_MAX_TURNS` (≈8) and a per-run tool-call cap; a tool error
  returns a structured `{error}` the model can recover from, never a thrown crash.
- **Pass-through abuse:** backend password gate retained; no anonymous calls.

---

## 6. Rollout — staged behind the pass-through (Jac)

1. **Stage 0 — Pass-through proxy.** The one clasp deploy. Verify the existing
   single-shot still works through the generic endpoint (back-compat: old payload
   shape still answers) so nothing breaks before the loop ships.
2. **Stage 1 — Read tools + loop, answers only.** Wrangler can *look things up*
   (find/price/check/availability) but emits no writes yet. This alone kills most
   "it guessed wrong" bugs and is fully reversible.
3. **Stage 2 — Write tools.** Turn on create/update/start_rental/bill/payment
   through the existing apply pipeline. Each is already individually fenced.
4. **Stage 3 — Retire the snapshot + slim the prompt.** Once tools are proven, drop
   the 200-row digest and the giant inline rules from `WRANGLER_SYSTEM`; the model
   discovers data via tools instead of cramming it into context.

Each stage is its own PR with gates green; Wrangler stays usable at every step.

---

## 7. Testing & gates

- `ci/logic-test.mjs` via the `window.__rw` seam: unit-test each `WR_TOOL_IMPL`
  handler (correct lookup, structured errors) and a **mock-loop** test — feed a
  scripted `tool_use` sequence and assert the final plan matches (no network).
- Write tools assert they still pass through `wrValidatePlan` fences (e.g.
  `record_payment` with `method:'card'` is refused; a WO write never sets `phase`).
- Standard gates: `smoke`, `gen-rule-usage --check`, `check-window-catalog`,
  `gen-code-map --check`. No new popup window expected (rides the dock); if any UI
  changes, R-stamp + catalog updates land in the same PR.
- Cache-bust `?v=` bumped per deploy.

---

## 8. Open questions for spec review

1. **Model id** server-side default — latest Claude (confirm which) for the agent loop.
2. **History depth** sent each turn — full chat vs last N — cost vs. context.
3. Whether Stage 1 should also **stream** partial text (nice-to-have, not required).
