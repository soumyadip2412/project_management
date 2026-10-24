import { useCallback, useEffect, useState } from "react";
import { ChartLine } from "lucide-react";
import { api } from "../../lib/api";
import { useProject } from "../shell/projectContext";
import { ProjectPageHeader } from "../shell/projectRoutes";
import { Alert, EmptyState, SkeletonRows } from "../ui/Feedback";
import { BurndownChart, VelocityChart } from "./SprintCharts";

const sprintIdOf = (task) => (typeof task.sprint === "object" ? task.sprint?._id : task.sprint);

/** Burndown for the active sprint and velocity across completed ones. */
export default function ProjectReports() {
  const { project } = useProject();
  const [data, setData] = useState({ sprints: [], tasks: [], velocity: { velocityData: [], avgVelocity: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [sprintRes, taskRes, velocityRes] = await Promise.all([
        api.get(`/projects/${project._id}/sprints`),
        api.get(`/tasks/${project._id}`, { params: { limit: 100 } }),
        api.get(`/projects/${project._id}/sprints/velocity`).catch(() => null),
      ]);
      setData({
        sprints: Array.isArray(sprintRes?.data) ? sprintRes.data : [],
        tasks: Array.isArray(taskRes?.data?.tasks) ? taskRes.data.tasks : [],
        velocity: velocityRes?.data ?? { velocityData: [], avgVelocity: 0 },
      });
    } catch (err) {
      setError(err?.message || "Reports could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [project._id]);

  useEffect(() => {
    load();
  }, [load]);

  const active = data.sprints.find((s) => s.status === "active");
  const completed = data.velocity.velocityData ?? [];

  return (
    <>
      <ProjectPageHeader title="Reports" />
      {loading ? (
        <div className="rounded-md border border-line"><SkeletonRows rows={4} label="Loading reports" /></div>
      ) : error ? (
        <Alert>{error} <button type="button" onClick={load} className="font-medium underline">Try again</button></Alert>
      ) : !active && completed.length === 0 ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState icon={ChartLine} title="No sprint data yet" description="Start a sprint to see its burndown; complete one to see velocity." />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {active && <BurndownChart sprint={active} tasks={data.tasks.filter((t) => sprintIdOf(t) === active._id)} />}
          {completed.length > 0 && <VelocityChart data={completed} average={data.velocity.avgVelocity} />}
        </div>
      )}
    </>
  );
}
