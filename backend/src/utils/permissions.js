/**
 * FILE: backend/src/utils/permissions.js
 *
 * PURPOSE
 *   Role-Based Access Control (RBAC). This file holds the permission MATRIX
 *   (role → list of "resource:action" strings) and the helpers that consult it.
 *   It is pure logic: no Express and no database access, which is why
 *   tests/security.test.js can unit-test every role directly.
 *
 * WHO CALLS IT
 *   middlewares/authorize.middleware.js: authorizeProject / authorizeWorkspace /
 *   authorizeSystem load the scope document, call resolveEffectiveRole(), then
 *   hasPermission(). Controllers use findMember / isProjectMember for
 *   membership lookups. Only two controllers call hasPermission directly:
 *   comment.controller (may a non-author delete? → "comment:moderate") and
 *   project.controller's createProject (a project does not exist yet, so the
 *   check runs against the target WORKSPACE role).
 *
 * PERMISSION STRING FORMAT
 *   "<resource>:<action>"   e.g. "task:update"
 *   "<resource>:*"          every action on that resource
 *   "*:*"                   everything (super_admin only)
 *
 * INTERVIEW NOTES
 *   Q: RBAC vs. ownership checks?
 *   A: RBAC answers "may a developer update tasks?" (a role question, answered
 *      here). Ownership answers "is this YOUR comment?" (a question about one
 *      document, answered in the controller).
 *   Q: What does "fail closed" mean?
 *   A: An unknown role gets NO permissions (and a warning in the log) instead
 *      of a default set. Denying by mistake is safer than allowing by mistake.
 */
import { SystemRolesEnum } from "./constants.js";
import logger from "./logger.js";

/**
 * Authorization model — the ONLY place permissions are defined.
 *
 * Every protected route asks one question: "may this role perform
 * <resource>:<action>?" The answer comes from this matrix and nowhere else.
 * Controllers never re-derive roles; they only apply *ownership* rules
 * ("you may edit a comment only if you wrote it"), which are about a specific
 * document rather than a role.
 *
 * Three scopes, resolved to one role key by resolveEffectiveRole():
 *   system     super_admin | hr | product_manager | member
 *   workspace  owner | admin | member | guest        → "workspace_<role>"
 *   project    project_manager | scrum_master | team_lead | developer | qa | client | viewer
 *
 * Deliberate: workspace roles do NOT grant access to projects. A project is
 * visible only to its members (plus super_admin). Workspace roles govern the
 * workspace itself and who may create projects in it.
 */
export const RolePermissions = {
  // ─── System roles ───
  // super_admin is the single global bypass.
  super_admin: ["*:*"],
  // Platform roles. They elevate what a user can do inside projects they are
  // already a member of; they are NOT a cross-tenant pass.
  product_manager: ["workspace:read", "project:*", "sprint:*", "task:*", "comment:*", "note:*"],
  hr: ["workspace:read", "project:read", "user:read"],
  // A plain account has no system-level permissions; everything it can do comes
  // from workspace or project membership.
  member: [],

  // ─── Workspace roles ───
  workspace_owner: ["workspace:*", "project:create"],
  workspace_admin: ["workspace:read", "workspace:update", "workspace:manage_members", "project:create"],
  workspace_member: ["workspace:read", "project:create"],
  workspace_guest: ["workspace:read"],

  // ─── Project roles ───
  // "project:delete" is additionally restricted to the project owner in the
  // controller (an ownership rule, not a role rule).
  project_manager: ["project:*", "sprint:*", "task:*", "comment:*", "note:*"],
  scrum_master: ["project:read", "project:update", "sprint:*", "task:*", "comment:*", "note:*"],
  team_lead: ["project:read", "project:update", "sprint:*", "task:*", "comment:*", "note:*"],

  // comment:update / comment:delete for these roles means "your own comments":
  // the controller enforces authorship. comment:moderate (others' comments) is
  // only reachable through comment:* above.
  developer: [
    "project:read", "sprint:read",
    "task:create", "task:read", "task:update",
    "comment:create", "comment:read", "comment:update", "comment:delete",
    "note:read",
  ],
  qa: [
    "project:read", "sprint:read",
    "task:create", "task:read", "task:update",
    "comment:create", "comment:read", "comment:update", "comment:delete",
    "note:read",
  ],
  client: ["project:read", "sprint:read", "task:read", "comment:create", "comment:read", "note:read"],
  viewer: ["project:read", "sprint:read", "task:read", "comment:create", "comment:read", "note:read"],
};

/**
 * Collapses the three tiers into one matrix key.
 * Precedence: platform roles → project role → workspace role → system role.
 *
 * Examples:
 *   ("member", null, "developer")  → "developer"
 *   ("member", "admin", undefined) → "workspace_admin"
 *   ("super_admin", null, null)    → "super_admin"
 *
 * @param {string} systemRole                 user.systemRole
 * @param {string} [workspaceRole]            the user's role in the workspace being accessed
 * @param {string} [projectRole]              the user's role in the project being accessed
 * @returns {string} a key of RolePermissions
 */
export const resolveEffectiveRole = (systemRole, workspaceRole, projectRole) => {
  if (systemRole === SystemRolesEnum.SUPER_ADMIN) return SystemRolesEnum.SUPER_ADMIN;
  if (systemRole === SystemRolesEnum.PRODUCT_MANAGER) return SystemRolesEnum.PRODUCT_MANAGER;
  if (systemRole === SystemRolesEnum.HR) return SystemRolesEnum.HR;

  if (projectRole) return projectRole;
  if (workspaceRole) return `workspace_${workspaceRole}`;
  return systemRole || SystemRolesEnum.MEMBER;
};

/**
 * Fails closed: a role missing from the matrix is denied and logged, never
 * silently given a default set of permissions.
 *
 * @param {string} role      the effective role from resolveEffectiveRole()
 * @param {string} resource  e.g. "task"
 * @param {string} action    e.g. "update"
 * @returns {boolean}        true if "*:*", "task:*" or "task:update" is granted
 */
export const hasPermission = (role, resource, action) => {
  const permissions = RolePermissions[role];

  if (!permissions) {
    logger.warn(
      `RBAC: denied "${resource}:${action}" for unmapped role "${role}". ` +
      `Add it to RolePermissions if this role is legitimate.`
    );
    return false;
  }

  return (
    permissions.includes("*:*") ||
    permissions.includes(`${resource}:*`) ||
    permissions.includes(`${resource}:${action}`)
  );
};

/**
 * Returns the embedded membership entry for userId, or undefined.
 * Works whether or not `members.user` has been populated.
 * (Unpopulated, m.user is an ObjectId; populated, it is a User document with
 * an _id. `m.user._id ?? m.user` handles both. ObjectIds are compared as
 * strings because two ObjectId objects are never `===` each other.)
 */
export const findMember = (members = [], userId) =>
  members.find((m) => m.user && (m.user._id ?? m.user).toString() === userId.toString());

/** True if userId appears in project.members. Null-safe on both arguments. */
export const isProjectMember = (project, userId) =>
  Boolean(project && userId && findMember(project.members, userId));
