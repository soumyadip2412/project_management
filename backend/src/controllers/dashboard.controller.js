/**
 * FILE: backend/src/controllers/dashboard.controller.js
 *
 * PURPOSE
 *   GET /api/v1/dashboard/stats: one endpoint that returns everything the
 *   dashboard home page needs:
 *     totals            totalProjects, totalTasks, activeTasks, completedTasks,
 *                       completionRate (%), teamMembers (distinct collaborators)
 *     recentProjects    my 6 most recently updated projects with a progress %
 *                       and the progress of each one's active sprint
 *     assignedToMe      up to 20 open tasks assigned to me
 *     dueSoon           my open tasks due within 7 days or overdue, soonest first
 *     pipeline          up to 6 tasks each: inDevelopment / reviewPending / completed
 *     recentActivities  the last 8 audit-log entries in my projects, each with a
 *                       readable `target` ("created PAY-9 Apple Pay")
 *
 * PERFORMANCE TECHNIQUES (good interview material)
 *   - ONE aggregation groups all my tasks by (project, status), replacing
 *     3 + 2×N separate count queries.
 *   - Independent queries run in parallel with Promise.all.
 *   - .lean() returns plain JS objects instead of full Mongoose documents
 *     (no getters or change tracking), which is faster for read-only data.
 *   - withTargets avoids the "N+1 query problem": it batches ids per entity
 *     type and runs one `$in` query per type, not one query per activity row.
 *
 * SCOPE: every query is limited to projects where the caller is a member.
 */
import Project from "../models/project.models.js";
import { Task } from "../models/task.models.js";
import { AuditLog } from "../models/auditLog.models.js";
import { Comment } from "../models/comment.models.js";
import { Sprint } from "../models/sprint.models.js";
import { Note } from "../models/note.models.js";
import { User } from "../models/user.models.js";
import { asynchandler } from "../utils/asynchandler.js";
import { ApiResponse } from "../utils/api-response.js";
import { SprintStatusEnum, StatusCategoryEnum, TaskStatusEnum } from "../utils/constants.js";

const ACTIVE_STATUSES = [TaskStatusEnum.TODO, TaskStatusEnum.IN_PROGRESS, TaskStatusEnum.IN_REVIEW, TaskStatusEnum.QA_TESTING];
const RECENT_PROJECTS = 6;

/**
 * Gives each activity entry a `target` the feed can name and link to
 * ("created PAY-9 Apple Pay", "started Sprint 2"). One query per entity type,
 * never one per entry. Entries whose entity was deleted keep `target: null`
 * and are described generically.
 */
const withTargets = async (activities) => {
    // All entity ids of one type that appear in the feed.
    const idsOf = (type) => activities.filter((a) => a.entityType === type && a.entityId).map((a) => a.entityId);

    // A comment entry is shown as its TASK, so first map comment id → task id
    // (this lookup must finish before the task query below).
    const comments = await Comment.find({ _id: { $in: idsOf("comment") } }).select("task").lean();
    const commentTask = new Map(comments.map((c) => [c._id.toString(), c.task?.toString()]));

    const [tasks, sprints, projects, notes, users] = await Promise.all([
        Task.find({ _id: { $in: [...idsOf("task"), ...commentTask.values()].filter(Boolean) } }).select("issueKey title project").lean(),
        Sprint.find({ _id: { $in: idsOf("sprint") } }).select("name project").lean(),
        Project.find({ _id: { $in: idsOf("project") } }).select("name key").lean(),
        Note.find({ _id: { $in: idsOf("note") } }).select("title project").lean(),
        User.find({ _id: { $in: idsOf("member") } }).select("fullName username").lean(),
    ]);
    // Index each result list by id so each lookup below is O(1).
    const byId = (docs) => new Map(docs.map((d) => [d._id.toString(), d]));
    const [taskMap, sprintMap, projectMap, noteMap, userMap] = [tasks, sprints, projects, notes, users].map(byId);

    const taskTarget = (t) => t && { type: "task", label: `${t.issueKey} ${t.title}`, taskId: t._id, projectId: t.project };

    return activities.map((a) => {
        const id = a.entityId?.toString();
        let target = null;
        if (a.entityType === "task") target = taskTarget(taskMap.get(id));
        else if (a.entityType === "comment") target = taskTarget(taskMap.get(commentTask.get(id)));
        else if (a.entityType === "sprint") {
            const s = sprintMap.get(id);
            target = s && { type: "sprint", label: s.name, projectId: s.project };
        } else if (a.entityType === "project") {
            const p = projectMap.get(id);
            target = p && { type: "project", label: p.name, projectId: p._id };
        } else if (a.entityType === "note") {
            const n = noteMap.get(id);
            target = n && { type: "note", label: n.title, projectId: n.project };
        } else if (a.entityType === "member") {
            const u = userMap.get(id);
            target = u && { type: "member", label: u.fullName || u.username, projectId: a.project };
        }
        return { ...a, target: target || null };
    });
};

// Up to 6 most recently touched tasks in a given status (or { $in: [...] }),
// used for the three "pipeline" columns on the dashboard. (A plain query, not
// an aggregation pipeline, despite the name.)
const pipeline = (projectIds, status) =>
    Task.find({ project: { $in: projectIds }, status })
        .sort({ updatedAt: -1 })
        .limit(6)
        .populate("assignees", "fullName username avatar")
        .populate("project", "name key")
        .lean();

