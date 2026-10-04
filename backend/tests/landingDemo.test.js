import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission } from "../src/utils/permissions.js";

/**
 * The frontend landing page shows what the API answers when a project role
 * tries an action (frontend/src/landing/requestDemo.js). The two repositories
 * cannot import each other, so this pins every decision the page displays.
 * If this fails, the permission matrix changed: update requestDemo.js to match.
 */
const DEMO_ACTIONS = {
    read_task: ["task", "read"],
    move_task: ["task", "update"],
    comment: ["comment", "create"],
    delete_task: ["task", "delete"],
    start_sprint: ["sprint", "start"],
    change_role: ["project", "manage_members"],
    delete_project: ["project", "delete"],
};

// Role → demo actions the page shows as passing the role check.
const ALLOWED = {
    viewer: ["read_task", "comment"],
    client: ["read_task", "comment"],
    developer: ["read_task", "move_task", "comment"],
    qa: ["read_task", "move_task", "comment"],
    team_lead: ["read_task", "move_task", "comment", "delete_task", "start_sprint"],
    scrum_master: ["read_task", "move_task", "comment", "delete_task", "start_sprint"],
    project_manager: Object.keys(DEMO_ACTIONS),
};

test("landing-page demo matches the permission matrix", async (t) => {
    for (const [role, allowed] of Object.entries(ALLOWED)) {
        await t.test(role, () => {
            for (const [name, [resource, action]] of Object.entries(DEMO_ACTIONS)) {
                assert.equal(
                    hasPermission(role, resource, action),
                    allowed.includes(name),
                    `${role} ${name}: update frontend/src/landing/requestDemo.js`
                );
            }
        });
    }
});
