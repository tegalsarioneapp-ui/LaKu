import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

/* ── Pastikan unique index ada agar UPSERT bisa berjalan ─────── */
pool.query(
  `CREATE UNIQUE INDEX IF NOT EXISTS moku_results_sync_act_idx
   ON moku_results_sync(activity_id)`
).catch(() => {});

/* ── POST /api/db/bop-sync ──────────────────────────────────────
   Simpan snapshot data BOP ke PostgreSQL untuk cloud backup.
   Body: { data: object, label?: string }
─────────────────────────────────────────────────────────────── */
router.post("/db/bop-sync", async (req, res) => {
  try {
    const { data, label } = req.body as { data: unknown; label?: string };
    if (!data || typeof data !== "object") {
      res.status(400).json({ ok: false, error: "data wajib berupa object" });
      return;
    }
    const result = await pool.query(
      `INSERT INTO bop_snapshots (data, label) VALUES ($1, $2) RETURNING id, created_at`,
      [JSON.stringify(data), label || "auto"]
    );
    res.json({ ok: true, id: result.rows[0].id, createdAt: result.rows[0].created_at });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ ok: false, error: "Gagal menyimpan snapshot BOP" });
  }
});

/* ── POST /api/db/photos ────────────────────────────────────────
   Simpan metadata foto MoKu ke PostgreSQL.
   Body: { photos: Array<PhotoMeta>, activityName?: string }
─────────────────────────────────────────────────────────────── */
router.post("/db/photos", async (req, res) => {
  try {
    const { photos, activityName } = req.body as {
      photos: Array<{
        id: string;
        activityId: string;
        type: string;
        fileName: string;
        capturedAt: string;
        location?: { lat?: number; lng?: number; latitude?: number; longitude?: number; accuracy?: number; address?: string };
        note?: string;
      }>;
      activityName?: string;
    };
    if (!Array.isArray(photos) || !photos.length) {
      res.status(400).json({ ok: false, error: "photos harus berupa array tidak kosong" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let saved = 0;
      for (const p of photos) {
        const loc  = p.location || {};
        const lat  = loc.lat ?? loc.latitude ?? null;
        const lng  = loc.lng ?? loc.longitude ?? null;
        await client.query(
          `INSERT INTO moku_photos
             (id, activity_id, activity_name, type, file_name, captured_at, lat, lng, accuracy, address, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (id) DO UPDATE SET
             activity_name = EXCLUDED.activity_name,
             note          = EXCLUDED.note`,
          [
            p.id, p.activityId, activityName || null,
            p.type || null, p.fileName || null,
            p.capturedAt ? new Date(p.capturedAt) : null,
            lat, lng, loc.accuracy || null, loc.address || null,
            p.note || null
          ]
        );
        saved++;
      }
      await client.query("COMMIT");
      res.json({ ok: true, saved });
    } catch(e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ ok: false, error: "Gagal menyimpan foto" });
  }
});

/* ── POST /api/db/results-sync ──────────────────────────────────
   Sinkronkan ringkasan hasil MoKu per kegiatan.
─────────────────────────────────────────────────────────────── */
router.post("/db/results-sync", async (req, res) => {
  try {
    const { results } = req.body as {
      results: Array<{
        activityId: string;
        activityName?: string;
        status?: string;
        photoCount?: number;
        note?: string;
        updatedAt?: string;
      }>;
    };
    if (!Array.isArray(results) || !results.length) {
      res.status(400).json({ ok: false, error: "results harus array tidak kosong" });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const r of results) {
        await client.query(
          `INSERT INTO moku_results_sync
             (activity_id, activity_name, status, photo_count, note, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (activity_id) DO UPDATE SET
             activity_name = EXCLUDED.activity_name,
             status        = EXCLUDED.status,
             photo_count   = EXCLUDED.photo_count,
             note          = EXCLUDED.note,
             updated_at    = EXCLUDED.updated_at`,
          [
            r.activityId, r.activityName || null, r.status || null,
            r.photoCount || 0, r.note || null,
            r.updatedAt ? new Date(r.updatedAt) : null
          ]
        );
      }
      await client.query("COMMIT");
      res.json({ ok: true, saved: results.length });
    } catch(e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ ok: false, error: "Gagal sinkronisasi hasil" });
  }
});

/* ── GET /api/db/stats ──────────────────────────────────────────
   Statistik data tersimpan di PostgreSQL.
─────────────────────────────────────────────────────────────── */
router.get("/db/stats", async (req, res) => {
  try {
    const [photos, snaps, results] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM moku_photos"),
      pool.query("SELECT COUNT(*) as count FROM bop_snapshots"),
      pool.query("SELECT COUNT(*) as count FROM moku_results_sync")
    ]);
    res.json({
      ok:             true,
      photoCount:     Number(photos.rows[0].count),
      snapshotCount:  Number(snaps.rows[0].count),
      resultsCount:   Number(results.rows[0].count)
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ ok: false, error: "Gagal membaca statistik" });
  }
});

export default router;
