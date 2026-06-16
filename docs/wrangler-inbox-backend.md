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

## Until you paste these

- **Now (no paste):** every request shows its full write-up + the original
  conversation; **Talk to Mr. Wrangler** reopens the chat seeded from it and you
  can go back and forth live (the AI runs through your existing `wrangler` action).
- **After the paste:** photos appear in the inbox + chat, and the back-and-forth
  is recorded on the GitHub issue (so it survives across sessions/devices).

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

