import { test } from "node:test";
import assert from "node:assert/strict";
import { dueMeta } from "./time.js";

const daysFromToday = (n) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

test("an open issue past its due date is overdue", () => {
  const due = dueMeta(daysFromToday(-3));
  assert.equal(due.label, "3d overdue");
  assert.equal(due.overdue, true);
});

test("a closed issue is never overdue or due soon: it shows the plain date", () => {
  for (const n of [-3, 0, 1]) {
    const due = dueMeta(daysFromToday(n), { closed: true });
    assert.equal(due.overdue, false);
    assert.equal(due.soon, false);
    assert.doesNotMatch(due.label, /overdue|Today|Tomorrow/);
  }
});
