import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getDashboardStats } from "../controllers/dashboard.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/stats").get(getDashboardStats);

export default router;
