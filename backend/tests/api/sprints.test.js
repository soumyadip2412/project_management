import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createProject, signUp, startApi, stopApi } from "./setup.js";

before(startApi);
after(stopApi);

const day = 24 * 60 * 60 * 1000;

describe("sprint lifecycle edge cases", () => {
    test("a sprint whose end date has passed cannot be started backwards", async () => {
        const owner = await signUp("latesprint");
        const { projectId } = await createProject(owner, "Late");
        const base = `/api/v1/projects/${projectId}/sprints`;

        const sprint = await owner.agent.post(base).send({
            name: "Overdue",
            startDate: new Date(Date.now() - 20 * day).toISOString(),
            endDate: new Date(Date.now() - 6 * day).toISOString(),
        }).expect(201);

        const res = await owner.agent.post(`${base}/${sprint.body.data._id}/start`);
        assert.equal(res.status, 400);

        // Still planned, so it can be fixed and started.
        await owner.agent.put(`${base}/${sprint.body.data._id}`)
            .send({ endDate: new Date(Date.now() + 7 * day).toISOString() })
            .expect(200);
        const started = await owner.agent.post(`${base}/${sprint.body.data._id}/start`).expect(200);
        assert.ok(new Date(started.body.data.endDate) > new Date(started.body.data.startDate));
    });

    test("default sprint names stay unique after a sprint is deleted", async () => {
        const owner = await signUp("sprintnames");
        const { projectId } = await createProject(owner, "Names");
        const base = `/api/v1/projects/${projectId}/sprints`;
        const body = () => ({ startDate: new Date().toISOString(), endDate: new Date(Date.now() + 14 * day).toISOString() });

        const one = await owner.agent.post(base).send(body()).expect(201);
        await owner.agent.post(base).send(body()).expect(201);
        await owner.agent.delete(`${base}/${one.body.data._id}`).expect(200);
        const third = await owner.agent.post(base).send(body()).expect(201);

        const names = (await owner.agent.get(base).expect(200)).body.data.map((s) => s.name);
        assert.equal(new Set(names).size, names.length, `duplicate names: ${names}`);
        assert.equal(third.body.data.name, "Sprint 3");
    });
});
