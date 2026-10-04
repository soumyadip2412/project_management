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

const redis = process.env.REDIS_URL ? await connectRedis(process.env.REDIS_URL) : undefined;

// Limits are env-tunable so the E2E server can raise them; defaults are production values.
const intFromEnv = (name, fallback) => {
    const parsed = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

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
