/**
 * FILE: frontend/src/components/DashboardLayout.jsx
 *
 * PURPOSE
 *   The application shell around every /dashboard/* page. It holds the navy
 *   top bar, the "Create issue" / "New project" modals and the mobile drawer
 *   state; the sidebars live in the layouts below it (shell/GlobalLayout for
 *   pages outside a project, ProjectLayout for pages inside one).
 *
 *     top bar (links, create, search, bell, account)
 *     <Outlet/> = a layout (sidebar + main) which renders the current page
 *
 * It passes { drawerOpen, closeDrawer, menuButtonRef, recentProjects,
 * refreshProjects } to those layouts through the Outlet context.
 *
 * RESPONSIVE: ≥1024px (lg) shows a sticky sidebar; below that the sidebar is an
 * off-canvas drawer opened by the ☰ button, closed by Escape, by tapping the
 * backdrop, or by navigating.
 */
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
