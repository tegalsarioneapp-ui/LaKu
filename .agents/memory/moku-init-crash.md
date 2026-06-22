---
name: MoKu initEvents crash fix
description: Root cause of MoKu clock stuck "Memuat..." and GPS stuck "Mengunci otomatis..." — initEvents() crash due to missing DOM element.
---

## The Rule
Always add null guards before `.addEventListener()` for DOM elements that might not exist in the HTML.

## Why
`$("importActivityFile").addEventListener(...)` was called unconditionally in `initEvents()` but the `<input type="file" id="importActivityFile">` element did not exist in `public/moku/index.html`. This caused a TypeError crash at that line, stopping execution of `initEvents()` entirely. Since `startClock()`, `render()`, and the GPS auto-lock `setTimeout` were all registered AFTER `initEvents()` in the IIFE boot sequence, none of them ever ran.

Symptoms: clock stayed at "--:--:--" / "Memuat...", GPS stayed at "Mengunci otomatis..." forever.

## How to Apply
- In `initEvents()`, wrap any `$(id).addEventListener(...)` that might not exist in a null check:
  ```js
  const el = $(id);
  if (el) el.addEventListener(...);
  ```
- When adding a new DOM-dependent feature: add the HTML element first, then the JS handler — or add null guard if element is optional.
- Boot sequence in moku/app.js: `initEvents()` → `startClock()` → `render()` → GPS setTimeout. A crash in initEvents() silently kills everything after it.

## Also Fixed
- Service worker cache bumped `moku-v3` → `moku-v5` to clear stale cached `app.js` after the bug fix.
- Added `<input type="file" id="importActivityFile">` to HTML so the import feature now works.
- `%VITE_API_BASE%` in index.html replaced with `typeof __BOP_API_BASE__` pattern to eliminate Vite warning spam (235+ warnings per session).
