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
