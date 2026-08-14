---
name: Global Print KOP
description: Arsitektur KOP surat reusable untuk seluruh jalur dokumen, screen preview, browser print, dan iframe PDF.
---

## Rule

KOP resmi dipusatkan di `public/print-kop.js` dan `public/print-kop.css`. Script global dimuat paling akhir setelah seluruh script legacy sehingga `window.kopHTML()` menjadi satu sumber KOP untuk semua generator dokumen.

**Why:** Aplikasi LaKu adalah renderer vanilla-JS legacy dengan banyak patch historis. Memusatkan KOP di script terakhir menghindari pengeditan manual di setiap generator dan membuat screen preview serta iframe print memakai kontrak yang sama.

## Global print contract

- `.print-area` memakai A4 portrait dengan margin atas 2cm, kanan 2cm, bawah 2cm, kiri 3cm.
- `-webkit-print-color-adjust: exact` dan `print-color-adjust: exact` diterapkan pada area cetak.
- `.print-kop` memakai Flexbox tiga kolom seimbang: Logo RT 005 kiri, teks tengah, Logo Pemkot Semarang kanan.
- Logo utama memakai ukuran tetap 90px.
- Garis ganda di bawah KOP dibuat dengan `.print-kop::after` agar tajam saat diprint.

## Jalur yang memakai modul

1. `window.kopHTML()` untuk `official()`, `docLpj()`, RAP, RBB, dan dokumen PK.
2. `window.cleanPrint()` dan `window.cleanPrintPk()` untuk cetak browser.
3. `window.exportPdfDocV38()` dan `window.exportPdfLpjV38()` untuk alur simpan PDF melalui dialog print browser.
4. `PrintKopTemplate.render()`, `.wrap()`, dan `.print()` untuk integrasi baru.

## How to apply

Jika format KOP diubah, ubah `print-kop.js` dan `print-kop.css`; jangan menambah KOP baru ke generator dokumen individual. Pastikan `print-kop.js` tetap menjadi script legacy terakhir di `index.html`.