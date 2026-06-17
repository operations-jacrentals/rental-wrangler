# Requests inbox — backend handlers to paste (Code.gs)

The richer inbox (see what Mr. Wrangler wants, the photos, and continue the
conversation) is **live in the app today**. The text + conversation already work
from the issue body. Two things light up once you paste these `Code.gs` handlers
and redeploy: **photos in the inbox**, and the **chat syncing back to the issue**.

Everything degrades gracefully — if a handler isn't there yet, the app just skips
that piece (no errors).

The app calls these actions (all POST `{action, password, …}`, same as the rest):

## 1. `wranglerFile` — now also carries photos

The app sends `images: [dataUrl, …]` (≤8, already downscaled) alongside the
existing `{title, body, label}`. Upload each to Drive (reuse your existing
`uploadFile` helper) and **append them to the issue body as markdown images**, so
they ride along and show everywhere:

```js
case 'wranglerFile': {
  const { title, body, label, images } = req;
  let md = body || '';
  (images || []).forEach((dataUrl, i) => {
    const link = uploadImageToDrive_(dataUrl, `wrangler-${Date.now()}-${i}.png`); // returns a public view URL
    if (link) md += `\n\n![photo ${i + 1}](${link})`;
  });
  const issue = githubCreateIssue_(title, md, [label]); // your existing GitHub REST call
  return json({ ok: true, number: issue.number });
}
```

`uploadImageToDrive_`: write the base64 to Drive, set sharing to
*anyone-with-link*, and return `https://drive.google.com/uc?export=view&id=<id>`
(that form renders in an `<img>`).

## 2. `wranglerRequests` — return the photos

Add an `images` array (the Drive view URLs) to each request. Easiest: parse the
`![](…)` links straight out of the issue body you already return:

```js
const images = [...String(body).matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m => m[1]);
// → { number, title, body, url, images }
```

## 3. `wranglerComment` — mirror a chat turn onto the issue

The app calls this on every turn while you're talking to Mr. Wrangler from a
request (`role` is `"user"` or `"assistant"`):

```js
case 'wranglerComment': {
  const { number, role, text, images } = req;
  const who = role === 'assistant' ? '🤠 **Mr. Wrangler**' : '**Jac**';
  let md = `${who}: ${text || ''}`;
  (images || []).forEach((d, i) => { const l = uploadImageToDrive_(d, `c-${Date.now()}-${i}.png`); if (l) md += `\n\n![photo](${l})`; });
  githubAddComment_(number, md); // POST /issues/{number}/comments
  return json({ ok: true });
}
```

## 4. `wranglerThread` — replay prior back-and-forth (optional but nice)

So reopening a request shows the whole thread, not just the original filing.
Return the issue's comments that we wrote (prefixed with `**Jac**:` /
`🤠 **Mr. Wrangler**:`):

```js
case 'wranglerThread': {
  const comments = githubListComments_(req.number); // GET /issues/{number}/comments
  const messages = comments.map(c => {
    const assistant = /Mr\. Wrangler/.test(c.body.slice(0, 40));
    return {
      role: assistant ? 'assistant' : 'user',
      text: c.body.replace(/^[^:]*:\s*/, '').replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim(),
      images: [...c.body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m => m[1]),
    };
  });
  return json({ ok: true, messages });
}
```

You already have `githubCreateIssue_` (the existing `wranglerFile`) and the
`GITHUB_TOKEN` Script Property with Issues RW — `githubAddComment_` /
`githubListComments_` are the same REST surface (`/issues/{n}/comments`). Paste,
redeploy the web app, and the inbox is fully wired.

## 5. `wranglerNotifications` — ring the bell when a fix the user reported ships

The §18f notification bell + feed is **already live in the frontend** (the bottom-right
bell FAB, its unseen badge, and the Notifications popup). It's the in-app answer to
"how do I know when you fixed it?" — but it stays empty until this handler feeds it.
The app polls `wranglerNotifications` on boot and renders each entry the moment a fix
the user reported is resolved, **no GitHub trip required**.

