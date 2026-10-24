/**
 * FILE: backend/src/db/databaseconnection.js
 *
 * PURPOSE
 *   Opens the single, shared Mongoose connection to MongoDB. Called once by
 *   index.js before the HTTP server starts.
 *
 * BEHAVIOUR
 *   - Connects to MONGO_URL (e.g. MongoDB Atlas) or, if that is unset,
 *     mongodb://127.0.0.1:27017/projmanage.
 *   - In production a failed connection is fatal (exit 1).
 *   - In development it retries once against a local MongoDB, then exits.
 *
 * KEY CONCEPTS
 *   - Mongoose keeps a connection POOL. After this single `connect`, every
 *     model (User.find, Task.create, ...) reuses it; nobody opens their own.
 *   - serverSelectionTimeoutMS limits how long to wait for a reachable server
 *     before giving up (the default is 30s). A short value means fast feedback.
 *   - Readiness: /api/v1/healthcheck/ready reports 503 until
 *     mongoose.connection.readyState === 1 (connected).
 *
 * INTERVIEW NOTES
 *   Q: Why exit instead of running without a database?
 *   A: Every endpoint needs the database. A process that cannot serve should
 *      die so the orchestrator restarts it or alerts someone.
 */
import mongoose from "mongoose";
import logger from "../utils/logger.js";

/**
 * Connects Mongoose to MongoDB, with a development-only local fallback.
 * Resolves once connected; otherwise terminates the process.
 */
const connectDB = async () => {
    const isProduction = process.env.NODE_ENV === "production";
    const mongoUri = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/projmanage";

    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
        logger.info("✅ MongoDB connected successfully");
    } catch (error) {
        if (isProduction) {
            logger.error("❌ FATAL: Production MongoDB connection failed. Halting process to avoid data corruption.", error);
            process.exit(1);
        }

        // Development convenience: e.g. Atlas is unreachable offline, so try a local mongod.
        logger.warn("⚠️ Remote MongoDB connection failed in development, attempting local MongoDB fallback...", error.message);
        try {
            await mongoose.connect("mongodb://127.0.0.1:27017/projmanage", { serverSelectionTimeoutMS: 3000 });
            logger.info("✅ Local development MongoDB connected successfully");
        } catch (localErr) {
            logger.error("❌ Both Remote and Local MongoDB connections failed", localErr);
            process.exit(1);
        }
    }
};

export default connectDB;
