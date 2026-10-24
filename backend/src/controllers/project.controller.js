/**
 * FILE: backend/src/controllers/project.controller.js
 *
 * PURPOSE
 *   Projects and their membership (routes/project.routes.js):
 *     create / list / get / update / delete projects
 *     list members, invite (creates a PENDING invitation), change role, remove
 *     the invitee's side: list my invitations, accept, reject
 *
 * NOTABLE DESIGN DECISIONS
 *   - Creating a project: the workspace is checked HERE (there is no
 *     :projectId yet for authorizeProject to use). Without a workspaceId the
 *     user's own workspace is used, and created on first use.
 *   - Whitelisted updates (no mass assignment): owner, key, members and
 *     taskSequence can never be changed by PUT /projects/:id.
 *   - Delete = ownership rule plus a manual "cascade": comments → tasks →
 *     sprints → notes → project. MongoDB has no foreign keys or ON DELETE
 *     CASCADE, so the application deletes the children itself.
 *   - Invitations use atomic conditional updates ($ne in the filter + $push /
 *     $pull in one call), so double clicks and races cannot create duplicates.
 *
 * INTERVIEW NOTES
 *   Q: Why no transaction for delete?
 *   A: Multi-document transactions need a MongoDB replica set. Instead the steps
 *      run children-first and are idempotent: if one fails, the project still
 *      exists and retrying DELETE completes the job. No orphans are left visible.
 *   Q: What does `{ "invitations.$": 1 }` do?
 *   A: A positional projection: it returns only the array element that matched
 *      the query (my invitation), not the whole invitations array.
 */
import Project from "../models/project.models.js";
import Workspace from "../models/workspace.models.js";
import { User } from "../models/user.models.js";
import { Task } from "../models/task.models.js";
import { Sprint } from "../models/sprint.models.js";
import { Note } from "../models/note.models.js";
import { Comment } from "../models/comment.models.js";
import { ApiError } from "../utils/api-errors.js";
import { ApiResponse } from "../utils/api-response.js";
import { asynchandler } from "../utils/asynchandler.js";
import { clampPagination } from "../utils/helpers.js";
import { AvailableTaskStatuses, SystemRolesEnum, WorkspaceRolesEnum } from "../utils/constants.js";
import { findMember, hasPermission, resolveEffectiveRole } from "../utils/permissions.js";
import { trackChanges } from "../middlewares/audit.middleware.js";
import { notifyProjectDeleted, notifyProjectInvitation } from "../services/notification.service.js";

/*
 * Handlers for /projects/:projectId/... run after authorizeProject(), which
 * loaded req.project and checked the caller's role. The only authorization
 * left here is OWNERSHIP (only the owner may delete a project), which depends
 * on the specific document rather than on a role.
 */

const MEMBER_FIELDS = "fullName username email avatar";

/**
 * Picks the workspace a new project goes into. An explicit workspaceId must be
 * one the caller belongs to with project:create; otherwise the caller's own
 * workspace is used, created on first use.
 */
const resolveTargetWorkspace = async (user, workspaceId) => {
    if (workspaceId) {
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) throw new ApiError(404, "Workspace not found");

        const member = findMember(workspace.members, user._id);
        const isSuperAdmin = user.systemRole === SystemRolesEnum.SUPER_ADMIN;
        const role = resolveEffectiveRole(user.systemRole, member?.role, null);
        if ((!member && !isSuperAdmin) || !hasPermission(role, "project", "create")) {
            throw new ApiError(403, "You cannot create projects in this workspace");
        }
        return workspace;
    }

    return (
        (await Workspace.findOne({ owner: user._id }).sort({ createdAt: 1 })) ??
        (await Workspace.create({
            name: `${user.fullName || user.username}'s Workspace`,
            slug: `ws-${user._id}`,
            owner: user._id,
            members: [{ user: user._id, role: WorkspaceRolesEnum.OWNER }],
        }))
    );
};

