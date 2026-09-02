---
name: Alur Pengajuan Dana dan LPJ Bulanan
description: Aturan bisnis pengajuan awal dana operasional, pengambilan bank bulanan, dan gate LPJ.
---

Pengajuan 7 dokumen hanya dilakukan satu kali pada awal tahun untuk pencairan dana alokasi Rp25 juta ke rekening BPD RT. Pada bulan berikutnya, hanya dibuat satu lembar Pengambilan Operasional RT melalui Bank BPD Jateng per bulan. Pengambilan bulan berikutnya mensyaratkan LPJ seluruh kegiatan yang sudah selesai pada bulan sebelumnya sudah lengkap; pengambilan pertama adalah pengecualian karena dana awal baru masuk.

**Why:** Pengajuan awal, pengambilan bulanan, dan pertanggungjawaban kegiatan adalah tiga proses berbeda. Mencampurnya akan membuat 7 dokumen seolah-olah harus dibuat ulang setiap bulan dan menghilangkan kontrol kepatuhan LPJ.

**How to apply:** Modelkan pengajuan awal sebagai proses one-time per tahun, pengambilan bank sebagai satu record unik per bulan, dan LPJ sebagai gate sebelum membuka pengambilan bulan berikutnya. Hubungkan setiap LPJ dengan kegiatan RAP yang selesai.