import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { signUp, startApi, stopApi } from "./setup.js";

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
