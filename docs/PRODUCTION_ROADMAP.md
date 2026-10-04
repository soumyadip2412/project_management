# Production Roadmap

Derived from [PROJECT_AUDIT.md](PROJECT_AUDIT.md). Finding IDs (A1, B7, C1, D5…) refer to that document.

**Governing principle:** production-grade means correct, consistent, secure, reliable and maintainable — *not* feature-rich. Every P0 below is either a defect in something that already exists or a gap that makes existing functionality unusable. No P0 adds a new product feature. Several P1 items are *deletions*.

---

## Classification

- **P0 — essential.** The product is not shippable while any of these stand: it does not build, three user-facing flows dead-end, authorization is inconsistent, and there is no responsive or accessible layout.
- **P1 — important.** Quality, reliability and maintainability work, plus the UI surfaces for capabilities the backend already implements. Real value per unit of effort.
- **P2 — optional.** Genuinely new capability, or polish with no current blocker.

---

## P0 — Essential

### P0.1 Make the toolchain green and the repo clonable — ✅ **DONE** (2026-09-28)

| Item | Finding | Outcome |
|---|---|---|
| Add `.gitmodules` for both submodules | A1 | ✅ Added; both registered. Both submodules share one remote on branches `backend-dev` / `frontend`; both gitlinks verified present on it. |
| Fix `Settings.tsx` missing `useCallback` import | §2.1, D3 | ✅ Page no longer crashes on mount. |
| Clear the 11 `TS6133` unused-symbol errors | §2.1 | ✅ 5 unused imports deleted; 4 dead `loading` values wired into their render branches via a shared `LoadingState`; 2 were symptoms of a real bug (D9). |
| Fix `security.test.js` argument order; make unknown roles deny | §2.2 | ✅ Test corrected; `hasPermission` fails closed and logs the role. 3 focused tests added (6 → 10 subtests). |
| Backend check script + CI per submodule | §2 | ✅ `check:syntax` (zero-dependency) and `format:check` added; one workflow per submodule. |
| `.gitignore` for `graphify-out/` | A3 | ✅ Ignored. `.agents/` intentionally left tracked-visible. |

**Verified after the phase:** frontend typecheck 0 errors · lint 7 warnings / 0 errors · build succeeds · backend 10/10 tests pass · `check:syntax` parses 59 files.

**Deliberately not done in P0.1, and still open:** no backend linter (`prettier --check` fails on 57 of 59 files; ESLint would be a new dependency), no `--deny-warnings` gate on oxlint (7 pre-existing warnings belong to P1.1/P1.2), and the root gitlinks still point at older submodule commits than the working trees (A2 — needs commits, see §Git workflow).

**Two findings surfaced during P0.1** and folded into the audit: **D9** (fixed — queued requests hung forever after a failed token refresh) and **C10** (open — the board's `review` column key does not match the backend's `in_review`, so drag-to-Review returns 400).

### P0.2 — ✅ **DONE** (2026-09-28) — *scope redefined by the operator*

P0.2 as originally written here meant "close the broken auth flows". It was **redefined at execution time** to mean *fix currently broken/incorrect existing flows and establish a reliable baseline*, with the Kanban status bug as the priority. The auth-flow work below was **not** done and is re-sequenced into P0.2b.

| Item | Finding | Outcome |
|---|---|---|
| Fix the Kanban status mismatch at the right boundary | C10 | ✅ Backend enum confirmed canonical; **4** duplicate frontend definitions collapsed into `frontend/src/lib/taskStatus.ts` |
| Restore hidden statuses to the board | C10 | ✅ `backlog` (set by the backend on sprint removal) and `cancelled` were missing, hiding real tasks — all 7 statuses are now columns |
| Guard the status contract with a test | — | ✅ `backend/tests/taskStatus.test.js` fails if the backend enum drifts from the frontend mirror |
| Audit the legacy `admin` project role | §3.2 | ✅ **Cannot occur in supported data** — schema rejects it; role **not** re-enabled; caveat + read-only check documented |
| Surface failed mutations | C12 | ✅ Shared `ErrorBanner`; optimistic reverts are explained, not silent |
| Repair `npm run seed` | B23 | ✅ Was failing 3 schema validations and could never run |
| Guard the destructive seed | B19 | ✅ Refuses in production and without `--force` |

**Verified:** frontend typecheck 0 errors · lint exit 0 (7 pre-existing warnings) · build succeeds · backend **17/17** tests pass · syntax check 60 files. Built bundle confirmed to contain all seven canonical statuses.

