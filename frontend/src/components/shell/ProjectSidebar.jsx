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
