import { useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { IconButton } from "../ui/Button";
import NavItem, { NavSection } from "./NavItem";
import { GLOBAL_LINKS } from "./navigation";

/**
 * ≥1024px: a sticky 240px column under the top bar.
 * Below: an off-canvas drawer holding the global links, then this layout's
 * own links. Focus moves into it when it opens; Escape closes it and returns
 * focus to the ☰ button.
 */
export default function SidebarFrame({ children }) {
  const { drawerOpen, closeDrawer, menuButtonRef } = useOutletContext();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const ref = useRef(null);

  useEffect(() => {
    if (!drawerOpen) return;
    ref.current?.querySelector("a")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        closeDrawer();
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer, menuButtonRef]);

  return (
    <>
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-[var(--surface-overlay)] lg:hidden" onClick={closeDrawer} aria-hidden="true" />
      )}
      <aside
        ref={ref}
        id="app-sidebar"
        aria-label="Main navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-line bg-sidebar transition-[transform,visibility] duration-200",
          "lg:visible lg:sticky lg:top-12 lg:z-auto lg:h-[calc(100vh-3rem)] lg:w-60 lg:translate-x-0",
          drawerOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        )}
      >
        {!isDesktop && (
          <div className="border-b border-line px-2 py-2">
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="text-[13px] font-semibold text-text">Setu</span>
              <IconButton label="Close navigation" size="sm" onClick={closeDrawer}>
                <X size={16} />
              </IconButton>
            </div>
            <NavSection>
              {GLOBAL_LINKS.map((link) => (
                <NavItem key={link.to} {...link} />
              ))}
            </NavSection>
          </div>
        )}
        {children}
      </aside>
    </>
  );
}
