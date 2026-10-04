# Engineering Audit — Interview-Readiness Review

**Date:** 2026-09-30 · **Scope:** the whole repository (backend, frontend, tests, CI, docs)
**Method:** every file under `backend/src` and the frontend's auth/API/routing layer was read. Each suspected defect was then **reproduced against the real API**: `src/app.js` running on an ephemeral in-memory MongoDB, driven by a probe script. Where this document says **[reproduced]**, a live request produced the stated result. Where it says **[code]**, the finding comes from reading the code.

This audit builds on [PROJECT_AUDIT.md](PROJECT_AUDIT.md) (2026-09-28) and does not repeat it. New findings use the prefix **E**. Where this audit disagrees with the earlier one, it says so.

> This is the **pre-implementation** snapshot. Fixes are recorded in §20 and in [INTERVIEW_GUIDE.md](INTERVIEW_GUIDE.md).

---

## 1. Repository architecture summary

| Layer | What it is | Size |
|---|---|---|
| `backend/` | Express 5 + Mongoose 8, ESM, no build step | 60 JS files, ~5.2k LOC in `src/` |
| `frontend/` | React 19 + TypeScript + Vite 8 + Tailwind v4 | ~10k LOC |
| Tests | `node:test` unit tests (17), Playwright E2E (6 flows × 2 viewports) | — |
| CI | One GitHub Actions workflow per submodule (syntax + unit / tsc + lint + build) | — |

**Classification: a layered monolith, not yet a modular one.** It is one deployable Node process with one database, split into technical layers (routes → middleware → controllers → models) rather than domain modules. That is the right shape for this product at this scale. The problems are **inside** the layers, not in the choice of monolith.

**Request pipeline, as it actually runs** (task update, `PUT /api/v1/tasks/:projectId/t/:taskId`):

```
globalLimiter → morgan → json/urlencoded → static → cookieParser → passport → cors
→ VerifyJWT              (1 query: User)
→ requireProjectMember   (1 query: Project)           ← membership rule #1
→ rbac("task","update")  (2 queries: Project again, Workspace) ← permission rule #2
→ audit("task","updated")
→ updateTask             (1 query: Project a THIRD time; isProjectMember) ← rule #3
                         (1 query: Task, +1 Sprint/Task per relation, save, re-read + 3 populates)
```

**Six database round trips happen before the controller touches the task**, and authorization is decided three times by three pieces of code with three different rules.

---

## 2. Current strengths (keep these)

1. **Layered pipeline composed per route.** It is declarative and readable. `task.routes.js` is a good model.
2. **A single permission matrix** (`RolePermissions`) with `resource:action` strings and wildcards. It fails closed on unknown roles (fixed 2026-09-28).
3. **Error contract.** `asynchandler` + `ApiError` + a global handler that maps Mongoose `CastError`/`ValidationError`/`11000` to 400/400/409.
4. **Child lookups in the task, comment, sprint and note controllers are scoped to the parent** (`Task.findOne({ _id: taskId, project: projectId })`). Direct IDOR on those routes was attempted and **is blocked** [reproduced: non-member → 403].
5. **Centralised enums** in `utils/constants.js`.
6. **Deliberate indexing**, including a TTL on audit logs and read notifications.
7. **The E2E harness is real.** `e2e-server.mjs` boots the actual app against a throwaway MongoDB. That is the strongest testing asset in the repository.
8. **Auth fundamentals are present:** bcrypt, httpOnly cookies, SHA-256-hashed email/reset tokens with expiry, refresh-token rotation, a generic login error, and a uniform forgot-password response.

---

## 3. Critical weaknesses (the short list)

