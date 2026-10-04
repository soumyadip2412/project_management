import mongoose from "mongoose";
import { ApiResponse } from "../utils/api-response.js";

/**
 * Liveness: is the process up and able to answer? No dependencies are checked,
 * so a database outage does not make an orchestrator restart healthy processes.
 */
const healthCheck = (req, res) => {
    res.status(200).json(new ApiResponse(200, { status: "ok", uptimeSeconds: Math.round(process.uptime()) }));
};

/**
 * Readiness: can this instance serve real traffic right now? A load balancer
 * stops routing to an instance that answers 503 here (e.g. while MongoDB is
 * reconnecting, or during shutdown).
 */
const readinessCheck = (req, res) => {
    const ready = mongoose.connection.readyState === 1; // 1 = connected
    res.status(ready ? 200 : 503).json(
        new ApiResponse(ready ? 200 : 503, { status: ready ? "ready" : "unavailable", database: ready ? "up" : "down" })
    );
};

export { healthCheck, readinessCheck };
