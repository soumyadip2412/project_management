# QA Checklist

Tracks every major user flow and its verification status.

**Last updated:** 2026-10-03 (frontend converted to JavaScript; password-reset and email-verification flows built and browser-verified)

For a full human pass over every screen (projects, members, tasks, board, comments, sprints, permissions with three users, settings, OAuth), follow [MANUAL_TEST_PLAN.md](MANUAL_TEST_PLAN.md).

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ | Verified in a real browser, end to end |
| 🟡 | Automated checks pass (typecheck / lint / build / unit tests) but **not** browser-verified |
| ⬜ | Not verified |
| ❌ | Verified as broken |
| 🚫 | Cannot be verified in the current environment — see Blocker |

**Browser verification is now running.** Playwright drives real Chromium against the API backed by an ephemeral in-memory MongoDB, so no test ever touches the Atlas cluster.

```
cd backend  && PORT=8123 npm run e2e:server     # API + throwaway MongoDB
cd frontend && npm run e2e                      # Playwright (desktop + mobile)
```

**Result (2026-10-03): 19 passed, 1 skipped (the mobile-only menu test on the desktop project) — `critical-path` 6/6 + `auth-links` 2/2 + `landing` 1/1 on desktop, and the same plus the mobile menu test on Pixel 7.** The same suite also passed unchanged straight after the TypeScript → JavaScript conversion, before any other change.

**Earlier result (2026-09-30, after the UI redesign): critical path 6/6 desktop · 6/6 mobile (Pixel 7), stable over repeated runs (24/24 with `--repeat-each=2`).** C13 is fixed: the sidebar is an off-canvas drawer below 1024px and every page reflows. Earlier the same day, before the redesign: 6/6 desktop · 1/6 mobile.

Superseded note: Every mobile failure is the same layout defect: the dashboard sidebar navigation renders outside the viewport at Pixel 7 width (C13; the shape changed from "search input intercepts clicks" after `DashboardLayout.jsx` was edited on 2026-09-29). No failure is an API or auth error. (2026-10-03: `_debug.spec.ts` was a diagnostic probe and was deleted; `_navlinks.spec.ts` became `landing.spec.js` and passes.)

The backend now also has **API integration tests** (`backend/tests/api/`, 49 tests): multi-user BOLA/IDOR probes, RBAC per role, validation, CSRF, session revocation and data invariants. They run in backend CI.

---

## Harness

| Piece | What it is |
|---|---|
| `backend/scripts/e2e-server.mjs` | Boots the real `src/app.js` against `mongodb-memory-server`. Sets its own secrets, unsets `REDIS_URL`, and raises the rate limits — the real `.env` cannot leak in, because it sets the env before importing anything from `src/`. |
| `frontend/playwright.config.js` | Two projects: `desktop-chromium` (1440×900) and `mobile-chromium` (Pixel 7). Starts Vite with `--mode e2e`. |
| `frontend/.env.e2e` | Pins `VITE_API_BASE_URL` to `:8123`. **Required** — the committed `.env` points at `:8000`, and Vite's `.env` files beat anything passed through Playwright's `webServer.env`. Without this, tests hit whatever real backend is on :8000. |
| `frontend/e2e/critical-path.spec.js` | 6 tests covering the critical path and authorization. Provisions its own user through the real registration UI, so it needs no fixtures. |
| `frontend/e2e/auth-links.spec.js` | Email verification (incl. resend from Settings and a superseded link) and password reset (request → emailed link → client-side checks → new password → sign-in; link is single-use). Reads the real email through the E2E server's test-only `GET /__e2e/last-email?to=`. |
| `frontend/e2e/landing.spec.js` | Public landing page stays reachable signed out; section anchors and the mobile menu work. |

**Known limitation:** E2E cannot run in either submodule's CI, because it needs *both* repositories at once and each CI checkout has only one. Running it needs the root superproject (which has no CI) or a manual local run.

---

## Flows to verify

The sequence below is the target end-to-end path.

