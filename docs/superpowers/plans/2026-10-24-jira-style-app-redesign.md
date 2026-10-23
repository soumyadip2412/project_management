# Jira-style App Redesign ("Sprint cockpit") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the signed-in Project Camp app as a Jira-class Agile tool. It gets a navy global top
bar, a per-project sidebar, and a "sprint cockpit" signature: the sprint strip, health badge,
swimlanes and WIP limits. The Ocean Depths palette stays.

**Architecture:** The `/dashboard` route renders `DashboardLayout`, which holds the top bar, the
modals and the drawer state. Under it, two layout routes each render a sidebar beside a `<main>`:

- `GlobalLayout` for global pages.
- `ProjectLayout` for `/dashboard/projects/:projectId/*`. It loads the project once and shares it
  through `ProjectContext`.

Sprint maths lives in pure, unit-tested modules (`lib/sprintHealth.js`, `lib/boardLanes.js`), and
the components only render their results. The backend gains two small additions: `wipLimits` on
projects, and active-sprint plus "my work" data on `GET /dashboard/stats`.

**Tech Stack:**

- Frontend: React 19, React Router 7, Tailwind v4 (tokens in `src/index.css`), `@dnd-kit/core`,
  `lucide-react` 1.x, Playwright.
- Backend: Express 5, Mongoose, express-validator, and `node:test` + supertest against
  `mongodb-memory-server`.
- New in this plan: frontend unit tests with `node --test` (no new dependency).

**Spec:** `docs/superpowers/specs/2026-10-24-jira-style-app-redesign-design.md`

## Spec corrections found while planning

Read these before the spec. They override it.

1. **`totalDays`** is inclusive calendar days: `round((startOfDay(end) − startOfDay(start)) / day) + 1`.
   The spec's formula `ceil((end − start)/day)` contradicts its own "inclusive" wording. The mockup
   (Oct 18–27 = "Day x of 10") needs the inclusive count.
2. **Pure-logic tests live in the frontend.** They use a new `npm test` script
   (`node --test src/lib/*.test.js`), not `backend/tests/`. The backend suite never imported
   frontend code: `taskStatus.test.js` copies the status list on purpose.
3. **The global sidebar shows "All issues", not "Assigned to me".** "All issues" links to
   `/dashboard/tasks`, and the Tasks page is retitled "All issues". The Tasks page lists every issue
   in your projects and has no assignee filter, so calling it "Assigned to me" would be false.
   "Assigned to me" lives as the first tab of Your work. "Notifications" stays in the top bar only,
   because it is a popover, not a page.
4. **The Backlog route stays reachable for Kanban projects**; only its sidebar link is hidden. Old
   `?tab=sprints` links (and most E2E projects, which default to Kanban through the API) still need
   a working page.
5. **Popovers inside the navy top bar use the navy tokens**: search results, notifications, and the
   Projects ▾ and Account menus. `.surface-navy` redefines the surface tokens for everything inside
   it. This is deliberate, so the bar and its menus read as one unit.
6. **Error alerts show the server's message without the request id.** The frontend `ApiError` does
   not carry `requestId` today. Adding it is a separate, small change, and isn't needed for this
   redesign.
7. **Global radii are not changed.** Buttons and inputs keep their current `rounded-md`. The 4px /
   6px rule applies to the new and restyled pieces this plan builds: cards, lozenges, type marks,
   columns and panels.

## Global Constraints

- Write `.js` / `.jsx` only (no TypeScript). Use `@`-free relative imports in `src/lib/*.js` so Node can import them.
- All HTTP goes through `src/lib/api.js` (`api.get/post/put/delete`); never call `fetch` directly in app code.
- Keep base CSS inside `@layer base`. The only unlayered additions allowed are token-scope classes (`.surface-navy`).
- No inline style objects except truly dynamic values (a colour from a lookup, a computed width or grid count).
- Build UI from `src/components/ui/`. Destructive actions use `ConfirmDialog`; success after an action uses `useToast()`.
- Colour contrast for text and controls is at least **4.5:1** in light and dark mode.
- Fonts: **IBM Plex Sans 400/500/600/700** and **IBM Plex Mono 400/500** from Google Fonts.
- Radius **4px** for controls and cards, **6px** for panels and columns, **8px** for modals. Rows are **32px** (40px with `pointer-coarse`).
- Card shadow: `0 1px 1px rgba(15,23,34,.12), 0 0 1px rgba(15,23,34,.2)`. Nothing else gets a shadow except overlays (`shadow-overlay`).
- Not allowed in the app: gradients, glows, blurred blobs, emoji as icons, cards inside cards.
- Backend: every new field is type-checked in its validator; controllers whitelist assignable fields; enums come from `backend/src/utils/constants.js`.
- Tests:
  - Backend: `cd backend && npm test`.
  - Frontend unit: `cd frontend && npm test`.
  - Frontend checks: `cd frontend && npm run lint && npm run build`.
  - E2E: `cd backend && PORT=8123 npm run e2e:server` in one terminal, then `cd frontend && npm run e2e`.
- Commits: end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on branch `ocean-depths-theme`.

## Review Focus

The five failure modes most likely to bite a real user, which the spec implies but no screen test
naturally exercises. Each has a test in the task that owns the code.

1. **Viewer time zone shifts sprint days.** Sprint dates arrive as UTC midnight. A viewer in
   Los Angeles or Kolkata must see the same "of N" day count. → Task 1, `day counts do not depend on the viewer's time zone`.
2. **One issue with two assignees appears in two swimlanes.** It must appear once, in its first
   assignee's lane, and its points must count once. → Task 2, `an issue with several assignees sits in its first assignee's lane only`.
3. **A move the server forbids leaves the card in the wrong column.** For example, a viewer drags a
   card. The card must snap back and show the server's message. → Task 10, E2E `a move the server refuses snaps back`.
4. **Old links that use `?tab=`** (bookmarks, notification links, emails) must land on the matching
   new route. → Task 7, E2E `old ?tab= links land on the new routes`.
5. **A Kanban project with more than 100 issues** silently drops the rest from the board, because
   the list endpoint is capped at 100. The board must say what it is showing. → Task 10, E2E
   `a large Kanban board says how many issues it shows`.

---

## File map

**Backend**

| File | Change |
|---|---|
| `backend/src/models/project.models.js` | add `settings.wipLimits` (one Number 0–99 per status) |
| `backend/src/validators/project.validators.js` | validate `wipLimits` in `updateProjectValidator` |
| `backend/src/controllers/project.controller.js` | whitelist `wipLimits` in `updateProject` |
| `backend/src/controllers/dashboard.controller.js` | add `activeSprint` per recent project, plus `assignedToMe` and `dueSoon` |
| `backend/tests/api/projects.test.js` | WIP tests |
| `backend/tests/api/dashboard.test.js` | Your work data tests |

**Frontend, new**

| File | Responsibility |
|---|---|
| `src/lib/sprintHealth.js` (+ `.test.js`) | day index, totals, added scope, health band, day segments |
| `src/lib/boardLanes.js` (+ `.test.js`) | swimlane grouping, WIP state |
| `src/lib/taskStatus.test.js` | tests for the new `statusCategoryOf` and `STATUS_TONE` |
| `src/lib/format.test.js` | tests for the new `formatMinutes` |
| `src/lib/useActiveSprint.js` | fetch the active sprint and its issues |
| `src/components/shell/navigation.js` | `GLOBAL_LINKS` |
| `src/components/shell/NavItem.jsx` | `NavItem`, `NavSection` |
| `src/components/shell/ProjectBadge.jsx` | key chip coloured from the project key |
| `src/components/shell/GlobalSearch.jsx` | moved out of DashboardLayout |
| `src/components/shell/Notifications.jsx` | moved out of DashboardLayout |
| `src/components/shell/TopBar.jsx` | global bar |
| `src/components/shell/SidebarFrame.jsx` | desktop sidebar and mobile drawer |
| `src/components/shell/GlobalLayout.jsx` | global sidebar + `<main>` |
| `src/components/shell/projectContext.js` | `ProjectContext`, `useProject()` |
| `src/components/shell/ProjectLayout.jsx` | loads the project; project sidebar + `<main>` |
| `src/components/shell/ProjectSidebar.jsx` | project navigation |
| `src/components/shell/projectRoutes.jsx` | small route elements and `ProjectPageHeader` |
| `src/components/project/SprintTide.jsx` | `SprintTide`, `DayBar`, `HealthLozenge` |
| `src/components/project/ProjectBoard.jsx` | Board screen |
| `src/components/project/CreateSprintModal.jsx` | moved out of ProjectSprints |
| `src/components/project/ProjectBacklog.jsx` | Backlog screen |
| `src/components/project/ProjectReports.jsx` | Reports screen |
| `src/components/project/WipLimitsPanel.jsx` | WIP limits form in Project settings |
| `src/components/tasks/TaskHistory.jsx` | History tab on the issue view |
| `src/components/dashboard/ProjectPulseCard.jsx` | Your work project card |
| `e2e/sprint-cockpit.spec.js` | board, backlog, WIP, redirects, issue view, Your work |

**Frontend, changed:** `package.json` (test script), `index.html` (nothing to change, it keeps
preconnect), `src/index.css`, `src/lib/taskStatus.js`, `src/lib/format.js`,
`src/components/ui/Display.jsx`, `src/components/ui/Navigation.jsx` (Menu trigger), `src/main.jsx`,
`src/components/DashboardLayout.jsx`, `src/components/tasks/TaskBoard.jsx`,
`src/components/auth/AuthLayout.jsx` (unchanged markup; its `.surface-navy` now resolves to the top
bar navy), `src/pages/TaskDetail.jsx`, `src/pages/Dashboard.jsx`, `src/pages/Tasks.jsx` (title),
`e2e/critical-path.spec.js`, `e2e/task-details.spec.js`, `e2e/collaboration.spec.js`.

**Frontend, deleted:**

- `src/pages/ProjectDetail.jsx` (Task 7).
- `src/components/project/ProjectSprints.jsx` (Task 11).
- `src/components/dashboard/{MetricCard,WorkProgressChart,UpcomingDeadlines,MyTasksTable,ActiveProjects}.jsx`
  (Task 14), once nothing imports them.

---

### Task 1: Frontend unit-test runner and `sprintHealth`

**Files:**
- Modify: `frontend/package.json` (scripts)
- Create: `frontend/src/lib/sprintHealth.js`
- Test: `frontend/src/lib/sprintHealth.test.js`

**Interfaces:**
- Produces:
  - `sprintHealth(sprint, issues, now = new Date())` → `{ totalDays, dayIndex, unit: "pts"|"issues", total, remaining, added, idealRemaining, health: "on_track"|"at_risk"|"off_track"|"overdue"|null }`.
    `sprint` needs `startDate`, `endDate`, and optionally `burndownData[]` and `summary.totalIssues`.
    `issues` need `storyPoints` and `statusCategory`.
  - `sprintHealthFromTotals(sprint, { unit, total, remaining, startTotal }, now = new Date())` → the same shape.
  - `daySegments(totalDays, dayIndex, max = 20)` → `("past"|"today"|"future")[]`.
  - `HEALTH_META`: `{ [health]: { label, tone: "success"|"warning"|"danger" } }`.

- [ ] **Step 1: Add the test script**

In `frontend/package.json`, add to `"scripts"`:

```json
"test": "node --test src/lib/*.test.js",
```

- [ ] **Step 2: Write the failing tests**

Create `frontend/src/lib/sprintHealth.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { daySegments, sprintHealth, sprintHealthFromTotals } from "./sprintHealth.js";

// Local noon, so a test never sits on a day boundary.
const at = (day) => new Date(`${day}T12:00:00`);
const sprint = (start, end, extra = {}) => ({ startDate: at(start), endDate: at(end), burndownData: [], ...extra });
const issue = (storyPoints, done = false) => ({ storyPoints, statusCategory: done ? "done" : "todo" });
const tenOnePointIssues = (doneCount) => Array.from({ length: 10 }, (_, i) => issue(1, i < doneCount));

test("counts calendar days inclusively and clamps today into the sprint", () => {
  const s = sprint("2026-10-18", "2026-10-27");
  assert.equal(sprintHealth(s, [], at("2026-10-18")).totalDays, 10);
  assert.equal(sprintHealth(s, [], at("2026-10-18")).dayIndex, 1);
  assert.equal(sprintHealth(s, [], at("2026-10-23")).dayIndex, 6);
  assert.equal(sprintHealth(s, [], at("2026-11-30")).dayIndex, 10);
  assert.equal(sprintHealth(s, [], at("2026-10-01")).dayIndex, 0);
});

test("a one-day sprint has one day", () => {
  const h = sprintHealth(sprint("2026-10-18", "2026-10-18"), [issue(3)], at("2026-10-18"));
  assert.equal(h.totalDays, 1);
  assert.equal(h.dayIndex, 1);
});

test("day counts do not depend on the viewer's time zone", () => {
  const original = process.env.TZ;
  const s = { startDate: "2026-10-18T00:00:00.000Z", endDate: "2026-10-27T00:00:00.000Z", burndownData: [] };
  const counts = ["America/Los_Angeles", "Asia/Kolkata", "UTC"].map((tz) => {
    process.env.TZ = tz;
    return sprintHealth(s, [], new Date("2026-10-22T12:00:00.000Z")).totalDays;
  });
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
  assert.deepEqual(counts, [10, 10, 10]);
});

test("totals and remaining points come from the issues", () => {
  const h = sprintHealth(sprint("2026-10-18", "2026-10-27"), [issue(8), issue(3, true), issue(5)], at("2026-10-20"));
  assert.equal(h.unit, "pts");
  assert.equal(h.total, 16);
  assert.equal(h.remaining, 13);
});

test("added points are measured against the start snapshot, never negative", () => {
  const issues = [issue(8), issue(5)];
  const day = at("2026-10-20");
  assert.equal(sprintHealth(sprint("2026-10-18", "2026-10-27", { burndownData: [{ totalPoints: 10 }] }), issues, day).added, 3);
  assert.equal(sprintHealth(sprint("2026-10-18", "2026-10-27", { burndownData: [{ totalPoints: 20 }] }), issues, day).added, 0);
  assert.equal(sprintHealth(sprint("2026-10-18", "2026-10-27"), issues, day).added, 0);
});

test("health bands compare remaining work with the ideal line", () => {
  // Day 6 of 10 with 10 points: the ideal remaining is 4.
  const s = sprint("2026-10-18", "2026-10-27");
  const day6 = at("2026-10-23");
  assert.equal(sprintHealth(s, tenOnePointIssues(5), day6).health, "on_track"); // 5 left, gap 0.1
  assert.equal(sprintHealth(s, tenOnePointIssues(4), day6).health, "at_risk"); // 6 left, gap 0.2
  assert.equal(sprintHealth(s, tenOnePointIssues(3), day6).health, "off_track"); // 7 left, gap 0.3
});

test("past the end with work left is overdue; with nothing left it is on track", () => {
  const s = sprint("2026-10-18", "2026-10-27");
  assert.equal(sprintHealth(s, tenOnePointIssues(9), at("2026-10-28")).health, "overdue");
  assert.equal(sprintHealth(s, tenOnePointIssues(10), at("2026-10-28")).health, "on_track");
});

test("without estimates it counts issues instead of points", () => {
  const s = sprint("2026-10-18", "2026-10-27", { summary: { totalIssues: 2 } });
  const h = sprintHealth(s, [issue(null), issue(null, true), issue(null), issue(null)], at("2026-10-20"));
  assert.equal(h.unit, "issues");
  assert.equal(h.total, 4);
  assert.equal(h.remaining, 3);
  assert.equal(h.added, 2);
});

test("a sprint with no issues has no health", () => {
  assert.equal(sprintHealth(sprint("2026-10-18", "2026-10-27"), [], at("2026-10-20")).health, null);
});

test("totals from an aggregate give the same answer as the issue list", () => {
  const s = sprint("2026-10-18", "2026-10-27");
  const fromIssues = sprintHealth(s, tenOnePointIssues(4), at("2026-10-23"));
  const fromTotals = sprintHealthFromTotals(s, { unit: "pts", total: 10, remaining: 6, startTotal: null }, at("2026-10-23"));
  assert.deepEqual(fromTotals, fromIssues);
});

