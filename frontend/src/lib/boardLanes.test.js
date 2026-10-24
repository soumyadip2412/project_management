import { test } from "node:test";
import assert from "node:assert/strict";
import { groupIntoLanes, UNASSIGNED, wipState } from "./boardLanes.js";

const ana = { _id: "u1", fullName: "Ana Silva" };
const bo = { _id: "u2", fullName: "Bo Chen" };
const task = (id, assignees, storyPoints = 1) => ({ _id: id, assignees, storyPoints });

test("lanes are sorted by name, with Unassigned last, and carry their points", () => {
  const lanes = groupIntoLanes([task("a", [bo], 3), task("b", []), task("c", [ana], 5), task("d", [bo], 2)]);
  assert.deepEqual(lanes.map((l) => l.label), ["Ana Silva", "Bo Chen", "Unassigned"]);
  assert.deepEqual(lanes.map((l) => l.points), [5, 5, 1]);
  assert.equal(lanes[2].key, UNASSIGNED);
});

test("an issue with several assignees sits in its first assignee's lane only", () => {
  const lanes = groupIntoLanes([task("a", [bo, ana], 8)]);
  assert.equal(lanes.length, 1);
  assert.equal(lanes[0].label, "Bo Chen");
  assert.equal(lanes[0].points, 8);
  assert.equal(lanes.flatMap((l) => l.tasks).length, 1);
});

test("unestimated issues add no points", () => {
  assert.equal(groupIntoLanes([task("a", [ana], null)])[0].points, 0);
});

test("WIP state shows the limit and flags only real overflow", () => {
  assert.deepEqual(wipState(4, 3), { limited: true, over: true, label: "4 / 3" });
  assert.deepEqual(wipState(3, 3), { limited: true, over: false, label: "3 / 3" });
  assert.deepEqual(wipState(2, 0), { limited: false, over: false, label: "2" });
  assert.deepEqual(wipState(2, undefined), { limited: false, over: false, label: "2" });
});
