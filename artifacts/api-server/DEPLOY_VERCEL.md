# Deploy Backend ke Vercel (End-to-End)

Dokumen ini adalah panduan lengkap deploy backend `api-server` ke Vercel dari nol sampai live.

## Arsitektur

1. Backend berjalan sebagai Vercel Serverless Function di `api/[...path].ts`.
2. Semua endpoint backend menggunakan prefix `/api/*`.
3. Project ini berbentuk monorepo pnpm (workspace), jadi konfigurasi root directory harus benar.
4. Vercel akan auto-detect folder `api/`, jadi tidak perlu config runtime custom.

## Prasyarat

1. Repository sudah ada di GitHub dan branch `main` ter-update.
2. Sudah punya database PostgreSQL publik.
3. Nilai connection string database siap dipakai sebagai `DATABASE_URL`.

Contoh provider database: Vercel Postgres, Neon, Supabase, Railway Postgres, atau provider lain.

## Konfigurasi di Vercel (Disarankan)

Gunakan project Vercel terpisah untuk backend.

1. Buka Vercel dashboard.
2. Klik Add New Project dan import repository ini.
3. Pada konfigurasi project, set:
	- Root Directory: `artifacts/api-server`
	- Framework Preset: `Other`
	- Build Command: kosongkan (biarkan default)
	- Output Directory: kosongkan
4. Tambahkan Environment Variable:
	- Key: `DATABASE_URL`
	- Value: URL postgres produksi
5. Deploy.

Catatan:
1. Handler serverless sudah memakai `bodyParser: false` agar payload `sendBeacon` tetap terbaca.
2. File `api/[...path].ts` akan langsung dipakai oleh Vercel tanpa routing tambahan.

## Verifikasi Setelah Deploy

Misal domain backend kamu: `https://backend-bop.vercel.app`

1. Cek health endpoint:
	- `https://backend-bop.vercel.app/api/healthz`
2. Inisialisasi tabel (idempotent, aman dipanggil ulang):
	- `https://backend-bop.vercel.app/api/bop/init-db`
3. Cek koneksi DB:
	- `https://backend-bop.vercel.app/api/bop/ping`

Jika ketiganya sukses, backend siap dipakai frontend.

## Integrasi ke Frontend Vercel

### Jika frontend dan backend beda domain

1. Buka project frontend di Vercel.
2. Tambahkan env frontend:
	- `VITE_API_BASE=https://backend-bop.vercel.app`
3. Redeploy frontend.

Kenapa perlu redeploy:
1. Build frontend menulis `public/api-config.json` berdasarkan `VITE_API_BASE`.
2. Tanpa redeploy, browser masih bisa memakai URL API lama.

### Jika frontend dan backend satu domain/project

1. Tidak perlu set `VITE_API_BASE`.
2. Frontend otomatis memakai endpoint relatif `/api/*`.

## Checklist Go-Live

1. `DATABASE_URL` sudah diisi untuk Production (dan Preview jika perlu).
2. Endpoint `/api/healthz` merespon `{ "status": "ok" }`.
3. Endpoint `/api/bop/ping` merespon sukses.
4. Endpoint `/api/bop/init-db` sudah pernah dipanggil minimal sekali.
5. Frontend sudah redeploy jika domain backend terpisah.

## Troubleshooting Cepat

### Error "DATABASE_URL must be set"

1. Pastikan env `DATABASE_URL` ada di Vercel project backend.
2. Setelah menambah env, lakukan redeploy.

### Frontend masih menembak API lama

1. Update `VITE_API_BASE` di project frontend.
2. Redeploy frontend agar `api-config.json` ter-generate ulang.

### Error koneksi SSL PostgreSQL

1. Coba connection string mode SSL dari provider DB.
2. Pastikan database mengizinkan koneksi dari internet (bukan private-only).

## Catatan Operasional

1. Endpoint init DB dibuat idempotent, jadi aman dipanggil berkala.
2. Untuk rollback cepat, gunakan Deployments tab di Vercel lalu Promote deployment sebelumnya.
