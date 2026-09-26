# What the *integrations* actually cost

**Seven external systems, reconstructed from this project's own handoff notes. Not "how to integrate Stripe" — the specific traps that were expensive here, the ones no quickstart mentions, and what to do first next time.**

*Field report · Rental Wrangler · 2026-08-20*

Payments: **Stripe** · Texting: **Twilio · Mocean** · Location: **Google Maps** · Email: **Gmail / GmailApp** · Telematics: **4 GPS providers** · Design: **Figma** · Runtime: **Apps Script**

---

## §01 — The pattern behind all seven

Every expensive integration surprise in this project was one of the same handful of mistakes wearing a different vendor's logo. Before the vendor-by-vendor detail, these are the transferable ones — they'd have caught most of what follows.

- **Decide who owns the record before you write a line.** The single most expensive integration bug here was memberships being billed inside Stripe while the app had no link to those subscriptions and wasn't reconciling them. Not a bug in anyone's code — an unmade decision. Write down which system is the source of truth for every object that exists on both sides.
- **Verify from the far side.** `ok:true` is not proof. The email backend returns success even when it silently drops a malformed attachment — the only real evidence was opening the Sent copy and seeing the file. Check the provider dashboard, the receiving inbox, the actual charge.
- **Spike before you design.** Twenty lines proving the API behaves as documented, before a feature is designed on top of that assumption. Nearly every entry below would have been cheaper as a spike.
- **Asynchronous verification breaks synchronous assumptions.** Cards attach immediately; bank accounts take days. Any code written on "saved means attached means verified" fails the moment a slower method arrives.
- **Know which keys are secrets and which are restricted-public.** Both exist, they look identical, and treating one like the other either leaks a credential or breaks a working page. Write down which is which, by name.
- **Never put heavy work in a boot path.** An account-level API quota is a hard ceiling — retries and backoff cannot fix it, they just spend it faster.
- **Ship behind a flag, off, until a real round-trip is verified live.** Non-negotiable for anything touching money.

---

## §02 — Stripe — the one that hid a real problem behind a harmless symptom

> **The symptom · 2026-07-13**  
> Stripe emailed that it couldn't deliver live-mode events to the webhook endpoint. Chasing that email uncovered that membership billing was running entirely inside Stripe, on subscriptions the app had no link to and wasn't reconciling.

### Trap 1 — a redirect-answering endpoint can't receive webhooks

Every POST to an Apps Script `/exec` URL answers with an HTTP **302 redirect**. Stripe doesn't follow redirects, so it logged every delivery as failed — even though the handler behind the redirect always returned 200 when reached. This is a platform limitation upstream of your code; there is nothing to fix in the handler.

**Generalize it:** before choosing a webhook receiver, check what the *first hop* returns. Any host that answers with a redirect — Apps Script, some serverless proxies, anything behind an auth bounce — is incompatible with senders that don't follow them.

### Trap 2 — dual-source-of-truth billing, discovered by accident

The read-only audit that followed found the real problem:

| Checked | Found |
|---|---|
| Customers carrying a Stripe subscription id | **0** of ~2,257 |
| Customers carrying a membership status | **0** |
| Live Stripe subscriptions actively billing cards | yes — renewals, failures, a cancellation |
| Invoices produced by the app's own billing engine | **0** (nobody was enrolled) |

The daily reconciliation sweep looked healthy — it ran on schedule with a 0% error rate. It was also a complete no-op, because it only reconciles customers that carry a subscription id, and none did. **A green cron proves the cron ran, not that it did anything.** The failure mode this produced is the worst kind: cards charged after a membership had lapsed, with nothing in the app aware of it.

> **Worth noting about the note itself**  
> The first version of that handoff concluded "billing is not affected." It was wrong, and it was corrected in place with the reasoning shown. A retrospective that can't record its own wrong first answer isn't much use — leave the correction visible.

### The migration recipe (reusable)

Moving a live subscription from vendor-owned to app-owned billing without a double charge or a gap:

**01. Confirm the two prices match, exactly**
Base plus tax, to the cent, before anything moves. Ours: $299 monthly + 10.75% tax = $331.14.

**02. Enrol app-side with a start date equal to the subscription's period end**
A future start date takes the deferred path: member fields land now, $0 is charged today, and the daily cron makes the first charge on that day.

