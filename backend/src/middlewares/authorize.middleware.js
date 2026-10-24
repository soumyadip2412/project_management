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
 *
 * FILE: backend/src/middlewares/authorize.middleware.js
 *
 * WHAT EACH FACTORY ATTACHES TO req
 *   authorizeProject   → req.project, req.projectRole, req.effectiveRole
 *   authorizeWorkspace → req.workspace, req.workspaceRole, req.effectiveRole
 *
 * STATUS CODES
 *   400 malformed id · 404 scope document does not exist ·
 *   403 not a member, or the role lacks the permission
 *
 * INTERVIEW NOTES
 *   Q: How do you stop user B from reading user A's project by guessing ids (IDOR)?
 *   A: Every project-scoped route goes through authorizeProject, which
 *      requires membership of THAT project. Child documents (tasks, sprints,
 *      comments) are then queried WITH the project id
 *      ({ _id: taskId, project: req.project._id }), so a task id from another
 *      project simply returns 404. tests/api/authorization.test.js covers these attacks.
 *   Q: Why is this a "factory" (a function returning middleware)?
 *   A: The permission being checked differs per route:
 *      authorizeProject("task", "delete") produces a middleware configured for
 *      exactly that check.
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

/**
 * System scope: permissions that come only from the user's systemRole.
 * Synchronous (no database read), so a plain `throw` is caught by Express.
 */
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

        // The ONE load of this project for the whole request: controllers
        // reuse req.project instead of querying it again.
        const project = await Project.findById(projectId);
        if (!project) throw new ApiError(404, "Project not found");

        const member = findMember(project.members, req.user._id);
        if (!member && !isSuperAdmin(req.user)) {
            throw new ApiError(403, "You are not a member of this project");
        }

        // Workspace role is passed as null on purpose: a workspace admin gets
        // no rights inside a project unless they are also a project member.
        const role = resolveEffectiveRole(req.user.systemRole, null, member?.role);
        if (!hasPermission(role, resource, action)) throw deny(role, resource, action);

        req.project = project;
        req.projectRole = member?.role ?? null;
        req.effectiveRole = role;
        next();
    });
