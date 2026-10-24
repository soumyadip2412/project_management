/**
 * FILE: backend/src/routes/sprint.routes.js
 * Mounted at /api/v1/projects/:projectId/sprints
 *
 * ENDPOINTS
 *   POST   /                       create a sprint (status "planned")     sprint:create
 *   GET    /                       list the project's sprints             sprint:read
 *   GET    /velocity               points completed per finished sprint   sprint:read
 *   GET    /:sprintId              one sprint (+ its tasks)               sprint:read
 *   PUT    /:sprintId              edit name/goal/dates                   sprint:update
 *   DELETE /:sprintId              delete (tasks are detached)            sprint:delete
 *   POST   /:sprintId/start        planned → active                       sprint:start
 *   POST   /:sprintId/complete     active → completed                     sprint:complete
 *   GET    /:sprintId/burndown     data for the burndown chart            sprint:read
 *
 * Why POST for start/complete instead of PUT { status }? They are ACTIONS with
 * side effects (velocity, moving unfinished tasks, notifications), not plain
 * field edits. A dedicated endpoint per transition keeps the rules in one place.
 * "/velocity" is registered before "/:sprintId" so it is not read as an id.
 */
import { Router } from "express";
import {
    createSprint,
    getProjectSprints,
    getSprintById,
    updateSprint,
    startSprint,
    completeSprint,
    deleteSprint,
    getBurndownData,
    getVelocityData,
} from "../controllers/sprint.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeProject } from "../middlewares/authorize.middleware.js";
import { audit } from "../middlewares/audit.middleware.js";
import { objectIdParam, validate } from "../middlewares/validator.middleware.js";
import { completeSprintValidator, createSprintValidator, updateSprintValidator } from "../validators/sprint.validators.js";

// Mounted at /api/v1/projects/:projectId/sprints; mergeParams exposes :projectId.
const router = Router({ mergeParams: true });

router.use(verifyJWT);
router.param("sprintId", objectIdParam);

router.route("/")
    .post(authorizeProject("sprint", "create"), createSprintValidator(), validate, audit("sprint", "created"), createSprint)
    .get(authorizeProject("sprint", "read"), getProjectSprints);

router.get("/velocity", authorizeProject("sprint", "read"), getVelocityData);

router.route("/:sprintId")
    .get(authorizeProject("sprint", "read"), getSprintById)
    .put(authorizeProject("sprint", "update"), updateSprintValidator(), validate, audit("sprint", "updated"), updateSprint)
    .delete(authorizeProject("sprint", "delete"), audit("sprint", "deleted"), deleteSprint);

router.post("/:sprintId/start", authorizeProject("sprint", "start"), audit("sprint", "sprint_started"), startSprint);
router.post("/:sprintId/complete", authorizeProject("sprint", "complete"), completeSprintValidator(), validate,
    audit("sprint", "sprint_completed"), completeSprint);
router.get("/:sprintId/burndown", authorizeProject("sprint", "read"), getBurndownData);

export default router;
