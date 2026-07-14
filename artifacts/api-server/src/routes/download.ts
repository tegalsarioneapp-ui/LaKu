import { Router, type IRouter } from "express";
import { ZipArchive } from "archiver";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router: IRouter = Router();

const BOP_PUBLIC_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "bop-app",
  "public"
);

const BOP_INDEX_HTML = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "bop-app",
  "index.html"
);

router.get("/download-app", (_req, res) => {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="bop-rt005-offline-app.zip"'
  );

  const archive = new ZipArchive({ zlib: { level: 9 } });

  archive.on("error", (err) => {
    res.status(500).json({ error: err.message });
  });

  archive.pipe(res);

  archive.file(BOP_INDEX_HTML, { name: "index.html" });
  archive.directory(BOP_PUBLIC_DIR, false);

  archive.finalize();
});

export default router;
