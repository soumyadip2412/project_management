import { after, before, test } from "node:test";
import assert from "node:assert/strict";

// Must be set before setup.js imports the app (the limiter reads it at import).
// Own file = own process, so the low limit cannot leak into other suites.
process.env.AUTH_RATE_LIMIT_MAX = "5";
const { anon, signUp, startApi, stopApi } = await import("./setup.js");

before(startApi);
after(stopApi);

test("authLimiter guards credential endpoints only, not session housekeeping", async () => {
    // register + login already spent 2 of the 5 allowed credential requests.
    const { agent, email } = await signUp("limit");

    // Page-load traffic must never be throttled by the auth limiter.
    for (let i = 0; i < 12; i += 1) {
        await agent.get("/api/v1/auth/current-user").expect(200);
    }
    await agent.post("/api/v1/auth/refresh-token").expect(200);

    // Credential endpoint: 3 attempts left, then 429.
    for (let i = 0; i < 3; i += 1) {
        await anon().post("/api/v1/auth/login").send({ email, password: "Wrong-Password1" }).expect(401);
    }
    const blocked = await anon().post("/api/v1/auth/login").send({ email, password: "Wrong-Password1" });
    assert.equal(blocked.status, 429);

    // Same bucket protects the other enumeration targets.
    await anon().get("/api/v1/auth/check-email").query({ email }).expect(429);
    await anon().post("/api/v1/auth/forgot-password").send({ email }).expect(429);

    // And the session endpoints still work while that IP is locked out of login.
    await agent.get("/api/v1/auth/current-user").expect(200);
});
