import { Router } from "express";
import { globalSearch, getRecentItems } from "../controllers/search.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router.get("/", globalSearch);
router.get("/recent", getRecentItems);

export default router;