**Not verified: any of it in a browser.** Browser verification is now a mandatory part of the workflow and has never run — the backend cannot start here because MongoDB Atlas is unreachable from this environment. Tracked in [QA_CHECKLIST.md](QA_CHECKLIST.md) and [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md). **Treat every P0.2 change as automated-verified only.**

**New findings folded into the audit:** B23 (fixed), C12 (fixed), B24 (open — a dead `user.role === "admin"` check).

### P0.2b Close the broken auth flows — deferred from P0.2

| Item | Finding |
|---|---|
| ✅ Build `/auth/reset-password/:token` page and route | D1 — done 2026-10-03 (ENGINEERING_AUDIT §21) |
| ✅ Build `/auth/verify-email/:token` page + resend affordance | D2 — done 2026-10-03 |
| ✅ Add OAuth callback landing route | D4 — the callback redirects to `/dashboard`; buttons are opt-in via `VITE_OAUTH_ENABLED` |
| Add a catch-all `*` 404 route and an `ErrorBoundary` | C7 |

### P0.2c Browser verification — ✅ **DONE** (2026-09-28)

| Item | Outcome |
|---|---|
| Ephemeral local MongoDB | ✅ `mongodb-memory-server` (backend devDependency) + `backend/scripts/e2e-server.mjs` runs the real API against a throwaway database |
| Browser automation | ✅ `@playwright/test` (frontend devDependency) + Chromium, desktop and mobile projects |
| E2E for the critical path | ✅ `frontend/e2e/critical-path.spec.ts` — **6/6 desktop pass, 3/6 mobile** |
| Isolation from real data | ✅ `frontend/.env.e2e` pins the API to `:8123`; without it Vite's committed `.env` sends tests to `:8000`, where a real backend listens |
| Wire E2E into CI | ❌ **Not possible per submodule** — E2E needs both repositories and each CI checkout has only one |

**Bugs this found that automated checks could not:** D10 (stale project list — fixed), C13 (mobile layout blocks clicks — open), B25 (workspace names globally unique — open). It also proved the P0.2 status fix works against a real API: all seven statuses persist, and `"review"` is still rejected with 400.

**Backend change it required:** rate limits are now env-tunable (`AUTH_RATE_LIMIT_MAX`, `GLOBAL_RATE_LIMIT_MAX`). Production defaults are unchanged — the E2E server raises them because the whole suite shares one IP and the 20-per-15-min auth limit blocked it.

Both dependencies are dev-only. The rejected alternative is pointing tests at the live Atlas cluster, which would write test data into real records.

### P0.3 Harden authentication

| Item | Finding | Decision |
|---|---|---|
| Stop returning tokens in the JSON body; stop storing the access token in `localStorage` | B22 | Move to cookie-only auth. `api.ts` already sends `credentials: "include"`, so the bearer header and `localStorage` mirror can both be deleted — this *removes* code. **Requires a decision** (see §Open decisions). |
| Hash the stored refresh token | B9 | Store a SHA-256 digest; compare digests on refresh. |
| Support multiple concurrent sessions | B10 | Replace the single `refreshToken` string with an array of `{tokenHash, createdAt, userAgent}`. |
| `select: false` on `User.password` | B8 | Then delete the ~6 hand-written `-password` projections. |
| Enforce a real password policy | B6 | Minimum length + composition in `userRegisterValidator` and the reset path. |
| Validate token-expiry env vars | B20 | Absent values currently mint non-expiring tokens. |

### P0.4 Make authorization uniform and server-enforced

| Item | Finding |
|---|---|
| Put `note`, `comment` and `workspace` routes behind `rbac()` + `audit()`; delete the hand-rolled checks from `note.controller.js` | B1, B3 |
| Narrow `admin.routes.js` to `super_admin`, or add explicit `user:*` permissions to the matrix if PM access is intended | B2 — **requires a product decision** |
| Audit-log every workspace/member/role mutation | B3 |

### P0.5 Validate every mutation

| Item | Finding |
|---|---|
| express-validator chains for all project, task, sprint, comment, note, workspace and admin mutations | B4 |
| Apply the existing `validateObjectId` to every `:id` param | B5 — the middleware is already written and unused |

### P0.6 Protect data integrity

| Item | Finding |
|---|---|
| Wrap `deleteProject`'s cascade in a transaction | B7 |
| Make issue-number allocation atomic with task creation | B7 |
| Guard `seed.js` against non-development environments | B19 |

