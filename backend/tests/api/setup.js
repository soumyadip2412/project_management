/**
 * API integration-test harness.
 *
 * Boots the REAL Express app (every route, middleware and model) against a
 * throwaway in-memory MongoDB, and drives it over HTTP with supertest. Nothing
 * is mocked: if a test passes here, the same request works against the server.
 *
 * Each test file calls startApi() once; its data is isolated from other files
 * because node --test runs every file in its own process.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

export const FRONTEND_ORIGIN = "http://localhost:5173";
export const PASSWORD = "Password123";

let mongo;
let app;
let mongoose;
let counter = 0;

export const startApi = async () => {
    // Environment must be set BEFORE the app is imported: env.js validates it
    // at import time, and dotenv never overrides values that already exist, so
    // the developer's real .env (database, mail) cannot leak in.
    process.env.NODE_ENV = "test";
    process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
    process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
    process.env.CORS_ORIGIN = FRONTEND_ORIGIN;
    process.env.FORGOT_PASSWORD_REDIRECT_URL = `${FRONTEND_ORIGIN}/auth/reset-password`;
    process.env.EMAIL_VERIFICATION_REDIRECT_URL = `${FRONTEND_ORIGIN}/auth/verify-email`;
    process.env.AUTH_RATE_LIMIT_MAX = "100000";
    process.env.GLOBAL_RATE_LIMIT_MAX = "100000";
    delete process.env.REDIS_URL;

    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URL = mongo.getUri("projectcamp_test");

    ({ default: mongoose } = await import("mongoose"));
    const { default: connectDB } = await import("../../src/db/databaseconnection.js");
    ({ default: app } = await import("../../src/app.js"));

    await connectDB();
    // Build every index now: some tests rely on unique/partial indexes
    // (e.g. one active sprint per project) that Mongoose otherwise builds lazily.
    await mongoose.connection.syncIndexes();
    return app;
};

export const stopApi = async () => {
    await mongoose.disconnect();
    await mongo.stop();
};

/** A plain request with no session. */
export const anon = () => request(app);

/**
 * Registers and logs in a fresh user. Returns a supertest agent that keeps the
 * session cookies between requests (exactly like a browser), plus the user.
 */
export const signUp = async (tag = "user") => {
    counter += 1;
    const username = `${tag}${counter}`.toLowerCase();
    const email = `${username}@example.com`;
    const agent = request.agent(app);

    await agent
        .post("/api/v1/auth/register")
        .send({ email, username, fullName: `${tag} ${counter}`, password: PASSWORD })
        .expect(201);
    const login = await agent.post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200);

    return { agent, user: login.body.data.user, email, username };
};

/** Direct model access for arranging state a public endpoint cannot create. */
export const model = async (name) => (await import("mongoose")).default.model(name);

/** Creates a workspace + project owned by `owner`; returns their ids. */
export const createProject = async (owner, name = "Apollo") => {
    const ws = await owner.agent.post("/api/v1/workspaces").send({ name: `${name} WS ${++counter}` }).expect(201);
    const project = await owner.agent
        .post("/api/v1/projects")
        .send({ name, workspaceId: ws.body.data._id })
        .expect(201);
    return { workspaceId: ws.body.data._id, projectId: project.body.data._id, key: project.body.data.key };
};

/** Invites `member` to the project with `role` and has them accept. */
export const addToProject = async (owner, projectId, member, role) => {
    await owner.agent.post(`/api/v1/projects/${projectId}/members`).send({ email: member.email, role }).expect(200);
    await member.agent.post(`/api/v1/projects/${projectId}/invitations/accept`).expect(200);
};