// A short key derived from the name ("Alpha Project" → "ALPHAP"), made unique
// within the workspace by the first free numeric suffix. It follows the same
// shape the validator requires of a chosen key: a letter first, 2+ characters.
// (Counting the existing keys instead reused a suffix once a project had been
// deleted, and the create failed on the unique index.)
const deriveProjectKey = async (name, workspaceId) => {
    const letters = name.replace(/[^a-zA-Z0-9]/g, "").replace(/^[0-9]+/, "").toUpperCase().slice(0, 6);
    const base = letters.length >= 2 ? letters : "PROJ";
    // `base` is only A-Z0-9 at this point, so it is safe to put in a RegExp unescaped.
    const existing = await Project.find({ workspace: workspaceId, key: new RegExp(`^${base}\\d*$`) }).select("key").lean();
    const taken = new Set(existing.map((p) => p.key));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}${n}`)) n++;
    return `${base}${n}`;
};

/**
 * POST /projects → 201 project. The creator becomes owner AND the first member
 * as project_manager. A duplicate key in the same workspace hits the unique
 * index → 409.
 */
const createProject = asynchandler(async (req, res) => {
    const { name, description, key, workspaceId, methodology } = req.body;
    const workspace = await resolveTargetWorkspace(req.user, workspaceId);

    const project = await Project.create({
        name,
        description,
        owner: req.user._id,
        workspace: workspace._id,
        key: key ? key.toUpperCase() : await deriveProjectKey(name, workspace._id),
        // Conditional spread: adds the field only if provided, else the schema default applies.
        ...(methodology && { methodology }),
        members: [{ user: req.user._id, role: "project_manager" }],
    });

    return res.status(201).json(new ApiResponse(201, project, "Project created successfully"));
});

// "My projects": the list is scoped by the query itself, not by middleware.
const getUserProjects = asynchandler(async (req, res) => {
    const projects = await Project.find({ "members.user": req.user._id })
        .populate("members.user", MEMBER_FIELDS)
        .sort({ updatedAt: -1 });

    return res.status(200).json(new ApiResponse(200, projects, "Projects fetched successfully"));
});

// Paginated variant of "my projects". Sorting is restricted to known fields.
const SORTABLE_FIELDS = ["createdAt", "updatedAt", "name", "status"];

const getAllProjects = asynchandler(async (req, res) => {
    const { status, sortBy, sortType } = req.query;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit, 50);

    const filter = { "members.user": req.user._id };
    if (typeof status === "string") filter.status = status;
    // Allow-list the sort field: sorting by an arbitrary client-chosen field
    // could hit an unindexed field (slow) or probe hidden fields.
    const sortField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : "createdAt";
    const sort = { [sortField]: sortType === "asc" ? 1 : -1 };

    const [projects, totalProjects] = await Promise.all([
        Project.find(filter).sort(sort).skip(skip).limit(limit),
        Project.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(totalProjects / limit);

    return res.status(200).json(new ApiResponse(200, {
        projects,
        totalProjects,
        currentPage: page,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
    }, "Projects fetched successfully"));
});

const getProjectById = asynchandler(async (req, res) => {
    await req.project.populate("members.user", MEMBER_FIELDS);
    return res.status(200).json(new ApiResponse(200, req.project, "Project fetched successfully"));
});

const updateProject = asynchandler(async (req, res) => {
    const project = req.project;
    // Explicit whitelist: owner, workspace, key, members and taskSequence can
    // never be changed through this endpoint, whatever the body contains.
    const { name, description, category, methodology, status, visibility } = req.body;
    const changes = { name, description, category, methodology, status, visibility };

    // Record the before/after diff for the audit log BEFORE mutating the document.
    trackChanges(req, project, changes);
    for (const [field, value] of Object.entries(changes)) {
        if (value !== undefined) project[field] = value;
    }
    // Replaces the whole set: statuses left out go back to "no limit".
    if (req.body.wipLimits !== undefined) {
        for (const status of AvailableTaskStatuses) {
            project.settings.wipLimits[status] = req.body.wipLimits[status] ?? 0;
        }
    }
    await project.save();

    return res.status(200).json(new ApiResponse(200, project, "Project updated successfully"));
});

const deleteProject = asynchandler(async (req, res) => {
    const project = req.project;

    // Ownership rule on top of the role check: only the owner (or super_admin)
    // may delete, even though project managers hold project:*.
    const isOwner = project.owner.equals(req.user._id);
    if (!isOwner && req.user.systemRole !== SystemRolesEnum.SUPER_ADMIN) {
        throw new ApiError(403, "Only the project owner can delete this project");
    }

    // Children first, parent last, each step idempotent. If the process dies
    // halfway, the project still exists and a retried DELETE finishes the job.
    // (A transaction would make this atomic, but needs a replica set, which the
    // local-development database is not.) Audit logs are deliberately kept:
    // an audit trail must outlive the things it records.
    const byProject = { project: project._id };
    await Comment.deleteMany(byProject);
    await Task.deleteMany(byProject);
    await Sprint.deleteMany(byProject);
    await Note.deleteMany(byProject);
    await project.deleteOne();

    // The in-memory `project` still holds the member list, even though the
    // document is gone from the database.
    notifyProjectDeleted(project, req.user);

    return res.status(200).json(new ApiResponse(200, { _id: project._id }, "Project and associated data deleted"));
});

// ─── Members ───────────────────────────────────

const getProjectMembers = asynchandler(async (req, res) => {
    const project = await req.project.populate([
        { path: "members.user", select: `${MEMBER_FIELDS} systemRole jobTitle department` },
        { path: "invitations.user", select: MEMBER_FIELDS },
        { path: "invitations.invitedBy", select: "fullName username" },
    ]);
    return res.status(200).json(new ApiResponse(200, {
        members: project.members,
        // Pending: invited but not yet accepted. Shown to members so nobody
        // invites the same person twice or wonders where they went.
        invitations: project.invitations,
        projectName: project.name,
        projectKey: project.key,
    }, "Project members fetched"));
});

/**
 * Adding a member creates a pending invitation; the invitee joins by accepting.
 * The conditional update makes "already a member or invited" and the insert a
 * single atomic operation, so two concurrent invites cannot both succeed.
 */
const addMemberToProject = asynchandler(async (req, res) => {
    const { email, role = "developer" } = req.body;

    const invitee = await User.findOne({ email }).select("_id");
    if (!invitee) throw new ApiError(404, "No user with this email");

    const project = await Project.findOneAndUpdate(
        {
            _id: req.project._id,
            "members.user": { $ne: invitee._id },
            "invitations.user": { $ne: invitee._id },
        },
        { $push: { invitations: { user: invitee._id, role, invitedBy: req.user._id } } },
        { new: true, runValidators: true }
    );
    if (!project) throw new ApiError(409, "User is already a member or has a pending invitation");

    notifyProjectInvitation(project, invitee._id, req.user);

    return res.status(200).json(new ApiResponse(200, project, "Invitation sent"));
});

// PUT /projects/:projectId/members/:userId { newRole }. The owner cannot be demoted.
const updateMemberRole = asynchandler(async (req, res) => {
    const { userId } = req.params;
    const { newRole } = req.body;
    const project = req.project;

    const member = findMember(project.members, userId);
    if (!member) throw new ApiError(404, "Member not found in project");
    if (project.owner.equals(userId) && newRole !== "project_manager") {
        throw new ApiError(400, "The project owner must remain a project manager");
    }

    member.role = newRole;
    await project.save();

    return res.status(200).json(new ApiResponse(200, project, "Member role updated"));
});

const removeMemberFromProject = asynchandler(async (req, res) => {
    const { userId } = req.params;
    const project = req.project;

    if (project.owner.equals(userId)) throw new ApiError(400, "Cannot remove the project owner");
    if (!findMember(project.members, userId)) throw new ApiError(404, "Member not found in project");

    project.members = project.members.filter((m) => !m.user.equals(userId));
    await project.save();

    // Removed members should not stay assigned to work they can no longer see.
    await Task.updateMany({ project: project._id }, { $pull: { assignees: userId, watchers: userId } });

    return res.status(200).json(new ApiResponse(200, project, "Member removed"));
});

// ─── Invitations (act on the caller's own invitation) ─────

// GET /projects/invitations/me: flattened into one object per invitation,
// for the dashboard's InvitationsBanner.
const getPendingInvitations = asynchandler(async (req, res) => {
    const userId = req.user._id;
    const projects = await Project.find({ "invitations.user": userId })
        .select("name key description invitations owner")
        .populate("invitations.invitedBy", "fullName username email")
        .populate("owner", "fullName username email");

    const invitations = projects.map((p) => {
        const invite = p.invitations.find((i) => i.user.equals(userId));
        return {
            projectId: p._id,
            projectName: p.name,
            projectKey: p.key,
            projectDescription: p.description,
            owner: p.owner,
            role: invite.role,
            invitedBy: invite.invitedBy,
            invitedAt: invite.invitedAt,
        };
    });

    return res.status(200).json(new ApiResponse(200, { invitations }, "Invitations fetched"));
});

/**
 * Accept = move my invitation into members, in one atomic update. The filter
 * matches only while the invitation exists, so a double-click cannot add the
 * member twice: the second request finds nothing and gets a 404.
 */
const acceptInvitation = asynchandler(async (req, res) => {
    const userId = req.user._id;
    const pending = await Project.findOne(
        { _id: req.params.projectId, "invitations.user": userId },
        { "invitations.$": 1 }
    );
    if (!pending) throw new ApiError(404, "Invitation not found");

    const project = await Project.findOneAndUpdate(
        { _id: req.params.projectId, "invitations.user": userId, "members.user": { $ne: userId } },
        {
            $pull: { invitations: { user: userId } },
            $push: { members: { user: userId, role: pending.invitations[0].role } },
        },
        { new: true }
    );
    if (!project) throw new ApiError(404, "Invitation not found");

    return res.status(200).json(new ApiResponse(200, project, "Invitation accepted"));
});

// modifiedCount === 0 means there was no invitation for me on this project.
const rejectInvitation = asynchandler(async (req, res) => {
    const result = await Project.updateOne(
        { _id: req.params.projectId, "invitations.user": req.user._id },
        { $pull: { invitations: { user: req.user._id } } }
    );
    if (result.modifiedCount === 0) throw new ApiError(404, "Invitation not found");

    return res.status(200).json(new ApiResponse(200, null, "Invitation rejected"));
});

export {
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
};
