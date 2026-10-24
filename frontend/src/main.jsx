/**
 * FILE: frontend/src/main.jsx
 *
 * PURPOSE
 *   The entry point of the React single-page app (SPA). index.html loads this
 *   module; it mounts <App /> into <div id="root"> and declares EVERY route.
 *
 * PROVIDER ORDER (outermost → innermost) and why
 *   ThemeProvider   light/dark theme; needed by everything, including public pages
 *   AuthProvider    who is logged in (calls /auth/current-user on startup)
 *   ToastProvider   pop-up success/error messages, usable from any page
 *   BrowserRouter   URL ↔ component mapping (react-router v7)
 *   Providers use React Context, so any child can call useTheme() / useAuth() /
 *   useToast() without passing props down through every level ("prop drilling").
 *
 * ROUTE MAP
 *   /                              LandingPage (lazy-loaded marketing page)
 *   /login, /register              auth forms
 *   /auth/reset-password/:token    opened from the password-reset email
 *   /auth/verify-email/:token      opened from the verification email
 *   /dashboard/*                   the protected app: ProtectedRoute → DashboardLayout
 *       (index) Dashboard · projects · projects/:projectId · workspaces ·
 *       tasks · tasks/:taskId · team · settings · * (in-app 404)
 *   *                              public 404
 *
 * KEY CONCEPTS
 *   - Nested routes: the child routes render inside DashboardLayout's <Outlet />,
 *     so the sidebar and top bar persist while only the page area changes.
 *   - Code splitting: lazy(() => import(...)) moves the landing page into its own
 *     JS chunk, downloaded only when "/" is visited. <Suspense> shows its
 *     fallback (here: nothing) while that chunk loads.
 *   - StrictMode (development only) double-invokes renders and effects to expose
 *     side-effect bugs. Seeing API calls twice in dev is expected.
 */
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import "./index.css";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import DashboardLayout from "./components/DashboardLayout";
import GlobalLayout from "./components/shell/GlobalLayout";
import ProjectLayout from "./components/shell/ProjectLayout";
import ProjectSprints from "./components/project/ProjectSprints";
import ProjectTasks from "./components/project/ProjectTasks";
import { ProjectHome, ProjectIssues, ProjectMembersPage, ProjectNotesPage, ProjectPageHeader, ProjectSettingsPage, ProjectSummary } from "./components/shell/projectRoutes";
import { useProject } from "./components/shell/projectContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import Workspaces from "./pages/Workspaces";
import NotFound from "./pages/NotFound";

import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./components/ui/Toast";

// The marketing page carries the animation library and a large hero; loading
// it on demand keeps it out of the application bundle.
const LandingPage = lazy(() => import("./pages/LandingPage"));

// Temporary until Task 10 / Task 11 replace them with the real screens.
function TempBoard() {
  const { project } = useProject();
  return (<><ProjectPageHeader title="Board" /><ProjectTasks project={project} /></>);
}
function TempSprints({ title }) {
  const { project } = useProject();
  return (<><ProjectPageHeader title={title} /><ProjectSprints project={project} /></>);
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route
                path="/"
                element={
                  <Suspense fallback={null}>
                    <LandingPage />
                  </Suspense>
                }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              {/* Targets of the links in the reset / verification emails */}
              <Route path="/auth/reset-password/:token" element={<ResetPassword />} />
              <Route path="/auth/verify-email/:token" element={<VerifyEmail />} />

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
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
