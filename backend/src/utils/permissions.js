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
 */
export const findMember = (members = [], userId) =>
  members.find((m) => m.user && (m.user._id ?? m.user).toString() === userId.toString());

export const isProjectMember = (project, userId) =>
  Boolean(project && userId && findMember(project.members, userId));
