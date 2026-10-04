# Target Architecture

Companion to [PROJECT_AUDIT.md](PROJECT_AUDIT.md) and [PRODUCTION_ROADMAP.md](PRODUCTION_ROADMAP.md).

**Position:** the existing architecture is largely correct and is kept. The backend's layered pipeline, three-tier RBAC model, centralised enums, response envelope and indexing strategy are all sound and stay. The frontend's routing, auth context and single API client stay. **One mechanism is replaced** (inline styles → Tailwind), **one is introduced** (a frontend data-fetching layer), and the rest is refactoring and completion.

No new runtime dependency is proposed for the backend. Two are proposed for the frontend, each justified below.

---

## 1. Verdict table

| Area | Verdict | Rationale |
|---|---|---|
| Express 5 + Mongoose, ESM, no build step | **Keep** | Appropriate; nothing about the product needs more. |
| `asynchandler` / `ApiError` / `ApiResponse` envelope | **Keep** | Consistent and already universal. Make the client trust it (D8). |
| Global error handler with Mongoose error mapping | **Keep** | Correct behaviour, including dev-only stacks. |
| `rbac()` + membership guards + `audit()` pipeline | **Keep, apply uniformly** | The pattern is right; three routers bypass it (B1). |
| `resolveEffectiveRole` / `RolePermissions` matrix | **Keep, fail closed** | Only change: unmapped role denies instead of inheriting `member` (§2.2). |
| `utils/constants.js` as the enum source | **Keep** | Move the one inline enum in (B11). |
| Mongoose index strategy | **Keep** | Genuinely thorough; no change needed. |
| Winston + morgan logging | **Keep** | Add request correlation ids. |
| `express-rate-limit` + optional Redis | **Keep, refactor init** | Off top-level `await` (B16). |
| In-process `EventEmitter` bus | **Keep for single-instance; refactor** | Fix async rejection handling (B18). Durable queue only if multi-instance. |
| `validateObjectId` / `clampPagination` / `escapeRegex` | **Keep, actually use** | Written and unused (B5, D7). |
| No transactions | **Introduce** | Required for cascade deletes and counter allocation (B7). |
| `label` / `approval` models | **Remove or complete** | Dead as written (B12). |
| Attachments schema field | **Remove or complete** | No multer, no route, no storage (B15). |
| `backend/readme.md` PRD | ~~Replace~~ ✅ **done 2026-09-29** | Was materially wrong (§8); rewritten as `backend/README.md`, plus new root and frontend READMEs. |
| React 19 + Vite + react-router | **Keep** | Fine for this product. |
| `AuthContext` + `ProtectedRoute` | **Keep, extend** | Add the missing public auth routes (D1, D2, D4). |
| `lib/api.ts` single client + 401 refresh | **Keep, simplify** | Cookie-only auth deletes the bearer/`localStorage` path (B22). |
| `styles/tokens.ts` palette values | **Keep** | Good minimal black/neutral/one-accent system (C3). |
| Inline `style={{}}` as the styling mechanism | **Replace** | Cannot express media queries; blocks responsive + a11y P0s (C1). |
| Per-page `useEffect` + `useState` fetching | **Replace** | No cache, no dedupe, no invalidation (C5). |
| God components | **Refactor** | 908/778/636/622/534 LOC files (C4). |
| `framer-motion` **and** `motion` | **Remove one** | Same library twice (C9). |
| No CI, no Dockerfile, no `.gitmodules` | **Introduce** | §2, A1. |

---

## 2. Backend architecture

### 2.1 Layering — keep, with one addition

```
route  →  guards  →  validation  →  controller  →  model
             │            │             │
      VerifyJWT      express-       thin: orchestrate,
      requireMember   validator      respond
      rbac()          + validateObjectId
      audit()
```

Controllers stay thin and keep orchestrating directly against models. **No service layer is introduced** for the current controller sizes (66–476 LOC); it would add indirection without removing duplication. The two exceptions where shared logic already exists are `utils/permissions.js` and `utils/helpers.js` — extend those rather than creating a `services/` tier.

The one structural addition is a **transaction boundary** for multi-document writes. Applied at the controller level with `mongoose.startSession()` around exactly two operations today — `deleteProject`'s cascade and task-number allocation — not as a blanket wrapper. Note this requires a MongoDB replica set; single-node deployments must either run as a one-node replica set or accept documented non-atomic cascades.

### 2.2 Authorization model — unchanged, uniformly applied

Three tiers resolved to one effective role, then checked against the matrix:

```
systemRole    super_admin | hr | product_manager | member
workspaceRole owner | admin | member | guest          → workspace_<role>
projectRole   project_manager | scrum_master | team_lead | developer | qa | client | viewer
```

Resolution precedence stays: `super_admin`/`hr`/`product_manager` short-circuit → else project role → else `workspace_<role>` → else system role.

Two changes only:

