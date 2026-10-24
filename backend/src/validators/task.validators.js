/**
 * FILE: backend/src/validators/task.validators.js
 *
 * Input rules for routes/task.routes.js (tasks and their embedded subtasks).
 *
 * WHAT IS CHECKED HERE vs. IN THE CONTROLLER
 *   Here (shape only): types, lengths, enums, id format, array sizes.
 *     "assignees.*" applies isMongoId to EVERY array element.
 *     optional({ values: "null" }) lets the client send null to clear a number.
 *   In task.controller.js (needs the database): every assignee is a project
 *   member, and sprint/parent belong to the SAME project.
 *
 * INTERVIEW NOTES
 *   Q: Why cap arrays (max 20 assignees or labels)?
 *   A: Unbounded arrays in a request are a cheap way to bloat documents or
 *      trigger expensive membership lookups (a denial-of-service vector).
 */
import { body } from "express-validator";
import { AvailableIssueTypes, AvailablePriorities, AvailableTaskStatuses } from "../utils/constants.js";
import {
    optionalDate, optionalEnum, optionalNonEmptyText, optionalObjectId, optionalText, requiredText,
} from "./common.js";

const SUBTASK_STATUSES = ["todo", "in_progress", "done"];

// Fields shared by create and update; every one is optional here.
const taskFields = () => [
    optionalText("description", 10000),
    optionalEnum("status", AvailableTaskStatuses),
    optionalEnum("issueType", AvailableIssueTypes),
    optionalEnum("priority", AvailablePriorities),
    body("storyPoints").optional({ values: "null" }).isInt({ min: 0, max: 100 })
        .withMessage("storyPoints must be an integer between 0 and 100"),
    body("assignees").optional().isArray({ max: 20 }).withMessage("assignees must be an array of at most 20 ids"),
    body("assignees.*").isMongoId().withMessage("each assignee must be a valid id"),
    optionalObjectId("sprint"),
    optionalObjectId("parent"),
    body("labels").optional().isArray({ max: 20 }).withMessage("labels must be an array of at most 20 strings"),
    body("labels.*").isString().trim().isLength({ min: 1, max: 50 }).withMessage("each label must be 1-50 characters"),
    optionalDate("dueDate"),
    body("originalEstimate").optional({ values: "null" }).isInt({ min: 0 }).withMessage("originalEstimate is in minutes"),
    body("remainingEstimate").optional({ values: "null" }).isInt({ min: 0 }).withMessage("remainingEstimate is in minutes"),
];

export const createTaskValidator = () => [requiredText("title", 200), ...taskFields()];

export const updateTaskValidator = () => [optionalNonEmptyText("title", 200), ...taskFields()];

export const createSubtaskValidator = () => [requiredText("title", 200), optionalEnum("status", SUBTASK_STATUSES)];

export const updateSubtaskValidator = () => [optionalNonEmptyText("title", 200), optionalEnum("status", SUBTASK_STATUSES)];
