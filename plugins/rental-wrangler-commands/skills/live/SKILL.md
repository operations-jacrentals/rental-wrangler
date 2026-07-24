---
name: live
description: Run Rental Wrangler deploy, reviewed protected merge, and explicit production promotion end to end.
---

# Live

Run `$rental-wrangler-commands:deploy` → `$rental-wrangler-commands:merge` → `$rental-wrangler-commands:promote` in order. Stop and report any red gate, staging verification failure, surprising promote range, or decision touching money/pricing, auth/roles, customer PII, or work-order completion. If the branch changes no served site files (config-only), use `$rental-wrangler-commands:merge` alone: no deploy and no promote. Invoking this command is Jac's explicit go-live decision, but all gates and review stops remain mandatory.
