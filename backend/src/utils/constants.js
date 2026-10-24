/**
 * ═══════════════════════════════════════════════
 *  PROJECT CAMP — ENTERPRISE CONSTANTS
 *  Jira / Linear / Azure DevOps aligned enums
 * ═══════════════════════════════════════════════
 *
 * FILE: backend/src/utils/constants.js
 *
 * PURPOSE
 *   The single source of truth for every fixed set of values ("enums") in the
 *   backend: roles, task statuses, priorities, sprint states, notification
 *   types, audit actions, and so on.
 *
 * THE PATTERN USED FOR EVERY ENUM
 *   export const XEnum = { KEY: "stored_value", ... };   // use in code: XEnum.KEY
 *   export const AvailableXs = Object.values(XEnum);     // array of the values
 *   - Models use the array as the Mongoose `enum: AvailableXs` validator, so
 *     the database rejects anything else.
 *   - Validators use it in `isIn(AvailableXs)`, so requests are rejected (422)
 *     before reaching a controller.
 *   - Code refers to XEnum.KEY instead of typing "in_progress", so a typo
 *     becomes an undefined property instead of a silently wrong string.
 *
 * WHO USES IT
 *   Almost everything: models/*, validators/*, utils/permissions.js,
 *   middlewares/audit.middleware.js (rejects unknown entity/action at startup),
 *   controllers, the seed script and the tests.
 *   The frontend keeps its own copies (frontend/src/lib/taskStatus.js,
 *   priority.js, issueType.js). tests/taskStatus.test.js guards the contract.
 *
 * INTERVIEW NOTES
 *   Q: Why centralise enums?
 *   A: One edit point, and the database, the validators and the code can never
 *      disagree about which values are allowed.
 */

// ─── System-Level Roles ──────────────────────
// A role on the user account itself (user.systemRole). Applies everywhere.
// super_admin is the only role that bypasses membership checks.
export const SystemRolesEnum = {
    SUPER_ADMIN: "super_admin",
    HR: "hr",
    PRODUCT_MANAGER: "product_manager",
    MEMBER: "member",
};
export const AvailableSystemRoles = Object.values(SystemRolesEnum);

// ─── Workspace-Level Roles ───────────────────
// Stored per member in workspace.members[].role. They govern the workspace
// itself (rename, members, creating projects), NOT access to its projects.
export const WorkspaceRolesEnum = {
    OWNER: "owner",
    ADMIN: "admin",
    MEMBER: "member",
    GUEST: "guest",
};
export const AvailableWorkspaceRoles = Object.values(WorkspaceRolesEnum);

// ─── Project-Level Roles ─────────────────────
// Stored per member in project.members[].role. What each one may do is
// defined in utils/permissions.js (RolePermissions), roughly from most to
// least powerful in this order.
export const ProjectRolesEnum = {
    PROJECT_MANAGER: "project_manager",
    SCRUM_MASTER: "scrum_master",
    TEAM_LEAD: "team_lead",
    DEVELOPER: "developer",
    QA: "qa",
    CLIENT: "client",
    VIEWER: "viewer",
};
export const AvailableProjectRoles = Object.values(ProjectRolesEnum);

// ─── Issue Types ─────────────────────────────
export const IssueTypeEnum = {
    EPIC: "epic",
    STORY: "story",
    TASK: "task",
    BUG: "bug",
    SUBTASK: "subtask",
    IMPROVEMENT: "improvement",
};
export const AvailableIssueTypes = Object.values(IssueTypeEnum);

// ─── Task / Issue Status ─────────────────────
// The workflow a task moves through. Each status maps to one of three
// broader categories (below), which the board and the charts use.
export const TaskStatusEnum = {
    BACKLOG: "backlog",
    TODO: "todo",
    IN_PROGRESS: "in_progress",
    IN_REVIEW: "in_review",
    QA_TESTING: "qa_testing",
    DONE: "done",
    CANCELLED: "cancelled",
};
export const AvailableTaskStatuses = Object.values(TaskStatusEnum);

