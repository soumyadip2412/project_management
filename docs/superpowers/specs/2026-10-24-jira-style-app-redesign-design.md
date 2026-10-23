# Jira-style app redesign ("Sprint cockpit") — design

Date: 2026-10-24 · Branch: `ocean-depths-theme` · Status: awaiting review

## 1. Intent

**What the user asked for.** The signed-in app "looks like AI slop, nothing unique". It should look
fully professional, like an Agile tool in the Jira class, and still have a creative signature of its
own. The audience is a client who will judge the product, mostly from inside the app.

**Agreed in brainstorming (visual companion, three screens):**

- Structure from option A ("Jira classic"): a global navy top bar and a per-project sidebar.
- Signature from option C ("Sprint cockpit"): a sprint strip on sprint views, swimlanes by assignee,
  WIP limits, and an On track / At risk badge.
- The app comes first. The landing page is redone afterwards in its **own spec** (out of scope here).
- `+ Create` creates an issue; "New project" moves to the Projects page and the Projects ▾ menu.
- Watching issues and logging time are **not** added: the backend has no API for them, and the issue
  view shows estimate vs remaining instead.

**Success criteria.**

1. Every screen in the app uses the new shell. No old tab row and no old sidebar remain.
2. Each number on the sprint strip, the health badge and the backlog overcommit warning comes from
   stored data. Nothing is mocked.
3. Text and controls meet WCAG AA contrast (≥ 4.5:1) in light and dark mode.
4. Keyboard users can do everything a mouse user can, including moving issues on the board and the
   backlog.
5. Backend tests, Playwright (desktop + mobile), lint and build all pass. The changed flows are
   checked in a real browser in light and dark mode.

## 2. Information architecture

### Global top bar (every signed-in page)

From left to right:

- Logo, linking to Your work.
- **Your work**.
- **Projects ▾**, a menu: up to 5 recent projects, "View all projects", "New project".
- **Workspaces**.
- **Team**.
- **+ Create**, which opens `CreateTaskModal`. Inside a project, that project is preselected.
- Search (the existing `GlobalSearch`, Ctrl/⌘ K).
- Notifications (the existing component).
- Avatar menu: Settings, Theme (light / dark / system), Log out.

The current top-level item is marked with a teal underline.

### Sidebar: two modes

| Context | Sidebar contents |
|---|---|
| Inside a project (`/dashboard/projects/:projectId/*`) | Project header (key badge, name, methodology · member count), then **Planning:** Summary, Board, Backlog, Reports. Then **Project:** All issues, Notes, Members. At the bottom: Project settings. |
| Everywhere else | Your work, Assigned to me (count), Notifications (unread count). Then **Recent projects** (up to 5, with key badges), then "View all projects". |

Kanban and waterfall projects hide **Backlog** and get no sprint strip. Their Board shows every
issue that isn't in the backlog.

### Routes