| # | Finding | Evidence |
|---|---|---|
| **E1** | **Search leaks any project's tasks and notes to any logged-in user.** `globalSearch` trusts `?projectId=` without a membership check. | [reproduced] non-member searched another user's project → 200, task returned |
| **E2** | **Any user can create projects inside any workspace.** `createProject` does `Workspace.findById(req.body.workspaceId)` with no membership check. | [reproduced] Bob created "Intruder" in Alice's workspace → 201 |
| **E3** | **`GET /auth/current-user` returns the plaintext refresh token** (and the reset-token hash). `VerifyJWT` excludes only `password` and the email-verification fields, and `refreshToken` has no `select: false`. | [reproduced] response includes `refreshToken` |
| **E4** | **Project deletion is broken.** `deleteProject` calls `Task/Sprint/Note/Comment/AuditLog.deleteMany`, and none of them are imported. The earlier audit listed "cascade delete" as working. | [reproduced] `DELETE /projects/:id` → 500 `Task is not defined` |
| **E5** | **The notification system is dead code.** `events/handlers/notification.handler.js` is never imported, so every `eventBus.safeEmit` has zero listeners. The handlers also listen for `task:*` events that no controller emits. | [code] `grep` finds no importer |
| **E6** | **The audit trail silently drops the governance events.** `audit()` receives entity/action strings that are not in the model's enums (`"project_member"`, `"added"`, `"role_updated"`, `"accepted"`, sprint `"started"`, `"completed"`). `updateProject` returns a bare document, so `entityId` is missing. Every member add, remove, role change and invitation fails validation inside a fire-and-forget `.catch`. | [code + committed logs] `logs/error.log` contains `AuditLog validation failed … 'added' is not a valid enum value` |
| **E7** | **Authorization has three sources of truth that disagree.** The matrix gives `team_lead`/`scrum_master` `task:*` and `project:*`, but controllers allow deletes only for `project_manager` (`isProjectAdmin`). The middleware lets system `hr`/`product_manager` into every project, while most controllers then 403 them. `deleteComment` reads `req.permissionContext`, which that router never sets. | [code] |
| **E8** | **Sprint start/complete are unreachable from the UI.** The frontend sends `PUT …/start` and `PUT …/complete`; the backend defines `POST`. | [reproduced] PUT → 404 |
| **E9** | **Two sprints can be active at once.** `startSprint` checks and then acts, with no database constraint. | [reproduced] two concurrent starts → 200/200, 2 active |
| **E10** | **`completeSprint` writes before it validates.** It marks the sprint completed, then 400s on a bad `moveIncompleteToSprint`, leaving tasks attached to a closed sprint. | [reproduced] 400, but sprint status is now `completed` |
| **E11** | **No request validation outside auth.** Type confusion crashes handlers, and object payloads reach Mongo as query operators. | [reproduced] `{title:123}` → 500 `title?.trim is not a function`; workspace with no name → 500; `{"email":{"$ne":null}}` executed as an operator |
| **E12** | **The API silently discards fields it accepts.** `parentTask`, `originalEstimate` and `remainingEstimate` are not schema paths (the schema says `parent` and `timeTracking.*`), so strict mode drops them. | [reproduced] parent not persisted |
| **E13** | **Tokens are returned in the JSON body and stored in `localStorage`** (earlier finding B22, still open). Together with E3, the httpOnly cookie protects nothing. | [reproduced] |
| **E14** | **CSRF surface in production.** Cookies are `SameSite=None` in production, and `express.urlencoded` accepts cross-site HTML form posts. No Origin check exists. | [reproduced] urlencoded POST with `Origin: https://evil.example` → 201 |
| **E15** | **Internal error messages reach clients.** Non-`ApiError` 500s return `err.message`, and stacks are not logged. | [reproduced] client sees `Task is not defined` |

---

## 4. Security findings (Phases 6–7)

### 4.1 Authentication

| ID | Issue | Threat | Severity |
|---|---|---|---|
| E3 | Refresh token in `current-user` response | Any XSS or a malicious extension reads a 10-day credential | **P0** |
| E13 | Tokens in body + `localStorage` | XSS exfiltrates the access token; the httpOnly cookie is pointless | **P0** |
| E16 | Refresh token stored **plaintext** on the user document (B9) | A database read or backup leak yields usable sessions | P1 |
| E17 | **No access-token revocation.** `.env.sample` sets a 1-day access token. Logout, password change and deactivation clear only the refresh token, so a stolen access token lives up to 24 h. | Session hijack survives password reset | P1 |
| E18 | `ACCESS/REFRESH_TOKEN_EXPIRY` unvalidated. If absent, `jwt.sign` mints non-expiring tokens (B20). | Eternal tokens | P1 |
| E19 | No password policy (`notEmpty()` only) on register, reset and change | Credential stuffing / weak passwords | P1 |
| E20 | Login checks `isActive` **before** the password, so a 403 reveals that a deactivated account exists without knowing its password | Account enumeration | P2 |
| E21 | OAuth links by email to an existing **unverified** local account. An attacker pre-registers `victim@x.com` with a password; when the victim signs in with Google, the attacker's password still works. | Pre-account takeover | P1 |
| E22 | `/auth/check-email` is an unauthenticated enumeration oracle, contradicting the "generic login error" design | Enumeration | P2 (UX trade-off; keep, rate-limited) |
| — | `/auth/users` duplicates `/admin/users` | Two code paths for one privileged action | P2 |

### 4.2 Authorization / BOLA

- **E1** (search IDOR) and **E2** (cross-tenant project creation) are real broken-access-control bugs.
- **E23** — `globalSearch` with `type=user` returns name/email of **every active user in the system**, not just collaborators. This is cross-tenant directory disclosure. P1.
- **E24** — `admin.routes.js` admits `product_manager` (B2). PMs can change system roles and deactivate users, while the matrix grants them no `user:*` rights. Also, `updateUserRole` saves with `validateBeforeSave: false`, so any string becomes a system role. P0.
- **E25** — removing someone from a workspace does not remove them from that workspace's projects, so access outlives membership. P1.
- **E26** — the `audit()` middleware takes `project`/`workspace` from **`req.body`** when the params lack them. Clients can attribute audit entries (and dashboard activity) to projects they do not belong to. P2.
- **Verified safe:** direct task/comment/sprint/note access by a non-member is blocked, and child documents are always queried with their parent id. Frontend role checks are cosmetic only; the backend is the enforcement point.

### 4.3 Web security

