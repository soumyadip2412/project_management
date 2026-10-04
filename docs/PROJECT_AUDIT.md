# Project Audit

**Audited:** 2026-09-28 · root commit `0975d8f` · backend submodule `dca31de` · frontend submodule `1cb6255`
**Scope:** read-only inspection. No application code was modified during the audit.

This document records what the repository *actually* contains, verified by running the toolchain rather than by reading its own documentation. Where existing docs disagree with the code, the code is treated as the source of truth and the discrepancy is recorded.

> **Status: roadmap phases P0.1, P0.2 and P0.2c have since been implemented** (2026-09-28). Browser verification now runs (6/6 desktop, 3/6 mobile) — see [QA_CHECKLIST.md](QA_CHECKLIST.md). Findings resolved by it are marked **[fixed in P0.1]** inline; everything else stands as written. See [PRODUCTION_ROADMAP.md](PRODUCTION_ROADMAP.md) for what P0.1 covered.
>
> **Two corrections to the original audit**, found while implementing P0.1 and marked **[corrected]** below: a Kanban board *does* exist (§6), and empty states are more widely implemented than first reported (C6). One new finding was added: **C10**, a status-enum mismatch between the board UI and the backend.

> **Update 2026-09-30 — superseded in part by [ENGINEERING_AUDIT.md](ENGINEERING_AUDIT.md).** A second, evidence-based audit (live-reproduced against the API) found issues this document missed and fixed most backend findings here. **Resolved:** B1, B2, B3, B4, B5, B6, B8, B9, B12, B13, B16, B17, B20, B21, B22, B25, D7 (partly). **Decided differently:** B7, where issue numbering needs no transaction (gaps are harmless) and project deletion is now children-first and idempotent instead of transactional (see ENGINEERING_AUDIT §5). **Correction:** §3.1 below lists "cascade delete of project children" as working. It was not: `deleteProject` referenced five models it never imported and returned 500 on every call (ENGINEERING_AUDIT E4). The frontend findings (C1–C13, D1–D6) still stand.

> **Update 2026-10-03.** D1 and D2 are fixed and D4 is resolved, and the frontend is now JavaScript, so `.ts`/`.tsx` paths below now end in `.js`/`.jsx`. See [ENGINEERING_AUDIT.md §21](ENGINEERING_AUDIT.md).

---

## 1. Repository & Git structure

The root is a **superproject** tracking two gitlinks (`160000`) plus `.gitignore` and `CLAUDE.md`. `backend/` and `frontend/` are independent Git repositories with their own histories; there is **no `.gitmodules` file**, so `git submodule status` fails and a fresh clone produces two empty directories.

| Path | Role | Tracked in root as |
|---|---|---|
| `backend/` | Express 5 + MongoDB REST API ("Project Camp") | gitlink `dca31de` |
| `frontend/` | React 19 + TS + Vite 8 SPA | gitlink `1cb6255` |
| `graphify-out/` | Generated knowledge graph, **untracked** | — |
| `.agents/` | `graphify` rules/workflow, **untracked** | — |
| `docs/` | This audit set (new) | — |

**Findings**

- **A1 (P0, blocker for any clone):** no `.gitmodules`. The submodule relationship exists only in the root index, so nobody else can clone this repository into a working state.
  **[fixed in P0.1]** `.gitmodules` added and both submodules registered. Note what it revealed: **both submodules point at the same remote** (`Bobin2004/project-management.git`) on different branches — `backend-dev` and `frontend`. Both recorded gitlinks were verified to exist on that remote, so `git clone --recurse-submodules` now resolves.
- **A2 (P1):** both submodules are currently dirty (`M backend`, `M frontend`) with uncommitted work, and the root has never recorded a commit pointing at those changes.
- **A3 (P2):** `graphify-out/` (a ~100-file generated artifact) and `.agents/` are untracked and unignored, so they permanently pollute `git status`. **[partly fixed in P0.1]** `graphify-out/` is now ignored; `.agents/` is left visible because it is hand-written configuration that probably should be committed.
- No `AGENTS.md` and no `SKILL.md` exist anywhere. `CLAUDE.md` (root) is current and accurate. `.agents/rules/graphify.md` is an always-on rule directing architecture questions through the `graphify` CLI.

## 2. Toolchain state — verified by execution

