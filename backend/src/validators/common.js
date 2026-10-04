import { body } from "express-validator";

/**
 * Small building blocks shared by the resource validators.
 * Each one type-checks first, so an object or array can never slip through
 * where a string or id is expected.
 */

export const requiredText = (field, max) =>
    body(field)
        .isString().withMessage(`${field} is required`)
        .trim()
        .isLength({ min: 1, max }).withMessage(`${field} must be 1-${max} characters long`);

export const optionalText = (field, max) =>
    body(field)
        .optional()
        .isString().withMessage(`${field} must be a string`)
        .trim()
        .isLength({ max }).withMessage(`${field} must be at most ${max} characters`);

/** Same as requiredText, but only when the field is present (for updates). */
export const optionalNonEmptyText = (field, max) =>
    body(field)
        .optional()
        .isString().withMessage(`${field} must be a string`)
        .trim()
        .isLength({ min: 1, max }).withMessage(`${field} must be 1-${max} characters long`);

export const optionalEnum = (field, values) =>
    body(field).optional().isIn(values).withMessage(`${field} must be one of: ${values.join(", ")}`);

export const requiredEnum = (field, values) =>
    body(field).isIn(values).withMessage(`${field} must be one of: ${values.join(", ")}`);

export const requiredEmail = (field = "email") =>
    body(field).isString().trim().isEmail().withMessage("A valid email is required").toLowerCase();

/** An id that may be omitted, or sent as null/"" to clear the reference. */
export const optionalObjectId = (field) =>
    body(field).optional({ values: "falsy" }).isMongoId().withMessage(`${field} must be a valid id`);

export const optionalDate = (field) =>
    body(field).optional({ values: "falsy" }).isISO8601().withMessage(`${field} must be an ISO-8601 date`);