**03. Cancel the vendor subscription "at period end" — never immediately**
The vendor covers the customer through that date and never charges again; the app picks up the same day. Deleting a webhook does *not* cancel a subscription — that catches people.

### Trap 3 — the deferred path left an orphan invoice

The enrolment function created its cycle invoice *before* branching, so the deferred path returned an invoice it never charged — and the cron later minted its own on the start day. Every future-dated enrolment left a dangling unpaid invoice that had to be voided by hand. **Branch first, then create the artifact.**

### Trap 4 — ACH is not a card, and one ownership check blocked it entirely

The best single example in this repo of an assumption quietly generalising:

- Bank accounts verify by microdeposit, which takes **1–2 business days**. The setup intent therefore sits in `requires_action`, not `succeeded`.
- The provider attaches a payment method to the customer only on *successful* setup — so on a fresh bank add, the method's customer field is still `null`.
- The save handler's ownership check — written for cards — compared that null against the customer id and rejected it. **Every ACH add failed, categorically**, and the user saw card-worded copy: "That card isn't linked to this customer."

Three correct, defensible pieces of code producing a feature that could never work. **When you add a second payment method type, re-read every check written for the first one** — and make error copy name what the user actually did.

### Refunds

- Do the math in **integer cents**, and clamp the request to what's actually left: `min(requested, paid − alreadyRefunded)`.
- **The server owns the totals; the client owns the per-line split.** The server never needs to know how a refund was allocated across lines, so don't teach it.
- Treat "fully refunded" as *within a cent*, not exact equality.
- Keep the original paid amount. Don't rewrite history to make a balance come out.

---

## §03 — Texting — approval, quiet hours, and codes that can't cross over

### Build the provider seam before you need it

Carrier registration for business texting takes real calendar time and can be rejected. The thing that saved this project was a **provider selector**: the backend auto-picks the primary provider when its three credentials are all present in the secret store, and falls back to a secondary otherwise. That let the feature ship and be used while approval was pending, and go-live was a credential change, not a code change.

### Credentials: set them through an allowlisted action, not the console

- Secrets live only in the platform's property store. Never in the repo, never echoed.
- They were set through a **name-allowlisted, set-only admin action**, so the value passes through once and can never be read back out.
- The status endpoint reports **names and booleans only** — "is a token present", never the token. Build that endpoint; you'll use it constantly.
- Validate against the provider on save — confirm the number is actually SMS-capable — then send one real end-to-end test before believing it.

### Quiet hours are a product decision, and it will move

The send window started at 8am–8pm and was widened to **6am–8pm** once staff actually used it — crews start early. Two rules that survived:

- Quiet hours apply to **every** send.
- An admin may override, but **only on a manual send — never on an automated sweep**. That single carve-out is what keeps a 3am cron from texting customers.

### One-time codes: separate the namespaces

SMS codes replaced shared passwords entirely — login codes for identity, approval codes for authorising a single privileged action. The design rule worth stealing:

> **Two code types, zero overlap**  
> A **login code can never approve**, and an **approval code can never mint a session** — they live in separate storage namespaces with separate rate buckets. Approval verification returns `{ok, approver}` and **never a token**. Single-use, 5-try cap, 10-minute expiry, tier checked at mint *and* again at verify.

> **The one that's still open**  
> Approval codes take a client-supplied "required tier" string. The server enforces the approver against it but never learns *which action* is being approved. Not independently exploitable here — verification hands back no capability — but the right shape is a **server-known action → tier-floor table**. Never let the client name the authority it needs.

---

## §04 — Google Maps — a public key, and a meter that runs on keystrokes

### The key is public on purpose — but only if you actually lock it

The browser key is committed to a public repo *by design*. That's safe only because it is **HTTP-referrer-locked** to the production domain (plus localhost for dev) *and* **API-restricted** to just the three APIs in use. It is not in the secrets class. The server-side copy of the same key *is*, and must never reach a log or the UI.

Write this distinction down explicitly, because both a well-meaning security sweep (moving a restricted key into a secret store and breaking the page) and a genuine leak look the same from a distance.

### The meter runs per keystroke

