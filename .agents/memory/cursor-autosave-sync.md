---
name: Cursor-safe autosave and sync
description: Rules for preserving caret position while local autosave and PostgreSQL polling run.
---

Input handlers must update in-memory data without rebuilding the active form. Local persistence should be debounced, and server snapshots should only re-render when the server version is newer and no field is actively being edited.

**Why:** Replacing form/table DOM during a keystroke loses the focused element and caret position; repeated same-version polling made this appear to be an autosave problem.

**How to apply:** Keep render calls on blur/change or explicit structural actions, flush pending local persistence on unload, and compare sync versions before applying remote data.

When conflict resolution selects the local snapshot, never stamp it with the server version or treat it as clean. Keep it dirty and retry against the server's actual version; otherwise polling can stop forever while devices diverge.

**Why:** A client can have a newer local snapshot than the server after an interrupted or previously rejected push. Recording the older server version as if it belonged to that local payload hides the divergence.

**How to apply:** Track dirty/local-edit metadata separately from the last acknowledged server version, and force an explicit remote replacement only for a user-requested pull.