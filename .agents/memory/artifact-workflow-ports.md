---
name: Artifact workflow ports
description: Working-directory and validation rules for managed API artifacts in this workspace
---

Managed artifact services run their development command from the artifact directory, not necessarily the monorepo root. Their declared local port must also match the port reserved for that service; otherwise a command can fail from an incorrect `cd` or a port collision.

**Why:** The API artifact initially failed because it inherited the web app's default port and a root-relative `cd`; the existing API service remained healthy on its assigned port.

**How to apply:** For a managed artifact workflow, use a command relative to its artifact working directory and keep the TOML service port, development `PORT`, and production `PORT` aligned. When JavaScript is served from a public directory, run a standalone syntax check in addition to the frontend build.