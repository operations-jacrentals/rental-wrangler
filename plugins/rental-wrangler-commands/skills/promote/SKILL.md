---
name: promote
description: Take reviewed Rental Wrangler trunk bytes live to production on Jac's explicit call only.
---

# Promote

This command is the only live-site operation and is authorized only by Jac explicitly invoking it. Refuse if staging does not match trunk. Run `npm run promote` first as the read-only preview, inspect the content-freshness result and commit range, then run the tool's confirmed `--yes` promotion path to fast-forward `production` to `trunk` and verify the live bytes. Stop on any mismatch or surprising range; never force-push.
