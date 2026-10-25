import { useState } from "react";
import { ChartLine, Columns3, ListOrdered } from "lucide-react";
import { TabPanel, Tabs } from "../ui/Navigation";
import { Container, ScreenshotFrame, SectionHeading } from "./shared";

/**
 * FILE: frontend/src/components/landing/ProductTabs.jsx   (#product)
 * Plan · Track · Review, with the app's own accessible Tabs (roving tabindex,
 * arrow keys, Home/End). Each tab is one real screenshot and three points.
 */
const TABS = [
  {
    id: "plan",
    label: "Plan",
    icon: ListOrdered,
    title: "Backlog",
    image: { src: "/landing/backlog-light.png", label: "Payments Platform / Backlog" },
    alt: "The Backlog: the active Sprint 2 group with five issues, the planned Sprint 3 group with a warning that reads 18 pts planned, team averages 13, and the unplanned backlog below.",
    points: [
      { title: "Sprint groups", text: "Every planned sprint is a group above the backlog, with its dates, issue count and points." },
      { title: "Drag to plan", text: "Move issues between the backlog and sprints by dragging them, or with each row's menu." },
      { title: "Overcommit warning", text: "A planned sprint more than 10% above the team's average velocity is flagged before you start it." },
    ],
  },
  {
    id: "track",
    label: "Track",
    icon: Columns3,
    title: "Board",
    image: { src: "/landing/board-light.png", darkSrc: "/landing/board-dark.png", label: "Payments Platform / Board" },
    alt: "The Board: the Sprint 2 strip, search and filters, a None or By assignee grouping switch, and To do, In progress, In review, QA testing and Done columns.",
    points: [
      { title: "Status columns", text: "Drag cards across the workflow. Each card shows its key, type, points, due date and assignee." },
      { title: "Swimlanes", text: "Group the board by assignee to see who is carrying what in the sprint." },
      { title: "WIP limits", text: "Set a limit per column in project settings. A column over its limit turns red; nothing is blocked." },
    ],
  },
  {
    id: "review",
    label: "Review",
    icon: ChartLine,
    title: "Reports",
    image: { src: "/landing/reports-light.png", label: "Payments Platform / Reports" },
    alt: "Reports: a burndown chart for Sprint 2 with the remaining and ideal lines, and a velocity chart of story points completed per sprint with the average marked.",
    points: [
      { title: "Burndown", text: "Points remaining each day against the ideal line, from the sprint's start to its end." },
      { title: "Velocity", text: "Story points completed per sprint, with the team average that the backlog plans against." },
      { title: "Data tables", text: "Every chart can show its numbers as a table, for screen readers and for copying." },
    ],
  },
];

export default function ProductTabs() {
  const [tab, setTab] = useState("plan");
  const active = TABS.find((t) => t.id === tab);

  return (
    <section id="product" aria-labelledby="product-title" className="scroll-mt-16 border-y border-line bg-surface py-16 sm:py-24">
      <Container>
        <SectionHeading id="product-title" eyebrow="Product" title="Plan the sprint, track the work, review the result">
          Backlog, Board and Reports are three views of the same sprint, so a change in one shows up in the others.
        </SectionHeading>

        <Tabs label="Product areas" items={TABS} value={tab} onChange={setTab} className="mt-8" />

        <TabPanel id={active.id}>
          <div className="pt-6">
            <ul className="grid gap-5 sm:grid-cols-3 sm:gap-6">
              {active.points.map((p) => (
                <li key={p.title}>
                  <h3 className="text-[15px] font-semibold text-text">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-subtle">{p.text}</p>
                </li>
              ))}
            </ul>
            <ScreenshotFrame
              key={active.id}
              className="mt-8"
              crop="content"
              src={active.image.src}
              darkSrc={active.image.darkSrc}
              label={active.image.label}
              alt={active.alt}
            />
          </div>
        </TabPanel>
      </Container>
    </section>
  );
}
