import { Router } from "express";
import healthRouter from "./health.js";
import downloadRouter from "./download.js";
import dbRouter from "./db.js";
import syncRouter from "./sync.js";
import bopRouter from "./bop.js";

const router = Router();

router.use(healthRouter);
router.use(downloadRouter);
router.use(dbRouter);
router.use(syncRouter);
router.use(bopRouter);

export default router;
