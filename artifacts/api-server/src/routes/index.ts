import { Router, type IRouter } from "express";
import healthRouter from "./health";
import downloadRouter from "./download";
import dbRouter from "./db";

const router: IRouter = Router();

router.use(healthRouter);
router.use(downloadRouter);
router.use(dbRouter);

export default router;
