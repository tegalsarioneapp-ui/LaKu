---
name: GitHub push authentication
description: Environment-specific distinction between the GitHub connector and Replit's shell Git provider authentication.
---

The GitHub connector can read repository data while the shell `git push` remote remains unauthenticated. Replit's connector OAuth binding is not automatically installed as a Git credential helper for the local Git CLI.

**Why:** A repository can report healthy connector access and push permissions through the GitHub API while `git push` still fails with “Invalid username or token.” GitHub write endpoints may also be blocked by the connector proxy's Cloudflare layer.

**How to apply:** Keep the local merge commit intact, do not force-push or paste a token into chat, and reconnect the repository through Replit's Git Providers/Git pane authentication before retrying `git push`.