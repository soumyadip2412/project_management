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

/** "@alice please check" → ["alice"] */
export const extractMentions = (body) => [...new Set([...body.matchAll(/@([a-z0-9_]{3,30})/g)].map((m) => m[1]))];

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

    if (parentComment) {
        const parent = await Comment.exists({ _id: parentComment, task: task._id, isDeleted: false });
        if (!parent) throw new ApiError(400, "Parent comment not found on this task");
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
        parentComment: parentComment || null,
        mentions: mentioned,
    });

    notifyCommentAdded(task, mentioned, req.user);

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
