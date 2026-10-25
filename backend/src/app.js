/**
 * FILE: backend/src/app.js
 *
 * PURPOSE
 *   Builds and exports the Express application: global middleware, the API
 *   routers, the 404 fallback and the central error handler. It does NOT
 *   listen on a port; index.js does that (tests import this file directly).
 *
 * THE LIFE OF A REQUEST (read this top to bottom)
 *   1. requestContext        gives the request an id and logs one line when it finishes
 *   2. securityHeaders       sets helmet-style headers (nosniff, frame-deny, ...)
 *   3. cors                  only allow-listed browser origins may read responses
 *   4. globalLimiter         rate limit per IP (429 when exceeded)
 *   5. express.json          parse a JSON body (max 32 kB)
 *   6. cookieParser          populate req.cookies (the auth tokens live there)
 *   7. passport.initialize   OAuth (Google/GitHub) support
 *   8. requireTrustedOrigin  CSRF defence: unsafe methods from a foreign Origin → 403
 *   9. router for /api/v1/<resource>, which adds its OWN per-route pipeline:
 *        verifyJWT → authorizeProject/Workspace/System → validator → validate → audit → controller
 *  10. 404 handler           no route matched
 *  11. error handler         every thrown/forwarded error becomes a JSON response
 *
 * USES
 *   middlewares/*, routes/*, utils/api-errors.js (ApiError), utils/logger.js,
 *   config/passport.js, docs/swagger.yaml (served at /api-docs).
 *
 * INTERVIEW NOTES
 *   Q: Why does middleware order matter?
 *   A: Express runs middleware in registration order. For example, CORS must
 *      run before the rate limiter, or a 429 has no CORS headers and the
 *      browser shows a confusing "network error" instead of "too many requests".
 *   Q: How do you protect a cookie-based API from CSRF?
 *   A: Three layers: SameSite cookies, JSON-only body parsing (an HTML form
 *      cannot send application/json), and an Origin allow-list check on
 *      POST/PUT/PATCH/DELETE (requireTrustedOrigin).
 *   Q: How are errors handled?
 *   A: Controllers throw; asynchandler / Express 5 forward the rejection to the
 *      ONE error handler at the bottom, which maps known errors to 4xx and hides
 *      internals of 500s from clients.
 */
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
import { globalLimiter } from "./middlewares/rateLimiter.middleware.js";
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

// ESM has no built-in __dirname (CommonJS had one), so derive it from this file's URL.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CORS_ORIGIN may list several origins separated by commas, e.g.
// "https://app.example.com, https://staging.example.com".
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
    exposedHeaders: ["X-Request-Id"], // lets the SPA read the id to show it in bug reports
}));
app.use(globalLimiter);
// JSON only (no urlencoded parser): HTML forms, the classic CSRF vehicle,
// cannot produce a body this API will read. 32 kB caps payload-based DoS.
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(requireTrustedOrigin(allowedOrigins));

// Interactive API documentation (Swagger UI). Optional: if the YAML is missing
// or broken the API still starts, with a warning in the log.
try {
    const swaggerDocument = YAML.load(path.resolve(__dirname, "../docs/swagger.yaml"));
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
    logger.warn(`Swagger file load failed: ${e.message}`);
}

// ─── Routes ──────────────────────────────────
// Every resource gets its own router (src/routes/*). Each router applies its
// own auth/authorization/validation pipeline per route. Paths containing
// ":projectId" (sprints, comments) are nested routers created with
// `Router({ mergeParams: true })` so they can read the parent's params.
// authLimiter (stricter) is applied per route inside auth.routes.js, only to the
// credential/enumeration endpoints, so page-load calls such as current-user and
// refresh-token are not throttled by it (the global limiter still covers them).
app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/auth", authRouter);
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

// No router matched: turn it into a JSON 404 through the error handler below,
// so even "not found" responses have the standard error shape.
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
 *
 * Express recognises an error handler by its FOUR parameters; `next` must stay
 * in the signature even though it is unused (hence the eslint-disable below).
 *
 * Response shape: { statusCode, success: false, message, errors[], requestId, stack? }
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    let error = err;

    // Normalise "foreign" errors (Mongoose, MongoDB driver, body-parser, ...)
    // into our own ApiError so the response code below has one shape to handle.
    if (!(error instanceof ApiError)) {
        if (error.name === "CastError") {
            // Mongoose could not cast a value, e.g. "abc" is not a valid ObjectId.
            error = new ApiError(400, `Invalid value for '${error.path}'`);
        } else if (error.code === 11000) {
            // MongoDB duplicate key: a UNIQUE index rejected the write (e.g. same email).
            const fields = Object.keys(error.keyValue || {}).join(", ") || "field";
            error = new ApiError(409, `A record with this ${fields} already exists`);
        } else if (error.name === "ValidationError") {
            // Mongoose schema validation (required, enum, min/max ...).
            const messages = Object.values(error.errors || {}).map((e) => e.message);
            error = new ApiError(400, messages.join("; ") || "Validation failed");
        } else if (error.name === "VersionError") {
            // Optimistic concurrency: the document changed (its __v moved on)
            // between our read and our save.
            error = new ApiError(409, "This record was modified by someone else. Reload and try again.");
        } else if (error.type === "entity.parse.failed") {
            // express.json() received a body that is not valid JSON.
            error = new ApiError(400, "Malformed JSON body");
        } else if (error.type === "entity.too.large") {
            // Body exceeded the 32 kB limit.
            error = new ApiError(413, "Request body too large");
        } else {
            // Some libraries (http-errors) attach a status. Trust it only if it
            // is a 4xx; everything else is treated as an unknown bug → 500, and
            // the original error is kept as `cause` for the log.
            const status = error.statusCode ?? error.status;
            error = status >= 400 && status < 500
                ? new ApiError(status, error.message)
                : Object.assign(new ApiError(500, "Internal Server Error"), { cause: err });
        }
    }

    // 4xx are the client's fault and expected; only 5xx get a full error log.
    if (error.statusCode >= 500) {
        logger.error("Unhandled error", { requestId: req.id, userId: req.user?._id?.toString(), err: error.cause ?? err });
    }
    // requestContext reads this when it writes the per-request log line.
    res.locals.errorMessage = error.statusCode >= 500 ? (err.message ?? String(err)) : error.message;

    // Show the real message and stack only to developers running locally.
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