test("day segments mark the past, today and the future, capped at 20", () => {
  const ten = daySegments(10, 6);
  assert.equal(ten.length, 10);
  assert.equal(ten.indexOf("today"), 5);
  assert.equal(ten.filter((s) => s === "past").length, 5);

  const long = daySegments(40, 20);
  assert.equal(long.length, 20);
  assert.equal(long.indexOf("today"), 9);

  assert.deepEqual(daySegments(3, 0), ["future", "future", "future"]);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL with `Cannot find module` … `sprintHealth.js`.

- [ ] **Step 4: Implement `sprintHealth.js`**

Create `frontend/src/lib/sprintHealth.js`:

```js
/**
 * Sprint progress and health, computed only from stored data.
 * Pure (no React, no imports), so `npm test` runs it under plain Node.
 *
 * Days are local calendar days, counted inclusively: a sprint from Oct 18 to
 * Oct 27 has 10 days, and Oct 23 is day 6.
 */
const DAY_MS = 86_400_000;

const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Math.round absorbs the 23- and 25-hour days around a daylight-saving change.
const daysBetween = (from, to) => Math.round((to - from) / DAY_MS);

export const HEALTH_META = Object.freeze({
  on_track: { label: "On track", tone: "success" },
  at_risk: { label: "At risk", tone: "warning" },
  off_track: { label: "Off track", tone: "danger" },
  overdue: { label: "Overdue", tone: "danger" },
});

/**
 * @param sprint  { startDate, endDate }
 * @param totals  { unit: "pts"|"issues", total, remaining, startTotal: number|null }
 */
export function sprintHealthFromTotals(sprint, { unit, total, remaining, startTotal }, now = new Date()) {
  const start = startOfDay(sprint.startDate);
  const end = startOfDay(sprint.endDate);
  const today = startOfDay(now);

  const totalDays = Math.max(1, daysBetween(start, end) + 1);
  const dayIndex = today < start ? 0 : Math.min(totalDays, daysBetween(start, today) + 1);
  const added = startTotal == null ? 0 : Math.max(0, total - startTotal);
  const idealRemaining = total * (1 - dayIndex / totalDays);

  let health = null;
  if (total > 0) {
    if (today > end && remaining > 0) {
      health = "overdue";
    } else {
      const gap = (remaining - idealRemaining) / total;
      // Small epsilon: 0.1 computed from floats must still count as "on track".
      health = gap <= 0.1 + 1e-9 ? "on_track" : gap <= 0.25 + 1e-9 ? "at_risk" : "off_track";
    }
  }

  return { totalDays, dayIndex, unit, total, remaining, added, idealRemaining, health };
}

/**
 * @param sprint  { startDate, endDate, burndownData?: [{ totalPoints }], summary?: { totalIssues } }
 * @param issues  [{ storyPoints, statusCategory }]
 */
export function sprintHealth(sprint, issues, now = new Date()) {
  const pointsMode = issues.some((i) => (i.storyPoints ?? 0) > 0);
  const weight = (i) => (pointsMode ? i.storyPoints ?? 0 : 1);
  const total = issues.reduce((sum, i) => sum + weight(i), 0);
  const remaining = issues.filter((i) => i.statusCategory !== "done").reduce((sum, i) => sum + weight(i), 0);

  // The backend snapshots the sprint when it starts: points in burndownData[0],
  // the issue count in summary.totalIssues.
  const snapshot = sprint.burndownData?.[0];
  const startTotal = pointsMode ? snapshot?.totalPoints ?? null : snapshot ? sprint.summary?.totalIssues ?? null : sprint.summary?.totalIssues ?? null;

  return sprintHealthFromTotals(sprint, { unit: pointsMode ? "pts" : "issues", total, remaining, startTotal }, now);
}

/** One entry per day (or proportional buckets when the sprint is longer than `max`). */
export function daySegments(totalDays, dayIndex, max = 20) {
  const n = Math.min(totalDays, max);
  const todayAt = dayIndex === 0 ? -1 : Math.ceil((dayIndex / totalDays) * n) - 1;
  return Array.from({ length: n }, (_, i) => (i < todayAt ? "past" : i === todayAt ? "today" : "future"));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/src/lib/sprintHealth.js frontend/src/lib/sprintHealth.test.js
git commit -m "Add sprint health maths with a frontend unit-test runner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Swimlane grouping, WIP state and status helpers

**Files:**
- Create: `frontend/src/lib/boardLanes.js`, `frontend/src/lib/boardLanes.test.js`
- Modify: `frontend/src/lib/taskStatus.js` (add `statusCategoryOf`, `STATUS_TONE`)
- Modify: `frontend/src/lib/format.js` (add `formatMinutes`)
- Test: `frontend/src/lib/taskStatus.test.js`, `frontend/src/lib/format.test.js`

**Interfaces:**
- Consumes: `nameOf(user)` from `src/lib/format.js`.
- Produces:
  - `groupIntoLanes(tasks)` → `[{ key, label, user, tasks, points }]`, sorted by label with "Unassigned" last.
  - `UNASSIGNED` = `"unassigned"`.
  - `wipState(count, limit)` → `{ limited, over, label }`.
  - `statusCategoryOf(status)` → `"todo"|"in_progress"|"done"`.
  - `STATUS_TONE`: `{ [status]: "<tailwind classes>" }`.
  - `formatMinutes(minutes)` → `"45m"`, `"7h"` or `"1h 30m"`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/boardLanes.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupIntoLanes, UNASSIGNED, wipState } from "./boardLanes.js";

const ana = { _id: "u1", fullName: "Ana Silva" };
const bo = { _id: "u2", fullName: "Bo Chen" };
const task = (id, assignees, storyPoints = 1) => ({ _id: id, assignees, storyPoints });

test("lanes are sorted by name, with Unassigned last, and carry their points", () => {
  const lanes = groupIntoLanes([task("a", [bo], 3), task("b", []), task("c", [ana], 5), task("d", [bo], 2)]);
  assert.deepEqual(lanes.map((l) => l.label), ["Ana Silva", "Bo Chen", "Unassigned"]);
  assert.deepEqual(lanes.map((l) => l.points), [5, 5, 1]);
  assert.equal(lanes[2].key, UNASSIGNED);
});

test("an issue with several assignees sits in its first assignee's lane only", () => {
  const lanes = groupIntoLanes([task("a", [bo, ana], 8)]);
  assert.equal(lanes.length, 1);
  assert.equal(lanes[0].label, "Bo Chen");
  assert.equal(lanes[0].points, 8);
  assert.equal(lanes.flatMap((l) => l.tasks).length, 1);
});

test("unestimated issues add no points", () => {
  assert.equal(groupIntoLanes([task("a", [ana], null)])[0].points, 0);
});

test("WIP state shows the limit and flags only real overflow", () => {
  assert.deepEqual(wipState(4, 3), { limited: true, over: true, label: "4 / 3" });
  assert.deepEqual(wipState(3, 3), { limited: true, over: false, label: "3 / 3" });
  assert.deepEqual(wipState(2, 0), { limited: false, over: false, label: "2" });
  assert.deepEqual(wipState(2, undefined), { limited: false, over: false, label: "2" });
});
```

Create `frontend/src/lib/taskStatus.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_TONE, TASK_STATUS_VALUES, statusCategoryOf } from "./taskStatus.js";

test("status categories match the backend's deriveStatusCategory", () => {
  assert.equal(statusCategoryOf("backlog"), "todo");
  assert.equal(statusCategoryOf("todo"), "todo");
  assert.equal(statusCategoryOf("in_progress"), "in_progress");
  assert.equal(statusCategoryOf("in_review"), "in_progress");
  assert.equal(statusCategoryOf("qa_testing"), "in_progress");
  assert.equal(statusCategoryOf("done"), "done");
  assert.equal(statusCategoryOf("cancelled"), "done");
});

test("every status has a lozenge tone", () => {
  for (const status of TASK_STATUS_VALUES) assert.ok(STATUS_TONE[status], status);
});
```

Create `frontend/src/lib/format.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMinutes } from "./format.js";

test("minutes read as hours and minutes", () => {
  assert.equal(formatMinutes(45), "45m");
  assert.equal(formatMinutes(420), "7h");
  assert.equal(formatMinutes(90), "1h 30m");
  assert.equal(formatMinutes(0), "0m");
  assert.equal(formatMinutes(null), "0m");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL. `boardLanes.js` is missing, and `statusCategoryOf` / `formatMinutes` are not exported.

- [ ] **Step 3: Implement**

Create `frontend/src/lib/boardLanes.js`:

```js
import { nameOf } from "./format.js";

/** Board swimlanes and WIP decoration. Pure, so it is unit-tested under Node. */
export const UNASSIGNED = "unassigned";

const idOf = (user) => (typeof user === "object" ? user?._id : user);

/**
 * One lane per first assignee. An issue appears exactly once (in its first
 * assignee's lane), so points are never counted twice.
 */
export function groupIntoLanes(tasks) {
  const lanes = new Map();
  for (const task of tasks) {
    const user = task.assignees?.[0] ?? null;
    const key = idOf(user) ?? UNASSIGNED;
    if (!lanes.has(key)) {
      lanes.set(key, { key, label: user ? nameOf(user) : "Unassigned", user, tasks: [], points: 0 });
    }
    const lane = lanes.get(key);
    lane.tasks.push(task);
    lane.points += task.storyPoints ?? 0;
  }
  return [...lanes.values()].sort((a, b) => {
    if (a.key === UNASSIGNED) return 1;
    if (b.key === UNASSIGNED) return -1;
    return a.label.localeCompare(b.label);
  });
}

/** A limit of 0 (or none) means "no limit". Over the limit is a warning, never a block. */
export function wipState(count, limit) {
  if (!limit) return { limited: false, over: false, label: String(count) };
  return { limited: true, over: count > limit, label: `${count} / ${limit}` };
}
```

Append to `frontend/src/lib/taskStatus.js`:

```js
/** Mirrors deriveStatusCategory in backend/src/utils/helpers.js (cancelled is a closed state). */
export function statusCategoryOf(status) {
  if (status === TASK_STATUS.DONE || status === TASK_STATUS.CANCELLED) return "done";
  if (status === TASK_STATUS.IN_PROGRESS || status === TASK_STATUS.IN_REVIEW || status === TASK_STATUS.QA_TESTING) return "in_progress";
  return "todo";
}

/** Lozenge colours: a tinted background with the status colour as text (all pairs pass 4.5:1). */
export const STATUS_TONE = Object.freeze({
  [TASK_STATUS.BACKLOG]: "bg-neutral-subtle text-subtle",
  [TASK_STATUS.TODO]: "bg-neutral-subtle text-subtle",
  [TASK_STATUS.IN_PROGRESS]: "bg-info-subtle text-info",
  [TASK_STATUS.IN_REVIEW]: "bg-purple-subtle text-purple",
  [TASK_STATUS.QA_TESTING]: "bg-warning-subtle text-warning",
  [TASK_STATUS.DONE]: "bg-success-subtle text-success",
  [TASK_STATUS.CANCELLED]: "bg-neutral-subtle text-subtlest line-through",
});
```

Append to `frontend/src/lib/format.js`:

```js
/** 90 → "1h 30m"; time-tracking fields are stored in minutes. */
export function formatMinutes(minutes) {
  const m = Math.max(0, Math.round(minutes ?? 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS (all files).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/boardLanes.js frontend/src/lib/boardLanes.test.js frontend/src/lib/taskStatus.js frontend/src/lib/taskStatus.test.js frontend/src/lib/format.js frontend/src/lib/format.test.js
git commit -m "Add swimlane grouping, WIP state, status category and minute formatting helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Backend WIP limits on projects

**Files:**
- Modify: `backend/src/models/project.models.js` (constants import; `settings` object, after `enableApprovals`)
- Modify: `backend/src/validators/project.validators.js` (`updateProjectValidator`)
- Modify: `backend/src/controllers/project.controller.js` (`updateProject`)
- Test: `backend/tests/api/projects.test.js`

**Interfaces:**
- Produces: `PUT /api/v1/projects/:projectId { wipLimits: { [status]: 0..99 } }`. It replaces the
  whole set: statuses left out become 0. Responses always contain `settings.wipLimits` with all 7
  status keys.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/api/projects.test.js` (and add `addToProject, createProject` to its
`./setup.js` import, so the import line becomes
`import { addToProject, createProject, signUp, startApi, stopApi } from "./setup.js";`):

```js
describe("WIP limits", () => {
    test("a manager sets limits per status; they round-trip and replace the old set", async () => {
        const owner = await signUp("wipowner");
        const { projectId } = await createProject(owner, "Wip");
        const url = `/api/v1/projects/${projectId}`;

        const first = await owner.agent.put(url).send({ wipLimits: { in_progress: 3, in_review: 2 } }).expect(200);
        assert.equal(first.body.data.settings.wipLimits.in_progress, 3);
        assert.equal(first.body.data.settings.wipLimits.in_review, 2);
        assert.equal(first.body.data.settings.wipLimits.todo, 0);

        const second = await owner.agent.put(url).send({ wipLimits: { in_progress: 4 } }).expect(200);
        assert.equal(second.body.data.settings.wipLimits.in_progress, 4);
        assert.equal(second.body.data.settings.wipLimits.in_review, 0);

        const read = await owner.agent.get(url).expect(200);
        assert.equal(read.body.data.settings.wipLimits.in_progress, 4);
    });

    test("unknown statuses, fractions, out-of-range values and operator keys are rejected", async () => {
        const owner = await signUp("wipbad");
        const { projectId } = await createProject(owner, "WipBad");
        const url = `/api/v1/projects/${projectId}`;
        for (const wipLimits of [{ doing: 2 }, { in_progress: 2.5 }, { in_progress: -1 }, { in_progress: 100 }, { $set: 1 }, [3], "3"]) {
            await owner.agent.put(url).send({ wipLimits }).expect(422);
        }
    });

    test("a developer cannot change them", async () => {
        const owner = await signUp("wipown2");
        const dev = await signUp("wipdev");
        const { projectId } = await createProject(owner, "WipDev");
        await addToProject(owner, projectId, dev, "developer");
        await dev.agent.put(`/api/v1/projects/${projectId}`).send({ wipLimits: { in_progress: 1 } }).expect(403);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && node --test tests/api/projects.test.js`
Expected: FAIL. The first test gets `undefined` for `settings.wipLimits`, and the validation test
gets 200 instead of 422.

- [ ] **Step 3: Implement**

In `backend/src/models/project.models.js`, add `AvailableTaskStatuses` to the existing import from
`../utils/constants.js`. Inside `settings: { … }`, after the `enableApprovals` line, add:

```js
        // Work-in-progress limit per board column (0 = no limit). One key per
        // canonical status, so every response carries the full set.
        wipLimits: Object.fromEntries(
            AvailableTaskStatuses.map((status) => [status, { type: Number, min: 0, max: 99, default: 0 }])
        ),
```

In `backend/src/validators/project.validators.js`, add `AvailableTaskStatuses` to the constants
import. Then append to the array returned by `updateProjectValidator`:

```js
    // An object whose keys are canonical statuses and whose values are whole
    // numbers 0-99. Checking every key is also what keeps "$set" and other
    // operator keys out of the update.
    body("wipLimits").optional().custom((value) => {
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
            throw new Error("wipLimits must be an object of status → limit");
        }
        for (const [status, limit] of Object.entries(value)) {
            if (!AvailableTaskStatuses.includes(status)) throw new Error(`Unknown status '${status}'`);
            if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
                throw new Error(`wipLimits.${status} must be a whole number from 0 to 99`);
            }
        }
        return true;
    }),
```

In `backend/src/controllers/project.controller.js` `updateProject`, add `AvailableTaskStatuses` to
the constants import. Then, directly before `await project.save();`, add:

```js
    // Replaces the whole set: statuses left out go back to "no limit".
    if (req.body.wipLimits !== undefined) {
        for (const status of AvailableTaskStatuses) {
            project.settings.wipLimits[status] = req.body.wipLimits[status] ?? 0;
        }
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && node --test tests/api/projects.test.js && npm run check:syntax`
Expected: PASS; syntax check clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/project.models.js backend/src/validators/project.validators.js backend/src/controllers/project.controller.js backend/tests/api/projects.test.js
git commit -m "Let project leads set WIP limits per board column

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Backend data for Your work

**Files:**
- Modify: `backend/src/controllers/dashboard.controller.js` (`getDashboardStats`)
- Test: `backend/tests/api/dashboard.test.js`

**Interfaces:**
- Produces: `GET /api/v1/dashboard/stats` additionally returns:
  - `recentProjects[i].activeSprint`:
    `{ _id, name, startDate, endDate, startPoints|null, totalPoints, remainingPoints, totalIssues, openIssues, myOpenIssues } | null`
  - `assignedToMe` and `dueSoon`: each `[{ _id, issueKey, title, status, statusCategory, dueDate, issueType, priority, project: { _id, name, key } }]`, at most 20.
    `dueSoon` holds open issues assigned to the caller that are due within 7 days or overdue,
    soonest first.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/api/dashboard.test.js`:

```js
describe("your work data", () => {
    const day = 864e5;

    test("each recent project carries its active sprint's progress, and my open work is listed", async () => {
        const alice = await signUp("ywalice");
        const bob = await signUp("ywbob");
        const { projectId, key } = await createProject(alice, "Yours");
        await addToProject(alice, projectId, bob, "developer");

        const sprint = (await alice.agent.post(`/api/v1/projects/${projectId}/sprints`)
            .send({ name: "S1", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 7 * day).toISOString() })
            .expect(201)).body.data;
        const create = async (body) => (await alice.agent.post(`/api/v1/tasks/${projectId}`).send(body).expect(201)).body.data;

        await create({ title: "Mine open", storyPoints: 5, sprint: sprint._id, assignees: [alice.user._id], dueDate: new Date(Date.now() + 2 * day).toISOString() });
        const done = await create({ title: "Mine done", storyPoints: 3, sprint: sprint._id, assignees: [alice.user._id] });
        await create({ title: "Bob's", storyPoints: 2, sprint: sprint._id, assignees: [bob.user._id] });
        await alice.agent.post(`/api/v1/projects/${projectId}/sprints/${sprint._id}/start`).expect(200);
        await alice.agent.put(`/api/v1/tasks/${projectId}/t/${done._id}`).send({ status: "done" }).expect(200);
        await create({ title: "Added later", storyPoints: 1, sprint: sprint._id });

        const stats = (await alice.agent.get("/api/v1/dashboard/stats").expect(200)).body.data;
        const project = stats.recentProjects.find((p) => p._id === projectId);
        assert.equal(project.activeSprint.name, "S1");
        assert.equal(project.activeSprint.startPoints, 10);
        assert.equal(project.activeSprint.totalPoints, 11);
        assert.equal(project.activeSprint.remainingPoints, 8);
        assert.equal(project.activeSprint.totalIssues, 4);
        assert.equal(project.activeSprint.openIssues, 3);
        assert.equal(project.activeSprint.myOpenIssues, 1);

        assert.deepEqual(stats.assignedToMe.map((t) => t.title), ["Mine open"]);
        assert.deepEqual(stats.dueSoon.map((t) => t.title), ["Mine open"]);
        assert.equal(stats.assignedToMe[0].project.key, key);
    });

    test("no active sprint gives null, and another user's work never leaks in", async () => {
        const carol = await signUp("ywcarol");
        const eve = await signUp("yweve");
        const { projectId } = await createProject(carol, "Quiet");
        await carol.agent.post(`/api/v1/tasks/${projectId}`).send({ title: "Carol secret", assignees: [carol.user._id] }).expect(201);

        const carols = (await carol.agent.get("/api/v1/dashboard/stats").expect(200)).body.data;
        assert.equal(carols.recentProjects.find((p) => p._id === projectId).activeSprint, null);

        const eves = (await eve.agent.get("/api/v1/dashboard/stats").expect(200)).body.data;
        assert.deepEqual(eves.assignedToMe, []);
        assert.deepEqual(eves.dueSoon, []);
        assert.equal(JSON.stringify(eves).includes("Carol secret"), false);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && node --test tests/api/dashboard.test.js`
Expected: FAIL with `Cannot read properties of undefined (reading 'name')`, because `activeSprint`
is missing.

- [ ] **Step 3: Implement**

In `backend/src/controllers/dashboard.controller.js`, change the constants import to
`import { SprintStatusEnum, StatusCategoryEnum, TaskStatusEnum } from "../utils/constants.js";`.

Replace the `const recentProjects = userProjects.slice(0, RECENT_PROJECTS).map(...)` block with:

```js
    const recentSlice = userProjects.slice(0, RECENT_PROJECTS);

    // Active sprint per recent project: one find plus one aggregation, so the
    // cost does not grow with the number of projects.
    const activeSprints = await Sprint.find({ project: { $in: recentSlice.map((p) => p._id) }, status: SprintStatusEnum.ACTIVE })
        .select("name startDate endDate burndownData project")
        .lean();
    const notDone = { $ne: ["$statusCategory", StatusCategoryEnum.DONE] };
    const sprintTotals = activeSprints.length
        ? await Task.aggregate([
            { $match: { sprint: { $in: activeSprints.map((s) => s._id) } } },
            {
                $group: {
                    _id: "$sprint",
                    totalPoints: { $sum: { $ifNull: ["$storyPoints", 0] } },
                    remainingPoints: { $sum: { $cond: [notDone, { $ifNull: ["$storyPoints", 0] }, 0] } },
                    totalIssues: { $sum: 1 },
                    openIssues: { $sum: { $cond: [notDone, 1, 0] } },
                    myOpenIssues: {
                        $sum: { $cond: [{ $and: [notDone, { $in: [req.user._id, { $ifNull: ["$assignees", []] }] }] }, 1, 0] },
                    },
                },
            },
        ])
        : [];
    const totalsBySprint = new Map(sprintTotals.map((t) => [t._id.toString(), t]));
    const sprintByProject = new Map(activeSprints.map((s) => {
        const t = totalsBySprint.get(s._id.toString());
        return [s.project.toString(), {
            _id: s._id,
            name: s.name,
            startDate: s.startDate,
            endDate: s.endDate,
            startPoints: s.burndownData?.[0]?.totalPoints ?? null,
            totalPoints: t?.totalPoints ?? 0,
            remainingPoints: t?.remainingPoints ?? 0,
            totalIssues: t?.totalIssues ?? 0,
            openIssues: t?.openIssues ?? 0,
            myOpenIssues: t?.myOpenIssues ?? 0,
        }];
    }));

    const recentProjects = recentSlice.map((project) => {
        const { total = 0, done = 0 } = perProject.get(project._id.toString()) ?? {};
        return {
            ...project,
            totalTasks: total,
            completedTasks: done,
            progress: total > 0 ? Math.round((done / total) * 100) : 0,
            activeSprint: sprintByProject.get(project._id.toString()) ?? null,
        };
    });

    // "My work": open issues assigned to the caller, in their projects only.
    const mine = (extra) => Task.find({
        project: { $in: projectIds },
        assignees: req.user._id,
        statusCategory: { $ne: StatusCategoryEnum.DONE },
        ...extra,
    })
        .select("issueKey title status statusCategory dueDate issueType priority project")
        .populate("project", "name key")
        .limit(20)
        .lean();
    const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [assignedToMe, dueSoon] = await Promise.all([
        mine({}).sort({ updatedAt: -1 }),
        mine({ dueDate: { $ne: null, $lte: weekAhead } }).sort({ dueDate: 1 }),
    ]);
```

In the final `res.status(200).json(new ApiResponse(200, { … }))` object, add
`assignedToMe, dueSoon,` after `recentProjects,`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && node --test tests/api/dashboard.test.js && npm test`
Expected: PASS, with the full suite green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/dashboard.controller.js backend/tests/api/dashboard.test.js
git commit -m "Return active sprint progress and my open work from the dashboard API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Visual foundation: fonts, tokens, lozenges, type marks, menu trigger

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/ui/Display.jsx` (`StatusBadge`, `IssueTypeIcon`)
- Modify: `frontend/src/components/ui/Navigation.jsx` (`Menu`)

**Interfaces:**
- Consumes: `STATUS_TONE` (Task 2).
- Produces:
  - Tokens `--topbar`, `--topbar-hover` and `--topbar-accent`.
  - `.surface-navy` now uses `--topbar` and redefines `--surface*`.
  - `Menu({ label, items, trigger?, triggerClassName?, align?: "left"|"right" })`.
  - `StatusBadge` and `IssueTypeIcon` keep their props.

- [ ] **Step 1: Fonts and font tokens**

In `frontend/src/index.css`, replace the Geist `@import url(...)` line with:

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
```

In `@theme inline`, replace the three `--font-*` lines with:

```css
  --font-sans: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
```

In `@layer base` `body`, delete the line `font-feature-settings: "ss01", "cv11";` (those are
Geist-only features).

- [ ] **Step 2: Shell tokens and card shadow**

In `:root`, replace the two sidebar lines and the `--shadow-card` line with:

```css
  --sidebar: #ffffff;
  --sidebar-hover: #eef2f5;
  --topbar: #1a2332;
  --topbar-hover: #26344a;
  --topbar-accent: #5cc4c4;
```

```css
  --shadow-card: 0 1px 1px rgba(15, 23, 34, 0.12), 0 0 1px rgba(15, 23, 34, 0.2);
```

In `.dark`, replace the two sidebar lines and `--shadow-card` with:

```css
  --sidebar: #111a26;
  --sidebar-hover: #1a2636;
  --topbar: #0a1018;
  --topbar-hover: #1a2636;
  --topbar-accent: #5cc4c4;
```

```css
  --shadow-card: 0 1px 1px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.12);
```

Replace the whole `.surface-navy { … }` rule with:

```css
/* Navy chrome (the top bar and its menus, the auth side panel). It stays dark
   in both modes, so it redefines the text, line, surface and accent tokens
   for everything inside it. */
.surface-navy {
  --bg: var(--topbar);
  --surface: #1f2b3d;
  --surface-raised: #26344a;
  --surface-sunken: #141d2a;
  --surface-hover: var(--topbar-hover);
  --text: #f1faee;
  --text-subtle: #b4c0cf;
  --text-subtlest: #8b9aad;
  --border: #2c3a50;
  --border-strong: #3a4b63;
  --primary: #7fd3d3;
  --primary-hover: #a8e2e2;
  --primary-subtle: #12302f;
  --primary-contrast: #0b1a1c;
  --focus-ring: #7fd3d3;
  background-color: var(--topbar);
  color: var(--text);
}
```

- [ ] **Step 3: Status lozenge and type mark**

In `frontend/src/components/ui/Display.jsx`, change the first import to
`import { STATUS_TONE, statusMeta } from "../../lib/taskStatus";`. Then replace `StatusBadge` and
`IssueTypeIcon` with:

```jsx
export function StatusBadge({ status, className }) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center whitespace-nowrap rounded-[3px] px-1.5 text-[10.5px] font-bold uppercase tracking-[0.03em]",
        STATUS_TONE[status] ?? STATUS_TONE.todo,
        className
      )}
    >
      {meta.label}
    </span>
  );
}

// A filled square in the type colour with the glyph knocked out in the
// surface colour: white on dark squares in light mode, dark on light squares
// in dark mode, so it reads in both themes.
export function IssueTypeIcon({ type, size = 14 }) {
  const meta = issueTypeMeta(type);
  const Icon = meta.Icon;
  return (
    <span
      role="img"
      aria-label={meta.label}
      className="inline-grid shrink-0 place-items-center rounded-[3px] text-surface"
      style={{ width: size, height: size, background: meta.color }}
    >
      <Icon size={Math.round(size * 0.7)} strokeWidth={2.5} aria-hidden="true" />
    </span>
  );
}
```

Update the file's header comment line "Colour lives in a small glyph and the text stays neutral" to
"Statuses are tinted lozenges; issue types are filled squares".

- [ ] **Step 4: Custom menu trigger**

In `frontend/src/components/ui/Navigation.jsx`, change `export function Menu({ label, items }) {`
to `export function Menu({ label, items, trigger, triggerClassName, align = "right" }) {`. Replace
the `<IconButton … >…</IconButton>` trigger with:

```jsx
      {trigger ? (
        <button
          ref={buttonRef}
          type="button"
          aria-label={label}
          title={label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((o) => !o)}
          className={triggerClassName}
        >
          {trigger}
        </button>
      ) : (
        <IconButton
          ref={buttonRef}
          label={label}
          size="sm"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          <MoreHorizontal size={16} />
        </IconButton>
      )}
```

Change the menu panel's `className="absolute right-0 top-full z-30 mt-1 min-w-40 …"` to:

```jsx
          className={cn(
            "absolute top-full z-30 mt-1 min-w-48 rounded-md border border-line bg-surface p-1 shadow-overlay",
            align === "left" ? "left-0" : "right-0"
          )}
```

- [ ] **Step 5: Verify**

Run: `cd frontend && npm run lint && npm run build && npm test`
Expected: lint reports the same 3 warnings as before (no new ones), the build succeeds, and the unit
tests pass.

Then start the app and open any project's task list, as in Task 15 Step 2 (demo API + `npm run dev`).
Statuses should be uppercase tinted lozenges, types filled squares, and the font IBM Plex.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/index.css frontend/src/components/ui/Display.jsx frontend/src/components/ui/Navigation.jsx
git commit -m "Switch to IBM Plex, Jira-style status lozenges and type marks, navy top-bar tokens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: App shell: top bar, global sidebar, mobile drawer

**Files:**
- Create: `frontend/src/components/shell/navigation.js`, `NavItem.jsx`, `ProjectBadge.jsx`, `GlobalSearch.jsx`, `Notifications.jsx`, `TopBar.jsx`, `SidebarFrame.jsx`, `GlobalLayout.jsx`
- Modify: `frontend/src/components/DashboardLayout.jsx` (rewrite)
- Modify: `frontend/src/main.jsx` (wrap global routes in `GlobalLayout`)
- Modify: `frontend/src/pages/Tasks.jsx` (title "All issues")
- Modify: `frontend/e2e/critical-path.spec.js` (`navTo`, `logout`, `ensureSidebar` users)

**Interfaces:**
- Consumes: `Menu` with `trigger` (Task 5), `useTheme()` → `{ setPreference }`, `useAuth()` → `{ user, logout }`.
- Produces:
  - **Outlet context from `DashboardLayout`:** `{ drawerOpen, closeDrawer, menuButtonRef, recentProjects, refreshProjects }`.
  - **`SidebarFrame({ children })`** renders `<aside id="app-sidebar" aria-label="Main navigation">`.
  - **`NavItem({ to, label, icon?, leading?, end?, badge? })`** renders an `<li>` containing a `NavLink`.
  - **`NavSection({ heading?, children })`**.
  - **`ProjectBadge({ project, size?: "sm"|"lg" })`**.
  - **Landmarks:**
    - the top bar's link group is `<nav aria-label="Global">`;
    - the sidebar's link group is `<nav aria-label="Sidebar">`;
    - the account menu button is named "Account";
    - the drawer button is named "Open navigation".
  - **`"pc:issue-created"`:** a `CustomEvent` dispatched on `window` after `+ Create` makes an issue
    (`detail` = task).

- [ ] **Step 1: Move GlobalSearch and Notifications into their own files**

Run from `frontend/`. The script cuts by marker comments, not line numbers:

```bash
node -e '
const fs = require("fs");
const p = "src/components/DashboardLayout.jsx";
const s = fs.readFileSync(p, "utf8");
const cut = (from, to) => { const a = s.indexOf(from), b = s.indexOf(to); if (a < 0 || b < 0) throw new Error("marker missing: " + (a < 0 ? from : to)); return s.slice(a, b); };
const search = cut("const SHORTCUT_HINT", "/** Where a notification leads");
const notes = cut("/** Where a notification leads", "/* ═══");
fs.writeFileSync("src/components/shell/GlobalSearch.jsx",
`import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { taskPath } from "../../lib/format";
import { Key } from "../ui/Display";

` + search.replace("function GlobalSearch()", "export default function GlobalSearch()"));
fs.writeFileSync("src/components/shell/Notifications.jsx",
`import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { taskPath } from "../../lib/format";
import { timeAgo } from "../../lib/time";
import { humanizeStatuses } from "../../lib/taskStatus";
import { IconButton } from "../ui/Button";

` + notes.replace("function Notifications()", "export default function Notifications()"));
'
```

Then, in `src/components/shell/Notifications.jsx`, change the sprint link inside `notificationHref`
to `return \`/dashboard/projects/${projectId}/backlog\`;`.

- [ ] **Step 2: Shared navigation pieces**

Create `frontend/src/components/shell/navigation.js`:

```js
import { Folder, House, Layers, Users } from "lucide-react";

/** Top-level destinations: the top bar on desktop, the drawer's first section on phones. */
export const GLOBAL_LINKS = Object.freeze([
  { to: "/dashboard", label: "Your work", icon: House, end: true },
  { to: "/dashboard/projects", label: "Projects", icon: Folder },
  { to: "/dashboard/workspaces", label: "Workspaces", icon: Layers },
  { to: "/dashboard/team", label: "Team", icon: Users },
]);
```

Create `frontend/src/components/shell/NavItem.jsx`:

```jsx
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";

/** A sidebar link. The active item gets a teal inset bar (Jira's selected-item cue). */
export default function NavItem({ to, label, icon: Icon, leading, end, badge }) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(
            "flex h-8 items-center gap-2.5 rounded px-2 text-[13px] transition-colors pointer-coarse:h-10",
            isActive
              ? "bg-primary-subtle font-medium text-primary shadow-[inset_3px_0_0_var(--primary)]"
              : "text-subtle hover:bg-surface-hover hover:text-text"
          )
        }
      >
        {leading ?? (Icon && <Icon size={16} aria-hidden="true" className="shrink-0" />)}
        <span className="truncate">{label}</span>
        {badge != null && <span className="ml-auto text-xs tabular-nums text-subtlest">{badge}</span>}
      </NavLink>
    </li>
  );
}

export function NavSection({ heading, children }) {
  return (
    <div className="mt-4 first:mt-0">
      {heading && (
        <p className="px-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-subtlest">{heading}</p>
      )}
      <ul className="flex flex-col gap-px">{children}</ul>
    </div>
  );
}
```

Create `frontend/src/components/shell/ProjectBadge.jsx`:

```jsx
import { cn } from "../../lib/utils";

// Colour picked from the key, so a project keeps its colour everywhere.
const PALETTE = ["var(--primary)", "var(--info)", "var(--purple)", "var(--success)", "var(--warning)"];

export default function ProjectBadge({ project, size = "sm" }) {
  const key = project?.key ?? "";
  const index = [...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % PALETTE.length;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded font-mono font-medium text-surface",
        size === "lg" ? "h-8 w-8 text-[10px]" : "h-4 min-w-7 px-1 text-[9px]"
      )}
      style={{ background: PALETTE[index] }}
    >
      {key.slice(0, size === "lg" ? 3 : 4)}
    </span>
  );
}
```

- [ ] **Step 3: Top bar**

Create `frontend/src/components/shell/TopBar.jsx`:

```jsx
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, Folder, FolderPlus, Layers, LogOut, Menu as MenuIcon, Monitor, Moon, Plus, Settings, Sun } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../lib/utils";
import { Avatar } from "../ui/Display";
import { Button, IconButton } from "../ui/Button";
import { Menu } from "../ui/Navigation";
import GlobalSearch from "./GlobalSearch";
import Notifications from "./Notifications";
import { GLOBAL_LINKS } from "./navigation";

/**
 * The navy global bar on every signed-in page. Inside `.surface-navy`, so
 * every token it (and its menus) uses is the navy variant.
 */
export default function TopBar({ recentProjects, onCreateIssue, onCreateProject, onOpenDrawer, drawerOpen, menuButtonRef }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { setPreference } = useTheme();
  const displayName = user?.fullName || user?.username || "Signed in";

  const projectItems = [
    ...recentProjects.map((p) => ({
      label: `${p.key} · ${p.name}`,
      icon: Folder,
      onSelect: () => navigate(`/dashboard/projects/${p._id}`),
    })),
    { label: "View all projects", icon: Layers, onSelect: () => navigate("/dashboard/projects") },
    { label: "New project", icon: FolderPlus, onSelect: onCreateProject },
  ];

  const accountItems = [
    { label: "Settings", icon: Settings, onSelect: () => navigate("/dashboard/settings") },
    { label: "Light theme", icon: Sun, onSelect: () => setPreference("light") },
    { label: "Dark theme", icon: Moon, onSelect: () => setPreference("dark") },
    { label: "Match system theme", icon: Monitor, onSelect: () => setPreference("system") },
    {
      label: "Log out",
      icon: LogOut,
      tone: "danger",
      onSelect: async () => {
        await logout();
        navigate("/login");
      },
    },
  ];

  return (
    <header className="surface-navy sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 px-3 sm:gap-3 lg:px-4">
      <IconButton
        ref={menuButtonRef}
        label="Open navigation"
        aria-expanded={drawerOpen}
        aria-controls="app-sidebar"
        onClick={onOpenDrawer}
        className="-ml-1 lg:hidden"
      >
        <MenuIcon size={18} />
      </IconButton>

      <Link to="/dashboard" className="flex shrink-0 items-center gap-2 rounded px-1 text-[13px] font-semibold text-text">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center rounded bg-[var(--topbar-accent)] text-[12px] font-bold text-[color:var(--topbar)]"
        >
          P
        </span>
        <span className="max-sm:sr-only">Project Camp</span>
      </Link>

      <nav aria-label="Global" className="ml-2 hidden h-full items-stretch gap-1 lg:flex">
        {GLOBAL_LINKS.map(({ to, label, end }) => (
          <span key={to} className="flex items-stretch">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center px-2.5 text-[13px] font-medium transition-colors",
                  isActive ? "text-text shadow-[inset_0_-2px_0_var(--topbar-accent)]" : "text-subtle hover:text-text"
                )
              }
            >
              {label}
            </NavLink>
            {to === "/dashboard/projects" && (
              <span className="flex items-center">
                <Menu
                  label="Recent projects"
                  items={projectItems}
                  align="left"
                  trigger={<ChevronDown size={14} aria-hidden="true" />}
                  triggerClassName="flex h-7 w-6 items-center justify-center rounded text-subtle hover:bg-surface-hover hover:text-text"
                />
              </span>
            )}
          </span>
        ))}
      </nav>

      <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={onCreateIssue} aria-label="Create issue" className="ml-1">
        <span className="max-sm:sr-only">Create</span>
      </Button>

      <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
        <GlobalSearch />
        <Notifications />
        <Menu
          label="Account"
          items={accountItems}
          trigger={<Avatar name={displayName} size="sm" />}
          triggerClassName="rounded-full p-0.5 hover:bg-surface-hover"
        />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Sidebar frame and global layout**

Create `frontend/src/components/shell/SidebarFrame.jsx`:

```jsx
import { useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { IconButton } from "../ui/Button";
import NavItem, { NavSection } from "./NavItem";
import { GLOBAL_LINKS } from "./navigation";

/**
 * ≥1024px: a sticky 240px column under the top bar.
 * Below: an off-canvas drawer holding the global links, then this layout's
 * own links. Focus moves into it when it opens; Escape closes it and returns
 * focus to the ☰ button.
 */
export default function SidebarFrame({ children }) {
  const { drawerOpen, closeDrawer, menuButtonRef } = useOutletContext();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const ref = useRef(null);

  useEffect(() => {
    if (!drawerOpen) return;
    ref.current?.querySelector("a")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        closeDrawer();
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer, menuButtonRef]);

  return (
    <>
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-[var(--surface-overlay)] lg:hidden" onClick={closeDrawer} aria-hidden="true" />
      )}
      <aside
        ref={ref}
        id="app-sidebar"
        aria-label="Main navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-line bg-sidebar transition-[transform,visibility] duration-200",
          "lg:visible lg:sticky lg:top-12 lg:z-auto lg:h-[calc(100vh-3rem)] lg:w-60 lg:translate-x-0",
          drawerOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        )}
      >
        {!isDesktop && (
          <div className="border-b border-line px-2 py-2">
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="text-[13px] font-semibold text-text">Project Camp</span>
              <IconButton label="Close navigation" size="sm" onClick={closeDrawer}>
                <X size={16} />
              </IconButton>
            </div>
            <NavSection>
              {GLOBAL_LINKS.map((link) => (
                <NavItem key={link.to} {...link} />
              ))}
            </NavSection>
          </div>
        )}
        {children}
      </aside>
    </>
  );
}
```

Create `frontend/src/components/shell/GlobalLayout.jsx`:

```jsx
import { Outlet, useOutletContext } from "react-router-dom";
import { Folder, House, ListChecks } from "lucide-react";
import NavItem, { NavSection } from "./NavItem";
import ProjectBadge from "./ProjectBadge";
import SidebarFrame from "./SidebarFrame";

/** Every /dashboard page that is not inside a project. */
export default function GlobalLayout() {
  const shell = useOutletContext();
  return (
    <div className="flex min-h-[calc(100vh-3rem)]">
      <SidebarFrame>
        <nav aria-label="Sidebar" className="px-2 py-3">
          <NavSection>
            <NavItem to="/dashboard" end label="Your work" icon={House} />
            <NavItem to="/dashboard/tasks" label="All issues" icon={ListChecks} />
          </NavSection>
          <NavSection heading="Recent projects">
            {shell.recentProjects.map((p) => (
              <NavItem key={p._id} to={`/dashboard/projects/${p._id}`} label={p.name} leading={<ProjectBadge project={p} />} />
            ))}
            <NavItem to="/dashboard/projects" end label="View all projects" icon={Folder} />
          </NavSection>
        </nav>
      </SidebarFrame>
      <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1280px] flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8">
        <Outlet context={shell} />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite DashboardLayout**

Replace everything below the file's header comment in `frontend/src/components/DashboardLayout.jsx`
with the following. Update the header comment to say it holds the top bar, the create modals and
the drawer state, and that the sidebars live in `GlobalLayout` / `ProjectLayout`.

```jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import CreateProjectModal from "./CreateProjectModal";
import CreateTaskModal from "./CreateTaskModal";
import TopBar from "./shell/TopBar";
import { useToast } from "./ui/Toast";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState([]);
  const menuButtonRef = useRef(null);
  const currentProjectId = useMatch("/dashboard/projects/:projectId/*")?.params.projectId;

  const refreshProjects = useCallback(async () => {
    try {
      const res = await api.get("/projects");
      setRecentProjects((Array.isArray(res?.data) ? res.data : []).slice(0, 5));
    } catch {
      // The shortcuts in the menu and sidebar just stay as they were; nothing else depends on them.
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="min-h-screen bg-bg text-text">
      <a
        href="#main"
        className="sr-only z-[70] rounded-md bg-surface px-3 py-2 text-[13px] font-medium shadow-overlay focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <TopBar
        recentProjects={recentProjects}
        onCreateIssue={() => setIssueModalOpen(true)}
        onCreateProject={() => setProjectModalOpen(true)}
        onOpenDrawer={() => setDrawerOpen(true)}
        drawerOpen={drawerOpen}
        menuButtonRef={menuButtonRef}
      />

      <Outlet context={{ drawerOpen, closeDrawer, menuButtonRef, recentProjects, refreshProjects }} />

      <CreateProjectModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onSuccess={(project) => {
          toast(`Project “${project?.name ?? "Untitled"}” created`);
          refreshProjects();
          // navigate() to the route already shown does not remount it, so the
          // Projects list watches this changing state value to refetch.
          navigate("/dashboard/projects", { state: { projectCreatedAt: Date.now() } });
        }}
      />
      <CreateTaskModal
        isOpen={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        defaultProjectId={currentProjectId}
        onSuccess={(task) => {
          toast(task?.issueKey ? `${task.issueKey} created` : "Issue created");
          // Board and Backlog listen for this to refresh without a page reload.
          window.dispatchEvent(new CustomEvent("pc:issue-created", { detail: task }));
        }}
      />
    </div>
  );
}
```

- [ ] **Step 6: Routes and the Tasks title**

In `frontend/src/main.jsx`, add `import GlobalLayout from "./components/shell/GlobalLayout";`. Then
replace the `/dashboard` route block with:

```jsx
              {/* Application shell: top bar + a sidebar layout (protected) */}
              <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route element={<GlobalLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="projects" element={<Projects />} />
                  <Route path="workspaces" element={<Workspaces />} />
                  <Route path="tasks" element={<Tasks />} />
                  <Route path="tasks/:taskId" element={<TaskDetail />} />
                  <Route path="team" element={<Team />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="*" element={<NotFound inApp />} />
                </Route>
                <Route element={<GlobalLayout />}>
                  <Route path="projects/:projectId" element={<ProjectDetail />} />
                </Route>
              </Route>
```

(`ProjectDetail` stays under the global layout until Task 7 replaces it.)

In `frontend/src/pages/Tasks.jsx`, change `title="Tasks"` to `title="All issues"`.

- [ ] **Step 7: Update the E2E navigation helpers**

In `frontend/e2e/critical-path.spec.js`, replace `ensureSidebar`, `navTo` and `logout` with:

```js
/** Waits for the app shell; opens the mobile drawer when the top bar has no room for links. */
async function openNavigation(page) {
  await expect(page.locator("main#main")).toBeVisible({ timeout: 20_000 });
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(sidebar(page)).toBeInViewport();
    return true;
  }
  return false;
}

async function navTo(page, name) {
  if (await openNavigation(page)) {
    await sidebar(page).getByRole("link", { name, exact: true }).first().click();
    return;
  }
  const inTopBar = page.getByRole("navigation", { name: "Global" }).getByRole("link", { name, exact: true });
  if (await inTopBar.count()) await inTopBar.click();
  else await sidebar(page).getByRole("link", { name, exact: true }).click();
}

async function logout(page) {
  await expect(page.locator("main#main")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
}
```

Replace every remaining `ensureSidebar(page)` call with `await openNavigation(page)` (search the
file for `ensureSidebar(`). Replace `navTo(page, "Tasks")` with `navTo(page, "All issues")`.

- [ ] **Step 8: Verify**

Run: `cd frontend && npm run lint && npm run build`
Expected: no new lint warnings, and the build succeeds.

Run the E2E suite (see Global Constraints).
Expected: the same pass count as before the task (31 passed, 3 skipped). If a test fails because it
looked for the removed header "New project" button, change it to use the Projects page button
(`navTo(page, "Projects")`, then click "New project").

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/shell frontend/src/components/DashboardLayout.jsx frontend/src/main.jsx frontend/src/pages/Tasks.jsx frontend/e2e/critical-path.spec.js
git commit -m "Add the navy global top bar, global sidebar and mobile drawer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Project layout, project sidebar and routes

**Files:**
- Create: `frontend/src/components/shell/projectContext.js`, `ProjectLayout.jsx`, `ProjectSidebar.jsx`, `projectRoutes.jsx`
- Modify: `frontend/src/main.jsx` (project routes)
- Delete: `frontend/src/pages/ProjectDetail.jsx`
- Modify: `frontend/e2e/task-details.spec.js`, `frontend/e2e/collaboration.spec.js` (URLs)
- Create: `frontend/e2e/sprint-cockpit.spec.js` (first test: redirects)

**Interfaces:**
- Consumes: `SidebarFrame`, `NavItem`, `NavSection`, `ProjectBadge` (Task 6).
- Produces:
  - `useProject()` → `{ project, refresh }`.
  - `ProjectPageHeader({ title, actions? })`.
  - Route elements: `ProjectHome`, `ProjectSummary`, `ProjectIssues`, `ProjectNotesPage`, `ProjectMembersPage` and `ProjectSettingsPage`.
  - Routes: `/dashboard/projects/:projectId/{summary,board,backlog,reports,issues,notes,members,settings}`.
  - The index route redirects `?tab=` links and otherwise picks the default view.

- [ ] **Step 1: Write the failing E2E test for old links**

Create `frontend/e2e/sprint-cockpit.spec.js`:

```js
import { test, expect } from "@playwright/test";

/**
 * The project workspace: old links, board and sprint strip, backlog, WIP
 * limits, the issue view and Your work. Data is arranged through the API;
 * the UI is then checked as a user sees it.
 */

const API = "http://localhost:8123/api/v1"; // matches VITE_API_BASE_URL in .env.e2e
const PASSWORD = "Password123!";
const DAY = 864e5;
const unique = () => Date.now().toString().slice(-8) + Math.floor(Math.random() * 100);
const json = async (res) => (await res.json()).data;
const iso = (days) => new Date(Date.now() + days * DAY).toISOString();

async function person(browser, tag) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const id = unique();
  const email = `${tag}${id}@example.com`;
  await page.goto("/register");
  await page.getByPlaceholder("John Doe").fill(`${tag} ${id}`);
  await page.getByPlaceholder("john@example.com").fill(email);
  await page.getByPlaceholder("Create a password").fill(PASSWORD);
  await page.getByPlaceholder("Confirm your password").fill(PASSWORD);
  await page.getByRole("button", { name: /Create Account/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  const me = await json(await page.request.get(`${API}/auth/current-user`));
  return { context, page, email, id: me._id, name: me.fullName };
}

async function project(owner, methodology = "scrum") {
  const key = `S${unique().slice(-5)}`;
  return json(await owner.page.request.post(`${API}/projects`, { data: { name: `Cockpit ${key}`, key, methodology } }));
}

test("old ?tab= links land on the new routes", async ({ browser }) => {
  const owner = await person(browser, "links");
  const p = await project(owner);
  for (const [tab, route] of [["overview", "summary"], ["tasks", "issues"], ["sprints", "backlog"], ["notes", "notes"], ["members", "members"], ["settings", "settings"]]) {
    await owner.page.goto(`/dashboard/projects/${p._id}?tab=${tab}`);
    await expect(owner.page).toHaveURL(new RegExp(`/dashboard/projects/${p._id}/${route}$`));
  }
  await owner.page.goto(`/dashboard/projects/${p._id}`);
  await expect(owner.page).toHaveURL(new RegExp(`/dashboard/projects/${p._id}/board$`));
  await owner.context.close();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (E2E server running): `cd frontend && npx playwright test e2e/sprint-cockpit.spec.js --project=desktop-chromium`
Expected: FAIL. The URL stays `…/projects/<id>?tab=overview`.

- [ ] **Step 3: Project context and layout**

Create `frontend/src/components/shell/projectContext.js`:

```js
import { createContext, useContext } from "react";

/** The project loaded once by ProjectLayout, shared with every project page. */
export const ProjectContext = createContext(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used inside <ProjectLayout>");
  return ctx;
}
```

Create `frontend/src/components/shell/ProjectLayout.jsx`:

```jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useOutletContext, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { EmptyState, Skeleton } from "../ui/Feedback";
import { ProjectContext } from "./projectContext";
import ProjectSidebar from "./ProjectSidebar";
import SidebarFrame from "./SidebarFrame";

/**
 * /dashboard/projects/:projectId/*: loads the project ONCE (mirroring the
 * backend's authorizeProject) and gives it to every child page via context.
 */
export default function ProjectLayout() {
  const { projectId } = useParams();
  const shell = useOutletContext();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setProject(res?.data ?? null);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    setProject(null);
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ project, refresh }), [project, refresh]);

  return (
    <div className="flex min-h-[calc(100vh-3rem)]">
      <SidebarFrame>{project && <ProjectSidebar project={project} />}</SidebarFrame>
      <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 py-5 focus:outline-none sm:px-6 lg:px-8">
        {loading ? (
          <div role="status" aria-live="polite" className="space-y-4">
            <span className="sr-only">Loading project</span>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-64 w-full rounded-md" />
          </div>
        ) : error || !project ? (
          <EmptyState
            title={error?.statusCode === 403 ? "You're not a member of this project" : "This project is unavailable"}
            description={error?.statusCode === 403 ? "Ask one of its project managers to invite you." : error?.message || "It may have been deleted."}
            action={
              <Link to="/dashboard/projects" className="text-[13px] font-medium text-primary hover:underline">
                Back to projects
              </Link>
            }
          />
        ) : (
          <ProjectContext.Provider value={value}>
            <Outlet context={shell} />
          </ProjectContext.Provider>
        )}
      </main>
    </div>
  );
}
```

Create `frontend/src/components/shell/ProjectSidebar.jsx`:

```jsx
import { Columns3, LayoutDashboard, ChartLine, ListChecks, ListOrdered, NotebookText, Settings, Users } from "lucide-react";
import NavItem, { NavSection } from "./NavItem";
import ProjectBadge from "./ProjectBadge";

