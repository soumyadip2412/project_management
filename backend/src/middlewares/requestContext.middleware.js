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
