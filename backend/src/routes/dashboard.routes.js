/**
 * FILE: backend/src/routes/dashboard.routes.js   (mounted at /api/v1/dashboard)
 *
 *   GET /stats   everything the dashboard home page shows, in ONE request
 *                (counts, my tasks, deadlines, recent activity, ...)
 *
 * Only verifyJWT: no per-project authorization is needed because the controller
 * only queries projects where the caller is a member.
 */
import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getDashboardStats } from "../controllers/dashboard.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/stats").get(getDashboardStats);

export default router;