- **Autocomplete bills per request.** Without session tokens, every keystroke is a billable call. With them, a whole lookup is one session. Ours also carries a **180ms debounce**.
- **Cache every geocode result permanently.** Write the resolved pin back onto the record the first time you geocode it — an address doesn't move. This was adopted as an explicit decision, not an optimisation.
- **A referrer lock limits abuse, not your own bugs.** A runaway autocomplete loop burns your quota from your own domain, which is exactly where the lock says traffic should come from.

### The APIs move under you

Distance work moved to a newer Routes library; place lookup moved to new classes. Most tutorials you'll find describe the previous generation. **Check the migration notice before copying any example** — this is a recurring tax on Google APIs specifically.

### Free win worth taking

A plain "open in Google Maps" deep link costs nothing — no key, no quota — and hands a route straight to the driver's phone navigation. Not every map problem needs an embedded map.

---

## §05 — Email — the integration that lies to you politely

### The failure that shaped everything else

> **The rule**  
> The send handler **returns success even when it silently drops a malformed attachment** — deliberately, so a bad image can never fail a real message. Which means `ok:true` proves nothing about the attachment. **The only proof is opening the Sent copy and seeing the file on it.**

That's the generalisable lesson for every send-shaped integration: if your handler is designed to degrade gracefully, then its success response cannot be your test. Verify on the receiving side.

### What made it safe

- **The recipient is resolved server-side from the record** — the client names an invoice, never an address. An isolation gate like this means a client bug can't email one customer's document to another.
- **MIME-whitelisted and size-capped** (png/jpeg, ~3MB) before decode.
- **Consent, quiet hours, rate caps and deduplication all run first**, unchanged by the attachment work. New capability rides behind existing gates.
- **Fail-safe while undeployed:** the client sent the attachment field before the backend understood it, and the old backend simply ignored it — emails kept sending, text-only. Design the client-ahead-of-server window to be a no-op, not an error.

### Two practical notes

- The backend sends as one account; the "from" addresses available to it are that account's **send-as aliases**, enumerated at runtime. Adding a sending address is a mail-account action, not a code change.
- **A cloud sandbox can't prove visual fidelity.** Rendering an invoice to an image needs real fonts and a real browser; the automated test proved the *transport*, and a separate real-device check proved the *picture*. Know which half your test actually covers.

---

## §06 — GPS & telematics — four providers, and the boot-path quota fire

The heaviest integration by far: four hardware vendors, each with its own OAuth dance, pagination quirks and refresh-token behaviour.

### Fork and run it — don't port it

We inherited a working backend from its author, whose integration guide assumed we'd port its database and token-management code into our own stack. We didn't. We forked it, deployed it unchanged as a standalone service, and called it over HTTPS.

The reason is the whole lesson: **porting means re-implementing and re-verifying every already-debugged edge case** — one vendor's broken pagination cursor, two vendors' rotating refresh tokens, the ignition-session pairing logic. None of that is interesting work, all of it is load-bearing, and rewriting it converts solved problems back into open ones.

> **The incident worth memorising**  
> A historical backfill job ran **in full on every server restart**, on top of its hourly schedule. It exhausted the vendor's **account-level** API quota and units vanished from the dashboard. An account ceiling is not a rate limit — retries and backoff don't help, they spend it faster. The fix was simply not running the backfill at boot; the trap is that any future restart-time call reintroduces it.

### The OAuth deployment loop nobody warns you about

### CORS: staging is an origin too

---

## §07 — Figma → code — eight measured traps

### First, the framing that saves the most time

**In a normal product team, nobody pulls artwork out of Figma.** Three things cross the boundary, and none of them is pixels:

| What crosses | How | Consumed as |
|---|---|---|
| Tokens | Figma variables exported to JSON | a CSS variable, never a literal hex |
| Component identity | a name mapped to a code component | you *call* it — you never redraw it |
| Art assets | exported SVG/PNG | referenced, never recreated |

Fidelity comes from **not diverging** — the designer composes from a kit whose parts already exist in code. It does not come from matching afterwards. If you find yourself recreating a component by eye, stop: either export it as art, or build it as a real component and have the design use that. The exception is UI that genuinely *is* artwork — and there the answer is the game-industry one: **export the art, don't rebuild it.**

### The eight traps, all measured here

