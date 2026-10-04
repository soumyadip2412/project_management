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
