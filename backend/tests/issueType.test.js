import test from "node:test";
import assert from "node:assert/strict";
import { AvailableIssueTypes } from "../src/utils/constants.js";

/**
 * The frontend mirrors the issue types in `frontend/src/lib/issueType.js`
 * (ISSUE_TYPE_META). The repositories cannot import each other, so this pins
 * the list: if it fails, update ISSUE_TYPE_META to match.
 */
test("issue types match what the frontend mirrors", () => {
    assert.deepEqual(
        [...AvailableIssueTypes].sort(),
        ["bug", "epic", "improvement", "story", "subtask", "task"],
        "Backend issue types changed: update ISSUE_TYPE_META in frontend/src/lib/issueType.js"
    );
});