// Status categories for board column grouping
export const StatusCategoryEnum = {
    TODO: "todo",
    IN_PROGRESS: "in_progress",
    DONE: "done",
};

// ─── Priority Levels ─────────────────────────
export const PriorityEnum = {
    CRITICAL: "critical",
    HIGH: "high",
    MEDIUM: "medium",
    LOW: "low",
    NONE: "none",
};
export const AvailablePriorities = Object.values(PriorityEnum);

// ─── Sprint Status ───────────────────────────
// planned → active (POST .../start) → completed (POST .../complete).
// A partial unique index allows only ONE active sprint per project.
export const SprintStatusEnum = {
    PLANNED: "planned",
    ACTIVE: "active",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
};
export const AvailableSprintStatuses = Object.values(SprintStatusEnum);

// ─── Issue Link Types ────────────────────────
export const IssueLinkTypeEnum = {
    BLOCKS: "blocks",
    BLOCKED_BY: "blocked_by",
    DUPLICATES: "duplicates",
    DUPLICATED_BY: "duplicated_by",
    RELATES_TO: "relates_to",
    DEPENDS_ON: "depends_on",
    DEPENDED_BY: "depended_by",
};
export const AvailableIssueLinkTypes = Object.values(IssueLinkTypeEnum);

// ─── Resolution Types ────────────────────────
export const ResolutionEnum = {
    UNRESOLVED: "unresolved",
    FIXED: "fixed",
    WONT_FIX: "wont_fix",
    DUPLICATE: "duplicate",
    CANNOT_REPRODUCE: "cannot_reproduce",
    DONE: "done",
};
export const AvailableResolutions = Object.values(ResolutionEnum);

// ─── Notification Types ──────────────────────
// Kinds of in-app notification (models/notification.models.js). Some are
// reserved for features not built yet (e.g. approvals); only a subset is
// emitted today by services/notification.service.js.
export const NotificationTypeEnum = {
    TASK_ASSIGNED: "task_assigned",
    TASK_STATUS_CHANGED: "task_status_changed",
    TASK_MENTIONED: "task_mentioned",
    TASK_DUE_SOON: "task_due_soon",
    COMMENT_ADDED: "comment_added",
    COMMENT_MENTIONED: "comment_mentioned",
    SPRINT_STARTED: "sprint_started",
    SPRINT_ENDING: "sprint_ending",
    SPRINT_COMPLETED: "sprint_completed",
    MEMBER_INVITED: "member_invited",
    MEMBER_REMOVED: "member_removed",
    APPROVAL_REQUESTED: "approval_requested",
    APPROVAL_GRANTED: "approval_granted",
    APPROVAL_REJECTED: "approval_rejected",
    PROJECT_ARCHIVED: "project_archived",
    PROJECT_DELETED: "project_deleted",
    DUE_DATE_APPROACHING: "due_date_approaching",
};
export const AvailableNotificationTypes = Object.values(NotificationTypeEnum);

// ─── Audit Actions ───────────────────────────
// The verbs and nouns of the audit trail: audit(entity, action) in routes.
// audit.middleware.js throws at STARTUP if a route uses a value not listed
// here, so a typo is caught before the server ever serves a request.
export const AuditActionEnum = {
    CREATED: "created",
    UPDATED: "updated",
    DELETED: "deleted",
    ARCHIVED: "archived",
    STATUS_CHANGED: "status_changed",
    ASSIGNED: "assigned",
    UNASSIGNED: "unassigned",
    MEMBER_INVITED: "member_invited",
    MEMBER_ADDED: "member_added",
    MEMBER_REMOVED: "member_removed",
    ROLE_CHANGED: "role_changed",
    SPRINT_STARTED: "sprint_started",
    SPRINT_COMPLETED: "sprint_completed",
    COMMENT_ADDED: "comment_added",
    ATTACHMENT_ADDED: "attachment_added",
    LOGGED_IN: "logged_in",
    LOGGED_OUT: "logged_out",
    PERMISSION_CHANGED: "permission_changed",
    APPROVAL_REQUESTED: "approval_requested",
    APPROVAL_GRANTED: "approval_granted",
    APPROVAL_REJECTED: "approval_rejected",
};
export const AvailableAuditActions = Object.values(AuditActionEnum);

