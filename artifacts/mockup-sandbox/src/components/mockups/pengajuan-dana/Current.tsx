import "./_group.css";
import {
  CircleHelp,
  FileCheck2,
  Landmark,
  Save,
  ShieldCheck,
} from "lucide-react";

const tabs = [
  "Data Pengajuan",
  "RAP 1 Tahun",
  "RAP Bulanan Otomatis",
  "BA & Daftar Hadir RAP",
  "Undangan & Notulen RAP",
  "Generate 7 Dokumen",
  "Riwayat",
  "Pengambilan Bank",
];

const documents = [
  ["Surat Permohonan Pencairan", "Surat permohonan kepada Lurah"],
  ["RAP BOP RT 1 Tahun", "Rencana anggaran tahunan"],
  ["RAP Bulanan", "RAP bulan terpilih"],
  ["Berita Acara RAP", "BA kesepakatan RAP"],
  ["Daftar Hadir RAP", "Peserta rapat RAP"],
  ["SPTJM", "Surat pernyataan tanggung jawab"],
  ["RBB / Pengambilan Operasional", "Pengambilan operasional Bank Jateng"],
];

function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="bop-mockup-shell">
      <aside className="bop-side">
        <div className="bop-brand">
          <div className="bop-brand-mark">RT<br />005</div>
          <div>
            <strong>LaKu Warga</strong>
            <small>PELAYANAN RT ONLINE</small>
          </div>
        </div>
        <nav className="bop-side-nav" aria-label="Menu utama">
          <div>BOP Dashboard</div>
          <div className="selected">Pengajuan Dana Operasional</div>
          <div>Persiapan Kegiatan</div>
          <div>Laporan Pertanggungjawaban</div>
          <div>MoKu Mobile</div>
          <div>Monitoring Administrasi</div>
          <div>Setting</div>
        </nav>
      </aside>
      <main className="bop-main">
        <header className="bop-topbar">
          <div className="bop-topbar-left">
            <ShieldCheck size={17} color="#c99127" />
            <strong>RT 005 RW 012</strong>
            <span>Tegalsari, Candisari, Kota Semarang</span>
          </div>
          <div className="bop-topbar-right">
            <span>Rabu, 02 September 2026</span>
            <span className="bop-online">Online Mode</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export function Current() {
  return (
    <div className="bop-mockup current">
      <AppChrome>
        <div className="bop-content">
          <div className="bop-page-heading">
            <div>
              <span className="bop-eyebrow">BOP ADMINISTRASI · TAHUN ANGGARAN 2026</span>
              <h1>Pengajuan Dana Operasional</h1>
              <p>Semua 7 syarat pengajuan dibuat dan dikelola dalam satu menu.</p>
            </div>
            <div className="bop-heading-actions">
              <span className="bop-save-state">Tersimpan di perangkat</span>
              <button className="bop-button primary" type="button">
                <Save size={14} /> Simpan Pengajuan
              </button>
            </div>
          </div>

          <div className="bop-subnav" role="tablist" aria-label="Menu pengajuan">
            {tabs.map((tab, index) => (
              <button className={index === 0 ? "active" : ""} key={tab} type="button">
                {tab}
              </button>
            ))}
          </div>

          <div className="bop-guide">
            <div className="bop-guide-item">
              <strong>1. Data Pengajuan</strong>
              <span>Surat, rekening, Lurah, dan Ketua RW.</span>
            </div>
            <div className="bop-guide-item">
              <strong>2. RAP & RAP Bulanan</strong>
              <span>RAP 1 tahun dan breakdown bulanan.</span>
            </div>
            <div className="bop-guide-item">
              <strong>3. BA & Daftar Hadir</strong>
              <span>Berita acara dan peserta rapat.</span>
            </div>
            <div className="bop-guide-item">
              <strong>4. Undangan & Notulen</strong>
              <span>Setting undangan dan notulen RAP.</span>
            </div>
          </div>

          <div className="bop-grid-current">
            <div className="bop-stack">
              <section className="bop-panel">
                <div className="bop-panel-head">
                  <div>
                    <h2>Data Surat Permohonan & Rekening</h2>
                    <p className="bop-panel-sub">Lengkapi data yang akan dipakai ke dalam dokumen resmi.</p>
                  </div>
                </div>
                <div className="bop-form">
                  <label className="bop-field">
                    Nomor Surat
                    <input placeholder=".../RT005/VII/2026" />
                  </label>
                  <label className="bop-field">
                    Tanggal Surat
                    <input defaultValue="Semarang, 01 Juli 2026" />
                  </label>
                  <label className="bop-field">
                    Sifat
                    <input defaultValue="Segera" />
                  </label>
                  <label className="bop-field">
                    Lampiran
                    <input defaultValue="1 (satu) berkas" />
                  </label>
                  <label className="bop-field">
                    Nama Rekening Bank Jateng
                    <input placeholder="Nama rekening RT" />
                  </label>
                  <label className="bop-field">
                    Nama Lurah
                    <input placeholder="Nama Lurah Tegalsari" />
                  </label>
                  <label className="bop-field full">
                    Nama Ketua RW
                    <input placeholder="Nama Ketua RW 012" />
                  </label>
                </div>
              </section>

              <section className="bop-panel">
                <div className="bop-panel-head">
                  <div>
                    <h2>Checklist 7 Syarat</h2>
                    <p className="bop-panel-sub">Centang dokumen yang sudah tersedia.</p>
                  </div>
                  <FileCheck2 size={18} color="#7c8ea7" />
                </div>
                <div className="bop-check-grid">
                  {documents.map(([name, description]) => (
                    <label className="bop-check-card" key={name}>
                      <input type="checkbox" />
                      <span>
                        <strong>{name}</strong>
                        <span>{description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            </div>

            <aside className="bop-aside">
              <span className="bop-aside-kicker">PROGRES PENGAJUAN</span>
              <h2>Siap untuk dilengkapi</h2>
              <div className="bop-progress-card">
                <div className="bop-progress-head">
                  <span>Kelengkapan dokumen</span>
                  <strong>0 / 7</strong>
                </div>
                <div className="bop-progress-track"><span /></div>
                <p>Centang dokumen yang sudah tersedia. Status tersimpan otomatis di perangkat.</p>
              </div>
              <span className="bop-flow-label">ALUR PENGAJUAN</span>
              <div className="bop-flow">
                <div className="bop-flow-item active">
                  <span>01</span>
                  <div><strong>Data pengajuan</strong><small>Surat, rekening, dan pejabat terkait</small></div>
                </div>
                <div className="bop-flow-item">
                  <span>02</span>
                  <div><strong>RAP & jadwal</strong><small>Rencana anggaran satu tahun</small></div>
                </div>
                <div className="bop-flow-item">
                  <span>03</span>
                  <div><strong>Rapat & dokumen</strong><small>BA, hadir, dan berkas resmi</small></div>
                </div>
              </div>
              <div className="bop-tip">
                <span><CircleHelp size={12} /></span>
                <p><strong>Tips pengisian</strong><br />Lengkapi data surat dan rekening terlebih dahulu agar dokumen resmi dapat dibuat tanpa input ulang.</p>
              </div>
            </aside>
          </div>
        </div>
      </AppChrome>
    </div>
  );
}