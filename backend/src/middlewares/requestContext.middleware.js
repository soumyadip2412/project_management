/**
 * FILE: backend/src/middlewares/requestContext.middleware.js
 *
 * PURPOSE
 *   The first middleware in app.js. It assigns a request id and logs exactly
 *   one structured line per request when the response finishes (an "access log").
 *
 * KEY CONCEPTS
 *   - res.on("finish") fires after the response is sent, by which point we
 *     know the status, the duration, and (if verifyJWT/authorize ran) the user
 *     and project. That is why this one middleware can log all of them
 *     despite running first.
 *   - process.hrtime.bigint() is a high-resolution monotonic clock in
 *     nanoseconds, unaffected by system clock changes. Dividing by 1_000_000n
 *     converts to milliseconds (the `n` suffix marks a BigInt).
 *   - A client-supplied X-Request-Id is reused only if it looks safe
 *     (1–64 word characters or dashes). This prevents log injection and lets a
 *     gateway correlate requests across services.
 *
 * INTERVIEW NOTES
 *   Q: Why redact verify-email / reset-password URLs?
 *   A: Those path segments are live secrets (single-use tokens). Logs are
 *      read by many people and tools, so a token in a log is a leaked token.
 */
import { randomUUID } from "crypto";
import logger from "../utils/logger.js";

// Tokens travel in these URL paths; they must never be written to logs.
const redactUrl = (url) =>
    url.replace(/\/(verify-email|reset-password)\/[^/?]+/g, "/$1/[redacted]");

/**
 * Gives every request an id and writes ONE structured log line when it ends.
 *
 * The id is returned in the X-Request-Id header and in error bodies, so a user
 * reporting "it failed" can hand over an id that finds the exact log line:
 * which endpoint, which user, which status, how long, and why.
 * (Replaces morgan, whose Apache-style lines had no user, no id and no reason.)
 */
export const requestContext = (req, res, next) => {
    const incoming = req.get("X-Request-Id");
    req.id = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader("X-Request-Id", req.id);

    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
        const status = res.statusCode;
        // Log level follows the outcome: server bugs = error, client mistakes = warn.
        const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
        logger.log(level, "request", {
            requestId: req.id,
            method: req.method,
            url: redactUrl(req.originalUrl),
            status,
            durationMs: Number((process.hrtime.bigint() - startedAt) / 1_000_000n),
            userId: req.user?._id?.toString(),
            projectId: req.project?._id?.toString(),
            error: res.locals.errorMessage, // set by the error handler
        });
    });

    next();
};
