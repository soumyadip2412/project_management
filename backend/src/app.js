// Validate and default configuration before any other module reads it. Lives
// here (not only in index.js) so tests and the E2E server, which import the app
// directly, get exactly the same configuration checks as production.
import "./config/env.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { fileURLToPath } from "url";

import logger from "./utils/logger.js";
import passport from "./config/passport.js";
import { ApiError } from "./utils/api-errors.js";
import { globalLimiter, authLimiter } from "./middlewares/rateLimiter.middleware.js";
import { requestContext } from "./middlewares/requestContext.middleware.js";
import { requireTrustedOrigin, securityHeaders } from "./middlewares/security.middleware.js";

import healthCheckRouter from "./routes/healthcheck.route.js";
import authRouter from "./routes/auth.routes.js";
import projectRouter from "./routes/project.routes.js";
import taskRouter from "./routes/task.routes.js";
import noteRouter from "./routes/note.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";
import workspaceRouter from "./routes/workspace.routes.js";
import sprintRouter from "./routes/sprint.routes.js";
import commentRouter from "./routes/comment.routes.js";
import notificationRouter from "./routes/notification.routes.js";
import searchRouter from "./routes/search.routes.js";
import adminRouter from "./routes/admin.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const app = express();

app.disable("x-powered-by"); // don't advertise the framework
// Behind a load balancer / reverse proxy, req.ip is the proxy's address unless
// Express is told how many proxy hops to trust. Without this, every user would
// share ONE rate-limit bucket. Set TRUST_PROXY=1 when deployed behind one proxy.
app.set("trust proxy", Number(process.env.TRUST_PROXY) || false);

// ─── Global middleware (order matters) ───────
app.use(requestContext); // first, so every log line (even a 429) has a request id
app.use(securityHeaders);
// CORS before the rate limiter, so a 429 still carries CORS headers and the
// browser lets the SPA read it instead of reporting an opaque network error.
app.use(cors({
    origin: allowedOrigins,
    credentials: true, // allow the auth cookies
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
}));
app.use(globalLimiter);
// JSON only (no urlencoded parser): HTML forms, the classic CSRF vehicle,
// cannot produce a body this API will read. 32 kB caps payload-based DoS.
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(requireTrustedOrigin(allowedOrigins));

try {
    const swaggerDocument = YAML.load(path.resolve(__dirname, "../docs/swagger.yaml"));
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
    logger.warn(`Swagger file load failed: ${e.message}`);
}

// ─── Routes ──────────────────────────────────
app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/auth", authLimiter, authRouter);
app.use("/api/v1/workspaces", workspaceRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/projects/:projectId/sprints", sprintRouter);
app.use("/api/v1/projects/:projectId/tasks/:taskId/comments", commentRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/notes", noteRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/search", searchRouter);
app.use("/api/v1/admin", adminRouter);

app.use((req, res, next) => {
    next(new ApiError(404, `API route not found: ${req.method} ${req.path}`));
});

/**
 * Central error handler: the ONLY place errors become HTTP responses.
 * Controllers throw (ApiError for expected failures); asynchandler and
 * Express 5 forward rejected promises here.
 *
 *  - Known library errors are translated to the right 4xx.
 *  - Anything else is a bug: 500, full stack in the log, and a generic message
 *    to the client, since internal messages ("Task is not defined") reveal code.
 *  - Every error body carries the requestId that finds its log line.
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    let error = err;

    if (!(error instanceof ApiError)) {
        if (error.name === "CastError") {
            error = new ApiError(400, `Invalid value for '${error.path}'`);
        } else if (error.code === 11000) {
            const fields = Object.keys(error.keyValue || {}).join(", ") || "field";
            error = new ApiError(409, `A record with this ${fields} already exists`);
        } else if (error.name === "ValidationError") {
            const messages = Object.values(error.errors || {}).map((e) => e.message);
            error = new ApiError(400, messages.join("; ") || "Validation failed");
        } else if (error.name === "VersionError") {
            error = new ApiError(409, "This record was modified by someone else. Reload and try again.");
        } else if (error.type === "entity.parse.failed") {
            error = new ApiError(400, "Malformed JSON body");
        } else if (error.type === "entity.too.large") {
            error = new ApiError(413, "Request body too large");
        } else {
            const status = error.statusCode ?? error.status;
            error = status >= 400 && status < 500
                ? new ApiError(status, error.message)
                : Object.assign(new ApiError(500, "Internal Server Error"), { cause: err });
        }
    }

    if (error.statusCode >= 500) {
        logger.error("Unhandled error", { requestId: req.id, userId: req.user?._id?.toString(), err: error.cause ?? err });
    }
    res.locals.errorMessage = error.statusCode >= 500 ? (err.message ?? String(err)) : error.message;

    const exposeInternals = process.env.NODE_ENV === "development" && error.statusCode >= 500;
    return res.status(error.statusCode).json({
        statusCode: error.statusCode,
        success: false,
        message: exposeInternals ? err.message : error.message,
        errors: error.errors || [],
        requestId: req.id,
        ...(exposeInternals ? { stack: err.stack } : {}),
    });
});

export default app;
