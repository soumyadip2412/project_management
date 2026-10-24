/**
 * FILE: backend/src/models/comment.models.js
 *
 * PURPOSE
 *   A comment on a task. Stored in its OWN collection, not embedded in the task:
 *   comments grow without bound, and MongoDB documents are capped at 16 MB.
 *
 * NOTABLE FIELDS
 *   task + project  both stored. Every query includes the project id, so a
 *                   comment can never be read through a project the caller
 *                   is not a member of.
 *   author          used for the ownership rule: only the author may edit;
 *                   the author or a moderator may delete (comment.controller.js).
 *   mentions        user ids resolved from "@username" in the body. They must be
 *                   project members, and they receive a notification.
 *   parentComment, reactions, attachments, isDeleted are schema support for
 *   threads, emoji reactions and soft delete.
 *
 * ROUTES
 *   /api/v1/projects/:projectId/tasks/:taskId/comments (routes/comment.routes.js)
 *
 * INTERVIEW NOTES
 *   Q: Embed vs. reference: how did you decide?
 *   A: Embed what is small, bounded and always read with its parent (project
 *      members, subtasks). Reference what is unbounded or queried on its own
 *      (comments, tasks, notifications).
 */
import mongoose, { Schema } from "mongoose";

const commentSchema = new Schema({
    body: {
        type: String,
        required: true
    },
    bodyHtml: String,
    task: {
        type: Schema.Types.ObjectId,
        ref: "Task",
        required: true
    },
    project: {
        type: Schema.Types.ObjectId,
        ref: "Project",
        required: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Threaded replies
    parentComment: {
        type: Schema.Types.ObjectId,
        ref: "Comment"
    },
    // @mentions extracted from body
    mentions: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    // Emoji reactions
    reactions: [{
        emoji: String,
        users: [{
            type: Schema.Types.ObjectId,
            ref: "User"
        }]
    }],
    attachments: [{
        url: String,
        filename: String,
        mimeType: String,
        size: Number
    }],
    isEdited: { type: Boolean, default: false },
    editedAt: Date,
    isDeleted: { type: Boolean, default: false },  // soft delete
    deletedAt: Date
}, { timestamps: true });

// -1 = descending: "comments of a task, newest first" is served straight from the index.
commentSchema.index({ task: 1, createdAt: -1 });
commentSchema.index({ project: 1, createdAt: -1 });
commentSchema.index({ author: 1 });
commentSchema.index({ parentComment: 1 });

export const Comment = mongoose.model("Comment", commentSchema);
