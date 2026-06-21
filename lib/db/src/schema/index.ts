import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  jsonb,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";

/* ── Tabel utama data BOP (singleton per RT, primary storage) ── */
export const bopData = pgTable("bop_data", {
  id:        serial("id").primaryKey(),
  rtKey:     varchar("rt_key", { length: 20 }).notNull().unique(),
  data:      jsonb("data").notNull(),
  version:   integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/* ── Riwayat dokumen BOP (append-only) ───────────────────────── */
export const bopHistory = pgTable("bop_history", {
  id:        serial("id").primaryKey(),
  kind:      varchar("kind", { length: 80 }),
  docType:   varchar("doc_type", { length: 80 }),
  label:     text("label"),
  html:      text("html"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* ── Snapshot cadangan BOP (backward compat) ─────────────────── */
export const bopSnapshots = pgTable("bop_snapshots", {
  id:        serial("id").primaryKey(),
  data:      jsonb("data").notNull(),
  label:     text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* ── Foto MoKu ───────────────────────────────────────────────── */
export const mokuPhotos = pgTable("moku_photos", {
  id:           text("id").primaryKey(),
  activityId:   text("activity_id"),
  activityName: text("activity_name"),
  type:         text("type"),
  fileName:     text("file_name"),
  capturedAt:   timestamp("captured_at", { withTimezone: true }),
  lat:          numeric("lat"),
  lng:          numeric("lng"),
  accuracy:     numeric("accuracy"),
  address:      text("address"),
  note:         text("note"),
});

/* ── Hasil sinkronisasi MoKu ─────────────────────────────────── */
export const mokuResultsSync = pgTable("moku_results_sync", {
  id:           serial("id").primaryKey(),
  activityId:   text("activity_id"),
  activityName: text("activity_name"),
  status:       text("status"),
  photoCount:   integer("photo_count").default(0),
  note:         text("note"),
  updatedAt:    timestamp("updated_at", { withTimezone: true }),
});

export type BopData        = typeof bopData.$inferSelect;
export type BopHistory     = typeof bopHistory.$inferSelect;
export type BopSnapshot    = typeof bopSnapshots.$inferSelect;
export type MokuPhoto      = typeof mokuPhotos.$inferSelect;
export type MokuResultSync = typeof mokuResultsSync.$inferSelect;
