import { useMemo, useState } from "react";
import "./_group.css";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileCheck2,
  Landmark,
  Save,
  ShieldCheck,
} from "lucide-react";

const steps = [
  ["Data Pengajuan", "Identitas & rekening"],
  ["Rencana Anggaran", "RAP dan jadwal"],
  ["Kelengkapan Dokumen", "7 dokumen resmi"],
  ["Tinjau & Ajukan", "Pemeriksaan akhir"],
];

const docs = [
  ["Surat Permohonan Pencairan", "Surat permohonan kepada Lurah"],
  ["RAP BOP RT 1 Tahun", "Rencana anggaran tahunan"],
  ["RAP Bulanan", "RAP bulan terpilih"],
  ["Berita Acara RAP", "BA kesepakatan RAP"],
  ["Daftar Hadir RAP", "Peserta rapat RAP"],
  ["SPTJM", "Surat pernyataan tanggung jawab"],
  ["RBB / Pengambilan Operasional", "Pengambilan operasional Bank Jateng"],
];

function Chrome({ children }: { children: React.ReactNode }) {
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

function Field({ label, value, placeholder, full = false }: { label: string; value?: string; placeholder?: string; full?: boolean }) {
  return (
    <label className={`bop-field${full ? " full" : ""}`}>
      {label}
      <input defaultValue={value} placeholder={placeholder} />
    </label>
  );
}

export function Guided() {
  const [activeStep, setActiveStep] = useState(0);
  const [checked, setChecked] = useState([true, true, true, true, true, false, false]);
  const completeCount = checked.filter(Boolean).length;
  const missing = useMemo(() => docs.filter((_, index) => !checked[index]), [checked]);
  const progress = Math.round((completeCount / docs.length) * 100);

  const toggleDoc = (index: number) => {
    setChecked((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value));
  };

  return (
    <div className="bop-mockup guided">
      <Chrome>
        <div className="bop-content">
          <div className="bop-page-heading">
            <div>
              <span className="bop-eyebrow">BOP ADMINISTRASI · TAHUN ANGGARAN 2026</span>
              <h1>Pengajuan Dana Operasional</h1>
              <p>Isi data inti satu kali. Sistem membantu menyiapkan tujuh dokumen pengajuan.</p>
            </div>
            <div className="bop-heading-actions">
              <span className="guided-status">Draft · tersimpan otomatis</span>
              <button className="bop-button primary" type="button">
                <Save size={14} /> Simpan Draft
              </button>
            </div>
          </div>

          <div className="guided-steps" aria-label="Tahap pengajuan">
            {steps.map(([title, subtitle], index) => (
              <button
                className={`guided-step${activeStep === index ? " active" : ""}${index < activeStep ? " done" : ""}`}
                key={title}
                onClick={() => setActiveStep(index)}
                type="button"
              >
                <span className="guided-step-badge">{index < activeStep ? <Check size={14} /> : `0${index + 1}`}</span>
                <span className="guided-step-copy">
                  <strong>{title}</strong>
                  <span>{subtitle}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="guided-grid">
            <div className="bop-stack">
              {activeStep === 0 && (
                <section className="bop-panel">
                  <div className="bop-panel-head">
                    <div>
                      <h2>Data Pengajuan</h2>
                      <p className="bop-panel-sub">Data ini akan mengisi semua dokumen secara otomatis.</p>
                      <span className="guided-source">Sebagian data diambil dari Master RT</span>
                    </div>
                    <Landmark size={20} color="#c99127" />
                  </div>
                  <div className="bop-form">
                    <Field label="Nomor Surat" placeholder=".../RT005/VII/2026" />
                    <Field label="Tanggal Surat" value="Semarang, 01 Juli 2026" />
                    <Field label="Sifat" value="Segera" />
                    <Field label="Lampiran" value="1 (satu) berkas" />
                    <Field label="Nama Rekening Bank Jateng" value="RT 005 RW 012 Tegalsari" />
                    <Field label="Nama Lurah" value="Budi Santoso, S.Sos." />
                    <Field label="Nama Ketua RW" value="H. Suyatno" full />
                  </div>
                </section>
              )}

              {activeStep === 1 && (
                <section className="bop-panel">
                  <div className="bop-panel-head">
                    <div>
                      <h2>Rencana Anggaran</h2>
                      <p className="bop-panel-sub">Periksa nilai RAP satu tahun sebelum melanjutkan.</p>
                    </div>
                  </div>
                  <div className="guided-amount">
                    <div className="guided-amount-card"><span>Total pagu BOP</span><strong>Rp25.000.000</strong></div>
                    <div className="guided-amount-card"><span>RAP tervalidasi</span><strong>Rp18.750.000</strong></div>
                    <table className="guided-table">
                      <thead><tr><th>Uraian</th><th>Periode</th><th>Nilai</th></tr></thead>
                      <tbody>
                        <tr><td>Operasional administrasi</td><td>Jan–Des</td><td>Rp8.250.000</td></tr>
                        <tr><td>Rapat dan kegiatan warga</td><td>Mar–Nov</td><td>Rp10.500.000</td></tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {activeStep === 2 && (
                <section className="bop-panel">
                  <div className="bop-panel-head">
                    <div>
                      <h2>Kelengkapan Dokumen</h2>
                      <p className="bop-panel-sub">Centang dokumen yang sudah tersedia. Pilih Lihat untuk membuka preview.</p>
                    </div>
                    <FileCheck2 size={20} color="#c99127" />
                  </div>
                  <div className="guided-docs">
                    {docs.map(([name, description], index) => (
                      <button className={`guided-doc-row${checked[index] ? " complete" : ""}`} key={name} onClick={() => toggleDoc(index)} type="button">
                        <span className="guided-doc-check">{checked[index] ? <Check size={13} /> : ""}</span>
                        <span className="guided-doc-copy"><strong>{name}</strong><span>{description}</span></span>
                        <span className="guided-doc-status">{checked[index] ? "Lengkap" : "Belum dibuat"}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {activeStep === 3 && (
                <section className="bop-panel">
                  <div className="bop-panel-head">
                    <div>
                      <h2>Tinjau Pengajuan</h2>
                      <p className="bop-panel-sub">Pastikan data dan dokumen sudah benar sebelum diajukan.</p>
                    </div>
                    <CheckCircle2 size={20} color="#16a574" />
                  </div>
                  <div className="guided-review">
                    <div className="guided-review-box"><strong>Penerima</strong><span>RT 005 RW 012 Tegalsari</span></div>
                    <div className="guided-review-box"><strong>Total pengajuan</strong><span>Rp18.750.000</span></div>
                    <div className="guided-review-box"><strong>Kelengkapan</strong><span>{completeCount} dari {docs.length} dokumen siap</span></div>
                  </div>
                </section>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                {activeStep > 0 && <button className="bop-button secondary" onClick={() => setActiveStep((step) => step - 1)} type="button">Kembali</button>}
                {activeStep < 3 && <button className="bop-button primary" onClick={() => setActiveStep((step) => step + 1)} type="button">Lanjut <ArrowRight size={14} /></button>}
              </div>
            </div>

            <aside className="guided-summary">
              <div className="guided-summary-top">
                <div>
                  <div>
                    <span className="bop-aside-kicker">STATUS PENGAJUAN</span>
                    <h2>{completeCount === docs.length ? "Siap diajukan" : "Masih perlu dilengkapi"}</h2>
                  </div>
                  <span className="guided-count">{completeCount}/{docs.length}</span>
                </div>
                <div className="bop-progress-track"><span style={{ width: `${progress}%` }} /></div>
                <p className="guided-summary-note">{progress}% dokumen pengajuan sudah lengkap</p>
              </div>
              <div className="guided-missing">
                {missing.length > 0 ? (
                  <>
                    <h3>Yang perlu dilengkapi</h3>
                    <ul className="guided-missing-list">
                      {missing.map(([name]) => <li key={name}>{name}</li>)}
                    </ul>
                  </>
                ) : <div className="guided-complete">Semua dokumen sudah siap diperiksa.</div>}
              </div>
              <div className="guided-summary-actions">
                <button className="bop-button secondary" onClick={() => setActiveStep(2)} type="button">Lihat semua dokumen</button>
                <button className="bop-button gold" disabled={missing.length > 0} type="button">Tinjau & Ajukan</button>
              </div>
            </aside>
          </div>
        </div>
      </Chrome>
    </div>
  );
}