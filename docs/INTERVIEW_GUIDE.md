# Project Camp: Engineering and Interview Guide

**What this is:** how the system works, why it is built the way it is, and what an interviewer will ask about it. Every claim here points at real code. Where the project is weak, this guide says so, because an interviewer will find the weak spots anyway.

**Companion documents:** [ENGINEERING_AUDIT.md](ENGINEERING_AUDIT.md) (findings E1–E27 with evidence, and what was fixed), [PROJECT_AUDIT.md](PROJECT_AUDIT.md) (earlier findings A/B/C/D).

---

## 1. Executive summary

**What it is.** A multi-tenant project-management app in the Jira/Linear style: workspaces contain projects; projects contain tasks (issue keys like `PAY-14`), sprints, comments and notes. It has three layers of roles, an audit trail and in-app notifications. It is a React SPA plus an Express/MongoDB REST API.

**What is strong.**
- A declarative request pipeline in which each route reads as its own security policy.
- One permission matrix, enforced by one middleware per scope.
- Cookie-only sessions with revocation.
- Invariants enforced by the database instead of by hope.
- 49 API integration tests that attack the system as a second user.

**What is weak.**
- The frontend: per-page data fetching (no shared cache) and no compile-time types; it is a thin client over the API.
- No deployment artefacts.
- Several schema fields describe features that do not exist (time logs, custom fields, issue links, attachments).

**What changed in the 2026-09-30 pass.** It fixed:
- a cross-tenant data leak in search;
- cross-tenant project creation;
- the refresh token leaking in `/current-user`;
- a broken project delete;
- a notification system that had never been wired up;
- an audit trail that silently dropped membership events;
- a sprint race condition;
- a CSRF exposure.

Authorization was consolidated from three disagreeing implementations into one, and the backend went from 17 unit tests to 69 tests. See ENGINEERING_AUDIT §20.

---

## 2. Architecture: the 60-second version

> "It's a **modular monolith**: one Node.js process running Express 5, one MongoDB database, and a React SPA that talks to it over a versioned REST API. I chose a monolith deliberately. The domain is one bounded context (work tracking), the team is one person, and nothing in the load profile needs independent scaling of parts. Inside the API, code is layered: routes compose middleware declaratively, middleware handles cross-cutting concerns (authentication, authorization, validation, audit), controllers hold business logic, and Mongoose models hold schema-level rules and indexes. Side effects such as notifications are plain function calls in a service module. The server is stateless: sessions are JWTs in cookies and the database is the only shared state. So scaling out means running more copies behind a load balancer. The one piece of per-process state is the rate-limit counter, and that moves to Redis when there is more than one instance."

```
Browser ── HTTPS ──► React SPA (static files)
   │ cookies (httpOnly)
   ▼
Express API ─ requestContext → securityHeaders → cors → rateLimit → json → cookies → originCheck
   │            └ per route: verifyJWT → authorize*(resource, action) → validate → audit → controller
   ▼
MongoDB  (Users, Workspaces, Projects, Tasks, Sprints, Comments, Notes, Notifications, AuditLogs)
```

**Folder map (backend/src):** `routes/` (what each endpoint requires) · `middlewares/` (auth, authorize, validator, audit, security, requestContext, rateLimiter) · `validators/` (one module per resource) · `controllers/` (business rules) · `services/notification.service.js` · `models/` · `utils/` (permissions matrix, constants, helpers, logger) · `config/` (env validation, OAuth).

**Why no service/repository layer?** Controllers are 60–300 lines and each talks to at most three models. A repository layer over Mongoose (which is already a data-mapping layer) would add indirection without removing any duplication. The shared logic that does exist lives where it is reused: `utils/permissions.js`, `utils/helpers.js`, `services/notification.service.js`. *Trade-off to state:* if controllers grew complex business workflows, or needed a second storage backend, I would extract services.

---

## 3. Request lifecycle: a task status change, end to end

`PUT /api/v1/tasks/65f…a1/t/65f…b2` with body `{"status":"in_review"}` from the Kanban board.

