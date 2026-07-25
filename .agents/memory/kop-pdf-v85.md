---
name: KOP PDF Fix v1.85
description: Perbaikan KOP surat di semua PDF/cetak path — struktur HTML baru .kop-v85-*, logo KIRI proporsional, DS observer guard.
---

## Masalah
`kopHTML()` v63 menghasilkan HTML dengan class `.kop-v63-*` tapi SEMUA print CSS (printCssV37, PDF_PRINT_CSS, KOP_PDF_CSS, exportPdfDocV38) hanya punya old class names → KOP layout hancur di setiap PDF.

## Solusi (PATCH v1.85 di akhir app.js)

### KOP HTML baru (`.kop-v85-*`)
```
div.kop.kop-v85
  div.kop-v85-header  ← b1 full width
  div.kop-v85-body    ← flex, align-items:stretch
    div.kop-v85-logo-wrap  ← 80px, flex:0 0 80px, align-self:stretch
      img.kop-v85-logo     ← height:100%, width:auto (= tinggi blok text)
    div.kop-v85-text   ← flex:1, text-align:center
      div.kop-v85-line × 3
    div.kop-v85-spacer ← 80px mirror logo → text benar-benar center
  hr.kop-v85-hr
  div.kop-v85-addr
```

### Sizing logo proporsional
- `align-items: stretch` pada row → logo-wrap tingginya = tinggi text block
- `height: 100%` pada img → logo mengisi tinggi logo-wrap
- `max-height: 100px`, `max-width: 76px`, `object-fit: contain`

### Print path yang dipatch
1. `window.cleanPrint` — browser print (iframe) → HTML baru dengan KOP_V85_CSS
2. `window.exportPdfDocV38` — popup PDF export → HTML baru dengan KOP_V85_CSS
3. Screen inject CSS via `<style id="bopV85ScreenStyle">`

### DS Observer guard
- document-studio.js: MutationObserver skip jika `window.__bopPreviewDocActive === true`
- app.js: `window.previewDoc` wrapped → set flag true, reset setelah 350ms
- Juga skip jika `isModified === true` (editan user belum tersimpan) + auto-save draft

**Why:** Ada banyak patch kopHTML() yang tumpang tindih. Selalu tambahkan CSS print ke SEMUA export path, bukan hanya screen.

**How to apply:** Setiap kali kopHTML() diubah, pastikan KOP CSS yang sesuai ada di `window.cleanPrint`, `window.exportPdfDocV38`, DAN screen inject.
