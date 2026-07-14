---
name: BOP Patch v1.58–v1.59 Fixes
description: Root causes dan solusi untuk breakdown panel, RAP bulanan, mobile layout, cursor, Pengambilan Bank
---

## Root Cause: annualIndex missing (v1.55 bug)
v1.55's `getMonthlyRapRows` override mengembalikan rows TANPA `annualIndex`. v1.58 fix: `getR58` selalu sertakan `annualIndex:idx`. Ini adalah root cause semua breakdown issues.

## Storage key: monthlyBreakdown (singular)
Data breakdown tersimpan di `data.pengajuan.monthlyBreakdown` (singular). v1.57 salah pakai `monthlyBreakdowns` (plural) → data mismatch. v1.58 fix: semua storage pakai singular.

## Cursor jumping fix (v1.59)
Debounce `__bd58save`: update in-memory LANGSUNG, localStorage.setItem SETELAH 600ms. Jangan panggil `renderMonthlyRapSummary()` dari handler oninput.

## Breakdown panel chain
v1.58 → `window.renderBreakdownPanel` (pakai data-bd58 attrs)
v1.59 → wraps v1.58, inject `<div class='bd-ringkasan'>` Ringkasan Anggaran di akhir panel.
updateBdRingkasan() update progress bar in-place tanpa re-render.

## docPengambilanBank (v1.59)
Multi-bulan document generator. Reads `getMonthlyRapRows(month)` untuk setiap bulan dalam range, group per bulan dengan row header "Bulan X :". Tombol: previewPengambilanBank, printPengambilanBank. Tab: tab-pengambilan-bank.

## Mobile CSS (v1.59, styles.css ≤768px)
- Sidebar: fixed, translateX(-110%), .sidebar.open untuk toggle
- DS: .ds-toolbar dan .ds-toggle-bar display:none; .ds-canvas pointer-events:none; badge "Mode Preview"
- Subnav: overflow-x auto, nowrap, compact
- Tables: overflow-x auto, min-width 580px

**Why:** `annualIndex` fix adalah ROOT CAUSE — tanpa ini semua breakdown features tidak bisa bekerja karena selectMonthlyItem(undefined) tidak bisa match ke rows.
