import { body } from "express-validator";
import {
    AvailableMethodologies,
    AvailableProjectRoles,
    AvailableProjectStatuses,
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
];

export const addProjectMemberValidator = () => [requiredEmail(), optionalEnum("role", AvailableProjectRoles)];

export const updateProjectMemberRoleValidator = () => [requiredEnum("newRole", AvailableProjectRoles)];
