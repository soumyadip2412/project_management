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
- Derived project keys stay unique after a deletion and always start with a letter — `backend/tests/api/projects.test.js`.
- Duplicate assignees stored once; deleting a task detaches its child tasks; a reply to a reply stays visible; workspace removal unassigns tasks — `backend/tests/api/tasks.test.js`.
- A sprint past its end date cannot be started; default sprint names stay unique after a deletion — `backend/tests/api/sprints.test.js`.

---

## 2026-10-24 — Ocean Depths theme

Verified in Chrome (929×883 viewport) against the demo API, and by the full Playwright suite (31 passed, 3 device-specific skips, desktop + mobile):

| Check | Result |
|---|---|
| Landing page: navy/teal palette, no amber left, security cards use line icons | Pass |
| Landing hero at ≤1024px: headline no longer clipped under the navbar | Pass (was clipped at `top: -35px`) |
| Landing navbar 768–1023px: switches to the menu instead of overlapping links | Pass |
| Sign-in page, dark mode | Pass |
| Dashboard, dark mode; navy sidebar drawer over the light app | Pass |
| Project overview and sprint charts (burndown, velocity) in light mode | Pass |
| Console errors on the flows above | None |
| Text contrast (all app tokens, sidebar, landing) | ≥ 4.5:1 |

---

## 2026-10-24 — Sprint cockpit redesign

### Browser check (Step 2)

Environment: Chrome (Claude in Chrome), viewport 929×827. The window could not be resized, so 1440px desktop is covered by the Playwright desktop project (1440×900) instead. Demo API `npm run demo` on :8000 (fully seeded after fix 388ac4e). Vite dev server on :5173. Signed in as priya@demo.dev.

| # | Check | Light | Dark | Result |
|---|---|---|---|---|
| 1 | Your work: project cards with mini strip + health lozenge (PAY "OFF TRACK", MOB Kanban "1 of 4 issues done"), tabs Assigned to me / Due soon / Team activity | ✓ | — | Pass |
| 2 | Board: sprint strip (Day x of y, pts left, health, Complete sprint), status columns with coloured top rule, Jira cards (type mark, mono key, points, avatar, due), filters, "By assignee" swimlanes (Neha Gupta · 21 pts, Rohan Das · 3 pts) | ✓ | ✓ | Pass |
| 3 | WIP limits → board header "n / limit" in red | covered by E2E `sprint-cockpit.spec.js` (UI set in settings → board shows "2 / 1") | | Pass (automated) |
| 4 | Backlog: Active / Planned / Backlog groups, status lozenges, per-status point chips, overcommit "18 pts planned · team averages 13", Start/Complete/Delete | ✓ | — | Pass |
| 5 | Issue view (PAY-7): status lozenge select, Details (Priority, Type, Assignee, Points, Labels, Due, Reporter, Sprint, Time), Subtask / Add child issue, Comments \| History; History lists "Neha Gupta moved IN PROGRESS → IN REVIEW", "… TO DO → IN PROGRESS", "Rohan Das created the issue as TO DO" | ✓ | — | Pass |
| 6 | Reports: burndown (Sprint 2) + velocity (Sprint 1 = 13, average 13) | ✓ | — | Pass |
| 7 | Drawer (<1024px): global links + project header + Planning/Project sections + Project settings; Escape closes and returns focus to ☰ | — | ✓ | Pass |
| 8 | Old `?tab=` links → new routes | covered by E2E (incl. `?tab=constructor`) | | Pass (automated) |
| 9 | Console errors on the flows above | none | none | Pass |

Findings:

- Fixed in `388ac4e`: the demo seed aborted when starting the past Sprint 1 (its end date had passed).
- Fixed in `09f0dfc`: starting a sprint sets its `startDate` to "now", so the demo's active Sprint 2 showed "Day 1 of 2" with a 2-day burndown. The seed now restores Sprint 2's planned start date right after starting it. The strip is expected to read Day 15 of 16; this was not re-checked in the browser after the fix.

Open item: the brief asks for contrast measurements of new borderline pairs (lozenges, top-bar links, active sidebar item). The controller's results do not record any contrast measurements, so this is not verified.

### Automated checks (Step 1)

| Suite | Command | Result |
|---|---|---|
| Backend syntax | `npm run check:syntax` | `syntax-check: 76 file(s) parsed cleanly.` |
| Backend tests | `npm test` | 98 tests, 98 pass, 0 fail, 0 skipped |
| Backend production audit | `npm audit --omit=dev` | 2 vulnerabilities (1 high: `body-parser` 2.0.0–2.3.0; 1 moderate: `nodemailer` 3.0.0–10.1.3). Not 0 as the brief expects; see note |
| Frontend unit tests | `npm test` | 18 tests, 18 pass, 0 fail |
| Frontend lint | `npm run lint` | 0 errors, 4 warnings (the same 4 as on `main`, in `AuthContext.jsx` and `main.jsx`) |
| Frontend build | `npm run build` | Built OK (one existing chunk-size warning, index bundle 521 kB) |
| E2E (Playwright, desktop + mobile) | `npm run e2e` | 58 tests: 53 passed, 0 failed, 5 skipped |

Notes:

- The 5 skips are all device-specific by design: `board.spec.js` desktop-only and phone-only tests, `landing.spec.js` mobile-only test, and `sprint-cockpit.spec.js` swimlanes and WIP column comparison (desktop-only).
- The 2 audit advisories (`body-parser`, `nodemailer`) were not introduced by this redesign. They were fixed afterwards with `npm audit fix` in `backend/` (only `package-lock.json` changed): `body-parser` 2.3.0 to 2.4.0 and `nodemailer` 10.0.12 to 10.2.1. `npm audit --omit=dev` now reports 0 vulnerabilities.

### New automated tests

- `frontend/src/lib/*.test.js`: sprintHealth, boardLanes, taskStatus, format
- `backend/tests/api/projects.test.js`: WIP limits
- `backend/tests/api/dashboard.test.js`: Your work
- `frontend/e2e/sprint-cockpit.spec.js`
