/**
 * FILE: backend/src/routes/admin.routes.js   (mounted at /api/v1/admin)
 *
 * ENDPOINTS
 *   GET  /users                 list/search users            user:read      (hr, super_admin)
 *   PUT  /users/:userId/role    change a user's systemRole   user:update    (super_admin)
 *   PUT  /users/:userId/status  activate / deactivate        user:update    (super_admin)
 *   GET  /analytics             platform-wide counts         analytics:read (super_admin)
 *   GET  /audit-log             global audit trail           audit:read     (super_admin)
 *
 * authorizeSystem checks ONLY user.systemRole (no workspace or project
 * involved). A role change, or a deactivation, also revokes the target's
 * sessions in the controller, so the change takes effect on their next request.
 */
import { Router } from "express";
import {
    listUsers,
    updateUserRole,
    updateUserStatus,
    getSystemAnalytics,
    getAuditLog,
} from "../controllers/admin.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeSystem } from "../middlewares/authorize.middleware.js";
import { audit } from "../middlewares/audit.middleware.js";
import { objectIdParam, validate } from "../middlewares/validator.middleware.js";
import { updateUserRoleValidator, updateUserStatusValidator } from "../validators/admin.validators.js";

// Platform administration. Permissions come from the same matrix as everything
// else: hr may read users; only super_admin (*:*) may change them or read the
// audit log. (This router used to admit product_manager wholesale, which let
// PMs change other users' roles although the matrix granted them no user rights.)
const router = Router();

// router.use applies verifyJWT to EVERY route below.
router.use(verifyJWT);
// router.param runs objectIdParam whenever a route has :userId, before the handler.
router.param("userId", objectIdParam);

router.get("/users", authorizeSystem("user", "read"), listUsers);
router.put("/users/:userId/role", authorizeSystem("user", "update"), updateUserRoleValidator(), validate,
    audit("user", "permission_changed"), updateUserRole);
router.put("/users/:userId/status", authorizeSystem("user", "update"), updateUserStatusValidator(), validate,
    audit("user", "updated"), updateUserStatus);
router.get("/analytics", authorizeSystem("analytics", "read"), getSystemAnalytics);
router.get("/audit-log", authorizeSystem("audit", "read"), getAuditLog);

export default router;