const METHODOLOGY = { scrum: "Scrum project", kanban: "Kanban project", waterfall: "Waterfall project" };

export default function ProjectSidebar({ project }) {
  const base = `/dashboard/projects/${project._id}`;
  const members = project.members?.length ?? 0;
  return (
    <nav aria-label="Sidebar" className="flex flex-1 flex-col px-2 py-3">
      <div className="mb-3 flex items-center gap-2.5 px-2 py-1">
        <ProjectBadge project={project} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-text">{project.name}</p>
          <p className="truncate text-xs text-subtlest">
            {METHODOLOGY[project.methodology] ?? "Project"} · {members} {members === 1 ? "member" : "members"}
          </p>
        </div>
      </div>
      <NavSection heading="Planning">
        <NavItem to={`${base}/summary`} label="Summary" icon={LayoutDashboard} />
        <NavItem to={`${base}/board`} label="Board" icon={Columns3} />
        {project.methodology === "scrum" && <NavItem to={`${base}/backlog`} label="Backlog" icon={ListOrdered} />}
        <NavItem to={`${base}/reports`} label="Reports" icon={ChartLine} />
      </NavSection>
      <NavSection heading="Project">
        <NavItem to={`${base}/issues`} label="All issues" icon={ListChecks} />
        <NavItem to={`${base}/notes`} label="Notes" icon={NotebookText} />
        <NavItem to={`${base}/members`} label="Members" icon={Users} />
      </NavSection>
      <div className="mt-auto pt-4">
        <ul>
          <NavItem to={`${base}/settings`} label="Project settings" icon={Settings} />
        </ul>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Route elements**

Create `frontend/src/components/shell/projectRoutes.jsx`:

```jsx
import { Link, Navigate, useSearchParams } from "react-router-dom";
import ProjectMembers from "../project/ProjectMembers";
import ProjectNotes from "../project/ProjectNotes";
import ProjectOverview from "../project/ProjectOverview";
import ProjectSettings from "../project/ProjectSettings";
import ProjectTasks from "../project/ProjectTasks";
import { useProject } from "./projectContext";

/** Old ?tab= values → new routes, so bookmarks, emails and notifications keep working. */
const TAB_ROUTES = { overview: "summary", tasks: "issues", sprints: "backlog", notes: "notes", members: "members", settings: "settings" };

export function ProjectHome() {
  const { project } = useProject();
  const [params] = useSearchParams();
  const target = TAB_ROUTES[params.get("tab")] ?? (project.methodology === "waterfall" ? "summary" : "board");
  return <Navigate to={target} replace />;
}

/** Breadcrumb + page title shared by every project page. */
export function ProjectPageHeader({ title, actions }) {
  const { project } = useProject();
  return (
    <div className="mb-5">
      <nav aria-label="Breadcrumb" className="mb-1 flex min-w-0 items-center gap-1.5 text-xs text-subtlest">
        <Link to="/dashboard/projects" className="rounded hover:text-text hover:underline">Projects</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/dashboard/projects/${project._id}/summary`} className="truncate rounded hover:text-text hover:underline">
          {project.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-subtle">{title}</span>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-text">{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function ProjectSummary() {
  const { project } = useProject();
  return (
    <>
      <ProjectPageHeader title="Summary" />
      <ProjectOverview project={project} />
    </>
  );
}

export function ProjectIssues() {
  const { project } = useProject();
  return (
    <>
      <ProjectPageHeader title="All issues" />
      <ProjectTasks project={project} />
    </>
  );
}

export function ProjectNotesPage() {
  const { project } = useProject();
  return (
    <>
      <ProjectPageHeader title="Notes" />
      <ProjectNotes project={project} />
    </>
  );
}

export function ProjectMembersPage() {
  const { project, refresh } = useProject();
  return (
    <>
      <ProjectPageHeader title="Members" />
      <ProjectMembers project={project} onProjectUpdate={refresh} />
    </>
  );
}

export function ProjectSettingsPage() {
  const { project, refresh } = useProject();
  return (
    <>
      <ProjectPageHeader title="Project settings" />
      <ProjectSettings project={project} onProjectUpdate={refresh} />
    </>
  );
}
```

- [ ] **Step 5: Wire the routes; delete ProjectDetail**

In `frontend/src/main.jsx`:
- Remove `import ProjectDetail from "./pages/ProjectDetail";`.
- Add `import ProjectLayout from "./components/shell/ProjectLayout";`.
- Add `import ProjectSprints from "./components/project/ProjectSprints";` (temporary, for Backlog and Reports until Task 11).
- Add `import ProjectTasks from "./components/project/ProjectTasks";` (temporary, for Board until Task 10).
- Add `import { ProjectHome, ProjectIssues, ProjectMembersPage, ProjectNotesPage, ProjectPageHeader, ProjectSettingsPage, ProjectSummary } from "./components/shell/projectRoutes";`
- Add `import { useProject } from "./components/shell/projectContext";`

Add these two temporary wrappers above `function App()`. Tasks 10 and 11 delete them:

```jsx
// Temporary until Task 10 / Task 11 replace them with the real screens.
function TempBoard() {
  const { project } = useProject();
  return (<><ProjectPageHeader title="Board" /><ProjectTasks project={project} /></>);
}
function TempSprints({ title }) {
  const { project } = useProject();
  return (<><ProjectPageHeader title={title} /><ProjectSprints project={project} /></>);
}
```

Replace the temporary `<Route element={<GlobalLayout />}><Route path="projects/:projectId" … /></Route>`
block from Task 6 with:

```jsx
                <Route path="projects/:projectId" element={<ProjectLayout />}>
                  <Route index element={<ProjectHome />} />
                  <Route path="summary" element={<ProjectSummary />} />
                  <Route path="board" element={<TempBoard />} />
                  <Route path="backlog" element={<TempSprints title="Backlog" />} />
                  <Route path="reports" element={<TempSprints title="Reports" />} />
                  <Route path="issues" element={<ProjectIssues />} />
                  <Route path="notes" element={<ProjectNotesPage />} />
                  <Route path="members" element={<ProjectMembersPage />} />
                  <Route path="settings" element={<ProjectSettingsPage />} />
                  <Route path="*" element={<NotFound inApp />} />
                </Route>
```

Run: `git rm frontend/src/pages/ProjectDetail.jsx`

- [ ] **Step 6: Point the existing E2E specs at the new routes**

- In `frontend/e2e/task-details.spec.js`, replace `?tab=sprints` with `/backlog` and `?tab=members` with `/members`.
- In `frontend/e2e/collaboration.spec.js`, replace `?tab=notes` with `/notes` and `?tab=sprints` with `/backlog`.

Each changes from the form `` `/dashboard/projects/${project._id}?tab=x` `` to
`` `/dashboard/projects/${project._id}/route` ``.

- [ ] **Step 7: Verify**

Run: `cd frontend && npm run lint && npm run build`, then the full E2E suite.
Expected: the new redirect test passes, and so does every other test. If a test asserted the old
project page's `h1` (the project name), assert `getByRole("navigation", { name: "Sidebar" })` to
contain the project name instead.

- [ ] **Step 8: Commit**

```bash
git add -A frontend/src/components/shell frontend/src/main.jsx frontend/src/pages/ProjectDetail.jsx frontend/e2e
git commit -m "Give each project its own sidebar and URL per section; redirect old tab links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Sprint strip component and active-sprint hook

**Files:**
- Create: `frontend/src/lib/useActiveSprint.js`
- Create: `frontend/src/components/project/SprintTide.jsx`
- Modify: `frontend/src/components/shell/projectRoutes.jsx` (`ProjectSummary` shows the strip)

**Interfaces:**
- Consumes: `sprintHealth`, `daySegments`, `HEALTH_META` (Task 1); `computeBurndown(sprint, tasks)` → `{ ideal, actual, total }` from `src/lib/burndown.js`.
- Produces:
  - `useActiveSprint(projectId, { enabled = true })` → `{ sprint, issues, loading, error, refresh, setIssues }`.
  - `SprintTide({ sprint, issues, action? })`, which renders `<section role="group" aria-label="<sentence>">`.
  - `DayBar({ totalDays, dayIndex, compact? })`.
  - `HealthLozenge({ health })`.

- [ ] **Step 1: The hook**

Create `frontend/src/lib/useActiveSprint.js`:

```js
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

const EMPTY = { sprint: null, issues: [], loading: false, error: "" };

/** The project's active sprint and its issues (GET …/sprints?status=active, then …/sprints/:id). */
export function useActiveSprint(projectId, { enabled = true } = {}) {
  const [state, setState] = useState({ ...EMPTY, loading: enabled });

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState(EMPTY);
      return;
    }
    try {
      const list = await api.get(`/projects/${projectId}/sprints`, { params: { status: "active" } });
      const active = Array.isArray(list?.data) ? list.data[0] : null;
      if (!active) {
        setState(EMPTY);
        return;
      }
      const detail = await api.get(`/projects/${projectId}/sprints/${active._id}`);
      setState({
        sprint: detail?.data?.sprint ?? active,
        issues: Array.isArray(detail?.data?.issues) ? detail.data.issues : [],
        loading: false,
        error: "",
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err?.message || "The active sprint could not be loaded." }));
    }
  }, [projectId, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Optimistic updates from the board: same signature as a useState setter.
  const setIssues = useCallback(
    (update) => setState((s) => ({ ...s, issues: typeof update === "function" ? update(s.issues) : update })),
    []
  );

  return { ...state, refresh, setIssues };
}
```

- [ ] **Step 2: The component**

Create `frontend/src/components/project/SprintTide.jsx`:

```jsx
import { computeBurndown } from "../../lib/burndown";
import { formatDate } from "../../lib/format";
import { daySegments, HEALTH_META, sprintHealth } from "../../lib/sprintHealth";
import { cn } from "../../lib/utils";

const TONE = {
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
};

export function HealthLozenge({ health }) {
  if (!health) return null;
  const meta = HEALTH_META[health];
  return (
    <span className={cn("inline-flex h-5 items-center whitespace-nowrap rounded-[3px] px-1.5 text-[10.5px] font-bold uppercase tracking-[0.03em]", TONE[meta.tone])}>
      {meta.label}
    </span>
  );
}

/** One segment per sprint day (bucketed above 20): elapsed teal, today ringed, future grey. */
export function DayBar({ totalDays, dayIndex, compact = false }) {
  const segments = daySegments(totalDays, dayIndex);
  return (
    <span
      aria-hidden="true"
      className="grid gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
    >
      {segments.map((s, i) => (
        <span
          key={i}
          className={cn(
            "rounded-[2px]",
            compact ? "h-[5px]" : "h-2",
            s === "future" ? "bg-line" : "bg-primary",
            s === "today" && "shadow-[0_0_0_2px_var(--primary-subtle),0_0_0_3px_var(--primary)]"
          )}
        />
      ))}
    </span>
  );
}

function Sparkline({ sprint, issues }) {
  const { ideal, actual, total } = computeBurndown(sprint, issues);
  if (total === 0 || ideal.length < 2) return null;
  const w = 78;
  const h = 22;
  const x = (i) => (i / (ideal.length - 1)) * w;
  const y = (v) => 2 + (1 - v / total) * (h - 4);
  const points = (values) =>
    values.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="block">
      <polyline points={points(ideal)} fill="none" stroke="var(--chart-reference)" strokeDasharray="3 3" strokeWidth="1.5" />
      <polyline points={points(actual)} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The signature strip on Board, Backlog and Summary: where the sprint is in
 * time, how much is left, scope added since it started, and its health.
 */
export default function SprintTide({ sprint, issues, action = null }) {
  const h = sprintHealth(sprint, issues);
  const unitWord = h.unit === "pts" ? "points" : "issues";
  const sentence =
    `${sprint.name}, day ${h.dayIndex} of ${h.totalDays}, ${h.remaining} of ${h.total} ${unitWord} left` +
    (h.added > 0 ? `, ${h.added} ${unitWord} added since the start` : "") +
    (h.health ? `, ${HEALTH_META[h.health].label.toLowerCase()}` : "");

  return (
    <section
      role="group"
      aria-label={sentence}
      className="mb-4 grid items-center gap-x-5 gap-y-3 rounded-md border border-line bg-surface px-4 py-3 shadow-card md:grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto_auto]"
    >
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-text">{sprint.name}</p>
        {sprint.goal && <p className="truncate text-xs text-subtlest">{sprint.goal}</p>}
      </div>
      <div className="min-w-0">
        <DayBar totalDays={h.totalDays} dayIndex={h.dayIndex} />
        <p className="mt-1.5 flex justify-between gap-2 text-xs text-subtlest">
          <span>{formatDate(sprint.startDate)}</span>
          <span className="text-center">
            <b className="font-semibold text-text">Day {h.dayIndex} of {h.totalDays}</b> · {h.remaining} of {h.total} {h.unit} left
            {h.added > 0 && <span className="text-warning"> · +{h.added} {h.unit} added</span>}
          </span>
          <span>{formatDate(sprint.endDate)}</span>
        </p>
      </div>
      <div className="flex items-center gap-3 md:flex-col md:items-end md:gap-1">
        <HealthLozenge health={h.health} />
        <Sparkline sprint={sprint} issues={issues} />
      </div>
      {action && <div>{action}</div>}
    </section>
  );
}
```

- [ ] **Step 3: Show it on Summary**

In `frontend/src/components/shell/projectRoutes.jsx`, add
`import SprintTide from "../project/SprintTide";` and
`import { useActiveSprint } from "../../lib/useActiveSprint";`. Then replace `ProjectSummary` with:

```jsx
export function ProjectSummary() {
  const { project } = useProject();
  const { sprint, issues } = useActiveSprint(project._id, { enabled: project.methodology === "scrum" });
  return (
    <>
      <ProjectPageHeader title="Summary" />
      {sprint && <SprintTide sprint={sprint} issues={issues} />}
      <ProjectOverview project={project} />
    </>
  );
}
```

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run lint && npm run build && npm test`
Expected: everything passes.

Then, in the browser with the demo data (Task 15 Step 2), open Payments Platform → Summary. You
should see the strip with "Day x of y", points left and a health lozenge.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/useActiveSprint.js frontend/src/components/project/SprintTide.jsx frontend/src/components/shell/projectRoutes.jsx
git commit -m "Add the sprint strip with day progress, added scope and a health badge

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Board columns, swimlanes and WIP decoration in TaskBoard

**Files:**
- Modify: `frontend/src/components/tasks/TaskBoard.jsx`

**Interfaces:**
- Consumes: `groupIntoLanes`, `wipState` (Task 2); `Avatar`, `IssueTypeIcon`, `Key`, `Points`, `DueDate`.
- Produces: `TaskBoard({ tasks, onMove, columns = BOARD_COLUMNS, groupBy = "none"|"assignee", wipLimits = {}, showProject = true })`.
  - Column headers carry `data-column-header="<status>"` and `data-over="true|false"`.
  - Drop cells carry `data-column="<status>"` and `data-lane="<laneKey>"`.
  - Lane headings are `<h3>` containing the assignee name and "· N pts".

- [ ] **Step 1: Replace the main component, `Column` and `jumpBetweenColumns`**

In `frontend/src/components/tasks/TaskBoard.jsx`, add the import
`import { groupIntoLanes, wipState } from "../../lib/boardLanes";`. Replace the default export, the
`Column` function and the `jumpBetweenColumns` function with:

```jsx
// Drop targets are "<lane>::<status>" so each swimlane has its own cells; a
// drop only ever changes the status (never the assignee).
const statusOf = (dropId) => String(dropId).split("::").pop();

export default function TaskBoard({ tasks, onMove, columns = BOARD_COLUMNS, groupBy = "none", wipLimits = {}, showProject = true }) {
  const isWide = useIsWide();
  const [activeId, setActiveId] = useState(null);
  const [phoneColumn, setPhoneColumn] = useState(columns.includes("todo") ? "todo" : columns[0]);
  // A mouse drag ends with a click on the card; that click must not open it.
  const lastDragEnd = useRef(0);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
      coordinateGetter: jumpBetweenColumns,
    }),
  );

  const inColumn = (list, column) => list.filter((t) => (t.status || "todo") === column);
  const activeTask = tasks.find((t) => t._id === activeId);

  const move = (task, status) => {
    if (!task || task.status === status) return;
    onMove(task, status);
    // The card re-renders in its new column; keep keyboard focus on it.
    requestAnimationFrame(() => document.querySelector(`[data-card="${task._id}"] a`)?.focus());
  };

  const announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${labelOf(tasks, active.id)}. Use the left and right arrow keys to change column, Space to drop, Escape to cancel.`,
    onDragOver: ({ active, over }) => (over ? `${labelOf(tasks, active.id)} is over ${STATUS_META[statusOf(over.id)].label}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `${labelOf(tasks, active.id)} moved to ${STATUS_META[statusOf(over.id)].label}.` : `${labelOf(tasks, active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${labelOf(tasks, active.id)} was cancelled.`,
  };

  // Phones: one column at a time and no swimlanes (too little width for both).
  const visibleColumns = isWide ? columns : [phoneColumn];
  const lanes = isWide && groupBy === "assignee" ? groupIntoLanes(tasks) : [{ key: "all", label: null, tasks, points: 0 }];
  const wip = Object.fromEntries(columns.map((c) => [c, wipState(inColumn(tasks, c).length, wipLimits[c])]));
  const gridStyle = { gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(${isWide ? "15rem" : "0"}, 1fr))` };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        const hits = pointerWithin(args);
        return hits.length ? hits : rectIntersection(args);
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move this task, press Space, then use the left and right arrow keys to choose a column, and press Space again to drop it. Press Enter to open the task.",
        },
      }}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={({ active, over }) => {
        setActiveId(null);
        lastDragEnd.current = Date.now();
        if (over) move(tasks.find((t) => t._id === active.id), statusOf(over.id));
      }}
    >
      {!isWide && (
        <Select aria-label="Column" value={phoneColumn} onChange={(e) => setPhoneColumn(e.target.value)} className="mb-3">
          {columns.map((c) => (
            <option key={c} value={c}>
              {STATUS_META[c].label} ({wip[c].label})
            </option>
          ))}
        </Select>
      )}

      <div className={cn(isWide && "overflow-x-auto pb-4")}>
        <div className="grid gap-2" style={gridStyle}>
          {visibleColumns.map((column) => (
            <ColumnHeader key={column} column={column} wip={wip[column]} />
          ))}
        </div>

        {lanes.map((lane) => (
          <div key={lane.key} className="mt-2">
            {lane.label && (
              <h3 className="flex items-center gap-2 py-1.5 text-xs font-semibold text-subtle">
                {lane.user && <Avatar name={lane.label} size="sm" />}
                {lane.label} <span className="font-normal text-subtlest">· {lane.points} pts</span>
              </h3>
            )}
            <div className="grid gap-2" style={gridStyle}>
              {visibleColumns.map((column) => (
                <Column key={column} laneKey={lane.key} column={column} over={wip[column].over}>
                  {inColumn(lane.tasks, column).map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      columns={columns}
                      showProject={showProject}
                      dragDisabled={!isWide}
                      dimmed={task._id === activeId}
                      onMove={move}
                      suppressClick={() => Date.now() - lastDragEnd.current < 300}
                    />
                  ))}
                </Column>
              ))}
            </div>
          </div>
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? <CardBody task={activeTask} showProject={showProject} className="rotate-1 shadow-overlay" /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// Sticky header for one status: a 3px rule in the status colour, the name, and
// the count, shown as "4 / 3" with a WIP limit and red once over it.
function ColumnHeader({ column, wip }) {
  const meta = STATUS_META[column];
  return (
    <h2
      data-column-header={column}
      data-over={wip.over}
      className="flex h-9 items-center gap-2 rounded-t-md border-t-[3px] bg-surface-sunken px-3 text-[11px] font-bold uppercase tracking-[0.04em] text-subtle"
      style={{ borderTopColor: meta.color }}
    >
      <span>{meta.label}</span>
      <span className={cn("ml-auto tabular-nums", wip.over ? "text-danger" : "text-subtlest")}>
        {wip.label}
        {wip.over && <span className="sr-only"> (over the work-in-progress limit)</span>}
      </span>
    </h2>
  );
}

// A drop zone: one per lane and status. setNodeRef tells dnd-kit which DOM node to measure.
function Column({ laneKey, column, over, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${laneKey}::${column}` });
  const count = Array.isArray(children) ? children.length : 0;
  return (
    <section
      ref={setNodeRef}
      data-column={column}
      data-lane={laneKey}
      aria-label={`${STATUS_META[column].label}, ${count} tasks`}
      className={cn(
        "flex min-h-20 flex-col gap-2 rounded-md p-1.5 transition-colors",
        over ? "bg-danger-subtle" : "bg-surface-sunken",
        isOver && "ring-2 ring-primary"
      )}
    >
      {children}
    </section>
  );
}
```

Replace the `jumpBetweenColumns` function with:

```js
/**
 * Keyboard dragging: ← and → jump to the centre of the neighbouring cell in
 * the SAME swimlane row. Positions are read live, because the board
 * auto-scrolls while a card moves.
 */
