
/* PATCH 012 - API bridge Vercel frontend -> Railway backend (v43 auto-discovery) */
(function bopApiBridgeV42(){
  if (window.__bopApiBridgeV42) return;
  window.__bopApiBridgeV42 = true;

  const LS_API_KEY = "bop_api_base";

  function cleanBase(v){
    let s = String(v || "").trim().replace(/\/+$/, "");
    if (s && !/^https?:\/\//i.test(s)) s = "https://" + s;
    return s;
  }

  /* Prioritas: 1) Vite define (baked at build), 2) localStorage */
  const base = cleanBase(window.BOP_API_BASE) || cleanBase(localStorage.getItem(LS_API_KEY) || "");
  window.BOP_API_BASE = base;

  window.__bopSetApiBase = function(url){
    const cleaned = cleanBase(url);
    window.BOP_API_BASE = cleaned;
    localStorage.setItem(LS_API_KEY, cleaned);
    return cleaned;
  };

  const nativeFetch = window.fetch.bind(window);

  window.fetch = function(input, init){
    const cur = window.BOP_API_BASE || "";
    try {
      if (cur && typeof input === "string" && input.startsWith("/api/")) {
        return nativeFetch(cur + input, init);
      }
      if (cur && input instanceof Request) {
        const u = new URL(input.url, window.location.href);
        if (u.origin === window.location.origin && u.pathname.startsWith("/api/")) {
          const nextReq = new Request(cur + u.pathname + u.search + u.hash, input);
          return nativeFetch(nextReq, init);
        }
      }
    } catch(e) {
      console.warn("[BOP API Bridge] fallback fetch:", e);
    }
    return nativeFetch(input, init);
  };

  /* ── Auto-discovery: jalankan sekali saat startup ─────────── */
  async function autoDiscover(){
    /* Jika sudah ada URL yang valid, cukup verifikasi saja */
    if (window.BOP_API_BASE){
      try{
        const r = await nativeFetch(window.BOP_API_BASE + "/api/bop/ping", {
          signal: AbortSignal.timeout(5000)
        });
        if(r.ok){ console.info("[BOP AutoDiscover] URL terverifikasi:", window.BOP_API_BASE); return; }
      } catch(e){ /* lanjut ke langkah berikutnya */ }
    }

    /* Langkah 1: Coba relative /api (works on Replit, same-origin, Vite dev) */
    try{
      const r = await nativeFetch("/api/bop/ping", { signal: AbortSignal.timeout(4000) });
      if(r.ok){
        console.info("[BOP AutoDiscover] Relative /api OK");
        window.BOP_API_BASE = "";
        window.__bopRelativeOk = true;
        return;
      }
    } catch(e){ /* tidak bisa reach /api secara relative */ }

    /* Langkah 2: Baca /api-config.json (di-generate oleh Vite build dari env VITE_API_BASE) */
    try{
      const r = await nativeFetch("/api-config.json", { signal: AbortSignal.timeout(4000) });
      if(r.ok){
        const cfg = await r.json();
        const url = cleanBase(cfg.apiBase || "");
        if(url){
          window.__bopSetApiBase(url);
          console.info("[BOP AutoDiscover] URL dari api-config.json:", url);
          return;
        }
      }
    } catch(e){ /* file tidak ada atau tidak valid */ }

    /* Langkah 3: Tanya server sendiri via /api/bop/server-url (fallback terakhir) */
    try{
      const r = await nativeFetch("/api/bop/server-url", { signal: AbortSignal.timeout(4000) });
      if(r.ok){
        const d = await r.json();
        const url = cleanBase(d.serverUrl || "");
        if(url && url !== cleanBase(window.location.origin)){
          window.__bopSetApiBase(url);
          console.info("[BOP AutoDiscover] URL dari server-url endpoint:", url);
        }
      }
    } catch(e){ /* tidak bisa */ }

    console.info("[BOP AutoDiscover] Selesai. API Base:", window.BOP_API_BASE || "(relative)");

    /* Trigger ulang sync setelah URL ditemukan, tanpa tunggu poll 8 detik */
    if(window.BOP_API_BASE || window.__bopRelativeOk){
      setTimeout(() => {
        if(typeof window.__bopRetriggerSync === "function") window.__bopRetriggerSync();
      }, 300);
    }
  }

  /* Jalankan auto-discovery segera setelah DOM siap */
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", () => autoDiscover());
  } else {
    autoDiscover();
  }

  console.info("[BOP API Bridge] API Base:", base || "(relative /api — auto-discover akan berjalan)");
})();

const STORE = "bop_rt005_data_v1_25";
const OLD_KEYS = ["bop_rt005_data_v1_3","bop_rt005_data_v1_2","bop_rt005_data_v1","bop_rt005_data_v1_4"];

const rupiah = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n||0));
function terbilang(n){
  const a=["","Satu","Dua","Tiga","Empat","Lima","Enam","Tujuh","Delapan","Sembilan","Sepuluh","Sebelas"];
  n=Math.floor(Number(n||0));
  if(n<12)return a[n]||"Nol";
  if(n<20)return terbilang(n-10)+" Belas";
  if(n<100){const s=terbilang(Math.floor(n/10))+" Puluh";const r=n%10;return r?s+" "+terbilang(r):s;}
  if(n<200)return "Seratus"+(n-100?" "+terbilang(n-100):"");
  if(n<1000){const s=terbilang(Math.floor(n/100))+" Ratus";const r=n%100;return r?s+" "+terbilang(r):s;}
  if(n<2000)return "Seribu"+(n-1000?" "+terbilang(n-1000):"");
  if(n<1000000){const s=terbilang(Math.floor(n/1000))+" Ribu";const r=n%1000;return r?s+" "+terbilang(r):s;}
  if(n<1000000000){const s=terbilang(Math.floor(n/1000000))+" Juta";const r=n%1000000;return r?s+" "+terbilang(r):s;}
  return String(n);
}
const clone = o => JSON.parse(JSON.stringify(o));
const $ = id => document.getElementById(id);
const val = id => $(id)?.value || "";
const set = (id,v)=>{ if($(id)) $(id).value = v ?? ""; };

const defaultData = {
  master:{rt:"005",rw:"012",kelurahan:"Tegalsari",kecamatan:"Candisari",kota:"Semarang",ketua:"",sekretaris:"",bendahara:"",alamat:"Jl. Tegalsari Raya, Tegalsari, Kota Semarang",noKtpKetua:""},
  kop:{baris1:"PEMERINTAH KOTA SEMARANG",baris2:"KECAMATAN CANDISARI",baris3:"KELURAHAN TEGALSARI",baris4:"RW 012 RT 005",alamat:"Sekretariat: Jl. Tegalsari Raya, Tegalsari, Kota Semarang"},
  pengajuan:{
    nomorSurat:"",tanggalSurat:"Semarang, 01 Juli 2026",sifatSurat:"Segera",lampiranSurat:"1 (satu) berkas",
    namaRekening:"",nomorRekening:"",namaLurah:"",namaKetuaRw:"",
    nomorSK:"",tanggalSK:"",masaBerlakuSK:"",
    namaBank:"",namaPemilikRekening:"",cabangBank:"",
    baNomor:"",baHari:"Minggu",baTanggal:"21",baBulan:"Juni",baTahun:"2026",baTempat:"Burjo depan cuci motor Anugrah",baPukul:"19.30 WIB",baPimpinan:"",
    hadirKegiatan:"Rapat Pembahasan RAP BOP RT 005 RW 012",hadirTanggal:"Minggu, 21 Juni 2026",hadirWaktu:"19.30 WIB",hadirTempat:"Burjo depan cuci motor Anugrah",hadirAgenda:"Pembahasan Rencana Anggaran Penggunaan Bantuan Operasional RT Tahun 2026",hadirRows:50,
    checklist:{rap:true,ba:true,hadir:true,permohonan:true,sptjm:true,rekening:false,sk:false},
    rap:[
      ["Pembelian Pengadministrasian tugas RT","1 paket",625000,"Alat ATK"],
      ["Pertemuan Rutin RT","12 Kali",3600000,"Jamuan Rapat"],
      ["Kegiatan 17 Agustus","1 Kegiatan",5000000,"Konsumsi, hadiah, dekorasi"],
      ["Perawatan Sarana Prasarana/Utilitas Lingkungan Poskamling RT","1 Paket",7000000,"Penggantian pintu, kusen dan jendela aluminium"],
      ["Pengelolaan Kebersihan/Sampah Lingkungan","5 Bulan",3900000,"Jasa pengelolaan sampah"],
      ["Pembinaan Kerukunan Warga melalui Pertemuan Rutin Bapak-bapak","6 Kali",3600000,"Konsumsi kegiatan"],
      ["Pembinaan Kerukunan Warga melalui Pertemuan Rutin Ibu-ibu","6 Kali",3600000,"Konsumsi kegiatan"],
      ["Kerja Bakti/Gotong Royong Lingkungan","6 Kali",600000,"Konsumsi dan perlengkapan"],
      ["Operasional Koordinasi Pengurus RT","1 Paket",1675000,"Dokumentasi, rapat dan perlengkapan pendukung"]
    ],
    peserta:[
      ["Ketua RT 005","Ketua RT 005 RW 012","RT 005"],
      ["Sekretaris RT 005","Sekretaris RT 005 RW 012","RT 005"],
      ["Bendahara RT 005","Bendahara RT 005 RW 012","RT 005"]
    ],
    meeting:{
      undNomor:"",undTanggalSurat:"Semarang, 01 Juli 2026",undKepada:"Warga RT 005 RW 012",undPerihal:"Undangan Rapat/Kegiatan Warga",
      rapatJudul:"Rapat Pembahasan Rencana Anggaran Penggunaan BOP RT 005 RW 012",
      rapatHariTanggal:"Minggu, 21 Juni 2026",rapatMulai:"19.30 WIB",rapatSelesai:"Selesai",rapatTempat:"Burjo depan cuci motor Anugrah",
      rapatAgenda:"Pembahasan Rencana Anggaran Penggunaan Bantuan Operasional RT Tahun 2026",
      notPimpinan:"",notNotulis:"",notHadir:0,notTidakHadir:0,
      notPembahasan:"Rapat membahas agenda kegiatan, kebutuhan anggaran, pelaksanaan kegiatan, pembagian tugas, serta kelengkapan dokumen administrasi.",
      notKeputusan:"Hasil rapat disepakati bersama dan akan dituangkan dalam dokumen resmi RT untuk kebutuhan administrasi dan pelaksanaan kegiatan.",
      notRapatBerikutnya:"",
      actionPlan:[["Menyiapkan kelengkapan dokumen kegiatan","Sebelum kegiatan dilaksanakan","Pengurus RT"],["Melaksanakan kegiatan sesuai kesepakatan","Sesuai jadwal kegiatan","Panitia/Pengurus"],["Menyusun dokumentasi dan bukti pertanggungjawaban","Setelah kegiatan selesai","Bendahara/Notulis"]]
    }
  },
  lpj:{
    tanggalCetak:"",dicetakOleh:"Kelurahan Tegalsari RW 12 RT 5",periode:"08 / 2026",
    saldoAwal:25000000,saldoBulanLalu:0,ketua:"",bendahara:"",
    pengeluaran:[
      ["2026-08-05","Konsumsi pertemuan warga",600000,"Koordinasi dan sosialisasi BOP"],
      ["2026-08-06","Honor/biaya jasa pengelolaan sampah",700000,"Pengambilan sampah lingkungan"],
      ["2026-08-12","Konsumsi kerja bakti",300000,"Kerja bakti lingkungan"]
    ]
  },
  history:[]
};
let data = loadData();
let currentDoc = "permohonan";
let currentHistoryFilter = "all";

function migrateOld(old){
  const d = clone(defaultData);
  if(!old || typeof old !== "object") return d;
  if(old.master) return {...d,...old};
  d.pengajuan.rap = Array.isArray(old.rap)? old.rap : d.pengajuan.rap;
  d.pengajuan.peserta = Array.isArray(old.peserta)? old.peserta : d.pengajuan.peserta;
  d.master.rt = old.rt || d.master.rt; d.master.rw = old.rw || d.master.rw;
  d.master.kelurahan = old.kelurahan || d.master.kelurahan; d.master.kecamatan = old.kecamatan || d.master.kecamatan; d.master.kota = old.kota || d.master.kota;
  d.master.ketua = old.ketua || d.master.ketua; d.master.sekretaris = old.sekretaris || d.master.sekretaris; d.master.bendahara = old.bendahara || d.master.bendahara;
  d.master.alamat = old.alamat || d.master.alamat;
  d.kop.baris1 = old.kop1 || d.kop.baris1; d.kop.baris2 = old.kop2 || d.kop.baris2; d.kop.baris3 = old.kop3 || d.kop.baris3; d.kop.alamat = old.kopAlamat || d.kop.alamat;
  d.pengajuan.namaLurah = old.lurah || old.namaLurah || ""; d.pengajuan.namaKetuaRw = old.ketuaRw || "";
  d.pengajuan.namaRekening = old.namaRek || ""; d.pengajuan.nomorRekening = old.noRek || "";
  d.pengajuan.nomorSurat = old.spNomor || ""; d.pengajuan.tanggalSurat = old.spTanggal || d.pengajuan.tanggalSurat;
  d.pengajuan.baNomor = old.baNomor || ""; d.pengajuan.baHari = old.baHari || d.pengajuan.baHari; d.pengajuan.baTanggal = old.baTanggal || d.pengajuan.baTanggal; d.pengajuan.baBulan = old.baBulan || d.pengajuan.baBulan;
  d.pengajuan.baTahun = old.baTahun || d.pengajuan.baTahun; d.pengajuan.baTempat = old.baTempat || d.pengajuan.baTempat; d.pengajuan.baPukul = old.baPukul || d.pengajuan.baPukul; d.pengajuan.baPimpinan = old.baPimpinan || "";
  if(Array.isArray(old.rbb) && old.rbb[0]) { d.lpj.periode = (old.rbb[0].bulan||"Januari 2026"); }
  return d;
}
function loadData(){
  try{
    const raw = localStorage.getItem(STORE);
    if(raw) return migrateOld(JSON.parse(raw));
  }catch(e){ console.warn("[BOP] Gagal memuat data utama:",e); }
  for(const k of OLD_KEYS){
    try{
      const raw = localStorage.getItem(k);
      if(raw){
        const migrated = migrateOld(JSON.parse(raw));
        try{ localStorage.removeItem(k); }catch(e2){}
        try{ localStorage.setItem(STORE, JSON.stringify(migrated)); }catch(e2){}
        console.info("[BOP] Data lama berhasil dimigrasikan dari:",k);
        return migrated;
      }
    }catch(e){ console.warn("[BOP] Gagal membaca key lama:",k,e); }
  }
  return clone(defaultData);
}
function saveData(){
  collectAll();
  try{ localStorage.setItem(STORE, JSON.stringify(data)); }catch(e){ bopAlert("Penyimpanan Gagal","Penyimpanan lokal penuh. Silakan backup data dan bersihkan ruang.","warning"); }
  render();
}
function autosave(){
  collectAll();
  try{ localStorage.setItem(STORE, JSON.stringify(data)); }catch(e){ console.warn("[BOP] Autosave gagal:",e); }
  updateDashboard();
}
function collectAll(){
  data.master.rt=val("masterRt"); data.master.rw=val("masterRw"); data.master.kelurahan=val("masterKelurahan"); data.master.kecamatan=val("masterKecamatan"); data.master.kota=val("masterKota");
  data.master.ketua=val("masterKetua"); data.master.sekretaris=val("masterSekretaris"); data.master.bendahara=val("masterBendahara"); data.master.alamat=val("masterAlamat"); data.master.noKtpKetua=val("masterNoKtpKetua");
  syncAutoPeserta();
  data.kop.baris1=val("kop1"); data.kop.baris2=val("kop2"); data.kop.baris3=val("kop3"); data.kop.baris4=val("kop4"); data.kop.alamat=val("kopAlamat");
  const p=data.pengajuan;
  ["nomorSurat","tanggalSurat","sifatSurat","lampiranSurat","namaRekening","nomorRekening","namaLurah","namaKetuaRw","baNomor","baHari","baTanggal","baBulan","baTahun","baTempat","baPukul","baPimpinan","hadirKegiatan","hadirTanggal","hadirWaktu","hadirTempat","hadirAgenda","hadirRows","nomorSK","tanggalSK","masaBerlakuSK","namaBank","namaPemilikRekening","cabangBank"].forEach(id=>p[id]=val(id));
  document.querySelectorAll("[data-check]").forEach(c=>p.checklist[c.dataset.check]=c.checked);
  if(!p.meeting) p.meeting = clone(defaultData.pengajuan.meeting);
  ["undNomor","undTanggalSurat","undKepada","undPerihal","rapatJudul","rapatHariTanggal","rapatMulai","rapatSelesai","rapatTempat","rapatAgenda","notPimpinan","notNotulis","notHadir","notTidakHadir","notPembahasan","notKeputusan","notRapatBerikutnya"].forEach(id=>p.meeting[id]=val(id));
  p.meeting.notHadir = Number(p.meeting.notHadir||0);
  p.meeting.notTidakHadir = Number(p.meeting.notTidakHadir||0);
  updateActionPlanFromInputs();
  updateRapFromInputs(); updatePesertaFromInputs(); updateExpensesFromInputs();
  const l=data.lpj;
  l.tanggalCetak=val("lpjTanggalCetak"); l.dicetakOleh=val("lpjDicetakOleh"); l.periode=val("lpjPeriode"); l.saldoAwal=Number(val("lpjSaldoAwal")||0); l.saldoBulanLalu=Number(val("lpjSaldoBulanLalu")||0); l.ketua=val("lpjKetua"); l.bendahara=val("lpjBendahara"); if($("pkNama")) collectPersiapan(); syncAutoPeserta(); syncAutoNomorSurat();
}

function romanMonth(n){return ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][Math.max(1,Math.min(12,Number(n||1)))-1]||"I";}
function parseDateParts(str){
  const s=String(str||"");
  const m=s.match(/(\d{4})/); const year=m?m[1]:String(new Date().getFullYear());
  const monthMap={januari:1,februari:2,maret:3,april:4,mei:5,juni:6,juli:7,agustus:8,september:9,oktober:10,november:11,desember:12,january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
  let month=String(new Date().getMonth()+1); const low=s.toLowerCase();
  Object.keys(monthMap).forEach(k=>{ if(low.includes(k)) month=String(monthMap[k]); });
  return {year,month};
}
function suratBaseCode(){ return `RT${data.master.rt||'005'}-RW${data.master.rw||'012'}`; }
function autoNumber(type,dateStr){
  const dp=parseDateParts(dateStr); const rm=romanMonth(dp.month); const y=dp.year; const base=suratBaseCode();
  const map={permohonan:`001/BOP/${base}/${rm}/${y}`,ba:`002/BA-RAP/${base}/${rm}/${y}`,undangan:`003/UND/${base}/${rm}/${y}`,sptjm:`004/SPTJM/${base}/${rm}/${y}`,pkundangan:`005/UND-KEG/${base}/${rm}/${y}`,kuitansi:`006/KWT/${base}/${rm}/${y}`};
  return map[type]||`000/${base}/${rm}/${y}`;
}
function getCoreParticipants(){
  const m=data.master||{}; const rt=m.rt||'005'; const rw=m.rw||'012'; const alamat=`RT ${rt}`;
  return [[m.ketua||`Ketua RT ${rt}`,`Ketua RT ${rt} RW ${rw}`,alamat],[m.sekretaris||`Sekretaris RT ${rt}`,`Sekretaris RT ${rt} RW ${rw}`,alamat],[m.bendahara||`Bendahara RT ${rt}`,`Bendahara RT ${rt} RW ${rw}`,alamat]];
}
function syncAutoPeserta(){
  const core=getCoreParticipants();
  if(!Array.isArray(data.pengajuan.peserta)) data.pengajuan.peserta=[];
  data.pengajuan.peserta=[...core,...data.pengajuan.peserta.slice(3)];
  if(data.persiapan){
    if(!Array.isArray(data.persiapan.peserta)) data.persiapan.peserta=[];
    data.persiapan.peserta=[...core,...data.persiapan.peserta.slice(3)];
  }
}
function syncAutoNomorSurat(){
  const p=data.pengajuan; if(!p.meeting) p.meeting = clone(defaultData.pengajuan.meeting);
  p.nomorSurat = autoNumber('permohonan', p.tanggalSurat);
  p.baNomor = autoNumber('ba', `${p.baTanggal||''} ${p.baBulan||''} ${p.baTahun||''}`);
  p.meeting.undNomor = autoNumber('undangan', p.meeting.undTanggalSurat);
  if(data.persiapan) data.persiapan.nomorKuitansi = autoNumber('kuitansi', data.persiapan.tanggalTerima);
}

function fillInputs(){
  syncAutoPeserta();
  syncAutoNomorSurat();
  const m=data.master,p=data.pengajuan,k=data.kop,l=data.lpj;
  set("masterRt",m.rt); set("masterRw",m.rw); set("masterKelurahan",m.kelurahan); set("masterKecamatan",m.kecamatan); set("masterKota",m.kota); set("masterKetua",m.ketua); set("masterSekretaris",m.sekretaris); set("masterBendahara",m.bendahara); set("masterAlamat",m.alamat); set("masterNoKtpKetua",m.noKtpKetua||"");
  set("kop1",k.baris1); set("kop2",k.baris2); set("kop3",k.baris3); set("kop4",k.baris4); set("kopAlamat",k.alamat);
  ["nomorSurat","tanggalSurat","sifatSurat","lampiranSurat","namaRekening","nomorRekening","namaLurah","namaKetuaRw","baNomor","baHari","baTanggal","baBulan","baTahun","baTempat","baPukul","baPimpinan","hadirKegiatan","hadirTanggal","hadirWaktu","hadirTempat","hadirAgenda","hadirRows","nomorSK","tanggalSK","masaBerlakuSK","namaBank","namaPemilikRekening","cabangBank"].forEach(id=>set(id,p[id]));
  if(!p.meeting) p.meeting = clone(defaultData.pengajuan.meeting);
  ["undNomor","undTanggalSurat","undKepada","undPerihal","rapatJudul","rapatHariTanggal","rapatMulai","rapatSelesai","rapatTempat","rapatAgenda","notPimpinan","notNotulis","notHadir","notTidakHadir","notPembahasan","notKeputusan","notRapatBerikutnya"].forEach(id=>set(id,p.meeting[id]));
  set("lpjTanggalCetak",l.tanggalCetak); set("lpjDicetakOleh",l.dicetakOleh); set("lpjPeriode",l.periode); set("lpjSaldoAwal",l.saldoAwal); set("lpjSaldoBulanLalu",l.saldoBulanLalu); set("lpjKetua",l.ketua); set("lpjBendahara",l.bendahara); fillPersiapan();
}

function totalRap(){ return data.pengajuan.rap.reduce((s,r)=>s+Number(r[2]||0),0); }
function totalExpense(){ return data.lpj.pengeluaran.reduce((s,r)=>s+Number(r[2]||0),0); }
function masterTitle(){ return `RT ${data.master.rt||"005"} RW ${data.master.rw||"012"}`; }

function kopHTML(){
  const k=data.kop;
  return `<div class="kop"><div class="kop-logo-wrap"><img src="assets/logo-pemkot-semarang-transparent.png" class="kop-logo" alt="Logo Kota Semarang"></div><div class="kop-text"><div class="kop-b1">${k.baris1}</div><div class="kop-b2">${k.baris2}</div><div class="kop-b2">${k.baris3}</div><div class="kop-b2">${k.baris4}</div><div class="kop-addr">${k.alamat||data.master.alamat||""}</div></div><div class="kop-logo-spacer"></div></div>`;
}

function official(body){ return `<div class="official">${kopHTML()}${body}</div>`; }

function renderRap(){
  const tb=$("rapTable")?.querySelector("tbody"); if(!tb) return; tb.innerHTML="";
  data.pengajuan.rap.forEach((r,i)=>{
    tb.insertAdjacentHTML("beforeend",`<tr>
      <td>${i+1}</td>
      <td><input class="mini-input" data-rap="${i},0" value="${escapeAttr(r[0])}"></td>
      <td><input class="mini-input" data-rap="${i},1" value="${escapeAttr(r[1])}"></td>
      <td><input class="mini-input" data-rap="${i},2" type="number" value="${Number(r[2]||0)}"></td>
      <td><input class="mini-input" data-rap="${i},3" value="${escapeAttr(r[3])}"></td>
      <td><button class="delete" onclick="deleteRap(${i})">Hapus</button></td>
    </tr>`);
  });
  $("rapTotalCell").textContent = rupiah(totalRap());
}
function updateRapFromInputs(){
  document.querySelectorAll("[data-rap]").forEach(inp=>{
    const [i,j]=inp.dataset.rap.split(",").map(Number);
    if(data.pengajuan.rap[i]) data.pengajuan.rap[i][j]=j===2?Number(inp.value||0):inp.value;
  });
}
function addRap(){ updateRapFromInputs(); data.pengajuan.rap.push(["","1 Paket",0,""]); saveData(); activateTab("rap"); }
function deleteRap(i){ updateRapFromInputs(); data.pengajuan.rap.splice(i,1); saveData(); activateTab("rap"); }

function renderPeserta(){
  const tb=$("pesertaTable")?.querySelector("tbody"); if(!tb) return; tb.innerHTML="";
  data.pengajuan.peserta.forEach((r,i)=>{
    tb.insertAdjacentHTML("beforeend",`<tr>
      <td>${i+1}</td><td><input class="mini-input" data-pes="${i},0" value="${escapeAttr(r[0])}"></td>
      <td><input class="mini-input" data-pes="${i},1" value="${escapeAttr(r[1])}"></td>
      <td><input class="mini-input" data-pes="${i},2" value="${escapeAttr(r[2])}"></td>
      <td><button class="delete" onclick="deletePeserta(${i})">Hapus</button></td></tr>`);
  });
}
function updatePesertaFromInputs(){
  document.querySelectorAll("[data-pes]").forEach(inp=>{
    const [i,j]=inp.dataset.pes.split(",").map(Number);
    if(data.pengajuan.peserta[i]) data.pengajuan.peserta[i][j]=inp.value;
  });
}
function addPeserta(){ updatePesertaFromInputs(); data.pengajuan.peserta.push(["","",""]); saveData(); activateTab("rapat"); }
function deletePeserta(i){ updatePesertaFromInputs(); data.pengajuan.peserta.splice(i,1); saveData(); activateTab("rapat"); }

function renderActionPlan(){
  const tb=$("actionTable")?.querySelector("tbody"); if(!tb) return;
  if(!data.pengajuan.meeting) data.pengajuan.meeting = clone(defaultData.pengajuan.meeting);
  tb.innerHTML="";
  data.pengajuan.meeting.actionPlan.forEach((r,i)=>{
    tb.insertAdjacentHTML("beforeend",`<tr>
      <td>${i+1}</td>
      <td><input class="mini-input" data-act="${i},0" value="${escapeAttr(r[0])}"></td>
      <td><input class="mini-input" data-act="${i},1" value="${escapeAttr(r[1])}"></td>
      <td><input class="mini-input" data-act="${i},2" value="${escapeAttr(r[2])}"></td>
      <td><button class="delete" onclick="deleteActionPlan(${i})">Hapus</button></td>
    </tr>`);
  });
}
function updateActionPlanFromInputs(){
  if(!data.pengajuan.meeting) return;
  document.querySelectorAll("[data-act]").forEach(inp=>{
    const [i,j]=inp.dataset.act.split(",").map(Number);
    if(data.pengajuan.meeting.actionPlan[i]) data.pengajuan.meeting.actionPlan[i][j]=inp.value;
  });
}
function addActionPlan(){ updateActionPlanFromInputs(); data.pengajuan.meeting.actionPlan.push(["","",""]); saveData(); activateTab("undangan-notulen"); }
function deleteActionPlan(i){ updateActionPlanFromInputs(); data.pengajuan.meeting.actionPlan.splice(i,1); saveData(); activateTab("undangan-notulen"); }

function renderExpenses(){
  const tb=$("expenseTable")?.querySelector("tbody"); if(!tb) return; tb.innerHTML="";
  data.lpj.pengeluaran.forEach((r,i)=>{
    tb.insertAdjacentHTML("beforeend",`<tr>
      <td>${i+1}</td><td><input class="mini-input" data-exp="${i},0" value="${escapeAttr(r[0])}"></td>
      <td><input class="mini-input" data-exp="${i},1" value="${escapeAttr(r[1])}"></td>
      <td><input class="mini-input" data-exp="${i},2" type="number" value="${Number(r[2]||0)}"></td>
      <td><input class="mini-input" data-exp="${i},3" value="${escapeAttr(r[3])}"></td>
      <td><button class="delete" onclick="deleteExpense(${i})">Hapus</button></td></tr>`);
  });
  $("expenseTotalCell").textContent=rupiah(totalExpense());
}
function updateExpensesFromInputs(){
  document.querySelectorAll("[data-exp]").forEach(inp=>{
    const [i,j]=inp.dataset.exp.split(",").map(Number);
    if(data.lpj.pengeluaran[i]) data.lpj.pengeluaran[i][j]=j===2?Number(inp.value||0):inp.value;
  });
}
function addExpense(){ updateExpensesFromInputs(); data.lpj.pengeluaran.push(["","","",""]); saveData(); activateTab("lpj-pengeluaran"); }
function deleteExpense(i){ updateExpensesFromInputs(); data.lpj.pengeluaran.splice(i,1); saveData(); activateTab("lpj-pengeluaran"); }

function renderChecklist(){
  const items=[
    ["rap","RAP BOP RT"],["ba","Berita Acara Kesepakatan RAP"],["hadir","Daftar Hadir Rapat RAP"],["permohonan","Surat Permohonan Pencairan"],["sptjm","SPTJM Ketua RT"],["rekening","Rekening Bank Jateng"],["sk","SK Lurah / Dokumentasi Rapat"]
  ];
  $("syaratChecklist").innerHTML = items.map(([k,t])=>`<label class="doc-check"><input type="checkbox" data-check="${k}" ${data.pengajuan.checklist[k]?"checked":""}> ${t}</label>`).join("");
  $("dashboardChecklist").innerHTML = items.map(([k,t])=>`<div class="check-item"><label><input type="checkbox" data-check="${k}" ${data.pengajuan.checklist[k]?"checked":""}> ${t}</label><span>${data.pengajuan.checklist[k]?"Selesai":"Belum"}</span></div>`).join("");
}

function updateDashboard(){
  const total=totalRap();
  $("dashAllocated").textContent=rupiah(total);
  $("dashSisa").textContent=rupiah(25000000-total);
  $("dashPercent").textContent=Math.round(total/25000000*100)+"%";
  $("dashHistory").textContent=data.history.length;
  const done=Object.values(data.pengajuan.checklist).filter(Boolean).length;
  $("checkProgress").textContent=`${done} / 7`;
  $("topTitle").textContent=masterTitle();
  $("topSubtitle").textContent=`${data.master.kelurahan}, ${data.master.kecamatan}, Kota ${data.master.kota}`;
  renderHistory();
  if($("kopPreview")) $("kopPreview").innerHTML=official(`<div class="title">CONTOH KOP SURAT RESMI</div><p style="text-align:center">KOP ini dipakai otomatis pada semua output dokumen.</p>`);
  if($("lpjOutput")) $("lpjOutput").innerHTML=docLpj();
}

function docRap(){
  return official(`<div class="title">RENCANA ANGGARAN PENGGUNAAN<br>BANTUAN OPERASIONAL RT</div>
  <table><thead><tr><th>No</th><th>Uraian Kegiatan</th><th>Satuan/Volume</th><th>Rencana Anggaran</th><th>Keterangan</th></tr></thead><tbody>
  ${data.pengajuan.rap.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${rupiah(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("")}
  <tr><td colspan="3"><b>Jumlah</b></td><td><b>${rupiah(totalRap())}</b></td><td></td></tr></tbody></table>
  <p style="text-align:right;margin-top:20px">Semarang, tanggal bulan tahun</p><p>Mengetahui,</p>
  <div class="ttd-4"><div>Ketua RT ${data.master.rt}<div class="signature-space"></div>${data.master.ketua||"Nama Jelas"}</div><div>Bendahara RT ${data.master.rt}<div class="signature-space"></div>${data.master.bendahara||"Nama Jelas"}</div><div>Lurah ${data.master.kelurahan}<div class="signature-space"></div>${data.pengajuan.namaLurah||"Nama Jelas"}</div><div>Ketua RW ${data.master.rw}<div class="signature-space"></div>${data.pengajuan.namaKetuaRw||"Nama Jelas"}</div></div>`);
}
function docPermohonan(){
  const p=data.pengajuan,m=data.master;
  return official(`<p style="text-align:right">${p.tanggalSurat}</p>
  <p>Kepada<br>Yth. Lurah ${m.kelurahan}<br>di -<br>SEMARANG</p>
  <table class="no-border"><tr><td style="width:90px">Nomor</td><td>: ${autoNumber('permohonan', p.tanggalSurat)}</td></tr><tr><td>Sifat</td><td>: ${p.sifatSurat}</td></tr><tr><td>Lampiran</td><td>: ${p.lampiranSurat}</td></tr><tr><td>Hal</td><td>: Permohonan Pencairan Bantuan Operasional RT</td></tr></table>
  <p>Dengan hormat,</p>
  <p>Bersama ini kami mengajukan permohonan pencairan Bantuan Operasional RT ${m.rt} RW ${m.rw} sebesar <b>Rp 25.000.000</b> dengan rincian sebagaimana terlampir.</p>
  <p>Sebagai bahan pertimbangan, bersama ini kami sampaikan persyaratan pencairan Bantuan Operasional RT ${m.rt} RW ${m.rw} sesuai dengan Peraturan Wali Kota tentang Pemberian Bantuan Operasional Rukun Tetangga dan Rukun Warga Kota Semarang yang bersumber dari APBD Kota Semarang.</p>
  <p>Pencairan bantuan dapat ditransfer melalui rekening Bank Jateng atas nama ${p.namaRekening||"........"} nomor rekening ${p.nomorRekening||"........"}.</p>
  <p>Demikian permohonan kami, atas perhatian dan kerjasamanya kami sampaikan terima kasih.</p>
  <div class="ttd-grid"><div></div><div>Hormat kami,<br>Ketua RT ${m.rt} RW ${m.rw}<div class="signature-space"></div>${m.ketua||"Nama Jelas"}</div></div>`);
}
function docBA(){
  const p=data.pengajuan,m=data.master;
  return official(`<div class="title">BERITA ACARA<br>KESEPAKATAN RENCANA ANGGARAN PENGGUNAAN BANTUAN OPERASIONAL RT</div>
  <p style="text-align:center">Nomor: ${p.baNomor||".................."}</p>
  <p>Pada hari ini ${p.baHari} tanggal ${p.baTanggal} bulan ${p.baBulan} tahun ${p.baTahun}, bertempat di ${p.baTempat} pada pukul ${p.baPukul} telah dilaksanakan pertemuan pembahasan Kesepakatan Rencana Anggaran Penggunaan Bantuan Operasional RT ${m.rt} RW ${m.rw}. Pertemuan dipimpin oleh ${p.baPimpinan||m.ketua||"........"}.</p>
  <p>Adapun hasil pertemuan sebagai berikut:</p>${docRap().match(/<table[\s\S]*?<\/table>/)[0]}
  <p>Demikian Berita Acara Hasil Kesepakatan Rencana Anggaran Penggunaan Bantuan Operasional RT ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>
  <p>Kami yang bertanda tangan di bawah ini:</p>
  <table><tr><th>No.</th><th>Nama</th><th>Jabatan</th><th>Tanda Tangan</th></tr>${p.peserta.map((r,i)=>`<tr><td>${i+1}.</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${i+1}.</td></tr>`).join("")}</table>`);
}
function docHadir(){
  const p=data.pengajuan; let rows=Number(p.hadirRows||50); let list=[...p.peserta]; while(list.length<rows) list.push(["","",""]);
  return official(`<div class="title">DAFTAR HADIR</div>
  <table class="no-border"><tr><td style="width:160px">Nama Kegiatan</td><td>: ${esc(p.hadirKegiatan)}</td></tr><tr><td>Hari/Tanggal</td><td>: ${esc(p.hadirTanggal)}</td></tr><tr><td>Waktu</td><td>: ${esc(p.hadirWaktu)}</td></tr><tr><td>Tempat</td><td>: ${esc(p.hadirTempat)}</td></tr><tr><td>Agenda</td><td>: ${esc(p.hadirAgenda)}</td></tr></table><br>
  <table><tr><th>No.</th><th>Nama</th><th>Jabatan/Status</th><th>Alamat/RT</th><th>Tanda Tangan</th></tr>${list.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r[0])||" "}</td><td>${esc(r[1])||" "}</td><td>${esc(r[2])||" "}</td><td>${i+1}.</td></tr>`).join("")}</table>`);
}
function docSptjm(){
  const m=data.master;
  return official(`<div class="title">SURAT PERNYATAAN TANGGUNG JAWAB MUTLAK</div>
  <p style="text-align:center">Nomor: ${autoNumber('sptjm', data.pengajuan.tanggalSurat)}</p>
  <p>Yang bertanda tangan di bawah ini:</p>
  <table class="no-border"><tr><td style="width:120px">Nama</td><td>: ${m.ketua||".................."}</td></tr><tr><td>No. KTP</td><td>: ..................</td></tr><tr><td>Alamat</td><td>: ${m.alamat||".................."}</td></tr><tr><td>Jabatan</td><td>: Ketua RT</td></tr><tr><td>RT/RW</td><td>: ${m.rt} / ${m.rw}</td></tr></table>
  <p>Saya selaku Ketua RT ${m.rt} RW ${m.rw} dengan ini menyatakan bahwa:</p>
  <ol><li>Bertanggung jawab sepenuhnya terhadap kebenaran data yang diajukan di dalam Bantuan Operasional RT dan RW.</li><li>Akan menggunakan bantuan sesuai dengan ketentuan yang berlaku dan bertanggung jawab atas penggunaannya secara formal dan materiil.</li><li>Akan bertanggung jawab mengembalikan dana bantuan operasional apabila terdapat temuan dalam audit.</li><li>Dalam hal terdapat pergantian ketua RT ${m.rt} RW ${m.rw}, maka tanggung jawab Dana Bantuan Operasional beralih kepada ketua RT yang baru terhitung sejak ditetapkan dalam Keputusan Lurah.</li></ol>
  <p>Demikian surat pernyataan ini saya buat dengan sebenar-benarnya tanpa ada unsur paksaan untuk dapat digunakan sebagaimana mestinya.</p>
  <div class="ttd-grid"><div></div><div>Semarang, tanggal bulan tahun<br>Ketua RT ${m.rt} RW ${m.rw}<br><br>(materai 10 ribu)<div class="signature-space"></div>${m.ketua||"Nama Jelas"}</div></div>`);
}
function docRbb(){
  const m=data.master;
  return official(`<div class="title">Pengambilan Operasional RT<br>Melalui Bank Jawa Tengah</div>
  <table class="no-border"><tr><td style="width:160px">Nama Lembaga</td><td>: RT ${m.rt} RW ${m.rw}</td></tr><tr><td>Kelurahan</td><td>: ${m.kelurahan}</td></tr><tr><td>Kecamatan</td><td>: ${m.kecamatan}</td></tr><tr><td>Untuk Kegiatan Bulan</td><td>: Agustus 2026</td></tr></table><br>
  <table><tr><th>No.</th><th>Uraian Kegiatan</th><th>Satuan/Volume</th><th>Anggaran</th><th>Keterangan</th></tr>${data.pengajuan.rap.slice(0,5).map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${rupiah(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("")}<tr><td colspan="3"><b>Jumlah</b></td><td><b>${rupiah(data.pengajuan.rap.slice(0,5).reduce((s,r)=>s+Number(r[2]||0),0))}</b></td><td></td></tr></table>
  <p>Terbilang: ${terbilang(data.pengajuan.rap.slice(0,5).reduce((s,r)=>s+Number(r[2]||0),0)).replace(/\s+/g," ")} Rupiah</p>
  <div class="ttd-3"><div>Yang Mengambil<br>Ketua RT ${m.rt} RW ${m.rw}<div class="signature-space"></div>${m.ketua||"Nama Jelas"}</div><div>Bendahara<div class="signature-space"></div>${m.bendahara||"Nama Jelas"}</div><div>Mengetahui<br>Lurah ${m.kelurahan}<div class="signature-space"></div>${data.pengajuan.namaLurah||"Nama Jelas"}</div></div>`);
}

function docUndangan(){
  const m=data.master, mt=data.pengajuan.meeting || defaultData.pengajuan.meeting;
  return official(`<p style="text-align:right">${esc(mt.undTanggalSurat)}</p>
  <table class="no-border"><tr><td style="width:90px">Nomor</td><td>: ${esc(autoNumber('undangan', mt.undTanggalSurat))}</td></tr><tr><td>Lampiran</td><td>: -</td></tr><tr><td>Perihal</td><td>: ${esc(mt.undPerihal)}</td></tr></table>
  <p>Kepada<br>Yth. ${esc(mt.undKepada)}<br>di Tempat</p>
  <p>Dengan hormat,</p>
  <p>Dalam rangka pelaksanaan kegiatan dan/atau pembahasan administrasi RT/RW, dengan ini kami mengundang Bapak/Ibu/Saudara/i untuk hadir pada:</p>
  <table class="no-border"><tr><td style="width:150px">Hari/Tanggal</td><td>: ${esc(mt.rapatHariTanggal)}</td></tr><tr><td>Waktu</td><td>: ${esc(mt.rapatMulai)} s.d. ${esc(mt.rapatSelesai)}</td></tr><tr><td>Tempat</td><td>: ${esc(mt.rapatTempat)}</td></tr><tr><td>Acara/Agenda</td><td>: ${esc(mt.rapatJudul)}</td></tr></table>
  <p><b>Agenda:</b><br>${esc(mt.rapatAgenda).replaceAll("\\n","<br>")}</p>
  <p>Mengingat pentingnya kegiatan tersebut, kami mengharapkan kehadiran Bapak/Ibu/Saudara/i tepat waktu.</p>
  <p>Demikian undangan ini kami sampaikan. Atas perhatian dan kehadirannya, kami ucapkan terima kasih.</p>
  <div class="ttd-grid"><div></div><div>Hormat kami,<br>Ketua RT ${m.rt} RW ${m.rw}<div class="signature-space"></div>${m.ketua||"Nama Jelas"}</div></div>`);
}
function docNotulen(){
  const m=data.master, mt=data.pengajuan.meeting || defaultData.pengajuan.meeting;
  const pesertaRows = data.pengajuan.peserta.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("");
  const actRows = (mt.actionPlan||[]).map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("");
  return official(`<div class="title">NOTULEN RAPAT / KEGIATAN</div>
  <table class="no-border">
    <tr><td style="width:170px"><b>Judul/Tema Rapat</b></td><td>: ${esc(mt.rapatJudul)}</td></tr>
    <tr><td><b>Hari/Tanggal</b></td><td>: ${esc(mt.rapatHariTanggal)}</td></tr>
    <tr><td><b>Waktu</b></td><td>: ${esc(mt.rapatMulai)} s.d. ${esc(mt.rapatSelesai)}</td></tr>
    <tr><td><b>Tempat/Lokasi</b></td><td>: ${esc(mt.rapatTempat)}</td></tr>
    <tr><td><b>Pimpinan Rapat</b></td><td>: ${esc(mt.notPimpinan)||m.ketua||".................."}</td></tr>
    <tr><td><b>Notulis</b></td><td>: ${esc(mt.notNotulis)||".................."}</td></tr>
    <tr><td><b>Kehadiran</b></td><td>: Hadir ${Number(mt.notHadir||0)} orang, Tidak Hadir ${Number(mt.notTidakHadir||0)} orang</td></tr>
  </table>
  <p><b>Agenda Rapat:</b><br>${esc(mt.rapatAgenda).replaceAll("\\n","<br>")}</p>
  <p><b>Pembahasan/Diskusi:</b><br>${esc(mt.notPembahasan).replaceAll("\\n","<br>")}</p>
  <p><b>Hasil Keputusan:</b><br>${esc(mt.notKeputusan).replaceAll("\\n","<br>")}</p>
  <p><b>Rencana Tindak Lanjut / Action Plan:</b></p>
  <table><tr><th>No</th><th>Task/Tugas</th><th>Target Waktu</th><th>PIC/Penanggung Jawab</th></tr>${actRows || '<tr><td>1</td><td></td><td></td><td></td></tr>'}</table>
  <p><b>Jadwal Rapat Berikutnya:</b><br>${esc(mt.notRapatBerikutnya)||"-"}</p>
  <p><b>Daftar Peserta:</b></p>
  <table><tr><th>No</th><th>Nama</th><th>Jabatan/Status</th><th>Alamat/RT</th></tr>${pesertaRows}</table>
  <p>Demikian notulen ini dibuat dengan sebenar-benarnya untuk digunakan sebagaimana mestinya.</p>
  <div class="ttd-grid"><div>Mengetahui,<br>Pimpinan Rapat<div class="signature-space"></div>${esc(mt.notPimpinan)||m.ketua||"Nama Jelas"}</div><div>Notulis<div class="signature-space"></div>${esc(mt.notNotulis)||"Nama Jelas"}</div></div>`);
}

function docChecklist(){
  const items=["Surat Permohonan Pencairan","SK Lurah Pembentukan RT/RW","Rekening Bank Jateng atas nama RT/RW","Rencana Anggaran Penggunaan","Berita Acara Kesepakatan RAP","Daftar Hadir dan Dokumentasi Rapat RAP","SPTJM"];
  return official(`<div class="title">CHECKLIST UPLOAD DOKUMEN PENGAJUAN BOP RT</div><table><tr><th>No</th><th>Dokumen</th><th>Status</th><th>Keterangan</th></tr>${items.map((x,i)=>`<tr><td>${i+1}</td><td>${x}</td><td></td><td></td></tr>`).join("")}</table>`);
}
function docSK(){
  const m=data.master,p=data.pengajuan;
  return official(`<div class="title">SURAT KEPUTUSAN LURAH ${esc((m.kelurahan||"").toUpperCase())}<br>PEMBENTUKAN PENGURUS RT ${esc(m.rt)} RW ${esc(m.rw)}</div>
  <table class="no-border">
    <tr><td style="width:210px">Nomor SK</td><td>: <b>${esc(p.nomorSK||"................................")}</b></td></tr>
    <tr><td>Tanggal SK</td><td>: ${esc(p.tanggalSK||"................................")}</td></tr>
    <tr><td>Perihal</td><td>: Pembentukan Pengurus RT ${esc(m.rt)} RW ${esc(m.rw)} Kel. ${esc(m.kelurahan||"")}</td></tr>
    <tr><td>Masa Berlaku</td><td>: ${esc(p.masaBerlakuSK||"................................")}</td></tr>
  </table>
  <br>
  <table>
    <tr><th>No.</th><th>Jabatan</th><th>Nama</th><th>No. KTP / NIK</th></tr>
    <tr><td>1</td><td>Ketua RT ${esc(m.rt)}</td><td>${esc(m.ketua||"................................")}</td><td>${esc(m.noKtpKetua||"................................")}</td></tr>
    <tr><td>2</td><td>Sekretaris</td><td>${esc(m.sekretaris||"................................")}</td><td>................................</td></tr>
    <tr><td>3</td><td>Bendahara</td><td>${esc(m.bendahara||"................................")}</td><td>................................</td></tr>
  </table>
  <br>
  <p style="text-align:center;border:1px solid #ccc;padding:10px;font-style:italic;color:#555">
    &#9888; Lampirkan fotokopi SK Lurah asli yang telah dilegalisir bersama berkas pengajuan ini.
  </p>
  <div class="ttd-grid">
    <div>Ketua RT ${esc(m.rt)} RW ${esc(m.rw)}<div class="signature-space"></div>${esc(m.ketua||"Nama Jelas")}</div>
    <div>Lurah ${esc(m.kelurahan||"")}<div class="signature-space"></div>NIP. ................................</div>
  </div>`);
}
function docRekening(){
  const m=data.master,p=data.pengajuan;
  return official(`<div class="title">INFORMASI REKENING BANK<br>RT ${esc(m.rt)} RW ${esc(m.rw)} ${esc((m.kelurahan||"").toUpperCase())}</div>
  <p style="text-align:center;margin-bottom:16px">Data rekening bank untuk keperluan pencairan BOP RT ${esc(m.rt)} RW ${esc(m.rw)}, ${esc(m.kelurahan||"")}, Kota ${esc(m.kota||"")}</p>
  <table class="no-border">
    <tr><td style="width:230px"><b>Nama Bank</b></td><td>: <b>${esc(p.namaBank||"Bank Pembangunan Daerah (BPD) Jateng")}</b></td></tr>
    <tr><td><b>Nomor Rekening</b></td><td>: <b>${esc(p.nomorRekening||"................................")}</b></td></tr>
    <tr><td><b>Nama Pemilik Rekening</b></td><td>: ${esc(p.namaPemilikRekening||m.ketua||"................................")}</td></tr>
    <tr><td><b>Cabang</b></td><td>: ${esc(p.cabangBank||"................................")}</td></tr>
  </table>
  <br>
  <table class="no-border">
    <tr><td style="width:230px">Atas Nama Lembaga</td><td>: RT ${esc(m.rt)} RW ${esc(m.rw)} ${esc(m.kelurahan||"")}</td></tr>
    <tr><td>Kelurahan</td><td>: ${esc(m.kelurahan||"")}</td></tr>
    <tr><td>Kecamatan</td><td>: ${esc(m.kecamatan||"")}</td></tr>
    <tr><td>Kota</td><td>: Kota ${esc(m.kota||"")}</td></tr>
  </table>
  <br>
  <p style="text-align:center;border:1px solid #ccc;padding:10px;font-style:italic;color:#555">
    &#9888; Lampirkan fotokopi Buku Rekening BPD/Bank Jateng (halaman depan) bersama berkas pengajuan ini.
  </p>
  <div class="ttd-grid">
    <div>Ketua RT ${esc(m.rt)} RW ${esc(m.rw)}<div class="signature-space"></div>${esc(m.ketua||"Nama Jelas")}</div>
    <div>Mengetahui<br>Lurah ${esc(m.kelurahan||"")}<div class="signature-space"></div>NIP. ................................</div>
  </div>`);
}
function docLpj(){
  const m=data.master,l=data.lpj;
  const now = l.tanggalCetak || new Date().toLocaleString("id-ID");
  const pengeluaran = l.pengeluaran.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r[1])}<br><small>${esc(r[0])}</small></td><td>${rupiah(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("");
  const total=totalExpense(), sisa=Number(l.saldoAwal||0)+Number(l.saldoBulanLalu||0)-total;
  return official(`<div class="title">LAPORAN PENGGUNAAN PEMBERIAN BANTUAN<br>OPERASIONAL KOTA SEMARANG</div>
  <table class="no-border"><tr><td style="width:180px"><b>TANGGAL CETAK</b></td><td>: ${now}</td></tr><tr><td><b>DICETAK OLEH</b></td><td>: ${esc(l.dicetakOleh)}</td></tr><tr><td><b>PERIODE BULAN/TAHUN</b></td><td>: ${esc(l.periode)}</td></tr><tr><td><b>KECAMATAN</b></td><td>: ${m.kecamatan}</td></tr><tr><td><b>KELURAHAN</b></td><td>: ${m.kelurahan}</td></tr><tr><td><b>RW</b></td><td>: ${Number(m.rw)}</td></tr><tr><td><b>RT</b></td><td>: ${Number(m.rt)}</td></tr></table><br>
  <table class="report-table"><tr><th>No</th><th>Kegiatan</th><th>Jumlah</th><th>Keterangan</th></tr>
  <tr><td>I</td><td><b>PENERIMAAN SALDO AWAL</b></td><td><b>${rupiah(l.saldoAwal)}</b></td><td></td></tr>
  <tr><td>II</td><td><b>SALDO BULAN LALU</b></td><td><b>${rupiah(l.saldoBulanLalu)}</b></td><td></td></tr>
  <tr><td>III</td><td colspan="3"><b>PENGELUARAN</b></td></tr>
  ${pengeluaran}
  <tr><td></td><td><b>JUMLAH PENGELUARAN</b></td><td><b>${rupiah(total)}</b></td><td></td></tr>
  <tr><td>IV</td><td><b>SISA UANG PENYELENGGARAAN</b><br>(jumlah penerimaan - jumlah pengeluaran) menjadi saldo bulan berikutnya</td><td><b>${rupiah(sisa)}</b></td><td></td></tr></table>
  <div class="ttd-grid"><div>Ketua RT ${Number(m.rt)} RW ${Number(m.rw)}<div class="signature-space"></div>${l.ketua||m.ketua||"Nama Jelas"}</div><div>Bendahara RT ${Number(m.rt)} RW ${Number(m.rw)}<div class="signature-space"></div>${l.bendahara||m.bendahara||"Nama Jelas"}</div></div>`);
}
function previewDoc(type=currentDoc){
  collectAll(); currentDoc=type;
  const map={permohonan:docPermohonan,rap:docRap,ba:docBA,hadir:docHadir,sptjm:docSptjm,sk:docSK,rekening:docRekening,undangan:docUndangan,notulen:docNotulen};
  document.querySelectorAll(".doc-btn").forEach(b=>b.classList.toggle("active",b.dataset.doc===type));
  $("docOutput").innerHTML=(map[type]||docPermohonan)();
}

function addHistory(kind,type,title,html){
  collectAll();
  data.history.unshift({id:Date.now().toString(),kind,type,title,date:new Date().toLocaleString("id-ID"),html});
  try{ localStorage.setItem(STORE,JSON.stringify(data)); }catch(e){ console.warn("[BOP] Gagal simpan history:",e); }
  renderHistory();
  updateDashboard();
  bopToast("Dokumen Disimpan",`${title} berhasil disimpan ke riwayat.`,"success");
}
function renderHistory(){
  const all=data.history || [];
  const recent=all.slice(0,5);
  const render=(arr,container,filterKind)=>{
    if(!$(container))return;
    const list=filterKind?arr.filter(x=>x.kind===filterKind):arr;
    $(container).innerHTML=list.length?list.map(h=>`<div class="history-card">
      <div><strong>${esc(h.title)}</strong><small>${esc(h.date)} • ${esc(h.kind)} • ${esc(h.type)}</small></div>
      <div class="history-actions"><button onclick="viewHistory('${h.id}')">Lihat</button><button onclick="editHistory('${h.id}')">Edit</button><button class="hapus" onclick="deleteHistory('${h.id}')">Hapus</button></div>
    </div>`).join(""):`<div class="empty">Belum ada riwayat.</div>`;
  };
  render(recent,"recentHistory",null); render(all,"historyPengajuan","Pengajuan"); render(all,"historyLpj","LPJ"); render(all,"historyPersiapan","Persiapan Kegiatan");
}
function viewHistory(id){
  const h=data.history.find(x=>x.id===id); if(!h)return;
  if(h.kind==="LPJ"){goPage("lpj"); activateTab("lpj-preview"); $("lpjOutput").innerHTML=h.html;}
  else{goPage("pengajuan"); activateTab("dokumen"); $("docOutput").innerHTML=h.html;}
}
function editHistory(id){
  const h=data.history.find(x=>x.id===id); if(!h)return;
  if(h.kind==="LPJ"){goPage("lpj"); activateTab("lpj-data");}
  else{goPage("pengajuan"); activateTab("data-pengajuan");}
}
function deleteHistory(id){
  bopConfirm("Hapus Riwayat","Hapus dokumen ini dari riwayat?","warning","Hapus","Batal").then(ok=>{
    if(!ok) return;
    data.history=data.history.filter(x=>x.id!==id);
    try{ localStorage.setItem(STORE,JSON.stringify(data)); }catch(e){}
    renderHistory(); updateDashboard();
    bopToast("Riwayat Dihapus","Dokumen berhasil dihapus dari riwayat.","success");
  });
}

function goPage(page){
  document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  $("page-"+page).classList.add("active");
  if(window.innerWidth<1000) $("sidebar").classList.remove("open");
}
function activateTab(id){
  document.querySelectorAll(".subtab").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));
  document.querySelectorAll(".tab-content").forEach(t=>t.classList.toggle("active",t.id==="tab-"+id));
  if(id==="lpj-preview"){ $("lpjOutput").innerHTML=docLpj(); renderMokuFotoSheetsV35(); }
}

function backup(name="backup_data_bop_rt005.json"){
  collectAll();
  download(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),name);
}
function restoreFile(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      data=migrateOld(JSON.parse(reader.result));
      try{ localStorage.setItem(STORE,JSON.stringify(data)); }catch(e){}
      render();
      bopAlert("Restore Berhasil","Data backup berhasil dipulihkan ke aplikasi.","success");
    }catch(e){
      bopAlert("File Tidak Valid","File backup tidak dapat dibaca. Pastikan file backup yang benar.","error");
    }
  };
  reader.readAsText(file);
}
function resetAll(){
  bopConfirm("Reset Semua Data","Seluruh data lokal akan dikembalikan ke data awal. Tindakan ini tidak dapat dibatalkan!","warning","Ya, Reset","Batal").then(ok=>{
    if(!ok) return;
    Object.keys(localStorage).forEach(k=>{if(k.startsWith("bop_rt005_data"))localStorage.removeItem(k)});
    data=clone(defaultData);
    try{ localStorage.setItem(STORE,JSON.stringify(data)); }catch(e){}
    render();
    bopAlert("Reset Selesai","Semua data aplikasi telah direset ke kondisi awal.","success");
  });
}
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);}
function escapeAttr(s){return String(s??"").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;")}
function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}

/* ===== SweetAlert2 Helpers ===== */
function bopAlert(title, text, icon="info"){
  if(typeof Swal === "undefined"){ alert(`${title}: ${text}`); return Promise.resolve(); }
  const iconMap = {success:"success",error:"error",warning:"warning",info:"info",question:"question"};
  const isHtml = /<[a-z][\s\S]*>/i.test(text);
  return Swal.fire({
    title, [isHtml ? "html" : "text"]: text, icon: iconMap[icon]||"info",
    confirmButtonColor:"#0b2e59",
    confirmButtonText:"OK",
    customClass:{popup:"swal-bop-popup"}
  });
}
function bopConfirm(title, text, icon="question", confirmText="Ya", cancelText="Batal"){
  if(typeof Swal === "undefined"){ return Promise.resolve(confirm(`${title}\n${text}`)); }
  return Swal.fire({
    title, text, icon: icon||"question",
    showCancelButton: true,
    confirmButtonColor:"#0b2e59",
    cancelButtonColor:"#6b7280",
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    customClass:{popup:"swal-bop-popup"}
  }).then(r => r.isConfirmed);
}
function bopToast(title, text, icon="success"){
  if(typeof Swal === "undefined"){ return; }
  const Toast = Swal.mixin({
    toast:true, position:"top-end", showConfirmButton:false,
    timer:3000, timerProgressBar:true,
    customClass:{popup:"swal-bop-toast"}
  });
  Toast.fire({icon: icon||"success", title, text});
}
/* =============================== */


function cleanPrint(target){
  collectAll();
  document.body.classList.remove("print-doc","print-lpj");
  if(target === "lpj"){
    $("lpjOutput").innerHTML = docLpj();
    document.body.classList.add("print-lpj");
  } else {
    previewDoc(currentDoc);
    document.body.classList.add("print-doc");
  }
  setTimeout(()=>window.print(),150);
}
window.addEventListener("afterprint",()=>document.body.classList.remove("print-doc","print-lpj","print-pk"));


/* PATCH v1.7 - RAP 1 Tahun + RAP Bulanan Otomatis */
const RAP_MONTHS=["Januari 2026","Februari 2026","Maret 2026","April 2026","Mei 2026","Juni 2026","Juli 2026","Agustus 2026","September 2026","Oktober 2026","November 2026","Desember 2026"];
const RAP_MONTH_ALL="Januari-Desember 2026";
const KATEGORI_OPERASIONAL=["Administratif Pelaksanaan Tugas RT","Kegiatan Sosial, Budaya, Pengembangan Pariwisata, dan Pemberdayaan Masyarakat","Penataan, Pemeliharaan, dan Kebersihan Lingkungan RT"];
const SUB_KATEGORI_MAP={
 "Administratif Pelaksanaan Tugas RT":["Pengadministrasian tugas RT","Belanja Alat Tulis Kantor penunjang kegiatan RT","Cetak administratif RT","Koordinasi dan administrasi pengurus RT"],
 "Kegiatan Sosial, Budaya, Pengembangan Pariwisata, dan Pemberdayaan Masyarakat":["Pertemuan, rapat atau ronda malam","Kerja bakti atau gotong royong","Peringatan hari besar nasional/keagamaan","Kegiatan sosial dan budaya masyarakat","Pembinaan kerukunan dan silaturahmi warga","Pemberdayaan masyarakat"],
 "Penataan, Pemeliharaan, dan Kebersihan Lingkungan RT":["Penataan lingkungan RT","Pemeliharaan sarana/prasarana/utilitas lingkungan","Kebersihan dan pengelolaan sampah lingkungan","Perawatan Poskamling RT","Penghijauan dan perawatan tanaman","Perbaikan fasilitas pendukung lingkungan"]
};
const TIPE_OPERASIONAL=["Belanja Barang/Material","Makan Minum/Konsumsi","Jasa/Tenaga/Tukang/Honorarium","Sewa Peralatan/Tempat","Administrasi/ATK/Cetak","Dokumentasi","Lainnya"];
function guessKategori(u=""){u=String(u).toLowerCase();if(u.includes("atk")||u.includes("administrasi")||u.includes("pengadministrasian")||u.includes("koordinasi"))return KATEGORI_OPERASIONAL[0];if(u.includes("sampah")||u.includes("poskamling")||u.includes("lingkungan")||u.includes("pemeliharaan")||u.includes("perawatan"))return KATEGORI_OPERASIONAL[2];return KATEGORI_OPERASIONAL[1]}
function guessSubKategori(k,u=""){u=String(u).toLowerCase();if(k===KATEGORI_OPERASIONAL[0]){if(u.includes("atk"))return "Belanja Alat Tulis Kantor penunjang kegiatan RT";if(u.includes("cetak"))return "Cetak administratif RT";if(u.includes("koordinasi"))return "Koordinasi dan administrasi pengurus RT";return "Pengadministrasian tugas RT"} if(k===KATEGORI_OPERASIONAL[2]){if(u.includes("sampah"))return "Kebersihan dan pengelolaan sampah lingkungan";if(u.includes("poskamling"))return "Perawatan Poskamling RT";if(u.includes("pemeliharaan")||u.includes("perawatan"))return "Pemeliharaan sarana/prasarana/utilitas lingkungan";return "Penataan lingkungan RT"} if(u.includes("17")||u.includes("hut"))return "Peringatan hari besar nasional/keagamaan"; if(u.includes("kerja bakti")||u.includes("gotong"))return "Kerja bakti atau gotong royong"; if(u.includes("rutin")||u.includes("rapat")||u.includes("pertemuan"))return "Pertemuan, rapat atau ronda malam"; return "Kegiatan sosial dan budaya masyarakat"}
function guessTipe(u=""){u=String(u).toLowerCase();if(u.includes("konsumsi")||u.includes("jamuan")||u.includes("makan")||u.includes("snack"))return "Makan Minum/Konsumsi";if(u.includes("tukang")||u.includes("honor")||u.includes("jasa")||u.includes("sampah"))return "Jasa/Tenaga/Tukang/Honorarium";if(u.includes("sewa"))return "Sewa Peralatan/Tempat";if(u.includes("atk")||u.includes("cetak")||u.includes("administrasi"))return "Administrasi/ATK/Cetak";if(u.includes("dokumentasi"))return "Dokumentasi";return "Belanja Barang/Material"}
function guessBulan(u=""){u=String(u).toLowerCase();if(u.includes("17")||u.includes("hut")||u.includes("poskamling")||u.includes("renovasi"))return "Agustus 2026";if(u.includes("sampah")||u.includes("rutin")||u.includes("kerja bakti")||u.includes("gotong")||u.includes("koordinasi")||u.includes("ibu")||u.includes("bapak"))return RAP_MONTH_ALL;return "Januari 2026"}
function opt(list,sel){return list.map(x=>`<option value="${escapeAttr(x)}" ${x===sel?"selected":""}>${esc(x)}</option>`).join("")}
function normalizeRapV17(){if(!data.pengajuan)data.pengajuan=clone(defaultData.pengajuan);data.pengajuan.rap=(data.pengajuan.rap||[]).map(r=>{if(Array.isArray(r)){let u=r[0]||"",k=guessKategori(u);return {kategori:k,subKategori:guessSubKategori(k,u),tipe:guessTipe(u),uraian:u,bulan:guessBulan(u),volume:r[1]||"1 Paket",jumlah:Number(r[2]||0),keterangan:r[3]||""}}let k=r.kategori||guessKategori(r.uraian||"");return {kategori:k,subKategori:r.subKategori||guessSubKategori(k,r.uraian||""),tipe:r.tipe||guessTipe(r.uraian||""),uraian:r.uraian||"",bulan:r.bulan||guessBulan(r.uraian||""),volume:r.volume||"1 Paket",jumlah:Number(r.jumlah??0),keterangan:r.keterangan||""}});if(!data.pengajuan.selectedMonth)data.pengajuan.selectedMonth="Agustus 2026"}
function totalRap(){normalizeRapV17();return data.pengajuan.rap.reduce((s,r)=>s+Number(r.jumlah||0),0)}
function renderRap(){normalizeRapV17();let tb=$("rapTable").querySelector("tbody");tb.innerHTML="";$("rapTable").classList.add("rap-wide-table");data.pengajuan.rap.forEach((r,i)=>tb.insertAdjacentHTML("beforeend",`<tr><td>${i+1}</td><td><select class="mini-input select-compact" data-rap="${i},kategori">${opt(KATEGORI_OPERASIONAL,r.kategori)}</select></td><td><select class="mini-input select-compact" data-rap="${i},subKategori">${opt(SUB_KATEGORI_MAP[r.kategori]||[],r.subKategori)}</select></td><td><select class="mini-input select-compact" data-rap="${i},tipe">${opt(TIPE_OPERASIONAL,r.tipe)}</select></td><td><input class="mini-input" data-rap="${i},uraian" value="${escapeAttr(r.uraian)}"></td><td><select class="mini-input select-compact" data-rap="${i},bulan">${opt([RAP_MONTH_ALL,...RAP_MONTHS],r.bulan)}</select></td><td><input class="mini-input" data-rap="${i},volume" value="${escapeAttr(r.volume)}"></td><td><input class="mini-input" type="number" data-rap="${i},jumlah" value="${Number(r.jumlah||0)}"></td><td><input class="mini-input" data-rap="${i},keterangan" value="${escapeAttr(r.keterangan)}"></td><td><button class="delete" onclick="deleteRap(${i})">Hapus</button></td></tr>`));$("rapTotalCell").textContent=rupiah(totalRap());renderMonthlyRapSummary()}
function updateRapFromInputs(){normalizeRapV17();document.querySelectorAll("[data-rap]").forEach(inp=>{let [i,k]=inp.dataset.rap.split(",");i=Number(i);if(!data.pengajuan.rap[i])return;let v=inp.value;if(k==="jumlah")v=Number(v||0);data.pengajuan.rap[i][k]=v;if(k==="kategori"){let row=data.pengajuan.rap[i];if(!(SUB_KATEGORI_MAP[v]||[]).includes(row.subKategori))row.subKategori=(SUB_KATEGORI_MAP[v]||[""])[0]}})}
function addRap(){updateRapFromInputs();data.pengajuan.rap.push({kategori:KATEGORI_OPERASIONAL[0],subKategori:SUB_KATEGORI_MAP[KATEGORI_OPERASIONAL[0]][0],tipe:"Administrasi/ATK/Cetak",uraian:"",bulan:"Januari 2026",volume:"1 Paket",jumlah:0,keterangan:""});localStorage.setItem(STORE,JSON.stringify(data));render();activateTab("rap")}
function deleteRap(i){updateRapFromInputs();data.pengajuan.rap.splice(i,1);localStorage.setItem(STORE,JSON.stringify(data));render();activateTab("rap")}
function getMonthlyRapRows(month){normalizeRapV17();let rows=[];data.pengajuan.rap.forEach(r=>{if(r.bulan===month)rows.push({...r,jumlahBulanan:Number(r.jumlah||0),sumber:"Langsung"});else if(r.bulan===RAP_MONTH_ALL&&RAP_MONTHS.includes(month))rows.push({...r,jumlahBulanan:Math.round(Number(r.jumlah||0)/RAP_MONTHS.length),sumber:"Bagi rata"})});return rows}
function monthlyTotal(month){return getMonthlyRapRows(month).reduce((s,r)=>s+Number(r.jumlahBulanan||0),0)}
function renderMonthlyRapSummary(){let el=$("monthlyRapSummary");if(!el)return;el.innerHTML=RAP_MONTHS.map(month=>{let rows=getMonthlyRapRows(month);return `<div class="monthly-card"><h3>${month}</h3><div class="table-wrap"><table><thead><tr><th>No</th><th>Uraian</th><th>Kategori</th><th>Jumlah</th></tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.uraian)}<br><small>${esc(r.volume)} • ${esc(r.sumber)}</small></td><td>${esc(r.kategori)}</td><td>${rupiah(r.jumlahBulanan)}</td></tr>`).join(""):`<tr><td colspan="4">Belum ada kegiatan pada bulan ini.</td></tr>`}</tbody></table></div><div class="monthly-total"><span>Total ${month}</span><strong>${rupiah(monthlyTotal(month))}</strong></div></div>`}).join("");if($("monthlyDocMonth"))$("monthlyDocMonth").value=data.pengajuan.selectedMonth||"Januari 2026"}
function updateDashboard(){normalizeRapV17();const total=totalRap();$("dashAllocated").textContent=rupiah(total);$("dashSisa").textContent=rupiah(25000000-total);$("dashPercent").textContent=Math.round(total/25000000*100)+"%";$("dashHistory").textContent=data.history.length;const done=Object.values(data.pengajuan.checklist).filter(Boolean).length;$("checkProgress").textContent=`${done} / 7`;$("topTitle").textContent=masterTitle();$("topSubtitle").textContent=`${data.master.kelurahan}, ${data.master.kecamatan}, Kota ${data.master.kota}`;renderHistory();renderMonthlyRapSummary();if($("kopPreview"))$("kopPreview").innerHTML=official(`<div class="title">CONTOH KOP SURAT RESMI</div><p style="text-align:center">KOP ini dipakai otomatis pada semua output dokumen.</p>`);if($("lpjOutput"))$("lpjOutput").innerHTML=docLpj()}
function docRap(){normalizeRapV17();return official(`<div class="title">RENCANA ANGGARAN PENGGUNAAN<br>BANTUAN OPERASIONAL RT</div><table><thead><tr><th>No</th><th>Uraian Kegiatan</th><th>Satuan/Volume</th><th>Rencana Anggaran</th><th>Keterangan</th></tr></thead><tbody>${data.pengajuan.rap.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.uraian)}<br><small>${esc(r.kategori)} - ${esc(r.subKategori)}<br>Bulan: ${esc(r.bulan)} | Tipe: ${esc(r.tipe)}</small></td><td>${esc(r.volume)}</td><td>${rupiah(r.jumlah)}</td><td>${esc(r.keterangan)}</td></tr>`).join("")}<tr><td colspan="3"><b>Jumlah</b></td><td><b>${rupiah(totalRap())}</b></td><td></td></tr></tbody></table><p style="text-align:right;margin-top:20px">Semarang, tanggal bulan tahun</p><p>Mengetahui,</p><div class="ttd-4"><div>Ketua RT ${data.master.rt}<div class="signature-space"></div>${data.master.ketua||"Nama Jelas"}</div><div>Bendahara RT ${data.master.rt}<div class="signature-space"></div>${data.master.bendahara||"Nama Jelas"}</div><div>Lurah ${data.master.kelurahan}<div class="signature-space"></div>${data.pengajuan.namaLurah||"Nama Jelas"}</div><div>Ketua RW ${data.master.rw}<div class="signature-space"></div>${data.pengajuan.namaKetuaRw||"Nama Jelas"}</div></div>`)}
function docRapBulanan(){let month=$("monthlyDocMonth")?.value||data.pengajuan.selectedMonth||"Januari 2026";data.pengajuan.selectedMonth=month;let rows=getMonthlyRapRows(month);return official(`<div class="title">RENCANA ANGGARAN PENGGUNAAN BULANAN<br>BANTUAN OPERASIONAL RT<br>BULAN ${esc(month).toUpperCase()}</div><table><thead><tr><th>No</th><th>Uraian Kegiatan</th><th>Satuan/Volume</th><th>Rencana Anggaran</th><th>Keterangan</th></tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.uraian)}<br><small>${esc(r.kategori)} - ${esc(r.subKategori)}<br>Tipe: ${esc(r.tipe)} | Sumber: ${esc(r.sumber)}</small></td><td>${esc(r.volume)}</td><td>${rupiah(r.jumlahBulanan)}</td><td>${esc(r.keterangan)}</td></tr>`).join(""):`<tr><td colspan="5">Belum ada rencana kegiatan untuk bulan ${esc(month)}.</td></tr>`}<tr><td colspan="3"><b>Jumlah</b></td><td><b>${rupiah(monthlyTotal(month))}</b></td><td></td></tr></tbody></table><p style="text-align:right;margin-top:20px">Semarang, tanggal bulan tahun</p><div class="ttd-4"><div>Ketua RT ${data.master.rt}<div class="signature-space"></div>${data.master.ketua||"Nama Jelas"}</div><div>Bendahara RT ${data.master.rt}<div class="signature-space"></div>${data.master.bendahara||"Nama Jelas"}</div><div>Lurah ${data.master.kelurahan}<div class="signature-space"></div>${data.pengajuan.namaLurah||"Nama Jelas"}</div><div>Ketua RW ${data.master.rw}<div class="signature-space"></div>${data.pengajuan.namaKetuaRw||"Nama Jelas"}</div></div>`)}
function docRbb(){let m=data.master,month=$("monthlyDocMonth")?.value||data.pengajuan.selectedMonth||"Januari 2026",rows=getMonthlyRapRows(month);return official(`<div class="title">Pengambilan Operasional RT<br>Melalui Bank Jawa Tengah</div><table class="no-border"><tr><td style="width:160px">Nama Lembaga</td><td>: RT ${m.rt} RW ${m.rw}</td></tr><tr><td>Kelurahan</td><td>: ${m.kelurahan}</td></tr><tr><td>Kecamatan</td><td>: ${m.kecamatan}</td></tr><tr><td>Untuk Kegiatan Bulan</td><td>: ${esc(month)}</td></tr></table><br><table><tr><th>No.</th><th>Uraian Kegiatan</th><th>Satuan/Volume</th><th>Anggaran</th><th>Keterangan</th></tr>${rows.length?rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.uraian)}</td><td>${esc(r.volume)}</td><td>${rupiah(r.jumlahBulanan)}</td><td>${esc(r.keterangan)}</td></tr>`).join(""):`<tr><td colspan="5">Belum ada kegiatan bulan ini.</td></tr>`}<tr><td colspan="3"><b>Jumlah</b></td><td><b>${rupiah(monthlyTotal(month))}</b></td><td></td></tr></table><p>Terbilang: ${terbilang(monthlyTotal(month)).replace(/\s+/g," ")} Rupiah</p><div class="ttd-3"><div>Yang Mengambil<br>Ketua RT ${m.rt} RW ${m.rw}<div class="signature-space"></div>${m.ketua||"Nama Jelas"}</div><div>Bendahara<div class="signature-space"></div>${m.bendahara||"Nama Jelas"}</div><div>Mengetahui<br>Lurah ${m.kelurahan}<div class="signature-space"></div>${data.pengajuan.namaLurah||"Nama Jelas"}</div></div>`)}
function docBA(){let p=data.pengajuan,m=data.master;return official(`<div class="title">BERITA ACARA<br>KESEPAKATAN RENCANA ANGGARAN PENGGUNAAN BANTUAN OPERASIONAL RT</div><p style="text-align:center">Nomor: ${p.baNomor||".................."}</p><p>Pada hari ini ${p.baHari} tanggal ${p.baTanggal} bulan ${p.baBulan} tahun ${p.baTahun}, bertempat di ${p.baTempat} pada pukul ${p.baPukul} telah dilaksanakan pertemuan pembahasan Kesepakatan Rencana Anggaran Penggunaan Bantuan Operasional RT ${m.rt} RW ${m.rw}. Pertemuan dipimpin oleh ${p.baPimpinan||m.ketua||"........"}.</p><p>Adapun hasil pertemuan sebagai berikut:</p>${docRap().match(/<table[\s\S]*?<\/table>/)[0]}<p>Demikian Berita Acara Hasil Kesepakatan Rencana Anggaran Penggunaan Bantuan Operasional RT ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p><p>Kami yang bertanda tangan di bawah ini:</p><table><tr><th>No.</th><th>Nama</th><th>Jabatan</th><th>Tanda Tangan</th></tr>${p.peserta.map((r,i)=>`<tr><td>${i+1}.</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${i+1}.</td></tr>`).join("")}</table>`)}
function previewDoc(type=currentDoc){collectAll();if($("monthlyDocMonth"))data.pengajuan.selectedMonth=$("monthlyDocMonth").value;currentDoc=type;const map={permohonan:docPermohonan,rap:docRap,rapbulanan:docRapBulanan,ba:docBA,hadir:docHadir,sptjm:docSptjm,sk:docSK,rekening:docRekening,undangan:docUndangan,notulen:docNotulen};document.querySelectorAll(".doc-btn").forEach(b=>b.classList.toggle("active",b.dataset.doc===type));$("docOutput").innerHTML=(map[type]||docPermohonan)()}


/* PATCH v1.8 - Persiapan Kegiatan Operasional / Bukti SPJ */
function ensurePersiapan(){
  if(!data.persiapan){
    data.persiapan={
      jenis:"Konsumsi Rapat / Pertemuan Warga",
      nama:"Kegiatan Operasional RT 005 RW 012",
      hariTanggal:"Minggu, 21 Juni 2026",
      waktu:"19.30 WIB s.d. selesai",
      tempat:"Sekretariat / Lingkungan RT 005 RW 012",
      agenda:"Pelaksanaan kegiatan operasional RT dan kelengkapan administrasi pertanggungjawaban.",
      pimpinan:"",notulis:"",rows:30,nominal:0,penerima:"",jabatanPenerima:"",
      keperluan:"Pembayaran kegiatan operasional RT sesuai mata belanja yang tercantum dalam RAP/SPJ.",
      tanggalTerima:"Semarang, ................. 2026",nomorKuitansi:"",metode:"Tunai",nikPenerima:"",pajak:"",
      hadir:0,tidakHadir:0,
      pembahasan:"Kegiatan dibahas sesuai kebutuhan warga, ketersediaan anggaran, teknis pelaksanaan, dan kelengkapan dokumen SPJ.",
      keputusan:"Kegiatan disepakati untuk dilaksanakan dan didukung dengan bukti administrasi berupa daftar hadir, notulen, dokumentasi, dan tanda terima/kuitansi.",
      rapatBerikutnya:"",
      peserta:[["Ketua RT 005","Ketua RT 005 RW 012","RT 005"],["Bendahara RT 005","Bendahara RT 005 RW 012","RT 005"]],
      action:[["Menyiapkan daftar hadir, notulen, dokumentasi, dan tanda terima","Sebelum/selama kegiatan","Pengurus RT"],["Mengarsipkan bukti SPJ per mata belanja","Setelah kegiatan selesai","Bendahara/Notulis"]]
    };
  }
}
function collectPersiapan(){
  ensurePersiapan();
  const p=data.persiapan;
  p.jenis=val("pkJenis");p.nama=val("pkNama");p.hariTanggal=val("pkHariTanggal");p.waktu=val("pkWaktu");p.tempat=val("pkTempat");p.agenda=val("pkAgenda");
  p.pimpinan=val("pkPimpinan");p.notulis=val("pkNotulis");p.rows=Number(val("pkRows")||30);p.nominal=Number(val("pkNominal")||0);p.penerima=val("pkPenerima");p.jabatanPenerima=val("pkJabatanPenerima");
  p.keperluan=val("pkKeperluan");p.tanggalTerima=val("pkTanggalTerima");p.nomorKuitansi=val("pkNomorKuitansi");p.metode=val("pkMetode");p.nikPenerima=val("pkNikPenerima");p.pajak=val("pkPajak");
  p.hadir=Number(val("pkHadir")||0);p.tidakHadir=Number(val("pkTidakHadir")||0);p.pembahasan=val("pkPembahasan");p.keputusan=val("pkKeputusan");p.rapatBerikutnya=val("pkRapatBerikutnya");
  updatePkPesertaFromInputs();updatePkActionFromInputs();
}
function fillPersiapan(){
  ensurePersiapan();
  const p=data.persiapan;
  set("pkJenis",p.jenis);set("pkNama",p.nama);set("pkHariTanggal",p.hariTanggal);set("pkWaktu",p.waktu);set("pkTempat",p.tempat);set("pkAgenda",p.agenda);
  set("pkPimpinan",p.pimpinan);set("pkNotulis",p.notulis);set("pkRows",p.rows);set("pkNominal",p.nominal);set("pkPenerima",p.penerima);set("pkJabatanPenerima",p.jabatanPenerima);
  set("pkKeperluan",p.keperluan);set("pkTanggalTerima",p.tanggalTerima);set("pkNomorKuitansi",p.nomorKuitansi);set("pkMetode",p.metode);set("pkNikPenerima",p.nikPenerima);set("pkPajak",p.pajak);
  set("pkHadir",p.hadir);set("pkTidakHadir",p.tidakHadir);set("pkPembahasan",p.pembahasan);set("pkKeputusan",p.keputusan);set("pkRapatBerikutnya",p.rapatBerikutnya);
}
function renderPkPeserta(){
  ensurePersiapan();
  const tb=$("pkPesertaTable")?.querySelector("tbody"); if(!tb)return;
  tb.innerHTML="";
  data.persiapan.peserta.forEach((r,i)=>tb.insertAdjacentHTML("beforeend",`<tr><td>${i+1}</td><td><input class="mini-input" data-pkpes="${i},0" value="${escapeAttr(r[0])}"></td><td><input class="mini-input" data-pkpes="${i},1" value="${escapeAttr(r[1])}"></td><td><input class="mini-input" data-pkpes="${i},2" value="${escapeAttr(r[2])}"></td><td><button class="delete" onclick="deletePkPeserta(${i})">Hapus</button></td></tr>`));
}
function updatePkPesertaFromInputs(){
  if(!data.persiapan)return;
  document.querySelectorAll("[data-pkpes]").forEach(inp=>{let [i,j]=inp.dataset.pkpes.split(",").map(Number);if(data.persiapan.peserta[i])data.persiapan.peserta[i][j]=inp.value;});
}
function addPkPeserta(){collectPersiapan();data.persiapan.peserta.push(["","",""]);localStorage.setItem(STORE,JSON.stringify(data));renderPersiapan();activateTab("pk-daftar-hadir")}
function deletePkPeserta(i){collectPersiapan();data.persiapan.peserta.splice(i,1);localStorage.setItem(STORE,JSON.stringify(data));renderPersiapan();activateTab("pk-daftar-hadir")}
function renderPkAction(){
  ensurePersiapan();
  const tb=$("pkActionTable")?.querySelector("tbody"); if(!tb)return;
  tb.innerHTML="";
  data.persiapan.action.forEach((r,i)=>tb.insertAdjacentHTML("beforeend",`<tr><td>${i+1}</td><td><input class="mini-input" data-pkact="${i},0" value="${escapeAttr(r[0])}"></td><td><input class="mini-input" data-pkact="${i},1" value="${escapeAttr(r[1])}"></td><td><input class="mini-input" data-pkact="${i},2" value="${escapeAttr(r[2])}"></td><td><button class="delete" onclick="deletePkAction(${i})">Hapus</button></td></tr>`));
}
function updatePkActionFromInputs(){
  if(!data.persiapan)return;
  document.querySelectorAll("[data-pkact]").forEach(inp=>{let [i,j]=inp.dataset.pkact.split(",").map(Number);if(data.persiapan.action[i])data.persiapan.action[i][j]=inp.value;});
}
function addPkAction(){collectPersiapan();data.persiapan.action.push(["","",""]);localStorage.setItem(STORE,JSON.stringify(data));renderPersiapan();activateTab("pk-notulen")}
function deletePkAction(i){collectPersiapan();data.persiapan.action.splice(i,1);localStorage.setItem(STORE,JSON.stringify(data));renderPersiapan();activateTab("pk-notulen")}
function docPkUndangan(){
  const m=data.master,p=data.persiapan;return official(`<p style="text-align:right">${p.tanggalTerima||"Semarang, ................. 2026"}</p>
  <table class="no-border"><tr><td style="width:90px">Nomor</td><td>: ${p.nomorKuitansi||"........."}</td></tr><tr><td>Lampiran</td><td>: -</td></tr><tr><td>Perihal</td><td>: Undangan ${esc(p.nama)}</td></tr></table>
  <p>Kepada<br>Yth. Warga/Peserta Kegiatan ${masterTitle()}<br>di Tempat</p>
  <p>Dengan hormat,</p><p>Dalam rangka pelaksanaan kegiatan operasional RT, kami mengundang Bapak/Ibu/Saudara/i untuk hadir pada:</p>
  <table class="no-border"><tr><td style="width:150px">Jenis Kegiatan</td><td>: ${esc(p.jenis)}</td></tr><tr><td>Nama Kegiatan</td><td>: ${esc(p.nama)}</td></tr><tr><td>Hari/Tanggal</td><td>: ${esc(p.hariTanggal)}</td></tr><tr><td>Waktu</td><td>: ${esc(p.waktu)}</td></tr><tr><td>Tempat</td><td>: ${esc(p.tempat)}</td></tr><tr><td>Agenda</td><td>: ${esc(p.agenda)}</td></tr></table>
  <p>Demikian undangan ini kami sampaikan. Atas perhatian dan kehadirannya, kami ucapkan terima kasih.</p>
  <div class="ttd-grid"><div></div><div>Hormat kami,<br>Ketua RT ${m.rt} RW ${m.rw}<div class="signature-space"></div>${m.ketua||"Nama Jelas"}</div></div>`);
}
function docPkHadir(){
  const p=data.persiapan;let rows=Number(p.rows||30),list=[...p.peserta];while(list.length<rows)list.push(["","",""]);
  return official(`<div class="title">DAFTAR HADIR KEGIATAN OPERASIONAL</div>
  <table class="no-border"><tr><td style="width:160px">Jenis Kegiatan</td><td>: ${esc(p.jenis)}</td></tr><tr><td>Nama Kegiatan</td><td>: ${esc(p.nama)}</td></tr><tr><td>Hari/Tanggal</td><td>: ${esc(p.hariTanggal)}</td></tr><tr><td>Waktu</td><td>: ${esc(p.waktu)}</td></tr><tr><td>Tempat</td><td>: ${esc(p.tempat)}</td></tr><tr><td>Agenda</td><td>: ${esc(p.agenda)}</td></tr></table><br>
  <table><tr><th>No</th><th>Nama</th><th>Jabatan/Status</th><th>Alamat/RT</th><th>Tanda Tangan</th></tr>${list.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r[0])||" "}</td><td>${esc(r[1])||" "}</td><td>${esc(r[2])||" "}</td><td>${i+1}.</td></tr>`).join("")}</table>`);
}
function docPkNotulen(){
  const m=data.master,p=data.persiapan;const act=(p.action||[]).map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("");
  const peserta=(p.peserta||[]).map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("");
  return official(`<div class="title">NOTULEN KEGIATAN OPERASIONAL</div>
  <table class="no-border"><tr><td style="width:170px"><b>Jenis Kegiatan</b></td><td>: ${esc(p.jenis)}</td></tr><tr><td><b>Judul/Tema</b></td><td>: ${esc(p.nama)}</td></tr><tr><td><b>Hari/Tanggal</b></td><td>: ${esc(p.hariTanggal)}</td></tr><tr><td><b>Waktu</b></td><td>: ${esc(p.waktu)}</td></tr><tr><td><b>Tempat</b></td><td>: ${esc(p.tempat)}</td></tr><tr><td><b>Pimpinan</b></td><td>: ${esc(p.pimpinan)||m.ketua||".................."}</td></tr><tr><td><b>Notulis</b></td><td>: ${esc(p.notulis)||".................."}</td></tr><tr><td><b>Kehadiran</b></td><td>: Hadir ${Number(p.hadir||0)} orang, Tidak Hadir ${Number(p.tidakHadir||0)} orang</td></tr></table>
  <p><b>Agenda:</b><br>${esc(p.agenda).replaceAll("\\n","<br>")}</p>
  <p><b>Pembahasan/Diskusi:</b><br>${esc(p.pembahasan).replaceAll("\\n","<br>")}</p>
  <p><b>Hasil Keputusan:</b><br>${esc(p.keputusan).replaceAll("\\n","<br>")}</p>
  <p><b>Rencana Tindak Lanjut / Action Plan:</b></p><table><tr><th>No</th><th>Task/Tugas</th><th>Target Waktu</th><th>PIC</th></tr>${act||'<tr><td>1</td><td></td><td></td><td></td></tr>'}</table>
  <p><b>Jadwal Kegiatan/Rapat Berikutnya:</b><br>${esc(p.rapatBerikutnya)||"-"}</p>
  <p><b>Daftar Peserta:</b></p><table><tr><th>No</th><th>Nama</th><th>Jabatan/Status</th><th>Alamat/RT</th></tr>${peserta}</table>
  <p>Demikian notulen ini dibuat sebagai bukti kelengkapan administrasi kegiatan operasional dan laporan pertanggungjawaban.</p>
  <div class="ttd-grid"><div>Mengetahui,<br>Pimpinan Kegiatan/Rapat<div class="signature-space"></div>${esc(p.pimpinan)||m.ketua||"Nama Jelas"}</div><div>Notulis<div class="signature-space"></div>${esc(p.notulis)||"Nama Jelas"}</div></div>`);
}
function docPkKuitansi(){
  const m=data.master,p=data.persiapan;
  return official(`<div class="kuitansi-box"><div class="kuitansi-title">TANDA TERIMA / KUITANSI</div>
  <table class="no-border"><tr><td style="width:160px">Nomor</td><td>: ${esc(autoNumber('kuitansi', p.tanggalTerima))}</td></tr><tr><td>Telah diterima dari</td><td>: Ketua RT ${m.rt} RW ${m.rw} Kelurahan ${m.kelurahan}</td></tr><tr><td>Uang sebesar</td><td>: <span class="kuitansi-nominal">${rupiah(p.nominal)}</span></td></tr><tr><td>Terbilang</td><td>: ${terbilang(p.nominal).replace(/\s+/g," ")} Rupiah</td></tr><tr><td>Untuk pembayaran</td><td>: ${esc(p.keperluan)}</td></tr><tr><td>Jenis kegiatan</td><td>: ${esc(p.jenis)}</td></tr><tr><td>Nama kegiatan</td><td>: ${esc(p.nama)}</td></tr><tr><td>Metode pembayaran</td><td>: ${esc(p.metode)}</td></tr><tr><td>NPWP/NIK Penerima</td><td>: ${esc(p.nikPenerima)||"-"}</td></tr><tr><td>Keterangan Pajak</td><td>: ${esc(p.pajak)||"-"}</td></tr></table>
  <div class="ttd-3"><div>Yang Membayar<br>Ketua RT ${m.rt} RW ${m.rw}<div class="signature-space"></div>${m.ketua||"Nama Jelas"}</div><div>Mengetahui<br>Bendahara RT ${m.rt} RW ${m.rw}<div class="signature-space"></div>${m.bendahara||"Nama Jelas"}</div><div>${esc(p.tanggalTerima)}<br>Yang Menerima<br>${esc(p.jabatanPenerima)||"Penerima"}<div class="signature-space"></div>${esc(p.penerima)||"Nama Jelas"}</div></div></div>`);
}
let currentPkDoc="pk-hadir";
function previewPkDoc(type=currentPkDoc){
  collectPersiapan();currentPkDoc=type;
  const map={"pk-undangan":docPkUndangan,"pk-hadir":docPkHadir,"pk-notulen":docPkNotulen,"pk-kuitansi":docPkKuitansi};
  document.querySelectorAll(".pk-doc-btn").forEach(b=>b.classList.toggle("active",b.dataset.pkdoc===type));
  if($("pkDocOutput")) $("pkDocOutput").innerHTML=(map[type]||docPkHadir)();
}
function cleanPrintPk(){
  collectPersiapan();previewPkDoc(currentPkDoc);
  document.body.classList.remove("print-doc","print-lpj");document.body.classList.add("print-pk");
  setTimeout(()=>window.print(),150);
}
function renderPersiapan(){fillPersiapan();renderPkPeserta();renderPkAction();previewPkDoc(currentPkDoc);renderHistory();}


/* PATCH v1.9 - Integrasi Dokumentasi Mobile */
function ensureMobileSync(){
  if(!data.mobileSync){
    data.mobileSync = {activities:[], imported:[]};
  }
}
function slugify(txt){ return String(txt||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50); }
function createActivityFromPersiapan(){
  ensurePersiapan(); ensureMobileSync();
  const p = data.persiapan, m = data.master;
  return {
    id: "act-"+Date.now(),
    jenis: p.jenis,
    nama: p.nama,
    hariTanggal: p.hariTanggal,
    waktu: p.waktu,
    tempat: p.tempat,
    agenda: p.agenda,
    pimpinan: p.pimpinan,
    notulis: p.notulis,
    petugas: (p.peserta||[]).map(x=>x[0]).filter(Boolean).slice(0,3),
    nominal: Number(p.nominal||0),
    rt: m.rt, rw: m.rw, kelurahan: m.kelurahan, kecamatan: m.kecamatan, kota: m.kota,
    createdAt: new Date().toISOString(),
    checklist: ["Foto Sebelum","Foto Proses","Foto Sesudah","Foto Daftar Hadir","Foto Nota/Kuitansi","Foto Serah Terima"],
    source: "Persiapan Kegiatan Operasional"
  };
}
function saveActivityToMobileQueue(){
  collectPersiapan(); ensureMobileSync();
  const act = createActivityFromPersiapan();
  data.mobileSync.activities.push(act);
  saveData();
  bopToast("Kegiatan Dikirim","Kegiatan berhasil dikirim ke daftar sinkronisasi MoKu.","success");
}
function exportActivitiesForMobile(){
  collectPersiapan(); ensureMobileSync();
  const payload = {
    app:"BOP RT005 Main App",
    exportedAt:new Date().toISOString(),
    activities:data.mobileSync.activities
  };
  downloadJSON(payload, "kegiatan_moku_rt005.json");
}
function downloadJSON(obj, filename){
  const blob = new Blob([JSON.stringify(obj,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
function importMobileResultFile(file){
  ensureMobileSync();
  const fr = new FileReader();
  fr.onload = ()=>{
    try{
      const parsed = JSON.parse(fr.result);
      const items = parsed.results || parsed.activities || [];
      data.mobileSync.imported = items;
      saveData();
      renderMobileDocumentationToLPJ(); cleanPreviewGridV23(); insertAiNotulenPanelsV25(); renderMonitoringV24();
      bopToast("Import Berhasil","Hasil dokumentasi MoKu berhasil di-import.","success");
    }catch(err){
      bopAlert("File Tidak Valid","File hasil mobile tidak dapat dibaca. Pastikan format file yang benar.","error");
    }
  };
  fr.readAsText(file);
}
function normalizeMokuPhotoTypeV34(type){
  const t = String(type || "").toLowerCase().replace(/\s+/g," ").trim();
  if(t.includes("sebelum")) return "sebelum";
  if(t.includes("proses")) return "proses";
  if(t.includes("sesudah") || t.includes("setelah")) return "sesudah";
  if(t.includes("daftar") || t.includes("hadir") || t.includes("absensi")) return "hadir";
  if(t.includes("nota") || t.includes("kuitansi") || t.includes("kwitansi")) return "nota";
  if(t.includes("serah") || t.includes("terima")) return "serah";
  return "lainnya";
}
function getMokuPhotosByBucketV34(act, bucket){
  const photos = Array.isArray(act?.photos) ? act.photos : [];
  if(bucket === "all") return photos.map((p,i)=>({...p,__index:i}));
  return photos.map((p,i)=>({...p,__index:i})).filter(p => normalizeMokuPhotoTypeV34(p.type) === bucket);
}
function mokuPhotoCellV34(act, actIdx, bucket, label){
  const photos = getMokuPhotosByBucketV34(act,bucket);
  if(!photos.length){
    return `<span class="moku-photo-empty">-</span>`;
  }
  return `<button type="button" class="moku-eye-btn" title="Lihat ${esc(label)}" onclick="openMokuPhotoViewerV34(${actIdx},'${bucket}')">👁 <b>${photos.length}</b></button>`;
}
function mokuPetugasTextV34(act){
  const p = act?.petugas;
  if(Array.isArray(p)) return p.filter(Boolean).join(", ") || "-";
  return String(p || "-");
}
function formatMokuPhotoLocationV34(p){
  if(!p) return "";
  if(p.locationText) return p.locationText;
  if(p.manualLocation) return p.manualLocation;
  if(p.lokasi) return p.lokasi;
  if(p.coords) return String(p.coords);
  if(p.location && typeof p.location === "object"){
    const lat = Number(p.location.latitude ?? p.location.lat);
    const lng = Number(p.location.longitude ?? p.location.lng);
    if(Number.isFinite(lat) && Number.isFinite(lng)) return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
  return "";
}
function saveMokuImportedV34(){
  ensureMobileSync();
  localStorage.setItem(STORE, JSON.stringify(data));
  renderMobileDocumentationToLPJ();
  if(typeof renderMonitoringV24 === "function") renderMonitoringV24();
}
async function deleteMokuActivityV34(actIdx){
  ensureMobileSync();
  const items = data.mobileSync.imported || [];
  const act = items[actIdx];
  if(!act) return;
  const name = act.nama || `Kegiatan ${actIdx+1}`;
  const _delAct = await bopConfirm("Hapus Dokumentasi Kegiatan",`Hapus seluruh dokumentasi MoKu untuk kegiatan: ${name}?`,"warning","Hapus","Batal");
  if(!_delAct) return;
  items.splice(actIdx,1);
  data.mobileSync.imported = items;
  saveMokuImportedV34();
}
function ensureMokuPhotoViewerV34(){
  let modal = $("mokuPhotoViewerV34");
  if(modal) return modal;
  modal = document.createElement("div");
  modal.id = "mokuPhotoViewerV34";
  modal.className = "moku-viewer-backdrop";
  modal.innerHTML = `<div class="moku-viewer-card">
    <div class="moku-viewer-head">
      <div>
        <h3 id="mokuViewerTitleV34">Dokumentasi MoKu</h3>
        <p id="mokuViewerSubtitleV34">Preview foto terdokumentasi</p>
      </div>
      <button type="button" class="moku-viewer-close" onclick="closeMokuPhotoViewerV34()">Tutup</button>
    </div>
    <div id="mokuViewerBodyV34" class="moku-viewer-body"></div>
  </div>`;
  modal.addEventListener("click", (e)=>{ if(e.target === modal) closeMokuPhotoViewerV34(); });
  document.body.appendChild(modal);
  return modal;
}
function closeMokuPhotoViewerV34(){
  const modal = $("mokuPhotoViewerV34");
  if(modal) modal.classList.remove("open");
}
function openMokuPhotoViewerV34(actIdx, bucket="all"){
  ensureMobileSync();
  const act = (data.mobileSync.imported || [])[actIdx];
  if(!act) return;
  const labels = {all:"Semua Foto",sebelum:"Foto Sebelum",proses:"Foto Proses",sesudah:"Foto Sesudah",hadir:"Foto Daftar Hadir",nota:"Foto Nota/Kuitansi",serah:"Foto Serah Terima",lainnya:"Foto Lainnya"};
  const photos = getMokuPhotosByBucketV34(act,bucket);
  const modal = ensureMokuPhotoViewerV34();
  $("mokuViewerTitleV34").textContent = `${labels[bucket] || "Dokumentasi"} - ${act.nama || "Kegiatan"}`;
  $("mokuViewerSubtitleV34").textContent = `${act.hariTanggal || "-"} • ${act.tempat || "-"} • ${photos.length} foto`;
  $("mokuViewerBodyV34").innerHTML = photos.length ? photos.map((p)=>`
    <div class="moku-viewer-photo">
      <img src="${p.dataUrl || ''}" alt="${esc(p.type || 'Foto MoKu')}">
      <div class="moku-viewer-photo-meta">
        <b>${esc(p.type || 'Foto')}</b>
        <span>${esc(p.capturedAtText || p.timestamp || p.takenAt || p.capturedAt || p.createdAt || '-')}</span>
        <small>${esc(formatMokuPhotoLocationV34(p))}</small>
        <div class="moku-viewer-photo-actions">
          <button type="button" class="secondary small" onclick="openMokuImageNewTabV34(${actIdx},${p.__index})">Buka</button>
          <button type="button" class="moku-delete-btn small" onclick="deleteMokuPhotoV34(${actIdx},${p.__index},'${bucket}')">🗑 Hapus</button>
        </div>
      </div>
    </div>`).join("") : `<div class="hint">Belum ada foto pada kategori ini.</div>`;
  modal.classList.add("open");
}
function openMokuImageNewTabV34(actIdx, photoIdx){
  ensureMobileSync();
  const p = data.mobileSync.imported?.[actIdx]?.photos?.[photoIdx];
  if(!p?.dataUrl){ bopAlert("Foto Tidak Tersedia","Data foto tidak ditemukan.","error"); return; }
  const w = window.open();
  if(!w){ bopAlert("Popup Diblokir","Izinkan popup di browser untuk membuka foto.","warning"); return; }
  w.document.write(`<title>Foto MoKu</title><img src="${p.dataUrl}" style="max-width:100%;height:auto;display:block;margin:auto">`);
}
async function deleteMokuPhotoV34(actIdx, photoIdx, bucket="all"){
  ensureMobileSync();
  const act = data.mobileSync.imported?.[actIdx];
  if(!act || !Array.isArray(act.photos) || !act.photos[photoIdx]) return;
  const _delPhoto = await bopConfirm("Hapus Foto","Hapus foto dokumentasi ini?","warning","Hapus","Batal");
  if(!_delPhoto) return;
  act.photos.splice(photoIdx,1);
  saveMokuImportedV34();
  openMokuPhotoViewerV34(actIdx,bucket);
}
/* ── Lembar Dokumentasi Foto MoKu di LPJ Preview ─────────── */
/* ── Helper: buka IndexedDB MoKu (same-origin) ──────────── */
async function openMokuIDBV35(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined") return reject();
    const req=indexedDB.open("bop_rt005_idb_v1");
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject();
    req.onblocked=()=>reject();
  });
}
/* ── Kumpulkan aktivitas+foto langsung dari MoKu storage ── */
async function getMokuItemsForLPJ(){
  /* 1. Baca state MoKu dari localStorage (same origin) */
  let mokuState=null;
  try{ const raw=localStorage.getItem("moku_rt005_v2_premium"); if(raw) mokuState=JSON.parse(raw); }catch(_){}

  let items=[];
  if(mokuState?.activities?.length){
    /* 2. Buka IndexedDB MoKu dan baca semua foto */
    let photoMap=new Map();
    try{
      const db=await openMokuIDBV35();
      const allPh=await new Promise((resolve)=>{
        try{
          const tx=db.transaction("photos","readonly");
          const req=tx.objectStore("photos").getAll();
          req.onsuccess=()=>resolve(req.result||[]);
          req.onerror=()=>resolve([]);
        }catch(_){resolve([]);}
      });
      db.close();
      allPh.forEach(p=>{ if(p.id&&p.dataUrl) photoMap.set(p.id,p.dataUrl); });
    }catch(_){}

    items=mokuState.activities.map(act=>{
      const res=mokuState.results?.[act.id]||{};
      const photos=(res.photos||[]).map(p=>({
        ...p,
        dataUrl:photoMap.get(p.id)||p.dataUrl||null
      })).filter(p=>p.dataUrl);
      return{...act,photos};
    }).filter(a=>a.photos.length>0);
  }

  /* 3. Fallback: mobileSync.imported (postMessage iframe sync) */
  if(!items.length){
    ensureMobileSync();
    items=(data.mobileSync.imported||[]).filter(a=>(a.photos||[]).some(p=>p.dataUrl));
  }
  return items;
}
/* ── Render lembar foto per kegiatan di LPJ (async) ─────── */
async function renderMokuFotoSheetsV35(){
  const el=$("lpjFotoSheets");
  if(!el) return;

  const BUCKETS=["Foto Sebelum","Foto Proses","Foto Sesudah","Foto Daftar Hadir","Foto Nota/Kuitansi","Foto Serah Terima","Foto Lainnya"];
  const LABELS={"Foto Sebelum":"Kondisi Sebelum Kegiatan","Foto Proses":"Proses / Pelaksanaan Kegiatan","Foto Sesudah":"Kondisi Setelah Kegiatan","Foto Daftar Hadir":"Daftar Hadir Peserta","Foto Nota/Kuitansi":"Bukti Nota dan Kuitansi","Foto Serah Terima":"Serah Terima","Foto Lainnya":"Dokumentasi Lainnya"};

  function normBucket(type){
    if(!type) return "Foto Lainnya";
    const t=type.toLowerCase();
    if(t.includes("sebelum")) return "Foto Sebelum";
    if(t.includes("proses")||t.includes("saat")||t.includes("selama")) return "Foto Proses";
    if(t.includes("sesudah")||t.includes("setelah")) return "Foto Sesudah";
    if(t.includes("hadir")) return "Foto Daftar Hadir";
    if(t.includes("nota")||t.includes("kuitansi")) return "Foto Nota/Kuitansi";
    if(t.includes("serah")||t.includes("terima")) return "Foto Serah Terima";
    return "Foto Lainnya";
  }

  /* Tampilkan loading agar user tahu sedang memuat foto */
  el.innerHTML=`<div style="padding:16px 0;color:#64748b;font-size:13px;text-align:center">⏳ Memuat foto dokumentasi MoKu...</div>`;

  let items=[];
  try{ items=await getMokuItemsForLPJ(); }catch(_){}

  if(!items.length){ el.innerHTML=""; return; }

  el.innerHTML=items.map((act,i)=>{
    const groups={};
    (act.photos||[]).filter(p=>p.dataUrl).forEach(p=>{
      const b=normBucket(p.type);
      if(!groups[b]) groups[b]=[];
      groups[b].push(p);
    });
    const sections=BUCKETS.filter(b=>groups[b]?.length).map(b=>`
      <div class="foto-sheet-section">
        <div class="foto-sheet-sec-hdr">${esc(LABELS[b])}</div>
        <div class="foto-sheet-photos">
          ${groups[b].map(p=>`
            <div class="foto-sheet-photo">
              <img src="${p.dataUrl}" alt="${esc(p.type||'foto')}">
              <small>${esc(p.capturedAtText||p.timestamp||"")}</small>
            </div>
          `).join("")}
        </div>
      </div>`).join("");

    const meta=[act.hariTanggal,act.tempat].filter(Boolean).map(esc).join(" • ");
    return`
      ${i>0?'<div class="foto-sheet-page-break"></div>':""}
      <div class="foto-sheet-page">
        ${kopHTML()}
        <div class="foto-sheet-heading">
          <div class="foto-sheet-main-title">LEMBAR DOKUMENTASI KEGIATAN</div>
          <div class="foto-sheet-keg-name">${esc(act.nama||`Kegiatan ${i+1}`)}</div>
          ${meta?`<div class="foto-sheet-keg-meta">${meta}</div>`:""}
        </div>
        <div class="foto-sheet-sections">${sections}</div>
      </div>`;
  }).join("");
}

/* ── postMessage listener: auto-sync dari MoKu iframe ─────── */
(function initMokuIframeSync(){
  window.addEventListener("message", (e) => {
    if(!e.data || !e.data.type) return;
    const { type } = e.data;

    if(type === "moku-photo"){
      const { activity, photo } = e.data;
      if(!activity || !photo || !photo.dataUrl) return;
      ensureMobileSync();
      const imported = data.mobileSync.imported || [];
      let actEntry = imported.find(a => a.id === activity.id || a.nama === activity.nama);
      if(!actEntry){ actEntry = { ...activity, photos:[] }; imported.push(actEntry); }
      const existIdx = (actEntry.photos||[]).findIndex(p => p.id === photo.id);
      if(existIdx >= 0) actEntry.photos[existIdx] = { ...actEntry.photos[existIdx], ...photo };
      else { actEntry.photos = [...(actEntry.photos||[]), photo]; }
      data.mobileSync.imported = imported;
      try{ localStorage.setItem(STORE, JSON.stringify(data)); }catch(e2){}
      renderMobileDocumentationToLPJ();
      renderMokuFotoSheetsV35();
    }

    if(type === "moku-full-sync"){
      const newItems = e.data.results || [];
      if(!newItems.length) return;
      ensureMobileSync();
      const existing = data.mobileSync.imported || [];
      newItems.forEach(newAct => {
        const idx = existing.findIndex(a => a.id === newAct.id || a.nama === newAct.nama);
        if(idx >= 0){
          const exPhotos = existing[idx].photos || [];
          (newAct.photos||[]).forEach(np => {
            const ei = exPhotos.findIndex(ep => ep.id === np.id);
            if(ei < 0) exPhotos.push(np);
            else exPhotos[ei] = { ...exPhotos[ei], ...np };
          });
          existing[idx] = { ...existing[idx], ...newAct, photos: exPhotos };
        } else {
          existing.push(newAct);
        }
      });
      data.mobileSync.imported = existing;
      try{ localStorage.setItem(STORE, JSON.stringify(data)); }catch(e2){}
      renderMobileDocumentationToLPJ();
      renderMokuFotoSheetsV35();
    }
  });
})();

function renderMobileDocumentationToLPJ(){
  ensureMobileSync();
  const el = $("lpjDokumentasiList");
  if(!el) return;
  const items = data.mobileSync.imported || [];
  if(!items.length){
    el.innerHTML = '<div class="hint">Belum ada data dokumentasi MoKu yang di-import.</div>';
    return;
  }
  const rows = items.map((act,idx)=>{
    const photos = Array.isArray(act.photos) ? act.photos : [];
    const allCount = photos.length;
    return `<tr>
      <td class="col-no">${idx+1}</td>
      <td class="moku-activity-cell">
        <div class="moku-row-title">${esc(act.nama || ('Kegiatan '+(idx+1)))}</div>
        <div class="moku-row-meta">${esc(act.jenis || '-')} • ${esc(act.hariTanggal || '-')}</div>
        <div class="moku-row-meta">Lokasi: ${esc(act.tempat || '-')}</div>
        <div class="moku-row-meta">Petugas: ${esc(mokuPetugasTextV34(act))}</div>
        <div class="moku-row-meta">Nominal: ${typeof rupiah === "function" ? rupiah(Number(act.nominal || 0)) : esc(act.nominal || 0)}</div>
      </td>
      <td>${mokuPhotoCellV34(act,idx,"sebelum","Foto Sebelum")}</td>
      <td>${mokuPhotoCellV34(act,idx,"proses","Foto Proses")}</td>
      <td>${mokuPhotoCellV34(act,idx,"sesudah","Foto Sesudah")}</td>
      <td>${mokuPhotoCellV34(act,idx,"hadir","Foto Daftar Hadir")}</td>
      <td>${mokuPhotoCellV34(act,idx,"nota","Foto Nota/Kuitansi")}</td>
      <td class="moku-action-cell">
        <button type="button" class="moku-eye-btn all" onclick="openMokuPhotoViewerV34(${idx},'all')" title="Lihat semua foto">👁 <b>${allCount}</b></button>
        <button type="button" class="moku-delete-btn" onclick="deleteMokuActivityV34(${idx})" title="Hapus dokumentasi kegiatan">🗑</button>
      </td>
    </tr>`;
  }).join("");
  el.innerHTML = `<div class="moku-lpj-table-toolbar">
      <div>
        <b>Dokumentasi Kegiatan MoKu</b>
        <span>Foto disembunyikan agar laporan rapi. Klik ikon mata untuk melihat gambar.</span>
      </div>
      <span class="moku-lpj-total">${items.length} kegiatan • ${items.reduce((sum,a)=>sum+((a.photos||[]).length),0)} foto</span>
    </div>
    <div class="table-wrap moku-lpj-table-wrap">
      <table class="moku-lpj-table">
        <thead><tr>
          <th>No</th>
          <th>Kegiatan</th>
          <th>Foto Sebelum</th>
          <th>Foto Proses</th>
          <th>Foto Sesudah</th>
          <th>Foto Daftar Hadir</th>
          <th>Foto Nota/Kuitansi</th>
          <th>Aksi</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}


/* PATCH v1.12 - RAP 1 Tahun tanpa Tipe + RAP Bulanan Breakdown */
function ensureMonthlyBreakdown(){
  if(!data.pengajuan) data.pengajuan = clone(defaultData.pengajuan);
  if(!data.pengajuan.monthlyBreakdowns) data.pengajuan.monthlyBreakdowns = {};
  if(!data.pengajuan.selectedMonth) data.pengajuan.selectedMonth = "Januari 2026";
  if(data.pengajuan.monthlySelectedIndex === undefined || data.pengajuan.monthlySelectedIndex === null) data.pengajuan.monthlySelectedIndex = 0;
}
function monthlyKey(month, annualIndex){ return `${month}__${annualIndex}`; }
function getBreakdownRows(month, annualIndex){
  ensureMonthlyBreakdown();
  const key = monthlyKey(month, annualIndex);
  if(!Array.isArray(data.pengajuan.monthlyBreakdowns[key])) data.pengajuan.monthlyBreakdowns[key] = [];
  return data.pengajuan.monthlyBreakdowns[key];
}
function breakdownTotal(month, annualIndex){
  return getBreakdownRows(month, annualIndex).reduce((s,r)=>s+Number(r.jumlah||0),0);
}
function formatSelOptionV12(list, selected){
  return list.map(x=>`<option value="${escapeAttr(x)}" ${x===selected?"selected":""}>${esc(x)}</option>`).join("");
}
function normalizeRapV12(){
  normalizeRapV17();
  ensureMonthlyBreakdown();
  data.pengajuan.rap = (data.pengajuan.rap||[]).map(r=>{
    const kat=r.kategori||guessKategori(r.uraian||"");
    return {
      kategori:kat,
      subKategori:r.subKategori||guessSubKategori(kat,r.uraian||""),
      uraian:r.uraian||"",
      bulan:r.bulan||guessBulan(r.uraian||""),
      volume:r.volume||"1 Paket",
      jumlah:Number(r.jumlah||0),
      keterangan:r.keterangan||""
    };
  });
}
function renderRap(){
  normalizeRapV12();
  const tb=$("rapTable").querySelector("tbody");
  tb.innerHTML="";
  $("rapTable").classList.add("rap-wide-table");
  data.pengajuan.rap.forEach((r,i)=>{
    tb.insertAdjacentHTML("beforeend",`<tr>
      <td>${i+1}</td>
      <td><select class="mini-input select-compact" data-rap="${i},kategori">${formatSelOptionV12(KATEGORI_OPERASIONAL,r.kategori)}</select></td>
      <td><select class="mini-input select-compact" data-rap="${i},subKategori">${formatSelOptionV12(SUB_KATEGORI_MAP[r.kategori]||[],r.subKategori)}</select></td>
      <td><input class="mini-input" data-rap="${i},uraian" value="${escapeAttr(r.uraian)}"></td>
      <td><select class="mini-input select-compact" data-rap="${i},bulan">${formatSelOptionV12([RAP_MONTH_ALL,...RAP_MONTHS],r.bulan)}</select></td>
      <td><input class="mini-input" data-rap="${i},volume" value="${escapeAttr(r.volume)}"></td>
      <td><input class="mini-input" type="number" data-rap="${i},jumlah" value="${Number(r.jumlah||0)}"></td>
      <td><input class="mini-input" data-rap="${i},keterangan" value="${escapeAttr(r.keterangan)}"></td>
      <td><button class="delete" onclick="deleteRap(${i})">Hapus</button></td>
    </tr>`);
  });
  $("rapTotalCell").textContent=rupiah(totalRap());
  renderMonthlyRapSummary();
}
function updateRapFromInputs(){
  normalizeRapV12();
  document.querySelectorAll("[data-rap]").forEach(inp=>{
    let [i,k]=inp.dataset.rap.split(",");
    i=Number(i);
    if(!data.pengajuan.rap[i])return;
    let v=inp.value;
    if(k==="jumlah")v=Number(v||0);
    data.pengajuan.rap[i][k]=v;
    if(k==="kategori"){
      let row=data.pengajuan.rap[i];
      if(!(SUB_KATEGORI_MAP[v]||[]).includes(row.subKategori)) row.subKategori=(SUB_KATEGORI_MAP[v]||[""])[0];
    }
  });
}
function addRap(){
  updateRapFromInputs();
  data.pengajuan.rap.push({kategori:KATEGORI_OPERASIONAL[0],subKategori:SUB_KATEGORI_MAP[KATEGORI_OPERASIONAL[0]][0],uraian:"",bulan:"Januari 2026",volume:"1 Paket",jumlah:0,keterangan:""});
  localStorage.setItem(STORE,JSON.stringify(data));
  render();activateTab("rap");
}
function deleteRap(i){
  updateRapFromInputs();
  data.pengajuan.rap.splice(i,1);
  ensureMonthlyBreakdown();
  Object.keys(data.pengajuan.monthlyBreakdowns).forEach(k=>{ if(k.endsWith(`__${i}`)) delete data.pengajuan.monthlyBreakdowns[k]; });
  localStorage.setItem(STORE,JSON.stringify(data));
  render();activateTab("rap");
}
function getMonthlyRapRows(month){
  normalizeRapV12();
  const rows=[];
  data.pengajuan.rap.forEach((r,annualIndex)=>{
    if(r.bulan===month){
      rows.push({...r, annualIndex, jumlahBulanan:Number(r.jumlah||0), sumber:"Langsung"});
    }else if(r.bulan===RAP_MONTH_ALL&&RAP_MONTHS.includes(month)){
      rows.push({...r, annualIndex, jumlahBulanan:Math.round(Number(r.jumlah||0)/RAP_MONTHS.length), sumber:"Bagi rata"});
    }
  });
  return rows;
}
function selectMonthlyItem(annualIndex){
  ensureMonthlyBreakdown();
  data.pengajuan.monthlySelectedIndex=Number(annualIndex);
  localStorage.setItem(STORE,JSON.stringify(data));
  renderMonthlyRapSummary();
}
function addBreakdownRow(month, annualIndex){
  updateBreakdownFromInputs();
  const rows=getBreakdownRows(month, annualIndex);
  rows.push({tipe:"Belanja Barang/Material",uraian:"",volume:"1 Paket",jumlah:0,keterangan:""});
  localStorage.setItem(STORE,JSON.stringify(data));
  renderMonthlyRapSummary();
}
function deleteBreakdownRow(month, annualIndex, rowIndex){
  const rows=getBreakdownRows(month, annualIndex);
  rows.splice(rowIndex,1);
  localStorage.setItem(STORE,JSON.stringify(data));
  renderMonthlyRapSummary();
}
function updateBreakdownFromInputs(){
  ensureMonthlyBreakdown();
  document.querySelectorAll("[data-breakdown]").forEach(inp=>{
    const [monthEnc,annualIndex,rowIndex,key]=inp.dataset.breakdown.split("|");
    const month=decodeURIComponent(monthEnc);
    const rows=getBreakdownRows(month, Number(annualIndex));
    if(!rows[Number(rowIndex)]) return;
    let v=inp.value;
    if(key==="jumlah") v=Number(v||0);
    rows[Number(rowIndex)][key]=v;
  });
}
function renderMonthlyRapSummary(){
  ensureFullMonthOptionsV16();
  const el=$("monthlyRapSummary");
  if(!el) return;
  normalizeRapV12();
  const month=$("monthlyDocMonth")?.value || data.pengajuan.selectedMonth || "Januari 2026";
  data.pengajuan.selectedMonth=month;
  const rows=getMonthlyRapRows(month);
  if(rows.length && !rows.some(r=>r.annualIndex===Number(data.pengajuan.monthlySelectedIndex))) data.pengajuan.monthlySelectedIndex=rows[0].annualIndex;
  const selected=rows.find(r=>r.annualIndex===Number(data.pengajuan.monthlySelectedIndex)) || rows[0];
  const listHtml = `<div class="monthly-selected-wrap">
    ${rows.length?rows.map((r,i)=>{
      const bTotal=breakdownTotal(month,r.annualIndex), ok=bTotal===Number(r.jumlahBulanan||0);
      return `<div class="monthly-selected-card ${selected&&selected.annualIndex===r.annualIndex?'active':''}">
        <div>
          <strong>${i+1}. ${esc(r.uraian)||"Tanpa uraian"}</strong>
          <div class="monthly-card-meta">
            ${esc(r.kategori)}<br>
            ${esc(r.subKategori)} • ${esc(r.volume)} • ${esc(r.sumber)}<br>
            Anggaran Bulanan: <b>${rupiah(r.jumlahBulanan)}</b> • Breakdown: <b>${rupiah(bTotal)}</b>
            <span class="breakdown-status ${ok?'ok':'bad'}">${ok?'Sesuai':'Belum sesuai'}</span>
          </div>
        </div>
        <button class="secondary" onclick="selectMonthlyItem(${r.annualIndex})">Breakdown</button>
      </div>`;
    }).join(""):`<div class="panel"><p class="hint">Belum ada RAP pada bulan ${esc(month)}. Atur Bulan Pelaksanaan di RAP 1 Tahun.</p></div>`}
  </div>`;
  const detailHtml = selected ? renderBreakdownPanel(month, selected) : "";
  el.innerHTML = listHtml + detailHtml;
  if($("monthlyDocMonth")) $("monthlyDocMonth").value=month;
}
function renderBreakdownPanel(month, item){
  const rows=getBreakdownRows(month,item.annualIndex);
  const enc=encodeURIComponent(month);
  const total=breakdownTotal(month,item.annualIndex);
  const target=Number(item.jumlahBulanan||0);
  const ok=total===target;
  return `<div class="breakdown-panel">
    <div class="breakdown-head">
      <div>
        <h3 style="margin:0">Breakdown RAP Bulanan</h3>
        <p class="hint" style="margin:6px 0 0">${esc(item.uraian)} • ${esc(month)}</p>
      </div>
      <span class="breakdown-status ${ok?'ok':'bad'}">${ok?'TOTAL SESUAI':'TOTAL BELUM SESUAI'}</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>No</th><th>Tipe Operasional</th><th>Uraian Breakdown</th><th>Volume</th><th>Jumlah</th><th>Keterangan</th><th>Aksi</th></tr></thead>
        <tbody>
          ${rows.length?rows.map((r,i)=>`<tr>
            <td>${i+1}</td>
            <td><select class="mini-input select-compact" data-breakdown="${enc}|${item.annualIndex}|${i}|tipe">${formatSelOptionV12(TIPE_OPERASIONAL,r.tipe||"Belanja Barang/Material")}</select></td>
            <td><input class="mini-input" data-breakdown="${enc}|${item.annualIndex}|${i}|uraian" value="${escapeAttr(r.uraian||"")}"></td>
            <td><input class="mini-input" data-breakdown="${enc}|${item.annualIndex}|${i}|volume" value="${escapeAttr(r.volume||"1 Paket")}"></td>
            <td><input class="mini-input" type="number" data-breakdown="${enc}|${item.annualIndex}|${i}|jumlah" value="${Number(r.jumlah||0)}"></td>
            <td><input class="mini-input" data-breakdown="${enc}|${item.annualIndex}|${i}|keterangan" value="${escapeAttr(r.keterangan||"")}"></td>
            <td><button class="delete" onclick="deleteBreakdownRow('${month}',${item.annualIndex},${i})">Hapus</button></td>
          </tr>`).join(""):`<tr><td colspan="7">Belum ada breakdown. Klik Tambah Breakdown.</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="breakdown-total-line">
      <span>Target RAP Bulanan: <strong>${rupiah(target)}</strong></span>
      <span>Total Breakdown: <strong>${rupiah(total)}</strong></span>
      <span>Selisih: <strong>${rupiah(target-total)}</strong></span>
    </div>
    <div class="action-row">
      <button class="primary" onclick="addBreakdownRow('${month}',${item.annualIndex})">+ Tambah Breakdown</button>
      <button class="secondary" onclick="updateBreakdownFromInputs();localStorage.setItem(STORE,JSON.stringify(data));renderMonthlyRapSummary();">Simpan Breakdown</button>
    </div>
  </div>`;
}
function monthlyTotal(month){ return getMonthlyRapRows(month).reduce((s,r)=>s+Number(r.jumlahBulanan||0),0); }
function monthlyBreakdownTotal(month){ return getMonthlyRapRows(month).reduce((s,r)=>s+breakdownTotal(month,r.annualIndex),0); }
function docRap(){
  normalizeRapV12();
  return official(`<div class="title">RENCANA ANGGARAN PENGGUNAAN<br>BANTUAN OPERASIONAL RT</div><table><thead><tr><th>No</th><th>Uraian Kegiatan</th><th>Satuan/Volume</th><th>Rencana Anggaran</th><th>Keterangan</th></tr></thead><tbody>${data.pengajuan.rap.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.uraian)}<br><small>${esc(r.kategori)} - ${esc(r.subKategori)}<br>Bulan: ${esc(r.bulan)}</small></td><td>${esc(r.volume)}</td><td>${rupiah(r.jumlah)}</td><td>${esc(r.keterangan)}</td></tr>`).join("")}<tr><td colspan="3"><b>Jumlah</b></td><td><b>${rupiah(totalRap())}</b></td><td></td></tr></tbody></table><p style="text-align:right;margin-top:20px">Semarang, tanggal bulan tahun</p><p>Mengetahui,</p><div class="ttd-4"><div>Ketua RT ${data.master.rt}<div class="signature-space"></div>${data.master.ketua||"Nama Jelas"}</div><div>Bendahara RT ${data.master.rt}<div class="signature-space"></div>${data.master.bendahara||"Nama Jelas"}</div><div>Lurah ${data.master.kelurahan}<div class="signature-space"></div>${data.pengajuan.namaLurah||"Nama Jelas"}</div><div>Ketua RW ${data.master.rw}<div class="signature-space"></div>${data.pengajuan.namaKetuaRw||"Nama Jelas"}</div></div>`);
}
function docRapBulanan(){
  updateBreakdownFromInputs();
  const month=$("monthlyDocMonth")?.value||data.pengajuan.selectedMonth||"Januari 2026";
  data.pengajuan.selectedMonth=month;
  const monthly=getMonthlyRapRows(month);
  let no=1;
  const rowsHtml = monthly.map(item=>{
    const details=getBreakdownRows(month,item.annualIndex);
    if(details.length){
      return details.map(d=>`<tr><td>${no++}</td><td>${esc(item.uraian)}<br><small>${esc(item.kategori)} - ${esc(item.subKategori)}<br>Tipe: ${esc(d.tipe)}</small></td><td>${esc(d.volume||"1 Paket")}</td><td>${rupiah(d.jumlah)}</td><td>${esc(d.keterangan||item.keterangan)}</td></tr>`).join("");
    }
    return `<tr><td>${no++}</td><td>${esc(item.uraian)}<br><small>${esc(item.kategori)} - ${esc(item.subKategori)}<br>Belum dibreakdown</small></td><td>${esc(item.volume)}</td><td>${rupiah(item.jumlahBulanan)}</td><td>${esc(item.keterangan)}</td></tr>`;
  }).join("");
  return official(`<div class="title">RENCANA ANGGARAN PENGGUNAAN BULANAN<br>BANTUAN OPERASIONAL RT<br>BULAN ${esc(month).toUpperCase()}</div><table><thead><tr><th>No</th><th>Uraian Kegiatan / Breakdown</th><th>Satuan/Volume</th><th>Rencana Anggaran</th><th>Keterangan</th></tr></thead><tbody>${rowsHtml||`<tr><td colspan="5">Belum ada rencana kegiatan untuk bulan ${esc(month)}.</td></tr>`}<tr><td colspan="3"><b>Jumlah RAP Bulanan</b></td><td><b>${rupiah(monthlyTotal(month))}</b></td><td></td></tr><tr><td colspan="3"><b>Jumlah Breakdown</b></td><td><b>${rupiah(monthlyBreakdownTotal(month))}</b></td><td>${monthlyTotal(month)===monthlyBreakdownTotal(month)?"Sesuai":"Belum sesuai"}</td></tr></tbody></table><p style="text-align:right;margin-top:20px">Semarang, tanggal bulan tahun</p><div class="ttd-4"><div>Ketua RT ${data.master.rt}<div class="signature-space"></div>${data.master.ketua||"Nama Jelas"}</div><div>Bendahara RT ${data.master.rt}<div class="signature-space"></div>${data.master.bendahara||"Nama Jelas"}</div><div>Lurah ${data.master.kelurahan}<div class="signature-space"></div>${data.pengajuan.namaLurah||"Nama Jelas"}</div><div>Ketua RW ${data.master.rw}<div class="signature-space"></div>${data.pengajuan.namaKetuaRw||"Nama Jelas"}</div></div>`);
}
function docRbb(){
  updateBreakdownFromInputs();
  const m=data.master,month=$("monthlyDocMonth")?.value||data.pengajuan.selectedMonth||"Januari 2026",monthly=getMonthlyRapRows(month);
  let no=1;
  const rowsHtml=monthly.map(item=>{
    const details=getBreakdownRows(month,item.annualIndex);
    if(details.length){
      return details.map(d=>`<tr><td>${no++}</td><td>${esc(item.uraian)} - ${esc(d.uraian||d.tipe)}</td><td>${esc(d.volume||"1 Paket")}</td><td>${rupiah(d.jumlah)}</td><td>${esc(d.keterangan||item.keterangan)}</td></tr>`).join("");
    }
    return `<tr><td>${no++}</td><td>${esc(item.uraian)}</td><td>${esc(item.volume)}</td><td>${rupiah(item.jumlahBulanan)}</td><td>${esc(item.keterangan)}</td></tr>`;
  }).join("");
  const total=monthlyBreakdownTotal(month)||monthlyTotal(month);
  return official(`<div class="title">Pengambilan Operasional RT<br>Melalui Bank Jawa Tengah</div><table class="no-border"><tr><td style="width:160px">Nama Lembaga</td><td>: RT ${m.rt} RW ${m.rw}</td></tr><tr><td>Kelurahan</td><td>: ${m.kelurahan}</td></tr><tr><td>Kecamatan</td><td>: ${m.kecamatan}</td></tr><tr><td>Untuk Kegiatan Bulan</td><td>: ${esc(month)}</td></tr></table><br><table><tr><th>No.</th><th>Uraian Kegiatan</th><th>Satuan/Volume</th><th>Anggaran</th><th>Keterangan</th></tr>${rowsHtml||`<tr><td colspan="5">Belum ada kegiatan bulan ini.</td></tr>`}<tr><td colspan="3"><b>Jumlah</b></td><td><b>${rupiah(total)}</b></td><td></td></tr></table><p>Terbilang: ${terbilang(total).replace(/\s+/g," ")} Rupiah</p><div class="ttd-3"><div>Yang Mengambil<br>Ketua RT ${m.rt} RW ${m.rw}<div class="signature-space"></div>${m.ketua||"Nama Jelas"}</div><div>Bendahara<div class="signature-space"></div>${m.bendahara||"Nama Jelas"}</div><div>Mengetahui<br>Lurah ${m.kelurahan}<div class="signature-space"></div>${data.pengajuan.namaLurah||"Nama Jelas"}</div></div>`);
}
function previewDoc(type=currentDoc){
  updateBreakdownFromInputs();
  collectAll();
  if($("monthlyDocMonth")) data.pengajuan.selectedMonth=$("monthlyDocMonth").value;
  currentDoc=type;
  const map={permohonan:docPermohonan,rap:docRap,rapbulanan:docRapBulanan,ba:docBA,hadir:docHadir,sptjm:docSptjm,sk:docSK,rekening:docRekening,undangan:docUndangan,notulen:docNotulen};
  document.querySelectorAll(".doc-btn").forEach(b=>b.classList.toggle("active",b.dataset.doc===type));
  $("docOutput").innerHTML=(map[type]||docPermohonan)();
}


/* PATCH v1.14 - Fix RAP Bulanan: hide breakdown until clicked, input stable, buttons working */
function ensureMonthlyBreakdown(){
  if(!data.pengajuan) data.pengajuan = clone(defaultData.pengajuan);
  if(!data.pengajuan.monthlyBreakdowns) data.pengajuan.monthlyBreakdowns = {};
  if(!data.pengajuan.selectedMonth) data.pengajuan.selectedMonth = "Januari 2026";
  if(data.pengajuan.monthlySelectedIndex === undefined) data.pengajuan.monthlySelectedIndex = null;
  if(data.pengajuan.monthlyBreakdownOpen === undefined) data.pengajuan.monthlyBreakdownOpen = false;
}
function selectMonthlyItem(annualIndex){
  ensureMonthlyBreakdown();
  data.pengajuan.monthlySelectedIndex=Number(annualIndex);
  data.pengajuan.monthlyBreakdownOpen=true;
  localStorage.setItem(STORE,JSON.stringify(data));
  renderMonthlyRapSummary();
}
function closeMonthlyBreakdown(){
  ensureMonthlyBreakdown();
  data.pengajuan.monthlyBreakdownOpen=false;
  data.pengajuan.monthlySelectedIndex=null;
  localStorage.setItem(STORE,JSON.stringify(data));
  renderMonthlyRapSummary();
}
function updateBreakdownLiveStatus(){
  const month=$("monthlyDocMonth")?.value || data.pengajuan.selectedMonth || "Januari 2026";
  const idx=Number(data.pengajuan.monthlySelectedIndex);
  if(Number.isNaN(idx)) return;
  const item=getMonthlyRapRows(month).find(r=>r.annualIndex===idx);
  if(!item) return;
  const total=breakdownTotal(month,idx);
  const target=Number(item.jumlahBulanan||0);
  const diff=target-total;
  const totalEl=$("breakdownLiveTotal"), diffEl=$("breakdownLiveDiff"), statusEl=$("breakdownLiveStatus");
  if(totalEl) totalEl.textContent=rupiah(total);
  if(diffEl) diffEl.textContent=rupiah(diff);
  if(statusEl){
    statusEl.textContent=(diff===0)?"TOTAL SESUAI":"TOTAL BELUM SESUAI";
    statusEl.className="breakdown-status "+(diff===0?"ok":"bad");
  }
}
function renderMonthlyRapSummary(){
  ensureFullMonthOptionsV16();
  const el=$("monthlyRapSummary");
  if(!el) return;
  normalizeRapV12();
  ensureMonthlyBreakdown();
  const month=$("monthlyDocMonth")?.value || data.pengajuan.selectedMonth || "Januari 2026";
  if(month!==data.pengajuan.selectedMonth){
    data.pengajuan.monthlyBreakdownOpen=false;
    data.pengajuan.monthlySelectedIndex=null;
  }
  data.pengajuan.selectedMonth=month;
  const rows=getMonthlyRapRows(month);
  const selected=(data.pengajuan.monthlyBreakdownOpen)
    ? rows.find(r=>r.annualIndex===Number(data.pengajuan.monthlySelectedIndex))
    : null;

  const cards = rows.length ? rows.map((r,i)=>{
    const bTotal=breakdownTotal(month,r.annualIndex);
    const target=Number(r.jumlahBulanan||0);
    const ok=bTotal===target && target>0;
    const active=selected&&selected.annualIndex===r.annualIndex;
    return `<div class="monthly-selected-card ${active?'active':''}">
      <div class="monthly-card-main">
        <span class="monthly-index">${i+1}</span>
        <div class="monthly-card-title">${esc(r.uraian)||'Tanpa uraian kegiatan'}</div>
        <div class="monthly-card-category">${esc(r.kategori)}<br>${esc(r.subKategori)}</div>
        <div class="monthly-card-budget">Anggaran Bulanan<br><strong>${rupiah(target)}</strong></div>
        <div class="monthly-chip-row">
          <span class="monthly-chip">${esc(r.volume||'1 Paket')}</span>
          <span class="monthly-chip">${esc(r.sumber||'Langsung')}</span>
          <span class="monthly-chip ${ok?'ok':'bad'}">${ok?'Sesuai':'Belum sesuai'}</span>
        </div>
        <div class="breakdown-summary-inline">
          <span>Target: ${rupiah(target)}</span>
          <span class="${ok?'ok':'bad'}">Breakdown: ${rupiah(bTotal)}</span>
        </div>
      </div>
      <div class="monthly-card-action">
        <button type="button" class="secondary" onclick="selectMonthlyItem(${r.annualIndex})">${active?'Edit Breakdown':'Breakdown'}</button>
      </div>
    </div>`;
  }).join('') : `<div class="monthly-empty"><p class="hint">Belum ada RAP pada bulan ${esc(month)}. Atur Bulan Pelaksanaan di RAP 1 Tahun.</p></div>`;

  const detail = selected ? renderBreakdownPanel(month, selected) : `<div class="breakdown-panel is-hidden"></div>`;
  el.innerHTML = `<div class="monthly-summary-shell"><div class="monthly-cards-row">${cards}</div>${detail}</div>`;
  if($("monthlyDocMonth")) $("monthlyDocMonth").value=month;
}
function renderBreakdownPanel(month, item){
  const rows=getBreakdownRows(month,item.annualIndex);
  const enc=encodeURIComponent(month);
  const total=breakdownTotal(month,item.annualIndex);
  const target=Number(item.jumlahBulanan||0);
  const diff=target-total;
  const ok=diff===0;
  return `<div class="breakdown-panel">
    <div class="breakdown-head">
      <div>
        <h3 style="margin:0">Breakdown RAP Bulanan</h3>
        <div class="breakdown-subtitle"><b>${esc(item.uraian)}</b> • ${esc(month)}<br>${esc(item.kategori)} • ${esc(item.subKategori)}</div>
      </div>
      <div class="action-row">
        <span id="breakdownLiveStatus" class="breakdown-status ${ok?'ok':'bad'}">${ok?'TOTAL SESUAI':'TOTAL BELUM SESUAI'}</span>
        <button type="button" class="secondary" onclick="closeMonthlyBreakdown()">Tutup</button>
      </div>
    </div>
    <div class="breakdown-toolbar">
      <div class="hint">Isi rincian breakdown sesuai tipe operasional. Total breakdown harus sama dengan anggaran bulanan.</div>
      <div class="action-row">
        <button type="button" class="primary" onclick="addBreakdownRow('${month}',${item.annualIndex})">+ Tambah Breakdown</button>
        <button type="button" class="secondary" onclick="updateBreakdownFromInputs();localStorage.setItem(STORE,JSON.stringify(data));renderMonthlyRapSummary();">Simpan Breakdown</button>
      </div>
    </div>
    <div class="table-wrap">
      <table class="breakdown-table">
        <thead><tr><th>No</th><th>Tipe Operasional</th><th>Uraian Breakdown</th><th>Volume</th><th>Jumlah (Rp)</th><th>Keterangan</th><th>Aksi</th></tr></thead>
        <tbody>
          ${rows.length?rows.map((r,i)=>`<tr>
            <td>${i+1}</td>
            <td><select class="mini-input select-compact" data-breakdown="${enc}|${item.annualIndex}|${i}|tipe">${formatSelOptionV12(TIPE_OPERASIONAL,r.tipe||'Belanja Barang/Material')}</select></td>
            <td><input class="mini-input" data-breakdown="${enc}|${item.annualIndex}|${i}|uraian" value="${escapeAttr(r.uraian||'')}" placeholder="Contoh: Pembelian cat jalan"></td>
            <td><input class="mini-input" data-breakdown="${enc}|${item.annualIndex}|${i}|volume" value="${escapeAttr(r.volume||'1 Paket')}"></td>
            <td><input class="mini-input" type="number" data-breakdown="${enc}|${item.annualIndex}|${i}|jumlah" value="${Number(r.jumlah||0)}"></td>
            <td><input class="mini-input" data-breakdown="${enc}|${item.annualIndex}|${i}|keterangan" value="${escapeAttr(r.keterangan||'')}"></td>
            <td><button type="button" class="delete" onclick="deleteBreakdownRow('${month}',${item.annualIndex},${i})">Hapus</button></td>
          </tr>`).join(''):`<tr><td colspan="7">Belum ada breakdown. Klik Tambah Breakdown.</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="breakdown-summary-cards">
      <div class="breakdown-summary-card primary"><div class="label">Target RAP Bulanan</div><div class="value">${rupiah(target)}</div></div>
      <div class="breakdown-summary-card danger"><div class="label">Total Breakdown</div><div class="value" id="breakdownLiveTotal">${rupiah(total)}</div></div>
      <div class="breakdown-summary-card ${diff===0?'success':'danger'}"><div class="label">Selisih</div><div class="value" id="breakdownLiveDiff">${rupiah(diff)}</div></div>
      <div class="breakdown-summary-card status"><div class="label">Status</div><div class="value" style="font-size:16px;color:${ok?'#1b7f3a':'#9b1c1c'}">${ok?'TOTAL SUDAH SESUAI':'SEGERA SESUAIKAN TOTAL'}</div></div>
    </div>
  </div>`;
}
function previewMonthlyRapFromTab(){
  updateBreakdownFromInputs();
  previewDoc("rapbulanan");
  goPage("pengajuan");
  activateTab("dokumen");
  setTimeout(()=>previewDoc("rapbulanan"),50);
}
function printMonthlyRapFromTab(){
  updateBreakdownFromInputs();
  previewDoc("rapbulanan");
  setTimeout(()=>cleanPrint("doc"),120);
}
function previewMonthlyRbbFromTab(){
  updateBreakdownFromInputs();
  previewDoc("rbb");
  goPage("pengajuan");
  activateTab("dokumen");
  setTimeout(()=>previewDoc("rbb"),50);
}
function printMonthlyRbbFromTab(){
  updateBreakdownFromInputs();
  previewDoc("rbb");
  setTimeout(()=>cleanPrint("doc"),120);
}


/* PATCH v1.15 - RAP Tahunan memakai rentang Bulan Mulai s.d Bulan */
function monthIndexV15(month){
  return RAP_MONTHS.indexOf(month);
}
function monthRangeCountV15(startMonth,endMonth){
  const a=monthIndexV15(startMonth), b=monthIndexV15(endMonth);
  if(a<0||b<0) return 1;
  return Math.max(1,b-a+1);
}
function monthsInRangeV15(startMonth,endMonth){
  const a=monthIndexV15(startMonth), b=monthIndexV15(endMonth);
  if(a<0||b<0) return [startMonth||"Januari 2026"];
  const start=Math.min(a,b), end=Math.max(a,b);
  return RAP_MONTHS.slice(start,end+1);
}
function normalizeMonthRangeV15(row){
  if(!row.bulanMulai || !row.bulanSelesai){
    const old=row.bulan || "Januari 2026";
    if(old===RAP_MONTH_ALL || old==="Agustus-Desember 2026"){
      row.bulanMulai="Januari 2026";
      row.bulanSelesai="Desember 2026";
    }else{
      row.bulanMulai=old;
      row.bulanSelesai=old;
    }
  }
  if(monthIndexV15(row.bulanMulai)>monthIndexV15(row.bulanSelesai)){
    const tmp=row.bulanMulai;
    row.bulanMulai=row.bulanSelesai;
    row.bulanSelesai=tmp;
  }
  row.bulan = row.bulanMulai===row.bulanSelesai ? row.bulanMulai : `${row.bulanMulai} s.d ${row.bulanSelesai}`;
  return row;
}
function normalizeRapV15(){
  normalizeRapV17();
  ensureMonthlyBreakdown();
  data.pengajuan.rap = (data.pengajuan.rap||[]).map(r=>{
    let base;
    if(Array.isArray(r)){
      const kat=guessKategori(r[0]||"");
      base={kategori:kat,subKategori:guessSubKategori(kat,r[0]||""),uraian:r[0]||"",bulan:guessBulan(r[0]||""),volume:r[1]||"1 Paket",jumlah:Number(r[2]||0),keterangan:r[3]||""};
    }else{
      const kat=r.kategori||guessKategori(r.uraian||"");
      base={
        kategori:kat,
        subKategori:r.subKategori||guessSubKategori(kat,r.uraian||""),
        uraian:r.uraian||"",
        bulan:r.bulan||"Januari 2026",
        bulanMulai:r.bulanMulai,
        bulanSelesai:r.bulanSelesai,
        volume:r.volume||"1 Paket",
        jumlah:Number(r.jumlah||0),
        keterangan:r.keterangan||""
      };
    }
    return normalizeMonthRangeV15(base);
  });
}
function renderRap(){
  ensureFullMonthOptionsV16();
  normalizeRapV15();
  const tb=$("rapTable").querySelector("tbody");
  tb.innerHTML="";
  $("rapTable").classList.add("rap-wide-table");
  data.pengajuan.rap.forEach((r,i)=>{
    const count=monthRangeCountV15(r.bulanMulai,r.bulanSelesai);
    tb.insertAdjacentHTML("beforeend",`<tr>
      <td>${i+1}</td>
      <td><select class="mini-input select-compact" data-rap="${i},kategori">${formatSelOptionV12(KATEGORI_OPERASIONAL,r.kategori)}</select></td>
      <td><select class="mini-input select-compact" data-rap="${i},subKategori">${formatSelOptionV12(SUB_KATEGORI_MAP[r.kategori]||[],r.subKategori)}</select></td>
      <td><input class="mini-input" data-rap="${i},uraian" value="${escapeAttr(r.uraian)}"></td>
      <td class="range-month-cell"><select class="mini-input select-compact" data-rap="${i},bulanMulai">${formatSelOptionV12(RAP_MONTHS,r.bulanMulai)}</select></td>
      <td class="range-month-cell"><select class="mini-input select-compact" data-rap="${i},bulanSelesai">${formatSelOptionV12(RAP_MONTHS,r.bulanSelesai)}</select><div class="range-month-note">${count} bulan</div></td>
      <td><input class="mini-input" data-rap="${i},volume" value="${escapeAttr(r.volume)}"></td>
      <td><input class="mini-input" type="number" data-rap="${i},jumlah" value="${Number(r.jumlah||0)}"></td>
      <td><input class="mini-input" data-rap="${i},keterangan" value="${escapeAttr(r.keterangan)}"></td>
      <td><button type="button" class="delete" onclick="deleteRap(${i})">Hapus</button></td>
    </tr>`);
  });
  $("rapTotalCell").textContent=rupiah(totalRap());
  renderMonthlyRapSummary();
}
function updateRapFromInputs(){
  normalizeRapV15();
  document.querySelectorAll("[data-rap]").forEach(inp=>{
    let [i,k]=inp.dataset.rap.split(",");
    i=Number(i);
    if(!data.pengajuan.rap[i])return;
    let v=inp.value;
    if(k==="jumlah")v=Number(v||0);
    data.pengajuan.rap[i][k]=v;
    if(k==="kategori"){
      let row=data.pengajuan.rap[i];
      if(!(SUB_KATEGORI_MAP[v]||[]).includes(row.subKategori)) row.subKategori=(SUB_KATEGORI_MAP[v]||[""])[0];
    }
  });
  data.pengajuan.rap.forEach(r=>normalizeMonthRangeV15(r));
}
function addRap(){
  updateRapFromInputs();
  data.pengajuan.rap.push({
    kategori:KATEGORI_OPERASIONAL[0],
    subKategori:SUB_KATEGORI_MAP[KATEGORI_OPERASIONAL[0]][0],
    uraian:"",
    bulanMulai:"Januari 2026",
    bulanSelesai:"Januari 2026",
    bulan:"Januari 2026",
    volume:"1 Paket",
    jumlah:0,
    keterangan:""
  });
  localStorage.setItem(STORE,JSON.stringify(data));
  render();activateTab("rap");
}
function deleteRap(i){
  updateRapFromInputs();
  data.pengajuan.rap.splice(i,1);
  ensureMonthlyBreakdown();
  Object.keys(data.pengajuan.monthlyBreakdowns).forEach(k=>{ if(k.endsWith(`__${i}`)) delete data.pengajuan.monthlyBreakdowns[k]; });
  localStorage.setItem(STORE,JSON.stringify(data));
  render();activateTab("rap");
}
function getMonthlyRapRows(month){
  normalizeRapV15();
  const rows=[];
  data.pengajuan.rap.forEach((r,annualIndex)=>{
    const months=monthsInRangeV15(r.bulanMulai,r.bulanSelesai);
    if(months.includes(month)){
      const count=months.length;
      const jumlahBulanan=count>1 ? Math.round(Number(r.jumlah||0)/count) : Number(r.jumlah||0);
      rows.push({
        ...r,
        annualIndex,
        jumlahBulanan,
        sumber: count>1 ? `Bagi rata ${count} bulan` : "Langsung",
        rentangBulan:`${r.bulanMulai} s.d ${r.bulanSelesai}`
      });
    }
  });
  return rows;
}
function docRap(){
  normalizeRapV15();
  return official(`<div class="title">RENCANA ANGGARAN PENGGUNAAN<br>BANTUAN OPERASIONAL RT</div><table><thead><tr><th>No</th><th>Uraian Kegiatan</th><th>Rentang Bulan</th><th>Satuan/Volume</th><th>Rencana Anggaran</th><th>Keterangan</th></tr></thead><tbody>${data.pengajuan.rap.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.uraian)}<br><small>${esc(r.kategori)} - ${esc(r.subKategori)}</small></td><td>${esc(r.bulanMulai)} s.d ${esc(r.bulanSelesai)}</td><td>${esc(r.volume)}</td><td>${rupiah(r.jumlah)}</td><td>${esc(r.keterangan)}</td></tr>`).join("")}<tr><td colspan="4"><b>Jumlah</b></td><td><b>${rupiah(totalRap())}</b></td><td></td></tr></tbody></table><p style="text-align:right;margin-top:20px">Semarang, tanggal bulan tahun</p><p>Mengetahui,</p><div class="ttd-4"><div>Ketua RT ${data.master.rt}<div class="signature-space"></div>${data.master.ketua||"Nama Jelas"}</div><div>Bendahara RT ${data.master.rt}<div class="signature-space"></div>${data.master.bendahara||"Nama Jelas"}</div><div>Lurah ${data.master.kelurahan}<div class="signature-space"></div>${data.pengajuan.namaLurah||"Nama Jelas"}</div><div>Ketua RW ${data.master.rw}<div class="signature-space"></div>${data.pengajuan.namaKetuaRw||"Nama Jelas"}</div></div>`);
}


/* PATCH v1.16 - Bulan lengkap Januari s.d Desember */
function fullYearMonthsV16(){
  return ["Januari 2026","Februari 2026","Maret 2026","April 2026","Mei 2026","Juni 2026","Juli 2026","Agustus 2026","September 2026","Oktober 2026","November 2026","Desember 2026"];
}
function ensureFullMonthOptionsV16(){
  if(typeof RAP_MONTHS !== "undefined"){
    try{
      RAP_MONTHS.splice(0, RAP_MONTHS.length, ...fullYearMonthsV16());
    }catch(e){}
  }
  const sel=$("monthlyDocMonth");
  if(sel && sel.options.length < 12){
    const current=sel.value || data?.pengajuan?.selectedMonth || "Januari 2026";
    sel.innerHTML=fullYearMonthsV16().map(m=>`<option>${m}</option>`).join("");
    sel.value=fullYearMonthsV16().includes(current)?current:"Januari 2026";
  }
}


/* PATCH v1.17 - FIX pilihan Bulan Mulai / s.d Bulan agar tidak kembali sendiri */
function monthListV17(){
  return ["Januari 2026","Februari 2026","Maret 2026","April 2026","Mei 2026","Juni 2026","Juli 2026","Agustus 2026","September 2026","Oktober 2026","November 2026","Desember 2026"];
}
function ensureFullMonthOptionsV17(){
  const full=monthListV17();
  if(typeof RAP_MONTHS !== "undefined"){
    try{ RAP_MONTHS.splice(0,RAP_MONTHS.length,...full); }catch(e){}
  }
  const sel=$("monthlyDocMonth");
  if(sel){
    const current=sel.value || data?.pengajuan?.selectedMonth || "Januari 2026";
    if(sel.options.length!==12 || sel.options[0]?.textContent!=="Januari 2026"){
      sel.innerHTML=full.map(m=>`<option>${m}</option>`).join("");
    }
    sel.value=full.includes(current)?current:"Januari 2026";
  }
}
function monthIndexV15(month){
  ensureFullMonthOptionsV17();
  return monthListV17().indexOf(month);
}
function inferMonthRangeV17(row){
  const full=monthListV17();
  let start=row.bulanMulai;
  let end=row.bulanSelesai;
  const old=String(row.bulan||"").trim();

  if(!start || !end){
    if(old==="Januari-Desember 2026" || old==="Agustus-Desember 2026" || old===RAP_MONTH_ALL){
      start="Januari 2026"; end="Desember 2026";
    }else if(old.includes(" s.d ")){
      const parts=old.split(" s.d ").map(x=>x.trim());
      start=parts[0]; end=parts[1];
    }else if(full.includes(old)){
      start=old; end=old;
    }else{
      start="Januari 2026"; end="Januari 2026";
    }
  }

  if(!full.includes(start)) start="Januari 2026";
  if(!full.includes(end)) end=start;
  if(full.indexOf(start)>full.indexOf(end)){
    const tmp=start; start=end; end=tmp;
  }
  row.bulanMulai=start;
  row.bulanSelesai=end;
  row.bulan=start===end ? start : `${start} s.d ${end}`;
  return row;
}
function normalizeMonthRangeV15(row){
  return inferMonthRangeV17(row);
}
function monthRangeCountV15(startMonth,endMonth){
  const a=monthIndexV15(startMonth), b=monthIndexV15(endMonth);
  if(a<0||b<0) return 1;
  return Math.max(1,b-a+1);
}
function monthsInRangeV15(startMonth,endMonth){
  const full=monthListV17();
  const a=full.indexOf(startMonth), b=full.indexOf(endMonth);
  if(a<0||b<0) return [startMonth||"Januari 2026"];
  return full.slice(Math.min(a,b),Math.max(a,b)+1);
}
function normalizeRapV15(){
  ensureMonthlyBreakdown();
  ensureFullMonthOptionsV17();
  if(!data.pengajuan) data.pengajuan=clone(defaultData.pengajuan);
  data.pengajuan.rap=(data.pengajuan.rap||[]).map(r=>{
    let row;
    if(Array.isArray(r)){
      const uraian=r[0]||"";
      const kat=guessKategori(uraian);
      row={
        kategori:kat,
        subKategori:guessSubKategori(kat,uraian),
        uraian,
        bulan:r[4]||guessBulan(uraian)||"Januari 2026",
        bulanMulai:r.bulanMulai,
        bulanSelesai:r.bulanSelesai,
        volume:r[1]||"1 Paket",
        jumlah:Number(r[2]||0),
        keterangan:r[3]||""
      };
    }else{
      const uraian=r.uraian||"";
      const kat=r.kategori||guessKategori(uraian);
      row={
        kategori:kat,
        subKategori:r.subKategori||guessSubKategori(kat,uraian),
        uraian,
        bulan:r.bulan||"Januari 2026",
        bulanMulai:r.bulanMulai,
        bulanSelesai:r.bulanSelesai,
        volume:r.volume||"1 Paket",
        jumlah:Number(r.jumlah||0),
        keterangan:r.keterangan||""
      };
    }
    return inferMonthRangeV17(row);
  });
}
function renderRap(){
  ensureFullMonthOptionsV17();
  normalizeRapV15();
  const tb=$("rapTable").querySelector("tbody");
  tb.innerHTML="";
  $("rapTable").classList.add("rap-wide-table");
  data.pengajuan.rap.forEach((r,i)=>{
    const count=monthRangeCountV15(r.bulanMulai,r.bulanSelesai);
    tb.insertAdjacentHTML("beforeend",`<tr>
      <td>${i+1}</td>
      <td><select class="mini-input select-compact" data-rap="${i},kategori">${formatSelOptionV12(KATEGORI_OPERASIONAL,r.kategori)}</select></td>
      <td><select class="mini-input select-compact" data-rap="${i},subKategori">${formatSelOptionV12(SUB_KATEGORI_MAP[r.kategori]||[],r.subKategori)}</select></td>
      <td><input class="mini-input" data-rap="${i},uraian" value="${escapeAttr(r.uraian)}"></td>
      <td class="range-month-cell"><select class="mini-input select-compact" data-rap="${i},bulanMulai">${formatSelOptionV12(monthListV17(),r.bulanMulai)}</select></td>
      <td class="range-month-cell"><select class="mini-input select-compact" data-rap="${i},bulanSelesai">${formatSelOptionV12(monthListV17(),r.bulanSelesai)}</select><div class="range-month-note">${count} bulan</div></td>
      <td><input class="mini-input" data-rap="${i},volume" value="${escapeAttr(r.volume)}"></td>
      <td><input class="mini-input" type="number" data-rap="${i},jumlah" value="${Number(r.jumlah||0)}"></td>
      <td><input class="mini-input" data-rap="${i},keterangan" value="${escapeAttr(r.keterangan)}"></td>
      <td><button type="button" class="delete" onclick="deleteRap(${i})">Hapus</button></td>
    </tr>`);
  });
  $("rapTotalCell").textContent=rupiah(totalRap());
  renderMonthlyRapSummary();
}
function updateRapFromInputs(){
  ensureFullMonthOptionsV17();
  if(!data.pengajuan) data.pengajuan=clone(defaultData.pengajuan);
  if(!Array.isArray(data.pengajuan.rap)) data.pengajuan.rap=[];

  document.querySelectorAll("[data-rap]").forEach(inp=>{
    let [i,k]=inp.dataset.rap.split(",");
    i=Number(i);
    if(!data.pengajuan.rap[i]){
      data.pengajuan.rap[i]={kategori:KATEGORI_OPERASIONAL[0],subKategori:SUB_KATEGORI_MAP[KATEGORI_OPERASIONAL[0]][0],uraian:"",bulanMulai:"Januari 2026",bulanSelesai:"Januari 2026",bulan:"Januari 2026",volume:"1 Paket",jumlah:0,keterangan:""};
    }
    let row=data.pengajuan.rap[i];
    if(Array.isArray(row)){
      const uraian=row[0]||"";
      const kat=guessKategori(uraian);
      row=data.pengajuan.rap[i]={kategori:kat,subKategori:guessSubKategori(kat,uraian),uraian,bulan:guessBulan(uraian)||"Januari 2026",volume:row[1]||"1 Paket",jumlah:Number(row[2]||0),keterangan:row[3]||""};
    }
    let v=inp.value;
    if(k==="jumlah") v=Number(v||0);
    row[k]=v;
    if(k==="kategori"){
      if(!(SUB_KATEGORI_MAP[v]||[]).includes(row.subKategori)) row.subKategori=(SUB_KATEGORI_MAP[v]||[""])[0];
    }
  });

  data.pengajuan.rap=data.pengajuan.rap.map(r=>inferMonthRangeV17(r));
}
function addRap(){
  updateRapFromInputs();
  data.pengajuan.rap.push({
    kategori:KATEGORI_OPERASIONAL[0],
    subKategori:SUB_KATEGORI_MAP[KATEGORI_OPERASIONAL[0]][0],
    uraian:"",
    bulanMulai:"Januari 2026",
    bulanSelesai:"Januari 2026",
    bulan:"Januari 2026",
    volume:"1 Paket",
    jumlah:0,
    keterangan:""
  });
  localStorage.setItem(STORE,JSON.stringify(data));
  render();activateTab("rap");
}
function getMonthlyRapRows(month){
  normalizeRapV15();
  const rows=[];
  data.pengajuan.rap.forEach((r,annualIndex)=>{
    const months=monthsInRangeV15(r.bulanMulai,r.bulanSelesai);
    if(months.includes(month)){
      const count=months.length;
      const jumlahBulanan=count>1 ? Math.round(Number(r.jumlah||0)/count) : Number(r.jumlah||0);
      rows.push({
        ...r,
        annualIndex,
        jumlahBulanan,
        sumber: count>1 ? `Bagi rata ${count} bulan` : "Langsung",
        rentangBulan:`${r.bulanMulai} s.d ${r.bulanSelesai}`
      });
    }
  });
  return rows;
}
function renderMonthlyRapSummary(){
  ensureFullMonthOptionsV17();
  const el=$("monthlyRapSummary");
  if(!el) return;
  normalizeRapV15();
  ensureMonthlyBreakdown();
  const month=$("monthlyDocMonth")?.value || data.pengajuan.selectedMonth || "Januari 2026";
  if(month!==data.pengajuan.selectedMonth){
    data.pengajuan.monthlyBreakdownOpen=false;
    data.pengajuan.monthlySelectedIndex=null;
  }
  data.pengajuan.selectedMonth=month;
  const rows=getMonthlyRapRows(month);
  const selected=(data.pengajuan.monthlyBreakdownOpen)
    ? rows.find(r=>r.annualIndex===Number(data.pengajuan.monthlySelectedIndex))
    : null;

  const cards = rows.length ? rows.map((r,i)=>{
    const bTotal=breakdownTotal(month,r.annualIndex);
    const target=Number(r.jumlahBulanan||0);
    const ok=bTotal===target && target>0;
    const active=selected&&selected.annualIndex===r.annualIndex;
    return `<div class="monthly-selected-card ${active?'active':''}">
      <div class="monthly-card-main">
        <span class="monthly-index">${i+1}</span>
        <div class="monthly-card-title">${esc(r.uraian)||'Tanpa uraian kegiatan'}</div>
        <div class="monthly-card-category">${esc(r.kategori)}<br>${esc(r.subKategori)}</div>
        <div class="monthly-card-budget">Anggaran Bulanan<br><strong>${rupiah(target)}</strong></div>
        <div class="monthly-chip-row">
          <span class="monthly-chip">${esc(r.volume||'1 Paket')}</span>
          <span class="monthly-chip">${esc(r.sumber||'Langsung')}</span>
          <span class="monthly-chip">${esc(r.rentangBulan)}</span>
          <span class="monthly-chip ${ok?'ok':'bad'}">${ok?'Sesuai':'Belum sesuai'}</span>
        </div>
        <div class="breakdown-summary-inline">
          <span>Target: ${rupiah(target)}</span>
          <span class="${ok?'ok':'bad'}">Breakdown: ${rupiah(bTotal)}</span>
        </div>
      </div>
      <div class="monthly-card-action">
        <button type="button" class="secondary" onclick="selectMonthlyItem(${r.annualIndex})">${active?'Edit Breakdown':'Breakdown'}</button>
      </div>
    </div>`;
  }).join('') : `<div class="monthly-empty"><p class="hint">Belum ada RAP pada bulan ${esc(month)}. Atur Bulan Mulai s.d Bulan di RAP 1 Tahun.</p></div>`;

  const detail = selected ? renderBreakdownPanel(month, selected) : `<div class="breakdown-panel is-hidden"></div>`;
  el.innerHTML = `<div class="monthly-summary-shell"><div class="monthly-cards-row">${cards}</div>${detail}</div>`;
  if($("monthlyDocMonth")) $("monthlyDocMonth").value=month;
}


/* PATCH v1.18 - Perbaikan logika RAP Bulanan, Volume, Tanggal, Nama TTD, Notifikasi Premium, Sisa Anggaran */
function parseVolumeV18(text){
  const raw=String(text||"1 Paket").trim();
  const m=raw.match(/(\d+(?:[.,]\d+)?)/);
  const qty=m?Number(m[1].replace(",",".")):1;
  let unit=raw.replace(/(\d+(?:[.,]\d+)?)/,"").trim();
  unit=unit.replace(/^x\s*/i,"").trim();
  if(!unit) unit="Paket";
  return {qty:isNaN(qty)?1:qty, unit};
}
function formatNumberV18(n){
  const val=Number(n||0);
  if(Math.abs(val-Math.round(val))<0.0001) return String(Math.round(val));
  return val.toFixed(2).replace(/\.?0+$/,"").replace(".",",");
}
function formatVolumeV18(qty, unit){ return `${formatNumberV18(qty)} ${unit||"Paket"}`; }
function unitPriceV18(row){
  const v=parseVolumeV18(row.volume);
  if(!v.qty) return Number(row.jumlah||0);
  return Number(row.jumlah||0)/v.qty;
}
function allocatedMonthIndexesV18(totalQty,count){
  const qty=Math.max(0,Math.floor(Number(totalQty||0)));
  if(qty<=0) return new Set();
  if(qty>=count) return null;
  const set=new Set();
  if(qty===1){ set.add(0); return set; }
  for(let k=0;k<qty;k++) set.add(Math.round(k*(count-1)/(qty-1)));
  return set;
}
function monthlyQtyForRowV18(row,month){
  const months=monthsInRangeV15(row.bulanMulai,row.bulanSelesai);
  const idx=months.indexOf(month);
  if(idx<0) return 0;
  const v=parseVolumeV18(row.volume);
  const count=months.length||1;
  if(v.qty<=0) return 0;
  if(Number.isInteger(v.qty) && v.qty<count){
    const selected=allocatedMonthIndexesV18(v.qty,count);
    return selected && selected.has(idx) ? 1 : 0;
  }
  return v.qty/count;
}
function monthlyAmountForRowV18(row,month){
  const qty=monthlyQtyForRowV18(row,month);
  if(qty<=0) return 0;
  return Math.round(unitPriceV18(row)*qty);
}
function annualBreakdownTotalV18(annualIndex){
  ensureMonthlyBreakdown();
  let total=0;
  Object.keys(data.pengajuan.monthlyBreakdowns||{}).forEach(k=>{
    const parts=k.split("__");
    if(Number(parts[1])===Number(annualIndex)){
      const rows=data.pengajuan.monthlyBreakdowns[k]||[];
      total += rows.reduce((s,r)=>s+Number(r.jumlah||0),0);
    }
  });
  return total;
}
function todaySemarangV18(){
  const months=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const d=new Date();
  return `Semarang, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function safeNameV18(name){
  const s=String(name||"").trim();
  return s || "................................";
}
function normalizeRapV18(){
  normalizeRapV15();
  data.pengajuan.rap=(data.pengajuan.rap||[]).map(r=>{
    if(!r.volume) r.volume="1 Paket";
    return normalizeMonthRangeV15(r);
  });
}
function renderRap(){
  ensureFullMonthOptionsV17();
  normalizeRapV18();
  const tb=$("rapTable").querySelector("tbody");
  tb.innerHTML="";
  $("rapTable").classList.add("rap-wide-table");
  data.pengajuan.rap.forEach((r,i)=>{
    const count=monthRangeCountV15(r.bulanMulai,r.bulanSelesai);
    const ter=annualBreakdownTotalV18(i);
    const sisa=Number(r.jumlah||0)-ter;
    const cls=sisa===0?"good":(sisa>0?"warning":"danger");
    tb.insertAdjacentHTML("beforeend",`<tr>
      <td>${i+1}</td>
      <td><select class="mini-input select-compact" data-rap="${i},kategori">${formatSelOptionV12(KATEGORI_OPERASIONAL,r.kategori)}</select></td>
      <td><select class="mini-input select-compact" data-rap="${i},subKategori">${formatSelOptionV12(SUB_KATEGORI_MAP[r.kategori]||[],r.subKategori)}</select></td>
      <td><input class="mini-input" data-rap="${i},uraian" value="${escapeAttr(r.uraian)}"></td>
      <td class="range-month-cell"><select class="mini-input select-compact" data-rap="${i},bulanMulai">${formatSelOptionV12(monthListV17(),r.bulanMulai)}</select></td>
      <td class="range-month-cell"><select class="mini-input select-compact" data-rap="${i},bulanSelesai">${formatSelOptionV12(monthListV17(),r.bulanSelesai)}</select><div class="range-month-note">${count} bulan</div></td>
      <td><input class="mini-input" data-rap="${i},volume" value="${escapeAttr(r.volume)}" placeholder="Contoh: 2 Kegiatan / 12 Bulan"></td>
      <td><input class="mini-input" type="number" data-rap="${i},jumlah" value="${Number(r.jumlah||0)}"></td>
      <td class="unit-price-cell">${rupiah(unitPriceV18(r))}</td>
      <td class="budget-progress-cell">${rupiah(ter)}</td>
      <td class="budget-progress-cell ${cls}">${rupiah(sisa)}</td>
      <td><input class="mini-input" data-rap="${i},keterangan" value="${escapeAttr(r.keterangan)}"></td>
      <td><button type="button" class="delete" onclick="deleteRap(${i})">Hapus</button></td>
    </tr>`);
  });
  $("rapTotalCell").textContent=rupiah(totalRap());
  renderMonthlyRapSummary();
}
function getMonthlyRapRows(month){
  normalizeRapV18();
  const rows=[];
  data.pengajuan.rap.forEach((r,annualIndex)=>{
    const months=monthsInRangeV15(r.bulanMulai,r.bulanSelesai);
    if(months.includes(month)){
      const qty=monthlyQtyForRowV18(r,month);
      const amount=monthlyAmountForRowV18(r,month);
      if(qty>0 && amount>0){
        const v=parseVolumeV18(r.volume);
        rows.push({...r,annualIndex,volumeBulanan:formatVolumeV18(qty,v.unit),qtyBulanan:qty,jumlahBulanan:amount,sumber:months.length>1?`Otomatis ${formatVolumeV18(v.qty,v.unit)} / ${months.length} bulan`:"Langsung",rentangBulan:`${r.bulanMulai} s.d ${r.bulanSelesai}`});
      }
    }
  });
  return rows;
}


function renderMonthlyRapSummary(){
  ensureFullMonthOptionsV17();
  const el=$("monthlyRapSummary");
  if(!el) return;
  normalizeRapV18();
  ensureMonthlyBreakdown();
  const month=$("monthlyDocMonth")?.value || data.pengajuan.selectedMonth || "Januari 2026";
  if(month!==data.pengajuan.selectedMonth){
    data.pengajuan.monthlyBreakdownOpen=false;
    data.pengajuan.monthlySelectedIndex=null;
  }
  data.pengajuan.selectedMonth=month;
  const rows=getMonthlyRapRows(month);
  const selected=(data.pengajuan.monthlyBreakdownOpen) ? rows.find(r=>r.annualIndex===Number(data.pengajuan.monthlySelectedIndex)) : null;
  const cards = rows.length ? rows.map((r,i)=>{
    const bTotal=breakdownTotal(month,r.annualIndex);
    const target=Number(r.jumlahBulanan||0);
    const annualTer=annualBreakdownTotalV18(r.annualIndex);
    const annualSisa=Number(r.jumlah||0)-annualTer;
    const ok=bTotal===target && target>0;
    const active=selected&&selected.annualIndex===r.annualIndex;
    return `<div class="monthly-selected-card ${active?'active':''}">
      <div class="monthly-card-main">
        <span class="monthly-index">${i+1}</span>
        <div class="monthly-card-title">${esc(r.uraian)||'Tanpa uraian kegiatan'}</div>
        <div class="monthly-card-category">${esc(r.kategori)}<br>${esc(r.subKategori)}</div>
        <div class="monthly-card-budget">Anggaran Bulanan<br><strong>${rupiah(target)}</strong></div>
        <div class="monthly-chip-row">
          <span class="monthly-chip info">Volume Bulanan: ${esc(r.volumeBulanan)}</span>
          <span class="monthly-chip">${esc(r.sumber||'Langsung')}</span>
          <span class="monthly-chip">${esc(r.rentangBulan)}</span>
          <span class="monthly-chip ${ok?'ok':'bad'}">${ok?'Sesuai':'Belum sesuai'}</span>
        </div>
        <div class="breakdown-summary-inline">
          <span>Breakdown bulan ini: ${rupiah(bTotal)}</span>
          <span>Sisa RAP Tahunan: ${rupiah(annualSisa)}</span>
        </div>
      </div>
      <div class="monthly-card-action">
        <button type="button" class="secondary" onclick="selectMonthlyItem(${r.annualIndex})">${active?'Edit Breakdown':'Breakdown'}</button>
      </div>
    </div>`;
  }).join('') : `<div class="monthly-empty"><p class="hint">Belum ada RAP pada bulan ${esc(month)}. Cek Total Satuan/Volume dan rentang Bulan Mulai s.d Bulan di RAP 1 Tahun.</p></div>`;
  const detail = selected ? renderBreakdownPanel(month, selected) : `<div class="breakdown-panel is-hidden"></div>`;
  el.innerHTML = `<div class="monthly-summary-shell"><div class="monthly-cards-row">${cards}</div>${detail}</div>`;
  if($("monthlyDocMonth")) $("monthlyDocMonth").value=month;
}
function renderBreakdownPanel(month, item){
  const rows=getBreakdownRows(month,item.annualIndex);
  const enc=encodeURIComponent(month);
  const total=breakdownTotal(month,item.annualIndex);
  const target=Number(item.jumlahBulanan||0);
  const diff=target-total;
  const ok=diff===0;
  const notice=`<div class="premium-notice ${ok?'ok':'bad'}">
    <div class="notice-icon">${ok?'✓':'!'}</div>
    <div>
      <div class="notice-title">${ok?'Breakdown sudah sesuai':'Breakdown perlu disesuaikan'}</div>
      <div class="notice-body">${ok?'Total breakdown bulan ini sudah sama dengan target anggaran bulanan.':'Selisih masih '+rupiah(diff)+'. Sesuaikan nominal rincian agar sama dengan target RAP Bulanan.'}</div>
    </div>
  </div>`;
  return `<div class="breakdown-panel">
    <div class="breakdown-head">
      <div>
        <h3 style="margin:0">Breakdown RAP Bulanan</h3>
        <div class="breakdown-subtitle"><b>${esc(item.uraian)}</b> • ${esc(month)}<br>Volume bulan ini: <b>${esc(item.volumeBulanan)}</b> • Target: <b>${rupiah(target)}</b></div>
      </div>
      <div class="action-row">
        <span id="breakdownLiveStatus" class="breakdown-status ${ok?'ok':'bad'}">${ok?'TOTAL SESUAI':'TOTAL BELUM SESUAI'}</span>
        <button type="button" class="secondary" onclick="closeMonthlyBreakdown()">Tutup</button>
      </div>
    </div>
    ${notice}
    <div class="breakdown-toolbar">
      <div class="hint">Isi rincian breakdown sesuai tipe operasional. Total breakdown harus sama dengan target anggaran bulanan.</div>
      <div class="action-row">
        <button type="button" class="primary" onclick="addBreakdownRow('${month}',${item.annualIndex})">+ Tambah Breakdown</button>
        <button type="button" class="secondary" onclick="updateBreakdownFromInputs();localStorage.setItem(STORE,JSON.stringify(data));renderMonthlyRapSummary();">Simpan Breakdown</button>
      </div>
    </div>
    <div class="table-wrap">
      <table class="breakdown-table">
        <thead><tr><th>No</th><th>Tipe Operasional</th><th>Uraian Breakdown</th><th>Volume</th><th>Jumlah (Rp)</th><th>Keterangan</th><th>Aksi</th></tr></thead>
        <tbody>
          ${rows.length?rows.map((r,i)=>`<tr>
            <td>${i+1}</td>
            <td><select class="mini-input select-compact" data-breakdown="${enc}|${item.annualIndex}|${i}|tipe">${formatSelOptionV12(TIPE_OPERASIONAL,r.tipe||'Belanja Barang/Material')}</select></td>
            <td><input class="mini-input" data-breakdown="${enc}|${item.annualIndex}|${i}|uraian" value="${escapeAttr(r.uraian||'')}" placeholder="Contoh: Pembelian konsumsi kerja bakti"></td>
            <td><input class="mini-input" data-breakdown="${enc}|${item.annualIndex}|${i}|volume" value="${escapeAttr(r.volume||item.volumeBulanan||'1 Paket')}"></td>
            <td><input class="mini-input" type="number" data-breakdown="${enc}|${item.annualIndex}|${i}|jumlah" value="${Number(r.jumlah||0)}"></td>
            <td><input class="mini-input" data-breakdown="${enc}|${item.annualIndex}|${i}|keterangan" value="${escapeAttr(r.keterangan||'')}"></td>
            <td><button type="button" class="delete" onclick="deleteBreakdownRow('${month}',${item.annualIndex},${i})">Hapus</button></td>
          </tr>`).join(''):`<tr><td colspan="7">Belum ada breakdown. Klik Tambah Breakdown.</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="breakdown-summary-cards">
      <div class="breakdown-summary-card neutral"><div class="label">Volume Bulanan</div><div class="value">${esc(item.volumeBulanan)}</div></div>
      <div class="breakdown-summary-card primary"><div class="label">Target RAP Bulanan</div><div class="value">${rupiah(target)}</div></div>
      <div class="breakdown-summary-card danger"><div class="label">Total Breakdown</div><div class="value" id="breakdownLiveTotal">${rupiah(total)}</div></div>
      <div class="breakdown-summary-card ${diff===0?'success':'danger'}"><div class="label">Selisih</div><div class="value" id="breakdownLiveDiff">${rupiah(diff)}</div></div>
    </div>
  </div>`;
}
function updateBreakdownLiveStatus(){
  const month=$("monthlyDocMonth")?.value || data.pengajuan.selectedMonth || "Januari 2026";
  const idx=Number(data.pengajuan.monthlySelectedIndex);
  if(Number.isNaN(idx)) return;
  const item=getMonthlyRapRows(month).find(r=>r.annualIndex===idx);
  if(!item) return;
  const total=breakdownTotal(month,idx);
  const target=Number(item.jumlahBulanan||0);
  const diff=target-total;
  const totalEl=$("breakdownLiveTotal"), diffEl=$("breakdownLiveDiff"), statusEl=$("breakdownLiveStatus");
  if(totalEl) totalEl.textContent=rupiah(total);
  if(diffEl) diffEl.textContent=rupiah(diff);
  if(statusEl){
    statusEl.textContent=(diff===0)?"TOTAL SESUAI":"TOTAL BELUM SESUAI";
    statusEl.className="breakdown-status "+(diff===0?"ok":"bad");
  }
}


function getMonthlyFlattenedRows(month){
  const monthly=getMonthlyRapRows(month);
  const rows=[];
  monthly.forEach(item=>{
    const details=getBreakdownRows(month,item.annualIndex);
    if(details.length){
      details.forEach((d,idx)=>rows.push({
        annualIndex:item.annualIndex,parent:item,no:rows.length+1,
        tipe:d.tipe||'Belanja Barang/Material',
        uraian:d.uraian||item.uraian,
        volume:d.volume||item.volumeBulanan||'1 Paket',
        jumlah:Number(d.jumlah||0),
        keterangan:d.keterangan||item.keterangan||'',
        fromBreakdown:true,seq:idx+1
      }));
    } else {
      rows.push({
        annualIndex:item.annualIndex,parent:item,no:rows.length+1,
        tipe:'Belum dibreakdown',uraian:item.uraian,
        volume:item.volumeBulanan||item.volume||'1 Paket',
        jumlah:Number(item.jumlahBulanan||0),
        keterangan:item.keterangan||'',fromBreakdown:false,seq:1
      });
    }
  });
  return rows;
}
function docRap(){
  normalizeRapV18();
  return official(`<div class="title">RENCANA ANGGARAN PENGGUNAAN<br>BANTUAN OPERASIONAL RT</div>
  <table><thead><tr><th>No</th><th>Uraian Kegiatan</th><th>Rentang Bulan</th><th>Total Satuan/Volume</th><th>Rencana Anggaran</th><th>Keterangan</th></tr></thead><tbody>${data.pengajuan.rap.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.uraian)}<br><small>${esc(r.kategori)} - ${esc(r.subKategori)}</small></td><td>${esc(r.bulanMulai)} s.d ${esc(r.bulanSelesai)}</td><td>${esc(r.volume)}</td><td>${rupiah(r.jumlah)}</td><td>${esc(r.keterangan)}</td></tr>`).join("")}<tr><td colspan="4"><b>Jumlah</b></td><td><b>${rupiah(totalRap())}</b></td><td></td></tr></tbody></table>
  <p style="text-align:right;margin-top:20px">${todaySemarangV18()}</p>
  <p>Mengetahui,</p>
  <div class="ttd-4"><div>Ketua RT ${data.master.rt}<div class="signature-space"></div>${safeNameV18(data.master.ketua)}</div><div>Bendahara RT ${data.master.rt}<div class="signature-space"></div>${safeNameV18(data.master.bendahara)}</div><div>Lurah ${data.master.kelurahan}<div class="signature-space"></div>${safeNameV18(data.pengajuan.namaLurah)}</div><div>Ketua RW ${data.master.rw}<div class="signature-space"></div>${safeNameV18(data.pengajuan.namaKetuaRw)}</div></div>`);
}
function docRapBulanan(){
  updateBreakdownFromInputs();
  const month=$("monthlyDocMonth")?.value||data.pengajuan.selectedMonth||"Januari 2026";
  data.pengajuan.selectedMonth=month;
  const rows=getMonthlyFlattenedRows(month);
  const total=rows.reduce((s,r)=>s+Number(r.jumlah||0),0);
  const tbody=rows.length ? rows.map((r,i)=>`<tr>
    <td>${i+1}</td>
    <td>${esc(r.parent.uraian)}<br><small>${esc(r.parent.kategori)} - ${esc(r.parent.subKategori)}<br>Tipe: ${esc(r.tipe)}</small></td>
    <td>${esc(r.uraian)}</td>
    <td>${esc(r.volume)}</td>
    <td>${rupiah(r.jumlah)}</td>
    <td>${esc(r.keterangan)}</td>
  </tr>`).join('') : `<tr><td colspan="6">Belum ada rencana kegiatan untuk bulan ${esc(month)}.</td></tr>`;
  return official(`<div class="title">RENCANA ANGGARAN PENGGUNAAN BULANAN<br>BANTUAN OPERASIONAL RT<br>BULAN ${esc(month).toUpperCase()}</div>
    <table><thead><tr><th>No</th><th>Kegiatan / Tipe Operasional</th><th>Uraian Breakdown</th><th>Satuan/Volume Bulanan</th><th>Rencana Anggaran</th><th>Keterangan</th></tr></thead>
    <tbody>${tbody}<tr><td colspan="4"><b>Jumlah RAP Bulanan</b></td><td><b>${rupiah(total)}</b></td><td></td></tr></tbody></table>
    <p style="text-align:right;margin-top:20px">${todaySemarangV18()}</p>
    <div class="ttd-4"><div>Ketua RT ${data.master.rt}<div class="signature-space"></div>${safeNameV18(data.master.ketua)}</div><div>Bendahara RT ${data.master.rt}<div class="signature-space"></div>${safeNameV18(data.master.bendahara)}</div><div>Lurah ${data.master.kelurahan}<div class="signature-space"></div>${safeNameV18(data.pengajuan.namaLurah)}</div><div>Ketua RW ${data.master.rw}<div class="signature-space"></div>${safeNameV18(data.pengajuan.namaKetuaRw)}</div></div>`);
}
function docRbb(){
  updateBreakdownFromInputs();
  const m=data.master;
  const month=$("monthlyDocMonth")?.value||data.pengajuan.selectedMonth||"Januari 2026";
  const rows=getMonthlyFlattenedRows(month);
  const total=rows.reduce((s,r)=>s+Number(r.jumlah||0),0);
  const tbody=rows.length ? rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.parent.uraian)} - ${esc(r.uraian)}</td><td>${esc(r.volume)}</td><td>${rupiah(r.jumlah)}</td><td>${esc(r.keterangan)}</td></tr>`).join('') : `<tr><td colspan="5">Belum ada kegiatan bulan ini.</td></tr>`;
  return official(`<div class="title">Pengambilan Operasional RT<br>Melalui Bank Jawa Tengah</div>
  <table class="no-border"><tr><td style="width:160px">Nama Lembaga</td><td>: RT ${m.rt} RW ${m.rw}</td></tr><tr><td>Kelurahan</td><td>: ${m.kelurahan}</td></tr><tr><td>Kecamatan</td><td>: ${m.kecamatan}</td></tr><tr><td>Untuk Kegiatan Bulan</td><td>: ${esc(month)}</td></tr></table><br>
  <table><tr><th>No.</th><th>Uraian Kegiatan</th><th>Satuan/Volume</th><th>Anggaran</th><th>Keterangan</th></tr>${tbody}<tr><td colspan="3"><b>Jumlah</b></td><td><b>${rupiah(total)}</b></td><td></td></tr></table>
  <p>Terbilang: ${terbilang(total).replace(/\s+/g,' ')} Rupiah</p>
  <p style="text-align:right;margin-top:20px">${todaySemarangV18()}</p>
  <div class="ttd-3"><div>Yang Mengambil<br>Ketua RT ${m.rt} RW ${m.rw}<div class="signature-space"></div>${safeNameV18(m.ketua)}</div><div>Bendahara<div class="signature-space"></div>${safeNameV18(m.bendahara)}</div><div>Mengetahui<br>Lurah ${m.kelurahan}<div class="signature-space"></div>${safeNameV18(data.pengajuan.namaLurah)}</div></div>`);
}


/* PATCH v1.19 - Jadwal Internal RAP tanpa mengubah template resmi + tanggal/nama otomatis + notifikasi global */
function monthsScheduledV19(row){
  const range=monthsInRangeV15(row.bulanMulai,row.bulanSelesai);
  const cfg=row.jadwalInternal||{mode:"auto",manualMonths:[]};
  const mode=cfg.mode||"auto";
  if(!range.length) return [];
  if(mode==="sekali") return [row.bulanMulai||range[0]];
  if(mode==="bulanan") return range;
  if(mode==="2bulan"||mode==="3bulan"||mode==="6bulan"){
    const step=mode==="2bulan"?2:(mode==="3bulan"?3:6);
    return range.filter((m,i)=>i%step===0);
  }
  if(mode==="manual"){
    const selected=(cfg.manualMonths||[]).filter(m=>range.includes(m));
    return selected.length?selected:[range[0]];
  }
  const totalQty=parseVolumeV18(row.volume).qty;
  const selected=allocatedMonthIndexesV18(totalQty,range.length);
  if(selected===null) return range;
  return range.filter((m,i)=>selected.has(i));
}
function scheduleLabelV19(row){
  const cfg=row.jadwalInternal||{mode:"auto"};
  const labels={auto:"Otomatis volume",sekali:"Sekali saja",bulanan:"Setiap bulan","2bulan":"2 bulan sekali","3bulan":"3 bulan sekali","6bulan":"6 bulan sekali",manual:"Bulan tertentu"};
  return labels[cfg.mode||"auto"]||"Otomatis volume";
}
function monthlyQtyForRowV19(row,month){
  const scheduled=monthsScheduledV19(row);
  if(!scheduled.includes(month)) return 0;
  const v=parseVolumeV18(row.volume);
  if(!scheduled.length) return 0;
  if((row.jadwalInternal||{}).mode==="auto"){
    return monthlyQtyForRowV18(row,month);
  }
  return v.qty/scheduled.length;
}
function monthlyAmountForRowV19(row,month){
  const qty=monthlyQtyForRowV19(row,month);
  if(qty<=0) return 0;
  return Math.round(unitPriceV18(row)*qty);
}
function ensureSchedulePanelV19(){
  if($("rapSchedulePanelV19")) return;
  const wrap=$("rapTable")?.closest(".table-wrap") || $("rapTable")?.parentElement;
  if(wrap){
    const el=document.createElement("div");
    el.id="rapSchedulePanelV19";
    wrap.insertAdjacentElement("afterend",el);
  }
}
function openJadwalInternalV19(i){
  updateRapFromInputs();
  data.pengajuan.scheduleEditIndex=Number(i);
  localStorage.setItem(STORE,JSON.stringify(data));
  renderRap();
  notifyChangeV19("Jadwal internal dibuka","Atur pola muncul RAP bulanan tanpa mengubah template resmi.","warning");
}
function closeJadwalInternalV19(){
  data.pengajuan.scheduleEditIndex=null;
  localStorage.setItem(STORE,JSON.stringify(data));
  renderRap();
}
function saveJadwalInternalV19(){
  const i=Number(data.pengajuan.scheduleEditIndex);
  if(!data.pengajuan.rap[i]) return;
  const mode=$("jadwalModeV19")?.value || "auto";
  const manual=[...document.querySelectorAll("[data-jadwal-month-v19]:checked")].map(x=>x.value);
  data.pengajuan.rap[i].jadwalInternal={mode,manualMonths:manual};
  localStorage.setItem(STORE,JSON.stringify(data));
  notifyChangeV19("Jadwal internal tersimpan",`${data.pengajuan.rap[i].uraian||"Mata anggaran"} memakai pola ${scheduleLabelV19(data.pengajuan.rap[i])}.`,"success");
  renderRap();
}
function renderSchedulePanelV19(){
  ensureSchedulePanelV19();
  const el=$("rapSchedulePanelV19");
  if(!el) return;
  const i=Number(data.pengajuan.scheduleEditIndex);
  if(Number.isNaN(i)||!data.pengajuan.rap[i]){
    el.innerHTML=`<div class="schedule-panel-v19">
      <div class="schedule-title">Jadwal Internal RAP Bulanan</div>
      <div class="schedule-subtitle">Klik <b>Atur Jadwal</b> pada salah satu mata anggaran untuk menentukan pola muncul di RAP Bulanan. Data ini hanya untuk aplikasi dan tidak ikut tercetak pada template resmi.</div>
    </div>`;
    return;
  }
  const row=data.pengajuan.rap[i];
  const cfg=row.jadwalInternal||{mode:"auto",manualMonths:[]};
  const scheduled=monthsScheduledV19(row);
  const monthChecks=monthListV17().map(m=>`<label><input type="checkbox" data-jadwal-month-v19 value="${m}" ${((cfg.manualMonths||[]).includes(m))?"checked":""}> ${m.replace(" 2026","")}</label>`).join("");
  const preview=monthListV17().map(m=>`<span class="${scheduled.includes(m)?"":"off"}">${m.replace(" 2026","")}</span>`).join("");
  el.innerHTML=`<div class="schedule-panel-v19">
    <div class="schedule-title">Atur Jadwal Internal</div>
    <div class="schedule-subtitle"><b>${esc(row.uraian||"Mata anggaran")}</b><br>Pengaturan ini hanya untuk logika RAP Bulanan aplikasi. Hasil cetak RAP resmi tetap mengikuti template pemerintah.</div>
    <div class="form-grid">
      <label>Pola Pelaksanaan
        <select id="jadwalModeV19">
          <option value="auto" ${cfg.mode==="auto"?"selected":""}>Otomatis berdasarkan volume</option>
          <option value="sekali" ${cfg.mode==="sekali"?"selected":""}>Sekali saja pada bulan mulai</option>
          <option value="bulanan" ${cfg.mode==="bulanan"?"selected":""}>Setiap bulan</option>
          <option value="2bulan" ${cfg.mode==="2bulan"?"selected":""}>2 bulan sekali</option>
          <option value="3bulan" ${cfg.mode==="3bulan"?"selected":""}>3 bulan sekali</option>
          <option value="6bulan" ${cfg.mode==="6bulan"?"selected":""}>6 bulan sekali</option>
          <option value="manual" ${cfg.mode==="manual"?"selected":""}>Bulan tertentu / manual</option>
        </select>
      </label>
      <label>Rentang Aktif
        <input value="${esc(row.bulanMulai)} s.d ${esc(row.bulanSelesai)}" disabled>
      </label>
      <label>Total Satuan/Volume
        <input value="${esc(row.volume)}" disabled>
      </label>
      <label>Nilai/Volume
        <input value="${rupiah(unitPriceV18(row))}" disabled>
      </label>
    </div>
    <div style="margin-top:12px">
      <b>Pilih bulan manual</b>
      <div class="manual-month-grid">${monthChecks}</div>
    </div>
    <div style="margin-top:12px">
      <b>Preview bulan muncul</b>
      <div class="schedule-preview-months">${preview}</div>
    </div>
    <div class="action-row" style="margin-top:14px">
      <button class="primary" type="button" onclick="saveJadwalInternalV19()">Simpan Jadwal</button>
      <button class="secondary" type="button" onclick="closeJadwalInternalV19()">Tutup</button>
    </div>
  </div>`;
  const modeEl=$("jadwalModeV19");
  if(modeEl) modeEl.onchange=()=>{row.jadwalInternal={mode:modeEl.value,manualMonths:[...document.querySelectorAll("[data-jadwal-month-v19]:checked")].map(x=>x.value)};renderSchedulePanelV19();};
  document.querySelectorAll("[data-jadwal-month-v19]").forEach(ch=>ch.onchange=()=>{row.jadwalInternal={mode:$("jadwalModeV19")?.value||"manual",manualMonths:[...document.querySelectorAll("[data-jadwal-month-v19]:checked")].map(x=>x.value)};renderSchedulePanelV19();});
}
function renderRap(){
  ensureFullMonthOptionsV17();
  normalizeRapV18();
  const tb=$("rapTable").querySelector("tbody");
  tb.innerHTML="";
  $("rapTable").classList.add("rap-wide-table");
  data.pengajuan.rap.forEach((r,i)=>{
    const count=monthRangeCountV15(r.bulanMulai,r.bulanSelesai);
    const ter=annualBreakdownTotalV18(i);
    const sisa=Number(r.jumlah||0)-ter;
    const cls=sisa===0?"good":(sisa>0?"warning":"danger");
    tb.insertAdjacentHTML("beforeend",`<tr>
      <td>${i+1}</td>
      <td><select class="mini-input select-compact" data-rap="${i},kategori">${formatSelOptionV12(KATEGORI_OPERASIONAL,r.kategori)}</select></td>
      <td><select class="mini-input select-compact" data-rap="${i},subKategori">${formatSelOptionV12(SUB_KATEGORI_MAP[r.kategori]||[],r.subKategori)}</select></td>
      <td><input class="mini-input" data-rap="${i},uraian" value="${escapeAttr(r.uraian)}"><div class="internal-schedule-pill">${scheduleLabelV19(r)}</div></td>
      <td class="range-month-cell"><select class="mini-input select-compact" data-rap="${i},bulanMulai">${formatSelOptionV12(monthListV17(),r.bulanMulai)}</select></td>
      <td class="range-month-cell"><select class="mini-input select-compact" data-rap="${i},bulanSelesai">${formatSelOptionV12(monthListV17(),r.bulanSelesai)}</select><div class="range-month-note">${count} bulan</div></td>
      <td><input class="mini-input" data-rap="${i},volume" value="${escapeAttr(r.volume)}" placeholder="Contoh: 4 Kegiatan"></td>
      <td><input class="mini-input" type="number" data-rap="${i},jumlah" value="${Number(r.jumlah||0)}"></td>
      <td class="unit-price-cell">${rupiah(unitPriceV18(r))}</td>
      <td class="budget-progress-cell">${rupiah(ter)}</td>
      <td class="budget-progress-cell ${cls}">${rupiah(sisa)}</td>
      <td><input class="mini-input" data-rap="${i},keterangan" value="${escapeAttr(r.keterangan)}"></td>
      <td><div class="schedule-action-stack"><button type="button" class="secondary" onclick="openJadwalInternalV19(${i})">Atur Jadwal</button><button type="button" class="delete" onclick="deleteRap(${i})">Hapus</button></div></td>
    </tr>`);
  });
  $("rapTotalCell").textContent=rupiah(totalRap());
  renderSchedulePanelV19();
  renderMonthlyRapSummary();
}
function getMonthlyRapRows(month){
  normalizeRapV18();
  const rows=[];
  data.pengajuan.rap.forEach((r,annualIndex)=>{
    if(monthsScheduledV19(r).includes(month)){
      const qty=monthlyQtyForRowV19(r,month);
      const amount=monthlyAmountForRowV19(r,month);
      if(qty>0 && amount>0){
        const v=parseVolumeV18(r.volume);
        rows.push({...r,annualIndex,volumeBulanan:formatVolumeV18(qty,v.unit),qtyBulanan:qty,jumlahBulanan:amount,sumber:scheduleLabelV19(r),rentangBulan:`${r.bulanMulai} s.d ${r.bulanSelesai}`});
      }
    }
  });
  return rows;
}
function safeNameV19(name){ const s=String(name||"").trim(); return s || "................................"; }
function autoDocBodyV19(body){
  let b=String(body||"");
  const today=typeof todaySemarangV18==="function"?todaySemarangV18():"Semarang, "+new Date().toLocaleDateString("id-ID");
  const monthNames="Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember";
  b=b.replace(new RegExp(`Semarang,\\s*\\d{1,2}\\s+(${monthNames})\\s+\\d{4}`,"g"),today)
     .replace(/Semarang,\s*tanggal bulan tahun/gi,today)
     .replace(/Semarang,\s*\.{2,}\s*2026/gi,today)
     .replace(/tanggal bulan tahun/gi,today);
  const ketua=safeNameV19(data.master?.ketua), bendahara=safeNameV19(data.master?.bendahara), lurah=safeNameV19(data.pengajuan?.namaLurah), rw=safeNameV19(data.pengajuan?.namaKetuaRw);
  b=b.replace(/(Ketua RT [^<]*<div class="signature-space"><\/div>)(Nama Jelas|\.{2,})/g,`$1${ketua}`);
  b=b.replace(/(Bendahara(?: RT [^<]*)?<div class="signature-space"><\/div>)(Nama Jelas|\.{2,})/g,`$1${bendahara}`);
  b=b.replace(/(Lurah [^<]*<div class="signature-space"><\/div>)(Nama Jelas|\.{2,})/g,`$1${lurah}`);
  b=b.replace(/(Ketua RW [^<]*<div class="signature-space"><\/div>)(Nama Jelas|\.{2,})/g,`$1${rw}`);
  return b;
}
function official(body){ return `<div class="official">${kopHTML()}${autoDocBodyV19(body)}</div>`; }
function ensureToastStackV19(){
  if(!$("toastStackV19")){
    const el=document.createElement("div");
    el.id="toastStackV19";
    el.className="toast-stack-v19";
    document.body.appendChild(el);
  }
}
function notifyChangeV19(title,body,type="success"){
  ensureToastStackV19();
  const stack=$("toastStackV19");
  const el=document.createElement("div");
  el.className=`toast-v19 ${type}`;
  el.innerHTML=`<div class="toast-icon">${type==="warning"?"!":"✓"}</div><div><div class="toast-title">${esc(title)}</div><div class="toast-body">${esc(body)}</div></div>`;
  stack.appendChild(el);
  setTimeout(()=>{el.style.opacity="0";el.style.transform="translateY(8px)";setTimeout(()=>el.remove(),250)},3200);
}
function setupNotificationsV19(){
  ensureToastStackV19();
  if(window.__notifV19Ready) return;
  window.__notifV19Ready=true;
  document.addEventListener("change",e=>{
    const t=e.target;
    if(!t||!t.matches||!t.matches("input,select,textarea")) return;
    let label=t.closest("label")?.childNodes?.[0]?.textContent?.trim() || t.placeholder || "Data";
    if(t.dataset?.rap) label="RAP 1 Tahun";
    if(t.dataset?.breakdown) label="Breakdown RAP Bulanan";
    if(t.dataset?.exp) label="LPJ / Pengeluaran";
    notifyChangeV19("Perubahan tersimpan",`${label} berhasil diperbarui otomatis.`,"success");
  },true);
  document.addEventListener("click",e=>{
    const b=e.target.closest("button");
    if(!b) return;
    const txt=(b.textContent||"").trim();
    if(/Simpan|Tambah|Hapus|Backup|Restore|Reset|Import|Export/i.test(txt)){
      setTimeout(()=>notifyChangeV19("Aksi diproses",`${txt} berhasil dijalankan atau diproses oleh aplikasi.`,"success"),80);
    }
  },true);
}
function docRap(){
  normalizeRapV18();
  return official(`<div class="title">RENCANA ANGGARAN PENGGUNAAN<br>BANTUAN OPERASIONAL RT</div>
  <table><thead><tr><th>No</th><th>Uraian Kegiatan</th><th>Rentang Bulan</th><th>Total Satuan/Volume</th><th>Rencana Anggaran</th><th>Keterangan</th></tr></thead><tbody>${data.pengajuan.rap.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.uraian)}<br><small>${esc(r.kategori)} - ${esc(r.subKategori)}</small></td><td>${esc(r.bulanMulai)} s.d ${esc(r.bulanSelesai)}</td><td>${esc(r.volume)}</td><td>${rupiah(r.jumlah)}</td><td>${esc(r.keterangan)}</td></tr>`).join("")}<tr><td colspan="4"><b>Jumlah</b></td><td><b>${rupiah(totalRap())}</b></td><td></td></tr></tbody></table>
  <p style="text-align:right;margin-top:20px">${todaySemarangV18()}</p>
  <p>Mengetahui,</p>
  <div class="ttd-4"><div>Ketua RT ${data.master.rt}<div class="signature-space"></div>${safeNameV19(data.master.ketua)}</div><div>Bendahara RT ${data.master.rt}<div class="signature-space"></div>${safeNameV19(data.master.bendahara)}</div><div>Lurah ${data.master.kelurahan}<div class="signature-space"></div>${safeNameV19(data.pengajuan.namaLurah)}</div><div>Ketua RW ${data.master.rw}<div class="signature-space"></div>${safeNameV19(data.pengajuan.namaKetuaRw)}</div></div>`);
}


/* PATCH v1.20 - Rapikan lokasi input undangan, notulen, daftar hadir, kuitansi */
function moveInputLabelV20(inputId,targetId){
  const input=$(inputId), target=$(targetId);
  if(!input||!target) return;
  const label=input.closest("label");
  if(!label||label.parentElement===target) return;
  label.classList.add("v20-moved-field");
  target.appendChild(label);
}
function organizeActivityInputsV20(){
  // Persiapan Kegiatan: data spesifik dipindah ke tab masing-masing agar tidak tercampur.
  moveInputLabelV20("pkRows","pkDaftarHadirSettingV20");
  moveInputLabelV20("pkPimpinan","pkNotulenIdentityV20");
  moveInputLabelV20("pkNotulis","pkNotulenIdentityV20");
  moveInputLabelV20("pkNominal","pkKuitansiDataV20");
  moveInputLabelV20("pkPenerima","pkKuitansiDataV20");
  moveInputLabelV20("pkJabatanPenerima","pkKuitansiDataV20");
  moveInputLabelV20("pkKeperluan","pkKuitansiDataV20");
  moveInputLabelV20("pkTanggalTerima","pkKuitansiDataV20");
}
function quickOpenUndanganRAPV20(){
  goPage("pengajuan");
  activateTab("undangan-notulen");
  notifyChangeV19?.("Menu Undangan & Notulen RAP","Setting undangan dan notulen pengajuan dana ada di tab ini.","success");
}
function quickOpenBAHadirRAPV20(){
  goPage("pengajuan");
  activateTab("rapat");
  notifyChangeV19?.("Menu BA & Daftar Hadir RAP","Berita acara, daftar hadir, dan peserta RAP ada di tab ini.","success");
}


/* PATCH v1.21 - Cetak Folio/F4 bersih */
function printHelpV21(){
  return `<div class="print-help-v21">
    <b>Mode cetak Folio/F4 bersih aktif</b>
    Ukuran dokumen disiapkan untuk Folio/F4. Pada dialog print browser, pilih kertas Folio/F4/8.5 x 13 dan matikan opsi <b>Headers and footers</b> agar tanggal, judul aplikasi, URL file, dan nomor halaman bawaan browser hilang.
  </div>`;
}
function prepareFolioPrintV21(target){
  collectAll();
  document.body.classList.remove("print-doc","print-lpj","print-pk","print-folio-v21");
  document.body.classList.add("print-folio-v21");
  const oldTitle=document.title;
  document.documentElement.dataset.oldTitleV21=oldTitle||"";
  document.title=" ";
  if(target==="lpj"){
    $("lpjOutput").innerHTML=docLpj();
    $("lpjOutput").classList.add("doc-paper");
    document.body.classList.add("print-lpj");
  }else if(target==="pk"){
    collectPersiapan();
    previewPkDoc(currentPkDoc);
    $("pkDocOutput").classList.add("doc-paper");
    document.body.classList.add("print-pk");
  }else{
    previewDoc(currentDoc);
    $("docOutput").classList.add("doc-paper");
    document.body.classList.add("print-doc");
  }
}
function restoreFolioPrintV21(){
  const old=document.documentElement.dataset.oldTitleV21;
  if(old!==undefined) document.title=old || "BOP RT 005 Offline Manager";
  document.body.classList.remove("print-doc","print-lpj","print-pk","print-folio-v21");
}
function cleanPrint(target){
  prepareFolioPrintV21(target==="lpj"?"lpj":"doc");
  setTimeout(()=>window.print(),180);
}
function cleanPrintPk(){
  prepareFolioPrintV21("pk");
  setTimeout(()=>window.print(),180);
}
window.addEventListener("afterprint",restoreFolioPrintV21);


function ensurePrintHelpV21(){
  if($("docOutput") && !$("printHelpDocV21")){
    const box=document.createElement("div");
    box.id="printHelpDocV21";
    box.innerHTML=printHelpV21();
    const parent=$("docOutput").parentElement;
    if(parent) parent.insertBefore(box,$("docOutput"));
  }
  if($("pkDocOutput") && !$("printHelpPkV21")){
    const box=document.createElement("div");
    box.id="printHelpPkV21";
    box.innerHTML=printHelpV21();
    const parent=$("pkDocOutput").parentElement;
    if(parent) parent.insertBefore(box,$("pkDocOutput"));
  }
}


/* PATCH v1.22 - Cetak langsung dari iframe bersih agar preview aplikasi tidak ikut tercetak */
function printCssV22(){
  return `
  @page{size:215mm 330mm;margin:12mm 14mm 12mm 14mm}
  html,body{margin:0;padding:0;background:#fff;color:#000}
  body{font-family:"Times New Roman",serif}
  .print-page{width:187mm;box-sizing:border-box;margin:0 auto;background:#fff}
  .official{font-family:"Times New Roman",serif;color:#000;font-size:11.5pt;line-height:1.22;width:100%;box-sizing:border-box}
  .kop{position:relative;text-align:center;border-bottom:3px double #000;padding:4px 0 8px 0;margin-bottom:14px;min-height:72px;display:flex;align-items:center;justify-content:center}
  .kop-logo{position:absolute;left:0;top:50%;transform:translateY(-50%);width:58px;max-height:70px;object-fit:contain;display:block}
  .kop-text{text-align:center;width:100%}
  .kop h1,.kop-text h1{font-family:"Times New Roman",serif;margin:0;font-size:16px;text-transform:uppercase;text-align:center}
  .kop h2,.kop-text h2{font-family:"Times New Roman",serif;margin:2px 0;font-size:15px;text-transform:uppercase;text-align:center}
  .kop p,.kop-text p{font-family:"Times New Roman",serif;margin:2px 0;font-size:11px;text-align:center}
  .official .title{text-align:center;font-weight:bold;text-transform:uppercase;margin:10px 0 12px;font-size:13pt}
  .official table{width:100%;border-collapse:collapse}
  .official th,.official td{border:1px solid #000;padding:5px;vertical-align:top}
  .official table.no-border td,.official table.no-border th,.official .no-border td,.official .no-border th{border:0!important;padding:3px 2px!important}
  .official p{margin:7px 0}
  .ttd-grid,.ttd-4,.ttd-3{display:grid;gap:18px;text-align:center;margin-top:16px}
  .ttd-grid{grid-template-columns:1fr 1fr}
  .ttd-4{grid-template-columns:repeat(4,1fr)}
  .ttd-3{grid-template-columns:repeat(3,1fr)}
  .signature-space{height:58px}
  .kuitansi-box{border:2px solid #000;padding:14px;margin-top:8px}
  .kuitansi-title{text-align:center;font-weight:bold;text-transform:uppercase;font-size:16pt;margin-bottom:10px}
  .kuitansi-nominal{border:1px solid #000;padding:8px 12px;font-weight:bold;display:inline-block;min-width:220px;text-align:center}
  @media print{
    html,body{width:215mm;min-height:330mm}
    .print-page{width:187mm;margin:0 auto}
  }`;
}
function getPrintHtmlV22(target){
  collectAll();
  let html="", title=" ";
  if(target==="lpj"){
    html=docLpj();
  }else if(target==="pk"){
    collectPersiapan();
    html=(typeof pkDocs!=="undefined" && pkDocs[currentPkDoc]) ? pkDocs[currentPkDoc]() : (document.getElementById("pkDocOutput")?.innerHTML||"");
  }else{
    previewDoc(currentDoc);
    html=document.getElementById("docOutput")?.innerHTML || "";
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${printCssV22()}</style></head><body><div class="print-page">${html}</div></body></html>`;
}
function printInIframeV22(target){
  const old=document.getElementById("printFrameV22");
  if(old) old.remove();
  const frame=document.createElement("iframe");
  frame.id="printFrameV22";
  frame.className="print-frame-v22";
  document.body.appendChild(frame);
  const doc=frame.contentDocument || frame.contentWindow.document;
  doc.open();
  doc.write(getPrintHtmlV22(target));
  doc.close();
  setTimeout(()=>{
    frame.contentWindow.focus();
    frame.contentWindow.print();
  },350);
  setTimeout(()=>{try{frame.remove()}catch(e){}},60000);
}
function cleanPrint(target){
  printInIframeV22(target==="lpj"?"lpj":"doc");
}
function cleanPrintPk(){
  printInIframeV22("pk");
}
function ensurePrintHelpV22(){
  const msg=`<div class="print-help-v21"><b>Mode cetak langsung bersih aktif</b>Dokumen akan dicetak dari halaman khusus Folio/F4, bukan dari tampilan aplikasi. Pada dialog print tetap pilih kertas Folio/F4/8.5 x 13 dan matikan <b>Headers and footers</b>.</div>`;
  if($("docOutput") && !$("printHelpDocV22")){
    const box=document.createElement("div");box.id="printHelpDocV22";box.innerHTML=msg;
    const parent=$("docOutput").parentElement;if(parent) parent.insertBefore(box,$("docOutput"));
  }
  if($("pkDocOutput") && !$("printHelpPkV22")){
    const box=document.createElement("div");box.id="printHelpPkV22";box.innerHTML=msg;
    const parent=$("pkDocOutput").parentElement;if(parent) parent.insertBefore(box,$("pkDocOutput"));
  }
}


/* PATCH v1.23 - Print CSS stabil dan preview tidak turun */
function printCssV22(){
  return `
  @page{size:215mm 330mm;margin:12mm 14mm 12mm 14mm}
  html,body{margin:0!important;padding:0!important;background:#fff!important;color:#000!important}
  body{font-family:"Times New Roman",serif!important}
  .print-page{width:187mm;box-sizing:border-box;margin:0 auto;background:#fff}
  .official{font-family:"Times New Roman",serif!important;color:#000!important;font-size:11.2pt!important;line-height:1.2!important;width:100%;box-sizing:border-box}
  .kop{display:grid;grid-template-columns:68px 1fr;align-items:center;border-bottom:3px double #000;padding-bottom:8px;margin-bottom:12px;text-align:center;break-after:avoid;page-break-after:avoid}
  .kop-logo{width:54px;max-height:66px;object-fit:contain;margin:auto;display:block}
  .kop h1{font-family:"Times New Roman",serif;margin:0;font-size:15.5px;text-transform:uppercase}
  .kop h2{font-family:"Times New Roman",serif;margin:1px 0;font-size:14.5px;text-transform:uppercase}
  .kop p{font-family:"Times New Roman",serif;margin:1px 0;font-size:10.5px}
  .official .title{text-align:center;font-weight:bold;text-transform:uppercase;margin:9px 0 10px;font-size:12.6pt;break-after:avoid;page-break-after:avoid}
  .official table{width:100%;border-collapse:collapse;table-layout:fixed;page-break-inside:auto}
  .official thead{display:table-header-group}
  .official tfoot{display:table-footer-group}
  .official tr{page-break-inside:avoid;break-inside:avoid}
  .official th,.official td{border:1px solid #000;padding:4px 4px;vertical-align:top;font-size:10.2pt;line-height:1.15;overflow-wrap:anywhere;word-break:normal}
  .official th{text-align:center;font-weight:bold}
  .official table.no-border{table-layout:auto!important}
  .official table.no-border td,.official table.no-border th,.official .no-border td,.official .no-border th{border:0!important;padding:3px 2px!important;font-size:11.2pt!important;overflow-wrap:normal!important}
  .official p{margin:7px 0}
  .ttd-grid,.ttd-4,.ttd-3{display:grid;gap:18px;text-align:center;margin-top:16px;page-break-inside:avoid;break-inside:avoid}
  .ttd-grid{grid-template-columns:1fr 1fr}
  .ttd-4{grid-template-columns:repeat(4,1fr)}
  .ttd-3{grid-template-columns:repeat(3,1fr)}
  .signature-space{height:54px}
  .kuitansi-box{border:2px solid #000;padding:14px;margin-top:8px;page-break-inside:avoid;break-inside:avoid}
  .kuitansi-title{text-align:center;font-weight:bold;text-transform:uppercase;font-size:15.5pt;margin-bottom:10px}
  .kuitansi-nominal{border:1px solid #000;padding:8px 12px;font-weight:bold;display:inline-block;min-width:220px;text-align:center}
  @media print{
    html,body{width:215mm;min-height:330mm}
    .print-page{width:187mm;margin:0 auto}
  }`;
}

function ensurePrintHelpV21(){}
function ensurePrintHelpV22(){}

function cleanPreviewGridV23(){
  ["printHelpDocV21","printHelpDocV22","printHelpPkV21","printHelpPkV22"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.remove();
  });
}

function getPrintHtmlV22(target){
  collectAll();
  let html="", title=" ";
  if(target==="lpj"){
    html=docLpj();
  }else if(target==="pk"){
    collectPersiapan();
    if(typeof pkDocs!=="undefined" && pkDocs[currentPkDoc]) html=pkDocs[currentPkDoc]();
    else { previewPkDoc(currentPkDoc); html=document.getElementById("pkDocOutput")?.innerHTML||""; }
  }else{
    previewDoc(currentDoc);
    html=document.getElementById("docOutput")?.innerHTML || "";
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${printCssV22()}</style></head><body><div class="print-page">${html}</div></body></html>`;
}


/* PATCH v1.24 - Monitoring Administrasi Bulanan */
const MONITOR_STATUS_V24=[
  ["belum","Belum"],
  ["draft","Draft"],
  ["siap","Siap Cetak"],
  ["cetak","Sudah Cetak"],
  ["ttd","Sudah TTD"],
  ["upload","Sudah Upload"],
  ["revisi","Perlu Revisi"]
];

const PENGAJUAN_DOCS_V24=[
  {id:"permohonan",name:"Surat Permohonan Pencairan",desc:"Surat permohonan kepada Lurah",doc:"permohonan"},
  {id:"rap",name:"RAP BOP RT 1 Tahun",desc:"Rencana anggaran tahunan",doc:"rap"},
  {id:"rapbulanan",name:"RAP Bulanan",desc:"RAP bulan terpilih",doc:"rapbulanan"},
  {id:"ba",name:"Berita Acara RAP",desc:"BA kesepakatan RAP",doc:"ba"},
  {id:"hadir",name:"Daftar Hadir RAP",desc:"Peserta rapat RAP",doc:"hadir"},
  {id:"sptjm",name:"SPTJM",desc:"Surat pernyataan tanggung jawab",doc:"sptjm"},
  {id:"rbb",name:"RBB / Pengambilan Operasional",desc:"Pengambilan operasional Bank Jateng",doc:"rbb"}
];

const LPJ_DOCS_V24=[
  {id:"laporan",name:"Laporan Penggunaan BOP",desc:"Laporan penggunaan dana BOP",type:"lpj"},
  {id:"pengeluaran",name:"Rincian Pengeluaran",desc:"Detail realisasi pengeluaran",type:"lpj"},
  {id:"kuitansi",name:"Kuitansi / Tanda Terima",desc:"Bukti pembayaran barang/jasa/konsumsi",pk:"pk-kuitansi"},
  {id:"undangan",name:"Undangan Kegiatan",desc:"Undangan kegiatan operasional",pk:"pk-undangan"},
  {id:"hadir",name:"Daftar Hadir Kegiatan",desc:"Daftar hadir kegiatan SPJ",pk:"pk-hadir"},
  {id:"notulen",name:"Notulen Kegiatan",desc:"Notulen kegiatan/rapat operasional",pk:"pk-notulen"},
  {id:"moku",name:"Dokumentasi MoKu",desc:"Foto dokumentasi kegiatan dari MoKu",type:"moku"},
  {id:"pajak",name:"Bukti Pajak jika ada",desc:"PPh/PPN/ket. pajak jika diperlukan",type:"manual"}
];

function ensureMonitoringV24(){
  if(!data.monitoring) data.monitoring={selectedMonth:"Januari 2026",months:{}};
  if(!data.monitoring.selectedMonth) data.monitoring.selectedMonth="Januari 2026";
  const month=data.monitoring.selectedMonth;
  if(!data.monitoring.months[month]){
    data.monitoring.months[month]={pengajuan:{},lpj:{},notes:""};
  }
  PENGAJUAN_DOCS_V24.forEach(d=>{
    if(!data.monitoring.months[month].pengajuan[d.id]) data.monitoring.months[month].pengajuan[d.id]={status:"belum",catatan:""};
  });
  LPJ_DOCS_V24.forEach(d=>{
    if(!data.monitoring.months[month].lpj[d.id]) data.monitoring.months[month].lpj[d.id]={status:"belum",catatan:""};
  });
  return data.monitoring.months[month];
}
function statusLabelV24(v){
  return (MONITOR_STATUS_V24.find(x=>x[0]===v)||["belum","Belum"])[1];
}
function statusClassV24(v){
  if(["upload","ttd","cetak"].includes(v)) return "done";
  if(["draft","siap"].includes(v)) return "progress";
  if(v==="revisi") return "revise";
  return "empty";
}
function statusOptionsV24(current){
  return MONITOR_STATUS_V24.map(([v,l])=>`<option value="${v}" ${v===current?"selected":""}>${l}</option>`).join("");
}
function countDoneV24(items){
  return Object.values(items||{}).filter(x=>["cetak","ttd","upload"].includes(x.status)).length;
}
function monitoringPercentV24(done,total){
  return total?Math.round(done/total*100):0;
}
function renderMonitoringV24(){
  if(!$("page-monitoring")) return;
  ensureMonitoringV24();
  const sel=$("monitorMonth");
  if(sel){
    sel.value=data.monitoring.selectedMonth;
  }
  const month=data.monitoring.selectedMonth;
  const m=ensureMonitoringV24();
  const pd=countDoneV24(m.pengajuan), ld=countDoneV24(m.lpj);
  const pp=monitoringPercentV24(pd,PENGAJUAN_DOCS_V24.length), lp=monitoringPercentV24(ld,LPJ_DOCS_V24.length);
  const totalDone=pd+ld, totalDocs=PENGAJUAN_DOCS_V24.length+LPJ_DOCS_V24.length;
  const allp=monitoringPercentV24(totalDone,totalDocs);
  $("monitorSummary").innerHTML=`
    <div class="monitor-card-v24"><div class="label">Bulan</div><div class="value">${esc(month.replace(" 2026",""))}</div><div class="sub">Monitoring administrasi BOP RT</div></div>
    <div class="monitor-card-v24"><div class="label">Pengajuan</div><div class="value">${pd}/${PENGAJUAN_DOCS_V24.length}</div><div class="sub">${pp}% dokumen pengajuan selesai</div></div>
    <div class="monitor-card-v24"><div class="label">LPJ / SPJ</div><div class="value">${ld}/${LPJ_DOCS_V24.length}</div><div class="sub">${lp}% kelengkapan LPJ selesai</div></div>`;
  $("pengajuanProgressBadge").textContent=`${pd}/${PENGAJUAN_DOCS_V24.length}`;
  $("lpjProgressBadge").textContent=`${ld}/${LPJ_DOCS_V24.length}`;
  $("pengajuanProgressBadge").className=`monitor-badge-v24 ${pp===100?"good":(pp>0?"warn":"bad")}`;
  $("lpjProgressBadge").className=`monitor-badge-v24 ${lp===100?"good":(lp>0?"warn":"bad")}`;
  $("monitorPengajuanList").innerHTML=PENGAJUAN_DOCS_V24.map(d=>renderMonitorRowV24("pengajuan",d,m.pengajuan[d.id])).join("");
  $("monitorLpjList").innerHTML=LPJ_DOCS_V24.map(d=>renderMonitorRowV24("lpj",d,m.lpj[d.id])).join("");
  $("monitorNotes").value=m.notes||"";
  $("monitoringPrintOutput").innerHTML=docMonitoringV24();
}
function renderMonitorRowV24(group,d,state){
  const st=state?.status||"belum";
  const cat=state?.catatan||"";
  return `<div class="monitor-row-v24">
    <div>
      <div class="doc-name">${esc(d.name)}</div>
      <div class="doc-desc">${esc(d.desc)}</div>
      <span class="monitor-status-pill-v24 ${statusClassV24(st)}">${statusLabelV24(st)}</span>
    </div>
    <select data-monitor-status="${group}|${d.id}">${statusOptionsV24(st)}</select>
    <div>
      <input data-monitor-note="${group}|${d.id}" value="${escapeAttr(cat)}" placeholder="Catatan singkat">
      <div class="monitor-actions-v24" style="margin-top:8px">
        <button class="secondary" type="button" onclick="previewMonitorDocV24('${group}','${d.id}')">Preview</button>
        <button class="secondary" type="button" onclick="printMonitorDocV24('${group}','${d.id}')">Cetak</button>
        <button class="primary" type="button" onclick="setMonitorStatusV24('${group}','${d.id}','upload')">Upload</button>
      </div>
    </div>
  </div>`;
}
function updateMonitoringFromInputsV24(){
  ensureMonitoringV24();
  const m=data.monitoring.months[data.monitoring.selectedMonth];
  document.querySelectorAll("[data-monitor-status]").forEach(el=>{
    const [g,id]=el.dataset.monitorStatus.split("|");
    if(m[g]&&m[g][id]) m[g][id].status=el.value;
  });
  document.querySelectorAll("[data-monitor-note]").forEach(el=>{
    const [g,id]=el.dataset.monitorNote.split("|");
    if(m[g]&&m[g][id]) m[g][id].catatan=el.value;
  });
  if($("monitorNotes")) m.notes=$("monitorNotes").value;
  localStorage.setItem(STORE,JSON.stringify(data));
}
function setMonitorStatusV24(group,id,status){
  ensureMonitoringV24();
  const m=data.monitoring.months[data.monitoring.selectedMonth];
  if(m[group]&&m[group][id]) m[group][id].status=status;
  localStorage.setItem(STORE,JSON.stringify(data));
  renderMonitoringV24();
  if(typeof notifyChangeV19==="function") notifyChangeV19("Monitoring diperbarui",`Status ${id} menjadi ${statusLabelV24(status)}.`,"success");
}
function docRefV24(group,id){
  const list=group==="pengajuan"?PENGAJUAN_DOCS_V24:LPJ_DOCS_V24;
  return list.find(x=>x.id===id);
}
function previewMonitorDocV24(group,id){
  const d=docRefV24(group,id);
  if(!d) return;
  if(group==="pengajuan" && d.doc){
    if($("monthlyDocMonth")) $("monthlyDocMonth").value=data.monitoring.selectedMonth;
    data.pengajuan.selectedMonth=data.monitoring.selectedMonth;
    previewDoc(d.doc);
    goPage("pengajuan");
    activateTab("dokumen");
  }else if(group==="lpj" && d.pk){
    currentPkDoc=d.pk;
    previewPkDoc(currentPkDoc);
    goPage("persiapan");
    activateTab("pk-generate");
  }else if(group==="lpj"){
    if(d.type==="lpj"){
      $("lpjOutput").innerHTML=docLpj();
      goPage("lpj");
    }else{
      goPage("monitoring");
    }
  }
  setMonitorStatusV24(group,id,"draft");
}
function printMonitorDocV24(group,id){
  const d=docRefV24(group,id);
  if(!d) return;
  if(group==="pengajuan" && d.doc){
    if($("monthlyDocMonth")) $("monthlyDocMonth").value=data.monitoring.selectedMonth;
    data.pengajuan.selectedMonth=data.monitoring.selectedMonth;
    currentDoc=d.doc;
    previewDoc(currentDoc);
    cleanPrint("doc");
  }else if(group==="lpj" && d.pk){
    currentPkDoc=d.pk;
    previewPkDoc(currentPkDoc);
    cleanPrintPk();
  }else if(group==="lpj" && d.type==="lpj"){
    cleanPrint("lpj");
  }else{
    printMonitoringV24();
    return;
  }
  setMonitorStatusV24(group,id,"cetak");
}
function printMonitoringV24(){
  updateMonitoringFromInputsV24();
  $("monitoringPrintOutput").innerHTML=docMonitoringV24();
  if(typeof printInIframeV22==="function"){
    const old=document.getElementById("printFrameV22");
    if(old) old.remove();
    const frame=document.createElement("iframe");
    frame.id="printFrameV22";
    frame.className="print-frame-v22";
    document.body.appendChild(frame);
    const doc=frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title> </title><style>${printCssV22()}</style></head><body><div class="print-page">${$("monitoringPrintOutput").innerHTML}</div></body></html>`);
    doc.close();
    setTimeout(()=>{frame.contentWindow.focus();frame.contentWindow.print();},350);
    setTimeout(()=>{try{frame.remove()}catch(e){}},60000);
  }else{
    window.print();
  }
}
function docMonitoringV24(){
  ensureMonitoringV24();
  const month=data.monitoring.selectedMonth;
  const m=data.monitoring.months[month];
  const rows=(title,docs,obj)=>`<h3 style="margin:12px 0 6px">${title}</h3><table><thead><tr><th>No</th><th>Dokumen/Kelengkapan</th><th>Status</th><th>Catatan</th></tr></thead><tbody>${docs.map((d,i)=>`<tr><td>${i+1}</td><td>${esc(d.name)}<br><small>${esc(d.desc)}</small></td><td>${statusLabelV24(obj[d.id]?.status||"belum")}</td><td>${esc(obj[d.id]?.catatan||"")}</td></tr>`).join("")}</tbody></table>`;
  const pd=countDoneV24(m.pengajuan), ld=countDoneV24(m.lpj);
  return official(`<div class="title">LEMBAR KONTROL ADMINISTRASI BOP<br>RT ${data.master.rt} RW ${data.master.rw}<br>BULAN ${esc(month).toUpperCase()}</div>
  <table class="no-border"><tr><td style="width:180px">Kelurahan</td><td>: ${esc(data.master.kelurahan)}</td></tr><tr><td>Kecamatan</td><td>: ${esc(data.master.kecamatan)}</td></tr><tr><td>Kota</td><td>: ${esc(data.master.kota)}</td></tr><tr><td>Progress Pengajuan</td><td>: ${pd}/${PENGAJUAN_DOCS_V24.length}</td></tr><tr><td>Progress LPJ/SPJ</td><td>: ${ld}/${LPJ_DOCS_V24.length}</td></tr></table>
  ${rows("A. Pengajuan Dana Operasional",PENGAJUAN_DOCS_V24,m.pengajuan)}
  ${rows("B. LPJ / SPJ Bulanan",LPJ_DOCS_V24,m.lpj)}
  <p><b>Catatan Bulanan:</b><br>${esc(m.notes||"-").replaceAll("\\n","<br>")}</p>
  <p style="text-align:right;margin-top:20px">${typeof todaySemarangV18==="function"?todaySemarangV18():"Semarang, tanggal bulan tahun"}</p>
  <div class="ttd-3"><div>Ketua RT ${data.master.rt}<div class="signature-space"></div>${data.master.ketua||"Nama Jelas"}</div><div>Sekretaris RT ${data.master.rt}<div class="signature-space"></div>${data.master.sekretaris||"Nama Jelas"}</div><div>Bendahara RT ${data.master.rt}<div class="signature-space"></div>${data.master.bendahara||"Nama Jelas"}</div></div>`);
}
function bindMonitoringV24(){
  if($("monitorMonth")) $("monitorMonth").onchange=()=>{
    updateMonitoringFromInputsV24();
    data.monitoring.selectedMonth=$("monitorMonth").value;
    ensureMonitoringV24();
    localStorage.setItem(STORE,JSON.stringify(data));
    renderMonitoringV24();
  };
  if($("saveMonitoring")) $("saveMonitoring").onclick=()=>{
    updateMonitoringFromInputsV24();
    renderMonitoringV24();
    if(typeof notifyChangeV19==="function") notifyChangeV19("Monitoring tersimpan","Status administrasi bulan ini berhasil disimpan.","success");
  };
  if($("printMonitoring")) $("printMonitoring").onclick=printMonitoringV24;
  document.addEventListener("change",e=>{
    if(e.target?.dataset?.monitorStatus){updateMonitoringFromInputsV24();renderMonitoringV24();}
  });
  document.addEventListener("input",e=>{
    if(e.target?.dataset?.monitorNote || e.target?.id==="monitorNotes"){updateMonitoringFromInputsV24();}
  });
}


/* PATCH v1.25 - AI Notulen Resmi Lokal */
function textToPointsV25(text, fallback){
  const raw=String(text||"").replace(/\r/g,"\n").replace(/\t/g," ").trim();
  let parts=[];
  if(raw.includes("\n")){
    parts=raw.split("\n").map(x=>x.replace(/^[-–—•\d.)\s]+/,"").trim()).filter(Boolean);
  }else{
    parts=raw.split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(x=>x.length>12);
  }
  if(!parts.length && fallback) parts=[fallback];
  return parts.map(x=>x.replace(/\s+/g," ").replace(/\s+([,.])/g,"$1").trim()).filter(Boolean);
}
function capFirstV25(s){
  s=String(s||"").trim();
  return s?s.charAt(0).toUpperCase()+s.slice(1):s;
}
function ensurePeriodV25(s){
  s=String(s||"").trim();
  if(!s) return "";
  return /[.!?]$/.test(s)?s:s+".";
}
function formalPointV25(s){
  s=capFirstV25(String(s||"").replace(/\s+/g," ").trim());
  s=s.replace(/\bkm\b/gi,"kami").replace(/\byg\b/gi,"yang").replace(/\bdgn\b/gi,"dengan").replace(/\butk\b/gi,"untuk").replace(/\btdk\b/gi,"tidak");
  return ensurePeriodV25(s);
}
function pointsHtmlV25(points){
  const arr=(points||[]).filter(Boolean);
  return arr.length?`<ol class="notulen-list-v25">${arr.map(x=>`<li>${esc(formalPointV25(x))}</li>`).join("")}</ol>`:`<p>-</p>`;
}
function buildFormalPembahasanV25(raw, agenda, jenis){
  const pts=textToPointsV25(raw, agenda);
  const intro=[
    `${jenis||"Rapat"} membahas agenda utama yaitu ${agenda||"pelaksanaan kegiatan dan kelengkapan administrasi"}`,
    "Pembahasan diarahkan untuk memastikan kebutuhan, pembagian tugas, pelaksanaan, dan kelengkapan dokumen administrasi dapat dipenuhi secara tertib."
  ];
  const merged=[...intro,...pts].filter((x,i,a)=>a.findIndex(y=>y.toLowerCase()===x.toLowerCase())===i);
  return merged.map(formalPointV25).join("\n");
}
function buildFormalKeputusanV25(raw, kegiatan){
  const pts=textToPointsV25(raw, "");
  const base=[
    `${kegiatan||"Kegiatan"} disepakati untuk ditindaklanjuti sesuai kebutuhan administrasi dan hasil musyawarah.`,
    "Pengurus RT bersama pihak terkait akan menyiapkan dokumen pendukung, daftar hadir, dokumentasi, dan bukti pertanggungjawaban.",
    "Pelaksanaan kegiatan dilakukan dengan tetap memperhatikan ketertiban administrasi, kesesuaian anggaran, dan asas transparansi kepada warga."
  ];
  const merged=[...pts,...base].filter((x,i,a)=>a.findIndex(y=>y.toLowerCase()===x.toLowerCase())===i);
  return merged.map(formalPointV25).join("\n");
}
function defaultActionPlanV25(kegiatan){
  return [
    ["Menyiapkan dokumen administrasi dan kelengkapan pendukung","Sebelum pelaksanaan kegiatan","Sekretaris RT / Pengurus"],
    ["Melaksanakan kegiatan sesuai hasil musyawarah","Sesuai jadwal yang ditetapkan","Ketua RT / Panitia"],
    ["Mengumpulkan dokumentasi, kuitansi, dan bukti pertanggungjawaban","Setelah kegiatan selesai","Bendahara / Notulis"]
  ];
}
function aiRapikanNotulenPengajuanV25(){
  collectAll();
  const mt=data.pengajuan.meeting || defaultData.pengajuan.meeting;
  const agenda=mt.rapatAgenda || "Pembahasan RAP BOP RT";
  mt.notPembahasan=buildFormalPembahasanV25(mt.notPembahasan,agenda,"Rapat");
  mt.notKeputusan=buildFormalKeputusanV25(mt.notKeputusan,mt.rapatJudul);
  if(!Number(mt.notHadir||0)) mt.notHadir=(data.pengajuan.peserta||[]).filter(x=>x&&x[0]).length || 0;
  if(!mt.notPimpinan) mt.notPimpinan=data.master.ketua||"";
  if(!mt.notNotulis) mt.notNotulis=data.master.sekretaris||"";
  if(!mt.actionPlan || !mt.actionPlan.length) mt.actionPlan=defaultActionPlanV25(mt.rapatJudul);
  localStorage.setItem(STORE,JSON.stringify(data));
  fillInputs();
  previewDoc("notulen");
  if(typeof notifyChangeV19==="function") notifyChangeV19("AI Notulen selesai","Notulen pengajuan dirapikan menjadi format resmi.","success");
}
function aiRapikanNotulenPkV25(){
  collectPersiapan();
  const p=data.persiapan;
  p.pembahasan=buildFormalPembahasanV25(p.pembahasan,p.agenda,"Kegiatan operasional");
  p.keputusan=buildFormalKeputusanV25(p.keputusan,p.nama);
  if(!Number(p.hadir||0)) p.hadir=(p.peserta||[]).filter(x=>x&&x[0]).length || 0;
  if(!p.pimpinan) p.pimpinan=data.master.ketua||"";
  if(!p.notulis) p.notulis=data.master.sekretaris||"";
  if(!p.action || !p.action.length) p.action=defaultActionPlanV25(p.nama);
  localStorage.setItem(STORE,JSON.stringify(data));
  fillPersiapan();
  previewPkDoc("pk-notulen");
  if(typeof notifyChangeV19==="function") notifyChangeV19("AI Notulen selesai","Notulen kegiatan operasional dirapikan menjadi format resmi.","success");
}
function aiRingkasPoinPengajuanV25(){
  collectAll();
  const mt=data.pengajuan.meeting || defaultData.pengajuan.meeting;
  mt.notPembahasan=textToPointsV25(mt.notPembahasan,mt.rapatAgenda).slice(0,8).map(formalPointV25).join("\n");
  mt.notKeputusan=textToPointsV25(mt.notKeputusan,mt.rapatJudul).slice(0,6).map(formalPointV25).join("\n");
  localStorage.setItem(STORE,JSON.stringify(data));
  fillInputs(); previewDoc("notulen");
  if(typeof notifyChangeV19==="function") notifyChangeV19("Poin diringkas","Pembahasan dan keputusan dibuat menjadi poin ringkas.","success");
}
function aiRingkasPoinPkV25(){
  collectPersiapan();
  const p=data.persiapan;
  p.pembahasan=textToPointsV25(p.pembahasan,p.agenda).slice(0,8).map(formalPointV25).join("\n");
  p.keputusan=textToPointsV25(p.keputusan,p.nama).slice(0,6).map(formalPointV25).join("\n");
  localStorage.setItem(STORE,JSON.stringify(data));
  fillPersiapan(); previewPkDoc("pk-notulen");
  if(typeof notifyChangeV19==="function") notifyChangeV19("Poin diringkas","Pembahasan dan keputusan kegiatan dibuat menjadi poin ringkas.","success");
}
function insertAiNotulenPanelsV25(){
  if($("aiNotulenPengajuanV25") || !$("notPembahasan")) return;
  const target=$("notPembahasan").closest(".panel");
  if(target){
    const box=document.createElement("div");
    box.id="aiNotulenPengajuanV25";
    box.className="ai-notulen-panel-v25";
    box.innerHTML=`<div class="ai-title"><span class="ai-icon">AI</span> Asisten Notulen Resmi</div>
      <div class="ai-desc">Tempel catatan mentah rapat pada kolom pembahasan/keputusan, lalu gunakan AI Notulen untuk merapikan bahasa, menyusun poin, melengkapi pimpinan/notulis, dan membuat format notulen resmi.</div>
      <div class="ai-actions">
        <button class="primary" type="button" onclick="aiRapikanNotulenPengajuanV25()">Rapikan Notulen dengan AI</button>
        <button class="secondary" type="button" onclick="aiRingkasPoinPengajuanV25()">Ringkas Jadi Poin</button>
        <button class="secondary" type="button" onclick="previewDoc('notulen')">Preview Notulen</button>
      </div>`;
    target.insertBefore(box,target.firstChild);
  }
  if($("aiNotulenPkV25") || !$("pkPembahasan")) return;
  const targetPk=$("pkPembahasan").closest(".panel") || $("tab-pk-notulen");
  if(targetPk){
    const box=document.createElement("div");
    box.id="aiNotulenPkV25";
    box.className="ai-notulen-panel-v25";
    box.innerHTML=`<div class="ai-title"><span class="ai-icon">AI</span> Asisten Notulen Kegiatan</div>
      <div class="ai-desc">Gunakan untuk membuat notulen kegiatan operasional/SPJ menjadi rapi, formal, terstruktur, dan siap dicetak.</div>
      <div class="ai-actions">
        <button class="primary" type="button" onclick="aiRapikanNotulenPkV25()">Rapikan Notulen dengan AI</button>
        <button class="secondary" type="button" onclick="aiRingkasPoinPkV25()">Ringkas Jadi Poin</button>
        <button class="secondary" type="button" onclick="previewPkDoc('pk-notulen')">Preview Notulen</button>
      </div>`;
    targetPk.insertBefore(box,targetPk.firstChild);
  }
}
function docNotulen(){
  const m=data.master, mt=data.pengajuan.meeting || defaultData.pengajuan.meeting;
  const pesertaRows = (data.pengajuan.peserta||[]).filter(r=>r&&r[0]).map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("");
  const actRows = (mt.actionPlan||[]).map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("");
  return official(`<div class="title">NOTULEN RAPAT / KEGIATAN</div>
  <table class="no-border notulen-meta-v25">
    <tr><td style="width:170px"><b>Judul/Tema Rapat</b></td><td>: ${esc(mt.rapatJudul)}</td></tr>
    <tr><td><b>Hari/Tanggal</b></td><td>: ${esc(mt.rapatHariTanggal)}</td></tr>
    <tr><td><b>Waktu</b></td><td>: ${esc(mt.rapatMulai)} s.d. ${esc(mt.rapatSelesai)}</td></tr>
    <tr><td><b>Tempat/Lokasi</b></td><td>: ${esc(mt.rapatTempat)}</td></tr>
    <tr><td><b>Pimpinan Rapat</b></td><td>: ${esc(mt.notPimpinan)||esc(m.ketua)||".................."}</td></tr>
    <tr><td><b>Notulis</b></td><td>: ${esc(mt.notNotulis)||esc(m.sekretaris)||".................."}</td></tr>
    <tr><td><b>Kehadiran</b></td><td>: Hadir ${Number(mt.notHadir||0)} orang, Tidak Hadir ${Number(mt.notTidakHadir||0)} orang</td></tr>
  </table>
  <div class="notulen-section-title-v25">I. Agenda Rapat</div>
  ${pointsHtmlV25(textToPointsV25(mt.rapatAgenda,"Pembahasan agenda rapat"))}
  <div class="notulen-section-title-v25">II. Pembahasan</div>
  ${pointsHtmlV25(textToPointsV25(mt.notPembahasan,"Pembahasan rapat"))}
  <div class="notulen-section-title-v25">III. Hasil Keputusan</div>
  ${pointsHtmlV25(textToPointsV25(mt.notKeputusan,"Hasil keputusan rapat"))}
  <div class="notulen-section-title-v25">IV. Rencana Tindak Lanjut</div>
  <table><thead><tr><th>No</th><th>Tugas/Tindak Lanjut</th><th>Target Waktu</th><th>Penanggung Jawab</th></tr></thead><tbody>${actRows||'<tr><td>1</td><td></td><td></td><td></td></tr>'}</tbody></table>
  <div class="notulen-section-title-v25">V. Penutup</div>
  <p class="notulen-paragraph-v25">Demikian notulen ini dibuat sebagai catatan resmi rapat/kegiatan dan sebagai dasar tindak lanjut administrasi RT.</p>
  <p style="text-align:right;margin-top:18px">${typeof todaySemarangV18==="function"?todaySemarangV18():"Semarang, tanggal bulan tahun"}</p>
  <div class="ttd-grid"><div>Pimpinan Rapat<div class="signature-space"></div>${esc(mt.notPimpinan)||esc(m.ketua)||"Nama Jelas"}</div><div>Notulis<div class="signature-space"></div>${esc(mt.notNotulis)||esc(m.sekretaris)||"Nama Jelas"}</div></div>`);
}
function docPkNotulen(){
  const m=data.master,p=data.persiapan;
  const act=(p.action||[]).map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("");
  return official(`<div class="title">NOTULEN KEGIATAN OPERASIONAL</div>
  <table class="no-border notulen-meta-v25">
    <tr><td style="width:170px"><b>Jenis Kegiatan</b></td><td>: ${esc(p.jenis)}</td></tr>
    <tr><td><b>Judul/Tema</b></td><td>: ${esc(p.nama)}</td></tr>
    <tr><td><b>Hari/Tanggal</b></td><td>: ${esc(p.hariTanggal)}</td></tr>
    <tr><td><b>Waktu</b></td><td>: ${esc(p.waktu)}</td></tr>
    <tr><td><b>Tempat</b></td><td>: ${esc(p.tempat)}</td></tr>
    <tr><td><b>Pimpinan</b></td><td>: ${esc(p.pimpinan)||esc(m.ketua)||".................."}</td></tr>
    <tr><td><b>Notulis</b></td><td>: ${esc(p.notulis)||esc(m.sekretaris)||".................."}</td></tr>
    <tr><td><b>Kehadiran</b></td><td>: Hadir ${Number(p.hadir||0)} orang, Tidak Hadir ${Number(p.tidakHadir||0)} orang</td></tr>
  </table>
  <div class="notulen-section-title-v25">I. Agenda Kegiatan</div>
  ${pointsHtmlV25(textToPointsV25(p.agenda,"Pelaksanaan kegiatan operasional"))}
  <div class="notulen-section-title-v25">II. Pembahasan</div>
  ${pointsHtmlV25(textToPointsV25(p.pembahasan,"Pembahasan kegiatan"))}
  <div class="notulen-section-title-v25">III. Hasil Keputusan</div>
  ${pointsHtmlV25(textToPointsV25(p.keputusan,"Hasil keputusan kegiatan"))}
  <div class="notulen-section-title-v25">IV. Rencana Tindak Lanjut</div>
  <table><thead><tr><th>No</th><th>Tugas/Tindak Lanjut</th><th>Target Waktu</th><th>PIC</th></tr></thead><tbody>${act||'<tr><td>1</td><td></td><td></td><td></td></tr>'}</tbody></table>
  <div class="notulen-section-title-v25">V. Penutup</div>
  <p class="notulen-paragraph-v25">Demikian notulen kegiatan ini dibuat sebagai bukti administrasi, dasar pelaksanaan tindak lanjut, dan kelengkapan pertanggungjawaban kegiatan operasional RT.</p>
  <p style="text-align:right;margin-top:18px">${typeof todaySemarangV18==="function"?todaySemarangV18():"Semarang, tanggal bulan tahun"}</p>
  <div class="ttd-grid"><div>Pimpinan<div class="signature-space"></div>${esc(p.pimpinan)||esc(m.ketua)||"Nama Jelas"}</div><div>Notulis<div class="signature-space"></div>${esc(p.notulis)||esc(m.sekretaris)||"Nama Jelas"}</div></div>`);
}


/* PATCH v1.26 - Notulen AI Reasoning Engine Baku
   Mengubah data mentah rapat menjadi notulen resmi dengan alur:
   masalah -> tujuan -> pembahasan -> keputusan -> tindak lanjut.
   Patch ini tetap berjalan offline/lokal tanpa API internet. */
function placeholderV26(v){
  const s=String(v??"").trim();
  return s || "........................................";
}
function sentenceV26(s){
  return formalPointV25(String(s||"").replace(/\s+/g," ").trim());
}
function numberToWordsCurrencyV26(n){
  return `${rupiah(n)} atau ${terbilang(Number(n||0)).replace(/\s+/g," ").trim()} Rupiah`;
}
function rapRowsV26(){
  if(typeof normalizeRapV17==="function") normalizeRapV17();
  return (data.pengajuan?.rap||[]).map(r=>Array.isArray(r)?{
    uraian:r[0]||"", volume:r[1]||"", jumlah:Number(r[2]||0), keterangan:r[3]||"", kategori:"", subKategori:""
  }:{
    uraian:r.uraian||"", volume:r.volume||"", jumlah:Number(r.jumlah||0), keterangan:r.keterangan||"", kategori:r.kategori||"", subKategori:r.subKategori||""
  });
}
function totalBopV26(){
  const fixed=25000000;
  const total=rapRowsV26().reduce((s,r)=>s+Number(r.jumlah||0),0);
  return total>0 ? fixed : fixed;
}
function agendaTextV26(){
  const mt=data.pengajuan?.meeting || defaultData.pengajuan.meeting;
  const raw=[mt.rapatAgenda, mt.notPembahasan].filter(Boolean).join(". ");
  return raw || "Pembahasan agenda kegiatan, kebutuhan anggaran, pelaksanaan kegiatan, pembagian tugas, serta kelengkapan dokumen administrasi.";
}
function agendaPointsV26(){
  const raw=agendaTextV26();
  const pts=textToPointsV25(raw, raw).slice(0,8);
  const lower=raw.toLowerCase();
  const wajib=[];
  if(!/agenda|kegiatan/.test(lower)) wajib.push("Pembahasan agenda kegiatan RT selama 1 tahun anggaran");
  if(!/anggaran|rap|bop/.test(lower)) wajib.push("Pembahasan kebutuhan anggaran dan penyusunan RAP BOP RT/RW");
  if(!/pelaksanaan/.test(lower)) wajib.push("Pembahasan mekanisme pelaksanaan kegiatan");
  if(!/tugas|pembagian/.test(lower)) wajib.push("Pembahasan pembagian tugas pengurus dan warga");
  if(!/dokumen|administrasi|ruang warga/.test(lower)) wajib.push("Pembahasan kelengkapan dokumen administrasi untuk Aplikasi Website Ruang Warga");
  return [...pts,...wajib].filter((x,i,a)=>a.findIndex(y=>String(y).toLowerCase()===String(x).toLowerCase())===i);
}
function identifikasiMasalahV26(){
  const b=totalBopV26();
  return [
    "Perlunya penyusunan agenda kegiatan RT selama 1 tahun anggaran agar kegiatan yang dilaksanakan sesuai dengan kebutuhan warga dan ketentuan administrasi.",
    `Perlunya penentuan kebutuhan anggaran Bantuan Operasional RT/RW sebesar ${rupiah(b)} berdasarkan pos-pos anggaran yang telah ditentukan.`,
    "Perlunya penyusunan RAP BOP RT/RW sebagai dasar pelaksanaan kegiatan dan pengajuan kepada Pemerintah Kota Semarang.",
    "Perlunya mekanisme pelaksanaan kegiatan yang tertib, transparan, terdokumentasi, dan dapat dipertanggungjawabkan.",
    "Perlunya pembagian tugas antara Ketua RT, Sekretaris RT, Bendahara RT, pengurus, dan warga agar pelaksanaan kegiatan berjalan efektif.",
    "Perlunya kelengkapan dokumen administrasi untuk mendukung pengajuan melalui Aplikasi Website Ruang Warga."
  ];
}
function rumusanMasalahV26(){
  return [
    "Bagaimana menyusun agenda kegiatan RT selama 1 tahun anggaran agar sesuai dengan kebutuhan warga?",
    "Bagaimana menetapkan kebutuhan anggaran sesuai pos-pos kegiatan yang telah ditentukan?",
    "Bagaimana menyusun RAP BOP RT/RW agar siap digunakan sebagai dasar pengajuan melalui Aplikasi Website Ruang Warga?",
    "Bagaimana mekanisme pelaksanaan kegiatan agar berjalan tertib, transparan, dan dapat dipertanggungjawabkan?",
    "Bagaimana pembagian tugas antara Ketua RT, Sekretaris RT, Bendahara RT, pengurus, dan warga?",
    "Dokumen administrasi apa saja yang harus dilengkapi untuk mendukung pengajuan kepada Pemerintah Kota Semarang?"
  ];
}
function tujuanRapatV26(){
  return [
    "Membahas dan menyepakati agenda kegiatan RT selama 1 tahun anggaran.",
    "Membahas dan menyepakati kebutuhan anggaran BOP RT/RW berdasarkan pos-pos anggaran yang telah ditentukan.",
    "Menyusun dan menyepakati RAP BOP RT/RW Tahun Anggaran 2026.",
    "Menentukan mekanisme pelaksanaan kegiatan agar tertib dan dapat dipertanggungjawabkan.",
    "Menetapkan pembagian tugas pengurus dan warga dalam pelaksanaan kegiatan serta penyusunan administrasi.",
    "Menyiapkan kelengkapan dokumen administrasi untuk pengajuan melalui Aplikasi Website Ruang Warga."
  ];
}
function keputusanV26(){
  const b=totalBopV26();
  return [
    "Menyetujui penyusunan agenda kegiatan RT selama 1 tahun anggaran.",
    "Menyetujui penyusunan RAP BOP RT/RW Tahun Anggaran 2026 sebagai dasar pelaksanaan kegiatan dan pengajuan administrasi.",
    `Menyetujui total anggaran Bantuan Operasional RT/RW sebesar ${rupiah(b)}.`,
    "Menyetujui pos-pos anggaran yang telah ditentukan dan dituangkan dalam RAP 1 tahun.",
    "Menyetujui pelaksanaan kegiatan secara bertahap sesuai rencana, kebutuhan warga, dan ketentuan administrasi.",
    "Menyetujui pembagian tugas antara Ketua RT, Sekretaris RT, Bendahara RT, pengurus, dan warga.",
    "Menyetujui kelengkapan dokumen administrasi sebagai syarat pengajuan melalui Aplikasi Website Ruang Warga.",
    "Menyetujui bahwa seluruh kegiatan dan penggunaan anggaran dilaksanakan secara tertib, transparan, dan dapat dipertanggungjawabkan."
  ];
}
function tindakLanjutV26(){
  const mt=data.pengajuan?.meeting || defaultData.pengajuan.meeting;
  const base=[
    ["Menyusun dan merapikan dokumen notulen, berita acara, daftar hadir, dan dokumen pendukung lainnya.","Sebelum pengajuan","Sekretaris RT"],
    ["Menyiapkan RAP, rincian anggaran, serta dokumen pendukung keuangan.","Sebelum pengajuan","Bendahara RT"],
    ["Melakukan pemeriksaan akhir terhadap kelengkapan dokumen administrasi.","Sebelum upload","Ketua RT"],
    ["Melengkapi dokumentasi rapat/kegiatan dan data pendukung.","Sebelum upload","Pengurus RT dan warga"],
    ["Mengajukan dokumen RAP dan kelengkapan administrasi melalui Aplikasi Website Ruang Warga.","Setelah dokumen lengkap","Ketua RT / Sekretaris RT"],
    ["Memantau proses pengajuan dan verifikasi dari Pemerintah Kota Semarang.","Setelah pengajuan","Pengurus RT"]
  ];
  const custom=(mt.actionPlan||[]).filter(r=>r&&r[0]);
  return custom.length>=4 ? custom : base;
}
function kelengkapanDocsV26(){
  return [
    "Surat Permohonan Pencairan Bantuan Operasional RT/RW.",
    "RAP BOP RT/RW 1 tahun anggaran.",
    "Berita Acara Musyawarah/Rapat Kesepakatan RAP.",
    "Daftar Hadir Peserta Rapat.",
    "Notulen Rapat Resmi.",
    "Dokumentasi Rapat/Kegiatan.",
    "SPTJM atau dokumen pernyataan tanggung jawab sesuai ketentuan.",
    "Dokumen pendukung lainnya sesuai kebutuhan Aplikasi Website Ruang Warga."
  ];
}
function olV26(items){
  return `<ol class="notulen-list-v25">${(items||[]).map(x=>`<li>${esc(sentenceV26(x))}</li>`).join("")}</ol>`;
}
function rapMiniTableV26(){
  const rows=rapRowsV26();
  if(!rows.length) return `<p class="notulen-paragraph-v25">Pos-pos anggaran telah ditentukan dan dituangkan dalam RAP 1 tahun.</p>`;
  return `<table><thead><tr><th>No</th><th>Pos/Uraian Kegiatan</th><th>Volume</th><th>Anggaran</th><th>Keterangan</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.uraian)}${r.kategori?`<br><small>${esc(r.kategori)}${r.subKategori?" - "+esc(r.subKategori):""}</small>`:""}</td><td>${esc(r.volume)}</td><td>${rupiah(r.jumlah)}</td><td>${esc(r.keterangan)}</td></tr>`).join("")}<tr><td colspan="3"><b>Jumlah RAP</b></td><td><b>${rupiah(rows.reduce((s,r)=>s+Number(r.jumlah||0),0))}</b></td><td></td></tr></tbody></table>`;
}
function actionTableV26(rows){
  return `<table><thead><tr><th>No</th><th>Tindak Lanjut</th><th>Target Waktu</th><th>Penanggung Jawab</th></tr></thead><tbody>${(rows||[]).map((r,i)=>`<tr><td>${i+1}</td><td>${esc(sentenceV26(r[0]||""))}</td><td>${esc(r[1]||"")}</td><td>${esc(r[2]||"")}</td></tr>`).join("")}</tbody></table>`;
}
function aiIsiDefaultNotulenV26(){
  collectAll();
  const m=data.master, mt=data.pengajuan.meeting || defaultData.pengajuan.meeting;
  if(!m.ketua) m.ketua="Bapak Karsimin";
  if(!m.rt) m.rt="005"; if(!m.rw) m.rw="012"; if(!m.kelurahan) m.kelurahan="Tegalsari"; if(!m.kecamatan) m.kecamatan="Candisari"; if(!m.kota) m.kota="Semarang";
  if(!mt.rapatJudul) mt.rapatJudul="Rapat Pembahasan Rencana Anggaran Penggunaan BOP RT 005 RW 012";
  if(!mt.rapatAgenda) mt.rapatAgenda="Pembahasan agenda kegiatan, kebutuhan anggaran, pelaksanaan kegiatan, pembagian tugas, serta kelengkapan dokumen administrasi.";
  if(!mt.notPimpinan) mt.notPimpinan=m.ketua;
  if(!mt.notNotulis) mt.notNotulis=m.sekretaris||"........................................";
  if(!Number(mt.notHadir||0)) mt.notHadir=14;
  mt.actionPlan=tindakLanjutV26();
  localStorage.setItem(STORE,JSON.stringify(data));
  fillInputs();
  previewDoc("notulen");
  if(typeof notifyChangeV19==="function") notifyChangeV19("Default RT 005 diterapkan","Data dasar notulen BOP RT 005 sudah diisi dan siap dipreview.","success");
}
function aiBuatNotulenReasoningV26(){
  collectAll();
  const mt=data.pengajuan.meeting || defaultData.pengajuan.meeting;
  if(!mt.notPimpinan) mt.notPimpinan=data.master.ketua||"Bapak Karsimin";
  if(!mt.notNotulis) mt.notNotulis=data.master.sekretaris||"";
  if(!Number(mt.notHadir||0)) mt.notHadir=(data.pengajuan.peserta||[]).filter(x=>x&&x[0]).length || 14;
  mt.notPembahasan=[
    "Rapat membahas agenda kegiatan RT selama 1 tahun anggaran berdasarkan kebutuhan warga dan ketentuan administrasi BOP RT/RW.",
    `Rapat membahas kebutuhan anggaran sebesar ${rupiah(totalBopV26())} yang dituangkan ke dalam pos-pos anggaran RAP 1 tahun.`,
    "Rapat membahas mekanisme pelaksanaan kegiatan agar tertib, transparan, terdokumentasi, dan dapat dipertanggungjawabkan.",
    "Rapat membahas pembagian tugas Ketua RT, Sekretaris RT, Bendahara RT, pengurus, dan warga.",
    "Rapat membahas kelengkapan dokumen administrasi untuk pengajuan kepada Pemerintah Kota Semarang melalui Aplikasi Website Ruang Warga."
  ].join("\n");
  mt.notKeputusan=keputusanV26().join("\n");
  mt.actionPlan=tindakLanjutV26();
  localStorage.setItem(STORE,JSON.stringify(data));
  fillInputs();
  previewDoc("notulen");
  if(typeof notifyChangeV19==="function") notifyChangeV19("AI Reasoning Notulen selesai","Notulen resmi baku telah dibuat dengan alur masalah, tujuan, pembahasan, keputusan, dan tindak lanjut.","success");
}
function insertAiNotulenPanelsV25(){
  if($("aiNotulenPengajuanV26") || !$("notPembahasan")) return;
  const target=$("notPembahasan").closest(".panel");
  if(target){
    const box=document.createElement("div");
    box.id="aiNotulenPengajuanV26";
    box.className="ai-notulen-panel-v25 ai-notulen-panel-v26";
    box.innerHTML=`<div class="ai-title"><span class="ai-icon">AI</span> Engine Notulen Baku v1.26</div>
      <div class="ai-desc"><b>Mode baru:</b> aplikasi cukup menerima data mentah rapat, lalu engine lokal menyusun notulen resmi dengan alur <b>Masalah → Tujuan → Pembahasan → Keputusan → Tindak Lanjut</b>. Cocok untuk RAP BOP RT/RW dan upload Ruang Warga.</div>
      <div class="ai-actions">
        <button class="primary" type="button" onclick="aiBuatNotulenReasoningV26()">Buat Notulen Baku dari Data Mentah</button>
        <button class="secondary" type="button" onclick="aiIsiDefaultNotulenV26()">Isi Default RT 005</button>
        <button class="secondary" type="button" onclick="aiRingkasPoinPengajuanV25()">Rapikan Poin Mentah</button>
        <button class="secondary" type="button" onclick="previewDoc('notulen')">Preview Notulen</button>
      </div>`;
    target.insertBefore(box,target.firstChild);
  }
  if($("aiNotulenPkV26") || !$("pkPembahasan")) return;
  const targetPk=$("pkPembahasan").closest(".panel") || $("tab-pk-notulen");
  if(targetPk){
    const box=document.createElement("div");
    box.id="aiNotulenPkV26";
    box.className="ai-notulen-panel-v25 ai-notulen-panel-v26";
    box.innerHTML=`<div class="ai-title"><span class="ai-icon">AI</span> Engine Notulen Kegiatan v1.26</div>
      <div class="ai-desc">Untuk kegiatan operasional/SPJ, engine tetap dapat merapikan catatan mentah menjadi notulen formal, poin keputusan, dan tindak lanjut.</div>
      <div class="ai-actions">
        <button class="primary" type="button" onclick="aiRapikanNotulenPkV25()">Rapikan Notulen Kegiatan</button>
        <button class="secondary" type="button" onclick="aiRingkasPoinPkV25()">Ringkas Jadi Poin</button>
        <button class="secondary" type="button" onclick="previewPkDoc('pk-notulen')">Preview Notulen</button>
      </div>`;
    targetPk.insertBefore(box,targetPk.firstChild);
  }
}

function notulenSignatureTableV28(m,pimpinan,notulis){
  const rt=esc(m.rt||"005"), rw=esc(m.rw||"012"), kel=esc(m.kelurahan||"Tegalsari");
  const bendahara=esc(m.bendahara)||"........................................";
  return `<table class="notulen-sign-table-v28">
    <tr>
      <td>Mengetahui,<br><b>Ketua RT ${rt} RW ${rw}</b><br>Kelurahan ${kel}</td>
      <td><b>Notulis / Sekretaris RT ${rt}</b></td>
      <td><b>Bendahara RT ${rt}</b></td>
    </tr>
    <tr class="sign-space-row-v28"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
    <tr>
      <td><b>${esc(pimpinan)}</b></td>
      <td><b>${esc(notulis)}</b></td>
      <td><b>${bendahara}</b></td>
    </tr>
  </table>`;
}

function docNotulen(){
  const m=data.master, mt=data.pengajuan.meeting || defaultData.pengajuan.meeting;
  const b=totalBopV26();
  const unsur=`Ketua RT, Sekretaris RT, Bendahara RT, Pengurus RT, dan Warga RT ${esc(m.rt||"005")} RW ${esc(m.rw||"012")}`;
  const hariTanggal=placeholderV26(mt.rapatHariTanggal);
  const waktu=[mt.rapatMulai, mt.rapatSelesai].filter(Boolean).join(" s.d. ") || "........................................";
  const notulis=placeholderV26(mt.notNotulis || m.sekretaris);
  const pimpinan=placeholderV26(mt.notPimpinan || m.ketua || "Bapak Karsimin");
  return official(`<div class="notulen-doc-v28"><div class="title">NOTULEN RAPAT RESMI<br>PEMBAHASAN RENCANA ANGGARAN PELAKSANAAN BOP RT/RW<br>TAHUN ANGGARAN 2026<br>RT ${esc(m.rt||"005")} RW ${esc(m.rw||"012")} KELURAHAN ${esc(m.kelurahan||"Tegalsari").toUpperCase()}<br>KECAMATAN ${esc(m.kecamatan||"Candisari").toUpperCase()} KOTA ${esc(m.kota||"Semarang").toUpperCase()}</div>

  <div class="notulen-section-title-v25 notulen-section-title-v28"><b>A. IDENTITAS RAPAT</b></div>
  <table class="no-border notulen-meta-v25 notulen-meta-v28">
    <tr><td style="width:175px"><b>Hari/Tanggal</b></td><td>: ${esc(hariTanggal)}</td></tr>
    <tr><td><b>Waktu</b></td><td>: ${esc(waktu)}</td></tr>
    <tr><td><b>Tempat</b></td><td>: ${esc(placeholderV26(mt.rapatTempat))}</td></tr>
    <tr><td><b>Agenda Rapat</b></td><td>: ${esc(placeholderV26(mt.rapatJudul || mt.rapatAgenda))}</td></tr>
    <tr><td><b>Pimpinan Rapat</b></td><td>: ${esc(pimpinan)}</td></tr>
    <tr><td><b>Jabatan</b></td><td>: Ketua RT ${esc(m.rt||"005")} RW ${esc(m.rw||"012")}</td></tr>
    <tr><td><b>Notulis</b></td><td>: ${esc(notulis)}</td></tr>
    <tr><td><b>Jumlah Peserta</b></td><td>: ${Number(mt.notHadir||0)||14} orang</td></tr>
    <tr><td><b>Unsur Peserta</b></td><td>: ${unsur}</td></tr>
  </table>

  <div class="notulen-section-title-v25 notulen-section-title-v28"><b>B. LATAR BELAKANG</b></div>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28">Dalam rangka mendukung kelancaran pelaksanaan kegiatan kemasyarakatan, pelayanan administrasi lingkungan, pemberdayaan warga, serta peningkatan partisipasi masyarakat di wilayah RT ${esc(m.rt||"005")} RW ${esc(m.rw||"012")} Kelurahan ${esc(m.kelurahan||"Tegalsari")}, Kecamatan ${esc(m.kecamatan||"Candisari")}, Kota ${esc(m.kota||"Semarang")}, diperlukan perencanaan kegiatan dan penyusunan kebutuhan anggaran yang tertib, transparan, dan dapat dipertanggungjawabkan.</p>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28">Sehubungan dengan pengajuan Bantuan Operasional RT/RW kepada Pemerintah Kota Semarang melalui Aplikasi Website Ruang Warga, RT ${esc(m.rt||"005")} RW ${esc(m.rw||"012")} perlu menyusun RAP untuk periode 1 tahun anggaran dengan total anggaran sebesar <b>${rupiah(b)}</b>. Penyusunan tersebut dibahas melalui musyawarah agar agenda kegiatan, kebutuhan anggaran, pembagian tugas, dan kelengkapan dokumen administrasi dapat disepakati bersama.</p>

  <div class="notulen-section-title-v25 notulen-section-title-v28"><b>C. IDENTIFIKASI MASALAH</b></div>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28">Berdasarkan kebutuhan pelaksanaan kegiatan dan administrasi pengajuan BOP RT/RW, terdapat beberapa permasalahan pokok yang perlu dibahas, yaitu:</p>
  ${olV26(identifikasiMasalahV26())}

  <div class="notulen-section-title-v25 notulen-section-title-v28"><b>D. RUMUSAN MASALAH</b></div>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28">Berdasarkan identifikasi masalah tersebut, maka rumusan masalah dalam rapat ini adalah sebagai berikut:</p>
  ${olV26(rumusanMasalahV26())}

  <div class="notulen-section-title-v25 notulen-section-title-v28"><b>E. TUJUAN RAPAT</b></div>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28">Rapat ini dilaksanakan dengan tujuan sebagai berikut:</p>
  ${olV26(tujuanRapatV26())}

  <div class="notulen-section-title-v25 notulen-section-title-v28"><b>F. POKOK PEMBAHASAN</b></div>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28"><b>1. Pembahasan Agenda Kegiatan.</b> Rapat membahas rencana agenda kegiatan RT selama 1 tahun anggaran. Agenda disusun berdasarkan kebutuhan warga, kepentingan lingkungan, kegiatan sosial kemasyarakatan, pemberdayaan masyarakat, kebersamaan warga, serta kebutuhan administrasi RT.</p>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28"><b>2. Pembahasan Kebutuhan Anggaran.</b> Total anggaran yang dibahas dalam rapat ini adalah sebesar <b>${numberToWordsCurrencyV26(b)}</b>. Anggaran tersebut disusun berdasarkan pos-pos kegiatan yang telah ditentukan dengan memperhatikan asas kebutuhan, kewajaran, manfaat, transparansi, dan akuntabilitas.</p>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28"><b>3. Penyusunan RAP 1 Tahun.</b> RAP disusun untuk periode 1 tahun anggaran dan menjadi dasar pelaksanaan kegiatan serta pengajuan Bantuan Operasional RT/RW kepada Pemerintah Kota Semarang melalui Aplikasi Website Ruang Warga.</p>
  ${rapMiniTableV26()}
  <p class="notulen-paragraph-v25 notulen-paragraph-v28"><b>4. Pelaksanaan Kegiatan.</b> Pelaksanaan kegiatan dilakukan secara bertahap sesuai rencana kegiatan dan pos anggaran. Setiap kegiatan wajib dilengkapi dokumentasi, bukti pengeluaran, serta administrasi pertanggungjawaban.</p>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28"><b>5. Pembagian Tugas.</b> Ketua RT bertugas sebagai penanggung jawab umum. Sekretaris RT menyiapkan administrasi, surat menyurat, notulen, berita acara, dan daftar hadir. Bendahara RT menyusun RAP, melakukan pencatatan keuangan, mengumpulkan bukti pengeluaran, dan menyiapkan laporan pertanggungjawaban. Pengurus RT dan warga membantu pelaksanaan kegiatan, dokumentasi, serta dukungan teknis di lapangan.</p>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28"><b>6. Kelengkapan Dokumen Administrasi.</b> Dokumen administrasi yang disiapkan meliputi:</p>
  ${olV26(kelengkapanDocsV26())}

  <div class="notulen-section-title-v25 notulen-section-title-v28"><b>G. HASIL KEPUTUSAN RAPAT</b></div>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28">Berdasarkan hasil pembahasan dan musyawarah, rapat memutuskan sebagai berikut:</p>
  ${olV26(keputusanV26())}

  <div class="notulen-section-title-v25 notulen-section-title-v28"><b>H. RENCANA TINDAK LANJUT</b></div>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28">Sebagai tindak lanjut dari hasil rapat, disepakati langkah-langkah sebagai berikut:</p>
  ${actionTableV26(tindakLanjutV26())}

  <div class="notulen-section-title-v25 notulen-section-title-v28"><b>I. KESIMPULAN</b></div>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28">Rapat RT ${esc(m.rt||"005")} RW ${esc(m.rw||"012")} Kelurahan ${esc(m.kelurahan||"Tegalsari")} telah menghasilkan kesepakatan bersama mengenai penyusunan agenda kegiatan, kebutuhan anggaran, RAP 1 tahun, pelaksanaan kegiatan, pembagian tugas, serta kelengkapan dokumen administrasi pengajuan BOP RT/RW. Dengan total anggaran sebesar <b>${rupiah(b)}</b>, dokumen RAP dan kelengkapan administrasi disiapkan untuk diajukan kepada Pemerintah Kota Semarang melalui Aplikasi Website Ruang Warga.</p>

  <div class="notulen-section-title-v25 notulen-section-title-v28"><b>J. PENUTUP</b></div>
  <p class="notulen-paragraph-v25 notulen-paragraph-v28">Demikian notulen rapat ini dibuat dengan sebenar-benarnya sebagai dokumen resmi hasil musyawarah RT ${esc(m.rt||"005")} RW ${esc(m.rw||"012")} Kelurahan ${esc(m.kelurahan||"Tegalsari")}, Kecamatan ${esc(m.kecamatan||"Candisari")}, Kota ${esc(m.kota||"Semarang")}. Notulen ini digunakan sebagai salah satu kelengkapan administrasi pengajuan Bantuan Operasional RT/RW Tahun Anggaran 2026 kepada Pemerintah Kota Semarang melalui Aplikasi Website Ruang Warga.</p>
  <p class="notulen-date-v28">Semarang, ................................ 2026</p>
  ${notulenSignatureTableV28(m,pimpinan,notulis)}</div>`);
}

/* PATCH v1.29 - Unified BOP + MoKu, LPJ AI Terbaru, Autofit Kolom Nomor */
function safeTextV29(v, fallback="........................................"){
  const s=String(v ?? "").trim();
  return s || fallback;
}
function moneyTextV29(n){ return `${rupiah(Number(n||0))} (${terbilang(Number(n||0)).replace(/\s+/g," ").trim()} Rupiah)`; }
function sumSaldoV29(){ const l=data.lpj||{}; return Number(l.saldoAwal||0)+Number(l.saldoBulanLalu||0); }
function docsImportedV29(){ ensureMobileSync?.(); return (data.mobileSync && Array.isArray(data.mobileSync.imported)) ? data.mobileSync.imported : []; }
function lpjExpenseRowsV29(){
  const rows=(data.lpj?.pengeluaran||[]).filter(r=>r && (r[0]||r[1]||r[2]||r[3]));
  if(!rows.length) return `<tr><td colspan="5">Belum ada rincian pengeluaran.</td></tr>`;
  return rows.map((r,i)=>`<tr>
    <td class="no-col-v29">${i+1}</td>
    <td>${esc(safeTextV29(r[0],"-"))}</td>
    <td>${esc(safeTextV29(r[1],"-"))}</td>
    <td class="amount-col-v29">${rupiah(Number(r[2]||0))}</td>
    <td>${esc(safeTextV29(r[3],"-"))}</td>
  </tr>`).join("");
}
function lpjDocsRowsV29(){
  const docs=docsImportedV29();
  if(!docs.length) return `<tr><td colspan="5">Belum ada dokumentasi MoKu yang di-import. Dokumentasi dapat dilengkapi melalui menu MoKu Mobile.</td></tr>`;
  return docs.map((d,i)=>`<tr>
    <td class="no-col-v29">${i+1}</td>
    <td>${esc(d.nama||`Kegiatan ${i+1}`)}</td>
    <td>${esc(d.hariTanggal||d.tanggal||"-")}</td>
    <td>${esc(d.tempat||d.lokasi||"-")}</td>
    <td>${(d.photos||[]).length} foto</td>
  </tr>`).join("");
}
function lpjAdminCheckRowsV29(){
  const l=data.lpj||{};
  const total=totalExpense();
  const sisa=sumSaldoV29()-total;
  const docs=docsImportedV29();
  const checks=[
    ["Data identitas laporan", l.periode && data.master?.rt && data.master?.rw ? "Lengkap" : "Perlu dilengkapi", "Periode, RT/RW, kelurahan, dan kecamatan menjadi dasar laporan."],
    ["Rincian pengeluaran", (l.pengeluaran||[]).length ? "Terisi" : "Belum terisi", "Setiap pengeluaran harus didukung bukti transaksi."],
    ["Kesesuaian saldo", sisa>=0 ? "Terkendali" : "Perlu koreksi", "Sisa dana dihitung otomatis dari saldo awal, saldo bulan lalu, dan total pengeluaran."],
    ["Dokumentasi kegiatan", docs.length ? "Ada dokumentasi" : "Belum ada dokumentasi", "Dokumentasi dapat berasal dari MoKu Mobile."],
    ["Bukti pertanggungjawaban", "Wajib dilampirkan", "Nota/kuitansi/tanda terima dan dokumentasi kegiatan disimpan sebagai data dukung SPJ."]
  ];
  return checks.map((r,i)=>`<tr><td class="no-col-v29">${i+1}</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("");
}
function lpjFollowupRowsV29(){
  const rows=[
    ["Bendahara RT", "Melengkapi bukti pengeluaran, kuitansi, nota, dan tanda terima sesuai transaksi."],
    ["Sekretaris/Notulis", "Merapikan dokumen administrasi kegiatan, daftar hadir, notulen, dan dokumentasi pendukung."],
    ["Ketua RT", "Memeriksa kelengkapan laporan sebelum diarsipkan dan/atau diunggah ke sistem Ruang Warga."],
    ["Pengurus/Petugas MoKu", "Melengkapi foto dokumentasi kegiatan dan memastikan identitas kegiatan, lokasi, tanggal, serta petugas tercatat."],
    ["Pengurus RT", "Melakukan pengarsipan SPJ bulanan secara tertib agar mudah diperiksa kembali."],
  ];
  return rows.map((r,i)=>`<tr><td class="no-col-v29">${i+1}</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("");
}
function lpjSignatureTableV29(){
  const m=data.master||{}, l=data.lpj||{};
  return `<table class="lpj-signature-table-v29 no-border">
    <tr>
      <td>Mengetahui,<br><b>Ketua RT ${esc(m.rt||"005")} RW ${esc(m.rw||"012")}</b></td>
      <td><b>Bendahara RT ${esc(m.rt||"005")} RW ${esc(m.rw||"012")}</b></td>
    </tr>
    <tr class="sign-space-row-v29"><td>&nbsp;</td><td>&nbsp;</td></tr>
    <tr>
      <td><b>${esc(l.ketua || m.ketua || "Nama Jelas")}</b></td>
      <td><b>${esc(l.bendahara || m.bendahara || "Nama Jelas")}</b></td>
    </tr>
  </table>`;
}
function docLpj(){
  collectAll?.();
  const m=data.master||{}, l=data.lpj||{};
  const now=safeTextV29(l.tanggalCetak, new Date().toLocaleString("id-ID"));
  const total=totalExpense();
  const penerimaan=sumSaldoV29();
  const sisa=penerimaan-total;
  return official(`<div class="lpj-doc-v29">
    <div class="title">LAPORAN PERTANGGUNGJAWABAN PENGGUNAAN<br>BANTUAN OPERASIONAL RT/RW<br>TAHUN ANGGARAN 2026</div>

    <div class="notulen-section-title-v25 notulen-section-title-v28"><b>A. IDENTITAS LAPORAN</b></div>
    <table class="no-border lpj-meta-v29">
      <tr><td style="width:190px"><b>Tanggal Cetak</b></td><td>: ${esc(now)}</td></tr>
      <tr><td><b>Dicetak Oleh</b></td><td>: ${esc(safeTextV29(l.dicetakOleh,"Kelurahan Tegalsari RW 12 RT 5"))}</td></tr>
      <tr><td><b>Periode Bulan/Tahun</b></td><td>: ${esc(safeTextV29(l.periode,"........................................"))}</td></tr>
      <tr><td><b>Kecamatan</b></td><td>: ${esc(m.kecamatan||"Candisari")}</td></tr>
      <tr><td><b>Kelurahan</b></td><td>: ${esc(m.kelurahan||"Tegalsari")}</td></tr>
      <tr><td><b>RW</b></td><td>: ${esc(m.rw||"012")}</td></tr>
      <tr><td><b>RT</b></td><td>: ${esc(m.rt||"005")}</td></tr>
    </table>

    <div class="notulen-section-title-v25 notulen-section-title-v28"><b>B. DASAR DAN TUJUAN PERTANGGUNGJAWABAN</b></div>
    <p class="notulen-paragraph-v25 notulen-paragraph-v28">Laporan ini disusun sebagai bentuk pertanggungjawaban penggunaan Bantuan Operasional RT/RW pada periode ${esc(safeTextV29(l.periode,"berjalan"))}. Penyusunan laporan dilakukan untuk memastikan setiap penggunaan dana tercatat secara tertib, transparan, akuntabel, dan didukung bukti administrasi yang memadai.</p>
    <p class="notulen-paragraph-v25 notulen-paragraph-v28">Laporan pertanggungjawaban ini menjadi data dukung bagi pengurus RT ${esc(m.rt||"005")} RW ${esc(m.rw||"012")} Kelurahan ${esc(m.kelurahan||"Tegalsari")} dalam pengarsipan SPJ bulanan serta pemenuhan kelengkapan administrasi melalui Aplikasi Website Ruang Warga.</p>

    <div class="notulen-section-title-v25 notulen-section-title-v28"><b>C. RINGKASAN KEUANGAN</b></div>
    <table class="report-table lpj-summary-table-v29">
      <thead><tr><th>No</th><th>Uraian</th><th>Jumlah</th><th>Keterangan</th></tr></thead>
      <tbody>
        <tr><td class="no-col-v29">I</td><td><b>Penerimaan Saldo Awal</b></td><td class="amount-col-v29"><b>${rupiah(l.saldoAwal)}</b></td><td>Saldo awal periode laporan.</td></tr>
        <tr><td class="no-col-v29">II</td><td><b>Saldo Bulan Lalu</b></td><td class="amount-col-v29"><b>${rupiah(l.saldoBulanLalu)}</b></td><td>Saldo bawaan dari periode sebelumnya.</td></tr>
        <tr><td class="no-col-v29">III</td><td><b>Jumlah Penerimaan</b></td><td class="amount-col-v29"><b>${rupiah(penerimaan)}</b></td><td>Saldo awal ditambah saldo bulan lalu.</td></tr>
        <tr><td class="no-col-v29">IV</td><td><b>Jumlah Pengeluaran</b></td><td class="amount-col-v29"><b>${rupiah(total)}</b></td><td>Total realisasi pengeluaran periode laporan.</td></tr>
        <tr><td class="no-col-v29">V</td><td><b>Sisa Uang Penyelenggaraan</b></td><td class="amount-col-v29"><b>${rupiah(sisa)}</b></td><td>Menjadi saldo bulan berikutnya.</td></tr>
      </tbody>
    </table>

    <div class="notulen-section-title-v25 notulen-section-title-v28"><b>D. RINCIAN PENGELUARAN</b></div>
    <table class="report-table lpj-expense-table-v29">
      <thead><tr><th>No</th><th>Tanggal</th><th>Kegiatan/Pengeluaran</th><th>Jumlah</th><th>Keterangan</th></tr></thead>
      <tbody>${lpjExpenseRowsV29()}</tbody>
      <tfoot><tr><td colspan="3"><b>Jumlah Pengeluaran</b></td><td class="amount-col-v29"><b>${rupiah(total)}</b></td><td></td></tr></tfoot>
    </table>
    <p class="notulen-paragraph-v25 notulen-paragraph-v28"><b>Terbilang:</b> ${esc(terbilang(total).replace(/\s+/g," ").trim())} Rupiah.</p>

    <div class="notulen-section-title-v25 notulen-section-title-v28"><b>E. DATA DUKUNG DAN DOKUMENTASI KEGIATAN</b></div>
    <p class="notulen-paragraph-v25 notulen-paragraph-v28">Setiap pengeluaran wajib didukung oleh bukti transaksi dan dokumentasi kegiatan. Dokumentasi lapangan dari MoKu Mobile digunakan sebagai data dukung tambahan untuk memperkuat laporan pertanggungjawaban.</p>
    <table class="lpj-docs-table-v29">
      <thead><tr><th>No</th><th>Nama Kegiatan</th><th>Tanggal</th><th>Lokasi</th><th>Dokumentasi</th></tr></thead>
      <tbody>${lpjDocsRowsV29()}</tbody>
    </table>

    <div class="notulen-section-title-v25 notulen-section-title-v28"><b>F. HASIL PEMERIKSAAN ADMINISTRASI INTERNAL</b></div>
    <table class="lpj-check-table-v29">
      <thead><tr><th>No</th><th>Komponen</th><th>Status</th><th>Keterangan</th></tr></thead>
      <tbody>${lpjAdminCheckRowsV29()}</tbody>
    </table>

    <div class="notulen-section-title-v25 notulen-section-title-v28"><b>G. RENCANA TINDAK LANJUT</b></div>
    <p class="notulen-paragraph-v25 notulen-paragraph-v28">Sebagai tindak lanjut penyusunan laporan pertanggungjawaban, disepakati langkah-langkah administrasi sebagai berikut:</p>
    <table class="lpj-followup-table-v29"><thead><tr><th>No</th><th>Penanggung Jawab</th><th>Tindak Lanjut</th></tr></thead><tbody>${lpjFollowupRowsV29()}</tbody></table>

    <div class="notulen-section-title-v25 notulen-section-title-v28"><b>H. PENUTUP</b></div>
    <p class="notulen-paragraph-v25 notulen-paragraph-v28">Demikian laporan pertanggungjawaban ini dibuat dengan sebenar-benarnya sebagai dokumen administrasi penggunaan Bantuan Operasional RT/RW. Laporan ini digunakan sebagai arsip SPJ dan bahan pelengkap pertanggungjawaban kepada pihak terkait sesuai ketentuan yang berlaku.</p>
    <p class="notulen-date-v28">Semarang, ................................ 2026</p>
    ${lpjSignatureTableV29()}
  </div>`);
}
function aiGenerateLpjV29(){
  collectAll?.();
  if($("lpjOutput")) $("lpjOutput").innerHTML=docLpj();
  activateTab?.("lpj-preview");
  localStorage.setItem(STORE,JSON.stringify(data));
  if(typeof notifyChangeV19==="function") notifyChangeV19("AI LPJ/SPJ terbaru","Laporan pertanggungjawaban dirender dengan engine v1.29.","success");
}
function insertAiLpjPanelV29(){
  const target=$("tab-lpj-preview");
  if(!target || $("aiLpjPanelV29")) return;
  const box=document.createElement("div");
  box.className="ai-panel-v25 ai-lpj-panel-v29";
  box.id="aiLpjPanelV29";
  box.innerHTML=`<div class="ai-title"><span class="ai-icon">AI</span> Engine LPJ/SPJ Baku v1.29</div>
    <p>Mesin ini menyusun laporan pertanggungjawaban dengan struktur terbaru: identitas laporan, dasar pertanggungjawaban, ringkasan keuangan, rincian pengeluaran, data dukung MoKu, pemeriksaan administrasi, tindak lanjut, dan tanda tangan.</p>
    <div class="action-row">
      <button class="primary" type="button" onclick="aiGenerateLpjV29()">Buat LPJ/SPJ Baku Terbaru</button>
      <button class="secondary" type="button" onclick="cleanPrint('lpj')">Cetak / Simpan PDF</button>
    </div>`;
  target.insertBefore(box,target.firstChild);
}
function goPage(page){
  const target=$("page-"+page);
  if(!target){ page="akses"; }
  document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  const active=$("page-"+page);
  if(active) active.classList.add("active");
  if(page==="moku"){
    const frame=$("mokuFrameV29");
    if(frame && !frame.src) frame.src="moku/index.html";
  }
  if(window.innerWidth<1000 && $("sidebar")) $("sidebar").classList.remove("open");
}

function bind(){
  $("hamburger").onclick=()=>{
    if(window.innerWidth<1000) $("sidebar").classList.toggle("open");
    else $("appShell").classList.toggle("menu-hidden");
  };
  document.querySelectorAll(".nav button").forEach(b=>b.onclick=()=>goPage(b.dataset.page));
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>goPage(b.dataset.go));
  document.querySelectorAll(".subtab").forEach(b=>b.onclick=()=>activateTab(b.dataset.tab));
  document.addEventListener("change",e=>{if(e.target?.id==="monthlyDocMonth"){data.pengajuan.selectedMonth=e.target.value;data.pengajuan.monthlyBreakdownOpen=false;data.pengajuan.monthlySelectedIndex=null;localStorage.setItem(STORE,JSON.stringify(data));renderMonthlyRapSummary();if(currentDoc==="rapbulanan"||currentDoc==="rbb")previewDoc(currentDoc)} if(e.target?.dataset?.rap){updateRapFromInputs();localStorage.setItem(STORE,JSON.stringify(data));renderRap();}});
  document.addEventListener("input",e=>{
    if(e.target?.dataset?.breakdown){updateBreakdownFromInputs();localStorage.setItem(STORE,JSON.stringify(data));updateBreakdownLiveStatus();return;}
    if(e.target.matches("input,textarea,select")){collectAll(); updateDashboard();}
    if(e.target.dataset.rap){updateRapFromInputs(); $("rapTotalCell").textContent=rupiah(totalRap());}
    if(e.target.dataset.exp){updateExpensesFromInputs(); $("expenseTotalCell").textContent=rupiah(totalExpense()); if($("lpjOutput")) $("lpjOutput").innerHTML=docLpj();} if(e.target.dataset.breakdown){updateBreakdownFromInputs();localStorage.setItem(STORE,JSON.stringify(data));}
    localStorage.setItem(STORE,JSON.stringify(data));
  });
  ["savePengajuan","saveSetting","saveLpj"].forEach(id=>$(id).onclick=()=>{saveData();bopToast("Tersimpan","Data berhasil disimpan.","success");}); if($("savePersiapan")) $("savePersiapan").onclick=()=>{collectPersiapan();ensureMobileSync();try{localStorage.setItem(STORE,JSON.stringify(data));}catch(e){}renderPersiapan();renderMobileDocumentationToLPJ();bopToast("Tersimpan","Data persiapan kegiatan berhasil disimpan.","success");}; if($("sendToMobile")) $("sendToMobile").onclick=saveActivityToMobileQueue; if($("exportActivities")) $("exportActivities").onclick=exportActivitiesForMobile; if($("importMobileResult")) $("importMobileResult").onchange=(e)=>{if(e.target.files[0]) importMobileResultFile(e.target.files[0]);};
  $("addRap").onclick=addRap; $("addPeserta").onclick=addPeserta; $("addExpense").onclick=addExpense; if($("addActionPlan")) $("addActionPlan").onclick=addActionPlan; if($("addPkPeserta")) $("addPkPeserta").onclick=addPkPeserta; if($("addPkAction")) $("addPkAction").onclick=addPkAction;
  document.querySelectorAll(".doc-btn").forEach(b=>b.onclick=()=>previewDoc(b.dataset.doc)); document.querySelectorAll(".pk-doc-btn").forEach(b=>b.onclick=()=>previewPkDoc(b.dataset.pkdoc));
  $("saveToHistory").onclick=()=>{previewDoc(currentDoc); addHistory("Pengajuan",currentDoc,`Dokumen Pengajuan - ${currentDoc.toUpperCase()}`,$("docOutput").innerHTML);};
  if($("saveMeetingHistory")) $("saveMeetingHistory").onclick=()=>{previewDoc(currentDoc==="notulen"?"notulen":"undangan"); addHistory("Pengajuan",currentDoc,`Dokumen Rapat - ${currentDoc.toUpperCase()}`,$("docOutput").innerHTML);};
  if($("printMeetingDoc")) $("printMeetingDoc").onclick=()=>cleanPrint("doc");
  $("printDoc").onclick=()=>cleanPrint("doc"); if($("printPkDoc")) $("printPkDoc").onclick=cleanPrintPk;
  $("exportHtml").onclick=()=>{previewDoc(currentDoc); download(new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>Dokumen BOP</title><link rel="stylesheet" href="styles.css"></head><body><div class="doc-paper">${$("docOutput").innerHTML}</div></body></html>`],{type:"text/html"}),`dokumen_${currentDoc}_rt005.html`);};
  $("saveLpjHistory").onclick=()=>{collectAll(); $("lpjOutput").innerHTML=docLpj(); addHistory("LPJ","laporan",`LPJ Periode ${data.lpj.periode}`,$("lpjOutput").innerHTML);}; if($("savePkHistory")) $("savePkHistory").onclick=()=>{previewPkDoc(currentPkDoc); addHistory("Persiapan Kegiatan",currentPkDoc,`Bukti SPJ - ${data.persiapan.nama}`,$("pkDocOutput").innerHTML);};
  $("printLpj").onclick=()=>cleanPrint("lpj");
  if($("previewMonthlyRapDoc")) $("previewMonthlyRapDoc").onclick=previewMonthlyRapFromTab;
  if($("printMonthlyRapDoc")) $("printMonthlyRapDoc").onclick=printMonthlyRapFromTab;
  if($("previewMonthlyRbbDoc")) $("previewMonthlyRbbDoc").onclick=previewMonthlyRbbFromTab;
  if($("printMonthlyRbbDoc")) $("printMonthlyRbbDoc").onclick=printMonthlyRbbFromTab;
  $("backupData").onclick=()=>backup();
  $("backupBeforeReset").onclick=()=>backup("backup_sebelum_reset_bop_rt005.json");
  $("resetAllData").onclick=resetAll;
  $("restoreData").onchange=e=>{if(e.target.files[0])restoreFile(e.target.files[0])};
}
function render(){
  fillInputs(); renderRap(); renderPeserta(); renderExpenses(); renderChecklist(); renderActionPlan(); renderPersiapan(); organizeActivityInputsV20(); ensurePrintHelpV21(); ensurePrintHelpV22(); updateDashboard(); previewDoc(currentDoc); renderMobileDocumentationToLPJ(); renderMokuFotoSheetsV35();
}
setInterval(()=>{const d=new Date();$("clockBox").textContent=d.toLocaleTimeString("id-ID")},1000);
insertAiNotulenPanelsV25(); insertAiLpjPanelV29();
bind(); bindMonitoringV24(); render(); cleanPreviewGridV23(); ensurePrintHelpV21(); ensurePrintHelpV22(); organizeActivityInputsV20(); setupNotificationsV19();
if("serviceWorker" in navigator){navigator.serviceWorker.register("sw.js").catch(()=>{})}

/* PATCH v1.30 - Full Access Gate + MoKu no GPS-lock guard */
function setAccessGateV30(isLocked){
  const shell = $("appShell");
  if(!shell) return;
  shell.classList.toggle("access-lock-v30", !!isLocked);
  shell.classList.toggle("access-unlocked-v30", !isLocked);
  if(isLocked && window.innerWidth < 1000 && $("sidebar")) $("sidebar").classList.remove("open");
}
function goPage(page){
  const target = $("page-" + page);
  if(!target){ page = "akses"; }
  const locked = page === "akses";
  setAccessGateV30(locked);
  document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const active = $("page-" + page);
  if(active) active.classList.add("active");
  if(page === "moku"){
    const frame = $("mokuFrameV29");
    if(frame){
      const current = frame.getAttribute("src") || "";
      if(!current || current === "about:blank") frame.setAttribute("src", "moku/index.html?v=2.1");
      else if(!current.includes("v=2.1")) frame.setAttribute("src", "moku/index.html?v=2.1");
    }
  }
  if(window.innerWidth < 1000 && $("sidebar")) $("sidebar").classList.remove("open");
}
(function initAccessGateV30(){
  setAccessGateV30(true);
  document.addEventListener("DOMContentLoaded", () => setAccessGateV30(true));
})();


/* PATCH v1.31 - Access Mode Separation: BOP terkunci, MoKu warga aman */
let ACCESS_MODE_V31 = null;
const BOP_ADMIN_PIN_V31 = localStorage.getItem("bop_admin_pin_v31") || "005012";

function setAccessModeV31(mode){
  ACCESS_MODE_V31 = mode || null;
  const shell = $("appShell");
  if(!shell) return;
  shell.classList.toggle("access-lock-v30", !ACCESS_MODE_V31);
  shell.classList.toggle("access-unlocked-v30", !!ACCESS_MODE_V31);
  shell.classList.toggle("access-mode-bop-v31", ACCESS_MODE_V31 === "bop");
  shell.classList.toggle("access-mode-moku-v31", ACCESS_MODE_V31 === "moku");
  if($("sidebar")) $("sidebar").classList.remove("open");
  document.querySelectorAll(".nav button").forEach(btn => {
    const pg = btn.dataset.page;
    if(ACCESS_MODE_V31 === "moku"){
      btn.disabled = pg !== "moku" && pg !== "akses";
      btn.setAttribute("aria-disabled", btn.disabled ? "true" : "false");
    }else{
      btn.disabled = false;
      btn.removeAttribute("aria-disabled");
    }
  });
}

async function requireBopPinV31(){
  if(typeof Swal === "undefined"){
    const pin = window.prompt("Masukkan PIN Admin BOP (6 digit):");
    if(pin === null) return false;
    if(String(pin).trim() === String(BOP_ADMIN_PIN_V31).trim()) return true;
    alert("PIN Admin BOP yang Anda masukkan tidak sesuai.");
    return false;
  }

  /* ── Inject premium CSS sekali saja ── */
  if(!document.getElementById("swal-bop-pin-css-v42")){
    const st = document.createElement("style");
    st.id = "swal-bop-pin-css-v42";
    st.textContent = `
      .swal-bop-pin-v42{border-radius:28px!important;padding:32px 28px 24px!important;max-width:400px!important;box-shadow:0 32px 80px rgba(7,27,56,.22),0 0 0 1px rgba(11,46,89,.08)!important;border:none!important}
      .swal-bop-pin-v42 .swal2-html-container{margin:0!important;padding:0!important;overflow:visible!important}
      .swal-bop-pin-v42 .swal2-actions{gap:10px!important;margin-top:20px!important}
      .swal-bop-confirm-v42{border-radius:14px!important;padding:13px 32px!important;font-weight:700!important;font-size:14px!important;letter-spacing:.4px!important;box-shadow:0 6px 18px rgba(11,46,89,.4)!important;background:linear-gradient(135deg,#0b2e59,#1a4a8a)!important;border:none!important;transition:.15s!important}
      .swal-bop-confirm-v42:hover{background:linear-gradient(135deg,#0d3870,#1f5299)!important;transform:translateY(-1px)!important;box-shadow:0 8px 22px rgba(11,46,89,.5)!important}
      .swal-bop-cancel-v42{border-radius:14px!important;padding:13px 22px!important;font-weight:600!important;font-size:13px!important;background:#f1f5f9!important;color:#64748b!important;border:none!important}
      .swal-bop-cancel-v42:hover{background:#e2e8f0!important;color:#475569!important}
      .swal-bop-success-v42{border-radius:28px!important;padding:32px 28px!important;max-width:360px!important;box-shadow:0 32px 80px rgba(7,27,56,.18)!important}
      .swal-bop-success-v42 .swal2-html-container{margin:0!important;padding:0!important}
      @keyframes bop-pin-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
      .bop-pin-shake{animation:bop-pin-shake .4s ease!important}
    `;
    document.head.appendChild(st);
  }

  return new Promise(resolve => {
    Swal.fire({
      html: `
        <div style="text-align:center">
          <div style="width:72px;height:72px;background:linear-gradient(145deg,#071b38 0%,#0b2e59 55%,#163d73 100%);border-radius:22px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:18px;box-shadow:0 12px 32px rgba(7,27,56,.45),inset 0 1px 0 rgba(255,255,255,.08)">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d5a83f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div style="font-size:10px;letter-spacing:2.8px;color:#d5a83f;font-weight:800;text-transform:uppercase;margin-bottom:8px;opacity:.9">RT 005 RW 012 · Tegalsari</div>
          <div style="font-size:21px;font-weight:800;color:#0f1f38;margin-bottom:8px;letter-spacing:-.3px;line-height:1.2">Akses BOP Administrasi</div>
          <div style="font-size:13px;color:#64748b;line-height:1.6;margin-bottom:24px">Masukkan PIN Admin untuk membuka<br>menu administrasi BOP RT 005</div>

          <div style="position:relative;margin-bottom:8px">
            <input id="bop-pin-field" type="password" maxlength="6" autocomplete="off" inputmode="numeric" pattern="[0-9]*"
              placeholder="● ● ● ● ● ●"
              style="width:100%;box-sizing:border-box;border:2px solid #e2e8f0;border-radius:16px;padding:16px 52px 16px 20px;font-size:26px;letter-spacing:10px;text-align:center;background:#f8fafc;color:#0f1f38;font-weight:700;outline:none;transition:border-color .2s,background .2s,box-shadow .2s;font-family:inherit"
            >
            <button id="bop-pin-eye" type="button" title="Tampilkan/Sembunyikan PIN"
              style="position:absolute;right:14px;top:50%;transform:translateY(-50%);border:0;background:transparent;cursor:pointer;color:#94a3b8;padding:6px;display:flex;align-items:center;border-radius:8px;transition:color .15s">
              <svg id="bop-eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
          <div id="bop-pin-err" style="min-height:18px;font-size:12px;color:#dc2626;font-weight:600;text-align:center;letter-spacing:.2px"></div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Buka Akses",
      cancelButtonText: "Batal",
      reverseButtons: false,
      focusConfirm: false,
      customClass: {
        popup: "swal-bop-pin-v42",
        confirmButton: "swal-bop-confirm-v42",
        cancelButton: "swal-bop-cancel-v42"
      },
      didOpen: () => {
        const field  = document.getElementById("bop-pin-field");
        const eyeBtn = document.getElementById("bop-pin-eye");
        const errEl  = document.getElementById("bop-pin-err");

        if(field){
          field.focus();
          field.addEventListener("focus", () => {
            field.style.borderColor = "#0b2e59";
            field.style.background  = "#fff";
            field.style.boxShadow   = "0 0 0 4px rgba(11,46,89,.1)";
          });
          field.addEventListener("blur", () => {
            field.style.borderColor = "#e2e8f0";
            field.style.background  = "#f8fafc";
            field.style.boxShadow   = "none";
          });
          field.addEventListener("input", () => { if(errEl) errEl.textContent = ""; });
          field.addEventListener("keydown", e => {
            if(e.key === "Enter"){
              e.preventDefault();
              document.querySelector(".swal-bop-confirm-v42")?.click();
            }
          });
        }

        if(eyeBtn && field){
          const icon = document.getElementById("bop-eye-icon");
          eyeBtn.addEventListener("mouseenter", () => eyeBtn.style.color = "#0b2e59");
          eyeBtn.addEventListener("mouseleave", () => eyeBtn.style.color = "#94a3b8");
          eyeBtn.addEventListener("click", () => {
            const isPass = field.type === "password";
            field.type   = isPass ? "text" : "password";
            field.style.letterSpacing = isPass ? "4px" : "10px";
            icon.innerHTML = isPass
              ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
              : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
          });
        }
      },
      preConfirm: () => {
        const field = document.getElementById("bop-pin-field");
        const errEl = document.getElementById("bop-pin-err");
        const val   = (field?.value || "").trim();
        if(!val){
          if(errEl) errEl.textContent = "PIN tidak boleh kosong";
          field?.classList.add("bop-pin-shake");
          setTimeout(() => field?.classList.remove("bop-pin-shake"), 500);
          return false;
        }
        if(String(val) !== String(BOP_ADMIN_PIN_V31).trim()){
          if(errEl) errEl.textContent = "❌ PIN tidak valid. Silakan coba lagi.";
          if(field){
            field.value = "";
            field.style.borderColor = "#dc2626";
            field.style.boxShadow   = "0 0 0 4px rgba(220,38,38,.12)";
            field.classList.add("bop-pin-shake");
            setTimeout(() => {
              field.classList.remove("bop-pin-shake");
              field.style.borderColor = "#e2e8f0";
              field.style.boxShadow   = "none";
              field.focus();
            }, 500);
          }
          return false;
        }
        return true;
      }
    }).then(async result => {
      if(!result.isConfirmed){ resolve(false); return; }
      await Swal.fire({
        html: `
          <div style="text-align:center;padding:4px 0">
            <div style="width:72px;height:72px;background:linear-gradient(145deg,#14532d,#16a34a);border-radius:22px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 12px 32px rgba(22,101,52,.4)">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div style="font-size:20px;font-weight:800;color:#0f1f38;margin-bottom:8px">Akses Diberikan!</div>
            <div style="font-size:13px;color:#64748b;line-height:1.6">Selamat datang,<br><strong style="color:#0b2e59">BOP Administrasi RT 005</strong> terbuka.</div>
          </div>
        `,
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: "swal-bop-success-v42" }
      });
      resolve(true);
    });
  });
}

function showOnlyPageV31(page){
  document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const active = $("page-" + page);
  if(active) active.classList.add("active");
  if(window.innerWidth < 1000 && $("sidebar")) $("sidebar").classList.remove("open");
}

function loadMokuFrameV31(){
  const frame = $("mokuFrameV29");
  if(!frame) return;
  const desired = "moku/index.html?v=2.1";
  const current = frame.getAttribute("src") || "";
  if(!current || current === "about:blank" || !current.includes("v=2.0")){
    frame.setAttribute("src", desired);
  }
}

async function goPage(page){
  if(!$("page-" + page)) page = "akses";

  if(page === "akses"){
    setAccessModeV31(null);
    showOnlyPageV31("akses");
    return;
  }

  /* Minta PIN BOP saat pertama masuk dari halaman gate */
  if(!ACCESS_MODE_V31){
    if(page === "moku"){
      setAccessModeV31("moku");
    } else {
      const ok = await requireBopPinV31();
      if(!ok) return;
      setAccessModeV31("bop");
    }
  }

  if(ACCESS_MODE_V31 === "moku" && page !== "moku"){
    setAccessModeV31("bop");
  }

  if(page === "moku") loadMokuFrameV31();
  showOnlyPageV31(page);
}

(function initAccessModeV31(){
  // Tidak menyimpan akses agar setiap buka aplikasi selalu kembali ke gate.
  setAccessModeV31(null);
  document.addEventListener("DOMContentLoaded", () => {
    setAccessModeV31(null);
    showOnlyPageV31("akses");
    document.querySelectorAll("[data-go='akses'], .exit-access-v31").forEach(btn => {
      btn.addEventListener("click", (e) => { e.preventDefault(); goPage("akses"); });
    });
  });
})();




/* ==========================================================
   PATCH v1.36 - FORMAT DOKUMEN 2026 + DOCX EXPORT
   Target: 7 Dokumen Persyaratan Pengajuan Dana Bantuan BOP RT
   Catatan: patch ini hanya menambah/override generator dokumen resmi.
   ========================================================== */
(function(){
  const PATCH_ID = "PATCH_V1_36_OFFICIAL_7_DOCS_2026_DOCX_EXPORT";
  window.__BOP_RT005_PATCH_V36__ = true;

  function $v36(id){ return document.getElementById(id); }
  function rupiahV36(n){
    try{ if(typeof rupiah === "function") return rupiah(Number(n||0)); }catch(e){}
    return "Rp"+Number(n||0).toLocaleString("id-ID");
  }
  function escV36(s){
    try{ if(typeof esc === "function") return esc(String(s ?? "")); }catch(e){}
    return String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  }
  function safeV36(s, fallback=".................."){ return String(s ?? "").trim() || fallback; }
  function masterV36(){ return window.data?.master || {}; }
  function pengajuanV36(){ return window.data?.pengajuan || {}; }
  function totalRapV36(){ return rapRowsV36().reduce((s,r)=>s+Number(r.jumlah||0),0); }
  function normalizeDateV36(){ return "Semarang, tanggal bulan tahun"; }

  function rapRowsV36(){
    const p = pengajuanV36();
    let rows = Array.isArray(p.rap) ? p.rap : [];
    return rows.map((r,i)=>{
      if(Array.isArray(r)){
        return { no:i+1, uraian:r[0]||"", volume:r[1]||"", jumlah:Number(r[2]||0), keterangan:r[3]||"" };
      }
      return {
        no:i+1,
        uraian:r?.uraian || r?.kegiatan || r?.nama || "",
        volume:r?.volume || r?.satuan || r?.satuanVolume || "",
        jumlah:Number(r?.jumlah || r?.anggaran || r?.rencanaAnggaran || 0),
        keterangan:r?.keterangan || ""
      };
    });
  }

  function pesertaRowsV36(){
    const p = pengajuanV36();
    const m = masterV36();
    let peserta = Array.isArray(p.peserta) ? p.peserta : [];
    let rows = peserta.map((r,i)=>{
      if(Array.isArray(r)) return {no:i+1,nama:r[0]||"",jabatan:r[1]||"",alamat:r[2]||""};
      return {no:i+1,nama:r?.nama||"",jabatan:r?.jabatan||"",alamat:r?.alamat||""};
    }).filter(r=>r.nama || r.jabatan);
    if(!rows.length){
      rows = [
        {no:1,nama:safeV36(m.ketua,"Ketua RT"),jabatan:`Ketua RT ${safeV36(m.rt,"005")} RW ${safeV36(m.rw,"012")}`},
        {no:2,nama:safeV36(m.sekretaris,"........................"),jabatan:`Sekretaris RT ${safeV36(m.rt,"005")} RW ${safeV36(m.rw,"012")}`},
        {no:3,nama:safeV36(m.bendahara,"........................"),jabatan:`Bendahara RT ${safeV36(m.rt,"005")} RW ${safeV36(m.rw,"012")}`},
        {no:4,nama:"........................",jabatan:`Warga RT ${safeV36(m.rt,"005")} RW ${safeV36(m.rw,"012")}`},
        {no:5,nama:"........................",jabatan:`Warga RT ${safeV36(m.rt,"005")} RW ${safeV36(m.rw,"012")}`},
        {no:6,nama:"........................",jabatan:`Warga RT ${safeV36(m.rt,"005")} RW ${safeV36(m.rw,"012")}`},
        {no:7,nama:"........................",jabatan:`Warga RT ${safeV36(m.rt,"005")} RW ${safeV36(m.rw,"012")}`},
        {no:8,nama:"........................",jabatan:`Warga RT ${safeV36(m.rt,"005")} RW ${safeV36(m.rw,"012")}`}
      ];
    }
    return rows;
  }

  function officialV36(body){
    const kop = (typeof kopHTML === "function") ? kopHTML() : `<div class="kop"><div><h1>KOP SURAT</h1></div></div>`;
    return `<div class="official official-v36">${kop}<div class="official-body-v36">${body}</div></div>`;
  }

  function rapTableV36(rows=rapRowsV36(), titleNo=true){
    const body = rows.length ? rows.map((r,i)=>`<tr><td class="col-no">${i+1}</td><td>${escV36(r.uraian)}</td><td>${escV36(r.volume)}</td><td class="money-cell">${rupiahV36(r.jumlah)}</td><td>${escV36(r.keterangan)}</td></tr>`).join("") :
      `<tr><td class="col-no">1</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td class="col-no">2</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td class="col-no">3</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td class="col-no">4</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td class="col-no">5</td><td>Dst..</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`;
    return `<table class="official-table-v36 rap-table-v36"><thead><tr><th class="col-no">No</th><th>Uraian Kegiatan</th><th>Satuan/Volume</th><th>Rencana Anggaran</th><th>Keterangan</th></tr></thead><tbody>${body}<tr><td colspan="3"><b>Jumlah</b></td><td class="money-cell"><b>${rupiahV36(rows.length?rows.reduce((s,r)=>s+Number(r.jumlah||0),0):0)}</b></td><td></td></tr></tbody></table>`;
  }

  function signatureTwoByTwoV36(){
    const m = masterV36(), p = pengajuanV36();
    return `<p class="mengetahui-v36">Mengetahui,</p>
    <table class="sign-two-v36 no-border"><tr>
      <td>Ketua RT ${escV36(safeV36(m.rt,"005"))}<br><span class="sign-note-v36">Tanda Tangan dan<br>Stempel RT</span><div class="sign-space-v36"></div><b>${escV36(safeV36(m.ketua,"Nama Jelas"))}</b></td>
      <td>Bendahara RT ${escV36(safeV36(m.rt,"005"))}<br><span class="sign-note-v36">Tanda Tangan</span><div class="sign-space-v36"></div><b>${escV36(safeV36(m.bendahara,"Nama Jelas"))}</b></td>
    </tr><tr>
      <td>Lurah ${escV36(safeV36(m.kelurahan,".................."))}<br><span class="sign-note-v36">Tanda Tangan dan<br>Stempel Lurah</span><div class="sign-space-v36"></div><b>${escV36(safeV36(p.namaLurah,"Nama Jelas"))}</b></td>
      <td>Ketua RW ${escV36(safeV36(m.rw,"012"))}<br><span class="sign-note-v36">Tanda Tangan dan<br>Stempel RW</span><div class="sign-space-v36"></div><b>${escV36(safeV36(p.namaKetuaRw,"Nama Jelas"))}</b></td>
    </tr></table>`;
  }

  function signRightKetuaV36(){
    const m=masterV36();
    return `<table class="sign-right-v36 no-border"><tr><td></td><td>Hormat kami,<br>Ketua RT ${escV36(safeV36(m.rt,"005"))} RW ${escV36(safeV36(m.rw,"012"))},<br><span class="sign-note-v36">Tanda Tangan dan<br>Stempel RT</span><div class="sign-space-v36"></div><b>${escV36(safeV36(m.ketua,"Nama Jelas"))}</b></td></tr></table>`;
  }

  function docRap2026V36(){
    return officialV36(`<div class="title">RENCANA ANGGARAN PENGGUNAAN<br>BANTUAN OPERASIONAL RT</div>${rapTableV36()}<p class="date-right-v36">${normalizeDateV36()}</p>${signatureTwoByTwoV36()}<p class="ket-v36">Ket.: coret yang tidak perlu</p>`);
  }

  function docPermohonan2026V36(){
    const m=masterV36(), p=pengajuanV36();
    const nomor = (typeof autoNumber === "function") ? autoNumber("permohonan", p.tanggalSurat||"") : (p.nomorSurat||"........");
    return officialV36(`<p class="date-right-v36">${escV36(p.tanggalSurat||normalizeDateV36())}</p>
    <table class="letter-head-v36 no-border"><tr><td class="letter-meta-v36">
      <table class="no-border"><tr><td>Nomor</td><td>: ${escV36(nomor)}</td></tr><tr><td>Sifat</td><td>: ${escV36(p.sifatSurat||"........")}</td></tr><tr><td>Lampiran</td><td>: ${escV36(p.lampiranSurat||"........")}</td></tr><tr><td>Hal</td><td>: Permohonan Pencairan Bantuan Operasional RT</td></tr></table>
    </td><td class="letter-to-v36">Kepada<br>Yth. Lurah ${escV36(safeV36(m.kelurahan,"........"))}<br>di-<br>SEMARANG</td></tr></table>
    <p>Bersama ini kami mengajukan permohonan pencairan Bantuan Operasional RT ${escV36(safeV36(m.rt,"005"))} RW ${escV36(safeV36(m.rw,"012"))} sebesar ${rupiahV36(25000000)} dengan rincian sebagaimana terlampir (Lampiran I).</p>
    <p>Sebagai bahan pertimbangan, bersama ini kami sampaikan persyaratan pencairan Bantuan Operasional RT ${escV36(safeV36(m.rt,"005"))} RW ${escV36(safeV36(m.rw,"012"))} sesuai dengan Peraturan Wali Kota Nomor .... Tahun ....... tentang Pemberian Bantuan Operasional Rukun Tetangga dan Rukun Warga Kota Semarang yang Bersumber dari Anggaran Pendapatan dan Belanja Daerah Kota Semarang.</p>
    <p>Pencairan bantuan dapat ditransfer melalui rekening Bank Jateng atas nama ${escV36(safeV36(p.namaRekening,"............"))} nomor rekening ${escV36(safeV36(p.nomorRekening,"............"))}.</p>
    <p>Demikian permohonan kami, atas perhatian dan kerjasamanya kami sampaikan terima kasih.</p>${signRightKetuaV36()}<p class="ket-v36">Ket.: coret yang tidak perlu</p>`);
  }

  function docBeritaAcaraRap2026V36(){
    const m=masterV36(), p=pengajuanV36();
    const pesertaText = pesertaRowsV36().slice(0,8).map(r=>`${r.nama}${r.jabatan?` (${r.jabatan})`:""}`).join(", ");
    const signRows = pesertaRowsV36().map((r,i)=>`<tr><td class="col-no">${i+1}.</td><td>${escV36(r.nama)}</td><td>${escV36(r.jabatan)}</td><td>${i+1}.</td></tr>`).join("");
    return officialV36(`<div class="title">BERITA ACARA<br>KESEPAKATAN RENCANA ANGGARAN PENGGUNAAN BANTUAN OPERASIONAL RT</div>
    <p class="center-v36">Nomor: ${escV36(p.baNomor||"..................")}</p>
    <p>Pada hari ini ${escV36(p.baHari||"................")} tanggal ${escV36(p.baTanggal||"......")} bulan ${escV36(p.baBulan||"..................")} tahun ${escV36(p.baTahun||"..........")}, bertempat di ${escV36(p.baTempat||"................")}. pada pukul ${escV36(p.baPukul||".......... WIB")} telah dilaksanakan pertemuan pembahasan Kesepakatan Rencana Anggaran Penggunaan Bantuan Operasional RT ${escV36(safeV36(m.rt,"005"))} RW ${escV36(safeV36(m.rw,"012"))}. Pertemuan dipimpin oleh ${escV36(p.baPimpinan||m.ketua||"........")}, dan dihadiri oleh: ${escV36(pesertaText||"........")}</p>
    <p>Adapun hasil pertemuan sebagai berikut:</p>${rapTableV36()}
    <p>Demikian Berita Acara Hasil Kesepakatan Rencana Anggaran Penggunaan Bantuan Operasional RT ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>
    <p>Kami yang bertanda tangan di bawah ini:</p><table class="official-table-v36 sign-list-v36"><tr><th class="col-no">No.</th><th>Nama</th><th>Jabatan</th><th>Tanda Tangan</th></tr>${signRows}</table>`);
  }

  function docSptjm2026V36(){
    const m=masterV36();
    const nomor = (typeof autoNumber === "function") ? autoNumber("sptjm", pengajuanV36().tanggalSurat||"") : ".....................";
    return officialV36(`<div class="title">SURAT PERNYATAAN TANGGUNG JAWAB MUTLAK</div><p class="center-v36">Nomor: ${escV36(nomor)}</p>
    <p>Yang bertanda tangan di bawah ini:</p>
    <table class="identity-table-v36 no-border"><tr><td>Nama</td><td>: ${escV36(safeV36(m.ketua,"....................."))}</td></tr><tr><td>No. KTP</td><td>: .....................</td></tr><tr><td>Alamat</td><td>: ${escV36(safeV36(m.alamat,"....................."))}</td></tr><tr><td>Jabatan</td><td>: Ketua RT</td></tr><tr><td>RT/RW</td><td>: ${escV36(safeV36(m.rt,"005"))} / ${escV36(safeV36(m.rw,"012"))}</td></tr></table>
    <p>Saya selaku Ketua RT ${escV36(safeV36(m.rt,"005"))} RW ${escV36(safeV36(m.rw,"012"))} dengan ini menyatakan bahwa:</p>
    <ol class="official-list-v36"><li>Bertanggung jawab sepenuhnya terhadap kebenaran data yang diajukan di dalam Bantuan Operasional RT dan RW. Apabila di kemudian hari ternyata ditemukan data yang tidak benar, maka saya siap bertanggung jawab dan menanggung segala konsekuensi yang timbul.</li><li>Akan menggunakan bantuan sesuai dengan ketentuan yang berlaku dan bertanggungjawab atas penggunaannya secara formal dan materiil apabila mendapatkan Bantuan Operasional RT dari Pemerintah Kota Semarang.</li><li>Akan bertanggung jawab mengembalikan dana bantuan operasional apabila terdapat temuan dalam audit.</li><li>Dalam hal terdapat pergantian Ketua RT ${escV36(safeV36(m.rt,"005"))} RW ${escV36(safeV36(m.rw,"012"))}, maka tanggung jawab Dana Bantuan Operasional beralih kepada Ketua RT ${escV36(safeV36(m.rt,"005"))} RW ${escV36(safeV36(m.rw,"012"))} yang baru terhitung sejak ditetapkan dalam Keputusan Lurah.</li></ol>
    <p>Demikian surat pernyataan ini saya buat dengan sebenar-benarnya tanpa ada unsur paksaan untuk dapat digunakan sebagaimana mestinya.</p>
    <table class="sign-right-v36 no-border"><tr><td></td><td>${normalizeDateV36()}<br>Ketua RT ${escV36(safeV36(m.rt,"005"))} RW ${escV36(safeV36(m.rw,"012"))},<br><span class="sign-note-v36">Tanda Tangan dan<br>Stempel RT</span><br>(materai 10 ribu)<div class="sign-space-v36"></div><b>${escV36(safeV36(m.ketua,"Nama Jelas"))}</b></td></tr></table><p class="ket-v36">Ket.: coret yang tidak perlu</p>`);
  }

  function perubahanTableV36(){
    const rows = rapRowsV36();
    const body = (rows.length?rows:[]).map((r,i)=>`<tr><td class="col-no">${i+1}</td><td>${escV36(r.uraian)}</td><td>${escV36(r.volume)}</td><td class="money-cell">${rupiahV36(r.jumlah)}</td><td class="col-no">${i+1}</td><td>${escV36(r.uraian)}</td><td>${escV36(r.volume)}</td><td class="money-cell">${rupiahV36(r.jumlah)}</td><td>${escV36(r.keterangan||"-")}</td></tr>`).join("") ||
      `<tr><td class="col-no">1</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td class="col-no">1</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td class="col-no">2</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td class="col-no">2</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td class="col-no">3</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td class="col-no">3</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td class="col-no">4</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td class="col-no">4</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td></td><td>dst</td><td></td><td></td><td></td><td>dst</td><td></td><td></td><td></td></tr>`;
    const total = rows.length?rows.reduce((s,r)=>s+Number(r.jumlah||0),0):0;
    return `<table class="official-table-v36 perubahan-table-v36"><thead><tr><th class="col-no">No</th><th>Uraian Kegiatan Awal</th><th>Satuan/Volume</th><th>Rencana Anggaran</th><th class="col-no">No</th><th>Uraian Perubahan Kegiatan</th><th>Satuan/Volume</th><th>Rencana Anggaran</th><th>Ket</th></tr></thead><tbody>${body}<tr><td colspan="3"><b>Jumlah</b></td><td class="money-cell"><b>${rupiahV36(total)}</b></td><td colspan="3"><b>Jumlah</b></td><td class="money-cell"><b>${rupiahV36(total)}</b></td><td></td></tr></tbody></table>`;
  }

  function docPerubahanRap2026V36(){
    return officialV36(`<div class="title">PERUBAHAN RENCANA ANGGARAN PENGGUNAAN<br>BANTUAN OPERASIONAL RT</div>${perubahanTableV36()}<p class="date-right-v36">${normalizeDateV36()}</p>${signatureTwoByTwoV36()}<p class="ket-v36">Ket.: coret yang tidak perlu</p>`);
  }

  function docBeritaAcaraPerubahan2026V36(){
    const m=masterV36(), p=pengajuanV36();
    const signRows = pesertaRowsV36().map((r,i)=>`<tr><td class="col-no">${i+1}.</td><td>${escV36(r.nama)}</td><td>${escV36(r.jabatan)}</td><td>${i+1}.</td></tr>`).join("");
    return officialV36(`<div class="title">BERITA ACARA<br>KESEPAKATAN PERUBAHAN RENCANA ANGGARAN PENGGUNAAN BANTUAN OPERASIONAL RT</div>
    <p class="center-v36">Nomor: ${escV36(p.baNomor||"..................")}</p>
    <p>Pada hari ini ${escV36(p.baHari||"................")} tanggal ${escV36(p.baTanggal||"......")} bulan ${escV36(p.baBulan||"..................")} tahun ${escV36(p.baTahun||"..........")}, bertempat di ${escV36(p.baTempat||"................")} pada pukul ${escV36(p.baPukul||".......... WIB")} telah dilaksanakan pertemuan pembahasan Kesepakatan Perubahan Rencana Anggaran Penggunaan Bantuan Operasional RT ${escV36(safeV36(m.rt,"005"))} RW ${escV36(safeV36(m.rw,"012"))}. Pertemuan dipimpin oleh ${escV36(p.baPimpinan||m.ketua||"........")}, dan dihadiri oleh: ${escV36(pesertaRowsV36().slice(0,8).map(r=>r.nama).join(", ")||"........")}</p>
    <p>Adapun hasil pertemuan sebagai berikut:</p>${perubahanTableV36()}
    <p>Demikian Berita Acara Hasil Kesepakatan Perubahan Rencana Anggaran Penggunaan Bantuan Operasional RT ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>
    <p>Kami yang bertanda tangan di bawah ini:</p><table class="official-table-v36 sign-list-v36"><tr><th class="col-no">No.</th><th>Nama</th><th>Jabatan</th><th>Tanda Tangan</th></tr>${signRows}</table>`);
  }

  function docTandaTerimaPenyaluran2026V36(){
    const m=masterV36(), p=pengajuanV36();
    return officialV36(`<div class="title">TANDA TERIMA PENYALURAN UANG BANTUAN OPERASIONAL<br>RUKUN TETANGGA DAN RUKUN WARGA KOTA SEMARANG</div>
    <table class="identity-table-v36 no-border"><tr><td>BULAN</td><td>: .........................</td></tr><tr><td>TAHUN</td><td>: ${escV36(p.baTahun||"2026")}</td></tr><tr><td>KELURAHAN</td><td>: ${escV36(safeV36(m.kelurahan,"Tegalsari"))}</td></tr><tr><td>KECAMATAN</td><td>: ${escV36(safeV36(m.kecamatan,"Candisari"))}</td></tr></table>
    <table class="official-table-v36 tanda-terima-v36"><tr><th class="col-no">No.</th><th>RT/RW</th><th>Nama RT/RW</th><th>Nomor Rekening</th><th>Jumlah</th><th>Tandatangan</th></tr>
    <tr><td class="col-no">1.</td><td>RT.${escV36(safeV36(m.rt,"005"))}</td><td>${escV36(safeV36(m.ketua,"................"))}</td><td>${escV36(safeV36(p.nomorRekening,"................"))}</td><td class="money-cell">${rupiahV36(25000000)}</td><td>1.</td></tr>
    <tr><td class="col-no">2.</td><td>dst......</td><td></td><td></td><td>Rp................</td><td>2.</td></tr>
    <tr><td colspan="4"><b>Jumlah</b></td><td class="money-cell"><b>${rupiahV36(25000000)}</b></td><td></td></tr>
    <tr><td colspan="4"><b>Jumlah Keseluruhan</b></td><td class="money-cell"><b>${rupiahV36(25000000)}</b></td><td></td></tr></table>
    <p class="date-right-v36">${normalizeDateV36()}</p>
    <p>Mengetahui,</p><table class="sign-two-v36 no-border"><tr><td>Camat ${escV36(safeV36(m.kecamatan,"................"))}<div class="sign-space-v36"></div>Tanda Tangan<br>dan stempel<br><br><b>Nama Jelas</b></td><td>Lurah ${escV36(safeV36(m.kelurahan,"................"))},<div class="sign-space-v36"></div>Tanda Tangan<br>dan stempel<br><br><b>${escV36(safeV36(p.namaLurah,"Nama Jelas"))}</b></td></tr></table>`);
  }

  function docPaket7Pengajuan2026V36(){
    const docs = [
      docRap2026V36(),
      docBeritaAcaraRap2026V36(),
      docPermohonan2026V36(),
      docSptjm2026V36(),
      docPerubahanRap2026V36(),
      docBeritaAcaraPerubahan2026V36(),
      docTandaTerimaPenyaluran2026V36()
    ];
    return docs.map((d,i)=>`<div class="paket-doc-v36">${d}</div>${i<docs.length-1?'<div class="page-break-v36"></div>':''}`).join("");
  }

  window.docRap = docRap2026V36;
  window.docPermohonan = docPermohonan2026V36;
  window.docBA = docBeritaAcaraRap2026V36;
  window.docSptjm = docSptjm2026V36;
  window.docPerubahanRapV36 = docPerubahanRap2026V36;
  window.docBeritaAcaraPerubahanV36 = docBeritaAcaraPerubahan2026V36;
  window.docTandaTerimaPenyaluranV36 = docTandaTerimaPenyaluran2026V36;
  window.docPaket7PengajuanV36 = docPaket7Pengajuan2026V36;

  const oldPreviewDocV36 = window.previewDoc;
  window.previewDoc = function(type = window.currentDoc || "permohonan"){
    try{ if(typeof collectAll === "function") collectAll(); }catch(e){}
    window.currentDoc = type;
    const map = {
      permohonan: docPermohonan2026V36,
      rap: docRap2026V36,
      rapbulanan: (typeof docRapBulanan === "function" ? docRapBulanan : docRap2026V36),
      ba: docBeritaAcaraRap2026V36,
      hadir: (typeof docHadir === "function" ? docHadir : docBeritaAcaraRap2026V36),
      sptjm: docSptjm2026V36,
      sk: (typeof docSK === "function" ? docSK : docRap2026V36),
      rekening: (typeof docRekening === "function" ? docRekening : docRap2026V36),
      undangan: (typeof docUndangan === "function" ? docUndangan : docPermohonan2026V36),
      notulen: (typeof docNotulen === "function" ? docNotulen : docBeritaAcaraRap2026V36),
      perubahanRap: docPerubahanRap2026V36,
      baPerubahanRap: docBeritaAcaraPerubahan2026V36,
      tandaTerima: docTandaTerimaPenyaluran2026V36,
      paket7pengajuan: docPaket7Pengajuan2026V36
    };
    document.querySelectorAll(".doc-btn").forEach(b=>b.classList.toggle("active", b.dataset.doc===type));
    const out = $v36("docOutput");
    if(out) out.innerHTML = (map[type] || docPermohonan2026V36)();
  };

  function installButtonsV36(){
    const wrap = document.querySelector("#tab-dokumen .doc-buttons");
    if(wrap && !wrap.querySelector('[data-doc="paket7pengajuan"]')){
      const additions = [
        ["perubahanRap", "5A. Perubahan RAP"],
        ["baPerubahanRap", "5B. BA Perubahan RAP"],
        ["tandaTerima", "7. Tanda Terima Penyaluran"],
        ["paket7pengajuan", "Paket 7 Dokumen 2026"]
      ];
      additions.forEach(([id,label])=>{
        const btn=document.createElement("button");
        btn.className="doc-btn official-2026-btn-v36";
        btn.dataset.doc=id;
        btn.textContent=label;
        btn.onclick=()=>window.previewDoc(id);
        wrap.appendChild(btn);
      });
    }
    document.querySelectorAll(".doc-btn[data-doc]").forEach(btn=>{
      if(btn.dataset.v36Bound) return;
      btn.dataset.v36Bound="1";
      btn.addEventListener("click",()=>setTimeout(()=>window.previewDoc(btn.dataset.doc),0));
    });
    const actionRow = document.querySelector("#tab-dokumen .action-row");
    if(actionRow && !$v36("exportDocxV36")){
      const btn=document.createElement("button");
      btn.className="secondary";
      btn.id="exportDocxV36";
      btn.textContent="Export Word / DOCX";
      btn.onclick=()=>exportCurrentDocxV36();
      actionRow.appendChild(btn);
    }
    if(actionRow && !$v36("v36FormatNote")){
      const p=document.createElement("p");
      p.id="v36FormatNote";
      p.className="hint official-note-v36";
      p.textContent="Format 7 dokumen mengikuti FORMAT DOKUMEN 2026: A4, kolom No autofit, tanda tangan sesuai tata letak resmi.";
      actionRow.insertAdjacentElement("afterend", p);
    }
  }

  function textCleanV36(s){ return String(s||"").replace(/\s+/g," ").trim(); }
  function xmlV36(s){ return String(s||"").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&apos;"}[m])); }
  function wRunV36(text, bold=false){
    return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/>${bold?"<w:b/>":""}</w:rPr><w:t xml:space="preserve">${xmlV36(text)}</w:t></w:r>`;
  }
  function wPPrV36(align){ return `<w:pPr>${align?`<w:jc w:val="${align}"/>`:""}<w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr>`; }
  function wParaV36(text, opts={}){
    if(!textCleanV36(text) && !opts.blank) return "";
    const parts = String(text||"").split(/\n+/).filter(x=>x.trim()||opts.blank);
    return (parts.length?parts:[""]).map(t=>`<w:p>${wPPrV36(opts.align||"both")}${wRunV36(t, !!opts.bold)}</w:p>`).join("");
  }
  function wCellV36(text, opts={}){
    const width = opts.width ? `<w:tcW w:w="${opts.width}" w:type="dxa"/>` : "";
    const borders = opts.noBorder ? "" : `<w:tcBorders><w:top w:val="single" w:sz="6"/><w:left w:val="single" w:sz="6"/><w:bottom w:val="single" w:sz="6"/><w:right w:val="single" w:sz="6"/></w:tcBorders>`;
    const shading = opts.shade ? `<w:shd w:fill="D9D9D9"/>` : "";
    return `<w:tc><w:tcPr>${width}${borders}${shading}<w:vAlign w:val="center"/></w:tcPr>${wParaV36(text,{align:opts.align||"center",bold:opts.bold,blank:true})}</w:tc>`;
  }
  function wTableFromHtmlV36(table){
    const noBorder = table.classList.contains("no-border") || table.classList.contains("sign-two-v36") || table.classList.contains("sign-right-v36");
    const rows=[...table.rows];
    let xml=`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${noBorder?"":`<w:tblBorders><w:top w:val="single" w:sz="6"/><w:left w:val="single" w:sz="6"/><w:bottom w:val="single" w:sz="6"/><w:right w:val="single" w:sz="6"/><w:insideH w:val="single" w:sz="6"/><w:insideV w:val="single" w:sz="6"/></w:tblBorders>`}</w:tblPr>`;
    rows.forEach((tr,ri)=>{
      xml += "<w:tr>";
      [...tr.cells].forEach((td,ci)=>{
        const txt = textCleanV36(td.innerText || td.textContent || "");
        const isHeader = td.tagName.toLowerCase()==="th" || ri===0 && tr.querySelectorAll("th").length;
        const isNo = ci===0 && (/^no\.?$/i.test(txt) || /^\d+\.?$/.test(txt));
        xml += wCellV36(txt,{noBorder, bold:isHeader || td.querySelector("b"), shade:isHeader, width:isNo?"650":undefined, align:isNo?"center":(td.classList.contains("money-cell")?"right":"center")});
      });
      xml += "</w:tr>";
    });
    xml += "</w:tbl>";
    return xml;
  }
  function htmlNodeToWmlV36(node){
    if(node.nodeType===3){ return wParaV36(node.textContent,{align:"both"}); }
    if(node.nodeType!==1) return "";
    const tag=node.tagName.toLowerCase();
    if(node.classList.contains("page-break-v36")) return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    if(tag==="table") return wTableFromHtmlV36(node);
    if(node.classList.contains("title")) return wParaV36(node.innerText,{align:"center",bold:true});
    if(node.classList.contains("date-right-v36")) return wParaV36(node.innerText,{align:"right"});
    if(tag==="h1"||tag==="h2"||tag==="h3") return wParaV36(node.innerText,{align:"center",bold:true});
    if(tag==="p"){
      let align="both"; if(node.style.textAlign==="center"||node.classList.contains("center-v36")) align="center"; if(node.style.textAlign==="right"||node.classList.contains("date-right-v36")) align="right";
      return wParaV36(node.innerText,{align,bold:node.querySelector("b")&&textCleanV36(node.innerText).length<90});
    }
    if(tag==="ol"||tag==="ul") return [...node.children].map((li,i)=>wParaV36(`${i+1}. ${li.innerText}`,{align:"both"})).join("");
    return [...node.childNodes].map(htmlNodeToWmlV36).join("");
  }
  function docxDocumentXmlV36(html){
    const dom = new DOMParser().parseFromString(`<div>${html}</div>`,"text/html");
    const body = [...dom.body.firstChild.childNodes].map(htmlNodeToWmlV36).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  }
  function crc32V36(buf){
    if(!window.__crcTableV36){
      let c, table=[]; for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c=((c&1)?(0xEDB88320^(c>>>1)):(c>>>1)); table[n]=c>>>0; } window.__crcTableV36=table;
    }
    let crc=0^(-1); for(let i=0;i<buf.length;i++) crc=(crc>>>8)^window.__crcTableV36[(crc^buf[i])&0xFF]; return (crc^(-1))>>>0;
  }
  function le16V36(n){return [n&255,(n>>>8)&255];}
  function le32V36(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];}
  function makeZipV36(files){
    const enc=new TextEncoder(); const locals=[]; const centrals=[]; let offset=0;
    files.forEach(f=>{
      const name=enc.encode(f.name); const data=enc.encode(f.content); const crc=crc32V36(data); const size=data.length;
      const local=new Uint8Array([0x50,0x4b,0x03,0x04, ...le16V36(20), ...le16V36(0), ...le16V36(0), ...le16V36(0), ...le16V36(0), ...le32V36(crc), ...le32V36(size), ...le32V36(size), ...le16V36(name.length), ...le16V36(0), ...name, ...data]);
      locals.push(local);
      const central=new Uint8Array([0x50,0x4b,0x01,0x02, ...le16V36(20), ...le16V36(20), ...le16V36(0), ...le16V36(0), ...le16V36(0), ...le16V36(0), ...le32V36(crc), ...le32V36(size), ...le32V36(size), ...le16V36(name.length), ...le16V36(0), ...le16V36(0), ...le16V36(0), ...le16V36(0), ...le32V36(0), ...le32V36(offset), ...name]);
      centrals.push(central); offset += local.length;
    });
    const centralSize=centrals.reduce((s,a)=>s+a.length,0); const centralOffset=offset;
    const end=new Uint8Array([0x50,0x4b,0x05,0x06, ...le16V36(0), ...le16V36(0), ...le16V36(files.length), ...le16V36(files.length), ...le32V36(centralSize), ...le32V36(centralOffset), ...le16V36(0)]);
    const total=offset+centralSize+end.length; const out=new Uint8Array(total); let pos=0; [...locals,...centrals,end].forEach(a=>{out.set(a,pos);pos+=a.length;}); return out;
  }
  function exportCurrentDocxV36(){
    try{ window.previewDoc(window.currentDoc||"permohonan"); }catch(e){}
    const html = $v36("docOutput")?.innerHTML || "";
    const title = `dokumen_${window.currentDoc||"pengajuan"}_rt005_2026`;
    const documentXml = docxDocumentXmlV36(html);
    const files=[
      {name:"[Content_Types].xml",content:`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`},
      {name:"_rels/.rels",content:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`},
      {name:"word/document.xml",content:documentXml}
    ];
    const zip=makeZipV36(files);
    const blob=new Blob([zip],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    if(typeof download === "function") download(blob, `${title}.docx`); else { const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${title}.docx`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1500); }
  }
  window.exportCurrentDocxV36 = exportCurrentDocxV36;

  function initV36(){
    installButtonsV36();
    try{ window.previewDoc(window.currentDoc||"permohonan"); }catch(e){ console.warn(PATCH_ID,e); }
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", initV36); else setTimeout(initV36, 80);
})();




/* ==========================================================
   PATCH v1.37 - AUTO DATA + PREVIEW/PRINT SELECTED DOC FIX
   Target: 7 Dokumen Persyaratan Pengajuan Dana Bantuan BOP RT
   Catatan: hotfix ini memperbaiki v1.36 agar data otomatis
   menarik dari data aplikasi dan cetak/export mengikuti surat
   yang sedang dipilih.
   ========================================================== */
(function(){
  const PATCH_ID = "PATCH_V1_37_AUTO_DATA_PREVIEW_PRINT_FIX";
  window.__BOP_RT005_PATCH_V37__ = true;

  function $(id){ return document.getElementById(id); }
  function getDataV37(){
    try{ if(typeof data !== "undefined" && data) return data; }catch(e){}
    try{ if(window.data) return window.data; }catch(e){}
    return {master:{},pengajuan:{rap:[],peserta:[]},kop:{}};
  }
  function collectV37(){
    try{ if(typeof collectAll === "function") collectAll(); }catch(e){ console.warn(PATCH_ID, "collectAll gagal", e); }
  }
  function escV37(s){
    try{ if(typeof esc === "function") return esc(String(s ?? "")); }catch(e){}
    return String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  }
  function safeV37(v, fb=".................."){ const s=String(v ?? "").trim(); return s || fb; }
  function moneyV37(n){
    const val=Number(n||0);
    try{ if(typeof rupiah === "function") return rupiah(val); }catch(e){}
    return "Rp"+val.toLocaleString("id-ID");
  }
  function terbilangV37(n){
    try{ if(typeof terbilang === "function") return String(terbilang(Number(n||0))).replace(/\s+/g," ").trim(); }catch(e){}
    return "..................";
  }
  function mV37(){ return getDataV37().master || {}; }
  function pV37(){ const d=getDataV37(); if(!d.pengajuan) d.pengajuan={}; return d.pengajuan; }
  function tanggalSuratV37(){
    const p=pV37();
    const t=String(p.tanggalSurat || p.undTanggalSurat || "").trim();
    return t || "Semarang, tanggal bulan tahun";
  }
  function tahunV37(){
    const p=pV37();
    const src=[p.baTahun,p.tanggalSurat,p.undTanggalSurat,p.hadirTanggal].filter(Boolean).join(" ");
    const m=String(src).match(/20\d{2}/);
    return m ? m[0] : "2026";
  }
  function bulanPenyaluranV37(){
    const p=pV37();
    const sel=String(p.selectedMonth || p.baBulan || "").trim();
    if(sel){ return sel.replace(/\s*20\d{2}\s*$/i,"").trim() || sel; }
    return "..................";
  }

  function normalizeRapRowV37(row, i){
    if(Array.isArray(row)){
      return {no:i+1,uraian:row[0]||"",volume:row[1]||"",jumlah:Number(row[2]||0),keterangan:row[3]||"",bulan:""};
    }
    row=row||{};
    const bulan = row.bulan || (row.bulanMulai && row.bulanSelesai ? `${row.bulanMulai} s.d ${row.bulanSelesai}` : (row.bulanMulai || row.bulanSelesai || ""));
    return {
      no:i+1,
      uraian:row.uraian || row.kegiatan || row.nama || "",
      volume:row.volume || row.satuan || row.satuanVolume || "",
      jumlah:Number(row.jumlah ?? row.anggaran ?? row.rencanaAnggaran ?? 0),
      keterangan:row.keterangan || row.ket || "",
      kategori:row.kategori || "",
      subKategori:row.subKategori || "",
      bulan
    };
  }
  function rapRowsV37(){
    const p=pV37();
    const rows=Array.isArray(p.rap) ? p.rap : [];
    return rows.map(normalizeRapRowV37).filter(r=>r.uraian || r.volume || r.jumlah || r.keterangan);
  }
  function totalRapV37(rows=rapRowsV37()){ return rows.reduce((s,r)=>s+Number(r.jumlah||0),0); }
  function perubahanRowsV37(){
    const p=pV37();
    const base=Array.isArray(p.perubahanRap) && p.perubahanRap.length ? p.perubahanRap : (Array.isArray(p.rap)?p.rap:[]);
    return base.map((row,i)=>{
      const r=normalizeRapRowV37(row,i);
      if(!Array.isArray(row) && row){
        return {
          no:i+1,
          awalUraian:row.awalUraian || row.uraianAwal || r.uraian,
          awalVolume:row.awalVolume || row.volumeAwal || r.volume,
          awalJumlah:Number(row.awalJumlah ?? row.jumlahAwal ?? r.jumlah),
          perubahanUraian:row.perubahanUraian || row.uraianPerubahan || row.uraianBaru || r.uraian,
          perubahanVolume:row.perubahanVolume || row.volumePerubahan || row.volumeBaru || r.volume,
          perubahanJumlah:Number(row.perubahanJumlah ?? row.jumlahPerubahan ?? row.jumlahBaru ?? r.jumlah),
          ket:row.alasan || row.ket || row.keterangan || "-"
        };
      }
      return {no:i+1,awalUraian:r.uraian,awalVolume:r.volume,awalJumlah:r.jumlah,perubahanUraian:r.uraian,perubahanVolume:r.volume,perubahanJumlah:r.jumlah,ket:r.keterangan||"-"};
    }).filter(r=>r.awalUraian || r.perubahanUraian || r.awalJumlah || r.perubahanJumlah);
  }

  function pesertaRowsV37(){
    const p=pV37(), m=mV37();
    let raw=Array.isArray(p.peserta) ? p.peserta : [];
    let rows=raw.map((r,i)=>{
      if(Array.isArray(r)) return {no:i+1,nama:r[0]||"",jabatan:r[1]||"",alamat:r[2]||""};
      return {no:i+1,nama:r?.nama||"",jabatan:r?.jabatan||r?.status||"",alamat:r?.alamat||r?.rt||""};
    }).filter(r=>r.nama || r.jabatan || r.alamat);

    // Ganti placeholder jabatan bawaan dengan nama asli jika sudah diisi di master.
    rows = rows.map((r,idx)=>{
      const nameLow=String(r.nama||"").toLowerCase();
      if(idx===0 && m.ketua && /ketua/.test(nameLow)) return {...r,nama:m.ketua,jabatan:r.jabatan||`Ketua RT ${m.rt||"005"} RW ${m.rw||"012"}`};
      if(idx===1 && m.sekretaris && /sekretaris/.test(nameLow)) return {...r,nama:m.sekretaris,jabatan:r.jabatan||`Sekretaris RT ${m.rt||"005"} RW ${m.rw||"012"}`};
      if(idx===2 && m.bendahara && /bendahara/.test(nameLow)) return {...r,nama:m.bendahara,jabatan:r.jabatan||`Bendahara RT ${m.rt||"005"} RW ${m.rw||"012"}`};
      return r;
    });

    if(!rows.length){
      const rt=m.rt||"005", rw=m.rw||"012";
      rows=[
        {no:1,nama:safeV37(m.ketua,"Nama Jelas"),jabatan:`Ketua RT ${rt} RW ${rw}`},
        {no:2,nama:safeV37(m.sekretaris,"Nama Jelas"),jabatan:`Sekretaris RT ${rt} RW ${rw}`},
        {no:3,nama:safeV37(m.bendahara,"Nama Jelas"),jabatan:`Bendahara RT ${rt} RW ${rw}`},
        {no:4,nama:"..................",jabatan:`Warga RT ${rt} RW ${rw}`},
        {no:5,nama:"..................",jabatan:`Warga RT ${rt} RW ${rw}`},
        {no:6,nama:"..................",jabatan:`Warga RT ${rt} RW ${rw}`},
        {no:7,nama:"..................",jabatan:`Warga RT ${rt} RW ${rw}`},
        {no:8,nama:"..................",jabatan:`Warga RT ${rt} RW ${rw}`}
      ];
    }
    return rows.map((r,i)=>({...r,no:i+1}));
  }

  function officialV37(body){
    const kop = (typeof kopHTML === "function") ? kopHTML() : `<div class="kop"><div><h1>KOP SURAT</h1></div></div>`;
    return `<div class="official official-v36 official-v37">${kop}<div class="official-body-v37">${body}</div></div>`;
  }
  function rowEmptyV37(cols){ return `<tr>${Array.from({length:cols}).map((_,i)=>`<td${i===0?' class="col-no-v37"':''}>&nbsp;</td>`).join("")}</tr>`; }

  function rapTableV37(rows=rapRowsV37(), opts={}){
    const body=(rows.length?rows:[]).map((r,i)=>`<tr><td class="col-no-v37">${i+1}</td><td>${escV37(r.uraian)}</td><td>${escV37(r.volume)}</td><td class="money-cell-v37">${moneyV37(r.jumlah)}</td><td>${escV37(r.keterangan)}</td></tr>`).join("") ||
      `${rowEmptyV37(5)}${rowEmptyV37(5)}${rowEmptyV37(5)}${rowEmptyV37(5)}<tr><td class="col-no-v37">5</td><td>Dst..</td><td></td><td></td><td></td></tr>`;
    const total=rows.length?totalRapV37(rows):0;
    return `<table class="official-table-v37 rap-table-v37"><thead><tr><th class="col-no-v37">No</th><th>Uraian Kegiatan</th><th>Satuan/Volume</th><th>Rencana Anggaran</th><th>Keterangan</th></tr></thead><tbody>${body}<tr><td colspan="3"><b>Jumlah</b></td><td class="money-cell-v37"><b>${moneyV37(total)}</b></td><td></td></tr></tbody></table>`;
  }

  function signTwoByTwoV37(){
    const m=mV37(), p=pV37();
    const rt=safeV37(m.rt,"005"), rw=safeV37(m.rw,"012");
    return `<p class="mengetahui-v37">Mengetahui,</p>
    <table class="sign-two-v37 no-border"><tr>
      <td>Ketua RT ${escV37(rt)} RW ${escV37(rw)}<br><span class="sign-note-v37">Tanda Tangan dan<br>Stempel RT</span><div class="sign-space-v37"></div><b>${escV37(safeV37(m.ketua,"Nama Jelas"))}</b></td>
      <td>Bendahara RT ${escV37(rt)} RW ${escV37(rw)}<br><span class="sign-note-v37">Tanda Tangan</span><div class="sign-space-v37"></div><b>${escV37(safeV37(m.bendahara,"Nama Jelas"))}</b></td>
    </tr><tr>
      <td>Lurah ${escV37(safeV37(m.kelurahan,".................."))}<br><span class="sign-note-v37">Tanda Tangan dan<br>Stempel Lurah</span><div class="sign-space-v37"></div><b>${escV37(safeV37(p.namaLurah,"Nama Jelas"))}</b></td>
      <td>Ketua RW ${escV37(rw)}<br><span class="sign-note-v37">Tanda Tangan dan<br>Stempel RW</span><div class="sign-space-v37"></div><b>${escV37(safeV37(p.namaKetuaRw,"Nama Jelas"))}</b></td>
    </tr></table>`;
  }
  function signRightKetuaV37(prefix="Hormat kami,"){
    const m=mV37();
    return `<table class="sign-right-v37 no-border"><tr><td></td><td>${escV37(prefix)}<br>Ketua RT ${escV37(safeV37(m.rt,"005"))} RW ${escV37(safeV37(m.rw,"012"))},<br><span class="sign-note-v37">Tanda Tangan dan<br>Stempel RT</span><div class="sign-space-v37"></div><b>${escV37(safeV37(m.ketua,"Nama Jelas"))}</b></td></tr></table>`;
  }

  function docRap2026V37(){
    return officialV37(`<div class="title">RENCANA ANGGARAN PENGGUNAAN<br>BANTUAN OPERASIONAL RT</div>${rapTableV37()}<p class="date-right-v37">${escV37(tanggalSuratV37())}</p>${signTwoByTwoV37()}<p class="ket-v37">Ket.: coret yang tidak perlu</p>`);
  }

  function docPermohonan2026V37(){
    const m=mV37(), p=pV37();
    let nomor = p.nomorSurat || "........";
    try{ if(typeof autoNumber === "function") nomor = p.nomorSurat || autoNumber("permohonan", p.tanggalSurat||tanggalSuratV37()); }catch(e){}
    const total=totalRapV37() || 25000000;
    return officialV37(`<p class="date-right-v37">${escV37(tanggalSuratV37())}</p>
    <table class="letter-head-v37 no-border"><tr><td class="letter-meta-v37">
      <table class="no-border meta-inner-v37"><tr><td>Nomor</td><td>: ${escV37(nomor)}</td></tr><tr><td>Sifat</td><td>: ${escV37(safeV37(p.sifatSurat,"Segera"))}</td></tr><tr><td>Lampiran</td><td>: ${escV37(safeV37(p.lampiranSurat,"1 (satu) berkas"))}</td></tr><tr><td>Hal</td><td>: Permohonan Pencairan Bantuan Operasional RT</td></tr></table>
    </td><td class="letter-to-v37">Kepada<br>Yth. Lurah ${escV37(safeV37(m.kelurahan,"........"))}<br>di-<br>SEMARANG</td></tr></table>
    <p>Bersama ini kami mengajukan permohonan pencairan Bantuan Operasional RT ${escV37(safeV37(m.rt,"005"))} RW ${escV37(safeV37(m.rw,"012"))} sebesar ${moneyV37(total)} dengan rincian sebagaimana terlampir (Lampiran I).</p>
    <p>Sebagai bahan pertimbangan, bersama ini kami sampaikan persyaratan pencairan Bantuan Operasional RT ${escV37(safeV37(m.rt,"005"))} RW ${escV37(safeV37(m.rw,"012"))} sesuai dengan Peraturan Wali Kota Nomor .... Tahun ....... tentang Pemberian Bantuan Operasional Rukun Tetangga dan Rukun Warga Kota Semarang yang Bersumber dari Anggaran Pendapatan dan Belanja Daerah Kota Semarang.</p>
    <p>Pencairan bantuan dapat ditransfer melalui rekening Bank Jateng atas nama ${escV37(safeV37(p.namaRekening,"............"))} nomor rekening ${escV37(safeV37(p.nomorRekening,"............"))}.</p>
    <p>Demikian permohonan kami, atas perhatian dan kerjasamanya kami sampaikan terima kasih.</p>${signRightKetuaV37()}<p class="ket-v37">Ket.: coret yang tidak perlu</p>`);
  }

  function docBeritaAcaraRap2026V37(){
    const m=mV37(), p=pV37();
    const peserta=pesertaRowsV37();
    const pesertaText=peserta.slice(0,12).map(r=>`${r.nama}${r.jabatan?` (${r.jabatan})`:""}`).join(", ");
    const signRows=peserta.map((r,i)=>`<tr><td class="col-no-v37">${i+1}.</td><td>${escV37(r.nama)}</td><td>${escV37(r.jabatan)}</td><td>${i+1}.</td></tr>`).join("");
    return officialV37(`<div class="title">BERITA ACARA<br>KESEPAKATAN RENCANA ANGGARAN PENGGUNAAN BANTUAN OPERASIONAL RT</div>
    <p class="center-v37">Nomor: ${escV37(p.baNomor||"..................")}</p>
    <p>Pada hari ini ${escV37(safeV37(p.baHari,"................"))} tanggal ${escV37(safeV37(p.baTanggal,"......"))} bulan ${escV37(safeV37(p.baBulan,".................."))} tahun ${escV37(safeV37(p.baTahun,tahunV37()))}, bertempat di ${escV37(safeV37(p.baTempat,"................"))} pada pukul ${escV37(safeV37(p.baPukul,".......... WIB"))} telah dilaksanakan pertemuan pembahasan Kesepakatan Rencana Anggaran Penggunaan Bantuan Operasional RT ${escV37(safeV37(m.rt,"005"))} RW ${escV37(safeV37(m.rw,"012"))}. Pertemuan dipimpin oleh ${escV37(safeV37(p.baPimpinan||m.ketua,"........"))}, dan dihadiri oleh: ${escV37(pesertaText||"........")}</p>
    <p>Adapun hasil pertemuan sebagai berikut:</p>${rapTableV37()}
    <p>Demikian Berita Acara Hasil Kesepakatan Rencana Anggaran Penggunaan Bantuan Operasional RT ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>
    <p>Kami yang bertanda tangan di bawah ini:</p><table class="official-table-v37 sign-list-v37"><tr><th class="col-no-v37">No.</th><th>Nama</th><th>Jabatan</th><th>Tanda Tangan</th></tr>${signRows}</table>`);
  }

  function docSptjm2026V37(){
    const m=mV37(), p=pV37();
    let nomor=p.sptjmNomor || p.nomorSptjm || ".....................";
    try{ if(typeof autoNumber === "function" && !p.sptjmNomor && !p.nomorSptjm) nomor = autoNumber("sptjm", p.tanggalSurat||tanggalSuratV37()); }catch(e){}
    return officialV37(`<div class="title">SURAT PERNYATAAN TANGGUNG JAWAB MUTLAK</div>
    <p class="center-v37">Nomor: ${escV37(nomor)}</p>
    <p>Yang bertanda tangan di bawah ini:</p>
    <table class="identity-table-v37 no-border"><tr><td>Nama</td><td>: ${escV37(safeV37(m.ketua,"....................."))}</td></tr><tr><td>No. KTP</td><td>: ${escV37(safeV37(m.noKtpKetua||p.ktpKetua||p.noKtp||"....................."))}</td></tr><tr><td>Alamat</td><td>: ${escV37(safeV37(m.alamat,"....................."))}</td></tr><tr><td>Jabatan</td><td>: Ketua RT</td></tr><tr><td>RT/RW</td><td>: ${escV37(safeV37(m.rt,"005"))} / ${escV37(safeV37(m.rw,"012"))}</td></tr></table>
    <p>Saya selaku Ketua RT ${escV37(safeV37(m.rt,"005"))} RW ${escV37(safeV37(m.rw,"012"))} dengan ini menyatakan bahwa:</p>
    <ol class="official-ol-v37"><li>Bertanggung jawab sepenuhnya terhadap kebenaran data yang diajukan di dalam Bantuan Operasional RT dan RW. Apabila di kemudian hari ternyata ditemukan data yang tidak benar, maka saya siap bertanggung jawab dan menanggung segala konsekuensi yang timbul.</li><li>Akan menggunakan bantuan sesuai dengan ketentuan yang berlaku dan bertanggung jawab atas penggunaannya secara formal dan materiil apabila mendapatkan Bantuan Operasional RT dari Pemerintah Kota Semarang.</li><li>Akan bertanggung jawab mengembalikan dana bantuan operasional apabila terdapat temuan dalam audit.</li><li>Dalam hal terdapat pergantian Ketua RT ${escV37(safeV37(m.rt,"005"))} RW ${escV37(safeV37(m.rw,"012"))}, maka tanggung jawab Dana Bantuan Operasional beralih kepada Ketua RT ${escV37(safeV37(m.rt,"005"))} RW ${escV37(safeV37(m.rw,"012"))} yang baru terhitung sejak ditetapkan dalam Keputusan Lurah.</li></ol>
    <p>Demikian surat pernyataan ini saya buat dengan sebenar-benarnya tanpa ada unsur paksaan untuk dapat digunakan sebagaimana mestinya.</p>
    <table class="sign-right-v37 no-border"><tr><td></td><td>${escV37(tanggalSuratV37())}<br>Ketua RT ${escV37(safeV37(m.rt,"005"))} RW ${escV37(safeV37(m.rw,"012"))},<br><span class="sign-note-v37">Tanda Tangan dan<br>Stempel RT</span><br>(materai 10 ribu)<div class="sign-space-v37"></div><b>${escV37(safeV37(m.ketua,"Nama Jelas"))}</b></td></tr></table><p class="ket-v37">Ket.: coret yang tidak perlu</p>`);
  }

  function perubahanTableV37(){
    const rows=perubahanRowsV37();
    const body=(rows.length?rows:[]).map((r,i)=>`<tr><td class="col-no-v37">${i+1}</td><td>${escV37(r.awalUraian)}</td><td>${escV37(r.awalVolume)}</td><td class="money-cell-v37">${moneyV37(r.awalJumlah)}</td><td class="col-no-v37">${i+1}</td><td>${escV37(r.perubahanUraian)}</td><td>${escV37(r.perubahanVolume)}</td><td class="money-cell-v37">${moneyV37(r.perubahanJumlah)}</td><td>${escV37(r.ket)}</td></tr>`).join("") ||
      `${rowEmptyV37(9)}${rowEmptyV37(9)}${rowEmptyV37(9)}<tr><td></td><td>dst</td><td></td><td></td><td></td><td>dst</td><td></td><td></td><td></td></tr>`;
    const totalAwal=rows.reduce((s,r)=>s+Number(r.awalJumlah||0),0);
    const totalPerubahan=rows.reduce((s,r)=>s+Number(r.perubahanJumlah||0),0);
    return `<table class="official-table-v37 perubahan-table-v37"><thead><tr><th class="col-no-v37">No</th><th>Uraian Kegiatan Awal</th><th>Satuan/Volume</th><th>Rencana Anggaran</th><th class="col-no-v37">No</th><th>Uraian Perubahan Kegiatan</th><th>Satuan/Volume</th><th>Rencana Anggaran</th><th>Ket</th></tr></thead><tbody>${body}<tr><td colspan="3"><b>Jumlah</b></td><td class="money-cell-v37"><b>${moneyV37(totalAwal)}</b></td><td colspan="3"><b>Jumlah</b></td><td class="money-cell-v37"><b>${moneyV37(totalPerubahan)}</b></td><td></td></tr></tbody></table>`;
  }
  function docPerubahanRap2026V37(){
    return officialV37(`<div class="title">PERUBAHAN RENCANA ANGGARAN PENGGUNAAN<br>BANTUAN OPERASIONAL RT</div>${perubahanTableV37()}<p class="date-right-v37">${escV37(tanggalSuratV37())}</p>${signTwoByTwoV37()}<p class="ket-v37">Ket.: coret yang tidak perlu</p>`);
  }
  function docBeritaAcaraPerubahan2026V37(){
    const m=mV37(), p=pV37();
    const peserta=pesertaRowsV37();
    const signRows=peserta.map((r,i)=>`<tr><td class="col-no-v37">${i+1}.</td><td>${escV37(r.nama)}</td><td>${escV37(r.jabatan)}</td><td>${i+1}.</td></tr>`).join("");
    return officialV37(`<div class="title">BERITA ACARA<br>KESEPAKATAN PERUBAHAN RENCANA ANGGARAN PENGGUNAAN BANTUAN OPERASIONAL RT</div>
    <p class="center-v37">Nomor: ${escV37(p.baPerubahanNomor || p.baNomor || "..................")}</p>
    <p>Pada hari ini ${escV37(safeV37(p.baHari,"................"))} tanggal ${escV37(safeV37(p.baTanggal,"......"))} bulan ${escV37(safeV37(p.baBulan,".................."))} tahun ${escV37(safeV37(p.baTahun,tahunV37()))}, bertempat di ${escV37(safeV37(p.baTempat,"................"))} pada pukul ${escV37(safeV37(p.baPukul,".......... WIB"))} telah dilaksanakan pertemuan pembahasan Kesepakatan Perubahan Rencana Anggaran Penggunaan Bantuan Operasional RT ${escV37(safeV37(m.rt,"005"))} RW ${escV37(safeV37(m.rw,"012"))}. Pertemuan dipimpin oleh ${escV37(safeV37(p.baPimpinan||m.ketua,"........"))}, dan dihadiri oleh: ${escV37(peserta.slice(0,12).map(r=>r.nama).join(", ")||"........")}</p>
    <p>Adapun hasil pertemuan sebagai berikut:</p>${perubahanTableV37()}
    <p>Demikian Berita Acara Hasil Kesepakatan Perubahan Rencana Anggaran Penggunaan Bantuan Operasional RT ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>
    <p>Kami yang bertanda tangan di bawah ini:</p><table class="official-table-v37 sign-list-v37"><tr><th class="col-no-v37">No.</th><th>Nama</th><th>Jabatan</th><th>Tanda Tangan</th></tr>${signRows}</table>`);
  }
  function docTandaTerimaPenyaluran2026V37(){
    const m=mV37(), p=pV37();
    const total=totalRapV37() || 25000000;
    return officialV37(`<div class="title">TANDA TERIMA PENYALURAN UANG BANTUAN OPERASIONAL<br>RUKUN TETANGGA DAN RUKUN WARGA KOTA SEMARANG</div>
    <table class="identity-table-v37 no-border"><tr><td>BULAN</td><td>: ${escV37(bulanPenyaluranV37())}</td></tr><tr><td>TAHUN</td><td>: ${escV37(tahunV37())}</td></tr><tr><td>KELURAHAN</td><td>: ${escV37(safeV37(m.kelurahan,"Tegalsari"))}</td></tr><tr><td>KECAMATAN</td><td>: ${escV37(safeV37(m.kecamatan,"Candisari"))}</td></tr></table>
    <table class="official-table-v37 tanda-terima-v37"><tr><th class="col-no-v37">No.</th><th>RT/RW</th><th>Nama RT/RW</th><th>Nomor Rekening</th><th>Jumlah</th><th>Tandatangan</th></tr>
    <tr><td class="col-no-v37">1.</td><td>RT.${escV37(safeV37(m.rt,"005"))}</td><td>${escV37(safeV37(m.ketua,"................"))}</td><td>${escV37(safeV37(p.nomorRekening,"................"))}</td><td class="money-cell-v37">${moneyV37(total)}</td><td>1.</td></tr>
    <tr><td class="col-no-v37">2.</td><td>dst......</td><td></td><td></td><td>Rp................</td><td>2.</td></tr>
    <tr><td colspan="4"><b>Jumlah</b></td><td class="money-cell-v37"><b>${moneyV37(total)}</b></td><td></td></tr>
    <tr><td colspan="4"><b>Jumlah Keseluruhan</b></td><td class="money-cell-v37"><b>${moneyV37(total)}</b></td><td></td></tr></table>
    <p class="date-right-v37">${escV37(tanggalSuratV37())}</p>
    <p>Mengetahui,</p><table class="sign-two-v37 no-border"><tr><td>Camat ${escV37(safeV37(m.kecamatan,"................"))}<div class="sign-space-v37"></div>Tanda Tangan<br>dan stempel<br><br><b>${escV37(safeV37(p.namaCamat,"Nama Jelas"))}</b></td><td>Lurah ${escV37(safeV37(m.kelurahan,"................"))},<div class="sign-space-v37"></div>Tanda Tangan<br>dan stempel<br><br><b>${escV37(safeV37(p.namaLurah,"Nama Jelas"))}</b></td></tr></table>`);
  }
  function docPaket7Pengajuan2026V37(){
    const docs=[docRap2026V37(),docBeritaAcaraRap2026V37(),docPermohonan2026V37(),docSptjm2026V37(),docPerubahanRap2026V37(),docBeritaAcaraPerubahan2026V37(),docTandaTerimaPenyaluran2026V37()];
    return docs.map((d,i)=>`<div class="paket-doc-v37">${d}</div>${i<docs.length-1?'<div class="page-break-v37"></div>':''}`).join("");
  }

  function docMapV37(){
    return {
      permohonan: docPermohonan2026V37,
      rap: docRap2026V37,
      rapbulanan: (typeof docRapBulanan === "function" ? docRapBulanan : docRap2026V37),
      ba: docBeritaAcaraRap2026V37,
      hadir: (typeof docHadir === "function" ? docHadir : docBeritaAcaraRap2026V37),
      sptjm: docSptjm2026V37,
      sk: (typeof docSK === "function" ? docSK : docRap2026V37),
      rekening: (typeof docRekening === "function" ? docRekening : docRap2026V37),
      undangan: (typeof docUndangan === "function" ? docUndangan : docPermohonan2026V37),
      notulen: (typeof docNotulen === "function" ? docNotulen : docBeritaAcaraRap2026V37),
      perubahanRap: docPerubahanRap2026V37,
      baPerubahanRap: docBeritaAcaraPerubahan2026V37,
      tandaTerima: docTandaTerimaPenyaluran2026V37,
      paket7pengajuan: docPaket7Pengajuan2026V37
    };
  }

  // Expose generator resmi terbaru.
  window.docRap = docRap2026V37;
  window.docPermohonan = docPermohonan2026V37;
  window.docBA = docBeritaAcaraRap2026V37;
  window.docSptjm = docSptjm2026V37;
  window.docPerubahanRapV37 = docPerubahanRap2026V37;
  window.docBeritaAcaraPerubahanV37 = docBeritaAcaraPerubahan2026V37;
  window.docTandaTerimaPenyaluranV37 = docTandaTerimaPenyaluran2026V37;
  window.docPaket7PengajuanV37 = docPaket7Pengajuan2026V37;

  function previewDocV37(type){
    collectV37();
    const nextType=type || (typeof currentDoc !== "undefined" ? currentDoc : (window.currentDoc || "permohonan"));
    try{ currentDoc = nextType; }catch(e){ window.currentDoc = nextType; }
    window.currentDoc = nextType;
    const map=docMapV37();
    document.querySelectorAll(".doc-btn").forEach(b=>b.classList.toggle("active", b.dataset.doc===nextType));
    const out=$("docOutput");
    if(out) out.innerHTML=(map[nextType] || docPermohonan2026V37)();
  }
  try{ previewDoc = previewDocV37; }catch(e){}
  window.previewDoc = previewDocV37;

  function installButtonsV37(){
    const wrap=document.querySelector("#tab-dokumen .doc-buttons");
    if(wrap){
      const additions=[
        ["perubahanRap","5A. Perubahan RAP"],
        ["baPerubahanRap","5B. BA Perubahan RAP"],
        ["tandaTerima","7. Tanda Terima Penyaluran"],
        ["paket7pengajuan","Paket 7 Dokumen 2026"]
      ];
      additions.forEach(([id,label])=>{
        let btn=wrap.querySelector(`[data-doc="${id}"]`);
        if(!btn){
          btn=document.createElement("button");
          btn.className="doc-btn official-2026-btn-v37";
          btn.dataset.doc=id;
          btn.textContent=label;
          wrap.appendChild(btn);
        }
        btn.onclick=()=>previewDocV37(id);
      });
      document.querySelectorAll(".doc-btn[data-doc]").forEach(btn=>{ btn.onclick=()=>previewDocV37(btn.dataset.doc); });
    }
    const actionRow=document.querySelector("#tab-dokumen .action-row");
    if(actionRow){
      let btn=$("exportDocxV37") || $("exportDocxV36");
      if(!btn){
        btn=document.createElement("button");
        btn.className="secondary";
        btn.id="exportDocxV37";
        btn.textContent="Export Word / DOCX";
        actionRow.appendChild(btn);
      }
      btn.id="exportDocxV37";
      btn.onclick=()=>exportCurrentDocxV37();
    }
    const printBtn=$("printDoc"); if(printBtn) printBtn.onclick=()=>cleanPrintV37("doc");
    const htmlBtn=$("exportHtml"); if(htmlBtn) htmlBtn.onclick=()=>{
      const type=(typeof currentDoc !== "undefined" ? currentDoc : window.currentDoc) || "permohonan";
      previewDocV37(type);
      const html=$("docOutput")?.innerHTML || "";
      const blob=new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>Dokumen BOP</title><link rel="stylesheet" href="styles.css"></head><body><div class="doc-paper">${html}</div></body></html>`],{type:"text/html"});
      if(typeof download==="function") download(blob,`dokumen_${type}_rt005.html`);
    };
    const saveBtn=$("saveToHistory"); if(saveBtn) saveBtn.onclick=()=>{
      const type=(typeof currentDoc !== "undefined" ? currentDoc : window.currentDoc) || "permohonan";
      previewDocV37(type);
      if(typeof addHistory === "function") addHistory("Pengajuan",type,`Dokumen Pengajuan - ${String(type).toUpperCase()}`,$("docOutput")?.innerHTML||"");
    };
  }

  function printCssV37(){
    return `
    @page{size:A4;margin:12mm 13mm 12mm 13mm}
    html,body{margin:0;padding:0;background:#fff;color:#000}
    body{font-family:"Times New Roman",serif;font-size:11.5pt;line-height:1.24}
    .print-page{width:184mm;box-sizing:border-box;margin:0 auto;background:#fff}
    .official,.official-v37{font-family:"Times New Roman",serif;color:#000;font-size:11.5pt;line-height:1.24;width:100%;box-sizing:border-box;text-align:justify}
    .kop{display:flex;align-items:center;border-bottom:3px double #000;padding:4px 0 8px 0;margin-bottom:14px;width:100%;box-sizing:border-box;page-break-inside:avoid;break-inside:avoid}
    .kop-logo-wrap{width:56px;min-width:56px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
    .kop-logo{width:52px;height:auto;max-height:64px;object-fit:contain;display:block}
    .kop-logo-spacer{width:56px;min-width:56px;flex-shrink:0}
    .kop-text{flex:1;text-align:center;padding:0 4px}
    .kop-b1{font-family:"Times New Roman",serif;font-size:15pt;font-weight:bold;text-transform:uppercase;text-align:center;white-space:nowrap;line-height:1.1;margin:0;padding:0}
    .kop-b2{font-family:"Times New Roman",serif;font-size:12.5pt;font-weight:bold;text-transform:uppercase;text-align:center;white-space:nowrap;line-height:1.1;margin:1px 0;padding:0}
    .kop-addr{font-family:"Times New Roman",serif;font-size:9pt;font-weight:normal;text-align:center;margin-top:3px;line-height:1.2;white-space:normal}
    .official .title{text-align:center;font-weight:bold;text-transform:uppercase;margin:10px 0 12px;font-size:13pt;line-height:1.2}
    .official p{margin:7px 0;text-align:justify}.center-v37{text-align:center!important}.date-right-v37{text-align:right!important}.ket-v37{font-size:10pt}.mengetahui-v37{margin-top:14px!important}
    .official table{width:100%;border-collapse:collapse;table-layout:auto;margin:4px 0}.official th,.official td{border:1px solid #000;padding:4px 5px;vertical-align:top;overflow-wrap:break-word;word-break:normal}
    .official th{font-weight:bold;text-align:center;background:#eee}.official .no-border td,.official .no-border th,.official table.no-border td,.official table.no-border th{border:0!important;background:transparent!important;padding:2px 3px!important}
    .col-no-v37,.official table th.col-no-v37,.official table td.col-no-v37{width:8mm!important;min-width:8mm!important;max-width:9mm!important;text-align:center!important;white-space:nowrap!important;padding-left:2px!important;padding-right:2px!important}
    .money-cell-v37{text-align:right!important;white-space:nowrap}.letter-head-v37 td{vertical-align:top}.letter-to-v37{width:42%;text-align:left!important}.letter-meta-v37{width:58%}.meta-inner-v37 td:first-child,.identity-table-v37 td:first-child{width:36mm;white-space:nowrap}.sign-two-v37{margin-top:10px}.sign-two-v37 td{width:50%;text-align:center!important;vertical-align:top}.sign-right-v37 td:first-child{width:55%}.sign-right-v37 td:last-child{text-align:center!important}.sign-note-v37{display:block;margin-top:4px}.sign-space-v37{height:52px}.sign-list-v37 td{text-align:left}.sign-list-v37 td:first-child,.sign-list-v37 td:last-child{text-align:center}.page-break-v37{page-break-after:always;break-after:page;height:0}.official-ol-v37{margin:5px 0 8px 22px;padding:0;text-align:justify}.official-ol-v37 li{margin:4px 0;text-align:justify}
    .perubahan-table-v37{font-size:9.5pt}.perubahan-table-v37 th,.perubahan-table-v37 td{padding:3px 4px}.tanda-terima-v37 th,.tanda-terima-v37 td{padding:4px}
    @media print{html,body{width:210mm;min-height:297mm}.print-page{width:184mm;margin:0 auto}.page-break-v37{page-break-after:always}}
    `;
  }

  // Override fungsi cetak iframe lama agar selalu mencetak surat yang dipilih, bukan default permohonan.
  function getPrintHtmlV37(target){
    collectV37();
    let html="", title="Dokumen BOP";
    if(target==="lpj"){
      html=(typeof docLpj === "function") ? docLpj() : ($("lpjOutput")?.innerHTML||"");
    }else if(target==="pk"){
      try{ if(typeof collectPersiapan === "function") collectPersiapan(); }catch(e){}
      html=(typeof pkDocs!=="undefined" && pkDocs[currentPkDoc]) ? pkDocs[currentPkDoc]() : ($("pkDocOutput")?.innerHTML||"");
    }else{
      const type=(typeof currentDoc !== "undefined" ? currentDoc : window.currentDoc) || "permohonan";
      previewDocV37(type);
      html=$("docOutput")?.innerHTML || "";
      title=`Dokumen ${type}`;
    }
    return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${printCssV37()}</style></head><body><div class="print-page">${html}</div></body></html>`;
  }
  function printInIframeV37(target){
    const old=$("printFrameV22"); if(old) old.remove();
    const frame=document.createElement("iframe");
    frame.id="printFrameV22"; frame.className="print-frame-v22";
    frame.style.position="fixed"; frame.style.right="0"; frame.style.bottom="0"; frame.style.width="0"; frame.style.height="0"; frame.style.border="0";
    document.body.appendChild(frame);
    const doc=frame.contentDocument || frame.contentWindow.document;
    doc.open(); doc.write(getPrintHtmlV37(target)); doc.close();
    setTimeout(()=>{ frame.contentWindow.focus(); frame.contentWindow.print(); },350);
    setTimeout(()=>{try{frame.remove()}catch(e){}},60000);
  }
  function cleanPrintV37(target){ printInIframeV37(target==="lpj"?"lpj":"doc"); }
  try{ printCssV22 = printCssV37; }catch(e){}
  try{ getPrintHtmlV22 = getPrintHtmlV37; }catch(e){}
  try{ printInIframeV22 = printInIframeV37; }catch(e){}
  try{ cleanPrint = cleanPrintV37; }catch(e){}
  window.cleanPrint = cleanPrintV37;

  // Export DOCX sederhana, memakai HTML yang sedang dipilih.
  function textCleanV37(s){ return String(s||"").replace(/\s+/g," ").trim(); }
  function xmlV37(s){ return String(s||"").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&apos;"}[m])); }
  function wRunV37(text,bold=false){return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/>${bold?"<w:b/>":""}</w:rPr><w:t xml:space="preserve">${xmlV37(text)}</w:t></w:r>`;}
  function wPPrV37(align){return `<w:pPr>${align?`<w:jc w:val="${align}"/>`:""}<w:spacing w:after="100" w:line="276" w:lineRule="auto"/></w:pPr>`;}
  function wParaV37(text,opts={}){if(!textCleanV37(text)&&!opts.blank)return"";const lines=String(text||"").split(/\n+/).filter(x=>x.trim()||opts.blank);return (lines.length?lines:[""]).map(t=>`<w:p>${wPPrV37(opts.align||"both")}${wRunV37(t,!!opts.bold)}</w:p>`).join("");}
  function wCellV37(text,opts={}){const width=opts.width?`<w:tcW w:w="${opts.width}" w:type="dxa"/>`:"";const borders=opts.noBorder?"":`<w:tcBorders><w:top w:val="single" w:sz="6"/><w:left w:val="single" w:sz="6"/><w:bottom w:val="single" w:sz="6"/><w:right w:val="single" w:sz="6"/></w:tcBorders>`;const shade=opts.shade?`<w:shd w:fill="D9D9D9"/>`:"";return `<w:tc><w:tcPr>${width}${borders}${shade}<w:vAlign w:val="center"/></w:tcPr>${wParaV37(text,{align:opts.align||"center",bold:opts.bold,blank:true})}</w:tc>`;}
  function wTableFromHtmlV37(table){
    const noBorder=table.classList.contains("no-border")||table.classList.contains("sign-two-v37")||table.classList.contains("sign-right-v37");
    const rows=[...table.rows]; let xml=`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${noBorder?"":`<w:tblBorders><w:top w:val="single" w:sz="6"/><w:left w:val="single" w:sz="6"/><w:bottom w:val="single" w:sz="6"/><w:right w:val="single" w:sz="6"/><w:insideH w:val="single" w:sz="6"/><w:insideV w:val="single" w:sz="6"/></w:tblBorders>`}</w:tblPr>`;
    rows.forEach((tr,ri)=>{xml+="<w:tr>";[...tr.cells].forEach((td,ci)=>{const txt=textCleanV37(td.innerText||td.textContent||"");const isHeader=td.tagName.toLowerCase()==="th"||ri===0&&tr.querySelectorAll("th").length;const isNo=td.classList.contains("col-no-v37") || (ci===0 && (/^no\.?$/i.test(txt)||/^\d+\.?$/.test(txt)));xml+=wCellV37(txt,{noBorder,bold:isHeader||!!td.querySelector("b"),shade:isHeader,width:isNo?"520":undefined,align:isNo?"center":(td.classList.contains("money-cell-v37")?"right":"center")});});xml+="</w:tr>";});
    return xml+"</w:tbl>";
  }
  function htmlNodeToWmlV37(node){
    if(node.nodeType===3)return wParaV37(node.textContent,{align:"both"}); if(node.nodeType!==1)return"";
    const tag=node.tagName.toLowerCase();
    if(node.classList.contains("page-break-v37")||node.classList.contains("page-break-v36"))return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    if(tag==="table")return wTableFromHtmlV37(node);
    if(node.classList.contains("title"))return wParaV37(node.innerText,{align:"center",bold:true});
    if(node.classList.contains("date-right-v37"))return wParaV37(node.innerText,{align:"right"});
    if(tag==="h1"||tag==="h2"||tag==="h3")return wParaV37(node.innerText,{align:"center",bold:true});
    if(tag==="p"){let align="both"; if(node.classList.contains("center-v37")||node.style.textAlign==="center")align="center"; if(node.classList.contains("date-right-v37")||node.style.textAlign==="right")align="right"; return wParaV37(node.innerText,{align,bold:node.querySelector("b")&&textCleanV37(node.innerText).length<90});}
    if(tag==="ol"||tag==="ul")return [...node.children].map((li,i)=>wParaV37(`${i+1}. ${li.innerText}`,{align:"both"})).join("");
    return [...node.childNodes].map(htmlNodeToWmlV37).join("");
  }
  function docxDocumentXmlV37(html){const dom=new DOMParser().parseFromString(`<div>${html}</div>`,"text/html");const body=[...dom.body.firstChild.childNodes].map(htmlNodeToWmlV37).join("");return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;}
  function crc32V37(buf){if(!window.__crcTableV37){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=((c&1)?(0xEDB88320^(c>>>1)):(c>>>1));t[n]=c>>>0;}window.__crcTableV37=t;}let crc=0^(-1);for(let i=0;i<buf.length;i++)crc=(crc>>>8)^window.__crcTableV37[(crc^buf[i])&255];return (crc^(-1))>>>0;}
  const le16V37=n=>[n&255,(n>>>8)&255], le32V37=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
  function makeZipV37(files){const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;files.forEach(f=>{const name=enc.encode(f.name),dat=enc.encode(f.content),crc=crc32V37(dat),size=dat.length;const local=new Uint8Array([0x50,0x4b,0x03,0x04,...le16V37(20),...le16V37(0),...le16V37(0),...le16V37(0),...le16V37(0),...le32V37(crc),...le32V37(size),...le32V37(size),...le16V37(name.length),...le16V37(0),...name,...dat]);locals.push(local);const central=new Uint8Array([0x50,0x4b,0x01,0x02,...le16V37(20),...le16V37(20),...le16V37(0),...le16V37(0),...le16V37(0),...le16V37(0),...le32V37(crc),...le32V37(size),...le32V37(size),...le16V37(name.length),...le16V37(0),...le16V37(0),...le16V37(0),...le16V37(0),...le32V37(0),...le32V37(offset),...name]);centrals.push(central);offset+=local.length;});const centralSize=centrals.reduce((s,a)=>s+a.length,0),centralOffset=offset;const end=new Uint8Array([0x50,0x4b,0x05,0x06,...le16V37(0),...le16V37(0),...le16V37(files.length),...le16V37(files.length),...le32V37(centralSize),...le32V37(centralOffset),...le16V37(0)]);const total=offset+centralSize+end.length,out=new Uint8Array(total);let pos=0;[...locals,...centrals,end].forEach(a=>{out.set(a,pos);pos+=a.length;});return out;}
  function exportCurrentDocxV37(){
    const type=(typeof currentDoc !== "undefined" ? currentDoc : window.currentDoc) || "permohonan";
    previewDocV37(type);
    const html=$("docOutput")?.innerHTML || "";
    const documentXml=docxDocumentXmlV37(html);
    const files=[{name:"[Content_Types].xml",content:`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`},{name:"_rels/.rels",content:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`},{name:"word/document.xml",content:documentXml}];
    const zip=makeZipV37(files);const blob=new Blob([zip],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    if(typeof download === "function") download(blob,`dokumen_${type}_rt005_2026.docx`); else {const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`dokumen_${type}_rt005_2026.docx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}
  }
  window.exportCurrentDocxV37=exportCurrentDocxV37;
  window.exportCurrentDocxV36=exportCurrentDocxV37;

  function initV37(){
    installButtonsV37();
    const type=(typeof currentDoc !== "undefined" ? currentDoc : window.currentDoc) || "permohonan";
    try{ previewDocV37(type); }catch(e){ console.warn(PATCH_ID,e); }
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>setTimeout(initV37,120)); else setTimeout(initV37,120);
})();


/* PATCH v1.38 - Export PDF Langsung tanpa Dialog Cetak Browser */
(function bopPdfExportV38(){
  const PATCH_ID = "[BOP PDF v1.38]";

  function loadHtml2PdfV38(){
    return new Promise((resolve, reject) => {
      if(window.html2pdf){ resolve(window.html2pdf); return; }
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      s.onload = () => { if(window.html2pdf) resolve(window.html2pdf); else reject(new Error("html2pdf tidak tersedia")); };
      s.onerror = () => reject(new Error("Gagal memuat library PDF. Pastikan koneksi internet aktif."));
      document.head.appendChild(s);
    });
  }

  /* CSS cetak A4 bersama — dipakai oleh doExportPdf */
  const PDF_PRINT_CSS = `
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 20px; font-family: "Times New Roman", serif; font-size: 12pt; color: #000; background: #fff; }
    .official, .official-v36, .official-v37 { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.26; color: #000; }
    .official .title, .official-v36 .title, .official-v37 .title { text-align: center; font-weight: bold; text-transform: uppercase; margin: 10px 0 16px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #000; padding: 5px 8px; font-size: 11pt; }
    .no-border td, .no-border th { border: none; }
    .kop { display: grid; grid-template-columns: 70px 1fr 70px; gap: 12px; align-items: center; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 12px; }
    .kop table { border: none !important; } .kop table td { border: none !important; padding: 0 !important; }
    .kop-logo, .kop img { width: 64px !important; max-width: 64px !important; height: auto; }
    .kop-text { text-align: center; line-height: 1.3; }
    .kop h1 { font-size: 15px; text-transform: uppercase; margin: 0; text-align: center; }
    .kop h2 { font-size: 13px; text-transform: uppercase; margin: 2px 0; text-align: center; }
    .kop p { font-size: 11px; margin: 2px 0; text-align: center; }
    .title { text-align: center; font-weight: bold; text-transform: uppercase; margin: 12px 0 16px; }
    .ttd-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 70px; text-align: center; margin-top: 22px; }
    .ttd-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 20px; text-align: center; margin-top: 22px; }
    .ttd-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 35px; text-align: center; margin-top: 22px; }
    .signature-space, .sign-space-v36 { height: 62px; display: block; }
    .date-right-v36 { text-align: right; }
    .center-v36 { text-align: center; }
    .money-cell { text-align: right; white-space: nowrap; }
    .col-no { width: 38px; text-align: center; }
    .sign-note-v36 { font-size: 9pt; color: #555; display: block; }
    .sign-right-v36 td, .sign-right-v36 th,
    .letter-head-v36 td, .letter-head-v36 th,
    .identity-table-v36 td, .identity-table-v36 th,
    .sign-two-v36 td, .sign-two-v36 th { border: none; }
    .sign-two-v36 { width: 100%; }
    .sign-list-v36 th, .rap-table-v36 th { background: #f5f5f5; }
    .ds-page-break { page-break-after: always; border: none; margin: 0; }
    .ds-page-break::after { display: none; }
    p { margin: 8px 0; }
    ol { margin: 8px 0; padding-left: 24px; }
    li { margin-bottom: 6px; }
    b, strong { font-weight: bold; }
    .mengetahui-v36 { margin-top: 20px; }
    .ket-v36 { font-size: 10pt; color: #555; margin-top: 8px; }
  `;

  async function doExportPdf(el, filename){
    try {
      const inner = el ? el.innerHTML : "";
      if(!inner || !inner.trim()){
        if(typeof bopAlert === "function") bopAlert("Export PDF", "Konten dokumen kosong.", "warning");
        return;
      }
      if(typeof bopToast === "function") bopToast("Membuka Cetak PDF", "Gunakan dialog cetak browser → Simpan sebagai PDF.", "info");

      const printWin = window.open("", "_blank", "width=900,height=1100");
      if(!printWin){
        if(typeof bopAlert === "function") bopAlert("Popup Diblokir", "Izinkan popup untuk halaman ini di browser, lalu coba lagi.", "warning");
        return;
      }

      const title = filename.replace(/_/g," ").replace(".pdf","");
      printWin.document.write(`<!doctype html><html lang="id"><head>
<meta charset="UTF-8"><title>${title}</title>
<style>${PDF_PRINT_CSS}</style>
</head><body>${inner}</body></html>`);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 600);
    } catch(e){
      console.error(PATCH_ID, e);
      if(typeof bopAlert === "function") bopAlert("Gagal Export PDF", e.message || "Terjadi kesalahan.", "error");
    }
  }

  window.exportPdfDocV38 = async function(){
    if(typeof collectAll === "function") collectAll();
    const type = (typeof currentDoc !== "undefined" ? currentDoc : null) || "permohonan";
    if(typeof previewDoc === "function") previewDoc(type);
    await new Promise(r => setTimeout(r, 100));
    const el = document.getElementById("docOutput");
    if(!el || !el.innerHTML.trim()){
      if(typeof bopAlert === "function") bopAlert("Export PDF", "Pilih dokumen terlebih dahulu sebelum export PDF.", "warning");
      return;
    }
    await doExportPdf(el, "dokumen_" + type + "_rt005.pdf");
  };

  window.exportPdfLpjV38 = async function(){
    if(typeof collectAll === "function") collectAll();
    const el = document.getElementById("lpjOutput");
    if(el && typeof docLpj === "function") el.innerHTML = docLpj();
    await new Promise(r => setTimeout(r, 100));
    if(!el || !el.innerHTML.trim()){
      if(typeof bopAlert === "function") bopAlert("Export PDF", "Buka tab Preview Laporan terlebih dahulu.", "warning");
      return;
    }
    const periode = (typeof data !== "undefined" && data.lpj ? data.lpj.periode : "laporan").replace(/[\s\/]+/g, "_");
    await doExportPdf(el, "lpj_rt005_" + periode + ".pdf");
  };

  function installPdfBtnsV38(){
    // Tombol di LPJ
    const lpjBtn = document.getElementById("exportPdfLpjV38");
    if(lpjBtn) lpjBtn.onclick = window.exportPdfLpjV38;

  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(installPdfBtnsV38, 400));
  else setTimeout(installPdfBtnsV38, 400);
})();


/* ═══════════════════════════════════════════════════════════════
   BOP SYNC v2.0 — Satu sistem sync, bersih, Railway-ready
   - Semua endpoint: /api/bop/* (bukan /api/sync/*)
   - Graceful offline: badge abu-abu, tidak ada error mengganggu
   - Auto-push saat data berubah (debounce 2 detik)
   - Auto-pull saat boot + setiap 15 detik (silent)
   - Topbar: Online/Offline sesuai status server terakhir
═══════════════════════════════════════════════════════════════ */
(function bopSyncV2(){
  const TAG      = "[BOP-SYNC v2]";
  const STORE    = "bop_rt005_data_v1_25";
  const VER_KEY  = "bop_pg_version_v40";
  const TS_KEY   = "bop_pg_updated_v40";

  /* ─── Topbar status (Online / Offline / Memeriksa) ────────── */
  let _lastOnline = null;
  function setTopbarStatus(online){
    const dot  = document.getElementById("topbarDot");
    const txt  = document.getElementById("topbarStatusText");
    if(dot) dot.style.background = online ? "#16a34a" : online === null ? "#94a3b8" : "#dc2626";
    if(txt) txt.textContent      = online ? "Online Mode" : online === null ? "Memeriksa..." : "Offline Mode";
    if(_lastOnline !== null && _lastOnline !== online && typeof bopToast === "function"){
      if(online)  bopToast("☁ Terhubung ke Server", "Sinkronisasi data aktif.", "success");
      else        bopToast("⚠ Koneksi Terputus", "Mode offline — data tetap tersimpan lokal.", "warning");
    }
    _lastOnline = online;
  }

  /* ─── Badge sync kecil di pojok kanan atas ─────────────────── */
  function injectBadge(){
    if(document.getElementById("pgSyncBadge")) return;
    const b = document.createElement("div");
    b.id = "pgSyncBadge";
    b.title = "Klik untuk info status sinkronisasi";
    b.style.cssText = "position:fixed;top:10px;right:14px;z-index:9999;background:rgba(0,0,0,.55);color:#fff;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;cursor:pointer;user-select:none;transition:background .3s,opacity .3s;opacity:.85";
    b.textContent = "☁ …";
    b.onclick = showSyncInfo;
    document.body.appendChild(b);
  }

  function setBadge(txt, color){
    const b = document.getElementById("pgSyncBadge");
    if(!b) return;
    b.textContent = txt;
    b.style.background = color || "rgba(0,0,0,.55)";
  }

  function showSyncInfo(){
    const ver   = localStorage.getItem(VER_KEY) || "-";
    const ts    = localStorage.getItem(TS_KEY);
    const tsStr = ts ? new Date(ts).toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "-";
    const fn = typeof bopAlert === "function" ? bopAlert : (t,m) => alert(t+"\n"+m);
    fn("☁ Status Sinkronisasi BOP",
      "<b>Database:</b> PostgreSQL (Railway)<br>" +
      "<b>Versi data:</b> " + ver + "<br>" +
      "<b>Terakhir sync:</b> " + tsStr + "<br><br>" +
      "<small>Data disimpan otomatis setiap perubahan (delay 2 detik).<br>" +
      "Saat buka di perangkat lain, data terbaru akan dimuat otomatis.</small>",
    "info");
  }

  /* ─── Update sidebar note ───────────────────────────────────── */
  function updateSidebarNote(){
    const el = document.querySelector(".side-note");
    if(!el) return;
    const ts  = localStorage.getItem(TS_KEY);
    const ver = localStorage.getItem(VER_KEY);
    if(ts){
      el.innerHTML = "<b>☁ PostgreSQL</b><br><small>v" + (ver||"?") + " — " +
        new Date(ts).toLocaleString("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) + "</small>";
      el.style.color = "#15803d";
    } else {
      el.innerHTML = "<b>Offline</b><br>Data tersimpan di perangkat ini.";
      el.style.color = "";
    }
  }

  /* ─── Update panel sync di Setting ─────────────────────────── */
  function updateSyncPanel(){
    const badge  = document.getElementById("syncBadgeV39");
    const status = document.getElementById("syncStatusV39");
    const pushBtn = document.getElementById("syncPushV39");
    const pullBtn = document.getElementById("syncPullV39");

    if(badge)  { badge.textContent = "🐘 PostgreSQL"; badge.style.color = "#1d4ed8"; }

    if(status){
      const ts  = localStorage.getItem(TS_KEY);
      const ver = localStorage.getItem(VER_KEY);
      status.textContent = ts
        ? "☁ PostgreSQL • v" + (ver||"?") + " • " +
          new Date(ts).toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})
        : "☁ PostgreSQL (belum tersinkron)";
    }

    if(pushBtn) pushBtn.onclick = () => manualPush();
    if(pullBtn) pullBtn.onclick = () => manualPull();

    /* ── Setup Otomatis ──────────────────────────────────────── */
    const autoSetupBtn = document.getElementById("syncAutoSetupBtn");
    if(autoSetupBtn && !autoSetupBtn._bound){
      autoSetupBtn._bound = true;
      autoSetupBtn.onclick = async () => {
        const info = document.getElementById("syncServerInfo");

        function step(msg, color){ if(info){ info.style.display="block"; info.innerHTML=msg; info.style.color=color||"#475569"; } }

        autoSetupBtn.disabled = true;
        autoSetupBtn.textContent = "⏳ Memeriksa...";

        try{
          /* Langkah 1 — Ping koneksi DB mentah */
          step("⏳ <b>[1/4]</b> Mengecek koneksi ke server Railway...");
          let pingOk = false;
          try{
            const rp = await fetch("/api/bop/ping", {
              ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(10000) } : {}),
            });
            const dp = await rp.json();
            if(!dp.ok){
              step("❌ <b>Koneksi database gagal.</b><br>Host: <code>"+(dp.host||"?")+"</code><br>Error: <b>"+(dp.error||"Tidak diketahui")+"</b><br><small>Pastikan DATABASE_URL sudah benar di Railway dan service Postgres sudah terhubung ke service API di Railway dashboard.</small>", "#b91c1c");
              setTopbarStatus(false);
              autoSetupBtn.disabled = false;
              autoSetupBtn.textContent = "🚀 Setup Otomatis";
              return;
            }
            step("✅ <b>[1/4]</b> Koneksi DB OK — Host: <code>"+(dp.host||"?")+"</code> | "+( dp.pgVer||"PostgreSQL")+"<br>⏳ <b>[2/4]</b> Mengecek status tabel...");
            pingOk = true;
          } catch(pe){
            step("❌ <b>Tidak bisa reach server Railway:</b> "+pe.message+"<br><small>Pastikan URL Railway sudah benar di kolom di atas dan Railway sedang berjalan.</small>", "#b91c1c");
            setTopbarStatus(false);
            autoSetupBtn.disabled = false;
            autoSetupBtn.textContent = "🚀 Setup Otomatis";
            return;
          }

          /* Langkah 2 — Cek status tabel */
          await new Promise(r => setTimeout(r, 400));
          const r1 = await fetch("/api/bop/status", {
            ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(10000) } : {}),
          });
          const d1 = await r1.json();

          if(d1.ok){
            const ts = d1.updatedAt ? new Date(d1.updatedAt).toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "-";
            step("✅ <b>Server &amp; database sudah OK!</b><br>Koneksi: PostgreSQL (Railway)<br>Punya data: "+(d1.hasData?"Ya":"Tidak")+"<br>Versi: "+(d1.version||0)+"<br>Terakhir update: "+ts+"<br>Riwayat: "+(d1.historyCount||0)+" entri"+(d1.autoInited?" <i>(tabel baru dibuat otomatis)</i>":""), "#15803d");
            setTopbarStatus(true);
            autoSetupBtn.disabled = false;
            autoSetupBtn.textContent = "🚀 Setup Otomatis";
            return;
          }

          /* Langkah 3 — Tabel belum ada, init */
          step("⏳ <b>[3/4]</b> Koneksi OK, tabel belum ada. Membuat tabel database...");
          const r2 = await fetch("/api/bop/init-db", {
            method: "GET",
            ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(20000) } : {}),
          });
          const d2 = await r2.json();

          if(!d2.ok){
            step("❌ <b>Buat tabel gagal:</b> "+(d2.error||"Tidak diketahui")+"<br><small>Koneksi DB OK tapi tidak bisa buat tabel. Cek apakah user DB punya hak akses CREATE TABLE.</small>", "#b91c1c");
            setTopbarStatus(false);
            autoSetupBtn.disabled = false;
            autoSetupBtn.textContent = "🚀 Setup Otomatis";
            return;
          }

          /* Langkah 4 — Verifikasi akhir */
          step("⏳ <b>[4/4]</b> Tabel berhasil dibuat. Memverifikasi...");
          await new Promise(r => setTimeout(r, 600));
          const r3 = await fetch("/api/bop/status", {
            ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(8000) } : {}),
          });
          const d3 = await r3.json();

          if(d3.ok){
            step("✅ <b>Setup selesai! Server &amp; database siap digunakan.</b><br>Tabel berhasil dibuat dari awal.<br>Punya data: "+(d3.hasData?"Ya":"Tidak")+"<br>Sekarang kamu bisa klik <b>☁️ Simpan ke Server</b> untuk upload data.", "#15803d");
            setTopbarStatus(true);
          } else {
            step("⚠ <b>Tabel dibuat tapi verifikasi akhir gagal:</b> "+(d3.error||"")+"<br><small>Coba klik Setup Otomatis sekali lagi dalam beberapa detik.</small>", "#b45309");
            setTopbarStatus(false);
          }

        } catch(e){
          step("❌ <b>Tidak bisa reach server Railway:</b> "+e.message+"<br><small>Pastikan URL Railway sudah benar di kolom di atas dan Railway sedang berjalan.</small>", "#b91c1c");
          setTopbarStatus(false);
        }

        autoSetupBtn.disabled = false;
        autoSetupBtn.textContent = "🚀 Setup Otomatis";
      };
    }

  }

  /* ─── Push data ke server ───────────────────────────────────── */
  let pushTimer = null;
  let pushInFlight = false;

  function schedulePush(jsonStr){
    if(pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => doPush(jsonStr), 2000);
  }

  async function doPush(jsonStr){
    if(pushInFlight){ pushTimer = setTimeout(() => doPush(jsonStr), 1500); return; }
    pushInFlight = true;
    setBadge("☁ ↑", "#1e40af");
    try{
      const parsed   = JSON.parse(jsonStr);
      const localVer = parseInt(localStorage.getItem(VER_KEY) || "0", 10);
      const res = await fetch("/api/bop/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsed, clientVersion: localVer + 1 }),
        ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(8000) } : {}),
      });
      if(!res.ok) throw new Error("HTTP " + res.status);
      const result = await res.json();
      localStorage.setItem(VER_KEY, String(result.version));
      localStorage.setItem(TS_KEY,  result.updatedAt || new Date().toISOString());
      setBadge("☁ ✓", "#15803d");
      setTimeout(() => setBadge("☁", "rgba(0,0,0,.55)"), 3000);
      setTopbarStatus(true);
      updateSidebarNote();
      updateSyncPanel();
    } catch(e){
      console.warn(TAG, "Push gagal:", e.message);
      setBadge("☁", "rgba(0,0,0,.55)");
      /* Tidak set Offline — push bisa gagal sementara tanpa berarti server mati */
    } finally {
      pushInFlight = false;
      pushTimer    = null;
    }
  }

  /* ─── Manual push (dari tombol Setting) ────────────────────── */
  async function manualPush(){
    const raw = localStorage.getItem(STORE);
    if(!raw){ if(typeof bopAlert==="function") bopAlert("Tidak Ada Data","Tidak ada data lokal untuk disimpan.","warning"); return; }
    setBadge("☁ ↑", "#1e40af");
    await doPush(raw);
    if(typeof bopToast==="function") bopToast("Tersimpan","Data berhasil disimpan ke server.","success");
  }
  window.bopPgPushNowV40 = manualPush;
  window.bopSyncPushV39  = manualPush;

  /* ─── Manual pull (dari tombol Setting) ────────────────────── */
  async function manualPull(){
    setBadge("☁ ↓", "#1e40af");
    try{
      const res = await fetch("/api/bop/data", {
        ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(8000) } : {}),
      });
      if(!res.ok) throw new Error("HTTP " + res.status);
      const result = await res.json();
      if(!result.ok || !result.data){
        if(typeof bopAlert==="function") bopAlert("Tidak Ada Data","Belum ada data tersimpan di server.","info");
        setBadge("☁", "rgba(0,0,0,.55)");
        return;
      }
      const ok = typeof Swal !== "undefined"
        ? (await Swal.fire({title:"Ambil Data Server?",html:"Data lokal akan diganti data PostgreSQL.<br><b>Versi "+result.version+"</b>",icon:"question",showCancelButton:true,confirmButtonText:"Ya, Ambil",cancelButtonText:"Batal"})).isConfirmed
        : confirm("Ambil data dari server? Data lokal akan diganti.");
      if(!ok){ setBadge("☁","rgba(0,0,0,.55)"); return; }
      applyServerData(result);
      if(typeof bopToast==="function") bopToast("Data Dimuat","Data berhasil diambil dari server.","success");
    } catch(e){
      console.warn(TAG,"Pull gagal:",e.message);
      setBadge("☁ !","#b91c1c");
      setTimeout(()=>setBadge("☁","rgba(0,0,0,.55)"),4000);
      if(typeof bopAlert==="function") bopAlert("Gagal","Gagal mengambil data: "+e.message,"error");
    }
  }
  window.bopPgPullNowV40 = manualPull;
  window.bopSyncPullV39  = manualPull;

  /* ─── Terapkan data server ke memori + cache ────────────────── */
  function applyServerData(result){
    if(!result || !result.data) return;
    const serverData = result.data;
    if(typeof data !== "undefined" && serverData && typeof serverData === "object"){
      try{ Object.assign(data, JSON.parse(JSON.stringify(serverData))); }catch(e){}
    }
    _origSetItem(STORE, JSON.stringify(serverData));
    localStorage.setItem(VER_KEY, String(result.version  || 0));
    localStorage.setItem(TS_KEY,  result.updatedAt || new Date().toISOString());
    if(typeof render        ==="function"){ try{ render();           }catch(e){} }
    if(typeof updateDashboard==="function"){ try{ updateDashboard(); }catch(e){} }
    setBadge("☁ ✓","#15803d");
    setTimeout(()=>setBadge("☁","rgba(0,0,0,.55)"),3000);
    setTopbarStatus(true);
    updateSidebarNote();
    updateSyncPanel();
  }
  window.bopApplyServerDataV42 = applyServerData;

  /* ─── Intercept localStorage.setItem ───────────────────────── */
  const _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value){
    _origSetItem(key, value);
    if(key === STORE && typeof value === "string") schedulePush(value);
  };

  /* ─── Boot: load data dari server jika lebih baru ───────────── */
  async function bootLoad(){
    setBadge("☁ …","rgba(0,0,0,.55)");
    try{
      const localVer = parseInt(localStorage.getItem(VER_KEY) || "0", 10);
      const headers  = localVer > 0 ? { "If-None-Match": String(localVer) } : {};
      const res = await fetch("/api/bop/data", {
        headers,
        ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(7000) } : {}),
      });

      if(res.status === 304){
        /* Versi sama — tidak perlu update, tapi server online */
        setTopbarStatus(true);
        setBadge("☁ ✓","#15803d");
        setTimeout(()=>setBadge("☁","rgba(0,0,0,.55)"),2000);
        return;
      }

      if(!res.ok){
        /* Server error — graceful: tetap pakai localStorage */
        console.warn(TAG,"bootLoad HTTP",res.status);
        setTopbarStatus(false);
        setBadge("☁","rgba(0,0,0,.55)");
        return;
      }

      const result = await res.json();
      setTopbarStatus(true);

      if(!result.ok || !result.data){
        /* Server kosong — upload data lokal (inisialisasi awal) */
        const localRaw = localStorage.getItem(STORE);
        if(localRaw){
          console.log(TAG,"Server kosong, upload data lokal...");
          schedulePush(localRaw);
        }
        setBadge("☁","rgba(0,0,0,.55)");
        return;
      }

      const serverVer = result.version || 0;
      if(serverVer > localVer){
        /* Server lebih baru — muat */
        applyServerData(result);
        if(typeof bopToast==="function"){
          bopToast("Data Dimuat dari Server",
            "Versi " + serverVer + " — " +
            new Date(result.updatedAt).toLocaleString("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}),
          "info");
        }
      } else {
        /* Lokal sama atau lebih baru */
        setBadge("☁ ✓","#15803d");
        setTimeout(()=>setBadge("☁","rgba(0,0,0,.55)"),2000);
        updateSidebarNote();
      }
    } catch(e){
      /* Tidak bisa reach server — graceful offline */
      console.warn(TAG,"bootLoad gagal (offline?):",e.message);
      setTopbarStatus(false);
      setBadge("☁","rgba(0,0,0,.55)");
    }
  }

  /* ─── Silent poll setiap 15 detik ──────────────────────────── */
  async function silentPoll(){
    if(pushInFlight || pushTimer) return;
    try{
      const localVer = parseInt(localStorage.getItem(VER_KEY) || "0", 10);
      const headers  = localVer > 0 ? { "If-None-Match": String(localVer) } : {};
      const res = await fetch("/api/bop/data", {
        headers,
        ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(5000) } : {}),
      });
      if(res.status === 304){ setTopbarStatus(true); return; }
      if(!res.ok){ setTopbarStatus(false); return; }
      setTopbarStatus(true);
      const result = await res.json();
      if(!result.ok || !result.data) return;
      const serverVer = result.version || 0;
      const localVer2 = parseInt(localStorage.getItem(VER_KEY) || "0", 10);
      if(serverVer > localVer2){
        applyServerData(result);
        if(typeof bopToast==="function") bopToast("☁ Data Diperbarui","Data terbaru (v"+serverVer+") dimuat dari server.","info");
      }
    } catch(e){
      setTopbarStatus(false);
    }
  }

  /* ─── Flush saat tab ditutup (sendBeacon) ───────────────────── */
  window.addEventListener("beforeunload", () => {
    if(!pushTimer && !pushInFlight) return;
    if(pushTimer){ clearTimeout(pushTimer); pushTimer = null; }
    const raw = localStorage.getItem(STORE);
    if(!raw) return;
    try{
      const parsed   = JSON.parse(raw);
      const localVer = parseInt(localStorage.getItem(VER_KEY) || "0", 10);
      const payload  = JSON.stringify({ data: parsed, clientVersion: localVer + 1 });
      const blob     = new Blob([payload], { type: "application/json" });
      if(navigator.sendBeacon) navigator.sendBeacon("/api/bop/data-beacon", blob);
    } catch(e){}
  });

  /* ─── storage event (multi-tab) ────────────────────────────── */
  window.addEventListener("storage", e => {
    if(e.key === TS_KEY) updateSidebarNote();
  });

  /* ─── Expose retrigger agar auto-discovery bisa panggil bootLoad ── */
  window.__bopRetriggerSync = function(){
    bootLoad();
  };

  /* ─── Init ──────────────────────────────────────────────────── */
  function init(){
    injectBadge();
    updateSyncPanel();
    updateSidebarNote();
    bootLoad();
    setInterval(silentPoll, 8000);
  }

  if(document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 500));
  else
    setTimeout(init, 500);
})();

/* PATCH v1.41 — Live Preview Side-by-Side di Tab Data Pengajuan */
(function bopLivePreviewV41(){
  const FORM_IDS = [
    'nomorSurat','tanggalSurat','sifatSurat','lampiranSurat',
    'namaRekening','nomorRekening','namaLurah','namaKetuaRw'
  ];
  let _debounce = null;
  let _ready = false;

  function refreshPreview(immediate){
    const sel     = document.getElementById('pqPreviewDocType');
    const content = document.getElementById('pqPreviewContent');
    if(!sel || !content) return;

    const type = sel.value || 'permohonan';
    content.innerHTML = '<div class="pq-loading">Membuat pratinjau…</div>';

    const run = () => {
      try {
        if(typeof collectAll === 'function') collectAll();
        if(typeof previewDoc === 'function'){
          previewDoc(type);
          const docOut = document.getElementById('docOutput');
          content.innerHTML = docOut && docOut.innerHTML.trim()
            ? docOut.innerHTML
            : '<div class="pq-placeholder">Tidak ada konten untuk dokumen ini.</div>';
        } else {
          content.innerHTML = '<div class="pq-placeholder">Fungsi pratinjau belum siap.</div>';
        }
      } catch(e){
        content.innerHTML = '<div class="pq-placeholder">Gagal render pratinjau.</div>';
      }
    };

    if(immediate){ run(); }
    else {
      clearTimeout(_debounce);
      _debounce = setTimeout(run, 420);
    }
  }

  function init(){
    if(_ready) return;
    const sel = document.getElementById('pqPreviewDocType');
    if(!sel){ setTimeout(init, 500); return; }
    _ready = true;

    /* Ganti tipe dokumen */
    sel.addEventListener('change', () => refreshPreview(true));

    /* Refresh button */
    const refreshBtn = document.getElementById('pqRefreshBtn');
    if(refreshBtn) refreshBtn.addEventListener('click', () => refreshPreview(true));

    /* Input changes → debounce refresh */
    FORM_IDS.forEach(id => {
      const el = document.getElementById(id);
      if(el){
        el.addEventListener('input', () => refreshPreview(false));
        el.addEventListener('change', () => refreshPreview(false));
      }
    });

    /* Refresh saat klik tab Data Pengajuan */
    document.querySelectorAll('[data-tab="data-pengajuan"]').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(() => refreshPreview(true), 200));
    });

    /* Initial render setelah data dimuat */
    setTimeout(() => refreshPreview(true), 1500);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 900));
  } else {
    setTimeout(init, 900);
  }
})();

/* PATCH 010 - Print fix KOP + Daftar Hadir F4/Folio */
function printCssV22(){
  return `
  @page{size:215mm 330mm;margin:9mm 10mm}
  html,body{margin:0!important;padding:0!important;background:#fff!important;color:#000!important}
  body{font-family:"Times New Roman",serif!important}
  .print-page{width:195mm;max-width:195mm;box-sizing:border-box;margin:0 auto;background:#fff}

  .official{
    font-family:"Times New Roman",serif!important;
    color:#000!important;
    font-size:10.6pt!important;
    line-height:1.13!important;
    width:100%!important;
    box-sizing:border-box!important;
  }

  .official .kop,.kop{
    display:flex!important;
    align-items:center!important;
    width:100%!important;
    box-sizing:border-box!important;
    border-bottom:3px double #000!important;
    padding:4px 0 8px 0!important;
    margin:0 0 10px 0!important;
    position:static!important;
    break-after:avoid!important;
    page-break-after:avoid!important;
  }

  .kop-logo-wrap{
    width:54px!important;
    min-width:54px!important;
    flex-shrink:0!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
  }

  .official .kop-logo,.kop-logo{
    width:50px!important;
    max-width:50px!important;
    height:auto!important;
    max-height:62px!important;
    object-fit:contain!important;
    display:block!important;
    position:static!important;
    transform:none!important;
  }

  .kop-logo-spacer{
    width:54px!important;
    min-width:54px!important;
    flex-shrink:0!important;
  }

  .official .kop-text,.kop-text{
    flex:1!important;
    text-align:center!important;
    padding:0 4px!important;
    width:auto!important;
  }

  .kop-b1{
    font-family:"Times New Roman",serif!important;
    font-size:15pt!important;
    font-weight:bold!important;
    text-transform:uppercase!important;
    text-align:center!important;
    white-space:nowrap!important;
    line-height:1.1!important;
    margin:0!important;
    padding:0!important;
  }

  .kop-b2{
    font-family:"Times New Roman",serif!important;
    font-size:12.5pt!important;
    font-weight:bold!important;
    text-transform:uppercase!important;
    text-align:center!important;
    white-space:nowrap!important;
    line-height:1.1!important;
    margin:1px 0!important;
    padding:0!important;
  }

  .kop-addr{
    font-family:"Times New Roman",serif!important;
    font-size:8.8pt!important;
    font-weight:normal!important;
    text-align:center!important;
    margin-top:3px!important;
    line-height:1.2!important;
    white-space:normal!important;
  }

  .official .title{
    text-align:center!important;
    font-weight:bold!important;
    text-transform:uppercase!important;
    margin:6px 0 6px!important;
    font-size:11.8pt!important;
    line-height:1.1!important;
    break-after:avoid!important;
    page-break-after:avoid!important;
  }

  .official table{
    width:100%!important;
    border-collapse:collapse!important;
  }

  .official table:not(.no-border){
    table-layout:fixed!important;
    page-break-inside:auto!important;
  }

  .official thead{display:table-header-group!important}
  .official tr{page-break-inside:avoid!important;break-inside:avoid!important}

  .official th,.official td{
    border:1px solid #000!important;
    padding:3px 4px!important;
    vertical-align:top!important;
    font-size:9.6pt!important;
    line-height:1.08!important;
    overflow-wrap:anywhere!important;
    word-break:normal!important;
  }

  .official th{
    text-align:center!important;
    font-weight:bold!important;
  }

  .official table.no-border,
  .official table.no-border *{
    border:0!important;
    table-layout:auto!important;
  }

  .official table.no-border td,
  .official table.no-border th{
    padding:1px 2px!important;
    font-size:9.7pt!important;
    line-height:1.05!important;
    overflow-wrap:normal!important;
  }

  .official .title + table.no-border{
    margin-bottom:2px!important;
  }

  .official .title + table.no-border + br{
    display:none!important;
  }

  .official .title + table.no-border + br + table th,
  .official .title + table.no-border + br + table td{
    font-size:8.8pt!important;
    line-height:1.02!important;
    padding:1.5px 3px!important;
    height:4.4mm!important;
  }

  .official .title + table.no-border + br + table th:first-child,
  .official .title + table.no-border + br + table td:first-child{
    width:9mm!important;
    max-width:9mm!important;
    text-align:center!important;
  }

  .official .title + table.no-border + br + table th:last-child,
  .official .title + table.no-border + br + table td:last-child{
    width:32mm!important;
    max-width:32mm!important;
  }

  .official p{margin:5px 0!important}

  .ttd-grid,.ttd-4,.ttd-3{
    display:grid!important;
    gap:14px!important;
    text-align:center!important;
    margin-top:12px!important;
    page-break-inside:avoid!important;
    break-inside:avoid!important;
  }

  .ttd-grid{grid-template-columns:1fr 1fr!important}
  .ttd-4{grid-template-columns:repeat(4,1fr)!important}
  .ttd-3{grid-template-columns:repeat(3,1fr)!important}
  .signature-space{height:48px!important}

  @media print{
    html,body{width:215mm!important;min-height:330mm!important}
    .print-page{width:195mm!important;margin:0 auto!important}
  }`;
}


/* PATCH 011 - KOP Surat Flex Layout (v2) */
(function kopFlexPatch011(){
  const css = `
  .kop{
    display:flex!important;
    align-items:center!important;
    border-bottom:3px double #000!important;
    padding:4px 0 8px 0!important;
    margin-bottom:14px!important;
    width:100%!important;
    box-sizing:border-box!important;
    position:static!important;
    min-height:0!important;
  }
  .kop-logo-wrap{
    width:60px!important;
    min-width:60px!important;
    flex-shrink:0!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
  }
  .kop-logo{
    width:54px!important;
    max-width:54px!important;
    height:auto!important;
    max-height:66px!important;
    object-fit:contain!important;
    display:block!important;
    position:static!important;
    transform:none!important;
  }
  .kop-logo-spacer{
    width:60px!important;
    min-width:60px!important;
    flex-shrink:0!important;
  }
  .kop-text{
    flex:1!important;
    text-align:center!important;
    padding:0 4px!important;
    width:auto!important;
  }
  .kop-b1{
    font-family:"Times New Roman",serif!important;
    font-size:17px!important;
    font-weight:bold!important;
    text-transform:uppercase!important;
    text-align:center!important;
    white-space:nowrap!important;
    line-height:1.1!important;
    margin:0!important;
    padding:0!important;
  }
  .kop-b2{
    font-family:"Times New Roman",serif!important;
    font-size:15px!important;
    font-weight:bold!important;
    text-transform:uppercase!important;
    text-align:center!important;
    white-space:nowrap!important;
    line-height:1.1!important;
    margin:1px 0!important;
    padding:0!important;
  }
  .kop-addr{
    font-family:"Times New Roman",serif!important;
    font-size:12px!important;
    font-weight:normal!important;
    text-align:center!important;
    margin-top:3px!important;
    line-height:1.2!important;
    white-space:normal!important;
  }`;
  const style=document.createElement("style");
  style.id="kop-center-patch-011";
  style.textContent=css;
  document.head.appendChild(style);
})();


/* PATCH 012B - Expose data object for cloud sync */
(function bopExposeDataV42(){
  function expose(){
    try {
      if (typeof data !== "undefined") {
        window.data = data;
      }
      if (typeof STORE !== "undefined") {
        window.BOP_STORE_KEY = STORE;
      }
    } catch(e) {}
  }

  expose();

  window.BOP_APPLY_SERVER_DATA_V42 = function(serverData){
    try {
      if (!serverData || typeof serverData !== "object") return false;

      const fixed = (typeof migrateOld === "function") ? migrateOld(serverData) : serverData;

      if (typeof data !== "undefined") {
        Object.keys(data).forEach(k => delete data[k]);
        Object.assign(data, fixed);
        window.data = data;
      } else {
        window.data = fixed;
      }

      try {
        const key = (typeof STORE !== "undefined") ? STORE : "bop_rt005_data_v1_25";
        localStorage.setItem(key, JSON.stringify(fixed));
      } catch(e) {}

      if (typeof render === "function") {
        try { render(); } catch(e) {}
      }

      if (typeof updateDashboard === "function") {
        try { updateDashboard(); } catch(e) {}
      }

      return true;
    } catch(e) {
      console.warn("[BOP APPLY SERVER DATA V42]", e);
      return false;
    }
  };

  setTimeout(expose, 100);
  setTimeout(expose, 800);
})();


/* PATCH v1.43 — Biometrik Login (WebAuthn Platform Authenticator) */
(function bopBiometricV43(){
  const CRED_KEY  = "bop_biometric_cred_v43";
  const LAST_PAGE = "bop_last_page_v43";

  function isSupported(){
    return !!(window.PublicKeyCredential &&
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function");
  }

  function toB64(arr){
    return btoa(String.fromCharCode(...new Uint8Array(arr)));
  }

  function fromB64(s){
    const bin = atob(s);
    const arr = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    return arr.buffer;
  }

  function setHint(msg, color){
    const el = document.getElementById("biometricHintV43");
    if(el){ el.textContent = msg; el.style.color = color||"#64748b"; }
  }

  function setLabel(txt){
    const el = document.getElementById("biometricBtnLabel");
    if(el) el.textContent = txt;
  }

  async function registerBiometric(){
    setLabel("Mendaftarkan...");
    setHint("Ikuti petunjuk autentikator perangkat Anda...", "#1d4ed8");
    try{
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);

      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "BOP RT 005", id: window.location.hostname },
          user: { id: userId, name: "Pengurus RT 005", displayName: "BOP RT 005" },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 }
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred"
          },
          timeout: 60000,
          attestation: "none"
        }
      });

      if(!cred) throw new Error("Tidak ada kredensial");

      localStorage.setItem(CRED_KEY, JSON.stringify({
        id: cred.id,
        rawId: toB64(cred.rawId),
        type: cred.type
      }));

      setLabel("Masuk dengan Biometrik");
      setHint("✅ Biometrik berhasil didaftarkan! Klik lagi untuk masuk.", "#15803d");
    } catch(e){
      setLabel("Masuk dengan Biometrik");
      if(e.name === "NotAllowedError"){
        setHint("Dibatalkan. Coba lagi untuk mendaftar biometrik.", "#b45309");
      } else if(e.name === "NotSupportedError"){
        setHint("Perangkat tidak mendukung biometrik platform.", "#b91c1c");
      } else {
        setHint("Gagal: " + e.message, "#b91c1c");
      }
    }
  }

  async function authBiometric(){
    const stored = localStorage.getItem(CRED_KEY);
    if(!stored){ await registerBiometric(); return; }

    setLabel("Verifikasi...");
    setHint("Konfirmasi identitas Anda...", "#1d4ed8");
    try{
      const credData = JSON.parse(stored);
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [{ type: "public-key", id: fromB64(credData.rawId) }],
          userVerification: "required",
          timeout: 60000
        }
      });

      if(!assertion) throw new Error("Autentikasi gagal");

      setLabel("Masuk dengan Biometrik");
      setHint("✅ Berhasil!", "#15803d");

      const lastPage = localStorage.getItem(LAST_PAGE) || "dashboard";
      if(typeof goPage === "function"){
        setTimeout(() => {
          goPage(lastPage);
          if(typeof bopToast === "function") bopToast("Selamat Datang","Masuk via biometrik berhasil.","success");
        }, 300);
      }
    } catch(e){
      setLabel("Masuk dengan Biometrik");
      if(e.name === "NotAllowedError"){
        setHint("Dibatalkan. Coba lagi.", "#b45309");
      } else if(e.name === "InvalidStateError"){
        localStorage.removeItem(CRED_KEY);
        setHint("Kredensial tidak valid, dihapus. Klik lagi untuk daftar ulang.", "#b45309");
      } else {
        setHint("Gagal: " + e.message, "#b91c1c");
      }
    }
  }

  function recordLastPage(){
    document.querySelectorAll(".nav button[data-page]").forEach(btn => {
      btn.addEventListener("click", () => {
        const pg = btn.dataset.page;
        if(pg && pg !== "akses") localStorage.setItem(LAST_PAGE, pg);
      });
    });
    document.querySelectorAll("[data-go]").forEach(el => {
      el.addEventListener("click", () => {
        const pg = el.dataset.go;
        if(pg && pg !== "akses") localStorage.setItem(LAST_PAGE, pg);
      });
    });
  }

  async function init(){
    const row = document.getElementById("biometricRowV43");
    const btn = document.getElementById("biometricBtnV43");
    if(!row || !btn) return;

    const supported = await (isSupported()
      ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(()=>false)
      : Promise.resolve(false));

    if(!supported){
      row.style.display = "none";
      return;
    }

    const hasCred = !!localStorage.getItem(CRED_KEY);
    setLabel(hasCred ? "Masuk dengan Biometrik" : "Daftarkan Biometrik");
    setHint(hasCred ? "Sidik jari / wajah terdaftar" : "Tap untuk mendaftarkan biometrik perangkat ini", "#64748b");

    btn.addEventListener("click", () => {
      const c = localStorage.getItem(CRED_KEY);
      if(c) authBiometric(); else registerBiometric();
    });

    recordLastPage();
  }

  if(document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 800));
  else
    setTimeout(init, 800);
})();


/* PATCH v1.43B — Dropdown Generate Dokumen di Document Studio */
(function bopDocDropdownV43(){
  function init(){
    const sel = document.getElementById("dsDocSelectV43");
    const btn = document.getElementById("dsDocGenBtnV43");
    if(!sel || !btn) return;

    btn.addEventListener("click", () => {
      const type = sel.value;
      if(!type) return;
      if(typeof previewDoc === "function"){
        previewDoc(type);
      } else {
        const hiddenBtn = document.querySelector(`.doc-btn[data-doc="${type}"]`);
        if(hiddenBtn) hiddenBtn.click();
      }
    });

    sel.addEventListener("change", () => {
      if(typeof previewDoc === "function") previewDoc(sel.value);
    });
  }

  if(document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 1200));
  else
    setTimeout(init, 1200);
})();


/* PATCH v1.43C — Fix Multi-device Sync: Force Push setelah Restore JSON */
(function bopRestoreSyncFixV43(){
  function init(){
    const input = document.getElementById("restoreData");
    if(!input) return;
    const origOnchange = input.onchange;
    input.onchange = function(e){
      if(origOnchange) origOnchange.call(this, e);
      if(!e.target.files[0]) return;
      setTimeout(() => {
        try{
          const STORE_KEY = (typeof STORE !== "undefined") ? STORE : "bop_rt005_data_v1_25";
          const VER_KEY_  = "bop_pg_version_v40";
          const raw = localStorage.getItem(STORE_KEY);
          if(!raw) return;
          localStorage.removeItem(VER_KEY_);
          fetch("/api/bop/data", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: JSON.parse(raw), clientVersion: Date.now() }),
            ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(10000) } : {})
          }).then(r => r.json()).then(res => {
            if(res.ok){
              localStorage.setItem(VER_KEY_, String(res.version));
              localStorage.setItem("bop_pg_ts_v40", res.updatedAt || new Date().toISOString());
              if(typeof bopToast === "function")
                bopToast("Restore + Sync OK","Data lokal berhasil dipulihkan dan disimpan ke server.","success");
            }
          }).catch(()=>{});
        } catch(err){ console.warn("[BOP RestoreSyncFix]", err); }
      }, 2500);
    };
  }

  if(document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 1000));
  else
    setTimeout(init, 1000);
})();


/* PATCH v1.43D — Auto-populate Dokumen: refresh data master sebelum generate */
(function bopAutoFillDocV43(){
  const _origPreviewDoc = window.previewDoc;
  function wrappedPreview(type){
    try{ if(typeof collectAll === "function") collectAll(); } catch(e){}
    if(typeof _origPreviewDoc === "function") return _origPreviewDoc(type);
    if(typeof previewDoc === "function") return previewDoc(type);
  }
  window.previewDoc = wrappedPreview;
})();


/* PATCH v1.44 — Card Hub Landing untuk Pengajuan / LPJ / Persiapan */
(function bopCardHubV44(){
  if(window.__bopCardHubV44) return;
  window.__bopCardHubV44 = true;

  const HUB_DEFS = {
    'pengajuan': [
      { tab:'data-pengajuan', icon:'📋', color:'#3b82f6', label:'Data Pengajuan',        desc:'Surat permohonan, rekening, nama Lurah dan Ketua RW' },
      { tab:'rap',            icon:'📊', color:'#10b981', label:'RAP 1 Tahun',            desc:'Rencana Anggaran Penggunaan BOP RT selama satu tahun' },
      { tab:'rap-bulanan',    icon:'📅', color:'#8b5cf6', label:'RAP Bulanan Otomatis',   desc:'Breakdown anggaran per bulan otomatis dari RAP Tahunan' },
      { tab:'rapat',          icon:'📝', color:'#f59e0b', label:'BA & Daftar Hadir RAP',  desc:'Berita acara dan daftar hadir rapat pengajuan dana BOP' },
      { tab:'undangan-notulen',icon:'📨',color:'#ef4444', label:'Undangan & Notulen RAP', desc:'Undangan dan notulen rapat khusus pengajuan dana BOP' },
      { tab:'dokumen',        icon:'🗂', color:'#d5a83f', label:'Generate 7 Dokumen',     desc:'Cetak semua dokumen syarat pengajuan dana operasional' },
      { tab:'riwayat-pengajuan',icon:'🕐',color:'#64748b',label:'Riwayat',               desc:'Arsip semua pengajuan dan surat yang pernah dibuat' },
    ],
    'lpj': [
      { tab:'lpj-data',        icon:'📋', color:'#3b82f6', label:'Data Laporan',     desc:'Identitas laporan, periode, saldo awal dan petugas' },
      { tab:'lpj-pengeluaran', icon:'💰', color:'#ef4444', label:'Pengeluaran',       desc:'Rincian setiap item pengeluaran dana operasional' },
      { tab:'lpj-preview',     icon:'👁', color:'#10b981', label:'Preview & Cetak',  desc:'Pratinjau laporan pertanggungjawaban dan export PDF' },
      { tab:'lpj-riwayat',     icon:'🕐', color:'#64748b', label:'Riwayat LPJ',      desc:'Arsip laporan pertanggungjawaban yang sudah tersimpan' },
    ],
    'persiapan': [
      { tab:'pk-data',         icon:'📅', color:'#3b82f6', label:'Data Kegiatan',           desc:'Jenis, nama, tanggal, waktu, tempat dan agenda kegiatan' },
      { tab:'pk-daftar-hadir', icon:'👥', color:'#10b981', label:'Daftar Hadir',             desc:'Data peserta yang hadir dalam kegiatan operasional' },
      { tab:'pk-notulen',      icon:'📝', color:'#8b5cf6', label:'Notulen',                  desc:'Pimpinan rapat, notulis, pembahasan dan keputusan' },
      { tab:'pk-kuitansi',     icon:'🧾', color:'#f59e0b', label:'Tanda Terima / Kuitansi', desc:'Nominal, penerima, keperluan pembayaran dan pajak' },
      { tab:'pk-generate',     icon:'⚙', color:'#d5a83f', label:'Generate Bukti SPJ',       desc:'Cetak semua dokumen bukti kelengkapan SPJ kegiatan' },
      { tab:'pk-riwayat',      icon:'🕐', color:'#64748b', label:'Riwayat',                  desc:'Arsip kegiatan operasional yang sudah tersimpan' },
    ],
  };

  function buildHub(pageKey, cards){
    const wrap = document.createElement('div');
    wrap.className = 'bop-hub-wrap';
    wrap.id = 'bop-hub-' + pageKey;
    wrap.innerHTML = '<div class="bop-hub-grid">' + cards.map((c,i) => `
      <button class="bop-hub-card" data-page="${pageKey}" data-tab="${c.tab}" type="button">
        <div class="bop-hub-card-top">
          <span class="bop-hub-icon" style="background:${c.color}22;color:${c.color}">${c.icon}</span>
          <span class="bop-hub-step">${String(i+1).padStart(2,'0')}</span>
        </div>
        <h3 class="bop-hub-title">${c.label}</h3>
        <p class="bop-hub-desc">${c.desc}</p>
        <span class="bop-hub-arrow">→</span>
      </button>`).join('') + '</div>';
    return wrap;
  }

  function showHub(pageKey){
    const page = document.getElementById('page-' + pageKey);
    if(!page) return;
    const hub  = document.getElementById('bop-hub-' + pageKey);
    const nav  = page.querySelector('.subnav');
    page.querySelectorAll('.module-guide-v20').forEach(g => g.style.display = 'none');
    page.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    if(nav)  nav.style.display  = 'none';
    if(hub)  hub.style.display  = '';
  }

  function openTab(pageKey, tabId){
    const page = document.getElementById('page-' + pageKey);
    if(!page) return;
    const hub  = document.getElementById('bop-hub-' + pageKey);
    const nav  = page.querySelector('.subnav');
    page.querySelectorAll('.module-guide-v20').forEach(g => g.style.display = '');
    page.querySelectorAll('.tab-content').forEach(c => c.style.display = '');
    if(hub) hub.style.display = 'none';
    if(nav) nav.style.display = '';
    if(typeof activateTab === 'function') activateTab(tabId);
  }

  function init(){
    Object.keys(HUB_DEFS).forEach(pageKey => {
      const page = document.getElementById('page-' + pageKey);
      if(!page) return;
      const nav = page.querySelector('.subnav');
      if(!nav) return;

      /* Sisipkan hub sebelum subnav */
      const hub = buildHub(pageKey, HUB_DEFS[pageKey]);
      nav.parentNode.insertBefore(hub, nav);

      /* Tambah tombol kembali di subnav */
      const back = document.createElement('button');
      back.className = 'bop-hub-back subtab';
      back.type = 'button';
      back.textContent = '‹ Menu';
      back.onclick = () => showHub(pageKey);
      nav.insertBefore(back, nav.firstChild);

      /* Tampilkan hub saat pertama kali */
      showHub(pageKey);
    });

    /* Klik card */
    document.addEventListener('click', e => {
      const card = e.target.closest('.bop-hub-card');
      if(!card) return;
      openTab(card.dataset.page, card.dataset.tab);
    });

    /* Patch goPage agar kembali ke hub saat navigasi sidebar */
    const _origGoPage = window.goPage;
    window.goPage = async function(page){
      const r = _origGoPage ? await _origGoPage(page) : undefined;
      if(HUB_DEFS[page]) setTimeout(() => showHub(page), 60);
      return r;
    };

    /* Patch activateTab agar bisa dipanggil dari riwayat/deep-link */
    const _origActivate = window.activateTab;
    window.activateTab = function(id){
      const el = document.getElementById('tab-' + id);
      if(el){
        const page = el.closest('.page');
        if(page){
          const key = page.id.replace('page-','');
          if(HUB_DEFS[key]){
            const hub = document.getElementById('bop-hub-' + key);
            const nav = page.querySelector('.subnav');
            page.querySelectorAll('.module-guide-v20').forEach(g => g.style.display = '');
            page.querySelectorAll('.tab-content').forEach(c => c.style.display = '');
            if(hub) hub.style.display = 'none';
            if(nav) nav.style.display = '';
          }
        }
      }
      if(_origActivate) _origActivate(id);
    };

    /* Hook sidebar nav buttons */
    document.querySelectorAll('.nav button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pg = btn.dataset.page;
        if(HUB_DEFS[pg]) setTimeout(() => showHub(pg), 70);
      });
    });
  }

  /* Tunggu setelah semua patch lain selesai */
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 700));
  } else {
    setTimeout(init, 700);
  }
})();

/* ── PATCH v1.45 — CSS-class hub control + biometric direct BOP ── */
(function bopFixV45(){
  if(window.__bopFixV45) return;
  window.__bopFixV45 = true;

  const HUB_KEYS = ['pengajuan','lpj','persiapan'];

  /* CSS-class based hub toggle — removes inline styles so CSS !important takes over */
  function hubShow(pageKey){
    const page = document.getElementById('page-'+pageKey);
    if(!page) return;
    page.classList.add('has-hub');
    page.classList.remove('hub-active');
    const hub = document.getElementById('bop-hub-'+pageKey);
    const nav = page.querySelector('.subnav');
    page.querySelectorAll('.tab-content').forEach(c=>c.style.display='');
    page.querySelectorAll('.module-guide-v20').forEach(g=>g.style.display='');
    if(hub) hub.style.display='';
    if(nav) nav.style.display='';
  }

  function hubOpenTab(pageKey, tabId){
    const page = document.getElementById('page-'+pageKey);
    if(!page) return;
    page.classList.add('has-hub','hub-active');
    const hub = document.getElementById('bop-hub-'+pageKey);
    const nav = page.querySelector('.subnav');
    page.querySelectorAll('.tab-content').forEach(c=>c.style.display='');
    page.querySelectorAll('.module-guide-v20').forEach(g=>g.style.display='');
    if(hub) hub.style.display='';
    if(nav) nav.style.display='';
    if(typeof activateTab === 'function') activateTab(tabId);
  }

  window.bopHubShow    = hubShow;
  window.bopHubOpenTab = hubOpenTab;

  /* Override hub-card click to use class-based version (fires after old listener) */
  document.addEventListener('click', e => {
    const card = e.target.closest('.bop-hub-card');
    if(!card) return;
    hubOpenTab(card.dataset.page, card.dataset.tab);
  });

  /* Override back button to use class-based hub show */
  document.addEventListener('click', e => {
    const btn = e.target.closest('.bop-hub-back');
    if(!btn) return;
    const page = btn.closest('.page');
    if(!page) return;
    hubShow(page.id.replace('page-',''));
  });

  /* Wrap goPage — auto BOP access mode for biometric, then CSS hub show */
  const _gp45 = window.goPage;
  window.goPage = async function(page){
    if(page && page !== 'akses' && window.__bopBioAuth){
      window.__bopBioAuth = false;
      if(typeof setAccessModeV31 === 'function') setAccessModeV31('bop');
    }
    const r = _gp45 ? await _gp45(page) : undefined;
    if(HUB_KEYS.includes(page)) setTimeout(()=>hubShow(page), 80);
    return r;
  };

  /* Biometric success detector via MutationObserver on hint element */
  function hookBiometric(){
    const hint = document.getElementById('biometricHintV43');
    if(!hint) return;
    new MutationObserver(()=>{
      if(hint.textContent.includes('✅ Berhasil')) window.__bopBioAuth = true;
    }).observe(hint, {childList:true, characterData:true, subtree:true});
  }

  /* Init — add has-hub class + hubShow all hub pages + hook biometric + nav buttons */
  function init(){
    HUB_KEYS.forEach(key => {
      const page = document.getElementById('page-'+key);
      if(page) hubShow(key);
    });
    hookBiometric();
    document.querySelectorAll('.nav button[data-page]').forEach(btn => {
      btn.addEventListener('click', ()=>{
        const pg = btn.dataset.page;
        if(HUB_KEYS.includes(pg)) setTimeout(()=>hubShow(pg), 80);
      });
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>setTimeout(init, 780));
  } else {
    setTimeout(init, 780);
  }
})();


/* ================================================================
   PATCH v1.46 — KOP Uniformity + Data Sync Fix (docHadir/SK/Rekening)
   Tujuan:
   1. Override kopHTML() → pakai tag h1/h2/p + class agar PDF CSS &
      print CSS sama-sama bekerja.
   2. docHadir, docSK, docRekening → rebuild pakai wrapper official-v37
      (class="official official-v36 official-v37") sehingga styling
      cetak & PDF identik dengan 4 dokumen V37 lainnya.
   3. Sinkronisasi data: semua dokumen baca dari window.data via
      collectAll() yang sudah dijalankan oleh previewDocV37.
   ================================================================ */
(function bopKopFixV46(){
  if(window.__bopKopFixV46) return;
  window.__bopKopFixV46 = true;

  /* ── 1. Override kopHTML() — backward-compatible dengan PDF & print CSS ── */
  window.kopHTML = function kopHTML(){
    const k = (window.data && window.data.kop) ? window.data.kop : {};
    const m = (window.data && window.data.master) ? window.data.master : {};
    const b1 = k.baris1 || "PEMERINTAH KOTA SEMARANG";
    const b2 = k.baris2 || "KECAMATAN CANDISARI";
    const b3 = k.baris3 || "KELURAHAN TEGALSARI";
    const b4 = k.baris4 || "RW 012 RT 005";
    const addr = k.alamat || m.alamat || "";
    return `<div class="kop">` +
      `<div class="kop-logo-wrap"><img src="assets/logo-pemkot-semarang-transparent.png" class="kop-logo" alt="Logo Kota Semarang"></div>` +
      `<div class="kop-text">` +
        `<h1 class="kop-b1">${b1}</h1>` +
        `<h2 class="kop-b2">${b2}</h2>` +
        `<h2 class="kop-b2">${b3}</h2>` +
        `<h2 class="kop-b2">${b4}</h2>` +
        `<p class="kop-addr">${addr}</p>` +
      `</div>` +
      `<div class="kop-logo-spacer"></div>` +
    `</div>`;
  };

  /* ── 2. Helper: official wrapper V37 (sama persis dengan officialV37 di IIFE) ── */
  function officialWrap46(body){
    const kop = (typeof kopHTML === "function") ? kopHTML() : "";
    return `<div class="official official-v36 official-v37">${kop}<div class="official-body-v37">${body}</div></div>`;
  }

  /* ── 3. Helper data access ── */
  function d46(){ return window.data || {}; }
  function m46(){ return d46().master || {}; }
  function p46(){ return d46().pengajuan || {}; }
  function esc46(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function safe46(v, fb){ return String(v == null ? "" : v).trim() || (fb != null ? fb : ".................."); }
  function rupiah46(n){
    try{ if(typeof rupiah==="function") return rupiah(Number(n||0)); }catch(e){}
    return "Rp\u202f"+Number(n||0).toLocaleString("id-ID");
  }
  function terbilang46(n){
    try{ if(typeof terbilang==="function") return String(terbilang(Number(n||0))).replace(/\s+/g," ").trim(); }catch(e){}
    return "..................";
  }
  function tanggalSurat46(){
    const p=p46();
    return String(p.tanggalSurat||p.undTanggalSurat||"Semarang, tanggal bulan tahun").trim() || "Semarang, tanggal bulan tahun";
  }

  /* Normalisasi RAP rows — sama persis dengan normalizeRapRowV37 */
  function normalizeRapRow46(row, i){
    if(Array.isArray(row)){
      return {no:i+1,uraian:row[0]||"",volume:row[1]||"",jumlah:Number(row[2]||0),keterangan:row[3]||""};
    }
    row = row || {};
    return {
      no:i+1,
      uraian: row.uraian||row.kegiatan||row.nama||"",
      volume: row.volume||row.satuan||row.satuanVolume||"",
      jumlah: Number(row.jumlah != null ? row.jumlah : (row.anggaran != null ? row.anggaran : (row.rencanaAnggaran||0))),
      keterangan: row.keterangan||row.ket||""
    };
  }
  function rapRows46(){
    const rows = Array.isArray(p46().rap) ? p46().rap : [];
    return rows.map(normalizeRapRow46).filter(r=>r.uraian||r.jumlah||r.volume);
  }
  function totalRap46(){ return rapRows46().reduce((s,r)=>s+Number(r.jumlah||0),0); }

  /* Normalisasi peserta — handles array atau object format */
  function pesertaRows46(){
    const raw = Array.isArray(p46().peserta) ? p46().peserta : [];
    return raw.map((r,i)=>{
      if(Array.isArray(r)) return {no:i+1,nama:r[0]||"",jabatan:r[1]||"",alamat:r[2]||""};
      return {no:i+1,nama:r?.nama||"",jabatan:r?.jabatan||r?.status||"",alamat:r?.alamat||r?.rt||""};
    }).filter(r=>r.nama||r.jabatan||r.alamat);
  }

  /* ── 4. docHadir V46 — Daftar Hadir dengan format V37 ── */
  function docHadirV46(){
    const m=m46(), p=p46();
    let peserta = pesertaRows46();
    const hadirRows = Math.max(Number(p.hadirRows||20), peserta.length);
    // Lengkapi hingga hadirRows baris
    while(peserta.length < hadirRows) peserta.push({no:peserta.length+1,nama:"",jabatan:"",alamat:""});

    const rows = peserta.map((r,i)=>
      `<tr><td class="col-no-v37">${i+1}</td><td>${esc46(r.nama)}</td><td>${esc46(r.jabatan)}</td><td>${esc46(r.alamat)}</td><td style="min-width:70px">${i+1}.</td></tr>`
    ).join("");

    const tanggal = safe46(p.hadirTanggal||p.tanggalSurat,"Semarang, tanggal bulan tahun");
    const waktu   = safe46(p.hadirWaktu,"..................");
    const tempat  = safe46(p.hadirTempat||m.sekretariat,"Sekretariat RT 005 RW 012");
    const agenda  = safe46(p.hadirAgenda||p.hadirKegiatan||p.perihal,"Rapat Koordinasi Operasional RT");

    const body =
      `<div class="title">DAFTAR HADIR</div>` +
      `<table class="no-border identity-table-v37"><tbody>` +
        `<tr><td>Nama Kegiatan</td><td>:</td><td>${esc46(safe46(p.hadirKegiatan||p.perihal||p.undJudul,"Kegiatan Operasional RT"))}</td></tr>` +
        `<tr><td>Hari / Tanggal</td><td>:</td><td>${esc46(tanggal)}</td></tr>` +
        `<tr><td>Waktu</td><td>:</td><td>${esc46(waktu)}</td></tr>` +
        `<tr><td>Tempat</td><td>:</td><td>${esc46(tempat)}</td></tr>` +
        `<tr><td>Agenda</td><td>:</td><td>${esc46(agenda)}</td></tr>` +
      `</tbody></table>` +
      `<table><thead><tr>` +
        `<th class="col-no-v37">No.</th>` +
        `<th>Nama</th>` +
        `<th>Jabatan / Status</th>` +
        `<th>Alamat / RT</th>` +
        `<th>Tanda Tangan</th>` +
      `</tr></thead><tbody>${rows}</tbody></table>` +
      `<table class="no-border sign-right-v37" style="margin-top:16px"><tbody><tr>` +
        `<td style="width:60%"></td>` +
        `<td style="text-align:center">` +
          `${esc46(tanggal)}<br>` +
          `Ketua RT ${esc46(m.rt||"005")} RW ${esc46(m.rw||"012")},<br>` +
          `<div class="sign-space-v37"></div>` +
          `<b>${esc46(safe46(m.ketua,"Nama Ketua RT"))}</b>` +
        `</td>` +
      `</tr></tbody></table>`;
    return officialWrap46(body);
  }

  /* ── 5. docSK V46 — SK Lurah Pembentukan Pengurus RT dengan format V37 ── */
  function docSKV46(){
    const m=m46(), p=p46();
    const nomorSK   = safe46(p.nomorSK,"................................");
    const tanggalSK = safe46(p.tanggalSK,"................................");
    const masaBerlaku = safe46(p.masaBerlakuSK,"................................");
    const noKtpKetua  = safe46(m.noKtpKetua||p.noKtpKetua,"................................");

    const body =
      `<div class="title">SURAT KEPUTUSAN LURAH ${esc46((m.kelurahan||"").toUpperCase())}<br>` +
        `PEMBENTUKAN PENGURUS RT ${esc46(m.rt||"005")} RW ${esc46(m.rw||"012")}</div>` +
      `<table class="no-border identity-table-v37"><tbody>` +
        `<tr><td>Nomor SK</td><td>:</td><td><b>${esc46(nomorSK)}</b></td></tr>` +
        `<tr><td>Tanggal SK</td><td>:</td><td>${esc46(tanggalSK)}</td></tr>` +
        `<tr><td>Perihal</td><td>:</td><td>Pembentukan Pengurus RT ${esc46(m.rt||"005")} RW ${esc46(m.rw||"012")} Kel. ${esc46(m.kelurahan||"")}</td></tr>` +
        `<tr><td>Masa Berlaku</td><td>:</td><td>${esc46(masaBerlaku)}</td></tr>` +
      `</tbody></table>` +
      `<table style="margin-top:10px"><thead>` +
        `<tr><th class="col-no-v37">No.</th><th>Jabatan</th><th>Nama</th><th>No. KTP / NIK</th></tr>` +
      `</thead><tbody>` +
        `<tr><td class="col-no-v37">1</td><td>Ketua RT ${esc46(m.rt||"005")}</td><td>${esc46(safe46(m.ketua,"................................"))}</td><td>${esc46(noKtpKetua)}</td></tr>` +
        `<tr><td class="col-no-v37">2</td><td>Sekretaris</td><td>${esc46(safe46(m.sekretaris,"................................"))}</td><td>................................</td></tr>` +
        `<tr><td class="col-no-v37">3</td><td>Bendahara</td><td>${esc46(safe46(m.bendahara,"................................"))}</td><td>................................</td></tr>` +
      `</tbody></table>` +
      `<p class="center-v37" style="border:1px solid #bbb;padding:8px;font-style:italic;color:#555;margin-top:10px">` +
        `&#9888; Lampirkan fotokopi SK Lurah asli yang telah dilegalisir bersama berkas pengajuan ini.` +
      `</p>` +
      `<table class="no-border sign-two-v37 mengetahui-v37"><tbody><tr>` +
        `<td style="text-align:center">Ketua RT ${esc46(m.rt||"005")} RW ${esc46(m.rw||"012")}<br><div class="sign-space-v37"></div><b>${esc46(safe46(m.ketua,"Nama Jelas"))}</b></td>` +
        `<td style="text-align:center">Lurah ${esc46(m.kelurahan||"")}<br><div class="sign-space-v37"></div>NIP. ................................</td>` +
      `</tr></tbody></table>`;
    return officialWrap46(body);
  }

  /* ── 6. docRekening V46 — Informasi Rekening Bank dengan format V37 ── */
  function docRekeningV46(){
    const m=m46(), p=p46();
    const namaBank        = safe46(p.namaBank,"Bank Pembangunan Daerah (BPD) Jateng");
    const nomorRekening   = safe46(p.nomorRekening,"................................");
    const namaPemilik     = safe46(p.namaPemilikRekening||m.ketua,"................................");
    const cabangBank      = safe46(p.cabangBank,"................................");

    const body =
      `<div class="title">INFORMASI REKENING BANK<br>` +
        `RT ${esc46(m.rt||"005")} RW ${esc46(m.rw||"012")} ${esc46((m.kelurahan||"").toUpperCase())}</div>` +
      `<p class="center-v37">Data rekening bank untuk keperluan pencairan BOP RT ${esc46(m.rt||"005")} RW ${esc46(m.rw||"012")}, ` +
        `${esc46(m.kelurahan||"")}, Kota ${esc46(m.kota||"Semarang")}</p>` +
      `<table class="no-border identity-table-v37"><tbody>` +
        `<tr><td><b>Nama Bank</b></td><td>:</td><td><b>${esc46(namaBank)}</b></td></tr>` +
        `<tr><td><b>Nomor Rekening</b></td><td>:</td><td><b>${esc46(nomorRekening)}</b></td></tr>` +
        `<tr><td><b>Nama Pemilik Rekening</b></td><td>:</td><td>${esc46(namaPemilik)}</td></tr>` +
        `<tr><td><b>Cabang</b></td><td>:</td><td>${esc46(cabangBank)}</td></tr>` +
      `</tbody></table>` +
      `<table class="no-border identity-table-v37" style="margin-top:8px"><tbody>` +
        `<tr><td>Atas Nama Lembaga</td><td>:</td><td>RT ${esc46(m.rt||"005")} RW ${esc46(m.rw||"012")} ${esc46(m.kelurahan||"")}</td></tr>` +
        `<tr><td>Kelurahan</td><td>:</td><td>${esc46(m.kelurahan||"")}</td></tr>` +
        `<tr><td>Kecamatan</td><td>:</td><td>${esc46(m.kecamatan||"Candisari")}</td></tr>` +
        `<tr><td>Kota</td><td>:</td><td>Kota ${esc46(m.kota||"Semarang")}</td></tr>` +
      `</tbody></table>` +
      `<p class="center-v37" style="border:1px solid #bbb;padding:8px;font-style:italic;color:#555;margin-top:10px">` +
        `&#9888; Lampirkan fotokopi Buku Rekening BPD/Bank Jateng (halaman depan) bersama berkas pengajuan ini.` +
      `</p>` +
      `<table class="no-border sign-two-v37 mengetahui-v37"><tbody><tr>` +
        `<td style="text-align:center">Ketua RT ${esc46(m.rt||"005")} RW ${esc46(m.rw||"012")}<br><div class="sign-space-v37"></div><b>${esc46(safe46(m.ketua,"Nama Jelas"))}</b></td>` +
        `<td style="text-align:center">Mengetahui<br>Lurah ${esc46(m.kelurahan||"")}<br><div class="sign-space-v37"></div>NIP. ................................</td>` +
      `</tr></tbody></table>`;
    return officialWrap46(body);
  }

  /* ── 7. Override globals — previewDocV37 & docMapV37 akan auto-pickup ── */
  window.docHadir    = docHadirV46;
  window.docSK       = docSKV46;
  window.docRekening = docRekeningV46;

  /* ── 8. Fix CSS untuk kop-b1/b2/addr di print CSS V37 & PDF export ──
     Inject style ke <head> saat DOM ready agar screen preview juga benar */
  function injectKopCssV46(){
    if(document.getElementById("kopCssFixV46")) return;
    const style = document.createElement("style");
    style.id = "kopCssFixV46";
    style.textContent = `
      /* V46 — KOP semantic tag fix: h1/h2/p inside .kop-text */
      .kop h1.kop-b1, .kop .kop-b1 { font-family:"Times New Roman",serif; font-size:15pt; font-weight:bold; text-transform:uppercase; text-align:center; white-space:nowrap; line-height:1.1; margin:0; padding:0; display:block; }
      .kop h2.kop-b2, .kop .kop-b2 { font-family:"Times New Roman",serif; font-size:12.5pt; font-weight:bold; text-transform:uppercase; text-align:center; white-space:nowrap; line-height:1.1; margin:1px 0; padding:0; display:block; }
      .kop p.kop-addr, .kop .kop-addr { font-family:"Times New Roman",serif; font-size:9pt; font-weight:normal; text-align:center; margin-top:3px; line-height:1.2; white-space:normal; display:block; }
      .kop h1, .kop h2 { margin:0; padding:0; border:none; }
      /* Ensure official-body-v37 on new docs fills width */
      .official-body-v37 { width:100%; display:block; }
    `;
    document.head.appendChild(style);
  }

  /* ── 9. Patch exportPdfDocV38 — inject KOP CSS fix ke popup PDF ── */
  const KOP_PDF_CSS = `
    .kop{display:flex!important;align-items:center!important;border-bottom:3px double #000!important;padding:4px 0 8px 0!important;margin-bottom:14px!important;width:100%!important;box-sizing:border-box!important}
    .kop-logo-wrap{width:60px;min-width:60px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
    .kop-logo{width:54px!important;max-width:54px!important;height:auto!important;max-height:66px!important;object-fit:contain!important;display:block!important}
    .kop-logo-spacer{width:60px;min-width:60px;flex-shrink:0}
    .kop-text{flex:1!important;text-align:center!important;padding:0 4px!important}
    .kop h1,.kop-b1{font-family:"Times New Roman",serif!important;font-size:15pt!important;font-weight:bold!important;text-transform:uppercase!important;text-align:center!important;white-space:nowrap!important;line-height:1.1!important;margin:0!important;padding:0!important;display:block!important}
    .kop h2,.kop-b2{font-family:"Times New Roman",serif!important;font-size:12.5pt!important;font-weight:bold!important;text-transform:uppercase!important;text-align:center!important;white-space:nowrap!important;line-height:1.1!important;margin:1px 0!important;padding:0!important;display:block!important}
    .kop p,.kop-addr{font-family:"Times New Roman",serif!important;font-size:9pt!important;font-weight:normal!important;text-align:center!important;margin-top:3px!important;line-height:1.2!important;white-space:normal!important;display:block!important}
    .official-body-v37{width:100%;display:block}
  `;

  const _origExportPdfDoc = window.exportPdfDocV38;
  window.exportPdfDocV38 = async function exportPdfDocV46(){
    if(typeof collectAll==="function") collectAll();
    const type=(typeof currentDoc!=="undefined"?currentDoc:null)||window.currentDoc||"permohonan";
    if(typeof previewDoc==="function") previewDoc(type);
    await new Promise(r=>setTimeout(r,180));
    const el=document.getElementById("docOutput");
    if(!el||!el.innerHTML.trim()){
      if(typeof bopAlert==="function") bopAlert("Export PDF","Pilih dokumen terlebih dahulu sebelum export PDF.","warning");
      return;
    }
    const inner=el.innerHTML;
    const printWin=window.open("","_blank","width=920,height=1150");
    if(!printWin){
      if(typeof bopAlert==="function") bopAlert("Popup Diblokir","Izinkan popup untuk halaman ini di browser, lalu coba lagi.","warning");
      return;
    }
    const title="Dokumen BOP RT 005 — "+type;
    printWin.document.write(`<!doctype html><html lang="id"><head>
<meta charset="UTF-8"><title>${title}</title>
<style>
@page{size:A4;margin:14mm}
*{box-sizing:border-box}
body{margin:0;padding:20px;font-family:"Times New Roman",serif;font-size:12pt;color:#000;background:#fff}
.official,.official-v36,.official-v37{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.26;color:#000}
.official .title,.official-v36 .title,.official-v37 .title{text-align:center;font-weight:bold;text-transform:uppercase;margin:10px 0 16px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #000;padding:5px 8px;font-size:11pt}
.no-border td,.no-border th,.no-border{border:none!important}
.col-no-v37{width:8mm!important;text-align:center!important}
.money-cell-v37{text-align:right!important;white-space:nowrap}
.identity-table-v37 td:first-child{width:36mm;white-space:nowrap}
.sign-two-v37 td{width:50%;text-align:center!important;vertical-align:top;border:none!important}
.sign-right-v37 td{border:none!important}
.sign-space-v37{height:54px;display:block}
.center-v37{text-align:center!important}
.date-right-v37{text-align:right!important}
.mengetahui-v37{margin-top:14px!important}
p{margin:7px 0}
ol{margin:5px 0 8px 22px;padding:0}
li{margin:4px 0}
.page-break-v37{page-break-after:always;break-after:page;height:0;border:none}
${KOP_PDF_CSS}
</style>
</head><body>${inner}</body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(()=>printWin.print(),650);
  };

  /* ── Init ── */
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>{
      injectKopCssV46();
      /* Re-render dokumen aktif setelah patch selesai */
      setTimeout(()=>{
        if(typeof previewDoc==="function"){
          const t=(typeof currentDoc!=="undefined"?currentDoc:null)||window.currentDoc||"permohonan";
          try{ previewDoc(t); }catch(e){}
        }
      },300);
    });
  } else {
    injectKopCssV46();
    setTimeout(()=>{
      if(typeof previewDoc==="function"){
        const t=(typeof currentDoc!=="undefined"?currentDoc:null)||window.currentDoc||"permohonan";
        try{ previewDoc(t); }catch(e){}
      }
    },300);
  }

  console.log("[BOP KOP Fix v1.46] kopHTML, docHadir/SK/Rekening, dan PDF CSS diperbarui.");
})();


/* ================================================================
   PATCH v1.47 — Auto-simpan form values sebelum fillInputs() overwrite
   Masalah: render() → fillInputs() bisa menimpa nilai yang sudah
   diketik user sebelum collectAll() sempat menyimpannya.
   Fix: override fillInputs() untuk panggil collectAll() terlebih
   dahulu (skip pada render pertama agar localStorage tidak kosong).
   ================================================================ */
(function bopFillInputsFixV47(){
  if(window.__bopFillInputsFixV47) return;
  window.__bopFillInputsFixV47 = true;

  let _initDone = false;
  const _origFillInputs = window.fillInputs;

  window.fillInputs = function fillInputsSafe(){
    if(_initDone){
      /* Setelah render pertama: simpan nilai form saat ini sebelum di-overwrite */
      if(typeof collectAll === 'function'){
        try { collectAll(); } catch(e) { console.warn('[BOP v1.47] collectAll error:', e); }
      }
      try { localStorage.setItem('bop_rt005_data_v1_25', JSON.stringify(window.data)); } catch(e) {}
    }
    _initDone = true;
    if(typeof _origFillInputs === 'function') return _origFillInputs();
  };

  /* Juga perbaiki save otomatis saat user PINDAH halaman (nav click) */
  document.addEventListener('click', function(e){
    const navBtn = e.target.closest('[data-page]');
    if(navBtn && typeof collectAll === 'function'){
      try {
        collectAll();
        localStorage.setItem('bop_rt005_data_v1_25', JSON.stringify(window.data));
      } catch(_e) {}
    }
  }, true /* capture phase: sebelum event handler lain */);

  /* Update document.title */
  try {
    document.title = 'LaKu Warga — Laporan & Dokumentasi Online Warga';
  } catch(_e) {}

  console.log('[BOP Form Fix v1.47] fillInputs() auto-simpan & nav-save aktif.');
})();


/* ==========================================================
   PATCH v1.48 — Fix RAP Bulanan di tab Generate 7 Dokumen
   Masalah: monthlyDocMonth hanya ada di tab RAP Bulanan,
   bukan di tab-dokumen. Saat generate RAP Bulanan dari
   tab Dokumen, bulan tidak tersinkron → hasil selalu sama.
   Fix: inject selector bulan di panel generate dokumen,
   sinkronkan ke data.pengajuan.selectedMonth & monthlyDocMonth
   sebelum memanggil previewDoc.
   ========================================================== */
(function bopFixRapBulananDokTabV48(){
  const RAP_MONTHS_V48 = [
    "Januari 2026","Februari 2026","Maret 2026","April 2026",
    "Mei 2026","Juni 2026","Juli 2026","Agustus 2026",
    "September 2026","Oktober 2026","November 2026","Desember 2026"
  ];

  function init(){
    const docSel  = document.getElementById("dsDocSelectV43");
    const genBtn  = document.getElementById("dsDocGenBtnV43");
    if(!docSel || !genBtn) return;

    /* -- 1. Buat selector bulan & inject setelah dsDocSelectV43 -- */
    const wrapper = document.createElement("div");
    wrapper.id = "v48RapBulanWrap";
    wrapper.style.cssText = "display:none;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap;";

    const lbl = document.createElement("label");
    lbl.style.cssText = "font-size:0.82rem;font-weight:600;color:#64748b;white-space:nowrap;";
    lbl.textContent = "Bulan RAP:";

    const msel = document.createElement("select");
    msel.id = "v48RapBulanSel";
    msel.className = "ds-doc-select-v43";
    msel.style.cssText = "min-width:150px;";
    RAP_MONTHS_V48.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      msel.appendChild(opt);
    });

    wrapper.appendChild(lbl);
    wrapper.appendChild(msel);

    /* Sisipkan setelah grup select+button */
    const grp = document.querySelector(".ds-doc-select-group-v43");
    if(grp) grp.insertAdjacentElement("afterend", wrapper);
    else {
      const left = document.querySelector(".ds-gen-left");
      if(left) left.appendChild(wrapper);
    }

    /* -- 2. Set nilai awal dari data tersimpan -- */
    function syncInitialMonth(){
      try {
        const saved = (typeof data !== "undefined" && data?.pengajuan?.selectedMonth)
          ? data.pengajuan.selectedMonth
          : (document.getElementById("monthlyDocMonth")?.value || "Januari 2026");
        if(RAP_MONTHS_V48.includes(saved)) msel.value = saved;
      } catch(e){}
    }
    syncInitialMonth();

    /* -- 3. Tampilkan/sembunyikan selector bulan sesuai pilihan -- */
    function toggleMonthSel(){
      const show = docSel.value === "rapbulanan";
      wrapper.style.display = show ? "flex" : "none";
    }
    docSel.addEventListener("change", toggleMonthSel);
    toggleMonthSel();

    /* -- 4. Sync bulan ke data sebelum generate -- */
    function syncMonth(){
      const month = msel.value;
      /* tulis ke data.pengajuan.selectedMonth */
      try {
        if(typeof data !== "undefined" && data.pengajuan) {
          data.pengajuan.selectedMonth = month;
        }
        if(window.data?.pengajuan) window.data.pengajuan.selectedMonth = month;
      } catch(e){}
      /* juga sync ke monthlyDocMonth di tab-rap-bulanan */
      const globalSel = document.getElementById("monthlyDocMonth");
      if(globalSel) globalSel.value = month;
      /* simpan ke localStorage */
      try {
        const STORE_KEY = (typeof STORE !== "undefined") ? STORE : "bop_rt005_data_v1_25";
        localStorage.setItem(STORE_KEY, JSON.stringify(window.data));
      } catch(e){}
    }

    /* -- 5. Override tombol Generate agar sync bulan dulu -- */
    /* Hapus semua listener lama dengan clone */
    const newBtn = genBtn.cloneNode(true);
    genBtn.parentNode.replaceChild(newBtn, genBtn);

    newBtn.addEventListener("click", () => {
      const type = docSel.value;
      if(!type) return;
      /* Jika RAP Bulanan, sync bulan sebelum generate */
      if(type === "rapbulanan") syncMonth();
      if(typeof previewDoc === "function"){
        previewDoc(type);
      } else {
        const hiddenBtn = document.querySelector(`.doc-btn[data-doc="${type}"]`);
        if(hiddenBtn) hiddenBtn.click();
      }
    });

    /* -- 6. Auto-preview on month change -- */
    msel.addEventListener("change", () => {
      if(docSel.value === "rapbulanan"){
        syncMonth();
        if(typeof previewDoc === "function") previewDoc("rapbulanan");
      }
    });

    console.log("[BOP Fix v1.48] Selector bulan RAP Bulanan di tab Dokumen aktif.");
  }

  if(document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 1500));
  else
    setTimeout(init, 1500);
})();


/* ================================================================
   PATCH v1.49 — Persiapan Kegiatan: RAP Auto-Detect & SPJ KOP V37

   Fitur:
   1. Panel pemilih kegiatan dari RAP Bulanan di atas form pk-data
   2. Auto-fill form saat kartu kegiatan diklik
   3. Indikator kegiatan aktif (badge breadcrumb)
   4. Override docPkUndangan/Hadir/Notulen/Kuitansi → KOP V37
   5. Auto-navigate ke pk-generate + preview dokumen relevan
   ================================================================ */
(function bopRapAutoDetectV49(){
  if(window.__bopRapAutoDetectV49) return;
  window.__bopRapAutoDetectV49 = true;

  const MONTHS_V49 = [
    "Januari 2026","Februari 2026","Maret 2026","April 2026",
    "Mei 2026","Juni 2026","Juli 2026","Agustus 2026",
    "September 2026","Oktober 2026","November 2026","Desember 2026"
  ];
  const MONTH_ALL_V49 = "Januari-Desember 2026";
  const STORE_V49 = "bop_rt005_data_v1_25";

  /* ── Helpers ── */
  function esc49(s){
    try{ if(typeof esc==="function") return esc(String(s==null?"":s)); }catch(e){}
    return String(s==null?"":s).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function safe49(v,fb){ var s=String(v==null?"":v).trim(); return s||(fb!=null?fb:".........."); }
  function rupiah49(n){
    try{ if(typeof rupiah==="function") return rupiah(Number(n||0)); }catch(e){}
    return "Rp\u202f"+Number(n||0).toLocaleString("id-ID");
  }
  function terbilang49(n){
    try{ if(typeof terbilang==="function") return String(terbilang(Number(n||0))).replace(/\s+/g," ").trim(); }catch(e){}
    return "..........";
  }
  function d49(){ return window.data||{}; }
  function m49(){ return d49().master||{}; }
  function p49(){ return d49().persiapan||{}; }
  function rap49(){ var r=d49().pengajuan; return Array.isArray(r&&r.rap)?r.rap:[]; }

  /* Official wrapper KOP V37 */
  function pkOfficial49(body){
    var kop = typeof kopHTML==="function" ? kopHTML() : "";
    return '<div class="official official-v36 official-v37">'+kop+'<div class="official-body-v37">'+body+'</div></div>';
  }

  /* ── Normalize RAP row ── */
  function normalizeRow49(r){
    if(!r) return {uraian:"",volume:"1 Paket",jumlah:0,keterangan:"",tipe:"Lainnya",kategori:"",subKategori:"",bulan:MONTHS_V49[0]};
    if(Array.isArray(r)) return {uraian:r[0]||"",volume:r[1]||"1 Paket",jumlah:Number(r[2]||0),keterangan:r[3]||"",tipe:"Lainnya",kategori:"",subKategori:"",bulan:MONTHS_V49[0]};
    return {
      uraian:r.uraian||r.kegiatan||r.nama||"",
      volume:r.volume||r.satuan||"1 Paket",
      jumlah:Number(r.jumlah!=null?r.jumlah:(r.anggaran!=null?r.anggaran:(r.rencanaAnggaran||0))),
      keterangan:r.keterangan||r.ket||"",
      tipe:r.tipe||"Lainnya",
      kategori:r.kategori||"",
      subKategori:r.subKategori||"",
      bulan:r.bulan||MONTHS_V49[0]
    };
  }

  /* ── Get filtered rows for a month ── */
  function getRowsForMonth49(month){
    var rows=[];
    rap49().forEach(function(r,idx){
      var n=normalizeRow49(r);
      if(!n.uraian) return;
      if(n.bulan===month){
        rows.push(Object.assign({},n,{jumlahBulanan:n.jumlah,sumber:"Langsung",annualIndex:idx}));
      } else if(n.bulan===MONTH_ALL_V49 && MONTHS_V49.indexOf(month)>=0){
        rows.push(Object.assign({},n,{jumlahBulanan:Math.round(n.jumlah/MONTHS_V49.length),sumber:"Bagi rata",annualIndex:idx}));
      }
    });
    return rows;
  }

  /* ── Map RAP tipe/subKategori → pkJenis select value ── */
  function mapJenis49(row){
    var tipe=(row.tipe||"").toLowerCase();
    var kat=(row.kategori||"").toLowerCase();
    var sub=(row.subKategori||"").toLowerCase();
    var ur=(row.uraian||"").toLowerCase();
    if(tipe.indexOf("makan")>=0||tipe.indexOf("konsumsi")>=0) return "Konsumsi Rapat / Pertemuan Warga";
    if(tipe.indexOf("jasa")>=0||tipe.indexOf("tukang")>=0||tipe.indexOf("honor")>=0) return "Jasa Tukang / Pemeliharaan Sarpras";
    if(tipe.indexOf("sewa")>=0) return "Sewa Peralatan / Tempat";
    if(tipe.indexOf("barang")>=0||tipe.indexOf("material")>=0) return "Belanja Barang / Material";
    if(sub.indexOf("kerja bakti")>=0||sub.indexOf("gotong")>=0||ur.indexOf("kerja bakti")>=0||ur.indexOf("gotong")>=0) return "Kerja Bakti / Gotong Royong";
    if(sub.indexOf("hari besar")>=0||sub.indexOf("hut")>=0||ur.indexOf("hut ri")>=0||ur.indexOf("17 agustus")>=0) return "HUT RI / Kegiatan Sosial Budaya";
    if(sub.indexOf("sampah")>=0||ur.indexOf("sampah")>=0||kat.indexOf("sampah")>=0) return "Pengelolaan Sampah / Kebersihan Lingkungan";
    if(sub.indexOf("rapat")>=0||sub.indexOf("pertemuan")>=0||ur.indexOf("rapat")>=0||ur.indexOf("pertemuan")>=0) return "Konsumsi Rapat / Pertemuan Warga";
    if(kat.indexOf("penataan")>=0||kat.indexOf("lingkungan")>=0||kat.indexOf("pemeliharaan")>=0) return "Jasa Tukang / Pemeliharaan Sarpras";
    return "Lainnya";
  }

  /* ── Auto-select doc type after load ── */
  function autoDocType49(jenis){
    var j=(jenis||"").toLowerCase();
    if(j.indexOf("konsumsi")>=0||j.indexOf("rapat")>=0||j.indexOf("gotong")>=0||j.indexOf("hut")>=0||j.indexOf("sosial")>=0||j.indexOf("bakti")>=0) return "pk-undangan";
    return "pk-kuitansi";
  }

  /* ── Form hint based on jenis ── */
  function formHint49(jenis){
    var j=(jenis||"").toLowerCase();
    if(j.indexOf("rapat")>=0||j.indexOf("konsumsi")>=0) return "&#128204; Tipe <b>Rapat/Pertemuan</b> — lengkapi tab <b>Notulen</b>, <b>Daftar Hadir</b>, dan nominal di tab <b>Kuitansi</b>.";
    if(j.indexOf("sampah")>=0||j.indexOf("jasa")>=0||j.indexOf("tukang")>=0) return "&#128204; Tipe <b>Jasa/Honorarium</b> — lengkapi <b>Penerima</b>, <b>Nominal</b>, dan <b>Keperluan Pembayaran</b>.";
    if(j.indexOf("barang")>=0||j.indexOf("material")>=0||j.indexOf("sewa")>=0) return "&#128204; Tipe <b>Pengadaan/Belanja</b> — lengkapi <b>Deskripsi Barang</b> di Keperluan dan Nominal Kuitansi.";
    if(j.indexOf("gotong")>=0||j.indexOf("bakti")>=0) return "&#128204; Tipe <b>Gotong Royong</b> — lengkapi <b>Agenda</b> dan <b>Daftar Hadir</b> warga.";
    if(j.indexOf("hut")>=0||j.indexOf("sosial")>=0||j.indexOf("budaya")>=0) return "&#128204; Tipe <b>Kegiatan Sosial/Budaya</b> — lengkapi <b>Agenda</b>, <b>Notulen</b>, dan dokumentasi.";
    return "&#128204; Lengkapi data kegiatan di bawah, lalu generate dokumen di tab <b>Generate Bukti SPJ</b>.";
  }

  /* ── Category badge style ── */
  function katBadge49(kategori){
    var k=(kategori||"").toLowerCase();
    if(k.indexOf("administratif")>=0||k.indexOf("administrasi")>=0) return {label:"Administratif",color:"#3b82f6"};
    if(k.indexOf("sosial")>=0||k.indexOf("budaya")>=0) return {label:"Sosial & Budaya",color:"#10b981"};
    if(k.indexOf("penataan")>=0||k.indexOf("lingkungan")>=0||k.indexOf("pemeliharaan")>=0) return {label:"Lingkungan",color:"#f59e0b"};
    return {label:"Operasional",color:"#6b7280"};
  }

  /* ── Render card grid ── */
  function renderCardGrid49(month){
    var el=document.getElementById("pkRapCardGridV49");
    if(!el) return;
    var activeIdx=(d49().persiapan||{}).rapAutoIdx;
    var rows=getRowsForMonth49(month);
    if(!rows.length){
      el.innerHTML='<div class="pk-rap-empty-v49">Belum ada kegiatan di RAP untuk bulan <b>'+esc49(month)+'</b>.<br><small>Tambahkan kegiatan di menu <b>Pengajuan Dana Operasional → RAP 1 Tahun</b>.</small></div>';
      return;
    }
    /* Group by kategori */
    var groups={};
    var groupOrder=[];
    rows.forEach(function(r){
      var k=r.kategori||"Lainnya";
      if(!groups[k]){ groups[k]=[]; groupOrder.push(k); }
      groups[k].push(r);
    });
    var html="";
    groupOrder.forEach(function(kat){
      var items=groups[kat];
      var badge=katBadge49(kat);
      html+='<div class="pk-rap-kategori-v49">';
      html+='<div class="pk-rap-kat-label-v49" style="color:'+badge.color+'">'+esc49(badge.label)+'</div>';
      html+='<div class="pk-rap-cards-row-v49">';
      items.forEach(function(r){
        var isActive=(r.annualIndex===activeIdx);
        html+='<div class="pk-rap-card-v49'+(isActive?" active":"")+'" onclick="window._pkLoadRap49('+r.annualIndex+',\''+esc49(month)+'\')" title="'+esc49(r.uraian)+'">';
        html+='<div class="pk-rap-card-nama-v49">'+esc49(r.uraian)+'</div>';
        html+='<div class="pk-rap-card-meta-v49">'+esc49(r.volume)+' &bull; '+esc49(r.sumber)+'</div>';
        html+='<div class="pk-rap-card-jumlah-v49">'+rupiah49(r.jumlahBulanan)+'</div>';
        html+='</div>';
      });
      html+='</div></div>';
    });
    el.innerHTML=html;
  }

  /* ── Load kegiatan into form ── */
  window._pkLoadRap49 = function(annualIndex, month){
    var rapRows=rap49();
    var raw=rapRows[annualIndex];
    if(!raw) return;
    var r=normalizeRow49(raw);
    var jumlahBulanan;
    if(r.bulan===MONTH_ALL_V49 && MONTHS_V49.indexOf(month)>=0){
      jumlahBulanan=Math.round(r.jumlah/MONTHS_V49.length);
    } else {
      jumlahBulanan=r.jumlah;
    }
    var jenis=mapJenis49(r);
    var agenda=r.keterangan
      ? r.uraian+". "+r.keterangan
      : "Pelaksanaan "+r.uraian+" dalam rangka kegiatan operasional RT 005 RW 012.";
    var keperluan="Pembayaran "+r.uraian+" ("+r.volume+") \u2014 Bulan "+month+"."+(r.keterangan?" "+r.keterangan:" Sesuai mata belanja yang tercantum dalam RAP BOP RT.");

    /* Ensure persiapan exists */
    if(typeof ensurePersiapan==="function") ensurePersiapan();
    if(!window.data) return;
    if(!window.data.persiapan) window.data.persiapan={};

    /* Set data.persiapan */
    window.data.persiapan.jenis    = jenis;
    window.data.persiapan.nama     = r.uraian||"Kegiatan Operasional RT";
    window.data.persiapan.agenda   = agenda;
    window.data.persiapan.keperluan= keperluan;
    window.data.persiapan.nominal  = jumlahBulanan;
    window.data.persiapan.rapAutoIdx   = annualIndex;
    window.data.persiapan.rapAutoMonth = month;

    /* Populate form elements */
    if(typeof fillPersiapan==="function") fillPersiapan();

    /* Persist */
    try{ localStorage.setItem(STORE_V49, JSON.stringify(window.data)); }catch(e){}

    /* Update card highlights */
    renderCardGrid49(month);

    /* Update breadcrumb */
    var badge=document.getElementById("pkActiveKegiatanBadgeV49");
    var name=document.getElementById("pkActiveKegiatanNameV49");
    var hint=document.getElementById("pkFormHintV49");
    if(badge) badge.style.display="flex";
    if(name) name.textContent=r.uraian;
    if(hint) hint.innerHTML=formHint49(jenis);

    /* Navigate to pk-generate + preview */
    if(typeof activateTab==="function") activateTab("pk-generate");
    setTimeout(function(){
      if(typeof collectPersiapan==="function") collectPersiapan();
      var docType=autoDocType49(jenis);
      if(typeof previewPkDoc==="function"){
        window.currentPkDoc=docType;
        previewPkDoc(docType);
      }
    },100);
  };

  /* ── Month selector change ── */
  window._pkRapMonthChange49 = function(){
    var sel=document.getElementById("pkRapMonthV49");
    if(!sel) return;
    renderCardGrid49(sel.value);
  };

  /* ── Clear active kegiatan ── */
  window._pkClearRap49 = function(){
    if(window.data && window.data.persiapan){
      delete window.data.persiapan.rapAutoIdx;
      delete window.data.persiapan.rapAutoMonth;
    }
    var badge=document.getElementById("pkActiveKegiatanBadgeV49");
    var hint=document.getElementById("pkFormHintV49");
    if(badge) badge.style.display="none";
    if(hint) hint.innerHTML="";
    var sel=document.getElementById("pkRapMonthV49");
    renderCardGrid49(sel?sel.value:MONTHS_V49[5]);
  };

  /* ── Inject panel into #tab-pk-data ── */
  function injectPanel49(){
    var tabPkData=document.getElementById("tab-pk-data");
    if(!tabPkData || document.getElementById("pkRapAutoDetectPanel")) return;

    /* Determine default month */
    var selMonth = (d49().pengajuan && MONTHS_V49.indexOf(d49().pengajuan.selectedMonth)>=0)
      ? d49().pengajuan.selectedMonth
      : (MONTHS_V49[new Date().getMonth()] || MONTHS_V49[5]);

    /* Month selector options */
    var monthOpts = MONTHS_V49.map(function(mo){
      return '<option value="'+mo+'"'+(mo===selMonth?" selected":"")+'>'+mo+'</option>';
    }).join("");

    /* Build RAP panel */
    var rapPanel=document.createElement("div");
    rapPanel.id="pkRapAutoDetectPanel";
    rapPanel.className="panel pk-rap-panel-v49";
    rapPanel.innerHTML=
      '<div class="pk-rap-header-v49">'+
        '<div>'+
          '<h3>Pilih Kegiatan dari RAP Bulanan</h3>'+
          '<p class="hint" style="margin:0">Klik kartu kegiatan &rarr; form terisi otomatis.</p>'+
        '</div>'+
        '<div>'+
          '<label style="display:grid;gap:5px;font-size:0.81rem;font-weight:600;color:var(--muted)">Bulan Kegiatan'+
            '<select id="pkRapMonthV49" onchange="window._pkRapMonthChange49()" style="min-width:150px;padding:8px 10px;border-radius:10px;border:1px solid var(--line)">'+
              monthOpts+
            '</select>'+
          '</label>'+
        '</div>'+
      '</div>'+
      '<div id="pkRapCardGridV49" class="pk-rap-card-grid-v49"></div>';

    /* Build active badge */
    var badge=document.createElement("div");
    badge.id="pkActiveKegiatanBadgeV49";
    badge.className="pk-active-badge-v49";
    badge.style.display="none";
    badge.innerHTML=
      '<span>&#9989; Kegiatan Aktif: <strong id="pkActiveKegiatanNameV49"></strong></span>'+
      '<button onclick="window._pkClearRap49()" class="pk-clear-btn-v49">&#10005; Kosongkan</button>';

    /* Build form hint */
    var hint=document.createElement("div");
    hint.id="pkFormHintV49";
    hint.className="pk-form-hint-v49";

    /* Insert all before the first .panel in tab-pk-data */
    var firstPanel=tabPkData.querySelector(".panel");
    if(firstPanel){
      tabPkData.insertBefore(hint, firstPanel);
      tabPkData.insertBefore(badge, hint);
      tabPkData.insertBefore(rapPanel, badge);
    } else {
      tabPkData.insertBefore(hint, tabPkData.firstChild);
      tabPkData.insertBefore(badge, hint);
      tabPkData.insertBefore(rapPanel, badge);
    }

    /* Initial card render */
    renderCardGrid49(selMonth);

    /* Restore saved state */
    var savedIdx=(d49().persiapan||{}).rapAutoIdx;
    var savedMonth=(d49().persiapan||{}).rapAutoMonth;
    if(savedIdx!==undefined && savedMonth && MONTHS_V49.indexOf(savedMonth)>=0){
      var rawRow=rap49()[savedIdx];
      if(rawRow){
        var n=normalizeRow49(rawRow);
        var badgeEl=document.getElementById("pkActiveKegiatanBadgeV49");
        var nameEl=document.getElementById("pkActiveKegiatanNameV49");
        var hintEl=document.getElementById("pkFormHintV49");
        if(badgeEl) badgeEl.style.display="flex";
        if(nameEl) nameEl.textContent=n.uraian;
        if(hintEl) hintEl.innerHTML=formHint49(mapJenis49(n));
        /* Sync month selector */
        var selEl=document.getElementById("pkRapMonthV49");
        if(selEl) selEl.value=savedMonth;
        renderCardGrid49(savedMonth);
      }
    }
  }

  /* ================================================================
     PK Doc Generators V49 — pakai KOP V37 via pkOfficial49()
     Override: docPkUndangan, docPkHadir, docPkNotulen, docPkKuitansi
     ================================================================ */

  function docPkUndanganV49(){
    if(typeof collectPersiapan==="function") collectPersiapan();
    var m=m49(), p=p49();
    var rt=m.rt||"005", rw=m.rw||"012";
    var noUnd=safe49(p.nomorKuitansi,".../UND/RT"+rt+"/.../2026");
    var tgl=safe49(p.tanggalTerima,"Semarang, ................. 2026");
    var body=
      '<p class="date-right-v37">'+esc49(tgl)+'</p>'+
      '<table class="no-border identity-table-v37"><tbody>'+
        '<tr><td>Nomor</td><td>:</td><td>'+esc49(noUnd)+'</td></tr>'+
        '<tr><td>Lampiran</td><td>:</td><td>-</td></tr>'+
        '<tr><td>Perihal</td><td>:</td><td>Undangan '+esc49(p.nama||"Kegiatan Operasional RT")+'</td></tr>'+
      '</tbody></table>'+
      '<p>Kepada Yth.<br>Warga / Peserta Kegiatan<br>RT '+esc49(rt)+' RW '+esc49(rw)+'<br>di Tempat</p>'+
      '<p>Dengan hormat,</p>'+
      '<p>Dalam rangka pelaksanaan kegiatan operasional RT, kami mengundang Bapak/Ibu/Saudara/i untuk hadir pada:</p>'+
      '<table class="no-border identity-table-v37"><tbody>'+
        '<tr><td>Jenis Kegiatan</td><td>:</td><td>'+esc49(p.jenis||"-")+'</td></tr>'+
        '<tr><td>Nama Kegiatan</td><td>:</td><td><b>'+esc49(p.nama||"-")+'</b></td></tr>'+
        '<tr><td>Hari / Tanggal</td><td>:</td><td>'+esc49(p.hariTanggal||"-")+'</td></tr>'+
        '<tr><td>Waktu</td><td>:</td><td>'+esc49(p.waktu||"-")+'</td></tr>'+
        '<tr><td>Tempat</td><td>:</td><td>'+esc49(p.tempat||"-")+'</td></tr>'+
        '<tr><td>Agenda</td><td>:</td><td>'+esc49(p.agenda||"-").replace(/\n/g,"<br>")+'</td></tr>'+
      '</tbody></table>'+
      '<p>Mengingat pentingnya acara tersebut, kami mengharapkan kehadiran Bapak/Ibu/Saudara/i tepat waktu. Atas perhatian dan kehadirannya, kami ucapkan terima kasih.</p>'+
      '<table class="no-border sign-right-v37" style="margin-top:20px"><tbody><tr>'+
        '<td style="width:60%"></td>'+
        '<td style="text-align:center">'+esc49(tgl)+'<br>Ketua RT '+esc49(rt)+' RW '+esc49(rw)+',<br><div class="sign-space-v37"></div><b>'+esc49(safe49(m.ketua,"Nama Jelas"))+'</b></td>'+
      '</tr></tbody></table>';
    return pkOfficial49(body);
  }

  function docPkHadirV49(){
    if(typeof collectPersiapan==="function") collectPersiapan();
    var m=m49(), p=p49();
    var rt=m.rt||"005", rw=m.rw||"012";
    var peserta=Array.isArray(p.peserta)?p.peserta:[];
    var rows49=Math.max(Number(p.rows||30), peserta.length);
    var list=peserta.map(function(r){
      if(Array.isArray(r)) return {nama:r[0]||"",jabatan:r[1]||"",alamat:r[2]||""};
      return {nama:(r&&r.nama)||"",jabatan:(r&&r.jabatan)||"",alamat:(r&&r.alamat)||""};
    });
    while(list.length<rows49) list.push({nama:"",jabatan:"",alamat:""});
    var rowsHtml=list.map(function(r,i){
      return '<tr><td class="col-no-v37">'+(i+1)+'</td><td>'+esc49(r.nama)+'</td><td>'+esc49(r.jabatan)+'</td><td>'+esc49(r.alamat)+'</td><td>'+(i+1)+'.</td></tr>';
    }).join("");
    var tgl=safe49(p.tanggalTerima,"Semarang, ................. 2026");
    var body=
      '<div class="title">DAFTAR HADIR KEGIATAN OPERASIONAL</div>'+
      '<table class="no-border identity-table-v37"><tbody>'+
        '<tr><td>Jenis Kegiatan</td><td>:</td><td>'+esc49(p.jenis||"-")+'</td></tr>'+
        '<tr><td>Nama Kegiatan</td><td>:</td><td><b>'+esc49(p.nama||"-")+'</b></td></tr>'+
        '<tr><td>Hari / Tanggal</td><td>:</td><td>'+esc49(p.hariTanggal||"-")+'</td></tr>'+
        '<tr><td>Waktu</td><td>:</td><td>'+esc49(p.waktu||"-")+'</td></tr>'+
        '<tr><td>Tempat</td><td>:</td><td>'+esc49(p.tempat||"-")+'</td></tr>'+
        '<tr><td>Agenda</td><td>:</td><td>'+esc49(p.agenda||"-").replace(/\n/g,"<br>")+'</td></tr>'+
      '</tbody></table>'+
      '<table style="margin-top:12px"><thead><tr>'+
        '<th class="col-no-v37">No.</th><th>Nama</th><th>Jabatan / Status</th><th>Alamat / RT</th><th style="min-width:60px">Tanda Tangan</th>'+
      '</tr></thead><tbody>'+rowsHtml+'</tbody></table>'+
      '<table class="no-border sign-right-v37" style="margin-top:16px"><tbody><tr>'+
        '<td style="width:60%"></td>'+
        '<td style="text-align:center">'+esc49(tgl)+'<br>Ketua RT '+esc49(rt)+' RW '+esc49(rw)+',<br><div class="sign-space-v37"></div><b>'+esc49(safe49(m.ketua,"Nama Jelas"))+'</b></td>'+
      '</tr></tbody></table>';
    return pkOfficial49(body);
  }

  function docPkNotulenV49(){
    if(typeof collectPersiapan==="function") collectPersiapan();
    var m=m49(), p=p49();
    var rt=m.rt||"005", rw=m.rw||"012";
    var actionRows=(Array.isArray(p.action)?p.action:[]).map(function(r,i){
      var a=Array.isArray(r)?{tugas:r[0]||"",waktu:r[1]||"",pic:r[2]||""}:{tugas:r.tugas||"",waktu:r.waktu||"",pic:r.pic||""};
      return '<tr><td class="col-no-v37">'+(i+1)+'</td><td>'+esc49(a.tugas)+'</td><td>'+esc49(a.waktu)+'</td><td>'+esc49(a.pic)+'</td></tr>';
    }).join("");
    var pesertaRows=(Array.isArray(p.peserta)?p.peserta:[]).filter(function(r){ return Array.isArray(r)?(r[0]||r[1]):(r&&(r.nama||r.jabatan)); }).map(function(r,i){
      if(Array.isArray(r)) return '<tr><td class="col-no-v37">'+(i+1)+'</td><td>'+esc49(r[0])+'</td><td>'+esc49(r[1])+'</td><td>'+esc49(r[2])+'</td></tr>';
      return '<tr><td class="col-no-v37">'+(i+1)+'</td><td>'+esc49(r.nama||"")+'</td><td>'+esc49(r.jabatan||"")+'</td><td>'+esc49(r.alamat||"")+'</td></tr>';
    }).join("");
    var tgl=safe49(p.tanggalTerima,"Semarang, ................. 2026");
    var pimpinan=esc49(p.pimpinan||safe49(m.ketua,".................."));
    var notulis=esc49(p.notulis||"..................");
    var body=
      '<div class="title">NOTULEN KEGIATAN OPERASIONAL</div>'+
      '<table class="no-border identity-table-v37"><tbody>'+
        '<tr><td>Jenis Kegiatan</td><td>:</td><td>'+esc49(p.jenis||"-")+'</td></tr>'+
        '<tr><td>Judul / Tema</td><td>:</td><td><b>'+esc49(p.nama||"-")+'</b></td></tr>'+
        '<tr><td>Hari / Tanggal</td><td>:</td><td>'+esc49(p.hariTanggal||"-")+'</td></tr>'+
        '<tr><td>Waktu</td><td>:</td><td>'+esc49(p.waktu||"-")+'</td></tr>'+
        '<tr><td>Tempat</td><td>:</td><td>'+esc49(p.tempat||"-")+'</td></tr>'+
        '<tr><td>Pimpinan</td><td>:</td><td>'+pimpinan+'</td></tr>'+
        '<tr><td>Notulis</td><td>:</td><td>'+notulis+'</td></tr>'+
        '<tr><td>Kehadiran</td><td>:</td><td>Hadir '+Number(p.hadir||0)+' orang, Tidak Hadir '+Number(p.tidakHadir||0)+' orang</td></tr>'+
      '</tbody></table>'+
      '<p><b>Agenda:</b><br>'+esc49(p.agenda||"-").replace(/\n/g,"<br>")+'</p>'+
      '<p><b>Pembahasan / Diskusi:</b><br>'+esc49(p.pembahasan||"-").replace(/\n/g,"<br>")+'</p>'+
      '<p><b>Hasil Keputusan:</b><br>'+esc49(p.keputusan||"-").replace(/\n/g,"<br>")+'</p>'+
      (actionRows?'<p><b>Rencana Tindak Lanjut / Action Plan:</b></p><table><thead><tr><th class="col-no-v37">No.</th><th>Task/Tugas</th><th>Target Waktu</th><th>PIC</th></tr></thead><tbody>'+actionRows+'</tbody></table>':'')+
      (p.rapatBerikutnya?'<p><b>Jadwal Kegiatan Berikutnya:</b> '+esc49(p.rapatBerikutnya)+'</p>':'')+
      (pesertaRows?'<p><b>Daftar Peserta:</b></p><table><thead><tr><th class="col-no-v37">No.</th><th>Nama</th><th>Jabatan/Status</th><th>Alamat/RT</th></tr></thead><tbody>'+pesertaRows+'</tbody></table>':'')+
      '<p>Demikian notulen ini dibuat sebagai bukti kelengkapan administrasi kegiatan operasional dan laporan pertanggungjawaban BOP RT '+esc49(rt)+' RW '+esc49(rw)+'.</p>'+
      '<table class="no-border sign-two-v37" style="margin-top:20px"><tbody><tr>'+
        '<td style="text-align:center">Mengetahui,<br>Pimpinan Kegiatan<br><div class="sign-space-v37"></div><b>'+pimpinan+'</b></td>'+
        '<td style="text-align:center">'+esc49(tgl)+'<br>Notulis,<br><div class="sign-space-v37"></div><b>'+notulis+'</b></td>'+
      '</tr></tbody></table>';
    return pkOfficial49(body);
  }

  function docPkKuitansiV49(){
    if(typeof collectPersiapan==="function") collectPersiapan();
    var m=m49(), p=p49();
    var rt=m.rt||"005", rw=m.rw||"012";
    var nominal=Number(p.nominal||0);
    var noKuit=safe49(p.nomorKuitansi,".../TT/RT"+rt+"/.../2026");
    var tgl=safe49(p.tanggalTerima,"Semarang, ................. 2026");
    var nikRow=p.nikPenerima?'<tr><td>NPWP / NIK Penerima</td><td>:</td><td>'+esc49(p.nikPenerima)+'</td></tr>':"";
    var pajakRow=p.pajak?'<tr><td>Keterangan Pajak</td><td>:</td><td>'+esc49(p.pajak)+'</td></tr>':"";
    var body=
      '<div class="title">TANDA TERIMA / KUITANSI</div>'+
      '<table class="no-border identity-table-v37"><tbody>'+
        '<tr><td>Nomor</td><td>:</td><td>'+esc49(noKuit)+'</td></tr>'+
        '<tr><td>Telah diterima dari</td><td>:</td><td>Ketua RT '+esc49(rt)+' RW '+esc49(rw)+' Kelurahan '+esc49(m.kelurahan||"Tegalsari")+'</td></tr>'+
        '<tr><td>Uang sebesar</td><td>:</td><td><b>'+rupiah49(nominal)+'</b></td></tr>'+
        '<tr><td>Terbilang</td><td>:</td><td>'+terbilang49(nominal)+' Rupiah</td></tr>'+
        '<tr><td>Untuk pembayaran</td><td>:</td><td>'+esc49(p.keperluan||"-")+'</td></tr>'+
        '<tr><td>Jenis kegiatan</td><td>:</td><td>'+esc49(p.jenis||"-")+'</td></tr>'+
        '<tr><td>Nama kegiatan</td><td>:</td><td>'+esc49(p.nama||"-")+'</td></tr>'+
        '<tr><td>Metode pembayaran</td><td>:</td><td>'+esc49(p.metode||"Tunai")+'</td></tr>'+
        nikRow+pajakRow+
      '</tbody></table>'+
      '<table class="no-border" style="width:100%;margin-top:20px"><tbody><tr>'+
        '<td style="text-align:center;width:34%;border:none">Yang Membayar<br>Ketua RT '+esc49(rt)+' RW '+esc49(rw)+'<br><div class="sign-space-v37"></div><b>'+esc49(safe49(m.ketua,"Nama Jelas"))+'</b></td>'+
        '<td style="text-align:center;width:32%;border:none">Mengetahui<br>Bendahara RT '+esc49(rt)+' RW '+esc49(rw)+'<br><div class="sign-space-v37"></div><b>'+esc49(safe49(m.bendahara,"Nama Jelas"))+'</b></td>'+
        '<td style="text-align:center;width:34%;border:none">'+esc49(tgl)+'<br>Yang Menerima,<br>'+esc49(p.jabatanPenerima||"Penerima")+' <br><div class="sign-space-v37"></div><b>'+esc49(p.penerima||"Nama Jelas")+'</b></td>'+
      '</tr></tbody></table>';
    return pkOfficial49(body);
  }

  /* ── Override global PK doc functions ── */
  window.docPkUndangan = docPkUndanganV49;
  window.docPkHadir    = docPkHadirV49;
  window.docPkNotulen  = docPkNotulenV49;
  window.docPkKuitansi = docPkKuitansiV49;

  /* ── Init ── */
  function init49(){
    injectPanel49();
    /* Re-render currently visible pk doc with new KOP V37 */
    if(typeof previewPkDoc==="function"){
      try{ previewPkDoc(window.currentPkDoc||"pk-hadir"); }catch(e){}
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", function(){ setTimeout(init49, 1700); });
  } else {
    setTimeout(init49, 1700);
  }

  console.log("[BOP v1.49] RAP Auto-Detect Panel + SPJ KOP V37 aktif.");
})();


/* ================================================================
   PATCH v1.48b — Fix RAP Bulanan: selector readable + docRapBulanan
   Masalah 1: v48RapBulanSel pakai class ds-doc-select-v43 (dark navy
              background) tapi berada di panel putih → teks putih
              tidak terlihat.
   Masalah 2: docRapBulanan (line 2394, global) pakai
              getMonthlyFlattenedRows yang butuh breakdown data.
              Jika breakdown kosong → "Belum ada rencana kegiatan".
   Masalah 3: change-event pada dsDocSelectV43 (v1.43B) langsung
              call previewDoc tanpa sync bulan dahulu.
   Fix:
     1. Inject CSS khusus #v48RapBulanSel → white bg + dark text
     2. Override window.docRapBulanan → pakai getMonthlyRapRows
     3. Clone dsDocSelectV43 & dsDocGenBtnV43 dengan handler baru
        yang selalu sync bulan sebelum render rapbulanan
   ================================================================ */
(function bopFixRapBulananV48b(){
  if(window.__bopFixRapBulananV48b) return;
  window.__bopFixRapBulananV48b = true;

  /* ── 1. CSS fix: selector bulan readable ── */
  function injectCss48b(){
    if(document.getElementById("css48b")) return;
    var s=document.createElement("style");
    s.id="css48b";
    s.textContent=
      '#v48RapBulanSel{'+
        'background:#fff!important;'+
        'color:#06142b!important;'+
        'border:1px solid #d9e2ee!important;'+
        'background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23334155\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")!important;'+
        'background-repeat:no-repeat!important;'+
        'background-position:right 10px center!important;'+
        'background-size:14px!important;'+
        'padding:8px 32px 8px 12px!important;'+
      '}'+
      '#v48RapBulanSel option{background:#fff!important;color:#06142b!important;}'+
      '#v48RapBulanWrap label{color:#667085!important;}';
    document.head.appendChild(s);
  }

  /* ── 2. Override window.docRapBulanan ── */
  window.docRapBulanan = function docRapBulananV48b(){
    /* Prioritas: v48RapBulanSel → monthlyDocMonth → data.selectedMonth */
    var v48sel=document.getElementById("v48RapBulanSel");
    var globalSel=document.getElementById("monthlyDocMonth");
    var month=(v48sel&&v48sel.value)||
              (globalSel&&globalSel.value)||
              (window.data&&window.data.pengajuan&&window.data.pengajuan.selectedMonth)||
              "Januari 2026";

    /* Sync ke semua sumber agar konsisten */
    try{
      if(window.data&&window.data.pengajuan) window.data.pengajuan.selectedMonth=month;
      if(globalSel) globalSel.value=month;
      if(v48sel&&v48sel.value!==month) v48sel.value=month;
    }catch(e){}

    /* Ambil baris dari getMonthlyRapRows (sederhana, tidak perlu breakdown) */
    var rows=[];
    try{ rows=getMonthlyRapRows(month); }catch(e){}
    var total=rows.reduce(function(s,r){return s+Number(r.jumlahBulanan||r.jumlah||0);},0);

    var m=(window.data&&window.data.master)||{};
    var p=(window.data&&window.data.pengajuan)||{};

    var rowsHtml=rows.length
      ? rows.map(function(r,i){
          var kat=esc(r.kategori||"");
          var sub=r.subKategori?(' &bull; '+esc(r.subKategori)):"";
          var tipe=r.tipe?(' | Tipe: '+esc(r.tipe)):"";
          return '<tr>'+
            '<td>'+(i+1)+'</td>'+
            '<td>'+esc(r.uraian||"")+'<br><small>'+kat+sub+tipe+'</small></td>'+
            '<td>'+esc(r.volume||"")+'</td>'+
            '<td class="money-cell-v37">'+rupiah(r.jumlahBulanan||r.jumlah||0)+'</td>'+
            '<td>'+esc(r.keterangan||"")+'</td>'+
          '</tr>';
        }).join("")
      : '<tr><td colspan="5" style="text-align:center;color:#888;font-style:italic">'+
          'Belum ada rencana kegiatan untuk bulan '+esc(month)+'.'+
          '</td></tr>';

    var body=
      '<div class="title">RENCANA ANGGARAN PENGGUNAAN BULANAN<br>'+
      'BANTUAN OPERASIONAL RT<br>'+
      'BULAN '+esc(month).toUpperCase()+'</div>'+
      '<table><thead><tr>'+
        '<th>No</th>'+
        '<th>Kegiatan / Tipe Operasional</th>'+
        '<th>Satuan/Volume Bulanan</th>'+
        '<th>Rencana Anggaran</th>'+
        '<th>Keterangan</th>'+
      '</tr></thead><tbody>'+
        rowsHtml+
        '<tr>'+
          '<td colspan="3"><b>Jumlah RAP Bulanan</b></td>'+
          '<td class="money-cell-v37"><b>'+rupiah(total)+'</b></td>'+
          '<td></td>'+
        '</tr>'+
      '</tbody></table>'+
      '<p style="text-align:right;margin-top:20px">Semarang, '+esc(month)+'</p>'+
      '<div class="ttd-4">'+
        '<div>Ketua RT '+(m.rt||"005")+'<div class="signature-space"></div>'+(m.ketua||"Nama Jelas")+'</div>'+
        '<div>Bendahara RT '+(m.rt||"005")+'<div class="signature-space"></div>'+(m.bendahara||"Nama Jelas")+'</div>'+
        '<div>Lurah '+(m.kelurahan||"Tegalsari")+'<div class="signature-space"></div>'+(p.namaLurah||"Nama Jelas")+'</div>'+
        '<div>Ketua RW '+(m.rw||"012")+'<div class="signature-space"></div>'+(p.namaKetuaRw||"Nama Jelas")+'</div>'+
      '</div>';

    if(typeof official==="function") return official(body);
    return '<div class="official">'+body+'</div>';
  };

  /* ── Helper: sync bulan dari v48RapBulanSel ke semua target ── */
  function syncRapBulan(){
    var v48sel=document.getElementById("v48RapBulanSel");
    var globalSel=document.getElementById("monthlyDocMonth");
    if(!v48sel) return;
    var month=v48sel.value;
    try{
      if(window.data&&window.data.pengajuan) window.data.pengajuan.selectedMonth=month;
      if(globalSel) globalSel.value=month;
    }catch(e){}
  }

  /* ── 3. Re-wire dsDocSelectV43 & dsDocGenBtnV43 ── */
  function rewireDocControls(){
    var origSel=document.getElementById("dsDocSelectV43");
    if(!origSel) return;

    /* Clone select untuk hapus semua listener lama */
    var newSel=origSel.cloneNode(true);
    origSel.parentNode.replaceChild(newSel, origSel);

    /* Toggle v48RapBulanWrap + sync month + preview on change */
    newSel.addEventListener("change", function(){
      var type=newSel.value;
      var wrap=document.getElementById("v48RapBulanWrap");
      if(wrap) wrap.style.display=(type==="rapbulanan")?"flex":"none";
      if(type==="rapbulanan") syncRapBulan();
      if(typeof previewDoc==="function") previewDoc(type);
    });

    /* Clone Generate button untuk hapus semua listener lama */
    var origBtn=document.getElementById("dsDocGenBtnV43");
    if(!origBtn) return;
    var newBtn=origBtn.cloneNode(true);
    origBtn.parentNode.replaceChild(newBtn, origBtn);

    newBtn.addEventListener("click", function(){
      var type=newSel.value;
      if(!type) return;
      if(type==="rapbulanan") syncRapBulan();
      if(typeof previewDoc==="function") previewDoc(type);
    });

    /* Juga wire v48RapBulanSel change → sync + auto-preview */
    var v48sel=document.getElementById("v48RapBulanSel");
    if(v48sel){
      v48sel.addEventListener("change", function(){
        syncRapBulan();
        if(newSel.value==="rapbulanan"){
          if(typeof previewDoc==="function") previewDoc("rapbulanan");
        }
      });
    }
  }

  function init48b(){
    injectCss48b();
    rewireDocControls();
    console.log("[BOP v1.48b] Fix RAP Bulanan selector + docRapBulanan aktif.");
  }

  if(document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",function(){setTimeout(init48b,2200);});
  else
    setTimeout(init48b,2200);
})();


/* ================================================================
   PATCH v1.49b — Fix RAP Auto-Detect: pakai getMonthlyRapRows v1.19
   Masalah: renderCardGrid49 pakai getRowsForMonth49 kustom yang
            cek r.bulan===month (format lama). Versi aktif app
            (v1.19) pakai monthsScheduledV19 + bulanMulai/bulanSelesai
            sehingga selalu kosong.
   Fix:
     1. Override renderCardGrid49 → pakai global getMonthlyRapRows
     2. Override _pkLoadRap49 → ambil jumlahBulanan dari monthly rows
     3. Patch activateTab agar re-render kartu saat masuk Persiapan
     4. Default month = data.pengajuan.selectedMonth (bulan aktif RAP)
   ================================================================ */
(function bopRapAutoDetectFixV49b(){
  if(window.__bopRapAutoDetectFixV49b) return;
  window.__bopRapAutoDetectFixV49b = true;

  /* ── Helpers ── */
  function esc49b(s){
    try{ if(typeof esc==="function") return esc(String(s==null?"":s)); }catch(e){}
    return String(s==null?"":s).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function rupiah49b(n){
    try{ if(typeof rupiah==="function") return rupiah(Number(n||0)); }catch(e){}
    return "Rp\u202f"+Number(n||0).toLocaleString("id-ID");
  }

  /* ── Ambil rows untuk bulan via getMonthlyRapRows global ── */
  function getRowsV49b(month){
    try{
      if(typeof getMonthlyRapRows==="function") return getMonthlyRapRows(month)||[];
    }catch(e){}
    return [];
  }

  /* ── Mapping tipe/kategori → pkJenis options ── */
  function mapJenis49b(r){
    var tipe=((r.tipe)||"").toLowerCase();
    var kat=((r.kategori)||"").toLowerCase();
    var sub=((r.subKategori)||"").toLowerCase();
    var ur=((r.uraian)||"").toLowerCase();
    if(tipe.indexOf("makan")>=0||tipe.indexOf("konsumsi")>=0) return "Konsumsi Rapat / Pertemuan Warga";
    if(tipe.indexOf("jasa")>=0||tipe.indexOf("tukang")>=0||tipe.indexOf("honor")>=0) return "Jasa Tukang / Pemeliharaan Sarpras";
    if(tipe.indexOf("sewa")>=0) return "Sewa Peralatan / Tempat";
    if(tipe.indexOf("barang")>=0||tipe.indexOf("material")>=0) return "Belanja Barang / Material";
    if(sub.indexOf("kerja bakti")>=0||sub.indexOf("gotong")>=0||ur.indexOf("kerja bakti")>=0||ur.indexOf("gotong")>=0) return "Kerja Bakti / Gotong Royong";
    if(sub.indexOf("hari besar")>=0||sub.indexOf("hut")>=0||ur.indexOf("hut ri")>=0||ur.indexOf("17 agustus")>=0) return "HUT RI / Kegiatan Sosial Budaya";
    if(sub.indexOf("sampah")>=0||ur.indexOf("sampah")>=0||kat.indexOf("sampah")>=0) return "Pengelolaan Sampah / Kebersihan Lingkungan";
    if(sub.indexOf("rapat")>=0||sub.indexOf("pertemuan")>=0||ur.indexOf("rapat")>=0||ur.indexOf("pertemuan")>=0) return "Konsumsi Rapat / Pertemuan Warga";
    if(kat.indexOf("penataan")>=0||kat.indexOf("lingkungan")>=0||kat.indexOf("pemeliharaan")>=0) return "Jasa Tukang / Pemeliharaan Sarpras";
    return "Lainnya";
  }

  function autoDocType49b(jenis){
    var j=(jenis||"").toLowerCase();
    if(j.indexOf("konsumsi")>=0||j.indexOf("rapat")>=0||j.indexOf("gotong")>=0||
       j.indexOf("hut")>=0||j.indexOf("sosial")>=0||j.indexOf("bakti")>=0) return "pk-undangan";
    return "pk-kuitansi";
  }

  function formHint49b(jenis){
    var j=(jenis||"").toLowerCase();
    if(j.indexOf("rapat")>=0||j.indexOf("konsumsi")>=0) return "&#128204; Tipe <b>Rapat/Pertemuan</b> \u2014 lengkapi tab <b>Notulen</b>, <b>Daftar Hadir</b>, dan nominal Kuitansi.";
    if(j.indexOf("sampah")>=0||j.indexOf("jasa")>=0||j.indexOf("tukang")>=0) return "&#128204; Tipe <b>Jasa/Honorarium</b> \u2014 lengkapi <b>Penerima</b>, <b>Nominal</b>, dan <b>Keperluan Pembayaran</b>.";
    if(j.indexOf("barang")>=0||j.indexOf("material")>=0||j.indexOf("sewa")>=0) return "&#128204; Tipe <b>Pengadaan/Belanja</b> \u2014 lengkapi <b>Deskripsi Barang</b> di Keperluan dan Nominal Kuitansi.";
    if(j.indexOf("gotong")>=0||j.indexOf("bakti")>=0) return "&#128204; Tipe <b>Gotong Royong</b> \u2014 lengkapi <b>Agenda</b> dan <b>Daftar Hadir</b> warga.";
    if(j.indexOf("hut")>=0||j.indexOf("sosial")>=0||j.indexOf("budaya")>=0) return "&#128204; Tipe <b>Kegiatan Sosial/Budaya</b> \u2014 lengkapi <b>Agenda</b>, <b>Notulen</b>, dan dokumentasi.";
    return "&#128204; Lengkapi data kegiatan di bawah, lalu generate dokumen di tab <b>Generate Bukti SPJ</b>.";
  }

  function katBadge49b(kategori){
    var k=(kategori||"").toLowerCase();
    if(k.indexOf("administratif")>=0||k.indexOf("administrasi")>=0) return {label:"Administratif",color:"#3b82f6"};
    if(k.indexOf("sosial")>=0||k.indexOf("budaya")>=0) return {label:"Sosial & Budaya",color:"#10b981"};
    if(k.indexOf("penataan")>=0||k.indexOf("lingkungan")>=0||k.indexOf("pemeliharaan")>=0) return {label:"Lingkungan",color:"#f59e0b"};
    return {label:"Operasional",color:"#6b7280"};
  }

  /* ── Render kartu: pakai getMonthlyRapRows global ── */
  window.renderCardGrid49 = function(month){
    var el=document.getElementById("pkRapCardGridV49");
    if(!el) return;
    var activeIdx=((window.data&&window.data.persiapan)||{}).rapAutoIdx;
    var rows=getRowsV49b(month);

    if(!rows.length){
      el.innerHTML='<div class="pk-rap-empty-v49">'+
        'Belum ada kegiatan terjadwal untuk bulan <b>'+esc49b(month)+'</b>.<br>'+
        '<small>Pastikan jadwal kegiatan sudah diatur di <b>Pengajuan Dana Operasional &rarr; RAP 1 Tahun</b> dengan bulan yang sesuai.</small>'+
      '</div>';
      return;
    }

    /* Group by kategori */
    var groups={};
    var groupOrder=[];
    rows.forEach(function(r){
      var k=r.kategori||"Lainnya";
      if(!groups[k]){ groups[k]=[]; groupOrder.push(k); }
      groups[k].push(r);
    });

    var html="";
    groupOrder.forEach(function(kat){
      var items=groups[kat];
      var badge=katBadge49b(kat);
      html+='<div class="pk-rap-kategori-v49">';
      html+='<div class="pk-rap-kat-label-v49" style="color:'+badge.color+'">'+esc49b(badge.label)+'</div>';
      html+='<div class="pk-rap-cards-row-v49">';
      items.forEach(function(r){
        var isActive=(r.annualIndex===activeIdx);
        var vol=r.volumeBulanan||r.volume||"";
        var sumber=r.sumber||"";
        html+='<div class="pk-rap-card-v49'+(isActive?" active":"")+'"'+
          ' onclick="window._pkLoadRap49('+r.annualIndex+',\''+esc49b(month)+'\')"'+
          ' title="'+esc49b(r.uraian)+'">';
        html+='<div class="pk-rap-card-nama-v49">'+esc49b(r.uraian)+'</div>';
        html+='<div class="pk-rap-card-meta-v49">'+esc49b(vol)+(sumber?' &bull; '+esc49b(sumber):'')+'</div>';
        html+='<div class="pk-rap-card-jumlah-v49">'+rupiah49b(r.jumlahBulanan||0)+'</div>';
        html+='</div>';
      });
      html+='</div></div>';
    });
    el.innerHTML=html;
  };

  /* ── Load kegiatan ke form ── */
  window._pkLoadRap49 = function(annualIndex, month){
    /* Cari row dari getMonthlyRapRows untuk bulan ini */
    var rows=getRowsV49b(month);
    var r=null;
    for(var i=0;i<rows.length;i++){
      if(rows[i].annualIndex===annualIndex){ r=rows[i]; break; }
    }
    /* Fallback: ambil langsung dari data.pengajuan.rap */
    if(!r){
      var rapArr=(window.data&&window.data.pengajuan&&Array.isArray(window.data.pengajuan.rap))?window.data.pengajuan.rap:[];
      var raw=rapArr[annualIndex];
      if(!raw) return;
      r=Object.assign({},{
        uraian:raw.uraian||"",
        volume:raw.volume||"1 Paket",
        jumlahBulanan:Number(raw.jumlah||0),
        jumlah:Number(raw.jumlah||0),
        keterangan:raw.keterangan||"",
        tipe:raw.tipe||"Lainnya",
        kategori:raw.kategori||"",
        subKategori:raw.subKategori||"",
        sumber:"Langsung",
        annualIndex:annualIndex
      });
    }

    var jenis=mapJenis49b(r);
    var vol=r.volumeBulanan||r.volume||"1 Paket";
    var agenda=r.keterangan
      ? r.uraian+". "+r.keterangan
      : "Pelaksanaan "+r.uraian+" dalam rangka kegiatan operasional RT 005 RW 012.";
    var keperluan="Pembayaran "+r.uraian+" ("+vol+") \u2014 Bulan "+month+
                  "."+(r.keterangan?" "+r.keterangan:" Sesuai mata belanja dalam RAP BOP RT.");

    /* Ensure persiapan ada */
    if(typeof ensurePersiapan==="function") ensurePersiapan();
    if(!window.data) return;
    if(!window.data.persiapan) window.data.persiapan={};

    /* Isi data.persiapan */
    window.data.persiapan.jenis     = jenis;
    window.data.persiapan.nama      = r.uraian||"Kegiatan Operasional RT";
    window.data.persiapan.agenda    = agenda;
    window.data.persiapan.keperluan = keperluan;
    window.data.persiapan.nominal   = r.jumlahBulanan||0;
    window.data.persiapan.rapAutoIdx   = annualIndex;
    window.data.persiapan.rapAutoMonth = month;

    /* Isi elemen form */
    if(typeof fillPersiapan==="function") fillPersiapan();

    /* Simpan */
    try{ localStorage.setItem("bop_rt005_data_v1_25",JSON.stringify(window.data)); }catch(e){}

    /* Update highlight kartu */
    window.renderCardGrid49(month);

    /* Update breadcrumb + hint */
    var badge=document.getElementById("pkActiveKegiatanBadgeV49");
    var name=document.getElementById("pkActiveKegiatanNameV49");
    var hint=document.getElementById("pkFormHintV49");
    if(badge) badge.style.display="flex";
    if(name) name.textContent=r.uraian;
    if(hint) hint.innerHTML=formHint49b(jenis);

    /* Navigasi ke pk-generate dan preview dokumen */
    if(typeof activateTab==="function") activateTab("pk-generate");
    setTimeout(function(){
      if(typeof collectPersiapan==="function") collectPersiapan();
      var docType=autoDocType49b(jenis);
      window.currentPkDoc=docType;
      if(typeof previewPkDoc==="function") previewPkDoc(docType);
    },100);
  };

  /* ── Re-render kartu saat navigasi ke Persiapan Kegiatan ── */
  (function patchActivateTabV49b(){
    var _origActivateTab = window.activateTab;
    window.activateTab = function(id){
      if(typeof _origActivateTab==="function") _origActivateTab(id);
      /* Saat user masuk ke halaman Persiapan Kegiatan */
      if(id==="persiapan"){
        setTimeout(function(){
          var panel=document.getElementById("pkRapAutoDetectPanel");
          if(!panel){
            /* Panel belum diinject — jalankan ulang inject */
            if(typeof injectPanel49==="function") injectPanel49();
          }
          /* Re-render kartu dengan bulan aktif */
          var sel=document.getElementById("pkRapMonthV49");
          var month=(sel&&sel.value)||
                    (window.data&&window.data.pengajuan&&window.data.pengajuan.selectedMonth)||
                    "Juni 2026";
          if(sel&&!sel.value) sel.value=month;
          window.renderCardGrid49(month);
          /* Restore breadcrumb jika ada active */
          var savedIdx=((window.data&&window.data.persiapan)||{}).rapAutoIdx;
          var savedMonth=((window.data&&window.data.persiapan)||{}).rapAutoMonth;
          if(savedIdx!==undefined&&savedMonth){
            var rows=getRowsV49b(savedMonth);
            var activeRow=null;
            for(var i=0;i<rows.length;i++){if(rows[i].annualIndex===savedIdx){activeRow=rows[i];break;}}
            if(!activeRow){
              var rapArr=(window.data&&window.data.pengajuan&&Array.isArray(window.data.pengajuan.rap))?window.data.pengajuan.rap:[];
              if(rapArr[savedIdx]) activeRow={uraian:rapArr[savedIdx].uraian||"",tipe:rapArr[savedIdx].tipe||""};
            }
            if(activeRow){
              var b=document.getElementById("pkActiveKegiatanBadgeV49");
              var n=document.getElementById("pkActiveKegiatanNameV49");
              var h=document.getElementById("pkFormHintV49");
              if(b) b.style.display="flex";
              if(n) n.textContent=activeRow.uraian;
              if(h) h.innerHTML=formHint49b(mapJenis49b(activeRow));
            }
          }
        },200);
      }
    };
  })();

  /* ── Patch month change handler ── */
  window._pkRapMonthChange49 = function(){
    var sel=document.getElementById("pkRapMonthV49");
    if(!sel) return;
    window.renderCardGrid49(sel.value);
  };

  /* ── Initial re-render jika panel sudah ada ── */
  function initV49b(){
    var panel=document.getElementById("pkRapAutoDetectPanel");
    if(panel){
      var sel=document.getElementById("pkRapMonthV49");
      var month=(sel&&sel.value)||
                (window.data&&window.data.pengajuan&&window.data.pengajuan.selectedMonth)||
                "Juni 2026";
      if(sel&&month) sel.value=month;
      window.renderCardGrid49(month);
    }
    console.log("[BOP v1.49b] RAP Auto-Detect fix aktif (getMonthlyRapRows v1.19).");
  }

  if(document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",function(){setTimeout(initV49b,2400);});
  else
    setTimeout(initV49b,2400);
})();


/* ================================================================
   PATCH v1.50 — Fix RAP Bulanan + Persiapan Kartu + Validasi Anggaran
   ================================================================
   Fix 1: Document Studio template cache override untuk rapbulanan
           → Hapus bop_rt005_ds_template_rapbulanan sebelum generate
           sehingga DS selalu tampilkan fresh content
   Fix 2: Persiapan Kegiatan panel — getRowsV49b dengan fallback
           langsung ke data.pengajuan.rap (support format lama)
   Fix 3: Validasi anggaran RAP Bulanan — warning panel di Generate
           Dokumen jika total bulan melebihi batas BOP tersedia
   ================================================================ */
(function bopFixComprehensiveV50(){
  if(window.__bopFixComprehensiveV50) return;
  window.__bopFixComprehensiveV50 = true;

  /* ═══════════════════════════════════════════════════════════
     FIX 1: HAPUS TEMPLATE CACHE rapbulanan SEBELUM GENERATE
  ═══════════════════════════════════════════════════════════ */
  var DS_TMPL_PREFIX = "bop_rt005_ds_template_";

  function clearRapBulananDsTemplate(){
    try{
      /* Via DocumentStudio public API jika tersedia */
      if(window.DocumentStudio && typeof window.DocumentStudio.tplDelete === "function"){
        window.DocumentStudio.tplDelete("rapbulanan");
      }
      /* Juga hapus langsung dari localStorage */
      localStorage.removeItem(DS_TMPL_PREFIX + "rapbulanan");
      localStorage.removeItem(DS_TMPL_PREFIX + "draft_rapbulanan");
    }catch(e){}
  }

  /* ═══════════════════════════════════════════════════════════
     FIX 2: getRowsV49b DENGAN FALLBACK MANUAL
  ═══════════════════════════════════════════════════════════ */
  var FULL_MONTHS = window.RAP_MONTHS ||
    ["Januari 2026","Februari 2026","Maret 2026","April 2026",
     "Mei 2026","Juni 2026","Juli 2026","Agustus 2026",
     "September 2026","Oktober 2026","November 2026","Desember 2026"];

  function getRowsV50(month){
    /* Coba getMonthlyRapRows global (v1.19 / v1.18) */
    var rows = [];
    try{ rows = getMonthlyRapRows(month) || []; }catch(e){}

    /* Fallback: iterasi langsung data.pengajuan.rap */
    if(!rows.length){
      var rap = (window.data && window.data.pengajuan && Array.isArray(window.data.pengajuan.rap))
                 ? window.data.pengajuan.rap : [];
      var curIdx = FULL_MONTHS.indexOf(month);

      rap.forEach(function(r, annualIndex){
        if(!r || !r.uraian) return;
        var jumlahBulanan = 0;
        var vol = r.volumeBulanan || r.volume || "1 Paket";
        var sumber = "";

        /* Format baru: bulanMulai – bulanSelesai */
        if(r.bulanMulai && r.bulanSelesai){
          var s = FULL_MONTHS.indexOf(r.bulanMulai);
          var e = FULL_MONTHS.indexOf(r.bulanSelesai);
          if(curIdx >= 0 && s >= 0 && e >= 0 && curIdx >= s && curIdx <= e){
            var cnt = Math.max(1, e - s + 1);
            jumlahBulanan = Math.round(Number(r.jumlah||0) / cnt);
            sumber = "Bulanan ("+cnt+" bln)";
          }
        }

        /* Format lama: bulan = bulan spesifik */
        if(!jumlahBulanan && r.bulan === month){
          jumlahBulanan = Number(r.jumlah||0);
          sumber = "Langsung";
        }

        /* Format lama: bulan = Januari-Desember (semua bulan) */
        if(!jumlahBulanan){
          var b = String(r.bulan||"");
          var isAllYear = b.indexOf("Januari")>=0 && b.indexOf("Desember")>=0;
          var isAllYearKey = b.indexOf("-")>0 && !b.match(/^\w+ \d{4}$/);
          if(isAllYear || isAllYearKey){
            jumlahBulanan = Math.round(Number(r.jumlah||0) / 12);
            sumber = "Rata 12 bln";
          }
        }

        if(jumlahBulanan > 0){
          rows.push(Object.assign({}, r, {
            annualIndex: annualIndex,
            jumlahBulanan: jumlahBulanan,
            volumeBulanan: vol,
            sumber: sumber
          }));
        }
      });
    }
    return rows;
  }
  window._getRowsV50 = getRowsV50; /* expose for tests */

  /* ═══════════════════════════════════════════════════════════
     PATCH renderCardGrid49 — pakai getRowsV50
  ═══════════════════════════════════════════════════════════ */
  function esc50(s){
    try{ if(typeof esc==="function") return esc(String(s==null?"":s)); }catch(e){}
    return String(s==null?"":s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function rp50(n){
    try{ if(typeof rupiah==="function") return rupiah(Number(n||0)); }catch(e){}
    return "Rp\u202f"+Number(n||0).toLocaleString("id-ID");
  }

  function katBadge50(r){
    var k = String(r.kategori||"").toLowerCase();
    if(k.indexOf("administratif")>=0||k.indexOf("administrasi")>=0) return {l:"Administratif",c:"#3b82f6"};
    if(k.indexOf("sosial")>=0||k.indexOf("budaya")>=0) return {l:"Sosial & Budaya",c:"#10b981"};
    if(k.indexOf("penataan")>=0||k.indexOf("lingkungan")>=0||k.indexOf("pemeliharaan")>=0) return {l:"Lingkungan",c:"#f59e0b"};
    if(k.indexOf("sampah")>=0) return {l:"Kebersihan",c:"#06b6d4"};
    return {l:"Operasional",c:"#6b7280"};
  }

  function mapJenis50(r){
    var tipe=String(r.tipe||"").toLowerCase();
    var kat=String(r.kategori||"").toLowerCase();
    var sub=String(r.subKategori||"").toLowerCase();
    var ur=String(r.uraian||"").toLowerCase();
    if(tipe.indexOf("makan")>=0||tipe.indexOf("konsumsi")>=0||sub.indexOf("rapat")>=0||ur.indexOf("rapat")>=0) return "Konsumsi Rapat / Pertemuan Warga";
    if(tipe.indexOf("jasa")>=0||tipe.indexOf("honor")>=0||tipe.indexOf("tukang")>=0) return "Jasa Tukang / Pemeliharaan Sarpras";
    if(tipe.indexOf("sewa")>=0) return "Sewa Peralatan / Tempat";
    if(tipe.indexOf("barang")>=0||tipe.indexOf("material")>=0) return "Belanja Barang / Material";
    if(sub.indexOf("kerja bakti")>=0||ur.indexOf("kerja bakti")>=0||sub.indexOf("gotong")>=0||ur.indexOf("gotong")>=0) return "Kerja Bakti / Gotong Royong";
    if(sub.indexOf("sampah")>=0||ur.indexOf("sampah")>=0) return "Pengelolaan Sampah / Kebersihan";
    if(kat.indexOf("penataan")>=0||kat.indexOf("lingkungan")>=0) return "Jasa Tukang / Pemeliharaan Sarpras";
    if(sub.indexOf("hari besar")>=0||ur.indexOf("hut")>=0||ur.indexOf("17 agustus")>=0) return "HUT RI / Kegiatan Sosial Budaya";
    return "Lainnya";
  }

  function formHint50(jenis){
    var j = jenis.toLowerCase();
    if(j.indexOf("rapat")>=0||j.indexOf("konsumsi")>=0) return "&#128204; Tipe <b>Rapat/Pertemuan</b> — lengkapi tab <b>Notulen</b>, <b>Daftar Hadir</b>, dan nominal Kuitansi.";
    if(j.indexOf("sampah")>=0||j.indexOf("jasa")>=0||j.indexOf("tukang")>=0) return "&#128204; Tipe <b>Jasa/Honorarium</b> — lengkapi <b>Penerima</b>, <b>Nominal</b>, dan <b>Keperluan</b>.";
    if(j.indexOf("barang")>=0||j.indexOf("material")>=0||j.indexOf("sewa")>=0) return "&#128204; Tipe <b>Pengadaan/Belanja</b> — lengkapi <b>Deskripsi Barang</b> dan Nominal Kuitansi.";
    if(j.indexOf("gotong")>=0||j.indexOf("bakti")>=0||j.indexOf("kebersihan")>=0) return "&#128204; Tipe <b>Gotong Royong</b> — lengkapi <b>Agenda</b> dan <b>Daftar Hadir</b> warga.";
    if(j.indexOf("hut")>=0||j.indexOf("sosial")>=0||j.indexOf("budaya")>=0) return "&#128204; Tipe <b>Kegiatan Sosial/Budaya</b> — lengkapi <b>Agenda</b>, <b>Notulen</b>, dan dokumentasi.";
    return "&#128204; Lengkapi data kegiatan di bawah, lalu generate dokumen di tab <b>Generate Bukti SPJ</b>.";
  }

  window.renderCardGrid49 = function(month){
    var el = document.getElementById("pkRapCardGridV49");
    if(!el) return;
    var activeIdx = ((window.data && window.data.persiapan)||{}).rapAutoIdx;
    var rows = getRowsV50(month);
    var totalItems = (window.data && window.data.pengajuan && Array.isArray(window.data.pengajuan.rap))
                      ? window.data.pengajuan.rap.filter(function(r){ return r && r.uraian; }).length : 0;

    if(!rows.length){
      el.innerHTML =
        '<div class="pk-rap-empty-v49">'+
        (totalItems > 0
          ? 'Tidak ada kegiatan terjadwal untuk bulan <b>'+esc50(month)+'</b>.<br>'+
            '<small>RAP berisi '+totalItems+' mata anggaran, namun tidak ada yang dijadwalkan bulan ini.<br>'+
            'Cek tab <b>Pengajuan → RAP 1 Tahun</b> dan pastikan rentang bulan mencakup '+esc50(month)+'.</small>'
          : 'Belum ada data RAP.<br><small>Buat RAP dulu di <b>Pengajuan Dana Operasional → RAP 1 Tahun</b>.</small>'
        )+
        '</div>';
      return;
    }

    /* Group by kategori */
    var groups = {}, order = [];
    rows.forEach(function(r){
      var k = r.kategori || "Lainnya";
      if(!groups[k]){ groups[k]=[]; order.push(k); }
      groups[k].push(r);
    });

    var html = "";
    order.forEach(function(kat){
      var items = groups[kat];
      var badge = katBadge50({kategori:kat});
      html += '<div class="pk-rap-kategori-v49">';
      html += '<div class="pk-rap-kat-label-v49" style="color:'+badge.c+'">'+esc50(badge.l)+'</div>';
      html += '<div class="pk-rap-cards-row-v49">';
      items.forEach(function(r){
        var isActive = (r.annualIndex === activeIdx);
        var vol = r.volumeBulanan || r.volume || "";
        var src = r.sumber ? (" &bull; "+esc50(r.sumber)) : "";
        html += '<div class="pk-rap-card-v49'+(isActive?" active":"")+'"'+
          ' onclick="window._pkLoadRap49('+r.annualIndex+',\''+esc50(month)+'\')"'+
          ' title="'+esc50(r.uraian)+'">';
        html += '<div class="pk-rap-card-nama-v49">'+esc50(r.uraian)+'</div>';
        html += '<div class="pk-rap-card-meta-v49">'+esc50(vol)+src+'</div>';
        html += '<div class="pk-rap-card-jumlah-v49">'+rp50(r.jumlahBulanan||0)+'</div>';
        html += '</div>';
      });
      html += '</div></div>';
    });
    el.innerHTML = html;
  };

  /* ─ Override _pkLoadRap49 pakai getRowsV50 ─ */
  window._pkLoadRap49 = function(annualIndex, month){
    var rows = getRowsV50(month);
    var r = null;
    for(var i=0;i<rows.length;i++){
      if(rows[i].annualIndex===annualIndex){ r=rows[i]; break; }
    }
    if(!r){
      var raw = (window.data&&window.data.pengajuan&&Array.isArray(window.data.pengajuan.rap))
                 ? window.data.pengajuan.rap[annualIndex] : null;
      if(!raw) return;
      r = Object.assign({},raw,{annualIndex:annualIndex,jumlahBulanan:Number(raw.jumlah||0),volumeBulanan:raw.volume||"1 Paket",sumber:"Langsung"});
    }

    var jenis = mapJenis50(r);
    var vol = r.volumeBulanan || r.volume || "1 Paket";
    var agenda = r.uraian + (r.keterangan ? ". " + r.keterangan : "") +
      ". Kegiatan operasional RT 005 RW 012 bulan "+month+".";
    var keperluan = "Pembayaran "+r.uraian+" ("+vol+") — Bulan "+month+
      ". "+(r.keterangan||"Sesuai mata belanja dalam RAP BOP RT.");

    if(typeof ensurePersiapan==="function") ensurePersiapan();
    if(!window.data || !window.data.persiapan) return;

    window.data.persiapan.jenis      = jenis;
    window.data.persiapan.nama       = r.uraian || "Kegiatan Operasional RT";
    window.data.persiapan.agenda     = agenda;
    window.data.persiapan.keperluan  = keperluan;
    window.data.persiapan.nominal    = r.jumlahBulanan || 0;
    window.data.persiapan.rapAutoIdx   = annualIndex;
    window.data.persiapan.rapAutoMonth = month;

    if(typeof fillPersiapan==="function") fillPersiapan();
    try{ localStorage.setItem("bop_rt005_data_v1_25",JSON.stringify(window.data)); }catch(e){}

    window.renderCardGrid49(month);

    var badge = document.getElementById("pkActiveKegiatanBadgeV49");
    var name  = document.getElementById("pkActiveKegiatanNameV49");
    var hint  = document.getElementById("pkFormHintV49");
    if(badge) badge.style.display="flex";
    if(name)  name.textContent = r.uraian;
    if(hint)  hint.innerHTML   = formHint50(jenis);

    if(typeof activateTab==="function") activateTab("pk-generate");
    setTimeout(function(){
      if(typeof collectPersiapan==="function") collectPersiapan();
      var dt = (jenis.indexOf("Rapat")>=0||jenis.indexOf("Gotong")>=0||jenis.indexOf("HUT")>=0)
               ? "pk-undangan" : "pk-kuitansi";
      window.currentPkDoc = dt;
      if(typeof previewPkDoc==="function") previewPkDoc(dt);
    }, 100);
  };

  /* ─ Patch activateTab untuk trigger renderCardGrid49 saat masuk Persiapan ─ */
  (function(){
    var _orig = window.activateTab;
    window.activateTab = function(id){
      if(typeof _orig==="function") _orig(id);
      if(id==="persiapan"){
        setTimeout(function(){
          var panel = document.getElementById("pkRapAutoDetectPanel");
          if(!panel && typeof injectPanel49==="function") injectPanel49();
          var sel = document.getElementById("pkRapMonthV49");
          var month = (sel&&sel.value)||
            (window.data&&window.data.pengajuan&&window.data.pengajuan.selectedMonth)||
            "Juni 2026";
          if(sel && FULL_MONTHS.indexOf(sel.value)<0) sel.value=month;
          window.renderCardGrid49(month||"Juni 2026");

          /* Restore active badge */
          var ai = ((window.data&&window.data.persiapan)||{}).rapAutoIdx;
          var am = ((window.data&&window.data.persiapan)||{}).rapAutoMonth;
          if(ai!==undefined&&am){
            var rs = getRowsV50(am), ar=null;
            for(var i=0;i<rs.length;i++){if(rs[i].annualIndex===ai){ar=rs[i];break;}}
            if(!ar){var rp2=(window.data&&window.data.pengajuan&&Array.isArray(window.data.pengajuan.rap))?window.data.pengajuan.rap:[];if(rp2[ai]) ar={uraian:rp2[ai].uraian||"",tipe:rp2[ai].tipe||""};}
            if(ar){
              var b2=document.getElementById("pkActiveKegiatanBadgeV49");
              var n2=document.getElementById("pkActiveKegiatanNameV49");
              var h2=document.getElementById("pkFormHintV49");
              if(b2) b2.style.display="flex";
              if(n2) n2.textContent=ar.uraian;
              if(h2) h2.innerHTML=formHint50(mapJenis50(ar));
            }
          }
        }, 200);
      }
    };
  })();

  /* ─ Patch month change ─ */
  window._pkRapMonthChange49 = function(){
    var s = document.getElementById("pkRapMonthV49");
    if(s) window.renderCardGrid49(s.value);
  };

  /* ═══════════════════════════════════════════════════════════
     FIX 3: VALIDASI ANGGARAN RAP BULANAN
  ═══════════════════════════════════════════════════════════ */
  var ANNUAL_LIMIT_BOP = 25000000; /* Rp 25 juta / tahun */
  var MONTHLY_LIMIT    = Math.round(ANNUAL_LIMIT_BOP / 12); /* ≈ Rp 2.083.333 */

  function getAnnualTotal(){
    try{
      var rap = (window.data&&window.data.pengajuan&&Array.isArray(window.data.pengajuan.rap))
                 ? window.data.pengajuan.rap : [];
      return rap.reduce(function(s,r){ return s+Number(r&&r.jumlah||0); }, 0);
    }catch(e){ return 0; }
  }

  function getMonthlyTotalV50(month){
    var rows = getRowsV50(month);
    return rows.reduce(function(s,r){ return s+Number(r.jumlahBulanan||0); }, 0);
  }

  function rp50f(n){ return "Rp\u202f"+Math.round(Number(n||0)).toLocaleString("id-ID"); }

  function renderValidationBanner(month){
    var el = document.getElementById("rapBulananValidationV50");
    if(!el) return;

    var monthly  = getMonthlyTotalV50(month);
    var annual   = getAnnualTotal();
    var annLimit = ANNUAL_LIMIT_BOP;
    var annSisa  = annLimit - annual;
    var pct      = annLimit > 0 ? Math.round(monthly / (annLimit/12) * 100) : 0;

    /* Tentukan status */
    var status, icon, barColor, borderColor, bgColor, msg;
    if(annual > annLimit){
      status = "danger";
      icon = "&#9888;&#65039;";
      barColor = "#ef4444";
      borderColor = "#fecaca";
      bgColor = "#fff1f2";
      msg = "Total RAP Tahunan <b>"+rp50f(annual)+"</b> melebihi batas BOP <b>"+rp50f(annLimit)+"</b>. "+
            "Kurangi mata anggaran sebesar <b>"+rp50f(annual-annLimit)+"</b>.";
    } else if(monthly > MONTHLY_LIMIT * 2){
      status = "warn";
      icon = "&#128308;";
      barColor = "#f59e0b";
      borderColor = "#fde68a";
      bgColor = "#fffbeb";
      msg = "Anggaran bulan <b>"+month+"</b> sebesar <b>"+rp50f(monthly)+"</b> jauh di atas rata-rata bulanan "+
            "(<b>"+rp50f(MONTHLY_LIMIT)+"</b>). Pastikan ini sesuai kebutuhan kegiatan.";
    } else if(monthly > 0){
      status = "ok";
      icon = "&#10003;";
      barColor = "#10b981";
      borderColor = "#a7f3d0";
      bgColor = "#f0fdf4";
      msg = "Anggaran bulan <b>"+month+"</b>: <b>"+rp50f(monthly)+"</b> — "+
            "Sisa BOP tahunan: <b>"+rp50f(annSisa)+"</b> dari total <b>"+rp50f(annLimit)+"</b>.";
    } else {
      status = "empty";
      icon = "&#8212;";
      barColor = "#d1d5db";
      borderColor = "#e5e7eb";
      bgColor = "#f9fafb";
      msg = "Belum ada mata anggaran terjadwal untuk bulan <b>"+month+"</b>.";
    }

    var barW = Math.min(100, pct)+"%";

    el.innerHTML =
      '<div style="background:'+bgColor+';border:1px solid '+borderColor+';border-radius:10px;padding:12px 14px;margin-top:8px;font-size:0.85rem;">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'+
        '<span style="font-size:1.1rem;">'+icon+'</span>'+
        '<span style="font-weight:700;color:'+barColor+'">Validasi Anggaran RAP Bulanan</span>'+
        '<span style="margin-left:auto;font-size:0.78rem;color:#64748b;">BOP Tahunan: '+rp50f(annLimit)+'</span>'+
      '</div>'+
      '<div style="background:#e5e7eb;border-radius:4px;height:6px;margin-bottom:8px;overflow:hidden;">'+
        '<div style="width:'+barW+';background:'+barColor+';height:100%;border-radius:4px;transition:width 0.4s;"></div>'+
      '</div>'+
      '<p style="margin:0;color:#374151;line-height:1.5;">'+msg+'</p>'+
      (status==="danger" ? '<p style="margin:6px 0 0;color:#dc2626;font-size:0.8rem;font-weight:600;">&#9888; Dokumen RAP tidak dapat diajukan jika total melebihi batas BOP. Harap revisi RAP tahunan.</p>' : '')+
      (status==="warn"   ? '<p style="margin:6px 0 0;color:#92400e;font-size:0.8rem;">&#128161; Tips: pastikan kegiatan besar tersebar merata atau ada justifikasi khusus untuk bulan ini.</p>' : '')+
      '</div>';

    el.style.display = "block";
  }

  function hideValidationBanner(){
    var el = document.getElementById("rapBulananValidationV50");
    if(el) el.style.display = "none";
  }

  /* ─ Inject container validasi ─ */
  function injectValidationContainer(){
    if(document.getElementById("rapBulananValidationV50")) return;
    var wrap = document.getElementById("v48RapBulanWrap");
    if(!wrap) return;
    var el = document.createElement("div");
    el.id = "rapBulananValidationV50";
    el.style.cssText = "display:none;";
    wrap.insertAdjacentElement("afterend", el);
  }

  /* ═══════════════════════════════════════════════════════════
     HOOK: INTERCEPT previewDoc UNTUK rapbulanan
  ═══════════════════════════════════════════════════════════ */
  (function hookPreviewDocV50(){
    var _prev = window.previewDoc;
    window.previewDoc = function(type){
      if(type === "rapbulanan"){
        /* 1. Hapus DS template cache supaya fresh content tampil */
        clearRapBulananDsTemplate();

        /* 2. Sync bulan dari v48RapBulanSel */
        var v48sel = document.getElementById("v48RapBulanSel");
        var gsel   = document.getElementById("monthlyDocMonth");
        var month  = (v48sel&&v48sel.value) || (gsel&&gsel.value) ||
                     (window.data&&window.data.pengajuan&&window.data.pengajuan.selectedMonth) ||
                     "Januari 2026";
        if(window.data&&window.data.pengajuan) window.data.pengajuan.selectedMonth = month;
        if(gsel) gsel.value = month;
        if(v48sel&&v48sel.value!==month) v48sel.value = month;

        /* 3. Tampilkan validasi */
        injectValidationContainer();
        renderValidationBanner(month);

        /* 4. Show bulan wrap */
        var wrap = document.getElementById("v48RapBulanWrap");
        if(wrap) wrap.style.display = "flex";
      } else {
        hideValidationBanner();
      }
      if(typeof _prev==="function") _prev(type);
    };
  })();

  /* Juga hook dsDocSelectV43 change untuk show/hide validasi */
  function patchDocSelForValidation(){
    var origSel = document.getElementById("dsDocSelectV43");
    if(!origSel) return;
    var newSel = origSel.cloneNode(true);
    origSel.parentNode.replaceChild(newSel, origSel);
    newSel.addEventListener("change", function(){
      if(typeof window.previewDoc==="function") window.previewDoc(newSel.value);
    });
    /* Patch generate button */
    var origBtn = document.getElementById("dsDocGenBtnV43");
    if(!origBtn) return;
    var newBtn = origBtn.cloneNode(true);
    origBtn.parentNode.replaceChild(newBtn, origBtn);
    newBtn.addEventListener("click", function(){
      var t = newSel.value;
      if(!t) return;
      if(typeof window.previewDoc==="function") window.previewDoc(t);
    });
    /* Wire v48RapBulanSel change */
    var msel = document.getElementById("v48RapBulanSel");
    if(msel){
      msel.addEventListener("change", function(){
        if(newSel.value==="rapbulanan"){
          if(typeof window.previewDoc==="function") window.previewDoc("rapbulanan");
        }
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════ */
  function initV50(){
    injectValidationContainer();
    patchDocSelForValidation();

    /* Re-render panel persiapan jika sudah terbuka */
    var panel = document.getElementById("pkRapAutoDetectPanel");
    if(panel){
      var sel = document.getElementById("pkRapMonthV49");
      var month = (sel&&sel.value)||
                  (window.data&&window.data.pengajuan&&window.data.pengajuan.selectedMonth)||
                  "Juni 2026";
      window.renderCardGrid49(month);
    }

    /* Jika rapbulanan sedang ditampilkan, refresh */
    if(window.currentDoc === "rapbulanan"){
      if(typeof window.previewDoc==="function") window.previewDoc("rapbulanan");
    }

    console.log("[BOP v1.50] Fix DS-cache + Persiapan fallback + Validasi Anggaran aktif.");
  }

  if(document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",function(){ setTimeout(initV50,2600); });
  else
    setTimeout(initV50,2600);
})();


/* ═══════════════════════════════════════════════════════════════
   PATCH v1.52 - Fix RAP Bulanan: getMonthlyRapRows definitif
═══════════════════════════════════════════════════════════════ */
(function bopFixRapBulananV52(){
  if(window.__bopFixRapBulananV52) return;
  window.__bopFixRapBulananV52 = true;

  var MONTHS = [
    "Januari 2026","Februari 2026","Maret 2026","April 2026",
    "Mei 2026","Juni 2026","Juli 2026","Agustus 2026",
    "September 2026","Oktober 2026","November 2026","Desember 2026"
  ];

  function getData(){ return (typeof window.data!=="undefined"&&window.data)||{}; }
  function getRap(){
    var d=getData();
    return (d.pengajuan&&Array.isArray(d.pengajuan.rap))?d.pengajuan.rap:[];
  }
  function getMonth(){
    var sel=document.getElementById("monthlyDocMonth");
    if(sel&&sel.value&&MONTHS.indexOf(sel.value)>=0) return sel.value;
    var v48=document.getElementById("v48RapBulanSel");
    if(v48&&v48.value&&MONTHS.indexOf(v48.value)>=0) return v48.value;
    var d=getData();
    if(d.pengajuan&&d.pengajuan.selectedMonth&&MONTHS.indexOf(d.pengajuan.selectedMonth)>=0)
      return d.pengajuan.selectedMonth;
    return "Januari 2026";
  }

  function getMonthlyRapRowsFinal(month){
    if(!month||MONTHS.indexOf(month)<0) month=getMonth();
    var curIdx=MONTHS.indexOf(month);
    var rows=[];
    getRap().forEach(function(r,origIdx){
      if(!r||!r.uraian) return;
      var jumlahBulanan=0;
      var vol=r.volumeBulanan||r.volume||"1 Paket";
      var sumber="";

      if(r.bulanMulai&&r.bulanSelesai){
        var s=MONTHS.indexOf(r.bulanMulai);
        var e=MONTHS.indexOf(r.bulanSelesai);
        if(s>=0&&e>=s&&curIdx>=s&&curIdx<=e){
          var cnt=e-s+1;
          jumlahBulanan=Math.round(Number(r.jumlah||0)/cnt);
          sumber="Range "+r.bulanMulai+"-"+r.bulanSelesai;
        }
      }
      if(!jumlahBulanan&&r.bulan&&r.bulan===month){
        jumlahBulanan=Number(r.jumlah||0);
        sumber="Langsung";
      }
      if(!jumlahBulanan&&(!r.bulan||r.bulan===""||r.bulan==="Semua Bulan"||r.bulan==="ALL")){
        jumlahBulanan=Math.round(Number(r.jumlah||0)/12);
        sumber="Bagi rata 12 bln";
      }
      if(!jumlahBulanan&&typeof RAP_MONTH_ALL!=="undefined"&&r.bulan===RAP_MONTH_ALL){
        jumlahBulanan=Math.round(Number(r.jumlah||0)/MONTHS.length);
        sumber="Bagi rata";
      }
      if(jumlahBulanan>0){
        rows.push({
          uraian:r.uraian||"",kategori:r.kategori||"Operasional",
          subKategori:r.subKategori||"",tipe:r.tipe||"",
          volume:vol,volumeBulanan:vol,
          jumlah:Number(r.jumlah||0),jumlahBulanan:jumlahBulanan,
          keterangan:r.keterangan||"",bulan:r.bulan||"",
          bulanMulai:r.bulanMulai||"",bulanSelesai:r.bulanSelesai||"",
          sumber:sumber,annualIndex:origIdx
        });
      }
    });
    return rows;
  }

  window.getMonthlyRapRows = getMonthlyRapRowsFinal;
  window.monthlyTotal = function(month){
    return getMonthlyRapRowsFinal(month).reduce(function(s,r){
      return s+Number(r.jumlahBulanan||0);
    },0);
  };

  function _rp(n){ return typeof rupiah==="function"?rupiah(n):"Rp"+Number(n||0).toLocaleString("id-ID"); }
  function _esc(s){ return typeof esc==="function"?esc(s):String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function _terbilang(n){ return typeof terbilang==="function"?terbilang(n):String(n); }
  function _official(body){
    if(typeof officialWrap46==="function") return officialWrap46(body);
    if(typeof official==="function") return official(body);
    return body;
  }

  window.docRapBulanan = function(){
    var month=getMonth();
    var d=getData();
    if(d.pengajuan) d.pengajuan.selectedMonth=month;
    try{ localStorage.removeItem("bop_rt005_ds_template_rapbulanan"); }catch(e){}

    var rows=getMonthlyRapRowsFinal(month);
    var total=rows.reduce(function(s,r){ return s+Number(r.jumlahBulanan||0); },0);
    var m=d.master||{};

    var tbody="";
    if(rows.length){
      rows.forEach(function(r,i){
        tbody+="<tr><td>"+(i+1)+"</td><td>"+_esc(r.uraian)+
          "<br><small>"+_esc(r.kategori)+" - "+_esc(r.subKategori)+
          "<br>Tipe: "+_esc(r.tipe)+" | Sumber: "+_esc(r.sumber)+"</small></td>"+
          "<td>"+_esc(r.volume)+"</td><td>"+_rp(r.jumlahBulanan)+"</td>"+
          "<td>"+_esc(r.keterangan)+"</td></tr>";
      });
    } else {
      tbody="<tr><td colspan='5' style='text-align:center;color:#888'>"+
            "Belum ada rencana kegiatan untuk bulan "+_esc(month)+".</td></tr>";
    }

    var tgl=d.pengajuan&&d.pengajuan.tanggalSurat
      ? d.pengajuan.tanggalSurat
      : "Semarang, _______________";

    return _official(
      "<div class='title'>RENCANA ANGGARAN PENGGUNAAN BULANAN<br>"+
      "BANTUAN OPERASIONAL RT<br>BULAN "+_esc(month).toUpperCase()+"</div>"+
      "<table><thead><tr><th>No</th><th>Uraian Kegiatan</th>"+
      "<th>Satuan/Volume</th><th>Rencana Anggaran</th><th>Keterangan</th></tr></thead>"+
      "<tbody>"+tbody+
      "<tr><td colspan='3'><b>Jumlah</b></td><td><b>"+_rp(total)+"</b></td><td></td></tr>"+
      "</tbody></table>"+
      "<p style='text-align:right;margin-top:20px'>"+_esc(tgl)+"</p>"+
      "<div class='ttd-4'>"+
      "<div>Ketua RT "+_esc(m.rt||"")+"<div class='signature-space'></div>"+_esc(m.ketua||"Nama Jelas")+"</div>"+
      "<div>Bendahara RT "+_esc(m.rt||"")+"<div class='signature-space'></div>"+_esc(m.bendahara||"Nama Jelas")+"</div>"+
      "<div>Lurah "+_esc(m.kelurahan||"")+"<div class='signature-space'></div>"+
        _esc((d.pengajuan&&d.pengajuan.namaLurah)||"Nama Jelas")+"</div>"+
      "<div>Ketua RW "+_esc(m.rw||"")+"<div class='signature-space'></div>"+
        _esc((d.pengajuan&&d.pengajuan.namaKetuaRw)||"Nama Jelas")+"</div>"+
      "</div>"
    );
  };

  window.docRbb = function(){
    var month=getMonth();
    var d=getData();
    if(d.pengajuan) d.pengajuan.selectedMonth=month;
    var rows=getMonthlyRapRowsFinal(month);
    var total=rows.reduce(function(s,r){ return s+Number(r.jumlahBulanan||0); },0);
    var m=d.master||{};
    var tbody="";
    if(rows.length){
      rows.forEach(function(r,i){
        tbody+="<tr><td>"+(i+1)+"</td><td>"+_esc(r.uraian)+"</td>"+
          "<td>"+_esc(r.volume)+"</td><td>"+_rp(r.jumlahBulanan)+"</td>"+
          "<td>"+_esc(r.keterangan)+"</td></tr>";
      });
    } else {
      tbody="<tr><td colspan='5' style='text-align:center;color:#888'>Belum ada kegiatan bulan ini.</td></tr>";
    }
    return _official(
      "<div class='title'>Pengambilan Operasional RT<br>Melalui Bank Jawa Tengah</div>"+
      "<table class='no-border'>"+
      "<tr><td style='width:160px'>Nama Lembaga</td><td>: RT "+_esc(m.rt||"")+" RW "+_esc(m.rw||"")+"</td></tr>"+
      "<tr><td>Kelurahan</td><td>: "+_esc(m.kelurahan||"")+"</td></tr>"+
      "<tr><td>Kecamatan</td><td>: "+_esc(m.kecamatan||"")+"</td></tr>"+
      "<tr><td>Untuk Kegiatan Bulan</td><td>: "+_esc(month)+"</td></tr>"+
      "</table><br>"+
      "<table><thead><tr><th>No.</th><th>Uraian Kegiatan</th>"+
      "<th>Satuan/Volume</th><th>Anggaran</th><th>Keterangan</th></tr></thead>"+
      "<tbody>"+tbody+
      "<tr><td colspan='3'><b>Jumlah</b></td><td><b>"+_rp(total)+"</b></td><td></td></tr>"+
      "</tbody></table>"+
      "<p>Terbilang: <i>"+_terbilang(total)+" Rupiah</i></p>"+
      "<div class='ttd-3'>"+
      "<div>Yang Mengambil<br>Ketua RT "+_esc(m.rt||"")+" RW "+_esc(m.rw||"")+
        "<div class='signature-space'></div>"+_esc(m.ketua||"Nama Jelas")+"</div>"+
      "<div>Bendahara<div class='signature-space'></div>"+_esc(m.bendahara||"Nama Jelas")+"</div>"+
      "<div>Mengetahui<br>Lurah "+_esc(m.kelurahan||"")+
        "<div class='signature-space'></div>"+
        _esc((d.pengajuan&&d.pengajuan.namaLurah)||"Nama Jelas")+"</div>"+
      "</div>"
    );
  };

  function initV52(){
    var sel=document.getElementById("monthlyDocMonth");
    var v48=document.getElementById("v48RapBulanSel");
    var d=getData();
    var cur=(d.pengajuan&&d.pengajuan.selectedMonth)||"Januari 2026";
    if(sel&&!sel.value) sel.value=cur;
    if(v48&&!v48.value) v48.value=cur;
    if(sel&&!sel.__v52){
      sel.__v52=true;
      sel.addEventListener("change",function(){
        if(v48) v48.value=sel.value;
        var d2=getData(); if(d2.pengajuan) d2.pengajuan.selectedMonth=sel.value;
        if(typeof window.previewDoc==="function") window.previewDoc("rapbulanan");
      });
    }
    if(v48&&!v48.__v52){
      v48.__v52=true;
      v48.addEventListener("change",function(){
        if(sel) sel.value=v48.value;
        var d2=getData(); if(d2.pengajuan) d2.pengajuan.selectedMonth=v48.value;
        if(typeof window.previewDoc==="function") window.previewDoc("rapbulanan");
      });
    }
    console.log("[BOP v1.52] RAP Bulanan fix aktif");
  }

  if(document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",function(){ setTimeout(initV52,3000); });
  else
    setTimeout(initV52,3000);
})();
/* END PATCH v1.52 */


/* ═══════════════════════════════════════════════════════════════
   PATCH v1.53 - Fix docMapV37: hadir/sk/rekening pakai window.*
   docHadirV46/docSKV46/docRekeningV46 sudah di-set ke window.*
   tapi docMapV37() dipanggil sebelum override selesai.
   Solusi: override docMapV37 agar selalu baca window.docHadir dll
═══════════════════════════════════════════════════════════════ */
(function bopFixDocMapV53(){
  if(window.__bopFixDocMapV53) return;
  window.__bopFixDocMapV53 = true;

  var _origDocMapV37 = window.docMapV37;

  window.docMapV37 = function(){
    var base = (typeof _origDocMapV37 === "function") ? _origDocMapV37() : {};
    /* Override dengan window.* yang sudah di-patch V46 */
    if(typeof window.docHadir    === "function") base.hadir    = window.docHadir;
    if(typeof window.docSK       === "function") base.sk       = window.docSK;
    if(typeof window.docRekening === "function") base.rekening = window.docRekening;
    if(typeof window.docRapBulanan === "function") base.rapbulanan = window.docRapBulanan;
    if(typeof window.docRbb      === "function") base.rbb      = window.docRbb;
    if(typeof window.docUndangan === "function") base.undangan = window.docUndangan;
    if(typeof window.docNotulen  === "function") base.notulen  = window.docNotulen;
    return base;
  };

  /* Patch juga previewDocV37 agar pakai docMapV37 terbaru */
  var _origPreview = window.previewDoc;
  window.previewDoc = function(type){
    /* collectAll dulu */
    try{ if(typeof collectAll==="function") collectAll(); }catch(e){}

    var nextType = type || window.currentDoc || "permohonan";
    window.currentDoc = nextType;
    try{ currentDoc = nextType; }catch(e){}

    /* Update active button */
    document.querySelectorAll(".doc-btn").forEach(function(b){
      b.classList.toggle("active", b.dataset.doc === nextType);
    });

    /* Pakai docMapV37 yang sudah di-patch */
    var map = window.docMapV37();
    var fn  = map[nextType];
    if(typeof fn !== "function"){
      /* Fallback ke original preview */
      if(typeof _origPreview === "function"){
        _origPreview(type); return;
      }
      fn = map["permohonan"];
    }

    var out = document.getElementById("docOutput");
    if(out){
      try{ out.innerHTML = fn(); }
      catch(e){
        console.error("[BOP v1.53] Error render", nextType, e);
        out.innerHTML = "<p style='color:red'>Error: "+e.message+"</p>";
      }
    }
  };

  console.log("[BOP v1.53] docMapV37 fix aktif - hadir/sk/rekening pakai window.*");
})();
/* END PATCH v1.53 */