**01. The metadata lies about overridden instances**
The API reports the *un-overridden component* position, not the instance's actual one. One channel read 149px from metadata and was really at 108px. For anything instanced, read the instance's own transform.

**02. Frame bounds are not the painted extent**
Children routinely sit outside their frame; one node's frame was 487×97 while its paint covered 683×97, offset ~194px left. One pass built an entire component from a 41×158 sliver believing it was the whole part. **Render the node and look at it** before building from numbers.

**03. Mask layers don't pair one-to-one with background layers**
Masks union rather than pairing, so only the topmost background ever shows. Use one z-ordered image or separate elements.

**04. The sub-1% paths are the bevels**
Dropping about forty "negligible" paths collapsed a panel from nine tones to six and made the metal read flat. On another part, **32 of 33** sub-1% runs had a measurable visible cost. Low area is not low value.

**05. PNG export quantizes translucent washes**
It bands them into values one channel apart. Counting those as distinct design tones fails an asset for not reproducing a rasteriser artifact. Compare tones by *distance*, not identity — and cast to a signed integer before subtracting, or byte overflow turns a difference of 1 into 36. That produced two false failures here.

**06. Paint order is load-bearing**
Draw an accent ring before the opaque plate it sits on and it disappears. It looks like a missing asset; it's z-order.

**07. Baked text doubles with live text**
Export art *without* glyphs and let the DOM supply the words — but strip only the glyphs, since the surrounding outline usually lives in the same layer group.

**08. Layer names go stale**
A layer named for one thing frequently renders another. **Trust the render, not the name.**

Two closing notes from the same work: animate **transform and opacity only** — an animated drop-shadow glow cost about 12fps across many instances and was cut, while a static one was fine. And tint art per state with a mask plus a token fill rather than exporting a copy per state.

---

## §08 — The runtime itself — the integration you forget to count

The backend platform was as expensive as any vendor on this list, and its lessons are the most transferable, because every platform has some version of them.

- **An auth path can be blocked by policy, not by configuration.** The standard CLI login is refused by an organisation-level re-authentication policy — confirmed with a brand-new token minted fresh, which failed immediately. No amount of re-logging-in fixes a server-side policy. The working path is a service account with delegated authority, impersonating a real user. **When an auth failure repeats identically on a clean credential, stop debugging the credential.**
- **The programmatic deploy is not equivalent to the console deploy.** Deploying through the API breaks the web app's anonymous access and takes the live backend down — confirmed the hard way. Go-live is now deliberately a human click, and the script's deploy subcommand is guarded against being used. If two deploy paths exist, prove they're equivalent before trusting the convenient one.
- **Have one post-deploy check that proves the thing you're most afraid of.** Ours: an anonymous request with a deliberately wrong password must come back as a clean "unauthorized" at HTTP 200. That single call proves the endpoint is still reachable anonymously *and* still rejecting bad credentials.
- **Know when every environment shares one backend.** Local, staging and production all hit the same backend and the same payment account here. That's a legitimate choice, but it means "just testing" touches real records — and it has to be stated out loud, repeatedly, or someone will assume otherwise.

---

## §09 — Pre-flight checklist for the next integration

Half a day before the build, against every one of these.

> **Before you design anything**  
> - **Ownership.** For every object existing on both sides, which system is the source of truth? Write it down. What reconciles them, and how would you know it did nothing?
> - **Spike it.** Twenty lines against the real API. Does it behave the way the docs claim?
> - **Slow paths.** Which operations are asynchronous or take days? What does your code assume finishes immediately?
> - **Second variants.** When a second type arrives — another payment method, another provider, another channel — which checks written for the first will wrongly reject it?

> **Before you ship it**  
> - **Credentials** in the platform's secret store only; a status endpoint that reports presence, never values.
> - **Every origin** that will call it is allowed — including staging.
> - **No heavy work in a boot path.** Quotas are ceilings, not limits.
> - **Behind a flag, off**, with the un-flagged path a safe no-op.
> - **One real round-trip verified from the far side** — the Sent copy, the provider dashboard, the actual charge — before the flag flips.
> - **The error copy names what the user actually did**, not what the first version of the feature assumed they did.

---

Every trap above was found by something breaking in production, and every one of them is written down here because writing it down is cheaper than finding it twice. That is the entire method: **the notes are the deliverable, and the working code is the by-product.**

---
