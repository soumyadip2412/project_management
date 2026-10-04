import "./config/env.js"; // must be first: validates configuration before anything else loads
import mongoose from "mongoose";
import app from "./app.js";
import connectDB from "./db/databaseconnection.js";
import logger from "./utils/logger.js";

const port = Number(process.env.PORT) || 8000;

await connectDB();

const server = app.listen(port, () => {
    logger.info(`API listening on http://localhost:${port}`);
});

/**
 * Graceful shutdown. A deploy or scale-down sends SIGTERM; instead of dying
 * mid-request we stop accepting connections, let in-flight requests finish,
 * close the database pool, then exit. A timer forces exit if something hangs.
 */
const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    setTimeout(() => {
        logger.error("Forced exit: shutdown took longer than 10s");
        process.exit(1);
    }, 10_000).unref();

    server.close(async () => {
        await mongoose.disconnect();
        logger.info("Shutdown complete");
        process.exit(0);
    });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// A promise rejected with no handler means a code path forgot to handle an
// error. Log it with its stack; the process keeps serving other requests.
process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", { err: reason });
});
