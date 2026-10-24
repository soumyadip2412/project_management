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
