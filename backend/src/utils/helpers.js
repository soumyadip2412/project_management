import mongoose from "mongoose";

/**
 * Escapes characters with special meaning in RegExp to prevent ReDoS / injection.
 * @param {string} string 
 * @returns {string}
 */
export const escapeRegex = (string = "") => {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Derives statusCategory from task status enum.
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
