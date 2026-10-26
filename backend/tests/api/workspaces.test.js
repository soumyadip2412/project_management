import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createProject, signUp, startApi, stopApi } from "./setup.js";

before(startApi);
after(stopApi);

const addToWorkspace = (owner, workspaceId, member, role) =>
    owner.agent.post(`/api/v1/workspaces/${workspaceId}/invite`).send({ email: member.email, role }).expect(200);

describe("deleting a workspace", () => {
    test("the owner can delete an empty workspace", async () => {
        const owner = await signUp("wsdel");
        const ws = (await owner.agent.post("/api/v1/workspaces").send({ name: "Short lived" }).expect(201)).body.data;

        await owner.agent.delete(`/api/v1/workspaces/${ws._id}`).expect(200);

        await owner.agent.get(`/api/v1/workspaces/${ws._id}`).expect(404);
        const list = (await owner.agent.get("/api/v1/workspaces").expect(200)).body.data;
        assert.ok(!list.some((w) => w._id === ws._id));
    });

    test("admins, members and outsiders cannot delete it", async () => {
        const owner = await signUp("wsdelowner");
        const admin = await signUp("wsdeladmin");
        const member = await signUp("wsdelmember");
        const outsider = await signUp("wsdeloutsider");
        const ws = (await owner.agent.post("/api/v1/workspaces").send({ name: "Guarded" }).expect(201)).body.data;
        await addToWorkspace(owner, ws._id, admin, "admin");
        await addToWorkspace(owner, ws._id, member, "member");

        await admin.agent.delete(`/api/v1/workspaces/${ws._id}`).expect(403);
        await member.agent.delete(`/api/v1/workspaces/${ws._id}`).expect(403);
        await outsider.agent.delete(`/api/v1/workspaces/${ws._id}`).expect(403);
        await owner.agent.get(`/api/v1/workspaces/${ws._id}`).expect(200);
    });

    test("a workspace that still has projects is kept, and the error says why", async () => {
        const owner = await signUp("wsdelproj");
        const { workspaceId, projectId } = await createProject(owner, "Keeper");

        const res = await owner.agent.delete(`/api/v1/workspaces/${workspaceId}`).expect(409);
        assert.match(res.body.message, /1 project/);
        await owner.agent.get(`/api/v1/workspaces/${workspaceId}`).expect(200);

        // Once the project is gone, the workspace can be deleted.
        await owner.agent.delete(`/api/v1/projects/${projectId}`).expect(200);
        await owner.agent.delete(`/api/v1/workspaces/${workspaceId}`).expect(200);
    });
});
