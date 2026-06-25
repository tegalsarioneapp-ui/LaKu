import re, os, shutil, datetime

# ══════════════════════════════════════════════════
# FIX: Bump moku/index.html app.js version manual
# 20260622c → 20260623a (tanggal baru + suffix reset)
# ══════════════════════════════════════════════════
MOKU_IDX = "artifacts/bop-app/public/moku/index.html"
with open(MOKU_IDX, "r", encoding="utf-8") as f:
    midx = f.read()

OLD_VER = "app.js?v=20260622c"
NEW_VER = "app.js?v=20260625a"

if OLD_VER in midx:
    midx = midx.replace(OLD_VER, NEW_VER, 1)
    with open(MOKU_IDX, "w", encoding="utf-8") as f:
        f.write(midx)
    print(f"OK: moku/index.html version: 20260622c → 20260625a")
else:
    # Cari versi apapun
    m = re.search(r'app\.js\?v=([\w]+)', midx)
    if m:
        old = m.group(0)
        midx = midx.replace(old, "app.js?v=20260625a", 1)
        with open(MOKU_IDX, "w", encoding="utf-8") as f:
            f.write(midx)
        print(f"OK: moku/index.html version: {old} → app.js?v=20260625a")
    else:
        print("SKIP: version tidak ditemukan di moku/index.html")

# ══════════════════════════════════════════════════
# CLEANUP: Hapus temp files
# ══════════════════════════════════════════════════
temps = ["_chunk_ds.txt", "_chunk_app.txt", "_chunk_moku.txt"]
for t in temps:
    if os.path.exists(t):
        os.remove(t)
        print(f"OK: Hapus {t}")

# ══════════════════════════════════════════════════
# CLEANUP: Hapus file .py temp
# ══════════════════════════════════════════════════
pys = ["chunk1.py","chunk2.py","chunk3.py","chunk4.py","chunk5.py",
       "chunk6.py","chunk7.py","chunk8.py","chunk9.py","chunk10.py",
       "chunk11.py","chunk12.py","chunk13.py","audit_appjs.py","audit_ds.py"]
for p in pys:
    if os.path.exists(p):
        os.remove(p)
        print(f"OK: Hapus {p}")

# ══════════════════════════════════════════════════
# LAPORAN FINAL
# ══════════════════════════════════════════════════
print("\n" + "="*55)
print("  LAPORAN PATCH v1.51 — SELESAI")
print("="*55)

files_changed = [
    ("artifacts/bop-app/public/document-studio/document-studio.js", "FIX KOP CSS + MutationObserver debounce"),
    ("artifacts/bop-app/public/moku/app.js",                        "FIX initEvents null guard (17 elemen)"),
    ("artifacts/bop-app/public/moku/sw.js",                         "BUMP cache moku-v5 → moku-v6"),
    ("artifacts/bop-app/public/moku/index.html",                    "BUMP app.js?v=20260622c → 20260625a"),
]

print("\nFile yang diubah:")
for f, desc in files_changed:
    exists = os.path.exists(f)
    size   = os.path.getsize(f) if exists else 0
    status = "OK" if exists else "MISSING"
    print(f"  [{status}] {f}")
    print(f"         → {desc} ({size:,} bytes)")

print("\nFix yang dilakukan:")
fixes = [
    "1. KOP CSS printDoc: tambah .kop-b1/.kop-b2/.kop-addr/.kop h1/.kop h2",
    "2. MutationObserver: debounce 80ms (cegah race condition)",
    "3. MoKu initEvents: 17 elemen diberi null guard",
    "4. Service Worker: cache moku-v5 → moku-v6",
    "5. moku/index.html: version query bump",
]
for fix in fixes:
    print(f"  ✓ {fix}")

print("\nLangkah selanjutnya:")
print("  1. git add -A")
print("  2. git commit -m 'fix: PATCH v1.51 - KOP CSS, MoKu null guard, SW cache bump'")
print("  3. git push origin main")
print("  4. Hard refresh browser: Ctrl+Shift+R")
print("  5. Cek F12 Console → tidak ada error")
print("  6. Test print dokumen → KOP tidak pecah")
print("="*55)
