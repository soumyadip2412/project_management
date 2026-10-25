import { ChevronRight, ExternalLink } from "lucide-react";
import { API_SPEC_URL, REPO_URL } from "./content";
import { Container, SectionHeading } from "./shared";

/**
 * FILE: frontend/src/components/landing/BuiltSection.jsx   (#built)
 * The developer section: the stack, the request pipeline every protected route
 * runs (backend/src/app.js and src/middlewares/*), and the four layers.
 */
const STACK = [
  { area: "Client", items: ["React 19", "Vite", "Tailwind v4"] },
  { area: "API", items: ["Node.js", "Express 5", "ES modules"] },
  { area: "Data", items: ["MongoDB", "Mongoose"] },
  { area: "Auth", items: ["Cookie-only JWT", "Refresh rotation"] },
  { area: "Tests", items: ["Playwright", "node:test"] },
];

const PIPELINE = ["Request", "Verify JWT", "Membership and role", "Validate input", "Audit", "Controller"];

const LAYERS = [
  {
    title: "API layer",
    text: "Express 5 in native ESM. Every controller is wrapped in one async handler, and one error mapper turns failures into the ApiError envelope.",
  },
  {
    title: "Data layer",
    text: "MongoDB through Mongoose. Workspaces hold projects, which own sprints, issues, comments and notes. Issue keys read like PAY-7.",
  },
  {
    title: "Client layer",
    text: "React 19 in JavaScript on Vite, styled with Tailwind v4 design tokens for light and dark themes, talking to the API through a single client.",
  },
  {
    title: "Side effects",
    text: "After a successful write, a notification service tells the right people and the audit middleware records the change. Neither can fail the request.",
  },
];

function GithubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

const linkClass =
  "inline-flex h-9 items-center gap-2 rounded border border-line-strong bg-surface px-3.5 text-[13px] font-medium text-text transition-colors hover:bg-surface-hover";

export default function BuiltSection() {
  return (
    <section id="built" aria-labelledby="built-title" className="scroll-mt-16 bg-bg py-16 sm:py-24">
      <Container>
        <SectionHeading id="built-title" eyebrow="How it's built" title="A layered API with the checks in one place">
          For developers and reviewers: a route declares what it needs, and authentication, membership, permissions,
          validation and auditing are applied the same way everywhere.
        </SectionHeading>

        <dl className="mt-10 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-5">
          {STACK.map((s) => (
            <div key={s.area} className="bg-surface px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-subtlest">{s.area}</dt>
              <dd className="mt-1 text-sm font-medium text-text">{s.items.join(", ")}</dd>
            </div>
          ))}
        </dl>

        <h3 className="mt-12 text-[15px] font-semibold text-text">The request pipeline</h3>
        <ol
          aria-label="Request pipeline, in order"
          className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2 font-mono text-[12.5px]"
        >
          {PIPELINE.map((step, i) => (
            <li key={step} className="flex items-center gap-1.5">
              <span
                className={
                  i === PIPELINE.length - 1
                    ? "rounded border border-primary bg-primary-subtle px-2 py-1 text-text"
                    : "rounded border border-line bg-surface px-2 py-1 text-text"
                }
              >
                {step}
              </span>
              {i < PIPELINE.length - 1 && <ChevronRight size={14} aria-hidden="true" className="text-subtlest" />}
            </li>
          ))}
        </ol>

        <ul className="mt-10 grid gap-x-6 gap-y-6 sm:grid-cols-2">
          {LAYERS.map((l) => (
            <li key={l.title} className="border-t border-line pt-4">
              <h3 className="text-[15px] font-semibold text-text">{l.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-subtle">{l.text}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={linkClass}>
            <GithubMark /> Source on GitHub
          </a>
          <a href={API_SPEC_URL} target="_blank" rel="noreferrer" className={linkClass}>
            API reference (OpenAPI) <ExternalLink size={14} aria-hidden="true" />
          </a>
          <p className="text-[13px] text-subtlest">Swagger UI runs at /api-docs in development.</p>
        </div>
      </Container>
    </section>
  );
}
