/**
 * FILE: frontend/src/lib/landingSample.js
 * The sample sprint the landing page feeds to the real SprintTide component.
 * Its dates are built around `now`, so the strip always reads "Day 6 of 10",
 * 21 of 34 points left, 5 points added after the start, At risk.
 * Pure, so landingSample.test.js checks it against sprintHealth().
 */

/** A 10-day sprint that started five days ago; 13 of 34 points are done. */
export function sampleSprint(now = new Date()) {
  const day = (offset) => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d.toISOString();
  };
  const sprint = {
    name: "Sprint 2",
    goal: "Ship checkout to beta",
    startDate: day(-5),
    endDate: day(4),
    // The snapshot taken when the sprint started: 29 points were committed.
    burndownData: [{ totalPoints: 29 }],
  };
  const issues = [
    { storyPoints: 5, statusCategory: "done", completedAt: day(-4) },
    { storyPoints: 3, statusCategory: "done", completedAt: day(-3) },
    { storyPoints: 5, statusCategory: "done", completedAt: day(-1) },
    { storyPoints: 8, statusCategory: "in_progress" },
    { storyPoints: 5, statusCategory: "in_progress" },
    { storyPoints: 3, statusCategory: "todo" },
    // Pulled in mid-sprint: the "+5 pts added".
    { storyPoints: 5, statusCategory: "todo" },
  ];
  return { sprint, issues };
}
