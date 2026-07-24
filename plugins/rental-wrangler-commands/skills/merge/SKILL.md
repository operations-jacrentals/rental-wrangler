---
name: merge
description: Integrate a reviewed Rental Wrangler feature through the protected trunk merge flow with automatic CI-wait and squash cleanup.
---

# Merge

First require evidence that this feature was deployed to staging and reviewed; if not, stop and tell Jac to run `$rental-wrangler-commands:deploy`. Then run `npm run gates` and stop if red, push the feature branch, and create a ready (not draft) PR into `trunk`. Use `gh pr merge --auto --squash --delete-branch` to automate the CI wait, squash, and branch cleanup. Never push directly to `trunk`, never promote here, and never add the `auto-promote` label to a normal feature PR.
