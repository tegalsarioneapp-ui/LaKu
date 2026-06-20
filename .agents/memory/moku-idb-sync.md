---
name: MoKu IndexedDB + BOP Sync
description: Photo storage via IndexedDB (bop_rt005_idb_v1), BOP auto-sync from localStorage, PostgreSQL cloud backup.
---

## Architecture

### IndexedDB (public/moku/db.js)
- Database: `bop_rt005_idb_v1` v1
- Stores: `photos` (keyPath: id, index: activityId), `bop_snapshots` (keyPath: ts), `moku_state` (keyPath: key)
- `window.MokuDB` singleton — loaded BEFORE app.js in index.html
- `const photoCache = new Map()` in app.js — runtime photoId→dataUrl cache

### Photo storage flow
1. `capturePhoto()` → `savePhoto(dataUrl, ...)` → saves metadata to state (NO dataUrl), saves `{...meta, activityId, dataUrl}` to IDB
2. `loadPhotoCache()` runs on boot — migrates old state photos (with dataUrl) to IDB, loads all IDB photos into photoCache
3. `photoCard()`, `openLightbox()`, `downloadPhoto()` use `photoCache.get(id) || p.dataUrl || ""`

### BOP Sync
- `getBopData()` reads localStorage key `bop_rt005_data_v1_25` (same origin — both apps share localStorage)
- `rapToActivity(r, idx)` maps RAP item → MoKu activity with stable ID `bop-rap-{uraian_slug}-{bulan}`
- `syncFromBOP({ silent? })` — adds new, updates existing BOP-sourced activities; saves BOP snapshot to IDB
- Auto-sync on boot (500ms delay), auto-sync is silent, shows toast only if new items found
- `checkBopSync()` shows red badge on "Sinkron BOP" button if new items available

### PostgreSQL (via api-server)
- Tables: `moku_photos` (metadata only, no dataUrl), `bop_snapshots` (JSONB), `moku_results_sync`
- Endpoints: `POST /api/db/bop-sync`, `POST /api/db/photos`, `POST /api/db/results-sync`, `GET /api/db/stats`
- Cloud sync is best-effort (background fetch, errors silently ignored)

**Why:** localStorage has 5-10MB limit — photos quickly overflow it. IndexedDB has no practical limit and persists reliably.
