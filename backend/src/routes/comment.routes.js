import { Router } from "express";
import {
    createComment,
    getTaskComments,
    updateComment,
    deleteComment,
    addReaction,
} from "../controllers/comment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeProject } from "../middlewares/authorize.middleware.js";
import { audit } from "../middlewares/audit.middleware.js";
import { objectIdParam, validate, validateObjectIds } from "../middlewares/validator.middleware.js";
import { createCommentValidator, reactionValidator, updateCommentValidator } from "../validators/comment.validators.js";

// Mounted at /api/v1/projects/:projectId/tasks/:taskId/comments.
const router = Router({ mergeParams: true });

// :taskId arrives through the mount path, which router.param cannot see.
router.use(verifyJWT, validateObjectIds("taskId"));
router.param("commentId", objectIdParam);

router.route("/")
    .post(authorizeProject("comment", "create"), createCommentValidator(), validate, audit("comment", "created"), createComment)
    .get(authorizeProject("comment", "read"), getTaskComments);

// Authorship ("only your own comment") is checked in the controller.
router.route("/:commentId")
    .put(authorizeProject("comment", "update"), updateCommentValidator(), validate, audit("comment", "updated"), updateComment)
    .delete(authorizeProject("comment", "delete"), audit("comment", "deleted"), deleteComment);

router.post("/:commentId/reactions", authorizeProject("comment", "create"), reactionValidator(), validate, addReaction);

export default router;