### P0.7 Responsive, accessible UI

This is the largest P0 and the one that cannot be done incrementally per-page without a decision first (see §Open decisions).

| Item | Finding |
|---|---|
| Migrate layout from ~905 inline styles to Tailwind utilities driven by the existing `tokens.ts` values | C1 — inline styles **cannot** express media queries, so responsiveness is unreachable until this changes |
| Mobile/tablet/desktop layouts for `DashboardLayout` and all dashboard pages | C1 |
| Semantic elements for every interactive control; `aria-*` where semantics are insufficient | C2 |
| Accessible modal primitive: `role="dialog"`, focus trap, Escape, restore focus | C2 |
| Visible focus rings; full keyboard reachability | C2 |
| Loading, skeleton, empty and error states for every async view | C6 |

---

## P1 — Important

### P1.1 Delete what is dead

Do this before building on top of it; it is pure subtraction.

- Remove `label.models.js` and `approval.models.js` plus their orphaned enums and `label:*` matrix entries — **or** implement labels (see P1.5). Do not leave them dead. (B12)
- Remove the duplicate animation library: `framer-motion` and `motion` are both installed. (C9)
- Remove the client-side search filter in `DashboardLayout.tsx` in favour of the existing `/api/v1/search` endpoint. (D5)
- ✅ **Done (2026-09-29)** — root, backend and frontend READMEs rewritten; the stale PRD is gone. Still open: the false `[COMPLETED ✅]` claims in `backend/docs/backend-improvements.md`. (§8, B15)
- Delete the schema-only `attachments` field, or implement uploads (P2). (B15)

### P1.2 Frontend architecture

- Introduce one data-fetching layer with caching, deduplication and invalidation; retire the per-page `useEffect` + `useState` pattern. (C5)
- Break up the god components — `Hero.tsx` 908 LOC, `Dashboard.tsx` 778, `Settings.tsx` 636, `Tasks.tsx` 622, `DashboardLayout.tsx` 534. (C4)
- Extract a shared component layer: Button, Input, Select, Modal, Card, Table, Badge, Avatar, Toast, Skeleton, EmptyState. (C2, C4)
- Stop unwrapping responses defensively. (D8; the client is JavaScript since 2026-10-03, so typed payloads would mean JSDoc + `checkJs`)
- Surface errors instead of swallowing them. (C8)

### P1.3 Backend reliability

- Move Redis connection off module-import top-level `await`. (B16)
- Make `/healthcheck` verify MongoDB and Redis. (B17)
- Fix `eventBus.safeEmit` to catch async listener rejections; decide whether the in-process bus is sufficient for the target deployment. (B18)
- Paginate projects, comments, notifications and the audit log with the existing `clampPagination`. (D7)
- Move the inline board-status enum in `project.models.js:126` into `constants.js`. (B11)
- Reconcile the `PORT` mismatch across `.env.sample`, `index.js` and the frontend default. (B21)

### P1.4 Testing

Currently one test file, six subtests, one failing — all pure-unit over two utility modules. Needed:

- API integration tests per router covering authz matrices (member / non-member / wrong-role / super-admin) and validation rejection.
- Unit tests for `resolveEffectiveRole` / `hasPermission` across all three tiers, including unmapped roles.
- Component tests for auth flows, task CRUD and the new modal primitive.
- One end-to-end pass: register → verify → create workspace → create project → invite → create task → comment → complete sprint.

### P1.5 Surface what the backend already supports

Each item is UI-only; the API exists.

| Feature | Backing that already exists |
|---|---|
| Board / Kanban view — **already partly built**: fix the `review`/`in_review` key mismatch (C10), then read columns from the project instead of hardcoding five | `DEFAULT_BOARD_COLUMNS`, `statusCategory`, `{project,status}` index |
| Server-side search UI with filter/sort/pagination | `/api/v1/search`, text index, `escapeRegex`, `clampPagination` |
| Activity feed | `activity.models.js` — written today, never read (B13) |
| Audit-log viewer | `/api/v1/admin/audit-log` (D6) |
| Admin console (users, roles, status, analytics) | whole `/api/v1/admin` router (D6) |
| Notes UI | `/api/v1/notes` (D6) |
| Sprint burndown / velocity charts | `/burndown`, `/velocity` endpoints (D6) |
| Labels | requires finishing B12 rather than deleting it |
| Task dependencies | `IssueLinkTypeEnum` (`blocks`/`blocked_by`/`depends_on`) |
| Epic hierarchy, story points | `epicLink`, `parent`, `FIBONACCI_POINTS` |
| Overdue / workload views | indexed `dueDate`, `assignees` |

