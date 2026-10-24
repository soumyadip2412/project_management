/**
 * FILE: backend/src/validators/project.validators.js
 *
 * Input rules for routes/project.routes.js:
 *   create          name required; optional description, key, workspaceId, methodology
 *   update          every field optional, each checked against its enum
 *   add member      a valid email plus an optional project role
 *   change role     newRole must be a project role
 *
 * The `key` regex /^[A-Za-z][A-Za-z0-9]{1,9}$/ means: starts with a letter,
 * 2-10 characters in total, letters and digits only ("WEB", "APP2"). The model
 * upper-cases it. If omitted, the controller derives a key from the name.
 */
import { body } from "express-validator";
import {
    AvailableMethodologies,
    AvailableProjectRoles,
    AvailableProjectStatuses,
    AvailableTaskStatuses,
    AvailableVisibilities,
} from "../utils/constants.js";
import {
    optionalEnum, optionalNonEmptyText, optionalObjectId, optionalText, requiredEmail, requiredEnum, requiredText,
} from "./common.js";

const PROJECT_CATEGORIES = ["software", "business", "marketing", "operations", "hr", "other"];

export const createProjectValidator = () => [
    requiredText("name", 100),
    optionalText("description", 2000),
    body("key")
        .optional({ values: "falsy" })
        .isString()
        .trim()
        .matches(/^[A-Za-z][A-Za-z0-9]{1,9}$/)
        .withMessage("key must be 2-10 letters/digits, starting with a letter"),
    optionalObjectId("workspaceId"),
    optionalEnum("methodology", AvailableMethodologies),
];

export const updateProjectValidator = () => [
    optionalNonEmptyText("name", 100),
    optionalText("description", 2000),
    optionalEnum("category", PROJECT_CATEGORIES),
    optionalEnum("methodology", AvailableMethodologies),
    optionalEnum("status", AvailableProjectStatuses),
    optionalEnum("visibility", AvailableVisibilities),
    // An object whose keys are canonical statuses and whose values are whole
    // numbers 0-99. Checking every key is also what keeps "$set" and other
    // operator keys out of the update.
    body("wipLimits").optional().custom((value) => {
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
            throw new Error("wipLimits must be an object of status → limit");
        }
        for (const [status, limit] of Object.entries(value)) {
            if (!AvailableTaskStatuses.includes(status)) throw new Error(`Unknown status '${status}'`);
            if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
                throw new Error(`wipLimits.${status} must be a whole number from 0 to 99`);
            }
        }
        return true;
    }),
];

export const addProjectMemberValidator = () => [requiredEmail(), optionalEnum("role", AvailableProjectRoles)];

export const updateProjectMemberRoleValidator = () => [requiredEnum("newRole", AvailableProjectRoles)];
