# Production Readiness

**Last updated:** 2026-09-28 (after P0.2 + P0.2c browser verification)
**Overall verdict: NOT production-ready.**

Nothing here is marked ready on the strength of typecheck, lint, build or unit tests alone. A row reaches ✅ only when the automated checks **and** browser verification both pass.

Browser verification now runs: **critical path 6/6 desktop pass, 1/6 mobile pass** (2026-09-30). The mobile failures are a real layout defect (C13: sidebar nav outside the viewport), so responsive rows stay ❌. See [ENGINEERING_AUDIT.md](ENGINEERING_AUDIT.md) §20 for the 2026-09-30 changes.

| Symbol | Meaning |
|---|---|
| ✅ | Verified |
| 🟡 | Partly done / automated only |
| ❌ | Not done or failing |
| 🚫 | Blocked in this environment |

---

## 1. Frontend

| Check | Status | Evidence / gap |
|---|---|---|
| Typecheck | — | Not applicable since 2026-10-03: the client is plain JavaScript (ENGINEERING_AUDIT §21) |
| Lint (`oxlint`) | 🟡 | exit 0, **4 warnings** (audit C4, C8) |
| Build (`npm run build`) | ✅ | succeeds, exit 0 |
| Dev server boots | ✅ | `GET /` → 200, serves app shell |
| Single canonical task-status source | ✅ | `src/lib/taskStatus.js`; 4 duplicate definitions removed (P0.2) |
| Loading states | 🟡 | Wired on 4 list pages (P0.1); **no skeletons** |
| Empty states | 🟡 | Present on 6 pages; shown at the right time only since P0.1 |
| Error states | 🟡 | `ErrorBanner` on Tasks + TaskDetail (P0.2); most other handlers still `console.error` only |
| Error boundary | ❌ | None — a render error blanks the page (audit C7) |
| 404 route | ❌ | Unknown URL renders blank (audit C7) |
| Shared component library | ❌ | Only `LoadingState` + `ErrorBanner` so far (audit C4) |
| Typed API contracts | ❌ | Every response is `any` (audit D8) |
| Data-fetching layer | ❌ | Per-page `useEffect` + `useState`; no cache/dedupe (audit C5) |
| Bundle size | 🟡 | Single **623 kB** chunk (174 kB gzip); Vite warns (audit C11) |

## 2. Backend

| Check | Status | Evidence / gap |
|---|---|---|
| Syntax check | ✅ | 69 files parse, exit 0 |
| Unit tests | ✅ | 20 unit tests pass |
| Linter | ❌ | None. `prettier --check` fails on 57 of 59 files |
| Integration / API tests | ✅ | **49 API tests** (supertest + in-memory MongoDB): BOLA, RBAC, validation, CSRF, revocation, invariants. `npm test` = 69/69 |
| Server starts | ✅ | Boots and serves under E2E against an in-memory MongoDB |
| Seed script works | 🟡 | **Fixed in P0.2** (was failing 3 schema validations); validated offline, not run against a DB |
| Seed script is guarded | ✅ | Refuses in production and without `--force` (P0.2) |
| Request validation | ✅ | express-validator on every mutation (E11) |
| ObjectId params validated | ✅ | `router.param(…, objectIdParam)` + `validateObjectIds` |
| Consistent error contract | ✅ | `asynchandler` + `ApiError` + global mapper |
| Structured logging | ✅ | winston JSON, one line per request with requestId/userId/status/duration; stacks for 5xx |
| Multi-document consistency | 🟡 | No transactions by decision: children-first idempotent deletes; atomic `$inc`; DB-level unique/partial indexes |
| Graceful shutdown | ✅ | SIGTERM/SIGINT drain + DB disconnect, 10 s cap |

## 3. API

| Check | Status | Evidence / gap |
|---|---|---|
| Uniform response envelope | 🟡 | `ApiResponse` used server-side; client still unwraps defensively (audit D8) |
| Status enum contract frontend↔backend | ✅ | Guarded by `backend/tests/taskStatus.test.js` (P0.2) |
| Pagination on list endpoints | ❌ | `clampPagination` used in tasks only (audit D7) |
| OpenAPI/Swagger current | 🟡 | `docs/swagger.yaml` exists; not verified against current routes |
| Endpoints with no caller | 🟡 | `/search`, all `/admin`, `/notes`, burndown, velocity (audit D6) |
| Broken client→server calls | ✅ | Password reset and email verification fixed 2026-10-03 (D1, D2), API- and browser-tested |

## 4. Browser

| Check | Status | Evidence |
|---|---|---|
| Browser automation available | ✅ | `@playwright/test` + Chromium; ephemeral MongoDB via `mongodb-memory-server` |
| Critical path exercised in a browser | ✅ | 6/6 desktop: register → login → workspace → project → task → status → reload → logout |
| Data persistence confirmed by reload | ✅ | Task and project survive a full page reload |
| Kanban status transitions | ✅ | All 7 statuses persist; `in_review` accepted (was 400) |
| Authorization in the browser | ✅ | 4 protected routes redirect when logged out; stale token refreshes or redirects |
| Console errors checked | ✅ | Asserted per test; only expected 401s during logout |
| Network errors checked | ✅ | Asserted; no non-401 failures on the verified flows |
| **Mobile viewport** | ❌ | **3/6 fail** — the search input intercepts button clicks at Pixel 7 width (C13) |
| Tests run in CI | ❌ | E2E needs both repositories at once; neither submodule's CI has both |
| Remaining flows scripted | 🟡 | Members, assignment, comments, notifications, drag gesture not yet covered |

