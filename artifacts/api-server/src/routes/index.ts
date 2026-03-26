import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import userRouter from "./user.js";
import gamesRouter from "./games.js";
import depositRouter from "./deposit.js";
import withdrawalRouter from "./withdrawal.js";
import sportsRouter from "./sports.js";
import supportRouter from "./support.js";
import adminRouter from "./admin.js";
import luckyWheelRouter from "./lucky-wheel.js";

const router: IRouter = Router();

router.get("/ping", (_req, res) => res.json({ ok: true, ts: Date.now() }));

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/games", gamesRouter);
router.use("/deposit", depositRouter);
router.use("/withdrawal", withdrawalRouter);
router.use("/sports", sportsRouter);
router.use("/support", supportRouter);
router.use("/admin", adminRouter);
router.use("/lucky-wheel", luckyWheelRouter);

export default router;
