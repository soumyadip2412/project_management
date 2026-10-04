import test from "node:test";
import assert from "node:assert/strict";
import { deriveStatusCategory, clampPagination, escapeRegex, isValidObjectId } from "../src/utils/helpers.js";
import { RolePermissions, hasPermission, isProjectMember, resolveEffectiveRole } from "../src/utils/permissions.js";

test("Security & Helpers Suite", async (t) => {
    await t.test("deriveStatusCategory correctly maps status values", () => {
        assert.equal(deriveStatusCategory("done"), "done");
        assert.equal(deriveStatusCategory("completed"), "done");
        assert.equal(deriveStatusCategory("in_progress"), "in_progress");
        assert.equal(deriveStatusCategory("in_review"), "in_progress");
        assert.equal(deriveStatusCategory("qa_testing"), "in_progress");
        assert.equal(deriveStatusCategory("todo"), "todo");
        assert.equal(deriveStatusCategory("backlog"), "todo");
        assert.equal(deriveStatusCategory("unknown"), "todo");
    });

    await t.test("clampPagination protects against abusive pagination queries", () => {
        // Safe defaults
        assert.deepEqual(clampPagination(1, 10), { page: 1, limit: 10, skip: 0 });
        // Enforce page 1 minimum
        assert.deepEqual(clampPagination(-5, 20), { page: 1, limit: 20, skip: 0 });
        // Cap excessive limit to 100
        assert.deepEqual(clampPagination(2, 5000, 100), { page: 2, limit: 100, skip: 100 });
        // NaN fallback
        assert.deepEqual(clampPagination("invalid", "invalid"), { page: 1, limit: 10, skip: 0 });
    });

    await t.test("escapeRegex prevents ReDoS and regex meta-character injection", () => {
        const malicious = ".*+?^${}()|[]\\test";
        const escaped = escapeRegex(malicious);
        assert.doesNotThrow(() => new RegExp(escaped));
        assert.equal(new RegExp(escaped).test(malicious), true);
    });

    await t.test("isValidObjectId validates MongoDB ObjectIds", () => {
        assert.equal(isValidObjectId("507f1f77bcf86cd799439011"), true);
        assert.equal(isValidObjectId("invalid-id"), false);
        assert.equal(isValidObjectId(""), false);
        assert.equal(isValidObjectId(null), false);
    });

    // NOTE: resolveEffectiveRole(systemRole, workspaceRole, projectRole).
    // Project roles such as "developer"/"viewer" belong in the THIRD argument;
    // passing them second resolves to "workspace_developer", which is not a
    // mapped role.
    await t.test("RBAC matrix denies unauthorized actions correctly", () => {
        // Super admin has unrestricted permission
        const superAdminRole = resolveEffectiveRole("super_admin", null, "project_manager");
        assert.equal(hasPermission(superAdminRole, "project", "delete"), true);

        // Viewer cannot delete projects or create tasks
        const viewerRole = resolveEffectiveRole("member", null, "viewer");
        assert.equal(viewerRole, "viewer");
        assert.equal(hasPermission(viewerRole, "task", "create"), false);
        assert.equal(hasPermission(viewerRole, "project", "delete"), false);

        // Developer can create tasks but cannot delete projects
        const devRole = resolveEffectiveRole("member", null, "developer");
        assert.equal(devRole, "developer");
        assert.equal(hasPermission(devRole, "task", "create"), true);
        assert.equal(hasPermission(devRole, "project", "delete"), false);
    });

    await t.test("resolveEffectiveRole applies the documented precedence", () => {
        // System super-users override every lower tier
        assert.equal(resolveEffectiveRole("super_admin", "guest", "viewer"), "super_admin");
        assert.equal(resolveEffectiveRole("product_manager", "guest", "viewer"), "product_manager");
        assert.equal(resolveEffectiveRole("hr", "owner", "developer"), "hr");

        // Otherwise an explicit project role wins
        assert.equal(resolveEffectiveRole("member", "admin", "qa"), "qa");

        // With no project role, workspace membership is inherited
        assert.equal(resolveEffectiveRole("member", "admin", null), "workspace_admin");
        assert.equal(resolveEffectiveRole("member", "owner", null), "workspace_owner");

        // With neither, fall back to the system role, then to "member"
        assert.equal(resolveEffectiveRole("member", null, null), "member");
        assert.equal(resolveEffectiveRole(null, null, null), "member");
    });

    await t.test("hasPermission fails closed for unmapped roles", () => {
        // Every role key the resolver can legitimately produce is mapped
        for (const role of [
            "super_admin", "product_manager", "hr", "member",
            "workspace_owner", "workspace_admin", "workspace_member", "workspace_guest",
            "project_manager", "scrum_master", "team_lead", "developer", "qa", "client", "viewer"
        ]) {
            assert.ok(role in RolePermissions, `expected "${role}" to be a mapped role`);
        }

        // Anything else is denied rather than inheriting "member" permissions
        for (const unmapped of [
            "workspace_developer", // project role passed in the workspace slot
            "admin",               // legacy project-member role, absent from the matrix
            "typo_role",
            "",
            undefined
        ]) {
            assert.equal(hasPermission(unmapped, "project", "read"), false);
            assert.equal(hasPermission(unmapped, "task", "create"), false);
        }
    });

    await t.test("wildcards in the permission matrix still resolve", () => {
        // "*:*" grants everything
        assert.equal(hasPermission("super_admin", "anything", "at-all"), true);
        // "resource:*" grants every action on that resource
        assert.equal(hasPermission("developer", "comment", "delete"), true);
        // ...but not on an unlisted resource
        assert.equal(hasPermission("developer", "workspace", "delete"), false);
    });

    await t.test("workspace roles never grant access inside projects", () => {
        // Project data is visible to project members only. A workspace owner
        // who is not in a project gets nothing there.
        for (const role of ["workspace_owner", "workspace_admin", "workspace_member", "workspace_guest"]) {
            for (const resource of ["project", "task", "sprint", "comment", "note"]) {
                assert.equal(hasPermission(role, resource, "read"), false, `${role} must not read ${resource}`);
            }
        }
        // ...but they govern the workspace itself.
        assert.equal(hasPermission("workspace_owner", "workspace", "delete"), true);
        assert.equal(hasPermission("workspace_admin", "workspace", "manage_members"), true);
        assert.equal(hasPermission("workspace_member", "workspace", "manage_members"), false);
        assert.equal(hasPermission("workspace_guest", "project", "create"), false);
    });

    await t.test("member management and moderation are lead-only", () => {
        assert.equal(hasPermission("project_manager", "project", "manage_members"), true);
        assert.equal(hasPermission("scrum_master", "project", "manage_members"), false);
        assert.equal(hasPermission("developer", "comment", "moderate"), false);
        assert.equal(hasPermission("team_lead", "comment", "moderate"), true);
        assert.equal(hasPermission("developer", "task", "delete"), false);
    });

    await t.test("only super_admin may change users; hr may only read them", () => {
        assert.equal(hasPermission("super_admin", "user", "update"), true);
        assert.equal(hasPermission("hr", "user", "read"), true);
        assert.equal(hasPermission("hr", "user", "update"), false);
        assert.equal(hasPermission("product_manager", "user", "read"), false);
        assert.equal(hasPermission("member", "user", "read"), false);
    });

    await t.test("isProjectMember checks membership correctly", () => {
        const dummyProject = {
            members: [
                { user: { toString: () => "user123" } },
                { user: { toString: () => "user456" } }
            ]
        };
        assert.equal(isProjectMember(dummyProject, "user123"), true);
        assert.equal(isProjectMember(dummyProject, "user999"), false);
    });
});
