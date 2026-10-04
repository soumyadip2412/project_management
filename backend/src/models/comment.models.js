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

commentSchema.index({ task: 1, createdAt: -1 });
commentSchema.index({ project: 1, createdAt: -1 });
commentSchema.index({ author: 1 });
commentSchema.index({ parentComment: 1 });

export const Comment = mongoose.model("Comment", commentSchema);
