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
