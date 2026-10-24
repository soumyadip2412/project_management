/**
 * FILE: backend/src/middlewares/validator.middleware.js
 *
 * PURPOSE
 *   The "input is well-formed" step of the pipeline:
 *     verifyJWT → authorize* → <validator chain> → validate → audit → controller
 *
 *   validate           collects express-validator results → 422 Unprocessable Entity
 *   objectIdParam      router.param hook: a malformed :id → 400 before any DB query
 *   validateObjectIds  the same for ids that come from a parent router's mount path
 *
 * HOW express-validator WORKS HERE
 *   A validator chain (e.g. createTaskValidator() in validators/task.validators.js)
 *   is an array of middlewares. Each one checks a field and RECORDS errors on the
 *   request without stopping it. `validate` then reads them with validationResult(req)
 *   and throws if there are any.
 *
 * INTERVIEW NOTES
 *   Q: 400 vs. 422?
 *   A: 400 = the request itself is malformed (bad JSON, an impossible id).
 *      422 = the request parsed fine, but the field values break the rules
 *      ("title is required").
 *   Q: How does validation prevent NoSQL injection?
 *   A: Fields are type-checked (isString, isMongoId, isIn). A payload like
 *      {"email": {"$ne": null}} fails isString, so the operator object never
 *      reaches a Mongo query.
 */
import { validationResult } from "express-validator";
import { ApiError } from "../utils/api-errors.js";
import { isValidObjectId } from "../utils/helpers.js";

/**
 * Runs after an express-validator chain. Any failure becomes a 422 with the
 * field-level errors, so the controller only ever sees well-typed input.
 */
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    // Shape: [{ title: "Title is required" }, { priority: "Invalid priority" }].
    // The first message doubles as the top-level `message` for simple UIs.
    const extractedErrors = errors.array().map((err) => ({ [err.path]: err.msg }));
    throw new ApiError(422, errors.array()[0].msg, extractedErrors);
};

/**
 * For `router.param(name, objectIdParam)`: rejects a malformed id with 400
 * before any database query runs.
 */
export const objectIdParam = (req, res, next, value, name) => {
    if (!isValidObjectId(value)) return next(new ApiError(400, `Invalid ${name}`));
    next();
};

/**
 * For ids that reach a nested router through its mount path (router.param
 * only sees params declared on the router itself).
 */
export const validateObjectIds = (...names) => (req, res, next) => {
    for (const name of names) {
        if (req.params[name] !== undefined && !isValidObjectId(req.params[name])) {
            throw new ApiError(400, `Invalid ${name}`);
        }
    }
    next();
};