Isolation note: `frontend/.env.e2e` pins the API to `:8123`. Without it, Vite's committed `.env` sends tests to `:8000` — a real backend. That was caught during setup, before any test data reached live data.

## 5. Responsive

| Check | Status | Evidence / gap |
|---|---|---|
| Mobile layout | ❌ | **0** `@media` rules; 5 Tailwind responsive prefixes total. **Now reproduced in a browser:** controls overlap and block clicks at Pixel 7 width (C13) |
| Tablet layout | ❌ | Same |
| Desktop layout | 🟡 | The only width the UI targets |
| Styling mechanism supports breakpoints | ❌ | ~900 inline `style={{}}` objects **cannot** express media queries (audit C1) |

Responsiveness is unreachable before the P0.7 Tailwind migration.

## 6. Accessibility

| Check | Status | Evidence / gap |
|---|---|---|
| `aria-*` where semantics fall short | ❌ | Was 0 across all pages; P0.2 adds `role="alert"`/`aria-label` on `ErrorBanner` and `role="status"` on `LoadingState` only |
| Semantic interactive elements | ❌ | More `onClick` handlers than `<button>` elements (audit C2) |
| Keyboard reachability | ❌ | Not audited; clickable `div`s are not focusable |
| Modal focus management | ❌ | No focus trap, no `role="dialog"`, no Escape |
| Visible focus indicators | ❌ | Many controls set `outline: none` |
| Contrast audit | ❌ | Not performed |
| Drag & drop keyboard alternative | ❌ | The board is pointer-only |

## 7. Security

| Check | Status | Evidence / gap |
|---|---|---|
| Authentication works | ✅ | Register / login / logout / refresh verified in a browser |
| Authorization enforced server-side | ✅ | One middleware per scope + one matrix on every route; search IDOR and cross-workspace create fixed (E1, E2, E7); multi-user tests |
| RBAC fails closed | ✅ | Unmapped roles denied + logged (P0.1), test-covered |
| Legacy `admin` project role | ✅ | Audited in P0.2 — cannot be written by current schema; see audit §3.2 |
| Token storage | ✅ | Cookie-only, httpOnly; never in bodies or `localStorage` (E3, E13) |
| Refresh token at rest | ✅ | SHA-256 hash; rotation with reuse detection; `tokenVersion` revocation (E16, E17) |
| Password policy | ✅ | 8–128 chars, letter + digit, on register/reset/change |
| Input validation | ✅ | Every mutation; type checks block NoSQL operator injection |
| Rate limiting | ✅ | Global + stricter auth limiter; limits now env-tunable, production defaults unchanged |
| Destructive scripts guarded | ✅ | `seed.js` guarded in P0.2 |
| Secrets not committed | ✅ | `.env` ignored; `.env.sample` has placeholders |
| Admin route privilege | ✅ | Matrix-driven: super_admin changes users, hr reads (E24) |
| Dependency audit | ✅ | Backend CI runs `npm audit --omit=dev --audit-level=high`; 0 production vulnerabilities (was 14) |

## 8. Performance

| Check | Status | Evidence / gap |
|---|---|---|
| Database indexes | ✅ | 40+ purposeful indexes, incl. text index and TTL |
| Pagination | ❌ | Tasks only (audit D7) |
| Bundle splitting | ❌ | One 623 kB chunk (audit C11) |
| Request dedupe / caching | ❌ | No data layer (audit C5) |
| Lighthouse / real measurement | ❌ | Never run |

## 9. Database

| Check | Status | Evidence / gap |
|---|---|---|
| Schema validation | ✅ | Enums enforced — this is what caught the status bug |
| Referential integrity | 🟡 | Cross-document checks in controllers; **no transactions** (audit B7) |
| Cascade deletes | 🟡 | Implemented, non-atomic |
| Migrations | ❌ | No framework; none needed so far |
| Backups | ❌ | No documented procedure |
| Seed data | ✅ | Works and is guarded (P0.2) |
| Legacy-data audit | 🟡 | `admin` role conclusion documented; **live data not inspected** (no access to the Atlas cluster) |
| Workspace name uniqueness | ❌ | `slug` is **globally** unique — once any user creates "Marketing", nobody else can (B25) |

## 10. Deployment

| Check | Status |
|---|---|
| CI | ✅ One workflow per submodule (P0.1) |
| CI gates on lint warnings | ❌ Warnings do not fail |
| Dockerfile | ❌ None |
| `.gitmodules` / clonable repo | ✅ Fixed in P0.1 |
| Root gitlinks current | ❌ Still behind the submodule working trees (audit A2) |
| Env validation | ✅ | Expiry defaults; prod requires CORS origin, distinct ≥32-char secrets |
| Healthcheck usable as a probe | ✅ | `/healthcheck` liveness + `/healthcheck/ready` (503 when Mongo is down) |
| Log aggregation / error tracking | ❌ | Local files only |
| Staging environment | ❌ | None |

---

## What would move the needle fastest

Items 1–3 and 5 of the previous list (validation, route-level authz, auth hardening, workspace slug scope) were done on 2026-09-30 — see ENGINEERING_AUDIT §20. What remains, in order:

1. **Tailwind migration + mobile layout** (audit C1/C13) — the only reason 5/6 mobile E2E tests fail.
2. ~~**Missing auth pages** (D1/D2)~~ — done 2026-10-03.
3. **Deployment artefacts** — Dockerfile, a staging environment, log shipping, `TRUST_PROXY` set on the host.
4. **Frontend data layer + typed payloads** (C5, D8) — now that every endpoint returns `ApiResponse`, the defensive unwrapping can go.
