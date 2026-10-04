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
