/* =========================================================
   MoKu Mobile v2 – app.js
   RT 005 RW 012 Tegalsari, Candisari, Semarang
   GPS Presisi · Reverse Geocoding · Premium Design
   ========================================================= */
(() => {
  "use strict";

  const STORAGE_KEY = "moku_rt005_v2_premium";
  const DEFAULT_TYPES = ["Foto Sebelum", "Foto Proses", "Foto Sesudah", "Foto Nota/Kuitansi", "Foto Serah Terima"];
  const GPS_MAX_MS   = 120_000;
  const GPS_GOOD_ACC = 30; // metres — threshold for "good enough"

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

    // Cancel any existing watch
    if (gpsWatchId !== null) { try { navigator.geolocation.clearWatch(gpsWatchId); } catch(_){} gpsWatchId = null; }
    if (gpsTimer)            { clearTimeout(gpsTimer); gpsTimer = null; }

    setGpsStatus("searching", "Mengunci GPS presisi tinggi... mohon tunggu.", state.gps);

    return new Promise(resolve => {
      let settled   = false;
      let best      = state.gps || null;
      const started = Date.now();

      const elapsed = () => Math.round((Date.now() - started) / 1000);

      const finish = (gps, status = "locked", message) => {
        if (settled) return;
        settled = true;
        if (gpsWatchId !== null) { try { navigator.geolocation.clearWatch(gpsWatchId); } catch(_){} gpsWatchId = null; }
        if (gpsTimer) { clearTimeout(gpsTimer); gpsTimer = null; }
        if (gps) {
          const msg = message || `GPS terkunci ±${Math.round(gps.accuracy||0)}m`;
          setGpsStatus("locked", msg, gps);
          // Attempt reverse geocode silently, update if success
          reverseGeocode(gps.lat, gps.lng).then(addr => {
            if (addr && state.gps) {
              state.gps.address = addr;
              setGpsStatus("locked", `GPS terkunci • ${addr} ±${Math.round(state.gps.accuracy||0)}m`, state.gps);
            }
          });
          resolve(gps);
        } else {
          setGpsStatus(status, message || gpsBlockedMsg(), null);
          if (!silent) showGpsSheet();
          resolve(null);
        }
      };

      const keepBest = (pos) => {
        const g = {
          lat:           pos.coords.latitude,
          lng:           pos.coords.longitude,
          accuracy:      pos.coords.accuracy,
          altitude:      pos.coords.altitude,
          heading:       pos.coords.heading,
          speed:         pos.coords.speed,
          capturedAt:    now().toISOString(),
          capturedAtText: fmtFull(),
          provider:      "geolocation-v2"
        };
        if (!best || Number(g.accuracy||99999) < Number(best.accuracy||99999)) best = g;
        state.gps = best;
        saveState();
        return best;
      };

      const onSuccess = pos => {
        const got = keepBest(pos);
        const acc = Number(got.accuracy||99999);
        const msg = `GPS masuk ±${Math.round(acc)}m • ${elapsed()}s`;
        setGpsStatus("searching", msg, got);
        if (acc <= GPS_GOOD_ACC || elapsed() >= 30) {
          finish(got);
        }
      };

      const onError = err => {
        // Try low-accuracy network position as fallback
        try {
          navigator.geolocation.getCurrentPosition(
            pos => { const got = keepBest(pos); setGpsStatus("searching", `Lokasi jaringan ±${Math.round(got.accuracy||0)}m • menunggu GPS...`, got); },
            () => {},
            { enableHighAccuracy:false, timeout:12000, maximumAge:600000 }
          );
        } catch(_){}

        if (best) {
          setGpsStatus("searching", `Memakai lokasi sementara ±${Math.round(best.accuracy||0)}m • menunggu sinyal lebih presisi...`, best);
          return;
        }
        let msg = "Sinyal GPS belum terdeteksi. Aktifkan Akurasi Tinggi dan coba di luar ruangan.";
        if (err?.code === 1) { msg = "Izin lokasi ditolak. Aktifkan di Pengaturan Situs."; }
        if (err?.code === 3) { msg = "GPS timeout. Masih mencoba..."; }
        setGpsStatus("searching", msg, null);
      };

      try {
        // Start high-accuracy watch
        gpsWatchId = navigator.geolocation.watchPosition(onSuccess, onError, {
          enableHighAccuracy: true,
          timeout: GPS_MAX_MS,
          maximumAge: 0
        });

        // Periodic progress update
        const tick = setInterval(() => {
          if (settled) { clearInterval(tick); return; }
          if (best) setGpsStatus("searching", `Mengunci GPS... ${elapsed()}s • lokasi sementara ±${Math.round(best.accuracy||0)}m`, best);
          else      setGpsStatus("searching", `Mengunci GPS... ${elapsed()}s dari 120s. Layar harus tetap aktif.`, null);
        }, 8000);

        // Absolute timeout
        gpsTimer = setTimeout(() => {
          clearInterval(tick);
          if (best) finish(best, "locked", `GPS terkunci (${elapsed()}s) ±${Math.round(best.accuracy||0)}m`);
          else      finish(null, "failed", "GPS belum terkunci dalam 120 detik. Buka MoKu via HTTPS untuk GPS stabil.");
        }, GPS_MAX_MS);

      } catch(err) {
        onError(err);
        setTimeout(() => {
          if (best) finish(best);
          else      finish(null, "failed", "Browser gagal menjalankan GPS. Gunakan Chrome terbaru.");
        }, 8000);
      }
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
    const activities = state.activities || [];
    if (!activities.length) {
      el.innerHTML = `<div class="empty-state"><b>Belum ada kegiatan</b>Tekan Import atau Tambah Manual untuk mulai.</div>`;
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
      return `<article class="activity-card ${active ? "is-active" : ""}">
        <div class="card-row">
          <div style="flex:1;min-width:0">
            <div class="card-title">${esc(act.nama)}</div>
            <div class="card-meta">
              <span>${esc(act.jenis||"Kegiatan BOP")}${act.hariTanggal ? " · " + esc(act.hariTanggal) : ""}</span>
              ${act.tempat ? `<span>${esc(act.tempat)}</span>` : ""}
              ${Number(act.nominal||0) ? `<span>${money(act.nominal)}</span>` : ""}
            </div>
            <div class="mini-progress"><div class="mini-progress-fill" style="width:${pct}%"></div></div>
          </div>
          <span class="state-chip ${done ? "done" : ""}">${done ? "✓ Lengkap" : `${doneCount}/${types.length}`}</span>
        </div>
        <div class="card-actions">
          <button class="${active ? "btn-primary btn-sm" : "btn-ghost btn-sm"}" data-select-activity="${esc(id)}" type="button">
            ${active ? "Lanjut Kamera" : "Pilih"}
          </button>
        </div>
      </article>`;
    }).join("");
  }

  function renderCameraTab() {
    const act = currentActivity();
    $("cameraTitle").textContent = act ? act.nama : "Pilih kegiatan dulu";
    $("cameraMeta").textContent  = act
      ? ([act.hariTanggal, act.waktu, act.tempat].filter(Boolean).join(" · ") || "Dokumentasi kegiatan")
      : "Foto akan otomatis diberi watermark waktu dan GPS.";

    const chips = $("photoTypeChips");
    if (!act) {
      chips.innerHTML = `<div style="color:var(--muted);font-size:13px">Pilih kegiatan dulu.</div>`;
      $("recentPhotos").innerHTML = `<div class="empty-state"><b>Belum ada foto</b>Pilih kegiatan dan tekan kamera.</div>`;
      $("photoCountBadge").hidden = true;
      $("resultNote").value = "";
      return;
    }

    const res   = resultFor(act);
    const types = checklistOf(act);
    if (!types.includes(selectedType)) selectedType = types[0];

    chips.innerHTML = types.map(type => {
      const hasDone = (res.photos||[]).some(p => p.type === type);
      const active  = type === selectedType;
      return `<button class="type-chip ${active ? "active" : ""} ${hasDone && !active ? "done" : ""}" data-photo-type="${esc(type)}" type="button">
        ${hasDone ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ""}
        ${esc(type.replace("Foto ",""))}
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
      const done   = isDone(act);
      return `<article class="result-card">
        <div class="card-row">
          <div style="flex:1;min-width:0">
            <div class="card-title">${esc(act.nama)}</div>
            <div class="card-meta">
              <span>${photos.length} foto tersimpan</span>
              <span>${done ? "✓ Checklist lengkap" : "Checklist belum lengkap"}</span>
            </div>
          </div>
          <span class="state-chip ${done ? "done" : ""}">${done ? "✓" : "Proses"}</span>
        </div>
        <div class="card-actions">
          <button class="btn-ghost btn-sm" data-select-activity="${esc(idOf(act))}" type="button">Buka Kamera</button>
        </div>
      </article>`;
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
    const slug = `bop-rap-${String(r.uraian||"").replace(/\s+/g,"_").slice(0,30)}-${String(r.bulan||"").replace(/\s/g,"")}`;
    return {
      id:          slug,
      jenis:       r.kategori || "Kegiatan BOP",
      nama:        r.uraian   || `Kegiatan RAP ${idx + 1}`,
      hariTanggal: r.bulan    || "",
      waktu:       "",
      tempat:      "Wilayah RT 005 RW 012 Tegalsari",
      agenda:      [r.subKategori, r.keterangan].filter(Boolean).join(" · "),
      nominal:     Number(r.jumlah || 0),
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
    /* Normalize format RAP (bisa array lama atau object baru) */
    const rawRap = bop.pengajuan?.rap || [];
    if (!rawRap.length) {
      if (!opts.silent) showToast("Belum ada item RAP di BOP", "warn");
      return 0;
    }
    const normRap = rawRap.map(r => Array.isArray(r)
      ? { uraian:r[0]||"", volume:r[1]||"1 Paket", jumlah:Number(r[2]||0), keterangan:r[3]||"", kategori:"Operasional", subKategori:"", bulan:"", tipe:"" }
      : r
    );

    const existingIds = new Set((state.activities||[]).map(a => a.id));
    const mapped      = normRap.map((r, i) => rapToActivity(r, i));
    const newActs     = mapped.filter(a => !existingIds.has(a.id));
    const updActs     = mapped.filter(a =>  existingIds.has(a.id));

    let changed = 0;
    if (newActs.length) {
      state.activities = [...(state.activities||[]), ...newActs];
      changed += newActs.length;
    }
    /* Update kegiatan BOP yang sudah ada (jika data RAP berubah) */
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
      /* Simpan snapshot BOP ke IndexedDB */
      if (typeof MokuDB !== "undefined" && MokuDB.isAvailable())
        MokuDB.saveBopSnapshot(bop).catch(() => {});
      /* Sync metadata ke cloud (background) */
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
    const normRap = rawRap.map((r, i) => rapToActivity(
      Array.isArray(r) ? { uraian:r[0]||"", bulan:r[3]||"", kategori:"Operasional" } : r, i
    ));
    const existingIds = new Set((state.activities||[]).map(a => a.id));
    const newCount = normRap.filter(a => !existingIds.has(a.id)).length;
    if (newCount > 0) {
      const btn = document.getElementById("bopSyncBtn");
      if (btn) {
        btn.setAttribute("data-badge", String(newCount));
        btn.title = `${newCount} kegiatan BOP baru — klik untuk sinkronisasi`;
      }
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

    // Activity modal
    $("addManualBtn").addEventListener("click", openAddModal);
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

    // Export & clear
    $("exportResultBtn").addEventListener("click", exportResults);
    $("clearBtn").addEventListener("click", clearData);

    // Note autosave
    $("resultNote").addEventListener("input", () => {
      const act = currentActivity();
      if (!act) return;
      const res = resultFor(act);
      res.note = $("resultNote").value;
      res.updatedAt = now().toISOString();
      saveState();
    });

    // BOP Sync button
    const bopSyncBtn = $("bopSyncBtn");
    if (bopSyncBtn) {
      bopSyncBtn.addEventListener("click", () => {
        bopSyncBtn.removeAttribute("data-badge");
        syncFromBOP();
      });
    }

    // Import file
    $("importActivityFile").addEventListener("change", e => {
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

    // Close camera on tab change / visibility
    document.addEventListener("visibilitychange", () => { if (document.hidden) closeCamera(); });

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
     Pertama cek apakah ada kegiatan baru (tidak bikin notif),
     lalu sinkronkan secara otomatis tanpa gangguan.          */
  setTimeout(() => {
    const added = syncFromBOP({ silent: true });
    if (added > 0)
      showToast(`📋 ${added} kegiatan BOP otomatis disinkronkan`, "info");
    else
      checkBopSync(); /* cek badge jika ada yg belum disinkron */
  }, 600);

})();