| Check | Command | At audit | After P0.1 |
|---|---|---|---|
| Frontend typecheck | `npx tsc -b` | ❌ **12 errors** | ✅ 0 errors |
| Frontend build | `npm run build` | ❌ **cannot succeed** (build runs `tsc -b` first) | ✅ succeeds |
| Frontend lint | `npm run lint` (oxlint) | ⚠️ 18 warnings, 0 errors | ⚠️ 7 warnings, 0 errors |
| Backend tests | `npm test` | ❌ **1 of 6 subtests failing** | ✅ 10 of 10 passing |
| Backend syntax | `npm run check:syntax` | — (did not exist) | ✅ 59 files parse |
| Backend lint | — | ❌ **no linter configured** (prettier installed, unscripted) | ❌ still none — see note |
| CI | — | ❌ **none** | ✅ one workflow per submodule |
| Deployment config | — | ❌ **none** (no Dockerfile, no deploy config) | ❌ unchanged (roadmap P1.6) |

**Backend lint note:** still no real linter. `prettier --check` fails on **57 of 59 files**, so gating CI on it would require a repo-wide reformat, and adding ESLint means a new dependency — both deliberately deferred. CI instead runs a zero-dependency `check:syntax` script that parses every backend file, which catches parse errors in a codebase with no build step. `format:check` is scripted but not wired into CI.

The 7 remaining frontend lint warnings all map to findings deferred past P0.1: C8 (two swallowed `catch` bindings), C9 (two unsafe optional chains), C4 (`only-export-components` ×2) and one `exhaustive-deps` in `ProjectDetail.tsx`.

### 2.1 The frontend does not build

Of the 12 TypeScript errors, 11 are unused-symbol noise (`TS6133`). One is a genuine runtime defect:

```
src/pages/Settings.tsx(21,27): error TS2304: Cannot find name 'useCallback'.
```

`Settings.tsx:1` imports only `{ useState, useEffect }`, but line 21 calls `useCallback`. **The Settings page throws `useCallback is not defined` on mount** — it ships broken, not merely untyped. This is the highest-value one-line fix in the repository.

**[fixed in P0.1]** `useCallback` added to the import. The other 11 errors were unused symbols: five genuinely-unused imports were deleted, four dead `loading` values were wired into their pages' render branches, and two in `lib/api.ts` turned out to mark a real bug (see D9).

### 2.2 A backend test fails, and it exposes a real design weakness

`tests/security.test.js:55` asserts `hasPermission(resolveEffectiveRole("member", "developer"), "task", "create") === true`. It returns `false`. Reproduced directly:

```
resolveEffectiveRole('member','developer')            => 'workspace_developer'
hasPermission('workspace_developer','task','create')  => false
```

Two distinct defects:

1. **The test is wrong.** `resolveEffectiveRole(systemRole, workspaceRole, projectRole)` takes three arguments; `"developer"` is a *project* role passed in the *workspace* slot. Passed correctly (`resolveEffectiveRole('member', null, 'developer')`) it resolves to `developer` and returns `true`.
2. **The permission layer degrades silently.** An unrecognised role key (`workspace_developer`) is not rejected — `hasPermission` falls back to `RolePermissions["member"]`. A typo'd or unmapped role therefore quietly receives *member* privileges instead of failing closed and being surfaced. The sibling assertion on line 51 "passes" only by the same accident.

**[fixed in P0.1]** Both: the test now passes project roles in the third argument, and `hasPermission` denies an unmapped role and logs a warning naming it, instead of inheriting `member`. Three focused tests were added covering role-precedence, fail-closed behaviour for unmapped keys, and wildcard resolution — 6 subtests became 10.

Note the behavioural consequence: a project member carrying the legacy role `"admin"` (absent from `AvailableProjectRoles`, but still special-cased in `isProjectAdmin`) previously received `member` permissions and is now denied, with a warning logged. This is the intended fail-closed direction, but it is a real change for any legacy data.

## 3. Backend

### 3.1 What genuinely works and should be kept

The backend is the stronger half of the codebase and its core shape is sound. Keep as-is:

