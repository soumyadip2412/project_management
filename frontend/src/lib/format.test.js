import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMinutes } from "./format.js";

test("minutes read as hours and minutes", () => {
  assert.equal(formatMinutes(45), "45m");
  assert.equal(formatMinutes(420), "7h");
  assert.equal(formatMinutes(90), "1h 30m");
  assert.equal(formatMinutes(0), "0m");
  assert.equal(formatMinutes(null), "0m");
});
