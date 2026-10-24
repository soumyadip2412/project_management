import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { BOARD_COLUMNS, STATUS_META, statusMeta } from "../../lib/taskStatus";
import { priorityMeta } from "../../lib/priority";
import { nameOf, taskPath } from "../../lib/format";
import { groupIntoLanes, wipState } from "../../lib/boardLanes";
import { useIsWide } from "../../lib/useMediaQuery";
import { Menu } from "../ui/Navigation";
import { Select } from "../ui/Field";
import { Avatar, DueDate, IssueTypeIcon, Key, Points } from "../ui/Display";
import { cn } from "../../lib/utils";

/*
 * FILE: frontend/src/components/tasks/TaskBoard.jsx
 *
 * The Kanban board used by pages/Tasks.jsx (and the per-project board). Props:
 *   tasks, onMove   the data and the move callback (the board is controlled)
 *   columns         which statuses to show, in order (default: all of them)
 *   groupBy         "none" or "assignee" (swimlanes, wide screens only)
 *   wipLimits       { status: limit }; going over a limit only warns
 *   showProject     show the project name on each card
 *
 * Drag and drop uses @dnd-kit/core:
 *   DndContext   wraps the board; receives drag start/end events
 *   useDroppable each Column cell registers as a drop target. Its id is
 *                "<lane>::<status>" so every swimlane has its own cells; a drop
 *                only ever changes the status, never the assignee
 *   useDraggable each TaskCard registers as draggable (id = task._id)
 *   DragOverlay  the floating "ghost" card that follows the pointer
 *   sensors      which input methods start a drag (mouse: after 6px of movement,
 *                so a normal click still opens the card; touch: a 250ms long-press,
 *                so scrolling still works; keyboard: Space)
 *   collisionDetection  which cell is "under" the card: pointer position
 *                first, falling back to rectangle overlap
 *
 * The board is a CONTROLLED component: it owns no task data. On drop it calls
 * onMove(task, newStatus), and the parent performs the optimistic update + API call.
 * Screen-reader `announcements` describe every drag step (the accessibility of
 * drag and drop is often asked about in interviews).
 * Helpers below: ColumnHeader, Column, TaskCard, CardBody, labelOf, jumpBetweenColumns.
 */

// Cards flag only urgent work; the full priority is in the list and on the task.
const URGENT = new Set(["critical", "high"]);

/*
 * Kanban board. A card can be moved three ways, so it works for everyone:
 *  - drag with a mouse, or long-press and drag on a touch screen;
 *  - keyboard: focus a card, Space to pick it up, ← → between columns,
 *    Space or Enter to drop, Escape to cancel (Enter alone still opens it);
 *  - the card's "Move to…" menu, which is also how phones move cards, since a
 *    phone shows one column at a time.
 * The parent owns the data: onMove(task, status) does the optimistic update.
 */

// Drop targets are "<lane>::<status>" so each swimlane has its own cells; a
// drop only ever changes the status (never the assignee).
const statusOf = (dropId) => String(dropId).split("::").pop();