export const getDashboardStats = asynchandler(async (req, res) => {
    const userProjects = await Project.find({ "members.user": req.user._id })
        .sort({ updatedAt: -1 })
        .populate("members.user", "fullName username avatar email")
        .lean();
    const projectIds = userProjects.map((p) => p._id);

    // One aggregation replaces what used to be 3 + 2×N countDocuments calls
    // (two per project for the progress bars): group every task of every
    // project by (project, status) in a single pass over the {project,status} index.
    const counts = await Task.aggregate([
        { $match: { project: { $in: projectIds } } },
        { $group: { _id: { project: "$project", status: "$status" }, count: { $sum: 1 } } },
    ]);

    const perProject = new Map(); // projectId → { total, done }
    let totalTasks = 0;
    let activeTasks = 0;
    let completedTasks = 0;
    for (const { _id, count } of counts) {
        const key = _id.project.toString();
        const entry = perProject.get(key) ?? { total: 0, done: 0 };
        entry.total += count;
        totalTasks += count;
        if (_id.status === TaskStatusEnum.DONE) {
            entry.done += count;
            completedTasks += count;
        }
        if (ACTIVE_STATUSES.includes(_id.status)) activeTasks += count;
        perProject.set(key, entry);
    }

    // Distinct people across all my projects (a Set removes duplicates).
    const memberIds = new Set(
        userProjects.flatMap((p) => p.members.map((m) => (m.user?._id ?? m.user)?.toString())).filter(Boolean)
    );

    const recentSlice = userProjects.slice(0, RECENT_PROJECTS);

    // Active sprint per recent project: one find plus one aggregation, so the
    // cost does not grow with the number of projects.
    const activeSprints = await Sprint.find({ project: { $in: recentSlice.map((p) => p._id) }, status: SprintStatusEnum.ACTIVE })
        .select("name startDate endDate burndownData project")
        .lean();
    const notDone = { $ne: ["$statusCategory", StatusCategoryEnum.DONE] };
    const sprintTotals = activeSprints.length
        ? await Task.aggregate([
            { $match: { sprint: { $in: activeSprints.map((s) => s._id) } } },
            {
                $group: {
                    _id: "$sprint",
                    totalPoints: { $sum: { $ifNull: ["$storyPoints", 0] } },
                    remainingPoints: { $sum: { $cond: [notDone, { $ifNull: ["$storyPoints", 0] }, 0] } },
                    totalIssues: { $sum: 1 },
                    openIssues: { $sum: { $cond: [notDone, 1, 0] } },
                    myOpenIssues: {
                        $sum: { $cond: [{ $and: [notDone, { $in: [req.user._id, { $ifNull: ["$assignees", []] }] }] }, 1, 0] },
                    },
                },
            },
        ])
        : [];
    const totalsBySprint = new Map(sprintTotals.map((t) => [t._id.toString(), t]));
    const sprintByProject = new Map(activeSprints.map((s) => {
        const t = totalsBySprint.get(s._id.toString());
        return [s.project.toString(), {
            _id: s._id,
            name: s.name,
            startDate: s.startDate,
            endDate: s.endDate,
            startPoints: s.burndownData?.[0]?.totalPoints ?? null,
            totalPoints: t?.totalPoints ?? 0,
            remainingPoints: t?.remainingPoints ?? 0,
            totalIssues: t?.totalIssues ?? 0,
            openIssues: t?.openIssues ?? 0,
            myOpenIssues: t?.myOpenIssues ?? 0,
        }];
    }));

    const recentProjects = recentSlice.map((project) => {
        const { total = 0, done = 0 } = perProject.get(project._id.toString()) ?? {};
        return {
            ...project,
            totalTasks: total,
            completedTasks: done,
            progress: total > 0 ? Math.round((done / total) * 100) : 0,
            activeSprint: sprintByProject.get(project._id.toString()) ?? null,
        };
    });

    // "My work": open issues assigned to the caller, in their projects only.
    const mine = (extra) => Task.find({
        project: { $in: projectIds },
        assignees: req.user._id,
        statusCategory: { $ne: StatusCategoryEnum.DONE },
        ...extra,
    })
        .select("issueKey title status statusCategory dueDate issueType priority project")
        .populate("project", "name key")
        .limit(20)
        .lean();
    const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [assignedToMe, dueSoon] = await Promise.all([
        mine({}).sort({ updatedAt: -1 }),
        mine({ dueDate: { $ne: null, $lte: weekAhead } }).sort({ dueDate: 1 }),
    ]);

    const [inDevelopment, reviewPending, completed, recentActivities] = await Promise.all([
        pipeline(projectIds, TaskStatusEnum.IN_PROGRESS),
        pipeline(projectIds, { $in: [TaskStatusEnum.IN_REVIEW, TaskStatusEnum.QA_TESTING] }),
        pipeline(projectIds, TaskStatusEnum.DONE),
        AuditLog.find({ project: { $in: projectIds } })
            .sort({ createdAt: -1 })
            .limit(8)
            .populate("actor", "fullName username avatar")
            .lean(),
    ]);

    return res.status(200).json(new ApiResponse(200, {
        totalProjects: userProjects.length,
        activeTasks,
        completedTasks,
        totalTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        teamMembers: memberIds.size,
        recentProjects,
        assignedToMe,
        dueSoon,
        pipeline: { inDevelopment, reviewPending, completed },
        recentActivities: await withTargets(recentActivities),
    }, "Dashboard statistics retrieved successfully"));
});