function jumpBetweenColumns(event, { currentCoordinates }) {
  if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") return undefined;
  event.preventDefault();
  const cells = Array.from(document.querySelectorAll("[data-column]")).map((el) => el.getBoundingClientRect());
  if (cells.length === 0) return undefined;
  const { x, y } = currentCoordinates;
  const inRow = cells.filter((r) => y >= r.top && y <= r.bottom);
  const row = (inRow.length ? inRow : cells.filter((r) => Math.abs(r.top - cells[0].top) < 2)).sort((a, b) => a.left - b.left);
  const current = row.findIndex((r) => x >= r.left && x <= r.left + r.width);
  const from = current === -1 ? 0 : current;
  const to = event.code === "ArrowRight" ? Math.min(from + 1, row.length - 1) : Math.max(from - 1, 0);
  const r = row[to];
  return { x: r.left + r.width / 2, y: Math.max(y, r.top + 20) };
}
```

- [ ] **Step 2: Cards: Jira layout and project-scoped move menu**

Replace `TaskCard` and `CardBody` with:

```jsx
function TaskCard({ task, columns, showProject, dragDisabled, dimmed, onMove, suppressClick }) {
  const { setNodeRef, listeners, attributes } = useDraggable({ id: task._id, disabled: dragDisabled });
  const moveItems = columns.filter((c) => c !== task.status).map((c) => ({
    label: `Move to ${STATUS_META[c].label}`,
    icon: STATUS_META[c].Icon,
    onSelect: () => onMove(task, c),
  }));

  return (
    <div ref={setNodeRef} data-card={task._id} className={cn("relative", dimmed && "opacity-40")}>
      <Link
        to={taskPath(task)}
        draggable={false}
        onClick={(e) => suppressClick() && e.preventDefault()}
        // Drag props only when dragging is possible: when disabled, dnd-kit
        // would mark the link aria-disabled and screen readers would skip it.
        {...(dragDisabled ? {} : { ...listeners, ...attributes })}
        // dnd-kit makes the handle role="button"; it is still a link to the task.
        role={undefined}
        className="block rounded"
      >
        <CardBody task={task} showProject={showProject} withMenuSpace />
      </Link>
      <div className="absolute right-1 top-1">
        <Menu label={`Move ${task.issueKey}`} items={moveItems} />
      </div>
    </div>
  );
}

