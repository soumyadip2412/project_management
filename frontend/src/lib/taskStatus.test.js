import { test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_TONE, TASK_STATUS_VALUES, statusCategoryOf } from "./taskStatus.js";

test("status categories match the backend's deriveStatusCategory", () => {
  assert.equal(statusCategoryOf("backlog"), "todo");
  assert.equal(statusCategoryOf("todo"), "todo");
  assert.equal(statusCategoryOf("in_progress"), "in_progress");
  assert.equal(statusCategoryOf("in_review"), "in_progress");
  assert.equal(statusCategoryOf("qa_testing"), "in_progress");
  assert.equal(statusCategoryOf("done"), "done");
  assert.equal(statusCategoryOf("cancelled"), "done");
});

test("every status has a lozenge tone", () => {
  for (const status of TASK_STATUS_VALUES) assert.ok(STATUS_TONE[status], status);
});
