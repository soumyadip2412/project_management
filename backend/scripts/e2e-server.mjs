/**
 * Starts the real API against an ephemeral in-memory MongoDB.
 *
 * Why this exists: end-to-end tests need a running backend, and pointing them at
 * the configured Atlas cluster would write test users, projects and tasks into
 * real data. This boots the actual `src/app.js` — same routes, same middleware,
 * same validation — against a throwaway database that is discarded on exit.
 *
 * Usage:  npm run e2e:server            (defaults to port 8000)
 *         PORT=8123 npm run e2e:server
 *
 * Note the env is set BEFORE importing anything from src/. dotenv does not
 * override variables that are already set, so the real .env cannot leak its
 * MONGO_URL (or Redis, or mail credentials) into this process.
 */
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = process.env.PORT || 8000;
// `npm run demo`: same server, seeded with the demo team, for the normal dev
// frontend on :5173 instead of the Playwright one on :5199.
const DEMO = process.argv.includes("--seed-demo");
const FRONTEND = DEMO ? "http://localhost:5173" : "http://localhost:5199";

process.env.NODE_ENV = "test";
process.env.ACCESS_TOKEN_SECRET = "e2e-access-secret";
process.env.REFRESH_TOKEN_SECRET = "e2e-refresh-secret";
process.env.ACCESS_TOKEN_EXPIRY = "1d";
process.env.REFRESH_TOKEN_EXPIRY = "10d";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5199";
// Email links point at the frontend in use (Playwright's :5199, or :5173 for the demo).
// Override them so the developer's .env cannot send them elsewhere.
process.env.FORGOT_PASSWORD_REDIRECT_URL = `${FRONTEND}/auth/reset-password`;
process.env.EMAIL_VERIFICATION_REDIRECT_URL = `${FRONTEND}/auth/verify-email`;
// Leave REDIS_URL unset so the rate limiter uses its in-memory store.
delete process.env.REDIS_URL;
// All E2E traffic shares one IP, so the production auth limit (20 per 15 min)
// blocks the suite after a couple of tests. Raise it here only.
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || "100000";
process.env.GLOBAL_RATE_LIMIT_MAX = process.env.GLOBAL_RATE_LIMIT_MAX || "100000";

console.log("[e2e] starting in-memory MongoDB…");
const mongo = await MongoMemoryServer.create();
process.env.MONGO_URL = mongo.getUri("projectcamp_e2e");
console.log(`[e2e] MongoDB ready at ${process.env.MONGO_URL}`);

const { default: connectDB } = await import("../src/db/databaseconnection.js");
const { default: app } = await import("../src/app.js");
const { testOutbox } = await import("../src/utils/mail.js");
const { default: express } = await import("express");

await connectDB();

// Test-only route, mounted outside the real app so it never exists in
// production: the newest email sent to ?to=, so a browser test can follow the
// same verify/reset link a user would click.
const root = express();
root.get("/__e2e/last-email", (req, res) => {
  const mail = [...testOutbox].reverse().find((m) => m.to === req.query.to);
  if (!mail) return res.status(404).json({ message: "no email for that address yet" });
  res.json(mail);
});
root.use(app);

const server = root.listen(PORT, async () => {
  console.log(`[e2e] API listening on http://localhost:${PORT}`);
  if (DEMO) {
    const { seedDemo } = await import("./seed-demo.mjs");
    await seedDemo(`http://localhost:${PORT}`).catch((err) => console.error(`[demo] failed: ${err.message}`));
    console.log(`[demo] open ${FRONTEND} and sign in. Data is lost when this server stops.`);
  }
  console.log("[e2e] ready");
});

const shutdown = async (signal) => {
  console.log(`\n[e2e] ${signal} — shutting down`);
  await new Promise((resolve) => server.close(resolve));
  const mongoose = (await import("mongoose")).default;
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
