import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleSprint } from "./landingSample.js";
import { sprintHealth } from "./sprintHealth.js";
import { computeBurndown } from "./burndown.js";

// The landing page's copy describes this exact state, on any day it is viewed.
for (const now of [new Date("2026-03-29T00:30:00"), new Date("2026-10-25T12:00:00"), new Date("2026-12-31T23:30:00")]) {
  test(`landing sample sprint reads day 6 of 10, +5 added, at risk (${now.toISOString()})`, () => {
    const { sprint, issues } = sampleSprint(now);
    const h = sprintHealth(sprint, issues, now);
    assert.equal(h.totalDays, 10);
    assert.equal(h.dayIndex, 6);
    assert.equal(h.unit, "pts");
    assert.equal(h.total, 34);
    assert.equal(h.remaining, 21);
    assert.equal(h.added, 5);
    assert.equal(h.health, "at_risk");
  });
}

test("landing sample sprint has a burndown line to draw", () => {
  const now = new Date("2026-10-25T12:00:00");
  const { sprint, issues } = sampleSprint(now);
  const { actual, total } = computeBurndown(sprint, issues, now);
  assert.equal(total, 34);
  assert.deepEqual(actual.slice(0, 6), [34, 29, 26, 26, 21, 21]);
  assert.equal(actual[6], null);
});
