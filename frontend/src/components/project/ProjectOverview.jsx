import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Avatar, Progress } from "../ui/Display";
import { Skeleton } from "../ui/Feedback";
import { findOwner, formatDate, nameOf, roleLabel } from "../../lib/format";
import { dueMeta } from "../../lib/time";

const LABELS = {
  kanban: "Kanban",
  scrum: "Scrum",
  waterfall: "Waterfall",
  private: "Private",
  workspace: "Workspace",
  public: "Public",
};
const label = (value) => (value ? LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1) : "—");

function Row({ term, children }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 py-2 sm:grid-cols-[140px_1fr]">
      <dt className="text-[13px] text-subtle">{term}</dt>
      <dd className="min-w-0 text-[13px] text-text">{children}</dd>
    </div>
  );
}

/**
 * Where the project stands: how much work is open, moving and finished, what
 * is overdue, and which sprint is running, each linking to the tab that holds
 * the detail. Counts come from the same task and sprint endpoints the tabs use.
 */
function Work({ project }) {
  const [work, setWork] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get(`/tasks/${project._id}`, { params: { limit: 100 } }),
      api.get(`/projects/${project._id}/sprints`, { params: { status: "active" } }),
    ])
      .then(([taskRes, sprintRes]) => {
        if (cancelled) return;
        const tasks = taskRes?.data?.tasks ?? [];
        const by = (cat) => tasks.filter((t) => t.statusCategory === cat).length;
        setWork({
          total: taskRes?.data?.totalTasks ?? tasks.length,
          todo: by("todo"),
          inProgress: by("in_progress"),
          done: by("done"),
          overdue: tasks.filter((t) => t.statusCategory !== "done" && dueMeta(t.dueDate)?.overdue).length,
          activeSprint: Array.isArray(sprintRes?.data) ? sprintRes.data[0] ?? null : null,
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [project._id]);

  const base = `/dashboard/projects/${project._id}`;

  if (failed) return <p className="text-[13px] text-subtle">Task counts could not be loaded.</p>;
  if (!work) return <Skeleton className="h-24 w-full rounded-lg" />;

  const pct = work.total > 0 ? Math.round((work.done / work.total) * 100) : 0;

  return (
    <div className="rounded-lg border border-line">
      <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
        {[
          ["To do", work.todo],
          ["In progress", work.inProgress],
          ["Done", work.done],
          ["Overdue", work.overdue],
        ].map(([term, value]) => (
          <div key={term} className="px-4 py-3">
            <dt className="text-xs text-subtle">{term}</dt>
            <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${term === "Overdue" && Number(value) > 0 ? "text-danger" : "text-text"}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-line px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-subtle">
          <span>
            {work.done} of {work.total} tasks done
          </span>
          <Link to={`${base}?tab=tasks`} className="rounded font-medium text-primary hover:underline">
            View tasks
          </Link>
        </div>
        <Progress value={pct} label={`${pct}% of tasks done`} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[13px]">
        {work.activeSprint ? (
          <span className="text-subtle">
            <span className="font-medium text-text">{work.activeSprint.name}</span> is running until{" "}
            {formatDate(work.activeSprint.endDate)}
          </span>
        ) : (
          <span className="text-subtle">No sprint is running</span>
        )}
        <Link to={`${base}?tab=sprints`} className="rounded text-xs font-medium text-primary hover:underline">
          Sprints
        </Link>
      </div>
    </div>
  );
}

/** The project at a glance: its work, its description and settings, its people. */
export default function ProjectOverview({ project }) {
  const owner = findOwner(project);
  const members = project.members ?? [];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        <section aria-labelledby="work-heading">
          <h2 id="work-heading" className="mb-2 text-[13px] font-semibold text-text">Work</h2>
          <Work project={project} />
        </section>

        <section aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-[13px] font-semibold text-text">About</h2>
          <p className="mt-1.5 max-w-prose whitespace-pre-wrap text-[13px] leading-relaxed text-subtle">
            {project.description || <span className="text-subtlest">No description. Add one in Settings.</span>}
          </p>
          <dl className="mt-3 divide-y divide-line border-y border-line">
            <Row term="Owner">{owner ? nameOf(owner) : "—"}</Row>
            <Row term="Methodology">{label(project.methodology)}</Row>
            <Row term="Visibility">{label(project.visibility)}</Row>
            <Row term="Created">{formatDate(project.createdAt, true)}</Row>
          </dl>
        </section>
      </div>

      <section aria-labelledby="people-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="people-heading" className="text-[13px] font-semibold text-text">
            Members <span className="font-normal text-subtlest">{members.length}</span>
          </h2>
          <Link to={`/dashboard/projects/${project._id}?tab=members`} className="rounded text-xs font-medium text-primary hover:underline">
            Manage
          </Link>
        </div>
        <ul className="mt-1.5 divide-y divide-line">
          {members.slice(0, 8).map((m, i) => {
            const person = typeof m.user === "object" ? m.user : null;
            return (
              <li key={person?._id || i} className="flex items-center gap-2.5 py-2">
                <Avatar name={nameOf(person)} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-text">{nameOf(person)}</span>
                <span className="text-xs text-subtlest">{roleLabel(m.role)}</span>
              </li>
            );
          })}
        </ul>
        {members.length > 8 && <p className="mt-2 text-xs text-subtlest">and {members.length - 8} more</p>}
      </section>
    </div>
  );
}
