/**
 * FILE: backend/src/routes/project.routes.js   (mounted at /api/v1/projects)
 *
 * ENDPOINTS
 *   POST   /                              create a project in a workspace
 *   GET    /                              my projects (all of them, members populated)
 *   GET    /all                           my projects, paginated/filtered/sorted
 *                                         (?page=&limit=&status=&sortBy=&sortType=)
 *   GET    /invitations/me                my pending project invitations
 *   POST   /:projectId/invitations/accept accept → become a member
 *   POST   /:projectId/invitations/reject decline
 *   GET    /:projectId                    project details               project:read
 *   PUT    /:projectId                    edit                          project:update
 *   DELETE /:projectId                    delete (owner only)           project:delete
 *   GET    /:projectId/members            list members                  project:read
 *   POST   /:projectId/members            invite by email               project:manage_members
 *   PUT    /:projectId/members/:userId    change role                   project:manage_members
 *   DELETE /:projectId/members/:userId    remove member                 project:manage_members
 *
 * ROUTE ORDER MATTERS: Express matches top to bottom, so the literal
 * "/invitations/me" must be registered before "/:projectId", or "invitations"
 * would be captured as a project id.
 *
 * Related nested routers (mounted in app.js, not here):
 *   /projects/:projectId/sprints                    → sprint.routes.js
 *   /projects/:projectId/tasks/:taskId/comments     → comment.routes.js
 */
import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeProject } from "../middlewares/authorize.middleware.js";
import { audit } from "../middlewares/audit.middleware.js";
import { objectIdParam, validate, validateObjectIds } from "../middlewares/validator.middleware.js";
import {
    addProjectMemberValidator, createProjectValidator, updateProjectMemberRoleValidator, updateProjectValidator,
} from "../validators/project.validators.js";
import {
    createProject,
    getUserProjects,
    getAllProjects,
    getProjectById,
    updateProject,
    deleteProject,
    getProjectMembers,
    addMemberToProject,
    updateMemberRole,
    removeMemberFromProject,
    getPendingInvitations,
    acceptInvitation,
    rejectInvitation,
} from "../controllers/project.controller.js";

const router = Router();

router.use(verifyJWT);
// :projectId is validated by authorizeProject; the invitation routes below do
// not use it, so they get the plain id check.
router.param("userId", objectIdParam);

// Lists are scoped by the query ("projects I am a member of"), so they need no
// per-project authorization. Creating checks the target workspace in the controller.
router.route("/")
    .post(createProjectValidator(), validate, audit("project", "created"), createProject)
    .get(getUserProjects);

router.get("/all", getAllProjects);

// Invitations: the caller acts on their OWN pending invitation (must come
// before /:projectId so "invitations" is not read as an id).
router.get("/invitations/me", getPendingInvitations);
router.post("/:projectId/invitations/accept", validateObjectIds("projectId"), audit("member", "member_added"), acceptInvitation);
router.post("/:projectId/invitations/reject", validateObjectIds("projectId"), rejectInvitation);

router.route("/:projectId")
    .get(authorizeProject("project", "read"), getProjectById)
    .put(authorizeProject("project", "update"), updateProjectValidator(), validate, audit("project", "updated"), updateProject)
    .delete(authorizeProject("project", "delete"), audit("project", "deleted"), deleteProject);

router.route("/:projectId/members")
    .get(authorizeProject("project", "read"), getProjectMembers)
    .post(authorizeProject("project", "manage_members"), addProjectMemberValidator(), validate,
        audit("member", "member_invited"), addMemberToProject);

router.route("/:projectId/members/:userId")
    .put(authorizeProject("project", "manage_members"), updateProjectMemberRoleValidator(), validate,
        audit("member", "role_changed"), updateMemberRole)
    .delete(authorizeProject("project", "manage_members"), audit("member", "member_removed"), removeMemberFromProject);

export default router;
