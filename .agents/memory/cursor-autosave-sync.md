---
name: Cursor-safe autosave and sync
description: Rules for preserving caret position while local autosave and PostgreSQL polling run.
---

Input handlers must update in-memory data without rebuilding the active form. Local persistence should be debounced, and server snapshots should only re-render when the server version is newer and no field is actively being edited.

**Why:** Replacing form/table DOM during a keystroke loses the focused element and caret position; repeated same-version polling made this appear to be an autosave problem.

**How to apply:** Keep render calls on blur/change or explicit structural actions, flush pending local persistence on unload, and compare sync versions before applying remote data.