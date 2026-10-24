/**
 * FILE: backend/src/models/notification.models.js
 *
 * PURPOSE
 *   An in-app notification for ONE recipient ("Asha assigned you WEB-12").
 *   Written by services/notification.service.js after successful actions,
 *   read and marked read through routes/notification.routes.js (the bell in the UI).
 *
 * KEY CONCEPTS
 *   - Fan-out on write: a notification for 3 assignees is 3 documents, one per
 *     recipient. Reading "my notifications" is then a single indexed query.
 *   - entityType/entityId/project are a link back to what the notification is
 *     about, so the UI can navigate there.
 *   - TTL index: MongoDB's background job deletes READ notifications 90 days
 *     after readAt. The partial filter keeps unread ones forever.
 *
 * INTERVIEW NOTES
 *   Q: How does a TTL index work?
 *   A: `expireAfterSeconds` on a Date field: about once a minute, MongoDB deletes
 *      documents whose date plus that many seconds is in the past. No cron job needed.
 */
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
