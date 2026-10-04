import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import ProjectOverview from "../components/project/ProjectOverview";
import ProjectTasks from "../components/project/ProjectTasks";
import ProjectSprints from "../components/project/ProjectSprints";
import ProjectMembers from "../components/project/ProjectMembers";
import ProjectNotes from "../components/project/ProjectNotes";
import ProjectSettings from "../components/project/ProjectSettings";
import { PageHeader, TabPanel, Tabs } from "../components/ui/Navigation";
import { EmptyState, Skeleton } from "../components/ui/Feedback";
import { Key, Tag } from "../components/ui/Display";
import { projectStatusLabel } from "../lib/format";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "sprints", label: "Sprints" },
  { id: "notes", label: "Notes" },
  { id: "members", label: "Members" },
  { id: "settings", label: "Settings" },
];

export default function ProjectDetail() {
  const { projectId } = useParams();
  // The open tab lives in the URL, so it survives a reload and can be linked to.
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const activeTab = TABS.some((t) => t.id === requested) ? requested : "overview";
  const setActiveTab = (tab) => setSearchParams(tab === "overview" ? {} : { tab }, { replace: true });

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProject = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setProject(res?.data || res);
      setError("");
    } catch (err) {
      setError(err?.message || "The project could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      fetchProject();
    }
  }, [projectId, fetchProject]);

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <span className="sr-only">Loading project</span>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <EmptyState
        title="This project is unavailable"
        description={error || "It may have been deleted, or you are not one of its members."}
        action={
          <Link to="/dashboard/projects" className="text-[13px] font-medium text-primary hover:underline">
            Back to projects
          </Link>
        }
      />
    );
  }

  const memberCount = project.members?.length ?? 0;

  return (
    <div>
      <PageHeader
        back={{ to: "/dashboard/projects", label: "Projects" }}
        title={project.name}
        meta={
          <>
            <Key>{project.key}</Key>
            <Tag>{projectStatusLabel(project.status)}</Tag>
            <span>
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </span>
          </>
        }
      />

      <Tabs label="Project sections" items={TABS} value={activeTab} onChange={setActiveTab} className="mb-5" />

      <TabPanel id={activeTab}>
        {activeTab === "overview" && <ProjectOverview project={project} />}
        {activeTab === "tasks" && <ProjectTasks project={project} />}
        {activeTab === "sprints" && <ProjectSprints project={project} />}
        {activeTab === "notes" && <ProjectNotes project={project} />}
        {activeTab === "members" && <ProjectMembers project={project} onProjectUpdate={fetchProject} />}
        {activeTab === "settings" && <ProjectSettings project={project} onProjectUpdate={fetchProject} />}
      </TabPanel>
    </div>
  );
}
