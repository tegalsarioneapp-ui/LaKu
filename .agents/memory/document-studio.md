---
name: Document Studio Architecture
description: Document Studio (Editor Dokumen Pro) — A4 editor terintegrasi di tab-dokumen dengan template, toggle panel, dan print.
---

## Architecture
- Files: `public/document-studio/document-studio.css` + `document-studio.js`
- Loaded in `index.html` head (CSS) and before `</body>` (JS)
- Replaces `.generate-layout` in `#tab-dokumen` entirely

## Sync mechanism (critical)
- `#docOutput` is kept in DOM but `display:none;visibility:hidden;position:absolute;left:-9999px`
- `MutationObserver` on `#docOutput` fires when `app.js` sets `#docOutput.innerHTML`
- Observer calls `loadDoc(type, html)` to put content into `#dsPage` (contenteditable)
- Doc-btn clicks captured in capture phase to track `currentDocType` before observer fires

## Backward compat IDs
- `#docOutput` — hidden, app.js writes to it, observer reads it
- `#printDoc` — hidden button, app.js binds click; users use #dsPrintDoc instead
- `#exportHtml` — hidden button, app.js binds; users use #dsExportHtml instead
- `#saveToHistory` — VISIBLE in dsGenPanel, app.js binding works normally

## Template store
- localStorage key: `bop_rt005_ds_template_{docType}` (e.g. `bop_rt005_ds_template_permohonan`)
- `bypassTemplate` flag: set to true by `reloadFreshDoc` to skip template on next `loadDoc`
- "Generate Ulang" button sets flag then clicks the active doc-btn

## Print
- Opens new window via `window.open()`, writes full HTML with inline CSS, calls `printWin.print()`
- CSS in print window: Times New Roman for .official*, Arial default, table border-collapse, kop logo max 64px

## Toggle states
- `#dsToggleGenPanel` → max-height animation on `#dsGenPanel` (class `ds-panel-hidden`)
- `#dsToggleSidebar` → `sidebar.style.display`, `.app-shell.menu-hidden` class
- `#dsFocusMode` → `body.ds-focus-mode` class, also hides sidebar

**Why:** app.js patches previewDoc multiple times — using MutationObserver is more robust than monkey-patching the function.