- **Layered request pipeline** — `VerifyJWT → requireProjectMember/requireWorkspaceMember → rbac(resource, action) → audit(entity, action) → controller`, composed declaratively per route. `routes/task.routes.js` is a genuinely good reference implementation.
- **Three-tier role model** — system / workspace / project roles collapsed by `resolveEffectiveRole()` into one key checked against a `RolePermissions` matrix with `*:*` and `resource:*` wildcards (`utils/permissions.js`). This is the right abstraction for this product.
- **Centralised enums** — `utils/constants.js` is the single source for statuses, issue types, priorities, notification and audit actions, board columns and story points; models import from it rather than hardcoding strings.
- **Consistent response/error contract** — `asynchandler` + `ApiError` + `ApiResponse`, with a global handler in `app.js` mapping `CastError`→400, duplicate key `11000`→409, `ValidationError`→400, and leaking stacks only in development.
- **Indexing is thorough** — 40+ purposeful compound indexes, a `title`/`description` text index on tasks, a unique `{workspace, key}` on projects, a unique sparse `{project, issueNumber}` on tasks, and a 365-day TTL on audit logs. Unusually good for a project at this stage.
- **Structured logging** — winston to `logs/error.log` + `logs/combined.log`, with morgan piped through it.
- **Security work already landed** (per `backend/docs/backend-improvements.md`, spot-verified): generic login failures, uniform forgot-password response, `isActive` enforcement on every request, `escapeRegex` on all search input, `clampPagination`, cascade delete of project children.

### 3.2 Authorization is applied inconsistently

Guard coverage per router, counted mechanically:

| Router | JWT | `rbac()` | membership | `audit()` | body validation |
|---|---|---|---|---|---|
| `task` | ✅ | 8 | 9 | 6 | ❌ |
| `project` | ✅ | 9 | 8 | 8 | ❌ |
| `sprint` | ✅ | 9 | 2 | 5 | ❌ |
| `workspace` | ✅ | 0 | 6 | 0 | ❌ |
| `comment` | ✅ | 0 | 2 | 0 | ❌ |
| **`note`** | ✅ | **0** | **0** | **0** | ❌ |
| `admin` | ✅ | 0 (`requireRole`) | — | 0 | ❌ |
| `search` / `dashboard` / `notification` | ✅ | 0 | — | 0 | ❌ |

- **B1 (P0):** `note.routes.js` carries no middleware beyond `VerifyJWT`. This is *not* an IDOR — `note.controller.js` re-checks `isProjectMember` / `isProjectAdmin` by hand in all five handlers — but that is duplicated authorization logic living in the wrong layer, unaudited, and invisible at the route. `backend-improvements.md` claims "Use RBAC Consistently [COMPLETED ✅]"; notes, comments and workspaces contradict that claim.
- **B2 (P0):** `admin.routes.js` gates every endpoint on `requireRole("super_admin", "product_manager")`, so a **product manager can change other users' system roles, deactivate accounts, and read the full audit log**. The permission matrix grants `product_manager` no `user:*` rights at all, so the route guard is strictly more permissive than the model it is meant to enforce.
#### Legacy `admin` project role — audit conclusion (P0.2)

P0.1 made `hasPermission` deny unmapped roles, which raised the question of whether persisted project members could carry the legacy role `"admin"`. Investigated without changing behaviour:

| Evidence | Finding |
|---|---|
| `project.models.js:78-82` | `members[].role` has `enum: AvailableProjectRoles`; `"admin"` is **not** in it |
| Offline schema validation | `role: "admin"` → **REJECTED**: "`admin` is not a valid enum value for path `role`" |
| Writers of `"admin"` in the codebase | Exactly one: `seed.js:44` — and that write **already failed validation** (B23) |
| `permissions.js:21` (`isProjectAdmin`) | Still special-cases `m.role === "admin"`; dead for any schema-valid document |
| `permissions.js:44` (`user.role === "admin"`) | Dead — the User model has no `role` field (B24) |
| `WorkspaceRolesEnum.ADMIN = "admin"` | A **different**, legitimate role. `workspace_admin` is mapped and unaffected. |

**Conclusion: `"admin"` cannot occur as a project role in supported data.** The schema rejects it, and the only code that attempted to write it was itself failing. No migration is warranted, and the legacy role was **not** re-enabled — fail-closed behaviour stands, and `backend/tests/taskStatus.test.js` now asserts `"admin"` is not a valid project role.

**One caveat, stated because it could not be checked:** documents written *before* the current enum existed could in principle still hold `"admin"`, and the live database could not be inspected from this environment (MongoDB is unreachable — see [QA_CHECKLIST.md](QA_CHECKLIST.md)). A read-only confirmation to run where the DB is reachable:

