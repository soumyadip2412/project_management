/**
 * FILE: backend/src/models/workspace.models.js
 *
 * PURPOSE
 *   A Workspace is the top-level container (like a company or team in
 *   Jira/Slack). It owns projects and has its own member list with
 *   workspace roles (owner | admin | member | guest).
 *
 * DOMAIN HIERARCHY
 *   Workspace ─┬─ Project ─┬─ Sprint
 *              │           ├─ Task ── Comment
 *              │           └─ Note
 *              └─ members[] (workspace roles)
 *
 * KEY CONCEPTS
 *   - Embedded array (members[]) instead of a separate collection: a
 *     workspace's member list is small and always read together with the
 *     workspace, so one document read answers "is X a member, and with what role?".
 *   - The multikey index on "members.user" makes "all workspaces I belong to"
 *     fast: Workspace.find({ "members.user": me }).
 *   - Workspace roles do NOT grant access inside projects (see utils/permissions.js).
 *
 * INTERVIEW NOTES
 *   Q: Why is the slug unique per owner rather than globally?
 *   A: With a global unique slug, one user's "marketing" workspace would block
 *      every other user from using the same name.
 */
import mongoose, { Schema } from "mongoose";
import { AvailableWorkspaceRoles, WorkspaceRolesEnum } from "../utils/constants.js";

const workspaceSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Unique per owner (see the {owner, slug} index), not globally: a global
    // unique slug let one user's "Marketing" block every other user's.
    slug: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    logo: {
        url: String,
        localPath: String
    },
    // Feature flags and limits. Mostly forward-looking configuration;
    // most of these are stored but not yet enforced by controllers.
    settings: {
        defaultProjectPrefix: { type: String, default: "PROJ" },
        allowMemberInvites: { type: Boolean, default: false },
        requireEmailDomain: { type: String },
        maxProjects: { type: Number, default: 100 },
        features: {
            sprints: { type: Boolean, default: true },
            timeTracking: { type: Boolean, default: false },
            customFields: { type: Boolean, default: false },
            automations: { type: Boolean, default: false },
            approvalWorkflows: { type: Boolean, default: true }
        }
    },
    // Each element is a sub-document { user, role, joinedAt, invitedBy }.
    // `ref: "User"` lets .populate("members.user") swap the id for the User document.
    members: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        role: {
            type: String,
            enum: AvailableWorkspaceRoles,
            default: WorkspaceRolesEnum.MEMBER
        },
        joinedAt: { type: Date, default: Date.now },
        invitedBy: { type: Schema.Types.ObjectId, ref: "User" }
    }],
    plan: {
        type: String,
        enum: ["free", "pro", "enterprise"],
        default: "free"
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// ─── Indexes ─────────────────────────────────
// Multikey index: one entry per element of the members array.
workspaceSchema.index({ "members.user": 1 });
// Compound unique index: the same slug may exist for different owners, but
// not twice for the same owner. A violation surfaces as error 11000 → 409.
workspaceSchema.index({ owner: 1, slug: 1 }, { unique: true });


const Workspace = mongoose.model("Workspace", workspaceSchema);

export default Workspace;
