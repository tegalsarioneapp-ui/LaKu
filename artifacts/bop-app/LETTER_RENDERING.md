# Letter Rendering Standard

## Ringkasan perubahan
- Semua output surat kini memakai satu renderer baku untuk header kop, preview, dan export PDF/print.
- Header surat menggunakan layout grid yang konsisten: logo di kiri, blok teks kop di pusat horizontal kanan logo.
- CSS render dan aturan page-break diseragamkan agar teks tidak terpotong saat dicetak atau diekspor ke PDF.

## Standar yang diterapkan
- Logo: selalu ditempatkan di sisi kiri atas dengan ukuran tetap.
- Blok teks kop: selalu berada di sebelah kanan logo dan terpusat secara horizontal.
- Margin dan padding: diatur konsisten untuk mencegah tumpang tindih antar browser.
- Page-break: elemen sign-off dan bagian panjang dihindari agar tidak terpotong di tengah halaman.

## Validasi
- Jalankan pengujian: `pnpm --filter @workspace/bop-app test:letters`
- Jalankan build: `pnpm --filter @workspace/bop-app build`