```js
db.projects.countDocuments({ "members.role": { $nin: [
  "project_manager","scrum_master","team_lead","developer","qa","client","viewer"
] } })
```

If that returns 0, the conclusion holds outright. If not, the smallest safe normalisation is a targeted `updateMany` mapping `members.$[m].role: "admin"` → `"project_manager"` (the closest equivalent in the current matrix), run once, with the affected `_id`s recorded first. No destructive migration is needed either way.

- **B3 (P1):** mutations on `workspace`, `comment` and `note` write no audit entry — so precisely the governance-relevant actions (inviting members, changing workspace roles) are the ones not recorded.

### 3.3 Validation

- **B4 (P0):** only the five **auth** endpoints validate their request bodies. `validator.index.js` contains nothing else. Every project, task, sprint, comment, note, workspace and admin mutation accepts an arbitrary body, relying on Mongoose schema casting as a de-facto validator.
- **B5 (P1):** `validateObjectId` exists in `middlewares/validator.middleware.js` and is imported **zero** times. Malformed ids are caught only downstream as `CastError`→400, so behaviour is acceptable but the intended guard is dead code.
- **B6 (P1):** `userRegisterValidator` has a stray double brace (`() => {{ return [...] }}`) — it happens to work, but the password rule is `notEmpty()` only: no length or complexity requirement anywhere.

### 3.4 Data layer

- **B7 (P0):** **no transactions anywhere** (`startSession`/`withTransaction`: 0 hits). `deleteProject` cascades deletes across `Task`, `Sprint`, `Note`, `Comment` and `AuditLog` as independent calls; a mid-sequence failure leaves permanently orphaned documents. Task creation separately does `findByIdAndUpdate($inc: taskSequence)` and then creates the task — a crash between the two burns an issue number.
- **B8 (P1):** `User.password` has no `select: false`. Every query must remember `-password`; correctness depends on ~6 hand-written projections staying correct forever.
- **B9 (P1):** `refreshToken` is stored **in plaintext** on the user document. A database read yields directly usable session credentials.
- **B10 (P1):** the single-slot `refreshToken` field means one session per user — logging in on a second device silently invalidates the first.
- **B11 (P2):** `project.models.js:126` re-declares a board-column status enum inline as `["todo","in_progress","done"]`, bypassing `StatusCategoryEnum` — the one place the "enums live in constants.js" rule is broken.

### 3.5 Dead and unused backend code

- **B12 (P1):** `models/label.models.js` and `models/approval.models.js` are **fully dead** — schemas, indexes and exported models with zero importers, no controllers, no routes. `constants.js` carries their supporting enums (`ApprovalStatusEnum`, `AvailableApprovalStatuses`) and `RolePermissions` grants `label:*` rights to seven roles for a resource that does not exist.
- **B13 (P1):** `activity.models.js` is written by `notification.handler.js` but never read by any endpoint — activity is recorded and then discarded.
- **B14 (P1):** the `/api/v1/search` router, the entire `/api/v1/admin` router, `/api/v1/notes`, and the sprint `burndown` and `velocity` endpoints have **no frontend caller** (see §5.2).
- **B15 (P2):** `backend/readme.md` was a stale PRD describing a three-role system, three task statuses, and "file upload security with Multer middleware" — **multer is not a dependency** and no upload route exists, although `task.models.js:164` defines `attachments: [attachmentSchema]`. **[fixed 2026-09-29]** the file was renamed to `backend/README.md` and rewritten against the actual implementation; a root `README.md` and a real `frontend/README.md` (previously the untouched Vite template) were added. Attachments remain a schema-only, non-existent feature and are now listed as a known limitation rather than a feature.

### 3.6 Operational concerns

