/**
 * FILE: backend/src/models/auditLog.models.js
 *
 * PURPOSE
 *   An append-only record of WHO did WHAT to WHICH entity, WHEN, and from
 *   where: { actor, action, entityType, entityId, project, workspace, changes[],
 *   ipAddress, userAgent, createdAt }.
 *
 * HOW ENTRIES ARE CREATED
 *   Only by middlewares/audit.middleware.js (the `audit(entity, action)` step in
 *   the route pipeline), after a successful response. `changes` comes from
 *   trackChanges() in controllers (field, oldValue, newValue).
 *
 * KEY CONCEPTS
 *   - entityType/action are enum-restricted (constants.js), and the middleware
 *     validates them at startup.
 *   - Audit logs are NOT deleted with their project, so history survives
 *     deletion. They expire after 365 days through the TTL index on createdAt.
 *   - Read by the dashboard's "recent activity" feed and the project activity views.
 *
 * INTERVIEW NOTES
 *   Q: What is an audit log for?
 *   A: Accountability and debugging ("who moved this task to done?"), plus
 *      security forensics. It is also a common compliance requirement.
 */
import mongoose, { Schema } from "mongoose";
import { AvailableAuditActions, AvailableEntityTypes } from "../utils/constants.js";

const auditLogSchema = new Schema({
    workspace: {
        type: Schema.Types.ObjectId,
        ref: "Workspace"
    },
    project: {
        type: Schema.Types.ObjectId,
        ref: "Project"
    },
    entityType: {
        type: String,
        enum: AvailableEntityTypes,
        required: true
    },
    entityId: {
        type: Schema.Types.ObjectId,
        required: true
    },
    action: {
        type: String,
        enum: AvailableAuditActions,
        required: true
    },
    actor: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    changes: [{
        field: String,
        oldValue: Schema.Types.Mixed,
        newValue: Schema.Types.Mixed
    }],
    metadata: {
        type: Map,
        of: Schema.Types.Mixed
    },
    ipAddress: String,
    userAgent: String
}, { timestamps: true });

// ─── Indexes ─────────────────────────────────
auditLogSchema.index({ workspace: 1, createdAt: -1 });
auditLogSchema.index({ project: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
// TTL index: auto-delete after 1 year for non-enterprise
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
