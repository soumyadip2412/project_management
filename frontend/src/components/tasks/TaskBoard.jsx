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
import { useIsWide } from "../../lib/useMediaQuery";
import { Menu } from "../ui/Navigation";
import { Select } from "../ui/Field";
import { Avatar, DueDate, IssueTypeIcon, Key, Points } from "../ui/Display";
import { cn } from "../../lib/utils";

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
export default function TaskBoard({ tasks, onMove }) {
  const isWide = useIsWide();
  const [activeId, setActiveId] = useState(null);
  const [phoneColumn, setPhoneColumn] = useState("todo");
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

  const byColumn = (column) => tasks.filter((t) => (t.status || "todo") === column);
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
    onDragOver: ({ active, over }) => (over ? `${labelOf(tasks, active.id)} is over ${STATUS_META[over.id].label}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `${labelOf(tasks, active.id)} moved to ${STATUS_META[over.id].label}.` : `${labelOf(tasks, active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${labelOf(tasks, active.id)} was cancelled.`,
  };

  const columns = isWide ? BOARD_COLUMNS : [phoneColumn];

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
        if (over) move(tasks.find((t) => t._id === active.id), over.id);
      }}
    >
      {!isWide && (
        <Select
          aria-label="Column"
          value={phoneColumn}
          onChange={(e) => setPhoneColumn(e.target.value)}
          className="mb-3"
        >
          {BOARD_COLUMNS.map((c) => (
            <option key={c} value={c}>
              {STATUS_META[c].label} ({byColumn(c).length})
            </option>
          ))}
        </Select>
      )}

      <div className={cn("flex items-start gap-3", isWide && "overflow-x-auto pb-4")}>
        {columns.map((column) => (
          <Column key={column} column={column} wide={isWide}>
            {byColumn(column).map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                dragDisabled={!isWide}
                dimmed={task._id === activeId}
                onMove={move}
                suppressClick={() => Date.now() - lastDragEnd.current < 300}
              />
            ))}
          </Column>
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? <CardBody task={activeTask} className="rotate-1 shadow-overlay" /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ column, wide, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: column });
  const meta = STATUS_META[column];
  const count = Array.isArray(children) ? children.length : 0;
  return (
    <section
      ref={setNodeRef}
      data-column={column}
      aria-label={`${meta.label}, ${count} tasks`}
      className={cn(
        "flex shrink-0 flex-col rounded-lg border bg-surface-sunken",
        wide ? "w-72" : "w-full",
        isOver ? "border-primary" : "border-line",
      )}
    >
      <h2 className="flex h-10 items-center gap-2 border-b border-line px-3 text-[13px] font-medium text-text">
        <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
        <span>{meta.label}</span>
        <span className="ml-auto text-xs tabular-nums text-subtlest">{count}</span>
      </h2>
      <div className="flex min-h-24 flex-col gap-2 p-2">{children}</div>
    </section>
  );
}

function TaskCard({ task, dragDisabled, dimmed, onMove, suppressClick }) {
  const { setNodeRef, listeners, attributes } = useDraggable({ id: task._id, disabled: dragDisabled });
  const moveItems = BOARD_COLUMNS.filter((c) => c !== task.status).map((c) => ({
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
        className="block rounded-md"
      >
        <CardBody task={task} withMenuSpace />
      </Link>
      <div className="absolute right-1.5 top-1.5">
        <Menu label={`Move ${task.issueKey}`} items={moveItems} />
      </div>
    </div>
  );
}

function CardBody({ task, withMenuSpace, className }) {
  const assignee = task.assignees?.[0];
  const priority = priorityMeta(task.priority);
  const PriorityIcon = priority.Icon;
  return (
    <span
      className={cn(
        "block rounded-md border border-line bg-surface p-2.5 text-left shadow-card transition-colors hover:border-line-strong",
        className,
      )}
    >
      <span className={cn("flex items-center gap-1.5", withMenuSpace && "pr-7")}>
        <IssueTypeIcon type={task.issueType} />
        <Key>{task.issueKey}</Key>
        {URGENT.has(task.priority) && (
          <PriorityIcon size={14} style={{ color: priority.color }} aria-label={`${priority.label} priority`} />
        )}
        <Points value={task.storyPoints} className="ml-auto" />
      </span>
      <span className="mt-1 block text-[13px] leading-snug text-text">{task.title}</span>
      <span className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-subtlest">{task.project?.name}</span>
        <span className="flex shrink-0 items-center gap-2">
          <DueDate date={task.dueDate} empty={null} className="text-xs" />
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
 * Keyboard dragging: ← and → jump straight to the centre of the neighbouring
 * column. Column positions are read live: the board auto-scrolls while a card
 * moves, so positions measured when the drag started go stale.
 */
function jumpBetweenColumns(event, { currentCoordinates }) {
  if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") return undefined;
  event.preventDefault();
  const rects = BOARD_COLUMNS.map((id) => document.querySelector(`[data-column="${id}"]`)?.getBoundingClientRect()).filter(Boolean);
  if (rects.length === 0) return undefined;
  const x = currentCoordinates.x;
  const current = rects.findIndex((r) => x >= r.left && x <= r.left + r.width);
  const from = current === -1 ? 0 : current;
  const to = event.code === "ArrowRight" ? Math.min(from + 1, rects.length - 1) : Math.max(from - 1, 0);
  const r = rects[to];
  return { x: r.left + r.width / 2, y: Math.max(currentCoordinates.y, r.top + 20) };
}
