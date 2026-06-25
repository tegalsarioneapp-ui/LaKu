/* =====================================================================
   Document Studio – BOP RT 005
   Editor dokumen A4 dengan toolbar, template baku, dan cetak.
   ===================================================================== */
(function () {
  "use strict";

  /* ── Constants ──────────────────────────────────────────────────── */
  const TEMPLATE_PREFIX  = "bop_rt005_ds_template_"; /* lama — tetap ada untuk kompatibilitas */
  const SAVED_PREFIX     = "bop_rt005_ds_saved_";    /* simpanan permanen (Ctrl+S) */
  const DRAFT_PREFIX_NEW = "bop_rt005_ds_draft_";    /* auto-save sementara */
  const DOC_NAMES = {
    permohonan : "Surat Permohonan",
    rap        : "RAP BOP RT 1 Tahun",
    rapbulanan : "RAP Bulanan Otomatis",
    ba         : "Berita Acara RAP",
    hadir      : "Daftar Hadir",
    sptjm      : "SPTJM",
    rbb        : "RBB / Pengambilan Operasional",
    checklist  : "Checklist Upload",
    undangan   : "Undangan Rapat/Kegiatan",
    notulen    : "Notulen Rapat/Kegiatan"
  };

  /* ── State ──────────────────────────────────────────────────────── */
  let currentDocType   = null;
  let isModified       = false;
  let isFocusMode      = false;
  let isGenPanelOpen   = true;
  let isSidebarOpen    = true;
  let toastTimer       = null;
  let bypassTemplate   = false; /* true = skip saved template on next loadDoc */

  /* ── DOM helpers ────────────────────────────────────────────────── */
  const $  = id  => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  function getPage()   { return $("dsPage");   }
  function getCanvas() { return $("dsCanvas"); }

  /* ════════════════════════════════════════════════════════════════
     TEMPLATE STORE
  ════════════════════════════════════════════════════════════════ */
  function tplKey(type) { return TEMPLATE_PREFIX + type; }

  function tplGet(type) {
    try { return JSON.parse(localStorage.getItem(tplKey(type))); }
    catch (_) { return null; }
  }

  function tplSave(type, html) {
    const tpl = {
      docType  : type,
      html,
      savedAt  : new Date().toISOString(),
      version  : "1.0",
      docName  : DOC_NAMES[type] || type
    };
    try{ localStorage.setItem(tplKey(type), JSON.stringify(tpl)); }catch(e){ console.warn("[DS] Gagal simpan template:",e); }
    return tpl;
  }

  function tplDelete(type) {
    localStorage.removeItem(tplKey(type));
  }

  function tplGetAll() {
    const out = {};
    Object.keys(localStorage)
      .filter(k => k.startsWith(TEMPLATE_PREFIX) || k.startsWith(SAVED_PREFIX))
      .forEach(k => {
        try { out[k] = JSON.parse(localStorage.getItem(k)); } catch (_) {}
      });
    return out;
  }

  /* ════════════════════════════════════════════════════════════════
     SAVED — simpanan permanen (hasil Ctrl+S / tombol Simpan)
     Disimpan sebagai JSON: { html, savedAt }
  ════════════════════════════════════════════════════════════════ */
  function savedGet(type) {
    /* Cek key baru dulu */
    try {
      const raw = localStorage.getItem(SAVED_PREFIX + type);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    /* Fallback ke key template lama */
    try {
      const old = tplGet(type);
      if (old?.html) return { html: old.html, savedAt: old.savedAt || null };
    } catch (_) {}
    return null;
  }

  function savedSet(type, html) {
    const savedAt = new Date().toISOString();
    const obj     = { html, savedAt, docType: type, docName: DOC_NAMES[type] || type };
    try { localStorage.setItem(SAVED_PREFIX + type, JSON.stringify(obj)); } catch (_e) {}
    /* Tulis juga ke key lama agar backup/export tetap jalan */
    tplSave(type, html);
    return savedAt;
  }

  function savedDelete(type) {
    localStorage.removeItem(SAVED_PREFIX + type);
    tplDelete(type);
  }

  /* ════════════════════════════════════════════════════════════════
     DRAFT — auto-save sementara (sebelum Ctrl+S)
     Disimpan sebagai JSON: { html, savedAt }
  ════════════════════════════════════════════════════════════════ */
  function draftGet(type) {
    /* Cek key baru */
    try {
      const raw = localStorage.getItem(DRAFT_PREFIX_NEW + type);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    /* Fallback ke key draft lama (string mentah) */
    try {
      const oldRaw = localStorage.getItem(TEMPLATE_PREFIX + "draft_" + type);
      if (oldRaw) return { html: oldRaw, savedAt: null }; /* savedAt null = lebih tua dari saved */
    } catch (_) {}
    return null;
  }

  function draftSet(type, html) {
    const savedAt = new Date().toISOString();
    try {
      localStorage.setItem(DRAFT_PREFIX_NEW + type, JSON.stringify({ html, savedAt }));
    } catch (_e) {}
  }

  function draftDelete(type) {
    localStorage.removeItem(DRAFT_PREFIX_NEW + type);
    localStorage.removeItem(TEMPLATE_PREFIX + "draft_" + type);
  }

  /* ════════════════════════════════════════════════════════════════
     LOAD DOC INTO EDITOR
  ════════════════════════════════════════════════════════════════ */
  function loadDoc(type, freshHtml) {
    /* ── Auto-simpan sesi saat ini sebagai draft sebelum pindah ── */
    if (currentDocType && currentDocType !== type) {
      clearTimeout(_draftTimer);
      const curPage = getPage();
      if (curPage && curPage.innerHTML.trim()) {
        draftSet(currentDocType, curPage.innerHTML);
      }
    }

    currentDocType = type;
    isModified     = false;

    const page = getPage();
    if (!page) return;

    if (bypassTemplate) {
      /* User klik "Generate Ulang" → paksa muat freshHtml */
      bypassTemplate = false;
      page.innerHTML = freshHtml || "<p>Dokumen kosong.</p>";
      setStatus("Dokumen di-generate ulang dari data terkini", "saved");
      setBadge(!!savedGet(type));
    } else {
      /* ── Muat simpanan paling baru: bandingkan saved vs draft ── */
      const saved = savedGet(type);
      const draft = draftGet(type);

      const savedTime = saved?.savedAt ? new Date(saved.savedAt).getTime() : 0;
      const draftTime = draft?.savedAt ? new Date(draft.savedAt).getTime() : 0;

      if (saved?.html || draft?.html) {
        if (draftTime > savedTime && draft?.html) {
          /* Draft lebih baru dari simpanan → ada editan belum tersimpan */
          page.innerHTML = draft.html;
          if (saved?.html) {
            isModified = true;
            setStatus("Sesi terakhir dipulihkan — tekan Ctrl+S untuk simpan", "unsaved");
          } else {
            isModified = true;
            setStatus("Sesi terakhir dipulihkan — tekan Ctrl+S untuk simpan permanen", "unsaved");
          }
          setBadge(!!saved?.html);
        } else if (saved?.html) {
          /* Simpanan permanen adalah yang paling baru */
          page.innerHTML = saved.html;
          setStatus(`Tersimpan${saved.savedAt ? " " + fmtDate(saved.savedAt) : ""}`, "saved");
          setBadge(true);
        } else if (draft?.html) {
          /* Hanya ada draft (belum pernah Ctrl+S) */
          page.innerHTML = draft.html;
          isModified = true;
          setStatus("Sesi terakhir dipulihkan — tekan Ctrl+S untuk simpan", "unsaved");
          setBadge(false);
        }
      } else {
        /* Belum ada simpanan → muat freshHtml dari generator */
        page.innerHTML = freshHtml || "<p>Dokumen kosong.</p>";
        setStatus("Dokumen digenerate dari data terkini — Ctrl+S untuk simpan", "saved");
        setBadge(false);
      }
    }

    setDocName(DOC_NAMES[type] || type);
    attachResizeHandles();

    const canvas = getCanvas();
    if (canvas) canvas.scrollTop = 0;
    setTimeout(() => page.focus(), 80);
  }

  /* ════════════════════════════════════════════════════════════════
     TOOLBAR COMMANDS
  ════════════════════════════════════════════════════════════════ */
  function execCmd(cmd, val) {
    getPage()?.focus();
    document.execCommand(cmd, false, val || null);
  }

  /* Apply line-height to current paragraph / selection */
  function applyLineSpacing(val) {
    const sel = window.getSelection();
    if (!sel) return;
    getPage()?.focus();

    /* Collect all p/div/td/li containing the selection */
    if (!sel.isCollapsed && sel.rangeCount) {
      const range  = sel.getRangeAt(0);
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_ELEMENT
      );
      let node;
      while ((node = walker.nextNode())) {
        if (/^(P|DIV|TD|LI|H[1-6])$/.test(node.tagName) && sel.containsNode(node, true)) {
          node.style.lineHeight = val;
        }
      }
    }
    /* Also apply to the block containing the cursor */
    const anchor = sel.anchorNode;
    const block  = (anchor?.nodeType === 3 ? anchor.parentElement : anchor)
                   ?.closest("p, div, td, li") ;
    if (block) block.style.lineHeight = val;
    markDirty();
  }

  /* Apply paragraph spacing (margin-top / margin-bottom) */
  function applyParaSpacing(prop, val) {
    const sel   = window.getSelection();
    const node  = sel?.anchorNode;
    const block = (node?.nodeType === 3 ? node.parentElement : node)
                  ?.closest("p, div, li");
    if (block) { block.style[prop] = val; markDirty(); }
  }

  /* Font size via span */
  function applyFontSize(ptVal) {
    const sel = window.getSelection();
    getPage()?.focus();
    if (!sel || !sel.rangeCount) return;

    if (!sel.isCollapsed) {
      /* wrap selection in a span */
      try {
        const range = sel.getRangeAt(0);
        const span  = document.createElement("span");
        span.style.fontSize = ptVal + "pt";
        range.surroundContents(span);
      } catch (_) {
        execCmd("fontSize", 3); /* fallback */
      }
    } else {
      /* apply to current block */
      const node  = sel.anchorNode;
      const block = (node?.nodeType === 3 ? node.parentElement : node)
                    ?.closest("p, div, td, li");
      if (block) block.style.fontSize = ptVal + "pt";
    }
    markDirty();
  }

  /* ════════════════════════════════════════════════════════════════
     TABLE OPERATIONS
  ════════════════════════════════════════════════════════════════ */
  function getSelectedCell() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const el = sel.anchorNode?.nodeType === 3
      ? sel.anchorNode.parentElement
      : sel.anchorNode;
    return el?.closest("td, th") || null;
  }

  function tableOp(op) {
    const cell = getSelectedCell();
    if (!cell) { toast("Klik di dalam sel tabel terlebih dahulu", "warn"); return; }

    const row      = cell.parentElement;
    const table    = row.closest("table");
    const colIdx   = cell.cellIndex;
    const rowIdx   = row.rowIndex;

    switch (op) {
      case "addRowAbove": {
        const nr = table.insertRow(rowIdx);
        for (let i = 0; i < row.cells.length; i++) {
          const nc = nr.insertCell();
          copyColWidth(row.cells[i], nc);
          nc.innerHTML = "&nbsp;";
        }
        break;
      }
      case "addRowBelow": {
        const nr = table.insertRow(rowIdx + 1);
        for (let i = 0; i < row.cells.length; i++) {
          const nc = nr.insertCell();
          copyColWidth(row.cells[i], nc);
          nc.innerHTML = "&nbsp;";
        }
        break;
      }
      case "deleteRow": {
        if (table.rows.length > 1) table.deleteRow(rowIdx);
        else toast("Tabel hanya memiliki satu baris, tidak bisa dihapus", "warn");
        break;
      }
      case "addColLeft":
      case "addColRight": {
        const insertAt = op === "addColLeft" ? colIdx : colIdx + 1;
        Array.from(table.rows).forEach(r => {
          const nc = r.insertCell(insertAt);
          nc.innerHTML = "&nbsp;";
        });
        break;
      }
      case "deleteCol": {
        if (row.cells.length > 1) {
          Array.from(table.rows).forEach(r => {
            if (r.cells[colIdx]) r.deleteCell(colIdx);
          });
        } else toast("Tabel hanya memiliki satu kolom", "warn");
        break;
      }
    }
    markDirty();
  }

  function copyColWidth(src, dest) {
    const w = src.style.width || src.getAttribute("width");
    if (w) dest.style.width = w;
  }

  /* ════════════════════════════════════════════════════════════════
     ADD EMPTY LINE / PAGE BREAK
  ════════════════════════════════════════════════════════════════ */
  function addEmptyLine() {
    const page = getPage();
    if (!page) return;
    page.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const p     = document.createElement("p");
      p.innerHTML = "\u00A0";
      range.collapse(false);
      range.insertNode(p);
      range.setStartAfter(p);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      page.insertAdjacentHTML("beforeend", "<p>&nbsp;</p>");
    }
    markDirty();
  }

  function addPageBreak() {
    const page = getPage();
    if (!page) return;
    page.focus();
    const hr = document.createElement("hr");
    hr.className = "ds-page-break";
    hr.contentEditable = "false";
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.collapse(false);
      range.insertNode(hr);
      range.setStartAfter(hr);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      page.appendChild(hr);
    }
    markDirty();
  }

  /* ════════════════════════════════════════════════════════════════
     MOVE PARAGRAPH UP / DOWN
  ════════════════════════════════════════════════════════════════ */
  function moveParaUp() {
    const sel  = window.getSelection();
    const node = sel?.anchorNode;
    const para = (node?.nodeType === 3 ? node.parentElement : node)?.closest("p, div:not(.official):not(.ds-page)");
    if (!para || !para.previousElementSibling) return;
    para.parentNode.insertBefore(para, para.previousElementSibling);
    markDirty();
  }

  function moveParaDown() {
    const sel  = window.getSelection();
    const node = sel?.anchorNode;
    const para = (node?.nodeType === 3 ? node.parentElement : node)?.closest("p, div:not(.official):not(.ds-page)");
    if (!para || !para.nextElementSibling) return;
    para.parentNode.insertBefore(para.nextElementSibling, para);
    markDirty();
  }

  /* ════════════════════════════════════════════════════════════════
     SAVE / TEMPLATE / PRINT
  ════════════════════════════════════════════════════════════════ */
  function saveEdit() {
    if (!currentDocType) { toast("Pilih dan generate dokumen terlebih dahulu", "warn"); return; }
    const page = getPage();
    if (page) {
      clearTimeout(_draftTimer);
      try { localStorage.setItem(TEMPLATE_PREFIX + "draft_" + currentDocType, page.innerHTML); } catch(_e) {}
    }
    isModified = false;
    setStatus(`Disimpan ${fmtTime(new Date())}`, "saved");
    toast("✓ Editan disimpan");
  }

  function saveAsTemplate() {
    const page = getPage();
    if (!page || !currentDocType) { toast("Generate dokumen terlebih dahulu", "warn"); return; }
    tplSave(currentDocType, page.innerHTML);
    isModified = false;
    setBadge(true);
    setStatus(`Format baku "${DOC_NAMES[currentDocType]||currentDocType}" disimpan ${fmtTime(new Date())}`, "saved");
    toast(`⭐ Format baku disimpan:\n${DOC_NAMES[currentDocType] || currentDocType}`);
  }

  function resetTemplate() {
    if (!currentDocType) return;
    const name = DOC_NAMES[currentDocType] || currentDocType;
    if (!confirm(`Reset format baku "${name}"?\n\nLayout yang sudah diedit akan dihapus. Generate ulang akan menggunakan template bawaan.`)) return;
    tplDelete(currentDocType);
    setBadge(false);
    setStatus("Format baku dihapus — generate ulang untuk reset ke template bawaan", "saved");
    toast(`↺ Format baku "${name}" dihapus`);
  }

  function reloadFreshDoc() {
    /* Re-generate ignoring any saved template */
    if (!currentDocType) { toast("Pilih dokumen terlebih dahulu", "warn"); return; }
    bypassTemplate = true; /* flag: skip template on next loadDoc */
    const btn = document.querySelector(`.doc-btn[data-doc="${currentDocType}"]`);
    if (btn) {
      btn.click();
      toast("🔄 Generate ulang dari data terkini");
    } else {
      bypassTemplate = false;
      toast("Klik tombol dokumen untuk generate ulang", "warn");
    }
  }

  /* ── Backup all templates ────────────────────────────────────── */
  function backupTemplates() {
    const all  = tplGetAll();
    const keys = Object.keys(all);
    if (!keys.length) { toast("Belum ada format baku yang disimpan", "warn"); return; }
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `bop_rt005_format_baku_${dateStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast(`✓ Backup ${keys.length} format baku berhasil`);
  }

  /* ── Import templates ────────────────────────────────────────── */
  function importTemplates(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const obj   = JSON.parse(fr.result);
        let count   = 0;
        Object.entries(obj).forEach(([k, v]) => {
          if (k.startsWith(TEMPLATE_PREFIX)) {
            localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
            count++;
          }
        });
        toast(`✓ ${count} format baku berhasil diimport`);
        if (currentDocType) setBadge(!!tplGet(currentDocType));
      } catch (_) {
        toast("File tidak valid — harus format JSON backup", "error");
      }
    };
    fr.readAsText(file);
  }

  /* ── Export current doc HTML ─────────────────────────────────── */
  function exportHtmlSnapshot() {
    const page = getPage();
    if (!page || !page.innerHTML.trim()) { toast("Editor kosong", "warn"); return; }
    const docName = DOC_NAMES[currentDocType] || "dokumen";
    const html    = `<!doctype html><html lang="id"><head><meta charset="UTF-8"><title>${docName}</title>
<style>
body{margin:20mm;font-family:Arial,sans-serif;font-size:12pt;color:#000}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:5px 8px}
.no-border td,.no-border th{border:none}
.signature-space,.sign-space-v36{height:62px;display:block}
.ttd-4{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;text-align:center;margin-top:22px}
.ttd-3{display:grid;grid-template-columns:repeat(3,1fr);gap:35px;text-align:center;margin-top:22px}
.title{text-align:center;font-weight:bold;text-transform:uppercase;margin:10px 0 16px}
.official{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.26}
p{margin:8px 0}ol{margin:8px 0;padding-left:24px}li{margin-bottom:6px}
@page{size:A4;margin:14mm}
</style></head><body>${page.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `${docName.replace(/\s+/g,"-")}_${dateStamp()}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast("✓ Export HTML berhasil");
  }

  /* ── Export JSON template ────────────────────────────────────── */
  function exportJsonTemplate() {
    if (!currentDocType) { toast("Generate dokumen terlebih dahulu", "warn"); return; }
    const page = getPage();
    if (!page) return;
    const tpl  = {
      docType : currentDocType,
      docName : DOC_NAMES[currentDocType] || currentDocType,
      html    : page.innerHTML,
      savedAt : new Date().toISOString(),
      version : "1.0"
    };
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: "application/json" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `bop_rt005_template_${currentDocType}_${dateStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast("✓ Export JSON template berhasil");
  }

  /* ── Print / PDF ─────────────────────────────────────────────── */
  function printDoc() {
    const page = getPage();
    if (!page) { toast("Editor kosong", "warn"); return; }
    const inner = page.innerHTML;
    if (!inner.trim() || inner.includes("ds-page-placeholder")) {
      toast("Generate dokumen terlebih dahulu", "warn"); return;
    }

    const printWin = window.open("", "_blank", "width=900,height=1100");
    if (!printWin) {
      alert("Popup diblokir browser.\nIzinkan popup untuk halaman ini, lalu coba lagi.");
      return;
    }

    printWin.document.write(`<!doctype html><html lang="id"><head>
<meta charset="UTF-8">
<title>${DOC_NAMES[currentDocType] || "Dokumen BOP RT 005"}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 12pt; color: #000; }
  .official, .official-v36, .official-v37 {
    font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.26; color: #000;
  }
  .official .title, .official-v36 .title, .official-v37 .title {
    text-align: center; font-weight: bold; text-transform: uppercase; margin: 10px 0 16px;
  }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #000; padding: 5px 8px; font-size: 11pt; }
  .no-border td, .no-border th { border: none; }
  .signature-space, .sign-space-v36 { height: 62px; display: block; }
  .ttd-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 70px; text-align: center; margin-top: 22px; }
  .ttd-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 20px; text-align: center; margin-top: 22px; }
  .ttd-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 35px; text-align: center; margin-top: 22px; }
    .kop { display: grid; grid-template-columns: 70px 1fr; gap: 12px; align-items: center; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 12px; }
  .kop-logo img, .kop img { width: 64px !important; max-width: 64px !important; height: auto; }
  .kop-text { line-height: 1.3; text-align: center; }
  .kop h1, .kop-b1 { font-family: "Times New Roman", serif; font-size: 17px; font-weight: bold; text-transform: uppercase; text-align: center; margin: 0; padding: 0; }
  .kop h2, .kop-b2 { font-family: "Times New Roman", serif; font-size: 16px; font-weight: bold; text-transform: uppercase; text-align: center; margin: 2px 0; padding: 0; }
  .kop p, .kop-addr { font-family: "Times New Roman", serif; font-size: 12px; text-align: center; margin: 2px 0; padding: 0; }
  .kop-text * { text-align: center !important; white-space: normal !important; word-break: normal !important; }
  p { margin: 8px 0; }
  ol { margin: 8px 0; padding-left: 24px; }
  li { margin-bottom: 6px; }
  .title { text-align: center; font-weight: bold; text-transform: uppercase; margin: 12px 0 16px; }
  .date-right-v36 { text-align: right; }
  .center-v36 { text-align: center; }
  .col-no { width: 38px; text-align: center; }
  .money-cell { text-align: right; white-space: nowrap; }
  .sign-note-v36 { font-size: 9pt; color: #555; display: block; }
  .ket-v36 { font-size: 10pt; color: #555; margin-top: 8px; }
  .mengetahui-v36 { margin-top: 20px; }
  .ds-page-break { page-break-after: always; border: none; margin: 0; }
  .ds-page-break::after { display: none; }
  .sign-right-v36 td, .sign-right-v36 th { border: none; }
  .letter-head-v36 td, .letter-head-v36 th { border: none; }
  .identity-table-v36 td, .identity-table-v36 th { border: none; padding: 2px 4px; }
  .sign-two-v36 td, .sign-two-v36 th { border: none; }
  .sign-two-v36 { width: 100%; }
  .official-body-v36 { }
  .sign-space-v36 { height: 62px; display: block; }
  .rap-table-v36 th, .sign-list-v36 th { background: #f5f5f5; }
  b, strong { font-weight: bold; }
</style>
</head><body>${inner}</body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 500);
  }

  /* ════════════════════════════════════════════════════════════════
     TOGGLE PANELS
  ════════════════════════════════════════════════════════════════ */
  function toggleGenPanel() {
    isGenPanelOpen = !isGenPanelOpen;
    const panel = $("dsGenPanel");
    const btn   = $("dsToggleGenPanel");
    if (panel) panel.classList.toggle("ds-panel-hidden", !isGenPanelOpen);
    if (btn) {
      btn.classList.toggle("ds-active", !isGenPanelOpen);
      btn.textContent = isGenPanelOpen ? "▼ Panel Dokumen" : "▶ Panel Dokumen";
    }
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
    const sidebar = $("sidebar") || document.querySelector(".sidebar");
    const btn     = $("dsToggleSidebar");
    if (sidebar) {
      sidebar.style.display = isSidebarOpen ? "" : "none";
      /* also toggle grid column on app-shell */
      const shell = document.querySelector(".app-shell");
      if (shell) shell.classList.toggle("menu-hidden", !isSidebarOpen);
    }
    if (btn) {
      btn.classList.toggle("ds-active", !isSidebarOpen);
      btn.textContent = isSidebarOpen ? "▼ Sidebar" : "▶ Sidebar";
    }
  }

  function toggleFocusMode() {
    isFocusMode = !isFocusMode;
    document.body.classList.toggle("ds-focus-mode", isFocusMode);
    const btn = $("dsFocusMode");
    if (btn) {
      btn.classList.toggle("ds-active", isFocusMode);
      btn.textContent = isFocusMode ? "⊡ Keluar Fokus" : "⛶ Mode Fokus";
    }
    if (isFocusMode) {
      /* hide sidebar if not already hidden */
      const sidebar = $("sidebar") || document.querySelector(".sidebar");
      if (sidebar) sidebar.style.display = "none";
    } else {
      /* restore sidebar if it was visible */
      if (isSidebarOpen) {
        const sidebar = $("sidebar") || document.querySelector(".sidebar");
        if (sidebar) sidebar.style.display = "";
        const shell = document.querySelector(".app-shell");
        if (shell) shell.classList.remove("menu-hidden");
      }
    }
    setTimeout(() => getPage()?.focus(), 100);
  }

  /* ════════════════════════════════════════════════════════════════
     UI HELPERS
  ════════════════════════════════════════════════════════════════ */
  function setStatus(msg, state = "saved") {
    const el = $("dsStatusText");
    if (!el) return;
    el.textContent = msg;
    el.className   = state === "unsaved" ? "ds-status-unsaved" : "ds-status-saved";
  }

  function setDocName(name) {
    const el = $("dsDocName");
    if (el) el.textContent = name;
  }

  function setBadge(visible) {
    const el = $("dsTemplateBadge");
    if (el) el.style.display = visible ? "inline-flex" : "none";
  }

  let _draftTimer = null;
  function markDirty() {
    isModified = true;
    setStatus("Ada perubahan — belum disimpan", "unsaved");
    /* Auto-save draft ke localStorage setelah 1.5 detik diam */
    clearTimeout(_draftTimer);
    _draftTimer = setTimeout(() => {
      if (!currentDocType) return;
      const page = getPage();
      if (!page) return;
      try { localStorage.setItem(TEMPLATE_PREFIX + "draft_" + currentDocType, page.innerHTML); } catch(_e) {}
    }, 1500);
  }

  function toast(msg, type = "info") {
    let el = $("dsToast");
    if (!el) {
      el          = document.createElement("div");
      el.id       = "dsToast";
      el.className = "ds-toast-hidden";
      document.body.appendChild(el);
    }
    const colors = { info: "#1e3a5f", warn: "#c47a00", error: "#c0392b" };
    el.style.background = colors[type] || colors.info;
    el.textContent      = msg;
    el.classList.remove("ds-toast-hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("ds-toast-hidden"), 3200);
  }

  function setZoom(val) {
    const canvas = getCanvas();
    if (canvas) canvas.dataset.zoom = val;
    const page = getPage();
    if (page) page.style.zoom = val;
  }

  /* ════════════════════════════════════════════════════════════════
     COLUMN RESIZE HANDLES
  ════════════════════════════════════════════════════════════════ */
  function attachResizeHandles() {
    const page = getPage();
    if (!page) return;
    /* Remove old handles */
    page.querySelectorAll(".ds-col-resize-handle").forEach(h => h.remove());

    page.querySelectorAll("table").forEach(table => {
      table.querySelectorAll("th, td").forEach(cell => {
        const handle       = document.createElement("div");
        handle.className   = "ds-col-resize-handle";
        handle.contentEditable = "false";
        cell.style.position = "relative";
        cell.appendChild(handle);

        let startX, startW;
        handle.addEventListener("mousedown", e => {
          e.preventDefault();
          startX = e.clientX;
          startW = cell.offsetWidth;
          handle.classList.add("dragging");

          const onMove = ev => {
            const diff  = ev.clientX - startX;
            const newW  = Math.max(20, startW + diff);
            cell.style.width = newW + "px";
            /* sync same-column cells */
            const colIdx = cell.cellIndex;
            Array.from(table.rows).forEach(r => {
              if (r.cells[colIdx]) r.cells[colIdx].style.width = newW + "px";
            });
            markDirty();
          };
          const onUp = () => {
            handle.classList.remove("dragging");
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup",   onUp);
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup",   onUp);
        });
      });
    });
  }

  /* ════════════════════════════════════════════════════════════════
     TOOLBAR STATE REFRESH (toggle active class)
  ════════════════════════════════════════════════════════════════ */
  function refreshToolbarState() {
    const cmds = ["bold", "italic", "underline", "strikeThrough",
                  "justifyLeft", "justifyCenter", "justifyRight", "justifyFull"];
    cmds.forEach(cmd => {
      const btn = document.querySelector(`[data-ds-cmd="${cmd}"]`);
      if (btn) btn.classList.toggle("ds-active", document.queryCommandState(cmd));
    });
  }

  /* ════════════════════════════════════════════════════════════════
     DATE / TIME HELPERS
  ════════════════════════════════════════════════════════════════ */
  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric" });
    } catch (_) { return iso || ""; }
  }
  function fmtTime(d) {
    return d.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" });
  }
  function dateStamp() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  }

  /* ════════════════════════════════════════════════════════════════
     HOOK INTO DOC GENERATION
     Observe #docOutput for changes and sync to editor.
  ════════════════════════════════════════════════════════════════ */
  let _dsDebounce = null;
  function hookDocOutput() {
    const docOutput = document.getElementById("docOutput");
    if (!docOutput) return;

    let lastContent = "";

    /* Reset lastContent saat dropdown bulan berubah agar Observer selalu sync */
    document.addEventListener("change", e => {
      if (e.target?.id === "v48RapBulanSel" || e.target?.id === "monthlyDocMonth") {
        lastContent = ""; /* force Observer trigger pada update berikutnya */
      }
    });

    const observer  = new MutationObserver(() => { clearTimeout(_dsDebounce); _dsDebounce = setTimeout(() => {
      const html = docOutput.innerHTML.trim();
      if (html && html !== lastContent) {
        lastContent = html;
        /* Determine active doc type from active doc-btn */
        const activeBtn = document.querySelector(".doc-btn.active[data-doc]");
        const type      = activeBtn?.dataset?.doc || currentDocType || "permohonan";
        loadDoc(type, html);

        /* Scroll the studio into view */
        const wrap = $("docStudioWrap");
        if (wrap) {
          setTimeout(() => wrap.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
        }
      }
      }, 80);
    });
    observer.observe(docOutput, { childList: true, subtree: true, characterData: true });
  }

  /* Also intercept doc-btn clicks to track type before MutationObserver fires */
  function hookDocBtns() {
    document.addEventListener("click", e => {
      const btn = e.target.closest(".doc-btn[data-doc]");
      if (btn) {
        const type = btn.dataset.doc;
        if (type) currentDocType = type;
      }
    }, true); /* capture phase */
  }

  /* ════════════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════════════ */
  function init() {

    /* ── Toolbar: execCommand buttons ── */
    document.addEventListener("click", e => {
      const btn = e.target.closest("[data-ds-cmd]");
      if (!btn) return;
      execCmd(btn.dataset.dsCmd, btn.dataset.dsCmdVal || null);
      refreshToolbarState();
    });

    /* ── Toolbar: table ops ── */
    document.addEventListener("click", e => {
      const btn = e.target.closest("[data-ds-table]");
      if (!btn) return;
      tableOp(btn.dataset.dsTable);
    });

    /* ── Font family ── */
    $("dsFontFamily")?.addEventListener("change", e => {
      execCmd("fontName", e.target.value);
    });

    /* ── Font size ── */
    $("dsFontSize")?.addEventListener("change", e => applyFontSize(+e.target.value));

    /* ── Line spacing ── */
    $("dsLineSpacing")?.addEventListener("change", e => applyLineSpacing(e.target.value));

    /* ── Para spacing top ── */
    $("dsParaSpacingTop")?.addEventListener("change", e =>
      applyParaSpacing("marginTop", e.target.value));

    /* ── Para spacing bottom ── */
    $("dsParaSpacingBottom")?.addEventListener("change", e =>
      applyParaSpacing("marginBottom", e.target.value));

    /* ── Zoom ── */
    $("dsZoom")?.addEventListener("change", e => setZoom(e.target.value));

    /* ── Add empty line ── */
    $("dsAddEmptyLine")?.addEventListener("click", addEmptyLine);

    /* ── Add page break ── */
    $("dsAddPageBreak")?.addEventListener("click", addPageBreak);

    /* ── Move para up/down ── */
    $("dsMoveParaUp")?.addEventListener("click",   moveParaUp);
    $("dsMoveParaDown")?.addEventListener("click", moveParaDown);

    /* ── Save / template / print ── */
    $("dsSaveEdit")?.addEventListener("click",         saveEdit);
    $("dsSaveAsTemplate")?.addEventListener("click",   saveAsTemplate);
    $("dsResetTemplate")?.addEventListener("click",    resetTemplate);
    $("dsReloadFresh")?.addEventListener("click",      reloadFreshDoc);
    $("dsPrintDoc")?.addEventListener("click",         printDoc);
    $("dsExportHtml")?.addEventListener("click",       exportHtmlSnapshot);
    $("dsExportJson")?.addEventListener("click",       exportJsonTemplate);
    $("dsBackupTemplates")?.addEventListener("click",  backupTemplates);

    const importInput = $("dsImportTemplates");
    if (importInput) {
      importInput.addEventListener("change", e => {
        if (e.target.files?.[0]) importTemplates(e.target.files[0]);
        importInput.value = "";
      });
    }

    /* ── Toggle buttons ── */
    $("dsToggleGenPanel")?.addEventListener("click", toggleGenPanel);
    $("dsToggleSidebar")?.addEventListener("click",  toggleSidebar);
    $("dsFocusMode")?.addEventListener("click",      toggleFocusMode);

    /* ── Editor events ── */
    const page = getPage();
    if (page) {
      /* Mark dirty on any input */
      page.addEventListener("input", markDirty);
      page.addEventListener("keyup", refreshToolbarState);
      page.addEventListener("mouseup", refreshToolbarState);

      /* Ctrl+S → save, Ctrl+P → print */
      page.addEventListener("keydown", e => {
        if (e.ctrlKey && e.key === "s") { e.preventDefault(); saveEdit(); }
        if (e.ctrlKey && e.key === "p") { e.preventDefault(); printDoc(); }
        if (e.key === "Escape" && isFocusMode) toggleFocusMode();

        /* Tab inside table: navigate cells */
        if (e.key === "Tab") {
          const cell = getSelectedCell();
          if (!cell) return;
          e.preventDefault();
          const table    = cell.closest("table");
          const allCells = Array.from(table.querySelectorAll("td, th"));
          const idx      = allCells.indexOf(cell);
          const next     = allCells[e.shiftKey ? idx - 1 : idx + 1];
          if (next) {
            const range = document.createRange();
            range.selectNodeContents(next);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          } else if (!e.shiftKey) {
            /* At last cell → add row */
            tableOp("addRowBelow");
          }
        }
      });
    }

    /* Hook document generation */
    hookDocOutput();
    hookDocBtns();

    console.log("[DocumentStudio] v1.0 initialized");
  }

  /* Expose public API */
  window.DocumentStudio = {
    loadDoc, saveEdit, saveAsTemplate, resetTemplate, printDoc,
    backupTemplates, exportHtmlSnapshot, exportJsonTemplate,
    toggleGenPanel, toggleSidebar, toggleFocusMode, reloadFreshDoc,
    tplGet, tplSave, tplDelete, tplGetAll
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
