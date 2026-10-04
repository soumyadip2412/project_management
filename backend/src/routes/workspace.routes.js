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
