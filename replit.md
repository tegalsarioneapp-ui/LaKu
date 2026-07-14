# BOP RT 005 Offline Manager

Sistem manajemen administrasi Bantuan Operasional RT untuk RT 005 RW 012 Tegalsari, Candisari, Kota Semarang. Mencakup pengajuan dana operasional, RAP (Rencana Anggaran Penggunaan), LPJ/SPJ, monitoring administrasi, dan generasi dokumen resmi.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8099)
- `pnpm --filter @workspace/bop-app run dev` — run the BOP web app (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required env: `SESSION_SECRET` — session secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: Vanilla HTML/CSS/JS (BOP app) served via Vite static public/
- API: Express 5 (api-server)
- Build: esbuild (CJS bundle for api-server)

## Where things live

- `artifacts/bop-app/index.html` — main HTML shell for BOP app
- `artifacts/bop-app/public/app.js` — all BOP app logic (4376+ lines, vanilla JS)
- `artifacts/bop-app/public/styles.css` — all BOP app styles
- `artifacts/bop-app/public/assets/` — logo and other static assets
- `artifacts/api-server/src/routes/download.ts` — ZIP download endpoint
- `lib/api-spec/openapi.yaml` — OpenAPI spec (healthz only currently)

## Architecture decisions

- **Vanilla HTML/JS approach**: The original BOP app is a complex vanilla JS app (~4400 lines). Rather than rewriting in React, we serve it as static files from Vite's `public/` directory. This preserves all existing functionality.
- **localStorage persistence**: All data is stored in browser localStorage (key: `bop_rt005_data_v1_25`). No database needed for core functionality.
- **Download feature**: `GET /api/download-app` streams a ZIP of the app files (index.html + public/) for offline/local use.
- **Vite as static server**: The bop-app Vite artifact serves index.html with `<script src="app.js">` (non-module) loaded from public/. Vite's public/ directory serves these files correctly.

## Product

- **Pengajuan Dana Operasional**: Buat 7 syarat dokumen pengajuan (Surat Permohonan, RAP, Berita Acara, Daftar Hadir, SPTJM, RBB, Checklist)
- **LPJ/SPJ**: Laporan Pertanggungjawaban dengan rincian pengeluaran
- **Persiapan Kegiatan**: Undangan, daftar hadir, notulen, kuitansi kegiatan operasional  
- **MoKu Mobile**: Dokumentasi kegiatan lapangan dengan kamera
- **Monitoring**: Kontrol kesiapan dokumen per bulan
- **Download App**: Download seluruh aplikasi sebagai ZIP untuk digunakan offline

## User preferences

- Tambah fitur bagus langsung tanpa bertanya
- Jangan mengubah desain utama aplikasi
- Hasil harus bisa di-download

## Gotchas

- `app.js` di `public/` bukan module ES — tidak diproses Vite, hanya di-serve sebagai static file
- Perubahan `app.js` di public/ tidak perlu restart (served as-is)
- Restart api-server diperlukan setelah perubahan backend
- archiver v8 di api-server adalah ESM — gunakan `import { ZipArchive } from "archiver"` bukan factory function lama

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
