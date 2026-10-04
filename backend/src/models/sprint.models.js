import mongoose, { Schema } from "mongoose";
import { AvailableSprintStatuses, SprintStatusEnum } from "../utils/constants.js";

const sprintSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    project: {
        type: Schema.Types.ObjectId,
        ref: "Project",
        required: true
    },
    goal: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
        type: String,
        enum: AvailableSprintStatuses,
        default: SprintStatusEnum.PLANNED
    },
    completedAt: Date,
    // Velocity = total story points completed when sprint ends
    velocity: { type: Number, default: 0 },
    // Snapshot of daily remaining points for burndown chart
    burndownData: [{
        date: Date,
        totalPoints: Number,
        completedPoints: Number,
        remainingPoints: Number,
        addedPoints: Number     // scope creep tracking
    }],
    // Summary stats computed at sprint completion
    summary: {
        totalIssues: { type: Number, default: 0 },
        completedIssues: { type: Number, default: 0 },
        incompleteIssues: { type: Number, default: 0 },
        totalStoryPoints: { type: Number, default: 0 },
        completedStoryPoints: { type: Number, default: 0 },
        addedDuringSprint: { type: Number, default: 0 }
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    order: { type: Number, default: 0 }
}, { timestamps: true });

sprintSchema.index({ project: 1, status: 1 });
// Invariant: at most ONE active sprint per project. A partial index only
// contains documents matching the filter, so uniqueness applies to active
// sprints alone; any number of planned/completed sprints can coexist.
sprintSchema.index(
    { project: 1 },
    { unique: true, partialFilterExpression: { status: SprintStatusEnum.ACTIVE }, name: "one_active_sprint_per_project" }
);
sprintSchema.index({ project: 1, order: 1 });

export const Sprint = mongoose.model("Sprint", sprintSchema);
