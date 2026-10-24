/**
 * FILE: backend/src/validators/admin.validators.js
 *
 * Input rules for the super-admin user-management API (routes/admin.routes.js):
 *   PUT /users/:userId/role    body { systemRole } must be a known system role
 *   PUT /users/:userId/status  body { isActive } must be a real boolean
 *
 * `isBoolean({ strict: true })` accepts only true/false, not "true", "1" or 1,
 * so an ambiguous value can never (de)activate an account.
 * Every validator is a FUNCTION returning an array, so each route gets a fresh chain.
 */
import { body } from "express-validator";
import { AvailableSystemRoles } from "../utils/constants.js";
import { requiredEnum } from "./common.js";

export const updateUserRoleValidator = () => [requiredEnum("systemRole", AvailableSystemRoles)];

export const updateUserStatusValidator = () => [
    body("isActive").isBoolean({ strict: true }).withMessage("isActive must be true or false"),
];
