import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./profile";
import scanRouter from "./scan";
import receiptsRouter from "./receipts";
import vouchersRouter from "./vouchers";
import challengesRouter from "./challenges";
import leaderboardRouter from "./leaderboard";
import productsRouter from "./products";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use(scanRouter);
router.use(receiptsRouter);
router.use(vouchersRouter);
router.use(challengesRouter);
router.use(leaderboardRouter);
router.use(productsRouter);

export default router;
