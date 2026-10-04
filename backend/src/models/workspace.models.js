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
workspaceSchema.index({ "members.user": 1 });
workspaceSchema.index({ owner: 1, slug: 1 }, { unique: true });


const Workspace = mongoose.model("Workspace", workspaceSchema);

export default Workspace;
