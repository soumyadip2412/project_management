/**
 * FILE: backend/src/middlewares/rateLimiter.middleware.js
 *
 * PURPOSE
 *   Two rate limiters (express-rate-limit), both counting requests per client
 *   IP in a 15-minute window:
 *     globalLimiter  every API request          default 500 / 15 min
 *     authLimiter    credential endpoints only       default 20 / 15 min
 *   When the limit is exceeded the client gets HTTP 429 Too Many Requests,
 *   with RateLimit-* headers telling it when to retry.
 *
 * WHERE IT FITS
 *   app.js: globalLimiter is global middleware (after CORS); authLimiter is
 *   applied per route in auth.routes.js (login, register, check-email, ...).
 *
 * INTERVIEW NOTES
 *   Q: Why a stricter limit on auth routes?
 *   A: Login, register and forgot-password are the brute-force and account
 *      enumeration targets; normal users rarely hit them 20 times in 15 minutes.
 *   Q: Why does TRUST_PROXY matter here?
 *   A: Limits are per req.ip. Behind a proxy without "trust proxy", every
 *      client appears to have the proxy's IP, so everyone shares ONE bucket.
 *   Q: Why `passOnStoreError: true`?
 *   A: Availability over strictness: if Redis dies, the API keeps working
 *      without rate limiting rather than rejecting every request.
 */
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import logger from "../utils/logger.js";

/**
 * Rate limiting.
 *
 * Counters live in memory by default, which is correct for ONE server process.
 * With several instances behind a load balancer, each would count separately
 * (so a client gets N× the limit), and that is the single reason Redis exists
 * in this project: set REDIS_URL and all instances share one counter.
 *
 * The store is chosen once at startup. If Redis is configured but unreachable,
 * startup gives up after a few attempts and falls back to memory (logged
 * loudly) rather than hanging the boot forever.
 */
const connectRedis = async (url) => {
    const client = createClient({
        url,
        socket: {
            connectTimeout: 3000,
            reconnectStrategy: (retries) => (retries > 5 ? new Error("Redis unreachable") : Math.min(retries * 200, 2000)),
        },
    });
    client.on("error", (err) => logger.warn(`Redis (rate limiter): ${err.message}`));

    try {
        await client.connect();
        logger.info("Rate limiter using Redis (shared across instances)");
        return client;
    } catch (err) {
        logger.error(`Redis unavailable, rate limiter falls back to per-process memory: ${err.message}`);
        return undefined;
    }
};

// Top-level await: module loading (and therefore app startup) waits until
// the Redis decision is made.
const redis = process.env.REDIS_URL ? await connectRedis(process.env.REDIS_URL) : undefined;

// Limits are env-tunable so the E2E server can raise them; defaults are production values.
const intFromEnv = (name, fallback) => {
    const parsed = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Builds one limiter.
 * @param {number} max      requests allowed per IP per 15 minutes
 * @param {string} message  body message for the 429 response
 * @param {string} prefix   Redis key prefix, so the limiters' counters stay separate
 */
const limiter = (max, message, prefix) =>
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: max, // per client IP per window
        standardHeaders: "draft-7",
        legacyHeaders: false,
        // undefined → the default in-memory store. Each limiter gets its own
        // key prefix so their counters do not collide in Redis.
        store: redis && new RedisStore({ sendCommand: (...args) => redis.sendCommand(args), prefix }),
        // If the store fails mid-flight (Redis outage), let requests through
        // rather than turning a cache outage into a full API outage.
        passOnStoreError: true,
        message: { success: false, message },
    });

export const globalLimiter = limiter(intFromEnv("GLOBAL_RATE_LIMIT_MAX", 500), "Too many requests, please try again later", "rl:global:");

// Much stricter: login/register/reset are the brute-force and enumeration targets.
export const authLimiter = limiter(
    intFromEnv("AUTH_RATE_LIMIT_MAX", 20),
    "Too many authentication attempts. Please try again after 15 minutes.",
    "rl:auth:"
);