export default function TaskBoard({ tasks, onMove, columns = BOARD_COLUMNS, groupBy = "none", wipLimits = {}, showProject = true }) {
  const isWide = useIsWide();
  const [activeId, setActiveId] = useState(null);
  const [phoneColumn, setPhoneColumn] = useState(columns.includes("todo") ? "todo" : columns[0]);
  // A mouse drag ends with a click on the card; that click must not open it.
  const lastDragEnd = useRef(0);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
      coordinateGetter: jumpBetweenColumns,
    }),
  );

  const inColumn = (list, column) => list.filter((t) => (t.status || "todo") === column);
  const activeTask = tasks.find((t) => t._id === activeId);

  const move = (task, status) => {
    if (!task || task.status === status) return;
    onMove(task, status);
    // The card re-renders in its new column; keep keyboard focus on it.
    requestAnimationFrame(() => document.querySelector(`[data-card="${task._id}"] a`)?.focus());
  };

  const announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${labelOf(tasks, active.id)}. Use the left and right arrow keys to change column, Space to drop, Escape to cancel.`,
    onDragOver: ({ active, over }) => (over ? `${labelOf(tasks, active.id)} is over ${STATUS_META[statusOf(over.id)].label}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `${labelOf(tasks, active.id)} moved to ${STATUS_META[statusOf(over.id)].label}.` : `${labelOf(tasks, active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${labelOf(tasks, active.id)} was cancelled.`,
  };

  // Phones: one column at a time and no swimlanes (too little width for both).
  const visibleColumns = isWide ? columns : [phoneColumn];
  const lanes = isWide && groupBy === "assignee" ? groupIntoLanes(tasks) : [{ key: "all", label: null, tasks, points: 0 }];
  const wip = Object.fromEntries(columns.map((c) => [c, wipState(inColumn(tasks, c).length, wipLimits[c])]));
  const gridStyle = { gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(${isWide ? "15rem" : "0"}, 1fr))` };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        const hits = pointerWithin(args);
        return hits.length ? hits : rectIntersection(args);
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move this task, press Space, then use the left and right arrow keys to choose a column, and press Space again to drop it. Press Enter to open the task.",
        },
      }}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={({ active, over }) => {
        setActiveId(null);
        lastDragEnd.current = Date.now();
        if (over) move(tasks.find((t) => t._id === active.id), statusOf(over.id));
      }}
    >
      {!isWide && (
        <Select aria-label="Column" value={phoneColumn} onChange={(e) => setPhoneColumn(e.target.value)} className="mb-3">
          {columns.map((c) => (
            <option key={c} value={c}>
              {STATUS_META[c].label} ({wip[c].label})
            </option>
          ))}
        </Select>
      )}

      <div className={cn(isWide && "overflow-x-auto pb-4")}>
        <div className="grid gap-2" style={gridStyle}>
          {visibleColumns.map((column) => (
            <ColumnHeader key={column} column={column} wip={wip[column]} />
          ))}
        </div>

        {lanes.map((lane) => (
          <div key={lane.key} className="mt-2">
            {lane.label && (
              <h3 className="flex items-center gap-2 py-1.5 text-xs font-semibold text-subtle">
                {lane.user && <Avatar name={lane.label} size="sm" />}
                {lane.label} <span className="font-normal text-subtlest">· {lane.points} pts</span>
              </h3>
            )}
            <div className="grid gap-2" style={gridStyle}>
              {visibleColumns.map((column) => (
                <Column key={column} laneKey={lane.key} column={column} over={wip[column].over}>
                  {inColumn(lane.tasks, column).map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      columns={columns}
                      showProject={showProject}
                      dragDisabled={!isWide}
                      dimmed={task._id === activeId}
                      onMove={move}
                      suppressClick={() => Date.now() - lastDragEnd.current < 300}
                    />
                  ))}
                </Column>
              ))}
            </div>
          </div>
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? <CardBody task={activeTask} showProject={showProject} className="rotate-1 shadow-overlay" /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// Sticky header for one status: a 3px rule in the status colour, the name, and
// the count, shown as "4 / 3" with a WIP limit and red once over it.
function ColumnHeader({ column, wip }) {
  const meta = STATUS_META[column];
  return (
    <h2
      data-column-header={column}
      data-over={wip.over}
      className="flex h-9 items-center gap-2 rounded-t-md border-t-[3px] bg-surface-sunken px-3 text-[11px] font-bold uppercase tracking-[0.04em] text-subtle"
      style={{ borderTopColor: meta.color }}
    >
      <span>{meta.label}</span>
      <span className={cn("ml-auto tabular-nums", wip.over ? "text-danger" : "text-subtlest")}>
        {wip.label}
        {wip.over && <span className="sr-only"> (over the work-in-progress limit)</span>}
      </span>
    </h2>
  );
}

// A drop zone: one per lane and status. setNodeRef tells dnd-kit which DOM node to measure.
function Column({ laneKey, column, over, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${laneKey}::${column}` });
  const count = Array.isArray(children) ? children.length : 0;
  return (
    <section
      ref={setNodeRef}
      data-column={column}
      data-lane={laneKey}
      aria-label={`${STATUS_META[column].label}, ${count} tasks`}
      className={cn(
        "flex min-h-20 flex-col gap-2 rounded-md p-1.5 transition-colors",
        over ? "bg-danger-subtle" : "bg-surface-sunken",
        isOver && "ring-2 ring-primary"
      )}
    >
      {children}
    </section>
  );
}

