import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare, Folder, Search } from "lucide-react";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { taskPath } from "../../lib/format";
import { Key } from "../ui/Display";

const SHORTCUT_HINT =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

export default function GlobalSearch() {
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const timer = useRef(null); // pending debounce timeout (a ref: changing it must not re-render)
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onPointer = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  // Debounced search: each keystroke cancels the previous timer, so the
  // request fires only once typing pauses for 250 ms. Fewer than 2 characters
  // closes the list (the backend needs at least 2).
  const runSearch = (value) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get("/search", { params: { q: value.trim(), type: "project,task", limit: 5 } });
        const projects = (res?.data?.projects ?? []).map((p) => ({
          kind: "project",
          id: p._id,
          title: p.name,
          key: p.key,
          href: `/dashboard/projects/${p._id}`,
        }));
        const tasks = (res?.data?.tasks ?? []).map((t) => ({
          kind: "task",
          id: t._id,
          title: t.title,
          key: t.issueKey,
          context: t.project?.name,
          href: taskPath(t),
        }));
        setResults([...projects, ...tasks]);
        setActive(0);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  };

  const go = (r) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    navigate(r.href);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtlest" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search projects and tasks"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        placeholder="Search projects, tasks…"
        value={query}
        onChange={(e) => runSearch(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-8 w-full rounded-md border border-line bg-surface-raised pl-8 pr-12 text-[13px] text-text placeholder:text-subtlest transition-colors hover:border-line-strong focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 pointer-coarse:h-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {!query && (
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1 text-[11px] text-subtlest md:inline">
          {SHORTCUT_HINT}
        </kbd>
      )}

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-overlay"
        >
          {results.length === 0 ? (
            <p className="px-2.5 py-3 text-[13px] text-subtle">
              {searching ? "Searching…" : `Nothing matches “${query.trim()}”.`}
            </p>
          ) : (
            results.map((r, i) => (
              <div
                key={`${r.kind}-${r.id}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // pointerdown (not click) with preventDefault: navigate before the
                // input loses focus and the "click outside" handler closes the list.
                onPointerDown={(e) => {
                  e.preventDefault();
                  go(r);
                }}
                onPointerEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-[13px]",
                  i === active ? "bg-surface-hover" : ""
                )}
              >
                {r.kind === "project" ? (
                  <Folder size={14} className="shrink-0 text-subtlest" aria-hidden="true" />
                ) : (
                  <CheckSquare size={14} className="shrink-0 text-subtlest" aria-hidden="true" />
                )}
                {r.key && <Key>{r.key}</Key>}
                <span className="min-w-0 flex-1 truncate text-text">{r.title}</span>
                {r.context && <span className="hidden truncate text-xs text-subtlest sm:inline">{r.context}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Notifications ──────────────────────────────────────────────────────── */

