import Project from "../models/project.models.js";
import { Task } from "../models/task.models.js";
import { Sprint } from "../models/sprint.models.js";
import { Comment } from "../models/comment.models.js";
import { ApiError } from "../utils/api-errors.js";
import { ApiResponse } from "../utils/api-response.js";
import { asynchandler } from "../utils/asynchandler.js";
import { isProjectMember } from "../utils/permissions.js";
import { clampPagination, escapeRegex } from "../utils/helpers.js";
import { trackChanges } from "../middlewares/audit.middleware.js";
import { notifyTaskAssigned, notifyTaskStatusChanged } from "../services/notification.service.js";

/*
 * Every handler here runs after authorizeProject(), which has already:
 *   - verified the caller is a member of :projectId with the needed permission
 *   - loaded the project into req.project
 * So handlers never re-check roles, and every child lookup is scoped to the
 * project ({ _id: taskId, project: projectId }) so an id from another project
 * simply is not found.
 */

const USER_FIELDS = "fullName username email avatar";

const populateTask = (query) =>
    query
        .populate("assignees", USER_FIELDS)
        .populate("reporter", USER_FIELDS)
        .populate("project", "name key")
        .populate("sprint", "name status startDate endDate");

// Cross-document rules the validator cannot check without the database.
const assertAssigneesAreMembers = (project, assignees = []) => {
    for (const id of assignees) {
        if (!isProjectMember(project, id)) {
            throw new ApiError(400, `Assignee ${id} is not a member of this project`);
        }
    }
};

const assertSprintInProject = async (sprintId, projectId) => {
    if (sprintId && !(await Sprint.exists({ _id: sprintId, project: projectId }))) {
        throw new ApiError(400, "Sprint not found in this project");
    }
};

const assertParentInProject = async (parentId, projectId, taskId) => {
    if (!parentId) return;
    if (taskId && parentId === taskId.toString()) throw new ApiError(400, "A task cannot be its own parent");
    if (!(await Task.exists({ _id: parentId, project: projectId }))) {
        throw new ApiError(400, "Parent task not found in this project");
    }
};

// --- TASK OPERATIONS ---

const createTask = asynchandler(async (req, res) => {
    const project = req.project;
    const {
        title, description, assignees = [], status = "todo", issueType, priority, storyPoints,
        sprint, parent, labels, dueDate, originalEstimate,
    } = req.body;

    assertAssigneesAreMembers(project, assignees);
    await assertSprintInProject(sprint, project._id);
    await assertParentInProject(parent, project._id);

    // Atomic increment: two concurrent creates can never get the same number.
    // If the insert below fails, that number is skipped — a harmless gap, so no
    // transaction is needed. The unique {project, issueNumber} index backs this.
    const { taskSequence: issueNumber } = await Project.findByIdAndUpdate(
        project._id,
        { $inc: { taskSequence: 1 } },
        { new: true, projection: { taskSequence: 1 } }
    );

    const task = await Task.create({
        issueKey: `${project.key}-${issueNumber}`,
        issueNumber,
        title,
        description,
        project: project._id,
        assignees,
        issueType,
        priority,
        storyPoints,
        sprint: sprint || undefined,
        parent: parent || undefined,
        labels,
        dueDate: dueDate || undefined,
        timeTracking: { originalEstimate: originalEstimate ?? 0, timeRemaining: originalEstimate ?? 0 },
        reporter: req.user._id,
        status, // statusCategory and completedAt are derived by the model's pre-save hook
        stateTransitions: [{ from: "none", to: status, changedBy: req.user._id, comment: "Task created" }],
    });

    notifyTaskAssigned(task, assignees, req.user);

    const populated = await populateTask(Task.findById(task._id));
    return res.status(201).json(new ApiResponse(201, populated, "Task created successfully"));
});

const getProjectTasks = asynchandler(async (req, res) => {
    const { status, priority, issueType, sprint, search } = req.query;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit, 100);

    // Query values are only ever used as equality matches on strings, and
    // Express 5's query parser cannot produce objects, so these cannot carry
    // MongoDB operators.
    const filter = { project: req.project._id, isArchived: { $ne: true } };
    if (typeof status === "string") filter.status = status;
    if (typeof priority === "string") filter.priority = priority;
    if (typeof issueType === "string") filter.issueType = issueType;
    if (typeof sprint === "string") filter.sprint = sprint;
    if (typeof search === "string" && search.trim()) {
        const pattern = new RegExp(escapeRegex(search.trim()), "i");
        filter.$or = [{ title: pattern }, { issueKey: pattern }, { description: pattern }];
    }

    const [tasks, totalTasks] = await Promise.all([
        Task.find(filter)
            .populate("assignees", USER_FIELDS)
            .populate("reporter", USER_FIELDS)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Task.countDocuments(filter),
    ]);

    return res.status(200).json(
        new ApiResponse(200, {
            tasks,
            currentPage: page,
            totalPages: Math.ceil(totalTasks / limit),
            totalTasks,
        }, "Project tasks fetched successfully")
    );
});

