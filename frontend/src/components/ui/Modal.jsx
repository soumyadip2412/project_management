/**
 * FILE: frontend/src/components/ui/Modal.jsx
 *
 * Modal (generic dialog) and ConfirmDialog (destructive-action confirmation).
 * Used by every create/edit form (CreateTaskModal, CreateProjectModal, ...)
 * and every delete/remove action.
 *
 * KEY CONCEPTS
 *   - Portal: createPortal renders the dialog into document.body instead of
 *     where <Modal> appears in the tree, so parent `overflow: hidden` or
 *     z-index stacking cannot clip or hide it.
 *   - Focus trap: Tab on the last focusable element wraps to the first (and
 *     Shift+Tab the reverse), so keyboard users cannot "fall out" behind the dialog.
 *   - onCloseRef ("latest ref" pattern): the keydown listener is registered
 *     once per open, but always calls the CURRENT onClose prop. That avoids
 *     re-subscribing on every render and avoids calling a stale callback.
 *   - Scroll lock: body overflow is set to hidden while open and restored on close.
 *   - onSubmit mode: when given, the body is wrapped in a <form>, so Enter
 *     submits and a footer button with type="submit" works.
 *
 * INTERVIEW NOTE: "How do you make a modal accessible?" → role="dialog",
 * aria-modal, aria-labelledby, move focus in, trap it, close on Escape,
 * restore focus to the trigger. Every one of those is implemented below.
 */
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button, IconButton } from "./Button";
import { Alert } from "./Feedback";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog.
 *
 * - role="dialog" + aria-modal, labelled by its title
 * - focus moves into the dialog on open (first field, or `initialFocus`),
 *   Tab / Shift+Tab stay inside it, Escape closes it
 * - focus returns to whatever opened it when it closes
 * - the page behind does not scroll while it is open
 *
 * On narrow screens it docks to the bottom edge as a sheet, which keeps the
 * primary action within thumb reach.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  initialFocus,
  onSubmit,
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;

    const target =
      initialFocus?.current ??
      panel?.querySelector("input:not([disabled]), select:not([disabled]), textarea:not([disabled])") ??
      panel?.querySelector(FOCUSABLE);
    target?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Save the current value so the cleanup can restore exactly what was there.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
    // Re-run only when the dialog opens or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const body = (
    <>
      <div className="overflow-y-auto px-5 py-4">{children}</div>
      {footer && (
        <footer className="flex flex-col-reverse gap-2 border-t border-line px-5 py-3 sm:flex-row sm:justify-end">
          {footer}
        </footer>
      )}
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      {/* Backdrop: dims the page; clicking it closes the dialog. */}
      <div className="absolute inset-0 bg-[var(--surface-overlay)]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col rounded-t-lg border border-line bg-surface shadow-overlay sm:rounded-lg",
          size === "sm" && "sm:max-w-sm",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl"
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15px] font-semibold text-text">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-[13px] text-subtle">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close" size="sm" onClick={onClose} className="-mr-1.5 -mt-0.5">
            <X size={16} />
          </IconButton>
        </header>
        {onSubmit ? (
          <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>,
    document.body
  );
}

/**
 * Confirmation for destructive actions. States the consequence, names the
 * action on the button, keeps focus on Cancel by default, and shows the
 * server's error in place if the action fails.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  tone = "danger",
}) {
  const cancelRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setBusy(false);
      setError("");
    }
  }, [open]);

  // onConfirm is the caller's async action (e.g. the DELETE request). The
  // dialog closes only if it succeeds; otherwise the error is shown inline
  // and the user can retry. While busy, Escape and backdrop clicks are ignored.
  const confirm = async () => {
    try {
      setBusy(true);
      setError("");
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The action failed. Try again.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      size="sm"
      initialFocus={cancelRef}
      footer={
        <>
          <Button ref={cancelRef} onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={confirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-subtle">{description}</p>
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  );
}
