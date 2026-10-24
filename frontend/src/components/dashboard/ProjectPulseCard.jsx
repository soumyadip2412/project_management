import { Link } from "react-router-dom";
import { sprintHealthFromTotals } from "../../lib/sprintHealth";
import ProjectBadge from "../shell/ProjectBadge";
import { DayBar, HealthLozenge } from "../project/SprintTide";

/** A recent project with its active sprint in miniature (or its done count for Kanban). */
export default function ProjectPulseCard({ project }) {
  const s = project.activeSprint;
  const pointsMode = (s?.totalPoints ?? 0) > 0;
  const h = s
    ? sprintHealthFromTotals(s, {
        unit: pointsMode ? "pts" : "issues",
        total: pointsMode ? s.totalPoints : s.totalIssues,
        remaining: pointsMode ? s.remainingPoints : s.openIssues,
        startTotal: pointsMode ? s.startPoints : null,
      })
    : null;

  return (
    <Link to={`/dashboard/projects/${project._id}`} className="block rounded-md border border-line bg-surface p-3 shadow-card transition-colors hover:border-line-strong">
      <span className="flex items-center gap-2">
        <ProjectBadge project={project} />
        <span className="truncate text-[13px] font-semibold text-text">{project.name}</span>
        <span className="ml-auto">{h && <HealthLozenge health={h.health} />}</span>
      </span>
      {s ? (
        <>
          <span className="mt-3 block"><DayBar totalDays={h.totalDays} dayIndex={h.dayIndex} compact /></span>
          <span className="mt-1.5 block text-xs text-subtlest">
            {s.name} · day {h.dayIndex} of {h.totalDays} · {s.myOpenIssues} of your issues open
          </span>
        </>
      ) : (
        <span className="mt-3 block text-xs text-subtlest">{project.completedTasks} of {project.totalTasks} issues done</span>
      )}
    </Link>
  );
}
