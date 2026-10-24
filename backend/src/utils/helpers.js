/**
 * FILE: backend/src/utils/helpers.js
 *
 * PURPOSE
 *   Small, pure helper functions shared by controllers, models and validators.
 *   None of them touch the request or the database, so they are easy to unit-test.
 *
 *   escapeRegex          make user input safe to embed in a MongoDB $regex (search)
 *   deriveStatusCategory map a task status to "todo" | "in_progress" | "done"
 *   clampPagination      turn ?page=&limit= into safe numbers plus a `skip`
 *   isValidObjectId      check that a string is a 24-hex MongoDB id
 *
 * INTERVIEW NOTES
 *   Q: Why escape regex input?
 *   A: Search uses { title: { $regex: userInput } }. Unescaped input such as
 *      "(a+)+$" is a catastrophic-backtracking pattern (ReDoS) that can pin a
 *      CPU, and ".*" would match everything. Escaping turns it into a literal string.
 *   Q: Why clamp pagination?
 *   A: Without a cap, ?limit=1000000 makes the server load and serialise
 *      a whole collection in one request.
 */
import mongoose from "mongoose";

/**
 * Escapes characters with special meaning in RegExp to prevent ReDoS / injection.
 * `$&` in the replacement means "the matched character", so "." becomes "\.".
 * @param {string} string
 * @returns {string}
 */
export const escapeRegex = (string = "") => {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Derives statusCategory from task status enum.
 * Unknown values fall into "todo" (the `default` branch), so a bad value can
 * never crash the board. Legacy spellings ("review", "qa", "completed") are
 * also accepted.
 * @param {string} status
 * @returns {"todo" | "in_progress" | "done"}
 */
export const deriveStatusCategory = (status = "") => {
    const s = String(status).toLowerCase();
    switch (s) {
        case "done":
        case "completed":
        // "cancelled" is a closed state: the Task pre-save hook has always
        // treated it as "done", while this helper used to fall through to
        // "todo". The two disagreed; "done" is the correct answer.
        case "cancelled":
            return "done";
        case "in_progress":
        case "in_review":
        case "review":
        case "qa_testing":
        case "qa":
            return "in_progress";
        case "todo":
        case "backlog":
        default:
            return "todo";
    }
};

/**
 * Clamps pagination parameters safely.
 * Query-string values arrive as strings; parseInt plus `|| default` handles
 * "abc", "", negative numbers and missing values.
 * Example: clampPagination("3", "500") → { page: 3, limit: 100, skip: 200 }
 * `skip` feeds Mongoose's .skip(): page 3 with 100 per page skips the first 200 documents.
 * @param {number|string} page
 * @param {number|string} limit
 * @param {number} maxLimit
 * @returns {{ page: number, limit: number, skip: number }}
 */
export const clampPagination = (page = 1, limit = 10, maxLimit = 100) => {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;
    return { page: parsedPage, limit: parsedLimit, skip };
};

/**
 * Validates whether an ID string is a valid MongoDB ObjectId.
 * @param {string} id
 * @returns {boolean}
 */
export const isValidObjectId = (id) => {
    // Accepts only an ObjectId instance or a 24-character hex string. (Older
    // bson versions' ObjectId.isValid() also accepted any 12-character string.)
    return Boolean(id) && mongoose.isObjectIdOrHexString(id);
};
