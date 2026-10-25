import { Braces, Gauge, KeyRound, LockKeyhole, ScrollText, ShieldCheck } from "lucide-react";
import { Container, SectionHeading } from "./shared";

/**
 * FILE: frontend/src/components/landing/SecuritySection.jsx   (#security)
 * Six capability cards. Every claim maps to backend code: auth.middleware,
 * authorize.middleware + utils/permissions, rateLimiter.middleware,
 * validators + utils/helpers, audit.middleware and the User model.
 */
const CAPABILITIES = [
  {
    icon: LockKeyhole,
    title: "Cookie-only sessions",
    text: "Short-lived access and rotating refresh tokens in httpOnly cookies. Page scripts never see a token.",
  },
  {
    icon: ShieldCheck,
    title: "Fail-closed roles",
    text: "System, workspace and project roles resolve to one role, checked against a central matrix. Unknown roles are denied.",
  },
  {
    icon: Gauge,
    title: "Rate limiting",
    text: "A global limit plus a stricter one on credential endpoints, shared through Redis when it is configured.",
  },
  {
    icon: ScrollText,
    title: "Audit trail",
    text: "Successful changes are recorded with the actor, entity and action, without slowing the response.",
  },
  {
    icon: KeyRound,
    title: "Credential protection",
    text: "Passwords hashed with bcrypt. Reset and verification tokens are stored as SHA-256 digests and expire.",
  },
  {
    icon: Braces,
    title: "Input hardening",
    text: "Fields are validated before a query runs, search input is regex-escaped and page sizes are capped.",
  },
];

export default function SecuritySection() {
  return (
    <section id="security" aria-labelledby="security-title" className="scroll-mt-16 border-y border-line bg-surface py-16 sm:py-24">
      <Container>
        <SectionHeading id="security-title" eyebrow="Security" title="Checked on the server, on every request">
          Sign-in, permissions, rate limits and auditing run as middleware in front of the API&apos;s routes, so no screen relies on
          the browser to keep data safe.
        </SectionHeading>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded border border-line bg-surface p-5">
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" className="text-primary" />
              <h3 className="mt-3 text-[15px] font-semibold text-text">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-subtle">{text}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
