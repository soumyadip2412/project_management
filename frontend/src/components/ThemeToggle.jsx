import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
  { value: "dark", label: "Dark", Icon: Moon },
];

/**
 * Three-way theme control: light / follow the OS / dark.
 *
 * A segmented control rather than a single toggle, because "system" is a real
 * third state — a plain switch cannot express "follow the OS" and silently
 * strands anyone whose OS theme changes during the day.
 */
export default function ThemeToggle({ compact = false }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface-raised p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={compact ? label : undefined}
            title={label}
            onClick={() => setPreference(value)}
            className={[
              "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-surface text-text shadow-card"
                : "text-subtlest hover:bg-surface-hover hover:text-subtle",
            ].join(" ")}
          >
            <Icon size={14} aria-hidden="true" />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
