/**
 * FILE: backend/src/validators/comment.validators.js
 *
 * Input rules for comments AND notes (both are "text content" resources):
 *   comments   body ≤ 5000 chars, optional parentComment id (for replies)
 *   reactions  a short emoji string (1-16 chars, since emoji can be several code points)
 *   notes      title ≤ 200, content ≤ 20000; on update each is optional but
 *              cannot be blanked
 * Used by routes/comment.routes.js and routes/note.routes.js.
 */
import { body } from "express-validator";
import { optionalNonEmptyText, optionalObjectId, requiredText } from "./common.js";

export const createCommentValidator = () => [requiredText("body", 5000), optionalObjectId("parentComment")];

export const updateCommentValidator = () => [requiredText("body", 5000)];

export const reactionValidator = () => [
    body("emoji").isString().trim().isLength({ min: 1, max: 16 }).withMessage("emoji must be 1-16 characters"),
];

export const createNoteValidator = () => [requiredText("title", 200), requiredText("content", 20000)];

export const updateNoteValidator = () => [optionalNonEmptyText("title", 200), optionalNonEmptyText("content", 20000)];
