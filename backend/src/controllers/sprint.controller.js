import { Sprint } from "../models/sprint.models.js";
import { Task } from "../models/task.models.js";
import { ApiError } from "../utils/api-errors.js";
import { ApiResponse } from "../utils/api-response.js";
import { asynchandler } from "../utils/asynchandler.js";
import { clampPagination } from "../utils/helpers.js";
import { NotificationTypeEnum, SprintStatusEnum, StatusCategoryEnum, TaskStatusEnum } from "../utils/constants.js";
import { notifySprintEvent } from "../services/notification.service.js";

// All handlers run after authorizeProject("sprint", ...); req.project is loaded.

const sumPoints = (tasks) => tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

const findSprintOr404 = async (req, extraFilter = {}) => {
    const sprint = await Sprint.findOne({ _id: req.params.sprintId, project: req.project._id, ...extraFilter });
    if (!sprint) throw new ApiError(404, "Sprint not found");
    return sprint;
};

const createSprint = asynchandler(async (req, res) => {
    const { name, goal, startDate, endDate } = req.body;
    const projectId = req.project._id;

    const order = await Sprint.countDocuments({ project: projectId });
    const sprint = await Sprint.create({
        name: name || `Sprint ${order + 1}`,
        project: projectId,
        goal,
        startDate,
        endDate,
        createdBy: req.user._id,
        order,
    });

    return res.status(201).json(new ApiResponse(201, sprint, "Sprint created successfully"));
});

const getProjectSprints = asynchandler(async (req, res) => {
    const filter = { project: req.project._id };
    if (typeof req.query.status === "string") filter.status = req.query.status;

    const sprints = await Sprint.find(filter)
        .populate("createdBy", "fullName username avatar")
        .sort({ order: 1, createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, sprints, "Sprints fetched successfully"));
});

const getSprintById = asynchandler(async (req, res) => {
    const sprint = await findSprintOr404(req);
    await sprint.populate("createdBy", "fullName username avatar");

    const issues = await Task.find({ sprint: sprint._id, project: req.project._id })
        .populate("assignees", "fullName username avatar")
        .populate("reporter", "fullName username avatar")
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, { sprint, issues }, "Sprint details fetched"));
});

const updateSprint = asynchandler(async (req, res) => {
    const { name, goal, startDate, endDate } = req.body;
    const sprint = await findSprintOr404(req);

    if (name !== undefined) sprint.name = name;
    if (goal !== undefined) sprint.goal = goal;
    if (startDate !== undefined) sprint.startDate = startDate;
    if (endDate !== undefined) sprint.endDate = endDate;
    // The validator checks order only when both dates are in the request;
    // this covers changing one date against the stored other one.
    if (sprint.endDate <= sprint.startDate) throw new ApiError(422, "endDate must be after startDate");

    await sprint.save();
    return res.status(200).json(new ApiResponse(200, sprint, "Sprint updated successfully"));
});

/**
 * "At most one active sprint per project" is enforced by a partial unique
 * index on Sprint ({project:1}, only where status is "active"), not by a
 * find-then-update check. Two concurrent starts used to both pass the check;
 * now the database rejects the second write atomically (E11000 → 409).
 */
const startSprint = asynchandler(async (req, res) => {
    let sprint;
    try {
        sprint = await Sprint.findOneAndUpdate(
            { _id: req.params.sprintId, project: req.project._id, status: SprintStatusEnum.PLANNED },
            { $set: { status: SprintStatusEnum.ACTIVE, startDate: new Date() } },
            { new: true }
        );
    } catch (err) {
        if (err.code === 11000) throw new ApiError(409, "Another sprint is already active. Complete it first.");
        throw err;
    }
    if (!sprint) throw new ApiError(404, "Sprint not found or not in the planned state");

    const issues = await Task.find({ sprint: sprint._id }).select("storyPoints statusCategory");
    const totalPoints = sumPoints(issues);
    const completedPoints = sumPoints(issues.filter((t) => t.statusCategory === "done"));

    sprint.burndownData.push({
        date: new Date(),
        totalPoints,
        completedPoints,
        remainingPoints: totalPoints - completedPoints,
        addedPoints: 0,
    });
    sprint.summary.totalIssues = issues.length;
    sprint.summary.totalStoryPoints = totalPoints;
    await sprint.save();

    notifySprintEvent(NotificationTypeEnum.SPRINT_STARTED, sprint, req.project, req.user);

    return res.status(200).json(new ApiResponse(200, sprint, "Sprint started successfully"));
});

