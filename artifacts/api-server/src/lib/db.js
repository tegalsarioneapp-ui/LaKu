import pg from "pg";

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL must be set.");
}

function resolveSsl(url) {
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
    return false;
  }
  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: resolveSsl(dbUrl),
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
