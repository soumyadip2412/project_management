import { Link, Navigate, useOutletContext, useSearchParams } from "react-router-dom";
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
  const tab = params.get("tab");
  // hasOwn: "?tab=constructor" must not resolve to Object.prototype members.
  const target = tab && Object.hasOwn(TAB_ROUTES, tab) ? TAB_ROUTES[tab] : project.methodology === "waterfall" ? "summary" : "board";
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
  const shell = useOutletContext();
  // Member changes also refresh the shell's project list (sidebar / Projects menu).
  const onUpdate = () => {
    refresh();
    shell?.refreshProjects?.();
  };
  return (
    <>
      <ProjectPageHeader title="Members" />
      <ProjectMembers project={project} onProjectUpdate={onUpdate} />
    </>
  );
}

export function ProjectSettingsPage() {
  const { project, refresh } = useProject();
  const shell = useOutletContext();
  // Renames and deletes also refresh the shell's project list (sidebar / Projects menu).
  const onUpdate = () => {
    refresh();
    shell?.refreshProjects?.();
  };
  return (
    <>
      <ProjectPageHeader title="Project settings" />
      <ProjectSettings project={project} onProjectUpdate={onUpdate} onProjectDeleted={() => shell?.refreshProjects?.()} />
    </>
  );
}
