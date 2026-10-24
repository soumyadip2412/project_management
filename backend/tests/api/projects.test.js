import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { addToProject, createProject, signUp, startApi, stopApi } from "./setup.js";

before(startApi);
after(stopApi);

describe("project creation", () => {
    test("records the methodology chosen at creation, and refuses unknown ones", async () => {
        const owner = await signUp("methodology");

        const scrum = await owner.agent.post("/api/v1/projects").send({ name: "Sprinting", methodology: "scrum" }).expect(201);
        assert.equal(scrum.body.data.methodology, "scrum");

        const fallback = await owner.agent.post("/api/v1/projects").send({ name: "Flowing" }).expect(201);
        assert.equal(fallback.body.data.methodology, "kanban");

        await owner.agent.post("/api/v1/projects").send({ name: "Chaos", methodology: "vibes" }).expect(422);
        await owner.agent.post("/api/v1/projects").send({ name: "Injected", methodology: { $ne: null } }).expect(422);
    });
});

describe("derived project keys", () => {
    test("stay unique after a project is deleted, and always start with a letter", async () => {
        const owner = await signUp("keys");
        const create = (name) => owner.agent.post("/api/v1/projects").send({ name }).expect(201);

        const first = await create("Alpha Project");
        const second = await create("Alpha Project");
        assert.equal(first.body.data.key, "ALPHAP");
        assert.equal(second.body.data.key, "ALPHAP2");

        // Deleting the first used to drop the count to 1, so the next derived
        // key was ALPHAP2 again and the create failed with a 409.
        await owner.agent.delete(`/api/v1/projects/${first.body.data._id}`).expect(200);
        const third = await create("Alpha Project");
        assert.notEqual(third.body.data.key, "ALPHAP2");

        const digits = await create("2026 Roadmap");
        assert.match(digits.body.data.key, /^[A-Z][A-Z0-9]{1,9}$/);
        const short = await create("X");
        assert.match(short.body.data.key, /^[A-Z][A-Z0-9]{1,9}$/);
    });
});

describe("WIP limits", () => {
    test("a manager sets limits per status; they round-trip and replace the old set", async () => {
        const owner = await signUp("wipowner");
        const { projectId } = await createProject(owner, "Wip");
        const url = `/api/v1/projects/${projectId}`;

        const first = await owner.agent.put(url).send({ wipLimits: { in_progress: 3, in_review: 2 } }).expect(200);
        assert.equal(first.body.data.settings.wipLimits.in_progress, 3);
        assert.equal(first.body.data.settings.wipLimits.in_review, 2);
        assert.equal(first.body.data.settings.wipLimits.todo, 0);

        const second = await owner.agent.put(url).send({ wipLimits: { in_progress: 4 } }).expect(200);
        assert.equal(second.body.data.settings.wipLimits.in_progress, 4);
        assert.equal(second.body.data.settings.wipLimits.in_review, 0);

        const read = await owner.agent.get(url).expect(200);
        assert.equal(read.body.data.settings.wipLimits.in_progress, 4);
    });

    test("unknown statuses, fractions, out-of-range values and operator keys are rejected", async () => {
        const owner = await signUp("wipbad");
        const { projectId } = await createProject(owner, "WipBad");
        const url = `/api/v1/projects/${projectId}`;
        for (const wipLimits of [{ doing: 2 }, { in_progress: 2.5 }, { in_progress: -1 }, { in_progress: 100 }, { $set: 1 }, [3], "3"]) {
            await owner.agent.put(url).send({ wipLimits }).expect(422);
        }
    });

    test("a developer cannot change them", async () => {
        const owner = await signUp("wipown2");
        const dev = await signUp("wipdev");
        const { projectId } = await createProject(owner, "WipDev");
        await addToProject(owner, projectId, dev, "developer");
        await dev.agent.put(`/api/v1/projects/${projectId}`).send({ wipLimits: { in_progress: 1 } }).expect(403);
    });
});
