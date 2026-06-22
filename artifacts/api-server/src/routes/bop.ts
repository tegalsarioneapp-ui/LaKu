/**
 * BOP RT 005 — Primary data API
 * Semua modul (master, pengajuan, RAP, LPJ, persiapan, history) disimpan di PostgreSQL.
 * Frontend tetap menggunakan localStorage sebagai offline cache.
 */
import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();
const RT_KEY = "rt005rw012";

/* ─── SQL untuk membuat semua tabel BOP (idempotent) ────────── */
const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS bop_data (
    id         SERIAL PRIMARY KEY,
    rt_key     VARCHAR(20) NOT NULL UNIQUE,
    data       JSONB NOT NULL,
    version    INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS bop_history (
    id         SERIAL PRIMARY KEY,
    kind       VARCHAR(80),
    doc_type   VARCHAR(80),
    label      TEXT,
    html       TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS bop_snapshots (
    id         SERIAL PRIMARY KEY,
    data       JSONB NOT NULL,
    label      TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS moku_photos (
    id            TEXT PRIMARY KEY,
    activity_id   TEXT,
    activity_name TEXT,
    type          TEXT,
    file_name     TEXT,
    captured_at   TIMESTAMPTZ,
    lat           NUMERIC,
    lng           NUMERIC,
    accuracy      NUMERIC,
    address       TEXT,
    note          TEXT
  );
  CREATE TABLE IF NOT EXISTS moku_results_sync (
    id            SERIAL PRIMARY KEY,
    activity_id   TEXT,
    activity_name TEXT,
    status        TEXT,
    photo_count   INTEGER DEFAULT 0,
    note          TEXT,
    updated_at    TIMESTAMPTZ
  );
`;

async function runInitDb(): Promise<void> {
  await pool.query(CREATE_TABLES_SQL);
}

/* Helper: parse body dari text/plain atau application/json (untuk sendBeacon) */
async function parseFlexibleBody(req: import("express").Request): Promise<{ data?: unknown; clientVersion?: number } | null> {
  try {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      return req.body as { data?: unknown; clientVersion?: number };
    }
    // sendBeacon mengirim sebagai text/plain atau application/octet-stream
    const raw = req.body?.toString?.() ?? "";
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore parse errors */ }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/bop/data
   Ambil data BOP terkini dari database.
   Mendukung ETag (If-None-Match = client version) untuk 304 responses.
   Response: { ok, data, updatedAt, version }
═══════════════════════════════════════════════════════════════ */
router.get("/bop/data", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT data, updated_at, version FROM bop_data WHERE rt_key = $1`,
      [RT_KEY]
    );
    if (result.rows.length === 0) {
      res.json({ ok: true, data: null, updatedAt: null, version: 0 });
      return;
    }
    const row = result.rows[0];
    const serverVersion = String(row.version);

    // Kirim 304 Not Modified jika client sudah punya versi terbaru
    const clientEtag = req.headers["if-none-match"];
    if (clientEtag && clientEtag === serverVersion) {
      res.status(304).end();
      return;
    }

    res.setHeader("ETag", serverVersion);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      data: row.data,
      updatedAt: row.updated_at,
      version: row.version,
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ ok: false, error: "Gagal membaca data BOP" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   PUT /api/bop/data
   Simpan/update data BOP (upsert).
   Body: { data: object, clientVersion?: number }
   Response: { ok, updatedAt, version }
═══════════════════════════════════════════════════════════════ */
router.put("/bop/data", async (req, res) => {
  try {
    const { data, clientVersion } = req.body as {
      data: unknown;
      clientVersion?: number;
    };
    if (!data || typeof data !== "object") {
      res.status(400).json({ ok: false, error: "Field 'data' wajib berupa object" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO bop_data (rt_key, data, version, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (rt_key) DO UPDATE
         SET data       = EXCLUDED.data,
             version    = bop_data.version + 1,
             updated_at = NOW()
       RETURNING updated_at, version`,
      [RT_KEY, JSON.stringify(data), clientVersion ?? 1]
    );

    res.json({
      ok: true,
      updatedAt: result.rows[0].updated_at,
      version: result.rows[0].version,
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ ok: false, error: "Gagal menyimpan data BOP" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/bop/data-beacon
   Endpoint khusus navigator.sendBeacon (beforeunload).
   sendBeacon mengirim Content-Type: text/plain / application/octet-stream.
   Kita parse manual karena Express json() tidak handle non-JSON content-type.
   Response: { ok } (204 agar ringan)
═══════════════════════════════════════════════════════════════ */
router.post("/bop/data-beacon", async (req, res) => {
  try {
    const body = await parseFlexibleBody(req);
    if (!body?.data || typeof body.data !== "object") {
      res.status(204).end();
      return;
    }
    await pool.query(
      `INSERT INTO bop_data (rt_key, data, version, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (rt_key) DO UPDATE
         SET data       = EXCLUDED.data,
             version    = bop_data.version + 1,
             updated_at = NOW()`,
      [RT_KEY, JSON.stringify(body.data), body.clientVersion ?? 1]
    );
    res.status(204).end();
  } catch (e) {
    req.log.error(e);
    res.status(204).end(); // sendBeacon tidak peduli response, tetap 204
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/bop/history
   Ambil semua entri riwayat dokumen.
   Query params: ?limit=100&offset=0&kind=Pengajuan
═══════════════════════════════════════════════════════════════ */
router.get("/bop/history", async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query["limit"]  ?? 200), 500);
    const offset = Number(req.query["offset"] ?? 0);
    const kind   = req.query["kind"] as string | undefined;

    const params: unknown[] = [limit, offset];
    const whereClause = kind ? `WHERE kind = $3` : "";
    if (kind) params.push(kind);

    const result = await pool.query(
      `SELECT id, kind, doc_type, label, html, created_at
       FROM bop_history
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    res.json({ ok: true, history: result.rows });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ ok: false, error: "Gagal membaca riwayat" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/bop/history
   Tambah entri riwayat dokumen.
   Body: { kind, docType, label, html }
═══════════════════════════════════════════════════════════════ */
router.post("/bop/history", async (req, res) => {
  try {
    const { kind, docType, label, html } = req.body as {
      kind: string;
      docType: string;
      label: string;
      html: string;
    };
    if (!kind || !label) {
      res.status(400).json({ ok: false, error: "kind dan label wajib diisi" });
      return;
    }
    const result = await pool.query(
      `INSERT INTO bop_history (kind, doc_type, label, html)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [kind, docType ?? null, label, html ?? null]
    );
    res.json({
      ok: true,
      id: result.rows[0].id,
      createdAt: result.rows[0].created_at,
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ ok: false, error: "Gagal menyimpan riwayat" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/bop/history/:id
   Hapus entri riwayat berdasarkan ID.
═══════════════════════════════════════════════════════════════ */
router.delete("/bop/history/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "ID tidak valid" });
      return;
    }
    const result = await pool.query(
      `DELETE FROM bop_history WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: "Riwayat tidak ditemukan" });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ ok: false, error: "Gagal menghapus riwayat" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/bop/status
   Cek ketersediaan database + statistik ringkas.
   Juga dipakai sebagai ping endpoint oleh frontend.
═══════════════════════════════════════════════════════════════ */
router.get("/bop/status", async (req, res) => {
  try {
    const [dataRow, histCount] = await Promise.all([
      pool.query(
        `SELECT updated_at, version FROM bop_data WHERE rt_key = $1`,
        [RT_KEY]
      ),
      pool.query(`SELECT COUNT(*) as count FROM bop_history`),
    ]);
    res.json({
      ok: true,
      hasData:      dataRow.rows.length > 0,
      updatedAt:    dataRow.rows[0]?.updated_at ?? null,
      version:      dataRow.rows[0]?.version ?? 0,
      historyCount: Number(histCount.rows[0].count),
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ ok: false, error: "Database tidak tersedia" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/bop/init-db
   Buat semua tabel yang diperlukan jika belum ada.
   Aman dijalankan berkali-kali (idempotent).
   Berguna saat deploy ke Railway dengan PostgreSQL baru.
═══════════════════════════════════════════════════════════════ */
router.get("/bop/init-db", async (req, res) => {
  try {
    await runInitDb();
    res.json({ ok: true, message: "Semua tabel berhasil dibuat / sudah ada." });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.post("/bop/init-db", async (req, res) => {
  try {
    await runInitDb();
    res.json({ ok: true, message: "Semua tabel berhasil dibuat / sudah ada." });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

export default router;

export async function autoInitDb(): Promise<void> {
  try {
    await runInitDb();
    console.info("[BOP] Database tables initialized (auto-init).");
  } catch (e) {
    console.error("[BOP] Auto-init DB failed:", e);
    /* Jangan throw — biarkan server tetap jalan meski DB belum siap */
  }
}
