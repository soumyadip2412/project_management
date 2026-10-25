import { Link } from "react-router-dom";
import { API_SPEC_URL, ISSUES_URL, REPO_URL, SECTIONS } from "./content";
import { Container } from "./shared";

/**
 * FILE: frontend/src/components/landing/LandingFooter.jsx
 * Navy footer. Every link resolves to something real: an on-page section, an
 * app route or the repository. No invented pages, customers or status claims.
 */
const COLUMNS = [
  { title: "Product", links: SECTIONS.map((s) => ({ label: s.label, href: `#${s.id}` })) },
  {
    title: "Account",
    links: [
      { label: "Sign in", to: "/login" },
      { label: "Create account", to: "/register" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "Source code", href: REPO_URL, external: true },
      { label: "API reference", href: API_SPEC_URL, external: true },
      { label: "Report an issue", href: ISSUES_URL, external: true },
    ],
  },
];

const linkClass = "rounded text-[13px] text-subtle transition-colors hover:text-text";

export default function LandingFooter() {
  return (
    <footer className="surface-navy">
      <Container className="py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="col-span-2 lg:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2 rounded text-[15px] font-semibold text-text">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded bg-[var(--topbar-accent)] text-[13px] font-bold text-[color:var(--topbar)]"
              >
                P
              </span>
              Setu
            </Link>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-subtle">
              Scrum projects with a board, backlog, reports and a sprint strip that flags risk early.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={`Footer: ${col.title}`}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-subtlest">{col.title}</h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.to ? (
                      <Link to={l.to} className={linkClass}>
                        {l.label}
                      </Link>
                    ) : (
                      <a href={l.href} className={linkClass} {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}>
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-10 border-t border-line pt-6 text-xs text-subtlest">© {new Date().getFullYear()} Setu</p>
      </Container>
    </footer>
  );
}