| Control | Current | Verdict |
|---|---|---|
| NoSQL injection | Express 5's default `simple` query parser cannot build nested objects from the query string (so `?status[$ne]=x` is inert). **JSON bodies can**, and most bodies are unvalidated (E11). | Fix at the boundary (validation) |
| XSS | React escapes output. `bodyHtml`/`descriptionHtml` are stored raw, but **no frontend code renders them** (`dangerouslySetInnerHTML`: 0 uses). | Latent. Do not render them without sanitising. |
| CSRF | E14 | Fix: JSON-only bodies + Origin allow-list for unsafe methods |
| Security headers | None. `X-Powered-By: Express` is sent. | Add a minimal set (API, not HTML) |
| CORS | Allow-list from `CORS_ORIGIN`, credentials on | Correct |
| Rate limiting | Global 500 / 15 min, auth 20 / 15 min, optional Redis | Good. **`trust proxy` is unset**, so behind a load balancer every user shares the LB's IP and one bucket (E27, P1). |
| Body size | `json({limit:"32kb"})` | Good |
| Regex injection | `escapeRegex` in tasks/search. **Missing in `admin listUsers`** (`new RegExp(search)`, ReDoS). | P2 |
| Secrets | `.env` ignored and never committed; `.env.sample` has placeholders | Good |
| Logs in Git | `logs/*.log` (11k lines, IPs + user agents) are **tracked** despite `.gitignore` | P2: `git rm --cached` |

---

## 5. Database findings (Phase 4)

**Entities:** `User`, `Workspace` (embedded `members[]`), `Project` (embedded `members[]`, `invitations[]`, `settings`, `taskSequence` counter), `Task` (embedded `subtasks[]`, `stateTransitions[]`, `timeLogs[]`, `linkedIssues[]`), `Sprint` (embedded `burndownData[]`), `Comment`, `Note`, `Notification`, `AuditLog`. Dead: `Label`, `Approval`, `Activity` (written by an unwired handler, read by nothing).

**Embedding decisions are mostly right:** membership lists are small and always read together with the project (authorization needs them on every request). Comments are referenced, not embedded, because they grow without bound.

**Risk of unbounded embedded arrays:** `Task.stateTransitions` gains one entry per status change and `Sprint.burndownData` one per snapshot. Both are fine for years at human edit rates. The 16 MB document limit is not a realistic threat here.

### Access patterns → indexes

| Query (hot path) | Index used | Verdict |
|---|---|---|
| Every project-scoped request: `Project.findById` | `_id` | ✅ (but done 3× per request — E7) |
| "My projects": `Project.find({"members.user": uid})` | `members.user_1` (multikey) | ✅ |
| Board: `Task.find({project, isArchived≠true}).sort({createdAt:-1})` | `project_1_status_1` for the filter; **sort done in memory** | NEXT: `{project:1, createdAt:-1}` |
| Task by id within project | `_id` | ✅ |
| Issue numbering | `{project:1, issueNumber:1}` unique | ✅ prevents duplicate keys |
| Comments of a task | `{task:1, createdAt:-1}` | ✅ |
| Notifications feed / unread count | `{recipient, isRead, createdAt}` | ✅ |
| Active sprint lookup | `{project:1, status:1}` | ✅, but **no uniqueness** (E9) |
| Workspace create | `slug` **globally unique** (B25) | ❌ wrong scope |
| Search `$regex` on title/description | none usable (unanchored regex) | Bounded by the `project $in` filter. Fine now; LATER: Atlas Search. |

**Indexes with no query pattern** (pure write cost): `Task{dueDate}`, `Task{labels}`, `Task{epicLink}`, `Project{lead}`, `Project{isArchived}` (boolean, low selectivity), `User{systemRole}` plus `User{isActive,systemRole}` (only the admin list uses them). The text index `{title, description}` is **unused**, because search uses regex. Keep the text index only if search is moved to `$text`.

**Consistency:**
- Issue numbering uses an atomic `$inc` on `Project.taskSequence`. Duplicates are impossible. A crash between the `$inc` and `Task.create` leaves a gap in numbering. **This is acceptable** (Jira has gaps too) and does **not** need a transaction. *This disagrees with PROJECT_AUDIT B7.*
- `deleteProject` cascade: a transaction needs a replica set (Atlas has one; the local fallback does not). A **children-first, idempotent** cascade is simpler. If it fails midway, the project still exists and the delete can be retried to completion. Also, the cascade **deletes the project's audit logs**, which defeats the purpose of an audit trail.
- Read-modify-`save()` on `Project`/`Workspace` member arrays: Mongoose's version key turns concurrent conflicting array rewrites into a `VersionError` rather than a lost update. That is safe but surfaces as a 500. P2.

**N+1 queries:** `getDashboardStats` issues `2 + 2×6` `countDocuments` (per-project progress) plus 3 more finds. One `$group` aggregation replaces the per-project loop. The client-side Tasks page fetches every project's tasks sequentially, page by page.

---

## 6. API design findings (Phase 5)

- **Inconsistent envelopes.** Most endpoints return `ApiResponse {statusCode,data,message,success}`. `getProjectById`, `updateProject`, `addMemberToProject`, member role/remove, `getProjectMembers`, `getAllProjects` and invitations return **bare objects** or `{message}` with ad-hoc status codes. This is why the frontend unwraps defensively (`res?.data || res`).
- **Verb mismatches** with the UI (E8).
- **Route naming.** Tasks live at `/tasks/:projectId/t/:taskId` and subtasks at `/tasks/:projectId/st/:subTaskId`, while sprints and comments are nested under `/projects/:projectId/...`. That is two conventions for the same ownership relation. It is documented rather than changed, because rewriting URLs would churn the whole frontend for no functional gain.
- **Pagination** is clamped only for tasks. Comments, notifications, admin users/audit, velocity and `getAllProjects` accept any `limit`. `getAllProjects` also accepts an arbitrary `sortBy` field.
- **Status codes.** Duplicate membership returns 400 (should be 409). The OAuth callback calls `.status(200).redirect()`, where the redirect overrides the status to 302 (harmless but misleading).
- **Idempotency.** Invitation accept is naturally idempotent (second call 404s). Task creation is not idempotent (a double-submit creates two tasks). That is acceptable for this domain; an `Idempotency-Key` header is a LATER item.

