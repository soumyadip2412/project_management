import { cloneElement, forwardRef, isValidElement, useId } from "react";
import { cn } from "../../lib/utils";

/*
 * Form building blocks.
 *
 * <Field> owns the label, hint and error text, and wires them to its control
 * with htmlFor / aria-describedby / aria-invalid, so every input is announced
 * with its label and its error. The control itself stays a plain element.
 */

const control =
  "w-full rounded-md border border-line bg-surface px-2.5 text-[13px] text-text placeholder:text-subtlest " +
  "transition-colors hover:border-line-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 " +
  "disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-subtle " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

export const Input = forwardRef(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={cn(control, "h-8 pointer-coarse:h-10", className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea(
  { className, rows = 3, ...props },
  ref
) {
  return <textarea ref={ref} rows={rows} className={cn(control, "resize-y py-1.5 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select ref={ref} className={cn(control, "h-8 cursor-pointer pr-7 pointer-coarse:h-10", className)} {...props}>
      {children}
    </select>
  );
});

export function Field({ label, children, hint, error, required, className, hideLabel }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const child = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required: required ?? children.props.required,
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-xs font-medium text-subtle", hideLabel && "sr-only")}>
        {label}
        {required && <span className="ml-0.5 text-subtlest" aria-hidden="true">*</span>}
      </label>
      {child}
      {hint && !error && (
        <p id={hintId} className="text-xs text-subtlest">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
