import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

/**
 * FILE: frontend/src/components/landing/shared.jsx
 * Small building blocks the landing sections share: the page container, a
 * section heading, button-styled links and the screenshot frame.
 */

/** Page width with a 16px phone gutter. */
export function Container({ className, children }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

/** Eyebrow, h2 and one short paragraph. `id` labels the section. */
export function SectionHeading({ id, eyebrow, title, children, className }) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">{eyebrow}</p>}
      <h2 id={id} className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.015em] text-text sm:text-[32px]">
        {title}
      </h2>
      {children && <p className="mt-3 text-[15px] leading-relaxed text-subtle sm:text-base">{children}</p>}
    </div>
  );
}

const LINK_VARIANTS = {
  primary: "border border-transparent bg-primary text-primary-contrast hover:bg-primary-hover",
  secondary: "border border-line-strong bg-surface text-text hover:bg-surface-hover",
  ghost: "border border-transparent text-subtle hover:bg-surface-hover hover:text-text",
};

const LINK_SIZES = {
  md: "h-9 px-3.5 text-[13px]",
  lg: "h-11 px-5 text-[15px]",
};

/** A router link that looks like a button (4px radius, like the app's controls). */
export function CtaLink({ to, variant = "primary", size = "md", className, children, ...props }) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-colors",
        LINK_VARIANTS[variant],
        LINK_SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

/**
 * A real app screenshot (1440×900) in a plain browser-window frame.
 *
 * crop "top"     the whole width, cropped from the top
 * crop "content" zoomed in on the main column (from x=260, y=60 of the
 *                capture), so the sidebar is cut away and text is larger
 *
 * `darkSrc` swaps the image in dark mode; the hidden copy is lazy, so it is
 * not downloaded unless it becomes visible.
 */
export function ScreenshotFrame({ src, darkSrc, alt, label, crop = "top", eager = false, className }) {
  const imgClass =
    crop === "content"
      ? "absolute left-[-22.4%] top-[-12%] h-auto w-[124.1%] max-w-none"
      : "absolute inset-0 h-full w-full object-cover object-top";
  const shared = { alt, width: 1440, height: 900, decoding: "async" };

  return (
    <figure className={cn("overflow-hidden rounded-lg border border-line bg-surface shadow-overlay", className)}>
      <div aria-hidden="true" className="flex h-7 items-center gap-1.5 border-b border-line bg-surface-raised px-3">
        <span className="h-2 w-2 rounded-full bg-line-strong" />
        <span className="h-2 w-2 rounded-full bg-line-strong" />
        <span className="h-2 w-2 rounded-full bg-line-strong" />
        {label && <span className="ml-3 truncate font-mono text-[11px] text-subtlest">{label}</span>}
      </div>
      <div className={cn("relative overflow-hidden bg-bg", crop === "content" ? "aspect-[1440/620]" : "aspect-[1440/560]")}>
        <img
          {...shared}
          src={src}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          className={cn(imgClass, darkSrc && "dark:hidden")}
        />
        {darkSrc && <img {...shared} src={darkSrc} loading="lazy" className={cn(imgClass, "hidden dark:block")} />}
      </div>
    </figure>
  );
}