---

## 7. JavaScript code-quality findings (Phase 3)

- **Mixed error styles:** some handlers use `asynchandler` + `throw ApiError`, others `try/catch(next)` + `res.status(403).json({message})`, and `deleteProject` mixes both.
- **Mid-file imports** (`project.controller.js:128`), which is how E4's missing imports went unnoticed.
- **Name aliases:** `VerifyJWT` and `verifyJWT` both exported and both used. `UserRolesEnum` is a legacy alias.
- **`validateBeforeSave: false` used as a habit** (9 sites). It also disables enum checks, which is how E24's arbitrary role string gets saved.
- **`console.*` in controllers** despite a winston logger.
- **Comments in Hinglish study-notes style** (`"yeh har jagah same hi kaam karta toh ratt k samjh lo"`). Harmless, but an interviewer reading the code will notice.
- **Magic role lists** (`["super_admin","hr","product_manager"]`) repeated in 4 files instead of coming from `SystemRolesEnum`.
- **Good:** consistent `async/await`, optional chaining, destructuring, pure helpers in `utils/`.

---

## 8. Scalability findings (Phase 9)

What breaks first as load grows. **NOW / NEXT / LATER** means when to act.

| Load | First bottleneck | Class | Response |
|---|---|---|---|
| 10–1k users | Redundant authorization queries (4 DB reads before the handler) and dashboard N+1 | **NOW** | Load the project once; aggregate the dashboard |
| 1k–10k | In-memory rate-limit store per process; behind a load balancer `trust proxy` is unset, so all users share one IP bucket | **NOW** (proxy) / NEXT (Redis store, already supported) | `TRUST_PROXY`; set `REDIS_URL` when running >1 instance |
| 10k | Board sort in memory; unbounded list endpoints | NEXT | `{project, createdAt}` index; clamp every list |
| 10k–100k | Regex search; audit-log volume (one write per mutation) | NEXT | `$text` or Atlas Search; audit TTL already 365 d |
| 100k+ | Single MongoDB primary for writes; synchronous email sending in request path | LATER | Read replicas for dashboards; a job queue for email/notifications **only when** request latency shows it |

Node itself is not the bottleneck: the API is I/O-bound, bcrypt at cost 10 is ~60 ms on the libuv threadpool, and the process is stateless apart from the rate-limit store. That makes horizontal scaling a load-balancer change, not a rewrite.

---

## 9. Concurrency findings (Phase 10)

| Operation | Current | Risk | Right tool |
|---|---|---|---|
| Two sprints started concurrently | check-then-act | Two active sprints (E9) | **Partial unique index** `{project:1}` where `status:"active"` |
| Issue number allocation | atomic `$inc` | none (gaps only) | ✅ atomic update — already correct |
| Two users edit the same task | load → mutate → `save()` sends only modified paths | Last write wins **per field**; different fields merge | Acceptable. Optimistic concurrency (`__v` check) is NEXT if users complain. |
| Add member twice concurrently | `alreadyMember` check → push | Duplicate member entry | Conditional update: `updateOne({_id, "members.user": {$ne: uid}}, {$push})` |
| Invitation accept double-click | load → splice → save | `VersionError` → 500 on the second | Acceptable; the first wins |
| Complete sprint | multi-step, validates late | Partial state (E10) | Validate first, then write |

---

## 10. Logging and observability (Phase 11)

Can we answer the key questions **today**?

| Question | Answer today |
|---|---|
| What request failed? | Partly: the error line has method + URL; morgan logs separately with no correlation |
| Which user? | ❌ not logged |
| Which project? | ❌ (the URL contains it; nothing structured) |
| Why? | Only `err.message`; **no stack** for 500s |
| When? | ✅ timestamp |

Also: every 4xx is logged at `error` level (6-per-page-load `current-user` 401s dominate `error.log`), so real errors drown. Needed: a per-request id, returned in `X-Request-Id` and error bodies; one structured completion line per request with `userId`; 4xx at `warn`; stack traces for 5xx.

---

## 11. Testing findings (Phase 12)

| Layer | Exists | Covers |
|---|---|---|
| Unit | 17 tests | Helpers, permission matrix, status enum drift |
| API integration | **none** | — |
| E2E | 6 flows | Register/login/logout, create workspace → project → task, board status change, filters render, logged-out redirect, stale token |

**None of the defects in §3 could have been caught by the existing suite.** There is no test that a non-member is denied, that search is scoped, that deletion works, that invalid input is rejected, or that the audit log is written. Every E2E flow is a happy path with a single user. The highest-value missing tests are **multi-user API tests**: user B attacks user A's resources.

---

## 12. Production readiness (Phase 13)

| Item | State |
|---|---|
| Env validation | Partial: secrets only; expiries unvalidated |
| Graceful shutdown | ❌ no SIGTERM handling; in-flight requests are cut |
| Health / readiness | ❌ static 200 only; no DB check |
| Process-level errors | ❌ no `unhandledRejection` logging |
| Redis | Top-level `await` at import (B16); in production defaults to `redis://localhost:6379` when `REDIS_URL` is unset |
| Dockerfile / deploy config | ❌ none |
| Migrations | ❌ none. Index changes (B26, slug) need manual `dropIndex`. |
| Backups | Not documented (Atlas provides them) |
| CI | ✅ syntax + unit (backend), tsc + lint + build (frontend). No API tests, no `npm audit`. |

