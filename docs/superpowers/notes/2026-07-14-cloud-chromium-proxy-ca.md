# Parked: cloud sessions can't browser-drive the live staging URL

**Parked 2026-07-14** from the go-live session (`claude/rental-wrangler-go-live-5la4p7`).
**Status:** platform-level limitation — raise with the cloud/CCR platform team. Not fixable
from inside a session. Reliable workaround is documented below and was used to verify that
day's go-live.

## The gap

CLAUDE.md's staging-review discipline says to **drive the running app** in a browser before
"merge it" (log in, exercise the feature). In a **cloud** Claude Code session that can't be
done against the live **staging** (or production) URL: a headless browser cannot load
`https://operations-jacrentals.github.io/rental-wrangler-staging/` — every attempt ends in
`net::ERR_CONNECTION_RESET`.

## Root cause (proven via Chrome's `--log-net-log`)

- Cloud sessions route all outbound HTTPS through a **TLS-terminating (MITM) agent proxy**.
  Every certificate the browser sees is re-signed by the proxy's own CA.
- Headless Chromium/Chrome **does not trust that proxy CA**, so the request fails at
  `SSL_CONNECT` / `CERT_VERIFY_PROC` with `ERR_CERT_AUTHORITY_INVALID`.
- `github.io` is **HSTS-preloaded**, so Chrome escalates that cert failure to a **fatal
  connection reset** — and `--ignore-certificate-errors` cannot override an HSTS host.
- `curl` works fine (it trusts the sandbox CA bundle and uses a single connection), which is
  why byte-level checks still succeed — but `curl` can't render or drive UI.

## What was tried (all failed or proved unreliable)

- Import the proxy CA into the NSS user db (`certutil`, trust `C,,` and `CT,C,C`).
- Add it to the system store (`update-ca-certificates`).
- Install **full google-chrome** (the pre-installed Playwright Chromium is a stripped build).
- Chrome **`CACertificates` enterprise policy** under `/etc/opt/chrome/policies/managed/`.
- Disable ECH + DNS HTTPS/SVCB records; force the legacy cert verifier.
- `--ignore-certificate-errors` and `--ignore-certificate-errors-spki-list=<proxy CA SPKI>`.

**Closest:** full google-chrome + the `CACertificates` policy + `--headless=new` **did load
live staging twice**, then reset on later loads (flaky). Two hard blockers remain:
1. **Playwright's default headless (`headless_shell`) ignores enterprise policies**, so the
   one mechanism that worked at all isn't reachable through the Playwright API.
2. Even direct new-headless Chrome was inconsistent — likely the CONNECT-only egress proxy
   racing/limiting the browser's many parallel connections (curl's single connection always
   works).

## Reliable workaround (use this in cloud sessions today)

For the staging-review gate from a cloud session:
1. **Authoritative freshness/bytes:** `curl` the live staging URL and grep the `app.js?v=`
   token (full TLS validation via the proxy). `tools/deploy-staging.mjs` already self-verifies
   this; `tools/promote.mjs`'s freshness gate enforces it.
2. **Visual/UI review:** serve the exact staged bytes locally and render them headless —
   `#local` (offline demo boot, `offlineBoot()`) drives the full authenticated app UI with no
   backend; loading the root with no hash renders the login screen. Because the local bytes are
   byte-identical to what `curl` confirmed live on staging, the rendering is faithful.

This is a **supplement**, not a replacement, for a real staging drive — but until the platform
gap is fixed it's the dependable path, and it's what verified the 2026-07-14 go-live
(the R32 phone jog chip + the login-UX changes).

## To actually fix (needs platform change)

Either (a) ship the cloud image with the agent proxy's CA pre-trusted in a way Playwright's
Chromium honors, or (b) provide a browser/launch path whose HTTPS through the CONNECT proxy is
reliable (no reset on parallel connections). Then restore the in-browser staging drive in the
CLAUDE.md review discipline.
