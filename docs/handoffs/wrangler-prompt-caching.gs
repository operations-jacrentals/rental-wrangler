/* ───────────────────────────────────────────────────────────────────────────
 * Mr. Wrangler prompt caching — Option A (backend-only)
 * Secret-free, tracked addition. Splice into the LIVE Code.gs and deploy via
 * /clasp (same deployment id). See docs/handoffs/wrangler-prompt-caching.md.
 *
 * Effect: wraps the `system` payload in a cache_control:{ephemeral} block so the
 * ~45K-token Wrangler prompt is cached and re-read at ~0.1x on follow-up messages
 * within a chat. Caching is GA — no anthropic-beta header. Back-compatible: also
 * accepts a pre-split { systemStable, systemVolatile } payload (future Option B)
 * with the breakpoint after the stable block.
 * ─────────────────────────────────────────────────────────────────────────── */

/* STEP 1 — in the Wrangler handler, replace this line inside `var payload = { … }`:

     system: String(body.system || 'You are Mr. Wrangler, a helpful ranch-yard assistant.'),

   with:

     system: wranglerSystem_(body),
*/

/* STEP 2 — add this top-level helper (anywhere in Code.gs): */
function wranglerSystem_(body) {
  // Option B path: frontend sends the prompt pre-split → breakpoint after the
  // stable block so WRANGLER_SYSTEM caches across ALL chats (not just within one).
  if (body && body.systemStable != null) {
    var arr = [{
      type: 'text',
      text: String(body.systemStable),
      cache_control: { type: 'ephemeral' }
    }];
    if (body.systemVolatile) {
      arr.push({ type: 'text', text: String(body.systemVolatile) });
    }
    return arr;
  }
  // Option A path (today's frontend): wrap the whole system string in one cached
  // block → caches the full ~45K prompt on every follow-up within a chat.
  var s = String((body && body.system) || 'You are Mr. Wrangler, a helpful ranch-yard assistant.');
  return [{ type: 'text', text: s, cache_control: { type: 'ephemeral' } }];
}

/* OPTIONAL — temporary verification (remove after confirming, or keep gated).
 * The handler currently returns only { text }. To prove caching works, surface
 * usage on a debug flag and check cache_read_input_tokens > 0 on the SECOND
 * message of a chat:
 *
 *   // after `out = JSON.parse(...)` and the error checks, before `return { text }`:
 *   if (body && body.debugUsage && out.usage) {
 *     return { text: text, usage: out.usage };   // {cache_creation_input_tokens, cache_read_input_tokens, ...}
 *   }
 *
 * Turn 1 → cache_creation_input_tokens populated; turn 2 → cache_read_input_tokens.
 */
