import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeProject } from "../middlewares/authorize.middleware.js";
import { audit } from "../middlewares/audit.middleware.js";
import { objectIdParam, validate } from "../middlewares/validator.middleware.js";
import {
    createSubtaskValidator, createTaskValidator, updateSubtaskValidator, updateTaskValidator,
} from "../validators/task.validators.js";
import {
    createTask,
    getProjectTasks,
    getTaskById,
    updateTask,
    deleteTask,
    createSubtask,
    updateSubtask,
    deleteSubtask,
} from "../controllers/task.controller.js";

/*
 * Pipeline for every route (the canonical example for this codebase):
 *
 *   verifyJWT            who are you?                         401
 *   authorizeProject     member of :projectId, allowed to do  403 / 404
 *                        <resource>:<action>? loads req.project
 *   validator + validate is the input well-formed?            422
 *   audit                record it once the response succeeds
 *   controller           business logic, scoped to req.project
 */
const router = Router();

router.use(verifyJWT);
router.param("taskId", objectIdParam);
router.param("subTaskId", objectIdParam);

router.route("/:projectId")
    .get(authorizeProject("task", "read"), getProjectTasks)
    .post(authorizeProject("task", "create"), createTaskValidator(), validate, audit("task", "created"), createTask);

router.route("/:projectId/t/:taskId")
    .get(authorizeProject("task", "read"), getTaskById)
    .put(authorizeProject("task", "update"), updateTaskValidator(), validate, audit("task", "updated"), updateTask)
    .delete(authorizeProject("task", "delete"), audit("task", "deleted"), deleteTask);

// Subtasks are embedded in their task, so changing them is a task update.
router.route("/:projectId/t/:taskId/subtasks")
    .post(authorizeProject("task", "update"), createSubtaskValidator(), validate, audit("task", "updated"), createSubtask);

router.route("/:projectId/st/:subTaskId")
    .put(authorizeProject("task", "update"), updateSubtaskValidator(), validate, audit("task", "updated"), updateSubtask)
    .delete(authorizeProject("task", "update"), audit("task", "updated"), deleteSubtask);

export default router;
