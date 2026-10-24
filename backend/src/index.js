/**
 * FILE: backend/src/index.js
 *
 * PURPOSE
 *   The process entry point (`npm start` / `npm run dev` run this file).
 *   It does three things, in order:
 *     1. validates configuration (importing config/env.js runs the checks),
 *     2. connects to MongoDB,
 *     3. starts the HTTP server on PORT (default 8000),
 *   and then installs handlers for a graceful shutdown.
 *
 * WHERE IT FITS
 *   index.js  ──imports──▶  app.js (the Express app: middleware + routes)
 *             ──imports──▶  db/databaseconnection.js (mongoose.connect)
 *   Tests and the E2E server do NOT use this file: they import app.js directly
 *   and connect to an in-memory MongoDB themselves. Keeping "build the app"
 *   (app.js) separate from "run the app" (index.js) is what makes that possible.
 *
 * KEY CONCEPTS
 *   - Top-level `await`: this project is ESM ("type": "module" in package.json),
 *     so we can `await connectDB()` at module level. The server only starts
 *     listening once the database is reachable.
 *   - Graceful shutdown: see `shutdown` below.
 *
 * INTERVIEW NOTES
 *   Q: Why separate app.js and index.js?
 *   A: Testability. Supertest can drive `app` without opening a port or
 *      touching the real database.
 *   Q: What happens on deploy (SIGTERM)?
 *   A: Stop accepting new connections, finish in-flight requests, close the
 *      Mongo pool, exit 0. A 10s timer forces exit(1) if something hangs.
 */
import "./config/env.js"; // must be first: validates configuration before anything else loads
import mongoose from "mongoose";
import app from "./app.js";
import connectDB from "./db/databaseconnection.js";
import logger from "./utils/logger.js";

// Environment variables are always strings; Number() converts, `|| 8000` covers unset/invalid.
const port = Number(process.env.PORT) || 8000;

// Connect first. If this fails, connectDB() exits the process, so the server
// never accepts requests it cannot serve.
await connectDB();

// app.listen returns Node's http.Server; we keep it so shutdown can close it.
const server = app.listen(port, () => {
    logger.info(`API listening on http://localhost:${port}`);
});

/**
 * Graceful shutdown. A deploy or scale-down sends SIGTERM; instead of dying
 * mid-request we stop accepting connections, let in-flight requests finish,
 * close the database pool, then exit. A timer forces exit if something hangs.
 *
 * @param {string} signal  "SIGTERM" (orchestrator / Docker / Heroku) or "SIGINT" (Ctrl+C).
 */
const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    // Safety net. `.unref()` means this timer alone does not keep Node alive:
    // if everything closes cleanly first, the process exits without waiting 10s.
    setTimeout(() => {
        logger.error("Forced exit: shutdown took longer than 10s");
        process.exit(1);
    }, 10_000).unref();

    // server.close() stops accepting NEW connections and calls back once the
    // existing ones have finished.
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
