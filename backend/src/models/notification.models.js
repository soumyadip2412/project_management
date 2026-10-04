import mongoose, { Schema } from "mongoose";
import { AvailableNotificationTypes } from "../utils/constants.js";

const notificationSchema = new Schema({
    recipient: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: AvailableNotificationTypes,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    body: String,
    // Link back to the entity
    entityType: String,
    entityId: {
        type: Schema.Types.ObjectId
    },
    project: {
        type: Schema.Types.ObjectId,
        ref: "Project"
    },
    workspace: {
        type: Schema.Types.ObjectId,
        ref: "Workspace"
    },
    actor: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    // Read tracking
    isRead: { type: Boolean, default: false },
    readAt: Date,
    // Delivery channel
    channel: {
        type: String,
        enum: ["in_app", "email", "push"],
        default: "in_app"
    },
    // Email delivery status
    emailSent: { type: Boolean, default: false },
    emailSentAt: Date
}, { timestamps: true });

// ─── Indexes ─────────────────────────────────
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
// TTL: auto-delete read notifications after 90 days
notificationSchema.index(
    { readAt: 1 },
    { expireAfterSeconds: 90 * 24 * 60 * 60, partialFilterExpression: { isRead: true } }
);

export const Notification = mongoose.model("Notification", notificationSchema);
