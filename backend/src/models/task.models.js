import mongoose, { Schema } from "mongoose";
import {
    AvailableIssueTypes, IssueTypeEnum,
    AvailableTaskStatuses, TaskStatusEnum,
    AvailablePriorities, PriorityEnum,
    AvailableIssueLinkTypes,
    AvailableResolutions, ResolutionEnum,
    StatusCategoryEnum
} from "../utils/constants.js";
import { deriveStatusCategory } from "../utils/helpers.js";

// ─── State Transition Log ────────────────────
const stateTransitionSchema = new Schema({
    from: String,
    to: String,
    changedBy: { type: Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, default: Date.now },
    comment: String
}, { _id: false });

// ─── Time Log Entry ──────────────────────────
const timeLogSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    minutes: { type: Number, required: true },
    description: String,
    loggedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// ─── Issue Link ──────────────────────────────
const issueLinkSchema = new Schema({
    type: {
        type: String,
        enum: AvailableIssueLinkTypes,
        required: true
    },
    issue: {
        type: Schema.Types.ObjectId,
        ref: "Task",
        required: true
    }
}, { _id: false });

// ─── Attachment ──────────────────────────────
const attachmentSchema = new Schema({
    url: String,
    public_id: String,
    filename: String,
    mimeType: String,
    size: Number,
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now }
});

// ═══════════════════════════════════════════════
//  MAIN TASK / ISSUE SCHEMA
// ═══════════════════════════════════════════════
const taskSchema = new Schema({
    // ─── Identity ────────────────────────────
    // Human-readable identifier, e.g. "PAY-14".
    //
    // NOT globally unique: it is derived from the project key, and project keys
    // are only unique per workspace ({workspace, key}). Two workspaces may each
    // own a project keyed "PAY", and both would generate "PAY-1". A global
    // unique index therefore rejected the second workspace's very first task
    // with a 409. Uniqueness is guaranteed per project by the
    // {project, issueNumber} index below; this one only serves lookups.
    issueKey: {
        type: String,
        index: true
    },
    issueNumber: { type: Number },

    // ─── Core Fields ─────────────────────────
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    descriptionHtml: { type: String },

    // ─── Classification ──────────────────────
    issueType: {
        type: String,
        enum: AvailableIssueTypes,
        default: IssueTypeEnum.TASK
    },
    priority: {
        type: String,
        enum: AvailablePriorities,
        default: PriorityEnum.MEDIUM
    },
    labels: [{ type: String, trim: true }],

    // ─── Status ──────────────────────────────
    status: {
        type: String,
        enum: AvailableTaskStatuses,
        default: TaskStatusEnum.TODO
    },
    statusCategory: {
        type: String,
        enum: Object.values(StatusCategoryEnum),
        default: StatusCategoryEnum.TODO
    },
    resolution: {
        type: String,
        enum: AvailableResolutions,
        default: ResolutionEnum.UNRESOLVED
    },

    // ─── Relationships ───────────────────────
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true
    },
    assignees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    watchers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    // ─── Hierarchy ───────────────────────────
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task"
    },
    epicLink: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task"
    },

    // ─── Dependencies (Issue Linking) ────────
    linkedIssues: [issueLinkSchema],

    // ─── Agile Fields ────────────────────────
    sprint: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Sprint"
    },
    storyPoints: {
        type: Number,
        min: 0
    },

    // ─── Dates ───────────────────────────────
    dueDate: Date,
    startDate: Date,
    completedAt: Date,

    // ─── Time Tracking ───────────────────────
    timeTracking: {
        originalEstimate: { type: Number, default: 0 },   // minutes
        timeSpent: { type: Number, default: 0 },
        timeRemaining: { type: Number, default: 0 }
    },
    timeLogs: [timeLogSchema],

    // ─── Attachments ─────────────────────────
    attachments: [attachmentSchema],

    // ─── Workflow History ────────────────────
    stateTransitions: [stateTransitionSchema],

    // ─── Environment / Context ───────────────
    environment: String,
    affectedVersion: String,
    fixVersion: String,

    // ─── Custom Fields (enterprise) ──────────
    customFields: {
        type: Map,
        of: Schema.Types.Mixed
    },

    // ─── Archive ─────────────────────────────
    isArchived: { type: Boolean, default: false },
    archivedAt: Date,

    // ─── Legacy compat: keep subtasks working during migration
    subtasks: [{
        title: { type: String, required: true, trim: true },
        status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' }
    }]
}, { timestamps: true });

// ─── Indexes (critical for performance at scale) ──
taskSchema.index({ project: 1, issueNumber: 1 }, { unique: true, sparse: true });
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ project: 1, sprint: 1 });
taskSchema.index({ project: 1, issueType: 1 });
taskSchema.index({ project: 1, priority: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ reporter: 1 });
taskSchema.index({ parent: 1 });

taskSchema.index({ epicLink: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ labels: 1 });
taskSchema.index({ sprint: 1, status: 1 });
// Text search
taskSchema.index({ title: "text", description: "text" });

// ─── Pre-save: status lifecycle ─────────────
// The single place that derives statusCategory and completedAt from status,
// so no controller can forget to keep them in sync.
taskSchema.pre("save", function (next) {
    if (this.isModified("status")) {
        this.statusCategory = deriveStatusCategory(this.status);

        // Only a genuine completion is stamped; "cancelled" is closed but not
        // completed, and reopening a task clears the stamp.
        if (this.status === TaskStatusEnum.DONE) {
            this.completedAt ??= new Date();
        } else {
            this.completedAt = undefined;
        }
    }
    next();
});

export const Task = mongoose.model("Task", taskSchema);
