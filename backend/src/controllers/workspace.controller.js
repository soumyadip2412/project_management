/**
 * FILE: backend/src/controllers/workspace.controller.js
 *
 * PURPOSE
 *   Workspace CRUD and membership (routes/workspace.routes.js):
 *     createWorkspace    the caller becomes owner (and first member)
 *     getUserWorkspaces  every workspace where I am in members[]
 *     getWorkspaceById   req.workspace, populated with users
 *     updateWorkspace    name / description
 *     inviteMember       add an EXISTING user by email (immediately, no accept step)
 *     removeMember       remove from the workspace AND from its projects
 *     updateMemberRole   admin | member | guest (never owner)
 *
 * KEY CONCEPTS
 *   - Atomic conditional update (inviteMember): the filter
 *     { _id, "members.user": { $ne: invitee } } plus $push means "add only if not
 *     already there" as ONE database operation. A separate "check, then push"
 *     could add the same user twice if two requests raced.
 *   - Cascading revocation (removeMember): access must not outlive membership.
 *
 * INTERVIEW NOTES
 *   Q: What is a slug?
 *   A: A URL-friendly version of a name: "My Team!" → "my-team".
 */
import Workspace from "../models/workspace.models.js";
import Project from "../models/project.models.js";
import { Task } from "../models/task.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/api-errors.js";
import { ApiResponse } from "../utils/api-response.js";
import { asynchandler } from "../utils/asynchandler.js";
import { WorkspaceRolesEnum } from "../utils/constants.js";
import { findMember } from "../utils/permissions.js";

// Handlers for /workspaces/:workspaceId/... run after authorizeWorkspace(),
// which loaded req.workspace and checked the caller's workspace role.

// Lower-case, collapse every run of non-alphanumerics into "-", trim leading
// and trailing dashes; fall back to "workspace" if nothing is left (e.g. "!!!").
const toSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "workspace";

const createWorkspace = asynchandler(async (req, res) => {
    const { name, description } = req.body;
    const slug = toSlug(name);

    // Slugs are unique per owner, not globally: two different users may both
    // have a "Marketing" workspace. The {owner, slug} unique index enforces it.
    if (await Workspace.exists({ owner: req.user._id, slug })) {
        throw new ApiError(409, "You already have a workspace with this name");
    }

    const workspace = await Workspace.create({
        name,
        slug,
        description,
        owner: req.user._id,
        members: [{ user: req.user._id, role: WorkspaceRolesEnum.OWNER }],
    });

    return res.status(201).json(new ApiResponse(201, workspace, "Workspace created successfully"));
});

const getUserWorkspaces = asynchandler(async (req, res) => {
    const workspaces = await Workspace.find({ "members.user": req.user._id })
        .populate("owner", "fullName username avatar")
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, workspaces, "Workspaces fetched"));
});

const getWorkspaceById = asynchandler(async (req, res) => {
    // Reuses the document authorizeWorkspace already loaded; populate()
    // fills in the user references on that same document.
    await req.workspace.populate([
        { path: "owner", select: "fullName username avatar" },
        { path: "members.user", select: "fullName username avatar email" },
    ]);
    return res.status(200).json(new ApiResponse(200, req.workspace, "Workspace fetched"));
});

const updateWorkspace = asynchandler(async (req, res) => {
    const { name, description } = req.body;
    const workspace = req.workspace;

    if (name !== undefined) workspace.name = name;
    if (description !== undefined) workspace.description = description;
    await workspace.save();

    return res.status(200).json(new ApiResponse(200, workspace, "Workspace updated"));
});

/**
 * Adds an existing user directly. The conditional filter makes the duplicate
 * check and the insert one atomic operation.
 */
// Only the owner gets here (workspace:delete is in workspace_owner's "workspace:*").
// Projects are never deleted with it: they may belong to other people, so a
// workspace that still has any must be emptied first.
const deleteWorkspace = asynchandler(async (req, res) => {
    const workspace = req.workspace;

    const projects = await Project.countDocuments({ workspace: workspace._id });
    if (projects > 0) {
        throw new ApiError(
            409,
            `This workspace still has ${projects} project${projects === 1 ? "" : "s"}. Delete ${projects === 1 ? "it" : "them"} first, then delete the workspace.`
        );
    }

    await workspace.deleteOne();
    return res.status(200).json(new ApiResponse(200, { _id: workspace._id }, "Workspace deleted"));
});

const inviteMember = asynchandler(async (req, res) => {
    const { email, role = WorkspaceRolesEnum.MEMBER } = req.body;

    const invitee = await User.findOne({ email }).select("_id");
    if (!invitee) throw new ApiError(404, "No user with this email");

    const workspace = await Workspace.findOneAndUpdate(
        { _id: req.workspace._id, "members.user": { $ne: invitee._id } },
        { $push: { members: { user: invitee._id, role, invitedBy: req.user._id } } },
        { new: true, runValidators: true }
    );
    if (!workspace) throw new ApiError(409, "User is already a workspace member");

    return res.status(200).json(new ApiResponse(200, workspace, "Member added"));
});

/**
 * Removing someone from a workspace also removes them from its projects.
 * Without this, access outlived membership: a removed user could keep reading
 * every project they had joined. Projects they OWN are left untouched, since a
 * project cannot lose its owner; transfer ownership first.
 */
const removeMember = asynchandler(async (req, res) => {
    const { userId } = req.params;
    const workspace = req.workspace;

    if (workspace.owner.equals(userId)) throw new ApiError(400, "Cannot remove the workspace owner");
    if (!findMember(workspace.members, userId)) throw new ApiError(404, "Member not found");

    workspace.members = workspace.members.filter((m) => !m.user.equals(userId));
    await workspace.save();

    // $pull removes every array element matching the condition, here in all of
    // the workspace's projects at once (members AND pending invitations).
    const projectFilter = { workspace: workspace._id, owner: { $ne: userId } };
    const projectIds = await Project.find(projectFilter).distinct("_id");
    await Project.updateMany(
        { _id: { $in: projectIds } },
        { $pull: { members: { user: userId }, invitations: { user: userId } } }
    );
    // As when leaving a single project: nobody stays assigned to work they can
    // no longer open.
    await Task.updateMany({ project: { $in: projectIds } }, { $pull: { assignees: userId, watchers: userId } });

    return res.status(200).json(new ApiResponse(200, workspace, "Member removed"));
});

const updateMemberRole = asynchandler(async (req, res) => {
    const { userId } = req.params;
    const workspace = req.workspace;

    const member = findMember(workspace.members, userId);
    if (!member) throw new ApiError(404, "Member not found");
    if (member.role === WorkspaceRolesEnum.OWNER) throw new ApiError(400, "Cannot change the owner's role");

    member.role = req.body.role; // validator guarantees admin | member | guest
    await workspace.save();

    return res.status(200).json(new ApiResponse(200, workspace, "Member role updated"));
});

export {
    createWorkspace,
    getUserWorkspaces,
    getWorkspaceById,
    updateWorkspace,
    deleteWorkspace,
    inviteMember,
    removeMember,
    updateMemberRole,
};
