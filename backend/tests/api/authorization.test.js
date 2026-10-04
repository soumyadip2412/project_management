/**
 * Authorization, tested the way an attacker would probe it: a second user
 * replays the victim's ids against every scope. Frontend checks are irrelevant
 * here; these requests go straight to the API.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { addToProject, createProject, model, signUp, startApi, stopApi } from "./setup.js";

before(startApi);
after(stopApi);

const createTask = async (actor, projectId, body = {}) =>
    (await actor.agent.post(`/api/v1/tasks/${projectId}`).send({ title: "Task", ...body }).expect(201)).body.data;

describe("cross-tenant access (BOLA / IDOR)", () => {
    let alice, mallory, alicesProject, alicesTask;

    before(async () => {
        alice = await signUp("alice");
        mallory = await signUp("mallory");
        alicesProject = await createProject(alice, "Secret");
        alicesTask = await createTask(alice, alicesProject.projectId, { title: "Confidential roadmap" });
    });

    test("a non-member cannot read or change anything in the project", async () => {
        const { projectId } = alicesProject;
        const taskId = alicesTask._id;
        const denied = [
            mallory.agent.get(`/api/v1/projects/${projectId}`),
            mallory.agent.get(`/api/v1/projects/${projectId}/members`),
            mallory.agent.get(`/api/v1/tasks/${projectId}`),
            mallory.agent.get(`/api/v1/tasks/${projectId}/t/${taskId}`),
            mallory.agent.put(`/api/v1/tasks/${projectId}/t/${taskId}`).send({ title: "pwned" }),
            mallory.agent.delete(`/api/v1/tasks/${projectId}/t/${taskId}`),
            mallory.agent.get(`/api/v1/projects/${projectId}/sprints`),
            mallory.agent.get(`/api/v1/projects/${projectId}/tasks/${taskId}/comments`),
            mallory.agent.get(`/api/v1/notes/${projectId}`),
            mallory.agent.delete(`/api/v1/projects/${projectId}`),
        ];
        for (const res of await Promise.all(denied)) {
            assert.equal(res.status, 403, `${res.req.method} ${res.req.path} should be 403`);
        }
    });

    test("search cannot be pointed at someone else's project (was: full task leak)", async () => {
        const res = await mallory.agent
            .get(`/api/v1/search?q=Confidential&projectId=${alicesProject.projectId}`)
            .expect(200);
        assert.deepEqual(res.body.data.tasks, []);
        assert.deepEqual(res.body.data.notes, []);
    });

    test("user search only returns collaborators, not every account", async () => {
        const res = await mallory.agent.get("/api/v1/search?q=alice&type=user").expect(200);
        assert.deepEqual(res.body.data.users, []);
    });

    test("cannot create a project inside another user's workspace", async () => {
        await mallory.agent
            .post("/api/v1/projects")
            .send({ name: "Intruder", workspaceId: alicesProject.workspaceId })
            .expect(403);
    });

    test("a member cannot reach a task of another project by swapping ids", async () => {
        const mallorysProject = await createProject(mallory, "Mine");
        // Mallory is authorised for HER project; the task id belongs to Alice's.
        await mallory.agent.get(`/api/v1/tasks/${mallorysProject.projectId}/t/${alicesTask._id}`).expect(404);
        await mallory.agent
            .put(`/api/v1/tasks/${mallorysProject.projectId}/t/${alicesTask._id}`)
            .send({ title: "pwned" })
            .expect(404);
    });

    test("cannot assign a task to someone outside the project", async () => {
        const mallorysProject = await createProject(mallory, "Assign");
        await mallory.agent
            .post(`/api/v1/tasks/${mallorysProject.projectId}`)
            .send({ title: "x", assignees: [alice.user._id] })
            .expect(400);
    });
});

describe("project roles (RBAC)", () => {
    let owner, dev, viewer, lead, projectId;

    before(async () => {
        owner = await signUp("owner");
        dev = await signUp("dev");
        viewer = await signUp("viewer");
        lead = await signUp("lead");
        ({ projectId } = await createProject(owner, "Rbac"));
        await addToProject(owner, projectId, dev, "developer");
        await addToProject(owner, projectId, viewer, "viewer");
        await addToProject(owner, projectId, lead, "team_lead");
    });

    test("viewer can read and comment but not create tasks", async () => {
        await viewer.agent.get(`/api/v1/tasks/${projectId}`).expect(200);
        await viewer.agent.post(`/api/v1/tasks/${projectId}`).send({ title: "nope" }).expect(403);

        const task = await createTask(owner, projectId);
        await viewer.agent
            .post(`/api/v1/projects/${projectId}/tasks/${task._id}/comments`)
            .send({ body: "looks good" })
            .expect(201);
    });

    test("developer can create and update tasks but not delete them", async () => {
        const task = await createTask(dev, projectId);
        await dev.agent.put(`/api/v1/tasks/${projectId}/t/${task._id}`).send({ status: "in_progress" }).expect(200);
        await dev.agent.delete(`/api/v1/tasks/${projectId}/t/${task._id}`).expect(403);
        await lead.agent.delete(`/api/v1/tasks/${projectId}/t/${task._id}`).expect(200);
    });

    test("only project managers manage membership", async () => {
        const outsider = await signUp("outsider");
        await dev.agent.post(`/api/v1/projects/${projectId}/members`).send({ email: outsider.email }).expect(403);
        await lead.agent.post(`/api/v1/projects/${projectId}/members`).send({ email: outsider.email }).expect(403);
        await dev.agent.put(`/api/v1/projects/${projectId}/members/${dev.user._id}`).send({ newRole: "project_manager" }).expect(403);
    });

    test("only the owner may delete the project, even among project managers", async () => {
        const pm = await signUp("pm");
        await addToProject(owner, projectId, pm, "project_manager");
        await pm.agent.delete(`/api/v1/projects/${projectId}`).expect(403);
    });

    test("comments: authors edit their own; leads may remove others'", async () => {
        const task = await createTask(owner, projectId);
        const url = `/api/v1/projects/${projectId}/tasks/${task._id}/comments`;
        const comment = (await dev.agent.post(url).send({ body: "mine" }).expect(201)).body.data;

        await viewer.agent.put(`${url}/${comment._id}`).send({ body: "edited by someone else" }).expect(403);
        await viewer.agent.delete(`${url}/${comment._id}`).expect(403);
        await dev.agent.put(`${url}/${comment._id}`).send({ body: "edited" }).expect(200);
        await lead.agent.delete(`${url}/${comment._id}`).expect(200);
    });

    test("notes: everyone reads, only leads write", async () => {
        await dev.agent.post(`/api/v1/notes/${projectId}`).send({ title: "t", content: "c" }).expect(403);
        await lead.agent.post(`/api/v1/notes/${projectId}`).send({ title: "t", content: "c" }).expect(201);
        await viewer.agent.get(`/api/v1/notes/${projectId}`).expect(200);
    });
});

describe("workspace scope", () => {
    test("removing a workspace member also revokes their project access", async () => {
        const owner = await signUp("wsowner");
        const member = await signUp("wsmember");
        const { workspaceId, projectId } = await createProject(owner, "Revoke");

        await owner.agent.post(`/api/v1/workspaces/${workspaceId}/invite`).send({ email: member.email }).expect(200);
        await addToProject(owner, projectId, member, "developer");
        await member.agent.get(`/api/v1/tasks/${projectId}`).expect(200);

        await owner.agent.delete(`/api/v1/workspaces/${workspaceId}/members/${member.user._id}`).expect(200);
        await member.agent.get(`/api/v1/tasks/${projectId}`).expect(403);
    });

    test("a guest cannot create projects; a non-admin cannot manage members", async () => {
        const owner = await signUp("wso2");
        const guest = await signUp("guest");
        const { workspaceId } = await createProject(owner, "Guests");
        await owner.agent.post(`/api/v1/workspaces/${workspaceId}/invite`).send({ email: guest.email, role: "guest" }).expect(200);

        await guest.agent.get(`/api/v1/workspaces/${workspaceId}`).expect(200);
        await guest.agent.post("/api/v1/projects").send({ name: "Nope", workspaceId }).expect(403);
        await guest.agent.post(`/api/v1/workspaces/${workspaceId}/invite`).send({ email: owner.email }).expect(403);
    });

    test("the owner role cannot be granted through the API", async () => {
        const owner = await signUp("wso3");
        const other = await signUp("other3");
        const { workspaceId } = await createProject(owner, "Owners");
        await owner.agent.post(`/api/v1/workspaces/${workspaceId}/invite`).send({ email: other.email, role: "owner" }).expect(422);
    });
});

describe("platform administration", () => {
    test("only super_admin changes users; hr may list; product_manager may not", async () => {
        const User = await model("User");
        const admin = await signUp("admin");
        const hr = await signUp("hr");
        const pm = await signUp("pmsys");
        const target = await signUp("target");
        await User.updateOne({ _id: admin.user._id }, { systemRole: "super_admin" });
        await User.updateOne({ _id: hr.user._id }, { systemRole: "hr" });
        await User.updateOne({ _id: pm.user._id }, { systemRole: "product_manager" });

        await target.agent.get("/api/v1/admin/users").expect(403);
        await pm.agent.get("/api/v1/admin/users").expect(403);
        await hr.agent.get("/api/v1/admin/users").expect(200);
        await hr.agent.put(`/api/v1/admin/users/${target.user._id}/status`).send({ isActive: false }).expect(403);

        await admin.agent.put(`/api/v1/admin/users/${target.user._id}/role`).send({ systemRole: "god" }).expect(422);
        await admin.agent.put(`/api/v1/admin/users/${target.user._id}/status`).send({ isActive: false }).expect(200);
        // Deactivation takes effect on the very next request.
        await target.agent.get("/api/v1/auth/current-user").expect(401);
    });

    test("a user cannot touch another user's notifications", async () => {
        const owner = await signUp("nowner");
        const dev = await signUp("ndev");
        const { projectId } = await createProject(owner, "Notify");
        await addToProject(owner, projectId, dev, "developer");
        await createTask(owner, projectId, { assignees: [dev.user._id] });

        const Notification = await model("Notification");
        const note = await Notification.findOne({ recipient: dev.user._id });
        await owner.agent.put(`/api/v1/notifications/${note._id}/read`).expect(404);
        await dev.agent.put(`/api/v1/notifications/${note._id}/read`).expect(200);
    });
});
