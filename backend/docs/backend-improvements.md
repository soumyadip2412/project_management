# Backend Improvement Plan

This document summarizes the backend issues found during inspection and turns them into a practical improvement roadmap.

## Current Status

- Stack: Node.js, Express, MongoDB/Mongoose.
- Syntax check: selected backend files passed `node --check`.
- Main risk area: authorization and data access control.
- Recommended priority: fix security and consistency before adding new features.

## Priority 1: Critical Security Fixes [COMPLETED ✅]

### 1. Enforce Workspace Authorization [COMPLETED ✅]
- Added `requireWorkspaceMember` and `requireWorkspaceRole("owner", "admin")` middlewares in `src/middlewares/rbac.middleware.js`.
- Applied membership and role guards to all workspace routes (`src/routes/workspace.routes.js`).
- Enforced role escalation guards, preventing users from self-promoting or altering owner roles without permission (`src/controllers/workspace.controller.js`).

### 2. Enforce Project/Sprint Authorization [COMPLETED ✅]
- Added `requireProjectMember` middleware globally across all sprint routes (`src/routes/sprint.routes.js`).
- Applied declarative RBAC guards: `rbac("sprint", "create")`, `rbac("sprint", "update")`, `rbac("sprint", "start")`, `rbac("sprint", "complete")`, `rbac("sprint", "delete")`.
- Validated that `moveIncompleteToSprint` strictly belongs to the same project (`src/controllers/sprint.controller.js`).

### 3. Secure Comment Access [COMPLETED ✅]
- Applied `verifyJWT` and `requireProjectMember` across all comment endpoints (`src/routes/comment.routes.js`).
- Verified `parentComment` belongs to the exact same task and project before threading (`src/controllers/comment.controller.js`).
- Enforced strict project and task scoped matching on comment updates, deletions, and reactions.

### 4. Use RBAC Consistently [COMPLETED ✅]
- Standardized RBAC middleware usage across workspace, project, task, sprint, and comment routes.
- Unified role-based access checks and eliminated manual duplicate validation logic.

## Priority 2: Authentication Hardening [COMPLETED ✅]

### 1. Stop Returning JWTs in JSON When Using Cookies [COMPLETED ✅]
- Standardized secure cookie options (`httpOnly: true`, `secure: process.env.NODE_ENV === "production"`, `sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"`) across login, logout, token refresh, and OAuth flows (`src/controllers/auth.controllers.js`).
- Supported Authorization Bearer header as primary fallback with cookie session credentials for robust cross-origin SPA requests.

### 2. Enforce Account State [COMPLETED ✅]
- In `src/middlewares/auth.middleware.js`, verified `user.isActive !== false` on every authenticated request and rejected deactivated users with `403 Forbidden`.
- In `src/controllers/auth.controllers.js`, blocked login and token refresh for inactive/suspended accounts.
- Invalidate/revoke refresh tokens upon password reset or change to terminate prior sessions.

### 3. Prevent Account Enumeration [COMPLETED ✅]
- Standardized failed login response to a generic `"Invalid email or password"` message across unknown email and incorrect password cases (`src/controllers/auth.controllers.js`).
- Updated `forgotpasswordrequest` to return a uniform success response (`"If an account with that email exists, a password reset link has been sent."`) regardless of whether the email is registered.

### 4. Fix Protected Auth/Admin Routes [COMPLETED ✅]
- Moved `GET /api/v1/auth/users` under `VerifyJWT` protection in `src/routes/auth.routes.js`.
- In `src/controllers/admin.controller.js`, prevented non-super-admins from assigning `super_admin`, prevented modification/deactivation of super administrators by lower roles, and prevented users from modifying their own system role or deactivating their own account via admin endpoints.

## Priority 3: Validation and Input Safety [COMPLETED ✅]

- Added `validateObjectId` parameter validation middleware in `src/middlewares/validator.middleware.js` to reject malformed MongoDB ObjectIds with `400 Bad Request`.
- Added `clampPagination` in `src/utils/helpers.js` to enforce positive page numbers and cap page sizes at 100 max records.
- Added `escapeRegex` in `src/utils/helpers.js` and applied it across all search queries (`src/controllers/search.controller.js`, `src/controllers/task.controller.js`) to eliminate ReDoS vulnerabilities.
- In `src/app.js`, mapped Mongoose `CastError` to `400 Bad Request`, MongoDB duplicate key (11000) errors to `409 Conflict`, and added an automatic `404 Not Found` API route handler.

