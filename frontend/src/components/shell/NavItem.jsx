import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";

/** A sidebar link. The active item gets a teal inset bar (Jira's selected-item cue). */
export default function NavItem({ to, label, icon: Icon, leading, end, badge }) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(
            "flex h-8 items-center gap-2.5 rounded px-2 text-[13px] transition-colors pointer-coarse:h-10",
            isActive
              ? "bg-primary-subtle font-medium text-primary shadow-[inset_3px_0_0_var(--primary)]"
              : "text-subtle hover:bg-surface-hover hover:text-text"
          )
        }
      >
        {leading ?? (Icon && <Icon size={16} aria-hidden="true" className="shrink-0" />)}
        <span className="truncate">{label}</span>
        {badge != null && <span className="ml-auto text-xs tabular-nums text-subtlest">{badge}</span>}
      </NavLink>
    </li>
  );
}

export function NavSection({ heading, children }) {
  return (
    <div className="mt-4 first:mt-0">
      {heading && (
        <p className="px-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-subtlest">{heading}</p>
      )}
      <ul className="flex flex-col gap-px">{children}</ul>
    </div>
  );
}
