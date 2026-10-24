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

describe("your work data", () => {
    const day = 864e5;

    test("each recent project carries its active sprint's progress, and my open work is listed", async () => {
        const alice = await signUp("ywalice");
        const bob = await signUp("ywbob");
        const { projectId, key } = await createProject(alice, "Yours");
        await addToProject(alice, projectId, bob, "developer");

        const sprint = (await alice.agent.post(`/api/v1/projects/${projectId}/sprints`)
            .send({ name: "S1", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 7 * day).toISOString() })
            .expect(201)).body.data;
        const create = async (body) => (await alice.agent.post(`/api/v1/tasks/${projectId}`).send(body).expect(201)).body.data;

        await create({ title: "Mine open", storyPoints: 5, sprint: sprint._id, assignees: [alice.user._id], dueDate: new Date(Date.now() + 2 * day).toISOString() });
        const done = await create({ title: "Mine done", storyPoints: 3, sprint: sprint._id, assignees: [alice.user._id] });
        await create({ title: "Bob's", storyPoints: 2, sprint: sprint._id, assignees: [bob.user._id] });
        await alice.agent.post(`/api/v1/projects/${projectId}/sprints/${sprint._id}/start`).expect(200);
        await alice.agent.put(`/api/v1/tasks/${projectId}/t/${done._id}`).send({ status: "done" }).expect(200);
        await create({ title: "Added later", storyPoints: 1, sprint: sprint._id });

        const stats = (await alice.agent.get("/api/v1/dashboard/stats").expect(200)).body.data;
        const project = stats.recentProjects.find((p) => p._id === projectId);
        assert.equal(project.activeSprint.name, "S1");
        assert.equal(project.activeSprint.startPoints, 10);
        assert.equal(project.activeSprint.totalPoints, 11);
        assert.equal(project.activeSprint.remainingPoints, 8);
        assert.equal(project.activeSprint.totalIssues, 4);
        assert.equal(project.activeSprint.openIssues, 3);
        assert.equal(project.activeSprint.myOpenIssues, 1);

        assert.deepEqual(stats.assignedToMe.map((t) => t.title), ["Mine open"]);
        assert.deepEqual(stats.dueSoon.map((t) => t.title), ["Mine open"]);
        assert.equal(stats.assignedToMe[0].project.key, key);
    });

    test("no active sprint gives null, and another user's work never leaks in", async () => {
        const carol = await signUp("ywcarol");
        const eve = await signUp("yweve");
        const { projectId } = await createProject(carol, "Quiet");
        await carol.agent.post(`/api/v1/tasks/${projectId}`).send({ title: "Carol secret", assignees: [carol.user._id] }).expect(201);

        const carols = (await carol.agent.get("/api/v1/dashboard/stats").expect(200)).body.data;
        assert.equal(carols.recentProjects.find((p) => p._id === projectId).activeSprint, null);

        const eves = (await eve.agent.get("/api/v1/dashboard/stats").expect(200)).body.data;
        assert.deepEqual(eves.assignedToMe, []);
        assert.deepEqual(eves.dueSoon, []);
        assert.equal(JSON.stringify(eves).includes("Carol secret"), false);
    });
});