---

## 13. Technology audit — is every major technology justified?

| Technology | Verdict | Reason |
|---|---|---|
| Express 5 | **Keep** | Native async error propagation; the de-facto Node API framework |
| MongoDB + Mongoose | **Keep** | Document model fits embedded membership + flexible task fields; Mongoose gives schema validation and middleware |
| express-validator | **Keep** (over Zod) | Already used for auth. One validation library beats two. Chains live next to routes. Zod would be a reasonable alternative, not an upgrade worth a migration. |
| JWT + cookies | **Keep, fix** | Stateless verification; the fixes are about *where* the token lives |
| Passport (Google/GitHub) | **Keep** | Standard, isolated to `config/passport.js` |
| winston + morgan | **Keep** | Structured JSON logs; add correlation |
| Redis (`rate-limit-redis`) | **Keep optional** | Only needed with more than one instance; it already falls back to memory |
| In-process `EventEmitter` bus | **Remove** | Never wired (E5). In one process, a direct function call is simpler and cannot silently have zero listeners. |
| `Label`, `Approval`, `Activity` models | **Remove** | Dead |
| swagger-ui + yamljs | **Keep** | Cheap API docs (the spec is stale, see §15) |
| React + Vite + React Router | **Keep** | — |
| **TypeScript on the frontend** | **Keep** — *disagreeing with the brief's "JavaScript" preference*. **Reversed 2026-10-03, see §21** | TS *is* the JavaScript ecosystem. Converting 10k LOC to JS would delete the only compile-time contract checking in the project for no gain. It is easy to defend in an interview. |
| `framer-motion` **and** `motion` | Remove one | Same library twice (C9) |
| Tailwind v4 | Keep | Inline styles still dominate (C1). Frontend migration is out of scope for this backend-focused pass. |

---

## 14. Interview red flags (Phase 18) — what an interviewer finds in 10 minutes

1. **"Walk me through your notification system."** The event bus has no listeners. The feature is claimed in the README and CLAUDE.md, but it is not implemented end-to-end. *(E5)*
2. **"Show me your audit log for member changes."** It is empty, and the errors are in your own committed log files. *(E6)*
3. **"Delete a project."** 500. *(E4)*
4. **"Can a user read another tenant's data?"** Yes: `?projectId=` on search. *(E1)*
5. **"Where is authorization enforced?"** In three places with three rules. "It's in the middleware" is only partly true. *(E7)*
6. **"Why is the refresh token httpOnly if you send it in JSON?"** *(E3, E13)*
7. **"What stops two active sprints?"** Nothing. *(E9)*
8. **"How do you test authorization?"** You don't. *(§11)*
9. **Enterprise surface area far beyond what works:** approval workflows, labels, time logs, custom fields, attachments, epics, issue links, activity feed, and seven project roles. All of these exist in schemas and enums, but most have no endpoint, no UI, or both. An interviewer will pick one and ask how it works.
10. `backend/docs/backend-improvements.md` marks unfinished items `[COMPLETED ✅]`.
11. Frontend-only feature: the header global search filters `/projects` client-side instead of calling `/search` (D5).

---

## 15. Documentation findings (Phase 15)

The README set is recent and mostly accurate. Inaccurate or missing:

- CLAUDE.md says "notifications live in `src/events/handlers/notification.handler.js`". They are written, but never registered.
- PROJECT_AUDIT §3.1 lists "cascade delete of project children" as working (E4).
- `docs/swagger.yaml` is 95 lines covering a fraction of ~60 endpoints.
- There is no document explaining the security model, request lifecycle or scaling path in interview terms. `INTERVIEW_GUIDE.md` fills this gap.

---

## 16. Interview-readiness score — before changes

| # | Area | Score | Why (evidence) |
|---|---|---|---|
| 1 | Backend engineering | 5 | Sound skeleton; E4/E5/E6/E10 are broken paths |
| 2 | JavaScript demonstrated | 5 | Modern syntax; mixed error styles, mid-file imports |
| 3 | API design | 4 | Inconsistent envelopes, verb mismatch, unclamped lists |
| 4 | Database design | 6 | Thoughtful indexes and embedding; wrong unique scopes, dead models, no invariants in DB |
| 5 | Authentication | 4 | Right primitives, undermined by E3/E13/E16/E17 |
| 6 | Authorization / RBAC | 3 | Good matrix idea; E1, E2, E7, E24 |
| 7 | Security | 3 | E1–E3, E11, E14 |
| 8 | Scalability | 4 | Stateless-ish; redundant queries, N+1, proxy IP |
| 9 | Error handling | 5 | Central handler; leaks internals, no stacks, 500s on bad input |
| 10 | Testing | 2 | No API tests; E2E happy paths only |
| 11 | Code quality | 4 | See §7 |
| 12 | Architecture | 5 | Right shape, three authz sources, dead event bus |
| 13 | Production readiness | 3 | No readiness, shutdown, deploy config |
| 14 | Documentation | 6 | Plentiful, partly wrong |
| 15 | Interview explainability | 3 | Surface area ≫ working behaviour |

**Overall interview readiness: 4 / 10.** A careful interviewer would find a cross-tenant data leak, a dead feature and a 500 on a core action within one conversation.