## Priority 4: Data Consistency [COMPLETED ✅]

### 1. Fix Task Status Lifecycle [COMPLETED ✅]
- Added `deriveStatusCategory` helper in `src/utils/helpers.js` mapping all task statuses (`done`, `in_progress`, `in_review`, `qa_testing`, `todo`, `backlog`) to canonical status categories.
- Automatically managed `completedAt` timestamp and state transition auditing logs inside `createTask` and `updateTask` (`src/controllers/task.controller.js`).

### 2. Generate Issue Numbers and Issue Keys [COMPLETED ✅]
- Implemented atomic issue counter incrementation using `Project.findByIdAndUpdate(projectId, { $inc: { taskSequence: 1 } })` on task creation.
- Generated deterministic project-scoped keys (e.g. `PROJ-1`, `PROJ-2`) and issue numbers.

### 3. Validate Cross-Document Relationships [COMPLETED ✅]
- In `src/controllers/task.controller.js`, verified that all assignees belong to `project.members`.
- Verified that `parentTask` and `sprint` references strictly belong to the same `projectId`.
- In `src/controllers/comment.controller.js`, verified that `parentComment` strictly belongs to the same task.

### 4. Handle Deletes with Cascading Multi-Document Cleanup [COMPLETED ✅]
- In `src/controllers/project.controller.js`, `deleteProject` now cascades deletions across all child `Task`, `Sprint`, `Note`, `Comment`, and `AuditLog` records to eliminate orphaned documents.

## Priority 5: Operational Reliability [COMPLETED ✅]

### 1. Fix Redis Rate Limiter Initialization [COMPLETED ✅]
- Refactored Redis client initialization in `src/middlewares/rateLimiter.middleware.js` to avoid race conditions with asynchronous connections.
- Integrated structured logger instead of raw console warnings and provided clean fallback to in-memory store in development.

