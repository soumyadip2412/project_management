import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

/**
 * Transient confirmation that an action succeeded ("Project created").
 * Errors about a specific form stay inline next to that form; toasts are for
 * outcomes whose screen has already closed or changed.
 */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setItems((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message, tone = "success") => {
      const id = nextId.current++;
      setItems((all) => [...all.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5 text-[13px] text-text shadow-overlay"
          >
            {t.tone === "success" ? (
              <CheckCircle2 size={15} className="shrink-0 text-success" aria-hidden="true" />
            ) : (
              <AlertCircle size={15} className="shrink-0 text-danger" aria-hidden="true" />
            )}
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="rounded p-0.5 text-subtlest hover:text-text"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
