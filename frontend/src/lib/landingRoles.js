/**
 * FILE: frontend/src/lib/landingRoles.js
 * The "Every role sees the right controls" table on the landing page.
 *
 * Derived from the permission matrix in backend/src/utils/permissions.js.
 * Each row names the "resource:action" checks the API runs for it, and
 * backend/tests/landingRoles.test.js asserts every cell against
 * hasPermission(), so the table cannot drift from the server.
 * Pure data (no imports), so the backend test can import it directly.
 */

/** Table columns: one project role each. Client and Viewer share a matrix entry. */
export const ROLE_COLUMNS = [
  { key: "project_manager", label: "Project manager", roles: ["project_manager"] },
  { key: "scrum_master", label: "Scrum master", roles: ["scrum_master"] },
  { key: "developer", label: "Developer", roles: ["developer"] },
  { key: "qa", label: "QA", roles: ["qa"] },
  { key: "client", label: "Client / Viewer", roles: ["client", "viewer"] },
];

/**
 * `checks`: every listed permission must be granted for a tick.
 * `allowed`: the column keys that get a tick.
 */
export const CAPABILITY_ROWS = [
  {
    label: "Manage project members",
    checks: [["project", "manage_members"]],
    allowed: ["project_manager"],
  },
  {
    label: "Edit project settings",
    checks: [["project", "update"]],
    allowed: ["project_manager", "scrum_master"],
  },
  {
    label: "Plan and run sprints",
    checks: [["sprint", "create"], ["sprint", "update"], ["sprint", "start"], ["sprint", "complete"]],
    allowed: ["project_manager", "scrum_master"],
  },
  {
    label: "Create and edit issues",
    checks: [["task", "create"], ["task", "update"]],
    allowed: ["project_manager", "scrum_master", "developer", "qa"],
  },
  {
    label: "Delete issues",
    checks: [["task", "delete"]],
    allowed: ["project_manager", "scrum_master"],
  },
  {
    label: "Comment on issues",
    checks: [["comment", "create"]],
    allowed: ["project_manager", "scrum_master", "developer", "qa", "client"],
  },
  {
    label: "View the board, backlog and reports",
    checks: [["project", "read"], ["sprint", "read"], ["task", "read"]],
    allowed: ["project_manager", "scrum_master", "developer", "qa", "client"],
  },
];
