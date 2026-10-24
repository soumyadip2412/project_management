/**
 * FILE: backend/src/controllers/comment.controller.js
 *
 * PURPOSE
 *   Task comments (routes/comment.routes.js): create (with @mentions and
 *   notifications), list (top-level comments plus their replies), edit, soft
 *   delete, and toggle emoji reactions.
 *
 * AUTHORIZATION SPLIT
 *   Role ("may a viewer comment?")           → authorizeProject in the route.
 *   Ownership ("is this YOUR comment?")      → assertAuthorOrModerator here.
 *   Moderation ("may a lead delete yours?")  → hasPermission(role, "comment", "moderate").
 *
 * KEY CONCEPTS
 *   - @mentions: a regex extracts usernames; they are resolved to user ids, and
 *     only PROJECT MEMBERS are kept, so a mention cannot leak the task to an outsider.
 *   - Replies: fetched with ONE query for the whole page, then grouped in memory
 *     with Object.groupBy (a recent JS built-in). This avoids N+1 queries.
 *   - Soft delete: isDeleted = true instead of removing the document, so the
 *     thread stays intact and the history is auditable.
 *   - Notifications are fire-and-forget (notifyCommentAdded is not awaited).
 */
import { Comment } from "../models/comment.models.js";
import { Task } from "../models/task.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/api-errors.js";
import { ApiResponse } from "../utils/api-response.js";
import { asynchandler } from "../utils/asynchandler.js";
import { clampPagination } from "../utils/helpers.js";
import { hasPermission, isProjectMember } from "../utils/permissions.js";
import { notifyCommentAdded } from "../services/notification.service.js";

// All handlers run after authorizeProject("comment", ...). The rules left here
// are about OWNERSHIP of a particular comment.

const AUTHOR_FIELDS = "fullName username avatar";

/**
 * "@alice please check" → ["alice"]
 * matchAll yields every match; m[1] is the captured username; the Set removes
 * duplicates ("@bob ... @bob" → one mention). Exported as a pure helper
 * (no database access), so it is easy to unit-test.
 */
export const extractMentions = (body) => [...new Set([...body.matchAll(/@([a-z0-9_]{3,30})/g)].map((m) => m[1]))];

// Parent-scoped lookups: the task must belong to req.project, and the comment
// to that task AND project. Ids from elsewhere simply return 404.
const findTaskOr404 = async (req) => {
    const task = await Task.findOne({ _id: req.params.taskId, project: req.project._id });
    if (!task) throw new ApiError(404, "Task not found");
    return task;
};

const findCommentOr404 = async (req) => {
    const { taskId, commentId } = req.params;
    const comment = await Comment.findOne({ _id: commentId, task: taskId, project: req.project._id, isDeleted: false });
    if (!comment) throw new ApiError(404, "Comment not found on this task");
    return comment;
};

// Authors manage their own comments; roles holding comment:moderate (project
// leads, super_admin) may also remove other people's.
const assertAuthorOrModerator = (req, comment, verb) => {
    if (comment.author.equals(req.user._id)) return;
    if (verb === "delete" && hasPermission(req.effectiveRole, "comment", "moderate")) return;
    throw new ApiError(403, `You can only ${verb} your own comments`);
};

const createComment = asynchandler(async (req, res) => {
    const { body, parentComment } = req.body;
    const task = await findTaskOr404(req);

    // Threads are one level deep: the list returns top-level comments and their
    // direct replies. A reply to a reply joins its thread's top-level comment,
    // otherwise it would be stored but never listed.
    let threadRoot = null;
    if (parentComment) {
        const parent = await Comment.findOne({ _id: parentComment, task: task._id, isDeleted: false }).select("parentComment");
        if (!parent) throw new ApiError(400, "Parent comment not found on this task");
        threadRoot = parent.parentComment ?? parent._id;
    }

    // Only users who can actually see the task may be mentioned.
    const usernames = extractMentions(body);
    const mentioned = usernames.length
        ? (await User.find({ username: { $in: usernames } }).select("_id"))
            .filter((u) => isProjectMember(req.project, u._id))
            .map((u) => u._id)
        : [];

    const comment = await Comment.create({
        body,
        task: task._id,
        project: req.project._id,
        author: req.user._id,
        parentComment: threadRoot,
        mentions: mentioned,
    });

    // Not awaited: the response does not wait for notifications to be written.
    notifyCommentAdded(task, mentioned, req.user);

    // Re-read with the author populated, so the UI can render the name/avatar immediately.
    const populated = await Comment.findById(comment._id).populate("author", AUTHOR_FIELDS);
    return res.status(201).json(new ApiResponse(201, populated, "Comment created successfully"));
});

const getTaskComments = asynchandler(async (req, res) => {
    const { taskId } = req.params;
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit ?? 50, 100);
    const topLevel = { task: taskId, project: req.project._id, isDeleted: false, parentComment: null };

    const [comments, totalComments] = await Promise.all([
        Comment.find(topLevel)
            .populate("author", AUTHOR_FIELDS)
            .populate("mentions", "fullName username")
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit),
        Comment.countDocuments(topLevel),
    ]);

    // One query for all replies of this page (not one per comment), grouped in memory.
    const replies = await Comment.find({ parentComment: { $in: comments.map((c) => c._id) }, isDeleted: false })
        .populate("author", AUTHOR_FIELDS)
        .sort({ createdAt: 1 });

    // { "<parentId>": [reply, reply], ... }
    const repliesByParent = Object.groupBy(replies, (r) => r.parentComment.toString());
    const withReplies = comments.map((c) => ({ ...c.toObject(), replies: repliesByParent[c._id.toString()] ?? [] }));

    return res.status(200).json(new ApiResponse(200, {
        comments: withReplies,
        totalComments,
        currentPage: page,
        totalPages: Math.ceil(totalComments / limit),
    }, "Comments fetched successfully"));
});

const updateComment = asynchandler(async (req, res) => {
    const comment = await findCommentOr404(req);
    assertAuthorOrModerator(req, comment, "edit");

    comment.body = req.body.body;
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    await comment.populate("author", AUTHOR_FIELDS);
    return res.status(200).json(new ApiResponse(200, comment, "Comment updated successfully"));
});

// Soft delete: the thread structure (replies) survives the removal.
const deleteComment = asynchandler(async (req, res) => {
    const comment = await findCommentOr404(req);
    assertAuthorOrModerator(req, comment, "delete");

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    return res.status(200).json(new ApiResponse(200, null, "Comment deleted successfully"));
});

/**
 * Toggle semantics: reacting with the same emoji twice removes your reaction.
 * reactions = [{ emoji: "👍", users: [id, id] }, ...]; an emoji whose user
 * list becomes empty is removed entirely.
 */
const addReaction = asynchandler(async (req, res) => {
    const { emoji } = req.body;
    const userId = req.user._id;
    const comment = await findCommentOr404(req);

    const reaction = comment.reactions.find((r) => r.emoji === emoji);
    if (!reaction) {
        comment.reactions.push({ emoji, users: [userId] });
    } else if (reaction.users.some((u) => u.equals(userId))) {
        reaction.users.pull(userId); // toggle off
        if (reaction.users.length === 0) comment.reactions.pull(reaction._id);
    } else {
        reaction.users.push(userId);
    }
    await comment.save();

    return res.status(200).json(new ApiResponse(200, comment, "Reaction toggled"));
});

export { createComment, getTaskComments, updateComment, deleteComment, addReaction };
