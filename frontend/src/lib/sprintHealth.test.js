import { test } from "node:test";
import assert from "node:assert/strict";
import { daySegments, sprintHealth, sprintHealthFromTotals } from "./sprintHealth.js";

// Local noon, so a test never sits on a day boundary.
const at = (day) => new Date(`${day}T12:00:00`);
const sprint = (start, end, extra = {}) => ({ startDate: at(start), endDate: at(end), burndownData: [], ...extra });
const issue = (storyPoints, done = false) => ({ storyPoints, statusCategory: done ? "done" : "todo" });
const tenOnePointIssues = (doneCount) => Array.from({ length: 10 }, (_, i) => issue(1, i < doneCount));

test("counts calendar days inclusively and clamps today into the sprint", () => {
  const s = sprint("2026-10-18", "2026-10-27");
  assert.equal(sprintHealth(s, [], at("2026-10-18")).totalDays, 10);
  assert.equal(sprintHealth(s, [], at("2026-10-18")).dayIndex, 1);
  assert.equal(sprintHealth(s, [], at("2026-10-23")).dayIndex, 6);
  assert.equal(sprintHealth(s, [], at("2026-11-30")).dayIndex, 10);
  assert.equal(sprintHealth(s, [], at("2026-10-01")).dayIndex, 0);
});

test("a one-day sprint has one day", () => {
  const h = sprintHealth(sprint("2026-10-18", "2026-10-18"), [issue(3)], at("2026-10-18"));
  assert.equal(h.totalDays, 1);
  assert.equal(h.dayIndex, 1);
});

test("day counts do not depend on the viewer's time zone", () => {
  const original = process.env.TZ;
  const s = { startDate: "2026-10-18T00:00:00.000Z", endDate: "2026-10-27T00:00:00.000Z", burndownData: [] };
  const counts = ["America/Los_Angeles", "Asia/Kolkata", "UTC"].map((tz) => {
    process.env.TZ = tz;
    return sprintHealth(s, [], new Date("2026-10-22T12:00:00.000Z")).totalDays;
  });
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
  assert.deepEqual(counts, [10, 10, 10]);
});

test("totals and remaining points come from the issues", () => {
  const h = sprintHealth(sprint("2026-10-18", "2026-10-27"), [issue(8), issue(3, true), issue(5)], at("2026-10-20"));
  assert.equal(h.unit, "pts");
  assert.equal(h.total, 16);
  assert.equal(h.remaining, 13);
});

test("added points are measured against the start snapshot, never negative", () => {
  const issues = [issue(8), issue(5)];
  const day = at("2026-10-20");
  assert.equal(sprintHealth(sprint("2026-10-18", "2026-10-27", { burndownData: [{ totalPoints: 10 }] }), issues, day).added, 3);
  assert.equal(sprintHealth(sprint("2026-10-18", "2026-10-27", { burndownData: [{ totalPoints: 20 }] }), issues, day).added, 0);
  assert.equal(sprintHealth(sprint("2026-10-18", "2026-10-27"), issues, day).added, 0);
});

test("health bands compare remaining work with the ideal line", () => {
  // Day 6 of 10 with 10 points: the ideal remaining is 4.
  const s = sprint("2026-10-18", "2026-10-27");
  const day6 = at("2026-10-23");
  assert.equal(sprintHealth(s, tenOnePointIssues(5), day6).health, "on_track"); // 5 left, gap 0.1
  assert.equal(sprintHealth(s, tenOnePointIssues(4), day6).health, "at_risk"); // 6 left, gap 0.2
  assert.equal(sprintHealth(s, tenOnePointIssues(3), day6).health, "off_track"); // 7 left, gap 0.3
});

test("past the end with work left is overdue; with nothing left it is on track", () => {
  const s = sprint("2026-10-18", "2026-10-27");
  assert.equal(sprintHealth(s, tenOnePointIssues(9), at("2026-10-28")).health, "overdue");
  assert.equal(sprintHealth(s, tenOnePointIssues(10), at("2026-10-28")).health, "on_track");
});

test("without estimates it counts issues instead of points", () => {
  const s = sprint("2026-10-18", "2026-10-27", { summary: { totalIssues: 2 } });
  const h = sprintHealth(s, [issue(null), issue(null, true), issue(null), issue(null)], at("2026-10-20"));
  assert.equal(h.unit, "issues");
  assert.equal(h.total, 4);
  assert.equal(h.remaining, 3);
  assert.equal(h.added, 2);
});

test("a sprint with no issues has no health", () => {
  assert.equal(sprintHealth(sprint("2026-10-18", "2026-10-27"), [], at("2026-10-20")).health, null);
});

test("totals from an aggregate give the same answer as the issue list", () => {
  const s = sprint("2026-10-18", "2026-10-27");
  const fromIssues = sprintHealth(s, tenOnePointIssues(4), at("2026-10-23"));
  const fromTotals = sprintHealthFromTotals(s, { unit: "pts", total: 10, remaining: 6, startTotal: null }, at("2026-10-23"));
  assert.deepEqual(fromTotals, fromIssues);
});

test("day segments mark the past, today and the future, capped at 20", () => {
  const ten = daySegments(10, 6);
  assert.equal(ten.length, 10);
  assert.equal(ten.indexOf("today"), 5);
  assert.equal(ten.filter((s) => s === "past").length, 5);

  const long = daySegments(40, 20);
  assert.equal(long.length, 20);
  assert.equal(long.indexOf("today"), 9);

  assert.deepEqual(daySegments(3, 0), ["future", "future", "future"]);
});
