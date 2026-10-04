import mongoose, { Schema } from "mongoose";
import {
    AvailableProjectRoles, ProjectRolesEnum,
    AvailableProjectStatuses, ProjectStatusEnum,
    AvailableMethodologies, MethodologyEnum,
    AvailableVisibilities, VisibilityEnum,
    DEFAULT_BOARD_COLUMNS, DEFAULT_ISSUE_TYPES, DEFAULT_PRIORITIES
} from "../utils/constants.js";

const projectSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ""
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // ─── Enterprise Extensions ───────────────
    workspace: {
        type: Schema.Types.ObjectId,
        ref: "Workspace",
        required: true
    },
    key: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    category: {
        type: String,
        enum: ["software", "business", "marketing", "operations", "hr", "other"],
        default: "software"
    },
    methodology: {
        type: String,
        enum: AvailableMethodologies,
        default: MethodologyEnum.KANBAN
    },
    status: {
        type: String,
        enum: AvailableProjectStatuses,
        default: ProjectStatusEnum.ACTIVE
    },
    visibility: {
        type: String,
        enum: AvailableVisibilities,
        default: VisibilityEnum.PRIVATE
    },
    lead: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },

    // Dates
    startDate: Date,
    targetEndDate: Date,
    actualEndDate: Date,

    // Auto-increment counter for issue keys (PROJ-1, PROJ-2...)
    taskSequence: { type: Number, default: 0 },

    // ─── Extended Members ────────────────────
    members: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        role: {
            type: String,
            enum: AvailableProjectRoles,
            default: ProjectRolesEnum.DEVELOPER
        },
        joinedAt: { type: Date, default: Date.now }
    }],
    
    // ─── Pending Invitations ─────────────────
    invitations: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        role: {
            type: String,
            enum: AvailableProjectRoles
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        invitedAt: { type: Date, default: Date.now }
    }],

    // ─── Configurable Workflows ──────────────
    settings: {
        issueTypes: {
            type: [{
                name: String,
                icon: String,
                color: String
            }],
            default: DEFAULT_ISSUE_TYPES
        },
        priorities: {
            type: [{
                name: String,
                icon: String,
                color: String
            }],
            default: DEFAULT_PRIORITIES
        },
        statuses: {
            type: [{
                name: String,
                category: {
                    type: String,
                    enum: ["todo", "in_progress", "done"]
                },
                color: String,
                order: Number
            }],
            default: DEFAULT_BOARD_COLUMNS
        },
        defaultAssignee: {
            type: String,
            enum: ["project_lead", "unassigned"],
            default: "unassigned"
        },
        enableApprovals: { type: Boolean, default: false }
    },

    tags: [String],
    isArchived: { type: Boolean, default: false },
    archivedAt: Date
}, { timestamps: true });

// ─── Indexes ─────────────────────────────────
projectSchema.index({ workspace: 1, key: 1 }, { unique: true });
projectSchema.index({ workspace: 1, status: 1 });
projectSchema.index({ "members.user": 1 });
projectSchema.index({ owner: 1 });
projectSchema.index({ lead: 1 });
projectSchema.index({ isArchived: 1 });

// ─── Methods ─────────────────────────────────
/**
 * Atomically increment and return next issue number for this project.
 * Produces keys like PROJ-1, PROJ-2, etc.
 */
projectSchema.methods.getNextIssueNumber = async function () {
    const updated = await mongoose.model("Project").findByIdAndUpdate(
        this._id,
        { $inc: { taskSequence: 1 } },
        { new: true }
    );
    return updated.taskSequence;
};

const Project = mongoose.model("Project", projectSchema);

export default Project;
