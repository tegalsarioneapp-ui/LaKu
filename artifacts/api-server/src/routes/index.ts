import { Router, type IRouter } from "express";
import healthRouter from "./health";
import downloadRouter from "./download";
import dbRouter from "./db";
import syncRouter from "./sync";
import bopRouter from "./bop";

const router: IRouter = Router();

router.use(healthRouter);
router.use(downloadRouter);
router.use(dbRouter);
router.use(syncRouter);
router.use(bopRouter);

export default router;