---

## 17. Prioritised plan (Phase 19)

Complexity S/M/L; interview value ★–★★★; "Need?" = whether you actually need it.

### P0 — critical (implement now)

| Change | Problem → Fix | Files | Risk | Cx | Value | Need? |
|---|---|---|---|---|---|---|
| One authorization middleware per scope | E1, E2, E7, E24: three rule sets → `authorizeProject/Workspace/System(resource, action)` + one matrix; controllers only check *ownership* | `middlewares/authorize.js`, all routes, controllers | Behaviour changes for roles the matrix already allowed | M | ★★★ | Yes |
| Scope search | E1, E23 → intersect `projectId` with memberships; users limited to collaborators | `search.controller.js` | Low | S | ★★★ | Yes |
| Cookie-only auth, hide secrets | E3, E13 → no tokens in body; `select:false` on `password`/`refreshToken`; frontend drops `localStorage` | auth controller, user model, `api.ts`, `AuthContext.tsx` | Client contract change | M | ★★★ | Yes |
| Validate every mutation | E11 → express-validator chains + ObjectId params | `validators/*`, routes | Rejects previously-accepted junk | M | ★★★ | Yes |
| Fix project deletion | E4 → imports; children-first idempotent cascade; keep audit logs | project controller | Low | S | ★★ | Yes |
| Make audit reliable | E6, E26 → validate `audit()` args at boot; ids from params/`req.project` only | `audit.middleware.js`, routes | Low | S | ★★★ | Yes |
| Admin = matrix-driven | E24 → `user:*` only for super_admin; hr `user:read`; enum-validated role | admin routes/controller | PMs lose admin | S | ★★ | Yes |

### P1 — important (implement now where cheap)

| Change | Files | Cx | Value |
|---|---|---|---|
| Hashed refresh token + `tokenVersion` revocation (E16, E17); 15 m access token; expiry defaults (E18); password policy (E19) | user model, auth, env | M | ★★★ |
| Sprint invariants: partial unique index (E9), validate-then-write (E10), UI verbs (E8) | sprint model/controller, `ProjectSprints.tsx` | S | ★★★ |
| Replace dead event bus with an explicit notification service (E5) | `services/notification.service.js`, controllers | M | ★★ |
| Field mapping `parentTask`→`parent`, estimates → `timeTracking` (E12) | task controller | S | ★ |
| CSRF: JSON-only + Origin allow-list (E14); minimal security headers; `trust proxy` (E27) | `app.js`, `middlewares/security.js` | S | ★★★ |
| Error handler: mask 5xx, log stack + request id + user (E15, §10) | `app.js`, `middlewares/requestContext.js` | S | ★★ |
| Readiness probe + graceful shutdown | `index.js`, healthcheck | S | ★★ |
| Clamp every list endpoint | controllers | S | ★★ |
| Workspace removal revokes project access (E25); slug unique per owner (B25) | workspace controller/model | S | ★★ |
| OAuth pre-account-takeover guard (E21); password-before-`isActive` (E20) | passport, auth | S | ★★ |
| Dashboard: one aggregation instead of N+1 | dashboard controller | S | ★★ |
| **API integration tests** (multi-user authz, validation, auth, sprint invariants) | `tests/api/*.test.js` | M | ★★★ |
| Delete dead code: `Label`, `Approval`, `Activity`, event bus, `/auth/users`, `canManageProject` | — | S | ★★ |

### P2 — improvement (documented, not done in this pass)

- Uniform response envelope on the remaining legacy endpoints, plus typed frontend payloads (D8).
- `{project, createdAt}` index for the board; drop unused indexes.
- Frontend: Tailwind migration and mobile layout (C1/C13), data-fetching layer (C5), missing auth pages (D1/D2).
- Dockerfile + compose; `npm audit` in CI; untrack `logs/`.
- Rewrite `swagger.yaml` from the routes.

### P3 — nice to have

- Idempotency keys for task creation; optimistic concurrency on task edits.
- Multi-device sessions (B10).
- Atlas Search; background job queue — **only** when measured latency justifies it.

---

## 18. Hypotheses that turned out wrong (and two bugs found only while testing)

Recorded because an audit that is never wrong was not checked.

- **"NoSQL injection in the invite email" was labelled *not reproduced* by the first probe.** It *was* reproduced: `{"email":{"$ne":null}}` matched an existing user and the API answered "already a member" instead of rejecting the input. The probe's success criterion was wrong, not the finding.
- **"Pagination with `limit=abc` returns 500"**: not reproduced. Mongoose tolerated the NaN. Unbounded limits were still real, so every list is now clamped.
- **`ObjectId.isValid("aaaaaaaaaaaa")` accepts 12-character strings**: true for older bson versions, **false** in the installed one. The helper now uses `mongoose.isObjectIdOrHexString`, and the comment says why.
- **Found only by the new integration tests:**
  1. `config/env.js` was imported only by `index.js`. Anything that imports `app.js` directly (tests, the E2E server) skipped config validation, and here that meant `jwt.sign` got no `expiresIn`. Fixed by importing it first in `app.js`.
  2. **Two JWTs minted in the same second were byte-identical** (HS256 is deterministic and `iat` has one-second resolution). So "rotating" a refresh token could hand back the same token. Fixed with a random `jti` on every token.
- **Found in the developer's `.env`:** the access and refresh secrets are identical, so a 10-day refresh token also verifies as an access token. The server now refuses this in production and warns in development. **Rotate one of the two secrets.**

