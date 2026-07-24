---
name: live
description: Run the Rental Wrangler ship flow from approved feature through staging, protected merge, and human-approved promotion.
---

# Live

Follow `AGENTS.md`'s complete `Gates and ship flow` in order: build, `npm run gates`, `npm run deploy:staging`, review, PR/squash-merge, then the `promote` procedure. Do not bypass any approval, staging, or exact-range confirmation gate.
