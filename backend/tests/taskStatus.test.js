import test from "node:test";
import assert from "node:assert/strict";
import {
    AvailableTaskStatuses,
    TaskStatusEnum,
    StatusCategoryEnum,
    AvailableProjectRoles,
} from "../src/utils/constants.js";
import { deriveStatusCategory } from "../src/utils/helpers.js";

/**
 * These tests pin the task-status contract the frontend depends on.
 *
 * The frontend mirrors this enum in `frontend/src/lib/taskStatus.js`. The two
 * repositories cannot import from each other, so this suite is the guard: if
 * someone changes the backend enum, this fails and names the file to update.
 *
 * Background: the board previously used a `review` column while the backend
 * enum defined `in_review`, so dragging a card there persisted an invalid
 * status and the API returned 400.
 */
test("Task status contract", async (t) => {
    // Keep in sync with TASK_STATUS in frontend/src/lib/taskStatus.js
    const EXPECTED_STATUSES = [
        "backlog",
        "todo",
        "in_progress",
        "in_review",
        "qa_testing",
        "done",
        "cancelled",
    ];

    await t.test("the canonical status list is exactly what the frontend mirrors", () => {
        assert.deepEqual(
            [...AvailableTaskStatuses].sort(),
            [...EXPECTED_STATUSES].sort(),
            "Backend task statuses changed — update TASK_STATUS in frontend/src/lib/taskStatus.js to match"
        );
    });

    await t.test("'review' is not a valid status — 'in_review' is", () => {
        assert.equal(AvailableTaskStatuses.includes("review"), false);
        assert.equal(AvailableTaskStatuses.includes("in_review"), true);
        assert.equal(TaskStatusEnum.IN_REVIEW, "in_review");
    });

    await t.test("every canonical status derives a valid status category", () => {
        const categories = Object.values(StatusCategoryEnum);
        for (const status of AvailableTaskStatuses) {
            const category = deriveStatusCategory(status);
            assert.ok(
                categories.includes(category),
                `deriveStatusCategory("${status}") returned "${category}", which is not a StatusCategoryEnum value`
            );
        }
    });

    await t.test("status categories map as the board expects", () => {
        assert.equal(deriveStatusCategory(TaskStatusEnum.BACKLOG), "todo");
        assert.equal(deriveStatusCategory(TaskStatusEnum.TODO), "todo");
        assert.equal(deriveStatusCategory(TaskStatusEnum.IN_PROGRESS), "in_progress");
        assert.equal(deriveStatusCategory(TaskStatusEnum.IN_REVIEW), "in_progress");
        assert.equal(deriveStatusCategory(TaskStatusEnum.QA_TESTING), "in_progress");
        assert.equal(deriveStatusCategory(TaskStatusEnum.DONE), "done");
        // "cancelled" is a closed state. The Task pre-save hook always treated it
        // as "done" while this helper returned "todo"; the hook now delegates here,
        // so the two can no longer disagree.
        assert.equal(deriveStatusCategory(TaskStatusEnum.CANCELLED), "done");
    });
});

/**
 * Locks in the conclusion of the legacy-role audit: "admin" is not a project
 * role. `isProjectAdmin` still special-cases it for historical documents, and
 * `hasPermission` now denies it rather than granting member rights.
 */
test("Project role contract", async (t) => {
    await t.test("'admin' is not a valid project role", () => {
        assert.equal(AvailableProjectRoles.includes("admin"), false);
        assert.equal(AvailableProjectRoles.includes("project_manager"), true);
    });
});