- **B16 (P1):** `rateLimiter.middleware.js` performs a **top-level `await client.connect()`** on Redis at import time. Module initialisation — and therefore server startup — blocks on a network round trip, and `app.js` imports it first.
- **B17 (P1):** `/healthcheck` returns a static 200 without touching MongoDB or Redis, so it cannot serve as a real readiness probe.
- **B18 (P1):** `eventBus.safeEmit()` wraps a synchronous `emit` in try/catch. `EventEmitter` dispatches synchronously, so a **rejected promise inside an async listener escapes the guard entirely** and becomes an unhandled rejection. The bus is also in-process only, with no persistence or retry — it will silently drop notifications under a multi-instance deployment.
- **B19 (P1):** `seed.js` calls `deleteMany({})` on `User` and `Project` with no environment guard. Run against a production `MONGO_URL`, it destroys the database. **[fixed in P0.2]** it now refuses when `NODE_ENV=production` and requires an explicit `--force` (or `SEED_CONFIRM=true`) before deleting anything.
- **B23 (P0, new — found during P0.2):** **`npm run seed` could never succeed.** The documented seed command failed **three** schema validations at once: `Project.workspace` (required) and `Project.key` (required) were never set, and members were written with `role: "admin"`, which is not in `AvailableProjectRoles`. Verified by validating the exact document shape offline. **[fixed in P0.2]** the script now creates a `Workspace` first, sets `key`, uses `ProjectRolesEnum.PROJECT_MANAGER`, and seeds default board columns. Combined with B19's missing guard, this was both broken *and* dangerous.
- **B26 (P0, new — found 2026-09-29 while building the themed UI):** **task creation failed across tenants.** `task.models.js` declared `issueKey` as `unique: true` (globally), but issue keys are derived from the project key, and project keys are only unique *per workspace* (`{workspace, key}`). Two workspaces each owning a project keyed `PAY` both generate `PAY-1`, so the second workspace's **very first task** was rejected with a 409 duplicate-key error. Reproduced on a clean database: user A → `SHARED-1` (201); user B, same project key → **409**. **[fixed]** the global unique constraint was removed and `issueKey` is now a plain lookup index; per-project uniqueness is already guaranteed by the existing `{project, issueNumber}` unique index. Same class of defect as B25.
  ⚠️ **Migration note:** Mongoose creates indexes but never drops them. The obsolete `issueKey_1` unique index still exists in any database that has already been started with the old schema, and must be dropped by hand: `db.tasks.dropIndex("issueKey_1")`.
- **B25 (P1, new — reproduced during P0.2c):** **workspace names are globally unique.** `workspace.slug` is declared `unique: true` and the slug is derived from the name, so once *any* user creates a workspace called "Marketing", no other user in the system can. Reproduced against a clean database: user A → 201, user B with the same name → **409 "Workspace with this name already exists"**. For a multi-tenant product this is wrong; uniqueness should be scoped (per owner or per organisation). Not changed here — it needs a schema/index decision and a plan for existing slugs.
- **B24 (P2, new — found during P0.2):** `permissions.js:44` tests `user.role === "admin"`, but the User model has no `role` field — only `systemRole`. The condition is permanently `undefined` and therefore dead. Harmless (it fails closed), but misleading: it reads as a second admin bypass that does not exist. Not changed in P0.2 to keep the phase scoped.
- **B20 (P2):** `env.js` validates only `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` (plus `MONGO_URL` in production). `ACCESS_TOKEN_EXPIRY` / `REFRESH_TOKEN_EXPIRY` are unvalidated and passed straight to `jwt.sign`; if absent, tokens never expire.
- **B21 (P2):** `.env.sample` sets `PORT=8000`, `index.js` defaults to `3000`, and the frontend defaults to `:8000`. A developer who omits `PORT` gets a silently broken integration.

### 3.7 Token handling

`backend-improvements.md` claims *"Stop Returning JWTs in JSON When Using Cookies [COMPLETED ✅]"*. It was not completed: `auth.controllers.js:148` and `:272` still return `accessToken` and `refreshToken` in the JSON body alongside the httpOnly cookies, and `AuthContext.tsx` + `api.ts` persist the access token to `localStorage`.

- **B22 (P0):** the access token is readable by any script on the page, forfeiting the entire benefit of the httpOnly cookie it is issued next to. The refresh token is *also* echoed into the body, though the client at least ignores it.

## 4. Frontend

### 4.1 What works

Routing, auth bootstrap and the API client are well-shaped and worth keeping:

- `main.tsx` declares a clear public/protected split: `/`, `/login`, `/register`, then `/dashboard` behind `ProtectedRoute` → `DashboardLayout` with nested child routes.
- `context/AuthContext.tsx` bootstraps the session from `GET /auth/current-user` and exposes `login`/`register`/`logout`/`refreshUser`/`updateUser` via `useAuth`.
- `lib/api.ts` is the single HTTP entry point: bearer header, `credentials: "include"`, and a **transparent one-shot retry through `/auth/refresh-token` on any 401** with an `isRefreshing` guard. Every page uses it; there are no stray `fetch` calls.
- Pages are genuinely wired to the backend — 12 pages/components issue 47 real API calls. This is a working application, not a mockup.