| # | Stage | Code | What happens | Fails with |
|---|---|---|---|---|
| 1 | Frontend | `Tasks.jsx` → `lib/api.js` | Optimistic UI update, then `api.put(...)` sends `credentials:"include"`. The browser attaches the httpOnly cookies; JavaScript never sees them. | — |
| 2 | Request context | `requestContext.middleware.js` | Assigns `req.id` (UUID), sets `X-Request-Id`, and starts a timer for the log line. | — |
| 3 | Headers/CORS | `security.middleware.js`, `cors` | Security headers set. The browser's preflight is answered only for allow-listed origins. | CORS failure (browser-side) |
| 4 | Rate limit | `rateLimiter.middleware.js` | Counts per client IP (real IP via `trust proxy`). | 429 |
| 5 | Body + cookies | `express.json({limit:"32kb"})`, `cookieParser` | Parses JSON only. | 400 bad JSON, 413 too large |
| 6 | CSRF | `requireTrustedOrigin` | A PUT carrying a foreign `Origin` header is rejected. | 403 |
| 7 | Authentication | `auth.middleware.js` `verifyJWT` | Verifies the JWT signature and expiry, loads the user, compares the token's `tv` with `user.tokenVersion`, and checks `isActive`. | 401 / 403 |
| 8 | Authorization | `authorizeProject("task","update")` | Loads the project **once**. The caller must be a member. Their project role is resolved and checked against `RolePermissions`. Sets `req.project`. | 400 bad id / 404 / 403 |
| 9 | Validation | `updateTaskValidator()` + `validate` | `status` must be one of the 7 enum values; every field is type-checked. `router.param` already rejected a malformed `taskId`. | 422 / 400 |
| 10 | Audit hook | `audit("task","updated")` | Wraps `res.json` to write an AuditLog entry *if* the response succeeds. | — |
| 11 | Business logic | `task.controller.js` `updateTask` | `Task.findOne({_id: taskId, project: req.project._id})`: a task from another project is simply not found. Records the diff, sets the status, pushes a state transition. | 404 |
| 12 | Database | `task.models.js` pre-save hook | Derives `statusCategory` and sets or clears `completedAt`, in one place. `save()` sends only modified paths. | 400 (schema), 409 (version conflict) |
| 13 | Side effects | `notifyTaskStatusChanged(...)` | Not awaited: one `insertMany` of notifications to assignees, watchers and the reporter, never to the actor. Failures are logged, never thrown. | — |
| 14 | Response | `ApiResponse` | `200 {statusCode, data, message, success}` with the populated task. | — |
| 15 | Audit write | `audit` wrapper | Fire-and-forget `AuditLog.create` with actor, project, changes, IP and user agent. | logged only |
| 16 | Log line | `requestContext` on `finish` | `{requestId, method, url, status, durationMs, userId, projectId}`. | — |
| 17 | Frontend | `Tasks.jsx` | Keeps the optimistic state. On an error it reverts and shows `ErrorBanner` with the server message. On a 401, `api.js` refreshes the session once and retries. | — |

**Error path:** any `throw` (an `ApiError` or an unexpected bug) reaches the central handler in `app.js`. Known library errors become the right 4xx. Anything else becomes `500 "Internal Server Error"` for the client and a full stack plus `requestId` in the log.

---

## 4. Security model

### 4.1 Authentication (who are you?)

- **Passwords:** bcrypt with cost 10 in a Mongoose `pre("save")` hook. The field is `select: false` and is also stripped by `toJSON`, so it can't leak through a forgotten projection. Policy: 8–128 characters with a letter and a digit.
- **Tokens:** two JWTs (HS256) carrying only `{_id, tv, jti}`.
  - **Access token:** 15 minutes, in the `accessToken` httpOnly cookie on path `/`.
  - **Refresh token:** 7 days, in the `refreshToken` httpOnly cookie **scoped to `/api/v1/auth`**, so it is never sent to other endpoints.
  - Neither token ever appears in a response body.
- **Why cookies, not `localStorage`:** a script (such as an XSS payload) can read `localStorage` but cannot read an httpOnly cookie. The trade-off is that cookies are sent automatically, which creates CSRF risk (see 4.3).
- **Revocation:** stateless JWTs can't be "deleted", so every token embeds `tv` (token version). `verifyJWT` already loads the user on each request (to check `isActive`), so comparing `tv` costs nothing extra. `user.revokeSessions()` increments the version. That runs on logout, password change or reset, deactivation, and role change, and every outstanding token dies on its next request.
- **Refresh rotation with reuse detection:** only a SHA-256 hash of the refresh token is stored, so a database leak does not yield sessions.
  - Each refresh issues a new pair and replaces the hash.
  - Presenting the *previous* token within 30 seconds is treated as two tabs racing, and gets a harmless 200.
  - Presenting it later means a copy of a used token is being replayed, so **every session is revoked**.
- **`jti`:** a random id on every token. Without it, two tokens minted in the same second were byte-identical (HS256 is deterministic), which broke rotation. The integration tests found this.
- **Enumeration:** login returns the same 401 for an unknown email or a wrong password. The password is checked *before* the deactivated flag. Forgot-password always returns the same response and does not await the SMTP call, so response timing does not reveal whether the account exists. `/auth/check-email` is a deliberate exception for signup UX, and it sits behind the strict auth rate limiter.
- **OAuth account linking:** linking a Google or GitHub login to an existing *unverified* account wipes that account's password and sessions. This prevents pre-account takeover, where an attacker registers the victim's email first.

### 4.2 Authorization (what may you do?)

- **Three scopes, one matrix.** `utils/permissions.js` `RolePermissions` maps role → `["resource:action", "resource:*", "*:*"]`. `resolveEffectiveRole(system, workspace, project)` collapses a user's roles into one key, and `hasPermission()` **fails closed** on an unknown role.
- **One middleware per scope:** `authorizeSystem`, `authorizeWorkspace`, `authorizeProject`. Each loads the scope document, **requires membership** (`super_admin` is the only global bypass), checks the matrix, and hands the loaded document to the controller.
- **RBAC vs ownership.** Roles answer "can a developer update tasks?" (middleware). Ownership answers "is this *your* comment?" or "are you *the* owner of this project?" (controller). Keeping them separate is why controllers contain no role checks.
- **BOLA/IDOR defence**, in two layers:
  1. The URL's scope id (`projectId`) is authorized.
  2. Every child lookup includes that scope: `Task.findOne({_id: taskId, project: req.project._id})`. A valid task id from another project is a 404.

  Search takes an optional `projectId` filter, which is **intersected** with the caller's memberships.
