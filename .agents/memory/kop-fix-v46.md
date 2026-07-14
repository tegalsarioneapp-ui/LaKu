---
name: KOP uniformity + doc sync fix (PATCH v1.46)
description: Fixes KOP format inconsistency across 7 BOP documents and PDF export CSS mismatch
---

## Problem
- `docHadir`, `docSK`, `docRekening` used OLD `official()` wrapper → `class="official"` only, not `class="official official-v36 official-v37"`. Print CSS in `printCssV37()` targets `.official-v37` so these docs got no V37 print styles.
- `kopHTML()` emitted `<div class="kop-b1">` etc. but `PDF_PRINT_CSS` (inside closed IIFE, can't modify) targeted `.kop h1/h2/p`. KOP text was UNSTYLED in PDF export.
- `styles.css` had `.kop h1/h2/p` selectors but not `.kop-b1/b2/addr`.

## Fix (PATCH v1.46 appended to app.js after line 6401)

1. **Override `kopHTML()`** globally: now emits `<h1 class="kop-b1">`, `<h2 class="kop-b2">`, `<p class="kop-addr">` — semantic tags + class names. Both screen CSS (`.kop h1/h2/p`) and print/PDF CSS (`.kop-b1/b2/addr`) work.

2. **New `officialWrap46(body)`**: replicates `officialV37()` from inside the closed IIFE — generates `class="official official-v36 official-v37"` wrapper with `kopHTML()`.

3. **`docHadirV46`, `docSKV46`, `docRekeningV46`**: full rewrites using `officialWrap46()`, reading all relevant data fields from `window.data.master` and `window.data.pengajuan`. Peserta and RAP normalization handles both array `[...]` and object `{...}` formats.

4. **`window.docHadir/docSK/docRekening`** overridden → `previewDocV37` → `docMapV37()` auto-picks them up.

5. **`window.exportPdfDocV38`** patched to use a full self-contained CSS (KOP flex layout + `.kop-b1/b2/addr` + all V37 utility classes), bypassing the closed-IIFE `PDF_PRINT_CSS` which only had `.kop h1/h2/p`.

6. **`injectKopCssV46()`** injects `<style>` to `<head>` for screen mode, adding `.kop-b1/b2/addr` and h1/h2 reset styles.

## Why
- `PDF_PRINT_CSS` is a `const` inside a closed IIFE (bopPdfExportV38) — cannot be modified from outside.
- `officialV37()` is also inside a closed IIFE — cannot call from outside patches.
- Solution: override the EXPOSED `window.exportPdfDocV38` and override global `kopHTML`.

## Key data fields accessed
- `docHadir`: `p.hadirKegiatan`, `p.hadirTanggal`, `p.hadirWaktu`, `p.hadirTempat`, `p.hadirAgenda`, `p.hadirRows`, `p.peserta` (array/object)
- `docSK`: `p.nomorSK`, `p.tanggalSK`, `p.masaBerlakuSK`, `m.noKtpKetua`, `m.ketua/sekretaris/bendahara`
- `docRekening`: `p.namaBank`, `p.nomorRekening`, `p.namaPemilikRekening`, `p.cabangBank`, `m.kelurahan/kecamatan/kota`
