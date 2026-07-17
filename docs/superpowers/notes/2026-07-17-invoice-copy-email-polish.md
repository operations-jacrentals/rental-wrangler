# Parked: invoice copy-as-image + email-PNG polish

**Parked from** the invoice fonts/email-PNG session (2026-07-17), after PR #687 shipped live.
All items are **minor + live-safe** — the shipped code degrades gracefully; these are refinements.
Surfaced by the fresh-context review of #687 and the #682 review.

## Follow-ups

1. **`invoiceFontFaceCss` — cache only on success.** It currently sets `_invFontCss = ''` on the
   first failure, so an offline/CDN-blocked **first** copy-or-email poisons the cache for the whole
   session (fonts never embed until a reload, even after the network returns). Fix: don't cache the
   empty result — return `''` without assigning `_invFontCss` on failure (accept the re-fetch cost
   on repeated failures), or cache with a short retry window. (app.js `invoiceFontFaceCss`.)

2. **Email-PNG off-screen render width.** `invoiceSheetPng` forces a **640px** off-screen container,
   while `.pr-doc` caps at **760px** and the on-screen sheet fills its modal — so the emailed PNG can
   be a different scale than "Copy as image" and the on-screen view. Fix: set the temp container width
   to match `.pr-doc`'s cap (~760px) for a consistent emailed image. (app.js `invoiceSheetPng`.)

3. **Concurrent font double-fetch.** `invoiceFontFaceCss` caches the resolved value but not the
   **in-flight promise**, so a copy + an email fired together both hit the CDN. Pure efficiency —
   cache the promise instead of the string. (app.js `invoiceFontFaceCss`.)

4. **Cosmetic comment nit.** `restoreJogScroll`'s doc-comment says the scrollMemo key is
   "recType:recId", but the key is `card|<view>` (where the view portion is `recType:recId`). Code is
   correct; tighten the wording. (app.js `restoreJogScroll`.) *(The #682 copy-as-image font/Firefox
   comment nit was already fixed in #687.)*

## Not bugs
None of these change behavior on the happy path; the review confirmed every failure path degrades
(system-font fallback, no attachment, or the Save-PDF toast). Pick them up on the next invoice touch.
