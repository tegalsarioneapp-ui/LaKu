---
name: Git merge resolution strategy
description: Bagaimana menyelesaikan merge conflict antara local dan remote saat keduanya edit app.js
---

## Rule
Saat merge conflict di `app.js` antara local patch dan remote patch:
- Remote version biasanya lebih komprehensif (mencakup semua yang local lakukan + lebih)
- Ambil versi remote untuk conflict resolution (strategy: theirs for overlapping patches)

**Why:** Kedua sisi biasanya menambah patch di akhir file. Remote sering punya versi yang sudah di-improve. Mengambil remote lalu verifikasi tidak ada yang hilang dari local adalah pendekatan paling aman.

**How to apply:**
1. `git merge origin/main` → conflict muncul di bagian akhir app.js
2. Gunakan Python script untuk cari markers `<<<<<<< HEAD`, `=======`, `>>>>>>> origin/main`
3. Ambil konten antara `=======` dan `>>>>>>> origin/main` (remote version)
4. Ganti seluruh conflict block dengan remote version
5. `git add` + `git commit --no-edit` + `gitPush({})`

## Catatan teknis
- Jangan pakai `if "=======" in resolved` untuk cek sisa conflict — banyak comment `/* ===... */` di app.js yang akan false-positive
- Pakai regex `r'^={7}$'` (exactly 7 equals, full line) untuk deteksi marker yang akurat
- Setelah resolusi, selalu jalankan parser JavaScript. Potongan patch yang tampak berurutan dapat meninggalkan wrapper IIFE atau deklarasi global ganda walaupun marker konflik sudah hilang.
