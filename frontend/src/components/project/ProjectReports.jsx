import { useCallback, useEffect, useState } from "react";
import { ChartLine } from "lucide-react";
import { api } from "../../lib/api";
import { useActiveSprint } from "../../lib/useActiveSprint";
import { useProject } from "../shell/projectContext";
import { ProjectPageHeader } from "../shell/projectRoutes";
import { Alert, EmptyState, SkeletonRows } from "../ui/Feedback";
import { BurndownChart, VelocityChart } from "./SprintCharts";

/** Burndown for the active sprint and velocity across completed ones. */
export default function ProjectReports() {
  const { project } = useProject();
  // The burndown reads the active sprint's own (uncapped) issue list.
  const active = useActiveSprint(project._id);
  const [velocity, setVelocity] = useState({ velocityData: [], avgVelocity: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const velocityRes = await api.get(`/projects/${project._id}/sprints/velocity`).catch(() => null);
      setVelocity(velocityRes?.data ?? { velocityData: [], avgVelocity: 0 });
    } catch (err) {
      setError(err?.message || "Reports could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [project._id]);

  useEffect(() => {
    load();
  }, [load]);

  // The top-bar + Create button announces new issues with this event.
  const { refresh: refreshSprint } = active;
  useEffect(() => {
    const reload = () => {
      load();
      refreshSprint();
    };
    window.addEventListener("pc:issue-created", reload);
    return () => window.removeEventListener("pc:issue-created", reload);
  }, [load, refreshSprint]);

  const completed = velocity.velocityData ?? [];
  const retry = () => {
    load();
    active.refresh();
  };

  return (
    <>
      <ProjectPageHeader title="Reports" />
      {loading || active.loading ? (
        <div className="rounded-md border border-line"><SkeletonRows rows={4} label="Loading reports" /></div>
      ) : error || active.error ? (
        <Alert>{error || active.error} <button type="button" onClick={retry} className="font-medium underline">Try again</button></Alert>
      ) : !active.sprint && completed.length === 0 ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState icon={ChartLine} title="No sprint data yet" description="Start a sprint to see its burndown; complete one to see velocity." />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {active.sprint && <BurndownChart sprint={active.sprint} tasks={active.issues} />}
          {completed.length > 0 && <VelocityChart data={completed} average={velocity.avgVelocity} />}
        </div>
      )}
    </>
  );
}