// The card's visual content, shared by the real card and the DragOverlay ghost:
// title first, then type · key · priority … due · points · assignee.
function CardBody({ task, showProject, withMenuSpace, className }) {
  const assignee = task.assignees?.[0];
  const priority = priorityMeta(task.priority);
  const PriorityIcon = priority.Icon;
  const done = task.statusCategory === "done";
  return (
    <span className={cn("block rounded bg-surface p-2.5 text-left shadow-card transition-colors hover:bg-surface-raised", className)}>
      <span className={cn("block text-[13px] leading-snug", done ? "text-subtle line-through" : "text-text", withMenuSpace && "pr-7")}>
        {task.title}
      </span>
      {showProject && task.project?.name && <span className="mt-1 block truncate text-xs text-subtlest">{task.project.name}</span>}
      <span className="mt-2 flex items-center gap-1.5">
        <IssueTypeIcon type={task.issueType} />
        <Key>{task.issueKey}</Key>
        {URGENT.has(task.priority) && <PriorityIcon size={14} style={{ color: priority.color }} aria-label={`${priority.label} priority`} />}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <DueDate date={task.dueDate} empty={null} className="text-xs" />
          <Points value={task.storyPoints} />
          {assignee && (
            <span title={nameOf(assignee)}>
              <Avatar name={nameOf(assignee)} size="sm" />
            </span>
          )}
        </span>
      </span>
    </span>
  );
}
```

Update the file header comment: the board now takes `columns`, `groupBy`, `wipLimits` and
`showProject`, and drop ids are `"<lane>::<status>"`.

- [ ] **Step 3: Verify the existing board still works**

Run: `cd frontend && npm run lint && npm run build`, then
`npx playwright test e2e/board.spec.js e2e/critical-path.spec.js`.
Expected: PASS. The Tasks page uses the defaults (all columns, no lanes, no limits), so its
behaviour is unchanged.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/tasks/TaskBoard.jsx
git commit -m "Board: Jira-style cards, assignee swimlanes and WIP-limit column headers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Project Board screen

**Files:**
- Create: `frontend/src/components/project/ProjectBoard.jsx`
- Modify: `frontend/src/main.jsx` (board route; delete `TempBoard`)
- Test: `frontend/e2e/sprint-cockpit.spec.js`

**Interfaces:**
- Consumes:
  - `useProject()` (Task 7);
  - `useActiveSprint` and `SprintTide` (Task 8);
  - `TaskBoard` props (Task 9);
  - `statusCategoryOf` (Task 2);
  - `ProjectPageHeader`;
  - the `"pc:issue-created"` event (Task 6).
- Produces:
  - The Board screen. Toolbar controls:
    - search input labelled "Search board";
    - `Select`s labelled "Type" and "Priority";
    - assignee filter toggle buttons named "Filter by <name>";
    - a `Segmented` labelled "Group" with items "None" and "By assignee".
  - Scrum with no active sprint shows the empty state "No active sprint".

- [ ] **Step 1: Write the failing E2E tests**

Append to `frontend/e2e/sprint-cockpit.spec.js`:

```js
async function scrumSprint(owner, p, issues) {
  const sprint = await json(await owner.page.request.post(`${API}/projects/${p._id}/sprints`, { data: { name: "Sprint Tide", goal: "Ship it", startDate: iso(0), endDate: iso(9) } }));
  const created = [];
  for (const body of issues) {
    created.push(await json(await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { ...body, sprint: sprint._id } })));
  }
  await owner.page.request.post(`${API}/projects/${p._id}/sprints/${sprint._id}/start`);
  return { sprint, created };
}

