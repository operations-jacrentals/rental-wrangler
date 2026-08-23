---
name: build
description: Build the current Rental Wrangler feature to deploy-ready, committed, pushed state, then stop before staging.
---

# Build

Build everything currently safe and approved on the feature branch. Apply the map and canon as relevant, defer money/pricing, auth/roles, customer PII, work-order completion, and irreversible/live decisions in a short batched report, then run `npm run gates`. Commit and push the feature branch only after gates pass. Stop deploy-ready: do not deploy, merge, open a trunk PR, or promote.
