import express from "express";
import cors from "cors";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { autoInitDb } from "./routes/bop.js";

const require = createRequire(import.meta.url);
const pinoHttp = require("pino-http");

const app = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: ["text/plain", "application/octet-stream"] }));

app.use("/api", router);

/* Auto-init DB: buat tabel jika belum ada (Railway-safe, idempotent) */
autoInitDb().catch(e => logger.error(e, "[BOP] autoInitDb failed"));

/* Serve the built BOP app from the same production process. */
if (process.env.NODE_ENV !== "development") {
  const __here = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist =
    process.env.STATIC_DIR ||
    path.resolve(__here, "../../bop-app/dist/public");

  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist, { maxAge: "1h" }));
    logger.info({ frontendDist }, "Serving frontend static files");
  } else {
    logger.warn({ frontendDist }, "Frontend dist not found");
  }

  app.use((_req, res) => {
    const indexHtml = path.join(frontendDist, "index.html");
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      res.status(404).send("Frontend not built");
    }
  });
}

export default app;
