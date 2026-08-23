---
name: deploy
description: Deploy the committed Rental Wrangler feature branch to staging, verify the new bytes, and report the review URL.
---

# Deploy

Run `npm run deploy:staging` for the committed feature branch. Print the returned staging review URL and verify that it serves the new bytes, not merely a matching token. Follow the staging safety rules in `AGENTS.md`: a failed or unverified deploy is a hard stop and staging must never fall behind.
