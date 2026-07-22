/* ══════════════════════════════════════════════════════════════
   BOP RT 005 — Modul Tambahan v1.40
   ──────────────────────────────────────────────────────────────
   M1: Multi-Kegiatan + Auto-sync LPJ       (MKAL-v40)
   M2: Rekap Bulanan → LPJ                  (RBL-v40)
   M3: Nomor Surat Otomatis                 (NSA-v40)
   M4: Tracker Status Kirim                 (TSK-v40)
   ══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── helpers ───────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  function safe(id) { return document.getElementById(id); }
  function esc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function rupiah(n) { return "Rp" + Number(n||0).toLocaleString("id-ID"); }
  function fmtTgl(d) {
    if (!d) return "-";
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString("id-ID", {day:"2-digit",month:"long",year:"numeric"});
  }
  function saveBOP() {
    try { localStorage.setItem(window._BOP_STORE || "bop_rt005_data_v1_25", JSON.stringify(window.data)); } catch(e) {}
  }
  function getBOP() { return window.data || {}; }

  /* ═══════════════════════════════════════════════════════════
     M1 — Multi-Kegiatan + Auto-sync LPJ
     ═════════════════════════════════════════════════════════ */

  function ensureKegiatan() {
    const d = getBOP();
    if (!d.kegiatan) d.kegiatan = [];
    window.data = d;
  }

  function allPengeluaran() {
    /* Gabungan: lpj.pengeluaran + kegiatan[].pengeluaran */
    const d = getBOP();
    const rows = [];
    (d.lpj?.pengeluaran || []).forEach(r => {
      if (r && (r[0]||r[1]||r[2])) rows.push({ tanggal:r[0], uraian:r[1], jumlah:Number(r[2]||0), ket:r[3], src:"LPJ" });
    });
    (d.kegiatan || []).forEach(k => {
      (k.pengeluaran || []).forEach(r => {
        if (r && (r[0]||r[1]||r[2])) rows.push({ tanggal:r[0], uraian:r[1], jumlah:Number(r[2]||0), ket:r[3], src:k.nama||"Kegiatan" });
      });
    });
    return rows;
  }

  function totalExpenseAll() {
    return allPengeluaran().reduce((s, r) => s + r.jumlah, 0);
  }

  /* Override totalExpense agar LPJ menyertakan kegiatan */
  function hookTotalExpense() {
    const origFn = window.totalExpense;
    window.totalExpense = function () {
      try { return totalExpenseAll(); } catch(e) { return origFn ? origFn() : 0; }
    };
  }

  /* Override lpjExpenseRowsV29 agar menyertakan kegiatan */
  function hookLpjExpenseRows() {
    window.lpjExpenseRowsV29 = function () {
      const rows = allPengeluaran();
      if (!rows.length) return `<tr><td colspan="5">Belum ada rincian pengeluaran.</td></tr>`;
      let no = 1;
      let html = "";
      /* Group by source */
      const groups = {};
      rows.forEach(r => {
        const g = r.src || "LPJ";
        if (!groups[g]) groups[g] = [];
        groups[g].push(r);
      });
      Object.entries(groups).forEach(([grp, grpRows]) => {
        if (Object.keys(groups).length > 1) {
          html += `<tr style="background:#f0f4ff"><td colspan="5" style="font-weight:700;padding:6px 10px;font-size:12px">📌 ${esc(grp)}</td></tr>`;
        }
        grpRows.forEach(r => {
          html += `<tr><td>${no++}</td><td>${esc(fmtTgl(r.tanggal)||r.tanggal)}</td><td>${esc(r.uraian)}</td><td style="text-align:right">${rupiah(r.jumlah)}</td><td>${esc(r.ket)}</td></tr>`;
        });
      });
      return html;
    };
  }

  function renderKegiatanTab() {
    const el = safe("tab-lpj-kegiatan");
    if (!el) return;
    ensureKegiatan();
    const d = getBOP();
    const list = d.kegiatan || [];

    el.innerHTML = `
      <div class="panel">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
          <div><h3 style="margin:0">Multi-Kegiatan LPJ</h3><p class="hint" style="margin:0">Setiap kegiatan memiliki rincian pengeluaran sendiri. LPJ otomatis menggabungkan semua.</p></div>
          <button class="primary" id="addKegiatanV40" type="button" style="margin-left:auto">+ Tambah Kegiatan</button>
          <button class="secondary" id="syncPersiapanV40" type="button" title="Import data dari Persiapan Kegiatan Operasional">⟳ Sync dari Persiapan</button>
        </div>
        ${list.length === 0 ? `<p class="hint" style="text-align:center;padding:24px">Belum ada kegiatan. Tambah kegiatan baru atau sync dari Persiapan Kegiatan.</p>` : ""}
        <div id="kegiatanAccordionV40">
          ${list.map((k, ki) => renderKegiatanCard(k, ki)).join("")}
        </div>
        <div id="addKegiatanFormV40" style="display:none" class="panel" style="margin-top:12px">
          <h4>Tambah Kegiatan Baru</h4>
          <div class="form-grid">
            <label>Nama Kegiatan <input id="newKegNama" placeholder="Contoh: Kerja Bakti Agustus"></label>
            <label>Jenis Kegiatan <input id="newKegJenis" placeholder="Rapat/Kegiatan/Konsumsi" value="Kegiatan BOP"></label>
            <label>Tanggal <input type="date" id="newKegTanggal"></label>
            <label>Catatan <input id="newKegCatatan" placeholder="Opsional"></label>
          </div>
          <div class="action-row" style="margin-top:12px">
            <button class="primary" id="confirmAddKegV40" type="button">Simpan Kegiatan</button>
            <button class="secondary" id="cancelAddKegV40" type="button">Batal</button>
          </div>
        </div>
      </div>`;

    bindKegiatanEvents();
  }

  function renderKegiatanCard(k, ki) {
    const rows = k.pengeluaran || [];
    const total = rows.reduce((s,r) => s + Number(r[2]||0), 0);
    return `
      <div class="keg-card-v40" data-keg-id="${esc(k.id)}">
        <div class="keg-card-header-v40" data-toggle-keg="${esc(k.id)}">
          <div>
            <strong>${esc(k.nama)}</strong>
            <span class="keg-meta-v40">${esc(k.jenis)} · ${fmtTgl(k.tanggal)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <span class="keg-total-v40">${rupiah(total)}</span>
            <span class="keg-count-v40">${rows.length} item</span>
            <button class="btn-danger-sm" data-delete-keg="${esc(k.id)}" type="button" title="Hapus kegiatan">✕</button>
          </div>
        </div>
        <div class="keg-body-v40" id="keg-body-${esc(k.id)}" style="display:none">
          <div class="table-wrap" style="margin-bottom:10px">
            <table class="keg-expense-table-v40">
              <thead><tr><th>Tanggal</th><th>Uraian Pengeluaran</th><th>Jumlah</th><th>Keterangan</th><th></th></tr></thead>
              <tbody id="keg-rows-${esc(k.id)}">
                ${rows.map((r,ri) => renderExpRow(k.id, ri, r)).join("")}
              </tbody>
            </table>
          </div>
          <div class="action-row">
            <button class="secondary" data-add-row="${esc(k.id)}" type="button">+ Tambah Baris</button>
            <button class="primary" data-save-keg="${esc(k.id)}" type="button">💾 Simpan Kegiatan Ini</button>
          </div>
        </div>
      </div>`;
  }

  function renderExpRow(kid, ri, r) {
    return `<tr data-row="${ri}">
      <td><input class="keg-inp" data-keg="${esc(kid)}" data-row="${ri}" data-col="0" type="date" value="${esc(r[0]||"")}"></td>
      <td><input class="keg-inp" data-keg="${esc(kid)}" data-row="${ri}" data-col="1" placeholder="Uraian pengeluaran" value="${esc(r[1]||"")}" style="min-width:160px"></td>
      <td><input class="keg-inp" data-keg="${esc(kid)}" data-row="${ri}" data-col="2" type="number" placeholder="0" value="${r[2]||0}" style="width:110px"></td>
      <td><input class="keg-inp" data-keg="${esc(kid)}" data-row="${ri}" data-col="3" placeholder="Keterangan" value="${esc(r[3]||"")}"></td>
      <td><button class="btn-danger-sm" data-del-row="${ri}" data-del-keg="${esc(kid)}" type="button">✕</button></td>
    </tr>`;
  }

  function bindKegiatanEvents() {
    const el = safe("tab-lpj-kegiatan");
    if (!el) return;

    el.querySelector("#addKegiatanV40")?.addEventListener("click", () => {
      const form = safe("addKegiatanFormV40");
      if (form) form.style.display = form.style.display === "none" ? "" : "none";
    });

    safe("cancelAddKegV40")?.addEventListener("click", () => {
      const form = safe("addKegiatanFormV40");
      if (form) form.style.display = "none";
    });

    safe("confirmAddKegV40")?.addEventListener("click", () => {
      const nama = safe("newKegNama")?.value.trim();
      if (!nama) { alert("Nama kegiatan harus diisi."); return; }
      ensureKegiatan();
      const d = getBOP();
      d.kegiatan.push({
        id: "keg-" + Date.now(),
        nama,
        jenis: safe("newKegJenis")?.value || "Kegiatan BOP",
        tanggal: safe("newKegTanggal")?.value || "",
        catatan: safe("newKegCatatan")?.value || "",
        pengeluaran: [["", "", 0, ""]],
        createdAt: new Date().toISOString()
      });
      saveBOP();
      renderKegiatanTab();
      refreshLpjPreview();
    });

    safe("syncPersiapanV40")?.addEventListener("click", syncFromPersiapan);

    /* Toggle accordion */
    el.querySelectorAll("[data-toggle-keg]").forEach(btn => {
      btn.addEventListener("click", e => {
        if (e.target.closest("[data-delete-keg]")) return;
        const id = btn.dataset.toggleKeg;
        const body = safe("keg-body-" + id);
        if (body) body.style.display = body.style.display === "none" ? "" : "none";
      });
    });

    /* Delete kegiatan */
    el.querySelectorAll("[data-delete-keg]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        if (!confirm("Hapus kegiatan ini beserta seluruh pengeluarannya?")) return;
        const id = btn.dataset.deleteKeg;
        const d = getBOP();
        d.kegiatan = (d.kegiatan || []).filter(k => k.id !== id);
        saveBOP();
        renderKegiatanTab();
        refreshLpjPreview();
      });
    });

    /* Add row to kegiatan */
    el.querySelectorAll("[data-add-row]").forEach(btn => {
      btn.addEventListener("click", () => {
        const kid = btn.dataset.addRow;
        saveKegiatanRows(kid);
        const d = getBOP();
        const k = (d.kegiatan || []).find(x => x.id === kid);
        if (!k) return;
        k.pengeluaran.push(["", "", 0, ""]);
        saveBOP();
        const tbody = safe("keg-rows-" + kid);
        if (tbody) tbody.innerHTML = (k.pengeluaran || []).map((r,ri) => renderExpRow(kid, ri, r)).join("");
      });
    });

    /* Delete row */
    el.querySelectorAll("[data-del-row]").forEach(btn => {
      btn.addEventListener("click", () => {
        const kid = btn.dataset.delKeg;
        const ri = Number(btn.dataset.delRow);
        saveKegiatanRows(kid);
        const d = getBOP();
        const k = (d.kegiatan || []).find(x => x.id === kid);
        if (!k) return;
        k.pengeluaran.splice(ri, 1);
        saveBOP();
        const tbody = safe("keg-rows-" + kid);
        if (tbody) tbody.innerHTML = (k.pengeluaran || []).map((r,ri) => renderExpRow(kid, ri, r)).join("");
        refreshLpjPreview();
      });
    });

    /* Save kegiatan */
    el.querySelectorAll("[data-save-keg]").forEach(btn => {
      btn.addEventListener("click", () => {
        const kid = btn.dataset.saveKeg;
        saveKegiatanRows(kid);
        saveBOP();
        refreshLpjPreview();
        showToastV40("✓ Kegiatan disimpan");
      });
    });

    /* Live input */
    el.querySelectorAll(".keg-inp").forEach(inp => {
      inp.addEventListener("change", () => {
        const kid = inp.dataset.keg;
        const ri = Number(inp.dataset.row);
        const col = Number(inp.dataset.col);
        const d = getBOP();
        const k = (d.kegiatan || []).find(x => x.id === kid);
        if (!k || !k.pengeluaran[ri]) return;
        k.pengeluaran[ri][col] = col === 2 ? Number(inp.value || 0) : inp.value;
      });
    });
  }

  function saveKegiatanRows(kid) {
    const d = getBOP();
    const k = (d.kegiatan || []).find(x => x.id === kid);
    if (!k) return;
    document.querySelectorAll(`.keg-inp[data-keg="${kid}"]`).forEach(inp => {
      const ri = Number(inp.dataset.row);
      const col = Number(inp.dataset.col);
      if (!k.pengeluaran[ri]) return;
      k.pengeluaran[ri][col] = col === 2 ? Number(inp.value || 0) : inp.value;
    });
  }

  function syncFromPersiapan() {
    const d = getBOP();
    const p = d.persiapan;
    if (!p || !p.nama) { alert("Isi data Persiapan Kegiatan Operasional terlebih dahulu."); return; }
    ensureKegiatan();
    /* Cek duplikat berdasarkan nama+tanggal */
    const exists = (d.kegiatan || []).find(k => k.nama === p.nama && k.tanggal === p.hariTanggal);
    if (exists) { alert(`Kegiatan "${p.nama}" sudah ada di daftar.`); return; }
    const keg = {
      id: "keg-" + Date.now(),
      nama: p.nama,
      jenis: p.jenis || "Kegiatan BOP",
      tanggal: p.hariTanggal || "",
      catatan: p.agenda || "",
      pengeluaran: p.nominal ? [[p.hariTanggal || "", p.nama, Number(p.nominal || 0), p.jenis || ""]] : [["", "", 0, ""]],
      createdAt: new Date().toISOString(),
      syncedFromPersiapan: true
    };
    d.kegiatan.push(keg);
    saveBOP();
    renderKegiatanTab();
    refreshLpjPreview();
    showToastV40(`✓ "${p.nama}" ditambahkan ke Multi-Kegiatan`);
  }

  function refreshLpjPreview() {
    try {
      const out = safe("lpjOutput");
      if (out && typeof window.docLpj === "function") out.innerHTML = window.docLpj();
    } catch(e) {}
  }

  /* ═══════════════════════════════════════════════════════════
     M2 — Rekap Bulanan → LPJ
     ═════════════════════════════════════════════════════════ */

  function getRekapBulanan() {
    const rows = allPengeluaran();
    const groups = {};

    rows.forEach(r => {
      const raw = String(r.tanggal || "").trim();
      let key = "Tanpa Tanggal";
      let label = "Tanpa Tanggal";

      if (raw) {
        /* Format: YYYY-MM-DD */
        const m = raw.match(/^(\d{4})-(\d{2})/);
        if (m) {
          const months = ["","Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
          key = `${m[1]}-${m[2]}`;
          label = `${months[parseInt(m[2], 10)] || m[2]} ${m[1]}`;
        } else {
          key = raw.slice(0, 7) || raw;
          label = raw;
        }
      }

      if (!groups[key]) groups[key] = { key, label, rows: [], total: 0 };
      groups[key].rows.push(r);
      groups[key].total += r.jumlah;
    });

    return Object.values(groups).sort((a, b) => a.key < b.key ? -1 : 1);
  }

  function renderRekapBulananTab() {
    const el = safe("tab-lpj-rekap");
    if (!el) return;

    const rekap = getRekapBulanan();
    const grandTotal = rekap.reduce((s, g) => s + g.total, 0);
    const d = getBOP();
    const penerimaan = Number(d.lpj?.saldoAwal || 0) + Number(d.lpj?.saldoBulanLalu || 0);

    el.innerHTML = `
      <div class="panel">
        <div style="margin-bottom:16px">
          <h3>Rekap Bulanan Pengeluaran</h3>
          <p class="hint">Ringkasan total pengeluaran per bulan dari semua sumber (LPJ + Multi-Kegiatan). Pilih bulan untuk buat LPJ spesifik.</p>
        </div>

        <div class="rekap-summary-v40">
          <div class="rekap-kpi-v40">
            <span>Total Seluruh Pengeluaran</span>
            <strong>${rupiah(grandTotal)}</strong>
          </div>
          <div class="rekap-kpi-v40">
            <span>Total Penerimaan</span>
            <strong>${rupiah(penerimaan)}</strong>
          </div>
          <div class="rekap-kpi-v40" style="--kpi-c:${grandTotal <= penerimaan ? '#16a34a':'#dc2626'}">
            <span>Sisa Dana</span>
            <strong style="color:var(--kpi-c)">${rupiah(penerimaan - grandTotal)}</strong>
          </div>
        </div>

        ${rekap.length === 0 ? `<p class="hint" style="text-align:center;padding:24px">Belum ada data pengeluaran.</p>` : `
        <div class="table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Bulan</th>
                <th>Jumlah Transaksi</th>
                <th>Total Pengeluaran</th>
                <th>Bar</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${rekap.map((g, i) => {
                const pct = grandTotal > 0 ? Math.round(g.total / grandTotal * 100) : 0;
                return `<tr>
                  <td>${i+1}</td>
                  <td><strong>${esc(g.label)}</strong></td>
                  <td style="text-align:center">${g.rows.length}</td>
                  <td style="text-align:right"><strong>${rupiah(g.total)}</strong></td>
                  <td style="min-width:120px">
                    <div class="rekap-bar-wrap-v40">
                      <div class="rekap-bar-fill-v40" style="width:${pct}%"></div>
                      <span class="rekap-bar-pct-v40">${pct}%</span>
                    </div>
                  </td>
                  <td>
                    <button class="secondary" data-rekap-lpj="${esc(g.key)}" type="button" style="font-size:12px;padding:4px 10px">Buat LPJ</button>
                    <button class="secondary" data-rekap-detail="${esc(g.key)}" type="button" style="font-size:12px;padding:4px 10px">Detail</button>
                  </td>
                </tr>`;
              }).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3"><strong>TOTAL</strong></td>
                <td style="text-align:right"><strong>${rupiah(grandTotal)}</strong></td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div id="rekapDetailV40" style="margin-top:16px;display:none"></div>
        `}
      </div>`;

    /* Bind events */
    el.querySelectorAll("[data-rekap-lpj]").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.rekapLpj;
        filterAndBuatLpjBulan(key);
      });
    });

    el.querySelectorAll("[data-rekap-detail]").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.rekapDetail;
        showRekapDetail(key);
      });
    });
  }

  function filterAndBuatLpjBulan(key) {
    const rekap = getRekapBulanan();
    const g = rekap.find(x => x.key === key);
    if (!g) return;

    const d = getBOP();
    /* Set periode ke bulan ini */
    d.lpj.periode = g.label;
    /* Update pengeluaran LPJ ke hanya pengeluaran bulan ini dari sumber LPJ (kegiatan tetap terpisah) */
    d.lpj.pengeluaran = (d.lpj.pengeluaran || []).filter(r => {
      const raw = String(r[0]||"").trim();
      const m = raw.match(/^(\d{4})-(\d{2})/);
      return m ? `${m[1]}-${m[2]}` === key : false;
    });

    window.data = d;
    saveBOP();

    /* Refresh input form LPJ */
    if (typeof window.fillInputs === "function") window.fillInputs();

    /* Navigasi ke tab LPJ preview */
    if (typeof window.activateTab === "function") window.activateTab("lpj-preview");
    refreshLpjPreview();

    showToastV40(`✓ LPJ disiapkan untuk ${g.label}`);
  }

  function showRekapDetail(key) {
    const rekap = getRekapBulanan();
    const g = rekap.find(x => x.key === key);
    const el = safe("rekapDetailV40");
    if (!g || !el) return;

    el.style.display = "";
    el.innerHTML = `
      <div class="panel" style="border-left:4px solid var(--blue,#2a8de0)">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <h4 style="margin:0">Detail Pengeluaran — ${esc(g.label)}</h4>
          <button class="secondary" id="closeRekapDetail" type="button" style="margin-left:auto;font-size:12px">Tutup</button>
        </div>
        <div class="table-wrap">
          <table class="report-table">
            <thead><tr><th>No</th><th>Tanggal</th><th>Uraian</th><th>Sumber</th><th>Jumlah</th><th>Keterangan</th></tr></thead>
            <tbody>
              ${g.rows.map((r, i) => `<tr>
                <td>${i+1}</td>
                <td>${esc(fmtTgl(r.tanggal)||r.tanggal)}</td>
                <td>${esc(r.uraian)}</td>
                <td><span style="font-size:11px;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:99px">${esc(r.src)}</span></td>
                <td style="text-align:right">${rupiah(r.jumlah)}</td>
                <td>${esc(r.ket)}</td>
              </tr>`).join("")}
            </tbody>
            <tfoot><tr><td colspan="4"><b>Total</b></td><td style="text-align:right"><b>${rupiah(g.total)}</b></td><td></td></tr></tfoot>
          </table>
        </div>
      </div>`;

    el.querySelector("#closeRekapDetail")?.addEventListener("click", () => { el.style.display = "none"; });
  }

  /* ═══════════════════════════════════════════════════════════
     M3 — Nomor Surat Otomatis
     ═════════════════════════════════════════════════════════ */

  const SURAT_TYPES = [
    { id: "permohonan", label: "Surat Permohonan Pencairan",   code: "001/BOP" },
    { id: "ba",         label: "Berita Acara RAP",              code: "002/BA-RAP" },
    { id: "undangan",   label: "Undangan Rapat/Kegiatan",       code: "003/UND" },
    { id: "sptjm",      label: "SPTJM",                         code: "004/SPTJM" },
    { id: "pkundangan", label: "Undangan Kegiatan Operasional", code: "005/UND-KEG" },
    { id: "kuitansi",   label: "Kuitansi / Tanda Terima",       code: "006/KWT" }
  ];

  function ensureSuratKounter() {
    const d = getBOP();
    if (!d.suratKounter) d.suratKounter = {};
    SURAT_TYPES.forEach(t => {
      if (!d.suratKounter[t.id]) d.suratKounter[t.id] = {};
    });
    window.data = d;
  }

  function suratPeriodKey(dateStr) {
    /* Returns e.g. "VII/2026" from date string */
    const romans = ["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
    if (!dateStr) {
      const n = new Date();
      return `${romans[n.getMonth()+1]}/${n.getFullYear()}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d)) return `${romans[d.getMonth()+1]}/${d.getFullYear()}`;
    /* Try to parse "Semarang, DD MonthName YYYY" format */
    const m = String(dateStr).match(/(\d+)\s+(\w+)\s+(20\d{2})/);
    if (m) {
      const monthNames = { januari:1,februari:2,maret:3,april:4,mei:5,juni:6,juli:7,agustus:8,september:9,oktober:10,november:11,desember:12 };
      const mo = monthNames[m[2].toLowerCase()];
      return mo ? `${romans[mo]}/${m[3]}` : `I/${m[3]}`;
    }
    const n = new Date();
    return `${romans[n.getMonth()+1]}/${n.getFullYear()}`;
  }

  function getLockedNomor(type, dateStr) {
    const d = getBOP();
    const period = suratPeriodKey(dateStr);
    return d.suratKounter?.[type]?.[period]?.nomor || null;
  }

  function lockNomorSurat(type, dateStr, nomorStr) {
    ensureSuratKounter();
    const d = getBOP();
    const period = suratPeriodKey(dateStr);
    if (!d.suratKounter[type]) d.suratKounter[type] = {};
    d.suratKounter[type][period] = {
      nomor: nomorStr,
      lockedAt: new Date().toISOString()
    };
    window.data = d;
    saveBOP();
  }

  function resetNomorSurat(type, dateStr) {
    const d = getBOP();
    const period = suratPeriodKey(dateStr);
    if (d.suratKounter?.[type]?.[period]) {
      delete d.suratKounter[type][period];
      window.data = d;
      saveBOP();
    }
  }

  /* Patch autoNumber agar bisa menyimpan/menggunakan nomor terkunci */
  function hookAutoNumber() {
    const origAutoNumber = window.autoNumber;
    window.autoNumber = function (type, dateStr) {
      const locked = getLockedNomor(type, dateStr);
      if (locked) return locked;
      return origAutoNumber ? origAutoNumber(type, dateStr) : "000";
    };
    window.autoNumber._orig = origAutoNumber;
    window.lockNomorSuratV40 = lockNomorSurat;
    window.resetNomorSuratV40 = resetNomorSurat;
  }

  function injectNomorSuratPanel() {
    /* Inject panel after the "Data Pengajuan" form */
    const target = safe("tab-data-pengajuan");
    if (!target || safe("nomorSuratPanelV40")) return;

    const panel = document.createElement("div");
    panel.id = "nomorSuratPanelV40";
    panel.className = "panel";
    panel.style.marginTop = "16px";
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <h3 style="margin:0">📋 Manajemen Nomor Surat</h3>
        <button class="secondary" id="refreshNomorV40" type="button" style="margin-left:auto;font-size:12px">🔄 Perbarui</button>
      </div>
      <p class="hint">Nomor surat dihasilkan otomatis per periode. Klik "Kunci" untuk menyimpan nomor permanen, atau "Reset" untuk mengembalikan ke auto.</p>
      <div id="nomorSuratListV40"></div>`;

    target.appendChild(panel);

    safe("refreshNomorV40")?.addEventListener("click", renderNomorSuratList);
    renderNomorSuratList();
  }

  function renderNomorSuratList() {
    const el = safe("nomorSuratListV40");
    if (!el) return;
    ensureSuratKounter();
    const d = getBOP();
    const p = d.pengajuan || {};
    const persiapan = d.persiapan || {};

    const dateMap = {
      permohonan: p.tanggalSurat,
      ba:         `${p.baTanggal||""} ${p.baBulan||""} ${p.baTahun||""}`,
      undangan:   p.meeting?.undTanggalSurat,
      sptjm:      p.tanggalSurat,
      pkundangan: p.meeting?.undTanggalSurat,
      kuitansi:   persiapan.tanggalTerima
    };

    const origFn = window.autoNumber._orig || window.autoNumber;

    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Jenis Surat</th><th>Periode</th><th>Nomor Surat Saat Ini</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>
        ${SURAT_TYPES.map(t => {
          const dateStr = dateMap[t.id] || "";
          const period = suratPeriodKey(dateStr);
          const locked = getLockedNomor(t.id, dateStr);
          const autoGen = origFn ? origFn(t.id, dateStr) : "-";
          const current = locked || autoGen;
          return `<tr>
            <td>${esc(t.label)}</td>
            <td><code style="font-size:12px">${esc(period)}</code></td>
            <td><code id="nomor-display-${t.id}" style="font-size:12px">${esc(current)}</code></td>
            <td>${locked ? `<span style="color:#16a34a;font-weight:700;font-size:12px">🔒 Terkunci</span>` : `<span style="color:#6b7280;font-size:12px">Auto</span>`}</td>
            <td style="display:flex;gap:6px;flex-wrap:wrap">
              ${!locked ? `<button class="primary" data-lock-nomor="${t.id}" data-date="${esc(dateStr)}" data-nomor="${esc(autoGen)}" type="button" style="font-size:11px;padding:4px 10px">🔒 Kunci</button>` : ""}
              ${locked ? `<button class="secondary" data-reset-nomor="${t.id}" data-date="${esc(dateStr)}" type="button" style="font-size:11px;padding:4px 10px">↺ Reset</button>` : ""}
              <button class="secondary" data-edit-nomor="${t.id}" data-date="${esc(dateStr)}" type="button" style="font-size:11px;padding:4px 10px">✏ Edit</button>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table></div>`;

    /* Events */
    el.querySelectorAll("[data-lock-nomor]").forEach(btn => {
      btn.addEventListener("click", () => {
        lockNomorSurat(btn.dataset.lockNomor, btn.dataset.date, btn.dataset.nomor);
        renderNomorSuratList();
        showToastV40("🔒 Nomor surat dikunci");
      });
    });
    el.querySelectorAll("[data-reset-nomor]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!confirm("Reset nomor surat ke auto?")) return;
        resetNomorSurat(btn.dataset.resetNomor, btn.dataset.date);
        renderNomorSuratList();
        showToastV40("↺ Nomor surat direset ke auto");
      });
    });
    el.querySelectorAll("[data-edit-nomor]").forEach(btn => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.editNomor;
        const dateStr = btn.dataset.date;
        const cur = getLockedNomor(type, dateStr) || (window.autoNumber._orig || window.autoNumber)(type, dateStr);
        const val = prompt("Edit nomor surat:", cur);
        if (val && val.trim()) {
          lockNomorSurat(type, dateStr, val.trim());
          renderNomorSuratList();
          if (typeof window.fillInputs === "function") window.fillInputs();
          showToastV40("✓ Nomor surat diperbarui");
        }
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     M4 — Tracker Status Kirim
     ═════════════════════════════════════════════════════════ */

  const VIA_OPTIONS = ["fisik","email","whatsapp","drive","aplikasi","lainnya"];
  const ALL_DOCS_V40 = [
    ...([
      {id:"permohonan",name:"Surat Permohonan Pencairan",group:"Pengajuan"},
      {id:"rap",name:"RAP BOP RT 1 Tahun",group:"Pengajuan"},
      {id:"rapbulanan",name:"RAP Bulanan",group:"Pengajuan"},
      {id:"ba",name:"Berita Acara RAP",group:"Pengajuan"},
      {id:"hadir",name:"Daftar Hadir RAP",group:"Pengajuan"},
      {id:"sptjm",name:"SPTJM",group:"Pengajuan"},
      {id:"rbb",name:"RBB / Pengambilan Operasional",group:"Pengajuan"}
    ]),
    ...([
      {id:"laporan",name:"Laporan Penggunaan BOP",group:"LPJ/SPJ"},
      {id:"pengeluaran",name:"Rincian Pengeluaran",group:"LPJ/SPJ"},
      {id:"kuitansi",name:"Kuitansi / Tanda Terima",group:"LPJ/SPJ"},
      {id:"undangan",name:"Undangan Kegiatan",group:"LPJ/SPJ"},
      {id:"hadir-kegiatan",name:"Daftar Hadir Kegiatan",group:"LPJ/SPJ"},
      {id:"notulen",name:"Notulen Kegiatan",group:"LPJ/SPJ"},
      {id:"moku",name:"Dokumentasi MoKu",group:"LPJ/SPJ"},
      {id:"pajak",name:"Bukti Pajak (jika ada)",group:"LPJ/SPJ"}
    ])
  ];

  function ensureTrackerKirim(month) {
    const d = getBOP();
    if (!d.monitoring) d.monitoring = { selectedMonth: "Juli 2026", months: {} };
    if (!d.monitoring.months[month]) d.monitoring.months[month] = { pengajuan:{}, lpj:{}, notes:"", kirim:{} };
    if (!d.monitoring.months[month].kirim) d.monitoring.months[month].kirim = {};
    ALL_DOCS_V40.forEach(doc => {
      const key = `${doc.group}|${doc.id}`;
      if (!d.monitoring.months[month].kirim[key]) {
        d.monitoring.months[month].kirim[key] = { tanggal:"", via:"fisik", penerima:"", catatan:"" };
      }
    });
    window.data = d;
    return d.monitoring.months[month].kirim;
  }

  function renderTrackerKirim() {
    const el = safe("trackerKirimListV40");
    if (!el) return;
    const d = getBOP();
    const month = d.monitoring?.selectedMonth || "Juli 2026";
    const kirim = ensureTrackerKirim(month);

    const groups = {};
    ALL_DOCS_V40.forEach(doc => {
      if (!groups[doc.group]) groups[doc.group] = [];
      groups[doc.group].push(doc);
    });

    el.innerHTML = Object.entries(groups).map(([grp, docs]) => `
      <div style="margin-bottom:24px">
        <h4 style="margin:0 0 10px;color:var(--navy,#071b38);font-size:14px">${esc(grp)}</h4>
        <div class="table-wrap">
          <table class="tracker-kirim-table-v40">
            <thead>
              <tr>
                <th>Dokumen</th>
                <th>Status Kirim</th>
                <th>Tanggal Kirim</th>
                <th>Via</th>
                <th>Penerima</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              ${docs.map(doc => {
                const key = `${grp}|${doc.id}`;
                const st = kirim[key] || { tanggal:"", via:"fisik", penerima:"", catatan:"" };
                const sent = !!st.tanggal;
                return `<tr class="${sent ? 'row-sent-v40' : ''}">
                  <td style="font-weight:600">${esc(doc.name)}</td>
                  <td>
                    ${sent
                      ? `<span class="kirim-badge-v40 sent">✓ Terkirim</span>`
                      : `<span class="kirim-badge-v40 pending">Belum</span>`
                    }
                  </td>
                  <td><input class="kirim-inp-v40" type="date" data-key="${esc(key)}" data-field="tanggal" value="${esc(st.tanggal)}"></td>
                  <td>
                    <select class="kirim-inp-v40" data-key="${esc(key)}" data-field="via">
                      ${VIA_OPTIONS.map(v => `<option value="${v}" ${st.via===v?"selected":""}>${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join("")}
                    </select>
                  </td>
                  <td><input class="kirim-inp-v40" type="text" data-key="${esc(key)}" data-field="penerima" placeholder="Nama penerima" value="${esc(st.penerima)}"></td>
                  <td><input class="kirim-inp-v40" type="text" data-key="${esc(key)}" data-field="catatan" placeholder="Catatan" value="${esc(st.catatan)}"></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>`).join("");

    /* Live update on change */
    el.querySelectorAll(".kirim-inp-v40").forEach(inp => {
      inp.addEventListener("change", () => {
        const d2 = getBOP();
        const month2 = d2.monitoring?.selectedMonth || month;
        ensureTrackerKirim(month2);
        const kir = d2.monitoring.months[month2].kirim;
        if (!kir[inp.dataset.key]) kir[inp.dataset.key] = {};
        kir[inp.dataset.key][inp.dataset.field] = inp.value;
        window.data = d2;
        saveBOP();
        /* Refresh status badges without full re-render */
        const tr = inp.closest("tr");
        if (tr) {
          const sent = !!d2.monitoring.months[month2].kirim[inp.dataset.key]?.tanggal;
          tr.className = sent ? "row-sent-v40" : "";
          const badge = tr.querySelector(".kirim-badge-v40");
          if (badge) {
            badge.className = `kirim-badge-v40 ${sent ? "sent" : "pending"}`;
            badge.textContent = sent ? "✓ Terkirim" : "Belum";
          }
        }
      });
    });
  }

  function injectTrackerKirimPanel() {
    const monitoringPage = safe("page-monitoring");
    if (!monitoringPage || safe("trackerKirimPanelV40")) return;

    const panel = document.createElement("div");
    panel.id = "trackerKirimPanelV40";
    panel.className = "panel";
    panel.style.marginTop = "20px";
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div>
          <h3 style="margin:0">📤 Tracker Status Kirim Dokumen</h3>
          <p class="hint" style="margin:4px 0 0">Catat tanggal kirim, via mana, dan kepada siapa setiap dokumen dikirim.</p>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="secondary" id="refreshTrackerKirimV40" type="button">🔄 Refresh</button>
          <button class="primary" id="printTrackerKirimV40" type="button">🖨 Cetak Tracker</button>
        </div>
      </div>
      <div id="trackerKirimListV40"></div>`;

    /* Cari catatan bulanan sebagai anchor point */
    const notesPanel = monitoringPage.querySelector(".panel:last-of-type");
    if (notesPanel) {
      notesPanel.insertAdjacentElement("afterend", panel);
    } else {
      monitoringPage.appendChild(panel);
    }

    safe("refreshTrackerKirimV40")?.addEventListener("click", renderTrackerKirim);
    safe("printTrackerKirimV40")?.addEventListener("click", printTrackerKirim);

    renderTrackerKirim();
  }

  function printTrackerKirim() {
    const d = getBOP();
    const month = d.monitoring?.selectedMonth || "Juli 2026";
    const kirim = ensureTrackerKirim(month);
    const m = d.master || {};

    const rows = ALL_DOCS_V40.map((doc, i) => {
      const key = `${doc.group}|${doc.id}`;
      const st = kirim[key] || {};
      const sent = !!st.tanggal;
      return `<tr>
        <td>${i+1}</td>
        <td><b>${esc(doc.name)}</b><br><small style="color:#6b7280">${esc(doc.group)}</small></td>
        <td>${sent ? `<b style="color:#16a34a">✓ Terkirim</b>` : `<span style="color:#9ca3af">Belum</span>`}</td>
        <td>${esc(st.tanggal ? fmtTgl(st.tanggal) : "-")}</td>
        <td>${esc(st.via || "-")}</td>
        <td>${esc(st.penerima || "-")}</td>
        <td>${esc(st.catatan || "-")}</td>
      </tr>`;
    }).join("");

    const totalSent = ALL_DOCS_V40.filter(doc => !!kirim[`${doc.group}|${doc.id}`]?.tanggal).length;

    const html = `<!doctype html><html><head><meta charset="utf-8">
      <title>Tracker Kirim ${esc(month)}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
        h1 { font-size: 14px; text-align: center; margin-bottom: 4px; }
        h2 { font-size: 12px; text-align: center; color: #444; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; }
        th { background: #f0f4ff; font-weight: 700; text-align: center; }
        tr:nth-child(even) { background: #fafafa; }
        .summary { text-align: center; margin-bottom: 12px; font-size: 12px; color: #444; }
      </style>
    </head><body>
      <h1>TRACKER STATUS KIRIM DOKUMEN BOP</h1>
      <h1>RT ${esc(m.rt||"005")} RW ${esc(m.rw||"012")} KEL. ${esc(m.kelurahan||"Tegalsari")}</h1>
      <h2>Periode: ${esc(month)} | Dokumen terkirim: ${totalSent}/${ALL_DOCS_V40.length}</h2>
      <table>
        <thead><tr><th>No</th><th>Dokumen</th><th>Status</th><th>Tanggal Kirim</th><th>Via</th><th>Penerima</th><th>Catatan</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
  }

  /* ═══════════════════════════════════════════════════════════
     Toast notifikasi
     ═════════════════════════════════════════════════════════ */
  function showToastV40(msg, type = "success") {
    /* Gunakan fungsi toast BOP jika ada */
    if (typeof window.bopToast === "function") {
      window.bopToast("Modul BOP", msg, type);
      return;
    }
    if (typeof window.notifyChangeV19 === "function") {
      window.notifyChangeV19("Modul BOP", msg, type);
      return;
    }
    let el = document.getElementById("toastV40");
    if (!el) {
      el = document.createElement("div");
      el.id = "toastV40";
      el.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(80px);background:#1e293b;color:#fff;padding:10px 20px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999;transition:transform .3s,opacity .3s;opacity:0;pointer-events:none";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = type === "success" ? "#16a34a" : type === "error" ? "#dc2626" : "#1e293b";
    el.style.transform = "translateX(-50%) translateY(0)";
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.transform = "translateX(-50%) translateY(80px)"; el.style.opacity = "0"; }, 2800);
  }

  /* ═══════════════════════════════════════════════════════════
     Inject HTML tabs
     ═════════════════════════════════════════════════════════ */

  function injectLpjTabs() {
    /* Tambah subtab Multi-Kegiatan + Rekap Bulanan */
    const subnav = document.querySelector("#page-lpj .subnav");
    if (subnav && !subnav.querySelector("[data-tab='lpj-kegiatan']")) {
      const b1 = document.createElement("button");
      b1.className = "subtab";
      b1.dataset.tab = "lpj-kegiatan";
      b1.textContent = "Multi-Kegiatan";
      const b2 = document.createElement("button");
      b2.className = "subtab";
      b2.dataset.tab = "lpj-rekap";
      b2.textContent = "Rekap Bulanan";
      subnav.appendChild(b1);
      subnav.appendChild(b2);
    }

    /* Tambah tab content */
    const lpjSection = safe("page-lpj");
    if (lpjSection && !safe("tab-lpj-kegiatan")) {
      const d1 = document.createElement("div");
      d1.className = "tab-content";
      d1.id = "tab-lpj-kegiatan";
      lpjSection.appendChild(d1);

      const d2 = document.createElement("div");
      d2.className = "tab-content";
      d2.id = "tab-lpj-rekap";
      lpjSection.appendChild(d2);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Hook goPage untuk render saat navigasi
     ═════════════════════════════════════════════════════════ */
  function hookGoPage() {
    const origGP = window.goPage;
    window.goPage = async function goPageV40(page) {
      if (typeof origGP === "function") await origGP(page);
      if (page === "monitoring") {
        setTimeout(() => {
          injectTrackerKirimPanel();
          renderTrackerKirim();
        }, 100);
      }
      if (page === "lpj") {
        setTimeout(() => {
          renderKegiatanTab();
          renderRekapBulananTab();
        }, 100);
      }
      if (page === "pengajuan") {
        setTimeout(() => {
          injectNomorSuratPanel();
        }, 200);
      }
    };
  }

  /* Hook activateTab agar render tab saat diklik */
  function hookActivateTab() {
    const origAT = window.activateTab;
    window.activateTab = function activateTabV40(id) {
      if (typeof origAT === "function") origAT(id);
      if (id === "lpj-kegiatan") setTimeout(renderKegiatanTab, 50);
      if (id === "lpj-rekap") setTimeout(renderRekapBulananTab, 50);
      if (id === "data-pengajuan") setTimeout(injectNomorSuratPanel, 200);
    };
  }

  /* Hook monitorMonth change agar tracker ikut refresh */
  function hookMonitorMonth() {
    const sel = safe("monitorMonth");
    if (!sel) return;
    sel.addEventListener("change", () => {
      setTimeout(renderTrackerKirim, 100);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     Init
     ═════════════════════════════════════════════════════════ */
  function init() {
    /* Setup data structures */
    ensureKegiatan();
    ensureSuratKounter();

    /* Inject hooks */
    hookTotalExpense();
    hookLpjExpenseRows();
    hookAutoNumber();
    hookGoPage();
    hookActivateTab();

    /* Inject UI */
    injectLpjTabs();

    /* Hook monitoring month change */
    hookMonitorMonth();

    /* Render jika sudah di halaman terkait */
    setTimeout(() => {
      const active = document.querySelector(".page.active");
      if (!active) return;
      const id = active.id;
      if (id === "page-monitoring") { injectTrackerKirimPanel(); renderTrackerKirim(); }
      if (id === "page-lpj") { renderKegiatanTab(); renderRekapBulananTab(); }
      if (id === "page-pengajuan") { injectNomorSuratPanel(); }
    }, 600);

    console.log("[BOP v1.40] M1-M4 modules aktif: Multi-Kegiatan, Rekap Bulanan, Nomor Surat, Tracker Kirim.");
  }

  /* Expose untuk akses global */
  window.renderKegiatanLpjV40     = renderKegiatanTab;
  window.renderRekapBulananV40    = renderRekapBulananTab;
  window.renderTrackerKirimV40    = renderTrackerKirim;
  window.renderNomorSuratV40      = renderNomorSuratList;
  window.syncFromPersiapanV40     = syncFromPersiapan;
  window.allPengeluaranV40        = allPengeluaran;
  window.totalExpenseAllV40       = totalExpenseAll;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 500));
  } else {
    setTimeout(init, 500);
  }

})();
/* END PATCH v1.40 */
