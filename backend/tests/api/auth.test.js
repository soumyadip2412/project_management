import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { PASSWORD, anon, model, signUp, startApi, stopApi } from "./setup.js";

before(startApi);
after(stopApi);

const SECRET_FIELDS = ["password", "refreshToken", "refreshTokenHash", "tokenVersion", "forgetPasswordToken", "emailVerificationToken"];

const cookieFrom = (res, name) =>
    (res.headers["set-cookie"] ?? []).find((c) => c.startsWith(`${name}=`));

describe("session delivery", () => {
    test("login returns the user but no tokens in the body", async () => {
        const { email } = await signUp("body");
        const res = await anon().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200);

        assert.ok(res.body.data.user);
        assert.equal(res.body.data.accessToken, undefined);
        assert.equal(res.body.data.refreshToken, undefined);
        for (const field of SECRET_FIELDS) assert.equal(res.body.data.user[field], undefined, field);
    });

    test("tokens arrive only as httpOnly cookies; the refresh cookie is scoped to /api/v1/auth", async () => {
        const { email } = await signUp("cookie");
        const res = await anon().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200);

        const access = cookieFrom(res, "accessToken");
        const refresh = cookieFrom(res, "refreshToken");
        assert.match(access, /HttpOnly/);
        assert.match(refresh, /HttpOnly/);
        assert.match(refresh, /Path=\/api\/v1\/auth/);
    });

    test("current-user never exposes secrets (it used to return the refresh token)", async () => {
        const { agent } = await signUp("me");
        const res = await agent.get("/api/v1/auth/current-user").expect(200);
        for (const field of SECRET_FIELDS) assert.equal(res.body.data[field], undefined, field);
    });

    test("a bearer header is not an accepted credential", async () => {
        const { email } = await signUp("bearer");
        const login = await anon().post("/api/v1/auth/login").send({ email, password: PASSWORD });
        const token = cookieFrom(login, "accessToken").split(";")[0].split("=")[1];

        await anon().get("/api/v1/auth/current-user").set("Authorization", `Bearer ${token}`).expect(401);
    });
});

describe("revocation", () => {
    test("logout invalidates the access token immediately, not when it expires", async () => {
        const { email } = await signUp("logout");
        const login = await anon().post("/api/v1/auth/login").send({ email, password: PASSWORD });
        const stolen = cookieFrom(login, "accessToken").split(";")[0];

        await anon().get("/api/v1/auth/current-user").set("Cookie", stolen).expect(200);
        await anon().post("/api/v1/auth/logout").set("Cookie", stolen).expect(200);
        await anon().get("/api/v1/auth/current-user").set("Cookie", stolen).expect(401);
    });

    test("deactivating an account locks it out on the next request", async () => {
        const { agent, user } = await signUp("inactive");
        await agent.get("/api/v1/auth/current-user").expect(200);

        const User = await model("User");
        await User.updateOne({ _id: user._id }, { isActive: false });
        await agent.get("/api/v1/auth/current-user").expect(403);
    });

    test("changing the password keeps this session and ends every other one", async () => {
        const { agent, email } = await signUp("pwchange");
        const other = await anon().post("/api/v1/auth/login").send({ email, password: PASSWORD });
        const otherDevice = cookieFrom(other, "accessToken").split(";")[0];

        await agent.post("/api/v1/auth/change-password")
            .send({ oldPassword: PASSWORD, newPassword: "NewPassword456" })
            .expect(200);

        await agent.get("/api/v1/auth/current-user").expect(200);
        await anon().get("/api/v1/auth/current-user").set("Cookie", otherDevice).expect(401);
    });
});

describe("refresh-token rotation", () => {
    test("a refresh rotates the token pair", async () => {
        const { agent } = await signUp("rotate");
        const res = await agent.post("/api/v1/auth/refresh-token").expect(200);
        assert.ok(cookieFrom(res, "accessToken"));
        assert.ok(cookieFrom(res, "refreshToken"));
        assert.equal(res.body.data.accessToken, undefined);
    });

    test("replaying a rotated-out refresh token revokes every session", async () => {
        const { email, user } = await signUp("replay");
        const login = await anon().post("/api/v1/auth/login").send({ email, password: PASSWORD });
        const oldRefresh = cookieFrom(login, "refreshToken").split(";")[0];

        // Legitimate refresh: rotates the token.
        const rotated = await anon().post("/api/v1/auth/refresh-token").set("Cookie", oldRefresh).expect(200);
        const currentAccess = cookieFrom(rotated, "accessToken").split(";")[0];

        // Within the grace window the old token is tolerated (two tabs racing)...
        await anon().post("/api/v1/auth/refresh-token").set("Cookie", oldRefresh).expect(200);

        // ...after it, the same token is treated as stolen.
        const User = await model("User");
        await User.updateOne({ _id: user._id }, { refreshRotatedAt: new Date(Date.now() - 60_000) });
        await anon().post("/api/v1/auth/refresh-token").set("Cookie", oldRefresh).expect(401);

        // Every session is gone, including the legitimately rotated one.
        await anon().get("/api/v1/auth/current-user").set("Cookie", currentAccess).expect(401);
    });
});

