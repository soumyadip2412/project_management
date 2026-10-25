import { useState } from "react";
import SprintTide from "../project/SprintTide";
import { sampleSprint } from "../../lib/landingSample";
import { Container, SectionHeading } from "./shared";

/**
 * FILE: frontend/src/components/landing/SprintStripSection.jsx   (#sprint-strip)
 * The signature section: the app's own SprintTide component, fed a sample
 * sprint whose dates are built around today, so it always reads
 * "Day 6 of 10" with 5 points added after the start and an At risk badge.
 */

const POINTS = [
  {
    title: "Day progress",
    text: "One segment per sprint day. Elapsed days fill in and today is ringed, so the time left is visible before you read a number.",
  },
  {
    title: "Scope added mid-sprint",
    text: "The sprint is snapshotted when it starts. Points pulled in later are counted against that snapshot and shown in amber.",
  },
  {
    title: "On track or At risk",
    text: "Work left is compared with the ideal line from the total down to zero. Within 10% of the total is On track, within 25% At risk, beyond that Off track.",
  },
];

export default function SprintStripSection() {
  const [{ sprint, issues }] = useState(() => sampleSprint());

  return (
    <section id="sprint-strip" aria-labelledby="sprint-strip-title" className="scroll-mt-16 bg-bg py-16 sm:py-24">
      <Container>
        <SectionHeading id="sprint-strip-title" eyebrow="The sprint strip" title="One line that tells you how the sprint is going">
          The same strip sits on top of the Board, the Backlog and the Summary. It is computed from the sprint&apos;s
          dates and its issues&apos; story points, nothing else.
        </SectionHeading>

        <figure className="mt-10">
          <div className="sm:rounded-md sm:border sm:border-line sm:bg-surface-sunken sm:p-5 [&>section]:mb-0">
            <SprintTide sprint={sprint} issues={issues} />
          </div>
          <figcaption className="mt-2 text-xs text-subtlest">
            The app&apos;s SprintTide component, rendered here with sample data.
          </figcaption>
        </figure>

        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
          {POINTS.map((p, i) => (
            <li key={p.title} className="border-t border-line pt-4">
              <p className="font-mono text-xs text-subtlest">0{i + 1}</p>
              <h3 className="mt-1 text-[15px] font-semibold text-text">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-subtle">{p.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