- **Workspace roles do not reach into projects.** A project is visible to its members only. Removing someone from a workspace also removes them from its projects.
- **Never trust the frontend.** The UI hides buttons for convenience only. Every test in `tests/api/authorization.test.js` calls the API directly, as a second user replaying the first user's ids.

### 4.3 Web threats

| Threat | Where it could hit this app | Mitigation in code | Why it works |
|---|---|---|---|
| **NoSQL injection** | `User.findOne({ email: req.body.email })` with `{"$ne": null}` | Validators type-check first (`isString`, `isEmail`, `isMongoId`); Express 5's query parser cannot build objects | An object never reaches a query where a string is expected |
| **XSS** | Rendering user text | React escapes by default; no `dangerouslySetInnerHTML`; the API no longer accepts raw `bodyHtml`/`descriptionHtml`; CSP `default-src 'none'` on API responses | Even if XSS happened, it cannot read the session cookies |
| **CSRF** | Cookies are sent cross-site (`SameSite=None` in production when the SPA and API are on different sites) | JSON-only parser (HTML forms can't send JSON); `requireTrustedOrigin` rejects unsafe methods from foreign origins; cross-origin `fetch` with JSON needs a CORS preflight | The attacker's page can't forge `Origin`, and can't pass the preflight |
| **Brute force** | `/auth/login` | 20 requests / 15 min / IP on `/auth/*`; 500 globally | Makes online guessing slow; Redis shares the counters across instances |
| **Clickjacking / MIME sniffing** | Any response | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, HSTS in production | Standard headers; hand-set because helmet's HTML-focused defaults add little to a JSON API |
| **Mass assignment** | `User.create(req.body)`, `project.set(req.body)` | Explicit whitelists in every controller (`registerUser`, `updateProject`, `updateProfile`) | `systemRole` or `owner` can never be set from a body; a test posts `systemRole: "super_admin"` |
| **Sensitive data exposure** | User documents, errors, logs | `select:false` plus `toJSON` stripping; 5xx messages masked; token URLs redacted in logs | Two layers for secrets; clients never see internals |
| **ReDoS / regex injection** | Search | `escapeRegex` on every user-supplied pattern | User input is matched literally |
| **Payload DoS** | Any body | 32 kB JSON limit; `clampPagination` (max 50–100) on every list | Bounded work per request |
| **Dependency CVEs** | npm tree | `npm audit --omit=dev --audit-level=high` in CI (14 → 0) | New advisories fail the build |

---

## 5. Database model

```
User ─┬─ Workspace.members[] {user, role}  ── Workspace {owner, slug}
      └─ Project.members[]  {user, role}   ── Project {workspace, key, taskSequence, invitations[]}
                                               ├── Sprint {status, burndownData[], summary}
                                               ├── Task {issueKey, status, assignees[], sprint, parent,
                                               │         subtasks[], stateTransitions[], timeTracking}
                                               │     └── Comment {author, mentions[], reactions[], parentComment}
                                               └── Note
Notification {recipient, type, isRead}     AuditLog {actor, project, entity, action, changes[]}
```

**Embedding vs referencing, and why:**
- **Members are embedded** in Project and Workspace. The list is small (tens of entries), it is always needed together with its parent (authorization reads it on every request), and embedding makes "load the project" and "check membership" a single read.
- **Tasks, comments and sprints are referenced.** They grow without bound, are queried and paginated independently, and would push a project document towards the 16 MB limit.
- **Subtasks and state transitions are embedded** in Task. They are small, owned, and always read with the task.

**Indexes and the queries they serve:**

| Index | Query | Notes |
|---|---|---|
| `Project {"members.user":1}` (multikey) | "my projects", dashboard, search scope | Every list starts here |
| `Project {workspace:1, key:1}` **unique** | key uniqueness per workspace | Keys like `PAY` repeat across tenants |
| `Task {project:1, issueNumber:1}` **unique** | issue-number integrity | Backs the atomic `$inc` counter |
| `Task {project:1, status:1}` | board columns, dashboard `$group` | Filter by project, group by status |
| `Task {project:1, sprint:1}`, `{sprint:1, status:1}` | sprint views, sprint completion | |
| `Sprint {project:1}` **unique, partial `status:"active"`** | "one active sprint" invariant | Only active sprints are in the index |
| `Workspace {owner:1, slug:1}` **unique** | name uniqueness per owner | Was wrongly global |
| `Comment {task:1, createdAt:-1}` | task thread | |
| `Notification {recipient:1, isRead:1, createdAt:-1}` | bell count and feed | TTL removes read notifications after 90 days |
| `AuditLog {project:1, createdAt:-1}` + TTL 365 d | activity feed, audit viewer | Bounded growth |

**Known imperfections (say them before the interviewer does):**
- The board sorts `createdAt` in memory. A `{project:1, createdAt:-1}` index would remove that.
- Several indexes (`dueDate`, `labels`, `epicLink`, `lead`, `isArchived`) serve no current query and only cost writes.
- The text index is unused because search is regex-based.

**Consistency toolbox, from lightest to heaviest:**
1. An **atomic operator** (`$inc` for issue numbers, `$push` with a `$ne` guard for membership).
2. A **unique or partial unique index** (one active sprint, per-owner slug).
3. **Validate-then-write ordering** (`completeSprint`).
4. An **idempotent children-first cascade** (project delete).

No transactions are used. They need a replica set (the local dev database isn't one), and every multi-document operation here is either atomic in a single document or safely retryable.

---

## 6. Scalability strategy

**Today (1 instance):** Node is I/O-bound; each request does 2–5 indexed queries. bcrypt (~60 ms) runs on libuv's thread pool, not the event loop. Expected capacity is hundreds of requests per second on one small instance; that is **unmeasured**, and a load test (k6 or autocannon) is the honest next step.

| Stage | What breaks first | Change | Why that and not more |
|---|---|---|---|
| **→ 10k users** | CPU on one process; per-process rate-limit counters once there are 2+ instances | Run N identical instances behind a load balancer; set `TRUST_PROXY=1`; set `REDIS_URL` (shared rate limits); enable `/healthcheck/ready` for the LB | The API is stateless (JWT cookies), so this needs no code change |
| **→ 100k users** | MongoDB reads (dashboard aggregation, search regex, list endpoints); synchronous email in the request path | Add `{project, createdAt}` and other query-driven indexes; Atlas Search or `$text` for search; read replicas for dashboards/analytics; move email and notification fan-out to a job queue (BullMQ on the Redis already present) | A queue is justified once side effects measurably slow requests, or need retries |
| **Larger** | Write throughput on one primary; very large tenants | Shard by `workspace` (tenant key); cache hot read-mostly data (project membership) in Redis with invalidation on membership change; WebSockets for live boards instead of polling | Only with measured hot spots; each adds operational cost |

**When Redis is *unnecessary*:** with a single instance. The in-memory rate limiter is exact, and there is nothing else to cache that MongoDB can't serve from an index. **When background jobs are unnecessary:** while notifications are a single `insertMany` taking a few milliseconds and no side effect needs retries.

---

## 7. Testing strategy

| Layer | Where | What it protects | Count |
|---|---|---|---|
| Unit | `backend/tests/*.test.js` | Permission matrix (fail-closed, precedence, wildcards), helpers (pagination clamp, regex escape, ObjectId), status-enum contract with the frontend | 20 |
| API integration | `backend/tests/api/*.test.js` | The real app on an in-memory MongoDB, driven by supertest. Multi-user BOLA probes, RBAC per role, session delivery and revocation, refresh-reuse detection, validation, CSRF, invariants under concurrency (issue numbers, active sprint), audit trail, notifications | 49 |
| End-to-end | `frontend/e2e/critical-path.spec.js` (Playwright) | Register/login/logout, workspace → project → task, board status persistence, filters, protected routes, cookie-session recovery | 6 flows × desktop/mobile |

**Philosophy:** the highest-value tests are the ones that attack. Most defects found in this audit were authorization or consistency bugs, which unit tests on happy paths can't catch. A single-user E2E flow can't catch them either. Tests assert **status codes and database state**, not implementation details, and nothing is mocked. One mutation check was run: reintroducing the search IDOR makes its test fail.

**Gaps:** no frontend component tests; E2E can't run in CI (it needs both repositories); mobile E2E is red because of a known layout defect; no load test.

---

## 8. Production readiness checklist

| Implemented | Missing |
|---|---|
| Env validation, fail-fast (secrets, expiries, CORS in production) | Dockerfile / compose / deploy config |
| Liveness + readiness probes | Staging environment |
| Graceful shutdown (SIGTERM drain, 10 s cap) | Log shipping / error tracking (Sentry etc.) |
| Structured JSON logs with request ids | Backups documented (Atlas provides them) |
| Central error handler, masked 5xx | Migration tooling (index changes are manual) |
| Security headers, CORS allow-list, CSRF check, rate limits | Load test / capacity numbers |
| Cookie-only sessions with revocation | Frontend: mobile layout, reset/verify pages, 404 page |
| Dependency audit in CI; 0 production CVEs | CI gate on formatting and lint warnings |
| 69 backend tests in CI | E2E in CI |

---

## 9. Scorecard

See [ENGINEERING_AUDIT.md §20](ENGINEERING_AUDIT.md#interview-readiness-score--after) for the per-area table. **Overall 6.5/10** (from 4/10). The backend by itself is about 7.5. The full-stack score is held down by the frontend.

---

## 10. Interview questions for this repository

Each entry lists what the question tests and what a strong answer contains. These are not scripts to memorise. If you can't produce the answer from your own understanding of the code, reread that code.

### A. Fundamentals

**1. What does the application do, and who is it for?**
- *Tests:* product clarity.
- *Concepts:* multi-tenant work tracking; workspaces, projects, tasks, sprints.
- *Strong answer:* one sentence on the product, one on tenancy (a workspace is a tenant), and one on what makes it non-trivial (three role scopes, an audit trail).

**2. Why Express and MongoDB instead of, say, NestJS and PostgreSQL?**
- *Tests:* whether the choices were deliberate.
- *Concepts:* document model, flexible issue fields, embedded membership, framework weight.
- *Strong answer:* membership embeds naturally and is read on every request; task fields vary by issue type. Express is small enough to explain completely. Also concede what Postgres would give: foreign keys, transactions without a replica set, and relational reporting.

**3. Classify the architecture. Why not microservices?**
- *Tests:* architectural judgement.
- *Concepts:* monolith vs modular monolith vs microservices; bounded contexts; operational cost.
- *Strong answer:* one bounded context, one developer, and no part that needs independent scaling. Microservices would add network failure modes and distributed consistency for no gain. The layering gives most of the modularity benefit.

**4. Walk me through what happens when I change a task's status on the board.**
- *Tests:* end-to-end understanding.
- *Concepts:* §3 of this guide.
- *Strong answer:* name every stage in order: cookie, authN, authZ, validation, scoped query, pre-save hook, notification, audit, response, optimistic UI and rollback.

**5. Why is the frontend JavaScript and not TypeScript?**
- *Tests:* whether you can defend a trade-off instead of following fashion.
- *Concepts:* compile-time vs runtime safety; owning the code you ship.
- *Strong answer:* it was TypeScript and I converted it (2026-10-03) so that the whole stack is one language I can explain line by line. TypeScript was protecting two things, and both are still protected at runtime: the task-status contract (`backend/tests/taskStatus.test.js` plus the `isTaskStatus` guard and frozen constants in `lib/taskStatus.js`) and payload shapes (the API's express-validator chains reject anything malformed, and the Playwright suite drives every flow). The conversion was mechanical — the old config used `erasableSyntaxOnly`, so stripping types could not change behaviour — and the E2E suite passed unchanged before and after. If the client grew, I would add JSDoc types with `checkJs` before reaching for a full migration back.

### B. Authentication

**6. Explain your authentication flow from login to logout.**
- *Tests:* JWT and cookie mechanics.
- *Concepts:* access/refresh split, httpOnly cookies, cookie paths, rotation, revocation.
- *Strong answer:* login verifies bcrypt, then issues a 15-minute access token and a 7-day refresh token as httpOnly cookies, the refresh one scoped to `/api/v1/auth`. `verifyJWT` checks the signature, `tv` and `isActive`. On a 401 the client calls refresh once. Logout bumps `tokenVersion`.

**7. What is inside your JWT, and why so little?**
- *Tests:* token design.
- *Concepts:* stale claims, token size, information disclosure (JWTs are signed, not encrypted).
- *Strong answer:* `{_id, tv, jti}`. Role and status are read from the database on each request, so a demoted or deactivated user can't ride a stale token. The payload is base64 and readable, so put nothing sensitive in it.

**8. JWTs are stateless. How do you log someone out before the token expires?**
- *Tests:* the classic JWT trade-off.
- *Concepts:* token versioning vs denylists vs short expiry.
- *Strong answer:* `tokenVersion` on the user, embedded as `tv`. `verifyJWT` already loads the user to check `isActive`, so the comparison is free. It is revoke-all, not per-session, which is acceptable because there is one session per user.

**9. Why store the access token in a cookie rather than `localStorage`?**
- *Tests:* XSS vs CSRF trade-off.
- *Concepts:* httpOnly, the XSS exfiltration model.
- *Strong answer:* an injected script can read `localStorage` but not an httpOnly cookie. Cookies bring CSRF, which you then mitigate (Q24). Mention that the project previously returned tokens in JSON *and* stored them in `localStorage`, and that `/current-user` leaked the refresh token.

**10. What is refresh-token rotation, and what does reuse detection buy you?**
- *Tests:* depth on session security.
- *Concepts:* one-time refresh tokens, theft detection, race conditions.
- *Strong answer:* each refresh replaces the stored hash. A replayed old token means a copy exists somewhere, so revoke everything. The 30-second grace window exists because two tabs refreshing with the same cookie would otherwise log the user out.

**11. Why hash the refresh token in the database but not the access token?**
- *Tests:* threat modelling.
- *Concepts:* stored credentials; what a database leak yields.
- *Strong answer:* the refresh token is stored; the access token is never stored (it is verified by signature). A leaked plaintext refresh token is a 7-day session; a leaked hash is useless. SHA-256 is enough (bcrypt isn't needed) because the token is 256 bits of randomness, not a guessable password.

**12. You found two JWTs could be identical. Explain.**
- *Tests:* whether you really debugged it.
- *Concepts:* HMAC determinism, `iat` resolution, `jti`.
- *Strong answer:* same payload + same secret = same signature. `iat` is in seconds, so login and refresh in the same second produced the same refresh token, and "rotation" was a no-op. The integration test caught it; a random `jti` fixed it.

**13. How do you prevent account enumeration, and where do you knowingly allow it?**
- *Tests:* nuance.
- *Concepts:* uniform errors, timing, UX trade-offs.
- *Strong answer:* same 401 for both failure cases, password checked before `isActive`, and forgot-password uniform and non-blocking. `/check-email` and register's 409 allow enumeration by design, rate-limited. Name that as a trade-off.

**14. How does OAuth login work here, and what is pre-account takeover?**
- *Tests:* federation edge cases.
- *Concepts:* account linking by email, email verification.
- *Strong answer:* Passport strategy → `findOrCreateOAuthUser`. Linking to an *unverified* local account wipes its password and sessions, because someone else may have registered the email first.

**15. Why bcrypt, and what does the cost factor mean for the server?**
- *Tests:* password storage and runtime impact.
- *Concepts:* adaptive hashing, salt, libuv thread pool.
- *Strong answer:* bcrypt is deliberately slow and salted. Cost 10 is about 60 ms per hash, and it runs on the thread pool, so it doesn't block the event loop, but it caps login throughput per core. That is one reason login has its own rate limit.

### C. Authorization and RBAC

**16. Authentication vs authorization: where is each in this codebase?**
- *Tests:* vocabulary and precision.
- *Strong answer:* `verifyJWT` answers "who are you?" (401). The `authorize*` middleware answers "may you do this?" (403). Controllers handle ownership.

**17. Explain the three role tiers and how they combine.**
- *Tests:* the core design.
- *Concepts:* `resolveEffectiveRole`, precedence, the `workspace_` prefix.
- *Strong answer:* platform roles (super_admin/product_manager/hr) override; otherwise the project role; otherwise `workspace_<role>`; otherwise the system role. A project member always has a project role, so inside projects the project role decides.

**18. Why does `hasPermission` fail closed? What happened before?**
- *Tests:* secure defaults.
- *Strong answer:* an unknown role used to inherit `member` rights, so a typo granted access silently. Denying and logging surfaces the mistake. Also mention the test that asserts an unmapped key is denied.

**19. What is BOLA/IDOR? Show me how this code prevents it.**
- *Tests:* the most common API vulnerability.
- *Concepts:* object-level authorization.
- *Strong answer:* authorize the scope in the URL, then query children **with** that scope (`{_id: taskId, project: req.project._id}`). Then the real bug found here: search trusted `?projectId=`. Explain intersecting it with the caller's memberships.

**20. Why was authorization in three places a problem, and how did you fix it?**
- *Tests:* refactoring judgement.
- *Strong answer:* the middleware matrix, controller `isProjectAdmin` checks and a system-role bypass each disagreed. Team leads were allowed by the matrix but blocked by controllers, and product managers were let in by middleware then 403'd by the controller. Fixed with one middleware per scope that attaches the loaded document; controllers keep only ownership rules. Side benefit: 4 database reads per request became 1.

**21. RBAC vs ownership: give an example of each from this project.**
- *Strong answer:* RBAC: only roles with `task:delete` may delete tasks. Ownership: only the project's `owner` may delete it, even though project managers hold `project:*`. A developer may edit only comments they authored.

**22. A user is removed from a workspace. What happens to their project access, and why did that need fixing?**
- *Strong answer:* project membership was independent, so access outlived removal. Now `removeMember` also pulls them from the workspace's projects (except projects they own). Mention that this is a policy decision.

**23. Frontend permissions: what are they for if they can't be trusted?**
- *Strong answer:* UX only (hiding buttons). Every request is re-authorized by the server. The tests call the API directly as another user, which is exactly what an attacker with curl does.

### D. Web security

**24. Your cookies are `SameSite=None` in production. How are you not vulnerable to CSRF?**
- *Concepts:* SameSite, simple requests, preflight, the Origin header.
- *Strong answer:* JSON-only body parsing means HTML forms can't produce a readable body. A cross-origin `fetch` with JSON triggers a preflight, which CORS rejects. `requireTrustedOrigin` blocks unsafe methods from foreign origins. Explain why `SameSite=None` is needed at all: an SPA and API on different sites.

**25. What is CORS, and what does it *not* protect against?**
- *Strong answer:* CORS is a browser rule about which origins may *read* responses. It doesn't stop a request from being *sent* (hence CSRF), and it does nothing against curl.

**26. How would NoSQL injection work against this API, and what stops it?**
- *Strong answer:* `{"email": {"$ne": null}}` reaches `findOne` as an operator. This was reproduced in the old invite endpoint. Type validation at the boundary stops it, and so does Express 5's query parser, which can't create objects.

**27. Where could XSS happen, and what limits the damage?**
- *Strong answer:* React escapes output. There is no `dangerouslySetInnerHTML`, and the raw HTML fields are no longer accepted. The damage is limited because the session cookies are unreadable to scripts; an attacker could still act *as* the user while the page is open.

**28. Why did you hand-write security headers instead of using helmet?**
- *Strong answer:* explain each header's threat. Helmet's headline features (CSP and friends) target HTML pages, and a default CSP would break `/api-docs`. Adopting helmet with CSP disabled for docs would be fine; the point is knowing what each header does.

**29. How does rate limiting work behind a load balancer, and what was wrong before?**
- *Strong answer:* without `trust proxy`, `req.ip` is the load balancer's address, so everyone shares one bucket. `TRUST_PROXY=<hops>` fixes that. Counters are per process until Redis is configured. The limiter fails open if Redis dies (availability over throttling).

**30. What sensitive data could leak, and what are the two layers protecting user secrets?**
- *Strong answer:* `select: false` (not loaded) plus a `toJSON` transform (never serialised), plus masked 500 messages and token URLs redacted from logs. The real bug: `current-user` returned the plaintext refresh token.

### E. Validation and errors

**31. Where does validation happen: API boundary, business logic, or database?**
- *Strong answer:* all three, each with a job. Boundary (express-validator): types, enums, lengths. Business rules (controller): cross-document rules such as "assignee is a member". Database: schema enums and unique indexes as the last line.

**32. Why express-validator and not Zod?**
- *Strong answer:* it was already the auth layer's tool, and one validation library beats two. The chains sit next to routes. Zod would give shared schemas and inferred types (valuable with TypeScript), which is a reasonable future move, not a necessity.

**33. Walk me through the central error handler.**
- *Strong answer:* async errors reach it via `asynchandler` and Express 5. `ApiError` passes through. Mongoose `CastError` → 400, duplicate key 11000 → 409, `ValidationError` → 400, `VersionError` → 409, bad JSON → 400. Anything else → masked 500 with the stack logged and a `requestId` returned.

**34. A user reports "it failed". How do you find out why?**
- *Strong answer:* the `requestId` from the error body or the `X-Request-Id` header finds one structured log line: user, project, endpoint, status, duration and error message, plus the stack for 5xx. Mention the real debugging session where that exact line found the missing `expiresIn`.

**35. The audit log silently dropped events. How, and how did you make it impossible?**
- *Strong answer:* routes passed strings like `"added"` that weren't in the model's enum. The fire-and-forget write failed, and only a log line recorded it. Now `audit()` validates its arguments when the route is *defined*, so a typo crashes the server at startup.

### F. Database and consistency

**36. Why embed members in the project instead of a separate collection?**
- *Strong answer:* see §5. Mention the limit: a project with 10,000 members would need referencing plus an index.

**37. Which indexes matter most, and which would you delete?**
- *Strong answer:* explain `members.user`, `{project, issueNumber}` unique, the partial active-sprint index and `{owner, slug}`. Offer to delete `dueDate`/`labels`/`lead`/`isArchived`, since each index costs every write.

**38. How are issue numbers like `PAY-14` generated safely under concurrency?**
- *Strong answer:* `findByIdAndUpdate({$inc: {taskSequence: 1}})` is atomic in a single document, and the unique index backs it up. A crash after the increment leaves a gap, which is harmless, so no transaction. The test creates 10 tasks concurrently and checks the keys are unique.

**39. How do you guarantee one active sprint per project?**
- *Strong answer:* a partial unique index (`{project:1}` where `status: "active"`). Before, it was check-then-act, and two concurrent starts both succeeded (reproduced). Now the database rejects the second write with 11000, mapped to 409.

**40. When would you use a MongoDB transaction here, and why don't you?**
- *Strong answer:* transactions are for multi-document changes that must be all-or-nothing. They need a replica set. The existing operations are either single-document-atomic or ordered children-first and idempotent, so a retry converges. The candidate for a transaction would be moving tasks and closing a sprint in one step.

**41. Two users edit the same task at the same time. What happens?**
- *Strong answer:* `save()` sends only modified paths. Different fields merge; the same field is last-write-wins. Optimistic concurrency (compare `__v` or `updatedAt`, answer 409) is the next step if users complain. Mention `VersionError` mapping to 409 for array rewrites.

**42. What queries get slow as data grows?**
- *Strong answer:* unanchored regex search (no index), board sort in memory, the dashboard aggregation for users in many projects, and audit log growth (TTL bounds it).

**43. Deleting a project touches five collections. How do you avoid a half-deleted project?**
- *Strong answer:* delete children first, then the project, with each step idempotent. A crash leaves the project visible and deletable again. Audit logs are kept on purpose. Mention the bug: it previously threw `Task is not defined` before deleting anything.

### G. Scalability and operations

**44. How would you scale this to 100,000 users?**
- *Strong answer:* §6 in stages, with the reason each step is needed. Refuse to add infrastructure without a measurement.

**45. How do you horizontally scale Node? What state stops you?**
- *Strong answer:* stateless JWT cookies, and the database is shared. The only per-process state is rate-limit counters (→ Redis). The old in-process event bus would have been another; it's gone.

**46. What happens if MongoDB becomes the bottleneck?**
- *Strong answer:* first indexes and query shape (measure with `explain()`), then projections and pagination, then read replicas for read-heavy dashboards, then caching hot membership reads, and sharding by workspace last.

**47. When is Redis unnecessary, and when would you introduce it?**
- *Strong answer:* unnecessary with one instance. Needed for shared rate limits across instances, later maybe caching and a job queue. Say what you would cache and how you would invalidate it.

**48. When would you introduce background jobs?**
- *Strong answer:* when a side effect is slow (email via SMTP), needs retries, or fans out widely. The notification service functions are the seam; the controllers wouldn't change.

**49. Liveness vs readiness: what is the difference and why have both?**
- *Strong answer:* liveness means the process answers (so restart it if not); readiness means it can serve (so route traffic to it). A database outage should fail readiness, not liveness; otherwise the orchestrator restarts healthy processes in a loop.

**50. What happens to in-flight requests during a deploy?**
- *Strong answer:* SIGTERM → `server.close()` stops accepting connections and lets current requests finish → disconnect Mongo → exit, with a 10-second forced exit.

### H. Code, testing and trade-offs

**51. Why did you delete the event bus instead of fixing it?**
- *Strong answer:* its handlers were registered by an import that nothing performed, so zero listeners existed and the failure was silent. In one process a direct function call gives the same decoupling and can't silently go nowhere. Pub/sub earns its place with multiple consumers or processes.

**52. How do you test authorization?**
- *Strong answer:* multi-user API tests: user B replays user A's ids against every endpoint and expects 403/404. Roles are tested per matrix entry. The mutation check proves a test fails when the bug is reintroduced.

**53. Why integration tests over unit tests for this backend?**
- *Strong answer:* the bugs found were at the seams (middleware order, scoped queries, indexes, cookies). An in-memory MongoDB makes a real-database test take milliseconds. Unit tests remain for pure logic like the permission matrix.

**54. What does your E2E suite cover, and why is mobile red?**
- *Strong answer:* be honest. The critical path is green on desktop. Mobile fails because the sidebar is outside the viewport, since inline styles can't express breakpoints. The fix is the planned Tailwind migration.

**55. Show me something in this codebase you would refactor first, and why.**
- *Strong answer:* pick one: the frontend data layer (per-page `useEffect` fetching), or the two URL conventions, or the enterprise schema fields with no features (delete them). Justify by risk and value.

**56. Which parts of the schema describe features that don't exist?**
- *Strong answer:* `timeLogs`, `customFields`, `linkedIssues`, `attachments` and approval flags. Admit it, and say you would delete them rather than defend them.

**57. What was the most serious bug you found, and how did you prove it?**
- *Strong answer:* the search IDOR (cross-tenant data read). Proved with a live probe as a second user, fixed by intersecting with memberships, and locked in by a test that fails if it is reintroduced.

**58. What would you do differently if you started over?**
- *Strong answer:* fewer speculative schema fields; tests before features; a single authorization mechanism from day one; decide cookie vs bearer auth first; Tailwind from the first component.

---

## What I must personally understand

Prioritised by how central each is to *this* codebase. Be able to explain each one aloud, without the code open.

1. **The request pipeline order** and why it is in that order (`requestContext` → headers → CORS → rate limit → body → cookies → origin check → `verifyJWT` → authorize → validate → audit → controller).
2. **Express middleware mechanics**: `next()`, `next(err)`, error-handling middleware with four arguments, and how Express 5 forwards rejected promises.
3. **Authentication vs authorization**, and which status code belongs to which (401 vs 403 vs 404).
4. **How a JWT works**: header.payload.signature, HMAC signing, what `verify` checks, why the payload is readable.
5. **Access/refresh token split**: lifetimes, why two tokens, and the refresh flow in `api.js`.
6. **httpOnly / Secure / SameSite / Path** cookie attributes and what each prevents.
7. **Token revocation via `tokenVersion`**, and why it is almost free here.
8. **Refresh-token rotation, reuse detection and the grace window.**
9. **XSS, CSRF and CORS**: what each is, how they interact, and this app's defences.
10. **BOLA/IDOR** and the two-layer defence (authorize the scope, then query children with the scope).
11. **The RBAC matrix**: `resource:action`, wildcards, fail-closed, `resolveEffectiveRole` precedence.
12. **RBAC vs ownership rules**, and why controllers only do ownership.
13. **Input validation layers** (boundary, business, database) and why type-checking stops NoSQL injection.
14. **Centralised error handling** and the `ApiError`/`ApiResponse` contract.
15. **Mongoose basics**: schemas, `select:false`, `toJSON` transforms, pre-save hooks, `populate`, `lean`, strict mode (why `parentTask` was silently dropped).
16. **Embedding vs referencing**, with this project's choices.
17. **Indexes**: compound index prefix rule, multikey indexes, unique vs partial unique, TTL; the cost on writes.
18. **Atomic operations vs check-then-act races** (`$inc`, conditional `$push`, partial unique index).
19. **When transactions are needed** and why this app avoids them (replica set, idempotent ordering).
20. **Pagination and query bounding** (`clampPagination`, skip/limit costs, why cursor pagination scales better).
21. **async/await and the event loop**: what blocks it (CPU work) and what doesn't (I/O, bcrypt on the thread pool); fire-and-forget promises that must never reject.
22. **Rate limiting**: fixed window, per-IP keys, `trust proxy`, shared store for multiple instances, fail-open vs fail-closed.
23. **Horizontal scaling of a stateless Node API**, and the one piece of state that breaks it.
24. **Audit logging vs application logging**: who did what (business record) vs what happened (operational); request ids for correlation.
25. **Liveness vs readiness**, and graceful shutdown.
26. **The testing pyramid as applied here**: why multi-user API tests are the highest-value layer; in-memory MongoDB; the mutation check.
27. **REST design in this API**: resource nesting, verbs, status codes (201, 409, 422), idempotency of PUT/DELETE vs POST.
28. **The honest weaknesses**: frontend mobile layout, speculative schema fields, single session per user, unmeasured capacity. Be able to say how you would fix each.
