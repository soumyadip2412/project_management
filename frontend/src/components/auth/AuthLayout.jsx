import { Link } from "react-router-dom";

/* What the product actually does — each line is a shipped capability. */
const CAPABILITIES = [
  { title: "Projects and workspaces", text: "Group work by team; invite people with a role per project." },
  { title: "Board and list views", text: "Move tasks through seven statuses, with subtasks and comments." },
  { title: "Sprints", text: "Plan from the backlog, start a sprint, complete it when the work is done." },
  { title: "Role-based access", text: "What someone can do is decided on the server by their project role." },
];

/**
 * Sign-in / sign-up frame. On wide screens a quiet panel explains the product;
 * on narrow screens only the form is shown, with the product name above it.
 */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-bg text-text lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden border-r border-line bg-sidebar px-12 py-10 lg:flex lg:flex-col">
        <Brand />
        <div className="mt-auto max-w-md">
          <p className="text-[15px] font-medium text-text">Plan, track and ship work as a team.</p>
          <dl className="mt-6 space-y-4">
            {CAPABILITIES.map((c) => (
              <div key={c.title}>
                <dt className="text-[13px] font-medium text-text">{c.title}</dt>
                <dd className="mt-0.5 text-[13px] text-subtle">{c.text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-10 text-xs text-subtlest">
          <Link to="/" className="rounded hover:text-text">Back to the home page</Link>
        </p>
      </aside>

      <main className="flex min-h-screen flex-col px-5 py-8 sm:px-8 lg:min-h-0 lg:justify-center lg:py-10">
        <div className="lg:hidden">
          <Brand />
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-10 lg:my-0">
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-text">{title}</h1>
          {subtitle && <p className="mt-1 text-[13px] text-subtle">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="inline-flex items-center gap-2 rounded text-[13px] font-semibold text-text">
      <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded bg-text text-[11px] font-bold text-bg">
        P
      </span>
      Project Camp
    </Link>
  );
}
