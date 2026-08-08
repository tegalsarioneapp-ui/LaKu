import express from "express";
import cors from "cors";
import { createRequire } from "node:module";
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

export default app;