## 19. Browser verification (2026-09-30)

`PORT=8123 npm run e2e:server` + `npm run e2e`:

| Suite | Desktop | Mobile |
|---|---|---|
| `critical-path.spec.ts` (6 flows) | **6/6 pass** | 1/6 pass |
| `_debug.spec.ts`, `_navlinks.spec.ts` (untracked, landing-page work in progress, not part of this change) | fail | fail |

Every mobile critical-path failure is the same click, and Playwright's reason is *"element is outside of the viewport"*: the dashboard sidebar navigation at Pixel 7 width. This is the existing layout defect C13, which changed shape after `DashboardLayout.tsx` was edited on 2026-09-29 (it previously failed as "search input intercepts pointer events"). No failure involved an API or auth error. The rewritten session test checks that the access cookie is `httpOnly`, is absent from `document.cookie`, and that a corrupted access cookie is recovered through one silent refresh.

## 20. What was changed

### Backend

| Area | Change | Findings |
|---|---|---|
| Authorization | `middlewares/authorize.middleware.js`: `authorizeProject/Workspace/System(resource, action)`, one DB read per request, membership required (only `super_admin` bypasses). Controllers keep **ownership** rules only. Matrix rewritten in `utils/permissions.js` (explicit `manage_members`, `moderate`; workspace roles grant nothing inside projects; admin = `user:*`). `rbac.middleware.js` deleted. | E1, E2, E7, E23, E24, B1, B2 |
| Authentication | Cookie-only; no tokens in bodies; `password`/secrets `select:false` + stripped in `toJSON`; refresh token hashed, rotated with reuse detection + 30 s concurrent-tab grace; `tokenVersion` revokes access tokens immediately; `jti` on every token; 15 m/7 d defaults; refresh cookie scoped to `/api/v1/auth`; password policy; password checked before `isActive`; OAuth pre-account-takeover guard | E3, E13, E16–E21 |
| Validation | express-validator chains for every mutation (`validators/*.validators.js`); `router.param` ObjectId checks | E11, B4, B5 |
| Correctness | Project delete fixed (children-first, idempotent, audit logs kept); `completeSprint` validates before writing; one-active-sprint partial unique index; `parent`/estimates persisted; conditional atomic membership updates; workspace removal revokes project access; workspace slug unique per owner; status lifecycle in one pre-save hook | E4, E9, E10, E12, E25, B25 |
| Audit | `audit()` validates entity/action at startup; ids never from the request body; member/invitation/sprint events now recorded | E6, E26 |
| Notifications | Dead event bus replaced by `services/notification.service.js` (assign, status change, comment + resolved @mentions, sprint start/complete, invitation, project deleted), batched `insertMany` | E5 |
| HTTP hardening | JSON-only body parser; CSRF Origin check; security headers; `x-powered-by` off; `TRUST_PROXY`; CORS before the limiter; rate limiter fails open on Redis outage and never hangs startup | E14, E27, B16 |
| Errors & observability | Request id (`X-Request-Id`, in every error body); one structured log line per request with user/project/status/duration; 5xx masked to clients with the stack logged; errors serialised with stacks; token URLs redacted; morgan removed | E15, §10 |
| Operations | Readiness probe; graceful SIGTERM shutdown; `unhandledRejection` logging; env validation for expiries/secrets/CORS; `PORT` default 8000 | B17, B20, B21 |
| Performance | Dashboard: one `$group` aggregation replaces 3 + 2×N counts; authorization went from 4 reads to 1 per request | §5, §8 |
| Dead code removed | `Label`, `Approval`, `Activity` models, event bus, `/auth/users`, `canManageProject`, `ApprovalStatusEnum`, `VerifyJWT` alias | B12, B13 |
| Dependencies | 14 production vulnerabilities → **0** (`npm audit fix` + nodemailer 7 → 10); `supertest` added (dev); `morgan` removed | — |
| CI | `npm audit --omit=dev --audit-level=high` added; `npm test` now includes the API integration tests | §12 |

### Frontend (contract fixes only; the UI was not redesigned)

`lib/api.ts` and `context/AuthContext.tsx` are cookie-only (no `localStorage`, no bearer header). Sprint start/complete use `POST` (E8). Project invitations send valid roles (`developer`, not `member`). The workspace invite offers `guest` instead of the non-existent `viewer`. Generated usernames are lowercase. The project task tab requests up to 100 tasks instead of silently showing 10. The password field requires 8 characters. The E2E session test was rewritten for cookies.

### Verification

| Check | Result |
|---|---|
| Backend `npm test` | **69/69 pass** (20 unit + 49 API integration; was 17 unit) |
| Mutation check | Reintroducing the search IDOR makes its test fail; restored |
| `npm run check:syntax` | 69 files parse |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Frontend `tsc -b` / `oxlint` / `build` | 0 errors / 7 pre-existing warnings (unchanged) / builds |
| Playwright critical path | desktop 6/6; mobile 1/6 (C13, pre-existing layout) |

### Interview-readiness score — after

