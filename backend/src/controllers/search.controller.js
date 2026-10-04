import { Task } from "../models/task.models.js";
import Project from "../models/project.models.js";
import { User } from "../models/user.models.js";
import { Note } from "../models/note.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { asynchandler } from "../utils/asynchandler.js";
import { clampPagination, escapeRegex } from "../utils/helpers.js";

const SEARCHABLE_TYPES = ["task", "project", "user", "note"];

/**
 * Global search. Everything is scoped to the caller's own projects.
 *
 * Security note: this endpoint accepts an optional ?projectId= filter. It used
 * to be trusted as-is, which let any logged-in user search any project's tasks
 * and notes (a BOLA/IDOR bug). A client-supplied id can only NARROW the set of
 * projects the caller already belongs to; it can never widen it.
 */
const globalSearch = asynchandler(async (req, res) => {
    const { q, type, projectId } = req.query;

    if (typeof q !== "string" || q.trim().length < 2) {
        return res.status(200).json(new ApiResponse(200, {}, "Provide at least 2 characters"));
    }

    const pattern = new RegExp(escapeRegex(q.trim()), "i");
    const { limit } = clampPagination(1, req.query.limit ?? 20, 50);
    const types = typeof type === "string"
        ? type.split(",").filter((t) => SEARCHABLE_TYPES.includes(t))
        : SEARCHABLE_TYPES;

    const myProjects = await Project.find({ "members.user": req.user._id }).select("_id members.user");
    const scope = typeof projectId === "string"
        ? myProjects.filter((p) => p._id.toString() === projectId)
        : myProjects;
    const projectIds = scope.map((p) => p._id);

    const results = {};

    if (types.includes("task")) {
        results.tasks = await Task.find({
            project: { $in: projectIds },
            isArchived: { $ne: true },
            $or: [{ title: pattern }, { issueKey: pattern }, { description: pattern }],
        })
            .populate("project", "name key")
            .populate("assignees", "fullName username avatar")
            .select("title issueKey issueType status priority project assignees")
            .sort({ updatedAt: -1 })
            .limit(limit);
    }

    if (types.includes("project")) {
        results.projects = await Project.find({
            _id: { $in: projectIds },
            $or: [{ name: pattern }, { key: pattern }, { description: pattern }],
        })
            .select("name key description status methodology")
            .limit(limit);
    }

    if (types.includes("user")) {
        // Only people the caller already collaborates with; a global user
        // directory (with emails) would leak every tenant's users.
        const collaboratorIds = [...new Set(myProjects.flatMap((p) => p.members.map((m) => m.user.toString())))];
        results.users = await User.find({
            _id: { $in: collaboratorIds },
            isActive: true,
            $or: [{ fullName: pattern }, { username: pattern }, { email: pattern }],
        })
            .select("fullName username email avatar department")
            .limit(limit);
    }

    if (types.includes("note")) {
        results.notes = await Note.find({
            project: { $in: projectIds },
            $or: [{ title: pattern }, { content: pattern }],
        })
            .populate("project", "name key")
            .select("title project createdAt")
            .limit(limit);
    }

    return res.status(200).json(new ApiResponse(200, results, "Search results fetched"));
});

const getRecentItems = asynchandler(async (req, res) => {
    const userId = req.user._id;
    const projectIds = (await Project.find({ "members.user": userId }).select("_id")).map((p) => p._id);

    const [recentTasks, recentProjects] = await Promise.all([
        Task.find({
            project: { $in: projectIds },
            $or: [{ assignees: userId }, { reporter: userId }, { watchers: userId }],
        })
            .populate("project", "name key")
            .select("title issueKey issueType status priority")
            .sort({ updatedAt: -1 })
            .limit(10),
        Project.find({ _id: { $in: projectIds } }).select("name key status").sort({ updatedAt: -1 }).limit(5),
    ]);

    return res.status(200).json(new ApiResponse(200, { recentTasks, recentProjects }, "Recent items fetched"));
});

export { globalSearch, getRecentItems };
