# Spec — Mr. Wrangler prompt caching (cost reduction)

**Status:** Option A patch **staged & ready to deploy** (`wrangler-prompt-caching.gs`).
Blocked only on the clasp credential (RAPT — see §4). No code live yet.
**Author session:** `claude/mr-wrangler-overage-2rusx7` (2026-06-26)
**Touches:** backend `Code.gs` (ships via `/clasp`); optionally `app.js` (git/PR).
**Exempt from UI skills** — this is API-payload plumbing, no visible UI.

---

## 0. Finding first: the $300 is NOT Mr. Wrangler

The alarm was a ~$300 month-to-date Anthropic bill, almost all **Opus 4.8**. Reading
the live backend settles where it comes from:

- Mr. Wrangler's call (`Code.gs`) defaults to **`claude-sonnet-4-6`** (Script Property
  `WRANGLER_MODEL`; allowlist `sonnet-4-6` / `haiku-4-5` / `opus-4-8`), with
  `max_tokens` clamped to **≤ 4096**. So the app shows up on the bill as **Sonnet
  (+ a little Haiku)**, never as the Opus mountain.
- The dashboard's Jun 23 split was **Opus $98.38 / Sonnet $1.16 / Haiku $0.70**. The
  Sonnet+Haiku sliver (~$2/day) **is** Mr. Wrangler. The **$98/day Opus is Claude
  Code dev sessions** (Claude Code runs on Opus 4.8). The spiky day-shape confirms
  coding bursts, not steady staff app use.

**So:** caching Mr. Wrangler saves ~$1/day — worth doing as good hygiene + insurance
if staff use grows, but it does **not** move the $300. The $300 lever is Claude Code
usage discipline (see `/audit`, and the model-triage rule in `CLAUDE.md`). This spec
covers only the Mr. Wrangler caching, per Jac's call.

---

## 1. Current shape (live `Code.gs`)

The frontend (`app.js` `wranglerSend()` → `backendCall('wrangler', {system, messages})`)
sends a **plain-string** `system`, built as:

```js
// app.js ~9745
const system = WRANGLER_SYSTEM
  + (o.kpiTarget ? '\n\n' + wranglerKpiSystem() : '')
  + '\n\n' + wranglerContext(o);
```

The backend forwards it verbatim with **no caching**:

```js
// Code.gs (current)
var payload = {
  model: model,
  max_tokens: maxTokens,
  system: String(body.system || 'You are Mr. Wrangler, a helpful ranch-yard assistant.'),
  messages: messages
};
```

The `system` string is **~45K input tokens**: a stable ~40K-token `WRANGLER_SYSTEM`
block (instructions, examples, CSV-mapping format) **+** a volatile yard digest
(categories, ≤200 units/rentals/customers/invoices/WOs, rebuilt every call).
**Re-sent in full on every message.** No `cache_control` anywhere.

---

## 2. Design — one backend change serves both options

Caching is a **prefix match**: a `cache_control` breakpoint caches everything up to
it. The win depends on what's stable *before* the breakpoint. The backend change
below supports **both** rollout options with no further backend edits:

```js
// Code.gs — replace the `system:` line with `system: wranglerSystem_(body),`
function wranglerSystem_(body) {
  // Option B (preferred long-term): frontend sends the parts split, so the
  // 40K-token stable block caches across ALL chats.
  if (body.systemStable != null) {
    var arr = [{ type: 'text', text: String(body.systemStable),
                 cache_control: { type: 'ephemeral' } }];
    if (body.systemVolatile) arr.push({ type: 'text', text: String(body.systemVolatile) });
    return arr;
  }
  // Option A (back-compat + today's frontend): wrap the whole system string in
  // one cached block — caches the ~45K prompt on every follow-up *within* a chat.
  var s = String(body.system || 'You are Mr. Wrangler, a helpful ranch-yard assistant.');
  return [{ type: 'text', text: s, cache_control: { type: 'ephemeral' } }];
}
```

Notes:
- `system` may be a string **or** an array of blocks — the array form is what
  carries `cache_control`. No `anthropic-beta` header needed (caching is GA).
- Min cacheable prefix: Sonnet 4.6 = 2048 tokens, Haiku 4.5 / Opus 4.8 = 4096. The
  ~40K-token stable block clears all three.
- `max_tokens ≤ 4096` and the model allowlist are unchanged.

### Option A — backend-only (recommended for ROI)
Ship just the `Code.gs` change above. Today's frontend keeps sending a single
`system` string → it gets wrapped in one cached block. **Caches within a chat**
(turn 2+ reuse the ~45K prompt, as long as the yard digest is byte-identical between
turns — normally true seconds apart). One additive `/clasp` deploy, no frontend PR,
~zero risk.

### Option B — frontend + backend (fuller win, later)
Additionally change `app.js` to send the parts separately:

```js
// app.js wranglerSend(): send split instead of one concatenated `system`
backendCall('wrangler', {
  systemStable:   WRANGLER_SYSTEM,                              // the 40K constant
  systemVolatile: (o.kpiTarget ? wranglerKpiSystem() + '\n\n' : '') + wranglerContext(o),
  messages: payloadMsgs
});
```

Now the breakpoint sits **after the stable block**, so `WRANGLER_SYSTEM` caches
**across every chat** (within the 5-min TTL), not just within one. The volatile
digest after the breakpoint is never cached but is the smaller part. Bigger %
savings; needs an `app.js` change + git PR on top of the backend deploy.

> The backend change is identical for both — Option B is a pure frontend follow-up.
> Recommend shipping **A** first, measure, then decide if **B** is worth the PR.

---

## 3. Economics (Sonnet 4.6: $3 in / $15 out per MTok)

| | per ~45K-token system |
|---|---|
| Uncached input | ~$0.135 |
| Cache **write** (1.25×, first call) | ~$0.169 |
| Cache **read** (0.1×, follow-ups) | ~$0.0135 |

Break-even at the 5-min TTL is **two** calls sharing the prefix. A multi-turn
Wrangler chat saves ~$0.12/message from turn 2. Absolute: roughly $2/day → ~$1/day.
Small, but free once shipped, and it scales if staff use grows.

---

## 4. Deploy + verify

- **Backend deploy is via `/clasp`** (additive, STOP-gate before prod), keeping the
  **same deployment id** so the exec URL never changes.
- ⚠️ **Auth caveat:** local clasp in this session is **RAPT-blocked**
  (`invalid_rapt` on `clasp pull`). The deploy step will likely need a freshly
  re-minted `CLASPRC_JSON_B64` secret (see `docs/handoffs/backend-deploy-via-clasp.md`).
  Resolve before attempting the deploy.
- **Verify caching worked:** the backend currently returns only `{ text }`. For a
  one-off check, temporarily surface `out.usage` and confirm
  `cache_read_input_tokens > 0` on the **second** message of a chat (first call
  shows `cache_creation_input_tokens`, follow-ups show `cache_read_input_tokens`).
  Remove the temporary usage echo after verifying, or keep a gated diagnostic.

---

## 5. Open decisions for sign-off

1. Ship **Option A** now, or go straight to **A+B**?
2. OK to also echo `usage` (gated) for a verification window, then strip it?
3. Confirm the `/clasp` credential is healthy (or re-mint) before deploy.