A fix "ships" when its issue is **closed-as-completed** (the auto-fixer's merged PR
says `Closes #n`). The **verdict** shown in the bell is Mr. Wrangler's closing comment
— the last comment on the issue. Return the most recent resolved fixes:

```js
case 'wranglerNotifications': {
  const SINCE = new Date(Date.now() - 30 * 864e5).toISOString();   // last 30 days
  // Same REST surface as the others: GET /issues?state=closed&labels=wrangler-fix
  //   &since=<iso>&sort=updated&direction=desc&per_page=20  (githubListIssues_ is your
  //   thin wrapper, just like githubListComments_).
  const issues = githubListIssues_({ state: 'closed', labels: 'wrangler-fix', since: SINCE, per_page: 20 });
  const notifications = (issues || [])
    .filter((is) => !is.pull_request && is.state_reason !== 'not_planned')   // shipped (not dismissed), skip PRs
    .slice(0, 15)
    .map((is) => {
      const comments = githubListComments_(is.number) || [];
      const last = comments.length ? comments[comments.length - 1].body : '';
      const verdict = String(last)
        .replace(/^[^:\n]*Mr\.?\s*Wrangler[^:\n]*:\s*/i, '')   // drop a "🤠 Mr. Wrangler:" prefix if present
        .replace(/!\[[^\]]*\]\([^)]+\)/g, '')                  // strip image markdown
        .trim();
      return { number: is.number, title: is.title, verdict, merged: true, closedAt: is.closed_at, url: is.html_url };
    });
  return json({ ok: true, notifications });
}
```

The shape matches exactly what §18f renders: `{ number, title, verdict, merged,
closedAt, url }`. `merged: true` flags the ✅ (a shipped fix vs. an ⓘ note); a
dismissed (`not_planned`) issue is filtered out so the bell only ever celebrates
real ships. The frontend tracks "seen" by max issue number in `localStorage`, so the
unseen-count badge clears itself once the user opens the bell — nothing to do here.

> Optional (from the 2026-06-16 addendum below): also fold in open
> `wrangler-needs-jac` issues as `{ kind: 'needs', … }` so the same bell alerts when
> Mr. Wrangler is waiting on *you*, not just when a fix ships.

## Until you paste these

- **Now (no paste):** every request shows its full write-up + the original
  conversation; **Talk to Mr. Wrangler** reopens the chat seeded from it and you
  can go back and forth live (the AI runs through your existing `wrangler` action).
- **After the paste:** photos appear in the inbox + chat, the back-and-forth is
  recorded on the GitHub issue (so it survives across sessions/devices), and the
  **notification bell lights up** when a fix the user reported ships (#5).

## Discuss-before-build + mid-build "needs you" (2026-06-16)

Three small deltas light up the lifecycle states (see
`docs/superpowers/specs/2026-06-16-discuss-before-build-flow.md`). All optional —
the chat plan-gate + inbox work without them.

1. **Return each issue's labels** in `wranglerRequests` so the inbox can tag state
   (`Needs your OK` = `wrangler-request`, `Needs your answer` = `wrangler-needs-jac`,
   `Building` = `wrangler-fix`). Just add `labels: issue.labels.map(l => l.name)` to
   each returned request.

2. **Resume on answer.** When `wranglerComment` posts to an issue currently labelled
   `wrangler-needs-jac`, also **relabel it `wrangler-fix`** (remove `wrangler-needs-jac`)
   so the engine re-fires and resumes from the full thread. (The engine already
   sets `wrangler-needs-jac` + posts its question when it pauses.)

3. **Ring the bell.** Have `wranglerNotifications` also include open
   `wrangler-needs-jac` issues (e.g. `{ kind: 'needs', number, title, question }`)
   so the notification bell alerts when Mr. Wrangler is waiting on you — not just
   the inbox badge.