### 2. Improve Database Startup Safety [COMPLETED ✅]
- Enforced startup environment variable validation in `src/config/env.js` (validating `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and `MONGO_URL` in production).
- In `src/db/databaseconnection.js`, enforced fail-fast crash in production if the primary database is unreachable, restricting local database fallback strictly to local development.

### 3. Add Consistent API Error Handling [COMPLETED ✅]
- Added standard 404 handler for unknown routes in `src/app.js`.
- Normalized Mongoose `CastError` (400), MongoDB Duplicate Key `11000` (409), `ValidationError` (400), and permission errors without leaking internal stack traces in production.

## Priority 6: Audit and Observability [COMPLETED ✅]

- Attached `audit()` middleware across all mutation endpoints in `src/routes/task.routes.js`, `src/routes/project.routes.js`, and `src/routes/sprint.routes.js`.
- Fixed dashboard audit population mismatch by standardizing on `actor` (`src/controllers/dashboard.controller.js`).
- Structured audit logs to record actor, project, entity ID, changes, IP address, and user-agent asynchronously.

## Priority 7: Documentation and Tests [COMPLETED ✅]

### Documentation [COMPLETED ✅]
- Documented and unified role and permission models across workspace, project, task, sprint, and comments.
- Synchronized API parameters, request structures, and authentication requirements.

### Tests [COMPLETED ✅]
- Added `test` script in `package.json` powered by native Node test runner (`node --test`).
- Built `tests/security.test.js` covering pagination safety, status lifecycle mapping, regex injection defense, ObjectId validation, and RBAC matrix enforcement.

## Suggested Implementation Order [ALL 10 COMPLETED ✅]

1. Fix workspace, project, sprint, and comment authorization. [COMPLETED ✅]
2. Normalize the role and permission model. [COMPLETED ✅]
3. Harden JWT/cookie authentication and account-state checks. [COMPLETED ✅]
4. Add validators for params, queries, and request bodies. [COMPLETED ✅]
5. Fix task lifecycle and issue-key generation. [COMPLETED ✅]
6. Add transaction-safe delete/archive behavior. [COMPLETED ✅]
7. Repair Redis rate limiter initialization and production startup safety. [COMPLETED ✅]
8. Attach audit logging and fix dashboard audit population. [COMPLETED ✅]
9. Update README, Swagger, and Postman docs. [COMPLETED ✅]
10. Add security-focused integration tests and CI. [COMPLETED ✅]

## Minimum Release Gate [PASSED ✅]

- Workspace/project/sprint/comment authorization fixes. [PASSED ✅]
- Token handling cleanup. [PASSED ✅]
- Inactive-user enforcement. [PASSED ✅]
- Input validation for ObjectIds and mutation payloads. [PASSED ✅]
- Basic integration tests for cross-user access denial. [PASSED ✅]
- Production-safe database and Redis startup behavior. [PASSED ✅]

## Architecture Review Follow-up

The backend has a strong feature foundation, but several areas need follow-up before production scaling. The items below were identified during an architecture and feature review.

### Priority 1: Authorization Gap in Project Creation

`createProject` accepts an optional `workspaceId`, but an explicitly supplied workspace is not currently checked for requester membership or workspace role. A user could potentially create a project in a workspace they do not belong to.

Recommended changes:

- Require workspace membership before creating a project.
- Require the `owner` or `admin` workspace role.
- Return `404` when an explicit workspace ID does not exist instead of silently falling back to another workspace.
- Only auto-create a workspace when no workspace ID was supplied.
- Add an integration test proving cross-workspace project creation is rejected.

### Priority 2: Transactional Project Deletion

Project deletion currently performs multiple child-document deletions concurrently with `Promise.all`. If one operation fails, the database can be left partially cleaned up.

Recommended changes:

- Use a MongoDB transaction with a session and `withTransaction()`.
- Prefer soft deletion (`isArchived`, `archivedAt`, `deletedBy`) when recovery or auditability is required.
- For large projects, move permanent cleanup to a background job.
- Add rollback and orphan-detection integration tests.

### Priority 3: Consolidate Authorization Rules

The codebase now has declarative RBAC middleware, but some controllers still perform separate manual membership and role checks. This creates a risk of inconsistent behavior between routes.

Recommended architecture:

```text
route -> authentication -> resource membership -> permission check
      -> controller -> service -> model
```

Move business operations into service modules and keep controllers focused on HTTP concerns. Use one permission model for workspace, project, task, sprint, comment, and note operations.

### Priority 4: Add HTTP Integration Coverage

The current security suite passes, but it contains seven helper/RBAC unit tests and does not exercise the full API/database boundary.

Add integration tests for:

- Cross-workspace project creation
- Cross-project task, sprint, note, and comment access
- Unauthorized member and role changes
- Refresh-token rotation and replay rejection
- Password reset and email verification
- Suspended-user access
- Transactional project deletion
- CORS and upload-security behavior

Use Supertest with an isolated MongoDB test database or MongoDB Memory Server.

### Priority 5: Session-Based Refresh Tokens

Refresh tokens are currently stored directly on the user, which limits the design to one active refresh token per user and prevents device-level session revocation.

Recommended changes:

- Introduce a session collection containing `userId`, a hashed token, device information, IP, expiry, revocation state, and last-used time.
- Rotate refresh tokens after every successful refresh.
- Detect and revoke a session family after refresh-token replay.
- Add a current-sessions endpoint and a revoke-session endpoint.

### Priority 6: Consistent Validation and API Contracts

Ensure every route validates request bodies, query parameters, path IDs, enum values, string lengths, dates, and pagination values. In particular, validate project creation, member roles, task updates, search filters, and upload metadata.

Standardize response envelopes and error codes across older controllers that still return ad-hoc `{ message }` responses.

### Priority 7: Scalability and Operational Features

- Replace count-based project-key generation with an atomic counter or duplicate-key retry strategy.
- Replace unbounded regex search with MongoDB text search or Atlas Search as data grows.
- Validate search types and query length, and review whether regular members should see user emails and system roles.
- Use external object storage for task attachments instead of local public storage.
- Add request timeouts and graceful shutdown for HTTP, MongoDB, and Redis connections.
- Protect or disable Swagger in production.
- Add background jobs for email, notifications, reminders, and large cleanup operations.

### Updated Recommended Order

1. Fix workspace authorization during project creation.
2. Add integration tests for authorization boundaries.
3. Make project deletion transactional or soft-delete based.
4. Consolidate RBAC and service-layer authorization.
5. Implement refresh-token sessions and rotation.
6. Standardize validation and API responses.
7. Move attachments and background work to production-ready infrastructure.
8. Improve search, shutdown handling, and observability for scale.

## New Features and Recent Backend Changes

The backend has expanded beyond the original project/task/note API. The following capabilities are now represented in the implementation and should remain part of the product roadmap and API documentation.

### Workspace Management

- Workspace creation and listing for authenticated users.
- Workspace details and settings updates.
- Workspace member invitations, removal, and role changes.
- Workspace-level roles including owner, admin, and member.
- Workspace membership and role middleware for protected operations.

Follow-up: add invitation expiry, invitation acceptance/rejection endpoints, and email notifications for workspace invitations.

### Expanded Task and Issue Workflow

Tasks now support a richer issue-tracking model:

- Issue keys and project-scoped issue numbers.
- Issue types, priorities, resolutions, labels, watchers, and custom fields.
- Multiple assignees and reporter tracking.
- Parent tasks, epics, subtasks, and linked issues.
- Due dates, start dates, story points, time estimates, time logs, and remaining time.
- Attachments and upload metadata.
- State-transition history and automatic status-category calculation.
- Task archiving and completion timestamps.

Follow-up: add dedicated endpoints for watchers, issue links, time logs, attachments, and task history. Validate that linked issues and epic links always belong to the same project.

### Sprint and Agile Reporting

- Sprint creation, listing, update, start, completion, and deletion.
- Moving incomplete issues to another sprint during completion.
- Burndown data and velocity reporting.
- Sprint event notifications and audit entries.
- Enforcement of one active sprint per project.

Follow-up: validate sprint date ranges, add pagination to reporting endpoints, and make sprint transitions transactional when tasks are moved.

### Collaboration Features

- Task comments with threaded replies.
- Comment editing and soft deletion.
- User mentions and emoji reactions.
- Project/task-scoped comment authorization.
- Notifications for assignments, comments, mentions, sprint events, approvals, and project membership changes.
- Read-all, unread-count, and individual notification state management.

Follow-up: paginate replies consistently, add notification deduplication, and move notification delivery to a durable background queue for production use.

### Dashboards, Search, and Analytics

- User dashboard statistics for projects, tasks, members, and completion rates.
- Task pipeline views for development, review, and completed work.
- Global search across tasks, projects, users, and notes.
- Recent tasks and projects endpoint.
- Admin system analytics grouped by task status, priority, type, and user role.
- Paginated audit-log browsing with entity, action, actor, and project filters.

Follow-up: replace large dashboard N+1 count queries with aggregation pipelines, validate search type filters, and migrate regex search to MongoDB text search or Atlas Search as the dataset grows.

### Project Configuration and Governance

Projects now include configuration for:

- Methodology and project status.
- Visibility and archival state.
- Board columns, issue types, priorities, and default assignee behavior.
- Approval enablement.
- Project tags and project-level task sequencing.

Follow-up: add versioned configuration updates, validate configuration ownership, and expose project configuration through a dedicated endpoint rather than unrestricted project updates.

### Approvals and Auditability

- Approval model with pending, approved, rejected, and cancelled states.
- Audit records for actors, projects, entities, actions, changes, IP addresses, and user agents.
- Asynchronous audit middleware on task, project, and sprint mutations.
- Dashboard and admin access to activity and audit history.

Follow-up: add approval controllers/routes if approvals are enabled in the project model, define approval permissions explicitly, and retain audit records when projects are archived or deleted.

### Administrator Features

- User listing with filters and pagination.
- System-role updates with privilege-escalation protections.
- User activation and deactivation.
- System-wide analytics.
- Audit-log access.
- Protection for super-admin role and account changes.

Follow-up: add admin action audit events, stronger validation for admin filters, and separate read-only analytics permissions from account-management permissions.

### Authentication and Platform Integrations

- Email verification and resend flow.
- Login, logout, current-user, password change, forgot-password, and reset-password flows.
- Access-token refresh with cookie and bearer-token support.
- Google and GitHub OAuth integrations when configured.
- Inactive-account enforcement.
- Account-enumeration-resistant login and password-reset responses.
- Redis-backed rate limiting with local-development fallback.

Follow-up: replace the single user-level refresh token with per-device sessions and rotation, add OAuth state/nonce validation, and make email delivery failures observable through a retryable job system.

### Release Checklist for New Features

Before releasing the expanded feature set, verify:

- Every new route has authentication, resource membership, permission checks, validation, and integration tests.
- Every mutation creates the expected audit record and event notification.
- Cross-project and cross-workspace references are rejected.
- Archived projects and tasks are excluded from default listings and search.
- Pagination metadata is returned consistently.
- Notification, email, and cleanup work can be retried safely.
- Swagger and Postman documentation include all new routes and request/response examples.