| # | Flow | Desktop | Mobile | Notes |
|---|---|---|---|---|
| 1 | Register → dashboard | ✅ | ✅ | Verified end to end |
| 2 | Logout | ✅ | ✅ | Session really cleared; re-login works |
| 3 | Login | ✅ | ✅ | |
| 4 | Dashboard loads | ✅ | ✅ | |
| 5 | Workspaces view | ✅ | ✅ | |
| 6 | Create project | ✅ | ✅ | Fixed a stale-list bug here — D10 |
| 7 | Create task | ✅ | ✅ | |
| 8 | Data persists across reload | ✅ | ✅ | Reload-verified, not just optimistic state |
| 9 | **All 7 board columns render** | ✅ | ✅ | **The P0.2 fix** |
| 10 | **Status change persists** | ✅ | ✅ | `in_review` accepted; was a 400 before |
| 11 | Filters (status) | ✅ | ✅ | Canonical option list |
| 12 | Search box renders | ✅ | ✅ | Now queries `/api/v1/search` (projects + tasks); results open the item (D5 fixed) |
| 13 | Protected routes redirect when logged out | ✅ | ✅ | 4 routes checked |
| 14 | Corrupted access cookie recovers through the refresh cookie | ✅ | ✅ | Cookie is httpOnly and absent from `document.cookie`; one silent refresh, no redirect (D9, E13) |
| 15 | Assign task | ⬜ | ⬜ | Not yet scripted |
| 16 | Add project member | ⬜ | ⬜ | Not yet scripted |
| 17 | Comments | ⬜ | ⬜ | Not yet scripted |
| 18 | Notifications | 🟡 | ⬜ | API-tested: assignment, status change and @mention create notifications (E5 fixed). Not yet exercised in a browser. `Activity` was deleted (dead); the dashboard feed reads `AuditLog` |
| 19 | Notes | ✅ | ✅ | Notes tab (2026-10-04): managers write, developers read (`e2e/collaboration.spec.js`) |
| 20 | Password reset | ✅ | ✅ | Fixed 2026-10-03 (D1): `/auth/reset-password/:token` page; the email link is followed in the test. Also fixed the email's button label ("Verify your email") |
| 21 | Email verification | ✅ | ✅ | Fixed 2026-10-03 (D2): link now opens `/auth/verify-email/:token` instead of the API's JSON; resend from Settings |
| 22 | OAuth | 🚫 | 🚫 | Callback lands on `/dashboard` (D4 resolved server-side). Needs real provider credentials, so not E2E-tested; buttons hidden unless `VITE_OAUTH_ENABLED=true` |
| 24 | Landing page signed out | ✅ | ✅ | Fixed 2026-10-03: the API client redirected every failed session check to `/login`, making `/` unreachable when signed out |
| 23 | Moving cards on the board | ✅ | ✅ | Mouse drag and keyboard on desktop, "Move to…" menu everywhere and on phones (`e2e/board.spec.js`, 2026-10-04). Touch long-press drag is wired but not automated |

### C13 — mobile layout (fixed 2026-09-30; history below)

At Pixel 7 width the top bar's search input **overlaps the action buttons and intercepts their clicks**. Playwright's own log:

```
attempting click action — getByRole('button', { name: /New Project/i })
  element is visible, enabled and stable
  <input placeholder="Search projects, tasks, activities... (Press ⌘K)"/> intercepts pointer events
  retrying click action …  (timeout)
```

The button is visible and enabled, yet unclickable — a genuine overlap, not a timing problem. This is audit **C1** made concrete: with ~900 inline style objects and zero media queries, fixed pixel widths cannot reflow. Not fixed here; it belongs to the P0.7 migration, and a real fix needs the breakpoint mechanism first.

### Kanban status transitions — what was verified

Verified in Chromium (desktop). Items 1–4 pass; 5–6 remain unscripted:

1. Drag a card into **In Review** → expect HTTP 200 and the card to stay. Before the fix this sent `status: "review"`, which is absent from the schema enum, so it returned **400** and the card snapped back silently.
2. Drag into **every** column — Backlog, To Do, In Progress, In Review, QA Testing, Done, Cancelled — each must persist.
3. Reload after each move: the status must survive (proves persistence, not just optimistic state).
4. Force a failure (stop the API mid-drag) → the card must revert **and** an `ErrorBanner` must appear. Silent reversion was the pre-P0.2 behaviour.
5. Remove a task from a sprint so the backend sets `backlog`, then confirm it appears in the Backlog column rather than vanishing.
6. Confirm `statusCategory` and `completedAt` update server-side (dragging to Done sets `completedAt`; dragging out clears it).

### Authorization matrix to exercise (flow 18)

Server-side enforcement only; never trust hidden UI.

| Attempt | Expected |
|---|---|
| Any dashboard route while logged out | Redirect to `/login` |
| `GET /projects/:id` as a non-member | 403 |
| `PUT /projects/:id` as `viewer` / `client` | 403 |
| Task create as `viewer` | 403 |
| Task create as `developer` | 200 |
| Any `/admin/*` route as a plain `member` | 403 |
| Request with an expired access token | One transparent refresh, then success |
| Request with refresh also expired | Redirect to `/login`, no hung requests (audit D9) |
| Project member carrying legacy role `admin` | **403 + warning logged** — see audit §3.2 |

---

## Regression checks already automated

These run today and need no browser:

- Task status contract — `backend/tests/taskStatus.test.js` fails if the backend enum drifts from `frontend/src/lib/taskStatus.js`.
- RBAC precedence, fail-closed unmapped roles, wildcard resolution — `backend/tests/security.test.js`.
- `"admin"` is not a valid project role — `backend/tests/taskStatus.test.js`.
- Frontend types prevent a non-canonical status reaching the API (`isTaskStatus` guards both `<select>` boundaries).