test("the board shows the sprint strip, marks a column over its WIP limit, and groups by assignee", async ({ browser }) => {
  const owner = await person(browser, "board");
  const p = await project(owner);
  const { created } = await scrumSprint(owner, p, [
    { title: "Card form", storyPoints: 5, status: "in_progress", assignees: [owner.id] },
    { title: "Webhook retries", storyPoints: 3, status: "in_progress", assignees: [owner.id] },
    { title: "Stripe sandbox", storyPoints: 2 },
  ]);
  await owner.page.request.put(`${API}/tasks/${p._id}/t/${created[2]._id}`, { data: { status: "done" } });
  await owner.page.request.put(`${API}/projects/${p._id}`, { data: { wipLimits: { in_progress: 1 } } });

  await owner.page.goto(`/dashboard/projects/${p._id}/board`);
  const strip = owner.page.getByRole("group", { name: /Sprint Tide, day 1 of 10, 8 of 10 points left/ });
  await expect(strip).toBeVisible();
  await expect(strip).toContainText("Day 1 of 10");

  const header = owner.page.locator('[data-column-header="in_progress"]');
  await expect(header).toContainText("2 / 1");
  await expect(header).toHaveAttribute("data-over", "true");

  await owner.page.getByRole("button", { name: "By assignee" }).click();
  await expect(owner.page.getByRole("heading", { level: 3, name: new RegExp(`${owner.name}.*8 pts`) })).toBeVisible();
  await expect(owner.page.getByRole("heading", { level: 3, name: /Unassigned.*2 pts/ })).toBeVisible();
  await owner.context.close();
});

test("a move the server refuses snaps back", async ({ browser }) => {
  const owner = await person(browser, "snapown");
  const viewer = await person(browser, "snapview");
  const p = await project(owner);
  await owner.page.request.post(`${API}/projects/${p._id}/members`, { data: { email: viewer.email, role: "viewer" } });
  await viewer.page.request.post(`${API}/projects/${p._id}/invitations/accept`);
  const { created } = await scrumSprint(owner, p, [{ title: "Read only card", storyPoints: 1 }]);

  await viewer.page.goto(`/dashboard/projects/${p._id}/board`);
  const card = viewer.page.locator(`[data-card="${created[0]._id}"]`);
  await expect(viewer.page.locator('[data-column="todo"]').locator(`[data-card="${created[0]._id}"]`)).toBeVisible();
  await card.getByRole("button", { name: `Move ${created[0].issueKey}` }).click();
  await viewer.page.getByRole("menuitem", { name: "Move to Done" }).click();
  await expect(viewer.page.getByRole("alert")).toContainText(/not allowed|permission/i);
  await expect(viewer.page.locator('[data-column="todo"]').locator(`[data-card="${created[0]._id}"]`)).toBeVisible();
  await owner.context.close();
  await viewer.context.close();
});

test("a scrum project without an active sprint points to the backlog", async ({ browser }) => {
  const owner = await person(browser, "nosprint");
  const p = await project(owner);
  await owner.page.goto(`/dashboard/projects/${p._id}/board`);
  await expect(owner.page.getByText("No active sprint")).toBeVisible();
  await owner.page.getByRole("link", { name: "Go to the backlog" }).click();
  await expect(owner.page).toHaveURL(/\/backlog$/);
  await owner.context.close();
});

test("a large Kanban board says how many issues it shows", async ({ browser }) => {
  test.setTimeout(120_000);
  const owner = await person(browser, "bigboard");
  const p = await project(owner, "kanban");
  for (let i = 0; i < 101; i++) {
    await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { title: `Issue ${i}`, status: "todo" } });
  }
  await owner.page.goto(`/dashboard/projects/${p._id}/board`);
  await expect(owner.page.getByText("Showing the 100 most recent issues of 101.")).toBeVisible();
  await owner.context.close();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd frontend && npx playwright test e2e/sprint-cockpit.spec.js --project=desktop-chromium`
Expected: the four new tests FAIL, because the Board route still renders the temporary list.

- [ ] **Step 3: Implement ProjectBoard**

Create `frontend/src/components/project/ProjectBoard.jsx`:

```jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Route as RouteIcon, Search } from "lucide-react";
import { api } from "../../lib/api";
import { nameOf, memberUserId } from "../../lib/format";
import { PICKABLE_ISSUE_TYPES, issueTypeMeta } from "../../lib/issueType";
import { PRIORITY_VALUES, priorityMeta } from "../../lib/priority";
import { statusCategoryOf } from "../../lib/taskStatus";
import { useActiveSprint } from "../../lib/useActiveSprint";
import { cn } from "../../lib/utils";
import { useProject } from "../shell/projectContext";
import { ProjectPageHeader } from "../shell/projectRoutes";
import TaskBoard from "../tasks/TaskBoard";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Display";
import { Alert, EmptyState, SkeletonRows } from "../ui/Feedback";
import { Input, Select } from "../ui/Field";
import { ConfirmDialog } from "../ui/Modal";
import { Segmented } from "../ui/Navigation";
import { useToast } from "../ui/Toast";
import SprintTide from "./SprintTide";

const CORE_COLUMNS = ["todo", "in_progress", "in_review", "qa_testing", "done"];

// The grouping choice is a per-viewer convenience: remembered per project,
// and harmless to lose (private windows, cleared storage).
function useStoredGroupBy(projectId) {
  const key = `pc:board-group:${projectId}`;
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) === "assignee" ? "assignee" : "none";
    } catch {
      return "none";
    }
  });
  const update = (next) => {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // Not stored: the choice lasts for this visit only.
    }
  };
  return [value, update];
}

export default function ProjectBoard() {
  const { project } = useProject();
  const toast = useToast();
  const isScrum = project.methodology === "scrum";
  const active = useActiveSprint(project._id, { enabled: isScrum });
  const [kanban, setKanban] = useState({ tasks: [], total: 0, loading: !isScrum, error: "" });
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [priority, setPriority] = useState("all");
  const [people, setPeople] = useState([]);
  const [groupBy, setGroupBy] = useStoredGroupBy(project._id);
  const [completeOpen, setCompleteOpen] = useState(false);

  const loadKanban = useCallback(async () => {
    try {
      const res = await api.get(`/tasks/${project._id}`, { params: { limit: 100 } });
      setKanban({ tasks: res?.data?.tasks ?? [], total: res?.data?.totalTasks ?? 0, loading: false, error: "" });
    } catch (err) {
      setKanban((k) => ({ ...k, loading: false, error: err?.message || "The board could not be loaded." }));
    }
  }, [project._id]);

  useEffect(() => {
    if (!isScrum) loadKanban();
  }, [isScrum, loadKanban]);

  const reload = isScrum ? active.refresh : loadKanban;
  useEffect(() => {
    window.addEventListener("pc:issue-created", reload);
    return () => window.removeEventListener("pc:issue-created", reload);
  }, [reload]);

  const source = isScrum ? active.issues : kanban.tasks.filter((t) => t.status !== "backlog");
  const setTasks = isScrum ? active.setIssues : (fn) => setKanban((k) => ({ ...k, tasks: fn(k.tasks) }));
  const loading = isScrum ? active.loading : kanban.loading;
  const error = isScrum ? active.error : kanban.error;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source.filter(
      (t) =>
        (!q || t.title.toLowerCase().includes(q) || t.issueKey?.toLowerCase().includes(q)) &&
        (type === "all" || t.issueType === type) &&
        (priority === "all" || t.priority === priority) &&
        (people.length === 0 || t.assignees?.some((a) => people.includes(a?._id ?? a)))
    );
  }, [source, query, type, priority, people]);

  // Backlog and Cancelled appear only when an issue on the board holds them,
  // so a sprint board reads To do → Done like Jira, yet nothing is ever hidden.
  const columns = useMemo(() => {
    const has = (s) => visible.some((t) => t.status === s);
    return [...(has("backlog") ? ["backlog"] : []), ...CORE_COLUMNS, ...(has("cancelled") ? ["cancelled"] : [])];
  }, [visible]);

  const handleMove = async (task, status) => {
    const before = { status: task.status, statusCategory: task.statusCategory };
    setTasks((list) => list.map((t) => (t._id === task._id ? { ...t, status, statusCategory: statusCategoryOf(status) } : t)));
    try {
      const res = await api.put(`/tasks/${project._id}/t/${task._id}`, { status });
      if (res?.data) setTasks((list) => list.map((t) => (t._id === task._id ? { ...t, ...res.data } : t)));
    } catch (err) {
      setTasks((list) => list.map((t) => (t._id === task._id ? { ...t, ...before } : t)));
      toast(err?.message || "The issue could not be moved.", "error");
    }
  };

  const completeSprint = async () => {
    await api.post(`/projects/${project._id}/sprints/${active.sprint._id}/complete`, {});
    toast(`${active.sprint.name} completed`);
    active.refresh();
  };

  const members = (project.members ?? []).filter((m) => m.user && typeof m.user === "object");
  const togglePerson = (id) => setPeople((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <>
      <ProjectPageHeader title="Board" />

      {isScrum && active.sprint && (
        <SprintTide
          sprint={active.sprint}
          issues={active.issues}
          action={<Button size="sm" icon={<CheckCircle2 size={13} />} onClick={() => setCompleteOpen(true)}>Complete sprint</Button>}
        />
      )}

      {error && (
        <Alert className="mb-3">
          {error}{" "}
          <button type="button" onClick={reload} className="font-medium underline">Try again</button>
        </Alert>
      )}

      {!isScrum && kanban.total > kanban.tasks.length && (
        <Alert tone="info" className="mb-3">
          Showing the {kanban.tasks.length} most recent issues of {kanban.total}. Use All issues to find the rest.
        </Alert>
      )}

      {loading ? (
        <div className="rounded-md border border-line"><SkeletonRows rows={4} label="Loading board" /></div>
      ) : isScrum && !active.sprint ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState
            icon={RouteIcon}
            title="No active sprint"
            description="Plan a sprint in the backlog and start it to see its board here."
            action={<Link to={`/dashboard/projects/${project._id}/backlog`} className="text-[13px] font-medium text-primary hover:underline">Go to the backlog</Link>}
          />
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-52">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtlest" />
              <Input aria-label="Search board" placeholder="Search board" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
            </div>
            <span className="flex items-center" role="group" aria-label="Assignees">
              {members.map((m) => {
                const id = memberUserId(m);
                const on = people.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    aria-label={`Filter by ${nameOf(m.user)}`}
                    title={nameOf(m.user)}
                    onClick={() => togglePerson(id)}
                    className={cn("-ml-1 rounded-full first:ml-0", on ? "ring-2 ring-primary" : "ring-2 ring-bg")}
                  >
                    <Avatar name={nameOf(m.user)} size="sm" />
                  </button>
                );
              })}
            </span>
            <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className="w-auto">
              <option value="all">All types</option>
              {PICKABLE_ISSUE_TYPES.map((t) => <option key={t} value={t}>{issueTypeMeta(t).label}</option>)}
            </Select>
            <Select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-auto">
              <option value="all">All priorities</option>
              {PRIORITY_VALUES.map((p) => <option key={p} value={p}>{priorityMeta(p).label}</option>)}
            </Select>
            <span className="ml-auto">
              <Segmented label="Group" value={groupBy} onChange={setGroupBy} items={[{ id: "none", label: "None" }, { id: "assignee", label: "By assignee" }]} />
            </span>
          </div>

          <TaskBoard
            tasks={visible.map((t) => ({ ...t, project: t.project ?? project._id }))}
            onMove={handleMove}
            columns={columns}
            groupBy={groupBy}
            wipLimits={project.settings?.wipLimits ?? {}}
            showProject={false}
          />
        </>
      )}

      {active.sprint && (
        <ConfirmDialog
          open={completeOpen}
          onClose={() => setCompleteOpen(false)}
          onConfirm={completeSprint}
          tone="primary"
          title={`Complete ${active.sprint.name}?`}
          description="Unfinished issues go back to the backlog. The sprint's velocity and burndown are recorded."
          confirmLabel="Complete sprint"
        />
      )}
    </>
  );
}
```

(`Alert` supports `tone="error" | "success" | "info"`; `info` renders with `role="status"`.)

- [ ] **Step 4: Wire the route**

In `frontend/src/main.jsx`, add `import ProjectBoard from "./components/project/ProjectBoard";`.
Change `<Route path="board" element={<TempBoard />} />` to
`<Route path="board" element={<ProjectBoard />} />`. Delete the `TempBoard` function and the
`ProjectTasks` import if nothing else in `main.jsx` uses it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npm run lint && npm run build && npx playwright test e2e/sprint-cockpit.spec.js`
Expected: PASS on desktop and mobile. On mobile, the swimlane test's lane headings are not shown,
because phones get no lanes. Guard that test at its top with
`test.skip(({ isMobile }) => isMobile, "Swimlanes are desktop-only by design");`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/project/ProjectBoard.jsx frontend/src/main.jsx frontend/e2e/sprint-cockpit.spec.js
git commit -m "Add the project Board with the sprint strip, filters, swimlanes and WIP limits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Backlog and Reports

**Files:**
- Create: `frontend/src/components/project/CreateSprintModal.jsx` (moved from ProjectSprints)
- Create: `frontend/src/components/project/ProjectBacklog.jsx`, `ProjectReports.jsx`
- Delete: `frontend/src/components/project/ProjectSprints.jsx`
- Modify: `frontend/src/main.jsx` (routes; delete `TempSprints`)
- Modify: `frontend/e2e/collaboration.spec.js` (charts on `/reports`), `frontend/e2e/task-details.spec.js` (backlog assertion)
- Test: `frontend/e2e/sprint-cockpit.spec.js`

**Interfaces:**
- Consumes:
  - `DayBar` and `HealthLozenge` (Task 8);
  - `sprintHealth` (Task 1);
  - `BurndownChart({ sprint, tasks })` and `VelocityChart({ data, average })` from `SprintCharts.jsx`;
  - `ProjectPageHeader`.
- Produces:
  - **Backlog:** one `section[aria-label="<sprint name>"]` per open sprint, and a
    `section[aria-label="Backlog"]`.
  - **Row menu:** the ⋯ button is named `Move <KEY>`, with items "Move to <sprint>" and
    "Move to backlog".
  - **Overcommit:** the text "`<n>` pts planned · team averages `<avg>`".
  - **Sprint header:** each header contains "`<done>` of `<total>` points".

- [ ] **Step 1: Write the failing E2E test**

Append to `frontend/e2e/sprint-cockpit.spec.js`:

```js
test("backlog: move an issue into a planned sprint, and over-commitment is flagged", async ({ browser }) => {
  const owner = await person(browser, "backlog");
  const p = await project(owner);
  // A completed sprint gives the team an average velocity of 5.
  const s1 = await json(await owner.page.request.post(`${API}/projects/${p._id}/sprints`, { data: { name: "Sprint One", startDate: iso(-14), endDate: iso(1) } }));
  const t1 = await json(await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { title: "Shipped", storyPoints: 5, sprint: s1._id } }));
  await owner.page.request.post(`${API}/projects/${p._id}/sprints/${s1._id}/start`);
  await owner.page.request.put(`${API}/tasks/${p._id}/t/${t1._id}`, { data: { status: "done" } });
  await owner.page.request.post(`${API}/projects/${p._id}/sprints/${s1._id}/complete`, { data: {} });

  await json(await owner.page.request.post(`${API}/projects/${p._id}/sprints`, { data: { name: "Sprint Two", startDate: iso(1), endDate: iso(14) } }));
  const big = await json(await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { title: "Saved cards", storyPoints: 13 } }));

  await owner.page.goto(`/dashboard/projects/${p._id}/backlog`);
  const backlog = owner.page.locator('section[aria-label="Backlog"]');
  await backlog.getByRole("button", { name: `Move ${big.issueKey}` }).click();
  await owner.page.getByRole("menuitem", { name: "Move to Sprint Two" }).click();

  const two = owner.page.locator('section[aria-label="Sprint Two"]');
  await expect(two).toContainText("Saved cards");
  await expect(two).toContainText("13 pts planned · team averages 5");

  await owner.page.reload();
  await expect(owner.page.locator('section[aria-label="Sprint Two"]')).toContainText("Saved cards");
  await owner.context.close();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx playwright test e2e/sprint-cockpit.spec.js -g backlog --project=desktop-chromium`
Expected: FAIL. There is no `section[aria-label="Backlog"]` with a "Move" menu yet.

- [ ] **Step 3: Extract CreateSprintModal**

Run from `frontend/`:

```bash
node -e '
const fs = require("fs");
const p = "src/components/project/ProjectSprints.jsx";
const s = fs.readFileSync(p, "utf8");
const a = s.indexOf("const EMPTY_SPRINT"), b = s.indexOf("export default function ProjectSprints");
if (a < 0 || b < 0) throw new Error("markers missing");
let block = s.slice(a, b);
block = block.replace(/const SPRINT_STATUS[^\n]*\n/, "").replace(/const sprintIdOf[^\n]*\n/, "");
fs.writeFileSync("src/components/project/CreateSprintModal.jsx",
`import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Field";
import { Alert } from "../ui/Feedback";
import { Modal } from "../ui/Modal";

` + block.replace("function CreateSprintModal(", "export default function CreateSprintModal("));
'
```

Open the new file and check that it contains `EMPTY_SPRINT` and `export default function CreateSprintModal`,
and nothing else.

- [ ] **Step 4: Implement ProjectBacklog**

Create `frontend/src/components/project/ProjectBacklog.jsx`:

