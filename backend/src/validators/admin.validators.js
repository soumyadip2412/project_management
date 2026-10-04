import { body } from "express-validator";
import { AvailableSystemRoles } from "../utils/constants.js";
import { requiredEnum } from "./common.js";

export const updateUserRoleValidator = () => [requiredEnum("systemRole", AvailableSystemRoles)];

export const updateUserStatusValidator = () => [
    body("isActive").isBoolean({ strict: true }).withMessage("isActive must be true or false"),
];
