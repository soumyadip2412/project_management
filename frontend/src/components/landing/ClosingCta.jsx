import { DEMO_ENTRY } from "./content";
import { Container, CtaLink } from "./shared";

/** FILE: frontend/src/components/landing/ClosingCta.jsx — the last call to action before the footer. */
export default function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="border-t border-line bg-surface py-16 sm:py-20">
      <Container className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 id="cta-title" className="text-[26px] font-semibold leading-tight tracking-[-0.015em] text-text sm:text-[30px]">
            Plan your next sprint in Project Camp
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-subtle">
            Create a workspace, invite your team with a role each, and start a sprint from the backlog.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <CtaLink to={DEMO_ENTRY.to} variant="secondary" size="lg">
            {DEMO_ENTRY.label}
          </CtaLink>
          <CtaLink to="/register" size="lg">
            Create free account
          </CtaLink>
        </div>
      </Container>
    </section>
  );
}
