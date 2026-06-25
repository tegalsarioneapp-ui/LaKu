/* =========================================================
   MoKu Mobile v2 – app.js
   RT 005 RW 012 Tegalsari, Candisari, Semarang
   GPS Presisi · Reverse Geocoding · Premium Design
   ========================================================= */
(() => {
  "use strict";

  const STORAGE_KEY  = "moku_rt005_v2_premium";
  const DEFAULT_TYPES = ["Foto Sebelum", "Foto Proses", "Foto Sesudah", "Foto Nota/Kuitansi", "Foto Serah Terima"];
  const MOKU_MONTHS  = ["Januari 2026","Februari 2026","Maret 2026","April 2026","Mei 2026","Juni 2026","Juli 2026","Agustus 2026","September 2026","Oktober 2026","November 2026","Desember 2026"];
  const MOKU_MONTH_ALL = "Januari-Desember 2026";
  const GPS_MAX_MS   = 15_000;  /* batas waktu absolut (15s, turun dari 120s) */
  const GPS_GOOD_ACC = 50;      /* akurasi "cukup bagus" dalam meter           */
  const GPS_ACCEPT_MS = 5_000;  /* terima posisi terbaik setelah 5 detik       */

  /* ── State ─────────────────────────────────────────────── */
  let state        = loadState();
  let selectedType = null;
  let clockTimer   = null;
  let gpsWatchId   = null;
  let gpsTimer     = null;
  let cameraStream = null;
  let installPrompt = null;
  let facingMode   = "environment";
  let lightboxPhoto = null;
  let geocodeCache  = {};
  const photoCache  = new Map(); /* photoId → dataUrl, loaded from IndexedDB on boot */

  /* ── Helpers ────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const idOf = a => String(a?.id || "");
  const now  = () => new Date();

  function fmtTime(d = now()) {
    return d.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
  }
  function fmtDate(d = now()) {
    return d.toLocaleDateString("id-ID", { weekday:"long", day:"2-digit", month:"long", year:"numeric" });
  }
  function fmtFull(d = now()) {
    const day  = d.toLocaleDateString("id-ID", { weekday:"long", day:"2-digit", month:"long", year:"numeric" });
    const time = d.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
    const off  = -d.getTimezoneOffset();
    const zone = off >= 420 && off < 480 ? "WIB" : off >= 480 && off < 540 ? "WITA" : off >= 540 ? "WIT" : "UTC" + (off >= 0 ? "+" : "") + Math.floor(off/60);
    return `${day} • ${time} ${zone}`;
  }
  const dateCode = (d = now()) => d.toISOString().replace(/[-:T.Z]/g,"").slice(0,14);
  const money = v => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));

  /* ── Storage ─────────────────────────────────────────────── */
  function defaultState() {
    return {
      version: "2.0",
      activities: [],
      currentId: null,
      results: {},
      gps: null,
      gpsStatus: "idle",
      gpsMessage: "",
      gpsDebug: {},
      historyFilter: "",
      lastUpdated: null
    };
  }

  function loadState() {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem("moku_rt005_v15_gps_fix") ||
        localStorage.getItem("moku_rt005_v14_premium");
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, version: "2.0", results: parsed.results || {} };
    } catch(_) { return defaultState(); }
  }

  function saveState() {
    state.lastUpdated = now().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /* ── Activity helpers ───────────────────────────────────── */
  const currentActivity = () =>
    (state.activities||[]).find(a => idOf(a) === String(state.currentId||"")) || null;

  function resultFor(act) {
    const id = idOf(act);
    if (!state.results[id])
      state.results[id] = { activityId:id, photos:[], note:"", status:"Belum Lengkap", updatedAt:null };
    return state.results[id];
  }

  const checklistOf = act =>
    Array.isArray(act?.checklist) && act.checklist.length ? act.checklist : DEFAULT_TYPES;

  const isDone = act => {
    const res = resultFor(act);
    return checklistOf(act).every(type => (res.photos||[]).some(p => p.type === type));
  };

  const totalPhotos = () =>
    Object.values(state.results||{}).reduce((s,r) => s + (r.photos||[]).length, 0);

  function normalizeActivity(raw, idx) {
    return {
      id:          String(raw.id || `moku-${Date.now()}-${idx}`),
      jenis:       raw.jenis || raw.type || raw.kategori || "Kegiatan BOP",
      nama:        raw.nama || raw.name || raw.title || raw.kegiatan || `Kegiatan ${idx+1}`,
      hariTanggal: raw.hariTanggal || raw.tanggal || raw.date || raw.hari_tanggal || "",
      waktu:       raw.waktu || raw.time || "",
      tempat:      raw.tempat || raw.lokasi || raw.location || "",
      agenda:      raw.agenda || raw.deskripsi || raw.description || "",
      nominal:     raw.nominal || raw.anggaran || raw.total || 0,
      checklist:   Array.isArray(raw.checklist) && raw.checklist.length ? raw.checklist : DEFAULT_TYPES,
      source:      raw.source || "MoKu"
    };
  }

  /* ── GPS ────────────────────────────────────────────────── */
  function diagnoseEnv() {
    const secure        = !!window.isSecureContext;
    const protocol      = location.protocol;
    const host          = location.hostname || "file/local";
    const isLocalhost   = ["localhost","127.0.0.1","::1"].includes(host);
    const isHttpLan     = protocol === "http:" && !isLocalhost;
    const isFileProt    = protocol === "file:";
    const gpsSafe       = secure && !isFileProt && !isHttpLan;
    const cameraOk      = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const gpsOk         = !!navigator.geolocation;
    state.gpsDebug = { secure, protocol, host, isLocalhost, isHttpLan, isFileProt, gpsSafe, cameraOk, gpsOk, permission:"belum dicek" };
    return state.gpsDebug;
  }

  async function refreshPermDebug() {
    diagnoseEnv();
    if (navigator.permissions?.query) {
      try {
        const p = await navigator.permissions.query({ name:"geolocation" });
        state.gpsDebug.permission = p.state;
        p.onchange = () => { state.gpsDebug.permission = p.state; saveState(); renderGps(); };
      } catch(_) { state.gpsDebug.permission = "tidak tersedia"; }
    }
    saveState();
  }

  function gpsBlockedMsg() {
    const d = diagnoseEnv();
    if (!d.gpsOk)       return "GPS tidak didukung browser ini. Gunakan Chrome/Edge terbaru di HP.";
    if (d.isHttpLan)    return "GPS diblokir karena dibuka dari HTTP/LAN. Buka dari HTTPS atau localhost.";
    if (d.isFileProt)   return "Dibuka sebagai file lokal. GPS bisa timeout. Gunakan HTTPS/localhost untuk GPS stabil.";
    if (state.gpsDebug.permission === "denied") return "Izin lokasi ditolak. Aktifkan di Pengaturan Situs browser.";
    return "GPS belum terkunci. Aktifkan Akurasi Tinggi, Wi-Fi/data, lalu tekan Kunci GPS.";
  }

  function coordsToText(gps) {
    if (!gps) return "GPS belum terkunci";
    return `${Number(gps.lat).toFixed(6)}, ${Number(gps.lng).toFixed(6)} ±${Math.round(gps.accuracy||0)}m`;
  }

  function setGpsStatus(status, message, gps = state.gps) {
    state.gpsStatus  = status;
    state.gpsMessage = message;
    state.gps        = gps || null;
    saveState();
    renderGps();
  }

  /* Reverse geocoding via Nominatim (free, no key needed) */
  async function reverseGeocode(lat, lng) {
    const key = `${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`;
    if (geocodeCache[key]) return geocodeCache[key];
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`;
      const res = await fetch(url, { headers:{ "Accept-Language":"id" }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const data = await res.json();
      const a = data.address || {};
      const parts = [
        a.neighbourhood || a.suburb || a.village || a.hamlet,
        a.city_district  || a.district || a.county,
        a.city || a.town
      ].filter(Boolean);
      const label = parts.slice(0,2).join(", ") || data.display_name?.split(",")[0] || null;
      geocodeCache[key] = label;
      return label;
    } catch(_) { return null; }
  }

  async function lockGps({ silent = false } = {}) {
    await refreshPermDebug();
    const d = diagnoseEnv();
    if (!d.gpsOk || d.isHttpLan) {
      setGpsStatus("blocked", gpsBlockedMsg(), null);
      if (!silent) showGpsSheet();
      return null;
    }

    /* Batalkan watch sebelumnya */
    if (gpsWatchId !== null) { try { navigator.geolocation.clearWatch(gpsWatchId); } catch(_){} gpsWatchId = null; }
    if (gpsTimer)            { clearTimeout(gpsTimer); gpsTimer = null; }

    setGpsStatus("searching", "Mengambil lokasi…", state.gps);

    return new Promise(resolve => {
      let settled        = false;
      let best           = null;
      let geocodeStarted = false;
      const started      = Date.now();
      const elapsed      = () => Math.round((Date.now() - started) / 1000);

      /* Mulai reverse-geocoding segera setelah ada posisi pertama */
      const startGeocode = (gps) => {
        if (geocodeStarted || !gps) return;
        geocodeStarted = true;
        setGpsStatus("searching", `Koordinat diterima ±${Math.round(gps.accuracy||0)}m • mengambil nama jalan…`, gps);
        reverseGeocode(gps.lat, gps.lng).then(addr => {
          if (!addr) return;
          const g = state.gps || gps;
          g.address = addr;
          state.gps = g;
          const accStr = `±${Math.round(g.accuracy||0)}m`;
          if (settled) {
            setGpsStatus("locked", `${addr} ${accStr}`, g);
          } else {
            setGpsStatus("searching", `${addr} ${accStr} • memperhalus…`, g);
          }
          saveState();
        }).catch(() => {});
      };

      const finish = (gps, status = "locked", message) => {
        if (settled) return;
        settled = true;
        if (gpsWatchId !== null) { try { navigator.geolocation.clearWatch(gpsWatchId); } catch(_){} gpsWatchId = null; }
        if (gpsTimer) { clearTimeout(gpsTimer); gpsTimer = null; }
        if (gps) {
          const addr    = gps.address || (state.gps?.address) || null;
          const accStr  = `±${Math.round(gps.accuracy||0)}m`;
          const msg     = message || (addr ? `${addr} ${accStr}` : `Lokasi diterima ${accStr}`);
          setGpsStatus("locked", msg, gps);
          if (!geocodeStarted) startGeocode(gps); /* pastikan geocoding dimulai */
          resolve(gps);
        } else {
          setGpsStatus(status, message || gpsBlockedMsg(), null);
          if (!silent) showGpsSheet();
          resolve(null);
        }
      };

      const keepBest = (pos) => {
        const g = {
          lat:            pos.coords.latitude,
          lng:            pos.coords.longitude,
          accuracy:       pos.coords.accuracy,
          altitude:       pos.coords.altitude,
          heading:        pos.coords.heading,
          speed:          pos.coords.speed,
          capturedAt:     now().toISOString(),
          capturedAtText: fmtFull(),
          provider:       "geolocation-v2"
        };
        /* Pertahankan address yang sudah ada jika akurasi baru lebih baik */
        if (!best || Number(g.accuracy||99999) < Number(best.accuracy||99999)) {
          if (best?.address) g.address = best.address;
          best = g;
        }
        state.gps = best;
        saveState();
        return best;
      };

      /* ── Tahap 1: Lokasi jaringan/WiFi (cepat, 1-3 detik) ─── */
      try {
        navigator.geolocation.getCurrentPosition(
          pos => {
            if (settled) return;
            const got = keepBest(pos);
            startGeocode(got); /* mulai geocoding sekarang, jangan tunggu GPS */
          },
          () => { /* jaringan tidak tersedia, lanjut ke tahap 2 */ },
          { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 }
        );
      } catch(_) {}

      /* ── Tahap 2: GPS presisi tinggi (watchPosition) ────────── */
      const onGpsSuccess = pos => {
        if (settled) return;
        const got = keepBest(pos);
        const acc = got.accuracy || 99999;
        const t   = elapsed();

        if (!geocodeStarted) startGeocode(got);

        const accStr = `±${Math.round(acc)}m`;
        setGpsStatus("searching", `Mengunci… ${accStr} (${t}s)`, got);

        /* Terima jika akurasi bagus, atau sudah cukup lama */
        if (acc <= GPS_GOOD_ACC)          finish(got, "locked", `GPS presisi ${accStr}`);
        else if (t >= 8 && acc <= 150)    finish(got, "locked", `Lokasi ${accStr}`);
      };

      const onGpsError = err => {
        if (best) {
          /* Sudah punya lokasi jaringan — tetap tampilkan, tunggu GPS */
          setGpsStatus("searching", `Lokasi jaringan ±${Math.round(best.accuracy||0)}m • menunggu GPS…`, best);
          return;
        }
        let msg = "Menunggu sinyal GPS…";
        if (err?.code === 1) msg = "Izin lokasi ditolak. Aktifkan di Pengaturan Situs.";
        if (err?.code === 3) msg = "GPS timeout. Masih mencari sinyal…";
        setGpsStatus("searching", msg, null);
      };

      try {
        gpsWatchId = navigator.geolocation.watchPosition(onGpsSuccess, onGpsError, {
          enableHighAccuracy: true,
          timeout:    10_000,
          maximumAge: 0
        });
      } catch(err) { onGpsError(err); }

      /* ── Tahap 3: Terima posisi terbaik setelah GPS_ACCEPT_MS ─ */
      setTimeout(() => {
        if (!settled && best) {
          finish(best, "locked", `Lokasi ±${Math.round(best.accuracy||0)}m`);
        }
      }, GPS_ACCEPT_MS);

      /* ── Timeout absolut ──────────────────────────────────────── */
      gpsTimer = setTimeout(() => {
        if (settled) return;
        if (best) finish(best, "locked", `Lokasi ±${Math.round(best.accuracy||0)}m`);
        else      finish(null, "failed", "Lokasi tidak tersedia. Pastikan izin GPS diaktifkan.");
      }, GPS_MAX_MS);
    });
  }

  /* ── Clock ──────────────────────────────────────────────── */
  function renderClock() {
    const d = now();
    $("clockShort").textContent = fmtTime(d);
    $("dateShort").textContent  = fmtDate(d);
    const ot = $("overlayTime");
    if (ot) ot.textContent = fmtTime(d);
  }
  const startClock = () => { renderClock(); clearInterval(clockTimer); clockTimer = setInterval(renderClock, 1000); };

  /* ── GPS render ─────────────────────────────────────────── */
  function renderGps() {
    const btn         = $("gpsStatusBtn");
    const short       = $("gpsShort");
    const detail      = $("gpsDetail");
    const acc         = $("gpsAcc");
    const guardBox    = $("gpsGuardBox");
    const guardTitle  = $("gpsGuardTitle");
    const guardText   = $("gpsGuardText");
    const overlayGps  = $("overlayGps");

    btn.classList.remove("gps-ok","gps-bad","gps-wait","gps-searching");
    guardBox.classList.remove("locked","blocked");

    if (state.gpsStatus === "locked" && state.gps) {
      btn.classList.add("gps-ok");
      short.textContent  = "GPS terkunci";
      const addr = state.gps.address ? state.gps.address : coordsToText(state.gps);
      detail.textContent = addr;
      acc.textContent    = `±${Math.round(state.gps.accuracy||0)}m`;
      guardBox.classList.add("locked");
      guardTitle.textContent = "GPS terkunci ✓";
      guardText.textContent  = `${state.gps.address ? state.gps.address + " • " : ""}${coordsToText(state.gps)}`;
      if (overlayGps) overlayGps.textContent = `GPS: ${addr} ±${Math.round(state.gps.accuracy||0)}m`;
      return;
    }

    if (state.gpsStatus === "blocked" || state.gpsStatus === "denied" || state.gpsStatus === "failed") {
      btn.classList.add("gps-bad");
      short.textContent  = "GPS belum bisa";
      detail.textContent = state.gpsMessage || "Tekan untuk detail";
      acc.textContent    = "";
      guardBox.classList.add("blocked");
      guardTitle.textContent = "GPS belum bisa";
      guardText.textContent  = state.gpsMessage || gpsBlockedMsg();
      if (overlayGps) overlayGps.textContent = "GPS belum terkunci";
      return;
    }

    const searching = state.gpsStatus === "searching";
    btn.classList.add(searching ? "gps-searching" : "gps-wait");
    short.textContent  = searching ? "Mengunci GPS..." : "GPS belum terkunci";
    detail.textContent = state.gpsMessage || (searching ? "Mencari sinyal..." : "Ketuk untuk kunci GPS");
    acc.textContent    = (searching && state.gps) ? `±${Math.round(state.gps.accuracy||0)}m` : "";
    guardBox.classList.remove("locked","blocked");
    guardTitle.textContent = searching ? "Mengunci GPS..." : "GPS Guard";
    guardText.textContent  = state.gpsMessage || "Kunci GPS sebelum ambil foto agar koordinat masuk watermark.";
    if (overlayGps) overlayGps.textContent = searching ? "GPS sedang dikunci..." : "GPS belum terkunci";
  }

  /* ── Activities ─────────────────────────────────────────── */
  function importActivitiesPayload(payload) {
    const items = Array.isArray(payload) ? payload :
      (payload.activities || payload.kegiatan || payload.data || []);
    if (!Array.isArray(items) || !items.length) throw new Error("Tidak ada data kegiatan");
    state.activities = items.map(normalizeActivity);
    state.currentId  = idOf(state.activities[0]);
    selectedType     = checklistOf(state.activities[0])[0];
    saveState();
    render();
    showTab("home");
    showToast(`✓ Import ${state.activities.length} kegiatan berhasil`);
  }

  function openAddModal() {
    $("inputNama").value    = "";
    $("inputTempat").value  = "Wilayah RT 005 RW 012 Tegalsari";
    $("inputTanggal").value = fmtDate();
    $("inputJenis").value   = "Kegiatan BOP";
    $("activityModal").hidden = false;
    setTimeout(() => $("inputNama").focus(), 100);
  }

  function saveNewActivity() {
    const nama = ($("inputNama").value || "").trim();
    if (!nama) { $("inputNama").focus(); return; }
    const act = normalizeActivity({
      nama,
      tempat:      $("inputTempat").value || "Wilayah RT 005 RW 012 Tegalsari",
      hariTanggal: $("inputTanggal").value || fmtDate(),
      jenis:       $("inputJenis").value   || "Kegiatan BOP"
    }, Date.now());
    state.activities = [...(state.activities||[]), act];
    state.currentId  = idOf(act);
    selectedType     = checklistOf(act)[0];
    saveState();
    render();
    $("activityModal").hidden = true;
    showTab("camera");
    showToast(`✓ Kegiatan "${nama}" ditambahkan`);
  }

  function selectActivity(id) {
    state.currentId = id;
    const act = currentActivity();
    selectedType = checklistOf(act)[0];
    saveState();
    render();
    showTab("camera");
  }

  /* ── Tab / render ───────────────────────────────────────── */
  function showTab(tab) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    const page = $(`page-${tab}`);
    if (page) page.classList.add("active");
    const btn = document.querySelector(`.nav-item[data-tab="${tab}"]`);
    if (btn) btn.classList.add("active");
    render();
  }

  function render() {
    const activities = state.activities || [];
    $("statActivities").textContent = activities.length;
    $("statPhotos").textContent     = totalPhotos();
    $("statDone").textContent       = activities.filter(isDone).length;
    renderActiveCard();
    renderActivityList();
    renderCameraTab();
    renderResults();
    renderHistory();
    renderGps();
  }

  function renderActiveCard() {
    const act = currentActivity();
    if (!act) {
      $("activeTitle").textContent = "Belum memilih kegiatan";
      $("activeMeta").textContent  = "Import kegiatan dari BOP utama atau tambah manual.";
      $("activeProgress").hidden   = true;
      return;
    }
    $("activeTitle").textContent = act.nama;
    $("activeMeta").textContent  = [act.hariTanggal, act.tempat].filter(Boolean).join(" • ") || "Siap dokumentasi";
    const res   = resultFor(act);
    const types = checklistOf(act);
    const done  = types.filter(t => (res.photos||[]).some(p => p.type === t)).length;
    $("activeProgress").hidden   = false;
    $("progressFill").style.width = `${Math.round(done/types.length*100)}%`;
    $("progressText").textContent = `${done} / ${types.length} jenis foto`;
  }

  function renderActivityList() {
    const el = $("activityList");
    const allActivities = state.activities || [];
    const filterSel = $("activityMonthFilter");

    /* Isi dropdown bulan dari data */
    if (filterSel) {
      const months = [...new Set(allActivities.map(a => a.bulan || a.hariTanggal || "").filter(Boolean))];
      const monthOptions = MOKU_MONTHS.filter(m => months.includes(m));
      /* Simpan nilai aktif sebelum rebuild */
      const targetFilter = filterSel.value || state.activityMonthFilter || "";
      filterSel.innerHTML = `<option value="">Semua Bulan</option>` +
        monthOptions.map(m => `<option value="${m}">${m}</option>`).join("");
      /* Restore nilai setelah rebuild */
      if (targetFilter && monthOptions.includes(targetFilter)) {
        filterSel.value = targetFilter;
      } else {
        filterSel.value = "";
      }
    }

    const activeFilter = filterSel ? filterSel.value : (state.activityMonthFilter || "");
    const activities = activeFilter
      ? allActivities.filter(a => (a.bulan || a.hariTanggal || "") === activeFilter)
      : allActivities;

    if (!activities.length) {
      el.innerHTML = allActivities.length
        ? `<div class="empty-state"><b>Tidak ada kegiatan pada ${activeFilter}</b>Pilih bulan lain atau hapus filter.</div>`
        : `<div class="empty-state"><b>Belum ada kegiatan</b>Sinkron BOP otomatis akan menambahkan kegiatan RAP.</div>`;
      return;
    }
    el.innerHTML = activities.map(act => {
      const id     = idOf(act);
      const res    = resultFor(act);
      const done   = isDone(act);
      const active = id === state.currentId;
      const types  = checklistOf(act);
      const doneCount = types.filter(t => (res.photos||[]).some(p => p.type === t)).length;
      const pct    = types.length ? Math.round(doneCount/types.length*100) : 0;
      /* Cari jenis foto berikutnya yang belum diambil */
      const nextType = types.find(t => !(res.photos||[]).some(p => p.type === t));
      const nextLabel = nextType ? nextType.replace("Foto ","") : null;
      return `<article class="activity-card ${active ? "is-active" : ""}">
        <div class="card-row">
          <div style="flex:1;min-width:0">
            <div class="card-title">${esc(act.nama)}</div>
            <div class="card-meta">
              ${act.hariTanggal ? `<span>📅 ${esc(act.hariTanggal)}</span>` : ""}
              ${act.tempat ? `<span>📍 ${esc(act.tempat)}</span>` : ""}
            </div>
            <div class="mini-progress-wrap">
              <div class="mini-progress"><div class="mini-progress-fill" style="width:${pct}%"></div></div>
              <span class="mini-progress-label">${doneCount} dari ${types.length} jenis foto</span>
            </div>
          </div>
          <span class="state-chip ${done ? "done" : ""}">${done ? "✓ Lengkap" : `${doneCount}/${types.length}`}</span>
        </div>
        ${done
          ? `<button class="btn-foto-done" data-select-activity="${esc(id)}" type="button">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
               Dokumentasi Lengkap · Lihat Foto
             </button>`
          : `<button class="btn-foto-langsung" data-foto-langsung="${esc(id)}" type="button">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
               <span>
                 <b>Ambil Foto${nextLabel ? ` — ${nextLabel}` : ""}</b>
                 <small>${active ? "Ketuk untuk buka kamera" : "Ketuk untuk mulai"}</small>
               </span>
             </button>`
        }
      </article>`;
    }).join("");
  }

  function renderCameraTab() {
    const act = currentActivity();
    $("cameraTitle").textContent = act ? act.nama : "Pilih kegiatan dulu";
    $("cameraMeta").textContent  = act
      ? ([act.hariTanggal, act.tempat].filter(Boolean).join(" · ") || "Dokumentasi kegiatan")
      : "Pilih kegiatan dari tab Kegiatan terlebih dahulu.";

    const chips = $("photoTypeChips");
    if (!act) {
      chips.innerHTML = `<div class="empty-chips-hint">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.35"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Buka tab <b>Kegiatan</b>, lalu ketuk<br><b>Ambil Foto</b> pada kegiatan yang diinginkan.</span>
      </div>`;
      $("recentPhotos").innerHTML = "";
      $("photoCountBadge").hidden = true;
      $("resultNote").value = "";
      return;
    }

    const res   = resultFor(act);
    const types = checklistOf(act);
    if (!types.includes(selectedType)) selectedType = types[0];

    /* Cari foto yang belum diambil */
    const missingTypes = types.filter(t => !(res.photos||[]).some(p => p.type === t));
    const nextMissing  = missingTypes[0] || null;
    /* Auto-select foto yang belum diambil */
    if (nextMissing && !types.includes(selectedType)) selectedType = nextMissing;
    if (nextMissing && !(res.photos||[]).some(p => p.type === selectedType)) {
      selectedType = nextMissing;
    }

    chips.innerHTML = types.map(type => {
      const count   = (res.photos||[]).filter(p => p.type === type).length;
      const hasDone = count > 0;
      const active  = type === selectedType;
      const shortLabel = type.replace("Foto ","");
      return `<button class="type-chip ${active ? "active" : ""} ${hasDone && !active ? "done" : ""}" data-photo-type="${esc(type)}" type="button">
        ${hasDone ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ""}
        <span class="chip-label">${esc(shortLabel)}</span>
        ${count > 0 ? `<span class="chip-count">${count}</span>` : ""}
      </button>`;
    }).join("");

    if ($("resultNote").value !== (res.note||"")) $("resultNote").value = res.note||"";

    const photos = (res.photos||[]).slice().reverse();
    const badge  = $("photoCountBadge");
    badge.hidden = !photos.length;
    if (photos.length) badge.textContent = `${photos.length} foto`;

    $("recentPhotos").innerHTML = photos.length
      ? photos.map(p => photoCard(p)).join("")
      : `<div class="empty-state"><b>Belum ada foto</b>Tekan tombol kamera untuk mulai dokumentasi.</div>`;
  }

  function renderResults() {
    const el = $("resultList");
    const activities = state.activities || [];
    if (!activities.length) {
      el.innerHTML = `<div class="empty-state"><b>Belum ada hasil</b>Ambil foto kegiatan terlebih dahulu.</div>`;
      return;
    }
    el.innerHTML = activities.map(act => {
      const res    = resultFor(act);
      const photos = res.photos || [];
      const types  = checklistOf(act);
      const done   = isDone(act);
      const doneCount = types.filter(t => photos.some(p => p.type === t)).length;
      const pct    = types.length ? Math.round(doneCount/types.length*100) : 0;
      return `<article class="result-card">
        <div class="card-row">
          <div style="flex:1;min-width:0">
            <div class="card-title">${esc(act.nama)}</div>
            <div class="card-meta">
              ${act.hariTanggal ? `<span>📅 ${esc(act.hariTanggal)}</span>` : ""}
              <span>${photos.length} foto · ${doneCount}/${types.length} jenis</span>
            </div>
            <div class="mini-progress-wrap">
              <div class="mini-progress"><div class="mini-progress-fill" style="width:${pct}%"></div></div>
            </div>
          </div>
          <span class="state-chip ${done ? "done" : ""}">${done ? "✓ Lengkap" : "Proses"}</span>
        </div>
        ${done
          ? `<div class="result-done-note">✓ Semua foto sudah diambil dan tersinkron ke laporan BOP.</div>`
          : `<button class="btn-foto-langsung" data-foto-langsung="${esc(idOf(act))}" type="button">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
               <span><b>Lanjut Ambil Foto</b><small>Masih ada foto yang belum diambil</small></span>
             </button>`
        }
      </article>`;
    }).join("");
  }

  /* ── Riwayat Kegiatan (History by Month) ───────────────── */
  function getActivityMonths() {
    const months = new Set();
    (state.activities || []).forEach(a => {
      const b = a.bulan || a.hariTanggal || "";
      if (b) months.add(b);
    });
    return MOKU_MONTHS.filter(m => months.has(m));
  }

  function renderHistory() {
    const el = $("historyList");
    const filterSel = $("historyMonthFilter");
    if (!el || !filterSel) return;

    const activities   = state.activities || [];
    const activeMonths = getActivityMonths();

    /* Isi dropdown filter jika belum */
    const currentFilter = state.historyFilter || "";
    filterSel.innerHTML =
      `<option value="">Semua Bulan</option>` +
      MOKU_MONTHS.map(m =>
        `<option value="${esc(m)}" ${m === currentFilter ? "selected" : ""}>${esc(m)}</option>`
      ).join("");

    /* Filter activities */
    const filtered = currentFilter
      ? activities.filter(a => (a.bulan || a.hariTanggal || "") === currentFilter)
      : activities;

    if (!filtered.length) {
      el.innerHTML = `<div class="empty-state"><b>Belum ada riwayat</b>${currentFilter ? `Tidak ada kegiatan untuk ${esc(currentFilter)}.` : "Sinkronisasi BOP atau tambah kegiatan manual."}</div>`;
      return;
    }

    /* Group by month */
    const groups = {};
    filtered.forEach(act => {
      const m = act.bulan || act.hariTanggal || "Tanpa Bulan";
      if (!groups[m]) groups[m] = [];
      groups[m].push(act);
    });

    const monthOrder = currentFilter
      ? [currentFilter]
      : MOKU_MONTHS.filter(m => groups[m]);
    if (groups["Tanpa Bulan"]) monthOrder.push("Tanpa Bulan");

    el.innerHTML = monthOrder.map(month => {
      const acts = groups[month] || [];
      const doneCount  = acts.filter(isDone).length;
      const photoCount = acts.reduce((s, a) => s + (resultFor(a).photos||[]).length, 0);
      const totalNom   = acts.reduce((s, a) => s + Number(a.nominal || 0), 0);
      const pct        = acts.length ? Math.round(doneCount / acts.length * 100) : 0;

      return `<div class="riwayat-month-group">
        <div class="riwayat-month-hdr">
          <div>
            <b class="riwayat-month-title">${esc(month)}</b>
            <span class="riwayat-month-meta">${acts.length} kegiatan · ${photoCount} foto · ${money(totalNom)}</span>
          </div>
          <span class="state-chip ${doneCount === acts.length && acts.length ? "done" : ""}">${doneCount}/${acts.length} Lengkap</span>
        </div>
        <div class="riwayat-progress-bar"><div class="riwayat-progress-fill" style="width:${pct}%"></div></div>
        <div class="riwayat-act-list">
          ${acts.map(act => {
            const res       = resultFor(act);
            const photos    = res.photos || [];
            const done      = isDone(act);
            const types     = checklistOf(act);
            const doneT     = types.filter(t => photos.some(p => p.type === t)).length;
            const actPct    = types.length ? Math.round(doneT / types.length * 100) : 0;
            return `<article class="riwayat-act-card">
              <div class="card-row">
                <div style="flex:1;min-width:0">
                  <div class="card-title">${esc(act.nama)}</div>
                  <div class="card-meta">
                    <span>${esc(act.jenis || "Kegiatan BOP")}</span>
                    ${act.volume ? `<span>${esc(act.volume)}</span>` : ""}
                    ${photos.length ? `<span>${photos.length} foto</span>` : ""}
                    ${Number(act.nominal) ? `<span>${money(act.nominal)}</span>` : ""}
                  </div>
                  <div class="mini-progress"><div class="mini-progress-fill" style="width:${actPct}%"></div></div>
                </div>
                <span class="state-chip ${done ? "done" : ""}">${done ? "✓" : `${doneT}/${types.length}`}</span>
              </div>
              <div class="card-actions">
                <button class="btn-ghost btn-sm" data-select-activity="${esc(idOf(act))}" type="button">Dokumentasi</button>
                ${act.agenda ? `<span style="font-size:11px;color:var(--muted);flex:1;padding-left:8px">${esc(act.agenda.slice(0,60))}${act.agenda.length>60?"…":""}</span>` : ""}
              </div>
            </article>`;
          }).join("")}
        </div>
      </div>`;
    }).join("");
  }

  function photoCard(p) {
    const gps = p.location
      ? `±${Math.round(p.location.accuracy||0)}m${p.location.address ? " · " + p.location.address : ""}`
      : "GPS tidak tersedia";
    const src = photoCache.get(p.id) || p.dataUrl || "";
    return `<article class="photo-card" data-open-photo="${esc(p.id)}">
      <img src="${esc(src)}" alt="${esc(p.type)}" loading="lazy">
      <div class="photo-card-body">
        <b>${esc(p.type)}</b>
        <small>${esc(p.capturedAtText||"")}</small>
        <small>${esc(gps)}</small>
      </div>
      <div class="photo-card-actions">
        <button class="photo-del-btn" data-remove-photo="${esc(p.id)}" type="button">Hapus</button>
        <button class="photo-dl-btn" data-dl-photo="${esc(p.id)}" type="button">Unduh</button>
      </div>
    </article>`;
  }

  /* ── Camera ─────────────────────────────────────────────── */
  async function openCamera() {
    const act = currentActivity();
    if (!act) {
      showTab("home");
      showToast("Pilih kegiatan dulu agar foto masuk ke dokumen yang benar.");
      return;
    }
    showTab("camera");
    if (!state.gps || state.gpsStatus !== "locked") lockGps({ silent:true });
    try {
      await startCamera();
    } catch(err) {
      const d = diagnoseEnv();
      let msg = "Kamera belum bisa dibuka. Pastikan izin kamera aktif.";
      if (!d.cameraOk) msg = "Browser ini tidak mendukung kamera langsung. Gunakan Chrome/Edge terbaru.";
      showToast(msg, "error");
    }
  }

  async function startCamera() {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) throw new Error("camera unsupported");
    stopCamera();
    document.body.classList.add("camera-open");
    $("cameraOverlay").hidden = false;
    $("overlayType").textContent = selectedType || "Foto Kegiatan";
    renderClock();
    renderGps();
    renderCamTypeRow();

    const tryGet = async constraints => navigator.mediaDevices.getUserMedia({ video:constraints, audio:false });
    try {
      cameraStream = await tryGet({ facingMode:{ exact:facingMode }, width:{ ideal:1920 }, height:{ ideal:1080 } });
    } catch(_) {
      try {
        cameraStream = await tryGet({ facingMode:{ ideal:facingMode }, width:{ ideal:1600 }, height:{ ideal:1200 } });
      } catch(__) {
        cameraStream = await tryGet(true);
      }
    }
    const video = $("cameraVideo");
    video.srcObject = cameraStream;
    await video.play();
  }

  function renderCamTypeRow() {
    const act = currentActivity();
    if (!act) return;
    const res   = resultFor(act);
    const types = checklistOf(act);
    $("camTypeRow").innerHTML = types.map(t => {
      const done   = (res.photos||[]).some(p => p.type === t);
      const active = t === selectedType;
      return `<button class="cam-type-chip ${active ? "active" : ""}" data-cam-type="${esc(t)}" type="button">
        ${done ? "✓ " : ""}${esc(t.replace("Foto ",""))}
      </button>`;
    }).join("");
  }

  function stopCamera() {
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
    const v = $("cameraVideo");
    if (v) v.srcObject = null;
  }

  function closeCamera() {
    stopCamera();
    $("cameraOverlay").hidden = true;
    document.body.classList.remove("camera-open");
  }

  async function switchCamera() {
    facingMode = (facingMode === "environment") ? "user" : "environment";
    if (cameraStream) await startCamera();
  }

  /* ── Watermark ──────────────────────────────────────────── */
  function drawWatermark(ctx, canvas, act, gps, capturedAt) {
    const W = canvas.width;
    const H = canvas.height;

    const fontSize  = Math.max(20, Math.round(W * 0.022));
    const lh        = Math.round(fontSize * 1.4);
    const pad       = Math.max(16, Math.round(W * 0.016));

    // Build watermark lines
    const line1 = `🏘 RT 005 RW 012 Tegalsari  ·  ${selectedType || checklistOf(act)[0]}`;
    const line2 = `📅 ${fmtFull(capturedAt)}`;
    const line3 = gps
      ? `📍 ${Number(gps.lat).toFixed(6)}°, ${Number(gps.lng).toFixed(6)}° ±${Math.round(gps.accuracy||0)}m`
      : `📍 GPS tidak tersedia`;
    const line4 = (gps && gps.address) ? `   ${gps.address}` : null;

    const lines = [line1, line2, line3];
    if (line4) lines.push(line4);

    const boxH = pad * 2 + lh * lines.length;

    // Semi-transparent dark gradient bar at bottom
    const grad = ctx.createLinearGradient(0, H - boxH - 20, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.3, "rgba(0,0,0,0.72)");
    grad.addColorStop(1, "rgba(0,0,0,0.88)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - boxH - 20, W, boxH + 20);

    // Gold accent line
    ctx.fillStyle = "#d4a843";
    ctx.fillRect(0, H - boxH - 2, W, 3);

    // Text
    ctx.save();
    ctx.font      = `700 ${fontSize}px -apple-system, Arial, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";

    lines.forEach((line, i) => {
      const y = H - boxH + pad + i * lh;
      // Subtle shadow for readability
      ctx.shadowColor   = "rgba(0,0,0,0.8)";
      ctx.shadowBlur    = 4;
      ctx.fillText(line, pad, y, W - pad * 2);
    });

    // Small RT logo text top-right
    ctx.font        = `800 ${Math.max(14, Math.round(W * 0.016))}px -apple-system, Arial, sans-serif`;
    ctx.fillStyle   = "rgba(255,255,255,0.75)";
    ctx.shadowBlur  = 3;
    ctx.textAlign   = "right";
    ctx.textBaseline = "top";
    ctx.fillText("MoKu RT005", W - pad, pad);

    ctx.restore();
  }

  async function capturePhoto() {
    const act = currentActivity();
    if (!act) return;
    const video = $("cameraVideo");
    if (!video || !video.videoWidth) { showToast("Kamera belum siap. Tunggu sebentar.", "warn"); return; }

    // Re-lock GPS silently if stale (>10 minutes old)
    if (state.gps && state.gpsStatus === "locked") {
      const age = (now() - new Date(state.gps.capturedAt)) / 60000;
      if (age > 10) lockGps({ silent:true });
    } else if (!state.gps || state.gpsStatus !== "locked") {
      lockGps({ silent:true });
    }

    const capturedAt   = now();
    const capturedAtText = fmtFull(capturedAt);
    const gps          = state.gps ? { ...state.gps } : null;

    // Canvas capture
    const canvas   = $("cameraCanvas");
    const maxSide  = 1800;
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (Math.max(w, h) > maxSide) {
      const scale = maxSide / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    drawWatermark(ctx, canvas, act, gps, capturedAt);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);

    // Haptic feedback if available
    try { navigator.vibrate && navigator.vibrate(60); } catch(_){}

    savePhoto(dataUrl, capturedAt, capturedAtText, gps);
    closeCamera();
    showTab("camera");
    showToast(`✓ Foto "${selectedType}" berhasil disimpan`);
  }

  function savePhoto(dataUrl, capturedAt, capturedAtText, gps) {
    const act = currentActivity();
    if (!act) return;
    const res = resultFor(act);
    res.note = $("resultNote").value || res.note || "";
    const photoId = `photo-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const photoMeta = {
      id:           photoId,
      type:         selectedType || checklistOf(act)[0],
      fileName:     `moku_rt005_${dateCode(capturedAt)}.jpg`,
      capturedAt:   capturedAt.toISOString(),
      capturedAtText,
      location:     gps ? { ...gps } : null,
      stampEmbedded: true,
      captureMode:  "moku-v2-premium"
    };
    /* ── Simpan ke IndexedDB (tanpa dataUrl di state) ────── */
    photoCache.set(photoId, dataUrl);
    if (typeof MokuDB !== "undefined" && MokuDB.isAvailable()) {
      MokuDB.savePhoto({ ...photoMeta, activityId: idOf(act), dataUrl })
        .catch(() => {});
    }
    /* ── Simpan metadata di state (tanpa dataUrl) ───────── */
    res.photos       = [...(res.photos||[]), photoMeta];
    res.updatedAt    = now().toISOString();
    res.status       = isDone(act) ? "Lengkap" : "Proses";
    state.results[idOf(act)] = res;
    saveState();
    render();
    /* ── Kirim foto ke BOP parent frame (auto-sync) ─────── */
    syncPhotoToBOPParent(act, photoId, dataUrl, photoMeta);
  }

  function removePhoto(photoId) {
    if (!confirm("Hapus foto ini?")) return;
    const act = currentActivity();
    if (!act) return;
    const res = resultFor(act);
    res.photos    = (res.photos||[]).filter(p => p.id !== photoId);
    res.updatedAt = now().toISOString();
    photoCache.delete(photoId);
    if (typeof MokuDB !== "undefined" && MokuDB.isAvailable())
      MokuDB.deletePhoto(photoId).catch(() => {});
    saveState();
    render();
  }

  async function downloadPhoto(photoId) {
    const act = currentActivity();
    if (!act) return;
    const res   = resultFor(act);
    const photo = (res.photos||[]).find(p => p.id === photoId);
    if (!photo) return;
    let dataUrl = photoCache.get(photoId) || photo.dataUrl;
    if (!dataUrl && typeof MokuDB !== "undefined" && MokuDB.isAvailable()) {
      try {
        const idb = await MokuDB.getPhoto(photoId);
        if (idb?.dataUrl) { dataUrl = idb.dataUrl; photoCache.set(photoId, dataUrl); }
      } catch(_) {}
    }
    if (!dataUrl) { showToast("Foto tidak tersedia — coba ambil ulang", "warn"); return; }
    const a = document.createElement("a");
    a.href     = dataUrl;
    a.download = photo.fileName || `moku_${dateCode()}.jpg`;
    a.click();
  }

  /* ── Lightbox ───────────────────────────────────────────── */
  async function openLightbox(photoId) {
    const act = currentActivity();
    if (!act) return;
    const res   = resultFor(act);
    const photo = (res.photos||[]).find(p => p.id === photoId);
    if (!photo) return;
    let dataUrl = photoCache.get(photoId) || photo.dataUrl;
    if (!dataUrl && typeof MokuDB !== "undefined" && MokuDB.isAvailable()) {
      try {
        const idb = await MokuDB.getPhoto(photoId);
        if (idb?.dataUrl) { dataUrl = idb.dataUrl; photoCache.set(photoId, dataUrl); }
      } catch(_) {}
    }
    lightboxPhoto = { ...photo, dataUrl };
    $("lightboxImg").src         = dataUrl || "";
    $("lightboxTitle").textContent = photo.type;
    const gpsText = photo.location
      ? `${coordsToText(photo.location)}${photo.location.address ? " · " + photo.location.address : ""}`
      : "GPS tidak tersedia";
    $("lightboxMeta").textContent = `${photo.capturedAtText || ""} • ${gpsText}`;
    $("lightbox").hidden = false;
  }

  /* ── Export ─────────────────────────────────────────────── */
  function exportResults() {
    const activities = state.activities || [];
    const results    = activities.map(act => {
      const res = resultFor(act);
      return {
        activityId: idOf(act),
        activity:   act,
        note:       res.note || "",
        status:     isDone(act) ? "Lengkap" : "Proses",
        updatedAt:  res.updatedAt || null,
        photos:     res.photos || []
      };
    });
    const payload = {
      app:           "MoKu RT005 v2 Premium",
      version:       "2.0",
      exportedAt:    now().toISOString(),
      exportedAtText: fmtFull(),
      gpsDebug:      state.gpsDebug,
      results,
      activities:    results
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `hasil_moku_rt005_${dateCode()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
    showToast(`✓ Export ${results.length} kegiatan berhasil`);
  }

  function clearData() {
    if (!confirm("Reset semua data MoKu di perangkat ini? Semua foto dan kegiatan akan dihapus permanen.")) return;
    localStorage.removeItem(STORAGE_KEY);
    photoCache.clear();
    if (typeof MokuDB !== "undefined" && MokuDB.isAvailable()) {
      /* Hapus semua foto dari IndexedDB */
      MokuDB.getAllPhotos().then(photos => {
        photos.forEach(p => MokuDB.deletePhoto(p.id).catch(()=>{}));
      }).catch(()=>{});
    }
    state        = defaultState();
    selectedType = null;
    saveState();
    render();
    showTab("home");
    showToast("Data MoKu berhasil direset");
  }

  /* ════════════════════════════════════════════════════════════════
     EXPORT — PDF (cetak) dan CSV (Excel)
  ════════════════════════════════════════════════════════════════ */
  function exportResultsPDF() {
    const activities = state.activities || [];
    if (!activities.length) { showToast("Belum ada data untuk diekspor", "warn"); return; }

    const totFoto = Object.values(state.results||{}).reduce((s,r)=>s+(r.photos||[]).length,0);
    const totDone = activities.filter(isDone).length;

    const actSections = activities.map((act, idx) => {
      const res    = resultFor(act);
      const photos = res.photos || [];
      const done   = isDone(act);
      const types  = checklistOf(act);
      const cells  = types.map(type => {
        const p   = photos.find(ph => ph.type === type);
        const src = p ? (photoCache.get(p.id) || p.dataUrl || null) : null;
        const shortLabel = type.replace("Foto ", "");
        return `<div class="pc">
          <div class="pl">${esc(shortLabel)}</div>
          ${src
            ? `<img src="${src}" class="pi" alt="${esc(type)}">`
            : `<div class="pe">–</div>`}
          ${p ? `<div class="pm">${esc(p.capturedAtText||"")}</div>` : ""}
        </div>`;
      }).join("");

      return `<div class="as">
        <div class="ah">
          <span class="an">${idx+1}</span>
          <div class="ai">
            <div class="aname">${esc(act.nama||"")}</div>
            <div class="ameta">${[act.hariTanggal,act.tempat].filter(Boolean).map(s=>esc(s)).join(" · ")} · ${photos.length} foto</div>
            ${res.note?`<div class="anote">📝 ${esc(res.note)}</div>`:""}
          </div>
          <span class="astat ${done?"done":"proses"}">${done?"✓ Lengkap":"Proses"}</span>
        </div>
        <div class="pg">${cells}</div>
      </div>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>Rekap MoKu RT 005</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a1a;background:#fff}
.hdr{background:#06111f;color:#fff;padding:18px 22px}
.hdr h1{font-size:18px;font-weight:800}
.hdr p{font-size:10.5px;color:rgba(255,255,255,.65);margin-top:3px}
.sum{display:flex;gap:0;border-bottom:1px solid #dde6f0}
.sb{flex:1;text-align:center;padding:12px 6px;border-right:1px solid #e8f0f8}
.sb:last-child{border-right:none}
.sb b{display:block;font-size:20px;font-weight:800;color:#0c4880}
.sb small{font-size:10px;color:#64748b}
.acts{padding:14px 18px}
.as{border:1px solid #dde6f0;border-radius:10px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid}
.ah{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e8f0f8}
.an{background:#0c4880;color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;flex-shrink:0;margin-top:1px}
.ai{flex:1}
.aname{font-size:12.5px;font-weight:700;margin-bottom:2px}
.ameta{font-size:10.5px;color:#64748b}
.anote{font-size:10.5px;color:#475569;font-style:italic;margin-top:2px}
.astat{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap;align-self:center}
.astat.done{background:#dcfce7;color:#16a34a}
.astat.proses{background:#fef9c3;color:#ca8a04}
.pg{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:10px 12px}
.pc{display:flex;flex-direction:column;align-items:center;gap:3px}
.pl{font-size:9px;font-weight:700;color:#64748b;text-align:center;line-height:1.2}
.pi{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0}
.pe{width:100%;aspect-ratio:4/3;background:#f1f5f9;border-radius:6px;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:16px}
.pm{font-size:8.5px;color:#94a3b8;text-align:center;line-height:1.2}
.ftr{text-align:center;padding:12px;color:#94a3b8;font-size:10px;border-top:1px solid #e2e8f0}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.as{page-break-inside:avoid}}
</style></head><body>
<div class="hdr">
  <h1>📸 Rekap Dokumentasi Kegiatan — MoKu RT 005 RW 012 Tegalsari</h1>
  <p>Dicetak: ${new Date().toLocaleString("id-ID")} · Candisari, Kota Semarang</p>
</div>
<div class="sum">
  <div class="sb"><b>${activities.length}</b><small>Kegiatan</small></div>
  <div class="sb"><b>${totFoto}</b><small>Total Foto</small></div>
  <div class="sb"><b>${totDone}</b><small>Lengkap</small></div>
  <div class="sb"><b>${activities.length-totDone}</b><small>Proses</small></div>
</div>
<div class="acts">${actSections}</div>
<div class="ftr">MoKu Mobile · BOP RT 005 RW 012 Tegalsari, Candisari, Kota Semarang</div>
<script>setTimeout(()=>window.print(),600);</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) { showToast("Popup diblokir browser. Izinkan popup untuk ekspor PDF.", "warn"); return; }
    w.document.write(html);
    w.document.close();
  }

  function exportResultsCSV() {
    const activities = state.activities || [];
    if (!activities.length) { showToast("Belum ada data untuk diekspor", "warn"); return; }

    const q = v => `"${String(v||"").replace(/"/g,'""')}"`;
    const header = ["No","Kegiatan","Bulan","Jenis","Status","Total Foto","Sebelum","Proses","Sesudah","Nota/Kuitansi","Serah Terima","Nominal","Catatan"];
    const rows = activities.map((act, i) => {
      const res    = resultFor(act);
      const photos = res.photos || [];
      const ct     = type => photos.filter(p => p.type === type).length;
      return [
        i+1, act.nama||"", act.bulan||act.hariTanggal||"", act.jenis||"",
        res.status||(isDone(act)?"Lengkap":"Proses"),
        photos.length,
        ct("Foto Sebelum"), ct("Foto Proses"), ct("Foto Sesudah"),
        ct("Foto Nota/Kuitansi"), ct("Foto Serah Terima"),
        Number(act.nominal||0),
        res.note||""
      ].map(q).join(",");
    });

    const csv = "\ufeff" + [header.map(q).join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `rekap_moku_rt005_${dateCode()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    showToast("✓ File Excel (.csv) berhasil diunduh");
  }

  /* ════════════════════════════════════════════════════════════════
     BOP PARENT SYNC — Kirim foto/hasil ke iframe parent (BOP App)
  ════════════════════════════════════════════════════════════════ */
  function syncPhotoToBOPParent(act, photoId, dataUrl, photoMeta) {
    if (window.parent === window) return; /* bukan di dalam iframe */
    try {
      window.parent.postMessage({
        type:     "moku-photo",
        activity: {
          id:          idOf(act),
          nama:        act.nama,
          jenis:       act.jenis,
          hariTanggal: act.hariTanggal,
          tempat:      act.tempat,
          nominal:     act.nominal,
          bulan:       act.bulan,
          kategori:    act.kategori,
        },
        photo: { ...photoMeta, dataUrl }
      }, "*");
    } catch(_e) {}
  }

  async function fullSyncToBOPParent() {
    if (window.parent === window) return;
    try {
      const results = [];
      for (const act of (state.activities || [])) {
        const id  = idOf(act);
        const res = state.results[id] || {};
        const photos = (res.photos || []).map(p => ({
          ...p,
          dataUrl: photoCache.get(p.id) || p.dataUrl || null
        })).filter(p => p.dataUrl);
        if (photos.length) results.push({ ...act, photos });
      }
      if (!results.length) return;
      window.parent.postMessage({ type: "moku-full-sync", results }, "*");
    } catch(_e) {}
  }

  /* ════════════════════════════════════════════════════════════════
     INDEXEDDB — Muat cache foto dari IndexedDB saat boot
  ════════════════════════════════════════════════════════════════ */
  async function loadPhotoCache() {
    if (typeof MokuDB === "undefined" || !MokuDB.isAvailable()) return;
    try {
      /* Migrasi foto lama yang masih punya dataUrl di state */
      let migrated = false;
      for (const [actId, res] of Object.entries(state.results || {})) {
        for (const photo of (res.photos || [])) {
          if (photo.dataUrl) {
            await MokuDB.savePhoto({ ...photo, activityId: actId }).catch(() => {});
            photoCache.set(photo.id, photo.dataUrl);
            delete photo.dataUrl; /* hemat localStorage */
            migrated = true;
          }
        }
      }
      if (migrated) {
        saveState();
        console.log("[MokuDB] Migrasi foto lama ke IndexedDB selesai");
      }
      /* Muat semua foto dari IDB ke cache */
      const photos = await MokuDB.getAllPhotos();
      photos.forEach(p => { if (p.dataUrl) photoCache.set(p.id, p.dataUrl); });
      if (photos.length || migrated) render(); /* refresh tampilan */
      /* Auto-kirim semua hasil ke BOP parent setelah cache siap */
      if (photos.length) setTimeout(() => fullSyncToBOPParent(), 800);
    } catch(e) {
      console.warn("[MokuDB] Gagal muat cache foto:", e);
    }
  }

  /* ════════════════════════════════════════════════════════════════
     BOP SYNC — Sinkronisasi otomatis kegiatan RAP dari BOP utama
  ════════════════════════════════════════════════════════════════ */
  function getBopData() {
    try {
      const raw = localStorage.getItem("bop_rt005_data_v1_25");
      return raw ? JSON.parse(raw) : null;
    } catch(_) { return null; }
  }

  function rapToActivity(r, idx) {
    const bulan  = r.bulan || "";
    const uraian = r.uraian || `Kegiatan RAP ${idx + 1}`;
    const slug   = `bop-rap-${String(uraian).replace(/\s+/g,"_").slice(0,25)}-${String(bulan).replace(/[\s/]/g,"")}`;
    const agendaParts = [r.subKategori, r.keterangan, r.tipe ? `Tipe: ${r.tipe}` : ""].filter(Boolean);
    return {
      id:          slug,
      jenis:       r.kategori   || "Kegiatan BOP",
      nama:        uraian,
      hariTanggal: bulan,
      bulan:       bulan,
      waktu:       "",
      tempat:      "Wilayah RT 005 RW 012 Tegalsari",
      agenda:      agendaParts.join(" · "),
      nominal:     Number(r.jumlah || 0),
      volume:      r.volume || "1 Paket",
      tipe:        r.tipe || "",
      checklist:   DEFAULT_TYPES,
      source:      "BOP Sync",
      syncedAt:    new Date().toISOString()
    };
  }

  function syncFromBOP(opts = {}) {
    const bop = getBopData();
    if (!bop) {
      if (!opts.silent) showToast("Data BOP tidak ditemukan di perangkat ini", "warn");
      return 0;
    }
    const rawRap = bop.pengajuan?.rap || [];
    if (!rawRap.length) {
      if (!opts.silent) showToast("Belum ada item RAP di BOP", "warn");
      return 0;
    }

    /* Normalize format RAP (array lama → object baru) */
    const normRap = rawRap.map(r => Array.isArray(r)
      ? { uraian:r[0]||"", volume:r[1]||"1 Paket", jumlah:Number(r[2]||0), keterangan:r[3]||"", kategori:"Operasional", subKategori:"", bulan:"", tipe:"" }
      : r
    );

    /* Expand RAP_MONTH_ALL & range bulan → satu entry per bulan */
    const expanded = [];
    normRap.forEach((r, origIdx) => {
      const bulan = r.bulan || "";
      const isAll = bulan === MOKU_MONTH_ALL || bulan === "" ||
                    (r.bulanMulai && r.bulanSelesai); /* format range */
      if (isAll) {
        /* Cek range bulan (bulanMulai - bulanSelesai) */
        let months = MOKU_MONTHS;
        if (r.bulanMulai && r.bulanSelesai) {
          const iStart = MOKU_MONTHS.indexOf(r.bulanMulai);
          const iEnd   = MOKU_MONTHS.indexOf(r.bulanSelesai);
          if (iStart >= 0 && iEnd >= iStart)
            months = MOKU_MONTHS.slice(iStart, iEnd + 1);
        }
        const nominalPerBulan = Math.round(Number(r.jumlah || 0) / months.length);
        months.forEach(m => {
          expanded.push({ ...r, bulan: m, jumlah: nominalPerBulan, _origIdx: origIdx });
        });
      } else {
        expanded.push({ ...r, _origIdx: origIdx });
      }
    });

    const existingIds = new Set((state.activities||[]).map(a => a.id));
    const mapped      = expanded.map((r, i) => rapToActivity(r, i));
    const newActs     = mapped.filter(a => !existingIds.has(a.id));
    const updActs     = mapped.filter(a =>  existingIds.has(a.id));

    let changed = 0;
    if (newActs.length) {
      state.activities = [...(state.activities||[]), ...newActs];
      changed += newActs.length;
    }
    if (updActs.length) {
      state.activities = state.activities.map(a => {
        const upd = updActs.find(u => u.id === a.id);
        return (upd && a.source === "BOP Sync") ? { ...a, ...upd } : a;
      });
    }

    if (changed > 0 || updActs.length > 0) {
      if (!state.currentId && state.activities.length)
        state.currentId = state.activities[0].id;
      saveState();
      render();
      if (typeof MokuDB !== "undefined" && MokuDB.isAvailable())
        MokuDB.saveBopSnapshot(bop).catch(() => {});
      cloudSyncResults();
    }

    if (!opts.silent) {
      if (changed > 0)
        showToast(`✓ Sinkron BOP: ${changed} kegiatan baru ditambahkan`);
      else
        showToast(`✓ Semua ${mapped.length} kegiatan BOP sudah tersinkron`);
    }
    return changed;
  }

  function checkBopSync() {
    const bop = getBopData();
    if (!bop) return;
    const rawRap = bop.pengajuan?.rap || [];
    if (!rawRap.length) return;
    const normRap = rawRap.map(r => Array.isArray(r)
      ? { uraian:r[0]||"", volume:r[1]||"1 Paket", jumlah:Number(r[2]||0), keterangan:r[3]||"", kategori:"Operasional", subKategori:"", bulan:"", tipe:"" }
      : r
    );
    /* Expand RAP_MONTH_ALL untuk hitung estimasi jumlah kegiatan baru */
    const expanded = [];
    normRap.forEach((r, origIdx) => {
      const bulan = r.bulan || "";
      const isAll = bulan === MOKU_MONTH_ALL || bulan === "" || (r.bulanMulai && r.bulanSelesai);
      if (isAll) {
        let months = MOKU_MONTHS;
        if (r.bulanMulai && r.bulanSelesai) {
          const iS = MOKU_MONTHS.indexOf(r.bulanMulai), iE = MOKU_MONTHS.indexOf(r.bulanSelesai);
          if (iS >= 0 && iE >= iS) months = MOKU_MONTHS.slice(iS, iE + 1);
        }
        months.forEach(m => expanded.push({ ...r, bulan: m, _origIdx: origIdx }));
      } else {
        expanded.push({ ...r, _origIdx: origIdx });
      }
    });
    const existingIds = new Set((state.activities||[]).map(a => a.id));
    const mapped = expanded.map((r, i) => rapToActivity(r, i));
    const newCount = mapped.filter(a => !existingIds.has(a.id)).length;
    if (newCount > 0) {
      ["bopSyncBtn","riwayatSyncBtn"].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.setAttribute("data-badge", String(newCount));
          btn.title = `${newCount} kegiatan BOP baru — klik untuk sinkronisasi`;
        }
      });
    }
  }

  /* ── Cloud sync hasil ke PostgreSQL (background, best-effort) ─ */
  function cloudSyncResults() {
    try {
      const results = (state.activities||[]).map(act => {
        const res = state.results[idOf(act)] || {};
        return {
          activityId:   idOf(act),
          activityName: act.nama,
          status:       isDone(act) ? "Lengkap" : "Proses",
          photoCount:   (res.photos||[]).length,
          note:         res.note || "",
          updatedAt:    res.updatedAt || null
        };
      });
      if (!results.length) return;
      fetch("/api/db/results-sync", {
        method:  "POST",
        headers: { "Content-Type":"application/json" },
        body:    JSON.stringify({ results })
      }).catch(() => {}); /* best-effort */
    } catch(_) {}
  }

  /* ── GPS Sheet ──────────────────────────────────────────── */
  function showGpsSheet() {
    refreshPermDebug().then(() => {
      $("gpsSheetMessage").textContent = state.gpsMessage || gpsBlockedMsg();
      const d = state.gpsDebug || diagnoseEnv();
      $("gpsDebugList").innerHTML = [
        ["GPS aman", d.gpsSafe ? "✓ Ya" : "✗ Tidak"],
        ["Protocol", d.protocol || "-"],
        ["Host",     d.host     || "-"],
        ["File lokal", d.isFileProt ? "Ya – GPS rawan timeout" : "Tidak"],
        ["HTTP/LAN",   d.isHttpLan  ? "Ya – GPS diblokir" : "Tidak"],
        ["Izin lokasi", d.permission || "belum dicek"],
        ["Dukungan GPS", d.gpsOk ? "✓ Ada" : "✗ Tidak ada"],
        ["Dukungan kamera", d.cameraOk ? "✓ Ada" : "✗ Tidak ada"],
        ["Koordinat saat ini", state.gps ? coordsToText(state.gps) : "Belum terkunci"],
        ["Alamat", state.gps?.address || "Belum terdeteksi"]
      ].map(([k,v]) => `<div class="debug-item"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join("");
      $("gpsSheet").hidden = false;
    });
  }

  /* ── Server Status Ping ─────────────────────────────────── */
  async function pingServerStatus() {
    const el = $("resultSyncInfo");
    if (!el) return;
    try {
      const r = await fetch("/api/bop/status", { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        el.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#22c55e"/></svg> Server terhubung · Sinkron aktif`;
        el.style.color = "#22c55e";
      } else {
        el.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#f59e0b"/></svg> Mode lokal · Server tidak merespons`;
        el.style.color = "#f59e0b";
      }
    } catch (_) {
      el.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#f59e0b"/></svg> Mode lokal · Tanpa koneksi server`;
      el.style.color = "#f59e0b";
    }
  }

  /* ── Toast ──────────────────────────────────────────────── */
  let toastTimer = null;
  function showToast(msg, type = "info") {
    let el = document.getElementById("mokuToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "mokuToast";
      el.style.cssText = "position:fixed;bottom:calc(90px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);max-width:90vw;background:#0a1d31;color:#fff;padding:11px 18px;border-radius:16px;font-size:13.5px;font-weight:700;z-index:500;box-shadow:0 12px 32px rgba(0,0,0,.3);transition:opacity .3s;pointer-events:none;text-align:center;";
      document.body.appendChild(el);
    }
    if (type === "error") el.style.background = "#c0392b";
    else if (type === "warn") el.style.background = "#c47a00";
    else el.style.background = "#0a1d31";
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = "0"; }, 3000);
  }

  /* ── Events ─────────────────────────────────────────────── */
  function initEvents() {
    // Global click delegation
    document.addEventListener("click", e => {
      // Tab navigation
      const tab = e.target.closest("[data-tab]");
      if (tab) { showTab(tab.dataset.tab); return; }

      // Select activity
      const sel = e.target.closest("[data-select-activity]");
      if (sel) { selectActivity(sel.dataset.selectActivity); return; }

      // Foto langsung — pilih kegiatan + buka kamera langsung
      const foto = e.target.closest("[data-foto-langsung]");
      if (foto) {
        selectActivity(foto.dataset.fotoLangsung);
        setTimeout(() => openCamera(), 120); /* beri waktu render selesai */
        return;
      }

      // Select photo type (camera tab chips)
      const type = e.target.closest("[data-photo-type]");
      if (type) { selectedType = type.dataset.photoType; renderCameraTab(); return; }

      // Camera overlay type chips
      const camType = e.target.closest("[data-cam-type]");
      if (camType) {
        selectedType = camType.dataset.camType;
        $("overlayType").textContent = selectedType;
        renderCamTypeRow();
        return;
      }

      // Remove photo
      const del = e.target.closest("[data-remove-photo]");
      if (del) { e.stopPropagation(); removePhoto(del.dataset.removePhoto); return; }

      // Download photo
      const dl = e.target.closest("[data-dl-photo]");
      if (dl) { e.stopPropagation(); downloadPhoto(dl.dataset.dlPhoto); return; }

      // Open lightbox
      const open = e.target.closest("[data-open-photo]");
      if (open && !e.target.closest("button")) { openLightbox(open.dataset.openPhoto); return; }
    });

    $("floatingCameraBtn").addEventListener("click", openCamera);
    $("cameraMainBtn").addEventListener("click", openCamera);
    $("captureBtn").addEventListener("click", capturePhoto);
    $("closeCameraBtn").addEventListener("click", closeCamera);
    $("switchCameraBtn").addEventListener("click", switchCamera);

    $("lockGpsBtn").addEventListener("click", () => lockGps({ silent:false }));
    $("gpsStatusBtn").addEventListener("click", showGpsSheet);
    $("retryGpsBtn").addEventListener("click", () => { $("gpsSheet").hidden = true; lockGps({ silent:false }); });
    $("closeGpsSheetBtn").addEventListener("click", () => $("gpsSheet").hidden = true);
    $("gpsSheet").addEventListener("click", e => { if (e.target === $("gpsSheet")) $("gpsSheet").hidden = true; });

    // Activity modal (tombol manual sudah dihapus dari UI, jaga jika DOM masih ada)
    const addManualEl = $("addManualBtn");
    if (addManualEl) addManualEl.addEventListener("click", openAddModal);
    $("saveActivityBtn").addEventListener("click", saveNewActivity);
    $("cancelActivityBtn").addEventListener("click", () => $("activityModal").hidden = true);
    $("activityModal").addEventListener("click", e => { if (e.target === $("activityModal")) $("activityModal").hidden = true; });

    // Enter to save modal
    document.addEventListener("keydown", e => {
      if (e.key === "Enter" && !$("activityModal").hidden) { saveNewActivity(); return; }
      if (e.key === "Escape") {
        if (!$("activityModal").hidden) { $("activityModal").hidden = true; return; }
        if (!$("gpsSheet").hidden)      { $("gpsSheet").hidden = true; return; }
        if (!$("lightbox").hidden)      { $("lightbox").hidden = true; return; }
        if (!$("cameraOverlay").hidden) { closeCamera(); return; }
      }
    });

    // Export PDF & CSV
    const exportPdfEl = $("exportPdfBtn");
    if (exportPdfEl) exportPdfEl.addEventListener("click", exportResultsPDF);
    const exportCsvEl = $("exportCsvBtn");
    if (exportCsvEl) exportCsvEl.addEventListener("click", exportResultsCSV);

    // Export & clear (tombol hidden — jaga jika elemen ada di DOM)
    const exportResultEl = $("exportResultBtn");
    if (exportResultEl) exportResultEl.addEventListener("click", exportResults);
    const clearBtnEl = $("clearBtn");
    if (clearBtnEl) clearBtnEl.addEventListener("click", clearData);

    // Note autosave
    $("resultNote").addEventListener("input", () => {
      const act = currentActivity();
      if (!act) return;
      const res = resultFor(act);
      res.note = $("resultNote").value;
      res.updatedAt = now().toISOString();
      saveState();
    });

    // Daftar Kegiatan month filter
    const actMonthFilter = $("activityMonthFilter");
    if (actMonthFilter) {
      actMonthFilter.addEventListener("change", () => {
        state.activityMonthFilter = actMonthFilter.value;
        saveState();
        renderActivityList();
      });
    }

    // History month filter
    const historyFilter = $("historyMonthFilter");
    if (historyFilter) {
      historyFilter.addEventListener("change", () => {
        state.historyFilter = historyFilter.value;
        saveState();
        renderHistory();
      });
    }

    // Riwayat sync button
    const riwayatSyncBtn = $("riwayatSyncBtn");
    if (riwayatSyncBtn) {
      riwayatSyncBtn.addEventListener("click", () => {
        riwayatSyncBtn.removeAttribute("data-badge");
        syncFromBOP();
        showToast("✓ Data kegiatan RAP diperbarui");
      });
    }

    // BOP Sync button
    const bopSyncBtn = $("bopSyncBtn");
    if (bopSyncBtn) {
      bopSyncBtn.addEventListener("click", () => {
        bopSyncBtn.removeAttribute("data-badge");
        syncFromBOP();
      });
    }

    // Import file (hidden input — null guard wajib karena mungkin belum ada di DOM)
    const importFileEl = $("importActivityFile");
    if (importFileEl) {
      importFileEl.addEventListener("change", e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fr = new FileReader();
        fr.onload = () => {
          try { importActivitiesPayload(JSON.parse(fr.result)); }
          catch(_) { showToast("File tidak valid. Pastikan dari Export Kegiatan BOP.", "error"); }
        };
        fr.readAsText(file);
        e.target.value = "";
      });
    }
    // Label import → trigger file input
    const importLabelEl = $("importActivityLabel");
    if (importLabelEl && importFileEl) {
      importLabelEl.addEventListener("click", () => importFileEl.click());
    }

    // Lightbox
    $("closeLightbox").addEventListener("click", () => $("lightbox").hidden = true);
    $("lightbox").addEventListener("click", e => { if (e.target === $("lightbox")) $("lightbox").hidden = true; });
    $("lightboxDownload").addEventListener("click", () => {
      if (!lightboxPhoto) return;
      const a = document.createElement("a");
      a.href = lightboxPhoto.dataUrl;
      a.download = lightboxPhoto.fileName || `moku_${dateCode()}.jpg`;
      a.click();
    });

    // Close camera and stop GPS on tab hide
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        closeCamera();
        if (gpsWatchId !== null) {
          try { navigator.geolocation.clearWatch(gpsWatchId); } catch(_){}
          gpsWatchId = null;
        }
      }
    });

    // PWA install
    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault();
      installPrompt = e;
      $("installBtn").hidden = false;
    });
    $("installBtn").addEventListener("click", async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      installPrompt = null;
      $("installBtn").hidden = true;
    });
  }

  /* ── Boot ───────────────────────────────────────────────── */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  }

  initEvents();
  startClock();
  refreshPermDebug();
  render();

  // Auto-lock GPS silently on boot
  setTimeout(() => {
    if (!state.gps || state.gpsStatus !== "locked") {
      lockGps({ silent:true });
    }
  }, 1200);

  /* ── IndexedDB: muat cache foto (async, tidak block UI) ── */
  loadPhotoCache();

  /* ── BOP Sync: auto-sinkron kegiatan saat boot ──────────
     Coba dari localStorage dulu; jika kosong, ambil dari server
     agar data BOP selalu tersedia walau localStorage baru/kosong. */
  setTimeout(async () => {
    let added = syncFromBOP({ silent: true });

    /* Fallback: ambil dari server jika localStorage kosong */
    if (added === 0 && (state.activities || []).length === 0) {
      try {
        const r = await fetch("/api/bop/data", { signal: AbortSignal.timeout(6000) });
        if (r.ok) {
          const j = await r.json();
          if (j.ok && j.data) {
            try { localStorage.setItem("bop_rt005_data_v1_25", JSON.stringify(j.data)); } catch (_) {}
            added = syncFromBOP({ silent: true });
          }
        }
      } catch (_) {}
    }

    if (added > 0)
      showToast(`📋 ${added} kegiatan BOP disinkronkan`, "info");
    else
      checkBopSync(); /* cek badge jika ada yang belum disinkron */
  }, 600);

  /* ── Status server: ping setelah boot selesai ─────────── */
  setTimeout(() => pingServerStatus(), 2500);

})();
