/**
 * Authorization middleware — one factory per scope, one permission matrix.
 *
 *   authorizeSystem("user", "update")      platform-level actions (admin API)
 *   authorizeWorkspace("workspace", "read") anything under /workspaces/:workspaceId
 *   authorizeProject("task", "update")      anything under a :projectId
 *
 * Each one: loads the scope document ONCE, resolves the caller's role in it,
 * asks hasPermission(), and attaches what it loaded to `req` so the controller
 * never queries it again. Controllers must not repeat these checks; they only
 * enforce ownership rules (e.g. "only the author may edit a comment").
 *
 * Runs after verifyJWT, so `req.user` is always present.
 */
import Project from "../models/project.models.js";
import Workspace from "../models/workspace.models.js";
import { ApiError } from "../utils/api-errors.js";
import { asynchandler } from "../utils/asynchandler.js";
import { SystemRolesEnum } from "../utils/constants.js";
import { isValidObjectId } from "../utils/helpers.js";
import { findMember, hasPermission, resolveEffectiveRole } from "../utils/permissions.js";

const isSuperAdmin = (user) => user.systemRole === SystemRolesEnum.SUPER_ADMIN;

const deny = (role, resource, action) =>
    new ApiError(403, `Your role (${role}) is not allowed to ${action} ${resource}`);

/** System scope: permissions that come only from the user's systemRole. */
export const authorizeSystem = (resource, action) => (req, res, next) => {
    const role = req.user.systemRole;
    if (!hasPermission(role, resource, action)) throw deny(role, resource, action);
    next();
};

/** Workspace scope: requires workspace membership (super_admin excepted). */
export const authorizeWorkspace = (resource, action) =>
    asynchandler(async (req, res, next) => {
        const { workspaceId } = req.params;
        if (!isValidObjectId(workspaceId)) throw new ApiError(400, "Invalid workspaceId");

        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) throw new ApiError(404, "Workspace not found");

        const member = findMember(workspace.members, req.user._id);
        if (!member && !isSuperAdmin(req.user)) {
            throw new ApiError(403, "You are not a member of this workspace");
        }

        const role = resolveEffectiveRole(req.user.systemRole, member?.role, null);
        if (!hasPermission(role, resource, action)) throw deny(role, resource, action);

        req.workspace = workspace;
        req.workspaceRole = member?.role ?? null;
        req.effectiveRole = role;
        next();
    });

/** Project scope: requires project membership (super_admin excepted). */
export const authorizeProject = (resource, action) =>
    asynchandler(async (req, res, next) => {
        const { projectId } = req.params;
        if (!isValidObjectId(projectId)) throw new ApiError(400, "Invalid projectId");

        const project = await Project.findById(projectId);
        if (!project) throw new ApiError(404, "Project not found");

        const member = findMember(project.members, req.user._id);
        if (!member && !isSuperAdmin(req.user)) {
            throw new ApiError(403, "You are not a member of this project");
        }

        const role = resolveEffectiveRole(req.user.systemRole, null, member?.role);
        if (!hasPermission(role, resource, action)) throw deny(role, resource, action);

        req.project = project;
        req.projectRole = member?.role ?? null;
        req.effectiveRole = role;
        next();
    });
