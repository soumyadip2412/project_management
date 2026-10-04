import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronLeft, MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";
import { IconButton } from "./Button";

/* ─── PageHeader ─────────────────────────────────────────────────────────────
   Every page answers "where am I, what is this for, what can I do" in the
   same place: title, one line of purpose, then actions with the primary one
   last (rightmost on desktop). */

export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
}) {
  return (
    <header className="mb-5">
      {back && (
        <Link
          to={back.to}
          className="mb-2 inline-flex items-center gap-1 rounded text-[13px] text-subtle hover:text-text"
        >
          <ChevronLeft size={15} aria-hidden="true" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-text">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-[13px] text-subtle">{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-subtle">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/* ─── Panel: a bordered section with an optional title row ─────────────── */

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}) {
  return (
    <section className={cn("rounded-lg border border-line bg-surface", className)}>
      {(title || action) && (
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-2">
          {title && <h2 className="text-[13px] font-semibold text-text">{title}</h2>}
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* ─── Tabs ───────────────────────────────────────────────────────────────────
   WAI-ARIA tabs: arrow keys move between tabs, Home/End jump, only the active
   tab is in the tab order. The panel is rendered by the caller. */

export function Tabs({
  items,
  value,
  onChange,
  label,
  className,
}) {
  const refs = useRef([]);

  const onKeyDown = (e, index) => {
    const last = items.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0", className)}
    >
      {items.map((item, i) => {
        const active = item.id === value;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={active}
            aria-controls={`panel-${item.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] transition-colors",
              "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full",
              active ? "font-medium text-text after:bg-primary" : "text-subtle hover:text-text"
            )}
          >
            {Icon && <Icon size={15} aria-hidden="true" />}
            {item.label}
            {item.count !== undefined && <span className="text-xs text-subtlest">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, children }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={-1} className="focus:outline-none">
      {children}
    </div>
  );
}

/* ─── Segmented control (two or three mutually exclusive views) ─────────── */

export function Segmented({
  items,
  value,
  onChange,
  label,
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-line bg-surface-raised p-0.5">
      {items.map(({ id, label: itemLabel, icon: Icon }) => {
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
              active ? "bg-surface text-text shadow-card" : "text-subtle hover:text-text"
            )}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            {itemLabel}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Menu: row actions behind a "More" button ───────────────────────────────
   Always visible (not hover-only), so it works with keyboard and touch.
   Arrow keys move between items; Escape closes and returns focus. */

export function Menu({ label, items }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[role="menuitem"]')?.focus();
    const onPointerDown = (e) => {
      if (!listRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e) => {
    const nodes = Array.from(listRef.current?.querySelectorAll('[role="menuitem"]') ?? []);
    const index = nodes.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      nodes[(index + 1) % nodes.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nodes[(index - 1 + nodes.length) % nodes.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <IconButton
        ref={buttonRef}
        label={label}
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal size={16} />
      </IconButton>
      {open && (
        <div
          ref={listRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className="absolute right-0 top-full z-30 mt-1 min-w-40 rounded-md border border-line bg-surface p-1 shadow-overlay"
        >
          {items.map(({ label: itemLabel, onSelect, icon: Icon, tone }) => (
            <button
              key={itemLabel}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] focus:outline-none",
                tone === "danger"
                  ? "text-danger hover:bg-danger-subtle focus:bg-danger-subtle"
                  : "text-text hover:bg-surface-hover focus:bg-surface-hover"
              )}
            >
              {Icon && <Icon size={14} aria-hidden="true" />}
              {itemLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Sortable column header ─────────────────────────────────────────────────
   A button inside the <th>, with aria-sort on the header, so the sort state is
   announced and the column is operable by keyboard. */

export function SortHeader({
  label,
  column,
  sort,
  onSort,
  className,
  align = "left",
}) {
  const active = sort.key === column;
  const Arrow = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("py-2 pr-3 font-medium", align === "right" && "text-right", className)}
    >
      <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 rounded hover:text-text">
        {label}
        {active && <Arrow size={12} aria-hidden="true" />}
      </button>
    </th>
  );
}
