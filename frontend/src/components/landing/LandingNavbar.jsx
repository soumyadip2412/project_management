import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { SECTIONS } from "./content";
import { Container, CtaLink } from "./shared";
import BrandMark from "../ui/BrandMark";

/**
 * FILE: frontend/src/components/landing/LandingNavbar.jsx
 * The landing page's sticky navy bar, in the same chrome as the app's TopBar.
 * Below 1024px the section links move into a menu behind a "Menu" button
 * (aria-expanded / aria-controls; Escape closes it and returns focus).
 */
export default function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef(null);

  // Close the menu once the desktop links are visible again.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e) => e.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="surface-navy sticky top-0 z-40 border-b border-line">
      <Container className="flex h-14 items-center gap-6">
        <Link to="/" className="flex shrink-0 items-center gap-2 rounded text-[15px] font-semibold text-text">
          <BrandMark size="lg" />
          Setu
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="rounded px-2.5 py-1.5 text-[13px] font-medium text-subtle transition-colors hover:text-text">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <CtaLink to="/login" variant="ghost" className="hidden sm:inline-flex">
            Sign in
          </CtaLink>
          <CtaLink to="/register" className="hidden sm:inline-flex">
            Create free account
          </CtaLink>
          <button
            ref={toggleRef}
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded text-subtle hover:bg-surface-hover hover:text-text lg:hidden"
          >
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </Container>

      {open && (
        <div id="mobile-menu" className="surface-navy absolute inset-x-0 top-full max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-y border-line lg:hidden">
          <Container className="py-3">
            <nav aria-label="Sections">
              <ul>
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      onClick={close}
                      className="block rounded px-2 py-2.5 text-[15px] font-medium text-text hover:bg-surface-hover"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:hidden">
              <CtaLink to="/login" variant="secondary" size="lg" onClick={close}>
                Sign in
              </CtaLink>
              <CtaLink to="/register" size="lg" onClick={close}>
                Create free account
              </CtaLink>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
