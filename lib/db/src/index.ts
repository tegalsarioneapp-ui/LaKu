import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const dbUrl = process.env.DATABASE_URL;

/*
 * SSL logic:
 * - localhost / 127.0.0.1          → no SSL (local dev)
 * - *.railway.internal             → no SSL (Railway internal network)
 * - everything else (public URLs)  → SSL with rejectUnauthorized: false
 */
function resolveSsl(url: string): pg.PoolConfig["ssl"] {
  try {
    const { hostname } = new URL(url);
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".railway.internal")
    ) {
      return false;
    }
  } catch (_) {
    /* kalau URL tidak bisa di-parse, fallback ke no-SSL */
    return false;
  }
  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: resolveSsl(dbUrl),
  /* Batas koneksi yang aman untuk Railway free tier */
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
