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
