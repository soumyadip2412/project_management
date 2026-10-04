import { Router } from "express";
import { healthCheck, readinessCheck } from "../controllers/controller_healthcheck.js";

const router = Router();

router.get("/", healthCheck); // liveness
router.get("/ready", readinessCheck); // readiness

export default router;