const getTaskById = asynchandler(async (req, res) => {
    const task = await populateTask(Task.findOne({ _id: req.params.taskId, project: req.project._id }));
    if (!task) throw new ApiError(404, "Task not found");

    return res.status(200).json(new ApiResponse(200, task, "Task fetched successfully"));
});

const updateTask = asynchandler(async (req, res) => {
    const project = req.project;
    const task = await Task.findOne({ _id: req.params.taskId, project: project._id });
    if (!task) throw new ApiError(404, "Task not found");

    const {
        title, description, assignees, status, issueType, priority, storyPoints,
        sprint, parent, labels, dueDate, originalEstimate, remainingEstimate,
    } = req.body;

    if (assignees !== undefined) assertAssigneesAreMembers(project, assignees);
    if (sprint) await assertSprintInProject(sprint, project._id);
    if (parent) await assertParentInProject(parent, project._id, task._id);

    trackChanges(req, task, { title, status, priority, issueType, storyPoints, dueDate });

    const previousAssignees = task.assignees.map(String);

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (issueType !== undefined) task.issueType = issueType;
    if (priority !== undefined) task.priority = priority;
    if (storyPoints !== undefined) task.storyPoints = storyPoints;
    if (labels !== undefined) task.labels = labels;
    if (dueDate !== undefined) task.dueDate = dueDate || undefined;
    if (assignees !== undefined) task.assignees = assignees;
    if (sprint !== undefined) task.sprint = sprint || undefined;
    if (parent !== undefined) task.parent = parent || undefined;
    if (originalEstimate !== undefined) task.timeTracking.originalEstimate = originalEstimate;
    if (remainingEstimate !== undefined) task.timeTracking.timeRemaining = remainingEstimate;

    const oldStatus = task.status;
    const statusChanged = status !== undefined && status !== oldStatus;
    if (statusChanged) {
        task.status = status; // the pre-save hook updates statusCategory/completedAt
        task.stateTransitions.push({ from: oldStatus, to: status, changedBy: req.user._id });
    }

    await task.save();

    // Notify only people newly assigned, and only after the write succeeded.
    if (assignees !== undefined) {
        notifyTaskAssigned(task, assignees.filter((id) => !previousAssignees.includes(String(id))), req.user);
    }
    if (statusChanged) notifyTaskStatusChanged(task, oldStatus, status, req.user);

    const populated = await populateTask(Task.findById(task._id));
    return res.status(200).json(new ApiResponse(200, populated, "Task updated successfully"));
});

const deleteTask = asynchandler(async (req, res) => {
    const { taskId } = req.params;
    const filter = { _id: taskId, project: req.project._id };
    if (!(await Task.exists(filter))) throw new ApiError(404, "Task not found");

    // Children first, then the parent. If the process dies in between, the
    // task still exists and the user can simply delete it again; the reverse
    // order would leave orphaned comments that nothing can reach.
    await Comment.deleteMany({ task: taskId });
    await Task.deleteOne(filter);

    return res.status(200).json(new ApiResponse(200, null, "Task deleted successfully"));
});

// --- SUBTASK OPERATIONS ---

const createSubtask = asynchandler(async (req, res) => {
    const { title, status = "todo" } = req.body;

    const task = await Task.findOneAndUpdate(
        { _id: req.params.taskId, project: req.project._id },
        { $push: { subtasks: { title, status } } },
        { new: true, runValidators: true }
    );
    if (!task) throw new ApiError(404, "Task not found");

    return res.status(201).json(new ApiResponse(201, task, "Subtask created successfully"));
});

const updateSubtask = asynchandler(async (req, res) => {
    const { title, status } = req.body;
    const update = {};
    if (title !== undefined) update["subtasks.$.title"] = title;
    if (status !== undefined) update["subtasks.$.status"] = status;

    // The positional "$" targets the array element matched by the filter.
    const task = await Task.findOneAndUpdate(
        { project: req.project._id, "subtasks._id": req.params.subTaskId },
        { $set: update },
        { new: true, runValidators: true }
    );
    if (!task) throw new ApiError(404, "Subtask not found");

    return res.status(200).json(new ApiResponse(200, task, "Subtask updated successfully"));
});

const deleteSubtask = asynchandler(async (req, res) => {
    const { subTaskId } = req.params;

    const task = await Task.findOneAndUpdate(
        { project: req.project._id, "subtasks._id": subTaskId },
        { $pull: { subtasks: { _id: subTaskId } } },
        { new: true }
    );
    if (!task) throw new ApiError(404, "Subtask not found");

    return res.status(200).json(new ApiResponse(200, task, "Subtask deleted successfully"));
});

export {
    createTask,
    getProjectTasks,
    getTaskById,
    updateTask,
    deleteTask,
    createSubtask,
    updateSubtask,
    deleteSubtask,
};
