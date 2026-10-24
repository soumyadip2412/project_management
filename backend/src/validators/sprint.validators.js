/**
 * FILE: backend/src/validators/sprint.validators.js
 *
 * Input rules for routes/sprint.routes.js:
 *   create     startDate and endDate required (ISO-8601), end after start
 *   update     the same fields, all optional
 *   complete   optional moveIncompleteToSprint id (where unfinished tasks go)
 *
 * `.custom((value, { req }) => ...)` is express-validator's escape hatch for
 * rules spanning several fields: it can read the whole req.body. Throwing
 * inside it records a validation error.
 * Note: on UPDATE only the dates sent in the same request are compared; the
 * controller checks the stored dates too.
 */
import { body } from "express-validator";
import { optionalNonEmptyText, optionalObjectId, optionalText } from "./common.js";

// End must come after start whenever both are known in the request.
const endAfterStart = () =>
    body("endDate").custom((endDate, { req }) => {
        if (endDate && req.body.startDate && new Date(endDate) <= new Date(req.body.startDate)) {
            throw new Error("endDate must be after startDate");
        }
        return true;
    });

export const createSprintValidator = () => [
    optionalNonEmptyText("name", 100),
    optionalText("goal", 500),
    body("startDate").isISO8601().withMessage("startDate is required (ISO-8601)"),
    body("endDate").isISO8601().withMessage("endDate is required (ISO-8601)"),
    endAfterStart(),
];

export const updateSprintValidator = () => [
    optionalNonEmptyText("name", 100),
    optionalText("goal", 500),
    body("startDate").optional().isISO8601().withMessage("startDate must be ISO-8601"),
    body("endDate").optional().isISO8601().withMessage("endDate must be ISO-8601"),
    endAfterStart(),
];

export const completeSprintValidator = () => [optionalObjectId("moveIncompleteToSprint")];
