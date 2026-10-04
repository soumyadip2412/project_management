import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeProject } from "../middlewares/authorize.middleware.js";
import { audit } from "../middlewares/audit.middleware.js";
import { objectIdParam, validate } from "../middlewares/validator.middleware.js";
import { createNoteValidator, updateNoteValidator } from "../validators/comment.validators.js";
import {
    createNote,
    getProjectNotes,
    getNoteById,
    updateNote,
    deleteNote,
} from "../controllers/note.controller.js";

const router = Router();

router.use(verifyJWT);
router.param("noteId", objectIdParam);

router.route("/:projectId")
    .get(authorizeProject("note", "read"), getProjectNotes)
    .post(authorizeProject("note", "create"), createNoteValidator(), validate, audit("note", "created"), createNote);

router.route("/:projectId/n/:noteId")
    .get(authorizeProject("note", "read"), getNoteById)
    .put(authorizeProject("note", "update"), updateNoteValidator(), validate, audit("note", "updated"), updateNote)
    .delete(authorizeProject("note", "delete"), audit("note", "deleted"), deleteNote);

export default router;
