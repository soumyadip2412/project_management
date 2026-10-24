import mongoose, { Schema } from "mongoose";
import {
    AvailableProjectRoles, ProjectRolesEnum,
    AvailableProjectStatuses, ProjectStatusEnum,
    AvailableMethodologies, MethodologyEnum,
    AvailableVisibilities, VisibilityEnum,
    AvailableTaskStatuses,
    DEFAULT_BOARD_COLUMNS, DEFAULT_ISSUE_TYPES, DEFAULT_PRIORITIES
} from "../utils/constants.js";

/**
 * FILE: backend/src/models/project.models.js
 *
 * PURPOSE
 *   A Project lives inside a Workspace and is the main unit of access control:
 *   the project's members[] (with project roles) decide who can see and do
 *   what with its sprints, tasks, comments and notes.
 *
 * NOTABLE FIELDS
 *   key            short uppercase code ("WEB") used in issue keys like WEB-12.
 *                  Unique per workspace ({workspace, key} index).
 *   taskSequence   counter behind those issue numbers (see getNextIssueNumber).
 *   members[]      { user, role, joinedAt }: who can access the project.
 *   invitations[]  pending invites: the user must accept before joining members[].
 *   settings       per-project issue types, priorities and board columns
 *                  (statuses), defaulted from constants.js.
 *   methodology    kanban | scrum | waterfall (the UI shows sprints for scrum).
 *
 * WHO USES IT
 *   middlewares/authorize.middleware.js loads it once per request
 *   (req.project); project/task/sprint controllers; the dashboard and search.
 *
 * INTERVIEW NOTES
 *   Q: How do you generate sequential issue numbers safely under concurrency?
 *   A: An atomic `$inc` on project.taskSequence with findByIdAndUpdate
 *      (new: true). MongoDB applies $inc atomically on a single document, so two
 *      simultaneous task creations always get different numbers. A unique
 *      index on {project, issueNumber} in Task is the backstop.
 *   Q: Why embed members instead of a ProjectMember collection?
 *   A: Authorization needs the project AND its members on every request; one
 *      document read gets both. Teams per project are small.
 */
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
    // An invite is NOT membership: the invited user gains no access until
    // they accept, which moves the entry into members[].
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
        enableApprovals: { type: Boolean, default: false },
        // Work-in-progress limit per board column (0 = no limit). One key per
        // canonical status, so every response carries the full set.
        wipLimits: Object.fromEntries(
            AvailableTaskStatuses.map((status) => [status, { type: Number, min: 0, max: 99, default: 0 }])
        ),
    },

    tags: [String],
    isArchived: { type: Boolean, default: false },
    archivedAt: Date
}, { timestamps: true });

// ─── Indexes ─────────────────────────────────
// Each index matches a real query: project keys unique within a workspace;
// list projects of a workspace by status; "projects I am a member of"; etc.
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
 * It reads the counter back from the database (not from `this`), so it is
 * correct even if `this` is a stale in-memory copy.
 * mongoose.model("Project") is looked up lazily because the model variable is
 * defined further down this file.
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
