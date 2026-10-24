/**
 * FILE: backend/src/routes/workspace.routes.js   (mounted at /api/v1/workspaces)
 *
 * ENDPOINTS
 *   POST   /                                create (the caller becomes owner)
 *   GET    /                                workspaces I belong to
 *   GET    /:workspaceId                    details + members        workspace:read
 *   PUT    /:workspaceId                    rename / describe        workspace:update
 *   POST   /:workspaceId/invite             add a user by email      workspace:manage_members
 *   PUT    /:workspaceId/members/:userId    change their role        workspace:manage_members
 *   DELETE /:workspaceId/members/:userId    remove them              workspace:manage_members
 *
 * authorizeWorkspace loads the workspace once and checks membership plus the
 * role (owner/admin/member/guest → "workspace_<role>" in the permission matrix).
 */
import { Router } from "express";
import {
    createWorkspace,
    getUserWorkspaces,
    getWorkspaceById,
    updateWorkspace,
    inviteMember,
    removeMember,
    updateMemberRole,
} from "../controllers/workspace.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeWorkspace } from "../middlewares/authorize.middleware.js";
import { audit } from "../middlewares/audit.middleware.js";
import { objectIdParam, validate } from "../middlewares/validator.middleware.js";
import {
    createWorkspaceValidator,
    inviteWorkspaceMemberValidator,
    updateWorkspaceMemberRoleValidator,
    updateWorkspaceValidator,
} from "../validators/workspace.validators.js";

const router = Router();

router.use(verifyJWT);
router.param("userId", objectIdParam);

router.route("/")
    .post(createWorkspaceValidator(), validate, audit("workspace", "created"), createWorkspace)
    .get(getUserWorkspaces);

router.route("/:workspaceId")
    .get(authorizeWorkspace("workspace", "read"), getWorkspaceById)
    .put(authorizeWorkspace("workspace", "update"), updateWorkspaceValidator(), validate,
        audit("workspace", "updated"), updateWorkspace);

router.post("/:workspaceId/invite", authorizeWorkspace("workspace", "manage_members"),
    inviteWorkspaceMemberValidator(), validate, audit("member", "member_added"), inviteMember);

router.route("/:workspaceId/members/:userId")
    .put(authorizeWorkspace("workspace", "manage_members"), updateWorkspaceMemberRoleValidator(), validate,
        audit("member", "role_changed"), updateMemberRole)
    .delete(authorizeWorkspace("workspace", "manage_members"), audit("member", "member_removed"), removeMember);

export default router;