```jsx
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { ArrowRightLeft, CheckCircle2, Play, Plus, Route as RouteIcon, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { formatDate, nameOf, taskPath } from "../../lib/format";
import { sprintHealth } from "../../lib/sprintHealth";
import { cn } from "../../lib/utils";
import { useProject } from "../shell/projectContext";
import { ProjectPageHeader } from "../shell/projectRoutes";
import { Button, IconButton } from "../ui/Button";
import { Avatar, IssueTypeIcon, Key, Points, StatusBadge } from "../ui/Display";
import { Alert, EmptyState, SkeletonRows } from "../ui/Feedback";
import { ConfirmDialog } from "../ui/Modal";
import { Menu } from "../ui/Navigation";
import { useToast } from "../ui/Toast";
import CreateSprintModal from "./CreateSprintModal";
import { DayBar } from "./SprintTide";

const BACKLOG = "backlog";
const sprintIdOf = (task) => (typeof task.sprint === "object" ? task.sprint?._id : task.sprint) ?? null;
const pts = (list) => list.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
const byCategory = (list, category) => pts(list.filter((t) => t.statusCategory === category));
const STATUS_LABEL = { planned: "Planned", active: "Active" };

/** A draggable row. Moving also works from its ⋯ menu (keyboard and phones). */
function BacklogRow({ task, projectId, moveItems }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: task._id });
  const assignee = task.assignees?.[0];
  return (
    <li ref={setNodeRef} className={cn("grid grid-cols-[auto_4.5rem_minmax(0,1fr)_auto] items-center gap-3 border-t border-line px-3 py-1.5 sm:grid-cols-[auto_4.5rem_minmax(0,1fr)_auto_auto_auto_auto]", isDragging && "opacity-40")}>
      <span {...listeners} {...attributes} role={undefined} aria-label={`Drag ${task.issueKey}`} className="cursor-grab"><IssueTypeIcon type={task.issueType} /></span>
      <Key>{task.issueKey}</Key>
      <Link to={taskPath({ ...task, project: projectId })} className="truncate rounded text-[13px] text-text hover:text-primary">{task.title}</Link>
      <StatusBadge status={task.status} className="hidden sm:inline-flex" />
      <Points value={task.storyPoints} className="hidden sm:inline-flex" />
      <span className="hidden sm:inline-flex">{assignee ? <span title={nameOf(assignee)}><Avatar name={nameOf(assignee)} size="sm" /></span> : <span className="h-6 w-6" aria-hidden="true" />}</span>
      <Menu label={`Move ${task.issueKey}`} items={moveItems} />
    </li>
  );
}

/** One group: a sprint or the backlog. Also a drop target. */
function Group({ id, label, header, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    // No overflow-hidden here: it would clip the rows' ⋯ menus.
    <section ref={setNodeRef} aria-label={label} className={cn("rounded-md border bg-surface", isOver ? "border-primary" : "border-line")}>
      {header}
      <ul>{children}</ul>
    </section>
  );
}

export default function ProjectBacklog() {
  const { project } = useProject();
  const toast = useToast();
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [avgVelocity, setAvgVelocity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [starting, setStarting] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const fetchData = useCallback(async () => {
    try {
      setError("");
      const [sprintRes, taskRes, velocityRes] = await Promise.all([
        api.get(`/projects/${project._id}/sprints`),
        api.get(`/tasks/${project._id}`, { params: { limit: 100 } }),
        api.get(`/projects/${project._id}/sprints/velocity`).catch(() => null),
      ]);
      setSprints(Array.isArray(sprintRes?.data) ? sprintRes.data : []);
      setTasks(Array.isArray(taskRes?.data?.tasks) ? taskRes.data.tasks : []);
      const v = velocityRes?.data;
      setAvgVelocity(v?.velocityData?.length ? v.avgVelocity : null);
    } catch (err) {
      setError(err?.message || "The backlog could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [project._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    window.addEventListener("pc:issue-created", fetchData);
    return () => window.removeEventListener("pc:issue-created", fetchData);
  }, [fetchData]);

  const moveTask = async (taskId, sprintId) => {
    setActionError("");
    const previous = tasks;
    setTasks((list) => list.map((t) => (t._id === taskId ? { ...t, sprint: sprintId } : t)));
    try {
      await api.put(`/tasks/${project._id}/t/${taskId}`, { sprint: sprintId });
    } catch (err) {
      setTasks(previous);
      setActionError(err?.message || "The issue could not be moved.");
    }
  };

  const startSprint = async (sprint) => {
    setActionError("");
    setStarting(sprint._id);
    try {
      await api.post(`/projects/${project._id}/sprints/${sprint._id}/start`);
      toast(`${sprint.name} started`);
      fetchData();
    } catch (err) {
      setActionError(err?.message || "The sprint could not be started.");
    } finally {
      setStarting(null);
    }
  };

  if (loading) return (<><ProjectPageHeader title="Backlog" /><div className="rounded-md border border-line"><SkeletonRows rows={5} label="Loading backlog" /></div></>);
  if (error) return (<><ProjectPageHeader title="Backlog" /><Alert>{error} <button type="button" onClick={fetchData} className="font-medium underline">Try again</button></Alert></>);

  const open = sprints.filter((s) => s.status === "active" || s.status === "planned").sort((a, b) => (a.status === "active" ? -1 : b.status === "active" ? 1 : (a.order ?? 0) - (b.order ?? 0)));
  const groups = [...open.map((s) => ({ id: s._id, sprint: s })), { id: BACKLOG, sprint: null }];
  const tasksIn = (id) => tasks.filter((t) => (sprintIdOf(t) ?? BACKLOG) === id);
  const moveItemsFor = (task) => groups
    .filter((g) => g.id !== (sprintIdOf(task) ?? BACKLOG))
    .map((g) => ({ label: g.sprint ? `Move to ${g.sprint.name}` : "Move to backlog", icon: ArrowRightLeft, onSelect: () => moveTask(task._id, g.sprint ? g.sprint._id : null) }));

  return (
    <>
      <ProjectPageHeader title="Backlog" actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>Create sprint</Button>} />
      {actionError && <Alert className="mb-3" onDismiss={() => setActionError("")}>{actionError}</Alert>}

      <DndContext
        sensors={sensors}
        onDragEnd={({ active, over }) => {
          if (!over) return;
          const task = tasks.find((t) => t._id === active.id);
          const target = over.id === BACKLOG ? null : over.id;
          if (task && (sprintIdOf(task) ?? null) !== target) moveTask(task._id, target);
        }}
      >
        <div className="space-y-3">
          {groups.map(({ id, sprint }) => {
            const list = tasksIn(id);
            const total = pts(list);
            const health = sprint?.status === "active" ? sprintHealth(sprint, list) : null;
            const over = sprint?.status === "planned" && avgVelocity != null && total > avgVelocity * 1.1;
            const header = (
              <header className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-md bg-surface-raised px-3 py-2.5">
                <h2 className="text-[13px] font-semibold text-text">{sprint ? sprint.name : "Backlog"}</h2>
                {sprint && <span className={cn("inline-flex h-5 items-center rounded-[3px] px-1.5 text-[10.5px] font-bold uppercase tracking-[0.03em]", sprint.status === "active" ? "bg-info-subtle text-info" : "bg-neutral-subtle text-subtle")}>{STATUS_LABEL[sprint.status]}</span>}
                <span className="text-xs text-subtlest">
                  {sprint && `${formatDate(sprint.startDate)} – ${formatDate(sprint.endDate, true)} · `}
                  {list.length} {list.length === 1 ? "issue" : "issues"} · {byCategory(list, "done")} of {total} points
                </span>
                {health && <span className="w-32"><DayBar totalDays={health.totalDays} dayIndex={health.dayIndex} compact /></span>}
                {over && <span className="rounded-[3px] bg-warning-subtle px-1.5 py-0.5 text-xs font-semibold text-warning">{total} pts planned · team averages {avgVelocity}</span>}
                <span className="ml-auto flex items-center gap-1">
                  <span className="hidden items-center gap-1 sm:flex" aria-label="Points by status">
                    <Points value={byCategory(list, "todo")} />
                    <Points value={byCategory(list, "in_progress")} className="bg-info-subtle text-info" />
                    <Points value={byCategory(list, "done")} className="bg-success-subtle text-success" />
                  </span>
                  {sprint?.status === "planned" && <Button size="sm" icon={<Play size={13} />} loading={starting === sprint._id} onClick={() => startSprint(sprint)}>Start sprint</Button>}
                  {sprint?.status === "active" && <Button size="sm" icon={<CheckCircle2 size={13} />} onClick={() => setCompleteTarget(sprint)}>Complete sprint</Button>}
                  {sprint?.status === "planned" && <IconButton label={`Delete ${sprint.name}`} size="sm" tone="danger" onClick={() => setDeleteTarget(sprint)}><Trash2 size={14} /></IconButton>}
                </span>
              </header>
            );
            return (
              <Group key={id} id={id} label={sprint ? sprint.name : "Backlog"} header={header}>
                {list.map((t) => <BacklogRow key={t._id} task={t} projectId={project._id} moveItems={moveItemsFor(t)} />)}
                {list.length === 0 && <li className="border-t border-line px-3 py-3 text-xs text-subtlest">{sprint ? "Drag issues here, or use an issue's ⋯ menu." : "Every issue is in a sprint."}</li>}
              </Group>
            );
          })}
        </div>
      </DndContext>

      {open.length === 0 && (
        <div className="mt-3 rounded-md border border-line bg-surface">
          <EmptyState icon={RouteIcon} title="No sprints planned" description="Create a sprint, move issues into it, then start it." action={<Button size="sm" onClick={() => setCreateOpen(true)}>Create sprint</Button>} />
        </div>
      )}

      <CreateSprintModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (sprint) => {
          await api.post(`/projects/${project._id}/sprints`, sprint);
          toast(`${sprint.name} created`);
          fetchData();
        }}
      />
      <ConfirmDialog
        open={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        onConfirm={async () => {
          await api.post(`/projects/${project._id}/sprints/${completeTarget._id}/complete`, {});
          toast(`${completeTarget.name} completed`);
          fetchData();
        }}
        tone="primary"
        title={`Complete ${completeTarget?.name ?? "sprint"}?`}
        description="Unfinished issues go back to the backlog. The sprint's velocity and burndown are recorded."
        confirmLabel="Complete sprint"
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          await api.delete(`/projects/${project._id}/sprints/${deleteTarget._id}`);
          toast(`${deleteTarget.name} deleted`);
          fetchData();
        }}
        title={`Delete ${deleteTarget?.name ?? "sprint"}?`}
        description="Its issues are kept and moved to the backlog."
        confirmLabel="Delete sprint"
      />
    </>
  );
}
```

- [ ] **Step 5: Implement ProjectReports**

Create `frontend/src/components/project/ProjectReports.jsx`:

```jsx
import { useCallback, useEffect, useState } from "react";
import { ChartLine } from "lucide-react";
import { api } from "../../lib/api";
import { useProject } from "../shell/projectContext";
import { ProjectPageHeader } from "../shell/projectRoutes";
import { Alert, EmptyState, SkeletonRows } from "../ui/Feedback";
import { BurndownChart, VelocityChart } from "./SprintCharts";

const sprintIdOf = (task) => (typeof task.sprint === "object" ? task.sprint?._id : task.sprint);

/** Burndown for the active sprint and velocity across completed ones. */
export default function ProjectReports() {
  const { project } = useProject();
  const [data, setData] = useState({ sprints: [], tasks: [], velocity: { velocityData: [], avgVelocity: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [sprintRes, taskRes, velocityRes] = await Promise.all([
        api.get(`/projects/${project._id}/sprints`),
        api.get(`/tasks/${project._id}`, { params: { limit: 100 } }),
        api.get(`/projects/${project._id}/sprints/velocity`).catch(() => null),
      ]);
      setData({
        sprints: Array.isArray(sprintRes?.data) ? sprintRes.data : [],
        tasks: Array.isArray(taskRes?.data?.tasks) ? taskRes.data.tasks : [],
        velocity: velocityRes?.data ?? { velocityData: [], avgVelocity: 0 },
      });
    } catch (err) {
      setError(err?.message || "Reports could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [project._id]);

  useEffect(() => {
    load();
  }, [load]);

  const active = data.sprints.find((s) => s.status === "active");
  const completed = data.velocity.velocityData ?? [];

  return (
    <>
      <ProjectPageHeader title="Reports" />
      {loading ? (
        <div className="rounded-md border border-line"><SkeletonRows rows={4} label="Loading reports" /></div>
      ) : error ? (
        <Alert>{error} <button type="button" onClick={load} className="font-medium underline">Try again</button></Alert>
      ) : !active && completed.length === 0 ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState icon={ChartLine} title="No sprint data yet" description="Start a sprint to see its burndown; complete one to see velocity." />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {active && <BurndownChart sprint={active} tasks={data.tasks.filter((t) => sprintIdOf(t) === active._id)} />}
          {completed.length > 0 && <VelocityChart data={completed} average={data.velocity.avgVelocity} />}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 6: Routes, deletion, and existing specs**

In `frontend/src/main.jsx`:
- Import `ProjectBacklog` and `ProjectReports`.
- Set `<Route path="backlog" element={<ProjectBacklog />} />` and `<Route path="reports" element={<ProjectReports />} />`.
- Delete `TempSprints`, the `ProjectSprints` import, and any of the temporary imports
  (`ProjectPageHeader`, `useProject`) that nothing in `main.jsx` still uses.

Run: `git rm frontend/src/components/project/ProjectSprints.jsx`

In `frontend/e2e/collaboration.spec.js`, the sprint-charts test: change the URL
`` `/dashboard/projects/${project._id}/backlog` `` to `` `/dashboard/projects/${project._id}/reports` ``.

In `frontend/e2e/task-details.spec.js`, the assertion
`` page.locator(`section[aria-label="Sprint A"]`) `` … `"0 of 8 points"` keeps working, because the
backlog header says "0 of 8 points". Leave it unchanged and confirm it passes.

- [ ] **Step 7: Verify**

Run: `cd frontend && npm run lint && npm run build`, then the full E2E suite.
Expected: everything passes, including the new backlog test, the charts test on `/reports`, and
"Sprint A … 0 of 8 points".

- [ ] **Step 8: Commit**

```bash
git add -A frontend/src/components/project frontend/src/main.jsx frontend/e2e
git commit -m "Split sprints into a Jira-style Backlog and a Reports page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: WIP limits in Project settings

**Files:**
- Create: `frontend/src/components/project/WipLimitsPanel.jsx`
- Modify: `frontend/src/components/shell/projectRoutes.jsx` (`ProjectSettingsPage`)
- Test: `frontend/e2e/sprint-cockpit.spec.js`

**Interfaces:**
- Consumes:
  - `PUT /projects/:id { wipLimits }` (Task 3);
  - `useProject()` → `{ project, refresh }`;
  - `BOARD_COLUMNS` and `STATUS_META`.
- Produces: a panel headed "WIP limits", with one number input per status labelled
  "`<Status>` limit" and a "Save limits" button. Only project editors see it.

- [ ] **Step 1: Write the failing E2E test**

Append to `frontend/e2e/sprint-cockpit.spec.js`:

```js
test("a manager sets a WIP limit in Project settings and the board marks the column", async ({ browser }) => {
  test.skip(({ isMobile }) => isMobile, "Column headers are compared side by side on desktop");
  const owner = await person(browser, "wipui");
  const p = await project(owner);
  await scrumSprint(owner, p, [{ title: "One", status: "in_progress" }, { title: "Two", status: "in_progress" }]);

  await owner.page.goto(`/dashboard/projects/${p._id}/settings`);
  await owner.page.getByLabel("In Progress limit").fill("1");
  await owner.page.getByRole("button", { name: "Save limits" }).click();
  await expect(owner.page.getByText("WIP limits saved")).toBeVisible();

  await owner.page.goto(`/dashboard/projects/${p._id}/board`);
  await expect(owner.page.locator('[data-column-header="in_progress"]')).toContainText("2 / 1");
  await owner.context.close();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx playwright test e2e/sprint-cockpit.spec.js -g "WIP limit in Project settings" --project=desktop-chromium`
Expected: FAIL. There is no "In Progress limit" field yet.

- [ ] **Step 3: Implement**

Create `frontend/src/components/project/WipLimitsPanel.jsx`:

```jsx
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { memberUserId } from "../../lib/format";
import { BOARD_COLUMNS, STATUS_META } from "../../lib/taskStatus";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Field";
import { Alert } from "../ui/Feedback";
import { useToast } from "../ui/Toast";

// Mirrors the permission matrix: project:update for these project roles.
const EDITORS = new Set(["project_manager", "scrum_master", "team_lead"]);

export default function WipLimitsPanel({ project, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const limits = project.settings?.wipLimits ?? {};
    setValues(Object.fromEntries(BOARD_COLUMNS.map((s) => [s, String(limits[s] ?? 0)])));
  }, [project]);

  const myRole = project.members?.find((m) => memberUserId(m) === user?._id)?.role;
  if (!EDITORS.has(myRole) && !["super_admin", "product_manager"].includes(user?.systemRole)) return null;

  const submit = async (e) => {
    e.preventDefault();
    const parsed = {};
    for (const s of BOARD_COLUMNS) {
      const n = Number(values[s] === "" ? 0 : values[s]);
      if (!Number.isInteger(n) || n < 0 || n > 99) {
        setError(`${STATUS_META[s].label}: use a whole number from 0 to 99.`);
        return;
      }
      parsed[s] = n;
    }
    try {
      setSaving(true);
      setError("");
      await api.put(`/projects/${project._id}`, { wipLimits: parsed });
      toast("WIP limits saved");
      onSaved();
    } catch (err) {
      setError(err?.message || "The limits could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="wip-heading" className="mt-8 rounded-md border border-line bg-surface p-4">
      <h2 id="wip-heading" className="text-[13px] font-semibold text-text">WIP limits</h2>
      <p className="mt-1 text-[13px] text-subtle">
        The most issues a board column should hold. A column over its limit turns red; moves are never blocked. 0 means no limit.
      </p>
      <form onSubmit={submit} noValidate className="mt-4">
        {error && <Alert className="mb-3">{error}</Alert>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BOARD_COLUMNS.map((s) => (
            <Field key={s} label={`${STATUS_META[s].label} limit`}>
              <Input type="number" min={0} max={99} inputMode="numeric" value={values[s] ?? "0"} onChange={(e) => setValues({ ...values, [s]: e.target.value })} />
            </Field>
          ))}
        </div>
        <div className="mt-4">
          <Button type="submit" variant="primary" size="sm" loading={saving}>Save limits</Button>
        </div>
      </form>
    </section>
  );
}
```

In `frontend/src/components/shell/projectRoutes.jsx`, add
`import WipLimitsPanel from "../project/WipLimitsPanel";`. Then replace `ProjectSettingsPage` with:

```jsx
export function ProjectSettingsPage() {
  const { project, refresh } = useProject();
  return (
    <>
      <ProjectPageHeader title="Project settings" />
      <ProjectSettings project={project} onProjectUpdate={refresh} />
      <WipLimitsPanel project={project} onSaved={refresh} />
    </>
  );
}
```

