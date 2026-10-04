import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { addToProject, createProject, signUp, startApi, stopApi } from "./setup.js";

before(startApi);
after(stopApi);

// Audit rows are written after the response (fire-and-forget), so poll briefly.
const activityOf = async (agent, wanted) => {
    for (let i = 0; i < 50; i++) {
        const res = await agent.get("/api/v1/dashboard/stats").expect(200);
        const items = res.body.data.recentActivities;
        if (wanted(items)) return items;
        await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error("activity did not appear");
};

describe("dashboard activity feed", () => {
    test("names the task, comment's task, sprint and member each entry is about", async () => {
        const alice = await signUp("feedowner");
        const bob = await signUp("feedmember");
        const { projectId, key } = await createProject(alice, "Feed");
        await addToProject(alice, projectId, bob, "developer");

        const task = (await alice.agent.post(`/api/v1/tasks/${projectId}`).send({ title: "Wire up refunds" }).expect(201)).body.data;
        await bob.agent.post(`/api/v1/projects/${projectId}/tasks/${task._id}/comments`).send({ body: "On it" }).expect(201);
        const sprint = (await alice.agent.post(`/api/v1/projects/${projectId}/sprints`)
            .send({ name: "Sprint 9", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 864e5).toISOString() })
            .expect(201)).body.data;
        await alice.agent.post(`/api/v1/projects/${projectId}/sprints/${sprint._id}/start`).expect(200);

        const items = await activityOf(alice.agent, (all) =>
            ["task", "comment", "sprint", "member"].every((t) => all.some((a) => a.entityType === t)));
        const find = (entityType, action) => items.find((a) => a.entityType === entityType && a.action === action);

        assert.deepEqual(find("task", "created").target, {
            type: "task", label: `${key}-1 Wire up refunds`, taskId: task._id, projectId,
        });
        assert.equal(find("comment", "created").target.label, `${key}-1 Wire up refunds`);
        assert.equal(find("sprint", "sprint_started").target.label, "Sprint 9");
        assert.equal(find("member", "member_added").target.label, bob.user.fullName);
    });

    test("an entry about something deleted has no target, and nothing leaks across projects", async () => {
        const carol = await signUp("feedcarol");
        const dave = await signUp("feeddave");
        const { projectId } = await createProject(carol, "Secret");
        const task = (await carol.agent.post(`/api/v1/tasks/${projectId}`).send({ title: "Classified" }).expect(201)).body.data;
        await carol.agent.delete(`/api/v1/tasks/${projectId}/t/${task._id}`).expect(200);

        const items = await activityOf(carol.agent, (all) => all.some((a) => a.action === "deleted"));
        assert.equal(items.find((a) => a.action === "deleted").target, null);

        const daves = (await dave.agent.get("/api/v1/dashboard/stats").expect(200)).body.data.recentActivities;
        assert.equal(JSON.stringify(daves).includes("Classified"), false);
    });
});