// A draggable card that is ALSO a link to the task, plus a "Move to…" menu
// (an alternative to dragging). `listeners` are the pointer/keyboard handlers
// that start a drag; `attributes` are its ARIA attributes.
function TaskCard({ task, columns, showProject, dragDisabled, dimmed, onMove, suppressClick }) {
  const { setNodeRef, listeners, attributes } = useDraggable({ id: task._id, disabled: dragDisabled });
  const moveItems = columns.filter((c) => c !== task.status).map((c) => ({
    label: `Move to ${STATUS_META[c].label}`,
    icon: STATUS_META[c].Icon,
    onSelect: () => onMove(task, c),
  }));

  return (
    <div ref={setNodeRef} data-card={task._id} className={cn("relative", dimmed && "opacity-40")}>
      <Link
        to={taskPath(task)}
        draggable={false}
        onClick={(e) => suppressClick() && e.preventDefault()}
        // Drag props only when dragging is possible: when disabled, dnd-kit
        // would mark the link aria-disabled and screen readers would skip it.
        {...(dragDisabled ? {} : { ...listeners, ...attributes })}
        // dnd-kit makes the handle role="button"; it is still a link to the task.
        role={undefined}
        className="block rounded"
      >
        <CardBody task={task} showProject={showProject} withMenuSpace />
      </Link>
      <div className="absolute right-1 top-1">
        <Menu label={`Move ${task.issueKey}`} items={moveItems} />
      </div>
    </div>
  );
}

// The card's visual content, shared by the real card and the DragOverlay ghost:
// title first, then type · key · priority … due · points · assignee.
function CardBody({ task, showProject, withMenuSpace, className }) {
  const assignee = task.assignees?.[0];
  const priority = priorityMeta(task.priority);
  const PriorityIcon = priority.Icon;
  const done = task.statusCategory === "done";
  return (
    <span className={cn("block rounded bg-surface p-2.5 text-left shadow-card transition-colors hover:bg-surface-raised", className)}>
      <span className={cn("block text-[13px] leading-snug", done ? "text-subtle line-through" : "text-text", withMenuSpace && "pr-7")}>
        {task.title}
      </span>
      {showProject && task.project?.name && <span className="mt-1 block truncate text-xs text-subtlest">{task.project.name}</span>}
      <span className="mt-2 flex items-center gap-1.5">
        <IssueTypeIcon type={task.issueType} />
        <Key>{task.issueKey}</Key>
        {URGENT.has(task.priority) && <PriorityIcon size={14} style={{ color: priority.color }} aria-label={`${priority.label} priority`} />}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <DueDate date={task.dueDate} empty={null} className="text-xs" />
          <Points value={task.storyPoints} />
          {assignee && (
            <span title={nameOf(assignee)}>
              <Avatar name={nameOf(assignee)} size="sm" />
            </span>
          )}
        </span>
      </span>
    </span>
  );
}

const labelOf = (tasks, id) => {
  const t = tasks.find((x) => x._id === id);
  return t ? `${t.issueKey}, ${statusMeta(t.status).label}` : "task";
};

/**
 * Keyboard dragging: ← and → jump to the centre of the neighbouring cell in
 * the SAME swimlane row. Positions are read live, because the board
 * auto-scrolls while a card moves.
 */
function jumpBetweenColumns(event, { currentCoordinates }) {
  if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") return undefined;
  event.preventDefault();
  const cells = Array.from(document.querySelectorAll("[data-column]")).map((el) => el.getBoundingClientRect());
  if (cells.length === 0) return undefined;
  const { x, y } = currentCoordinates;
  const inRow = cells.filter((r) => y >= r.top && y <= r.bottom);
  const row = (inRow.length ? inRow : cells.filter((r) => Math.abs(r.top - cells[0].top) < 2)).sort((a, b) => a.left - b.left);
  const current = row.findIndex((r) => x >= r.left && x <= r.left + r.width);
  const from = current === -1 ? 0 : current;
  const to = event.code === "ArrowRight" ? Math.min(from + 1, row.length - 1) : Math.max(from - 1, 0);
  const r = row[to];
  return { x: r.left + r.width / 2, y: Math.max(y, r.top + 20) };
}
