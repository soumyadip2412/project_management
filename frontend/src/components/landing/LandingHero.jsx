import { DEMO_ENTRY } from "./content";
import { Container, CtaLink, ScreenshotFrame } from "./shared";

/**
 * FILE: frontend/src/components/landing/LandingHero.jsx
 * Navy hero (the app's --topbar colour) with the headline and two actions,
 * then a real screenshot of the Board. The navy band stops halfway down the
 * screenshot, so the frame sits across the hero and the light body below.
 */
export default function LandingHero() {
  return (
    <section id="hero" aria-labelledby="hero-title">
      <div className="surface-navy">
        <Container className="pb-14 pt-14 sm:pb-16 sm:pt-20">
          <h1
            id="hero-title"
            className="max-w-3xl text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-text sm:text-5xl lg:text-[56px]"
          >
            See sprint risk before it becomes a missed deadline.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-subtle sm:text-lg">
            Setu is a Scrum workspace where the board, backlog and reports share one sprint strip that compares
            the work left with the ideal line, every day.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CtaLink to={DEMO_ENTRY.to} variant="secondary" size="lg">
              {DEMO_ENTRY.label}
            </CtaLink>
            <CtaLink to="/register" size="lg">
              Create free account
            </CtaLink>
          </div>
        </Container>
      </div>

      <div className="relative bg-bg">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1/2 bg-[var(--topbar)]" />
        <Container className="relative">
          <ScreenshotFrame
            eager
            src="/landing/board-light.png"
            darkSrc="/landing/board-dark.png"
            label="Payments Platform / Board"
            alt="The Setu board for the Payments Platform project: the Sprint 2 strip at the top, then To do, In progress, In review, QA testing and Done columns with issue cards showing keys, story points, due dates and assignees."
          />
        </Container>
      </div>
    </section>
  );
}
