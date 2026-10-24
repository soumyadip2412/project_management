/**
 * FILE: backend/src/validators/common.js
 *
 * PURPOSE
 *   Reusable express-validator "builders". Each function returns ONE validation
 *   chain for ONE body field, so resource validators read like a spec:
 *     createTaskValidator = () => [requiredText("title", 200), optionalEnum("priority", ...)]
 *
 * HOW A CHAIN READS
 *   body("title")             look at req.body.title
 *     .isString()             must be a string (blocks {"$ne": null} objects)
 *     .withMessage("...")     the error message for the PREVIOUS check
 *     .trim()                 sanitizer: modifies the value the controller will see
 *     .isLength({min, max})   another check
 *   .optional()                       skip all checks if the field is absent
 *   .optional({ values: "falsy" })    also skip for null, "" , 0, false
 *
 * Chains only RECORD errors; middlewares/validator.middleware.js `validate`
 * turns them into a 422.
 */
import { body } from "express-validator";

/**
 * Small building blocks shared by the resource validators.
 * Each one type-checks first, so an object or array can never slip through
 * where a string or id is expected.
 */

/** A string that must be present and non-blank after trimming, max `max` chars. */
export const requiredText = (field, max) =>
    body(field)
        .isString().withMessage(`${field} is required`)
        .trim()
        .isLength({ min: 1, max }).withMessage(`${field} must be 1-${max} characters long`);

/** May be omitted; if sent it must be a string (empty allowed, e.g. to clear a description). */
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

/** Must be one of `values` (an Available* array from constants.js) when present. */
export const optionalEnum = (field, values) =>
    body(field).optional().isIn(values).withMessage(`${field} must be one of: ${values.join(", ")}`);

export const requiredEnum = (field, values) =>
    body(field).isIn(values).withMessage(`${field} must be one of: ${values.join(", ")}`);

/** A valid email, normalised to lower case so lookups are case-insensitive. */
export const requiredEmail = (field = "email") =>
    body(field).isString().trim().isEmail().withMessage("A valid email is required").toLowerCase();

/** An id that may be omitted, or sent as null/"" to clear the reference. */
export const optionalObjectId = (field) =>
    body(field).optional({ values: "falsy" }).isMongoId().withMessage(`${field} must be a valid id`);

/** An ISO-8601 date string ("2026-10-04" or a full timestamp); null or "" clears it. */
export const optionalDate = (field) =>
    body(field).optional({ values: "falsy" }).isISO8601().withMessage(`${field} must be an ISO-8601 date`);