/**
 * Validate everything first, then write. The old version marked the sprint
 * completed and only then discovered an invalid target sprint, leaving the
 * sprint closed with its unfinished tasks still attached.
 */
const completeSprint = asynchandler(async (req, res) => {
    const { moveIncompleteToSprint } = req.body;
    const projectId = req.project._id;

    const sprint = await findSprintOr404(req, { status: SprintStatusEnum.ACTIVE });

    if (moveIncompleteToSprint) {
        const target = await Sprint.exists({
            _id: moveIncompleteToSprint,
            project: projectId,
            status: SprintStatusEnum.PLANNED,
        });
        if (!target) throw new ApiError(400, "Target sprint must be a planned sprint in this project");
    }

    const issues = await Task.find({ sprint: sprint._id }).select("storyPoints statusCategory");
    const completed = issues.filter((t) => t.statusCategory === "done");
    const incompleteIds = issues.filter((t) => t.statusCategory !== "done").map((t) => t._id);
    const totalPoints = sumPoints(issues);
    const completedPoints = sumPoints(completed);

    // Move unfinished work before closing the sprint: if this step fails the
    // sprint is still active and the request can be retried.
    if (incompleteIds.length > 0) {
        const update = moveIncompleteToSprint
            ? { $set: { sprint: moveIncompleteToSprint } }
            : { $unset: { sprint: "" }, $set: { status: TaskStatusEnum.BACKLOG, statusCategory: StatusCategoryEnum.TODO } };
        await Task.updateMany({ _id: { $in: incompleteIds } }, update);
    }

    sprint.status = SprintStatusEnum.COMPLETED;
    sprint.completedAt = new Date();
    sprint.velocity = completedPoints;
    sprint.summary = {
        totalIssues: issues.length,
        completedIssues: completed.length,
        incompleteIssues: incompleteIds.length,
        totalStoryPoints: totalPoints,
        completedStoryPoints: completedPoints,
        addedDuringSprint: sprint.burndownData.reduce((sum, d) => sum + (d.addedPoints || 0), 0),
    };
    sprint.burndownData.push({
        date: new Date(),
        totalPoints,
        completedPoints,
        remainingPoints: totalPoints - completedPoints,
        addedPoints: 0,
    });
    await sprint.save();

    notifySprintEvent(NotificationTypeEnum.SPRINT_COMPLETED, sprint, req.project, req.user);

    return res.status(200).json(new ApiResponse(200, sprint, "Sprint completed successfully"));
});

const deleteSprint = asynchandler(async (req, res) => {
    const sprint = await findSprintOr404(req);
    if (sprint.status === SprintStatusEnum.ACTIVE) {
        throw new ApiError(400, "Cannot delete an active sprint. Complete it first.");
    }

    await Task.updateMany(
        { sprint: sprint._id },
        { $unset: { sprint: "" }, $set: { status: TaskStatusEnum.BACKLOG, statusCategory: StatusCategoryEnum.TODO } }
    );
    await sprint.deleteOne();

    return res.status(200).json(new ApiResponse(200, null, "Sprint deleted successfully"));
});

const getBurndownData = asynchandler(async (req, res) => {
    const sprint = await findSprintOr404(req);
    return res.status(200).json(new ApiResponse(200, {
        burndownData: sprint.burndownData,
        summary: sprint.summary,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        velocity: sprint.velocity,
    }, "Burndown data fetched"));
});

const getVelocityData = asynchandler(async (req, res) => {
    const { limit } = clampPagination(1, req.query.limit ?? 10, 50);

    const completedSprints = await Sprint.find({ project: req.project._id, status: SprintStatusEnum.COMPLETED })
        .sort({ completedAt: -1 })
        .limit(limit)
        .select("name velocity summary completedAt");

    const velocityData = completedSprints.reverse().map((s) => ({
        sprintName: s.name,
        velocity: s.velocity,
        committed: s.summary.totalStoryPoints,
        completed: s.summary.completedStoryPoints,
        completedAt: s.completedAt,
    }));
    const avgVelocity = velocityData.length
        ? Math.round(velocityData.reduce((sum, d) => sum + d.velocity, 0) / velocityData.length)
        : 0;

    return res.status(200).json(new ApiResponse(200, { velocityData, avgVelocity }, "Velocity data fetched"));
});

export {
    createSprint,
    getProjectSprints,
    getSprintById,
    updateSprint,
    startSprint,
    completeSprint,
    deleteSprint,
    getBurndownData,
    getVelocityData,
};