describe("credential rules", () => {
    test("weak passwords are rejected", async () => {
        for (const password of ["short1", "allletters", "12345678"]) {
            await anon().post("/api/v1/auth/register")
                .send({ email: `weak${password}@example.com`, username: `weak${password}`, fullName: "W", password })
                .expect(422);
        }
    });

    test("a MongoDB operator in the login email is rejected before any query", async () => {
        await signUp("victim");
        await anon().post("/api/v1/auth/login").send({ email: { $ne: null }, password: PASSWORD }).expect(422);
    });

    test("the same 401 for an unknown email and a wrong password", async () => {
        const { email } = await signUp("enum");
        const unknown = await anon().post("/api/v1/auth/login").send({ email: "nobody@example.com", password: PASSWORD });
        const wrong = await anon().post("/api/v1/auth/login").send({ email, password: "WrongPassword1" });
        assert.equal(unknown.status, 401);
        assert.equal(wrong.status, 401);
        assert.equal(unknown.body.message, wrong.body.message);
    });

    test("a deactivated account is only revealed to someone who knows the password", async () => {
        const { email, user } = await signUp("hidden");
        const User = await model("User");
        await User.updateOne({ _id: user._id }, { isActive: false });

        await anon().post("/api/v1/auth/login").send({ email, password: "WrongPassword1" }).expect(401);
        await anon().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(403);
    });

    test("registration cannot set privileged fields", async () => {
        const res = await anon().post("/api/v1/auth/register").send({
            email: "sneaky@example.com", username: "sneaky", fullName: "S", password: PASSWORD,
            systemRole: "super_admin", isEmailVerified: true,
        }).expect(201);
        assert.equal(res.body.data.user.systemRole, "member");
        assert.equal(res.body.data.user.isEmailVerified, false);
    });
});

describe("email links", () => {
    const mail = () => import("../../src/utils/mail.js");
    // Follows the link from the newest email to `to`, exactly as a user would.
    // Forgot-password mail is sent without awaiting, so wait briefly for it.
    const linkFrom = async (to, page) => {
        const { testOutbox } = await mail();
        const pattern = new RegExp(String.raw`(https?://[^\s/]+)/auth/${page}/([A-Za-z0-9]+)`);
        for (let i = 0; i < 50; i++) {
            const mail = [...testOutbox].reverse().find((m) => m.to === to && pattern.test(m.text));
            if (mail) {
                const [, origin, token] = mail.text.match(pattern);
                return { origin, token };
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw new Error(`no ${page} email to ${to}; outbox: ${JSON.stringify(testOutbox.map((m) => m.to))}`);
    };

    test("the verification email links to the frontend page, and the token works once", async () => {
        const { agent, email } = await signUp("verify");
        const { origin, token } = await linkFrom(email, "verify-email");

        // It used to link straight at the API, which showed users raw JSON.
        assert.equal(origin, "http://localhost:5173");

        await anon().get(`/api/v1/auth/verify-email/${token}`).expect(200);
        const me = await agent.get("/api/v1/auth/current-user").expect(200);
        assert.equal(me.body.data.isEmailVerified, true);

        await anon().get(`/api/v1/auth/verify-email/${token}`).expect(400);
        await agent.post("/api/v1/auth/resend-email-verification").expect(409);
    });

    test("resending replaces the verification link", async () => {
        const { agent, email } = await signUp("resend");
        const first = await linkFrom(email, "verify-email");

        await agent.post("/api/v1/auth/resend-email-verification").expect(200);
        const second = await linkFrom(email, "verify-email");
        assert.notEqual(second.token, first.token);

        await anon().get(`/api/v1/auth/verify-email/${first.token}`).expect(400);
        await anon().get(`/api/v1/auth/verify-email/${second.token}`).expect(200);
    });

    test("the reset email links to the frontend page; resetting ends every session and the token works once", async () => {
        const { agent, email } = await signUp("reset");
        await anon().post("/api/v1/auth/forgot-password").send({ email }).expect(200);
        const { origin, token } = await linkFrom(email, "reset-password");
        assert.equal(origin, "http://localhost:5173");

        await anon().post(`/api/v1/auth/reset-password/${token}`).send({ newPassword: "Weak" }).expect(422);
        await anon().post(`/api/v1/auth/reset-password/${token}`).send({ newPassword: "Recovered123" }).expect(200);

        await agent.get("/api/v1/auth/current-user").expect(401);
        await anon().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(401);
        await anon().post("/api/v1/auth/login").send({ email, password: "Recovered123" }).expect(200);

        await anon().post(`/api/v1/auth/reset-password/${token}`).send({ newPassword: "Another123" }).expect(400);
    });
});