| Route | Screen |
|---|---|
| `/dashboard` | Your work (replaces Dashboard) |
| `/dashboard/tasks` | Assigned to me (the existing Tasks page, restyled) |
| `/dashboard/tasks/:taskId` | Issue view |
| `/dashboard/projects` | Projects list (gains the "New project" button) |
| `/dashboard/projects/:projectId` | Redirects to `board` (Scrum or Kanban) or `summary` (waterfall) |
| `/dashboard/projects/:projectId/summary` | Summary: today's Overview, plus the sprint strip |
| `/dashboard/projects/:projectId/board` | Board |
| `/dashboard/projects/:projectId/backlog` | Backlog (Scrum only) |
| `/dashboard/projects/:projectId/reports` | Reports: burndown and velocity (today's `SprintCharts`) |
| `/dashboard/projects/:projectId/issues` | All issues (today's `ProjectTasks` list) |
| `/dashboard/projects/:projectId/notes` · `/members` · `/settings` | As today, inside the new frame |
| `/dashboard/workspaces` · `/team` · `/settings` | As today, inside the new frame |

Old `?tab=` links redirect: `overview`→`summary`, `tasks`→`issues`, `sprints`→`backlog`, and every
other tab to the route of the same name. Emailed links and existing bookmarks therefore keep working.

### Phone layout (below 1024px)

The top bar keeps the logo, search, `+ Create` and the avatar. A menu button opens one drawer that
holds the global links and, inside a project, the project sidebar below them. The board shows one
column at a time, as now.

## 3. Screens

### 3.1 Board

From top to bottom:

1. **Breadcrumb:** Projects / {project} / Board.
2. **Sprint strip** (Scrum, while a sprint is active; see §4).
3. **Toolbar:** search the board, an assignee avatar filter, Type ▾, Priority ▾, and a
   **Group: none | by assignee** toggle. The toggle choice is remembered per project in
   `localStorage`.
4. **Columns:** the canonical statuses from `lib/taskStatus.js` `BOARD_COLUMNS`, each with a 3px top
   rule in its status colour, an uppercase name and a count.
   - If the column has a WIP limit, the count reads `4 / 3`.
   - When a column is over its limit, its background tints `danger-subtle` and the count turns red.
   - A limit never blocks a move (Jira behaves the same way).
5. **Swimlanes** (when grouped): one lane per assignee, ordered by name, with an "Unassigned" lane
   last. Each lane header shows the avatar, the name and the points in that lane.
6. **Cards:** title, then a row with the type mark, the mono issue key, points and the assignee
   avatar. Done cards are dimmed with the title struck through.

**Which issues appear:**

- **Scrum with an active sprint:** the issues in that sprint.
- **Scrum with no active sprint:** an empty state, "No active sprint", with a link to Backlog.
- **Kanban or waterfall:** every issue whose status isn't `backlog`.

Moving a card keeps today's three ways: mouse drag (dnd-kit), keyboard, and the card's ⋯ menu.

### 3.2 Backlog (Scrum only)

1. **Header:** title, search, Type ▾, `+ Create sprint`.
2. **One group per sprint:** the active sprint first, then planned sprints by `order`.
   - **Group header:** name, status lozenge, dates and issue count. The active sprint also shows a
     mini sprint strip.
   - **Point totals per status category:** to do, in progress, done.
   - **Actions:** Complete sprint (active) or Start sprint (planned).
3. **Overcommit warning** on planned sprints: "{planned} pts planned · team averages {avg}". It
   shows when planned points exceed the average velocity from `GET /sprints/velocity` by more than
   10%. It is hidden when no sprint has been completed yet.
4. **Backlog group:** issues with no sprint, then a "+ Create issue" row (opens `CreateTaskModal`).
5. **Rows:** type mark, key, title, status lozenge, points, assignee and a ⋯ menu.
   - The menu offers "Move to {sprint}" for each other sprint, and "Move to backlog".
   - Rows can also be dragged between groups.
   - Either way, the move is `PUT /tasks/:projectId/t/:taskId { sprint }`.

Start and Complete keep today's behaviour and error messages, including the new "end date has
passed" 400.

### 3.3 Issue view (`/dashboard/tasks/:taskId?projectId=…`, the existing URL from `taskPath()`)

A two-column layout: content on the left, details 280px wide on the right. Below 1024px it becomes
one column with the details first.

**Left column:**

- Breadcrumb: project / type mark / key.
- Title: inline edit.
- Action buttons: `+ Subtask`, `Add child issue` (opens `CreateTaskModal` with `parent` set) and ⋯
  (Delete).
- Description: inline edit.
- Subtasks: a progress bar plus the list.
- Tabs **Comments | History**. History renders `stateTransitions`, which the backend already
  records ("Arjun moved In progress → In review · 2h ago").

**Right column:**

- A status button coloured by its category, which changes the status in place.
- A **Details** panel: Assignee, Reporter (read only), Sprint, Story points, Priority, Labels, Due,
  Time (bar for estimate vs remaining). Every field except Reporter edits inline.
- "Created … · Updated …".

### 3.4 Your work (`/dashboard`)

- Greeting and date.
- **Project cards** for up to 6 recent projects:
  - key badge, name and health badge;
  - a mini sprint strip with "Sprint N · day x of y · n of your issues open";
  - a Kanban project shows its open and done counts instead.
- **Tabs:** Assigned to me (count) · Due soon (count) · Team activity.
  - *Assigned to me* lists open issues assigned to the user.
  - *Due soon* lists issues due within 7 days or overdue.
  - *Team activity* is the existing `recentActivities`: changes by anyone in the user's projects.
    It is named for what it holds, since it is not limited to the user's own work.
- Rows show key, title, status lozenge and due date. The existing `InvitationsBanner` stays at the
  top.

### 3.5 Summary, Reports, All issues, Notes, Members, Settings

Their content stays the same. They move into the new frame and use the new primitives.

- **Summary** adds the sprint strip.
- **Reports** reuses `SprintCharts` (burndown for the active sprint, velocity).
- **Project settings** gains a **WIP limits** section: one number per board column, where 0 means no
  limit.

## 4. The sprint strip (`SprintTide`) and sprint health

One component, `components/project/SprintTide.jsx`, with a `compact` variant for Backlog headers and
Your work cards.

**Inputs:** the active sprint (`startDate`, `endDate`, `goal`, `name`, `burndownData`) and its issues
(`storyPoints`, `statusCategory`).

**Computed by a pure module, `lib/sprintHealth.js`:**

| Value | Rule |
|---|---|
| `totalDays` | Calendar days from start to end inclusive: `max(1, ceil((end − start) / day))` |
| `dayIndex` | Today's position, clamped to `1..totalDays` (before the start → 0) |
| `totalPoints` / `remainingPoints` | Sum of `storyPoints` over the sprint's issues / over issues whose `statusCategory !== "done"` |
| `addedPoints` | `max(0, totalPoints − burndownData[0].totalPoints)`, the snapshot taken when the sprint started. 0 if there is no snapshot. |
| `idealRemaining` | `totalPoints × (1 − dayIndex / totalDays)` |
| `health` | `overdue` if today is past the end and anything remains. Otherwise, with `gap = (remainingPoints − idealRemaining) / totalPoints`: `on_track` when gap ≤ 0.10, `at_risk` when ≤ 0.25, `off_track` beyond that. |
| No estimates | If `totalPoints === 0`, every rule runs on issue counts and the strip says "issues" instead of "pts" |

**Display:**

- One segment per day, capped at 20 visual segments. Longer sprints show proportional segments, and
  the label still gives the real day.
- Elapsed days are teal, today's segment has a ring, and future days are `line` grey.
- Text: "Day x of y · r of t pts left", plus "· +a pts added" in warning colour when a > 0.
- On the right: the health lozenge (green, warning, danger or danger) and a 78×22 sparkline of ideal
  (dashed) vs actual remaining, built from `burndownData` plus today's computed point.
- The strip has `role="group"` with an `aria-label` that gives the whole sentence, so screen readers
  get "Sprint 2, day 6 of 10, 14 of 24 points left, at risk".

## 5. Visual language

| Decision | Value |
|---|---|
| Fonts | IBM Plex Sans 400/500/600/700 and IBM Plex Mono 400/500 (Google Fonts) replace Geist / Geist Mono. Mono is used for issue keys, counts in tables and kbd hints. |
| Base size | 14px body, 13px dense lists, 20px page titles, 17px section titles |
| Radius | 4px controls and cards, 6px panels and columns, 8px modals |
| Row height | 32px lists (40px with `pointer-coarse`) |
| Elevation | Cards: `0 1px 1px rgba(15,23,34,.12), 0 0 1px rgba(15,23,34,.2)`. Menus and modals: the existing `shadow-overlay`. Nothing else has a shadow. |
| Status lozenges | Uppercase, 10.5px/700, 3px radius, a tinted background with the status colour as text (`StatusBadge` is restyled; its API is unchanged) |
| Issue type marks | 14px filled squares in the type colour with a white lucide glyph (`IssueTypeIcon` restyled) |
| Top bar | 48px, `--sidebar` navy, the `.surface-navy` token scope, a teal underline for the active item |
| Sidebar | 240px, `surface` white (navy only in dark mode). Active item: `primary-subtle` background, a 3px teal inset bar, primary text. |
| Not allowed in the app | Gradients, glows, blurred blobs, emoji as icons, cards inside cards |

The Ocean Depths tokens stay. One token is added for the top bar's active underline: `--topbar-accent`
(`#5cc4c4`). The navy moves from the sidebar to the top bar.

## 6. Components and file plan

**New:**

| File | Purpose |
|---|---|
| `components/shell/TopBar.jsx` | Global bar, Projects ▾ menu, avatar menu |
| `components/shell/AppSidebar.jsx` | Chooses the global or project sidebar from the route |
| `components/shell/ProjectSidebar.jsx` | Project header and project navigation |
| `components/shell/ProjectLayout.jsx` | Loads the project once (`GET /projects/:id`), provides it through `ProjectContext`, renders the breadcrumb and an `<Outlet/>` |
| `components/project/SprintTide.jsx` | §4 |
| `components/project/ProjectBoard.jsx` | Board screen: sprint selection, toolbar, swimlane grouping, WIP |
| `components/project/ProjectBacklog.jsx` | Backlog screen |
| `lib/sprintHealth.js` | Pure computations from §4 (no React, no `@` alias, so Node can import it) |
| `lib/useActiveSprint.js` | Fetches the active sprint and its issues for a project, with a `refresh()` function |

**Changed:**

- `DashboardLayout.jsx` becomes the shell: TopBar + AppSidebar + `<Outlet/>`. Its search,
  notifications and project-modal logic moves into the TopBar.
- `main.jsx`: nested project routes and the `?tab=` redirect.
- `pages/ProjectDetail.jsx` is replaced by `ProjectLayout` plus route elements. The existing
  `ProjectOverview`, `ProjectTasks`, `ProjectNotes`, `ProjectMembers`, `ProjectSettings` and
  `SprintCharts` are reused as route content.
- `components/tasks/TaskBoard.jsx` gains `groupBy` and `wipLimits` props. Drag, keyboard and menu
  moves are unchanged.
- `pages/TaskDetail.jsx` gets the two-column layout, the History tab and inline Details.
- `pages/Dashboard.jsx` becomes Your work.
- `components/ui/Display.jsx`: `StatusBadge` → lozenge, `IssueTypeIcon` → filled mark. The props
  stay the same.
- `index.css`: fonts, radius, the card shadow token, `--topbar-accent`.

`ProjectSprints.jsx` is split between `ProjectBacklog` (sprint planning) and Reports
(`SprintCharts`), then deleted.

## 7. Backend changes

Both are small and both come with API tests.

1. **WIP limits.**
   - Model: `Project.settings.wipLimits`, a `Map` of status → integer 0–99, default empty.
   - API: `PUT /projects/:projectId` accepts `wipLimits`, validated as an object whose keys are in
     `AvailableTaskStatuses` and whose values are integers 0–99. Unknown keys get a 422.
   - Controller: add `wipLimits` to the `updateProject` whitelist, so setting `settings.wipLimits`
     replaces the whole map. Permission stays `project:update`.
   - The key validation is what stops `{"$set": …}`-style keys.
2. **Your work data.** `GET /dashboard/stats` adds `activeSprint` to each item in `recentProjects`:
   `{ _id, name, startDate, endDate, startPoints, totalPoints, remainingPoints, totalIssues, openIssues, myOpenIssues }`,
   or `null`.
   - It takes one `Sprint.find({ project: {$in}, status: "active" })` and one aggregation over those
     sprints' tasks, so the cost doesn't grow with the number of projects.
   - It also adds `assignedToMe` (open issues assigned to the caller, limit 20) and `dueSoon` (open
     issues assigned to the caller, due within 7 days or overdue, limit 20), each with
     `issueKey title status dueDate project{name,key}`.

There are no other API changes. Board, backlog and issue view use the existing endpoints.

## 8. Data flow and state

- `ProjectLayout` fetches the project once per `projectId` and exposes `{ project, role, refresh }`
  through context. Child routes don't re-fetch it. This mirrors the backend rule that the scope
  document is loaded once.
- Board and Backlog both use `useActiveSprint(projectId)`. A move updates local state straight away
  (optimistic), then calls the API.
  - **On failure** the move is reverted and an error toast shows the server's message.
  - **On success** the sprint strip recomputes from local state.
- The issue view fetches the task as it does today. Each inline edit is a separate
  `PUT … { field }`, and the returned task replaces local state.
- Swimlane grouping, column order and WIP decoration are derived during render. Nothing extra is
  stored except the per-project `groupBy` preference, in `localStorage` wrapped in try/catch.

## 9. Error, empty and loading states

Every screen has the same three states:

- **Loading:** `SkeletonRows`, or skeleton columns on the board.
- **Error:** an `Alert` showing the server message and a Retry button. The request id is included
  when the server sends one.
- **Empty:** an `EmptyState` with the next action, for example "No active sprint" → Go to Backlog,
  or "Nothing assigned to you" → Browse projects.

The sprint strip is hidden when there's no active sprint. Its health badge is hidden when the sprint
has no issues.

A 403 on a project route shows "You're not a member of this project" with a link to Projects. A 404
shows NotFound inside the app.

## 10. Testing

- **Backend, `node:test` + supertest:**
  - `wipLimits` round-trip.
  - 422 for an unknown status key and for a non-integer value.
  - A developer (no `project:update`) gets a 403.
  - `dashboard/stats` returns `activeSprint` with correct points, `myOpenIssues`, `assignedToMe` and
    `dueSoon`.
  - A user's stats never include another tenant's projects. This is the multi-user check.
- **Pure logic:** `backend/tests/sprintHealth.test.js` imports `frontend/src/lib/sprintHealth.js`,
  following the precedent of `taskStatus.test.js`. It covers day index and clamping, added points,
  each health band, overdue, the no-estimate fallback and 1-day sprints.
- **Playwright** (updated and extended; desktop + mobile):
  - `navTo()` learns the top bar and the drawer.
  - Every `?tab=` URL in the specs is replaced by the new routes. One test keeps a `?tab=sprints`
    URL to prove the redirect.
  - New: the board shows the sprint strip with real numbers, a WIP over-limit column is marked, and
    the swimlane toggle groups by assignee.
  - New: on the backlog, move an issue to a planned sprint via the ⋯ menu, and it persists after a
    reload.
  - New: on the issue view, change status from the status button, and History shows the transition.
  - New: Your work shows a project card with its health badge.
- **Browser check (manual, recorded in `docs/QA_CHECKLIST.md`):**
  - Light and dark mode, 1440px and 390px, on Board, Backlog, the issue view, Your work and Settings.
  - No console errors.
  - Contrast measured for the new pairs: lozenges, top bar text, sidebar active state.

## 11. Out of scope

- The landing page: its own spec next, matching this visual language.
- Issue watching, time logging, a Timeline/Gantt view, epics as a separate hierarchy, custom
  workflows (`settings.statuses` remains unused), and saved filters.

## 12. Delivery order

Each step leaves the app working and the tests green:

1. Foundation: fonts, tokens, lozenge and type mark restyle.
2. Shell: TopBar, AppSidebar, ProjectLayout, routes and redirects.
3. Board and the sprint strip, with `sprintHealth` and its tests.
4. Backlog.
5. WIP limits (backend + Project settings + board decoration).
6. Issue view.
7. Your work, with the dashboard API additions.
8. E2E updates, browser verification and the QA checklist.
