/**
 * /api/sync/* — Sinkronisasi BOP via PostgreSQL
 * Menggantikan implementasi file JSON lama.
 * Backward-compatible: endpoint path sama, backend pakai bop_data table.
 */
import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();
const RT_KEY = "rt005rw012";

/* ── GET /api/sync/status ──────────────────────────────────────
   Cek apakah data sync tersedia di PostgreSQL.
─────────────────────────────────────────────────────────────── */
router.get("/sync/status", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT updated_at, version FROM bop_data WHERE rt_key = $1`,
      [RT_KEY]
    );
    if (result.rows.length === 0) {
      return res.json({ hasSyncData: false, savedAt: null, size: 0 });
    }
    const row = result.rows[0];
    return res.json({
      hasSyncData: true,
      savedAt: row.updated_at,
      version: row.version,
      backend: "postgresql",
    });
  } catch (e) {
    return res.status(500).json({ error: "Gagal cek status sync" });
  }
});

/* ── GET /api/sync/pull ────────────────────────────────────────
   Ambil data BOP terkini dari PostgreSQL.
─────────────────────────────────────────────────────────────── */
router.get("/sync/pull", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT data, updated_at, version FROM bop_data WHERE rt_key = $1`,
      [RT_KEY]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Belum ada data sync di server" });
    }
    const row = result.rows[0];
    return res.json({
      data: row.data,
      savedAt: row.updated_at,
      version: row.version,
      backend: "postgresql",
    });
  } catch (e) {
    return res.status(500).json({ error: "Gagal membaca data sync" });
  }
});

/* ── POST /api/sync/push ───────────────────────────────────────
   Simpan data BOP ke PostgreSQL (upsert).
   Body: { data: object }
─────────────────────────────────────────────────────────────── */
router.post("/sync/push", async (req, res) => {
  try {
    const body = req.body as { data?: unknown };
    if (!body?.data || typeof body.data !== "object") {
      return res.status(400).json({ error: "Body tidak valid, field 'data' diperlukan" });
    }
    const result = await pool.query(
      `INSERT INTO bop_data (rt_key, data, version, updated_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (rt_key) DO UPDATE
         SET data       = EXCLUDED.data,
             version    = bop_data.version + 1,
             updated_at = NOW()
       RETURNING updated_at, version`,
      [RT_KEY, JSON.stringify(body.data)]
    );
    return res.json({
      success: true,
      savedAt: result.rows[0].updated_at,
      version: result.rows[0].version,
      backend: "postgresql",
    });
  } catch (e) {
    return res.status(500).json({ error: "Gagal menyimpan data sync" });
  }
});

export default router;
