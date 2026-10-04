# ProjectCamp — API

REST API for a project-management application: workspaces, projects, tasks, comments and sprints, with a three-tier role-based permission system enforced on every protected route.

Node.js · Express 5 · MongoDB/Mongoose · ESM throughout, no build step.

> This is the `backend` submodule of the [ProjectCamp superproject](https://github.com/Bobin2004/project-management). Product overview, screenshots and the architecture write-up live in the root README.

## Quick start

```bash
npm install
cp .env.sample .env     # fill in the values below
npm run dev             # nodemon on $PORT
```

Minimum `.env` to boot:

```ini
MONGO_URL=mongodb://127.0.0.1:27017/projmanage
PORT=8000
CORS_ORIGIN=http://localhost:5173
ACCESS_TOKEN_SECRET=<random string>
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=<different random string>
REFRESH_TOKEN_EXPIRY=10d
```

`src/config/env.js` runs at import time and exits the process if the token secrets are missing (and `MONGO_URL` in production). Set `PORT=8000` explicitly — the frontend defaults to `http://localhost:8000/api/v1`, while `src/index.js` falls back to `3000`.

SMTP (`MAIL_TRAP_*`) and OAuth (`GOOGLE_*`, `GITHUB_*`) variables are optional. Without SMTP, registration still succeeds — the verification email is skipped and the failure logged. `REDIS_URL` is optional too; without it the rate limiter uses an in-memory store.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | nodemon on `src/index.js` |
| `npm start` | plain node |
| `npm test` | unit tests (`node:test`) |
| `npm run check:syntax` | parses every file under `src/` and `tests/` — what CI gates on |
| `npm run e2e:server` | runs the real app against an ephemeral in-memory MongoDB, for the frontend's Playwright suite |
| `npm run seed -- --force` | **destructive** — wipes users, workspaces and projects, then reseeds |
| `npm run format:check` | `prettier --check`; currently fails on most files and is deliberately not in CI |

The seed script refuses to run when `NODE_ENV=production` and requires the explicit `--force` flag.

## Project layout

```
src/
├── app.js              express app: middleware stack, route mounts, error handler
├── index.js            entry point — connects the DB, starts the server
├── config/env.js       validates required env vars at import time
├── models/             12 Mongoose schemas
├── controllers/        request orchestration (thin; no service layer)
├── routes/             declarative guard composition per endpoint
├── middlewares/        auth · authorize · audit · validator · security · requestContext · rateLimiter
├── validators/         express-validator chains, one module per resource
├── services/           notification.service.js (side effects called from controllers)
└── utils/              constants · permissions · helpers · logger · api-response/errors
```

## The request pipeline

Protected routes are composed so authorization is visible at the route rather than buried in a controller:

```js
// src/routes/task.routes.js — the canonical example
router.route("/:projectId")
  .get(authorizeProject("task", "read"), getProjectTasks)
  .post(authorizeProject("task", "create"), createTaskValidator(), validate, audit("task", "created"), createTask);
```

| Stage | File | Responsibility |
|---|---|---|
| `verifyJWT` | `middlewares/auth.middleware.js` | Reads the access token from the httpOnly cookie (the only transport); rejects a revoked token version (401) or a deactivated account (403) |
| `authorizeProject` / `authorizeWorkspace` / `authorizeSystem` | `middlewares/authorize.middleware.js` | Loads the scope once, requires membership (only `super_admin` bypasses), checks the matrix, attaches `req.project` / `req.workspace` / `req.effectiveRole` |
| validator + `validate` | `validators/*.validators.js`, `middlewares/validator.middleware.js` | Type-checks the body → 422; `router.param(…, objectIdParam)` rejects malformed ids → 400 |
| `audit(entity, action)` | `middlewares/audit.middleware.js` | Arguments checked at startup; writes an `AuditLog` entry on success (fire-and-forget) |
| controller | `controllers/` | Business logic and **ownership** rules only (never role checks); throws `ApiError`, responds with `ApiResponse` |

App-level, before any route: request id + structured request log, security headers, CORS, rate limit, JSON body parser (no form parser), and a CSRF `Origin` check for unsafe methods.

## Authorization

A user can hold a role at three levels simultaneously. `resolveEffectiveRole()` collapses them into one key, checked against the `RolePermissions` matrix in `src/utils/permissions.js`.

```
System      super_admin │ hr │ product_manager │ member
Workspace   owner │ admin │ member │ guest          →  workspace_<role>
Project     project_manager │ scrum_master │ team_lead │ developer │ qa │ client │ viewer
```

Precedence: platform roles (`super_admin`, `product_manager`, `hr`) → project role → `workspace_<role>` → system role. Membership is required in every scope; `super_admin` is the only global bypass. Workspace roles govern the workspace (and who may create projects in it); they grant nothing inside a project.

The matrix supports `*:*` and `resource:*` wildcards, and **denies unknown roles** rather than falling back to `member` permissions:

```js
hasPermission("developer", "task", "create");            // true
hasPermission("viewer",    "task", "create");            // false
hasPermission("workspace_developer", "task", "create");  // false — logged as unmapped
```

**Add new permissions to the matrix, not as ad-hoc checks in controllers.**

## Conventions

- **Responses** — every success is `res.status(n).json(new ApiResponse(n, data, message))`; every failure throws `new ApiError(status, message, errors?)` from inside `asynchandler`. The global handler in `app.js` maps `CastError` → 400, duplicate key `11000` → 409, `ValidationError` → 400 and `VersionError` → 409; any other error is a generic 500 (details only when `NODE_ENV=development`, full stack always logged). Error bodies include `requestId`.
- **Enums** — `src/utils/constants.js` is the single source for statuses, roles, priorities, board columns and audit actions. Models import from it; never hardcode the strings. The frontend mirrors the task statuses in `frontend/src/lib/taskStatus.js`, and `tests/taskStatus.test.js` fails if the two drift.
- **Logging** — use the winston logger in `src/utils/logger.js`, not `console`, and pass errors as metadata: `logger.error("msg", { requestId: req.id, err })`. JSON lines go to `logs/error.log` and `logs/combined.log`; each request writes one line with id, user, project, status and duration.
- **Side effects** — call the functions in `src/services/notification.service.js` after a successful write, without awaiting. They never throw.
- **Invariants** — prefer a unique/partial index or a conditional atomic update over a read-then-write check in code.
- **List endpoints** — use `clampPagination` and `escapeRegex` from `src/utils/helpers.js`. Both are guarded by tests.
- **Tests** — anything touching authorization gets a multi-user test in `tests/api/` (see `setup.js`).

## API

All routes are under `/api/v1`. Interactive documentation is served at **`/api-docs`** (Swagger UI, from `docs/swagger.yaml`). A Postman collection is in `docs/`.

| Router | Endpoints |
|---|---|
| `/auth` | register · login · logout · refresh-token · current-user · change/forgot/reset password · verify-email · Google & GitHub OAuth |
| `/workspaces` | CRUD · invite · update/remove member |
| `/projects` | CRUD · members · roles · pending invitations · accept/reject |
| `/projects/:projectId/sprints` | CRUD · start/complete · burndown · velocity |
| `/projects/:projectId/tasks/:taskId/comments` | threaded comments · reactions |
| `/tasks/:projectId` | task CRUD · subtasks · assignment · status transitions |
| `/notes/:projectId` | project notes |
| `/dashboard` | aggregated statistics for the signed-in user |
| `/notifications` | list · unread count · mark read |
| `/search` | multi-entity search scoped to the caller's projects |
| `/admin` | user list · role/status changes · analytics · audit log |
| `/healthcheck` | liveness |

## Testing

```bash
npm test                      # all unit tests
node --test tests/security.test.js   # one file
```

Tests are pure-function (`node:test`) over `src/utils/` — permission resolution, pagination clamping, regex escaping and the task-status contract. There are no database or HTTP fixtures, so **keep testable logic as pure functions in `utils/`**.

End-to-end coverage lives in the frontend repository and drives this API for real:

```bash
PORT=8123 npm run e2e:server   # here
cd ../frontend && npm run e2e  # there
```

`scripts/e2e-server.mjs` boots `src/app.js` unchanged against a `mongodb-memory-server` instance, so tests never touch a development or production database. It sets its own env before importing anything from `src/`, so the real `.env` cannot leak in.

## Known limitations

Full detail, with finding IDs, lives in `docs/PROJECT_AUDIT.md` in the superproject (this repository's `main` branch).

- **No transactions.** Multi-document deletes are children-first and idempotent (a failed delete can be retried), but not atomic.
- One session per user: the refresh-token slot is single, so a new login ends the previous device's session.
- Existing databases need three one-off migrations: `db.workspaces.dropIndex("slug_1")`, `db.tasks.dropIndex("issueKey_1")` (if present) and `db.users.updateMany({}, {$unset: {refreshToken: ""}})`.
- `docs/swagger.yaml` documents only a fraction of the endpoints.
- No linter. `check:syntax` is a parse check, not static analysis.
