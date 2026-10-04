import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const VARIANTS = {
  primary: "bg-primary text-primary-contrast hover:bg-primary-hover border border-transparent",
  secondary: "bg-surface text-text border border-line hover:bg-surface-hover",
  ghost: "text-subtle border border-transparent hover:bg-surface-hover hover:text-text",
  danger: "bg-danger text-white border border-transparent hover:opacity-90 dark:text-inverse",
  "danger-subtle": "text-danger border border-line bg-surface hover:bg-danger-subtle hover:border-danger",
};

// sm is for dense contexts (table rows, toolbars); md is the default.
// Both keep a 32px+ hit area; coarse pointers get 40px.
const SIZES = {
  sm: "h-7 px-2.5 text-xs gap-1.5 pointer-coarse:h-9",
  md: "h-8 px-3 text-[13px] gap-2 pointer-coarse:h-10",
};

export const Button = forwardRef(function Button(
  { variant = "secondary", size = "md", loading = false, icon, className, children, disabled, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton(
  { label, size = "md", tone = "default", className, children, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-transparent transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" ? "h-7 w-7 pointer-coarse:h-9 pointer-coarse:w-9" : "h-8 w-8 pointer-coarse:h-10 pointer-coarse:w-10",
        tone === "danger"
          ? "text-subtlest hover:bg-danger-subtle hover:text-danger"
          : "text-subtle hover:bg-surface-hover hover:text-text",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