### 4.2 The styling approach blocks responsiveness and accessibility

Counted across `frontend/src`:

| Signal | Count |
|---|---|
| Inline `style={{…}}` | **905** |
| `className=` | 90 |
| `@media` rules in `index.css` | **0** |
| Tailwind responsive prefixes (`sm:`/`md:`/`lg:`) | **5** |
| `aria-*` attributes across all 11 pages | **0** |
| `onClick` handlers / `<button>` elements | 110 / 86 |

- **C1 (P0):** Tailwind v4 is installed and configured, then bypassed. Layout lives in ~905 inline style objects, and **inline styles cannot express media queries** — so a responsive UI is not merely unfinished, it is unreachable without changing the styling mechanism. There is no mobile layout at any breakpoint.
- **C2 (P0):** zero `aria-*` attributes anywhere, no skeleton states, and 24 more `onClick` handlers than `<button>` elements (non-semantic clickable `div`s are not keyboard-reachable and expose no role). Modals (`CreateProjectModal`, `CreateTaskModal`) have no focus trap, no `role="dialog"`, and no Escape handling.
- **C3 (P1):** `styles/tokens.ts` (`C`, `FONT`) is a sound, genuinely minimal dark palette — black/near-black surfaces, neutral greys, one amber accent. **Keep the token values**; the defect is the delivery mechanism, not the design language. Tokens are also dark-only, with no light theme and no contrast audit.

### 4.3 Structure and data fetching

- **C4 (P1):** god components. `Hero.tsx` is **908 lines** of marketing animation; `Dashboard.tsx` 778; `Settings.tsx` 636; `Tasks.tsx` 622; `DashboardLayout.tsx` 534. Business logic, data fetching, layout and styling are interleaved in each.
- **C5 (P1):** no data-fetching layer. Every page repeats `useEffect` + `api.get` + local `useState`, so there is no request deduplication, no cache, no shared invalidation, and refetch-after-mutation is hand-rolled per call site.
- **C6 (P1):** loading state is declared and then ignored in four pages — `Projects.tsx:199`, `Tasks.tsx:182`, `Team.tsx:124`, `Workspaces.tsx:10` all assign `loading` and never read it, so each page renders its "nothing here yet" empty state during the first fetch. **[corrected]** the original audit said "only one page renders an empty state" — that was wrong: six pages do (`Dashboard`, `Projects` ×2, `Settings`, `TaskDetail`, `Tasks` ×2, `Workspaces` ×2). The accurate gap is that **no page renders a skeleton**, and the empty states that exist are shown at the wrong time.
  **[partly fixed in P0.1]** all four `loading` values are now consumed via a shared `components/LoadingState.tsx`, so the empty-state flash is gone. Skeletons remain P0.7.
- **C7 (P1):** no `ErrorBoundary`, and **no catch-all `*` route** — an unknown URL renders a blank page.
- **C8 (P1):** errors are swallowed in `AuthContext.tsx:41` and `Login.tsx:58` (`catch { }` with an unused binding), so a genuine network failure is indistinguishable from "not logged in".
- **C9 (P2):** `motion-primitives/text-effect.tsx` has two `no-unsafe-optional-chaining` warnings that can throw `TypeError`. Both `framer-motion` **and** `motion` are installed — the same library twice.
- **C10 (P1, new — found during P0.1):** the board's status keys do not match the backend enum. `Tasks.tsx` declares `STATUS_CONFIG` with a **`review`** column, while `TaskStatusEnum` uses **`in_review`**. The Review column therefore never matches a task, and dragging a card into it persists `status: "review"` — a value absent from the schema enum, so the write fails with a Mongoose `ValidationError` → 400.
  **[fixed in P0.2]** The backend enum was confirmed canonical (`updateTask` correctly syncs `statusCategory`, `completedAt` and `stateTransitions`), so the defect was entirely frontend. **Four** separate status definitions existed — `Tasks.tsx`, `TaskDetail.tsx`, `CreateTaskModal.tsx` and the board's column list — and all now derive from one module, `frontend/src/lib/taskStatus.ts`. Two statuses were also **missing** from the board: `backlog` (which the backend assigns whenever a task leaves a sprint, so those tasks were invisible) and `cancelled`. All seven canonical statuses are now columns. `backend/tests/taskStatus.test.js` fails if the backend enum drifts from the frontend mirror.
