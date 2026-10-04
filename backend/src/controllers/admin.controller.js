import { User } from "../models/user.models.js";
import { AuditLog } from "../models/auditLog.models.js";
import Project from "../models/project.models.js";
import { Task } from "../models/task.models.js";
import { Sprint } from "../models/sprint.models.js";
import Workspace from "../models/workspace.models.js";
import { ApiError } from "../utils/api-errors.js";
import { ApiResponse } from "../utils/api-response.js";
import { asynchandler } from "../utils/asynchandler.js";
import { clampPagination, escapeRegex } from "../utils/helpers.js";

// Routes are gated by authorizeSystem(): user:read (super_admin, hr),
// user:update / analytics / audit (super_admin only).

const listUsers = asynchandler(async (req, res) => {
    const { search, systemRole, isActive } = req.query;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit ?? 20, 100);

    const filter = {};
    if (typeof search === "string" && search.trim()) {
        const pattern = new RegExp(escapeRegex(search.trim()), "i"); // escaped: no ReDoS
        filter.$or = [{ fullName: pattern }, { username: pattern }, { email: pattern }];
    }
    if (typeof systemRole === "string") filter.systemRole = systemRole;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const [users, total] = await Promise.all([
        User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        User.countDocuments(filter),
    ]);

    return res.status(200).json(new ApiResponse(200, {
        users,
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
    }, "Users fetched"));
});

const loadTargetUser = async (req) => {
    const { userId } = req.params;
    if (userId === req.user._id.toString()) throw new ApiError(400, "You cannot change your own role or status");

    const target = await User.findById(userId);
    if (!target) throw new ApiError(404, "User not found");
    return target;
};

const updateUserRole = asynchandler(async (req, res) => {
    const target = await loadTargetUser(req);

    target.systemRole = req.body.systemRole; // validated against the enum
    // Revoke existing sessions: tokens carry the old role's context.
    target.revokeSessions();
    await target.save();

    return res.status(200).json(new ApiResponse(200, target, "User role updated successfully"));
});

const updateUserStatus = asynchandler(async (req, res) => {
    const target = await loadTargetUser(req);
    const { isActive } = req.body;

    target.isActive = isActive;
    target.deactivatedAt = isActive ? undefined : new Date();
    if (!isActive) target.revokeSessions(); // takes effect on the very next request
    await target.save();

    return res.status(200).json(
        new ApiResponse(200, target, `User ${isActive ? "activated" : "deactivated"} successfully`)
    );
});

const getSystemAnalytics = asynchandler(async (req, res) => {
    const groupCount = (field) => [
        { $match: { isArchived: { $ne: true } } },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ];

    const [
        totalUsers, activeUsers, totalProjects, totalTasks, totalSprints, totalWorkspaces,
        tasksByStatus, tasksByPriority, tasksByType, usersByRole,
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        Project.countDocuments({ isArchived: false }),
        Task.countDocuments({ isArchived: false }),
        Sprint.countDocuments(),
        Workspace.countDocuments({ isActive: true }),
        Task.aggregate(groupCount("status")),
        Task.aggregate(groupCount("priority")),
        Task.aggregate(groupCount("issueType")),
        User.aggregate([{ $group: { _id: "$systemRole", count: { $sum: 1 } } }]),
    ]);

    return res.status(200).json(new ApiResponse(200, {
        overview: { totalUsers, activeUsers, totalProjects, totalTasks, totalSprints, totalWorkspaces },
        tasksByStatus,
        tasksByPriority,
        tasksByType,
        usersByRole,
    }, "System analytics fetched"));
});

const getAuditLog = asynchandler(async (req, res) => {
    const { entityType, action, actorId, projectId } = req.query;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit ?? 50, 100);

    const filter = {};
    if (typeof entityType === "string") filter.entityType = entityType;
    if (typeof action === "string") filter.action = action;
    if (typeof actorId === "string") filter.actor = actorId;
    if (typeof projectId === "string") filter.project = projectId;

    const [logs, total] = await Promise.all([
        AuditLog.find(filter).populate("actor", "fullName username avatar").sort({ createdAt: -1 }).skip(skip).limit(limit),
        AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json(new ApiResponse(200, {
        logs,
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
    }, "Audit log fetched"));
});

export { listUsers, updateUserRole, updateUserStatus, getSystemAnalytics, getAuditLog };
