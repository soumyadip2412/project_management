/**
 * FILE: backend/src/models/sprint.models.js
 *
 * PURPOSE
 *   A Sprint is a time-boxed iteration (Scrum) inside a project. Tasks point at
 *   a sprint through task.sprint. Lifecycle:
 *     planned ──POST /start──▶ active ──POST /complete──▶ completed
 *   On completion, sprint.controller.js stores `velocity` and `summary`, and
 *   unfinished tasks are moved out of the sprint.
 *
 * KEY CONCEPTS
 *   - Partial unique index (below): the database itself guarantees at most one
 *     active sprint per project, even if two "start sprint" requests race.
 *     The loser gets error 11000, which app.js maps to 409 Conflict.
 *   - velocity = story points completed in the sprint, used for planning.
 *   - burndownData: daily snapshots of remaining points (the frontend can also
 *     derive a burndown from tasks; see frontend/src/lib/burndown.js).
 *
 * INTERVIEW NOTES
 *   Q: Why enforce "one active sprint" with an index instead of in code?
 *   A: A check-then-write in code has a race window (two requests both see
 *      "no active sprint", then both start one). A unique index is atomic.
 */
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
