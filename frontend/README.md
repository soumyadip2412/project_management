# ProjectCamp — Web client

Single-page React client for the ProjectCamp API: workspaces, projects, a Kanban board, task detail with comments and subtasks, and a statistics dashboard.

React 19 · JavaScript (JSX) · Vite · React Router 7 · Tailwind v4.

> This is the `frontend` submodule of the [ProjectCamp superproject](https://github.com/Bobin2004/project-management). Product overview, screenshots and the architecture write-up live in the root README.

## Quick start

The API must be running first — see the `backend` repository.

```bash
npm install
npm run dev          # http://localhost:5173
```

The client reads `VITE_API_BASE_URL` from `.env`, defaulting to `http://localhost:8000/api/v1`:

```ini
VITE_APP_NAME=Project Camp
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_GOOGLE_OAUTH_URL=http://localhost:8000/api/v1/auth/google
VITE_GITHUB_OAUTH_URL=http://localhost:8000/api/v1/auth/github
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `vite build` |
| `npm run lint` | oxlint |
| `npm run e2e` | Playwright, desktop + mobile (needs the backend's `e2e:server` running) |
| `npm run e2e:ui` | the same suite in Playwright's UI mode |
| `npm run preview` | serve the production build locally |

## Project layout

```
src/
├── main.jsx             routes, declared inline
├── context/             AuthContext — session bootstrap + useAuth()
├── index.css            design tokens (light + dark CSS variables → Tailwind theme)
├── lib/
│   ├── api.js           the only place that talks HTTP
│   ├── taskStatus.js    canonical task statuses (mirrors the backend enum)
│   ├── priority.js      priority labels/icons
│   ├── format.js        names, roles, dates, task links
│   ├── password.js      the password rule the API enforces
│   ├── useMediaQuery.js one layout per breakpoint (table vs list)
│   └── utils.js         cn() class merging
├── pages/               route components (+ NotFound)
├── components/
│   ├── ui/              the design system: Button, Field/Input/Select, Modal,
│   │                    ConfirmDialog, Toast, Tabs, Menu, PageHeader, Panel,
│   │                    Alert, EmptyState, Skeleton, Status/Priority badges
│   ├── DashboardLayout  sidebar + top bar shell (drawer below 1024px)
│   ├── ProtectedRoute   redirects to /login when unauthenticated
│   ├── auth/            sign-in/up layout and inputs
│   ├── dashboard/       dashboard sections
│   └── project/         project detail tabs
e2e/                     Playwright specs
```

## How it fits together

**Routing** (`src/main.jsx`) — public `/`, `/login`, `/register`, `/auth/reset-password/:token` and `/auth/verify-email/:token` (the pages the emailed links open), then everything under `/dashboard` wrapped in `ProtectedRoute` → `DashboardLayout` with nested child routes.

**Session** (`src/context/AuthContext.jsx`) — bootstraps from `GET /auth/current-user` on mount and exposes `login`, `register`, `logout`, `refreshUser` and `updateUser` through the `useAuth()` hook.

**HTTP** (`src/lib/api.js`) — every request goes through `api.get/post/put/patch/delete`. Auth is **cookie-only**: the access and refresh tokens are httpOnly cookies that JavaScript never sees, so the client sends `credentials: "include"` and nothing else. On a 401 it refreshes the session **once** through `/auth/refresh-token` and retries. Concurrent requests during a refresh are queued and resolved — or rejected together if the refresh fails, so nothing hangs. **Do not call `fetch` directly.**

**Task statuses** (`src/lib/taskStatus.js`) — the single source of status values, mirroring `TaskStatusEnum` in the backend. The board columns, the status filter, the create-task form and the detail view all read from it. A backend test fails if the two drift; the repositories cannot import from each other, so that test is the contract.

Adding a status means changing the backend enum first, then this file.

**Styling** — Tailwind v4 utilities only (no inline style objects except genuinely dynamic values such as a progress width). Tokens are CSS variables in `src/index.css`, redefined under `.dark`, and exposed to Tailwind (`bg-surface`, `text-subtle`, `border-line`, `text-primary`…). One accent (`primary`) is reserved for primary actions, focus, the active nav item and links; status colours appear only on status glyphs. Type is Geist; Geist Mono is used only for issue/project keys. Base CSS must stay inside `@layer base` — an unlayered rule beats every Tailwind utility. Build pages from `components/ui` rather than restyling raw elements. `@` is aliased to `src/`.

**Layout rules** — every page starts with `PageHeader` (title, one-line purpose, primary action last). Collections are tables at ≥768px and stacked lists below, chosen with `useIsWide()` so only one is in the DOM. Destructive actions always go through `ConfirmDialog`; success after a dialog closes is announced with `useToast()`; errors stay inline next to what failed.

## Testing

End-to-end only; there is no unit-test runner configured yet.

```bash
cd ../backend && PORT=8123 npm run e2e:server   # API + ephemeral MongoDB
npm run e2e                                      # here
```

Playwright drives real Chromium against the real API. The suite provisions its own user through the actual registration UI, so it needs no fixtures, and the backing database is created and discarded per run.

Covered on desktop **and** a Pixel 7 viewport (12/12): registration → login → workspace → project → task → status change → reload-verified persistence → logout, filters and global search, protected-route redirects, and recovery from a corrupted access cookie.

> **`.env.e2e` must not be removed.** It pins the test run to the ephemeral API on port 8123. Vite's `.env` points at port 8000, and mode-specific env files take precedence over anything passed at runtime — without `.env.e2e`, the suite would run against whatever real backend is listening.

Selectors in `e2e/` use roles, accessible names and placeholders. Sidebar entries are links; `navTo()` opens the mobile drawer first when the sidebar is off-screen, as a person would.

## Known limitations

Full detail, with finding IDs, lives in `docs/PROJECT_AUDIT.md` in the superproject (this repository's `main` branch).

- **No data-fetching layer.** Each page does `useEffect` + `api.get` + local `useState`: no shared cache, request deduplication or invalidation, and refetch-after-mutation is hand-wired per call site.
- Call sites unwrap responses defensively (`res?.data || res || []`).
- **The landing page (`/`) was not part of the 2026-09-30 redesign** and still uses its own marketing styling (gradients, motion). It is loaded lazily, so it no longer weighs on the app bundle.
- **No error boundary** (a catch-all 404 route exists).
- **OAuth is opt-in.** The Google/GitHub buttons render only with `VITE_OAUTH_ENABLED=true`, because they need provider credentials on the API.
- **No compile-time types.** The client is plain JavaScript; payload shapes are checked by the API's validators and the E2E suite, not by a compiler.
- The dashboard activity feed polls on a timer; it is not a live connection.
- Two animation libraries (`framer-motion` and `motion`) and two icon libraries (`lucide-react` and `react-icons`) are installed.
- Single ~620 kB JS chunk; no code splitting.
