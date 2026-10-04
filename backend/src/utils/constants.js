/**
 * ═══════════════════════════════════════════════
 *  PROJECT CAMP — ENTERPRISE CONSTANTS
 *  Jira / Linear / Azure DevOps aligned enums
 * ═══════════════════════════════════════════════
 */

// ─── System-Level Roles ──────────────────────
export const SystemRolesEnum = {
    SUPER_ADMIN: "super_admin",
    HR: "hr",
    PRODUCT_MANAGER: "product_manager",
    MEMBER: "member",
};
export const AvailableSystemRoles = Object.values(SystemRolesEnum);

// ─── Workspace-Level Roles ───────────────────
export const WorkspaceRolesEnum = {
    OWNER: "owner",
    ADMIN: "admin",
    MEMBER: "member",
    GUEST: "guest",
};
export const AvailableWorkspaceRoles = Object.values(WorkspaceRolesEnum);

// ─── Project-Level Roles ─────────────────────
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
export const FIBONACCI_POINTS = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

// ─── Default Board Columns ───────────────────
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
export const UserRolesEnum = SystemRolesEnum;
export const AvailableUserRole = AvailableSystemRoles;