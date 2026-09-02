---
name: KOP Surat layout definitif
description: kopHTML() harus pakai kop-standard table — PATCH 011 di styles.css paksa position:absolute!important pada .kop-logo, hanya bisa di-override via .kop.kop-standard .kop-logo { position:static!important }
---

# KOP Surat Layout Definitif

## Aturan
Selalu override `window.kopHTML` di akhir app.js menggunakan **tabel kop-standard** (bukan div/grid/flexbox).

**Why:** PATCH 011 di `styles.css` (baris ~833) meng-set `.kop-logo { position:absolute!important; left:0!important; top:50%!important }`. Ini merusak SEMUA layout logo yang tidak pakai kelas spesifik `kop-standard`. Satu-satunya CSS yang berhasil override ini adalah `.kop.kop-standard .kop-logo { position:static!important }` di PATCH 013 styles.css.

**How to apply:** Setiap kali harus fix KOP, tambahkan PATCH baru di akhir app.js:
```js
window.kopHTML = function kopHTML(){
  var k = (window.data&&window.data.kop)?window.data.kop:{};
  var m = (window.data&&window.data.master)?window.data.master:{};
  return '<div class="kop kop-standard">'+
    '<table class="kop-table"><tr>'+
      '<td class="kop-col-logo"><img src="assets/logo-pemkot-semarang-transparent.png" class="kop-logo" alt="Logo Kota Semarang"></td>'+
      '<td class="kop-col-text"><div class="kop-text">'+
        '<h1>'+e(b1)+'</h1><h2>'+e(b2)+'</h2><h2>'+e(b3)+'</h2><h2>'+e(b4)+'</h2><p>'+e(addr)+'</p>'+
      '</div></td>'+
      '<td class="kop-col-spacer"></td>'+
    '</tr></table></div>';
};
```

## Jangan pakai:
- `kop-logo-wrap` div tanpa kop-standard (tidak ada override untuk position:absolute)
- `kop-v63-logo` class baru (bisa bypass PATCH 011 tapi CSS inject pakai setTimeout 5 detik → gagal saat print/PDF)
- `position:relative` + `position:absolute` approach apapun

## File terkait
- `artifacts/bop-app/public/styles.css` baris ~833 — PATCH 011 (position:absolute untuk .kop-logo)
- `artifacts/bop-app/public/styles.css` baris ~876 — PATCH 013 (kop-standard CSS, sudah benar)
- `artifacts/bop-app/public/app.js` akhir file — PATCH v1.70 (window.kopHTML override definitif)