- **C13 (P0, new — reproduced in a browser during P0.2c):** **the mobile layout is broken, not merely unstyled.** At Pixel 7 width the top bar's search input overlaps the action buttons and intercepts their clicks; Playwright reports the button as "visible, enabled and stable" yet unclickable because the input "intercepts pointer events". Three of six E2E tests fail on mobile for this reason alone. This makes C1 concrete: inline styles with fixed pixel widths cannot reflow. Not fixed — it belongs to the P0.7 migration.
- **C11 (P2, new):** the production bundle is a single **623 kB** chunk (174 kB gzipped) and Vite warns about it. `Hero.tsx` (908 LOC of landing-page animation) is the obvious candidate to code-split away from the authenticated app.
- **C12 (P1, new — found during P0.2):** failed mutations were invisible. `Tasks.tsx` reverted an optimistic status change with `console.error` only, so a rejected drag looked like a UI glitch; `TaskDetail.tsx` swallowed save and subtask failures the same way. **[fixed in P0.2]** a shared `ErrorBanner` (`role="alert"`) now reports them, and the revert is explained rather than silent.

## 5. Frontend ↔ backend integration

### 5.1 Broken user-facing flows

- **D1 (P0):** **password reset dead-ends.** `Login.tsx` posts to `/auth/forgot-password`, the backend emails a link to `FORGOT_PASSWORD_REDIRECT_URL` (`http://localhost:5173/auth/reset-password`), and **no such frontend route exists**. The user lands on a blank page, so no password can ever be reset.
- **D2 (P0):** **email verification dead-ends** identically. `GET /auth/verify-email/:token` exists server-side with no page to receive it, and `/auth/resend-email-verification` has no caller.
- **D3 (P0):** `Settings.tsx` crashes on mount (§2.1).
- **D4 (P1):** OAuth is configured server-side (passport Google + GitHub strategies, callback routes) and `SocialButtons.tsx` exists, but the callback success path has no frontend route to land on.

### 5.2 Duplicated logic and unused APIs

- **D5 (P1):** **global search is implemented twice, and the worse implementation is the one that runs.** `DashboardLayout.tsx:194` fetches `/projects` and filters the full list in the browser by name/key/description. Meanwhile `/api/v1/search` already exists server-side with multi-entity search across tasks, projects, users and notes, membership scoping, `escapeRegex` and the Mongo text index — and has **no caller**. Delete the client-side filter; call the endpoint.
- **D6 (P1):** there is no admin UI, so `/api/v1/admin/*` (user list, role changes, status changes, analytics, audit log) is unreachable. Same for `/api/v1/notes` and the sprint `burndown`/`velocity` analytics.
- **D7 (P1):** `clampPagination` is used in `task.controller.js` only. Projects, comments, notifications and the audit log return unbounded lists, and the frontend renders no pagination controls.
- **D10 (P1, new — found during P0.2c):** **creating a project from the global top-bar button left the list stale.** `DashboardLayout`'s modal succeeded (`POST /projects` → 201) and then called `navigate("/dashboard/projects")` — a no-op when already on that route, so nothing refetched and the page kept showing "No projects found" directly after a successful create. Found because an E2E test asserted the new project became visible. **[fixed in P0.2c]** the modal now passes a changing `projectCreatedAt` in router state and `Projects.tsx` refetches on it. Note there are two separate `CreateProjectModal` instances (top bar and page), and only the page's had a refetch handler.
- **D9 (P1, new — found during P0.1):** **queued requests hung forever after a failed token refresh.** While one refresh was in flight, `lib/api.ts` parked concurrent 401s in a subscriber list; on failure it cleared that list *without settling the promises*, so every queued request stayed pending indefinitely — a silently frozen UI rather than a redirect to login. The two "unused variable" errors at `api.ts:129-130` were the symptom: the `reject` handle was captured and discarded. **[fixed in P0.1]** subscribers are now notified with `null` on failure and reject with a 401.
- **D8 (P2):** response unwrapping is defensive everywhere (`res?.data || res || []`, and `AuthContext` probing both `res.data` and `res.user`), which indicates the `ApiResponse` envelope is not trusted to be uniform. There are no shared TypeScript types for any API payload — every response is `any`.

## 6. Missing capabilities for a project-management product

The backend data model is markedly more capable than the UI on top of it. Gaps, split by whether the backend already supports them:

**[corrected]** The original audit listed the Kanban board as missing. It is not: `Tasks.tsx` renders a **working board with HTML5 drag-and-drop** (`draggable` cards, `onDrop` per column) that optimistically updates task status, plus a list view toggle. What it lacks is alignment with the backend — it hardcodes its own five columns instead of reading the project's `DEFAULT_BOARD_COLUMNS`, and one column key is simply wrong (C10). Treat the board as *partially implemented*, not absent.

**Backend ready, no UI** — labels (`label:*` permissions, dead model), task dependencies (`IssueLinkTypeEnum`, `blocks`/`blocked_by` defined), activity feed (written, never read), audit-log viewer, notes, sprint burndown/velocity charts, epic hierarchy (`epicLink`, `parent`), story points (`FIBONACCI_POINTS`), workload/overdue views (`dueDate` indexed).

**Neither layer** — attachments (schema field only; no multer, no storage), real-time updates (no WebSocket; the notification bell is poll-only), saved filters/views, bulk task operations, CSV/export, time tracking, presence, `@mention` autocomplete (mention *notifications* exist in the enum).

## 7. Consolidated risk register

| ID | Severity | Finding |
|---|---|---|
| A1 | ~~P0~~ | ✅ **fixed in P0.1** — `.gitmodules` added; clone resolves |
| §2.1 | ~~P0~~ | ✅ **fixed in P0.1** — typecheck clean, build succeeds |
| §2.2 | ~~P0~~ | ✅ **fixed in P0.1** — tests pass; unmapped roles now fail closed |
| D9 | ~~P1~~ | ✅ **fixed in P0.1** — queued requests no longer hang after a failed refresh |
| C10 | ~~P1~~ | ✅ **fixed in P0.2** — one canonical status module; all 7 statuses on the board |
| B23 | ~~P0~~ | ✅ **fixed in P0.2** — `npm run seed` failed 3 schema validations; now works |
| B19 | ~~P1~~ | ✅ **fixed in P0.2** — seed refuses in production and without `--force` |
| C12 | ~~P1~~ | ✅ **fixed in P0.2** — failed mutations now surface instead of reverting silently |
| Browser verification | ~~P0~~ | ✅ **P0.2c** — Playwright + ephemeral MongoDB; 6/6 desktop pass |
| D10 | ~~P1~~ | ✅ **fixed in P0.2c** — project list no longer stale after creation |
| **C13** | **P0** | **Mobile layout broken** — search input blocks button clicks at phone width (3/6 E2E fail) |
| B26 | ~~P0~~ | ✅ **fixed 2026-09-29** — globally-unique `issueKey` broke task creation for a second tenant |
| **B25** | **P1** | **Workspace names globally unique** — one user's name blocks every other user |
| C1/C13 | **P0** | Mobile layout still broken; the theme layer is in place but pages are not yet converted to Tailwind |
| B1 | **P0** | `note` routes bypass the RBAC/audit pipeline; authz duplicated in controllers |
| B2 | **P0** | `product_manager` can change roles / deactivate users / read audit log |
| B4 | **P0** | Only auth endpoints validate request bodies |
| B7 | **P0** | No transactions behind multi-document cascade deletes and counter increments |
| B22 | **P0** | Access token returned in JSON and stored in `localStorage` |
| C1 | **P0** | 905 inline styles, 0 media queries — no responsive layout is possible |
| C2 | **P0** | Zero `aria-*`, non-semantic clickables, modals without focus management |
| D1, D2, D3 | **P0** | Password reset, email verification and the Settings page are all broken |
| B3, B5, B6, B8–B10, B12–B14, B16–B19, C4–C8, D4–D7 | P1 | See sections above |
| A3, B11, B15, B20, B21, C9, D8 | P2 | See sections above |

## 8. Documentation accuracy

`CLAUDE.md` (root) is accurate. Two existing documents are not, and should be corrected rather than trusted:

- ~~**`backend/readme.md`**~~ — ✅ rewritten 2026-09-29 as `backend/README.md`. It had described 3 roles vs the 4/4/7 tiers actually implemented, 3 task statuses vs 7, and a multer upload feature that does not exist.
- **`backend/docs/backend-improvements.md`** — marks items `[COMPLETED ✅]` that are not: "Stop Returning JWTs in JSON" (§3.7) and "Use RBAC Consistently" (§3.2).