| # | Area | Before | After | What still holds it back |
|---|---|---|---|---|
| 1 | Backend engineering | 5 | **7.5** | No deploy artefacts; no load test |
| 2 | JavaScript demonstrated | 5 | **7** | Frontend god components; unformatted code (prettier fails) |
| 3 | API design | 4 | **6.5** | Two URL conventions (`/tasks/:projectId/t/:id` vs nested); swagger covers a fraction |
| 4 | Database design | 6 | **7.5** | Unused indexes remain; unbounded embedded history arrays |
| 5 | Authentication | 4 | **8** | Single session per user; no MFA; reset/verify pages missing in UI |
| 6 | Authorization / RBAC | 3 | **8** | Matrix is broad for platform roles (`product_manager` = `project:*` where a member) |
| 7 | Security | 3 | **7** | Equal secrets in the dev `.env`; email-availability oracle (deliberate); no CSP on `/api-docs` |
| 8 | Scalability | 4 | **6** | Unmeasured; regex search; single-process rate limit without Redis |
| 9 | Error handling | 5 | **8** | — |
| 10 | Testing | 2 | **7** | No frontend unit tests; mobile E2E red; E2E not in CI |
| 11 | Code quality | 4 | **6.5** | Frontend untouched structurally; inconsistent formatting |
| 12 | Architecture | 5 | **7.5** | — |
| 13 | Production readiness | 3 | **5** | No Dockerfile/staging, mobile layout broken, auth pages missing |
| 14 | Documentation | 6 | **8** | Swagger stale |
| 15 | Interview explainability | 3 | **7** | Enterprise-sounding schema fields with no feature behind them (time logs, custom fields, issue links, attachments) |

**Overall: 4/10 → 6.5/10.** The backend alone is now defensible at about 7.5. The full-stack score is held down by the frontend: broken mobile layout, missing reset/verify pages, and no data layer.

### Remaining issues (not done in this pass)

- **Rotate the development secrets** so access ≠ refresh.
- One-off migrations on any existing database: `db.workspaces.dropIndex("slug_1")`, `db.tasks.dropIndex("issueKey_1")` (if present), `db.users.updateMany({}, {$unset:{refreshToken:""}})`. Also complete any second active sprint before starting the new build, or the partial unique index cannot be created.
- Frontend: mobile layout (C13/C1), reset-password and verify-email pages (D1/D2), 404 route + ErrorBoundary (C7), data layer (C5).
- Schema fields with no feature behind them: `timeLogs`, `customFields`, `linkedIssues`, `attachments`, `watchers` (no endpoint), project `settings.enableApprovals`, workspace `features.*`. Delete them, or be ready to say they are unimplemented.
- `logs/*.log` are still tracked by Git: `git rm --cached logs/*.log` in `backend/`.
- `backend/docs/swagger.yaml` needs regenerating from the routes.
- Backend formatting (`prettier --write`) as one isolated commit, then gate CI on `format:check`.

## 21. 2026-10-03 — frontend converted to JavaScript; email-link flows fixed

**Decision reversed: TypeScript → JavaScript.** §13 kept TypeScript. The owner is fluent only in JavaScript and must be able to defend every line in an interview, which outweighs compile-time checking in a thin client. The two things TypeScript protected are still protected at runtime: the task-status contract (`backend/tests/taskStatus.test.js`, the `isTaskStatus` guard, and `Object.freeze`d constants in `lib/taskStatus.js` / `lib/priority.js`) and payload shapes (the API's validators plus the E2E suite).

How: the old config set `erasableSyntaxOnly` and `verbatimModuleSyntax`, so every type could be deleted without changing runtime behaviour. Types were stripped with `ts-blank-space` and the gaps removed. Comments and formatting were kept, and leftover cast parentheses were tidied by hand. `tsconfig*.json` were replaced by `jsconfig.json` (keeps the `@/` alias for editors), `typescript` and `@types/*` were removed, and CI dropped its `tsc -b` step. The E2E suite passed 12/12 straight after the conversion, before any other change. Lint now reports 4 warnings (`only-export-components` ×3, one unused catch binding). The two `no-unsafe-optional-chaining` warnings in `text-effect.jsx` went away with the casts, and one import that had been used only as a type surfaced as unused and was removed.

**Fixed in the same pass:**

| Finding | Fix | Verified by |
|---|---|---|
| D1 password reset dead-ends | `/auth/reset-password/:token` page; reset email's button said "Verify your email" | API test + E2E |
| D2 verification link opened the API's JSON | link now opens `/auth/verify-email/:token` (new `EMAIL_VERIFICATION_REDIRECT_URL`); resend from Settings | API test + E2E |
| New: public pages unreachable signed out | `lib/api.js` sent every failed session refresh to `/login`, including from `/`; now only from `/dashboard/*` | `landing.spec.js` |
| New: local `.env` reset URL pointed at `localhost:3000/forgot-password` | corrected; tests and the E2E server now pin both redirect URLs | API tests |
| D4 OAuth | callback already redirects to `/dashboard`; buttons now hidden unless `VITE_OAUTH_ENABLED=true` | manual (needs provider credentials) |
| `_debug.spec.ts` / `_navlinks.spec.ts` failing | probe deleted; the nav test became `landing.spec.js` (mobile menu got `aria-expanded`/`aria-controls`) | E2E |

Test support: under `NODE_ENV=test`, `sendEmail` records messages in `testOutbox`; `scripts/e2e-server.mjs` serves the newest one per address at `GET /__e2e/last-email`, on a wrapper app that exists only in that script.

Results: backend 72/72 tests, `check:syntax` clean; frontend lint 0 errors / 4 warnings, build passes; Playwright 19 passed + 1 skipped (mobile-only test on desktop).
