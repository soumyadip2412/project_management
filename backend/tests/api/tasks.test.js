import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { addToProject, createProject, signUp, startApi, stopApi } from "./setup.js";

before(startApi);
after(stopApi);

describe("task edge cases", () => {
    test("duplicate assignees are stored once", async () => {
        const owner = await signUp("dupeassignee");
        const { projectId } = await createProject(owner, "Dupes");
        const created = await owner.agent
            .post(`/api/v1/tasks/${projectId}`)
            .send({ title: "Twice", assignees: [owner.user._id, owner.user._id] })
            .expect(201);
        assert.equal(created.body.data.assignees.length, 1);

        const updated = await owner.agent
            .put(`/api/v1/tasks/${projectId}/t/${created.body.data._id}`)
            .send({ assignees: [owner.user._id, owner.user._id, owner.user._id] })
            .expect(200);
        assert.equal(updated.body.data.assignees.length, 1);
    });

    test("deleting a task detaches its child tasks instead of leaving a dangling parent", async () => {
        const owner = await signUp("orphan");
        const { projectId } = await createProject(owner, "Orphans");
        const parent = await owner.agent.post(`/api/v1/tasks/${projectId}`).send({ title: "Epic" }).expect(201);
        const child = await owner.agent
            .post(`/api/v1/tasks/${projectId}`)
            .send({ title: "Story", parent: parent.body.data._id })
            .expect(201);

        await owner.agent.delete(`/api/v1/tasks/${projectId}/t/${parent.body.data._id}`).expect(200);
        const after = await owner.agent.get(`/api/v1/tasks/${projectId}/t/${child.body.data._id}`).expect(200);
        assert.equal(after.body.data.parent ?? null, null);
    });
});

describe("comment threads", () => {
    test("a reply to a reply is listed in its thread", async () => {
        const owner = await signUp("threads");
        const { projectId } = await createProject(owner, "Threads");
        const task = await owner.agent.post(`/api/v1/tasks/${projectId}`).send({ title: "Discuss" }).expect(201);
        const base = `/api/v1/projects/${projectId}/tasks/${task.body.data._id}/comments`;

        const root = await owner.agent.post(base).send({ body: "Root" }).expect(201);
        const reply = await owner.agent.post(base).send({ body: "Reply", parentComment: root.body.data._id }).expect(201);
        await owner.agent.post(base).send({ body: "Nested", parentComment: reply.body.data._id }).expect(201);

        const list = await owner.agent.get(base).expect(200);
        const bodies = list.body.data.comments.flatMap((c) => [c.body, ...c.replies.map((r) => r.body)]);
        assert.deepEqual(bodies.sort(), ["Nested", "Reply", "Root"]);
    });
});

describe("workspace membership", () => {
    test("removing someone from a workspace also unassigns them from its tasks", async () => {
        const owner = await signUp("wsowner");
        const dev = await signUp("wsdev");
        const { workspaceId, projectId } = await createProject(owner, "Removal");
        await owner.agent.post(`/api/v1/workspaces/${workspaceId}/invite`).send({ email: dev.email }).expect(200);
        await addToProject(owner, projectId, dev, "developer");

        const task = await owner.agent
            .post(`/api/v1/tasks/${projectId}`)
            .send({ title: "Theirs", assignees: [dev.user._id] })
            .expect(201);

        await owner.agent.delete(`/api/v1/workspaces/${workspaceId}/members/${dev.user._id}`).expect(200);

        const after = await owner.agent.get(`/api/v1/tasks/${projectId}/t/${task.body.data._id}`).expect(200);
        assert.deepEqual(after.body.data.assignees, []);
    });
});