(`Field` clones its child with a generated `id` and renders `<label htmlFor={id}>`, so
`getByLabel("In Progress limit")` finds the input.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm run lint && npm run build && npx playwright test e2e/sprint-cockpit.spec.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/project/WipLimitsPanel.jsx frontend/src/components/shell/projectRoutes.jsx frontend/e2e/sprint-cockpit.spec.js
git commit -m "Let project leads set WIP limits from Project settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Issue view: status control, full details, History tab

**Files:**
- Create: `frontend/src/components/tasks/TaskHistory.jsx`
- Modify: `frontend/src/pages/TaskDetail.jsx` (aside details; comments section; action buttons)
- Modify: `frontend/src/components/CreateTaskModal.jsx` (`parentId` prop)
- Test: `frontend/e2e/sprint-cockpit.spec.js`

**Interfaces:**
- Consumes:
  - `STATUS_TONE` and `formatMinutes` (Task 2);
  - `Tabs({ items, value, onChange, label })` and `TabPanel({ id, children })` from `ui/Navigation`;
  - `task.stateTransitions` `[{ from, to, changedBy, changedAt }]`;
  - `members` (already loaded by TaskDetail).
- Produces:
  - **The aside opens with** the status select (still labelled "Status"), styled as a lozenge.
  - **Details rows:** Reporter, Sprint (always shown), and Time ("`<est>` estimate · `<rem>` left").
  - **Tabs:** "Comments `<n>`" and "History".
  - **`TaskHistory({ transitions, members })`.**

- [ ] **Step 1: Write the failing E2E test**

Append to `frontend/e2e/sprint-cockpit.spec.js`:

```js
test("issue view: change status from the status control and see it in History", async ({ browser }) => {
  const owner = await person(browser, "issue");
  const p = await project(owner);
  const task = await json(await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { title: "Track me", originalEstimate: 420 } }));

  await owner.page.goto(`/dashboard/tasks/${task._id}?projectId=${p._id}`);
  await expect(owner.page.getByText("7h estimate")).toBeVisible();
  await owner.page.getByLabel("Status").selectOption("in_progress");
  await expect(owner.page.getByLabel("Status")).toHaveValue("in_progress");

  await owner.page.getByRole("tab", { name: "History" }).click();
  const history = owner.page.getByRole("tabpanel");
  await expect(history).toContainText(owner.name);
  await expect(history).toContainText(/To Do/i);
  await expect(history).toContainText(/In Progress/i);
  await owner.context.close();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx playwright test e2e/sprint-cockpit.spec.js -g "issue view" --project=desktop-chromium`
Expected: FAIL. "7h estimate" is not shown, and there is no History tab.

- [ ] **Step 3: TaskHistory**

Create `frontend/src/components/tasks/TaskHistory.jsx`:

```jsx
import { memberUserId, nameOf } from "../../lib/format";
import { timeAgo } from "../../lib/time";
import { Avatar, StatusBadge } from "../ui/Display";

const idOf = (value) => (typeof value === "object" ? value?._id : value);

/** The workflow history the backend records on every status change, newest first. */
export default function TaskHistory({ transitions = [], members = [] }) {
  const names = new Map(members.map((m) => [String(memberUserId(m)), nameOf(m.user)]));
  if (transitions.length === 0) return <p className="text-[13px] text-subtlest">No changes recorded yet.</p>;
  return (
    <ol className="space-y-3">
      {[...transitions].reverse().map((t, i) => {
        const who = names.get(String(idOf(t.changedBy))) ?? "A former member";
        return (
          <li key={t._id ?? i} className="flex items-start gap-3 text-[13px]">
            <Avatar name={who} size="sm" />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-text">
                <span className="font-medium">{who}</span>
                {t.from === "none" ? (
                  <>created the issue as <StatusBadge status={t.to} /></>
                ) : (
                  <>moved <StatusBadge status={t.from} /> <span aria-hidden="true">→</span><span className="sr-only">to</span> <StatusBadge status={t.to} /></>
                )}
              </p>
              <time dateTime={t.changedAt} className="text-xs text-subtlest">{timeAgo(t.changedAt)}</time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 4: Update TaskDetail**

In `frontend/src/pages/TaskDetail.jsx`:

1. Add the imports. Add `import TaskHistory from "../components/tasks/TaskHistory";` and
   `import { Tabs, TabPanel } from "../components/ui/Navigation";`, or extend the existing
   Navigation import. Add `STATUS_TONE` to the `../lib/taskStatus` import and `formatMinutes` to
   the `../lib/format` import. Import `cn` from `../lib/utils` if it isn't already.
2. Add state next to the other `useState` calls: `const [detailTab, setDetailTab] = useState("comments");`
3. Replace the `<DetailRow label="Status"> … </DetailRow>` block with nothing. Directly above
   `<dl>` inside the `<aside>`, add:

```jsx
          <Select
            aria-label="Status"
            value={task.status || "todo"}
            onChange={(e) => handleUpdateTask({ status: e.target.value })}
            className={cn("h-8 w-auto border-transparent text-[12px] font-bold uppercase tracking-[0.03em]", STATUS_TONE[task.status] ?? STATUS_TONE.todo)}
          >
            {BOARD_COLUMNS.map((key) => (
              <option key={key} value={key}>{STATUS_META[key].label}</option>
            ))}
          </Select>
```

4. Replace `{task.sprint && <DetailRow label="Sprint">{task.sprint.name}</DetailRow>}` with:

```jsx
            <DetailRow label="Reporter">{task.reporter ? nameOf(task.reporter) : <span className="text-subtlest">Unknown</span>}</DetailRow>
            <DetailRow label="Sprint">{task.sprint?.name ?? <span className="text-subtlest">Backlog</span>}</DetailRow>
            <DetailRow label="Time">
              <span className="block">
                <span className="block h-1.5 overflow-hidden rounded-full bg-surface-hover" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${task.timeTracking?.originalEstimate ? Math.max(0, Math.min(100, 100 - (100 * (task.timeTracking.timeRemaining ?? 0)) / task.timeTracking.originalEstimate)) : 0}%` }}
                  />
                </span>
                <span className="text-xs text-subtle">
                  {formatMinutes(task.timeTracking?.originalEstimate)} estimate · {formatMinutes(task.timeTracking?.timeRemaining)} left
                </span>
              </span>
            </DetailRow>
```

(`nameOf` is already imported in this file. If not, add it to the `../lib/format` import.)

5. In the Comments `<section aria-labelledby="comments-heading">`, replace the `<h2 id="comments-heading" …>…</h2>`
   with the tabs. Wrap the existing `{comments.length > 0 && (<ol …>)}` list and the comment
   `<form>` in the comments panel:

```jsx
            <h2 id="comments-heading" className="sr-only">Activity</h2>
            <Tabs
              label="Issue activity"
              value={detailTab}
              onChange={setDetailTab}
              items={[{ id: "comments", label: `Comments ${comments.length}` }, { id: "history", label: "History" }]}
              className="mb-4"
            />
            <TabPanel id={detailTab}>
              {detailTab === "comments" ? (
                <>
                  {/* existing <ol> of <Comment> items, unchanged */}
                  {/* existing comment <form>, unchanged */}
                </>
              ) : (
                <TaskHistory transitions={task.stateTransitions ?? []} members={members} />
              )}
            </TabPanel>
```

Move the existing `<ol>…</ol>` and `<form>…</form>` JSX into that fragment, replacing the two JSX
comments. Do not change them otherwise.

6. **Child issues.** In `frontend/src/components/CreateTaskModal.jsx`:
   - Change the signature to
     `export default function CreateTaskModal({ isOpen, onClose, onSuccess, defaultProjectId, parentId })`.
   - In the `api.post` body, add `parent: parentId || undefined,` after `storyPoints`.
   - The backend already checks that the parent is in the same project.

7. **Action buttons under the title.** In `TaskDetail.jsx`:
   - Add `const subtaskInputRef = useRef(null);` and `const [childOpen, setChildOpen] = useState(false);`.
     Import `useRef`. Import `CreateTaskModal from "../components/CreateTaskModal"` and `ListPlus`
     from `lucide-react`, if they aren't already imported.
   - Give the "New subtask" `<Input>` the prop `ref={subtaskInputRef}`. `Input` is a `forwardRef`.
   - In the non-edit branch, directly after the `<div className="flex items-start justify-between gap-4">…</div>`
     that holds the `h1` and Edit button, add:

```jsx
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" icon={<Plus size={13} />} onClick={() => subtaskInputRef.current?.focus()}>Subtask</Button>
                <Button size="sm" icon={<ListPlus size={13} />} onClick={() => setChildOpen(true)}>Add child issue</Button>
              </div>
```

   - Next to the two `ConfirmDialog`s at the end of the JSX, add:

```jsx
      <CreateTaskModal
        isOpen={childOpen}
        onClose={() => setChildOpen(false)}
        defaultProjectId={projectId}
        parentId={task._id}
        onSuccess={(child) => toast(child?.issueKey ? `${child.issueKey} created under ${task.issueKey}` : "Child issue created")}
      />
```

   The title and description keep the existing in-place **Edit** form (Edit → fields → Save). That
   is the spec's "inline edit" for those two fields; the Details rows already save on change.

- [ ] **Step 5: Run the tests**

Run: `cd frontend && npm run lint && npm run build`, then
`npx playwright test e2e/sprint-cockpit.spec.js e2e/collaboration.spec.js e2e/task-details.spec.js`.
Expected: PASS. The comments tests still find the comment form, because Comments is the default tab.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/tasks/TaskHistory.jsx frontend/src/pages/TaskDetail.jsx frontend/e2e/sprint-cockpit.spec.js
git commit -m "Issue view: lozenge status control, reporter/sprint/time details, History tab

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Your work

**Files:**
- Create: `frontend/src/components/dashboard/ProjectPulseCard.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Delete: `frontend/src/components/dashboard/{MetricCard,WorkProgressChart,UpcomingDeadlines,MyTasksTable,ActiveProjects}.jsx`
- Modify: `frontend/e2e/task-details.spec.js` (the dashboard feed step opens "Team activity")
- Test: `frontend/e2e/sprint-cockpit.spec.js`

**Interfaces:**
- Consumes:
  - `stats.recentProjects[].activeSprint`, `stats.assignedToMe` and `stats.dueSoon` (Task 4);
  - `sprintHealthFromTotals` (Task 1);
  - `DayBar` and `HealthLozenge` (Task 8);
  - `ProjectBadge` (Task 6);
  - `RecentActivity({ items })` (existing).
- Produces:
  - Project cards as links named after the project.
  - Tabs "Assigned to me `<n>`", "Due soon `<n>`" and "Team activity".

- [ ] **Step 1: Write the failing E2E test**

Append to `frontend/e2e/sprint-cockpit.spec.js`:

```js
test("your work shows each project's sprint health and what is assigned to me", async ({ browser }) => {
  const owner = await person(browser, "yours");
  const p = await project(owner);
  await scrumSprint(owner, p, [{ title: "My open issue", storyPoints: 3, assignees: [owner.id] }]);

  await owner.page.goto("/dashboard");
  const card = owner.page.getByRole("link", { name: new RegExp(p.name) }).filter({ hasText: "day 1 of 10" });
  await expect(card).toBeVisible();
  await expect(card).toContainText(/On track|At risk|Off track/);
  await expect(owner.page.getByRole("tab", { name: /Assigned to me 1/ })).toBeVisible();
  await expect(owner.page.getByRole("tabpanel")).toContainText("My open issue");
  await owner.context.close();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx playwright test e2e/sprint-cockpit.spec.js -g "your work" --project=desktop-chromium`
Expected: FAIL. There is no card with "day 1 of 10".

- [ ] **Step 3: ProjectPulseCard**

Create `frontend/src/components/dashboard/ProjectPulseCard.jsx`:

```jsx
import { Link } from "react-router-dom";
import { sprintHealthFromTotals } from "../../lib/sprintHealth";
import ProjectBadge from "../shell/ProjectBadge";
import { DayBar, HealthLozenge } from "../project/SprintTide";

/** A recent project with its active sprint in miniature (or its done count for Kanban). */
export default function ProjectPulseCard({ project }) {
  const s = project.activeSprint;
  const pointsMode = (s?.totalPoints ?? 0) > 0;
  const h = s
    ? sprintHealthFromTotals(s, {
        unit: pointsMode ? "pts" : "issues",
        total: pointsMode ? s.totalPoints : s.totalIssues,
        remaining: pointsMode ? s.remainingPoints : s.openIssues,
        startTotal: pointsMode ? s.startPoints : null,
      })
    : null;

  return (
    <Link to={`/dashboard/projects/${project._id}`} className="block rounded-md border border-line bg-surface p-3 shadow-card transition-colors hover:border-line-strong">
      <span className="flex items-center gap-2">
        <ProjectBadge project={project} />
        <span className="truncate text-[13px] font-semibold text-text">{project.name}</span>
        <span className="ml-auto">{h && <HealthLozenge health={h.health} />}</span>
      </span>
      {s ? (
        <>
          <span className="mt-3 block"><DayBar totalDays={h.totalDays} dayIndex={h.dayIndex} compact /></span>
          <span className="mt-1.5 block text-xs text-subtlest">
            {s.name} · day {h.dayIndex} of {h.totalDays} · {s.myOpenIssues} of your issues open
          </span>
        </>
      ) : (
        <span className="mt-3 block text-xs text-subtlest">{project.completedTasks} of {project.totalTasks} issues done</span>
      )}
    </Link>
  );
}
```

- [ ] **Step 4: Rewrite the Dashboard body**

In `frontend/src/pages/Dashboard.jsx`:

1. Change the imports:
   - Remove the `MetricStrip`, `WorkProgressChart`, `UpcomingDeadlines`, `MyTasksTable` and `ActiveProjects` imports.
   - Add `import ProjectPulseCard from "../components/dashboard/ProjectPulseCard";`.
   - Add `import { Link } from "react-router-dom";`. Add `Link` to the existing react-router import if there is one; there is `useNavigate`.
   - Add `import { Tabs, TabPanel } from "../components/ui/Navigation";`, extending the `PageHeader` import.
   - Add `import { DueDate, Key, StatusBadge } from "../components/ui/Display";` and `import { taskPath } from "../lib/format";`.
2. Add state: `const [tab, setTab] = useState("assigned");`
3. Inside the component, above `return`, add:

```jsx
  const assigned = stats?.assignedToMe || [];
  const dueSoon = stats?.dueSoon || [];
  const issueList = (items, empty) =>
    items.length === 0 ? (
      <p className="px-1 py-6 text-center text-[13px] text-subtlest">{empty}</p>
    ) : (
      <ul className="divide-y divide-line rounded-md border border-line bg-surface">
        {items.map((t) => (
          <li key={t._id}>
            <Link to={taskPath(t)} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 hover:bg-surface-raised sm:grid-cols-[4.5rem_minmax(0,1fr)_auto_auto]">
              <Key>{t.issueKey}</Key>
              <span className="truncate text-[13px] text-text">{t.title}</span>
              <StatusBadge status={t.status} className="hidden sm:inline-flex" />
              <DueDate date={t.dueDate} empty={null} className="text-xs" />
            </Link>
          </li>
        ))}
      </ul>
    );
```

4. Replace everything between `<>` and `</>` in the `hasProjects` branch (the `MetricStrip` and both
   grids) with:

```jsx
          <section aria-labelledby="pulse-heading">
            <h2 id="pulse-heading" className="mb-2 text-[13px] font-semibold text-text">Your projects</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {recentProjects.map((p) => <ProjectPulseCard key={p._id} project={p} />)}
            </div>
          </section>

          <section aria-label="Your issues">
            <Tabs
              label="Your issues"
              value={tab}
              onChange={setTab}
              items={[
                { id: "assigned", label: `Assigned to me ${assigned.length}` },
                { id: "due", label: `Due soon ${dueSoon.length}` },
                { id: "activity", label: "Team activity" },
              ]}
              className="mb-3"
            />
            <TabPanel id={tab}>
              {tab === "assigned" && issueList(assigned, "Nothing is assigned to you right now.")}
              {tab === "due" && issueList(dueSoon, "Nothing of yours is due in the next 7 days.")}
              {tab === "activity" && <RecentActivity items={recentActivities} />}
            </TabPanel>
          </section>
```

5. Delete the now-unused variables `inDevTasks`, `reviewTasks` and `completedTasks`.
6. Delete the old components. First check nothing else imports them:
   `grep -rn "MetricCard\|WorkProgressChart\|UpcomingDeadlines\|MyTasksTable\|ActiveProjects" frontend/src`
   should print nothing. Then run
   `git rm frontend/src/components/dashboard/{MetricCard,WorkProgressChart,UpcomingDeadlines,MyTasksTable,ActiveProjects}.jsx`.

- [ ] **Step 5: Update the dashboard-feed E2E step**

In `frontend/e2e/task-details.spec.js`, directly after `await page.goto("/dashboard");` (before the
`link` lookup), add:

```js
  await page.getByRole("tab", { name: "Team activity" }).click();
```

- [ ] **Step 6: Verify**

Run: `cd frontend && npm run lint && npm run build`, then the full E2E suite.
Expected: everything passes, including "register → dashboard" (the greeting `h1` is unchanged) and
the new Your work test.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src/components/dashboard frontend/src/pages/Dashboard.jsx frontend/e2e
git commit -m "Replace the dashboard with Your work: project sprint health and my issues

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Full verification and QA record

**Files:**
- Modify: `docs/QA_CHECKLIST.md`

- [ ] **Step 1: Every automated check**

Run:

```bash
cd backend && npm run check:syntax && npm test && npm audit --omit=dev
cd ../frontend && npm test && npm run lint && npm run build
```

Expected:
- Backend: syntax clean, all tests pass, 0 vulnerabilities.
- Frontend: unit tests pass, no new lint warnings (3 existing), the build succeeds.

Then run the E2E suite (see Global Constraints).
Expected: every test passes, with only the device-specific skips.

- [ ] **Step 2: Browser check with the demo data**

Terminal 1: `cd backend && npm run demo` (an in-memory API on :8000, seeded; password `DemoPass123`).
Terminal 2: `cd frontend && npm run dev`. Sign in as `priya@demo.dev`.

Check each of the following at 1440px and at 390px, in light and dark mode (Account menu → theme).
Keep the browser console open; there must be no errors.

1. **Your work:** project cards show a mini strip and a health lozenge, and the three tabs work.
2. **Payments Platform → Board:**
   - the strip shows "Day x of y" and points left;
   - "By assignee" shows swimlanes;
   - a card moves by drag, by keyboard (Space, then → and Space) and by its ⋯ menu.
3. **Project settings → WIP limits:** set In Progress to 1. The Board's In Progress header turns red
   and reads "n / 1".
4. **Backlog:** move an issue with ⋯ and by dragging. The overcommit warning shows on a planned
   sprint that has more points than the average.
5. **Issue view:** the status lozenge select, the Details rows, and the History tab.
6. **Old link:** open `/dashboard/projects/<id>?tab=sprints`. It lands on `/backlog`.
7. **Phone (390px):** the ☰ drawer holds the global links plus the project links; the board shows
   one column at a time.

Measure contrast for any new pair that looks borderline: lozenges, top-bar links, and the
active sidebar item. Use the formula from `$CLAUDE_JOB_DIR/tmp/contrast.mjs`, or the browser
DevTools contrast checker. Each must be at least 4.5:1.

- [ ] **Step 3: Record it**

Append a dated section to `docs/QA_CHECKLIST.md`, "2026-10-24 — Sprint cockpit redesign": a table
of the checks in Step 2 with Pass or Fail, the E2E totals, and the new automated tests:

- `frontend/src/lib/*.test.js`
- `backend/tests/api/projects.test.js` (WIP limits)
- `backend/tests/api/dashboard.test.js` (your work)
- `frontend/e2e/sprint-cockpit.spec.js`

- [ ] **Step 4: Commit**

```bash
git add docs/QA_CHECKLIST.md
git commit -m "Record verification of the sprint cockpit redesign

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
