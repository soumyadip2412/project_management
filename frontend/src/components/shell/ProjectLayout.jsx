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
