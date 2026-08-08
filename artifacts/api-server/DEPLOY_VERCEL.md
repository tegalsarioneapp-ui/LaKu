# Deploy Backend ke Vercel Serverless

Dokumen ini menggantikan deployment Railway untuk backend `api-server`.

## Ringkasan

- Backend sudah disiapkan untuk Vercel Serverless Function di `api/[...path].ts`.
- Semua endpoint tetap sama: `/api/*`.
- Frontend tidak perlu ubah endpoint jika backend dan frontend berada di domain Vercel yang sama.

## Opsi Deploy

1. Satu project Vercel khusus backend.
2. Root Directory: `artifacts/api-server`.

## Environment Variables Wajib

1. `DATABASE_URL`

Gunakan Postgres yang bisa diakses publik (contoh: Vercel Postgres, Neon, Supabase, atau provider lain).

## Endpoint Penting Setelah Deploy

1. Health: `/api/healthz`
2. Ping DB: `/api/bop/ping`
3. Init tabel: `/api/bop/init-db`

## Langkah Aktivasi

1. Buat project baru di Vercel dari repo ini.
2. Set Root Directory ke `artifacts/api-server`.
3. Tambahkan env `DATABASE_URL`.
4. Deploy.
5. Buka `/api/bop/init-db` sekali untuk buat tabel.
6. Verifikasi `/api/healthz` dan `/api/bop/ping`.

## Integrasi dengan Frontend Vercel

Jika frontend dan backend beda domain Vercel:

1. Set env frontend: `VITE_API_BASE=https://<backend-vercel-domain>`
2. Build ulang frontend agar `public/api-config.json` terisi URL backend.

Jika frontend dan backend satu domain/project:

1. Tidak perlu set `VITE_API_BASE`.
2. Frontend otomatis hit endpoint relatif `/api/*`.
