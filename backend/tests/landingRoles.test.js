import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission } from "../src/utils/permissions.js";
import { CAPABILITY_ROWS, ROLE_COLUMNS } from "../../frontend/src/lib/landingRoles.js";

/**
 * The landing page's role table (frontend/src/lib/landingRoles.js) must say
 * exactly what the API enforces. Every cell is checked against the permission
 * matrix: a tick means every listed check passes for every role in the column,
 * a cross means at least one fails for each of them.
 * If this fails, the matrix changed: update landingRoles.js to match.
 */
test("landing-page role table matches the permission matrix", async (t) => {
    assert.equal(ROLE_COLUMNS.length, 5);
    for (const row of CAPABILITY_ROWS) {
        await t.test(row.label, () => {
            for (const column of ROLE_COLUMNS) {
                for (const role of column.roles) {
                    const granted = row.checks.every(([resource, action]) => hasPermission(role, resource, action));
                    assert.equal(
                        granted,
                        row.allowed.includes(column.key),
                        `${role} / "${row.label}": update frontend/src/lib/landingRoles.js`
                    );
                }
            }
        });
    }
});

test("team lead matches the scrum master column the table's note describes", () => {
    for (const row of CAPABILITY_ROWS) {
        for (const [resource, action] of row.checks) {
            assert.equal(hasPermission("team_lead", resource, action), hasPermission("scrum_master", resource, action));
        }
    }
});
