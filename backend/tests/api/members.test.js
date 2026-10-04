import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { addToProject, createProject, signUp, startApi, stopApi } from "./setup.js";

before(startApi);
after(stopApi);

describe("project members", () => {
    test("pending invitations are listed with who they are for, until accepted", async () => {
        const owner = await signUp("memowner");
        const invitee = await signUp("meminvitee");
        const { projectId } = await createProject(owner, "Members");

        await owner.agent.post(`/api/v1/projects/${projectId}/members`).send({ email: invitee.email, role: "qa" }).expect(200);
        let res = await owner.agent.get(`/api/v1/projects/${projectId}/members`).expect(200);
        assert.equal(res.body.data.invitations.length, 1);
        assert.equal(res.body.data.invitations[0].user.email, invitee.email);
        assert.equal(res.body.data.invitations[0].role, "qa");
        assert.equal(res.body.data.invitations[0].user.password, undefined);

        await invitee.agent.post(`/api/v1/projects/${projectId}/invitations/accept`).expect(200);
        res = await owner.agent.get(`/api/v1/projects/${projectId}/members`).expect(200);
        assert.equal(res.body.data.invitations.length, 0);
        assert.ok(res.body.data.members.some((m) => m.user.email === invitee.email && m.role === "qa"));
    });

    test("a project manager changes a role; a developer cannot; the owner stays a manager", async () => {
        const owner = await signUp("roleowner");
        const dev = await signUp("roledev");
        const viewer = await signUp("roleviewer");
        const { projectId } = await createProject(owner, "Roles");
        await addToProject(owner, projectId, dev, "developer");
        await addToProject(owner, projectId, viewer, "viewer");

        await owner.agent.put(`/api/v1/projects/${projectId}/members/${viewer.user._id}`).send({ newRole: "client" }).expect(200);
        const res = await owner.agent.get(`/api/v1/projects/${projectId}/members`).expect(200);
        assert.equal(res.body.data.members.find((m) => m.user._id === viewer.user._id).role, "client");

        await dev.agent.put(`/api/v1/projects/${projectId}/members/${viewer.user._id}`).send({ newRole: "project_manager" }).expect(403);
        await owner.agent.put(`/api/v1/projects/${projectId}/members/${owner.user._id}`).send({ newRole: "viewer" }).expect(400);
    });
});