// ─── Entity Types ────────────────────────────
export const EntityTypeEnum = {
    USER: "user",
    WORKSPACE: "workspace",
    PROJECT: "project",
    TASK: "task",
    SPRINT: "sprint",
    COMMENT: "comment",
    NOTE: "note",
    MEMBER: "member",
    LABEL: "label",
    APPROVAL: "approval",
};
export const AvailableEntityTypes = Object.values(EntityTypeEnum);

// ─── Project Methodology ─────────────────────
export const MethodologyEnum = {
    KANBAN: "kanban",
    SCRUM: "scrum",
    WATERFALL: "waterfall",
};
export const AvailableMethodologies = Object.values(MethodologyEnum);

// ─── Project Visibility ──────────────────────
export const VisibilityEnum = {
    PRIVATE: "private",
    WORKSPACE: "workspace",
    PUBLIC: "public",
};
export const AvailableVisibilities = Object.values(VisibilityEnum);

// ─── Project Status ──────────────────────────
export const ProjectStatusEnum = {
    ACTIVE: "active",
    ON_HOLD: "on_hold",
    COMPLETED: "completed",
    ARCHIVED: "archived",
};
export const AvailableProjectStatuses = Object.values(ProjectStatusEnum);

// ─── Fibonacci Story Points ──────────────────
// Agile estimation scale: the growing gaps reflect growing uncertainty.
export const FIBONACCI_POINTS = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

// ─── Default Board Columns ───────────────────
// Copied into every new project (project.boardColumns). `category` ties a
// column to StatusCategoryEnum; `order` is its left-to-right position.
export const DEFAULT_BOARD_COLUMNS = [
    { name: "Backlog", category: "todo", color: "#6B7280", order: 0 },
    { name: "To Do", category: "todo", color: "#3B82F6", order: 1 },
    { name: "In Progress", category: "in_progress", color: "#F59E0B", order: 2 },
    { name: "In Review", category: "in_progress", color: "#8B5CF6", order: 3 },
    { name: "QA Testing", category: "in_progress", color: "#EC4899", order: 4 },
    { name: "Done", category: "done", color: "#10B981", order: 5 },
];

// ─── Default Issue Type Config ───────────────
export const DEFAULT_ISSUE_TYPES = [
    { name: "Epic", icon: "⚡", color: "#8B5CF6" },
    { name: "Story", icon: "📖", color: "#10B981" },
    { name: "Task", icon: "✅", color: "#3B82F6" },
    { name: "Bug", icon: "🐛", color: "#EF4444" },
    { name: "Improvement", icon: "🚀", color: "#F59E0B" },
    { name: "Subtask", icon: "📋", color: "#6B7280" },
];

// ─── Default Priority Config ─────────────────
export const DEFAULT_PRIORITIES = [
    { name: "Critical", icon: "🔴", color: "#DC2626" },
    { name: "High", icon: "🟠", color: "#EA580C" },
    { name: "Medium", icon: "🟡", color: "#CA8A04" },
    { name: "Low", icon: "🟢", color: "#16A34A" },
    { name: "None", icon: "⚪", color: "#6B7280" },
];

// ─── Legacy compat (keep existing imports working) ──
// Older code called system roles "user roles". These are aliases, not new enums.
export const UserRolesEnum = SystemRolesEnum;
export const AvailableUserRole = AvailableSystemRoles;