1. **Fail closed.** An effective role absent from `RolePermissions` denies and logs, rather than falling back to `member`.
2. **Uniform application.** Every project- or workspace-scoped router gets `rbac()` + membership guard + `audit()` at the route. Controllers stop re-deriving authorization (B1).

Authorization is enforced server-side only. The frontend may *read* permissions to hide affordances, but never as the enforcement point.

### 2.3 Authentication flow — target

```
POST /auth/login
  → validate → verify credentials → check isActive
  → issue access JWT (short) + refresh JWT (long)
  → Set-Cookie: accessToken, refreshToken  (httpOnly, secure in prod, sameSite)
  → body: { user }        ← tokens NOT in body

any request → VerifyJWT reads the accessToken cookie
401 → client POSTs /auth/refresh-token (cookie only)
  → compare SHA-256 digest against the user's stored session list
  → rotate: issue new pair, replace that session entry
  → retry original request once
logout → clear cookies, remove that session entry
```

Session storage moves from a single `refreshToken` string to an array of `{tokenHash, createdAt, userAgent}`, enabling concurrent devices (B10) and per-session revocation. Password change or reset clears all entries.

### 2.4 Validation strategy

Two layers, both mandatory for every mutation:

1. **Shape** — express-validator chains in `validators/`, one module per resource, mirroring the existing auth module's style. Rejects with 422 via the existing `validate`.
2. **Identity** — `validateObjectId` on every `:id` route param, rejecting with 400 before any database call.

Cross-document relationship checks (assignee is a project member, `parentTask` belongs to the same project) stay in controllers — they need database context that validators do not have. That logic already exists and is correct.

### 2.5 Error handling, logging, audit, notifications

- **Errors** — unchanged. `asynchandler` + `throw new ApiError(...)` + the global mapper. Nothing is swallowed; every handler either responds or throws.
- **Logging** — winston stays. Add a request id per request, log it on every line, and return it in error responses so a user-reported failure is traceable.
- **Audit** — the `audit()` middleware pattern stays (intercepting `res.json`, fire-and-forget write, 365-day TTL). Extend to workspace, comment and note mutations (B3). `trackChanges()` stays the way controllers record field diffs.
- **Notifications** — `eventBus.safeEmit(Events.X, payload)` from controllers, handled in `events/handlers/`. Fix async rejection handling. Keep in-process while single-instance; if the deployment scales horizontally, the same `Events` contract moves behind a durable queue with no controller changes.
- **Activity** — the `Activity` model is already written; add read endpoints and surface it (B13).

### 2.6 Data model

Entities and relationships as they exist today — no redesign warranted:

```
User ──┬── Workspace.members[] ──── Workspace
       │                                │
       └── Project.members[] ──────── Project ──┬── Sprint ──┐
                                        │        │            │
                                        │        └── Task ────┘ (sprint, parent, epicLink, links[])
                                        │             │
                                        │             ├── subtasks[]
                                        │             ├── attachments[]  (schema only)
                                        │             └── Comment (threaded via parentComment)
                                        ├── Note
                                        └── Label      (dead)

Cross-cutting: Notification · Activity · AuditLog · Approval (dead)
```

Changes: `select: false` on `User.password`; hashed session array replacing `refreshToken`; the inline board-status enum moved to `constants.js`; `Label`/`Approval`/`attachments` either completed or removed.

### 2.7 Caching

**None introduced.** No measured hot path justifies it, the indexes are strong, and Redis is already present for rate limiting if a real bottleneck is later measured. Pagination (D7) is the correct first response to large result sets, not caching.

---

## 3. Frontend architecture

### 3.1 Target structure

```
src/
  lib/api.ts          single HTTP client (keep; simplify to cookie-only)
  lib/types.ts        shared API payload types          ← introduce
  context/            AuthContext (keep)
  hooks/              data hooks per resource           ← introduce
  components/ui/      Button Input Select Modal Card Table Badge
                      Avatar Toast Skeleton EmptyState  ← introduce
  components/<domain>/ project/, task/, workspace/      (regroup existing)
  pages/              thin composition only             (shrink existing)
  styles/tokens.ts    palette values (keep) → Tailwind theme
```

Pages compose; hooks fetch; `components/ui` renders. Business logic belongs in hooks and backend, not in page bodies — which is the main structural change from today's god components.

### 3.2 Styling — the one replacement

Tailwind v4 is already installed and configured, then bypassed by ~905 inline style objects. The target inverts that: **Tailwind utilities for everything, inline styles only for genuinely dynamic values** (a computed progress width, a per-label colour from the API).

The existing `tokens.ts` values become Tailwind theme tokens via `@theme`, so both mechanisms read one palette during the migration and the visual result is preserved. Migration order: `components/ui` primitives → `DashboardLayout` → pages by traffic. Each page ends responsive at mobile/tablet/desktop and keyboard-accessible before the next begins.

