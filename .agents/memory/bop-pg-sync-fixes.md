---
name: BOP PostgreSQL Sync Bugs Fixed
description: Critical multi-device sync bugs identified and fixed in app.js + bop.ts
---

## Fixed Bugs (multi-device sync)

**Why:** Data tidak sinkron antar device — perubahan di satu device tidak muncul di device lain.

### Bug 1 — `Object.assign` tidak deep copy (sekarang pakai JSON parse/stringify)
`Object.assign(data, serverData)` bisa membawa reference — sekarang `Object.assign(data, JSON.parse(JSON.stringify(serverData)))` di bootLoadFromServer, silentPoll, dan manual pull.

### Bug 2 — Seed race condition (v1.40d)
Seed v1.40d berjalan 600ms setelah load, bisa overwrite data server dengan defaults sebelum bootLoadFromServer selesai fetch. Fix: timeout seed dinaikkan ke 3000ms DAN tambah guard `if (serverVer > 0) return`.

### Bug 3 — Edit terakhir hilang saat tab ditutup
Debounce 2 detik → edit hilang jika user tutup tab. Fix: `window.addEventListener('beforeunload', ...)` pakai `navigator.sendBeacon('/api/bop/data-beacon', blob)` untuk flush segera.

### Bug 4 — silentPoll overwrite saat user aktif push
Poll 10 detik bisa tarik data lama dan overwrite sementara push lokal belum selesai. Fix: `if (pushInFlight || pushTimer) return` di awal silentPoll.

### Bug 5 — Tidak ada 304 (poll selalu download full JSON)
Client sudah handle 304 tapi server tidak mengirimnya. Fix: GET /api/bop/data sekarang kirim `ETag: version` dan cek `If-None-Match` header → kirim 304 jika match.

## New endpoint
`POST /api/bop/data-beacon` — khusus sendBeacon (terima text/plain + application/json). Express middleware `express.text()` ditambahkan di app.ts untuk handle content-type non-JSON dari sendBeacon.

## How to apply
- Semua fix ada di `artifacts/bop-app/public/app.js` (patches v1.40) dan `artifacts/api-server/src/routes/bop.ts`
- Jangan timpa `window.data` references di PATCH 012B — itu yang expose `data` ke global scope
- Saat test beacon endpoint dengan curl, JANGAN kirim data sembarangan ke `/api/bop/data-beacon` karena akan overwrite DB production
