---
name: BOP PostgreSQL Primary Storage
description: How BOP data is persisted to Replit PostgreSQL — tables, API routes, and frontend patches.
---

# BOP PostgreSQL Primary Storage

## Tables
- `bop_data` — singleton per RT (rt_key='rt005rw012'), full data JSONB, version integer, updated_at
- `bop_history` — append-only doc history with kind/doc_type/label/html columns
- `bop_snapshots` — legacy cloud backup (kept for compat)
- `moku_photos`, `moku_results_sync` — existing MoKu tables

## API Routes (api-server port 8099)
- `GET /api/bop/data` — fetch latest data + version
- `PUT /api/bop/data` — upsert with version increment (ON CONFLICT rt_key)
- `GET /api/bop/history`, `POST /api/bop/history`, `DELETE /api/bop/history/:id`
- `GET /api/bop/status` — stats endpoint
- `/api/sync/*` — now delegates to PostgreSQL (not file JSON)

## Frontend Patches (app.js EOF)
- **PATCH v1.40**: Intercepts `localStorage.setItem(STORE, ...)` → debounced (2s) async PUT /api/bop/data. On boot: GET /api/bop/data; if server newer (version>local), merge and update localStorage using `_origSetItem` (bypasses interceptor to avoid loop). Badge ☁ shown top-right fixed position.
- **PATCH v1.40b**: Updates `.side-note` sidebar element to show "☁ PostgreSQL v{n} — date".
- **PATCH v1.40c**: Guard — on first run (FIX_KEY flag), if data.master is missing kelurahan/kecamatan, clears localStorage + version keys and reloads once. Prevents corrupt partial data from server overwriting valid local data.
- **PATCH v1.40d**: Seed — on DOMContentLoaded, if localStorage is empty but window.data has valid master, writes to localStorage to trigger interceptor and upload defaults to server.

## Key Design Decisions
**Why JSONB not normalized tables**: app.js is ~5200 lines of vanilla JS with deeply nested data. Normalizing would require rewriting all 50+ save points. JSONB lets server be primary storage without frontend rewrite.

**Why localStorage stays**: offline fallback; also used as the write buffer (interceptor pattern). Server is authoritative when version > local.

**Merge gotcha**: When loading server data, use `_origSetItem` (not `localStorage.setItem`) to avoid triggering another push. Shallow Object.assign is used with master field guards in v1.40c.

**Version tracking**: `bop_pg_version_v40` and `bop_pg_updated_v40` localStorage keys track last sync state. These are separate from the app's data store key.