### P1.6 Deployment readiness

- Dockerfile per submodule + compose for local Mongo/Redis.
- Production env checklist; expand `env.js` validation to everything actually required at runtime.
- Log shipping and an error-tracking hook.
- Backup/restore procedure for MongoDB.

---

## P2 — Optional

- Attachments: multer or object storage, size/type limits, virus scanning (B15).
- Real-time updates over WebSocket, replacing notification polling.
- Light theme + contrast audit against the existing token set (C3).
- Saved views and filters; bulk task operations; CSV export.
- Time tracking; `@mention` autocomplete; presence.
- Landing-page SEO (meta, OG tags, sitemap) — the app itself is authenticated, so SEO applies only to `/`.
- Split `Hero.tsx`'s 908-line animation out of the main bundle (C4).

---

## Open decisions

These materially affect architecture, security or product behaviour and should be settled before the phases that depend on them.

1. **Cookie-only auth vs bearer + `localStorage` (P0.3, B22).** Recommendation: cookie-only. It deletes code, removes the XSS exfiltration path, and `api.ts` already sends credentials. Cost: cross-site deployments need `SameSite=None; Secure` and a correct CORS origin, and any future non-browser client needs a separate token path.
2. **Should `product_manager` retain admin powers (P0.4, B2)?** The route guard and the permission matrix currently disagree. Recommendation: restrict to `super_admin` and add PM-specific read-only analytics if that access was intentional.
3. **Tailwind migration scope (P0.7, C1).** Recommendation: incremental, shared primitives first, then page-by-page, converting `tokens.ts` values into Tailwind theme tokens so both styling paths read the same palette during the transition. A big-bang rewrite of 905 style objects risks regressing a working UI.
4. **Labels: implement or delete (B12, P1.5).** Either is defensible; leaving a dead model is not.
5. **Does the deployment target need more than the in-process event bus (B18)?** Single instance: keep it. Multi-instance: notifications will be dropped, and a durable queue becomes necessary.

---

## Recommended sequence

Ordered by dependency, not by section number. Each phase ends green (typecheck, lint, tests, build) before the next begins.

| Phase | Content | Why here |
|---|---|---|
| ~~**1**~~ | ✅ P0.1 — build, tests, `.gitmodules`, CI | **Done.** Nothing could be verified until the toolchain was green; CI now protects every later phase. |
| ~~**1b**~~ | ✅ P0.2c — browser verification | **Done.** Every later phase can now be verified in a real browser. |
| **2** | P0.5 + P0.4 — validation and uniform authz | Security-critical, backend-only, directly testable, no UI dependency. |
| **3** | P0.3 — auth hardening | Depends on phase 2's validation; touches the client contract, so it lands before UI work. |
| **4** | P0.6 — transactions and integrity | Independent of the client; do it before new features write more data. |
| **5** | P0.2b — the three broken auth flows | Needs phase 3's final auth contract to avoid building pages twice. |
| **6** | P0.7 — Tailwind migration, responsive layout, a11y primitives | The largest phase; do it once the API contract underneath has stopped moving. |
| **7** | P1.1 + P1.2 — delete dead code, then frontend architecture | Subtract before restructuring. |
| **8** | P1.3 + P1.4 — reliability and test coverage | Locks in everything above. |
| **9** | P1.5 — surface existing backend capability | First phase that adds product surface, on a foundation that can support it. |
| **10** | P1.6, then P2 | Deployment, then genuinely new features. |

This matches the order suggested in the original brief, with one deliberate change: **the frontend design-system migration moves earlier** (phase 6 rather than phase 7 of 17). Responsiveness and accessibility are P0 requirements that are physically unreachable under inline styles, and every page built before the migration would have to be rewritten after it.

## Git workflow

`backend/` and `frontend/` are independent repositories (audit A1). For every phase:

1. Fix `.gitmodules` first (P0.1) so the submodule relationship is reproducible.
2. Commit inside the submodule that changed, on a branch in that submodule.
3. Commit the updated gitlink in the root superproject as a separate commit referencing the phase.
4. Keep root-level `docs/` changes in their own commit — they belong to the superproject, not to either submodule.
5. Never assume a root-level `git commit -a` captures submodule changes: it records only the gitlink.
6. Phases that span both submodules (P0.2, P0.3) need one commit per repository plus the gitlink bump — sequence backend first so the frontend commits against a settled contract.
