import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import scanRouter from "./scan";
import receiptsRouter from "./receipts";
import vouchersRouter from "./vouchers";
import challengesRouter from "./challenges";
import leaderboardRouter from "./leaderboard";
import productsRouter from "./products";
import adminRouter from "./admin";
import badgesRouter from "./badges";
import walletRouter from "./wallet";
import kitsRouter from "./kits";
import locationsRouter from "./locations";
import walkinRouter from "./walkin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(scanRouter);
router.use(receiptsRouter);
router.use(vouchersRouter);
router.use(badgesRouter);
router.use(challengesRouter);
router.use(leaderboardRouter);
router.use(productsRouter);
router.use(adminRouter);
router.use(walletRouter);
router.use(kitsRouter);
router.use(locationsRouter);
router.use(walkinRouter);

export default router;
