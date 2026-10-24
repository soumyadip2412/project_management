/**
 * FILE: backend/src/routes/healthcheck.route.js   (mounted at /api/v1/healthcheck)
 *
 *   GET /        liveness:  "the process is up" (always 200 if it can answer)
 *   GET /ready   readiness: "can serve traffic" (503 until MongoDB is connected)
 *
 * Public on purpose: load balancers, Kubernetes probes and uptime monitors call
 * these without credentials.
 *
 * INTERVIEW NOTE: liveness failing means "restart me"; readiness failing means
 * "don't send me traffic yet". Mixing them up causes restart loops whenever the
 * database blips.
 */
import { Router } from "express";
import { healthCheck, readinessCheck } from "../controllers/controller_healthcheck.js";

const router = Router();

router.get("/", healthCheck); // liveness
router.get("/ready", readinessCheck); // readiness

export default router;
