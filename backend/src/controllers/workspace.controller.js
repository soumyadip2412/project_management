import Workspace from "../models/workspace.models.js";
import Project from "../models/project.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/api-errors.js";
import { ApiResponse } from "../utils/api-response.js";
import { asynchandler } from "../utils/asynchandler.js";
import { WorkspaceRolesEnum } from "../utils/constants.js";
import { findMember } from "../utils/permissions.js";

// Handlers for /workspaces/:workspaceId/... run after authorizeWorkspace(),
// which loaded req.workspace and checked the caller's workspace role.

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

    await Project.updateMany(
        { workspace: workspace._id, owner: { $ne: userId } },
        { $pull: { members: { user: userId }, invitations: { user: userId } } }
    );

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
    inviteMember,
    removeMember,
    updateMemberRole,
};
