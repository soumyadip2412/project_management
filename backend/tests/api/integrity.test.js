/**
 * Input validation, data integrity, audit trail, and the app-level security
 * controls (CSRF origin check, headers, error hygiene).
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { FRONTEND_ORIGIN, addToProject, anon, createProject, model, signUp, startApi, stopApi } from "./setup.js";

before(startApi);
after(stopApi);

const day = 24 * 60 * 60 * 1000;
const sprintBody = (name) => ({ name, startDate: new Date().toISOString(), endDate: new Date(Date.now() + 14 * day).toISOString() });

describe("input validation", () => {
    let alice, projectId;
    before(async () => {
        alice = await signUp("val");
        ({ projectId } = await createProject(alice, "Valid"));
    });

    test("wrong types and bad enums are 422, never 500", async () => {
        const cases = [
            [`/api/v1/tasks/${projectId}`, { title: 123 }],
            [`/api/v1/tasks/${projectId}`, { title: "ok", status: "review" }],
            [`/api/v1/tasks/${projectId}`, { title: "ok", assignees: "not-an-array" }],
            [`/api/v1/tasks/${projectId}`, { title: "ok", assignees: [{ $ne: null }] }],
            ["/api/v1/workspaces", {}],
            [`/api/v1/projects/${projectId}/sprints`, { name: "S", startDate: "2026-10-10", endDate: "2026-10-01" }],
        ];
        for (const [url, body] of cases) {
            const res = await alice.agent.post(url).send(body);
            assert.equal(res.status, 422, `${url} ${JSON.stringify(body)} → ${res.status} ${res.body.message}`);
        }
    });

    test("a MongoDB operator where an email is expected is rejected", async () => {
        const { workspaceId } = await createProject(alice, "Inject");
        await alice.agent.post(`/api/v1/workspaces/${workspaceId}/invite`).send({ email: { $ne: null } }).expect(422);
    });

    test("malformed ids are 400 before any query runs", async () => {
        await alice.agent.get("/api/v1/tasks/not-an-id").expect(400);
        await alice.agent.get(`/api/v1/tasks/${projectId}/t/123`).expect(400);
    });

    test("malformed JSON is a 400, not a 500", async () => {
        await alice.agent.post("/api/v1/workspaces").set("Content-Type", "application/json").send('{"name":').expect(400);
    });

    test("fields the API accepts are actually persisted (parent used to be dropped)", async () => {
        const parent = (await alice.agent.post(`/api/v1/tasks/${projectId}`).send({ title: "Epic" }).expect(201)).body.data;
        const child = (await alice.agent.post(`/api/v1/tasks/${projectId}`)
            .send({ title: "Child", parent: parent._id, originalEstimate: 90 })
            .expect(201)).body.data;
        const Task = await model("Task");
        const stored = await Task.findById(child._id);
        assert.equal(stored.parent.toString(), parent._id);
        assert.equal(stored.timeTracking.originalEstimate, 90);
    });
});

describe("data integrity", () => {
    test("deleting a project removes its data but keeps the audit trail (used to 500)", async () => {
        const owner = await signUp("del");
        const { projectId } = await createProject(owner, "Doomed");
        const task = (await owner.agent.post(`/api/v1/tasks/${projectId}`).send({ title: "t" }).expect(201)).body.data;
        await owner.agent.post(`/api/v1/projects/${projectId}/tasks/${task._id}/comments`).send({ body: "c" }).expect(201);
        await owner.agent.post(`/api/v1/projects/${projectId}/sprints`).send(sprintBody("S1")).expect(201);

        await owner.agent.delete(`/api/v1/projects/${projectId}`).expect(200);

        const [Task, Comment, Sprint, AuditLog] = await Promise.all(["Task", "Comment", "Sprint", "AuditLog"].map(model));
        assert.equal(await Task.countDocuments({ project: projectId }), 0);
        assert.equal(await Comment.countDocuments({ project: projectId }), 0);
        assert.equal(await Sprint.countDocuments({ project: projectId }), 0);
        await owner.agent.get(`/api/v1/projects/${projectId}`).expect(404);

        // Audit writes are fire-and-forget; give the last one a moment.
        await new Promise((resolve) => setTimeout(resolve, 100));
        const actions = (await AuditLog.find({ project: projectId })).map((a) => a.action);
        assert.ok(actions.includes("created") && actions.includes("deleted"), `audit actions: ${actions}`);
    });

    test("issue numbers stay unique under concurrent creation", async () => {
        const owner = await signUp("seq");
        const { projectId, key } = await createProject(owner, "Seq");
        const created = await Promise.all(
            Array.from({ length: 10 }, (_, i) => owner.agent.post(`/api/v1/tasks/${projectId}`).send({ title: `t${i}` }))
        );
        const keys = created.map((r) => r.body.data.issueKey);
        assert.equal(new Set(keys).size, 10);
        assert.ok(keys.every((k) => k.startsWith(`${key}-`)));
    });

    test("only one sprint can be active, even when two starts race", async () => {
        const owner = await signUp("race");
        const { projectId } = await createProject(owner, "Race");
        const base = `/api/v1/projects/${projectId}/sprints`;
        const s1 = (await owner.agent.post(base).send(sprintBody("S1")).expect(201)).body.data;
        const s2 = (await owner.agent.post(base).send(sprintBody("S2")).expect(201)).body.data;

        const results = await Promise.all([
            owner.agent.post(`${base}/${s1._id}/start`),
            owner.agent.post(`${base}/${s2._id}/start`),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);

        const active = await owner.agent.get(`${base}?status=active`).expect(200);
        assert.equal(active.body.data.length, 1);
    });

    test("completing a sprint with a bad target changes nothing (used to half-complete)", async () => {
        const owner = await signUp("complete");
        const { projectId } = await createProject(owner, "Complete");
        const base = `/api/v1/projects/${projectId}/sprints`;
        const sprint = (await owner.agent.post(base).send(sprintBody("S1")).expect(201)).body.data;
        await owner.agent.post(`${base}/${sprint._id}/start`).expect(200);
        await owner.agent.post(`/api/v1/tasks/${projectId}`).send({ title: "unfinished", sprint: sprint._id }).expect(201);

        await owner.agent.post(`${base}/${sprint._id}/complete`)
            .send({ moveIncompleteToSprint: "507f1f77bcf86cd799439011" })
            .expect(400);
        const after = await owner.agent.get(`${base}/${sprint._id}`).expect(200);
        assert.equal(after.body.data.sprint.status, "active");

        await owner.agent.post(`${base}/${sprint._id}/complete`).send({}).expect(200);
        const done = await owner.agent.get(`${base}/${sprint._id}`).expect(200);
        assert.equal(done.body.data.sprint.status, "completed");
        assert.equal(done.body.data.issues.length, 0, "unfinished work moved back to the backlog");
    });

    test("the same workspace name is allowed for different owners, not twice for one", async () => {
        const a = await signUp("wsa");
        const b = await signUp("wsb");
        await a.agent.post("/api/v1/workspaces").send({ name: "Marketing" }).expect(201);
        await b.agent.post("/api/v1/workspaces").send({ name: "Marketing" }).expect(201);
        await a.agent.post("/api/v1/workspaces").send({ name: "Marketing" }).expect(409);
    });
});

describe("audit trail and notifications", () => {
    test("membership changes are audited (they used to fail enum validation silently)", async () => {
        const owner = await signUp("aud");
        const dev = await signUp("auddev");
        const { projectId } = await createProject(owner, "Audit");
        await addToProject(owner, projectId, dev, "developer");
        await owner.agent.put(`/api/v1/projects/${projectId}/members/${dev.user._id}`).send({ newRole: "qa" }).expect(200);
        await owner.agent.delete(`/api/v1/projects/${projectId}/members/${dev.user._id}`).expect(200);

        await new Promise((resolve) => setTimeout(resolve, 100));
        const AuditLog = await model("AuditLog");
        const actions = (await AuditLog.find({ project: projectId, entityType: "member" })).map((a) => a.action);
        for (const action of ["member_invited", "member_added", "role_changed", "member_removed"]) {
            assert.ok(actions.includes(action), `missing ${action}; got ${actions}`);
        }
    });

    test("an unknown audit action fails at startup, not silently at runtime", async () => {
        const { audit } = await import("../../src/middlewares/audit.middleware.js");
        assert.throws(() => audit("project_member", "added"), /unknown entity type/);
        assert.throws(() => audit("task", "role_updated"), /unknown action/);
    });

    test("assignment, status change and @mention create notifications", async () => {
        const owner = await signUp("notif");
        const dev = await signUp("notifdev");
        const { projectId } = await createProject(owner, "Notify");
        await addToProject(owner, projectId, dev, "developer");

        const task = (await owner.agent.post(`/api/v1/tasks/${projectId}`)
            .send({ title: "t", assignees: [dev.user._id] }).expect(201)).body.data;
        await owner.agent.put(`/api/v1/tasks/${projectId}/t/${task._id}`).send({ status: "in_review" }).expect(200);
        await owner.agent.post(`/api/v1/projects/${projectId}/tasks/${task._id}/comments`)
            .send({ body: `@${dev.username} please look` }).expect(201);

        await new Promise((resolve) => setTimeout(resolve, 100));
        const res = await dev.agent.get("/api/v1/notifications").expect(200);
        const types = res.body.data.notifications.map((n) => n.type);
        for (const type of ["task_assigned", "task_status_changed", "comment_mentioned"]) {
            assert.ok(types.includes(type), `missing ${type}; got ${types}`);
        }
    });
});

describe("HTTP-level protections", () => {
    test("state-changing requests from a foreign origin are rejected (CSRF)", async () => {
        const user = await signUp("csrf");
        await user.agent.post("/api/v1/workspaces").set("Origin", "https://evil.example").send({ name: "x" }).expect(403);
        await user.agent.post("/api/v1/workspaces").set("Origin", FRONTEND_ORIGIN).send({ name: "ok" }).expect(201);
    });

    test("form-encoded bodies are not parsed", async () => {
        const user = await signUp("form");
        await user.agent.post("/api/v1/workspaces").type("form").send("name=from-a-form").expect(422);
    });

    test("security headers are set and the framework is not advertised", async () => {
        const res = await anon().get("/api/v1/healthcheck").expect(200);
        assert.equal(res.headers["x-content-type-options"], "nosniff");
        assert.equal(res.headers["x-frame-options"], "DENY");
        assert.equal(res.headers["x-powered-by"], undefined);
        assert.ok(res.headers["x-request-id"]);
    });

    test("errors carry a request id and a consistent envelope", async () => {
        const res = await anon().get("/api/v1/does-not-exist").expect(404);
        assert.equal(res.body.success, false);
        assert.equal(res.body.requestId, res.headers["x-request-id"]);
    });

    test("the readiness probe reports the database", async () => {
        const res = await anon().get("/api/v1/healthcheck/ready").expect(200);
        assert.equal(res.body.data.database, "up");
    });
});