Design direction follows the brief and the existing palette: black and near-black surfaces, neutral greys, a single accent, consistent spacing scale, clear hierarchy. Decorative animation, gradients and glassmorphism are removed where they do not aid comprehension — `Hero.tsx` (908 LOC of marketing animation) is out of scope for the dashboard and stays confined to the landing page.

### 3.3 Data fetching — the one introduction

Per-page `useEffect` + `useState` is replaced by a **single query library** (TanStack Query) wrapping the existing `lib/api.ts`. `api.ts` remains the only code that talks HTTP.

Justification for the dependency: it removes hand-rolled loading flags (four of which are already dead code — C6), request duplication, manual refetch-after-mutation, and race conditions on rapid navigation, and it supplies cache invalidation and optimistic updates. Writing this by hand means reimplementing it worse. This is one of only two new frontend dependencies proposed.

Contract per resource: one `useX()` hook for reads, one `useXMutation()` for writes with explicit invalidation. Optimistic updates are used where the server outcome is predictable and cheap to roll back — task status changes on the board, notification read state — and nowhere else.

### 3.4 State

- **Server data** — query library cache. Not duplicated into component state.
- **Session** — `AuthContext` (keep).
- **UI state** — local `useState`, or URL search params for filter/sort/page so views are shareable and survive reload.

No global state manager is introduced; there is no state that needs one.

### 3.5 Error, loading and empty states

Every async view renders four states explicitly: skeleton → data → empty → error-with-retry. An `ErrorBoundary` wraps the router; a catch-all `*` route replaces today's blank page (C7). Errors surface to the user via a toast or inline message and are never swallowed (C8).

### 3.6 Accessibility

Baseline, enforced during the Tailwind migration rather than retrofitted: semantic elements for all interactive controls; `aria-*` only where semantics fall short; a single accessible `Modal` primitive (`role="dialog"`, focus trap, Escape, focus restore); visible focus rings; keyboard reachability for every action; contrast checked against the token palette; forms with associated labels and `aria-invalid` + `aria-describedby` on errors.

---

## 4. API boundary

Unchanged and already coherent: REST under `/api/v1/*`, plural resource nouns, nesting that mirrors ownership (`/projects/:projectId/sprints`, `/projects/:projectId/tasks/:taskId/comments`), the `ApiResponse` envelope on every response, HTTP status as the primary signal.

Three corrections:

1. **Uniform envelope, trusted by the client.** Once guaranteed, the defensive `res?.data || res || []` unwrapping and dual-shape probing disappear (D8).
2. **Typed contracts.** `lib/types.ts` mirrors every payload; no response is `any`.
3. **Pagination is part of the contract.** Every list endpoint accepts `page`/`limit` via `clampPagination` and returns `{ items, page, limit, total }` (D7).

`docs/swagger.yaml` is the published contract and must be updated with each API change — it is currently the only machine-readable description of the API.

---

## 5. Deployment architecture

Target, matched to the product's actual scale:

```
Browser ── HTTPS ──► static host (Vite build, CDN)
              │
              └──► Node/Express API (container, ≥1 instance)
                        ├── MongoDB (replica set — required for transactions)
                        └── Redis (rate limiting; optional)
```

To introduce: a Dockerfile per submodule; compose for local Mongo + Redis; one CI workflow per submodule (install → typecheck → lint → test → build); expanded `env.js` validation covering everything actually required at runtime; a `/healthcheck` that verifies MongoDB and Redis so it can serve as a readiness probe; log shipping plus an error-tracking hook.

The API is stateless apart from the in-process event bus — the one thing that breaks under horizontal scaling (B18). Single instance is fine today; scaling out requires the durable-queue decision in the roadmap's open decisions.

---

## 6. Summary of changes by verdict

- **Keep as-is** — Express/Mongoose stack, response envelope, global error handler, RBAC model and matrix, `constants.js`, index strategy, winston logging, rate limiting, React/Vite/router, `AuthContext`, `lib/api.ts` as the sole HTTP client, `tokens.ts` palette values.
- **Refactor** — apply `rbac()`/`audit()` uniformly; fail closed on unknown roles; thin the god components; Redis init off top-level await; async-safe event bus; real healthcheck; hashed multi-session refresh tokens.
- **Replace** — inline styles → Tailwind utilities; per-page `useEffect` fetching → query layer; ~~`backend/readme.md` PRD~~ (done).
- **Remove** — `label`/`approval` models (or complete them); duplicate animation library; client-side search filter; schema-only `attachments` field (or complete it); `localStorage` token storage and the bearer path; dead unused symbols.
- **Introduce** — `.gitmodules`; CI per submodule; transactions on multi-document writes; validation for every mutation; `validateObjectId` usage; pagination across list endpoints; shared UI primitives; typed API contracts; `ErrorBoundary` + 404 route; the three missing auth pages; Dockerfiles.
