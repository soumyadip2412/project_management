/**
 * FILE: backend/src/routes/search.routes.js   (mounted at /api/v1/search)
 *
 *   GET /?q=...&type=task,project,user,note&projectId=&limit=
 *                  search tasks, projects, collaborators and notes across the
 *                  projects the caller belongs to
 *   GET /recent    my recently updated tasks and projects, for quick navigation
 *
 * Scoping happens inside the controller (it first finds the caller's project
 * ids, then searches only within those), so verifyJWT is the only middleware.
 */
import { Router } from "express";
import { globalSearch, getRecentItems } from "../controllers/search.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router.get("/", globalSearch);
router.get("/recent", getRecentItems);

export default router;
